// ==================== МОДУЛЬ ПОСЕЩАЕМОСТИ ====================

import { collection, queryWhere, addDoc, getDoc, serverTimestamp, getDB, getWarehouseDB } from '../services/firebase.js';
import { getTodayStr, getWeekMonday, getWeekSunday, formatDateISO } from '../utils/dates.js';
import { getDailyRate } from './auth.js';
import { DEFAULT_DAILY_RATE } from '../config.js';

// ===== УПАКОВЩИЦЫ =====

export async function checkIn(userId, userName, role) {
    const today = getTodayStr();
    const existing = await queryWhere('attendance', 'userId', '==', userId);
    const todayRecord = existing.find(a => a.date === today);
    
    if (todayRecord) {
        return { success: false, message: 'Вы уже отметились сегодня' };
    }
    
    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    await addDoc('attendance', {
        userId,
        userName,
        role,
        date: today,
        time,
        timestamp: serverTimestamp()
    });
    
    let earned = 0;
    if (role === 'operator') {
        // Берём ставку из документа сотрудника (если есть), иначе DEFAULT
        const { getEmployeesCached } = await import('./auth.js');
        const emps = await getEmployeesCached();
        const emp = emps.find(e => e.id === userId);
        const rate = (emp && emp.dailyRate) ? emp.dailyRate : DEFAULT_DAILY_RATE;
        earned = rate;
        await addDoc('operator_earnings', {
            userId,
            userName,
            date: today,
            amount: rate,
            type: 'attendance',
            timestamp: serverTimestamp()
        });
    }
    
    return { success: true, message: 'Отметка поставлена', earned };
}

export async function hasCheckedIn(userId) {
    const today = getTodayStr();
    
    // Проверяем в базе упаковщиц
    const items = await queryWhere('attendance', 'userId', '==', userId);
    const packingChecked = items.some(a => a.date === today);
    
    // Проверяем в базе кладовщиков
    let moscow = false;
    let pushkino = false;
    try {
        const whSnap = await getWarehouseDB().collection('attendance')
            .where('userId', '==', userId)
            .where('date', '==', today)
            .get();
        moscow = whSnap.docs.some(d => d.data().warehouse === 'Москва');
        pushkino = whSnap.docs.some(d => d.data().warehouse === 'Пушкино');
    } catch (e) {}

    return {
        moscow,
        pushkino,
        checked: packingChecked || moscow || pushkino
    };
}

export async function getTodayAttendance() {
    const today = getTodayStr();
    const snapshot = await getDB()
        .collection('attendance')
        .where('date', '==', today)
        .orderBy('time')
        .limit(1000)
        .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
}

export async function loadAttendanceData(startDate, endDate) {
    const snapshot = await getDB()
        .collection('attendance')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date')
        .orderBy('time')
        .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getWeekAttendance() {
    const monday = formatDateISO(getWeekMonday(new Date()));
    const sunday = formatDateISO(getWeekSunday(new Date()));
    const snapshot = await getDB()
        .collection('attendance')
        .where('date', '>=', monday)
        .where('date', '<=', sunday)
        .orderBy('date')
        .orderBy('time')
        .limit(5000)
        .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAttendanceForPeriod(startDate, endDate) {
    return loadAttendanceData(startDate, endDate);
}

export async function getOperatorEarningForPeriod(userId, startStr, endStr) {
    const snapshot = await getDB()
        .collection('operator_earnings')
        .where('userId', '==', userId)
        .where('date', '>=', startStr)
        .where('date', '<=', endStr)
        .get();
    
    const records = snapshot.docs.map(d => d.data());
    const total = records.reduce((s, r) => s + (r.amount || 0), 0);
    const days = new Set(records.map(r => r.date)).size;
    
    return { total, days };
}

export async function getOperatorTodayEarning(userId) {
    const today = getTodayStr();
    const result = await getOperatorEarningForPeriod(userId, today, today);
    return result.total;
}

// ===== КЛАДОВЩИКИ =====

export async function markAttendance(warehouse) {
    const { getSession } = await import('./auth.js');
    const user = getSession();
    if (!user) return { success: false, message: 'Не авторизован' };

    const today = getTodayStr();

    const existing = await getWarehouseDB().collection('attendance')
        .where('userId', '==', user.id)
        .where('date', '==', today)
        .where('warehouse', '==', warehouse)
        .get();

    if (!existing.empty) {
        return { success: false, message: 'Уже отмечены на ' + warehouse };
    }

    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    await getWarehouseDB().collection('attendance').add({
        userId: user.id,
        userName: user.name,
        warehouse,
        date: today,
        time,
        timestamp: serverTimestamp()
    });

    await getWarehouseDB().collection('work_logs').add({
        userId: user.id,
        userName: user.name,
        warehouse,
        action: 'Работал на складе',
        details: 'Отметка присутствия',
        date: today,
        timestamp: serverTimestamp()
    });

    return { success: true };
}