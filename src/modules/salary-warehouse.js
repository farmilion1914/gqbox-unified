// ==================== МОДУЛЬ ЗАРПЛАТЫ (СКЛАД) ====================

import { getWarehouseDB } from '../services/firebase.js';
import { getTodayStr, getWeekRange, getMonthRange, formatDateForDisplay, getMonthName } from '../utils/dates.js';
import { esc } from '../utils/helpers.js';
import { getCurrentUser, getEmployees, getEmployeesCached } from './auth.js';
import { getWarehouseRoleRate, getWarehouseRoleLabel, KPI_RATES } from '../config.js';

// ===== КЭШ =====
let _salaryCache = {};

export function invalidateSalaryCache() { _salaryCache = {}; }

export async function calculateSalary(userId, warehouseRole, startDate, endDate) {
    const cacheKey = userId + '_' + startDate + '_' + endDate;
    if (_salaryCache[cacheKey]) return _salaryCache[cacheKey];

    const dayRate = getWarehouseRoleRate(warehouseRole);

    const attSnap = await getWarehouseDB().collection('attendance')
        .where('userId', '==', userId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

    const attendanceByWarehouse = {};
    attSnap.docs.forEach(doc => {
        const data = doc.data();
        const wh = data.warehouse;
        if (!attendanceByWarehouse[wh]) attendanceByWarehouse[wh] = new Set();
        attendanceByWarehouse[wh].add(data.date);
    });

    const attendance = {};
    let total = 0;
    Object.keys(attendanceByWarehouse).forEach(wh => {
        const days = attendanceByWarehouse[wh].size;
        const amount = days * dayRate;
        attendance[wh] = { days, amount };
        total += amount;
    });

    const logsSnap = await getWarehouseDB().collection('work_logs')
        .where('userId', '==', userId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

    const kpi = [];
    const kpiAgg = {};

    logsSnap.docs.forEach(doc => {
        const log = doc.data();
        const qty = log.quantity || 0;

        if (log.action && log.action.indexOf('Собрал паллеты') >= 0 && qty > 0) {
            if (!kpiAgg.collect) kpiAgg.collect = { qty: 0, amount: 0 };
            kpiAgg.collect.qty += qty;
            kpiAgg.collect.amount += Math.round(qty * KPI_RATES.collect.rate);
        }
        if (log.action && log.action.indexOf('Выкладка товара') >= 0 && qty > 0) {
            if (!kpiAgg.lay) kpiAgg.lay = { qty: 0, amount: 0 };
            kpiAgg.lay.qty += qty;
            kpiAgg.lay.amount += Math.round(qty * KPI_RATES.lay.rate * 100) / 100;
        }
    });

    if (kpiAgg.collect) {
        kpi.push({ reason: KPI_RATES.collect.label, qty: kpiAgg.collect.qty, amount: kpiAgg.collect.amount, unit: KPI_RATES.collect.unit });
        total += kpiAgg.collect.amount;
    }
    if (kpiAgg.lay) {
        kpi.push({ reason: KPI_RATES.lay.label, qty: kpiAgg.lay.qty, amount: kpiAgg.lay.amount, unit: KPI_RATES.lay.unit });
        total += kpiAgg.lay.amount;
    }

    const result = { total: Math.round(total), attendance, kpi };
    _salaryCache[cacheKey] = result;
    return result;
}

export async function getDailyRanking(dateStr) {
    const allEmps = await getEmployeesCached();
    const emps = allEmps.filter(e => e.active !== false && e.warehouseRole !== 'senior');

    const logsSnap = await getWarehouseDB().collection('work_logs').where('date', '==', dateStr).get();
    const kpi = {};

    logsSnap.docs.forEach(doc => {
        const log = doc.data();
        const uid = log.userId;
        const qty = log.quantity || 0;
        if (!uid) return;
        if (!kpi[uid]) kpi[uid] = { total: 0 };
        if (log.action && log.action.indexOf('Собрал паллеты') >= 0 && qty > 0) {
            kpi[uid].total += Math.round(qty * KPI_RATES.collect.rate);
        }
        if (log.action && log.action.indexOf('Выкладка товара') >= 0 && qty > 0) {
            kpi[uid].total += Math.round(qty * KPI_RATES.lay.rate * 100) / 100;
        }
    });

    const ranking = emps.map(e => ({
        id: e.id,
        name: e.name,
        total: Math.round((kpi[e.id] || { total: 0 }).total)
    }));

    ranking.sort((a, b) => b.total - a.total);
    return ranking.filter(item => item.total > 0).slice(0, 3);
}

export async function getPeriodRanking(startDate, endDate) {
    const allEmps = await getEmployeesCached();
    const emps = allEmps.filter(e => e.active !== false && e.warehouseRole !== 'senior');

    const logsSnap = await getWarehouseDB().collection('work_logs')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

    const kpi = {};
    logsSnap.docs.forEach(doc => {
        const log = doc.data();
        const uid = log.userId;
        const qty = log.quantity || 0;
        if (!uid) return;
        if (!kpi[uid]) kpi[uid] = { total: 0 };
        if (log.action && log.action.indexOf('Собрал паллеты') >= 0 && qty > 0) {
            kpi[uid].total += Math.round(qty * KPI_RATES.collect.rate);
        }
        if (log.action && log.action.indexOf('Выкладка товара') >= 0 && qty > 0) {
            kpi[uid].total += Math.round(qty * KPI_RATES.lay.rate * 100) / 100;
        }
    });

    const ranking = emps.map(e => ({
        id: e.id,
        name: e.name,
        total: Math.round((kpi[e.id] || { total: 0 }).total)
    }));

    ranking.sort((a, b) => b.total - a.total);
    return ranking.filter(item => item.total > 0).slice(0, 3);
}

export async function calculateAllSalaries(startDate, endDate) {
    const empSnap = await getWarehouseDB().collection('employees').orderBy('name').get();
    const empMap = {};
    empSnap.docs.forEach(d => {
        empMap[d.id] = { id: d.id, name: d.data().name, warehouseRole: d.data().warehouseRole || 'standard' };
    });

    const logsSnap = await getWarehouseDB().collection('work_logs')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

    const attSnap = await getWarehouseDB().collection('attendance')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

    const salaryByUser = {};
    const attByUser = {};

    attSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!attByUser[data.userId]) attByUser[data.userId] = {};
        if (!attByUser[data.userId][data.warehouse]) attByUser[data.userId][data.warehouse] = new Set();
        attByUser[data.userId][data.warehouse].add(data.date);
    });

    Object.keys(attByUser).forEach(uid => {
        if (!salaryByUser[uid]) salaryByUser[uid] = { attendance: {}, kpi: {}, total: 0 };
        const emp = empMap[uid] || { warehouseRole: 'standard' };
        const dayRate = getWarehouseRoleRate(emp.warehouseRole);
        Object.keys(attByUser[uid]).forEach(wh => {
            const days = attByUser[uid][wh].size;
            const amount = days * dayRate;
            salaryByUser[uid].attendance[wh] = { days, amount };
            salaryByUser[uid].total += amount;
        });
    });

    logsSnap.docs.forEach(doc => {
        const log = doc.data();
        const uid = log.userId;
        const qty = log.quantity || 0;
        if (!uid) return;
        if (!salaryByUser[uid]) salaryByUser[uid] = { attendance: {}, kpi: {}, total: 0 };
        if (log.action && log.action.indexOf('Собрал паллеты') >= 0 && qty > 0) {
            if (!salaryByUser[uid].kpi.collect) salaryByUser[uid].kpi.collect = { qty: 0, amount: 0 };
            salaryByUser[uid].kpi.collect.qty += qty;
            salaryByUser[uid].kpi.collect.amount += Math.round(qty * KPI_RATES.collect.rate);
            salaryByUser[uid].total += Math.round(qty * KPI_RATES.collect.rate);
        }
        if (log.action && log.action.indexOf('Выкладка товара') >= 0 && qty > 0) {
            if (!salaryByUser[uid].kpi.lay) salaryByUser[uid].kpi.lay = { qty: 0, amount: 0 };
            salaryByUser[uid].kpi.lay.qty += qty;
            salaryByUser[uid].kpi.lay.amount += Math.round(qty * KPI_RATES.lay.rate * 100) / 100;
            salaryByUser[uid].total += Math.round(qty * KPI_RATES.lay.rate * 100) / 100;
        }
    });

    return { salaryByUser, empMap };
}

export default { calculateSalary, getDailyRanking, getPeriodRanking, calculateAllSalaries, invalidateSalaryCache };