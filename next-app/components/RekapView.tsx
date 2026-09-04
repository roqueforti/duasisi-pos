'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Calendar, RefreshCw, TrendingUp, ShoppingBag, Award, 
  ShieldAlert, CheckCircle, XCircle, FileSpreadsheet, Printer, Download, Clock, History, AlertCircle,
  Eye, Receipt, Search, Filter, ArrowRight, ExternalLink, FileText, CheckCircle2, AlertTriangle, 
  Tag, Package, User, CreditCard, Sparkles, Layers, X, ChevronRight, HelpCircle, Globe, Send
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { runBackend } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { Transaksi, AuditLog, RekapKasShiftItem } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

interface LaporanResponse {
  ringkasan: {
    totalOmzet: number;
    jumlahTransaksi: number;
    rataRata: number;
    selfCount: number;
    fullCount: number;
  };
  omzetHarian: Array<{
    tanggal: string;
    omzet: number;
    jumlahTransaksi: number;
  }>;
  layananTerlaris: Array<{
    layanan: string;
    qty: number;
    omzet: number;
  }>;
  transaksiList: Array<Transaksi>;
}

export default function RekapView() {
  const { showAlert, showConfirm, showPrompt } = useDialog();
  const todayObj = new Date();
  const todayStr = todayObj.toISOString().substring(0, 10);
  
  const sixMonthsAgoObj = new Date();
  sixMonthsAgoObj.setMonth(sixMonthsAgoObj.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgoObj.toISOString().substring(0, 10);

  const [startDate, setStartDate] = useState(sixMonthsAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LaporanResponse | null>(null);

  const [activeTab, setActiveTabState] = useState<'Laporan' | 'ApprovalVoid' | 'AuditTrail' | 'KasShift'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('duasisi_rekap_subtab');
        if (saved && ['Laporan', 'ApprovalVoid', 'AuditTrail', 'KasShift'].includes(saved)) {
          return saved as 'Laporan' | 'ApprovalVoid' | 'AuditTrail' | 'KasShift';
        }
      } catch (e) {}
    }
    return 'Laporan';
  });

  const setActiveTab = (tab: 'Laporan' | 'ApprovalVoid' | 'AuditTrail' | 'KasShift') => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('duasisi_rekap_subtab', tab);
      } catch (e) {}
    }
  };

  const [pendingVoidList, setPendingVoidList] = useState<Transaksi[]>([]);
  const [voidLoading, setVoidLoading] = useState(false);
  const [processingVoidNota, setProcessingVoidNota] = useState<string | null>(null);
  
  // Audit Logs State & Filters
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<'Semua' | 'WebPublik' | 'CetakWA' | 'Pipeline' | 'Transaksi' | 'Pelanggan' | 'Layanan' | 'Inventory' | 'Shift' | 'Pegawai'>('Semua');
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<AuditLog | null>(null);

  // Kas Shift State & Filters & Modals
  const [kasShiftList, setKasShiftList] = useState<RekapKasShiftItem[]>([]);
  const [kasShiftSearchTerm, setKasShiftSearchTerm] = useState('');
  const [kasShiftModeFilter, setKasShiftModeFilter] = useState<'Semua' | 'SERAH_TERIMA' | 'TUTUP_HARIAN'>('Semua');
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<RekapKasShiftItem | null>(null);
  const [previewModalPhoto, setPreviewModalPhoto] = useState<string | null>(null);

  const [auditLoading, setAuditLoading] = useState(false);
  const [kasShiftLoading, setKasShiftLoading] = useState(false);

  const loadPendingVoid = async () => {
    setVoidLoading(true);
    try {
      const res = await runBackend<Transaksi[]>('getPendingVoidList');
      if (Array.isArray(res)) {
        setPendingVoidList(res);
        return;
      }
    } catch (e) {
      console.warn('getPendingVoidList error, fallback to getTransaksiList:', e);
    }
    try {
      const allTx = await runBackend<Transaksi[]>('getTransaksiList', 'Semua');
      if (Array.isArray(allTx)) {
        setPendingVoidList(allTx.filter(t => t.statusVoid === 'PendingApproval'));
      }
    } catch (err) {
      console.error('Gagal mengambil daftar pending void:', err);
    } finally {
      setVoidLoading(false);
    }
  };

  const loadLaporan = async () => {
    setLoading(true);
    try {
      const res = await runBackend<LaporanResponse>('getLaporanRange', startDate, endDate);
      if (res && res.ringkasan) {
        setData(res);
        if (Array.isArray(res.transaksiList)) {
          const voids = res.transaksiList.filter(t => t.statusVoid === 'PendingApproval');
          if (voids.length > 0) {
            setPendingVoidList(prev => {
              const map = new Map<string, Transaksi>();
              prev.forEach(t => map.set(t.noNota, t));
              voids.forEach(t => map.set(t.noNota, t));
              return Array.from(map.values());
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const logs = await runBackend<AuditLog[]>('getAuditLogs', 500);
      if (Array.isArray(logs)) setAuditLogs(logs);
    } catch (e) {
    } finally {
      setAuditLoading(false);
    }
  };

  const loadKasShift = async () => {
    setKasShiftLoading(true);
    try {
      const kasList = await runBackend<RekapKasShiftItem[]>('getRekapKasShift');
      if (Array.isArray(kasList)) setKasShiftList(kasList);
    } catch (e) {
    } finally {
      setKasShiftLoading(false);
    }
  };

  useEffect(() => {
    loadLaporan();
    loadAuditLogs();
    loadKasShift();
    loadPendingVoid();
  }, []);

  useEffect(() => {
    if (activeTab === 'AuditTrail') {
      loadAuditLogs();
    } else if (activeTab === 'KasShift') {
      loadKasShift();
    } else if (activeTab === 'ApprovalVoid') {
      loadPendingVoid();
    }
  }, [activeTab]);

  const handleApproveVoid = async (noNota: string, isApproved: boolean) => {
    const actionStr = isApproved ? 'menyetujui' : 'menolak';
    const isConfirmed = await showConfirm(`Konfirmasi ${actionStr} pembatalan (void) nota ${noNota}?`);
    if (!isConfirmed) return;
    const catatan = await showPrompt(`Catatan keputusan (${actionStr}) *:`);
    if (!catatan?.trim()) {
      await showAlert('Catatan keputusan wajib diisi.', 'warning');
      return;
    }

    setProcessingVoidNota(noNota);
    try {
      const result = await runBackend<{ success: boolean; message?: string }>(
        'approveVoidTransaksi', 
        noNota, 
        isApproved, 
        'Manager / Owner', 
        'MANAGER', 
        catatan.trim()
      );
      if (!result?.success) throw new Error(result?.message || 'Approval gagal disimpan');
      
      clearCache('getTransaksiList');
      clearCache('getLaporanRange');
      clearCache('getKasShiftAktif');
      clearCache('getPendingVoidList');

      await showAlert(`Berhasil ${actionStr} void nota ${noNota}`, 'success');
      await loadPendingVoid();
      loadLaporan();
      loadAuditLogs();
    } catch (err: any) {
      await showAlert(err?.message || 'Gagal memproses permohonan void.', 'error');
    } finally {
      setProcessingVoidNota(null);
    }
  };

  const handleExportCSV = () => {
    if (!data?.transaksiList || data.transaksiList.length === 0) {
      showAlert('Tidak ada data transaksi untuk diekspor pada rentang tanggal ini.', 'warning');
      return;
    }
    const headers = ['No Nota', 'Tanggal', 'Pelanggan', 'No HP', 'Petugas', 'Metode Bayar', 'Status Bayar', 'Status Pengerjaan', 'Total (Rp)'];
    const rows = data.transaksiList.map(t => [
      `"${t.noNota}"`,
      `"${t.tanggal}"`,
      `"${t.namaPelanggan}"`,
      `"${t.noHp || '-'}"`,
      `"${t.petugas}"`,
      `"${t.metodeBayar || 'Tunai'}"`,
      `"${t.statusPembayaran || 'Lunas'}"`,
      `"${t.status}"`,
      t.total || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Transaksi_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ringkasan = data?.ringkasan || { totalOmzet: 0, jumlahTransaksi: 0, rataRata: 0, selfCount: 0, fullCount: 0 };
  const omzetHarian = data?.omzetHarian || [];
  const maxOmzetHarian = Math.max(...omzetHarian.map(d => d.omzet), 1);
  const layananTerlaris = data?.layananTerlaris || [];

  const filteredAuditLogs = auditLogs.filter((log) => {
    const act = (log.jenisAktivitas || '').toLowerCase();
    const user = (log.namaUser || '').toLowerCase();
    const matchCat = 
      auditCategoryFilter === 'Semua' ? true :
      auditCategoryFilter === 'WebPublik' ? (act.includes('kunjungan') || act.includes('landing') || act.includes('cek status') || act.includes('cek poin') || act.includes('e-nota') || user.includes('pengunjung') || user.includes('pelanggan:')) :
      auditCategoryFilter === 'Transaksi' ? (act.includes('transaksi') || act.includes('void') || act.includes('bayar') || act.includes('pelunasan')) :
      auditCategoryFilter === 'CetakWA' ? (act.includes('cetak') || act.includes('struk') || act.includes('label') || act.includes('wa') || act.includes('whatsapp') || act.includes('reminder')) :
      auditCategoryFilter === 'Pipeline' ? (act.includes('pipeline') || act.includes('drop-off') || act.includes('bahan') || act.includes('cucian') || act.includes('mesin')) :
      auditCategoryFilter === 'Pelanggan' ? (act.includes('pelanggan') || act.includes('member')) :
      auditCategoryFilter === 'Layanan' ? (act.includes('layanan') || act.includes('produk') || act.includes('harga')) :
      auditCategoryFilter === 'Inventory' ? (act.includes('inventory') || act.includes('stok') || act.includes('bahan')) :
      auditCategoryFilter === 'Shift' ? (act.includes('shift') || act.includes('kas')) :
      auditCategoryFilter === 'Pegawai' ? (act.includes('pegawai') || act.includes('absensi') || act.includes('gaji') || act.includes('cuti')) : true;

    if (!matchCat) return false;

    if (!auditSearchTerm.trim()) return true;
    const q = auditSearchTerm.toLowerCase();
    return (
      (log.idLog || '').toLowerCase().includes(q) ||
      (log.namaUser || '').toLowerCase().includes(q) ||
      (log.jenisAktivitas || '').toLowerCase().includes(q) ||
      (log.referensi || '').toLowerCase().includes(q) ||
      (log.detail || '').toLowerCase().includes(q) ||
      (log.dataSebelum || '').toLowerCase().includes(q) ||
      (log.dataSesudah || '').toLowerCase().includes(q)
    );
  });

  const filteredKasShiftList = kasShiftList.filter((shift) => {
    if (kasShiftModeFilter !== 'Semua' && shift.modeTutup !== kasShiftModeFilter) return false;
    if (!kasShiftSearchTerm.trim()) return true;
    const q = kasShiftSearchTerm.toLowerCase();
    return (
      (shift.idShift || '').toLowerCase().includes(q) ||
      (shift.namaKasir || '').toLowerCase().includes(q) ||
      (shift.namaPengganti || '').toLowerCase().includes(q) ||
      (shift.catatan || '').toLowerCase().includes(q) ||
      (shift.rincianBelanja || '').toLowerCase().includes(q) ||
      (shift.waktuBuka || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-3 md:p-4 space-y-3 sm:space-y-4 w-full text-slate-700">
      
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-2.5 flex-wrap shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('Laporan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'Laporan' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analitik & Omzet</span>
            </button>
            <button
              onClick={() => setActiveTab('KasShift')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 relative ${
                activeTab === 'KasShift' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <RupiahIcon className="w-3.5 h-3.5" />
              <span>Riwayat Kas Shift</span>
              {kasShiftList.some(s => s.status === 'Aktif') && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('AuditTrail')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                activeTab === 'AuditTrail' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Log Aktivitas Sistem</span>
            </button>
            <button
              onClick={() => setActiveTab('ApprovalVoid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 relative ${
                activeTab === 'ApprovalVoid' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Persetujuan Void</span>
              {pendingVoidList.length > 0 && (
                <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full animate-bounce">
                  {pendingVoidList.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadLaporan(); loadAuditLogs(); loadKasShift(); loadPendingVoid(); }}
            disabled={loading || voidLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(loading || voidLoading) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        </div>
      </div>

      {activeTab === 'Laporan' && (
        <div className="space-y-4">
          
          <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-800" /> Rentang:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-glow px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 outline-none"
              />
              <span className="text-xs font-bold text-slate-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-glow px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 outline-none"
              />
              <button
                onClick={loadLaporan}
                className="tactile-btn btn-glow-emerald px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Terapkan
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="tactile-btn px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor CSV
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-stat-card card-hover-lift p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1 truncate">Total Omzet Penjualan</div>
              <div className="text-lg sm:text-xl font-black text-teal-800 font-mono truncate">
                Rp {(ringkasan?.totalOmzet || 0).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="glass-stat-card card-hover-lift p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1 truncate">Jumlah Transaksi</div>
              <div className="text-lg sm:text-xl font-black text-slate-800 font-mono truncate">
                {ringkasan.jumlahTransaksi} <span className="text-xs font-semibold text-slate-400">nota</span>
              </div>
            </div>

            <div className="glass-stat-card card-hover-lift p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1 truncate">Rata-rata Nilai Nota</div>
              <div className="text-lg sm:text-xl font-black text-slate-800 font-mono truncate">
                Rp {(ringkasan?.rataRata || 0).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="glass-stat-card card-hover-lift p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider mb-1 truncate">Self vs Drop Off</div>
              <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2 mt-1">
                <span className="badge-glow-teal px-2 py-0.5 rounded-full">{ringkasan.selfCount} Self</span>
                <span className="badge-glow-amber px-2 py-0.5 rounded-full">{ringkasan.fullCount} Full</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#1E4648]" />
              <span>Grafik Visual Tren Omzet Harian</span>
            </h3>

            {omzetHarian.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-6">Tidak ada data tren harian untuk periode terpilih</div>
            ) : (
              <div className="space-y-1.5 pt-1">
                {omzetHarian.map((item, idx) => {
                  const pct = Math.round((item.omzet / maxOmzetHarian) * 100);
                  return (
                    <div key={idx} className="flex items-center gap-2.5 text-xs">
                      <div className="w-20 sm:w-24 text-slate-600 font-semibold text-[11px] shrink-0">{item.tanggal}</div>
                      <div className="flex-1 bg-slate-100 h-4 sm:h-5 rounded-md overflow-hidden relative">
                        <div 
                          className="bg-[#1E4648] h-full rounded-md transition-all duration-500" 
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-bold text-white drop-shadow-xs">
                          Rp {(item?.omzet || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="w-14 sm:w-16 text-right font-medium text-slate-500 text-[11px] shrink-0">{item.jumlahTransaksi} nota</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-700">
                Rincian Tabel Omzet Harian
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Tanggal</th>
                      <th className="py-2.5 px-4">Jumlah Transaksi</th>
                      <th className="py-2.5 px-4 text-right">Total Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {omzetHarian.length === 0 ? (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-400">Belum ada data transaksi</td></tr>
                    ) : (
                      omzetHarian.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-4 font-semibold text-slate-700">{item.tanggal}</td>
                          <td className="py-2.5 px-4 text-slate-600">{item.jumlahTransaksi} Transaksi</td>
                          <td className="py-2.5 px-4 text-right font-bold text-[#1E4648]">Rp {(item?.omzet || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-700">
                Layanan & Produk Terlaris
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Nama Layanan</th>
                      <th className="py-2.5 px-4">Terjual (Qty)</th>
                      <th className="py-2.5 px-4 text-right">Kontribusi Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {layananTerlaris.length === 0 ? (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-400">Belum ada data penjualan layanan</td></tr>
                    ) : (
                      layananTerlaris.map((l, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-4 font-semibold text-slate-700">{l.layanan}</td>
                          <td className="py-2.5 px-4 text-slate-600">{l.qty} Transaksi</td>
                          <td className="py-2.5 px-4 text-right font-bold text-[#1E4648]">Rp {(l?.omzet || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ApprovalVoid' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Persetujuan Void & Retur Transaksi</span>
              </h3>
              <p className="text-xs text-slate-500">Permohonan pembatalan transaksi dari Staf Kasir membutuhkan verifikasi Manager/Owner.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadPendingVoid}
                disabled={voidLoading}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                title="Muat ulang permohonan void"
              >
                <RefreshCw className={`w-3 h-3 ${voidLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1 rounded-full">
                {pendingVoidList.length} Permohonan Pending
              </span>
            </div>
          </div>

          {voidLoading && pendingVoidList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <RefreshCw className="w-8 h-8 text-[#1E4648] mx-auto mb-2 animate-spin" />
              <p className="text-xs font-semibold text-slate-700">Memeriksa antrean permohonan void...</p>
            </div>
          ) : pendingVoidList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">Tidak ada permohonan void pending</p>
              <p className="text-[11px] text-slate-400">Seluruh transaksi berjalan normal tanpa pengajuan pembatalan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingVoidList.map((tx) => (
                <div key={tx.noNota} className="p-4 border border-rose-200 rounded-xl bg-rose-50/40 flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                  <div className="space-y-1.5 text-xs flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm tracking-wide">{tx.noNota}</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">Pengajuan Void</span>
                      {tx.tipe && (
                        <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded">
                          {tx.tipe}
                        </span>
                      )}
                      {tx.petugas && (
                        <span className="text-[10px] bg-amber-50 text-amber-800 font-medium px-2 py-0.5 rounded border border-amber-200/60">
                          Kasir: {tx.petugas}
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                      <p>Pelanggan: <span className="font-semibold text-slate-700">{tx.namaPelanggan}</span> ({tx.noHp || '-'})</p>
                      <p>Waktu Transaksi: <span className="font-semibold text-slate-700">{tx.tanggal || '-'}</span></p>
                      <p>Total Nominal: <span className="font-bold text-rose-700">Rp {(tx?.total || 0).toLocaleString('id-ID')}</span></p>
                      <p>Metode Bayar: <span className="font-semibold text-slate-700">{tx.metodeBayar || 'Tunai'}</span></p>
                    </div>

                    {tx.items && tx.items.length > 0 && (
                      <p className="text-[11px] text-slate-500 bg-white/70 px-2.5 py-1 rounded border border-slate-100 inline-block">
                        <span className="font-semibold text-slate-600">Layanan: </span>
                        {tx.items.map(i => `${i.layanan} (${i.qty}x)`).join(', ')}
                      </p>
                    )}

                    <div className="p-2.5 bg-white rounded-lg border border-rose-200 text-slate-700">
                      <span className="font-semibold text-rose-800 text-[11px]">Alasan Pembatalan: </span>
                      <span className="italic text-slate-700 font-medium text-xs">"{tx.alasanVoid || 'Pembatalan transaksi kasir'}"</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleApproveVoid(tx.noNota, false)}
                      disabled={processingVoidNota === tx.noNota}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 text-rose-500" /> Tolak Void
                    </button>
                    <button
                      onClick={() => handleApproveVoid(tx.noNota, true)}
                      disabled={processingVoidNota === tx.noNota}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition flex items-center gap-1 shadow-xs disabled:opacity-50"
                    >
                      {processingVoidNota === tx.noNota ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>Setujui Pembatalan</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'AuditTrail' && (
        <div className="space-y-3 sm:space-y-4">
          
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#1E4648]" />
                  <span>Log Aktivitas Sistem & Audit Trail Lengkap</span>
                </h3>
                <p className="text-xs text-slate-500">Mencatat seluruh mutasi data, pelaku, waktu presisi, serta komparasi data sebelum dan sesudahnya.</p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearchTerm}
                    onChange={(e) => setAuditSearchTerm(e.target.value)}
                    placeholder="Cari aktivitas, user, referensi..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648] focus:bg-white transition"
                  />
                </div>

                <button
                  onClick={loadAuditLogs}
                  disabled={auditLoading}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-[#1E4648] hover:text-white text-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shrink-0 border border-slate-200"
                  title="Muat Ulang Log Aktivitas"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin text-[#1E4648]' : ''}`} />
                  <span className="hidden sm:inline">{auditLoading ? 'Memuat...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100">
              {[
                { id: 'Semua', label: 'Semua Aktivitas', icon: Layers },
                { id: 'WebPublik', label: 'Web Publik & Pelanggan', icon: Globe },
                { id: 'CetakWA', label: 'Cetak Struk & WA', icon: Printer },
                { id: 'Pipeline', label: 'Pipeline Cucian', icon: RefreshCw },
                { id: 'Transaksi', label: 'Transaksi & Void', icon: Receipt },
                { id: 'Pelanggan', label: 'Pelanggan & Member', icon: User },
                { id: 'Layanan', label: 'Layanan & Harga', icon: Tag },
                { id: 'Inventory', label: 'Stok & Bahan', icon: Package },
                { id: 'Shift', label: 'Shift & Kas', icon: Clock },
                { id: 'Pegawai', label: 'Pegawai & Absensi', icon: Award },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSel = auditCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setAuditCategoryFilter(cat.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 border ${
                      isSel 
                        ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-2xs' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                    <th className="py-3 px-3.5 whitespace-nowrap">Waktu & Detik</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Pelaku (User)</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Aktivitas & Modul</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Target / Referensi</th>
                    <th className="py-3 px-3.5">Keterangan & Rincian Aksi</th>
                    <th className="py-3 px-3.5">Data Sebelum &rarr; Sesudah</th>
                    <th className="py-3 px-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400">
                        <History className="w-10 h-10 text-slate-300 mx-auto mb-2.5 opacity-60" />
                        <p className="font-bold text-slate-600 text-sm">Tidak ada data log aktivitas pada filter ini</p>
                        <p className="text-xs text-slate-400 mt-1">Coba gunakan kata kunci pencarian lain atau pilih tab 'Semua Aktivitas'.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log, idx) => {
                      const hasDiff = log.dataSebelum && log.dataSebelum !== '-' && log.dataSesudah && log.dataSesudah !== '-';
                      const hasSingleNote = (log.dataSesudah && log.dataSesudah !== '-') || (log.dataSebelum && log.dataSebelum !== '-');
                      const singleNoteValue = log.dataSesudah && log.dataSesudah !== '-' ? log.dataSesudah : log.dataSebelum;
                      
                      const act = (log.jenisAktivitas || '').toLowerCase();
                      const isDanger = act.includes('void') || act.includes('hapus') || act.includes('reject');
                      const isSuccess = act.includes('transaksi') || act.includes('bayar') || act.includes('pelunasan') || act.includes('approve');
                      const isMember = act.includes('member') || act.includes('pelanggan');
                      const isPrint = act.includes('cetak') || act.includes('struk') || act.includes('label');
                      const isWa = act.includes('wa') || act.includes('whatsapp') || act.includes('reminder');
                      const isPipeline = act.includes('pipeline') || act.includes('drop-off') || act.includes('cucian') || act.includes('mesin');
                      const isShift = act.includes('shift') || act.includes('kas');
                      const isWeb = act.includes('kunjungan') || act.includes('landing') || act.includes('web') || act.includes('e-nota');

                      const badgeStyle = 
                        isDanger ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        isSuccess ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        isMember ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                        isPrint ? 'bg-sky-50 text-sky-800 border-sky-200' :
                        isWa ? 'bg-green-50 text-green-800 border-green-200' :
                        isPipeline ? 'bg-[#B5C9C9]/20 text-[#1E4648] border-[#B5C9C9]' :
                        isShift ? 'bg-teal-50 text-teal-800 border-teal-200' :
                        isWeb ? 'bg-slate-100 text-slate-700 border-slate-200' :
                        'bg-slate-50 text-slate-700 border-slate-200';

                      const userInitial = (log.namaUser || 'U').charAt(0).toUpperCase();
                      const isManager = (log.namaUser || '').toLowerCase().includes('manager') || (log.namaUser || '').toLowerCase().includes('owner');
                      const isPublic = (log.namaUser || '').toLowerCase().includes('pengunjung') || (log.namaUser || '').toLowerCase().includes('pelanggan');

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition group">
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-700 font-mono text-[11px] font-bold">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{log.waktu}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 shadow-2xs ${
                                isManager ? 'bg-[#FF9500]' : isPublic ? 'bg-slate-500' : 'bg-[#1E4648]'
                              }`}>
                                {userInitial}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block text-xs">{log.namaUser}</span>
                                <span className="text-[10px] text-slate-400 font-semibold block">
                                  {isManager ? 'Manager Outlet' : isPublic ? 'Web Public' : 'Staff / Kasir'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${badgeStyle}`}>
                              {isPrint && <Printer className="w-3 h-3" />}
                              {isWa && <Send className="w-3 h-3" />}
                              {isPipeline && <RefreshCw className="w-3 h-3" />}
                              {isMember && <User className="w-3 h-3" />}
                              {isWeb && <Globe className="w-3 h-3" />}
                              <span>{log.jenisAktivitas}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-mono font-bold text-[11px]">
                              {log.referensi || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 max-w-xs sm:max-w-sm">
                            <div className="text-slate-700 text-xs leading-relaxed font-medium">
                              {log.detail && log.detail !== '-' ? log.detail : `${log.jenisAktivitas} pada ${log.referensi || 'sistem'}`}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 max-w-sm">
                            {hasDiff ? (
                              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                                <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md font-medium" title="Data Sebelum">
                                  {log.dataSebelum}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md font-bold" title="Data Sesudah">
                                  {log.dataSesudah}
                                </span>
                              </div>
                            ) : hasSingleNote ? (
                              <span className="px-2 py-0.5 bg-[#B5C9C9]/15 text-[#1E4648] border border-[#B5C9C9]/40 rounded-md text-[11px] font-semibold">
                                {singleNoteValue}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedAuditDetail(log)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#1E4648] hover:text-white text-slate-700 font-bold rounded-lg text-xs transition flex items-center gap-1 mx-auto shadow-2xs"
                              title="Inspeksi Detail Rekaman"
                            >
                              <Eye className="w-3.5 h-3.5" />
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
        </div>
      )}

      {activeTab === 'KasShift' && (
        <div className="space-y-3 sm:space-y-4">
          
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <RupiahIcon className="w-4 h-4 text-[#1E4648]" />
                  <span>Riwayat Kas Shift, Pergantian Kasir & Bukti Belanja</span>
                </h3>
                <p className="text-xs text-slate-500">Audit rekonsiliasi kas laci, serah terima antar kasir, rincian belanja barang, dan foto struk belanjaan.</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={kasShiftSearchTerm}
                  onChange={(e) => setKasShiftSearchTerm(e.target.value)}
                  placeholder="Cari ID shift, kasir, belanja..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648] focus:bg-white transition"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400">Filter Mode:</span>
              <button
                onClick={() => setKasShiftModeFilter('Semua')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${kasShiftModeFilter === 'Semua' ? 'bg-[#1E4648] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Semua Shift
              </button>
              <button
                onClick={() => setKasShiftModeFilter('SERAH_TERIMA')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${kasShiftModeFilter === 'SERAH_TERIMA' ? 'bg-[#1E4648] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Serah Terima
              </button>
              <button
                onClick={() => setKasShiftModeFilter('TUTUP_HARIAN')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${kasShiftModeFilter === 'TUTUP_HARIAN' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Tutup Harian Toko
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Waktu Buka / Tutup</th>
                    <th className="py-2.5 px-3">Penanggung Jawab</th>
                    <th className="py-2.5 px-3">Mode Penutupan</th>
                    <th className="py-2.5 px-3 text-right">Kas Awal</th>
                    <th className="py-2.5 px-3 text-right">Kas Fisik Laci</th>
                    <th className="py-2.5 px-3 text-right">Selisih</th>
                    <th className="py-2.5 px-3 text-right">Total Belanja</th>
                    <th className="py-2.5 px-3 text-center">Bukti Nota</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredKasShiftList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold">Belum ada riwayat shift yang sesuai filter</p>
                      </td>
                    </tr>
                  ) : (
                    filteredKasShiftList.map((shift, idx) => {
                      const isLive = shift.status === 'Aktif';
                      const hasPhotos = shift.fotoNota && shift.fotoNota.length > 0;
                      const isBalance = shift.selisihKas === 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition group">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                              {shift.waktuBuka}
                              {isLive && (
                                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded-full animate-pulse">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[10px]">
                              {isLive ? 'Shift sedang berlangsung' : `Tutup: ${shift.waktuTutup || '-'}`}
                            </div>
                          </td>
                          
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{shift.namaKasir}</div>
                            {shift.namaPengganti && (
                              <div className="text-[10px] text-teal-700 font-semibold flex items-center gap-1">
                                <ArrowRight className="w-2.5 h-2.5" /> Handover: {shift.namaPengganti}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            {isLive ? (
                              <span className="px-2 py-0.5 bg-[#B5C9C9]/30 text-[#1E4648] rounded text-[10px] font-bold uppercase">
                                Shift Aktif
                              </span>
                            ) : shift.modeTutup === 'SERAH_TERIMA' ? (
                              <span className="px-2 py-0.5 bg-[#1E4648]/10 text-[#1E4648] border border-[#1E4648]/30 rounded text-[10px] font-bold uppercase">
                                Serah Terima
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold uppercase">
                                Tutup Harian
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                            Rp {(shift.kasAwal || 0).toLocaleString('id-ID')}
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            {isLive ? '-' : `Rp ${(shift.kasAkhirFisik || 0).toLocaleString('id-ID')}`}
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold">
                            {isLive ? '-' : (
                              <span className={isBalance ? 'text-emerald-600' : shift.selisihKas > 0 ? 'text-amber-600' : 'text-rose-600'}>
                                {shift.selisihKas > 0 ? '+' : ''}Rp {(shift.selisihKas || 0).toLocaleString('id-ID')}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                            {shift.totalBelanja && shift.totalBelanja > 0 ? (
                              <span>Rp {shift.totalBelanja.toLocaleString('id-ID')}</span>
                            ) : (
                              <span className="text-slate-300 font-normal">Rp 0</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {hasPhotos ? (
                              <button
                                onClick={() => setSelectedShiftDetail(shift)}
                                className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-[10px] font-bold flex items-center gap-1 mx-auto hover:bg-amber-100 transition"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>{shift.fotoNota?.length} Nota</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 text-[10px]">-</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => setSelectedShiftDetail(shift)}
                              className="px-2.5 py-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-lg text-[10px] transition shadow-2xs"
                            >
                              Detail
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
        </div>
      )}

      {selectedShiftDetail && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1E4648] text-white flex items-center justify-center shadow-xs">
                  <Receipt className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-slate-800">
                      Rincian Rekonsiliasi Kas Shift ({selectedShiftDetail.idShift})
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      selectedShiftDetail.status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {selectedShiftDetail.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Dibuka: {selectedShiftDetail.waktuBuka} • Kasir: {selectedShiftDetail.namaKasir}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedShiftDetail(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs">
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>1. Rekonsiliasi Kas Laci (Uang Tunai)</span>
                  <span className="text-[10px] font-normal text-slate-400">Berdasarkan pergerakan transaksi shift</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Kas Awal</span>
                    <span className="font-bold text-slate-700 text-xs sm:text-sm">Rp {(selectedShiftDetail.kasAwal || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Total Belanja (-)</span>
                    <span className="font-bold text-amber-700 text-xs sm:text-sm">Rp {(selectedShiftDetail.totalBelanja || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Kas Fisik Akhir</span>
                    <span className="font-bold text-slate-800 text-xs sm:text-sm">Rp {(selectedShiftDetail.kasAkhirFisik || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${
                    selectedShiftDetail.selisihKas === 0 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : selectedShiftDetail.selisihKas > 0 
                      ? 'bg-amber-50 border-amber-200 text-amber-800' 
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <span className="block text-[10px] font-bold uppercase">Selisih Kas</span>
                    <span className="font-extrabold text-xs sm:text-sm">
                      {selectedShiftDetail.selisihKas > 0 ? '+' : ''}Rp {(selectedShiftDetail.selisihKas || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-xs text-slate-700">2. Saldo Aplikasi Merchant (Non-Tunai / QRIS)</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Saldo Awal Merchant</span>
                    <span className="font-bold text-slate-700">Rp {(selectedShiftDetail.saldoMerchantAwal || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Saldo Akhir Merchant</span>
                    <span className="font-bold text-slate-700">Rp {(selectedShiftDetail.saldoMerchantAkhir || 0).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>3. Rincian Pengeluaran Belanja Operasional</span>
                  <span className="font-bold text-amber-700">Total: Rp {(selectedShiftDetail.totalBelanja || 0).toLocaleString('id-ID')}</span>
                </div>
                
                <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-lg text-slate-700 leading-relaxed font-medium">
                  {selectedShiftDetail.rincianBelanja ? (
                    <div>{selectedShiftDetail.rincianBelanja}</div>
                  ) : selectedShiftDetail.catatan ? (
                    <div>{selectedShiftDetail.catatan}</div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px]">Tidak ada pengeluaran belanja pada shift ini.</div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="font-bold text-xs text-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-[#1E4648]" />
                    <span>4. Foto Bukti Nota Belanja (Tersimpan di Google Drive)</span>
                  </div>
                  <span className="text-slate-400 text-[10px]">{selectedShiftDetail.fotoNota?.length || 0} Lembar Foto</span>
                </div>

                {!selectedShiftDetail.fotoNota || selectedShiftDetail.fotoNota.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    <Receipt className="w-6 h-6 mx-auto mb-1 opacity-40 text-slate-400" />
                    <p className="text-[11px]">Tidak ada foto nota belanja yang diunggah.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedShiftDetail.fotoNota.map((url, pIdx) => (
                      <div key={pIdx} className="group relative rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-2xs">
                        <img 
                          src={url} 
                          alt={`Bukti Nota ${pIdx + 1}`}
                          className="w-full h-32 object-cover transition duration-200 group-hover:scale-105 cursor-pointer"
                          onClick={() => setPreviewModalPhoto(url)}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPreviewModalPhoto(url)}
                            className="p-1.5 bg-white text-slate-800 rounded-lg hover:bg-slate-100 transition shadow-md"
                            title="Zoom Foto Nota"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-[#1E4648] text-white rounded-lg hover:bg-[#163536] transition shadow-md"
                            title="Buka di Google Drive"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="p-1.5 bg-white text-[10px] font-bold text-slate-600 flex justify-between items-center border-t border-slate-100">
                          <span>Nota #{pIdx + 1}</span>
                          <span className="text-teal-700 text-[9px]">Google Drive</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedShiftDetail.namaPengganti && (
                <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 space-y-1.5">
                  <div className="font-bold text-xs text-[#1E4648] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>5. Informasi Serah Terima Kasir (Handover)</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Kas diserah-terimakan dari <strong className="text-slate-800">{selectedShiftDetail.namaKasir}</strong> ke kasir pengganti <strong className="text-[#1E4648]">{selectedShiftDetail.namaPengganti}</strong> pada <strong>{selectedShiftDetail.waktuHandover || selectedShiftDetail.waktuTutup}</strong>.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedShiftDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {previewModalPhoto && (
        <div 
          className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewModalPhoto(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setPreviewModalPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 text-white bg-white/20 hover:bg-white/30 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={previewModalPhoto} 
              alt="Preview Nota Zoom" 
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border-2 border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="pt-3 flex gap-3">
              <a
                href={previewModalPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#1E4648] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg hover:bg-[#163536] transition"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Berkas Asli di Google Drive</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {selectedAuditDetail && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-3.5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1E4648] text-white flex items-center justify-center shadow-xs">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Detail Rekaman Log Aktivitas</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{selectedAuditDetail.idLog}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAuditDetail(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Waktu Kejadian:</span>
                  <span className="font-mono font-bold text-slate-700">{selectedAuditDetail.waktu}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Pelaku (User):</span>
                  <span className="font-bold text-[#1E4648]">{selectedAuditDetail.namaUser}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Jenis Aksi:</span>
                  <span className="font-bold text-slate-700">{selectedAuditDetail.jenisAktivitas}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Target / Referensi:</span>
                  <span className="font-mono font-bold text-slate-700">{selectedAuditDetail.referensi || '-'}</span>
                </div>
              </div>

              {selectedAuditDetail.dataSebelum && selectedAuditDetail.dataSebelum !== '-' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-rose-700">Data Sebelum Diubah (Before):</label>
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-mono text-[11px] break-all leading-relaxed">
                    {selectedAuditDetail.dataSebelum}
                  </div>
                </div>
              )}

              {selectedAuditDetail.dataSesudah && selectedAuditDetail.dataSesudah !== '-' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-emerald-700">Data Sesudah Diubah (After):</label>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-mono text-[11px] break-all leading-relaxed">
                    {selectedAuditDetail.dataSesudah}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Catatan / Ringkasan:</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[11px]">
                  {selectedAuditDetail.detail || '-'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedAuditDetail(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
