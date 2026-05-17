// pages/temuan-daftar.js
// Daftar Temuan Page - Menampilkan list temuan audit internal
// Dengan filter, search, dan status tracking
// [UPDATED: Dihapus kolom Bukti Objektif, Pihak Terkait, Penanggung Jawab]

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class TemuanDaftarPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterKategori = '';
        this.filterKlasifikasi = '';
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = [];
    }

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

    async getAllTemuan() {
        const user = this.state.currentUser;
        const userDept = user?.department || '';
        const userRole = user?.role || '';
        
        if (userRole === 'department' && userDept) {
            return await this.fetchFromSheets('getTemuanByDept', { department: userDept });
        }
        
        return await this.fetchFromSheets('getAllTemuan');
    }

    formatItem(item) {
        if (!item) return {};
        
        const fieldMapping = {
            temuanId: ['Temuan_ID', 'temuanId', 'temuan_id', 'ID_Temuan'],
            department: ['Department', 'department', 'Departemen'],
            tanggalAudit: ['Tanggal_Audit', 'tanggalAudit', 'tanggal_audit'],
            kategoriTemuan: ['Kategori_Temuan', 'kategoriTemuan', 'kategori_temuan'],
            klasifikasi: ['Klasifikasi', 'klasifikasi'],
            uraianTemuan: ['Uraian_Temuan', 'uraianTemuan', 'uraian_temuan'],
            lokasi: ['Lokasi', 'lokasi'],
            akarMasalah: ['Akar_Masalah', 'akarMasalah', 'akar_masalah'],
            dampak: ['Dampak', 'dampak'],
            rekomendasi: ['Rekomendasi', 'rekomendasi'],
            targetSelesai: ['Target_Selesai', 'targetSelesai', 'target_selesai'],
            prioritas: ['Prioritas', 'prioritas'],
            status: ['Status', 'status'],
            createdAt: ['Created_At', 'createdAt', 'created_at'],
            createdBy: ['Created_By', 'createdBy', 'created_by'],
            auditorDept: ['Auditor_Dept', 'auditorDept', 'auditor_dept'],
            tindakanPerbaikan: ['Tindakan_Perbaikan', 'tindakanPerbaikan', 'tindakan_perbaikan'],
            tindakanPencegahan: ['Tindakan_Pencegahan', 'tindakanPencegahan', 'tindakan_pencegahan'],
            tglSelesai: ['Tgl_Selesai', 'tglSelesai', 'tgl_selesai']
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

    getUniqueDepartments() {
        const departments = new Set();
        this.allData.forEach(item => {
            if (item.department && item.department !== '-') departments.add(item.department);
        });
        return Array.from(departments).sort();
    }

    getUniqueStatuses() {
        const statuses = new Set();
        this.allData.forEach(item => {
            if (item.status) statuses.add(item.status);
        });
        return Array.from(statuses).sort();
    }

    getUniqueKategori() {
        const kategoris = new Set();
        this.allData.forEach(item => {
            if (item.kategoriTemuan) kategoris.add(item.kategoriTemuan);
        });
        return Array.from(kategoris).sort();
    }

    getUniqueKlasifikasi() {
        const klasifikasis = new Set();
        this.allData.forEach(item => {
            if (item.klasifikasi) klasifikasis.add(item.klasifikasi);
        });
        return Array.from(klasifikasis).sort();
    }

    applyFilters() {
        let filtered = [...this.allData];
        
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.temuanId && item.temuanId.toLowerCase().includes(searchLower)) ||
                (item.uraianTemuan && item.uraianTemuan.toLowerCase().includes(searchLower)) ||
                (item.department && item.department.toLowerCase().includes(searchLower)) ||
                (item.lokasi && item.lokasi.toLowerCase().includes(searchLower))
            );
        }
        
        if (this.filterStatus) {
            filtered = filtered.filter(item => item.status === this.filterStatus);
        }
        
        if (this.filterDept) {
            filtered = filtered.filter(item => item.department === this.filterDept);
        }
        
        if (this.filterKategori) {
            filtered = filtered.filter(item => item.kategoriTemuan === this.filterKategori);
        }
        
        if (this.filterKlasifikasi) {
            filtered = filtered.filter(item => item.klasifikasi === this.filterKlasifikasi);
        }
        
        return filtered;
    }

    async render() {
        if (!this.isRefreshing) this.showLoading();
        
        try {
            if (this.allData.length === 0) {
                const result = await this.getAllTemuan();
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
        const uniqueStatuses = this.getUniqueStatuses();
        const uniqueKategoris = this.getUniqueKategori();
        const uniqueKlasifikasis = this.getUniqueKlasifikasi();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Daftar Temuan</h1>
                    <p class="breadcrumb">Home / Temuan Audit Internal / <span>Daftar Temuan</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-primary" data-page="temuan-input">
                        <i class="bi bi-plus-lg"></i> Input Temuan
                    </button>
                    <button class="btn btn-outline-primary" id="refreshTemuanBtn" data-action="temuanDaftar.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            ${this.renderStatsCards()}

            <div class="filter-section">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-search"></i> Cari</label>
                            <input type="text" id="searchTemuanInput" class="form-control"
                                   placeholder="Cari ID, uraian, lokasi..." 
                                   value="${this.escapeHtml(this.searchQuery)}">
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-flag"></i> Status</label>
                            <select id="filterStatusInput" class="form-select">
                                <option value="">Semua Status</option>
                                ${uniqueStatuses.map(s => `
                                    <option value="${this.escapeHtml(s)}" ${this.filterStatus === s ? 'selected' : ''}>${this.escapeHtml(s)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-building"></i> Departemen</label>
                            <select id="filterDeptTemuanInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueDepts.map(d => `
                                    <option value="${this.escapeHtml(d)}" ${this.filterDept === d ? 'selected' : ''}>${this.escapeHtml(d)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-tag"></i> Kategori</label>
                            <select id="filterKategoriInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueKategoris.map(k => `
                                    <option value="${this.escapeHtml(k)}" ${this.filterKategori === k ? 'selected' : ''}>${this.escapeHtml(k)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-exclamation-triangle"></i> Klasifikasi</label>
                            <select id="filterKlasifikasiInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueKlasifikasis.map(k => `
                                    <option value="${this.escapeHtml(k)}" ${this.filterKlasifikasi === k ? 'selected' : ''}>${this.escapeHtml(k)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="row mt-sm">
                    <div class="col-12">
                        <span class="badge-status info">
                            <i class="bi bi-database"></i> ${this.totalData} Temuan
                        </span>
                        ${(this.searchQuery || this.filterStatus || this.filterDept || this.filterKategori || this.filterKlasifikasi) ? `
                            <button class="btn btn-sm btn-link" data-action="temuanDaftar.clearFilters" 
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
                        <i class="bi bi-list-check"></i> Daftar Temuan Audit
                    </h3>
                    <span class="badge-status info">Hal. ${this.currentPage} / ${this.totalPages || 1}</span>
                </div>
                <div class="table-wrapper" id="temuanTableWrapper">
                    ${this.renderTable(data)}
                </div>
                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>
        `;
    }

    renderStatsCards() {
        const total = this.allData.length;
        const open = this.allData.filter(t => t.status === 'Open').length;
        const inProgress = this.allData.filter(t => t.status === 'In Progress').length;
        const closed = this.allData.filter(t => t.status === 'Closed').length;
        const verified = this.allData.filter(t => t.status === 'Verified').length;
        
        return `
            <div class="row mb-md">
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">${open}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Open</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">${inProgress}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">In Progress</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${closed}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Closed</div>
                    </div>
                </div>
                <div class="col-md-3 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--info);">${verified}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Verified</div>
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
                    <h3>Tidak ada temuan</h3>
                    <p>${this.searchQuery || this.filterStatus || this.filterDept ? 
                        'Tidak ada temuan yang sesuai dengan filter' : 
                        'Belum ada temuan audit yang dicatat.'}</p>
                    <button class="btn btn-primary mt-md" data-page="temuan-input">
                        <i class="bi bi-plus-lg"></i> Input Temuan
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
                        <th style="min-width: 100px;">ID Temuan</th>
                        <th style="min-width: 90px;">Tgl Audit</th>
                        <th style="min-width: 100px;">Department</th>
                        <th style="min-width: 90px;">Kategori</th>
                        <th style="min-width: 80px;">Klasifikasi</th>
                        <th style="min-width: 200px;">Uraian Temuan</th>
                        <th style="min-width: 100px;">Target Selesai</th>
                        <th style="min-width: 80px;">Prioritas</th>
                        <th style="min-width: 85px;">Status</th>
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
        
        const highlightText = (text) => {
            if (!this.searchQuery || !text) return this.escapeHtml(text || '-');
            const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
            return this.escapeHtml(text).replace(regex, 
                '<mark style="background: var(--accent-light); padding: 0 2px; border-radius: 3px;">$1</mark>');
        };
        
        return `
            <tr>
                <td class="text-center">${rowNumber}</td>
                <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(item.temuanId || '-')}</code></td>
                <td>${this.formatDate(item.tanggalAudit)}</td>
                <td><span class="badge-status default">${this.escapeHtml(item.department || '-')}</span></td>
                <td>${this.getKategoriBadge(item.kategoriTemuan)}</td>
                <td>${this.getKlasifikasiBadge(item.klasifikasi)}</td>
                <td class="col-wrap">${highlightText(item.uraianTemuan)}</td>
                <td>${this.formatDate(item.targetSelesai)}</td>
                <td>${this.getPrioritasBadge(item.prioritas)}</td>
                <td>${this.getStatusBadge(item.status)}</td>
                <td>
                    <div class="d-flex gap-xs">
                        <button class="btn btn-sm btn-outline-primary" 
                                data-action="temuanDaftar.viewDetail" 
                                data-params='${JSON.stringify({temuanId: item.temuanId}).replace(/'/g, "&#39;")}'
                                title="Detail">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success" 
                                data-page="temuan-tindak-lanjut"
                                data-params='${JSON.stringify({temuanId: item.temuanId}).replace(/'/g, "&#39;")}'
                                title="Tindak Lanjut">
                            <i class="bi bi-arrow-right-circle"></i>
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
                        data-action="temuanDaftar.goToPage" data-params='{"page": ${i}}'>${i}</button>
            `;
        }
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalData);
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startItem}-${endItem} dari ${this.totalData} temuan
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" data-action="temuanDaftar.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" data-action="temuanDaftar.goToPage" 
                            data-params='{"page": ${this.currentPage + 1}}'
                            ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Action methods
    async goToPage(params) { this.currentPage = params.page; await this.updateTableOnly(); }

    async refresh() {
        const refreshBtn = document.getElementById('refreshTemuanBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.allData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterKategori = '';
        this.filterKlasifikasi = '';
        
        setTimeout(() => {
            ['searchTemuanInput', 'filterStatusInput', 'filterDeptTemuanInput', 
             'filterKategoriInput', 'filterKlasifikasiInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        try {
            await this.getAllTemuan();
            this.isRefreshing = true;
            await this.updateTableOnly();
            this.isRefreshing = false;
            toast('Data temuan berhasil dimuat ulang', 'success');
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
        const temuan = this.allData.find(t => t.temuanId === params.temuanId);
        if (temuan) {
            sessionStorage.setItem('selectedTemuan', JSON.stringify(temuan));
            sessionStorage.setItem('selectedTemuanId', params.temuanId);
            this.router.navigateTo('temuan-tindak-lanjut', { temuanId: params.temuanId });
        } else {
            toast('Data temuan tidak ditemukan', 'error');
        }
    }

    async search() {
        const el = document.getElementById('searchTemuanInput');
        if (el) { this.searchQuery = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterStatus() {
        const el = document.getElementById('filterStatusInput');
        if (el) { this.filterStatus = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterDepartment() {
        const el = document.getElementById('filterDeptTemuanInput');
        if (el) { this.filterDept = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterKategori() {
        const el = document.getElementById('filterKategoriInput');
        if (el) { this.filterKategori = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterKlasifikasi() {
        const el = document.getElementById('filterKlasifikasiInput');
        if (el) { this.filterKlasifikasi = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async clearFilters() {
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterKategori = '';
        this.filterKlasifikasi = '';
        this.currentPage = 1;
        
        setTimeout(() => {
            ['searchTemuanInput', 'filterStatusInput', 'filterDeptTemuanInput', 
             'filterKategoriInput', 'filterKlasifikasiInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
        
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    async updateTableOnly() {
        const tableWrapper = document.getElementById('temuanTableWrapper');
        
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
        ['searchTemuanInput', 'filterStatusInput', 'filterDeptTemuanInput', 
         'filterKategoriInput', 'filterKlasifikasiInput'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            
            if (id === 'searchTemuanInput') {
                let timeout;
                newEl.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => this.search(), 400);
                });
            } else if (id === 'filterStatusInput') {
                newEl.addEventListener('change', () => this.filterStatus());
            } else if (id === 'filterDeptTemuanInput') {
                newEl.addEventListener('change', () => this.filterDepartment());
            } else if (id === 'filterKategoriInput') {
                newEl.addEventListener('change', () => this.filterKategori());
            } else if (id === 'filterKlasifikasiInput') {
                newEl.addEventListener('change', () => this.filterKlasifikasi());
            }
        });
    }

    // Helper methods
    getKategoriBadge(value) {
        const badges = {
            'Ketidaksesuaian': 'danger',
            'Observasi': 'warning',
            'OFI': 'info',
            'Positif': 'success'
        };
        return `<span class="badge-status ${badges[value] || 'default'}">${value || '-'}</span>`;
    }

    getKlasifikasiBadge(value) {
        const badges = { 'Mayor': 'danger', 'Minor': 'warning', 'Observation': 'info' };
        return `<span class="badge-status ${badges[value] || 'default'}">${value || '-'}</span>`;
    }

    getStatusBadge(value) {
        const badges = {
            'Open': 'danger',
            'In Progress': 'warning',
            'Closed': 'success',
            'Verified': 'info',
            'Draft': 'default'
        };
        return `<span class="badge-status ${badges[value] || 'default'}">${value || '-'}</span>`;
    }

    getPrioritasBadge(value) {
        const badges = { 'Tinggi': 'danger', 'Sedang': 'warning', 'Rendah': 'success' };
        return `<span class="badge-status ${badges[value] || 'default'}">${value || '-'}</span>`;
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
                <th>ID Temuan</th><th>Tgl Audit</th><th>Department</th>
                <th>Kategori</th><th>Klasifikasi</th>
                <th>Uraian Temuan</th><th>Target Selesai</th>
                <th>Prioritas</th><th>Status</th><th>Action</th>
            </table></thead><tbody>
                ${Array(5).fill(0).map(() => `
                    <tr class="skeleton-row">
                        <td class="text-center"><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:25px;margin:0 auto;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:90px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:60px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:150px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:60px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:60px;"></div></td>
                    </tr>
                `).join('')}
            </tbody></table>
        `;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#temuanSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">Daftar Temuan</h1>
                    <p class="breadcrumb">Home / Temuan Audit Internal / <span>Daftar Temuan</span></p>
                </div></div>
                <div class="app-card" id="temuanSkeletonLoader">
                    <div class="card-header"><h3 class="card-title"><i class="bi bi-list-check"></i> Daftar Temuan Audit</h3></div>
                    <div class="table-wrapper">${this.renderSkeleton()}</div>
                </div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Daftar Temuan</h1>
                <p class="breadcrumb">Home / Temuan Audit Internal / <span>Daftar Temuan</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-action="temuanDaftar.refresh">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }
}