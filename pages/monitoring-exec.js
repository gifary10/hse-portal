// pages/monitoring-exec.js
// Monitoring Overview Page - Untuk Top Management
// High-level monitoring dashboard dengan KPI, tren, dan compliance overview
// [UPDATED: Partial Update untuk switch tab]

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class MonitoringExecPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.isLoading = false;
        this.isRefreshing = false;
        
        // Data
        this.otpData = [];
        this.temuanData = [];
        this.mrData = [];
        this.mdData = [];
        
        // Filter
        this.selectedYear = new Date().getFullYear().toString();
        this.activeView = 'dashboard'; // dashboard | strategic | risk
        
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
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            
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
            console.error(`Exec Monitoring fetch ${action} error:`, error);
            return { status: 'error', data: [], total: 0, message: error.message };
        }
    }

    async loadAllData() {
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
            
        } catch (error) {
            console.error('Failed to load exec monitoring data:', error);
            throw error;
        }
    }

    // ============================================
    // CALCULATIONS
    // ============================================
    
    getExecutiveSummary() {
        // OTP
        const totalOTP = this.otpData.length;
        const approvedOTP = this.otpData.filter(o => (o.Status || o.status) === 'Approved').length;
        const rejectedOTP = this.otpData.filter(o => (o.Status || o.status) === 'Rejected').length;
        const pendingOTP = this.otpData.filter(o => 
            (o.Status || o.status) === 'Submitted' || (o.Status || o.status) === 'In Review'
        ).length;
        const draftOTP = this.otpData.filter(o => (o.Status || o.status) === 'Draft').length;
        
        const approvalRate = totalOTP > 0 ? 
            Math.round((approvedOTP / (approvedOTP + rejectedOTP || 1)) * 100) : 0;
        
        // Temuan
        const totalTemuan = this.temuanData.length;
        const openTemuan = this.temuanData.filter(t => (t.Status || t.status) === 'Open').length;
        const inProgressTemuan = this.temuanData.filter(t => (t.Status || t.status) === 'In Progress').length;
        const closedTemuan = this.temuanData.filter(t => (t.Status || t.status) === 'Closed').length;
        const verifiedTemuan = this.temuanData.filter(t => (t.Status || t.status) === 'Verified').length;
        
        const resolutionRate = totalTemuan > 0 ? 
            Math.round(((closedTemuan + verifiedTemuan) / totalTemuan) * 100) : 100;
        
        const overdueTemuan = this.temuanData.filter(t => {
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            const status = t.Status || t.status;
            if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
            return new Date(targetSelesai) < new Date();
        }).length;
        
        // Management Review
        const totalMR = this.mrData.length;
        const completedMR = this.mrData.filter(m => 
            (m.Status || m.status) === 'Completed' || (m.Status || m.status) === 'Approved'
        ).length;
        
        // Management Decision
        const totalMD = this.mdData.length;
        const activeMD = this.mdData.filter(d => 
            (d.Status || d.status) === 'Active' || (d.Status || d.status) === 'In Progress'
        ).length;
        const completedMD = this.mdData.filter(d => 
            (d.Status || d.status) === 'Completed' || (d.Status || d.status) === 'Implemented'
        ).length;
        const highPriorityMD = this.mdData.filter(d => 
            (d.Priority || d.priority) === 'High' || (d.Priority || d.priority) === 'Tinggi'
        ).length;
        
        // Department Performance
        const deptPerformance = {};
        this.otpData.forEach(o => {
            const dept = o.Department || o.department || 'Unknown';
            if (!deptPerformance[dept]) deptPerformance[dept] = { 
                otp: 0, approved: 0, rejected: 0, 
                temuan: 0, openTemuan: 0, resolvedTemuan: 0, overdueTemuan: 0 
            };
            deptPerformance[dept].otp++;
            if ((o.Status || o.status) === 'Approved') deptPerformance[dept].approved++;
            if ((o.Status || o.status) === 'Rejected') deptPerformance[dept].rejected++;
        });
        
        this.temuanData.forEach(t => {
            const dept = t.Department || t.department || 'Unknown';
            if (!deptPerformance[dept]) deptPerformance[dept] = { 
                otp: 0, approved: 0, rejected: 0, 
                temuan: 0, openTemuan: 0, resolvedTemuan: 0, overdueTemuan: 0 
            };
            deptPerformance[dept].temuan++;
            const status = t.Status || t.status;
            if (status === 'Open' || status === 'In Progress') deptPerformance[dept].openTemuan++;
            if (status === 'Closed' || status === 'Verified') deptPerformance[dept].resolvedTemuan++;
            
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            if (targetSelesai && status !== 'Closed' && status !== 'Verified' && new Date(targetSelesai) < new Date()) {
                deptPerformance[dept].overdueTemuan++;
            }
        });
        
        // Quarterly Trend
        const quarterlyTrend = this.getQuarterlyTrend();
        
        // Risk Summary
        const riskSummary = this.getRiskSummary();
        
        return {
            totalOTP, approvedOTP, rejectedOTP, pendingOTP, draftOTP, approvalRate,
            totalTemuan, openTemuan, inProgressTemuan, closedTemuan, verifiedTemuan, 
            resolutionRate, overdueTemuan,
            totalMR, completedMR, totalMD, activeMD, completedMD, highPriorityMD,
            deptPerformance, quarterlyTrend, riskSummary
        };
    }

    getQuarterlyTrend() {
        const year = parseInt(this.selectedYear);
        const quarters = [
            { label: 'Q1', start: new Date(year, 0, 1), end: new Date(year, 2, 31) },
            { label: 'Q2', start: new Date(year, 3, 1), end: new Date(year, 5, 30) },
            { label: 'Q3', start: new Date(year, 6, 1), end: new Date(year, 8, 30) },
            { label: 'Q4', start: new Date(year, 9, 1), end: new Date(year, 11, 31) }
        ];
        
        return quarters.map(q => {
            const otpCreated = this.otpData.filter(o => {
                const date = new Date(o.Created_Date || o.createdDate || o.CreatedAt || o.createdAt);
                return date >= q.start && date <= q.end;
            }).length;
            
            const otpApproved = this.otpData.filter(o => {
                const date = new Date(o.Reviewed_Date || o.reviewedDate || o.reviewed_date);
                return date >= q.start && date <= q.end && (o.Status || o.status) === 'Approved';
            }).length;
            
            const temuanFound = this.temuanData.filter(t => {
                const date = new Date(t.Tanggal_Audit || t.tanggalAudit || t.Created_At || t.createdAt);
                return date >= q.start && date <= q.end;
            }).length;
            
            const temuanResolved = this.temuanData.filter(t => {
                const date = new Date(t.Tgl_Selesai || t.tglSelesai || t.Tgl_Verifikasi || t.tglVerifikasi);
                return date >= q.start && date <= q.end && 
                    ((t.Status || t.status) === 'Closed' || (t.Status || t.status) === 'Verified');
            }).length;
            
            return { label: q.label, otpCreated, otpApproved, temuanFound, temuanResolved };
        });
    }

    getRiskSummary() {
        const highRiskTemuan = this.temuanData.filter(t => {
            const klasifikasi = t.Klasifikasi || t.klasifikasi || '';
            const kategori = t.Kategori_Temuan || t.kategoriTemuan || '';
            const status = t.Status || t.status;
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            
            const isMayor = klasifikasi === 'Mayor';
            const isNonConformance = kategori === 'Ketidaksesuaian';
            const isOverdue = targetSelesai && new Date(targetSelesai) < new Date() && 
                             status !== 'Closed' && status !== 'Verified';
            
            return isMayor || isNonConformance || isOverdue;
        }).length;
        
        const mediumRiskTemuan = this.temuanData.filter(t => {
            const klasifikasi = t.Klasifikasi || t.klasifikasi || '';
            const status = t.Status || t.status;
            return klasifikasi === 'Minor' && (status === 'Open' || status === 'In Progress');
        }).length;
        
        const deptRisk = {};
        this.temuanData.forEach(t => {
            const dept = t.Department || t.department || 'Unknown';
            const status = t.Status || t.status;
            if (status === 'Open' || status === 'In Progress') {
                deptRisk[dept] = (deptRisk[dept] || 0) + 1;
            }
        });
        
        const topRiskDepts = Object.entries(deptRisk)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
        
        return { highRiskTemuan, mediumRiskTemuan, topRiskDepts };
    }

    getEMSHealthScore() {
        const summary = this.getExecutiveSummary();
        let score = 0;
        
        score += (summary.approvalRate / 100) * 35;
        score += (summary.resolutionRate / 100) * 30;
        
        const overdueRatio = summary.totalTemuan > 0 ? summary.overdueTemuan / summary.totalTemuan : 0;
        score += (1 - overdueRatio) * 20;
        
        const mrRatio = summary.totalMR > 0 ? summary.completedMR / summary.totalMR : 0;
        score += mrRatio * 15;
        
        return Math.round(score);
    }

    // ============================================
    // RENDER
    // ============================================
    
    async render() {
        if (!this.isRefreshing) this.showLoading();
        
        try {
            await this.loadAllData();
            this.hideLoading();
            return this.renderHTML();
        } catch (error) {
            console.error('Exec Monitoring render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const summary = this.getExecutiveSummary();
        const healthScore = this.getEMSHealthScore();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Monitoring Overview</h1>
                    <p class="breadcrumb">Home / Monitoring / <span>Monitoring Overview</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" id="refreshExecMonBtn" data-action="monitoringExec.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            <!-- EMS Health Score Banner -->
            <div class="app-card mb-md" style="background: linear-gradient(135deg, #1a3a4a 0%, #0f2b38 100%); color: white;">
                <div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap;">
                    <div style="text-align: center; min-width: 100px;">
                        <div style="font-size: var(--fs-3xl); font-weight: 800; color: ${this.getHealthColor(healthScore)};">
                            ${healthScore}/100
                        </div>
                        <div style="font-size: var(--fs-xs); color: rgba(255,255,255,0.7);">EMS Health Score</div>
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: var(--fs-xs);">
                            <span>Critical</span><span>Warning</span><span>Good</span><span>Excellent</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); border-radius: var(--radius-pill); height: 14px; position: relative; overflow: hidden;">
                            <div style="width: ${healthScore}%; background: ${this.getHealthColor(healthScore)}; height: 100%; border-radius: var(--radius-pill); transition: width 0.8s ease;"></div>
                            <div style="position: absolute; top: -3px; left: ${healthScore}%; width: 20px; height: 20px; background: white; border-radius: 50%; transform: translateX(-50%); border: 3px solid ${this.getHealthColor(healthScore)};"></div>
                        </div>
                    </div>
                    <div>
                        <span style="font-size: var(--fs-sm); color: rgba(255,255,255,0.7);">
                            Status: <strong style="color: ${this.getHealthColor(healthScore)};">${this.getHealthLabel(healthScore)}</strong>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Filter & View -->
            <div class="filter-section">
                <div class="row">
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="execMonYearFilter" class="form-select">
                                <option value="2024" ${this.selectedYear === '2024' ? 'selected' : ''}>2024</option>
                                <option value="2025" ${this.selectedYear === '2025' ? 'selected' : ''}>2025</option>
                                <option value="2026" ${this.selectedYear === '2026' ? 'selected' : ''}>2026</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-9">
                        <div class="form-group-custom">
                            <label>View</label>
                            <div class="d-flex gap-xs mt-1" id="execTabButtons">
                                <button class="btn btn-sm tab-btn ${this.activeView === 'dashboard' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="dashboard">
                                    <i class="bi bi-speedometer2"></i> Dashboard
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeView === 'strategic' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="strategic">
                                    <i class="bi bi-graph-up"></i> Strategic KPIs
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeView === 'risk' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="risk">
                                    <i class="bi bi-shield-exclamation"></i> Risk Assessment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab Content Container -->
            <div id="execMonitoringTabContent">
                ${this.renderTabContent(summary)}
            </div>
        `;
    }

    renderTabContent(summary) {
        if (this.activeView === 'dashboard') {
            return this.renderDashboardView(summary);
        } else if (this.activeView === 'strategic') {
            return this.renderStrategicView(summary);
        } else if (this.activeView === 'risk') {
            return this.renderRiskView(summary);
        }
        return '';
    }

    renderDashboardView(summary) {
        return `
            <!-- Key Metrics -->
            <div class="row mb-md">
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${summary.totalOTP}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-top: 3px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${summary.approvalRate}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">OTP Approval Rate</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-top: 3px solid var(--info);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--info);">${summary.resolutionRate}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Resolution Rate</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-top: 3px solid ${summary.overdueTemuan > 0 ? 'var(--danger)' : 'var(--success)'};">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: ${summary.overdueTemuan > 0 ? 'var(--danger)' : 'var(--success)'};">${summary.overdueTemuan}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Overdue Items</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-top: 3px solid #6366f1;">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: #6366f1;">${summary.completedMR}/${summary.totalMR}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Mgmt Reviews Done</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-top: 3px solid var(--warning);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">${summary.highPriorityMD}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">High Priority Decisions</div>
                    </div>
                </div>
            </div>

            <!-- Quarterly Trend -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-graph-up"></i> Quarterly Trend (${this.selectedYear})</h3>
                    <span class="badge-status info">OTP vs Temuan</span>
                </div>
                <div style="padding: var(--space-md);">
                    ${this.renderQuarterlyChart(summary.quarterlyTrend)}
                </div>
            </div>

            <!-- Department Scorecard -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-building"></i> Department Scorecard</h3>
                </div>
                <div class="table-wrapper">
                    ${this.renderScorecardTable(summary)}
                </div>
            </div>

            <!-- Alerts -->
            ${summary.overdueTemuan > 0 || summary.riskSummary.highRiskTemuan > 0 ? `
            <div class="app-card mb-md" style="background: #fff5f5; border-left: 4px solid var(--danger);">
                <div class="card-header">
                    <h3 class="card-title" style="color: var(--danger);">
                        <i class="bi bi-exclamation-triangle-fill"></i> Items Requiring Immediate Attention
                    </h3>
                </div>
                <div style="padding: var(--space-sm);">
                    ${summary.overdueTemuan > 0 ? `
                        <p style="color: var(--danger); margin-bottom: 8px;">
                            <strong>${summary.overdueTemuan}</strong> temuan telah melewati batas waktu penyelesaian
                        </p>
                    ` : ''}
                    ${summary.riskSummary.highRiskTemuan > 0 ? `
                        <p style="color: var(--danger); margin-bottom: 8px;">
                            <strong>${summary.riskSummary.highRiskTemuan}</strong> temuan dengan risiko tinggi
                        </p>
                    ` : ''}
                    ${summary.pendingOTP > 0 ? `
                        <p style="color: var(--warning);">
                            <strong>${summary.pendingOTP}</strong> OTP menunggu approval
                        </p>
                    ` : ''}
                </div>
            </div>
            ` : ''}
        `;
    }

    renderQuarterlyChart(trend) {
        const maxOTP = Math.max(...trend.map(t => t.otpCreated), 1);
        const maxTemuan = Math.max(...trend.map(t => t.temuanFound), 1);
        
        return `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px;">
                ${trend.map(q => `
                    <div style="text-align: center;">
                        <div style="font-size: var(--fs-lg); font-weight: 700; color: var(--primary); margin-bottom: 12px;">${q.label}</div>
                        
                        <div style="margin-bottom: 16px;">
                            <div style="font-size: var(--fs-xs); color: var(--text-light); margin-bottom: 4px;">
                                OTP: ${q.otpCreated} / Appr: ${q.otpApproved}
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 24px; position: relative; overflow: hidden;">
                                <div style="width: ${(q.otpCreated / maxOTP) * 100}%; background: var(--primary-light); height: 100%; position: absolute; border-radius: var(--radius-pill);"></div>
                                <div style="width: ${q.otpCreated > 0 ? (q.otpApproved / maxOTP) * 100 : 0}%; background: var(--success); height: 100%; position: absolute; border-radius: var(--radius-pill);"></div>
                            </div>
                        </div>
                        
                        <div>
                            <div style="font-size: var(--fs-xs); color: var(--text-light); margin-bottom: 4px;">
                                Temuan: ${q.temuanFound} / Res: ${q.temuanResolved}
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 24px; position: relative; overflow: hidden;">
                                <div style="width: ${(q.temuanFound / maxTemuan) * 100}%; background: #fee2e2; height: 100%; position: absolute; border-radius: var(--radius-pill);"></div>
                                <div style="width: ${q.temuanFound > 0 ? (q.temuanResolved / maxTemuan) * 100 : 0}%; background: var(--success); height: 100%; position: absolute; border-radius: var(--radius-pill);"></div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; gap: 20px; justify-content: center; margin-top: 16px; font-size: var(--fs-xs);">
                <span><span style="display: inline-block; width: 12px; height: 12px; background: var(--primary-light); border-radius: 2px; vertical-align: middle;"></span> Total OTP</span>
                <span><span style="display: inline-block; width: 12px; height: 12px; background: var(--success); border-radius: 2px; vertical-align: middle;"></span> Approved/Resolved</span>
                <span><span style="display: inline-block; width: 12px; height: 12px; background: #fee2e2; border-radius: 2px; vertical-align: middle;"></span> Total Temuan</span>
            </div>
        `;
    }

    renderScorecardTable(summary) {
        const allDepts = Object.keys(summary.deptPerformance);
        
        if (allDepts.length === 0) {
            return `<div class="empty-state"><p>Belum ada data departemen</p></div>`;
        }
        
        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th>Departemen</th>
                        <th class="text-center">OTP Total</th>
                        <th class="text-center">OTP Approved</th>
                        <th class="text-center">Approval %</th>
                        <th class="text-center">Temuan Total</th>
                        <th class="text-center">Open</th>
                        <th class="text-center">Resolution %</th>
                        <th class="text-center">Overdue</th>
                        <th class="text-center">Grade</th>
                    </tr>
                </thead>
                <tbody>
                    ${allDepts.sort().map(dept => {
                        const data = summary.deptPerformance[dept];
                        const approvalPct = data.otp > 0 ? Math.round((data.approved / data.otp) * 100) : 0;
                        const resolutionPct = data.temuan > 0 ? Math.round((data.resolvedTemuan / data.temuan) * 100) : 100;
                        const grade = this.getDepartmentGrade(approvalPct, resolutionPct);
                        
                        return `
                            <tr>
                                <td><strong>${this.escapeHtml(dept)}</strong></td>
                                <td class="text-center">${data.otp}</td>
                                <td class="text-center" style="color: var(--success);">${data.approved}</td>
                                <td class="text-center">
                                    <span class="badge-status ${approvalPct >= 80 ? 'success' : approvalPct >= 50 ? 'warning' : 'danger'}">${approvalPct}%</span>
                                </td>
                                <td class="text-center">${data.temuan}</td>
                                <td class="text-center" style="color: ${data.openTemuan > 0 ? 'var(--danger)' : 'var(--success)'};">${data.openTemuan}</td>
                                <td class="text-center">
                                    <span class="badge-status ${resolutionPct >= 80 ? 'success' : resolutionPct >= 50 ? 'warning' : 'danger'}">${resolutionPct}%</span>
                                </td>
                                <td class="text-center" style="color: ${data.overdueTemuan > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: ${data.overdueTemuan > 0 ? '700' : '400'};">
                                    ${data.overdueTemuan}
                                </td>
                                <td class="text-center">${this.getGradeBadge(grade)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    renderStrategicView(summary) {
        return `
            <div class="row mb-md">
                <div class="col-md-6 mb-sm">
                    <div class="app-card" style="background: #f0fdf4; border-left: 4px solid var(--success);">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-bullseye"></i> Key Performance Indicators</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            ${this.renderKPIItem('OTP Approval Rate', summary.approvalRate, 80, '≥80%')}
                            ${this.renderKPIItem('Temuan Resolution Rate', summary.resolutionRate, 90, '≥90%')}
                            ${this.renderKPIItem('Mgmt Review Completion', summary.totalMR > 0 ? Math.round((summary.completedMR / summary.totalMR) * 100) : 0, 100, '100%')}
                            ${this.renderKPIItem('Overdue Items', summary.totalTemuan > 0 ? Math.round(((summary.totalTemuan - summary.overdueTemuan) / summary.totalTemuan) * 100) : 100, 100, '0 Overdue', summary.overdueTemuan === 0)}
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6 mb-sm">
                    <div class="app-card" style="background: #eff6ff; border-left: 4px solid var(--info);">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-clipboard-data"></i> ISO 14001:2015 Status</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            <div style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Clause 6.2 - Environmental Objectives</span>
                                    <span class="badge-status ${summary.totalOTP > 0 ? 'success' : 'warning'}">${summary.totalOTP > 0 ? 'Active' : 'Need Action'}</span>
                                </div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Clause 9.2 - Internal Audit</span>
                                    <span class="badge-status ${summary.totalTemuan > 0 ? 'success' : 'warning'}">${summary.totalTemuan > 0 ? 'Conducted' : 'Need Action'}</span>
                                </div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Clause 9.3 - Management Review</span>
                                    <span class="badge-status ${summary.completedMR > 0 ? 'success' : 'warning'}">${summary.completedMR > 0 ? 'Conducted' : 'Need Action'}</span>
                                </div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Clause 10.2 - Nonconformity & CA</span>
                                    <span class="badge-status ${summary.resolutionRate >= 80 ? 'success' : 'warning'}">${summary.resolutionRate >= 80 ? 'Effective' : 'Need Improvement'}</span>
                                </div>
                            </div>
                            <div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Clause 10.3 - Continual Improvement</span>
                                    <span class="badge-status ${summary.totalMD > 0 ? 'success' : 'info'}">${summary.totalMD > 0 ? 'Active' : 'In Progress'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderKPIItem(label, value, target, targetLabel, isAchieved = null) {
        const achieved = isAchieved !== null ? isAchieved : value >= target;
        return `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: var(--fs-sm);">${label}</span>
                    <span style="font-weight: 700; color: ${achieved ? 'var(--success)' : 'var(--danger)'};">${value}%</span>
                </div>
                <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                    <div style="width: ${Math.min(value, 100)}%; background: ${achieved ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--danger)'}; height: 100%; border-radius: var(--radius-pill);"></div>
                </div>
                <small style="color: var(--text-muted);">Target: ${targetLabel} ${achieved ? '<span style="color: var(--success);">✓</span>' : '<span style="color: var(--danger);">✗</span>'}</small>
            </div>
        `;
    }

    renderRiskView(summary) {
        return `
            <div class="row mb-md">
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); background: ${summary.riskSummary.highRiskTemuan > 0 ? '#fff5f5' : '#f0fdf4'}; border-left: 4px solid ${summary.riskSummary.highRiskTemuan > 0 ? 'var(--danger)' : 'var(--success)'};">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: ${summary.riskSummary.highRiskTemuan > 0 ? 'var(--danger)' : 'var(--success)'};">
                            ${summary.riskSummary.highRiskTemuan}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">High Risk Items</div>
                        <div style="font-size: var(--fs-xs); color: var(--text-light);">Mayor / NC / Overdue</div>
                    </div>
                </div>
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--warning);">
                            ${summary.riskSummary.mediumRiskTemuan}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Medium Risk Items</div>
                        <div style="font-size: var(--fs-xs); color: var(--text-light);">Minor - Open/In Progress</div>
                    </div>
                </div>
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--info);">
                            ${summary.totalTemuan - summary.riskSummary.highRiskTemuan - summary.riskSummary.mediumRiskTemuan}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Low Risk / Resolved</div>
                        <div style="font-size: var(--fs-xs); color: var(--text-light);">Obs / OFI / Closed</div>
                    </div>
                </div>
            </div>

            <!-- Risk Level Distribution -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-pie-chart"></i> Risk Distribution</h3>
                </div>
                <div style="padding: var(--space-md);">
                    ${summary.totalTemuan > 0 ? `
                        <div style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                                <span style="color: var(--danger); font-weight: 600;">High Risk</span>
                                <span>${summary.riskSummary.highRiskTemuan} (${Math.round(summary.riskSummary.highRiskTemuan / summary.totalTemuan * 100)}%)</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                                <div style="width: ${Math.round(summary.riskSummary.highRiskTemuan / summary.totalTemuan * 100)}%; background: var(--danger); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                        </div>
                        <div style="margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                                <span style="color: var(--warning); font-weight: 600;">Medium Risk</span>
                                <span>${summary.riskSummary.mediumRiskTemuan} (${Math.round(summary.riskSummary.mediumRiskTemuan / summary.totalTemuan * 100)}%)</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                                <div style="width: ${Math.round(summary.riskSummary.mediumRiskTemuan / summary.totalTemuan * 100)}%; background: var(--warning); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                                <span style="color: var(--success); font-weight: 600;">Low / Resolved</span>
                                <span>${summary.totalTemuan - summary.riskSummary.highRiskTemuan - summary.riskSummary.mediumRiskTemuan} (${Math.round((summary.totalTemuan - summary.riskSummary.highRiskTemuan - summary.riskSummary.mediumRiskTemuan) / summary.totalTemuan * 100)}%)</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                                <div style="width: ${Math.round((summary.totalTemuan - summary.riskSummary.highRiskTemuan - summary.riskSummary.mediumRiskTemuan) / summary.totalTemuan * 100)}%; background: var(--success); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                        </div>
                    ` : '<p style="text-align: center; color: var(--text-muted);">Tidak ada temuan</p>'}
                </div>
            </div>

            <!-- Top Risk Departments -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-building-exclamation"></i> Top Risk Departments</h3>
                    <span class="badge-status danger">Departments with Most Open Issues</span>
                </div>
                <div style="padding: var(--space-md);">
                    ${summary.riskSummary.topRiskDepts.length > 0 ? `
                        ${summary.riskSummary.topRiskDepts.map(([dept, count], index) => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-light);">
                                <div style="width: 32px; height: 32px; background: ${index === 0 ? 'var(--danger)' : index === 1 ? '#ef4444' : index === 2 ? '#f97316' : 'var(--warning)'}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: var(--fs-sm); flex-shrink: 0;">
                                    ${index + 1}
                                </div>
                                <div style="flex: 1;">
                                    <strong>${this.escapeHtml(dept)}</strong>
                                    <div style="font-size: var(--fs-xs); color: var(--text-muted);">${count} open issues</div>
                                </div>
                                <button class="btn btn-sm btn-outline-danger" data-page="temuan-daftar">
                                    <i class="bi bi-arrow-right"></i> View
                                </button>
                            </div>
                        `).join('')}
                    ` : `
                        <div class="empty-state">
                            <i class="bi bi-check-circle" style="color: var(--success); font-size: 2rem;"></i>
                            <p>All departments are in good standing</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // ============================================
    // ACTION METHODS (DIPERBAIKI)
    // ============================================
    
    async switchView(params) {
        this.activeView = params.view || 'dashboard';
        
        // Update tab button visuals
        const tabButtons = document.querySelectorAll('#execTabButtons .tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-primary');
        });
        const activeBtn = document.querySelector(`#execTabButtons .tab-btn[data-tab="${this.activeView}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('btn-outline-primary');
            activeBtn.classList.add('btn-primary');
        }
        
        // Update hanya konten tab
        await this.updateTabContentOnly();
    }

    async updateTabContentOnly() {
        const tabContainer = document.getElementById('execMonitoringTabContent');
        if (!tabContainer) return;
        
        tabContainer.style.opacity = '0';
        tabContainer.style.transform = 'translateY(8px)';
        tabContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const summary = this.getExecutiveSummary();
        tabContainer.innerHTML = this.renderTabContent(summary);
        
        requestAnimationFrame(() => {
            tabContainer.style.opacity = '1';
            tabContainer.style.transform = 'translateY(0)';
        });
        
        this.attachTabButtonEvents();
    }

    async filterYear() {
        const el = document.getElementById('execMonYearFilter');
        if (el) this.selectedYear = el.value;
        await this.updateTabContentOnly();
    }

    async refresh() {
        const refreshBtn = document.getElementById('refreshExecMonBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.otpData = [];
        this.temuanData = [];
        this.mrData = [];
        this.mdData = [];
        
        try {
            await this.loadAllData();
            this.isRefreshing = true;
            
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = this.renderHTML();
                this.afterRender();
            }
            
            this.isRefreshing = false;
            toast('Monitoring overview berhasil dimuat ulang', 'success');
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
        const yearFilter = document.getElementById('execMonYearFilter');
        if (yearFilter) {
            const newEl = yearFilter.cloneNode(true);
            yearFilter.parentNode.replaceChild(newEl, yearFilter);
            newEl.addEventListener('change', () => this.filterYear());
        }
    }

    attachTabButtonEvents() {
        const tabButtons = document.querySelectorAll('#execTabButtons .tab-btn');
        tabButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', () => {
                const tab = newBtn.dataset.tab;
                if (tab && tab !== this.activeView) {
                    this.switchView({ view: tab });
                }
            });
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getHealthColor(score) {
        if (score >= 80) return '#22c55e';
        if (score >= 60) return '#f59e0b';
        if (score >= 40) return '#f97316';
        return '#ef4444';
    }

    getHealthLabel(score) {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Warning';
        return 'Critical';
    }

    getDepartmentGrade(approvalPct, resolutionPct) {
        const avg = (approvalPct + resolutionPct) / 2;
        if (avg >= 80) return 'A';
        if (avg >= 60) return 'B';
        if (avg >= 40) return 'C';
        return 'D';
    }

    getGradeBadge(grade) {
        const badges = { 'A': 'success', 'B': 'info', 'C': 'warning', 'D': 'danger' };
        return `<span class="badge-status ${badges[grade] || 'default'}">${grade}</span>`;
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
                        <h1 class="page-title">Monitoring Overview</h1>
                        <p class="breadcrumb">Home / Monitoring / <span>Monitoring Overview</span></p>
                    </div>
                </div>
                <div class="app-card">
                    <div class="empty-state">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <h3 class="mt-md">Preparing Executive Dashboard...</h3>
                        <p>Mengambil data dan menganalisis metrik</p>
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
                    <h1 class="page-title">Monitoring Overview</h1>
                    <p class="breadcrumb">Home / Monitoring / <span>Monitoring Overview</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Dashboard</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                    <button class="btn btn-primary mt-md" data-action="monitoringExec.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}