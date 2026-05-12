// pages/approval-history.js
// Approval History Page - Riwayat semua aktivitas approval
// Menampilkan log approval untuk audit trail

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class ApprovalHistoryPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 15;
        this.searchQuery = '';
        this.filterDept = '';
        this.filterStatus = '';
        this.filterYear = '';
        this.filterReviewer = '';
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = [];
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
                this.allData = this.formatData(result.data);
            }
            
            return result;
            
        } catch (error) {
            console.error('Google Sheets fetch error:', error);
            return { status: 'local', data: this.allData, total: this.allData.length, message: error.message };
        }
    }

    async getAllOTPHistory() {
        return await this.fetchFromSheets('getAllOTP');
    }

    // ============================================
    // DATA FORMATTING
    // ============================================
    
    formatItem(item) {
        if (!item) return {};
        
        const fieldMapping = {
            otpId: ['OTP_ID', 'otpId', 'otp_id'],
            department: ['Department', 'department'],
            year: ['Year', 'year'],
            objective: ['Objective', 'objective'],
            kpiCode: ['KPI_Code', 'kpiCode'],
            target: ['Target', 'target'],
            owner: ['Owner', 'owner'],
            weight: ['Weight', 'weight'],
            status: ['Status', 'status'],
            createdDate: ['Created_Date', 'createdDate', 'created_date'],
            createdBy: ['Created_By', 'createdBy', 'created_by'],
            reviewerNotes: ['Reviewer_Notes', 'reviewerNotes', 'reviewer_notes'],
            reviewedBy: ['Reviewed_By', 'reviewedBy', 'reviewed_by'],
            reviewedDate: ['Reviewed_Date', 'reviewedDate', 'reviewed_date']
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
    // FILTER METHODS
    // ============================================
    
    getUniqueDepartments() {
        const departments = new Set();
        this.allData.forEach(item => {
            if (item.department && item.department !== '-') {
                departments.add(item.department);
            }
        });
        return Array.from(departments).sort();
    }

    getUniqueYears() {
        const years = new Set();
        this.allData.forEach(item => {
            if (item.year) years.add(item.year);
        });
        return Array.from(years).sort((a, b) => b - a);
    }

    getUniqueReviewers() {
        const reviewers = new Set();
        this.allData.forEach(item => {
            if (item.reviewedBy) reviewers.add(item.reviewedBy);
        });
        return Array.from(reviewers).sort();
    }

    applyFilters() {
        let filtered = [...this.allData];
        
        // Hanya tampilkan yang sudah direview (Approved/Rejected)
        filtered = filtered.filter(item => 
            item.status === 'Approved' || item.status === 'Rejected' || 
            item.status === 'Revision Requested' || item.status === 'Verified'
        );
        
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.otpId && item.otpId.toLowerCase().includes(searchLower)) ||
                (item.objective && item.objective.toLowerCase().includes(searchLower)) ||
                (item.department && item.department.toLowerCase().includes(searchLower)) ||
                (item.reviewerNotes && item.reviewerNotes.toLowerCase().includes(searchLower))
            );
        }
        
        if (this.filterDept) {
            filtered = filtered.filter(item => item.department === this.filterDept);
        }
        
        if (this.filterStatus) {
            filtered = filtered.filter(item => item.status === this.filterStatus);
        }
        
        if (this.filterYear) {
            filtered = filtered.filter(item => item.year?.toString() === this.filterYear);
        }
        
        if (this.filterReviewer) {
            filtered = filtered.filter(item => item.reviewedBy === this.filterReviewer);
        }
        
        // Sort by reviewed date descending
        filtered.sort((a, b) => {
            const dateA = a.reviewedDate ? new Date(a.reviewedDate) : new Date(0);
            const dateB = b.reviewedDate ? new Date(b.reviewedDate) : new Date(0);
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
                const result = await this.getAllOTPHistory();
                if (result.status === 'error') {
                    this.hideLoading();
                    return this.renderError(result.message || 'Gagal memuat data');
                }
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
        const uniqueDepts = this.getUniqueDepartments();
        const uniqueYears = this.getUniqueYears();
        const uniqueReviewers = this.getUniqueReviewers();
        const approvedCount = this.allData.filter(o => o.status === 'Approved').length;
        const rejectedCount = this.allData.filter(o => o.status === 'Rejected').length;
        const revisionCount = this.allData.filter(o => o.status === 'Revision Requested').length;
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Approval History</h1>
                    <p class="breadcrumb">Home / Approval / <span>Approval History</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-primary" data-page="approval-management">
                        <i class="bi bi-check-circle"></i> Approval Management
                    </button>
                    <button class="btn btn-outline-primary" id="refreshHistoryBtn" data-action="approvalHistory.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            ${this.renderStatsCards()}

            <div class="filter-section">
                <div class="row">
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-search"></i> Cari</label>
                            <input type="text" id="searchHistoryInput" class="form-control"
                                   placeholder="Cari ID, objective..." 
                                   value="${this.escapeHtml(this.searchQuery)}">
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-flag"></i> Status</label>
                            <select id="filterStatusHistoryInput" class="form-select">
                                <option value="">Semua Status</option>
                                <option value="Approved" ${this.filterStatus === 'Approved' ? 'selected' : ''}>Approved</option>
                                <option value="Rejected" ${this.filterStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
                                <option value="Revision Requested" ${this.filterStatus === 'Revision Requested' ? 'selected' : ''}>Revision Requested</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Departemen</label>
                            <select id="filterDeptHistoryInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueDepts.map(d => `
                                    <option value="${this.escapeHtml(d)}" ${this.filterDept === d ? 'selected' : ''}>${this.escapeHtml(d)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="filterYearHistoryInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueYears.map(y => `
                                    <option value="${y}" ${this.filterYear === y?.toString() ? 'selected' : ''}>${y}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-person-check"></i> Reviewer</label>
                            <select id="filterReviewerInput" class="form-select">
                                <option value="">Semua Reviewer</option>
                                ${uniqueReviewers.map(r => `
                                    <option value="${this.escapeHtml(r)}" ${this.filterReviewer === r ? 'selected' : ''}>${this.escapeHtml(r)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="row mt-sm">
                    <div class="col-12">
                        <span class="badge-status info">
                            <i class="bi bi-database"></i> ${this.totalData} Record
                        </span>
                        ${(this.searchQuery || this.filterStatus || this.filterDept || this.filterYear || this.filterReviewer) ? `
                            <button class="btn btn-sm btn-link" data-action="approvalHistory.clearFilters" 
                                    style="margin-left: 8px; padding: 2px 6px;">
                                <i class="bi bi-x-circle"></i> Clear Filters
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="bi bi-clock-history"></i> 
                        Riwayat Approval OTP
                    </h3>
                    <div class="d-flex gap-sm">
                        <span class="badge-status info">Hal. ${this.currentPage} / ${this.totalPages || 1}</span>
                    </div>
                </div>
                <div class="table-wrapper" id="historyTableWrapper">
                    ${this.renderTable(data)}
                </div>
                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>

            <!-- Export Section -->
            <div class="app-card mt-md" style="background: #f8fafc;">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-download"></i> Export Data</h3>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" data-action="approvalHistory.exportCSV">
                        <i class="bi bi-file-earmark-spreadsheet"></i> Export CSV
                    </button>
                    <button class="btn btn-outline-primary" data-action="approvalHistory.printTable">
                        <i class="bi bi-printer"></i> Print
                    </button>
                </div>
            </div>
        `;
    }

    renderStatsCards() {
        const approved = this.allData.filter(o => o.status === 'Approved').length;
        const rejected = this.allData.filter(o => o.status === 'Rejected').length;
        const revision = this.allData.filter(o => o.status === 'Revision Requested').length;
        const thisMonth = this.allData.filter(o => {
            if (!o.reviewedDate) return false;
            const reviewDate = new Date(o.reviewedDate);
            const now = new Date();
            return reviewDate.getMonth() === now.getMonth() && 
                   reviewDate.getFullYear() === now.getFullYear() &&
                   o.status === 'Approved';
        }).length;
        
        return `
            <div class="row mb-md">
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success); cursor: pointer;"
                         data-action="approvalHistory.filterByStatus" data-params='{"status": "Approved"}'>
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">
                            <i class="bi bi-check-circle"></i> ${approved}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Approved</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger); cursor: pointer;"
                         data-action="approvalHistory.filterByStatus" data-params='{"status": "Rejected"}'>
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">
                            <i class="bi bi-x-circle"></i> ${rejected}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Rejected</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning); cursor: pointer;"
                         data-action="approvalHistory.filterByStatus" data-params='{"status": "Revision Requested"}'>
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">
                            <i class="bi bi-arrow-repeat"></i> ${revision}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Revision Requested</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--info);">
                            <i class="bi bi-calendar-check"></i> ${thisMonth}
                        </div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Approved Bulan Ini</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderTable(data) {
        if (data.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-clock-history" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <h3>Tidak ada riwayat approval</h3>
                    <p>${this.searchQuery || this.filterStatus || this.filterDept ? 
                        'Tidak ada data yang sesuai dengan filter' : 
                        'Belum ada OTP yang di-approve atau di-reject'}</p>
                    <button class="btn btn-primary mt-md" data-page="approval-management">
                        <i class="bi bi-check-circle"></i> Ke Approval Management
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
                        <th style="min-width: 130px;">OTP ID</th>
                        <th style="min-width: 100px;">Department</th>
                        <th style="min-width: 200px;">Objective</th>
                        <th style="min-width: 100px;">Created By</th>
                        <th style="min-width: 85px;">Status</th>
                        <th style="min-width: 150px;">Review Notes</th>
                        <th style="min-width: 100px;">Reviewed By</th>
                        <th style="min-width: 120px;">Reviewed Date</th>
                        <th style="min-width: 80px;">Action</th>
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
                <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(item.otpId || '-')}</code></td>
                <td><span class="badge-status default">${this.escapeHtml(item.department || '-')}</span></td>
                <td class="col-wrap" title="${this.escapeHtml(item.objective)}">${this.escapeHtml((item.objective || '').substring(0, 60))}${(item.objective || '').length > 60 ? '...' : ''}</td>
                <td>${this.escapeHtml(item.createdBy || '-')}</td>
                <td>${this.getStatusBadge(item.status)}</td>
                <td class="col-wrap" title="${this.escapeHtml(item.reviewerNotes)}">
                    ${item.reviewerNotes ? `
                        <span style="font-style: italic; color: ${item.status === 'Rejected' ? 'var(--danger)' : 'var(--text-light)'};">
                            ${this.escapeHtml(item.reviewerNotes.substring(0, 80))}${item.reviewerNotes.length > 80 ? '...' : ''}
                        </span>
                    ` : '-'}
                </td>
                <td><strong>${this.escapeHtml(item.reviewedBy || '-')}</strong></td>
                <td>${this.formatDateTime(item.reviewedDate)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            data-action="approvalHistory.viewDetail" 
                            data-params='${JSON.stringify({otpId: item.otpId}).replace(/'/g, "&#39;")}'>
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
                        data-action="approvalHistory.goToPage" data-params='{"page": ${i}}'>${i}</button>
            `;
        }
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalData);
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startItem}-${endItem} dari ${this.totalData} record
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" data-action="approvalHistory.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" data-action="approvalHistory.goToPage" 
                            data-params='{"page": ${this.currentPage + 1}}'
                            ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // ACTION METHODS
    // ============================================
    
    async goToPage(params) { this.currentPage = params.page; await this.updateTableOnly(); }

    async refresh() {
        const refreshBtn = document.getElementById('refreshHistoryBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.allData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterDept = '';
        this.filterStatus = '';
        this.filterYear = '';
        this.filterReviewer = '';
        
        setTimeout(() => {
            ['searchHistoryInput', 'filterStatusHistoryInput', 'filterDeptHistoryInput', 
             'filterYearHistoryInput', 'filterReviewerInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        try {
            await this.getAllOTPHistory();
            this.isRefreshing = true;
            await this.updateTableOnly();
            this.isRefreshing = false;
            toast('Riwayat approval berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> <span>Refresh</span>';
            }
        }
    }

    async viewDetail(params) {
        const otp = this.allData.find(o => o.otpId === params.otpId);
        if (otp) {
            sessionStorage.setItem('selectedOTP', JSON.stringify(otp));
            this.router.navigateTo('otp-review', { otpId: params.otpId });
        } else {
            toast('Data OTP tidak ditemukan', 'error');
        }
    }

    async filterByStatus(params) {
        this.filterStatus = params.status || '';
        this.currentPage = 1;
        setTimeout(() => {
            const el = document.getElementById('filterStatusHistoryInput');
            if (el) el.value = this.filterStatus;
        }, 100);
        await this.updateTableOnly();
    }

    async search() {
        const el = document.getElementById('searchHistoryInput');
        if (el) { this.searchQuery = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterStatus() {
        const el = document.getElementById('filterStatusHistoryInput');
        if (el) { this.filterStatus = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterDepartment() {
        const el = document.getElementById('filterDeptHistoryInput');
        if (el) { this.filterDept = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterYear() {
        const el = document.getElementById('filterYearHistoryInput');
        if (el) { this.filterYear = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterReviewer() {
        const el = document.getElementById('filterReviewerInput');
        if (el) { this.filterReviewer = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async clearFilters() {
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterYear = '';
        this.filterReviewer = '';
        this.currentPage = 1;
        
        setTimeout(() => {
            ['searchHistoryInput', 'filterStatusHistoryInput', 'filterDeptHistoryInput', 
             'filterYearHistoryInput', 'filterReviewerInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    async exportCSV() {
        const filteredData = this.applyFilters();
        
        if (filteredData.length === 0) {
            toast('Tidak ada data untuk diexport', 'warning');
            return;
        }
        
        // Buat header CSV
        const headers = ['OTP ID', 'Department', 'Objective', 'Created By', 'Status', 
                        'Review Notes', 'Reviewed By', 'Reviewed Date'];
        
        let csv = headers.join(',') + '\n';
        
        // Tambahkan data
        filteredData.forEach(item => {
            const row = [
                `"${item.otpId || ''}"`,
                `"${item.department || ''}"`,
                `"${(item.objective || '').replace(/"/g, '""')}"`,
                `"${item.createdBy || ''}"`,
                `"${item.status || ''}"`,
                `"${(item.reviewerNotes || '').replace(/"/g, '""')}"`,
                `"${item.reviewedBy || ''}"`,
                `"${item.reviewedDate || ''}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        // Download file
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `approval_history_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        toast('Data berhasil diexport ke CSV', 'success');
    }

    async printTable() {
        window.print();
    }

    async updateTableOnly() {
        const tableWrapper = document.getElementById('historyTableWrapper');
        
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
            const statsCards = mainContent.querySelector('.row.mb-md');
            if (statsCards) statsCards.outerHTML = this.renderStatsCards();
        }
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        ['searchHistoryInput', 'filterStatusHistoryInput', 'filterDeptHistoryInput', 
         'filterYearHistoryInput', 'filterReviewerInput'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            
            if (id === 'searchHistoryInput') {
                let timeout;
                newEl.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => this.search(), 400);
                });
            } else if (id === 'filterStatusHistoryInput') {
                newEl.addEventListener('change', () => this.filterStatus());
            } else if (id === 'filterDeptHistoryInput') {
                newEl.addEventListener('change', () => this.filterDepartment());
            } else if (id === 'filterYearHistoryInput') {
                newEl.addEventListener('change', () => this.filterYear());
            } else if (id === 'filterReviewerInput') {
                newEl.addEventListener('change', () => this.filterReviewer());
            }
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getStatusBadge(status) {
        const badges = {
            'Approved': 'success',
            'Rejected': 'danger',
            'Revision Requested': 'warning',
            'Verified': 'info'
        };
        const label = status || 'Unknown';
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

    formatDateTime(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
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
                <th>OTP ID</th><th>Department</th><th>Objective</th>
                <th>Created By</th><th>Status</th><th>Review Notes</th>
                <th>Reviewed By</th><th>Reviewed Date</th><th>Action</th>
            </tr></thead><tbody>
                ${Array(5).fill(0).map(() => `
                    <tr class="skeleton-row">
                        <td class="text-center"><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:25px;margin:0 auto;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:110px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:160px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:120px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:100px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:40px;"></div></td>
                    </tr>
                `).join('')}
            </tbody></table>
        `;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#historySkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">Approval History</h1>
                    <p class="breadcrumb">Home / Approval / <span>Approval History</span></p>
                </div></div>
                <div class="app-card" id="historySkeletonLoader">
                    <div class="card-header"><h3 class="card-title"><i class="bi bi-clock-history"></i> Riwayat Approval OTP</h3></div>
                    <div class="table-wrapper">${this.renderSkeleton()}</div>
                </div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Approval History</h1>
                <p class="breadcrumb">Home / Approval / <span>Approval History</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-action="approvalHistory.refresh">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }
}