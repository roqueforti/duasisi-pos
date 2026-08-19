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
  UserPlus
} from 'lucide-react';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { maskPhone } from '@/lib/utils';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import { toCSV, downloadCSV, parseCSV, readFileAsText } from '@/lib/csvUtils';

export interface PelangganItem {
  noHp: string;
  maskedHp: string;
  nama: string;
  alamat?: string;
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
}

import { Transaksi } from '@/lib/types';

export default function PelangganView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert } = useDialog();
  const [pelangganList, setPelangganList] = useState<PelangganItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [poinRate, setPoinRate] = useState<number>(10000);
  const [search, setSearch] = useState<string>('');
  const [filterKategori, setFilterKategori] = useState<'Semua' | 'Member' | 'Lama' | 'Baru'>('Semua');
  const [sortBy, setSortBy] = useState<'terakhir' | 'order' | 'spend'>('terakhir');

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addNama, setAddNama] = useState<string>('');
  const [addNoHp, setAddNoHp] = useState<string>('');
  const [addAlamat, setAddAlamat] = useState<string>('');
  const [addCatatan, setAddCatatan] = useState<string>('');
  const [addStatusMember, setAddStatusMember] = useState<boolean>(false);
  const [savingAdd, setSavingAdd] = useState<boolean>(false);

  // Detail & Edit Modal State
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedCust, setSelectedCust] = useState<PelangganItem | null>(null);
  const [editNama, setEditNama] = useState<string>('');
  const [editNoHp, setEditNoHp] = useState<string>('');
  const [editAlamat, setEditAlamat] = useState<string>('');
  const [editCatatan, setEditCatatan] = useState<string>('');
  const [editStatusMember, setEditStatusMember] = useState<boolean>(false);
  
  // History list for selected customer
  const [historyList, setHistoryList] = useState<Transaksi[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const loadDataPelanggan = async () => {
    setLoading(true);
    try {
      const data = await runBackend<PelangganItem[]>('getDaftarPelanggan');
      if (Array.isArray(data)) setPelangganList(data);
      
      const conf = await runBackend<{ rate: number }>('getPoinConfig');
      if (conf && conf.rate) setPoinRate(conf.rate);
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
    setEditCatatan(cust.catatan || '');
    setEditStatusMember(cust.isMember || cust.statusMember === 'MEMBER');
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

    setSavingEdit(true);
    try {
      const res = await runBackend<{ success: boolean; message: string }>(
        'updateDataPelanggan',
        selectedCust?.noHp,
        editNoHp.trim(),
        editNama.trim(),
        editAlamat.trim(),
        editCatatan.trim(),
        editStatusMember
      );

      if (res && res.success) {
        clearCache('getDaftarPelanggan');
        clearCache('getTransaksiList');
        await showAlert('Data pelanggan berhasil disimpan!', 'success');
        setShowDetailModal(false);
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
    const rows = pelangganList.map(p => [
      p.noHp,
      p.nama,
      p.alamat || '',
      p.totalOrder.toString(),
      p.totalSpend.toString(),
      p.saldoPoin.toString(),
      p.catatan || ''
    ]);
    downloadCSV('export_pelanggan.csv', toCSV(['No HP', 'Nama', 'Alamat', 'Total Order', 'Total Belanja', 'Saldo Poin', 'Catatan'], rows));
  };

  const handleDownloadTemplate = () => {
    downloadCSV('template_pelanggan_kosong.csv', toCSV(['No HP', 'Nama', 'Alamat (Opsional)'], [['081234567890', 'Budi Santoso', 'Jl. Merdeka No. 1']]));
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset

    try {
      setLoading(true);
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) { await showAlert('File CSV kosong atau format salah.', 'warning'); return; }

      const payload = rows.map(r => ({
        hp: r['No HP'] || r['no hp'] || r['hp'] || '',
        nama: r['Nama'] || r['nama'] || r['Nama Pelanggan'] || ''
      })).filter(r => r.hp && r.nama);

      if (payload.length === 0) {
        await showAlert('Format kolom tidak sesuai. Pastikan ada kolom "No HP" dan "Nama".', 'error');
        return;
      }

      const res = await runBackend<{success: boolean, added?: number, updated?: number, msg?: string}>('importPelangganBatch', payload);
      if (res && res.success) {
        await showAlert(`Import berhasil! ${res.added} pelanggan baru ditambahkan, ${res.updated} data diperbarui.`, 'success');
        loadDataPelanggan();
      } else {
        await showAlert(res?.msg || 'Gagal melakukan import data', 'error');
      }
    } catch (err) {
      console.error(err);
      await showAlert('Terjadi kesalahan saat memproses CSV.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTambahPelanggan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addNama.trim() || !addNoHp.trim()) {
      await showAlert('Nama dan nomor WhatsApp/HP wajib diisi!', 'warning');
      return;
    }
    setSavingAdd(true);
    try {
      const res = await runBackend<{ success: boolean; message: string }>('tambahPelanggan', {
        nama: addNama.trim(),
        noHp: addNoHp.trim(),
        alamat: addAlamat.trim(),
        catatan: addCatatan.trim(),
        isMember: addStatusMember
      });
      if (res && res.success) {
        clearCache('getDaftarPelanggan');
        setShowAddModal(false);
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
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5" 
                title="Download Template CSV Pelanggan"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Template</span>
              </button>
              <button 
                onClick={handleExportCSV} 
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5" 
                title="Export Data ke CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export</span>
              </button>
              <label 
                className="cursor-pointer px-3 py-2 bg-slate-100 hover:bg-[#1E4648] hover:text-white text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5" 
                title="Import Pelanggan dari File CSV"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
                <span>Import</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
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
          <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
            <span>🔁 Pelanggan Lama</span>
          </div>
          <div className="text-xl font-black text-teal-950 mt-0.5">{(countLama || 0).toLocaleString('id-ID')}</div>
          <div className="text-[10px] text-teal-700 mt-0.5">&gt; 1x Transaksi (Umum)</div>
        </div>

        <div 
          onClick={() => setFilterKategori('Baru')}
          className={`bg-white p-3.5 rounded-xl border cursor-pointer transition shadow-2xs ${filterKategori === 'Baru' ? 'border-slate-700 ring-1 ring-slate-700 bg-slate-50' : 'border-slate-200/80 hover:border-slate-300'}`}
        >
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <span>✨ Pelanggan Baru</span>
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
                <span>{k === 'Semua' ? 'Semua Pelanggan' : k === 'Member' ? '⭐ Member' : k === 'Lama' ? '🔁 Pelanggan Lama' : '✨ Pelanggan Baru'}</span>
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
                            ⭐ Member
                          </span>
                        ) : item.totalOrder > 1 ? (
                          <span className="px-2 py-0.5 bg-teal-500/15 text-teal-900 border border-teal-400/40 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            🔁 Pelanggan Lama
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full text-[10px] font-semibold inline-flex items-center gap-1">
                            ✨ Pelanggan Baru
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
                          className="px-2.5 py-1 bg-[#1E4648]/10 hover:bg-[#1E4648] text-[#1E4648] hover:text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1"
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

      {/* Modal Detail & Edit Pelanggan + Riwayat Transaksi */}
      {showDetailModal && selectedCust && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 sm:p-6 w-full max-w-2xl border border-slate-100 shadow-lg my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#B5C9C9]/20 text-[#1E4648] flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-700">{currentRole === 'MANAGER' ? 'Detail & Edit Data Pelanggan' : 'Detail Data Pelanggan'}</h3>
                  <p className="text-[11px] text-slate-500 font-medium">No. HP: {maskPhone(selectedCust.noHp)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 text-xs space-y-4">
              {/* Form Input Section */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="font-bold text-slate-600 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[#1E4648]" />
                  <span>Informasi Data Pelanggan</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Pelanggan *</label>
                    <input
                      type="text"
                      value={editNama}
                      onChange={(e) => setEditNama(e.target.value)}
                      readOnly={currentRole !== 'MANAGER'}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-semibold outline-none focus:border-[#1E4648]"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Sesuai nama KTP atau nama panggilan akrab.</p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">No. HP / WhatsApp (Unique Key) *</label>
                    <input
                      type="tel"
                      value={editNoHp}
                      onChange={(e) => setEditNoHp(e.target.value)}
                      placeholder="08..."
                      readOnly={currentRole !== 'MANAGER'}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono font-bold outline-none focus:border-[#1E4648]"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Format: 08xxxxxxxx. Digunakan untuk kirim resi E-Struk via WhatsApp.</p>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Keanggotaan Member</label>
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⭐</span>
                      <div>
                        <div className="font-bold text-xs text-slate-800">
                          {editStatusMember ? 'Member Resmi Aktif' : 'Pelanggan Reguler / Umum'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {editStatusMember ? 'Mendapat benefit loyalitas dan prioritas promo member' : 'Pelanggan biasa tanpa kartu member'}
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${editStatusMember ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                        {editStatusMember ? 'Member' : 'Umum'}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alamat Pelanggan</label>
                  <input
                    type="text"
                    value={editAlamat}
                    onChange={(e) => setEditAlamat(e.target.value)}
                    placeholder="Alamat rumah / outlet jemput"
                    readOnly={currentRole !== 'MANAGER'}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-semibold outline-none focus:border-[#1E4648]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Diperlukan terutama jika sering memesan layanan Delivery/Jemput Antar.</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan Khusus / Preferensi Cuci (Opsional)</label>
                  <textarea
                    rows={2}
                    value={editCatatan}
                    onChange={(e) => setEditCatatan(e.target.value)}
                    placeholder="Misal: Selalu minta tanpa pewangi, lipat baju rapi"
                    readOnly={currentRole !== 'MANAGER'}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-medium outline-none focus:border-[#1E4648]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Instruksi otomatis yang selalu muncul setiap kali pelanggan ini memesan.</p>
                </div>
              </div>

              {/* Readonly Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[11px]">
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Daftar Pertama:</span>
                  <span className="font-bold text-slate-600">{selectedCust.tglDaftar || '-'}</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Total Order:</span>
                  <span className="font-bold text-slate-600">{selectedCust.totalOrder} Transaksi</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Total Belanja:</span>
                  <span className="font-bold text-[#1E4648]">Rp {(selectedCust?.totalSpend || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Saldo Poin:</span>
                  <span className="font-bold text-[#FF9500]">{selectedCust?.saldoPoin || 0} Poin</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Terakhir Order:</span>
                  <span className="font-bold text-slate-600">{selectedCust.terakhirOrder || '-'}</span>
                </div>
              </div>

              {/* Transaction History Section */}
              <div className="space-y-2">
                <div className="font-bold text-slate-600 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#1E4648]" />
                    <span>Riwayat Transaksi Pelanggan Ini</span>
                  </span>
                  <span className="text-slate-400 font-normal text-[10px]">({historyList.length} Order)</span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {loadingHistory ? (
                    <div className="py-6 text-center text-slate-400 font-medium">Memuat riwayat transaksi...</div>
                  ) : historyList.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 font-medium">Belum ada riwayat transaksi terhitung</div>
                  ) : (
                    historyList.map((tx) => (
                      <div key={tx.noNota} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 text-[11px]">
                        <div className="flex justify-between items-center font-bold text-slate-700">
                          <span className="font-mono text-[#1E4648]">{tx.noNota}</span>
                          <div className="flex flex-col items-end">
                            <span>Rp {(tx?.total || 0).toLocaleString('id-ID')}</span>
                            <span className="text-[#FF9500] text-[9px]">+ {Math.floor((tx?.total || 0) / poinRate)} Poin</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 text-[10px]">
                          <span>{tx.tanggal}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                            tx.status === 'Selesai' ? 'bg-[#B5C9C9]/20 text-[#1E4648]' : 'bg-[#FF9500]/10 text-[#FF9500]'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                        {tx.items && tx.items.length > 0 && (
                          <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-100 flex flex-col gap-1">
                            {tx.items.map((it, i) => (
                              <div key={i} className="flex justify-between items-center bg-slate-50 px-1.5 py-0.5 rounded">
                                <span>{it.layanan} × {it.qty}</span>
                                <span className="font-semibold text-slate-500">Rp {(it.subtotal || 0).toLocaleString('id-ID')}</span>
                              </div>
                            ))}
                            
                            <div className="mt-1 pt-1 border-t border-slate-100 border-dashed space-y-0.5 text-slate-500">
                              <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>Rp {(tx.subtotal || 0).toLocaleString('id-ID')}</span>
                              </div>
                              {(tx.diskon || 0) > 0 && (
                                <div className="flex justify-between text-rose-500">
                                  <span>Diskon</span>
                                  <span>- Rp {(tx.diskon || 0).toLocaleString('id-ID')}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-slate-700">
                                <span>Total Tagihan</span>
                                <span>Rp {(tx.total || 0).toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                            
                            <div className="mt-1 pt-1 border-t border-slate-100 border-dashed space-y-0.5">
                              <div className="flex justify-between">
                                <span>Metode Bayar</span>
                                <span className="font-semibold">{tx.metodeBayar || 'Tunai'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Status Bayar</span>
                                <span className={`font-bold ${tx.statusPembayaran === 'Lunas' ? 'text-[#1E4648]' : 'text-[#FF9500]'}`}>{tx.statusPembayaran || 'Lunas'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Kasir / Petugas</span>
                                <span>{tx.petugas || '-'}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {tx.tipe === 'FullService' && tx.pipeline && tx.pipeline.length > 0 && (
                          <div className="pt-1 mt-1 border-t border-slate-100 flex flex-col gap-1 text-[9px]">
                            <span className="font-bold text-slate-500 uppercase tracking-wider">Log Produksi Dropoff:</span>
                            {tx.pipeline.map((p, i) => (
                              <div key={i} className="flex justify-between text-slate-500">
                                <span>- {p.namaStep} {p.status === 'Selesai' ? '✓' : ''}</span>
                                <span className="font-semibold">{p.assignedStaff || p.mesinId || '-'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex gap-3 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition"
              >
                {currentRole === 'MANAGER' ? 'Batal' : 'Tutup'}
              </button>
              {currentRole === 'MANAGER' && (
                <button
                  type="button"
                  onClick={handleSaveCustomerEdit}
                  disabled={savingEdit}
                  className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingEdit ? 'Menyimpan...' : 'Simpan Perubahan Data Pelanggan'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-800">Tambah Pelanggan Baru</h3>
                  <p className="text-[11px] text-slate-500">Daftarkan pelanggan manual ke database & keanggotaan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleTambahPelanggan} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Pelanggan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addNama}
                  onChange={(e) => setAddNama(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
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
                <p className="text-[10px] text-slate-400 mt-1">Format: 08xxxxxxxx (minimal 8 digit). Digunakan untuk kirim resi E-Struk via WhatsApp.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Keanggotaan Member</label>
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">⭐</span>
                    <div>
                      <div className="font-bold text-xs text-slate-800">
                        {addStatusMember ? 'Daftarkan sebagai Member Resmi' : 'Pelanggan Reguler / Umum'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {addStatusMember ? 'Mendapat benefit loyalitas dan promo member' : 'Pelanggan umum tanpa kartu member'}
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat (Opsional)</label>
                <input
                  type="text"
                  value={addAlamat}
                  onChange={(e) => setAddAlamat(e.target.value)}
                  placeholder="Alamat rumah / outlet jemput"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  value={addCatatan}
                  onChange={(e) => setAddCatatan(e.target.value)}
                  placeholder="Catatan khusus, preferensi pewangi, alergi kain, dll."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]"
                />
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
                  <span>{savingAdd ? 'Menyimpan...' : 'Simpan Pelanggan Baru'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
