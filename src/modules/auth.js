// ==================== ЕДИНЫЙ МОДУЛЬ АВТОРИЗАЦИИ ====================

import { getDB, getWarehouseDB } from '../services/firebase.js';
import { sessionCache } from '../services/cache.js';
import { SESSION_KEY } from '../config.js';

// ===== СЕССИЯ =====
export function saveSession(user) {
    sessionCache.set(SESSION_KEY, user);
}

export function getSession() {
    return sessionCache.get(SESSION_KEY);
}

export function clearSession() {
    sessionCache.remove(SESSION_KEY);
}

// ===== ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ =====
export function getCurrentUser() {
    return getSession();
}

// ===== СОТРУДНИКИ =====
let _employeesCache = null;
let _employeesCacheTime = 0;
const CACHE_TTL = 60000;

export async function getEmployeesCached() {
    if (_employeesCache && Date.now() - _employeesCacheTime < CACHE_TTL) {
        return _employeesCache;
    }
    const snap = await getDB().collection('employees').orderBy('name').get();
    _employeesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _employeesCacheTime = Date.now();
    return _employeesCache;
}

export async function getEmployees() {
    return getEmployeesCached();
}

export function invalidateEmployeesCache() {
    _employeesCache = null;
    _employeesCacheTime = 0;
}

// ===== ВХОД (ищет в ОБЕИХ базах) =====
export async function loginUser(login, password) {
    // Сначала ищем в базе упаковщиц
    let snap = await getDB().collection('employees')
        .where('login', '==', login.trim())
        .where('password', '==', password)
        .limit(1)
        .get();

    // Если не нашли — ищем в базе кладовщиков
    if (snap.empty) {
        snap = await getWarehouseDB().collection('employees')
            .where('login', '==', login.trim())
            .where('password', '==', password)
            .limit(1)
            .get();
    }

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const user = { id: doc.id, ...doc.data() };

    const appRole = await detectAppRole(user);

    const sessionUser = {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        warehouseRole: user.warehouseRole || 'standard',
        appRole: appRole,
        isAdmin: (user.role === 'admin' || user.role === 'superadmin'),
        isSuperAdmin: (user.role === 'superadmin')
    };

    saveSession(sessionUser);
    return sessionUser;
}

// ===== ОПРЕДЕЛЕНИЕ РОЛИ ПО ДАННЫМ =====
async function detectAppRole(user) {
    if (user.role === 'admin' || user.role === 'superadmin') return 'admin';

    // Если роль уже сохранена при регистрации — используем её
    if (user.appRole && ['packer', 'operator', 'warehouse'].includes(user.appRole)) {
        return user.appRole;
    }

    // Проверяем записи упаковки (база упаковщиц)
    const packSnap = await getDB().collection('pack_records')
        .where('userId', '==', user.id)
        .limit(1)
        .get();

    if (!packSnap.empty) {
        const attSnap = await getDB().collection('attendance')
            .where('userId', '==', user.id)
            .limit(1)
            .get();
        if (!attSnap.empty && attSnap.docs[0].data().role === 'operator') return 'operator';
        return 'packer';
    }

    // Проверяем складские записи (база кладовщиков)
    const workSnap = await getWarehouseDB().collection('work_logs')
        .where('userId', '==', user.id)
        .limit(1)
        .get();
    if (!workSnap.empty) return 'warehouse';

    // Если нет записей, но есть warehouseRole — кладовщик
    if (user.warehouseRole && user.role === 'user') return 'warehouse';

    return 'unknown';
}

// ===== ВОССТАНОВЛЕНИЕ СЕССИИ =====
export async function restoreSession() {
    const session = getSession();
    if (!session) return null;

    try {
        // Проверяем в базе упаковщиц
        let doc = await getDB().collection('employees').doc(session.id).get();
        // Если нет — в базе кладовщиков
        if (!doc.exists) {
            doc = await getWarehouseDB().collection('employees').doc(session.id).get();
        }
        if (!doc.exists) {
            clearSession();
            return null;
        }
        return session;
    } catch (e) {
        clearSession();
        return null;
    }
}

// ===== ВЫХОД =====
export function logout() {
    clearSession();
    invalidateEmployeesCache();
}

// ===== РЕГИСТРАЦИЯ =====
export async function registerUser(login, password, name, role) {
    if (!login || !password || !name) {
        return { success: false, error: 'Заполните все поля' };
    }

    const exist = await getDB().collection('employees')
        .where('login', '==', login.trim())
        .get();
    if (!exist.empty) return { success: false, error: 'Логин уже занят' };

    const appRole = role || 'packer';
    const isWarehouse = appRole === 'warehouse';

    await getDB().collection('employees').add({
        login: login.trim(),
        password,
        name: name.trim(),
        role: isWarehouse ? 'user' : (appRole === 'operator' ? 'operator' : 'user'),
        active: true,
        warehouseRole: isWarehouse ? 'standard' : null,
        appRole: appRole
    });

    return { success: true };
}

// ===== СТАВКА ПОЛЬЗОВАТЕЛЯ =====
export function getDailyRate(user) {
    return user?.dailyRate || 3750;
}