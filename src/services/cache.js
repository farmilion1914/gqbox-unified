// ==================== КЭШ СЕССИИ (localStorage) ====================

const PREFIX = '';

export const sessionCache = {
    set(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (e) {
            // localStorage недоступен
        }
    },
    
    get(key) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (raw === null) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(PREFIX + key);
        } catch (e) {}
    }
};