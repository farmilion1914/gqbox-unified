// ==================== ИНТЕРФЕЙС КЛАДОВЩИКА ====================

import { toast } from '../services/toast.js';
import { esc } from '../utils/helpers.js';
import { Theme } from '../ui/pwa.js';
import { getTodayStr, formatDateForInput, formatDateForDisplay, getMonthStr, getMonthName, getWeekRange, getMonthRange } from '../utils/dates.js';
import { IP_LIST, MAX_PHOTOS, getWarehouseRoleRate, getWarehouseRoleLabel } from '../config.js';
import { getSession } from './auth.js';
import { markAttendance, hasCheckedIn } from './attendance.js';
import { 
    getCounters, adjustCounter, resetCounter, updateAllCountersUI, 
    addWorkLog, updateUserTotal, loadUserTotals, 
    loadHistoryForDate, deleteWorkLog, invalidateHistoryCache, invalidateSalaryCache 
} from './warehouse.js';
import { 
    setPhotoSlot, removePhotoSlot, clearAllPhotoSlots, 
    getFilledSlotCount, getCityList, savePallet, getPhotoSlots, getPhotoPreviewUrls 
} from './photos.js';
import { calculateSalary, getDailyRanking } from './salary-warehouse.js';

let _currentWarehouse = 'Москва';
let _salaryWeekOffset = 0;
let _salaryMonthOffset = 0;
let _historyDate = new Date();
let _historyPage = 1;
let _historyTotalDocs = 0;

// ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ ФОТО =====
window.triggerPhotoCapture = function (slotIndex) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) { toast.error('Фото слишком большое'); return; }
        setPhotoSlot(slotIndex, file);
        updatePhotoSlotDisplay(slotIndex);
        updatePhotoCounter();
    };
    input.click();
};

window.removePhotoFromSlot = function (slotIndex) {
    removePhotoSlot(slotIndex);
    updatePhotoSlotDisplay(slotIndex);
    updatePhotoCounter();
};

window.savePhotos = async function () {
    const cityEl = document.getElementById('photoCity');
    const dateEl = document.getElementById('photoDate');
    const btn = document.getElementById('savePhotoBtn');
    const city = cityEl ? cityEl.value.trim() : '';
    const date = dateEl ? dateEl.value : getTodayStr();

    if (!city) { toast.warning('Укажите город'); return; }

    const ipData = [];
    IP_LIST.forEach(ip => {
        const qtyEl = document.getElementById('ipQty_' + ip);
        const qty = qtyEl ? (parseInt(qtyEl.value) || 0) : 0;
        if (qty > 0) ipData.push({ ip, quantity: qty });
    });
    if (ipData.length === 0) { toast.warning('Укажите количество коробов'); return; }

    const slots = getPhotoSlots();
    const filledSlots = [];
    for (let i = 0; i < MAX_PHOTOS; i++) {
        if (slots[i] !== null) filledSlots.push({ file: slots[i], slot: i });
    }
    if (filledSlots.length === 0) { toast.warning('Сделайте фото'); return; }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Сжатие...';
    }

    try {
        const result = await savePallet(city, date, ipData, filledSlots);
        if (result.success) {
            toast.success('Сохранено! Фото: ' + result.photoCount);
            clearAllPhotoSlots();
            for (let k = 0; k < MAX_PHOTOS; k++) updatePhotoSlotDisplay(k);
            updatePhotoCounter();
            if (cityEl) cityEl.value = '';
            IP_LIST.forEach(ip => { const el = document.getElementById('ipQty_' + ip); if (el) el.value = ''; });
            if (dateEl) dateEl.value = getTodayStr();
            const dv = document.getElementById('dateDisplayValue');
            if (dv) dv.textContent = formatDateForDisplay(getTodayStr());
            updateCityDatalist();
        } else {
            toast.error(result.error || 'Ошибка сохранения');
        }
    } catch (error) {
        toast.error('Ошибка: ' + (error.message || 'Неизвестная'));
    }
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Сохранить паллету';
    }
};

window.loadUserSalaryBlock = async function (weekOffset, monthOffset) {
    if (weekOffset !== undefined) _salaryWeekOffset = weekOffset;
    if (monthOffset !== undefined) _salaryMonthOffset = monthOffset;
    await renderUserSalary();
};

// ===== UI ФУНКЦИИ =====
function updatePhotoSlotDisplay(idx) {
    const slot = document.getElementById('photoSlot' + idx);
    if (!slot) return;
    const previews = getPhotoPreviewUrls();
    if (previews[idx]) {
        slot.classList.add('has-photo');
        slot.innerHTML = `<img src="${previews[idx]}" alt="Фото"><button class="remove-photo" onclick="event.stopPropagation();window.removePhotoFromSlot(${idx})">✕</button>`;
    } else {
        slot.classList.remove('has-photo');
        slot.innerHTML = `<span class="slot-number">${idx + 1}</span>`;
    }
}

function updatePhotoCounter() {
    const filled = getFilledSlotCount();
    const el = document.getElementById('photoCounter');
    if (el) el.textContent = 'Заполнено: ' + filled + ' / ' + MAX_PHOTOS;
}

async function updateCityDatalist() {
    const datalist = document.getElementById('citySuggestions');
    if (!datalist) return;
    const cities = await getCityList();
    datalist.innerHTML = '';
    cities.forEach(c => { const o = document.createElement('option'); o.value = c; datalist.appendChild(o); });
}

function switchWarehouse(wh) {
    if (_currentWarehouse === wh) return;

    const mc = document.getElementById('moscowContainer');
    const pc = document.getElementById('pushkinoContainer');
    const dots = document.querySelectorAll('.swipe-dot');
    const label = document.getElementById('currentWhLabel');

    if (mc && pc) {
        if (wh === 'Москва') {
            pc.style.display = 'none';
            mc.style.display = 'block';
        } else {
            mc.style.display = 'none';
            pc.style.display = 'block';
        }
    }
    _currentWarehouse = wh;
    dots.forEach(dot => dot.classList.toggle('active', dot.dataset.wh === wh));
    if (label) label.textContent = wh;
}

// ===== РЕНДЕР ФОТО-СЛОТОВ =====
function renderPhotoSlots() {
    let h = '<div class="photo-slots">';
    for (let i = 0; i < MAX_PHOTOS; i++) {
        h += `<div class="photo-slot" id="photoSlot${i}" onclick="window.triggerPhotoCapture(${i})"><span class="slot-number">${i + 1}</span></div>`;
    }
    h += '</div>';
    return h;
}

function renderIpRows() {
    let h = '<div class="ip-rows">';
    IP_LIST.forEach(ip => {
        h += `<div class="ip-row"><span class="ip-name">${ip}</span><input type="number" id="ipQty_${ip}" class="ip-qty-input" placeholder="0" min="0"><span class="ip-unit">кор.</span></div>`;
    });
    h += '</div>';
    return h;
}

// ===== РЕНДЕР ПАНЕЛИ КЛАДОВЩИКА =====
export async function renderWarehousePanel(user) {
    const todayStr = getTodayStr();
    const html = await renderUserPanelHTML(user, todayStr);

    // Применить тему
    Theme.apply();

    // Загружаем данные после рендера
    setTimeout(async () => {
        clearAllPhotoSlots();
        updateCityDatalist();
        loadUserTotals(user.id);
        checkAttendanceUI();
        updateSalaryDisplay();

        _historyDate = new Date();
        const inp = document.getElementById('historyDateInput');
        if (inp) inp.value = formatDateForInput(_historyDate);
        renderHistory(formatDateForInput(_historyDate));

        // Показать Москву по умолчанию
        switchWarehouse('Москва');
    }, 50);

    return html;
}

async function renderUserPanelHTML(user, todayStr) {
    const slotsHtml = renderPhotoSlots();
    const ipRowsHtml = renderIpRows();
    const todayDisplay = formatDateForDisplay(todayStr);

    const photoAccordion = `
        <div class="accordion-item">
            <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Фото паллет</h3></div>
            <div class="accordion-content"><div>
                <div class="op-card">
                    ${slotsHtml}
                    <div class="photo-counter" id="photoCounter">Заполнено: 0 / ${MAX_PHOTOS}</div>
                    <div class="photo-form-row">
                        <div class="input-field-wrap">
                            <input type="text" id="photoCity" class="input-field" placeholder="Город" list="citySuggestions" style="margin-bottom:0;">
                            <datalist id="citySuggestions"></datalist>
                        </div>
                        <div class="date-picker-wrap">
                            <label class="date-picker-label" for="photoDate">Дата</label>
                            <input type="date" id="photoDate" class="date-picker-input" value="${todayStr}">
                            <div class="date-value" id="dateDisplayValue">${todayDisplay}</div>
                        </div>
                    </div>
                    ${ipRowsHtml}
                    <button class="btn-photo" id="savePhotoBtn" onclick="window.savePhotos()">Сохранить паллету</button>
                    <div id="photoMsg"></div>
                </div>
            </div></div>
        </div>`;

    const moscow = `
        <div id="moscowContainer">
            <div class="work-day-card">
                <span>Отметить присутствие</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span id="moscowWorkedToday" style="color:#6b7280;font-size:0.75rem;">Не отмечено</span>
                    <button class="btn-work" data-action="markAttendance" data-warehouse="Москва">Отметить</button>
                </div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Сборка по накладной</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <input type="text" id="moscowInvoiceNumber" class="input-field" placeholder="Накладная">
                        <input type="number" id="moscowInvoiceQuantity" class="input-field" placeholder="Кол-во" min="1">
                        <button class="btn-ok purple" data-action="invoice">ОК</button>
                        <div style="margin-top:4px;font-size:0.65rem;">Всего: <span id="moscowInvoiceTotal">0</span> шт.</div>
                    </div>
                </div></div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Собрал паллет</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <div class="counter-row"><span>палл.</span><span class="counter-value" id="moscowCollected">0</span></div>
                        <div class="manual-input-row">
                            <input type="number" id="moscowCollectedManual" class="input-field" placeholder="Введите" min="0">
                            <button class="btn-set" data-target="moscowCollected" data-manual="moscowCollectedManual">Уст.</button>
                        </div>
                        <div class="adjust-buttons">
                            <button class="btn-adjust" data-target="moscowCollected" data-delta="-1">–</button>
                            <button class="btn-adjust" data-target="moscowCollected" data-delta="1">+</button>
                        </div>
                        <button class="btn-ok green" data-action="collect">ОК</button>
                        <button class="reset-btn" data-reset="moscowCollected">сброс</button>
                    </div>
                </div></div>
            </div>
            ${photoAccordion}
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Отгрузил паллет</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <div class="counter-row"><span>палл.</span><span class="counter-value" id="moscowShipped">0</span></div>
                        <div class="manual-input-row">
                            <input type="number" id="moscowShippedManual" class="input-field" placeholder="Введите" min="0">
                            <button class="btn-set" data-target="moscowShipped" data-manual="moscowShippedManual">Уст.</button>
                        </div>
                        <div class="adjust-buttons">
                            <button class="btn-adjust" data-target="moscowShipped" data-delta="-1">–</button>
                            <button class="btn-adjust" data-target="moscowShipped" data-delta="1">+</button>
                        </div>
                        <button class="btn-ok orange" data-action="ship">ОК</button>
                        <button class="reset-btn" data-reset="moscowShipped">сброс</button>
                    </div>
                </div></div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Выкладка товара</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <input type="text" id="moscowArticle" class="input-field" placeholder="Артикул">
                        <input type="number" id="moscowQuantity" class="input-field" placeholder="Кол-во" min="1">
                        <button class="btn-ok blue" data-action="lay">ОК</button>
                        <div style="margin-top:4px;font-size:0.65rem;">Последний: <span id="moscowLastArticle">—</span></div>
                    </div>
                </div></div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Принял коробов</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <div class="counter-row"><span>кор.</span><span class="counter-value" id="moscowReceived">0</span></div>
                        <div class="manual-input-row">
                            <input type="number" id="moscowReceivedManual" class="input-field" placeholder="Введите" min="0">
                            <button class="btn-set" data-target="moscowReceived" data-manual="moscowReceivedManual">Уст.</button>
                        </div>
                        <div class="adjust-buttons">
                            <button class="btn-adjust" data-target="moscowReceived" data-delta="-1">–</button>
                            <button class="btn-adjust" data-target="moscowReceived" data-delta="1">+</button>
                        </div>
                        <button class="btn-ok green" data-action="receive">ОК</button>
                        <button class="reset-btn" data-reset="moscowReceived">сброс</button>
                    </div>
                </div></div>
            </div>
        </div>`;

    const pushkino = `
        <div id="pushkinoContainer" style="display:none;">
            <div class="work-day-card">
                <span>Отметить присутствие</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span id="pushkinoWorkedToday" style="color:#6b7280;font-size:0.75rem;">Не отмечено</span>
                    <button class="btn-work" data-action="markAttendance" data-warehouse="Пушкино">Отметить</button>
                </div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Принял с осн. склада</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <div class="counter-row"><span>кор.</span><span class="counter-value" id="pushkinoAccepted">0</span></div>
                        <div class="manual-input-row">
                            <input type="number" id="pushkinoAcceptedManual" class="input-field" placeholder="Введите" min="0">
                            <button class="btn-set" data-target="pushkinoAccepted" data-manual="pushkinoAcceptedManual">Уст.</button>
                        </div>
                        <div class="adjust-buttons">
                            <button class="btn-adjust" data-target="pushkinoAccepted" data-delta="-1">–</button>
                            <button class="btn-adjust" data-target="pushkinoAccepted" data-delta="1">+</button>
                        </div>
                        <button class="btn-ok green" data-action="accept">ОК</button>
                        <button class="reset-btn" data-reset="pushkinoAccepted">сброс</button>
                        <div style="margin-top:4px;font-size:0.65rem;">Всего: <span id="pushkinoAcceptedTotal">0</span> кор.</div>
                    </div>
                </div></div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Отгрузил на осн.</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <div class="counter-row"><span>кор.</span><span class="counter-value" id="pushkinoShipped">0</span></div>
                        <div class="manual-input-row">
                            <input type="number" id="pushkinoShippedManual" class="input-field" placeholder="Введите" min="0">
                            <button class="btn-set" data-target="pushkinoShipped" data-manual="pushkinoShippedManual">Уст.</button>
                        </div>
                        <div class="adjust-buttons">
                            <button class="btn-adjust" data-target="pushkinoShipped" data-delta="-1">–</button>
                            <button class="btn-adjust" data-target="pushkinoShipped" data-delta="1">+</button>
                        </div>
                        <button class="btn-ok orange" data-action="shipPushkino">ОК</button>
                        <button class="reset-btn" data-reset="pushkinoShipped">сброс</button>
                        <div style="margin-top:4px;font-size:0.65rem;">Всего: <span id="pushkinoShippedTotal">0</span> кор.</div>
                    </div>
                </div></div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Выгрузка фуры</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <div class="counter-row"><span>кор.</span><span class="counter-value" id="pushkinoUnloaded">0</span></div>
                        <div class="manual-input-row">
                            <input type="number" id="pushkinoUnloadedManual" class="input-field" placeholder="Введите" min="0">
                            <button class="btn-set" data-target="pushkinoUnloaded" data-manual="pushkinoUnloadedManual">Уст.</button>
                        </div>
                        <div class="adjust-buttons">
                            <button class="btn-adjust" data-target="pushkinoUnloaded" data-delta="-1">–</button>
                            <button class="btn-adjust" data-target="pushkinoUnloaded" data-delta="1">+</button>
                        </div>
                        <button class="btn-ok blue" data-action="unload">ОК</button>
                        <button class="reset-btn" data-reset="pushkinoUnloaded">сброс</button>
                        <div style="margin-top:4px;font-size:0.65rem;">Всего: <span id="pushkinoUnloadedTotal">0</span> кор.</div>
                    </div>
                </div></div>
            </div>
            <div class="accordion-item">
                <div class="accordion-header"><h3><span class="accordion-icon">▶</span> Перебрал паллеты</h3></div>
                <div class="accordion-content"><div>
                    <div class="op-card">
                        <div class="counter-row"><span>кор.</span><span class="counter-value" id="pushkinoReworked">0</span></div>
                        <div class="manual-input-row">
                            <input type="number" id="pushkinoReworkedManual" class="input-field" placeholder="Введите" min="0">
                            <button class="btn-set" data-target="pushkinoReworked" data-manual="pushkinoReworkedManual">Уст.</button>
                        </div>
                        <div class="adjust-buttons">
                            <button class="btn-adjust" data-target="pushkinoReworked" data-delta="-1">–</button>
                            <button class="btn-adjust" data-target="pushkinoReworked" data-delta="1">+</button>
                        </div>
                        <button class="btn-ok teal" data-action="rework">ОК</button>
                        <button class="reset-btn" data-reset="pushkinoReworked">сброс</button>
                        <div style="margin-top:4px;font-size:0.65rem;">Всего: <span id="pushkinoReworkedTotal">0</span> кор.</div>
                    </div>
                </div></div>
            </div>
        </div>`;

    return `
        <div class="app-container wh-screen">
            <div class="glass-card dashboard">
                <div class="header-dash">
                    <div class="header-top-row">
                        <div class="user-block">
                            <div class="user-avatar" id="userAvatar">${esc(user.name).split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
                            <div class="user-info">
                                <div class="user-name" id="userName">${esc(user.name)}</div>
                                <div class="user-role">${esc(getWarehouseRoleLabel(user.warehouseRole) || 'Кладовщик')}</div>
                            </div>
                        </div>
                        <div class="actions-block">
                            <button class="theme-toggle-btn" id="themeToggleBtnWH" aria-label="Тема">◐</button>
                            <button id="logoutBtnWH" class="header-btn danger" aria-label="Выход">✕</button>
                        </div>
                    </div>
                    <!-- Строка: зарплата слева + Москва/Пушкино справа -->
                    <div class="wh-header-bottom">
                        <div class="user-salary" id="salaryInline">0 ₽</div>
                        <div class="ios-segmented-control wh-segment-switch">
                            <button class="ios-segment active" data-wh="Москва">Москва</button>
                            <button class="ios-segment" data-wh="Пушкино">Пушкино</button>
                        </div>
                    </div>
                </div>
                <!-- Контейнеры табов -->
                <div id="whTabWarehouse">${moscow}${pushkino}</div>
                <div id="whTabSalary" style="display:none;"><div class="op-card" id="userSalaryContent"><div class="loading">Загрузка...</div></div></div>
                <div id="whTabHistory" style="display:none;">
                    <div class="history-section">
                        <div class="history-header">
                            <h3>Мои записи</h3>
                            <div class="date-selector">
                                <button class="date-nav-btn" data-action="prevDay">←</button>
                                <input type="date" id="historyDateInput">
                                <button class="date-nav-btn" data-action="nextDay">→</button>
                                <button class="date-nav-btn" data-action="todayHistory" style="font-size:0.65rem;padding:5px 8px;">Сегодня</button>
                            </div>
                        </div>
                        <div id="myHistoryContainer"></div>
                    </div>
                </div>
            </div>
            <!-- Нижний таб-бар -->
            <div class="ios-tab-bar">
                <button class="ios-tab-item active" data-wh-tab="warehouse">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 19V8.5l8-5.5 8 5.5V19" stroke="currentColor" stroke-width="1.8"/><path d="M7 19V12.5h8V19" stroke="currentColor" stroke-width="1.8"/></svg>
                    <span>Склад</span>
                </button>
                <button class="ios-tab-item" data-wh-tab="salary">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="7.5" stroke="currentColor" stroke-width="1.8"/><path d="M11 7v8M7 11h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    <span>Зарплата</span>
                </button>
                <button class="ios-tab-item" data-wh-tab="history">
                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="7.5" stroke="currentColor" stroke-width="1.8"/><path d="M11 7v4l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    <span>История</span>
                </button>
            </div>
        </div>`;
}

// ===== СОБЫТИЯ КЛАДОВЩИКА =====
export function attachWarehouseEvents(user) {
    if (document._warehouseClickHandler) {
        document.removeEventListener('click', document._warehouseClickHandler);
    }

    let _whTab = 'warehouse';
    
    function switchWhTab(tab) {
        if (tab === _whTab) return;
        _whTab = tab;
        document.querySelectorAll('[data-wh-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll(`[data-wh-tab="${tab}"]`).forEach(b => b.classList.add('active'));
        
        const wc = document.getElementById('whTabWarehouse');
        const sc = document.getElementById('whTabSalary');
        const hc = document.getElementById('whTabHistory');
        if (wc) wc.style.display = tab === 'warehouse' ? 'block' : 'none';
        if (sc) sc.style.display = tab === 'salary' ? 'block' : 'none';
        if (hc) hc.style.display = tab === 'history' ? 'block' : 'none';
        
        if (tab === 'salary') window.loadUserSalaryBlock(0, 0);
        if (tab === 'history') {
            const inp = document.getElementById('historyDateInput');
            if (inp) renderHistory(inp.value);
        }
    }

    const handler = function (e) {
        const t = e.target;

        // Таб-бар
        const whTabBtn = t.closest('[data-wh-tab]');
        if (whTabBtn) { switchWhTab(whTabBtn.dataset.whTab); return; }

        // Сегменты склада Москва/Пушкино
        const whSegBtn = t.closest('[data-wh]');
        if (whSegBtn && whSegBtn.classList.contains('ios-segment')) {
            document.querySelectorAll('.ios-segment[data-wh]').forEach(s => s.classList.remove('active'));
            whSegBtn.classList.add('active');
            switchWarehouse(whSegBtn.dataset.wh);
            return;
        }

        // Аккордеон
        const accHeader = t.closest('.accordion-header');
        if (accHeader) {
            e.preventDefault();
            e.stopPropagation();
            const acc = accHeader.closest('.accordion-item');
            if (acc) {
                acc.classList.toggle('open');
            }
            return;
        }

        // Кнопка "Уст."
        if (t.classList.contains('btn-set')) {
            const target = t.dataset.target;
            const manualId = t.dataset.manual;
            const manualInput = document.getElementById(manualId);
            if (manualInput && target) {
                const counters = getCounters();
                const val = parseInt(manualInput.value);
                counters[target] = (!isNaN(val) && val >= 0) ? val : 0;
                manualInput.value = '';
                updateAllCountersUI();
                toast.success('Установлено: ' + counters[target]);
            }
            return;
        }

        // Кнопки +/-
        if (t.classList.contains('btn-adjust')) {
            adjustCounter(t.dataset.target, parseInt(t.dataset.delta));
            updateAllCountersUI();
            return;
        }

        // Сброс
        if (t.hasAttribute('data-reset')) {
            resetCounter(t.dataset.reset);
            updateAllCountersUI();
            toast.success('Сброшено');
            return;
        }

        // Действия
        const action = t.dataset.action || (t.closest('[data-action]') ? t.closest('[data-action]').dataset.action : null);

        if (action === 'markAttendance') {
            const wh = t.dataset.warehouse || (t.closest('[data-warehouse]') ? t.closest('[data-warehouse]').dataset.warehouse : null);
            if (!wh) return;
            markAttendance(wh).then(result => {
                if (result?.success) {
                    toast.success('Отмечено: ' + wh);
                    invalidateHistoryCache();
                    invalidateSalaryCache();
                    checkAttendanceUI();
                    updateSalaryDisplay();
                } else {
                    toast.warning(result?.message || 'Уже отмечены');
                }
            });
            return;
        }

        if (action === 'prevDay') { _historyDate.setDate(_historyDate.getDate() - 1); updateHistoryUI(); return; }
        if (action === 'nextDay') { _historyDate.setDate(_historyDate.getDate() + 1); updateHistoryUI(); return; }
        if (action === 'todayHistory') { _historyDate = new Date(); updateHistoryUI(); return; }

        if (action && ['receive', 'collect', 'ship', 'lay', 'invoice', 'accept', 'shipPushkino', 'unload', 'rework'].includes(action)) {
            handleWarehouseAction(action);
            return;
        }
    };

    document._warehouseClickHandler = handler;
    document.addEventListener('click', handler);

    // Кнопка темы
    const themeBtn = document.getElementById('themeToggleBtnWH');
    if (themeBtn) {
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            Theme.toggle();
        });
    }

    // Клик по точкам склада
    document.querySelectorAll('.swipe-dot').forEach(dot => {
        dot.addEventListener('click', () => switchWarehouse(dot.dataset.wh));
    });

    // Свайп по табам Склад/Зарплата/История
    const WH_TABS = ['warehouse', 'salary', 'history'];
    let swipeStartX = 0;
    let swipeStartY = 0;
    const swipeThreshold = 60;

    document.addEventListener('touchstart', (e) => {
        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const session = getSession();
        if (!session || session.appRole !== 'warehouse') return;
        const diffX = e.changedTouches[0].clientX - swipeStartX;
        const diffY = e.changedTouches[0].clientY - swipeStartY;
        
        // Горизонтальный свайп для табов
        if (Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            const idx = WH_TABS.indexOf(_whTab);
            if (idx === -1) return;
            if (diffX < 0 && idx < WH_TABS.length - 1) switchWhTab(WH_TABS[idx + 1]);
            else if (diffX > 0 && idx > 0) switchWhTab(WH_TABS[idx - 1]);
            return;
        }
        
        // Вертикального свайпа нет, оставим для совместимости
        if (Math.abs(diffX) > swipeThreshold && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            if (_whTab === 'warehouse') {
                if (diffX > 0 && _currentWarehouse === 'Пушкино') switchWarehouse('Москва');
                else if (diffX < 0 && _currentWarehouse === 'Москва') switchWarehouse('Пушкино');
            }
        }
    });

    // Дата истории
    const histInput = document.getElementById('historyDateInput');
    if (histInput) {
        histInput.addEventListener('change', () => {
            _historyDate = new Date(histInput.value);
            renderHistory(histInput.value);
        });
    }
}

function updateHistoryUI() {
    const ds = formatDateForInput(_historyDate);
    const inp = document.getElementById('historyDateInput');
    if (inp) inp.value = ds;
    renderHistory(ds);
}

// ===== СКЛАДСКИЕ ДЕЙСТВИЯ =====
async function handleWarehouseAction(action) {
    const counters = getCounters();

    const actions = {
        receive: () => {
            if (counters.moscowReceived) {
                addWorkLog('Москва', 'Принял коробов', counters.moscowReceived + ' кор.', counters.moscowReceived);
                toast.success('Принято: ' + counters.moscowReceived + ' кор.');
                resetCounter('moscowReceived');
            }
        },
        collect: () => {
            if (counters.moscowCollected) {
                const q = counters.moscowCollected;
                addWorkLog('Москва', 'Собрал паллеты', q + ' шт.', q);
                toast.success('Собрано: ' + q + ' палл.');
                resetCounter('moscowCollected');
            }
        },
        ship: () => {
            if (counters.moscowShipped) {
                addWorkLog('Москва', 'Отгрузил паллеты', counters.moscowShipped + ' шт.', counters.moscowShipped);
                toast.success('Отгружено: ' + counters.moscowShipped + ' палл.');
                resetCounter('moscowShipped');
            }
        },
        lay: () => {
            const ae = document.getElementById('moscowArticle');
            const qe = document.getElementById('moscowQuantity');
            const art = ae?.value?.trim();
            const qty = parseInt(qe?.value);
            if (!art) { toast.warning('Укажите артикул'); return; }
            if (!qty || qty < 1) { toast.warning('Укажите количество'); return; }
            addWorkLog('Москва', 'Выкладка товара', 'арт. ' + art + ', ' + qty + ' шт.', qty);
            toast.success('Выкладка: ' + art + ' - ' + qty + ' шт.');
            if (ae) ae.value = '';
            if (qe) qe.value = '';
        },
        invoice: () => {
            const ie = document.getElementById('moscowInvoiceNumber');
            const ve = document.getElementById('moscowInvoiceQuantity');
            const inv = ie?.value?.trim();
            const qty = parseInt(ve?.value);
            if (!inv) { toast.warning('Укажите накладную'); return; }
            if (!qty || qty < 1) { toast.warning('Укажите количество'); return; }
            addWorkLog('Москва', 'Сборка по накладной', 'накл. ' + inv + ', ' + qty + ' шт.', qty);
            updateUserTotal('moscow_invoice', qty);
            toast.success('Накладная ' + inv + ': ' + qty + ' шт.');
            if (ie) ie.value = '';
            if (ve) ve.value = '';
        },
        accept: () => {
            if (counters.pushkinoAccepted) {
                addWorkLog('Пушкино', 'Принял с осн. склада', counters.pushkinoAccepted + ' кор.', counters.pushkinoAccepted);
                updateUserTotal('pushkino_accepted', counters.pushkinoAccepted);
                toast.success('Принято с осн.: ' + counters.pushkinoAccepted + ' кор.');
                resetCounter('pushkinoAccepted');
            }
        },
        shipPushkino: () => {
            if (counters.pushkinoShipped) {
                addWorkLog('Пушкино', 'Отгрузил на осн. склад', counters.pushkinoShipped + ' кор.', counters.pushkinoShipped);
                updateUserTotal('pushkino_shipped', counters.pushkinoShipped);
                toast.success('Отгружено на осн.: ' + counters.pushkinoShipped + ' кор.');
                resetCounter('pushkinoShipped');
            }
        },
        unload: () => {
            if (counters.pushkinoUnloaded) {
                addWorkLog('Пушкино', 'Выгрузка фуры', counters.pushkinoUnloaded + ' кор.', counters.pushkinoUnloaded);
                updateUserTotal('pushkino_unloaded', counters.pushkinoUnloaded);
                toast.success('Выгружено: ' + counters.pushkinoUnloaded + ' кор.');
                resetCounter('pushkinoUnloaded');
            }
        },
        rework: () => {
            if (counters.pushkinoReworked) {
                addWorkLog('Пушкино', 'Перебрал паллеты', counters.pushkinoReworked + ' кор.', counters.pushkinoReworked);
                updateUserTotal('pushkino_reworked', counters.pushkinoReworked);
                toast.success('Перебрано: ' + counters.pushkinoReworked + ' кор.');
                resetCounter('pushkinoReworked');
            }
        },
    };

    if (actions[action]) actions[action]();
    updateAllCountersUI();
    updateSalaryDisplay();
}

// ===== ИСТОРИЯ =====
async function renderHistory(dateStr) {
    const container = document.getElementById('myHistoryContainer');
    if (!container) return;
    const user = getSession();
    if (!user) return;

    container.innerHTML = '<div class="loading"><span class="loading-spinner"></span> Загрузка...</div>';

    const result = await loadHistoryForDate(user.id, dateStr, _historyPage);
    if (!result.logs.length) {
        container.innerHTML = '<div class="empty-history">' +
            (dateStr === getTodayStr() ? 'Нет записей за сегодня' : 'Нет записей за ' + formatDateForDisplay(dateStr)) +
            '</div>';
        return;
    }

    _historyTotalDocs = result.totalDocs || result.logs.length;
    const totalPages = Math.ceil(_historyTotalDocs / 15) || 1;

    let html = '<div class="history-cards">';

    result.logs.forEach(item => {
        const log = item.data;
        const time = log.timestamp ? new Date(log.timestamp.toDate()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
        html += `
            <div class="history-card" data-doc-id="${item.id}">
                <div class="history-card-header">
                    <span class="history-time">${time}</span>
                    <span class="history-warehouse">${esc(log.warehouse || '—')}</span>
                </div>
                <div class="history-action">${esc(log.action || '—')}</div>
                <div class="history-details">${esc(log.details || '—')}</div>
                <button class="delete-log-btn" data-doc-id="${item.id}">Удалить запись</button>
            </div>`;
    });

    html += '</div>';

    if (totalPages > 1) {
        html += '<div class="pagination">';
        html += `<button data-page="1" ${_historyPage === 1 ? 'disabled' : ''}>&#x23EE;</button>`;
        html += `<button data-page="${_historyPage - 1}" ${_historyPage === 1 ? 'disabled' : ''}>&#x2039;</button>`;
        html += `<span class="page-info">${_historyPage} / ${totalPages}</span>`;
        html += `<button data-page="${_historyPage + 1}" ${_historyPage === totalPages ? 'disabled' : ''}>&#x203A;</button>`;
        html += `<button data-page="${totalPages}" ${_historyPage === totalPages ? 'disabled' : ''}>&#x23ED;</button>`;
        html += '</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll('.delete-log-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const docId = btn.dataset.docId;
            if (!docId || !confirm('Удалить эту запись навсегда?\n\nЭто действие нельзя отменить.')) return;
            await deleteWorkLog(docId);
            toast.success('Запись удалена');
            renderHistory(dateStr);
            updateSalaryDisplay();
        });
    });

    container.querySelectorAll('.pagination button:not([disabled])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _historyPage = parseInt(btn.dataset.page);
            renderHistory(dateStr);
        });
    });
}

// ===== ПОСЕЩАЕМОСТЬ =====
async function checkAttendanceUI() {
    const user = getSession();
    if (!user) return;
    const status = await hasCheckedIn(user.id);
    
    const me = document.getElementById('moscowWorkedToday');
    if (me) {
        me.textContent = status.moscow ? 'Отмечено' : 'Не отмечено';
        me.style.color = status.moscow ? '#059669' : '#6b7280';
    }
    const pe = document.getElementById('pushkinoWorkedToday');
    if (pe) {
        pe.textContent = status.pushkino ? 'Отмечено' : 'Не отмечено';
        pe.style.color = status.pushkino ? '#059669' : '#6b7280';
    }
}

// ===== ЗАРПЛАТА =====
async function updateSalaryDisplay() {
    const user = getSession();
    if (!user) return;
    try {
        const todayData = await calculateSalary(user.id, user.warehouseRole, getTodayStr(), getTodayStr());
        const salaryEl = document.getElementById('salaryInline');
        if (salaryEl) {
            salaryEl.textContent = todayData.total.toLocaleString('ru-RU') + ' ₽';
            salaryEl.classList.toggle('zero', todayData.total === 0);
        }
    } catch (e) {}
}

async function renderUserSalary() {
    const container = document.getElementById('userSalaryContent');
    if (!container) return;
    const user = getSession();
    if (!user) return;

    const now = new Date();
    const weekDate = new Date(now); weekDate.setDate(now.getDate() + _salaryWeekOffset * 7);
    const monthDate = new Date(now.getFullYear(), now.getMonth() + _salaryMonthOffset, 1);
    const week = getWeekRange(weekDate);
    const month = getMonthRange(monthDate);

    container.innerHTML = '<div class="loading"><span class="loading-spinner"></span> Загрузка...</div>';

    try {
        const [weekData, monthData, todayRanking] = await Promise.all([
            calculateSalary(user.id, user.warehouseRole, week.start, week.end),
            calculateSalary(user.id, user.warehouseRole, month.start, month.end),
            getDailyRanking(getTodayStr())
        ]);

        const dayRate = getWarehouseRoleRate(user.warehouseRole);

        let html = '<div class="salary-block">';

        // Рейтинг за сегодня
        if (todayRanking.length > 0) {
            html += '<div class="rating-section"><div class="rating-title">🏆 Топ-3 за сегодня</div><div class="rating-list">';
            todayRanking.forEach((item, idx) => {
                const posClass = idx === 0 ? 'top1' : (idx === 1 ? 'top2' : 'top3');
                const meClass = (item.id === user.id) ? ' rating-me' : '';
                html += `<div class="rating-item${meClass}"><div class="rating-position ${posClass}">${idx + 1}</div><span class="rating-name">${esc(item.name)}</span><span class="rating-score">${item.total.toLocaleString('ru-RU')} ₽</span></div>`;
            });
            html += '</div></div>';
        }

        // Неделя
        html += `<div class="salary-section">
            <div class="salary-section-header">
                <span class="salary-section-title">Неделя</span>
                <div class="salary-section-nav">
                    <button class="salary-nav-btn" onclick="event.stopPropagation();window.loadUserSalaryBlock(${_salaryWeekOffset - 1},${_salaryMonthOffset})">←</button>
                    <span class="salary-date-range">${formatDateForDisplay(week.start)}—${formatDateForDisplay(week.end)}</span>
                    <button class="salary-nav-btn" onclick="event.stopPropagation();window.loadUserSalaryBlock(${_salaryWeekOffset + 1},${_salaryMonthOffset})">→</button>
                </div>
            </div>
            <div class="salary-items">`;
        
        const wWh = Object.keys(weekData.attendance);
        if (wWh.length > 0) {
            wWh.forEach(wh => {
                const a = weekData.attendance[wh];
                html += `<div class="salary-item"><span class="salary-item-label">Выходы: ${wh}</span><span class="salary-item-value">${a.days} дн.  ${a.amount.toLocaleString('ru-RU')} ₽</span></div>`;
            });
        } else {
            html += '<div class="salary-item"><span class="salary-item-label">Нет выходов</span><span class="salary-item-value">—</span></div>';
        }
        
        weekData.kpi.forEach(k => {
            const unit = k.unit || (k.reason === 'Сборка паллет' ? 'палл.' : 'ед.');
            html += `<div class="salary-item"><span class="salary-item-label">${k.reason}</span><span class="salary-item-value">${k.qty} ${unit}  ${k.amount.toLocaleString('ru-RU')} ₽</span></div>`;
        });
        
        html += '</div><div class="salary-divider"></div>';
        html += `<div class="salary-total"><span>Итого за неделю</span><span class="salary-total-value">${weekData.total.toLocaleString('ru-RU')} ₽</span></div>`;
        html += '</div>';

        // Месяц
        html += `<div class="salary-section">
            <div class="salary-section-header">
                <span class="salary-section-title">Месяц</span>
                <div class="salary-section-nav">
                    <button class="salary-nav-btn" onclick="event.stopPropagation();window.loadUserSalaryBlock(${_salaryWeekOffset},${_salaryMonthOffset - 1})">←</button>
                    <span class="salary-date-range">${getMonthName(month.start)}</span>
                    <button class="salary-nav-btn" onclick="event.stopPropagation();window.loadUserSalaryBlock(${_salaryWeekOffset},${_salaryMonthOffset + 1})">→</button>
                </div>
            </div>
            <div class="salary-items">`;
        
        const mWh = Object.keys(monthData.attendance);
        if (mWh.length > 0) {
            mWh.forEach(wh => {
                const a = monthData.attendance[wh];
                html += `<div class="salary-item"><span class="salary-item-label">Выходы: ${wh}</span><span class="salary-item-value">${a.days} дн.  ${a.amount.toLocaleString('ru-RU')} ₽</span></div>`;
            });
        } else {
            html += '<div class="salary-item"><span class="salary-item-label">Нет выходов</span><span class="salary-item-value">—</span></div>';
        }
        
        monthData.kpi.forEach(k => {
            const unit = k.unit || (k.reason === 'Сборка паллет' ? 'палл.' : 'ед.');
            html += `<div class="salary-item"><span class="salary-item-label">${k.reason}</span><span class="salary-item-value">${k.qty} ${unit}  ${k.amount.toLocaleString('ru-RU')} ₽</span></div>`;
        });
        
        html += '</div><div class="salary-divider"></div>';
        html += `<div class="salary-total"><span>Итого за месяц</span><span class="salary-total-value">${monthData.total.toLocaleString('ru-RU')} ₽</span></div>`;
        html += '</div>';

        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#ff3b30;">Ошибка загрузки</div>';
    }
}