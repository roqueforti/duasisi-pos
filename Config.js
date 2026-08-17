// ============================================================
// POS LAUNDRY — BACKEND (Google Apps Script)
// Version 2.0 — Pipeline Tracking System
// ============================================================

// ============ KONFIGURASI ============
const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_TRANSAKSI = "Transaksi";
const SHEET_DETAIL    = "TransaksiDetail";
const SHEET_PELANGGAN = "Pelanggan";
const SHEET_LAYANAN   = "Layanan";
const SHEET_INVENTORY = "Inventory";
const SHEET_MESIN     = "Mesin";
const SHEET_PEGAWAI   = "Pegawai";
const SHEET_ABSENSI   = "Absensi";
const SHEET_SHIFT     = "MasterShift";
const SHEET_PIPELINE  = "Pipeline";
const SHEET_PROMO     = "Promo";
const SHEET_KAS_SHIFT = "KasShift";
const SHEET_KATEGORI  = "MasterKategori";
const TIMEZONE_WIB    = "Asia/Jakarta";
const MIGRATION_KEY   = "SPREADSHEET_SCHEMA_VERSION";

// Hanya fungsi bisnis berikut yang boleh dipanggil melalui Web App.
// Fungsi maintenance/destruktif (reset, seed, setup, migration) sengaja tidak diekspos.
const ALLOWED_API_ACTIONS = Object.freeze({
  verifikasiPin: true,
  getLayananList: true, getLayananListAll: true, tambahLayanan: true, updateLayanan: true, toggleAktifLayanan: true, hapusLayanan: true,
  getInventoryList: true, tambahInventory: true, updateStokInventory: true, updateInventoryItem: true, hapusInventory: true,
  getMesinList: true, tambahMesin: true, mulaiPakaiMesin: true, selesaiMesin: true, setMaintenanceMesin: true, hapusMesin: true,
  simpanTransaksi: true, pelunasanDP: true,
  getPromoList: true, tambahPromo: true, hapusPromo: true, validasiVoucher: true,
  simpanPelangganJikaBaru: true, cariPelangganByHp: true, getDaftarPelanggan: true, updateDataPelanggan: true, getRiwayatPelangganByHp: true, importPelangganBatch: true,
  getPipelineSteps: true, updateDropoffStatus: true, getTransaksiList: true, getTransaksiByNota: true, getTransaksiByPipeline: true,
  getLaporanRange: true, getPegawaiList: true, tambahPegawai: true, hapusPegawai: true, getRekapKinerjaPegawai: true,
  clockInPegawai: true, clockOutPegawai: true, getStatusAbsensiHariIni: true, getRekapAbsensi: true,
  getMasterShiftList: true, tambahMasterShift: true, hapusMasterShift: true,
  getKasShiftAktif: true, openKasShift: true, handoverCheckKasShift: true, closeKasShift: true, getRekapKasShift: true, uploadExpensePhoto: true,
  getAuditLogs: true, ajukanVoidTransaksi: true, approveVoidTransaksi: true,
  getPoinConfig: true, savePoinConfig: true,
  getPriorityConfig: true, savePriorityConfig: true,
  getKategoriList: true, tambahKategori: true, updateKategori: true, hapusKategori: true, toggleAktifKategori: true,
  getAbsensiConfig: true, saveAbsensiConfig: true, updateMasterShift: true,
  getPipelineConfigData: true, savePipelineConfigData: true,
  saveSecuritySettings: true, getSecuritySettings: true, recoverPin: true
});
const PUBLIC_API_ACTIONS = Object.freeze({ verifikasiPin: true, getTransaksiByNota: true, recoverPin: true });
const MANAGER_API_ACTIONS = Object.freeze({
  tambahLayanan: true, updateLayanan: true, toggleAktifLayanan: true, hapusLayanan: true,
  tambahInventory: true, hapusInventory: true, updateInventoryItem: true, updateStokInventory: true,
  tambahMesin: true, hapusMesin: true,
  tambahPromo: true, hapusPromo: true, editPromo: true,
  tambahPegawai: true, hapusPegawai: true,
  tambahMasterShift: true, hapusMasterShift: true,
  getLaporanRange: true, getAuditLogs: true, approveVoidTransaksi: true, getRekapKasShift: true,
  savePoinConfig: true, savePriorityConfig: true,
  tambahKategori: true, updateKategori: true, hapusKategori: true, toggleAktifKategori: true,
  saveAbsensiConfig: true, updateMasterShift: true,
  getPipelineConfigData: true, savePipelineConfigData: true,
  saveSecuritySettings: true, getSecuritySettings: true
});

/**
 * Reset data operasional tanpa menghapus master layanan/produk maupun akun.
 * Jalankan manual dari Apps Script editor setelah memastikan spreadsheet yang
 * aktif adalah spreadsheet POS Dua Sisi Laundry.
 */
function resetDatabaseOperasional() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const dataSheets = [
      SHEET_TRANSAKSI,
      SHEET_DETAIL,
      SHEET_PELANGGAN,
      SHEET_ABSENSI,
      SHEET_PIPELINE,
      SHEET_AUDIT,
      "KasShift",
      "ShiftKasir"
    ];

    dataSheets.forEach(function(name) { clearDataRows_(name); });

    // Inventory adalah data operasional; header dipertahankan agar schema tetap.
    clearDataRows_(SHEET_INVENTORY);

    // Mesin tetap dipertahankan sebagai master, tetapi status pemakaian di-reset.
    const machineSheet = SS.getSheetByName(SHEET_MESIN);
    if (machineSheet && machineSheet.getLastRow() > 1) {
      const rows = machineSheet.getLastRow() - 1;
      machineSheet.getRange(2, 4, rows, 1).setValue("Kosong");
      machineSheet.getRange(2, 6, rows, 2).clearContent();
    }

    SpreadsheetApp.flush();
    return { success: true, message: "Data operasional berhasil di-reset. Master layanan/produk dan akun tetap dipertahankan." };
  } finally {
    lock.releaseLock();
  }
}

/**
 * HARD RESET: Hapus SELURUH data di semua sheet (termasuk Layanan, Pegawai, Produk) kecuali Header baris 1.
 * Sangat berbahaya, gunakan dengan hati-hati saat ingin memulai database dari 0.
 */
function resetDatabaseTotal() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    let count = 0;
    
    // 1. Bersihkan semua isi sheet (kecuali baris pertama / header)
    for (let i = 0; i < sheets.length; i++) {
      const sh = sheets[i];
      const lastRow = sh.getLastRow();
      const lastCol = sh.getMaxColumns();
      
      if (lastRow > 1 && lastCol > 0) {
        sh.getRange(2, 1, lastRow - 1, lastCol).clearContent();
        count++;
      }
    }
    
    // 2. Reset ID Counter di Script Properties (Hati-hati: PIN JANGAN DIHAPUS)
    const props = PropertiesService.getScriptProperties();
    const allKeys = props.getKeys();
    for (let i = 0; i < allKeys.length; i++) {
      if (allKeys[i].indexOf("ID_COUNTER") !== -1) {
        props.deleteProperty(allKeys[i]);
      }
    }
    
    SpreadsheetApp.flush();
    return { success: true, message: "HARD RESET BERHASIL! Seluruh data pada " + count + " sheet telah dihapus, counter ID di-reset ke 0." };
  } catch (err) {
    return { success: false, message: "Gagal reset total: " + err.message };
  } finally {
    lock.releaseLock();
  }
}

function clearDataRows_(sheetName) {
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow > 1 && lastColumn > 0) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).clearContent();
  }
}

// PIN HAK AKSES PERAN
const PIN_STAFF   = "1234";
const PIN_MANAGER = "8888";

// ============ WEB APP ENTRY POINT (PURE REST API ENGINE) ============
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Dua SiSi POS — REST API Engine",
    version: "2.5",
    frontendUrl: "Vercel deployment",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============ REST API ROUTER FOR EXTERNAL FRONTEND (GitHub Pages / Vercel PWA) ============
function doPost(e) {
  let result = null;
  try {
    let request = {};
    if (e && e.postData && e.postData.contents) {
      request = JSON.parse(e.postData.contents);
    }
    const rawAction = request.action;
    const rawArgs = request.args || [];

    // Sanitize action & arguments against SQL / Method Injection
    const action = typeof rawAction === 'string' ? rawAction.replace(/[^a-zA-Z0-9_]/g, '') : '';
    const args = Array.isArray(rawArgs) ? rawArgs.map(sanitizeValue) : [];

    if (!ALLOWED_API_ACTIONS[action]) {
      throw new Error("Action tidak diizinkan melalui API publik.");
    }

    const session = PUBLIC_API_ACTIONS[action] ? null : verifySessionToken_(request.sessionToken);
    if (!PUBLIC_API_ACTIONS[action] && !session) {
      throw new Error("Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.");
    }
    if (MANAGER_API_ACTIONS[action] && session.role !== "MANAGER") {
      throw new Error("Akses ditolak. Action ini khusus Manager/Owner.");
    }

    const targetFn = (typeof globalThis !== 'undefined' && typeof globalThis[action] === 'function') 
      ? globalThis[action] 
      : (typeof this !== 'undefined' && typeof this[action] === 'function') ? this[action] : null;

    if (targetFn) {
      result = targetFn.apply(null, args);
    } else {
      result = { error: true, message: "Action '" + action + "' tidak ditemukan." };
    }
  } catch (err) {
    result = { error: true, message: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// PRIORITY CONFIGURATION
// ============================================================
function getPriorityConfig() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("PRIORITY_LEVELS");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch(e) {}
  }
  return [
    { id: "p1", nama: "Reguler", sla: 48, multiplier: 1.0 },
    { id: "p2", nama: "Express", sla: 24, multiplier: 1.5 },
    { id: "p3", nama: "Kilat", sla: 6, multiplier: 2.0 }
  ];
}

function savePriorityConfig(config) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty("PRIORITY_LEVELS", JSON.stringify(config));
    return { success: true, message: "Level prioritas berhasil disimpan!" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function updateMasterShift(id, data) {
  const sh = SS.getSheetByName(SHEET_SHIFT);
  if (!sh) return { success: false, message: "Sheet Master Shift belum ada." };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, 2, 1, 4).setValues([[data.nama, data.jamMasuk, data.jamKeluar, data.keterangan || ""]]);
      return { success: true };
    }
  }
  return { success: false, message: "Shift tidak ditemukan" };
}

// ============================================================
// ABSENSI CONFIGURATION
// ============================================================
function getAbsensiConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    jamBuka: props.getProperty("ABSENSI_JAM_BUKA") || "07:00",
    toleransiTelatMenit: Number(props.getProperty("ABSENSI_TOLERANSI_MENIT") || 15)
  };
}

function saveAbsensiConfig(jamBuka, toleransiMenit) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty("ABSENSI_JAM_BUKA", jamBuka || "07:00");
    props.setProperty("ABSENSI_TOLERANSI_MENIT", String(Number(toleransiMenit) || 0));
    return { success: true, message: "Konfigurasi absensi berhasil disimpan!" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}
