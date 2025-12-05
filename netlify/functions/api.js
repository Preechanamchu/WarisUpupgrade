const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // รองรับรูปภาพขนาดใหญ่

// เชื่อมต่อ Database (Neon.tech)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const router = express.Router();

// ==========================================
// 0. HELPER FUNCTIONS
// ==========================================

// ฟังก์ชันช่วยหา Store ID (สำคัญมากสำหรับการบันทึกออเดอร์)
const getStoreId = async (req) => {
    // 1. ลองหาจาก Header (x-store-id)
    if (req.headers['x-store-id']) return req.headers['x-store-id'];
    
    // 2. ลองหาจาก Body (ถ้า frontend ส่งมา)
    if (req.body.storeId) return req.body.storeId;

    // 3. Fallback: ถ้าไม่มีจริงๆ ให้ใช้ "Super Admin Store" (ร้านแรกสุด) เพื่อกัน Error
    // (เฉพาะช่วง Testing เท่านั้น Production ควรบังคับส่ง)
    try {
        const res = await pool.query("SELECT id FROM stores ORDER BY registered_at ASC LIMIT 1");
        if (res.rows.length > 0) return res.rows[0].id;
    } catch (e) {
        console.error("Error finding fallback store:", e);
    }
    return null;
};

// Middleware: ตรวจสอบ Super Admin
const checkSuperAdmin = async (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (role !== 'super_admin') {
        return res.status(403).json({ error: "Access Denied: Super Admin Only" });
    }
    next();
};

// ==========================================
// 1. PUBLIC & ORDER ROUTES (ส่วนหน้าร้าน)
// ==========================================

// [GET] ดึงข้อมูล Config ร้านค้า
router.get('/config', async (req, res) => {
    try {
        const storeId = await getStoreId(req);
        if (!storeId) return res.json({}); // ถ้าไม่เจอร้าน ส่งค่าว่าง

        const result = await pool.query('SELECT config_json FROM store_configs WHERE store_id = $1', [storeId]);
        if (result.rows.length > 0) {
            res.json(result.rows[0].config_json);
        } else {
            res.json({});
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// [POST] บันทึกออเดอร์ (แก้ไขแล้ว: เพิ่ม store_id)
router.post('/orders', async (req, res) => {
    try {
        const { id, category, type, items, price, source, status } = req.body;
        
        // *สำคัญ* ต้องระบุ Store ID เสมอ
        const storeId = await getStoreId(req);
        
        if (!storeId) {
            return res.status(400).json({ error: "Store ID Not Found (System Error)" });
        }

        // ตรวจสอบ ID ซ้ำ
        const check = await pool.query('SELECT id FROM orders WHERE id = $1', [id]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: "Order ID exists" });
        }

        // บันทึกลงฐานข้อมูลพร้อม store_id
        await pool.query(
            `INSERT INTO orders (id, store_id, category, order_type, items, total_price, status, source, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
                id, 
                storeId, 
                category, 
                type, 
                JSON.stringify(items), 
                price, 
                status || 'new', 
                source || 'Direct'
            ]
        );
        res.json({ success: true, message: "Order saved successfully" });
    } catch (err) {
        console.error("Order Save Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// [GET] ดึงออเดอร์ของร้าน
router.get('/orders', async (req, res) => {
    try {
        const storeId = await getStoreId(req);
        if (!storeId) return res.json([]);

        const result = await pool.query(
            'SELECT * FROM orders WHERE store_id = $1 ORDER BY created_at DESC', 
            [storeId]
        );
        
        // แปลงข้อมูลให้ตรงกับ Frontend
        const orders = result.rows.map(row => ({
            id: row.id,
            category: row.category,
            type: row.order_type,
            items: row.items, // PostgreSQL JSONB จะแปลงเป็น Object ให้เอง
            price: parseFloat(row.total_price),
            status: row.status,
            source: row.source,
            timestamp: row.created_at
        }));
        
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [PUT] อัพเดทสถานะออเดอร์
router.put('/orders/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;
        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [DELETE] ลบออเดอร์
router.delete('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM orders WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. AUTH & REGISTER SYSTEM
// ==========================================

// [POST] สมัครสมาชิก (พร้อมสร้าง Config เริ่มต้น)
router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { 
            shopName, shopLink, shopAge, contact, 
            username, password, packageType 
        } = req.body;

        // 1. ตรวจสอบ Username ซ้ำ
        const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) throw new Error("Username นี้ถูกใช้งานแล้ว");

        // 2. สร้างร้านค้า (Store)
        const storeRes = await client.query(
            `INSERT INTO stores (shop_name, shop_link, shop_age_year, shop_age_month, contact_info, package_type, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
            [shopName, shopLink, shopAge.year, shopAge.month, JSON.stringify(contact), packageType]
        );
        const storeId = storeRes.rows[0].id;

        // 3. สร้าง User
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        await client.query(
            `INSERT INTO users (store_id, username, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
            [storeId, username, hash]
        );

        // 4. สร้าง Default Config
        const defaultConfig = {
            shopName: shopName,
            visuals: { themeColor: "#6366f1", opacityVal: 50 },
            items: {}, prices: {}
        };
        await client.query(
            `INSERT INTO store_configs (store_id, config_json) VALUES ($1, $2)`,
            [storeId, JSON.stringify(defaultConfig)]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "สมัครสมาชิกสำเร็จ รอการอนุมัติ", storeId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// [POST] เข้าสู่ระบบ (รองรับทั้ง Admin และ Super Admin)
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. กรณี Super Admin Hardcode (เพื่อความรวดเร็วในการกู้ระบบ)
        // หรือจะสร้าง User ใน DB ก็ได้ แต่แบบนี้ชัวร์กว่าสำหรับ Initial Setup
        if(username === 'superadmin' && password === 'super1234') {
             return res.json({
                success: true,
                user: {
                    id: 'super-admin-id',
                    username: 'superadmin',
                    role: 'super_admin',
                    storeId: null
                }
            });
        }
        
        // 2. กรณี User ทั่วไป
        const result = await pool.query(
            `SELECT u.id, u.username, u.password_hash, u.role, u.store_id, s.status, s.shop_name, s.package_type 
             FROM users u
             JOIN stores s ON u.store_id = s.id
             WHERE u.username = $1`, 
            [username]
        );

        if (result.rows.length === 0) return res.status(401).json({ error: "ไม่พบผู้ใช้งาน" });
        
        const user = result.rows[0];
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

        if (user.status === 'pending') return res.status(403).json({ error: "ร้านค้ารอการอนุมัติ" });
        if (user.status === 'locked') return res.status(403).json({ error: "ร้านค้าถูกระงับ" });

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                storeId: user.store_id,
                shopName: user.shop_name,
                package: user.package_type
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [POST] บันทึก Config
router.post('/config', async (req, res) => {
    try {
        const storeId = await getStoreId(req);
        if (!storeId) return res.status(400).json({ error: "Store ID missing" });

        const newConfig = req.body;
        
        await pool.query(
            `INSERT INTO store_configs (store_id, config_json, updated_at) 
             VALUES ($1, $2, NOW())
             ON CONFLICT (store_id) DO UPDATE 
             SET config_json = $2, updated_at = NOW()`, 
            [storeId, JSON.stringify(newConfig)]
        );
        res.json({ success: true, message: "Config updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. MANAGER STORE ROUTES (Super Admin)
// ==========================================

// [GET] ดึงรายชื่อร้านค้าทั้งหมด
router.get('/admin/stores', checkSuperAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, shop_name, shop_link, contact_info, package_type, status, registered_at, current_serial_key, serial_expiry_date, is_online 
             FROM stores ORDER BY registered_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [POST] สร้าง Serial Key
router.post('/admin/serial-keys', checkSuperAdmin, async (req, res) => {
    try {
        const { key, durationDays, durationText } = req.body;
        await pool.query(
            `INSERT INTO serial_keys (key_code, duration_days, duration_text, status) VALUES ($1, $2, $3, 'available')`,
            [key, durationDays, durationText]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// [POST] ผูก Serial Key (Activate Store)
router.post('/admin/assign-serial', checkSuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { storeId, serialKeyId } = req.body;

        const keyRes = await client.query('SELECT * FROM serial_keys WHERE id = $1 AND status = \'available\'', [serialKeyId]);
        if (keyRes.rows.length === 0) throw new Error("Serial Key ไม่ถูกต้อง");
        const keyData = keyRes.rows[0];

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + keyData.duration_days);

        await client.query(`UPDATE serial_keys SET status = 'assigned', used_by_store_id = $1, activated_at = NOW() WHERE id = $2`, [storeId, serialKeyId]);
        await client.query(`UPDATE stores SET status = 'active', current_serial_key = $1, serial_expiry_date = $2 WHERE id = $3`, [keyData.key_code, expiryDate, storeId]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// [POST] แจ้งเตือนร้านค้า (Notify Payment)
router.post('/store/payment', async (req, res) => {
    try {
        const storeId = await getStoreId(req);
        const { amount, proofLink, note } = req.body;
        await pool.query(
            `INSERT INTO payments (store_id, amount, proof_image, note, status) VALUES ($1, $2, $3, $4, 'pending')`,
            [storeId, amount, proofLink, note]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// เชื่อมต่อ path กับ Router
app.use('/.netlify/functions/api', router);

module.exports.handler = serverless(app);
