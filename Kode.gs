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
const TIMEZONE_WIB    = "Asia/Jakarta";
const MIGRATION_KEY   = "SPREADSHEET_SCHEMA_VERSION";

// Hanya fungsi bisnis berikut yang boleh dipanggil melalui Web App.
// Fungsi maintenance/destruktif (reset, seed, setup, migration) sengaja tidak diekspos.
const ALLOWED_API_ACTIONS = Object.freeze({
  verifikasiPin: true,
  getLayananList: true, getLayananListAll: true, tambahLayanan: true, updateLayanan: true, toggleAktifLayanan: true, hapusLayanan: true,
  getInventoryList: true, tambahInventory: true, updateStokInventory: true, hapusInventory: true,
  getMesinList: true, tambahMesin: true, mulaiPakaiMesin: true, selesaiMesin: true, setMaintenanceMesin: true, hapusMesin: true,
  simpanTransaksi: true, pelunasanDP: true,
  getPromoList: true, tambahPromo: true, hapusPromo: true, validasiVoucher: true,
  simpanPelangganJikaBaru: true, cariPelangganByHp: true, getDaftarPelanggan: true, updateDataPelanggan: true, getRiwayatPelangganByHp: true,
  getPipelineSteps: true, updateDropoffStatus: true, getTransaksiList: true, getTransaksiByNota: true, getTransaksiByPipeline: true,
  getLaporanRange: true, getPegawaiList: true, tambahPegawai: true, hapusPegawai: true, getRekapKinerjaPegawai: true,
  clockInPegawai: true, clockOutPegawai: true, getStatusAbsensiHariIni: true, getRekapAbsensi: true,
  getMasterShiftList: true, tambahMasterShift: true, hapusMasterShift: true,
  getKasShiftAktif: true, openKasShift: true, handoverCheckKasShift: true, closeKasShift: true, getRekapKasShift: true,
  getAuditLogs: true, ajukanVoidTransaksi: true, approveVoidTransaksi: true
});
const PUBLIC_API_ACTIONS = Object.freeze({ verifikasiPin: true, getTransaksiByNota: true });
const MANAGER_API_ACTIONS = Object.freeze({
  tambahLayanan: true, updateLayanan: true, toggleAktifLayanan: true, hapusLayanan: true,
  tambahInventory: true, hapusInventory: true,
  tambahMesin: true, hapusMesin: true,
  tambahPromo: true, hapusPromo: true,
  tambahPegawai: true, hapusPegawai: true,
  tambahMasterShift: true, hapusMasterShift: true,
  getLaporanRange: true, getAuditLogs: true, approveVoidTransaksi: true, getRekapKasShift: true
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

// ============ HELPER ============
function getWibTimeZone() { return TIMEZONE_WIB; }

/**
 * ID terurut dan mudah dibaca: ID-YYYYMMDD-NNNN.
 * Counter disimpan di Script Properties agar tetap unik antar request.
 */
function generateId(prefix) {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), TIMEZONE_WIB, "yyyyMMdd");
  const key = "ID_COUNTER_" + today;
  const next = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(next));
  return (prefix || "ID") + "-" + today + "-" + String(next).padStart(4, "0");
}

/** Migrasi satu kali ID lama menjadi ID ber-prefix tanpa menghapus data. */
function migrasiIdTerstruktur() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const entities = [
      { sheet: SHEET_LAYANAN, prefix: "SVC" },
      { sheet: SHEET_INVENTORY, prefix: "INV" },
      { sheet: SHEET_MESIN, prefix: "MCH" },
      { sheet: SHEET_PEGAWAI, prefix: "EMP" },
      { sheet: SHEET_ABSENSI, prefix: "ABS" },
      { sheet: SHEET_SHIFT, prefix: "SFT" },
      { sheet: SHEET_PIPELINE, prefix: "PIP" },
      { sheet: SHEET_PROMO, prefix: "PRM" },
      { sheet: SHEET_AUDIT, prefix: "LOG" }
    ];
    const result = {};
    entities.forEach(function(entity) {
      const sheet = SS.getSheetByName(entity.sheet);
      if (!sheet || sheet.getLastRow() < 2) { result[entity.sheet] = 0; return; }
      const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      let changed = 0;
      values.forEach(function(row, index) {
        const current = String(row[0] || "");
        if (!current.startsWith(entity.prefix + "-")) {
          sheet.getRange(index + 2, 1).setValue(generateId(entity.prefix));
          changed++;
        }
      });
      result[entity.sheet] = changed;
    });
    SpreadsheetApp.flush();
    return { success: true, updated: result, message: "Migrasi ID terstruktur selesai." };
  } finally {
    lock.releaseLock();
  }
}

function fmtWib(date, pattern) {
  if (!date) return "";
  let d;
  if (typeof date === "string") {
    const parts = date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
      const timeParts = date.match(/(\d{2}):(\d{2})/);
      const hh = timeParts ? parseInt(timeParts[1], 10) : 0;
      const mm = timeParts ? parseInt(timeParts[2], 10) : 0;
      d = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10), hh, mm);
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return String(date);
  return Utilities.formatDate(d, TIMEZONE_WIB, pattern || "dd/MM/yyyy HH:mm 'WIB'");
}

function getSessionSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("SESSION_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("SESSION_SECRET", secret);
  }
  return secret;
}

function signSessionPayload_(payload) {
  const signature = Utilities.computeHmacSha256Signature(payload, getSessionSecret_());
  return Utilities.base64EncodeWebSafe(signature).replace(/=+$/, "");
}

function createSessionToken_(role, label) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    role: role,
    label: label,
    exp: Date.now() + (30 * 60 * 1000)
  })).replace(/=+$/, "");
  return payload + "." + signSessionPayload_(payload);
}

function verifySessionToken_(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 2 || signSessionPayload_(parts[0]) !== parts[1]) return null;
    const data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!data.exp || Number(data.exp) < Date.now() || ["STAFF", "MANAGER"].indexOf(data.role) === -1) return null;
    return data;
  } catch (error) {
    return null;
  }
}

function verifikasiPin(pin) {
  const props = PropertiesService.getScriptProperties();
  const managerPin = props.getProperty("PIN_MANAGER") || PIN_MANAGER;
  const staffPin = props.getProperty("PIN_STAFF") || PIN_STAFF;
  if (String(pin) === managerPin) return { success: true, role: "MANAGER", label: "Manager / Owner", sessionToken: createSessionToken_("MANAGER", "Manager / Owner") };
  if (String(pin) === staffPin) return { success: true, role: "STAFF", label: "Staff / Kasir", sessionToken: createSessionToken_("STAFF", "Staff / Kasir") };
  return { success: false, message: "PIN Salah! Akses Ditolak." };
}

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

// ============ SECURITY & SANITIZATION ENGINE (ANTI-SQL/FORMULA INJECTION) ============
function sanitizeValue(val) {
  if (typeof val === 'string') {
    let s = val;
    // 1. Prevent Formula / Command Injection in Google Sheets (=, +, -, @)
    if (s.length > 0 && ('=+-@').indexOf(s.charAt(0)) !== -1) {
      s = "'" + s;
    }
    // 2. Strip dangerous HTML script tags and null bytes
    s = s.replace(/\0/g, '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return s;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === 'object') {
    let cleanObj = {};
    for (let k in val) {
      if (Object.prototype.hasOwnProperty.call(val, k)) {
        cleanObj[sanitizeValue(k)] = sanitizeValue(val[k]);
      }
    }
    return cleanObj;
  }
  return val;
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
// IDEMPOTENT SPREADSHEET MIGRATIONS
// Dipanggil otomatis oleh CI setelah Apps Script deployment.
// Tidak menghapus isi sheet atau menggandakan header.
// ============================================================
function runMigrations() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    let version = Number(props.getProperty(MIGRATION_KEY) || 0);
    const migrations = [
      function v1() {
        const schemas = {
          Transaksi: ["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe"],
          TransaksiDetail: ["No Nota", "Layanan", "Qty", "Harga Satuan", "Subtotal"],
          Pelanggan: ["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan"],
          Layanan: ["ID", "Nama Layanan", "Harga", "Satuan", "Icon", "Aktif", "Tipe"],
          Inventory: ["ID", "Nama Barang", "Stok", "Satuan", "Stok Minimum", "Terakhir Update"],
          Mesin: ["ID", "Nama Mesin", "Tipe", "Status", "Keterangan", "Mulai Pakai", "Estimasi Selesai"],
          Pegawai: ["ID", "Nama Pegawai", "No HP", "Jabatan", "Status", "Tanggal Bergabung"],
          Absensi: ["ID", "Tanggal", "Nama Pegawai", "Shift", "Clock In", "Clock Out", "Durasi Kerja", "Catatan"],
          MasterShift: ["ID", "Nama Shift", "Jam Masuk", "Jam Keluar", "Keterangan"],
          Pipeline: ["ID", "No Nota", "Step", "Nama Step", "Status", "Assigned Staff", "Mesin ID", "Waktu Mulai", "Waktu Selesai", "Catatan"],
          Promo: ["ID", "Kode Voucher", "Jenis Diskon", "Nilai Diskon", "Min Transaksi", "Periode Selesai", "Kuota", "Terpakai", "Status Aktif"],
          AuditLog: ["ID", "Timestamp", "Nama User", "Jenis Aktivitas", "Referensi", "Detail"]
        };
        Object.keys(schemas).forEach(function(name) { ensureSheetSchema_(name, schemas[name]); });
      },
      function v2() {
        // Kolom lifecycle fisik untuk drop-off; hanya ditambahkan bila belum ada.
        ensureSheetSchema_(SHEET_PIPELINE, ["ID", "No Nota", "Step", "Nama Step", "Status", "Assigned Staff", "Mesin ID", "Waktu Mulai", "Waktu Selesai", "Catatan", "Washer ID", "Dryer ID"]);
        ensureSheetSchema_(SHEET_TRANSAKSI, ["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe", "Status Void", "Alasan Void"]);
      },
      function v3() {
        ensureSheetSchema_(SHEET_TRANSAKSI, ["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe", "Status Void", "Alasan Void", "Subtotal", "Diskon", "Metode Pembayaran", "Status Pembayaran", "Nominal Bayar", "Sisa Tagihan", "Referensi Pembayaran", "Catatan"]);
      },
      function v4() {
        ensureSheetSchema_(SHEET_KAS_SHIFT, ["ID Kas Shift", "Outlet", "Nama Penanggung Jawab", "ID Penanggung Jawab", "Waktu Buka", "Waktu Tutup", "Kas Awal", "Kas Akhir Sistem", "Kas Akhir Fisik", "Selisih", "Status", "Mode Tutup", "ID Pengganti", "Nama Pengganti", "Waktu Handover", "Catatan"]);
      },
      function v5() {
        ensureSheetSchema_(SHEET_TRANSAKSI, ["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe", "Status Void", "Alasan Void", "Subtotal", "Diskon", "Metode Pembayaran", "Status Pembayaran", "Nominal Bayar", "Sisa Tagihan", "Referensi Pembayaran", "Catatan", "Prioritas"]);
      }
    ];
    for (let i = version; i < migrations.length; i++) { migrations[i](); version = i + 1; props.setProperty(MIGRATION_KEY, String(version)); }
    return { success: true, version: version };
  } finally { lock.releaseLock(); }
}

function ensureSheetSchema_(name, headers) {
  let sh = SS.getSheetByName(name);
  if (!sh) sh = SS.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, headers.length).setValues([headers]); return; }
  const existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  headers.forEach(function(header) { if (existing.indexOf(header) === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue(header); existing.push(header); } });
}

// ============================================================
// PIPELINE CONFIG
// ============================================================
function getLegacyPipelineConfig_(tipe) {
  if (tipe === "FullService") {
    return [
      { step: 1, nama: "Diterima",           icon: "📥", needStaff: false, needMesin: false },
      { step: 2, nama: "Timbang & Sorting",   icon: "⚖️", needStaff: true,  needMesin: false },
      { step: 3, nama: "Cuci",                icon: "🫧", needStaff: true,  needMesin: true  },
      { step: 4, nama: "Pengeringan",          icon: "♨️", needStaff: true,  needMesin: true  },
      { step: 5, nama: "Setrika",              icon: "👔", needStaff: true,  needMesin: false },
      { step: 6, nama: "Lipat & Packing",      icon: "📦", needStaff: true,  needMesin: false },
      { step: 7, nama: "Siap Ambil",           icon: "✅", needStaff: false, needMesin: false },
      { step: 8, nama: "Selesai",              icon: "🏁", needStaff: false, needMesin: false }
    ];
  }
  // SelfService
  return [
    { step: 1, nama: "Diterima",  icon: "📥", needStaff: false, needMesin: false },
    { step: 2, nama: "Washer",    icon: "🫧", needStaff: false, needMesin: true  },
    { step: 3, nama: "Dryer",     icon: "♨️", needStaff: false, needMesin: true  },
    { step: 4, nama: "Selesai",   icon: "🏁", needStaff: false, needMesin: false }
  ];
}

function getPipelineConfig(tipe) {
  if (tipe === "FullService") {
    return [
      { step: 1, nama: "Diterima", needStaff: false, needMesin: false },
      { step: 2, nama: "Dicuci", needStaff: true, needMesin: true },
      { step: 3, nama: "Dikeringkan", needStaff: true, needMesin: true },
      { step: 4, nama: "Disetrika", needStaff: true, needMesin: false },
      { step: 5, nama: "Siap Diambil", needStaff: false, needMesin: false },
      { step: 6, nama: "Selesai", needStaff: false, needMesin: false }
    ];
  }
  return getLegacyPipelineConfig_(tipe);
}

// ============================================================
// SETUP AWAL
// ============================================================
function setupSheets() {
  // Transaksi — added Tipe column
  let sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) sh = SS.insertSheet(SHEET_TRANSAKSI);
  sh.clear();
  sh.appendRow(["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe"]);

  let shD = SS.getSheetByName(SHEET_DETAIL);
  if (!shD) shD = SS.insertSheet(SHEET_DETAIL);
  shD.clear();
  shD.appendRow(["No Nota", "Layanan", "Qty", "Harga Satuan", "Subtotal"]);

  let shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) shP = SS.insertSheet(SHEET_PELANGGAN);
  shP.clear();
  shP.appendRow(["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan"]);

  // Layanan — added Tipe column (SelfService / FullService / Tambahan)
  let shL = SS.getSheetByName(SHEET_LAYANAN);
  if (!shL) shL = SS.insertSheet(SHEET_LAYANAN);
  shL.clear();
  shL.appendRow(["ID", "Nama Layanan", "Harga", "Satuan", "Icon", "Aktif", "Tipe"]);
  // Self Service
  shL.appendRow([generateId(), "Cuci 7,5 Kg", 10000, "paket", "🫧", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Cuci 4,5 Kg", 7000, "paket", "🫧", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Cuci + Kering 7,5 Kg (45 Mnt)", 18000, "paket", "🧺", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Cuci + Kering 4,5 Kg (45 Mnt)", 13000, "paket", "🧺", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Pengering (15 Menit)", 5000, "paket", "♨️", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Deterjen Cair", 1000, "porsi", "🧴", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Softener", 1000, "porsi", "🌸", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Deterjen Sachet", 1500, "sachet", "🧴", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Softener Sachet", 1500, "sachet", "🌸", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Kresek Besar", 1000, "pcs", "🛍️", "Y", "SelfService"]);
  // Full Service
  shL.appendRow([generateId(), "Cuci Lipat", 7000, "kg", "👕", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Setrika", 10000, "kg", "👔", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Setrika Express (6 Jam)", 18000, "kg", "⚡", "Y", "FullService"]);
  shL.appendRow([generateId(), "Setrika Saja", 5000, "kg", "👔", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Bed Cover (Kecil)", 25000, "pcs", "🛏️", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Bed Cover (Besar)", 35000, "pcs", "🛏️", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Karpet /m²", 15000, "m²", "🧹", "Y", "FullService"]);

  let shI = SS.getSheetByName(SHEET_INVENTORY);
  if (!shI) shI = SS.insertSheet(SHEET_INVENTORY);
  shI.clear();
  shI.appendRow(["ID", "Nama Barang", "Stok", "Satuan", "Stok Minimum", "Terakhir Update"]);
  shI.appendRow([generateId(), "Deterjen Cair", 20, "liter", 5, new Date()]);
  shI.appendRow([generateId(), "Pewangi Pakaian", 15, "liter", 5, new Date()]);
  shI.appendRow([generateId(), "Plastik Packing", 200, "pcs", 50, new Date()]);

  let shM = SS.getSheetByName(SHEET_MESIN);
  if (!shM) shM = SS.insertSheet(SHEET_MESIN);
  shM.clear();
  shM.appendRow(["ID", "Nama Mesin", "Tipe", "Status", "Keterangan", "Mulai Pakai", "Estimasi Selesai"]);
  shM.appendRow([generateId(), "Mesin Cuci 1", "Washer", "Kosong", "", "", ""]);
  shM.appendRow([generateId(), "Mesin Cuci 2", "Washer", "Kosong", "", "", ""]);
  shM.appendRow([generateId(), "Mesin Cuci 3", "Washer", "Kosong", "", "", ""]);
  shM.appendRow([generateId(), "Dryer 1", "Dryer", "Kosong", "", "", ""]);
  shM.appendRow([generateId(), "Dryer 2", "Dryer", "Kosong", "", "", ""]);

  let shPeg = SS.getSheetByName(SHEET_PEGAWAI);
  if (!shPeg) shPeg = SS.insertSheet(SHEET_PEGAWAI);
  shPeg.clear();
  shPeg.appendRow(["ID", "Nama Pegawai", "No HP", "Jabatan", "Status", "Tanggal Bergabung"]);
  shPeg.appendRow([generateId(), "Budi Santoso", "08123456789", "Operator Laundry", "Aktif", new Date()]);
  shPeg.appendRow([generateId(), "Siti Rahma", "08987654321", "Kasir", "Aktif", new Date()]);

  let shAbs = SS.getSheetByName(SHEET_ABSENSI);
  if (!shAbs) shAbs = SS.insertSheet(SHEET_ABSENSI);
  shAbs.clear();
  shAbs.appendRow(["ID", "Tanggal", "Nama Pegawai", "Shift", "Clock In", "Clock Out", "Durasi Kerja", "Catatan"]);

  let shS = SS.getSheetByName(SHEET_SHIFT);
  if (!shS) shS = SS.insertSheet(SHEET_SHIFT);
  shS.clear();
  shS.appendRow(["ID", "Nama Shift", "Jam Masuk", "Jam Keluar", "Keterangan"]);
  shS.appendRow([generateId(), "Shift 1 (Pagi)", "07:00", "15:00", "Shift Pagi Utama"]);
  shS.appendRow([generateId(), "Shift 2 (Sore/Malam)", "15:00", "23:00", "Shift Sore/Malam Utama"]);

  // Pipeline
  let shPipe = SS.getSheetByName(SHEET_PIPELINE);
  if (!shPipe) shPipe = SS.insertSheet(SHEET_PIPELINE);
  shPipe.clear();
  shPipe.appendRow(["ID", "No Nota", "Step", "Nama Step", "Status", "Assigned Staff", "Mesin ID", "Waktu Mulai", "Waktu Selesai", "Catatan"]);

  Logger.log("✅ Setup v2.0 selesai! Semua sheet sudah dibuat.");
}

// ============================================================
// LAYANAN (CRUD) — with Tipe support
// ============================================================
function getLayananList(tipeFilter) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const data = sh.getDataRange().getValues();
  data.shift();
  let list = data.filter(r => r[5] === "Y");
  if (tipeFilter) list = list.filter(r => r[6] === tipeFilter);
  return list.map(r => ({ 
    id: r[0], 
    nama: r[1], 
    harga: Number(r[2]) || 0, 
    satuan: r[3], 
    icon: r[4] || "🧺", 
    tipe: r[6] || "SelfService" 
  }));
}

function getLayananListAll() {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const data = sh.getDataRange().getValues();
  data.shift();
  return data.map(r => ({ 
    id: r[0], 
    nama: r[1], 
    harga: Number(r[2]) || 0, 
    satuan: r[3], 
    icon: r[4] || "🧺", 
    aktif: r[5], 
    tipe: r[6] || "SelfService" 
  }));
}

function tambahLayanan(data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const id = generateId("SVC");
  sh.appendRow([id, data.nama, data.harga, data.satuan, data.icon || "🧺", "Y", data.tipe || "SelfService"]);
  return { success: true, id: id };
}

function updateLayanan(id, data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, 2, 1, 6).setValues([[data.nama, data.harga, data.satuan, data.icon || "🧺", rows[i][5], data.tipe || rows[i][6]]]);
      return { success: true };
    }
  }
  return { success: false, message: "Layanan tidak ditemukan" };
}

function toggleAktifLayanan(id, aktifBaru) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.getRange(i + 1, 6).setValue(aktifBaru ? "Y" : "N"); return true; }
  }
  return false;
}

function hapusLayanan(id) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

function resetLayananSelfService() {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const data = sh.getDataRange().getValues();
  // Delete only SelfService rows (keep FullService)
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][6] === "SelfService") sh.deleteRow(i + 1);
  }
  sh.appendRow([generateId(), "Cuci 7,5 Kg", 10000, "paket", "🫧", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Cuci 4,5 Kg", 7000, "paket", "🫧", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Cuci + Kering 7,5 Kg (45 Mnt)", 18000, "paket", "🧺", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Cuci + Kering 4,5 Kg (45 Mnt)", 13000, "paket", "🧺", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Pengering (15 Menit)", 5000, "paket", "♨️", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Deterjen Cair", 1000, "porsi", "🧴", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Softener", 1000, "porsi", "🌸", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Deterjen Sachet", 1500, "sachet", "🧴", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Softener Sachet", 1500, "sachet", "🌸", "Y", "SelfService"]);
  sh.appendRow([generateId(), "Kresek Besar", 1000, "pcs", "🛍️", "Y", "SelfService"]);
  return true;
}

// ============================================================
// INVENTORY (CRUD)
// ============================================================
function getInventoryList() {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const data = sh.getDataRange().getValues();
  data.shift();
  return data.map(r => ({
    id: r[0], 
    nama: r[1], 
    stok: Number(r[2]) || 0, 
    satuan: r[3], 
    stokMinimum: Number(r[4]) || 0,
    terakhirUpdate: r[5] ? fmtWib(r[5], "dd/MM/yyyy HH:mm") : ""
  }));
}

function tambahInventory(data) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const id = generateId("INV");
  sh.appendRow([id, data.nama, data.stok, data.satuan, data.stokMinimum, new Date()]);
  return { success: true, id: id };
}

function updateStokInventory(id, perubahan) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const stokBaru = Math.max(0, Number(rows[i][2]) + Number(perubahan));
      sh.getRange(i + 1, 3).setValue(stokBaru);
      sh.getRange(i + 1, 6).setValue(new Date());
      return { success: true, stokBaru: stokBaru };
    }
  }
  return { success: false, message: "Inventory tidak ditemukan" };
}

function hapusInventory(id) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.deleteRow(i + 1); return { success: true }; }
  }
  return { success: false };
}

// ============================================================
// MESIN CUCI / DRYER
// ============================================================
function getMesinList() {
  const sh = SS.getSheetByName(SHEET_MESIN);
  const data = sh.getDataRange().getValues();
  data.shift();
  return data.map(r => ({
    id: r[0], nama: r[1], tipe: r[2], status: r[3], keterangan: r[4],
    mulaiPakai: r[5] ? fmtWib(r[5], "HH:mm") : "",
    estimasiSelesai: r[6] || ""
  }));
}

function tambahMesin(data) {
  const sh = SS.getSheetByName(SHEET_MESIN);
  const id = generateId("MCH");
  sh.appendRow([id, data.nama, data.tipe || "Washer", "Kosong", "", "", ""]);
  return { success: true, id: id };
}

function mulaiPakaiMesin(id, keterangan, estimasiSelesai) {
  const sh = SS.getSheetByName(SHEET_MESIN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, 4, 1, 4).setValues([["Digunakan", keterangan || "", new Date(), estimasiSelesai || ""]]);
      return true;
    }
  }
  return false;
}

function selesaiMesin(id) {
  const sh = SS.getSheetByName(SHEET_MESIN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, 4, 1, 4).setValues([["Kosong", "", "", ""]]);
      return true;
    }
  }
  return false;
}

function setMaintenanceMesin(id, aktifkan) {
  const sh = SS.getSheetByName(SHEET_MESIN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      if (aktifkan) sh.getRange(i + 1, 4, 1, 4).setValues([["Maintenance", "Perbaikan/servis", "", ""]]);
      else sh.getRange(i + 1, 4, 1, 4).setValues([["Kosong", "", "", ""]]);
      return true;
    }
  }
  return false;
}

function hapusMesin(id) {
  const sh = SS.getSheetByName(SHEET_MESIN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

// ============================================================
// TRANSAKSI (POS) — with Pipeline auto-create
// ============================================================
function generateNoNota() {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const today = fmtWib(new Date(), "yyMMdd");
  if (!sh) return "LDY-" + today + "-0001";
  const rows = sh.getDataRange().getValues();
  let maxCounter = 0;
  for (let i = 1; i < rows.length; i++) {
    const nota = String(rows[i][0]);
    if (nota.startsWith("LDY-" + today)) {
      const parts = nota.split("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxCounter) maxCounter = num;
    }
  }
  return "LDY-" + today + "-" + String(maxCounter + 1).padStart(4, "0");
}

function simpanTransaksi(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SS.getSheetByName(SHEET_TRANSAKSI);
    const shD = SS.getSheetByName(SHEET_DETAIL);
    if (!sh || !shD) throw new Error("Schema transaksi belum tersedia. Jalankan runMigrations dari editor Apps Script.");

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) throw new Error("Transaksi minimal memiliki satu item.");

    const detailRows = [];
    let subtotal = 0;
    items.forEach(function(item) {
      const qty = Number(item.qty);
      const harga = Number(item.hargaSatuan);
      if (!item.layanan || !isFinite(qty) || qty <= 0 || !isFinite(harga) || harga < 0) {
        throw new Error("Item transaksi tidak valid.");
      }
      const subtotalItem = qty * harga;
      subtotal += subtotalItem;
      detailRows.push(["", item.layanan, qty, harga, subtotalItem]);
    });

    const diskon = Math.max(0, Math.min(Number(data.diskon) || 0, subtotal));
    const total = subtotal - diskon;
    const nominalBayar = Number(data.nominalBayar);
    if (!isFinite(nominalBayar) || nominalBayar < 0) throw new Error("Nominal pembayaran tidak valid.");

    const tipe = data.tipe || data.tipeLayanan || "SelfService";
    const status = tipe === "FullService" ? "Diterima" : "Selesai";
    const sisaTagihan = Math.max(0, total - nominalBayar);
    const statusPembayaran = sisaTagihan === 0 ? "Lunas" : nominalBayar > 0 ? "DP" : "Belum Bayar";
    const petugas = data.petugas || data.kasir || data.namaPetugas || "Kasir";
    const noNota = (data.noNota && !String(data.noNota).startsWith('OFF-') && !String(data.noNota).startsWith('TRX-')) ? String(data.noNota) : generateNoNota();
    const tanggal = data.tanggal ? new Date(data.tanggal) : new Date();

    const duplicate = sh.getDataRange().getValues().some(function(row, index) { return index > 0 && String(row[0]) === noNota; });
    if (duplicate) throw new Error("Nomor nota sudah digunakan.");

    detailRows.forEach(function(row) { row[0] = noNota; });
    shD.getRange(shD.getLastRow() + 1, 1, detailRows.length, 5).setValues(detailRows);
    sh.appendRow([
      noNota, tanggal, data.namaPelanggan || data.pelanggan || "Pelanggan Umum", data.noHp || "",
      total, status, data.estimasiSelesai || data.estimasi || "", petugas, tipe,
      "None", "", subtotal, diskon, data.metodeBayar || "Tunai", statusPembayaran,
      nominalBayar, sisaTagihan, data.referensiPembayaran || "", data.catatan || "", data.tingkatLayanan || data.prioritas || "Reguler"
    ]);

    simpanPelangganJikaBaru(data.namaPelanggan || data.pelanggan, data.noHp, data.alamat || "", total, data.catatanPelanggan || "");
    if (tipe === "FullService") createPipelineForNota(noNota, tipe);
    addAuditLog(petugas, "Transaksi Baru", noNota, "Total Rp " + total.toLocaleString('id-ID') + " (" + (data.metodeBayar || "Tunai") + ", " + statusPembayaran + ")");
    SpreadsheetApp.flush();
    var notaToken = generateNotaToken_(noNota);
    return { success: true, noNota: noNota, token: notaToken, total: total, subtotal: subtotal, diskon: diskon, nominalBayar: nominalBayar, sisaTagihan: sisaTagihan, statusPembayaran: statusPembayaran, jumlahItem: items.length, tipe: tipe };
  } finally {
    lock.releaseLock();
  }
}

function pelunasanDP(noNota, nominal, metode) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) return { success: false, message: "Sheet Transaksi tidak ditemukan." };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === noNota) {
      const bayar = Number(nominal);
      const total = Number(rows[i][4]) || 0;
      const sudahBayar = Number(rows[i][15]) || 0;
      const sisaSaatIni = Number(rows[i][16]) || Math.max(0, total - sudahBayar);
      if (!isFinite(bayar) || bayar <= 0) return { success: false, message: "Nominal pelunasan harus lebih dari 0" };
      if (bayar > sisaSaatIni) return { success: false, message: "Nominal melebihi sisa tagihan" };
      const totalDibayar = sudahBayar + bayar;
      const sisaBaru = Math.max(0, total - totalDibayar);
      sh.getRange(i + 1, 14).setValue(metode || "Tunai");
      sh.getRange(i + 1, 15).setValue(sisaBaru === 0 ? "Lunas" : "DP");
      sh.getRange(i + 1, 16).setValue(totalDibayar);
      sh.getRange(i + 1, 17).setValue(sisaBaru);
      addAuditLog("Kasir", "Pelunasan Nota", noNota, "Pembayaran Rp " + bayar.toLocaleString('id-ID') + " via " + (metode || "Tunai") + "; sisa Rp " + sisaBaru.toLocaleString('id-ID'));
      return { success: true, nominalBayar: totalDibayar, sisaTagihan: sisaBaru, statusPembayaran: sisaBaru === 0 ? "Lunas" : "DP", message: "Pembayaran nota " + noNota + " berhasil disimpan!" };
    }
  }
  return { success: false, message: "Nota " + noNota + " tidak ditemukan." };
}

// ============================================================
// PROMO & VOUCHER ENGINE
// ============================================================
function getPromoList() {
  let sh = SS.getSheetByName(SHEET_PROMO);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PROMO);
    sh.appendRow(["ID", "Kode Voucher", "Jenis Diskon", "Nilai Diskon", "Min Transaksi", "Status"]);
    sh.appendRow([generateId(), "HEMAT10", "Persen", 10, 50000, "Aktif"]);
    sh.appendRow([generateId(), "DUASISI", "Nominal", 5000, 30000, "Aktif"]);
  }
  const data = sh.getDataRange().getValues(); data.shift();
  return data.map(r => ({
    idPromo: r[0],
    kodeVoucher: r[1],
    jenisDiskon: r[2],
    nilaiDiskon: Number(r[3]) || 0,
    minTransaksi: Number(r[4]) || 0,
    statusAktif: r[5] === "Aktif"
  }));
}

function tambahPromo(data) {
  let sh = SS.getSheetByName(SHEET_PROMO);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PROMO);
    sh.appendRow(["ID", "Kode Voucher", "Jenis Diskon", "Nilai Diskon", "Min Transaksi", "Status"]);
  }
  const id = generateId("PRM");
  const kode = String(data.kodeVoucher).trim().toUpperCase();
  sh.appendRow([id, kode, data.jenisDiskon || "Nominal", Number(data.nilaiDiskon) || 0, Number(data.minTransaksi) || 0, "Aktif"]);
  return { success: true, idPromo: id };
}

function hapusPromo(id) {
  const sh = SS.getSheetByName(SHEET_PROMO);
  if (!sh) return { success: false };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.deleteRow(i + 1); return { success: true }; }
  }
  return { success: false };
}

function validasiVoucher(kodeInput, subtotal) {
  if (!kodeInput) return { valid: false, message: "Kode voucher kosong" };
  const code = String(kodeInput).trim().toUpperCase();
  const list = getPromoList();
  const found = list.find(p => p.kodeVoucher === code && p.statusAktif);
  if (!found) return { valid: false, message: "Kode voucher tidak valid / tidak aktif" };
  if (Number(subtotal) < found.minTransaksi) {
    return { valid: false, message: "Minimal transaksi Rp " + found.minTransaksi.toLocaleString('id-ID') };
  }
  let nilaiDiskon = 0;
  if (found.jenisDiskon === "Persen") {
    nilaiDiskon = Math.round(Number(subtotal) * (found.nilaiDiskon / 100));
  } else {
    nilaiDiskon = found.nilaiDiskon;
  }
  return { valid: true, kode: code, nilai: nilaiDiskon, message: "Voucher " + code + " berhasil dipasang!" };
}

// ============================================================
// PELANGGAN ENGINE (UNIQUE BY NO HP & REPEAT ORDER ANALYTICS)
// ============================================================

// ============================================================
// PELANGGAN ENGINE (UNIQUE BY NO HP & REPEAT ORDER ANALYTICS)
// ============================================================

function normalizePhone(hp) {
  if (!hp) return "";
  let clean = String(hp).replace(/[^0-9]/g, "");
  if (clean.startsWith("62")) clean = "0" + clean.substring(2);
  else if (clean.startsWith("8")) clean = "0" + clean;
  return clean;
}

function maskPhone(hp) {
  const norm = normalizePhone(hp);
  if (norm.length >= 10) {
    const prefix = norm.substring(0, 4);
    const suffix = norm.substring(norm.length - 4);
    return `${prefix}*****${suffix}`;
  }
  return norm;
}

function simpanPelangganJikaBaru(nama, noHp, alamat, totalBelanja, catatan) {
  if (!noHp) return;
  const cleanHp = normalizePhone(noHp);
  if (!cleanHp || cleanHp.length < 9) return;

  let shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) {
    shP = SS.insertSheet(SHEET_PELANGGAN);
    shP.appendRow(["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan"]);
  }

  const data = shP.getDataRange().getValues();
  let foundRowIdx = -1;

  for (let i = 1; i < data.length; i++) {
    const rowHp = normalizePhone(data[i][0]);
    if (rowHp === cleanHp) {
      foundRowIdx = i + 1;
      break;
    }
  }

  const now = new Date();
  const spend = Number(totalBelanja) || 0;

  if (foundRowIdx > 0) {
    // Update existing customer stats
    const currentName = data[foundRowIdx - 1][1];
    const currentAddr = data[foundRowIdx - 1][2];
    const currentTxCount = Number(data[foundRowIdx - 1][4]) || 0;
    const currentSpend = Number(data[foundRowIdx - 1][5]) || 0;
    const currentNotes = data[foundRowIdx - 1][7] || "";

    if (nama && nama.trim()) shP.getRange(foundRowIdx, 2).setValue(nama.trim());
    if (alamat && alamat.trim()) shP.getRange(foundRowIdx, 3).setValue(alamat.trim());
    shP.getRange(foundRowIdx, 5).setValue(currentTxCount + 1);
    shP.getRange(foundRowIdx, 6).setValue(currentSpend + spend);
    shP.getRange(foundRowIdx, 7).setValue(now);
    if (catatan && catatan.trim()) shP.getRange(foundRowIdx, 8).setValue(catatan.trim());
  } else {
    // Insert new customer record
    // ["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan"]
    shP.appendRow([cleanHp, nama ? nama.trim() : "Pelanggan Baru", alamat || "", now, 1, spend, now, catatan || ""]);
  }
}

function cariPelangganByHp(queryStr) {
  if (!queryStr) return { found: false, message: "Pencarian kosong", matches: [] };
  const raw = String(queryStr).trim();
  const cleanDigits = normalizePhone(raw);
  const qUpper = raw.toUpperCase();

  const shP = SS.getSheetByName(SHEET_PELANGGAN);
  const pData = shP ? shP.getDataRange().getValues() : [];
  if (pData.length > 0) pData.shift();

  let matches = [];

  pData.forEach(r => {
    const hp = normalizePhone(r[0]);
    const nama = String(r[1] || "");
    const alamat = String(r[2] || "");
    const tglDaftar = r[3] ? fmtWib(r[3], "dd/MM/yyyy") : "";
    const totalTx = Number(r[4]) || 0;
    const totalSpend = Number(r[5]) || 0;
    const terakhir = r[6] ? fmtWib(r[6], "dd/MM/yyyy HH:mm") : "";
    const catatan = String(r[7] || "");

    if (!hp) return;

    // Match conditions:
    // 1. Clean phone ends with 4-digit or query
    // 2. Clean phone includes query
    // 3. Customer name includes query (case insensitive)
    const matchesPhoneLast4 = cleanDigits.length >= 3 && hp.endsWith(cleanDigits);
    const matchesPhoneFull = cleanDigits.length >= 3 && hp.includes(cleanDigits);
    const matchesName = qUpper.length >= 2 && nama.toUpperCase().includes(qUpper);

    if (matchesPhoneLast4 || matchesPhoneFull || matchesName) {
      matches.push({
        noHp: hp,
        maskedHp: maskPhone(hp),
        nama: nama,
        alamat: alamat,
        tglDaftar: tglDaftar,
        totalOrder: totalTx,
        totalSpend: totalSpend,
        terakhirOrder: terakhir,
        catatan: catatan,
        isRepeatOrder: totalTx > 1
      });
    }
  });

  // Sort matches by highest total spend & last order date
  matches.sort((a, b) => b.totalSpend - a.totalSpend);

  if (matches.length > 0) {
    return {
      found: true,
      count: matches.length,
      bestMatch: matches[0],
      matches: matches
    };
  }

  return { found: false, count: 0, matches: [], message: "Pelanggan tidak ditemukan, silakan input sebagai pelanggan baru." };
}

function getDaftarPelanggan() {
  const shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) return [];
  const pData = shP.getDataRange().getValues();
  if (pData.length === 0) return [];
  pData.shift();

  return pData.map(r => {
    const hp = normalizePhone(r[0]);
    return {
      noHp: hp,
      maskedHp: maskPhone(hp),
      nama: r[1] || "Pelanggan",
      alamat: r[2] || "",
      tglDaftar: r[3] ? fmtWib(r[3], "dd/MM/yyyy") : "",
      totalOrder: Number(r[4]) || 0,
      totalSpend: Number(r[5]) || 0,
      terakhirOrder: r[6] ? fmtWib(r[6], "dd/MM/yyyy HH:mm") : "",
      catatan: r[7] || "",
      isRepeatOrder: (Number(r[4]) || 0) > 1
    };
  });
}

function updateDataPelanggan(oldHp, newHp, nama, alamat, catatan) {
  const shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) return { success: false, message: "Sheet Pelanggan tidak ada." };
  
  const cleanOld = normalizePhone(oldHp);
  const cleanNew = normalizePhone(newHp || oldHp);

  const rows = shP.getDataRange().getValues();
  let targetRowIdx = -1;

  for (let i = 1; i < rows.length; i++) {
    if (normalizePhone(rows[i][0]) === cleanOld) {
      targetRowIdx = i + 1;
      break;
    }
  }

  if (targetRowIdx === -1) return { success: false, message: "Pelanggan tidak ditemukan." };

  // Update row
  shP.getRange(targetRowIdx, 1).setValue(cleanNew);
  if (nama && nama.trim()) shP.getRange(targetRowIdx, 2).setValue(nama.trim());
  if (alamat !== undefined) shP.getRange(targetRowIdx, 3).setValue(alamat.trim());
  if (catatan !== undefined) shP.getRange(targetRowIdx, 8).setValue(catatan.trim());

  // Also update transaction records if phone changed
  if (cleanOld !== cleanNew) {
    const shT = SS.getSheetByName(SHEET_TRANSAKSI);
    if (shT) {
      const tData = shT.getDataRange().getValues();
      for (let i = 1; i < tData.length; i++) {
        if (normalizePhone(tData[i][3]) === cleanOld) {
          shT.getRange(i + 1, 4).setValue(cleanNew);
        }
      }
    }
  }

  addAuditLog("Manager", "Update Pelanggan", cleanNew, "Edit data pelanggan " + (nama || cleanNew));
  return { success: true, message: "Data pelanggan berhasil diperbarui!" };
}

function getRiwayatPelangganByHp(noHp) {
  const cleanHp = normalizePhone(noHp);
  if (!cleanHp) return [];

  const shT = SS.getSheetByName(SHEET_TRANSAKSI);
  const shD = SS.getSheetByName(SHEET_DETAIL);

  const dataHeader = shT ? shT.getDataRange().getValues() : []; dataHeader.shift();
  const dataDetail = shD ? shD.getDataRange().getValues() : []; dataDetail.shift();

  const filtered = dataHeader.filter(r => normalizePhone(r[3]) === cleanHp);

  return filtered.map(r => {
    const items = dataDetail.filter(d => d[0] === r[0]).map(d => ({ layanan: d[1], qty: d[2], subtotal: d[4] }));
    return {
      noNota: r[0], tanggal: fmtWib(r[1]), total: r[4], status: r[5], tipe: r[8] || "SelfService", items: items
    };
  }).reverse();
}

// ============================================================
// PIPELINE ENGINE
// ============================================================
function createPipelineForNota(noNota, tipe) {
  let sh = SS.getSheetByName(SHEET_PIPELINE);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PIPELINE);
    sh.appendRow(["ID", "No Nota", "Step", "Nama Step", "Status", "Assigned Staff", "Mesin ID", "Waktu Mulai", "Waktu Selesai", "Catatan"]);
  }

  const config = getPipelineConfig(tipe);
  config.forEach((c, idx) => {
    const status = idx === 0 ? "Aktif" : "Pending";
    const waktuMulai = idx === 0 ? new Date() : "";
    sh.appendRow([generateId("PIP"), noNota, c.step, c.nama, status, "", "", waktuMulai, "", ""]);
  });
}

function getPipelineSteps(noNota) {
  const sh = SS.getSheetByName(SHEET_PIPELINE);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  data.shift();
  return data
    .filter(r => r[1] === noNota)
    .map(r => ({
      id: r[0], noNota: r[1], step: r[2], namaStep: r[3], status: r[4],
      assignedStaff: r[5] || "", mesinId: r[6] || "",
      waktuMulai: r[7] ? fmtWib(r[7]) : "",
      waktuSelesai: r[8] ? fmtWib(r[8]) : "",
      catatan: r[9] || "", washerId: r[10] || "", dryerId: r[11] || ""
    }))
    .sort((a, b) => a.step - b.step);
}

function advancePipeline(noNota, assignedStaff, mesinId, catatan) {
  const sh = SS.getSheetByName(SHEET_PIPELINE);
  if (!sh) return { success: false, message: "Sheet Pipeline tidak ditemukan." };

  const rows = sh.getDataRange().getValues();
  let activeRowIdx = -1;
  let nextRowIdx = -1;

  // Find current active step
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === noNota && rows[i][4] === "Aktif") {
      activeRowIdx = i;
      break;
    }
  }

  if (activeRowIdx === -1) return { success: false, message: "Tidak ada step aktif untuk nota ini." };

  // Find next pending step
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === noNota && rows[i][4] === "Pending" && rows[i][2] > rows[activeRowIdx][2]) {
      nextRowIdx = i;
      break;
    }
  }

  const now = new Date();

  // Complete current step
  sh.getRange(activeRowIdx + 1, 5).setValue("Selesai");
  if (assignedStaff) sh.getRange(activeRowIdx + 1, 6).setValue(assignedStaff);
  if (mesinId) sh.getRange(activeRowIdx + 1, 7).setValue(mesinId);
  sh.getRange(activeRowIdx + 1, 9).setValue(now);
  if (catatan) sh.getRange(activeRowIdx + 1, 10).setValue(catatan);

  const completedStep = rows[activeRowIdx][3];

  if (nextRowIdx !== -1) {
    // Activate next step
    sh.getRange(nextRowIdx + 1, 5).setValue("Aktif");
    sh.getRange(nextRowIdx + 1, 8).setValue(now);

    const nextStep = rows[nextRowIdx][3];
    // Update main transaction status
    updateStatus(noNota, nextStep);
    return { success: true, message: "✅ " + completedStep + " selesai → " + nextStep, currentStep: nextStep };
  } else {
    // All steps done
    updateStatus(noNota, "Selesai");
    return { success: true, message: "🏁 Semua proses selesai!", currentStep: "Selesai" };
  }
}

function getDropoffStatusIndex_(status) {
  return ["Diterima", "Dicuci", "Dikeringkan", "Disetrika", "Siap Diambil", "Selesai"].indexOf(String(status || ""));
}

function findMachineRow_(machineId, expectedType) {
  const sh = SS.getSheetByName(SHEET_MESIN);
  if (!sh || !machineId) return { success: false, message: "Mesin wajib dipilih." };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(machineId)) continue;
    const actualType = String(rows[i][2] || "").toLowerCase();
    if (actualType.indexOf(String(expectedType).toLowerCase()) === -1) {
      return { success: false, message: "Tipe mesin tidak sesuai untuk tahap ini." };
    }
    if (rows[i][3] === "Maintenance") return { success: false, message: "Mesin sedang maintenance." };
    if (rows[i][3] === "Digunakan") return { success: false, message: "Mesin sedang digunakan order lain." };
    return { success: true, sheet: sh, rowIndex: i };
  }
  return { success: false, message: "Mesin tidak ditemukan." };
}

/**
 * Memajukan lifecycle drop-off satu tahap. Mesin dicatat pada tahap yang baru
 * dimulai sehingga washer/dryer fisik selalu dapat ditelusuri dari order.
 */
function updateDropoffStatus(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const noNota = String(data.noNota || data.id || "");
    const statusBaru = String(data.status || "");
    const shT = SS.getSheetByName(SHEET_TRANSAKSI);
    const shP = SS.getSheetByName(SHEET_PIPELINE);
    if (!shT || !shP) return { success: false, message: "Schema transaksi atau pipeline belum tersedia." };

    const txRows = shT.getDataRange().getValues();
    let txIndex = -1;
    for (let i = 1; i < txRows.length; i++) {
      if (String(txRows[i][0]) === noNota) { txIndex = i; break; }
    }
    if (txIndex < 0) return { success: false, message: "Order drop-off tidak ditemukan." };
    if (txRows[txIndex][8] !== "FullService") return { success: false, message: "Lifecycle produksi hanya berlaku untuk order drop-off." };
    if (txRows[txIndex][9] === "Approved" || ["Void", "Batal"].indexOf(txRows[txIndex][5]) !== -1) {
      return { success: false, message: "Order void/batal tidak dapat diproses." };
    }

    const currentIndex = getDropoffStatusIndex_(txRows[txIndex][5]);
    const targetIndex = getDropoffStatusIndex_(statusBaru);
    if (targetIndex < 0) return { success: false, message: "Status drop-off tidak valid." };
    if (targetIndex !== currentIndex + 1) return { success: false, message: "Status harus dilanjutkan satu tahap secara berurutan." };

    let machine = null;
    let machineId = "";
    if (statusBaru === "Dicuci") {
      machineId = String(data.washerId || "");
      machine = findMachineRow_(machineId, "washer");
    } else if (statusBaru === "Dikeringkan") {
      machineId = String(data.dryerId || "");
      machine = findMachineRow_(machineId, "dryer");
    }
    if (machine && !machine.success) return { success: false, message: machine.message };

    const pipelineRows = shP.getDataRange().getValues();
    let activeRow = -1;
    let targetRow = -1;
    for (let i = 1; i < pipelineRows.length; i++) {
      if (String(pipelineRows[i][1]) !== noNota) continue;
      if (pipelineRows[i][4] === "Aktif") activeRow = i;
      if (pipelineRows[i][3] === statusBaru) targetRow = i;
    }
    if (activeRow < 0 || targetRow < 0) return { success: false, message: "Pipeline order belum sesuai schema terbaru." };

    const now = new Date();
    const previousMachineId = String(pipelineRows[activeRow][6] || "");
    shP.getRange(activeRow + 1, 5).setValue("Selesai");
    shP.getRange(activeRow + 1, 9).setValue(now);
    if (data.assignedStaff) shP.getRange(activeRow + 1, 6).setValue(data.assignedStaff);
    if (data.catatan) shP.getRange(activeRow + 1, 10).setValue(data.catatan);

    if (statusBaru === "Selesai") {
      shP.getRange(targetRow + 1, 5).setValue("Selesai");
      shP.getRange(targetRow + 1, 8, 1, 2).setValues([[now, now]]);
    } else {
      shP.getRange(targetRow + 1, 5).setValue("Aktif");
      shP.getRange(targetRow + 1, 8).setValue(now);
    }
    if (machineId) {
      shP.getRange(targetRow + 1, 7).setValue(machineId);
      shP.getRange(targetRow + 1, statusBaru === "Dicuci" ? 11 : 12).setValue(machineId);
      machine.sheet.getRange(machine.rowIndex + 1, 4, 1, 4).setValues([["Digunakan", noNota + " - " + statusBaru, now, data.estimasiSelesai || ""]]);
    }
    if (previousMachineId) selesaiMesin(previousMachineId);

    shT.getRange(txIndex + 1, 6).setValue(statusBaru);
    addAuditLog(data.userName || data.assignedStaff || "Staff", "Update Drop-off", noNota, txRows[txIndex][5] + " -> " + statusBaru + (machineId ? "; mesin " + machineId : ""));
    SpreadsheetApp.flush();
    return { success: true, noNota: noNota, previousStatus: txRows[txIndex][5], status: statusBaru, machineId: machineId || "", message: "Status order diperbarui menjadi " + statusBaru + "." };
  } finally {
    lock.releaseLock();
  }
}

function getTransaksiList(statusFilter) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const shD = SS.getSheetByName(SHEET_DETAIL);

  const dataHeader = sh.getDataRange().getValues();
  dataHeader.shift();
  const dataDetail = shD.getDataRange().getValues();
  dataDetail.shift();

  let result = dataHeader.map(r => {
    const items = dataDetail
      .filter(d => d[0] === r[0])
      .map(d => ({
        layanan: d[1],
        qty: Number(d[2]) || 0,
        hargaSatuan: Number(d[3]) || 0,
        subtotal: Number(d[4]) || 0
      }));
    return {
      noNota: r[0],
      tanggal: fmtWib(r[1]),
      namaPelanggan: r[2],
      noHp: r[3],
      total: Number(r[4]) || 0,
      status: r[5],
      estimasi: r[6],
      petugas: r[7] || "Kasir",
      tipe: r[8] || "SelfService",
      statusVoid: r[9] || "None",
      alasanVoid: r[10] || "",
      subtotal: Number(r[11]) || Number(r[4]) || 0,
      diskon: Number(r[12]) || 0,
      metodeBayar: r[13] || "",
      statusPembayaran: r[14] || "Lunas",
      nominalDP: Number(r[15]) || 0,
      sisaTagihan: Number(r[16]) || 0,
      referensiPembayaran: r[17] || "",
      catatan: r[18] || "",
      tingkatLayanan: r[19] || "Reguler",
      items: items
    };
  });

  if (statusFilter && statusFilter !== "Semua") {
    result = result.filter(r => r.status === statusFilter);
  }
  return result.reverse();
}

// ── NOTA TOKEN (URL Obfuscation) ─────────────────────────────
// Token = base64( HMAC-SHA256(noNota + "|" + date, SESSION_SECRET) )
// Disimpan di Script Properties agar persisten lintas request.
function generateNotaToken_(noNota) {
  var secret = getSessionSecret_();
  var raw = noNota + "|" + Utilities.formatDate(new Date(), TIMEZONE_WIB, "yyyyMMdd");
  var sig = Utilities.computeHmacSha256Signature(raw, secret);
  // ambil 8 byte pertama → 16 hex char — cukup untuk obscurity tanpa overhead
  var hex = sig.slice(0, 8).map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return hex;
}

function verifyNotaToken_(noNota, token) {
  if (!token) return false;
  // Cek hari ini dan kemarin (toleransi pergantian hari)
  var secret = getSessionSecret_();
  var today = Utilities.formatDate(new Date(), TIMEZONE_WIB, "yyyyMMdd");
  var yesterday = Utilities.formatDate(new Date(Date.now() - 86400000), TIMEZONE_WIB, "yyyyMMdd");
  for (var i = 0; i < 2; i++) {
    var date = i === 0 ? today : yesterday;
    var raw = noNota + "|" + date;
    var sig = Utilities.computeHmacSha256Signature(raw, secret);
    var hex = sig.slice(0, 8).map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
    if (hex === token) return true;
  }
  return false;
}

function getTransaksiByNota(noNota, token) {
  // Token opsional — kalau ada, verify. Kalau tidak ada dan bukan PUBLIC, tolak.
  if (token && !verifyNotaToken_(noNota, token)) {
    return { success: false, message: "Token e-nota tidak valid atau sudah kedaluwarsa." };
  }
  const all = getTransaksiList();
  const found = all.find(t => t.noNota === noNota);
  if (!found) return { success: false, message: "Nota " + noNota + " tidak ditemukan di sistem." };
  return { success: true, transaksi: found };
}

function getTransaksiByPipeline(tipeFilter) {
  const allTx = getTransaksiList();
  let filtered = allTx.filter(t => t.tipe === "FullService" && t.status !== "Selesai" && t.status !== "Void" && t.status !== "Batal");
  if (tipeFilter && tipeFilter !== "Semua") {
    filtered = filtered.filter(t => t.tipe === tipeFilter);
  }
  // Attach pipeline steps to each tx
  return filtered.map(t => {
    t.pipeline = getPipelineSteps(t.noNota);
    return t;
  });
}

function updateStatus(noNota, statusBaru) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === noNota) { sh.getRange(i + 1, 6).setValue(statusBaru); return true; }
  }
  return false;
}

// ============================================================
// LAPORAN & VISUALISASI
// ============================================================
function getLaporanRange(startDateStr, endDateStr) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const shD = SS.getSheetByName(SHEET_DETAIL);

  const dataHeader = sh.getDataRange().getValues();
  dataHeader.shift();
  const dataDetail = shD.getDataRange().getValues();
  dataDetail.shift();

  const filtered = dataHeader.filter(r => {
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    const isVoid = r[9] === "Approved" || r[5] === "Void" || r[5] === "Batal";
    return tgl >= startDateStr && tgl <= endDateStr && !isVoid;
  });

  let totalOmzet = 0;
  const omzetHarianMap = {};
  const transaksiList = [];
  let selfCount = 0, fullCount = 0;

  filtered.forEach(r => {
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    const total = r[4];
    totalOmzet += total;
    if (r[8] === "FullService") fullCount++; else selfCount++;

    if (!omzetHarianMap[tgl]) omzetHarianMap[tgl] = { omzet: 0, jumlah: 0 };
    omzetHarianMap[tgl].omzet += total;
    omzetHarianMap[tgl].jumlah += 1;

    const items = dataDetail.filter(d => d[0] === r[0]).map(d => ({ layanan: d[1], qty: d[2], subtotal: d[4] }));
    transaksiList.push({
      noNota: r[0], tanggal: fmtWib(r[1]), namaPelanggan: r[2], noHp: r[3],
      total: total, status: r[5], petugas: r[7] || "Kasir", tipe: r[8] || "SelfService",
      statusVoid: r[9] || "None", alasanVoid: r[10] || "", metodeBayar: r[13] || "",
      statusPembayaran: r[14] || "Lunas", nominalDP: Number(r[15]) || 0,
      sisaTagihan: Number(r[16]) || 0, items: items
    });
  });

  const omzetHarian = Object.keys(omzetHarianMap).sort().map(tgl => ({
    tanggal: tgl, omzet: omzetHarianMap[tgl].omzet, jumlahTransaksi: omzetHarianMap[tgl].jumlah
  }));

  const notaSet = {};
  filtered.forEach(r => notaSet[r[0]] = true);
  const layananMap = {};
  dataDetail.forEach(d => {
    if (notaSet[d[0]]) {
      const nama = d[1];
      if (!layananMap[nama]) layananMap[nama] = { qty: 0, omzet: 0 };
      layananMap[nama].qty += Number(d[2]);
      layananMap[nama].omzet += Number(d[4]);
    }
  });
  const layananTerlaris = Object.keys(layananMap)
    .map(nama => ({ layanan: nama, qty: layananMap[nama].qty, omzet: layananMap[nama].omzet }))
    .sort((a, b) => b.omzet - a.omzet);

  const jumlahTransaksi = filtered.length;
  const rataRata = jumlahTransaksi > 0 ? Math.round(totalOmzet / jumlahTransaksi) : 0;

  return {
    ringkasan: {
      totalOmzet: Number(totalOmzet) || 0,
      jumlahTransaksi: Number(jumlahTransaksi) || 0,
      rataRata: Number(rataRata) || 0,
      selfCount: Number(selfCount) || 0,
      fullCount: Number(fullCount) || 0
    },
    omzetHarian,
    layananTerlaris,
    transaksiList: transaksiList.reverse()
  };
}

// ============================================================
// PEGAWAI & REKAP KINERJA
// ============================================================
function getPegawaiList() {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  data.shift();
  return data.map(r => ({
    id: r[0],
    nama: r[1],
    noHp: r[2],
    jabatan: r[3],
    status: r[4] || "Aktif"
  }));
}

function tambahPegawai(data) {
  let sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) { sh = SS.insertSheet(SHEET_PEGAWAI); sh.appendRow(["ID", "Nama Pegawai", "No HP", "Jabatan", "Status", "Tanggal Bergabung"]); }
  const id = generateId("EMP");
  sh.appendRow([id, data.nama, data.noHp || "", data.jabatan || "Operator", "Aktif", new Date()]);
  return { success: true, id: id };
}

function hapusPegawai(id) {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return false;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

function getRekapKinerjaPegawai(startDateStr, endDateStr) {
  const shT = SS.getSheetByName(SHEET_TRANSAKSI);
  const shP = SS.getSheetByName(SHEET_PEGAWAI);
  const dataT = shT ? shT.getDataRange().getValues() : []; dataT.shift();
  const dataP = shP ? shP.getDataRange().getValues() : []; dataP.shift();

  const pegawaiMap = {};
  dataP.forEach(r => {
    pegawaiMap[r[1]] = {
      id: r[0],
      nama: r[1],
      jabatan: r[3],
      totalTransaksi: 0,
      totalOmzet: 0
    };
  });

  dataT.forEach(r => {
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    if (!startDateStr || !endDateStr || (tgl >= startDateStr && tgl <= endDateStr)) {
      const namaPetugas = r[7] || "Kasir";
      const total = Number(r[4]) || 0;
      if (!pegawaiMap[namaPetugas]) {
        pegawaiMap[namaPetugas] = { id: "-", nama: namaPetugas, jabatan: "Kasir/Petugas", totalTransaksi: 0, totalOmzet: 0 };
      }
      pegawaiMap[namaPetugas].totalTransaksi += 1;
      pegawaiMap[namaPetugas].totalOmzet += total;
    }
  });

  return Object.values(pegawaiMap)
    .map(p => ({
      id: p.id,
      nama: p.nama,
      jabatan: p.jabatan,
      totalTransaksi: Number(p.totalTransaksi) || 0,
      totalOmzet: Number(p.totalOmzet) || 0
    }))
    .sort((a, b) => b.totalOmzet - a.totalOmzet);
}

// ============================================================
// ABSENSI SHIFT (CLOCK IN / OUT)
// ============================================================
function clockInPegawai(namaPegawai, shift, catatan) {
  let sh = SS.getSheetByName(SHEET_ABSENSI);
  if (!sh) { sh = SS.insertSheet(SHEET_ABSENSI); sh.appendRow(["ID", "Tanggal", "Nama Pegawai", "Shift", "Clock In", "Clock Out", "Durasi Kerja", "Catatan"]); }
  const now = new Date();
  const tglStr = fmtWib(now, "yyyy-MM-dd");
  const clockInStr = fmtWib(now);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowTgl = data[i][1] ? fmtWib(data[i][1], "yyyy-MM-dd") : "";
    if (rowTgl === tglStr && data[i][2] === namaPegawai && !data[i][5]) {
      return { success: false, message: "Pegawai ini sudah Clock In (belum Clock Out)." };
    }
  }
  sh.appendRow([generateId("ABS"), now, namaPegawai, shift || "Pagi", clockInStr, "", "", catatan || ""]);
  return { success: true, message: "✅ Clock In Berhasil (" + clockInStr + ")" };
}

function clockOutPegawai(namaPegawai, catatanOut) {
  const sh = SS.getSheetByName(SHEET_ABSENSI);
  if (!sh) return { success: false, message: "Sheet Absensi belum ada." };
  const now = new Date();
  const tglStr = fmtWib(now, "yyyy-MM-dd");
  const clockOutStr = fmtWib(now);
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const rowTgl = rows[i][1] ? fmtWib(rows[i][1], "yyyy-MM-dd") : "";
    if (rowTgl === tglStr && rows[i][2] === namaPegawai && !rows[i][5]) {
      const diffMs = now.getTime() - new Date(rows[i][1]).getTime();
      const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
      sh.getRange(i + 1, 6).setValue(clockOutStr);
      sh.getRange(i + 1, 7).setValue(diffHours + " Jam");
      if (catatanOut) {
        const catLama = rows[i][7] || "";
        sh.getRange(i + 1, 8).setValue(catLama ? catLama + " | Out: " + catatanOut : "Out: " + catatanOut);
      }
      return { success: true, message: "✅ Clock Out! Durasi: " + diffHours + " Jam" };
    }
  }
  return { success: false, message: "Tidak ditemukan Clock In aktif hari ini." };
}

function getStatusAbsensiHariIni(namaPegawai) {
  const sh = SS.getSheetByName(SHEET_ABSENSI);
  if (!sh) return { status: "BELUM_IN" };
  const tglStr = fmtWib(new Date(), "yyyy-MM-dd");
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const rowTgl = rows[i][1] ? fmtWib(rows[i][1], "yyyy-MM-dd") : "";
    if (rowTgl === tglStr && rows[i][2] === namaPegawai) {
      if (!rows[i][5]) return { status: "SUDAH_IN", clockIn: rows[i][4], shift: rows[i][3] };
      else return { status: "SUDAH_OUT", clockIn: rows[i][4], clockOut: rows[i][5], durasi: rows[i][6] };
    }
  }
  return { status: "BELUM_IN" };
}

function getRekapAbsensi(startDateStr, endDateStr) {
  const sh = SS.getSheetByName(SHEET_ABSENSI);
  if (!sh) return [];
  const data = sh.getDataRange().getValues(); data.shift();
  const filtered = data.filter(r => {
    if (!r[1]) return false;
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    return (!startDateStr || !endDateStr || (tgl >= startDateStr && tgl <= endDateStr));
  });
  return filtered.map(r => ({
    id: r[0], tanggal: fmtWib(r[1], "dd/MM/yyyy"), namaPegawai: r[2], shift: r[3],
    clockIn: r[4], clockOut: r[5] || "-", durasi: r[6] || "-", catatan: r[7] || "-"
  })).reverse();
}

// ============================================================
// MASTER SHIFT
// ============================================================
function getMasterShiftList() {
  let sh = SS.getSheetByName(SHEET_SHIFT);
  if (!sh) {
    sh = SS.insertSheet(SHEET_SHIFT);
    sh.appendRow(["ID", "Nama Shift", "Jam Masuk", "Jam Keluar", "Keterangan"]);
    sh.appendRow([generateId(), "Shift 1 (Pagi)", "07:00", "15:00", "Shift Pagi Utama"]);
    sh.appendRow([generateId(), "Shift 2 (Sore/Malam)", "15:00", "23:00", "Shift Sore/Malam Utama"]);
  }
  const data = sh.getDataRange().getValues(); data.shift();
  return data.map(r => ({ id: r[0], nama: r[1], jamMasuk: r[2], jamKeluar: r[3], keterangan: r[4] || "" }));
}

function tambahMasterShift(data) {
  let sh = SS.getSheetByName(SHEET_SHIFT);
  if (!sh) { sh = SS.insertSheet(SHEET_SHIFT); sh.appendRow(["ID", "Nama Shift", "Jam Masuk", "Jam Keluar", "Keterangan"]); }
  const id = generateId("SFT");
  sh.appendRow([id, data.nama, data.jamMasuk || "07:00", data.jamKeluar || "15:00", data.keterangan || ""]);
  return { success: true, id: id };
}

function hapusMasterShift(id) {
  const sh = SS.getSheetByName(SHEET_SHIFT);
  if (!sh) return false;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

// ============================================================
// KAS SHIFT & SERAH TERIMA
// ============================================================
function getKasShiftAktif(outlet) {
  const sh = SS.getSheetByName(SHEET_KAS_SHIFT);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][10] === "Aktif" && (!outlet || rows[i][1] === outlet)) {
      return {
        idShift: rows[i][0],
        idOutlet: rows[i][1],
        namaKasir: rows[i][2],
        idUser: rows[i][3],
        waktuBuka: new Date(rows[i][4]).toISOString(),
        kasAwal: Number(rows[i][6]) || 0,
        kasAkhirSistem: Number(rows[i][7]) || 0,
        status: "Buka"
      };
    }
  }
  return null;
}

function openKasShift(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let sh = SS.getSheetByName(SHEET_KAS_SHIFT);
    if (!sh) {
      ensureSheetSchema_(SHEET_KAS_SHIFT, ["ID Kas Shift", "Outlet", "Nama Penanggung Jawab", "ID Penanggung Jawab", "Waktu Buka", "Waktu Tutup", "Kas Awal", "Kas Akhir Sistem", "Kas Akhir Fisik", "Selisih", "Status", "Mode Tutup", "ID Pengganti", "Nama Pengganti", "Waktu Handover", "Catatan"]);
      sh = SS.getSheetByName(SHEET_KAS_SHIFT);
    }
    const outlet = data.idOutlet || data.outlet || "OUTLET-UTAMA";
    if (getKasShiftAktif(outlet)) return { success: false, message: "Masih ada kas shift aktif pada outlet ini." };
    const kasAwal = Number(data.kasAwal);
    if (!isFinite(kasAwal) || kasAwal < 0) return { success: false, message: "Kas awal tidak valid." };
    const id = generateId("KAS");
    const now = new Date();
    sh.appendRow([id, outlet, data.namaKasir || data.userName || "Kasir", data.userId || "-", now, "", kasAwal, "", "", "", "Aktif", "", "", "", "", data.catatan || ""]);
    addAuditLog(data.namaKasir || data.userName || "Kasir", "Buka Kas Shift", id, "Outlet: " + outlet + "; kas awal Rp " + kasAwal.toLocaleString('id-ID'));
    return { success: true, data: getKasShiftAktif(outlet) };
  } finally {
    lock.releaseLock();
  }
}

function findEmployeeNameById_(employeeId) {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return "";
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(employeeId)) return String(rows[i][1]);
  return "";
}

function handoverCheckKasShift(data) {
  const active = getKasShiftAktif(data.idOutlet || data.outlet || "OUTLET-UTAMA");
  if (!active || active.idShift !== data.shiftId) return { eligible: false, clockedIn: false, message: "Kas shift aktif tidak ditemukan." };
  if (!data.replacementEmployeeId || String(data.replacementEmployeeId) === String(active.idUser)) {
    return { eligible: false, clockedIn: false, message: "Staf pengganti harus berbeda dari penanggung jawab kas." };
  }
  const replacementName = findEmployeeNameById_(data.replacementEmployeeId);
  if (!replacementName) return { eligible: false, clockedIn: false, message: "Staf pengganti tidak ditemukan." };
  const attendance = SS.getSheetByName(SHEET_ABSENSI);
  if (!attendance) return { eligible: false, clockedIn: false, message: "Staf pengganti belum Clock In." };
  const today = fmtWib(new Date(), "yyyy-MM-dd");
  const rows = attendance.getDataRange().getValues();
  const clockedIn = rows.some(function(row, index) {
    return index > 0 && row[1] && fmtWib(row[1], "yyyy-MM-dd") === today && row[2] === replacementName && row[4] && !row[5];
  });
  return { eligible: clockedIn, clockedIn: clockedIn, replacementEmployeeId: data.replacementEmployeeId, replacementName: replacementName, message: clockedIn ? "Staf pengganti sudah Clock In." : "Staf pengganti belum Clock In." };
}

function calculateShiftCash_(openedAt) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) return 0;
  const rows = sh.getDataRange().getValues();
  return rows.reduce(function(total, row, index) {
    if (index === 0 || !row[1] || new Date(row[1]).getTime() < openedAt.getTime()) return total;
    if (row[9] === "Approved" || row[5] === "Void" || row[5] === "Batal") return total;
    if (row[13] !== "Tunai") return total;
    return total + (Number(row[15]) || Number(row[4]) || 0);
  }, 0);
}

function closeKasShift(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SS.getSheetByName(SHEET_KAS_SHIFT);
    if (!sh) return { success: false, message: "Sheet KasShift belum tersedia." };
    const rows = sh.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) if (rows[i][0] === data.shiftId && rows[i][10] === "Aktif") { rowIndex = i; break; }
    if (rowIndex < 0) return { success: false, message: "Kas shift aktif tidak ditemukan." };
    if (["SERAH_TERIMA", "TUTUP_HARIAN"].indexOf(data.mode) === -1) return { success: false, message: "Mode penutupan tidak valid." };

    let replacement = { replacementEmployeeId: "", replacementName: "" };
    if (data.mode === "SERAH_TERIMA") {
      if (!data.handoverConfirmed) return { success: false, message: "Serah terima belum dikonfirmasi." };
      const check = handoverCheckKasShift({ shiftId: data.shiftId, idOutlet: rows[rowIndex][1], replacementEmployeeId: data.replacementEmployeeId });
      if (!check.eligible) return { success: false, message: check.message };
      replacement = check;
    }

    const kasFisik = Number(data.kasAkhir);
    if (!isFinite(kasFisik) || kasFisik < 0) return { success: false, message: "Kas akhir fisik tidak valid." };
    const omzetTunai = calculateShiftCash_(new Date(rows[rowIndex][4]));
    const kasSistem = (Number(rows[rowIndex][6]) || 0) + omzetTunai;
    const now = new Date();
    sh.getRange(rowIndex + 1, 6).setValue(now);
    sh.getRange(rowIndex + 1, 8, 1, 9).setValues([[kasSistem, kasFisik, kasFisik - kasSistem, "Ditutup", data.mode, replacement.replacementEmployeeId || "", replacement.replacementName || "", data.mode === "SERAH_TERIMA" ? now : "", data.catatan || ""]]);
    addAuditLog(data.userName || rows[rowIndex][2] || "Kasir", "Tutup Kas Shift", data.shiftId, "Mode: " + data.mode + "; sistem Rp " + kasSistem.toLocaleString('id-ID') + "; fisik Rp " + kasFisik.toLocaleString('id-ID'));
    return { success: true, idShift: data.shiftId, kasAkhirSistem: kasSistem, kasAkhirFisik: kasFisik, selisihKas: kasFisik - kasSistem, mode: data.mode };
  } finally {
    lock.releaseLock();
  }
}

function getRekapKasShift() {
  const sh = SS.getSheetByName(SHEET_KAS_SHIFT);
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getDataRange().getValues(); rows.shift();
  return rows.map(function(r) {
    return {
      idShift: r[0],
      idOutlet: r[1],
      namaKasir: r[2],
      waktuBuka: fmtWib(r[4]),
      waktuTutup: r[5] ? fmtWib(r[5]) : "",
      kasAwal: Number(r[6]) || 0,
      kasAkhirSistem: Number(r[7]) || 0,
      kasAkhirFisik: Number(r[8]) || 0,
      selisihKas: Number(r[9]) || 0,
      status: r[10],
      modeTutup: r[11] || ""
    };
  }).reverse();
}

// ============================================================
// VOID TRANSAKSI & AUDIT TRAIL (SRS-LNDRY-POS-001)
// ============================================================
const SHEET_AUDIT = "AuditLog";

function addAuditLog(namaUser, jenisAktivitas, referensi, detail) {
  let sh = SS.getSheetByName(SHEET_AUDIT);
  if (!sh) {
    sh = SS.insertSheet(SHEET_AUDIT);
    sh.appendRow(["ID Log", "Waktu", "Pengguna", "Aktivitas", "Referensi", "Detail"]);
  }
  const idLog = generateId("LOG");
  const waktu = fmtWib(new Date());
  sh.appendRow([idLog, waktu, namaUser || "System", jenisAktivitas || "Activity", referensi || "-", detail || "-"]);
}

function getAuditLogs() {
  let sh = SS.getSheetByName(SHEET_AUDIT);
  if (!sh) return [];
  const data = sh.getDataRange().getValues(); data.shift();
  return data.map(r => ({
    idLog: r[0], waktu: r[1], namaUser: r[2], jenisAktivitas: r[3], referensi: r[4], detail: r[5]
  })).reverse();
}

function ajukanVoidTransaksi(noNota, alasan, petugas) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) return { success: false, message: "Sheet Transaksi tidak ada" };
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === noNota) {
      if (!String(alasan || "").trim()) return { success: false, message: "Alasan void wajib diisi" };
      if (data[i][9] === "PendingApproval") return { success: false, message: "Permintaan void sudah menunggu approval" };
      if (data[i][9] === "Approved" || data[i][5] === "Void") return { success: false, message: "Transaksi sudah berstatus Void" };
      sh.getRange(i + 1, 10).setValue("PendingApproval");
      sh.getRange(i + 1, 11).setValue(String(alasan).trim());
      addAuditLog(petugas || "Kasir", "Pengajuan Void", noNota, alasan);
      return { success: true, message: "Permohonan void berhasil dikirim" };
    }
  }
  return { success: false, message: "Nota tidak ditemukan" };
}

function approveVoidTransaksi(noNota, isApproved, managerName, managerId, catatan) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) return { success: false, message: "Sheet Transaksi tidak ada" };
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === noNota) {
      if (data[i][9] !== "PendingApproval") return { success: false, message: "Transaksi tidak berada dalam antrean approval" };
      const voidStatus = isApproved ? "Approved" : "Rejected";
      sh.getRange(i + 1, 10).setValue(voidStatus);
      if (isApproved) sh.getRange(i + 1, 6).setValue("Void");
      const detail = "Keputusan: " + voidStatus + "; alasan: " + (data[i][10] || "-") + "; catatan: " + (catatan || "-") + "; approver_id: " + (managerId || "-");
      addAuditLog(managerName || "Manager", isApproved ? "Approve Void" : "Reject Void", noNota, detail);
      return { success: true, statusVoid: voidStatus, status: isApproved ? "Void" : data[i][5], message: "Keputusan void berhasil disimpan (" + voidStatus + ")" };
    }
  }
  return { success: false, message: "Nota tidak ditemukan" };
}

// ============================================================
// DATA SEEDER 6 BULAN (SRS-LNDRY-POS-001) - Super Fast Batch Insertion
// ============================================================
function seedData6Bulan() {
  setupSheets();
  
  let shT = SS.getSheetByName(SHEET_TRANSAKSI);
  let shD = SS.getSheetByName(SHEET_DETAIL);

  const pelangganList = [
    { nama: "Anisa Wijaya", hp: "081234567890" },
    { nama: "Rudi Hermawan", hp: "081398765432" },
    { nama: "Dian Sastro", hp: "085712345678" },
    { nama: "Eko Prasetyo", hp: "081908765432" },
    { nama: "Dewi Lestari", hp: "082134567890" },
    { nama: "Bayu Pratama", hp: "083898765432" },
    { nama: "Maya Indah", hp: "087812345678" },
    { nama: "Hendra Kurniawan", hp: "085608765432" },
    { nama: "Rina Kusuma", hp: "081534567890" },
    { nama: "Agus Setiawan", hp: "082298765432" }
  ];

  pelangganList.forEach(p => {
    simpanPelangganJikaBaru(p.nama, p.hp);
  });

  const layananPool = [
    { nama: "Cuci 7.5 Kg", harga: 10000, tipe: "SelfService" },
    { nama: "Cuci + Kering 7.5 Kg", harga: 18000, tipe: "SelfService" },
    { nama: "Deterjen Sachet", harga: 1500, tipe: "SelfService" },
    { nama: "Softener Pouch", harga: 1500, tipe: "SelfService" },
    { nama: "Cuci Komplit Reguler 7.5 Kg", harga: 20000, tipe: "FullService" },
    { nama: "Cuci Komplit Kilat 7.5 Kg", harga: 30000, tipe: "FullService" },
    { nama: "Setrika Saja 7.5 Kg", harga: 12000, tipe: "FullService" },
    { nama: "Cuci Bed Cover Jumbo", harga: 35000, tipe: "FullService" },
    { nama: "Cuci Sepatu Premium", harga: 35000, tipe: "FullService" },
    { nama: "Dry Clean Jas", harga: 45000, tipe: "FullService" }
  ];

  const petugasList = ["Siti Rahma", "Budi Santoso", "Kasir Utama"];
  const now = new Date();
  let counter = 1000;
  
  const batchTransaksi = [];
  const batchDetail = [];

  // Loop back 180 days (6 months)
  for (let dayOffset = 180; dayOffset >= 0; dayOffset--) {
    const txDate = new Date(now.getTime() - (dayOffset * 24 * 60 * 60 * 1000));
    // Generate 2 to 4 random transactions per day
    const txPerDay = Math.floor(Math.random() * 3) + 2;

    for (let i = 0; i < txPerDay; i++) {
      counter++;
      const noNota = "LDY-" + txDate.getFullYear().toString().slice(-2) + 
        ("0" + (txDate.getMonth() + 1)).slice(-2) + 
        ("0" + txDate.getDate()).slice(-2) + "-" + counter;

      const cust = pelangganList[Math.floor(Math.random() * pelangganList.length)];
      const pet = petugasList[Math.floor(Math.random() * petugasList.length)];
      
      const numItems = Math.floor(Math.random() * 2) + 1;
      let totalNota = 0;
      let primaryTipe = "FullService";

      for (let k = 0; k < numItems; k++) {
        const item = layananPool[Math.floor(Math.random() * layananPool.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const subtotal = item.harga * qty;
        totalNota += subtotal;
        primaryTipe = item.tipe;

        batchDetail.push([noNota, item.nama, qty, item.harga, subtotal]);
      }

      const status = dayOffset < 2 ? (Math.random() > 0.5 ? "Siap Ambil" : "Diterima") : "Selesai";
      const estimasiStr = fmtWib(new Date(txDate.getTime() + (24 * 60 * 60 * 1000)), "yyyy-MM-dd");

      batchTransaksi.push([
        noNota,
        txDate,
        cust.nama,
        cust.hp,
        totalNota,
        status,
        estimasiStr,
        pet,
        primaryTipe
      ]);
    }
  }

  // Fast Batch Append with setValues
  if (batchDetail.length > 0) {
    shD.getRange(shD.getLastRow() + 1, 1, batchDetail.length, 5).setValues(batchDetail);
  }
  if (batchTransaksi.length > 0) {
    shT.getRange(shT.getLastRow() + 1, 1, batchTransaksi.length, 9).setValues(batchTransaksi);
  }

  addAuditLog("System Seeder", "Data Seeding 6 Bulan", "6 Bulan Data", `Berhasil membuat ${batchTransaksi.length} sampel transaksi.`);
  return { success: true, count: batchTransaksi.length, message: `Berhasil meng-generate ${batchTransaksi.length} transaksi seeder 6 bulan!` };
}

function resetAndSeed6Bulan() {
  let shT = SS.getSheetByName(SHEET_TRANSAKSI);
  let shD = SS.getSheetByName(SHEET_DETAIL);
  if (shT) {
    shT.clear();
    shT.appendRow(["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe"]);
  }
  if (shD) {
    shD.clear();
    shD.appendRow(["No Nota", "Layanan", "Qty", "Harga Satuan", "Subtotal"]);
  }
  return seedData6Bulan();
}
