// core/state.js
export class AppState {
    constructor() {
        this.currentUser = null;
        this.sessionId = null;
        this.currentPage = 'monitoring';
        this.listeners = new Map();
    }

    setUser(user, sid) {
        this.currentUser = user;
        this.sessionId = sid;
        this.emit('userChanged', user);
    }

    clearUser() {
        this.currentUser = null;
        this.sessionId = null;
        sessionStorage.removeItem('currentPage');
        this.emit('userChanged', null);
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(data));
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
            // DEPARTMENT
            department: [
                { section: 'otpManagement', items: ['otp-create', 'otp-history'] },
                { section: 'monitoring', items: ['monitoring'] },
                { section: 'temuan', items: ['temuan-daftar', 'temuan-tindak-lanjut'] },
                { section: 'masterData', items: ['iadl-monokem'] },
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