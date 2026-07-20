// ==================== АДМИН-СКЛАД ====================

import { getWarehouseDB } from '../services/firebase.js';
import { toast } from '../services/toast.js';
import { esc, escAttr } from '../utils/helpers.js';
import { getTodayStr, formatDateForDisplay, getMonthStart, getMonthEnd, getWeekStart, getWeekEnd } from '../utils/dates.js';
import { ADMIN_LOGS_PAGE_SIZE } from '../config.js';
import { getEmployeesCached } from './auth.js';

let _adminLogsCurrentPage = 1;
let _adminLogsAllDocs = [];

// ===== ВСПОМОГАТЕЛЬНАЯ: ПОЛУЧИТЬ КЛАДОВЩИКОВ =====
async function getWarehouseEmployees() {
    // Грузим напрямую из БД склада, чтобы наверняка получить warehouseRole
    const snap = await getWarehouseDB().collection('employees')
        .orderBy('name')
        .get();
    const emps = [];
    snap.docs.forEach(d => {
        const data = d.data();
        // Только те, у кого есть warehouseRole
        if (data.warehouseRole) {
            emps.push({ id: d.id, name: data.name || 'Без имени', warehouseRole: data.warehouseRole });
        }
    });
    return emps;
}

// ===== ЛОГИ С ФИЛЬТРОМ ПО СОТРУДНИКУ =====
export async function loadAdminLogs(page, filterUserId = '') {
    const container = document.getElementById('adminLogsContainer');
    if (!container) return;

    page = page || 1;
    _adminLogsCurrentPage = page;
    container.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

    try {
        const emps = await getWarehouseEmployees();

        // Грузим последние логи без orderBy по timestamp (чтобы не требовать индекс)
        // orderBy('timestamp', 'desc') без фильтра требует составной индекс — берём все, сортируем на клиенте
        const snap = await getWarehouseDB().collection('work_logs')
            .limit(300)
            .get();

        _adminLogsAllDocs = snap.docs;

        // Сортируем на клиенте по timestamp desc
        _adminLogsAllDocs.sort((a, b) => {
            const ta = a.data().timestamp?.toMillis?.() || 0;
            const tb = b.data().timestamp?.toMillis?.() || 0;
            return tb - ta;
        });

        // Фильтр по сотруднику
        let filteredDocs = _adminLogsAllDocs;
        if (filterUserId) {
            filteredDocs = _adminLogsAllDocs.filter(d => d.data().userId === filterUserId);
        }

        if (filteredDocs.length === 0) {
            container.innerHTML = `
                <div class="logs-filter-bar">
                    <select class="input-field" id="logsEmpFilter" style="width:100%;">
                        <option value="">Все сотрудники</option>
                        ${emps.map(e => `<option value="${escAttr(e.id)}" ${e.id === filterUserId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="empty-state">Нет записей</div>
            `;
            bindLogsFilter();
            return;
        }

        const totalPages = Math.ceil(filteredDocs.length / ADMIN_LOGS_PAGE_SIZE) || 1;
        const startIdx = (page - 1) * ADMIN_LOGS_PAGE_SIZE;
        const pageDocs = filteredDocs.slice(startIdx, startIdx + ADMIN_LOGS_PAGE_SIZE);

        let html = `
            <div class="logs-filter-bar">
                <select class="input-field" id="logsEmpFilter" style="width:100%;">
                    <option value="">Все сотрудники</option>
                    ${emps.map(e => `<option value="${escAttr(e.id)}" ${e.id === filterUserId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
                </select>
            </div>
            <div class="ios-list">
        `;

        pageDocs.forEach(d => {
            const log = d.data();
            const time = log.timestamp
                ? new Date(log.timestamp.toDate()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—';

            const actionClass = log.action?.indexOf('Собрал паллеты') >= 0 ? 'action-collect' :
                                log.action?.indexOf('Выкладка') >= 0 ? 'action-lay' :
                                log.action?.indexOf('Принял') >= 0 ? 'action-receive' :
                                log.action?.indexOf('Отгрузил') >= 0 ? 'action-ship' : '';

            html += `
                <div class="ios-list-item ios-log-item ${actionClass}">
                    <div class="item-leading">${time}</div>
                    <div class="item-body">
                        <div class="item-title">${esc(log.action || '—')}</div>
                        <div class="item-subtitle">
                            ${esc(log.userName || '—')}
                            ${log.warehouse ? `<span class="log-warehouse-tag">${esc(log.warehouse)}</span>` : ''}
                            ${log.quantity ? `<span class="log-qty-tag">${log.quantity} ${log.unit || ''}</span>` : ''}
                        </div>
                    </div>
                </div>`;
        });

        html += '</div>';

        if (totalPages > 1) {
            html += `<div class="pagination">`;
            html += `<button class="page-btn page-nav" data-logs-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>←</button>`;
            for (let i = 1; i <= totalPages; i++) {
                html += `<button class="page-btn${i === page ? ' active' : ''}" data-logs-page="${i}">${i}</button>`;
            }
            html += `<button class="page-btn page-nav" data-logs-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>→</button>`;
            html += '</div>';
        }

        container.innerHTML = html;
        bindLogsFilter();
        bindLogsPagination(filterUserId);

    } catch (e) {
        console.error('loadAdminLogs error:', e);
        container.innerHTML = '<div class="empty-state" style="color:#ff3b30;">Ошибка загрузки: ' + esc(e.message) + '</div>';
    }
}

function bindLogsFilter() {
    const filter = document.getElementById('logsEmpFilter');
    if (filter) {
        filter.addEventListener('change', function() {
            loadAdminLogs(1, this.value);
        });
    }
}

function bindLogsPagination(filterUserId) {
    const container = document.getElementById('adminLogsContainer');
    if (!container) return;
    container.querySelectorAll('[data-logs-page]').forEach(btn => {
        btn.onclick = () => loadAdminLogs(parseInt(btn.dataset.logsPage), filterUserId || '');
    });
}

// ===== ОТЧЁТ ПО СОТРУДНИКУ =====
export async function initAdminWarehouseReports() {
    const container = document.getElementById('adminWarehouseReports');
    if (!container) return;
    const today = getTodayStr();

    const emps = await getWarehouseEmployees();
    const empOptions = emps.map(e => `<option value="${escAttr(e.id)}">${esc(e.name)}</option>`).join('');

    container.innerHTML = `
        <div class="report-filters">
            <select class="input-field" id="reportEmployee" style="width:100%;">
                <option value="">— Выберите сотрудника —</option>
                ${empOptions}
            </select>
            <div class="report-date-row">
                <input type="date" class="input-field" id="reportStartDate" value="${getMonthStart(today)}" style="flex:1;">
                <input type="date" class="input-field" id="reportEndDate" value="${getMonthEnd(today)}" style="flex:1;">
            </div>
            <button id="reportGenerateBtn" class="btn-primary" style="width:100%;">Сформировать отчёт</button>
        </div>
        <div id="adminReportResult"></div>
    `;

    document.getElementById('reportGenerateBtn').onclick = async () => {
        const userId = document.getElementById('reportEmployee')?.value;
        const start = document.getElementById('reportStartDate')?.value;
        const end = document.getElementById('reportEndDate')?.value;
        const resultDiv = document.getElementById('adminReportResult');
        if (!userId) { toast.warning('Выберите сотрудника'); return; }
        if (!start || !end) { toast.warning('Выберите даты'); return; }
        resultDiv.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

        try {
            const { calculateAllSalaries } = await import('./salary-warehouse.js');
            const empSnap = await getWarehouseDB().collection('employees').doc(userId).get();
            const emp = empSnap.exists ? { id: userId, name: empSnap.data().name, warehouseRole: empSnap.data().warehouseRole || 'standard' } : { id: userId, name: 'Неизвестный', warehouseRole: 'standard' };
            
            const { salaryByUser } = await calculateAllSalaries(start, end);
            const data = salaryByUser[userId];

            if (!data || (!data.total && !data.attendance && !data.kpi)) {
                resultDiv.innerHTML = '<div class="empty-state">Нет данных за выбранный период</div>';
                return;
            }

            let detailHtml = '';

            // Выходы
            if (data.attendance) {
                const whNames = Object.keys(data.attendance);
                detailHtml += `<div class="report-section-title">📅 Выходы</div>`;
                whNames.forEach(wh => {
                    const a = data.attendance[wh];
                    detailHtml += `
                        <div class="salary-detail-row">
                            <span class="salary-detail-label">${esc(wh)}</span>
                            <span class="salary-detail-value">${a.days} дн. × ${Math.round(a.amount / a.days).toLocaleString('ru-RU')} ₽ = ${a.amount.toLocaleString('ru-RU')} ₽</span>
                        </div>`;
                });
            }

            // KPI
            if (data.kpi) {
                if (data.kpi.collect && data.kpi.collect.qty > 0) {
                    detailHtml += `<div class="report-section-title">📦 Сборка паллет</div>`;
                    detailHtml += `
                        <div class="salary-detail-row">
                            <span class="salary-detail-label">Собрано паллет</span>
                            <span class="salary-detail-value">${data.kpi.collect.qty.toLocaleString('ru-RU')} шт × 100 ₽ = ${data.kpi.collect.amount.toLocaleString('ru-RU')} ₽</span>
                        </div>`;
                }
                if (data.kpi.lay && data.kpi.lay.qty > 0) {
                    detailHtml += `<div class="report-section-title">📋 Выкладка товара</div>`;
                    detailHtml += `
                        <div class="salary-detail-row">
                            <span class="salary-detail-label">Выложено товара</span>
                            <span class="salary-detail-value">${data.kpi.lay.qty.toLocaleString('ru-RU')} ед. × 0.10 ₽ = ${data.kpi.lay.amount.toLocaleString('ru-RU')} ₽</span>
                        </div>`;
                }
            }

            if (!detailHtml) {
                detailHtml = '<div style="text-align:center;padding:16px;color:var(--text-secondary);">Только выходы без операций</div>';
            }

            resultDiv.innerHTML = `
                <div class="report-result-card">
                    <div class="report-result-header">
                        <div class="report-result-avatar">${(emp.name || '?')[0].toUpperCase()}</div>
                        <div class="report-result-info">
                            <div class="report-result-name">${esc(emp.name)}</div>
                            <div class="report-result-period">${formatDateForDisplay(start)} — ${formatDateForDisplay(end)}</div>
                        </div>
                        <div class="report-result-total">${(data.total || 0).toLocaleString('ru-RU')} ₽</div>
                    </div>
                    <div class="report-result-details">
                        ${detailHtml}
                    </div>
                </div>
            `;
        } catch (e) {
            resultDiv.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка: ${esc(e.message)}</div>`;
        }
    };
}