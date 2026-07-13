// ==================== МОДУЛЬ СКЛАДА И ИП ПОЛЬЗОВАТЕЛЯ ====================

import { collection, queryWhere, addDoc, updateDoc, getDoc, serverTimestamp } from '../services/firebase.js';
import { sessionCache } from '../services/cache.js';
import { getTodayStr } from '../utils/dates.js';

const LOCATION_KEY = 'user_location';
const IP_KEY = 'user_ip';
const FREQUENT_CITIES_KEY = 'frequent_cities';

/**
 * Получение склада пользователя
 */
export async function getUserLocation(userId) {
    const cached = sessionCache.get(LOCATION_KEY + '_' + userId);
    if (cached) return cached;
    
    try {
        const items = await queryWhere('user_locations', 'userId', '==', userId);
        if (items.length > 0) {
            const loc = {
                marketplace: items[0].marketplace,
                locationDisplay: items[0].locationDisplay,
                locationRaw: items[0].locationRaw
            };
            sessionCache.set(LOCATION_KEY + '_' + userId, loc);
            return loc;
        }
    } catch (e) {}
    return null;
}

/**
 * Сохранение склада пользователя
 */
export async function saveUserLocation(userId, marketplace, locationDisplay, locationRaw) {
    const loc = { marketplace, locationDisplay, locationRaw };
    sessionCache.set(LOCATION_KEY + '_' + userId, loc);
    
    try {
        const items = await queryWhere('user_locations', 'userId', '==', userId);
        if (items.length > 0) {
            await updateDoc('user_locations', items[0].id, { marketplace, locationDisplay, locationRaw, updatedAt: serverTimestamp() });
        } else {
            await addDoc('user_locations', { userId, marketplace, locationDisplay, locationRaw, createdAt: serverTimestamp() });
        }
        
        // Обновляем частые города
        if (marketplace === 'WB') addFrequentCity(locationDisplay);
    } catch (e) {
        console.error('Ошибка сохранения склада:', e);
    }
}

/**
 * Получение ИП пользователя
 */
export async function getUserIP(userId) {
    const cached = sessionCache.get(IP_KEY + '_' + userId);
    if (cached !== null && cached !== undefined) return cached;
    
    try {
        const items = await queryWhere('user_ip_settings', 'userId', '==', userId);
        if (items.length > 0) {
            sessionCache.set(IP_KEY + '_' + userId, items[0].ip || '');
            return items[0].ip || '';
        }
    } catch (e) {}
    return '';
}

/**
 * Сохранение ИП пользователя
 */
export async function saveUserIP(userId, ip) {
    sessionCache.set(IP_KEY + '_' + userId, ip || '');
    
    try {
        const items = await queryWhere('user_ip_settings', 'userId', '==', userId);
        if (items.length > 0) {
            await updateDoc('user_ip_settings', items[0].id, { ip: ip || '', updatedAt: serverTimestamp() });
        } else {
            await addDoc('user_ip_settings', { userId, ip: ip || '', createdAt: serverTimestamp() });
        }
    } catch (e) {
        console.error('Ошибка сохранения ИП:', e);
    }
}

/**
 * Частые города (для smart-select)
 */
function addFrequentCity(city) {
    if (!city) return;
    let frequent = sessionCache.get(FREQUENT_CITIES_KEY) || [];
    frequent = frequent.filter(c => c !== city);
    frequent.unshift(city);
    frequent = frequent.slice(0, 5);
    sessionCache.set(FREQUENT_CITIES_KEY, frequent);
}

export function getFrequentCities() {
    return sessionCache.get(FREQUENT_CITIES_KEY) || [];
}