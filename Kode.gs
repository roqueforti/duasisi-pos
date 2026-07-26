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
const TIMEZONE_WIB    = "Asia/Jakarta";

// PIN HAK AKSES PERAN
const PIN_STAFF   = "1234";
const PIN_MANAGER = "8888";

// ============ HELPER ============
function getWibTimeZone() { return TIMEZONE_WIB; }

function generateId() { return Utilities.getUuid().substring(0, 8); }

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

function verifikasiPin(pin) {
  if (pin === PIN_MANAGER) return { success: true, role: "MANAGER", label: "Manager / Owner" };
  if (pin === PIN_STAFF)   return { success: true, role: "STAFF",   label: "Staff / Kasir" };
  return { success: false, message: "PIN Salah! Akses Ditolak." };
}

// ============ WEB APP ENTRY POINT (PURE REST API ENGINE) ============
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Dua SiSi POS — REST API Engine",
    version: "2.5",
    frontendUrl: "https://roqueforti.github.io/duasisi-pos/",
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
// PIPELINE CONFIG
// ============================================================
function getPipelineConfig(tipe) {
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
  shP.appendRow(["Nama", "No HP", "Alamat"]);

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
  return list.map(r => ({ id: r[0], nama: r[1], harga: r[2], satuan: r[3], icon: r[4] || "🧺", tipe: r[6] || "SelfService" }));
}

function getLayananListAll() {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const data = sh.getDataRange().getValues();
  data.shift();
  return data.map(r => ({ id: r[0], nama: r[1], harga: r[2], satuan: r[3], icon: r[4] || "🧺", aktif: r[5], tipe: r[6] || "SelfService" }));
}

function tambahLayanan(data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const id = generateId();
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
    id: r[0], nama: r[1], stok: r[2], satuan: r[3], stokMinimum: r[4],
    terakhirUpdate: r[5] ? fmtWib(r[5], "dd/MM/yyyy HH:mm") : ""
  }));
}

function tambahInventory(data) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const id = generateId();
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
  const id = generateId();
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
  const lastRow = sh.getLastRow();
  const today = fmtWib(new Date(), "yyMMdd");
  return "LDY-" + today + "-" + String(lastRow).padStart(4, "0");
}

function simpanTransaksi(data) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const shD = SS.getSheetByName(SHEET_DETAIL);
  const noNota = (data.noNota && !data.noNota.startsWith('OFF-')) ? data.noNota : generateNoNota();
  const tanggal = data.tanggal ? new Date(data.tanggal) : new Date();
  const tipe = data.tipe || data.tipeLayanan || "SelfService";
  const status = data.status || "Diterima";
  const petugas = data.petugas || data.namaPetugas || "Kasir";

  let total = 0;
  if (Array.isArray(data.items) && data.items.length > 0) {
    data.items.forEach(item => {
      const subtotal = item.qty * item.hargaSatuan;
      total += subtotal;
      shD.appendRow([noNota, item.layanan, item.qty, item.hargaSatuan, subtotal]);
    });
  } else if (data.total) {
    total = Number(data.total);
    shD.appendRow([noNota, "Transaksi Manual", 1, total, total]);
  }

  sh.appendRow([noNota, tanggal, data.namaPelanggan, data.noHp || "", total, status, data.estimasiSelesai || data.estimasi || "", petugas, tipe]);
  simpanPelangganJikaBaru(data.namaPelanggan, data.noHp);

  // Auto-create pipeline steps
  createPipelineForNota(noNota, tipe);

  return { success: true, noNota: noNota, total: total, jumlahItem: data.items ? data.items.length : 1, tipe: tipe };
}

function simpanPelangganJikaBaru(nama, noHp) {
  const shP = SS.getSheetByName(SHEET_PELANGGAN);
  const data = shP.getDataRange().getValues();
  const exists = data.some(r => r[1] === noHp);
  if (!exists && noHp) shP.appendRow([nama, noHp, ""]);
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
    sh.appendRow([generateId(), noNota, c.step, c.nama, status, "", "", waktuMulai, "", ""]);
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
      catatan: r[9] || ""
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
      .map(d => ({ layanan: d[1], qty: d[2], hargaSatuan: d[3], subtotal: d[4] }));
    return {
      noNota: r[0], tanggal: fmtWib(r[1]),
      namaPelanggan: r[2], noHp: r[3], total: r[4], status: r[5],
      estimasi: r[6], petugas: r[7] || "Kasir", tipe: r[8] || "SelfService", items: items
    };
  });

  if (statusFilter && statusFilter !== "Semua") {
    result = result.filter(r => r.status === statusFilter);
  }
  return result.reverse();
}

function getTransaksiByNota(noNota) {
  const all = getTransaksiList();
  const found = all.find(t => t.noNota === noNota);
  if (!found) return { success: false, message: "Nota " + noNota + " tidak ditemukan di sistem." };
  return { success: true, transaksi: found };
}

function getTransaksiByPipeline(tipeFilter) {
  const allTx = getTransaksiList();
  let filtered = allTx.filter(t => t.status !== "Selesai");
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
    return tgl >= startDateStr && tgl <= endDateStr;
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
      total: total, status: r[5], petugas: r[7] || "Kasir", tipe: r[8] || "SelfService", items: items
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
    ringkasan: { totalOmzet, jumlahTransaksi, rataRata, selfCount, fullCount },
    omzetHarian, layananTerlaris, transaksiList: transaksiList.reverse()
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
  return data.map(r => ({ id: r[0], nama: r[1], noHp: r[2], jabatan: r[3], status: r[4] || "Aktif" }));
}

function tambahPegawai(data) {
  let sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) { sh = SS.insertSheet(SHEET_PEGAWAI); sh.appendRow(["ID", "Nama Pegawai", "No HP", "Jabatan", "Status", "Tanggal Bergabung"]); }
  const id = generateId();
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
  dataP.forEach(r => { pegawaiMap[r[1]] = { id: r[0], nama: r[1], jabatan: r[3], totalTransaksi: 0, totalOmzet: 0 }; });

  dataT.forEach(r => {
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    if (!startDateStr || !endDateStr || (tgl >= startDateStr && tgl <= endDateStr)) {
      const namaPetugas = r[7] || "Kasir";
      const total = Number(r[4]) || 0;
      if (!pegawaiMap[namaPetugas]) pegawaiMap[namaPetugas] = { id: "-", nama: namaPetugas, jabatan: "Kasir/Petugas", totalTransaksi: 0, totalOmzet: 0 };
      pegawaiMap[namaPetugas].totalTransaksi += 1;
      pegawaiMap[namaPetugas].totalOmzet += total;
    }
  });
  return Object.values(pegawaiMap).sort((a, b) => b.totalOmzet - a.totalOmzet);
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
  sh.appendRow([generateId(), now, namaPegawai, shift || "Pagi", clockInStr, "", "", catatan || ""]);
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
  const id = generateId();
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
// VOID TRANSAKSI & AUDIT TRAIL (SRS-LNDRY-POS-001)
// ============================================================
const SHEET_AUDIT = "AuditLog";

function addAuditLog(namaUser, jenisAktivitas, referensi, detail) {
  let sh = SS.getSheetByName(SHEET_AUDIT);
  if (!sh) {
    sh = SS.insertSheet(SHEET_AUDIT);
    sh.appendRow(["ID Log", "Waktu", "Pengguna", "Aktivitas", "Referensi", "Detail"]);
  }
  const idLog = "LOG-" + generateId();
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
      sh.getRange(i + 1, 6).setValue("Pending Void (" + (alasan || "") + ")");
      addAuditLog(petugas || "Kasir", "Pengajuan Void", noNota, alasan);
      return { success: true, message: "Permohonan void berhasil dikirim" };
    }
  }
  return { success: false, message: "Nota tidak ditemukan" };
}

function approveVoidTransaksi(noNota, isApproved, managerName) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) return { success: false, message: "Sheet Transaksi tidak ada" };
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === noNota) {
      const newStatus = isApproved ? "Batal" : "Diterima";
      sh.getRange(i + 1, 6).setValue(newStatus);
      addAuditLog(managerName || "Manager", isApproved ? "Approve Void" : "Reject Void", noNota, "Status: " + newStatus);
      return { success: true, message: "Keputusan void berhasil disimpan (" + newStatus + ")" };
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