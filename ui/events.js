// ui/events.js
import { closeModal } from './components.js';

let appInstance = null;

export function initEventDelegation(app) {
    appInstance = app;
    
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('submit', handleDocumentSubmit);
}

function handleDocumentClick(e) {
    if (e.target.id === 'mainModal') {
        closeModal();
        return;
    }
    
    const pageElement = e.target.closest('[data-page]');
    if (pageElement) {
        e.preventDefault();
        const page = pageElement.dataset.page;
        if (page && appInstance && appInstance.router) {
            appInstance.router.navigateTo(page);
        }
        return;
    }
    
    const logoutElement = e.target.closest('[data-action="auth.logout"]');
    if (logoutElement) {
        e.preventDefault();
        if (appInstance && appInstance.router && appInstance.router.pages.auth) {
            appInstance.router.pages.auth.logout();
        }
        return;
    }
    
    const actionElement = e.target.closest('[data-action]');
    if (!actionElement) return;
    
    if (actionElement.type === 'submit' && actionElement.closest('form[data-action]')) {
        return;
    }
    
    if (actionElement.disabled) {
        e.preventDefault();
        return;
    }
    
    const action = actionElement.dataset.action;
    let params = {};
    
    try {
        if (actionElement.dataset.params) {
            params = JSON.parse(actionElement.dataset.params);
        }
    } catch (err) {
        console.warn('Invalid params JSON:', actionElement.dataset.params);
    }
    
    executeAction(action, params, actionElement, null);
}

function handleDocumentSubmit(e) {
    const form = e.target;
    
    if (!form.dataset || !form.dataset.action) return;
    
    e.preventDefault();
    e.stopPropagation();

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    
    let submitter = e.submitter;
    let submitterData = {};
    if (submitter && submitter.name && submitter.value) {
        submitterData[submitter.name] = submitter.value;
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        const originalHTML = submitBtn.innerHTML;
        submitBtn.dataset.originalText = originalHTML;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses...';
    }
    
    const formData = new FormData(form);
    let params = {};
    formData.forEach((value, key) => {
        params[key] = value;
    });
    params = { ...params, ...submitterData };
    
    // Check if action button was used (saveDraft)
    if (submitter && submitter.dataset && submitter.dataset.action) {
        executeAction(submitter.dataset.action, params, submitter, form);
        return;
    }
    
    executeAction(form.dataset.action, params, form, form);
}

async function executeAction(action, params, element, formElement) {
    if (action === 'navigate') {
        if (params.page) {
            await appInstance.router.navigateTo(params.page, params);
        }
        return;
    }
    
    if (action === 'auth.logout') {
        if (appInstance.router.pages.auth) {
            appInstance.router.pages.auth.logout();
        }
        return;
    }
    
    if (action === 'confirmModal.confirm') {
        closeModal();
        if (window._confirmModalCallback && typeof window._confirmModalCallback.onConfirm === 'function') {
            window._confirmModalCallback.onConfirm();
        }
        return;
    }

    if (action === 'confirmModal.cancel') {
        closeModal();
        if (window._confirmModalCallback && typeof window._confirmModalCallback.onCancel === 'function') {
            window._confirmModalCallback.onCancel();
        }
        return;
    }
    
    if (action === 'modal.close') {
        closeModal();
        return;
    }
    
    const parts = action.split('.');
    if (parts.length !== 2) {
        console.warn(`Invalid action format: ${action}. Expected format: pageName.methodName`);
        return;
    }
    
    const [pageName, methodName] = parts;
    
    const pageKeyMap = {
        'auth': 'auth',
        'iadl': 'iadl',
        'userManagement': 'userManagement',
        'masterKPI': 'masterKPI',
        'masterTemplate': 'masterTemplate',
        'otpCreate': 'otpCreate',
        'otpHistory': 'otpHistory',
        'otpReview': 'otpReview'
    };
    
    const pageKey = pageKeyMap[pageName] || pageName;
    
    if (appInstance.router.pages[pageKey]) {
        const page = appInstance.router.pages[pageKey];
        if (typeof page[methodName] === 'function') {
            try {
                if (formElement) {
                    if (!formElement.isConnected) {
                        console.warn('Form is not connected to DOM');
                        return;
                    }
                    await page[methodName](formElement);
                } else {
                    await page[methodName](params, element);
                }
            } catch (error) {
                console.error(`Error executing ${action}:`, error);
                if (window.toast) {
                    window.toast(`Terjadi kesalahan: ${error.message}`, 'error');
                }
            } finally {
                if (formElement) {
                    const submitBtn = formElement.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        const originalText = submitBtn.dataset.originalText || submitBtn.innerHTML;
                        submitBtn.innerHTML = originalText;
                    }
                }
            }
        } else {
            console.warn(`Method not found: ${methodName} in page ${pageName} (key: ${pageKey})`);
        }
    } else {
        console.warn(`Page not found: ${pageName} (key: ${pageKey})`);
    }
}

export async function triggerAction(action, params = {}) {
    if (!appInstance) {
        console.warn('App instance not initialized');
        return;
    }
    
    const parts = action.split('.');
    if (parts.length !== 2) {
        console.warn(`Invalid action format: ${action}`);
        return;
    }
    
    const [pageName, methodName] = parts;
    
    if (appInstance.router.pages[pageName]) {
        const page = appInstance.router.pages[pageName];
        if (typeof page[methodName] === 'function') {
            try {
                await page[methodName](params, null);
            } catch (error) {
                console.error(`Error executing ${action}:`, error);
            }
        }
    }
}

export function getAppInstance() {
    return appInstance;
}