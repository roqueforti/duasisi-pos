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

function editPromo(id, data) {
  const sh = SS.getSheetByName(SHEET_PROMO);
  if (!sh) return { success: false, message: "Sheet Promo tidak ditemukan" };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      if (data.kodeVoucher) sh.getRange(i + 1, 2).setValue(String(data.kodeVoucher).trim().toUpperCase());
      if (data.jenisDiskon) sh.getRange(i + 1, 3).setValue(data.jenisDiskon);
      if (data.nilaiDiskon !== undefined) sh.getRange(i + 1, 4).setValue(Number(data.nilaiDiskon));
      if (data.minTransaksi !== undefined) sh.getRange(i + 1, 5).setValue(Number(data.minTransaksi));
      if (data.statusAktif !== undefined) sh.getRange(i + 1, 6).setValue(data.statusAktif ? "Aktif" : "Non-Aktif");
      return { success: true };
    }
  }
  return { success: false, message: "Promo tidak ditemukan" };
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
// POIN CONFIGURATION
// ============================================================
function getPoinConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    rate: Number(props.getProperty("POIN_RATE") || 10000)
  };
}

function savePoinConfig(rate) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("POIN_RATE", String(rate || 10000));
  return { success: true, message: "Konfigurasi poin berhasil disimpan!" };
}
