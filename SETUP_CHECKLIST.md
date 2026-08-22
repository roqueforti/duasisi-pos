# Setup Checklist - POS Dua Sisi Laundry (v2.5)

Semua 10 task tablet UX improvements sudah complete. Ikuti checklist ini untuk production setup.

## ✅ Frontend (Next.js) - Ready

- [x] UI diperbesar untuk tablet (font sm→base, padding, buttons)
- [x] Numpad login PIN dengan on-screen keyboard 3×4
- [x] Numpad payment calculator split layout
- [x] Inventory: STAFF bisa update stok +1/-1 & tambah barang
- [x] Stok delete/CSV tetap MANAGER only (role guard)
- [x] Estimasi selesai dihapus dari checkout form
- [x] QR code hanya untuk QRIS, metode lain tampil info
- [x] Poin pelanggan di badge keranjang (⭐)
- [x] Tombol cetak struk aktif (PrinterModal)
- [x] Drop-off struk: tingkat layanan + estimasi otomatis
- [x] Modal responsive untuk tablets (max-w-5xl)

**Status:** ✅ Deployed

## ✅ Backend (Google Apps Script) - Setup Required

### 1. Deploy dengan Drive Permissions

- [ ] Buka Google Sheets POS spreadsheet
- [ ] **Extensions** → **Apps Script** → **Deploy** → **New Deployment**
- [ ] Select: **Web app**
- [ ] Execute as: Google account yang punya akses Drive
- [ ] Who has access: **Anyone**
- [ ] **Deploy**
- [ ] **Review permissions** → Authorize:
  - Spreadsheets
  - Google Drive
  - Gmail (opsional)

### 2. Setup Google Drive Folders

- [ ] Apps Script editor → **Editor** tab
- [ ] Pilih function: **`setupGoogleDriveFolders`** (dropdown di samping Run button)
- [ ] Click ▶️ **Run**
- [ ] Lihat **Execution Logs** → Cek output `✅ Folder "Shift Expenses" created`

### 3. Test Upload Function

- [ ] Apps Script editor → Pilih function: **`testDriveUpload`**
- [ ] Click ▶️ **Run**
- [ ] Lihat **Execution Logs** → Cek `✅ Test upload berhasil`

### 4. Verify Folder Structure

- [ ] Apps Script editor → Pilih function: **`listShiftExpensesFiles`**
- [ ] Click ▶️ **Run**
- [ ] Verify output menampilkan test file yang di-upload

**Expected folder di Google Drive:**
```
My Drive/
  └── Shift Expenses/
      ├── KAS-20260813-0001/       (auto-created per shift)
      │   ├── expense_1723456789.jpg
      │   ├── expense_1723456890.jpg
      │   └── ...
      └── KAS-20260814-0001/
          └── ...
```

## ✅ Configuration

### Frontend Config (`/next-app/lib/api.ts`)

- [x] Apps Script Web App URL sudah benar
- [x] `runBackend()` function ready untuk call API

### Backend Config (`appsscript.json`)

- [x] OAuth scopes added: Spreadsheets, Drive, Gmail
- [x] Runtime: V8
- [x] Timezone: Asia/Jakarta

### API Actions (`Kode.gs`)

- [x] `uploadExpensePhoto` added ke ALLOWED_API_ACTIONS
- [x] `closeKasShift` updated untuk handle expenses + photos

## ✅ PIN Credentials - Setup Required

Apps Script default PINs:
- **STAFF PIN:** `1234` (4-digit)
- **MANAGER PIN:** `888888` (6-digit)

**For production, change PINs:**

1. Apps Script editor → **Project Settings** (gear icon)
2. **Script Properties** → **Edit script properties**
3. Tambah:
   ```
   PIN_STAFF = "6 digit custom PIN"
   PIN_MANAGER = "6 digit custom PIN"
   ```
4. Save
5. Re-deploy

Atau update di `Kode.gs` line 67-68 before deployment.

## ✅ Testing Checklist

### Manual Testing (Local/Staging)

- [ ] Login: Test both PIN (STAFF & MANAGER)
- [ ] POS View: Test numpad input untuk payment
- [ ] Inventory: STAFF add item + update stok
- [ ] Inventory: Delete/CSV hanya jalan dengan MANAGER role
- [ ] Checkout: Estimasi tidak tampil (dihapus)
- [ ] Payment methods: Test Tunai + QRIS
- [ ] Drop-off: Pilih tingkat → Check estimasi auto-calculate
- [ ] Print: Connect printer & test print struk
- [ ] Close shift: Isi pengeluaran + ambil foto → Check upload ke Drive

### Tablet Testing (Physical Device)

- [ ] Login numpad: Touch sensitivity OK, keyboard responsive
- [ ] Payment numpad: Tombol 1-9, 0, C, backspace visible & responsive
- [ ] Modal: Left panel scrolls OK, right panel fit tanpa overflow
- [ ] Print: Bluetooth printer connect & print working
- [ ] Photo upload: Foto ter-capture & ter-upload ke Drive

### Error Handling

- [ ] Disconnect internet: Check error messages jelas
- [ ] Wrong PIN: Error message "PIN Salah"
- [ ] Drive error: Check `uploadExpensePhoto` returns error gracefully
- [ ] Payment issues: Bisnis flow tidak crash

## 📋 Deployment Steps

### 1. Production Deploy

```bash
cd next-app
npm run build
npm run export  # (if using static export)
# Deploy to Vercel / server
```

### 2. Apps Script Deploy

- Apps Script editor → **Deploy** → **New Deployment** (Web app)
- Copy deployment URL → Update frontend config if needed
- Note: Setiap kali ada perubahan code, harus re-deploy

### 3. Google Drive Permissions

- Verify: `setupGoogleDriveFolders()` sudah ran
- Verify: "Shift Expenses" folder exist di Drive root
- Verify: Permissions allow upload

## 🔍 Post-Deployment Verification

- [ ] Frontend accessible via URL
- [ ] Login works (PIN numpad)
- [ ] POS view loads without error
- [ ] Create transaction & complete payment
- [ ] Close shift & upload photo ke Drive
- [ ] Check Google Drive → Shift Expenses folder exists
- [ ] Photos uploaded correctly
- [ ] Print works (if printer connected)

## 📞 Support

### Common Issues

**"Tidak dapat memverifikasi login"**
- Re-deploy Apps Script & authorize permissions

**"Gagal upload foto ke Google Drive"**
- Check: `setupGoogleDriveFolders()` sudah run
- Check: Apps Script authorized untuk Drive
- Check: Execution logs di Apps Script console

**"Drive API not available"**
- Re-deploy Web App deployment
- Authorize Drive scope during re-deploy

**Numpad not appearing**
- Clear browser cache
- Reload page
- Check console for JS errors

## 🚀 Go Live!

Once all checkboxes checked:

1. ✅ Frontend deployed
2. ✅ Backend (Apps Script) deployed & authorized
3. ✅ Google Drive folders setup
4. ✅ Testing complete
5. ✅ Error handling verified

**Status: Ready for Production** 🎉

---

**Last updated:** August 13, 2026  
**Version:** v2.5 (All 10 tablet UX improvements)  
**Commits:** 5736b1b  
