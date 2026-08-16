// ============================================================
// PIPELINE CONFIG
// ============================================================
// ============================================================
// PIPELINE ENGINE
// ============================================================

// ============================================================
// PIPELINE ENGINE
// ============================================================

const SHEET_PIPELINE_CONFIG = "Config Pipeline";

function getPipelineConfigData() {
  let sh = SS.getSheetByName(SHEET_PIPELINE_CONFIG);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PIPELINE_CONFIG);
    sh.appendRow(["Step", "Nama Step", "Need Staff", "Need Mesin"]);
    sh.appendRow([1, "Dicuci", "FALSE", "TRUE"]);
    sh.appendRow([2, "Dikeringkan", "FALSE", "TRUE"]);
    sh.appendRow([3, "Disetrika", "TRUE", "FALSE"]);
    sh.appendRow([4, "Siap Diambil", "FALSE", "FALSE"]);
  }
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift();
  return data.map(r => ({
    step: Number(r[0]) || 0,
    nama: r[1] || "",
    needStaff: r[2] === true || r[2] === "TRUE" || r[2] === "true",
    needMesin: r[3] === true || r[3] === "TRUE" || r[3] === "true"
  })).sort((a, b) => a.step - b.step);
}

function savePipelineConfigData(steps) {
  let sh = SS.getSheetByName(SHEET_PIPELINE_CONFIG);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PIPELINE_CONFIG);
  }
  sh.clear();
  sh.appendRow(["Step", "Nama Step", "Need Staff", "Need Mesin"]);
  if (Array.isArray(steps)) {
    steps.forEach((s, idx) => {
      sh.appendRow([idx + 1, s.nama, s.needStaff ? "TRUE" : "FALSE", s.needMesin ? "TRUE" : "FALSE"]);
    });
  }
  return { success: true, message: "Master pipeline berhasil disimpan." };
}
function createPipelineForNota(noNota, tipe, items, petugas) {
  let sh = SS.getSheetByName(SHEET_PIPELINE);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PIPELINE);
    sh.appendRow(["ID", "No Nota", "Step", "Nama Step", "Status", "Assigned Staff", "Mesin ID", "Waktu Mulai", "Waktu Selesai", "Catatan"]);
  }

  let config = [];

  if (tipe === "FullService" && items && items.length > 0) {
    const allLayanan = getLayananListAll();
    items.forEach(item => {
      const lay = allLayanan.find(l => l.nama === item.layanan);
      if (lay && Array.isArray(lay.pipelineSteps)) {
        lay.pipelineSteps.forEach(s => {
          if (typeof s === 'object' && s.nama) {
            if (!config.find(c => String(c.nama).toLowerCase() === String(s.nama).toLowerCase())) {
              config.push({ step: config.length + 1, nama: s.nama, needStaff: !!s.needStaff, needMesin: !!s.needMesin });
            }
          }
        });
      }
    });
  }

  if (config.length === 0) {
    if (tipe === "FullService") {
       config = [
         { step: 1, nama: "Dicuci" },
         { step: 2, nama: "Dikeringkan" },
         { step: 3, nama: "Disetrika" },
         { step: 4, nama: "Siap Diambil" }
       ];
    } else {
       config = [
         { step: 1, nama: "Washer", needMesin: true },
         { step: 2, nama: "Dryer", needMesin: true }
       ];
    }
  }

  const now = new Date();
  // Langkah paling awal (default): Pesanan Diterima
  sh.appendRow([generateId("PIP"), noNota, 0, "Pesanan Diterima", "Selesai", petugas || "Kasir", "", now, now, "Otomatis oleh sistem"]);

  config.forEach((c, idx) => {
    const status = idx === 0 ? "Aktif" : "Pending";
    const waktuMulai = idx === 0 ? now : "";
    sh.appendRow([generateId("PIP"), noNota, c.step, c.nama, status, "", "", waktuMulai, "", ""]);
  });
}

function getPipelineSteps(noNota) {
  const sh = SS.getSheetByName(SHEET_PIPELINE);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  data.shift();
  return data
    .filter(r => r[1] === noNota)
    .map(r => ({
      id: r[0], noNota: r[1], step: r[2], namaStep: r[3], status: r[4],
      assignedStaff: r[5] || "", mesinId: r[6] || "",
      waktuMulai: r[7] ? fmtWib(r[7]) : "",
      waktuSelesai: r[8] ? fmtWib(r[8]) : "",
      catatan: r[9] || "", washerId: r[10] || "", dryerId: r[11] || ""
    }))
    .sort((a, b) => a.step - b.step);
}

function advancePipeline(noNota, assignedStaff, mesinId, catatan) {
  const sh = SS.getSheetByName(SHEET_PIPELINE);
  if (!sh) return { success: false, message: "Sheet Pipeline tidak ditemukan." };

  const rows = sh.getDataRange().getValues();
  let activeRowIdx = -1;
  let nextRowIdx = -1;

  // Find current active step
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === noNota && rows[i][4] === "Aktif") {
      activeRowIdx = i;
      break;
    }
  }

  if (activeRowIdx === -1) return { success: false, message: "Tidak ada step aktif untuk nota ini." };

  // Find next pending step
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === noNota && rows[i][4] === "Pending" && rows[i][2] > rows[activeRowIdx][2]) {
      nextRowIdx = i;
      break;
    }
  }

  const now = new Date();

  // Complete current step
  sh.getRange(activeRowIdx + 1, 5).setValue("Selesai");
  if (assignedStaff) sh.getRange(activeRowIdx + 1, 6).setValue(assignedStaff);
  if (mesinId) sh.getRange(activeRowIdx + 1, 7).setValue(mesinId);
  sh.getRange(activeRowIdx + 1, 9).setValue(now);
  if (catatan) sh.getRange(activeRowIdx + 1, 10).setValue(catatan);

  const completedStep = rows[activeRowIdx][3];

  if (nextRowIdx !== -1) {
    // Activate next step
    sh.getRange(nextRowIdx + 1, 5).setValue("Aktif");
    sh.getRange(nextRowIdx + 1, 8).setValue(now);

    const nextStep = rows[nextRowIdx][3];
    // Update main transaction status
    updateStatus(noNota, nextStep);
    return { success: true, message: "✅ " + completedStep + " selesai → " + nextStep, currentStep: nextStep };
  } else {
    // All steps done
    updateStatus(noNota, "Selesai");
    return { success: true, message: "🏁 Semua proses selesai!", currentStep: "Selesai" };
  }
}

function getDropoffStatusIndex_(status) {
  return ["Diterima", "Dicuci", "Dikeringkan", "Disetrika", "Siap Diambil", "Selesai"].indexOf(String(status || ""));
}

function findMachineRow_(machineId, expectedType) {
  const sh = SS.getSheetByName(SHEET_MESIN);
  if (!sh || !machineId) return { success: false, message: "Mesin wajib dipilih." };
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) !== String(machineId)) continue;
    const actualType = String(rows[i][2] || "").toLowerCase();
    if (actualType.indexOf(String(expectedType).toLowerCase()) === -1) {
      return { success: false, message: "Tipe mesin tidak sesuai untuk tahap ini." };
    }
    if (rows[i][3] === "Maintenance") return { success: false, message: "Mesin sedang maintenance." };
    if (rows[i][3] === "Digunakan") return { success: false, message: "Mesin sedang digunakan order lain." };
    return { success: true, sheet: sh, rowIndex: i };
  }
  return { success: false, message: "Mesin tidak ditemukan." };
}

/**
 * Memajukan lifecycle drop-off satu tahap. Mesin dicatat pada tahap yang baru
 * dimulai sehingga washer/dryer fisik selalu dapat ditelusuri dari order.
 */
function updateDropoffStatus(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const noNota = String(data.noNota || data.id || "");
    const statusBaru = String(data.status || "");
    const shT = SS.getSheetByName(SHEET_TRANSAKSI);
    const shP = SS.getSheetByName(SHEET_PIPELINE);
    if (!shT || !shP) return { success: false, message: "Schema transaksi atau pipeline belum tersedia." };

    const txRows = shT.getDataRange().getValues();
    let txIndex = -1;
    for (let i = 1; i < txRows.length; i++) {
      if (String(txRows[i][0]) === noNota) { txIndex = i; break; }
    }
    if (txIndex < 0) return { success: false, message: "Order drop-off tidak ditemukan." };
    if (txRows[txIndex][8] !== "FullService") return { success: false, message: "Lifecycle produksi hanya berlaku untuk order drop-off." };
    if (txRows[txIndex][9] === "Approved" || ["Void", "Batal"].indexOf(txRows[txIndex][5]) !== -1) {
      return { success: false, message: "Order void/batal tidak dapat diproses." };
    }

    const currentIndex = getDropoffStatusIndex_(txRows[txIndex][5]);
    const targetIndex = getDropoffStatusIndex_(statusBaru);
    if (targetIndex < 0) return { success: false, message: "Status drop-off tidak valid." };
    if (targetIndex !== currentIndex + 1) return { success: false, message: "Status harus dilanjutkan satu tahap secara berurutan." };

    let machine = null;
    let machineId = "";
    if (statusBaru === "Dicuci") {
      machineId = String(data.washerId || "");
      machine = findMachineRow_(machineId, "washer");
    } else if (statusBaru === "Dikeringkan") {
      machineId = String(data.dryerId || "");
      machine = findMachineRow_(machineId, "dryer");
    }
    if (machine && !machine.success) return { success: false, message: machine.message };

    const pipelineRows = shP.getDataRange().getValues();
    let activeRow = -1;
    let targetRow = -1;
    for (let i = 1; i < pipelineRows.length; i++) {
      if (String(pipelineRows[i][1]) !== noNota) continue;
      if (pipelineRows[i][4] === "Aktif") activeRow = i;
      if (pipelineRows[i][3] === statusBaru) targetRow = i;
    }
    if (activeRow < 0 || targetRow < 0) return { success: false, message: "Pipeline order belum sesuai schema terbaru." };

    const now = new Date();
    const previousMachineId = String(pipelineRows[activeRow][6] || "");
    shP.getRange(activeRow + 1, 5).setValue("Selesai");
    shP.getRange(activeRow + 1, 9).setValue(now);
    if (data.assignedStaff) shP.getRange(activeRow + 1, 6).setValue(data.assignedStaff);
    if (data.catatan) shP.getRange(activeRow + 1, 10).setValue(data.catatan);

    if (statusBaru === "Selesai") {
      shP.getRange(targetRow + 1, 5).setValue("Selesai");
      shP.getRange(targetRow + 1, 8, 1, 2).setValues([[now, now]]);
    } else {
      shP.getRange(targetRow + 1, 5).setValue("Aktif");
      shP.getRange(targetRow + 1, 8).setValue(now);
    }
    if (machineId) {
      shP.getRange(targetRow + 1, 7).setValue(machineId);
      shP.getRange(targetRow + 1, statusBaru === "Dicuci" ? 11 : 12).setValue(machineId);
      machine.sheet.getRange(machine.rowIndex + 1, 4, 1, 4).setValues([["Digunakan", noNota + " - " + statusBaru, now, data.estimasiSelesai || ""]]);
    }
    if (previousMachineId) selesaiMesin(previousMachineId);

    shT.getRange(txIndex + 1, 6).setValue(statusBaru);
    addAuditLog(data.userName || data.assignedStaff || "Staff", "Update Drop-off", noNota, txRows[txIndex][5] + " -> " + statusBaru + (machineId ? "; mesin " + machineId : ""));
    SpreadsheetApp.flush();
    return { success: true, noNota: noNota, previousStatus: txRows[txIndex][5], status: statusBaru, machineId: machineId || "", message: "Status order diperbarui menjadi " + statusBaru + "." };
  } finally {
    lock.releaseLock();
  }
}

function getTransaksiList(statusFilter) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const shD = SS.getSheetByName(SHEET_DETAIL);

  const dataHeader = sh.getDataRange().getValues();
  dataHeader.shift();
  const dataDetail = shD.getDataRange().getValues();
  dataDetail.shift();

  let result = dataHeader.map(r => {
    const items = dataDetail
      .filter(d => d[0] === r[0])
      .map(d => ({
        layanan: d[1],
        qty: Number(d[2]) || 0,
        hargaSatuan: Number(d[3]) || 0,
        subtotal: Number(d[4]) || 0
      }));
    return {
      noNota: r[0],
      tanggal: fmtWib(r[1]),
      namaPelanggan: r[2],
      noHp: String(r[3] || ''),
      total: Number(r[4]) || 0,
      status: r[5],
      estimasi: r[6],
      petugas: r[7] || "Kasir",
      tipe: r[8] || "SelfService",
      statusVoid: r[9] || "None",
      alasanVoid: r[10] || "",
      subtotal: Number(r[11]) || Number(r[4]) || 0,
      diskon: Number(r[12]) || 0,
      metodeBayar: r[13] || "",
      statusPembayaran: r[14] || "Lunas",
      nominalDP: Number(r[15]) || 0,
      sisaTagihan: Number(r[16]) || 0,
      referensiPembayaran: r[17] || "",
      catatan: r[18] || "",
      tingkatLayanan: r[19] || "Reguler",
      items: items
    };
  });

  if (statusFilter && statusFilter !== "Semua") {
    result = result.filter(r => r.status === statusFilter);
  }
  return result.reverse();
}

// ── NOTA TOKEN (URL Obfuscation) ─────────────────────────────
// Token format: base64url(noNota) + "." + hmac(noNota, secret) [8 bytes hex]
// Token aktif permanent — tidak expire.
// URL e-nota: ?t=<token> saja, tanpa noNota terlihat.

function generateNotaToken_(noNota) {
  var secret = getSessionSecret_();
  var b64 = Utilities.base64EncodeWebSafe(noNota).replace(/=+$/, '');
  var sig = Utilities.computeHmacSha256Signature(noNota, secret);
  var hex = sig.slice(0, 8).map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
  return b64 + '.' + hex;
}

function decodeNotaToken_(token) {
  if (!token || token.indexOf('.') === -1) return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    var noNota = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
    var secret = getSessionSecret_();
    var sig = Utilities.computeHmacSha256Signature(noNota, secret);
    var expectedHex = sig.slice(0, 8).map(function(b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
    if (parts[1] !== expectedHex) return null;
    return noNota;
  } catch (e) {
    return null;
  }
}

function getTransaksiByNota(noNota, token) {
  var resolvedNota = noNota;

  // Kalau ada token, decode untuk dapat noNota (URL mode: ?t=token)
  if (token && !noNota) {
    resolvedNota = decodeNotaToken_(token);
    if (!resolvedNota) return { success: false, message: 'Link e-nota tidak valid.' };
  }
  // Kalau ada keduanya, verify token cocok dengan noNota
  if (token && noNota) {
    var decoded = decodeNotaToken_(token);
    if (!decoded || decoded !== noNota) return { success: false, message: 'Token e-nota tidak valid.' };
  }

  if (!resolvedNota) return { success: false, message: 'Parameter nota tidak ditemukan.' };

  const all = getTransaksiList();
  const found = all.find(function(t) { return t.noNota === resolvedNota; });
  if (!found) return { success: false, message: 'Nota ' + resolvedNota + ' tidak ditemukan di sistem.' };
  return { success: true, transaksi: found };
}

function getTransaksiByPipeline(tipeFilter) {
  const allTx = getTransaksiList();
  let filtered = allTx.filter(t => t.tipe === "FullService" && t.status !== "Selesai" && t.status !== "Void" && t.status !== "Batal");
  if (tipeFilter && tipeFilter !== "Semua") {
    filtered = filtered.filter(t => t.tipe === tipeFilter);
  }
  // Attach pipeline steps to each tx
  return filtered.map(t => {
    t.pipeline = getPipelineSteps(t.noNota);
    return t;
  });
}

function updateStatus(noNota, statusBaru) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === noNota) { sh.getRange(i + 1, 6).setValue(statusBaru); return true; }
  }
  return false;
}
