// ==================== ИНТЕРФЕЙС УПАКОВЩИЦЫ ====================

import { toast } from '../services/toast.js';
import { esc } from '../utils/helpers.js';
import { getTodayStr } from '../utils/dates.js';
import { getSession, clearSession } from './auth.js';
import { getEmployeesCached } from './auth.js';
import { checkIn, hasCheckedIn, getOperatorTodayEarning } from './attendance.js';
import { addPackRecord, getUserRecords, deletePackRecord, calculateTodayStats } from './packing.js';
import { getUserLocation, saveUserLocation, getUserIP, saveUserIP } from './location.js';
import { initSalary, refreshSalaryView, attachSalaryEvents } from './salary.js';
import { showLocationPopup, showIpPopup, confirmDelete } from '../ui/popups.js';
import { Theme, refreshApp } from '../ui/pwa.js';
import { getDailyRate } from './auth.js';
import { HISTORY_PAGE_SIZE } from '../config.js';

let allUserRecords = [];
let historyCurrentPage = 1;
let currentTab = 'packing';
const tabOrder = ['packing', 'salary', 'history'];

// ===== РЕНДЕР ПАНЕЛИ ПОЛЬЗОВАТЕЛЯ =====
export async function renderUserPanel(user) {
    const isOperator = user.appRole === 'operator';

    const [allRecords, userLocation, userIP, checkedIn, operatorEarned] = await Promise.all([
        getUserRecords(user.id),
        getUserLocation(user.id),
        getUserIP(user.id),
        hasCheckedIn(user.id),
        isOperator ? getOperatorTodayEarning(user.id) : Promise.resolve(0)
    ]);

    allUserRecords = allRecords;
    historyCurrentPage = 1;

    const todayStats = calculateTodayStats(allRecords);
    const dailyRate = getDailyRate(user);
    const totalEarned = todayStats.salary + (operatorEarned || 0);

    const locationTrigger = userLocation
        ? `<div class="settings-trigger" id="locationTrigger">
            <div><div class="trigger-label">Склад</div><div class="trigger-value">${esc(userLocation.marketplace)} — ${esc(userLocation.locationDisplay)}</div></div>
            <span class="trigger-icon">✏️</span></div>`
        : `<div class="settings-trigger warning" id="locationTrigger">
            <div><div class="trigger-label">Склад не выбран</div><div class="trigger-value">Нажмите для выбора</div></div>
            <span class="trigger-icon">✏️</span></div>`;

    const ipTrigger = `<div class="settings-trigger" id="ipTrigger">
        <div><div class="trigger-label">ИП</div><div class="trigger-value">${userIP ? esc(userIP) : 'Не выбран'}</div></div>
        <span class="trigger-icon">✏️</span></div>`;

    const triggers = `<div class="settings-triggers">${locationTrigger}${ipTrigger}</div>`;

    const isCheckedIn = checkedIn && checkedIn.checked;
    const checkinHtml = `<div class="checkin-section${isCheckedIn ? ' checked' : ''}">
        <div class="checkin-info">${isCheckedIn ? 'Вы сегодня отметились' : 'Отметьтесь о прибытии'}</div>
        <button id="checkinBtn" class="checkin-btn" ${isCheckedIn ? 'disabled' : ''}>${isCheckedIn ? 'Отмечено' : 'Отметиться'}</button>
    </div>`;

    const packingContent = `
        <div class="tab-card">
            <div class="form-title">Добавить упаковку</div>
            ${triggers}
            <div class="input-group">
                <div class="input-field"><label>Артикул</label>
                    <div class="article-row">
                        <input type="text" id="articleInput" placeholder="Сканируйте или введите" autocomplete="off">
                        <button id="scanBtn" class="scan-btn">📷</button>
                    </div>
                </div>
                <div class="input-field"><label>Количество</label><input type="number" id="qtyInput" min="1" placeholder="Кол-во"></div>
            </div>
            <img id="productPhoto" class="product-photo" alt="Фото товара">
            <div id="productPhotoPlaceholder" class="product-photo-placeholder">📷 Фото товара появится после сканирования</div>
            <button id="addPackBtn">Добавить</button>
            <div id="msgPanel"></div>
        </div>`;

    const salaryContent = `<div class="tab-card" id="salaryContainer"><div class="loading-spinner">Загрузка...</div></div>`;
    const historyContent = `<div class="tab-card" id="historyContainer">${renderHistory(allRecords)}</div>`;

    return `
        <div class="app-container packer-screen">
            <div class="glass-card dashboard">
                <div class="header-dash">
                    <div class="header-top-row">
                        <div class="user-block">
                            <div class="user-avatar">${esc(user.name).charAt(0)}</div>
                            <div class="user-info">
                                <div class="user-name">${esc(user.name)}</div>
                                <div class="user-role">${isOperator ? 'Оператор' : 'Упаковщица'}</div>
                            </div>
                        </div>
                        <div class="actions-block">
                            <button class="theme-toggle-btn" id="themeToggleBtn" aria-label="Тема">◐</button>
                            <button id="logoutBtn" class="header-btn danger" aria-label="Выход"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2H3v12h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" stroke-width="1.5"/></svg></button>
                        </div>
                    </div>
                    <div class="stats-row">
                        <div class="stat-block"><div class="stat-label">Ставка</div><div class="stat-value">${todayStats.rate.toFixed(2)} ₽</div></div>
                        <div class="stat-block right"><div class="stat-label">Заработано сегодня</div><div class="stat-value earned">${totalEarned.toFixed(0)} ₽</div></div>
                    </div>
                </div>
                ${checkinHtml}
                <div class="tab-content active" id="tab-packing">${packingContent}</div>
                <div class="tab-content" id="tab-salary" style="display:none;">${salaryContent}</div>
                <div class="tab-content" id="tab-history" style="display:none;">${historyContent}</div>
            </div>
        </div>`;
}

// ===== РЕНДЕР ИСТОРИИ =====
function renderHistory(records) {
    const totalPages = Math.ceil(records.length / HISTORY_PAGE_SIZE) || 1;
    if (historyCurrentPage > totalPages) historyCurrentPage = Math.max(1, totalPages);
    const start = (historyCurrentPage - 1) * HISTORY_PAGE_SIZE;
    const pageRecords = records.slice(start, start + HISTORY_PAGE_SIZE);

    if (records.length === 0) {
        return '<div class="empty-state">Нет записей</div>';
    }

    let html = `
        <div class="filter-row-center" style="margin-bottom:6px;">
            <span class="text-muted">Всего: ${records.length} записей</span>
            ${totalPages > 1 ? `<span class="text-muted">Стр. ${historyCurrentPage}/${totalPages}</span>` : ''}
        </div>
        <div class="table-wrap">
            <table><thead><tr><th>ИП</th><th>МП</th><th>Склад</th><th>Арт.</th><th>Кол-во</th><th>Дата</th><th></th></tr></thead>
            <tbody>${pageRecords.map(r => `
                <tr>
                    <td>${r.ip ? `<span class="ip-badge">${esc(r.ip)}</span>` : '—'}</td>
                    <td><span class="marketplace-badge ${r.marketplace === 'WB' ? 'badge-wb' : 'badge-ozon'}">${esc(r.marketplace)}</span></td>
                    <td>${esc(r.locationDisplay || '—')}</td>
                    <td><strong>${esc(r.article)}</strong></td>
                    <td>${r.quantity}</td>
                    <td class="text-muted">${r.dateStr ? esc(r.dateStr.split(',')[0]) : '—'}</td>
                    <td><span class="delete-icon" data-id="${r.id}">🗑️</span></td>
                </tr>`).join('')}
            </tbody></table>
        </div>
        ${totalPages > 1 ? renderPagination(totalPages) : ''}`;

    return html;
}

function renderPagination(totalPages) {
    return `<div class="pagination">
        <button class="page-btn" data-hp="1" ${historyCurrentPage === 1 ? 'disabled' : ''}>««</button>
        <button class="page-btn" data-hp="${historyCurrentPage - 1}" ${historyCurrentPage === 1 ? 'disabled' : ''}>«</button>
        <span class="page-info">${historyCurrentPage} / ${totalPages}</span>
        <button class="page-btn" data-hp="${historyCurrentPage + 1}" ${historyCurrentPage === totalPages ? 'disabled' : ''}>»</button>
        <button class="page-btn" data-hp="${totalPages}" ${historyCurrentPage === totalPages ? 'disabled' : ''}>»»</button>
    </div>`;
}

// ===== ПРИВЯЗКА СОБЫТИЙ =====
export function attachUserEvents() {
    const session = getSession();
    if (!session) return;

    // Тема
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        Theme._updateToggleButton(document.documentElement.getAttribute('data-theme') === 'dark');
        themeBtn.onclick = () => Theme.toggle();
    }

    // Выход
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = () => window.doLogout();

    // Табы — клик
    document.querySelectorAll('.ios-tab-item').forEach(item => {
        item.addEventListener('click', function () {
            const tabName = this.dataset.tab;
            if (tabName) switchTab(tabName);
        });
    });

    // Табы — свайп
    let packingSwipeStartX = 0;
    const packingSwipeThreshold = 60;

    document.addEventListener('touchstart', (e) => {
        if (document.getElementById('iosTabBar')?.style.display !== 'flex') return;
        packingSwipeStartX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (document.getElementById('iosTabBar')?.style.display !== 'flex') return;
        const diffX = e.changedTouches[0].clientX - packingSwipeStartX;
        if (Math.abs(diffX) > packingSwipeThreshold) {
            const tabIdx = tabOrder.indexOf(currentTab);
            if (diffX < 0 && tabIdx < tabOrder.length - 1) {
                switchTab(tabOrder[tabIdx + 1]);
            } else if (diffX > 0 && tabIdx > 0) {
                switchTab(tabOrder[tabIdx - 1]);
            }
        }
    });

    // Склад
    const locTrigger = document.getElementById('locationTrigger');
    if (locTrigger) {
        locTrigger.onclick = async () => {
            const curLoc = await getUserLocation(session.id);
            showLocationPopup(session.id, curLoc, (newLoc) => {
                const el = document.getElementById('locationTrigger');
                if (el) {
                    el.classList.remove('warning');
                    el.innerHTML = `<div><div class="trigger-label">Склад</div><div class="trigger-value">${esc(newLoc.marketplace)} — ${esc(newLoc.locationDisplay)}</div></div><span class="trigger-icon">✏️</span>`;
                }
            });
        };
    }

    // ИП
    const ipTrigger = document.getElementById('ipTrigger');
    if (ipTrigger) {
        ipTrigger.onclick = async () => {
            const curIp = await getUserIP(session.id);
            showIpPopup(session.id, curIp, (newIp) => {
                const el = document.getElementById('ipTrigger');
                if (el) el.innerHTML = `<div><div class="trigger-label">ИП</div><div class="trigger-value">${newIp ? esc(newIp) : 'Не выбран'}</div></div><span class="trigger-icon">✏️</span>`;
            });
        };
    }

    // Сканер — toggle кнопка
    const scanBtn = document.getElementById('scanBtn');
    if (scanBtn) {
        scanBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (scanBtn.classList.contains('scanning')) {
                stopSc();
            } else {
                startSc();
            }
        };
    }

    // Закрытие сканера по кнопке
    const closeScannerBtn = document.getElementById('closeScannerBtn');
    if (closeScannerBtn) {
        closeScannerBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            stopSc();
        };
    }

    // Закрытие сканера по ESC
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            const ov = document.getElementById('scannerOverlay');
            if (ov && ov.classList.contains('active')) {
                stopSc();
            }
        }
    });

    // Отметка
    const checkinBtn = document.getElementById('checkinBtn');
    if (checkinBtn) {
        checkinBtn.onclick = async () => {
            checkinBtn.disabled = true;
            checkinBtn.innerHTML = '✓';
            const result = await checkIn(session.id, session.name, session.appRole);
            if (result.success) {
                toast.success('Отметка поставлена!');
                // Обновляем блок отметки без перезагрузки всего интерфейса
                const section = document.querySelector('.checkin-section');
                if (section) {
                    section.classList.add('checked');
                    const info = section.querySelector('.checkin-info');
                    if (info) info.textContent = '✓ Вы сегодня отметились';
                }
                checkinBtn.disabled = true;
                checkinBtn.innerHTML = '✓';
            } else {
                toast.warning(result.message);
                checkinBtn.disabled = false;
                checkinBtn.textContent = 'Отметиться';
            }
        };
    }

    // Фото по артикулу (с debounce — ждём окончания ввода)
    const articleInput = document.getElementById('articleInput');
    if (articleInput) {
        let ppTimer = null;
        articleInput.addEventListener('input', function () {
            const barcode = this.value.trim();
            if (ppTimer) clearTimeout(ppTimer);
            if (barcode) {
                ppTimer = setTimeout(function() {
                    if (window.showPP) window.showPP(barcode);
                }, 400);
            } else {
                if (window.showPP) window.showPP('');
            }
        });
    }

    // Добавить упаковку
    const addBtn = document.getElementById('addPackBtn');
    if (addBtn) {
        addBtn.onclick = async () => {
            const art = document.getElementById('articleInput')?.value || '';
            const qty = document.getElementById('qtyInput')?.value || '';
            const msgPanel = document.getElementById('msgPanel');
            const userLoc = await getUserLocation(session.id);
            const userIp = await getUserIP(session.id);

            if (!userLoc) { toast.warning('Выберите склад'); return; }

            const result = await addPackRecord(art, qty, session.id, session.name, userLoc.marketplace, userLoc.locationDisplay, userLoc.locationRaw, userIp);

            if (result.success) {
                document.getElementById('articleInput').value = '';
                document.getElementById('qtyInput').value = '';
                toast.success(`Добавлено: ${art.toUpperCase()} x ${qty} шт.`);
                allUserRecords.unshift({ id: 'new_' + Date.now(), article: art.toUpperCase(), quantity: parseInt(qty), dateStr: new Date().toLocaleString('ru-RU'), dateOnly: getTodayStr(), marketplace: userLoc.marketplace, locationDisplay: userLoc.locationDisplay, ip: userIp, userId: session.id, userName: session.name });
                const historyContainer = document.getElementById('historyContainer');
                if (historyContainer) {
                    historyContainer.innerHTML = renderHistory(allUserRecords);
                    attachHistoryEvents();
                }
            } else {
                toast.error(result.error);
            }
        };
    }

    // Enter в артикуле → фокус на количество
    if (articleInput) {
        articleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); document.getElementById('qtyInput')?.focus(); }
        });
    }

    // Enter в количестве → добавить
    const qtyInput = document.getElementById('qtyInput');
    if (qtyInput) {
        qtyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addPackBtn')?.click(); }
        });
    }

    attachHistoryEvents();

    // Инициализация зарплаты
    setTimeout(async () => {
        initSalary(allUserRecords, session.appRole === 'operator', getDailyRate(session));
        await refreshSalaryView();
        attachSalaryEvents();
    }, 100);
}

// ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ =====
function switchTab(tabName) {
    if (currentTab === tabName) return;

    const oldTab = document.getElementById('tab-' + currentTab);
    const newTab = document.getElementById('tab-' + tabName);
    if (oldTab) oldTab.style.display = 'none';
    if (newTab) newTab.style.display = 'block';

    document.querySelectorAll('.ios-tab-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });
    currentTab = tabName;
}

// ===== ИСТОРИЯ: УДАЛЕНИЕ + ПАГИНАЦИЯ =====
function attachHistoryEvents() {
    const historyContainer = document.getElementById('historyContainer');
    if (!historyContainer) return;

    historyContainer.querySelectorAll('.delete-icon').forEach(el => {
        el.onclick = async function (e) {
            e.stopPropagation();
            const id = this.dataset.id;
            if (!id || !await confirmDelete('Удалить эту запись?')) return;
            await deletePackRecord(id);
            allUserRecords = allUserRecords.filter(r => r.id !== id);
            historyContainer.innerHTML = renderHistory(allUserRecords);
            attachHistoryEvents();
            toast.success('Запись удалена');
        };
    });

    historyContainer.querySelectorAll('[data-hp]').forEach(btn => {
        btn.onclick = function () {
            const page = parseInt(this.dataset.hp);
            const totalPages = Math.ceil(allUserRecords.length / HISTORY_PAGE_SIZE) || 1;
            if (page >= 1 && page <= totalPages) {
                historyCurrentPage = page;
                historyContainer.innerHTML = renderHistory(allUserRecords);
                attachHistoryEvents();
            }
        };
    });
}