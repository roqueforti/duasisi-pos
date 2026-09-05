'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Clock, 
  AlertTriangle, 
  Cpu, 
  WashingMachine, 
  Flame, 
  Wind,
  Package, 
  TrendingUp, 
  Users, 
  BarChart3, 
  CheckCircle2, 
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
  X,
  Trophy,
  Award,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { UserRole } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { useDialog } from '@/components/DialogProvider';
import { parseDecimal, formatDecimal, eNotaUrl, parseIndonesianDateTime } from '@/lib/utils';

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
  statusVoid?: string;
  estimasi?: string;
  estimasiSelesai?: string;
  petugas: string;
  tipe: string;
  washerId?: string;
  dryerId?: string;
  items?: { layanan: string; qty: number; subtotal: number }[];
}

interface MesinItem {
  id: string;
  nama: string;
  tipe: 'Washer' | 'Dryer';
  status: 'Kosong' | 'Digunakan' | 'Maintenance';
  catatan?: string;
  namaPelanggan?: string;
  noNota?: string;
  layanan?: string;
  sisaWaktuMenit?: number;
  waktuMulai?: string;
  estimasiSelesai?: string;
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
  id?: string;
  noHp: string;
  nama: string;
  alamat?: string;
  totalOrder?: number;
  totalSpend?: number;
  isMember?: boolean;
}

interface KinerjaPegawai {
  id: string;
  nama: string;
  jabatan: string;
  totalTransaksi: number;
  totalOmzet: number;
}

// Helper: Cek apakah tanggal berada pada hari kalender yang sama
function isSameCalendarDay(dateVal?: string | null, targetDate: Date = new Date()): boolean {
  if (!dateVal) return false;
  try {
    const d = parseIndonesianDateTime(dateVal);
    if (d && !isNaN(d.getTime())) {
      return (
        d.getDate() === targetDate.getDate() &&
        d.getMonth() === targetDate.getMonth() &&
        d.getFullYear() === targetDate.getFullYear()
      );
    }
    // Fallback direct string match (e.g. YYYY-MM-DD or DD/MM/YYYY)
    const pad = (n: number) => String(n).padStart(2, '0');
    const isoPrefix = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
    const idPrefix = `${pad(targetDate.getDate())}/${pad(targetDate.getMonth() + 1)}/${targetDate.getFullYear()}`;
    const str = String(dateVal);
    if (str.includes(isoPrefix) || str.includes(idPrefix)) return true;

    return false;
  } catch {
    return false;
  }
}

// Helper: Format tanggal ramah pengguna (WIB)
function formatWibDateShort(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = parseIndonesianDateTime(dateStr) || new Date(dateStr);
    if (!d || isNaN(d.getTime())) return String(dateStr);
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const dateNum = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `${dayName}, ${dateNum}`;
  } catch {
    return String(dateStr);
  }
}

function formatWibTimeOnly(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = parseIndonesianDateTime(dateStr) || new Date(dateStr);
    if (!d || isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  } catch {
    return '';
  }
}

export default function DashboardView({ currentRole }: DashboardViewProps) {
  const { showAlert } = useDialog();
  const isManager = currentRole === 'MANAGER';
  const [loading, setLoading] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<'7d' | '30d'>('7d');

  // Operational States
  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [mesinList, setMesinList] = useState<MesinItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [pelangganList, setPelangganList] = useState<PelangganItem[]>([]);

  // Manager Financial & Analytics States
  const [laporanSummary, setLaporanSummary] = useState<any>(null);
  const [omzetHarian, setOmzetHarian] = useState<{ tanggal: string; omzet: number; jumlahTransaksi: number }[]>([]);
  const [layananTerlaris, setLayananTerlaris] = useState<{ layanan: string; qty: number; omzet: number }[]>([]);
  const [kinerjaStaff, setKinerjaStaff] = useState<KinerjaPegawai[]>([]);

  // Inventory Quick Restock Modal (Manager only)
  const [selectedRestockItem, setSelectedRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<string>('5');
  const [showRestockAnalysisModal, setShowRestockAnalysisModal] = useState<boolean>(false);
  const [inventoryFilterTab, setInventoryFilterTab] = useState<'Semua' | 'Kritis' | 'Menipis' | 'Aman'>('Semua');

  // Queue View Tab
  const [queueTab, setQueueTab] = useState<'Semua' | 'SiapDiambil'>('Semua');

  // Kasir Shift Info
  const [kasShiftInfo, setKasShiftInfo] = useState<{ kasAwal?: number; waktuBuka?: string; status?: string } | null>(null);

  const fetchDashboardData = useCallback(async (rangeOverride?: '7d' | '30d') => {
    setLoading(true);
    const activeRange = rangeOverride || dateRange;

    // Fetch dengan cache — instan dari cache & fresh di background
    runBackendCached<TransaksiItem[]>('getTransaksiList', (txs) => { 
      if (Array.isArray(txs)) setTransaksiList(txs); 
    }, 2 * 60 * 1000, 'Semua');

    runBackendCached<MesinItem[]>('getMesinList', (msn) => { 
      if (Array.isArray(msn)) setMesinList(msn); 
    }, 1 * 60 * 1000);

    runBackendCached<InventoryItem[]>('getInventoryList', (inv) => { 
      if (Array.isArray(inv)) setInventoryList(inv); 
    }, 3 * 60 * 1000);

    runBackendCached<PelangganItem[]>('getDaftarPelanggan', (cust) => { 
      if (Array.isArray(cust)) setPelangganList(cust); 
    }, 5 * 60 * 1000);

    if (isManager) {
      const daysCount = activeRange === '30d' ? 30 : 7;
      const todayStr = new Date().toISOString().split('T')[0];
      const pastDays = new Date(Date.now() - daysCount * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      runBackend('getLaporanRange', pastDays, todayStr)
        .then((lapRes: any) => {
          if (lapRes) {
            setLaporanSummary(lapRes.ringkasan);
            if (Array.isArray(lapRes.omzetHarian)) setOmzetHarian(lapRes.omzetHarian);
            if (Array.isArray(lapRes.layananTerlaris)) setLayananTerlaris(lapRes.layananTerlaris);
          }
        })
        .catch(() => {});

      runBackendCached<KinerjaPegawai[]>('getRekapKinerjaPegawai', (kin) => { 
        if (Array.isArray(kin)) setKinerjaStaff(kin); 
      }, 5 * 60 * 1000);
    } else {
      // Kasir: fetch active shift info
      runBackend<any>('getKasShiftAktif', 'OUTLET-UTAMA')
        .then((shift) => {
          if (shift && (shift.status === 'Aktif' || shift.status === 'Buka')) {
            setKasShiftInfo({ kasAwal: shift.kasAwal, waktuBuka: shift.waktuBuka, status: 'Aktif' });
          } else {
            setKasShiftInfo(null);
          }
        })
        .catch(() => {});
    }

    setLoading(false);
  }, [dateRange, isManager]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRangeChange = (range: '7d' | '30d') => {
    setDateRange(range);
    fetchDashboardData(range);
  };

  // =========================================================================
  // 1. DATA PERHITUNGAN METRIK RIIL (AKURAT DARI TRANSAKSI SUPABASE)
  // =========================================================================
  const txTodayList = useMemo(() => {
    return (transaksiList || []).filter(t => {
      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      if (isVoid) return false;
      return isSameCalendarDay(t.tanggal);
    });
  }, [transaksiList]);

  const totalOrderHariIni = txTodayList.length;
  const omzetHariIni = useMemo(() => {
    return txTodayList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  }, [txTodayList]);

  // Antrean Aktif (Menghapus transaksi selesai, void, dan dibatalkan)
  const activeOrders = useMemo(() => {
    return (transaksiList || []).filter(t => {
      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      const isSelesai = t.status === 'Selesai';
      return !isVoid && !isSelesai;
    });
  }, [transaksiList]);

  // Siap Diambil di Rak
  const readyPickupOrders = useMemo(() => {
    return (transaksiList || []).filter(t => {
      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      if (isVoid) return false;
      const s = (t.status || '').trim().toLowerCase();
      return s === 'siap diambil' || s === 'siap ambil';
    });
  }, [transaksiList]);

  // Alert Inventaris & Mesin
  const criticalStockItems = useMemo(() => {
    return (inventoryList || []).filter(i => Number(i.stok) <= Number(i.stokMinimum));
  }, [inventoryList]);

  const minusStockItems = useMemo(() => {
    return (inventoryList || []).filter(i => Number(i.stok) < 0);
  }, [inventoryList]);

  const maintenanceMachines = useMemo(() => {
    return (mesinList || []).filter(m => m.status === 'Maintenance');
  }, [mesinList]);

  // =========================================================================
  // 2. INSIGHT TOP PELANGGAN & RASIO REPEAT ORDER RIIL
  // =========================================================================
  const customerAnalytics = useMemo(() => {
    const customerMap: Record<string, {
      nama: string;
      noHp: string;
      totalOrder: number;
      totalSpend: number;
      isMember: boolean;
      terakhirOrder?: string;
    }> = {};

    // 1. Seed dari master pelanggan
    (pelangganList || []).forEach(p => {
      const key = (p.noHp || p.nama || '').trim();
      if (!key) return;
      customerMap[key] = {
        nama: p.nama || 'Pelanggan',
        noHp: p.noHp || '',
        totalOrder: Number(p.totalOrder) || 0,
        totalSpend: Number(p.totalSpend) || 0,
        isMember: Boolean(p.isMember),
      };
    });

    // 2. Agregasi riil dari transaksi non-void
    (transaksiList || []).forEach(t => {
      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      if (isVoid) return;
      const key = (t.noHp || t.namaPelanggan || '').trim();
      if (!key) return;

      if (!customerMap[key]) {
        customerMap[key] = {
          nama: t.namaPelanggan || 'Pelanggan',
          noHp: t.noHp || '',
          totalOrder: 0,
          totalSpend: 0,
          isMember: false,
          terakhirOrder: t.tanggal
        };
      }

      customerMap[key].totalOrder += 1;
      customerMap[key].totalSpend += Number(t.total) || 0;
      if (!customerMap[key].terakhirOrder || t.tanggal > customerMap[key].terakhirOrder!) {
        customerMap[key].terakhirOrder = t.tanggal;
      }
    });

    const allCustomers = Object.values(customerMap);
    const sortedBySpend = [...allCustomers].sort((a, b) => b.totalSpend - a.totalSpend);
    const repeatCustomerCount = allCustomers.filter(c => c.totalOrder > 1).length;
    const repeatRatio = allCustomers.length > 0 ? Math.round((repeatCustomerCount / allCustomers.length) * 100) : 0;

    return {
      topList: sortedBySpend.slice(0, 4),
      totalCustomers: allCustomers.length,
      repeatCustomerCount,
      repeatRatio
    };
  }, [pelangganList, transaksiList]);

  // =========================================================================
  // 3. STATISTIK GRAFIK OMZET PROPORSI MAKSIMUM
  // =========================================================================
  const chartStats = useMemo(() => {
    const list = omzetHarian.slice(dateRange === '30d' ? -30 : -7);
    const maxOmzet = list.reduce((max, d) => Math.max(max, d.omzet || 0), 0);
    const totalOmzetPeriod = list.reduce((sum, d) => sum + (d.omzet || 0), 0);
    const avgOmzet = list.length > 0 ? Math.round(totalOmzetPeriod / list.length) : 0;
    return { list, maxOmzet, totalOmzetPeriod, avgOmzet };
  }, [omzetHarian, dateRange]);

  // =========================================================================
  // 4. REKOMENDASI RESTOCK & INVENTARIS
  // =========================================================================
  const restockRecommendations = useMemo(() => {
    return (inventoryList || []).map(item => {
      const { stok, stokMinimum, satuan } = item;
      const minVal = Number(stokMinimum) || 5;
      const sVal = Number(stok) || 0;
      
      let status: 'MINUS' | 'HABIS' | 'MENIPIS' | 'WASPADA' | 'AMAN' = 'AMAN';
      let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      let rekomendasiQty = 0;
      let alasan = '';

      if (sVal < 0) {
        status = 'MINUS';
        badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
        rekomendasiQty = Math.max(minVal * 2 + Math.abs(sVal), 10);
        alasan = `Stok bernilai minus (${sVal} ${satuan})! Segera audit fisik dan lakukan restock minimal ${rekomendasiQty} ${satuan}.`;
      } else if (sVal === 0) {
        status = 'HABIS';
        badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
        rekomendasiQty = Math.max(minVal * 2, 10);
        alasan = `Stok kosong total! Segera restock minimal ${rekomendasiQty} ${satuan} agar proses laundry tidak tertunda.`;
      } else if (sVal <= minVal) {
        status = 'MENIPIS';
        badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
        rekomendasiQty = Math.max((minVal * 2) - sVal, minVal);
        alasan = `Stok (${sVal} ${satuan}) di bawah batas minimum (${minVal} ${satuan}). Disarankan order +${rekomendasiQty} ${satuan}.`;
      } else if (sVal <= minVal * 1.5) {
        status = 'WASPADA';
        badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
        rekomendasiQty = minVal;
        alasan = `Stok (${sVal} ${satuan}) mendekati batas ambang. Siapkan rencana restock sekitar ${rekomendasiQty} ${satuan}.`;
      } else {
        status = 'AMAN';
        badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        rekomendasiQty = 0;
        alasan = `Kapasitas stok aman (${sVal} ${satuan}). Operasional berjalan optimal.`;
      }

      return {
        ...item,
        status,
        badgeColor,
        rekomendasiQty,
        alasan
      };
    }).sort((a, b) => {
      const priority = { MINUS: 0, HABIS: 1, MENIPIS: 2, WASPADA: 3, AMAN: 4 };
      return priority[a.status] - priority[b.status];
    });
  }, [inventoryList]);

  // Filter list inventaris untuk tampilan kartu
  const filteredInventoryDisplay = useMemo(() => {
    return (inventoryList || []).filter(item => {
      const s = Number(item.stok) || 0;
      const min = Number(item.stokMinimum) || 5;
      if (inventoryFilterTab === 'Kritis') return s <= 0;
      if (inventoryFilterTab === 'Menipis') return s > 0 && s <= min;
      if (inventoryFilterTab === 'Aman') return s > min;
      return true;
    });
  }, [inventoryList, inventoryFilterTab]);

  // Submit Restock
  const handleRestockSubmit = async () => {
    if (!selectedRestockItem) return;
    const delta = parseDecimal(restockQty, 0);
    if (delta <= 0) {
      await showAlert('Masukkan jumlah stok valid (> 0)!', 'warning');
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
    <div className="p-3 sm:p-5 space-y-4 max-w-7xl mx-auto text-slate-700">
      
      {/* ========================================================================= */}
      {/* PAGE HEADER: ADAPTIVE ROLE & STATUS OUTLET                                */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-[#1E4648] via-teal-900 to-slate-900 text-teal-300 flex items-center justify-center shadow-xs shrink-0 border border-teal-700/30">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Dashboard Utama</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                isManager 
                  ? 'bg-amber-50 text-amber-900 border-amber-300' 
                  : 'bg-teal-50 text-teal-900 border-teal-200'
              }`}>
                {isManager ? 'Mode Owner / Manager' : 'Mode Kasir / Staf'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Monitoring operasional real-time & indikator performa bisnis dua SiSi Laundry</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => fetchDashboardData()}
            disabled={loading}
            className="tactile-btn px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Muat ulang seluruh data dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1 — RINGKASAN CEPAT (TOP 4 KPI CARDS)                             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Order Today */}
        <div className="glass-card card-hover-lift p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-800 to-teal-950 text-teal-200 flex items-center justify-center font-bold shrink-0 shadow-xs border border-teal-700/40">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Order Hari Ini</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono tracking-tight truncate">
              {totalOrderHariIni} <span className="text-xs font-bold font-sans text-slate-500">Nota</span>
            </div>
            <div className="text-[10.5px] text-teal-700 font-bold truncate">Hari ini (WIB)</div>
          </div>
        </div>

        {/* Metric 2: Omzet Today */}
        <div className="glass-card card-hover-lift p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-900 text-emerald-200 flex items-center justify-center font-bold shrink-0 shadow-xs border border-emerald-600/40">
            <RupiahIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Omzet Hari Ini</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono tracking-tight truncate">
              Rp {(omzetHariIni || 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[10.5px] text-emerald-700 font-bold truncate">Penerimaan bersih</div>
          </div>
        </div>

        {/* Metric 3: Active Orders & Ready Pickup */}
        <div className="glass-card card-hover-lift p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 flex items-center justify-center font-bold shrink-0 shadow-xs border border-amber-400/40">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Antrean Aktif</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono tracking-tight truncate">
              {activeOrders.length} <span className="text-xs font-bold font-sans text-slate-500">Order</span>
            </div>
            <div className="text-[10.5px] text-amber-700 font-bold truncate">
              {readyPickupOrders.length} Siap Diambil di Rak
            </div>
          </div>
        </div>

        {/* Metric 4: System Health & Alerts */}
        <div className="glass-card card-hover-lift p-4 flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shrink-0 shadow-xs ${
            criticalStockItems.length > 0 || maintenanceMachines.length > 0 
              ? 'bg-gradient-to-br from-rose-600 to-rose-800 text-rose-100 border border-rose-400/40' 
              : 'bg-gradient-to-br from-emerald-600 to-teal-900 text-emerald-100 border border-emerald-500/40'
          }`}>
            {criticalStockItems.length > 0 || maintenanceMachines.length > 0 ? (
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Status Operasional</div>
            <div className={`text-lg sm:text-xl font-black truncate ${
              criticalStockItems.length > 0 || maintenanceMachines.length > 0 
                ? 'text-rose-700' 
                : 'text-emerald-700'
            }`}>
              {criticalStockItems.length > 0 || maintenanceMachines.length > 0 ? (
                <span>{criticalStockItems.length + maintenanceMachines.length} Perhatian</span>
              ) : (
                <span>Optimal</span>
              )}
            </div>
            <div className="text-[10.5px] text-slate-500 font-semibold truncate">
              {criticalStockItems.length} Stok • {maintenanceMachines.length} Mesin
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2 — OPERASIONAL REAL-TIME (STATUS MESIN & ANTREAN PESANAN)         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Widget 1: Status Mesin Real-Time (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Status & Progress Mesin</h2>
                <p className="text-[11px] text-slate-400">Monitoring washer dan dryer aktif outlet</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              {mesinList.filter(m => m.status === 'Digunakan').length} / {mesinList.length} Sedang Digunakan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mesinList.map((m) => {
              const isUsed = m.status === 'Digunakan';
              const isMaint = m.status === 'Maintenance';
              const isWasher = m.tipe === 'Washer';

              return (
                <div 
                  key={m.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isMaint ? 'bg-rose-50/70 border-rose-200' :
                    isUsed ? 'bg-amber-50/50 border-amber-300 shadow-xs' : 'bg-slate-50/80 border-slate-200 hover:border-teal-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isWasher ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isWasher ? <WashingMachine className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-800 block leading-tight">{m.nama}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{m.tipe}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        isMaint ? 'bg-rose-500' :
                        isUsed ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                      }`} />
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        isMaint ? 'bg-rose-100 text-rose-800' :
                        isUsed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isMaint ? 'Maintenance' : isUsed ? 'Digunakan' : 'Kosong / Siap'}
                      </span>
                    </div>
                  </div>

                  {isUsed ? (
                    <div className="space-y-1.5 text-[11px] pt-1 border-t border-amber-200/60">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium truncate max-w-[150px]">
                          {m.namaPelanggan ? `Pelanggan: ${m.namaPelanggan}` : (m.catatan || 'Proses Cucian')}
                        </span>
                        {m.noNota && (
                          <span className="font-mono text-[10px] font-bold text-teal-800 bg-teal-100/60 px-1.5 py-0.2 rounded">
                            {m.noNota}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between text-slate-600 font-semibold text-[10.5px]">
                        <span>Mulai: {m.waktuMulai ? formatWibTimeOnly(m.waktuMulai) : '-'}</span>
                        <span className="text-amber-800 font-bold">
                          {m.sisaWaktuMenit ? `${m.sisaWaktuMenit} Mnt Sisa` : (m.estimasiSelesai ? `Est: ${formatWibTimeOnly(m.estimasiSelesai)}` : 'Berjalan')}
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-teal-700 h-full w-4/5 rounded-full animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 font-medium py-1">
                      {isMaint ? 'Sedang perbaikan maintenance teknis' : 'Mesin siap digunakan untuk siklus baru'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Widget 2: Antrian & Siap Di-pickup (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Antrean Pengerjaan</h2>
                  <p className="text-[11px] text-slate-400">Status pesanan berjalan</p>
                </div>
              </div>

              {/* Quick Tab Switch */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setQueueTab('Semua')}
                  className={`px-2 py-1 rounded-md transition ${queueTab === 'Semua' ? 'bg-teal-800 text-white shadow-2xs' : 'text-slate-600'}`}
                >
                  Semua ({activeOrders.length})
                </button>
                <button
                  onClick={() => setQueueTab('SiapDiambil')}
                  className={`px-2 py-1 rounded-md transition ${queueTab === 'SiapDiambil' ? 'bg-teal-800 text-white shadow-2xs' : 'text-slate-600'}`}
                >
                  Di Rak ({readyPickupOrders.length})
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[310px] overflow-y-auto pr-1">
              {(queueTab === 'SiapDiambil' ? readyPickupOrders : activeOrders).length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p>Tidak ada antrean {queueTab === 'SiapDiambil' ? 'siap di-pickup' : 'aktif saat ini'}.</p>
                </div>
              ) : (
                (queueTab === 'SiapDiambil' ? readyPickupOrders : activeOrders).slice(0, 7).map((tx) => {
                  const isSiap = (tx.status || '').toLowerCase().includes('siap');
                  return (
                    <div key={tx.noNota} className="p-3 bg-slate-50/80 hover:bg-teal-50/40 border border-slate-200 rounded-xl flex justify-between items-center text-xs transition">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800 text-xs">{tx.noNota}</span>
                          <span className="text-[10px] text-slate-400">• {formatWibDateShort(tx.tanggal)}</span>
                        </div>
                        <div className="font-bold text-slate-700 text-xs truncate mt-0.5">{tx.namaPelanggan}</div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide border inline-block ${
                          isSiap ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-teal-100 text-teal-800 border-teal-300'
                        }`}>
                          {tx.status}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Rp {(Number(tx.total) || 0).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
            Diurutkan berdasarkan antrean pesanan aktif terbaru
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3 — PENJUALAN & KEUANGAN (ROLES: MANAGER ONLY)                    */}
      {/* ========================================================================= */}
      {isManager ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Analisis Penjualan & Keuangan</h2>
                <p className="text-[11px] text-slate-400">Tren pendapatan harian dan distribusi layanan terlaris</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Periode:</span>
              <div className="flex bg-slate-100 p-0.5 rounded-xl gap-1 text-xs font-bold border border-slate-200/80">
                <button
                  onClick={() => handleRangeChange('7d')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                    dateRange === '7d' ? 'bg-teal-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  7 Hari Terakhir
                </button>
                <button
                  onClick={() => handleRangeChange('30d')}
                  className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                    dateRange === '30d' ? 'bg-teal-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  30 Hari Terakhir
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Visual Modern Bar Chart Representation */}
            <div className="lg:col-span-2 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">Grafik Omzet Harian</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-medium">
                    Rata-rata: <strong className="text-slate-700 font-mono">Rp {chartStats.avgOmzet.toLocaleString('id-ID')}</strong>/hari
                  </span>
                  <span className="font-black text-teal-800 font-mono">
                    Total: Rp {chartStats.totalOmzetPeriod.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
              
              {/* Modern Responsive Clean Bar Chart */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-end h-36 pt-4 px-2 border-b border-slate-200 gap-2">
                  {chartStats.list.length > 0 ? (
                    chartStats.list.map((d, idx) => {
                      const isToday = isSameCalendarDay(d.tanggal);
                      const heightPercent = chartStats.maxOmzet > 0 
                        ? Math.max(16, Math.round((d.omzet / chartStats.maxOmzet) * 82)) 
                        : 16;

                      return (
                        <div key={idx} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5 group relative">
                          {/* Tooltip on Hover */}
                          <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white text-[10px] font-mono py-1 px-2 rounded-lg shadow-lg whitespace-nowrap z-10">
                            Rp {(d.omzet || 0).toLocaleString('id-ID')} ({d.jumlahTransaksi || 0} Trx)
                          </div>

                          {/* Bar */}
                          <div 
                            style={{ height: `${heightPercent}%`, minHeight: '12px' }} 
                            className={`w-full max-w-[38px] rounded-t-lg transition-all duration-300 ${
                              isToday 
                                ? 'bg-gradient-to-t from-teal-800 to-emerald-500 shadow-sm' 
                                : 'bg-gradient-to-t from-teal-700 to-teal-500 hover:from-teal-600 hover:to-teal-400'
                            }`} 
                          />

                          {/* Date Label */}
                          <span className={`text-[10px] font-mono truncate ${isToday ? 'font-black text-teal-900' : 'text-slate-500 font-medium'}`}>
                            {d.tanggal.slice(-5)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="w-full text-center text-slate-400 my-auto text-xs font-medium">Memuat data omzet periode ini...</div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>Omzet transaksi non-void terhitung otomatis</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-teal-600" /> Hari Biasa</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Hari Ini</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Services Breakdown */}
            <div className="space-y-2.5 text-xs">
              <div className="font-bold text-slate-800">Layanan Paling Banyak Dipesan</div>
              <div className="space-y-2">
                {layananTerlaris.length === 0 ? (
                  <div className="text-slate-400 text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
                    Belum ada data layanan
                  </div>
                ) : (
                  layananTerlaris.slice(0, 4).map((l, idx) => (
                    <div key={idx} className="p-3 bg-slate-50/80 hover:bg-teal-50/40 border border-slate-200 rounded-xl flex justify-between items-center transition">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-800 text-xs truncate">{l.layanan}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{l.qty} Transaksi</div>
                      </div>
                      <span className="font-black text-teal-800 font-mono text-xs shrink-0">
                        Rp {(l?.omzet || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* RESTRICTED NOTICE FOR KASIR / STAFF */
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-5 text-center text-slate-500 space-y-1">
          <Lock className="w-6 h-6 text-slate-400 mx-auto mb-1" />
          <div className="font-bold text-xs text-slate-700">Analisis Keuangan & Omzet Hanya untuk Manager / Owner</div>
          <p className="text-[11px] text-slate-400">Silakan login sebagai Manager untuk mengakses grafik omzet dan laporan lengkap.</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4 — INSIGHT PELANGGAN & REPEAT ORDER (MANAGER ONLY)                */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Insight Pelanggan & Loyalitas</h2>
              <p className="text-[11px] text-slate-400">Peringkat pelanggan belanja tertinggi & rasio pelanggan setia</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Top Customer List */}
            <div className="space-y-2">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Pelanggan Teratas (Berdasarkan Total Belanja)</span>
              </div>
              <div className="space-y-2">
                {customerAnalytics.topList.map((c, idx) => (
                  <div key={c.noHp || idx} className="p-3 bg-slate-50/80 hover:bg-teal-50/40 border border-slate-200 rounded-xl flex justify-between items-center transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                        idx === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black' :
                        idx === 1 ? 'bg-slate-200 text-slate-700' :
                        idx === 2 ? 'bg-orange-100 text-orange-900 border border-orange-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-xs truncate">{c.nama}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {c.noHp || '-'} • <strong className="text-teal-800">{c.totalOrder} Order</strong>
                        </div>
                      </div>
                    </div>
                    <span className="font-black text-teal-800 font-mono text-xs shrink-0">
                      Rp {(c?.totalSpend || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Repeat Order Card */}
            <div className="p-5 bg-gradient-to-br from-[#1E4648] to-teal-950 text-white rounded-2xl flex flex-col justify-between shadow-xs border border-teal-800">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-teal-300 tracking-wider">
                  Rasio Pelanggan Repeat Order
                </div>
                <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono mt-1">
                  {customerAnalytics.repeatRatio}%
                </div>
                <p className="text-xs text-teal-100/90 mt-1.5 leading-relaxed font-medium">
                  Sebanyak <strong>{customerAnalytics.repeatCustomerCount}</strong> dari {customerAnalytics.totalCustomers} pelanggan telah melakukan transaksi lebih dari satu kali di dua SiSi Laundry.
                </p>
              </div>

              <div className="pt-3 border-t border-teal-800/80 text-[11px] text-teal-300 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Terakumulasi otomatis di Database Supabase & POS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5 — INVENTORY & BAHAN BAKU LEVEL                                  */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Stok Bahan & Barang Habis Pakai</h2>
              <p className="text-[11px] text-slate-400">
                {isManager ? 'Mode Manager: Pantau stok & input restock langsung' : 'Mode Kasir: Monitoring ketersediaan bahan operasional'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200/60">
              {(['Semua', 'Kritis', 'Menipis', 'Aman'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setInventoryFilterTab(tab)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
                    inventoryFilterTab === tab ? 'bg-teal-800 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowRestockAnalysisModal(true)}
              className="tactile-btn px-3 py-1.5 bg-gradient-to-r from-[#1E4648] to-teal-800 hover:from-teal-900 hover:to-[#1E4648] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Rekomendasi Restock</span>
            </button>
          </div>
        </div>

        {/* Warning Banner if any items are negative or critical */}
        {minusStockItems.length > 0 && (
          <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Terdapat <strong>{minusStockItems.length} barang inventaris</strong> bernilai minus (di bawah 0). Segera lakukan audit fisik dan restock.
              </span>
            </div>
            <span className="font-bold text-[11px] bg-rose-100 text-rose-900 px-2 py-0.5 rounded">
              Prioritas Audit
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredInventoryDisplay.map((i) => {
            const s = Number(i.stok) || 0;
            const min = Number(i.stokMinimum) || 5;
            const isMinus = s < 0;
            const isHabis = s === 0;
            const isMenipis = s > 0 && s <= min;

            return (
              <div 
                key={i.id}
                className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                  isMinus ? 'bg-rose-50/90 border-rose-300 shadow-2xs' :
                  isHabis ? 'bg-rose-50/70 border-rose-200' :
                  isMenipis ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start gap-1">
                  <span className="font-bold text-slate-800 text-xs truncate">{i.nama}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 ${
                    isMinus ? 'bg-rose-600 text-white' :
                    isHabis ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                    isMenipis ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isMinus ? 'Stok Minus' : isHabis ? 'Habis' : isMenipis ? 'Menipis' : 'Aman'}
                  </span>
                </div>

                <div className="flex justify-between items-end pt-1">
                  <div>
                    <span className={`text-base font-black font-mono ${isMinus ? 'text-rose-600' : 'text-slate-800'}`}>
                      {formatDecimal(s)}
                    </span>
                    <span className="text-slate-500 font-semibold text-[11px] ml-1">{i.satuan}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Min: {min} {i.satuan}</div>
                  </div>
                  
                  {isManager && (
                    <button
                      onClick={() => {
                        setSelectedRestockItem(i);
                        setRestockQty('10');
                      }}
                      className="tactile-btn px-2.5 py-1 bg-[#1E4648] hover:bg-teal-900 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Restock</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 6 — REKAP SHIFT & KINERJA STAF (LEADERBOARD)                      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Kinerja Staf Kasir & Operator</h2>
              <p className="text-[11px] text-slate-400">Leaderboard performa pengerjaan order dan omzet</p>
            </div>
          </div>
        </div>

        {isManager ? (
          /* MANAGER VIEW: MODERN LEADERBOARD TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3.5">Peringkat</th>
                  <th className="py-3 px-3">Nama Staf</th>
                  <th className="py-3 px-3">Jabatan</th>
                  <th className="py-3 px-3 text-center">Total Order</th>
                  <th className="py-3 px-3 text-right">Total Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kinerjaStaff.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                        idx === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black' :
                        idx === 1 ? 'bg-slate-200 text-slate-700 font-bold' :
                        idx === 2 ? 'bg-orange-100 text-orange-900 border border-orange-200 font-bold' : 'text-slate-400 font-medium'
                      }`}>
                        #{idx + 1}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">{p.nama}</td>
                    <td className="py-3 px-3 text-slate-500 font-medium">{p.jabatan || 'Kasir / Operator'}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">{p.totalTransaksi} Order</td>
                    <td className="py-3 px-3 text-right font-black text-teal-900 font-mono text-xs">
                      Rp {(p?.totalOmzet || 0).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* KASIR VIEW: PERSONAL SHIFT SUMMARY CARD */
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-slate-800 text-sm">
                {kasShiftInfo ? `Sesi Shift Aktif — Dibuka: ${kasShiftInfo.waktuBuka || '-'}` : 'Belum ada shift yang dibuka'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {kasShiftInfo ? `Modal Kas Awal: Rp ${(kasShiftInfo.kasAwal || 0).toLocaleString('id-ID')}` : 'Buka shift kasir melalui menu POS Kasir atau Shift Saya.'}
              </div>
            </div>
            <span className={`px-3 py-1.5 font-bold rounded-xl text-xs ${
              kasShiftInfo ? 'bg-teal-100 text-teal-900 border border-teal-200' : 'bg-slate-200 text-slate-600'
            }`}>
              {kasShiftInfo ? 'Shift Berlangsung Aktif' : 'Belum Buka Shift'}
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* QUICK RESTOCK MODAL (MANAGER ONLY)                                        */}
      {/* ========================================================================= */}
      {selectedRestockItem && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-sm border border-slate-100 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-800">Input Restock Barang</h3>
              <button onClick={() => setSelectedRestockItem(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Nama Barang</label>
                <input 
                  type="text" 
                  readOnly 
                  value={selectedRestockItem.nama} 
                  className="w-full px-3.5 py-2.5 bg-slate-100 rounded-xl font-bold text-slate-700 outline-none" 
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Jumlah Tambahan Stok ({selectedRestockItem.satuan}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-teal-700 font-mono"
                  placeholder="Masukkan nominal tambahan..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setSelectedRestockItem(null)} 
                className="tactile-btn px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs"
              >
                Batal
              </button>
              <button 
                onClick={handleRestockSubmit} 
                className="tactile-btn flex-1 bg-teal-800 hover:bg-teal-900 text-white font-bold py-2.5 rounded-xl text-xs shadow-xs"
              >
                Simpan Stok Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SMART RESTOCK RECOMMENDATION MODAL                                        */}
      {/* ========================================================================= */}
      {showRestockAnalysisModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-800">Rekomendasi Restock & Pengadaan Bahan</h3>
                  <p className="text-xs text-slate-400 font-medium">Analisis rasio stok riil terhadap batas ambang minimum operasional</p>
                </div>
              </div>
              <button onClick={() => setShowRestockAnalysisModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              {restockRecommendations.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p>Belum ada data bahan inventory di sistem.</p>
                </div>
              ) : (
                restockRecommendations.map((item) => (
                  <div key={item.id} className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2 hover:border-teal-300 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{item.nama}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${item.badgeColor}`}>
                          {item.status === 'MINUS' ? 'Stok Minus' : item.status === 'HABIS' ? 'Habis' : item.status === 'MENIPIS' ? 'Menipis' : item.status === 'WASPADA' ? 'Waspada' : 'Aman'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        Sisa: <span className="text-slate-800 font-bold font-mono">{formatDecimal(item.stok)} {item.satuan}</span> | Min: <span className="text-slate-800 font-bold font-mono">{formatDecimal(item.stokMinimum)} {item.satuan}</span>
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
                          className="tactile-btn px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition"
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

            <div className="flex justify-end pt-3.5 border-t border-slate-100 mt-3">
              <button 
                onClick={() => setShowRestockAnalysisModal(false)} 
                className="tactile-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
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
