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

    items.forEach(function(item) {
      if (item.idInventory) {
        const deductionMultiplier = item.inventoryDeductionQty !== undefined ? Number(item.inventoryDeductionQty) : 1;
        updateStokInventory(item.idInventory, -(Number(item.qty) * deductionMultiplier));
      }
    });

    detailRows.forEach(function(row) { row[0] = noNota; });
    shD.getRange(shD.getLastRow() + 1, 1, detailRows.length, 5).setValues(detailRows);
    sh.appendRow([
      noNota, tanggal, data.namaPelanggan || data.pelanggan || "Pelanggan Umum", data.noHp || "",
      total, status, data.estimasiSelesai || data.estimasi || "", petugas, tipe,
      "None", "", subtotal, diskon, data.metodeBayar || "Tunai", statusPembayaran,
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
