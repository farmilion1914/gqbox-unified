// ==================== PWA: ТЕМА, КЭШ, SERVICE WORKER, УСТАНОВКА ====================

import { getTodayStr } from '../utils/dates.js';
import { isPWA, getOS } from '../utils/helpers.js';
import { toast } from '../services/toast.js';

// ===== ТЕМА =====
export const Theme = {
    STORAGE_KEY: 'gqbox_theme',
    _systemDark: window.matchMedia('(prefers-color-scheme: dark)'),
    _isSystemDark() { return this._systemDark.matches; },
    _isNightTime() { const h = new Date().getHours(); return h >= 19 || h < 7; },
    
    get() {
        const s = localStorage.getItem(this.STORAGE_KEY);
        if (s === 'dark' || s === 'light' || s === 'auto') return s;
        return 'auto';
    },
    
    set(mode) {
        localStorage.setItem(this.STORAGE_KEY, mode);
        this.apply();
    },
    
    apply() {
        const mode = this.get();
        let isDark = false;
        
        if (mode === 'dark') isDark = true;
        else if (mode === 'light') isDark = false;
        else if (mode === 'auto') {
            isDark = this._isSystemDark() || (!this._systemDark.addEventListener && this._isNightTime());
        }
        
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        this._updateMetaThemeColor(isDark);
        this._updateToggleButton(isDark);
    },
    
    _updateMetaThemeColor(isDark) {
        const m = document.querySelector('meta[name="theme-color"]');
        if (m) m.content = isDark ? '#1a1d23' : '#ffffff';
    },
    
    _updateToggleButton(isDark) {
        let btn = document.getElementById('themeToggleBtn');
        if (btn) btn.textContent = isDark ? '☀️' : '🌙';
        btn = document.getElementById('themeToggleBtnWH');
        if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    },
    
    toggle() {
        const mode = this.get();
        // Простое переключение тёмная <-> светлая (без промежуточного auto)
        if (mode === 'dark') this.set('light');
        else this.set('dark');
    },
    
    init() {
        this.apply();
        this._systemDark.addEventListener('change', () => {
            if (Theme.get() === 'auto') Theme.apply();
        });
    }
};

// ===== APP CACHE (IndexedDB) =====
export const AppCache = {
    _db: null,
    _openDB() {
        if (this._db) return Promise.resolve(this._db);
        return new Promise((resolve, reject) => {
            const r = indexedDB.open('GQBoxCache', 1);
            r.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', { keyPath: 'key' });
            };
            r.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
            r.onerror = () => reject(r.error);
        });
    },
    async set(key, val, ttl) {
        ttl = ttl || 300000;
        try {
            const db = await this._openDB();
            const tx = db.transaction('data', 'readwrite');
            tx.objectStore('data').put({ key, value: val, timestamp: Date.now(), ttl });
            return new Promise(resolve => { tx.oncomplete = resolve; });
        } catch (e) {}
    },
    async get(key) {
        try {
            const db = await this._openDB();
            const tx = db.transaction('data', 'readonly');
            const store = tx.objectStore('data');
            const result = await new Promise(resolve => {
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });
            if (!result) return null;
            if (Date.now() - result.timestamp > result.ttl) {
                await this.delete(key);
                return null;
            }
            return result.value;
        } catch (e) { return null; }
    },
    async delete(key) {
        try {
            const db = await this._openDB();
            const tx = db.transaction('data', 'readwrite');
            tx.objectStore('data').delete(key);
            return new Promise(resolve => { tx.oncomplete = resolve; });
        } catch (e) {}
    }
};

// ===== SERVICE WORKER + PWA =====
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        const swCode = "const CACHE_NAME='gqbox-v48';const ASSETS=['./','https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js','https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js'];self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS).catch(()=>{})));self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>{var fetched=fetch(e.request).then(response=>{if(response&&response.status===200){var clone=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(e.request,clone))}return response}).catch(()=>cached);return cached||fetched}))});";
        const swBlob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(swBlob);
        navigator.serviceWorker.register(swUrl).catch(() => {});
        window.addEventListener('unload', () => {
            try { if (swUrl) URL.revokeObjectURL(swUrl); } catch (e) {}
            try { navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister().catch(() => {}))); } catch (e) {}
        });
    }
}

// ===== REFRESH APP (очистка кэша) =====
export async function refreshApp() {
    try {
        if ('caches' in window) {
            const keys = await caches.keys();
            for (let j = 0; j < keys.length; j++) {
                try { await caches.delete(keys[j]); } catch (e) {}
            }
        }
        if (navigator.serviceWorker) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (let i = 0; i < regs.length; i++) {
                try { await regs[i].update(); } catch (e) {}
                await regs[i].unregister();
            }
        }
    } catch (e) {}
    location.reload(true);
}

// ===== PWA УСТАНОВКА =====
export function showInstallPrompt() {
    if (isPWA()) return;
    
    const today = getTodayStr();
    const lastPrompt = localStorage.getItem('pwa_prompt');
    if (lastPrompt === today) return;
    
    const os = getOS();
    
    if (os === 'ios') {
        const banner = document.getElementById('installBanner');
        if (banner) {
            banner.innerHTML = '📲 <strong>Установите:</strong> Поделиться → На экран Домой';
            banner.classList.add('show');
            setTimeout(() => {
                if (banner) banner.classList.remove('show');
            }, 15000);
        }
        localStorage.setItem('pwa_prompt', today);
    } else if (os === 'android' && window._deferredPrompt) {
        const banner = document.getElementById('installBanner');
        if (banner) {
            banner.innerHTML = '📲 <span>Установить приложение</span><button class="close-banner">✕</button>';
            banner.classList.add('show');
            banner.onclick = (e) => {
                if (e.target.classList.contains('close-banner')) {
                    banner.classList.remove('show');
                    localStorage.setItem('pwa_prompt', today);
                    return;
                }
                window._deferredPrompt.prompt();
                window._deferredPrompt.userChoice.then(() => {
                    window._deferredPrompt = null;
                    banner.classList.remove('show');
                    localStorage.setItem('pwa_prompt', today);
                });
            };
        }
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ PWA (вызывается из init) =====
export function initPWA() {
    Theme.init();
    
    let installPromptTimeout = null;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window._deferredPrompt = e;
        if (!installPromptTimeout) {
            installPromptTimeout = setTimeout(() => {
                if (window._deferredPrompt) showInstallPrompt();
                installPromptTimeout = null;
            }, 3000);
        }
    });
    window.addEventListener('appinstalled', () => {
        window._deferredPrompt = null;
        localStorage.setItem('pwa_prompt', getTodayStr());
        toast.success('Приложение установлено!');
    });
    
    registerServiceWorker();
}