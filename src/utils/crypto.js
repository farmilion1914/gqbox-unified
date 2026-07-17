// ==================== КРИПТОГРАФИЯ (хеширование паролей) ====================

// Фиксированная соль приложения (не секрет, но усложняет
// перебор по радужным таблицам при утечке БД).
// Для реальной защиты пароли должны храниться в Firebase Auth,
// это — минимальная мера для текущей схемы с открытым паролем.
const APP_SALT = 'gqbox_unified_v1_salt_8f3a';

/**
 * Асинхронное SHA-256 + соль.
 * Возвращает hex-строку. Работает в браузере (Web Crypto API).
 */
export async function hashPassword(password) {
    const enc = new TextEncoder();
    const data = enc.encode(APP_SALT + ':' + password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Синхронная обёртка для случаев, где удобнее await.
 */
export function hashPasswordSync(password) {
    // Web Crypto — только async; оставляем async-вариант как основной.
    throw new Error('Используйте hashPassword (async)');
}