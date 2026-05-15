// ui/events.js
// Event delegation dengan standarisasi action handling

import { closeModal } from './components.js';
import { setButtonLoading } from './utils.js';

let appInstance = null;
let isProcessingAction = false;

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
    
    // Handle modal close action
    const modalCloseElement = e.target.closest('[data-action="modal.close"]');
    if (modalCloseElement) {
        e.preventDefault();
        closeModal();
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
    
    // Prevent double processing
    if (isProcessingAction) return;
    
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
    if (isProcessingAction) return;
    
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
        setButtonLoading(submitBtn, true, 'Memproses...');
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
    // Prevent double execution
    if (isProcessingAction) {
        console.warn('Action already in progress:', action);
        return;
    }
    
    isProcessingAction = true;
    
    try {
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
                await appInstance.router.pages.auth.logout();
            }
            return;
        }
        
        // Handle modal close
        if (action === 'modal.close') {
            closeModal();
            return;
        }
        
        // Handle refresh actions (standardized)
        if (action.endsWith('.refresh')) {
            const pageName = action.split('.')[0];
            const pageKey = getPageKey(pageName);
            if (appInstance.router.pages[pageKey] && typeof appInstance.router.pages[pageKey].refresh === 'function') {
                await appInstance.router.pages[pageKey].refresh(params, element);
            }
            return;
        }
        
        // Handle goToPage actions (standardized)
        if (action.endsWith('.goToPage')) {
            const pageName = action.split('.')[0];
            const pageKey = getPageKey(pageName);
            if (appInstance.router.pages[pageKey] && typeof appInstance.router.pages[pageKey].goToPage === 'function') {
                await appInstance.router.pages[pageKey].goToPage(params, element);
            }
            return;
        }
        
        // Handle clearFilters actions (standardized)
        if (action.endsWith('.clearFilters')) {
            const pageName = action.split('.')[0];
            const pageKey = getPageKey(pageName);
            if (appInstance.router.pages[pageKey] && typeof appInstance.router.pages[pageKey].clearFilters === 'function') {
                await appInstance.router.pages[pageKey].clearFilters(params, element);
            }
            return;
        }
        
        // Handle filter by status actions
        if (action.endsWith('.filterByStatus')) {
            const pageName = action.split('.')[0];
            const pageKey = getPageKey(pageName);
            if (appInstance.router.pages[pageKey] && typeof appInstance.router.pages[pageKey].filterByStatus === 'function') {
                await appInstance.router.pages[pageKey].filterByStatus(params, element);
            }
            return;
        }
        
        // Standard action format: pageName.methodName
        const parts = action.split('.');
        if (parts.length !== 2) {
            console.warn(`Invalid action format: ${action}. Expected format: pageName.methodName`);
            return;
        }
        
        const [pageName, methodName] = parts;
        const pageKey = getPageKey(pageName);
        
        // Execute the method on the page instance
        if (appInstance.router.pages[pageKey]) {
            const page = appInstance.router.pages[pageKey];
            if (typeof page[methodName] === 'function') {
                try {
                    if (formElement) {
                        // Check if form is still connected to DOM
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
                    // Re-enable submit button if form exists
                    if (formElement) {
                        const submitBtn = formElement.querySelector('button[type="submit"]');
                        if (submitBtn) {
                            setButtonLoading(submitBtn, false);
                        }
                    }
                }
            } else {
                console.warn(`Method not found: ${methodName} in page ${pageName} (key: ${pageKey})`);
            }
        } else {
            console.warn(`Page not found: ${pageName} (key: ${pageKey})`);
        }
    } finally {
        isProcessingAction = false;
    }
}

function getPageKey(pageName) {
    const pageKeyMap = {
        'auth': 'auth',
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
        'managementReview': 'managementReview',
        'managementDecision': 'managementDecision',
        'reports': 'reports',
        'reportsHSE': 'reportsHSE',
        'executiveReports': 'executiveReports',
        'monitoring': 'monitoring',
        'monitoringAll': 'monitoringAll',
        'monitoringExec': 'monitoringExec'
    };
    return pageKeyMap[pageName] || pageName;
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
    const pageKey = getPageKey(pageName);
    
    if (appInstance.router.pages[pageKey]) {
        const page = appInstance.router.pages[pageKey];
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