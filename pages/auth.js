import { toast, confirmModal } from '../ui/components.js';

export class AuthPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.usernames = [];
        this.isLoggingOut = false;
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
            return;
        }
        
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
                
                const role = result.user.role || 'department';
                if (role === 'top_management') {
                    this.router.navigateTo('monitoring-exec');
                } else if (role === 'hse') {
                    this.router.navigateTo('monitoring-all');
                } else {
                    this.router.navigateTo('monitoring');
                }
                
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

    async logout() {
        if (this.isLoggingOut) {
            console.log('Logout already in progress, ignoring...');
            return;
        }
        
        const hasUnsavedDrafts = this.checkUnsavedDrafts();
        let confirmMessage = 'Apakah Anda yakin ingin logout?';
        
        if (hasUnsavedDrafts) {
            confirmMessage = 'Anda memiliki data yang belum disimpan. Apakah tetap ingin logout? Data yang belum disimpan akan hilang.';
        }
        
        try {
            const confirmed = await confirmModal(
                'Konfirmasi Logout',
                confirmMessage,
                {
                    confirmText: 'Ya, Logout',
                    cancelText: 'Batal',
                    confirmClass: 'btn-danger',
                    dangerMode: true
                }
            );
            
            if (!confirmed) {
                return;
            }
            
            this.isLoggingOut = true;            
            this.showLogoutLoading();
            await this.db.logout();
            this.state.clearUser();
            
            const sidebarNav = document.getElementById('sidebarNav');
            if (sidebarNav) {
                sidebarNav.style.transition = 'opacity 0.15s ease';
                sidebarNav.style.opacity = '0';
                await this.delay(100);
                sidebarNav.innerHTML = '';
                sidebarNav.style.opacity = '1';
            }
            
            if (this.router.layout) {
                this.router.layout.updateUserInfo();
            }
            
            this.hideLogoutLoading();
            
             toast('Logout berhasil', 'success');
            
            await this.delay(300);
            
            await this.router.navigateTo('login');
            
        } catch (error) {
            console.error('Logout error:', error);
            toast('Terjadi kesalahan saat logout', 'error');
        } finally {
            this.isLoggingOut = false;
            this.hideLogoutLoading();
        }
    }
    
    /**
     * Cek apakah ada data draft yang belum disimpan di sessionStorage
     * @returns {boolean}
     */
    checkUnsavedDrafts() {
        const draftKeys = [
            'editOTPData',
            'selectedOTP',
            'selectedTemuan',
            'otpFormDraft',
            'temuanFormDraft',
            'mrFormDraft',
            'mdFormDraft'
        ];
        
        for (const key of draftKeys) {
            const draft = sessionStorage.getItem(key);
            if (draft && draft !== '{}' && draft !== 'null') {
                try {
                    const parsed = JSON.parse(draft);
                    if (parsed && Object.keys(parsed).length > 0) {
                        return true;
                    }
                } catch (e) {
                    if (draft && draft.length > 10) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    showLogoutLoading() {
        const logoutBtn = document.querySelector('.nav-item[data-action="auth.logout"]');
        if (logoutBtn) {
            const originalIcon = logoutBtn.querySelector('.icon i');
            if (originalIcon) {
                logoutBtn.dataset.originalIcon = originalIcon.className;
                originalIcon.className = 'bi bi-hourglass-split spinner-border spinner-border-sm';
                originalIcon.style.animationDuration = '0.6s';
            }
            logoutBtn.style.opacity = '0.7';
            logoutBtn.style.pointerEvents = 'none';
        }
    }

    hideLogoutLoading() {
        const logoutBtn = document.querySelector('.nav-item[data-action="auth.logout"]');
        if (logoutBtn) {
            const icon = logoutBtn.querySelector('.icon i');
            if (icon && logoutBtn.dataset.originalIcon) {
                icon.className = logoutBtn.dataset.originalIcon;
                delete logoutBtn.dataset.originalIcon;
                icon.style.animationDuration = '';
            }
            logoutBtn.style.opacity = '';
            logoutBtn.style.pointerEvents = '';
        }
    }
    
    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}