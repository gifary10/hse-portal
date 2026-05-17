// core/database.js
// [UPDATED: Menggunakan ApiService, standardisasi login, caching terpusat]

import { getApi } from './api.js';
import { CONFIG } from './config.js';

export class DatabaseService {
    constructor() {
        this.api = getApi();
        this.currentUser = null;
        this.sessionId = null;
        this.iadlCache = [];
        this.userCache = [];
    }

    async initDB() {
        try {
            const users = await this.fetchUsers();
            this.userCache = users;
            console.log('✅ Database initialized from Google Sheets via ApiService');
        } catch (error) {
            console.error('Failed to initialize database:', error);
        }
    }

    async fetchFromSheets(action, params = {}) {
        // Delegasikan ke ApiService
        try {
            const result = await this.api.fetch(action, params);
            return result;
        } catch (error) {
            console.error('Database fetch error:', error);
            return { status: 'error', data: [], message: error.message };
        }
    }

    async fetchUsers() {
        const result = await this.fetchFromSheets('getUsers');
        if (result.status === 'success' && result.data) return result.data;
        return [];
    }

    async login(username, password) {
        try {
            const result = await this.api.login(username, password);
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
        
        // Bersihkan cache ApiService
        this.api.clearCache();
        
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