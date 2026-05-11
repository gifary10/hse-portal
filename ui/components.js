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

export function confirmModal(title, message, onConfirm, onCancel) {
    const content = `
        <div class="text-center">
            <i class="bi bi-question-circle" style="font-size: 3rem; color: var(--warning);"></i>
            <p class="mt-md" style="font-size: var(--fs-md);">${message}</p>
            <div class="d-flex justify-content-center gap-sm mt-lg">
                <button class="btn btn-secondary" data-action="confirmModal.cancel">
                    <i class="bi bi-x-circle"></i> Tidak
                </button>
                <button class="btn btn-danger" data-action="confirmModal.confirm">
                    <i class="bi bi-check-circle"></i> Ya
                </button>
            </div>
        </div>
    `;

    showModal(title, content);

    window._confirmModalCallback = { onConfirm, onCancel };

    const modalElement = document.getElementById('mainModal');
    if (modalElement) {
        const cleanup = () => {
            delete window._confirmModalCallback;
            modalElement.removeEventListener('hidden.bs.modal', cleanup);
        };
        modalElement.addEventListener('hidden.bs.modal', cleanup);
    }
}

export function closeModal() {
    const modalElement = document.getElementById('mainModal');
    if (modalElement && modalElement._bsModal) {
        modalElement._bsModal.hide();
    }
}