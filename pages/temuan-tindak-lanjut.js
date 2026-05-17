// pages/temuan-tindak-lanjut.js
// Tindak Lanjut Temuan Page - Detail temuan dan update tindak lanjut

import { toast, showModal, closeModal } from '../ui/components.js';
import { CONFIG, getWebAppUrl, isGoogleSheetsEnabled } from '../core/config.js';

export class TemuanTindakLanjutPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.isLoading = false;
        this.temuanData = null;
        this.temuanId = null;
    }

    async loadTemuanData(temuanId) {
        const cachedData = sessionStorage.getItem('selectedTemuan');
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                if (parsed.temuanId === temuanId || parsed.Temuan_ID === temuanId) {
                    this.temuanData = this.formatTemuanData(parsed);
                    return;
                }
            } catch (e) {}
        }
        
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            throw new Error('Google Sheets not configured');
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'getAllTemuan');
            
            const response = await fetch(url.toString(), {
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                const found = result.data.find(t => 
                    (t.Temuan_ID === temuanId || t.temuanId === temuanId || t.ID_Temuan === temuanId)
                );
                if (found) {
                    this.temuanData = this.formatTemuanData(found);
                } else {
                    throw new Error('Temuan tidak ditemukan');
                }
            }
        } catch (error) {
            console.error('Failed to load temuan data:', error);
            throw error;
        }
    }

    formatTemuanData(item) {
        const fieldMapping = {
            temuanId: ['Temuan_ID', 'temuanId', 'temuan_id', 'ID_Temuan'],
            department: ['Department', 'department', 'Departemen'],
            tanggalAudit: ['Tanggal_Audit', 'tanggalAudit', 'tanggal_audit'],
            kategoriTemuan: ['Kategori_Temuan', 'kategoriTemuan', 'kategori_temuan'],
            klasifikasi: ['Klasifikasi', 'klasifikasi'],
            uraianTemuan: ['Uraian_Temuan', 'uraianTemuan', 'uraian_temuan'],
            lokasi: ['Lokasi', 'lokasi'],
            akarMasalah: ['Akar_Masalah', 'akarMasalah', 'akar_masalah'],
            dampak: ['Dampak', 'dampak'],
            rekomendasi: ['Rekomendasi', 'rekomendasi'],
            targetSelesai: ['Target_Selesai', 'targetSelesai', 'target_selesai'],
            prioritas: ['Prioritas', 'prioritas'],
            status: ['Status', 'status'],
            createdAt: ['Created_At', 'createdAt', 'created_at'],
            createdBy: ['Created_By', 'createdBy', 'created_by'],
            auditorDept: ['Auditor_Dept', 'auditorDept', 'auditor_dept'],
            tindakanPerbaikan: ['Tindakan_Perbaikan', 'tindakanPerbaikan', 'tindakan_perbaikan'],
            tindakanPencegahan: ['Tindakan_Pencegahan', 'tindakanPencegahan', 'tindakan_pencegahan'],
            tglSelesai: ['Tgl_Selesai', 'tglSelesai', 'tgl_selesai'],
            hasilVerifikasi: ['Hasil_Verifikasi', 'hasilVerifikasi', 'hasil_verifikasi'],
            verifikator: ['Verifikator', 'verifikator'],
            tglVerifikasi: ['Tgl_Verifikasi', 'tglVerifikasi', 'tgl_verifikasi'],
            catatanTL: ['Catatan_TL', 'catatanTL', 'catatan_tl'],
            updatedBy: ['Updated_By', 'updatedBy', 'updated_by'],
            updatedAt: ['Updated_At', 'updatedAt', 'updated_at']
        };
        
        const result = {};
        for (const [field, possibleKeys] of Object.entries(fieldMapping)) {
            let value = '';
            for (const key of possibleKeys) {
                if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
                    value = item[key];
                    break;
                }
            }
            result[field] = value || '';
        }
        result._rowIndex = item.rowIndex || null;
        return result;
    }

    async render(page, params = {}) {
        this.temuanId = params.temuanId || sessionStorage.getItem('selectedTemuanId') || 
                        new URLSearchParams(window.location.search).get('temuanId');
        
        if (!this.temuanId) {
            return this.renderError('ID Temuan tidak ditemukan');
        }
        
        this.showLoading();
        
        try {
            await this.loadTemuanData(this.temuanId);
            this.hideLoading();
            
            if (!this.temuanData) {
                return this.renderError('Data temuan tidak ditemukan');
            }
            
            return this.renderHTML();
        } catch (error) {
            console.error('Render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const temuan = this.temuanData;
        const user = this.state.currentUser || {};
        const canEdit = this.canUserEdit();
        const hasTL = temuan.tindakanPerbaikan || temuan.status === 'Closed' || temuan.status === 'Verified';
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Tindak Lanjut Temuan</h1>
                    <p class="breadcrumb">Home / Temuan Audit Internal / <span>Tindak Lanjut</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" data-page="temuan-daftar">
                        <i class="bi bi-arrow-left"></i> Back to List
                    </button>
                </div>
            </div>

            <div class="app-card mb-md" style="background: ${this.getStatusBannerColor()}; border-left: 4px solid ${this.getStatusColor()};">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="bi ${this.getStatusIcon()}" style="font-size: 1.5rem; color: ${this.getStatusColor()};"></i>
                    <div>
                        <strong style="color: var(--text);">Status: ${this.getStatusBadge(temuan.status)}</strong>
                        <span style="margin-left: 12px; font-size: var(--fs-sm); color: var(--text-light);">
                            ID: <code>${this.escapeHtml(temuan.temuanId || '-')}</code>
                        </span>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-8">
                    <!-- Detail Temuan -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-file-earmark-text"></i> Detail Temuan</h3>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Department</label>
                                    <div class="info-value"><span class="badge-status default">${this.escapeHtml(temuan.department || '-')}</span></div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Tanggal Audit</label>
                                    <div class="info-value">${this.formatDate(temuan.tanggalAudit)}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Kategori</label>
                                    <div class="info-value">${this.getKategoriBadge(temuan.kategoriTemuan)}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Klasifikasi</label>
                                    <div class="info-value">${this.getKlasifikasiBadge(temuan.klasifikasi)}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Prioritas</label>
                                    <div class="info-value">${this.getPrioritasBadge(temuan.prioritas)}</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Lokasi</label>
                                    <div class="info-value">${this.escapeHtml(temuan.lokasi || '-')}</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Auditor</label>
                                    <div class="info-value">${this.escapeHtml(temuan.createdBy || '-')}</div>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Uraian Temuan</label>
                                    <div class="info-value" style="font-weight: 500; background: #fef9e7; padding: 12px; border-radius: var(--radius-md); border-left: 3px solid var(--warning);">
                                        ${this.escapeHtml(temuan.uraianTemuan || '-')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Analisis -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-diagram-2"></i> Analisis</h3>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Akar Masalah</label>
                                    <div class="info-value">${this.escapeHtml(temuan.akarMasalah || 'Belum diidentifikasi')}</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Dampak</label>
                                    <div class="info-value">${this.escapeHtml(temuan.dampak || '-')}</div>
                                </div>
                            </div>
                            <div class="col-12">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Rekomendasi</label>
                                    <div class="info-value">${this.escapeHtml(temuan.rekomendasi || '-')}</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Target Selesai</label>
                                    <div class="info-value" style="font-weight: 600; color: ${this.isOverdue(temuan.targetSelesai) ? 'var(--danger)' : 'var(--primary)'};">
                                        ${this.formatDate(temuan.targetSelesai)}
                                        ${this.isOverdue(temuan.targetSelesai) && temuan.status !== 'Closed' && temuan.status !== 'Verified' ? ' <span class="badge-status danger">Overdue</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tindak Lanjut Section -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-check2-square"></i> Tindak Lanjut</h3>
                            ${temuan.status === 'Verified' ? '<span class="badge-status success">Verified</span>' : ''}
                        </div>
                        
                        ${hasTL ? `
                            <div class="row">
                                <div class="col-12">
                                    <div class="info-item mb-sm">
                                        <label class="info-label">Tindakan Perbaikan</label>
                                        <div class="info-value" style="background: #f0fdf4; padding: 12px; border-radius: var(--radius-md); border-left: 3px solid var(--success);">
                                            ${this.escapeHtml(temuan.tindakanPerbaikan || '-')}
                                        </div>
                                    </div>
                                </div>
                                <div class="col-12">
                                    <div class="info-item mb-sm">
                                        <label class="info-label">Tindakan Pencegahan</label>
                                        <div class="info-value" style="background: #f8fafc; padding: 12px; border-radius: var(--radius-md);">
                                            ${this.escapeHtml(temuan.tindakanPencegahan || '-')}
                                        </div>
                                    </div>
                                </div>
                                ${temuan.tglSelesai ? `
                                    <div class="col-md-4">
                                        <div class="info-item mb-sm">
                                            <label class="info-label">Tanggal Selesai</label>
                                            <div class="info-value">${this.formatDate(temuan.tglSelesai)}</div>
                                        </div>
                                    </div>
                                ` : ''}
                                ${temuan.catatanTL ? `
                                    <div class="col-md-8">
                                        <div class="info-item mb-sm">
                                            <label class="info-label">Catatan</label>
                                            <div class="info-value">${this.escapeHtml(temuan.catatanTL)}</div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        ` : `
                            <div class="text-center" style="padding: var(--space-lg);">
                                <i class="bi bi-hourglass-split" style="font-size: 2rem; color: var(--text-muted);"></i>
                                <p style="color: var(--text-light); margin-top: var(--space-sm);">Belum ada tindak lanjut yang dicatat</p>
                            </div>
                        `}
                        
                        ${temuan.hasilVerifikasi ? `
                            <div class="mt-md pt-md border-top">
                                <h4 style="font-size: var(--fs-sm); color: var(--text-light); margin-bottom: var(--space-sm);">
                                    <i class="bi bi-check-circle-fill" style="color: var(--success);"></i> Hasil Verifikasi
                                </h4>
                                <div class="info-value" style="background: #f0fdf4; padding: 12px; border-radius: var(--radius-md);">
                                    ${this.escapeHtml(temuan.hasilVerifikasi)}
                                </div>
                                <div class="row mt-sm">
                                    <div class="col-md-6">
                                        <div class="info-item">
                                            <label class="info-label">Verifikator</label>
                                            <div class="info-value">${this.escapeHtml(temuan.verifikator || '-')}</div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="info-item">
                                            <label class="info-label">Tanggal Verifikasi</label>
                                            <div class="info-value">${this.formatDate(temuan.tglVerifikasi)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Right Column - Actions -->
                <div class="col-md-4">
                    ${canEdit ? this.renderActionPanel() : this.renderViewOnlyPanel()}
                </div>
            </div>
        `;
    }

    renderActionPanel() {
        const temuan = this.temuanData;
        const isClosed = temuan.status === 'Closed' || temuan.status === 'Verified';
        
        return `
            <div class="app-card mb-md" style="position: sticky; top: var(--space-md);">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-gear"></i> Action Panel</h3>
                </div>
                
                ${!isClosed ? `
                    <form data-action="temuanTindakLanjut.saveTindakLanjut" id="tindakLanjutForm">
                        <input type="hidden" name="temuanId" value="${this.escapeHtml(temuan.temuanId)}">
                        <input type="hidden" name="rowIndex" value="${temuan._rowIndex || ''}">
                        
                        <div class="form-group-custom">
                            <label>Status</label>
                            <select name="status" class="form-select">
                                <option value="Open" ${temuan.status === 'Open' ? 'selected' : ''}>Open</option>
                                <option value="In Progress" ${temuan.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Closed" ${temuan.status === 'Closed' ? 'selected' : ''}>Closed</option>
                            </select>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>Tindakan Perbaikan <span style="color: var(--danger);">*</span></label>
                            <textarea name="tindakanPerbaikan" class="form-control" rows="3" 
                                      placeholder="Jelaskan tindakan perbaikan yang dilakukan">${this.escapeHtml(temuan.tindakanPerbaikan || '')}</textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>Tindakan Pencegahan</label>
                            <textarea name="tindakanPencegahan" class="form-control" rows="2" 
                                      placeholder="Tindakan pencegahan agar tidak terulang">${this.escapeHtml(temuan.tindakanPencegahan || '')}</textarea>
                        </div>
                        
                        <div class="form-group-custom">
                            <label>Tanggal Selesai</label>
                            <input type="date" name="tglSelesai" class="form-control" 
                                   value="${temuan.tglSelesai || ''}">
                        </div>
                        
                        <div class="form-group-custom">
                            <label>Catatan</label>
                            <textarea name="catatanTL" class="form-control" rows="2" 
                                      placeholder="Catatan tambahan">${this.escapeHtml(temuan.catatanTL || '')}</textarea>
                        </div>
                        
                        <button type="submit" class="btn btn-success w-100">
                            <i class="bi bi-save"></i> Simpan Tindak Lanjut
                        </button>
                    </form>
                ` : `
                    <div style="text-align: center; padding: var(--space-md);">
                        <i class="bi bi-check-circle-fill" style="font-size: 3rem; color: var(--success);"></i>
                        <p class="mt-md" style="color: var(--text-light);">Temuan sudah ${temuan.status === 'Verified' ? 'diverifikasi' : 'ditutup'}</p>
                    </div>
                `}
                
                ${this.canVerify() && temuan.status === 'Closed' ? `
                    <div class="mt-md pt-md border-top">
                        <button class="btn btn-primary w-100" data-action="temuanTindakLanjut.verify">
                            <i class="bi bi-check-circle"></i> Verifikasi Temuan
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderViewOnlyPanel() {
        const temuan = this.temuanData;
        return `
            <div class="app-card mb-md" style="background: #f8fafc;">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-info-circle"></i> Status Information</h3>
                </div>
                <div class="info-item mb-sm">
                    <label class="info-label">Current Status</label>
                    <div class="info-value">${this.getStatusBadge(temuan.status)}</div>
                </div>
                <div class="info-item mb-sm">
                    <label class="info-label">Target Selesai</label>
                    <div class="info-value">${this.formatDate(temuan.targetSelesai)}</div>
                </div>
                <p style="color: var(--text-light); font-size: var(--fs-sm); margin-top: var(--space-sm);">
                    <i class="bi bi-lock"></i> Anda tidak memiliki akses untuk mengedit temuan ini.
                </p>
            </div>
        `;
    }

    canUserEdit() {
        const user = this.state.currentUser;
        if (!user) return false;
        
        if (user.role === 'hse' || user.role === 'top_management') return true;
        
        // Department user yang membuat temuan
        if (this.temuanData && this.temuanData.createdBy === (user.username || user.name) &&
            (this.temuanData.status === 'Open' || this.temuanData.status === 'In Progress')) {
            return true;
        }
        
        // Department user yang sama dengan department temuan
        if (this.temuanData && this.temuanData.department === user.department &&
            (this.temuanData.status === 'Open' || this.temuanData.status === 'In Progress')) {
            return true;
        }
        
        return false;
    }

    canVerify() {
        const user = this.state.currentUser;
        if (!user) return false;
        return user.role === 'hse' || user.role === 'top_management';
    }

    async saveTindakLanjut(params, element) {
        const form = document.getElementById('tindakLanjutForm');
        if (!form) {
            toast('Form tidak ditemukan', 'error');
            return;
        }
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        // Validasi: tindakan perbaikan harus diisi jika status bukan Open
        if (data.status !== 'Open' && !data.tindakanPerbaikan) {
            toast('Tindakan perbaikan harus diisi untuk status selain Open', 'warning');
            return;
        }
        
        try {
            const user = this.state.currentUser || {};
            
            const payload = {
                temuanId: data.temuanId,
                rowIndex: data.rowIndex,
                status: data.status,
                tindakanPerbaikan: data.tindakanPerbaikan || '',
                tindakanPencegahan: data.tindakanPencegahan || '',
                tglSelesai: data.tglSelesai || '',
                catatanTL: data.catatanTL || '',
                updatedBy: user.username || user.name || '',
                updatedAt: new Date().toISOString()
            };
            
            const result = await this.saveTL(payload);
            
            if (result.status === 'success') {
                toast('Tindak lanjut berhasil disimpan!', 'success');
                
                // Update local data
                this.temuanData.status = data.status;
                this.temuanData.tindakanPerbaikan = data.tindakanPerbaikan;
                this.temuanData.tindakanPencegahan = data.tindakanPencegahan;
                this.temuanData.tglSelesai = data.tglSelesai;
                this.temuanData.catatanTL = data.catatanTL;
                this.temuanData.updatedBy = payload.updatedBy;
                this.temuanData.updatedAt = payload.updatedAt;
                
                // Re-render halaman
                const mainContent = document.getElementById('mainContent');
                if (mainContent) {
                    mainContent.innerHTML = this.renderHTML();
                }
            } else {
                toast(result.message || 'Gagal menyimpan tindak lanjut', 'error');
            }
        } catch (error) {
            console.error('Save TL error:', error);
            toast('Gagal menyimpan: ' + error.message, 'error');
        }
    }

    async verify() {
        const content = `
            <div style="text-align: center;">
                <i class="bi bi-check-circle" style="font-size: 3rem; color: var(--success);"></i>
                <p class="mt-md">Apakah Anda yakin ingin <strong>memverifikasi</strong> temuan ini?</p>
                <p class="text-muted" style="font-size: var(--fs-sm);">Status akan berubah menjadi "Verified"</p>
                <div class="form-group-custom mt-md">
                    <label>Hasil Verifikasi</label>
                    <textarea id="hasilVerifikasiInput" class="form-control" rows="3" 
                              placeholder="Masukkan hasil verifikasi..."></textarea>
                </div>
                <div class="d-flex justify-content-center gap-sm mt-lg">
                    <button class="btn btn-secondary" data-action="modal.close">
                        <i class="bi bi-x-circle"></i> Batal
                    </button>
                    <button class="btn btn-success" id="confirmVerifyBtn">
                        <i class="bi bi-check-circle"></i> Ya, Verifikasi
                    </button>
                </div>
            </div>
        `;
        
        showModal('Verifikasi Temuan', content);
        
        document.getElementById('confirmVerifyBtn').addEventListener('click', async () => {
            closeModal();
            const hasilVerifikasi = document.getElementById('hasilVerifikasiInput')?.value || '';
            
            try {
                const user = this.state.currentUser || {};
                
                const payload = {
                    temuanId: this.temuanData.temuanId,
                    rowIndex: this.temuanData._rowIndex,
                    status: 'Verified',
                    hasilVerifikasi: hasilVerifikasi,
                    verifikator: user.username || user.name || '',
                    tglVerifikasi: new Date().toISOString(),
                    updatedBy: user.username || user.name || '',
                    updatedAt: new Date().toISOString()
                };
                
                const result = await this.saveTL(payload);
                
                if (result.status === 'success') {
                    toast('Temuan berhasil diverifikasi!', 'success');
                    this.temuanData.status = 'Verified';
                    this.temuanData.hasilVerifikasi = hasilVerifikasi;
                    this.temuanData.verifikator = user.username || user.name || '';
                    this.temuanData.tglVerifikasi = new Date().toISOString();
                    
                    const mainContent = document.getElementById('mainContent');
                    if (mainContent) {
                        mainContent.innerHTML = this.renderHTML();
                    }
                } else {
                    toast(result.message || 'Gagal verifikasi', 'error');
                }
            } catch (error) {
                toast('Gagal verifikasi: ' + error.message, 'error');
            }
        });
    }

    async saveTL(payload) {
        const webAppUrl = getWebAppUrl();
        
        if (!isGoogleSheetsEnabled() || !webAppUrl || webAppUrl.includes('YOUR_WEB_APP_ID')) {
            return { status: 'error', message: 'Google Sheets not configured' };
        }
        
        try {
            const url = new URL(webAppUrl);
            url.searchParams.append('action', 'updateTemuanTL');
            url.searchParams.append('data', JSON.stringify(payload));
            
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
            
        } catch (error) {
            console.error('Save TL error:', error);
            return { status: 'error', message: error.message };
        }
    }

    isOverdue(targetDate) {
        if (!targetDate) return false;
        const target = new Date(targetDate);
        const now = new Date();
        return target < now;
    }

    getStatusBannerColor() {
        const colors = {
            'Open': '#fee2e2',
            'In Progress': '#fef3c7',
            'Closed': '#dcfce7',
            'Verified': '#e0f2fe',
            'Draft': '#f8fafc'
        };
        return colors[this.temuanData?.status] || '#f8fafc';
    }

    getStatusColor() {
        const colors = {
            'Open': 'var(--danger)',
            'In Progress': 'var(--warning)',
            'Closed': 'var(--success)',
            'Verified': 'var(--info)',
            'Draft': 'var(--text-muted)'
        };
        return colors[this.temuanData?.status] || 'var(--text-muted)';
    }

    getStatusIcon() {
        const icons = {
            'Open': 'bi-exclamation-circle-fill',
            'In Progress': 'bi-hourglass-split',
            'Closed': 'bi-check-circle-fill',
            'Verified': 'bi-check2-all',
            'Draft': 'bi-pencil'
        };
        return icons[this.temuanData?.status] || 'bi-info-circle';
    }

    getStatusBadge(status) {
        const badges = {
            'Open': 'danger',
            'In Progress': 'warning',
            'Closed': 'success',
            'Verified': 'info',
            'Draft': 'default'
        };
        return `<span class="badge-status ${badges[status] || 'default'}">${status || '-'}</span>`;
    }

    getKategoriBadge(value) {
        const badges = {
            'Ketidaksesuaian': 'danger',
            'Observasi': 'warning',
            'OFI': 'info',
            'Positif': 'success'
        };
        return `<span class="badge-status ${badges[value] || 'default'}">${value || '-'}</span>`;
    }

    getKlasifikasiBadge(value) {
        const badges = { 'Mayor': 'danger', 'Minor': 'warning', 'Observation': 'info' };
        return `<span class="badge-status ${badges[value] || 'default'}">${value || '-'}</span>`;
    }

    getPrioritasBadge(value) {
        const badges = { 'Tinggi': 'danger', 'Sedang': 'warning', 'Rendah': 'success' };
        return `<span class="badge-status ${badges[value] || 'default'}">${value || '-'}</span>`;
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
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
                    <h1 class="page-title">Tindak Lanjut Temuan</h1>
                    <p class="breadcrumb">Home / Temuan Audit Internal / <span>Tindak Lanjut</span></p>
                </div></div>
                <div class="app-card"><div class="empty-state">
                    <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <h3 class="mt-md">Memuat Data Temuan...</h3>
                </div></div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Tindak Lanjut Temuan</h1>
                <p class="breadcrumb">Home / Temuan Audit Internal / <span>Tindak Lanjut</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Temuan tidak ditemukan')}</p>
                <button class="btn btn-primary mt-md" data-page="temuan-daftar">
                    <i class="bi bi-arrow-left"></i> Kembali ke Daftar Temuan
                </button>
            </div></div>
        `;
    }
}