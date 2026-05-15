// pages/otp-history.js
// OTP History Page - FIXED [object Promise] issue

import { toast } from '../ui/components.js';
import { BasePage } from '../core/base-page.js';
import { getStatusBadge, formatDate, escapeHtml, setButtonLoading } from '../ui/utils.js';

export class OTPHistoryPage extends BasePage {
    constructor(state, db, router) {
        super(state, db, router, 'otpHistory');
        
        // Additional filters specific to OTP
        this.filterDept = '';
        this.filterYear = '';
    }

    // ============================================
    // DATA LOADING
    // ============================================
    
    async loadData() {
        const user = this.state.currentUser;
        const userDept = user?.department || '';
        const userRole = user?.role || '';
        
        // Jika user department, hanya tampilkan OTP departemennya
        if (userRole === 'department' && userDept) {
            const result = await this.fetchFromSheets('getOTPByDept', { department: userDept });
            if (result.status === 'success' && result.data) {
                this.allData = this.formatData(result.data);
            }
        } else {
            const result = await this.fetchFromSheets('getAllOTP');
            if (result.status === 'success' && result.data) {
                this.allData = this.formatData(result.data);
            }
        }
        
        this.lastFetchTime = new Date();
    }

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
            programCode: ['Program_Code', 'programCode', 'program_code'],
            hazardDesc: ['Hazard_Description', 'hazardDesc', 'hazard_description'],
            programControl: ['Program_Control', 'programControl', 'program_control'],
            activity: ['Activity', 'activity', 'Aktivitas'],
            target: ['Target', 'target'],
            timeline: ['Timeline', 'timeline'],
            owner: ['Owner', 'owner', 'PIC'],
            budget: ['Budget', 'budget'],
            weight: ['Weight', 'weight', 'Bobot'],
            status: ['Status', 'status'],
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
    // FILTER METHODS (Override)
    // ============================================
    
    applyFiltersToData() {
        let filtered = [...this.allData];
        
        // Search query
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.otpId && item.otpId.toLowerCase().includes(searchLower)) ||
                (item.objective && item.objective.toLowerCase().includes(searchLower)) ||
                (item.kpiName && item.kpiName.toLowerCase().includes(searchLower)) ||
                (item.owner && item.owner.toLowerCase().includes(searchLower))
            );
        }
        
        // Status filter
        if (this.filterStatus) {
            filtered = filtered.filter(item => item.status === this.filterStatus);
        }
        
        // Department filter
        if (this.filterDept) {
            filtered = filtered.filter(item => item.department === this.filterDept);
        }
        
        // Year filter
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
    // STATS CARDS
    // ============================================
    
    renderStatsCards() {
        const total = this.allData.length;
        const draft = this.allData.filter(o => o.status === 'Draft').length;
        const submitted = this.allData.filter(o => o.status === 'Submitted').length;
        const approved = this.allData.filter(o => o.status === 'Approved').length;
        const rejected = this.allData.filter(o => o.status === 'Rejected').length;
        
        return `
            <div class="row mb-md">
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--primary);">${total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Total OTP</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--warning);">${draft}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Draft</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--info);">${submitted}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Submitted</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--success);">${approved}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Approved</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger);">
                        <div style="font-size: var(--fs-3xl); font-weight: 700; color: var(--danger);">${rejected}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-sm);">Rejected</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // RENDER METHODS
    // ============================================
    
    async render() {
        if (!this.isRefreshing) this.showLoading('Memuat data OTP...');
        
        try {
            if (this.allData.length === 0) {
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
        const filteredData = this.applyFiltersToData();
        this.updatePagination(filteredData.length);
        const paginatedData = this.getPaginatedData(filteredData);
        
        const uniqueDepts = this.getUniqueDepartments(this.allData);
        const uniqueYears = this.getUniqueYears(this.allData);
        const uniqueStatuses = this.getUniqueStatuses(this.allData);
        
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
                    <button class="btn btn-outline-primary" id="refreshOtpHistoryBtn" data-action="otpHistory.refresh">
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
                            <input type="text" id="searchOtpHistoryInput" class="form-control"
                                   placeholder="Cari ID, objective, KPI, PIC..." 
                                   value="${escapeHtml(this.searchQuery)}">
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-flag"></i> Status</label>
                            <select id="filterStatusOtpHistoryInput" class="form-select">
                                <option value="">Semua Status</option>
                                ${uniqueStatuses.map(status => `
                                    <option value="${escapeHtml(status)}" ${this.filterStatus === status ? 'selected' : ''}>
                                        ${escapeHtml(status)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Departemen</label>
                            <select id="filterDeptOtpHistoryInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueDepts.map(dept => `
                                    <option value="${escapeHtml(dept)}" ${this.filterDept === dept ? 'selected' : ''}>
                                        ${escapeHtml(dept)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="filterYearOtpHistoryInput" class="form-select">
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
                <div id="otpHistoryContentContainer">
                    ${this.renderTable(paginatedData)}
                </div>
                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>
        `;
    }

    // PERBAIKAN: Method ini TIDAK async - mengembalikan string langsung, bukan Promise
    renderTable(data) {
        if (data.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <h3>Tidak ada OTP</h3>
                    <p>${this.searchQuery || this.filterStatus || this.filterDept ? 
                        'Tidak ada OTP yang sesuai dengan filter' : 
                        'Belum ada OTP yang dibuat. Silakan buat OTP baru.'}</p>
                    <button class="btn btn-primary mt-md" data-page="otp-create">
                        <i class="bi bi-plus-lg"></i> Create OTP
                    </button>
                </div>
            `;
        }
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        
        return `
            <div class="table-wrapper">
                <table class="data-table striped">
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 40px;">No</th>
                            <th style="min-width: 140px;">OTP ID</th>
                            <th style="min-width: 80px;">Year</th>
                            <th style="min-width: 100px;">Department</th>
                            <th style="min-width: 200px;">Objective</th>
                            <th style="min-width: 120px;">KPI</th>
                            <th style="min-width: 100px;">Target</th>
                            <th style="min-width: 80px;">Timeline</th>
                            <th style="min-width: 100px;">Owner</th>
                            <th style="min-width: 70px;">Weight</th>
                            <th style="min-width: 90px;">Status</th>
                            <th style="min-width: 100px;">Created</th>
                            <th style="min-width: 80px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map((item, index) => this.renderTableRow(item, startIndex + index + 1)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderTableRow(item, rowNumber) {
        if (!item) return '';
        
        const highlightText = (text) => {
            if (!this.searchQuery || !text) return escapeHtml(text || '-');
            const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
            return escapeHtml(text).replace(regex, 
                '<mark style="background: var(--accent-light); padding: 0 2px; border-radius: 3px;">$1</mark>');
        };
        
        return `
            <tr>
                <td class="text-center">${rowNumber}</td>
                <td><code style="background: #f0f7ff; padding: 2px 6px; border-radius: 3px; font-size: var(--fs-xs);">${escapeHtml(item.otpId || '-')}</code></td>
                <td class="text-center">${escapeHtml(item.year || '-')}</td>
                <td><span class="badge-status default">${escapeHtml(item.department || '-')}</span></td>
                <td class="col-wrap">${highlightText(item.objective)}</td>
                <td><small>${escapeHtml(item.kpiCode || '-')}</small></td>
                <td class="text-center"><strong>${escapeHtml(item.target || '-')}</strong></td>
                <td><span class="badge-status info">${escapeHtml(item.timeline || '-')}</span></td>
                <td>${escapeHtml(item.owner || '-')}</td>
                <td class="text-center">${item.weight ? `${item.weight}%` : '-'}</td>
                <td>${getStatusBadge(item.status, 'otp')}</td>
                <td><small>${formatDate(item.createdDate)}</small></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            data-action="otpHistory.viewDetail" 
                            data-params='${JSON.stringify({otpId: item.otpId}).replace(/'/g, "&#39;")}'>
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    // ============================================
    // ACTION METHODS
    // ============================================
    
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
        const refreshBtn = document.getElementById('refreshOtpHistoryBtn');
        setButtonLoading(refreshBtn, true, 'Memuat...');
        
        this.allData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterYear = '';
        
        this.clearFilterInputs();
        
        try {
            await this.loadData();
            this.isRefreshing = true;
            
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = await this.render();
                this.attachEventListeners();
            }
            
            this.isRefreshing = false;
            toast('Data OTP berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data', 'error');
        } finally {
            setButtonLoading(refreshBtn, false);
        }
    }

    async goToPage(params) {
        this.currentPage = params.page;
        await this.updateTableOnly();
    }

    async updateTableOnly() {
        const container = document.getElementById('otpHistoryContentContainer');
        if (!container) return;
        
        // Animate fade out
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.15s ease';
        
        await this.delay(100);
        
        // Get fresh data
        const filteredData = this.applyFiltersToData();
        this.updatePagination(filteredData.length);
        const paginatedData = this.getPaginatedData(filteredData);
        
        // Update table (renderTable is NOT async)
        container.innerHTML = this.renderTable(paginatedData);
        
        // Animate fade in
        requestAnimationFrame(() => {
            container.style.opacity = '1';
        });
        
        // Update pagination
        const cardHeader = container.closest('.app-card');
        if (cardHeader) {
            const badgeStatus = cardHeader.querySelector('.card-header .badge-status');
            if (badgeStatus) {
                badgeStatus.textContent = `Hal. ${this.currentPage} / ${this.totalPages || 1}`;
            }
            
            const existingPagination = cardHeader.querySelector('.border-top');
            if (this.totalPages > 1) {
                const newPagination = this.renderPagination();
                if (existingPagination) {
                    existingPagination.outerHTML = newPagination;
                } else {
                    cardHeader.insertAdjacentHTML('beforeend', newPagination);
                }
            } else {
                if (existingPagination) existingPagination.remove();
            }
        }
        
        // Update stats cards
        const statsCards = document.querySelector('.row.mb-md');
        if (statsCards) {
            statsCards.outerHTML = this.renderStatsCards();
        }
        
        this.attachEventListeners();
    }

    async clearFilters() {
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterYear = '';
        this.currentPage = 1;
        
        this.clearFilterInputs();
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    async search() {
        const el = document.getElementById('searchOtpHistoryInput');
        if (el) {
            this.searchQuery = el.value;
            this.currentPage = 1;
            await this.updateTableOnly();
        }
    }

    async filterByStatus() {
        const el = document.getElementById('filterStatusOtpHistoryInput');
        if (el) {
            this.filterStatus = el.value;
            this.currentPage = 1;
            await this.updateTableOnly();
        }
    }

    async filterByDepartment() {
        const el = document.getElementById('filterDeptOtpHistoryInput');
        if (el) {
            this.filterDept = el.value;
            this.currentPage = 1;
            await this.updateTableOnly();
        }
    }

    async filterByYear() {
        const el = document.getElementById('filterYearOtpHistoryInput');
        if (el) {
            this.filterYear = el.value;
            this.currentPage = 1;
            await this.updateTableOnly();
        }
    }

    clearFilterInputs() {
        setTimeout(() => {
            const inputs = ['searchOtpHistoryInput', 'filterStatusOtpHistoryInput', 
                           'filterDeptOtpHistoryInput', 'filterYearOtpHistoryInput'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
    }

    escapeRegex(str) {
        if (!str) return '';
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    attachEventListeners() {
        // Search input with debounce
        const searchInput = document.getElementById('searchOtpHistoryInput');
        if (searchInput) {
            let timeout;
            const newInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newInput, searchInput);
            
            newInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.searchQuery = e.target.value;
                    this.currentPage = 1;
                    this.updateTableOnly();
                }, 400);
            });
        }
        
        // Status filter
        const statusFilter = document.getElementById('filterStatusOtpHistoryInput');
        if (statusFilter) {
            const newFilter = statusFilter.cloneNode(true);
            statusFilter.parentNode.replaceChild(newFilter, statusFilter);
            newFilter.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.currentPage = 1;
                this.updateTableOnly();
            });
        }
        
        // Department filter
        const deptFilter = document.getElementById('filterDeptOtpHistoryInput');
        if (deptFilter) {
            const newFilter = deptFilter.cloneNode(true);
            deptFilter.parentNode.replaceChild(newFilter, deptFilter);
            newFilter.addEventListener('change', (e) => {
                this.filterDept = e.target.value;
                this.currentPage = 1;
                this.updateTableOnly();
            });
        }
        
        // Year filter
        const yearFilter = document.getElementById('filterYearOtpHistoryInput');
        if (yearFilter) {
            const newFilter = yearFilter.cloneNode(true);
            yearFilter.parentNode.replaceChild(newFilter, yearFilter);
            newFilter.addEventListener('change', (e) => {
                this.filterYear = e.target.value;
                this.currentPage = 1;
                this.updateTableOnly();
            });
        }
    }

    // Override dari BasePage
    updatePagination(totalItems) {
        this.totalData = totalItems;
        this.totalPages = Math.ceil(this.totalData / this.pageSize);
        
        if (this.currentPage > this.totalPages && this.totalPages > 0) {
            this.currentPage = this.totalPages;
        }
        if (this.currentPage < 1) this.currentPage = 1;
    }

    getPaginatedData(data) {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        return data.slice(startIndex, startIndex + this.pageSize);
    }

    getUniqueDepartments(data) {
        const depts = new Set();
        data.forEach(item => {
            if (item.department && item.department !== '-') {
                depts.add(item.department);
            }
        });
        return Array.from(depts).sort();
    }

    getUniqueYears(data) {
        const years = new Set();
        data.forEach(item => {
            if (item.year) {
                years.add(item.year.toString());
            }
        });
        if (years.size === 0) years.add(new Date().getFullYear().toString());
        return Array.from(years).sort((a, b) => b - a);
    }

    getUniqueStatuses(data) {
        const statuses = new Set();
        data.forEach(item => {
            if (item.status) {
                statuses.add(item.status);
            }
        });
        return Array.from(statuses).sort();
    }

    renderPagination() {
        if (this.totalPages <= 1) return '';
        
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
                        data-action="otpHistory.goToPage" data-params='{"page": ${i}}'>
                    ${i}
                </button>
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

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showLoading(message = 'Memuat data...') {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#otpHistorySkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header">
                    <div class="page-header-left">
                        <h1 class="page-title">OTP History</h1>
                        <p class="breadcrumb">Home / OTP Management / <span>OTP History</span></p>
                    </div>
                </div>
                <div class="app-card" id="otpHistorySkeletonLoader">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-hourglass-split"></i> ${message}</h3>
                    </div>
                    <div class="empty-state">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    hideLoading() {
        this.isLoading = false;
    }

    renderError(message) {
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">OTP History</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>OTP History</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Data</h2>
                    <p>${escapeHtml(message || 'Terjadi kesalahan')}</p>
                    <button class="btn btn-primary mt-md" data-action="otpHistory.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}