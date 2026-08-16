// ============================================================
// PEGAWAI & REKAP KINERJA
// ============================================================
function getPegawaiList() {
  const sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  data.shift();
  return data.map(r => ({
    id: r[0],
    nama: r[1],
    noHp: r[2],
    jabatan: r[3],
    status: r[4] || "Aktif"
  }));
}

function tambahPegawai(data) {
  let sh = SS.getSheetByName(SHEET_PEGAWAI);
  if (!sh) { sh = SS.insertSheet(SHEET_PEGAWAI); sh.appendRow(["ID", "Nama Pegawai", "No HP", "Jabatan", "Status", "Tanggal Bergabung"]); }
  const id = generateId("EMP");
  sh.appendRow([id, data.nama, data.noHp || "", data.jabatan || "Operator", "Aktif", new Date()]);
  return { success: true, id: id };
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
