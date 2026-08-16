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
    const tipe = r[8] || "SelfService";
    const pipeline = tipe === "FullService" ? getPipelineSteps(r[0]) : undefined;
    return {
      noNota: r[0], tanggal: fmtWib(r[1]), total: r[4], status: r[5], tipe: tipe, items: items, pipeline: pipeline
    };
  }).reverse();
}
