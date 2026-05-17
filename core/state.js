// core/state.js
export class AppState {
    constructor() {
        this.currentUser = null;
        this.sessionId = null;
        this.currentPage = 'monitoring';
        this.listeners = new Map();
        this.isClearingUser = false; // Flag untuk mencegah multiple clear
    }

    setUser(user, sid) {
        this.currentUser = user;
        this.sessionId = sid;
        this.emit('userChanged', user);
    }

    /**
     * Clear user data - VERSI ASYNC DENGAN PROMISE
     * Sekarang mengembalikan Promise agar pemanggil bisa menunggu
     * sampai semua operasi cleanup selesai
     * @returns {Promise<void>}
     */
    async clearUser() {
        // Cegah multiple clear
        if (this.isClearingUser) {
            console.log('clearUser already in progress, ignoring...');
            return;
        }
        
        this.isClearingUser = true;
        
        try {
            // Step 1: Hapus sessionStorage items yang berkaitan dengan user
            this.clearUserSessionStorage();
            
            // Step 2: Hapus semua event listeners internal (opsional)
            // Tidak perlu menghapus listeners, cukup clear data
            
            // Step 3: Simpan user lama untuk log jika diperlukan
            const oldUser = this.currentUser;
            
            // Step 4: Reset state
            this.currentUser = null;
            this.sessionId = null;
            
            // Step 5: Emit event setelah state benar-benar bersih
            this.emit('userChanged', null);
            
            // Step 6: Optional - log untuk debugging
            if (oldUser && console && CONFIG?.FEATURES?.DEBUG_MODE) {
                console.log(`User ${oldUser.username} logged out successfully`);
            }
            
        } catch (error) {
            console.error('Error during clearUser:', error);
            // Tetap reset state meskipun error
            this.currentUser = null;
            this.sessionId = null;
            this.emit('userChanged', null);
        } finally {
            this.isClearingUser = false;
        }
    }
    
    /**
     * Hapus semua data sessionStorage yang terkait dengan user
     * Mencegah data draft terbawa setelah logout
     */
    clearUserSessionStorage() {
        // Daftar key yang harus dihapus saat logout
        const keysToRemove = [
            // OTP related
            'selectedOTP',
            'selectedOTPId',
            'editOTPData',
            'otpFormDraft',
            
            // Temuan related
            'selectedTemuan',
            'selectedTemuanId',
            'temuanFormDraft',
            
            // Management Review related
            'mrFormDraft',
            'selectedMR',
            
            // Management Decision related
            'mdFormDraft',
            'selectedMD',
            
            // General
            'currentPage',
            'lastActivity'
        ];
        
        for (const key of keysToRemove) {
            try {
                sessionStorage.removeItem(key);
            } catch (e) {
                console.warn(`Failed to remove sessionStorage key: ${key}`, e);
            }
        }
    }
    
    /**
     * Cek apakah user saat ini bisa logout
     * Memeriksa apakah ada data draft yang belum disimpan
     * @returns {boolean} - true jika aman untuk logout, false jika ada draft
     */
    canLogout() {
        // Cek berbagai kemungkinan draft data di sessionStorage
        const draftKeys = [
            'editOTPData',
            'selectedOTP',
            'selectedTemuan',
            'otpFormDraft',
            'temuanFormDraft',
            'mrFormDraft',
            'mdFormDraft'
        ];
        
        for (const key of draftKeys) {
            const draft = sessionStorage.getItem(key);
            if (draft && draft !== '{}' && draft !== 'null') {
                try {
                    const parsed = JSON.parse(draft);
                    if (parsed && Object.keys(parsed).length > 0) {
                        return false; // Ada draft, tidak aman untuk logout
                    }
                } catch (e) {
                    // Jika tidak bisa di-parse tapi ada isinya, anggap ada draft
                    if (draft && draft.length > 10) {
                        return false;
                    }
                }
            }
        }
        
        return true; // Aman untuk logout
    }
    
    /**
     * Dapatkan daftar draft yang belum disimpan
     * @returns {Array} - Array of draft info
     */
    getUnsavedDrafts() {
        const drafts = [];
        const draftKeys = [
            { key: 'editOTPData', name: 'OTP yang sedang diedit' },
            { key: 'selectedOTP', name: 'Data OTP sementara' },
            { key: 'selectedTemuan', name: 'Data temuan sementara' },
            { key: 'otpFormDraft', name: 'Draft OTP' },
            { key: 'temuanFormDraft', name: 'Draft Temuan' },
            { key: 'mrFormDraft', name: 'Draft Management Review' },
            { key: 'mdFormDraft', name: 'Draft Management Decision' }
        ];
        
        for (const { key, name } of draftKeys) {
            const draft = sessionStorage.getItem(key);
            if (draft && draft !== '{}' && draft !== 'null') {
                try {
                    const parsed = JSON.parse(draft);
                    if (parsed && Object.keys(parsed).length > 0) {
                        drafts.push(name);
                    }
                } catch (e) {
                    if (draft && draft.length > 10) {
                        drafts.push(name);
                    }
                }
            }
        }
        
        return drafts;
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
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
        if (!this.currentUser) return [];
        
        const role = this.currentUser.role || 'department';
        
        // =============================================
        // DEFINISI SEMUA MENU
        // =============================================
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

        // =============================================
        // AKSES MENU BERDASARKAN ROLE
        // =============================================
        
        const roleAccess = {
            // DEPARTMENT - UPDATED: tambah master-kpi dan master-template
            department: [
                { section: 'otpManagement', items: ['otp-create', 'otp-history'] },
                { section: 'monitoring', items: ['monitoring'] },
                { section: 'temuan', items: ['temuan-daftar', 'temuan-tindak-lanjut'] },
                { section: 'masterData', items: ['master-kpi', 'master-template', 'iadl-monokem'] },
                { section: 'reports', items: ['reports'] },
            ],
            
            // HSE
            hse: [
                { section: 'otpManagement', items: ['otp-history'] },
                { section: 'monitoring', items: ['monitoring-all'] },
                'temuan',
                { section: 'masterData', items: ['master-template', 'iadl-monokem'] },
                { section: 'managementReview', items: ['management-review'] },
                { section: 'reports', items: ['reports-hse'] },
            ],
            
            // TOP MANAGEMENT
            top_management: [
                { section: 'otpManagement', items: ['otp-history', 'otp-review'] },
                { section: 'monitoring', items: ['monitoring-exec'] },
                { section: 'temuan', items: ['temuan-daftar', 'temuan-tindak-lanjut'] },
                { section: 'masterData', items: ['master-kpi', 'master-template'] },
                'managementReview',
                'reports',
                'userManagement',
            ]
        };

        // =============================================
        // BUILD MENU BERDASARKAN ROLE
        // =============================================
        
        const accessConfig = roleAccess[role] || roleAccess['department'];
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