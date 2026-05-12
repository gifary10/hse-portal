// pages/user-management.js
import { toast } from '../ui/components.js';

export class UserManagementPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.currentPage = 1;
        this.pageSize = 10;
        this.users = [];
        this.isLoading = false;
        this.isRefreshing = false;
    }

    async render() {
        if (!this.isRefreshing) {
            this.showLoading();
        }
        
        try {
            this.users = await this.db.getAllUsers();
            this.hideLoading();
            return this.renderHTML();
        } catch (error) {
            console.error('Failed to fetch users:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const totalPages = Math.ceil(this.users.length / this.pageSize) || 1;
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const paginatedUsers = this.users.slice(startIndex, startIndex + this.pageSize);

        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">User Management</h1>
                    <p class="breadcrumb">Home / <span>User Management</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" id="refreshUserBtn" data-action="userManagement.refresh">
                        <i class="bi bi-arrow-repeat"></i> <span>Refresh</span>
                    </button>
                </div>
            </div>

            <div class="app-card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="bi bi-people"></i> 
                        Daftar User (Google Sheets)
                    </h3>
                    <span class="badge-status info">Total: ${this.users.length} User</span>
                </div>

                <div class="table-wrapper" id="userTableWrapper">
                    ${this.renderTable(paginatedUsers, startIndex)}
                </div>

                ${totalPages > 1 ? this.renderPagination(totalPages, startIndex) : ''}
            </div>
        `;
    }

    renderTable(users, startIndex) {
        if (users.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-people"></i>
                    <h3>Tidak ada user</h3>
                    <p>Belum ada user terdaftar di Google Sheets</p>
                </div>
            `;
        }
        
        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 50px;">No</th>
                        <th>Username</th>
                        <th>Password</th>
                        <th>Department</th>
                        <th>Role</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map((user, index) => this.renderTableRow(user, startIndex + index + 1)).join('')}
                </tbody>
            </table>
        `;
    }

    renderTableRow(user, rowNumber) {
        if (!user) return '';

        return `
            <tr>
                <td class="text-center">${rowNumber}</td>
                <td><strong>${this.escapeHtml(user.Username || user.username || '-')}</strong></td>
                <td><code>${'•'.repeat(8)}</code></td>
                <td>${this.escapeHtml(user.Department || user.department || '-')}</td>
                <td>${this.getRoleBadge(user.Role || user.role)}</td>
            </tr>
        `;
    }

    renderPagination(totalPages, startIndex) {
        let buttons = '';
        const maxButtons = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            buttons += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                        data-action="userManagement.goToPage" 
                        data-params='{"page": ${i}}'>
                    ${i}
                </button>
            `;
        }
        
        return `
            <div class="d-flex justify-content-between align-items-center mt-md pt-md border-top">
                <div class="pagination-info">
                    Menampilkan ${startIndex + 1}-${Math.min(startIndex + this.pageSize, this.users.length)} dari ${this.users.length} user
                </div>
                <div class="pagination-custom">
                    <button class="page-btn" 
                            data-action="userManagement.goToPage" 
                            data-params='{"page": ${this.currentPage - 1}}'
                            ${this.currentPage === 1 ? 'disabled' : ''}>
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    ${buttons}
                    <button class="page-btn" 
                            data-action="userManagement.goToPage" 
                            data-params='{"page": ${this.currentPage + 1}}'
                            ${this.currentPage === totalPages ? 'disabled' : ''}>
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    getRoleBadge(role) {
        const roleConfig = {
            'top_management': { label: 'Top Management', class: 'danger' },
            'hse': { label: 'HSE Manager', class: 'warning' },
            'department': { label: 'Department', class: 'info' }
        };
        
        const config = roleConfig[role] || { label: role || '-', class: 'default' };
        return `<span class="badge-status ${config.class}">${config.label}</span>`;
    }

    async refresh(params, element) {
        const refreshBtn = document.getElementById('refreshUserBtn');
        
        // Set loading state pada tombol
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> <span>Memuat...</span>';
        }
        
        this.currentPage = 1;
        
        try {
            this.users = await this.db.getAllUsers();
            this.isRefreshing = true;
            await this.updateTableOnly();
            this.isRefreshing = false;
            
            toast('Data user berhasil dimuat ulang', 'success');
        } catch (error) {
            toast('Gagal memuat data user', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> <span>Refresh</span>';
            }
        }
    }

    async goToPage(params, element) {
        this.currentPage = params.page;
        await this.updateTableOnly();
    }

    async updateTableOnly() {
        const tableWrapper = document.getElementById('userTableWrapper');
        const cardHeader = tableWrapper?.closest('.app-card');
        
        if (!tableWrapper || !cardHeader) {
            // Fallback ke full render
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                const html = await this.render();
                mainContent.innerHTML = html;
            }
            return;
        }
        
        const totalPages = Math.ceil(this.users.length / this.pageSize) || 1;
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const paginatedUsers = this.users.slice(startIndex, startIndex + this.pageSize);
        
        // Update tabel dengan animasi
        tableWrapper.style.opacity = '0.5';
        tableWrapper.innerHTML = this.renderTable(paginatedUsers, startIndex);
        
        requestAnimationFrame(() => {
            tableWrapper.style.transition = 'opacity 0.2s ease';
            tableWrapper.style.opacity = '1';
        });
        
        // Update badge total user
        const badgeStatus = cardHeader.querySelector('.card-header .badge-status');
        if (badgeStatus) {
            badgeStatus.textContent = `Total: ${this.users.length} User`;
        }
        
        // Update pagination
        const existingPagination = cardHeader.querySelector('.border-top');
        if (totalPages > 1) {
            const newPagination = this.renderPagination(totalPages, startIndex);
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

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    renderSkeleton() {
        const skeletonRows = Array(5).fill(0).map(() => `
            <tr class="skeleton-row">
                <td class="text-center"><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 30px; margin: 0 auto;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 120px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 80px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 100px;"></div></td>
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 100px;"></div></td>
            </tr>
        `).join('');

        return `
            <table class="data-table striped">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 50px;">No</th>
                        <th>Username</th>
                        <th>Password</th>
                        <th>Department</th>
                        <th>Role</th>
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
        if (mainContent && !mainContent.querySelector('#userSkeletonLoader')) {
            mainContent.innerHTML = `
                <div class="page-header">
                    <div class="page-header-left">
                        <h1 class="page-title">User Management</h1>
                        <p class="breadcrumb">Home / <span>User Management</span></p>
                    </div>
                </div>
                <div class="app-card" id="userSkeletonLoader">
                    <div class="card-header">
                        <h3 class="card-title">
                            <i class="bi bi-people"></i> 
                            Daftar User (Google Sheets)
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
                    <h1 class="page-title">User Management</h1>
                    <p class="breadcrumb">Home / <span>User Management</span></p>
                </div>
            </div>
            <div class="app-card">
                <div class="empty-state">
                    <i class="bi bi-exclamation-triangle" style="color: var(--danger); font-size: 3rem;"></i>
                    <h2>Gagal Memuat Data</h2>
                    <p>${this.escapeHtml(message || 'Terjadi kesalahan saat menghubungi Google Sheets')}</p>
                    <button class="btn btn-primary mt-md" data-action="userManagement.refresh">
                        <i class="bi bi-arrow-repeat"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `;
    }
}