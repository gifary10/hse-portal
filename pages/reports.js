// pages/reports.js
// Reports Page - Dengan Partial Update untuk filter

import { toast } from '../ui/components.js';
import { BasePage } from '../core/base-page.js';
import { getStatusBadge, formatDate, formatTime, escapeHtml, setButtonLoading, downloadAsCSV } from '../ui/utils.js';

export class ReportsPage extends BasePage {
    constructor(state, db, router) {
        super(state, db, router, 'reports');
        
        // Additional filters specific to Reports
        this.selectedPeriod = '';
    }

    // ============================================
    // DATA LOADING
    // ============================================
    
    async loadData() {
        const user = this.state.currentUser;
        const userDept = user?.department || '';
        
        const [otpResult, temuanResult] = await Promise.all([
            this.fetchFromSheets('getOTPByDept', { department: userDept }),
            this.fetchFromSheets('getTemuanByDept', { department: userDept })
        ]);
        
        this.allData = {
            otp: otpResult.data || [],
            temuan: temuanResult.data || []
        };
        
        this.lastFetchTime = new Date();
    }

    formatOTPData(item) {
        if (!item) return {};
        
        return {
            otpId: item.OTP_ID || item.otpId || '',
            department: item.Department || item.department || '',
            year: item.Year || item.year || '',
            objective: item.Objective || item.objective || '',
            kpiCode: item.KPI_Code || item.kpiCode || '',
            kpiName: item.KPI_Name || item.kpiName || '',
            target: item.Target || item.target || '',
            timeline: item.Timeline || item.timeline || '',
            owner: item.Owner || item.owner || '',
            weight: item.Weight || item.weight || '',
            status: item.Status || item.status || '',
            createdDate: item.Created_Date || item.createdDate || item.CreatedAt || item.createdAt || ''
        };
    }

    formatTemuanData(item) {
        if (!item) return {};
        
        return {
            temuanId: item.Temuan_ID || item.temuanId || '',
            department: item.Department || item.department || '',
            tanggalAudit: item.Tanggal_Audit || item.tanggalAudit || '',
            kategoriTemuan: item.Kategori_Temuan || item.kategoriTemuan || '',
            klasifikasi: item.Klasifikasi || item.klasifikasi || '',
            uraianTemuan: item.Uraian_Temuan || item.uraianTemuan || '',
            status: item.Status || item.status || '',
            targetSelesai: item.Target_Selesai || item.targetSelesai || '',
            createdAt: item.Created_At || item.createdAt || ''
        };
    }

    // ============================================
    // FILTER METHODS
    // ============================================
    
    filterOTPData() {
        let filtered = [...this.allData.otp];
        
        // Filter by year
        if (this.filterYear) {
            filtered = filtered.filter(o => {
                const year = o.Year || o.year;
                return year && year.toString() === this.filterYear;
            });
        }
        
        // Filter by period (timeline)
        if (this.selectedPeriod) {
            filtered = filtered.filter(o => {
                const timeline = o.Timeline || o.timeline || '';
                return timeline === this.selectedPeriod || timeline === 'Full Year';
            });
        }
        
        return filtered;
    }

    filterTemuanData() {
        let filtered = [...this.allData.temuan];
        
        // Filter by year from tanggalAudit
        if (this.filterYear) {
            filtered = filtered.filter(t => {
                const date = t.Tanggal_Audit || t.tanggalAudit || t.Created_At || t.createdAt;
                if (!date) return false;
                return new Date(date).getFullYear().toString() === this.filterYear;
            });
        }
        
        return filtered;
    }

    getOTPStats() {
        const filtered = this.filterOTPData();
        
        const total = filtered.length;
        const approved = filtered.filter(o => (o.Status || o.status) === 'Approved').length;
        const rejected = filtered.filter(o => (o.Status || o.status) === 'Rejected').length;
        const submitted = filtered.filter(o => (o.Status || o.status) === 'Submitted').length;
        const draft = filtered.filter(o => (o.Status || o.status) === 'Draft').length;
        
        const totalWeight = filtered.reduce((sum, o) => {
            const weight = parseFloat(o.Weight || o.weight || 0);
            return sum + (isNaN(weight) ? 0 : weight);
        }, 0);
        
        return { total, approved, rejected, submitted, draft, totalWeight, filtered };
    }
    
    getTemuanStats() {
        const filtered = this.filterTemuanData();
        
        const total = filtered.length;
        const open = filtered.filter(t => (t.Status || t.status) === 'Open').length;
        const inProgress = filtered.filter(t => (t.Status || t.status) === 'In Progress').length;
        const closed = filtered.filter(t => (t.Status || t.status) === 'Closed').length;
        const verified = filtered.filter(t => (t.Status || t.status) === 'Verified').length;
        
        const overdue = filtered.filter(t => {
            const targetSelesai = t.Target_Selesai || t.targetSelesai;
            const status = t.Status || t.status;
            if (!targetSelesai || status === 'Closed' || status === 'Verified') return false;
            return new Date(targetSelesai) < new Date();
        }).length;
        
        return { total, open, inProgress, closed, verified, overdue, filtered };
    }

    getMonthlyData() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthlyData = Array(12).fill(0).map(() => ({ created: 0, approved: 0 }));
        
        this.allData.otp.forEach(o => {
            const year = (o.Year || o.year || '').toString();
            if (year !== this.filterYear) return;
            
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
    // RENDER METHODS
    // ============================================
    
    async render() {
        if (!this.isRefreshing) this.showLoading('Memuat data laporan...');
        
        try {
            if (this.allData.otp?.length === 0 && this.allData.temuan?.length === 0) {
                await this.loadData();
            }
            
            this.hideLoading();
            return this.renderFullPage();
        } catch (error) {
            console.error('Render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderFullPage() {
        const user = this.state.currentUser || {};
        const otpStats = this.getOTPStats();
        const temuanStats = this.getTemuanStats();
        const monthlyData = this.getMonthlyData();
        
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
                        <strong style="color: var(--text);">Laporan Departemen: ${escapeHtml(user.department || 'All')}</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Ringkasan OTP dan temuan audit internal departemen Anda.
                            ${this.lastFetchTime ? `Data diperbarui: ${formatTime(this.lastFetchTime)}` : ''}
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
                            <select id="filterYearReportsInput" class="form-select">
                                <option value="">Semua Tahun</option>
                                <option value="2024" ${this.filterYear === '2024' ? 'selected' : ''}>2024</option>
                                <option value="2025" ${this.filterYear === '2025' ? 'selected' : ''}>2025</option>
                                <option value="2026" ${this.filterYear === '2026' ? 'selected' : ''}>2026</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-clock"></i> Periode</label>
                            <select id="filterPeriodReportsInput" class="form-select">
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
                                ${(this.filterYear || this.selectedPeriod) ? `
                                    <button class="btn btn-sm btn-link" data-action="reports.clearFilters" 
                                            style="margin-left: 4px; padding: 2px 6px;">
                                        <i class="bi bi-x-circle"></i> Clear
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Main Content Container for Partial Update -->
            <div id="reportsContentContainer">
                ${this.renderContentOnly({ otpStats, temuanStats, monthlyData })}
            </div>
        `;
    }

    async renderContentOnly(data) {
        const otpStats = data.otpStats || this.getOTPStats();
        const temuanStats = data.temuanStats || this.getTemuanStats();
        const monthlyData = data.monthlyData || this.getMonthlyData();
        
        return `
            <!-- Stats Cards -->
            <div class="row mb-md" id="reportsStatsCards">
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

            <!-- Main Content Row -->
            <div class="row">
                <div class="col-md-8">
                    <!-- Monthly Progress Chart -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-graph-up"></i> Progress OTP Bulanan (${this.filterYear || 'All Years'})</h3>
                        </div>
                        <div style="padding: var(--space-md);">
                            ${this.renderMonthlyChart(monthlyData)}
                        </div>
                    </div>

                    <!-- OTP Detail Table -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-list-check"></i> Detail OTP</h3>
                            <button class="btn btn-sm btn-outline-primary" data-action="reports.exportCSV">
                                <i class="bi bi-download"></i> Export CSV
                            </button>
                        </div>
                        <div class="table-wrapper">
                            ${this.renderOTPTable(otpStats.filtered)}
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

    renderOTPTable(otpList) {
        const displayData = [...otpList]
            .sort((a, b) => new Date(b.Created_Date || b.createdDate || b.CreatedAt || b.createdAt || 0) - new Date(a.Created_Date || a.createdDate || a.CreatedAt || a.createdAt || 0))
            .slice(0, 10);
        
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
                            <td><code style="font-size: var(--fs-xs);">${escapeHtml(o.OTP_ID || o.otpId || '-')}</code></td>
                            <td class="col-wrap">${escapeHtml((o.Objective || o.objective || '').substring(0, 60))}</td>
                            <td><strong>${escapeHtml(o.Target || o.target || '-')}</strong></td>
                            <td>${escapeHtml(o.Owner || o.owner || '-')}</td>
                            <td>${getStatusBadge(o.Status || o.status, 'otp')}</td>
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
    // ACTION METHODS WITH PARTIAL UPDATE
    // ============================================
    
    async filterYear() {
        const el = document.getElementById('filterYearReportsInput');
        if (el) this.filterYear = el.value;
        await this.updateContentOnly();
    }
    
    async filterPeriod() {
        const el = document.getElementById('filterPeriodReportsInput');
        if (el) this.selectedPeriod = el.value;
        await this.updateContentOnly();
    }

    async clearFilters() {
        this.filterYear = '';
        this.selectedPeriod = '';
        
        setTimeout(() => {
            const yearFilter = document.getElementById('filterYearReportsInput');
            if (yearFilter) yearFilter.value = '';
            
            const periodFilter = document.getElementById('filterPeriodReportsInput');
            if (periodFilter) periodFilter.value = '';
        }, 100);
        
        await this.updateContentOnly();
        toast('Filter dihapus', 'info');
    }

    async updateContentOnly() {
        const container = document.getElementById('reportsContentContainer');
        if (!container) {
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = await this.render();
                this.attachEventListeners();
            }
            return;
        }
        
        // Animate fade out
        container.style.opacity = '0';
        container.style.transform = 'translateY(8px)';
        container.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        
        await this.delay(150);
        
        // Get fresh data
        const otpStats = this.getOTPStats();
        const temuanStats = this.getTemuanStats();
        const monthlyData = this.getMonthlyData();
        
        // Render new content
        container.innerHTML = await this.renderContentOnly({ otpStats, temuanStats, monthlyData });
        
        // Animate fade in
        requestAnimationFrame(() => {
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        });
        
        this.attachEventListeners();
    }

    async refresh() {
        const refreshBtn = document.getElementById('refreshReportsBtn');
        setButtonLoading(refreshBtn, true, 'Memuat...');
        
        this.allData = { otp: [], temuan: [] };
        this.filterYear = '';
        this.selectedPeriod = '';
        
        setTimeout(() => {
            const yearFilter = document.getElementById('filterYearReportsInput');
            if (yearFilter) yearFilter.value = '';
            const periodFilter = document.getElementById('filterPeriodReportsInput');
            if (periodFilter) periodFilter.value = '';
        }, 100);
        
        try {
            await this.loadData();
            this.isRefreshing = true;
            
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = await this.render();
                this.attachEventListeners();
            }
            
            this.isRefreshing = false;
            toast('Laporan berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data laporan', 'error');
        } finally {
            setButtonLoading(refreshBtn, false);
        }
    }

    async exportCSV() {
        const otpStats = this.getOTPStats();
        const temuanStats = this.getTemuanStats();
        
        const csvData = [
            { Kategori: 'Total OTP', Jumlah: otpStats.total },
            { Kategori: 'OTP Approved', Jumlah: otpStats.approved },
            { Kategori: 'OTP Submitted', Jumlah: otpStats.submitted },
            { Kategori: 'OTP Draft', Jumlah: otpStats.draft },
            { Kategori: 'OTP Rejected', Jumlah: otpStats.rejected },
            { Kategori: '', Jumlah: '' },
            { Kategori: 'Total Temuan', Jumlah: temuanStats.total },
            { Kategori: 'Temuan Open', Jumlah: temuanStats.open },
            { Kategori: 'Temuan In Progress', Jumlah: temuanStats.inProgress },
            { Kategori: 'Temuan Closed', Jumlah: temuanStats.closed },
            { Kategori: 'Temuan Verified', Jumlah: temuanStats.verified },
            { Kategori: 'Temuan Overdue', Jumlah: temuanStats.overdue }
        ];
        
        downloadAsCSV(csvData, `report_department_${new Date().toISOString().split('T')[0]}.csv`);
        toast('Laporan berhasil diexport ke CSV', 'success');
    }

    async printReport() {
        window.print();
    }

    // Override attachEventListeners
    attachEventListeners() {
        const yearFilter = document.getElementById('filterYearReportsInput');
        if (yearFilter) {
            const newFilter = yearFilter.cloneNode(true);
            yearFilter.parentNode.replaceChild(newFilter, yearFilter);
            newFilter.addEventListener('change', () => this.filterYear());
        }
        
        const periodFilter = document.getElementById('filterPeriodReportsInput');
        if (periodFilter) {
            const newFilter = periodFilter.cloneNode(true);
            periodFilter.parentNode.replaceChild(newFilter, periodFilter);
            newFilter.addEventListener('change', () => this.filterPeriod());
        }
    }

    getMainContentContainer() {
        return document.getElementById('reportsContentContainer');
    }
}