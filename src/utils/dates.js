// ==================== РАБОТА С ДАТАМИ ====================
// ВСЕ функции работают с локальным временем, без UTC/часовых поясов
// Даты передаются как строки "YYYY-MM-DD"

/**
 * Получение строки даты в формате YYYY-MM-DD (локально)
 */
export function getTodayStr() {
    return formatDateISO(new Date());
}

/**
 * Форматирование даты в ISO (YYYY-MM-DD)
 */
export function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Форматирование даты для отображения (DD.MM.YYYY)
 */
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
}

/**
 * Короткая дата (DD.MM)
 */
export function formatDateShort(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}`;
}

/**
 * Полная дата (DD месяц)
 */
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
export function formatDateFull(date) {
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Месяц Год (для заголовков)
 */
export function formatMonthYear(date) {
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Парсинг строки YYYY-MM-DD в компоненты
 * Возвращает { year, month, day } — числа
 * Важно: month = 1..12 (не 0..11)
 */
function parseDate(dateStr) {
    const parts = dateStr.split('-');
    return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10)
    };
}

/**
 * Сборка даты из компонентов
 */
function makeDateStr(year, month, day) {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

/**
 * День недели по строке YYYY-MM-DD
 * Возвращает: 1=пн, 2=вт, 3=ср, 4=чт, 5=пт, 6=сб, 7=вс
 * Использует формулу Зеллера для конгруэнтности
 */
function getDayOfWeek(dateStr) {
    const { year, month, day } = parseDate(dateStr);
    // Формула Зеллера для григорианского календаря
    // Корректируем месяц: январь и февраль — 13-й и 14-й месяц предыдущего года
    let m = month;
    let y = year;
    if (m <= 2) { m += 12; y--; }
    const q = day;
    const K = y % 100;
    const J = Math.floor(y / 100);
    const h = (q + Math.floor(13 * (m + 1) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7;
    // h: 0=сб, 1=вс, 2=пн, 3=вт, 4=ср, 5=чт, 6=пт
    // конвертируем в 1=пн..7=вс
    return ((h + 5) % 7) + 1;
}

/**
 * Сдвиг даты на N дней (чисто строковая операция)
 */
export function shiftDate(dateStr, days) {
    if (days === 0) return dateStr;
    const { year, month, day } = parseDate(dateStr);
    // Используем Date для сдвига (это безопасно, так как мы работаем с локальным временем)
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
}

/**
 * Получение понедельника недели по любой дате недели
 * @param {string} dateStr - любая дата в формате YYYY-MM-DD
 * @returns {string} YYYY-MM-DD понедельника
 */
export function getWeekMonday(dateStr) {
    const dow = getDayOfWeek(dateStr); // 1=пн..7=вс
    const daysToMonday = 1 - dow; // пн=1 → 0, вт=2 → -1, ср=3 → -2, ..., вс=7 → -6
    return shiftDate(dateStr, daysToMonday);
}

/**
 * Получение воскресенья недели
 * @param {string} mondayStr - понедельник в формате YYYY-MM-DD
 * @returns {string} YYYY-MM-DD воскресенья
 */
export function getWeekSunday(mondayStr) {
    return shiftDate(mondayStr, 6);
}

/**
 * Начало недели (понедельник)
 */
export function getWeekStart(dateStr) {
    return getWeekMonday(dateStr);
}

/**
 * Конец недели (воскресенье)
 */
export function getWeekEnd(dateStr) {
    const monday = getWeekMonday(dateStr);
    return getWeekSunday(monday);
}

/**
 * Начало месяца
 */
export function getMonthStart(dateStr) {
    const { year, month } = parseDate(dateStr);
    return makeDateStr(year, month, 1);
}

/**
 * Конец месяца
 */
export function getMonthEnd(dateStr) {
    const { year, month } = parseDate(dateStr);
    // Следующий месяц, 0-й день = последний день текущего
    const d = new Date(year, month, 0);
    return formatDateISO(d);
}

/**
 * Сдвиг месяца на N месяцев
 */
export function shiftMonth(dateStr, months) {
    const { year, month, day } = parseDate(dateStr);
    const d = new Date(year, month - 1, 1);
    d.setMonth(d.getMonth() + months);
    return formatDateISO(new Date(d.getFullYear(), d.getMonth(), Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())));
}

/**
 * Список дат в диапазоне (включительно)
 */
export function getDatesInRange(startStr, endStr) {
    const result = [];
    let cur = startStr;
    while (cur <= endStr) {
        result.push(cur);
        // Сдвигаем на 1 день
        const { year, month, day } = parseDate(cur);
        const d = new Date(year, month - 1, day);
        d.setDate(d.getDate() + 1);
        cur = formatDateISO(d);
    }
    return result;
}

// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ (для склада) =====

/**
 * Форматирование даты для input[type=date] (YYYY-MM-DD)
 */
export function formatDateForInput(date) {
    if (date instanceof Date) return formatDateISO(date);
    if (typeof date === 'string') return date;
    return '';
}

/**
 * Форматирование даты для отображения (DD.MM.YYYY) — алиас
 */
export function formatDateForDisplay(dateStr) {
    return formatDate(dateStr);
}

/**
 * Получение строки месяца (YYYY-MM)
 */
export function getMonthStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/**
 * Название месяца из строки YYYY-MM
 */
export function getMonthName(monthStr) {
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const parts = monthStr.split('-');
    const m = parseInt(parts[1]) - 1;
    return months[m] + ' ' + parts[0];
}

/**
 * Диапазон недели по дате
 */
export function getWeekRange(date) {
    const monday = getWeekMonday(formatDateISO(date));
    const sunday = getWeekSunday(monday);
    return { start: monday, end: sunday };
}

/**
 * Диапазон месяца по дате
 */
export function getMonthRange(date) {
    const ys = date.getFullYear();
    const ms = date.getMonth();
    const start = formatDateISO(new Date(ys, ms, 1));
    const end = formatDateISO(new Date(ys, ms + 1, 0));
    return { start, end };
}