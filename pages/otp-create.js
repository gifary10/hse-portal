// pages/otp-create.js
// OTP Create Page - Input OTP dengan referensi dari MasterKPI, MasterTemplate, dan IADL

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class OTPCreatePage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.isLoading = false;
        this.isSubmitting = false;
        
        // Data referensi dari master
        this.kpiList = [];
        this.templateList = [];
        this.iadlList = [];
        
        // Selected values
        this.selectedTemplate = null;
        this.selectedKPI = null;
        this.selectedIADL = null;
    }

    // ============================================
    // FETCH REFERENCE DATA
    // ============================================
    
    async fetchReferenceData(action) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            console.warn('Google Sheets not configured');
            return { status: 'error', data: [], message: 'Google Sheets not configured' };
        }

        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', action);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.GOOGLE_SHEETS.TIMEOUT);
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error(`Failed to fetch ${action}:`, error);
            return { status: 'error', data: [], message: error.message };
        }
    }

    async loadReferenceData() {
        try {
            // Fetch KPI, Template, dan IADL secara paralel
            const [kpiResult, templateResult, iadlResult] = await Promise.all([
                this.fetchReferenceData('getAllKPI'),
                this.fetchReferenceData('getAllTemplates'),
                this.fetchReferenceData('getAll')
            ]);
            
            this.kpiList = kpiResult.data || [];
            this.templateList = templateResult.data || [];
            this.iadlList = iadlResult.data || [];
            
            console.log('Reference data loaded:', {
                kpi: this.kpiList.length,
                templates: this.templateList.length,
                iadl: this.iadlList.length
            });
            
        } catch (error) {
            console.error('Failed to load reference data:', error);
            throw error;
        }
    }

    // ============================================
    // RENDER
    // ============================================
    
    async render() {
        this.showLoading();
        
        try {
            await this.loadReferenceData();
            this.hideLoading();
            return this.renderHTML();
        } catch (error) {
            console.error('Render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const user = this.state.currentUser || {};
        const userDept = user.department || '';
        
        // Filter data berdasarkan departemen user
        const filteredKPIs = this.kpiList.filter(k => 
            !userDept || (k.Department || k.department) === userDept
        );
        const filteredTemplates = this.templateList.filter(t => 
            !userDept || (t.Department || t.department) === userDept
        );
        const filteredIADL = this.iadlList.filter(i => 
            !userDept || (i.Departemen || i.departemen) === userDept
        );
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Create OTP</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>Create OTP</span></p>
                </div>
            </div>

            <div class="app-card app-card-info mb-md" style="background: #f0fdf4; border-left: 4px solid var(--success);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-info-circle-fill" style="color: var(--success); font-size: 1.2rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">Form Input OTP</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Lengkapi form di bawah untuk membuat OTP baru. Pilih Objective Template, KPI, dan Program dari IADL yang sudah tersedia.
                        </p>
                    </div>
                </div>
            </div>

            <form data-action="otpCreate.submit" id="otpCreateForm">
                <!-- User Info (Auto) -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-person-badge"></i> Informasi Pengguna</h3>
                    </div>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Department</label>
                                <input type="text" class="form-control" value="${this.escapeHtml(userDept || '-')}" 
                                       readonly style="background: #f8fafc;">
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Year</label>
                                <select name="year" class="form-select" required>
                                    <option value="">Pilih Tahun</option>
                                    <option value="2025">2025</option>
                                    <option value="2026" selected>2026</option>
                                    <option value="2027">2027</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Created By</label>
                                <input type="text" class="form-control" value="${this.escapeHtml(user.name || user.username || '-')}" 
                                       readonly style="background: #f8fafc;">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SELECT OBJECTIVE TEMPLATE -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-clipboard"></i> Objective</h3>
                        <span class="badge-status info">Pilih dari Template</span>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Objective Template <span style="color: var(--danger);">*</span></label>
                                <select name="templateCode" id="otpTemplateSelect" class="form-select" required>
                                    <option value="">Pilih Objective Template</option>
                                    ${filteredTemplates.map(t => `
                                        <option value="${this.escapeHtml(t.Template_Code || t.templateCode || '')}"
                                                data-objective="${this.escapeHtml(t.Objective || t.objective || '')}"
                                                data-kpi="${this.escapeHtml(t.Related_KPI || t.relatedKPI || t.KPI_Code || '')}"
                                                data-program="${this.escapeHtml(t.Suggested_Program || t.suggestedProgram || '')}">
                                            ${this.escapeHtml(t.Template_Code || t.templateCode || '')} - ${this.escapeHtml((t.Template_Name || t.templateName || '').substring(0, 50))}
                                        </option>
                                    `).join('')}
                                </select>
                                <small class="text-muted">Pilih template untuk mengisi objective secara otomatis</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Objective</label>
                                <textarea name="objective" id="otpObjective" class="form-control" rows="3" 
                                          placeholder="Objective akan terisi otomatis..." readonly></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SELECT KPI -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-bullseye"></i> KPI</h3>
                        <span class="badge-status info">Pilih dari Master KPI</span>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>KPI <span style="color: var(--danger);">*</span></label>
                                <select name="kpiCode" id="otpKPISelect" class="form-select" required>
                                    <option value="">Pilih KPI</option>
                                    ${filteredKPIs.map(k => `
                                        <option value="${this.escapeHtml(k.KPI_Code || k.kpiCode || '')}"
                                                data-name="${this.escapeHtml(k.KPI_Name || k.kpiName || '')}"
                                                data-uom="${this.escapeHtml(k.UOM || k.uom || '')}"
                                                data-polarity="${this.escapeHtml(k.Polarity || k.polarity || '')}"
                                                data-formula="${this.escapeHtml(k.Formula || k.formula || '')}">
                                            ${this.escapeHtml(k.KPI_Code || k.kpiCode || '')} - ${this.escapeHtml((k.KPI_Name || k.kpiName || '').substring(0, 50))}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="row">
                                <div class="col-6">
                                    <div class="form-group-custom">
                                        <label>KPI Name</label>
                                        <input type="text" id="otpKPIName" class="form-control" readonly 
                                               style="background: #f8fafc; font-size: var(--fs-sm);">
                                    </div>
                                </div>
                                <div class="col-3">
                                    <div class="form-group-custom">
                                        <label>UOM</label>
                                        <input type="text" id="otpKPIUOM" class="form-control" readonly 
                                               style="background: #f8fafc;">
                                    </div>
                                </div>
                                <div class="col-3">
                                    <div class="form-group-custom">
                                        <label>Polarity</label>
                                        <input type="text" id="otpKPIPolarity" class="form-control" readonly 
                                               style="background: #f8fafc;">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-12">
                            <div class="form-group-custom">
                                <label>Formula</label>
                                <input type="text" id="otpKPIFormula" class="form-control" readonly 
                                       style="background: #f8fafc; font-family: var(--font-mono); font-size: var(--fs-sm);">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SELECT PROGRAM (from IADL) -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-file-earmark-text"></i> Program (Referensi IADL)</h3>
                        <span class="badge-status warning">Dari IADL</span>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Program dari IADL <span style="color: var(--danger);">*</span></label>
                                <select name="programCode" id="otpProgramSelect" class="form-select" required>
                                    <option value="">Pilih Program (dari IADL)</option>
                                    ${filteredIADL.map(i => `
                                        <option value="${this.escapeHtml(i['No Hazard'] || i.noHazard || i.no_hazard || i.id || '')}"
                                                data-hazard="${this.escapeHtml(i['Deskripsi Hazard'] || i.deskripsiAspek || i.deskripsi_hazard || '')}"
                                                data-control="${this.escapeHtml(i['Pengendalian Risiko'] || i.pengendalianDampak || i.pengendalian_risiko || '')}"
                                                data-activity="${this.escapeHtml(i.Aktifitas || i.aktivitas || i.Aktivitas || '')}">
                                            ${this.escapeHtml(i['No Hazard'] || i.noHazard || i.id || '')} - ${this.escapeHtml((i['Pengendalian Risiko'] || i.pengendalianDampak || '').substring(0, 60))}
                                        </option>
                                    `).join('')}
                                </select>
                                <small class="text-muted">Pilih program pengendalian dari data IADL yang tersedia</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Deskripsi Hazard</label>
                                <textarea id="otpHazardDesc" class="form-control" rows="2" readonly 
                                          style="background: #f8fafc; font-size: var(--fs-sm);"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Program Pengendalian</label>
                                <textarea id="otpProgramControl" class="form-control" rows="2" readonly 
                                          style="background: #f8fafc; font-size: var(--fs-sm);"></textarea>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Aktivitas Terkait</label>
                                <input type="text" id="otpActivity" class="form-control" readonly 
                                       style="background: #f8fafc;">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- OTP DETAILS -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-pencil-square"></i> Detail OTP</h3>
                    </div>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Target <span style="color: var(--danger);">*</span></label>
                                <input type="text" name="target" class="form-control" 
                                       placeholder="Contoh: 0, 100%, 5 cases" required>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Timeline <span style="color: var(--danger);">*</span></label>
                                <select name="timeline" class="form-select" required>
                                    <option value="">Pilih Periode</option>
                                    <option value="Q1">Q1 (Jan-Mar)</option>
                                    <option value="Q2">Q2 (Apr-Jun)</option>
                                    <option value="Q3">Q3 (Jul-Sep)</option>
                                    <option value="Q4">Q4 (Oct-Dec)</option>
                                    <option value="Full Year">Full Year</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Weight (%) <span style="color: var(--danger);">*</span></label>
                                <input type="number" name="weight" class="form-control" 
                                       placeholder="0-100" min="0" max="100" required>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Owner / PIC <span style="color: var(--danger);">*</span></label>
                                <input type="text" name="owner" class="form-control" 
                                       placeholder="Nama penanggung jawab" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Budget</label>
                                <input type="text" name="budget" class="form-control" 
                                       placeholder="Contoh: 5000000">
                                <small class="text-muted">Opsional, isi dalam Rupiah</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ACTION BUTTONS -->
                <div class="d-flex gap-sm" style="justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" id="otpDraftBtn" data-action="otpCreate.saveDraft">
                        <i class="bi bi-save"></i> Save as Draft
                    </button>
                    <button type="submit" class="btn btn-primary" id="otpSubmitBtn">
                        <i class="bi bi-send"></i> Submit for Approval
                    </button>
                </div>
            </form>
        `;
    }

    // ============================================
    // EVENT HANDLERS (SETUP AFTER RENDER)
    // ============================================
    
    setupEventListeners() {
        // Template Select Change
        const templateSelect = document.getElementById('otpTemplateSelect');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const objective = selectedOption.dataset.objective || '';
                const kpiCode = selectedOption.dataset.kpi || '';
                const program = selectedOption.dataset.program || '';
                
                document.getElementById('otpObjective').value = objective;
                
                // Auto-select KPI if matches
                const kpiSelect = document.getElementById('otpKPISelect');
                if (kpiSelect && kpiCode) {
                    for (let i = 0; i < kpiSelect.options.length; i++) {
                        if (kpiSelect.options[i].value === kpiCode) {
                            kpiSelect.selectedIndex = i;
                            kpiSelect.dispatchEvent(new Event('change'));
                            break;
                        }
                    }
                }
            });
        }
        
        // KPI Select Change
        const kpiSelect = document.getElementById('otpKPISelect');
        if (kpiSelect) {
            kpiSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                document.getElementById('otpKPIName').value = selectedOption.dataset.name || '';
                document.getElementById('otpKPIUOM').value = selectedOption.dataset.uom || '';
                document.getElementById('otpKPIPolarity').value = selectedOption.dataset.polarity || '';
                document.getElementById('otpKPIFormula').value = selectedOption.dataset.formula || '';
            });
        }
        
        // Program Select Change
        const programSelect = document.getElementById('otpProgramSelect');
        if (programSelect) {
            programSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                document.getElementById('otpHazardDesc').value = selectedOption.dataset.hazard || '';
                document.getElementById('otpProgramControl').value = selectedOption.dataset.control || '';
                document.getElementById('otpActivity').value = selectedOption.dataset.activity || '';
            });
        }
    }

    // ============================================
    // SUBMIT ACTIONS
    // ============================================
    
    async submit(params, element) {
        if (this.isSubmitting) return;
        
        // Ambil form dari DOM
        const form = document.getElementById('otpCreateForm');
        if (!form) {
            return;
        }
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        // Validasi
        if (!data.templateCode || !data.kpiCode || !data.programCode) {
            return;
        }
        
        if (!data.target || !data.timeline || !data.weight || !data.owner) {
            return;
        }
        
        // Validasi weight
        const weight = parseFloat(data.weight);
        if (isNaN(weight) || weight < 0 || weight > 100) {
            toast('Weight harus antara 0-100', 'error');
            return;
        }
        
        this.isSubmitting = true;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
        }
        
        try {
            const user = this.state.currentUser || {};
            
            // Ambil data tambahan dari auto-fill fields
            const kpiName = document.getElementById('otpKPIName')?.value || '';
            const kpiUOM = document.getElementById('otpKPIUOM')?.value || '';
            const kpiPolarity = document.getElementById('otpKPIPolarity')?.value || '';
            const kpiFormula = document.getElementById('otpKPIFormula')?.value || '';
            const hazardDesc = document.getElementById('otpHazardDesc')?.value || '';
            const programControl = document.getElementById('otpProgramControl')?.value || '';
            const activity = document.getElementById('otpActivity')?.value || '';
            const objective = document.getElementById('otpObjective')?.value || '';
            
            const payload = {
                ...data,
                kpiName: kpiName || data.kpiName || '',
                uom: kpiUOM || data.uom || '',
                polarity: kpiPolarity || data.polarity || '',
                formula: kpiFormula || data.formula || '',
                hazardDesc: hazardDesc || data.hazardDesc || '',
                programControl: programControl || data.programControl || '',
                activity: activity || data.activity || '',
                objective: objective || data.objective || '',
                department: user.department || '',
                createdBy: user.username || user.name || '',
                status: 'Submitted',
                createdAt: new Date().toISOString()
            };
            
            console.log('Submitting OTP payload:', payload);
            
            const result = await this.saveOTP(payload);
            
            if (result.status === 'success') {
                toast('OTP berhasil disubmit!', 'success');
                form.reset();
                // Reset auto-fill fields
                ['otpObjective', 'otpKPIName', 'otpKPIUOM', 'otpKPIPolarity', 'otpKPIFormula',
                 'otpHazardDesc', 'otpProgramControl', 'otpActivity'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                
                // Redirect ke OTP History setelah 1.5 detik
                setTimeout(() => {
                    this.router.navigateTo('otp-history');
                }, 1500);
            } else {
                toast(result.message || 'Gagal menyimpan OTP', 'error');
            }
        } catch (error) {
            console.error('Submit error:', error);
            toast('Gagal menyimpan OTP: ' + error.message, 'error');
        } finally {
            this.isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-send"></i> Submit for Approval';
            }
        }
    }
    
    async saveDraft(params, element) {
        if (this.isSubmitting) return;
        
        // Ambil form dari DOM
        const form = document.getElementById('otpCreateForm');
        if (!form) {
            return;
        }
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        this.isSubmitting = true;
        const draftBtn = document.getElementById('otpDraftBtn');
        if (draftBtn) {
            draftBtn.disabled = true;
            draftBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
        }
        
        try {
            const user = this.state.currentUser || {};
            
            // Ambil data tambahan dari auto-fill fields
            const kpiName = document.getElementById('otpKPIName')?.value || '';
            const kpiUOM = document.getElementById('otpKPIUOM')?.value || '';
            const kpiPolarity = document.getElementById('otpKPIPolarity')?.value || '';
            const kpiFormula = document.getElementById('otpKPIFormula')?.value || '';
            const hazardDesc = document.getElementById('otpHazardDesc')?.value || '';
            const programControl = document.getElementById('otpProgramControl')?.value || '';
            const activity = document.getElementById('otpActivity')?.value || '';
            const objective = document.getElementById('otpObjective')?.value || '';
            
            const payload = {
                ...data,
                kpiName: kpiName || data.kpiName || '',
                uom: kpiUOM || data.uom || '',
                polarity: kpiPolarity || data.polarity || '',
                formula: kpiFormula || data.formula || '',
                hazardDesc: hazardDesc || data.hazardDesc || '',
                programControl: programControl || data.programControl || '',
                activity: activity || data.activity || '',
                objective: objective || data.objective || '',
                department: user.department || '',
                createdBy: user.username || user.name || '',
                status: 'Draft',
                createdAt: new Date().toISOString()
            };
            
            console.log('Saving draft OTP payload:', payload);
            
            const result = await this.saveOTP(payload);
            
            if (result.status === 'success') {
                toast('Draft OTP berhasil disimpan!', 'success');
            } else {
                toast(result.message || 'Gagal menyimpan draft', 'error');
            }
        } catch (error) {
            console.error('Save draft error:', error);
            toast('Gagal menyimpan draft: ' + error.message, 'error');
        } finally {
            this.isSubmitting = false;
            if (draftBtn) {
                draftBtn.disabled = false;
                draftBtn.innerHTML = '<i class="bi bi-save"></i> Save as Draft';
            }
        }
    }
    
    async saveOTP(payload) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'error', message: 'Google Sheets not configured' };
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'saveOTP');
            url.searchParams.append('data', JSON.stringify(payload));
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('Save OTP error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // ============================================
    // AFTER RENDER HOOK (dipanggil setelah DOM siap)
    // ============================================
    
    afterRender() {
        this.setupEventListeners();
    }

    // ============================================
    // UTILITY METHODS
    // ============================================
    
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
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">Create OTP</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>Create OTP</span></p>
                </div></div>
                <div class="app-card"><div class="empty-state">
                    <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <h3 class="mt-md">Memuat Data Referensi...</h3>
                    <p>Mengambil data KPI, Template, dan IADL</p>
                </div></div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Create OTP</h1>
                <p class="breadcrumb">Home / OTP Management / <span>Create OTP</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan saat memuat data referensi')}</p>
                <button class="btn btn-primary mt-md" data-action="otpCreate.retry">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }

    async retry() {
        this.router.navigateTo('otp-create');
    }
}