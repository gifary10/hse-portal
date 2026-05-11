// ui/layout.js
export class Layout {
    constructor(state, router) {
        this.state = state;
        this.router = router;
        router.layout = this;
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
        
        if (sidebarRole) {
            const roleMap = {
                'department': 'Department',
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

    updateSidebar() {
        const nav = document.getElementById('sidebarNav');
        if (!this.state.currentUser) {
            if (nav) nav.innerHTML = '';
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
        
        if (nav) nav.innerHTML = html;
    }

    attachSidebarEvents() {
        const nav = document.getElementById('sidebarNav');
        if (!nav) return;
        
        nav.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (!navItem) return;
            
            if (navItem.dataset.action === 'auth.logout') {
                if (this.router.pages.auth) {
                    this.router.pages.auth.logout();
                }
                return;
            }
            
            const page = navItem.dataset.page;
            if (page) {
                this.router.navigateTo(page);
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
}