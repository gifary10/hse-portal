// pages/dashboard.js
// Dashboard Page - Overview dan Ringkasan Data EMS Monokem
// Menampilkan statistik, chart sederhana, dan quick links

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class DashboardPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.isLoading = false;
        this.isRefreshing = false;
        
        // Data untuk dashboard
        this.otpData = [];
        this.temuanData = [];
        this.mrData = [];
        this.mdData = [];
        this.userData = [];
        
        // Cache timestamp
        this.lastFetchTime = null;
    }

    // ============================================
    // DATA FETCHING
    // ============================================
    
    async fetchFromSheets(action) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'local', data: [], total: 0 };
        }

        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', action);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 detik timeout
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error(`Dashboard fetch ${action} error:`, error);
            return { status: 'error', data: [], total: 0, message: error.message };
        }
    }

    async loadDashboardData() {
        try {
            const [otpResult, temuanResult, mrResult, mdResult] = await Promise.all([
                this.fetchFromSheets('getAllOTP'),
                this.fetchFromSheets('getAllTemuan'),
                this.fetchFromSheets('getAllManagementReview'),
                this.fetchFromSheets('getAllManagementDecision')
            ]);
            
            this.otpData = otpResult.data || [];
            this.temuanData = temuanResult.data || [];
            this.mrData = mrResult.data || [];
            this.mdData = mdResult.data || [];
            this.lastFetchTime = new Date();
            
            console.log('Dashboard data loaded:', {
                otp: this.otpData.length,
                temuan: this.temuanData.length,
                mr: this.mrData.length,
                md: this.mdData.length
            });
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            throw error;
        }
    }

    // ============================================
    // STATISTICS CALCULATIONS
    // ============================================
    
    getOTPStats() {
        const total = this.otpData.length;
        const draft = this.otpData.filter(o => 
            (o.Status || o.status) === 'Draft'
        ).length;
        const submitted = this.otpData.filter(o => 
            (o.Status || o.status) === 'Submitted'
        ).length;
        const approved = this.otpData.filter(o => 
            (o.Status || o.status) === 'Approved'
        ).length;
        const rejected = this.otpData.filter(o => 
            (o.Status || o.status) === 'Rejected'
        ).length;
        const inReview = this.otpData.filter(o => 
            (o.Status || o.status) === 'In Review'
        ).length;
        
        const byDept = {};
        this.otpData.forEach(o => {
            const dept = o.Department || o.department || 'Unknown';
            if (!byDept[dept]) byDept[dept] = { total: 0, approved: 0 };
            byDept[dept].total++;
            if ((o.Status || o.status) === 'Approved') byDept[dept].approved++;
        });
        
        const thisYear = new Date().getFullYear();
        const otpThisYear = this.otpData.filter(o => {
            const year = o.Year || o.year;
            return year && parseInt(year) === thisYear;
        }).length;
        
        return { total, draft, submitted, approved, rejected, inReview, byDept, otpThisYear };
    }
    
    getTemuanStats() {
        const total = this.temuanData.length;
        const open = this.temuanData.filter(t => 
            (t.Status || t.status) === 'Open'
        ).length;
        const inProgress = this.temuanData.filter(t => 
            (t.Status || t.status) === 'In Progress'
        ).length;
        const closed = this.temuanData.filter(t => 
            (t.Status || t.status) === 'Closed'
        ).length;
        const verified = this.temuanData.filter(t => 
            (t.Status || t.status) === 'Verified'
        ).length;
        
        // Temuan overdue (target selesai sudah lewat tapi status masih Open/In Progress)
        const overdue = this.temuanData.filter(t => {
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            const status = t.Status || t.status;
            if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
            return new Date(targetSelesai) < new Date();
        }).length;
        
        const byKategori = {};
        this.temuanData.forEach(t => {
            const kat = t.Kategori_Temuan || t.kategoriTemuan || 'Unknown';
            if (!byKategori[kat]) byKategori[kat] = 0;
            byKategori[kat]++;
        });
        
        return { total, open, inProgress, closed, verified, overdue, byKategori };
    }
    
    getMRStats() {
        const total = this.mrData.length;
        const completed = this.mrData.filter(m => 
            (m.Status || m.status) === 'Completed' || (m.Status || m.status) === 'Approved'
        ).length;
        const draft = this.mrData.filter(m => 
            (m.Status || m.status) === 'Draft'
        ).length;
        
        return { total, completed, draft };
    }
    
    getMDStats() {
        const total = this.mdData.length;
        const active = this.mdData.filter(d => 
            (d.Status || d.status) === 'Active' || (d.Status || d.status) === 'In Progress'
        ).length;
        const completed = this.mdData.filter(d => 
            (d.Status || d.status) === 'Completed' || (d.Status || d.status) === 'Implemented'
        ).length;
        
        // High priority decisions
        const highPriority = this.mdData.filter(d => 
            (d.Priority || d.priority) === 'High' || (d.Priority || d.priority) === 'Tinggi'
        ).length;
        
        return { total, active, completed, highPriority };
    }

    // ============================================
    // QUICK LINKS BASED ON ROLE
    // ============================================
    
    getQuickLinks() {
        const user = this.state.currentUser;
        const role = user?.role || 'department';
        
        const allLinks = {
            department: [
                { label: 'Create OTP', icon: 'bi-pencil-square', page: 'otp-create', color: 'var(--success)' },
                { label: 'OTP History', icon: 'bi-clock-history', page: 'otp-history', color: 'var(--info)' },
                { label: 'Daftar Temuan', icon: 'bi-list-check', page: 'temuan-daftar', color: 'var(--warning)' },
                { label: 'Tindak Lanjut', icon: 'bi-arrow-repeat', page: 'temuan-tindak-lanjut', color: 'var(--danger)' },
                { label: 'IADL', icon: 'bi-file-earmark-text', page: 'iadl-monokem', color: 'var(--primary)' },
                { label: 'Reports', icon: 'bi-file-earmark-bar-graph', page: 'reports', color: '#6366f1' },
            ],
            hse: [
                { label: 'Approval', icon: 'bi-check-circle', page: 'approval-management', color: 'var(--success)' },
                { label: 'Input Temuan', icon: 'bi-plus-circle', page: 'temuan-input', color: 'var(--danger)' },
                { label: 'Daftar Temuan', icon: 'bi-list-check', page: 'temuan-daftar', color: 'var(--warning)' },
                { label: 'Management Review', icon: 'bi-clipboard-data', page: 'management-review', color: 'var(--info)' },
                { label: 'Master Template', icon: 'bi-clipboard', page: 'master-template', color: 'var(--primary)' },
                { label: 'HSE Reports', icon: 'bi-file-earmark-bar-graph', page: 'reports-hse', color: '#6366f1' },
            ],
            top_management: [
                { label: 'Review OTP', icon: 'bi-search', page: 'otp-review', color: 'var(--info)' },
                { label: 'Approval', icon: 'bi-check-circle', page: 'approval-management', color: 'var(--success)' },
                { label: 'Management Review', icon: 'bi-clipboard-data', page: 'management-review', color: 'var(--warning)' },
                { label: 'Management Decision', icon: 'bi-bullseye', page: 'management-decision', color: 'var(--danger)' },
                { label: 'Master KPI', icon: 'bi-bullseye', page: 'master-kpi', color: 'var(--primary)' },
                { label: 'User Management', icon: 'bi-people', page: 'user-management', color: '#6366f1' },
            ]
        };
        
        return allLinks[role] || allLinks['department'];
    }

    // ============================================
    // RECENT ACTIVITIES
    // ============================================
    
    getRecentOTP(limit = 5) {
        return [...this.otpData]
            .filter(o => (o.CreatedAt || o.createdAt || o.created_at || o.Created_Date || o.createdDate))
            .sort((a, b) => {
                const dateA = new Date(a.CreatedAt || a.createdAt || a.created_at || a.Created_Date || a.createdDate || 0);
                const dateB = new Date(b.CreatedAt || b.createdAt || b.created_at || b.Created_Date || b.createdDate || 0);
                return dateB - dateA;
            })
            .slice(0, limit);
    }
    
    getRecentTemuan(limit = 5) {
        return [...this.temuanData]
            .filter(t => (t.Created_At || t.createdAt || t.created_at))
            .sort((a, b) => {
                const dateA = new Date(a.Created_At || a.createdAt || a.created_at || 0);
                const dateB = new Date(b.Created_At || b.createdAt || b.created_at || 0);
                return dateB - dateA;
            })
            .slice(0, limit);
    }

    // ============================================
    // RENDER
    // ============================================
    
    async render() {
        if (!this.isRefreshing) this.showLoading();
        
        try {
            await this.loadDashboardData();
            this.hideLoading();
            return this.renderHTML();
        } catch (error) {
            console.error('Dashboard render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const user = this.state.currentUser || {};
        const otpStats = this.getOTPStats();
        const temuanStats = this.getTemuanStats();
        const mrStats = this.getMRStats();
        const mdStats = this.getMDStats();
        const quickLinks = this.getQuickLinks();
        const recentOTP = this.getRecentOTP();
        const recentTemuan = this.getRecentTemuan();
        
        const greeting = this.getGreeting();
        const today = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">${greeting}, ${this.escapeHtml(user.name || user.username || 'User')}</h1>
                    <p class="breadcrumb">${today}</p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" id="refreshDashboardBtn" data-action="dashboard.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            <!-- Welcome Card -->
            <div class="app-card mb-md" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid var(--success);">
                <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                    <div>
                        <i class="bi bi-speedometer2" style="font-size: 2.5rem; color: var(--primary);"></i>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <h3 style="margin: 0; color: var(--primary-dark);">Dashboard EMS Monokem</h3>
                        <p style="margin: 4px 0 0; color: var(--text-light);">
                            Ringkasan sistem manajemen lingkungan. Data diperbarui: 
                            <strong>${this.lastFetchTime ? this.formatTime(this.lastFetchTime) : 'Memuat...'}</strong>
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge-status success" style="font-size: var(--fs-sm);">
                            <i class="bi bi-database-check"></i> Google Sheets Connected
                        </span>
                    </div>
                </div>
            </div>

            <!-- Stats Cards Row 1 -->
            <div class="row mb-md">
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card stats-card" style="text-align: center; padding: var(--space-md); cursor: pointer;" 
                         data-page="otp-history">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--primary);">
                            <i class="bi bi-clipboard-check"></i> ${otpStats.total}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Total OTP</div>
                        <div style="margin-top: 8px; font-size: var(--fs-xs);">
                            <span style="color: var(--success);">${otpStats.approved} Approved</span> • 
                            <span style="color: var(--warning);">${otpStats.submitted + otpStats.draft} Pending</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card stats-card" style="text-align: center; padding: var(--space-md); cursor: pointer;" 
                         data-page="temuan-daftar">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--danger);">
                            <i class="bi bi-exclamation-triangle"></i> ${temuanStats.open + temuanStats.inProgress}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Temuan Aktif</div>
                        <div style="margin-top: 8px; font-size: var(--fs-xs);">
                            <span style="color: var(--danger);">${temuanStats.open} Open</span> • 
                            <span style="color: var(--warning);">${temuanStats.inProgress} In Progress</span>
                            ${temuanStats.overdue > 0 ? ` • <span style="color: #ef4444; font-weight: 600;">${temuanStats.overdue} Overdue!</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card stats-card" style="text-align: center; padding: var(--space-md); cursor: pointer;" 
                         data-page="management-review">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--info);">
                            <i class="bi bi-clipboard-data"></i> ${mrStats.total}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Management Review</div>
                        <div style="margin-top: 8px; font-size: var(--fs-xs);">
                            <span style="color: var(--success);">${mrStats.completed} Completed</span> • 
                            <span style="color: var(--warning);">${mrStats.draft} Draft</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card stats-card" style="text-align: center; padding: var(--space-md); cursor: pointer;" 
                         data-page="management-decision">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: #6366f1;">
                            <i class="bi bi-bullseye"></i> ${mdStats.total}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Keputusan Manajemen</div>
                        <div style="margin-top: 8px; font-size: var(--fs-xs);">
                            <span style="color: var(--info);">${mdStats.active} Active</span> • 
                            <span style="color: var(--success);">${mdStats.completed} Done</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Progress Bar Section -->
            ${otpStats.total > 0 ? this.renderProgressBars(otpStats, temuanStats) : ''}

            <div class="row">
                <!-- Left Column: Quick Links & Recent Activities -->
                <div class="col-md-8">
                    <!-- Quick Links -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-lightning-charge"></i> Quick Links</h3>
                        </div>
                        <div class="row">
                            ${quickLinks.map(link => `
                                <div class="col-md-4 col-6 mb-sm">
                                    <div class="quick-link-card" data-page="${link.page}" 
                                         style="cursor: pointer; padding: var(--space-md); border-radius: var(--radius-md); 
                                                border: 1px solid var(--border); transition: var(--transition); text-align: center;
                                                background: white;"
                                         onmouseover="this.style.borderColor='${link.color}'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)';"
                                         onmouseout="this.style.borderColor='var(--border)'; this.style.boxShadow='none';">
                                        <i class="bi ${link.icon}" style="font-size: 1.5rem; color: ${link.color}; display: block; margin-bottom: 4px;"></i>
                                        <span style="font-size: var(--fs-sm); font-weight: 500;">${link.label}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Recent OTP -->
                    ${recentOTP.length > 0 ? `
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-clock-history"></i> OTP Terbaru</h3>
                            <button class="btn btn-sm btn-outline-primary" data-page="otp-history">Lihat Semua</button>
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table condensed striped">
                                <thead>
                                    <tr>
                                        <th>OTP ID</th>
                                        <th>Department</th>
                                        <th>Objective</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recentOTP.map(o => this.renderOTPRow(o)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Recent Temuan -->
                    ${recentTemuan.length > 0 ? `
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-exclamation-diamond"></i> Temuan Terbaru</h3>
                            <button class="btn btn-sm btn-outline-primary" data-page="temuan-daftar">Lihat Semua</button>
                        </div>
                        <div class="table-wrapper">
                            <table class="data-table condensed striped">
                                <thead>
                                    <tr>
                                        <th>ID Temuan</th>
                                        <th>Department</th>
                                        <th>Kategori</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${recentTemuan.map(t => this.renderTemuanRow(t)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Right Column: Additional Stats -->
                <div class="col-md-4">
                    <!-- OTP by Department -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-pie-chart"></i> OTP per Department</h3>
                        </div>
                        ${Object.keys(otpStats.byDept).length > 0 ? `
                            <div style="max-height: 250px; overflow-y: auto;">
                                ${Object.entries(otpStats.byDept)
                                    .sort(([, a], [, b]) => b.total - a.total)
                                    .map(([dept, stats]) => `
                                        <div style="padding: 8px 0; border-bottom: 1px solid var(--border-light);">
                                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                                <span style="font-size: var(--fs-sm);">${this.escapeHtml(dept)}</span>
                                                <span style="font-size: var(--fs-xs); color: var(--text-muted);">
                                                    ${stats.approved}/${stats.total}
                                                </span>
                                            </div>
                                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 6px; overflow: hidden;">
                                                <div style="width: ${stats.total > 0 ? (stats.approved / stats.total * 100) : 0}%; 
                                                            background: var(--success); height: 100%; border-radius: var(--radius-pill); 
                                                            transition: width 0.5s ease;">
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                            </div>
                        ` : `
                            <p style="color: var(--text-muted); font-size: var(--fs-sm); text-align: center; padding: var(--space-md);">
                                Belum ada data OTP
                            </p>
                        `}
                    </div>

                    <!-- Temuan by Kategori -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-bar-chart"></i> Kategori Temuan</h3>
                        </div>
                        ${Object.keys(temuanStats.byKategori).length > 0 ? `
                            <div style="max-height: 250px; overflow-y: auto;">
                                ${Object.entries(temuanStats.byKategori)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([kategori, count]) => `
                                        <div style="padding: 8px 0; border-bottom: 1px solid var(--border-light); 
                                                    display: flex; justify-content: space-between; align-items: center;">
                                            <span style="font-size: var(--fs-sm);">${this.escapeHtml(kategori)}</span>
                                            <span class="badge-status ${this.getKategoriBadgeType(kategori)}">${count}</span>
                                        </div>
                                    `).join('')}
                            </div>
                        ` : `
                            <p style="color: var(--text-muted); font-size: var(--fs-sm); text-align: center; padding: var(--space-md);">
                                Belum ada data temuan
                            </p>
                        `}
                    </div>

                    <!-- Alerts Section -->
                    ${temuanStats.overdue > 0 ? `
                    <div class="app-card mb-md" style="background: #fff5f5; border-left: 4px solid var(--danger);">
                        <div class="card-header">
                            <h3 class="card-title" style="color: var(--danger);">
                                <i class="bi bi-exclamation-triangle-fill"></i> Perhatian
                            </h3>
                        </div>
                        <div style="padding: var(--space-sm);">
                            <p style="font-size: var(--fs-sm); color: var(--danger);">
                                <strong>${temuanStats.overdue}</strong> temuan sudah melewati target penyelesaian!
                            </p>
                            <button class="btn btn-sm btn-danger mt-sm w-100" data-page="temuan-daftar">
                                <i class="bi bi-arrow-right"></i> Lihat Temuan
                            </button>
                        </div>
                    </div>
                    ` : ''}

                    ${otpStats.submitted > 0 && (this.state.currentUser?.role === 'hse' || this.state.currentUser?.role === 'top_management') ? `
                    <div class="app-card mb-md" style="background: #eff6ff; border-left: 4px solid var(--info);">
                        <div class="card-header">
                            <h3 class="card-title" style="color: var(--info);">
                                <i class="bi bi-bell"></i> Menunggu Approval
                            </h3>
                        </div>
                        <div style="padding: var(--space-sm);">
                            <p style="font-size: var(--fs-sm); color: var(--text-light);">
                                <strong>${otpStats.submitted}</strong> OTP menunggu approval Anda!
                            </p>
                            <button class="btn btn-sm btn-primary mt-sm w-100" data-page="approval-management">
                                <i class="bi bi-check-circle"></i> Proses Approval
                            </button>
                        </div>
                    </div>
                    ` : ''}

                    <!-- System Info -->
                    <div class="app-card" style="background: #f8fafc;">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-info-circle"></i> System Info</h3>
                        </div>
                        <div style="font-size: var(--fs-sm); color: var(--text-light);">
                            <div class="info-item mb-sm">
                                <label class="info-label">App Version</label>
                                <span class="info-value">${CONFIG.APP.VERSION || '1.0.0'}</span>
                            </div>
                            <div class="info-item mb-sm">
                                <label class="info-label">Data Source</label>
                                <span class="info-value">Google Sheets</span>
                            </div>
                            <div class="info-item mb-sm">
                                <label class="info-label">Last Refresh</label>
                                <span class="info-value">${this.formatTime(this.lastFetchTime)}</span>
                            </div>
                            <div class="info-item mb-sm">
                                <label class="info-label">Your Role</label>
                                <span class="info-value">${this.getRoleLabel(this.state.currentUser?.role)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderProgressBars(otpStats, temuanStats) {
        const approvalRate = otpStats.total > 0 ? 
            Math.round((otpStats.approved / (otpStats.approved + otpStats.rejected || 1)) * 100) : 0;
        
        const temuanResolvedRate = temuanStats.total > 0 ?
            Math.round(((temuanStats.closed + temuanStats.verified) / temuanStats.total) * 100) : 0;
        
        return `
            <div class="row mb-md">
                <div class="col-md-6 mb-sm">
                    <div class="app-card" style="padding: var(--space-md);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: var(--fs-sm); font-weight: 600;">
                                <i class="bi bi-check-circle" style="color: var(--success);"></i> OTP Approval Rate
                            </span>
                            <span style="font-size: var(--fs-lg); font-weight: 700; color: var(--success);">${approvalRate}%</span>
                        </div>
                        <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px; overflow: hidden;">
                            <div style="width: ${approvalRate}%; background: linear-gradient(90deg, var(--success), #16a34a); 
                                        height: 100%; border-radius: var(--radius-pill); transition: width 0.8s ease;">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-sm">
                    <div class="app-card" style="padding: var(--space-md);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: var(--fs-sm); font-weight: 600;">
                                <i class="bi bi-check2-all" style="color: var(--info);"></i> Temuan Resolved
                            </span>
                            <span style="font-size: var(--fs-lg); font-weight: 700; color: var(--info);">${temuanResolvedRate}%</span>
                        </div>
                        <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px; overflow: hidden;">
                            <div style="width: ${temuanResolvedRate}%; background: linear-gradient(90deg, var(--info), #6366f1); 
                                        height: 100%; border-radius: var(--radius-pill); transition: width 0.8s ease;">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderOTPRow(item) {
        const otpId = item.OTP_ID || item.otpId || '-';
        const department = item.Department || item.department || '-';
        const objective = (item.Objective || item.objective || '').substring(0, 60);
        const status = item.Status || item.status || 'Draft';
        const date = item.CreatedAt || item.createdAt || item.created_at || item.Created_Date || item.createdDate || '';
        
        return `
            <tr style="cursor: pointer;" data-action="otpHistory.viewDetail" 
                data-params='${JSON.stringify({otpId: otpId}).replace(/'/g, "&#39;")}'>
                <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(otpId)}</code></td>
                <td><span class="badge-status default">${this.escapeHtml(department)}</span></td>
                <td class="col-wrap">${this.escapeHtml(objective)}${(item.Objective || item.objective || '').length > 60 ? '...' : ''}</td>
                <td>${this.getStatusBadge(status)}</td>
                <td><small>${this.formatDate(date)}</small></td>
            </tr>
        `;
    }

    renderTemuanRow(item) {
        const temuanId = item.Temuan_ID || item.temuanId || item.ID_Temuan || '-';
        const department = item.Department || item.department || '-';
        const kategori = item.Kategori_Temuan || item.kategoriTemuan || '-';
        const status = item.Status || item.status || 'Open';
        const date = item.Created_At || item.createdAt || item.created_at || '';
        
        return `
            <tr style="cursor: pointer;" data-action="temuanDaftar.viewDetail" 
                data-params='${JSON.stringify({temuanId: temuanId}).replace(/'/g, "&#39;")}'>
                <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(temuanId)}</code></td>
                <td><span class="badge-status default">${this.escapeHtml(department)}</span></td>
                <td>${this.getKategoriBadge(kategori)}</td>
                <td>${this.getTemuanStatusBadge(status)}</td>
                <td><small>${this.formatDate(date)}</small></td>
            </tr>
        `;
    }

    // ============================================
    // ACTION METHODS
    // ============================================
    
    async refresh() {
        const refreshBtn = document.getElementById('refreshDashboardBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.otpData = [];
        this.temuanData = [];
        this.mrData = [];
        this.mdData = [];
        
        try {
            await this.loadDashboardData();
            this.isRefreshing = true;
            
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = this.renderHTML();
            }
            
            this.isRefreshing = false;
            toast('Dashboard berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data dashboard', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> <span>Refresh</span>';
            }
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Selamat Pagi';
        if (hour < 15) return 'Selamat Siang';
        if (hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    }
    
    getStatusBadge(status) {
        const badges = {
            'Draft': 'warning',
            'Submitted': 'info',
            'In Review': 'info',
            'Approved': 'success',
            'Rejected': 'danger',
            'Revision Requested': 'warning'
        };
        const label = status || 'Draft';
        const type = badges[label] || 'default';
        return `<span class="badge-status ${type}">${label}</span>`;
    }
    
    getTemuanStatusBadge(status) {
        const badges = {
            'Open': 'danger',
            'In Progress': 'warning',
            'Closed': 'success',
            'Verified': 'info',
            'Draft': 'default'
        };
        const label = status || 'Open';
        const type = badges[label] || 'default';
        return `<span class="badge-status ${type}">${label}</span>`;
    }
    
    getKategoriBadge(value) {
        const badges = {
            'Ketidaksesuaian': 'danger',
            'Observasi': 'warning',
            'OFI': 'info',
            'Positif': 'success'
        };
        return `<span class="badge-status ${badges[value] || 'default'}" style="font-size: var(--fs-xs);">${value || '-'}</span>`;
    }
    
    getKategoriBadgeType(value) {
        const types = {
            'Ketidaksesuaian': 'danger',
            'Observasi': 'warning',
            'OFI': 'info',
            'Positif': 'success'
        };
        return types[value] || 'default';
    }
    
    getRoleLabel(role) {
        const labels = {
            'department': 'Department',
            'hse': 'HSE Manager',
            'top_management': 'Top Management'
        };
        return labels[role] || role || 'Unknown';
    }
    
    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }
    
    formatTime(date) {
        if (!date) return 'Belum diperbarui';
        try {
            return date.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return '-';
        }
    }
    
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#dashboardSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header">
                    <div class="page-header-left">
                        <h1 class="page-title">Dashboard</h1>
                        <p class="breadcrumb">Loading...</p>
                    </div>
                </div>
                <div class="row mb-md">
                    ${Array(4).fill(0).map(() => `
                        <div class="col-md-3 col-6 mb-sm">
                            <div class="app-card" style="text-align: center; padding: var(--space-md);">
                                <div style="height: 2rem; background: #e2e8f0; border-radius: 4px; width: 60%; margin: 0 auto 8px; animation: skeletonPulse 1.5s ease-in-out infinite;"></div>
                                <div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 80%; margin: 0 auto; animation: skeletonPulse 1.5s ease-in-out infinite 0.2s;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="app-card" id="dashboardSkeletonLoader">
                    <div class="card-header">
                        <div style="height: 1.5rem; background: #e2e8f0; border-radius: 4px; width: 200px; animation: skeletonPulse 1.5s ease-in-out infinite;"></div>
                    </div>
                    <div style="padding: var(--space-md);">
                        ${Array(3).fill(0).map(() => `
                            <div style="padding: 12px 0; border-bottom: 1px solid var(--border-light);">
                                <div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 100%; margin-bottom: 8px; animation: skeletonPulse 1.5s ease-in-out infinite;"></div>
                                <div style="height: 0.8rem; background: #e2e8f0; border-radius: 4px; width: 60%; animation: skeletonPulse 1.5s ease-in-out infinite 0.2s;"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    hideLoading() {
        this.isLoading = false;
    }

    renderError(message) {
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Dashboard</h1>
                    <p class="breadcrumb">Error</p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Dashboard</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan saat menghubungi server')}</p>
                    <button class="btn btn-primary mt-md" data-action="dashboard.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}