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

    /**
     * Logout function - VERSI ASYNC DENGAN PROMISE
     * Membersihkan session, cache, dan data user
     * @returns {Promise<void>}
     */
    async logout() {
        // Simpan user sebelum dihapus untuk log jika perlu
        const oldUser = this.currentUser;
        
        // Step 1: Clear current user data
        this.currentUser = null;
        this.sessionId = null;
        
        // Step 2: Clear all caches
        this.iadlCache = [];
        this.userCache = [];
        
        // Step 3: Clear any pending requests (optional - untuk future implementation)
        // Abort controller bisa ditambahkan di sini jika diperlukan
        
        // Step 4: Logging untuk debugging (hanya jika debug mode aktif)
        const isDebugMode = CONFIG?.FEATURES?.DEBUG_MODE || false;
        if (isDebugMode && oldUser) {
            console.log(`✅ User "${oldUser.username}" logged out successfully at ${new Date().toISOString()}`);
            console.log('Session cleaned, caches cleared');
        }
        
        // Step 5: Return Promise resolved
        // Memberikan kepastian bahwa cleanup sudah selesai
        return Promise.resolve();
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
    
    /**
     * Cek apakah user saat ini login
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.currentUser !== null && this.sessionId !== null;
    }
    
    /**
     * Get current session ID
     * @returns {string|null}
     */
    getSessionId() {
        return this.sessionId;
    }
    
    /**
     * Get current user
     * @returns {Object|null}
     */
    getCurrentUser() {
        return this.currentUser;
    }
    
    /**
     * Clear specific cache by key
     * @param {string} cacheKey - Nama cache yang akan dibersihkan
     */
    clearCache(cacheKey) {
        if (cacheKey === 'iadl') {
            this.iadlCache = [];
        } else if (cacheKey === 'users') {
            this.userCache = [];
        } else {
            console.warn(`Unknown cache key: ${cacheKey}`);
        }
    }
    
    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.iadlCache = [];
        this.userCache = [];
        console.log('All caches cleared');
    }
}