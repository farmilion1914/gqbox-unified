// ==================== ЕДИНЫЙ МОДУЛЬ АВТОРИЗАЦИИ ====================

import { getDB, getWarehouseDB, getAuth, getAuthWarehouse } from '../services/firebase.js';
import { sessionCache } from '../services/cache.js';
import { SESSION_KEY } from '../config.js';
import { hashPassword } from '../utils/crypto.js';

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

// ===== ВХОД =====
export async function loginUser(login, password) {
    const email = login.trim() + '@gqbox.app';

    // 1. Пробуем найти документ в Firestore (всегда первым делом)
    const found = await findUserDoc(login.trim());
    if (found) {
        const { doc, db, dbName } = found;

        // Есть пароль в документе — проверяем его
        if (doc.data().password) {
            const hashed = await hashPassword(password);
            if (doc.data().password !== password && doc.data().password !== hashed) {
                return null; // пароль не совпал
            }

            // Пароль совпал — пытаемся мигрировать в Auth, но НЕ блокируем вход
            migrateToAuth(login.trim(), password, email, db, dbName, doc).catch(() => {});

            // Входим сразу (даже если миграция не удалась)
            return await makeSession(login.trim(), doc, dbName);
        }

        // Пароля нет — пользователь уже мигрирован, вход без проверки
        if (doc.data().active === false) return null;
        return await makeSession(login.trim(), doc, dbName);
    }

    // 2. Документа нет в Firestore — пробуем Firebase Auth
    // (возможно, пользователь создан через регистрацию, но документ не записался)
    for (const [auth, authName] of [[getAuth(), 'packing'], [getAuthWarehouse(), 'warehouse']]) {
        if (!auth) continue;
        try {
            await auth.signInWithEmailAndPassword(email, password);
            console.log('Найден в Auth (' + authName + '), но нет документа. Пересоздаю...');
            const uid = auth.currentUser.uid;
            const db = authName === 'warehouse' ? getWarehouseDB() : getDB();
            await db.collection('employees').doc(uid).set({
                login: login.trim(),
                name: login.trim(),
                role: authName === 'warehouse' ? 'user' : 'user',
                active: true,
                appRole: authName === 'warehouse' ? 'warehouse' : 'unknown',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return await loadUserProfile(login.trim());
        } catch (e) {
            // ignore
        }
    }

    return null;
}

// ===== ПОИСК ДОКУМЕНТА ПО ЛОГИНУ =====
async function findUserDoc(login) {
    for (const [db, dbName] of [[getDB(), 'packing'], [getWarehouseDB(), 'warehouse']]) {
        const snap = await db.collection('employees')
            .where('login', '==', login)
            .limit(1)
            .get();
        if (!snap.empty) {
            return { doc: snap.docs[0], db, dbName };
        }
    }
    return null;
}

// ===== МИГРАЦИЯ В FIRESTORE AUTH (в фоне) =====
async function migrateToAuth(login, password, email, db, dbName, userDoc) {
    const auth = dbName === 'warehouse' ? getAuthWarehouse() : getAuth();
    if (!auth) return;

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;
        // Копируем документ на uid
        const data = userDoc.data();
        delete data.password;
        await db.collection('employees').doc(uid).set(data);
        await db.collection('employees').doc(userDoc.id).delete();
        console.log('Миграция успешна:', login, '→', uid);
    } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
            // Уже есть — просто удаляем пароль
            try {
                await auth.signInWithEmailAndPassword(email, password);
                await db.collection('employees').doc(auth.currentUser.uid).update({
                    password: firebase.firestore.FieldValue.delete()
                }).catch(() => {});
            } catch (signInErr) {
                // Пароль не совпадает в Auth — удаляем старый аккаунт Auth
                try {
                    // Используем admin SDK нельзя, просто копируем на uid
                } catch (e2) {}
            }
        }
    }
}

// ===== СОЗДАНИЕ СЕССИИ =====
async function makeSession(login, doc, source) {
    const user = { id: doc.id, ...doc.data(), _source: source };
    if (user.active === false) return null;

    const appRole = await detectAppRole(user);
    const sessionUser = {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        warehouseRole: user.warehouseRole || 'standard',
        appRole: appRole,
        isAdmin: (user.role === 'admin' || user.role === 'superadmin'),
        isSuperAdmin: (user.role === 'superadmin'),
        dailyRate: user.dailyRate || undefined,
        dailyRateEffectiveFrom: user.dailyRateEffectiveFrom || undefined,
        _authDb: source
    };
    saveSession(sessionUser);
    return sessionUser;
}

// ===== ЗАГРУЗКА ПРОФИЛЯ =====
async function loadUserProfile(login) {
    const found = await findUserDoc(login);
    if (!found) return null;
    return await makeSession(login, found.doc, found.dbName);
}

// ===== ОПРЕДЕЛЕНИЕ РОЛИ =====
async function detectAppRole(user) {
    if (user.role === 'admin' || user.role === 'superadmin') return 'admin';
    if (user.appRole && ['packer', 'operator', 'warehouse'].includes(user.appRole)) {
        return user.appRole;
    }

    const packSnap = await getDB().collection('pack_records')
        .where('userId', '==', user.id)
        .limit(1).get();
    if (!packSnap.empty) {
        const attSnap = await getDB().collection('attendance')
            .where('userId', '==', user.id)
            .limit(1).get();
        if (!attSnap.empty && attSnap.docs[0].data().role === 'operator') return 'operator';
        return 'packer';
    }

    const workSnap = await getWarehouseDB().collection('work_logs')
        .where('userId', '==', user.id)
        .limit(1).get();
    if (!workSnap.empty) return 'warehouse';
    if (user.warehouseRole && user.role === 'user') return 'warehouse';

    return 'unknown';
}

// ===== ВОССТАНОВЛЕНИЕ СЕССИИ =====
export async function restoreSession() {
    const session = getSession();
    if (!session) return null;

    const db = session._authDb === 'warehouse' ? getWarehouseDB() : getDB();

    try {
        let doc = await db.collection('employees').doc(session.id).get();

        // Если документ не найден (удалён при миграции) — ищем по логину
        if (!doc.exists && session.login) {
            const found = await findUserDoc(session.login);
            if (found) {
                doc = found.doc;
                session.id = doc.id;
                saveSession(session);
            }
        }

        if (!doc.exists) {
            clearSession();
            return null;
        }

        const data = doc.data();
        if (data.active === false) {
            clearSession();
            return null;
        }

        const freshRole = data.role;
        const freshIsAdmin = (freshRole === 'admin' || freshRole === 'superadmin');
        if (session.isAdmin !== freshIsAdmin || session.role !== freshRole) {
            session.role = freshRole;
            session.isAdmin = freshIsAdmin;
            session.isSuperAdmin = (freshRole === 'superadmin');
            saveSession(session);
        }
        return session;
    } catch (e) {
        clearSession();
        return null;
    }
}

// ===== ВЫХОД =====
export function logout() {
    const session = getSession();
    const authPacking = getAuth();
    const authWarehouse = getAuthWarehouse();

    if (session && session._authDb === 'warehouse' && authWarehouse && authWarehouse.currentUser) {
        authWarehouse.signOut().catch(() => {});
    } else if (authPacking && authPacking.currentUser) {
        authPacking.signOut().catch(() => {});
    }

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
    const email = login.trim() + '@gqbox.app';
    const auth = isWarehouse ? getAuthWarehouse() : getAuth();
    const db = isWarehouse ? getWarehouseDB() : getDB();

    if (!auth) {
        return { success: false, error: 'Firebase Auth не настроен для этой роли' };
    }

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = cred.user.uid;

        await db.collection('employees').doc(uid).set({
            login: login.trim(),
            name: name.trim(),
            role: isWarehouse ? 'user' : (appRole === 'operator' ? 'operator' : 'user'),
            active: true,
            warehouseRole: isWarehouse ? 'standard' : null,
            appRole: appRole,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            return { success: false, error: 'Логин уже зарегистрирован' };
        }
        if (err.code === 'auth/operation-not-allowed') {
            return { success: false, error: 'Регистрация отключена. Включите Email/Password в Firebase Console.' };
        }
        return { success: false, error: 'Ошибка регистрации: ' + err.message };
    }
}

export function getDailyRate(user) {
    return user?.dailyRate || 4000;
}