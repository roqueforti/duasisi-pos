# 📄 Product Requirements Document (PRD)
## DUA SISI LAUNDRY — Cloud POS & Operational Management System

- **Versi Dokumen:** 2.6
- **Status:** Production Ready / Active Development
- **Target Platform:** Web Desktop / Tablet Landscape PWA (Kasir & Staff) & Mobile Responsive (Customer Portal)
- **Tahun Rilis:** 2026

---

## 1. 🎯 Latar Belakang & Visi Produk

**Dua Sisi Laundry** adalah unit bisnis binatu modern yang menggabungkan layanan **Express Drop Off (Full Service)** dan **Self Service Coin Laundry (Cuci & Kering Mandiri)**, dilengkapi area tunggu (*Lounge Work From Laundry*) dan penjualan produk/retail.

### Visi Produk
Menciptakan sistem operasional kasir dan manajemen binatu yang:
1. **Bebas Hambatan Biaya Server**: Menggunakan arsitektur serverless Google Sheets & Google Apps Script sebagai database cloud tanpa biaya langganan bulanan database terpisah.
2. **Efisiensi Tablet Kasir Tinggi**: Antarmuka kasir layar sentuh yang cepat, tombol besar ramah tablet, kalkulator split payment, auto-suggest upselling, dan pencetakan struk termal nirkabel.
3. **Visibilitas Produksi Fisik (Kanban Drop-off)**: Menghilangkan risiko cucian tertukar, hilang, atau terlambat melalui pipeline pelacakan langkah kerja fisik yang dinamis dan terhubung dengan mesin cuci/dryer.
4. **Loyalitas & Pengalaman Pelanggan**: Portal publik mandiri bagi pelanggan untuk melacak status pengerjaan pakaian secara real-time, mengecek saldo cashback poin, dan melihat E-Nota resmi.

---

## 2. 👥 Persona & Peran Pengguna

| Peran | Tanggung Jawab Utama | Hak Akses Sistem |
|:---|:---|:---|
| **Staff / Kasir** | Melayani transaksi penjualan, input cucian drop-off, presensi GPS, menjalankan mesin, memindahkan tahapan produksi, dan mengelola kas shift. | Menu: POS Kasir, Pesanan Drop-off, Status Mesin, Riwayat Transaksi, Data Pelanggan, Stok Inventory, Presensi. *(Dibatasi dari laporan keuangan & pengaturan sistem)* |
| **Manager / Owner** | Memantau omzet harian, performa karyawan, persetujuan void nota, penetapan harga layanan & bahan baku, penggajian (payroll), dan audit keamanan. | Akses penuh ke seluruh menu termasuk: Laporan Rekap, Payroll, Keamanan & PIN, Manajemen Layanan/Kategori/Pipeline. |
| **Pelanggan (Customer)** | Mencari informasi layanan, melacak status cucian drop-off, memeriksa saldo poin reward, dan mengunduh E-Nota bukti transaksi. | Portal Publik Landing Page (Proteksi 2-Faktor No. Nota + 4 Digit No. HP). |

---

## 3. 🧩 Spesifikasi Fitur Utama

### A. Point of Sale (POS Kasir)
- **Katalog & Kategori Dinamis**:
  - Filter kategori: Drop Off, Self Service Koin, Add On (Pewangi/Spotting), Makanan & Minuman.
  - Opsi Kecepatan Drop Off: *Reguler (48 jam)*, *Express (24 jam)*, *Kilat (6 jam)* dengan durasi dan estimasi selesai otomatis.
- **CRM & Pendaftaran Member Cepat**:
  - Auto-check nomor WhatsApp pelanggan saat diketik (menampilkan total transaksi sebelumnya & saldo poin).
  - Modal pendaftaran member baru dilengkapi **Autocomplete Alamat OpenStreetMap (Photon API)** dengan prioritas pencarian wilayah lokal.
  - Tanggal Lahir (TTL) & Alamat lengkap untuk analisis demografi pelanggan.
- **Proteksi Poin Loyalitas**:
  - Poin reward cashback hanya didapatkan dan ditampilkan untuk **Member Resmi Terdaftar**.
  - Pelanggan Umum (Non-Member) tidak melihat counter/akumulasi poin di kasir, keranjang, E-Nota, maupun struk cetak.
- **Rekomendasi Upselling Kasir**:
  - Algoritma saran kasir yang menyarankan opsi kecepatan lebih cepat saat memesan drop-off reguler, penambahan softener premium, atau minuman pendamping.
- **Pembayaran Fleksibel & Struk**:
  - Metode: Tunai (dengan kalkulator kembalian instan), QRIS, Transfer Bank, Debit/Kredit Card.
  - Integrasi Bluetooth Thermal Printer ESC/POS (58mm/80mm) untuk struk kasir & label tag baju tahan air.
  - Kirim Struk WhatsApp resmi dengan format teks bersih bebas karakter rusak/corrupt unicode.

### B. Manajemen Produksi Pesanan Drop-off (Kanban Dinamis)
- **Papan Kanban Multi-Tahap**:
  - Kolom alur langkah pengerjaan dibentuk secara dinamis dari master pipeline (contoh: `Dicuci`, `Dikeringkan`, `Disetrika`, `Dilipat`, `Siap Diambil`).
  - Tombol *"Lanjut ke [Langkah]"* pada kartu pesanan otomatis membaca urutan pipeline spesifik dari produk tersebut (misal: *Cuci Kering Lipat* langsung beralih ke *Dilipat*, bukan *Disetrika*).
- **Alokasi Mesin & Riwayat Produksi**:
  - Penugasan mesin washer atau dryer fisik yang sedang kosong.
  - Pencatatan staf yang memproses tiap tahapan dan timestamp mulai/selesai.
- **Pemotongan Stok Bahan Baku Otomatis (Bill of Materials / BOM)**:
  - Setiap layanan dapat dihubungkan dengan multi-bahan baku (misal: Deterjen Cair 50ml di tahap Dicuci + Plastik Packing 1 pcs di tahap Dilipat).
  - Stok gudang otomatis terpotong saat pesanan memasuki tahap terkait.

### C. Status Operational Mesin
- Halaman dedicated pemantauan mesin cuci & dryer outlet.
- Status operational: `Kosong`, `Digunakan` (dengan info nomor nota & estimasi selesai), `Maintenance`.

### D. Kas Shift & Keuangan Kasir
- Pembukaan modal awal kas kasir per shift.
- Pencatatan pengeluaran kas kecil operasional (bukti nota/struk difoto via webcam/kamera tablet dan diupload otomatis ke folder Google Drive).
- Serah terima shift (*Handover Check*) dengan rekonsiliasi kas fisik vs sistem.

### E. Presensi & Kepegawaian
- Presensi Clock-In / Clock-Out dengan verifikasi koordinat radius GPS outlet & foto selfie langsung.
- Pengajuan izin dan cuti staf.
- Rekap absensi dan modul penggajian (Payroll).

### F. Portal Publik Pelanggan (Customer Landing Page)
- **3D DriftWall Galeri Outlet**: Showcase foto-foto asli fasilitas outlet dengan animasi interaktif 3D.
- **Lacak Cucian Horizontal (Menyamping)**: Stepper alur pengerjaan drop-off modern yang menyamping, ringkas, dan responsif.
- **E-Nota Permanen & Cek Saldo Poin**: Akses digital nota resmi terlindungi token aman.

---

## 4. 🔒 Persyaratan Non-Fungsional

1. **Keamanan & Autentikasi**:
   - Autentikasi berbasis PIN 4-6 digit (Staff vs Manager).
   - Auto-logout inaktivitas 30 menit dengan pendeteksi interaksi global.
   - Proteksi API backend dengan whitelist `ALLOWED_API_ACTIONS` dan role validation.
2. **Kinerja & Kecepatan**:
   - Client-side in-memory caching untuk master data layanan dan inventaris.
   - Waktu muat halaman Next.js di bawah 1.5 detik pada koneksi 4G.
3. **Kompatibilitas Perangkat**:
   - Dioptimalkan untuk Tablet Android & iPad Landscape (10-12 inch) pada kasir POS.
   - Kompatibel dengan peramban modern (Chrome, Edge, Safari, Firefox).
