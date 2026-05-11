// code.gs
// Google Apps Script untuk mengambil data dari Google Sheet
// Sheet ID: 1KfXU_1IlDzcv5bF8PPG4Oe_wdhLUDwyqrGubYHKSqFI
// Sheets: IADL, akses

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
      
      default:
        result = { status: 'error', message: 'Unknown action' };
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
  // Same as getUsers but without sensitive data exposure
  const result = getUsers();
  if (result.status === 'success' && result.data) {
    // Remove passwords from response for security
    const safeData = result.data.map(user => ({
      ...user,
      Password: '••••••••' // Mask password
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
    // Map user data
    const mappedUser = {
      id: user.rowIndex || Date.now(),
      username: user.Username,
      name: user.Username, // You can add a Name column if needed
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