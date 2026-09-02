// ============================================================
// TRANSAKSI (POS) — with Pipeline auto-create
// ============================================================
function generateNoNota(existingRows) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const today = fmtWib(new Date(), "yyMMdd");
  if (!sh) return "LDY-" + today + "-0001";
  const rows = existingRows || sh.getDataRange().getValues();
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
    const sheetRows = sh.getDataRange().getValues();
    const isCustomNota = (data.noNota && !String(data.noNota).startsWith('OFF-') && !String(data.noNota).startsWith('TRX-'));
    const noNota = isCustomNota ? String(data.noNota) : generateNoNota(sheetRows);
    const tanggal = data.tanggal ? new Date(data.tanggal) : new Date();

    if (isCustomNota) {
      const duplicate = sheetRows.some(function(row, index) { return index > 0 && String(row[0]) === noNota; });
      if (duplicate) throw new Error("Nomor nota sudah digunakan.");
    }

    items.forEach(function(item) {
      // Untuk Retail / FnB / Addon non-DropOff, potong langsung saat kasir checkout
      // Untuk Drop Off FullService, stok bahan baku akan dipotong saat tahap Dicuci (Washer)
      if (tipe !== "FullService" && item.idInventory) {
        const deductionMultiplier = item.inventoryDeductionQty !== undefined ? Number(item.inventoryDeductionQty) : 1;
        updateStokInventory(item.idInventory, -(Number(item.qty) * deductionMultiplier));
      }
    });

    detailRows.forEach(function(row) { row[0] = noNota; });
    shD.getRange(shD.getLastRow() + 1, 1, detailRows.length, 5).setValues(detailRows);
    sh.appendRow([
      noNota, tanggal, data.namaPelanggan || data.pelanggan || "Pelanggan Umum", data.noHp || "",
      total, status, data.estimasiSelesai || data.estimasi || "", petugas, tipe,
      data.voucher || data.kodeVoucher || data.kodePromo || "None", "", subtotal, diskon, data.metodeBayar || "Tunai", statusPembayaran,
      nominalBayar, sisaTagihan, data.referensiPembayaran || "", data.catatan || "", data.tingkatLayanan || data.prioritas || "Reguler"
    ]);

    simpanPelangganJikaBaru(data.namaPelanggan || data.pelanggan, data.noHp, data.alamat || "", total, data.catatanPelanggan || "");
    if (tipe === "FullService") createPipelineForNota(noNota, tipe, items, petugas);
    addAuditLog(petugas, "Transaksi Baru", noNota, "Total Rp " + total.toLocaleString('id-ID') + " (" + (data.metodeBayar || "Tunai") + ", " + statusPembayaran + ")");
    SpreadsheetApp.flush();
    var notaToken = generateNotaToken_(noNota);
    return { success: true, noNota: noNota, token: notaToken, total: total, subtotal: subtotal, diskon: diskon, nominalBayar: nominalBayar, sisaTagihan: sisaTagihan, statusPembayaran: statusPembayaran, jumlahItem: items.length, tipe: tipe };
  } finally {
    lock.releaseLock();
  }
}

function importTransaksiBatch(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, message: "Data transaksi kosong." };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    const grouped = {};
    rows.forEach(function(r, idx) {
      const rawNota = r['No Nota'] || r['noNota'] || r['Nota'] || '';
      const notaKey = rawNota && String(rawNota).trim() ? String(rawNota).trim() : ("ROW_" + idx);
      if (!grouped[notaKey]) {
        const rawTgl = r['Tanggal'] || r['tanggal'] || r['Tgl'] || '';
        let tglVal = new Date();
        if (rawTgl) {
          const parsed = new Date(rawTgl);
          if (!isNaN(parsed.getTime())) tglVal = parsed;
        }

        const rawTipe = String(r['Tipe Layanan'] || r['tipe'] || r['Tipe'] || 'SelfService').trim();
        let tipeVal = 'SelfService';
        if (rawTipe.toLowerCase().includes('drop') || rawTipe.toLowerCase() === 'fullservice') {
          tipeVal = 'FullService';
        } else if (rawTipe.toLowerCase().includes('non') || rawTipe.toLowerCase().includes('bukan') || rawTipe.toLowerCase() === 'retail') {
          tipeVal = '';
        }

        grouped[notaKey] = {
          noNota: rawNota && String(rawNota).trim() ? String(rawNota).trim() : "",
          tanggal: tglVal,
          namaPelanggan: String(r['Nama Pelanggan'] || r['namaPelanggan'] || r['Pelanggan'] || 'Pelanggan Umum').trim(),
          noHp: String(r['No HP'] || r['noHp'] || r['HP'] || '').trim(),
          petugas: String(r['Petugas'] || r['Kasir'] || r['petugas'] || 'Kasir Offline').trim(),
          tipe: tipeVal,
          status: tipeVal === 'FullService' ? 'Diterima' : 'Selesai',
          metodeBayar: String(r['Metode Bayar'] || r['metodeBayar'] || 'Tunai').trim(),
          statusPembayaran: String(r['Status Pembayaran'] || r['statusPembayaran'] || 'Lunas').trim(),
          catatan: String(r['Catatan'] || r['catatan'] || 'Import Pembukuan Offline').trim(),
          items: []
        };
      }

      const itemNama = String(r['Item / Layanan'] || r['Layanan'] || r['Nama Layanan'] || r['item'] || 'Layanan Cuci').trim();
      const itemQty = Number(r['Qty'] || r['qty'] || r['Jumlah']) || 1;
      const itemHarga = Number(r['Harga Satuan'] || r['hargaSatuan'] || r['Harga'] || r['harga']) || 0;

      grouped[notaKey].items.push({
        layanan: itemNama,
        qty: itemQty,
        hargaSatuan: itemHarga
      });
    });

    Object.values(grouped).forEach(function(txData) {
      try {
        let subtotal = 0;
        txData.items.forEach(function(it) {
          subtotal += (it.qty * it.hargaSatuan);
        });
        txData.nominalBayar = txData.statusPembayaran.toLowerCase() === 'belum bayar' ? 0 : subtotal;
        txData.diskon = 0;
        
        simpanTransaksi(txData);
        successCount++;
      } catch (err) {
        failCount++;
        errors.push(err.message || String(err));
      }
    });

    return {
      success: true,
      importedCount: successCount,
      failedCount: failCount,
      errors: errors
    };
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

function updateKasirTransaksi(noNota, namaKasirBaru, editorName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SS.getSheetByName(SHEET_TRANSAKSI);
    if (!sh) return { success: false, message: "Sheet Transaksi tidak ditemukan." };
    const kasirBaru = String(namaKasirBaru || "").trim();
    if (!kasirBaru) return { success: false, message: "Nama kasir baru tidak boleh kosong." };
    
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === String(noNota).trim()) {
        const kasirLama = String(rows[i][7] || "-");
        sh.getRange(i + 1, 8).setValue(kasirBaru);
        addAuditLog(
          editorName || "Manager",
          "Edit Kasir Transaksi",
          noNota,
          kasirLama,
          kasirBaru,
          "Mengubah nama kasir transaksi " + noNota + " dari " + kasirLama + " menjadi " + kasirBaru
        );
        SpreadsheetApp.flush();
        return { success: true, noNota: noNota, kasirLama: kasirLama, kasirBaru: kasirBaru, message: "Nama kasir untuk nota " + noNota + " berhasil diperbarui menjadi " + kasirBaru };
      }
    }
    return { success: false, message: "Nota " + noNota + " tidak ditemukan." };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// VOID TRANSAKSI & AUDIT TRAIL (SRS-LNDRY-POS-001)
// ============================================================
const SHEET_AUDIT = "AuditLog";

function ensureAuditSchema_(sh) {
  const HEADERS = ["ID Log", "Waktu", "Pengguna", "Aktivitas", "Referensi", "Detail", "Data Sebelum", "Data Sesudah"];
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    return;
  }
  if (sh.getLastColumn() < HEADERS.length) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function formatLogValue_(val) {
  if (val === undefined || val === null || val === "") return "-";
  if (typeof val === "object") {
    try { return JSON.stringify(val); } catch(e) { return String(val); }
  }
  return String(val);
}

function addAuditLog(namaUser, jenisAktivitas, referensi, arg4, arg5, arg6) {
  let sh = SS.getSheetByName(SHEET_AUDIT);
  if (!sh) {
    sh = SS.insertSheet(SHEET_AUDIT);
  }
  ensureAuditSchema_(sh);
  const idLog = generateId("LOG");
  const now = new Date();
  const waktu = fmtWib(now, "yyyy-MM-dd HH:mm:ss");

  let detail = "-";
  let dataSebelum = "-";
  let dataSesudah = "-";

  // Signature check:
  // (namaUser, jenisAktivitas, referensi, dataSebelum, dataSesudah, detail)
  // vs legacy (namaUser, jenisAktivitas, referensi, detail)
  if (arg5 !== undefined) {
    dataSebelum = formatLogValue_(arg4);
    dataSesudah = formatLogValue_(arg5);
    detail = arg6 ? String(arg6) : `${jenisAktivitas} pada ${referensi}`;
  } else if (arg4 !== undefined) {
    detail = formatLogValue_(arg4);
  }

  sh.appendRow([
    idLog, 
    waktu, 
    namaUser || "System", 
    jenisAktivitas || "Activity", 
    referensi || "-", 
    detail, 
    dataSebelum, 
    dataSesudah
  ]);
}

function getAuditLogs(limit) {
  let sh = SS.getSheetByName(SHEET_AUDIT);
  if (!sh || sh.getLastRow() < 2) return [];
  ensureAuditSchema_(sh);
  const data = sh.getDataRange().getValues(); 
  data.shift(); // remove header
  
  const maxRows = Number(limit) || 500;
  const sliced = data.slice(-maxRows);

  return sliced.map(function(r) {
    return {
      idLog: r[0],
      waktu: r[1] ? (r[1] instanceof Date ? fmtWib(r[1], "yyyy-MM-dd HH:mm:ss") : String(r[1])) : "-",
      namaUser: r[2] || "System",
      jenisAktivitas: r[3] || "-",
      referensi: r[4] || "-",
      detail: r[5] || "-",
      dataSebelum: r[6] || "-",
      dataSesudah: r[7] || "-"
    };
  }).reverse();
}

function logClientActivity(namaUser, jenisAktivitas, referensi, dataSebelum, dataSesudah, detail) {
  try {
    addAuditLog(namaUser, jenisAktivitas, referensi, dataSebelum, dataSesudah, detail);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function ajukanVoidTransaksi(noNota, alasan, petugas) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) return { success: false, message: "Sheet Transaksi tidak ada" };
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === noNota) {
      if (!String(alasan || "").trim()) return { success: false, message: "Alasan void wajib diisi" };
      if (data[i][9] === "Approved" || data[i][5] === "Void") return { success: false, message: "Transaksi sudah berstatus Void" };
      if (data[i][9] === "PendingApproval") {
        // Jika sudah PendingApproval (misal retry request), perbarui alasan dan beri respon sukses
        sh.getRange(i + 1, 11).setValue(String(alasan).trim());
        return { success: true, message: "Permintaan void sudah terdaftar dan menunggu approval Manager" };
      }
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
      if (isApproved) {
        sh.getRange(i + 1, 6).setValue("Void");
        sh.getRange(i + 1, 15).setValue("Batal / Void");
        
        // Kembalikan stok inventory yang sempat terpotong
        try {
          const tipeTx = String(data[i][8] || "SelfService");
          const statusTerakhir = String(data[i][5] || "");
          const shD = SS.getSheetByName(SHEET_DETAIL);
          if (shD) {
            const detailRows = shD.getDataRange().getValues();
            const allLayanan = typeof getLayananListAll === 'function' ? getLayananListAll() : [];
            let restoredLogs = [];
            
            for (let d = 1; d < detailRows.length; d++) {
              if (String(detailRows[d][0]) === noNota) {
                const namaItem = detailRows[d][1];
                const qtyItem = Number(detailRows[d][2]) || 1;
                const lay = allLayanan.find(function(l) { return l.nama === namaItem; });
                
                if (lay) {
                  // Kasus 1: Retail / Addon / Non-DropOff (dipotong saat checkout)
                  if (tipeTx !== "FullService" && lay.idInventory) {
                    const mult = lay.inventoryDeductionQty !== undefined ? Number(lay.inventoryDeductionQty) : 1;
                    const returnQty = qtyItem * mult;
                    if (typeof updateStokInventory === 'function') {
                      updateStokInventory(lay.idInventory, returnQty, managerName || "Void System");
                    }
                    restoredLogs.push(lay.idInventory + " (+" + returnQty + ")");
                  }
                  
                  // Kasus 2: Drop Off FullService jika sudah sempat masuk tahap Dicuci / Selesai
                  if (tipeTx === "FullService") {
                    const listBahan = Array.isArray(lay.bahanBakuList) && lay.bahanBakuList.length > 0
                      ? lay.bahanBakuList
                      : (lay.idInventory ? [{ idInventory: lay.idInventory, qty: lay.inventoryDeductionQty || 1, tahap: 'Dicuci' }] : []);
                    
                    const tahapTerlewati = ["Dicuci", "Dikeringkan", "Disetrika", "Selesai", "Diambil"].indexOf(statusTerakhir) !== -1;
                    if (tahapTerlewati) {
                      listBahan.forEach(function(b) {
                        const returnQty = qtyItem * (Number(b.qty) || 1);
                        if (typeof updateStokInventory === 'function') {
                          updateStokInventory(b.idInventory, returnQty, managerName || "Void System");
                        }
                        restoredLogs.push(b.idInventory + " (+" + returnQty + ")");
                      });
                    }
                  }
                }
              }
            }
            
            if (restoredLogs.length > 0) {
              addAuditLog(managerName || "Manager", "Restorasi Stok Void", noNota, "Pengembalian stok void: " + restoredLogs.join(", "));
            }
          }
        } catch (errRestok) {
          Logger.log("Gagal mengembalikan stok void: " + errRestok);
        }
      }
      const detail = "Keputusan: " + voidStatus + "; alasan: " + (data[i][10] || "-") + "; catatan: " + (catatan || "-") + "; approver_id: " + (managerId || "-");
      addAuditLog(managerName || "Manager", isApproved ? "Approve Void" : "Reject Void", noNota, detail);
      return { success: true, statusVoid: voidStatus, status: isApproved ? "Void" : data[i][5], message: "Keputusan void berhasil disimpan (" + voidStatus + ")" };
    }
  }
  return { success: false, message: "Nota tidak ditemukan" };
}
