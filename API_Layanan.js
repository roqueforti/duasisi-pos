// ============================================================
// LAYANAN (CRUD) — with Tipe support
// ============================================================
function getLayananList(tipeFilter) {
  const shL = SS.getSheetByName(SHEET_LAYANAN);
  const shK = SS.getSheetByName(SHEET_KATEGORI);
  const katData = shK ? shK.getDataRange().getValues() : [];
  const katMap = {};
  const katIconMap = {};
  katData.forEach(r => { 
    if (r[1]) {
      const kName = String(r[1]).trim().toLowerCase();
      katMap[kName] = r[3]; 
      katIconMap[kName] = r[4]; 
    }
  });

  const data = shL ? shL.getDataRange().getValues() : [];
  data.shift();
  let list = data.filter(r => r[5] === "Y");
  if (tipeFilter) list = list.filter(r => r[6] === tipeFilter);
  return list.map(r => {
    let pipelineSteps = [];
    try { if (r[7]) pipelineSteps = JSON.parse(r[7]); } catch(e) {}
    
    let katName = r[8] ? String(r[8]).trim() : "";
    const katKey = katName.toLowerCase();

    return {
      id: r[0], 
      nama: r[1], 
      harga: Number(r[2]) || 0, 
      satuan: r[3], 
      icon: r[4] || "🧺", 
      tipe: r[6] || "SelfService",
      kategori: katName,
      idInventory: r[9] || null,
      kategoriWarna: katMap[katKey] || (
        katKey.includes("drop") ? "bg-teal-100 text-teal-800 border-teal-300" :
        katKey.includes("add") ? "bg-amber-100 text-amber-800 border-amber-300" :
        katKey.includes("makan") || katKey.includes("minum") ? "bg-orange-100 text-orange-800 border-orange-300" :
        "bg-emerald-100 text-emerald-800 border-emerald-300"
      ),
      kategoriIcon: katIconMap[katKey] || (
        katKey.includes("drop") ? "Shirt" :
        katKey.includes("add") ? "Sparkles" :
        katKey.includes("makan") || katKey.includes("minum") ? "Coffee" :
        "Zap"
      ),
      pipelineSteps: pipelineSteps
    };
  });
}

function getLayananListAll() {
  const shL = SS.getSheetByName(SHEET_LAYANAN);
  const shK = SS.getSheetByName(SHEET_KATEGORI);
  const katData = shK ? shK.getDataRange().getValues() : [];
  const katMap = {};
  const katIconMap = {};
  katData.forEach(r => { 
    if (r[1]) {
      const kName = String(r[1]).trim().toLowerCase();
      katMap[kName] = r[3]; 
      katIconMap[kName] = r[4]; 
    }
  });

  const data = shL ? shL.getDataRange().getValues() : [];
  data.shift();
  return data.map(r => {
    let pipelineSteps = [];
    try { if (r[7]) pipelineSteps = JSON.parse(r[7]); } catch(e) {}
    
    let katName = r[8];
    if (!katName || String(katName).trim() === "") {
      const tip = String(r[6] || "").toLowerCase();
      const namaL = String(r[1] || "").toLowerCase();
      if (tip === "fullservice" || namaL.includes("setrika") || namaL.includes("bed cover") || namaL.includes("karpet") || namaL.includes("drop off")) {
        katName = "Drop Off";
      } else if (namaL.includes("deterjen") || namaL.includes("softener") || namaL.includes("kresek") || namaL.includes("plastik") || namaL.includes("pewangi")) {
        katName = "Add On";
      } else if (namaL.includes("kopi") || namaL.includes("minum") || namaL.includes("snack") || namaL.includes("teh") || namaL.includes("air")) {
        katName = "Makanan dan Minuman";
      } else {
        katName = "Self Service";
      }
    }
    const katKey = String(katName).trim().toLowerCase();

    return {
      id: r[0], 
      nama: r[1], 
      harga: Number(r[2]) || 0, 
      satuan: r[3], 
      icon: r[4] || "🧺", 
      aktif: r[5], 
      tipe: r[6] === undefined || r[6] === null ? "" : r[6],
      kategori: katName,
      idInventory: r[9] || null,
      hargaModal: Number(r[10]) || 0,
      inventoryDeductionQty: r[11] !== undefined && r[11] !== "" ? Number(r[11]) : 1,
      kategoriWarna: katMap[katKey] || (
        katKey.includes("drop") ? "bg-teal-100 text-teal-800 border-teal-300" :
        katKey.includes("add") ? "bg-amber-100 text-amber-800 border-amber-300" :
        katKey.includes("makan") || katKey.includes("minum") ? "bg-orange-100 text-orange-800 border-orange-300" :
        "bg-emerald-100 text-emerald-800 border-emerald-300"
      ),
      kategoriIcon: katIconMap[katKey] || (
        katKey.includes("drop") ? "Shirt" :
        katKey.includes("add") ? "Sparkles" :
        katKey.includes("makan") || katKey.includes("minum") ? "Coffee" :
        "Zap"
      ),
      pipelineSteps: pipelineSteps
    };
  });
}

function getProductPrefix_(kategori, tipe) {
  const kat = String(kategori || "").toLowerCase().trim();
  const tip = String(tipe || "").toLowerCase().trim();

  if (tip === "selfservice" || kat.includes("self")) return "SS";
  if (tip === "fullservice" || kat.includes("drop") || kat.includes("full")) return "DO";
  if (kat.includes("add") || kat.includes("tambahan")) return "ADD";
  if (kat.includes("retail") || kat.includes("eceran") || kat.includes("jual")) return "RTL";
  if (kat.includes("paket") || kat.includes("promo")) return "PKT";
  if (kat.includes("satuan") || kat.includes("unit")) return "STN";
  if (tip === "" || tip.includes("bukan")) return "ADD";
  return "PRD";
}

function generateLayananCode_(kategori, tipe) {
  const prefix = getProductPrefix_(kategori, tipe);
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  if (!sh) return prefix + "-001";
  const rows = sh.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const code = String(rows[i][0] || "").trim();
    if (code.startsWith(prefix + "-")) {
      const parts = code.split("-");
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
    }
  }
  return prefix + "-" + String(maxNum + 1).padStart(3, "0");
}

function tambahLayanan(data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const id = data.kode && String(data.kode).trim() ? String(data.kode).trim() : generateLayananCode_(data.kategori, data.tipe);
  const pSteps = data.pipelineSteps ? JSON.stringify(data.pipelineSteps) : "";
  let idInv = data.idInventory || "";
  
  if (data.tipe === "" && !idInv) {
    const invRes = tambahInventory({ nama: data.nama, stok: 0, satuan: data.satuan, stokMinimum: 0 });
    if (invRes.success) {
      idInv = invRes.id;
    }
  }

  if (sh.getMaxColumns() < 12) {
    sh.insertColumnsAfter(sh.getMaxColumns(), 12 - sh.getMaxColumns());
  }

  sh.appendRow([id, data.nama, data.harga, data.satuan, data.icon || "🧺", "Y", data.tipe !== undefined ? data.tipe : "", pSteps, data.kategori || "Self Service", idInv, data.hargaModal || 0, data.inventoryDeductionQty !== undefined && data.inventoryDeductionQty !== "" ? Number(data.inventoryDeductionQty) : 1]);
  return { success: true, id: id };
}

function updateLayanan(id, data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const newId = data.kode && String(data.kode).trim() ? String(data.kode).trim() : rows[i][0];
      const pSteps = data.pipelineSteps ? JSON.stringify(data.pipelineSteps) : (rows[i][7] || "");
      let idInv = data.idInventory !== undefined ? data.idInventory : (rows[i][9] || "");
      
      if (data.tipe === "" && !idInv) {
        const invRes = tambahInventory({ nama: data.nama, stok: 0, satuan: data.satuan, stokMinimum: 0 });
        if (invRes.success) {
          idInv = invRes.id;
        }
      }

      if (sh.getMaxColumns() < 12) {
        sh.insertColumnsAfter(sh.getMaxColumns(), 12 - sh.getMaxColumns());
      }

      sh.getRange(i + 1, 1, 1, 12).setValues([[newId, data.nama, data.harga, data.satuan, data.icon || "🧺", rows[i][5], data.tipe !== undefined ? data.tipe : rows[i][6], pSteps, data.kategori || rows[i][8], idInv, data.hargaModal !== undefined ? data.hargaModal : (Number(rows[i][10]) || 0), data.inventoryDeductionQty !== undefined && data.inventoryDeductionQty !== "" ? Number(data.inventoryDeductionQty) : (rows[i][11] !== undefined && rows[i][11] !== "" ? Number(rows[i][11]) : 1)]]);
      return { success: true, id: newId };
    }
  }
  return { success: false, message: "Layanan tidak ditemukan" };
}

function regenerateProductCodes() {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  if (!sh) return { success: false, message: "Sheet Layanan tidak ditemukan." };
  const rows = sh.getDataRange().getValues();
  const counters = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const prefix = getProductPrefix_(row[8], row[6]);
    counters[prefix] = (counters[prefix] || 0) + 1;
    const newCode = prefix + "-" + String(counters[prefix]).padStart(3, "0");
    sh.getRange(i + 1, 1).setValue(newCode);
  }
  SpreadsheetApp.flush();
  return { success: true, message: "Kode produk berhasil disesuaikan menurut kategori & tipe." };
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
    sh.appendRow(["ID", "Nama Kategori", "Aktif", "Warna", "Icon"]);
  }
  let data = sh.getDataRange().getValues();
  if (data.length <= 1) {
    sh.appendRow([generateId("KAT"), "Self Service", "Y", "bg-emerald-100 text-emerald-800 border-emerald-300", "Zap"]);
    sh.appendRow([generateId("KAT"), "Drop Off", "Y", "bg-teal-100 text-teal-800 border-teal-300", "Shirt"]);
    sh.appendRow([generateId("KAT"), "Add On", "Y", "bg-amber-100 text-amber-800 border-amber-300", "Sparkles"]);
    sh.appendRow([generateId("KAT"), "Makanan dan Minuman", "Y", "bg-orange-100 text-orange-800 border-orange-300", "Coffee"]);
    data = sh.getDataRange().getValues();
  }
  data.shift();
  return data.map(r => ({
    id: r[0],
    nama: r[1],
    aktif: r[2] || "Y",
    warna: r[3] || "bg-slate-100 text-slate-800 border-slate-300",
    icon: r[4] || "Tag"
  }));
}

function tambahKategori(data) {
  let sh = SS.getSheetByName(SHEET_KATEGORI);
  if (!sh) {
    sh = SS.insertSheet(SHEET_KATEGORI);
    sh.appendRow(["ID", "Nama Kategori", "Aktif", "Warna", "Icon"]);
  }
  const id = generateId("KAT");
  sh.appendRow([
    id, 
    data.nama, 
    "Y", 
    data.warna || "bg-slate-100 text-slate-800 border-slate-200",
    data.icon || "Tag"
  ]);
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
      if (data.icon) sh.getRange(i + 1, 5).setValue(data.icon);
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
  
  if (data.isDijual && data.hargaJual !== undefined) {
    tambahLayanan({
      nama: data.nama,
      harga: data.hargaJual,
      satuan: data.satuan,
      tipe: "",
      kategori: data.kategoriLayanan || "Add On",
      idInventory: id
    });
  }
  
  return { success: true, id: id };
}

function updateInventoryItem(id, data) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, 2, 1, 4).setValues([[data.nama, data.stok, data.satuan, data.stokMinimum]]);
      sh.getRange(i + 1, 6).setValue(new Date());
      return { success: true };
    }
  }
  return { success: false, message: "Item tidak ditemukan" };
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
