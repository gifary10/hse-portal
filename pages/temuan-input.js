// pages/temuan-input.js
// Input Temuan Audit Internal Page
// Form untuk menginput temuan audit internal

import { toast } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class TemuanInputPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.isLoading = false;
        this.isSubmitting = false;
        
        // Data referensi
        this.kpiList = [];
        this.templateList = [];
        this.iadlList = [];
    }

    async fetchReferenceData(action) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
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
            const [kpiResult, templateResult, iadlResult] = await Promise.all([
                this.fetchReferenceData('getAllKPI'),
                this.fetchReferenceData('getAllTemplates'),
                this.fetchReferenceData('getAll')
            ]);
            
            this.kpiList = kpiResult.data || [];
            this.templateList = templateResult.data || [];
            this.iadlList = iadlResult.data || [];
            
        } catch (error) {
            console.error('Failed to load reference data:', error);
            throw error;
        }
    }

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
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Input Temuan</h1>
                    <p class="breadcrumb">Home / Temuan Audit Internal / <span>Input Temuan</span></p>
                </div>
            </div>

            <div class="app-card app-card-info mb-md" style="background: #fef9e7; border-left: 4px solid var(--warning);">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-info-circle-fill" style="color: var(--warning); font-size: 1.2rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">Form Input Temuan Audit</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            Lengkapi form di bawah untuk mencatat temuan audit internal. Data akan tersimpan di Google Sheets.
                        </p>
                    </div>
                </div>
            </div>

            <form data-action="temuanInput.submit" id="temuanInputForm">
                <!-- User Info -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-person-badge"></i> Informasi Auditor</h3>
                    </div>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Auditor</label>
                                <input type="text" class="form-control" value="${this.escapeHtml(user.name || user.username || '-')}" 
                                       readonly style="background: #f8fafc;">
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Department Auditee</label>
                                <select name="department" id="temuanDepartment" class="form-select" required>
                                    <option value="">Pilih Departemen</option>
                                    ${this.getUniqueDepartments().map(dept => `
                                        <option value="${this.escapeHtml(dept)}" ${userDept === dept ? 'selected' : ''}>
                                            ${this.escapeHtml(dept)}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Tanggal Audit <span style="color: var(--danger);">*</span></label>
                                <input type="date" name="tanggalAudit" class="form-control" required 
                                       value="${new Date().toISOString().split('T')[0]}">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Klasifikasi Temuan -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-tag"></i> Klasifikasi Temuan</h3>
                    </div>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Kategori Temuan <span style="color: var(--danger);">*</span></label>
                                <select name="kategoriTemuan" id="kategoriTemuan" class="form-select" required>
                                    <option value="">Pilih Kategori</option>
                                    <option value="Ketidaksesuaian">Ketidaksesuaian (Non-Conformance)</option>
                                    <option value="Observasi">Observasi</option>
                                    <option value="OFI">Opportunity for Improvement (OFI)</option>
                                    <option value="Positif">Temuan Positif</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Klasifikasi <span style="color: var(--danger);">*</span></label>
                                <select name="klasifikasi" id="klasifikasiTemuan" class="form-select" required>
                                    <option value="">Pilih Klasifikasi</option>
                                    <option value="Mayor">Mayor</option>
                                    <option value="Minor">Minor</option>
                                    <option value="Observation">Observation</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Status <span style="color: var(--danger);">*</span></label>
                                <select name="status" class="form-select" required>
                                    <option value="Open">Open</option>
                                    <option value="In Progress">In Progress</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Deskripsi Temuan -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-file-earmark-text"></i> Deskripsi Temuan</h3>
                    </div>
                    <div class="row">
                        <div class="col-12">
                            <div class="form-group-custom">
                                <label>Uraian Temuan <span style="color: var(--danger);">*</span></label>
                                <textarea name="uraianTemuan" class="form-control" rows="4" required
                                          placeholder="Deskripsikan temuan secara detail..."></textarea>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Lokasi Temuan</label>
                                <input type="text" name="lokasi" class="form-control" 
                                       placeholder="Area/lokasi spesifik">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Akar Masalah & Dampak -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-diagram-2"></i> Analisis Awal</h3>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Penyebab/Akar Masalah</label>
                                <textarea name="akarMasalah" class="form-control" rows="2"
                                          placeholder="Identifikasi akar masalah (jika sudah diketahui)..."></textarea>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Dampak</label>
                                <textarea name="dampak" class="form-control" rows="2"
                                          placeholder="Dampak terhadap sistem, lingkungan, K3, dll..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Rekomendasi & Target -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-check2-square"></i> Rekomendasi & Target</h3>
                    </div>
                    <div class="row">
                        <div class="col-12">
                            <div class="form-group-custom">
                                <label>Rekomendasi Tindakan Perbaikan</label>
                                <textarea name="rekomendasi" class="form-control" rows="3"
                                          placeholder="Rekomendasi untuk perbaikan..."></textarea>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Target Penyelesaian <span style="color: var(--danger);">*</span></label>
                                <input type="date" name="targetSelesai" class="form-control" required>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Prioritas</label>
                                <select name="prioritas" class="form-select">
                                    <option value="Tinggi">Tinggi</option>
                                    <option value="Sedang" selected>Sedang</option>
                                    <option value="Rendah">Rendah</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="d-flex gap-sm" style="justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" data-page="temuan-daftar">
                        <i class="bi bi-x-circle"></i> Batal
                    </button>
                    <button type="button" class="btn btn-warning" id="temuanDraftBtn" data-action="temuanInput.saveDraft">
                        <i class="bi bi-save"></i> Save as Draft
                    </button>
                    <button type="submit" class="btn btn-primary" id="temuanSubmitBtn">
                        <i class="bi bi-send"></i> Simpan Temuan
                    </button>
                </div>
            </form>
        `;
    }

    getUniqueDepartments() {
        const departments = new Set();
        this.iadlList.forEach(item => {
            if (item.Departemen || item.departemen) {
                departments.add(item.Departemen || item.departemen);
            }
        });
        this.kpiList.forEach(item => {
            if (item.Department || item.department) {
                departments.add(item.Department || item.department);
            }
        });
        return Array.from(departments).sort();
    }

    async submit(params, element) {
        if (this.isSubmitting) return;
        
        const form = document.getElementById('temuanInputForm');
        if (!form) {
            toast('Form tidak ditemukan', 'error');
            return;
        }
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        // Validasi - field yang wajib
        if (!data.department) {
            toast('Silakan pilih department auditee', 'warning');
            return;
        }
        if (!data.kategoriTemuan) {
            toast('Silakan pilih kategori temuan', 'warning');
            return;
        }
        if (!data.klasifikasi) {
            toast('Silakan pilih klasifikasi temuan', 'warning');
            return;
        }
        if (!data.uraianTemuan) {
            toast('Uraian temuan harus diisi', 'warning');
            return;
        }
        if (!data.targetSelesai) {
            toast('Target penyelesaian harus diisi', 'warning');
            return;
        }
        
        this.isSubmitting = true;
        const submitBtn = form.querySelector('button[type="submit"]');
        const draftBtn = document.getElementById('temuanDraftBtn');
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
        }
        if (draftBtn) draftBtn.disabled = true;
        
        try {
            const user = this.state.currentUser || {};
            
            const payload = {
                ...data,
                createdBy: user.username || user.name || '',
                auditorDept: user.department || '',
                status: data.status || 'Open',
                createdAt: new Date().toISOString()
            };
            
            const result = await this.saveTemuan(payload);
            
            if (result.status === 'success') {
                toast('Temuan berhasil disimpan!', 'success');
                form.reset();
                
                setTimeout(() => {
                    this.router.navigateTo('temuan-daftar');
                }, 1500);
            } else {
                toast(result.message || 'Gagal menyimpan temuan', 'error');
            }
        } catch (error) {
            console.error('Submit error:', error);
            toast('Gagal menyimpan temuan: ' + error.message, 'error');
        } finally {
            this.isSubmitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-send"></i> Simpan Temuan';
            }
            if (draftBtn) draftBtn.disabled = false;
        }
    }

    async saveDraft(params, element) {
        if (this.isSubmitting) return;
        
        const form = document.getElementById('temuanInputForm');
        if (!form) {
            toast('Form tidak ditemukan', 'error');
            return;
        }
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        this.isSubmitting = true;
        const draftBtn = document.getElementById('temuanDraftBtn');
        if (draftBtn) {
            draftBtn.disabled = true;
            draftBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
        }
        
        try {
            const user = this.state.currentUser || {};
            
            const payload = {
                ...data,
                createdBy: user.username || user.name || '',
                auditorDept: user.department || '',
                status: 'Draft',
                createdAt: new Date().toISOString()
            };
            
            const result = await this.saveTemuan(payload);
            
            if (result.status === 'success') {
                toast('Draft temuan berhasil disimpan!', 'success');
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

    async saveTemuan(payload) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'error', message: 'Google Sheets not configured' };
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'saveTemuan');
            url.searchParams.append('data', JSON.stringify(payload));
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('Save temuan error:', error);
            return { status: 'error', message: error.message };
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
                <div class="page-header"><div class="page-header-left">
                    <h1 class="page-title">Input Temuan</h1>
                    <p class="breadcrumb">Home / Temuan Audit Internal / <span>Input Temuan</span></p>
                </div></div>
                <div class="app-card"><div class="empty-state">
                    <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <h3 class="mt-md">Memuat Data Referensi...</h3>
                </div></div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Input Temuan</h1>
                <p class="breadcrumb">Home / Temuan Audit Internal / <span>Input Temuan</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-page="temuan-input">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }
}