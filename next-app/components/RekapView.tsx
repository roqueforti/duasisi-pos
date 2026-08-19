'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Calendar, RefreshCw, TrendingUp, ShoppingBag, Award, 
  ShieldAlert, CheckCircle, XCircle, FileSpreadsheet, Printer, Download, Clock, History, AlertCircle
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { runBackend } from '@/lib/api';
import { Transaksi, AuditLog } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

interface RekapKasShift {
  idShift: string;
  idOutlet: string;
  namaKasir: string;
  waktuBuka: string;
  waktuTutup: string;
  kasAwal: number;
  kasAkhirSistem: number;
  kasAkhirFisik: number;
  selisihKas: number;
  status: string;
  modeTutup: string;
}

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

  // Active Tab: 'Laporan' | 'ApprovalVoid' | 'AuditTrail' | 'KasShift'
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

  // Void Approval State
  const [pendingVoidList, setPendingVoidList] = useState<Transaksi[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [kasShiftList, setKasShiftList] = useState<RekapKasShift[]>([]);

  const loadLaporan = async () => {
    setLoading(true);
    try {
      const res = await runBackend<LaporanResponse>('getLaporanRange', startDate, endDate);
      if (res && res.ringkasan) {
        setData(res);
        if (Array.isArray(res.transaksiList)) {
          setPendingVoidList(res.transaksiList.filter(t => t.statusVoid === 'PendingApproval'));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await runBackend<AuditLog[]>('getAuditLogs');
      if (Array.isArray(logs)) setAuditLogs(logs);
    } catch (e) {}
  };

  const loadKasShift = async () => {
    try {
      const kasList = await runBackend<RekapKasShift[]>('getRekapKasShift');
      if (Array.isArray(kasList)) setKasShiftList(kasList);
    } catch (e) {}
  };

  useEffect(() => {
    loadLaporan();
    loadAuditLogs();
    loadKasShift();
  }, []);

  const handleApproveVoid = async (noNota: string, isApproved: boolean) => {
    const actionStr = isApproved ? 'menyetujui' : 'menolak';
    const isConfirmed = await showConfirm(`Konfirmasi ${actionStr} pembatalan (void) nota ${noNota}?`);
    if (!isConfirmed) return;
    const catatan = await showPrompt(`Catatan keputusan (${actionStr}) *:`);
    if (!catatan?.trim()) {
      await showAlert('Catatan keputusan wajib diisi.', 'warning');
      return;
    }

    try {
      const result = await runBackend<{ success: boolean; message?: string }>('approveVoidTransaksi', noNota, isApproved, 'Manager / Owner', 'MANAGER', catatan.trim());
      if (!result?.success) throw new Error(result?.message || 'Approval gagal disimpan');
      await showAlert(`Berhasil ${actionStr} void nota ${noNota}`, 'success');
      loadLaporan();
    } catch (error) {
      console.error(error);
      await showAlert(`Gagal memproses void nota ${noNota}. Silakan coba lagi.`, 'error');
    }
  };

  const handleExportCSV = async () => {
    if (!data || !data.omzetHarian) { await showAlert('Tidak ada data laporan untuk diekspor!', 'warning'); return; }
    
    let csv = 'Tanggal,Jumlah Transaksi,Total Omzet\n';
    data.omzetHarian.forEach(row => {
      csv += `"${row.tanggal}",${row.jumlahTransaksi},${row.omzet}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Omzet_DuaSisi_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ringkasan = data?.ringkasan || { totalOmzet: 0, jumlahTransaksi: 0, rataRata: 0, selfCount: 0, fullCount: 0 };
  const omzetHarian = data?.omzetHarian || [];
  const layananTerlaris = data?.layananTerlaris || [];
  const maxOmzetHarian = Math.max(...omzetHarian.map(o => o.omzet), 100000);

  const handleRunSeeder6Bulan = async () => {
    const isConfirmed = await showConfirm('Generate ~300-500 data sampel transaksi acak selama 6 bulan terakhir ke database Google Sheets? (Data transaksi lama akan di-reset).');
    if (!isConfirmed) return;
    setLoading(true);
    try {
      const res = await runBackend<any>('resetAndSeed6Bulan');
      if (res && res.success) {
        await showAlert(`✅ ${res.message}`, 'success');
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const startStr = sixMonthsAgo.toISOString().substring(0, 10);
        const endStr = new Date().toISOString().substring(0, 10);
        setStartDate(startStr);
        setEndDate(endStr);
        const resLap = await runBackend<LaporanResponse>('getLaporanRange', startStr, endStr);
        if (resLap && resLap.ringkasan) setData(resLap);
      } else {
        await showAlert(res?.message || 'Gagal meng-generate data seeder. Pastikan Apps Script sudah di-deploy ulang versi terbaru.', 'error');
      }
    } catch (err: any) {
      await showAlert(`Gagal terhubung ke server seeder: ${err?.message || 'Timeout/Koneksi terputus'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Header & Main Navigation Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
            <button
              onClick={() => setActiveTab('Laporan')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'Laporan' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analitik & Laporan Omzet</span>
            </button>
            <button
              onClick={() => setActiveTab('ApprovalVoid')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 relative ${
                activeTab === 'ApprovalVoid' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Persetujuan Void</span>
              {pendingVoidList.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-bounce">
                  {pendingVoidList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('AuditTrail')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'AuditTrail' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Log Audit Sistem</span>
            </button>
            <button
              onClick={() => setActiveTab('KasShift')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'KasShift' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <RupiahIcon className="w-3.5 h-3.5" />
              <span>Rekap Kas Shift</span>
            </button>
          </div>
        </div>

        {/* Date Filter & Export Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs">
            <span className="text-slate-500">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent outline-none font-semibold text-slate-600"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs">
            <span className="text-slate-500">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent outline-none font-semibold text-slate-600"
            />
          </div>

          <button
            onClick={loadLaporan}
            className="bg-[#1E4648] hover:bg-[#163536] text-white font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Filter
          </button>

          {process.env.NODE_ENV !== 'production' && (
            <button
              onClick={handleRunSeeder6Bulan}
              disabled={loading}
              className="bg-[#FF9500] hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1.5 shadow-xs"
              title="Generate data sampel khusus environment development"
            >
              <Award className="w-3.5 h-3.5" /> Seeder Development
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="bg-[#1E4648] hover:bg-[#1E4648] text-white font-semibold px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1.5 shadow-xs"
            title="Ekspor Laporan ke CSV Excel"
          >
            <Download className="w-3.5 h-3.5" /> Ekspor Excel
          </button>
        </div>
      </div>

      {/* TAB 1: ANALITIK & LAPORAN */}
      {activeTab === 'Laporan' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 mb-1">Total Omzet Penjualan</div>
              <div className="text-lg font-bold text-[#1E4648]">
                Rp {(ringkasan?.totalOmzet || 0).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 mb-1">Jumlah Transaksi Nota</div>
              <div className="text-lg font-bold text-slate-600">
                {ringkasan.jumlahTransaksi} <span className="text-xs font-normal text-slate-400">nota</span>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 mb-1">Rata-rata Nilai Nota</div>
              <div className="text-lg font-bold text-slate-600">
                Rp {(ringkasan?.rataRata || 0).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
              <div className="text-[11px] font-medium text-slate-500 mb-1">Self vs Full Service</div>
              <div className="text-sm font-bold text-slate-600 flex items-center gap-2 mt-1">
                <span className="text-[#1E4648]">{ringkasan.selfCount} Self</span>
                <span className="text-slate-300">•</span>
                <span className="text-[#FF9500]">{ringkasan.fullCount} Full</span>
              </div>
            </div>
          </div>

          {/* Visual Analytics Chart Widget */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#1E4648]" />
              <span>Grafik Visual Tren Omzet Harian</span>
            </h3>

            {omzetHarian.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-8">Tidak ada data tren harian untuk periode terpilih</div>
            ) : (
              <div className="space-y-2 pt-2">
                {omzetHarian.map((item, idx) => {
                  const pct = Math.round((item.omzet / maxOmzetHarian) * 100);
                  return (
                    <div key={idx} className="flex items-center gap-3 text-xs">
                      <div className="w-24 text-slate-600 font-semibold shrink-0">{item.tanggal}</div>
                      <div className="flex-1 bg-slate-100 h-5 rounded-md overflow-hidden relative">
                        <div 
                          className="bg-[#1E4648] h-full rounded-md transition-all duration-500" 
                          ref={(el) => {
                            if (el) el.style.width = `${Math.max(pct, 5)}%`;
                          }} 
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow-xs">
                          Rp {(item?.omzet || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="w-16 text-right font-medium text-slate-500 shrink-0">{item.jumlahTransaksi} nota</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Omzet Harian Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-600">
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
                    {loading ? (
                      Array.from({ length: 3 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse">
                          <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                          <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                          <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24 ml-auto" /></td>
                        </tr>
                      ))
                    ) : omzetHarian.length === 0 ? (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-400">Tidak ada data omzet</td></tr>
                    ) : (
                      omzetHarian.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-4 font-semibold text-slate-600">{row.tanggal}</td>
                          <td className="py-2.5 px-4 text-slate-600">{row.jumlahTransaksi} transaksi</td>
                          <td className="py-2.5 px-4 text-right font-bold text-[#1E4648]">Rp {(row?.omzet || 0).toLocaleString('id-ID')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Top Layanan */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-600 flex items-center justify-between">
                <span>Peringkat Layanan Terlaris</span>
                <Award className="w-4 h-4 text-[#FF9500]" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Nama Layanan</th>
                      <th className="py-2.5 px-4 text-center">Volume (Qty)</th>
                      <th className="py-2.5 px-4 text-right">Total Omzet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      Array.from({ length: 3 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse">
                          <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                          <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-12 mx-auto" /></td>
                          <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24 ml-auto" /></td>
                        </tr>
                      ))
                    ) : layananTerlaris.length === 0 ? (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-400">Belum ada data penjualan layanan</td></tr>
                    ) : (
                      layananTerlaris.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-4 font-semibold text-slate-600">{row.layanan}</td>
                          <td className="py-2.5 px-4 text-center font-bold text-slate-700">{row.qty}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-[#1E4648]">Rp {(row?.omzet || 0).toLocaleString('id-ID')}</td>
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

      {/* TAB 2: APPROVAL VOID & RETUR (FR-BE-17, FR-BE-18) */}
      {activeTab === 'ApprovalVoid' && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Persetujuan Void & Retur Transaksi</span>
              </h3>
              <p className="text-xs text-slate-500">Permohonan pembatalan transaksi dari Staf Kasir membutuhkan verifikasi Manager/Owner.</p>
            </div>
            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1 rounded-full">
              {pendingVoidList.length} Permohonan Pending
            </span>
          </div>

          {pendingVoidList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">Tidak ada permohonan void pending</p>
              <p className="text-[11px] text-slate-400">Seluruh transaksi berjalan normal tanpa pengajuan pembatalan.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingVoidList.map((tx) => (
                <div key={tx.noNota} className="p-4 border border-rose-200 rounded-lg bg-rose-50/40 flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-600 text-sm">{tx.noNota}</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded">Pengajuan Void</span>
                    </div>
                    <p className="text-slate-600">Pelanggan: <span className="font-semibold text-slate-600">{tx.namaPelanggan}</span> ({tx.noHp || '-'})</p>
                    <p className="text-slate-600">Total Nominal: <span className="font-bold text-rose-700">Rp {(tx?.total || 0).toLocaleString('id-ID')}</span></p>
                    <p className="text-slate-500 italic">Alasan Void: "{tx.alasanVoid || 'Pembatalan transaksi kasir'}"</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveVoid(tx.noNota, false)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4 text-rose-500" /> Tolak Void
                    </button>
                    <button
                      onClick={() => handleApproveVoid(tx.noNota, true)}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle className="w-4 h-4" /> Setujui Pembatalan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL LOG SYSTEM (FR-BE-04) */}
      {activeTab === 'AuditTrail' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-600 flex items-center gap-2">
            <History className="w-4 h-4 text-[#1E4648]" />
            <span>Jejak Rekam Aktivitas (Audit Trail Log)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Waktu</th>
                  <th className="py-2.5 px-4">Pengguna</th>
                  <th className="py-2.5 px-4">Aktivitas</th>
                  <th className="py-2.5 px-4">Referensi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400">Belum ada entri log audit recorded</td></tr>
                ) : (
                  auditLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 text-slate-500">{log.waktu}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-600">{log.namaUser}</td>
                      <td className="py-2.5 px-4 text-slate-700">{log.jenisAktivitas}</td>
                      <td className="py-2.5 px-4 text-slate-500">{log.referensi || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REKAP KAS SHIFT */}
      {activeTab === 'KasShift' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-600 flex items-center gap-2">
            <RupiahIcon className="w-4 h-4 text-[#1E4648]" />
            <span>Rekap Tutup Kasir (Kas Shift)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Waktu Buka / Tutup</th>
                  <th className="py-2.5 px-4">Kasir</th>
                  <th className="py-2.5 px-4 text-right">Kas Awal</th>
                  <th className="py-2.5 px-4 text-right">Kas Akhir Fisik</th>
                  <th className="py-2.5 px-4 text-right">Selisih</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kasShiftList.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">Belum ada data shift kasir</td></tr>
                ) : (
                  kasShiftList.map((shift, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4">
                        <div className="text-slate-600 font-semibold">{shift.waktuBuka}</div>
                        <div className="text-slate-400 text-[10px]">{shift.waktuTutup || 'Belum ditutup'}</div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-600">{shift.namaKasir}</td>
                      <td className="py-2.5 px-4 text-right text-slate-600">Rp {(shift.kasAwal || 0).toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-4 text-right text-slate-600">Rp {(shift.kasAkhirFisik || 0).toLocaleString('id-ID')}</td>
                      <td className="py-2.5 px-4 text-right font-bold">
                        <span className={shift.selisihKas === 0 ? 'text-emerald-600' : shift.selisihKas > 0 ? 'text-amber-600' : 'text-rose-600'}>
                          {shift.selisihKas > 0 ? '+' : ''}{shift.selisihKas.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          shift.status === 'Aktif' ? 'bg-[#1E4648] text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {shift.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
