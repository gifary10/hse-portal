// pages/iadl.js
import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class IADLPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.filterDept = '';
        this.isLoading = false;
        this.isRefreshing = false; // Flag untuk refresh tanpa blink
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = [];
        this.originalData = []; // Store original unfiltered data
        this.userDepartment = '';
        this.userRole = '';
    }

    // ============================================
    // GOOGLE SHEETS API CALLS
    // ============================================
    
    async fetchFromSheets(action, params = {}) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            console.warn('Google Sheets not configured, using memory cache');
            const cachedData = this.db.getIADLCache();
            this.originalData = this.formatData(cachedData);
            this.applyUserDepartmentFilter();
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

            console.log(`Fetching from Google Sheets: ${action}`, params);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.GOOGLE_SHEETS.TIMEOUT);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                this.originalData = this.formatData(result.data);
                this.applyUserDepartmentFilter();
                this.db.saveIADLCache(result.data);
            }
            
            return result;
            
        } catch (error) {
            console.error('Google Sheets fetch error:', error);
            const cachedData = this.db.getIADLCache();
            this.originalData = this.formatData(cachedData);
            this.applyUserDepartmentFilter();
            return {
                status: 'local',
                data: this.allData,
                total: this.allData.length,
                message: error.message
            };
        }
    }

    async getAllIADL() {
        return await this.fetchFromSheets('getAll');
    }

    // ============================================
    // DATA FORMATTING
    // ============================================
    
    formatItem(item) {
        if (!item) return {};
        
        const fieldMapping = {
            tanggal: ['TimeStamp', 'timestamp', 'Tanggal'],
            departemen: ['Departemen', 'departemen'],
            aktivitas: ['Aktifitas', 'aktivitas', 'Aktivitas'],
            lokasi: ['Lokasi', 'lokasi'],
            id: ['No Hazard', 'noHazard', 'no_hazard', 'id'],
            klasifikasi: ['Klasifikasi Resiko', 'klasifikasi', 'klasifikasi_resiko'],
            deskripsiAspek: ['Deskripsi Hazard', 'deskripsiAspek', 'deskripsi_hazard'],
            dampak: ['Dampak', 'dampak'],
            penilaianDampak: ['Penilaian Risiko', 'penilaianDampak', 'penilaian_risiko'],
            pengendalianDampak: ['Pengendalian Risiko', 'pengendalianDampak', 'pengendalian_risiko'],
            deskripsiPengendalian: ['Deskripsi Pengendalian', 'deskripsiPengendalian', 'deskripsi_pengendalian'],
            risikoSetelahPengendalian: ['Risiko Setelah Pengendalian', 'risikoSetelahPengendalian', 'risiko_setelah_pengendalian'],
            regulasi: ['Regulasi', 'regulasi']
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
    // DEPARTMENT FILTER (NEW)
    // ============================================
    
    /**
     * Apply department filter for department role users
     * This ensures department users only see IADL data for their department
     */
    applyUserDepartmentFilter() {
        const user = this.state.currentUser || {};
        this.userRole = user.role || '';
        this.userDepartment = user.department || '';
        
        if (this.userRole === 'department' && this.userDepartment) {
            // Filter only data for user's department
            this.allData = this.originalData.filter(item => 
                item.departemen === this.userDepartment
            );
            console.log(`Filtered IADL for department: ${this.userDepartment}, found ${this.allData.length} items`);
        } else {
            // For HSE or Top Management, show all data
            this.allData = [...this.originalData];
        }
    }

    // ============================================
    // FILTER METHODS
    // ============================================
    
    getUniqueDepartments() {
        const departments = new Set();
        this.allData.forEach(item => {
            if (item.departemen && item.departemen !== '-') {
                departments.add(item.departemen);
            }
        });
        return Array.from(departments).sort();
    }

    applyFilters() {
        let filtered = [...this.allData];
        
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.aktivitas && item.aktivitas.toLowerCase().includes(searchLower)) ||
                (item.lokasi && item.lokasi.toLowerCase().includes(searchLower)) ||
                (item.deskripsiAspek && item.deskripsiAspek.toLowerCase().includes(searchLower)) ||
                (item.departemen && item.departemen.toLowerCase().includes(searchLower)) ||
                (item.id && item.id.toLowerCase().includes(searchLower)) ||
                (item.dampak && item.dampak.toLowerCase().includes(searchLower))
            );
        }
        
        if (this.filterDept) {
            filtered = filtered.filter(item => item.departemen === this.filterDept);
        }
        
        return filtered;
    }

    // ============================================
    // RENDER METHODS
    // ============================================
    
    async render() {
        // Untuk first load, tampilkan full loading
        if (!this.isRefreshing) {
            this.showLoading();
        }
        
        try {
            if (this.allData.length === 0 && this.originalData.length === 0) {
                const result = await this.getAllIADL();
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
        const user = this.state.currentUser || {};
        const isDepartmentRole = user.role === 'department';
        const filterInfo = isDepartmentRole && this.userDepartment ? 
            `<span class="badge-status info" style="margin-left: 8px;"><i class="bi bi-building"></i> Departemen: ${this.escapeHtml(this.userDepartment)}</span>` : '';
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">IADL Monokem</h1>
                    <p class="breadcrumb">Home / <span>IADL Monokem</span></p>
                </div>
                <div class="d-flex gap-sm">
                    ${filterInfo}
                    <button class="btn btn-outline-primary" id="refreshIADLBtn" data-action="iadl.refresh">
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
                            Menampilkan data IADL untuk departemen <strong>${this.escapeHtml(this.userDepartment)}</strong>.
                            ${this.allData.length === 0 ? 'Belum ada data IADL untuk departemen Anda.' : `Ditemukan ${this.allData.length} record.`}
                        </p>
                    </div>
                </div>
            </div>
            ` : ''}

            <div class="filter-section">
                <div class="row">
                    <div class="col-md-5">
                        <div class="form-group-custom">
                            <label><i class="bi bi-search"></i> Cari Data</label>
                            <input type="text" 
                                   id="searchIADLInput" 
                                   class="form-control"
                                   placeholder="Cari aktivitas, lokasi, hazard, atau dampak..." 
                                   value="${this.escapeHtml(this.searchQuery)}">
                            ${this.searchQuery ? `<small class="text-muted">Menampilkan hasil untuk: "${this.escapeHtml(this.searchQuery)}"</small>` : ''}
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Filter Departemen</label>
                            <select id="filterDeptInput" class="form-select" ${isDepartmentRole ? 'disabled' : ''}>
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
                            <label>Hasil Filter</label>
                            <div class="mt-2">
                                <span class="badge-status info">
                                    <i class="bi bi-database"></i> ${this.totalData} Record
                                </span>
                                ${(this.searchQuery || this.filterDept) ? `
                                    <button class="btn btn-sm btn-link" data-action="iadl.clearFilters" style="margin-left: 8px;">
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
                        <i class="bi bi-file-earmark-text"></i> 
                        Identifikasi Aspek dan Dampak Lingkungan (IADL)
                    </h3>
                    <span class="badge-status info">Halaman ${this.currentPage} dari ${this.totalPages || 1}</span>
                </div>

                <div class="table-wrapper" id="iadlTableWrapper">
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
                    <i class="bi bi-inbox"></i>
                    <h3>Tidak ada data</h3>
                    <p>
                        ${isDepartmentRole ? 
                            'Belum ada data IADL untuk departemen Anda. Silakan hubungi administrator.' : 
                            (this.searchQuery || this.filterDept ? 
                                'Tidak ada data yang sesuai dengan filter yang dipilih' : 
                                'Data IADL tidak ditemukan di Google Sheets')}
                    </p>
                    ${(this.searchQuery || this.filterDept) ? `
                        <button class="btn btn-primary mt-md" data-action="iadl.clearFilters">
                            <i class="bi bi-eraser"></i> Hapus Filter
                        </button>
                    ` : `
                        <button class="btn btn-primary mt-md" data-action="iadl.refresh">
                            <i class="bi bi-arrow-repeat"></i> Refresh Data
                        </button>
                    `}
                </div>
            `;
        }
        
        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 50px;">No.</th>
                        <th style="min-width: 100px;">TimeStamp</th>
                        <th style="min-width: 120px;">Departemen</th>
                        <th style="min-width: 200px;">Aktivitas</th>
                        <th style="min-width: 150px;">Lokasi</th>
                        <th style="min-width: 100px;">No Hazard</th>
                        <th style="min-width: 120px;">Klasifikasi Resiko</th>
                        <th style="min-width: 200px;">Deskripsi Hazard</th>
                        <th style="min-width: 150px;">Dampak</th>
                        <th style="min-width: 130px;">Penilaian Risiko</th>
                        <th style="min-width: 150px;">Pengendalian Risiko</th>
                        <th style="min-width: 200px;">Deskripsi Pengendalian</th>
                        <th style="min-width: 150px;">Risiko Setelah Pengendalian</th>
                        <th style="min-width: 300px;">Regulasi</th>
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
            return this.escapeHtml(text).replace(regex, '<mark style="background: var(--accent-light); padding: 0 2px; border-radius: 3px;">$1</mark>');
        };
        
        return `
            <tr>
                <td class="text-center">${rowNumber}</td>
                <td>${this.formatDate(item.tanggal)}</td>
                <td><span class="badge-status default">${this.escapeHtml(item.departemen || '-')}</span></td>
                <td class="col-wrap">${highlightText(item.aktivitas)}</td>
                <td class="col-wrap">${highlightText(item.lokasi)}</td>
                <td class="text-center"><code>${this.escapeHtml(item.id || '-')}</code></td>
                <td>${this.getBadge(item.klasifikasi)}</td>
                <td class="col-wrap">${highlightText(item.deskripsiAspek)}</td>
                <td class="col-wrap">${highlightText(item.dampak)}</td>
                <td>${this.getBadge(item.penilaianDampak)}</td>
                <td class="col-wrap">${this.escapeHtml(item.pengendalianDampak || '-')}</td>
                <td class="col-wrap">${this.escapeHtml(item.deskripsiPengendalian || '-')}</td>
                <td>${this.getBadge(item.risikoSetelahPengendalian)}</td>
                <td class="col-wrap">${this.escapeHtml(item.regulasi || '-')}</td>
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
                        data-action="iadl.goToPage" 
                        data-params='{"page": ${i}}'>
                    ${i}
                </button>
            `;
        }
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalData);
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startItem}-${endItem} dari ${this.totalData} data
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" 
                            data-action="iadl.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" 
                            data-action="iadl.goToPage" 
                            data-params='{"page": ${this.currentPage + 1}}'
                            ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // ACTION METHODS (dengan perbaikan UX)
    // ============================================
    
    async goToPage(params, element) {
        this.currentPage = params.page;
        await this.updateTableOnly();
    }

    async refresh(params, element) {
        const refreshBtn = document.getElementById('refreshIADLBtn');
        
        // Set loading state pada tombol
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span>Memuat...</span>';
        }
        
        // Clear cache dan reload
        this.originalData = [];
        this.allData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterDept = '';
        
        // Clear input values
        setTimeout(() => {
            const searchInput = document.getElementById('searchIADLInput');
            const filterInput = document.getElementById('filterDeptInput');
            if (searchInput) searchInput.value = '';
            if (filterInput && !filterInput.disabled) filterInput.value = '';
        }, 100);
        
        try {
            // Fetch data baru dari server
            await this.getAllIADL();
            
            // Update tabel saja, tanpa merender ulang seluruh halaman
            this.isRefreshing = true;
            await this.updateTableOnly();
            this.isRefreshing = false;
            
            toast('Data terbaru sudah ditampilkan', 'success');
        } catch (error) {
            toast('Gagal memuat data. Silakan coba lagi.', 'error');
        } finally {
            // Kembalikan tombol
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> <span>Refresh</span>';
            }
        }
    }

    async search() {
        const searchInput = document.getElementById('searchIADLInput');
        if (searchInput) {
            this.searchQuery = searchInput.value;
            this.currentPage = 1;
            await this.updateTableOnly();
        }
    }

    async filterDepartment() {
        const filterInput = document.getElementById('filterDeptInput');
        if (filterInput && !filterInput.disabled) {
            this.filterDept = filterInput.value;
            this.currentPage = 1;
            await this.updateTableOnly();
        }
    }
    
    async clearFilters(params, element) {
        this.searchQuery = '';
        this.filterDept = '';
        this.currentPage = 1;
        
        setTimeout(() => {
            const searchInput = document.getElementById('searchIADLInput');
            const filterInput = document.getElementById('filterDeptInput');
            if (searchInput) searchInput.value = '';
            if (filterInput && !filterInput.disabled) filterInput.value = '';
        }, 100);
        
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    // Method baru: update tabel tanpa blink
    async updateTableOnly() {
        const tableWrapper = document.getElementById('iadlTableWrapper');
        const paginationContainer = document.querySelector('.app-card .d-flex.justify-content-between');
        
        if (!tableWrapper) {
            // Jika elemen tidak ditemukan, fallback ke full render
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                const html = await this.render();
                mainContent.innerHTML = html;
                this.attachEventListeners();
            }
            return;
        }
        
        // Apply filters
        const filteredData = this.applyFilters();
        
        // Update pagination info
        this.totalData = filteredData.length;
        this.totalPages = Math.ceil(this.totalData / this.pageSize);
        
        // Get current page data
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const paginatedData = filteredData.slice(startIndex, startIndex + this.pageSize);
        
        // Update tabel dengan animasi subtle
        tableWrapper.style.opacity = '0.5';
        tableWrapper.innerHTML = this.renderTable(paginatedData, startIndex);
        
        requestAnimationFrame(() => {
            tableWrapper.style.transition = 'opacity 0.2s ease';
            tableWrapper.style.opacity = '1';
        });
        
        // Update pagination jika ada
        const cardHeader = tableWrapper.closest('.app-card');
        if (cardHeader) {
            const badgeStatus = cardHeader.querySelector('.card-header .badge-status');
            if (badgeStatus) {
                badgeStatus.textContent = `Halaman ${this.currentPage} dari ${this.totalPages || 1}`;
            }
            
            // Update pagination
            const existingPagination = cardHeader.querySelector('.border-top');
            if (this.totalPages > 1) {
                const newPagination = this.renderPagination();
                if (existingPagination) {
                    existingPagination.outerHTML = newPagination;
                } else {
                    cardHeader.insertAdjacentHTML('beforeend', newPagination);
                }
            } else {
                if (existingPagination) {
                    existingPagination.remove();
                }
            }
        }
        
        this.attachEventListeners();
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    attachEventListeners() {
        const searchInput = document.getElementById('searchIADLInput');
        if (searchInput) {
            let timeout;
            // Hapus event listener lama dengan clone
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            
            newSearchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.search();
                }, 500);
            });
        }
        
        const filterInput = document.getElementById('filterDeptInput');
        if (filterInput && !filterInput.disabled) {
            const newFilterInput = filterInput.cloneNode(true);
            filterInput.parentNode.replaceChild(newFilterInput, filterInput);
            
            newFilterInput.addEventListener('change', () => {
                this.filterDepartment();
            });
        }
    }

    getBadge(value) {
        const badges = {
            'Tinggi': 'danger',
            'Sedang': 'warning',
            'Rendah': 'success'
        };
        const label = value || '-';
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
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    renderSkeleton() {
        const skeletonRows = Array(5).fill(0).map(() => `
            <tr class="skeleton-row">
                <td class="text-center"><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 30px; margin: 0 auto;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 80px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 100px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 150px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 120px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 80px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 90px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 160px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 130px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 100px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 140px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 160px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 130px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 150px;"></div></td>
            </tr>
        `).join('');

        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 50px;">No.</th>
                        <th>TimeStamp</th>
                        <th>Departemen</th>
                        <th>Aktivitas</th>
                        <th>Lokasi</th>
                        <th>No Hazard</th>
                        <th>Klasifikasi Resiko</th>
                        <th>Deskripsi Hazard</th>
                        <th>Dampak</th>
                        <th>Penilaian Risiko</th>
                        <th>Pengendalian Risiko</th>
                        <th>Deskripsi Pengendalian</th>
                        <th>Risiko Setelah</th>
                        <th>Regulasi</th>
                    </tr>
                </thead>
                <tbody>
                    ${skeletonRows}
                </tbody>
            </table>
        `;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#iadlSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header">
                    <div class="page-header-left">
                        <h1 class="page-title">IADL Monokem</h1>
                        <p class="breadcrumb">Home / <span>IADL Monokem</span></p>
                    </div>
                </div>
                <div class="app-card" id="iadlSkeletonLoader">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="bi bi-file-earmark-text"></i> 
                            Identifikasi Aspek dan Dampak Lingkungan (IADL)
                        </h3>
                    </div>
                    <div class="table-wrapper">
                        ${this.renderSkeleton()}
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
                    <h1 class="page-title">IADL Monokem</h1>
                    <p class="breadcrumb">Home / <span>IADL Monokem</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Data</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan saat menghubungi server')}</p>
                    <button class="btn btn-primary mt-md" data-action="iadl.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}