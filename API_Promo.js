// ============================================================
// PROMO & VOUCHER ENGINE
// ============================================================
function getPromoList() {
  let sh = SS.getSheetByName(SHEET_PROMO);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PROMO);
    sh.appendRow(["ID", "Kode Voucher", "Jenis Diskon", "Nilai Diskon", "Min Transaksi", "Status", "Target Pelanggan", "Max Pakai Per Pelanggan"]);
    sh.appendRow([generateId("PRM"), "HEMAT10", "Persen", 10, 50000, "Aktif", "SEMUA", 0]);
    sh.appendRow([generateId("PRM"), "MEMBERVIP", "Nominal", 10000, 30000, "Aktif", "MEMBER", 1]);
  }
  const data = sh.getDataRange().getValues(); 
  data.shift(); // remove header
  return data.map(r => ({
    idPromo: r[0],
    kodeVoucher: r[1],
    jenisDiskon: r[2] || "Nominal",
    nilaiDiskon: Number(r[3]) || 0,
    minTransaksi: Number(r[4]) || 0,
    statusAktif: r[5] === "Aktif",
    targetPelanggan: r[6] === "MEMBER" ? "MEMBER" : "SEMUA",
    maxPakaiPerPelanggan: r[7] !== undefined && r[7] !== "" ? Number(r[7]) : 0
  }));
}

function tambahPromo(data) {
  let sh = SS.getSheetByName(SHEET_PROMO);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PROMO);
    sh.appendRow(["ID", "Kode Voucher", "Jenis Diskon", "Nilai Diskon", "Min Transaksi", "Status", "Target Pelanggan", "Max Pakai Per Pelanggan"]);
  }
  const id = generateId("PRM");
  const kode = String(data.kodeVoucher).trim().toUpperCase();
  const targetPelanggan = data.targetPelanggan === "MEMBER" ? "MEMBER" : "SEMUA";
  const maxPakai = Number(data.maxPakaiPerPelanggan) || 0;
  
  sh.appendRow([
    id, 
    kode, 
    data.jenisDiskon || "Nominal", 
    Number(data.nilaiDiskon) || 0, 
    Number(data.minTransaksi) || 0, 
    "Aktif",
    targetPelanggan,
    maxPakai
  ]);
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
      if (data.targetPelanggan !== undefined) sh.getRange(i + 1, 7).setValue(data.targetPelanggan === "MEMBER" ? "MEMBER" : "SEMUA");
      if (data.maxPakaiPerPelanggan !== undefined) sh.getRange(i + 1, 8).setValue(Number(data.maxPakaiPerPelanggan) || 0);
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

function validasiVoucher(kodeInput, subtotal, noHp, isMember) {
  if (!kodeInput) return { valid: false, message: "Kode voucher kosong" };
  const code = String(kodeInput).trim().toUpperCase();
  const list = getPromoList();
  const found = list.find(p => p.kodeVoucher === code && p.statusAktif);
  if (!found) return { valid: false, message: "Kode voucher tidak valid / tidak aktif" };

  // 1. Validasi Syarat Member
  if (found.targetPelanggan === "MEMBER" && !isMember) {
    return { valid: false, message: "Voucher " + code + " khusus untuk pelanggan Member." };
  }

  // 2. Validasi Min Transaksi
  if (Number(subtotal) < found.minTransaksi) {
    return { valid: false, message: "Minimal belanja Rp " + found.minTransaksi.toLocaleString('id-ID') };
  }

  // 3. Validasi Batas Pemakaian per Pelanggan
  if (found.maxPakaiPerPelanggan > 0 && noHp) {
    const cleanHp = String(noHp).replace(/[^0-9]/g, '');
    if (cleanHp) {
      const shTx = SS.getSheetByName(SHEET_TRANSAKSI);
      if (shTx) {
        const txData = shTx.getDataRange().getValues();
        let usageCount = 0;
        for (let t = 1; t < txData.length; t++) {
          const tRow = txData[t];
          const tStatus = String(tRow[5] || "");
          if (tStatus === "Dibatalkan" || tStatus === "Void") continue;

          const tHp = String(tRow[3] || "").replace(/[^0-9]/g, '');
          const tVoucher = String(tRow[9] || "").trim().toUpperCase();
          if (tVoucher === code && (tHp === cleanHp || (cleanHp.length >= 8 && (tHp.endsWith(cleanHp) || cleanHp.endsWith(tHp))))) {
            usageCount++;
          }
        }
        if (usageCount >= found.maxPakaiPerPelanggan) {
          return { 
            valid: false, 
            message: "Batas pemakaian voucher " + code + " sudah habis untuk nomor ini (" + usageCount + "/" + found.maxPakaiPerPelanggan + "x)." 
          };
        }
      }
    }
  }

  let nilaiDiskon = 0;
  if (found.jenisDiskon === "Persen") {
    nilaiDiskon = Math.round(Number(subtotal) * (found.nilaiDiskon / 100));
  } else {
    nilaiDiskon = found.nilaiDiskon;
  }
  return { 
    valid: true, 
    kode: code, 
    nilai: nilaiDiskon, 
    targetPelanggan: found.targetPelanggan,
    maxPakaiPerPelanggan: found.maxPakaiPerPelanggan,
    message: "Voucher " + code + " berhasil dipasang!" 
  };
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
