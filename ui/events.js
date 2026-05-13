// ui/events.js
import { closeModal } from './components.js';

let appInstance = null;

export function initEventDelegation(app) {
    appInstance = app;
    
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('submit', handleDocumentSubmit);
}

function handleDocumentClick(e) {
    // Handle modal backdrop click
    if (e.target.id === 'mainModal') {
        closeModal();
        return;
    }
    
    // Handle [data-page] navigation
    const pageElement = e.target.closest('[data-page]');
    if (pageElement) {
        e.preventDefault();
        const page = pageElement.dataset.page;
        if (page && appInstance && appInstance.router) {
            appInstance.router.navigateTo(page);
        }
        return;
    }
    
    // Handle logout action
    const logoutElement = e.target.closest('[data-action="auth.logout"]');
    if (logoutElement) {
        e.preventDefault();
        if (appInstance && appInstance.router && appInstance.router.pages.auth) {
            appInstance.router.pages.auth.logout();
        }
        return;
    }
    
    // Handle action elements
    const actionElement = e.target.closest('[data-action]');
    if (!actionElement) return;
    
    // Skip if it's a submit button inside a form with data-action (will be handled by form submit)
    if (actionElement.type === 'submit' && actionElement.closest('form[data-action]')) {
        return;
    }
    
    // Skip if disabled
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
    
    // Only handle forms with data-action
    if (!form.dataset || !form.dataset.action) return;
    
    e.preventDefault();
    e.stopPropagation();

    // Prevent double submission
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    
    // Get submitter data
    let submitter = e.submitter;
    let submitterData = {};
    if (submitter && submitter.name && submitter.value) {
        submitterData[submitter.name] = submitter.value;
    }
    
    // Show loading state on submit button
    if (submitBtn) {
        submitBtn.disabled = true;
        const originalHTML = submitBtn.innerHTML;
        submitBtn.dataset.originalText = originalHTML;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses...';
    }
    
    // Collect form data
    const formData = new FormData(form);
    let params = {};
    formData.forEach((value, key) => {
        params[key] = value;
    });
    params = { ...params, ...submitterData };
    
    // If submitter has its own data-action, use that instead
    if (submitter && submitter.dataset && submitter.dataset.action) {
        executeAction(submitter.dataset.action, params, submitter, form);
        return;
    }
    
    executeAction(form.dataset.action, params, form, form);
}

async function executeAction(action, params, element, formElement) {
    // Handle navigation action
    if (action === 'navigate') {
        if (params.page) {
            await appInstance.router.navigateTo(params.page, params);
        }
        return;
    }
    
    // Handle logout
    if (action === 'auth.logout') {
        if (appInstance.router.pages.auth) {
            appInstance.router.pages.auth.logout();
        }
        return;
    }
    
    // Handle confirm modal actions
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
    
    // Handle modal close
    if (action === 'modal.close') {
        closeModal();
        return;
    }
    
    // Parse action string: "pageName.methodName"
    const parts = action.split('.');
    if (parts.length !== 2) {
        console.warn(`Invalid action format: ${action}. Expected format: pageName.methodName`);
        return;
    }
    
    const [pageName, methodName] = parts;
    
    // Map action page names to router page keys
    const pageKeyMap = {
        'auth': 'auth',
        'dashboard': 'dashboard',
        'iadl': 'iadl',
        'userManagement': 'userManagement',
        'masterKPI': 'masterKPI',
        'masterTemplate': 'masterTemplate',
        'otpCreate': 'otpCreate',
        'otpHistory': 'otpHistory',
        'otpReview': 'otpReview',
        'temuanInput': 'temuanInput',
        'temuanDaftar': 'temuanDaftar',
        'temuanTindakLanjut': 'temuanTindakLanjut',
        'approvalManagement': 'approvalManagement',
        'approvalHistory': 'approvalHistory',
        'managementReview': 'managementReview',
        'managementDecision': 'managementDecision',
        'reports': 'reports',
        'reportsHSE': 'reportsHSE',
        'executiveReports': 'executiveReports',
        'monitoring': 'monitoring',
        'monitoringAll': 'monitoringAll',
        'monitoringExec': 'monitoringExec'
    };
    
    const pageKey = pageKeyMap[pageName] || pageName;
    
    // Execute the method on the page instance
    if (appInstance.router.pages[pageKey]) {
        const page = appInstance.router.pages[pageKey];
        if (typeof page[methodName] === 'function') {
            try {
                // If formElement is provided, pass it as the first argument (legacy support)
                if (formElement) {
                    // Check if form is still connected to DOM
                    if (!formElement.isConnected) {
                        console.warn('Form is not connected to DOM');
                        return;
                    }
                    // Call with (formElement) for backward compatibility
                    await page[methodName](formElement);
                } else {
                    // Call with (params, element)
                    await page[methodName](params, element);
                }
            } catch (error) {
                console.error(`Error executing ${action}:`, error);
                if (window.toast) {
                    window.toast(`Terjadi kesalahan: ${error.message}`, 'error');
                }
            } finally {
                // Re-enable submit button if form exists
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