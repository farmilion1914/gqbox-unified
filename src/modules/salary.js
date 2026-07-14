// ==================== МОДУЛЬ РАСЧЁТА ЗАРПЛАТЫ ====================

import { getKV, calcSalary, DEFAULT_DAILY_RATE } from '../config.js';
import { getWeekMonday, getWeekSunday, formatDateISO, formatDateShort, formatDateFull, formatMonthYear } from '../utils/dates.js';
import { getOperatorEarningForPeriod } from './attendance.js';
import { getEmployees } from './auth.js';
import { queryWhere, getDB } from '../services/firebase.js';

// ===== СОСТОЯНИЕ =====
let salaryViewMode = 'week';
let salaryWeekOffset = 0;
let salaryMonthOffset = 0;
let allSalaryRecords = [];
let currentUserIsOperator = false;
let currentUserDailyRate = DEFAULT_DAILY_RATE;

/**
 * Инициализация расчёта зарплаты
 */
export function initSalary(records, isOperator, dailyRate) {
    allSalaryRecords = records;
    currentUserIsOperator = isOperator || false;
    currentUserDailyRate = dailyRate || DEFAULT_DAILY_RATE;
    salaryWeekOffset = 0;
    salaryMonthOffset = 0;
    salaryViewMode = 'week';
}

/**
 * Получение данных недели
 */
export function getWeekData(records, monday) {
    const sunday = getWeekSunday(monday);
    const mondayStr = formatDateISO(monday);
    const sundayStr = formatDateISO(sunday);
    
    const weekRecords = records.filter(r =>
        r.dateOnly >= mondayStr && r.dateOnly <= sundayStr
    );
    
    const totalQty = weekRecords.reduce((s, r) => s + (r.quantity || 0), 0);
    const kv = getKV(totalQty);
    const salary = 2500 * kv * totalQty / 1000;
    
    const days = {};
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        const ds = formatDateISO(d);
        days[ds] = { date: d, qty: 0 };
    }
    
    weekRecords.forEach(r => {
        if (days[r.dateOnly]) {
            days[r.dateOnly].qty += r.quantity;
        }
    });
    
    return {
        monday,
        sunday,
        totalQty,
        kv,
        salary,
        days: Object.values(days)
    };
}

/**
 * Получение данных месяца
 */
export function getMonthData(records, year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstStr = formatDateISO(firstDay);
    const lastStr = formatDateISO(lastDay);
    
    const monthRecords = records.filter(r =>
        r.dateOnly >= firstStr && r.dateOnly <= lastStr
    );
    
    const totalQty = monthRecords.reduce((s, r) => s + (r.quantity || 0), 0);
    
    // Разбивка по неделям
    const weeksData = [];
    let currentMonday = new Date(firstDay);
    const dayOfWeek = currentMonday.getDay();
    if (dayOfWeek !== 1) {
        currentMonday.setDate(currentMonday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    }
    
    while (currentMonday <= lastDay) {
        const wd = getWeekData(records, new Date(currentMonday));
        if (wd.totalQty > 0 || (wd.monday <= lastDay && wd.sunday >= firstDay)) {
            weeksData.push(wd);
        }
        currentMonday.setDate(currentMonday.getDate() + 7);
    }
    
    const avgKv = weeksData.length > 0
        ? weeksData.reduce((s, w) => s + w.kv, 0) / weeksData.length
        : 1.0;
    
    const workingDays = new Set(monthRecords.map(r => r.dateOnly)).size;
    
    let totalSalary = 0;
    weeksData.forEach(w => { totalSalary += w.salary; });
    
    return {
        firstDay,
        lastDay,
        totalQty,
        avgKv,
        workingDays,
        totalSalary,
        weeksData
    };
}

/**
 * Получение текущего понедельника недели
 */
export function getCurrentWeekMonday() {
    const now = new Date();
    const monday = getWeekMonday(now);
    monday.setDate(monday.getDate() + salaryWeekOffset * 7);
    return monday;
}

/**
 * Получение текущей даты месяца
 */
export function getCurrentMonthDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + salaryMonthOffset, 1);
}

/**
 * Рендер представления зарплаты
 */
export async function renderSalaryView() {
    if (salaryViewMode === 'week') {
        return await renderWeekView();
    } else {
        return await renderMonthView();
    }
}

/**
 * Рендер недельного представления
 */
async function renderWeekView() {
    const monday = getCurrentWeekMonday();
    const wd = getWeekData(allSalaryRecords, monday);
    const sundayStr = formatDateISO(wd.sunday);
    const mondayStr = formatDateISO(wd.monday);
    const today = new Date();
    const todayStr = formatDateISO(today);
    
    const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    
    let operatorEarnings = 0;
    let operatorDays = 0;
    
    if (currentUserIsOperator) {
        const { getSession } = await import('./auth.js');
        const session = getSession();
        if (session) {
            const result = await getOperatorEarningForPeriod(session.id, mondayStr, sundayStr);
            operatorDays = result.days;
            operatorEarnings = result.total;
        }
    }
    
    const packSalaryRounded = Math.round(wd.salary);
    const totalSalary = packSalaryRounded + operatorEarnings;
    
    // Распределяем зарплату упаковки по дням пропорционально количеству
    const daySalaries = distributeProportional(wd.salary, wd.days.map(d => d.qty));
    
    let html = '<div class="salary-view">';
    
    // Сегмент-контрол
    html += '<div class="salary-segment-control">';
    html += `<div class="salary-segment ${salaryViewMode === 'week' ? 'active' : ''}" data-mode="week">Неделя</div>`;
    html += `<div class="salary-segment ${salaryViewMode === 'month' ? 'active' : ''}" data-mode="month">Месяц</div>`;
    html += '</div>';
    
    // Навигация
    html += '<div class="salary-nav">';
    html += '<button class="salary-nav-btn nav-arrow" data-action="prev">◀</button>';
    html += `<span class="salary-nav-title">${formatDateShort(wd.monday)} – ${formatDateFull(wd.sunday)}</span>`;
    html += '<button class="salary-nav-btn nav-arrow" data-action="next">▶</button>';
    html += '</div>';
    
    // Сводка
    html += '<div class="salary-summary-card">';
    html += '<div class="salary-summary-row">';
    html += '<div class="salary-summary-dot"></div>';
    html += '<div class="salary-summary-text">';
    html += '<span class="salary-summary-label">Упаковано</span>';
    html += `<span class="salary-summary-value">${wd.totalQty} шт.</span>`;
    html += '</div></div>';
    
    html += '<div class="salary-summary-row">';
    html += '<div class="salary-summary-dot secondary"></div>';
    html += '<div class="salary-summary-text">';
    html += '<span class="salary-summary-label">Коэффициент</span>';
    html += `<span class="salary-summary-value">×${wd.kv.toFixed(1)}</span>`;
    html += '</div></div>';
    
    if (currentUserIsOperator) {
        html += '<div class="salary-summary-row">';
        html += '<div class="salary-summary-dot operator"></div>';
        html += '<div class="salary-summary-text">';
        html += '<span class="salary-summary-label">Выходы</span>';
        html += `<span class="salary-summary-value">${operatorDays} ${pluralize(operatorDays, 'день', 'дня', 'дней')} × ${currentUserDailyRate} ₽ = ${operatorEarnings.toFixed(2)} ₽</span>`;
        html += '</div></div>';
    }
    
    html += '<div class="salary-summary-divider"></div>';
    
    html += '<div class="salary-summary-row salary-summary-total">';
    html += '<div class="salary-summary-dot accent"></div>';
    html += '<div class="salary-summary-text">';
    html += '<span class="salary-summary-label">Зарплата</span>';
    html += `<span class="salary-summary-value">${totalSalary.toFixed(2)} ₽</span>`;
    html += '</div></div>';
    html += '</div>';
    
    // Таблица дней
    html += '<div class="salary-days-table">';
    html += '<div class="salary-days-header">';
    dayNames.forEach((name, i) => {
        const isToday = wd.days[i] && formatDateISO(wd.days[i].date) === todayStr;
        html += `<div class="salary-days-header-cell${isToday ? ' today' : ''}">${name}</div>`;
    });
    html += '</div>';
    
    html += '<div class="salary-days-row">';
    wd.days.forEach((day, i) => {
        const isToday = formatDateISO(day.date) === todayStr;
        const daySalary = daySalaries[i] || 0;
        html += `<div class="salary-day-cell${isToday ? ' today' : ''}">`;
        html += `<span class="salary-day-qty">${day.qty > 0 ? daySalary : '—'}</span>`;
        html += `<span class="salary-day-unit">${day.qty > 0 ? '₽' : ''}</span>`;
        html += `<span class="salary-day-unit">${day.qty > 0 ? day.qty + ' шт.' : ''}</span>`;
        html += '</div>';
    });
    html += '</div></div>';
    
    html += '</div>';
    
    return html;
}

/**
 * Рендер месячного представления
 */
async function renderMonthView() {
    const monthDate = getCurrentMonthDate();
    const md = getMonthData(allSalaryRecords, monthDate.getFullYear(), monthDate.getMonth());
    const firstStr = formatDateISO(md.firstDay);
    const lastStr = formatDateISO(md.lastDay);
    
    let operatorEarnings = 0;
    let operatorDays = 0;
    
    if (currentUserIsOperator) {
        const { getSession } = await import('./auth.js');
        const session = getSession();
        if (session) {
            const result = await getOperatorEarningForPeriod(session.id, firstStr, lastStr);
            operatorDays = result.days;
            operatorEarnings = result.total;
        }
    }
    
    const totalSalary = md.totalSalary + operatorEarnings;
    
    let html = '<div class="salary-view">';
    
    // Сегмент-контрол
    html += '<div class="salary-segment-control">';
    html += `<div class="salary-segment ${salaryViewMode === 'week' ? 'active' : ''}" data-mode="week">Неделя</div>`;
    html += `<div class="salary-segment ${salaryViewMode === 'month' ? 'active' : ''}" data-mode="month">Месяц</div>`;
    html += '</div>';
    
    // Навигация
    html += '<div class="salary-nav">';
    html += '<button class="salary-nav-btn nav-arrow" data-action="prev">◀</button>';
    html += `<span class="salary-nav-title">${formatMonthYear(monthDate)}</span>`;
    html += '<button class="salary-nav-btn nav-arrow" data-action="next">▶</button>';
    html += '</div>';
    
    // Сводка
    html += '<div class="salary-summary-card">';
    html += '<div class="salary-summary-row">';
    html += '<div class="salary-summary-dot"></div>';
    html += '<div class="salary-summary-text">';
    html += '<span class="salary-summary-label">Упаковано</span>';
    html += `<span class="salary-summary-value">${md.totalQty} шт.</span>`;
    html += '</div></div>';
    
    html += '<div class="salary-summary-row">';
    html += '<div class="salary-summary-dot secondary"></div>';
    html += '<div class="salary-summary-text">';
    html += '<span class="salary-summary-label">Средний КВ</span>';
    html += `<span class="salary-summary-value">×${md.avgKv.toFixed(2)}</span>`;
    html += '</div></div>';
    
    if (currentUserIsOperator) {
        html += '<div class="salary-summary-row">';
        html += '<div class="salary-summary-dot operator"></div>';
        html += '<div class="salary-summary-text">';
        html += '<span class="salary-summary-label">Выходы</span>';
        html += `<span class="salary-summary-value">${operatorDays} ${pluralize(operatorDays, 'день', 'дня', 'дней')} × ${currentUserDailyRate} ₽ = ${operatorEarnings.toFixed(2)} ₽</span>`;
        html += '</div></div>';
    } else {
        html += '<div class="salary-summary-row">';
        html += '<div class="salary-summary-dot secondary"></div>';
        html += '<div class="salary-summary-text">';
        html += '<span class="salary-summary-label">Рабочих дней</span>';
        html += `<span class="salary-summary-value">${md.workingDays} ${pluralize(md.workingDays, 'день', 'дня', 'дней')}</span>`;
        html += '</div></div>';
    }
    
    html += '<div class="salary-summary-divider"></div>';
    
    html += '<div class="salary-summary-row salary-summary-total">';
    html += '<div class="salary-summary-dot accent"></div>';
    html += '<div class="salary-summary-text">';
    html += '<span class="salary-summary-label">Зарплата</span>';
    html += `<span class="salary-summary-value">${totalSalary.toFixed(2)} ₽</span>`;
    html += '</div></div>';
    html += '</div>';
    
    html += '</div>';
    
    return html;
}

/**
 * Обновление представления зарплаты
 */
export async function refreshSalaryView(container) {
    if (!container) {
        container = document.getElementById('salaryContainer');
    }
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">Загрузка...</div>';
    
    try {
        container.innerHTML = await renderSalaryView();
    } catch (e) {
        container.innerHTML = renderSalaryView();
    }
    
    attachSalaryEvents();
}

/**
 * Привязка событий зарплаты
 */
export function attachSalaryEvents() {
    // Сегмент-контрол
    document.querySelectorAll('.salary-segment').forEach(seg => {
        seg.addEventListener('click', function() {
            const mode = this.dataset.mode;
            if (mode && mode !== salaryViewMode) {
                salaryViewMode = mode;
                refreshSalaryView();
            }
        });
    });
    
    // Навигация
    document.querySelectorAll('.salary-nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            if (salaryViewMode === 'week') {
                if (action === 'prev') salaryWeekOffset--;
                else if (action === 'next') salaryWeekOffset++;
            } else {
                if (action === 'prev') salaryMonthOffset--;
                else if (action === 'next') salaryMonthOffset++;
            }
            refreshSalaryView();
        });
    });
}

/**
 * Склонение числительных
 */
function pluralize(count, one, few, many) {
    if (count % 10 === 1 && count % 100 !== 11) return one;
    if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return few;
    return many;
}

/**
 * Пропорциональное распределение суммы по весам с округлением до целых
 */
function distributeProportional(total, weights) {
    const roundedTotal = Math.round(total);
    const sumWeights = weights.reduce((s, w) => s + w, 0);
    if (sumWeights <= 0) return weights.map(() => 0);

    const exact = weights.map(w => total * (w / sumWeights));
    const floors = exact.map(e => Math.floor(e));
    let remainder = roundedTotal - floors.reduce((s, f) => s + f, 0);

    const indices = exact.map((e, i) => i)
        .sort((a, b) => (exact[b] - floors[b]) - (exact[a] - floors[a]));

    const result = floors.slice();
    for (let k = 0; k < remainder && k < indices.length; k++) {
        result[indices[k]]++;
    }
    return result;
}

// ===== ОБЩАЯ ЗАРПЛАТА (АДМИН) =====

let totalSalaryViewMode = 'period';
let totalSalaryWeekOffset = 0;
let totalSalaryMonthOffset = 0;

/**
 * Расчёт общей зарплаты за период
 */
export async function calculateTotalSalaryForPeriod(startStr, endStr) {
    const emps = await getEmployees();
    const workers = emps.filter(e => e.role === 'user' || e.role === 'operator' || e.role === 'packer');

    // Вместо N+1 запросов (по одному на каждого сотрудника) делаем
    // всего 2 запроса за период и группируем на клиенте (пункт 5)
    const packSnap = await getDB()
        .collection('pack_records')
        .where('dateOnly', '>=', startStr)
        .where('dateOnly', '<=', endStr)
        .get();

    const qtyByUser = {};
    packSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.userId) return;
        qtyByUser[data.userId] = (qtyByUser[data.userId] || 0) + (data.quantity || 0);
    });

    const attSnap = await getDB()
        .collection('attendance')
        .where('date', '>=', startStr)
        .where('date', '<=', endStr)
        .get();

    const attByUser = {};
    attSnap.docs.forEach(d => {
        const data = d.data();
        if (!data.userId) return;
        if (!attByUser[data.userId]) attByUser[data.userId] = new Set();
        attByUser[data.userId].add(data.date);
    });

    const byUser = {};
    let totalQty = 0;
    let totalPackerSalary = 0;
    let totalOperatorDays = 0;
    let totalOperatorEarnings = 0;

    for (const emp of workers) {
        const empQty = qtyByUser[emp.id] || 0;
        totalQty += empQty;

        const kv = getKV(empQty);
        const empSalary = 2500 * kv * empQty / 1000;
        totalPackerSalary += empSalary;

        let operatorEarn = 0;
        let opDays = 0;
        if (emp.role === 'operator') {
            const dailyRate = emp.dailyRate || DEFAULT_DAILY_RATE;
            opDays = attByUser[emp.id] ? attByUser[emp.id].size : 0;
            operatorEarn = opDays * dailyRate;
            totalOperatorDays += opDays;
            totalOperatorEarnings += operatorEarn;
        }

        if (empQty > 0 || opDays > 0) {
            byUser[emp.id] = {
                qty: empQty,
                packSalary: empSalary,
                operatorEarnings: operatorEarn,
                total: empSalary + operatorEarn
            };
        }
    }

    return {
        totalQty,
        totalPackerSalary,
        totalOperatorDays,
        totalOperatorEarnings,
        totalSalary: totalPackerSalary + totalOperatorEarnings,
        byUser
    };
}

/**
 * Рендер результата общей зарплаты
 */
export function renderTotalSalaryResult(data, periodLabel, periodStr) {
    return `
        <div class="salary-result-card">
            <div class="salary-result-header">
                <span class="emp-name">Общая зарплата ${periodLabel}</span>
                <span class="period">${periodStr}</span>
            </div>
            <div class="salary-breakdown">
                <div class="salary-row salary-pack">
                    <span class="row-label">Всего упаковано</span>
                    <span class="row-value">${data.totalQty} шт.</span>
                </div>
                <div class="salary-row salary-pack">
                    <span class="row-label">Упаковка</span>
                    <span class="row-value">${data.totalPackerSalary.toFixed(2)} руб.</span>
                </div>
                <div class="salary-row salary-attendance">
                    <span class="row-label">Выходы (операторы)</span>
                    <span class="row-value">${data.totalOperatorDays} дн. → ${data.totalOperatorEarnings.toFixed(2)} руб.</span>
                </div>
                <div class="salary-row salary-total">
                    <span class="row-label">ОБЩАЯ ЗАРПЛАТА</span>
                    <span class="row-value">${data.totalSalary.toFixed(2)} руб.</span>
                </div>
            </div>
        </div>
    `;
}