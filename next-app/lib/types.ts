export type UserRole = 'STAFF' | 'MANAGER' | '';

export type KecepatanLayanan = 'Reguler' | 'Express' | 'Kilat';

export interface LayananBahanBaku {
  idInventory: string;
  qty: number;
  tahap?: string;
}

export interface InventoryItem {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
  stokMinimum?: number;
}

export interface LayananItem {
  layanan: string;
  hargaSatuan: number;
  tipe: 'SelfService' | 'FullService' | '';
  satuan?: string;
  icon?: string;
  kategori?: string;
  kategoriDropOff?: string;
  kategoriWarna?: string;
  kategoriIcon?: string;
  idInventory?: string | null;
  inventoryDeductionQty?: number;
  bahanBakuList?: LayananBahanBaku[];
}

export interface CartItem {
  layanan: string;
  hargaSatuan: number;
  qty: number;
  tipe?: 'SelfService' | 'FullService' | string;
  satuan?: string;
  catatan?: string;
  kategori?: 'Self Service' | 'Drop Off' | 'Add On' | 'Makanan dan Minuman' | string;
  kategoriDropOff?: string;
  idInventory?: string | null;
  inventoryDeductionQty?: number;
  bahanBakuList?: LayananBahanBaku[];
}

export interface TransaksiItem {
  layanan: string;
  qty: number;
  hargaSatuan: number;
  subtotal?: number;
  catatan?: string;
  idInventory?: string | null;
  inventoryDeductionQty?: number;
  bahanBakuList?: LayananBahanBaku[];
}

export interface Transaksi {
  noNota: string;
  tanggal: string;
  namaPelanggan: string;
  noHp?: string;
  isMember?: boolean;
  poinEarned?: number;
  petugas: string;
  tipe?: 'SelfService' | 'FullService' | 'NonLayanan' | string;
  tingkatLayanan?: KecepatanLayanan;
  subtotal?: number;
  diskon?: number;
  diskonKode?: string;
  voucher?: string;
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
  estimasi?: string;
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

export interface ShiftKumulatifData {
  shiftKe: number;
  isGantiShift: boolean;
  modalAwalHariIni: number;
  omzetTunaiHariIni: number;
  omzetMerchantHariIni: number;
  totalBelanjaHariIni: number;
  ekspektasiKasHariIni: number;
  prevShift?: {
    idShift: string;
    namaKasir: string;
    waktuBuka: string;
    waktuTutup: string;
    kasAwal: number;
    kasAkhirFisik: number;
    selisihKas: number;
    modeTutup?: string;
  } | null;
  todayShifts?: Array<{
    idShift: string;
    namaKasir: string;
    waktuBuka: string;
    waktuTutup: string;
    kasAwal: number;
    kasAkhirFisik: number;
    selisihKas: number;
    status: string;
    totalBelanja?: number;
  }>;
}

export interface ShiftKasir {
  idShift: string;
  idOutlet?: string;
  idUser: string;
  namaKasir: string;
  kasAwal: number;
  saldoMerchantAwal?: number;
  kasAkhir?: number;
  saldoMerchantAkhir?: number;
  totalOmzetTunai?: number;
  totalOmzetMerchant?: number;
  selisihKas?: number;
  selisihMerchant?: number;
  status: 'Buka' | 'Tutup' | 'Aktif' | string;
  waktuBuka: string;
  waktuTutup?: string;
  daftarBelanja?: string;
  nominalBelanja?: number;
  fotoNotaBelanja?: string[];
  pendingVoidCount?: number;
  pendingVoidTotal?: number;
  pendingVoidList?: Array<{
    noNota: string;
    namaPelanggan: string;
    nominal: number;
    metodeBayar: string;
    alasan?: string;
  }>;
  kumulatif?: ShiftKumulatifData;
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

export type LoyaltyClaimRule = 'FREE_ON_NTH' | 'FREE_ON_NEXT_TRX';
export type LoyaltyTargetKapasitas = '7kg' | '4kg' | 'all' | 'custom';
export type LoyaltySyaratLayanan = 'washer_dryer' | 'washer_only' | 'all' | 'custom';

export interface LoyaltyProgram {
  id: string; // e.g. 'CARD_7KG_LEGACY', 'CARD_7KG_NEW', 'CARD_4KG'
  nama: string;
  deskripsi?: string;
  kapasitas: LoyaltyTargetKapasitas;
  syaratLayanan: LoyaltySyaratLayanan;
  customLayananKeywords?: string[];
  totalStamps: number; // default 10
  claimRule: LoyaltyClaimRule; // FREE_ON_NTH vs FREE_ON_NEXT_TRX
  rewardDeskripsi: string; // e.g. '1x Cuci Gratis'
  rewardType: 'FREE_SERVICE' | 'DISCOUNT_PERCENT' | 'DISCOUNT_NOMINAL';
  rewardValue?: number; // e.g. 100 for 100% discount
  warnaTema: 'emerald' | 'teal' | 'gold' | 'sapphire' | 'slate';
  isActive: boolean;
  isDefault: boolean; // default untuk registrasi baru
  urutan?: number;
}

export interface Pelanggan {
  idPelanggan: string;
  nama: string;
  noHp: string;
  alamat?: string;
  saldoPoin: number;
  isBlacklist: boolean;
  tanggalDaftar: string;
  assignedCard7kgId?: string;
  assignedCard4kgId?: string;
  rewardReady7kg?: boolean;
  rewardReady4kg?: boolean;
}

export interface AuditLog {
  idLog: string;
  idUser?: string;
  namaUser: string;
  jenisAktivitas: string;
  referensi?: string;
  detail?: string;
  dataSebelum?: string;
  dataSesudah?: string;
  waktu: string;
}

export interface RekapKasShiftItem {
  idShift: string;
  idOutlet?: string;
  namaKasir: string;
  idUser?: string;
  waktuBuka: string;
  waktuTutup?: string;
  kasAwal: number;
  kasAkhirSistem: number;
  kasAkhirFisik: number;
  selisihKas: number;
  status: string;
  modeTutup?: string;
  idPengganti?: string;
  namaPengganti?: string;
  waktuHandover?: string;
  catatan?: string;
  rincianBelanja?: string;
  saldoMerchantAwal?: number;
  saldoMerchantAkhir?: number;
  totalBelanja?: number;
  fotoNota?: string[];
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

export interface DuplicateItemRow {
  rowIndex: number;
  id: string;
  nama: string;
  harga: number;
  satuan: string;
  icon?: string;
  aktif?: string;
  tipe?: string;
  kategori?: string;
  idInventory?: string;
  hargaModal?: number;
  inventoryDeductionQty?: number;
  kategoriDropOff?: string;
  isPrimary?: boolean;
  suggestedCode?: string;
}

export interface DuplicateGroup {
  code: string;
  count: number;
  items: DuplicateItemRow[];
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  totalDuplicateGroups: number;
  totalDuplicateRows: number;
  duplicateGroups: DuplicateGroup[];
}

export interface DuplicateResolutionPayload {
  rowIndex: number;
  originalId: string;
  nama: string;
  action: 'RENAME' | 'AUTO_RECODE' | 'DELETE' | 'MERGE';
  newCode?: string;
  targetId?: string;
}

