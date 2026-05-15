// pages/management-review.js
// Management Review Page - Form dan Tracking Management Review
// Untuk HSE Manager dan Top Management

import { toast, showModal, closeModal } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class ManagementReviewPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterYear = '';
        // NOTE: filterDept dihapus karena tidak digunakan di applyFilters()
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = [];
        
        // Data untuk form input
        this.otpSummary = [];
        this.temuanSummary = [];
    }

    // ============================================
    // API CALLS
    // ============================================
    
    async fetchFromSheets(action, params = {}) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'local', data: [], total: 0, message: 'Google Sheets not configured' };
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
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.GOOGLE_SHEETS.TIMEOUT);
            
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
            console.error('Google Sheets fetch error:', error);
            return { status: 'error', data: [], total: 0, message: error.message };
        }
    }

    async loadAllData() {
        try {
            const [mrResult, otpResult, temuanResult] = await Promise.all([
                this.fetchFromSheets('getAllManagementReview'),
                this.fetchFromSheets('getAllOTP'),
                this.fetchFromSheets('getAllTemuan')
            ]);
            
            if (mrResult.status === 'success' && mrResult.data) {
                this.allData = this.formatData(mrResult.data);
            }
            
            if (otpResult.status === 'success' && otpResult.data) {
                this.otpSummary = otpResult.data;
            }
            
            if (temuanResult.status === 'success' && temuanResult.data) {
                this.temuanSummary = temuanResult.data;
            }
            
        } catch (error) {
            console.error('Failed to load data:', error);
            throw error;
        }
    }

    async saveManagementReview(payload) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'error', message: 'Google Sheets not configured' };
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'saveManagementReview');
            url.searchParams.append('data', JSON.stringify(payload));
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('Save management review error:', error);
            return { status: 'error', message: error.message };
        }
    }

    async updateManagementReviewStatus(mrId, status, notes) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'error', message: 'Google Sheets not configured' };
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'updateMRStatus');
            url.searchParams.append('mrId', mrId);
            url.searchParams.append('status', status);
            url.searchParams.append('notes', notes || '');
            url.searchParams.append('updatedBy', this.state.currentUser?.username || '');
            url.searchParams.append('updatedAt', new Date().toISOString());
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('Update MR status error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // ============================================
    // DATA FORMATTING
    // ============================================
    
    formatItem(item) {
        if (!item) return {};
        
        const fieldMapping = {
            mrId: ['MR_ID', 'mrId', 'mr_id', 'Review_ID'],
            reviewTitle: ['Review_Title', 'reviewTitle', 'review_title', 'Judul'],
            reviewDate: ['Review_Date', 'reviewDate', 'review_date', 'Tanggal_Review'],
            period: ['Period', 'period', 'Periode'],
            department: ['Department', 'department', 'Departemen'],
            reviewType: ['Review_Type', 'reviewType', 'review_type', 'Tipe_Review'],
            chairman: ['Chairman', 'chairman', 'Ketua'],
            attendees: ['Attendees', 'attendees', 'Peserta'],
            
            // Input review
            auditResults: ['Audit_Results', 'auditResults', 'Hasil_Audit'],
            otpPerformance: ['OTP_Performance', 'otpPerformance', 'Kinerja_OTP'],
            environmentalPerformance: ['Environmental_Performance', 'environmentalPerformance', 'Kinerja_Lingkungan'],
            complianceStatus: ['Compliance_Status', 'complianceStatus', 'Status_Kepatuhan'],
            resourceAdequacy: ['Resource_Adequacy', 'resourceAdequacy', 'Kecukupan_Sumber_Daya'],
            effectivenessActions: ['Effectiveness_Actions', 'effectivenessActions', 'Efektivitas_Tindakan'],
            improvementOpportunities: ['Improvement_Opportunities', 'improvementOpportunities', 'Peluang_Perbaikan'],
            recommendations: ['Recommendations', 'recommendations', 'Rekomendasi'],
            conclusion: ['Conclusion', 'conclusion', 'Kesimpulan'],
            
            status: ['Status', 'status'],
            createdBy: ['Created_By', 'createdBy', 'created_by'],
            createdAt: ['Created_At', 'createdAt', 'created_at'],
            reviewedBy: ['Reviewed_By', 'reviewedBy', 'reviewed_by'],
            reviewedAt: ['Reviewed_At', 'reviewedAt', 'reviewed_at'],
            notes: ['Notes', 'notes', 'Catatan']
        };
        
        const result = {};
        for (const [field, possibleKeys] of Object.entries(fieldMapping)) {
            let value = '';
            for (const key of possibleKeys) {
                if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
                    value = item[key];
                    break;
                }
            }
            result[field] = value || '';
        }
        result._rowIndex = item.rowIndex || null;
        return result;
    }

    formatData(data) {
        if (!Array.isArray(data)) return [];
        return data.map(item => this.formatItem(item));
    }

    // ============================================
    // SUMMARY CALCULATIONS
    // ============================================
    
    getOTPSummary() {
        const total = this.otpSummary.length;
        const approved = this.otpSummary.filter(o => o.Status === 'Approved' || o.status === 'Approved').length;
        const rejected = this.otpSummary.filter(o => o.Status === 'Rejected' || o.status === 'Rejected').length;
        const pending = total - approved - rejected;
        
        const byDept = {};
        this.otpSummary.forEach(o => {
            const dept = o.Department || o.department || 'Unknown';
            if (!byDept[dept]) byDept[dept] = { total: 0, approved: 0 };
            byDept[dept].total++;
            if (o.Status === 'Approved' || o.status === 'Approved') byDept[dept].approved++;
        });
        
        return { total, approved, rejected, pending, byDept };
    }
    
    getTemuanSummary() {
        const total = this.temuanSummary.length;
        const open = this.temuanSummary.filter(t => t.Status === 'Open' || t.status === 'Open').length;
        const inProgress = this.temuanSummary.filter(t => t.Status === 'In Progress' || t.status === 'In Progress').length;
        const closed = this.temuanSummary.filter(t => t.Status === 'Closed' || t.status === 'Closed').length;
        const verified = this.temuanSummary.filter(t => t.Status === 'Verified' || t.status === 'Verified').length;
        
        const byKategori = {};
        this.temuanSummary.forEach(t => {
            const kat = t.Kategori_Temuan || t.kategoriTemuan || 'Unknown';
            if (!byKategori[kat]) byKategori[kat] = 0;
            byKategori[kat]++;
        });
        
        const byKlasifikasi = {};
        this.temuanSummary.forEach(t => {
            const klas = t.Klasifikasi || t.klasifikasi || 'Unknown';
            if (!byKlasifikasi[klas]) byKlasifikasi[klas] = 0;
            byKlasifikasi[klas]++;
        });
        
        return { total, open, inProgress, closed, verified, byKategori, byKlasifikasi };
    }

    // ============================================
    // FILTER METHODS
    // ============================================
    
    getUniqueYears() {
        const years = new Set();
        this.allData.forEach(item => {
            if (item.period) {
                const year = item.period.toString().substring(0, 4);
                if (year) years.add(year);
            }
        });
        if (years.size === 0) years.add(new Date().getFullYear().toString());
        return Array.from(years).sort((a, b) => b - a);
    }

    applyFilters() {
        let filtered = [...this.allData];
        
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.mrId && item.mrId.toLowerCase().includes(searchLower)) ||
                (item.reviewTitle && item.reviewTitle.toLowerCase().includes(searchLower)) ||
                (item.department && item.department.toLowerCase().includes(searchLower)) ||
                (item.chairman && item.chairman.toLowerCase().includes(searchLower))
            );
        }
        
        if (this.filterStatus) {
            filtered = filtered.filter(item => item.status === this.filterStatus);
        }
        
        if (this.filterYear) {
            filtered = filtered.filter(item => {
                const year = item.period?.toString().substring(0, 4);
                return year === this.filterYear;
            });
        }
        
        // Sort by review date descending
        filtered.sort((a, b) => {
            const dateA = a.reviewDate ? new Date(a.reviewDate) : new Date(0);
            const dateB = b.reviewDate ? new Date(b.reviewDate) : new Date(0);
            return dateB - dateA;
        });
        
        return filtered;
    }

    // ============================================
    // RENDER METHODS
    // ============================================
    
    async render() {
        if (!this.isRefreshing) this.showLoading();
        
        try {
            if (this.allData.length === 0) {
                await this.loadAllData();
            }
            
            const filteredData = this.applyFilters();
            this.totalData = filteredData.length;
            this.totalPages = Math.ceil(this.totalData / this.pageSize);
            
            if (this.currentPage > this.totalPages && this.totalPages > 0) {
                this.currentPage = this.totalPages;
            }
            if (this.currentPage < 1) this.currentPage = 1;
            
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const paginatedData = filteredData.slice(startIndex, startIndex + this.pageSize);
            
            this.hideLoading();
            return this.renderHTML(paginatedData);
            
        } catch (error) {
            console.error('Render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML(data) {
        const user = this.state.currentUser || {};
        const canCreate = user.role === 'hse' || user.role === 'top_management';
        const otpSummary = this.getOTPSummary();
        const temuanSummary = this.getTemuanSummary();
        const uniqueYears = this.getUniqueYears();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Management Review</h1>
                    <p class="breadcrumb">Home / Management Review / <span>Management Review</span></p>
                </div>
                <div class="d-flex gap-sm">
                    ${canCreate ? `
                        <button class="btn btn-primary" data-action="managementReview.showCreateForm">
                            <i class="bi bi-plus-lg"></i> Create Review
                        </button>
                    ` : ''}
                    <button class="btn btn-outline-primary" id="refreshMRBtn" data-action="managementReview.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            ${this.renderSummaryCards(otpSummary, temuanSummary)}

            <div class="filter-section">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-search"></i> Cari Review</label>
                            <input type="text" id="searchMRInput" class="form-control"
                                   placeholder="Cari ID, judul, ketua..." 
                                   value="${this.escapeHtml(this.searchQuery)}">
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-flag"></i> Status</label>
                            <select id="filterStatusMRInput" class="form-select">
                                <option value="">Semua Status</option>
                                <option value="Draft" ${this.filterStatus === 'Draft' ? 'selected' : ''}>Draft</option>
                                <option value="Completed" ${this.filterStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                                <option value="Approved" ${this.filterStatus === 'Approved' ? 'selected' : ''}>Approved</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="filterYearMRInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueYears.map(y => `
                                    <option value="${y}" ${this.filterYear === y ? 'selected' : ''}>${y}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label>Hasil</label>
                            <div class="mt-2">
                                <span class="badge-status info">
                                    <i class="bi bi-database"></i> ${this.totalData} Review
                                </span>
                                ${(this.searchQuery || this.filterStatus || this.filterYear) ? `
                                    <button class="btn btn-sm btn-link" data-action="managementReview.clearFilters" 
                                            style="margin-left: 4px; padding: 2px 6px;">
                                        <i class="bi bi-x-circle"></i> Clear
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="bi bi-clipboard-data"></i> 
                        Daftar Management Review
                    </h3>
                    <span class="badge-status info">Hal. ${this.currentPage} / ${this.totalPages || 1}</span>
                </div>
                <div class="table-wrapper" id="mrTableWrapper">
                    ${this.renderTable(data)}
                </div>
                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>

            <!-- Information Card -->
            <div class="app-card mt-md" style="background: #f0f9ff; border-left: 4px solid var(--info);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-info-circle-fill" style="color: var(--info); font-size: 1.2rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">Tentang Management Review</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Management Review adalah tinjauan manajemen berkala sesuai persyaratan ISO 14001:2015 Klausul 9.3.
                            Review mencakup evaluasi kinerja sistem manajemen lingkungan, hasil audit, pencapaian OTP,
                            status tindak lanjut temuan, dan rekomendasi untuk perbaikan berkelanjutan.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    renderSummaryCards(otpSummary, temuanSummary) {
        return `
            <div class="row mb-md">
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">
                            <i class="bi bi-clipboard-data"></i> ${this.allData.length}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Review</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">
                            ${otpSummary.approved}/${otpSummary.total}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">OTP Approved</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">
                            ${temuanSummary.open + temuanSummary.inProgress}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Temuan Open/In Progress</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--info);">
                            ${temuanSummary.closed + temuanSummary.verified}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Temuan Closed/Verified</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderTable(data) {
        if (data.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-clipboard-data" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <h3>Belum ada Management Review</h3>
                    <p>${this.searchQuery || this.filterStatus ? 
                        'Tidak ada review yang sesuai dengan filter' : 
                        'Klik tombol "Create Review" untuk membuat management review baru'}</p>
                    <button class="btn btn-primary mt-md" data-action="managementReview.showCreateForm">
                        <i class="bi bi-plus-lg"></i> Create Review
                    </button>
                </div>
            `;
        }
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        
        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 40px;">No</th>
                        <th style="min-width: 120px;">MR ID</th>
                        <th style="min-width: 250px;">Review Title</th>
                        <th style="min-width: 100px;">Period</th>
                        <th style="min-width: 100px;">Department</th>
                        <th style="min-width: 120px;">Chairman</th>
                        <th style="min-width: 100px;">Review Date</th>
                        <th style="min-width: 85px;">Status</th>
                        <th style="min-width: 100px;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((item, index) => this.renderTableRow(item, startIndex + index + 1)).join('')}
                </tbody>
            </table>
        `;
    }

    renderTableRow(item, rowNumber) {
        if (!item) return '';
        
        return `
            <tr>
                <td class="text-center">${rowNumber}</td>
                <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(item.mrId || '-')}</code></td>
                <td class="col-wrap"><strong>${this.escapeHtml(item.reviewTitle || '-')}</strong></td>
                <td><span class="badge-status default">${this.escapeHtml(item.period || '-')}</span></td>
                <td>${this.escapeHtml(item.department || '-')}</td>
                <td><strong>${this.escapeHtml(item.chairman || '-')}</strong></td>
                <td>${this.formatDate(item.reviewDate)}</td>
                <td>${this.getStatusBadge(item.status)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            data-action="managementReview.viewDetail" 
                            data-params='${JSON.stringify({mrId: item.mrId}).replace(/'/g, "&#39;")}'
                            title="Detail">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    renderPagination() {
        let buttons = '';
        const maxButtons = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(this.totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            buttons += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                        data-action="managementReview.goToPage" data-params='{"page": ${i}}'>${i}</button>
            `;
        }
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalData);
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startItem}-${endItem} dari ${this.totalData} review
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" data-action="managementReview.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" data-action="managementReview.goToPage" 
                            data-params='{"page": ${this.currentPage + 1}}'
                            ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // CREATE REVIEW FORM
    // ============================================
    
    async showCreateForm() {
        const user = this.state.currentUser || {};
        const otpSummary = this.getOTPSummary();
        const temuanSummary = this.getTemuanSummary();
        
        const content = `
            <div class="modal-body-scroll" style="max-height: 70vh; overflow-y: auto;">
                <form data-action="managementReview.submitReview" id="mrCreateForm">
                    <!-- Basic Info -->
                    <div class="app-card mb-md" style="background: #f8fafc;">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-info-circle"></i> Informasi Review</h4>
                        <div class="row">
                            <div class="col-md-8">
                                <div class="form-group-custom">
                                    <label>Review Title <span style="color: var(--danger);">*</span></label>
                                    <input type="text" name="reviewTitle" class="form-control" required
                                           placeholder="Contoh: Management Review Semester 1 2026">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label>Period <span style="color: var(--danger);">*</span></label>
                                    <select name="period" class="form-select" required>
                                        <option value="">Pilih Periode</option>
                                        <option value="${new Date().getFullYear()} Q1">${new Date().getFullYear()} Q1</option>
                                        <option value="${new Date().getFullYear()} Q2">${new Date().getFullYear()} Q2</option>
                                        <option value="${new Date().getFullYear()} Q3">${new Date().getFullYear()} Q3</option>
                                        <option value="${new Date().getFullYear()} Q4">${new Date().getFullYear()} Q4</option>
                                        <option value="${new Date().getFullYear()} Full Year">${new Date().getFullYear()} Full Year</option>
                                        <option value="${new Date().getFullYear() + 1} Q1">${new Date().getFullYear() + 1} Q1</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label>Review Date <span style="color: var(--danger);">*</span></label>
                                    <input type="date" name="reviewDate" class="form-control" required
                                           value="${new Date().toISOString().split('T')[0]}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label>Type</label>
                                    <select name="reviewType" class="form-select">
                                        <option value="Periodic">Periodic</option>
                                        <option value="Special">Special</option>
                                        <option value="Annual">Annual</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label>Chairman <span style="color: var(--danger);">*</span></label>
                                    <input type="text" name="chairman" class="form-control" required
                                           placeholder="Nama Ketua Review">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label>Attendees</label>
                                    <textarea name="attendees" class="form-control" rows="2"
                                              placeholder="Daftar peserta (pisahkan dengan koma)"></textarea>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label>Department</label>
                                    <input type="text" name="department" class="form-control" readonly
                                           value="${this.escapeHtml(user.department || 'All')}" style="background: #f8fafc;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Summary Data (Auto-filled) -->
                    <div class="app-card mb-md" style="background: #f0fdf4;">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-graph-up"></i> Data Summary (Auto)</h4>
                        <div class="row">
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label>Total OTP</label>
                                    <input type="number" name="totalOTP" class="form-control" readonly
                                           value="${otpSummary.total}" style="background: #fff;">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label>OTP Approved</label>
                                    <input type="number" name="otpApproved" class="form-control" readonly
                                           value="${otpSummary.approved}" style="background: #fff;">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label>Total Temuan</label>
                                    <input type="number" name="totalTemuan" class="form-control" readonly
                                           value="${temuanSummary.total}" style="background: #fff;">
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="form-group-custom">
                                    <label>Temuan Open</label>
                                    <input type="number" name="temuanOpen" class="form-control" readonly
                                           value="${temuanSummary.open}" style="background: #fff;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Review Inputs -->
                    <div class="app-card mb-md">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-pencil-square"></i> Hasil Review</h4>
                        
                        <div class="form-group-custom">
                            <label>1. Hasil Audit Internal & Eksternal <span style="color: var(--danger);">*</span></label>
                            <textarea name="auditResults" class="form-control" rows="3" required
                                      placeholder="Ringkasan hasil audit, temuan utama, status tindak lanjut..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>2. Kinerja Objective, Target & Program (OTP) <span style="color: var(--danger);">*</span></label>
                            <textarea name="otpPerformance" class="form-control" rows="3" required
                                      placeholder="Pencapaian OTP, KPI yang tercapai/tidak, analisis gap..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>3. Kinerja Lingkungan</label>
                            <textarea name="environmentalPerformance" class="form-control" rows="3"
                                      placeholder="Data kinerja lingkungan, trend, aspek signifikan..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>4. Status Kepatuhan (Compliance)</label>
                            <textarea name="complianceStatus" class="form-control" rows="2"
                                      placeholder="Status kepatuhan terhadap regulasi, izin lingkungan..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>5. Kecukupan Sumber Daya</label>
                            <textarea name="resourceAdequacy" class="form-control" rows="2"
                                      placeholder="Kecukupan SDM, infrastruktur, anggaran untuk EMS..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>6. Efektivitas Tindakan Perbaikan & Pencegahan</label>
                            <textarea name="effectivenessActions" class="form-control" rows="2"
                                      placeholder="Efektivitas CAPA, tindak lanjut temuan audit..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>7. Peluang Perbaikan (Improvement Opportunities)</label>
                            <textarea name="improvementOpportunities" class="form-control" rows="2"
                                      placeholder="Identifikasi peluang perbaikan berkelanjutan..."></textarea>
                        </div>
                    </div>

                    <!-- Recommendations & Conclusion -->
                    <div class="app-card mb-md" style="background: #fffbeb;">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-lightbulb"></i> Rekomendasi & Kesimpulan</h4>
                        
                        <div class="form-group-custom">
                            <label>Rekomendasi <span style="color: var(--danger);">*</span></label>
                            <textarea name="recommendations" class="form-control" rows="3" required
                                      placeholder="Rekomendasi untuk perbaikan, perubahan kebijakan, alokasi sumber daya..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>Kesimpulan <span style="color: var(--danger);">*</span></label>
                            <textarea name="conclusion" class="form-control" rows="3" required
                                      placeholder="Kesimpulan umum management review, efektivitas EMS, komitmen manajemen..."></textarea>
                        </div>
                    </div>

                    <!-- Submit Buttons -->
                    <div class="d-flex gap-sm" style="justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" data-action="modal.close">
                            <i class="bi bi-x-circle"></i> Batal
                        </button>
                        <button type="button" class="btn btn-warning" data-action="managementReview.saveDraft">
                            <i class="bi bi-save"></i> Save Draft
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-send"></i> Submit Review
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        showModal('Create Management Review', content, 'modal-xl');
    }

    // ============================================
    // SUBMIT REVIEW
    // ============================================
    
    async submitReview(params, element) {
        const form = document.getElementById('mrCreateForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        // Validasi
        if (!data.reviewTitle || !data.period || !data.reviewDate || !data.chairman) {
            toast('Mohon lengkapi informasi dasar review', 'error');
            return;
        }
        
        if (!data.auditResults || !data.otpPerformance || !data.recommendations || !data.conclusion) {
            toast('Mohon lengkapi hasil review yang wajib', 'error');
            return;
        }
        
        try {
            const user = this.state.currentUser || {};
            
            const year = data.period?.toString().substring(0, 4) || new Date().getFullYear();
            const rowNum = (this.allData.length + 1).toString().padStart(3, '0');
            const mrId = `MR-${year}-${rowNum}`;
            
            const payload = {
                ...data,
                mrId: mrId,
                createdBy: user.username || user.name || '',
                createdAt: new Date().toISOString(),
                status: 'Completed'
            };
            
            const result = await this.saveManagementReview(payload);
            
            if (result.status === 'success') {
                closeModal();
                toast('Management Review berhasil disimpan!', 'success');
                this.allData = [];
                await this.updateTableOnly();
            } else {
                toast(result.message || 'Gagal menyimpan review', 'error');
            }
        } catch (error) {
            console.error('Submit review error:', error);
            toast('Gagal menyimpan: ' + error.message, 'error');
        }
    }
    
    async saveDraft(params, element) {
        const form = document.getElementById('mrCreateForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        try {
            const user = this.state.currentUser || {};
            
            const year = data.period?.toString().substring(0, 4) || new Date().getFullYear();
            const rowNum = (this.allData.length + 1).toString().padStart(3, '0');
            const mrId = `MR-${year}-${rowNum}`;
            
            const payload = {
                ...data,
                mrId: mrId,
                createdBy: user.username || user.name || '',
                createdAt: new Date().toISOString(),
                status: 'Draft'
            };
            
            const result = await this.saveManagementReview(payload);
            
            if (result.status === 'success') {
                closeModal();
                toast('Draft Management Review berhasil disimpan!', 'success');
                this.allData = [];
                await this.updateTableOnly();
            } else {
                toast(result.message || 'Gagal menyimpan draft', 'error');
            }
        } catch (error) {
            console.error('Save draft error:', error);
            toast('Gagal menyimpan: ' + error.message, 'error');
        }
    }

    // ============================================
    // VIEW DETAIL
    // ============================================
    
    async viewDetail(params) {
        const review = this.allData.find(r => r.mrId === params.mrId);
        if (!review) {
            toast('Data review tidak ditemukan', 'error');
            return;
        }
        
        const content = `
            <div style="max-height: 70vh; overflow-y: auto; padding-right: 8px;">
                <div class="app-card mb-md" style="background: ${this.getStatusColor(review.status)}; border-left: 4px solid var(--${this.getStatusBadgeType(review.status)});">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="bi ${review.status === 'Approved' ? 'bi-check-circle-fill' : review.status === 'Completed' ? 'bi-clipboard-check' : 'bi-pencil'}" 
                           style="font-size: 1.5rem;"></i>
                        <div>
                            <strong>Status: ${this.getStatusBadge(review.status)}</strong>
                            <span style="margin-left: 12px; font-size: var(--fs-sm);">ID: <code>${this.escapeHtml(review.mrId)}</code></span>
                        </div>
                    </div>
                </div>

                <div class="app-card mb-md">
                    <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-info-circle"></i> Informasi Review</h4>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="info-item mb-sm">
                                <label class="info-label">Review Title</label>
                                <div class="info-value" style="font-weight: 600;">${this.escapeHtml(review.reviewTitle || '-')}</div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="info-item mb-sm">
                                <label class="info-label">Period</label>
                                <div class="info-value"><span class="badge-status default">${this.escapeHtml(review.period || '-')}</span></div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="info-item mb-sm">
                                <label class="info-label">Review Date</label>
                                <div class="info-value">${this.formatDate(review.reviewDate)}</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="info-item mb-sm">
                                <label class="info-label">Type</label>
                                <div class="info-value">${this.escapeHtml(review.reviewType || '-')}</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="info-item mb-sm">
                                <label class="info-label">Chairman</label>
                                <div class="info-value"><strong>${this.escapeHtml(review.chairman || '-')}</strong></div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="info-item mb-sm">
                                <label class="info-label">Department</label>
                                <div class="info-value">${this.escapeHtml(review.department || '-')}</div>
                            </div>
                        </div>
                        <div class="col-12">
                            <div class="info-item mb-sm">
                                <label class="info-label">Attendees</label>
                                <div class="info-value">${this.escapeHtml(review.attendees || '-')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="app-card mb-md">
                    <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-list-check"></i> Hasil Review</h4>
                    
                    <div class="info-item mb-sm">
                        <label class="info-label">1. Hasil Audit</label>
                        <div class="info-value" style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md);">${this.escapeHtml(review.auditResults || '-')}</div>
                    </div>
                    <div class="info-item mb-sm">
                        <label class="info-label">2. Kinerja OTP</label>
                        <div class="info-value" style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md);">${this.escapeHtml(review.otpPerformance || '-')}</div>
                    </div>
                    ${review.environmentalPerformance ? `
                    <div class="info-item mb-sm">
                        <label class="info-label">3. Kinerja Lingkungan</label>
                        <div class="info-value" style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md);">${this.escapeHtml(review.environmentalPerformance)}</div>
                    </div>
                    ` : ''}
                    ${review.complianceStatus ? `
                    <div class="info-item mb-sm">
                        <label class="info-label">4. Status Kepatuhan</label>
                        <div class="info-value" style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md);">${this.escapeHtml(review.complianceStatus)}</div>
                    </div>
                    ` : ''}
                    ${review.resourceAdequacy ? `
                    <div class="info-item mb-sm">
                        <label class="info-label">5. Kecukupan Sumber Daya</label>
                        <div class="info-value" style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md);">${this.escapeHtml(review.resourceAdequacy)}</div>
                    </div>
                    ` : ''}
                    ${review.effectivenessActions ? `
                    <div class="info-item mb-sm">
                        <label class="info-label">6. Efektivitas Tindakan</label>
                        <div class="info-value" style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md);">${this.escapeHtml(review.effectivenessActions)}</div>
                    </div>
                    ` : ''}
                    ${review.improvementOpportunities ? `
                    <div class="info-item mb-sm">
                        <label class="info-label">7. Peluang Perbaikan</label>
                        <div class="info-value" style="background: #f8fafc; padding: 10px; border-radius: var(--radius-md);">${this.escapeHtml(review.improvementOpportunities)}</div>
                    </div>
                    ` : ''}
                </div>

                <div class="app-card mb-md" style="background: #fffbeb;">
                    <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-lightbulb"></i> Rekomendasi & Kesimpulan</h4>
                    <div class="info-item mb-sm">
                        <label class="info-label">Rekomendasi</label>
                        <div class="info-value" style="font-weight: 500;">${this.escapeHtml(review.recommendations || '-')}</div>
                    </div>
                    <div class="info-item mb-sm">
                        <label class="info-label">Kesimpulan</label>
                        <div class="info-value" style="font-weight: 500; color: var(--primary-dark);">${this.escapeHtml(review.conclusion || '-')}</div>
                    </div>
                </div>
            </div>
        `;
        
        showModal(`Detail: ${this.escapeHtml(review.reviewTitle || 'Management Review')}`, content, 'modal-xl');
    }

    // ============================================
    // ACTION METHODS
    // ============================================
    
    async goToPage(params) { this.currentPage = params.page; await this.updateTableOnly(); }

    async refresh() {
        const refreshBtn = document.getElementById('refreshMRBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.allData = [];
        this.otpSummary = [];
        this.temuanSummary = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterYear = '';
        
        try {
            await this.loadAllData();
            this.isRefreshing = true;
            await this.updateTableOnly();
            this.isRefreshing = false;
            toast('Data berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> <span>Refresh</span>';
            }
        }
    }

    async search() {
        const el = document.getElementById('searchMRInput');
        if (el) { this.searchQuery = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterStatus() {
        const el = document.getElementById('filterStatusMRInput');
        if (el) { this.filterStatus = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterYear() {
        const el = document.getElementById('filterYearMRInput');
        if (el) { this.filterYear = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async clearFilters() {
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterYear = '';
        this.currentPage = 1;
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    async updateTableOnly() {
        const tableWrapper = document.getElementById('mrTableWrapper');
        
        if (!tableWrapper) {
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = await this.render();
                this.attachEventListeners();
            }
            return;
        }
        
        const filteredData = this.applyFilters();
        this.totalData = filteredData.length;
        this.totalPages = Math.ceil(this.totalData / this.pageSize);
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const paginatedData = filteredData.slice(startIndex, startIndex + this.pageSize);
        
        tableWrapper.style.opacity = '0.5';
        tableWrapper.innerHTML = this.renderTable(paginatedData);
        
        requestAnimationFrame(() => {
            tableWrapper.style.transition = 'opacity 0.2s ease';
            tableWrapper.style.opacity = '1';
        });
        
        const cardHeader = tableWrapper.closest('.app-card');
        if (cardHeader) {
            const badgeStatus = cardHeader.querySelector('.card-header .badge-status');
            if (badgeStatus) badgeStatus.textContent = `Hal. ${this.currentPage} / ${this.totalPages || 1}`;
            
            const existingPagination = cardHeader.querySelector('.border-top');
            if (this.totalPages > 1) {
                const newPagination = this.renderPagination();
                if (existingPagination) existingPagination.outerHTML = newPagination;
                else cardHeader.insertAdjacentHTML('beforeend', newPagination);
            } else {
                if (existingPagination) existingPagination.remove();
            }
        }
        
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const summaryCards = mainContent.querySelector('.row.mb-md');
            if (summaryCards) {
                const otpSummary = this.getOTPSummary();
                const temuanSummary = this.getTemuanSummary();
                summaryCards.outerHTML = this.renderSummaryCards(otpSummary, temuanSummary);
            }
        }
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        ['searchMRInput', 'filterStatusMRInput', 'filterYearMRInput'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            
            if (id === 'searchMRInput') {
                let timeout;
                newEl.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => this.search(), 400);
                });
            } else if (id === 'filterStatusMRInput') {
                newEl.addEventListener('change', () => this.filterStatus());
            } else if (id === 'filterYearMRInput') {
                newEl.addEventListener('change', () => this.filterYear());
            }
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getStatusBadge(status) {
        const badges = {
            'Draft': 'warning',
            'Completed': 'info',
            'Approved': 'success'
        };
        const label = status || 'Draft';
        const type = badges[label] || 'default';
        return `<span class="badge-status ${type}">${label}</span>`;
    }

    getStatusBadgeType(status) {
        const types = { 'Draft': 'warning', 'Completed': 'info', 'Approved': 'success' };
        return types[status] || 'default';
    }

    getStatusColor(status) {
        const colors = {
            'Draft': '#fef3c7',
            'Completed': '#e0f2fe',
            'Approved': '#dcfce7'
        };
        return colors[status] || '#f8fafc';
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    renderSkeleton() {
        return `
            <table class="data-table striped"><thead><tr>
                <th class="text-center" style="width:40px;">No</th>
                <th>MR ID</th><th>Review Title</th><th>Period</th>
                <th>Department</th><th>Chairman</th><th>Review Date</th>
                <th>Status</th><th>Action</th>
            </tr></thead><tbody>
                ${Array(5).fill(0).map(() => `
                    <tr class="skeleton-row">
                        <td class="text-center"><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:25px;margin:0 auto;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:100px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:200px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:90px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:100px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:90px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:50px;"></div></td>
                    </tr>
                `).join('')}
            </tbody></table>
        `;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#mrSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">Management Review</h1>
                    <p class="breadcrumb">Home / Management Review / <span>Management Review</span></p>
                </div></div>
                <div class="app-card" id="mrSkeletonLoader">
                    <div class="card-header"><h3 class="card-title"><i class="bi bi-clipboard-data"></i> Daftar Management Review</h3></div>
                    <div class="table-wrapper">${this.renderSkeleton()}</div>
                </div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Management Review</h1>
                <p class="breadcrumb">Home / Management Review / <span>Management Review</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-action="managementReview.refresh">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }
}