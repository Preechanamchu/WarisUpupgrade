/**
 * Manager Store API - ระบบจัดการร้านค้าครบวงจร
 * แยกข้อมูลร้านค้าอย่างชัดเจน 100%
 * รองรับการสมัครผู้ใช้, การจัดการร้านค้า, และ Super Admin
 */

const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// เชื่อมต่อ Database (Neon.tech)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// JWT Secret (ในระบบจริงควรเก็บใน ENV)
const JWT_SECRET = process.env.JWT_SECRET || 'manager-store-secret-2025';

// ==========================================
// MIDDLEWARE & HELPERS
// ==========================================

// ตรวจสอบ JWT Token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'ไม่พบ Token' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token ไม่ถูกต้อง' });
    }
};

// ตรวจสอบว่าเป็น Super Admin
const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'ต้องการสิทธิ์ Super Admin' });
    }
    next();
};

// ตรวจสอบว่าเป็นเจ้าของร้านหรือ Super Admin
const requireStoreOwner = (req, res, next) => {
    const requestedStoreId = req.params.storeId || req.body.storeId || req.query.storeId;
    
    if (req.user.role === 'super_admin') {
        return next();
    }
    
    if (req.user.store_id !== parseInt(requestedStoreId)) {
        return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลร้านนี้' });
    }
    
    next();
};

// Helper: สร้าง JWT Token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            role: user.role, 
            store_id: user.store_id 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// Helper: ตรวจสอบสถานะร้านค้า
const checkStoreStatus = (storeStatus) => {
    const allowedStatuses = ['active', 'approved'];
    return allowedStatuses.includes(storeStatus);
};

// ==========================================
// 1. PUBLIC ROUTES (สมัครสมาชิก / ล็อกอิน)
// ==========================================

// 1.1 สมัครสมาชิกร้านค้าใหม่
app.post('/api/register', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { 
            shopName, 
            shopLink, 
            shopAge, 
            contact, 
            username, 
            password, 
            packageType,
            businessType,
            expectedOrderCount,
            referralCode
        } = req.body;

        // 1. ตรวจสอบ Username ซ้ำ
        const userCheck = await client.query(
            'SELECT id FROM users WHERE username = $1', 
            [username]
        );
        if (userCheck.rows.length > 0) {
            throw new Error('Username นี้ถูกใช้งานแล้ว');
        }

        // 2. ตรวจสอบ Referral Code (ถ้ามี)
        let referrerInfo = null;
        if (referralCode) {
            const referrerCheck = await client.query(
                `SELECT u.id, u.store_id, s.shop_name 
                 FROM users u 
                 JOIN stores s ON u.store_id = s.id 
                 WHERE u.referral_code = $1`,
                [referralCode]
            );
            if (referrerCheck.rows.length > 0) {
                referrerInfo = referrerCheck.rows[0];
            }
        }

        // 3. สร้างร้านค้าใหม่
        const storeRes = await client.query(
            `INSERT INTO stores (
                shop_name, shop_link, shop_age_year, shop_age_month, 
                contact_info, package_type, business_type, 
                expected_order_count, referrer_store_id, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') 
            RETURNING id, shop_name, registered_at`,
            [
                shopName, shopLink, shopAge.year, shopAge.month,
                JSON.stringify(contact), packageType, businessType,
                expectedOrderCount, referrerInfo?.store_id || null
            ]
        );
        
        const storeId = storeRes.rows[0].id;
        const storeName = storeRes.rows[0].shop_name;

        // 4. สร้าง Referral Code สำหรับร้านใหม่
        const referralCodeNew = `STORE${storeId}${Date.now().toString().slice(-6)}`;
        
        // 5. สร้าง User ผูกกับ Store
        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash(password, salt);
        
        await client.query(
            `INSERT INTO users (
                store_id, username, password_hash, role, referral_code,
                last_login, created_at
            ) VALUES ($1, $2, $3, 'store_admin', $4, NOW(), NOW())`,
            [storeId, username, hash, referralCodeNew]
        );

        // 6. สร้าง Default Configuration
        const defaultConfig = {
            shopInfo: {
                name: shopName,
                link: shopLink,
                slogan: 'บริการคุณภาพ ราคาเป็นมิตร',
                logo: null,
                theme: {
                    primaryColor: '#6366f1',
                    secondaryColor: '#8b5cf6',
                    backgroundColor: '#ffffff',
                    textColor: '#1f2937'
                }
            },
            business: {
                type: businessType,
                operatingHours: {
                    start: '09:00',
                    end: '18:00',
                    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                },
                deliveryAreas: [],
                paymentMethods: ['bank_transfer', 'truewallet']
            },
            notifications: {
                email: contact.email || '',
                phone: contact.phone || '',
                line: contact.line || '',
                facebook: contact.facebook || ''
            },
            system: {
                autoBackup: true,
                orderNotifications: true,
                lowStockAlert: true,
                customFields: []
            }
        };

        await client.query(
            `INSERT INTO store_configs (
                store_id, config_json, is_active, created_at, updated_at
            ) VALUES ($1, $2, true, NOW(), NOW())`,
            [storeId, JSON.stringify(defaultConfig)]
        );

        // 7. สร้าง Default Product Categories
        const defaultCategories = [
            { name: 'อุปกรณ์เหมือง', icon: 'fas fa-gem', order_types: ['mixed', 'selected', 'pure'] },
            { name: 'เครื่องประดับ', icon: 'fas fa-ring', order_types: ['mixed', 'selected', 'pure'] },
            { name: 'เครื่องใช้ไฟฟ้า', icon: 'fas fa-bolt', order_types: ['mixed', 'selected'] },
            { name: 'เสื้อผ้า', icon: 'fas fa-tshirt', order_types: ['mixed', 'selected', 'pure'] }
        ];

        for (const category of defaultCategories) {
            await client.query(
                `INSERT INTO product_categories (
                    store_id, category_name, icon, order_types, is_active, created_at
                ) VALUES ($1, $2, $3, $4, true, NOW())`,
                [storeId, category.name, category.icon, JSON.stringify(category.order_types)]
            );
        }

        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: 'สมัครสมาชิกสำเร็จ! รอการอนุมัติจากผู้ดูแลระบบ',
            data: {
                storeId,
                storeName,
                referralCode: referralCodeNew,
                username
            }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Registration error:', err);
        res.status(400).json({
            success: false,
            error: err.message
        });
    } finally {
        client.release();
    }
});

// 1.2 ล็อกอิน
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // ค้นหา User
        const result = await pool.query(
            `SELECT u.id, u.username, u.password_hash, u.role, u.store_id, 
                    s.status, s.shop_name, s.package_type, s.is_active,
                    s.serial_expiry_date, s.last_payment_date
             FROM users u
             JOIN stores s ON u.store_id = s.id
             WHERE u.username = $1`, 
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'ไม่พบผู้ใช้งาน'
            });
        }
        
        const user = result.rows[0];
        
        // ตรวจสอบรหัสผ่าน
        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) {
            return res.status(401).json({
                success: false,
                error: 'รหัสผ่านไม่ถูกต้อง'
            });
        }

        // ตรวจสอบสถานะร้านค้า
        if (user.role !== 'super_admin') {
            if (user.status === 'pending') {
                return res.status(403).json({
                    success: false,
                    error: 'ร้านค้าของคุณอยู่ระหว่างรอการอนุมัติ'
                });
            }
            
            if (user.status === 'locked') {
                return res.status(403).json({
                    success: false,
                    error: 'ร้านค้าถูกระงับการใช้งาน'
                });
            }
            
            if (user.status === 'expired') {
                return res.status(403).json({
                    success: false,
                    error: 'ระบบหมดอายุการใช้งาน กรุณาติดต่อผู้ดูแล'
                });
            }
        }

        // อัพเดท Last Login
        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // สร้าง Token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'เข้าสู่ระบบสำเร็จ',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                storeId: user.store_id,
                storeName: user.shop_name,
                packageType: user.package_type,
                storeStatus: user.status,
                isActive: user.is_active,
                serialExpiry: user.serial_expiry_date,
                lastPayment: user.last_payment_date
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ'
        });
    }
});

// 1.3 ตรวจสอบ Token
app.get('/api/verify-token', authenticateToken, async (req, res) => {
    try {
        // ดึงข้อมูล User และ Store เต็ม
        const result = await pool.query(
            `SELECT u.id, u.username, u.role, u.store_id, u.referral_code,
                    s.shop_name, s.status, s.package_type, s.is_active,
                    s.serial_expiry_date, s.current_serial_key
             FROM users u
             JOIN stores s ON u.store_id = s.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลผู้ใช้'
            });
        }

        const userData = result.rows[0];

        res.json({
            success: true,
            user: {
                id: userData.id,
                username: userData.username,
                role: userData.role,
                storeId: userData.store_id,
                storeName: userData.shop_name,
                storeStatus: userData.status,
                packageType: userData.package_type,
                isActive: userData.is_active,
                serialExpiry: userData.serial_expiry_date,
                referralCode: userData.referral_code
            }
        });

    } catch (err) {
        console.error('Token verification error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาด'
        });
    }
});

// ==========================================
// 2. SUPER ADMIN ROUTES (จัดการร้านค้าทั้งหมด)
// ==========================================

// 2.1 ดึงรายการร้านค้าทั้งหมด (แยกตามสถานะ)
app.get('/api/admin/stores', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { 
            status,           // pending, active, locked, expired
            package_type,     // standard, premium
            search,           // ค้นหาชื่อร้าน
            page = 1,         // pagination
            limit = 20        // items per page
        } = req.query;

        let query = `
            SELECT s.id, s.shop_name, s.shop_link, s.contact_info, 
                   s.package_type, s.status, s.registered_at, s.approved_at,
                   s.current_serial_key, s.serial_expiry_date, s.is_online,
                   s.last_active_at, s.business_type, s.expected_order_count,
                   u.username, u.last_login,
                   (SELECT COUNT(*) FROM orders o WHERE o.store_id = s.id) as total_orders,
                   (SELECT COALESCE(SUM(total_price), 0) FROM orders o WHERE o.store_id = s.id) as total_revenue
            FROM stores s
            JOIN users u ON s.id = u.store_id AND u.role = 'store_admin'
        `;
        
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push(`s.status = $${params.length + 1}`);
            params.push(status);
        }

        if (package_type) {
            conditions.push(`s.package_type = $${params.length + 1}`);
            params.push(package_type);
        }

        if (search) {
            conditions.push(`(s.shop_name ILIKE $${params.length + 1} OR u.username ILIKE $${params.length + 1})`);
            params.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY s.registered_at DESC`;
        
        // Pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // นับ total records
        let countQuery = 'SELECT COUNT(*) FROM stores s JOIN users u ON s.id = u.store_id AND u.role = \'store_admin\'';
        const countParams = [];
        
        if (conditions.length > 0) {
            countQuery += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        const countResult = await pool.query(countQuery, countParams);
        const totalRecords = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalRecords / limit),
                totalRecords,
                hasNext: page * limit < totalRecords,
                hasPrev: page > 1
            }
        });

    } catch (err) {
        console.error('Admin stores fetch error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านค้า'
        });
    }
});

// 2.2 ดึงรายละเอียดร้านค้าเฉพาะ
app.get('/api/admin/stores/:storeId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { storeId } = req.params;

        const result = await pool.query(
            `SELECT s.*, u.username, u.email, u.phone, u.referral_code,
                    sc.config_json,
                    (SELECT COUNT(*) FROM orders WHERE store_id = s.id) as total_orders,
                    (SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE store_id = s.id) as total_revenue,
                    (SELECT COUNT(*) FROM orders WHERE store_id = s.id AND created_at >= CURRENT_DATE) as today_orders
             FROM stores s
             JOIN users u ON s.id = u.store_id AND u.role = 'store_admin'
             LEFT JOIN store_configs sc ON s.id = sc.store_id
             WHERE s.id = $1`,
            [storeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลร้านค้า'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Admin store detail error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านค้า'
        });
    }
});

// 2.3 อนุมัติร้านค้า
app.post('/api/admin/stores/:storeId/approve', authenticateToken, requireSuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { storeId } = req.params;
        const { notes } = req.body;

        await client.query('BEGIN');

        // ตรวจสอบว่าร้านค้ามีอยู่จริง
        const storeCheck = await client.query(
            'SELECT id, shop_name, status FROM stores WHERE id = $1',
            [storeId]
        );

        if (storeCheck.rows.length === 0) {
            throw new Error('ไม่พบข้อมูลร้านค้า');
        }

        const store = storeCheck.rows[0];
        if (store.status !== 'pending') {
            throw new Error('ร้านค้านี้ไม่ได้อยู่ในสถานะรออนุมัติ');
        }

        // อัพเดทสถานะร้านค้า
        await client.query(
            `UPDATE stores 
             SET status = 'approved', 
                 approved_at = NOW(),
                 approved_by = $1,
                 approval_notes = $2
             WHERE id = $3`,
            [req.user.id, notes || null, storeId]
        );

        // บันทึกการกระทำในประวัติ
        await client.query(
            `INSERT INTO admin_action_log (
                admin_id, action_type, target_type, target_id, 
                description, metadata, created_at
            ) VALUES ($1, 'approve_store', 'store', $2, $3, $4, NOW())`,
            [req.user.id, storeId, `อนุมัติร้านค้า: ${store.shop_name}`, JSON.stringify({ notes })]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'อนุมัติร้านค้าสำเร็จ'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Approve store error:', err);
        res.status(400).json({
            success: false,
            error: err.message
        });
    } finally {
        client.release();
    }
});

// 2.4 ปฏิเสธร้านค้า
app.post('/api/admin/stores/:storeId/reject', authenticateToken, requireSuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { storeId } = req.params;
        const { reason } = req.body;

        await client.query('BEGIN');

        const storeCheck = await client.query(
            'SELECT id, shop_name, status FROM stores WHERE id = $1',
            [storeId]
        );

        if (storeCheck.rows.length === 0) {
            throw new Error('ไม่พบข้อมูลร้านค้า');
        }

        const store = storeCheck.rows[0];
        if (store.status !== 'pending') {
            throw new Error('ร้านค้านี้ไม่ได้อยู่ในสถานะรออนุมัติ');
        }

        await client.query(
            `UPDATE stores 
             SET status = 'rejected', 
                 rejected_at = NOW(),
                 rejected_by = $1,
                 rejection_reason = $2
             WHERE id = $3`,
            [req.user.id, reason || null, storeId]
        );

        await client.query(
            `INSERT INTO admin_action_log (
                admin_id, action_type, target_type, target_id, 
                description, metadata, created_at
            ) VALUES ($1, 'reject_store', 'store', $2, $3, $4, NOW())`,
            [req.user.id, storeId, `ปฏิเสธร้านค้า: ${store.shop_name}`, JSON.stringify({ reason })]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'ปฏิเสธร้านค้าสำเร็จ'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Reject store error:', err);
        res.status(400).json({
            success: false,
            error: err.message
        });
    } finally {
        client.release();
    }
});

// 2.5 สร้าง Serial Key
app.post('/api/admin/serial-keys', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { 
            key, 
            durationDays, 
            durationText, 
            packageType = 'standard',
            maxUses = 1,
            notes 
        } = req.body;

        // ตรวจสอบว่า Serial Key ซ้ำไหม
        const keyCheck = await pool.query(
            'SELECT id FROM serial_keys WHERE key_code = $1',
            [key]
        );

        if (keyCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Serial Key นี้มีอยู่แล้ว'
            });
        }

        // คำนวณวันหมดอายุ
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + durationDays);

        await pool.query(
            `INSERT INTO serial_keys (
                key_code, duration_days, duration_text, package_type,
                max_uses, used_count, status, created_by, expiry_date,
                notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, 0, 'available', $6, $7, $8, NOW())`,
            [key, durationDays, durationText, packageType, maxUses, req.user.id, expiryDate, notes]
        );

        res.status(201).json({
            success: true,
            message: 'สร้าง Serial Key สำเร็จ',
            data: {
                key,
                durationDays,
                durationText,
                expiryDate
            }
        });

    } catch (err) {
        console.error('Create serial key error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการสร้าง Serial Key'
        });
    }
});

// 2.6 ดึงรายการ Serial Key
app.get('/api/admin/serial-keys', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { status, packageType, search } = req.query;

        let query = `
            SELECT sk.*, 
                   u.username as created_by_name,
                   s.shop_name as used_by_store_name
            FROM serial_keys sk
            LEFT JOIN users u ON sk.created_by = u.id
            LEFT JOIN stores s ON sk.used_by_store_id = s.id
        `;
        
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push(`sk.status = $${params.length + 1}`);
            params.push(status);
        }

        if (packageType) {
            conditions.push(`sk.package_type = $${params.length + 1}`);
            params.push(packageType);
        }

        if (search) {
            conditions.push(`sk.key_code ILIKE $${params.length + 1}`);
            params.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ' ORDER BY sk.created_at DESC';

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {
        console.error('Fetch serial keys error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Serial Key'
        });
    }
});

// 2.7 ผูก Serial Key กับร้านค้า
app.post('/api/admin/assign-serial', authenticateToken, requireSuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { storeId, serialKeyId } = req.body;

        await client.query('BEGIN');

        // ตรวจสอบ Serial Key
        const keyRes = await client.query(
            'SELECT * FROM serial_keys WHERE id = $1 AND status = \'available\'',
            [serialKeyId]
        );

        if (keyRes.rows.length === 0) {
            throw new Error('Serial Key ไม่ถูกต้องหรือถูกใช้ไปแล้ว');
        }

        const keyData = keyRes.rows[0];

        // ตรวจสอบว่าร้านค้ามีสิทธิ์ใช้ Serial Key นี้ไหม
        if (keyData.package_type !== 'any' && keyData.package_type !== null) {
            const storeRes = await client.query(
                'SELECT package_type FROM stores WHERE id = $1',
                [storeId]
            );

            if (storeRes.rows.length > 0 && storeRes.rows[0].package_type !== keyData.package_type) {
                throw new Error('ประเภทแพ็คเกจไม่ตรงกับ Serial Key');
            }
        }

        // ตรวจสอบว่าร้านค้าไม่มี Serial Key อยู่แล้ว
        const existingKey = await client.query(
            'SELECT current_serial_key FROM stores WHERE id = $1 AND current_serial_key IS NOT NULL',
            [storeId]
        );

        if (existingKey.rows.length > 0) {
            throw new Error('ร้านค้านี้มี Serial Key อยู่แล้ว');
        }

        // อัพเดท Serial Key
        await client.query(
            `UPDATE serial_keys 
             SET status = 'assigned', 
                 used_by_store_id = $1, 
                 used_at = NOW(),
                 used_count = used_count + 1
             WHERE id = $2`,
            [storeId, serialKeyId]
        );

        // อัพเดทร้านค้า
        await client.query(
            `UPDATE stores 
             SET status = 'active', 
                 current_serial_key = $1, 
                 serial_expiry_date = $2,
                 activated_at = NOW()
             WHERE id = $3`,
            [keyData.key_code, keyData.expiry_date, storeId]
        );

        // สร้าง Payment Record
        await client.query(
            `INSERT INTO payments (
                store_id, amount, payment_type, status, created_at
            ) VALUES ($1, 0, 'system_activation', 'completed', NOW())`,
            [storeId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'ผูก Serial Key กับร้านค้าสำเร็จ',
            data: {
                storeId,
                serialKey: keyData.key_code,
                expiryDate: keyData.expiry_date
            }
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Assign serial error:', err);
        res.status(400).json({
            success: false,
            error: err.message
        });
    } finally {
        client.release();
    }
});

// 2.8 จัดการสถานะร้านค้า (ล็อก/ปลดล็อก)
app.post('/api/admin/stores/:storeId/status', authenticateToken, requireSuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { storeId } = req.params;
        const { status, reason } = req.body;

        const validStatuses = ['active', 'locked', 'suspended', 'expired'];
        if (!validStatuses.includes(status)) {
            throw new Error('สถานะไม่ถูกต้อง');
        }

        await client.query('BEGIN');

        await client.query(
            `UPDATE stores 
             SET status = $1, 
                 status_updated_at = NOW(),
                 status_updated_by = $2,
                 status_reason = $3
             WHERE id = $4`,
            [status, req.user.id, reason, storeId]
        );

        // บันทึกการกระทำ
        await client.query(
            `INSERT INTO admin_action_log (
                admin_id, action_type, target_type, target_id, 
                description, metadata, created_at
            ) VALUES ($1, 'update_status', 'store', $2, $3, $4, NOW())`,
            [req.user.id, storeId, `เปลี่ยนสถานะร้านค้าเป็น ${status}`, JSON.stringify({ reason })]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `เปลี่ยนสถานะร้านค้าเป็น ${status} สำเร็จ`
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update store status error:', err);
        res.status(400).json({
            success: false,
            error: err.message
        });
    } finally {
        client.release();
    }
});

// 2.9 Dashboard สำหรับ Super Admin
app.get('/api/admin/dashboard', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        // สถิติร้านค้า
        const storeStats = await pool.query(`
            SELECT 
                COUNT(*) as total_stores,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_stores,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_stores,
                COUNT(CASE WHEN status = 'locked' THEN 1 END) as locked_stores,
                COUNT(CASE WHEN package_type = 'premium' THEN 1 END) as premium_stores,
                COUNT(CASE WHEN package_type = 'standard' THEN 1 END) as standard_stores
            FROM stores
        `);

        // รายได้รวม
        const revenueStats = await pool.query(`
            SELECT 
                COALESCE(SUM(amount), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as monthly_revenue,
                COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN amount ELSE 0 END), 0) as today_revenue
            FROM payments 
            WHERE status = 'completed'
        `);

        // Serial Keys
        const serialStats = await pool.query(`
            SELECT 
                COUNT(*) as total_keys,
                COUNT(CASE WHEN status = 'available' THEN 1 END) as available_keys,
                COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_keys
            FROM serial_keys
        `);

        // ร้านค้าออนไลน์
        const onlineStats = await pool.query(`
            SELECT 
                COUNT(CASE WHEN is_online = true THEN 1 END) as online_stores,
                COUNT(CASE WHEN is_online = false THEN 1 END) as offline_stores
            FROM stores 
            WHERE status = 'active'
        `);

        // Top ร้านค้ายอดขาย
        const topStores = await pool.query(`
            SELECT s.shop_name, s.package_type,
                   COUNT(o.id) as total_orders,
                   COALESCE(SUM(o.total_price), 0) as total_revenue
            FROM stores s
            LEFT JOIN orders o ON s.id = o.store_id
            WHERE s.status = 'active'
            GROUP BY s.id, s.shop_name, s.package_type
            ORDER BY total_revenue DESC
            LIMIT 5
        `);

        // กราฟรายได้รายเดือน (6 เดือนย้อนหลัง)
        const monthlyRevenue = await pool.query(`
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                SUM(amount) as revenue
            FROM payments 
            WHERE status = 'completed' 
                AND created_at >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month
        `);

        res.json({
            success: true,
            data: {
                stores: storeStats.rows[0],
                revenue: revenueStats.rows[0],
                serialKeys: serialStats.rows[0],
                online: onlineStats.rows[0],
                topStores: topStores.rows,
                monthlyRevenue: monthlyRevenue.rows
            }
        });

    } catch (err) {
        console.error('Admin dashboard error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Dashboard'
        });
    }
});

// 2.10 รายการ Payment Requests
app.get('/api/admin/payments', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { status, storeId, page = 1, limit = 20 } = req.query;

        let query = `
            SELECT p.*, s.shop_name, s.package_type
            FROM payments p
            JOIN stores s ON p.store_id = s.id
        `;
        
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push(`p.status = $${params.length + 1}`);
            params.push(status);
        }

        if (storeId) {
            conditions.push(`p.store_id = $${params.length + 1}`);
            params.push(storeId);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ' ORDER BY p.created_at DESC';

        // Pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {
        console.error('Admin payments fetch error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Payment'
        });
    }
});

// 2.11 อนุมัติ/ปฏิเสธ Payment
app.post('/api/admin/payments/:paymentId/action', authenticateToken, requireSuperAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const { paymentId } = req.params;
        const { action, notes } = req.body; // approved, rejected

        if (!['approved', 'rejected'].includes(action)) {
            throw new Error('การกระทำไม่ถูกต้อง');
        }

        await client.query('BEGIN');

        // ดึงข้อมูล Payment
        const paymentRes = await client.query(
            'SELECT * FROM payments WHERE id = $1',
            [paymentId]
        );

        if (paymentRes.rows.length === 0) {
            throw new Error('ไม่พบข้อมูล Payment');
        }

        const payment = paymentRes.rows[0];

        // อัพเดท Payment
        await client.query(
            `UPDATE payments 
             SET status = $1, 
                 processed_at = NOW(),
                 processed_by = $2,
                 admin_notes = $3
             WHERE id = $4`,
            [action, req.user.id, notes, paymentId]
        );

        // ถ้าอนุมัติ ให้ต่ออายุร้านค้า
        if (action === 'approved') {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30); // 30 วัน

            await client.query(
                `UPDATE stores 
                 SET serial_expiry_date = $1,
                     status = 'active',
                     last_payment_date = NOW()
                 WHERE id = $2`,
                [expiryDate, payment.store_id]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `${action === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'} Payment สำเร็จ`
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Payment action error:', err);
        res.status(400).json({
            success: false,
            error: err.message
        });
    } finally {
        client.release();
    }
});

// ==========================================
// 3. STORE OWNER ROUTES (จัดการร้านค้าตัวเอง)
// ==========================================

// 3.1 ดึงข้อมูลร้านค้าตัวเอง
app.get('/api/store/profile', authenticateToken, async (req, res) => {
    try {
        const storeId = req.user.store_id;

        const result = await pool.query(
            `SELECT s.*, u.username, u.email, u.phone, u.referral_code,
                    sc.config_json,
                    (SELECT COUNT(*) FROM orders WHERE store_id = s.id) as total_orders,
                    (SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE store_id = s.id) as total_revenue
             FROM stores s
             JOIN users u ON s.id = u.store_id AND u.role = 'store_admin'
             LEFT JOIN store_configs sc ON s.id = sc.store_id
             WHERE s.id = $1`,
            [storeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลร้านค้า'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Store profile fetch error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูลร้านค้า'
        });
    }
});

// 3.2 อัพเดทข้อมูลร้านค้า
app.put('/api/store/profile', authenticateToken, async (req, res) => {
    try {
        const storeId = req.user.store_id;
        const {
            shopName,
            shopLink,
            contact,
            businessType,
            expectedOrderCount,
            operatingHours,
            deliveryAreas
        } = req.body;

        await pool.query(
            `UPDATE stores 
             SET shop_name = $1,
                 shop_link = $2,
                 contact_info = $3,
                 business_type = $4,
                 expected_order_count = $5,
                 updated_at = NOW()
             WHERE id = $6`,
            [
                shopName,
                shopLink,
                JSON.stringify(contact),
                businessType,
                expectedOrderCount,
                storeId
            ]
        );

        // อัพเดท Configuration
        const configUpdate = {
            shopInfo: {
                name: shopName,
                link: shopLink
            },
            business: {
                type: businessType,
                operatingHours,
                deliveryAreas
            },
            notifications: contact
        };

        await pool.query(
            `UPDATE store_configs 
             SET config_json = $1,
                 updated_at = NOW()
             WHERE store_id = $2`,
            [JSON.stringify(configUpdate), storeId]
        );

        res.json({
            success: true,
            message: 'อัพเดทข้อมูลร้านค้าสำเร็จ'
        });

    } catch (err) {
        console.error('Store profile update error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล'
        });
    }
});

// 3.3 ดึง Configuration ของร้าน
app.get('/api/store/config', authenticateToken, async (req, res) => {
    try {
        const storeId = req.user.store_id;

        const result = await pool.query(
            'SELECT config_json FROM store_configs WHERE store_id = $1',
            [storeId]
        );

        if (result.rows.length > 0) {
            res.json({
                success: true,
                data: result.rows[0].config_json
            });
        } else {
            res.json({
                success: true,
                data: {}
            });
        }

    } catch (err) {
        console.error('Store config fetch error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึง Configuration'
        });
    }
});

// 3.4 อัพเดท Configuration
app.put('/api/store/config', authenticateToken, async (req, res) => {
    try {
        const storeId = req.user.store_id;
        const config = req.body;

        await pool.query(
            `UPDATE store_configs 
             SET config_json = $1,
                 updated_at = NOW()
             WHERE store_id = $2`,
            [JSON.stringify(config), storeId]
        );

        res.json({
            success: true,
            message: 'อัพเดท Configuration สำเร็จ'
        });

    } catch (err) {
        console.error('Store config update error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการอัพเดท Configuration'
        });
    }
});

// 3.5 ดึงรายการออเดอร์ของร้าน
app.get('/api/store/orders', authenticateToken, async (req, res) => {
    try {
        const storeId = req.user.store_id;
        const { status, page = 1, limit = 20 } = req.query;

        let query = 'SELECT * FROM orders WHERE store_id = $1';
        const params = [storeId];

        if (status) {
            query += ` AND status = $${params.length + 1}`;
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        // Pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {
        console.error('Store orders fetch error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงรายการออเดอร์'
        });
    }
});

// 3.6 Dashboard สำหรับ Store Owner
app.get('/api/store/dashboard', authenticateToken, async (req, res) => {
    try {
        const storeId = req.user.store_id;

        // สถิติออเดอร์
        const orderStats = await pool.query(
            `SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 'new' THEN 1 END) as new_orders,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
                COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_orders,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as monthly_orders,
                COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_price ELSE 0 END), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE THEN total_price ELSE 0 END), 0) as today_revenue,
                COALESCE(SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' AND status != 'cancelled' THEN total_price ELSE 0 END), 0) as monthly_revenue
             FROM orders 
             WHERE store_id = $1`,
            [storeId]
        );

        // ออเดอร์ล่าสุด
        const recentOrders = await pool.query(
            `SELECT * FROM orders 
             WHERE store_id = $1 
             ORDER BY created_at DESC 
             LIMIT 10`,
            [storeId]
        );

        // สินค้าขายดี
        const topProducts = await pool.query(
            `SELECT 
                JSON_ARRAY_ELEMENTS(items)::json->>'name' as product_name,
                COUNT(*) as order_count,
                SUM((JSON_ARRAY_ELEMENTS(items)::json->>'quantity')::int) as total_quantity
             FROM orders 
             WHERE store_id = $1 
                AND status != 'cancelled'
                AND created_at >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY product_name
             ORDER BY total_quantity DESC
             LIMIT 10`,
            [storeId]
        );

        // รายได้รายวัน (7 วันย้อนหลัง)
        const dailyRevenue = await pool.query(
            `SELECT 
                DATE(created_at) as date,
                SUM(total_price) as revenue
             FROM orders 
             WHERE store_id = $1 
                AND status != 'cancelled'
                AND created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY DATE(created_at)
             ORDER BY date`,
            [storeId]
        );

        res.json({
            success: true,
            data: {
                orders: orderStats.rows[0],
                recentOrders: recentOrders.rows,
                topProducts: topProducts.rows,
                dailyRevenue: dailyRevenue.rows
            }
        });

    } catch (err) {
        console.error('Store dashboard error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Dashboard'
        });
    }
});

// 3.7 ส่งหลักฐานการชำระเงิน
app.post('/api/store/payments', authenticateToken, async (req, res) => {
    try {
        const storeId = req.user.store_id;
        const { amount, proofImage, note } = req.body;

        await pool.query(
            `INSERT INTO payments (
                store_id, amount, proof_image, note, 
                status, created_at
            ) VALUES ($1, $2, $3, $4, 'pending', NOW())`,
            [storeId, amount, proofImage, note]
        );

        res.json({
            success: true,
            message: 'ส่งหลักฐานการชำระเงินสำเร็จ รอการตรวจสอบ'
        });

    } catch (err) {
        console.error('Store payment submit error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการส่งหลักฐาน'
        });
    }
});

// 3.8 Heartbeat (อัพเดทสถานะออนไลน์)
app.post('/api/store/heartbeat', authenticateToken, async (req, res) => {
    try {
        const storeId = req.user.store_id;

        await pool.query(
            `UPDATE stores 
             SET is_online = true, 
                 last_active_at = NOW()
             WHERE id = $1`,
            [storeId]
        );

        res.json({
            success: true,
            message: 'Heartbeat updated'
        });

    } catch (err) {
        console.error('Heartbeat error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการอัพเดท Heartbeat'
        });
    }
});

// ==========================================
// 4. UTILITY ROUTES
// ==========================================

// 4.1 เปลี่ยนรหัสผ่าน
app.post('/api/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // ดึงรหัสผ่านเดิม
        const result = await pool.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลผู้ใช้'
            });
        }

        // ตรวจสอบรหัสผ่านเดิม
        const validPass = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!validPass) {
            return res.status(400).json({
                success: false,
                error: 'รหัสผ่านเดิมไม่ถูกต้อง'
            });
        }

        // เข้ารหัสรหัสผ่านใหม่
        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash(newPassword, salt);

        // อัพเดทรหัสผ่าน
        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [hash, userId]
        );

        res.json({
            success: true,
            message: 'เปลี่ยนรหัสผ่านสำเร็จ'
        });

    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน'
        });
    }
});

// 4.2 ดึงประวัติการกระทำ (สำหรับ Admin)
app.get('/api/admin/action-log', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        const result = await pool.query(
            `SELECT al.*, u.username as admin_name
             FROM admin_action_log al
             JOIN users u ON al.admin_id = u.id
             ORDER BY al.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, (page - 1) * limit]
        );

        res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {
        console.error('Action log fetch error:', err);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงประวัติ'
        });
    }
});

// ==========================================
// ERROR HANDLING & SERVER STARTUP
// ==========================================

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        success: false,
        error: 'เกิดข้อผิดพลาดภายในระบบ'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'ไม่พบ API Endpoint ที่ร้องขอ'
    });
});

module.exports.handler = serverless(app);

// สำหรับ Local Development (ตั้งค่า port)
// if (process.env.NODE_ENV !== 'production') {
//     const PORT = process.env.PORT || 3001;
//     app.listen(PORT, () => {
//         console.log(`🚀 Manager Store API running on port ${PORT}`);
//         console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
//     });
// }