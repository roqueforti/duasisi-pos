// ============================================================
// LAYANAN (CRUD) — with Tipe support
// ============================================================
function getLayananList(tipeFilter) {
  const shL = SS.getSheetByName(SHEET_LAYANAN);
  const shK = SS.getSheetByName(SHEET_KATEGORI);
  const katData = shK ? shK.getDataRange().getValues() : [];
  const katMap = {};
  katData.forEach(r => { katMap[r[1]] = r[3]; });

  const data = shL.getDataRange().getValues();
  data.shift();
  let list = data.filter(r => r[5] === "Y");
  if (tipeFilter) list = list.filter(r => r[6] === tipeFilter);
  return list.map(r => {
    let pipelineSteps = [];
    try { if (r[7]) pipelineSteps = JSON.parse(r[7]); } catch(e) {}
    return {
      id: r[0], 
      nama: r[1], 
      harga: Number(r[2]) || 0, 
      satuan: r[3], 
      icon: r[4] || "🧺", 
      tipe: r[6] || "SelfService",
      kategori: r[8] || "Self Service",
      idInventory: r[9] || null,
      kategoriWarna: katMap[r[8] || "Self Service"] || "bg-slate-100 text-slate-800 border-slate-200",
      pipelineSteps: pipelineSteps
    };
  });
}

function getLayananListAll() {
  const shL = SS.getSheetByName(SHEET_LAYANAN);
  const shK = SS.getSheetByName(SHEET_KATEGORI);
  const katData = shK ? shK.getDataRange().getValues() : [];
  const katMap = {};
  katData.forEach(r => { katMap[r[1]] = r[3]; });

  const data = shL.getDataRange().getValues();
  data.shift();
  return data.map(r => {
    let pipelineSteps = [];
    try { if (r[7]) pipelineSteps = JSON.parse(r[7]); } catch(e) {}
    return {
      id: r[0], 
      nama: r[1], 
      harga: Number(r[2]) || 0, 
      satuan: r[3], 
      icon: r[4] || "🧺", 
      aktif: r[5], 
      tipe: r[6] === undefined || r[6] === null ? "" : r[6],
      kategori: r[8] || "Self Service",
      idInventory: r[9] || null,
      kategoriWarna: katMap[r[8] || "Self Service"] || "bg-slate-100 text-slate-800 border-slate-200",
      pipelineSteps: pipelineSteps
    };
  });
}

function tambahLayanan(data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const id = generateId("SVC");
  const pSteps = data.pipelineSteps ? JSON.stringify(data.pipelineSteps) : "";
  sh.appendRow([id, data.nama, data.harga, data.satuan, data.icon || "🧺", "Y", data.tipe !== undefined ? data.tipe : "", pSteps, data.kategori || "Self Service", data.idInventory || ""]);
  return { success: true, id: id };
}

function updateLayanan(id, data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const pSteps = data.pipelineSteps ? JSON.stringify(data.pipelineSteps) : (rows[i][7] || "");
      sh.getRange(i + 1, 2, 1, 9).setValues([[data.nama, data.harga, data.satuan, data.icon || "🧺", rows[i][5], data.tipe !== undefined ? data.tipe : rows[i][6], pSteps, data.kategori || rows[i][8], data.idInventory !== undefined ? data.idInventory : (rows[i][9] || "")]]);
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

// ============================================================
// KATEGORI (CRUD)
// ============================================================
function getKategoriList() {
  let sh = SS.getSheetByName(SHEET_KATEGORI);
  if (!sh) {
    sh = SS.insertSheet(SHEET_KATEGORI);
    sh.appendRow(["ID", "Nama Kategori", "Aktif", "Warna"]);
    sh.appendRow([generateId("KAT"), "Self Service", "Y", "bg-blue-100 text-blue-800 border-blue-200"]);
    sh.appendRow([generateId("KAT"), "Drop Off", "Y", "bg-amber-100 text-amber-800 border-amber-200"]);
    sh.appendRow([generateId("KAT"), "Add On", "Y", "bg-emerald-100 text-emerald-800 border-emerald-200"]);
    sh.appendRow([generateId("KAT"), "Makanan dan Minuman", "Y", "bg-rose-100 text-rose-800 border-rose-200"]);
  }
  const data = sh.getDataRange().getValues();
  data.shift();
  return data.map(r => ({
    id: r[0],
    nama: r[1],
    aktif: r[2] || "Y",
    warna: r[3] || "bg-slate-100 text-slate-800 border-slate-200"
  }));
}

function tambahKategori(data) {
  let sh = SS.getSheetByName(SHEET_KATEGORI);
  if (!sh) sh = SS.insertSheet(SHEET_KATEGORI);
  const id = generateId("KAT");
  sh.appendRow([id, data.nama, "Y", data.warna || "bg-slate-100 text-slate-800 border-slate-200"]);
  return { success: true, id: id };
}

function updateKategori(id, data) {
  const sh = SS.getSheetByName(SHEET_KATEGORI);
  if (!sh) return { success: false, message: "Sheet tidak ditemukan" };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, 2).setValue(data.nama);
      if (data.warna) sh.getRange(i + 1, 4).setValue(data.warna);
      return { success: true };
    }
  }
  return { success: false, message: "Kategori tidak ditemukan" };
}

function toggleAktifKategori(id, aktifBaru) {
  const sh = SS.getSheetByName(SHEET_KATEGORI);
  if (!sh) return false;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, 3).setValue(aktifBaru ? "Y" : "N");
      return true;
    }
  }
  return false;
}

function hapusKategori(id) {
  const sh = SS.getSheetByName(SHEET_KATEGORI);
  if (!sh) return false;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.deleteRow(i + 1);
      return true;
    }
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
