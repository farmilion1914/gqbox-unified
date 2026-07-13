# Архитектура GQbox Unified

## 1. Обзор

GQbox Unified — одностраничное PWA-приложение для управления учётом упаковщиц (Wildberries / Ozon) и кладовщиков. Поддерживает две независимые базы Firebase и гибкую систему ролей.

**Технологии:** Vanilla JS (ES Modules), Firebase Firestore, HTML5-QRCode, PWA (Service Worker)

---

## 2. Структура проекта

```
gqbox-unified/
├── index.html              # Входная точка (CDN Firebase, QR, CSS, app.js)
├── src/
│   ├── app.js              # [РОУТЕР] Инициализация, экраны логина/выбора роли
│   ├── config.js           # Конфигурация Firebase, списки складов, ставки, KPI
│   │
│   ├── modules/            # Бизнес-логика и UI по ролям
│   │   ├── auth.js         # Авторизация, сессии, регистрация
│   │   ├── packing.js      # БЛ упаковки (записи, расчёт зарплаты)
│   │   ├── packing-ui.js   # UI упаковщицы / оператора
│   │   ├── warehouse.js    # БЛ склада (work_logs, KPI, фото паллет)
│   │   ├── warehouse-ui.js # UI кладовщика
│   │   ├── admin.js        # Админ-панель (упаковщицы)
│   │   ├── admin-warehouse.js # Админ-панель (склад)
│   │   ├── attendance.js   # Отметки посещаемости
│   │   ├── salary.js       # Зарплата упаковщиц (расчёты, история)
│   │   ├── salary-warehouse.js # Зарплата кладовщиков
│   │   ├── scanner.js      # Сканер штрихкодов (HTML5-QRCode)
│   │   ├── photos.js       # Фото паллет (камера + хранение)
│   │   └── location.js     # Геолокация
│   │
│   ├── services/           # Сервисный слой (Firebase, кэш, уведомления)
│   │   ├── firebase.js     # Инициализация 2х Firebase проектов
│   │   ├── cache.js        # Кэш сессии (sessionStorage)
│   │   └── toast.js        # Система тост-уведомлений
│   │
│   ├── ui/                 # Переиспользуемые UI-компоненты
│   │   ├── popups.js       # Модальные окна / поп-апы
│   │   └── pwa.js          # PWA (Service Worker, офлайн)
│   │
│   ├── utils/              # Утилиты
│   │   ├── helpers.js      # Общие хелперы (esc и др.)
│   │   └── dates.js        # Работа с датами
│   │
│   └── styles/ (CSS-файлы находятся в src/)
│       ├── styles-base.css      # Базовые стили (переменные, сброс, карточки, тосты)
│       ├── styles-admin.css     # Стили админ-панели
│       ├── styles-packing.css   # Стили интерфейса упаковщиц
│       └── styles-warehouse.css # Стили интерфейса кладовщиков
```

---

## 3. Поток загрузки

```
index.html
├── Firebase SDK (CDN)
├── HTML5-QRCode (CDN)
├── styles-base.css
├── styles-admin.css / styles-packing.css / styles-warehouse.css
└── src/app.js (module, defer)
    ├── services/firebase.js     → инициализация 2х Firebase App
    ├── services/toast.js        → система уведомлений
    ├── utils/helpers.js         → ESC, прочие утилиты
    ├── modules/auth.js          → loginUser(), restoreSession()
    ├── ui/pwa.js                → регистрация SW, установка
    └── lazy import по роли:
        ├── modules/packing-ui.js    → packer / operator
        ├── modules/warehouse-ui.js  → warehouse
        └── modules/admin.js         → admin
```

---

## 4. Система Firebase

Приложение использует **два независимых Firebase проекта**:

| Проект | Назначение | Коллекции |
|--------|-----------|-----------|
| `packing23-11afd` | Упаковщицы / Ozon / WB | `employees`, `pack_records`, `attendance`, `salary_history` |
| `warehouse-b6b75` | Кладовщики (склад) | `employees`, `work_logs`, `salary_logs`, `pallet_photos`, `warehouse_settings` |

> `app.js` (роутер) не привязан к конкретной БД — каждый модуль сам решает, какую БД использовать через `getDB()` / `getWarehouseDB()` из `services/firebase.js`.

---

## 5. Авторизация и роли

### 5.1. Вход (`modules/auth.js`)

1. Ищет пользователя по `login` + `password` в `packing23-11afd.employees`
2. Если не найден — ищет в `warehouse-b6b75.employees`
3. Определяет `appRole` по наличию записей в соответствующих коллекциях:
   - `pack_records` + `attendance` → `packer` / `operator`
   - `work_logs` или `warehouseRole` → `warehouse`
   - `role === 'admin' / 'superadmin'` → `admin`
4. Сохраняет сессию в `sessionStorage`

### 5.2. Роли

| appRole | Описание | Модуль |
|---------|----------|--------|
| `packer` | Упаковщица (WB/Ozon) | `packing-ui.js` |
| `operator` | Оператор (отличается ставкой, правами) | `packing-ui.js` |
| `warehouse` | Кладовщик | `warehouse-ui.js` |
| `admin` | Админ (упаковщицы) | `admin.js` |
| `admin` + `warehouseRole` | Админ склада | `admin-warehouse.js` |
| `unknown` | Пользователь без роли → экран выбора роли | - |

### 5.3. Сессия

- Хранится в `sessionStorage` под ключом `gqbox_unified_session`
- Менеджер: `cache.js` (обёртка над `sessionStorage`)
- При загрузке: `restoreSession()` проверяет существование пользователя в любой из двух БД

---

## 6. Роутер (`app.js`)

### 6.1. Логика рендеринга

```
renderApp()
 ├── Нет сессии → renderLoginScreen() + attachLoginEvents()
 ├── appRole === 'unknown' → renderRoleSelect() + attachRoleSelectEvents()
 ├── isAdmin → import('./admin.js') → renderAdminPanel() + attachAdminEvents()
 ├── packer / operator → import('./packing-ui.js') → renderUserPanel() + attachUserEvents()
 └── warehouse → import('./warehouse-ui.js') → renderWarehousePanel() + attachWarehouseEvents()
```

### 6.2. Таб-бар

- Отображается только для `packer` / `operator`
- Вкладки: **Упаковка**, **Зарплата**, **История**

### 6.3. Сканер штрихкодов

- Общий `scannerOverlay` в `index.html`
- Управляется через `modules/scanner.js`
- Использует `Html5Qrcode` из CDN

---

## 7. Модули (бизнес-логика)

### 7.1. Упаковщицы (`packing.js`, `packing-ui.js`)

- **pack_records**: дата, смена (day/night), кол-во, склад, ИП, город, QR
- **Расчёт зарплаты**: `2500 × KV × quantity / 1000` (KV зависит от кол-ва)
- **Attendance**: отметка начала/конца смены с геолокацией
- **Salary**: расчёт за месяц, история выплат
- **Сканер**: привязка QR-кода к записи

### 7.2. Кладовщики (`warehouse.js`, `warehouse-ui.js`)

- **work_logs**: дата, тип работы, количество, коэффициент
- **KPI**: `collect` (сборка паллет) = 100 ₽/палл, `lay` (выкладка) = 0.1 ₽/ед.
- **Фото паллет**: до 4 фото, привязка к паллете (город, номер)
- **Роли склада**: senior, admin, pro, standard, probation (разные дневные ставки)
- **Аккордеоны**: каждая группа операций свёрнута в `.accordion-item` с шапкой `.accordion-header` и содержимым `.accordion-content`. При клике на заголовок аккордеон открывается/закрывается (`.accordion-item.open`). Аккордеоны используются для: сборки по накладной, сборки паллет, отгрузки паллет, выкладки товара, приёма коробов, фото паллет, зарплаты
- **Переключение складов**: два склада — Москва и Пушкино. Переключение через точки (`.swipe-dot`) в верхней панели или горизонтальным свайпом (порог 60px). Каждый склад имеет свой набор аккордеонов с операциями
- **Счётчики**: каждый вид операции имеет счётчик (`counter-value`), кнопки `+/−` (шаг 1), ручной ввод с кнопкой "Уст." и кнопку "сброс". При нажатии "ОК" значение счётчика фиксируется в `work_logs` через `addWorkLog()`

### 7.3. Админка (`admin.js`, `admin-warehouse.js`)

- Управление сотрудниками (CRUD)
- Просмотр/редактирование записей
- Статистика
- Логи действий

---

## 8. Маршрутизация данных (Firestore)

```
modules/auth.js
  ├── getDB()           → packing23-11afd
  └── getWarehouseDB()  → warehouse-b6b75

modules/packing.js      → getDB()          (packing23-11afd)
modules/attendance.js   → getDB()          (packing23-11afd)
modules/salary.js       → getDB()          (packing23-11afd)
modules/admin.js        → getDB()          (packing23-11afd)

modules/warehouse.js    → getWarehouseDB() (warehouse-b6b75)
modules/photos.js       → getWarehouseDB() (warehouse-b6b75)
modules/salary-warehouse.js → getWarehouseDB() (warehouse-b6b75)
modules/admin-warehouse.js  → getWarehouseDB() (warehouse-b6b75)

modules/scanner.js      → не использует БД (только камера)
modules/location.js     → не использует БД (только геолокация)
```

---

## 9. UI-компоненты

### popups.js
- `showPopup(html, options)` — универсальное модальное окно
- `showConfirm(message)` — диалог подтверждения
- `showPrompt(message, defaultValue)` — диалог ввода

### toast.js
- `toast.success(msg)` / `toast.error(msg)` / `toast.info(msg)`
- Авто-скрытие через 3-4 сек
- Контейнер `.toast-container` в `index.html`

### pwa.js
- Регистрация Service Worker
- Обработка `beforeinstallprompt`
- Офлайн-поддержка

---

## 10. CSS / Стилизация

| Файл | Назначение |
|------|-----------|
| `styles-base.css` | CSS-переменные, сброс, общие классы (карточки, кнопки, тосты, лоадеры), iOS-таббар |
| `styles-admin.css` | Таблицы админки, модалки управления пользователями |
| `styles-packing.css` | Интерфейс упаковщиц (счётчик, поля ввода, раскладка) |
| `styles-warehouse.css` | Интерфейс кладовщиков (KPI-панель, фото паллет) |

Принцип наследования: `base → admin`, `base → packing`, `base → warehouse`. Каждый следующий переопределяет и дополняет базовые классы.

---

## 11. Конфигурация (`config.js`)

### Два Firebase проекта
```js
FIREBASE_CONFIG          → packing23-11afd
FIREBASE_CONFIG_WAREHOUSE → warehouse-b6b75
```

### Склады
- **WB Cities**: Казань, Краснодар, Невинномысск, Екатеринбург, Шушары, ...
- **Ozon**: direct (Хоругвино, Софьино, ...), crossdock (Радумля, Ногинск)

### Ставки
- Упаковщицы: `2500 × KV × qty / 1000` (KV от 1.0 до 1.4)
- Кладовщики: дневная ставка от 2500 до 4000 (по роли), KPI (collect 100 ₽/палл, lay 0.1 ₽/ед)

---

## 12. Ключевые паттерны

1. **Lazy loading модулей**: `import('./module.js')` в роутере при переходе на роль
2. **Единая точка входа**: `app.js` управляет всеми переходами между экранами
3. **Две БД с автопоиском**: `auth.js` ищет пользователя в обеих базах, определяет роль
4. **renderPanel() + attachEvents()**: каждый модуль экспортирует пару функций для рендера и привязки событий
5. **Сессия через sessionStorage**: кэш с проверкой существования пользователя
6. **Кэш сотрудников**: in-memory кэш с TTL 60 сек
7. **lazy import ⚠️**: Все модули экранов грузятся динамически, что сокращает начальный бандл

---

## 13. Диаграмма (текстовая)

```
index.html
  │
  ├── app.js [роутер]
  │     │
  │     ├── auth.js ──── getDB() ─── packing23-11afd.employees
  │     │              └─ getWarehouseDB() ── warehouse-b6b75.employees
  │     │
  │     ├── [не залогинен] → renderLoginScreen()
  │     ├── [нет роли]     → renderRoleSelect()
  │     ├── [admin]        → admin.js → getDB() (packing23-11afd)
  │     │                               getWarehouseDB() (warehouse-b6b75)
  │     ├── [packer/operator] → packing-ui.js → packing.js → getDB()
  │     │                                        attendance.js → getDB()
  │     │                                        salary.js → getDB()
  │     │                                        scanner.js
  │     └── [warehouse] → warehouse-ui.js → warehouse.js → getWarehouseDB()
  │                                          photos.js → getWarehouseDB()
  │                                          salary-warehouse.js → getWarehouseDB()
  │
  ├── services/
  │   ├── firebase.js → Firebase App #1 (packing23-11afd)
  │   │                └─ Firebase App #2 (warehouse-b6b75)
  │   ├── cache.js    → sessionStorage
  │   └── toast.js    → DOM-уведомления
  │
  ├── ui/
  │   ├── popups.js   → модальные окна
  │   └── pwa.js      → Service Worker
  │
  └── utils/
      ├── helpers.js
      └── dates.js