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
  let sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PEGAWAI);
  }
  ensurePegawaiHeaders_(sh);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) {
    // Auto-seed initial staff if empty
    const defaultStaff = [
      ["PEG-001", "Kasir 1 (Shift Pagi)", "081234567890", "Kasir", "Aktif", new Date()],
      ["PEG-002", "Kasir 2 (Shift Siang)", "081234567891", "Kasir", "Aktif", new Date()],
      ["PEG-003", "Admin Outlet", "081234567892", "Supervisor", "Aktif", new Date()],
      ["PEG-004", "Staff Operasional", "081234567893", "Operator Laundry", "Aktif", new Date()]
    ];
    defaultStaff.forEach(row => sh.appendRow(row));
    const seeded = sh.getDataRange().getValues();
    seeded.shift();
    return seeded.map(r => ({
      id: String(r[0] || ""),
      nama: String(r[1] || ""),
      noHp: String(r[2] || ""),
      jabatan: String(r[3] || "Kasir / Staff"),
      status: String(r[4] || "Aktif"),
      tanggalBergabung: r[5] ? fmtWib(r[5], "yyyy-MM-dd") : ""
    }));
  }
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

const SHEET_JADWAL = "MasterJadwal";
const SHEET_CUTI = "MasterCuti";
const SHEET_HARI_LIBUR = "MasterHariLibur";

function getDropoffContributionsMap_(startDateStr, endDateStr) {
  const sh = SS.getSheetByName(SHEET_PIPELINE);
  if (!sh) return { totalMap: {}, breakdownMap: {}, allSteps: [], detailedTasks: {} };
  const data = sh.getDataRange().getValues();
  const totalMap = {}; // staffName/staffId -> count
  const breakdownMap = {}; // staffName/staffId -> { [stepName]: count }
  const detailedTasks = {}; // staffName/staffId -> array of task items
  const stepSet = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // [ID, No Nota, Step, Nama Step, Status, Assigned Staff, Mesin ID, Waktu Mulai, Waktu Selesai, Catatan]
    const status = String(row[4] || "");
    const staff = String(row[5] || "").trim();
    const stepName = String(row[3] || "Langkah").trim();
    const waktuSelesai = row[8];
    if (status === "Selesai" && staff) {
      if (waktuSelesai) {
        const tgl = fmtWib(waktuSelesai, "yyyy-MM-dd");
        if (startDateStr && endDateStr && (tgl < startDateStr || tgl > endDateStr)) {
          continue;
        }
      }
      totalMap[staff] = (totalMap[staff] || 0) + 1;
      if (!breakdownMap[staff]) breakdownMap[staff] = {};
      breakdownMap[staff][stepName] = (breakdownMap[staff][stepName] || 0) + 1;
      stepSet[stepName] = true;

      if (!detailedTasks[staff]) detailedTasks[staff] = [];
      detailedTasks[staff].push({
        id: row[0],
        noNota: String(row[1] || "-"),
        step: row[2] || "-",
        namaStep: stepName,
        waktuSelesai: waktuSelesai ? (waktuSelesai instanceof Date ? fmtWib(waktuSelesai, "yyyy-MM-dd HH:mm") : String(waktuSelesai)) : "-",
        catatan: row[9] || "-"
      });
    }
  }
  return {
    totalMap: totalMap,
    breakdownMap: breakdownMap,
    allSteps: Object.keys(stepSet),
    detailedTasks: detailedTasks
  };
}

function getDendaAbsensiMap_(absensiList, config) {
  const map = {};
  if (!config.aktifDenda) return map;
  absensiList.forEach(a => {
    if (a.catatan && a.catatan.includes("[TERLAMBAT")) {
      const match = a.catatan.match(/\[TERLAMBAT (\d+) Menit/);
      if (match) {
        const menit = parseInt(match[1], 10);
        const overMenit = Math.max(0, menit - config.toleransiTelatMenit);
        let denda = 0;
        if (config.tipeDenda === "MENIT") {
          denda = overMenit * config.tarifDenda;
        } else if (config.tipeDenda === "JAM") {
          denda = Math.ceil(overMenit / 60) * config.tarifDenda;
        } else if (config.tipeDenda === "FLAT") {
          denda = config.tarifDenda;
        }
        map[a.namaPegawai] = (map[a.namaPegawai] || 0) + denda;
      }
    }
  });
  return map;
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
  const dropoffData = getDropoffContributionsMap_(startDateStr, endDateStr);
  const config = getAbsensiConfig();
  const dendaMap = getDendaAbsensiMap_(absensiList, config);

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

    // Kontribusi drop off per tahap khusus (mengecualikan pipeline umum)
    const UMUM_STEPS = ["Pesanan Diterima", "Diterima", "Siap Diambil", "Selesai"];
    const totalTahapDropOff = (dropoffData.totalMap[peg.nama] || 0) + (dropoffData.totalMap[peg.id] || 0);
    const dropoffBreakdown = dropoffData.breakdownMap[peg.nama] || dropoffData.breakdownMap[peg.id] || {};
    const empTasks = (dropoffData.detailedTasks && (dropoffData.detailedTasks[peg.nama] || dropoffData.detailedTasks[peg.id])) || [];

    const stepRates = (config && config.dropoffRates) || {
      "Dicuci": 1500,
      "Dikeringkan": 1500,
      "Disetrika": 2500,
      "Lipat & Packing": 1000,
      "Packing": 1000,
      "Spotting Noda": 2000,
      "Treatment Khusus": 3000
    };

    let totalTahapKhusus = 0;
    let insentifDropOff = 0;
    const dropoffKhususBreakdown = {};
    const dropoffUmumBreakdown = {};

    Object.keys(dropoffBreakdown).forEach(function(st) {
      const cnt = dropoffBreakdown[st] || 0;
      const isUmum = UMUM_STEPS.indexOf(st) !== -1;
      if (isUmum) {
        dropoffUmumBreakdown[st] = cnt;
      } else {
        const rate = Number(stepRates[st]) || 1500;
        totalTahapKhusus += cnt;
        insentifDropOff += (cnt * rate);
        dropoffKhususBreakdown[st] = { count: cnt, rate: rate, subtotal: cnt * rate };
      }
    });

    const dropoffDetailedTasks = empTasks.map(function(t) {
      const isUmum = UMUM_STEPS.indexOf(t.namaStep) !== -1;
      const tarif = isUmum ? 0 : (Number(stepRates[t.namaStep]) || 1500);
      return {
        id: t.id,
        noNota: t.noNota,
        step: t.step,
        namaStep: t.namaStep,
        waktuSelesai: t.waktuSelesai,
        isKhusus: !isUmum,
        tarif: tarif,
        catatan: t.catatan
      };
    });

    // Tunjangan kehadiran otomatis (bila belum diatur khusus)
    const tunjanganKehadiranOtomatis = jumlahHadir * (config.tunjanganKehadiranPerHari || 15000);
    const tunjangan = peg.tunjangan > 0 ? peg.tunjangan : tunjanganKehadiranOtomatis;

    // Denda absensi terlambat
    const dendaTelat = dendaMap[peg.nama] || 0;
    const potonganRutin = peg.potongan || 0;
    const totalPotongan = potonganRutin + dendaTelat;

    const savedPay = paidMap[peg.id];

    const gajiPokok = savedPay ? savedPay.gajiPokok : (peg.gajiPokok || 0);
    const bonusKomisi = savedPay ? savedPay.bonusKomisi : insentifDropOff;
    const finalTunjangan = savedPay ? savedPay.tunjangan : tunjangan;
    const finalPotongan = savedPay ? savedPay.potongan : totalPotongan;
    const totalGajiBersih = savedPay ? savedPay.totalGajiBersih : Math.max(0, (gajiPokok + finalTunjangan + bonusKomisi) - finalPotongan);

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
      tunjangan: finalTunjangan,
      tunjanganKehadiran: tunjanganKehadiranOtomatis,
      bonusKomisi: bonusKomisi,
      insentifDropOff: insentifDropOff,
      totalTahapDropOff: totalTahapDropOff,
      totalTahapKhusus: totalTahapKhusus,
      dropoffBreakdown: dropoffBreakdown,
      dropoffKhususBreakdown: dropoffKhususBreakdown,
      dropoffUmumBreakdown: dropoffUmumBreakdown,
      dropoffDetailedTasks: dropoffDetailedTasks,
      potongan: finalPotongan,
      potonganRutin: potonganRutin,
      dendaTelat: dendaTelat,
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
    allDropoffSteps: dropoffData.allSteps,
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
  const config = getAbsensiConfig();

  const filtered = data.filter(r => {
    if (!r[1]) return false;
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    return (!startDateStr || !endDateStr || (tgl >= startDateStr && tgl <= endDateStr));
  });

  return filtered.map(r => {
    const catatan = r[7] || "-";
    let menitTelat = 0;
    let denda = 0;
    if (catatan.includes("[TERLAMBAT")) {
      const match = catatan.match(/\[TERLAMBAT (\d+) Menit/);
      if (match) {
        menitTelat = parseInt(match[1], 10);
        const overMenit = Math.max(0, menitTelat - config.toleransiTelatMenit);
        if (config.aktifDenda) {
          if (config.tipeDenda === "MENIT") {
            denda = overMenit * config.tarifDenda;
          } else if (config.tipeDenda === "JAM") {
            denda = Math.ceil(overMenit / 60) * config.tarifDenda;
          } else if (config.tipeDenda === "FLAT") {
            denda = config.tarifDenda;
          }
        }
      }
    }

    return {
      id: r[0],
      tanggal: fmtWib(r[1], "dd/MM/yyyy"),
      tanggalRaw: fmtWib(r[1], "yyyy-MM-dd"),
      namaPegawai: r[2],
      shift: r[3],
      clockIn: r[4],
      clockOut: r[5] || "-",
      durasi: r[6] || "-",
      catatan: catatan,
      menitTelat: menitTelat,
      denda: denda
    };
  }).reverse();
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
// JADWAL KERJA PEGAWAI (ROSTER)
// ============================================================
function getJadwalKerjaList(bulanTahun) {
  let sh = SS.getSheetByName(SHEET_JADWAL);
  if (!sh) {
    sh = SS.insertSheet(SHEET_JADWAL);
    sh.appendRow(["ID", "ID Pegawai", "Nama Pegawai", "Tanggal", "Hari", "Shift", "Status", "Catatan"]);
  }
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift();

  return data
    .filter(r => {
      if (!bulanTahun) return true;
      const tgl = r[3] ? fmtWib(r[3], "yyyy-MM") : "";
      return tgl === bulanTahun;
    })
    .map(r => ({
      id: r[0],
      idPegawai: r[1] || "",
      namaPegawai: r[2] || "",
      tanggal: r[3] ? fmtWib(r[3], "yyyy-MM-dd") : "",
      hari: r[4] || "",
      shift: r[5] || "Shift 1 (Pagi)",
      status: r[6] || "Masuk", // Masuk | Libur | Cuti | Tukar Shift
      catatan: r[7] || ""
    }));
}

function saveJadwalKerjaBatch(rows) {
  let sh = SS.getSheetByName(SHEET_JADWAL);
  if (!sh) {
    sh = SS.insertSheet(SHEET_JADWAL);
    sh.appendRow(["ID", "ID Pegawai", "Nama Pegawai", "Tanggal", "Hari", "Shift", "Status", "Catatan"]);
  }
  if (Array.isArray(rows) && rows.length > 0) {
    const existing = sh.getDataRange().getValues();
    const toAppend = [];
    rows.forEach(r => {
      const tglStr = r.tanggal ? (r.tanggal instanceof Date ? fmtWib(r.tanggal, "yyyy-MM-dd") : String(r.tanggal).slice(0, 10)) : "";
      let foundIdx = -1;
      for (let i = 1; i < existing.length; i++) {
        const rowTgl = existing[i][3] ? fmtWib(existing[i][3], "yyyy-MM-dd") : "";
        if (existing[i][1] === r.idPegawai && rowTgl === tglStr) {
          foundIdx = i;
          break;
        }
      }
      if (foundIdx !== -1) {
        // Update existing row
        sh.getRange(foundIdx + 1, 3).setValue(r.namaPegawai || "");
        sh.getRange(foundIdx + 1, 5).setValue(r.hari || "");
        sh.getRange(foundIdx + 1, 6).setValue(r.shift || "Shift 1 (Pagi)");
        sh.getRange(foundIdx + 1, 7).setValue(r.status || "Masuk");
        sh.getRange(foundIdx + 1, 8).setValue(r.catatan || "");
      } else {
        const id = r.id || generateId("JDW");
        toAppend.push([
          id,
          r.idPegawai || "",
          r.namaPegawai || "",
          r.tanggal ? new Date(r.tanggal) : new Date(),
          r.hari || "",
          r.shift || "Shift 1 (Pagi)",
          r.status || "Masuk",
          r.catatan || ""
        ]);
      }
    });

    if (toAppend.length > 0) {
      toAppend.forEach(row => sh.appendRow(row));
    }
  }
  return { success: true, message: "Jadwal kerja berhasil disimpan!" };
}

function hapusJadwalKerja(id) {
  const sh = SS.getSheetByName(SHEET_JADWAL);
  if (!sh) return false;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.deleteRow(i + 1);
      return { success: true, message: "Jadwal berhasil dihapus." };
    }
  }
  return { success: false, message: "Jadwal tidak ditemukan." };
}

// ============================================================
// MANAJEMEN CUTI & IZIN
// ============================================================
function getCutiList(bulanTahun) {
  let sh = SS.getSheetByName(SHEET_CUTI);
  if (!sh) {
    sh = SS.insertSheet(SHEET_CUTI);
    sh.appendRow(["ID", "ID Pegawai", "Nama Pegawai", "Jenis Cuti", "Tgl Mulai", "Tgl Selesai", "Jumlah Hari", "Alasan", "Status", "Waktu Pengajuan"]);
  }
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift();

  return data
    .filter(r => {
      if (!bulanTahun) return true;
      const tgl = r[4] ? fmtWib(r[4], "yyyy-MM") : "";
      return !tgl || tgl === bulanTahun;
    })
    .map(r => ({
      id: r[0],
      idPegawai: r[1] || "",
      namaPegawai: r[2] || "",
      jenisCuti: r[3] || "Cuti Tahunan",
      tglMulai: r[4] ? fmtWib(r[4], "yyyy-MM-dd") : "",
      tglSelesai: r[5] ? fmtWib(r[5], "yyyy-MM-dd") : "",
      jumlahHari: Number(r[6]) || 1,
      alasan: r[7] || "",
      status: r[8] || "Disetujui", // "Disetujui" | "Pending" | "Ditolak"
      waktuPengajuan: r[9] ? fmtWib(r[9], "yyyy-MM-dd HH:mm") : ""
    })).reverse();
}

function tambahCuti(data) {
  let sh = SS.getSheetByName(SHEET_CUTI);
  if (!sh) {
    sh = SS.insertSheet(SHEET_CUTI);
    sh.appendRow(["ID", "ID Pegawai", "Nama Pegawai", "Jenis Cuti", "Tgl Mulai", "Tgl Selesai", "Jumlah Hari", "Alasan", "Status", "Waktu Pengajuan"]);
  }
  const id = generateId("CUT");
  const now = new Date();
  sh.appendRow([
    id,
    data.idPegawai || "",
    data.namaPegawai || "",
    data.jenisCuti || "Cuti Tahunan",
    data.tglMulai ? new Date(data.tglMulai) : now,
    data.tglSelesai ? new Date(data.tglSelesai) : now,
    Number(data.jumlahHari) || 1,
    data.alasan || "",
    data.status || "Disetujui",
    now
  ]);
  return { success: true, id: id, message: "Pengajuan cuti/izin berhasil dicatat!" };
}

function updateStatusCuti(id, status) {
  const sh = SS.getSheetByName(SHEET_CUTI);
  if (!sh) return { success: false, message: "Sheet Cuti belum ada." };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.getRange(i + 1, 9).setValue(status);
      return { success: true, message: `Status cuti berhasil diubah menjadi ${status}!` };
    }
  }
  return { success: false, message: "Data cuti tidak ditemukan." };
}

function hapusCuti(id) {
  const sh = SS.getSheetByName(SHEET_CUTI);
  if (!sh) return { success: false };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.deleteRow(i + 1);
      return { success: true, message: "Data cuti berhasil dihapus." };
    }
  }
  return { success: false };
}

// ============================================================
// HARI LIBUR NASIONAL & OUTLET
// ============================================================
function getHariLiburList(tahun) {
  let sh = SS.getSheetByName(SHEET_HARI_LIBUR);
  if (!sh) {
    sh = SS.insertSheet(SHEET_HARI_LIBUR);
    sh.appendRow(["ID", "Tanggal", "Nama Libur", "Kategori", "Keterangan"]);
  }
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift();

  return data
    .filter(r => {
      if (!tahun) return true;
      const tgl = r[1] ? fmtWib(r[1], "yyyy") : "";
      return !tgl || tgl === String(tahun);
    })
    .map(r => ({
      id: r[0],
      tanggal: r[1] ? fmtWib(r[1], "yyyy-MM-dd") : "",
      namaLibur: r[2] || "",
      kategori: r[3] || "Libur Nasional", // Libur Nasional | Libur Outlet
      keterangan: r[4] || ""
    })).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

function tambahHariLibur(data) {
  let sh = SS.getSheetByName(SHEET_HARI_LIBUR);
  if (!sh) {
    sh = SS.insertSheet(SHEET_HARI_LIBUR);
    sh.appendRow(["ID", "Tanggal", "Nama Libur", "Kategori", "Keterangan"]);
  }
  const id = generateId("HBR");
  sh.appendRow([
    id,
    data.tanggal ? new Date(data.tanggal) : new Date(),
    data.namaLibur || "Hari Libur",
    data.kategori || "Libur Nasional",
    data.keterangan || ""
  ]);
  return { success: true, id: id, message: "Hari libur berhasil ditambahkan!" };
}

function hapusHariLibur(id) {
  const sh = SS.getSheetByName(SHEET_HARI_LIBUR);
  if (!sh) return { success: false };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      sh.deleteRow(i + 1);
      return { success: true, message: "Hari libur berhasil dihapus." };
    }
  }
  return { success: false };
}

// ============================================================
// KAS SHIFT & SERAH TERIMA
// ============================================================
function calculateShiftOmzet_(openedAt) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) return { tunai: 0, nonTunai: 0, pendingVoidCount: 0, pendingVoidTotal: 0, pendingVoidList: [] };
  const rows = sh.getDataRange().getValues();
  let tunai = 0;
  let nonTunai = 0;
  let pendingVoidCount = 0;
  let pendingVoidTotal = 0;
  const pendingVoidList = [];
  const openedTime = openedAt.getTime();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[1] || new Date(row[1]).getTime() < openedTime) continue;

    // Nominal uang riil yang dibayar (jika DP gunakan nominal bayar row[15], jika lunas gunakan total row[4])
    const totalTagihan = Number(row[4]) || 0;
    const nominalBayarDP = Number(row[15]) || 0;
    const sisaTagihan = Number(row[16]) || 0;
    const nominal = (sisaTagihan > 0 && nominalBayarDP > 0) ? nominalBayarDP : totalTagihan;

    // 1. Deteksi transaksi yang sedang menunggu persetujuan Void
    if (row[9] === "PendingApproval") {
      pendingVoidCount++;
      pendingVoidTotal += nominal;
      pendingVoidList.push({
        noNota: String(row[0] || ""),
        namaPelanggan: String(row[2] || "Pelanggan"),
        nominal: nominal,
        metodeBayar: String(row[13] || "Tunai"),
        alasan: String(row[10] || "-")
      });
      // Hiraukan void: Transaksi pending void TIDAK DIHITUNG ke uang kas riil shift
      continue;
    }

    // 2. Skip transaksi yang sudah berstatus Void / Batal / Approved Void
    if (
      row[9] === "Approved" || 
      row[5] === "Void" || 
      row[5] === "Batal" || 
      String(row[14]).toLowerCase().includes("void") || 
      String(row[14]).toLowerCase().includes("batal")
    ) {
      continue;
    }

    const metode = String(row[13] || "Tunai").trim();
    if (metode === "Tunai") {
      tunai += nominal;
    } else {
      nonTunai += nominal;
    }
  }

  return { 
    tunai: tunai, 
    nonTunai: nonTunai,
    pendingVoidCount: pendingVoidCount,
    pendingVoidTotal: pendingVoidTotal,
    pendingVoidList: pendingVoidList
  };
}

function calculateShiftNonCash_(openedAt) {
  return calculateShiftOmzet_(openedAt).nonTunai;
}

function calculateShiftCash_(openedAt) {
  return calculateShiftOmzet_(openedAt).tunai;
}

function parseDateRobust_(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  let str = String(val).trim().replace(" WIB", "").replace(" WITA", "").replace(" WIT", "");
  if (str.includes("/")) {
    const parts = str.split(" ");
    const dmy = parts[0].split("/");
    if (dmy.length === 3) {
      let hh = 0, mm = 0, ss = 0;
      if (parts[1]) {
        const time = parts[1].split(":");
        hh = Number(time[0]) || 0;
        mm = Number(time[1]) || 0;
        ss = Number(time[2]) || 0;
      }
      const d = new Date(Number(dmy[2]), Number(dmy[1]) - 1, Number(dmy[0]), hh, mm, ss);
      if (!isNaN(d.getTime())) return d;
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function calculateTodayKumulatif_(outlet, activeShiftOpenedAt) {
  const shKas = SS.getSheetByName(SHEET_KAS_SHIFT);
  const shTx = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!shKas || shKas.getLastRow() < 2) return null;

  const activeDate = parseDateRobust_(activeShiftOpenedAt) || new Date();
  const startOfDay = new Date(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate(), 0, 0, 0);

  // 1. Get all recorded shifts today up to active shift
  const kasRows = shKas.getDataRange().getValues();
  const todayShifts = [];
  let modalAwalHariIni = 0;
  let totalBelanjaHariIni = 0;

  for (let i = 1; i < kasRows.length; i++) {
    const r = kasRows[i];
    if (!r[4]) continue;
    if (outlet && r[1] && r[1] !== outlet) continue;
    const shiftOpen = parseDateRobust_(r[4]);
    if (!shiftOpen) continue;
    if (shiftOpen.getTime() >= startOfDay.getTime() && shiftOpen.getTime() <= activeDate.getTime()) {
      if (todayShifts.length === 0) {
        modalAwalHariIni = Number(r[6]) || 0; // Modal Awal shift pertama pagi ini
      }
      totalBelanjaHariIni += Number(r[18]) || 0;
      todayShifts.push({
        idShift: r[0],
        namaKasir: r[2],
        waktuBuka: fmtWib(r[4]),
        waktuTutup: r[5] ? fmtWib(r[5]) : "",
        kasAwal: Number(r[6]) || 0,
        kasAkhirFisik: Number(r[8]) || 0,
        selisihKas: Number(r[9]) || 0,
        status: r[10],
        modeTutup: r[11] || "",
        totalBelanja: Number(r[18]) || 0
      });
    }
  }

  // 2. Get all non-void transactions today from startOfDay to now
  let omzetTunaiHariIni = 0;
  let omzetMerchantHariIni = 0;
  if (shTx && shTx.getLastRow() >= 2) {
    const txRows = shTx.getDataRange().getValues();
    for (let j = 1; j < txRows.length; j++) {
      const tx = txRows[j];
      if (!tx[1]) continue;
      const txTime = parseDateRobust_(tx[1]);
      if (!txTime || txTime.getTime() < startOfDay.getTime()) continue;
      if (
        tx[9] === "Approved" || 
        tx[9] === "PendingApproval" || 
        tx[5] === "Void" || 
        tx[5] === "Batal" ||
        String(tx[14]).toLowerCase().includes("void") || 
        String(tx[14]).toLowerCase().includes("batal")
      ) continue;
      
      const totalTagihan = Number(tx[4]) || 0;
      const nominalBayarDP = Number(tx[15]) || 0;
      const sisaTagihan = Number(tx[16]) || 0;
      const nominal = (sisaTagihan > 0 && nominalBayarDP > 0) ? nominalBayarDP : totalTagihan;

      const metode = String(tx[13] || "Tunai").trim();
      if (metode === "Tunai") {
        omzetTunaiHariIni += nominal;
      } else {
        omzetMerchantHariIni += nominal;
      }
    }
  }

  const shiftKe = todayShifts.length || 1;
  const isGantiShift = shiftKe > 1;
  const prevShift = isGantiShift ? todayShifts[todayShifts.length - 2] : null;

  return {
    shiftKe: shiftKe,
    isGantiShift: isGantiShift,
    modalAwalHariIni: modalAwalHariIni,
    omzetTunaiHariIni: omzetTunaiHariIni,
    omzetMerchantHariIni: omzetMerchantHariIni,
    totalBelanjaHariIni: totalBelanjaHariIni,
    ekspektasiKasHariIni: modalAwalHariIni + omzetTunaiHariIni - totalBelanjaHariIni,
    prevShift: prevShift,
    todayShifts: todayShifts
  };
}

function getKasShiftAktif(outlet) {
  const sh = SS.getSheetByName(SHEET_KAS_SHIFT);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][10] === "Aktif" && (!outlet || rows[i][1] === outlet)) {
      const openedAt = new Date(rows[i][4]);
      const omzet = calculateShiftOmzet_(openedAt);
      const omzetTunai = omzet.tunai;
      const omzetMerchant = omzet.nonTunai;
      const kasAwal = Number(rows[i][6]) || 0;
      const saldoMerchantAwal = Number(rows[i][16]) || 0;
      const kumulatif = calculateTodayKumulatif_(outlet, openedAt);

      return {
        idShift: rows[i][0],
        idOutlet: rows[i][1],
        namaKasir: rows[i][2],
        idUser: rows[i][3],
        waktuBuka: openedAt.toISOString(),
        kasAwal: kasAwal,
        saldoMerchantAwal: saldoMerchantAwal,
        totalOmzetTunai: omzetTunai,
        totalOmzetMerchant: omzetMerchant,
        kasAkhirSistem: kasAwal + omzetTunai,
        status: "Buka",
        pendingVoidCount: omzet.pendingVoidCount || 0,
        pendingVoidTotal: omzet.pendingVoidTotal || 0,
        pendingVoidList: omzet.pendingVoidList || [],
        kumulatif: kumulatif
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
      ensureSheetSchema_(SHEET_KAS_SHIFT, ["ID Kas Shift", "Outlet", "Nama Penanggung Jawab", "ID Penanggung Jawab", "Waktu Buka", "Waktu Tutup", "Kas Awal", "Kas Akhir Sistem", "Kas Akhir Fisik", "Selisih", "Status", "Mode Tutup", "ID Pengganti", "Nama Pengganti", "Waktu Handover", "Catatan", "Saldo Awal Merchant", "Saldo Akhir Merchant", "Total Belanja", "Foto Nota"]);
      sh = SS.getSheetByName(SHEET_KAS_SHIFT);
    }
    const outlet = data.idOutlet || data.outlet || "OUTLET-UTAMA";
    if (getKasShiftAktif(outlet)) return { success: false, message: "Masih ada kas shift aktif pada outlet ini." };
    
    let kasAwal = Number(data.kasAwal);
    let saldoMerchantAwal = Number(data.saldoMerchantAwal || 0);

    // Otomatis cek apakah ada shift sebelumnya yang ditutup dengan SERAH_TERIMA
    const rows = sh.getDataRange().getValues();
    if (rows.length >= 2) {
      for (let i = rows.length - 1; i >= 1; i--) {
        if (rows[i][10] === "Ditutup" && (!outlet || rows[i][1] === outlet)) {
          if (rows[i][11] === "SERAH_TERIMA") {
            const lastFisik = Number(rows[i][8]);
            const lastMerchant = Number(rows[i][17]);
            // Jika frontend belum mengubah nilai atau kasAwal kosong/tidak valid
            if (!data.kasAwal || isNaN(kasAwal) || (kasAwal === 100000 && lastFisik > 0 && lastFisik !== 100000)) {
              kasAwal = lastFisik;
            }
            if (data.saldoMerchantAwal === undefined || (saldoMerchantAwal === 0 && lastMerchant > 0)) {
              saldoMerchantAwal = lastMerchant;
            }
          }
          break;
        }
      }
    }

    if (!isFinite(kasAwal) || kasAwal < 0) kasAwal = 100000;
    if (!isFinite(saldoMerchantAwal) || saldoMerchantAwal < 0) saldoMerchantAwal = 0;
    
    const id = generateId("KAS");
    const now = new Date();
    sh.appendRow([
      id, 
      outlet, 
      data.namaKasir || data.userName || "Kasir", 
      data.userId || "-", 
      now, 
      "", 
      kasAwal, 
      "", 
      "", 
      "", 
      "Aktif", 
      "", 
      "", 
      "", 
      "", 
      data.catatan || "",
      saldoMerchantAwal,
      "",
      0,
      ""
    ]);
    addAuditLog(data.namaKasir || data.userName || "Kasir", "Buka Kas Shift", id, "Outlet: " + outlet + "; kas laci Rp " + kasAwal.toLocaleString('id-ID') + "; saldo merchant Rp " + saldoMerchantAwal.toLocaleString('id-ID'));
    return { success: true, data: getKasShiftAktif(outlet) };
  } finally {
    lock.releaseLock();
  }
}

function findEmployeeNameById_(employeeId) {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return String(employeeId || "");
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(employeeId) || String(rows[i][1]) === String(employeeId)) {
      return String(rows[i][1]);
    }
  }
  return String(employeeId || "");
}

function handoverCheckKasShift(data) {
  const active = getKasShiftAktif(data.idOutlet || data.outlet || "OUTLET-UTAMA");
  if (!active || active.idShift !== data.shiftId) return { eligible: false, clockedIn: false, message: "Kas shift aktif tidak ditemukan." };
  if (!data.replacementEmployeeId || (String(data.replacementEmployeeId) === String(active.idUser) && data.replacementEmployeeId !== "-")) {
    return { eligible: false, clockedIn: false, message: "Staf pengganti harus berbeda dari penanggung jawab kas." };
  }
  let replacementName = findEmployeeNameById_(data.replacementEmployeeId);
  if (!replacementName && data.replacementName) replacementName = String(data.replacementName);
  if (!replacementName) return { eligible: false, clockedIn: false, message: "Staf pengganti tidak ditemukan." };

  const attendance = SS.getSheetByName(SHEET_ABSENSI);
  if (!attendance || attendance.getLastRow() <= 1) {
    return { eligible: true, clockedIn: true, replacementEmployeeId: data.replacementEmployeeId, replacementName: replacementName, message: "Staf pengganti siap serah terima." };
  }
  const today = fmtWib(new Date(), "yyyy-MM-dd");
  const rows = attendance.getDataRange().getValues();
  const clockedIn = rows.some(function(row, index) {
    return index > 0 && row[1] && fmtWib(row[1], "yyyy-MM-dd") === today && (row[2] === replacementName || row[2] === data.replacementEmployeeId) && row[4] && !row[5];
  });
  return { eligible: true, clockedIn: clockedIn, replacementEmployeeId: data.replacementEmployeeId, replacementName: replacementName, message: clockedIn ? "Staf pengganti sudah Clock In & siap serah terima." : "Staf pengganti siap serah terima (Pengingat: Jangan lupa Clock In)." };
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
