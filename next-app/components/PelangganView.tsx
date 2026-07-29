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
  ShieldAlert
} from 'lucide-react';
import { runBackend } from '@/lib/api';

export interface PelangganItem {
  noHp: string;
  maskedHp: string;
  nama: string;
  alamat?: string;
  tglDaftar?: string;
  totalOrder: number;
  totalSpend: number;
  terakhirOrder?: string;
  catatan?: string;
  isRepeatOrder?: boolean;
}

export interface TransaksiItemHistory {
  noNota: string;
  tanggal: string;
  total: number;
  status: string;
  tipe: string;
  items: { layanan: string; qty: number; subtotal: number }[];
}

export default function PelangganView() {
  const [pelangganList, setPelangganList] = useState<PelangganItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<'terakhir' | 'order' | 'spend'>('terakhir');

  // Detail & Edit Modal State
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedCust, setSelectedCust] = useState<PelangganItem | null>(null);
  const [editNama, setEditNama] = useState<string>('');
  const [editNoHp, setEditNoHp] = useState<string>('');
  const [editAlamat, setEditAlamat] = useState<string>('');
  const [editCatatan, setEditCatatan] = useState<string>('');
  
  // History list for selected customer
  const [historyList, setHistoryList] = useState<TransaksiItemHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const loadDataPelanggan = async () => {
    setLoading(true);
    try {
      const data = await runBackend<PelangganItem[]>('getDaftarPelanggan');
      if (Array.isArray(data)) {
        setPelangganList(data);
      }
    } catch (err) {
      console.error('Error fetching pelanggan list:', err);
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
    setShowDetailModal(true);

    // Fetch customer transactions history
    setLoadingHistory(true);
    try {
      const txs = await runBackend<TransaksiItemHistory[]>('getRiwayatPelangganByHp', cust.noHp);
      if (Array.isArray(txs)) {
        setHistoryList(txs);
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
    if (!selectedCust) return;
    if (!editNama.trim() || !editNoHp.trim()) {
      alert('Nama dan No. HP pelanggan wajib diisi!');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await runBackend<{ success: boolean; message: string }>(
        'updateDataPelanggan',
        selectedCust.noHp,
        editNoHp.trim(),
        editNama.trim(),
        editAlamat.trim(),
        editCatatan.trim()
      );
      if (res && res.success) {
        alert(res.message || 'Data pelanggan berhasil diperbarui!');
        setShowDetailModal(false);
        loadDataPelanggan();
      } else {
        alert(res?.message || 'Gagal memperbarui data pelanggan');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat memperbarui pelanggan');
    } finally {
      setSavingEdit(false);
    }
  };

  // Filter & Sort Logic
  const filteredList = pelangganList.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.nama.toLowerCase().includes(q) ||
      item.noHp.includes(q) ||
      (item.alamat && item.alamat.toLowerCase().includes(q))
    );
  });

  const sortedList = [...filteredList].sort((a, b) => {
    if (sortBy === 'spend') return b.totalSpend - a.totalSpend;
    if (sortBy === 'order') return b.totalOrder - a.totalOrder;
    // Default: Terakhir Order
    return (b.terakhirOrder || '').localeCompare(a.terakhirOrder || '');
  });

  // Summary Metrics
  const totalPelanggan = pelangganList.length;
  const repeatCount = pelangganList.filter(p => p.totalOrder > 1).length;
  const totalOmzetPelanggan = pelangganList.reduce((acc, curr) => acc + curr.totalSpend, 0);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-7xl mx-auto text-slate-800">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-lg border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1E4648] text-white flex items-center justify-center shadow-md">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Data Pelanggan & Repeat Order</h1>
            <p className="text-xs text-slate-500 font-medium">Kelola basis data pelanggan, preferensi cuci, & riwayat belanja</p>
          </div>
        </div>

        <button
          onClick={loadDataPelanggan}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#1E4648] flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Pelanggan</div>
            <div className="text-xl font-extrabold text-slate-900">{totalPelanggan.toLocaleString('id-ID')} Orang</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Repeat Order (Member)</div>
            <div className="text-xl font-extrabold text-amber-700">{repeatCount.toLocaleString('id-ID')} Orang</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Akumulasi Belanja</div>
            <div className="text-xl font-black text-emerald-700">Rp {totalOmzetPelanggan.toLocaleString('id-ID')}</div>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Table Search & Sort Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau No. HP pelanggan..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto text-xs font-bold">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider shrink-0">Urutkan:</span>
            <button
              onClick={() => setSortBy('terakhir')}
              className={`px-3 py-1.5 rounded-lg border transition ${
                sortBy === 'terakhir' ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Terbaru Order
            </button>
            <button
              onClick={() => setSortBy('order')}
              className={`px-3 py-1.5 rounded-lg border transition ${
                sortBy === 'order' ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Paling Sering
            </button>
            <button
              onClick={() => setSortBy('spend')}
              className={`px-3 py-1.5 rounded-lg border transition ${
                sortBy === 'spend' ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Belanja Tertinggi
            </button>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">No. HP (Unique Key)</th>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4 text-center">Total Order</th>
                <th className="py-3 px-4 text-right">Total Belanja</th>
                <th className="py-3 px-4">Terakhir Order</th>
                <th className="py-3 px-4">Catatan / Preferensi</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-36" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-12 mx-auto" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-20 ml-auto" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3.5 px-4"><div className="h-3.5 bg-slate-100 rounded w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : sortedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-medium">
                    Tidak ada data pelanggan yang cocok
                  </td>
                </tr>
              ) : (
                sortedList.map((item) => (
                  <tr key={item.noHp} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {item.noHp}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{item.nama}</span>
                        {item.totalOrder > 1 && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-extrabold uppercase">
                            Member ({item.totalOrder}x)
                          </span>
                        )}
                      </div>
                      {item.alamat && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.alamat}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-black">
                        {item.totalOrder} Transaksi
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                      Rp {item.totalSpend.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {item.terakhirOrder || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-[11px] italic max-w-xs truncate">
                      {item.catatan || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => openDetailModal(item)}
                        className="px-2.5 py-1.5 bg-[#1E4648] hover:bg-[#153334] text-white rounded-lg font-bold text-[11px] transition inline-flex items-center gap-1 shadow-2xs"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Detail & Edit</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail & Edit Pelanggan + Riwayat Transaksi */}
      {showDetailModal && selectedCust && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 sm:p-6 w-full max-w-2xl border border-slate-100 shadow-2xl my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-[#1E4648] flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Detail & Edit Data Pelanggan</h3>
                  <p className="text-[11px] text-slate-500 font-medium">No. HP Primary Key: {selectedCust.noHp}</p>
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
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-1 flex items-center gap-1.5">
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
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold outline-none focus:border-[#1E4648]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">No. HP / WhatsApp (Unique Key) *</label>
                    <input
                      type="tel"
                      value={editNoHp}
                      onChange={(e) => setEditNoHp(e.target.value)}
                      placeholder="08..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold outline-none focus:border-[#1E4648]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alamat Pelanggan</label>
                  <input
                    type="text"
                    value={editAlamat}
                    onChange={(e) => setEditAlamat(e.target.value)}
                    placeholder="Alamat rumah / outlet jemput"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold outline-none focus:border-[#1E4648]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan Khusus / Preferensi Cuci (Opsional)</label>
                  <textarea
                    rows={2}
                    value={editCatatan}
                    onChange={(e) => setEditCatatan(e.target.value)}
                    placeholder="Misal: Selalu minta tanpa pewangi, lipat baju rapi"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-medium outline-none focus:border-[#1E4648]"
                  />
                </div>
              </div>

              {/* Readonly Summary Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Daftar Pertama:</span>
                  <span className="font-bold text-slate-800">{selectedCust.tglDaftar || '-'}</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Total Order:</span>
                  <span className="font-bold text-slate-800">{selectedCust.totalOrder} Transaksi</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Total Belanja:</span>
                  <span className="font-extrabold text-emerald-700">Rp {selectedCust.totalSpend.toLocaleString('id-ID')}</span>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block">Terakhir Order:</span>
                  <span className="font-bold text-slate-800">{selectedCust.terakhirOrder || '-'}</span>
                </div>
              </div>

              {/* Transaction History Section */}
              <div className="space-y-2">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center justify-between">
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
                        <div className="flex justify-between items-center font-bold text-slate-900">
                          <span className="font-mono text-[#1E4648]">{tx.noNota}</span>
                          <span>Rp {tx.total.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500 text-[10px]">
                          <span>{tx.tanggal}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                            tx.status === 'Selesai' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                        {tx.items && tx.items.length > 0 && (
                          <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-100 flex flex-wrap gap-1">
                            {tx.items.map((it, i) => (
                              <span key={i} className="bg-slate-100 px-1.5 py-0.5 rounded">
                                {it.layanan} ×{it.qty}
                              </span>
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
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCustomerEdit}
                disabled={savingEdit}
                className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{savingEdit ? 'Menyimpan...' : 'Simpan Perubahan Data Pelanggan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
