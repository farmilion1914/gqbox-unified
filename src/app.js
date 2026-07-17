// ==================== GQBOX UNIFIED — РОУТЕР ====================

import { initFirebase } from './services/firebase.js';
import { toast } from './services/toast.js';
import { esc } from './utils/helpers.js';
import { getSession, saveSession, clearSession, loginUser, restoreSession } from './modules/auth.js';
import { initPWA } from './ui/pwa.js';

// ===== ССЫЛКИ НА КОНТЕЙНЕРЫ =====
const $ = (id) => document.getElementById(id);

function getContainers() {
    return {
        root: $('appRoot'),
        tabBar: $('iosTabBar'),
        scannerOverlay: $('scannerOverlay'),
    };
}

// ===== СКРЫТЬ ВСЕ ИНТЕРФЕЙСЫ =====
function hideAllUI() {
    const c = getContainers();
    if (c.tabBar) c.tabBar.style.display = 'none';
    // scannerOverlay управляется через scanner.js (класс active), не трогаем
}

// ===== ЭКРАН ВХОДА =====
function renderLoginScreen() {
    return `
        <div class="app-container">
            <div class="login-screen" id="loginScreen">
                <div class="login-card">
                    <div class="logo-container">
                        <div class="logo-oval"><span class="logo-text">GQBOX</span></div>
                    </div>
                    <div class="error-msg" id="loginError" style="display:none;"></div>
                    <div class="input-group-login">
                        <div class="input-label">Логин</div>
                        <input type="text" class="login-input" id="loginUser" placeholder="username" autocomplete="username">
                    </div>
                    <div class="input-group-login">
                        <div class="input-label">Пароль</div>
                        <input type="password" class="login-input" id="loginPass" placeholder="••••••" autocomplete="current-password">
                    </div>
                    <button class="login-btn" id="doLogin">Войти</button>

                    <div class="reg-toggle" id="regToggle">Нет аккаунта? Зарегистрироваться</div>

                    <div class="reg-form" id="regForm" style="display:none;">
                        <div class="form-title" style="margin-top:18px;">Регистрация</div>
                        <div class="error-msg" id="regError" style="display:none;"></div>
                        <div class="input-group-login">
                            <div class="input-label">Имя</div>
                            <input type="text" class="login-input" id="regName" placeholder="Ваше имя" autocomplete="name">
                        </div>
                        <div class="input-group-login">
                            <div class="input-label">Логин</div>
                            <input type="text" class="login-input" id="regLogin" placeholder="username" autocomplete="username">
                        </div>
                        <div class="input-group-login">
                            <div class="input-label">Пароль</div>
                            <input type="password" class="login-input" id="regPass" placeholder="••••••" autocomplete="new-password">
                        </div>
                        <div class="input-label" style="margin-top:10px;">Кто вы?</div>
                        <div class="role-select-grid" id="regRoleGrid">
                            <button type="button" class="role-pick" data-role="warehouse">Кладовщик</button>
                            <button type="button" class="role-pick" data-role="packer">Упаковщица</button>
                            <button type="button" class="role-pick" data-role="operator">Оператор</button>
                        </div>
                        <button class="reg-btn" id="doRegister">Зарегистрироваться</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== ЭКРАН ВЫБОРА РОЛИ =====
function renderRoleSelect() {
    return `
        <div class="app-container">
            <div class="glass-card" style="max-width:480px;margin:0 auto;text-align:center;">
                <h2 style="margin-bottom:20px;color:var(--text);">Выберите вашу роль</h2>
                <p style="color:var(--text-secondary);margin-bottom:20px;">Это определит доступный вам интерфейс</p>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <button class="btn-primary role-choice-btn" data-role="packer" style="width:100%;padding:14px;font-size:0.9rem;">📦 Я упаковщица</button>
                    <button class="btn-primary role-choice-btn" data-role="operator" style="width:100%;padding:14px;font-size:0.9rem;">🖥️ Я оператор</button>
                    <button class="btn-primary role-choice-btn" data-role="warehouse" style="width:100%;padding:14px;font-size:0.9rem;">🏭 Я кладовщик</button>
                </div>
            </div>
        </div>
    `;
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
export async function renderApp() {
    const c = getContainers();
    if (!c.root) return;

    const session = getSession();

    // === НЕ ЗАЛОГИНЕН ===
    if (!session) {
        hideAllUI();
        c.root.innerHTML = renderLoginScreen();
        attachLoginEvents();
        return;
    }

    // === РОЛЬ НЕ ВЫБРАНА ===
    if (session.appRole === 'unknown') {
        hideAllUI();
        c.root.innerHTML = renderRoleSelect();
        attachRoleSelectEvents(session);
        return;
    }

    // === АДМИН ===
    if (session.isAdmin) {
        hideAllUI();
        c.root.innerHTML = '<div class="app-container"><div class="loading-spinner">Загрузка админ-панели...</div></div>';

        const { renderAdminPanel, attachAdminEvents } = await import('./modules/admin.js');
        c.root.innerHTML = await renderAdminPanel(session);
        attachAdminEvents();
        return;
    }

    // === УПАКОВЩИЦА / ОПЕРАТОР ===
    if (session.appRole === 'packer' || session.appRole === 'operator') {
        hideAllUI();
        if (c.tabBar) c.tabBar.style.display = 'flex';
        c.root.innerHTML = '<div class="app-container"><div class="loading-spinner">Загрузка...</div></div>';

        const { renderUserPanel, attachUserEvents } = await import('./modules/packing-ui.js');
        c.root.innerHTML = await renderUserPanel(session);
        attachUserEvents();
        return;
    }

    // === КЛАДОВЩИК ===
    if (session.appRole === 'warehouse') {
        hideAllUI();
        c.root.innerHTML = '<div class="app-container"><div class="loading-spinner">Загрузка...</div></div>';

        const { renderWarehousePanel, attachWarehouseEvents } = await import('./modules/warehouse-ui.js');
        c.root.innerHTML = await renderWarehousePanel(session);
        attachWarehouseEvents();
        return;
    }
}

// ===== СОБЫТИЯ ВХОДА =====
function attachLoginEvents() {
    const doLogin = async () => {
        const loginEl = $('loginUser');
        const passEl = $('loginPass');
        const errorEl = $('loginError');
        const loginBtn = $('doLogin');

        if (!loginEl || !passEl || !errorEl || !loginBtn) return;

        const login = loginEl.value.trim();
        const password = passEl.value.trim();

        if (!login || !password) {
            errorEl.style.display = 'block';
            errorEl.innerText = 'Введите логин и пароль';
            return;
        }

        errorEl.style.display = 'none';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Вход...';

        const user = await loginUser(login, password);
        if (!user) {
            errorEl.style.display = 'block';
            errorEl.innerText = 'Неверный логин или пароль';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Войти';
            return;
        }

        toast.success('Добро пожаловать, ' + user.name + '!');
        renderApp();
    };

    const loginBtn = $('doLogin');
    const passEl = $('loginPass');

    if (loginBtn) loginBtn.onclick = doLogin;
    if (passEl) {
        passEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doLogin();
        });
    }

    // ===== ПЕРЕКЛЮЧАТЕЛЬ РЕГИСТРАЦИИ =====
    const regToggle = $('regToggle');
    const regForm = $('regForm');
    if (regToggle && regForm) {
        regToggle.onclick = () => {
            const hidden = regForm.style.display === 'none';
            regForm.style.display = hidden ? 'block' : 'none';
            regToggle.textContent = hidden ? 'У меня уже есть аккаунт' : 'Нет аккаунта? Зарегистрироваться';
        };
    }

    // ===== ВЫБОР РОЛИ В РЕГИСТРАЦИИ =====
    let selectedRegRole = null;
    const roleGrid = $('regRoleGrid');
    if (roleGrid) {
        roleGrid.querySelectorAll('.role-pick').forEach(btn => {
            btn.onclick = () => {
                roleGrid.querySelectorAll('.role-pick').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedRegRole = btn.dataset.role;
            };
        });
    }

    // ===== РЕГИСТРАЦИЯ =====
    const doRegister = async () => {
        const nameEl = $('regName');
        const loginEl = $('regLogin');
        const passEl = $('regPass');
        const errorEl = $('regError');
        const regBtn = $('doRegister');

        if (!nameEl || !loginEl || !passEl || !errorEl || !regBtn) return;

        const name = nameEl.value.trim();
        const login = loginEl.value.trim();
        const password = passEl.value.trim();

        if (!name || !login || !password) {
            errorEl.style.display = 'block';
            errorEl.innerText = 'Заполните все поля';
            return;
        }
        if (password.length < 4) {
            errorEl.style.display = 'block';
            errorEl.innerText = 'Пароль минимум 4 символа';
            return;
        }
        if (!selectedRegRole) {
            errorEl.style.display = 'block';
            errorEl.innerText = 'Выберите кто вы';
            return;
        }

        errorEl.style.display = 'none';
        regBtn.disabled = true;
        regBtn.textContent = 'Регистрация...';

        const { registerUser } = await import('./modules/auth.js');
        const result = await registerUser(login, password, name, selectedRegRole);

        if (!result.success) {
            errorEl.style.display = 'block';
            errorEl.innerText = result.error;
            regBtn.disabled = false;
            regBtn.textContent = 'Зарегистрироваться';
            return;
        }

        toast.success('Аккаунт создан! Войдите в систему');
        regForm.style.display = 'none';
        regToggle.textContent = 'Нет аккаунта? Зарегистрироваться';
        regBtn.disabled = false;
        regBtn.textContent = 'Зарегистрироваться';
        if (loginEl) loginEl.value = '';
        if (passEl) passEl.value = '';
        if (nameEl) nameEl.value = '';
        if (roleGrid) roleGrid.querySelectorAll('.role-pick').forEach(b => b.classList.remove('active'));
        selectedRegRole = null;
    };

    const regBtnEl = $('doRegister');
    if (regBtnEl) regBtnEl.onclick = doRegister;
}

// ===== СОБЫТИЯ ВЫБОРА РОЛИ =====
function attachRoleSelectEvents(session) {
    document.querySelectorAll('.role-choice-btn').forEach(btn => {
        btn.onclick = () => {
            const role = btn.dataset.role;
            session.appRole = role;
            saveSession(session);
            toast.success('Роль выбрана: ' + role);
            renderApp();
        };
    });
}

// ===== ВЫХОД (глобальный) =====
window.doLogout = function () {
    clearSession();
    renderApp();
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function init() {
    console.log('GQbox Unified запускается...');
    initFirebase();

    try {
        firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => {});
    } catch (e) {}

    initPWA();

    document.addEventListener('click', (e) => {
        if (e.target.closest('.logout') || e.target.closest('#logoutBtn') || e.target.closest('#logoutBtnWH')) {
            window.doLogout();
        }
    });

    const session = await restoreSession();
    if (session) {
        toast.success('С возвращением, ' + session.name + '!');
    }

    renderApp();
}

document.addEventListener('DOMContentLoaded', init);