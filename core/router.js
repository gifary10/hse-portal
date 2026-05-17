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
import { closeModal } from '../ui/components.js';

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
        if (hasUser) this.navigateToDefaultPage();
        else this.navigateTo('login');
    }

    navigateToDefaultPage() {
        const user = this.state.currentUser;
        const role = user?.role || 'department';
        if (role === 'top_management') this.navigateTo('monitoring-exec');
        else if (role === 'hse') this.navigateTo('monitoring-all');
        else this.navigateTo('monitoring');
    }

    async isModalOpen() {
        const modalElement = document.getElementById('mainModal');
        if (modalElement && modalElement.classList.contains('show')) return true;
        return document.querySelector('.modal-backdrop') !== null;
    }

    async ensureModalsClosed() {
        const modalElement = document.getElementById('mainModal');
        if (modalElement && modalElement.classList.contains('show')) {
            await closeModal();
            await this.delay(150);
        }
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => {
            if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        });
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    async navigateTo(page, params = {}) {
        if (this.navigating) return;
        this.navigating = true;

        if (!this.state.currentUser && page !== 'login') {
            this.navigating = false;
            this.navigateTo('login');
            return;
        }
        if (this.state.currentUser && page === 'login') {
            this.navigating = false;
            this.navigateToDefaultPage();
            return;
        }

        const mainContent = document.getElementById('mainContent');
        if (!mainContent) {
            console.error('Element #mainContent tidak ditemukan');
            this.navigating = false;
            return;
        }

        await this.ensureModalsClosed();

        // --- PERUBAHAN UTAMA: Tampilkan skeleton langsung, tanpa fade-out/delay ---
        this.renderSkeleton(mainContent, page);

        try {
            this.state.currentPage = page;
            const content = await this.renderPage(page, params);
            mainContent.innerHTML = content;

            const pageKey = this.getPageKey(page);
            if (this.pages[pageKey] && typeof this.pages[pageKey].afterRender === 'function') {
                this.pages[pageKey].afterRender();
            }

            this.updateAfterNavigation();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.updateDocumentTitle(page);
        } catch (error) {
            console.error('Navigation error:', error);
            mainContent.innerHTML = this.renderErrorState('Error Navigasi', error.message);
        } finally {
            this.navigating = false;
        }
    }

    // Skeleton loader generik (bisa dikustomisasi per halaman nantinya)
    renderSkeleton(container, page) {
        const pageTitle = this.getPageTitle(page);
        container.innerHTML = `
            <div class="page-header skeleton-header">
                <div class="page-header-left">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-breadcrumb"></div>
                </div>
            </div>
            <div class="app-card skeleton-card">
                <div class="card-header">
                    <div class="skeleton-card-title"></div>
                </div>
                <div class="skeleton-table">
                    ${Array(5).fill(0).map(() => '<div class="skeleton-row"></div>').join('')}
                </div>
            </div>
        `;

        // Tambahkan style skeleton jika belum ada
        if (!document.getElementById('skeleton-styles')) {
            const style = document.createElement('style');
            style.id = 'skeleton-styles';
            style.textContent = `
                .skeleton-header { background: var(--card); border-radius: var(--radius-xl); margin-bottom: var(--space-md); padding: var(--space-md); }
                .skeleton-title { width: 40%; height: 28px; background: linear-gradient(90deg, #e2e8f0 25%, #f0f4f8 50%, #e2e8f0 75%); background-size: 200% 100%; animation: skeleton-loading 1.5s infinite; border-radius: var(--radius-md); margin-bottom: 8px; }
                .skeleton-breadcrumb { width: 25%; height: 14px; background: linear-gradient(90deg, #e2e8f0 25%, #f0f4f8 50%, #e2e8f0 75%); background-size: 200% 100%; animation: skeleton-loading 1.5s infinite; border-radius: var(--radius-sm); }
                .skeleton-card { background: var(--card); border-radius: var(--radius-xl); padding: var(--space-md); }
                .skeleton-card-title { width: 30%; height: 20px; background: linear-gradient(90deg, #e2e8f0 25%, #f0f4f8 50%, #e2e8f0 75%); background-size: 200% 100%; animation: skeleton-loading 1.5s infinite; border-radius: var(--radius-sm); margin-bottom: var(--space-md); }
                .skeleton-table { margin-top: var(--space-md); }
                .skeleton-row { height: 40px; background: linear-gradient(90deg, #e2e8f0 25%, #f0f4f8 50%, #e2e8f0 75%); background-size: 200% 100%; animation: skeleton-loading 1.5s infinite; margin-bottom: 8px; border-radius: var(--radius-sm); }
                @keyframes skeleton-loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
            `;
            document.head.appendChild(style);
        }
    }

    getPageTitle(page) {
        const titles = {
            'login': 'Login',
            'monitoring': 'Progress Monitoring',
            'monitoring-all': 'All Monitoring',
            'monitoring-exec': 'Monitoring Overview',
            'otp-create': 'Create OTP',
            'otp-history': 'OTP History',
            'otp-review': 'Review OTP',
            'temuan-input': 'Input Temuan',
            'temuan-daftar': 'Daftar Temuan',
            'temuan-tindak-lanjut': 'Tindak Lanjut Temuan',
            'master-kpi': 'Master KPI',
            'master-template': 'Objective Template',
            'iadl-monokem': 'IADL Monokem',
            'management-review': 'Management Review',
            'management-decision': 'Management Decision',
            'reports': 'Reports',
            'reports-hse': 'HSE Reports',
            'executive-reports': 'Executive Reports',
            'user-management': 'User Management'
        };
        return titles[page] || page;
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

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}