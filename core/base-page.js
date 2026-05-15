// core/base-page.js
// Base class untuk semua page - STANDARISASI

import { toast, showModal, closeModal, confirmModal } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from './config.js';

export class BasePage {
    constructor(state, db, router, pageName) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.pageName = pageName;
        
        // Standard properties
        this.isLoading = false;
        this.isRefreshing = false;
        this.currentPage = 1;
        this.pageSize = 10;
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterYear = '';
        
        // Data cache
        this.allData = [];
        this.totalData = 0;
        this.totalPages = 1;
        this.lastFetchTime = null;
    }

    // ============================================
    // STANDARD FETCH METHODS
    // ============================================
    
    async fetchFromSheets(action, params = {}, timeout = CONFIG.GOOGLE_SHEETS.TIMEOUT) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'local', data: this.allData, total: this.allData.length };
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
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error(`${this.pageName} fetch error:`, error);
            return { status: 'error', data: this.allData, total: this.allData.length, message: error.message };
        }
    }

    // ============================================
    // STANDARD FILTER METHODS
    // ============================================
    
    applyStandardFilters(data, customFilter = null) {
        let filtered = [...data];
        
        // Standard text search
        if (this.searchQuery) {
            const searchLower = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item => 
                Object.values(item).some(value => 
                    value && value.toString().toLowerCase().includes(searchLower)
                )
            );
        }
        
        // Standard status filter
        if (this.filterStatus) {
            filtered = filtered.filter(item => 
                (item.status || item.Status) === this.filterStatus
            );
        }
        
        // Standard department filter
        if (this.filterDept) {
            filtered = filtered.filter(item => 
                (item.department || item.Department) === this.filterDept
            );
        }
        
        // Standard year filter
        if (this.filterYear) {
            filtered = filtered.filter(item => {
                const year = item.year || item.Year || 
                    (item.createdDate ? new Date(item.createdDate).getFullYear() : null);
                return year && year.toString() === this.filterYear;
            });
        }
        
        // Custom filter if provided
        if (customFilter && typeof customFilter === 'function') {
            filtered = customFilter(filtered);
        }
        
        return filtered;
    }

    getUniqueDepartments(data, fieldNames = ['department', 'Department']) {
        const depts = new Set();
        data.forEach(item => {
            for (const field of fieldNames) {
                const val = item[field];
                if (val && val !== '-') {
                    depts.add(val);
                    break;
                }
            }
        });
        return Array.from(depts).sort();
    }

    getUniqueStatuses(data, fieldNames = ['status', 'Status']) {
        const statuses = new Set();
        data.forEach(item => {
            for (const field of fieldNames) {
                const val = item[field];
                if (val && val !== '-') {
                    statuses.add(val);
                    break;
                }
            }
        });
        return Array.from(statuses).sort();
    }

    getUniqueYears(data, yearFields = ['year', 'Year']) {
        const years = new Set();
        data.forEach(item => {
            for (const field of yearFields) {
                const val = item[field];
                if (val) {
                    years.add(val.toString());
                    break;
                }
            }
        });
        if (years.size === 0) years.add(new Date().getFullYear().toString());
        return Array.from(years).sort((a, b) => b - a);
    }

    // ============================================
    // STANDARD PAGINATION METHODS
    // ============================================
    
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

    getPaginationInfo() {
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalData);
        return { startItem, endItem };
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
                        data-action="${this.pageName}.goToPage" data-params='{"page": ${i}}'>
                    ${i}
                </button>
            `;
        }
        
        const { startItem, endItem } = this.getPaginationInfo();
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startItem}-${endItem} dari ${this.totalData} data
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" data-action="${this.pageName}.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" data-action="${this.pageName}.goToPage" 
                            data-params='{"page": ${this.currentPage + 1}}'
                            ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // STANDARD UI METHODS
    // ============================================
    
    async goToPage(params) {
        this.currentPage = params.page;
        await this.updateContentOnly();
    }

    async refresh() {
        const refreshBtn = document.getElementById(`refresh${this.pageName}Btn`);
        this.setButtonLoading(refreshBtn, true);
        
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
            await this.updateContentOnly();
            this.isRefreshing = false;
            toast('Data berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data', 'error');
        } finally {
            this.setButtonLoading(refreshBtn, false);
        }
    }

    async search() {
        const el = document.getElementById(`search${this.pageName}Input`);
        if (el) {
            this.searchQuery = el.value;
            this.currentPage = 1;
            await this.updateContentOnly();
        }
    }

    async filterByStatus() {
        const el = document.getElementById(`filterStatus${this.pageName}Input`);
        if (el) {
            this.filterStatus = el.value;
            this.currentPage = 1;
            await this.updateContentOnly();
        }
    }

    async filterByDepartment() {
        const el = document.getElementById(`filterDept${this.pageName}Input`);
        if (el) {
            this.filterDept = el.value;
            this.currentPage = 1;
            await this.updateContentOnly();
        }
    }

    async filterByYear() {
        const el = document.getElementById(`filterYear${this.pageName}Input`);
        if (el) {
            this.filterYear = el.value;
            this.currentPage = 1;
            await this.updateContentOnly();
        }
    }

    async clearFilters() {
        this.searchQuery = '';
        this.filterStatus = '';
        this.filterDept = '';
        this.filterYear = '';
        this.currentPage = 1;
        
        this.clearFilterInputs();
        await this.updateContentOnly();
        toast('Filter dihapus', 'info');
    }

    clearFilterInputs() {
        const inputIds = [
            `search${this.pageName}Input`,
            `filterStatus${this.pageName}Input`,
            `filterDept${this.pageName}Input`,
            `filterYear${this.pageName}Input`
        ];
        
        setTimeout(() => {
            inputIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }, 100);
    }

    setButtonLoading(btn, isLoading, loadingText = 'Memuat...') {
        if (!btn) return;
        
        if (isLoading) {
            btn.disabled = true;
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${loadingText}`;
        } else {
            btn.disabled = false;
            if (btn.dataset.originalHtml) {
                btn.innerHTML = btn.dataset.originalHtml;
                delete btn.dataset.originalHtml;
            }
        }
    }

    // ============================================
    // STANDARD PARTIAL UPDATE
    // ============================================
    
    async updateContentOnly(containerId = null) {
        const targetContainer = containerId ? document.getElementById(containerId) : this.getMainContentContainer();
        
        if (!targetContainer) {
            // Fallback ke full render
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.innerHTML = await this.render();
                this.attachEventListeners();
            }
            return;
        }
        
        // Animate fade out
        targetContainer.style.opacity = '0';
        targetContainer.style.transform = 'translateY(8px)';
        targetContainer.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        
        await this.delay(150);
        
        // Get fresh data and re-render content only
        const filteredData = this.applyFiltersToData();
        this.updatePagination(filteredData.length);
        const paginatedData = this.getPaginatedData(filteredData);
        
        targetContainer.innerHTML = await this.renderContentOnly(paginatedData);
        
        // Animate fade in
        requestAnimationFrame(() => {
            targetContainer.style.opacity = '1';
            targetContainer.style.transform = 'translateY(0)';
        });
        
        this.attachEventListeners();
    }

    // Template method - to be overridden by child classes
    async renderContentOnly(data) {
        throw new Error('renderContentOnly() must be implemented by child class');
    }

    applyFiltersToData() {
        return this.applyStandardFilters(this.allData);
    }

    // ============================================
    // STANDARD EVENT HANDLERS
    // ============================================
    
    attachEventListeners() {
        // Search input with debounce
        const searchInput = document.getElementById(`search${this.pageName}Input`);
        if (searchInput) {
            let timeout;
            const newInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newInput, searchInput);
            
            newInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.search(), 400);
            });
        }
        
        // Status filter
        const statusFilter = document.getElementById(`filterStatus${this.pageName}Input`);
        if (statusFilter) {
            const newFilter = statusFilter.cloneNode(true);
            statusFilter.parentNode.replaceChild(newFilter, statusFilter);
            newFilter.addEventListener('change', () => this.filterByStatus());
        }
        
        // Department filter
        const deptFilter = document.getElementById(`filterDept${this.pageName}Input`);
        if (deptFilter) {
            const newFilter = deptFilter.cloneNode(true);
            deptFilter.parentNode.replaceChild(newFilter, deptFilter);
            newFilter.addEventListener('change', () => this.filterByDepartment());
        }
        
        // Year filter
        const yearFilter = document.getElementById(`filterYear${this.pageName}Input`);
        if (yearFilter) {
            const newFilter = yearFilter.cloneNode(true);
            yearFilter.parentNode.replaceChild(newFilter, yearFilter);
            newFilter.addEventListener('change', () => this.filterByYear());
        }
    }

    getMainContentContainer() {
        return document.getElementById(`${this.pageName}ContentContainer`);
    }

    // ============================================
    // STANDARD LOADING & ERROR
    // ============================================
    
    showLoading(message = 'Memuat data...') {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent && !mainContent.querySelector(`#${this.pageName}SkeletonLoader`)) {
            mainContent.innerHTML = `
                <div class="page-header">
                    <div class="page-header-left">
                        <h1 class="page-title">${this.getPageTitle()}</h1>
                        <p class="breadcrumb">${this.getBreadcrumb()}</p>
                    </div>
                </div>
                <div class="app-card" id="${this.pageName}SkeletonLoader">
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
                    <h1 class="page-title">${this.getPageTitle()}</h1>
                    <p class="breadcrumb">${this.getBreadcrumb()}</p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Data</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                    <button class="btn btn-primary mt-md" data-action="${this.pageName}.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getPageTitle() {
        return this.pageName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    getBreadcrumb() {
        return `Home / <span>${this.getPageTitle()}</span>`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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

    // Abstract methods - must be implemented
    async loadData() {
        throw new Error('loadData() must be implemented by child class');
    }

    async render() {
        throw new Error('render() must be implemented by child class');
    }
}