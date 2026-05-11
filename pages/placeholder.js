// pages/placeholder.js
export class PlaceholderPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
    }

    render(pageName) {
        const pageNames = {
            'dashboard': 'Dashboard',
            'otp-create': 'Create OTP',
            'otp-history': 'OTP History',
            'otp-review': 'Review OTP',
            'monitoring': 'Progress Monitoring',
            'monitoring-all': 'All Monitoring',
            'monitoring-exec': 'Monitoring Overview',
            'temuan-input': 'Input Temuan',
            'temuan-daftar': 'Daftar Temuan',
            'temuan-tindak-lanjut': 'Tindak Lanjut',
            'reports': 'Reports',
            'reports-hse': 'HSE Reports',
            'executive-reports': 'Executive Reports',
            'master-kpi': 'Master KPI',
            'master-template': 'Objective Template',
            'approval-management': 'Approval Management',
            'approval-history': 'Approval History',
            'management-review': 'Management Review',
            'management-decision': 'Management Decision',
            'user-management': 'User Management',
            'iadl-monokem': 'IADL Monokem'
        };

        const title = pageNames[pageName] || pageName;
        
        return `
            <div class="page-header">
                <div>
                    <h1 class="page-title">${title}</h1>
                    <p class="breadcrumb">Home / <span>${title}</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-tools"></i>
                    <h2>Fitur Akan Segera Dibuat</h2>
                    <p>
                        Halaman <strong>${title}</strong> sedang dalam tahap pengembangan.<br>
                        Silakan kembali lagi nanti untuk melihat update terbaru.
                    </p>
                </div>
            </div>`;
    }
}