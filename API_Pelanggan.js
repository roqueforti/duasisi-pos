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
    shP.appendRow(["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan", "Saldo Poin"]);
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
  const props = PropertiesService.getScriptProperties();
  const poinRate = Number(props.getProperty("POIN_RATE") || 10000);
  const poinAdded = poinRate > 0 ? Math.floor(spend / poinRate) : 0;

  if (foundRowIdx > 0) {
    // Update existing customer stats
    const currentName = data[foundRowIdx - 1][1];
    const currentAddr = data[foundRowIdx - 1][2];
    const currentTxCount = Number(data[foundRowIdx - 1][4]) || 0;
    const currentSpend = Number(data[foundRowIdx - 1][5]) || 0;
    const currentNotes = data[foundRowIdx - 1][7] || "";
    const currentPoin = Number(data[foundRowIdx - 1][8]) || 0;

    if (nama && nama.trim()) shP.getRange(foundRowIdx, 2).setValue(nama.trim());
    if (alamat && alamat.trim()) shP.getRange(foundRowIdx, 3).setValue(alamat.trim());
    shP.getRange(foundRowIdx, 5).setValue(currentTxCount + 1);
    shP.getRange(foundRowIdx, 6).setValue(currentSpend + spend);
    shP.getRange(foundRowIdx, 7).setValue(now);
    if (catatan && catatan.trim()) shP.getRange(foundRowIdx, 8).setValue(catatan.trim());
    shP.getRange(foundRowIdx, 9).setValue(currentPoin + poinAdded);
  } else {
    // Insert new customer record
    // ["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan", "Saldo Poin"]
    shP.appendRow([cleanHp, nama ? nama.trim() : "Pelanggan Baru", alamat || "", now, 1, spend, now, catatan || "", poinAdded]);
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
        isRepeatOrder: totalTx > 1,
        saldoPoin: Number(r[8]) || 0
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
    const totalTx = Number(r[4]) || 0;
    const isMember = String(r[9] || "").toUpperCase() === "MEMBER";
    const statusKategori = isMember ? "Member" : (totalTx > 1 ? "Pelanggan Lama" : "Pelanggan Baru");

    return {
      noHp: hp,
      maskedHp: maskPhone(hp),
      nama: r[1] || "Pelanggan",
      alamat: r[2] || "",
      tglDaftar: r[3] ? fmtWib(r[3], "dd/MM/yyyy") : "",
      totalOrder: totalTx,
      totalSpend: Number(r[5]) || 0,
      terakhirOrder: r[6] ? fmtWib(r[6], "dd/MM/yyyy HH:mm") : "",
      catatan: r[7] || "",
      isRepeatOrder: totalTx > 1,
      saldoPoin: Number(r[8]) || 0,
      isMember: isMember,
      statusMember: isMember ? "MEMBER" : "UMUM",
      statusKategori: statusKategori
    };
  });
}

function daftarMember(data) {
  const hp = normalizePhone(data.noHp || data.hp);
  if (!hp || hp.length < 8) return { success: false, message: "Nomor WhatsApp / HP tidak valid." };
  
  let shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) {
    shP = SS.insertSheet(SHEET_PELANGGAN);
    shP.appendRow(["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan", "Saldo Poin", "Status Member"]);
  }

  if (shP.getMaxColumns() < 10) {
    shP.insertColumnsAfter(shP.getMaxColumns(), 10 - shP.getMaxColumns());
    shP.getRange(1, 10).setValue("Status Member");
  }

  const pData = shP.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < pData.length; i++) {
    if (normalizePhone(pData[i][0]) === hp) {
      foundRow = i + 1;
      break;
    }
  }

  const now = new Date();
  if (foundRow > 0) {
    if (data.nama) shP.getRange(foundRow, 2).setValue(data.nama.trim());
    if (data.alamat) shP.getRange(foundRow, 3).setValue(data.alamat.trim());
    if (data.catatan) shP.getRange(foundRow, 8).setValue(data.catatan.trim());
    shP.getRange(foundRow, 10).setValue("MEMBER");
  } else {
    shP.appendRow([hp, data.nama ? data.nama.trim() : "Member Baru", data.alamat || "", now, 0, 0, now, data.catatan || "", 0, "MEMBER"]);
  }

  return { success: true, message: `Member ${data.nama || hp} berhasil didaftarkan!` };
}

function toggleStatusMember(noHp, makeMember) {
  const hp = normalizePhone(noHp);
  if (!hp) return { success: false, message: "Nomor HP tidak valid." };

  const shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) return { success: false, message: "Sheet Pelanggan tidak ada." };

  if (shP.getMaxColumns() < 10) {
    shP.insertColumnsAfter(shP.getMaxColumns(), 10 - shP.getMaxColumns());
    shP.getRange(1, 10).setValue("Status Member");
  }

  const pData = shP.getDataRange().getValues();
  for (let i = 1; i < pData.length; i++) {
    if (normalizePhone(pData[i][0]) === hp) {
      shP.getRange(i + 1, 10).setValue(makeMember ? "MEMBER" : "UMUM");
      return { success: true, message: makeMember ? "Status berhasil diubah menjadi Member!" : "Status Member dinonaktifkan." };
    }
  }
  return { success: false, message: "Pelanggan tidak ditemukan." };
}

function updateDataPelanggan(oldHp, newHp, nama, alamat, catatan, statusMember) {
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

  if (shP.getMaxColumns() < 10) {
    shP.insertColumnsAfter(shP.getMaxColumns(), 10 - shP.getMaxColumns());
    shP.getRange(1, 10).setValue("Status Member");
  }

  // Update row
  shP.getRange(targetRowIdx, 1).setValue(cleanNew);
  if (nama && nama.trim()) shP.getRange(targetRowIdx, 2).setValue(nama.trim());
  if (alamat !== undefined) shP.getRange(targetRowIdx, 3).setValue(alamat.trim());
  if (catatan !== undefined) shP.getRange(targetRowIdx, 8).setValue(catatan.trim());
  if (statusMember !== undefined) shP.getRange(targetRowIdx, 10).setValue(statusMember ? "MEMBER" : "UMUM");

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

  const allTx = getTransaksiList();
  const filtered = allTx.filter(t => normalizePhone(t.noHp) === cleanHp);

  return filtered.map(t => {
    if (t.tipe === "FullService") {
      t.pipeline = getPipelineSteps(t.noNota);
    }
    return t;
  });
}

function importPelangganBatch(payload) {
  if (!Array.isArray(payload) || payload.length === 0) return { success: false, msg: "Data kosong" };
  
  let shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) {
    shP = SS.insertSheet(SHEET_PELANGGAN);
    shP.appendRow(["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan", "Saldo Poin"]);
  }

  const data = shP.getDataRange().getValues();
  const hpIndexMap = {}; 
  
  for (let i = 1; i < data.length; i++) {
    const rowHp = normalizePhone(data[i][0]);
    if (rowHp) hpIndexMap[rowHp] = i;
  }

  const now = new Date();
  let addedCount = 0;
  let updatedCount = 0;
  let newDataRows = [];

  payload.forEach(item => {
    if (!item.hp || !item.nama) return;
    const cleanHp = normalizePhone(item.hp);
    if (!cleanHp || cleanHp.length < 9) return;

    if (hpIndexMap.hasOwnProperty(cleanHp)) {
      const rIdx = hpIndexMap[cleanHp];
      if (!data[rIdx][1] || data[rIdx][1].toString().trim() === "") {
        shP.getRange(rIdx + 1, 2).setValue(item.nama);
        updatedCount++;
      }
    } else {
      newDataRows.push([cleanHp, item.nama, "", now, 0, 0, "", "", 0]);
      addedCount++;
      hpIndexMap[cleanHp] = data.length + newDataRows.length - 1; 
    }
  });

  if (newDataRows.length > 0) {
    shP.getRange(data.length + 1, 1, newDataRows.length, newDataRows[0].length).setValues(newDataRows);
  }

  return { success: true, added: addedCount, updated: updatedCount };
}
