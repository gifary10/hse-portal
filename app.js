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
            
            console.log('✅ EMS Monokem Siap - Data dari Google Sheets');
        } catch (error) {
            console.error('Init error:', error);
            this.router.navigateTo('login');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});

export default App;