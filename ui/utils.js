// ui/utils.js
// Utility functions untuk seluruh aplikasi

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format date to Indonesian locale (DD MMM YYYY)
 * @param {string|Date} dateString - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

/**
 * Format datetime to Indonesian locale (DD MMM YYYY, HH:MM)
 * @param {string|Date} dateString - Date to format
 * @returns {string} - Formatted datetime string
 */
export function formatDateTime(dateString) {
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

/**
 * Format time only (HH:MM)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted time string
 */
export function formatTime(date) {
    if (!date) return 'Belum diperbarui';
    try {
        return date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '-';
    }
}

/**
 * Format number with thousand separators (Indonesian format)
 * @param {number|string} num - Number to format
 * @returns {string} - Formatted number string
 */
export function formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Escape special regex characters
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for regex
 */
export function escapeRegex(str) {
    if (!str) return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Debounce function for search inputs - VERSI STANDAR
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms (default 400)
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait = 400) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function untuk event yang sering dipanggil
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in ms
 * @returns {Function} - Throttled function
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Get status badge HTML based on type
 * @param {string} status - Status value
 * @param {string} type - Type of badge: 'otp', 'temuan', 'mr', 'md', 'default'
 * @returns {string} - Badge HTML
 */
export function getStatusBadge(status, type = 'default') {
    const statusMaps = {
        otp: {
            'Draft': 'warning',
            'Submitted': 'info',
            'In Review': 'info',
            'Approved': 'success',
            'Rejected': 'danger',
            'Revision Requested': 'warning'
        },
        temuan: {
            'Open': 'danger',
            'In Progress': 'warning',
            'Closed': 'success',
            'Verified': 'info',
            'Draft': 'default'
        },
        mr: {
            'Draft': 'warning',
            'Completed': 'info',
            'Approved': 'success'
        },
        md: {
            'Pending': 'warning',
            'Active': 'info',
            'In Progress': 'info',
            'Completed': 'success',
            'Implemented': 'success',
            'Cancelled': 'danger'
        },
        default: {
            'Active': 'success',
            'Inactive': 'danger',
            'active': 'success',
            'inactive': 'danger'
        }
    };
    
    const map = statusMaps[type] || statusMaps.default;
    const badgeClass = map[status] || 'default';
    const label = status || '-';
    
    return `<span class="badge-status ${badgeClass}">${label}</span>`;
}

/**
 * Get kategori badge for temuan
 * @param {string} value - Kategori value
 * @returns {string} - Badge HTML
 */
export function getKategoriBadge(value) {
    const badges = {
        'Ketidaksesuaian': 'danger',
        'Observasi': 'warning',
        'OFI': 'info',
        'Positif': 'success'
    };
    const badgeClass = badges[value] || 'default';
    return `<span class="badge-status ${badgeClass}">${value || '-'}</span>`;
}

/**
 * Get klasifikasi badge for temuan
 * @param {string} value - Klasifikasi value
 * @returns {string} - Badge HTML
 */
export function getKlasifikasiBadge(value) {
    const badges = {
        'Mayor': 'danger',
        'Minor': 'warning',
        'Observation': 'info'
    };
    const badgeClass = badges[value] || 'default';
    return `<span class="badge-status ${badgeClass}">${value || '-'}</span>`;
}

/**
 * Get prioritas badge
 * @param {string} value - Prioritas value
 * @returns {string} - Badge HTML
 */
export function getPrioritasBadge(value) {
    const badges = {
        'Tinggi': 'danger',
        'Sedang': 'warning',
        'Rendah': 'success',
        'High': 'danger',
        'Medium': 'warning',
        'Low': 'success'
    };
    const badgeClass = badges[value] || 'default';
    return `<span class="badge-status ${badgeClass}">${value || '-'}</span>`;
}

/**
 * Get polarity badge
 * @param {string} value - Polarity value
 * @returns {string} - Badge HTML
 */
export function getPolarityBadge(value) {
    const badges = {
        'Higher is Better': 'success',
        'Lower is Better': 'danger',
        'On Target': 'info'
    };
    const badgeClass = badges[value] || 'default';
    return `<span class="badge-status ${badgeClass}">${value || '-'}</span>`;
}

/**
 * Highlight search term in text
 * @param {string} text - Original text
 * @param {string} searchQuery - Search term to highlight
 * @returns {string} - Text with highlighted search term
 */
export function highlightText(text, searchQuery) {
    if (!searchQuery || !text) return escapeHtml(text || '-');
    const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi');
    return escapeHtml(text).replace(regex, 
        '<mark style="background: var(--accent-light); padding: 0 2px; border-radius: 3px;">$1</mark>');
}

/**
 * Show skeleton loading animation for tables
 * @param {number} columns - Number of columns
 * @param {number} rows - Number of rows
 * @returns {string} - Skeleton table HTML
 */
export function renderSkeletonTable(columns, rows = 5) {
    const skeletonRows = Array(rows).fill(0).map(() => `
        <tr class="skeleton-row">
            ${Array(columns).fill(0).map(() => `
                <td><div style="height: 1rem; background: #e2e8f0; border-radius: 4px; width: 100%;"></div></td>
            `).join('')}
        </tr>
    `).join('');
    
    return `
        <table class="data-table striped">
            <tbody>
                ${skeletonRows}
            </tbody>
        </table>
    `;
}

/**
 * Set button loading state - STANDARISASI
 * @param {HTMLElement} btn - Button element
 * @param {boolean} isLoading - Loading state
 * @param {string} loadingText - Text saat loading
 */
export function setButtonLoading(btn, isLoading, loadingText = 'Memproses...') {
    if (!btn) return;
    
    if (isLoading) {
        btn.disabled = true;
        if (!btn.dataset.originalHtml) {
            btn.dataset.originalHtml = btn.innerHTML;
        }
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> ${loadingText}`;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalHtml) {
            btn.innerHTML = btn.dataset.originalHtml;
            delete btn.dataset.originalHtml;
        }
    }
}

/**
 * Validate form required fields
 * @param {HTMLFormElement} form - Form element
 * @param {Array} requiredFields - Array of field names that are required
 * @returns {Object} - { valid: boolean, missingFields: array }
 */
export function validateForm(form, requiredFields) {
    const missingFields = [];
    
    for (const fieldName of requiredFields) {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field && !field.value.trim()) {
            missingFields.push(fieldName);
        }
    }
    
    return {
        valid: missingFields.length === 0,
        missingFields: missingFields
    };
}

/**
 * Get form data as object
 * @param {HTMLFormElement} form - Form element
 * @returns {Object} - Form data object
 */
export function getFormData(form) {
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });
    return data;
}

/**
 * Safe JSON parse with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {any} fallback - Fallback value if parse fails
 * @returns {any} - Parsed object or fallback
 */
export function safeJsonParse(jsonString, fallback = {}) {
    if (!jsonString) return fallback;
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return fallback;
    }
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy:', err);
        return false;
    }
}

/**
 * Download data as CSV
 * @param {Array} data - Array of objects
 * @param {string} filename - Filename
 */
export function downloadAsCSV(data, filename) {
    if (!data || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    csvRows.push(headers.join(','));
    
    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header] || '';
            return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}