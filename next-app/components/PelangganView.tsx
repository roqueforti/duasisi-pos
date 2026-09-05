'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  RefreshCw, 
  Edit3, 
  History, 
  Phone, 
  MapPin, 
  FileText, 
  Calendar, 
  ShoppingBag, 
  TrendingUp, 
  X, 
  CheckCircle2, 
  UserCheck, 
  ChevronRight,
  ShieldAlert,
  Download,
  Upload,
  Plus,
  UserPlus,
  Award,
  User,
  Star,
  Sparkles,
  Package,
  Coins
} from 'lucide-react';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { maskPhone, eNotaUrl, formatFriendlyErrorMessage, formatDateTime } from '@/lib/utils';
import { UserRole, Transaksi, LoyaltyProgram } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import { toCSV, downloadCSV, downloadExcel, readSpreadsheetFile } from '@/lib/csvUtils';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import DigitalMemberCard from '@/components/DigitalMemberCard';
import ImportProgressToast from '@/components/ImportProgressToast';
import { fetchLoyaltyPrograms, getLoyaltyProgramsLocal } from '@/lib/loyaltyUtils';

export interface PelangganItem {
  noHp: string;
  maskedHp: string;
  nama: string;
  alamat?: string;
  tglLahir?: string;
  tglDaftar?: string;
  totalOrder: number;
  totalSpend: number;
  terakhirOrder: string;
  catatan: string;
  isRepeatOrder: boolean;
  saldoPoin: number;
  isMember?: boolean;
  statusMember?: string;
  statusKategori?: 'Member' | 'Pelanggan Lama' | 'Pelanggan Baru';
  stamps75?: number;
  stamps45?: number;
  rewardClaimed75?: number;
  rewardClaimed45?: number;
  assignedCard7kgId?: string;
  assignedCard4kgId?: string;
  rewardReady7kg?: boolean;
  rewardReady4kg?: boolean;
}

export default function PelangganView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert } = useDialog();
  const [pelangganList, setPelangganList] = useState<PelangganItem[]>([]);
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [poinRate, setPoinRate] = useState<number>(10000);
  const [search, setSearch] = useState<string>('');
  const [filterKategori, setFilterKategori] = useState<'Semua' | 'Member' | 'Lama' | 'Baru'>('Semua');
  const [sortBy, setSortBy] = useState<'terakhir' | 'order' | 'spend'>('terakhir');

  // Import CSV Toast Progress State
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importProgressText, setImportProgressText] = useState('');
  const [importProgressPercent, setImportProgressPercent] = useState(0);
  const [importIsComplete, setImportIsComplete] = useState(false);
  const [importIsError, setImportIsError] = useState(false);

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addNama, setAddNama] = useState<string>('');
  const [addNoHp, setAddNoHp] = useState<string>('');
  const [addAlamat, setAddAlamat] = useState<string>('');
  const [addTglLahir, setAddTglLahir] = useState<string>('');
  const [addCatatan, setAddCatatan] = useState<string>('');
  const [addStatusMember, setAddStatusMember] = useState<boolean>(false);
  const [addStamps75, setAddStamps75] = useState<number>(0);
  const [addStamps45, setAddStamps45] = useState<number>(0);
  const [savingAdd, setSavingAdd] = useState<boolean>(false);

  // Detail & Edit Modal State
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedCust, setSelectedCust] = useState<PelangganItem | null>(null);
  const [editNama, setEditNama] = useState<string>('');
  const [editNoHp, setEditNoHp] = useState<string>('');
  const [editAlamat, setEditAlamat] = useState<string>('');
  const [editTglLahir, setEditTglLahir] = useState<string>('');
  const [editCatatan, setEditCatatan] = useState<string>('');
  const [editStatusMember, setEditStatusMember] = useState<boolean>(false);
  const [editStamps75, setEditStamps75] = useState<number>(0);
  const [editStamps45, setEditStamps45] = useState<number>(0);
  const [editAssignedCard7kg, setEditAssignedCard7kg] = useState<string>('CARD_7KG_LEGACY');
  const [editAssignedCard4kg, setEditAssignedCard4kg] = useState<string>('CARD_4KG_STANDARD');
  
  // History list for selected customer
  const [historyList, setHistoryList] = useState<Transaksi[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const loadDataPelanggan = async () => {
    setLoading(true);
    try {
      const [data, conf, progs] = await Promise.all([
        runBackend<PelangganItem[]>('getDaftarPelanggan'),
        runBackend<{ rate: number }>('getPoinConfig').catch(() => ({ rate: 10000 })),
        fetchLoyaltyPrograms().catch(() => getLoyaltyProgramsLocal())
      ]);
      if (Array.isArray(data)) setPelangganList(data);
      if (conf && conf.rate) setPoinRate(conf.rate);
      if (Array.isArray(progs)) setLoyaltyPrograms(progs);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataPelanggan();
  }, []);

  const openDetailModal = async (cust: PelangganItem) => {
    setSelectedCust(cust);
    setEditNama(cust.nama);
    setEditNoHp(cust.noHp);
    setEditAlamat(cust.alamat || '');
    setEditTglLahir(cust.tglLahir || '');
    setEditCatatan(cust.catatan || '');
    setEditStatusMember(cust.isMember || cust.statusMember === 'MEMBER');
    setEditStamps75(cust.stamps75 ?? 0);
    setEditStamps45(cust.stamps45 ?? 0);
    setEditAssignedCard7kg(cust.assignedCard7kgId || 'CARD_7KG_LEGACY');
    setEditAssignedCard4kg(cust.assignedCard4kgId || 'CARD_4KG_STANDARD');
    setShowDetailModal(true);

    // Fetch customer transactions history
    setLoadingHistory(true);
    try {
      const hist = await runBackend<Transaksi[]>('getRiwayatPelangganByHp', cust.noHp);
      if (Array.isArray(hist)) {
        setHistoryList(hist);
      } else {
        setHistoryList([]);
      }
    } catch (err) {
      console.error('Failed to load customer history:', err);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveCustomerEdit = async () => {
    if (!editNama.trim() || !editNoHp.trim()) {
      await showAlert('Nama dan No. HP wajib diisi!', 'warning');
      return;
    }

    if (editStatusMember && (!editAlamat.trim() || !editTglLahir.trim())) {
      await showAlert('Member wajib mengisi Tanggal Lahir (TTL) dan Alamat!', 'warning');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await runBackend<{ success: boolean; message: string }>(
        'updateDataPelanggan',
        selectedCust?.noHp,
        editNoHp.trim(),
        editNama.trim(),
        editAlamat.trim(),
        editCatatan.trim(),
        editStatusMember,
        editTglLahir.trim(),
        editStamps75,
        editStamps45
      );

      if (res && res.success) {
        clearCache('getDaftarPelanggan');
        clearCache('getTransaksiList');
        setSelectedCust(prev => prev ? {
          ...prev,
          nama: editNama.trim(),
          noHp: editNoHp.trim(),
          alamat: editAlamat.trim(),
          tglLahir: editTglLahir.trim(),
          catatan: editCatatan.trim(),
          isMember: editStatusMember,
          statusMember: editStatusMember ? 'MEMBER' : 'UMUM',
          statusKategori: editStatusMember ? 'Member' : (prev.totalOrder > 1 ? 'Pelanggan Lama' : 'Pelanggan Baru'),
          stamps75: editStamps75,
          stamps45: editStamps45,
          assignedCard7kgId: editAssignedCard7kg,
          assignedCard4kgId: editAssignedCard4kg
        } : null);
        runBackend('assignCustomerLoyalty', editNoHp.trim(), '75', editAssignedCard7kg).catch(() => null);
        runBackend('assignCustomerLoyalty', editNoHp.trim(), '45', editAssignedCard4kg).catch(() => null);
        await showAlert('Data pelanggan, stempel & kartu loyalty berhasil disimpan!', 'success');
        loadDataPelanggan();
      } else {
        await showAlert(res?.message || 'Gagal menyimpan perubahan data pelanggan.', 'error');
      }
    } catch (err) {
      console.error(err);
      await showAlert('Terjadi kesalahan jaringan saat menyimpan.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleExportCSV = () => {
    if (pelangganList.length === 0) return;
    const headers = ['No HP', 'Nama', 'Status Member', 'Alamat', 'Tanggal Lahir', 'Total Order', 'Total Belanja (Rp)', 'Saldo Poin', 'Catatan'];
    const rows = pelangganList.map(p => [
      p.noHp,
      p.nama,
      p.isMember ? 'MEMBER' : 'REGULER',
      p.alamat || '',
      p.tglLahir || '',
      p.totalOrder,
      p.totalSpend,
      p.saldoPoin,
      p.catatan || ''
    ]);
    downloadExcel('export_pelanggan.xlsx', headers, rows, 'Pelanggan');
  };

  const handleDownloadTemplate = () => {
    const headers = ['No HP', 'Nama', 'Alamat', 'Tanggal Lahir (YYYY-MM-DD)', 'Catatan'];
    const sampleRows = [
      ['081234567890', 'Budi Santoso', 'Jl. Merdeka No. 1', '1995-08-17', 'Pelanggan Reguler'],
      ['085712345678', 'Siti Rahma', 'Komp. Melati Indah B2', '1998-12-05', 'Member VIP']
    ];
    downloadExcel('template_import_pelanggan.xlsx', headers, sampleRows, 'Template Pelanggan');
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const currentFileName = file.name;
    e.target.value = '';

    try {
      setIsImporting(true);
      setImportFileName(currentFileName);
      setImportProgressPercent(15);
      setImportProgressText('Membaca berkas Excel/CSV pelanggan...');
      setImportIsComplete(false);
      setImportIsError(false);

      const rows = await readSpreadsheetFile(file);
      if (rows.length === 0) {
        setImportIsError(true);
        setImportProgressText('Berkas kosong atau format kolom tidak sesuai.');
        await showAlert('Berkas kosong atau format tidak sesuai.', 'warning');
        setTimeout(() => setIsImporting(false), 3000);
        return;
      }

      setImportProgressPercent(35);
      setImportProgressText(`Memvalidasi ${rows.length} baris pelanggan...`);

      // Payload mapping (robust case-insensitive & key alias)
      const payload = rows.map(r => ({
        hp: String(r['no hp'] || r['nohp'] || r['hp'] || r['telepon'] || r['phone'] || r['nomor hp'] || '').trim(),
        nama: String(r['nama'] || r['nama pelanggan'] || r['customer'] || r['name'] || '').trim(),
        alamat: String(r['alamat'] || r['address'] || r['alamat (opsional)'] || '').trim(),
        tglLahir: String(r['tanggal lahir'] || r['tanggal lahir (yyyy-mm-dd)'] || r['ttl'] || r['tgl lahir'] || r['birthdate'] || '').trim(),
        catatan: String(r['catatan'] || r['notes'] || r['note'] || r['keterangan'] || '').trim()
      })).filter(x => x.hp && x.nama);

      if (payload.length === 0) {
        setImportIsError(true);
        setImportProgressText('Tidak ada data valid (perlu kolom No HP dan Nama).');
        await showAlert('Tidak ada data valid yang bisa diimport. Pastikan ada kolom "No HP" dan "Nama".', 'error');
        setTimeout(() => setIsImporting(false), 3000);
        return;
      }

      setImportProgressPercent(60);
      setImportProgressText(`Menyimpan ${payload.length} pelanggan ke database...`);

      const res = await runBackend<{ success: boolean; added: number; updated: number }>('importPelangganBatch', payload);
      if (res && res.success) {
        setImportProgressPercent(90);
        setImportProgressText('Menyinkronkan daftar pelanggan...');
        clearCache('getDaftarPelanggan');
        await loadDataPelanggan();

        setImportProgressPercent(100);
        setImportIsComplete(true);
        setImportProgressText(`Selesai! Ditambahkan: ${res.added}, Diperbarui: ${res.updated}`);

        setTimeout(() => {
          setIsImporting(false);
        }, 4000);
      } else {
        throw new Error('Gagal mengimport pelanggan dari backend');
      }
    } catch (err: any) {
      console.error(err);
      const friendly = formatFriendlyErrorMessage(err);
      setImportIsError(true);
      setImportProgressText(`Gagal: ${friendly.title}`);
      await showAlert(friendly.detail, 'error', friendly.title, friendly.suggestion);
      setTimeout(() => setIsImporting(false), 4000);
    }
  };

  const handleTambahPelanggan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addNama.trim() || !addNoHp.trim()) {
      await showAlert('Nama dan nomor WhatsApp/HP wajib diisi!', 'warning');
      return;
    }
    if (addStatusMember) {
      if (!addTglLahir.trim()) {
        await showAlert('Tanggal Lahir (TTL) wajib diisi untuk pendaftaran Member!', 'warning');
        return;
      }
      if (!addAlamat.trim()) {
        await showAlert('Alamat tempat tinggal wajib diisi untuk pendaftaran Member!', 'warning');
        return;
      }
    }
    setSavingAdd(true);
    try {
      const res = await runBackend<{ success: boolean; message: string }>('tambahPelanggan', {
        nama: addNama.trim(),
        noHp: addNoHp.trim(),
        alamat: addStatusMember ? addAlamat.trim() : '',
        tglLahir: addStatusMember ? addTglLahir.trim() : '',
        catatan: addCatatan.trim(),
        isMember: addStatusMember,
        stamps75: Number(addStamps75) || 0,
        stamps45: Number(addStamps45) || 0
      });
      if (res && res.success) {
        clearCache('getDaftarPelanggan');
        setShowAddModal(false);
        setAddStamps75(0);
        setAddStamps45(0);
        setAddNama('');
        setAddNoHp('');
        setAddAlamat('');
        setAddTglLahir('');
        setAddCatatan('');
        await loadDataPelanggan();
        await showAlert(res.message || 'Pelanggan berhasil ditambahkan!', 'success');
      } else {
        await showAlert(res?.message || 'Gagal menambahkan pelanggan', 'error');
      }
    } catch (err: any) {
      await showAlert('Terjadi kesalahan: ' + (err.message || String(err)), 'error');
    } finally {
      setSavingAdd(false);
    }
  };

  // Filter & Sort Logic
  const countMember = pelangganList.filter(p => p.isMember || p.statusMember === 'MEMBER').length;
  const countLama = pelangganList.filter(p => !p.isMember && p.statusMember !== 'MEMBER' && p.totalOrder > 1).length;
  const countBaru = pelangganList.filter(p => !p.isMember && p.statusMember !== 'MEMBER' && p.totalOrder <= 1).length;

  const filteredList = pelangganList.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchQuery = !q || (
      item.nama.toLowerCase().includes(q) ||
      item.noHp.includes(q) ||
      (item.alamat && item.alamat.toLowerCase().includes(q))
    );
    if (!matchQuery) return false;

    if (filterKategori === 'Member') return item.isMember || item.statusMember === 'MEMBER';
    if (filterKategori === 'Lama') return !item.isMember && item.statusMember !== 'MEMBER' && item.totalOrder > 1;
    if (filterKategori === 'Baru') return !item.isMember && item.statusMember !== 'MEMBER' && item.totalOrder <= 1;
    return true;
  });

  const sortedList = [...filteredList].sort((a, b) => {
    if (sortBy === 'spend') return b.totalSpend - a.totalSpend;
    if (sortBy === 'order') return b.totalOrder - a.totalOrder;
    // Default: Terakhir Order
    return (b.terakhirOrder || '').localeCompare(a.terakhirOrder || '');
  });

  // Summary Metrics
  const totalPelanggan = pelangganList?.length || 0;
  const totalOmzetPelanggan = pelangganList?.reduce((acc, curr) => acc + (curr.totalSpend || 0), 0) || 0;

  // Render Full-Page Detail Pelanggan View
  if (selectedCust) {
    return (
      <div className="p-3 sm:p-4 md:p-6 space-y-5 max-w-7xl mx-auto text-slate-700 animate-fade-in">
        {/* Top Navigation Bar with Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedCust(null);
                setHistoryList([]);
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              <span>Kembali ke Daftar Pelanggan</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-extrabold text-slate-900 leading-tight">{selectedCust.nama}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                  selectedCust.isMember || selectedCust.statusMember === 'MEMBER'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : selectedCust.totalOrder > 1
                    ? 'bg-teal-100 text-teal-900 border border-teal-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {selectedCust.isMember || selectedCust.statusMember === 'MEMBER' ? 'Member Resmi' : selectedCust.totalOrder > 1 ? 'Pelanggan Lama' : 'Pelanggan Baru'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                No. WhatsApp / HP: <strong className="text-slate-700">{currentRole === 'MANAGER' ? selectedCust.noHp : selectedCust.maskedHp || maskPhone(selectedCust.noHp)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentRole === 'MANAGER' && (
              <button
                type="button"
                onClick={handleSaveCustomerEdit}
                disabled={savingEdit}
                className="px-5 py-2.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {savingEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{savingEdit ? 'Menyimpan...' : 'Simpan Perubahan Data'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary KPI Badges (5 Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">Daftar Pertama</span>
            <span className="text-sm font-bold text-slate-800">{selectedCust.tglDaftar || '-'}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">Status Kategori</span>
            <span className="text-sm font-bold text-slate-800">{selectedCust.statusKategori || 'Pelanggan'}</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">Total Transaksi</span>
            <span className="text-sm font-bold text-[#1E4648]">{selectedCust.totalOrder}x Order</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">Total Belanja (Spend)</span>
            <span className="text-sm font-bold text-slate-900">Rp {(selectedCust.totalSpend || 0).toLocaleString('id-ID')}</span>
          </div>
          <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 shadow-2xs">
            <span className="text-[11px] text-amber-800 block font-medium">Saldo Poin Loyalitas</span>
            <span className="text-sm font-extrabold text-[#FF9500]">{selectedCust.saldoPoin || 0} Poin</span>
          </div>
        </div>

        {/* Main Content: 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-5">
          {/* Left Column (5 Cols): Data Profil & Keanggotaan */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="font-extrabold text-sm text-slate-800 border-b border-slate-100 pb-2.5 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#1E4648]" />
                <span>Informasi Profil Pelanggan</span>
              </h3>

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  readOnly={currentRole !== 'MANAGER'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-[#1E4648] focus:bg-white disabled:opacity-60 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">No. WhatsApp / HP (Unique ID) *</label>
                <input
                  type="tel"
                  value={editNoHp}
                  onChange={(e) => setEditNoHp(e.target.value)}
                  readOnly={currentRole !== 'MANAGER'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-xs outline-none focus:border-[#1E4648] focus:bg-white disabled:opacity-60 transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Status Keanggotaan Member</label>
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-200/60 shrink-0">
                      {editStatusMember ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <User className="w-4 h-4 text-slate-400" />}
                    </span>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">
                        {editStatusMember ? 'Member Resmi Aktif' : 'Pelanggan Reguler / Umum'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {editStatusMember ? 'Mendapat poin reward & benefit promo loyalitas' : 'Pelanggan biasa tanpa poin member'}
                      </div>
                    </div>
                  </div>
                  {currentRole === 'MANAGER' ? (
                    <button
                      type="button"
                      onClick={() => setEditStatusMember(!editStatusMember)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        editStatusMember ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          editStatusMember ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${editStatusMember ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                      {editStatusMember ? 'Member' : 'Umum'}
                    </span>
                  )}
                </div>
              </div>

              {/* Member Exclusive Fields */}
              {editStatusMember && (
                <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
                  <div>
                    <label className="block font-bold text-amber-950 text-xs mb-1">Tanggal Lahir / TTL (Member) *</label>
                    <input
                      type="date"
                      value={editTglLahir}
                      onChange={(e) => setEditTglLahir(e.target.value)}
                      readOnly={currentRole !== 'MANAGER'}
                      className="w-full px-3.5 py-2 bg-white border border-amber-200 rounded-xl font-bold text-xs outline-none focus:border-[#1E4648]"
                    />
                    <p className="text-[10px] text-amber-800/80 mt-1">Digunakan untuk promo reward ulang tahun member.</p>
                  </div>

                  <div>
                    <AddressAutocomplete
                      label="Alamat Tempat Tinggal (Member)"
                      required
                      value={editAlamat}
                      onChange={(addr) => setEditAlamat(addr)}
                      placeholder="Ketik nama jalan / komplek / kos..."
                      readOnly={currentRole !== 'MANAGER'}
                    />
                  </div>
                </div>
              )}

              {!editStatusMember && (
                <div>
                  <AddressAutocomplete
                    label="Alamat (Opsional)"
                    value={editAlamat}
                    onChange={(addr) => setEditAlamat(addr)}
                    placeholder="Ketik nama jalan / komplek / kos..."
                    readOnly={currentRole !== 'MANAGER'}
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1">Catatan Khusus / Preferensi Cuci (Opsional)</label>
                <textarea
                  rows={3}
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Misal: Selalu minta tanpa pewangi, lipat baju rapi"
                  readOnly={currentRole !== 'MANAGER'}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs outline-none focus:border-[#1E4648] focus:bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">Instruksi otomatis yang selalu muncul setiap kali pelanggan ini memesan.</p>
              </div>

              {/* Program Kartu Loyalty Ditugaskan (Multi-Program Assignment) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span className="font-extrabold text-xs text-slate-900">Program Kartu Loyalty Ditugaskan</span>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                    Aturan Klaim
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Program Kartu 7 KG (Sisi Depan)
                    </label>
                    <select
                      value={editAssignedCard7kg}
                      disabled={currentRole !== 'MANAGER'}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setEditAssignedCard7kg(newId);
                        setSelectedCust(prev => prev ? { ...prev, assignedCard7kgId: newId } : null);
                        setPelangganList(prev => prev.map(c => c.noHp === selectedCust?.noHp ? { ...c, assignedCard7kgId: newId } : c));
                        runBackend('assignCustomerLoyalty', selectedCust?.noHp, '75', newId).catch(() => null);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-teal-600 disabled:bg-slate-100"
                    >
                      {loyaltyPrograms.filter(p => p.kapasitas === '7kg' || p.kapasitas === 'all').map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nama} ({p.claimRule === 'FREE_ON_NTH' ? 'Free di Stempel ke-10' : '10 Stamp, ke-11 Free'})
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const curProg = loyaltyPrograms.find(p => p.id === editAssignedCard7kg) || loyaltyPrograms[0];
                      const isNth = curProg?.claimRule === 'FREE_ON_NTH';
                      return (
                        <span className={`text-[10px] font-semibold flex items-center gap-1.5 mt-1 ${isNth ? 'text-teal-700' : 'text-emerald-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isNth ? 'bg-teal-500' : 'bg-emerald-500'}`} />
                          {isNth 
                            ? 'Mode Member Lama: Free langsung di transaksi stempel ke-10.' 
                            : 'Mode Member Baru: 10 stamp penuh dulu, baru transaksi ke-11 free.'}
                        </span>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Program Kartu 4 KG (Sisi Belakang)
                    </label>
                    <select
                      value={editAssignedCard4kg}
                      disabled={currentRole !== 'MANAGER'}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setEditAssignedCard4kg(newId);
                        setSelectedCust(prev => prev ? { ...prev, assignedCard4kgId: newId } : null);
                        setPelangganList(prev => prev.map(c => c.noHp === selectedCust?.noHp ? { ...c, assignedCard4kgId: newId } : c));
                        runBackend('assignCustomerLoyalty', selectedCust?.noHp, '45', newId).catch(() => null);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-teal-600 disabled:bg-slate-100"
                    >
                      {loyaltyPrograms.filter(p => p.kapasitas === '4kg' || p.kapasitas === 'all').map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nama} ({p.claimRule === 'FREE_ON_NTH' ? 'Free di Stempel ke-10' : '10 Stamp, ke-11 Free'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Form Input Stempel Awal / Koreksi Stempel */}
              <div className="p-3.5 bg-gradient-to-br from-teal-50/80 to-emerald-50/50 border border-teal-200/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-teal-700" />
                    <span className="font-extrabold text-xs text-teal-950">Jumlah Stempel Kartu Loyalty</span>
                  </div>
                  <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                    Maks. 10
                  </span>
                </div>
                <p className="text-[10px] text-teal-700 leading-tight">
                  Atur atau sesuaikan stempel awal yang sudah dimiliki pelanggan untuk kedua sisi kartu:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 text-[11px]">Sisi Depan (7 KG)</label>
                      <span className="text-[10px] font-mono font-bold text-teal-700">{editStamps75}/10</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, editStamps75 - 1);
                          setEditStamps75(val);
                          setSelectedCust(prev => prev ? { ...prev, stamps75: val } : null);
                        }}
                        disabled={currentRole !== 'MANAGER' || editStamps75 <= 0}
                        className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={editStamps75}
                        readOnly={currentRole !== 'MANAGER'}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          const val = isNaN(parsed) ? 0 : Math.max(0, Math.min(10, parsed));
                          setEditStamps75(val);
                          setSelectedCust(prev => prev ? { ...prev, stamps75: val } : null);
                        }}
                        className="w-full text-center font-mono font-black text-xs py-1 border border-slate-200 rounded-md outline-none focus:border-teal-600 disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.min(10, editStamps75 + 1);
                          setEditStamps75(val);
                          setSelectedCust(prev => prev ? { ...prev, stamps75: val } : null);
                        }}
                        disabled={currentRole !== 'MANAGER' || editStamps75 >= 10}
                        className="w-7 h-7 rounded-md bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 text-[11px]">Sisi Belakang (4 KG)</label>
                      <span className="text-[10px] font-mono font-bold text-teal-700">{editStamps45}/10</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(0, editStamps45 - 1);
                          setEditStamps45(val);
                          setSelectedCust(prev => prev ? { ...prev, stamps45: val } : null);
                        }}
                        disabled={currentRole !== 'MANAGER' || editStamps45 <= 0}
                        className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={editStamps45}
                        readOnly={currentRole !== 'MANAGER'}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          const val = isNaN(parsed) ? 0 : Math.max(0, Math.min(10, parsed));
                          setEditStamps45(val);
                          setSelectedCust(prev => prev ? { ...prev, stamps45: val } : null);
                        }}
                        className="w-full text-center font-mono font-black text-xs py-1 border border-slate-200 rounded-md outline-none focus:border-teal-600 disabled:bg-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.min(10, editStamps45 + 1);
                          setEditStamps45(val);
                          setSelectedCust(prev => prev ? { ...prev, stamps45: val } : null);
                        }}
                        disabled={currentRole !== 'MANAGER' || editStamps45 >= 10}
                        className="w-7 h-7 rounded-md bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Digital Member Card */}
          <div className="md:col-span-7 space-y-4">
            <DigitalMemberCard
              customer={selectedCust}
              canEdit={true}
              onUpdateStamps={async (type, newCount) => {
                const key = type === '75' ? 'stamps75' : 'stamps45';
                if (type === '75') setEditStamps75(newCount);
                else setEditStamps45(newCount);
                setSelectedCust(prev => prev ? { ...prev, [key]: newCount } : null);
                setPelangganList(prevList => 
                  prevList.map(item => 
                    item.noHp === selectedCust.noHp 
                      ? { ...item, [key]: newCount }
                      : item
                  )
                );
                try {
                  await runBackend('updateStempelPelanggan', selectedCust.noHp, type, newCount);
                  clearCache('getDaftarPelanggan');
                } catch (err) {
                  console.error('Failed to sync stamps to backend:', err);
                }
              }}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FULL-WIDTH BOTTOM SECTION: RIWAYAT TRANSAKSI PELANGGAN (TABEL LENGKAP)    */}
        {/* ========================================================================= */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-[#1E4648]" />
              <span>Riwayat Transaksi Pelanggan</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-teal-50 text-teal-800 border border-teal-200">
                {historyList.length} Transaksi
              </span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Semua riwayat pesanan cuci &amp; transaksi yang tercatat atas nama pelanggan ini
            </span>
          </div>

          {loadingHistory ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#1E4648]" />
              <span className="text-xs font-semibold">Memuat riwayat transaksi pelanggan...</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-1.5">
              <ShoppingBag className="w-8 h-8 text-slate-300" />
              <span className="text-xs font-bold text-slate-600">Belum ada riwayat transaksi</span>
              <span className="text-[11px] text-slate-400">Transaksi baru atas nama pelanggan ini akan otomatis tercatat di sini.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <th className="py-3 px-4">No. Nota</th>
                    <th className="py-3 px-4">Tanggal &amp; Waktu</th>
                    <th className="py-3 px-4">Tipe Layanan</th>
                    <th className="py-3 px-4">Status Pengerjaan</th>
                    <th className="py-3 px-4 text-right">Total Bayar</th>
                    <th className="py-3 px-4 text-center">Aksi / E-Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {historyList.map((tx, idx) => {
                    const statusName = (tx as any).status || 'Selesai';
                    const isCompleted = statusName.toLowerCase().includes('selesai') || statusName.toLowerCase().includes('diambil');
                    const isProgress = statusName.toLowerCase().includes('proses') || statusName.toLowerCase().includes('cuci') || statusName.toLowerCase().includes('kering') || statusName.toLowerCase().includes('setrika');

                    return (
                      <tr key={idx} className="hover:bg-teal-50/30 transition-colors">
                        {/* No. Nota */}
                        <td className="py-3 px-4 font-mono font-black text-slate-900 text-xs">
                          {tx.noNota}
                        </td>

                        {/* Tanggal & Waktu */}
                        <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {formatDateTime((tx as any).waktuTransaksi || tx.tanggal)}
                        </td>

                        {/* Tipe Layanan */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black ${
                            tx.tipe === 'FullService' 
                              ? 'bg-teal-50 text-teal-800 border border-teal-200' 
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {tx.tipe === 'FullService' ? (
                              <>
                                <Package className="w-3 h-3 text-teal-700" />
                                Drop Off
                              </>
                            ) : (
                              <>
                                <Coins className="w-3 h-3 text-slate-600" />
                                Self Service
                              </>
                            )}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isProgress
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {statusName}
                          </span>
                        </td>

                        {/* Total Bayar */}
                        <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                          Rp {((tx as any).totalBayar || tx.total || 0).toLocaleString('id-ID')}
                        </td>

                        {/* E-Nota Link Button */}
                        <td className="py-3 px-4 text-center">
                          <a
                            href={eNotaUrl(tx.noNota, (tx as any).token)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition shadow-2xs"
                          >
                            <span>Lihat E-Nota</span>
                            <span className="text-xs">↗</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto text-slate-600">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-lg border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1E4648] text-white flex items-center justify-center shadow-md">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-700 leading-tight">Data Pelanggan & Keanggotaan</h1>
            <p className="text-xs text-slate-500 font-medium">Kelola basis data Pelanggan Baru, Pelanggan Lama, & Member Terdaftar</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => {
              setAddNama('');
              setAddNoHp('');
              setAddAlamat('');
              setAddTglLahir('');
              setAddCatatan('');
              setAddStatusMember(false);
              setShowAddModal(true);
            }}
            className="px-3.5 py-2 bg-[#1E4648] hover:bg-[#163436] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah Pelanggan</span>
          </button>

          {currentRole === 'MANAGER' && (
            <>
              <button 
                onClick={handleDownloadTemplate} 
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer" 
                title="Download Template Excel (.xlsx) Pelanggan"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Template Excel</span>
              </button>
              <button 
                onClick={handleExportCSV} 
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer" 
                title="Export Data Pelanggan ke Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export</span>
              </button>
              <label 
                className="cursor-pointer px-3 py-2 bg-slate-100 hover:bg-[#1E4648] hover:text-white text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5" 
                title="Import Pelanggan dari Berkas Excel (.xlsx, .xls) atau CSV"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
                <span>Import</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportCSV} />
              </label>
            </>
          )}
          <button
            onClick={loadDataPelanggan}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div 
          onClick={() => setFilterKategori('Semua')}
          className={`bg-white p-3.5 rounded-xl border cursor-pointer transition shadow-2xs ${filterKategori === 'Semua' ? 'border-[#1E4648] ring-1 ring-[#1E4648]' : 'border-slate-200/80 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Pelanggan</div>
          <div className="text-xl font-black text-slate-800 mt-0.5">{(totalPelanggan || 0).toLocaleString('id-ID')}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Seluruh database</div>
        </div>

        <div 
          onClick={() => setFilterKategori('Member')}
          className={`bg-white p-3.5 rounded-xl border cursor-pointer transition shadow-2xs ${filterKategori === 'Member' ? 'border-amber-500 ring-1 ring-amber-500 bg-amber-50/20' : 'border-slate-200/80 hover:border-amber-300'}`}
        >
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <span>⭐ Member</span>
          </div>
          <div className="text-xl font-black text-amber-900 mt-0.5">{(countMember || 0).toLocaleString('id-ID')}</div>
          <div className="text-[10px] text-amber-700/80 mt-0.5">Terdaftar resmi</div>
        </div>

        <div 
          onClick={() => setFilterKategori('Lama')}
          className={`bg-white p-3.5 rounded-xl border cursor-pointer transition shadow-2xs ${filterKategori === 'Lama' ? 'border-teal-600 ring-1 ring-teal-600 bg-teal-50/20' : 'border-slate-200/80 hover:border-teal-300'}`}
        >
          <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-teal-600" />
            <span>Pelanggan Lama</span>
          </div>
          <div className="text-xl font-black text-teal-950 mt-0.5">{(countLama || 0).toLocaleString('id-ID')}</div>
          <div className="text-[10px] text-teal-700 mt-0.5">&gt; 1x Transaksi (Umum)</div>
        </div>

        <div 
          onClick={() => setFilterKategori('Baru')}
          className={`bg-white p-3.5 rounded-xl border cursor-pointer transition shadow-2xs ${filterKategori === 'Baru' ? 'border-slate-700 ring-1 ring-slate-700 bg-slate-50' : 'border-slate-200/80 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Pelanggan Baru</span>
          </div>
          <div className="text-xl font-black text-slate-800 mt-0.5">{(countBaru || 0).toLocaleString('id-ID')}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">1x Transaksi / Baru</div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Filter Tabs & Search Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(['Semua', 'Member', 'Lama', 'Baru'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilterKategori(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                  filterKategori === k
                    ? 'bg-[#1E4648] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {k === 'Semua' ? (
                    'Semua Pelanggan'
                  ) : k === 'Member' ? (
                    <>
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Member
                    </>
                  ) : k === 'Lama' ? (
                    <>
                      <History className="w-3.5 h-3.5 text-teal-600" /> Pelanggan Lama
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Pelanggan Baru
                    </>
                  )}
                </span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filterKategori === k ? 'bg-teal-900/50 text-teal-100' : 'bg-slate-200 text-slate-600'}`}>
                  {k === 'Semua' ? totalPelanggan : k === 'Member' ? countMember : k === 'Lama' ? countLama : countBaru}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / HP..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648]"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0 text-xs font-bold">
              <button
                onClick={() => setSortBy('terakhir')}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition ${
                  sortBy === 'terakhir' ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Urutkan Terbaru Order"
              >
                Terbaru
              </button>
              <button
                onClick={() => setSortBy('order')}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition ${
                  sortBy === 'order' ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Urutkan Paling Sering"
              >
                Frekuensi
              </button>
              <button
                onClick={() => setSortBy('spend')}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] transition ${
                  sortBy === 'spend' ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Urutkan Belanja Tertinggi"
              >
                Nominal
              </button>
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">No. HP</th>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4">Status / Keanggotaan</th>
                <th className="py-3 px-4 text-center">Total Order</th>
                <th className="py-3 px-4 text-right">Total Belanja</th>
                <th className="py-3 px-4 text-center">Saldo Poin</th>
                <th className="py-3 px-4">Terakhir Order</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-36" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-12 mx-auto" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-20 ml-auto" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-12 mx-auto" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : sortedList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada data pelanggan yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                sortedList.map((item) => {
                  const isMem = item.isMember || item.statusMember === 'MEMBER';
                  return (
                    <tr key={item.noHp} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {item.noHp ? maskPhone(item.noHp) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{item.nama}</div>
                        {item.alamat && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.alamat}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isMem ? (
                          <span className="px-2 py-0.5 bg-amber-500/15 text-amber-900 border border-amber-400/40 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Member
                          </span>
                        ) : item.totalOrder > 1 ? (
                          <span className="px-2 py-0.5 bg-teal-500/15 text-teal-900 border border-teal-400/40 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <History className="w-3 h-3 text-teal-700" /> Pelanggan Lama
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[10px] font-semibold inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-blue-500" /> Pelanggan Baru
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-bold font-mono">
                          {item.totalOrder}x
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#1E4648] font-mono">
                        Rp {(item?.totalSpend || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-[#FF9500] font-mono">⭐ {item.saldoPoin || 0}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {item.terakhirOrder || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openDetailModal(item)}
                          className="px-2.5 py-1 bg-[#1E4648]/10 hover:bg-[#1E4648] text-[#1E4648] hover:text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>



      {/* Modal Tambah Pelanggan Baru */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1E4648] text-white flex items-center justify-center shadow-xs">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                    Tambah {addStatusMember ? 'Member Resmi Baru' : 'Pelanggan Umum Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {addStatusMember ? 'Pendaftaran member lengkap dengan TTL & Alamat' : 'Pendaftaran cepat pelanggan umum (Nama & No. HP)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleTambahPelanggan} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap {addStatusMember ? 'Member' : 'Pelanggan'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addNama}
                  onChange={(e) => setAddNama(e.target.value)}
                  placeholder={addStatusMember ? 'Contoh: Budi Santoso (Member)' : 'Contoh: Budi Santoso'}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nomor WhatsApp / HP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={addNoHp}
                  onChange={(e) => setAddNoHp(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Format: 08xxxxxxxx (minimal 8 digit). Digunakan untuk resi E-Struk & notifikasi WhatsApp.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipe Pelanggan</label>
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-200/60 shrink-0">
                      {addStatusMember ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <User className="w-4 h-4 text-slate-400" />}
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-800">
                        {addStatusMember ? 'Daftarkan sebagai Member Resmi' : 'Pelanggan Reguler / Umum'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {addStatusMember ? 'Wajib mengisi TTL & Alamat untuk benefit loyalitas' : 'Cukup Nama & No. WhatsApp'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAddStatusMember(!addStatusMember)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      addStatusMember ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        addStatusMember ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Khusus Member: Tanggal Lahir (TTL) & Alamat Wajib */}
              {addStatusMember ? (
                <div className="space-y-3 pt-2 border-t border-amber-200 bg-amber-50/40 p-3 rounded-xl border">
                  <div>
                    <label className="block font-bold text-amber-950 mb-1">
                      Tanggal Lahir (TTL) Member <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={addTglLahir}
                      onChange={(e) => setAddTglLahir(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg font-semibold text-slate-800 outline-none focus:border-[#1E4648]"
                    />
                    <p className="text-[10px] text-amber-800/80 mt-1">Digunakan untuk reward promo & diskon hari ulang tahun member.</p>
                  </div>

                  <div>
                    <AddressAutocomplete
                      label="Alamat Tempat Tinggal Member"
                      required
                      value={addAlamat}
                      onChange={(addr) => setAddAlamat(addr)}
                      placeholder="Ketik nama jalan / komplek / kos..."
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                    <textarea
                      rows={2}
                      value={addCatatan}
                      onChange={(e) => setAddCatatan(e.target.value)}
                      placeholder="Catatan khusus, preferensi pewangi, alergi kain, dll."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-[#1E4648]"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-xl text-teal-800 text-[11px] flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>Pelanggan umum hanya memerlukan <strong>Nama</strong> dan <strong>Nomor WhatsApp</strong>.</span>
                </div>
              )}

              {/* Fitur Input Stempel Awal (Loyalty Card) */}
              <div className="p-3.5 bg-gradient-to-br from-teal-50/80 to-emerald-50/50 border border-teal-200/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-teal-700" />
                    <span className="font-extrabold text-xs text-teal-950">Input Stempel Awal (Loyalty Card)</span>
                  </div>
                  <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                    Opsional (Maks. 10)
                  </span>
                </div>
                <p className="text-[10px] text-teal-700 leading-tight">
                  Masukkan jumlah stempel fisik/sebelumnya yang sudah dimiliki pelanggan untuk kedua sisi kartu loyalty:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 text-[11px]">Sisi Depan (7 KG)</label>
                      <span className="text-[10px] font-mono font-bold text-teal-700">{addStamps75}/10</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddStamps75(prev => Math.max(0, prev - 1))}
                        disabled={addStamps75 <= 0}
                        className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={addStamps75}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          setAddStamps75(isNaN(parsed) ? 0 : Math.max(0, Math.min(10, parsed)));
                        }}
                        className="w-full text-center font-mono font-black text-xs py-1 border border-slate-200 rounded-md outline-none focus:border-teal-600"
                      />
                      <button
                        type="button"
                        onClick={() => setAddStamps75(prev => Math.min(10, prev + 1))}
                        disabled={addStamps75 >= 10}
                        className="w-7 h-7 rounded-md bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 text-[11px]">Sisi Belakang (4 KG)</label>
                      <span className="text-[10px] font-mono font-bold text-teal-700">{addStamps45}/10</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddStamps45(prev => Math.max(0, prev - 1))}
                        disabled={addStamps45 <= 0}
                        className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={addStamps45}
                        onChange={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          setAddStamps45(isNaN(parsed) ? 0 : Math.max(0, Math.min(10, parsed)));
                        }}
                        className="w-full text-center font-mono font-black text-xs py-1 border border-slate-200 rounded-md outline-none focus:border-teal-600"
                      />
                      <button
                        type="button"
                        onClick={() => setAddStamps45(prev => Math.min(10, prev + 1))}
                        disabled={addStamps45 >= 10}
                        className="w-7 h-7 rounded-md bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center justify-center transition cursor-pointer disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex gap-2.5 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingAdd ? 'Menyimpan...' : (addStatusMember ? 'Simpan Member Baru' : 'Simpan Pelanggan Umum')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Drive Style Floating Progress Bar (Pojok Kanan Bawah) */}
      <ImportProgressToast
        isOpen={isImporting}
        title="Mengimpor Data Pelanggan"
        fileName={importFileName || 'pelanggan.csv'}
        statusText={importProgressText}
        progressPercent={importProgressPercent}
        isComplete={importIsComplete}
        isError={importIsError}
        onClose={() => setIsImporting(false)}
      />
    </div>
  );
}
