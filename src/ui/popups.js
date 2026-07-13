// ==================== ПОПАПЫ И МОДАЛЬНЫЕ ОКНА ====================

import { toast } from '../services/toast.js';
import { esc, escHtml, escAttr, isPWA, getOS } from '../utils/helpers.js';
import { WB_CITIES, ALL_OZON_STORES, IP_LIST, isCrossdock } from '../config.js';
import { saveUserLocation, saveUserIP, getFrequentCities } from '../modules/location.js';

// ===== SMART SELECT ДЛЯ ГОРОДОВ =====
function createSmartCitySelect(container, cities, inputId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'smart-select-wrapper';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = inputId;
    input.className = 'smart-select-input';
    input.placeholder = 'Введите или выберите город...';
    input.autocomplete = 'off';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'smart-select-dropdown';
    
    wrapper.appendChild(input);
    wrapper.appendChild(dropdown);
    
    let highlightedIndex = -1;
    let allOptions = [];
    
    function renderDropdown(filter) {
        filter = (filter || '').toLowerCase().trim();
        const frequent = getFrequentCities();
        
        let filtered = cities;
        if (filter) {
            filtered = cities.filter(c => c.toLowerCase().includes(filter));
        }
        
        const remaining = filtered.filter(c => !frequent.includes(c));
        
        let html = '';
        allOptions = [];
        
        if (frequent.length > 0 && !filter) {
            html += '<div class="smart-section-label">Часто используемые</div>';
            frequent.forEach(c => {
                allOptions.push(c);
                html += `<div class="smart-option" data-value="${escAttr(c)}">${escHtml(c)}</div>`;
            });
            
            if (remaining.length > 0) {
                html += '<div class="smart-section-label">Остальные</div>';
            }
        }
        
        remaining.forEach(c => {
            allOptions.push(c);
            html += `<div class="smart-option" data-value="${escAttr(c)}">${escHtml(c)}</div>`;
        });
        
        if (allOptions.length === 0) {
            html += '<div class="smart-option text-muted" style="cursor:default;">Ничего не найдено</div>';
        }
        
        dropdown.innerHTML = html;
        highlightedIndex = -1;
        
        dropdown.querySelectorAll('.smart-option[data-value]').forEach((opt, i) => {
            opt.addEventListener('click', () => {
                input.value = opt.dataset.value;
                dropdown.classList.remove('show');
            });
        });
    }
    
    input.addEventListener('focus', () => {
        renderDropdown(input.value);
        dropdown.classList.add('show');
    });
    
    input.addEventListener('input', () => {
        renderDropdown(input.value);
        dropdown.classList.add('show');
    });
    
    input.addEventListener('keydown', (e) => {
        const opts = dropdown.querySelectorAll('.smart-option[data-value]');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (highlightedIndex < opts.length - 1) highlightedIndex++;
            updateHighlight(opts);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (highlightedIndex > 0) highlightedIndex--;
            updateHighlight(opts);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < opts.length) {
                input.value = opts[highlightedIndex].dataset.value;
            }
            dropdown.classList.remove('show');
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('show');
            input.blur();
        }
    });
    
    function updateHighlight(opts) {
        opts.forEach(o => o.classList.remove('highlighted'));
        if (highlightedIndex >= 0 && highlightedIndex < opts.length) {
            opts[highlightedIndex].classList.add('highlighted');
            opts[highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
    
    return { wrapper, input, dropdown };
}

// ===== ПОПАП ВЫБОРА СКЛАДА =====
function showLocationPopup(userId, currentLoc, onSave) {
    const existing = document.querySelector('.popup-overlay');
    if (existing) {
        existing.classList.add('closing');
        setTimeout(() => existing.remove(), 200);
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const currentMp = currentLoc ? currentLoc.marketplace : 'WB';
    
    overlay.innerHTML = `
        <div class="popup-panel" id="locationPopupPanel">
            <div class="popup-handle"></div>
            <div class="popup-title">
                <span>Выбор склада</span>
                <button class="popup-close">✕</button>
            </div>
            <div class="input-field">
                <label>Маркетплейс</label>
                <select id="popupMp">
                    <option value="WB" ${currentMp === 'WB' ? 'selected' : ''}>WB</option>
                    <option value="OZON" ${currentMp === 'OZON' ? 'selected' : ''}>OZON</option>
                </select>
            </div>
            <div id="popupLocationContent" style="margin-top:7px;"></div>
            <div class="confirm-actions" style="margin-top:12px;">
                <button id="popupSaveLocation" class="btn-primary" style="flex:1;">Сохранить</button>
                <button id="popupCancelLocation" class="btn-secondary" style="flex:1;">Отмена</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    let smartSelectInstance = null;
    
    function renderLocationFields() {
        const mp = document.getElementById('popupMp').value;
        const content = document.getElementById('popupLocationContent');
        
        if (smartSelectInstance && smartSelectInstance.wrapper && smartSelectInstance.wrapper.parentNode) {
            smartSelectInstance.wrapper.parentNode.removeChild(smartSelectInstance.wrapper);
            smartSelectInstance = null;
        }
        
        if (mp === 'WB') {
            content.innerHTML = '<div class="input-field"><label>Город WB</label></div>';
            const labelEl = content.querySelector('.input-field');
            const result = createSmartCitySelect(labelEl, WB_CITIES, 'popupWmInput');
            labelEl.appendChild(result.wrapper);
            smartSelectInstance = result;
            
            const prevCity = currentLoc && currentLoc.marketplace === 'WB' ? currentLoc.locationDisplay : '';
            if (prevCity) smartSelectInstance.input.value = prevCity;
        } else {
            const prevStore = currentLoc && currentLoc.marketplace === 'OZON' ? currentLoc.locationRaw : '';
            const prevCityOz = currentLoc && currentLoc.marketplace === 'OZON'
                ? (currentLoc.locationDisplay || '').replace(currentLoc.locationRaw + ' (', '').replace(')', '')
                : '';
            
            content.innerHTML = `
                <div class="input-field">
                    <label>Склад OZON</label>
                    <select id="popupOs">
                        <option value="">-- Выберите --</option>
                        ${ALL_OZON_STORES.map(x => `<option value="${escAttr(x)}" ${x === prevStore ? 'selected' : ''}>${esc(x)}</option>`).join('')}
                    </select>
                    <div id="popupOtb" style="margin-top:4px;display:none;">
                        <label>Город назначения</label>
                        <select id="popupOts">
                            <option value="">-- Выберите --</option>
                            <option>Екатеринбург</option>
                            <option>Челябинск</option>
                            <option>Тюмень</option>
                            <option>Казань</option>
                            <option>Новосибирск</option>
                        </select>
                        <input type="text" id="popupOtm" class="input-field" placeholder="Или введите" style="margin-top:3px;">
                    </div>
                </div>
            `;
            
            const ws = document.getElementById('popupOs');
            const tb = document.getElementById('popupOtb');
            
            const updateFn = () => {
                tb.style.display = (ws.value && isCrossdock(ws.value)) ? 'block' : 'none';
            };
            
            ws.onchange = updateFn;
            updateFn();
            
            if (prevCityOz) {
                const ots = document.getElementById('popupOts');
                if (ots) ots.value = prevCityOz;
                const otm = document.getElementById('popupOtm');
                if (otm) otm.value = prevCityOz;
            }
        }
    }
    
    document.getElementById('popupMp').addEventListener('change', renderLocationFields);
    renderLocationFields();
    
    function closePopup() {
        overlay.classList.add('closing');
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 200);
    }
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePopup();
    });
    
    overlay.querySelector('.popup-close').onclick = closePopup;
    document.getElementById('popupCancelLocation').onclick = closePopup;
    
    document.getElementById('popupSaveLocation').onclick = async () => {
        const mp = document.getElementById('popupMp').value;
        let locationDisplay = '';
        let locationRaw = '';
        
        if (mp === 'WB') {
            locationDisplay = smartSelectInstance ? smartSelectInstance.input.value.trim() : '';
            if (!locationDisplay) {
                toast.warning('Укажите город');
                return;
            }
            locationRaw = locationDisplay;
        } else {
            const store = document.getElementById('popupOs')?.value;
            if (!store) {
                toast.warning('Выберите склад');
                return;
            }
            locationRaw = store;
            
            if (isCrossdock(store)) {
                const city = document.getElementById('popupOts')?.value || document.getElementById('popupOtm')?.value;
                if (!city) {
                    toast.warning('Укажите город');
                    return;
                }
                locationDisplay = store + ' (' + city + ')';
            } else {
                locationDisplay = store;
            }
        }
        
        await saveUserLocation(userId, mp, locationDisplay, locationRaw);
        closePopup();
        toast.success('Склад сохранен');
        
        if (onSave) onSave({ marketplace: mp, locationDisplay, locationRaw });
    };
}

// ===== ПОПАП ВЫБОРА ИП =====
function showIpPopup(userId, currentIp, onSave) {
    const existing = document.querySelector('.popup-overlay');
    if (existing) {
        existing.classList.add('closing');
        setTimeout(() => existing.remove(), 200);
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const chips = IP_LIST.map(ip =>
        `<div class="ip-chip${ip === currentIp ? ' selected' : ''}" data-ip="${ip}">${ip}</div>`
    ).join('');
    
    overlay.innerHTML = `
        <div class="popup-panel compact" id="ipPopupPanel">
            <div class="popup-handle"></div>
            <div class="popup-title">
                <span>Выбор ИП</span>
                <button class="popup-close">✕</button>
            </div>
            <div class="ip-quick-select">
                ${chips}
                <div class="ip-chip none${!currentIp ? ' selected' : ''}" data-ip="">Без ИП</div>
            </div>
            <div class="confirm-actions" style="margin-top:12px;">
                <button id="popupSaveIp" class="btn-primary" style="flex:1;">Сохранить</button>
                <button id="popupCancelIp" class="btn-secondary" style="flex:1;">Отмена</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    let selectedIp = currentIp || '';
    
    overlay.querySelectorAll('.ip-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            overlay.querySelectorAll('.ip-chip').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedIp = this.dataset.ip;
        });
    });
    
    function closePopup() {
        overlay.classList.add('closing');
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 200);
    }
    
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePopup();
    });
    
    overlay.querySelector('.popup-close').onclick = closePopup;
    document.getElementById('popupCancelIp').onclick = closePopup;
    
    document.getElementById('popupSaveIp').onclick = async () => {
        await saveUserIP(userId, selectedIp);
        closePopup();
        toast.success('ИП сохранен');
        if (onSave) onSave(selectedIp);
    };
}

// ===== CONFIRM DELETE =====
function confirmDelete(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-dialog">
                <p>${escHtml(message)}</p>
                <div class="confirm-actions">
                    <button class="confirm-yes">Да, удалить</button>
                    <button class="confirm-no">Отмена</button>
                </div>
            </div>
        `;
        
        const remove = () => {
            overlay.classList.add('removing');
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 200);
        };
        
        overlay.querySelector('.confirm-yes').onclick = () => { remove(); resolve(true); };
        overlay.querySelector('.confirm-no').onclick = () => { remove(); resolve(false); };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { remove(); resolve(false); }
        });
        
        document.body.appendChild(overlay);
    });
}

export { createSmartCitySelect, showLocationPopup, showIpPopup, confirmDelete };