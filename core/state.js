// core/state.js
export class AppState {
    constructor() {
        this.currentUser = null;
        this.sessionId = null;
        this.currentPage = 'dashboard';
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
        
        const allMenus = [
            { 
                section: 'Dashboard', 
                items: [
                    { id: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', page: 'dashboard' }
                ] 
            },
            { 
                section: 'OTP Management', 
                items: [
                    { id: 'otp-create', label: 'Create OTP', icon: 'bi-pencil-square', page: 'otp-create' },
                    { id: 'otp-history', label: 'OTP History', icon: 'bi-clock-history', page: 'otp-history' },
                    { id: 'otp-review', label: 'Review OTP', icon: 'bi-search', page: 'otp-review' }
                ]
            },
            { 
                section: 'Approval', 
                items: [
                    { id: 'approval-management', label: 'Approval Management', icon: 'bi-check-circle', page: 'approval-management' },
                    { id: 'approval-history', label: 'Approval History', icon: 'bi-clock-history', page: 'approval-history' }
                ]
            },
            { 
                section: 'Monitoring', 
                items: [
                    { id: 'monitoring', label: 'Progress Monitoring', icon: 'bi-graph-up', page: 'monitoring' },
                    { id: 'monitoring-all', label: 'All Monitoring', icon: 'bi-graph-up', page: 'monitoring-all' },
                    { id: 'monitoring-exec', label: 'Monitoring Overview', icon: 'bi-graph-up', page: 'monitoring-exec' }
                ]
            },
            { 
                section: 'Temuan Audit Internal', 
                items: [
                    { id: 'temuan-input', label: 'Input Temuan', icon: 'bi-plus-circle', page: 'temuan-input' },
                    { id: 'temuan-daftar', label: 'Daftar Temuan', icon: 'bi-list-check', page: 'temuan-daftar' },
                    { id: 'temuan-tindak-lanjut', label: 'Tindak Lanjut', icon: 'bi-arrow-repeat', page: 'temuan-tindak-lanjut' }
                ]
            },
            { 
                section: 'Master Data', 
                items: [
                    { id: 'master-kpi', label: 'KPI Master', icon: 'bi-bullseye', page: 'master-kpi' },
                    { id: 'master-template', label: 'Objective Template', icon: 'bi-clipboard', page: 'master-template' },
                    { id: 'iadl-monokem', label: 'IADL Monokem', icon: 'bi-file-earmark-text', page: 'iadl-monokem' }
                ]
            },
            { 
                section: 'Management Review', 
                items: [
                    { id: 'management-review', label: 'Management Review', icon: 'bi-clipboard-data', page: 'management-review' },
                    { id: 'management-decision', label: 'Management Decision', icon: 'bi-bullseye', page: 'management-decision' }
                ]
            },
            { 
                section: 'Reports', 
                items: [
                    { id: 'reports', label: 'Reports', icon: 'bi-file-earmark-bar-graph', page: 'reports' },
                    { id: 'reports-hse', label: 'HSE Reports', icon: 'bi-file-earmark-bar-graph', page: 'reports-hse' },
                    { id: 'executive-reports', label: 'Executive Reports', icon: 'bi-file-earmark-bar-graph', page: 'executive-reports' }
                ]
            },
            { 
                section: 'User Management', 
                items: [
                    { id: 'user-management', label: 'User Management', icon: 'bi-people', page: 'user-management' }
                ] 
            }
        ];
        
        return allMenus;
    }
}