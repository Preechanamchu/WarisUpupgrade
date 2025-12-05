const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // รองรับรูปภาพ/Config ขนาดใหญ่

// เชื่อมต่อ Database (Neon.tech)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ==========================================
// MIDDLEWARE & HELPERS
// ==========================================

// Helper: ตรวจสอบว่าเป็น Super Admin หรือไม่
// ในการใช้งานจริงควรใช้ JWT Token แต่ในที่นี้จะใช้ Header 'x-user-role' และ 'x-store-id' อย่างง่ายเพื่อสาธิต
const checkSuperAdmin = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (role !== 'super_admin') {
        return res.status(403).json({ error: "Access Denied: Super Admin Only" });
    }
    next();
};

// ==========================================
// 1. PUBLIC ROUTES (สมัครสมาชิก / ล็อกอิน)
// ==========================================

// 1.1 สมัครสมาชิกร้านค้าใหม่ (Register)
app.post('/api/register', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { 
            shopName, shopLink, shopAge, contact, 
            username, password, packageType 
        } = req.body;

        // 1. ตรวจสอบ Username ซ้ำ
        const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            throw new Error("Username นี้ถูกใช้งานแล้ว");
        }

        // 2. สร้างร้านค้า (Store) - สถานะ pending
        const storeRes = await client.query(
            `INSERT INTO stores (shop_name, shop_link, shop_age_year, shop_age_month, contact_info, package_type, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
            [shopName, shopLink, shopAge.year, shopAge.month, JSON.stringify(contact), packageType]
        );
        const storeId = storeRes.rows[0].id;

        // 3. สร้าง User ผูกกับ Store
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        
        await client.query(
            `INSERT INTO users (store_id, username, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
            [storeId, username, hash]
        );

        // 4. สร้าง Default Config ให้ร้านค้า
        // *สำคัญ* ตรงนี้คือการสร้างพื้นที่แยกสำหรับการตั้งค่าของร้านนี้โดยเฉพาะ
        const defaultConfig = {
            shopName: shopName,
            visuals: { themeColor: "#6366f1" },
            // ... ค่า Default อื่นๆ
        };
        await client.query(
            `INSERT INTO store_configs (store_id, config_json) VALUES ($1, $2)`,
            [storeId, JSON.stringify(defaultConfig)]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "สมัครสมาชิกสำเร็จ รอการอนุมัติ", storeId });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// 1.2 ล็อกอิน (Login)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // ค้นหา User
        const result = await pool.query(
            `SELECT u.id, u.username, u.password_hash, u.role, u.store_id, s.status, s.shop_name, s.package_type 
             FROM users u
             JOIN stores s ON u.store_id = s.id
             WHERE u.username = $1`, 
            [username]
        );

        if (result.rows.length === 0) return res.status(401).json({ error: "ไม่พบผู้ใช้งาน" });
        
        const user = result.rows[0];
        
        // ตรวจสอบรหัสผ่าน
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

        // ตรวจสอบสถานะร้านค้า
        if (user.status === 'pending' && user.role !== 'super_admin') {
            return res.status(403).json({ error: "ร้านค้าของคุณอยู่ระหว่างรอการอนุมัติ" });
        }
        if ((user.status === 'locked' || user.status === 'expired') && user.role !== 'super_admin') {
            return res.status(403).json({ error: "ร้านค้าถูกระงับหรือหมดอายุการใช้งาน" });
        }

        // ส่งข้อมูลกลับ (Frontend จะเก็บ store_id ไว้ใช้ยิง API อื่นๆ)
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

// ==========================================
// 2. SUPER ADMIN ROUTES (Manager Store)
// ==========================================

// 2.1 ดึงรายชื่อร้านค้าทั้งหมด (แยก Tab: pending, active, locked)
app.get('/api/admin/stores', checkSuperAdmin, async (req, res) => {
    try {
        const { status } = req.query; // pending, active, etc.
        let query = `SELECT id, shop_name, shop_link, contact_info, package_type, status, registered_at, current_serial_key, serial_expiry_date, is_online 
                     FROM stores`;
        let params = [];
        
        if (status) {
            query += ` WHERE status = $1`;
            params.push(status);
        }
        
        query += ` ORDER BY registered_at DESC`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2.2 อนุมัติร้านค้า (Approve Store)
app.post('/api/admin/approve-store', checkSuperAdmin, async (req, res) => {
    try {
        const { storeId } = req.body;
        // เปลี่ยนสถานะเป็น approved (ยังไม่ active จนกว่าจะได้ Serial Key) หรือ active เลยถ้าระบบไม่ใช้ Serial
        await pool.query(
            `UPDATE stores SET status = 'approved', approved_at = NOW() WHERE id = $1`,
            [storeId]
        );
        res.json({ success: true, message: "อนุมัติร้านค้าแล้ว" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2.3 จัดการ Serial Key (สร้าง)
app.post('/api/admin/serial-keys', checkSuperAdmin, async (req, res) => {
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

// 2.4 ผูก Serial Key กับร้านค้า (Activate Store)
app.post('/api/admin/assign-serial', checkSuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { storeId, serialKeyId } = req.body;

        // ดึงข้อมูล Key
        const keyRes = await client.query('SELECT * FROM serial_keys WHERE id = $1 AND status = \'available\'', [serialKeyId]);
        if (keyRes.rows.length === 0) throw new Error("Serial Key ไม่ถูกต้องหรือถูกใช้ไปแล้ว");
        const keyData = keyRes.rows[0];

        // คำนวณวันหมดอายุ
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + keyData.duration_days);

        // อัพเดท Key
        await client.query(
            `UPDATE serial_keys SET status = 'assigned', used_by_store_id = $1, activated_at = NOW() WHERE id = $2`,
            [storeId, serialKeyId]
        );

        // อัพเดท Store (Active + วันหมดอายุ)
        await client.query(
            `UPDATE stores SET status = 'active', current_serial_key = $1, serial_expiry_date = $2 WHERE id = $3`,
            [keyData.key_code, expiryDate, storeId]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "เปิดใช้งานร้านค้าสำเร็จ" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// 2.5 จัดการการชำระเงิน (Payment)
app.post('/api/admin/payment-action', checkSuperAdmin, async (req, res) => {
    try {
        const { paymentId, action } = req.body; // action: approved, rejected
        const client = await pool.connect();
        
        await client.query('BEGIN');
        await client.query(`UPDATE payments SET status = $1, processed_at = NOW() WHERE id = $2`, [action, paymentId]);
        
        if (action === 'approved') {
            // Logic ต่ออายุร้านค้าอัตโนมัติ (ถ้ามี) หรือแค่บันทึกรายรับ
            // ...
        }
        
        await client.query('COMMIT');
        client.release();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. STORE ROUTES (API สำหรับแต่ละร้านค้า)
// ==========================================
// *สำคัญ* ทุก Route ต้องมี storeId เพื่อแยกข้อมูล

// 3.1 ดึง Config ของร้านตัวเอง
app.get('/api/store/config', async (req, res) => {
    try {
        const storeId = req.headers['x-store-id']; // รับจาก Header
        if (!storeId) return res.status(400).json({ error: "Store ID missing" });

        const result = await pool.query('SELECT config_json FROM store_configs WHERE store_id = $1', [storeId]);
        if (result.rows.length > 0) {
            res.json(result.rows[0].config_json);
        } else {
            res.json({}); // คืนค่าว่างถ้าไม่พบ
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3.2 บันทึก Config ของร้านตัวเอง (แยก 100%)
app.post('/api/store/config', async (req, res) => {
    try {
        const storeId = req.headers['x-store-id'];
        const newConfig = req.body;
        
        if (!storeId) return res.status(400).json({ error: "Store ID missing" });

        // Upsert Config (ถ้ามีให้อัพเดท ถ้าไม่มีให้สร้าง) โดยอิงจาก store_id
        await pool.query(
            `INSERT INTO store_configs (store_id, config_json, updated_at) 
             VALUES ($1, $2, NOW())
             ON CONFLICT (store_id) DO UPDATE 
             SET config_json = $2, updated_at = NOW()`, 
            [storeId, JSON.stringify(newConfig)]
        );
        
        res.json({ success: true, message: "บันทึกการตั้งค่าเรียบร้อย" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3.3 จัดการ Order (เฉพาะร้านใครร้านมัน)
app.get('/api/store/orders', async (req, res) => {
    try {
        const storeId = req.headers['x-store-id'];
        if (!storeId) return res.status(400).json({ error: "Store ID missing" });

        const result = await pool.query(
            'SELECT * FROM orders WHERE store_id = $1 ORDER BY created_at DESC', 
            [storeId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/store/orders', async (req, res) => {
    try {
        const storeId = req.headers['x-store-id'];
        const { id, category, type, items, price, source } = req.body;

        if (!storeId) return res.status(400).json({ error: "Store ID missing" });

        await pool.query(
            `INSERT INTO orders (id, store_id, category, order_type, items, total_price, status, source) 
             VALUES ($1, $2, $3, $4, $5, $6, 'new', $7)`,
            [id, storeId, category, type, JSON.stringify(items), price, source]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3.4 แจ้งชำระเงิน (ร้านแจ้งไปหา Admin)
app.post('/api/store/payment', async (req, res) => {
    try {
        const storeId = req.headers['x-store-id'];
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

// 3.5 Heartbeat (อัพเดทสถานะ Online)
app.post('/api/store/heartbeat', async (req, res) => {
    try {
        const storeId = req.headers['x-store-id'];
        if(storeId) {
            await pool.query('UPDATE stores SET is_online = true, last_active_at = NOW() WHERE id = $1', [storeId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Export สำหรับ Serverless หรือ run ปกติ
// app.listen(3000, () => console.log('Server running on port 3000'));
module.exports.handler = serverless(app);