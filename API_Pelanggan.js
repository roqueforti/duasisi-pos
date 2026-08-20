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

  if (foundRowIdx > 0) {
    // Update existing customer stats
    const currentName = data[foundRowIdx - 1][1];
    const currentAddr = data[foundRowIdx - 1][2];
    const currentTxCount = Number(data[foundRowIdx - 1][4]) || 0;
    const currentSpend = Number(data[foundRowIdx - 1][5]) || 0;
    const currentNotes = data[foundRowIdx - 1][7] || "";
    const currentPoin = Number(data[foundRowIdx - 1][8]) || 0;
    const isMember = String(data[foundRowIdx - 1][9] || "").toUpperCase() === "MEMBER";
    const poinAdded = (isMember && poinRate > 0) ? Math.floor(spend / poinRate) : 0;

    if (nama && nama.trim()) shP.getRange(foundRowIdx, 2).setValue(nama.trim());
    if (alamat && alamat.trim()) shP.getRange(foundRowIdx, 3).setValue(alamat.trim());
    shP.getRange(foundRowIdx, 5).setValue(currentTxCount + 1);
    shP.getRange(foundRowIdx, 6).setValue(currentSpend + spend);
    shP.getRange(foundRowIdx, 7).setValue(now);
    if (catatan && catatan.trim()) shP.getRange(foundRowIdx, 8).setValue(catatan.trim());
    if (isMember) {
      shP.getRange(foundRowIdx, 9).setValue(currentPoin + poinAdded);
    }
  } else {
    // Insert new regular customer record (Status: UMUM, Poin: 0)
    // ["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan", "Saldo Poin", "Status Member"]
    const custName = nama ? nama.trim() : "Pelanggan Umum";
    shP.appendRow([cleanHp, custName, alamat || "", now, 1, spend, now, catatan || "", 0, "UMUM"]);
    addAuditLog("Kasir", "Tambah Pelanggan", cleanHp, "-", `Nama: ${custName}, HP: ${cleanHp}, Alamat: ${alamat || '-'}`, `Registrasi otomatis pelanggan baru dari transaksi`);
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
    let tglLahir = "";
    if (r[10]) {
      tglLahir = r[10] instanceof Date ? fmtWib(r[10], "yyyy-MM-dd") : String(r[10]);
    }

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
      statusKategori: statusKategori,
      tglLahir: tglLahir
    };
  });
}

function daftarMember(data) {
  const hp = normalizePhone(data.noHp || data.hp);
  if (!hp || hp.length < 8) return { success: false, message: "Nomor WhatsApp / HP tidak valid." };
  const nama = String(data.nama || "").trim();
  const alamat = String(data.alamat || "").trim();
  const tglLahir = String(data.tglLahir || data.ttl || "").trim();
  
  if (!nama) return { success: false, message: "Nama lengkap member wajib diisi." };
  if (!alamat) return { success: false, message: "Alamat tempat tinggal wajib diisi untuk pendaftaran Member." };
  if (!tglLahir) return { success: false, message: "Tanggal Lahir (TTL) wajib diisi untuk pendaftaran Member." };
  
  let shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) {
    shP = SS.insertSheet(SHEET_PELANGGAN);
    shP.appendRow(["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan", "Saldo Poin", "Status Member", "Tanggal Lahir"]);
  }

  if (shP.getMaxColumns() < 11) {
    shP.insertColumnsAfter(shP.getMaxColumns(), 11 - shP.getMaxColumns());
    shP.getRange(1, 10).setValue("Status Member");
    shP.getRange(1, 11).setValue("Tanggal Lahir");
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
    const oldRow = pData[foundRow - 1];
    const dataSebelum = `Status: ${oldRow[9] || 'UMUM'}, Nama: ${oldRow[1]}, Alamat: ${oldRow[2] || '-'}`;
    const dataSesudah = `Status: MEMBER, Nama: ${nama || oldRow[1]}, Alamat: ${alamat || oldRow[2] || '-'}, TTL: ${tglLahir || '-'}`;
    
    if (nama) shP.getRange(foundRow, 2).setValue(nama);
    if (alamat) shP.getRange(foundRow, 3).setValue(alamat);
    if (tglLahir) shP.getRange(foundRow, 11).setValue(tglLahir);
    if (data.catatan) shP.getRange(foundRow, 8).setValue(data.catatan.trim());
    shP.getRange(foundRow, 10).setValue("MEMBER");
    
    addAuditLog(
      data.petugas || "Kasir", 
      "Upgrade Member", 
      hp, 
      dataSebelum, 
      dataSesudah, 
      `Upgrade status pelanggan ${nama || oldRow[1]} menjadi Member VIP`
    );
  } else {
    shP.appendRow([hp, nama, alamat, now, 0, 0, now, data.catatan || "", 0, "MEMBER", tglLahir]);
    addAuditLog(
      data.petugas || "Kasir", 
      "Daftar Member Baru", 
      hp, 
      "-", 
      `Status: MEMBER, Nama: ${nama}, HP: ${hp}, Alamat: ${alamat || '-'}, TTL: ${tglLahir || '-'}`, 
      `Pendaftaran member baru ${nama}`
    );
  }

  return { success: true, message: `Member ${nama} berhasil didaftarkan!` };
}

function toggleStatusMember(noHp, makeMember) {
  const hp = normalizePhone(noHp);
  if (!hp) return { success: false, message: "Nomor HP tidak valid." };

  const shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) return { success: false, message: "Sheet Pelanggan tidak ada." };

  if (shP.getMaxColumns() < 11) {
    shP.insertColumnsAfter(shP.getMaxColumns(), 11 - shP.getMaxColumns());
    shP.getRange(1, 10).setValue("Status Member");
    shP.getRange(1, 11).setValue("Tanggal Lahir");
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

function updateDataPelanggan(oldHp, newHp, nama, alamat, catatan, statusMember, tglLahir) {
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

  if (shP.getMaxColumns() < 11) {
    shP.insertColumnsAfter(shP.getMaxColumns(), 11 - shP.getMaxColumns());
    shP.getRange(1, 10).setValue("Status Member");
    shP.getRange(1, 11).setValue("Tanggal Lahir");
  }

  // Update row
  shP.getRange(targetRowIdx, 1).setValue(cleanNew);
  if (nama && nama.trim()) shP.getRange(targetRowIdx, 2).setValue(nama.trim());
  if (alamat !== undefined) shP.getRange(targetRowIdx, 3).setValue(alamat.trim());
  if (catatan !== undefined) shP.getRange(targetRowIdx, 8).setValue(catatan.trim());
  if (statusMember !== undefined) shP.getRange(targetRowIdx, 10).setValue(statusMember ? "MEMBER" : "UMUM");
  if (tglLahir !== undefined) shP.getRange(targetRowIdx, 11).setValue(tglLahir);

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

  const oldRow = rows[targetRowIdx - 1];
  const dataSebelum = `Nama: ${oldRow[1]}, HP: ${oldRow[0]}, Alamat: ${oldRow[2] || '-'}, Member: ${oldRow[9] || 'UMUM'}`;
  const dataSesudah = `Nama: ${nama || oldRow[1]}, HP: ${cleanNew}, Alamat: ${alamat || oldRow[2] || '-'}, Member: ${statusMember ? "MEMBER" : "UMUM"}`;
  
  addAuditLog("Manager", "Update Pelanggan", cleanNew, dataSebelum, dataSesudah, `Edit data pelanggan ${nama || oldRow[1]}`);
  return { success: true, message: "Data pelanggan berhasil diperbarui!" };
}

function tambahPelanggan(data) {
  const noHp = String(data.noHp || data.hp || "").trim();
  const nama = String(data.nama || data.namaPelanggan || "").trim();
  const alamat = String(data.alamat || "").trim();
  const tglLahir = String(data.tglLahir || data.ttl || "").trim();
  const catatan = String(data.catatan || "").trim();
  const isMember = data.isMember === true || data.statusMember === "MEMBER";

  if (!noHp) return { success: false, message: "Nomor WhatsApp/HP wajib diisi!" };
  if (!nama) return { success: false, message: "Nama pelanggan wajib diisi!" };

  if (isMember) {
    if (!alamat) return { success: false, message: "Alamat wajib diisi untuk pendaftaran Member!" };
    if (!tglLahir) return { success: false, message: "Tanggal Lahir (TTL) wajib diisi untuk pendaftaran Member!" };
  }

  const cleanHp = normalizePhone(noHp);
  if (!cleanHp || cleanHp.length < 8) return { success: false, message: "Nomor HP tidak valid (minimal 8 digit)." };

  let shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) {
    shP = SS.insertSheet(SHEET_PELANGGAN);
    shP.appendRow(["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan", "Saldo Poin", "Status Member", "Tanggal Lahir"]);
  }

  if (shP.getMaxColumns() < 11) {
    shP.insertColumnsAfter(shP.getMaxColumns(), 11 - shP.getMaxColumns());
    shP.getRange(1, 10).setValue("Status Member");
    shP.getRange(1, 11).setValue("Tanggal Lahir");
  }

  const pData = shP.getDataRange().getValues();
  for (let i = 1; i < pData.length; i++) {
    if (normalizePhone(pData[i][0]) === cleanHp) {
      return { success: false, message: "Nomor HP " + cleanHp + " sudah terdaftar atas nama " + pData[i][1] + "." };
    }
  }

  const now = new Date();
  shP.appendRow([
    cleanHp,
    nama,
    alamat,
    now,
    0, // total order
    0, // total belanja
    "", // terakhir order
    catatan,
    0, // saldo poin
    isMember ? "MEMBER" : "UMUM",
    tglLahir
  ]);

  addAuditLog(
    data.petugas || "Staff", 
    isMember ? "Daftar Member" : "Tambah Pelanggan", 
    cleanHp, 
    "-", 
    `Status: ${isMember ? "MEMBER" : "UMUM"}, Nama: ${nama}, HP: ${cleanHp}, Alamat: ${alamat || '-'}, TTL: ${tglLahir || '-'}`, 
    `Pendaftaran manual ${isMember ? "Member" : "Pelanggan"} ${nama}`
  );
  return { 
    success: true, 
    message: (isMember ? "Member " : "Pelanggan ") + nama + " berhasil ditambahkan!",
    pelanggan: {
      noHp: cleanHp,
      nama: nama,
      alamat: alamat,
      tglLahir: tglLahir,
      statusMember: isMember ? "MEMBER" : "UMUM"
    }
  };
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

function cekPoinPelanggan(phone) {
  const norm = normalizePhone(phone);
  if (!norm || norm.length < 9) {
    return { success: false, message: "Format nomor WhatsApp tidak valid. Masukkan minimal 9 digit." };
  }

  const shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) return { success: false, message: "Database pelanggan belum tersedia." };
  const pData = shP.getDataRange().getValues();
  if (pData.length <= 1) return { success: false, message: "Data pelanggan tidak ditemukan." };
  pData.shift();

  for (let i = 0; i < pData.length; i++) {
    const r = pData[i];
    const hp = normalizePhone(r[0]);
    if (hp === norm || hp.endsWith(norm) || norm.endsWith(hp)) {
      const nama = String(r[1] || "Pelanggan");
      const nameParts = nama.split(" ");
      const maskedName = nameParts.map(part => {
        if (part.length <= 2) return part;
        return part.substring(0, 2) + "*".repeat(Math.min(part.length - 2, 4));
      }).join(" ");

      const isMember = String(r[9] || "").toUpperCase() === "MEMBER";
      const totalTx = Number(r[4]) || 0;
      const saldoPoin = Number(r[8]) || 0;

      // Ambil transaksi aktif (jika ada)
      const activeOrders = [];
      try {
        const shT = SS.getSheetByName(SHEET_TRANSAKSI);
        if (shT) {
          const tData = shT.getDataRange().getValues();
          for (let j = tData.length - 1; j >= 1; j--) {
            const tr = tData[j];
            const tHp = normalizePhone(tr[2]);
            if (tHp === hp) {
              const status = String(tr[8] || "Diterima");
              if (status !== "Selesai" && status !== "Dibatalkan") {
                activeOrders.push({
                  noNota: String(tr[0]),
                  tipe: String(tr[4]),
                  status: status,
                  estimasiSelesai: tr[18] ? fmtWib(tr[18], "dd/MM HH:mm") : "-"
                });
              }
              if (activeOrders.length >= 3) break;
            }
          }
        }
      } catch (e) {}

      return {
        success: true,
        pelanggan: {
          maskedNama: maskedName,
          maskedHp: maskPhone(hp),
          saldoPoin: saldoPoin,
          totalOrder: totalTx,
          isMember: isMember,
          statusMember: isMember ? "MEMBER VIP" : "PELANGGAN REGULER",
          activeOrders: activeOrders
        }
      };
    }
  }

  return { success: false, message: "Nomor WhatsApp belum terdaftar sebagai pelanggan di Dua SiSi Laundry." };
}

