/**
 * Manager Store API - Client Examples
 * ตัวอย่างการใช้งาน API สำหรับ Frontend Development
 * 
 * วิธีการใช้งาน:
 * 1. Copy โค้ดไปใช้ในโปรเจ็กต์ของคุณ
 * 2. ปรับ API_URL ให้ตรงกับ server ของคุณ
 * 3. Import และใช้งานได้เลย
 */

// =============================================
// CONFIGURATION
// =============================================

const API_CONFIG = {
    baseURL: 'https://your-api-domain.com/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
};

// =============================================
// HTTP CLIENT CLASS
// =============================================

class ApiClient {
    constructor(config = API_CONFIG) {
        this.baseURL = config.baseURL;
        this.timeout = config.timeout;
        this.headers = { ...config.headers };
        
        // ดึง token จาก localStorage
        this.token = localStorage.getItem('manager_store_token');
        
        if (this.token) {
            this.headers['Authorization'] = `Bearer ${this.token}`;
        }
    }

    // Set token สำหรับ authenticated requests
    setToken(token) {
        this.token = token;
        localStorage.setItem('manager_store_token', token);
        this.headers['Authorization'] = `Bearer ${token}`;
    }

    // Remove token (logout)
    removeToken() {
        this.token = null;
        localStorage.removeItem('manager_store_token');
        delete this.headers['Authorization'];
    }

    // Generic request method
    async request(method, endpoint, data = null, params = {}) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        const config = {
            method,
            headers: this.headers,
            timeout: this.timeout
        };

        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url.toString(), config);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }

            return result;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        return this.request('GET', endpoint, null, params);
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.request('POST', endpoint, data);
    }

    // PUT request
    async put(endpoint, data = {}) {
        return this.request('PUT', endpoint, data);
    }

    // DELETE request
    async delete(endpoint) {
        return this.request('DELETE', endpoint);
    }
}

// =============================================
// API SERVICE CLASSES
// =============================================

/**
 * Authentication Service
 */
class AuthService {
    constructor(apiClient) {
        this.api = apiClient;
    }

    // สมัครสมาชิกใหม่
    async register(userData) {
        const response = await this.api.post('/register', userData);
        
        if (response.success) {
            // แสดงข้อความสำเร็จ
            this.showSuccess('สมัครสมาชิกสำเร็จ! รอการอนุมัติจากผู้ดูแลระบบ');
        }
        
        return response;
    }

    // เข้าสู่ระบบ
    async login(username, password) {
        const response = await this.api.post('/login', { username, password });
        
        if (response.success) {
            // เก็บ token
            this.api.setToken(response.token);
            
            // เก็บข้อมูลผู้ใช้
            localStorage.setItem('manager_store_user', JSON.stringify(response.user));
            
            this.showSuccess('เข้าสู่ระบบสำเร็จ');
        }
        
        return response;
    }

    // ออกจากระบบ
    logout() {
        this.api.removeToken();
        localStorage.removeItem('manager_store_user');
        localStorage.removeItem('manager_store_token');
        
        this.showInfo('ออกจากระบบแล้ว');
        
        // Redirect ไปหน้า login
        window.location.href = '/login';
    }

    // ตรวจสอบสถานะการเข้าสู่ระบบ
    isLoggedIn() {
        return !!this.api.token;
    }

    // ดึงข้อมูลผู้ใช้ปัจจุบัน
    getCurrentUser() {
        const userStr = localStorage.getItem('manager_store_user');
        return userStr ? JSON.parse(userStr) : null;
    }

    // ตรวจสอบ token
    async verifyToken() {
        try {
            const response = await this.api.get('/verify-token');
            return response.success;
        } catch (error) {
            this.logout();
            return false;
        }
    }

    // Helper methods
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showInfo(message) {
        this.showToast(message, 'info');
    }

    showToast(message, type = 'info') {
        // สร้าง toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

/**
 * Super Admin Service
 */
class SuperAdminService {
    constructor(apiClient) {
        this.api = apiClient;
    }

    // ดึงรายการร้านค้าทั้งหมด
    async getAllStores(params = {}) {
        return await this.api.get('/admin/stores', params);
    }

    // ดึงรายละเอียดร้านค้า
    async getStoreDetail(storeId) {
        return await this.api.get(`/admin/stores/${storeId}`);
    }

    // อนุมัติร้านค้า
    async approveStore(storeId, notes = '') {
        return await this.api.post(`/admin/stores/${storeId}/approve`, { notes });
    }

    // ปฏิเสธร้านค้า
    async rejectStore(storeId, reason = '') {
        return await this.api.post(`/admin/stores/${storeId}/reject`, { reason });
    }

    // สร้าง Serial Key
    async createSerialKey(keyData) {
        return await this.api.post('/admin/serial-keys', keyData);
    }

    // ดึงรายการ Serial Key
    async getSerialKeys(params = {}) {
        return await this.api.get('/admin/serial-keys', params);
    }

    // ผูก Serial Key กับร้านค้า
    async assignSerial(storeId, serialKeyId) {
        return await this.api.post('/admin/assign-serial', { storeId, serialKeyId });
    }

    // ดึงรายการ Payment
    async getPayments(params = {}) {
        return await this.api.get('/admin/payments', params);
    }

    // อนุมัติ/ปฏิเสธ Payment
    async processPayment(paymentId, action, notes = '') {
        return await this.api.post(`/admin/payments/${paymentId}/action`, { action, notes });
    }

    // ดึงข้อมูล Dashboard
    async getDashboard() {
        return await this.api.get('/admin/dashboard');
    }

    // อัพเดทสถานะร้านค้า
    async updateStoreStatus(storeId, status, reason = '') {
        return await this.api.post(`/admin/stores/${storeId}/status`, { status, reason });
    }

    // ดึงประวัติการกระทำ
    async getActionLog(params = {}) {
        return await this.api.get('/admin/action-log', params);
    }
}

/**
 * Store Owner Service
 */
class StoreOwnerService {
    constructor(apiClient) {
        this.api = apiClient;
    }

    // ดึงข้อมูลร้านค้าตัวเอง
    async getStoreProfile() {
        return await this.api.get('/store/profile');
    }

    // อัพเดทข้อมูลร้านค้า
    async updateStoreProfile(profileData) {
        return await this.api.put('/store/profile', profileData);
    }

    // ดึง Configuration
    async getStoreConfig() {
        return await this.api.get('/store/config');
    }

    // อัพเดท Configuration
    async updateStoreConfig(config) {
        return await this.api.put('/store/config', config);
    }

    // ดึงรายการออเดอร์
    async getOrders(params = {}) {
        return await this.api.get('/store/orders', params);
    }

    // ดึงข้อมูล Dashboard
    async getDashboard() {
        return await this.api.get('/store/dashboard');
    }

    // ส่งหลักฐานชำระเงิน
    async submitPayment(paymentData) {
        return await this.api.post('/store/payments', paymentData);
    }

    // ส่ง Heartbeat
    async sendHeartbeat() {
        return await this.api.post('/store/heartbeat');
    }

    // เปลี่ยนรหัสผ่าน
    async changePassword(currentPassword, newPassword) {
        return await this.api.post('/change-password', {
            currentPassword,
            newPassword
        });
    }
}

// =============================================
// FRONTEND UTILITIES
// =============================================

/**
 * Form Validation Helpers
 */
class FormValidator {
    // ตรวจสอบการสมัครสมาชิก
    static validateRegistration(data) {
        const errors = [];

        if (!data.shopName?.trim()) {
            errors.push('กรุณาระบุชื่อร้าน');
        }

        if (!data.shopLink?.trim()) {
            errors.push('กรุณาระบุลิงก์ร้านค้า');
        } else if (!this.isValidURL(data.shopLink)) {
            errors.push('ลิงก์ร้านค้าไม่ถูกต้อง');
        }

        if (!data.username?.trim()) {
            errors.push('กรุณาระบุ Username');
        } else if (data.username.length < 3) {
            errors.push('Username ต้องมีอย่างน้อย 3 ตัวอักษร');
        }

        if (!data.password?.trim()) {
            errors.push('กรุณาระบุรหัสผ่าน');
        } else if (data.password.length < 8) {
            errors.push('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
        }

        if (data.password !== data.confirmPassword) {
            errors.push('รหัสผ่านไม่ตรงกัน');
        }

        // ตรวจสอบช่องทางติดต่ออย่างน้อย 1 ช่อง
        const contact = data.contact || {};
        if (!contact.email && !contact.phone && !contact.line && !contact.facebook) {
            errors.push('กรุณาระบุช่องทางติดต่ออย่างน้อย 1 ช่องทาง');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ตรวจสอบการเข้าสู่ระบบ
    static validateLogin(data) {
        const errors = [];

        if (!data.username?.trim()) {
            errors.push('กรุณาระบุ Username');
        }

        if (!data.password?.trim()) {
            errors.push('กรุณาระบุรหัสผ่าน');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ตรวจสอบ URL
    static isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // ตรวจสอบอีเมล
    static isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
}

/**
 * UI Components
 */
class UIComponents {
    // แสดง Modal
    static showModal(modalId, data = {}) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // อัพเดทข้อมูลใน modal
            Object.keys(data).forEach(key => {
                const element = modal.querySelector(`[data-field="${key}"]`);
                if (element) {
                    element.textContent = data[key];
                }
            });
            
            modal.classList.remove('hidden');
            
            // เพิ่ม event listeners
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('btn-back')) {
                    this.hideModal(modalId);
                }
            });
        }
    }

    // ซ่อน Modal
    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // แสดง Loading
    static showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<div class="loading">กำลังโหลด...</div>';
        }
    }

    // ซ่อน Loading
    static hideLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const loading = element.querySelector('.loading');
            if (loading) {
                loading.remove();
            }
        }
    }

    // แสดง Toast Notification
    static showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }

    // แสดง Confirm Dialog
    static showConfirm(title, message, onConfirm, onCancel = null) {
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-backdrop';
        confirmModal.innerHTML = `
            <div class="modal-window text-center">
                <div class="modal-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-content">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="this.closest('.modal-backdrop').remove(); ${onConfirm}">
                        ยืนยัน
                    </button>
                    <button class="btn-back" onclick="this.closest('.modal-backdrop').remove(); ${onCancel || ''}">
                        ยกเลิก
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(confirmModal);
    }
}

// =============================================
// USAGE EXAMPLES
// =============================================

// สร้าง instances
const apiClient = new ApiClient();
const authService = new AuthService(apiClient);
const superAdminService = new SuperAdminService(apiClient);
const storeOwnerService = new StoreOwnerService(apiClient);

/**
 * ตัวอย่างการใช้งาน - Super Admin
 */
async function superAdminExamples() {
    try {
        // 1. เข้าสู่ระบบ Super Admin
        const loginResult = await authService.login('admin', 'admin123');
        if (loginResult.success) {
            console.log('เข้าสู่ระบบสำเร็จ', loginResult.user);
        }

        // 2. ดึงรายการร้านค้าทั้งหมด
        const stores = await superAdminService.getAllStores({
            status: 'pending',
            page: 1,
            limit: 20
        });
        console.log('รายการร้านค้า:', stores);

        // 3. อนุมัติร้านค้า
        await superAdminService.approveStore(123, 'ตรวจสอบแล้วอนุมัติ');

        // 4. สร้าง Serial Key
        await superAdminService.createSerialKey({
            key: 'SERIAL2025ABC123',
            durationDays: 30,
            durationText: '1 เดือน',
            packageType: 'standard'
        });

        // 5. ดึงข้อมูล Dashboard
        const dashboard = await superAdminService.getDashboard();
        console.log('Dashboard:', dashboard);

    } catch (error) {
        console.error('เกิดข้อผิดพลาด:', error);
        UIComponents.showToast(error.message, 'error');
    }
}

/**
 * ตัวอย่างการใช้งาน - Store Owner
 */
async function storeOwnerExamples() {
    try {
        // 1. ล็อกอิน Store Owner
        const loginResult = await authService.login('storeowner', 'password123');
        if (loginResult.success) {
            console.log('เข้าสู่ระบบสำเร็จ', loginResult.user);
        }

        // 2. ดึงข้อมูลร้านค้าตัวเอง
        const profile = await storeOwnerService.getStoreProfile();
        console.log('ข้อมูลร้านค้า:', profile);

        // 3. อัพเดทข้อมูลร้านค้า
        await storeOwnerService.updateStoreProfile({
            shopName: 'ร้านค้าใหม่',
            shopLink: 'https://new-store.com',
            contact: {
                email: 'new@test.com',
                phone: '0812345678'
            }
        });

        // 4. ดึง Dashboard
        const dashboard = await storeOwnerService.getDashboard();
        console.log('Dashboard:', dashboard);

        // 5. ส่งหลักฐานชำระเงิน
        await storeOwnerService.submitPayment({
            amount: 29,
            proofImage: 'https://proof-url.com/slip.jpg',
            note: 'ชำระค่าบริการเดือน ธันวาคม'
        });

        // 6. ส่ง Heartbeat (ควรทำทุก 5 นาที)
        setInterval(async () => {
            await storeOwnerService.sendHeartbeat();
        }, 5 * 60 * 1000);

    } catch (error) {
        console.error('เกิดข้อผิดพลาด:', error);
        UIComponents.showToast(error.message, 'error');
    }
}

/**
 * ตัวอย่างการใช้งาน - การสมัครสมาชิก
 */
async function registrationExample() {
    try {
        const registrationData = {
            shopName: 'ร้านค้าทดสอบ',
            shopLink: 'https://my-test-store.com',
            shopAge: {
                year: 2,
                month: 6
            },
            contact: {
                email: 'owner@test.com',
                phone: '0812345678',
                line: 'test_line',
                facebook: 'test_facebook'
            },
            username: 'teststore',
            password: 'securepassword123',
            confirmPassword: 'securepassword123',
            packageType: 'standard',
            businessType: 'retail',
            expectedOrderCount: 100
        };

        // ตรวจสอบข้อมูลก่อนส่ง
        const validation = FormValidator.validateRegistration(registrationData);
        if (!validation.isValid) {
            UIComponents.showToast(validation.errors.join('\n'), 'error');
            return;
        }

        // สมัครสมาชิก
        const result = await authService.register(registrationData);
        if (result.success) {
            console.log('สมัครสมาชิกสำเร็จ:', result.data);
            // Redirect ไปหน้ายืนยัน
            window.location.href = '/registration-success';
        }

    } catch (error) {
        console.error('เกิดข้อผิดพลาด:', error);
        UIComponents.showToast(error.message, 'error');
    }
}

/**
 * ตัวอย่างการจัดการ Authentication
 */
function authenticationExample() {
    // ตรวจสอบสถานะการเข้าสู่ระบบ
    if (!authService.isLoggedIn()) {
        window.location.href = '/login';
        return;
    }

    // ตรวจสอบ token
    authService.verifyToken().then(isValid => {
        if (!isValid) {
            authService.logout();
        }
    });

    // Auto logout เมื่อ token หมดอายุ
    setInterval(() => {
        authService.verifyToken().then(isValid => {
            if (!isValid) {
                authService.logout();
            }
        });
    }, 60000); // ตรวจสอบทุกนาที
}

// =============================================
// EVENT HANDLERS
// =============================================

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    // ตั้งค่า Event Listeners
    
    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = {
                username: formData.get('username'),
                password: formData.get('password')
            };

            // ตรวจสอบข้อมูล
            const validation = FormValidator.validateLogin(data);
            if (!validation.isValid) {
                UIComponents.showToast(validation.errors.join('\n'), 'error');
                return;
            }

            UIComponents.showLoading('login-button');
            
            try {
                const result = await authService.login(data.username, data.password);
                if (result.success) {
                    // Redirect ตาม role
                    if (result.user.role === 'super_admin') {
                        window.location.href = '/admin/dashboard';
                    } else {
                        window.location.href = '/store/dashboard';
                    }
                }
            } catch (error) {
                UIComponents.showToast(error.message, 'error');
            } finally {
                UIComponents.hideLoading('login-button');
            }
        });
    }

    // Registration Form
    const registrationForm = document.getElementById('registration-form');
    if (registrationForm) {
        registrationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const data = {
                shopName: formData.get('shopName'),
                shopLink: formData.get('shopLink'),
                username: formData.get('username'),
                password: formData.get('password'),
                confirmPassword: formData.get('confirmPassword'),
                contact: {
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    line: formData.get('line'),
                    facebook: formData.get('facebook')
                },
                packageType: formData.get('packageType') || 'standard'
            };

            try {
                await registrationExample();
            } catch (error) {
                console.error(error);
            }
        });
    }

    // Logout Button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            UIComponents.showConfirm(
                'ยืนยันการออกจากระบบ',
                'คุณต้องการออกจากระบบหรือไม่?',
                'authService.logout()'
            );
        });
    }

    // Auto heartbeat สำหรับ Store Owner
    if (authService.getCurrentUser()?.role === 'store_admin') {
        setInterval(async () => {
            try {
                await storeOwnerService.sendHeartbeat();
            } catch (error) {
                console.error('Heartbeat failed:', error);
            }
        }, 5 * 60 * 1000); // ทุก 5 นาที
    }
});

// =============================================
// EXPORT FOR MODULE USAGE
// =============================================

// ES6 Module Export
export {
    ApiClient,
    AuthService,
    SuperAdminService,
    StoreOwnerService,
    FormValidator,
    UIComponents,
    apiClient,
    authService,
    superAdminService,
    storeOwnerService
};

// CommonJS Export (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ApiClient,
        AuthService,
        SuperAdminService,
        StoreOwnerService,
        FormValidator,
        UIComponents,
        apiClient,
        authService,
        superAdminService,
        storeOwnerService
    };
}

// Global usage (Browser)
if (typeof window !== 'undefined') {
    window.ManagerStoreAPI = {
        ApiClient,
        AuthService,
        SuperAdminService,
        StoreOwnerService,
        FormValidator,
        UIComponents,
        apiClient,
        authService,
        superAdminService,
        storeOwnerService
    };
}