// pages/auth.js
import { toast, confirmModal } from '../ui/components.js';

export class AuthPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.usernames = [];
        this.isLoggingOut = false; // Flag untuk mencegah multiple logout
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
                        <h2>
    <img src="logo.png" alt="Logo" class="sidebar-logo">
    EMS Monokem
</h2>
                        <p class="text-muted">Environmental Management System</p>
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
                toast('Selamat datang, ' + result.user.name);
                
                // Redirect berdasarkan role
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

    /**
     * LOGOUT - Versi dengan modal sederhana (hanya tombol Batal dan Ya, Logout)
     */
    async logout() {
        // Cegah multiple logout
        if (this.isLoggingOut) {
            console.log('Logout already in progress, ignoring...');
            return;
        }
        
        // Cek apakah ada data draft yang belum disimpan
        const unsavedDrafts = this.getUnsavedDraftsList();
        let confirmMessage = 'Apakah tetap ingin logout?';
        
        if (unsavedDrafts.length > 0) {
            confirmMessage = `Apakah tetap ingin logout?`;
        }
        
        try {
            // Tampilkan modal konfirmasi SEDERHANA
            const confirmed = await this.showSimpleConfirmModal(
                'Logout',
                confirmMessage
            );
            
            // Jika user membatalkan, hentikan proses
            if (!confirmed) {
                return;
            }
            
            // Set flag agar tidak ada double logout
            this.isLoggingOut = true;
            
            // Tampilkan loading indicator di tombol logout (jika ada)
            this.showLogoutLoading();
            
            // Step 1: Cleanup database session
            await this.db.logout();
            
            // Step 2: Clear state (emit event akan memberitahu komponen lain)
            await this.state.clearUser();
            
            // Step 3: Bersihkan sidebar dengan delay minimal agar DOM stabil
            const sidebarNav = document.getElementById('sidebarNav');
            if (sidebarNav) {
                sidebarNav.style.transition = 'opacity 0.15s ease';
                sidebarNav.style.opacity = '0';
                await this.delay(100);
                sidebarNav.innerHTML = '';
                sidebarNav.style.opacity = '1';
            }
            
            // Step 4: Update user info di layout
            if (this.router.layout) {
                this.router.layout.updateUserInfo();
            }
            
            // Step 5: Hapus loading indicator
            this.hideLogoutLoading();
            
            // Step 6: Tampilkan toast sukses
            toast('Logout berhasil', 'success');
            
            // Step 7: Beri sedikit delay agar toast sempat muncul
            await this.delay(300);
            
            // Step 8: Navigasi ke halaman login
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
     * Tampilkan modal konfirmasi sederhana (tanpa icon, tanpa fitur rumit)
     * @param {string} title - Judul modal
     * @param {string} message - Pesan konfirmasi
     * @returns {Promise<boolean>} - Promise yang resolve dengan true jika confirm, false jika cancel
     */
    showSimpleConfirmModal(title, message) {
        return new Promise((resolve) => {
            const modalElement = document.getElementById('mainModal');
            const modalDialog = document.getElementById('mainModalDialog');
            const modalContent = document.getElementById('mainModalContent');
            
            if (!modalElement || !modalDialog || !modalContent) {
                console.error('Modal elements not found');
                resolve(false);
                return;
            }
            
            // Set ukuran modal kecil
            modalDialog.className = 'modal-dialog modal-sm';
            
            // Konten modal sederhana
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p class="mb-0">${message}</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="simpleModalCancelBtn">
                        Batal
                    </button>
                    <button type="button" class="btn btn-danger" id="simpleModalConfirmBtn">
                        Ya, Logout
                    </button>
                </div>
            `;
            
            const bsModal = new bootstrap.Modal(modalElement, {
                backdrop: 'static',
                keyboard: false
            });
            bsModal.show();
            modalElement._bsModal = bsModal;
            
            let resolved = false;
            
            const cleanup = () => {
                const confirmBtn = document.getElementById('simpleModalConfirmBtn');
                const cancelBtn = document.getElementById('simpleModalCancelBtn');
                if (confirmBtn) confirmBtn.removeEventListener('click', onConfirm);
                if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
                if (modalElement) {
                    modalElement.removeEventListener('hidden.bs.modal', onHidden);
                }
            };
            
            const onConfirm = () => {
                if (resolved) return;
                resolved = true;
                cleanup();
                
                if (modalElement && modalElement._bsModal) {
                    modalElement._bsModal.hide();
                }
                
                // Tunggu modal benar-benar tertutup
                const checkHidden = () => {
                    if (!modalElement || !modalElement.classList.contains('show')) {
                        resolve(true);
                    } else {
                        setTimeout(checkHidden, 50);
                    }
                };
                setTimeout(checkHidden, 150);
            };
            
            const onCancel = () => {
                if (resolved) return;
                resolved = true;
                cleanup();
                
                if (modalElement && modalElement._bsModal) {
                    modalElement._bsModal.hide();
                }
                
                const checkHidden = () => {
                    if (!modalElement || !modalElement.classList.contains('show')) {
                        resolve(false);
                    } else {
                        setTimeout(checkHidden, 50);
                    }
                };
                setTimeout(checkHidden, 150);
            };
            
            const onHidden = () => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve(false);
                }
            };
            
            const confirmBtn = document.getElementById('simpleModalConfirmBtn');
            const cancelBtn = document.getElementById('simpleModalCancelBtn');
            
            if (confirmBtn) confirmBtn.addEventListener('click', onConfirm);
            if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
            if (modalElement) modalElement.addEventListener('hidden.bs.modal', onHidden);
        });
    }
    
    /**
     * Dapatkan daftar draft yang belum disimpan
     * @returns {Array} - Array of draft names
     */
    getUnsavedDraftsList() {
        const drafts = [];
        const draftKeys = [
            { key: 'editOTPData', name: 'OTP yang sedang diedit' },
            { key: 'selectedOTP', name: 'Data OTP' },
            { key: 'selectedTemuan', name: 'Data temuan' },
            { key: 'otpFormDraft', name: 'Draft OTP' },
            { key: 'temuanFormDraft', name: 'Draft Temuan' },
            { key: 'mrFormDraft', name: 'Draft Management Review' },
            { key: 'mdFormDraft', name: 'Draft Management Decision' }
        ];
        
        for (const { key, name } of draftKeys) {
            const draft = sessionStorage.getItem(key);
            if (draft && draft !== '{}' && draft !== 'null') {
                try {
                    const parsed = JSON.parse(draft);
                    if (parsed && Object.keys(parsed).length > 0) {
                        drafts.push(name);
                    }
                } catch (e) {
                    if (draft && draft.length > 10) {
                        drafts.push(name);
                    }
                }
            }
        }
        
        return drafts;
    }
    
    /**
     * Cek apakah ada data draft yang belum disimpan di sessionStorage
     * @returns {boolean}
     */
    checkUnsavedDrafts() {
        return this.getUnsavedDraftsList().length > 0;
    }
    
    /**
     * Tampilkan loading indicator di tombol logout sidebar
     */
    showLogoutLoading() {
        // Cari tombol logout di sidebar
        const logoutBtn = document.querySelector('.nav-item[data-action="auth.logout"]');
        if (logoutBtn) {
            const originalIcon = logoutBtn.querySelector('.icon i');
            if (originalIcon) {
                // Simpan icon asli untuk dikembalikan nanti
                logoutBtn.dataset.originalIcon = originalIcon.className;
                originalIcon.className = 'bi bi-hourglass-split spinner-border spinner-border-sm';
                originalIcon.style.animationDuration = '0.6s';
            }
            logoutBtn.style.opacity = '0.7';
            logoutBtn.style.pointerEvents = 'none';
        }
    }
    
    /**
     * Sembunyikan loading indicator di tombol logout sidebar
     */
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