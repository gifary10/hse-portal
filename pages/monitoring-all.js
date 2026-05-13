// pages/monitoring-all.js
// All Monitoring Page - Untuk HSE Manager
// Menampilkan monitoring seluruh departemen
// [UPDATED: Partial Update untuk switch tab]

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class MonitoringAllPage {
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
        this.selectedDept = '';
        this.activeView = 'overview'; // overview | otp | temuan | comparison
        
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
            console.error(`All Monitoring fetch ${action} error:`, error);
            return { status: 'error', data: [], total: 0, message: error.message };
        }
    }

    async loadAllData() {
        try {
            const [otpResult, temuanResult] = await Promise.all([
                this.fetchFromSheets('getAllOTP'),
                this.fetchFromSheets('getAllTemuan')
            ]);
            
            this.otpData = otpResult.data || [];
            this.temuanData = temuanResult.data || [];
            this.lastFetchTime = new Date();
            
        } catch (error) {
            console.error('Failed to load all monitoring data:', error);
            throw error;
        }
    }

    // ============================================
    // CALCULATIONS
    // ============================================
    
    getDepartmentList() {
        const departments = new Set();
        [...this.otpData, ...this.temuanData].forEach(item => {
            const dept = item.Department || item.department;
            if (dept) departments.add(dept);
        });
        return Array.from(departments).sort();
    }

    getOTPStats() {
        let filtered = this.otpData.filter(o => {
            const year = o.Year || o.year;
            return year && year.toString() === this.selectedYear;
        });
        
        if (this.selectedDept) {
            filtered = filtered.filter(o => (o.Department || o.department) === this.selectedDept);
        }
        
        const total = filtered.length;
        const approved = filtered.filter(o => (o.Status || o.status) === 'Approved').length;
        const rejected = filtered.filter(o => (o.Status || o.status) === 'Rejected').length;
        const submitted = filtered.filter(o => (o.Status || o.status) === 'Submitted').length;
        const inReview = filtered.filter(o => (o.Status || o.status) === 'In Review').length;
        const draft = filtered.filter(o => (o.Status || o.status) === 'Draft').length;
        
        const approvalRate = total > 0 ? Math.round((approved / (approved + rejected || 1)) * 100) : 0;
        
        // By Department
        const byDept = {};
        filtered.forEach(o => {
            const dept = o.Department || o.department || 'Unknown';
            if (!byDept[dept]) byDept[dept] = { total: 0, approved: 0, rejected: 0, submitted: 0, draft: 0 };
            byDept[dept].total++;
            const status = o.Status || o.status;
            if (status === 'Approved') byDept[dept].approved++;
            if (status === 'Rejected') byDept[dept].rejected++;
            if (status === 'Submitted') byDept[dept].submitted++;
            if (status === 'Draft') byDept[dept].draft++;
        });
        
        return { total, approved, rejected, submitted, inReview, draft, approvalRate, byDept, filtered };
    }
    
    getTemuanStats() {
        let filtered = this.temuanData.filter(t => {
            if (!this.selectedYear) return true;
            const date = t.Tanggal_Audit || t.tanggalAudit || t.Created_At || t.createdAt;
            if (!date) return false;
            return new Date(date).getFullYear().toString() === this.selectedYear;
        });
        
        if (this.selectedDept) {
            filtered = filtered.filter(t => (t.Department || t.department) === this.selectedDept);
        }
        
        const total = filtered.length;
        const open = filtered.filter(t => (t.Status || t.status) === 'Open').length;
        const inProgress = filtered.filter(t => (t.Status || t.status) === 'In Progress').length;
        const closed = filtered.filter(t => (t.Status || t.status) === 'Closed').length;
        const verified = filtered.filter(t => (t.Status || t.status) === 'Verified').length;
        
        const resolutionRate = total > 0 ? Math.round(((closed + verified) / total) * 100) : 100;
        
        const overdue = filtered.filter(t => {
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            const status = t.Status || t.status;
            if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
            return new Date(targetSelesai) < new Date();
        }).length;
        
        // By Department
        const byDept = {};
        filtered.forEach(t => {
            const dept = t.Department || t.department || 'Unknown';
            if (!byDept[dept]) byDept[dept] = { total: 0, open: 0, inProgress: 0, closed: 0, verified: 0, overdue: 0 };
            byDept[dept].total++;
            const status = t.Status || t.status;
            if (status === 'Open') byDept[dept].open++;
            if (status === 'In Progress') byDept[dept].inProgress++;
            if (status === 'Closed') byDept[dept].closed++;
            if (status === 'Verified') byDept[dept].verified++;
            
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            if (targetSelesai && status !== 'Closed' && status !== 'Verified' && new Date(targetSelesai) < new Date()) {
                byDept[dept].overdue++;
            }
        });
        
        return { total, open, inProgress, closed, verified, resolutionRate, overdue, byDept, filtered };
    }

    getMonthlyAllData() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthlyData = Array(12).fill(0).map(() => ({ otpCreated: 0, otpApproved: 0, temuanFound: 0, temuanResolved: 0 }));
        
        this.otpData.forEach(o => {
            const year = (o.Year || o.year || '').toString();
            if (year !== this.selectedYear) return;
            
            const dateStr = o.Created_Date || o.createdDate || o.CreatedAt || o.createdAt;
            if (!dateStr) return;
            
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;
            
            if (this.selectedDept && (o.Department || o.department) !== this.selectedDept) return;
            
            const month = date.getMonth();
            monthlyData[month].otpCreated++;
            if ((o.Status || o.status) === 'Approved') monthlyData[month].otpApproved++;
        });
        
        this.temuanData.forEach(t => {
            const dateStr = t.Tanggal_Audit || t.tanggalAudit || t.Created_At || t.createdAt;
            if (!dateStr) return;
            
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;
            if (date.getFullYear().toString() !== this.selectedYear) return;
            if (this.selectedDept && (t.Department || t.department) !== this.selectedDept) return;
            
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
            await this.loadAllData();
            this.hideLoading();
            return this.renderHTML();
        } catch (error) {
            console.error('All Monitoring render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const otpStats = this.getOTPStats();
        const temuanStats = this.getTemuanStats();
        const departments = this.getDepartmentList();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">All Monitoring</h1>
                    <p class="breadcrumb">Home / Monitoring / <span>All Monitoring</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" id="refreshAllMonitoringBtn" data-action="monitoringAll.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            <!-- Info Banner -->
            <div class="app-card mb-md" style="background: #eff6ff; border-left: 4px solid var(--info);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-shield-check" style="color: var(--info); font-size: 1.5rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">HSE All Monitoring</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Monitoring seluruh departemen. Total: ${departments.length} departemen terpantau.
                            ${this.lastFetchTime ? `Data diperbarui: ${this.formatTime(this.lastFetchTime)}` : ''}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Filter & View -->
            <div class="filter-section">
                <div class="row">
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="allMonYearFilter" class="form-select">
                                <option value="2024" ${this.selectedYear === '2024' ? 'selected' : ''}>2024</option>
                                <option value="2025" ${this.selectedYear === '2025' ? 'selected' : ''}>2025</option>
                                <option value="2026" ${this.selectedYear === '2026' ? 'selected' : ''}>2026</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Filter Departemen</label>
                            <select id="allMonDeptFilter" class="form-select">
                                <option value="">Semua Departemen</option>
                                ${departments.map(dept => `
                                    <option value="${this.escapeHtml(dept)}" ${this.selectedDept === dept ? 'selected' : ''}>${this.escapeHtml(dept)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group-custom">
                            <label>View</label>
                            <div class="d-flex gap-xs mt-1" id="allMonTabButtons">
                                <button class="btn btn-sm tab-btn ${this.activeView === 'overview' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="overview">
                                    <i class="bi bi-speedometer2"></i> Overview
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeView === 'otp' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="otp">
                                    <i class="bi bi-clipboard-check"></i> OTP Detail
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeView === 'temuan' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="temuan">
                                    <i class="bi bi-exclamation-triangle"></i> Temuan Detail
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeView === 'comparison' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="comparison">
                                    <i class="bi bi-bar-chart"></i> Comparison
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab Content Container -->
            <div id="allMonTabContent">
                ${this.renderTabContent(otpStats, temuanStats, departments.length)}
            </div>
        `;
    }

    renderTabContent(otpStats, temuanStats, totalDepts) {
        const monthlyData = this.getMonthlyAllData();
        
        if (this.activeView === 'overview') {
            return this.renderOverviewView(otpStats, temuanStats, totalDepts);
        } else if (this.activeView === 'otp') {
            return this.renderOTPDetailView(otpStats);
        } else if (this.activeView === 'temuan') {
            return this.renderTemuanDetailView(temuanStats);
        } else if (this.activeView === 'comparison') {
            return this.renderComparisonView(otpStats, temuanStats, monthlyData);
        }
        return '';
    }

    renderOverviewView(otpStats, temuanStats, totalDepts) {
        return `
            <!-- Key Metrics -->
            <div class="row mb-md">
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${totalDepts}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Departemen</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${otpStats.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${otpStats.approvalRate}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Approval Rate</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">${temuanStats.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Temuan</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${temuanStats.resolutionRate}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Resolution Rate</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid ${temuanStats.overdue > 0 ? 'var(--danger)' : 'var(--success)'};">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: ${temuanStats.overdue > 0 ? 'var(--danger)' : 'var(--success)'};">${temuanStats.overdue}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Overdue</div>
                    </div>
                </div>
            </div>

            <!-- Department Scorecard -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-building"></i> Department Scorecard</h3>
                    <span class="badge-status info">${Object.keys(otpStats.byDept).length} Departemen</span>
                </div>
                <div class="table-wrapper">
                    ${this.renderScorecardTable(otpStats, temuanStats)}
                </div>
            </div>

            <!-- Pending & Overdue Alerts -->
            <div class="row">
                <div class="col-md-6 mb-sm">
                    <div class="app-card" style="background: #fffbeb;">
                        <div class="card-header">
                            <h3 class="card-title" style="color: var(--warning);">
                                <i class="bi bi-hourglass-split"></i> Pending OTP per Departemen
                            </h3>
                        </div>
                        <div style="padding: var(--space-md); max-height: 300px; overflow-y: auto;">
                            ${Object.entries(otpStats.byDept)
                                .filter(([, data]) => data.submitted + data.draft > 0)
                                .sort(([, a], [, b]) => (b.submitted + b.draft) - (a.submitted + a.draft))
                                .map(([dept, data]) => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-light);">
                                        <span style="font-size: var(--fs-sm);">${this.escapeHtml(dept)}</span>
                                        <span>
                                            ${data.submitted > 0 ? `<span class="badge-status info">${data.submitted} Submitted</span> ` : ''}
                                            ${data.draft > 0 ? `<span class="badge-status warning">${data.draft} Draft</span>` : ''}
                                        </span>
                                    </div>
                                `).join('')}
                            ${Object.entries(otpStats.byDept).filter(([, data]) => data.submitted + data.draft > 0).length === 0 ? 
                                '<p style="text-align: center; color: var(--text-muted); padding: var(--space-md);">Tidak ada OTP pending</p>' : ''}
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-sm">
                    <div class="app-card" style="background: #fff5f5;">
                        <div class="card-header">
                            <h3 class="card-title" style="color: var(--danger);">
                                <i class="bi bi-exclamation-triangle-fill"></i> Top Risk Departments
                            </h3>
                        </div>
                        <div style="padding: var(--space-md); max-height: 300px; overflow-y: auto;">
                            ${Object.entries(temuanStats.byDept)
                                .filter(([, data]) => data.open + data.overdue > 0)
                                .sort(([, a], [, b]) => (b.open + b.overdue) - (a.open + a.overdue))
                                .slice(0, 10)
                                .map(([dept, data], index) => `
                                    <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #fee2e2;">
                                        <div style="width: 28px; height: 28px; background: ${index === 0 ? 'var(--danger)' : index === 1 ? '#ef4444' : index === 2 ? '#f97316' : 'var(--warning)'}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: var(--fs-xs); flex-shrink: 0;">
                                            ${index + 1}
                                        </div>
                                        <div style="flex: 1;">
                                            <strong style="font-size: var(--fs-sm);">${this.escapeHtml(dept)}</strong>
                                            <div style="font-size: var(--fs-xs); color: var(--text-muted);">
                                                ${data.open > 0 ? `${data.open} Open ` : ''}
                                                ${data.inProgress > 0 ? `${data.inProgress} In Progress ` : ''}
                                                ${data.overdue > 0 ? `<span style="color: var(--danger); font-weight: 600;">${data.overdue} Overdue</span>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            ${Object.entries(temuanStats.byDept).filter(([, data]) => data.open + data.overdue > 0).length === 0 ? 
                                '<p style="text-align: center; color: var(--success); padding: var(--space-md);"><i class="bi bi-check-circle"></i> Semua departemen dalam kondisi baik</p>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderScorecardTable(otpStats, temuanStats) {
        const allDepts = new Set([
            ...Object.keys(otpStats.byDept),
            ...Object.keys(temuanStats.byDept)
        ]);
        
        if (allDepts.size === 0) {
            return `<div class="empty-state"><p>Belum ada data departemen</p></div>`;
        }
        
        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th>Departemen</th>
                        <th class="text-center">Total OTP</th>
                        <th class="text-center">Approved</th>
                        <th class="text-center">Approval %</th>
                        <th class="text-center">Total Temuan</th>
                        <th class="text-center">Open</th>
                        <th class="text-center">Resolution %</th>
                        <th class="text-center">Overdue</th>
                        <th class="text-center">Grade</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(allDepts).sort().map(dept => {
                        const otpDept = otpStats.byDept[dept] || { total: 0, approved: 0, rejected: 0 };
                        const temuanDept = temuanStats.byDept[dept] || { total: 0, open: 0, closed: 0, verified: 0, overdue: 0 };
                        
                        const approvalPct = otpDept.total > 0 ? Math.round((otpDept.approved / otpDept.total) * 100) : 0;
                        const resolutionPct = temuanDept.total > 0 ? Math.round(((temuanDept.closed + temuanDept.verified) / temuanDept.total) * 100) : 100;
                        const grade = this.getDepartmentGrade(approvalPct, resolutionPct);
                        
                        return `
                            <tr>
                                <td><strong>${this.escapeHtml(dept)}</strong></td>
                                <td class="text-center">${otpDept.total}</td>
                                <td class="text-center" style="color: var(--success);">${otpDept.approved}</td>
                                <td class="text-center">
                                    <span class="badge-status ${approvalPct >= 80 ? 'success' : approvalPct >= 50 ? 'warning' : 'danger'}">${approvalPct}%</span>
                                </td>
                                <td class="text-center">${temuanDept.total}</td>
                                <td class="text-center" style="color: ${temuanDept.open > 0 ? 'var(--danger)' : 'var(--success)'};">${temuanDept.open}</td>
                                <td class="text-center">
                                    <span class="badge-status ${resolutionPct >= 80 ? 'success' : resolutionPct >= 50 ? 'warning' : 'danger'}">${resolutionPct}%</span>
                                </td>
                                <td class="text-center" style="color: ${temuanDept.overdue > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: ${temuanDept.overdue > 0 ? '700' : '400'};">
                                    ${temuanDept.overdue}
                                </td>
                                <td class="text-center">${this.getGradeBadge(grade)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    renderOTPDetailView(otpStats) {
        return `
            <div class="row mb-md">
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${otpStats.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${otpStats.approved}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Approved</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">${otpStats.submitted + otpStats.draft}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Pending</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">${otpStats.rejected}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Rejected</div>
                    </div>
                </div>
            </div>

            <!-- OTP by Department Bar Chart -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-bar-chart"></i> OTP per Departemen</h3>
                </div>
                <div style="padding: var(--space-md); max-height: 450px; overflow-y: auto;">
                    ${Object.entries(otpStats.byDept)
                        .sort(([, a], [, b]) => b.total - a.total)
                        .map(([dept, data]) => {
                            const maxTotal = Math.max(...Object.values(otpStats.byDept).map(d => d.total), 1);
                            const barWidth = (data.total / maxTotal) * 100;
                            const approvedWidth = data.total > 0 ? (data.approved / data.total) * barWidth : 0;
                            
                            return `
                                <div style="margin-bottom: 14px;">
                                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                                        <span><strong>${this.escapeHtml(dept)}</strong></span>
                                        <span style="font-weight: 600;">${data.approved}/${data.total} approved</span>
                                    </div>
                                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 22px; position: relative; overflow: hidden;">
                                        <div style="width: ${barWidth}%; background: var(--primary-light); height: 100%; position: absolute; border-radius: var(--radius-pill);"></div>
                                        <div style="width: ${approvedWidth}%; background: var(--success); height: 100%; position: absolute; border-radius: var(--radius-pill); transition: width 0.6s ease;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                </div>
            </div>

            <!-- Recent OTP Table -->
            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-list-check"></i> Recent OTP</h3>
                </div>
                <div class="table-wrapper">
                    <table class="data-table striped condensed">
                        <thead>
                            <tr>
                                <th>OTP ID</th>
                                <th>Department</th>
                                <th>Objective</th>
                                <th>Owner</th>
                                <th>Status</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${[...otpStats.filtered]
                                .sort((a, b) => new Date(b.Created_Date || b.createdDate || b.CreatedAt || b.createdAt || 0) - new Date(a.Created_Date || a.createdDate || a.CreatedAt || a.createdAt || 0))
                                .slice(0, 15)
                                .map(o => `
                                    <tr>
                                        <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(o.OTP_ID || o.otpId || '-')}</code></td>
                                        <td>${this.escapeHtml(o.Department || o.department || '-')}</td>
                                        <td class="col-wrap">${this.escapeHtml((o.Objective || o.objective || '').substring(0, 60))}</td>
                                        <td>${this.escapeHtml(o.Owner || o.owner || '-')}</td>
                                        <td>${this.getOTPStatusBadge(o.Status || o.status)}</td>
                                        <td><small>${this.formatDate(o.Created_Date || o.createdDate || o.CreatedAt || o.createdAt)}</small></td>
                                    </tr>
                                `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderTemuanDetailView(temuanStats) {
        return `
            <div class="row mb-md">
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${temuanStats.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">${temuanStats.open}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Open</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">${temuanStats.inProgress}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">In Progress</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${temuanStats.closed}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Closed</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--info);">${temuanStats.verified}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Verified</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid #ef4444; ${temuanStats.overdue > 0 ? 'animation: pulse 2s infinite;' : ''}">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: #ef4444;">${temuanStats.overdue}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Overdue</div>
                    </div>
                </div>
            </div>

            <!-- Temuan by Department -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-building"></i> Temuan per Departemen</h3>
                </div>
                <div style="padding: var(--space-md); max-height: 400px; overflow-y: auto;">
                    ${Object.entries(temuanStats.byDept)
                        .sort(([, a], [, b]) => b.open - a.open)
                        .map(([dept, data]) => {
                            const maxOpen = Math.max(...Object.values(temuanStats.byDept).map(d => d.open), 1);
                            const barWidth = (data.open / maxOpen) * 100;
                            
                            return `
                                <div style="margin-bottom: 12px;">
                                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                                        <span>${this.escapeHtml(dept)}</span>
                                        <span>
                                            ${data.open > 0 ? `<span style="color: var(--danger); font-weight: 600;">${data.open} Open</span> ` : ''}
                                            ${data.overdue > 0 ? `<span style="color: #ef4444; font-weight: 600;">${data.overdue} Overdue</span>` : ''}
                                            ${data.open === 0 && data.overdue === 0 ? `<span style="color: var(--success);">Clean</span>` : ''}
                                        </span>
                                    </div>
                                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                                        <div style="width: ${barWidth}%; background: ${data.open > 0 ? 'var(--danger)' : 'var(--success)'}; height: 100%; border-radius: var(--radius-pill);"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                </div>
            </div>

            <!-- Overdue Temuan List -->
            ${temuanStats.overdue > 0 ? `
            <div class="app-card" style="background: #fff5f5; border-left: 4px solid var(--danger);">
                <div class="card-header">
                    <h3 class="card-title" style="color: var(--danger);">
                        <i class="bi bi-exclamation-triangle-fill"></i> Temuan Overdue (${temuanStats.overdue})
                    </h3>
                </div>
                <div class="table-wrapper">
                    <table class="data-table striped condensed">
                        <thead>
                            <tr>
                                <th>ID Temuan</th>
                                <th>Department</th>
                                <th>Uraian</th>
                                <th>Target Selesai</th>
                                <th>PIC</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${temuanStats.filtered
                                .filter(t => {
                                    const targetSelesai = t.Target_Selesai || t.targetSelesai;
                                    const status = t.Status || t.status;
                                    if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
                                    return new Date(targetSelesai) < new Date();
                                })
                                .sort((a, b) => new Date(a.Target_Selesai || a.targetSelesai) - new Date(b.Target_Selesai || b.targetSelesai))
                                .map(t => `
                                    <tr>
                                        <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(t.Temuan_ID || t.temuanId || '-')}</code></td>
                                        <td>${this.escapeHtml(t.Department || t.department || '-')}</td>
                                        <td class="col-wrap">${this.escapeHtml((t.Uraian_Temuan || t.uraianTemuan || '').substring(0, 60))}</td>
                                        <td style="color: var(--danger); font-weight: 600;">${this.formatDate(t.Target_Selesai || t.targetSelesai)}</td>
                                        <td>${this.escapeHtml(t.Penanggung_Jawab || t.penanggungJawab || '-')}</td>
                                        <td>${this.getTemuanStatusBadge(t.Status || t.status)}</td>
                                    </tr>
                                `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
        `;
    }

    renderComparisonView(otpStats, temuanStats, monthlyData) {
        const maxOTP = Math.max(...monthlyData.data.map(d => d.otpCreated), 1);
        const maxTemuan = Math.max(...monthlyData.data.map(d => d.temuanFound), 1);
        
        return `
            <div class="row mb-md">
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${otpStats.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${otpStats.approvalRate}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">OTP Approval Rate</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${temuanStats.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Temuan</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${temuanStats.resolutionRate}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Resolution Rate</div>
                    </div>
                </div>
            </div>

            <!-- Monthly Comparison Chart -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-graph-up"></i> OTP vs Temuan Monthly (${this.selectedYear})</h3>
                </div>
                <div style="padding: var(--space-md);">
                    <div style="display: flex; align-items: flex-end; gap: 6px; height: 280px; padding: 0 8px;">
                        ${monthlyData.months.map((month, i) => {
                            const otpHeight = (monthlyData.data[i].otpCreated / maxOTP) * 100;
                            const temuanHeight = (monthlyData.data[i].temuanFound / maxTemuan) * 100;
                            
                            return `
                                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                                    <div style="flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 4px;">
                                        <div style="width: 40%; height: ${otpHeight}%; background: linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%); 
                                                    border-radius: 6px 6px 0 0; min-height: 2px; position: relative;"
                                             title="OTP: ${monthlyData.data[i].otpCreated}">
                                        </div>
                                        <div style="width: 40%; height: ${temuanHeight}%; background: linear-gradient(180deg, #f87171 0%, var(--danger) 100%); 
                                                    border-radius: 6px 6px 0 0; min-height: 2px; position: relative;"
                                             title="Temuan: ${monthlyData.data[i].temuanFound}">
                                        </div>
                                    </div>
                                    <div style="font-size: 10px; color: var(--text-muted); margin-top: 6px; transform: rotate(-45deg); transform-origin: top left; white-space: nowrap;">
                                        ${month}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="display: flex; gap: 20px; justify-content: center; margin-top: 28px; font-size: var(--fs-xs);">
                        <span><span style="display: inline-block; width: 14px; height: 14px; background: var(--primary); border-radius: 3px; vertical-align: middle; margin-right: 4px;"></span> OTP</span>
                        <span><span style="display: inline-block; width: 14px; height: 14px; background: var(--danger); border-radius: 3px; vertical-align: middle; margin-right: 4px;"></span> Temuan</span>
                    </div>
                </div>
            </div>

            <!-- Department Comparison Table -->
            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-table"></i> Department Comparison</h3>
                </div>
                <div class="table-wrapper">
                    ${this.renderScorecardTable(otpStats, temuanStats)}
                </div>
            </div>
        `;
    }

    // ============================================
    // ACTION METHODS (DIPERBAIKI)
    // ============================================
    
    async switchView(params) {
        this.activeView = params.view || 'overview';
        
        // Update tab button visuals
        const tabButtons = document.querySelectorAll('#allMonTabButtons .tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-primary');
        });
        const activeBtn = document.querySelector(`#allMonTabButtons .tab-btn[data-tab="${this.activeView}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('btn-outline-primary');
            activeBtn.classList.add('btn-primary');
        }
        
        await this.updateTabContentOnly();
    }

    async updateTabContentOnly() {
        const tabContainer = document.getElementById('allMonTabContent');
        if (!tabContainer) return;
        
        tabContainer.style.opacity = '0';
        tabContainer.style.transform = 'translateY(8px)';
        tabContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const otpStats = this.getOTPStats();
        const temuanStats = this.getTemuanStats();
        const departments = this.getDepartmentList();
        
        tabContainer.innerHTML = this.renderTabContent(otpStats, temuanStats, departments.length);
        
        requestAnimationFrame(() => {
            tabContainer.style.opacity = '1';
            tabContainer.style.transform = 'translateY(0)';
        });
        
        this.attachTabButtonEvents();
    }

    async filterYear() {
        const el = document.getElementById('allMonYearFilter');
        if (el) this.selectedYear = el.value;
        await this.updateTabContentOnly();
    }

    async filterDepartment() {
        const el = document.getElementById('allMonDeptFilter');
        if (el) this.selectedDept = el.value;
        await this.updateTabContentOnly();
    }

    async refresh() {
        const refreshBtn = document.getElementById('refreshAllMonitoringBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.otpData = [];
        this.temuanData = [];
        
        try {
            await this.loadAllData();
            this.isRefreshing = true;
            
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
        const yearFilter = document.getElementById('allMonYearFilter');
        if (yearFilter) {
            const newEl = yearFilter.cloneNode(true);
            yearFilter.parentNode.replaceChild(newEl, yearFilter);
            newEl.addEventListener('change', () => this.filterYear());
        }
        
        const deptFilter = document.getElementById('allMonDeptFilter');
        if (deptFilter) {
            const newEl = deptFilter.cloneNode(true);
            deptFilter.parentNode.replaceChild(newEl, deptFilter);
            newEl.addEventListener('change', () => this.filterDepartment());
        }
    }

    attachTabButtonEvents() {
        const tabButtons = document.querySelectorAll('#allMonTabButtons .tab-btn');
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
                        <h1 class="page-title">All Monitoring</h1>
                        <p class="breadcrumb">Home / Monitoring / <span>All Monitoring</span></p>
                    </div>
                </div>
                <div class="app-card">
                    <div class="empty-state">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <h3 class="mt-md">Memuat Data Semua Departemen...</h3>
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
                    <h1 class="page-title">All Monitoring</h1>
                    <p class="breadcrumb">Home / Monitoring / <span>All Monitoring</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Data</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                    <button class="btn btn-primary mt-md" data-action="monitoringAll.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}