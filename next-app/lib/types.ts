export type UserRole = 'STAFF' | 'MANAGER' | '';

export type KecepatanLayanan = 'Reguler' | 'Express' | 'Kilat';

export interface LayananItem {
  layanan: string;
  hargaSatuan: number;
  tipe: 'SelfService' | 'FullService';
  satuan?: string;
  icon?: string;
  kategori?: 'Layanan' | 'Layanan Tambahan' | 'Produk' | 'MakananMinuman';
}

export interface CartItem {
  layanan: string;
  hargaSatuan: number;
  qty: number;
  catatan?: string;
}

export interface TransaksiItem {
  layanan: string;
  qty: number;
  hargaSatuan: number;
  catatan?: string;
}

export interface Transaksi {
  noNota: string;
  tanggal: string;
  namaPelanggan: string;
  noHp?: string;
  petugas: string;
  tipe: 'SelfService' | 'FullService';
  tingkatLayanan?: KecepatanLayanan;
  subtotal?: number;
  diskon?: number;
  pajak?: number;
  total: number;
  nominalDP?: number;
  sisaTagihan?: number;
  metodeBayar?: 'Tunai' | 'QRIS' | 'Transfer' | 'Kartu' | 'Split';
  statusPembayaran?: 'Lunas' | 'DP' | 'Belum Bayar';
  referensiPembayaran?: string;
  status: 'Diterima' | 'Dicuci' | 'Dikeringkan' | 'Disetrika' | 'Siap Diambil' | 'Selesai' | 'Void' | 'Batal';
  statusVoid?: 'None' | 'PendingApproval' | 'Approved' | 'Rejected';
  alasanVoid?: string;
  catatan?: string;
  estimasiSelesai?: string;
  idOutlet?: string;
  items: TransaksiItem[];
}

export interface ShiftKasir {
  idShift: string;
  idUser: string;
  namaKasir: string;
  kasAwal: number;
  kasAkhir?: number;
  totalOmzetTunai?: number;
  selisihKas?: number;
  status: 'Buka' | 'Tutup';
  waktuBuka: string;
  waktuTutup?: string;
}

export interface PromoVoucher {
  idPromo: string;
  kodeVoucher: string;
  jenisDiskon: 'Persentase' | 'Nominal';
  nilaiDiskon: number;
  minTransaksi?: number;
  periodeSelesai?: string;
  kuota?: number;
  statusAktif: boolean;
}

export interface Pelanggan {
  idPelanggan: string;
  nama: string;
  noHp: string;
  alamat?: string;
  saldoPoin: number;
  isBlacklist: boolean;
  tanggalDaftar: string;
}

export interface AuditLog {
  idLog: string;
  idUser: string;
  namaUser: string;
  jenisAktivitas: string;
  referensi?: string;
  detail?: string;
  waktu: string;
}

export interface Pegawai {
  nama: string;
  jabatan: string;
  noHp?: string;
  role: 'STAFF' | 'MANAGER';
}

export interface Mesin {
  id: string;
  nama: string;
  tipe: 'Washer' | 'Dryer';
  status: 'Kosong' | 'Digunakan' | 'Maintenance';
}

export interface BahanInventory {
  nama: string;
  stok: number;
  satuan: string;
  minStok: number;
}
