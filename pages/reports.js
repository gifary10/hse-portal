// pages/reports.js
// Reports Page - Laporan untuk Department User
// Menampilkan ringkasan OTP department, temuan, dan progress

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class ReportsPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.isLoading = false;
        this.isRefreshing = false;
        
        // Data
        this.otpData = [];
        this.temuanData = [];
        this.iadlData = [];
        
        // Filter
        this.selectedYear = new Date().getFullYear().toString();
        this.selectedPeriod = '';
        
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
            console.error(`Reports fetch ${action} error:`, error);
            return { status: 'error', data: [], total: 0, message: error.message };
        }
    }

    async loadReportData() {
        const user = this.state.currentUser;
        const userDept = user?.department || '';
        
        try {
            // Fetch data berdasarkan department user
            const [otpResult, temuanResult] = await Promise.all([
                this.fetchFromSheets('getOTPByDept', { department: userDept }),
                this.fetchFromSheets('getTemuanByDept', { department: userDept })
            ]);
            
            this.otpData = otpResult.data || [];
            this.temuanData = temuanResult.data || [];
            this.lastFetchTime = new Date();
            
        } catch (error) {
            console.error('Failed to load report data:', error);
            throw error;
        }
    }

    // ============================================
    // CALCULATIONS
    // ============================================
    
    filterByYear(data, yearField = 'year') {
        if (!this.selectedYear) return data;
        return data.filter(item => {
            const year = item.Year || item.year || item[yearField];
            return year && year.toString() === this.selectedYear;
        });
    }
    
    filterByPeriod(data) {
        if (!this.selectedPeriod) return data;
        
        return data.filter(item => {
            const timeline = item.Timeline || item.timeline || '';
            return timeline === this.selectedPeriod || timeline === 'Full Year';
        });
    }

    getOTPStats() {
        let filtered = this.filterByYear(this.otpData);
        filtered = this.filterByPeriod(filtered);
        
        const total = filtered.length;
        const approved = filtered.filter(o => (o.Status || o.status) === 'Approved').length;
        const rejected = filtered.filter(o => (o.Status || o.status) === 'Rejected').length;
        const submitted = filtered.filter(o => (o.Status || o.status) === 'Submitted').length;
        const draft = filtered.filter(o => (o.Status || o.status) === 'Draft').length;
        
        // Hitung total weight
        const totalWeight = filtered.reduce((sum, o) => {
            const weight = parseFloat(o.Weight || o.weight || 0);
            return sum + (isNaN(weight) ? 0 : weight);
        }, 0);
        
        return { total, approved, rejected, submitted, draft, totalWeight };
    }
    
    getTemuanStats() {
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
        
        // Overdue
        const overdue = filtered.filter(t => {
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            const status = t.Status || t.status;
            if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
            return new Date(targetSelesai) < new Date();
        }).length;
        
        return { total, open, inProgress, closed, verified, overdue };
    }

    getMonthlyOTPData() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthlyData = Array(12).fill(0).map(() => ({ created: 0, approved: 0 }));
        
        this.otpData.forEach(o => {
            const year = (o.Year || o.year || '').toString();
            if (year !== this.selectedYear) return;
            
            const dateStr = o.Created_Date || o.createdDate || o.CreatedAt || o.createdAt;
            if (!dateStr) return;
            
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return;
            
            const month = date.getMonth();
            monthlyData[month].created++;
            
            if ((o.Status || o.status) === 'Approved') {
                monthlyData[month].approved++;
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
            await this.loadReportData();
            this.hideLoading();
            return this.renderHTML();
        } catch (error) {
            console.error('Reports render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const user = this.state.currentUser || {};
        const otpStats = this.getOTPStats();
        const temuanStats = this.getTemuanStats();
        const monthlyData = this.getMonthlyOTPData();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Reports</h1>
                    <p class="breadcrumb">Home / <span>Reports</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-primary" data-action="reports.printReport">
                        <i class="bi bi-printer"></i> Print
                    </button>
                    <button class="btn btn-outline-primary" id="refreshReportsBtn" data-action="reports.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            <!-- Info Banner -->
            <div class="app-card mb-md" style="background: #f0fdf4; border-left: 4px solid var(--success);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-info-circle-fill" style="color: var(--success); font-size: 1.2rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">Laporan Departemen: ${this.escapeHtml(user.department || 'All')}</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Ringkasan OTP dan temuan audit internal departemen Anda.
                            ${this.lastFetchTime ? `Data diperbarui: ${this.formatTime(this.lastFetchTime)}` : ''}
                        </p>
                    </div>
                </div>
            </div>

            <!-- Filter Section -->
            <div class="filter-section">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="reportYearFilter" class="form-select">
                                <option value="2024" ${this.selectedYear === '2024' ? 'selected' : ''}>2024</option>
                                <option value="2025" ${this.selectedYear === '2025' ? 'selected' : ''}>2025</option>
                                <option value="2026" ${this.selectedYear === '2026' ? 'selected' : ''}>2026</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-clock"></i> Periode</label>
                            <select id="reportPeriodFilter" class="form-select">
                                <option value="">Semua Periode</option>
                                <option value="Q1" ${this.selectedPeriod === 'Q1' ? 'selected' : ''}>Q1 (Jan-Mar)</option>
                                <option value="Q2" ${this.selectedPeriod === 'Q2' ? 'selected' : ''}>Q2 (Apr-Jun)</option>
                                <option value="Q3" ${this.selectedPeriod === 'Q3' ? 'selected' : ''}>Q3 (Jul-Sep)</option>
                                <option value="Q4" ${this.selectedPeriod === 'Q4' ? 'selected' : ''}>Q4 (Okt-Des)</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label>Ringkasan</label>
                            <div class="mt-2">
                                <span class="badge-status info">
                                    <i class="bi bi-database"></i> ${otpStats.total} OTP, ${temuanStats.total} Temuan
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stats Cards -->
            <div class="row mb-md">
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">
                            <i class="bi bi-clipboard-check"></i> ${otpStats.total}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">
                            ${otpStats.approved}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">OTP Approved</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">
                            ${temuanStats.open + temuanStats.inProgress}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Temuan Aktif</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">
                            ${temuanStats.overdue}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Overdue</div>
                    </div>
                </div>
            </div>

            <!-- Progress Overview -->
            <div class="row">
                <div class="col-md-8">
                    <!-- Monthly Progress Chart (Simple Bar) -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-graph-up"></i> Progress OTP Bulanan (${this.selectedYear})</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            ${this.renderMonthlyChart(monthlyData)}
                        </div>
                    </div>

                    <!-- OTP Detail Table -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-list-check"></i> Detail OTP</h3>
                        </div>
                        <div class="table-wrapper">
                            ${this.renderOTPTable()}
                        </div>
                    </div>
                </div>

                <div class="col-md-4">
                    <!-- OTP Status Distribution -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-pie-chart"></i> Status OTP</h3>
                        </div>
                        ${otpStats.total > 0 ? this.renderOTPStatusDistribution(otpStats) : `
                            <p style="text-align: center; color: var(--text-muted); padding: var(--space-md);">Belum ada data OTP</p>
                        `}
                    </div>

                    <!-- Temuan Status -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-pie-chart"></i> Status Temuan</h3>
                        </div>
                        ${temuanStats.total > 0 ? this.renderTemuanStatusDistribution(temuanStats) : `
                            <p style="text-align: center; color: var(--text-muted); padding: var(--space-md);">Belum ada temuan</p>
                        `}
                    </div>

                    <!-- Alerts -->
                    ${temuanStats.overdue > 0 ? `
                    <div class="app-card" style="background: #fff5f5; border-left: 4px solid var(--danger);">
                        <div class="card-header">
                            <h3 class="card-title" style="color: var(--danger);">
                                <i class="bi bi-exclamation-triangle-fill"></i> Perhatian
                            </h3>
                        </div>
                        <p style="font-size: var(--fs-sm); color: var(--danger);">
                            <strong>${temuanStats.overdue}</strong> temuan sudah melewati batas waktu penyelesaian!
                        </p>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- Export Section -->
            <div class="app-card mt-md" style="background: #f8fafc;">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-download"></i> Export Laporan</h3>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" data-action="reports.exportCSV">
                        <i class="bi bi-file-earmark-spreadsheet"></i> Export CSV
                    </button>
                    <button class="btn btn-outline-primary" data-action="reports.printReport">
                        <i class="bi bi-printer"></i> Print
                    </button>
                </div>
            </div>
        `;
    }

    renderMonthlyChart(monthlyData) {
        const maxValue = Math.max(...monthlyData.data.map(d => d.created), 1);
        
        return `
            <div style="display: flex; align-items: flex-end; gap: 4px; height: 200px; padding: 0 8px;">
                ${monthlyData.months.map((month, i) => {
                    const heightPercent = (monthlyData.data[i].created / maxValue) * 100;
                    const approvedPercent = monthlyData.data[i].created > 0 ? 
                        (monthlyData.data[i].approved / monthlyData.data[i].created) * 100 : 0;
                    
                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                            <div style="flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center;">
                                <div style="width: 70%; height: ${heightPercent}%; background: linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%); 
                                            border-radius: 4px 4px 0 0; position: relative; min-height: 2px;"
                                     title="Created: ${monthlyData.data[i].created}, Approved: ${monthlyData.data[i].approved}">
                                    ${monthlyData.data[i].approved > 0 ? `
                                        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: ${approvedPercent}%; 
                                                    background: var(--success); border-radius: 4px 4px 0 0; opacity: 0.7;">
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px; transform: rotate(-45deg); transform-origin: top left; white-space: nowrap;">
                                ${month}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="display: flex; gap: 16px; justify-content: center; margin-top: 24px; font-size: var(--fs-xs);">
                <span><span style="display: inline-block; width: 12px; height: 12px; background: var(--primary); border-radius: 2px; vertical-align: middle; margin-right: 4px;"></span> Total OTP</span>
                <span><span style="display: inline-block; width: 12px; height: 12px; background: var(--success); border-radius: 2px; vertical-align: middle; margin-right: 4px;"></span> Approved</span>
            </div>
        `;
    }

    renderOTPTable() {
        let filtered = this.filterByYear(this.otpData);
        filtered = this.filterByPeriod(filtered);
        
        // Sort by date descending
        filtered.sort((a, b) => {
            const dateA = new Date(a.Created_Date || a.createdDate || a.CreatedAt || a.createdAt || 0);
            const dateB = new Date(b.Created_Date || b.createdDate || b.CreatedAt || b.createdAt || 0);
            return dateB - dateA;
        });
        
        const displayData = filtered.slice(0, 10); // Show top 10
        
        if (displayData.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <h3>Tidak ada OTP</h3>
                    <p>Belum ada OTP untuk filter yang dipilih</p>
                </div>
            `;
        }
        
        return `
            <table class="data-table striped condensed">
                <thead>
                    <tr>
                        <th>OTP ID</th>
                        <th>Objective</th>
                        <th>Target</th>
                        <th>Owner</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${displayData.map(o => `
                        <tr>
                            <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(o.OTP_ID || o.otpId || '-')}</code></td>
                            <td class="col-wrap">${this.escapeHtml((o.Objective || o.objective || '').substring(0, 60))}</td>
                            <td><strong>${this.escapeHtml(o.Target || o.target || '-')}</strong></td>
                            <td>${this.escapeHtml(o.Owner || o.owner || '-')}</td>
                            <td>${this.getStatusBadge(o.Status || o.status)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderOTPStatusDistribution(stats) {
        const total = stats.total || 1;
        
        return `
            <div style="padding: var(--space-md);">
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>Approved</span>
                        <span style="color: var(--success); font-weight: 600;">${stats.approved} (${Math.round(stats.approved / total * 100)}%)</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px; margin-top: 4px;">
                        <div style="width: ${(stats.approved / total) * 100}%; background: var(--success); height: 100%; border-radius: var(--radius-pill);"></div>
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>Submitted</span>
                        <span style="color: var(--info); font-weight: 600;">${stats.submitted} (${Math.round(stats.submitted / total * 100)}%)</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px; margin-top: 4px;">
                        <div style="width: ${(stats.submitted / total) * 100}%; background: var(--info); height: 100%; border-radius: var(--radius-pill);"></div>
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>Draft</span>
                        <span style="color: var(--warning); font-weight: 600;">${stats.draft} (${Math.round(stats.draft / total * 100)}%)</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px; margin-top: 4px;">
                        <div style="width: ${(stats.draft / total) * 100}%; background: var(--warning); height: 100%; border-radius: var(--radius-pill);"></div>
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>Rejected</span>
                        <span style="color: var(--danger); font-weight: 600;">${stats.rejected} (${Math.round(stats.rejected / total * 100)}%)</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px; margin-top: 4px;">
                        <div style="width: ${(stats.rejected / total) * 100}%; background: var(--danger); height: 100%; border-radius: var(--radius-pill);"></div>
                    </div>
                </div>
                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-light);">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>Total Weight</span>
                        <span style="font-weight: 700;">${stats.totalWeight}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderTemuanStatusDistribution(stats) {
        const total = stats.total || 1;
        
        return `
            <div style="padding: var(--space-md);">
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>Open</span>
                        <span style="color: var(--danger); font-weight: 600;">${stats.open}</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px; margin-top: 4px;">
                        <div style="width: ${(stats.open / total) * 100}%; background: var(--danger); height: 100%; border-radius: var(--radius-pill);"></div>
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>In Progress</span>
                        <span style="color: var(--warning); font-weight: 600;">${stats.inProgress}</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px; margin-top: 4px;">
                        <div style="width: ${(stats.inProgress / total) * 100}%; background: var(--warning); height: 100%; border-radius: var(--radius-pill);"></div>
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>Closed</span>
                        <span style="color: var(--success); font-weight: 600;">${stats.closed}</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px; margin-top: 4px;">
                        <div style="width: ${(stats.closed / total) * 100}%; background: var(--success); height: 100%; border-radius: var(--radius-pill);"></div>
                    </div>
                </div>
                <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: var(--fs-sm);">
                        <span>Verified</span>
                        <span style="color: var(--info); font-weight: 600;">${stats.verified}</span>
                    </div>
                    <div style="background: #e5e7eb; border-radius: var(--radius-pill); height: 8px; margin-top: 4px;">
                        <div style="width: ${(stats.verified / total) * 100}%; background: var(--info); height: 100%; border-radius: var(--radius-pill);"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // ACTION METHODS
    // ============================================
    
    async filterYear() {
        const el = document.getElementById('reportYearFilter');
        if (el) this.selectedYear = el.value;
        await this.updateReportOnly();
    }
    
    async filterPeriod() {
        const el = document.getElementById('reportPeriodFilter');
        if (el) this.selectedPeriod = el.value;
        await this.updateReportOnly();
    }

    async refresh() {
        const refreshBtn = document.getElementById('refreshReportsBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.otpData = [];
        this.temuanData = [];
        
        try {
            await this.loadReportData();
            this.isRefreshing = true;
            
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = this.renderHTML();
                this.afterRender();
            }
            
            this.isRefreshing = false;
            toast('Laporan berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data laporan', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> <span>Refresh</span>';
            }
        }
    }

    async exportCSV() {
        const otpStats = this.getOTPStats();
        const temuanStats = this.getTemuanStats();
        
        let csv = 'Kategori,Total\n';
        csv += `Total OTP,${otpStats.total}\n`;
        csv += `OTP Approved,${otpStats.approved}\n`;
        csv += `OTP Submitted,${otpStats.submitted}\n`;
        csv += `OTP Draft,${otpStats.draft}\n`;
        csv += `OTP Rejected,${otpStats.rejected}\n`;
        csv += `\n`;
        csv += `Total Temuan,${temuanStats.total}\n`;
        csv += `Temuan Open,${temuanStats.open}\n`;
        csv += `Temuan In Progress,${temuanStats.inProgress}\n`;
        csv += `Temuan Closed,${temuanStats.closed}\n`;
        csv += `Temuan Verified,${temuanStats.verified}\n`;
        csv += `Temuan Overdue,${temuanStats.overdue}\n`;
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `report_department_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        toast('Laporan berhasil diexport ke CSV', 'success');
    }

    async printReport() {
        window.print();
    }

    async updateReportOnly() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = this.renderHTML();
            this.afterRender();
        }
    }

    afterRender() {
        const yearFilter = document.getElementById('reportYearFilter');
        if (yearFilter) {
            yearFilter.addEventListener('change', () => this.filterYear());
        }
        
        const periodFilter = document.getElementById('reportPeriodFilter');
        if (periodFilter) {
            periodFilter.addEventListener('change', () => this.filterPeriod());
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
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
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="page-header">
                    <div class="page-header-left">
                        <h1 class="page-title">Reports</h1>
                        <p class="breadcrumb">Home / <span>Reports</span></p>
                    </div>
                </div>
                <div class="app-card">
                    <div class="empty-state">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <h3 class="mt-md">Memuat Data Laporan...</h3>
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
                    <h1 class="page-title">Reports</h1>
                    <p class="breadcrumb">Home / <span>Reports</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Laporan</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                    <button class="btn btn-primary mt-md" data-action="reports.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}