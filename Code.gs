// code.gs
// Google Apps Script untuk mengambil data dari Google Sheet
// Sheet ID: 1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI
// 
// SEMUA SHEET HARUS SUDAH DIBUAT MANUAL:
// Sheets: IADL, akses, MasterKPI, MasterTemplate, OTP, Temuan, ManagementReview, ManagementDecision

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const action = e?.parameter?.action || 'getAll';
  
  try {
    let result;
    switch(action) {
      // ============================================
      // IADL ACTIONS
      // ============================================
      case 'getAll':
        result = getAllIADLData();
        break;
      case 'getPaginated':
        const page = parseInt(e.parameter.page) || 1;
        const pageSize = parseInt(e.parameter.pageSize) || 10;
        let filters = {};
        if (e.parameter.filters) {
          filters = JSON.parse(e.parameter.filters);
        }
        result = getPaginatedIADLData(page, pageSize, filters);
        break;
      case 'getHeaders':
        result = getIADLHeaders();
        break;
      
      // ============================================
      // USER/AUTH ACTIONS (Sheet: akses)
      // ============================================
      case 'getUsers':
        result = getUsers();
        break;
      case 'getAllUsers':
        result = getAllUsers();
        break;
      case 'login':
        const username = e.parameter.username;
        const password = e.parameter.password;
        result = loginUser(username, password);
        break;
      
      // ============================================
      // MASTER KPI ACTIONS (Sheet: MasterKPI)
      // ============================================
      case 'getAllKPI':
        result = getAllKPIData();
        break;
      
      // ============================================
      // MASTER TEMPLATE ACTIONS (Sheet: MasterTemplate)
      // ============================================
      case 'getAllTemplates':
        result = getAllTemplateData();
        break;
      
      // ============================================
      // OTP ACTIONS (Sheet: OTP)
      // ============================================
      case 'saveOTP':
        const otpData = JSON.parse(e.parameter.data || '{}');
        result = saveOTPData(otpData);
        break;
      case 'getAllOTP':
        result = getAllOTPData();
        break;
      case 'getOTPByDept':
        const dept = e.parameter.department || '';
        result = getOTPByDepartment(dept);
        break;
      case 'updateOTPStatus':
        const otpId = e.parameter.otpId;
        const status = e.parameter.status;
        const reviewerNotes = e.parameter.reviewerNotes || '';
        const reviewedBy = e.parameter.reviewedBy || '';
        const reviewedDate = e.parameter.reviewedDate || '';
        result = updateOTPStatus(otpId, status, reviewerNotes, reviewedBy, reviewedDate);
        break;
      
      // ============================================
      // TEMUAN ACTIONS (Sheet: Temuan)
      // ============================================
      case 'saveTemuan':
        const temuanData = JSON.parse(e.parameter.data || '{}');
        result = saveTemuanData(temuanData);
        break;
      case 'getAllTemuan':
        result = getAllTemuanData();
        break;
      case 'getTemuanByDept':
        const temuanDept = e.parameter.department || '';
        result = getTemuanByDepartment(temuanDept);
        break;
      case 'updateTemuanTL':
        const tlData = JSON.parse(e.parameter.data || '{}');
        result = updateTemuanTL(tlData);
        break;
      
      // ============================================
      // MANAGEMENT REVIEW ACTIONS (Sheet: ManagementReview)
      // ============================================
      case 'getAllManagementReview':
        result = getAllManagementReviewData();
        break;
      case 'saveManagementReview':
        const mrData = JSON.parse(e.parameter.data || '{}');
        result = saveManagementReviewData(mrData);
        break;
      case 'updateMRStatus':
        const mrId = e.parameter.mrId;
        const mrStatus = e.parameter.status;
        const mrNotes = e.parameter.notes || '';
        result = updateMRStatus(mrId, mrStatus, mrNotes);
        break;
      
      // ============================================
      // MANAGEMENT DECISION ACTIONS (Sheet: ManagementDecision)
      // ============================================
      case 'getAllManagementDecision':
        result = getAllManagementDecisionData();
        break;
      case 'saveManagementDecision':
        const mdData = JSON.parse(e.parameter.data || '{}');
        result = saveManagementDecisionData(mdData);
        break;
      case 'updateMDStatus':
        const mdId = e.parameter.mdId;
        const mdStatus = e.parameter.status;
        result = updateMDStatus(mdId, mdStatus);
        break;
      
      default:
        result = { status: 'error', message: 'Unknown action: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// HELPER: Baca semua data dari sheet
// ============================================
function readSheetData(sheetName) {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    return { status: 'error', message: `Sheet "${sheetName}" tidak ditemukan. Silakan buat sheet secara manual.` };
  }
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < 2) {
    return { status: 'success', data: [], total: 0 };
  }
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const values = dataRange.getValues();
  
  const data = [];
  for (let i = 0; i < values.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header && header.toString().trim() !== '') {
        row[header] = values[i][j];
      }
    }
    row.rowIndex = i + 2;
    data.push(row);
  }
  
  return { status: 'success', data: data, total: data.length };
}

// ============================================
// HELPER: Append row ke sheet
// ============================================
function appendRowToSheet(sheetName, rowData) {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    return { status: 'error', message: `Sheet "${sheetName}" tidak ditemukan. Silakan buat sheet secara manual.` };
  }
  
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);
  
  return { status: 'success' };
}

// ============================================
// HELPER: Cari row berdasarkan ID dan update kolom
// ============================================
function findAndUpdateRow(sheetName, idFieldNames, idValue, updates) {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    return { status: 'error', message: `Sheet "${sheetName}" tidak ditemukan.` };
  }
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < 2) {
    return { status: 'error', message: 'Tidak ada data di sheet ini.' };
  }
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // Cari index kolom ID
  let idColIndex = -1;
  for (const name of idFieldNames) {
    idColIndex = headers.findIndex(h => h === name);
    if (idColIndex !== -1) break;
  }
  
  if (idColIndex === -1) {
    return { status: 'error', message: `Kolom ID tidak ditemukan. Pastikan salah satu kolom berikut ada: ${idFieldNames.join(', ')}` };
  }
  
  // Cari row target
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const values = dataRange.getValues();
  
  let targetRow = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][idColIndex]) === String(idValue)) {
      targetRow = i + 2;
      break;
    }
  }
  
  if (targetRow === -1) {
    return { status: 'error', message: `Data dengan ID "${idValue}" tidak ditemukan.` };
  }
  
  // Update kolom-kolom
  for (const [fieldNames, value] of Object.entries(updates)) {
    let colIndex = -1;
    for (const name of fieldNames) {
      colIndex = headers.findIndex(h => h === name);
      if (colIndex !== -1) break;
    }
    
    if (colIndex !== -1) {
      sheet.getRange(targetRow, colIndex + 1).setValue(value);
    }
    // Jika kolom tidak ditemukan, skip (tidak membuat kolom baru otomatis)
  }
  
  return { status: 'success', message: 'Data berhasil diupdate.' };
}

// ============================================
// IADL FUNCTIONS
// ============================================

function getAllIADLData() {
  return readSheetData('IADL');
}

function getPaginatedIADLData(page, pageSize, filters) {
  const allData = getAllIADLData();
  if (allData.status === 'error') return allData;
  
  let filteredData = allData.data;
  
  if (filters && Object.keys(filters).length > 0) {
    filteredData = allData.data.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;
        const itemValue = item[key] || '';
        if (!itemValue.toString().toLowerCase().includes(value.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }
  
  const total = filteredData.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);
  
  return {
    status: 'success',
    data: paginatedData,
    total: total,
    page: page,
    pageSize: pageSize,
    totalPages: totalPages
  };
}

function getIADLHeaders() {
  const result = readSheetData('IADL');
  // Ambil headers dari data pertama jika ada
  return { status: 'success', headers: [] };
}

// ============================================
// USER/AUTH FUNCTIONS (Sheet: akses)
// ============================================

function getUsers() {
  return readSheetData('akses');
}

function getAllUsers() {
  const result = getUsers();
  if (result.status === 'success' && result.data) {
    const safeData = result.data.map(user => ({
      ...user,
      Password: '••••••••'
    }));
    return { status: 'success', data: safeData, total: result.total };
  }
  return result;
}

function loginUser(username, password) {
  const result = getUsers();
  
  if (result.status !== 'success' || !result.data) {
    return { status: 'error', message: 'Gagal mengambil data user. Pastikan sheet "akses" sudah dibuat.' };
  }
  
  const user = result.data.find(u => 
    u.Username === username && u.Password === password
  );
  
  if (user) {
    const mappedUser = {
      id: user.rowIndex || Date.now(),
      username: user.Username,
      name: user.Username,
      email: user.Username + '@company.com',
      role: user.Role || 'department',
      department: user.Department || '',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    return {
      status: 'success',
      user: mappedUser,
      message: 'Login berhasil'
    };
  }
  
  return {
    status: 'error',
    message: 'Username atau password salah'
  };
}

// ============================================
// MASTER KPI FUNCTIONS (Sheet: MasterKPI)
// ============================================

function getAllKPIData() {
  return readSheetData('MasterKPI');
}

// ============================================
// MASTER TEMPLATE FUNCTIONS (Sheet: MasterTemplate)
// ============================================

function getAllTemplateData() {
  return readSheetData('MasterTemplate');
}

// ============================================
// OTP FUNCTIONS (Sheet: OTP)
// ============================================

function saveOTPData(data) {
  const year = data.year || new Date().getFullYear();
  const dept = (data.department || 'UNKNOWN').substring(0, 3).toUpperCase();
  
  // Hitung jumlah data existing untuk generate ID
  const existingData = readSheetData('OTP');
  const rowNum = ((existingData.data?.length || 0) + 1).toString().padStart(3, '0');
  const otpId = `OTP-${year}-${dept}-${rowNum}`;
  
  const rowData = [
    otpId,
    data.department || '',
    data.year || new Date().getFullYear(),
    data.templateCode || '',
    data.objective || '',
    data.kpiCode || '',
    data.kpiName || '',
    data.uom || '',
    data.polarity || '',
    data.formula || '',
    data.programCode || '',
    data.hazardDesc || '',
    data.programControl || '',
    data.activity || '',
    data.target || '',
    data.timeline || '',
    data.owner || '',
    data.budget || '',
    data.weight || '',
    data.status || 'Draft',
    data.createdAt || new Date().toISOString(),
    data.createdBy || '',
    '',
    '',
    ''
  ];
  
  const result = appendRowToSheet('OTP', rowData);
  
  if (result.status === 'error') return result;
  
  return { 
    status: 'success', 
    message: 'OTP berhasil disimpan',
    otpId: otpId
  };
}

function getAllOTPData() {
  return readSheetData('OTP');
}

function getOTPByDepartment(department) {
  const allData = getAllOTPData();
  
  if (allData.status !== 'success') return allData;
  if (!department) return allData;
  
  const filteredData = allData.data.filter(item => 
    item.Department === department || item.department === department
  );
  
  return { status: 'success', data: filteredData, total: filteredData.length };
}

function updateOTPStatus(otpId, status, reviewerNotes, reviewedBy, reviewedDate) {
  const updates = {};
  
  updates[['Status', 'status']] = status;
  if (reviewerNotes) updates[['Reviewer_Notes', 'reviewerNotes', 'reviewer_notes']] = reviewerNotes;
  if (reviewedBy) updates[['Reviewed_By', 'reviewedBy', 'reviewed_by']] = reviewedBy;
  if (reviewedDate) updates[['Reviewed_Date', 'reviewedDate', 'reviewed_date']] = reviewedDate;
  
  const result = findAndUpdateRow(
    'OTP',
    ['OTP_ID', 'otpId', 'otp_id'],
    otpId,
    updates
  );
  
  if (result.status === 'error') return result;
  
  return { 
    status: 'success', 
    message: 'Status OTP berhasil diupdate menjadi ' + status,
    otpId: otpId,
    newStatus: status
  };
}

// ============================================
// TEMUAN FUNCTIONS (Sheet: Temuan)
// ============================================

function saveTemuanData(data) {
  const year = new Date().getFullYear();
  const dept = (data.department || 'UNKNOWN').substring(0, 3).toUpperCase();
  
  const existingData = readSheetData('Temuan');
  const rowNum = ((existingData.data?.length || 0) + 1).toString().padStart(3, '0');
  const temuanId = `TMP-${year}-${dept}-${rowNum}`;
  
  const rowData = [
    temuanId,
    data.department || '',
    data.tanggalAudit || '',
    data.kategoriTemuan || '',
    data.klasifikasi || '',
    data.klausulISO || '',
    data.regulasi || '',
    data.uraianTemuan || '',
    data.buktiObjektif || '',
    data.lokasi || '',
    data.pihakTerkait || '',
    data.akarMasalah || '',
    data.dampak || '',
    data.rekomendasi || '',
    data.targetSelesai || '',
    data.penanggungJawab || '',
    data.prioritas || 'Sedang',
    data.status || 'Open',
    data.createdAt || new Date().toISOString(),
    data.createdBy || '',
    data.auditorDept || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    data.createdBy || '',
    data.createdAt || new Date().toISOString()
  ];
  
  const result = appendRowToSheet('Temuan', rowData);
  
  if (result.status === 'error') return result;
  
  return { 
    status: 'success', 
    message: 'Temuan berhasil disimpan',
    temuanId: temuanId
  };
}

function getAllTemuanData() {
  return readSheetData('Temuan');
}

function getTemuanByDepartment(department) {
  const allData = getAllTemuanData();
  
  if (allData.status !== 'success') return allData;
  if (!department) return allData;
  
  const filteredData = allData.data.filter(item => 
    item.Department === department || item.department === department
  );
  
  return { status: 'success', data: filteredData, total: filteredData.length };
}

function updateTemuanTL(data) {
  const updates = {};
  
  if (data.status) updates[['Status', 'status']] = data.status;
  if (data.tindakanPerbaikan) updates[['Tindakan_Perbaikan', 'tindakanPerbaikan']] = data.tindakanPerbaikan;
  if (data.tindakanPencegahan) updates[['Tindakan_Pencegahan', 'tindakanPencegahan']] = data.tindakanPencegahan;
  if (data.tglSelesai) updates[['Tgl_Selesai', 'tglSelesai']] = data.tglSelesai;
  if (data.hasilVerifikasi) updates[['Hasil_Verifikasi', 'hasilVerifikasi']] = data.hasilVerifikasi;
  if (data.verifikator) updates[['Verifikator', 'verifikator']] = data.verifikator;
  if (data.tglVerifikasi) updates[['Tgl_Verifikasi', 'tglVerifikasi']] = data.tglVerifikasi;
  if (data.catatanTL) updates[['Catatan_TL', 'catatanTL']] = data.catatanTL;
  if (data.updatedBy) updates[['Updated_By', 'updatedBy']] = data.updatedBy;
  if (data.updatedAt) updates[['Updated_At', 'updatedAt']] = data.updatedAt;
  
  const result = findAndUpdateRow(
    'Temuan',
    ['Temuan_ID', 'temuanId', 'temuan_id', 'ID_Temuan'],
    data.temuanId,
    updates
  );
  
  if (result.status === 'error') return result;
  
  return { 
    status: 'success', 
    message: 'Tindak lanjut temuan berhasil diupdate',
    temuanId: data.temuanId
  };
}

// ============================================
// MANAGEMENT REVIEW FUNCTIONS (Sheet: ManagementReview)
// ============================================

function getAllManagementReviewData() {
  return readSheetData('ManagementReview');
}

function saveManagementReviewData(data) {
  const rowData = [
    data.mrId || '',
    data.reviewTitle || '',
    data.reviewDate || '',
    data.period || '',
    data.department || '',
    data.reviewType || '',
    data.chairman || '',
    data.attendees || '',
    data.totalOTP || '',
    data.otpApproved || '',
    data.totalTemuan || '',
    data.temuanOpen || '',
    data.auditResults || '',
    data.otpPerformance || '',
    data.environmentalPerformance || '',
    data.complianceStatus || '',
    data.resourceAdequacy || '',
    data.effectivenessActions || '',
    data.improvementOpportunities || '',
    data.recommendations || '',
    data.conclusion || '',
    data.status || 'Draft',
    data.createdBy || '',
    data.createdAt || new Date().toISOString(),
    data.reviewedBy || '',
    data.reviewedAt || '',
    data.notes || ''
  ];
  
  const result = appendRowToSheet('ManagementReview', rowData);
  
  if (result.status === 'error') return result;
  
  return { 
    status: 'success', 
    message: 'Management Review berhasil disimpan',
    mrId: data.mrId
  };
}

function updateMRStatus(mrId, status, notes) {
  const updates = {};
  
  if (status) updates[['Status', 'status']] = status;
  if (notes) updates[['Notes', 'notes']] = notes;
  
  const result = findAndUpdateRow(
    'ManagementReview',
    ['MR_ID', 'mrId', 'mr_id'],
    mrId,
    updates
  );
  
  if (result.status === 'error') return result;
  
  return { 
    status: 'success', 
    message: 'Status Management Review berhasil diupdate menjadi ' + status,
    mrId: mrId,
    newStatus: status
  };
}

// ============================================
// MANAGEMENT DECISION FUNCTIONS (Sheet: ManagementDecision)
// ============================================

function getAllManagementDecisionData() {
  return readSheetData('ManagementDecision');
}

function saveManagementDecisionData(data) {
  const rowData = [
    data.mdId || '',
    data.mrId || '',
    data.decisionTitle || '',
    data.decisionDate || '',
    data.decisionType || '',
    data.priority || 'Medium',
    data.department || '',
    data.background || '',
    data.decisionDescription || '',
    data.actionItems || '',
    data.responsiblePerson || '',
    data.dueDate || '',
    data.resourcesAllocated || '',
    data.expectedOutcome || '',
    data.successCriteria || '',
    data.status || 'Active',
    data.implementationStatus || 'Not Started',
    data.createdBy || '',
    data.createdAt || new Date().toISOString(),
    data.approvedBy || '',
    data.approvedAt || '',
    data.notes || ''
  ];
  
  const result = appendRowToSheet('ManagementDecision', rowData);
  
  if (result.status === 'error') return result;
  
  return { 
    status: 'success', 
    message: 'Management Decision berhasil disimpan',
    mdId: data.mdId
  };
}

function updateMDStatus(mdId, status) {
  const updates = {};
  
  if (status) updates[['Status', 'status']] = status;
  
  const result = findAndUpdateRow(
    'ManagementDecision',
    ['MD_ID', 'mdId', 'md_id'],
    mdId,
    updates
  );
  
  if (result.status === 'error') return result;
  
  return { 
    status: 'success', 
    message: 'Status Management Decision berhasil diupdate menjadi ' + status,
    mdId: mdId,
    newStatus: status
  };
}