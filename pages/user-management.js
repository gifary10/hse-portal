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
    }

    async render() {
        this.showLoading();
        
        try {
            // Fetch users from Google Sheets
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
                    <button class="btn btn-outline-primary" data-action="userManagement.refresh">
                        <i class="bi bi-arrow-repeat"></i> Refresh
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

                <div class="table-wrapper">
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
                            ${paginatedUsers.length > 0 ? paginatedUsers.map((user, index) => this.renderTableRow(user, startIndex + index + 1)).join('') : `
                                <tr>
                                    <td colspan="5">
                                        <div class="empty-state">
                                            <i class="bi bi-people"></i>
                                            <h3>Tidak ada user</h3>
                                            <p>Belum ada user terdaftar di Google Sheets</p>
                                        </div>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>

                ${totalPages > 1 ? `
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
                            ${this.renderPaginationButtons(totalPages)}
                            <button class="page-btn" 
                                    data-action="userManagement.goToPage" 
                                    data-params='{"page": ${this.currentPage + 1}}'
                                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                                <i class="bi bi-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
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

    renderPaginationButtons(totalPages) {
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
        
        return buttons;
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
        this.showLoading();
        this.currentPage = 1;
        try {
            await this.refreshTable();
            toast('Data user berhasil direfresh', 'success');
        } catch (error) {
            toast('Gagal refresh data user', 'error');
        }
    }

    async goToPage(params, element) {
        this.currentPage = params.page;
        await this.refreshTable();
    }

    async refreshTable() {
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            const html = await this.render();
            mainContent.innerHTML = html;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    showLoading() {
        this.isLoading = true;
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="app-card">
                    <div class="empty-state">
                        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <h3 class="mt-md">Memuat Data User...</h3>
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