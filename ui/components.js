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
    toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
}

export function showModal(title, content, size = '') {
    const modalElement = document.getElementById('mainModal');
    const modalDialog = document.getElementById('mainModalDialog');
    const modalContent = document.getElementById('mainModalContent');
    if (!modalElement || !modalDialog || !modalContent) return;
    let sizeClass = '';
    if (size === 'modal-lg') sizeClass = 'modal-lg';
    if (size === 'modal-xl') sizeClass = 'modal-xl';
    modalDialog.className = `modal-dialog ${sizeClass}`;
    modalContent.innerHTML = `
        <div class="modal-header">
            <h3 class="modal-title" id="mainModalLabel">${title}</h3>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">${content}</div>
    `;
    const bsModal = new bootstrap.Modal(modalElement, { backdrop: 'static', keyboard: false });
    bsModal.show();
    modalElement._bsModal = bsModal;
}

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