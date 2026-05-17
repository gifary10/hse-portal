// pages/otp-create.js
// OTP Create/Edit Page - Support multiple programs from IADL
// [UPDATED: Fixed multiple programs parsing, unified createdBy field, improved loading states]

import { toast } from '../ui/components.js';
import { getApi } from '../core/api.js';

export class OTPCreatePage {
    constructor(state, db, router) {
        this.state = state;
        this.db = db;
        this.router = router;
        this.api = getApi();
        this.isLoading = false;
        this.isSubmitting = false;
        this.isEditMode = false;
        this.editOtpId = null;
        this.editOtpData = null;
        
        // Data referensi
        this.kpiList = [];
        this.templateList = [];
        this.iadlList = [];
        
        // MULTIPLE PROGRAMS
        this.selectedPrograms = [];
        this.programCounter = 0;
    }

    // ============================================
    // FETCH REFERENCE DATA (menggunakan ApiService)
    // ============================================
    
    async loadReferenceData() {
        try {
            const [kpiResult, templateResult, iadlResult] = await Promise.all([
                this.api.getAllKPI(),
                this.api.getAllTemplates(),
                this.api.getAllIADL()
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
    // LOAD EDIT DATA (dengan ApiService)
    // ============================================
    
    async loadEditData(otpId) {
        // Cek sessionStorage dulu
        const cachedEditData = sessionStorage.getItem('editOTPData');
        if (cachedEditData) {
            try {
                const parsed = JSON.parse(cachedEditData);
                if (parsed.otpId === otpId) {
                    this.editOtpData = this.formatOTPDataForEdit(parsed);
                    this.parseProgramsFromEditData(this.editOtpData);
                    sessionStorage.removeItem('editOTPData');
                    return;
                }
            } catch (e) {}
        }
        
        // Fetch dari API
        try {
            const result = await this.api.getAllOTP();
            if (result.status === 'success' && result.data) {
                const found = result.data.find(o => 
                    (o.OTP_ID === otpId || o.otpId === otpId)
                );
                if (found) {
                    this.editOtpData = this.formatOTPDataForEdit(found);
                    this.parseProgramsFromEditData(this.editOtpData);
                } else {
                    throw new Error('OTP tidak ditemukan');
                }
            }
        } catch (error) {
            console.error('Failed to load edit data:', error);
            throw error;
        }
    }

    // Format OTP data untuk edit (normalisasi field)
    formatOTPDataForEdit(item) {
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
            programControl: ['Program_Control', 'programControl', 'Program_Controls', 'Deskripsi_Pengendalian'],
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
        return result;
    }

    // Parse multiple programs dari data edit (dengan separator |)
    parseProgramsFromEditData(data) {
        this.selectedPrograms = [];
        
        // Ambil array dari masing-masing field yang dipisah |
        const programCodes = (data.programCode || '').split('|').filter(p => p && p.trim());
        const hazardDescs = (data.hazardDesc || '').split('|').filter(p => p && p.trim());
        const dampaks = (data.dampak || '').split('|').filter(p => p && p.trim());
        const programControls = (data.programControl || '').split('|').filter(p => p && p.trim());
        const activities = (data.activity || '').split('|').filter(p => p && p.trim());
        
        // Panjang maksimal dari semua array
        const maxLength = Math.max(
            programCodes.length,
            hazardDescs.length,
            dampaks.length,
            programControls.length,
            activities.length,
            1
        );
        
        // Jika tidak ada program sama sekali, tambahkan satu kosong
        if (maxLength === 1 && programCodes.length === 0 && hazardDescs.length === 0) {
            this.addEmptyProgram();
            return;
        }
        
        for (let i = 0; i < maxLength; i++) {
            this.selectedPrograms.push({
                programCode: programCodes[i] || '',
                hazardDesc: hazardDescs[i] || '',
                dampak: dampaks[i] || '',
                programControl: programControls[i] || '',
                activity: activities[i] || '',
                id: Date.now() + this.programCounter++
            });
        }
    }

    // ============================================
    // MULTIPLE PROGRAM HELPERS
    // ============================================
    
    addEmptyProgram() {
        this.selectedPrograms.push({
            programCode: '',
            hazardDesc: '',
            dampak: '',
            programControl: '',
            activity: '',
            id: Date.now() + this.programCounter++
        });
    }

    removeProgram(index) {
        if (this.selectedPrograms.length > 1) {
            this.selectedPrograms.splice(index, 1);
            this.updateProgramsUI();
        } else {
            toast('Minimal satu program harus dipilih', 'warning');
        }
    }

    updateProgramsUI() {
        const container = document.getElementById('otpProgramsContainer');
        if (!container) return;
        
        container.innerHTML = this.renderProgramsList();
        this.attachProgramEvents();
    }

    renderProgramsList() {
        if (this.selectedPrograms.length === 0) {
            this.addEmptyProgram();
        }
        
        return this.selectedPrograms.map((program, idx) => `
            <div class="program-item mb-md" style="padding: var(--space-md); background: #f8fafc; border-radius: var(--radius-md); border-left: 3px solid var(--primary); position: relative;" data-program-index="${idx}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                    <h4 style="font-size: var(--fs-sm); color: var(--primary); margin: 0;">
                        <i class="bi bi-file-earmark-text"></i> Program ${idx + 1}
                    </h4>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-program-btn" data-index="${idx}" style="padding: 2px 8px;">
                        <i class="bi bi-trash"></i> Hapus
                    </button>
                </div>
                <div class="row">
                    <div class="col-md-12">
                        <div class="form-group-custom">
                            <label>Deskripsi Hazard <span style="color: var(--danger);">*</span></label>
                            <select name="programCode_${idx}" class="form-select program-select" data-index="${idx}" required>
                                <option value="">Pilih Deskripsi Hazard</option>
                                ${this.getFilteredIADLOptions(program.programCode)}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group-custom">
                            <label>Dampak (auto)</label>
                            <input type="text" class="form-control program-dampak" value="${this.escapeHtml(program.dampak)}" readonly style="background: #f0fdf4;">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group-custom">
                            <label>Deskripsi Pengendalian (auto)</label>
                            <input type="text" class="form-control program-control" value="${this.escapeHtml(program.programControl)}" readonly style="background: #f0fdf4;">
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-12">
                        <div class="form-group-custom">
                            <label>Aktivitas Terkait (auto)</label>
                            <input type="text" class="form-control program-activity" value="${this.escapeHtml(program.activity)}" readonly style="background: #f0fdf4;">
                        </div>
                    </div>
                </div>
                <input type="hidden" name="program_id_${idx}" value="${program.id}">
            </div>
        `).join('');
    }

    getFilteredIADLOptions(selectedValue) {
        const user = this.state.currentUser || {};
        const userDept = user.department || '';
        
        let filtered = this.iadlList;
        if (userDept) {
            filtered = filtered.filter(i => 
                (i.Departemen || i.departemen) === userDept
            );
        }
        
        let options = '';
        for (const i of filtered) {
            const hazardDesc = i['Deskripsi Hazard'] || i.deskripsiAspek || i.deskripsi_hazard || '';
            const programCode = i['No Hazard'] || i.noHazard || i.no_hazard || i.id || '';
            const dampak = i['Dampak'] || i.dampak || '';
            const deskripsiPengendalian = i['Deskripsi Pengendalian'] || i.deskripsiPengendalian || i.deskripsi_pengendalian || '';
            const activity = i['Aktifitas'] || i.aktivitas || i.Aktivitas || '';
            
            const isSelected = selectedValue === programCode;
            const selectedAttr = isSelected ? 'selected' : '';
            
            options += `
                <option value="${this.escapeHtml(programCode)}"
                        data-hazard="${this.escapeHtml(hazardDesc)}"
                        data-dampak="${this.escapeHtml(dampak)}"
                        data-control="${this.escapeHtml(deskripsiPengendalian)}"
                        data-activity="${this.escapeHtml(activity)}"
                        ${selectedAttr}>
                    ${this.escapeHtml(hazardDesc.substring(0, 80))}${hazardDesc.length > 80 ? '...' : ''}
                </option>
            `;
        }
        return options;
    }

    attachProgramEvents() {
        const programSelects = document.querySelectorAll('.program-select');
        programSelects.forEach(select => {
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);
            
            newSelect.addEventListener('change', (e) => {
                const idx = parseInt(newSelect.dataset.index);
                const selectedOption = newSelect.options[newSelect.selectedIndex];
                const programItem = this.selectedPrograms[idx];
                
                if (selectedOption && selectedOption.value) {
                    programItem.programCode = selectedOption.value;
                    programItem.hazardDesc = selectedOption.dataset.hazard || '';
                    programItem.dampak = selectedOption.dataset.dampak || '';
                    programItem.programControl = selectedOption.dataset.control || '';
                    programItem.activity = selectedOption.dataset.activity || '';
                    
                    const programDiv = newSelect.closest('.program-item');
                    if (programDiv) {
                        const dampakInput = programDiv.querySelector('.program-dampak');
                        const controlInput = programDiv.querySelector('.program-control');
                        const activityInput = programDiv.querySelector('.program-activity');
                        
                        if (dampakInput) dampakInput.value = programItem.dampak;
                        if (controlInput) controlInput.value = programItem.programControl;
                        if (activityInput) activityInput.value = programItem.activity;
                    }
                }
            });
        });
        
        const removeBtns = document.querySelectorAll('.remove-program-btn');
        removeBtns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                const idx = parseInt(newBtn.dataset.index);
                this.removeProgram(idx);
            });
        });
    }

    // ============================================
    // COLLECT PROGRAMS DATA FOR SUBMIT
    // ============================================
    
    collectProgramsData() {
        const programCodes = [];
        const hazardDescs = [];
        const dampaks = [];
        const programControls = [];
        const activities = [];
        
        for (const program of this.selectedPrograms) {
            if (program.programCode) {
                programCodes.push(program.programCode);
                hazardDescs.push(program.hazardDesc || '');
                dampaks.push(program.dampak || '');
                programControls.push(program.programControl || '');
                activities.push(program.activity || '');
            }
        }
        
        // Jika tidak ada program valid, kosongkan
        if (programCodes.length === 0) {
            return {
                programCode: '',
                hazardDesc: '',
                dampak: '',
                programControl: '',
                activity: '',
                programCount: 0
            };
        }
        
        return {
            programCode: programCodes.join('|'),
            hazardDesc: hazardDescs.join('|'),
            dampak: dampaks.join('|'),
            programControl: programControls.join('|'),
            activity: activities.join('|'),
            programCount: programCodes.length
        };
    }

    // ============================================
    // RENDER
    // ============================================
    
    async render(page, params = {}) {
        this.isEditMode = params.mode === 'edit' || 
                          new URLSearchParams(window.location.search).get('mode') === 'edit';
        this.editOtpId = params.otpId || new URLSearchParams(window.location.search).get('otpId');
        
        this.showLoading();
        
        try {
            await this.loadReferenceData();
            
            if (this.isEditMode && this.editOtpId) {
                await this.loadEditData(this.editOtpId);
            } else {
                this.selectedPrograms = [];
                this.addEmptyProgram();
            }
            
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
        // Gunakan username sebagai standar createdBy
        const username = user.username || user.name || '';
        const isEdit = this.isEditMode && this.editOtpData;
        
        const filteredKPIs = this.kpiList.filter(k => 
            !userDept || (k.Department || k.department) === userDept
        );
        const filteredTemplates = this.templateList.filter(t => 
            !userDept || (t.Department || t.department) === userDept
        );
        
        const editData = isEdit ? this.editOtpData : null;
        
        const getEditValue = (field, defaultValue = '') => {
            if (isEdit && editData && editData[field]) {
                return this.escapeHtml(editData[field]);
            }
            return defaultValue;
        };
        
        const getEditSelectValue = (field, defaultValue = '') => {
            if (isEdit && editData && editData[field]) {
                return editData[field];
            }
            return defaultValue;
        };
        
        return `
            <div class="page-header">
                <div class="page-header-left">
                    <h1 class="page-title">${isEdit ? 'Edit OTP' : 'Create OTP'}</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>${isEdit ? 'Edit OTP' : 'Create OTP'}</span></p>
                </div>
            </div>

            ${isEdit && editData && editData.reviewerNotes ? `
                <div class="app-card mb-md" style="background: #fef9e7; border-left: 4px solid var(--warning);">
                    <div style="display: flex; align-items: start; gap: 12px;">
                        <i class="bi bi-chat-square-text" style="color: var(--warning); font-size: 1.2rem;"></i>
                        <div>
                            <strong style="color: var(--text);">Catatan Revisi dari Reviewer:</strong>
                            <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm); font-style: italic;">
                                "${this.escapeHtml(editData.reviewerNotes)}"
                            </p>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="app-card app-card-info mb-md" style="background: ${isEdit ? '#fef9e7' : '#f0fdf4'}; border-left: 4px solid ${isEdit ? 'var(--warning)' : 'var(--success)'};">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-info-circle-fill" style="color: ${isEdit ? 'var(--warning)' : 'var(--success)'}; font-size: 1.2rem; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text);">${isEdit ? 'Form Edit OTP' : 'Form Input OTP'}</strong>
                        <p style="margin: 4px 0 0; color: var(--text-light); font-size: var(--fs-sm);">
                            ${isEdit ? 
                                'Edit OTP sesuai catatan revisi. Anda dapat menambah/menghapus program.' : 
                                'Lengkapi form di bawah untuk membuat OTP baru. Anda dapat memilih lebih dari satu program dari IADL.'
                            }
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
                                    <option value="2025" ${getEditSelectValue('year') === '2025' ? 'selected' : ''}>2025</option>
                                    <option value="2026" ${getEditSelectValue('year') === '2026' || (!isEdit && 'selected') ? 'selected' : ''}>2026</option>
                                    <option value="2027" ${getEditSelectValue('year') === '2027' ? 'selected' : ''}>2027</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Created By</label>
                                <input type="text" class="form-control" value="${this.escapeHtml(username)}" 
                                       readonly style="background: #f8fafc;">
                                <input type="hidden" name="createdBy" value="${this.escapeHtml(username)}">
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
                                    ${filteredTemplates.map(t => {
                                        const tCode = t.Template_Code || t.templateCode || '';
                                        const isSelected = isEdit && editData.templateCode === tCode;
                                        return `
                                            <option value="${this.escapeHtml(tCode)}"
                                                    data-objective="${this.escapeHtml(t.Objective || t.objective || '')}"
                                                    data-kpi="${this.escapeHtml(t.Related_KPI || t.relatedKPI || t.KPI_Code || '')}"
                                                    ${isSelected ? 'selected' : ''}>
                                                ${this.escapeHtml(tCode)} - ${this.escapeHtml((t.Template_Name || t.templateName || '').substring(0, 50))}
                                            </option>
                                        `;
                                    }).join('')}
                                </select>
                                <small class="text-muted">Pilih template untuk mengisi objective secara otomatis</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Objective</label>
                                <textarea name="objective" id="otpObjective" class="form-control" rows="3" 
                                          placeholder="Objective akan terisi otomatis..." ${isEdit ? '' : 'readonly'}>${getEditValue('objective')}</textarea>
                                ${isEdit ? '<small class="text-muted">Mode edit: Anda dapat mengubah objective jika diperlukan</small>' : ''}
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
                                    ${filteredKPIs.map(k => {
                                        const kCode = k.KPI_Code || k.kpiCode || '';
                                        const isSelected = isEdit && editData.kpiCode === kCode;
                                        return `
                                            <option value="${this.escapeHtml(kCode)}"
                                                    data-name="${this.escapeHtml(k.KPI_Name || k.kpiName || '')}"
                                                    data-uom="${this.escapeHtml(k.UOM || k.uom || '')}"
                                                    data-polarity="${this.escapeHtml(k.Polarity || k.polarity || '')}"
                                                    data-formula="${this.escapeHtml(k.Formula || k.formula || '')}"
                                                    ${isSelected ? 'selected' : ''}>
                                                ${this.escapeHtml(kCode)} - ${this.escapeHtml((k.KPI_Name || k.kpiName || '').substring(0, 50))}
                                            </option>
                                        `;
                                    }).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="row">
                                <div class="col-6">
                                    <div class="form-group-custom">
                                        <label>KPI Name</label>
                                        <input type="text" id="otpKPIName" class="form-control" readonly 
                                               style="background: #f8fafc; font-size: var(--fs-sm);"
                                               value="${getEditValue('kpiName')}">
                                    </div>
                                </div>
                                <div class="col-3">
                                    <div class="form-group-custom">
                                        <label>UOM</label>
                                        <input type="text" id="otpKPIUOM" class="form-control" readonly 
                                               style="background: #f8fafc;"
                                               value="${getEditValue('uom')}">
                                    </div>
                                </div>
                                <div class="col-3">
                                    <div class="form-group-custom">
                                        <label>Polarity</label>
                                        <input type="text" id="otpKPIPolarity" class="form-control" readonly 
                                               style="background: #f8fafc;"
                                               value="${getEditValue('polarity')}">
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
                                       style="background: #f8fafc; font-family: var(--font-mono); font-size: var(--fs-sm);"
                                       value="${getEditValue('formula')}">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- MULTIPLE PROGRAMS SECTION -->
                <div class="app-card mb-md">
                    <div class="card-header">
                        <h3 class="card-title"><i class="bi bi-files"></i> Program (Referensi IADL)</h3>
                        <span class="badge-status warning">Dari IADL - Bisa pilih lebih dari satu</span>
                    </div>
                    
                    <div id="otpProgramsContainer">
                        ${this.renderProgramsList()}
                    </div>
                    
                    <div class="mt-md" style="text-align: center;">
                        <button type="button" class="btn btn-outline-primary" id="addProgramBtn">
                            <i class="bi bi-plus-lg"></i> Tambah Program
                        </button>
                        <small class="text-muted d-block mt-sm">Anda dapat memilih lebih dari satu hazard untuk program ini</small>
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
                                       placeholder="Contoh: 0, 100%, 5 cases" required
                                       value="${getEditValue('target')}">
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Timeline <span style="color: var(--danger);">*</span></label>
                                <select name="timeline" class="form-select" required>
                                    <option value="">Pilih Periode</option>
                                    <option value="Q1" ${getEditSelectValue('timeline') === 'Q1' ? 'selected' : ''}>Q1 (Jan-Mar)</option>
                                    <option value="Q2" ${getEditSelectValue('timeline') === 'Q2' ? 'selected' : ''}>Q2 (Apr-Jun)</option>
                                    <option value="Q3" ${getEditSelectValue('timeline') === 'Q3' ? 'selected' : ''}>Q3 (Jul-Sep)</option>
                                    <option value="Q4" ${getEditSelectValue('timeline') === 'Q4' ? 'selected' : ''}>Q4 (Oct-Dec)</option>
                                    <option value="Full Year" ${getEditSelectValue('timeline') === 'Full Year' ? 'selected' : ''}>Full Year</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group-custom">
                                <label>Weight (%) <span style="color: var(--danger);">*</span></label>
                                <input type="number" name="weight" class="form-control" 
                                       placeholder="0-100" min="0" max="100" required
                                       value="${getEditValue('weight')}">
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Owner / PIC <span style="color: var(--danger);">*</span></label>
                                <input type="text" name="owner" class="form-control" 
                                       placeholder="Nama penanggung jawab" required
                                       value="${getEditValue('owner')}">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group-custom">
                                <label>Budget</label>
                                <input type="text" name="budget" class="form-control" 
                                       placeholder="Contoh: 5000000"
                                       value="${getEditValue('budget')}">
                                <small class="text-muted">Opsional, isi dalam Rupiah</small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Hidden fields for edit mode -->
                ${isEdit ? `<input type="hidden" name="editMode" value="true">
                           <input type="hidden" name="originalOtpId" value="${this.escapeHtml(editData?.otpId || '')}">
                           <input type="hidden" name="rowIndex" value="${editData?._rowIndex || ''}">` : ''}

                <!-- ACTION BUTTONS -->
                <div class="d-flex gap-sm" style="justify-content: flex-end;">
                    <button type="button" class="btn btn-secondary" data-page="otp-history">
                        <i class="bi bi-x-circle"></i> Batal
                    </button>
                    <button type="submit" class="btn btn-primary" id="otpSubmitBtn">
                        <i class="bi bi-send"></i> ${isEdit ? 'Submit Revisi' : 'Submit for Approval'}
                    </button>
                </div>
            </form>
        `;
    }

    // ============================================
    // EVENT HANDLERS (SETUP AFTER RENDER)
    // ============================================
    
    setupEventListeners() {
        const templateSelect = document.getElementById('otpTemplateSelect');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const objective = selectedOption.dataset.objective || '';
                const kpiCode = selectedOption.dataset.kpi || '';
                
                const objectiveField = document.getElementById('otpObjective');
                if (objectiveField && !this.isEditMode) {
                    objectiveField.value = objective;
                } else if (objectiveField && this.isEditMode && !objectiveField.value) {
                    objectiveField.value = objective;
                }
                
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
        
        const addBtn = document.getElementById('addProgramBtn');
        if (addBtn) {
            const newBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newBtn, addBtn);
            newBtn.addEventListener('click', () => {
                this.addEmptyProgram();
                this.updateProgramsUI();
            });
        }
        
        this.attachProgramEvents();
    }

    // ============================================
    // SUBMIT ACTIONS (dengan ApiService dan loading state)
    // ============================================
    
    async submit(params, element) {
        if (this.isSubmitting) return;
        
        const form = document.getElementById('otpCreateForm');
        if (!form) {
            toast('Form tidak ditemukan', 'error');
            return;
        }
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            if (!key.startsWith('program_')) {
                data[key] = value;
            }
        });
        
        const programsData = this.collectProgramsData();
        
        if (programsData.programCount === 0) {
            toast('Minimal satu program harus dipilih', 'warning');
            return;
        }
        
        if (!data.templateCode) {
            toast('Silakan pilih Objective Template', 'warning');
            return;
        }
        if (!data.kpiCode) {
            toast('Silakan pilih KPI', 'warning');
            return;
        }
        if (!data.target) {
            toast('Target harus diisi', 'warning');
            return;
        }
        if (!data.timeline) {
            toast('Timeline harus dipilih', 'warning');
            return;
        }
        if (!data.owner) {
            toast('Owner / PIC harus diisi', 'warning');
            return;
        }
        
        const weight = parseFloat(data.weight);
        if (isNaN(weight) || weight < 0 || weight > 100) {
            toast('Weight harus antara 0-100', 'error');
            return;
        }
        
        this.isSubmitting = true;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
        }
        
        try {
            const user = this.state.currentUser || {};
            const username = user.username || user.name || '';
            
            const kpiName = document.getElementById('otpKPIName')?.value || '';
            const kpiUOM = document.getElementById('otpKPIUOM')?.value || '';
            const kpiPolarity = document.getElementById('otpKPIPolarity')?.value || '';
            const kpiFormula = document.getElementById('otpKPIFormula')?.value || '';
            const objective = document.getElementById('otpObjective')?.value || '';
            
            const payload = {
                ...data,
                ...programsData,
                kpiName: kpiName || data.kpiName || '',
                uom: kpiUOM || data.uom || '',
                polarity: kpiPolarity || data.polarity || '',
                formula: kpiFormula || data.formula || '',
                objective: objective || data.objective || '',
                department: user.department || '',
                createdBy: username,
                status: 'Submitted',
                createdAt: new Date().toISOString()
            };
            
            let result;
            
            if (this.isEditMode && data.originalOtpId) {
                payload.originalOtpId = data.originalOtpId;
                payload.rowIndex = data.rowIndex;
                result = await this.api.updateOTP(payload);
            } else {
                result = await this.api.saveOTP(payload);
            }
            
            if (result.status === 'success') {
                toast(this.isEditMode ? 'Revisi OTP berhasil disubmit!' : 'OTP berhasil disubmit!', 'success');
                
                setTimeout(() => {
                    this.router.navigateTo('otp-history');
                }, 1500);
            } else {
                toast(result.message || 'Gagal menyimpan OTP', 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHTML;
                }
                this.isSubmitting = false;
            }
        } catch (error) {
            console.error('Submit error:', error);
            toast('Gagal menyimpan OTP: ' + error.message, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
            }
            this.isSubmitting = false;
        }
    }

    // ============================================
    // AFTER RENDER HOOK
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
                    <h1 class="page-title">${this.isEditMode ? 'Edit OTP' : 'Create OTP'}</h1>
                    <p class="breadcrumb">Home / OTP Management / <span>${this.isEditMode ? 'Edit OTP' : 'Create OTP'}</span></p>
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
                <h1 class="page-title">${this.isEditMode ? 'Edit OTP' : 'Create OTP'}</h1>
                <p class="breadcrumb">Home / OTP Management / <span>${this.isEditMode ? 'Edit OTP' : 'Create OTP'}</span></p>
            </div></div>
            <div class="app-card"><div class="empty-state">
                <i class="bi bi-exclamation-triangle" style="color:var(--danger);font-size:3rem;"></i>
                <h2>Gagal Memuat Data</h2>
                <p>${this.escapeHtml(message || 'Terjadi kesalahan saat memuat data referensi')}</p>
                <button class="btn btn-primary mt-md" data-page="otp-create">
                    <i class="bi bi-arrow-repeat"></i> Coba Lagi
                </button>
            </div></div>
        `;
    }

    async retry() {
        this.router.navigateTo('otp-create');
    }
}