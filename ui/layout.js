// ui/layout.js
export class Layout {
    constructor(state, router) {
        this.state = state;
        this.router = router;
        router.layout = this;
        this.isUpdatingSidebar = false; // Flag untuk mencegah multiple update
    }

    init() {
        this.updateSidebar();
        this.updateUserInfo();
        this.attachSidebarEvents();
        this.setupMobileSidebar();
    }

    setupMobileSidebar() {
        const toggleBtn = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (!toggleBtn || !sidebar || !overlay) return;
        
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('show');
        });
        
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
        
        const navItems = sidebar.querySelectorAll('.nav-item[data-page]');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('show');
                }
            });
        });
        
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            }
        });
    }

    updateUserInfo() {
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userDepartment = document.getElementById('userDepartment');
        const sidebarRole = document.getElementById('sidebarRole');
        
        if (!this.state.currentUser) {
            if (userAvatar) userAvatar.textContent = 'U';
            if (userName) userName.textContent = 'Guest';
            if (userDepartment) userDepartment.textContent = 'Not Logged In';
            if (sidebarRole) sidebarRole.textContent = 'Guest';
            return;
        }
        
        const user = this.state.currentUser;
        
        // Update sidebar role - TAMPILKAN NAMA DEPARTEMEN untuk role department
        if (sidebarRole) {
            const roleMap = {
                'department': user.department || 'Department',
                'hse': 'HSE Manager',
                'top_management': 'Top Management'
            };
            const roleText = roleMap[user.role] || user.role;
            sidebarRole.textContent = roleText;
        }
        
        if (userAvatar) {
            const initials = user.name
                .split(' ')
                .map(word => word[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
            userAvatar.textContent = initials;
        }
        
        if (userName) {
            userName.textContent = user.name;
        }
        
        if (userDepartment) {
            if (user.department && user.role === 'department') {
                userDepartment.textContent = `Dept. ${user.department}`;
            } else if (user.department) {
                userDepartment.textContent = user.department;
            } else {
                userDepartment.textContent = user.email || '';
            }
        }
    }

    /**
     * Update sidebar dengan animasi yang halus
     * Mencegah sidebar kosong tiba-tiba (blink)
     */
    updateSidebar() {
        if (this.isUpdatingSidebar) return;
        this.isUpdatingSidebar = true;
        
        const nav = document.getElementById('sidebarNav');
        if (!this.state.currentUser) {
            if (nav) {
                this.fadeOutElement(nav, () => {
                    nav.innerHTML = '';
                    this.fadeInElement(nav);
                });
            }
            this.isUpdatingSidebar = false;
            return;
        }
        
        const menus = this.state.getRoleMenus();
        let html = '';
        
        menus.forEach(sec => {
            html += `<div class="nav-section-title">${sec.section}</div>`;
            sec.items.forEach(item => {
                const isActive = this.state.currentPage === item.page;
                html += `
                    <div class="nav-item${isActive ? ' active' : ''}" 
                         data-page="${item.page}"
                         role="button" 
                         tabindex="0">
                        <span class="icon"><i class="bi ${item.icon}"></i></span>
                        ${item.label}
                    </div>`;
            });
        });
        
        html += `
            <div class="nav-section-title">System</div>
            <div class="nav-item" data-action="auth.logout" role="button" tabindex="0">
                <span class="icon"><i class="bi bi-box-arrow-right"></i></span>
                Logout
            </div>`;
        
        if (nav) {
            // Gunakan fade transition untuk menghindari blink
            this.fadeOutElement(nav, () => {
                nav.innerHTML = html;
                this.fadeInElement(nav);
                this.isUpdatingSidebar = false;
            });
        } else {
            this.isUpdatingSidebar = false;
        }
    }
    
    /**
     * Fade out elemen dengan transisi
     * @param {HTMLElement} element - Elemen yang akan difade out
     * @param {Function} callback - Callback setelah fade out selesai
     */
    fadeOutElement(element, callback) {
        if (!element) {
            if (callback) callback();
            return;
        }
        
        // Simpan transisi asli
        const originalTransition = element.style.transition;
        element.style.transition = 'opacity 0.15s ease';
        element.style.opacity = '0';
        
        setTimeout(() => {
            element.style.transition = originalTransition;
            if (callback) callback();
        }, 150);
    }
    
    /**
     * Fade in elemen dengan transisi
     * @param {HTMLElement} element - Elemen yang akan difade in
     */
    fadeInElement(element) {
        if (!element) return;
        
        const originalTransition = element.style.transition;
        element.style.transition = 'opacity 0.15s ease';
        element.style.opacity = '1';
        
        setTimeout(() => {
            element.style.transition = originalTransition;
        }, 150);
    }
    
    /**
     * Tampilkan loading state pada sidebar (saat logout)
     * @param {boolean} isLoading - True untuk tampilkan loading, false untuk normal
     */
    setSidebarLoading(isLoading) {
        const logoutBtn = document.querySelector('.nav-item[data-action="auth.logout"]');
        if (!logoutBtn) return;
        
        if (isLoading) {
            const icon = logoutBtn.querySelector('.icon i');
            if (icon) {
                // Simpan kelas icon asli
                if (!logoutBtn.dataset.originalIcon) {
                    logoutBtn.dataset.originalIcon = icon.className;
                }
                icon.className = 'bi bi-hourglass-split spinner-border spinner-border-sm';
                icon.style.animationDuration = '0.6s';
            }
            logoutBtn.style.opacity = '0.7';
            logoutBtn.style.pointerEvents = 'none';
        } else {
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

    attachSidebarEvents() {
        const nav = document.getElementById('sidebarNav');
        if (!nav) return;
        
        // Gunakan event delegation dengan throttle untuk performa
        let isProcessing = false;
        
        nav.addEventListener('click', async (e) => {
            if (isProcessing) return;
            
            const navItem = e.target.closest('.nav-item');
            if (!navItem) return;
            
            // Cegah klik jika sedang loading
            if (navItem.style.pointerEvents === 'none') return;
            
            if (navItem.dataset.action === 'auth.logout') {
                isProcessing = true;
                if (this.router.pages.auth) {
                    await this.router.pages.auth.logout();
                }
                isProcessing = false;
                return;
            }
            
            const page = navItem.dataset.page;
            if (page) {
                isProcessing = true;
                await this.router.navigateTo(page);
                isProcessing = false;
            }
        });
        
        nav.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const navItem = e.target.closest('.nav-item');
                if (navItem) {
                    navItem.click();
                }
            }
        });
    }
    
    /**
     * Reset sidebar ke keadaan awal (kosong)
     * Digunakan saat logout untuk membersihkan menu
     */
    resetSidebar() {
        const nav = document.getElementById('sidebarNav');
        if (nav) {
            this.fadeOutElement(nav, () => {
                nav.innerHTML = '';
                this.fadeInElement(nav);
            });
        }
    }
}