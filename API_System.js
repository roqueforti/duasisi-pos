// ============================================================
// IDEMPOTENT SPREADSHEET MIGRATIONS
// Dipanggil otomatis oleh CI setelah Apps Script deployment.
// Tidak menghapus isi sheet atau menggandakan header.
// ============================================================
function runMigrations() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    let version = Number(props.getProperty(MIGRATION_KEY) || 0);
    const migrations = [
      function v1() {
        const schemas = {
          Transaksi: ["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe"],
          TransaksiDetail: ["No Nota", "Layanan", "Qty", "Harga Satuan", "Subtotal"],
          Pelanggan: ["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan"],
          Layanan: ["ID", "Nama Layanan", "Harga", "Satuan", "Icon", "Aktif", "Tipe"],
          Inventory: ["ID", "Nama Barang", "Stok", "Satuan", "Stok Minimum", "Terakhir Update"],
          Mesin: ["ID", "Nama Mesin", "Tipe", "Status", "Keterangan", "Mulai Pakai", "Estimasi Selesai"],
          Pegawai: ["ID", "Nama Pegawai", "No HP", "Jabatan", "Status", "Tanggal Bergabung"],
          Absensi: ["ID", "Tanggal", "Nama Pegawai", "Shift", "Clock In", "Clock Out", "Durasi Kerja", "Catatan"],
          MasterShift: ["ID", "Nama Shift", "Jam Masuk", "Jam Keluar", "Keterangan"],
          Pipeline: ["ID", "No Nota", "Step", "Nama Step", "Status", "Assigned Staff", "Mesin ID", "Waktu Mulai", "Waktu Selesai", "Catatan"],
          Promo: ["ID", "Kode Voucher", "Jenis Diskon", "Nilai Diskon", "Min Transaksi", "Periode Selesai", "Kuota", "Terpakai", "Status Aktif"],
          AuditLog: ["ID", "Timestamp", "Nama User", "Jenis Aktivitas", "Referensi", "Detail"]
        };
        Object.keys(schemas).forEach(function(name) { ensureSheetSchema_(name, schemas[name]); });
      },
      function v2() {
        // Kolom lifecycle fisik untuk drop-off; hanya ditambahkan bila belum ada.
        ensureSheetSchema_(SHEET_PIPELINE, ["ID", "No Nota", "Step", "Nama Step", "Status", "Assigned Staff", "Mesin ID", "Waktu Mulai", "Waktu Selesai", "Catatan", "Washer ID", "Dryer ID"]);
        ensureSheetSchema_(SHEET_TRANSAKSI, ["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe", "Status Void", "Alasan Void"]);
      },
      function v3() {
        ensureSheetSchema_(SHEET_TRANSAKSI, ["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe", "Status Void", "Alasan Void", "Subtotal", "Diskon", "Metode Pembayaran", "Status Pembayaran", "Nominal Bayar", "Sisa Tagihan", "Referensi Pembayaran", "Catatan"]);
      },
      function v4() {
        ensureSheetSchema_(SHEET_KAS_SHIFT, ["ID Kas Shift", "Outlet", "Nama Penanggung Jawab", "ID Penanggung Jawab", "Waktu Buka", "Waktu Tutup", "Kas Awal", "Kas Akhir Sistem", "Kas Akhir Fisik", "Selisih", "Status", "Mode Tutup", "ID Pengganti", "Nama Pengganti", "Waktu Handover", "Catatan"]);
      },
      function v5() {
        ensureSheetSchema_(SHEET_TRANSAKSI, ["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe", "Status Void", "Alasan Void", "Subtotal", "Diskon", "Metode Pembayaran", "Status Pembayaran", "Nominal Bayar", "Sisa Tagihan", "Referensi Pembayaran", "Catatan", "Prioritas"]);
      },
      function v6() {
        // Enforce decimal number formatting on Inventory and Layanan sheets
        const shInv = SS.getSheetByName(SHEET_INVENTORY);
        if (shInv && shInv.getLastRow() >= 1) {
          try {
            shInv.getRange(2, 3, Math.max(shInv.getLastRow() - 1, 1), 1).setNumberFormat("#,##0.00##");
            shInv.getRange(2, 5, Math.max(shInv.getLastRow() - 1, 1), 1).setNumberFormat("#,##0.00##");
          } catch(e) {}
        }
        const shLay = SS.getSheetByName(SHEET_LAYANAN);
        if (shLay && shLay.getLastRow() >= 1 && shLay.getLastColumn() >= 12) {
          try {
            shLay.getRange(2, 12, Math.max(shLay.getLastRow() - 1, 1), 1).setNumberFormat("#,##0.00##");
          } catch(e) {}
        }
      }
    ];
    for (let i = version; i < migrations.length; i++) { migrations[i](); version = i + 1; props.setProperty(MIGRATION_KEY, String(version)); }
    return { success: true, version: version };
  } finally { lock.releaseLock(); }
}

function ensureSheetSchema_(name, headers) {
  let sh = SS.getSheetByName(name);
  if (!sh) sh = SS.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, headers.length).setValues([headers]); return; }
  const existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  headers.forEach(function(header) { if (existing.indexOf(header) === -1) { sh.getRange(1, sh.getLastColumn() + 1).setValue(header); existing.push(header); } });
}

// ============================================================
// SETUP AWAL
// ============================================================
function setupSheets() {
  // Transaksi — added Tipe column
  let sh = SS.getSheetByName(SHEET_TRANSAKSI);
  if (!sh) sh = SS.insertSheet(SHEET_TRANSAKSI);
  sh.clear();
  sh.appendRow(["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe"]);

  let shD = SS.getSheetByName(SHEET_DETAIL);
  if (!shD) shD = SS.insertSheet(SHEET_DETAIL);
  shD.clear();
  shD.appendRow(["No Nota", "Layanan", "Qty", "Harga Satuan", "Subtotal"]);

  let shP = SS.getSheetByName(SHEET_PELANGGAN);
  if (!shP) shP = SS.insertSheet(SHEET_PELANGGAN);
  shP.clear();
  shP.appendRow(["No HP", "Nama Pelanggan", "Alamat", "Tanggal Daftar Pertama", "Total Transaksi", "Total Belanja", "Terakhir Order", "Catatan Pelanggan"]);

  // Layanan — added Tipe column (SelfService / FullService / Tambahan)
  let shL = SS.getSheetByName(SHEET_LAYANAN);
  if (!shL) shL = SS.insertSheet(SHEET_LAYANAN);
  shL.clear();
  shL.appendRow(["ID", "Nama Layanan", "Harga", "Satuan", "Icon", "Aktif", "Tipe"]);
  // Self Service
  shL.appendRow([generateId(), "Cuci 7,5 Kg", 10000, "paket", "🫧", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Cuci 4,5 Kg", 7000, "paket", "🫧", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Cuci + Kering 7,5 Kg (45 Mnt)", 18000, "paket", "🧺", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Cuci + Kering 4,5 Kg (45 Mnt)", 13000, "paket", "🧺", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Pengering (15 Menit)", 5000, "paket", "♨️", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Deterjen Cair", 1000, "porsi", "🧴", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Softener", 1000, "porsi", "🌸", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Deterjen Sachet", 1500, "sachet", "🧴", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Softener Sachet", 1500, "sachet", "🌸", "Y", "SelfService"]);
  shL.appendRow([generateId(), "Kresek Besar", 1000, "pcs", "🛍️", "Y", "SelfService"]);
  // Full Service
  shL.appendRow([generateId(), "Cuci Lipat", 7000, "kg", "👕", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Setrika", 10000, "kg", "👔", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Setrika Express (6 Jam)", 18000, "kg", "⚡", "Y", "FullService"]);
  shL.appendRow([generateId(), "Setrika Saja", 5000, "kg", "👔", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Bed Cover (Kecil)", 25000, "pcs", "🛏️", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Bed Cover (Besar)", 35000, "pcs", "🛏️", "Y", "FullService"]);
  shL.appendRow([generateId(), "Cuci Karpet /m²", 15000, "m²", "🧹", "Y", "FullService"]);

  let shI = SS.getSheetByName(SHEET_INVENTORY);
  if (!shI) shI = SS.insertSheet(SHEET_INVENTORY);
  shI.clear();
  shI.appendRow(["ID", "Nama Barang", "Stok", "Satuan", "Stok Minimum", "Terakhir Update"]);
  shI.appendRow([generateId(), "Deterjen Cair", 20, "liter", 5, new Date()]);
  shI.appendRow([generateId(), "Pewangi Pakaian", 15, "liter", 5, new Date()]);
  shI.appendRow([generateId(), "Plastik Packing", 200, "pcs", 50, new Date()]);
  try {
    shI.getRange(2, 3, 3, 1).setNumberFormat("#,##0.00##");
    shI.getRange(2, 5, 3, 1).setNumberFormat("#,##0.00##");
  } catch(e) {}

  let shM = SS.getSheetByName(SHEET_MESIN);
  if (!shM) shM = SS.insertSheet(SHEET_MESIN);
  shM.clear();
  shM.appendRow(["ID", "Nama Mesin", "Tipe", "Status", "Keterangan", "Mulai Pakai", "Estimasi Selesai"]);
  shM.appendRow([generateId(), "Mesin Cuci 1", "Washer", "Kosong", "", "", ""]);
  shM.appendRow([generateId(), "Mesin Cuci 2", "Washer", "Kosong", "", "", ""]);
  shM.appendRow([generateId(), "Mesin Cuci 3", "Washer", "Kosong", "", "", ""]);
  shM.appendRow([generateId(), "Dryer 1", "Dryer", "Kosong", "", "", ""]);
  shM.appendRow([generateId(), "Dryer 2", "Dryer", "Kosong", "", "", ""]);

  let shPeg = SS.getSheetByName(SHEET_PEGAWAI);
  if (!shPeg) shPeg = SS.insertSheet(SHEET_PEGAWAI);
  shPeg.clear();
  shPeg.appendRow(["ID", "Nama Pegawai", "No HP", "Jabatan", "Status", "Tanggal Bergabung"]);
  shPeg.appendRow([generateId(), "Budi Santoso", "08123456789", "Operator Laundry", "Aktif", new Date()]);
  shPeg.appendRow([generateId(), "Siti Rahma", "08987654321", "Kasir", "Aktif", new Date()]);

  let shAbs = SS.getSheetByName(SHEET_ABSENSI);
  if (!shAbs) shAbs = SS.insertSheet(SHEET_ABSENSI);
  shAbs.clear();
  shAbs.appendRow(["ID", "Tanggal", "Nama Pegawai", "Shift", "Clock In", "Clock Out", "Durasi Kerja", "Catatan"]);

  let shS = SS.getSheetByName(SHEET_SHIFT);
  if (!shS) shS = SS.insertSheet(SHEET_SHIFT);
  shS.clear();
  shS.appendRow(["ID", "Nama Shift", "Jam Masuk", "Jam Keluar", "Keterangan"]);
  shS.appendRow([generateId(), "Shift 1 (Pagi)", "07:00", "15:00", "Shift Pagi Utama"]);
  shS.appendRow([generateId(), "Shift 2 (Sore/Malam)", "15:00", "23:00", "Shift Sore/Malam Utama"]);

  // Pipeline
  let shPipe = SS.getSheetByName(SHEET_PIPELINE);
  if (!shPipe) shPipe = SS.insertSheet(SHEET_PIPELINE);
  shPipe.clear();
  shPipe.appendRow(["ID", "No Nota", "Step", "Nama Step", "Status", "Assigned Staff", "Mesin ID", "Waktu Mulai", "Waktu Selesai", "Catatan"]);

  Logger.log("✅ Setup v2.0 selesai! Semua sheet sudah dibuat.");
}

// ============================================================
// GOOGLE DRIVE SETUP & PERMISSIONS
// ============================================================

/**
 * SETUP GOOGLE DRIVE untuk Shift Expenses folder
 * Jalankan manual dari Apps Script editor untuk create folder struktur
 */
function setupGoogleDriveFolders() {
  try {
    const rootFolder = DriveApp.getRootFolder();
    let expensesFolder;
    
    // Cek apakah folder sudah ada
    const folders = rootFolder.getFoldersByName('Shift Expenses');
    if (folders.hasNext()) {
      expensesFolder = folders.next();
      return {
        success: true,
        folderId: expensesFolder.getId(),
        folderUrl: expensesFolder.getUrl(),
        message: '✅ Folder "Shift Expenses" sudah ada di Google Drive root'
      };
    }
    
    // Create folder baru
    expensesFolder = rootFolder.createFolder('Shift Expenses');
    
    return {
      success: true,
      folderId: expensesFolder.getId(),
      folderUrl: expensesFolder.getUrl(),
      message: '✅ Folder "Shift Expenses" berhasil dibuat di Google Drive. ID: ' + expensesFolder.getId()
    };
  } catch (error) {
    return {
      success: false,
      message: '❌ Error setup Google Drive: ' + error.message,
      troubleshoot: 'Pastikan Anda sudah authorize Apps Script untuk akses Google Drive'
    };
  }
}

/**
 * TEST UPLOAD - cek apakah upload berhasil
 * Jalankan dari Apps Script editor untuk verify setup
 */
function testDriveUpload() {
  try {
    const rootFolder = DriveApp.getRootFolder();
    const testFileName = 'TEST_UPLOAD_' + new Date().getTime() + '.txt';
    const testContent = 'Test file upload ke Google Drive - Shift Expenses\nTimestamp: ' + new Date().toISOString();
    
    // Cek/create Shift Expenses folder
    let targetFolder;
    const folders = rootFolder.getFoldersByName('Shift Expenses');
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = rootFolder.createFolder('Shift Expenses');
    }
    
    // Upload test file
    const blob = Utilities.newBlob(testContent, 'text/plain', testFileName);
    const uploadedFile = targetFolder.createFile(blob);
    
    return {
      success: true,
      testFileName: uploadedFile.getName(),
      fileId: uploadedFile.getId(),
      folderUrl: targetFolder.getUrl(),
      fileUrl: uploadedFile.getUrl(),
      message: '✅ Test upload berhasil! File tersimpan di Google Drive Shift Expenses folder'
    };
  } catch (error) {
    return {
      success: false,
      message: '❌ Test upload gagal: ' + error.message,
      troubleshoot: 'Periksa browser console untuk detail error'
    };
  }
}

/**
 * LIST Shift Expenses folder - cek file yang sudah upload
 */
function listShiftExpensesFiles() {
  try {
    const rootFolder = DriveApp.getRootFolder();
    const folders = rootFolder.getFoldersByName('Shift Expenses');
    
    if (!folders.hasNext()) {
      return { success: false, message: 'Folder Shift Expenses tidak ada. Jalankan setupGoogleDriveFolders() dulu.' };
    }
    
    const expensesFolder = folders.next();
    const files = expensesFolder.getFiles();
    const fileList = [];
    
    while (files.hasNext()) {
      const file = files.next();
      fileList.push({
        name: file.getName(),
        id: file.getId(),
        url: file.getUrl(),
        created: file.getDateCreated(),
        size: file.getSize()
      });
    }
    
    return {
      success: true,
      folderUrl: expensesFolder.getUrl(),
      totalFiles: fileList.length,
      files: fileList.reverse()
    };
  } catch (error) {
    return { success: false, message: 'Error list files: ' + error.message };
  }
}

// ============================================================
// UPDATED uploadExpensePhoto dengan better error handling
// ============================================================

/**
 * EXPENSE PHOTO UPLOAD TO GOOGLE DRIVE
 * Base64 image → Drive upload dengan folder per shift
 * Returns {success, fileId, fileName, fileUrl, ...}
 */
function uploadExpensePhoto(fileName, fileData, mimeType, shiftId) {
  try {
    let name = fileName;
    let data = fileData;
    let mime = mimeType || 'image/jpeg';
    let sId = shiftId;

    // Handle single object parameter
    if (typeof fileName === 'object' && fileName !== null) {
      name = fileName.fileName || fileName.name;
      data = fileName.fileData || fileName.data || fileName.base64;
      mime = fileName.mimeType || fileName.type || 'image/jpeg';
      sId = fileName.shiftId || fileName.idShift;
    }

    if (!name || !data) {
      return { success: false, message: 'Parameter fileName dan fileData wajib diisi' };
    }
    sId = sId || 'General';

    // Decode base64
    let decodedData;
    try {
      if (typeof data === 'string' && data.indexOf(',') !== -1) {
        // Strip data:image/png;base64, prefix if present
        const base64String = data.split(',')[1] || data;
        decodedData = Utilities.base64Decode(base64String);
      } else {
        decodedData = Utilities.base64Decode(String(data));
      }
    } catch (decodeErr) {
      return { success: false, message: 'Error decode base64: ' + decodeErr.message };
    }

    // Sanitize filename
    const cleanFileName = String(name || 'expense_' + Date.now()).replace(/[^\w\s\-\.]/g, '_').substring(0, 100);
    const extension = mime && mime.indexOf('png') !== -1 ? '.png' : '.jpg';
    const finalFileName = cleanFileName.indexOf('.') === -1 ? cleanFileName + extension : cleanFileName;

    // Get or create Shift Expenses folder
    const rootFolder = DriveApp.getRootFolder();
    let targetFolder = rootFolder;
    
    // Find or create "Shift Expenses" folder
    const expenseFolders = rootFolder.getFoldersByName('Shift Expenses');
    let expensesFolder;
    if (expenseFolders.hasNext()) {
      expensesFolder = expenseFolders.next();
    } else {
      expensesFolder = rootFolder.createFolder('Shift Expenses');
    }
    targetFolder = expensesFolder;

    // Find or create shift-specific subfolder
    if (sId) {
      const shiftFolders = expensesFolder.getFoldersByName(String(sId));
      if (shiftFolders.hasNext()) {
        targetFolder = shiftFolders.next();
      } else {
        targetFolder = expensesFolder.createFolder(String(sId));
      }
    }

    // Upload file
    const blob = Utilities.newBlob(decodedData, mime || 'image/jpeg', finalFileName);
    const uploadedFile = targetFolder.createFile(blob);
    try {
      uploadedFile.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW); // Optional: share publicly
    } catch (shareErr) {
      // Safe fallback if domain policies restrict external sharing
    }

    return {
      success: true,
      fileId: uploadedFile.getId(),
      fileName: uploadedFile.getName(),
      fileUrl: uploadedFile.getUrl(),
      downloadUrl: uploadedFile.getDownloadUrl(),
      mimeType: uploadedFile.getMimeType(),
      createdTime: new Date().toISOString(),
      shiftId: String(sId),
      size: uploadedFile.getSize()
    };
  } catch (error) {
    return {
      success: false,
      message: 'Gagal upload foto ke Google Drive: ' + error.message,
      errorDetails: error.toString()
    };
  }
}

/**
 * Updated CLOSE KAS SHIFT dengan support PENGELUARAN
 * - Simpan expense details (desc, amount, category)
 * - Simpan expense photo URLs
 */
function closeKasShift(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SS.getSheetByName(SHEET_KAS_SHIFT);
    if (!sh) return { success: false, message: "Sheet KasShift belum tersedia." };
    const rows = sh.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.shiftId) && rows[i][10] === "Aktif") { 
        rowIndex = i; 
        break; 
      }
    }
    if (rowIndex < 0) return { success: false, message: "Kas shift aktif tidak ditemukan." };
    if (["SERAH_TERIMA", "TUTUP_HARIAN"].indexOf(data.mode) === -1) return { success: false, message: "Mode penutupan tidak valid." };

    let replacement = { replacementEmployeeId: "", replacementName: "" };
    if (data.mode === "SERAH_TERIMA") {
      if (!data.handoverConfirmed) return { success: false, message: "Serah terima belum dikonfirmasi." };
      const check = handoverCheckKasShift({ shiftId: data.shiftId, idOutlet: rows[rowIndex][1], replacementEmployeeId: data.replacementEmployeeId });
      if (!check.eligible) return { success: false, message: check.message };
      replacement = check;
    }

    const kasFisik = Number(data.kasAkhir);
    if (!isFinite(kasFisik) || kasFisik < 0) return { success: false, message: "Kas akhir fisik tidak valid." };
    const saldoMerchantAkhir = Number(data.saldoMerchantAkhir !== undefined ? data.saldoMerchantAkhir : (data.merchantAkhir || 0));
    const openedAt = new Date(rows[rowIndex][4]);
    
    // Single-pass calculation for both cash and non-cash omzet
    const omzet = calculateShiftOmzet_(openedAt);
    const omzetTunai = omzet.tunai;
    const omzetMerchant = omzet.nonTunai;
    const kasAwal = Number(rows[rowIndex][6]) || 0;
    const saldoMerchantAwal = Number(rows[rowIndex][16]) || 0;
    
    // Expense data
    const expenseAmount = Number(data.expenseAmount || data.nominalBelanja || 0);
    const expenseDesc = String(data.expenseDesc || data.daftarBarang || "").trim();
    
    const kasSistem = kasAwal + omzetTunai - expenseAmount;
    const merchantSistem = saldoMerchantAwal + omzetMerchant;
    const selisihKas = kasFisik - kasSistem;
    const selisihMerchant = saldoMerchantAkhir - merchantSistem;
    const now = new Date();

    // Handle expense photos — ensure NO raw base64 data URLs (>2000 chars) are written to sheet cells
    let expensePhotos = "";
    if (data.expensePhotos && Array.isArray(data.expensePhotos) && data.expensePhotos.length > 0) {
      const photoUrls = data.expensePhotos
        .map(photo => (typeof photo === 'object' && photo.fileUrl ? photo.fileUrl : String(photo)))
        .filter(url => url && !url.startsWith('data:image') && url.length < 2000);
      expensePhotos = photoUrls.join(" | ");
    }

    // Ensure sheet schema has at least 20 columns in 1 single call
    const maxCols = sh.getMaxColumns();
    if (maxCols < 20) {
      sh.insertColumnsAfter(maxCols, 20 - maxCols);
    }

    const catatanFinal = (data.catatan || "") + (expenseDesc ? "\n\nBELANJA BARANG: " + expenseDesc + " (Rp " + expenseAmount.toLocaleString('id-ID') + ")" : "");

    // Single contiguous write from column 6 to column 20 (15 columns)
    sh.getRange(rowIndex + 1, 6, 1, 15).setValues([[
      now, 
      kasAwal, 
      kasSistem, 
      kasFisik, 
      selisihKas, 
      "Ditutup", 
      data.mode, 
      replacement.replacementEmployeeId || "", 
      replacement.replacementName || "", 
      data.mode === "SERAH_TERIMA" ? now : "", 
      catatanFinal,
      saldoMerchantAwal,
      saldoMerchantAkhir,
      expenseAmount,
      expensePhotos
    ]]);

    addAuditLog(data.userName || rows[rowIndex][2] || "Kasir", "Tutup Kas Shift", data.shiftId, 
      "Mode: " + data.mode + 
      "; Kas Laci Sistem Rp " + kasSistem.toLocaleString('id-ID') + ", Fisik Rp " + kasFisik.toLocaleString('id-ID') + " (Selisih: Rp " + selisihKas.toLocaleString('id-ID') + ")" +
      "; Merchant Sistem Rp " + merchantSistem.toLocaleString('id-ID') + ", Input Rp " + saldoMerchantAkhir.toLocaleString('id-ID') + " (Selisih: Rp " + selisihMerchant.toLocaleString('id-ID') + ")" +
      (expenseDesc ? "; Belanja: " + expenseDesc + " (Rp " + expenseAmount.toLocaleString('id-ID') + ")" : "") + 
      (expensePhotos ? "; Foto nota tersimpan" : ""));
    
    return { 
      success: true, 
      idShift: data.shiftId, 
      kasAkhirSistem: kasSistem, 
      kasAkhirFisik: kasFisik, 
      selisihKas: selisihKas, 
      merchantAkhirSistem: merchantSistem,
      merchantAkhirInput: saldoMerchantAkhir,
      selisihMerchant: selisihMerchant,
      totalBelanja: expenseAmount,
      mode: data.mode,
      expenseDetailSaved: !!expenseDesc,
      expensePhotosSaved: !!expensePhotos
    };
  } finally {
    lock.releaseLock();
  }
}

function getRekapKasShift() {
  const sh = SS.getSheetByName(SHEET_KAS_SHIFT);
  if (!sh || sh.getLastRow() < 2) return [];
  const rows = sh.getDataRange().getValues(); rows.shift();
  return rows.map(function(r) {
    const rawPhotos = String(r[19] || "").trim();
    const photoUrls = rawPhotos 
      ? rawPhotos.split(" | ")
          .map(function(url) { return url.trim(); })
          .filter(function(u) { return u && !u.startsWith("data:image") && u.length < 2000; }) 
      : [];
    
    // Parse catatan & belanja
    const catatan = String(r[15] || "");
    let rincianBelanja = "";
    if (catatan.includes("BELANJA BARANG: ")) {
      const parts = catatan.split("BELANJA BARANG: ");
      rincianBelanja = parts[1] || "";
    }

    const kasAwal = Number(r[6]) || 0;
    const kasAkhirSistem = Number(r[7]) || 0;
    const totalBelanja = Number(r[18]) || 0;
    const saldoMerchantAwal = Number(r[16]) || 0;
    const saldoMerchantAkhir = Number(r[17]) || 0;
    const isAktif = r[10] === "Aktif";

    let omzetTunai = 0;
    let omzetMerchant = 0;
    if (isAktif) {
      const activeOmz = calculateShiftOmzet_(new Date(r[4]));
      omzetTunai = activeOmz.tunai;
      omzetMerchant = activeOmz.nonTunai;
    } else {
      omzetTunai = Math.max(0, kasAkhirSistem - kasAwal + totalBelanja);
      omzetMerchant = Math.max(0, saldoMerchantAkhir - saldoMerchantAwal);
    }

    return {
      idShift: r[0],
      idOutlet: r[1],
      namaKasir: r[2],
      idUser: r[3] || "",
      waktuBuka: fmtWib(r[4]),
      waktuTutup: r[5] ? fmtWib(r[5]) : "",
      kasAwal: kasAwal,
      omzetTunai: omzetTunai,
      kasAkhirSistem: isAktif ? (kasAwal + omzetTunai - totalBelanja) : kasAkhirSistem,
      kasAkhirFisik: isAktif ? undefined : Number(r[8]) || 0,
      selisihKas: isAktif ? undefined : Number(r[9]) || 0,
      status: r[10],
      modeTutup: r[11] || "",
      idPengganti: r[12] || "",
      namaPengganti: r[13] || "",
      waktuHandover: r[14] ? fmtWib(r[14]) : "",
      catatan: catatan,
      rincianBelanja: rincianBelanja,
      saldoMerchantAwal: saldoMerchantAwal,
      saldoMerchantAkhir: saldoMerchantAkhir,
      omzetMerchant: omzetMerchant,
      totalBelanja: totalBelanja,
      fotoNota: photoUrls
    };
  }).reverse();
}

// ============================================================
// DATA SEEDER 6 BULAN (SRS-LNDRY-POS-001) - Super Fast Batch Insertion
// ============================================================
function seedData6Bulan() {
  setupSheets();
  
  let shT = SS.getSheetByName(SHEET_TRANSAKSI);
  let shD = SS.getSheetByName(SHEET_DETAIL);

  const pelangganList = [
    { nama: "Anisa Wijaya", hp: "081234567890" },
    { nama: "Rudi Hermawan", hp: "081398765432" },
    { nama: "Dian Sastro", hp: "085712345678" },
    { nama: "Eko Prasetyo", hp: "081908765432" },
    { nama: "Dewi Lestari", hp: "082134567890" },
    { nama: "Bayu Pratama", hp: "083898765432" },
    { nama: "Maya Indah", hp: "087812345678" },
    { nama: "Hendra Kurniawan", hp: "085608765432" },
    { nama: "Rina Kusuma", hp: "081534567890" },
    { nama: "Agus Setiawan", hp: "082298765432" }
  ];

  pelangganList.forEach(p => {
    simpanPelangganJikaBaru(p.nama, p.hp);
  });

  const layananPool = [
    { nama: "Cuci 7.5 Kg", harga: 10000, tipe: "SelfService" },
    { nama: "Cuci + Kering 7.5 Kg", harga: 18000, tipe: "SelfService" },
    { nama: "Deterjen Sachet", harga: 1500, tipe: "SelfService" },
    { nama: "Softener Pouch", harga: 1500, tipe: "SelfService" },
    { nama: "Cuci Komplit Reguler 7.5 Kg", harga: 20000, tipe: "FullService" },
    { nama: "Cuci Komplit Kilat 7.5 Kg", harga: 30000, tipe: "FullService" },
    { nama: "Setrika Saja 7.5 Kg", harga: 12000, tipe: "FullService" },
    { nama: "Cuci Bed Cover Jumbo", harga: 35000, tipe: "FullService" },
    { nama: "Cuci Sepatu Premium", harga: 35000, tipe: "FullService" },
    { nama: "Dry Clean Jas", harga: 45000, tipe: "FullService" }
  ];

  const petugasList = ["Siti Rahma", "Budi Santoso", "Kasir Utama"];
  const now = new Date();
  let counter = 1000;
  
  const batchTransaksi = [];
  const batchDetail = [];

  // Loop back 180 days (6 months)
  for (let dayOffset = 180; dayOffset >= 0; dayOffset--) {
    const txDate = new Date(now.getTime() - (dayOffset * 24 * 60 * 60 * 1000));
    // Generate 2 to 4 random transactions per day
    const txPerDay = Math.floor(Math.random() * 3) + 2;

    for (let i = 0; i < txPerDay; i++) {
      counter++;
      const noNota = "LDY-" + txDate.getFullYear().toString().slice(-2) + 
        ("0" + (txDate.getMonth() + 1)).slice(-2) + 
        ("0" + txDate.getDate()).slice(-2) + "-" + counter;

      const cust = pelangganList[Math.floor(Math.random() * pelangganList.length)];
      const pet = petugasList[Math.floor(Math.random() * petugasList.length)];
      
      const numItems = Math.floor(Math.random() * 2) + 1;
      let totalNota = 0;
      let primaryTipe = "FullService";

      for (let k = 0; k < numItems; k++) {
        const item = layananPool[Math.floor(Math.random() * layananPool.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const subtotal = item.harga * qty;
        totalNota += subtotal;
        primaryTipe = item.tipe;

        batchDetail.push([noNota, item.nama, qty, item.harga, subtotal]);
      }

      const status = dayOffset < 2 ? (Math.random() > 0.5 ? "Siap Ambil" : "Diterima") : "Selesai";
      const estimasiStr = fmtWib(new Date(txDate.getTime() + (24 * 60 * 60 * 1000)), "yyyy-MM-dd");

      batchTransaksi.push([
        noNota,
        txDate,
        cust.nama,
        cust.hp,
        totalNota,
        status,
        estimasiStr,
        pet,
        primaryTipe
      ]);
    }
  }

  // Fast Batch Append with setValues
  if (batchDetail.length > 0) {
    shD.getRange(shD.getLastRow() + 1, 1, batchDetail.length, 5).setValues(batchDetail);
  }
  if (batchTransaksi.length > 0) {
    shT.getRange(shT.getLastRow() + 1, 1, batchTransaksi.length, 9).setValues(batchTransaksi);
  }

  addAuditLog("System Seeder", "Data Seeding 6 Bulan", "6 Bulan Data", `Berhasil membuat ${batchTransaksi.length} sampel transaksi.`);
  return { success: true, count: batchTransaksi.length, message: `Berhasil meng-generate ${batchTransaksi.length} transaksi seeder 6 bulan!` };
}

function resetAndSeed6Bulan() {
  let shT = SS.getSheetByName(SHEET_TRANSAKSI);
  let shD = SS.getSheetByName(SHEET_DETAIL);
  if (shT) {
    shT.clear();
    shT.appendRow(["No Nota", "Tanggal", "Nama Pelanggan", "No HP", "Total", "Status", "Estimasi Selesai", "Petugas", "Tipe"]);
  }
  if (shD) {
    shD.clear();
    shD.appendRow(["No Nota", "Layanan", "Qty", "Harga Satuan", "Subtotal"]);
  }

  return seedData6Bulan();
}

// ============================================================
// KEAMANAN PIN MANAGEMENT
// ============================================================

function getSecuritySettings() {
  const props = PropertiesService.getScriptProperties();
  return {
    emailManager: props.getProperty("EMAIL_MANAGER") || ""
  };
}

function saveSecuritySettings(role, oldPin, newPin, emailManager) {
  const props = PropertiesService.getScriptProperties();
  
  // Jika yang diganti Manager, PIN harus 6 digit angka
  if (role === "MANAGER") {
    if (!newPin || String(newPin).length !== 6 || isNaN(newPin)) {
      return { success: false, message: "PIN Manager baru harus 6 digit angka." };
    }
    const currentManagerPin = props.getProperty("PIN_MANAGER") || PIN_MANAGER || "888888";
    if (String(oldPin) !== currentManagerPin) {
      return { success: false, message: "PIN Lama salah!" };
    }
    props.setProperty("PIN_MANAGER", String(newPin));
    if (emailManager !== undefined) {
      props.setProperty("EMAIL_MANAGER", emailManager);
    }
    return { success: true, message: "PIN Manager (6 digit) & Pengaturan berhasil diperbarui." };
  }
  
  // Jika ganti PIN staff (bisa 4 digit atau 6 digit)
  if (role === "STAFF") {
    if (!newPin || (String(newPin).length !== 4 && String(newPin).length !== 6) || isNaN(newPin)) {
      return { success: false, message: "PIN Staff baru harus 4 atau 6 digit angka." };
    }
    props.setProperty("PIN_STAFF", String(newPin));
    return { success: true, message: "PIN Staff berhasil diperbarui." };
  }

  return { success: false, message: "Role tidak valid." };
}

function recoverPin(emailInput) {
  try {
    const props = PropertiesService.getScriptProperties();
    const currentManagerPin = props.getProperty("PIN_MANAGER") || PIN_MANAGER || "888888";
    const registeredEmail = props.getProperty("EMAIL_MANAGER") || "";
    
    if (!registeredEmail) {
      return { success: false, message: "Email Manager belum didaftarkan di sistem. Hubungi developer." };
    }
    
    if (!emailInput || emailInput.toLowerCase() !== registeredEmail.toLowerCase()) {
      return { success: false, message: "Alamat email tidak cocok dengan yang terdaftar di sistem." };
    }

    const subject = "🔑 Pemulihan PIN Manager - POS Dua Sisi Laundry";
    const body = `Halo!\n\nIni adalah email otomatis dari sistem POS Dua Sisi Laundry.\n\nPIN Manager (6 digit) Anda saat ini adalah: ${currentManagerPin}\n\nHarap jaga kerahasiaan PIN ini.\n\nTerima kasih.`;

    MailApp.sendEmail(registeredEmail, subject, body);

    return { success: true, message: "Email berisi PIN pemulihan (6 digit) berhasil dikirim!" };
  } catch (err) {
    return { success: false, message: "Gagal mengirim email: " + err.message };
  }
}
