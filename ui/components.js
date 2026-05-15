// ui/components.js
export function toast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-x-circle-fill',
        warning: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill'
    };
    
    const bgColors = {
        success: 'bg-success',
        error: 'bg-danger',
        warning: 'bg-warning',
        info: 'bg-info'
    };
    
    const toastId = 'toast_' + Date.now();
    
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgColors[type] || bgColors.success} border-0" 
             role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="3500">
            <div class="d-flex">
                <div class="toast-body d-flex align-items-center gap-2">
                    <i class="bi ${icons[type] || icons.success}"></i>
                    <span>${msg}</span>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastElement);
    bsToast.show();
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

export function showModal(title, content, size = '') {
    const modalElement = document.getElementById('mainModal');
    const modalDialog = document.getElementById('mainModalDialog');
    const modalContent = document.getElementById('mainModalContent');
    
    if (!modalElement || !modalDialog || !modalContent) {
        console.error('Modal elements not found');
        return;
    }
    
    let sizeClass = '';
    if (size === 'modal-lg') sizeClass = 'modal-lg';
    if (size === 'modal-xl') sizeClass = 'modal-xl';
    
    modalDialog.className = `modal-dialog ${sizeClass}`;
    
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title" id="mainModalLabel">${title}</h3>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
            ${content}
        </div>
    `;
    
    const bsModal = new bootstrap.Modal(modalElement, {
        backdrop: 'static',
        keyboard: false
    });
    bsModal.show();
    
    modalElement._bsModal = bsModal;
}

/**
 * Menampilkan modal konfirmasi dengan Promise
 * @param {string} title - Judul modal
 * @param {string} message - Pesan konfirmasi
 * @param {Object} options - Opsi tambahan
 * @param {string} options.confirmText - Teks tombol konfirmasi (default: 'Ya')
 * @param {string} options.cancelText - Teks tombol batal (default: 'Tidak')
 * @param {string} options.confirmClass - Class tombol konfirmasi (default: 'btn-danger')
 * @returns {Promise<boolean>} - Promise yang resolve dengan true jika confirm, false jika cancel
 */
export function confirmModal(title, message, options = {}) {
    const {
        confirmText = 'Ya',
        cancelText = 'Tidak',
        confirmClass = 'btn-danger'
    } = options;
    
    return new Promise((resolve) => {
        const content = `
            <div class="text-center">
                <i class="bi bi-question-circle" style="font-size: 3rem; color: var(--warning);"></i>
                <p class="mt-md" style="font-size: var(--fs-md);">${message}</p>
                <div class="d-flex justify-content-center gap-sm mt-lg">
                    <button class="btn btn-secondary" id="confirmModalCancelBtn">
                        <i class="bi bi-x-circle"></i> ${cancelText}
                    </button>
                    <button class="btn ${confirmClass}" id="confirmModalConfirmBtn">
                        <i class="bi bi-exclamation-triangle"></i> ${confirmText}
                    </button>
                </div>
            </div>
        `;
        
        showModal(title, content);
        
        const modalElement = document.getElementById('mainModal');
        const confirmBtn = document.getElementById('confirmModalConfirmBtn');
        const cancelBtn = document.getElementById('confirmModalCancelBtn');
        
        let resolved = false;
        
        const cleanup = () => {
            if (confirmBtn) confirmBtn.removeEventListener('click', onConfirm);
            if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
            if (modalElement) {
                modalElement.removeEventListener('hidden.bs.modal', onHidden);
            }
        };
        
        const onConfirm = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            
            if (modalElement && modalElement._bsModal) {
                modalElement._bsModal.hide();
            }
            
            const checkHidden = () => {
                if (!modalElement || !modalElement.classList.contains('show')) {
                    resolve(true);
                } else {
                    setTimeout(checkHidden, 50);
                }
            };
            setTimeout(checkHidden, 150);
        };
        
        const onCancel = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            
            if (modalElement && modalElement._bsModal) {
                modalElement._bsModal.hide();
            }
            
            const checkHidden = () => {
                if (!modalElement || !modalElement.classList.contains('show')) {
                    resolve(false);
                } else {
                    setTimeout(checkHidden, 50);
                }
            };
            setTimeout(checkHidden, 150);
        };
        
        const onHidden = () => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(false);
            }
        };
        
        if (confirmBtn) confirmBtn.addEventListener('click', onConfirm);
        if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
        if (modalElement) modalElement.addEventListener('hidden.bs.modal', onHidden);
    });
}

/**
 * Menutup modal yang sedang terbuka
 * @returns {Promise<void>} - Promise yang resolve setelah modal tertutup
 */
export function closeModal() {
    return new Promise((resolve) => {
        const modalElement = document.getElementById('mainModal');
        if (modalElement && modalElement._bsModal) {
            const checkHidden = () => {
                if (!modalElement.classList.contains('show')) {
                    modalElement.removeEventListener('hidden.bs.modal', checkHidden);
                    resolve();
                }
            };
            modalElement.addEventListener('hidden.bs.modal', checkHidden);
            modalElement._bsModal.hide();
        } else {
            resolve();
        }
    });
}