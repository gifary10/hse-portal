// pages/management-decision.js
import { toast, showModal, closeModal } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class ManagementDecisionPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterYear = '';
        this.filterPriority = '';
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalData = 0;
        this.totalPages = 1;
        this.allData = [];
        
        // Data referensi dari Management Review
        this.mrData = [];
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
            const [mdResult, mrResult] = await Promise.all([
                this.fetchFromSheets('getAllManagementDecision'),
                this.fetchFromSheets('getAllManagementReview')
            ]);
            
            if (mdResult.status === 'success' && mdResult.data) {
                this.allData = this.formatData(mdResult.data);
            }
            
            if (mrResult.status === 'success' && mrResult.data) {
                this.mrData = mrResult.data;
            }
            
        } catch (error) {
            console.error('Failed to load data:', error);
            throw error;
        }
    }

    async saveManagementDecision(payload) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'error', message: 'Google Sheets not configured' };
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'saveManagementDecision');
            url.searchParams.append('data', JSON.stringify(payload));
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('Save management decision error:', error);
            return { status: 'error', message: error.message };
        }
    }

    async updateDecisionStatus(mdId, status) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'error', message: 'Google Sheets not configured' };
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'updateMDStatus');
            url.searchParams.append('mdId', mdId);
            url.searchParams.append('status', status);
            url.searchParams.append('updatedBy', this.state.currentUser?.username || '');
            url.searchParams.append('updatedAt', new Date().toISOString());
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('Update MD status error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // ============================================
    // DATA FORMATTING
    // ============================================
    
    formatItem(item) {
        if (!item) return {};
        
        const fieldMapping = {
            mdId: ['MD_ID', 'mdId', 'md_id', 'Decision_ID'],
            mrId: ['MR_ID', 'mrId', 'mr_id', 'Review_ID'],
            decisionTitle: ['Decision_Title', 'decisionTitle', 'decision_title', 'Judul_Keputusan'],
            decisionDate: ['Decision_Date', 'decisionDate', 'decision_date', 'Tanggal_Keputusan'],
            decisionType: ['Decision_Type', 'decisionType', 'decision_type', 'Tipe_Keputusan'],
            priority: ['Priority', 'priority', 'Prioritas'],
            department: ['Department', 'department', 'Departemen'],
            
            // Decision content
            background: ['Background', 'background', 'Latar_Belakang'],
            decisionDescription: ['Decision_Description', 'decisionDescription', 'Deskripsi_Keputusan'],
            actionItems: ['Action_Items', 'actionItems', 'Item_Tindakan'],
            responsiblePerson: ['Responsible_Person', 'responsiblePerson', 'Penanggung_Jawab'],
            dueDate: ['Due_Date', 'dueDate', 'Tenggat_Waktu'],
            resourcesAllocated: ['Resources_Allocated', 'resourcesAllocated', 'Sumber_Daya'],
            expectedOutcome: ['Expected_Outcome', 'expectedOutcome', 'Hasil_Diharapkan'],
            successCriteria: ['Success_Criteria', 'successCriteria', 'Kriteria_Sukses'],
            
            status: ['Status', 'status'],
            implementationStatus: ['Implementation_Status', 'implementationStatus', 'Status_Implementasi'],
            createdBy: ['Created_By', 'createdBy', 'created_by'],
            createdAt: ['Created_At', 'createdAt', 'created_at'],
            approvedBy: ['Approved_By', 'approvedBy', 'approved_by'],
            approvedAt: ['Approved_At', 'approvedAt', 'approved_at'],
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
    // FILTER METHODS
    // ============================================
    
    getUniqueYears() {
        const years = new Set();
        this.allData.forEach(item => {
            if (item.decisionDate) {
                const year = new Date(item.decisionDate).getFullYear().toString();
                if (year) years.add(year);
            }
        });
        if (years.size === 0) years.add(new Date().getFullYear().toString());
        return Array.from(years).sort((a, b) => b - a);
    }

    getMRTitles() {
        const titles = [];
        this.mrData.forEach(item => {
            const title = item.Review_Title || item.reviewTitle || '';
            const id = item.MR_ID || item.mrId || '';
            if (title && id) {
                titles.push({ id, title });
            }
        });
        return titles;
    }

    applyFilters() {
        let filtered = [...this.allData];
        
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                (item.mdId && item.mdId.toLowerCase().includes(searchLower)) ||
                (item.decisionTitle && item.decisionTitle.toLowerCase().includes(searchLower)) ||
                (item.decisionDescription && item.decisionDescription.toLowerCase().includes(searchLower)) ||
                (item.responsiblePerson && item.responsiblePerson.toLowerCase().includes(searchLower))
            );
        }
        
        if (this.filterStatus) {
            filtered = filtered.filter(item => item.status === this.filterStatus);
        }
        
        if (this.filterYear) {
            filtered = filtered.filter(item => {
                if (!item.decisionDate) return false;
                const year = new Date(item.decisionDate).getFullYear().toString();
                return year === this.filterYear;
            });
        }
        
        if (this.filterPriority) {
            filtered = filtered.filter(item => item.priority === this.filterPriority);
        }
        
        // Sort by decision date descending
        filtered.sort((a, b) => {
            const dateA = a.decisionDate ? new Date(a.decisionDate) : new Date(0);
            const dateB = b.decisionDate ? new Date(b.decisionDate) : new Date(0);
            return dateB - dateA;
        });
        
        return filtered;
    }

    // ============================================
    // STATS
    // ============================================
    
    getStats() {
        const total = this.allData.length;
        const active = this.allData.filter(d => d.status === 'Active' || d.status === 'In Progress').length;
        const completed = this.allData.filter(d => d.status === 'Completed' || d.status === 'Implemented').length;
        const pending = this.allData.filter(d => d.status === 'Pending').length;
        const highPriority = this.allData.filter(d => d.priority === 'High' || d.priority === 'Tinggi').length;
        const overdue = this.allData.filter(d => {
            if (!d.dueDate) return false;
            if (d.status === 'Completed' || d.status === 'Implemented') return false;
            return new Date(d.dueDate) < new Date();
        }).length;
        
        return { total, active, completed, pending, highPriority, overdue };
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
        const canCreate = user.role === 'top_management';
        const stats = this.getStats();
        const uniqueYears = this.getUniqueYears();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Management Decision</h1>
                    <p class="breadcrumb">Home / Management Review / <span>Management Decision</span></p>
                </div>
                <div class="d-flex gap-sm">
                    ${canCreate ? `
                        <button class="btn btn-primary" data-action="managementDecision.showCreateForm">
                            <i class="bi bi-plus-lg"></i> Create Decision
                        </button>
                    ` : ''}
                    <button class="btn btn-outline-primary" id="refreshMDBtn" data-action="managementDecision.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            ${this.renderStatsCards(stats)}

            <div class="filter-section">
                <div class="row">
                    <div class="col-md-4">
                        <div class="form-group-custom">
                            <label><i class="bi bi-search"></i> Cari Keputusan</label>
                            <input type="text" id="searchMDInput" class="form-control"
                                   placeholder="Cari ID, judul, deskripsi..." 
                                   value="${this.escapeHtml(this.searchQuery)}">
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-flag"></i> Status</label>
                            <select id="filterStatusMDInput" class="form-select">
                                <option value="">Semua Status</option>
                                <option value="Pending" ${this.filterStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="Active" ${this.filterStatus === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="In Progress" ${this.filterStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Completed" ${this.filterStatus === 'Completed' ? 'selected' : ''}>Completed</option>
                                <option value="Implemented" ${this.filterStatus === 'Implemented' ? 'selected' : ''}>Implemented</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-calendar"></i> Tahun</label>
                            <select id="filterYearMDInput" class="form-select">
                                <option value="">Semua</option>
                                ${uniqueYears.map(y => `
                                    <option value="${y}" ${this.filterYear === y ? 'selected' : ''}>${y}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label><i class="bi bi-exclamation-triangle"></i> Prioritas</label>
                            <select id="filterPriorityMDInput" class="form-select">
                                <option value="">Semua</option>
                                <option value="High" ${this.filterPriority === 'High' ? 'selected' : ''}>High</option>
                                <option value="Medium" ${this.filterPriority === 'Medium' ? 'selected' : ''}>Medium</option>
                                <option value="Low" ${this.filterPriority === 'Low' ? 'selected' : ''}>Low</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group-custom">
                            <label>Hasil</label>
                            <div class="mt-2">
                                <span class="badge-status info">
                                    <i class="bi bi-database"></i> ${this.totalData} Keputusan
                                </span>
                                ${(this.searchQuery || this.filterStatus || this.filterYear || this.filterPriority) ? `
                                    <button class="btn btn-sm btn-link" data-action="managementDecision.clearFilters" 
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
                        Daftar Keputusan Manajemen
                    </h3>
                    <span class="badge-status info">Hal. ${this.currentPage} / ${this.totalPages || 1}</span>
                </div>
                <div class="table-wrapper" id="mdTableWrapper">
                    ${this.renderTable(data)}
                </div>
                ${this.totalPages > 1 ? this.renderPagination() : ''}
            </div>

            <!-- Legend -->
            <div class="app-card mt-md" style="background: #f8fafc;">
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                    <span class="badge-status danger">High Priority</span>
                    <span class="badge-status warning">Medium Priority</span>
                    <span class="badge-status success">Low Priority</span>
                    <span style="color: var(--text-muted); font-size: var(--fs-sm); margin-left: auto;">
                        <i class="bi bi-info-circle"></i> Keputusan manajemen ditindaklanjuti oleh departemen terkait
                    </span>
                </div>
            </div>
        `;
    }

    renderStatsCards(stats) {
        return `
            <div class="row mb-md">
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--primary);">${stats.total}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Total Keputusan</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--info); cursor: pointer;"
                         data-action="managementDecision.filterByStatus" data-params='{"status": "Active"}'>
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--info);">${stats.active}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Active</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--success); cursor: pointer;"
                         data-action="managementDecision.filterByStatus" data-params='{"status": "Completed"}'>
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--success);">${stats.completed}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Completed</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--warning); cursor: pointer;"
                         data-action="managementDecision.filterByStatus" data-params='{"status": "Pending"}'>
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--warning);">${stats.pending}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Pending</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid var(--danger);">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: var(--danger);">${stats.highPriority}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">High Priority</div>
                    </div>
                </div>
                <div class="col-md-2 col-6 mb-sm">
                    <div class="app-card" style="text-align: center; padding: var(--space-md); border-left: 4px solid #ef4444; ${stats.overdue > 0 ? 'animation: pulse 2s infinite;' : ''}">
                        <div style="font-size: var(--fs-2xl); font-weight: 700; color: #ef4444;">${stats.overdue}</div>
                        <div style="color: var(--text-muted); font-size: var(--fs-xs);">Overdue</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderTable(data) {
        if (data.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-bullseye" style="font-size: 3rem; color: var(--text-muted);"></i>
                    <h3>Belum ada Management Decision</h3>
                    <p>${this.searchQuery || this.filterStatus ? 
                        'Tidak ada keputusan yang sesuai dengan filter' : 
                        'Klik tombol "Create Decision" untuk membuat keputusan manajemen baru'}</p>
                    <button class="btn btn-primary mt-md" data-action="managementDecision.showCreateForm">
                        <i class="bi bi-plus-lg"></i> Create Decision
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
                        <th style="min-width: 120px;">MD ID</th>
                        <th style="min-width: 120px;">Ref. MR ID</th>
                        <th style="min-width: 250px;">Decision Title</th>
                        <th style="min-width: 100px;">Date</th>
                        <th style="min-width: 80px;">Priority</th>
                        <th style="min-width: 100px;">Responsible</th>
                        <th style="min-width: 100px;">Due Date</th>
                        <th style="min-width: 90px;">Status</th>
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
        
        const isOverdue = item.dueDate && 
                         item.status !== 'Completed' && 
                         item.status !== 'Implemented' && 
                         new Date(item.dueDate) < new Date();
        
        return `
            <tr style="${isOverdue ? 'background: #fff5f5 !important;' : ''}">
                <td class="text-center">${rowNumber}</td>
                <td><code style="font-size: var(--fs-xs);">${this.escapeHtml(item.mdId || '-')}</code></td>
                <td><small><code>${this.escapeHtml(item.mrId || '-')}</code></small></td>
                <td class="col-wrap"><strong>${this.escapeHtml(item.decisionTitle || '-')}</strong></td>
                <td>${this.formatDate(item.decisionDate)}</td>
                <td>${this.getPriorityBadge(item.priority)}</td>
                <td><strong>${this.escapeHtml(item.responsiblePerson || '-')}</strong></td>
                <td>
                    <span style="color: ${isOverdue ? 'var(--danger)' : 'var(--text)'}; font-weight: ${isOverdue ? '600' : '400'};">
                        ${this.formatDate(item.dueDate)}
                        ${isOverdue ? ' <i class="bi bi-exclamation-triangle-fill" style="color: var(--danger); font-size: 0.7rem;"></i>' : ''}
                    </span>
                </td>
                <td>${this.getStatusBadge(item.status)}</td>
                <td>
                    <div class="d-flex gap-xs">
                        <button class="btn btn-sm btn-outline-primary" 
                                data-action="managementDecision.viewDetail" 
                                data-params='${JSON.stringify({mdId: item.mdId}).replace(/'/g, "&#39;")}'
                                title="Detail">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${item.status !== 'Completed' && item.status !== 'Implemented' ? `
                            <button class="btn btn-sm btn-outline-success" 
                                    data-action="managementDecision.markCompleted" 
                                    data-params='${JSON.stringify({mdId: item.mdId}).replace(/'/g, "&#39;")}'
                                    title="Mark Completed">
                                <i class="bi bi-check-lg"></i>
                            </button>
                        ` : ''}
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
                        data-action="managementDecision.goToPage" data-params='{"page": ${i}}'>${i}</button>
            `;
        }
        
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalData);
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startItem}-${endItem} dari ${this.totalData} keputusan
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" data-action="managementDecision.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" data-action="managementDecision.goToPage" 
                            data-params='{"page": ${this.currentPage + 1}}'
                            ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // CREATE DECISION FORM
    // ============================================
    
    async showCreateForm() {
        const mrTitles = this.getMRTitles();
        
        const content = `
            <div class="modal-body-scroll" style="max-height: 70vh; overflow-y: auto;">
                <form data-action="managementDecision.submitDecision" id="mdCreateForm">
                    <!-- Reference MR -->
                    <div class="app-card mb-md" style="background: #f8fafc;">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-link-45deg"></i> Referensi Management Review</h4>
                        <div class="form-group-custom">
                            <label>Management Review Reference <span style="color: var(--danger);">*</span></label>
                            <select name="mrId" class="form-select" required>
                                <option value="">Pilih Management Review</option>
                                ${mrTitles.map(mr => `
                                    <option value="${this.escapeHtml(mr.id)}">${this.escapeHtml(mr.id)} - ${this.escapeHtml(mr.title.substring(0, 60))}</option>
                                `).join('')}
                                <option value="General">General (Tanpa MR spesifik)</option>
                            </select>
                            <small class="text-muted">Pilih Management Review yang menjadi dasar keputusan ini</small>
                        </div>
                    </div>

                    <!-- Decision Info -->
                    <div class="app-card mb-md">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-info-circle"></i> Informasi Keputusan</h4>
                        <div class="row">
                            <div class="col-md-8">
                                <div class="form-group-custom">
                                    <label>Decision Title <span style="color: var(--danger);">*</span></label>
                                    <input type="text" name="decisionTitle" class="form-control" required
                                           placeholder="Judul keputusan manajemen">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label>Decision Date <span style="color: var(--danger);">*</span></label>
                                    <input type="date" name="decisionDate" class="form-control" required
                                           value="${new Date().toISOString().split('T')[0]}">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label>Type <span style="color: var(--danger);">*</span></label>
                                    <select name="decisionType" class="form-select" required>
                                        <option value="">Pilih Tipe</option>
                                        <option value="Policy">Kebijakan</option>
                                        <option value="Strategic">Strategis</option>
                                        <option value="Operational">Operasional</option>
                                        <option value="Resource">Sumber Daya</option>
                                        <option value="Corrective">Perbaikan</option>
                                        <option value="Preventive">Pencegahan</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label>Priority <span style="color: var(--danger);">*</span></label>
                                    <select name="priority" class="form-select" required>
                                        <option value="High">High</option>
                                        <option value="Medium" selected>Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="form-group-custom">
                                    <label>Department</label>
                                    <input type="text" name="department" class="form-control"
                                           value="${this.escapeHtml(this.state.currentUser?.department || 'All')}" readonly style="background: #f8fafc;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Decision Content -->
                    <div class="app-card mb-md">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-pencil-square"></i> Isi Keputusan</h4>
                        
                        <div class="form-group-custom">
                            <label>Latar Belakang <span style="color: var(--danger);">*</span></label>
                            <textarea name="background" class="form-control" rows="3" required
                                      placeholder="Jelaskan latar belakang dan alasan keputusan ini diambil..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>Deskripsi Keputusan <span style="color: var(--danger);">*</span></label>
                            <textarea name="decisionDescription" class="form-control" rows="4" required
                                      placeholder="Jelaskan keputusan secara detail..."></textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>Item Tindakan (Action Items)</label>
                            <textarea name="actionItems" class="form-control" rows="3"
                                      placeholder="Daftar tindakan yang harus dilakukan (pisahkan dengan nomor atau bullet)..."></textarea>
                        </div>
                    </div>

                    <!-- Responsibility & Resources -->
                    <div class="app-card mb-md" style="background: #fffbeb;">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-people"></i> Penanggung Jawab & Sumber Daya</h4>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label>Penanggung Jawab <span style="color: var(--danger);">*</span></label>
                                    <input type="text" name="responsiblePerson" class="form-control" required
                                           placeholder="Nama penanggung jawab">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label>Tenggat Waktu <span style="color: var(--danger);">*</span></label>
                                    <input type="date" name="dueDate" class="form-control" required>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="form-group-custom">
                                    <label>Sumber Daya yang Dialokasikan</label>
                                    <textarea name="resourcesAllocated" class="form-control" rows="2"
                                              placeholder="Anggaran, personel, peralatan yang dialokasikan..."></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Expected Outcome -->
                    <div class="app-card mb-md" style="background: #f0fdf4;">
                        <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-graph-up"></i> Hasil yang Diharapkan</h4>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label>Hasil yang Diharapkan <span style="color: var(--danger);">*</span></label>
                                    <textarea name="expectedOutcome" class="form-control" rows="3" required
                                              placeholder="Deskripsikan hasil yang diharapkan dari keputusan ini..."></textarea>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group-custom">
                                    <label>Kriteria Keberhasilan</label>
                                    <textarea name="successCriteria" class="form-control" rows="3"
                                              placeholder="Bagaimana mengukur keberhasilan implementasi..."></textarea>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Submit Buttons -->
                    <div class="d-flex gap-sm" style="justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" data-action="modal.close">
                            <i class="bi bi-x-circle"></i> Batal
                        </button>
                        <button type="button" class="btn btn-warning" data-action="managementDecision.saveDraft">
                            <i class="bi bi-save"></i> Save Draft
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="bi bi-send"></i> Submit Decision
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        showModal('Create Management Decision', content, 'modal-xl');
    }

    // ============================================
    // SUBMIT DECISION
    // ============================================
    
    async submitDecision(params, element) {
        const form = document.getElementById('mdCreateForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        // Validasi
        if (!data.mrId || !data.decisionTitle || !data.decisionDate || !data.decisionType || !data.priority) {
            toast('Mohon lengkapi informasi dasar keputusan', 'error');
            return;
        }
        
        if (!data.background || !data.decisionDescription) {
            toast('Mohon lengkapi isi keputusan', 'error');
            return;
        }
        
        if (!data.responsiblePerson || !data.dueDate || !data.expectedOutcome) {
            toast('Mohon lengkapi penanggung jawab dan hasil yang diharapkan', 'error');
            return;
        }
        
        try {
            const user = this.state.currentUser || {};
            
            const year = new Date(data.decisionDate).getFullYear();
            const rowNum = (this.allData.length + 1).toString().padStart(3, '0');
            const mdId = `MD-${year}-${rowNum}`;
            
            const payload = {
                ...data,
                mdId: mdId,
                createdBy: user.username || user.name || '',
                createdAt: new Date().toISOString(),
                status: 'Active',
                implementationStatus: 'Not Started'
            };
            
            const result = await this.saveManagementDecision(payload);
            
            if (result.status === 'success') {
                closeModal();
                toast('Management Decision berhasil disimpan!', 'success');
                this.allData = [];
                await this.updateTableOnly();
            } else {
                toast(result.message || 'Gagal menyimpan keputusan', 'error');
            }
        } catch (error) {
            console.error('Submit decision error:', error);
            toast('Gagal menyimpan: ' + error.message, 'error');
        }
    }
    
    async saveDraft(params, element) {
        const form = document.getElementById('mdCreateForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        try {
            const user = this.state.currentUser || {};
            
            const year = new Date().getFullYear();
            const rowNum = (this.allData.length + 1).toString().padStart(3, '0');
            const mdId = `MD-${year}-${rowNum}`;
            
            const payload = {
                ...data,
                mdId: mdId,
                createdBy: user.username || user.name || '',
                createdAt: new Date().toISOString(),
                status: 'Pending'
            };
            
            const result = await this.saveManagementDecision(payload);
            
            if (result.status === 'success') {
                closeModal();
                toast('Draft Management Decision berhasil disimpan!', 'success');
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
        const decision = this.allData.find(d => d.mdId === params.mdId);
        if (!decision) {
            toast('Data keputusan tidak ditemukan', 'error');
            return;
        }
        
        const isOverdue = decision.dueDate && 
                         decision.status !== 'Completed' && 
                         decision.status !== 'Implemented' && 
                         new Date(decision.dueDate) < new Date();
        
        const content = `
            <div style="max-height: 70vh; overflow-y: auto; padding-right: 8px;">
                <!-- Status Banner -->
                <div class="app-card mb-md" style="background: ${isOverdue ? '#fee2e2' : this.getStatusBgColor(decision.status)}; ${isOverdue ? 'border-left: 4px solid var(--danger);' : ''}">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i class="bi ${this.getStatusIcon(decision.status)}" style="font-size: 1.5rem;"></i>
                        <div>
                            <strong>Status: ${this.getStatusBadge(decision.status)}</strong>
                            <span style="margin-left: 12px; font-size: var(--fs-sm);">ID: <code>${this.escapeHtml(decision.mdId)}</code></span>
                            ${isOverdue ? '<span class="badge-status danger" style="margin-left: 8px;">Overdue</span>' : ''}
                        </div>
                    </div>
                </div>

                <!-- Basic Info -->
                <div class="app-card mb-md">
                    <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-info-circle"></i> Informasi Keputusan</h4>
                    <div class="row">
                        <div class="col-md-8">
                            <div class="info-item mb-sm">
                                <label class="info-label">Decision Title</label>
                                <div class="info-value" style="font-weight: 600; font-size: var(--fs-lg);">${this.escapeHtml(decision.decisionTitle || '-')}</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="info-item mb-sm">
                                <label class="info-label">Priority</label>
                                <div class="info-value">${this.getPriorityBadge(decision.priority)}</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="info-item mb-sm">
                                <label class="info-label">Reference MR</label>
                                <div class="info-value"><code>${this.escapeHtml(decision.mrId || '-')}</code></div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="info-item mb-sm">
                                <label class="info-label">Decision Date</label>
                                <div class="info-value">${this.formatDate(decision.decisionDate)}</div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="info-item mb-sm">
                                <label class="info-label">Type</label>
                                <div class="info-value"><span class="badge-status info">${this.escapeHtml(decision.decisionType || '-')}</span></div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="info-item mb-sm">
                                <label class="info-label">Responsible Person</label>
                                <div class="info-value"><strong>${this.escapeHtml(decision.responsiblePerson || '-')}</strong></div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="info-item mb-sm">
                                <label class="info-label">Due Date</label>
                                <div class="info-value" style="font-weight: 600; color: ${isOverdue ? 'var(--danger)' : 'var(--text)'};">
                                    ${this.formatDate(decision.dueDate)}
                                    ${isOverdue ? ' <span class="badge-status danger">Overdue</span>' : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Content -->
                <div class="app-card mb-md">
                    <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-file-earmark-text"></i> Isi Keputusan</h4>
                    <div class="info-item mb-sm">
                        <label class="info-label">Latar Belakang</label>
                        <div class="info-value" style="background: #f8fafc; padding: 12px; border-radius: var(--radius-md);">${this.escapeHtml(decision.background || '-')}</div>
                    </div>
                    <div class="info-item mb-sm">
                        <label class="info-label">Deskripsi Keputusan</label>
                        <div class="info-value" style="background: #f0fdf4; padding: 12px; border-radius: var(--radius-md); border-left: 3px solid var(--success);">
                            ${this.escapeHtml(decision.decisionDescription || '-')}
                        </div>
                    </div>
                    ${decision.actionItems ? `
                    <div class="info-item mb-sm">
                        <label class="info-label">Action Items</label>
                        <div class="info-value" style="background: #fffbeb; padding: 12px; border-radius: var(--radius-md); white-space: pre-line;">
                            ${this.escapeHtml(decision.actionItems)}
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- Resources & Outcome -->
                <div class="row">
                    <div class="col-md-6">
                        <div class="app-card mb-md" style="background: #fff7ed;">
                            <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-box"></i> Sumber Daya</h4>
                            <div class="info-value">${this.escapeHtml(decision.resourcesAllocated || 'Tidak ada alokasi khusus')}</div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="app-card mb-md" style="background: #f0fdf4;">
                            <h4 style="margin-bottom: var(--space-md);"><i class="bi bi-graph-up"></i> Hasil Diharapkan</h4>
                            <div class="info-item mb-sm">
                                <label class="info-label">Expected Outcome</label>
                                <div class="info-value">${this.escapeHtml(decision.expectedOutcome || '-')}</div>
                            </div>
                            ${decision.successCriteria ? `
                            <div class="info-item mb-sm">
                                <label class="info-label">Success Criteria</label>
                                <div class="info-value">${this.escapeHtml(decision.successCriteria)}</div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        showModal(`Detail Keputusan: ${this.escapeHtml((decision.decisionTitle || '').substring(0, 50))}`, content, 'modal-xl');
    }

    // ============================================
    // ACTION METHODS
    // ============================================
    
    async markCompleted(params) {
        const decision = this.allData.find(d => d.mdId === params.mdId);
        if (!decision) {
            toast('Data tidak ditemukan', 'error');
            return;
        }
        
        const result = await this.updateDecisionStatus(params.mdId, 'Completed');
        
        if (result.status === 'success') {
            toast('Keputusan ditandai sebagai Completed', 'success');
            this.allData = [];
            await this.updateTableOnly();
        } else {
            toast(result.message || 'Gagal update status', 'error');
        }
    }
    
    async filterByStatus(params) {
        this.filterStatus = params.status || '';
        this.currentPage = 1;
        setTimeout(() => {
            const el = document.getElementById('filterStatusMDInput');
            if (el) el.value = this.filterStatus;
        }, 100);
        await this.updateTableOnly();
    }

    async goToPage(params) { this.currentPage = params.page; await this.updateTableOnly(); }

    async refresh() {
        const refreshBtn = document.getElementById('refreshMDBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> <span>Memuat...</span>';
        }
        
        this.allData = [];
        this.mrData = [];
        this.currentPage = 1;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterYear = '';
        this.filterPriority = '';
        
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
        const el = document.getElementById('searchMDInput');
        if (el) { this.searchQuery = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterStatus() {
        const el = document.getElementById('filterStatusMDInput');
        if (el) { this.filterStatus = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterYear() {
        const el = document.getElementById('filterYearMDInput');
        if (el) { this.filterYear = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async filterPriority() {
        const el = document.getElementById('filterPriorityMDInput');
        if (el) { this.filterPriority = el.value; this.currentPage = 1; await this.updateTableOnly(); }
    }

    async clearFilters() {
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterYear = '';
        this.filterPriority = '';
        this.currentPage = 1;
        await this.updateTableOnly();
        toast('Filter dihapus', 'info');
    }

    async updateTableOnly() {
        const tableWrapper = document.getElementById('mdTableWrapper');
        
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
                statsCards.outerHTML = this.renderStatsCards(this.getStats());
            }
        }
        
        this.attachEventListeners();
    }

    attachEventListeners() {
        ['searchMDInput', 'filterStatusMDInput', 'filterYearMDInput', 'filterPriorityMDInput'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
            
            if (id === 'searchMDInput') {
                let timeout;
                newEl.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => this.search(), 400);
                });
            } else if (id === 'filterStatusMDInput') {
                newEl.addEventListener('change', () => this.filterStatus());
            } else if (id === 'filterYearMDInput') {
                newEl.addEventListener('change', () => this.filterYear());
            } else if (id === 'filterPriorityMDInput') {
                newEl.addEventListener('change', () => this.filterPriority());
            }
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getStatusBadge(status) {
        const badges = {
            'Pending': 'warning',
            'Active': 'info',
            'In Progress': 'info',
            'Completed': 'success',
            'Implemented': 'success',
            'Cancelled': 'danger'
        };
        const label = status || 'Pending';
        const type = badges[label] || 'default';
        return `<span class="badge-status ${type}">${label}</span>`;
    }

    getStatusBgColor(status) {
        const colors = {
            'Pending': '#fef3c7',
            'Active': '#e0f2fe',
            'In Progress': '#e0f2fe',
            'Completed': '#dcfce7',
            'Implemented': '#dcfce7'
        };
        return colors[status] || '#f8fafc';
    }

    getStatusIcon(status) {
        const icons = {
            'Pending': 'bi-hourglass-split',
            'Active': 'bi-play-circle-fill',
            'In Progress': 'bi-arrow-repeat',
            'Completed': 'bi-check-circle-fill',
            'Implemented': 'bi-check2-all'
        };
        return icons[status] || 'bi-info-circle';
    }

    getPriorityBadge(priority) {
        const badges = {
            'High': 'danger',
            'Tinggi': 'danger',
            'Medium': 'warning',
            'Sedang': 'warning',
            'Low': 'success',
            'Rendah': 'success'
        };
        const label = priority || 'Medium';
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
                <th>MD ID</th><th>Ref. MR ID</th><th>Decision Title</th>
                <th>Date</th><th>Priority</th><th>Responsible</th>
                <th>Due Date</th><th>Status</th><th>Action</th>
            </tr></thead><tbody>
                ${Array(5).fill(0).map(() => `
                    <tr class="skeleton-row">
                        <td class="text-center"><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:25px;margin:0 auto;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:90px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:200px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:90px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:60px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:100px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:90px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:70px;"></div></td>
                        <td><div style="height:1rem;background:#e2e8f0;border-radius:4px;width:80px;"></div></td>
                    </tr>
                `).join('')}
            </tbody></table>
        `;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector('#mdSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">Management Decision</h1>
                    <p class="breadcrumb">Home / Management Review / <span>Management Decision</span></p>
                </div></div>
                <div class="app-card" id="mdSkeletonLoader">
                    <div class="card-header"><h3 class="card-title"><i class="bi bi-bullseye"></i> Daftar Keputusan Manajemen</h3></div>
                    <div class="table-wrapper">${this.renderSkeleton()}</div>
                </div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Management Decision</h1>
                <p class="breadcrumb">Home / Management Review / <span>Management Decision</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-action="managementDecision.refresh">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }
}