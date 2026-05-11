// pages/auth.js
import { toast, confirmModal } from '../ui/components.js';

export class AuthPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.usernames = [];
    }

    async fetchUsernames() {
        try {
            const users = await this.db.getAllUsers();
            this.usernames = users.map(user => user.Username || user.username).filter(Boolean);
            return this.usernames;
        } catch (error) {
            console.error('Failed to fetch usernames:', error);
            return [];
        }
    }

    async render() {
        // Fetch usernames for dropdown
        await this.fetchUsernames();
        
        return `
            <div class="login-container">
                <div class="app-card">
                    <div class="text-center mb-xl">
                        <h2><i class="bi bi-clipboard-check"></i> Sistem OTP</h2>
                        <p class="text-muted">ISO 14001:2015</p>
                    </div>
                    <form data-action="auth.login">
                        <div class="form-group-custom">
                            <label>Username</label>
                            <select name="username" required class="form-select" id="usernameSelect">
                                <option value="">Pilih Username</option>
                                ${this.usernames.map(username => `
                                    <option value="${this.escapeHtml(username)}">${this.escapeHtml(username)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-group-custom">
                            <label>Password</label>
                            <input type="password" name="password" required placeholder="Masukkan password">
                        </div>
                        <button type="submit" class="btn btn-primary w-100 justify-content-center mt-md">
                            <i class="bi bi-box-arrow-in-right"></i> Login
                        </button>
                    </form>
                </div>
            </div>`;
    }

    async login(params, form) {
        const formData = new FormData(form);
        const username = formData.get('username');
        const password = formData.get('password');
        
        if (!username || !password) {
            toast('Username dan password harus diisi', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
        }
        
        try {
            const result = await this.db.login(username, password);
            
            if (result.success) {
                this.state.setUser(result.user, result.sessionId);
                toast('Login berhasil! Selamat datang, ' + result.user.name);
                this.router.navigateTo('dashboard');
                
                if (this.router.layout) {
                    this.router.layout.updateUserInfo();
                }
            } else {
                toast(result.message || 'Login gagal', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Login';
                }
            }
        } catch (error) {
            toast('Gagal menghubungi server', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Login';
            }
        }
    }

    logout() {
        confirmModal(
            'Konfirmasi Logout',
            'Apakah Anda yakin ingin logout?',
            () => {
                this.db.logout();
                this.state.clearUser();
                
                const sidebarNav = document.getElementById('sidebarNav');
                if (sidebarNav) {
                    sidebarNav.innerHTML = '';
                }
                
                if (this.router.layout) {
                    this.router.layout.updateUserInfo();
                }
                
                this.router.navigateTo('login');
                toast('Logout berhasil');
            },
            () => {
                // onCancel — tidak melakukan apa-apa
            }
        );
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}