// core/config.js
export const CONFIG = {
    GOOGLE_SHEETS: {
        WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwd4V5ykncUjXQl2MCUpQWyWh8E68kVC0E1O42L-uD8_QCmeJqFGo_rT5XEDvG27Cd1LQ/exec',
        ENABLED: true,
        TIMEOUT: 30000
    },
    APP: {
        NAME: 'EMS Monokem',
        VERSION: '1.0.0',
        DEFAULT_PAGE: 'dashboard',
        PAGE_SIZE: 10
    },
    FEATURES: {
        USE_GOOGLE_SHEETS: true,
        DEBUG_MODE: true
    }
};

export function getWebAppUrl() {
    return CONFIG.GOOGLE_SHEETS.WEB_APP_URL;
}

export function isGoogleSheetsEnabled() {
    return CONFIG.FEATURES.USE_GOOGLE_SHEETS && CONFIG.GOOGLE_SHEETS.ENABLED;
}

export function loadConfig() {
    const savedUrl = localStorage.getItem('web_app_url');
    if (savedUrl) {
        CONFIG.GOOGLE_SHEETS.WEB_APP_URL = savedUrl;
    }
}

export default CONFIG;