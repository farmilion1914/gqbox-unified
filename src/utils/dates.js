// ==================== РАБОТА С ДАТАМИ ====================

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
 * Получение понедельника текущей недели
 */
export function getWeekMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Получение воскресенья недели (по понедельнику)
 */
export function getWeekSunday(monday) {
    const d = new Date(monday);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

/**
 * Начало недели (псевдоним для getWeekMonday)
 */
export function getWeekStart(dateStr) {
    return formatDateISO(getWeekMonday(new Date(dateStr)));
}

/**
 * Конец недели (псевдоним для getWeekSunday по понедельнику)
 */
export function getWeekEnd(dateStr) {
    const monday = getWeekMonday(new Date(dateStr));
    return formatDateISO(getWeekSunday(monday));
}

/**
 * Начало месяца
 */
export function getMonthStart(dateStr) {
    const d = new Date(dateStr);
    return formatDateISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

/**
 * Конец месяца
 */
export function getMonthEnd(dateStr) {
    const d = new Date(dateStr);
    return formatDateISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/**
 * Сдвиг даты на N дней
 */
export function shiftDate(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return formatDateISO(d);
}

/**
 * Сдвиг месяца на N месяцев
 */
export function shiftMonth(dateStr, months) {
    const d = new Date(dateStr);
    return formatDateISO(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

/**
 * Список дат в диапазоне (включительно)
 */
export function getDatesInRange(startStr, endStr) {
    const result = [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const cur = new Date(start);
    while (cur <= end) {
        result.push(formatDateISO(cur));
        cur.setDate(cur.getDate() + 1);
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
    const monday = getWeekMonday(date);
    const sunday = getWeekSunday(monday);
    return {
        start: formatDateISO(monday),
        end: formatDateISO(sunday)
    };
}

/**
 * Диапазон месяца по дате
 */
export function getMonthRange(date) {
    const y = date.getFullYear();
    const m = date.getMonth();
    return {
        start: formatDateISO(new Date(y, m, 1)),
        end: formatDateISO(new Date(y, m + 1, 0))
    };
}