// pages/monitoring.js
// Progress Monitoring Page - Untuk Department User
// Menampilkan progress OTP dan temuan departemen sendiri
// [UPDATED: Partial Update untuk switch tab]

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class MonitoringPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.isLoading = false;
        this.isRefreshing = false;
        
        // Data
        this.otpData = [];
        this.temuanData = [];
        
        // Filter
        this.selectedYear = new Date().getFullYear().toString();
        this.selectedPeriod = '';
        this.activeTab = 'otp'; // otp | temuan | timeline
        
        // Cache
        this.lastFetchTime = null;
    }

    // ============================================
    // DATA FETCHING
    // ============================================
    
    async fetchFromSheets(action, params = {}) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'local', data: [], total: 0 };
        }

        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', action);
            
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.append(key, typeof value === 'object' ? 
                        JSON.stringify(value) : value.toString());
                }
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                return result;
            }
            
            return result;
            
        } catch (error) {
            console.error(`Monitoring fetch ${action} error:`, error);
            return { status: 'error', data: [], total: 0, message: error.message };
        }
    }

    async loadMonitoringData() {
        const user = this.state.currentUser;
        const userDept = user?.department || '';
        
        try {
            const [otpResult, temuanResult] = await Promise.all([
                this.fetchFromSheets('getOTPByDept', { department: userDept }),
                this.fetchFromSheets('getTemuanByDept', { department: userDept })
            ]);
            
            this.otpData = otpResult.data || [];
            this.temuanData = temuanResult.data || [];
            this.lastFetchTime = new Date();
            
        } catch (error) {
            console.error('Failed to load monitoring data:', error);
            throw error;
        }
    }

    // ============================================
    // CALCULATIONS
    // ============================================
    
    getOTPProgress() {
        let filtered = this.otpData.filter(o => {
            const year = o.Year || o.year;
            return year && year.toString() === this.selectedYear;
        });
        
        if (this.selectedPeriod) {
            filtered = filtered.filter(o => {
                const timeline = o.Timeline || o.timeline || '';
                return timeline === this.selectedPeriod || timeline === 'Full Year';
            });
        }
        
        const total = filtered.length;
        const approved = filtered.filter(o => (o.Status || o.status) === 'Approved').length;
        const submitted = filtered.filter(o => (o.Status || o.status) === 'Submitted').length;
        const inReview = filtered.filter(o => (o.Status || o.status) === 'In Review').length;
        const draft = filtered.filter(o => (o.Status || o.status) === 'Draft').length;
        const rejected = filtered.filter(o => (o.Status || o.status) === 'Rejected').length;
        
        const progressPercent = total > 0 ? Math.round((approved / total) * 100) : 0;
        
        // Group by timeline
        const byTimeline = {};
        filtered.forEach(o => {
            const tl = o.Timeline || o.timeline || 'Unknown';
            if (!byTimeline[tl]) byTimeline[tl] = { total: 0, approved: 0 };
            byTimeline[tl].total++;
            if ((o.Status || o.status) === 'Approved') byTimeline[tl].approved++;
        });
        
        return { total, approved, submitted, inReview, draft, rejected, progressPercent, byTimeline, filtered };
    }
    
    getTemuanProgress() {
        let filtered = this.temuanData.filter(t => {
            if (!this.selectedYear) return true;
            const date = t.Tanggal_Audit || t.tanggalAudit || t.Created_At || t.createdAt;
            if (!date) return false;
            return new Date(date).getFullYear().toString() === this.selectedYear;
        });
        
        const total = filtered.length;
        const open = filtered.filter(t => (t.Status || t.status) === 'Open').length;
        const inProgress = filtered.filter(t => (t.Status || t.status) === 'In Progress').length;
        const closed = filtered.filter(t => (t.Status || t.status) === 'Closed').length;
        const verified = filtered.filter(t => (t.Status || t.status) === 'Verified').length;
        
        const resolvedPercent = total > 0 ? Math.round(((closed + verified) / total) * 100) : 100;
        
        const overdue = filtered.filter(t => {
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            const status = t.Status || t.status;
            if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
            return new Date(targetSelesai) < new Date();
        }).length;
        
        return { total, open, inProgress, closed, verified, resolvedPercent, overdue, filtered };
    }

    getMonthlyProgress() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthlyData = Array(12).fill(0).map(() => ({ otpCreated: 0, otpApproved: 0, temuanFound: 0, temuanResolved: 0 }));
        
        this.otpData.forEach(o => {
            const year = (o.Year || o.year || '').toString();
            if (year !== this.selectedYear) return;
            
            const dateStr = o.Created_Date || o.createdDate || o.CreatedAt || o.createdAt;
            if (!dateStr) return;
            
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;
            
            const month = date.getMonth();
            monthlyData[month].otpCreated++;
            
            if ((o.Status || o.status) === 'Approved') {
                monthlyData[month].otpApproved++;
            }
        });
        
        this.temuanData.forEach(t => {
            const dateStr = t.Tanggal_Audit || t.tanggalAudit || t.Created_At || t.createdAt;
            if (!dateStr) return;
            
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;
            
            if (date.getFullYear().toString() !== this.selectedYear) return;
            
            const month = date.getMonth();
            monthlyData[month].temuanFound++;
            
            if ((t.Status || t.status) === 'Closed' || (t.Status || t.status) === 'Verified') {
                monthlyData[month].temuanResolved++;
            }
        });
        
        return { months, data: monthlyData };
    }

    // ============================================
    // RENDER
    // ============================================
    
    async render() {
        if (!this.isRefreshing) this.showLoading();
        
        try {
            await this.loadMonitoringData();
            this.hideLoading();
            return this.renderHTML();
        } catch (error) {
            console.error('Monitoring render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const user = this.state.currentUser || {};
        const otpProgress = this.getOTPProgress();
        const temuanProgress = this.getTemuanProgress();
        const monthlyData = this.getMonthlyProgress();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Progress Monitoring</h1>
                    <p class="breadcrumb">Home / Monitoring / <span>Progress Monitoring</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" id="refreshMonitoringBtn" data-action="monitoring.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            <!-- Department Info Banner -->
            <div class="app-card mb-md" style="background: #f0fdf4; border-left: 4px solid var(--success);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-building" style="color: var(--success); font-size: 1.5rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">Departemen: ${this.escapeHtml(user.department || 'All')}</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Monitoring progress OTP dan temuan departemen Anda.
                            ${this.lastFetchTime ? `Data diperbarui: ${this.formatTime(this.lastFetchTime)}` : ''}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Filter & Tabs -->
            <div class="filter-section">
                <div class="row">
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="monitoringYearFilter" class="form-select">
                                <option value="2024" ${this.selectedYear === '2024' ? 'selected' : ''}>2024</option>
                                <option value="2025" ${this.selectedYear === '2025' ? 'selected' : ''}>2025</option>
                                <option value="2026" ${this.selectedYear === '2026' ? 'selected' : ''}>2026</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-clock"></i> Periode</label>
                            <select id="monitoringPeriodFilter" class="form-select">
                                <option value="">Semua Periode</option>
                                <option value="Q1" ${this.selectedPeriod === 'Q1' ? 'selected' : ''}>Q1 (Jan-Mar)</option>
                                <option value="Q2" ${this.selectedPeriod === 'Q2' ? 'selected' : ''}>Q2 (Apr-Jun)</option>
                                <option value="Q3" ${this.selectedPeriod === 'Q3' ? 'selected' : ''}>Q3 (Jul-Sep)</option>
                                <option value="Q4" ${this.selectedPeriod === 'Q4' ? 'selected' : ''}>Q4 (Okt-Des)</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group-custom">
                            <label>View</label>
                            <div class="d-flex gap-xs mt-1" id="tabButtons">
                                <button class="btn btn-sm tab-btn ${this.activeTab === 'otp' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="otp">
                                    <i class="bi bi-clipboard-check"></i> OTP Progress
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeTab === 'temuan' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="temuan">
                                    <i class="bi bi-exclamation-triangle"></i> Temuan Progress
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeTab === 'timeline' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="timeline">
                                    <i class="bi bi-graph-up"></i> Timeline
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab Content Container (Partial Update Target) -->
            <div id="monitoringTabContent">
                ${this.renderTabContent(otpProgress, temuanProgress, monthlyData)}
            </div>
        `;
    }

    // Render konten tab berdasarkan activeTab
    renderTabContent(otpProgress, temuanProgress, monthlyData) {
        if (this.activeTab === 'otp') {
            return this.renderOTPTab(otpProgress);
        } else if (this.activeTab === 'temuan') {
            return this.renderTemuanTab(temuanProgress);
        } else if (this.activeTab === 'timeline') {
            return this.renderTimelineTab(monthlyData, otpProgress, temuanProgress);
        }
        return '';
    }

    renderOTPTab(progress) {
        return `
            <!-- Progress Overview Cards -->
            <div class="row mb-md">
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${progress.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${progress.progressPercent}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Completion Rate</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--info);">${progress.submitted + progress.inReview}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Pending Approval</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid ${progress.draft > 0 ? 'var(--warning)' : 'var(--success)'};">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: ${progress.draft > 0 ? 'var(--warning)' : 'var(--success)'};">${progress.draft}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Draft</div>
                    </div>
                </div>
            </div>

            <!-- Overall Progress Bar -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-graph-up"></i> Overall OTP Progress</h3>
                </div>
                <div style="padding: var(--space-md);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: var(--fs-sm); font-weight: 600;">Progress</span>
                        <span style="font-size: var(--fs-lg); font-weight: 700; color: ${progress.progressPercent >= 80 ? 'var(--success)' : progress.progressPercent >= 50 ? 'var(--warning)' : 'var(--danger)'};">${progress.progressPercent}%</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 24px; overflow: hidden; position: relative;">
                        <div style="width: ${progress.progressPercent}%; background: linear-gradient(90deg, var(--success), #16a34a); height: 100%; border-radius: var(--radius-pill); transition: width 0.8s ease; display: flex; align-items: center; justify-content: center;">
                            ${progress.progressPercent >= 15 ? `<span style="color: white; font-size: var(--fs-xs); font-weight: 600;">${progress.approved} Approved</span>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: var(--fs-xs); color: var(--text-light);">
                        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                    </div>
                </div>
            </div>

            <!-- OTP by Status Distribution -->
            <div class="row">
                <div class="col-md-6 mb-sm">
                    <div class="app-card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-pie-chart"></i> Status Distribution</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            ${this.renderStatusBar('Approved', progress.approved, progress.total, 'var(--success)')}
                            ${this.renderStatusBar('Submitted', progress.submitted, progress.total, 'var(--info)')}
                            ${this.renderStatusBar('In Review', progress.inReview, progress.total, 'var(--info)')}
                            ${this.renderStatusBar('Draft', progress.draft, progress.total, 'var(--warning)')}
                            ${this.renderStatusBar('Rejected', progress.rejected, progress.total, 'var(--danger)')}
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-sm">
                    <div class="app-card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-clock"></i> Progress per Periode</h3>
                        </div>
                        <div style="padding: var(--space-md); max-height: 300px; overflow-y: auto;">
                            ${Object.entries(progress.byTimeline).sort().map(([tl, data]) => {
                                const pct = data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0;
                                return `
                                    <div style="margin-bottom: 12px;">
                                        <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                                            <span><strong>${this.escapeHtml(tl)}</strong></span>
                                            <span style="color: ${pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'};">${data.approved}/${data.total} (${pct}%)</span>
                                        </div>
                                        <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                                            <div style="width: ${pct}%; background: ${pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'}; height: 100%; border-radius: var(--radius-pill);"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- OTP List Table -->
            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-list-check"></i> Daftar OTP</h3>
                    <span class="badge-status info">${progress.total} OTP</span>
                </div>
                <div class="table-wrapper">
                    ${progress.total > 0 ? `
                        <table class="data-table striped condensed">
                            <thead>
                                <tr>
                                    <th>OTP ID</th>
                                    <th>Objective</th>
                                    <th>Target</th>
                                    <th>Timeline</th>
                                    <th>Owner</th>
                                    <th>Weight</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${progress.filtered
                                    .sort((a, b) => new Date(b.Created_Date || b.createdDate || b.CreatedAt || b.createdAt || 0) - new Date(a.Created_Date || a.createdDate || a.CreatedAt || a.createdAt || 0))
                                    .slice(0, 20)
                                    .map(o => `
                                        <tr>
                                            <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(o.OTP_ID || o.otpId || '-')}</code></td>
                                            <td class="col-wrap">${this.escapeHtml((o.Objective || o.objective || '').substring(0, 60))}</td>
                                            <td><strong>${this.escapeHtml(o.Target || o.target || '-')}</strong></td>
                                            <td><span class="badge-status info">${this.escapeHtml(o.Timeline || o.timeline || '-')}</span></td>
                                            <td>${this.escapeHtml(o.Owner || o.owner || '-')}</td>
                                            <td class="text-center">${o.Weight || o.weight ? (o.Weight || o.weight) + '%' : '-'}</td>
                                            <td>${this.getOTPStatusBadge(o.Status || o.status)}</td>
                                            <td><small>${this.formatDate(o.Created_Date || o.createdDate || o.CreatedAt || o.createdAt)}</small></td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                    ` : `
                        <div class="empty-state">
                            <i class="bi bi-inbox"></i>
                            <h3>Tidak ada OTP</h3>
                            <p>Belum ada OTP untuk filter yang dipilih</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    renderTemuanTab(progress) {
        return `
            <div class="row mb-md">
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${progress.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Temuan</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${progress.resolvedPercent}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Resolution Rate</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">${progress.open + progress.inProgress}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Unresolved</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid #ef4444; ${progress.overdue > 0 ? 'animation: pulse 2s infinite;' : ''}">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: #ef4444;">${progress.overdue}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Overdue</div>
                    </div>
                </div>
            </div>

            <!-- Resolution Progress Bar -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-check2-circle"></i> Resolution Progress</h3>
                </div>
                <div style="padding: var(--space-md);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: var(--fs-sm); font-weight: 600;">Resolved</span>
                        <span style="font-size: var(--fs-lg); font-weight: 700; color: ${progress.resolvedPercent >= 80 ? 'var(--success)' : progress.resolvedPercent >= 50 ? 'var(--warning)' : 'var(--danger)'};">${progress.resolvedPercent}% (${progress.closed + progress.verified}/${progress.total})</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 24px; overflow: hidden; position: relative;">
                        <div style="width: ${progress.resolvedPercent}%; background: linear-gradient(90deg, var(--success), #16a34a); height: 100%; border-radius: var(--radius-pill); transition: width 0.8s ease;"></div>
                    </div>
                </div>
            </div>

            <!-- Temuan Status Distribution -->
            <div class="row">
                <div class="col-md-6 mb-sm">
                    <div class="app-card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-pie-chart"></i> Status Distribution</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            ${this.renderStatusBar('Open', progress.open, progress.total, 'var(--danger)')}
                            ${this.renderStatusBar('In Progress', progress.inProgress, progress.total, 'var(--warning)')}
                            ${this.renderStatusBar('Closed', progress.closed, progress.total, 'var(--success)')}
                            ${this.renderStatusBar('Verified', progress.verified, progress.total, 'var(--info)')}
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-sm">
                    ${progress.overdue > 0 ? `
                    <div class="app-card" style="background: #fff5f5; border-left: 4px solid var(--danger);">
                        <div class="card-header">
                            <h3 class="card-title" style="color: var(--danger);">
                                <i class="bi bi-exclamation-triangle-fill"></i> Temuan Overdue
                            </h3>
                        </div>
                        <div style="padding: var(--space-md); max-height: 300px; overflow-y: auto;">
                            ${progress.filtered
                                .filter(t => {
                                    const targetSelesai = t.Target_Selesai || t.targetSelesai;
                                    const status = t.Status || t.status;
                                    if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
                                    return new Date(targetSelesai) < new Date();
                                })
                                .slice(0, 10)
                                .map(t => `
                                    <div style="padding: 8px 0; border-bottom: 1px solid #fee2e2;">
                                        <div style="font-size: var(--fs-sm); font-weight: 600; color: var(--danger);">
                                            ${this.escapeHtml(t.Temuan_ID || t.temuanId || '-')}
                                        </div>
                                        <div style="font-size: var(--fs-xs); color: var(--text-light);">
                                            ${this.escapeHtml((t.Uraian_Temuan || t.uraianTemuan || '').substring(0, 80))}
                                        </div>
                                        <div style="font-size: var(--fs-xs); color: var(--text-muted);">
                                            Target: ${this.formatDate(t.Target_Selesai || t.targetSelesai)} | 
                                            PIC: ${this.escapeHtml(t.Penanggung_Jawab || t.penanggungJawab || '-')}
                                        </div>
                                    </div>
                                `).join('')}
                        </div>
                    </div>
                    ` : `
                    <div class="app-card" style="background: #f0fdf4;">
                        <div class="card-header">
                            <h3 class="card-title" style="color: var(--success);">
                                <i class="bi bi-check-circle"></i> Good Job!
                            </h3>
                        </div>
                        <div style="text-align: center; padding: var(--space-xl);">
                            <i class="bi bi-emoji-smile" style="font-size: 3rem; color: var(--success);"></i>
                            <p class="mt-md" style="color: var(--text-light);">Tidak ada temuan yang overdue!</p>
                        </div>
                    </div>
                    `}
                </div>
            </div>

            <!-- Temuan List -->
            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-list-check"></i> Daftar Temuan</h3>
                    <span class="badge-status info">${progress.total} Temuan</span>
                </div>
                <div class="table-wrapper">
                    ${progress.total > 0 ? `
                        <table class="data-table striped condensed">
                            <thead>
                                <tr>
                                    <th>ID Temuan</th>
                                    <th>Kategori</th>
                                    <th>Klasifikasi</th>
                                    <th>Uraian</th>
                                    <th>Target Selesai</th>
                                    <th>PIC</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${progress.filtered
                                    .sort((a, b) => new Date(b.Created_At || b.createdAt || 0) - new Date(a.Created_At || a.createdAt || 0))
                                    .slice(0, 20)
                                    .map(t => `
                                        <tr>
                                            <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(t.Temuan_ID || t.temuanId || '-')}</code></td>
                                            <td>${this.getKategoriBadge(t.Kategori_Temuan || t.kategoriTemuan)}</td>
                                            <td>${this.getKlasifikasiBadge(t.Klasifikasi || t.klasifikasi)}</td>
                                            <td class="col-wrap">${this.escapeHtml((t.Uraian_Temuan || t.uraianTemuan || '').substring(0, 60))}</td>
                                            <td>${this.formatDate(t.Target_Selesai || t.targetSelesai)}</td>
                                            <td>${this.escapeHtml(t.Penanggung_Jawab || t.penanggungJawab || '-')}</td>
                                            <td>${this.getTemuanStatusBadge(t.Status || t.status)}</td>
                                        </tr>
                                    `).join('')}
                            </tbody>
                        </table>
                    ` : `
                        <div class="empty-state">
                            <i class="bi bi-inbox"></i>
                            <h3>Tidak ada temuan</h3>
                            <p>Belum ada temuan untuk filter yang dipilih</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    renderTimelineTab(monthlyData, otpProgress, temuanProgress) {
        const maxOTP = Math.max(...monthlyData.data.map(d => d.otpCreated), 1);
        const maxTemuan = Math.max(...monthlyData.data.map(d => d.temuanFound), 1);
        
        return `
            <!-- Summary Cards -->
            <div class="row mb-md">
                <div class="col-md-4 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${otpProgress.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP ${this.selectedYear}</div>
                    </div>
                </div>
                <div class="col-md-4 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${otpProgress.approved}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">OTP Approved</div>
                    </div>
                </div>
                <div class="col-md-4 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">${temuanProgress.closed + temuanProgress.verified}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Temuan Resolved</div>
                    </div>
                </div>
            </div>

            <!-- Monthly Chart -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-graph-up"></i> Monthly Progress (${this.selectedYear})</h3>
                </div>
                <div style="padding: var(--space-md);">
                    <div style="display: flex; align-items: flex-end; gap: 6px; height: 250px; padding: 0 8px;">
                        ${monthlyData.months.map((month, i) => {
                            const otpHeight = (monthlyData.data[i].otpCreated / maxOTP) * 100;
                            const temuanHeight = (monthlyData.data[i].temuanFound / maxTemuan) * 100;
                            
                            return `
                                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                                    <div style="flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 3px;">
                                        <div style="width: 35%; height: ${otpHeight}%; background: linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%); 
                                                    border-radius: 4px 4px 0 0; position: relative; min-height: 2px;"
                                             title="OTP Created: ${monthlyData.data[i].otpCreated}, Approved: ${monthlyData.data[i].otpApproved}">
                                        </div>
                                        <div style="width: 35%; height: ${temuanHeight}%; background: linear-gradient(180deg, #f87171 0%, var(--danger) 100%); 
                                                    border-radius: 4px 4px 0 0; position: relative; min-height: 2px;"
                                             title="Temuan Found: ${monthlyData.data[i].temuanFound}, Resolved: ${monthlyData.data[i].temuanResolved}">
                                        </div>
                                    </div>
                                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; white-space: nowrap;">
                                        ${month}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="display: flex; gap: 16px; justify-content: center; margin-top: 16px; font-size: var(--fs-xs);">
                        <span><span style="display: inline-block; width: 12px; height: 12px; background: var(--primary); border-radius: 2px; vertical-align: middle; margin-right: 4px;"></span> OTP Created</span>
                        <span><span style="display: inline-block; width: 12px; height: 12px; background: var(--danger); border-radius: 2px; vertical-align: middle; margin-right: 4px;"></span> Temuan Found</span>
                    </div>
                </div>
            </div>

            <!-- Monthly Detail Table -->
            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-table"></i> Monthly Detail</h3>
                </div>
                <div class="table-wrapper">
                    <table class="data-table striped">
                        <thead>
                            <tr>
                                <th>Bulan</th>
                                <th class="text-center">OTP Created</th>
                                <th class="text-center">OTP Approved</th>
                                <th class="text-center">Approval Rate</th>
                                <th class="text-center">Temuan Found</th>
                                <th class="text-center">Temuan Resolved</th>
                                <th class="text-center">Resolution Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${monthlyData.months.map((month, i) => {
                                const approvalRate = monthlyData.data[i].otpCreated > 0 ? 
                                    Math.round((monthlyData.data[i].otpApproved / monthlyData.data[i].otpCreated) * 100) : 0;
                                const resolutionRate = monthlyData.data[i].temuanFound > 0 ? 
                                    Math.round((monthlyData.data[i].temuanResolved / monthlyData.data[i].temuanFound) * 100) : 100;
                                
                                const hasData = monthlyData.data[i].otpCreated > 0 || monthlyData.data[i].temuanFound > 0;
                                
                                return `
                                    <tr style="${!hasData ? 'opacity: 0.4;' : ''}">
                                        <td><strong>${month}</strong></td>
                                        <td class="text-center">${monthlyData.data[i].otpCreated || '-'}</td>
                                        <td class="text-center" style="color: var(--success);">${monthlyData.data[i].otpApproved || '-'}</td>
                                        <td class="text-center">
                                            ${monthlyData.data[i].otpCreated > 0 ? `
                                                <span class="badge-status ${approvalRate >= 80 ? 'success' : approvalRate >= 50 ? 'warning' : 'danger'}">${approvalRate}%</span>
                                            ` : '-'}
                                        </td>
                                        <td class="text-center">${monthlyData.data[i].temuanFound || '-'}</td>
                                        <td class="text-center" style="color: var(--success);">${monthlyData.data[i].temuanResolved || '-'}</td>
                                        <td class="text-center">
                                            ${monthlyData.data[i].temuanFound > 0 ? `
                                                <span class="badge-status ${resolutionRate >= 80 ? 'success' : resolutionRate >= 50 ? 'warning' : 'danger'}">${resolutionRate}%</span>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ============================================
    // ACTION METHODS (DIPERBAIKI - Partial Update)
    // ============================================
    
    async switchTab(params) {
        this.activeTab = params.tab || 'otp';
        
        // Update tab button visuals
        const tabButtons = document.querySelectorAll('#tabButtons .tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-primary');
        });
        const activeBtn = document.querySelector(`#tabButtons .tab-btn[data-tab="${this.activeTab}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('btn-outline-primary');
            activeBtn.classList.add('btn-primary');
        }
        
        // Update hanya konten tab dengan animasi fade
        await this.updateTabContentOnly();
    }

    async updateTabContentOnly() {
        const tabContainer = document.getElementById('monitoringTabContent');
        if (!tabContainer) return;
        
        // Animasi fade out
        tabContainer.style.opacity = '0';
        tabContainer.style.transform = 'translateY(8px)';
        tabContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Render konten tab baru
        const otpProgress = this.getOTPProgress();
        const temuanProgress = this.getTemuanProgress();
        const monthlyData = this.getMonthlyProgress();
        
        tabContainer.innerHTML = this.renderTabContent(otpProgress, temuanProgress, monthlyData);
        
        // Animasi fade in
        requestAnimationFrame(() => {
            tabContainer.style.opacity = '1';
            tabContainer.style.transform = 'translateY(0)';
        });
        
        // Re-attach event listeners untuk tab buttons
        this.attachTabButtonEvents();
    }

    async filterYear() {
        const el = document.getElementById('monitoringYearFilter');
        if (el) this.selectedYear = el.value;
        await this.updateTabContentOnly();
    }

    async filterPeriod() {
        const el = document.getElementById('monitoringPeriodFilter');
        if (el) this.selectedPeriod = el.value;
        await this.updateTabContentOnly();
    }

    async refresh() {
        const refreshBtn = document.getElementById('refreshMonitoringBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.otpData = [];
        this.temuanData = [];
        
        try {
            await this.loadMonitoringData();
            this.isRefreshing = true;
            
            // Full re-render untuk refresh
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = this.renderHTML();
                this.afterRender();
            }
            
            this.isRefreshing = false;
            toast('Data monitoring berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> <span>Refresh</span>';
            }
        }
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================
    
    afterRender() {
        this.attachFilterEvents();
        this.attachTabButtonEvents();
    }

    attachFilterEvents() {
        const yearFilter = document.getElementById('monitoringYearFilter');
        if (yearFilter) {
            const newYearFilter = yearFilter.cloneNode(true);
            yearFilter.parentNode.replaceChild(newYearFilter, yearFilter);
            newYearFilter.addEventListener('change', () => this.filterYear());
        }
        
        const periodFilter = document.getElementById('monitoringPeriodFilter');
        if (periodFilter) {
            const newPeriodFilter = periodFilter.cloneNode(true);
            periodFilter.parentNode.replaceChild(newPeriodFilter, periodFilter);
            newPeriodFilter.addEventListener('change', () => this.filterPeriod());
        }
    }

    attachTabButtonEvents() {
        const tabButtons = document.querySelectorAll('#tabButtons .tab-btn');
        tabButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', () => {
                const tab = newBtn.dataset.tab;
                if (tab && tab !== this.activeTab) {
                    this.switchTab({ tab });
                }
            });
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    renderStatusBar(label, value, total, color) {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                    <span>${label}</span>
                    <span style="font-weight: 600; color: ${color};">${value} (${pct}%)</span>
                </div>
                <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                    <div style="width: ${pct}%; background: ${color}; height: 100%; border-radius: var(--radius-pill); transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }

    getOTPStatusBadge(status) {
        const badges = {
            'Draft': 'warning', 'Submitted': 'info', 'In Review': 'info',
            'Approved': 'success', 'Rejected': 'danger', 'Revision Requested': 'warning'
        };
        const label = status || 'Draft';
        const type = badges[label] || 'default';
        return `<span class="badge-status ${type}">${label}</span>`;
    }

    getTemuanStatusBadge(status) {
        const badges = {
            'Open': 'danger', 'In Progress': 'warning', 'Closed': 'success', 'Verified': 'info', 'Draft': 'default'
        };
        const label = status || 'Open';
        const type = badges[label] || 'default';
        return `<span class="badge-status ${type}">${label}</span>`;
    }

    getKategoriBadge(value) {
        const badges = { 'Ketidaksesuaian': 'danger', 'Observasi': 'warning', 'OFI': 'info', 'Positif': 'success' };
        return `<span class="badge-status ${badges[value] || 'default'}" style="font-size: var(--fs-xs);">${value || '-'}</span>`;
    }

    getKlasifikasiBadge(value) {
        const badges = { 'Mayor': 'danger', 'Minor': 'warning', 'Observation': 'info' };
        return `<span class="badge-status ${badges[value] || 'default'}" style="font-size: var(--fs-xs);">${value || '-'}</span>`;
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) { return dateString; }
    }

    formatTime(date) {
        if (!date) return 'Belum diperbarui';
        try { return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); } 
        catch (e) { return '-'; }
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
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="page-header">
                    <div class="page-header-left">
                        <h1 class="page-title">Progress Monitoring</h1>
                        <p class="breadcrumb">Home / Monitoring / <span>Progress Monitoring</span></p>
                    </div>
                </div>
                <div class="app-card">
                    <div class="empty-state">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <h3 class="mt-md">Memuat Data Monitoring...</h3>
                    </div>
                </div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Progress Monitoring</h1>
                    <p class="breadcrumb">Home / Monitoring / <span>Progress Monitoring</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Data</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                    <button class="btn btn-primary mt-md" data-action="monitoring.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}