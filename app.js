// app.js
import { AppState } from './core/state.js';
import { Router } from './core/router.js';
import { Layout } from './ui/layout.js';
import { initEventDelegation } from './ui/events.js';
import { DatabaseService } from './core/database.js';
import { loadConfig } from './core/config.js';

class App {
    constructor() {
        this.db = new DatabaseService();
        this.state = new AppState();
        this.router = new Router(this.state, this.db);
        this.layout = new Layout(this.state, this.router);
    }

    async init() {
        try {
            // Tampilkan global loading screen
            this.showGlobalLoading();
            
            // Load config from localStorage (only for web app URL)
            loadConfig();
            
            // Initialize database - fetch users from Google Sheets
            await this.db.initDB();
            
            // Initialize event delegation
            initEventDelegation(this);
            
            // Initialize router and layout
            this.router.init();
            this.layout.init();
            this.layout.updateUserInfo();
            
            // Sembunyikan global loading screen dengan animasi fade out
            this.hideGlobalLoading();
            
            console.log('✅ EMS Monokem Siap - Data dari Google Sheets');
        } catch (error) {
            console.error('Init error:', error);
            this.hideGlobalLoading();
            this.router.navigateTo('login');
        }
    }
    
    showGlobalLoading() {
        // Cek apakah loading screen sudah ada
        if (document.getElementById('globalLoadingScreen')) return;
        
        const loadingHTML = `
            <div id="globalLoadingScreen" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: var(--bg, #f5f7fa);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                transition: opacity 0.3s ease;
            ">
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" style="width: 3.5rem; height: 3.5rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <h3 style="margin-top: 1.5rem; color: var(--text); font-family: var(--font-display);">
                        EMS Monokem
                    </h3>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">
                        Menyiapkan aplikasi...
                    </p>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loadingHTML);
    }
    
    hideGlobalLoading() {
        const loadingScreen = document.getElementById('globalLoadingScreen');
        if (!loadingScreen) return;
        
        // Fade out sebelum dihapus
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            if (loadingScreen.parentNode) {
                loadingScreen.parentNode.removeChild(loadingScreen);
            }
        }, 300);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});

export default App;