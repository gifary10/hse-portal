// pages/otp-history.js
// OTP History Page - Menampilkan daftar OTP yang pernah dibuat
// Dengan filter, search, dan status tracking - Support multiple programs

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class OTPHistoryPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterYear = '';
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = [];
    }

    // ============================================
    // GOOGLE SHEETS API CALLS
    // ============================================
    
    async fetchFromSheets(action, params = {}) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return {
                status: 'local',
                data: [],
                total: 0,
                message: 'Google Sheets not configured'
            };
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
            return {
                status: 'local',
                data: this.allData,
                total: this.allData.length,
                message: error.message
            };
        }
    }

    async getAllOTP() {
        const user = this.state.currentUser;
        const userDept = user?.department || '';
        const userRole = user?.role || '';
        
        if (userRole === 'department' && userDept) {
            return await this.fetchFromSheets('getOTPByDept', { department: userDept });
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
            templateCode: ['Template_Code', 'templateCode', 'template_code'],
            objective: ['Objective', 'objective', 'Tujuan'],
            kpiCode: ['KPI_Code', 'kpiCode', 'kpi_code'],
            kpiName: ['KPI_Name', 'kpiName', 'kpi_name'],
            uom: ['UOM', 'uom', 'Satuan'],
            polarity: ['Polarity', 'polarity', 'Polaritas'],
            formula: ['Formula', 'formula', 'Rumus'],
            programCode: ['Program_Code', 'programCode', 'program_code', 'Program_Codes'],
            hazardDesc: ['Hazard_Description', 'hazardDesc', 'hazard_description', 'Hazard_Descriptions'],
            programControl: ['Program_Control', 'programControl', 'program_control', 'Program_Controls'],
            activity: ['Activity', 'activity', 'Aktivitas', 'Activities'],
            dampak: ['Dampak', 'dampak'],
            target: ['Target', 'target'],
            timeline: ['Timeline', 'timeline'],
            owner: ['Owner', 'owner', 'PIC'],
            budget: ['Budget', 'budget'],
            weight: ['Weight', 'weight', 'Bobot'],
            status: ['Status', 'status'],
            createdDate: ['Created_Date', 'createdDate', 'created_date', 'CreatedAt'],
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
        
        // Calculate program count for display
        result.programCount = (result.programCode || '').split('|').filter(p => p && p.trim()).length;
        
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
            if (item.year) {
                years.add(item.year);
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }

    getUniqueStatuses() {
        const statuses = new Set();
        this.allData.forEach(item => {
            if (item.status) {
                statuses.add(item.status);
            }
        });
        return Array.from(statuses).sort();
    }

    applyFilters() {
        let filtered = [...this.allData];
        
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.otpId && item.otpId.toLowerCase().includes(searchLower)) ||
                (item.objective && item.objective.toLowerCase().includes(searchLower)) ||
                (item.kpiName && item.kpiName.toLowerCase().includes(searchLower)) ||
                (item.owner && item.owner.toLowerCase().includes(searchLower)) ||
                (item.programControl && item.programControl.toLowerCase().includes(searchLower)) ||
                (item.hazardDesc && item.hazardDesc.toLowerCase().includes(searchLower))
            );
        }
        
        if (this.filterStatus) {
            filtered = filtered.filter(item => item.status === this.filterStatus);
        }
        
        if (this.filterDept) {
            filtered = filtered.filter(item => item.department === this.filterDept);
        }
        
        if (this.filterYear) {
            filtered = filtered.filter(item => item.year.toString() === this.filterYear);
        }
        
        // Sort by created date descending
        filtered.sort((a, b) => {
            const dateA = a.createdDate ? new Date(a.createdDate) : new Date(0);
            const dateB = b.createdDate ? new Date(b.createdDate) : new Date(0);
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
                const result = await this.getAllOTP();
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
        const uniqueStatuses = this.getUniqueStatuses();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">OTP History</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>OTP History</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-primary" data-page="otp-create">
                        <i class="bi bi-plus-lg"></i> Create OTP
                    </button>
                    <button class="btn btn-outline-primary" id="refreshOTPBtn" data-action="otpHistory.refresh">
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
                            <input type="text" id="searchOTPInput" class="form-control"
                                   placeholder="Cari ID, objective, KPI, PIC..." 
                                   value="${this.escapeHtml(this.searchQuery)}">
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-flag"></i> Status</label>
                            <select id="filterStatusInput" class="form-select">
                                <option value="">Semua Status</option>
                                ${uniqueStatuses.map(status => `
                                    <option value="${this.escapeHtml(status)}" ${this.filterStatus === status ? 'selected' : ''}>
                                        ${this.escapeHtml(status)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Departemen</label>
                            <select id="filterDeptOTPInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueDepts.map(dept => `
                                    <option value="${this.escapeHtml(dept)}" ${this.filterDept === dept ? 'selected' : ''}>
                                        ${this.escapeHtml(dept)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="filterYearInput" class="form-select">
                                <option value="">Semua Tahun</option>
                                ${uniqueYears.map(year => `
                                    <option value="${year}" ${this.filterYear === year.toString() ? 'selected' : ''}>
                                        ${year}
                                    </option>
                                `).join('')}
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
                                ${(this.searchQuery || this.filterStatus || this.filterDept || this.filterYear) ? `
                                    <button class="btn btn-sm btn-link" data-action="otpHistory.clearFilters" 
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
                        <i class="bi bi-clock-history"></i> 
                        Daftar OTP
                    </h3>
                    <span class="badge-status info">Hal. ${this.currentPage} / ${this.totalPages || 1}</span>
                </div>
                <div class="table-wrapper" id="otpTableWrapper">
                    ${this.renderTable(data)}
                </div>
                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>
        `;
    }

    renderStatsCards() {
        const total = this.allData.length;
        const draft = this.allData.filter(o => o.status === 'Draft').length;
        const submitted = this.allData.filter(o => o.status === 'Submitted').length;
        const approved = this.allData.filter(o => o.status === 'Approved').length;
        const rejected = this.allData.filter(o => o.status === 'Rejected').length;
        
        return `
            <div class="row mb-md">
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--primary);">${total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--warning);">${draft}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Draft</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--info);">${submitted}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Submitted</div>
                    </div>
                </div>
                <div class="col-md-3 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--success);">${approved}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Approved</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderTable(data) {
        if (data.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <h3>Tidak ada OTP</h3>
                    <p>${this.searchQuery || this.filterStatus || this.filterDept ? 
                        'Tidak ada OTP yang sesuai dengan filter' : 
                        'Belum ada OTP yang dibuat. Silakan buat OTP baru.'}
                    </p>
                    <button class="btn btn-primary mt-md" data-page="otp-create">
                        <i class="bi bi-plus-lg"></i> Create OTP
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
                        <th style="min-width: 140px;">OTP ID</th>
                        <th style="min-width: 80px;">Year</th>
                        <th style="min-width: 100px;">Department</th>
                        <th style="min-width: 200px;">Objective</th>
                        <th style="min-width: 80px;" class="text-center">Program</th>
                        <th style="min-width: 100px;">Target</th>
                        <th style="min-width: 80px;">Timeline</th>
                        <th style="min-width: 100px;">Owner</th>
                        <th style="min-width: 70px;" class="text-center">Weight</th>
                        <th style="min-width: 90px;">Status</th>
                        <th style="min-width: 100px;">Created</th>
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
        
        // Get program count for display
        const programCount = item.programCount || 0;
        const programDisplay = programCount > 0 ? 
            `<span class="badge-status info" title="${programCount} program(s)">${programCount} prog</span>` : 
            '<span class="badge-status default">-</span>';
        
        const highlightText = (text) => {
            if (!this.searchQuery || !text) return this.escapeHtml(text || '-');
            const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
            return this.escapeHtml(text).replace(regex, 
                '<mark style="background: var(--accent-light); padding: 0 2px; border-radius: 3px;">$1</mark>');
        };
        
        // Check if overdue for approval (submitted > 7 days)
        const isOverdueForApproval = item.status === 'Submitted' && item.createdDate && 
            (new Date() - new Date(item.createdDate)) > 7 * 24 * 60 * 60 * 1000;
        
        return `
            <tr style="${isOverdueForApproval ? 'background: #fff5f5 !important;' : ''}">
                <td class="text-center">${rowNumber}</td>
                <td><code style="background: #f0f7ff; padding: 2px 6px; border-radius: 3px; font-size: var(--fs-xs);">${this.escapeHtml(item.otpId || '-')}</code></td>
                <td class="text-center">${this.escapeHtml(item.year || '-')}</td>
                <td><span class="badge-status default">${this.escapeHtml(item.department || '-')}</span></td>
                <td class="col-wrap">${highlightText(item.objective)}</td>
                <td class="text-center">${programDisplay}</td>
                <td class="text-center"><strong>${this.escapeHtml(item.target || '-')}</strong></td>
                <td><span class="badge-status info">${this.escapeHtml(item.timeline || '-')}</span></td>
                <td>${this.escapeHtml(item.owner || '-')}</td>
                <td class="text-center">${item.weight ? `${item.weight}%` : '-'}</td>
                <td>${this.getStatusBadge(item.status)}</td>
                <td><small>${this.formatDate(item.createdDate)}</small></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            data-action="otpHistory.viewDetail" 
                            data-params='${JSON.stringify({otpId: item.otpId, rowIndex: item._rowIndex}).replace(/'/g, "&#39;")}'>
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
                        data-action="otpHistory.goToPage" data-params='{"page": ${i}}'>${i}</button>
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
                    <button class="page-btn" data-action="otpHistory.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" data-action="otpHistory.goToPage" 
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

    async refresh() {
        const refreshBtn = document.getElementById('refreshOTPBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.allData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterYear = '';
        
        setTimeout(() => {
            ['searchOTPInput', 'filterStatusInput', 'filterDeptOTPInput', 'filterYearInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        try {
            await this.getAllOTP();
            this.isRefreshing = true;
            await this.updateTableOnly();
            this.isRefreshing = false;
            toast('Data OTP berhasil dimuat ulang', 'success');
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
        const el = document.getElementById('searchOTPInput');
        if (el) { this.searchQuery = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterStatus() {
        const el = document.getElementById('filterStatusInput');
        if (el) { this.filterStatus = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterDepartment() {
        const el = document.getElementById('filterDeptOTPInput');
        if (el) { this.filterDept = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterYear() {
        const el = document.getElementById('filterYearInput');
        if (el) { this.filterYear = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }
    
    async clearFilters() {
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterYear = '';
        this.currentPage = 1;
        
        setTimeout(() => {
            ['searchOTPInput', 'filterStatusInput', 'filterDeptOTPInput', 'filterYearInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    async viewDetail(params) {
        const otp = this.allData.find(o => o.otpId === params.otpId);
        if (otp) {
            sessionStorage.setItem('selectedOTP', JSON.stringify(otp));
            sessionStorage.setItem('selectedOTPId', params.otpId);
            this.router.navigateTo('otp-review', { otpId: params.otpId });
        } else {
            toast('Data OTP tidak ditemukan', 'error');
        }
    }

    async updateTableOnly() {
        const tableWrapper = document.getElementById('otpTableWrapper');
        
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
            if (statsCards) {
                statsCards.outerHTML = this.renderStatsCards();
            }
        }
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        ['searchOTPInput', 'filterStatusInput', 'filterDeptOTPInput', 'filterYearInput'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            
            if (id === 'searchOTPInput') {
                let timeout;
                newEl.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => this.search(), 400);
                });
            } else if (id === 'filterStatusInput') {
                newEl.addEventListener('change', () => this.filterStatus());
            } else if (id === 'filterDeptOTPInput') {
                newEl.addEventListener('change', () => this.filterDepartment());
            } else if (id === 'filterYearInput') {
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
            'Submitted': 'info',
            'Approved': 'success',
            'Rejected': 'danger',
            'In Review': 'info',
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

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    escapeRegex(str) {
        if (!str) return '';
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    renderSkeleton() {
        return `
            <table class="data-table striped"><thead><tr>
                <th class="text-center" style="width:40px;">No</th>
                <th>OTP ID</th><th>Year</th><th>Department</th>
                <th>Objective</th><th>Program</th><th>Target</th>
                <th>Timeline</th><th>Owner</th><th>Weight</th>
                <th>Status</th><th>Created</th><th>Action</th>
            </tr></thead><tbody>
                ${Array(5).fill(0).map(() => `
                    <tr class="skeleton-row">
                        <td class="text-center"><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:25px;margin:0 auto;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:120px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:40px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:160px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:50px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:60px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:60px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:40px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:30px;"></div></td>
                    </tr>
                `).join('')}
            </tbody>\\
        `;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#otpSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">OTP History</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>OTP History</span></p>
                </div></div>
                <div class="app-card" id="otpSkeletonLoader">
                    <div class="card-header"><h3 class="card-title"><i class="bi bi-clock-history"></i> Daftar OTP</h3></div>
                    <div class="table-wrapper">${this.renderSkeleton()}</div>
                </div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">OTP History</h1>
                <p class="breadcrumb">Home / OTP Management / <span>OTP History</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-action="otpHistory.refresh">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }
}