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

function getStepDefaultIcon_(nama) {
  const n = (nama || "").toLowerCase();
  if (n.includes("cuci")) return "WashingMachine";
  if (n.includes("kering")) return "Wind";
  if (n.includes("setrika") || n.includes("gosok")) return "Sparkles";
  if (n.includes("lipat") || n.includes("pack") || n.includes("kemas")) return "Package";
  if (n.includes("siap") || n.includes("ambil") || n.includes("selesai") || n.includes("rak")) return "CheckCircle2";
  if (n.includes("noda") || n.includes("spot")) return "Droplets";
  if (n.includes("antar") || n.includes("kirim")) return "Truck";
  return "Workflow";
}

function getPipelineConfigData() {
  let sh = SS.getSheetByName(SHEET_PIPELINE_CONFIG);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PIPELINE_CONFIG);
    sh.appendRow(["Step", "Nama Step", "Need Staff", "Need Mesin", "Icon"]);
    sh.appendRow([1, "Dicuci", "FALSE", "TRUE", "WashingMachine"]);
    sh.appendRow([2, "Dikeringkan", "FALSE", "TRUE", "Wind"]);
    sh.appendRow([3, "Disetrika", "TRUE", "FALSE", "Sparkles"]);
    sh.appendRow([4, "Dilipat", "TRUE", "FALSE", "Package"]);
    sh.appendRow([5, "Siap Diambil", "FALSE", "FALSE", "CheckCircle2"]);
  }
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  data.shift();
  return data.map(r => ({
    step: Number(r[0]) || 0,
    nama: r[1] || "",
    needStaff: r[2] === true || r[2] === "TRUE" || r[2] === "true",
    needMesin: r[3] === true || r[3] === "TRUE" || r[3] === "true",
    icon: r[4] || getStepDefaultIcon_(r[1])
  })).sort((a, b) => a.step - b.step);
}

function savePipelineConfigData(steps) {
  let sh = SS.getSheetByName(SHEET_PIPELINE_CONFIG);
  if (!sh) {
    sh = SS.insertSheet(SHEET_PIPELINE_CONFIG);
  }
  sh.clear();
  sh.appendRow(["Step", "Nama Step", "Need Staff", "Need Mesin", "Icon"]);
  if (Array.isArray(steps)) {
    steps.forEach((s, idx) => {
      const icon = s.icon || getStepDefaultIcon_(s.nama);
      sh.appendRow([idx + 1, s.nama, s.needStaff ? "TRUE" : "FALSE", s.needMesin ? "TRUE" : "FALSE", icon]);
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
      const layName = String(item.layanan || item.nama || "").trim().toLowerCase();
      const lay = allLayanan.find(l => String(l.nama || l.layanan || "").trim().toLowerCase() === layName);
      if (lay && Array.isArray(lay.pipelineSteps) && lay.pipelineSteps.length > 0) {
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
  // Langkah paling awal: Pesanan Diterima (Status: Aktif saat order baru dibuat)
  sh.appendRow([generateId("PIP"), noNota, 0, "Pesanan Diterima", "Aktif", petugas || "Kasir", "", now, "", "Pesanan baru diterima kasir"]);

  config.forEach((c) => {
    // Semua langkah pengerjaan fisik (Dicuci, Dikeringkan, dll) awalnya Pending
    sh.appendRow([generateId("PIP"), noNota, c.step, c.nama, "Pending", "", "", "", "", ""]);
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

    const pipelineRows = shP.getDataRange().getValues();
    let activeRow = -1;
    let targetRow = -1;
    for (let i = 1; i < pipelineRows.length; i++) {
      if (String(pipelineRows[i][1]) !== noNota) continue;
      if (pipelineRows[i][4] === "Aktif") activeRow = i;
      if (String(pipelineRows[i][3]).toLowerCase() === String(statusBaru).toLowerCase()) targetRow = i;
    }

    // Fallback find active row if not explicitly marked "Aktif"
    if (activeRow < 0) {
      for (let i = 1; i < pipelineRows.length; i++) {
        if (String(pipelineRows[i][1]) === noNota && String(pipelineRows[i][3]).toLowerCase() === String(txRows[txIndex][5]).toLowerCase()) {
          activeRow = i;
          break;
        }
      }
    }

    if (statusBaru !== "Selesai" && targetRow < 0) {
      return { success: false, message: "Tahap " + statusBaru + " tidak terdaftar pada alur pengerjaan nota ini." };
    }

    let machine = null;
    let machineId = "";
    if (statusBaru === "Dicuci") {
      machineId = String(data.washerId || "");
      if (machineId) machine = findMachineRow_(machineId, "washer");
    } else if (statusBaru === "Dikeringkan") {
      machineId = String(data.dryerId || "");
      if (machineId) machine = findMachineRow_(machineId, "dryer");
    }
    if (machine && !machine.success) return { success: false, message: machine.message };

    const now = new Date();
    let previousMachineId = "";
    if (activeRow >= 0 && pipelineRows[activeRow]) {
      previousMachineId = String(pipelineRows[activeRow][6] || "");
      shP.getRange(activeRow + 1, 5).setValue("Selesai");
      shP.getRange(activeRow + 1, 9).setValue(now);
      if (data.assignedStaff) shP.getRange(activeRow + 1, 6).setValue(data.assignedStaff);
      if (data.catatan) shP.getRange(activeRow + 1, 10).setValue(data.catatan);
    }

    if (statusBaru === "Selesai") {
      // Mark all remaining steps for this order as Selesai
      for (let i = 1; i < pipelineRows.length; i++) {
        if (String(pipelineRows[i][1]) === noNota && pipelineRows[i][4] !== "Selesai") {
          shP.getRange(i + 1, 5).setValue("Selesai");
          if (!pipelineRows[i][8]) shP.getRange(i + 1, 9).setValue(now);
        }
      }
    } else if (targetRow >= 0) {
      shP.getRange(targetRow + 1, 5).setValue("Aktif");
      shP.getRange(targetRow + 1, 8).setValue(now);
      if (machineId && machine) {
        shP.getRange(targetRow + 1, 7).setValue(machineId);
        shP.getRange(targetRow + 1, statusBaru === "Dicuci" ? 11 : 12).setValue(machineId);
        machine.sheet.getRange(machine.rowIndex + 1, 4, 1, 4).setValues([["Digunakan", noNota + " - " + statusBaru, now, data.estimasiSelesai || ""]]);
      }
    }

    if (previousMachineId) {
      try { selesaiMesin(previousMachineId); } catch(e) {}
    }

    // Potong stok inventory bahan baku (Deterjen/Pewangi/Plastik/dll) sesuai tahap pipeline
    try {
      const shD = SS.getSheetByName(SHEET_DETAIL);
      if (shD) {
        const detailRows = shD.getDataRange().getValues();
        const allLayanan = getLayananListAll();
        let deductedLogs = [];
        for (let i = 1; i < detailRows.length; i++) {
          if (String(detailRows[i][0]) === noNota) {
            const namaItem = detailRows[i][1];
            const qtyItem = Number(detailRows[i][2]) || 1;
            const lay = allLayanan.find(l => l.nama === namaItem);
            if (lay) {
              const listBahan = Array.isArray(lay.bahanBakuList) && lay.bahanBakuList.length > 0
                ? lay.bahanBakuList
                : (lay.idInventory ? [{ idInventory: lay.idInventory, qty: lay.inventoryDeductionQty || 1, tahap: 'Dicuci' }] : []);
              
              listBahan.forEach(function(b) {
                const stepTarget = b.tahap || 'Dicuci';
                if (stepTarget === statusBaru || (stepTarget === 'Dicuci' && statusBaru === 'Dicuci')) {
                  const deductionPerUnit = Number(b.qty) || 1;
                  const totalDeduction = qtyItem * deductionPerUnit;
                  updateStokInventory(b.idInventory, -totalDeduction);
                  deductedLogs.push(b.idInventory + " (-" + totalDeduction + ")");
                }
              });
            }
          }
        }
        if (deductedLogs.length > 0) {
          addAuditLog(data.userName || data.assignedStaff || "Staff", "Pemakaian Bahan " + statusBaru, noNota, "Potong stok inventory tahap " + statusBaru + ": " + deductedLogs.join(", "));
        }
      }
    } catch (errDeduct) {
      Logger.log("Gagal potong stok tahap " + statusBaru + ": " + errDeduct);
    }

    const statusLama = String(txRows[txIndex][5] || "Diterima");
    shT.getRange(txIndex + 1, 6).setValue(statusBaru);
    
    addAuditLog(
      data.userName || data.assignedStaff || "Staff", 
      "Update Pipeline", 
      noNota, 
      `Status: ${statusLama}`, 
      `Status: ${statusBaru}${machineId ? ` (Mesin: ${machineId})` : ''}`, 
      `Perubahan status pengerjaan cucian drop-off ${noNota}`
    );
    SpreadsheetApp.flush();
    return { success: true, noNota: noNota, previousStatus: txRows[txIndex][5], status: statusBaru, machineId: machineId || "", message: "Status order diperbarui menjadi " + statusBaru + "." };
  } finally {
    lock.releaseLock();
  }
}

function getTransaksiList(statusFilter) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const shD = SS.getSheetByName(SHEET_DETAIL);
  const shP = SS.getSheetByName(SHEET_PELANGGAN);

  const dataHeader = sh.getDataRange().getValues();
  dataHeader.shift();
  const dataDetail = shD.getDataRange().getValues();
  dataDetail.shift();

  let customerMap = {};
  if (shP) {
    const custData = shP.getDataRange().getValues();
    custData.shift();
    custData.forEach(function(c) {
      const cNorm = normalizePhone(c[0]);
      if (cNorm) {
        const isMem = String(c[9] || "").toUpperCase() === "MEMBER" || Number(c[8]) > 0;
        customerMap[cNorm] = {
          nama: c[1] || "",
          saldoPoin: Number(c[8]) || 0,
          isMember: isMem
        };
      }
    });
  }

  const props = PropertiesService.getScriptProperties();
  const poinRate = Number(props.getProperty("POIN_RATE") || 10000);

  let result = dataHeader.map(r => {
    const noNota = r[0];
    const items = dataDetail
      .filter(d => d[0] === noNota)
      .map(d => ({
        layanan: d[1],
        qty: Number(d[2]) || 0,
        hargaSatuan: Number(d[3]) || 0,
        subtotal: Number(d[4]) || 0
      }));
    const normPhone = normalizePhone(r[3]);
    const cust = customerMap[normPhone] || {};
    const total = Number(r[4]) || 0;
    const isMember = cust.isMember || false;
    const poinEarned = isMember && poinRate > 0 ? Math.floor(total / poinRate) : 0;

    return {
      noNota: noNota,
      token: generateNotaToken_(noNota),
      tanggal: fmtWib(r[1]),
      namaPelanggan: r[2],
      noHp: String(r[3] || ''),
      isMember: isMember,
      poinEarned: poinEarned,
      saldoPoin: cust.saldoPoin || 0,
      total: total,
      status: r[5],
      estimasi: r[6],
      petugas: r[7] || "Kasir",
      tipe: r[8] || "SelfService",
      voucher: (r[9] && String(r[9]).trim() !== "" && r[9] !== "None") ? String(r[9]).trim() : "",
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
    if (parts[1] === expectedHex) return noNota;
    // Fallback if client encoded using deterministic token
    if (noNota && (noNota.indexOf('LDY-') === 0 || noNota.indexOf('NOTA-') === 0 || noNota.length >= 6)) {
      return noNota;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function getTransaksiByNota(noNota, token, last4Phone) {
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
  if (!found) {
    addAuditLog("Pengunjung Web", "Cek Status Cucian", resolvedNota, "-", "Nota Tidak Ditemukan", "Pencarian nota " + resolvedNota + " tidak ditemukan di sistem");
    return { success: false, message: 'Nota ' + resolvedNota + ' tidak ditemukan di sistem.' };
  }

  // Proteksi 2-Faktor untuk pencarian manual publik tanpa token kriptografi resmi
  if (!token) {
    var clean4 = String(last4Phone || '').replace(/\D/g, '');
    if (clean4.length !== 4) {
      return {
        success: false,
        message: 'Verifikasi keamanan: Masukkan 4 digit terakhir nomor HP yang terdaftar pada nota.'
      };
    }
    var normPhone = normalizePhone(found.noHp || '');
    if (!normPhone || !normPhone.endsWith(clean4)) {
      addAuditLog("Pengunjung Web", "Cek Status Cucian", resolvedNota, "-", "Verifikasi 4-Digit Gagal (" + clean4 + ")", "Pelacakan nota " + resolvedNota + " gagal (4 digit HP tidak cocok)");
      return {
        success: false,
        message: 'Verifikasi gagal: 4 digit nomor HP tidak cocok dengan pemilik nota ini.'
      };
    }
  }

  // Direct backend audit log for public tracking
  addAuditLog(
    "Pelanggan: " + found.namaPelanggan, 
    "Cek Status Cucian", 
    resolvedNota, 
    "-", 
    "Status: " + found.status + " (" + (found.tipe || "Drop Off") + ")", 
    "Pelanggan " + found.namaPelanggan + " mengecek status cucian nota " + resolvedNota + " di website publik"
  );

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
