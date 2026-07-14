// ==================== ЕДИНАЯ АДМИН-ПАНЕЛЬ ====================

import { toast } from '../services/toast.js';
import { esc } from '../utils/helpers.js';
import { getSession } from './auth.js';

let currentAdminTab = 'dashboard';

// ===== SVG-ИКОНКИ (вместо эмодзи) =====
const ICONS = {
    dashboard: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>',
    packing: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 3v10M10 3v10" stroke="currentColor" stroke-width="1.5"/><path d="M2 7h12" stroke="currentColor" stroke-width="1.5"/></svg>',
    warehouse: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14V6l6-4 6 4v8" stroke="currentColor" stroke-width="1.5"/><path d="M5 14V9h6v5" stroke="currentColor" stroke-width="1.5"/></svg>',
    users: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="11" cy="5" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M1 14c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" stroke-width="1.5"/><path d="M8.5 10h4c1.5 0 2.5 1 2.5 2.5" stroke="currentColor" stroke-width="1.5"/></svg>',
    crown: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 16l2-11 4 3 4-3 2 11H4z" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="5" r="1" fill="currentColor"/><circle cx="10" cy="8" r="1" fill="currentColor"/><circle cx="14" cy="5" r="1" fill="currentColor"/></svg>',
    logout: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2H3v12h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" stroke-width="1.5"/></svg>',
    add: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="3.5" stroke="currentColor" stroke-width="1.5"/><path d="M9 9l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5 4V2h4v2M5.5 7v3M8.5 7v3M2 4h10l-1 10H3L2 4z" stroke="currentColor" stroke-width="1.2"/></svg>',
    toggleOn: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M5 7h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    toggleOff: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    chevronDown: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    trendUp: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 10l4-5 3 3 4-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 3h-3" stroke="currentColor" stroke-width="1.5"/></svg>',
    trendDown: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l4 5 3-3 4 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 10h-3" stroke="currentColor" stroke-width="1.5"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3M8 10.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
};

// ===== РЕНДЕР АДМИН-ПАНЕЛИ =====
export async function renderAdminPanel(user) {
    return `
        <div class="app-container admin-screen">
            <div class="glass-card dashboard">
                <div class="header-dash">
                    <div class="header-top-row">
                        <div class="user-block">
                            <div class="user-avatar">${ICONS.crown}</div>
                            <div class="user-info">
                                <div class="user-name">Админ: ${esc(user.name)}</div>
                                <div class="user-role">Управление</div>
                            </div>
                        </div>
                        <div class="actions-block">
                            <button class="theme-toggle-btn" id="themeToggleBtn" aria-label="Тема">◐</button>
                            <button id="logoutBtn" class="header-btn danger" aria-label="Выход">${ICONS.logout}</button>
                        </div>
                    </div>
                </div>

                <!-- Табы -->
                <div class="ios-segmented-control admin-segments">
                    <button class="ios-segment active" data-admin-tab="dashboard">Дашборд</button>
                    <button class="ios-segment" data-admin-tab="packing">Упаковка</button>
                    <button class="ios-segment" data-admin-tab="warehouse">Склад</button>
                    <button class="ios-segment" data-admin-tab="photos">Фото</button>
                    <button class="ios-segment" data-admin-tab="users">Сотрудники</button>
                </div>

                <!-- Контейнеры табов -->
                <div id="adminTabDashboard"></div>
                <div id="adminTabPacking" style="display:none;"></div>
                <div id="adminTabWarehouse" style="display:none;"></div>
                <div id="adminTabPhotos" style="display:none;"></div>
                <div id="adminTabUsers" style="display:none;"></div>
            </div>
            <!-- Нижний таб-бар (как у упаковщиц) -->
            <div class="ios-tab-bar">
                <button class="ios-tab-item active" data-admin-tab="dashboard">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="12" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="2" y="12" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="12" y="12" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>
                    <span>Дашборд</span>
                </button>
                <button class="ios-tab-item" data-admin-tab="packing">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="4" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 4v14M14 4v14" stroke="currentColor" stroke-width="1.8"/><path d="M3 9.5h16" stroke="currentColor" stroke-width="1.8"/></svg>
                    <span>Упаковка</span>
                </button>
                <button class="ios-tab-item" data-admin-tab="warehouse">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 19V8.5l8-5.5 8 5.5V19" stroke="currentColor" stroke-width="1.8"/><path d="M7 19V12.5h8V19" stroke="currentColor" stroke-width="1.8"/></svg>
                    <span>Склад</span>
                </button>
                <button class="ios-tab-item" data-admin-tab="photos">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="4" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="10" r="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M14 10l4 3.5V17h-4l-2-2.5" stroke="currentColor" stroke-width="1.8"/></svg>
                    <span>Фото</span>
                </button>
                <button class="ios-tab-item" data-admin-tab="users">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="8" cy="7" r="3.5" stroke="currentColor" stroke-width="1.8"/><circle cx="15" cy="7" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M2 18c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5" stroke="currentColor" stroke-width="1.8"/><path d="M11.5 13.5h4c2 0 3.5 1.5 3.5 3.5" stroke="currentColor" stroke-width="1.8"/></svg>
                    <span>Сотрудники</span>
                </button>
            </div>
        </div>`;
}

// ===== ПРИВЯЗКА СОБЫТИЙ =====
export function attachAdminEvents() {
    const session = getSession();
    if (!session) return;

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        import('../ui/pwa.js').then(m => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            themeBtn.textContent = isDark ? '◑' : '◐';
            themeBtn.onclick = () => {
                m.Theme.toggle();
                const nowDark = document.documentElement.getAttribute('data-theme') === 'dark';
                themeBtn.textContent = nowDark ? '◑' : '◐';
            };
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = () => window.doLogout();

    // Делегирование — чтобы ловить клики и с таб-бара, и с сегментов
    document.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-admin-tab]');
            if (!btn) return;
            const tab = btn.dataset.adminTab;
            if (tab === currentAdminTab) return;

            // Переключаем active на всех элементах (и сегменты, и таб-бар)
            document.querySelectorAll('[data-admin-tab]').forEach(s => s.classList.remove('active'));
            document.querySelectorAll(`[data-admin-tab="${tab}"]`).forEach(s => s.classList.add('active'));

            const tabDashboard = document.getElementById('adminTabDashboard');
            const tabPacking = document.getElementById('adminTabPacking');
            const tabWarehouse = document.getElementById('adminTabWarehouse');
            const tabPhotos = document.getElementById('adminTabPhotos');
            const tabUsers = document.getElementById('adminTabUsers');

            if (tabDashboard) tabDashboard.style.display = tab === 'dashboard' ? 'block' : 'none';
            if (tabPacking) tabPacking.style.display = tab === 'packing' ? 'block' : 'none';
            if (tabWarehouse) tabWarehouse.style.display = tab === 'warehouse' ? 'block' : 'none';
            if (tabPhotos) tabPhotos.style.display = tab === 'photos' ? 'block' : 'none';
            if (tabUsers) tabUsers.style.display = tab === 'users' ? 'block' : 'none';

            if (tab === 'dashboard' && !window._adminDashboardLoaded) {
                window._adminDashboardLoaded = true;
                loadDashboard();
            }
            if (tab === 'packing' && !window._adminPackingLoaded) {
                window._adminPackingLoaded = true;
                loadAdminPackingTab();
            }
            if (tab === 'warehouse' && !window._adminWarehouseLoaded) {
                window._adminWarehouseLoaded = true;
                loadAdminWarehouseTab();
            }
            if (tab === 'photos' && !window._adminPhotosLoaded) {
                window._adminPhotosLoaded = true;
                loadAdminPhotosTab();
            }
            if (tab === 'users' && !window._adminUsersLoaded) {
                window._adminUsersLoaded = true;
                loadAdminUsersTab();
            }

            currentAdminTab = tab;
        });

    // Свайп по табам
    const TABS = ['dashboard', 'packing', 'warehouse', 'photos', 'users'];
    let _touchStartX = 0;
    let _touchStartY = 0;
    
    document.addEventListener('touchstart', function (e) {
        _touchStartX = e.touches[0].clientX;
        _touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    document.addEventListener('touchend', function (e) {
        const diffX = e.changedTouches[0].clientX - _touchStartX;
        const diffY = e.changedTouches[0].clientY - _touchStartY;
        // Только горизонтальный свайп, не скролл
        if (Math.abs(diffX) < 50 || Math.abs(diffX) < Math.abs(diffY) * 1.5) return;
        const idx = TABS.indexOf(currentAdminTab);
        if (idx === -1) return;
        if (diffX < 0) {
            // Свайп влево → следующий таб
            if (idx < TABS.length - 1) switchAdminTab(TABS[idx + 1]);
        } else {
            // Свайп вправо → предыдущий таб
            if (idx > 0) switchAdminTab(TABS[idx - 1]);
        }
    }, { passive: true });

    window._adminDashboardLoaded = true;
    currentAdminTab = 'dashboard';
    loadDashboard();
}

function switchAdminTab(tab) {
    if (tab === currentAdminTab) return;
    document.querySelectorAll('[data-admin-tab]').forEach(s => s.classList.remove('active'));
    document.querySelectorAll(`[data-admin-tab="${tab}"]`).forEach(s => s.classList.add('active'));

    const tabDashboard = document.getElementById('adminTabDashboard');
    const tabPacking = document.getElementById('adminTabPacking');
    const tabWarehouse = document.getElementById('adminTabWarehouse');
    const tabPhotos = document.getElementById('adminTabPhotos');
    const tabUsers = document.getElementById('adminTabUsers');

    if (tabDashboard) tabDashboard.style.display = tab === 'dashboard' ? 'block' : 'none';
    if (tabPacking) tabPacking.style.display = tab === 'packing' ? 'block' : 'none';
    if (tabWarehouse) tabWarehouse.style.display = tab === 'warehouse' ? 'block' : 'none';
    if (tabPhotos) tabPhotos.style.display = tab === 'photos' ? 'block' : 'none';
    if (tabUsers) tabUsers.style.display = tab === 'users' ? 'block' : 'none';

    if (tab === 'dashboard' && !window._adminDashboardLoaded) {
        window._adminDashboardLoaded = true;
        loadDashboard();
    }
    if (tab === 'packing' && !window._adminPackingLoaded) {
        window._adminPackingLoaded = true;
        loadAdminPackingTab();
    }
    if (tab === 'warehouse' && !window._adminWarehouseLoaded) {
        window._adminWarehouseLoaded = true;
        loadAdminWarehouseTab();
    }
    if (tab === 'photos' && !window._adminPhotosLoaded) {
        window._adminPhotosLoaded = true;
        loadAdminPhotosTab();
    }
    if (tab === 'users' && !window._adminUsersLoaded) {
        window._adminUsersLoaded = true;
        loadAdminUsersTab();
    }

    currentAdminTab = tab;
}

// ================================================================
//  ТАБ «ДАШБОРД»
// ================================================================
async function loadDashboard() {
    const container = document.getElementById('adminTabDashboard');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner">Загрузка дашборда...</div>';

    try {
        const { getTodayStr, getWeekStart, getWeekEnd, formatDateISO } = await import('../utils/dates.js');
        const { getEmployeesCached } = await import('./auth.js');
        const { getRecordsForRange, calculateTodayStats } = await import('./packing.js');
        const { getTodayAttendance } = await import('./attendance.js');
        const { getWarehouseDB } = await import('../services/firebase.js');
        const { sortDesc } = await import('../utils/helpers.js');

        const today = getTodayStr();
        const weekStart = getWeekStart(today);
        const weekEnd = getWeekEnd(today);

        // Грузим только записи текущей + прошлой недели (а не все 5000)
        const prevWeekStart = getWeekStart(formatDateISO(new Date(new Date(weekStart).getTime() - 7 * 86400000)));
        const [employees, allRecords, todayAttendance] = await Promise.all([
            getEmployeesCached(),
            getRecordsForRange(prevWeekStart, weekEnd),
            getTodayAttendance()
        ]);

        const packingStats = calculateTodayStats(allRecords);
        const todayPackRecords = allRecords.filter(r => r.dateOnly === today);
        const uniquePackers = new Set(todayPackRecords.map(r => r.userId)).size;

        const thisWeekRecords = allRecords.filter(r => r.dateOnly >= weekStart && r.dateOnly <= weekEnd);
        const thisWeekQty = thisWeekRecords.reduce((s, r) => s + r.quantity, 0);

        const prevWeekEnd = getWeekEnd(prevWeekStart);
        const prevWeekRecords = allRecords.filter(r => r.dateOnly >= prevWeekStart && r.dateOnly <= prevWeekEnd);
        const prevWeekQty = prevWeekRecords.reduce((s, r) => s + r.quantity, 0);
        const weekTrend = prevWeekQty > 0 ? ((thisWeekQty - prevWeekQty) / prevWeekQty * 100) : 0;

        const todayByUser = new Map();
        todayPackRecords.forEach(r => {
            if (!todayByUser.has(r.userId)) todayByUser.set(r.userId, { name: r.userName, qty: 0 });
            todayByUser.get(r.userId).qty += r.quantity;
        });
        const todayTop = sortDesc(Array.from(todayByUser.values()), u => u.qty).slice(0, 3);

        const packers = employees.filter(e => e.role !== 'admin');
        const checkedIds = new Set(todayAttendance.map(a => a.userId));
        const notChecked = packers.filter(p => !checkedIds.has(p.id));

        const whSnap = await getWarehouseDB().collection('work_logs').where('date', '==', today).get();
        let whCollect = 0, whLay = 0, whBoxes = 0;
        const whUsers = new Set();
        whSnap.docs.forEach(d => {
            const log = d.data();
            whUsers.add(log.userId);
            if (log.type === 'collect') whCollect += log.quantity || 0;
            if (log.type === 'lay') whLay += log.quantity || 0;
            if (log.type === 'boxes') whBoxes += log.quantity || 0;
        });

        let html = `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-value">${packingStats.totalQty.toLocaleString('ru-RU')}</div>
                    <div class="kpi-label">упаковано сегодня</div>
                    <div class="kpi-sub">${uniquePackers} упаковщиц на смене</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-value">${todayAttendance.length}</div>
                    <div class="kpi-label">человек на смене</div>
                    <div class="kpi-sub">отметились сегодня</div>
                </div>
            </div>
            <div class="total-salary-card" id="adminTotalSalaryCard"></div>
            <div class="trend-card">
                <div class="trend-header">
                    <span>Неделя (${weekStart.slice(5)} — ${weekEnd.slice(5)})</span>
                    <span class="trend-badge ${weekTrend >= 0 ? 'up' : 'down'}">${weekTrend >= 0 ? '↑' : '↓'} ${Math.abs(weekTrend).toFixed(1)}%</span>
                </div>
                <div class="trend-body">
                    <div class="trend-compare"><span class="trend-label">Эта неделя</span><span class="trend-value">${thisWeekQty.toLocaleString('ru-RU')} шт</span></div>
                    <div class="trend-compare muted"><span class="trend-label">Прошлая неделя</span><span class="trend-value">${prevWeekQty.toLocaleString('ru-RU')} шт</span></div>
                </div>
            </div>
            <div class="collapsible-section open">
                <div class="collapsible-header"><div class="collapsible-title">Лидеры сегодня</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body">
                    ${todayTop.length === 0 ? '<div class="empty-state">Пока нет записей</div>' : todayTop.map((u, i) => `
                        <div class="leader-row"><span class="leader-pos">${i + 1}.</span><span class="leader-name">${esc(u.name)}</span><span class="leader-qty">${u.qty.toLocaleString('ru-RU')} шт</span></div>
                    `).join('')}
                </div></div></div>
            </div>
            ${notChecked.length > 0 ? `
            <div class="alert-card warning"><div class="alert-icon">${ICONS.warning}</div><div class="alert-text"><strong>Не отметились сегодня (${notChecked.length}):</strong> ${notChecked.slice(0, 5).map(p => esc(p.name)).join(', ')}${notChecked.length > 5 ? ` и ещё ${notChecked.length - 5}` : ''}</div></div>
            ` : `<div class="alert-card success"><div class="alert-icon">${ICONS.check}</div><div class="alert-text">Все упаковщицы отметились сегодня</div></div>`}
        `;
        container.innerHTML = html;
        container.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', function () { this.closest('.collapsible-section').classList.toggle('open'); });
        });
        // Блок "Общая зарплата" грузим асинхронно (в фоне),
        // чтобы не блокировать отрисовку остального дашборда (пункт 3, 7)
        setTimeout(() => loadTotalSalary(0), 0);
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка загрузки: ${esc(err.message)}</div>`;
    }
}

// ===== ОБЩАЯ ЗАРПЛАТА ВСЕХ СОТРУДНИКОВ (ПО НЕДЕЛЯМ) =====
async function loadTotalSalary(offset) {
    const container = document.getElementById('adminTotalSalaryCard');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner">Загрузка...</div>';
    try {
        const { getTodayStr, getWeekStart, getWeekEnd, formatDateShort } = await import('../utils/dates.js');
        const today = getTodayStr();
        const baseStart = getWeekStart(today);
        const d = new Date(baseStart);
        d.setDate(d.getDate() + offset * 7);
        const start = getWeekStart(d.toISOString().slice(0, 10));
        const end = getWeekEnd(start);

        const [packData, whData] = await Promise.all([
            (await import('./salary.js')).calculateTotalSalaryForPeriod(start, end),
            (await import('./salary-warehouse.js')).calculateAllSalaries(start, end)
        ]);

        const packTotal = packData.totalSalary || 0;
        let whTotal = 0;
        Object.values(whData.salaryByUser || {}).forEach(u => { whTotal += u.total || 0; });
        const grandTotal = packTotal + whTotal;

        container.innerHTML = `
            <div class="total-salary-header">
                <span class="total-salary-title">Общая зарплата</span>
                <div class="total-salary-nav">
                    <button class="total-salary-nav-btn" id="totalSalaryPrev">←</button>
                    <span class="total-salary-range">${formatDateShort(new Date(start))} — ${formatDateShort(new Date(end))}</span>
                    <button class="total-salary-nav-btn" id="totalSalaryNext">→</button>
                </div>
            </div>
            <div class="total-salary-body">
                <div class="total-salary-row"><span>Упаковщицы и операторы</span><span>${packTotal.toLocaleString('ru-RU')} ₽</span></div>
                <div class="total-salary-row"><span>Кладовщики</span><span>${whTotal.toLocaleString('ru-RU')} ₽</span></div>
                <div class="total-salary-divider"></div>
                <div class="total-salary-total"><span>Итого за неделю</span><span>${grandTotal.toLocaleString('ru-RU')} ₽</span></div>
            </div>
        `;

        const prev = document.getElementById('totalSalaryPrev');
        const next = document.getElementById('totalSalaryNext');
        if (prev) prev.onclick = () => { _totalSalaryWeekOffset--; loadTotalSalary(_totalSalaryWeekOffset); };
        if (next) next.onclick = () => { _totalSalaryWeekOffset++; loadTotalSalary(_totalSalaryWeekOffset); };
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка: ${esc(err.message)}</div>`;
    }
}

// ================================================================
//  ТАБ «УПАКОВКА»
// ================================================================
async function loadAdminPackingTab() {
    const container = document.getElementById('adminTabPacking');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

    try {
        const { getTodayStr, getWeekStart, getWeekEnd, formatDateISO, formatDateShort, getDatesInRange } = await import('../utils/dates.js');
        const { getEmployeesCached } = await import('./auth.js');
        const { getRecordsForRange, calculateTodayStats } = await import('./packing.js');
        const { getWeekAttendance } = await import('./attendance.js');
        const { sortDesc } = await import('../utils/helpers.js');

        const today = getTodayStr();
        const weekStart = getWeekStart(today);
        const weekEnd = getWeekEnd(today);

        // Грузим только записи текущей + прошлой недели (а не все 5000)
        const prevWeekStart = getWeekStart(formatDateISO(new Date(new Date(weekStart).getTime() - 7 * 86400000)));
        const [employees, allRecords, weekAttendance] = await Promise.all([
            getEmployeesCached(), getRecordsForRange(prevWeekStart, weekEnd), getWeekAttendance()
        ]);

        const todayStats = calculateTodayStats(allRecords);
        const todayRecords = allRecords.filter(r => r.dateOnly === today);
        const uniqueTodayPackers = new Set(todayRecords.map(r => r.userId)).size;
        const wbToday = todayRecords.filter(r => r.marketplace === 'WB').reduce((s, r) => s + r.quantity, 0);
        const ozonToday = todayRecords.filter(r => r.marketplace === 'OZON').reduce((s, r) => s + r.quantity, 0);

        const thisWeekRecords = allRecords.filter(r => r.dateOnly >= weekStart && r.dateOnly <= weekEnd);
        const thisWeekQty = thisWeekRecords.reduce((s, r) => s + r.quantity, 0);
        const thisWeekByDay = getDatesInRange(weekStart, weekEnd);
        const thisWeekDayData = thisWeekByDay.map(date => {
            const dayRecords = thisWeekRecords.filter(r => r.dateOnly === date);
            return { date, label: formatDateShort(new Date(date)), qty: dayRecords.reduce((s, r) => s + r.quantity, 0), isToday: date === today };
        });

        const prevWeekEnd = getWeekEnd(prevWeekStart);
        const prevWeekRecords = allRecords.filter(r => r.dateOnly >= prevWeekStart && r.dateOnly <= prevWeekEnd);
        const prevWeekQty = prevWeekRecords.reduce((s, r) => s + r.quantity, 0);
        const prevWeekByDay = getDatesInRange(prevWeekStart, prevWeekEnd);
        const prevWeekDayData = prevWeekByDay.map(date => ({
            date, label: formatDateShort(new Date(date)),
            qty: prevWeekRecords.filter(r => r.dateOnly === date).reduce((s, r) => s + r.quantity, 0)
        }));
        const weekTrend = prevWeekQty > 0 ? ((thisWeekQty - prevWeekQty) / prevWeekQty * 100) : 0;

        const maxQty = Math.max(...thisWeekDayData.map(d => d.qty), ...prevWeekDayData.map(d => d.qty), 1);

        const weekByUser = new Map();
        thisWeekRecords.forEach(r => {
            if (!weekByUser.has(r.userId)) weekByUser.set(r.userId, { name: r.userName, qty: 0, days: new Set() });
            const u = weekByUser.get(r.userId);
            u.qty += r.quantity;
            u.days.add(r.dateOnly);
        });
        const weekTop = sortDesc(Array.from(weekByUser.values()).map(u => ({ ...u, days: u.days.size })), u => u.qty).slice(0, 5);

        const wbWeek = thisWeekRecords.filter(r => r.marketplace === 'WB').reduce((s, r) => s + r.quantity, 0);
        const ozonWeek = thisWeekRecords.filter(r => r.marketplace === 'OZON').reduce((s, r) => s + r.quantity, 0);

        const weekAttendanceByDay = {};
        weekAttendance.forEach(a => { if (!weekAttendanceByDay[a.date]) weekAttendanceByDay[a.date] = 0; weekAttendanceByDay[a.date]++; });

        function renderBar(value, max, label, isToday, prevValue = null) {
            const height = max > 0 ? Math.max((value / max) * 100, 2) : 0;
            const prevHeight = prevValue !== null && max > 0 ? Math.max((prevValue / max) * 100, 2) : 0;
            return `
                <div class="chart-bar-col ${isToday ? 'today' : ''}">
                    <div class="chart-bar-values">
                        <span class="chart-bar-val current">${value.toLocaleString('ru-RU')}</span>
                        ${prevValue !== null && prevValue > 0 ? `<span class="chart-bar-val prev">${prevValue.toLocaleString('ru-RU')}</span>` : ''}
                    </div>
                    <div class="chart-bars">
                        <div class="chart-bar current" style="height:${height}%"></div>
                        ${prevValue !== null ? `<div class="chart-bar prev" style="height:${prevHeight}%"></div>` : ''}
                    </div>
                    <div class="chart-bar-label">${label}</div>
                </div>`;
        }

        let html = `
            <div class="packing-kpi-row">
                <div class="packing-kpi"><div class="packing-kpi-val">${todayStats.totalQty.toLocaleString('ru-RU')}</div><div class="packing-kpi-lbl">шт сегодня</div></div>
                <div class="packing-kpi"><div class="packing-kpi-val">${uniqueTodayPackers}</div><div class="packing-kpi-lbl">упаковщиц</div></div>
                <div class="packing-kpi"><div class="packing-kpi-val">${wbToday.toLocaleString('ru-RU')}</div><div class="packing-kpi-lbl">WB</div></div>
                <div class="packing-kpi"><div class="packing-kpi-val">${ozonToday.toLocaleString('ru-RU')}</div><div class="packing-kpi-lbl">OZON</div></div>
            </div>
            <div class="trend-card">
                <div class="trend-header">
                    <span>Неделя (${weekStart.slice(5)} — ${weekEnd.slice(5)})</span>
                    <span class="trend-badge ${weekTrend >= 0 ? 'up' : 'down'}">${weekTrend >= 0 ? '↑' : '↓'} ${Math.abs(weekTrend).toFixed(1)}%</span>
                </div>
                <div class="trend-body">
                    <div class="trend-compare"><span class="trend-label">Эта неделя</span><span class="trend-value">${thisWeekQty.toLocaleString('ru-RU')} шт</span></div>
                    <div class="trend-compare muted"><span class="trend-label">Прошлая неделя</span><span class="trend-value">${prevWeekQty.toLocaleString('ru-RU')} шт</span></div>
                    <div class="trend-compare"><span class="trend-label">WB / Ozon</span><span class="trend-value">${wbWeek.toLocaleString('ru-RU')} / ${ozonWeek.toLocaleString('ru-RU')}</span></div>
                </div>
            </div>
            <div class="collapsible-section open">
                <div class="collapsible-header"><div class="collapsible-title">По дням (эта неделя vs прошлая)</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body">
                    <div class="chart-legend">
                        <span class="chart-legend-item"><span class="chart-legend-dot current"></span> Эта неделя</span>
                        <span class="chart-legend-item"><span class="chart-legend-dot prev"></span> Прошлая</span>
                    </div>
                    <div class="chart-container">${thisWeekDayData.map((d, i) => renderBar(d.qty, maxQty, d.label, d.isToday, prevWeekDayData[i]?.qty || 0)).join('')}</div>
                    <div class="chart-summary"><span>Средняя ставка: ${todayStats.rate.toFixed(2)} ₽/шт</span><span>КВ: ${todayStats.kv}</span></div>
                </div></div></div>
            </div>
            <div class="collapsible-section">
                <div class="collapsible-header"><div class="collapsible-title">Топ-5 за неделю</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body">
                    ${weekTop.length === 0 ? '<div class="empty-state">Нет данных</div>' : weekTop.map((u, i) => `
                        <div class="leader-row"><span class="leader-pos">${i + 1}.</span><span class="leader-name">${esc(u.name)}</span><span class="leader-meta">${u.days} дн.</span><span class="leader-qty">${u.qty.toLocaleString('ru-RU')} шт</span></div>
                    `).join('')}
                </div></div></div>
            </div>
            <div class="collapsible-section">
                <div class="collapsible-header"><div class="collapsible-title">Посещаемость</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body">
                    <div class="attendance-period-nav">
                        <button class="salary-nav-btn nav-arrow" id="attendancePrev">◀</button>
                        <span class="attendance-period-label" id="attendancePeriodLabel">${weekStart.slice(5).split('-').reverse().join('-')} — ${weekEnd.slice(5).split('-').reverse().join('-')}</span>
                        <button class="salary-nav-btn nav-arrow" id="attendanceNext">▶</button>
                    </div>
                    <div class="attendance-segment-control" style="display:flex;gap:4px;margin-bottom:8px;">
                        <button class="btn-adjust active" data-att-mode="week" style="flex:1;">Неделя</button>
                        <button class="btn-adjust" data-att-mode="month" style="flex:1;">Месяц</button>
                    </div>
                    <div class="attendance-grid" id="attendanceGrid">
                        ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => `<div class="attendance-grid-header">${d}</div>`).join('')}
                        ${thisWeekByDay.map(date => {
                            const count = weekAttendanceByDay[date] || 0;
                            const isToday = date === today;
                            const dd = date.slice(8) + '-' + date.slice(5,7);
                            return `<div class="attendance-day-cell${count > 0 ? ' has-attendance' : ''}${isToday ? ' today' : ''}"><span class="attendance-day-num">${dd}</span><span class="attendance-day-count">${count > 0 ? count : ''}</span></div>`;
                        }).join('')}
                    </div>
                </div></div></div>
            </div>
            <div class="collapsible-section">
                <div class="collapsible-header"><div class="collapsible-title">Зарплата упаковщиц</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body" id="adminPackingSalary"></div></div></div>
            </div>
            <div class="collapsible-section">
                <div class="collapsible-header"><div class="collapsible-title">Фото товаров</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body" id="adminPhotosView"></div></div></div>
            </div>
        `;

        container.innerHTML = html;
        container.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', function () { this.closest('.collapsible-section').classList.toggle('open'); });
        });

        // Тяжёлые блоки (зарплата упаковщиц, фото) грузим асинхронно в фоне,
        // чтобы не блокировать отрисовку вкладки (пункт 7)
        setTimeout(() => { initAdminPackingSalary(); initAdminPhotos(); initAttendanceEvents(); }, 0);

    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка: ${esc(err.message)}</div>`;
    }
}

// ===== ПОСЕЩАЕМОСТЬ: НАВИГАЦИЯ И КЛИК ПО ДНЮ =====
let _attendanceWeekOffset = 0;
let _attendanceMode = 'week';
let _totalSalaryWeekOffset = 0;

async function initAttendanceEvents() {
    const prevBtn = document.getElementById('attendancePrev');
    const nextBtn = document.getElementById('attendanceNext');
    const modeBtns = document.querySelectorAll('[data-att-mode]');
    
    if (prevBtn) prevBtn.onclick = () => { _attendanceWeekOffset--; refreshAttendance(); };
    if (nextBtn) nextBtn.onclick = () => { _attendanceWeekOffset++; refreshAttendance(); };
    
    modeBtns.forEach(btn => {
        btn.onclick = function() {
            modeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            _attendanceMode = this.dataset.attMode;
            refreshAttendance();
        };
    });
    
    // Клик по дню — модалка с сотрудниками
    document.querySelectorAll('.attendance-day-cell').forEach(cell => {
        cell.onclick = async function() {
            const dateStr = this.dataset.date;
            if (!dateStr) return;
            const { getDB } = await import('../services/firebase.js');
            const { esc } = await import('../utils/helpers.js');
            const snap = await getDB().collection('attendance').where('date', '==', dateStr).get();
            if (snap.empty) { toast.info('Нет отметок за этот день'); return; }
            const { getEmployeesCached } = await import('./auth.js');
            const emps = await getEmployeesCached();
            const empMap = {};
            emps.forEach(e => { empMap[e.id] = e; });
            
            let listHtml = snap.docs.map(d => {
                const a = d.data();
                const emp = empMap[a.userId] || { name: 'Неизвестный' };
                const isPacker = emp.role === 'user' || emp.role === 'packer';
                return `<div class="attendance-modal-item ${isPacker ? 'packer' : 'operator'}">
                    <span class="attendance-modal-dot ${isPacker ? 'success' : 'warning'}"></span>
                    <div class="attendance-modal-info">
                        <div class="attendance-modal-name">${esc(emp.name)}</div>
                        <div class="attendance-modal-meta">${isPacker ? 'Упаковщица' : 'Оператор'}</div>
                    </div>
                </div>`;
            }).join('');
            
            const overlay = document.createElement('div');
            overlay.className = 'attendance-modal-overlay active';
            overlay.innerHTML = `
                <div class="attendance-modal">
                    <div class="attendance-modal-header">
                        <h3>${dateStr.slice(8)}.${dateStr.slice(5,7)}.${dateStr.slice(0,4)}</h3>
                        <button class="attendance-modal-close">✕</button>
                    </div>
                    <div class="attendance-modal-list">${listHtml || '<div style="text-align:center;padding:20px;color:var(--text-secondary);">Нет данных</div>'}</div>
                </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('.attendance-modal-close').onclick = () => overlay.remove();
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        };
    });
}

async function refreshAttendance() {
    const { getTodayStr, getWeekStart, getWeekEnd, getDatesInRange, getMonthRange } = await import('../utils/dates.js');
    const { getWeekAttendance } = await import('./attendance.js');
    const today = getTodayStr();
    
    let startDate, endDate, dates;
    if (_attendanceMode === 'week') {
        const baseWeekStart = getWeekStart(today);
        const d = new Date(baseWeekStart);
        d.setDate(d.getDate() + _attendanceWeekOffset * 7);
        startDate = getWeekStart(d.toISOString().slice(0,10));
        endDate = getWeekEnd(startDate);
        dates = getDatesInRange(startDate, endDate);
    } else {
        const d = new Date(today);
        d.setMonth(d.getMonth() + _attendanceWeekOffset);
        const year = d.getFullYear();
        const month = d.getMonth();
        const first = new Date(year, month, 1);
        const last = new Date(year, month + 1, 0);
        startDate = first.toISOString().slice(0,10);
        endDate = last.toISOString().slice(0,10);
        dates = getDatesInRange(startDate, endDate);
    }
    
    const weekAttendance = await getWeekAttendance();
    const weekAttendanceByDay = {};
    weekAttendance.forEach(a => { if (!weekAttendanceByDay[a.date]) weekAttendanceByDay[a.date] = 0; weekAttendanceByDay[a.date]++; });
    
    const label = document.getElementById('attendancePeriodLabel');
    if (label) {
        if (_attendanceMode === 'week') {
            label.textContent = `${startDate.slice(8)}-${startDate.slice(5,7)} — ${endDate.slice(8)}-${endDate.slice(5,7)}`;
        } else {
            const monthNames = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
            const d = new Date(startDate);
            label.textContent = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        }
    }
    
    const grid = document.getElementById('attendanceGrid');
    if (!grid) return;
    
    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    grid.innerHTML = dayNames.map(d => `<div class="attendance-grid-header">${d}</div>`).join('') +
        dates.map(date => {
            const count = weekAttendanceByDay[date] || 0;
            const isToday = date === today;
            const dd = date.slice(8) + '-' + date.slice(5,7);
            return `<div class="attendance-day-cell${count > 0 ? ' has-attendance' : ''}${isToday ? ' today' : ''}" data-date="${date}"><span class="attendance-day-num">${dd}</span><span class="attendance-day-count">${count > 0 ? count : ''}</span></div>`;
        }).join('');
    
    // Перепривязываем клик по дням
    grid.querySelectorAll('.attendance-day-cell').forEach(cell => {
        cell.onclick = async function() {
            const dateStr = this.dataset.date;
            if (!dateStr) return;
            const { getDB } = await import('../services/firebase.js');
            const { esc } = await import('../utils/helpers.js');
            const snap = await getDB().collection('attendance').where('date', '==', dateStr).get();
            if (snap.empty) { toast.info('Нет отметок за этот день'); return; }
            const { getEmployeesCached } = await import('./auth.js');
            const emps = await getEmployeesCached();
            const empMap = {};
            emps.forEach(e => { empMap[e.id] = e; });
            
            let listHtml = snap.docs.map(d => {
                const a = d.data();
                const emp = empMap[a.userId] || { name: 'Неизвестный' };
                const isPacker = emp.role === 'user' || emp.role === 'packer';
                return `<div class="attendance-modal-item ${isPacker ? 'packer' : 'operator'}">
                    <span class="attendance-modal-dot ${isPacker ? 'success' : 'warning'}"></span>
                    <div class="attendance-modal-info">
                        <div class="attendance-modal-name">${esc(emp.name)}</div>
                        <div class="attendance-modal-meta">${isPacker ? 'Упаковщица' : 'Оператор'}</div>
                    </div>
                </div>`;
            }).join('');
            
            const overlay = document.createElement('div');
            overlay.className = 'attendance-modal-overlay active';
            overlay.innerHTML = `
                <div class="attendance-modal">
                    <div class="attendance-modal-header">
                        <h3>${dateStr.slice(8)}.${dateStr.slice(5,7)}.${dateStr.slice(0,4)}</h3>
                        <button class="attendance-modal-close">✕</button>
                    </div>
                    <div class="attendance-modal-list">${listHtml || '<div style="text-align:center;padding:20px;color:var(--text-secondary);">Нет данных</div>'}</div>
                </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('.attendance-modal-close').onclick = () => overlay.remove();
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        };
    });
}

// ================================================================
//  ТАБ «ФОТО»
// ================================================================
async function loadAdminPhotosTab() {
    const container = document.getElementById('adminTabPhotos');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

    try {
        const { getWarehouseDB } = await import('../services/firebase.js');
        const { getTodayStr, getWeekStart, getWeekEnd, formatDateShort } = await import('../utils/dates.js');
        const today = getTodayStr();
        let _photoWeekOffset = 0;

        container.innerHTML = `
            <div class="attendance-period-nav" style="margin-bottom:12px;">
                <button class="salary-nav-btn nav-arrow" id="adminPhotoPrev">◀</button>
                <span class="attendance-period-label" id="adminPhotoWeekLabel"></span>
                <button class="salary-nav-btn nav-arrow" id="adminPhotoNext">▶</button>
            </div>
            <div id="adminPhotoContainer">Загрузка...</div>
        `;

        async function loadPhotos(startStr, endStr) {
            const photoContainer = document.getElementById('adminPhotoContainer');
            if (!photoContainer) return;
            photoContainer.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

            try {
                const snap = await getWarehouseDB().collection('pallet_photos')
                    .where('date', '>=', startStr)
                    .where('date', '<=', endStr)
                    .get();
                
                if (snap.empty) {
                    photoContainer.innerHTML = '<div class="empty-state">Нет фото за эту неделю</div>';
                    return;
                }

                // Группируем по городам
                const byCity = {};
                snap.docs.forEach(d => {
                    const p = d.data();
                    const city = p.city || 'Без города';
                    if (!byCity[city]) byCity[city] = [];
                    byCity[city].push({ id: d.id, ...p });
                });

                const cityNames = Object.keys(byCity).sort();
                let html = '';
                
                const CITY_COLORS = ['#007aff','#ff9500','#34c759','#ff3b30','#5856d6','#af52de','#ff2d55','#5ac8fa'];
                
                cityNames.forEach((city, ci) => {
                    const pallets = byCity[city].sort((a, b) => {
                        const ta = a.timestamp?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
                        const tb = b.timestamp?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
                        return tb - ta;
                    });
                    
                    const color = CITY_COLORS[ci % CITY_COLORS.length];
                    html += `
                        <div class="city-section">
                            <div class="city-section-header" style="padding:8px 12px;">
                                <div class="city-section-title">
                                    <span class="city-accent" style="background:${color};width:4px;height:16px;border-radius:2px;display:inline-block;"></span>
                                    ${esc(city)}
                                    <span class="city-section-count">${pallets.length}</span>
                                </div>
                                <span class="city-section-chevron" style="transition:transform 0.2s;">▼</span>
                            </div>
                            <div class="city-section-body">
                                <div>
                                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:4px 8px 8px;">
                    `;
                    
                    pallets.forEach(p => {
                        const photos = p.photos || [];
                        const ipDisplay = p.ipDisplay || '—';
                        const userName = p.userName || '—';
                        const totalQty = p.totalQuantity || 0;
                        
                        html += `<div style="background:var(--surface);border-radius:12px;overflow:hidden;border:1px solid var(--border);">`;
                        
                        if (photos.length > 0) {
                            html += `<img src="${esc(photos[0].data || photos[0].dataUrl)}" style="width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;" onclick="window.open('${esc(photos[0].data || photos[0].dataUrl)}','_blank')" alt="фото паллеты">`;
                        } else {
                            html += `<div style="width:100%;aspect-ratio:1;background:var(--input-bg);display:flex;align-items:center;justify-content:center;color:var(--text-secondary);font-size:0.7rem;">Нет фото</div>`;
                        }
                        
                        html += `
                            <div style="padding:6px 8px;">
                                <div style="font-size:0.7rem;font-weight:600;color:var(--text);">${esc(userName)}</div>
                                <div style="font-size:0.6rem;color:var(--text-secondary);">${esc(ipDisplay)}</div>
                                <div style="font-size:0.6rem;color:var(--text-secondary);">${totalQty} кор. · ${photos.length} фото</div>
                            </div>
                        </div>`;
                    });
                    
                    html += `
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                photoContainer.innerHTML = html;
                
                // Клик по заголовку города — сворачивание
                photoContainer.querySelectorAll('.city-section-header').forEach(h => {
                    h.addEventListener('click', function() {
                        const section = this.closest('.city-section');
                        section.classList.toggle('expanded');
                        const body = section.querySelector('.city-section-body');
                        const chevron = this.querySelector('.city-section-chevron');
                        if (section.classList.contains('expanded')) {
                            body.classList.add('expanded');
                            if (chevron) chevron.style.transform = 'rotate(0deg)';
                        } else {
                            body.classList.remove('expanded');
                            if (chevron) chevron.style.transform = 'rotate(-90deg)';
                        }
                    });
                });
            } catch (err) {
                photoContainer.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка: ${esc(err.message)}</div>`;
            }
        }

        function refreshPhotoWeek() {
            const baseStart = getWeekStart(today);
            const d = new Date(baseStart);
            d.setDate(d.getDate() + _photoWeekOffset * 7);
            const start = getWeekStart(d.toISOString().slice(0, 10));
            const end = getWeekEnd(start);
            const label = document.getElementById('adminPhotoWeekLabel');
            if (label) label.textContent = `${formatDateShort(new Date(start))} — ${formatDateShort(new Date(end))}`;
            loadPhotos(start, end);
        }

        const photoPrev = document.getElementById('adminPhotoPrev');
        const photoNext = document.getElementById('adminPhotoNext');
        if (photoPrev) photoPrev.onclick = () => { _photoWeekOffset--; refreshPhotoWeek(); };
        if (photoNext) photoNext.onclick = () => { _photoWeekOffset++; refreshPhotoWeek(); };
        refreshPhotoWeek();

    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка: ${esc(err.message)}</div>`;
    }
}

// ===== ОТЧЁТЫ СКЛАДА (АДМИН) =====
async function initAdminWarehouseReports() {
    const container = document.getElementById('adminWarehouseReports');
    if (!container) return;
    const { getWarehouseDB } = await import('../services/firebase.js');
    const { getTodayStr } = await import('../utils/dates.js');
    
    const today = getTodayStr();
    container.innerHTML = `
        <div class="salary-month-selector" style="flex-wrap:wrap;">
            <input type="date" class="input-field" id="reportStartDate" value="${today}" style="width:auto;">
            <input type="date" class="input-field" id="reportEndDate" value="${today}" style="width:auto;">
            <button id="reportGenerateBtn" class="btn-primary">Сформировать</button>
        </div>
        <div id="adminReportResult"></div>
    `;
    
    document.getElementById('reportGenerateBtn').onclick = async () => {
        const start = document.getElementById('reportStartDate')?.value;
        const end = document.getElementById('reportEndDate')?.value;
        const resultDiv = document.getElementById('adminReportResult');
        if (!start || !end) { toast.warning('Выберите даты'); return; }
        resultDiv.innerHTML = '<div class="loading-spinner">Загрузка...</div>';
        
        try {
            const snap = await getWarehouseDB().collection('work_logs')
                .where('date', '>=', start)
                .where('date', '<=', end)
                .get();
            
            const stats = {
                received: 0, collected: 0, shipped: 0, laid: 0,
                accepted: 0, shippedPush: 0, unloaded: 0, reworked: 0,
                daysMoscow: new Set(), daysPushkino: new Set()
            };
            
            snap.docs.forEach(d => {
                const log = d.data();
                if (log.action === 'Работал на складе') {
                    if (log.warehouse === 'Москва') stats.daysMoscow.add(log.date);
                    else stats.daysPushkino.add(log.date);
                }
                const qty = log.quantity || 0;
                if (log.action?.indexOf('Принял коробов') >= 0) stats.received += qty;
                else if (log.action?.indexOf('Собрал паллеты') >= 0) stats.collected += qty;
                else if (log.action?.indexOf('Отгрузил паллеты') >= 0) stats.shipped += qty;
                else if (log.action?.indexOf('Выкладка товара') >= 0) stats.laid += qty;
                else if (log.action?.indexOf('Принял с осн. склада') >= 0) stats.accepted += qty;
                else if (log.action?.indexOf('Отгрузил на осн. склад') >= 0) stats.shippedPush += qty;
                else if (log.action?.indexOf('Выгрузка фуры') >= 0) stats.unloaded += qty;
                else if (log.action?.indexOf('Перебрал паллеты') >= 0) stats.reworked += qty;
            });
            
            const cards = [
                { val: stats.daysMoscow.size, lbl: 'Дней в Москве' },
                { val: stats.daysPushkino.size, lbl: 'Дней в Пушкино' },
                { val: stats.received, lbl: 'Принято коробов' },
                { val: stats.collected, lbl: 'Собрано паллет' },
                { val: stats.shipped, lbl: 'Отгружено паллет' },
                { val: stats.laid, lbl: 'Выкладка (шт)' },
                { val: stats.accepted, lbl: 'Принято с осн. (кор)' },
                { val: stats.shippedPush, lbl: 'Отгруж. на осн. (кор)' },
                { val: stats.unloaded, lbl: 'Выгрузка фуры (кор)' },
                { val: stats.reworked, lbl: 'Перебрано (кор)' }
            ];
            
            resultDiv.innerHTML = '<div class="ios-tile-grid">' + cards.map(c =>
                `<div class="ios-tile"><div class="tile-value">${c.val}</div><div class="tile-label">${c.lbl}</div></div>`
            ).join('') + '</div>';
        } catch (e) {
            resultDiv.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка: ${esc(e.message)}</div>`;
        }
    };
}

// ===== ЗАРПЛАТА УПАКОВЩИЦ (как у кладовщиков — все сразу) =====
async function initAdminPackingSalary() {
    const container = document.getElementById('adminPackingSalary');
    if (!container) return;

    const { getTodayStr, getMonthRange, getWeekRange } = await import('../utils/dates.js');
    const today = getTodayStr();

    container.innerHTML = `
        <div class="salary-month-selector">
            <select id="pckSalaryMode" class="input-field" style="width:auto;">
                <option value="month">Месяц</option>
                <option value="week">Неделя</option>
            </select>
            <input type="month" class="input-field" id="pckSalaryMonth" value="${today.slice(0, 7)}" style="width:auto;">
            <input type="date" class="input-field" id="pckSalaryWeek" value="${today}" style="display:none;width:auto;">
            <button id="pckSalaryBtn" class="btn-primary">Показать</button>
        </div>
        <div id="pckSalaryResult"></div>
    `;

    const modeSelect = document.getElementById('pckSalaryMode');
    const monthInput = document.getElementById('pckSalaryMonth');
    const weekInput = document.getElementById('pckSalaryWeek');
    const pckSalaryBtn = document.getElementById('pckSalaryBtn');

    if (modeSelect) {
        modeSelect.addEventListener('change', function () {
            if (monthInput) monthInput.style.display = this.value === 'month' ? 'inline' : 'none';
            if (weekInput) weekInput.style.display = this.value === 'week' ? 'inline' : 'none';
        });
    }

    if (pckSalaryBtn) {
        pckSalaryBtn.onclick = async () => {
            const mode = modeSelect?.value || 'month';
            const val = mode === 'month' ? monthInput?.value : weekInput?.value;
            const resultDiv = document.getElementById('pckSalaryResult');
            if (!resultDiv) return;
            resultDiv.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

            let startDate, endDate;
            if (mode === 'month') {
                const range = getMonthRange(new Date(val + '-01'));
                startDate = range.start;
                endDate = range.end;
            } else {
                const w = getWeekRange(new Date(val));
                startDate = w.start;
                endDate = w.end;
            }

            const { calculateTotalSalaryForPeriod } = await import('./salary.js');
            const { getEmployeesCached } = await import('./auth.js');

            const [salaryData, emps] = await Promise.all([
                calculateTotalSalaryForPeriod(startDate, endDate),
                getEmployeesCached()
            ]);

            const empMap = {};
            emps.forEach(e => { empMap[e.id] = e; });

            const userIds = Object.keys(salaryData.byUser || {});
            if (userIds.length === 0) {
                resultDiv.innerHTML = '<div class="empty-state">Нет данных за выбранный период</div>';
                return;
            }

            let total = 0;
            let whtml = '<div class="salary-employee-card"><div class="salary-items">';
            userIds.sort((a, b) => (salaryData.byUser[b]?.total || 0) - (salaryData.byUser[a]?.total || 0));
            userIds.forEach(uid => {
                const emp = empMap[uid] || { name: 'Неизвестный' };
                const data = salaryData.byUser[uid];
                total += data.total || 0;
                whtml += `<div class="salary-item"><span class="salary-item-label">${esc(emp.name)}</span><span class="salary-item-value">${(data.total || 0).toLocaleString('ru-RU')} ₽</span></div>`;
            });
            whtml += `<div class="salary-divider"></div><div class="salary-total"><span>Итого</span><span class="salary-total-value">${total.toLocaleString('ru-RU')} ₽</span></div>`;
            whtml += '</div></div>';
            resultDiv.innerHTML = whtml;
        };
    }
}

async function initAdminPhotos() {
    const container = document.getElementById('adminPhotosView');
    if (!container) return;
    const { getDB } = await import('../services/firebase.js');
    container.innerHTML = `
        <div class="photo-search-bar"><input type="text" class="input-field" id="photoSearchInput" placeholder="Поиск по штрихкоду или артикулу"></div>
        <div id="adminPhotosList" class="loading-spinner">Загрузка...</div>
    `;
    const searchInput = document.getElementById('photoSearchInput');
    if (!searchInput) return;

    let searchTimeout;
    async function loadPhotos(query) {
        const list = document.getElementById('adminPhotosList');
        if (!list) return;
        list.innerHTML = '<div class="loading-spinner">Загрузка...</div>';
        let snap;
        if (query) {
            snap = await getDB().collection('product_photos').where('barcode', '>=', query).where('barcode', '<=', query + '\uf8ff').limit(20).get();
        } else {
            snap = await getDB().collection('product_photos').orderBy('createdAt', 'desc').limit(20).get();
        }
        if (snap.empty) { list.innerHTML = '<div class="empty-state">Ничего не найдено</div>'; return; }
        list.innerHTML = snap.docs.map(d => {
            const data = d.data();
            return `<div style="display:inline-block;margin:4px;text-align:center;">
                <img src="${esc(data.photoData)}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;" alt="фото">
                <div class="text-muted">${esc(data.barcode || '—')}<br>${esc(data.article || '—')}</div>
            </div>`;
        }).join('');
    }
    searchInput.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => loadPhotos(searchInput.value.trim()), 300); });
    loadPhotos('');
}

// ================================================================
//  ТАБ «СКЛАД»
// ================================================================
async function loadAdminWarehouseTab() {
    const container = document.getElementById('adminTabWarehouse');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

    try {
        const { getTodayStr, getWeekRange } = await import('../utils/dates.js');
        const { loadAdminLogs } = await import('./admin-warehouse.js');

        container.innerHTML = `
            <div class="collapsible-section open">
                <div class="collapsible-header"><div class="collapsible-title">Зарплата кладовщиков</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body" id="adminWarehouseSalary">Загрузка...</div></div></div>
            </div>
            <div class="collapsible-section">
                <div class="collapsible-header"><div class="collapsible-title">Отчёты</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body" id="adminWarehouseReports"></div></div></div>
            </div>
            <div class="collapsible-section">
                <div class="collapsible-header"><div class="collapsible-title">Логи операций</div><span class="collapsible-icon">${ICONS.chevronDown}</span></div>
                <div class="collapsible-content"><div><div class="collapsible-body" id="adminLogsContainer">Загрузка...</div></div></div>
            </div>
        `;

        container.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', function () { this.closest('.collapsible-section').classList.toggle('open'); });
        });

        loadAdminLogs(1).catch(() => {});
        initAdminWarehouseReports();

        const salaryContainer = document.getElementById('adminWarehouseSalary');
        if (!salaryContainer) return;
        const today = getTodayStr();
        salaryContainer.innerHTML = `
            <div class="salary-month-selector">
                <select id="whSalaryMode" class="input-field" style="width:auto;"><option value="month">Месяц</option><option value="week">Неделя</option></select>
                <input type="month" class="input-field" id="whSalaryMonth" value="${today.slice(0, 7)}" style="width:auto;">
                <input type="date" class="input-field" id="whSalaryWeek" value="${today}" style="display:none;width:auto;">
                <button id="whSalaryBtn" class="btn-primary">Показать</button>
            </div>
            <div id="whSalaryResult"></div>
        `;

        const modeSelect = document.getElementById('whSalaryMode');
        const monthInput = document.getElementById('whSalaryMonth');
        const weekInput = document.getElementById('whSalaryWeek');
        const whSalaryBtn = document.getElementById('whSalaryBtn');

        if (modeSelect) {
            modeSelect.addEventListener('change', function () {
                if (monthInput) monthInput.style.display = this.value === 'month' ? 'inline' : 'none';
                if (weekInput) weekInput.style.display = this.value === 'week' ? 'inline' : 'none';
            });
        }

        if (whSalaryBtn) {
            whSalaryBtn.onclick = async () => {
                const mode = modeSelect?.value || 'month';
                const val = mode === 'month' ? monthInput?.value : weekInput?.value;
                const resultDiv = document.getElementById('whSalaryResult');
                if (!resultDiv) return;
                resultDiv.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

                let startDate, endDate;
                if (mode === 'month') {
                    startDate = val + '-01';
                    const d = new Date(val + '-01');
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(0);
                    endDate = d.toISOString().slice(0, 10);
                } else {
                    const w = getWeekRange(new Date(val));
                    startDate = w.start;
                    endDate = w.end;
                }

                const { calculateAllSalaries } = await import('./salary-warehouse.js');
                const { getWarehouseDB } = await import('../services/firebase.js');
                const empSnap = await getWarehouseDB().collection('employees').orderBy('name').get();
                const empMap = {};
                empSnap.docs.forEach(d => { empMap[d.id] = { id: d.id, name: d.data().name, warehouseRole: d.data().warehouseRole || 'standard' }; });
                const { salaryByUser } = await calculateAllSalaries(startDate, endDate);
                const userIds = Object.keys(salaryByUser);

                if (userIds.length === 0) { resultDiv.innerHTML = '<div class="empty-state">Нет данных</div>'; return; }

                let total = 0;
                let whtml = '<div class="salary-employee-card"><div class="salary-items">';
                userIds.sort((a, b) => (salaryByUser[b].total || 0) - (salaryByUser[a].total || 0));
                userIds.forEach(uid => {
                    const emp = empMap[uid] || { name: 'Неизвестный', warehouseRole: 'standard' };
                    const data = salaryByUser[uid];
                    total += data.total;
                    whtml += `<div class="salary-item"><span class="salary-item-label">${esc(emp.name)}</span><span class="salary-item-value">${data.total.toLocaleString('ru-RU')} ₽</span></div>`;
                });
                whtml += `<div class="salary-divider"></div><div class="salary-total"><span>Итого</span><span class="salary-total-value">${total.toLocaleString('ru-RU')} ₽</span></div>`;
                whtml += '</div></div>';
                resultDiv.innerHTML = whtml;
            };
        }
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка: ${esc(err.message)}</div>`;
    }
}

// ================================================================
//  ТАБ «СОТРУДНИКИ»
// ================================================================
async function loadAdminUsersTab() {
    const container = document.getElementById('adminTabUsers');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner">Загрузка...</div>';

    try {
        const { getEmployeesCached, invalidateEmployeesCache } = await import('./auth.js');
        const { getWarehouseDB, getDB } = await import('../services/firebase.js');
        const { confirmDelete } = await import('../ui/popups.js');
        const { getTodayStr } = await import('../utils/dates.js');
        const { getWarehouseRoleRate } = await import('../config.js');

        const today = getTodayStr();

        const [packingEmps, whSnap, todayAttendanceSnap, allPackRecordsSnap] = await Promise.all([
            getEmployeesCached(),
            getWarehouseDB().collection('employees').orderBy('name').get(),
            getDB().collection('attendance').where('date', '==', today).get(),
            getDB().collection('pack_records').where('dateOnly', '==', today).get()
        ]);

        const warehouseEmps = whSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const checkedToday = new Set(todayAttendanceSnap.docs.map(d => d.data().userId));

        const todayStats = {};
        allPackRecordsSnap.docs.forEach(d => {
            const r = d.data();
            if (!todayStats[r.userId]) todayStats[r.userId] = { qty: 0, records: 0 };
            todayStats[r.userId].qty += r.quantity || 0;
            todayStats[r.userId].records++;
        });

        const seen = new Set();
        const allEmps = [];

        packingEmps.forEach(e => {
            if (!seen.has(e.login)) { seen.add(e.login); allEmps.push({ ...e, source: 'packing', sourceLabel: 'Упаковка', dbType: 'packing' }); }
        });
        warehouseEmps.forEach(e => {
            if (!seen.has(e.login)) { seen.add(e.login); allEmps.push({ ...e, source: 'warehouse', sourceLabel: 'Склад', dbType: 'warehouse' }); }
        });

        let html = `
            <div class="users-stats">
                <div class="users-stat-item"><span class="users-stat-num">${allEmps.length}</span><span class="users-stat-label">всего</span></div>
                <div class="users-stat-item"><span class="users-stat-num">${allEmps.filter(e => e.active !== false).length}</span><span class="users-stat-label">активных</span></div>
                <div class="users-stat-item"><span class="users-stat-num">${checkedToday.size}</span><span class="users-stat-label">на смене</span></div>
            </div>
            <div class="employee-list" id="employeeList"></div>
        `;
        container.innerHTML = html;

        function renderEmployeeList() {
            const list = document.getElementById('employeeList');
            if (!list) return;
            const filtered = allEmps;
            if (filtered.length === 0) { list.innerHTML = '<div class="empty-state">Нет сотрудников</div>'; return; }

            const roleLabels = { admin: 'Админ', user: 'Пользователь', superadmin: 'Суперадмин' };
            const whRoleLabels = { senior: 'Старший кладовщик', admin: 'Админ склада', pro: 'Кладовщик PRO', standard: 'Кладовщик', probation: 'Кладовщик (Испытательный)' };

            list.innerHTML = filtered.map(e => {
                const isActive = e.active !== false;
                const isChecked = checkedToday.has(e.id);
                const stats = todayStats[e.id];
                const roleLabel = roleLabels[e.role] || e.role;
                const whRoleLabel = whRoleLabels[e.warehouseRole] || e.warehouseRole || '—';
                const initial = (e.name || '?')[0].toUpperCase();
                const avatarBg = isActive ? 'var(--badge-active-bg)' : 'var(--badge-inactive-bg)';
                const avatarColor = isActive ? 'var(--badge-active-text)' : 'var(--badge-inactive-text)';
                // Ставка за выход
                let dailyRateText = '';
                let displayRoleText = '';
                if (e.role === 'admin' || e.role === 'superadmin') {
                    dailyRateText = '—';
                    displayRoleText = 'Администратор';
                } else if (e.warehouseRole) {
                    dailyRateText = getWarehouseRoleRate(e.warehouseRole) + ' ₽/выход';
                    displayRoleText = whRoleLabel + ' · ' + e.sourceLabel;
                } else if (e.appRole === 'operator' || e.role === 'operator') {
                    dailyRateText = '4000 ₽/выход';
                    displayRoleText = 'Оператор · ' + e.sourceLabel;
                } else {
                    dailyRateText = 'сделка';
                    displayRoleText = roleLabel + ' · ' + e.sourceLabel;
                }

                return `
                <div class="employee-card">
                    <div class="employee-card-main">
                        <div class="employee-avatar" style="background:${avatarBg};color:${avatarColor};">${esc(initial)}</div>
                        <div class="employee-info">
                            <div class="employee-name-row">
                                <span class="employee-name">${esc(e.name)}</span>
                                ${isChecked ? '<span class="employee-online-dot" title="На смене"></span>' : ''}
                            </div>
                            <div class="employee-meta">
                                <span class="employee-role-text">${displayRoleText}</span>
                            </div>
                            <div class="employee-meta">
                                <span class="employee-login">@${esc(e.login)}</span>
                                <span class="employee-rate">${dailyRateText}</span>
                                ${stats ? `<span class="employee-today-stat">${stats.qty} шт (${stats.records} зап.)</span>` : ''}
                            </div>
                        </div>
                        <div class="employee-status ${isActive ? 'active' : 'inactive'}">${isActive ? 'Активен' : 'Отключен'}</div>
                    </div>
                    <div class="employee-actions">
                        <select class="role-select emp-role-select" data-user-id="${esc(e.id)}" data-db="${e.dbType}">
                            <option value="admin" ${(e.role === 'admin' || e.role === 'superadmin') && !e.warehouseRole ? 'selected' : ''}>Админ</option>
                            <option value="superadmin" ${e.role === 'superadmin' && !e.warehouseRole ? 'selected' : ''}>Суперадмин</option>
                            <option value="user:packer" ${(e.role === 'user' || e.role === 'packer') && !e.warehouseRole ? 'selected' : ''}>Упаковщица</option>
                            <option value="user:operator" ${e.role === 'operator' && !e.warehouseRole ? 'selected' : ''}>Оператор</option>
                            <option value="probation" ${e.warehouseRole === 'probation' ? 'selected' : ''}>Кладовщик (Испытательный)</option>
                            <option value="standard" ${e.warehouseRole === 'standard' ? 'selected' : ''}>Кладовщик</option>
                            <option value="pro" ${e.warehouseRole === 'pro' ? 'selected' : ''}>Кладовщик PRO</option>
                            <option value="senior" ${e.warehouseRole === 'senior' ? 'selected' : ''}>Старший кладовщик</option>
                        </select>
                        <button class="employee-toggle-btn" data-user-id="${esc(e.id)}" data-db="${e.dbType}" data-active="${isActive}">${isActive ? ICONS.toggleOn : ICONS.toggleOff}</button>
                        <button class="employee-delete-btn" data-user-id="${esc(e.id)}" data-db="${e.dbType}" data-name="${esc(e.name)}">${ICONS.trash}</button>
                    </div>
                </div>`;
            }).join('');

            bindEmployeeEvents();
        }

        function bindEmployeeEvents() {
            document.querySelectorAll('.emp-role-select').forEach(select => {
                select.addEventListener('change', async function () {
                    const db = this.dataset.db === 'warehouse' ? getWarehouseDB() : getDB();
                    const value = this.value;
                    let updateData = {};
                    if (value === 'admin') {
                        updateData = { role: 'admin', warehouseRole: null, appRole: null };
                    } else if (value === 'superadmin') {
                        updateData = { role: 'superadmin', warehouseRole: null, appRole: null };
                    } else if (value === 'user:packer') {
                        updateData = { role: 'user', warehouseRole: null, appRole: 'packer' };
                    } else if (value === 'user:operator') {
                        updateData = { role: 'operator', warehouseRole: null, appRole: 'operator' };
                    } else {
                        // Кладовщик — одна из складских ролей
                        updateData = { role: 'user', warehouseRole: value, appRole: 'warehouse' };
                    }
                    try { await db.collection('employees').doc(this.dataset.userId).update(updateData); invalidateEmployeesCache(); toast.success('Роль обновлена'); loadAdminUsersTab(); }
                    catch (err) { toast.error('Ошибка: ' + err.message); }
                });
            });
            document.querySelectorAll('.employee-toggle-btn').forEach(btn => {
                btn.addEventListener('click', async function () {
                    const currentActive = this.dataset.active === 'true';
                    const db = this.dataset.db === 'warehouse' ? getWarehouseDB() : getDB();
                    const confirmed = await confirmDelete(currentActive ? 'Отключить сотрудника?' : 'Включить сотрудника?');
                    if (!confirmed) return;
                    try { await db.collection('employees').doc(this.dataset.userId).update({ active: !currentActive }); invalidateEmployeesCache(); toast.success(currentActive ? 'Отключен' : 'Включен'); loadAdminUsersTab(); }
                    catch (err) { toast.error('Ошибка: ' + err.message); }
                });
            });
            document.querySelectorAll('.employee-delete-btn').forEach(btn => {
                btn.addEventListener('click', async function () {
                    const userId = this.dataset.userId;
                    const name = this.dataset.name;
                    const confirmed = await confirmDelete(`Удалить "${name}" из обеих баз? Это действие необратимо.`);
                    if (!confirmed) return;
                    try {
                        // Удаляем из обеих баз — сотрудник может быть в любой из них
                        const db1 = getDB();
                        const db2 = getWarehouseDB();
                        const results = await Promise.allSettled([
                            db1.collection('employees').doc(userId).delete(),
                            db2.collection('employees').doc(userId).delete()
                        ]);
                        const anySuccess = results.some(r => r.status === 'fulfilled');
                        if (anySuccess) {
                            invalidateEmployeesCache();
                            toast.success('Сотрудник удалён');
                            loadAdminUsersTab();
                        } else {
                            const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message).join('; ');
                            toast.error('Ошибка удаления: ' + errors);
                        }
                    } catch (err) {
                        toast.error('Ошибка: ' + err.message);
                    }
                });
            });
        }

        renderEmployeeList();
    } catch (err) {
        container.innerHTML = `<div class="empty-state" style="color:#ff3b30;">Ошибка: ${esc(err.message)}</div>`;
    }
}
