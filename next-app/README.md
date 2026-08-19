# 📱 Dua Sisi Laundry — Next.js 16 PWA Frontend

Frontend Point of Sale (POS) dan Portal Publik Mandiri Pelanggan untuk **Dua Sisi Laundry**, dibangun dengan Next.js 16 (Turbopack & App Router), React 19, TypeScript, dan Tailwind CSS.

---

## 🚀 Fitur & Komponen Utama

### 1. Terminal POS Internal (`/duasisi-terminal-pos`)
- **`PosAppRoot.tsx`**: Shell aplikasi utama, handler sesi login PIN (Staff & Manager), auto-logout inaktivitas 30 menit, dan switching tab.
- **`PosView.tsx`**: Modul kasir utama, katalog kategori, rekomendasi upselling, pendaftaran member cepat dengan OpenStreetMap autocomplete, kalkulator pembayaran, struk Bluetooth thermal printer, dan notifikasi WhatsApp.
- **`PesananView.tsx`**: Papan Kanban dinamis pesanan drop-off (Dicuci, Dikeringkan, Disetrika, Dilipat, Siap Diambil), penugasan staf dan mesin cuci/dryer.
- **`MesinView.tsx`**: Monitoring status operasional mesin washer dan dryer secara langsung.
- **`ShiftKasirView.tsx`**: Manajemen kas modal awal, input pengeluaran operasional (dengan upload foto kamera ke Drive), dan serah terima kasir.
- **`PresensiView.tsx`**: Presensi masuk & pulang pegawai dengan GPS Geolocation & kamera selfie langsung.
- **`PelangganView.tsx`**: CRM data pelanggan, riwayat order, saldo poin loyalitas, dan pencarian alamat.
- **`StokInventoryView.tsx`**: Pengendalian stok bahan baku, alert min-stok, dan riwayat mutasi.
- **`RekapView.tsx`**: Laporan keuangan, analitik omzet, metode bayar, dan performa kasir (Khusus Manager).
- **`PengaturanView.tsx`**: Konfigurasi layanan, multi-bahan baku (BOM), pipeline tahapan, dan pengaturan PIN keamanan.

### 2. Portal Publik Pelanggan (`/`)
- **`CustomerLandingPage.tsx`**:
  - **Lacak Cucian Horizontal**: Stepper proses pengerjaan drop-off modern menyamping dengan estimasi selesai otomatis.
  - **Cek Saldo Poin Member**: Cek akumulasi poin cashback hanya dengan memasukkan No. HP.
  - **3D DriftWall Galeri**: Showcase fasilitas outlet asli interaktif tanpa foto AI.
- **`ENotaView.tsx` (`/enota?t=<token>`)**: Lembar E-Nota digital resmi pelanggan yang dapat dicetak atau disimpan sebagai PDF.

---

## 🛠️ Tech Stack & Library

- **Framework**: Next.js 16.2.11 (Turbopack Engine)
- **UI Library**: React 19, Lucide React Icons, Canvas Confetti
- **Styling**: Tailwind CSS, Custom Glassmorphism & Modern Minimalist Dark Theme
- **State & Data Layer**: Client-side Cache In-Memory Layer (`lib/cache.ts`) & Google Apps Script RPC Client (`lib/api.ts`)
- **Perangkat Keras**: Web Bluetooth API (`lib/bluetoothPrinter.ts`)

---

## 💻 Panduan Menjalankan

```bash
# Masuk ke direktori next-app
cd next-app

# Install dependensi
npm install

# Jalankan server lokal
npm run dev

# Validasi TypeScript
npx tsc --noEmit

# Build bundle produksi
npm run build
```

---

## 🌐 Rute Halaman (App Router)

| Rute URL | Akses | Fungsi |
|:---|:---|:---|
| `/` | Publik | Landing Page & Portal Mandiri Pelanggan (Lacak Cucian & Cek Poin) |
| `/duasisi-terminal-pos` | Internal | Terminal Utama Kasir POS & Operasional Outlet |
| `/enota` | Publik | E-Nota Digital Pelanggan (Terproteksi Token Obfuscation) |
| `/lupa-pin` | Internal | Pemulihan PIN Staff/Manager via Google Drive / Security Question |

