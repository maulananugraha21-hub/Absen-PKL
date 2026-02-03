// ========================================
// DATA USERS (Diambil dari Google Sheets)
// ========================================
let USERS_DATA = [];
let isLoadingUsers = true;

// ========================================
// KONFIGURASI GOOGLE SHEETS
// ========================================
let SCRIPT_URL = localStorage.getItem('SCRIPT_URL') || 'https://script.google.com/macros/s/AKfycbwO94V5p6emRcaEINI17KNkki2GmwXXAd35vLBblX5-6abMxSUdhkCJTsvygLJOk3Q/exec';

function setScriptUrl(url) {
    if (!url) return false;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
        showAlert('error', 'Format URL tidak valid. Mulai dengan http:// atau https://');
        return false;
    }
    SCRIPT_URL = trimmed;
    localStorage.setItem('SCRIPT_URL', trimmed);
    showAlert('success', 'URL Google Apps Script disimpan.');
    return true;
}

// ========================================
// LOAD DATA USER DARI GOOGLE SHEETS
// ========================================
async function loadUsersFromSheets() {
    try {
        isLoadingUsers = true;
        console.log('Mengecek SCRIPT_URL untuk loadUsersFromSheets:', SCRIPT_URL);
        const url = SCRIPT_URL + '?action=getUsers';

        const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
        console.log('Fetch response:', response.status, response.statusText);

        const text = await response.text();
        let result = null;

        try {
            result = text ? JSON.parse(text) : null;
        } catch (parseErr) {
            console.error('❌ Response tidak bisa di-parse sebagai JSON:', parseErr, '\nResponse body:', text);
            showAlert('error', 'Gagal memuat data user: response bukan JSON. Periksa konfigurasi Google Apps Script.');
            USERS_DATA = [];
            return;
        }

        if (!response.ok) {
            console.error('❌ Request error:', response.status, response.statusText, result);
            showAlert('error', `Gagal memuat data user: ${response.status} ${response.statusText}`);
            USERS_DATA = [];
            return;
        }

        if (result && result.status === 'success' && result.users) {
            USERS_DATA = result.users;
            console.log('✅ Data users berhasil dimuat:', USERS_DATA.length, 'user(s)');
        } else {
            console.error('❌ Gagal memuat users, response:', result);
            showAlert('error', 'Gagal memuat data user: struktur response tidak sesuai.');
            USERS_DATA = [];
        }
    } catch (error) {
        console.error('❌ Error loading users:', error);
        showAlert('error', 'Gagal memuat data user dari Google Sheets: ' + (error.message || error));
        USERS_DATA = [];
    } finally {
        isLoadingUsers = false;
    }
}

// ========================================
// STATE MANAGEMENT
// ========================================
let currentUser = null;
let userAbsenList = [];
let filterType = 'semua';
let filterDate = '';

window.onload = async function() {
    await loadUsersFromSheets();
    
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser && !isLoadingUsers) {
        currentUser = JSON.parse(savedUser);
        await loadUserAbsenHistory();
        showMainApp();
        showPage('dashboard');
        showReminderIfNeeded();
    }
    
    const dateInput = document.getElementById('absenDate');
    if (dateInput) {
        const todayISO = new Date().toISOString().slice(0,10);
        dateInput.value = todayISO;
    }
    
};

// ========================================
// FUNGSI JAM DAN TANGGAL
// ========================================
function updateClock() {
    const now = new Date();
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('clock').textContent = `${hours}:${minutes}:${seconds}`;
    
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    
    document.getElementById('date').textContent = `${dayName}, ${day} ${month} ${year}`;
}

setInterval(updateClock, 1000);
updateClock();

// ========================================
// FUNGSI LOGIN
// ========================================
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (isLoadingUsers) {
        showAlert('error', 'Data user masih dimuat, silakan tunggu...');
        return;
    }

    const email = document.getElementById('email').value.trim();

    if (!email) {
        showAlert('error', 'Mohon masukkan email!');
        return;
    }

    let user = USERS_DATA.find(u => u.email === email);

    if (!user) {
        if (USERS_DATA.length === 0) {
            user = {
                nama: email.split('@')[0],
                email: email,
                asalSekolah: '-',
                site: '-',
                nomorRekening: '-',
                alamat: '-'
            };
        } else {
            showAlert('error', 'Email tidak terdaftar!');
            return;
        }
    }

    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    showAlert('success', 'Login berhasil! Selamat datang, ' + (user.nama || user.email));

    setTimeout(async () => {
        await loadUserAbsenHistory();
        showMainApp();
        showPage('dashboard');
    }, 800);
});

// ========================================
// FUNGSI LOGOUT
// ========================================
function logout() {
    if (confirm('Apakah Anda yakin ingin logout?')) {
        currentUser = null;
        localStorage.removeItem('currentUser');
        userAbsenList = [];
        filterType = 'semua';
        filterDate = '';
        document.getElementById('loginForm').reset();
        showLoginPage();
        showAlert('success', 'Logout berhasil!');
    }
}

// ========================================
// FUNGSI SHOW/HIDE PAGE
// ========================================
function showLoginPage() {
    document.getElementById('loginPage').classList.add('show');
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginPage').classList.remove('show');
    document.getElementById('mainApp').style.display = 'block';
    updateUserInfo();
}

function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('show');
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (pageName === 'dashboard') {
        document.getElementById('dashboardPage').classList.add('show');
        document.querySelector('[data-page="dashboard"]').classList.add('active');
        showReminderIfNeeded();
    } else if (pageName === 'riwayat') {
        document.getElementById('riwayatPage').classList.add('show');
        document.querySelector('[data-page="riwayat"]').classList.add('active');
        filterType = 'semua';
        filterDate = '';
        document.getElementById('filterDate').value = '';
        displayRiwayat();
    } else if (pageName === 'profile') {
        document.getElementById('profilePage').classList.add('show');
        document.querySelector('[data-page="profile"]').classList.add('active');
        updateProfilePage();
    }
}

// ========================================
// FUNGSI UPDATE USER INFO
// ========================================
function updateUserInfo() {
    if (!currentUser) return;
}

// ========================================
// FUNGSI LOAD ABSEN HISTORY DARI GOOGLE SHEETS
// ========================================
async function loadUserAbsenHistory() {
    if (!currentUser || !currentUser.email) {
        console.warn('Tidak ada currentUser, riwayat tidak dapat dimuat');
        userAbsenList = [];
        return;
    }

    try {
        console.log('Memuat riwayat absensi dari Google Sheets...');
        const url = SCRIPT_URL + '?action=getAbsensi&email=' + encodeURIComponent(currentUser.email);

        const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
        console.log('Fetch riwayat response:', response.status, response.statusText);

        const text = await response.text();
        let result = null;
        try {
            result = text ? JSON.parse(text) : null;
        } catch (parseErr) {
            console.error('❌ Response riwayat tidak bisa di-parse sebagai JSON:', parseErr, '\nResponse body:', text);
            showAlert('error', 'Gagal memuat riwayat: response server tidak valid');
            userAbsenList = [];
            return;
        }

        console.log('DEBUG getAbsensi result:', result);

        if (!response.ok) {
            console.error('❌ Request error:', response.status, response.statusText, result);
            showAlert('error', 'Gagal memuat riwayat dari server: ' + response.status);
            userAbsenList = [];
            return;
        }

        let absensi = null;
        if (result && Array.isArray(result.absensi)) {
            absensi = result.absensi;
        } else if (result && Array.isArray(result.users)) {
            absensi = result.users;
        } else if (Array.isArray(result)) {
            absensi = result;
        } else if (result && typeof result === 'object') {
            for (const k in result) {
                if (Object.prototype.hasOwnProperty.call(result, k) && Array.isArray(result[k])) {
                    absensi = result[k];
                    break;
                }
            }
        }

        if (absensi && Array.isArray(absensi)) {
            userAbsenList = absensi;
            console.log('✅ Riwayat absensi berhasil dimuat:', userAbsenList.length, 'record(s)');
        } else {
            console.error('❌ Gagal memuat riwayat, response tidak mengandung array absensi:', result);
            showAlert('error', 'Gagal memuat riwayat: response server tidak mengandung data');
            userAbsenList = [];
        }
    } catch (error) {
        console.error('❌ Error loading riwayat:', error);
        showAlert('error', 'Gagal memuat riwayat dari server: ' + (error.message || error));
        userAbsenList = [];
    }
}

// ========================================
// FUNGSI CEK ABSENSI KEMARIN & HARI INI
// ========================================

function getAbsenStatusKemarin() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('id-ID');

    let adaMasukKemarin = false;
    let adaPulangKemarin = false;

    userAbsenList.forEach(absen => {
        const absenDate = parseAbsensiToDate(absen);
        if (!absenDate) return;
        const absenDateStr = absenDate.toLocaleDateString('id-ID');
        if (absenDateStr === yesterdayStr) {
            if (absen.tipeAbsen === 'Masuk') adaMasukKemarin = true;
            if (absen.tipeAbsen === 'Pulang') adaPulangKemarin = true;
        }
    });

    return {
        adaMasukKemarin,
        adaPulangKemarin,
        belumPulangKemarin: adaMasukKemarin && !adaPulangKemarin
    };
}

function getAbsenStatusHariIni(selectedDateStr) {
    const targetDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
    const targetDateStr = targetDate.toLocaleDateString('id-ID');

    let adaMasuk = false;
    let adaPulang = false;

    userAbsenList.forEach(absen => {
        const absenDate = parseAbsensiToDate(absen);
        if (!absenDate) return;
        const absenDateStr = absenDate.toLocaleDateString('id-ID');
        if (absenDateStr === targetDateStr) {
            if (absen.tipeAbsen === 'Masuk') adaMasuk = true;
            if (absen.tipeAbsen === 'Pulang') adaPulang = true;
        }
    });

    return { adaMasuk, adaPulang };
}

// Tambahkan di fungsi showPage('dashboard') atau window.onload
function showReminderIfNeeded() {
    const statusKemarin = getAbsenStatusKemarin();
    const reminderDiv = document.getElementById('absensiReminder');
    
    if (!reminderDiv) {
        const reminderHTML = `
            <div id="absensiReminder" class="reminder-box" style="display: none;">
                <div class="reminder-icon">⚠️</div>
                <div class="reminder-text">
                    <strong>Pengingat:</strong>
                    <span id="reminderMessage"></span>
                </div>
            </div>
        `;
        document.querySelector('.absensi-section').insertAdjacentHTML('beforebegin', reminderHTML);
    }
    
    const reminderBox = document.getElementById('absensiReminder');
    const reminderMessage = document.getElementById('reminderMessage');
    
    if (statusKemarin.belumPulangKemarin) {
        reminderMessage.textContent = 'Anda belum absen PULANG kemarin. Mohon lengkapi terlebih dahulu!';
        reminderBox.style.display = 'flex';
        reminderBox.style.background = '#fff3cd';
        reminderBox.style.border = '2px solid #ffc107';
    } else {
        reminderBox.style.display = 'none';
    }
}


// ========================================
// FUNGSI DISPLAY RIWAYAT
// ========================================
function displayRiwayat() {
    const riwayatList = document.getElementById('riwayatList');
    
    if (userAbsenList.length === 0) {
        riwayatList.innerHTML = '<div class="empty-state"><p>📭 Belum ada riwayat absensi</p></div>';
        return;
    }
    
    // Filter data yang valid
    let validAbsensi = userAbsenList.filter(a => {
        const validTypes = ['Masuk', 'Pulang', 'Izin', 'Sakit'];
        if (!validTypes.includes(a.tipeAbsen)) return false;
        if (!a.tanggal || a.tanggal === '' || a.tanggal === 'Tanggal') return false;
        
        // Validasi: rowId harus >= 7 (data dimulai dari baris 7)
        const rowNum = parseInt(a.rowId, 10);
        if (isNaN(rowNum) || rowNum < 9) return false;
        
        return true;
    });
    
    let filtered = [...validAbsensi];
    
    if (filterType !== 'semua') {
        filtered = filtered.filter(a => a.tipeAbsen === filterType);
    }
    
    if (filterDate) {
        // Try to parse the calendar input (typically YYYY-MM-DD) and compare by year/month/day
        const targetDate = (function() {
            const v = filterDate;
            if (!v) return null;
            const d = new Date(v);
            if (!isNaN(d)) {
                d.setHours(0,0,0,0);
                return d;
            }
            return null;
        })();

        if (targetDate) {
            filtered = filtered.filter(a => {
                const d = parseAbsensiToDate(a);
                if (!d) return false;
                d.setHours(0,0,0,0);
                return d.getTime() === targetDate.getTime();
            });
        } else {
            // fallback: string match (for older formats)
            filtered = filtered.filter(a => {
                const tanggalStr = a.tanggal || '';
                return tanggalStr.includes(filterDate);
            });
        }
    }
    
    filtered.sort((a, b) => {
        const dateA = new Date(a.tahun, getMonthIndex(a.bulan), a.tanggalAngka);
        const dateB = new Date(b.tahun, getMonthIndex(b.bulan), b.tanggalAngka);
        return dateB - dateA;
    });
    
    if (filtered.length === 0) {
        riwayatList.innerHTML = '<div class="empty-state"><p>📭 Tidak ada data untuk filter ini</p></div>';
        return;
    }
    
    let html = '';
    // Di fungsi displayRiwayat(), bagian mapping riwayat
filtered.forEach((absen) => {
    const rowId = absen.rowId || '';
    const icon = absen.tipeAbsen === 'Masuk' ? '➡️' : absen.tipeAbsen === 'Pulang' ? '⬅️' : '⚠️';
    const alasan = absen.alasan && absen.alasan !== '-' ? `<div class="riwayat-detail"><strong>Alasan:</strong> ${absen.alasan}</div>` : '';
    const scope = absen.scopePekerjaan && absen.scopePekerjaan !== '-' ? `<div class="riwayat-detail"><strong>Scope:</strong> ${absen.scopePekerjaan}</div>` : '';
    const jenisPulang = absen.jenisPulang && absen.jenisPulang !== '-' ? `<div class="riwayat-detail"><strong>Jenis:</strong> ${absen.jenisPulang}</div>` : '';

    // ✅ Konversi ISO Date ke format Indonesia
    let displayDate = absen.tanggal || '-';
        // Cek apakah format ISO (mengandung T dan Z)
    if (typeof displayDate === 'string' && displayDate.includes('T')) {
        try {
            const dateObj = new Date(displayDate);
            const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                           'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            
            const hari = days[dateObj.getDay()];
            const tanggal = dateObj.getDate();
            const bulan = months[dateObj.getMonth()];
            const tahun = dateObj.getFullYear();
            
            displayDate = `${hari}, ${tanggal} ${bulan} ${tahun}`;
        } catch (err) {
            console.error('Error parsing date:', err);
            displayDate = absen.tanggal; // fallback ke original
        }
    }

    // Tandai jika ini entri MASUK dan belum ada PULANG pada tanggal yang sama
    let badgeHtml = '';
    try {
        const absenDateObj = parseAbsensiToDate(absen);
        if (absen.tipeAbsen === 'Masuk' && absenDateObj) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const absenDay = new Date(absenDateObj.getFullYear(), absenDateObj.getMonth(), absenDateObj.getDate());
            if (absenDay <= today) {
                const pulangExists = userAbsenList.some(a => {
                    if (a.tipeAbsen !== 'Pulang') return false;
                    const d = parseAbsensiToDate(a);
                    if (!d) return false;
                    const da = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                    return da.toLocaleDateString('id-ID') === absenDay.toLocaleDateString('id-ID');
                });
                if (!pulangExists) {
                    badgeHtml = `<div class="riwayat-badge" style="color:#856404;background:#fff3cd;padding:4px;border-radius:4px;display:inline-block;margin-left:8px;font-size:0.9em">Belum Pulang</div>`;
                }
            }
        }
    } catch (e) {
        console.error('Error checking pulang status for badge:', e);
    }

    html += `
        <div class="riwayat-item" data-rowid="${rowId}" data-type="${absen.tipeAbsen}">
            <div class="riwayat-header">
                <span class="riwayat-type">${icon} ${absen.tipeAbsen}</span>
                ${badgeHtml}
                <button class="btn-delete" onclick="handleDeleteRiwayat('${rowId}')" title="Hapus">🗑️</button>
            </div>
            <div class="riwayat-date">${displayDate}</div>
            ${alasan}
            ${jenisPulang}
            ${scope}
        </div>
    `;
});
    
    riwayatList.innerHTML = html;
}

function getMonthIndex(monthName) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                   'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return months.indexOf(monthName);
}

// Helper: parse an absensi record into a Date object (tries several formats)
function parseAbsensiToDate(absen) {
    if (!absen) return null;

    // 1) If `tanggal` is an ISO string (contains 'T')
    if (absen.tanggal && typeof absen.tanggal === 'string') {
        const s = absen.tanggal.trim();
        if (s.includes('T')) {
            const d = new Date(s);
            if (!isNaN(d)) return d;
        }

        // 2) If `tanggal` like "Hari, DD Bulan YYYY" (e.g. "Senin, 12 Januari 2026")
        let parts = null;
        if (s.includes(',')) parts = s.split(', ')[1];
        if (parts) {
            const parts2 = parts.split(' ');
            if (parts2.length >= 3) {
                const day = parseInt(parts2[0], 10);
                const monthIdx = getMonthIndex(parts2[1]);
                const year = parseInt(parts2[2], 10);
                if (!isNaN(day) && monthIdx >= 0 && !isNaN(year)) {
                    return new Date(year, monthIdx, day);
                }
            }
        }

        // 2b) Also accept format without weekday: "DD Bulan YYYY" (e.g. "12 Januari 2026")
        const dmYParts = s.match(/^(\d{1,2})\s+([A-Za-zÀ-ž]+)\s+(\d{4})$/);
        if (dmYParts) {
            const day = parseInt(dmYParts[1], 10);
            const monthIdx = getMonthIndex(dmYParts[2]);
            const year = parseInt(dmYParts[3], 10);
            if (!isNaN(day) && monthIdx >= 0 && !isNaN(year)) {
                return new Date(year, monthIdx, day);
            }
        }

        // 3) If `tanggal` like DD/MM/YYYY
        const dmYMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dmYMatch) {
            const day = parseInt(dmYMatch[1], 10);
            const month = parseInt(dmYMatch[2], 10) - 1;
            const year = parseInt(dmYMatch[3], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d)) return d;
        }
    }

    // 4) If separate fields exist: tanggalAngka, bulan, tahun
    if (absen.tahun && absen.bulan && absen.tanggalAngka !== undefined) {
        const year = parseInt(absen.tahun, 10);
        const monthIdx = typeof absen.bulan === 'number' ? absen.bulan : getMonthIndex(absen.bulan);
        const day = parseInt(absen.tanggalAngka, 10);
        if (!isNaN(year) && !isNaN(monthIdx) && monthIdx >= 0 && !isNaN(day)) {
            return new Date(year, monthIdx, day);
        }
    }

    return null;
}

// ========================================
// FUNGSI HAPUS RIWAYAT DARI GOOGLE SHEETS
// ========================================
async function handleDeleteRiwayat(rowId) {
    if (!rowId || rowId === '' || rowId === 'undefined' || rowId === 'null') {
        console.error('❌ rowId tidak valid:', rowId);
        showAlert('error', 'ID data tidak valid. Pastikan data memiliki rowId dari server.');
        return;
    }

    const confirmMsg = 'Apakah Anda yakin ingin menghapus data absensi ini?\n\nTindakan ini tidak dapat dibatalkan!';
    if (!confirm(confirmMsg)) {
        return;
    }

    if (!SCRIPT_URL) {
        showAlert('error', 'URL Google Apps Script belum dikonfigurasi!');
        return;
    }

    if (!currentUser || !currentUser.email) {
        showAlert('error', 'User tidak teridentifikasi. Silakan login ulang.');
        return;
    }

    document.getElementById('loading').style.display = 'block';

    try {
        console.log('🗑️ Menghapus riwayat dengan rowId:', rowId);
        console.log('📧 Email user:', currentUser.email);
        
        const formData = new FormData();
        formData.append('action', 'deleteAbsensi');
        formData.append('rowId', String(rowId));
        formData.append('email', currentUser.email);

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            body: formData,
            redirect: 'follow'
        });

        console.log('📥 Response status:', response.status, response.statusText);
        
        const responseText = await response.text();
        console.log('📄 Response text:', responseText);
        
        let responseJson = null;
        try {
            responseJson = responseText ? JSON.parse(responseText) : null;
        } catch (parseError) {
            console.error('❌ Gagal parse JSON response:', parseError);
            console.error('Response body:', responseText);
            showAlert('error', 'Response dari server tidak valid. Cek console untuk detail.');
            return;
        }

        if (!response.ok) {
            console.error('❌ HTTP error:', response.status, responseJson);
            showAlert('error', `Gagal menghapus: HTTP ${response.status} - ${responseJson?.message || 'Unknown error'}`);
            return;
        }

        if (responseJson && responseJson.status !== 'success') {
            console.error('❌ Server error:', responseJson);
            showAlert('error', 'Gagal menghapus: ' + (responseJson.message || JSON.stringify(responseJson)));
            return;
        }

        console.log('✅ Data berhasil dihapus dari Google Sheets');
        showAlert('success', 'Data absensi berhasil dihapus! 🗑️');
        
        console.log('🔄 Memuat ulang data...');
        await loadUserAbsenHistory();
        
        displayRiwayat();
        updateProfilePage();
        
    } catch (error) {
        console.error('❌ Error saat menghapus:', error);
        showAlert('error', 'Terjadi kesalahan: ' + (error.message || 'Unknown error'));
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

async function deleteRiwayat(rowId) {
    return handleDeleteRiwayat(rowId);
}

// ========================================
// FUNGSI FILTER BY TYPE
// ========================================
function filterByType(type) {
    filterType = type;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    document.getElementById('searchRiwayat').value = '';
    
    displayRiwayat();
}

// ========================================
// FUNGSI FILTER BY DATE
// ========================================
function filterByDate() {
    filterDate = document.getElementById('filterDate').value;
    displayRiwayat();
}

// ========================================
// FUNGSI RESET FILTER
// ========================================
function resetFilter() {
    filterDate = '';
    document.getElementById('filterDate').value = '';
    displayRiwayat();
}

// ========================================
// FUNGSI FILTER BY SEARCH
// ========================================
function filterRiwayat() {
    const searchTerm = document.getElementById('searchRiwayat').value.toLowerCase();
    const items = document.querySelectorAll('.riwayat-item');
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const visible = text.includes(searchTerm);
        item.style.display = visible ? 'block' : 'none';
    });
}

// ========================================
// ✅ FUNGSI POPULATE MONTH FILTER (BARU)
// ========================================
function populateMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    if (!monthFilter) return;
    
    // Clear existing options except "Semua Bulan"
    monthFilter.innerHTML = '<option value="all">Semua Bulan</option>';
    
    if (userAbsenList.length === 0) return;
    
    // Extract unique months from userAbsenList
    const monthsSet = new Set();
    
    userAbsenList.forEach(absen => {
        const date = parseAbsensiToDate(absen);
        if (!date) return;
        
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`; // Format: 2025-01
        monthsSet.add(monthKey);
    });
    
    // Convert to array and sort (newest first)
    const monthsArray = Array.from(monthsSet).sort().reverse();
    
    // Nama bulan Indonesia
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    // Add options
    monthsArray.forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const monthIndex = parseInt(month) - 1;
        const displayText = `${monthNames[monthIndex]} ${year}`;
        
        const option = document.createElement('option');
        option.value = monthKey;
        option.textContent = displayText;
        monthFilter.appendChild(option);
    });
}

// ========================================
// ✅ FUNGSI GET STATS (UPDATED WITH FILTER)
// ========================================
function getStats(filterMonth = 'all') {
    // Filter hanya data valid (rowId >= 9)
    let validAbsensi = userAbsenList.filter(a => {
        const rowNum = parseInt(a.rowId, 10);
        const validTypes = ['Masuk', 'Pulang', 'Izin', 'Sakit'];
        return !isNaN(rowNum) && rowNum >= 9 && validTypes.includes(a.tipeAbsen);
    });
    
    // ✅ FILTER BY MONTH
    if (filterMonth !== 'all') {
        validAbsensi = validAbsensi.filter(a => {
            const date = parseAbsensiToDate(a);
            if (!date) return false;
            
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // 1-12
            const absenMonthKey = `${year}-${String(month).padStart(2, '0')}`;
            
            return absenMonthKey === filterMonth;
        });
    }
    
    return {
        masuk: validAbsensi.filter(a => a.tipeAbsen === 'Masuk').length,
        pulangNormal: validAbsensi.filter(a => a.tipeAbsen === 'Pulang' && a.jenisPulang === 'Normal').length,
        pulangLembur: validAbsensi.filter(a => a.tipeAbsen === 'Pulang' && a.jenisPulang === 'Lembur').length,
        izin: validAbsensi.filter(a => a.tipeAbsen === 'Izin').length
    };
}

// ========================================
// ✅ FUNGSI UPDATE PROFILE STATS (BARU)
// ========================================
function updateProfileStats() {
    const monthFilter = document.getElementById('monthFilter');
    const selectedMonth = monthFilter ? monthFilter.value : 'all';
    
    const stats = getStats(selectedMonth);
    
    const elStatMasuk = document.getElementById('statMasuk');
    const elStatPulangNormal = document.getElementById('statPulangNormal');
    const elStatPulangLembur = document.getElementById('statPulangLembur');
    const elStatIzin = document.getElementById('statIzin');
    
    if (elStatMasuk) elStatMasuk.textContent = stats.masuk;
    if (elStatPulangNormal) elStatPulangNormal.textContent = stats.pulangNormal;
    if (elStatPulangLembur) elStatPulangLembur.textContent = stats.pulangLembur;
    if (elStatIzin) elStatIzin.textContent = stats.izin;
}

// ========================================
// ✅ FUNGSI UPDATE PROFILE PAGE (UPDATED)
// ========================================
function updateProfilePage() {
    if (!currentUser) return;
    
    const avatar = currentUser.nama.charAt(0).toUpperCase();
    
    const elAvatarProfile = document.getElementById('userAvatarProfile');
    const elNameProfile = document.getElementById('userNameProfile');
    const elEmail = document.getElementById('profileEmail');
    const elAsalSekolah = document.getElementById('profileAsalSekolah');
    const elSite = document.getElementById('profileSite');
    const elNomorRekening = document.getElementById('profileNomorRekening');
    
    if (elAvatarProfile) elAvatarProfile.textContent = avatar;
    if (elNameProfile) elNameProfile.textContent = currentUser.nama;
    if (elEmail) elEmail.textContent = currentUser.email || '-';
    if (elAsalSekolah) elAsalSekolah.textContent = currentUser.asalSekolah || '-';
    if (elSite) elSite.textContent = currentUser.site || '-';
    if (elNomorRekening) elNomorRekening.textContent = currentUser.nomorRekening || '-';
    
    // ✅ POPULATE MONTH FILTER & UPDATE STATS
    populateMonthFilter();
    updateProfileStats();
}

// ========================================
// FUNGSI UPDATE RADIO STYLE
// ========================================
function updateRadioStyle() {
    const radios = document.querySelectorAll('.radio-option');
    radios.forEach(option => {
        if (option.querySelector('input[type="radio"]').checked) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// ========================================
// FUNGSI TOGGLE ALASAN & SCOPE FIELD
// ========================================
function toggleAlasanField() {
    const tipeAbsen = document.getElementById('tipeAbsen').value;
    const alasanGroup = document.getElementById('alasanGroup');
    const alasanInput = document.getElementById('alasan');
    const scopeGroup = document.getElementById('scopePekerjaanGroup');
    const scopeInput = document.getElementById('scopePekerjaan');
    const pulangOptionsGroup = document.getElementById('pulangOptionsGroup');
    const jenisPulangRadios = document.querySelectorAll('input[name="jenisPulang"]');
    
    alasanGroup.style.display = 'none';
    alasanInput.required = false;
    alasanInput.value = '';
    scopeGroup.style.display = 'none';
    scopeInput.required = false;
    scopeInput.value = '';
    pulangOptionsGroup.style.display = 'none';
    jenisPulangRadios.forEach(radio => {
        radio.checked = false;
        radio.closest('.radio-option').classList.remove('selected');
    });
    
    if (tipeAbsen === 'Izin') {
        alasanGroup.style.display = 'block';
        alasanInput.required = true;
    } else if (tipeAbsen === 'Pulang') {
        pulangOptionsGroup.style.display = 'block';
        scopeGroup.style.display = 'block';
        scopeInput.required = true;
    }
}

// ========================================
// FUNGSI CEK ABSEN MASUK HARI INI
// ========================================
function checkAbsenMasukHariIni(selectedDateStr) {
    const targetDate = selectedDateStr ? new Date(selectedDateStr) : new Date();
    const targetDateString = targetDate.toLocaleDateString('id-ID');

    return userAbsenList.some(absen => {
        const absenDate = parseAbsensiToDate(absen);
        if (!absenDate) return false;
        return absen.tipeAbsen === 'Masuk' && absenDate.toLocaleDateString('id-ID') === targetDateString;
    });
}

// ========================================
// FUNGSI SUBMIT ABSENSI (DENGAN DEBUG)
// ========================================
document.getElementById('absenForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    console.log('=== FORM SUBMIT DEBUG ===');
    
    const tipeAbsen = document.getElementById('tipeAbsen').value;
    const alasan = document.getElementById('alasan').value.trim();
    const scopePekerjaan = document.getElementById('scopePekerjaan').value.trim();
    const jenisPulangElement = document.querySelector('input[name="jenisPulang"]:checked');
    const jenisPulang = jenisPulangElement?.value || '';
    
    console.log('tipeAbsen:', tipeAbsen);
    console.log('alasan:', alasan);
    console.log('scopePekerjaan:', scopePekerjaan);
    console.log('jenisPulang:', jenisPulang);
    console.log('jenisPulangElement:', jenisPulangElement);

    // VALIDASI 1: Tipe Absen
    if (!tipeAbsen) {
        console.error('❌ Validation failed: tipeAbsen kosong');
        showAlert('error', 'Mohon pilih tipe absensi!');
        return;
    }

    // VALIDASI 2: Tanggal
    const absenDateInput = document.getElementById('absenDate')?.value;
    if (!absenDateInput) {
        console.error('❌ Validation failed: tanggal kosong');
        showAlert('error', 'Mohon pilih tanggal absen!');
        return;
    }
    console.log('absenDateInput:', absenDateInput);

    // ========================================
    // VALIDASI BARU: CEK STATUS KEMARIN & HARI INI
    // ========================================
    const statusKemarin = getAbsenStatusKemarin();
    const statusHariIni = getAbsenStatusHariIni(absenDateInput);
    
    // Cek apakah tanggal yang dipilih adalah hari ini atau masa depan
    const selectedDate = new Date(absenDateInput);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    const isToday = selectedDate.getTime() === today.getTime();
    const isFuture = selectedDate > today;
    
    // VALIDASI: Jika kemarin belum pulang, tidak bisa absen hari ini/masa depan
    if ((isToday || isFuture) && statusKemarin.belumPulangKemarin) {
        showAlert('error', '⚠️ Anda belum absen PULANG kemarin! Mohon lengkapi absensi kemarin terlebih dahulu.');
        return;
    }
    
    // VALIDASI: Absen PULANG hanya bisa jika sudah MASUK di hari yang sama
    if (tipeAbsen === 'Pulang' && !statusHariIni.adaMasuk) {
        showAlert('error', '⚠️ Anda belum absen MASUK pada tanggal ini! Mohon absen masuk terlebih dahulu.');
        return;
    }
    
    // VALIDASI: Absen MASUK tidak boleh duplikat
    if (tipeAbsen === 'Masuk' && statusHariIni.adaMasuk) {
        showAlert('error', '⚠️ Anda sudah melakukan absen MASUK pada tanggal ini!');
        return;
    }

        // VALIDASI 3: Izin (butuh alasan)
    if (tipeAbsen === 'Izin' && !alasan) {
        showAlert('error', 'Mohon isi alasan izin!');
        return;
    }

    // VALIDASI 4: Pulang (butuh jenis pulang & scope)
    if (tipeAbsen === 'Pulang') {
        if (!jenisPulang) {
            showAlert('error', 'Mohon pilih jenis pulang (Normal atau Lembur)!');
            return;
        }
        if (!scopePekerjaan) {
            showAlert('error', 'Mohon isi scope pekerjaan!');
            return;
        }
    }

    console.log('✅ Semua validasi passed!');

    // Lanjutkan proses submit...
    document.getElementById('loading').style.display = 'block';
    document.getElementById('absenForm').style.display = 'none';

    const parts = absenDateInput.split('-');
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const dayNum = parseInt(parts[2], 10);
    const timestampDate = new Date(year, monthIdx, dayNum);

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const hari = days[timestampDate.getDay()];
    const tanggalAngka = timestampDate.getDate();
    const bulan = months[timestampDate.getMonth()];
    const tahun = timestampDate.getFullYear();

    const data = {
        tanggal: `${hari}, ${tanggalAngka} ${bulan} ${tahun}`,
        hari: hari,
        tanggalAngka: tanggalAngka,
        bulan: bulan,
        tahun: tahun,
        nama: currentUser.nama,
        site: currentUser.site,
        email: currentUser.email,
        asalSekolah: currentUser.asalSekolah,
        nomorRekening: currentUser.nomorRekening,
        tipeAbsen: tipeAbsen,
        alasan: tipeAbsen === 'Izin' ? alasan : '-',
        jenisPulang: tipeAbsen === 'Pulang' ? jenisPulang : '-',
        scopePekerjaan: tipeAbsen === 'Pulang' ? scopePekerjaan : '-'
    };

    console.log('📤 Data yang akan dikirim:', data);

    try {
        if (SCRIPT_URL) {
            try {
                console.log('Mengirim data absensi ke SCRIPT_URL:', SCRIPT_URL);
                const formData = new FormData();
                formData.append('action', 'saveAbsensi');
                formData.append('data', JSON.stringify(data));

                const resp = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'cors',
                    cache: 'no-cache',
                    body: formData,
                    redirect: 'follow'
                });

                console.log('Response saveAbsensi:', resp.status, resp.statusText);
                const respText = await resp.text();
                let respJson = null;
                try {
                    respJson = respText ? JSON.parse(respText) : null;
                } catch (parseErr) {
                    console.warn('saveAbsensi: response bukan JSON:', parseErr, respText);
                }

                if (!resp.ok) {
                    console.error('Gagal mengirim ke SCRIPT_URL:', resp.status, resp.statusText, respJson || respText);
                    showAlert('error', `Gagal mengirim data ke server: ${resp.status}`);
                    return;
                } else if (respJson && respJson.status && respJson.status !== 'success') {
                    console.warn('saveAbsensi response:', respJson);
                    showAlert('error', 'Server merespon: ' + (respJson.message || JSON.stringify(respJson)));
                    return;
                } else {
                    console.log('saveAbsensi sukses:', respJson || respText);
                    await loadUserAbsenHistory();
                }
            } catch (postErr) {
                console.error('Error saat mengirim data ke SCRIPT_URL:', postErr);
                showAlert('error', 'Gagal mengirim data: ' + (postErr.message || postErr));
                return;
            }
        } else {
            console.warn('SCRIPT_URL kosong, melewatkan pengiriman ke server.');
            showAlert('error', 'URL Google Apps Script belum dikonfigurasi!');
            return;
        }

        let message = '';
        if (tipeAbsen === 'Masuk') {
            message = 'Absen masuk berhasil dicatat! Selamat bekerja 💪';
        } else if (tipeAbsen === 'Pulang') {
            if (jenisPulang === 'Lembur') {
                message = 'Absen lembur berhasil dicatat. Terima kasih atas kerja kerasnya! 🙏';
            } else {
                message = 'Absen pulang berhasil dicatat! Hati-hati di jalan 🙏';
            }
        } else {
            message = 'Izin Anda berhasil dicatat. Semoga cepat sembuh/selesai urusannya 🙏';
        }
        
        showAlert('success', message);
        
        setTimeout(() => {
            document.getElementById('absenForm').reset();
            toggleAlasanField();
        }, 2000);

    } catch (error) {
        console.error('❌ Error:', error);
        showAlert('error', 'Gagal mengirim data: ' + error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('absenForm').style.display = 'block';
    }
});

// ========================================
// FUNGSI ALERT
// ========================================
function showAlert(type, message) {
    const alertSuccess = document.getElementById('alertSuccess');
    const alertError = document.getElementById('alertError');
    alertSuccess.style.display = 'none';
    alertError.style.display = 'none';
    
    if (type === 'success') {
        alertSuccess.textContent = '✓ ' + message;
        alertSuccess.style.display = 'block';
    } else {
        alertError.textContent = '✗ ' + message;
        alertError.style.display = 'block';
    }

    setTimeout(() => {
        alertSuccess.style.display = 'none';
        alertError.style.display = 'none';
    }, 5000);
}
