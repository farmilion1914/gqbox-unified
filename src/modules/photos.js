// ==================== МОДУЛЬ ФОТО ПАЛЛЕТ ====================

import { getDB, serverTimestamp, batch } from '../services/firebase.js';
import { getTodayStr, formatDateForDisplay } from '../utils/dates.js';
import { esc } from '../utils/helpers.js';
import { getCurrentUser } from './auth.js';
import { addWorkLog } from './warehouse.js';
import { MAX_PHOTOS, MAX_PHOTO_SIZE, IP_LIST, CITY_COLORS } from '../config.js';

// ===== СОСТОЯНИЕ =====
let _photoSlots = [null, null, null, null];
let _photoPreviewUrls = [null, null, null, null];
let _photoDataStore = {};
let _photoIdCounter = 0;
let _cityCache = null;
let _cityColorMap = {};

// ===== Геттеры =====
export function getPhotoSlots() { return _photoSlots; }
export function getPhotoPreviewUrls() { return _photoPreviewUrls; }
export function getCityColorMap() { return _cityColorMap; }

// ===== СЖАТИЕ =====
export function compressImage(file, maxSize) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let w = img.width, h = img.height;
                const maxW = 900, maxH = 900;
                if (w > maxW || h > maxH) {
                    const ratio = Math.min(maxW / w, maxH / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(img, 0, 0, w, h);
                let quality = 0.55;
                let result = canvas.toDataURL('image/jpeg', quality);
                while (result.length > maxSize * 1.37 && quality > 0.2) {
                    quality -= 0.1;
                    result = canvas.toDataURL('image/jpeg', quality);
                }
                resolve(result);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ===== СЛОТЫ =====
export function setPhotoSlot(index, file) {
    if (index < 0 || index >= MAX_PHOTOS) return;
    if (_photoPreviewUrls[index]) URL.revokeObjectURL(_photoPreviewUrls[index]);
    _photoSlots[index] = file;
    _photoPreviewUrls[index] = file ? URL.createObjectURL(file) : null;
}

export function removePhotoSlot(index) {
    if (index < 0 || index >= MAX_PHOTOS) return;
    if (_photoPreviewUrls[index]) URL.revokeObjectURL(_photoPreviewUrls[index]);
    _photoSlots[index] = null;
    _photoPreviewUrls[index] = null;
}

export function clearAllPhotoSlots() {
    for (let i = 0; i < MAX_PHOTOS; i++) {
        if (_photoPreviewUrls[i]) URL.revokeObjectURL(_photoPreviewUrls[i]);
        _photoSlots[i] = null;
        _photoPreviewUrls[i] = null;
    }
}

export function getFilledSlotCount() {
    return _photoSlots.filter(f => f !== null).length;
}

// ===== ГОРОДА =====
export async function getCityList() {
    if (_cityCache) return _cityCache;
    const snap = await getDB().collection('pallet_photos').orderBy('city').get();
    const cities = new Set();
    snap.docs.forEach(d => {
        const c = (d.data().city || '').trim();
        if (c) cities.add(c);
    });
    _cityCache = Array.from(cities).sort();
    return _cityCache;
}

export function invalidateCityCache() {
    _cityCache = null;
}

export function getCityColor(city) {
    if (_cityColorMap[city]) return _cityColorMap[city];
    _cityColorMap[city] = CITY_COLORS[Object.keys(_cityColorMap).length % CITY_COLORS.length];
    return _cityColorMap[city];
}

// ===== СОХРАНЕНИЕ =====
export async function savePallet(city, date, ipData, photos) {
    const user = getCurrentUser();
    if (!user) return { success: false, error: 'Не авторизован' };

    const totalQty = ipData.reduce((s, item) => s + item.quantity, 0);
    const ipDisplay = ipData.map(item => item.ip + ' — ' + item.quantity + ' кор.').join(', ');

    const photosData = [];
    for (let j = 0; j < photos.length; j++) {
        const base64 = await compressImage(photos[j].file, MAX_PHOTO_SIZE);
        photosData.push({ slot: photos[j].slot + 1, data: base64 });
    }

    await getDB().collection('pallet_photos').add({
        userId: user.id,
        userName: user.name,
        city,
        ipData,
        ipDisplay,
        totalQuantity: totalQty,
        date,
        photoCount: photosData.length,
        photos: photosData,
        timestamp: serverTimestamp()
    });

    _cityCache = null;
    await addWorkLog('Фото', 'Сохранил паллету', 'г.' + city + ', ' + ipDisplay + ', фото: ' + photosData.length + ' шт.', totalQty);

    return { success: true, totalQty, photoCount: photosData.length };
}

// ===== ЗАГРУЗКА ПАЛЛЕТ =====
export async function loadPallets(filters) {
    filters = filters || {};
    let q = getDB().collection('pallet_photos');
    if (filters.userId) q = q.where('userId', '==', filters.userId);
    if (filters.date) q = q.where('date', '==', filters.date);
    if (filters.city) q = q.where('city', '==', filters.city);

    const snap = await q.orderBy('timestamp', 'desc').limit(200).get();
    let docs = snap.docs;

    if (filters.ip) {
        docs = docs.filter(doc => {
            const ipData = doc.data().ipData || [];
            return ipData.some(item => item.ip === filters.ip);
        });
    }

    return docs.map(d => ({ id: d.id, data: d.data() }));
}

// ===== УДАЛЕНИЕ =====
export async function deletePallet(palletId) {
    await getDB().collection('pallet_photos').doc(palletId).delete();
    _cityCache = null;
}

export async function deleteCityPallets(city, palletIds) {
    let deleted = 0;
    for (let i = 0; i < palletIds.length; i += 100) {
        const ba = batch();
        const chunk = palletIds.slice(i, i + 100);
        chunk.forEach(id => ba.delete(getDB().collection('pallet_photos').doc(id)));
        await ba.commit();
        deleted += chunk.length;
    }
    _cityCache = null;
    return deleted;
}

export async function archiveOldPhotos(monthsOld) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);
    const snap = await getDB().collection('pallet_photos').where('date', '<=', cutoffStr).get();
    if (snap.size === 0) return { deleted: 0 };

    let deleted = 0;
    for (let i = 0; i < snap.docs.length; i += 100) {
        const ba = batch();
        const chunk = snap.docs.slice(i, i + 100);
        chunk.forEach(d => ba.delete(d.ref));
        await ba.commit();
        deleted += chunk.length;
    }
    _cityCache = null;
    return { deleted };
}

// ===== ГАЛЛЕРЕЯ =====
export function showGallery(photoDataId) {
    const docData = _photoDataStore[photoDataId];
    if (!docData) return;

    const existing = document.querySelector('.photo-gallery-overlay');
    if (existing) existing.remove();

    const photos = docData.photos || [];
    if (photos.length === 0) return;

    let currentIdx = 0;
    const modal = document.createElement('div');
    modal.className = 'photo-gallery-overlay';
    modal.innerHTML = `
        <button class="gallery-close">&#x2715;</button>
        <img src="${photos[0].data}" class="gallery-main">
        <div class="gallery-counter">1 / ${photos.length}</div>
        <div class="gallery-nav">
            <button class="gallery-prev" ${photos.length <= 1 ? 'style="visibility:hidden"' : ''}>&#x25C0;</button>
            <button class="gallery-next" ${photos.length <= 1 ? 'style="visibility:hidden"' : ''}>&#x25B6;</button>
        </div>
        <div class="gallery-info">
            ${esc(docData.city || '—')} &bull; ${esc(docData.userName || '—')} &bull; ${formatDateForDisplay(docData.date)}<br>
            ${esc(docData.ipDisplay || '—')} &bull; ${docData.totalQuantity || 0} кор.
        </div>
    `;
    document.body.appendChild(modal);

    const mainImg = modal.querySelector('.gallery-main');
    const counter = modal.querySelector('.gallery-counter');

    function updateImage() {
        mainImg.src = photos[currentIdx].data;
        counter.textContent = (currentIdx + 1) + ' / ' + photos.length;
    }

    modal.querySelector('.gallery-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIdx > 0) { currentIdx--; updateImage(); }
    });
    modal.querySelector('.gallery-next').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentIdx < photos.length - 1) { currentIdx++; updateImage(); }
    });
    modal.querySelector('.gallery-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    let touchStartX = 0;
    modal.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
    modal.addEventListener('touchend', (e) => {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentIdx < photos.length - 1) { currentIdx++; updateImage(); }
            else if (diff < 0 && currentIdx > 0) { currentIdx--; updateImage(); }
        }
    });
}

export function storePhotoData(id, data) {
    _photoDataStore[id] = data;
}

export default {
    compressImage, setPhotoSlot, removePhotoSlot, clearAllPhotoSlots, getFilledSlotCount,
    getCityList, invalidateCityCache, getCityColor,
    savePallet, loadPallets, deletePallet, deleteCityPallets, archiveOldPhotos,
    showGallery, storePhotoData,
    getPhotoSlots, getPhotoPreviewUrls
};