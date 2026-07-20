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
    if (!date) return '';
    if (!(date instanceof Date)) return String(date);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Форматирование даты для отображения (DD.MM.YYYY)
 * Принимает строку (YYYY-MM-DD), Date, Timestamp Firestore, число
 */
export function formatDate(d) {
    if (!d && d !== 0) return '';
    
    // Если это Firestore Timestamp
    if (d.toDate && typeof d.toDate === 'function') {
        return formatDateFromDateObj(d.toDate());
    }
    
    // Если это объект Date
    if (d instanceof Date) {
        return formatDateFromDateObj(d);
    }
    
    // Если это число (миллисекунды)
    if (typeof d === 'number') {
        return formatDateFromDateObj(new Date(d));
    }
    
    // Если это строка YYYY-MM-DD
    if (typeof d === 'string') {
        const parts = d.split('-');
        if (parts.length === 3) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return d;
    }
    
    return String(d);
}

function formatDateFromDateObj(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Короткая дата (DD.MM)
 */
export function formatDateShort(date) {
    if (!date) return '';
    if (date.toDate && typeof date.toDate === 'function') date = date.toDate();
    if (typeof date === 'string') date = new Date(date);
    if (!(date instanceof Date) || isNaN(date.getTime())) return String(date);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}`;
}

/**
 * Полная дата (DD месяц)
 */
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
export function formatDateFull(date) {
    if (!date) return '';
    if (date.toDate && typeof date.toDate === 'function') date = date.toDate();
    if (typeof date === 'string') date = new Date(date);
    if (!(date instanceof Date) || isNaN(date.getTime())) return String(date);
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Месяц Год (для заголовков)
 */
export function formatMonthYear(date) {
    if (!date) return '';
    if (date.toDate && typeof date.toDate === 'function') date = date.toDate();
    if (typeof date === 'string') date = new Date(date);
    if (!(date instanceof Date) || isNaN(date.getTime())) return String(date);
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Парсинг строки YYYY-MM-DD в компоненты
 * Возвращает { year, month, day } — числа
 * Важно: month = 1..12 (не 0..11)
 */
function parseDate(dateStr) {
    if (!dateStr) return { year: 0, month: 1, day: 1 };
    // Если это Date или Timestamp → конвертируем в строку
    if (dateStr instanceof Date || (dateStr.toDate && typeof dateStr.toDate === 'function')) {
        if (dateStr.toDate) dateStr = dateStr.toDate();
        const y = dateStr.getFullYear();
        const m = String(dateStr.getMonth() + 1).padStart(2, '0');
        const d = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
    }
    const parts = String(dateStr).split('-');
    return {
        year: parseInt(parts[0], 10) || 0,
        month: parseInt(parts[1], 10) || 1,
        day: parseInt(parts[2], 10) || 1
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
    if (!year) return 0;
    // Формула Зеллера для григорианского календаря
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
 * Сдвиг даты на N дней
 */
export function shiftDate(dateStr, days) {
    if (days === 0) return dateStr;
    const { year, month, day } = parseDate(dateStr);
    if (!year) return dateStr;
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
}

/**
 * Получение понедельника недели по любой дате недели
 */
export function getWeekMonday(dateStr) {
    const dow = getDayOfWeek(dateStr);
    if (!dow) return dateStr;
    const daysToMonday = 1 - dow;
    return shiftDate(dateStr, daysToMonday);
}

/**
 * Получение воскресенья недели
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
    while (cur && cur <= endStr) {
        result.push(cur);
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
    if (!date) return '';
    if (date.toDate && typeof date.toDate === 'function') date = date.toDate();
    if (date instanceof Date) return formatDateISO(date);
    if (typeof date === 'string') return date;
    return '';
}

/**
 * Форматирование даты для отображения (DD.MM.YYYY)
 */
export function formatDateForDisplay(dateStr) {
    return formatDate(dateStr);
}

/**
 * Получение строки месяца (YYYY-MM)
 */
export function getMonthStr(date) {
    if (!date) return '';
    if (date.toDate && typeof date.toDate === 'function') date = date.toDate();
    if (typeof date === 'string') date = new Date(date);
    if (!(date instanceof Date) || isNaN(date.getTime())) return String(date);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

/**
 * Название месяца из строки YYYY-MM
 */
export function getMonthName(monthStr) {
    if (!monthStr) return '';
    const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const parts = String(monthStr).split('-');
    const m = parseInt(parts[1]) - 1;
    return (months[m] || '') + ' ' + (parts[0] || '');
}

/**
 * Диапазон недели по дате
 */
export function getWeekRange(date) {
    if (!date) return { start: '', end: '' };
    if (date.toDate && typeof date.toDate === 'function') date = date.toDate();
    if (typeof date === 'string') date = new Date(date + 'T00:00:00');
    if (!(date instanceof Date) || isNaN(date.getTime())) return { start: '', end: '' };
    const monday = getWeekMonday(formatDateISO(date));
    const sunday = getWeekSunday(monday);
    return { start: monday, end: sunday };
}

/**
 * Диапазон месяца по дате
 */
export function getMonthRange(date) {
    if (!date) return { start: '', end: '' };
    if (date.toDate && typeof date.toDate === 'function') date = date.toDate();
    if (typeof date === 'string') date = new Date(date);
    if (!(date instanceof Date) || isNaN(date.getTime())) return { start: '', end: '' };
    const ys = date.getFullYear();
    const ms = date.getMonth();
    const start = formatDateISO(new Date(ys, ms, 1));
    const end = formatDateISO(new Date(ys, ms + 1, 0));
    return { start, end };
}