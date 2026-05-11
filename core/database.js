// core/database.js
// Google Sheets as the ONLY data source - No localStorage

import { CONFIG, getWebAppUrl } from './config.js';

export class DatabaseService {
    constructor() {
        this.currentUser = null;
        this.sessionId = null;
        this.iadlCache = [];
        this.userCache = [];
    }

    async initDB() {
        // Initialize by fetching users from Google Sheets for caching
        try {
            const users = await this.fetchUsers();
            this.userCache = users;
            console.log('✅ Database initialized from Google Sheets');
        } catch (error) {
            console.error('Failed to initialize database:', error);
        }
    }

    // Generic fetch method for Google Sheets API
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
                    url.searchParams.append(key, typeof value === 'object' ? 
                        JSON.stringify(value) : value.toString());
                }
            }

            console.log(`Fetching from Google Sheets: ${action}`, params);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.GOOGLE_SHEETS.TIMEOUT);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Google Sheets fetch error:', error);
            throw error;
        }
    }

    // Fetch users from 'akses' sheet
    async fetchUsers() {
        const result = await this.fetchFromSheets('getUsers');
        if (result.status === 'success' && result.data) {
            return result.data;
        }
        return [];
    }

    // Login function using Google Sheets
    async login(username, password) {
        try {
            const result = await this.fetchFromSheets('login', { username, password });
            
            if (result.status === 'success' && result.user) {
                this.currentUser = result.user;
                this.sessionId = 'session_' + Date.now();
                return {
                    success: true,
                    user: result.user,
                    sessionId: this.sessionId
                };
            } else {
                return {
                    success: false,
                    message: result.message || 'Login gagal'
                };
            }
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Gagal menghubungi server'
            };
        }
    }

    // Logout function
    logout() {
        this.currentUser = null;
        this.sessionId = null;
    }

    // Get all users for user management
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

    // IADL cache methods
    saveIADLCache(data) {
        this.iadlCache = data;
    }

    getIADLCache() {
        return this.iadlCache;
    }
}