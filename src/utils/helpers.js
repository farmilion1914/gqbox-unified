// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Экранирование HTML
 */
export function escHtml(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
}

/**
 * Экранирование для атрибутов HTML (вкл. кавычки)
 * Используем \u0026 (код '&') вместо литерала '&',
 * чтобы автоформаттер не декодировал сущности обратно.
 */
const AMP = String.fromCharCode(38); // '&' без литерала, чтобы форматтер не декодировал
export function escAttr(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g, AMP + 'amp;')
        .replace(/"/g, AMP + 'quot;')
        .replace(/'/g, AMP + '#39;')
        .replace(/</g, AMP + 'lt;')
        .replace(/>/g, AMP + 'gt;');
}

/**
 * Экранирование (короткий псевдоним)
 */
export function esc(s) {
    return escHtml(s);
}

/**
 * Debounce функция
 */
export function debounce(fn, wait) {
    let timer;
    return function(...args) {
        const context = this;
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(context, args);
        }, wait);
    };
}

/**
 * Проверка PWA режима
 */
export function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        navigator.standalone ||
        document.referrer.indexOf('android-app://') >= 0;
}

/**
 * Определение ОС
 */
export function getOS() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'other';
}

/**
 * Воспроизведение звукового сигнала
 */
export function playBeep(frequency, duration, type) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = frequency;
        g.gain.value = 0.3;
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + duration);
    } catch (e) {
        // Audio not supported
    }
}

export function playSuccessSound() {
    playBeep(880, 0.1, 'sine');
    setTimeout(() => playBeep(1100, 0.15, 'sine'), 100);
}

export function playErrorSound() {
    playBeep(220, 0.3, 'square');
}

export function playScanSound() {
    playBeep(660, 0.08, 'square');
}

/**
 * Генерация ID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Клонирование объекта
 */
export function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Безопасный parseInt
 */
export function safeParseInt(val, fallback = 0) {
    const n = parseInt(val);
    return isNaN(n) ? fallback : n;
}

/**
 * Группировка массива по ключу
 */
export function groupBy(arr, keyFn) {
    const result = {};
    arr.forEach(item => {
        const key = keyFn(item);
        if (!result[key]) result[key] = [];
        result[key].push(item);
    });
    return result;
}

/**
 * Сумма значений по ключу
 */
export function sumBy(arr, keyFn) {
    return arr.reduce((sum, item) => sum + (keyFn(item) || 0), 0);
}

/**
 * Уникальные значения массива
 */
export function unique(arr) {
    return [...new Set(arr)];
}

/**
 * Сортировка по убыванию
 */
export function sortDesc(arr, keyFn) {
    return [...arr].sort((a, b) => keyFn(b) - keyFn(a));
}

/**
 * Разбивка массива на чанки
 */
export function chunkArray(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}