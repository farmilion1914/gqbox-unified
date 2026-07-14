// ==================== МОДУЛЬ ЗАПИСЕЙ УПАКОВКИ ====================

import { collection, queryWhere, addDoc, deleteDoc, getDoc, serverTimestamp, getDB } from '../services/firebase.js';
import { getTodayStr, formatDateISO } from '../utils/dates.js';
import { getKV, calcSalary } from '../config.js';

// Кэш всех записей (TTL 5 мин) — снижает число тяжёлых запросов к Firestore
let _allRecordsCache = null;
let _allRecordsCacheTime = 0;
const ALL_RECORDS_TTL = 300000;

// Кэш записей за период (TTL 5 мин) — используется дашбордом и вкладкой упаковки
let _rangeCache = {};
const RANGE_TTL = 300000;

export function invalidateAllRecordsCache() {
    _allRecordsCache = null;
    _allRecordsCacheTime = 0;
    _rangeCache = {};
}

/**
 * Добавление записи упаковки
 */
export async function addPackRecord(article, qty, userId, userName, marketplace, locationDisplay, locationRaw, ip) {
    const quantity = parseInt(qty);
    if (!article || !quantity || quantity <= 0) {
        return { success: false, error: 'Заполните артикул и количество' };
    }
    
    const today = getTodayStr();
    const dateStr = new Date().toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    await addDoc('pack_records', {
        userId,
        userName,
        article: String(article).toUpperCase(),
        quantity,
        marketplace,
        locationDisplay,
        locationRaw,
        ip: ip || '',
        dateOnly: today,
        dateStr,
        timestamp: serverTimestamp()
    });
    
    return { success: true };
}

/**
 * Получение записей пользователя
 */
export async function getUserRecords(userId) {
    const snapshot = await getDB()
        .collection('pack_records')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .get();
    
    return snapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            article: data.article,
            quantity: data.quantity,
            marketplace: data.marketplace,
            locationDisplay: data.locationDisplay,
            ip: data.ip,
            dateOnly: data.dateOnly,
            dateStr: data.dateStr,
            userId: data.userId,
            userName: data.userName
        };
    });
}

/**
 * Удаление записи
 */
export async function deletePackRecord(id) {
    await deleteDoc('pack_records', id);
}

/**
 * Получение всех записей (с лимитом) — оставлено для обратной совместимости
 */
export async function getAllRecords(limitCount = 2000) {
    if (_allRecordsCache && Date.now() - _allRecordsCacheTime < ALL_RECORDS_TTL) {
        return _allRecordsCache;
    }
    const snapshot = await getDB()
        .collection('pack_records')
        .orderBy('timestamp', 'desc')
        .limit(limitCount)
        .get();
    
    const records = snapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            article: data.article,
            quantity: data.quantity,
            marketplace: data.marketplace,
            locationDisplay: data.locationDisplay,
            ip: data.ip,
            dateOnly: data.dateOnly,
            dateStr: data.dateStr,
            userId: data.userId,
            userName: data.userName
        };
    });
    _allRecordsCache = records;
    _allRecordsCacheTime = Date.now();
    return records;
}

/**
 * Получение записей за диапазон дат (вместо выгрузки всех 5000).
 * Фильтрует по dateOnly, а не по limit, чтобы не тащить лишнее по сети.
 * Кэшируется на 5 минут (RANGE_TTL).
 */
export async function getRecordsForRange(startStr, endStr) {
    const cacheKey = startStr + '_' + endStr;
    const cached = _rangeCache[cacheKey];
    if (cached && Date.now() - cached.time < RANGE_TTL) {
        return cached.records;
    }
    const snapshot = await getDB()
        .collection('pack_records')
        .where('dateOnly', '>=', startStr)
        .where('dateOnly', '<=', endStr)
        .orderBy('dateOnly')
        .get();
    
    const records = snapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            article: data.article,
            quantity: data.quantity,
            marketplace: data.marketplace,
            locationDisplay: data.locationDisplay,
            ip: data.ip,
            dateOnly: data.dateOnly,
            dateStr: data.dateStr,
            userId: data.userId,
            userName: data.userName
        };
    });
    _rangeCache[cacheKey] = { records, time: Date.now() };
    return records;
}

/**
 * Данные за вчера
 */
export async function getYesterdayData() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = formatDateISO(yesterday);
    const dateLabel = yesterday.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const snapshot = await getDB()
        .collection('pack_records')
        .where('dateOnly', '==', yStr)
        .get();
    
    const records = snapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            userId: data.userId,
            userName: data.userName,
            quantity: data.quantity,
            article: data.article
        };
    });
    
    return { date: dateLabel, records };
}

/**
 * Поиск записей по фильтру
 */
export async function searchRecords(filter) {
    let query = getDB().collection('pack_records');
    
    if (filter.userId) query = query.where('userId', '==', filter.userId);
    if (filter.date) query = query.where('dateOnly', '==', filter.date);
    if (filter.marketplace) query = query.where('marketplace', '==', filter.marketplace);
    if (filter.location) query = query.where('locationDisplay', '==', filter.location);
    
    query = query.orderBy('timestamp', 'desc');
    
    if (filter.limit) query = query.limit(filter.limit);
    
    const snapshot = await query.get();
    let records = snapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            article: data.article,
            quantity: data.quantity,
            marketplace: data.marketplace,
            locationDisplay: data.locationDisplay,
            ip: data.ip,
            dateOnly: data.dateOnly,
            dateStr: data.dateStr,
            userId: data.userId,
            userName: data.userName
        };
    });
    
    // Фильтр по артикулу (client-side, т.бо Firestore не поддерживает contains)
    if (filter.article) {
        const art = filter.article.toUpperCase();
        records = records.filter(r => (r.article || '').toUpperCase().includes(art));
    }
    
    return records;
}

/**
 * Расчёт статистики за сегодня
 */
export function calculateTodayStats(records) {
    const today = getTodayStr();
    const todayRecords = records.filter(r => r.dateOnly === today);
    const totalQty = todayRecords.reduce((s, r) => s + (r.quantity || 0), 0);
    const kv = getKV(totalQty);
    const rate = 2500 * kv / 1000;
    const salary = calcSalary(totalQty);
    
    return { totalQty, kv, rate, salary };
}