// pages/iadl.js
// IADL Page - Dengan Filter Pencarian dan Filter Departemen

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
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = []; // Store all data for local filtering
    }

    // ============================================
    // GOOGLE SHEETS API CALLS
    // ============================================
    
    async fetchFromSheets(action, params = {}) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            console.warn('Google Sheets not configured, using memory cache');
            const cachedData = this.db.getIADLCache();
            this.allData = this.formatData(cachedData);
            return {
                status: 'local',
                data: cachedData,
                total: cachedData.length
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
            
            // Store all raw data for filtering
            if (result.status === 'success' && result.data) {
                this.allData = this.formatData(result.data);
                // Cache to memory for offline fallback
                this.db.saveIADLCache(result.data);
            }
            
            return result;
            
        } catch (error) {
            console.error('Google Sheets fetch error:', error);
            const cachedData = this.db.getIADLCache();
            this.allData = this.formatData(cachedData);
            return {
                status: 'local',
                data: cachedData,
                total: cachedData.length,
                message: error.message
            };
        }
    }

    async getAllIADL() {
        return await this.fetchFromSheets('getAll');
    }

    async getIADLPaginated(page = 1, pageSize = 10, filters = {}) {
        // If using Google Sheets API, let the API handle filtering
        if (isGoogleSheetsEnabled() && !getWebAppUrl().includes('YOUR_WEB_APP_ID')) {
            return await this.fetchFromSheets('getPaginated', {
                page: page,
                pageSize: pageSize,
                filters: JSON.stringify(filters)
            });
        }
        
        // Local filtering mode (offline or not configured)
        return this.getLocalFilteredData(page, pageSize, filters);
    }
    
    // Local filtering when offline or using cached data
    getLocalFilteredData(page, pageSize, filters = {}) {
        let filteredData = [...this.allData];
        
        // Apply search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filteredData = filteredData.filter(item => 
                (item.aktivitas && item.aktivitas.toLowerCase().includes(searchLower)) ||
                (item.lokasi && item.lokasi.toLowerCase().includes(searchLower)) ||
                (item.deskripsiAspek && item.deskripsiAspek.toLowerCase().includes(searchLower)) ||
                (item.departemen && item.departemen.toLowerCase().includes(searchLower)) ||
                (item.id && item.id.toLowerCase().includes(searchLower))
            );
        }
        
        // Apply department filter
        if (filters.Departemen) {
            filteredData = filteredData.filter(item => 
                item.departemen === filters.Departemen
            );
        }
        
        const total = filteredData.length;
        const totalPages = Math.ceil(total / pageSize);
        const startIndex = (page - 1) * pageSize;
        const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);
        
        return {
            status: 'local',
            data: paginatedData,
            total: total,
            page: page,
            pageSize: pageSize,
            totalPages: totalPages
        };
    }

    // ============================================
    // DATA FORMATTING
    // ============================================
    
    formatItem(item) {
        if (!item) return {};
        
        // Mapping untuk header Google Sheets ke internal field
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
    // FILTER METHODS
    // ============================================
    
    // Get unique departments from data for filter dropdown
    getUniqueDepartments() {
        const departments = new Set();
        this.allData.forEach(item => {
            if (item.departemen && item.departemen !== '-') {
                departments.add(item.departemen);
            }
        });
        return Array.from(departments).sort();
    }

    // Apply all filters to data
    applyFilters() {
        let filtered = [...this.allData];
        
        // Apply search filter
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
        
        // Apply department filter
        if (this.filterDept) {
            filtered = filtered.filter(item => item.departemen === this.filterDept);
        }
        
        return filtered;
    }

    // ============================================
    // RENDER METHODS
    // ============================================
    
    async render() {
        this.showLoading();
        
        try {
            // Fetch all data first (only once)
            if (this.allData.length === 0) {
                const result = await this.getAllIADL();
                if (result.status === 'error') {
                    this.hideLoading();
                    return this.renderError(result.message || 'Gagal memuat data');
                }
            }
            
            // Apply filters locally
            const filteredData = this.applyFilters();
            
            // Update total and pagination
            this.totalData = filteredData.length;
            this.totalPages = Math.ceil(this.totalData / this.pageSize);
            
            // Ensure current page is valid
            if (this.currentPage > this.totalPages && this.totalPages > 0) {
                this.currentPage = this.totalPages;
            }
            if (this.currentPage < 1) this.currentPage = 1;
            
            // Get paginated data
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
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">IADL Monokem</h1>
                    <p class="breadcrumb">Home / <span>IADL Monokem</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" data-action="iadl.refresh">
                        <i class="bi bi-arrow-repeat"></i> Refresh
                    </button>
                </div>
            </div>

            <!-- Filter Section -->
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
                            <select id="filterDeptInput" class="form-select">
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

                <div class="table-wrapper">
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
                                <th style="min-width: 200px;">Regulasi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.length > 0 ? data.map((item, index) => this.renderTableRow(item, startIndex + index + 1)).join('') : `
                                <tr>
                                    <td colspan="14">
                                        <div class="empty-state">
                                            <i class="bi bi-inbox"></i>
                                            <h3>Tidak ada data</h3>
                                            <p>
                                                ${this.searchQuery || this.filterDept ? 
                                                    'Tidak ada data yang sesuai dengan filter yang dipilih' : 
                                                    'Data IADL tidak ditemukan di Google Sheets'}
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
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>
        `;
    }

    renderTableRow(item, rowNumber) {
        if (!item) return '';
        
        // Highlight search keyword in aktivitas and lokasi
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
    // ACTION METHODS
    // ============================================
    
    async goToPage(params, element) {
        this.currentPage = params.page;
        await this.refreshTable();
    }

    async refresh(params, element) {
        this.showLoading();
        // Clear cache and reload
        this.allData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterDept = '';
        
        // Clear input values
        setTimeout(() => {
            const searchInput = document.getElementById('searchIADLInput');
            const filterInput = document.getElementById('filterDeptInput');
            if (searchInput) searchInput.value = '';
            if (filterInput) filterInput.value = '';
        }, 100);
        
        await this.refreshTable(true);
        toast('Data IADL berhasil direfresh', 'success');
    }

    async search(params, element) {
        const searchInput = document.getElementById('searchIADLInput');
        if (searchInput) {
            this.searchQuery = searchInput.value;
            this.currentPage = 1; // Reset to first page when searching
            await this.refreshTable();
        }
    }

    async filterDepartment(params, element) {
        const filterInput = document.getElementById('filterDeptInput');
        if (filterInput) {
            this.filterDept = filterInput.value;
            this.currentPage = 1; // Reset to first page when filtering
            await this.refreshTable();
        }
    }
    
    async clearFilters(params, element) {
        this.searchQuery = '';
        this.filterDept = '';
        this.currentPage = 1;
        
        // Clear input values
        setTimeout(() => {
            const searchInput = document.getElementById('searchIADLInput');
            const filterInput = document.getElementById('filterDeptInput');
            if (searchInput) searchInput.value = '';
            if (filterInput) filterInput.value = '';
        }, 100);
        
        await this.refreshTable();
        toast('Filter dihapus', 'info');
    }

    async refreshTable(forceRefresh = false) {
        if (forceRefresh) {
            // Force reload from Google Sheets
            this.allData = [];
        }
        
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const html = await this.render();
            mainContent.innerHTML = html;
            this.attachEventListeners();
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    attachEventListeners() {
        // Search input with debounce
        const searchInput = document.getElementById('searchIADLInput');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.search();
                }, 500);
            });
        }
        
        // Filter select
        const filterInput = document.getElementById('filterDeptInput');
        if (filterInput) {
            filterInput.addEventListener('change', () => {
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

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.innerHTML.includes('spinner-border')) {
            mainContent.innerHTML = `
                <div class="app-card">
                    <div class="empty-state">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <h3 class="mt-md">Memuat Data IADL...</h3>
                        <p>Mengambil data dari Google Sheets</p>
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
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan saat menghubungi Google Sheets')}</p>
                    <button class="btn btn-primary mt-md" data-action="iadl.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}