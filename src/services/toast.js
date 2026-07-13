// ==================== СЕРВИС УВЕДОМЛЕНИЙ ====================

let _container = null;

function getContainer() {
    if (!_container) {
        _container = document.querySelector('.toast-container');
        if (!_container) {
            _container = document.createElement('div');
            _container.className = 'toast-container';
            document.body.appendChild(_container);
        }
    }
    return _container;
}

function show(message, type = 'info', duration = 3000) {
    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    // Триггер анимации
    requestAnimationFrame(() => toast.classList.add('show'));
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, duration);
}

export const toast = {
    info: (msg) => show(msg, 'info'),
    success: (msg) => show(msg, 'success'),
    warning: (msg) => show(msg, 'warning'),
    error: (msg) => show(msg, 'error')
};

export function showToast(message, type = 'info') {
    show(message, type);
}