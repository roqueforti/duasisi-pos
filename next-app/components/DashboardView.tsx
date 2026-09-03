'use client';

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Clock, 
  AlertTriangle, 
  Cpu, 
  WashingMachine, 
  Flame, 
  Package, 
  TrendingUp, 
  Users, 
  BarChart3, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  Lock, 
  Calendar, 
  ChevronRight, 
  RefreshCw, 
  Plus, 
  Zap,
  Activity,
  Layers,
  Sparkles,
  Lightbulb,
  X
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { UserRole } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { useDialog } from '@/components/DialogProvider';
import { parseDecimal, formatDecimal } from '@/lib/utils';

interface DashboardViewProps {
  currentRole: UserRole;
}

interface TransaksiItem {
  noNota: string;
  tanggal: string;
  namaPelanggan: string;
  noHp: string;
  total: number;
  status: string;
  estimasi: string;
  petugas: string;
  tipe: string;
  items: { layanan: string; qty: number; subtotal: number }[];
}

interface MesinItem {
  id: string;
  nama: string;
  tipe: 'Washer' | 'Dryer';
  status: 'Kosong' | 'Digunakan' | 'Maintenance';
  keterangan: string;
  mulaiPakai: string;
  estimasiSelesai: string;
}

interface InventoryItem {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
  stokMinimum: number;
  terakhirUpdate?: string;
}

interface PelangganItem {
  noHp: string;
  maskedHp: string;
  nama: string;
  totalOrder: number;
  totalSpend: number;
  terakhirOrder?: string;
}

interface KinerjaPegawai {
  id: string;
  nama: string;
  jabatan: string;
  totalTransaksi: number;
  totalOmzet: number;
}

export default function DashboardView({ currentRole }: DashboardViewProps) {
  const { showAlert } = useDialog();
  const isManager = currentRole === 'MANAGER';
  const [loading, setLoading] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'month'>('7d');

  // Shared Operational States
  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [mesinList, setMesinList] = useState<MesinItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [pelangganList, setPelangganList] = useState<PelangganItem[]>([]);

  // Manager Financial & Analytics States (Guarded)
  const [laporanSummary, setLaporanSummary] = useState<any>(null);
  const [omzetHarian, setOmzetHarian] = useState<{ tanggal: string; omzet: number; jumlahTransaksi: number }[]>([]);
  const [layananTerlaris, setLayananTerlaris] = useState<{ layanan: string; qty: number; omzet: number }[]>([]);
  const [kinerjaStaff, setKinerjaStaff] = useState<KinerjaPegawai[]>([]);

  // Inventory Quick Restock Modal (Manager only)
  const [selectedRestockItem, setSelectedRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<string>('5');
  const [showRestockAnalysisModal, setShowRestockAnalysisModal] = useState<boolean>(false);

  // Kasir Shift Info
  const [kasShiftInfo, setKasShiftInfo] = useState<{ kasAwal?: number; waktuBuka?: string; status?: string } | null>(null);
  const fetchDashboardData = async () => {
    setLoading(true);

    // Fetch dengan cache — render instan dari cache, fresh di background
    runBackendCached<TransaksiItem[]>('getTransaksiList', (txs) => { if (Array.isArray(txs)) setTransaksiList(txs); }, 2 * 60 * 1000, 'Semua');
    runBackendCached<MesinItem[]>('getMesinList', (msn) => { if (Array.isArray(msn)) setMesinList(msn); }, 3 * 60 * 1000);
    runBackendCached<InventoryItem[]>('getInventoryList', (inv) => { if (Array.isArray(inv)) setInventoryList(inv); }, 5 * 60 * 1000);
    runBackendCached<PelangganItem[]>('getDaftarPelanggan', (cust) => { if (Array.isArray(cust)) setPelangganList(cust); }, 5 * 60 * 1000);

    if (isManager) {
      const todayStr = new Date().toISOString().split('T')[0];
      const past7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      runBackend('getLaporanRange', past7Days, todayStr)
        .then((lapRes) => {
          if (lapRes) {
            setLaporanSummary(lapRes.ringkasan);
            if (Array.isArray(lapRes.omzetHarian)) setOmzetHarian(lapRes.omzetHarian);
            if (Array.isArray(lapRes.layananTerlaris)) setLayananTerlaris(lapRes.layananTerlaris);
          }
        })
        .catch(() => {});

      runBackendCached<KinerjaPegawai[]>('getRekapKinerjaPegawai', (kin) => { if (Array.isArray(kin)) setKinerjaStaff(kin); }, 10 * 60 * 1000);
    } else {
      // Kasir: fetch active shift info
      runBackend<any>('getKasShiftAktif', 'OUTLET-UTAMA')
        .then((shift) => {
          if (shift && shift.status === 'Aktif') {
            setKasShiftInfo({ kasAwal: shift.kasAwal, waktuBuka: shift.waktuBuka, status: 'Aktif' });
          } else {
            setKasShiftInfo(null);
          }
        })
        .catch(() => {});
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentRole, isManager]);

  // Section 1: Metrics Calculations
  const todayStrFmt = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const txTodayList = transaksiList?.filter(t => t.tanggal && t.tanggal.includes(todayStrFmt.slice(0, 5))) || [];
  
  const totalOrderHariIni = txTodayList.length > 0 ? txTodayList.length : (transaksiList?.slice(0, 5).length || 0);
  const omzetHariIni = txTodayList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  
  const activeOrders = transaksiList?.filter(t => t.status !== 'Selesai' && t.status !== 'Batal') || [];
  const readyPickupOrders = transaksiList?.filter(t => t.status === 'Siap Ambil') || [];
  
  const lowStockItems = inventoryList?.filter(i => i.stok <= i.stokMinimum) || [];
  const maintenanceMachines = mesinList?.filter(m => m.status === 'Maintenance') || [];

  // Dynamic Restock Recommendation Engine
  const restockRecommendations = React.useMemo(() => {
    return inventoryList.map(item => {
      const { stok, stokMinimum, satuan, nama } = item;
      const minVal = Number(stokMinimum) || 5;
      const sVal = Number(stok) || 0;
      
      let status: 'HABIS' | 'MENIPIS' | 'WASPADA' | 'AMAN' = 'AMAN';
      let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      let rekomendasiQty = 0;
      let alasan = '';

      if (sVal <= 0) {
        status = 'HABIS';
        badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
        rekomendasiQty = Math.max(minVal * 2, 10);
        alasan = `Stok kosong total! Segera restock minimal ${rekomendasiQty} ${satuan} agar proses pengerjaan laundry tidak tertunda.`;
      } else if (sVal <= minVal) {
        status = 'MENIPIS';
        badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
        rekomendasiQty = Math.max((minVal * 2) - sVal, minVal);
        alasan = `Stok (${sVal} ${satuan}) berada di bawah batas aman minimum (${minVal} ${satuan}). Disarankan order tambahan ${rekomendasiQty} ${satuan}.`;
      } else if (sVal <= minVal * 1.5) {
        status = 'WASPADA';
        badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
        rekomendasiQty = minVal;
        alasan = `Stok (${sVal} ${satuan}) mendekati batas ambang minimum. Siapkan rencana restock sekitar ${rekomendasiQty} ${satuan}.`;
      } else {
        status = 'AMAN';
        badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        rekomendasiQty = 0;
        alasan = `Kapasitas stok aman (${sVal} ${satuan}). Tidak memerlukan restock dalam waktu dekat.`;
      }

      return {
        ...item,
        status,
        badgeColor,
        rekomendasiQty,
        alasan
      };
    }).sort((a, b) => {
      const priority = { HABIS: 0, MENIPIS: 1, WASPADA: 2, AMAN: 3 };
      return priority[a.status] - priority[b.status];
    });
  }, [inventoryList]);

  // Inventory Quick Restock Submit
  const handleRestockSubmit = async () => {
    if (!selectedRestockItem) return;
    const delta = parseDecimal(restockQty, 0);
    if (delta <= 0) {
      await showAlert('Masukkan jumlah stok valid!', 'warning');
      return;
    }
    try {
      await runBackend('updateStokInventory', selectedRestockItem.id, delta);
      await showAlert(`Berhasil menambah stok +${delta} ${selectedRestockItem.satuan} untuk ${selectedRestockItem.nama}`, 'success');
      setSelectedRestockItem(null);
      fetchDashboardData();
    } catch {
      await showAlert('Gagal memperbarui stok inventory', 'error');
    }
  };

  return (
    <div className="p-2.5 sm:p-3.5 md:p-4 space-y-3 sm:space-y-4 max-w-7xl mx-auto text-slate-600">
      
      {/* PAGE HEADER: ADAPTIVE ROLE BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#1E4648] text-[#B5C9C9] flex items-center justify-center shadow-xs shrink-0">
            <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-700 leading-tight">Dashboard Utama</h1>
              <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase ${
                isManager ? 'bg-[#FF9500]/15 text-[#FF9500] border border-[#FF9500]/50' : 'bg-[#B5C9C9]/30 text-[#1E4648] border border-[#B5C9C9]'
              }`}>
                {isManager ? 'Owner / Manager Mode' : 'Kasir / Staff Mode'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Monitoring operasional real-time & indikator bisnis dua SiSi Laundry</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      {/* SECTION 1 — RINGKASAN CEPAT (ALL ROLES - 4 SEJAJAR SEJAK TABLET MD) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Metric 1: Order Today */}
        <div className="glass-card card-hover-lift p-3.5 sm:p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-800 to-teal-950 text-teal-300 flex items-center justify-center font-bold shrink-0 shadow-xs border border-teal-700/40">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Order Hari Ini</div>
            <div className="text-base sm:text-lg font-black text-slate-900 truncate">{totalOrderHariIni} Transaksi</div>
          </div>
        </div>

        {/* Metric 2: Omzet Today */}
        <div className="glass-card card-hover-lift p-3.5 sm:p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-800 to-teal-950 text-teal-300 flex items-center justify-center font-bold shrink-0 shadow-xs border border-teal-700/40">
            <RupiahIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Omzet Hari Ini</div>
            <div className="text-base sm:text-lg font-black text-slate-900 truncate">Rp {(omzetHariIni || 0).toLocaleString('id-ID')}</div>
          </div>
        </div>

        {/* Metric 3: Active In-Progress Orders */}
        <div className="glass-card card-hover-lift p-3.5 sm:p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 flex items-center justify-center font-bold shrink-0 shadow-xs border border-amber-400/40">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Order Aktif</div>
            <div className="text-base sm:text-lg font-black text-slate-900 truncate">{activeOrders.length} Order</div>
            <div className="text-[10px] text-amber-600 font-extrabold truncate">{readyPickupOrders.length} Siap Diambil</div>
          </div>
        </div>

        {/* Metric 4: System Alerts Status */}
        <div className="glass-card card-hover-lift p-3.5 sm:p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-xs ${
            lowStockItems.length > 0 || maintenanceMachines.length > 0 
              ? 'bg-gradient-to-br from-rose-500 to-rose-700 text-rose-100 border border-rose-400/40' 
              : 'bg-gradient-to-br from-emerald-600 to-teal-900 text-emerald-100 border border-emerald-500/40'
          }`}>
            {lowStockItems.length > 0 || maintenanceMachines.length > 0 ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Alert Sistem</div>
            <div className={`text-base sm:text-lg font-black truncate ${
              lowStockItems.length > 0 || maintenanceMachines.length > 0 
                ? 'text-rose-600' 
                : 'text-emerald-700'
            }`}>
              {lowStockItems.length > 0 || maintenanceMachines.length > 0 ? (
                <span>{lowStockItems.length + maintenanceMachines.length} Warning</span>
              ) : (
                <span>Semua Optimal</span>
              )}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-500 font-semibold truncate">
              {lowStockItems.length} Stok • {maintenanceMachines.length} Mesin
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — OPERASIONAL REAL-TIME (ALL ROLES - 2 COLS UNTUK MESIN, 1 COL ANTREAN DI TABLET) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        
        {/* Widget 1: Machine Status Progress */}
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#B5C9C9]/20 text-[#1E4648] flex items-center justify-center shrink-0">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-700">Status & Progress Mesin Real-time</h2>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              {mesinList.filter(m => m.status === 'Digunakan').length} / {mesinList.length} Digunakan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
            {mesinList.map((m) => {
              const isUsed = m.status === 'Digunakan';
              const isMaint = m.status === 'Maintenance';
              return (
                <div 
                  key={m.id}
                  className={`p-2.5 sm:p-3 rounded-lg border transition ${
                    isMaint ? 'bg-rose-50/70 border-rose-200' :
                    isUsed ? 'bg-[#B5C9C9]/20/70 border-[#B5C9C9]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {m.tipe === 'Washer' ? (
                        <WashingMachine className="w-3.5 h-3.5 text-[#1E4648]" />
                      ) : (
                        <Flame className="w-3.5 h-3.5 text-[#FF9500]" />
                      )}
                      <span className="font-bold text-xs text-slate-700">{m.nama}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      isMaint ? 'bg-rose-100 text-rose-800' :
                      isUsed ? 'bg-[#B5C9C9]/30 text-[#1E4648]' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  {isUsed ? (
                    <div className="space-y-1 text-[10px] sm:text-[11px]">
                      <div className="text-slate-600 truncate">Customer/Ket: {m.keterangan || 'Proses Cuci/Dry'}</div>
                      <div className="flex justify-between text-slate-500 font-semibold">
                        <span>Mulai: {m.mulaiPakai || '-'}</span>
                        <span className="text-[#1E4648] font-bold">Est: {m.estimasiSelesai || '-'}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#1E4648] h-full w-3/4 rounded-full animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium py-0.5">
                      {isMaint ? 'Sedang perbaikan servis' : 'Mesin Siap Digunakan'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Widget 2: Queue & Ready for Pickup List */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-700">Antrian & Siap Di-pickup</h2>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeOrders.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs font-medium">Tidak ada antrian aktif</div>
              ) : (
                activeOrders.slice(0, 6).map((tx) => (
                  <div key={tx.noNota} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <div className="font-mono font-bold text-[#1E4648] text-[11px]">{tx.noNota}</div>
                      <div className="font-bold text-slate-600 text-[11px]">{tx.namaPelanggan}</div>
                      <div className="text-[10px] text-slate-500">Est: {tx.estimasi || '-'}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase ${
                      tx.status === 'Siap Ambil' ? 'bg-[#FF9500]/15 text-[#FF9500] border border-[#FF9500]/50' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
            Diurutkan berdasarkan estimasi selesai terdekat
          </div>
        </div>
      </div>

      {/* SECTION 3 — PENJUALAN & KEUANGAN (ROLES: MANAGER ONLY) */}
      {isManager ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#B5C9C9]/20 text-[#1E4648] flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-slate-700">Analisis Penjualan & Keuangan</h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Tren omzet, kategori layanan, & distribusi metode bayar</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400">Periode:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-lg gap-1 text-xs font-bold">
                <button
                  onClick={() => setDateRange('7d')}
                  className={`px-2 py-1 rounded-md text-[11px] transition ${dateRange === '7d' ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600'}`}
                >
                  7 Hari
                </button>
                <button
                  onClick={() => setDateRange('30d')}
                  className={`px-2 py-1 rounded-md text-[11px] transition ${dateRange === '30d' ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600'}`}
                >
                  30 Hari
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Revenue Trend Visual Bar Chart Representation */}
            <div className="md:col-span-2 space-y-2">
              <div className="text-xs font-bold text-slate-700 flex justify-between items-center">
                <span>Grafik Tren Omzet Harian (Rp)</span>
                <span className="text-[#1E4648] font-bold">Total: Rp {(omzetHariIni || 0).toLocaleString('id-ID')}</span>
              </div>
              
              <div className="bg-slate-900 text-white rounded-xl p-3 space-y-2 shadow-inner">
                <div className="flex justify-between items-end h-28 pt-2 px-1 border-b border-slate-800 gap-1.5">
                  {omzetHarian.length > 0 ? (
                    omzetHarian.slice(-7).map((d, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                        <div 
                          style={{ height: `${Math.min(100, Math.max(15, (d.omzet / 100000) * 100))}%` }} 
                          className="w-full bg-emerald-400 hover:bg-emerald-300 rounded-t transition" 
                        />
                        <span className="text-[9px] text-slate-400 font-mono truncate">{d.tanggal.slice(-5)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="w-full text-center text-slate-500 my-auto text-xs">Memuat grafik omzet...</div>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 text-center">
                  Omzet stabil dengan performa transaksi harian
                </div>
              </div>
            </div>

            {/* Top Services & Payment Breakdown */}
            <div className="space-y-2 text-xs">
              <div className="font-bold text-slate-700">Breakdown Layanan Terlaris</div>
              <div className="space-y-1.5">
                {layananTerlaris.length === 0 ? (
                  <div className="text-slate-400 text-center py-4">Belum ada data layanan</div>
                ) : (
                  layananTerlaris.slice(0, 4).map((l, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-600 text-[11px]">{l.layanan}</div>
                        <div className="text-[9px] text-slate-400">{l.qty} Transaksi</div>
                      </div>
                      <span className="font-bold text-[#1E4648] text-xs">Rp {(l?.omzet || 0).toLocaleString('id-ID')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SAFE FRONTIER GUARD FOR KASIR / STAFF ROLE */
        <div className="bg-slate-100/80 border border-dashed border-slate-200 rounded-xl p-3.5 text-center text-slate-500 space-y-1">
          <div className="flex justify-center text-slate-400 mb-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div className="font-bold text-xs text-slate-700">Section Penjualan & Laporan Keuangan Di-restrict</div>
          <p className="text-[10px] text-slate-400">Section keuangan khusus untuk akun Manager / Owner.</p>
        </div>
      )}

      {/* SECTION 4 — PELANGGAN INSIGHTS (ROLES: MANAGER ONLY) */}
      {isManager && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#B5C9C9]/20 text-[#1E4648] flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-700">Insight Pelanggan & Repeat Order</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Top pelanggan loyal & distribusi transaksi</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Top Customer Table */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-700 text-xs">Pelanggan Teratas (Highest Spend)</div>
              <div className="space-y-1.5">
                {pelangganList.slice(0, 4).map((c) => (
                  <div key={c.noHp} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-700 text-[11px]">{c.nama}</div>
                      <div className="text-[9px] text-slate-400">{c.noHp} • {c.totalOrder} Order</div>
                    </div>
                    <span className="font-bold text-[#1E4648] text-xs">Rp {(c?.totalSpend || 0).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Repeat Order Ratio */}
            <div className="p-3.5 bg-[#1E4648] text-white rounded-xl flex flex-col justify-between">
              <div>
                <div className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Rasio Member / Repeat Order</div>
                <div className="text-xl sm:text-2xl font-bold text-[#FF9500] mt-0.5">
                  {pelangganList.length > 0 ? Math.round((pelangganList.filter(p => p.totalOrder > 1).length / pelangganList.length) * 100) : 0}%
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-300 mt-1">
                  Pelanggan yang sudah pernah melakukan lebih dari 1 transaksi laundry.
                </p>
              </div>
              <div className="text-[9px] text-slate-400 pt-2 border-t border-slate-700/80">
                Terakumulasi otomatis di Sheet Pelanggan
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5 — INVENTORY & MESIN LEVEL (ALL ROLES, DIFFERENT PERMISSIONS) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#B5C9C9]/20 text-[#1E4648] flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-700">Level Stok Bahan Habis Pakai</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                {isManager ? 'Owner / Manager Mode: Lihat & Input Restock' : 'Kasir Mode: Laporan View Only'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowRestockAnalysisModal(true)}
              className="px-2.5 py-1 bg-linear-to-r from-[#1E4648] to-[#2A5C5E] hover:from-[#163536] hover:to-[#1E4648] text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition"
            >
              <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
              <span>Rekomendasi Restock</span>
            </button>
            {!isManager && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                <span>View Only</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
          {inventoryList.map((i) => {
            const isCritical = i.stok <= i.stokMinimum;
            const isLow = i.stok <= i.stokMinimum * 1.5;
            return (
              <div 
                key={i.id}
                className={`p-2.5 sm:p-3 rounded-lg border text-xs space-y-1.5 ${
                  isCritical ? 'bg-rose-50/80 border-rose-300' :
                  isLow ? 'bg-[#FF9500]/10/80 border-[#FF9500]/50' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-700 text-xs truncate max-w-[130px]">{i.nama}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                    isCritical ? 'bg-rose-100 text-rose-800' :
                    isLow ? 'bg-[#FF9500]/15 text-[#FF9500]' : 'bg-[#B5C9C9]/30 text-[#1E4648]'
                  }`}>
                    {isCritical ? 'Menipis' : 'Stok Aman'}
                  </span>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-base font-bold text-slate-700">{formatDecimal(i.stok)}</span>
                    <span className="text-slate-500 font-semibold text-[11px] ml-1">{i.satuan}</span>
                  </div>
                  
                  {isManager && (
                    <button
                      onClick={() => {
                        setSelectedRestockItem(i);
                        setRestockQty('10');
                      }}
                      className="px-2 py-0.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded text-[10px] flex items-center gap-1 transition"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      <span>Restock</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 6 — STAFF & SHIFT (ADAPTIVE PERMISSION) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#B5C9C9]/20 text-[#1E4648] flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-700">Rekap Shift & Kinerja Staf</h2>
          </div>
        </div>

        {isManager ? (
          /* MANAGER VIEW: ALL STAFF PERFORMANCE TABLE */
          <div className="space-y-2 text-xs">
            <div className="text-slate-600 font-bold">Kinerja Seluruh Staf Kasir / Operator</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] sm:text-[10px]">
                    <th className="py-2 px-3">Nama Staf</th>
                    <th className="py-2 px-3">Jabatan</th>
                    <th className="py-2 px-3 text-center">Total Order</th>
                    <th className="py-2 px-3 text-right">Total Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {kinerjaStaff.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-700">{p.nama}</td>
                      <td className="py-2 px-3 text-slate-500">{p.jabatan || 'Kasir/Operator'}</td>
                      <td className="py-2 px-3 text-center">{p.totalTransaksi} Order</td>
                      <td className="py-2 px-3 text-right font-bold text-[#1E4648]">Rp {(p?.totalOmzet || 0).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* KASIR VIEW: PERSONAL SHIFT SUMMARY CARD */
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div>
              <div className="font-bold text-slate-700 text-xs">
                {kasShiftInfo ? `Sesi Shift Aktif — Dibuka: ${kasShiftInfo.waktuBuka || '-'}` : 'Belum ada shift aktif'}
              </div>
              <div className="text-[11px] text-slate-500">
                {kasShiftInfo ? `Modal Kas Awal: Rp ${(kasShiftInfo.kasAwal || 0).toLocaleString('id-ID')}` : 'Silakan buka shift dari layar POS Kasir.'}
              </div>
            </div>
            <span className={`px-2.5 py-1 font-bold rounded-lg text-xs ${
              kasShiftInfo ? 'bg-[#B5C9C9]/30 text-[#1E4648]' : 'bg-slate-200 text-slate-500'
            }`}>
              {kasShiftInfo ? 'Shift Berlangsung Aktif' : 'Belum Buka Shift'}
            </span>
          </div>
        )}
      </div>

      {/* QUICK RESTOCK MODAL (MANAGER ONLY) */}
      {selectedRestockItem && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm border border-slate-100 shadow-lg space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-700">Input Restock Stok Inventory</h3>
              <button onClick={() => setSelectedRestockItem(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="text-xs space-y-2">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Nama Barang</label>
                <input type="text" readOnly value={selectedRestockItem.nama} className="w-full px-3 py-2 bg-slate-100 rounded-lg font-bold text-slate-600" />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Jumlah Tambahan Stok ({selectedRestockItem.satuan})</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setSelectedRestockItem(null)} className="px-3 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg text-xs">Batal</button>
              <button onClick={handleRestockSubmit} className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2 rounded-lg text-xs">Simpan Stok Baru</button>
            </div>
          </div>
        </div>
      )}

      {/* SMART RESTOCK RECOMMENDATION MODAL (DASHBOARD) */}
      {showRestockAnalysisModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-2xl shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1E4648] text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">Sistem Rekomendasi Restock & Pengadaan Bahan</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400">Analisis rasio stok riil terhadap batas ambang minimum operasional</p>
                </div>
              </div>
              <button onClick={() => setShowRestockAnalysisModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              {restockRecommendations.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p>Belum ada data bahan inventory di sistem.</p>
                </div>
              ) : (
                restockRecommendations.map((item) => (
                  <div key={item.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 hover:border-[#1E4648]/40 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{item.nama}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${item.badgeColor}`}>
                          {item.status === 'HABIS' ? 'Kritis (Habis)' : item.status === 'MENIPIS' ? 'Perlu Restock' : item.status === 'WASPADA' ? 'Waspada' : 'Stok Aman'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        Sisa: <span className="text-slate-800 font-bold">{formatDecimal(item.stok)} {item.satuan}</span> | Batas Min: <span className="text-slate-800 font-bold">{formatDecimal(item.stokMinimum)} {item.satuan}</span>
                      </div>
                    </div>

                    <p className="text-slate-600 text-[11px] leading-relaxed">{item.alasan}</p>

                    {isManager && item.rekomendasiQty > 0 && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => {
                            setSelectedRestockItem(item);
                            setRestockQty(item.rekomendasiQty.toString());
                            setShowRestockAnalysisModal(false);
                          }}
                          className="px-3 py-1.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-md text-[11px] flex items-center gap-1.5 shadow-xs transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Restock Rekomendasi (+{item.rekomendasiQty} {item.satuan})</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 mt-3">
              <button onClick={() => setShowRestockAnalysisModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
