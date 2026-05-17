// core/state.js
export class AppState {
    constructor() {
        this.currentUser = null;
        this.sessionId = null;
        this.currentPage = 'monitoring';
        this.listeners = new Map();
        this.isClearingUser = false;
        
        // ========== TAMBAHAN: Shared data cache ==========
        // Menyimpan data yang bisa digunakan antar halaman untuk mengurangi fetch berulang
        this.sharedData = {
            otp: null,           // { data: [], lastFetch: timestamp }
            temuan: null,
            managementReview: null,
            managementDecision: null,
            kpi: null,
            templates: null,
            iadl: null,
            users: null
        };
    }

    setUser(user, sid) {
        this.currentUser = user;
        this.sessionId = sid;
        this.emit('userChanged', user);
    }

    async clearUser() {
        if (this.isClearingUser) return;
        this.isClearingUser = true;
        try {
            this.clearUserSessionStorage();
            const oldUser = this.currentUser;
            this.currentUser = null;
            this.sessionId = null;
            // Bersihkan shared data saat logout
            this.clearSharedData();
            this.emit('userChanged', null);
            if (oldUser && window.CONFIG?.FEATURES?.DEBUG_MODE) {
                console.log(`User ${oldUser.username} logged out successfully`);
            }
        } catch (error) {
            console.error('Error during clearUser:', error);
            this.currentUser = null;
            this.sessionId = null;
            this.emit('userChanged', null);
        } finally {
            this.isClearingUser = false;
        }
    }

    clearUserSessionStorage() {
        const keysToRemove = [
            'selectedOTP', 'selectedOTPId', 'editOTPData', 'otpFormDraft',
            'selectedTemuan', 'selectedTemuanId', 'temuanFormDraft',
            'mrFormDraft', 'selectedMR', 'mdFormDraft', 'selectedMD',
            'currentPage', 'lastActivity'
        ];
        for (const key of keysToRemove) {
            try {
                sessionStorage.removeItem(key);
            } catch (e) {}
        }
    }

    // ========== METHOD UNTUK SHARED DATA ==========
    clearSharedData() {
        for (const key in this.sharedData) {
            this.sharedData[key] = null;
        }
    }

    /**
     * Set data ke shared cache
     * @param {string} type - 'otp', 'temuan', 'managementReview', dll
     * @param {Array} data - Data array
     */
    setSharedData(type, data) {
        if (this.sharedData.hasOwnProperty(type)) {
            this.sharedData[type] = {
                data: data,
                lastFetch: Date.now()
            };
        }
    }

    /**
     * Get data dari shared cache
     * @param {string} type - tipe data
     * @param {number} maxAge - maksimal umur data dalam ms (default 60000 = 1 menit)
     * @returns {Array|null} - Data jika masih valid, null jika tidak ada atau expired
     */
    getSharedData(type, maxAge = 60000) {
        const cached = this.sharedData[type];
        if (cached && cached.data && (Date.now() - cached.lastFetch < maxAge)) {
            return cached.data;
        }
        return null;
    }

    /**
     * Cek apakah shared data tersedia dan masih fresh
     */
    hasSharedData(type, maxAge = 60000) {
        const cached = this.sharedData[type];
        return cached && cached.data && (Date.now() - cached.lastFetch < maxAge);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => {
            try {
                cb(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    getRoleMenus() {
        // ... (kode getRoleMenus tidak berubah, tetap sama seperti sebelumnya)
        // Saya salin dari kode asli untuk kelengkapan
        if (!this.currentUser) return [];

        const role = this.currentUser.role || 'department';

        const allMenuSections = {
            otpManagement: {
                section: 'OTP Management',
                items: [
                    { id: 'otp-create', label: 'Create OTP', icon: 'bi-pencil-square', page: 'otp-create' },
                    { id: 'otp-history', label: 'OTP History', icon: 'bi-clock-history', page: 'otp-history' },
                    { id: 'otp-review', label: 'Review OTP', icon: 'bi-search', page: 'otp-review' }
                ]
            },
            monitoring: {
                section: 'Monitoring',
                items: [
                    { id: 'monitoring', label: 'Progress Monitoring', icon: 'bi-graph-up', page: 'monitoring' },
                    { id: 'monitoring-all', label: 'All Monitoring', icon: 'bi-graph-up-arrow', page: 'monitoring-all' },
                    { id: 'monitoring-exec', label: 'Monitoring Overview', icon: 'bi-speedometer', page: 'monitoring-exec' }
                ]
            },
            temuan: {
                section: 'Temuan Audit Internal',
                items: [
                    { id: 'temuan-input', label: 'Input Temuan', icon: 'bi-plus-circle', page: 'temuan-input' },
                    { id: 'temuan-daftar', label: 'Daftar Temuan', icon: 'bi-list-check', page: 'temuan-daftar' },
                    { id: 'temuan-tindak-lanjut', label: 'Tindak Lanjut', icon: 'bi-arrow-repeat', page: 'temuan-tindak-lanjut' }
                ]
            },
            masterData: {
                section: 'Master Data',
                items: [
                    { id: 'master-kpi', label: 'Master KPI', icon: 'bi-bullseye', page: 'master-kpi' },
                    { id: 'master-template', label: 'Objective Template', icon: 'bi-clipboard', page: 'master-template' },
                    { id: 'iadl-monokem', label: 'IADL Monokem', icon: 'bi-file-earmark-text', page: 'iadl-monokem' }
                ]
            },
            managementReview: {
                section: 'Management Review',
                items: [
                    { id: 'management-review', label: 'Management Review', icon: 'bi-clipboard-data', page: 'management-review' },
                    { id: 'management-decision', label: 'Management Decision', icon: 'bi-bullseye', page: 'management-decision' }
                ]
            },
            reports: {
                section: 'Reports',
                items: [
                    { id: 'reports', label: 'Reports', icon: 'bi-file-earmark-bar-graph', page: 'reports' },
                    { id: 'reports-hse', label: 'HSE Reports', icon: 'bi-file-earmark-bar-graph', page: 'reports-hse' },
                    { id: 'executive-reports', label: 'Executive Reports', icon: 'bi-file-earmark-bar-graph', page: 'executive-reports' }
                ]
            },
            userManagement: {
                section: 'User Management',
                items: [
                    { id: 'user-management', label: 'User Management', icon: 'bi-people', page: 'user-management' }
                ]
            }
        };

        const roleAccess = {
            department: [
                { section: 'otpManagement', items: ['otp-create', 'otp-history'] },
                { section: 'monitoring', items: ['monitoring'] },
                { section: 'temuan', items: ['temuan-daftar'] },
                { section: 'masterData', items: ['master-kpi', 'master-template', 'iadl-monokem'] },
                { section: 'reports', items: ['reports'] }
            ],
            hse: [
                { section: 'otpManagement', items: ['otp-history'] },
                { section: 'monitoring', items: ['monitoring-all'] },
                'temuan',
                { section: 'masterData', items: ['master-template', 'iadl-monokem'] },
                { section: 'managementReview', items: ['management-review'] },
                { section: 'reports', items: ['reports-hse'] }
            ],
            top_management: [
                { section: 'otpManagement', items: ['otp-history', 'otp-review'] },
                { section: 'monitoring', items: ['monitoring-exec'] },
                { section: 'temuan', items: ['temuan-daftar', 'temuan-tindak-lanjut'] },
                { section: 'masterData', items: ['master-kpi', 'master-template'] },
                'managementReview',
                'reports',
                'userManagement'
            ]
        };

        const accessConfig = roleAccess[role] || roleAccess.department;
        const menus = [];

        accessConfig.forEach(config => {
            if (typeof config === 'string') {
                const section = allMenuSections[config];
                if (section) {
                    menus.push({
                        section: section.section,
                        items: [...section.items]
                    });
                }
            } else if (typeof config === 'object' && config.section) {
                const section = allMenuSections[config.section];
                if (section && config.items) {
                    const filteredItems = section.items.filter(item =>
                        config.items.includes(item.id)
                    );
                    if (filteredItems.length > 0) {
                        menus.push({
                            section: section.section,
                            items: filteredItems
                        });
                    }
                }
            }
        });

        return menus;
    }
}