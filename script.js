/**
 * WARISHAYDAY System V2.1 - Settings & Theme Update
 * Updates: Save Button for Themes, Refined Dashboard Logic
 */

// ================= MANAGER STORE GLOBAL VARIABLES =================
let managerStoreData = null;
let currentMSTab = 'pending-stores';
let countdownIntervals = {};

const DEFAULT_MANAGER_STORE = {
    isSuperAdmin: true,
    superAdminAuth: { username: "superadmin", password: "super1234" },
    pendingStores: [],
    approvedStores: [],
    serialKeys: [],
    activeStores: [],
    registrationHistory: [],
    paymentChannels: {
        bank: { name: "", account: "", holder: "" },
        truewallet: { phone: "", holder: "" }
    },
    paymentRequests: [],
    systemRevenue: []
};

function initManagerStore() {
    const stored = localStorage.getItem('wsd_manager_store_v1');
    if (stored) {
        managerStoreData = JSON.parse(stored);
    } else {
        managerStoreData = JSON.parse(JSON.stringify(DEFAULT_MANAGER_STORE));
        saveManagerStoreData();
    }
}

function saveManagerStoreData() {
    localStorage.setItem('wsd_manager_store_v1', JSON.stringify(managerStoreData));
}

// ================= NOTIFICATION SYSTEM (CORE) =================
const Notify = {
    show(message, type = 'info', icon = 'info-circle') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${message}</span>`;
        
        container.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.add('closing');
            setTimeout(() => {
                if(toast.isConnected) toast.remove();
            }, 300);
        }, 3000);
    },
    
    success(msg) { this.show(msg, 'success', 'check-circle'); },
    error(msg) { this.show(msg, 'error', 'exclamation-circle'); },
    warning(msg) { this.show(msg, 'warning', 'exclamation-triangle'); },
    info(msg) { this.show(msg, 'info', 'info-circle'); },

    confirm(title, message, onConfirm) {
        const modal = document.getElementById('custom-confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-message');
        const btnYes = document.getElementById('btn-confirm-yes');
        const btnNo = document.getElementById('btn-confirm-no');

        if(titleEl) titleEl.innerText = title;
        if(msgEl) msgEl.innerText = message;
        
        modal.classList.remove('hidden');

        // Clone buttons to remove old event listeners
        const newYes = btnYes.cloneNode(true);
        const newNo = btnNo.cloneNode(true);
        btnYes.parentNode.replaceChild(newYes, btnYes);
        btnNo.parentNode.replaceChild(newNo, btnNo);

        newYes.onclick = () => {
            modal.classList.add('hidden');
            if(onConfirm) onConfirm();
        };

        newNo.onclick = () => {
            modal.classList.add('hidden');
        };
    },

    prompt(title, currentValue, onConfirm) {
        let existing = document.getElementById('custom-input-modal');
        if(existing) existing.remove();

        const html = `
        <div id="custom-input-modal" class="overlay-backdrop" style="z-index:2100;">
            <div class="modal-window center-content" style="max-width:350px;">
                <h3 style="margin-bottom:15px;">${title}</h3>
                <input type="text" id="custom-prompt-input" class="form-control" value="${currentValue}" style="margin-bottom:20px;">
                <div style="display:flex; gap:10px; width:100%;">
                    <button id="btn-prompt-ok" class="btn-primary">ตกลง</button>
                    <button id="btn-prompt-cancel" class="btn-back" style="justify-content:center; border:1px solid #ddd;">ยกเลิก</button>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', html);
        
        document.getElementById('btn-prompt-cancel').onclick = () => document.getElementById('custom-input-modal').remove();
        document.getElementById('btn-prompt-ok').onclick = () => {
            const val = document.getElementById('custom-prompt-input').value;
            document.getElementById('custom-input-modal').remove();
            if(onConfirm) onConfirm(val);
        };
    }
};

// ================= DATA STRUCTURE =================
const DEFAULT_CONFIG = {
    shopName: "WARISHAYDAY",
    slogan: "บริการอัพเกรดรวดเร็วทันใจ",
    announcement: "",
    adminAuth: { username: "admin", password: "admin" }, // Default Auth
    
    // User Profile & Package Info
    ownerProfile: {
        shopAge: { year: 0, month: 0 },
        shopLink: "",
        contact: { line: "", fb: "", phone: "" }
    },
    currentPackage: "premium", // Default trial
    
    // Admin Configurable Package Settings
    packageConfig: {
        standard: { price: 29, desc: "เหมาะสำหรับผู้เริ่มต้น เน้นใช้งานฟังก์ชันพื้นฐาน" },
        premium: { price: 59, desc: "ปลดล็อคทุกฟีเจอร์ เพื่อการวิเคราะห์และสร้างแบรนด์" }
    },

    helpContent: { limit: { video: "", desc: "" }, buy: { video: "", desc: "" } },
    orderSettings: { prefix: "WSD", dateFormat: "0168", runDigits: 4, lastRunNumber: 0, currentDateCode: "" },
    visuals: { 
        themeColor: "#6366f1", 
        opacityVal: 50, 
        fontSizeHeading: 20, 
        fontSizeBody: 16, 
        backgroundImage: "", 
        backgroundOverlay: 50, 
        logo: "" 
    },
    categoryMeta: {
        barn: { 
            label: "โรงนา", icon: "fas fa-warehouse", color: "bg-red",
            options: { mixed: true, selected: true, pure: true, cross: true, tray: true }
        },
        silo: { 
            label: "ยุ้งฉาง", icon: "fas fa-seedling", color: "bg-orange",
            options: { mixed: true, selected: true, pure: true, cross: true, tray: true }
        },
        land: { 
            label: "ขยายพื้นที่", icon: "fas fa-map-marked-alt", color: "bg-green",
            options: { mixed: true, selected: true, pure: true, cross: true, tray: true }
        },
        train: { 
            label: "พื้นที่รถไฟ", icon: "fas fa-train", color: "bg-blue",
            options: { mixed: true, selected: true, pure: true, cross: true, tray: true }
        }
    },
    prices: {
        barn: { mixed: 100, selected: 150, pure: 200, tray: 15 },
        silo: { mixed: 100, selected: 150, pure: 200, tray: 15 },
        land: { mixed: 100, selected: 150, pure: 200, tray: 15 },
        train: { mixed: 100, selected: 150, pure: 200, tray: 15, mapPrice: 20 },
        cross: { tray: 20 }
    },
    items: {
        barn: [ { name: "สลัก", img: null }, { name: "ไม้กระดาน", img: null }, { name: "เทปกาว", img: null } ],
        silo: [ { name: "ตะปู", img: null }, { name: "ไม้ฝา", img: null }, { name: "ตะปูควง", img: null } ],
        land: [ { name: "โฉนด", img: null }, { name: "ค้อนไม้", img: null }, { name: "หมุดหลักเขต", img: null } ],
        train: [ { name: "โฉนด", img: null }, { name: "ค้อนไม้", img: null }, { name: "หมุดหลักเขต", img: null }, { name: "ชิ้นส่วนของแผนที่", img: null } ]
    }
};

// ================= API MANAGER =================
class DataManager {
    constructor() {
        this.config = null;
        this.orders = [];
    }

    async init() {
        await this.fetchConfig();
        await this.fetchOrders();
        this.applySettings();
    }

    async fetchConfig() {
        try {
            const stored = localStorage.getItem('wsd_config_v10');
            if (stored) this.config = this.mergeConfig(JSON.parse(stored));
            else {
                this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                this.saveConfig(this.config);
            }
        } catch (e) {
            console.error("Config fetch error:", e);
            this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    }

    async fetchOrders() {
        const stored = localStorage.getItem('wsd_orders_v9');
        this.orders = stored ? JSON.parse(stored) : [];
    }

    mergeConfig(loadedConfig) {
        let base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        let merged = { ...base, ...loadedConfig };
        
        merged.visuals = { ...base.visuals, ...loadedConfig.visuals };
        merged.adminAuth = { ...base.adminAuth, ...loadedConfig.adminAuth };
        merged.ownerProfile = { ...base.ownerProfile, ...loadedConfig.ownerProfile };
        merged.packageConfig = { ...base.packageConfig, ...loadedConfig.packageConfig };
        
        Object.keys(base.categoryMeta).forEach(k => {
            if(!merged.categoryMeta[k]) merged.categoryMeta[k] = base.categoryMeta[k];
        });
        return merged;
    }

    getConfig() { return this.config; }

    async saveConfig(newConfig) {
        this.config = newConfig;
        this.applySettings();
        localStorage.setItem('wsd_config_v10', JSON.stringify(newConfig));
    }

    getOrders() { return this.orders; }

    async addOrder(order) {
        const newOrder = { ...order, timestamp: new Date().toISOString(), status: 'new' };
        this.orders.unshift(newOrder); 
        localStorage.setItem('wsd_orders_v9', JSON.stringify(this.orders));
    }

    async updateOrderStatus(id, status) {
        let order = this.orders.find(o => o.id === id);
        if(order) order.status = status;
        localStorage.setItem('wsd_orders_v9', JSON.stringify(this.orders));
    }

    async deleteOrder(id) {
        this.orders = this.orders.filter(o => o.id !== id);
        localStorage.setItem('wsd_orders_v9', JSON.stringify(this.orders));
    }
    
    generateOrderId() {
        let cfg = this.getConfig();
        let now = new Date();
        let mm = String(now.getMonth() + 1).padStart(2, '0');
        let yy = String(now.getFullYear()).slice(-2);
        let dateCode = (cfg.orderSettings.dateFormat === '0168') ? (mm + yy) : (yy + mm);
        
        if (cfg.orderSettings.currentDateCode !== dateCode) {
            cfg.orderSettings.currentDateCode = dateCode;
            cfg.orderSettings.lastRunNumber = 0;
        }

        cfg.orderSettings.lastRunNumber++;
        let run = String(cfg.orderSettings.lastRunNumber).padStart(cfg.orderSettings.runDigits, '0');
        
        this.saveConfig(cfg);
        return `${cfg.orderSettings.prefix}${dateCode}${run}`;
    }

    applySettings() {
        let cfg = this.config;
        if(!cfg) return;
        let root = document.documentElement;
        
        if(cfg.visuals.themeColor) {
            root.style.setProperty('--primary', cfg.visuals.themeColor);
            root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${cfg.visuals.themeColor}, #222)`);
        }
        
        let val = parseInt(cfg.visuals.opacityVal);
        let op = 1 - (Math.abs(50 - val) / 100); 
        root.style.setProperty('--opacity-val', op);

        if(cfg.visuals.fontSizeHeading) root.style.setProperty('--font-heading', `${cfg.visuals.fontSizeHeading}px`);
        if(cfg.visuals.fontSizeBody) root.style.setProperty('--font-body', `${cfg.visuals.fontSizeBody}px`);

        if(cfg.visuals.backgroundImage) root.style.setProperty('--bg-image', `url('${cfg.visuals.backgroundImage}')`);
        else root.style.setProperty('--bg-image', 'none');
        
        let overlayOp = (cfg.visuals.backgroundOverlay !== undefined ? cfg.visuals.backgroundOverlay : 50) / 100;
        root.style.setProperty('--bg-overlay-opacity', overlayOp);

        const nameDisplay = document.getElementById('shop-name-display');
        if(nameDisplay) nameDisplay.innerText = cfg.shopName;
        
        const sloganDisplay = document.getElementById('shop-slogan-display');
        if(sloganDisplay) sloganDisplay.innerText = cfg.slogan;

        const updateLogo = (imgId, iconId) => {
            const imgEl = document.getElementById(imgId);
            const iconEl = document.getElementById(iconId);
            if(imgEl && iconEl) {
                if(cfg.visuals.logo && cfg.visuals.logo !== "") {
                    imgEl.src = cfg.visuals.logo;
                    imgEl.classList.remove('hidden');
                    iconEl.classList.add('hidden');
                } else {
                    imgEl.classList.add('hidden');
                    iconEl.classList.remove('hidden');
                }
            }
        };

        updateLogo('main-logo-img', 'main-logo-icon');
        updateLogo('login-image-custom', 'login-icon-default'); 

        const annBox = document.getElementById('announcement-box');
        if(annBox) {
            if(cfg.announcement && cfg.announcement.trim() !== "") {
                annBox.classList.remove('hidden');
                document.getElementById('announcement-text').innerText = cfg.announcement;
            } else {
                annBox.classList.add('hidden');
            }
        }
    }
}

const db = new DataManager();
let currentCategory = '';
let currentLimit = 0;
let isFullLimit = false;
let currentOrderType = '';
let cart = [];
let chartInstances = {};
let currentAdminOrderTab = 'new';
let stockEditCat = '';
let currentTimelineView = 'day'; 
let pendingThemeColor = ''; // Temp variable for theme selection

document.addEventListener('DOMContentLoaded', async () => {
    initTracking();
    await db.init(); 
    renderCategoryMenu();
    const dateInput = document.getElementById('dash-date-filter');
    if(dateInput) dateInput.valueAsDate = new Date();
    Chart.defaults.font.family = "'Prompt', sans-serif";
});

// ================= TRACKING SYSTEM =================
function initTracking() {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('utm_source');
    if (source) {
        localStorage.setItem('wsd_source', source);
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
    }
}
function getTrackingSource() { return localStorage.getItem('wsd_source') || 'Direct'; }
function copyTrackingLink(platform) {
    if(!checkPermission('tracking')) return; 

    const baseUrl = window.location.origin + window.location.pathname;
    const link = `${baseUrl}?utm_source=${platform}`;
    
    navigator.clipboard.writeText(link).then(() => {
        Notify.success(`คัดลอกลิงก์ ${platform} แล้ว`);
    }).catch(err => {
        Notify.info("ไม่สามารถคัดลอกอัตโนมัติได้");
    });
}

// ================= PERMISSION SYSTEM (ACL) =================
function checkPermission(feature) {
    const config = db.getConfig();
    const pkg = config.currentPackage || 'standard';
    
    if (pkg === 'standard') {
        const restricted = ['dashboard', 'theme', 'tracking'];
        if (restricted.includes(feature)) {
            Notify.warning("ฟีเจอร์นี้สำหรับแพ็คเกจ Premium เท่านั้น");
            return false;
        }
    }
    return true;
}

// ================= AUTHENTICATION & REGISTRATION =================
document.getElementById('admin-login-btn').onclick = () => {
    db.applySettings();
    document.getElementById('admin-login-modal').classList.remove('hidden');
};

function closeAdminLogin() { 
    document.getElementById('admin-login-modal').classList.add('hidden'); 
    document.getElementById('admin-username').value = '';
    document.getElementById('admin-password').value = '';
}

function openRegisterModal() {
    closeAdminLogin();
    document.getElementById('register-modal').classList.remove('hidden');
}
function closeRegisterModal() {
    document.getElementById('register-modal').classList.add('hidden');
}

async function submitRegistration() {
    const shopName = document.getElementById('reg-shop-name').value.trim();
    const shopLink = document.getElementById('reg-shop-link').value.trim();
    const shopAgeY = document.getElementById('reg-age-year').value;
    const shopAgeM = document.getElementById('reg-age-month').value;
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('reg-confirm-password').value;
    const contactLine = document.getElementById('reg-contact-line').value.trim();
    const contactFb = document.getElementById('reg-contact-fb').value.trim();
    const contactPhone = document.getElementById('reg-contact-phone').value.trim();
    const packageSelect = document.querySelector('input[name="package_select"]:checked').value; 

    if (!shopName || !username || !password || !shopLink) {
        Notify.warning("กรุณากรอกข้อมูลสำคัญให้ครบ (ที่มีเครื่องหมาย *)");
        return;
    }
    if (password.length < 8) {
        Notify.error("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
        return;
    }
    if (password !== confirmPass) {
        Notify.error("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
        return;
    }
    if (!contactLine && !contactFb && !contactPhone) {
        Notify.warning("กรุณาระบุช่องทางติดต่ออย่างน้อย 1 ช่องทาง");
        return;
    }

    const config = db.getConfig();
    config.adminAuth = { username: username, password: password };
    config.shopName = shopName;
    config.ownerProfile = {
        shopAge: { year: parseInt(shopAgeY), month: parseInt(shopAgeM) },
        shopLink: shopLink,
        contact: { line: contactLine, fb: contactFb, phone: contactPhone }
    };
    config.currentPackage = packageSelect;

    if(packageSelect === 'standard') {
        config.visuals.themeColor = "#6366f1"; 
        config.visuals.backgroundImage = "";
        config.visuals.logo = "";
    }

    await db.saveConfig(config);
    closeRegisterModal();
    Notify.success("สมัครสมาชิกเรียบร้อย! กรุณาเข้าสู่ระบบ");
    
    document.getElementById('admin-login-modal').classList.remove('hidden');
    document.getElementById('admin-username').value = username;
    document.getElementById('admin-password').value = "";
}

async function verifyAdmin() {
    const userIn = document.getElementById('admin-username').value;
    const passIn = document.getElementById('admin-password').value;
    const config = db.getConfig();
    const auth = config.adminAuth || { username: "admin", password: "admin" };

    if (userIn === auth.username && passIn === auth.password) { 
        closeAdminLogin();
        document.getElementById('customer-view').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        await db.fetchOrders(); 
        
        if(config.currentPackage === 'standard') switchAdminTab('orders');
        else switchAdminTab('dashboard');
        
        Notify.success(`ยินดีต้อนรับคุณ ${auth.username} (${config.currentPackage.toUpperCase()})`);
    } else {
        Notify.error("Username หรือ Password ไม่ถูกต้อง");
    }
}

function logoutAdmin() { 
    Notify.confirm("ยืนยันการออกจากระบบ", "คุณต้องการออกจากระบบจัดการใช่หรือไม่?", () => {
        exitAdmin(); 
        document.getElementById('admin-username').value = '';
        document.getElementById('admin-password').value = '';
        Notify.info("ออกจากระบบแล้ว");
    });
}

function exitAdmin() {
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('customer-view').classList.remove('hidden');
    db.applySettings();
    renderCategoryMenu();
}
function toggleSidebar() { document.getElementById('adminSidebar').classList.toggle('active'); }

// ================= CUSTOMER FLOW =================
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    let icon = document.querySelector('#theme-toggle-btn i');
    icon.className = document.body.classList.contains('dark-mode') ? 'fas fa-sun' : 'fas fa-moon';
    if (!document.getElementById('admin-panel').classList.contains('hidden')) renderAdminDashboard();
}

function renderCategoryMenu() {
    const grid = document.getElementById('dynamic-menu-grid');
    if(!grid) return;
    grid.innerHTML = '';
    const config = db.getConfig();
    Object.keys(config.categoryMeta).forEach(key => {
        let meta = config.categoryMeta[key];
        grid.innerHTML += `
            <div class="menu-card" onclick="selectCategory('${key}')">
                <div class="menu-icon-box ${meta.color || 'bg-blue'}"><i class="${meta.icon}"></i></div>
                <h3>${meta.label}</h3>
            </div>
        `;
    });
}

function selectCategory(cat) {
    currentCategory = cat;
    let meta = db.getConfig().categoryMeta[cat];
    document.getElementById('category-selector').classList.add('hidden');
    document.getElementById('calculator-section').classList.remove('hidden');
    document.getElementById('selected-category-title').innerText = meta.label;
    document.getElementById('user-limit-input').value = '';
    document.getElementById('btn-check-limit').classList.add('disabled');
    switchStep(1);
    cart = [];
}

function goBackToMenu() {
    document.getElementById('calculator-section').classList.add('hidden');
    document.getElementById('category-selector').classList.remove('hidden');
    cart = [];
}

function switchStep(stepNumber) {
    for(let i=1; i<=4; i++) {
        const el = document.getElementById(`step-${i}-` + (i==1?'limit':i==2?'type':i==3?'items':'summary'));
        if(el) el.classList.add('hidden');
    }
    if (stepNumber === 1) document.getElementById('step-1-limit').classList.remove('hidden');
    if (stepNumber === 2) document.getElementById('step-2-type').classList.remove('hidden');
    if (stepNumber === 3) document.getElementById('step-3-items').classList.remove('hidden');
    if (stepNumber === 4) document.getElementById('step-4-summary').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateLimitInput(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    let btn = document.getElementById('btn-check-limit');
    if (input.value !== "") btn.classList.remove('disabled');
    else btn.classList.add('disabled');
}

function goToStep2() {
    let val = document.getElementById('user-limit-input').value;
    if (val === "") return;
    let inputVal = parseInt(val);
    if (inputVal < 0 || inputVal > 89) { Notify.warning("กรุณาระบุตัวเลขระหว่าง 0 ถึง 89"); return; }

    isFullLimit = (inputVal === 0);
    currentLimit = 89 - inputVal;

    document.getElementById('calculated-limit-step2').innerText = currentLimit;
    let badge = document.getElementById('limit-condition-text-step2');
    if(isFullLimit) { badge.innerText = "เต็มลิมิต"; badge.style.background = "#dbeafe"; badge.style.color = "#2563eb"; } 
    else { badge.innerText = "ไม่เต็มลิมิต"; badge.style.background = "#fee2e2"; badge.style.color = "#ef4444"; }

    document.getElementById('limit-mini-badge').innerText = `คงเหลือ: ${currentLimit}`;
    document.getElementById('limit-mini-badge').dataset.max = currentLimit;

    renderPurchaseOptions();
    switchStep(2);
}

function renderPurchaseOptions() {
    const container = document.getElementById('dynamic-purchase-buttons');
    container.innerHTML = '';
    const config = db.getConfig();
    const catOptions = config.categoryMeta[currentCategory].options || { mixed:true, selected:true, pure:true, cross:true };

    const options = [
        { id: 'mixed', label: 'แบบคละ', icon: 'fas fa-random', show: catOptions.mixed },
        { id: 'selected', label: 'แบบเลือก', icon: 'fas fa-hand-pointer', show: catOptions.selected },
        { id: 'pure', label: 'แบบล้วน', icon: 'fas fa-cubes', show: catOptions.pure },
        { id: 'cross', label: 'ข้ามโซน', icon: 'fas fa-exchange-alt', show: catOptions.cross }
    ];

    options.forEach(opt => {
        if(opt.show) {
            let btn = document.createElement('div');
            btn.className = 'option-card';
            btn.innerHTML = `<i class="${opt.icon}" style="display:block; font-size:1.5rem; margin-bottom:5px;"></i> ${opt.label}`;
            btn.onclick = () => selectOrderType(opt.id);
            container.appendChild(btn);
        }
    });
}

function selectOrderType(type) {
    currentOrderType = type;
    const typeNames = { mixed: 'แบบคละ', selected: 'แบบเลือก', pure: 'แบบล้วน', cross: 'ข้ามโซน' };
    document.getElementById('order-type-title').innerText = `ระบุสินค้า (${typeNames[type]})`;
    renderItemInputs(type);
    switchStep(3);
}

function renderItemInputs(type) {
    const container = document.getElementById('item-inputs-list');
    container.innerHTML = '';
    let itemsToRender = [];
    const config = db.getConfig();
    
    if (type === 'cross') {
        Object.keys(config.items).forEach(c => { config.items[c].forEach(i => itemsToRender.push({...i, cat: c})); });
        itemsToRender = itemsToRender.filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i);
    } else {
        itemsToRender = config.items[currentCategory] || [];
    }

    itemsToRender = itemsToRender.filter(item => {
        if (!item.options) return true; 
        if (type === 'mixed' && !item.options.mixed) return false;
        if (type === 'selected' && !item.options.selected) return false;
        if (type === 'pure' && !item.options.pure) return false;
        if (type === 'cross' && !item.options.cross) return false;
        return true;
    });

    if (itemsToRender.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">ไม่มีสินค้าที่รองรับรูปแบบนี้</div>`;
        updatePriceDisplay(0);
        return;
    }

    if (type === 'mixed') {
        itemsToRender.forEach(item => {
            let imgSrc = item.img ? item.img : ''; 
            let imgHTML = imgSrc ? `<img src="${imgSrc}" class="item-img-sm">` : `<div style="width:45px;height:45px;background:#eee;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#999;"><i class="fas fa-cube"></i></div>`;
            container.innerHTML += `<div class="item-row"><div class="item-meta">${imgHTML}<div>${item.name}</div></div><div style="font-size:1.5rem; font-weight:800; color:var(--primary);">?</div></div>`;
        });
        updatePriceDisplay(currentLimit);
    } else {
        itemsToRender.forEach(item => {
            let imgSrc = item.img ? item.img : '';
            let imgHTML = imgSrc ? `<img src="${imgSrc}" class="item-img-sm">` : `<div style="width:45px;height:45px;background:#eee;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#999;"><i class="fas fa-cube"></i></div>`;
            container.innerHTML += `<div class="item-row"><div class="item-meta">${imgHTML}<div>${item.name}</div></div><input type="number" data-name="${item.name}" class="qty-control" placeholder="0" min="0" oninput="calculateTotal(this)"></div>`;
        });
        updatePriceDisplay(0);
    }
}

function calculateTotal(currentInput) {
    let inputs = document.querySelectorAll('.qty-control');
    let total = 0; let filledCount = 0;
    inputs.forEach(input => { let val = parseInt(input.value) || 0; if (val > 0) filledCount++; total += val; });

    let maxLimit = parseInt(document.getElementById('limit-mini-badge').dataset.max) || currentLimit;
    let remaining = maxLimit - total;
    let badge = document.getElementById('limit-mini-badge');
    badge.innerText = `คงเหลือ: ${remaining}`;
    
    if (remaining < 0) {
        Notify.warning(`เกินลิมิต! คุณกดได้แค่ ${maxLimit} ชิ้น`);
        if(currentInput) {
            let currentVal = parseInt(currentInput.value) || 0;
            currentInput.value = currentVal + remaining; 
        }
        total = 0; inputs.forEach(input => total += (parseInt(input.value) || 0));
        badge.innerText = `คงเหลือ: ${maxLimit - total}`;
    }

    if (remaining === 0) {
        badge.style.background = "var(--success)";
        badge.style.color = "white";
        badge.style.borderColor = "var(--success)";
    } else {
        badge.style.background = "var(--bg-card)";
        badge.style.color = "var(--primary)";
        badge.style.borderColor = "var(--primary)";
    }

    if (currentOrderType === 'pure' && filledCount > 1) {
        Notify.warning("แบบล้วน เลือกได้แค่ 1 รายการเท่านั้น");
        if(currentInput) currentInput.value = "";
        total = 0; inputs.forEach(input => total += (parseInt(input.value) || 0));
    }
    updatePriceDisplay(total);
}

function updatePriceDisplay(totalItems) {
    let finalPrice = 0; let status = "";
    const config = db.getConfig();
    let prices = config.prices[currentCategory] || config.prices.cross;
    let calculatedTrayPrice = 0; let totalTrays = 0;

    if (currentOrderType === 'cross') {
        totalTrays = Math.ceil(totalItems / 10);
        calculatedTrayPrice = totalTrays * config.prices.cross.tray;
        status = `คิดตามถาด (${totalTrays} ถาด)`;
        finalPrice = calculatedTrayPrice;
    } else {
        let mapCount = 0; let generalCount = 0;
        if(prices.mapPrice) {
            if(currentOrderType === 'mixed') {
                totalTrays = Math.ceil(totalItems / 10);
                calculatedTrayPrice = totalTrays * prices.tray;
            } else {
                let inputs = document.querySelectorAll('.qty-control');
                inputs.forEach(inp => {
                    let v = parseInt(inp.value) || 0;
                    if(inp.dataset.name.includes("ชิ้นส่วนของแผนที่")) mapCount += v; else generalCount += v;
                });
                let mapTrays = Math.ceil(mapCount / 10);
                let genTrays = Math.ceil(generalCount / 10);
                totalTrays = mapTrays + genTrays;
                calculatedTrayPrice = (mapTrays * prices.mapPrice) + (genTrays * prices.tray);
            }
        } else {
            totalTrays = Math.ceil(totalItems / 10);
            calculatedTrayPrice = totalTrays * prices.tray;
        }

        let lumpSumPrice = prices[currentOrderType];
        if (calculatedTrayPrice >= lumpSumPrice && lumpSumPrice > 0) {
            finalPrice = lumpSumPrice; status = `ราคาเหมา (${currentOrderType})`;
        } else {
            finalPrice = calculatedTrayPrice; status = `คิดตามถาด (${totalTrays} ถาด)`;
        }
    }

    if(totalItems === 0 && !isFullLimit && currentOrderType !== 'mixed') finalPrice = 0;
    if(isFullLimit && currentOrderType === 'mixed' && currentOrderType !== 'cross') {
        finalPrice = prices.mixed; status = "ราคาเหมา (เต็มลิมิต)";
    }

    document.getElementById('price-status').innerText = status;
    document.getElementById('total-price-display').innerText = finalPrice;
    document.getElementById('total-price-display').dataset.value = finalPrice;
}

function goToStep4() {
    let price = parseInt(document.getElementById('total-price-display').dataset.value) || 0;
    if (price === 0) { Notify.warning("ยอดเงินเป็น 0 บาท ไม่สามารถทำรายการได้"); return; }
    
    let itemsList = [];
    if (currentOrderType === 'mixed') {
        let quantity = isFullLimit ? 89 : currentLimit;
        itemsList.push(`สินค้าคละแบบ (Auto) : ${quantity} ชิ้น`);
    } else {
        let inputs = document.querySelectorAll('.qty-control');
        inputs.forEach(inp => {
            let v = parseInt(inp.value) || 0;
            if (v > 0) itemsList.push(`${inp.dataset.name} : ${v} ชิ้น`);
        });
        if(itemsList.length === 0) { Notify.warning("กรุณาระบุจำนวนสินค้า"); return; }
    }

    let tempId = db.generateOrderId();
    const config = db.getConfig();
    let catLabel = config.categoryMeta[currentCategory] ? config.categoryMeta[currentCategory].label : currentCategory;
    let source = getTrackingSource();

    cart = [{
        id: tempId,
        category: catLabel,
        categoryId: currentCategory,
        type: currentOrderType,
        items: itemsList,
        price: price,
        source: source
    }];

    renderCartPreview();
    switchStep(4);
}

function renderCartPreview() {
    let o = cart[0];
    const typeMap = { mixed:"คละ", selected:"เลือก", pure:"ล้วน", cross:"ข้ามโซน" };
    const config = db.getConfig();
    
    let html = `
        <div style="font-family: monospace; line-height: 1.6;">
            <div>* ${config.shopName}</div>
            <div>* ID : ${o.id}</div>
            <div>* หมวด : ${o.category}</div>
            <div>* แบบ : ${typeMap[o.type]}</div>
            <div>---------------------</div>
            ${o.items.map(i => `<div>- ${i}</div>`).join('')}
            <div>---------------------</div>
            <div style="font-weight:bold; color:var(--primary);">ยอดรวมสุทธิ : ${o.price} บาท</div>
        </div>
    `;
    document.getElementById('cart-preview-area').innerHTML = html;
}

function confirmOrder() {
    if(cart.length === 0) return;
    let o = cart[0];
    db.addOrder(o); 

    const typeMap = { mixed:"คละ", selected:"เลือก", pure:"ล้วน", cross:"ข้ามโซน" };
    const config = db.getConfig();
    let itemStr = o.items.map(i => `- ${i}`).join('\n');
    let textToCopy = `* ${config.shopName}\n* ID : ${o.id}\n* หมวด : ${o.category}\n* แบบ : ${typeMap[o.type]}\n---------------------\n${itemStr}\n---------------------\nยอดรวมสุทธิ : ${o.price} บาท`;

    navigator.clipboard.writeText(textToCopy).then(() => {
        showCopySuccess();
    }).catch(() => {
        const ta = document.createElement('textarea'); ta.value = textToCopy;
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        showCopySuccess();
    });
}

function showCopySuccess() {
    document.getElementById('copy-overlay').classList.remove('hidden');
    setTimeout(() => { document.getElementById('copy-overlay').classList.add('hidden'); location.reload(); }, 2000);
}

// ================= ADMIN FUNCTIONS =================

function switchAdminTab(tab) {
    // NEW: Handle Manager Store tab (Super Admin)
    if (tab === 'manager-store') {
        initManagerStore();
        document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.menu-link').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tab-manager-store').classList.remove('hidden');
        document.getElementById('menu-manager-store').classList.add('active');
        if(window.innerWidth <= 1024) document.getElementById('adminSidebar').classList.remove('active');
        switchManagerStoreTab(currentMSTab);
        return;
    }

    if ((tab === 'dashboard' || tab === 'market') && !checkPermission(tab)) {
        return;
    }

    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-link').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');

    const menus = { dashboard:0, orders:1, products:2, prices:3, market:4, general:5 };
    if(document.querySelectorAll('.menu-link')[menus[tab]]) {
        document.querySelectorAll('.menu-link')[menus[tab]].classList.add('active');
    }

    if(window.innerWidth <= 1024) document.getElementById('adminSidebar').classList.remove('active');

    if(tab === 'dashboard') renderAdminDashboard();
    if(tab === 'orders') renderOrderManagement();
    if(tab === 'products') renderStockTabs();
    if(tab === 'prices') renderPriceConfig();
    if(tab === 'market') document.getElementById('market-base-url').value = window.location.origin + window.location.pathname;
    if(tab === 'general') loadGeneralSettings();
}

// --- DASHBOARD: TIMELINE CONTROLS ---
function updateTimelineView(view) {
    currentTimelineView = view;
    document.querySelectorAll('.timeline-controls .action-btn-sm').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-tl-${view}`).classList.add('active');
    renderAdminDashboard();
}

function renderAdminDashboard() {
    const dateInput = document.getElementById('dash-date-filter');
    if(!dateInput.value) dateInput.valueAsDate = new Date();
    const selectedDate = new Date(dateInput.value);

    const orders = db.getOrders().filter(o => o.status === 'confirmed');
    
    let todayTotal = 0, monthTotal = 0, yearTotal = 0;
    let catStats = {}, typeStats = {}, itemStats = {}, timelineStats = {}, sourceStats = {};

    orders.forEach(o => {
        let d = new Date(o.timestamp);
        let p = o.price || 0;
        
        if(d.toDateString() === selectedDate.toDateString()) todayTotal += p;
        if(d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()) monthTotal += p;
        if(d.getFullYear() === selectedDate.getFullYear()) yearTotal += p;

        if(d.getFullYear() === selectedDate.getFullYear()) {
             let catName = o.category;
             catStats[catName] = (catStats[catName] || 0) + p;
             
             let typeName = { mixed:"คละ", selected:"เลือก", pure:"ล้วน", cross:"ข้ามโซน" }[o.type] || o.type;
             typeStats[typeName] = (typeStats[typeName] || 0) + p;

             let sourceName = o.source || 'Direct';
             sourceStats[sourceName] = (sourceStats[sourceName] || 0) + p;
     
             o.items.forEach(iStr => {
                 if(typeof iStr === 'string') {
                    let parts = iStr.split(' : ');
                    if(parts.length === 2) {
                        let name = parts[0].replace('- ', '').replace('สินค้าคละแบบ (Auto)', 'แบบคละ').trim();
                        let qtyPart = parts[1].split(' ')[0];
                        let qty = parseInt(qtyPart) || 0;
                        itemStats[name] = (itemStats[name] || 0) + qty;
                    }
                 }
             });

             let key = "";
             if (currentTimelineView === 'day') {
                if (d.getMonth() === selectedDate.getMonth()) key = d.getDate(); 
             } else if (currentTimelineView === 'month') {
                key = d.toLocaleString('th-TH', { month: 'short' });
             }
             
             if(key) timelineStats[key] = (timelineStats[key] || 0) + p;
        }
        
        if (currentTimelineView === 'year') {
             let yKey = d.getFullYear();
             timelineStats[yKey] = (timelineStats[yKey] || 0) + p;
        }
    });
    
    document.getElementById('dash-sales-today').innerText = todayTotal.toLocaleString() + " ฿";
    document.getElementById('dash-sales-month').innerText = monthTotal.toLocaleString() + " ฿";
    document.getElementById('dash-sales-year').innerText = yearTotal.toLocaleString() + " ฿";

    generateChartWithTable('chart-category', 'doughnut', catStats, 'summary-list-category');
    generateChart('chart-type', 'pie', typeStats, null, false);
    generateChart('chart-type-bar', 'bar', typeStats, null, true); 
    let sortedTimeline = sortTimelineData(timelineStats, currentTimelineView);
    generateChart('chart-summary', 'bar', sortedTimeline, null, false, true); 
    let sortedItems = Object.entries(itemStats).sort((a,b)=>b[1]-a[1]).slice(0, 10);
    generateChart('chart-items', 'bar', Object.fromEntries(sortedItems), null, true);
    generateChartWithTable('chart-source', 'doughnut', sourceStats, 'summary-list-source');
}

function sortTimelineData(data, view) {
    let keys = Object.keys(data);
    if(view === 'day' || view === 'year') keys.sort((a,b) => parseInt(a) - parseInt(b));
    else {
        const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        keys.sort((a,b) => months.indexOf(a) - months.indexOf(b));
    }
    let res = {}; keys.forEach(k => res[k] = data[k]);
    return res;
}

function generateChartWithTable(canvasId, type, dataObj, tableId) {
    let labels = Object.keys(dataObj);
    let values = labels.map(k => dataObj[k]);
    let colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#0ea5e9', '#06b6d4', '#84cc16'];
    let total = values.reduce((a,b)=>a+b, 0);
    const tableContainer = document.getElementById(tableId);
    if (tableContainer) {
        let html = '';
        labels.forEach((l, i) => {
            let percent = total > 0 ? ((values[i]/total)*100).toFixed(1) : 0;
            html += `
                <div class="summary-item" style="border-left: 4px solid ${colors[i%colors.length]}; padding-left:8px;">
                    <span>${l}</span>
                    <strong>${values[i].toLocaleString()} (${percent}%)</strong>
                </div>`;
        });
        tableContainer.innerHTML = html;
    }
    renderChartInstance(canvasId, type, labels, values, colors, false);
}

function generateChart(canvasId, type, dataObj, tableId, isHorizontal=false, isTimeline=false) {
    let labels = Object.keys(dataObj);
    let values = labels.map(k => dataObj[k]);
    let colors = isTimeline ? '#6366f1' : ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#0ea5e9'];
    renderChartInstance(canvasId, type, labels, values, colors, true, isHorizontal);
}

function renderChartInstance(id, type, labels, data, colors, showLegend, isHorizontal=false) {
    if(chartInstances[id]) chartInstances[id].destroy();
    const canvas = document.getElementById(id);
    if(!canvas) return; 
    let ctx = canvas.getContext('2d');
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';
    const isMobile = window.innerWidth < 768;
    const fontSize = isMobile ? 10 : 12;

    chartInstances[id] = new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{ label: 'ข้อมูล', data: data, backgroundColor: colors, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'white' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            indexAxis: isHorizontal ? 'y' : 'x',
            plugins: {
                legend: { 
                    display: showLegend, 
                    position: 'bottom', 
                    labels: { boxWidth: 10, usePointStyle: true, color: textColor, font: { family: "'Prompt', sans-serif", size: fontSize } } 
                }
            },
            layout: { padding: { left: 0, right: 10, top: 0, bottom: 0 } },
            scales: (type === 'doughnut' || type === 'pie') ? {} : {
                x: { ticks: { color: textColor, font: { family: "'Prompt', sans-serif", size: fontSize } }, grid: { color: gridColor } },
                y: { ticks: { color: textColor, font: { family: "'Prompt', sans-serif", size: fontSize } }, grid: { color: gridColor } }
            }
        }
    });
}

// --- ORDER MANAGEMENT ---
function renderOrderManagement() {
    switchOrderSubTab(currentAdminOrderTab);
    updateOrderBadges();
}

function updateOrderBadges() {
    const orders = db.getOrders();
    document.getElementById('badge-new').innerText = orders.filter(o => o.status === 'new').length;
    document.getElementById('badge-confirmed').innerText = orders.filter(o => o.status === 'confirmed').length;
    document.getElementById('badge-cancelled').innerText = orders.filter(o => o.status === 'cancelled').length;
}

function switchOrderSubTab(tab) {
    currentAdminOrderTab = tab;
    document.querySelectorAll('.order-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`button[onclick="switchOrderSubTab('${tab}')"]`).classList.add('active');
    document.querySelectorAll('.order-sub-content').forEach(c => c.classList.add('hidden'));
    
    const searchTerm = document.getElementById('order-search-input').value.trim().toLowerCase();
    let allOrders = db.getOrders();
    let filteredOrders = allOrders.filter(o => o.status === tab);

    if(searchTerm) {
        filteredOrders = filteredOrders.filter(o => o.id.toLowerCase().includes(searchTerm));
    }

    let containerId = 'order-content-new';
    if(tab === 'confirmed') containerId = 'list-confirmed-container';
    if(tab === 'cancelled') containerId = 'list-cancelled-container';
    
    if(tab === 'confirmed') document.getElementById('order-content-confirmed').classList.remove('hidden');
    else if(tab === 'cancelled') document.getElementById('order-content-cancelled').classList.remove('hidden');
    else document.getElementById('order-content-new').classList.remove('hidden');

    renderOrderListHTML(filteredOrders, containerId, tab); 
}

function renderOrderListHTML(list, containerId, type) {
    const container = document.getElementById(containerId);
    if(list.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:10px;"></i><br>ไม่มีออเดอร์</div>`;
        return;
    }

    let html = '';
    list.forEach(o => {
        let typeLabel = { mixed:"คละ", selected:"เลือก", pure:"ล้วน", cross:"ข้ามโซน" }[o.type] || o.type;
        let actionButtons = '';
        let sourceBadge = '';
        if(o.source && o.source !== 'Direct') {
            let icon = 'globe'; let color = '#64748b';
            if(o.source.includes('LINE')) { icon = 'line'; color = '#06c755'; }
            if(o.source.includes('Face')) { icon = 'facebook'; color = '#1877f2'; }
            if(o.source.includes('You')) { icon = 'youtube'; color = '#ff0000'; }
            if(o.source.includes('TOK')) { icon = 'tiktok'; color = '#000000'; }
            sourceBadge = `<span style="font-size:0.8rem; background:${color}; color:white; padding:2px 8px; border-radius:4px; margin-left:5px;"><i class="fab fa-${icon}"></i> ${o.source}</span>`;
        }

        if(type === 'new') {
            actionButtons = `
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button onclick="changeOrderStatus('${o.id}', 'confirmed')" class="btn-primary" style="padding:8px; font-size:0.9rem; flex:1;">ยืนยัน</button>
                    <button onclick="changeOrderStatus('${o.id}', 'cancelled')" class="action-btn-sm danger" style="width:auto; padding:0 15px; flex:1;">ยกเลิก</button>
                </div>`;
        } else if (type === 'confirmed') {
             actionButtons = `
                <div style="margin-top:10px; display:flex; gap:10px;">
                    <button onclick="viewOrderDetail('${o.id}')" class="btn-secondary-icon" style="flex:1; font-size:0.9rem; border-radius:8px; height:36px;">ดูออเดอร์</button>
                    <button onclick="deleteOrderPermanently('${o.id}')" class="action-btn-sm danger" title="ลบออเดอร์นี้" style="width:40px;"><i class="fas fa-trash-alt"></i></button>
                </div>`;
        } else if (type === 'cancelled') {
             actionButtons = `
                <div style="margin-top:10px; text-align:right;">
                    <button onclick="deleteOrderPermanently('${o.id}')" class="btn-text-danger">ลบถาวร</button>
                </div>`;
        }

        html += `
            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-weight:800; font-size:1.1rem; color:var(--primary);">${o.id} ${sourceBadge}</div>
                        <div style="font-size:0.85rem; color:var(--text-muted);">${new Date(o.timestamp).toLocaleString()}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:700; font-size:1.1rem;">${o.price} ฿</div>
                        <div style="font-size:0.85rem; color:var(--text-main);">${o.category} | ${typeLabel}</div>
                    </div>
                </div>
                ${actionButtons}
            </div>
        `;
    });
    container.innerHTML = html;
}

function searchOrder(val) { switchOrderSubTab(currentAdminOrderTab); }

function changeOrderStatus(id, newStatus) {
    if(newStatus === 'cancelled') {
        Notify.confirm("ยกเลิกออเดอร์", "คุณต้องการยกเลิกออเดอร์นี้ใช่หรือไม่?", () => {
            db.updateOrderStatus(id, newStatus);
            updateOrderBadges();
            switchOrderSubTab(currentAdminOrderTab);
            Notify.success("ยกเลิกออเดอร์แล้ว");
        });
        return;
    }
    db.updateOrderStatus(id, newStatus);
    updateOrderBadges();
    switchOrderSubTab(currentAdminOrderTab);
    Notify.success("สถานะออเดอร์อัพเดทแล้ว");
}

function deleteOrderPermanently(id) {
    Notify.confirm("ลบออเดอร์ถาวร", "คุณต้องการลบออเดอร์นี้ถาวรใช่หรือไม่?", () => {
        db.deleteOrder(id);
        updateOrderBadges();
        switchOrderSubTab(currentAdminOrderTab);
        Notify.success("ลบออเดอร์แล้ว");
    });
}

function clearAllCancelledOrders() {
    Notify.confirm("ล้างรายการยกเลิก", "ต้องการลบรายการที่ยกเลิกทั้งหมด?", () => {
        let cancelled = db.getOrders().filter(o => o.status === 'cancelled');
        cancelled.forEach(o => db.deleteOrder(o.id));
        updateOrderBadges();
        switchOrderSubTab('cancelled');
        Notify.success("ล้างรายการเรียบร้อย");
    });
}

function clearAllConfirmedOrders() {
    Notify.confirm("ล้างรายการสำเร็จ", "⚠️ คำเตือน: ยอดขายจะหายไปด้วย ยืนยันการลบ?", () => {
        let confirmed = db.getOrders().filter(o => o.status === 'confirmed');
        confirmed.forEach(o => db.deleteOrder(o.id));
        updateOrderBadges();
        renderAdminDashboard(); 
        switchOrderSubTab('confirmed');
        Notify.success("ล้างรายการเรียบร้อย");
    });
}

function viewOrderDetail(id) {
    let orders = db.getOrders();
    let o = orders.find(x => x.id === id);
    if(!o) return;
    let itemsHtml = o.items.map(i => `<li style="margin-bottom:5px;">${i}</li>`).join('');
    let sourceInfo = o.source ? `<div style="margin-top:5px; font-size:0.9rem; color:var(--text-muted);">มาจาก: ${o.source}</div>` : '';

    let content = `
        <div style="text-align:center; margin-bottom:15px;">
            <h2 style="color:var(--primary);">${o.id}</h2>
            <div style="color:var(--text-muted); font-size:0.9rem;">${new Date(o.timestamp).toLocaleString()}</div>
            ${sourceInfo}
        </div>
        <div style="background:var(--bg-card); padding:15px; border-radius:8px; border:1px dashed var(--border-color);">
            <ul style="padding-left:20px; color:var(--text-main);">${itemsHtml}</ul>
        </div>
        <div style="margin-top:15px; display:flex; justify-content:space-between; font-weight:bold; font-size:1.2rem;">
            <span>ยอดรวมสุทธิ</span>
            <span style="color:var(--success);">${o.price} ฿</span>
        </div>
    `;
    document.getElementById('order-detail-content').innerHTML = content;
    document.getElementById('order-detail-modal').classList.remove('hidden');
}
function closeOrderDetail() { document.getElementById('order-detail-modal').classList.add('hidden'); }

// --- STOCK & CONFIG UPDATED ---
function renderStockTabs() {
    const container = document.getElementById('stock-category-tabs');
    container.innerHTML = '';
    const config = db.getConfig();
    let cats = Object.keys(config.categoryMeta);
    if(cats.length > 0 && stockEditCat === '') stockEditCat = cats[0];
    cats.forEach(key => {
        let btn = document.createElement('button');
        btn.className = `stock-tab-btn ${stockEditCat === key ? 'active' : ''}`;
        btn.innerText = config.categoryMeta[key].label;
        btn.onclick = () => { stockEditCat = key; renderStockTabs(); renderStockManage(key); };
        container.appendChild(btn);
    });
    if(cats.length > 0) renderStockManage(stockEditCat);
}

function renderStockManage(cat) {
    let area = document.getElementById('stock-manage-area');
    area.innerHTML = '';
    const config = db.getConfig();
    if(!config.items[cat]) return;
    config.items[cat].forEach((item, idx) => {
        area.innerHTML += `
            <div class="stock-item-card">
                <div class="stock-img-preview" onclick="promptImage('${cat}', ${idx})">
                    ${item.img ? `<img src="${item.img}">` : `<i class="fas fa-image" style="color:#cbd5e1; font-size:2rem;"></i>`}
                </div>
                <input type="text" class="form-control" value="${item.name}" onchange="updateItemName('${cat}', ${idx}, this.value)" style="text-align:center;">
                <div class="stock-actions"><button class="action-btn-sm danger" onclick="deleteStockItem('${cat}', ${idx})"><i class="fas fa-trash"></i></button></div>
            </div>`;
    });
    area.innerHTML += `<div class="stock-item-card" style="border:2px dashed var(--border-color); cursor:pointer; justify-content:center; min-height:220px;" onclick="openAddProductModal()"><i class="fas fa-plus-circle" style="font-size:3rem; color:#cbd5e1;"></i><div style="color:var(--text-muted); margin-top:10px;">เพิ่มสินค้า</div></div>`;
}

function openAddCategoryModal() { document.getElementById('add-category-modal').classList.remove('hidden'); }

function confirmAddCategory() {
    const config = db.getConfig();
    let name = document.getElementById('new-cat-name').value;
    let id = "cat_" + Date.now().toString(36);
    
    if(!name) { Notify.warning("กรุณากรอกชื่อหมวดหมู่"); return; }
    
    config.items[id] = [];
    config.prices[id] = { mixed: 100, selected: 150, pure: 200, tray: 15 };
    const CATEGORY_PRESETS = [ { icon: 'fas fa-warehouse', color: 'bg-red' }, { icon: 'fas fa-seedling', color: 'bg-orange' }, { icon: 'fas fa-map-marked-alt', color: 'bg-green' }, { icon: 'fas fa-train', color: 'bg-blue' }];
    let style = CATEGORY_PRESETS[Math.floor(Math.random() * CATEGORY_PRESETS.length)];
    
    let options = {
        mixed: document.getElementById('check-cat-mixed').checked,
        selected: document.getElementById('check-cat-selected').checked,
        pure: document.getElementById('check-cat-pure').checked,
        cross: document.getElementById('check-cat-cross').checked,
        tray: document.getElementById('check-cat-tray').checked
    };

    config.categoryMeta[id] = { label: name, icon: style.icon, color: style.color, options: options };
    
    db.saveConfig(config);
    document.getElementById('add-category-modal').classList.add('hidden');
    renderStockTabs();
    Notify.success("เพิ่มหมวดหมู่เรียบร้อย");
}

function deleteCurrentCategory() {
    const config = db.getConfig();
    if(Object.keys(config.categoryMeta).length <= 1) { Notify.warning("ต้องมีอย่างน้อย 1 หมวดหมู่"); return; }
    
    Notify.confirm("ลบหมวดหมู่", `ยืนยันลบหมวดหมู่ "${config.categoryMeta[stockEditCat].label}" ?`, () => {
        delete config.items[stockEditCat]; delete config.prices[stockEditCat]; delete config.categoryMeta[stockEditCat];
        stockEditCat = ''; db.saveConfig(config); renderStockTabs();
        Notify.success("ลบหมวดหมู่แล้ว");
    });
}

function openAddProductModal() {
    document.getElementById('new-prod-name').value = '';
    document.querySelectorAll('#add-product-modal input[type="checkbox"]').forEach(c => c.checked = true);
    document.getElementById('add-product-modal').classList.remove('hidden');
}
function closeAddProductModal() { document.getElementById('add-product-modal').classList.add('hidden'); }

function confirmAddProduct() {
    let name = document.getElementById('new-prod-name').value;
    if(!name) { Notify.warning("กรุณาระบุชื่อสินค้า"); return; }
    
    let options = {
        mixed: document.getElementById('check-prod-mixed').checked,
        selected: document.getElementById('check-prod-selected').checked,
        pure: document.getElementById('check-prod-pure').checked,
        cross: document.getElementById('check-prod-cross').checked,
        tray: document.getElementById('check-prod-tray').checked
    };

    const config = db.getConfig();
    if(stockEditCat) {
        config.items[stockEditCat].push({ name: name, img: null, options: options });
        db.saveConfig(config);
        renderStockManage(stockEditCat);
        closeAddProductModal();
        Notify.success("เพิ่มสินค้าเรียบร้อย");
    }
}

function promptImage(cat, idx) {
    const config = db.getConfig();
    let current = config.items[cat][idx].img || "";
    Notify.prompt("ใส่ URL รูปภาพสินค้า", current, (url) => {
        if(url !== null) { config.items[cat][idx].img = url; renderStockManage(cat); db.saveConfig(config); Notify.success("อัพเดทรูปภาพแล้ว"); }
    });
}
function updateItemName(cat, idx, val) { db.getConfig().items[cat][idx].name = val; }
function deleteStockItem(cat, idx) { 
    Notify.confirm("ลบสินค้า", "ยืนยันการลบสินค้านี้?", () => {
        db.getConfig().items[cat].splice(idx, 1); renderStockManage(cat); db.saveConfig(db.getConfig()); 
        Notify.success("ลบสินค้าแล้ว");
    });
}
function saveStockChanges() { db.saveConfig(db.getConfig()); Notify.success("บันทึกข้อมูลสินค้าทั้งหมดแล้ว"); }

// --- PRICE & GENERAL ---
function renderPriceConfig() {
    const grid = document.getElementById('dynamic-price-config'); grid.innerHTML = '';
    const config = db.getConfig();
    Object.keys(config.categoryMeta).forEach(catKey => {
        let meta = config.categoryMeta[catKey], p = config.prices[catKey];
        grid.innerHTML += `
            <div class="price-section">
                <h5><i class="${meta.icon}"></i> ${meta.label}</h5>
                <div class="form-grid cols-2">
                    <div><label class="form-label">เหมา คละ</label><input type="number" id="p-${catKey}-mixed" class="form-control" value="${p.mixed}"></div>
                    <div><label class="form-label">เหมา เลือก</label><input type="number" id="p-${catKey}-selected" class="form-control" value="${p.selected}"></div>
                    <div><label class="form-label">เหมา ล้วน</label><input type="number" id="p-${catKey}-pure" class="form-control" value="${p.pure}"></div>
                    <div><label class="form-label text-primary">ราคาต่อถาด</label><input type="number" id="p-${catKey}-tray" class="form-control" value="${p.tray}"></div>
                    ${p.mapPrice !== undefined ? `<div><label class="form-label">ชิ้นส่วนแผนที่</label><input type="number" id="p-${catKey}-map" class="form-control" value="${p.mapPrice}"></div>` : ''}
                </div>
            </div>`;
    });
}
function savePriceSettings() {
    const config = db.getConfig();
    Object.keys(config.categoryMeta).forEach(catKey => {
        let p = config.prices[catKey];
        p.mixed = parseInt(document.getElementById(`p-${catKey}-mixed`).value) || 0;
        p.selected = parseInt(document.getElementById(`p-${catKey}-selected`).value) || 0;
        p.pure = parseInt(document.getElementById(`p-${catKey}-pure`).value) || 0;
        p.tray = parseInt(document.getElementById(`p-${catKey}-tray`).value) || 0;
        if(p.mapPrice !== undefined) p.mapPrice = parseInt(document.getElementById(`p-${catKey}-map`).value) || 0;
    });
    db.saveConfig(config); Notify.success("บันทึกราคาเรียบร้อย");
}

function loadGeneralSettings() {
    const config = db.getConfig();
    // General
    document.getElementById('edit-shop-name').value = config.shopName;
    document.getElementById('edit-shop-slogan').value = config.slogan;
    document.getElementById('edit-announcement').value = config.announcement;
    
    // Help Videos
    document.getElementById('edit-video-limit').value = config.helpContent.limit.video || "";
    document.getElementById('edit-desc-limit').value = config.helpContent.limit.desc;
    document.getElementById('edit-video-buy').value = config.helpContent.buy.video || "";
    document.getElementById('edit-desc-buy').value = config.helpContent.buy.desc;
    
    // Fonts & Visuals
    document.getElementById('edit-font-heading').value = config.visuals.fontSizeHeading || 20;
    document.getElementById('edit-font-body').value = config.visuals.fontSizeBody || 16;
    document.getElementById('edit-bg-overlay').value = config.visuals.backgroundOverlay !== undefined ? config.visuals.backgroundOverlay : 50;
    document.getElementById('edit-color-intensity').value = config.visuals.opacityVal;
    
    // Package Config
    if(config.packageConfig) {
        document.getElementById('cfg-pkg-standard-price').value = config.packageConfig.standard.price;
        document.getElementById('cfg-pkg-standard-desc').value = config.packageConfig.standard.desc;
        document.getElementById('cfg-pkg-premium-price').value = config.packageConfig.premium.price;
        document.getElementById('cfg-pkg-premium-desc').value = config.packageConfig.premium.desc;
    }

    // Auth Settings
    if(config.adminAuth) {
        document.getElementById('edit-admin-username').value = config.adminAuth.username;
        document.getElementById('edit-admin-password').value = config.adminAuth.password;
    }

    setupFileUpload('file-video-limit', 'edit-video-limit');
    setupFileUpload('file-video-buy', 'edit-video-buy');
    setupBgImageUpload();
    setupLogoUpload();
}
function setupFileUpload(inputId, urlInputId) {
    const fileInput = document.getElementById(inputId);
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        if(file.size > 5 * 1024 * 1024) { Notify.warning("ไฟล์ใหญ่เกินไป! (จำกัด 5MB)"); fileInput.value = ""; return; }
        const reader = new FileReader();
        reader.onload = function(event) { document.getElementById(urlInputId).value = event.target.result; Notify.success("อัพโหลดไฟล์สำเร็จ"); };
        reader.readAsDataURL(file);
    };
}
function setupBgImageUpload() {
    const fileInput = document.getElementById('file-bg-image');
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        if(file.size > 2 * 1024 * 1024) { Notify.warning("รูปภาพใหญ่เกินไป! (จำกัด 2MB)"); return; }
        const reader = new FileReader();
        reader.onload = function(event) { 
            document.getElementById('edit-bg-url').value = event.target.result; 
            document.documentElement.style.setProperty('--bg-image', `url('${event.target.result}')`);
        };
        reader.readAsDataURL(file);
    };
}
function setupLogoUpload() {
    const fileInput = document.getElementById('file-logo-upload');
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        if(file.size > 2 * 1024 * 1024) { Notify.warning("รูปภาพใหญ่เกินไป! (จำกัด 2MB)"); return; }
        const reader = new FileReader();
        reader.onload = function(event) { 
            document.getElementById('edit-logo-url').value = event.target.result;
            const prevBox = document.getElementById('preview-logo-settings');
            prevBox.innerHTML = `<img src="${event.target.result}" style="width:100%; height:100%; object-fit:contain;">`;
        };
        reader.readAsDataURL(file);
    };
}
function clearLogo() {
    document.getElementById('edit-logo-url').value = "CLEAR";
    document.getElementById('file-logo-upload').value = "";
    document.getElementById('preview-logo-settings').innerHTML = `<i class="fas fa-image" style="color:#ccc;"></i>`;
}
function clearBackgroundImage() {
    document.getElementById('edit-bg-url').value = "";
    document.getElementById('file-bg-image').value = "";
    document.documentElement.style.setProperty('--bg-image', 'none');
}
function previewVisuals() {
    let val = parseInt(document.getElementById('edit-color-intensity').value);
    document.documentElement.style.setProperty('--opacity-val', 1 - (Math.abs(50 - val) / 100));
}
function previewFonts() {
    document.documentElement.style.setProperty('--font-heading', `${document.getElementById('edit-font-heading').value}px`);
    document.documentElement.style.setProperty('--font-body', `${document.getElementById('edit-font-body').value}px`);
}
function previewBackgroundOverlay() {
    document.documentElement.style.setProperty('--bg-overlay-opacity', document.getElementById('edit-bg-overlay').value / 100);
}

// === SPLIT SAVE FUNCTIONS ===
function savePackageSettings() {
    const config = db.getConfig();
    config.packageConfig.standard.price = document.getElementById('cfg-pkg-standard-price').value;
    config.packageConfig.standard.desc = document.getElementById('cfg-pkg-standard-desc').value;
    config.packageConfig.premium.price = document.getElementById('cfg-pkg-premium-price').value;
    config.packageConfig.premium.desc = document.getElementById('cfg-pkg-premium-desc').value;
    
    db.saveConfig(config);
    Notify.success("บันทึกการตั้งค่าแพ็คเกจแล้ว");
}

function saveGeneralSettings() {
    const config = db.getConfig();
    config.shopName = document.getElementById('edit-shop-name').value;
    config.slogan = document.getElementById('edit-shop-slogan').value;
    config.announcement = document.getElementById('edit-announcement').value;
    
    let newLogo = document.getElementById('edit-logo-url').value;
    if(newLogo === "CLEAR") config.visuals.logo = "";
    else if(newLogo !== "") config.visuals.logo = newLogo;

    db.saveConfig(config); 
    Notify.success("บันทึกข้อมูลร้านค้าแล้ว");
}

function saveAdminPassword() {
    const config = db.getConfig();
    const user = document.getElementById('edit-admin-username').value;
    const pass = document.getElementById('edit-admin-password').value;
    
    if(!user || !pass) { Notify.warning("กรุณากรอก Username และ Password"); return; }
    
    config.adminAuth = { username: user, password: pass };
    db.saveConfig(config);
    Notify.success("บันทึกรหัสผ่านเรียบร้อย");
}

function saveFontSettings() {
    const config = db.getConfig();
    config.visuals.fontSizeHeading = parseInt(document.getElementById('edit-font-heading').value);
    config.visuals.fontSizeBody = parseInt(document.getElementById('edit-font-body').value);
    db.saveConfig(config);
    Notify.success("บันทึกขนาดฟอนต์แล้ว");
}

function saveBackgroundSettings() {
    if(!checkPermission('theme')) return;

    const config = db.getConfig();
    config.visuals.opacityVal = parseInt(document.getElementById('edit-color-intensity').value);
    config.visuals.backgroundOverlay = parseInt(document.getElementById('edit-bg-overlay').value);
    
    let newBg = document.getElementById('edit-bg-url').value;
    if(newBg !== "") config.visuals.backgroundImage = newBg;
    else if (document.documentElement.style.getPropertyValue('--bg-image') === 'none') config.visuals.backgroundImage = "";

    db.saveConfig(config);
    Notify.success("บันทึกพื้นหลังเรียบร้อย");
}

function saveHelpSettings() {
    const config = db.getConfig();
    config.helpContent = {
        limit: { video: document.getElementById('edit-video-limit').value, desc: document.getElementById('edit-desc-limit').value },
        buy: { video: document.getElementById('edit-video-buy').value, desc: document.getElementById('edit-desc-buy').value }
    };
    db.saveConfig(config);
    Notify.success("บันทึกวิดีโอคู่มือแล้ว");
}

// === THEME MANAGER (UPDATED) ===
function openThemeSelector() {
    if(!checkPermission('theme')) return;

    const gridBasic = document.getElementById('theme-grid-basic'); 
    gridBasic.innerHTML = '';
    const themesBasic = [
        '#64748b', '#ef4444', '#f97316', '#f59e0b', '#eab308', 
        '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', 
        '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', 
        '#d946ef', '#ec4899', '#f43f5e', '#78350f', '#0f172a'
    ];
    
    // Set pending to current
    pendingThemeColor = db.getConfig().visuals.themeColor;

    themesBasic.forEach(c => {
        let el = document.createElement('div'); 
        el.className = 'theme-option'; 
        el.style.backgroundColor = c;
        if(c === pendingThemeColor) el.style.border = "3px solid white";
        
        el.onclick = () => { 
            pendingThemeColor = c;
            // Update UI selection only
            document.querySelectorAll('.theme-option').forEach(opt => opt.style.border = '2px solid transparent');
            el.style.border = '3px solid white';
            el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
        };
        gridBasic.appendChild(el);
    });
    document.getElementById('theme-modal').classList.remove('hidden');
}

function saveThemeSelection() {
    if(pendingThemeColor) {
        db.getConfig().visuals.themeColor = pendingThemeColor;
        db.saveConfig(db.getConfig());
        closeThemeSelector();
        Notify.success("บันทึกธีมเรียบร้อย");
    }
}

function closeThemeSelector() { document.getElementById('theme-modal').classList.add('hidden'); }

function openHelpModal(type) {
    const config = db.getConfig();
    let content = config.helpContent ? config.helpContent[type] : {video:"", desc:""};
    document.getElementById('help-title').innerText = (type === 'limit') ? 'วิธีเช็คลิมิต' : 'วิธีกดสินค้า';
    document.getElementById('help-desc-text').innerText = content.desc || "ไม่มีคำอธิบาย";
    const frame = document.getElementById('help-video-frame');
    const player = document.getElementById('help-video-player');
    const none = document.getElementById('help-no-video');
    frame.style.display = 'none'; player.style.display = 'none'; none.style.display = 'none';
    if (content.video) {
        if(content.video.startsWith('data:') || !content.video.includes('youtu')) { player.src = content.video; player.style.display = 'block'; }
        else { 
            let vID = content.video.includes('v=') ? content.video.split('v=')[1].split('&')[0] : content.video.split('youtu.be/')[1];
            frame.src = `https://www.youtube.com/embed/${vID}`; frame.style.display = 'block';
        }
    } else { none.style.display = 'flex'; none.style.alignItems = 'center'; none.style.justifyContent = 'center'; none.style.height = '100%'; }
    document.getElementById('help-modal').classList.remove('hidden');
}
function closeHelpModal() { document.getElementById('help-modal').classList.add('hidden'); document.getElementById('help-video-frame').src = ""; document.getElementById('help-video-player').pause(); }

// ================= MANAGER STORE SYSTEM (SUPER ADMIN) =================

// Check if current user is Super Admin
function isSuperAdmin() {
    return managerStoreData && managerStoreData.isSuperAdmin;
}

// Switch Manager Store Tab
function switchManagerStoreTab(tabName) {
    currentMSTab = tabName;

    // Update nav buttons
    document.querySelectorAll('.ms-nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.ms-nav-btn[onclick="switchManagerStoreTab('${tabName}')"]`).classList.add('active');

    // Hide all sub contents
    document.querySelectorAll('.ms-sub-content').forEach(el => el.classList.add('hidden'));

    // Show selected tab
    const tabMap = {
        'pending-stores': 'ms-pending-stores',
        'serial-keys': 'ms-serial-keys',
        'open-store': 'ms-open-store',
        'monitor-stores': 'ms-monitor-stores',
        'payment-stores': 'ms-payment-stores',
        'super-dashboard': 'ms-super-dashboard'
    };

    document.getElementById(tabMap[tabName]).classList.remove('hidden');

    // Render content
    switch(tabName) {
        case 'pending-stores': renderPendingStores(); break;
        case 'serial-keys': renderSerialKeys(); break;
        case 'open-store': renderOpenStore(); break;
        case 'monitor-stores': renderMonitorStores(); break;
        case 'payment-stores': renderPaymentStores(); break;
        case 'super-dashboard': renderSuperDashboard(); break;
    }
}

// ================= PENDING STORES =================

function renderPendingStores() {
    initManagerStore();
    const container = document.getElementById('pending-stores-list');
    const historyContainer = document.getElementById('registration-history-list');

    // Render pending stores
    if (!managerStoreData.pendingStores || managerStoreData.pendingStores.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>ไม่มีร้านค้ารอการอนุมัติ</p></div>`;
    } else {
        let html = '';
        managerStoreData.pendingStores.forEach(store => {
            html += `
                <div class="store-card pending">
                    <div class="store-card-header">
                        <div class="store-name"><i class="fas fa-store"></i> ${store.shopName}</div>
                        <span class="store-badge pending">รอการอนุมัติ</span>
                    </div>
                    <div class="store-card-body">
                        <div class="store-info-row"><span>ลิงก์ร้าน:</span> <a href="${store.shopLink}" target="_blank">${store.shopLink}</a></div>
                        <div class="store-info-row"><span>แพ็คเกจที่เลือก:</span> <strong class="${store.package}">${store.package === 'premium' ? 'Premium' : 'Standard'}</strong></div>
                        <div class="store-info-row"><span>วันที่สมัคร:</span> ${new Date(store.registeredAt).toLocaleString('th-TH')}</div>
                    </div>
                    <div class="store-card-actions">
                        <button onclick="viewStoreDetail('${store.id}', 'pending')" class="btn-secondary-icon" style="flex:1; border-radius:8px; height:40px;">
                            <i class="fas fa-eye"></i> ดูรายละเอียด
                        </button>
                        <button onclick="approveStore('${store.id}')" class="btn-success" style="flex:1; padding:10px;">
                            <i class="fas fa-check"></i> อนุมัติ
                        </button>
                        <button onclick="rejectStore('${store.id}')" class="action-btn-sm danger" style="width:40px; height:40px;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    // Render history
    if (!managerStoreData.registrationHistory || managerStoreData.registrationHistory.length === 0) {
        historyContainer.innerHTML = `<div class="empty-state small"><i class="fas fa-history"></i><p>ยังไม่มีประวัติ</p></div>`;
    } else {
        let historyHtml = '';
        managerStoreData.registrationHistory.slice(0, 10).forEach(record => {
            const statusClass = record.status === 'approved' ? 'success' : 'danger';
            const statusText = record.status === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติ';
            historyHtml += `
                <div class="history-item">
                    <div class="history-info">
                        <strong>${record.shopName}</strong>
                        <span class="history-date">${new Date(record.processedAt).toLocaleString('th-TH')}</span>
                    </div>
                    <span class="history-badge ${statusClass}">${statusText}</span>
                </div>
            `;
        });
        historyContainer.innerHTML = historyHtml;
    }

    updateManagerStoreBadges();
}

function approveStore(storeId) {
    initManagerStore();
    const storeIndex = managerStoreData.pendingStores.findIndex(s => s.id === storeId);
    if (storeIndex === -1) return;

    const store = managerStoreData.pendingStores[storeIndex];

    Notify.confirm('อนุมัติร้านค้า', `ยืนยันอนุมัติร้าน "${store.shopName}"?`, () => {
        // Move to approved stores (waiting for serial key)
        store.status = 'approved';
        store.approvedAt = new Date().toISOString();
        managerStoreData.approvedStores.push(store);

        // Add to history
        managerStoreData.registrationHistory.unshift({
            ...store,
            status: 'approved',
            processedAt: new Date().toISOString()
        });

        // Remove from pending
        managerStoreData.pendingStores.splice(storeIndex, 1);

        saveManagerStoreData();
        renderPendingStores();
        Notify.success(`อนุมัติร้าน "${store.shopName}" เรียบร้อย`);
    });
}

function rejectStore(storeId) {
    initManagerStore();
    const storeIndex = managerStoreData.pendingStores.findIndex(s => s.id === storeId);
    if (storeIndex === -1) return;

    const store = managerStoreData.pendingStores[storeIndex];

    Notify.confirm('ปฏิเสธร้านค้า', `ยืนยันปฏิเสธร้าน "${store.shopName}"?`, () => {
        // Add to history
        managerStoreData.registrationHistory.unshift({
            ...store,
            status: 'rejected',
            processedAt: new Date().toISOString()
        });

        // Remove from pending
        managerStoreData.pendingStores.splice(storeIndex, 1);

        saveManagerStoreData();
        renderPendingStores();
        Notify.info(`ปฏิเสธร้าน "${store.shopName}" แล้ว`);
    });
}

// ================= SERIAL KEY MANAGEMENT =================

function updateSerialLengthDisplay() {
    const val = document.getElementById('serial-key-length').value;
    document.getElementById('serial-length-display').innerText = val;
}

function generateSerialKey() {
    initManagerStore();
    const length = parseInt(document.getElementById('serial-key-length').value);
    const duration = document.getElementById('serial-key-duration').value;

    // Generate random serial key
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let serial = '';
    for (let i = 0; i < length; i++) {
        if (i > 0 && i % 4 === 0) serial += '-';
        serial += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Calculate expiry based on duration
    const now = new Date();
    let expiryDate = new Date(now);
    let durationText = '';

    switch(duration) {
        case '15d':
            expiryDate.setDate(expiryDate.getDate() + 15);
            durationText = '15 วัน (ทดลองใช้)';
            break;
        case '1m':
            expiryDate.setMonth(expiryDate.getMonth() + 1);
            durationText = '1 เดือน';
            break;
        case '3m':
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            durationText = '3 เดือน';
            break;
        case '5m':
            expiryDate.setMonth(expiryDate.getMonth() + 5);
            durationText = '5 เดือน';
            break;
        case '1y':
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            durationText = '1 ปี';
            break;
    }

    const serialKey = {
        id: 'SK_' + Date.now(),
        key: serial,
        duration: duration,
        durationText: durationText,
        createdAt: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        status: 'available', // available, assigned, expired
        assignedTo: null
    };

    managerStoreData.serialKeys.push(serialKey);
    saveManagerStoreData();
    renderSerialKeys();
    Notify.success(`สร้าง Serial Key สำเร็จ: ${serial}`);
}

function renderSerialKeys() {
    initManagerStore();
    const container = document.getElementById('serial-keys-list');
    const waitingContainer = document.getElementById('stores-waiting-serial');

    // Filter available serial keys
    const availableKeys = managerStoreData.serialKeys.filter(sk => sk.status === 'available');
    const assignedKeys = managerStoreData.serialKeys.filter(sk => sk.status === 'assigned');

    if (availableKeys.length === 0 && assignedKeys.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-key"></i><p>ยังไม่มี Serial Key</p></div>`;
    } else {
        let html = '';

        // Available keys
        availableKeys.forEach(sk => {
            html += `
                <div class="serial-key-card available">
                    <div class="sk-header">
                        <span class="sk-badge available">ว่าง</span>
                        <span class="sk-duration">${sk.durationText}</span>
                    </div>
                    <div class="sk-key">${sk.key}</div>
                    <div class="sk-countdown" data-expiry="${sk.expiryDate}">
                        ${formatCountdown(new Date(sk.expiryDate) - new Date())}
                    </div>
                    <div class="sk-actions">
                        <button onclick="copySerialKey('${sk.key}')" class="action-btn-sm" style="background:var(--primary); color:white;">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="deleteSerialKey('${sk.id}')" class="action-btn-sm danger">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        // Assigned keys
        assignedKeys.forEach(sk => {
            html += `
                <div class="serial-key-card assigned">
                    <div class="sk-header">
                        <span class="sk-badge assigned">ใช้งานแล้ว</span>
                        <span class="sk-duration">${sk.durationText}</span>
                    </div>
                    <div class="sk-key">${sk.key}</div>
                    <div class="sk-assigned-to">ร้าน: ${sk.assignedTo || '-'}</div>
                    <div class="sk-countdown" data-expiry="${sk.expiryDate}">
                        ${formatCountdown(new Date(sk.expiryDate) - new Date())}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    // Render stores waiting for serial key
    if (!managerStoreData.approvedStores || managerStoreData.approvedStores.length === 0) {
        waitingContainer.innerHTML = `<div class="empty-state small"><i class="fas fa-hourglass-half"></i><p>ไม่มีร้านค้ารอ Serial Key</p></div>`;
    } else {
        let waitingHtml = '';
        managerStoreData.approvedStores.forEach(store => {
            waitingHtml += `
                <div class="store-card waiting-serial">
                    <div class="store-card-header">
                        <div class="store-name"><i class="fas fa-store"></i> ${store.shopName}</div>
                        <span class="store-badge warning">รอ Serial Key</span>
                    </div>
                    <div class="store-card-body">
                        <div class="store-info-row"><span>แพ็คเกจ:</span> <strong class="${store.package}">${store.package === 'premium' ? 'Premium' : 'Standard'}</strong></div>
                    </div>
                    <div class="store-card-actions">
                        <button onclick="openAssignSerialModal('${store.id}')" class="btn-primary" style="flex:1; padding:10px;">
                            <i class="fas fa-key"></i> ระบุ Serial Key
                        </button>
                    </div>
                </div>
            `;
        });
        waitingContainer.innerHTML = waitingHtml;
    }

    // Start countdown timers
    startSerialKeyCountdowns();
    updateManagerStoreBadges();
}

function copySerialKey(key) {
    navigator.clipboard.writeText(key).then(() => {
        Notify.success('คัดลอก Serial Key แล้ว');
    });
}

function deleteSerialKey(skId) {
    initManagerStore();
    const sk = managerStoreData.serialKeys.find(s => s.id === skId);
    if (!sk) return;

    if (sk.status === 'assigned') {
        Notify.warning('ไม่สามารถลบ Serial Key ที่ใช้งานอยู่ได้');
        return;
    }

    Notify.confirm('ลบ Serial Key', 'ยืนยันการลบ Serial Key นี้?', () => {
        managerStoreData.serialKeys = managerStoreData.serialKeys.filter(s => s.id !== skId);
        saveManagerStoreData();
        renderSerialKeys();
        Notify.success('ลบ Serial Key แล้ว');
    });
}

function openAssignSerialModal(storeId) {
    initManagerStore();
    const store = managerStoreData.approvedStores.find(s => s.id === storeId);
    if (!store) return;

    document.getElementById('assign-serial-store-id').value = storeId;
    document.getElementById('assign-serial-store-preview').innerHTML = `
        <div class="store-preview-card">
            <div class="store-preview-name"><i class="fas fa-store"></i> ${store.shopName}</div>
            <div class="store-preview-pkg ${store.package}">${store.package === 'premium' ? 'Premium' : 'Standard'}</div>
        </div>
    `;

    // Populate available serial keys
    const select = document.getElementById('assign-serial-select');
    select.innerHTML = '<option value="">-- เลือก Serial Key --</option>';

    const availableKeys = managerStoreData.serialKeys.filter(sk => sk.status === 'available');
    availableKeys.forEach(sk => {
        select.innerHTML += `<option value="${sk.id}">${sk.key} (${sk.durationText})</option>`;
    });

    select.onchange = function() {
        const previewBox = document.getElementById('selected-serial-preview');
        if (this.value) {
            const sk = managerStoreData.serialKeys.find(s => s.id === this.value);
            previewBox.innerHTML = `
                <div class="serial-preview-info">
                    <div class="sp-key">${sk.key}</div>
                    <div class="sp-meta">
                        <span><i class="fas fa-clock"></i> ${sk.durationText}</span>
                        <span><i class="fas fa-calendar"></i> หมดอายุ: ${new Date(sk.expiryDate).toLocaleDateString('th-TH')}</span>
                    </div>
                </div>
            `;
            previewBox.classList.remove('hidden');
        } else {
            previewBox.classList.add('hidden');
        }
    };

    document.getElementById('assign-serial-modal').classList.remove('hidden');
}

function closeAssignSerialModal() {
    document.getElementById('assign-serial-modal').classList.add('hidden');
}

function confirmAssignSerial() {
    const storeId = document.getElementById('assign-serial-store-id').value;
    const serialId = document.getElementById('assign-serial-select').value;

    if (!serialId) {
        Notify.warning('กรุณาเลือก Serial Key');
        return;
    }

    initManagerStore();

    const storeIndex = managerStoreData.approvedStores.findIndex(s => s.id === storeId);
    const serialIndex = managerStoreData.serialKeys.findIndex(s => s.id === serialId);

    if (storeIndex === -1 || serialIndex === -1) return;

    const store = managerStoreData.approvedStores[storeIndex];
    const serial = managerStoreData.serialKeys[serialIndex];

    // Assign serial key to store
    store.serialKey = serial.key;
    store.serialKeyId = serial.id;
    store.serialExpiry = serial.expiryDate;
    store.status = 'ready_to_open';

    // Update serial key status
    serial.status = 'assigned';
    serial.assignedTo = store.shopName;
    serial.assignedAt = new Date().toISOString();

    // Move store to ready-to-open list
    if (!managerStoreData.readyToOpenStores) managerStoreData.readyToOpenStores = [];
    managerStoreData.readyToOpenStores.push(store);

    // Remove from approved
    managerStoreData.approvedStores.splice(storeIndex, 1);

    saveManagerStoreData();
    closeAssignSerialModal();
    renderSerialKeys();
    Notify.success(`ผูก Serial Key กับร้าน "${store.shopName}" เรียบร้อย`);
}

// ================= OPEN STORE =================

function renderOpenStore() {
    initManagerStore();
    const container = document.getElementById('stores-ready-to-open');

    if (!managerStoreData.readyToOpenStores || managerStoreData.readyToOpenStores.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-store"></i><p>ไม่มีร้านค้ารอเปิดใช้งาน</p></div>`;
    } else {
        let html = '';
        managerStoreData.readyToOpenStores.forEach(store => {
            const timeLeft = new Date(store.serialExpiry) - new Date();
            html += `
                <div class="store-card ready-to-open">
                    <div class="store-card-header">
                        <div class="store-name"><i class="fas fa-store"></i> ${store.shopName}</div>
                        <span class="store-badge success">พร้อมเปิด</span>
                    </div>
                    <div class="store-card-body">
                        <div class="store-info-row"><span>Serial Key:</span> <code>${store.serialKey}</code></div>
                        <div class="store-info-row"><span>แพ็คเกจ:</span> <strong class="${store.package}">${store.package === 'premium' ? 'Premium' : 'Standard'}</strong></div>
                        <div class="store-info-row"><span>เวลาคงเหลือ:</span> <span class="countdown-text">${formatCountdown(timeLeft)}</span></div>
                    </div>
                    <div class="store-card-actions">
                        <button onclick="openOpenStoreModal('${store.id}')" class="btn-success" style="flex:1; padding:12px;">
                            <i class="fas fa-rocket"></i> เปิดร้านค้า
                        </button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    updateManagerStoreBadges();
}

function openOpenStoreModal(storeId) {
    initManagerStore();
    const store = managerStoreData.readyToOpenStores.find(s => s.id === storeId);
    if (!store) return;

    document.getElementById('open-store-id').value = storeId;
    document.getElementById('open-store-preview').innerHTML = `
        <div class="store-preview-card large">
            <div class="store-preview-name"><i class="fas fa-store"></i> ${store.shopName}</div>
            <div class="store-preview-link"><i class="fas fa-link"></i> ${store.shopLink}</div>
        </div>
    `;

    document.getElementById('open-store-serial-display').innerHTML = `
        <div class="serial-display-box">
            <div class="sd-key"><i class="fas fa-key"></i> ${store.serialKey}</div>
            <div class="sd-countdown" data-expiry="${store.serialExpiry}">
                ${formatCountdown(new Date(store.serialExpiry) - new Date())}
            </div>
        </div>
    `;

    // Set package radio
    document.querySelector(`input[name="open_store_pkg"][value="${store.package}"]`).checked = true;

    // Clear inputs
    document.getElementById('open-store-username').value = '';
    document.getElementById('open-store-password').value = '';

    document.getElementById('open-store-modal').classList.remove('hidden');
}

function closeOpenStoreModal() {
    document.getElementById('open-store-modal').classList.add('hidden');
}

function confirmOpenStore() {
    const storeId = document.getElementById('open-store-id').value;
    const username = document.getElementById('open-store-username').value.trim();
    const password = document.getElementById('open-store-password').value.trim();
    const packageType = document.querySelector('input[name="open_store_pkg"]:checked').value;

    if (!username || !password) {
        Notify.warning('กรุณาระบุ Username และ Password');
        return;
    }

    initManagerStore();

    const storeIndex = managerStoreData.readyToOpenStores.findIndex(s => s.id === storeId);
    if (storeIndex === -1) return;

    const store = managerStoreData.readyToOpenStores[storeIndex];

    // Create active store
    const activeStore = {
        ...store,
        username: username,
        password: password,
        package: packageType,
        status: 'active',
        isOnline: false,
        lastActivity: new Date().toISOString(),
        openedAt: new Date().toISOString(),
        totalRevenue: 0,
        paymentAmount: 0,
        paymentHistory: []
    };

    // Add to active stores
    managerStoreData.activeStores.push(activeStore);

    // Remove from ready-to-open
    managerStoreData.readyToOpenStores.splice(storeIndex, 1);

    saveManagerStoreData();
    closeOpenStoreModal();
    renderOpenStore();
    Notify.success(`เปิดร้าน "${store.shopName}" เรียบร้อยแล้ว!`);

    // Switch to monitor tab
    setTimeout(() => switchManagerStoreTab('monitor-stores'), 500);
}

// ================= MONITOR STORES =================

function renderMonitorStores() {
    initManagerStore();
    const container = document.getElementById('active-stores-list');

    if (!managerStoreData.activeStores || managerStoreData.activeStores.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-store"></i><p>ยังไม่มีร้านค้าที่เปิดใช้งาน</p></div>`;
        document.getElementById('count-online').innerText = '0';
        document.getElementById('count-offline').innerText = '0';
    } else {
        let html = '';
        let onlineCount = 0;
        let offlineCount = 0;

        managerStoreData.activeStores.forEach(store => {
            const isExpired = new Date(store.serialExpiry) < new Date();
            const isLocked = store.status === 'locked' || isExpired;
            const isOnline = store.isOnline && !isLocked;

            if (isOnline) onlineCount++;
            else offlineCount++;

            const statusClass = isLocked ? 'locked' : (isOnline ? 'online' : 'offline');
            const statusText = isLocked ? 'ถูกระงับ' : (isOnline ? 'ออนไลน์' : 'ออฟไลน์');
            const timeLeft = new Date(store.serialExpiry) - new Date();

            html += `
                <div class="monitor-store-card ${statusClass}">
                    <div class="monitor-header">
                        <div class="monitor-status">
                            <span class="status-dot ${statusClass}"></span>
                            <span class="status-text">${statusText}</span>
                        </div>
                        <div class="monitor-package ${store.package}">${store.package === 'premium' ? 'Premium' : 'Standard'}</div>
                    </div>
                    <div class="monitor-name">${store.shopName}</div>
                    <div class="monitor-credentials">
                        <span><i class="fas fa-user"></i> ${store.username}</span>
                        <span><i class="fas fa-key"></i> ${store.password}</span>
                    </div>
                    <div class="monitor-serial">
                        <code>${store.serialKey}</code>
                    </div>
                    <div class="monitor-countdown ${isLocked ? 'expired' : ''}" data-expiry="${store.serialExpiry}">
                        ${isLocked ? 'หมดอายุ' : formatCountdown(timeLeft)}
                    </div>
                    <div class="monitor-actions">
                        <button onclick="viewStoreDashboard('${store.id}')" class="action-btn-sm" title="ดู Dashboard" style="background:var(--primary); color:white;">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="toggleStoreStatus('${store.id}')" class="action-btn-sm ${isLocked ? '' : 'danger'}" title="${isLocked ? 'เปิดใช้งาน' : 'ปิดชั่วคราว'}">
                            <i class="fas fa-${isLocked ? 'unlock' : 'lock'}"></i>
                        </button>
                        <button onclick="openNotifyPaymentModal('${store.id}')" class="action-btn-sm" title="แจ้งยอดชำระ" style="background:var(--warning); color:white;">
                            <i class="fas fa-bell"></i>
                        </button>
                        <button onclick="deleteStore('${store.id}')" class="action-btn-sm danger" title="ลบร้านค้า">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        document.getElementById('count-online').innerText = onlineCount;
        document.getElementById('count-offline').innerText = offlineCount;
    }

    // Start countdown timers
    startMonitorCountdowns();
}

function toggleStoreStatus(storeId) {
    initManagerStore();
    const store = managerStoreData.activeStores.find(s => s.id === storeId);
    if (!store) return;

    const isCurrentlyLocked = store.status === 'locked';
    const action = isCurrentlyLocked ? 'เปิดใช้งาน' : 'ปิดชั่วคราว';

    Notify.confirm(`${action}ร้านค้า`, `ยืนยัน${action}ร้าน "${store.shopName}"?`, () => {
        store.status = isCurrentlyLocked ? 'active' : 'locked';
        saveManagerStoreData();
        renderMonitorStores();
        Notify.success(`${action}ร้าน "${store.shopName}" แล้ว`);
    });
}

function deleteStore(storeId) {
    initManagerStore();
    const store = managerStoreData.activeStores.find(s => s.id === storeId);
    if (!store) return;

    Notify.confirm('ลบร้านค้า', `ยืนยันลบร้าน "${store.shopName}" ถาวร? ข้อมูลทั้งหมดจะหายไป`, () => {
        managerStoreData.activeStores = managerStoreData.activeStores.filter(s => s.id !== storeId);

        // Free the serial key
        const sk = managerStoreData.serialKeys.find(s => s.id === store.serialKeyId);
        if (sk) {
            sk.status = 'available';
            sk.assignedTo = null;
        }

        saveManagerStoreData();
        renderMonitorStores();
        Notify.success(`ลบร้าน "${store.shopName}" แล้ว`);
    });
}

function viewStoreDashboard(storeId) {
    initManagerStore();
    const store = managerStoreData.activeStores.find(s => s.id === storeId);
    if (!store) return;

    document.getElementById('viewing-store-name').innerText = store.shopName;

    // Render store dashboard content
    const content = document.getElementById('view-store-dashboard-content');
    content.innerHTML = `
        <div class="store-dashboard-view">
            <div class="dashboard-force-row-3">
                <div class="stat-card blue">
                    <div class="stat-icon"><i class="fas fa-shopping-cart"></i></div>
                    <div class="stat-info">
                        <h4>ยอดขายวันนี้</h4>
                        <div class="stat-val">${(store.todaySales || 0).toLocaleString()} ฿</div>
                    </div>
                </div>
                <div class="stat-card green">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <h4>ยอดขายรวม</h4>
                        <div class="stat-val">${(store.totalRevenue || 0).toLocaleString()} ฿</div>
                    </div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-icon"><i class="fas fa-receipt"></i></div>
                    <div class="stat-info">
                        <h4>ออเดอร์ทั้งหมด</h4>
                        <div class="stat-val">${store.totalOrders || 0}</div>
                    </div>
                </div>
            </div>

            <div class="admin-card">
                <div class="card-head"><h4><i class="fas fa-info-circle"></i> ข้อมูลร้านค้า</h4></div>
                <div class="store-detail-grid">
                    <div class="detail-item"><span>ชื่อร้าน:</span> <strong>${store.shopName}</strong></div>
                    <div class="detail-item"><span>ลิงก์ร้าน:</span> <a href="${store.shopLink}" target="_blank">${store.shopLink}</a></div>
                    <div class="detail-item"><span>แพ็คเกจ:</span> <span class="pkg-badge ${store.package}">${store.package === 'premium' ? 'Premium' : 'Standard'}</span></div>
                    <div class="detail-item"><span>Serial Key:</span> <code>${store.serialKey}</code></div>
                    <div class="detail-item"><span>วันหมดอายุ:</span> ${new Date(store.serialExpiry).toLocaleDateString('th-TH')}</div>
                    <div class="detail-item"><span>สถานะ:</span> <span class="status-badge ${store.status}">${store.status === 'active' ? 'เปิดใช้งาน' : 'ถูกระงับ'}</span></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('view-store-dashboard-modal').classList.remove('hidden');
}

function closeViewStoreDashboard() {
    document.getElementById('view-store-dashboard-modal').classList.add('hidden');
}

// ================= PAYMENT STORES =================

function renderPaymentStores() {
    initManagerStore();

    // Load payment channels
    if (managerStoreData.paymentChannels) {
        const pc = managerStoreData.paymentChannels;
        document.getElementById('payment-bank-select').value = pc.bank?.name || '';
        document.getElementById('payment-bank-account').value = pc.bank?.account || '';
        document.getElementById('payment-bank-name').value = pc.bank?.holder || '';
        document.getElementById('payment-truewallet').value = pc.truewallet?.phone || '';
        document.getElementById('payment-truewallet-name').value = pc.truewallet?.holder || '';
    }

    // Render payment requests
    const container = document.getElementById('payment-requests-list');

    if (!managerStoreData.paymentRequests || managerStoreData.paymentRequests.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>ไม่มีรายการแจ้งชำระเงิน</p></div>`;
    } else {
        let html = '';
        managerStoreData.paymentRequests.forEach(req => {
            const statusClass = req.status === 'approved' ? 'success' : (req.status === 'rejected' ? 'danger' : 'warning');
            const statusText = req.status === 'approved' ? 'อนุมัติแล้ว' : (req.status === 'rejected' ? 'ปฏิเสธ' : 'รอตรวจสอบ');

            html += `
                <div class="payment-request-card ${statusClass}">
                    <div class="pr-header">
                        <div class="pr-store"><i class="fas fa-store"></i> ${req.storeName}</div>
                        <span class="pr-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="pr-body">
                        <div class="pr-row"><span>ยอดชำระ:</span> <strong>${req.amount?.toLocaleString() || '-'} ฿</strong></div>
                        <div class="pr-row"><span>หลักฐาน:</span> <a href="${req.proofLink}" target="_blank">ดูหลักฐาน</a></div>
                        <div class="pr-row"><span>วันที่:</span> ${new Date(req.submittedAt).toLocaleString('th-TH')}</div>
                        ${req.note ? `<div class="pr-row"><span>หมายเหตุ:</span> ${req.note}</div>` : ''}
                    </div>
                    ${req.status === 'pending' ? `
                        <div class="pr-actions">
                            <button onclick="approvePayment('${req.id}')" class="btn-success" style="flex:1; padding:8px;">
                                <i class="fas fa-check"></i> อนุมัติ
                            </button>
                            <button onclick="rejectPayment('${req.id}')" class="action-btn-sm danger" style="width:40px; height:36px;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        container.innerHTML = html;
    }
}

function savePaymentChannels() {
    initManagerStore();

    managerStoreData.paymentChannels = {
        bank: {
            name: document.getElementById('payment-bank-select').value,
            account: document.getElementById('payment-bank-account').value,
            holder: document.getElementById('payment-bank-name').value
        },
        truewallet: {
            phone: document.getElementById('payment-truewallet').value,
            holder: document.getElementById('payment-truewallet-name').value
        }
    };

    saveManagerStoreData();
    Notify.success('บันทึกช่องทางชำระเงินแล้ว');
}

function openNotifyPaymentModal(storeId) {
    initManagerStore();
    const store = managerStoreData.activeStores.find(s => s.id === storeId);
    if (!store) return;

    document.getElementById('notify-payment-store-id').value = storeId;
    document.getElementById('notify-payment-store-preview').innerHTML = `
        <div class="store-preview-card">
            <div class="store-preview-name"><i class="fas fa-store"></i> ${store.shopName}</div>
        </div>
    `;

    document.getElementById('notify-payment-amount').value = '';
    document.getElementById('notify-payment-message').value = '';

    document.getElementById('notify-payment-modal').classList.remove('hidden');
}

function closeNotifyPaymentModal() {
    document.getElementById('notify-payment-modal').classList.add('hidden');
}

function sendPaymentNotification() {
    const storeId = document.getElementById('notify-payment-store-id').value;
    const amount = parseFloat(document.getElementById('notify-payment-amount').value);
    const message = document.getElementById('notify-payment-message').value;

    if (!amount || amount <= 0) {
        Notify.warning('กรุณาระบุยอดชำระเงิน');
        return;
    }

    initManagerStore();
    const store = managerStoreData.activeStores.find(s => s.id === storeId);
    if (!store) return;

    store.paymentAmount = amount;
    store.paymentMessage = message;
    store.paymentNotifiedAt = new Date().toISOString();

    saveManagerStoreData();
    closeNotifyPaymentModal();
    Notify.success(`ส่งแจ้งยอดชำระ ${amount.toLocaleString()} บาท ให้ร้าน "${store.shopName}" แล้ว`);
}

function approvePayment(reqId) {
    initManagerStore();
    const req = managerStoreData.paymentRequests.find(r => r.id === reqId);
    if (!req) return;

    Notify.confirm('อนุมัติการชำระเงิน', `ยืนยันอนุมัติการชำระเงินจากร้าน "${req.storeName}"?`, () => {
        req.status = 'approved';
        req.approvedAt = new Date().toISOString();

        // Extend store expiry (example: add 1 month)
        const store = managerStoreData.activeStores.find(s => s.id === req.storeId);
        if (store) {
            const currentExpiry = new Date(store.serialExpiry);
            currentExpiry.setMonth(currentExpiry.getMonth() + 1);
            store.serialExpiry = currentExpiry.toISOString();
            store.status = 'active';

            // Add to revenue
            managerStoreData.systemRevenue.push({
                storeId: store.id,
                storeName: store.shopName,
                amount: req.amount,
                date: new Date().toISOString()
            });
        }

        saveManagerStoreData();
        renderPaymentStores();
        Notify.success('อนุมัติการชำระเงินแล้ว');
    });
}

function rejectPayment(reqId) {
    initManagerStore();
    const req = managerStoreData.paymentRequests.find(r => r.id === reqId);
    if (!req) return;

    Notify.confirm('ปฏิเสธการชำระเงิน', `ยืนยันปฏิเสธการชำระเงินจากร้าน "${req.storeName}"?`, () => {
        req.status = 'rejected';
        req.rejectedAt = new Date().toISOString();

        saveManagerStoreData();
        renderPaymentStores();
        Notify.info('ปฏิเสธการชำระเงินแล้ว');
    });
}

// ================= SUPER ADMIN DASHBOARD =================

function renderSuperDashboard() {
    initManagerStore();

    const activeStores = managerStoreData.activeStores || [];
    const premiumCount = activeStores.filter(s => s.package === 'premium').length;
    const standardCount = activeStores.filter(s => s.package === 'standard').length;
    const onlineCount = activeStores.filter(s => s.isOnline && s.status === 'active').length;
    const offlineCount = activeStores.length - onlineCount;

    // Calculate total revenue
    let totalRevenue = 0;
    (managerStoreData.systemRevenue || []).forEach(r => {
        totalRevenue += r.amount || 0;
    });

    // Update stats
    document.getElementById('super-total-stores').innerText = activeStores.length;
    document.getElementById('super-premium-stores').innerText = premiumCount;
    document.getElementById('super-standard-stores').innerText = standardCount;
    document.getElementById('super-total-revenue').innerText = totalRevenue.toLocaleString() + ' ฿';
    document.getElementById('super-online-count').innerText = onlineCount;
    document.getElementById('super-offline-count').innerText = offlineCount;

    // Top 5 stores by revenue
    const sortedByRevenue = [...activeStores].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
    const top5 = sortedByRevenue.slice(0, 5);
    const bottom5 = sortedByRevenue.slice(-5).reverse();

    let topHtml = '';
    top5.forEach((store, i) => {
        topHtml += `
            <div class="ranking-item">
                <span class="rank-num">${i + 1}</span>
                <span class="rank-name">${store.shopName}</span>
                <span class="rank-value">${(store.totalRevenue || 0).toLocaleString()} ฿</span>
            </div>
        `;
    });
    document.getElementById('top-stores-list').innerHTML = topHtml || '<div class="empty-state small"><p>ไม่มีข้อมูล</p></div>';

    let bottomHtml = '';
    bottom5.forEach((store, i) => {
        bottomHtml += `
            <div class="ranking-item">
                <span class="rank-num">${i + 1}</span>
                <span class="rank-name">${store.shopName}</span>
                <span class="rank-value">${(store.totalRevenue || 0).toLocaleString()} ฿</span>
            </div>
        `;
    });
    document.getElementById('bottom-stores-list').innerHTML = bottomHtml || '<div class="empty-state small"><p>ไม่มีข้อมูล</p></div>';

    // Render charts
    renderSuperCharts(premiumCount, standardCount);
}

function renderSuperCharts(premium, standard) {
    // Package ratio chart
    if (chartInstances['chart-package-ratio']) chartInstances['chart-package-ratio'].destroy();
    const ctx1 = document.getElementById('chart-package-ratio');
    if (ctx1) {
        chartInstances['chart-package-ratio'] = new Chart(ctx1.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Premium', 'Standard'],
                datasets: [{
                    data: [premium, standard],
                    backgroundColor: ['#f59e0b', '#6366f1'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // Monthly revenue chart (mock data for now)
    if (chartInstances['chart-monthly-revenue']) chartInstances['chart-monthly-revenue'].destroy();
    const ctx2 = document.getElementById('chart-monthly-revenue');
    if (ctx2) {
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'];
        const revenueData = months.map(() => Math.floor(Math.random() * 5000) + 1000);

        chartInstances['chart-monthly-revenue'] = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'รายได้',
                    data: revenueData,
                    backgroundColor: '#10b981',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}

// ================= UTILITY FUNCTIONS =================

function formatCountdown(ms) {
    if (ms <= 0) return 'หมดอายุ';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    const y = years;
    const mo = months % 12;
    const d = days % 30;
    const h = hours % 24;
    const m = minutes % 60;
    const s = seconds % 60;

    return `${y}ปี ${mo}เดือน ${d}วัน ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function startSerialKeyCountdowns() {
    document.querySelectorAll('.sk-countdown[data-expiry]').forEach(el => {
        const expiry = new Date(el.dataset.expiry);

        const update = () => {
            const diff = expiry - new Date();
            el.innerText = formatCountdown(diff);
            if (diff <= 0) {
                el.innerText = 'หมดอายุ';
                el.classList.add('expired');
            }
        };

        update();
        setInterval(update, 1000);
    });
}

function startMonitorCountdowns() {
    document.querySelectorAll('.monitor-countdown[data-expiry]').forEach(el => {
        const expiry = new Date(el.dataset.expiry);

        const update = () => {
            const diff = expiry - new Date();
            if (diff <= 0) {
                el.innerText = 'หมดอายุ';
                el.classList.add('expired');
            } else {
                el.innerText = formatCountdown(diff);
            }
        };

        update();
        setInterval(update, 1000);
    });
}

function updateManagerStoreBadges() {
    initManagerStore();

    const pendingCount = (managerStoreData.pendingStores || []).length;
    const openStoreCount = (managerStoreData.readyToOpenStores || []).length;

    document.getElementById('badge-pending-stores').innerText = pendingCount;
    document.getElementById('badge-open-store').innerText = openStoreCount;
}

function viewStoreDetail(storeId, type) {
    initManagerStore();
    let store = null;

    switch(type) {
        case 'pending':
            store = managerStoreData.pendingStores.find(s => s.id === storeId);
            break;
        case 'approved':
            store = managerStoreData.approvedStores.find(s => s.id === storeId);
            break;
        case 'active':
            store = managerStoreData.activeStores.find(s => s.id === storeId);
            break;
    }

    if (!store) return;

    const content = document.getElementById('store-detail-content');
    content.innerHTML = `
        <div class="store-detail-grid">
            <div class="detail-item"><span>ชื่อร้าน:</span> <strong>${store.shopName}</strong></div>
            <div class="detail-item"><span>ลิงก์ร้าน:</span> <a href="${store.shopLink}" target="_blank">${store.shopLink}</a></div>
            <div class="detail-item"><span>อายุร้าน:</span> ${store.shopAge?.year || 0} ปี ${store.shopAge?.month || 0} เดือน</div>
            <div class="detail-item"><span>แพ็คเกจ:</span> <span class="pkg-badge ${store.package}">${store.package === 'premium' ? 'Premium' : 'Standard'}</span></div>
            <div class="detail-item"><span>LINE:</span> ${store.contact?.line || '-'}</div>
            <div class="detail-item"><span>Facebook:</span> ${store.contact?.fb || '-'}</div>
            <div class="detail-item"><span>เบอร์โทร:</span> ${store.contact?.phone || '-'}</div>
            <div class="detail-item"><span>วันที่สมัคร:</span> ${new Date(store.registeredAt).toLocaleString('th-TH')}</div>
        </div>
    `;

    document.getElementById('store-detail-modal').classList.remove('hidden');
}

function closeStoreDetailModal() {
    document.getElementById('store-detail-modal').classList.add('hidden');
}

// ================= STORE PAYMENT MODAL (for stores) =================

function openStorePaymentModal(storeId) {
    initManagerStore();
    const store = managerStoreData.activeStores.find(s => s.id === storeId);
    if (!store) return;

    document.getElementById('payment-store-id').value = storeId;
    document.getElementById('payment-store-name').innerText = store.shopName;

    // Set countdown
    updatePaymentCountdown(store.serialExpiry);

    // Set status
    const isLocked = store.status === 'locked' || new Date(store.serialExpiry) < new Date();
    const statusEl = document.getElementById('payment-status');
    statusEl.innerText = isLocked ? 'ระงับ' : 'เปิดใช้งาน';
    statusEl.className = `payment-status-badge ${isLocked ? 'locked' : 'active'}`;

    // Set amount
    document.getElementById('payment-amount').innerText = (store.paymentAmount || 0).toLocaleString() + ' ฿';

    // Set expiry
    document.getElementById('payment-expiry').innerText = new Date(store.serialExpiry).toLocaleDateString('th-TH');

    // Render payment channels
    const channels = managerStoreData.paymentChannels || {};
    let channelHtml = '';

    if (channels.bank?.account) {
        channelHtml += `
            <div class="payment-channel-card">
                <div class="pc-icon"><i class="fas fa-university"></i></div>
                <div class="pc-info">
                    <div class="pc-name">${getBankName(channels.bank.name)}</div>
                    <div class="pc-detail">${channels.bank.account}</div>
                    <div class="pc-holder">${channels.bank.holder}</div>
                </div>
            </div>
        `;
    }

    if (channels.truewallet?.phone) {
        channelHtml += `
            <div class="payment-channel-card truewallet">
                <div class="pc-icon"><i class="fas fa-wallet"></i></div>
                <div class="pc-info">
                    <div class="pc-name">True Wallet</div>
                    <div class="pc-detail">${channels.truewallet.phone}</div>
                    <div class="pc-holder">${channels.truewallet.holder}</div>
                </div>
            </div>
        `;
    }

    document.getElementById('payment-channels-display').innerHTML = channelHtml || '<p class="text-muted">ไม่มีช่องทางชำระเงิน</p>';

    // Render payment history
    const historyContainer = document.getElementById('payment-history-list');
    const history = store.paymentHistory || [];

    if (history.length === 0) {
        historyContainer.innerHTML = '<p class="text-muted text-center">ไม่มีประวัติการชำระเงิน</p>';
    } else {
        let historyHtml = '';
        history.forEach(h => {
            const statusClass = h.status === 'approved' ? 'success' : (h.status === 'rejected' ? 'danger' : 'warning');
            historyHtml += `
                <div class="payment-history-item ${statusClass}">
                    <div class="ph-date">${new Date(h.date).toLocaleDateString('th-TH')}</div>
                    <div class="ph-amount">${h.amount?.toLocaleString() || '-'} ฿</div>
                    <div class="ph-status ${statusClass}">${h.status === 'approved' ? 'อนุมัติ' : (h.status === 'rejected' ? 'ปฏิเสธ' : 'รอตรวจสอบ')}</div>
                </div>
            `;
        });
        historyContainer.innerHTML = historyHtml;
    }

    document.getElementById('store-payment-modal').classList.remove('hidden');
}

function closeStorePaymentModal() {
    document.getElementById('store-payment-modal').classList.add('hidden');
}

function updatePaymentCountdown(expiryDate) {
    const countdownEl = document.getElementById('payment-countdown');

    const update = () => {
        const diff = new Date(expiryDate) - new Date();
        countdownEl.innerText = formatCountdown(diff);
    };

    update();
    setInterval(update, 1000);
}

function submitPaymentProof() {
    const storeId = document.getElementById('payment-store-id').value;
    const proofLink = document.getElementById('payment-proof-link').value.trim();
    const note = document.getElementById('payment-note').value.trim();

    if (!proofLink) {
        Notify.warning('กรุณาระบุลิงก์หลักฐานการชำระเงิน');
        return;
    }

    initManagerStore();
    const store = managerStoreData.activeStores.find(s => s.id === storeId);
    if (!store) return;

    const paymentRequest = {
        id: 'PR_' + Date.now(),
        storeId: storeId,
        storeName: store.shopName,
        amount: store.paymentAmount,
        proofLink: proofLink,
        note: note,
        status: 'pending',
        submittedAt: new Date().toISOString()
    };

    managerStoreData.paymentRequests.push(paymentRequest);

    // Add to store's payment history
    if (!store.paymentHistory) store.paymentHistory = [];
    store.paymentHistory.unshift({
        date: new Date().toISOString(),
        amount: store.paymentAmount,
        status: 'pending'
    });

    saveManagerStoreData();
    closeStorePaymentModal();
    Notify.success('ส่งหลักฐานการชำระเงินแล้ว');
}

function getBankName(bankCode) {
    const banks = {
        'kbank': 'ธนาคารกสิกรไทย',
        'scb': 'ธนาคารไทยพาณิชย์',
        'bbl': 'ธนาคารกรุงเทพ',
        'ktb': 'ธนาคารกรุงไทย',
        'tmb': 'ธนาคารทหารไทยธนชาต',
        'gsb': 'ธนาคารออมสิน',
        'bay': 'ธนาคารกรุงศรี'
    };
    return banks[bankCode] || bankCode;
}

// ================= INTEGRATION WITH EXISTING REGISTRATION =================

// Override submitRegistration to add to Manager Store pending list
const originalSubmitRegistration = typeof submitRegistration === 'function' ? submitRegistration : null;

async function submitRegistrationWithManagerStore() {
    const shopName = document.getElementById('reg-shop-name').value.trim();
    const shopLink = document.getElementById('reg-shop-link').value.trim();
    const shopAgeY = document.getElementById('reg-age-year').value;
    const shopAgeM = document.getElementById('reg-age-month').value;
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('reg-confirm-password').value;
    const contactLine = document.getElementById('reg-contact-line').value.trim();
    const contactFb = document.getElementById('reg-contact-fb').value.trim();
    const contactPhone = document.getElementById('reg-contact-phone').value.trim();
    const packageSelect = document.querySelector('input[name="package_select"]:checked').value;

    if (!shopName || !username || !password || !shopLink) {
        Notify.warning("กรุณากรอกข้อมูลสำคัญให้ครบ (ที่มีเครื่องหมาย *)");
        return;
    }
    if (password.length < 8) {
        Notify.error("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
        return;
    }
    if (password !== confirmPass) {
        Notify.error("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
        return;
    }
    if (!contactLine && !contactFb && !contactPhone) {
        Notify.warning("กรุณาระบุช่องทางติดต่ออย่างน้อย 1 ช่องทาง");
        return;
    }

    // Add to Manager Store pending list
    initManagerStore();

    const newStore = {
        id: 'STORE_' + Date.now(),
        shopName: shopName,
        shopLink: shopLink,
        shopAge: { year: parseInt(shopAgeY), month: parseInt(shopAgeM) },
        contact: { line: contactLine, fb: contactFb, phone: contactPhone },
        requestedUsername: username,
        requestedPassword: password,
        package: packageSelect,
        registeredAt: new Date().toISOString(),
        status: 'pending'
    };

    managerStoreData.pendingStores.push(newStore);
    saveManagerStoreData();

    closeRegisterModal();
    Notify.success("ส่งใบสมัครเรียบร้อย! กรุณารอการอนุมัติจากผู้ดูแลระบบ");
}

// Initialize Manager Store on page load
document.addEventListener('DOMContentLoaded', () => {
    initManagerStore();
});