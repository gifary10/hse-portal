// core/config.js
export const CONFIG = {
    // Google Sheets API Configuration
    GOOGLE_SHEETS: {
        WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbw5WRxg5Q59aq5MMmGK321kffh_luKxUPwJXaSkI_B1ZgPbqAk5mYCnfWp3DrSYdfvQlQ/exec',
        ENABLED: true,
        TIMEOUT: 30000
    },
    
    // Application Configuration
    APP: {
        NAME: 'EMS Monokem',
        VERSION: '1.0.0'
    },
    
    // Feature Flags
    FEATURES: {
        USE_GOOGLE_SHEETS: true,
        DEBUG_MODE: true
    }
};

// Helper functions
export function getWebAppUrl() {
    return CONFIG.GOOGLE_SHEETS.WEB_APP_URL;
}

export function setWebAppUrl(url) {
    CONFIG.GOOGLE_SHEETS.WEB_APP_URL = url;
    localStorage.setItem('web_app_url', url);
}

export function isGoogleSheetsEnabled() {
    return CONFIG.FEATURES.USE_GOOGLE_SHEETS && CONFIG.GOOGLE_SHEETS.ENABLED;
}

// Load saved config from localStorage
export function loadConfig() {
    const savedUrl = localStorage.getItem('web_app_url');
    if (savedUrl) {
        CONFIG.GOOGLE_SHEETS.WEB_APP_URL = savedUrl;
    }
}

export default CONFIG;