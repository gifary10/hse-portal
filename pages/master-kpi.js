// pages/master-kpi.js
import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class MasterKPIPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.filterDept = '';
        this.filterCategory = '';
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = [];
        this.originalData = []; // Store original unfiltered data
        this.userDepartment = '';
        this.userRole = '';
    }

    async fetchFromSheets(action, params = {}) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return {
                status: 'local',
                data: this.allData,
                total: this.allData.length
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
                this.originalData = this.formatData(result.data);
                // Apply department filter based on user role
                this.applyUserDepartmentFilter();
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

    async getAllKPI() {
        return await this.fetchFromSheets('getAllKPI');
    }

    formatItem(item) {
        if (!item) return {};
        
        const fieldMapping = {
            kpiCode: ['KPI_Code', 'KPI Code', 'kpiCode', 'kpi_code'],
            kpiName: ['KPI_Name', 'KPI Name', 'kpiName', 'kpi_name'],
            department: ['Department', 'department', 'Departemen'],
            category: ['Category', 'category', 'Kategori', 'Perspective'],
            uom: ['UOM', 'uom', 'Satuan', 'Unit'],
            polarity: ['Polarity', 'polarity', 'Polaritas'],
            formula: ['Formula', 'formula', 'Rumus'],
            dataSource: ['Data_Source', 'Data Source', 'dataSource', 'data_source', 'Sumber_Data'],
            status: ['Status', 'status']
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

    /**
     * Apply department filter for department role users
     * This ensures department users only see KPI data for their department
     */
    applyUserDepartmentFilter() {
        const user = this.state.currentUser || {};
        this.userRole = user.role || '';
        this.userDepartment = user.department || '';
        
        if (this.userRole === 'department' && this.userDepartment) {
            // Filter only data for user's department
            this.allData = this.originalData.filter(item => 
                item.department === this.userDepartment
            );
            console.log(`Filtered Master KPI for department: ${this.userDepartment}, found ${this.allData.length} items`);
        } else {
            // For HSE or Top Management, show all data
            this.allData = [...this.originalData];
        }
    }

    getUniqueDepartments() {
        const departments = new Set();
        this.allData.forEach(item => {
            if (item.department && item.department !== '-') {
                departments.add(item.department);
            }
        });
        return Array.from(departments).sort();
    }

    getUniqueCategories() {
        const categories = new Set();
        this.allData.forEach(item => {
            if (item.category && item.category !== '-') {
                categories.add(item.category);
            }
        });
        return Array.from(categories).sort();
    }

    applyFilters() {
        let filtered = [...this.allData];
        
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.kpiCode && item.kpiCode.toLowerCase().includes(searchLower)) ||
                (item.kpiName && item.kpiName.toLowerCase().includes(searchLower)) ||
                (item.department && item.department.toLowerCase().includes(searchLower)) ||
                (item.category && item.category.toLowerCase().includes(searchLower))
            );
        }
        
        if (this.filterDept) {
            filtered = filtered.filter(item => item.department === this.filterDept);
        }
        
        if (this.filterCategory) {
            filtered = filtered.filter(item => item.category === this.filterCategory);
        }
        
        return filtered;
    }

    async render() {
        if (!this.isRefreshing) this.showLoading();
        
        try {
            if (this.allData.length === 0 && this.originalData.length === 0) {
                const result = await this.getAllKPI();
                if (result.status === 'error') {
                    this.hideLoading();
                    return this.renderError(result.message || 'Gagal memuat data');
                }
            } else if (this.originalData.length > 0 && this.allData.length === 0) {
                // Re-apply filter if data exists but allData is empty
                this.applyUserDepartmentFilter();
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
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const uniqueDepts = this.getUniqueDepartments();
        const uniqueCategories = this.getUniqueCategories();
        const user = this.state.currentUser || {};
        const isDepartmentRole = user.role === 'department';
        const filterInfo = isDepartmentRole && this.userDepartment ? 
            `<span class="badge-status info" style="margin-left: 8px;"><i class="bi bi-building"></i> Departemen: ${this.escapeHtml(this.userDepartment)}</span>` : '';
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Master KPI</h1>
                    <p class="breadcrumb">Home / Master Data / <span>Master KPI</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <span class="badge-status info" style="margin-right: 8px;">
                        <i class="bi bi-info-circle"></i> Referensi
                    </span>
                    ${filterInfo}
                    <button class="btn btn-outline-primary" id="refreshKPIBtn" data-action="masterKPI.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            ${isDepartmentRole ? `
            <div class="app-card app-card-info mb-md" style="background: #f0fdf4; border-left: 4px solid var(--success);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-building" style="color: var(--success); font-size: 1.2rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">Filter Departemen</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Menampilkan data KPI untuk departemen <strong>${this.escapeHtml(this.userDepartment)}</strong>.
                            ${this.allData.length === 0 ? 'Belum ada data KPI untuk departemen Anda.' : `Ditemukan ${this.allData.length} KPI.`}
                        </p>
                    </div>
                </div>
            </div>
            ` : `
            <div class="app-card app-card-info mb-md" style="background: #f0f9ff; border-left: 4px solid var(--info);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-info-circle-fill" style="color: var(--info); font-size: 1.2rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">Data Referensi KPI</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Halaman ini menampilkan master data KPI yang digunakan sebagai referensi saat departemen membuat OTP.
                            Data dikelola oleh Administrator/HSE melalui Google Sheets.
                        </p>
                    </div>
                </div>
            </div>
            `}

            <div class="filter-section">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-search"></i> Cari KPI</label>
                            <input type="text" id="searchKPIInput" class="form-control"
                                   placeholder="Cari kode, nama KPI..." 
                                   value="${this.escapeHtml(this.searchQuery)}">
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Filter Departemen</label>
                            <select id="filterDeptKPIInput" class="form-select" ${isDepartmentRole ? 'disabled' : ''}>
                                <option value="">Semua Departemen</option>
                                ${uniqueDepts.map(dept => `
                                    <option value="${this.escapeHtml(dept)}" ${this.filterDept === dept ? 'selected' : ''}>
                                        ${this.escapeHtml(dept)}
                                    </option>
                                `).join('')}
                            </select>
                            ${isDepartmentRole ? '<small class="text-muted">Filter dibatasi sesuai departemen Anda</small>' : ''}
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group-custom">
                            <label><i class="bi bi-tag"></i> Filter Kategori</label>
                            <select id="filterCategoryKPIInput" class="form-select">
                                <option value="">Semua Kategori</option>
                                ${uniqueCategories.map(cat => `
                                    <option value="${this.escapeHtml(cat)}" ${this.filterCategory === cat ? 'selected' : ''}>
                                        ${this.escapeHtml(cat)}
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
                                    <i class="bi bi-database"></i> ${this.totalData} KPI
                                </span>
                                ${(this.searchQuery || this.filterDept || this.filterCategory) ? `
                                    <button class="btn btn-sm btn-link" data-action="masterKPI.clearFilters" 
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
                        <i class="bi bi-bullseye"></i> 
                        Key Performance Indicators
                    </h3>
                    <span class="badge-status info">Hal. ${this.currentPage} / ${this.totalPages || 1}</span>
                </div>
                <div class="table-wrapper" id="kpiTableWrapper">
                    ${this.renderTable(data, startIndex)}
                </div>
                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>
        `;
    }
    
    renderTable(data, startIndex) {
        if (data.length === 0) {
            const user = this.state.currentUser || {};
            const isDepartmentRole = user.role === 'department';
            
            return `
                <div class="empty-state">
                    <i class="bi bi-bullseye" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <h3>Tidak ada data KPI</h3>
                    <p>${isDepartmentRole ? 
                        'Belum ada data KPI untuk departemen Anda. Silakan hubungi administrator.' : 
                        (this.searchQuery || this.filterDept || this.filterCategory ? 
                            'Tidak ada KPI yang sesuai dengan filter' : 
                            'Data KPI belum tersedia')}
                    </p>
                    <button class="btn btn-primary mt-md" 
                            data-action="${(this.searchQuery || this.filterDept || this.filterCategory) ? 'masterKPI.clearFilters' : 'masterKPI.refresh'}">
                        <i class="bi ${(this.searchQuery || this.filterDept || this.filterCategory) ? 'bi-eraser' : 'bi-arrow-repeat'}"></i> 
                        ${(this.searchQuery || this.filterDept || this.filterCategory) ? 'Hapus Filter' : 'Refresh Data'}
                    </button>
                </div>
            `;
        }
        
        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 40px;">No</th>
                        <th style="min-width: 100px;">KPI Code</th>
                        <th style="min-width: 250px;">KPI Name</th>
                        <th style="min-width: 120px;">Department</th>
                        <th style="min-width: 100px;">Category</th>
                        <th style="min-width: 70px;">UOM</th>
                        <th style="min-width: 100px;">Polarity</th>
                        <th style="min-width: 200px;">Formula</th>
                        <th style="min-width: 120px;">Data Source</th>
                        <th style="min-width: 70px;">Status</th>
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
        
        const highlightText = (text) => {
            if (!this.searchQuery || !text) return this.escapeHtml(text || '-');
            const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
            return this.escapeHtml(text).replace(regex, 
                '<mark style="background: var(--accent-light); padding: 0 2px; border-radius: 3px;">$1</mark>');
        };
        
        return `
            <tr>
                <td class="text-center">${rowNumber}</td>
                <td><code style="background: #f0f7ff; padding: 2px 6px; border-radius: 3px;">${this.escapeHtml(item.kpiCode || '-')}</code></td>
                <td class="col-wrap"><strong>${highlightText(item.kpiName)}</strong></td>
                <td><span class="badge-status default">${this.escapeHtml(item.department || '-')}</span></td>
                <td>${this.getCategoryBadge(item.category)}</td>
                <td class="text-center">${this.escapeHtml(item.uom || '-')}</td>
                <td>${this.getPolarityBadge(item.polarity)}</td>
                <td class="col-wrap"><small><code>${this.escapeHtml(item.formula || '-')}</code></small></td>
                <td>${this.escapeHtml(item.dataSource || '-')}</td>
                <td>${this.getStatusBadge(item.status)}</td>
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
                        data-action="masterKPI.goToPage" data-params='{"page": ${i}}'>${i}</button>
            `;
        }
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalData);
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startItem}-${endItem} dari ${this.totalData} KPI
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" data-action="masterKPI.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" data-action="masterKPI.goToPage" 
                            data-params='{"page": ${this.currentPage + 1}}'
                            ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    async goToPage(params) { this.currentPage = params.page; await this.updateTableOnly(); }

    async refresh() {
        const refreshBtn = document.getElementById('refreshKPIBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.originalData = [];
        this.allData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterDept = '';
        this.filterCategory = '';
        
        setTimeout(() => {
            ['searchKPIInput', 'filterDeptKPIInput', 'filterCategoryKPIInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        try {
            await this.getAllKPI();
            this.isRefreshing = true;
            await this.updateTableOnly();
            this.isRefreshing = false;
            toast('Data KPI berhasil dimuat ulang', 'success');
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
        const el = document.getElementById('searchKPIInput');
        if (el) { this.searchQuery = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterDepartment() {
        const el = document.getElementById('filterDeptKPIInput');
        if (el && !el.disabled) { this.filterDept = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterCategory() {
        const el = document.getElementById('filterCategoryKPIInput');
        if (el) { this.filterCategory = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }
    
    async clearFilters() {
        this.searchQuery = '';
        this.filterDept = '';
        this.filterCategory = '';
        this.currentPage = 1;
        
        setTimeout(() => {
            ['searchKPIInput', 'filterDeptKPIInput', 'filterCategoryKPIInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    async updateTableOnly() {
        const tableWrapper = document.getElementById('kpiTableWrapper');
        
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
        tableWrapper.innerHTML = this.renderTable(paginatedData, startIndex);
        
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
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        ['searchKPIInput', 'filterDeptKPIInput', 'filterCategoryKPIInput'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            
            if (id === 'searchKPIInput') {
                let timeout;
                newEl.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => this.search(), 400);
                });
            } else if (id === 'filterDeptKPIInput' && !newEl.disabled) {
                newEl.addEventListener('change', () => this.filterDepartment());
            } else if (id === 'filterCategoryKPIInput') {
                newEl.addEventListener('change', () => this.filterCategory());
            }
        });
    }

    getCategoryBadge(value) {
        const badges = {
            'Financial': 'success', 'Customer': 'info', 'Internal Process': 'warning',
            'Learning & Growth': 'primary', 'HSE': 'danger', 'Quality': 'info', 'Production': 'warning'
        };
        const label = value || 'Other';
        return `<span class="badge-status ${badges[label] || 'default'}">${label}</span>`;
    }

    getPolarityBadge(value) {
        const badges = { 'Higher is Better': 'success', 'Lower is Better': 'danger', 'On Target': 'info' };
        const label = value || '-';
        return `<span class="badge-status ${badges[label] || 'default'}">${label}</span>`;
    }

    getStatusBadge(value) {
        const badges = { 'Active': 'success', 'active': 'success', 'Inactive': 'danger', 'inactive': 'danger' };
        const label = value || 'Active';
        return `<span class="badge-status ${badges[label] || 'success'}">${label}</span>`;
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
                <th class="text-center" style="width:40px;">No</th><th>KPI Code</th><th>KPI Name</th>
                <th>Department</th><th>Category</th><th>UOM</th><th>Polarity</th>
                <th>Formula</th><th>Data Source</th><th>Status</th>
            </tr></thead><tbody>
                ${Array(5).fill(0).map(() => `
                    <tr class="skeleton-row">
                        <td class="text-center"><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:25px;margin:0 auto;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:200px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:90px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:50px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:90px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:140px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:100px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:60px;"></div></td>
                    </tr>
                `).join('')}
            </tbody></table>
        `;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#kpiSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">Master KPI</h1>
                    <p class="breadcrumb">Home / Master Data / <span>Master KPI</span></p>
                </div></div>
                <div class="app-card" id="kpiSkeletonLoader">
                    <div class="card-header"><h3 class="card-title"><i class="bi bi-bullseye"></i> Key Performance Indicators</h3></div>
                    <div class="table-wrapper">${this.renderSkeleton()}</div>
                </div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Master KPI</h1>
                <p class="breadcrumb">Home / Master Data / <span>Master KPI</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-action="masterKPI.refresh">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }
}