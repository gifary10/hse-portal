// pages/approval-management.js
// Approval Management Page - Mengelola approval OTP
// Untuk HSE Manager dan Top Management

import { toast, showModal, closeModal } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class ApprovalManagementPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.filterDept = '';
        this.filterStatus = '';
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = [];
        this.selectedOTPs = new Set();
    }

    // ============================================
    // GOOGLE SHEETS API CALLS
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

    async getPendingOTP() {
        const user = this.state.currentUser;
        const userRole = user?.role || '';
        
        // Ambil semua OTP yang statusnya Submitted atau In Review
        if (userRole === 'top_management') {
            return await this.fetchFromSheets('getAllOTP');
        }
        return await this.fetchFromSheets('getAllOTP');
    }

    // ============================================
    // DATA FORMATTING
    // ============================================
    
    formatItem(item) {
        if (!item) return {};
        
        const fieldMapping = {
            otpId: ['OTP_ID', 'otpId', 'otp_id'],
            department: ['Department', 'department', 'Departemen'],
            year: ['Year', 'year', 'Tahun'],
            objective: ['Objective', 'objective', 'Tujuan'],
            kpiCode: ['KPI_Code', 'kpiCode', 'kpi_code'],
            kpiName: ['KPI_Name', 'kpiName', 'kpi_name'],
            target: ['Target', 'target'],
            timeline: ['Timeline', 'timeline'],
            owner: ['Owner', 'owner', 'PIC'],
            weight: ['Weight', 'weight', 'Bobot'],
            status: ['Status', 'status'],
            programControl: ['Program_Control', 'programControl', 'program_control'],
            createdDate: ['Created_Date', 'createdDate', 'created_date', 'CreatedAt'],
            createdBy: ['Created_By', 'createdBy', 'created_by']
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

    applyFilters() {
        let filtered = [...this.allData];
        
        // Hanya tampilkan yang perlu approval (Submitted, In Review)
        filtered = filtered.filter(item => 
            item.status === 'Submitted' || item.status === 'In Review'
        );
        
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.otpId && item.otpId.toLowerCase().includes(searchLower)) ||
                (item.objective && item.objective.toLowerCase().includes(searchLower)) ||
                (item.department && item.department.toLowerCase().includes(searchLower)) ||
                (item.owner && item.owner.toLowerCase().includes(searchLower))
            );
        }
        
        if (this.filterDept) {
            filtered = filtered.filter(item => item.department === this.filterDept);
        }
        
        if (this.filterStatus) {
            filtered = filtered.filter(item => item.status === this.filterStatus);
        }
        
        return filtered;
    }

    // ============================================
    // RENDER METHODS
    // ============================================
    
    async render() {
        if (!this.isRefreshing) this.showLoading();
        
        try {
            if (this.allData.length === 0) {
                const result = await this.getPendingOTP();
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
        const pendingCount = this.allData.filter(o => o.status === 'Submitted').length;
        const inReviewCount = this.allData.filter(o => o.status === 'In Review').length;
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Approval Management</h1>
                    <p class="breadcrumb">Home / Approval / <span>Approval Management</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" id="refreshApprovalBtn" data-action="approvalManagement.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            ${this.renderStatsCards()}

            <div class="filter-section">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-search"></i> Cari OTP</label>
                            <input type="text" id="searchApprovalInput" class="form-control"
                                   placeholder="Cari ID, objective, department..." 
                                   value="${this.escapeHtml(this.searchQuery)}">
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Filter Departemen</label>
                            <select id="filterDeptApprovalInput" class="form-select">
                                <option value="">Semua Departemen</option>
                                ${uniqueDepts.map(dept => `
                                    <option value="${this.escapeHtml(dept)}" ${this.filterDept === dept ? 'selected' : ''}>
                                        ${this.escapeHtml(dept)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-flag"></i> Filter Status</label>
                            <select id="filterStatusApprovalInput" class="form-select">
                                <option value="">Semua Status</option>
                                <option value="Submitted" ${this.filterStatus === 'Submitted' ? 'selected' : ''}>Submitted</option>
                                <option value="In Review" ${this.filterStatus === 'In Review' ? 'selected' : ''}>In Review</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label>Hasil</label>
                            <div class="mt-2">
                                <span class="badge-status info">
                                    <i class="bi bi-database"></i> ${this.totalData} OTP
                                </span>
                                ${(this.searchQuery || this.filterDept || this.filterStatus) ? `
                                    <button class="btn btn-sm btn-link" data-action="approvalManagement.clearFilters" 
                                            style="margin-left: 4px; padding: 2px 6px;">
                                        <i class="bi bi-x-circle"></i> Clear
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                ${data.length > 0 ? `
                <div class="d-flex gap-sm mt-md">
                    <button class="btn btn-success" data-action="approvalManagement.bulkApprove">
                        <i class="bi bi-check-all"></i> Approve Selected
                    </button>
                    <button class="btn btn-danger" data-action="approvalManagement.bulkReject">
                        <i class="bi bi-x-circle"></i> Reject Selected
                    </button>
                    <span class="text-muted" style="font-size: var(--fs-sm); align-self: center;">
                        <span id="selectedCount">0</span> OTP dipilih
                    </span>
                </div>
                ` : ''}
            </div>

            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="bi bi-check-circle"></i> 
                        Daftar OTP Menunggu Approval
                    </h3>
                    <span class="badge-status info">Hal. ${this.currentPage} / ${this.totalPages || 1}</span>
                </div>
                <div class="table-wrapper" id="approvalTableWrapper">
                    ${this.renderTable(data)}
                </div>
                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>
        `;
    }

    renderStatsCards() {
        const pending = this.allData.filter(o => o.status === 'Submitted').length;
        const inReview = this.allData.filter(o => o.status === 'In Review').length;
        const approvedToday = this.allData.filter(o => {
            if (o.status !== 'Approved') return false;
            const reviewedDate = o.reviewedDate || o.Reviewed_Date;
            if (!reviewedDate) return false;
            const today = new Date().toDateString();
            const reviewDay = new Date(reviewedDate).toDateString();
            return today === reviewDay;
        }).length;
        
        return `
            <div class="row mb-md">
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning); cursor: pointer;" 
                         data-action="approvalManagement.filterByStatus" data-params='{"status": "Submitted"}'>
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--warning);">${pending}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Menunggu Approval</div>
                    </div>
                </div>
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info); cursor: pointer;"
                         data-action="approvalManagement.filterByStatus" data-params='{"status": "In Review"}'>
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--info);">${inReview}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">In Review</div>
                    </div>
                </div>
                <div class="col-md-4 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--success);">${approvedToday}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Approved Hari Ini</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderTable(data) {
        if (data.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-check-circle" style="font-size: 3rem; color: var(--success);"></i>
                    <h3>Tidak ada OTP yang perlu di-approve</h3>
                    <p>Semua OTP sudah diproses</p>
                </div>
            `;
        }
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        
        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 40px;">
                            <input type="checkbox" id="selectAllCheckbox" style="cursor: pointer;">
                        </th>
                        <th class="text-center" style="width: 40px;">No</th>
                        <th style="min-width: 130px;">OTP ID</th>
                        <th style="min-width: 100px;">Department</th>
                        <th style="min-width: 200px;">Objective</th>
                        <th style="min-width: 100px;">KPI</th>
                        <th style="min-width: 80px;">Target</th>
                        <th style="min-width: 100px;">Owner</th>
                        <th style="min-width: 70px;">Weight</th>
                        <th style="min-width: 90px;">Status</th>
                        <th style="min-width: 100px;">Created</th>
                        <th style="min-width: 160px;">Actions</th>
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
        
        const isSelected = this.selectedOTPs.has(item.otpId);
        
        return `
            <tr style="${isSelected ? 'background: #f0fdf4 !important;' : ''}">
                <td class="text-center">
                    <input type="checkbox" class="otp-checkbox" value="${this.escapeHtml(item.otpId)}" 
                           ${isSelected ? 'checked' : ''} style="cursor: pointer;"
                           data-action="approvalManagement.toggleSelect" data-params='{"otpId": "${this.escapeHtml(item.otpId)}"}'>
                </td>
                <td class="text-center">${rowNumber}</td>
                <td><code style="background: #f0f7ff; padding: 2px 6px; border-radius: 3px; font-size: var(--fs-xs);">${this.escapeHtml(item.otpId || '-')}</code></td>
                <td><span class="badge-status default">${this.escapeHtml(item.department || '-')}</span></td>
                <td class="col-wrap" title="${this.escapeHtml(item.objective)}">${this.escapeHtml((item.objective || '').substring(0, 60))}${(item.objective || '').length > 60 ? '...' : ''}</td>
                <td><small>${this.escapeHtml(item.kpiCode || '-')}</small></td>
                <td class="text-center"><strong>${this.escapeHtml(item.target || '-')}</strong></td>
                <td>${this.escapeHtml(item.owner || '-')}</td>
                <td class="text-center">${item.weight ? `${item.weight}%` : '-'}</td>
                <td>${this.getStatusBadge(item.status)}</td>
                <td><small>${this.formatDate(item.createdDate)}</small></td>
                <td>
                    <div class="d-flex gap-xs">
                        <button class="btn btn-sm btn-success" title="Approve"
                                data-action="approvalManagement.approveSingle" 
                                data-params='${JSON.stringify({otpId: item.otpId, rowIndex: item._rowIndex}).replace(/'/g, "&#39;")}'>
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" title="Reject"
                                data-action="approvalManagement.rejectSingle" 
                                data-params='${JSON.stringify({otpId: item.otpId, rowIndex: item._rowIndex}).replace(/'/g, "&#39;")}'>
                            <i class="bi bi-x-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary" title="Detail"
                                data-action="approvalManagement.viewDetail" 
                                data-params='${JSON.stringify({otpId: item.otpId}).replace(/'/g, "&#39;")}'>
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
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
                        data-action="approvalManagement.goToPage" data-params='{"page": ${i}}'>${i}</button>
            `;
        }
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalData);
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startItem}-${endItem} dari ${this.totalData} OTP
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" data-action="approvalManagement.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" data-action="approvalManagement.goToPage" 
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
    
    async goToPage(params) { 
        this.currentPage = params.page; 
        await this.updateTableOnly(); 
    }

    toggleSelect(params, element) {
        if (params.otpId) {
            if (this.selectedOTPs.has(params.otpId)) {
                this.selectedOTPs.delete(params.otpId);
            } else {
                this.selectedOTPs.add(params.otpId);
            }
            this.updateSelectionUI();
        }
    }

    updateSelectionUI() {
        const countElement = document.getElementById('selectedCount');
        if (countElement) {
            countElement.textContent = this.selectedOTPs.size;
        }
        
        // Update all checkboxes
        document.querySelectorAll('.otp-checkbox').forEach(cb => {
            cb.checked = this.selectedOTPs.has(cb.value);
        });
        
        // Update select all checkbox
        const selectAll = document.getElementById('selectAllCheckbox');
        if (selectAll) {
            const filteredData = this.applyFilters();
            const currentPageData = filteredData.slice(
                (this.currentPage - 1) * this.pageSize, 
                this.currentPage * this.pageSize
            );
            const allCurrentSelected = currentPageData.every(item => this.selectedOTPs.has(item.otpId));
            selectAll.checked = allCurrentSelected && currentPageData.length > 0;
        }
    }

    toggleSelectAll(params, element) {
        const filteredData = this.applyFilters();
        const currentPageData = filteredData.slice(
            (this.currentPage - 1) * this.pageSize, 
            this.currentPage * this.pageSize
        );
        
        const allSelected = currentPageData.every(item => this.selectedOTPs.has(item.otpId));
        
        if (allSelected) {
            currentPageData.forEach(item => this.selectedOTPs.delete(item.otpId));
        } else {
            currentPageData.forEach(item => this.selectedOTPs.add(item.otpId));
        }
        
        this.updateSelectionUI();
    }

    async approveSingle(params, element) {
        const otp = this.allData.find(o => o.otpId === params.otpId);
        if (!otp) {
            toast('OTP tidak ditemukan', 'error');
            return;
        }
        
        await this.performApproval([otp], 'Approved', 'Approved by management');
    }

    async rejectSingle(params, element) {
        const otp = this.allData.find(o => o.otpId === params.otpId);
        if (!otp) {
            toast('OTP tidak ditemukan', 'error');
            return;
        }
        
        this.showRejectModal([otp]);
    }

    async bulkApprove() {
        if (this.selectedOTPs.size === 0) {
            toast('Pilih OTP terlebih dahulu', 'warning');
            return;
        }
        
        const selectedOTPData = this.allData.filter(o => this.selectedOTPs.has(o.otpId));
        
        const content = `
            <div style="text-align: center;">
                <i class="bi bi-check-circle" style="font-size: 3rem; color: var(--success);"></i>
                <p class="mt-md">Anda akan <strong>menyetujui</strong> <strong>${selectedOTPData.length} OTP</strong> sekaligus.</p>
                <p style="color: var(--text-muted); font-size: var(--fs-sm);">OTP yang dipilih:</p>
                <div style="text-align: left; max-height: 150px; overflow-y: auto; background: #f8fafc; padding: 12px; border-radius: var(--radius-md); margin-bottom: var(--space-md);">
                    ${selectedOTPData.map(o => `<div style="font-size: var(--fs-sm); padding: 2px 0;">• ${this.escapeHtml(o.otpId)} - ${this.escapeHtml((o.objective || '').substring(0, 50))}</div>`).join('')}
                </div>
                <div class="d-flex justify-content-center gap-sm mt-lg">
                    <button class="btn btn-secondary" data-action="modal.close">
                        <i class="bi bi-x-circle"></i> Batal
                    </button>
                    <button class="btn btn-success" id="confirmBulkApproveBtn">
                        <i class="bi bi-check-circle"></i> Ya, Approve Semua
                    </button>
                </div>
            </div>
        `;
        
        showModal('Konfirmasi Bulk Approve', content);
        
        document.getElementById('confirmBulkApproveBtn').addEventListener('click', async () => {
            closeModal();
            await this.performApproval(selectedOTPData, 'Approved', 'Bulk approved by management');
        });
    }

    async bulkReject() {
        if (this.selectedOTPs.size === 0) {
            toast('Pilih OTP terlebih dahulu', 'warning');
            return;
        }
        
        const selectedOTPData = this.allData.filter(o => this.selectedOTPs.has(o.otpId));
        this.showRejectModal(selectedOTPData, true);
    }

    showRejectModal(otpList, isBulk = false) {
        const content = `
            <div style="text-align: center;">
                <i class="bi bi-x-circle" style="font-size: 3rem; color: var(--danger);"></i>
                <p class="mt-md">Anda akan <strong>menolak</strong> <strong>${otpList.length} OTP</strong>.</p>
                <div style="text-align: left; max-height: 100px; overflow-y: auto; background: #fff5f5; padding: 12px; border-radius: var(--radius-md); margin-bottom: var(--space-md);">
                    ${otpList.map(o => `<div style="font-size: var(--fs-sm); padding: 2px 0;">• ${this.escapeHtml(o.otpId)}</div>`).join('')}
                </div>
                <div class="form-group-custom">
                    <label>Alasan Penolakan <span style="color: var(--danger);">*</span></label>
                    <textarea id="rejectReasonInput" class="form-control" rows="3" 
                              placeholder="Jelaskan alasan penolakan..."></textarea>
                </div>
                <div class="d-flex justify-content-center gap-sm mt-lg">
                    <button class="btn btn-secondary" data-action="modal.close">
                        <i class="bi bi-x-circle"></i> Batal
                    </button>
                    <button class="btn btn-danger" id="confirmRejectBtn">
                        <i class="bi bi-x-circle"></i> Tolak
                    </button>
                </div>
            </div>
        `;
        
        showModal('Konfirmasi Penolakan', content);
        
        document.getElementById('confirmRejectBtn').addEventListener('click', async () => {
            const reason = document.getElementById('rejectReasonInput')?.value || '';
            if (!reason) {
                toast('Mohon isi alasan penolakan', 'warning');
                return;
            }
            closeModal();
            await this.performApproval(otpList, 'Rejected', reason);
        });
    }

    async performApproval(otpList, status, notes) {
        const user = this.state.currentUser;
        let successCount = 0;
        let failCount = 0;
        
        for (const otp of otpList) {
            try {
                const result = await this.updateOTPStatus(otp.otpId, status, notes, user);
                if (result.status === 'success') {
                    successCount++;
                    this.selectedOTPs.delete(otp.otpId);
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Failed to update ${otp.otpId}:`, error);
            }
        }
        
        if (successCount > 0) {
            toast(`Berhasil memproses ${successCount} OTP`, 'success');
        }
        if (failCount > 0) {
            toast(`Gagal memproses ${failCount} OTP`, 'error');
        }
        
        // Refresh data
        this.allData = [];
        await this.updateTableOnly();
    }

    async updateOTPStatus(otpId, status, notes, user) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'error', message: 'Google Sheets not configured' };
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'updateOTPStatus');
            url.searchParams.append('otpId', otpId);
            url.searchParams.append('status', status);
            url.searchParams.append('reviewerNotes', notes || '');
            url.searchParams.append('reviewedBy', user.username || user.name || '');
            url.searchParams.append('reviewedDate', new Date().toISOString());
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('Update OTP status error:', error);
            return { status: 'error', message: error.message };
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

    async refresh() {
        const refreshBtn = document.getElementById('refreshApprovalBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.allData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterDept = '';
        this.filterStatus = '';
        this.selectedOTPs.clear();
        
        setTimeout(() => {
            ['searchApprovalInput', 'filterDeptApprovalInput', 'filterStatusApprovalInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        try {
            await this.getPendingOTP();
            this.isRefreshing = true;
            await this.updateTableOnly();
            this.isRefreshing = false;
            toast('Data approval berhasil dimuat ulang', 'success');
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
        const el = document.getElementById('searchApprovalInput');
        if (el) { this.searchQuery = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterDepartment() {
        const el = document.getElementById('filterDeptApprovalInput');
        if (el) { this.filterDept = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterStatus() {
        const el = document.getElementById('filterStatusApprovalInput');
        if (el) { this.filterStatus = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterByStatus(params) {
        this.filterStatus = params.status || '';
        this.currentPage = 1;
        
        setTimeout(() => {
            const el = document.getElementById('filterStatusApprovalInput');
            if (el) el.value = this.filterStatus;
        }, 100);
        
        await this.updateTableOnly();
    }
    
    async clearFilters() {
        this.searchQuery = '';
        this.filterDept = '';
        this.filterStatus = '';
        this.currentPage = 1;
        
        setTimeout(() => {
            ['searchApprovalInput', 'filterDeptApprovalInput', 'filterStatusApprovalInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    async updateTableOnly() {
        const tableWrapper = document.getElementById('approvalTableWrapper');
        
        if (!tableWrapper) {
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = await this.render();
                this.afterRender();
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
        
        // Update stats cards
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const statsCards = mainContent.querySelector('.row.mb-md');
            if (statsCards) statsCards.outerHTML = this.renderStatsCards();
            
            // Update filter section
            const filterSection = mainContent.querySelector('.filter-section');
            if (filterSection && filteredData.length === 0) {
                const bulkActions = filterSection.querySelector('.d-flex.gap-sm.mt-md');
                if (bulkActions) bulkActions.style.display = 'none';
            }
        }
        
        this.afterRender();
    }

    // ============================================
    // AFTER RENDER
    // ============================================
    
    afterRender() {
        this.attachEventListeners();
        
        // Setup select all checkbox
        const selectAll = document.getElementById('selectAllCheckbox');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                this.toggleSelectAll(null, e.target);
            });
        }
    }

    attachEventListeners() {
        ['searchApprovalInput', 'filterDeptApprovalInput', 'filterStatusApprovalInput'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            
            if (id === 'searchApprovalInput') {
                let timeout;
                newEl.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => this.search(), 400);
                });
            } else if (id === 'filterDeptApprovalInput') {
                newEl.addEventListener('change', () => this.filterDepartment());
            } else if (id === 'filterStatusApprovalInput') {
                newEl.addEventListener('change', () => this.filterStatus());
            }
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getStatusBadge(status) {
        const badges = {
            'Submitted': 'info',
            'In Review': 'warning',
            'Approved': 'success',
            'Rejected': 'danger',
            'Draft': 'default'
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

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    renderSkeleton() {
        return `
            <table class="data-table striped"><thead><tr>
                <th class="text-center" style="width:40px;"></th>
                <th class="text-center" style="width:40px;">No</th>
                <th>OTP ID</th><th>Department</th><th>Objective</th>
                <th>KPI</th><th>Target</th><th>Owner</th><th>Weight</th>
                <th>Status</th><th>Created</th><th>Actions</th>
            </tr></thead><tbody>
                ${Array(5).fill(0).map(() => `
                    <tr class="skeleton-row">
                        <td class="text-center"><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:18px;margin:0 auto;"></div></td>
                        <td class="text-center"><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:25px;margin:0 auto;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:110px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:160px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:50px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:40px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:130px;"></div></td>
                    </tr>
                `).join('')}
            </tbody></table>
        `;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#approvalSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">Approval Management</h1>
                    <p class="breadcrumb">Home / Approval / <span>Approval Management</span></p>
                </div></div>
                <div class="app-card" id="approvalSkeletonLoader">
                    <div class="card-header"><h3 class="card-title"><i class="bi bi-check-circle"></i> Daftar OTP Menunggu Approval</h3></div>
                    <div class="table-wrapper">${this.renderSkeleton()}</div>
                </div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Approval Management</h1>
                <p class="breadcrumb">Home / Approval / <span>Approval Management</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-action="approvalManagement.refresh">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }
}