// core/api.js
// Service terpusat untuk komunikasi dengan Google Sheets backend
import { getWebAppUrl, isGoogleSheetsEnabled, CONFIG } from './config.js';

// Simple in-memory cache
const cache = new Map();

export class ApiService {
    constructor() {
        this.pendingRequests = new Map(); // untuk deduplication request simultan
        this.defaultTimeout = CONFIG.GOOGLE_SHEETS.TIMEOUT || 30000;
        
        // Default TTL per action (ms)
        this.defaultTTL = 30000; // 30 detik untuk data transaksional
        this.ttlOverrides = {
            // Data master: lebih panjang (5 menit)
            'getAllKPI': 300000,
            'getAllTemplates': 300000,
            'getAll': 300000,           // IADL
            'getUsers': 300000,
            'getAllUsers': 300000,
            // Data review/management: 2 menit
            'getAllManagementReview': 120000,
            'getAllManagementDecision': 120000,
            // Data transaksional: default 30 detik (bisa di-refresh manual)
            // 'getAllOTP', 'getAllTemuan', dll akan pakai defaultTTL
        };
    }

    /**
     * Generate cache key dari action dan params
     */
    getCacheKey(action, params) {
        const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
        return `${action}?${sortedParams}`;
    }

    /**
     * Get TTL untuk action tertentu
     */
    getTTL(action) {
        return this.ttlOverrides[action] || this.defaultTTL;
    }

    /**
     * Clear cache untuk action tertentu (atau semua)
     */
    clearCache(action = null) {
        if (action) {
            for (const key of cache.keys()) {
                if (key.startsWith(action)) cache.delete(key);
            }
        } else {
            cache.clear();
        }
        console.debug(`[ApiService] Cache cleared for ${action || 'all actions'}`);
    }

    /**
     * Fetch dari Google Sheets dengan caching, retry, dan timeout
     */
    async fetch(action, params = {}, options = {}) {
        const {
            useCache = true,
            ttl = null, // override TTL jika diberikan
            retries = 2,
            timeout = this.defaultTimeout,
            forceRefresh = false
        } = options;

        const webAppUrl = getWebAppUrl();
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            console.warn('Google Sheets not configured or disabled');
            return { status: 'error', data: [], total: 0, message: 'Google Sheets not configured' };
        }

        const cacheKey = this.getCacheKey(action, params);
        const effectiveTTL = ttl !== null ? ttl : this.getTTL(action);

        // Cek cache
        if (useCache && !forceRefresh && cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() - cached.timestamp < effectiveTTL) {
                console.debug(`[ApiService] Cache hit for ${cacheKey} (TTL ${effectiveTTL}ms)`);
                return cached.data;
            } else {
                cache.delete(cacheKey);
            }
        }

        // Deduplication: jika request yang sama sedang berjalan, return promise yang sama
        if (this.pendingRequests.has(cacheKey)) {
            console.debug(`[ApiService] Pending request for ${cacheKey}, waiting...`);
            return this.pendingRequests.get(cacheKey);
        }

        // Buat promise request
        const requestPromise = this._doFetch(action, params, timeout, retries);
        this.pendingRequests.set(cacheKey, requestPromise);

        try {
            const result = await requestPromise;
            // Simpan ke cache jika sukses
            if (result.status === 'success' && useCache) {
                cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
            }
            return result;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Internal fetch dengan retry dan timeout
     */
    async _doFetch(action, params, timeout, retries) {
        const webAppUrl = getWebAppUrl();
        let lastError;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const url = new URL(webAppUrl);
                url.searchParams.append('action', action);

                // Parameter umum (pagination, filter)
                if (params.limit !== undefined) url.searchParams.append('limit', params.limit);
                if (params.offset !== undefined) url.searchParams.append('offset', params.offset);
                if (params.year !== undefined) url.searchParams.append('year', params.year);
                if (params.department !== undefined) url.searchParams.append('department', params.department);
                if (params.status !== undefined) url.searchParams.append('status', params.status);

                // Parameter lain (selain yang sudah ditangani)
                for (const [key, value] of Object.entries(params)) {
                    if (!['limit', 'offset', 'year', 'department', 'status'].includes(key)) {
                        if (value !== undefined && value !== null && value !== '') {
                            url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : value.toString());
                        }
                    }
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

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
                if (result.status === 'error') {
                    throw new Error(result.message || 'Unknown error');
                }
                return result;

            } catch (error) {
                lastError = error;
                console.warn(`[ApiService] Attempt ${attempt + 1} failed for ${action}:`, error.message);
                if (attempt < retries) {
                    // Exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
                }
            }
        }

        throw lastError;
    }

    /**
     * Convenience methods untuk action-action umum
     */
    async getAllOTP(params = {}, options = {}) {
        return this.fetch('getAllOTP', params, options);
    }

    async getOTPByDept(department, params = {}, options = {}) {
        return this.fetch('getOTPByDept', { department, ...params }, options);
    }

    async getAllTemuan(params = {}, options = {}) {
        return this.fetch('getAllTemuan', params, options);
    }

    async getTemuanByDept(department, params = {}, options = {}) {
        return this.fetch('getTemuanByDept', { department, ...params }, options);
    }

    async getAllManagementReview(params = {}, options = {}) {
        return this.fetch('getAllManagementReview', params, options);
    }

    async getAllManagementDecision(params = {}, options = {}) {
        return this.fetch('getAllManagementDecision', params, options);
    }

    async getAllKPI(params = {}, options = {}) {
        return this.fetch('getAllKPI', params, options);
    }

    async getAllTemplates(params = {}, options = {}) {
        return this.fetch('getAllTemplates', params, options);
    }

    async getAllIADL(params = {}, options = {}) {
        return this.fetch('getAll', params, options);
    }

    async getUsers(params = {}, options = {}) {
        return this.fetch('getUsers', params, options);
    }

    async login(username, password) {
        return this.fetch('login', { username, password }, { useCache: false, retries: 1 });
    }

    // Write operations (tidak pakai cache)
    async saveOTP(data) {
        return this.fetch('saveOTP', { data: JSON.stringify(data) }, { useCache: false, retries: 1 });
    }

    async updateOTP(data) {
        return this.fetch('updateOTP', { data: JSON.stringify(data) }, { useCache: false, retries: 1 });
    }

    async updateOTPStatus(otpId, status, reviewerNotes, reviewedBy, reviewedDate) {
        return this.fetch('updateOTPStatus', { otpId, status, reviewerNotes, reviewedBy, reviewedDate }, { useCache: false });
    }

    async saveTemuan(data) {
        return this.fetch('saveTemuan', { data: JSON.stringify(data) }, { useCache: false });
    }

    async updateTemuanTL(data) {
        return this.fetch('updateTemuanTL', { data: JSON.stringify(data) }, { useCache: false });
    }

    async saveManagementReview(data) {
        return this.fetch('saveManagementReview', { data: JSON.stringify(data) }, { useCache: false });
    }

    async saveManagementDecision(data) {
        return this.fetch('saveManagementDecision', { data: JSON.stringify(data) }, { useCache: false });
    }

    async updateMDStatus(mdId, status) {
        return this.fetch('updateMDStatus', { mdId, status }, { useCache: false });
    }
}

// Singleton instance
let apiInstance = null;

export function getApi() {
    if (!apiInstance) {
        apiInstance = new ApiService();
    }
    return apiInstance;
}