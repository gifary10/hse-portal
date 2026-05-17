// pages/otp-review.js
// OTP Review Page - Menampilkan detail OTP (dengan multiple programs) dan memungkinkan review/approval
// [UPDATED: Menggunakan ApiService, standardisasi field reviewedBy, loading states]

import { toast, showModal, closeModal } from '../ui/components.js';
import { getApi } from '../core/api.js';

export class OTPReviewPage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.api = getApi();
        this.isLoading = false;
        this.isSubmitting = false;
        this.otpData = null;
        this.otpId = null;
    }

    // ============================================
    // DATA LOADING (menggunakan ApiService)
    // ============================================
    
    async loadOTPData(otpId) {
        const cachedData = sessionStorage.getItem('selectedOTP');
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                if (parsed.otpId === otpId || parsed.OTP_ID === otpId) {
                    this.otpData = this.formatOTPData(parsed);
                    return;
                }
            } catch (e) {}
        }
        
        try {
            const result = await this.api.getAllOTP();
            if (result.status === 'success' && result.data) {
                const found = result.data.find(o => 
                    (o.OTP_ID === otpId || o.otpId === otpId)
                );
                if (found) {
                    this.otpData = this.formatOTPData(found);
                } else {
                    throw new Error('OTP tidak ditemukan');
                }
            }
        } catch (error) {
            console.error('Failed to load OTP data:', error);
            throw error;
        }
    }

    formatOTPData(item) {
        const fieldMapping = {
            otpId: ['OTP_ID', 'otpId', 'otp_id'],
            department: ['Department', 'department'],
            year: ['Year', 'year'],
            templateCode: ['Template_Code', 'templateCode'],
            objective: ['Objective', 'objective'],
            kpiCode: ['KPI_Code', 'kpiCode'],
            kpiName: ['KPI_Name', 'kpiName'],
            uom: ['UOM', 'uom'],
            polarity: ['Polarity', 'polarity'],
            formula: ['Formula', 'formula'],
            programCode: ['Program_Code', 'programCode', 'Program_Codes'],
            hazardDesc: ['Hazard_Description', 'hazardDesc', 'Hazard_Descriptions'],
            programControl: ['Program_Control', 'programControl', 'Program_Controls'],
            activity: ['Activity', 'activity', 'Activities'],
            dampak: ['Dampak', 'dampak'],
            target: ['Target', 'target'],
            timeline: ['Timeline', 'timeline'],
            owner: ['Owner', 'owner'],
            budget: ['Budget', 'budget'],
            weight: ['Weight', 'weight'],
            status: ['Status', 'status'],
            createdDate: ['Created_Date', 'createdDate', 'created_at'],
            createdBy: ['Created_By', 'createdBy', 'created_by'],
            reviewerNotes: ['Reviewer_Notes', 'reviewerNotes', 'reviewer_notes'],
            reviewedBy: ['Reviewed_By', 'reviewedBy', 'reviewed_by'],
            reviewedDate: ['Reviewed_Date', 'reviewedDate', 'reviewed_date']
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
        
        // Parse multiple programs into array
        result.programs = this.parseProgramsArray(result);
        
        return result;
    }

    parseProgramsArray(otp) {
        const programs = [];
        
        const programCodes = (otp.programCode || '').split('|').filter(p => p);
        const hazardDescs = (otp.hazardDesc || '').split('|').filter(p => p);
        const dampaks = (otp.dampak || '').split('|').filter(p => p);
        const programControls = (otp.programControl || '').split('|').filter(p => p);
        const activities = (otp.activity || '').split('|').filter(p => p);
        
        const maxLength = Math.max(
            programCodes.length, hazardDescs.length, dampaks.length,
            programControls.length, activities.length
        );
        
        for (let i = 0; i < maxLength; i++) {
            if (programCodes[i] || hazardDescs[i]) {
                programs.push({
                    programCode: programCodes[i] || '',
                    hazardDesc: hazardDescs[i] || '',
                    dampak: dampaks[i] || '',
                    programControl: programControls[i] || '',
                    activity: activities[i] || '',
                    index: i + 1
                });
            }
        }
        
        return programs;
    }

    // ============================================
    // RENDER
    // ============================================
    
    async render(page, params = {}) {
        this.otpId = params.otpId || new URLSearchParams(window.location.search).get('otpId');
        
        if (!this.otpId) {
            this.otpId = sessionStorage.getItem('selectedOTPId');
        }
        
        if (!this.otpId) {
            return this.renderError('OTP ID tidak ditemukan');
        }
        
        this.showLoading();
        
        try {
            await this.loadOTPData(this.otpId);
            this.hideLoading();
            
            if (!this.otpData) {
                return this.renderError('Data OTP tidak ditemukan');
            }
            
            return this.renderHTML();
        } catch (error) {
            console.error('Render error:', error);
            this.hideLoading();
            return this.renderError(error.message);
        }
    }

    renderHTML() {
        const otp = this.otpData;
        const user = this.state.currentUser || {};
        const canReview = this.canUserReview();
        const canEdit = this.canUserEdit();
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">Review OTP</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>Review OTP</span></p>
                </div>
                <div class="d-flex gap-sm">
                    <button class="btn btn-outline-primary" data-page="otp-history">
                        <i class="bi bi-arrow-left"></i> Back to List
                    </button>
                    ${canEdit ? `
                        <button class="btn btn-warning" id="editOtpBtn" data-action="otpReview.editOTP">
                            <i class="bi bi-pencil-square"></i> Edit OTP
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- OTP Status Banner -->
            <div class="app-card mb-md" style="background: ${this.getStatusBannerColor()}; border-left: 4px solid ${this.getStatusColor()};">
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <i class="bi ${this.getStatusIcon()}" style="font-size: 1.5rem; color: ${this.getStatusColor()};"></i>
                    <div>
                        <strong style="color: var(--text);">Status: ${this.getStatusBadge(otp.status)}</strong>
                        <span style="margin-left: 12px; font-size: var(--fs-sm); color: var(--text-light);">
                            OTP ID: <code>${this.escapeHtml(otp.otpId || '-')}</code>
                        </span>
                    </div>
                    ${otp.reviewedDate ? `
                        <div style="margin-left: auto; font-size: var(--fs-xs); color: var(--text-muted);">
                            <i class="bi bi-clock"></i> Direview: ${this.formatDateTime(otp.reviewedDate)}
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- REVIEWER NOTES SECTION -->
            ${otp.reviewerNotes ? `
                <div class="app-card mb-md" style="background: #fef9e7; border-left: 4px solid var(--warning);">
                    <div class="card-header">
                        <h3 class="card-title" style="color: var(--warning);">
                            <i class="bi bi-chat-square-text"></i> Catatan Reviewer
                        </h3>
                        ${otp.reviewedBy ? `<span class="badge-status info">Oleh: ${this.escapeHtml(otp.reviewedBy)}</span>` : ''}
                    </div>
                    <div style="padding: var(--space-md);">
                        <p style="margin: 0; white-space: pre-wrap; font-style: italic;">
                            "${this.escapeHtml(otp.reviewerNotes)}"
                        </p>
                        ${otp.status === 'Revision Requested' ? `
                            <div class="alert alert-warning mt-md" style="background: #fff3cd; padding: 12px; border-radius: var(--radius-md); margin-top: 12px;">
                                <i class="bi bi-info-circle"></i> 
                                <strong>Perlu Revisi!</strong> Silakan edit OTP ini sesuai catatan di atas, lalu submit ulang.
                            </div>
                        ` : ''}
                        ${otp.status === 'Rejected' ? `
                            <div class="alert alert-danger mt-md" style="background: #fee2e2; padding: 12px; border-radius: var(--radius-md); margin-top: 12px;">
                                <i class="bi bi-x-circle"></i> 
                                <strong>OTP Ditolak!</strong> Silakan buat OTP baru dengan perbaikan sesuai catatan.
                            </div>
                        ` : ''}
                        ${otp.status === 'Approved' ? `
                            <div class="alert alert-success mt-md" style="background: #dcfce7; padding: 12px; border-radius: var(--radius-md); margin-top: 12px;">
                                <i class="bi bi-check-circle"></i> 
                                <strong>OTP Disetujui!</strong> OTP ini telah disetujui dan akan dipantau progresnya.
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}

            <div class="row">
                <!-- Left Column -->
                <div class="col-md-8">
                    <!-- General Information -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-info-circle"></i> General Information</h3>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Department</label>
                                    <div class="info-value">
                                        <span class="badge-status default">${this.escapeHtml(otp.department || '-')}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Year</label>
                                    <div class="info-value">${this.escapeHtml(otp.year || '-')}</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Created By</label>
                                    <div class="info-value">${this.escapeHtml(otp.createdBy || '-')}</div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Created Date</label>
                                    <div class="info-value">${this.formatDateTime(otp.createdDate)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Objective & KPI -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-bullseye"></i> Objective & KPI</h3>
                        </div>
                        <div class="info-item mb-sm">
                            <label class="info-label">Template Code</label>
                            <div class="info-value"><code>${this.escapeHtml(otp.templateCode || '-')}</code></div>
                        </div>
                        <div class="info-item mb-sm">
                            <label class="info-label">Objective</label>
                            <div class="info-value" style="font-weight: 500;">${this.escapeHtml(otp.objective || '-')}</div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">KPI Code</label>
                                    <div class="info-value"><code>${this.escapeHtml(otp.kpiCode || '-')}</code></div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">KPI Name</label>
                                    <div class="info-value">${this.escapeHtml(otp.kpiName || '-')}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">UOM</label>
                                    <div class="info-value">${this.escapeHtml(otp.uom || '-')}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Polarity</label>
                                    <div class="info-value">${this.getPolarityBadge(otp.polarity)}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Formula</label>
                                    <div class="info-value"><code style="font-size: var(--fs-xs);">${this.escapeHtml(otp.formula || '-')}</code></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- MULTIPLE PROGRAMS SECTION (IADL) -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-files"></i> Program (IADL Reference)</h3>
                            <span class="badge-status info">${otp.programs.length} Program</span>
                        </div>
                        <div style="max-height: 500px; overflow-y: auto;">
                            ${otp.programs.length > 0 ? otp.programs.map(prog => `
                                <div class="program-card mb-md" style="padding: var(--space-md); background: #f8fafc; border-radius: var(--radius-md); border-left: 3px solid var(--primary);">
                                    <h4 style="font-size: var(--fs-sm); color: var(--primary); margin-bottom: var(--space-sm);">
                                        <i class="bi bi-file-earmark-text"></i> Program ${prog.index}
                                    </h4>
                                    <div class="row">
                                        <div class="col-12">
                                            <div class="info-item mb-sm">
                                                <label class="info-label">Deskripsi Hazard</label>
                                                <div class="info-value" style="font-weight: 500;">${this.escapeHtml(prog.hazardDesc || '-')}</div>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="info-item mb-sm">
                                                <label class="info-label">Dampak</label>
                                                <div class="info-value">${this.escapeHtml(prog.dampak || '-')}</div>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="info-item mb-sm">
                                                <label class="info-label">Program Code</label>
                                                <div class="info-value"><code>${this.escapeHtml(prog.programCode || '-')}</code></div>
                                            </div>
                                        </div>
                                        <div class="col-12">
                                            <div class="info-item mb-sm">
                                                <label class="info-label">Deskripsi Pengendalian</label>
                                                <div class="info-value" style="font-weight: 500;">${this.escapeHtml(prog.programControl || '-')}</div>
                                            </div>
                                        </div>
                                        <div class="col-12">
                                            <div class="info-item mb-sm">
                                                <label class="info-label">Aktivitas Terkait</label>
                                                <div class="info-value">${this.escapeHtml(prog.activity || '-')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : `
                                <div class="empty-state">
                                    <i class="bi bi-files"></i>
                                    <p>Tidak ada program yang dipilih</p>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Target & Details -->
                    <div class="app-card mb-md">
                        <div class="card-header">
                            <h3 class="card-title"><i class="bi bi-pencil-square"></i> Target & Details</h3>
                        </div>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Target</label>
                                    <div class="info-value" style="font-size: var(--fs-lg); font-weight: 700; color: var(--primary);">
                                        ${this.escapeHtml(otp.target || '-')}
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Timeline</label>
                                    <div class="info-value">
                                        <span class="badge-status info">${this.escapeHtml(otp.timeline || '-')}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Weight</label>
                                    <div class="info-value" style="font-size: var(--fs-lg); font-weight: 700;">
                                        ${otp.weight ? `${otp.weight}%` : '-'}
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Owner / PIC</label>
                                    <div class="info-value"><strong>${this.escapeHtml(otp.owner || '-')}</strong></div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item mb-sm">
                                    <label class="info-label">Budget</label>
                                    <div class="info-value">
                                        ${otp.budget ? `Rp ${this.formatNumber(otp.budget)}` : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column - Actions -->
                <div class="col-md-4">
                    ${canReview ? this.renderReviewActions() : this.renderStatusInfo()}
                </div>
            </div>
        `;
    }

    renderReviewActions() {
        const otp = this.otpData;
        
        if (otp.status === 'Approved' || otp.status === 'Rejected') {
            return `
                <div class="app-card mb-md" style="background: #f8fafc;">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-check-circle"></i> Review Complete</h3>
                    </div>
                    <p style="color: var(--text-light); font-size: var(--fs-sm);">
                        OTP ini sudah selesai direview dengan status <strong>${otp.status}</strong>.
                    </p>
                </div>
            `;
        }
        
        return `
            <div class="app-card mb-md" style="position: sticky; top: var(--space-md);">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-check2-square"></i> Review Actions</h3>
                </div>
                
                <form data-action="otpReview.submitReview" id="otpReviewForm">
                    <input type="hidden" name="otpId" value="${this.escapeHtml(otp.otpId)}">
                    <input type="hidden" name="rowIndex" value="${otp._rowIndex || ''}">
                    
                    <div class="form-group-custom">
                        <label><i class="bi bi-chat-square-text"></i> Review Notes</label>
                        <textarea name="reviewerNotes" class="form-control" rows="4" 
                                  placeholder="Masukkan catatan review (wajib untuk reject/request revision)"></textarea>
                    </div>
                    
                    <div class="d-flex gap-sm" style="flex-direction: column;">
                        <button type="button" class="btn btn-success w-100" 
                                data-action="otpReview.approve" 
                                style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);">
                            <i class="bi bi-check-circle"></i> Approve OTP
                        </button>
                        <button type="button" class="btn btn-danger w-100" 
                                data-action="otpReview.reject"
                                style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
                            <i class="bi bi-x-circle"></i> Reject OTP
                        </button>
                        <button type="button" class="btn btn-outline-primary w-100" 
                                data-action="otpReview.requestRevision">
                            <i class="bi bi-arrow-repeat"></i> Request Revision
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    renderStatusInfo() {
        const otp = this.otpData;
        return `
            <div class="app-card mb-md" style="background: #f8fafc;">
                <div class="card-header">
                    <h3 class="card-title"><i class="bi bi-info-circle"></i> Status Information</h3>
                </div>
                <div class="info-item mb-sm">
                    <label class="info-label">Current Status</label>
                    <div class="info-value">${this.getStatusBadge(otp.status)}</div>
                </div>
                ${otp.reviewedBy ? `
                <div class="info-item mb-sm">
                    <label class="info-label">Reviewed By</label>
                    <div class="info-value">${this.escapeHtml(otp.reviewedBy)}</div>
                </div>
                ` : ''}
                ${otp.reviewedDate ? `
                <div class="info-item mb-sm">
                    <label class="info-label">Reviewed Date</label>
                    <div class="info-value">${this.formatDateTime(otp.reviewedDate)}</div>
                </div>
                ` : ''}
                <p style="color: var(--text-light); font-size: var(--fs-sm); margin-top: var(--space-sm);">
                    <i class="bi bi-lock"></i> Anda tidak memiliki akses untuk mereview OTP ini.
                </p>
            </div>
        `;
    }

    // ============================================
    // REVIEW ACTIONS (dengan ApiService dan loading state)
    // ============================================
    
    canUserReview() {
        const user = this.state.currentUser;
        if (!user) return false;
        return (user.role === 'top_management' || user.role === 'hse');
    }

    canUserEdit() {
        const user = this.state.currentUser;
        const otp = this.otpData;
        
        if (!user || !otp) return false;
        
        if (user.role === 'department' && otp.status === 'Revision Requested') {
            if (otp.department === user.department) {
                return true;
            }
        }
        
        return false;
    }

    async editOTP(params, element) {
        const otp = this.otpData;
        if (!otp) {
            toast('Data OTP tidak ditemukan', 'error');
            return;
        }
        
        sessionStorage.setItem('editOTPData', JSON.stringify(otp));
        this.router.navigateTo('otp-create', { mode: 'edit', otpId: otp.otpId });
    }

    async approve(params, element) {
        const form = document.getElementById('otpReviewForm');
        const formData = new FormData(form);
        const notes = formData.get('reviewerNotes') || '';
        await this.performReview('Approved', notes, element);
    }

    async reject(params, element) {
        const form = document.getElementById('otpReviewForm');
        const formData = new FormData(form);
        const notes = formData.get('reviewerNotes') || '';
        
        if (!notes) {
            this.showRejectConfirmation(element);
            return;
        }
        
        await this.performReview('Rejected', notes, element);
    }

    async requestRevision(params, element) {
        const form = document.getElementById('otpReviewForm');
        const formData = new FormData(form);
        const notes = formData.get('reviewerNotes') || '';
        
        if (!notes) {
            toast('Mohon isi catatan revisi terlebih dahulu', 'warning');
            return;
        }
        
        await this.performReview('Revision Requested', notes, element);
    }

    showRejectConfirmation(triggerElement) {
        const content = `
            <div style="text-align: center;">
                <i class="bi bi-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
                <p class="mt-md">Apakah Anda yakin ingin <strong>menolak</strong> OTP ini?</p>
                <p style="color: var(--warning); font-size: var(--fs-sm);">Disarankan untuk mengisi catatan alasan penolakan.</p>
                <div class="d-flex justify-content-center gap-sm mt-lg">
                    <button class="btn btn-secondary" data-action="modal.close">
                        <i class="bi bi-x-circle"></i> Batal
                    </button>
                    <button class="btn btn-danger" id="confirmRejectWithoutNotesBtn">
                        <i class="bi bi-check-circle"></i> Ya, Tolak
                    </button>
                </div>
            </div>
        `;
        
        showModal('Konfirmasi Penolakan', content);
        
        document.getElementById('confirmRejectWithoutNotesBtn').addEventListener('click', async () => {
            closeModal();
            await this.performReview('Rejected', 'Ditolak tanpa catatan', triggerElement);
        });
    }

    async performReview(status, notes, triggerElement) {
        if (this.isSubmitting) return;
        
        const otp = this.otpData;
        const user = this.state.currentUser;
        const reviewedBy = user.username || user.name || '';
        
        // Disable semua tombol review
        const buttons = document.querySelectorAll('[data-action="otpReview.approve"], [data-action="otpReview.reject"], [data-action="otpReview.requestRevision"]');
        const originalTexts = [];
        buttons.forEach(btn => {
            originalTexts.push(btn.innerHTML);
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        });
        
        this.isSubmitting = true;
        
        try {
            const result = await this.api.updateOTPStatus(otp.otpId, status, notes, reviewedBy, new Date().toISOString());
            
            if (result.status === 'success') {
                toast(`OTP berhasil ${status === 'Approved' ? 'disetujui' : status === 'Rejected' ? 'ditolak' : 'direvisi'}!`, 'success');
                
                // Update local data
                this.otpData.status = status;
                this.otpData.reviewerNotes = notes;
                this.otpData.reviewedBy = reviewedBy;
                this.otpData.reviewedDate = new Date().toISOString();
                
                // Refresh halaman
                const mainContent = document.getElementById('mainContent');
                if (mainContent) {
                    mainContent.innerHTML = this.renderHTML();
                    document.dispatchEvent(new CustomEvent('pageChanged', {
                        detail: { page: 'otp-review', user: this.state.currentUser }
                    }));
                }
            } else {
                toast(result.message || 'Gagal melakukan review', 'error');
                // Reset tombol
                buttons.forEach((btn, idx) => {
                    btn.disabled = false;
                    btn.innerHTML = originalTexts[idx];
                });
                this.isSubmitting = false;
            }
        } catch (error) {
            console.error('Review error:', error);
            toast('Gagal melakukan review: ' + error.message, 'error');
            buttons.forEach((btn, idx) => {
                btn.disabled = false;
                btn.innerHTML = originalTexts[idx];
            });
            this.isSubmitting = false;
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    
    getStatusBannerColor() {
        const colors = {
            'Draft': '#fef3c7',
            'Submitted': '#e0f2fe',
            'Approved': '#dcfce7',
            'Rejected': '#fee2e2',
            'Revision Requested': '#fef3c7'
        };
        return colors[this.otpData?.status] || '#f8fafc';
    }

    getStatusColor() {
        const colors = {
            'Draft': 'var(--warning)',
            'Submitted': 'var(--info)',
            'Approved': 'var(--success)',
            'Rejected': 'var(--danger)',
            'Revision Requested': 'var(--warning)'
        };
        return colors[this.otpData?.status] || 'var(--text-muted)';
    }

    getStatusIcon() {
        const icons = {
            'Draft': 'bi-pencil',
            'Submitted': 'bi-send-check',
            'Approved': 'bi-check-circle-fill',
            'Rejected': 'bi-x-circle-fill',
            'Revision Requested': 'bi-arrow-repeat'
        };
        return icons[this.otpData?.status] || 'bi-info-circle';
    }

    getStatusBadge(status) {
        const badges = {
            'Draft': 'warning',
            'Submitted': 'info',
            'Approved': 'success',
            'Rejected': 'danger',
            'Revision Requested': 'warning'
        };
        const label = status || 'Draft';
        const type = badges[label] || 'default';
        return `<span class="badge-status ${type}">${label}</span>`;
    }

    getPolarityBadge(value) {
        const badges = { 
            'Higher is Better': 'success', 
            'Lower is Better': 'danger', 
            'On Target': 'info' 
        };
        const label = value || '-';
        return `<span class="badge-status ${badges[label] || 'default'}">${label}</span>`;
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

    formatDateTime(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    }

    formatNumber(num) {
        if (!num) return '0';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
                    <h1 class="page-title">Review OTP</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>Review OTP</span></p>
                </div></div>
                <div class="app-card"><div class="empty-state">
                    <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <h3 class="mt-md">Memuat Data OTP...</h3>
                </div></div>
            `;
        }
    }

    hideLoading() { this.isLoading = false; }

    renderError(message) {
        return `
            <div class="page-header"><div class="page-header-left">
                <h1 class="page-title">Review OTP</h1>
                <p class="breadcrumb">Home / OTP Management / <span>Review OTP</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'OTP tidak ditemukan atau terjadi kesalahan')}</p>
                <button class="btn btn-primary mt-md" data-page="otp-history">
                    <i class="bi bi-arrow-left"></i> Kembali ke Daftar OTP
                </button>
            </div></div>
        `;
    }
}