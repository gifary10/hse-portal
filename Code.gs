// code.gs
// Google Apps Script untuk mengambil data dari Google Sheet
// Sheet ID: 1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI
// Sheets: IADL, akses, MasterKPI, MasterTemplate, OTP

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
  
  // Buat sheet OTP jika belum ada
  if (!sheet) {
    sheet = spreadsheet.insertSheet('OTP');
    
    // Set headers
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
  
  // Generate OTP ID
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
    '', // Reviewer_Notes (kosong saat create)
    '', // Reviewed_By (kosong saat create)
    ''  // Reviewed_Date (kosong saat create)
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
  
  // Cari OTP ID column
  const otpIdColIndex = headers.findIndex(h => 
    h === 'OTP_ID' || h === 'otpId' || h === 'otp_id'
  );
  
  if (otpIdColIndex === -1) {
    return { status: 'error', message: 'Kolom OTP_ID tidak ditemukan' };
  }
  
  // Cari row dengan OTP ID yang sesuai
  const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const values = dataRange.getValues();
  
  let targetRow = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][otpIdColIndex]) === String(otpId)) {
      targetRow = i + 2; // +2 karena row 1 adalah header
      break;
    }
  }
  
  if (targetRow === -1) {
    return { status: 'error', message: 'OTP dengan ID ' + otpId + ' tidak ditemukan' };
  }
  
  // Cari atau tambahkan kolom yang diperlukan
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
  
  // Update status jika kolom ditemukan
  if (statusColIndex !== -1) {
    sheet.getRange(targetRow, statusColIndex + 1).setValue(status);
  }
  
  // Update reviewer notes
  if (reviewerNotesColIndex !== -1) {
    sheet.getRange(targetRow, reviewerNotesColIndex + 1).setValue(reviewerNotes);
  } else {
    // Tambahkan kolom baru jika belum ada
    const newCol = lastCol + 1;
    sheet.getRange(1, newCol).setValue('Reviewer_Notes');
    sheet.getRange(1, newCol).setFontWeight('bold');
    sheet.getRange(1, newCol).setBackground('#7FB77E');
    sheet.getRange(1, newCol).setFontColor('#FFFFFF');
    sheet.getRange(targetRow, newCol).setValue(reviewerNotes);
    reviewerNotesColIndex = newCol - 1;
  }
  
  // Update reviewed by
  if (reviewedByColIndex !== -1) {
    sheet.getRange(targetRow, reviewedByColIndex + 1).setValue(reviewedBy);
  } else {
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue('Reviewed_By');
    sheet.getRange(1, newCol).setFontWeight('bold');
    sheet.getRange(1, newCol).setBackground('#7FB77E');
    sheet.getRange(1, newCol).setFontColor('#FFFFFF');
    sheet.getRange(targetRow, newCol).setValue(reviewedBy);
    reviewedByColIndex = newCol - 1;
  }
  
  // Update reviewed date
  if (reviewedDateColIndex !== -1) {
    sheet.getRange(targetRow, reviewedDateColIndex + 1).setValue(reviewedDate);
  } else {
    const newCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, newCol).setValue('Reviewed_Date');
    sheet.getRange(1, newCol).setFontWeight('bold');
    sheet.getRange(1, newCol).setBackground('#7FB77E');
    sheet.getRange(1, newCol).setFontColor('#FFFFFF');
    sheet.getRange(targetRow, newCol).setValue(reviewedDate);
    reviewedDateColIndex = newCol - 1;
  }
  
  return { 
    status: 'success', 
    message: 'Status OTP berhasil diupdate menjadi ' + status,
    otpId: otpId,
    newStatus: status
  };
}