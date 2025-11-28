/**
 * WARISHAYDAY System V7.1 - Hybrid Edition (API + Offline Fallback)
 * Connects to Netlify Functions (Neon Tech) with LocalStorage Backup
 */

// ================= DATA STRUCTURE =================
const DEFAULT_CONFIG = {
    shopName: "WARISHAYDAY",
    slogan: "บริการอัพเกรดรวดเร็วทันใจ",
    announcement: "",
    helpContent: { limit: { video: "", desc: "" }, buy: { video: "", desc: "" } },
    orderSettings: { prefix: "WSD", dateFormat: "0168", runDigits: 4, lastRunNumber: 0, currentDateCode: "" },
    visuals: { themeColor: "#6366f1", opacityVal: 50, fontSizeHeading: 20, fontSizeBody: 16, backgroundImage: "", backgroundOverlay: 50, logo: "" },
    categoryMeta: {
        barn: { label: "โรงนา", icon: "fas fa-warehouse", color: "bg-red" },
        silo: { label: "ยุ้งฉาง", icon: "fas fa-seedling", color: "bg-orange" },
        land: { label: "ขยายพื้นที่", icon: "fas fa-map-marked-alt", color: "bg-green" },
        train: { label: "พื้นที่รถไฟ", icon: "fas fa-train", color: "bg-blue" }
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

const API_URL = "/.netlify/functions/api"; 
const ADMIN_PIN_FALLBACK = "210406"; // ใช้เมื่อต่อ Server ไม่ได้

// ================= HYBRID DATA MANAGER =================
class DataManager {
    constructor() {
        this.config = null;
        this.orders = [];
        this.isOffline = false; // สถานะการทำงาน
    }

    async init() {
        console.log("Initializing System...");
        try {
            // ลองต่อ Server (Timeout 3 วินาที)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const res = await fetch(`${API_URL}/config`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error("Server response not OK");

            const data = await res.json();
            console.log("Online Mode Connected");
            
            if (Object.keys(data).length === 0) {
                this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                await this.saveConfig(this.config);
            } else {
                this.config = this.mergeConfig(data);
            }
            await this.fetchOrders();
            this.isOffline = false;

        } catch (e) {
            console.warn("Server connection failed, switching to Offline Mode:", e);
            this.isOffline = true;
            this.loadLocalData();
        }
        
        this.applySettings();
        this.updateConnectionStatus();
    }

    // --- Local Storage Fallback ---
    loadLocalData() {
        if (!localStorage.getItem('warish_config_v7')) {
            // Migration from v6 or create new
            let old = localStorage.getItem('warish_config_v6') || localStorage.getItem('warish_config_v5');
            let base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            if(old) { try { let parsed = JSON.parse(old); base = { ...base, ...parsed }; } catch(e){} }
            localStorage.setItem('warish_config_v7', JSON.stringify(base));
        }
        if (!localStorage.getItem('warish_orders_v7')) {
             localStorage.setItem('warish_orders_v7', JSON.stringify([]));
        }
        this.config = JSON.parse(localStorage.getItem('warish_config_v7'));
        this.orders = JSON.parse(localStorage.getItem('warish_orders_v7'));
    }

    updateConnectionStatus() {
        // แสดงสถานะที่มุมจอ (Optional UI feedback)
        let statusEl = document.getElementById('conn-status');
        if(!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'conn-status';
            statusEl.style.cssText = "position:fixed; bottom:10px; right:10px; font-size:0.7rem; padding:4px 8px; border-radius:4px; opacity:0.7; z-index:9999;";
            document.body.appendChild(statusEl);
        }
        if(this.isOffline) {
            statusEl.innerText = "Offline Mode (Local Storage)";
            statusEl.style.background = "#fee2e2"; statusEl.style.color = "#ef4444";
        } else {
            statusEl.innerText = "Online Mode (Database)";
            statusEl.style.background = "#dcfce7"; statusEl.style.color = "#166534";
        }
    }

    // --- Operations ---

    async fetchOrders() {
        if(this.isOffline) return;
        try {
            const res = await fetch(`${API_URL}/orders`);
            this.orders = await res.json();
        } catch (e) { console.error("Fetch Orders Error", e); }
    }

    mergeConfig(loadedConfig) {
        let base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        return { ...base, ...loadedConfig };
    }

    getConfig() { return this.config; }

    async saveConfig(newConfig) {
        this.config = newConfig;
        this.applySettings();
        
        if(this.isOffline) {
            localStorage.setItem('warish_config_v7', JSON.stringify(newConfig));
            alert("บันทึกข้อมูลลงเครื่องแล้ว (Offline)");
        } else {
            try {
                await fetch(`${API_URL}/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newConfig)
                });
            } catch (e) {
                alert("Server Error: บันทึกไม่สำเร็จ");
            }
        }
    }

    getOrders() { return this.orders; }

    async addOrder(order) {
        const newOrder = { ...order, timestamp: new Date().toISOString(), status: 'new' };
        this.orders.unshift(newOrder); // Update UI Immediately
        
        if(this.isOffline) {
            localStorage.setItem('warish_orders_v7', JSON.stringify(this.orders));
        } else {
            try {
                await fetch(`${API_URL}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newOrder)
                });
            } catch (e) {
                console.error("Add Order Failed", e);
                // Fallback save to local in emergency?
            }
        }
    }

    async updateOrderStatus(id, status) {
        let order = this.orders.find(o => o.id === id);
        if(order) order.status = status;

        if(this.isOffline) {
            localStorage.setItem('warish_orders_v7', JSON.stringify(this.orders));
        } else {
            try {
                await fetch(`${API_URL}/orders/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                });
            } catch (e) { console.error(e); }
        }
    }

    async deleteOrder(id) {
        this.orders = this.orders.filter(o => o.id !== id);
        
        if(this.isOffline) {
            localStorage.setItem('warish_orders_v7', JSON.stringify(this.orders));
        } else {
            try {
                await fetch(`${API_URL}/orders/${id}`, { method: 'DELETE' });
            } catch (e) { console.error(e); }
        }
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
        
        // 1. Theme & Colors
        if(cfg.visuals.themeColor) {
            root.style.setProperty('--primary', cfg.visuals.themeColor);
            root.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${cfg.visuals.themeColor}, #222)`);
        }
        
        // 2. Opacity
        let val = parseInt(cfg.visuals.opacityVal);
        let op = 1 - (Math.abs(50 - val) / 100); 
        root.style.setProperty('--opacity-val', op);

        // 3. Fonts
        if(cfg.visuals.fontSizeHeading) root.style.setProperty('--font-heading', `${cfg.visuals.fontSizeHeading}px`);
        if(cfg.visuals.fontSizeBody) root.style.setProperty('--font-body', `${cfg.visuals.fontSizeBody}px`);

        // 4. Background
        if(cfg.visuals.backgroundImage) root.style.setProperty('--bg-image', `url('${cfg.visuals.backgroundImage}')`);
        else root.style.setProperty('--bg-image', 'none');
        
        let overlayOp = (cfg.visuals.backgroundOverlay !== undefined ? cfg.visuals.backgroundOverlay : 50) / 100;
        root.style.setProperty('--bg-overlay-opacity', overlayOp);

        // 5. Logo & Shop Info
        const nameDisplay = document.getElementById('shop-name-display');
        if(nameDisplay) nameDisplay.innerText = cfg.shopName;
        
        const sloganDisplay = document.getElementById('shop-slogan-display');
        if(sloganDisplay) sloganDisplay.innerText = cfg.slogan;

        const logoIcon = document.getElementById('main-logo-icon');
        const logoImg = document.getElementById('main-logo-img');
        if(logoIcon && logoImg) {
            if(cfg.visuals.logo && cfg.visuals.logo !== "") {
                logoImg.src = cfg.visuals.logo;
                logoImg.classList.remove('hidden');
                logoIcon.classList.add('hidden');
            } else {
                logoImg.classList.add('hidden');
                logoIcon.classList.remove('hidden');
            }
        }

        // 6. Announcement
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

// Global Instance
const db = new DataManager();
let currentCategory = '';
let currentLimit = 0;
let isFullLimit = false;
let currentOrderType = '';
let cart = [];
let chartInstances = {};
let currentAdminOrderTab = 'new';
let stockEditCat = '';

// ================= INIT =================
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    renderCategoryMenu();
    const dateInput = document.getElementById('dash-date-filter');
    if(dateInput) dateInput.valueAsDate = new Date();
});

// ================= ADMIN AUTH (IMPROVED) =================

async function verifyAdmin() {
    let pin = document.getElementById('admin-pin').value;
    
    // Check local fallback first (for offline/instant access)
    if (pin === ADMIN_PIN_FALLBACK && db.isOffline) {
        performLogin();
        return;
    }

    if (pin.length < 4) { alert("PIN สั้นเกินไป"); return; }
    
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin })
        });
        
        if(!res.ok) throw new Error("Network response was not ok");
        
        const data = await res.json();
        
        if (data.success) {
            performLogin();
        } else {
            alert("PIN ไม่ถูกต้อง");
        }
    } catch (e) {
        console.warn("Login API failed, checking local fallback pin...", e);
        // Fallback: ถ้าเน็ตหลุด แต่ PIN ถูก ต้องให้เข้าได้
        if(pin === ADMIN_PIN_FALLBACK) {
            alert("ไม่สามารถเชื่อมต่อ Server ได้ - เข้าสู่ระบบด้วยโหมด Offline");
            db.isOffline = true;
            db.loadLocalData();
            db.updateConnectionStatus();
            performLogin();
        } else {
            alert("เกิดข้อผิดพลาดในการเชื่อมต่อ และ PIN ไม่ถูกต้อง");
        }
    }
}

function performLogin() {
    closeAdminLogin();
    document.getElementById('customer-view').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    renderAdminDashboard(); 
}

// ================= UI FUNCTIONS =================

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    let icon = document.querySelector('#theme-toggle-btn i');
    icon.className = document.body.classList.contains('dark-mode') ? 'fas fa-sun' : 'fas fa-moon';
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
    let config = db.getConfig();
    if(config.announcement && config.announcement.trim() !== "") {
        document.getElementById('announcement-box').classList.remove('hidden');
    }
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
    if (inputVal < 0 || inputVal > 89) { alert("กรุณาระบุตัวเลขระหว่าง 0 ถึง 89"); return; }

    isFullLimit = (inputVal === 0);
    currentLimit = 89 - inputVal;

    document.getElementById('calculated-limit-step2').innerText = currentLimit;
    let badge = document.getElementById('limit-condition-text-step2');
    if(isFullLimit) { badge.innerText = "เต็มลิมิต"; badge.style.background = "#dbeafe"; badge.style.color = "#2563eb"; } 
    else { badge.innerText = "ไม่เต็มลิมิต"; badge.style.background = "#fee2e2"; badge.style.color = "#ef4444"; }

    document.getElementById('limit-mini-badge').innerText = `ลิมิต: ${currentLimit}`;
    renderPurchaseOptions();
    switchStep(2);
}

function renderPurchaseOptions() {
    const container = document.getElementById('dynamic-purchase-buttons');
    container.innerHTML = '';
    const options = [
        { id: 'mixed', label: 'แบบคละ', icon: 'fas fa-random' },
        { id: 'selected', label: 'แบบเลือก', icon: 'fas fa-hand-pointer' },
        { id: 'pure', label: 'แบบล้วน', icon: 'fas fa-cubes' },
        { id: 'cross', label: 'ข้ามโซน', icon: 'fas fa-exchange-alt' }
    ];
    options.forEach(opt => {
        let btn = document.createElement('div');
        btn.className = 'option-card';
        btn.innerHTML = `<i class="${opt.icon}" style="display:block; font-size:1.5rem; margin-bottom:5px;"></i> ${opt.label}`;
        btn.onclick = () => selectOrderType(opt.id);
        container.appendChild(btn);
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

    if (total > currentLimit) {
        alert(`เกินลิมิต! คุณกดได้แค่ ${currentLimit} ชิ้น`);
        if(currentInput) currentInput.value = "";
        total = 0; inputs.forEach(input => total += (parseInt(input.value) || 0));
    }
    if (currentOrderType === 'pure' && filledCount > 1) {
        alert("แบบล้วน เลือกได้แค่ 1 รายการเท่านั้น");
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
    if (price === 0) { alert("ยอดเงินเป็น 0"); return; }
    
    let itemsList = [];
    if (currentOrderType === 'mixed') {
        let quantity = isFullLimit ? 89 : currentLimit;
        itemsList.push(`สินค้าคละแบบ (Auto) x${quantity}`);
    } else {
        let inputs = document.querySelectorAll('.qty-control');
        inputs.forEach(inp => {
            let v = parseInt(inp.value) || 0;
            if (v > 0) itemsList.push(`${inp.dataset.name} x${v}`);
        });
        if(itemsList.length === 0) { alert("กรุณาระบุจำนวนสินค้า"); return; }
    }

    let tempId = db.generateOrderId();
    const config = db.getConfig();
    let catLabel = config.categoryMeta[currentCategory] ? config.categoryMeta[currentCategory].label : currentCategory;
    
    cart = [{
        id: tempId,
        category: catLabel,
        categoryId: currentCategory,
        type: currentOrderType,
        items: itemsList,
        price: price
    }];

    renderCartPreview();
    switchStep(4);
}

function renderCartPreview() {
    let o = cart[0];
    const typeMap = { mixed:"คละ", selected:"เลือก", pure:"ล้วน", cross:"ข้ามโซน" };
    const config = db.getConfig();
    
    let html = `
        <div style="border-bottom:1px dashed #ddd; padding-bottom:10px; margin-bottom:10px;">
            <strong style="color:var(--primary); font-size:1.1rem;">${config.shopName}</strong><br>
            <small style="color:#888;">ID: ${o.id}</small>
        </div>
        <div style="display:flex; justify-content:space-between;">
            <span>หมวด: ${o.category}</span>
            <span>แบบ: ${typeMap[o.type]}</span>
        </div>
        <hr style="margin:10px 0; border:0; border-top:1px solid #eee;">
    `;
    o.items.forEach(i => { html += `<div style="font-size:0.95rem; margin-bottom:5px;">- ${i}</div>`; });
    html += `<div style="background:var(--primary); color:white; padding:10px; border-radius:8px; margin-top:15px; display:flex; justify-content:space-between; font-weight:bold;"><span>รวม</span> <span>${o.price} บาท</span></div>`;
    document.getElementById('cart-preview-area').innerHTML = html;
}

function confirmOrder() {
    if(cart.length === 0) return;
    let o = cart[0];
    db.addOrder(o); 

    const typeMap = { mixed:"คละ", selected:"เลือก", pure:"ล้วน", cross:"ข้ามโซน" };
    const config = db.getConfig();
    let itemStr = o.items.map(i => `- ${i}`).join('\n');
    let textToCopy = `* ${config.shopName}\n* ID: ${o.id}\n* หมวด : ${o.category}\n* แบบ: ${typeMap[o.type]}\n---------------------\n${itemStr}\n---------------------\nรวม: ${o.price} บาท`;

    navigator.clipboard.writeText(textToCopy).then(showCopySuccess).catch(() => {
        const ta = document.createElement('textarea'); ta.value = textToCopy;
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        showCopySuccess();
    });
}

function showCopySuccess() {
    document.getElementById('copy-overlay').classList.remove('hidden');
    setTimeout(() => { document.getElementById('copy-overlay').classList.add('hidden'); location.reload(); }, 2000);
}

// ================= ADMIN & UI HELPERS =================

document.getElementById('admin-login-btn').onclick = () => document.getElementById('admin-login-modal').classList.remove('hidden');
function closeAdminLogin() { document.getElementById('admin-login-modal').classList.add('hidden'); }
function logoutAdmin() { exitAdmin(); document.getElementById('admin-pin').value = ''; }
function exitAdmin() {
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('customer-view').classList.remove('hidden');
    db.applySettings();
    renderCategoryMenu();
}
function toggleSidebar() { document.getElementById('adminSidebar').classList.toggle('active'); }

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-link').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    
    const menus = { dashboard:0, orders:1, products:2, prices:3, general:4 };
    document.querySelectorAll('.menu-link')[menus[tab]].classList.add('active');
    
    if(window.innerWidth <= 1024) document.getElementById('adminSidebar').classList.remove('active');

    if(tab === 'dashboard') renderAdminDashboard();
    if(tab === 'orders') renderOrderManagement();
    if(tab === 'products') { renderStockTabs(); }
    if(tab === 'prices') renderPriceConfig();
    if(tab === 'general') loadGeneralSettings();
}

function renderAdminDashboard() {
    const dateInput = document.getElementById('dash-date-filter');
    if(!dateInput.value) dateInput.valueAsDate = new Date();
    const selectedDate = new Date(dateInput.value);

    const orders = db.getOrders().filter(o => o.status === 'confirmed');
    
    let todayTotal = 0, monthTotal = 0, yearTotal = 0;
    let catStats = {}, typeStats = {}, itemStats = {};
    let timelineStats = {};

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
     
             o.items.forEach(iStr => {
                 if(typeof iStr === 'string') {
                    let parts = iStr.split(' x');
                    if(parts.length === 2) {
                        let name = parts[0].replace('สินค้าคละแบบ (Auto)', 'แบบคละ').trim();
                        let qty = parseInt(parts[1]) || 0;
                        itemStats[name] = (itemStats[name] || 0) + qty;
                    }
                 }
             });

             let dStr = o.timestamp.split('T')[0];
             if(!timelineStats[dStr]) timelineStats[dStr] = 0;
             timelineStats[dStr] += p;
        }
    });
    
    document.getElementById('dash-sales-today').innerText = todayTotal.toLocaleString() + " ฿";
    document.getElementById('dash-sales-month').innerText = monthTotal.toLocaleString() + " ฿";
    document.getElementById('dash-sales-year').innerText = yearTotal.toLocaleString() + " ฿";

    generateChartSummary('chart-category', 'doughnut', catStats, 'summary-list-category', 'ยอดขาย');
    generateChartSummary('chart-type', 'pie', typeStats, 'summary-list-type', 'ยอดขาย');
    
    let sortedItems = Object.entries(itemStats).sort((a,b)=>b[1]-a[1]).slice(0, 10);
    generateChartSummary('chart-items', 'bar', Object.fromEntries(sortedItems), 'summary-list-items', 'จำนวน');
    generateChartSummary('chart-summary', 'line', timelineStats, 'summary-list-total', 'ยอดขาย', true);
}

function generateChartSummary(canvasId, type, dataObj, summaryId, unitLabel, isTimeline=false) {
    let labels = Object.keys(dataObj);
    if(isTimeline) labels.sort();
    let values = labels.map(k => dataObj[k]);
    let colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#0ea5e9'];

    let listHTML = '';
    let total = values.reduce((a,b)=>a+b, 0);
    const container = document.getElementById(summaryId);
    if (!container) return;

    if(isTimeline) {
        listHTML = `<div class="summary-item" style="border-left-color:${colors[0]}"><strong>รวมปีนี้: ${total.toLocaleString()}</strong></div>`;
    } else {
        labels.forEach((l, i) => {
            let percent = total > 0 ? ((values[i]/total)*100).toFixed(1) : 0;
            listHTML += `
                <div class="summary-item" style="border-left-color:${colors[i%colors.length]}">
                    <span>${l}</span>
                    <strong>${values[i].toLocaleString()} (${percent}%)</strong>
                </div>`;
        });
    }
    container.innerHTML = listHTML;

    if(chartInstances[canvasId]) chartInstances[canvasId].destroy();
    let ctx = document.getElementById(canvasId).getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
        type: type,
        data: { labels: labels, datasets: [{ label: unitLabel, data: values, backgroundColor: type === 'line' ? 'rgba(99,102,241,0.1)' : colors, borderColor: type === 'line' ? '#6366f1' : 'white', borderWidth: 2, tension: 0.4, fill: type === 'line' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: !isTimeline, position: 'bottom', labels: { boxWidth: 10 } } } }
    });
}

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

    const containerId = tab === 'cancelled' ? 'list-cancelled-container' : (tab === 'confirmed' ? 'order-content-confirmed' : 'order-content-new');
    document.getElementById(tab === 'cancelled' ? 'order-content-cancelled' : containerId).classList.remove('hidden'); 
    renderOrderListHTML(filteredOrders, containerId, tab);
}

function searchOrder(val) { switchOrderSubTab(currentAdminOrderTab); }

function renderOrderListHTML(list, containerId, type) {
    const container = document.getElementById(containerId);
    if(list.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:#cbd5e1;"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:10px;"></i><br>ไม่มีออเดอร์</div>`;
        return;
    }

    let html = '';
    list.forEach(o => {
        let typeLabel = { mixed:"คละ", selected:"เลือก", pure:"ล้วน", cross:"ข้ามโซน" }[o.type] || o.type;
        let actionButtons = '';

        if(type === 'new') {
            actionButtons = `
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button onclick="changeOrderStatus('${o.id}', 'confirmed')" class="btn-primary" style="padding:8px; font-size:0.9rem; flex:1;">ยืนยัน</button>
                    <button onclick="changeOrderStatus('${o.id}', 'cancelled')" class="action-btn-sm danger" style="width:auto; padding:0 15px; flex:1;">ยกเลิก</button>
                </div>`;
        } else if (type === 'confirmed') {
             actionButtons = `
                <div style="margin-top:10px;">
                    <button onclick="viewOrderDetail('${o.id}')" class="btn-secondary-icon" style="width:100%; font-size:0.9rem; border-radius:8px; height:36px;">ดูออเดอร์</button>
                </div>`;
        } else if (type === 'cancelled') {
             actionButtons = `
                <div style="margin-top:10px; text-align:right;">
                    <button onclick="deleteOrderPermanently('${o.id}')" class="btn-text-danger">ลบถาวร</button>
                </div>`;
        }

        html += `
            <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:15px; margin-bottom:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <div style="font-weight:800; font-size:1.1rem; color:var(--primary);">${o.id}</div>
                        <div style="font-size:0.85rem; color:#94a3b8;">${new Date(o.timestamp).toLocaleString()}</div>
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

function changeOrderStatus(id, newStatus) {
    if(newStatus === 'cancelled' && !confirm("ต้องการยกเลิกออเดอร์นี้?")) return;
    db.updateOrderStatus(id, newStatus);
    let orders = db.getOrders();
    let o = orders.find(x => x.id === id);
    if(o) o.status = newStatus;
    updateOrderBadges();
    switchOrderSubTab(currentAdminOrderTab);
}

function deleteOrderPermanently(id) {
    if(!confirm("ลบถาวร? ไม่สามารถกู้คืนได้")) return;
    db.deleteOrder(id);
    updateOrderBadges();
    switchOrderSubTab('cancelled');
}

function clearAllCancelledOrders() {
    if(!confirm("ล้างออเดอร์ที่ยกเลิกทั้งหมด?")) return;
    let cancelled = db.getOrders().filter(o => o.status === 'cancelled');
    cancelled.forEach(o => db.deleteOrder(o.id));
    updateOrderBadges();
    switchOrderSubTab('cancelled');
}

function viewOrderDetail(id) {
    let orders = db.getOrders();
    let o = orders.find(x => x.id === id);
    if(!o) return;

    let itemsHtml = o.items.map(i => `<li style="margin-bottom:5px;">${i}</li>`).join('');
    
    let content = `
        <div style="text-align:center; margin-bottom:15px;">
            <h2 style="color:var(--primary);">${o.id}</h2>
            <div style="color:#64748b; font-size:0.9rem;">${new Date(o.timestamp).toLocaleString()}</div>
        </div>
        <div style="background:white; padding:15px; border-radius:8px; border:1px dashed #cbd5e1;">
            <ul style="padding-left:20px; color:var(--text-main);">${itemsHtml}</ul>
        </div>
        <div style="margin-top:15px; display:flex; justify-content:space-between; font-weight:bold; font-size:1.2rem;">
            <span>ยอดรวม</span>
            <span style="color:var(--success);">${o.price} ฿</span>
        </div>
    `;
    
    document.getElementById('order-detail-content').innerHTML = content;
    document.getElementById('order-detail-modal').classList.remove('hidden');
}
function closeOrderDetail() { document.getElementById('order-detail-modal').classList.add('hidden'); }

// --- STOCK & CONFIG ---
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
    area.innerHTML += `<div class="stock-item-card" style="border:2px dashed #e2e8f0; cursor:pointer; justify-content:center; min-height:220px;" onclick="addStockItem()"><i class="fas fa-plus-circle" style="font-size:3rem; color:#cbd5e1;"></i><div style="color:#94a3b8; margin-top:10px;">เพิ่มสินค้า</div></div>`;
}

function openAddCategoryModal() { document.getElementById('add-category-modal').classList.remove('hidden'); }
function confirmAddCategory() {
    const config = db.getConfig();
    let name = document.getElementById('new-cat-name').value;
    let id = document.getElementById('new-cat-id').value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if(!name || !id) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }
    if(config.items[id]) { alert("รหัสหมวดหมู่นี้มีอยู่แล้ว"); return; }
    
    config.items[id] = [];
    config.prices[id] = { mixed: 100, selected: 150, pure: 200, tray: 15 };
    const CATEGORY_PRESETS = [ { icon: 'fas fa-warehouse', color: 'bg-red' }, { icon: 'fas fa-seedling', color: 'bg-orange' }, { icon: 'fas fa-map-marked-alt', color: 'bg-green' }, { icon: 'fas fa-train', color: 'bg-blue' }];
    let style = CATEGORY_PRESETS[Math.floor(Math.random() * CATEGORY_PRESETS.length)];
    config.categoryMeta[id] = { label: name, icon: style.icon, color: style.color };
    
    db.saveConfig(config);
    document.getElementById('add-category-modal').classList.add('hidden');
    renderStockTabs();
}

function deleteCurrentCategory() {
    const config = db.getConfig();
    if(Object.keys(config.categoryMeta).length <= 1) { alert("ต้องมีอย่างน้อย 1 หมวดหมู่"); return; }
    if(confirm(`ยืนยันลบหมวดหมู่ "${config.categoryMeta[stockEditCat].label}" ? ข้อมูลสินค้าจะหายไปทั้งหมด`)) {
        delete config.items[stockEditCat]; delete config.prices[stockEditCat]; delete config.categoryMeta[stockEditCat];
        stockEditCat = ''; db.saveConfig(config); renderStockTabs();
    }
}

function promptImage(cat, idx) {
    const config = db.getConfig();
    let current = config.items[cat][idx].img || "";
    let url = prompt("URL รูปภาพ (https://...):", current);
    if(url !== null) { config.items[cat][idx].img = url; renderStockManage(cat); }
}
function updateItemName(cat, idx, val) { db.getConfig().items[cat][idx].name = val; }
function deleteStockItem(cat, idx) { if(confirm("ลบสินค้านี้?")) { db.getConfig().items[cat].splice(idx, 1); renderStockManage(cat); } }
function addStockItem() { let n = prompt("ชื่อสินค้าใหม่:"); if(n) { db.getConfig().items[stockEditCat].push({name:n, img:null}); renderStockManage(stockEditCat); } }
function saveStockChanges() { db.saveConfig(db.getConfig()); alert("บันทึกข้อมูลเรียบร้อย"); }

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
    db.saveConfig(config); alert("บันทึกราคาเรียบร้อย");
}

function loadGeneralSettings() {
    const config = db.getConfig();
    document.getElementById('edit-shop-name').value = config.shopName;
    document.getElementById('edit-shop-slogan').value = config.slogan;
    document.getElementById('edit-announcement').value = config.announcement;
    document.getElementById('edit-video-limit').value = config.helpContent.limit.video || "";
    document.getElementById('edit-desc-limit').value = config.helpContent.limit.desc;
    document.getElementById('edit-video-buy').value = config.helpContent.buy.video || "";
    document.getElementById('edit-desc-buy').value = config.helpContent.buy.desc;
    document.getElementById('edit-font-heading').value = config.visuals.fontSizeHeading || 20;
    document.getElementById('edit-font-body').value = config.visuals.fontSizeBody || 16;
    document.getElementById('edit-bg-overlay').value = config.visuals.backgroundOverlay !== undefined ? config.visuals.backgroundOverlay : 50;
    document.getElementById('edit-color-intensity').value = config.visuals.opacityVal;

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
        if(file.size > 5 * 1024 * 1024) { alert("ไฟล์ใหญ่เกินไป! (จำกัด 5MB)"); fileInput.value = ""; return; }
        const reader = new FileReader();
        reader.onload = function(event) { document.getElementById(urlInputId).value = event.target.result; alert("อัพโหลดไฟล์สำเร็จ"); };
        reader.readAsDataURL(file);
    };
}
function setupBgImageUpload() {
    const fileInput = document.getElementById('file-bg-image');
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if(!file) return;
        if(file.size > 2 * 1024 * 1024) { alert("รูปภาพใหญ่เกินไป! (จำกัด 2MB)"); return; }
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
        if(file.size > 2 * 1024 * 1024) { alert("รูปภาพใหญ่เกินไป! (จำกัด 2MB)"); return; }
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
function saveGeneralSettings() {
    const config = db.getConfig();
    config.shopName = document.getElementById('edit-shop-name').value;
    config.slogan = document.getElementById('edit-shop-slogan').value;
    config.announcement = document.getElementById('edit-announcement').value;
    
    config.visuals.opacityVal = parseInt(document.getElementById('edit-color-intensity').value);
    config.visuals.fontSizeHeading = parseInt(document.getElementById('edit-font-heading').value);
    config.visuals.fontSizeBody = parseInt(document.getElementById('edit-font-body').value);
    config.visuals.backgroundOverlay = parseInt(document.getElementById('edit-bg-overlay').value);
    
    let newBg = document.getElementById('edit-bg-url').value;
    if(newBg !== "") config.visuals.backgroundImage = newBg;

    let newLogo = document.getElementById('edit-logo-url').value;
    if(newLogo === "CLEAR") config.visuals.logo = "";
    else if(newLogo !== "") config.visuals.logo = newLogo;

    config.helpContent = {
        limit: { video: document.getElementById('edit-video-limit').value, desc: document.getElementById('edit-desc-limit').value },
        buy: { video: document.getElementById('edit-video-buy').value, desc: document.getElementById('edit-desc-buy').value }
    };

    db.saveConfig(config); 
    alert("บันทึกการตั้งค่าแล้ว");
}

function openThemeSelector() {
    const grid = document.getElementById('theme-grid'); grid.innerHTML = '';
    const themes = ['#4f46e5', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#db2777'];
    themes.forEach(c => {
        let el = document.createElement('div'); el.className = 'theme-option'; el.style.backgroundColor = c;
        el.onclick = () => { db.getConfig().visuals.themeColor = c; db.saveConfig(db.getConfig()); closeThemeSelector(); };
        grid.appendChild(el);
    });
    document.getElementById('theme-modal').classList.remove('hidden');
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
