// ==================== МОДУЛЬ СКАНЕРА ШТРИХКОДОВ ====================

import { toast } from '../services/toast.js';
import { playScanSound } from '../utils/helpers.js';
import { getDB } from '../services/firebase.js';

let qrScanner = null;

async function startScanner() {
    const overlay = document.getElementById('scannerOverlay');
    const view = document.getElementById('scannerView');
    
    if (!overlay || !view) return;
    
    if (!navigator.mediaDevices?.getUserMedia) {
        toast.warning('Камера недоступна');
        return;
    }
    
    overlay.classList.add('active');
    view.innerHTML = '';
    
    if (qrScanner && qrScanner.isScanning) {
        await stopScanner();
    }
    
    try {
        qrScanner = new Html5Qrcode("scannerView");
        
        await qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 160 } },
            async (decodedText) => {
                playScanSound();
                if (navigator.vibrate) navigator.vibrate(50);
                
                const articleInput = document.getElementById('articleInput');
                if (articleInput) {
                    const article = await findBarcode(decodedText.trim());
                    articleInput.value = article;
                }
                
                await showProductPhoto(decodedText.trim());
                
                const qtyInput = document.getElementById('qtyInput');
                if (qtyInput) {
                    qtyInput.focus();
                    qtyInput.select();
                }
                
                await stopScanner();
            },
            () => {} // onScanFailure
        );
        
        const scanBtn = document.getElementById('scanBtn');
        if (scanBtn) {
            scanBtn.classList.add('scanning');
            scanBtn.textContent = '⏹';
        }
    } catch (error) {
        toast.error('Ошибка камеры');
        await stopScanner();
    }
}

async function stopScanner() {
    if (qrScanner) {
        try {
            await qrScanner.stop();
        } catch (e) {}
        qrScanner = null;
    }
    
    const overlay = document.getElementById('scannerOverlay');
    if (overlay) overlay.classList.remove('active');
    
    const scanBtn = document.getElementById('scanBtn');
    if (scanBtn) {
        scanBtn.classList.remove('scanning');
        scanBtn.textContent = '📷';
    }
    
    const view = document.getElementById('scannerView');
    if (view) view.innerHTML = '';
}

async function findBarcode(barcode) {
    try {
        const snapshot = await getDB()
            .collection('barcodes')
            .where('barcode', '==', barcode)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            return snapshot.docs[0].data().article;
        }
    } catch (e) {
        // Игнорируем ошибки
    }
    
    return barcode;
}

async function showProductPhoto(barcode) {
    const photoEl = document.getElementById('productPhoto');
    const placeholderEl = document.getElementById('productPhotoPlaceholder');
    
    if (!photoEl || !placeholderEl) return;
    
    if (!barcode) {
        photoEl.classList.remove('show');
        photoEl.src = '';
        placeholderEl.classList.remove('show');
        return;
    }
    
    try {
        const snapshot = await getDB()
            .collection('product_photos')
            .where('barcode', '==', barcode.trim())
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            if (data.photoData) {
                photoEl.src = data.photoData;
                photoEl.classList.add('show');
                photoEl.onclick = () => openPhotoModal(data.photoData);
                placeholderEl.classList.remove('show');
                return;
            }
        }
    } catch (e) {}
    
    photoEl.classList.remove('show');
    photoEl.src = '';
    placeholderEl.classList.add('show');
}

function openPhotoModal(src) {
    const modal = document.createElement('div');
    modal.className = 'photo-modal';
    modal.innerHTML = `
        <button class="photo-modal-close">✕</button>
        <img src="${src}" alt="Фото товара">
    `;
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('photo-modal-close')) {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 180);
        }
    });
    
    document.body.appendChild(modal);
}

export { startScanner, stopScanner, findBarcode, showProductPhoto, openPhotoModal };