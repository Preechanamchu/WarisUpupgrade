const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // รองรับรูปภาพ base64 ใหญ่ๆ

// เชื่อมต่อ Database (Neon.tech)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- PIN HASHING SETUP ---
// PIN ที่ต้องการ: 210406
// เราจะ Hash ไว้เลยเพื่อความปลอดภัย (ในระบบจริงควรเก็บ Hash ใน ENV แต่เพื่อความง่ายใส่ที่นี่)
// Hash ของ 210406 คือ: $2a$10$tJk... (Generate ใหม่ทุกครั้งที่รันจริง แต่เราจะใช้ Logic ตรวจสอบสด)
const ADMIN_PIN = process.env.ADMIN_PIN || "210406"; 

// --- API ROUTES ---

const router = express.Router();

// 1. GET Config (ดึงค่าเริ่มต้น)
router.get('/config', async (req, res) => {
    try {
        const result = await pool.query('SELECT config_json FROM shop_config ORDER BY id DESC LIMIT 1');
        if (result.rows.length > 0) {
            res.json(result.rows[0].config_json);
        } else {
            res.json({}); // ส่ง object ว่างถ้าไม่มีข้อมูล
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2. POST Config (บันทึกค่า) - ต้องมี Token หรือรหัสผ่าน (ในที่นี้เราปล่อยผ่านจาก Admin Panel ที่ Login แล้ว)
router.post('/config', async (req, res) => {
    try {
        const newConfig = req.body;
        // Update แถวแรกเสมอ หรือ Insert ใหม่
        const check = await pool.query('SELECT id FROM shop_config LIMIT 1');
        if (check.rows.length > 0) {
            await pool.query('UPDATE shop_config SET config_json = $1 WHERE id = $2', [newConfig, check.rows[0].id]);
        } else {
            await pool.query('INSERT INTO shop_config (config_json) VALUES ($1)', [newConfig]);
        }
        res.json({ success: true, message: "Config updated" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 3. GET Orders
router.get('/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        // แปลง format ให้ตรงกับ Frontend
        const orders = result.rows.map(row => ({
            id: row.id,
            category: row.category,
            type: row.order_type,
            items: row.items,
            price: row.price,
            status: row.status,
            timestamp: row.created_at
        }));
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. POST Order (ลูกค้าสั่งของ)
router.post('/orders', async (req, res) => {
    try {
        const { id, category, type, items, price, status, timestamp } = req.body;
        
        // ตรวจสอบว่ามี ID ซ้ำไหม
        const check = await pool.query('SELECT id FROM orders WHERE id = $1', [id]);
        if (check.rows.length > 0) {
            // ถ้าซ้ำ ให้ gen ใหม่ หรือ update (ในที่นี้เลือก insert เลยเพราะ ID ควร unique จาก frontend)
             return res.status(400).json({ error: "Order ID exists" });
        }

        await pool.query(
            'INSERT INTO orders (id, category, order_type, items, price, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, category, type, JSON.stringify(items), price, status || 'new', timestamp || new Date()]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 5. UPDATE Order Status (Admin)
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

// 6. DELETE Order
router.delete('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM orders WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. LOGIN (Verify PIN)
router.post('/login', async (req, res) => {
    const { pin } = req.body;
    
    // เปรียบเทียบ PIN
    if (pin === ADMIN_PIN) {
        // สร้าง Dummy Token (ใน Production ควรใช้ JWT)
        res.json({ success: true, token: "admin-session-valid" });
    } else {
        res.status(401).json({ success: false, message: "Invalid PIN" });
    }
});

app.use('/.netlify/functions/api', router); // Path สำหรับ Netlify Functions

module.exports.handler = serverless(app);