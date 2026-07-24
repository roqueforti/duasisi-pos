export type UserRole = 'STAFF' | 'MANAGER' | '';

export interface LayananItem {
  layanan: string;
  hargaSatuan: number;
  tipe: 'SelfService' | 'FullService';
  satuan?: string;
  icon?: string;
}

export interface CartItem {
  layanan: string;
  hargaSatuan: number;
  qty: number;
}

export interface TransaksiItem {
  layanan: string;
  qty: number;
  hargaSatuan: number;
}

export interface Transaksi {
  noNota: string;
  tanggal: string;
  namaPelanggan: string;
  noHp?: string;
  petugas: string;
  tipe: 'SelfService' | 'FullService';
  total: number;
  status: 'Diterima' | 'Selesai' | 'Batal';
  items: TransaksiItem[];
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
