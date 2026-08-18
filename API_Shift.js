// ============================================================
// PEGAWAI & REKAP KINERJA (EXTENDED SCHEMA)
// ============================================================
const SHEET_PAYROLL = "MasterPayroll";

function ensurePegawaiHeaders_(sh) {
  const HEADERS = [
    "ID", "Nama Pegawai", "No HP", "Jabatan", "Status", "Tanggal Bergabung",
    "NIK", "Nama Panggilan", "Foto", "Jenis Kelamin", "Tempat Lahir", "Tanggal Lahir", "Alamat",
    "Pendidikan Jenjang", "Pendidikan Institusi", "Pendidikan Jurusan", "Pendidikan Tahun Masuk", "Pendidikan Tahun Lulus", "Pendidikan Status",
    "Status Kepegawaian", "Tanggal Masuk", "Tanggal Keluar", "Shift Utama",
    "Gaji Pokok", "Tunjangan", "Potongan", "Bank", "No Rekening", "Nama Rekening",
    "Kontak Darurat Nama", "Kontak Darurat Hubungan", "Kontak Darurat No HP"
  ];
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    return;
  }
  const currentCols = sh.getLastColumn();
  if (currentCols < HEADERS.length) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function getPegawaiList() {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return [];
  ensurePegawaiHeaders_(sh);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift();
  return data.map(r => ({
    id: String(r[0] || ""),
    nama: String(r[1] || ""),
    noHp: String(r[2] || ""),
    jabatan: String(r[3] || "Kasir / Staff"),
    status: String(r[4] || "Aktif"),
    tanggalBergabung: r[5] ? fmtWib(r[5], "yyyy-MM-dd") : "",
    nik: String(r[6] || ""),
    namaPanggilan: String(r[7] || ""),
    foto: String(r[8] || ""),
    jenisKelamin: String(r[9] || ""),
    tempatLahir: String(r[10] || ""),
    tanggalLahir: r[11] ? (r[11] instanceof Date ? fmtWib(r[11], "yyyy-MM-dd") : String(r[11])) : "",
    alamat: String(r[12] || ""),
    pendidikanJenjang: String(r[13] || ""),
    pendidikanInstitusi: String(r[14] || ""),
    pendidikanJurusan: String(r[15] || ""),
    pendidikanTahunMasuk: String(r[16] || ""),
    pendidikanTahunLulus: String(r[17] || ""),
    pendidikanStatus: String(r[18] || ""),
    statusKepegawaian: String(r[19] || "Tetap"),
    tanggalMasuk: r[20] ? (r[20] instanceof Date ? fmtWib(r[20], "yyyy-MM-dd") : String(r[20])) : "",
    tanggalKeluar: r[21] ? (r[21] instanceof Date ? fmtWib(r[21], "yyyy-MM-dd") : String(r[21])) : "",
    shiftUtama: String(r[22] || "Pagi"),
    gajiPokok: Number(r[23]) || 0,
    tunjangan: Number(r[24]) || 0,
    potongan: Number(r[25]) || 0,
    bank: String(r[26] || ""),
    noRekening: String(r[27] || ""),
    namaRekening: String(r[28] || ""),
    kontakDaruratNama: String(r[29] || ""),
    kontakDaruratHubungan: String(r[30] || ""),
    kontakDaruratNoHp: String(r[31] || "")
  }));
}

function tambahPegawai(data) {
  let sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PEGAWAI);
  }
  ensurePegawaiHeaders_(sh);
  const id = generateId("EMP");
  const row = [
    id,
    data.nama || "",
    data.noHp || "",
    data.jabatan || "Kasir / Staff",
    data.status || "Aktif",
    data.tanggalBergabung ? new Date(data.tanggalBergabung) : new Date(),
    data.nik || "",
    data.namaPanggilan || "",
    data.foto || "",
    data.jenisKelamin || "",
    data.tempatLahir || "",
    data.tanggalLahir ? new Date(data.tanggalLahir) : (data.tanggalLahir || ""),
    data.alamat || "",
    data.pendidikanJenjang || "",
    data.pendidikanInstitusi || "",
    data.pendidikanJurusan || "",
    data.pendidikanTahunMasuk || "",
    data.pendidikanTahunLulus || "",
    data.pendidikanStatus || "",
    data.statusKepegawaian || "Tetap",
    data.tanggalMasuk ? new Date(data.tanggalMasuk) : (data.tanggalMasuk || ""),
    data.tanggalKeluar ? new Date(data.tanggalKeluar) : (data.tanggalKeluar || ""),
    data.shiftUtama || "Pagi",
    Number(data.gajiPokok) || 0,
    Number(data.tunjangan) || 0,
    Number(data.potongan) || 0,
    data.bank || "",
    data.noRekening || "",
    data.namaRekening || "",
    data.kontakDaruratNama || "",
    data.kontakDaruratHubungan || "",
    data.kontakDaruratNoHp || ""
  ];
  sh.appendRow(row);
  return { success: true, id: id };
}

function updatePegawai(id, data) {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return { success: false, message: "Sheet Pegawai tidak ditemukan" };
  ensurePegawaiHeaders_(sh);
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      const row = [
        id,
        data.nama || rows[i][1],
        data.noHp !== undefined ? data.noHp : rows[i][2],
        data.jabatan || rows[i][3],
        data.status || rows[i][4],
        rows[i][5] || new Date(),
        data.nik !== undefined ? data.nik : rows[i][6],
        data.namaPanggilan !== undefined ? data.namaPanggilan : rows[i][7],
        data.foto !== undefined ? data.foto : rows[i][8],
        data.jenisKelamin !== undefined ? data.jenisKelamin : rows[i][9],
        data.tempatLahir !== undefined ? data.tempatLahir : rows[i][10],
        data.tanggalLahir !== undefined ? (data.tanggalLahir ? new Date(data.tanggalLahir) : "") : rows[i][11],
        data.alamat !== undefined ? data.alamat : rows[i][12],
        data.pendidikanJenjang !== undefined ? data.pendidikanJenjang : rows[i][13],
        data.pendidikanInstitusi !== undefined ? data.pendidikanInstitusi : rows[i][14],
        data.pendidikanJurusan !== undefined ? data.pendidikanJurusan : rows[i][15],
        data.pendidikanTahunMasuk !== undefined ? data.pendidikanTahunMasuk : rows[i][16],
        data.pendidikanTahunLulus !== undefined ? data.pendidikanTahunLulus : rows[i][17],
        data.pendidikanStatus !== undefined ? data.pendidikanStatus : rows[i][18],
        data.statusKepegawaian !== undefined ? data.statusKepegawaian : rows[i][19],
        data.tanggalMasuk !== undefined ? (data.tanggalMasuk ? new Date(data.tanggalMasuk) : "") : rows[i][20],
        data.tanggalKeluar !== undefined ? (data.tanggalKeluar ? new Date(data.tanggalKeluar) : "") : rows[i][21],
        data.shiftUtama !== undefined ? data.shiftUtama : rows[i][22],
        data.gajiPokok !== undefined ? Number(data.gajiPokok) : Number(rows[i][23]) || 0,
        data.tunjangan !== undefined ? Number(data.tunjangan) : Number(rows[i][24]) || 0,
        data.potongan !== undefined ? Number(data.potongan) : Number(rows[i][25]) || 0,
        data.bank !== undefined ? data.bank : rows[i][26],
        data.noRekening !== undefined ? data.noRekening : rows[i][27],
        data.namaRekening !== undefined ? data.namaRekening : rows[i][28],
        data.kontakDaruratNama !== undefined ? data.kontakDaruratNama : rows[i][29],
        data.kontakDaruratHubungan !== undefined ? data.kontakDaruratHubungan : rows[i][30],
        data.kontakDaruratNoHp !== undefined ? data.kontakDaruratNoHp : rows[i][31]
      ];
      sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return { success: true, id: id };
    }
  }
  return { success: false, message: "Pegawai tidak ditemukan" };
}

function hapusPegawai(id) {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return false;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

// ============================================================
// PAYROLL & PENGGAJIAN ENGINE
// ============================================================
function ensurePayrollHeaders_(sh) {
  const HEADERS = [
    "ID Payroll", "Periode", "ID Pegawai", "Nama Pegawai", "Jabatan",
    "Gaji Pokok", "Tunjangan", "Bonus Komisi", "Potongan", "Total Gaji Bersih",
    "Jumlah Kehadiran", "Jumlah Keterlambatan", "Total Jam Kerja", "Status Pembayaran", "Tanggal Pembayaran", "Metode Pembayaran", "Catatan"
  ];
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    return;
  }
}

function getPayrollSummary(periodeStr) {
  const targetPeriode = periodeStr || fmtWib(new Date(), "yyyy-MM");
  const parts = targetPeriode.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  const pegawaiList = getPegawaiList();
  
  const startDateStr = `${targetPeriode}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endDateStr = `${targetPeriode}-${String(endDay).padStart(2, '0')}`;
  
  const absensiList = getRekapAbsensi(startDateStr, endDateStr);
  const kinerjaList = getRekapKinerjaPegawai(startDateStr, endDateStr);

  let shPay = SS.getSheetByName(SHEET_PAYROLL);
  if (!shPay) {
    shPay = SS.insertSheet(SHEET_PAYROLL);
    ensurePayrollHeaders_(shPay);
  }
  const payRows = shPay.getDataRange().getValues();
  const paidMap = {};
  for (let i = 1; i < payRows.length; i++) {
    const rowPeriode = payRows[i][1];
    const rowPegawaiId = payRows[i][2];
    if (rowPeriode === targetPeriode) {
      paidMap[rowPegawaiId] = {
        idPayroll: payRows[i][0],
        status: payRows[i][13] || "Sudah Dibayar",
        tanggalBayar: payRows[i][14] ? fmtWib(payRows[i][14], "yyyy-MM-dd HH:mm") : "",
        metodeBayar: payRows[i][15] || "Transfer",
        catatan: payRows[i][16] || "",
        gajiPokok: Number(payRows[i][5]) || 0,
        tunjangan: Number(payRows[i][6]) || 0,
        bonusKomisi: Number(payRows[i][7]) || 0,
        potongan: Number(payRows[i][8]) || 0,
        totalGajiBersih: Number(payRows[i][9]) || 0
      };
    }
  }

  const items = pegawaiList.map(peg => {
    const empAbs = absensiList.filter(a => a.namaPegawai === peg.nama);
    const jumlahHadir = empAbs.length;
    let totalJamKerja = 0;
    let jumlahTelat = 0;
    empAbs.forEach(a => {
      const durasiNum = parseFloat(a.durasi) || 0;
      totalJamKerja += durasiNum;
      if (a.catatan && a.catatan.includes("TERLAMBAT")) {
        jumlahTelat += 1;
      }
    });

    const empKin = kinerjaList.find(k => k.nama === peg.nama || k.id === peg.id);
    const totalOmzet = empKin ? empKin.totalOmzet : 0;
    const totalTransaksi = empKin ? empKin.totalTransaksi : 0;

    const savedPay = paidMap[peg.id];

    const gajiPokok = savedPay ? savedPay.gajiPokok : (peg.gajiPokok || 0);
    const tunjangan = savedPay ? savedPay.tunjangan : (peg.tunjangan || 0);
    const potongan = savedPay ? savedPay.potongan : (peg.potongan || 0);
    const bonusKomisi = savedPay ? savedPay.bonusKomisi : 0;
    const totalGajiBersih = savedPay ? savedPay.totalGajiBersih : Math.max(0, (gajiPokok + tunjangan + bonusKomisi) - potongan);

    return {
      idPegawai: peg.id,
      nama: peg.nama,
      namaPanggilan: peg.namaPanggilan || "",
      jabatan: peg.jabatan,
      statusPegawai: peg.status,
      statusKepegawaian: peg.statusKepegawaian || "Tetap",
      bank: peg.bank || "",
      noRekening: peg.noRekening || "",
      namaRekening: peg.namaRekening || "",
      noHp: peg.noHp || "",
      
      periode: targetPeriode,
      gajiPokok: gajiPokok,
      tunjangan: tunjangan,
      bonusKomisi: bonusKomisi,
      potongan: potongan,
      totalGajiBersih: totalGajiBersih,

      jumlahHadir: jumlahHadir,
      totalJamKerja: Math.round(totalJamKerja * 10) / 10,
      jumlahTelat: jumlahTelat,
      totalOmzetDihasilkan: totalOmzet,
      totalTransaksiDihasilkan: totalTransaksi,

      statusPembayaran: savedPay ? (savedPay.status || "Sudah Dibayar") : "Belum Dibayar",
      tanggalPembayaran: savedPay ? savedPay.tanggalBayar : "",
      metodePembayaran: savedPay ? savedPay.metodeBayar : (peg.bank ? "Transfer" : "Tunai"),
      catatan: savedPay ? savedPay.catatan : ""
    };
  });

  return {
    periode: targetPeriode,
    totalGajiPokok: items.reduce((acc, i) => acc + i.gajiPokok, 0),
    totalTunjangan: items.reduce((acc, i) => acc + i.tunjangan, 0),
    totalBonus: items.reduce((acc, i) => acc + i.bonusKomisi, 0),
    totalPotongan: items.reduce((acc, i) => acc + i.potongan, 0),
    totalPengeluaranGaji: items.reduce((acc, i) => acc + i.totalGajiBersih, 0),
    totalPegawai: items.length,
    sudahDibayarCount: items.filter(i => i.statusPembayaran === "Sudah Dibayar").length,
    belumDibayarCount: items.filter(i => i.statusPembayaran !== "Sudah Dibayar").length,
    items: items
  };
}

function savePayrollPayment(idPegawai, periode, payload) {
  let sh = SS.getSheetByName(SHEET_PAYROLL);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PAYROLL);
  }
  ensurePayrollHeaders_(sh);
  const rows = sh.getDataRange().getValues();
  const now = new Date();
  
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === periode && rows[i][2] === idPegawai) {
      sh.getRange(i + 1, 6).setValue(Number(payload.gajiPokok) || rows[i][5]);
      sh.getRange(i + 1, 7).setValue(Number(payload.tunjangan) || rows[i][6]);
      sh.getRange(i + 1, 8).setValue(Number(payload.bonusKomisi) || rows[i][7]);
      sh.getRange(i + 1, 9).setValue(Number(payload.potongan) || rows[i][8]);
      sh.getRange(i + 1, 10).setValue(Number(payload.totalGajiBersih) || rows[i][9]);
      sh.getRange(i + 1, 14).setValue(payload.statusPembayaran || "Sudah Dibayar");
      sh.getRange(i + 1, 15).setValue(payload.statusPembayaran === "Belum Dibayar" ? "" : now);
      sh.getRange(i + 1, 16).setValue(payload.metodePembayaran || "Transfer");
      sh.getRange(i + 1, 17).setValue(payload.catatan || "");
      return { success: true, message: "Status pembayaran gaji berhasil diperbarui" };
    }
  }

  const idPayroll = generateId("PAY");
  const newRow = [
    idPayroll,
    periode,
    idPegawai,
    payload.nama || "",
    payload.jabatan || "",
    Number(payload.gajiPokok) || 0,
    Number(payload.tunjangan) || 0,
    Number(payload.bonusKomisi) || 0,
    Number(payload.potongan) || 0,
    Number(payload.totalGajiBersih) || 0,
    Number(payload.jumlahHadir) || 0,
    Number(payload.jumlahTelat) || 0,
    Number(payload.totalJamKerja) || 0,
    payload.statusPembayaran || "Sudah Dibayar",
    now,
    payload.metodePembayaran || "Transfer",
    payload.catatan || ""
  ];
  sh.appendRow(newRow);
  return { success: true, idPayroll: idPayroll, message: "Pembayaran gaji berhasil dicatat" };
}

function getRekapKinerjaPegawai(startDateStr, endDateStr) {
  const shT = SS.getSheetByName(SHEET_TRANSAKSI);
  const shP = SS.getSheetByName(SHEET_PEGAWAI);
  const dataT = shT ? shT.getDataRange().getValues() : []; dataT.shift();
  const dataP = shP ? shP.getDataRange().getValues() : []; dataP.shift();

  const pegawaiMap = {};
  dataP.forEach(r => {
    pegawaiMap[r[1]] = {
      id: r[0],
      nama: r[1],
      jabatan: r[3],
      totalTransaksi: 0,
      totalOmzet: 0
    };
  });

  dataT.forEach(r => {
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    if (!startDateStr || !endDateStr || (tgl >= startDateStr && tgl <= endDateStr)) {
      const namaPetugas = r[7] || "Kasir";
      const total = Number(r[4]) || 0;
      if (!pegawaiMap[namaPetugas]) {
        pegawaiMap[namaPetugas] = { id: "-", nama: namaPetugas, jabatan: "Kasir/Petugas", totalTransaksi: 0, totalOmzet: 0 };
      }
      pegawaiMap[namaPetugas].totalTransaksi += 1;
      pegawaiMap[namaPetugas].totalOmzet += total;
    }
  });

  return Object.values(pegawaiMap)
    .map(p => ({
      id: p.id,
      nama: p.nama,
      jabatan: p.jabatan,
      totalTransaksi: Number(p.totalTransaksi) || 0,
      totalOmzet: Number(p.totalOmzet) || 0
    }))
    .sort((a, b) => b.totalOmzet - a.totalOmzet);
}

// ============================================================
// ABSENSI SHIFT (CLOCK IN / OUT)
// ============================================================
function clockInPegawai(namaPegawai, shift, catatan) {
  let sh = SS.getSheetByName(SHEET_ABSENSI);
  if (!sh) { sh = SS.insertSheet(SHEET_ABSENSI); sh.appendRow(["ID", "Tanggal", "Nama Pegawai", "Shift", "Clock In", "Clock Out", "Durasi Kerja", "Catatan"]); }
  
  const now = new Date();
  const tglStr = fmtWib(now, "yyyy-MM-dd");
  const clockInStr = fmtWib(now);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowTgl = data[i][1] ? fmtWib(data[i][1], "yyyy-MM-dd") : "";
    if (rowTgl === tglStr && data[i][2] === namaPegawai && !data[i][5]) {
      return { success: false, message: "Pegawai ini sudah Clock In (belum Clock Out)." };
    }
  }

  // Cek Keterlambatan
  let finalCatatan = catatan || "";
  try {
    const masterShifts = getMasterShiftList();
    const targetShift = masterShifts.find(s => s.nama === shift);
    if (targetShift && targetShift.jamMasuk) {
      const config = getAbsensiConfig();
      // Format jamMasuk: "HH:mm" (e.g., "07:00")
      const [shHH, shMM] = targetShift.jamMasuk.split(":").map(Number);
      
      const jamMulaiShift = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shHH, shMM, 0);
      jamMulaiShift.setMinutes(jamMulaiShift.getMinutes() + config.toleransiTelatMenit);
      
      if (now.getTime() > jamMulaiShift.getTime()) {
        const diffMs = now.getTime() - (jamMulaiShift.getTime() - (config.toleransiTelatMenit * 60000));
        const diffMenit = Math.floor(diffMs / 60000);
        const warning = `[TERLAMBAT ${diffMenit} Menit]`;
        finalCatatan = finalCatatan ? `${warning} ${finalCatatan}` : warning;
      }
    }
  } catch(e) {
    // Abaikan jika error deteksi keterlambatan
  }

  sh.appendRow([generateId("ABS"), now, namaPegawai, shift || "Pagi", clockInStr, "", "", finalCatatan]);
  return { success: true, message: "✅ Clock In Berhasil (" + clockInStr + ")" };
}

function clockOutPegawai(namaPegawai, catatanOut) {
  const sh = SS.getSheetByName(SHEET_ABSENSI);
  if (!sh) return { success: false, message: "Sheet Absensi belum ada." };
  const now = new Date();
  const tglStr = fmtWib(now, "yyyy-MM-dd");
  const clockOutStr = fmtWib(now);
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const rowTgl = rows[i][1] ? fmtWib(rows[i][1], "yyyy-MM-dd") : "";
    if (rowTgl === tglStr && rows[i][2] === namaPegawai && !rows[i][5]) {
      const diffMs = now.getTime() - new Date(rows[i][1]).getTime();
      const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
      sh.getRange(i + 1, 6).setValue(clockOutStr);
      sh.getRange(i + 1, 7).setValue(diffHours + " Jam");
      if (catatanOut) {
        const catLama = rows[i][7] || "";
        sh.getRange(i + 1, 8).setValue(catLama ? catLama + " | Out: " + catatanOut : "Out: " + catatanOut);
      }
      return { success: true, message: "✅ Clock Out! Durasi: " + diffHours + " Jam" };
    }
  }
  return { success: false, message: "Tidak ditemukan Clock In aktif hari ini." };
}

function getStatusAbsensiHariIni(namaPegawai) {
  const sh = SS.getSheetByName(SHEET_ABSENSI);
  if (!sh) return { status: "BELUM_IN" };
  const tglStr = fmtWib(new Date(), "yyyy-MM-dd");
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    const rowTgl = rows[i][1] ? fmtWib(rows[i][1], "yyyy-MM-dd") : "";
    if (rowTgl === tglStr && rows[i][2] === namaPegawai) {
      if (!rows[i][5]) return { status: "SUDAH_IN", clockIn: rows[i][4], shift: rows[i][3] };
      else return { status: "SUDAH_OUT", clockIn: rows[i][4], clockOut: rows[i][5], durasi: rows[i][6] };
    }
  }
  return { status: "BELUM_IN" };
}

function getRekapAbsensi(startDateStr, endDateStr) {
  const sh = SS.getSheetByName(SHEET_ABSENSI);
  if (!sh) return [];
  const data = sh.getDataRange().getValues(); data.shift();
  const filtered = data.filter(r => {
    if (!r[1]) return false;
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    return (!startDateStr || !endDateStr || (tgl >= startDateStr && tgl <= endDateStr));
  });
  return filtered.map(r => ({
    id: r[0], tanggal: fmtWib(r[1], "dd/MM/yyyy"), namaPegawai: r[2], shift: r[3],
    clockIn: r[4], clockOut: r[5] || "-", durasi: r[6] || "-", catatan: r[7] || "-"
  })).reverse();
}

// ============================================================
// MASTER SHIFT
// ============================================================
function getMasterShiftList() {
  let sh = SS.getSheetByName(SHEET_SHIFT);
  if (!sh) {
    sh = SS.insertSheet(SHEET_SHIFT);
    sh.appendRow(["ID", "Nama Shift", "Jam Masuk", "Jam Keluar", "Keterangan"]);
    sh.appendRow([generateId(), "Shift 1 (Pagi)", "07:00", "15:00", "Shift Pagi Utama"]);
    sh.appendRow([generateId(), "Shift 2 (Sore/Malam)", "15:00", "23:00", "Shift Sore/Malam Utama"]);
  }
  const data = sh.getDataRange().getValues(); data.shift();
  return data.map(r => ({ id: r[0], nama: r[1], jamMasuk: r[2], jamKeluar: r[3], keterangan: r[4] || "" }));
}

function tambahMasterShift(data) {
  let sh = SS.getSheetByName(SHEET_SHIFT);
  if (!sh) { sh = SS.insertSheet(SHEET_SHIFT); sh.appendRow(["ID", "Nama Shift", "Jam Masuk", "Jam Keluar", "Keterangan"]); }
  const id = generateId("SFT");
  sh.appendRow([id, data.nama, data.jamMasuk || "07:00", data.jamKeluar || "15:00", data.keterangan || ""]);
  return { success: true, id: id };
}

function hapusMasterShift(id) {
  const sh = SS.getSheetByName(SHEET_SHIFT);
  if (!sh) return false;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

// ============================================================
// KAS SHIFT & SERAH TERIMA
// ============================================================
function getKasShiftAktif(outlet) {
  const sh = SS.getSheetByName(SHEET_KAS_SHIFT);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][10] === "Aktif" && (!outlet || rows[i][1] === outlet)) {
      return {
        idShift: rows[i][0],
        idOutlet: rows[i][1],
        namaKasir: rows[i][2],
        idUser: rows[i][3],
        waktuBuka: new Date(rows[i][4]).toISOString(),
        kasAwal: Number(rows[i][6]) || 0,
        kasAkhirSistem: Number(rows[i][7]) || 0,
        status: "Buka"
      };
    }
  }
  return null;
}

function openKasShift(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let sh = SS.getSheetByName(SHEET_KAS_SHIFT);
    if (!sh) {
      ensureSheetSchema_(SHEET_KAS_SHIFT, ["ID Kas Shift", "Outlet", "Nama Penanggung Jawab", "ID Penanggung Jawab", "Waktu Buka", "Waktu Tutup", "Kas Awal", "Kas Akhir Sistem", "Kas Akhir Fisik", "Selisih", "Status", "Mode Tutup", "ID Pengganti", "Nama Pengganti", "Waktu Handover", "Catatan"]);
      sh = SS.getSheetByName(SHEET_KAS_SHIFT);
    }
    const outlet = data.idOutlet || data.outlet || "OUTLET-UTAMA";
    if (getKasShiftAktif(outlet)) return { success: false, message: "Masih ada kas shift aktif pada outlet ini." };
    const kasAwal = Number(data.kasAwal);
    if (!isFinite(kasAwal) || kasAwal < 0) return { success: false, message: "Kas awal tidak valid." };
    const id = generateId("KAS");
    const now = new Date();
    sh.appendRow([id, outlet, data.namaKasir || data.userName || "Kasir", data.userId || "-", now, "", kasAwal, "", "", "", "Aktif", "", "", "", "", data.catatan || ""]);
    addAuditLog(data.namaKasir || data.userName || "Kasir", "Buka Kas Shift", id, "Outlet: " + outlet + "; kas awal Rp " + kasAwal.toLocaleString('id-ID'));
    return { success: true, data: getKasShiftAktif(outlet) };
  } finally {
    lock.releaseLock();
  }
}

function findEmployeeNameById_(employeeId) {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return "";
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(employeeId)) return String(rows[i][1]);
  return "";
}

function handoverCheckKasShift(data) {
  const active = getKasShiftAktif(data.idOutlet || data.outlet || "OUTLET-UTAMA");
  if (!active || active.idShift !== data.shiftId) return { eligible: false, clockedIn: false, message: "Kas shift aktif tidak ditemukan." };
  if (!data.replacementEmployeeId || String(data.replacementEmployeeId) === String(active.idUser)) {
    return { eligible: false, clockedIn: false, message: "Staf pengganti harus berbeda dari penanggung jawab kas." };
  }
  const replacementName = findEmployeeNameById_(data.replacementEmployeeId);
  if (!replacementName) return { eligible: false, clockedIn: false, message: "Staf pengganti tidak ditemukan." };
  const attendance = SS.getSheetByName(SHEET_ABSENSI);
  if (!attendance) return { eligible: false, clockedIn: false, message: "Staf pengganti belum Clock In." };
  const today = fmtWib(new Date(), "yyyy-MM-dd");
  const rows = attendance.getDataRange().getValues();
  const clockedIn = rows.some(function(row, index) {
    return index > 0 && row[1] && fmtWib(row[1], "yyyy-MM-dd") === today && row[2] === replacementName && row[4] && !row[5];
  });
  return { eligible: clockedIn, clockedIn: clockedIn, replacementEmployeeId: data.replacementEmployeeId, replacementName: replacementName, message: clockedIn ? "Staf pengganti sudah Clock In." : "Staf pengganti belum Clock In." };
}

function calculateShiftCash_(openedAt) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) return 0;
  const rows = sh.getDataRange().getValues();
  return rows.reduce(function(total, row, index) {
    if (index === 0 || !row[1] || new Date(row[1]).getTime() < openedAt.getTime()) return total;
    if (row[9] === "Approved" || row[5] === "Void" || row[5] === "Batal") return total;
    if (row[13] !== "Tunai") return total;
    return total + (Number(row[15]) || Number(row[4]) || 0);
  }, 0);
}
