// ==================== АДМИН-СКЛАД (АДАПТЕР) ====================

import { getWarehouseDB } from '../services/firebase.js';
import { toast } from '../services/toast.js';
import { esc } from '../utils/helpers.js';
import { getTodayStr, formatDateForInput, formatDateForDisplay } from '../utils/dates.js';
import { ADMIN_LOGS_PAGE_SIZE } from '../config.js';
import { getEmployees } from './auth.js';

let _adminLogsCurrentPage = 1;
let _adminLogsAllDocs = [];

// ===== ЛОГИ =====
export async function loadAdminLogs(page) {
    const container = document.getElementById('adminLogsContainer');
    if (!container) return;

    page = page || 1;
    _adminLogsCurrentPage = page;
    container.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

    try {
        const snap = await getWarehouseDB().collection('work_logs')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        _adminLogsAllDocs = snap.docs;

        if (snap.empty) {
            container.innerHTML = '<div class="empty-state">Нет записей</div>';
            return;
        }

        const totalPages = Math.ceil(_adminLogsAllDocs.length / ADMIN_LOGS_PAGE_SIZE) || 1;
        const startIdx = (page - 1) * ADMIN_LOGS_PAGE_SIZE;
        const pageDocs = _adminLogsAllDocs.slice(startIdx, startIdx + ADMIN_LOGS_PAGE_SIZE);

        let html = '<div class="ios-list">';

        pageDocs.forEach(d => {
            const log = d.data();
            const time = log.timestamp
                ? new Date(log.timestamp.toDate()).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—';

            html += `
                <div class="ios-list-item ios-log-item">
                    <div class="item-leading">${time}</div>
                    <div class="item-body">
                        <div class="item-title">${esc(log.action)}: ${esc(log.details)}</div>
                        <div class="item-subtitle">
                            ${esc(log.userName || '—')}
                            <span class="log-warehouse-tag">${esc(log.warehouse || '—')}</span>
                        </div>
                    </div>
                </div>`;
        });

        html += '</div>';

        if (totalPages > 1) {
            html += '<div class="pagination">';
            for (let i = 1; i <= totalPages; i++) {
                html += `<button class="page-btn${i === page ? ' active' : ''}" data-logs-page="${i}">${i}</button>`;
            }
            html += `<span class="page-info">${page} / ${totalPages}</span>`;
            html += '</div>';
        }

        container.innerHTML = html;

        // Привязываем события пагинации
        container.querySelectorAll('[data-logs-page]').forEach(btn => {
            btn.onclick = () => loadAdminLogs(parseInt(btn.dataset.logsPage));
        });

    } catch (e) {
        container.innerHTML = '<div class="empty-state" style="color:#ff3b30;">Ошибка загрузки</div>';
    }
}

// ===== СОТРУДНИКИ СКЛАДА (заглушка) =====
export async function loadAdminEmployees() {
    // Будет реализовано позже
}

// ===== ОТЧЁТЫ (заглушка) =====
export async function generateReport() {
    // Будет реализовано позже
}

// ===== ЗАРПЛАТА СКЛАДА (заглушка) =====
export async function loadAdminSalary() {
    // Будет реализовано позже
}