// core/database.js
import { CONFIG, getWebAppUrl } from './config.js';

export class DatabaseService {
    constructor() {
        this.currentUser = null;
        this.sessionId = null;
        this.iadlCache = [];
        this.userCache = [];
    }

    async initDB() {
        try {
            const users = await this.fetchUsers();
            this.userCache = users;
            console.log('✅ Database initialized from Google Sheets');
        } catch (error) {
            console.error('Failed to initialize database:', error);
        }
    }

    async fetchFromSheets(action, params = {}) {
        const webAppUrl = getWebAppUrl();
        if (!webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            throw new Error('Google Sheets URL not configured');
        }
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', action);
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
                }
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.GOOGLE_SHEETS.TIMEOUT);
            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Google Sheets fetch error:', error);
            throw error;
        }
    }

    async fetchUsers() {
        const result = await this.fetchFromSheets('getUsers');
        if (result.status === 'success' && result.data) return result.data;
        return [];
    }

    async login(username, password) {
        try {
            const result = await this.fetchFromSheets('login', { username, password });
            if (result.status === 'success' && result.user) {
                this.currentUser = result.user;
                this.sessionId = 'session_' + Date.now();
                return { success: true, user: result.user, sessionId: this.sessionId };
            } else {
                return { success: false, message: result.message || 'Login gagal' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Gagal menghubungi server' };
        }
    }

    async logout() {
        const oldUser = this.currentUser;
        this.currentUser = null;
        this.sessionId = null;
        this.iadlCache = [];
        this.userCache = [];
        const isDebugMode = CONFIG?.FEATURES?.DEBUG_MODE || false;
        if (isDebugMode && oldUser) {
            console.log(`✅ User "${oldUser.username}" logged out successfully at ${new Date().toISOString()}`);
        }
        return Promise.resolve();
    }

    async getAllUsers() {
        try {
            const result = await this.fetchFromSheets('getAllUsers');
            if (result.status === 'success' && result.data) {
                this.userCache = result.data;
                return result.data;
            }
            return this.userCache;
        } catch (error) {
            console.error('Failed to fetch users:', error);
            return this.userCache;
        }
    }

    saveIADLCache(data) {
        this.iadlCache = data;
    }

    getIADLCache() {
        return this.iadlCache;
    }
}