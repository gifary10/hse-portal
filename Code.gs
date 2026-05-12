// code.gs
// Google Apps Script untuk mengambil data dari Google Sheet
// Sheet ID: 1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI
// Sheets: IADL, akses, MasterKPI, MasterTemplate, OTP, Temuan

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
      // IADL Actions
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
      
      // User/Auth Actions
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
      
      // Master KPI Actions
      case 'getAllKPI':
        result = getAllKPIData();
        break;
      
      // Master Template Actions
      case 'getAllTemplates':
        result = getAllTemplateData();
        break;
      
      // OTP Actions
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
      
      // Temuan Actions
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
// IADL FUNCTIONS
// ============================================

function getAllIADLData() {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('IADL');
  
  if (!sheet) {
    return { status: 'error', message: 'Sheet IADL tidak ditemukan' };
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
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('IADL');
  
  if (!sheet) {
    return { status: 'error', message: 'Sheet IADL tidak ditemukan' };
  }
  
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const validHeaders = headers.filter(h => h && h.toString().trim() !== '');
  
  return { status: 'success', headers: validHeaders };
}

// ============================================
// USER/AUTH FUNCTIONS (Sheet: akses)
// ============================================

function getUsers() {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('akses');
  
  if (!sheet) {
    return { status: 'error', message: 'Sheet akses tidak ditemukan' };
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
    return { status: 'error', message: 'Gagal mengambil data user' };
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
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('MasterKPI');
  
  if (!sheet) {
    return { status: 'error', message: 'Sheet MasterKPI tidak ditemukan' };
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
// MASTER TEMPLATE FUNCTIONS (Sheet: MasterTemplate)
// ============================================

function getAllTemplateData() {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('MasterTemplate');
  
  if (!sheet) {
    return { status: 'error', message: 'Sheet MasterTemplate tidak ditemukan' };
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
// OTP FUNCTIONS (Sheet: OTP)
// ============================================

function saveOTPData(data) {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  let sheet = spreadsheet.getSheetByName('OTP');
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet('OTP');
    
    const headers = [
      'OTP_ID', 'Department', 'Year', 'Template_Code', 'Objective',
      'KPI_Code', 'KPI_Name', 'UOM', 'Polarity', 'Formula',
      'Program_Code', 'Hazard_Description', 'Program_Control', 'Activity',
      'Target', 'Timeline', 'Owner', 'Budget', 'Weight',
      'Status', 'Created_Date', 'Created_By',
      'Reviewer_Notes', 'Reviewed_By', 'Reviewed_Date'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#7FB77E');
    sheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
  }
  
  const lastRow = sheet.getLastRow();
  
  const year = data.year || new Date().getFullYear();
  const dept = (data.department || 'UNKNOWN').substring(0, 3).toUpperCase();
  const rowNum = (lastRow).toString().padStart(3, '0');
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
  
  sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);
  
  return { 
    status: 'success', 
    message: 'OTP berhasil disimpan',
    otpId: otpId
  };
}

function getAllOTPData() {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('OTP');
  
  if (!sheet) {
    return { status: 'success', data: [], total: 0 };
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
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('OTP');
  
  if (!sheet) {
    return { status: 'error', message: 'Sheet OTP tidak ditemukan' };
  }
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < 2) {
    return { status: 'error', message: 'Tidak ada data OTP' };
  }
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const otpIdColIndex = headers.findIndex(h => 
    h === 'OTP_ID' || h === 'otpId' || h === 'otp_id'
  );
  
  if (otpIdColIndex === -1) {
    return { status: 'error', message: 'Kolom OTP_ID tidak ditemukan' };
  }
  
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const values = dataRange.getValues();
  
  let targetRow = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][otpIdColIndex]) === String(otpId)) {
      targetRow = i + 2;
      break;
    }
  }
  
  if (targetRow === -1) {
    return { status: 'error', message: 'OTP dengan ID ' + otpId + ' tidak ditemukan' };
  }
  
  const statusColIndex = headers.findIndex(h => 
    h === 'Status' || h === 'status'
  );
  
  let reviewerNotesColIndex = headers.findIndex(h => 
    h === 'Reviewer_Notes' || h === 'reviewerNotes' || h === 'reviewer_notes'
  );
  
  let reviewedByColIndex = headers.findIndex(h => 
    h === 'Reviewed_By' || h === 'reviewedBy' || h === 'reviewed_by'
  );
  
  let reviewedDateColIndex = headers.findIndex(h => 
    h === 'Reviewed_Date' || h === 'reviewedDate' || h === 'reviewed_date'
  );
  
  if (statusColIndex !== -1) {
    sheet.getRange(targetRow, statusColIndex + 1).setValue(status);
  }
  
  if (reviewerNotesColIndex !== -1) {
    sheet.getRange(targetRow, reviewerNotesColIndex + 1).setValue(reviewerNotes);
  } else {
    const newCol = lastCol + 1;
    sheet.getRange(1, newCol).setValue('Reviewer_Notes');
    sheet.getRange(1, newCol).setFontWeight('bold');
    sheet.getRange(1, newCol).setBackground('#7FB77E');
    sheet.getRange(1, newCol).setFontColor('#FFFFFF');
    sheet.getRange(targetRow, newCol).setValue(reviewerNotes);
  }
  
  if (reviewedByColIndex !== -1) {
    sheet.getRange(targetRow, reviewedByColIndex + 1).setValue(reviewedBy);
  } else {
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue('Reviewed_By');
    sheet.getRange(1, newCol).setFontWeight('bold');
    sheet.getRange(1, newCol).setBackground('#7FB77E');
    sheet.getRange(1, newCol).setFontColor('#FFFFFF');
    sheet.getRange(targetRow, newCol).setValue(reviewedBy);
  }
  
  if (reviewedDateColIndex !== -1) {
    sheet.getRange(targetRow, reviewedDateColIndex + 1).setValue(reviewedDate);
  } else {
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue('Reviewed_Date');
    sheet.getRange(1, newCol).setFontWeight('bold');
    sheet.getRange(1, newCol).setBackground('#7FB77E');
    sheet.getRange(1, newCol).setFontColor('#FFFFFF');
    sheet.getRange(targetRow, newCol).setValue(reviewedDate);
  }
  
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
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  let sheet = spreadsheet.getSheetByName('Temuan');
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Temuan');
    
    const headers = [
      'Temuan_ID', 'Department', 'Tanggal_Audit', 'Kategori_Temuan', 'Klasifikasi',
      'Klausul_ISO', 'Regulasi', 'Uraian_Temuan', 'Bukti_Objektif', 'Lokasi',
      'Pihak_Terkait', 'Akar_Masalah', 'Dampak', 'Rekomendasi', 'Target_Selesai',
      'Penanggung_Jawab', 'Prioritas', 'Status', 'Created_At', 'Created_By',
      'Auditor_Dept', 'Tindakan_Perbaikan', 'Tindakan_Pencegahan', 'Tgl_Selesai',
      'Hasil_Verifikasi', 'Verifikator', 'Tgl_Verifikasi', 'Catatan_TL',
      'Updated_By', 'Updated_At'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#E07A5F');
    sheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
  }
  
  const lastRow = sheet.getLastRow();
  
  const year = new Date().getFullYear();
  const dept = (data.department || 'UNKNOWN').substring(0, 3).toUpperCase();
  const rowNum = (lastRow).toString().padStart(3, '0');
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
  
  sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);
  
  return { 
    status: 'success', 
    message: 'Temuan berhasil disimpan',
    temuanId: temuanId
  };
}

function getAllTemuanData() {
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('Temuan');
  
  if (!sheet) {
    return { status: 'success', data: [], total: 0 };
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
  const spreadsheet = SpreadsheetApp.openById('1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI');
  const sheet = spreadsheet.getSheetByName('Temuan');
  
  if (!sheet) {
    return { status: 'error', message: 'Sheet Temuan tidak ditemukan' };
  }
  
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < 2) {
    return { status: 'error', message: 'Tidak ada data temuan' };
  }
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const temuanIdColIndex = headers.findIndex(h => 
    h === 'Temuan_ID' || h === 'temuanId' || h === 'temuan_id' || h === 'ID_Temuan'
  );
  
  if (temuanIdColIndex === -1) {
    return { status: 'error', message: 'Kolom Temuan_ID tidak ditemukan' };
  }
  
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const values = dataRange.getValues();
  
  let targetRow = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][temuanIdColIndex]) === String(data.temuanId)) {
      targetRow = i + 2;
      break;
    }
  }
  
  if (targetRow === -1) {
    return { status: 'error', message: 'Temuan dengan ID ' + data.temuanId + ' tidak ditemukan' };
  }
  
  const updateField = (fieldNames, value) => {
    let colIndex = -1;
    for (const name of fieldNames) {
      colIndex = headers.findIndex(h => h === name);
      if (colIndex !== -1) break;
    }
    if (colIndex !== -1) {
      sheet.getRange(targetRow, colIndex + 1).setValue(value);
    } else {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(fieldNames[0]);
      sheet.getRange(1, newCol).setFontWeight('bold');
      sheet.getRange(1, newCol).setBackground('#E07A5F');
      sheet.getRange(1, newCol).setFontColor('#FFFFFF');
      sheet.getRange(targetRow, newCol).setValue(value);
    }
  };
  
  if (data.status) updateField(['Status', 'status'], data.status);
  if (data.tindakanPerbaikan) updateField(['Tindakan_Perbaikan', 'tindakanPerbaikan'], data.tindakanPerbaikan);
  if (data.tindakanPencegahan) updateField(['Tindakan_Pencegahan', 'tindakanPencegahan'], data.tindakanPencegahan);
  if (data.tglSelesai) updateField(['Tgl_Selesai', 'tglSelesai'], data.tglSelesai);
  if (data.hasilVerifikasi) updateField(['Hasil_Verifikasi', 'hasilVerifikasi'], data.hasilVerifikasi);
  if (data.verifikator) updateField(['Verifikator', 'verifikator'], data.verifikator);
  if (data.tglVerifikasi) updateField(['Tgl_Verifikasi', 'tglVerifikasi'], data.tglVerifikasi);
  if (data.catatanTL) updateField(['Catatan_TL', 'catatanTL'], data.catatanTL);
  if (data.updatedBy) updateField(['Updated_By', 'updatedBy'], data.updatedBy);
  if (data.updatedAt) updateField(['Updated_At', 'updatedAt'], data.updatedAt);
  
  return { 
    status: 'success', 
    message: 'Tindak lanjut temuan berhasil diupdate',
    temuanId: data.temuanId
  };
}