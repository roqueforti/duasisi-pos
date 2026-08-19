# 🛠️ Software Requirements Specification (SRS)
## DUA SISI LAUNDRY — System Architecture & Technical Specifications

- **Versi Dokumen:** 2.6
- **Klasifikasi:** Dokumen Spesifikasi Teknis Perangkat Lunak
- **Tahun Rilis:** 2026

---

## 1. 📐 Arsitektur Sistem & Data Flow

Sistem Dua Sisi Laundry POS mengadopsi pola **Hybrid Jamstack + Serverless Cloud Storage Database**:
- **Frontend App**: Next.js 16 (React 19 / TypeScript / Turbopack) di-deploy ke cloud Vercel PWA.
- **Backend API Gateway**: Google Apps Script (GAS) Web App Endpoint (`doPost` REST Router).
- **Data Persistence**: Google Sheets (Multi-table schema) dengan ACID-like synchronization via `LockService`.
- **Blob / File Storage**: Google Drive Cloud Storage (Folder structure per kas shift & foto presensi).

```
[ Frontend Browser / Tablet PWA ]
          │  ▲
          │  │ HTTPS (JSON RPC Payload: { action, args, sessionToken })
          ▼  │
[ Google Apps Script Web App: doPost Router ]
   ├── ALLOWED_API_ACTIONS (Whitelist Sanitizer)
   ├── Session Verification & Role Validator (Staff vs Manager)
   ├── Business Logic Modules:
   │    ├── API_Transaksi.js
   │    ├── API_Pipeline.js
   │    ├── API_Pelanggan.js
   │    ├── API_Shift.js
   │    ├── API_Layanan.js
   │    └── API_System.js
   │
   ├──▶ Google Sheets (Spreadsheet Database)
   │     [ Transaksi | DetailTransaksi | Pelanggan | Inventory | Pipeline | Mesin | KasShift | Presensi ]
   │
   └──▶ Google Drive API
         [ Shift Expenses / Kas-ID / photo.jpg ]
```

---

## 2. 🗄️ Skema Database Google Sheets

| Nama Sheet | Primary Key | Kolom Kunci & Deskripsi |
|:---|:---|:---|
| `Transaksi` | `No Nota` | `No Nota`, `Tanggal`, `Nama Pelanggan`, `No HP`, `Total`, `Status`, `Estimasi Selesai`, `Petugas`, `Tipe`, `Voucher`, `Status Void`, `Subtotal`, `Diskon`, `Metode Bayar`, `Status Pembayaran`, `Nominal DP`, `Sisa Tagihan`, `Referensi`, `Catatan`, `Tingkat Layanan` |
| `DetailTransaksi` | Compound (`No Nota` + `Layanan`) | `No Nota`, `Nama Layanan`, `Qty`, `Harga Satuan`, `Subtotal Item` |
| `Pelanggan` | `No HP` | `No HP`, `Nama Pelanggan`, `Alamat`, `Tanggal Daftar`, `Total Transaksi`, `Total Belanja`, `Terakhir Order`, `Catatan`, `Saldo Poin`, `Status Member`, `Tanggal Lahir` |
| `Inventory` | `ID Barang` | `ID Barang`, `Nama Barang`, `Stok`, `Satuan`, `Kategori`, `Harga Beli`, `Min Stok`, `Catatan` |
| `Mesin` | `ID Mesin` | `ID Mesin`, `Nama Mesin`, `Tipe` (Washer/Dryer), `Status` (Kosong/Digunakan/Maintenance), `Keterangan`, `Mulai Pakai`, `Estimasi Selesai` |
| `Pipeline` | `ID Pipeline` | `ID`, `No Nota`, `Step`, `Nama Step`, `Status` (Pending/Aktif/Selesai), `Assigned Staff`, `Mesin ID`, `Waktu Mulai`, `Waktu Selesai`, `Catatan` |
| `Layanan` | `ID Layanan` | `ID`, `Nama`, `Harga`, `Satuan`, `Icon`, `Status Aktif`, `Tipe` (SelfService/FullService), `Pipeline JSON`, `Kategori`, `ID Inventory Default`, `Qty Deduct Default`, `Bahan Baku List JSON`, `Kategori Drop Off` |
| `KasShift` | `ID Shift` | `ID Shift`, `Kasir`, `Waktu Buka`, `Modal Awal`, `Waktu Tutup`, `Kas Masuk Sistem`, `Total Pengeluaran`, `Kas Akhir Sistem`, `Kas Fisik Aktual`, `Selisih`, `Status`, `Catatan`, `List Pengeluaran JSON` |

---

## 3. 🌐 Spesifikasi API Backend (`Config.js` Router)

### Format Request:
```json
{
  "action": "simpanTransaksi",
  "args": [ { "namaPelanggan": "Hilman", "noHp": "08123456789", ... } ],
  "sessionToken": "JWT-like base64 HMAC token"
}
```

### Whitelist Aksi API (`ALLOWED_API_ACTIONS`):
- **Aksi Publik (Tanpa Sesi)**: `verifikasiPin`, `getTransaksiByNota`, `recoverPin`, `cekPoinPelanggan`.
- **Aksi Staff & Kasir**: `simpanTransaksi`, `pelunasanDP`, `getLayananList`, `getInventoryList`, `updateStokInventory`, `getMesinList`, `mulaiPakaiMesin`, `selesaiMesin`, `getPipelineSteps`, `updateDropoffStatus`, `getTransaksiByPipeline`, `cariPelangganByHp`, `getDaftarPelanggan`, `daftarMember`, `simpanPelangganJikaBaru`, `clockInPegawai`, `clockOutPegawai`, `getKasShiftAktif`, `openKasShift`, `handoverCheckKasShift`, `closeKasShift`, `uploadExpensePhoto`.
- **Aksi Khusus Manager**: `tambahLayanan`, `updateLayanan`, `hapusLayanan`, `tambahInventory`, `hapusInventory`, `tambahPegawai`, `getPayrollSummary`, `savePayrollPayment`, `getLaporanRange`, `getAuditLogs`, `approveVoidTransaksi`, `savePoinConfig`, `savePriorityConfig`, `tambahKategori`, `savePipelineConfigData`, `saveSecuritySettings`.

---

## 4. 🖨️ Spesifikasi Integrasi Perangkat Keras

### Web Bluetooth Thermal Printer (ESC/POS)
- **Protokol:** Web Bluetooth API (`navigator.bluetooth`).
- **GATT Service UUID:** `000018f0-0000-1000-8000-00805f9b34fb` (Printer Service).
- **GATT Characteristic UUID:** `00002af1-0000-1000-8000-00805f9b34fb` (Write Data).
- **Karakteristik Format Cetak:**
  - Lebar Kertas: 58mm (32 karakter/baris) & 80mm (48 karakter/baris).
  - Formatting Commands: Bold (`ESC E 1`), Center Align (`ESC a 1`), Paper Cut (`GS V 66 0`).
  - Label Tag Pakaian: Header Nomor Nota ekstra tebal + Nama Pelanggan + Item ringkas.

---

## 5. 🗺️ Spesifikasi Integrasi Geocoding Peta (OpenStreetMap)

- **Provider:** Komoot Photon Geocoding API (Berbasis OpenStreetMap & Nominatim).
- **Endpoint:** `https://photon.komoot.io/api/?q={query}&lat=-7.95&lon=112.63&limit=5&lang=default`
- **Prioritas Lokasi:** Koordinat Malang & Jawa Timur (`lat: -7.95, lon: 112.63`).
- **Data Parsing:** Normalisasi jalan, kelurahan/kecamatan (*district/county*), kota (*city*), dan kode pos (*postcode*) ke string alamat standar Indonesia.

---

## 6. 🔒 Protokol Keamanan & Sesi

1. **Token Sesi & HMAC Verification**:
   - Token dibuat saat login sukses dengan hashing HMAC SHA-256 berbasis secret key spreadsheet.
2. **Inactivity Timeout (30 Menit)**:
   - Setiap interaksi pengguna (`mousedown`, `keydown`, `touchstart`, `scroll`) memperbarui timestamp `gas_session_last_activity`.
   - Poller latar belakang mendeteksi jika sesi inaktif melampaui 30 menit dan secara otomatis mengunci terminal ke layar PIN.
3. **Audit Log Trail**:
   - Setiap perubahan penting (void transaksi, perubahan stok, login, serah terima kasir) mencatat `ID Audit`, `Waktu (WIB)`, `User`, `Aksi`, `Objek`, dan `Detail` ke sheet `AuditLogs`.
