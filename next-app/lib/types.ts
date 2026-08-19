export type UserRole = 'STAFF' | 'MANAGER' | '';

export type KecepatanLayanan = 'Reguler' | 'Express' | 'Kilat';

export interface LayananItem {
  layanan: string;
  hargaSatuan: number;
  tipe: 'SelfService' | 'FullService' | '';
  satuan?: string;
  icon?: string;
  kategori?: string;
  kategoriWarna?: string;
  kategoriIcon?: string;
  idInventory?: string | null;
  inventoryDeductionQty?: number;
}

export interface CartItem {
  layanan: string;
  hargaSatuan: number;
  qty: number;
  tipe?: 'SelfService' | 'FullService' | string;
  satuan?: string;
  catatan?: string;
  kategori?: 'Self Service' | 'Drop Off' | 'Add On' | 'Makanan dan Minuman' | string;
  idInventory?: string | null;
  inventoryDeductionQty?: number;
}

export interface TransaksiItem {
  layanan: string;
  qty: number;
  hargaSatuan: number;
  subtotal?: number;
  catatan?: string;
  idInventory?: string | null;
  inventoryDeductionQty?: number;
}

export interface Transaksi {
  noNota: string;
  tanggal: string;
  namaPelanggan: string;
  noHp?: string;
  petugas: string;
  tipe?: 'SelfService' | 'FullService' | 'NonLayanan' | string;
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
  pipeline?: PipelineStep[];
}

export interface PipelineStep {
  id: string;
  noNota: string;
  step: number;
  namaStep: string;
  status: 'Pending' | 'Aktif' | 'Selesai';
  assignedStaff?: string;
  mesinId?: string;
  washerId?: string;
  dryerId?: string;
  waktuMulai?: string;
  waktuSelesai?: string;
  catatan?: string;
}

export interface ShiftKasir {
  idShift: string;
  idOutlet?: string;
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
  id?: string;
  nama: string;
  jabatan: string;
  noHp?: string;
  status?: string;
  role?: 'STAFF' | 'MANAGER';
}

export interface PegawaiDetail {
  id: string;
  nama: string;
  noHp?: string;
  jabatan: string;
  status: string;
  tanggalBergabung?: string;
  
  // Data Pribadi
  nik?: string;
  namaPanggilan?: string;
  foto?: string;
  jenisKelamin?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  alamat?: string;

  // Pendidikan
  pendidikanJenjang?: string;
  pendidikanInstitusi?: string;
  pendidikanJurusan?: string;
  pendidikanTahunMasuk?: string;
  pendidikanTahunLulus?: string;
  pendidikanStatus?: string;

  // Pekerjaan
  statusKepegawaian?: string;
  tanggalMasuk?: string;
  tanggalKeluar?: string;
  shiftUtama?: string;

  // Penggajian
  gajiPokok?: number;
  tunjangan?: number;
  potongan?: number;
  bank?: string;
  noRekening?: string;
  namaRekening?: string;

  // Kontak Darurat
  kontakDaruratNama?: string;
  kontakDaruratHubungan?: string;
  kontakDaruratNoHp?: string;
}

export interface AbsensiConfig {
  jamBuka: string;
  toleransiTelatMenit: number;
  aktifDenda: boolean;
  tipeDenda: 'MENIT' | 'JAM' | 'FLAT';
  tarifDenda: number;
  tunjanganKehadiranPerHari: number;
  insentifDropOffPerTahap: number;
  aktifIpWhitelist?: boolean;
  ipWhitelist?: string;
  aktifGeofence?: boolean;
  outletLatitude?: number;
  outletLongitude?: number;
  geofenceRadiusMeter?: number;
}

export interface JadwalKerjaItem {
  id: string;
  idPegawai: string;
  namaPegawai: string;
  tanggal: string; // YYYY-MM-DD
  hari: string;
  shift: string;
  status: 'Masuk' | 'Libur' | 'Cuti' | 'Tukar Shift';
  catatan?: string;
}

export interface CutiItem {
  id: string;
  idPegawai: string;
  namaPegawai: string;
  jenisCuti: 'Cuti Tahunan' | 'Sakit' | 'Izin Khusus' | 'Cuti Menikah' | 'Cuti Melahirkan' | string;
  tglMulai: string;
  tglSelesai: string;
  jumlahHari: number;
  alasan: string;
  status: 'Disetujui' | 'Pending' | 'Ditolak';
  waktuPengajuan?: string;
}

export interface HariLiburItem {
  id: string;
  tanggal: string;
  namaLibur: string;
  kategori: 'Libur Nasional' | 'Libur Outlet';
  keterangan?: string;
}

export interface PayrollItem {
  idPegawai: string;
  nama: string;
  namaPanggilan?: string;
  jabatan: string;
  statusPegawai: string;
  statusKepegawaian?: string;
  bank?: string;
  noRekening?: string;
  namaRekening?: string;
  noHp?: string;

  periode: string; // "YYYY-MM"
  gajiPokok: number;
  tunjangan: number;
  tunjanganKehadiran?: number;
  bonusKomisi: number;
  insentifDropOff?: number;
  totalTahapDropOff?: number;
  dropoffBreakdown?: Record<string, number>;
  potongan: number;
  potonganRutin?: number;
  dendaTelat?: number;
  totalGajiBersih: number;

  jumlahHadir: number;
  totalJamKerja: number;
  jumlahTelat: number;
  totalOmzetDihasilkan?: number;
  totalTransaksiDihasilkan?: number;

  statusPembayaran: 'Belum Dibayar' | 'Sudah Dibayar';
  tanggalPembayaran?: string;
  metodePembayaran?: string;
  catatan?: string;
}

export interface PayrollSummary {
  periode: string;
  totalGajiPokok: number;
  totalTunjangan: number;
  totalBonus: number;
  totalPotongan: number;
  totalPengeluaranGaji: number;
  totalPegawai: number;
  sudahDibayarCount: number;
  belumDibayarCount: number;
  allDropoffSteps?: string[];
  items: PayrollItem[];
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

