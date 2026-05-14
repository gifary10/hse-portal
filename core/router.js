// core/router.js
import { AuthPage } from '../pages/auth.js';
import { IADLPage } from '../pages/iadl.js';
import { UserManagementPage } from '../pages/user-management.js';
import { MasterKPIPage } from '../pages/master-kpi.js';
import { MasterTemplatePage } from '../pages/master-template.js';
import { OTPCreatePage } from '../pages/otp-create.js';
import { OTPHistoryPage } from '../pages/otp-history.js';
import { OTPReviewPage } from '../pages/otp-review.js';
import { TemuanInputPage } from '../pages/temuan-input.js';
import { TemuanDaftarPage } from '../pages/temuan-daftar.js';
import { TemuanTindakLanjutPage } from '../pages/temuan-tindak-lanjut.js';
import { ManagementReviewPage } from '../pages/management-review.js';
import { ManagementDecisionPage } from '../pages/management-decision.js';
import { ReportsPage } from '../pages/reports.js';
import { ReportsHSEPage } from '../pages/reports-hse.js';
import { ExecutiveReportsPage } from '../pages/executive-reports.js';
import { MonitoringPage } from '../pages/monitoring.js';
import { MonitoringAllPage } from '../pages/monitoring-all.js';
import { MonitoringExecPage } from '../pages/monitoring-exec.js';

export class Router {
    constructor(state, db) {
        this.state = state;
        this.db = db;
        this.pages = {};
        this.layout = null;
        this.navigating = false;
        this.initPages();
    }

    initPages() {
        this.pages = {
            auth: new AuthPage(this.state, this.db, this),
            iadl: new IADLPage(this.state, this.db, this),
            userManagement: new UserManagementPage(this.state, this.db, this),
            masterKPI: new MasterKPIPage(this.state, this.db, this),
            masterTemplate: new MasterTemplatePage(this.state, this.db, this),
            otpCreate: new OTPCreatePage(this.state, this.db, this),
            otpHistory: new OTPHistoryPage(this.state, this.db, this),
            otpReview: new OTPReviewPage(this.state, this.db, this),
            temuanInput: new TemuanInputPage(this.state, this.db, this),
            temuanDaftar: new TemuanDaftarPage(this.state, this.db, this),
            temuanTindakLanjut: new TemuanTindakLanjutPage(this.state, this.db, this),
            managementReview: new ManagementReviewPage(this.state, this.db, this),
            managementDecision: new ManagementDecisionPage(this.state, this.db, this),
            reports: new ReportsPage(this.state, this.db, this),
            reportsHSE: new ReportsHSEPage(this.state, this.db, this),
            executiveReports: new ExecutiveReportsPage(this.state, this.db, this),
            monitoring: new MonitoringPage(this.state, this.db, this),
            monitoringAll: new MonitoringAllPage(this.state, this.db, this),
            monitoringExec: new MonitoringExecPage(this.state, this.db, this)
        };
    }

    init() {
        const hasUser = this.state.currentUser !== null;
        
        if (hasUser) {
            // Redirect ke monitoring page sesuai role setelah login
            this.navigateToDefaultPage();
        } else {
            this.navigateTo('login');
        }
    }

    navigateToDefaultPage() {
        const user = this.state.currentUser;
        const role = user?.role || 'department';
        
        if (role === 'top_management') {
            this.navigateTo('monitoring-exec');
        } else if (role === 'hse') {
            this.navigateTo('monitoring-all');
        } else {
            this.navigateTo('monitoring');
        }
    }

    async navigateTo(page, params = {}) {
        if (this.navigating) {
            console.warn('Navigation in progress, ignoring request to:', page);
            return;
        }
        
        this.navigating = true;
        
        if (!this.state.currentUser && page !== 'login') {
            page = 'login';
        }

        if (this.state.currentUser && page === 'login') {
            this.navigateToDefaultPage();
            this.navigating = false;
            return;
        }

        const mainContent = document.getElementById('mainContent');
        if (!mainContent) {
            console.error('Element #mainContent tidak ditemukan');
            this.navigating = false;
            return;
        }
        
        mainContent.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        mainContent.style.opacity = '0';
        mainContent.style.transform = 'translateY(10px)';
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        try {
            this.state.currentPage = page;
            
            const content = await this.renderPage(page, params);
            
            mainContent.innerHTML = content;
            
            const pageKey = this.getPageKey(page);
            if (this.pages[pageKey] && typeof this.pages[pageKey].afterRender === 'function') {
                this.pages[pageKey].afterRender();
            }
            
            requestAnimationFrame(() => {
                mainContent.style.opacity = '1';
                mainContent.style.transform = 'translateY(0)';
            });
            
            this.updateAfterNavigation();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.updateDocumentTitle(page);
            
        } catch (error) {
            console.error('Navigation error:', error);
            mainContent.innerHTML = this.renderErrorState('Error Navigasi', error.message);
            mainContent.style.opacity = '1';
            mainContent.style.transform = 'translateY(0)';
        } finally {
            this.navigating = false;
        }
    }

    getPageKey(page) {
        const pageKeyMap = {
            'login': 'auth',
            'iadl-monokem': 'iadl',
            'user-management': 'userManagement',
            'master-kpi': 'masterKPI',
            'master-template': 'masterTemplate',
            'otp-create': 'otpCreate',
            'otp-history': 'otpHistory',
            'otp-review': 'otpReview',
            'temuan-input': 'temuanInput',
            'temuan-daftar': 'temuanDaftar',
            'temuan-tindak-lanjut': 'temuanTindakLanjut',
            'management-review': 'managementReview',
            'management-decision': 'managementDecision',
            'reports': 'reports',
            'reports-hse': 'reportsHSE',
            'executive-reports': 'executiveReports',
            'monitoring': 'monitoring',
            'monitoring-all': 'monitoringAll',
            'monitoring-exec': 'monitoringExec'
        };
        return pageKeyMap[page] || 'monitoring';
    }

    async renderPage(page, params = {}) {
        const pageKey = this.getPageKey(page);
        
        if (this.pages[pageKey]) {
            return await this.pages[pageKey].render(page, params);
        }
        
        console.warn(`Halaman tidak dikenal: ${page}, redirect ke monitoring`);
        this.state.currentPage = 'monitoring';
        return this.pages.monitoring.render('monitoring');
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
            'otp-create': 'Create OTP - EMS Monokem',
            'otp-history': 'OTP History - EMS Monokem',
            'otp-review': 'Review OTP - EMS Monokem',
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
            'login', 'otp-create', 'otp-history', 'otp-review',
            'monitoring', 'monitoring-all', 'monitoring-exec',
            'temuan-input', 'temuan-daftar', 'temuan-tindak-lanjut',
            'master-kpi', 'master-template', 'iadl-monokem', 'management-review',
            'management-decision', 'reports', 'reports-hse', 'executive-reports',
            'user-management'
        ];
        
        return validPages.includes(page);
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
                    <button class="btn btn-primary mt-md" data-page="monitoring">
                        <i class="bi bi-house"></i> Kembali ke Monitoring
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
            
            const pageKey = this.getPageKey(currentPage);
            if (this.pages[pageKey] && typeof this.pages[pageKey].afterRender === 'function') {
                this.pages[pageKey].afterRender();
            }
            
            requestAnimationFrame(() => {
                mainContent.style.opacity = '1';
                mainContent.style.transform = 'translateY(0)';
            });
        }
        
        this.updateAfterNavigation();
    }
}