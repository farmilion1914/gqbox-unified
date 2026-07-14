// ==================== КОНФИГУРАЦИЯ ====================

// Firebase — упаковщицы
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAWmeGhe0wFrqULYqvnCX4WY9EhuPFEjHs",
    authDomain: "packing23-11afd.firebaseapp.com",
    projectId: "packing23-11afd",
    storageBucket: "packing23-11afd.firebasestorage.app",
    messagingSenderId: "786002108142",
    appId: "1:786002108142:web:213b1f60bd6ec5f9429dff"
};

// Firebase — кладовщики
export const FIREBASE_CONFIG_WAREHOUSE = {
    apiKey: "AIzaSyComSAJzMrarnUBATsTlNs60w6CDe2NTj0",
    authDomain: "warehouse-b6b75.firebaseapp.com",
    projectId: "warehouse-b6b75",
    storageBucket: "warehouse-b6b75.firebasestorage.app",
    messagingSenderId: "399929411326",
    appId: "1:399929411326:web:c3c84828ad31b8810b47af"
};

export const WB_CITIES = [
    "Казань", "Краснодар", "Невинномысск", "Екатеринбург",
    "Шушары", "Челябинск", "Великий Камень", "Тула",
    "Коледино", "Электросталь", "Волгоград", "Владимир",
    "Рязань", "Воронеж", "Новосибирск", "Сарапул",
    "Котовск", "Чехов 1", "Чехов 2", "Обухово"
];

export const OZON_STORES = {
    direct: [
        "Хоругвино", "Софьино", "Пушкино 2", "Пушкино 1",
        "Ватутинки", "Петровское", "Гривно", "Домодедово",
        "Жуковский", "Ногинск (прям.)", "Фреш"
    ],
    crossdock: ["Радумля", "Ногинск"]
};

export const ALL_OZON_STORES = [...OZON_STORES.direct, ...OZON_STORES.crossdock];

// ИП для упаковщиц
export const IP_LIST = ["КАА", "КЮА", "БМС", "ДЕВ"];

// ИП для кладовщиков (фото паллет)
export const IP_LIST_WAREHOUSE = ['Абакаров', 'Абдулаев', 'Алиев', 'Гаджиев', 'Ибрагимов', 'Магомедов'];

export const DEFAULT_DAILY_RATE = 4000;

export const MAX_PHOTOS = 4;

// Единый ключ сессии
export const SESSION_KEY = 'gqbox_unified_session';

export const HISTORY_PAGE_SIZE = 25;

export const USERS_PAGE_SIZE = 5;

export const FILTER_PAGE_SIZE = 25;

// Размер страницы для логов админки (склад)
export const ADMIN_LOGS_PAGE_SIZE = 20;

// Максимальный размер фото (байт)
export const MAX_PHOTO_SIZE = 20 * 1024 * 1024;

// Цвета городов (для фото паллет)
export const CITY_COLORS = [
    '#007aff', '#34c759', '#ff9500', '#ff3b30', '#af52de',
    '#5ac8fa', '#ff2d55', '#5856d6', '#00c7be', '#ff6482'
];

// ===== ФУНКЦИИ КВ И СТАВОК (упаковка) =====

export function getKV(quantity) {
    if (quantity >= 4001) return 1.4;
    if (quantity >= 3001) return 1.3;
    if (quantity >= 2001) return 1.2;
    if (quantity >= 1001) return 1.1;
    return 1.0;
}

export function calcSalary(quantity) {
    return 2500 * getKV(quantity) * quantity / 1000;
}

export function getRate(quantity) {
    if (quantity >= 4001) return 3.5;
    if (quantity >= 3001) return 3.25;
    if (quantity >= 2001) return 3.0;
    if (quantity >= 1001) return 2.75;
    return 2.5;
}

export function isCrossdock(store) {
    return OZON_STORES.crossdock.includes(store);
}

// ===== KPI СТАВКИ (склад) =====

export const KPI_RATES = {
    collect: { label: 'Сборка паллет', rate: 100, unit: 'палл.' },
    lay: { label: 'Выкладка товара', rate: 0.1, unit: 'ед.' }
};

// ===== РОЛИ СКЛАДА =====

export function getWarehouseRoleLabel(role) {
    const labels = {
        senior: 'Старший кладовщик',
        admin: 'Админ склада',
        pro: 'Кладовщик PRO',
        standard: 'Кладовщик',
        probation: 'Кладовщик (Испытательный)'
    };
    return labels[role] || role;
}

export function getWarehouseRoleRate(role) {
    const rates = {
        senior: 4500,
        admin: 3500,
        pro: 4000,
        standard: 3000,
        probation: 2700
    };
    return rates[role] || 3000;
}
