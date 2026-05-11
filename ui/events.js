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
    
    // Handle page navigation from sidebar or any [data-page] element
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
    
    // Handle any element with data-action attribute
    const actionElement = e.target.closest('[data-action]');
    if (!actionElement) return;
    
    // Skip if it's a submit button inside a form with data-action (will be handled by submit event)
    if (actionElement.type === 'submit' && actionElement.closest('form[data-action]')) {
        return;
    }
    
    const action = actionElement.dataset.action;
    let params = {};
    
    // Parse params if exists
    try {
        if (actionElement.dataset.params) {
            params = JSON.parse(actionElement.dataset.params);
        }
    } catch (err) {
        console.warn('Invalid params JSON:', actionElement.dataset.params);
    }
    
    // Execute the action
    executeAction(action, params, actionElement, null);
}

function handleDocumentSubmit(e) {
    const form = e.target;
    
    // Only handle forms with data-action attribute
    if (!form.dataset || !form.dataset.action) return;
    
    e.preventDefault();
    e.stopPropagation();

    // Get submitter data if available (which button was clicked)
    let submitter = e.submitter;
    let submitterData = {};
    if (submitter && submitter.name && submitter.value) {
        submitterData[submitter.name] = submitter.value;
    }
    
    // Collect form data
    const formData = new FormData(form);
    let params = {};
    formData.forEach((value, key) => {
        params[key] = value;
    });
    params = { ...params, ...submitterData };
    
    // Execute the action
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
    
    // Handle logout action
    if (action === 'auth.logout') {
        if (appInstance.router.pages.auth) {
            appInstance.router.pages.auth.logout();
        }
        return;
    }
    
    // Handle confirm modal confirm button
    if (action === 'confirmModal.confirm') {
        closeModal();
        if (window._confirmModalCallback && typeof window._confirmModalCallback.onConfirm === 'function') {
            window._confirmModalCallback.onConfirm();
        }
        return;
    }

    // Handle confirm modal cancel button
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
    
    // Parse action format: pageName.methodName
    const parts = action.split('.');
    if (parts.length !== 2) {
        console.warn(`Invalid action format: ${action}. Expected format: pageName.methodName`);
        return;
    }
    
    const [pageName, methodName] = parts;
    
    // Find the page instance
    if (appInstance.router.pages[pageName]) {
        const page = appInstance.router.pages[pageName];
        if (typeof page[methodName] === 'function') {
            try {
                if (formElement) {
                    // Check if form is still connected to DOM
                    if (!formElement.isConnected) {
                        console.warn('Form is not connected to DOM');
                        return;
                    }
                    await page[methodName](params, formElement);
                } else {
                    await page[methodName](params, element);
                }
            } catch (error) {
                console.error(`Error executing ${action}:`, error);
                // Show error toast if available
                if (window.toast) {
                    window.toast(`Terjadi kesalahan: ${error.message}`, 'error');
                }
            }
        } else {
            console.warn(`Method not found: ${methodName} in page ${pageName}`);
        }
    } else {
        console.warn(`Page not found: ${pageName}`);
    }
}

// Helper function to manually trigger actions (useful for programmatic calls)
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

// Export for use in other modules
export function getAppInstance() {
    return appInstance;
}