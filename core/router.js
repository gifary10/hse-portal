// core/router.js
import { AuthPage } from '../pages/auth.js';
import { PlaceholderPage } from '../pages/placeholder.js';
import { IADLPage } from '../pages/iadl.js';
import { UserManagementPage } from '../pages/user-management.js';

export class Router {
    constructor(state, db) {
        this.state = state;
        this.db = db;
        this.pages = {};
        this.layout = null;
        this.initPages();
    }

    initPages() {
        this.pages = {
            auth: new AuthPage(this.state, this.db, this),
            placeholder: new PlaceholderPage(this.state, this.db, this),
            iadl: new IADLPage(this.state, this.db, this),
            userManagement: new UserManagementPage(this.state, this.db, this)
        };
    }

    init() {
        const hasUser = this.state.currentUser !== null;
        
        if (hasUser) {
            const savedPage = sessionStorage.getItem('currentPage');
            const defaultPage = 'dashboard';
            
            if (savedPage && this.isValidPage(savedPage)) {
                this.navigateTo(savedPage);
            } else {
                this.navigateTo(defaultPage);
            }
        } else {
            this.navigateTo('login');
        }
    }

    async navigateTo(page, params = {}) {
        if (!this.state.currentUser && page !== 'login') {
            page = 'login';
        }

        if (this.state.currentUser && page === 'login') {
            page = 'dashboard';
        }

        this.state.currentPage = page;
        
        if (page !== 'login') {
            sessionStorage.setItem('currentPage', page);
        }
        
        // Handle async render
        const content = await this.renderPage(page);
        
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = content;
        } else {
            console.error('Element #mainContent tidak ditemukan');
            return;
        }
        
        this.updateAfterNavigation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.updateDocumentTitle(page);
    }

    async renderPage(page) {
        switch (page) {
            case 'login':
                return this.pages.auth.render();
                
            case 'iadl-monokem':
                return await this.pages.iadl.render();
            
            case 'user-management':
                return await this.pages.userManagement.render();
                
            default:
                if (this.isValidPlaceholderPage(page)) {
                    return this.pages.placeholder.render(page);
                }
                
                console.warn(`Halaman tidak dikenal: ${page}, redirect ke dashboard`);
                this.state.currentPage = 'dashboard';
                return this.pages.placeholder.render('dashboard');
        }
    }

    updateAfterNavigation() {
        if (this.layout) {
            this.layout.updateSidebar();
            this.layout.updateUserInfo();
        }
        
        document.dispatchEvent(new CustomEvent('pageChanged', {
            detail: { 
                page: this.state.currentPage,
                user: this.state.currentUser 
            }
        }));
    }

    updateDocumentTitle(page) {
        const titles = {
            'login': 'Login - EMS Monokem',
            'dashboard': 'Dashboard - EMS Monokem',
            'otp-create': 'Create OTP - EMS Monokem',
            'otp-history': 'OTP History - EMS Monokem',
            'otp-review': 'Review OTP - EMS Monokem',
            'approval-management': 'Approval Management - EMS Monokem',
            'approval-history': 'Approval History - EMS Monokem',
            'monitoring': 'Progress Monitoring - EMS Monokem',
            'monitoring-all': 'All Monitoring - EMS Monokem',
            'monitoring-exec': 'Monitoring Overview - EMS Monokem',
            'temuan-input': 'Input Temuan - EMS Monokem',
            'temuan-daftar': 'Daftar Temuan - EMS Monokem',
            'temuan-tindak-lanjut': 'Tindak Lanjut - EMS Monokem',
            'master-kpi': 'Master KPI - EMS Monokem',
            'master-template': 'Objective Template - EMS Monokem',
            'iadl-monokem': 'IADL Monokem - EMS Monokem',
            'management-review': 'Management Review - EMS Monokem',
            'management-decision': 'Management Decision - EMS Monokem',
            'reports': 'Reports - EMS Monokem',
            'reports-hse': 'HSE Reports - EMS Monokem',
            'executive-reports': 'Executive Reports - EMS Monokem',
            'user-management': 'User Management - EMS Monokem'
        };
        
        document.title = titles[page] || `${page} - EMS Monokem`;
    }

    isValidPage(page) {
        const validPages = [
            'login', 'dashboard', 'otp-create', 'otp-history', 'otp-review',
            'approval-management', 'approval-history', 'monitoring', 'monitoring-all',
            'monitoring-exec', 'temuan-input', 'temuan-daftar', 'temuan-tindak-lanjut',
            'master-kpi', 'master-template', 'iadl-monokem', 'management-review',
            'management-decision', 'reports', 'reports-hse', 'executive-reports',
            'user-management'
        ];
        
        return validPages.includes(page);
    }

    isValidPlaceholderPage(page) {
        return this.isValidPage(page) && 
               page !== 'login' && 
               page !== 'iadl-monokem' && 
               page !== 'user-management';
    }

    renderErrorState(title, message) {
        return `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Error</h1>
                    <p class="breadcrumb">Home / <span>Error</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger);"></i>
                    <h2>${title || 'Terjadi Kesalahan'}</h2>
                    <p>${message || 'Silakan coba lagi atau hubungi administrator'}</p>
                    <button class="btn btn-primary mt-md" data-action="navigate" data-params='{"page": "dashboard"}'>
                        <i class="bi bi-house"></i> Kembali ke Dashboard
                    </button>
                </div>
            </div>
        `;
    }

    getCurrentRoute() {
        return {
            page: this.state.currentPage,
            user: this.state.currentUser,
            timestamp: new Date().toISOString()
        };
    }

    async refreshCurrentPage() {
        const currentPage = this.state.currentPage;
        const mainContent = document.getElementById('mainContent');
        
        if (mainContent) {
            const content = await this.renderPage(currentPage);
            mainContent.innerHTML = content;
        }
        
        this.updateAfterNavigation();
    }
}