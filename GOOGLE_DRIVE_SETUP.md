# Google Drive Setup untuk Shift Expenses Upload

Panduan langkah-langkah setup Google Drive API untuk fitur upload foto pengeluaran shift.

## Step 1: Deploy Apps Script dengan Drive Permissions

Apps Script sudah dikonfigurasi dengan OAuth scope untuk Google Drive. Setiap kali deploy, permission akan diminta.

### Deploy ke Production:

1. Buka **Google Sheets** → Buka spreadsheet POS Dua Sisi Laundry
2. Click **Extensions** → **Apps Script**
3. Di editor Apps Script, click **Deploy** → **New Deployment** → **Select Type: Web app**
4. **Execute as:** Pilih akun Google Anda (owner/admin)
5. **Who has access:** Tetap `Anyone`
6. Click **Deploy**
7. **Authorize requested** → Review permissions:
   - ✅ Spreadsheets (untuk akses sheet)
   - ✅ Google Drive (untuk upload foto)
   - ✅ Gmail (untuk send notifications - opsional)
8. Approve semua permissions

## Step 2: Setup Folder di Google Drive

Setelah deploy, jalankan setup function dari Apps Script editor:

### Manual via Apps Script Console:

1. Apps Script editor → **Editor** tab
2. Pilih function **`setupGoogleDriveFolders`** dari dropdown (di samping ▶️ Run button)
3. Click ▶️ **Run**
4. Check **Execution Log** untuk hasil

**Expected output:**
```
✅ Folder "Shift Expenses" sudah ada di Google Drive root
✅ Folder "Shift Expenses" berhasil dibuat di Google Drive. ID: [ID folder]
```

## Step 3: Verify Setup dengan Test Upload

1. Apps Script editor → Pilih function **`testDriveUpload`**
2. Click ▶️ **Run**
3. Check **Execution Log**

**Expected output:**
```
✅ Test upload berhasil! File tersimpan di Google Drive Shift Expenses folder
```

Jika error, lihat **Troubleshooting** di bawah.

## Step 4: List Files untuk Verify

Untuk melihat file yang sudah upload:

1. Apps Script editor → Pilih function **`listShiftExpensesFiles`**
2. Click ▶️ **Run**
3. Check **Execution Log** untuk list file

## Testing di Frontend

Setelah setup selesai, saat user tutup shift:

1. Click **Tutup Buku Shift** di PosView
2. Isi pengeluaran (deskripsi, amount, kategori)
3. Click **Ambil Foto** → Foto akan di-capture
4. Click **Simpan Shift** → Foto akan di-upload ke Google Drive

## Troubleshooting

### Error: "Tidak dapat memverifikasi login"
- **Penyebab:** Permission belum di-authorize di Apps Script
- **Solusi:** Re-deploy dan authorize semua permissions

### Error: "Gagal upload foto ke Google Drive: [error message]"

#### "Error: Drive.Files is not defined"
- Apps Script permission belum aktif
- **Solusi:** Re-deploy dan authorize Drive scope

#### "Error: The file with the given ID does not exist"
- Folder "Shift Expenses" tidak terbuat
- **Solusi:** Jalankan `setupGoogleDriveFolders()` dari Apps Script console

#### "Error: You do not have permission"
- Google Drive folder not accessible
- **Solusi:** Verify akun Google yang di-deploy memiliki akses ke Drive

### Setup Tidak Terlihat di Frontend

Saat close shift, foto tidak upload:

1. Check **Deployment ID** cocok di frontend config (`/next-app/lib/api.ts`)
2. Check **Network tab** (DevTools) untuk error response dari Apps Script
3. Check Apps Script **Execution Log** untuk error detail

## Manual Setup (Jika Automated Gagal)

Jika ingin setup folder manual:

1. Buka **Google Drive** → Root folder
2. **New** → **Folder** → Beri nama `Shift Expenses`
3. Di dalamnya, buat subfolder dengan nama Shift ID (contoh: `KAS-20260813-0001`)
4. Folder siap untuk upload

## Frontend Implementation

Di **PosView.tsx**, saat close shift:

```typescript
// Upload photo ke Google Drive
const uploadResult = await runBackend('uploadExpensePhoto', [
  `expense_${new Date().getTime()}`,
  base64PhotoData,
  'image/jpeg',
  shiftId
]);

if (uploadResult.success) {
  // Simpan fileUrl untuk reference di spreadsheet
  expensePhotos.push(uploadResult.fileUrl);
}
```

## Reference

- [Google Apps Script Drive API](https://developers.google.com/apps-script/reference/drive)
- [Google Drive API Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Apps Script Web App Deployment](https://developers.google.com/apps-script/concepts/deploymentsapis)
