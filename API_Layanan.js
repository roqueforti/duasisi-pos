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

    let katDropOff = r[12] ? String(r[12]).trim() : "";
    if (!katDropOff && (r[6] === "FullService" || katKey.includes("drop"))) {
      const nLower = String(r[1] || "").toLowerCase();
      if (nLower.includes("express") || nLower.includes("ekspres")) katDropOff = "Express";
      else if (nLower.includes("kilat")) katDropOff = "Kilat";
      else if (nLower.includes("sameday")) katDropOff = "Sameday";
      else katDropOff = "Reguler";
    }

    return {
      id: r[0], 
      nama: r[1], 
      harga: Number(r[2]) || 0, 
      satuan: r[3], 
      icon: r[4] || "🧺", 
      tipe: r[6] || "SelfService",
      kategori: katName,
      kategoriDropOff: katDropOff,
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

  const rawData = shL ? shL.getDataRange().getValues() : [];
  if (rawData.length <= 1) return [];
  rawData.shift(); // Remove header row
  
  // Filter out completely blank rows
  const data = rawData.filter(r => (r[0] && String(r[0]).trim() !== "") || (r[1] && String(r[1]).trim() !== ""));
  
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

    let katDropOff = r[12] ? String(r[12]).trim() : "";
    if (!katDropOff && (r[6] === "FullService" || katKey.includes("drop"))) {
      const nLower = String(r[1] || "").toLowerCase();
      if (nLower.includes("express") || nLower.includes("ekspres")) katDropOff = "Express";
      else if (nLower.includes("kilat")) katDropOff = "Kilat";
      else if (nLower.includes("sameday")) katDropOff = "Sameday";
      else katDropOff = "Reguler";
    }

    let bahanBakuList = [];
    let idInventorySingle = r[9] || null;
    let deductionSingle = r[11] !== undefined && r[11] !== "" ? parseDecimal_(r[11], 1) : 1;

    if (r[9]) {
      const rawInv = String(r[9]).trim();
      if (rawInv.startsWith("[") && rawInv.endsWith("]")) {
        try {
          const parsed = JSON.parse(rawInv);
          if (Array.isArray(parsed)) {
            bahanBakuList = parsed.map(function(b) {
              return {
                idInventory: String(b.idInventory || '').trim(),
                qty: parseDecimal_(b.qty, 1),
                tahap: b.tahap || 'Dicuci'
              };
            });
            if (bahanBakuList.length > 0) {
              idInventorySingle = bahanBakuList[0].idInventory;
              deductionSingle = bahanBakuList[0].qty;
            }
          }
        } catch (e) {
          bahanBakuList = [{ idInventory: rawInv, qty: deductionSingle, tahap: 'Dicuci' }];
        }
      } else {
        if (r[6] === "FullService" || katKey.includes("drop")) {
          bahanBakuList = [{ idInventory: rawInv, qty: deductionSingle, tahap: 'Dicuci' }];
        } else {
          bahanBakuList = [];
        }
      }
    }

    return {
      id: r[0], 
      nama: r[1], 
      harga: Number(r[2]) || 0, 
      satuan: r[3], 
      icon: r[4] || "🧺", 
      aktif: r[5], 
      tipe: r[6] === undefined || r[6] === null ? "" : r[6],
      kategori: katName,
      kategoriDropOff: katDropOff,
      idInventory: idInventorySingle,
      bahanBakuList: bahanBakuList,
      hargaModal: Number(r[10]) || 0,
      inventoryDeductionQty: deductionSingle,
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
  const existingCodes = new Set();
  let maxNum = 0;
  for (let i = 1; i < rows.length; i++) {
    const code = String(rows[i][0] || "").trim();
    if (code) {
      existingCodes.add(code.toUpperCase());
      if (code.startsWith(prefix + "-")) {
        const parts = code.split("-");
        const numPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    }
  }
  let candidateNum = maxNum + 1;
  let candidateCode = prefix + "-" + String(candidateNum).padStart(3, "0");
  while (existingCodes.has(candidateCode.toUpperCase())) {
    candidateNum++;
    candidateCode = prefix + "-" + String(candidateNum).padStart(3, "0");
  }
  return candidateCode;
}

function findOrCreateInventoryByName_(nama, satuan, stokAwal, stokMin) {
  if (!nama || String(nama).trim() === "") return "";
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  if (!sh) return "";
  const targetName = String(nama).trim().toLowerCase();
  const rows = sh.getDataRange().getValues();
  
  // 1. Cek apakah barang dengan nama ini sudah ada di Master Inventory (cegah duplikasi)
  for (let i = 1; i < rows.length; i++) {
    const existingName = String(rows[i][1] || "").trim().toLowerCase();
    if (existingName === targetName) {
      return String(rows[i][0]).trim();
    }
  }
  
  // 2. Jika belum ada, buat baru di Sheet Inventory
  const newId = generateId("INV");
  sh.appendRow([
    newId, 
    String(nama).trim(), 
    stokAwal !== undefined ? Number(stokAwal) : 0, 
    satuan ? String(satuan).trim() : "pcs", 
    stokMin !== undefined ? Number(stokMin) : 0, 
    new Date()
  ]);
  
  addAuditLog(
    "System", 
    "Auto Tambah Inventory", 
    newId, 
    "-", 
    `Nama: ${nama}, Satuan: ${satuan || 'pcs'}`, 
    `Otomatis dibuat saat penautan layanan ${nama}`
  );
  
  return newId;
}

function tambahLayanan(data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  if (!sh) return { success: false, message: "Sheet Layanan tidak ditemukan." };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rows = sh.getDataRange().getValues();
    let id = data.kode && String(data.kode).trim() ? String(data.kode).trim() : generateLayananCode_(data.kategori, data.tipe);
    
    // ENFORCE UNIQUE CODE CONSTRAINT
    const idUpper = id.toUpperCase();
    for (let i = 1; i < rows.length; i++) {
      const existingCode = String(rows[i][0] || "").trim().toUpperCase();
      if (existingCode === idUpper) {
        return { 
          success: false, 
          message: `Kode produk "${id}" sudah terdaftar pada item "${rows[i][1]}". Kode item harus unik!` 
        };
      }
    }

    const pSteps = data.pipelineSteps ? JSON.stringify(data.pipelineSteps) : "";
    let idInv = data.idInventory || "";
    
    if (Array.isArray(data.bahanBakuList) && data.bahanBakuList.length > 0) {
      const sanitizedBahan = data.bahanBakuList.map(function(b) {
        return {
          idInventory: String(b.idInventory || '').trim(),
          qty: parseDecimal_(b.qty, 1),
          tahap: b.tahap || 'Dicuci'
        };
      });
      idInv = JSON.stringify(sanitizedBahan);
    } else if (idInv === "auto") {
      idInv = findOrCreateInventoryByName_(data.nama, data.satuan, 0, 0);
    } else if (idInv === "none" || idInv === "NONE" || idInv === "-") {
      idInv = "";
    }

    if (sh.getMaxColumns() < 13) {
      sh.insertColumnsAfter(sh.getMaxColumns(), 13 - sh.getMaxColumns());
    }

    const dedQty = data.inventoryDeductionQty !== undefined && data.inventoryDeductionQty !== "" ? parseDecimal_(data.inventoryDeductionQty, 1) : 1;

    sh.appendRow([
      id, 
      data.nama, 
      data.harga, 
      data.satuan, 
      data.icon || "🧺", 
      "Y", 
      data.tipe !== undefined ? data.tipe : "", 
      pSteps, 
      data.kategori || "Self Service", 
      idInv, 
      data.hargaModal || 0, 
      dedQty,
      data.kategoriDropOff || ""
    ]);

    try {
      sh.getRange(sh.getLastRow(), 12).setNumberFormat("#,##0.00##");
    } catch(e) {}

    addAuditLog(
      data.actor || "Manager", 
      "Tambah Layanan", 
      id, 
      "-", 
      `Nama: ${data.nama}, Harga: Rp ${Number(data.harga || 0).toLocaleString('id-ID')}, Satuan: ${data.satuan || 'kg'}, Kategori: ${data.kategori || 'Self Service'}`,
      `Penambahan master produk ${data.nama} (Kode: ${id})`
    );

    SpreadsheetApp.flush();
    return { success: true, id: id, idInventory: idInv };
  } finally {
    lock.releaseLock();
  }
}

function importLayananBatch(items, actor) {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: "Data produk layanan kosong." };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SS.getSheetByName(SHEET_LAYANAN);
    if (!sh) return { success: false, message: "Sheet Layanan tidak ditemukan." };
    
    if (sh.getMaxColumns() < 13) {
      sh.insertColumnsAfter(sh.getMaxColumns(), 13 - sh.getMaxColumns());
    }

    const currentRows = sh.getDataRange().getValues();
    const usedCodes = new Set();
    const prefixCounters = {};
    
    for (let i = 1; i < currentRows.length; i++) {
      const code = String(currentRows[i][0] || "").trim();
      if (code) {
        usedCodes.add(code.toUpperCase());
        const parts = code.split("-");
        if (parts.length >= 2) {
          const prefix = parts.slice(0, parts.length - 1).join("-");
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num)) {
            if (!prefixCounters[prefix] || num > prefixCounters[prefix]) {
              prefixCounters[prefix] = num;
            }
          }
        }
      }
    }

    const rowsToAppend = [];
    items.forEach(function(item) {
      const kat = item.kategori || "Self Service";
      const tip = item.tipe !== undefined ? item.tipe : "SelfService";
      const prefix = getProductPrefix_(kat, tip);
      
      let id = item.kode && String(item.kode).trim() ? String(item.kode).trim() : "";
      
      // Jika kode kosong atau sudah dipakai, buat kode unik berikutnya
      if (!id || usedCodes.has(id.toUpperCase())) {
        let counter = (prefixCounters[prefix] || 0) + 1;
        let genCode = prefix + "-" + String(counter).padStart(3, "0");
        while (usedCodes.has(genCode.toUpperCase())) {
          counter++;
          genCode = prefix + "-" + String(counter).padStart(3, "0");
        }
        prefixCounters[prefix] = counter;
        id = genCode;
      }
      
      usedCodes.add(id.toUpperCase());

      const pSteps = item.pipelineSteps ? (typeof item.pipelineSteps === 'string' ? item.pipelineSteps : JSON.stringify(item.pipelineSteps)) : "";
      let idInv = item.idInventory || "";
      if (idInv === "auto") {
        idInv = findOrCreateInventoryByName_(item.nama, item.satuan, 0, 0);
      } else if (idInv === "none" || idInv === "NONE" || idInv === "-") {
        idInv = "";
      }
      
      const aktif = item.aktif === false || item.aktif === "N" || item.aktif === "Non-Aktif" ? "N" : "Y";
      
      rowsToAppend.push([
        id,
        item.nama,
        Number(item.harga) || 0,
        item.satuan || (tip === "FullService" ? "kg" : "paket"),
        item.icon || "🧺",
        aktif,
        tip,
        pSteps,
        kat,
        idInv,
        Number(item.hargaModal) || 0,
        Number(item.inventoryDeductionQty) || 1,
        item.kategoriDropOff || (tip === "FullService" || kat.toLowerCase().includes("drop") ? (item.subKategori || "Reguler") : "")
      ]);
    });

    if (rowsToAppend.length > 0) {
      const lastRow = sh.getLastRow();
      sh.getRange(lastRow + 1, 1, rowsToAppend.length, 13).setValues(rowsToAppend);
    }

    addAuditLog(
      actor || "Manager",
      "Import Layanan Batch",
      "-",
      "-",
      `Berhasil mengimpor ${rowsToAppend.length} produk`,
      "Import master produk CSV dengan jaminan kode unik"
    );

    return {
      success: true,
      importedCount: rowsToAppend.length,
      message: `Berhasil mengimpor ${rowsToAppend.length} produk layanan.`
    };
  } finally {
    lock.releaseLock();
  }
}

function updateLayanan(id, data) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  if (!sh) return { success: false, message: "Sheet Layanan tidak ditemukan." };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(id)) {
        const newId = data.kode && String(data.kode).trim() ? String(data.kode).trim() : rows[i][0];
        
        // ENFORCE UNIQUE CODE: check if newId is used in OTHER rows
        if (newId.toUpperCase() !== String(id).toUpperCase()) {
          for (let j = 1; j < rows.length; j++) {
            if (j !== i && String(rows[j][0] || "").trim().toUpperCase() === newId.toUpperCase()) {
              return { 
                success: false, 
                message: `Kode produk "${newId}" sudah digunakan oleh item "${rows[j][1]}". Kode item harus unik!` 
              };
            }
          }
        }

        const pSteps = data.pipelineSteps ? JSON.stringify(data.pipelineSteps) : (rows[i][7] || "");
        let idInv = data.idInventory !== undefined ? data.idInventory : (rows[i][9] || "");
        
        if (Array.isArray(data.bahanBakuList) && data.bahanBakuList.length > 0) {
          const sanitizedBahan = data.bahanBakuList.map(function(b) {
            return {
              idInventory: String(b.idInventory || '').trim(),
              qty: parseDecimal_(b.qty, 1),
              tahap: b.tahap || 'Dicuci'
            };
          });
          idInv = JSON.stringify(sanitizedBahan);
        } else if (idInv === "auto") {
          idInv = findOrCreateInventoryByName_(data.nama || rows[i][1], data.satuan || rows[i][3], 0, 0);
        } else if (idInv === "none" || idInv === "NONE" || idInv === "-") {
          idInv = "";
        }

        if (sh.getMaxColumns() < 13) {
          sh.insertColumnsAfter(sh.getMaxColumns(), 13 - sh.getMaxColumns());
        }

        const dataSebelum = `Kode: ${rows[i][0]}, Nama: ${rows[i][1]}, Harga: Rp ${Number(rows[i][2] || 0).toLocaleString('id-ID')}, Satuan: ${rows[i][3] || 'kg'}, Kategori: ${rows[i][8] || '-'}`;
        const dataSesudah = `Kode: ${newId}, Nama: ${data.nama}, Harga: Rp ${Number(data.harga || 0).toLocaleString('id-ID')}, Satuan: ${data.satuan || 'kg'}, Kategori: ${data.kategori || rows[i][8] || '-'}`;

        const editDedQty = data.inventoryDeductionQty !== undefined && data.inventoryDeductionQty !== "" ? parseDecimal_(data.inventoryDeductionQty, 1) : (rows[i][11] !== undefined && rows[i][11] !== "" ? parseDecimal_(rows[i][11], 1) : 1);

        sh.getRange(i + 1, 1, 1, 13).setValues([[
          newId, 
          data.nama, 
          data.harga, 
          data.satuan, 
          data.icon || "🧺", 
          rows[i][5], 
          data.tipe !== undefined ? data.tipe : rows[i][6], 
          pSteps, 
          data.kategori || rows[i][8], 
          idInv, 
          data.hargaModal !== undefined ? data.hargaModal : (Number(rows[i][10]) || 0), 
          editDedQty,
          data.kategoriDropOff !== undefined ? data.kategoriDropOff : (rows[i][12] || "")
        ]]);
        try {
          sh.getRange(i + 1, 12).setNumberFormat("#,##0.00##");
        } catch(e) {}

        addAuditLog(
          data.actor || "Manager", 
          "Edit Layanan", 
          newId, 
          dataSebelum, 
          dataSesudah, 
          `Perubahan data layanan ${data.nama}`
        );

        SpreadsheetApp.flush();
        return { success: true, id: newId, idInventory: idInv };
      }
    }
    return { success: false, message: "Layanan tidak ditemukan" };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Memeriksa seluruh sheet Layanan untuk mendeteksi apakah ada kode item yang duplikat.
 * Mengembalikan ringkasan grup kode duplikat beserta saran kode unik baru.
 */
function checkDuplicateItemCodes() {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  if (!sh) return { hasDuplicates: false, totalDuplicateGroups: 0, totalDuplicateRows: 0, duplicateGroups: [] };
  
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { hasDuplicates: false, totalDuplicateGroups: 0, totalDuplicateRows: 0, duplicateGroups: [] };
  
  const codeMap = {};
  const allUsedCodes = new Set();
  const prefixCounters = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rawCode = String(row[0] || "").trim();
    if (!rawCode) continue;
    
    allUsedCodes.add(rawCode.toUpperCase());
    
    const parts = rawCode.split("-");
    if (parts.length >= 2) {
      const prefix = parts.slice(0, parts.length - 1).join("-");
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) {
        if (!prefixCounters[prefix] || num > prefixCounters[prefix]) {
          prefixCounters[prefix] = num;
        }
      }
    }
    
    if (!codeMap[rawCode]) {
      codeMap[rawCode] = [];
    }
    codeMap[rawCode].push({
      rowIndex: i + 1,
      id: rawCode,
      nama: String(row[1] || ""),
      harga: Number(row[2]) || 0,
      satuan: String(row[3] || ""),
      icon: String(row[4] || "🧺"),
      aktif: String(row[5] || "Y"),
      tipe: String(row[6] || ""),
      kategori: String(row[8] || ""),
      idInventory: String(row[9] || ""),
      hargaModal: Number(row[10]) || 0,
      inventoryDeductionQty: Number(row[11]) || 1,
      kategoriDropOff: String(row[12] || "")
    });
  }

  const duplicateGroups = [];
  let totalDuplicateRows = 0;

  for (const code in codeMap) {
    if (codeMap[code].length > 1) {
      totalDuplicateRows += codeMap[code].length;
      
      const itemsWithSuggestions = codeMap[code].map((item, idx) => {
        if (idx === 0) {
          return {
            ...item,
            isPrimary: true,
            suggestedCode: item.id
          };
        }
        
        const prefix = getProductPrefix_(item.kategori, item.tipe);
        let counter = (prefixCounters[prefix] || 0) + 1;
        let candidate = prefix + "-" + String(counter).padStart(3, "0");
        while (allUsedCodes.has(candidate.toUpperCase())) {
          counter++;
          candidate = prefix + "-" + String(counter).padStart(3, "0");
        }
        prefixCounters[prefix] = counter;
        allUsedCodes.add(candidate.toUpperCase());

        return {
          ...item,
          isPrimary: false,
          suggestedCode: candidate
        };
      });

      duplicateGroups.push({
        code: code,
        count: codeMap[code].length,
        items: itemsWithSuggestions
      });
    }
  }

  return {
    hasDuplicates: duplicateGroups.length > 0,
    totalDuplicateGroups: duplicateGroups.length,
    totalDuplicateRows: totalDuplicateRows,
    duplicateGroups: duplicateGroups
  };
}

/**
 * Menyimpan dan mengeksekusi resolusi perapian kode duplikat yang dipilih Manajemen.
 * Mendukung aksi: RENAME / AUTO_RECODE, MERGE, DELETE.
 */
function resolveDuplicateItemCodes(resolutions, actor) {
  if (!Array.isArray(resolutions) || resolutions.length === 0) {
    return { success: false, message: "Daftar perapian kode kosong." };
  }
  
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SS.getSheetByName(SHEET_LAYANAN);
    if (!sh) return { success: false, message: "Sheet Layanan tidak ditemukan." };
    
    const rows = sh.getDataRange().getValues();
    let updatedCount = 0;
    let deletedCount = 0;
    const auditLogs = [];
    
    // 1. Eksekusi Perubahan Kode (RENAME / AUTO_RECODE)
    for (const res of resolutions) {
      if (res.action === "RENAME" || res.action === "AUTO_RECODE") {
        const rIndex = Number(res.rowIndex);
        const newCode = String(res.newCode || "").trim();
        if (rIndex >= 2 && rIndex <= rows.length && newCode) {
          const oldCode = String(rows[rIndex - 1][0]);
          const nama = String(rows[rIndex - 1][1]);
          sh.getRange(rIndex, 1).setValue(newCode);
          updatedCount++;
          auditLogs.push(`Ubah kode [${nama}] dari "${oldCode}" -> "${newCode}"`);
        }
      }
    }
    
    // 2. Eksekusi Penghapusan baris (DELETE / MERGE) dari bawah ke atas agar index baris tidak bergeser
    const deleteRowIndices = resolutions
      .filter(r => r.action === "DELETE" || r.action === "MERGE")
      .map(r => Number(r.rowIndex))
      .filter(rIndex => rIndex >= 2 && rIndex <= rows.length)
      .sort((a, b) => b - a);
      
    for (const rIndex of deleteRowIndices) {
      const nama = String(rows[rIndex - 1][1]);
      const code = String(rows[rIndex - 1][0]);
      sh.deleteRow(rIndex);
      deletedCount++;
      auditLogs.push(`Hapus duplikat [${nama}] kode "${code}" (baris ${rIndex})`);
    }
    
    SpreadsheetApp.flush();
    
    if (auditLogs.length > 0) {
      addAuditLog(
        actor || "Manager",
        "Rapikan Duplikasi Kode",
        "-",
        "-",
        `Diperbarui: ${updatedCount}, Dihapus: ${deletedCount}`,
        auditLogs.slice(0, 10).join("; ") + (auditLogs.length > 10 ? ` (+${auditLogs.length - 10} lainnya)` : "")
      );
    }
    
    return {
      success: true,
      updatedCount: updatedCount,
      deletedCount: deletedCount,
      message: `Perapian kode berhasil! ${updatedCount} item diperbarui kodenya, ${deletedCount} item duplikat dibersihkan.`
    };
  } catch (err) {
    return { success: false, message: "Gagal merapikan duplikasi: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function pautkanInventoryLayanan(idLayanan, idInventory, actor) {
  if (!idLayanan) return { success: false, message: "ID Layanan wajib diisi" };
  const shL = SS.getSheetByName(SHEET_LAYANAN);
  if (!shL) return { success: false, message: "Sheet Layanan tidak ditemukan" };
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const rows = shL.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === idLayanan) {
        let finalInvId = idInventory || "";
        const namaLayanan = rows[i][1];
        const satuanLayanan = rows[i][3];
        
        if (finalInvId === "auto") {
          finalInvId = findOrCreateInventoryByName_(namaLayanan, satuanLayanan, 0, 0);
        } else if (finalInvId === "none" || finalInvId === "NONE" || finalInvId === "-") {
          finalInvId = "";
        }
        
        shL.getRange(i + 1, 10).setValue(finalInvId);
        SpreadsheetApp.flush();
        
        addAuditLog(
          actor || "Manager",
          "Pautkan Inventory Layanan",
          idLayanan,
          rows[i][9] || "Tanpa Stok",
          finalInvId || "Tanpa Stok",
          `Pautan stok layanan ${namaLayanan}`
        );
        
        return {
          success: true,
          idLayanan: idLayanan,
          idInventory: finalInvId,
          message: finalInvId ? "Berhasil ditautkan ke stok" : "Kaitan stok dilepas"
        };
      }
    }
    return { success: false, message: "Layanan tidak ditemukan" };
  } finally {
    lock.releaseLock();
  }
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
    if (rows[i][0] === id) { 
      sh.getRange(i + 1, 6).setValue(aktifBaru ? "Y" : "N"); 
      SpreadsheetApp.flush();
      return true; 
    }
  }
  return false;
}

function hapusLayanan(id, actor) {
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const nama = rows[i][1];
      sh.deleteRow(i + 1);
      SpreadsheetApp.flush();
      addAuditLog(actor || "Manager", "Hapus Layanan", id, `Nama: ${nama}, Harga: Rp ${rows[i][2]}`, "-", `Hapus master layanan ${nama}`);
      return true;
    }
  }
  return false;
}

function batchHapusLayanan(ids, actor) {
  if (!Array.isArray(ids) || ids.length === 0) return { success: false, message: "ID layanan kosong" };
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  if (!sh) return { success: false, message: "Sheet Layanan tidak ditemukan" };
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const rows = sh.getDataRange().getValues();
    const idSet = new Set(ids.map(id => String(id).trim()));
    
    let deletedCount = 0;
    for (let i = rows.length - 1; i >= 1; i--) {
      const rowId = String(rows[i][0]).trim();
      if (idSet.has(rowId)) {
        const nama = rows[i][1];
        sh.deleteRow(i + 1);
        deletedCount++;
        addAuditLog(actor || "Manager", "Hapus Layanan Massal", rowId, `Nama: ${nama}`, "-", `Hapus massal produk ${nama}`);
      }
    }
    SpreadsheetApp.flush();
    return { success: true, deletedCount: deletedCount };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function batchToggleAktifLayanan(ids, aktif, actor) {
  if (!Array.isArray(ids) || ids.length === 0) return { success: false, message: "ID layanan kosong" };
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  if (!sh) return { success: false, message: "Sheet Layanan tidak ditemukan" };
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const rows = sh.getDataRange().getValues();
    const idSet = new Set(ids.map(id => String(id).trim()));
    const val = aktif ? "Y" : "N";
    
    let updatedCount = 0;
    for (let i = 1; i < rows.length; i++) {
      const rowId = String(rows[i][0]).trim();
      if (idSet.has(rowId)) {
        sh.getRange(i + 1, 6).setValue(val);
        updatedCount++;
      }
    }
    SpreadsheetApp.flush();
    addAuditLog(actor || "Manager", "Toggle Status Layanan Massal", ids.join(", "), "-", `Status diubah ke ${val} (${updatedCount} item)`, `Ubah status massal`);
    return { success: true, updatedCount: updatedCount };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function batchUbahKategoriLayanan(ids, kategoriBaru, actor) {
  if (!Array.isArray(ids) || ids.length === 0 || !kategoriBaru) return { success: false, message: "Parameter tidak valid" };
  const sh = SS.getSheetByName(SHEET_LAYANAN);
  if (!sh) return { success: false, message: "Sheet Layanan tidak ditemukan" };
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const rows = sh.getDataRange().getValues();
    const idSet = new Set(ids.map(id => String(id).trim()));
    
    let updatedCount = 0;
    for (let i = 1; i < rows.length; i++) {
      const rowId = String(rows[i][0]).trim();
      if (idSet.has(rowId)) {
        sh.getRange(i + 1, 9).setValue(kategoriBaru);
        updatedCount++;
      }
    }
    SpreadsheetApp.flush();
    addAuditLog(actor || "Manager", "Ubah Kategori Layanan Massal", ids.join(", "), "-", `Kategori diubah ke ${kategoriBaru} (${updatedCount} item)`, `Ubah kategori massal`);
    return { success: true, updatedCount: updatedCount };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
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
    stok: parseDecimal_(r[2], 0), 
    satuan: r[3], 
    stokMinimum: parseDecimal_(r[4], 0),
    terakhirUpdate: r[5] ? fmtWib(r[5], "dd/MM/yyyy HH:mm") : ""
  }));
}

function tambahInventory(data) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const id = generateId("INV");
  const initStok = parseDecimal_(data.stok, 0);
  const initMin = parseDecimal_(data.stokMinimum, 0);
  sh.appendRow([id, data.nama, initStok, data.satuan, initMin, new Date()]);
  try {
    const lastR = sh.getLastRow();
    sh.getRange(lastR, 3).setNumberFormat("#,##0.00##");
    sh.getRange(lastR, 5).setNumberFormat("#,##0.00##");
  } catch(e) {}
  
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

  addAuditLog(
    data.actor || "Manager", 
    "Tambah Inventory", 
    id, 
    "-", 
    `Nama: ${data.nama}, Stok Awal: ${data.stok} ${data.satuan}`, 
    `Penambahan bahan inventory ${data.nama}`
  );
  
  return { success: true, id: id };
}

function importInventoryBatch(items, actor) {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: "Data inventory kosong." };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SS.getSheetByName(SHEET_INVENTORY);
    if (!sh) return { success: false, message: "Sheet Inventory tidak ditemukan." };

    const rowsToAppend = [];
    const now = new Date();
    items.forEach(function(item) {
      const id = generateId("INV");
      rowsToAppend.push([
        id,
        item.nama,
        parseDecimal_(item.stok, 0),
        item.satuan || "pcs",
        parseDecimal_(item.stokMinimum, 0),
        now
      ]);
    });

    if (rowsToAppend.length > 0) {
      const lastRow = sh.getLastRow();
      sh.getRange(lastRow + 1, 1, rowsToAppend.length, 6).setValues(rowsToAppend);
      try {
        sh.getRange(lastRow + 1, 3, rowsToAppend.length, 1).setNumberFormat("#,##0.00##");
        sh.getRange(lastRow + 1, 5, rowsToAppend.length, 1).setNumberFormat("#,##0.00##");
      } catch(e) {}
    }

    addAuditLog(
      actor || "Manager",
      "Import Inventory Batch",
      "-",
      "-",
      `Berhasil mengimpor ${rowsToAppend.length} item inventory`,
      "Import master data inventory CSV"
    );

    return {
      success: true,
      importedCount: rowsToAppend.length,
      message: `Berhasil mengimpor ${rowsToAppend.length} barang stok.`
    };
  } finally {
    lock.releaseLock();
  }
}

function updateInventoryItem(id, data) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const editStok = parseDecimal_(data.stok, 0);
      const editMin = parseDecimal_(data.stokMinimum, 0);
      const dataSebelum = `Nama: ${rows[i][1]}, Stok: ${rows[i][2]} ${rows[i][3]}, Min: ${rows[i][4]}`;
      const dataSesudah = `Nama: ${data.nama}, Stok: ${editStok} ${data.satuan}, Min: ${editMin}`;
      
      sh.getRange(i + 1, 2, 1, 4).setValues([[data.nama, editStok, data.satuan, editMin]]);
      sh.getRange(i + 1, 6).setValue(new Date());
      try {
        sh.getRange(i + 1, 3).setNumberFormat("#,##0.00##");
        sh.getRange(i + 1, 5).setNumberFormat("#,##0.00##");
      } catch(e) {}

      addAuditLog(
        data.actor || "Manager", 
        "Edit Inventory", 
        id, 
        dataSebelum, 
        dataSesudah, 
        `Update konfigurasi stok ${data.nama}`
      );

      return { success: true };
    }
  }
  return { success: false, message: "Item tidak ditemukan" };
}

function updateStokInventory(id, perubahan, actor) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const stokLama = parseDecimal_(rows[i][2], 0);
      const delta = parseDecimal_(perubahan, 0);
      const stokBaru = Math.max(0, Math.round(((stokLama + delta) + 1e-7) * 10000) / 10000);
      sh.getRange(i + 1, 3).setValue(stokBaru);
      try {
        sh.getRange(i + 1, 3).setNumberFormat("#,##0.00##");
      } catch(e) {}
      sh.getRange(i + 1, 6).setValue(new Date());

      addAuditLog(
        actor || "Staff", 
        delta >= 0 ? "Restock Stok" : "Pengurangan Stok", 
        rows[i][1], 
        `Stok: ${stokLama} ${rows[i][3]}`, 
        `Stok: ${stokBaru} ${rows[i][3]}`, 
        `Penyesuaian stok ${delta >= 0 ? '+' : ''}${delta} ${rows[i][3]}`
      );

      return { success: true, stokBaru: stokBaru };
    }
  }
  return { success: false, message: "Inventory tidak ditemukan" };
}

function hapusInventory(id, actor) {
  const sh = SS.getSheetByName(SHEET_INVENTORY);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { 
      const nama = rows[i][1];
      sh.deleteRow(i + 1); 
      addAuditLog(actor || "Manager", "Hapus Inventory", id, `Nama: ${nama}`, "-", `Hapus bahan inventory ${nama}`);
      return { success: true }; 
    }
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
