// pages/reports-hse.js
// HSE Reports Page - Laporan komprehensif untuk HSE Manager
// Mencakup semua departemen, analytics, dan compliance tracking
// [UPDATED: Partial Update untuk switch tab]

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class ReportsHSEPage {
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
        this.selectedDept = '';
        this.activeTab = 'overview'; // overview | otp | temuan | compliance
        
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
            console.error(`HSE Reports fetch ${action} error:`, error);
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
            console.error('Failed to load HSE report data:', error);
            throw error;
        }
    }

    // ============================================
    // CALCULATIONS
    // ============================================
    
    getStats() {
        // OTP Stats
        const totalOTP = this.otpData.length;
        const approvedOTP = this.otpData.filter(o => (o.Status || o.status) === 'Approved').length;
        const rejectedOTP = this.otpData.filter(o => (o.Status || o.status) === 'Rejected').length;
        const pendingOTP = this.otpData.filter(o => 
            (o.Status || o.status) === 'Submitted' || (o.Status || o.status) === 'In Review'
        ).length;
        const draftOTP = this.otpData.filter(o => (o.Status || o.status) === 'Draft').length;
        
        // OTP by Department
        const otpByDept = {};
        this.otpData.forEach(o => {
            const dept = o.Department || o.department || 'Unknown';
            if (!otpByDept[dept]) otpByDept[dept] = { total: 0, approved: 0, rejected: 0 };
            otpByDept[dept].total++;
            if ((o.Status || o.status) === 'Approved') otpByDept[dept].approved++;
            if ((o.Status || o.status) === 'Rejected') otpByDept[dept].rejected++;
        });
        
        // Temuan Stats
        const totalTemuan = this.temuanData.length;
        const openTemuan = this.temuanData.filter(t => (t.Status || t.status) === 'Open').length;
        const inProgressTemuan = this.temuanData.filter(t => (t.Status || t.status) === 'In Progress').length;
        const closedTemuan = this.temuanData.filter(t => (t.Status || t.status) === 'Closed').length;
        const verifiedTemuan = this.temuanData.filter(t => (t.Status || t.status) === 'Verified').length;
        
        // Temuan Overdue
        const overdueTemuan = this.temuanData.filter(t => {
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            const status = t.Status || t.status;
            if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
            return new Date(targetSelesai) < new Date();
        }).length;
        
        // Temuan by Kategori
        const temuanByKategori = {};
        this.temuanData.forEach(t => {
            const kat = t.Kategori_Temuan || t.kategoriTemuan || 'Unknown';
            temuanByKategori[kat] = (temuanByKategori[kat] || 0) + 1;
        });
        
        // Temuan by Department
        const temuanByDept = {};
        this.temuanData.forEach(t => {
            const dept = t.Department || t.department || 'Unknown';
            if (!temuanByDept[dept]) temuanByDept[dept] = { total: 0, open: 0, closed: 0 };
            temuanByDept[dept].total++;
            if ((t.Status || t.status) === 'Open' || (t.Status || t.status) === 'In Progress') temuanByDept[dept].open++;
            if ((t.Status || t.status) === 'Closed' || (t.Status || t.status) === 'Verified') temuanByDept[dept].closed++;
        });
        
        // MR Stats
        const totalMR = this.mrData.length;
        const completedMR = this.mrData.filter(m => 
            (m.Status || m.status) === 'Completed' || (m.Status || m.status) === 'Approved'
        ).length;
        
        // MD Stats
        const totalMD = this.mdData.length;
        const activeMD = this.mdData.filter(d => 
            (d.Status || d.status) === 'Active' || (d.Status || d.status) === 'In Progress'
        ).length;
        const completedMD = this.mdData.filter(d => 
            (d.Status || d.status) === 'Completed' || (d.Status || d.status) === 'Implemented'
        ).length;
        
        // Compliance Rate
        const complianceRate = totalTemuan > 0 ? 
            Math.round(((closedTemuan + verifiedTemuan) / totalTemuan) * 100) : 100;
        
        // OTP Approval Rate
        const approvalRate = totalOTP > 0 ? 
            Math.round((approvedOTP / (approvedOTP + rejectedOTP || 1)) * 100) : 0;
        
        return {
            totalOTP, approvedOTP, rejectedOTP, pendingOTP, draftOTP, otpByDept, approvalRate,
            totalTemuan, openTemuan, inProgressTemuan, closedTemuan, verifiedTemuan, 
            overdueTemuan, temuanByKategori, temuanByDept, complianceRate,
            totalMR, completedMR, totalMD, activeMD, completedMD
        };
    }

    getDepartmentList() {
        const departments = new Set();
        [...this.otpData, ...this.temuanData].forEach(item => {
            const dept = item.Department || item.department;
            if (dept) departments.add(dept);
        });
        return Array.from(departments).sort();
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
            console.error('HSE Reports render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const stats = this.getStats();
        const departments = this.getDepartmentList();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">HSE Reports</h1>
                    <p class="breadcrumb">Home / Reports / <span>HSE Reports</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-primary" data-action="reportsHSE.printReport">
                        <i class="bi bi-printer"></i> Print
                    </button>
                    <button class="btn btn-outline-primary" id="refreshHSEReportsBtn" data-action="reportsHSE.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            <!-- Info Banner -->
            <div class="app-card mb-md" style="background: #eff6ff; border-left: 4px solid var(--info);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-shield-check" style="color: var(--info); font-size: 1.5rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">HSE Management Reports</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Laporan komprehensif seluruh departemen. 
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
                            <select id="hseReportYearFilter" class="form-select">
                                <option value="2024" ${this.selectedYear === '2024' ? 'selected' : ''}>2024</option>
                                <option value="2025" ${this.selectedYear === '2025' ? 'selected' : ''}>2025</option>
                                <option value="2026" ${this.selectedYear === '2026' ? 'selected' : ''}>2026</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Filter Departemen</label>
                            <select id="hseReportDeptFilter" class="form-select">
                                <option value="">Semua Departemen</option>
                                ${departments.map(dept => `
                                    <option value="${this.escapeHtml(dept)}" ${this.selectedDept === dept ? 'selected' : ''}>${this.escapeHtml(dept)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group-custom">
                            <label>Tab Laporan</label>
                            <div class="d-flex gap-xs mt-1" id="hseReportTabButtons">
                                <button class="btn btn-sm tab-btn ${this.activeTab === 'overview' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="overview">
                                    <i class="bi bi-speedometer2"></i> Overview
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeTab === 'otp' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="otp">
                                    <i class="bi bi-clipboard-check"></i> OTP
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeTab === 'temuan' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="temuan">
                                    <i class="bi bi-exclamation-triangle"></i> Temuan
                                </button>
                                <button class="btn btn-sm tab-btn ${this.activeTab === 'compliance' ? 'btn-primary' : 'btn-outline-primary'}" 
                                        data-tab="compliance">
                                    <i class="bi bi-check2-circle"></i> Compliance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab Content Container -->
            <div id="hseReportTabContent">
                ${this.renderTabContent(stats)}
            </div>
        `;
    }

    renderTabContent(stats) {
        if (this.activeTab === 'overview') {
            return this.renderOverviewTab(stats);
        } else if (this.activeTab === 'otp') {
            return this.renderOTPTab(stats);
        } else if (this.activeTab === 'temuan') {
            return this.renderTemuanTab(stats);
        } else if (this.activeTab === 'compliance') {
            return this.renderComplianceTab(stats);
        }
        return '';
    }

    renderOverviewTab(stats) {
        return `
            <!-- Key Metrics Row -->
            <div class="row mb-md">
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${stats.totalOTP}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">${stats.totalTemuan}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Temuan</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--info);">${stats.totalMR}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Mgmt Review</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: #6366f1;">${stats.totalMD}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Mgmt Decision</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${stats.approvalRate}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Approval Rate</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid ${stats.complianceRate >= 80 ? 'var(--success)' : stats.complianceRate >= 50 ? 'var(--warning)' : 'var(--danger)'};">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: ${stats.complianceRate >= 80 ? 'var(--success)' : stats.complianceRate >= 50 ? 'var(--warning)' : 'var(--danger)'};">${stats.complianceRate}%</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Compliance</div>
                    </div>
                </div>
            </div>

            <!-- Performance Gauges -->
            <div class="row mb-md">
                <div class="col-md-6 mb-sm">
                    <div class="app-card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-clipboard-check"></i> OTP Performance</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 8px;">
                                <span>Approved</span><span style="font-weight: 600; color: var(--success);">${stats.approvedOTP}</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px; margin-bottom: 12px;">
                                <div style="width: ${stats.totalOTP > 0 ? (stats.approvedOTP / stats.totalOTP * 100) : 0}%; background: var(--success); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 8px;">
                                <span>Pending</span><span style="font-weight: 600; color: var(--warning);">${stats.pendingOTP + stats.draftOTP}</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px; margin-bottom: 12px;">
                                <div style="width: ${stats.totalOTP > 0 ? ((stats.pendingOTP + stats.draftOTP) / stats.totalOTP * 100) : 0}%; background: var(--warning); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 8px;">
                                <span>Rejected</span><span style="font-weight: 600; color: var(--danger);">${stats.rejectedOTP}</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                                <div style="width: ${stats.totalOTP > 0 ? (stats.rejectedOTP / stats.totalOTP * 100) : 0}%; background: var(--danger); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-sm">
                    <div class="app-card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-exclamation-triangle"></i> Temuan Status</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 8px;">
                                <span>Open</span><span style="font-weight: 600; color: var(--danger);">${stats.openTemuan}</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px; margin-bottom: 12px;">
                                <div style="width: ${stats.totalTemuan > 0 ? (stats.openTemuan / stats.totalTemuan * 100) : 0}%; background: var(--danger); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 8px;">
                                <span>In Progress</span><span style="font-weight: 600; color: var(--warning);">${stats.inProgressTemuan}</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px; margin-bottom: 12px;">
                                <div style="width: ${stats.totalTemuan > 0 ? (stats.inProgressTemuan / stats.totalTemuan * 100) : 0}%; background: var(--warning); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 8px;">
                                <span>Closed/Verified</span><span style="font-weight: 600; color: var(--success);">${stats.closedTemuan + stats.verifiedTemuan}</span>
                            </div>
                            <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 10px;">
                                <div style="width: ${stats.totalTemuan > 0 ? ((stats.closedTemuan + stats.verifiedTemuan) / stats.totalTemuan * 100) : 0}%; background: var(--success); height: 100%; border-radius: var(--radius-pill);"></div>
                            </div>
                            ${stats.overdueTemuan > 0 ? `
                                <div style="margin-top: 12px; padding: 8px; background: #fff5f5; border-radius: var(--radius-md); text-align: center;">
                                    <span style="color: var(--danger); font-weight: 600;">
                                        <i class="bi bi-exclamation-triangle-fill"></i> ${stats.overdueTemuan} Temuan Overdue!
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Department Performance Table -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-building"></i> Performance per Departemen</h3>
                </div>
                <div class="table-wrapper">
                    ${this.renderDepartmentTable(stats)}
                </div>
            </div>
        `;
    }

    renderDepartmentTable(stats) {
        const allDepts = new Set([
            ...Object.keys(stats.otpByDept),
            ...Object.keys(stats.temuanByDept)
        ]);
        
        if (allDepts.size === 0) {
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
                        <th class="text-center">Temuan Open</th>
                        <th class="text-center">Compliance %</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(allDepts).sort().map(dept => {
                        const otpDept = stats.otpByDept[dept] || { total: 0, approved: 0, rejected: 0 };
                        const temuanDept = stats.temuanByDept[dept] || { total: 0, open: 0, closed: 0 };
                        const approvalPct = otpDept.total > 0 ? Math.round((otpDept.approved / otpDept.total) * 100) : 0;
                        const compliancePct = temuanDept.total > 0 ? Math.round((temuanDept.closed / temuanDept.total) * 100) : 100;
                        
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
                                    <span class="badge-status ${compliancePct >= 80 ? 'success' : compliancePct >= 50 ? 'warning' : 'danger'}">${compliancePct}%</span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    renderOTPTab(stats) {
        return `
            <div class="row mb-md">
                <div class="col-md-4 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${stats.totalOTP}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-4 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${stats.approvedOTP}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Approved</div>
                    </div>
                </div>
                <div class="col-md-4 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">${stats.pendingOTP + stats.draftOTP}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Pending (Submit + Draft)</div>
                    </div>
                </div>
            </div>

            <!-- OTP by Department Chart -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-bar-chart"></i> OTP per Departemen</h3>
                </div>
                <div style="padding: var(--space-md); max-height: 400px; overflow-y: auto;">
                    ${Object.entries(stats.otpByDept)
                        .sort(([, a], [, b]) => b.total - a.total)
                        .map(([dept, data]) => {
                            const maxTotal = Math.max(...Object.values(stats.otpByDept).map(d => d.total), 1);
                            const barWidth = (data.total / maxTotal) * 100;
                            const approvedWidth = data.total > 0 ? (data.approved / data.total) * barWidth : 0;
                            
                            return `
                                <div style="margin-bottom: 12px;">
                                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                                        <span>${this.escapeHtml(dept)}</span>
                                        <span style="font-weight: 600;">${data.approved}/${data.total}</span>
                                    </div>
                                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 20px; position: relative; overflow: hidden;">
                                        <div style="width: ${barWidth}%; background: var(--primary-light); height: 100%; position: absolute; border-radius: var(--radius-pill);"></div>
                                        <div style="width: ${approvedWidth}%; background: var(--success); height: 100%; position: absolute; border-radius: var(--radius-pill);"></div>
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
                            </tr>
                        </thead>
                        <tbody>
                            ${[...this.otpData]
                                .sort((a, b) => new Date(b.Created_Date || b.createdDate || b.CreatedAt || b.createdAt || 0) - new Date(a.Created_Date || a.createdDate || a.CreatedAt || a.createdAt || 0))
                                .slice(0, 10)
                                .map(o => `
                                    <tr>
                                        <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(o.OTP_ID || o.otpId || '-')}</code></td>
                                        <td>${this.escapeHtml(o.Department || o.department || '-')}</td>
                                        <td class="col-wrap">${this.escapeHtml((o.Objective || o.objective || '').substring(0, 60))}</td>
                                        <td>${this.escapeHtml(o.Owner || o.owner || '-')}</td>
                                        <td>${this.getStatusBadge(o.Status || o.status)}</td>
                                    </tr>
                                `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderTemuanTab(stats) {
        return `
            <div class="row mb-md">
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${stats.totalTemuan}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Temuan</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">${stats.openTemuan + stats.inProgressTemuan}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Open + In Progress</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${stats.closedTemuan + stats.verifiedTemuan}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Closed + Verified</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid #ef4444; ${stats.overdueTemuan > 0 ? 'animation: pulse 2s infinite;' : ''}">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: #ef4444;">${stats.overdueTemuan}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Overdue</div>
                    </div>
                </div>
            </div>

            <!-- Kategori Temuan -->
            <div class="row">
                <div class="col-md-6 mb-sm">
                    <div class="app-card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-tag"></i> Kategori Temuan</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            ${Object.entries(stats.temuanByKategori)
                                .sort(([, a], [, b]) => b - a)
                                .map(([kat, count]) => `
                                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-light);">
                                        <span>${this.escapeHtml(kat)}</span>
                                        <span class="badge-status ${this.getKategoriBadgeType(kat)}">${count}</span>
                                    </div>
                                `).join('')}
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-sm">
                    <div class="app-card">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-building"></i> Temuan per Departemen</h3>
                        </div>
                        <div style="padding: var(--space-md); max-height: 300px; overflow-y: auto;">
                            ${Object.entries(stats.temuanByDept)
                                .sort(([, a], [, b]) => b.open - a.open)
                                .map(([dept, data]) => `
                                    <div style="margin-bottom: 12px;">
                                        <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm); margin-bottom: 4px;">
                                            <span>${this.escapeHtml(dept)}</span>
                                            <span style="font-weight: 600; color: ${data.open > 0 ? 'var(--danger)' : 'var(--success)'};">${data.open} open</span>
                                        </div>
                                        <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px;">
                                            <div style="width: ${data.total > 0 ? (data.open / data.total * 100) : 0}%; background: var(--danger); height: 100%; border-radius: var(--radius-pill);"></div>
                                        </div>
                                    </div>
                                `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderComplianceTab(stats) {
        return `
            <div class="row mb-md">
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: ${stats.complianceRate >= 80 ? 'var(--success)' : stats.complianceRate >= 50 ? 'var(--warning)' : 'var(--danger)'};">
                            ${stats.complianceRate}%
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Overall Compliance Rate</div>
                    </div>
                </div>
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--info);">${stats.totalMR}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Management Reviews</div>
                        <div style="font-size: var(--fs-xs); color: var(--text-light);">${stats.completedMR} completed</div>
                    </div>
                </div>
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: #6366f1;">${stats.totalMD}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Management Decisions</div>
                        <div style="font-size: var(--fs-xs); color: var(--text-light);">${stats.activeMD} active, ${stats.completedMD} done</div>
                    </div>
                </div>
            </div>

            <!-- Compliance Summary -->
            <div class="app-card mb-md">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-check2-square"></i> Compliance Summary</h3>
                </div>
                <div style="padding: var(--space-md);">
                    <div class="row">
                        <div class="col-md-6">
                            <div style="margin-bottom: 24px;">
                                <h4 style="font-size: var(--fs-sm); color: var(--text-light); margin-bottom: 12px;">
                                    <i class="bi bi-clipboard-check" style="color: var(--success);"></i> OTP Status
                                </h4>
                                <div style="background: #f0fdf4; padding: 16px; border-radius: var(--radius-md);">
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Total OTP:</span><strong>${stats.totalOTP}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Approved:</span><strong style="color: var(--success);">${stats.approvedOTP}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Pending:</span><strong style="color: var(--warning);">${stats.pendingOTP + stats.draftOTP}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Rejected:</span><strong style="color: var(--danger);">${stats.rejectedOTP}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div style="margin-bottom: 24px;">
                                <h4 style="font-size: var(--fs-sm); color: var(--text-light); margin-bottom: 12px;">
                                    <i class="bi bi-exclamation-triangle" style="color: var(--warning);"></i> Temuan Status
                                </h4>
                                <div style="background: #fffbeb; padding: 16px; border-radius: var(--radius-md);">
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Total Temuan:</span><strong>${stats.totalTemuan}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Resolved:</span><strong style="color: var(--success);">${stats.closedTemuan + stats.verifiedTemuan}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Unresolved:</span><strong style="color: var(--danger);">${stats.openTemuan + stats.inProgressTemuan}</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span>Overdue:</span><strong style="color: #ef4444;">${stats.overdueTemuan}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MR/MD Progress -->
                    <div>
                        <h4 style="font-size: var(--fs-sm); color: var(--text-light); margin-bottom: 12px;">
                            <i class="bi bi-clipboard-data" style="color: var(--info);"></i> Management Review & Decision Progress
                        </h4>
                        <div style="background: #eff6ff; padding: 16px; border-radius: var(--radius-md);">
                            <div style="display: flex; justify-content: space-between;">
                                <span>Management Review Completed:</span><strong>${stats.completedMR} / ${stats.totalMR || 0}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Management Decision Completed:</span><strong>${stats.completedMD} / ${stats.totalMD || 0}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // ACTION METHODS (DIPERBAIKI)
    // ============================================
    
    async switchTab(params) {
        this.activeTab = params.tab || 'overview';
        
        // Update tab button visuals
        const tabButtons = document.querySelectorAll('#hseReportTabButtons .tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-primary');
        });
        const activeBtn = document.querySelector(`#hseReportTabButtons .tab-btn[data-tab="${this.activeTab}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('btn-outline-primary');
            activeBtn.classList.add('btn-primary');
        }
        
        await this.updateTabContentOnly();
    }

    async updateTabContentOnly() {
        const tabContainer = document.getElementById('hseReportTabContent');
        if (!tabContainer) return;
        
        tabContainer.style.opacity = '0';
        tabContainer.style.transform = 'translateY(8px)';
        tabContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const stats = this.getStats();
        tabContainer.innerHTML = this.renderTabContent(stats);
        
        requestAnimationFrame(() => {
            tabContainer.style.opacity = '1';
            tabContainer.style.transform = 'translateY(0)';
        });
        
        this.attachTabButtonEvents();
    }

    async filterYear() {
        const el = document.getElementById('hseReportYearFilter');
        if (el) this.selectedYear = el.value;
        await this.updateTabContentOnly();
    }

    async filterDepartment() {
        const el = document.getElementById('hseReportDeptFilter');
        if (el) this.selectedDept = el.value;
        await this.updateTabContentOnly();
    }

    async refresh() {
        const refreshBtn = document.getElementById('refreshHSEReportsBtn');
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
            toast('Laporan HSE berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data laporan', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> <span>Refresh</span>';
            }
        }
    }

    async printReport() {
        window.print();
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================
    
    afterRender() {
        this.attachFilterEvents();
        this.attachTabButtonEvents();
    }

    attachFilterEvents() {
        const yearFilter = document.getElementById('hseReportYearFilter');
        if (yearFilter) {
            const newEl = yearFilter.cloneNode(true);
            yearFilter.parentNode.replaceChild(newEl, yearFilter);
            newEl.addEventListener('change', () => this.filterYear());
        }
        
        const deptFilter = document.getElementById('hseReportDeptFilter');
        if (deptFilter) {
            const newEl = deptFilter.cloneNode(true);
            deptFilter.parentNode.replaceChild(newEl, deptFilter);
            newEl.addEventListener('change', () => this.filterDepartment());
        }
    }

    attachTabButtonEvents() {
        const tabButtons = document.querySelectorAll('#hseReportTabButtons .tab-btn');
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
    
    getStatusBadge(status) {
        const badges = {
            'Draft': 'warning', 'Submitted': 'info', 'In Review': 'info',
            'Approved': 'success', 'Rejected': 'danger', 'Revision Requested': 'warning'
        };
        const label = status || 'Draft';
        const type = badges[label] || 'default';
        return `<span class="badge-status ${type}">${label}</span>`;
    }

    getKategoriBadgeType(value) {
        const types = {
            'Ketidaksesuaian': 'danger', 'Observasi': 'warning', 'OFI': 'info', 'Positif': 'success'
        };
        return types[value] || 'default';
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
                        <h1 class="page-title">HSE Reports</h1>
                        <p class="breadcrumb">Home / Reports / <span>HSE Reports</span></p>
                    </div>
                </div>
                <div class="app-card">
                    <div class="empty-state">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <h3 class="mt-md">Memuat Data Laporan HSE...</h3>
                        <p>Mengambil data dari seluruh departemen</p>
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
                    <h1 class="page-title">HSE Reports</h1>
                    <p class="breadcrumb">Home / Reports / <span>HSE Reports</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Laporan</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                    <button class="btn btn-primary mt-md" data-action="reportsHSE.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}