// ==================== МОДУЛЬ СКЛАДСКИХ ОПЕРАЦИЙ ====================

import { getWarehouseDB, serverTimestamp, batchWarehouse } from '../services/firebase.js';
import { getTodayStr, formatDateForInput } from '../utils/dates.js';
import { getCurrentUser } from './auth.js';
import { HISTORY_PAGE_SIZE } from '../config.js';

// ===== СЧЁТЧИКИ =====
let _counters = {
    moscowReceived: 0, moscowCollected: 0, moscowShipped: 0, moscowInvoiceTotal: 0,
    pushkinoAccepted: 0, pushkinoAcceptedTotal: 0, pushkinoShipped: 0, pushkinoShippedTotal: 0,
    pushkinoUnloaded: 0, pushkinoUnloadedTotal: 0, pushkinoReworked: 0, pushkinoReworkedTotal: 0
};
let _moscowLastArticle = '—';

let _historyCache = {};
let _historyTotalDocs = 0;
let _currentHistoryPage = 1;
let _currentHistoryDate = new Date();

let _salaryCache = {};

// ===== Геттеры =====
export function getCounters() { return _counters; }
export function setCounters(c) { _counters = c; }
export function getMoscowLastArticle() { return _moscowLastArticle; }
export function setMoscowLastArticle(art) { _moscowLastArticle = art; }
export function getHistoryCurrentDate() { return _currentHistoryDate; }
export function setHistoryCurrentDate(d) { _currentHistoryDate = d; }
export function getHistoryCurrentPage() { return _currentHistoryPage; }
export function setHistoryCurrentPage(p) { _currentHistoryPage = p; }
export function invalidateHistoryCache() { _historyCache = {}; }
export function invalidateSalaryCache() { _salaryCache = {}; }

// ===== СЧЁТЧИКИ =====
export function updateCounter(key, value) {
    if (key in _counters) _counters[key] = Math.max(0, value);
}

export function adjustCounter(key, delta) {
    if (key in _counters) _counters[key] = Math.max(0, (_counters[key] || 0) + delta);
}

export function resetCounter(key) {
    if (key in _counters) _counters[key] = 0;
}

export function updateAllCountersUI() {
    const ids = [
        'moscowReceived', 'moscowCollected', 'moscowShipped', 'moscowInvoiceTotal',
        'pushkinoAccepted', 'pushkinoAcceptedTotal', 'pushkinoShipped', 'pushkinoShippedTotal',
        'pushkinoUnloaded', 'pushkinoUnloadedTotal', 'pushkinoReworked', 'pushkinoReworkedTotal',
        'moscowLastArticle'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'moscowLastArticle') el.textContent = _moscowLastArticle;
            else el.textContent = _counters[id] || 0;
        }
    });
}

// ===== ОПЕРАЦИИ =====
export async function addWorkLog(warehouse, action, details, quantity) {
    const user = getCurrentUser();
    if (!user) return;
    const today = getTodayStr();
    await getWarehouseDB().collection('work_logs').add({
        userId: user.id,
        userName: user.name,
        warehouse,
        action,
        details,
        quantity: quantity || null,
        date: today,
        timestamp: serverTimestamp()
    });
}

export async function updateUserTotal(type, increment) {
    const user = getCurrentUser();
    if (!user) return;
    const docId = user.id + '_' + type;
    try {
        await getWarehouseDB().runTransaction(async (t) => {
            const ref = getWarehouseDB().collection('user_totals').doc(docId);
            const doc = await t.get(ref);
            let newTotal = increment;
            if (doc.exists) newTotal = (doc.data().total || 0) + increment;
            t.set(ref, {
                userId: user.id,
                userName: user.name,
                type,
                total: newTotal,
                updatedAt: serverTimestamp()
            });
        });
    } catch(e) {}

    const totalMap = {
        pushkino_accepted: 'pushkinoAcceptedTotal',
        pushkino_shipped: 'pushkinoShippedTotal',
        pushkino_unloaded: 'pushkinoUnloadedTotal',
        pushkino_reworked: 'pushkinoReworkedTotal',
        moscow_invoice: 'moscowInvoiceTotal'
    };
    const ck = totalMap[type];
    if (ck && ck in _counters) _counters[ck] = (_counters[ck] || 0) + increment;
    updateAllCountersUI();
}

export async function loadUserTotals(userId) {
    const snap = await getWarehouseDB().collection('user_totals').where('userId', '==', userId).get();
    const map = {
        pushkino_accepted: 'pushkinoAcceptedTotal',
        pushkino_shipped: 'pushkinoShippedTotal',
        pushkino_unloaded: 'pushkinoUnloadedTotal',
        pushkino_reworked: 'pushkinoReworkedTotal',
        moscow_invoice: 'moscowInvoiceTotal'
    };
    snap.docs.forEach(doc => {
        const data = doc.data();
        const ck = map[data.type];
        if (ck && ck in _counters) _counters[ck] = data.total || 0;
    });
    updateAllCountersUI();
}

// ===== ИСТОРИЯ =====
export async function loadHistoryForDate(userId, dateStr, page) {
    page = page || 1;
    _currentHistoryPage = page;
    const cacheKey = userId + '_' + dateStr + '_' + page;

    if (_historyCache[cacheKey]) {
        return _historyCache[cacheKey];
    }

    const snap = await getWarehouseDB().collection('work_logs')
        .where('userId', '==', userId)
        .where('date', '==', dateStr)
        .orderBy('timestamp', 'desc')
        .get();

    const allLogs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    _historyTotalDocs = allLogs.length;

    const totalPages = Math.ceil(allLogs.length / HISTORY_PAGE_SIZE) || 1;
    if (page > totalPages && totalPages > 0) page = totalPages;
    if (page < 1) page = 1;
    _currentHistoryPage = page;

    const startIdx = (page - 1) * HISTORY_PAGE_SIZE;
    const pageLogs = allLogs.slice(startIdx, startIdx + HISTORY_PAGE_SIZE);

    const result = {
        logs: pageLogs,
        totalDocs: _historyTotalDocs,
        currentPage: _currentHistoryPage,
        totalPages: Math.ceil(_historyTotalDocs / HISTORY_PAGE_SIZE) || 1
    };

    _historyCache[cacheKey] = result;
    return result;
}

// ===== УДАЛЕНИЕ ЗАПИСИ =====
export async function deleteWorkLog(docId) {
    const docRef = getWarehouseDB().collection('work_logs').doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return { success: false, error: 'Запись не найдена' };

    const logData = docSnap.data();
    await docRef.delete();

    if (logData && logData.action === 'Работал на складе' && logData.userId && logData.warehouse && logData.date) {
        const attSnap = await getWarehouseDB().collection('attendance')
            .where('userId', '==', logData.userId)
            .where('warehouse', '==', logData.warehouse)
            .where('date', '==', logData.date)
            .get();
        const ba = batchWarehouse();
        attSnap.docs.forEach(d => ba.delete(d.ref));
        await ba.commit();
    }

    _historyCache = {};
    _salaryCache = {};
    return { success: true };
}

export async function getAllLogsForPeriod(startDate, endDate, userId) {
    let q = getWarehouseDB().collection('work_logs');
    if (userId) q = q.where('userId', '==', userId);
    q = q.where('date', '>=', startDate).where('date', '<=', endDate);
    const snap = await q.orderBy('timestamp', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, data: d.data() }));
}

export default {
    getCounters, setCounters, getMoscowLastArticle, setMoscowLastArticle,
    updateCounter, adjustCounter, resetCounter, updateAllCountersUI,
    addWorkLog, updateUserTotal, loadUserTotals,
    loadHistoryForDate, deleteWorkLog, getAllLogsForPeriod,
    invalidateHistoryCache, invalidateSalaryCache,
    getHistoryCurrentDate, setHistoryCurrentDate,
    getHistoryCurrentPage, setHistoryCurrentPage
};