// ==================== СКАНЕР ШТРИХКОДОВ ====================
// Global script — НЕ модуль. Загружается через <script> в index.html

// Зависимости: Html5Qrcode (CDN), firebase (CDN), Toast (из toast.js)

let qr = null;

// ===== ЗВУКОВЫЕ ЭФФЕКТЫ =====
function playBeep(f, d, t) {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = t || 'sine';
        o.frequency.value = f;
        g.gain.value = 0.3;
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + d);
    } catch (e) {}
}

function playScanSound() {
    playBeep(660, 0.08, 'square');
}

// ===== ЗАПУСК СКАНЕРА =====
function startSc() {
    var ov = document.getElementById('scannerOverlay'),
        vw = document.getElementById('scannerView');
    if (!ov || !vw) return;
    if (!navigator.mediaDevices?.getUserMedia) {
        if (window.Toast && window.Toast.warning) window.Toast.warning('Камера недоступна');
        return;
    }
    ov.classList.add('active');
    vw.innerHTML = '';
    if (qr && qr.isScanning) {
        qr.stop().then(function() {
            qr = null;
            initNS();
        }).catch(function() {
            qr = null;
            initNS();
        });
    } else {
        initNS();
    }

    function initNS() {
        try {
            qr = new Html5Qrcode("scannerView");
            qr.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 160 } },
                function(dt) {
                    playScanSound();
                    if (navigator.vibrate) navigator.vibrate(50);
                    var ai = document.getElementById('articleInput');
                    var bc = dt.trim();
                    findBc(bc).then(function(art) {
                        if (ai) ai.value = art;
                        // После установки артикула — ищем фото (сработает input-событие)
                        showPP(art || bc);
                    });
                    var qi = document.getElementById('qtyInput');
                    if (qi) {
                        qi.focus();
                        qi.select();
                    }
                    stopSc();
                },
                function() {}
            ).then(function() {
                var sb = document.getElementById('scanBtn');
                if (sb) {
                    sb.classList.add('scanning');
                    sb.textContent = '⏹';
                }
            }).catch(function(err) {
                console.error('Html5Qrcode.start error:', err);
                if (window.Toast && window.Toast.error) window.Toast.error('Ошибка сканера');
                stopSc();
            });
        } catch (e) {
            console.error('Html5Qrcode constructor error:', e);
            if (window.Toast && window.Toast.error) window.Toast.error('Ошибка камеры');
            stopSc();
        }
    }
}

// ===== ОСТАНОВКА СКАНЕРА =====
function stopSc() {
    if (qr) {
        qr.stop().catch(function() {}).finally(function() {
            qr = null;
        });
    }
    var o = document.getElementById('scannerOverlay');
    if (o) o.classList.remove('active');
    var sb = document.getElementById('scanBtn');
    if (sb) {
        sb.classList.remove('scanning');
        sb.textContent = '📷';
    }
    var v = document.getElementById('scannerView');
    if (v) v.innerHTML = '';
}

// ===== ПОИСК АРТИКУЛА ПО ШТРИХКОДУ =====
async function findBc(code) {
    var bc = code.trim();
    try {
        if (window.db) {
            var s = await window.db
                .collection('barcodes')
                .where('barcode', '==', bc)
                .limit(1)
                .get();
            if (!s.empty) return s.docs[0].data().article;
        } else if (window.firebase && window.firebase.firestore) {
            var db2 = window.firebase.firestore();
            var s2 = await db2
                .collection('barcodes')
                .where('barcode', '==', bc)
                .limit(1)
                .get();
            if (!s2.empty) return s2.docs[0].data().article;
        }
    } catch (e) {
        console.log('findBc error:', e);
    }
    return bc;
}

// ===== ПОИСК ФОТО ТОВАРА ПО ШТРИХКОДУ/АРТИКУЛУ =====
async function getPP(bc) {
    if (!bc) return null;
    try {
        var db3 = null;
        if (window.db) db3 = window.db;
        else if (window.firebase && window.firebase.firestore) db3 = window.firebase.firestore();
        if (!db3) return null;
        var s = await db3
            .collection('product_photos')
            .where('barcode', '==', bc.trim())
            .limit(1)
            .get();
        return s.empty ? null : s.docs[0].data();
    } catch (e) {
        return null;
    }
}

// ===== ПОКАЗ ФОТО ТОВАРА (ПРЕВЬЮ) =====
async function showPP(barcode) {
    var pe = document.getElementById('productPhoto');
    var ph = document.getElementById('productPhotoPlaceholder');
    if (!pe || !ph) return;
    if (!barcode) {
        pe.classList.remove('show');
        pe.src = '';
        ph.classList.remove('show');
        return;
    }
    var r = await getPP(barcode);
    if (r && r.photoData) {
        pe.src = r.photoData;
        pe.classList.add('show');
        // По клику на превью — открываем модалку
        pe.onclick = function(e) {
            e.preventDefault();
            openPM(r.photoData);
        };
        ph.classList.remove('show');
    } else {
        pe.classList.remove('show');
        pe.src = '';
        ph.classList.add('show');
    }
}

// ===== ПОЛНОЭКРАННЫЙ ПРОСМОТР ФОТО (МОДАЛКА) =====
function openPM(src) {
    var existing = document.querySelector('.photo-modal');
    if (existing) existing.remove();

    var m = document.createElement('div');
    m.className = 'photo-modal';
    m.innerHTML = '<button class="photo-modal-close">✕</button><img src="' + src + '">';
    document.body.appendChild(m);

    var img = m.querySelector('img');
    var scale = 1, startDist = 0, startScale = 1;
    var posX = 0, posY = 0, startX = 0, startY = 0;

    // Pinch zoom
    m.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            startDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            startScale = scale;
        } else if (e.touches.length === 1) {
            startX = e.touches[0].clientX - posX;
            startY = e.touches[0].clientY - posY;
        }
    }, { passive: false });

    m.addEventListener('touchmove', function(e) {
        e.preventDefault();
        if (e.touches.length === 2) {
            var dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            scale = Math.min(5, Math.max(0.5, startScale * dist / startDist));
            img.style.transform = 'scale(' + scale + ') translate(' + posX + 'px,' + posY + 'px)';
        } else if (e.touches.length === 1) {
            posX = e.touches[0].clientX - startX;
            posY = e.touches[0].clientY - startY;
            img.style.transform = 'scale(' + scale + ') translate(' + posX + 'px,' + posY + 'px)';
        }
    }, { passive: false });

    // Double-tap to reset
    var lastTap = 0;
    m.addEventListener('touchend', function(e) {
        var now = Date.now();
        if (now - lastTap < 300 && e.changedTouches.length === 1) {
            scale = 1; posX = 0; posY = 0;
            img.style.transform = 'scale(1)';
        }
        lastTap = now;
    });

    m.addEventListener('click', function(e) {
        if (e.target === m || e.target.classList.contains('photo-modal-close')) {
            m.style.opacity = '0';
            setTimeout(function() { m.remove(); }, 180);
        }
    });
}

// Экспортируем в глобальную область (window)
window.startSc = startSc;
window.stopSc = stopSc;
window.findBc = findBc;
window.showPP = showPP;
window.openPM = openPM;