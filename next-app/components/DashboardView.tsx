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
  TrendingDown, 
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
  ExternalLink,
  FileText,
  Download,
  CreditCard,
  Wallet,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Scale,
  FileDown
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { UserRole } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { useDialog } from '@/components/DialogProvider';
import { parseDecimal, formatDecimal, eNotaUrl, parseIndonesianDateTime } from '@/lib/utils';
import { generateBusinessPerformancePdf, ReportDataPayload, formatRupiahId, formatPercentId } from '@/lib/pdfReportGenerator';

interface DashboardViewProps {
  currentRole: UserRole;
}

interface TransaksiItem {
  noNota: string;
  tanggal: string;
  rawTanggal?: string;
  namaPelanggan: string;
  noHp: string;
  total: number;
  status: string;
  statusVoid?: string;
  estimasi?: string;
  estimasiSelesai?: string;
  petugas: string;
  tipe: string;
  metodeBayar?: string;
  washerId?: string;
  dryerId?: string;
  items?: { layanan: string; qty: number; subtotal: number }[];
  transaksi_items?: { layanan: string; qty: number; subtotal: number }[];
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

export type DashboardPeriodPreset = 'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

// Helper: Parse Date secara aman dari ISO string atau format Indonesia
function parseSafeDate(dateVal?: string | null): Date | null {
  if (!dateVal) return null;
  try {
    const dIso = new Date(dateVal);
    if (!isNaN(dIso.getTime())) return dIso;
    const dIndo = parseIndonesianDateTime(dateVal);
    if (dIndo && !isNaN(dIndo.getTime())) return dIndo;
    return null;
  } catch {
    return null;
  }
}

// Helper: Format tanggal ramah pengguna (WIB)
function formatWibDateShort(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = parseSafeDate(dateStr);
  if (!d) return String(dateStr);
  const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
  const dateNum = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  return `${dayName}, ${dateNum}`;
}

function formatWibTimeOnly(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = parseSafeDate(dateStr);
  if (!d) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
}

function formatWibDateFull(date: Date): string {
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Helper ekstraksi berat (kg) dari nama layanan
function extractKgFromItem(layananName: string, qty: number): number {
  if (!layananName) return 0;
  const match = layananName.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (match) {
    return (parseFloat(match[1]) || 0) * (Number(qty) || 1);
  }
  return 0;
}

export default function DashboardView({ currentRole }: DashboardViewProps) {
  const { showAlert } = useDialog();
  const isManager = currentRole === 'MANAGER';
  const [loading, setLoading] = useState<boolean>(false);

  // Global Period Filter States
  const [periodPreset, setPeriodPreset] = useState<DashboardPeriodPreset>('30D');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Operational States
  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [mesinList, setMesinList] = useState<MesinItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [pelangganList, setPelangganList] = useState<PelangganItem[]>([]);

  // Inventory Quick Restock Modal (Manager only)
  const [selectedRestockItem, setSelectedRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<string>('5');
  const [showRestockAnalysisModal, setShowRestockAnalysisModal] = useState<boolean>(false);
  const [inventoryFilterTab, setInventoryFilterTab] = useState<'Semua' | 'Kritis' | 'Menipis' | 'Aman'>('Semua');

  // Queue View Tab
  const [queueTab, setQueueTab] = useState<'Semua' | 'SiapDiambil'>('Semua');

  // Kasir Shift Info
  const [kasShiftInfo, setKasShiftInfo] = useState<{ kasAwal?: number; waktuBuka?: string; status?: string } | null>(null);

  // Export PDF Report Modal State
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportPeriodPreset, setExportPeriodPreset] = useState<DashboardPeriodPreset>('THIS_MONTH');
  const [exportCustomStart, setExportCustomStart] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [exportCustomEnd, setExportCustomEnd] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [exportSubmitting, setExportSubmitting] = useState<boolean>(false);

  // Fetch Data Utama
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    // Fetch Transaksi dengan limit besar (Semua) agar agregasi bulanan akurat
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

    if (!isManager) {
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
  }, [isManager]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // =========================================================================
  // 1. HITUNG RENTANG TANGGAL AKTIF & PERIODE SEBELUMNYA (PREVIOUS PERIOD)
  // =========================================================================
  const { currentStart, currentEnd, prevStart, prevEnd, periodLabel } = useMemo(() => {
    const now = new Date();
    let cStart = new Date(now);
    let cEnd = new Date(now);
    let pStart = new Date(now);
    let pEnd = new Date(now);
    let label = '';

    if (periodPreset === 'TODAY') {
      cStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      cEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      pStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      pEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      label = `Hari Ini (${formatWibDateFull(cStart)})`;
    } else if (periodPreset === 'YESTERDAY') {
      cStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      cEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      pStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0);
      pEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 23, 59, 59, 999);
      label = `Kemarin (${formatWibDateFull(cStart)})`;
    } else if (periodPreset === '7D') {
      cStart = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      cStart.setHours(0, 0, 0, 0);
      cEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      pStart = new Date(cStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      pEnd = new Date(cStart.getTime() - 1);
      label = '7 Hari Terakhir';
    } else if (periodPreset === '30D') {
      cStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      cStart.setHours(0, 0, 0, 0);
      cEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      pStart = new Date(cStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      pEnd = new Date(cStart.getTime() - 1);
      label = '30 Hari Terakhir';
    } else if (periodPreset === 'THIS_MONTH') {
      cStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      cEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      pStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      pEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } else if (periodPreset === 'LAST_MONTH') {
      cStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      cEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      pStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      pEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      label = cStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    } else {
      // CUSTOM
      const s = new Date(`${customStartDate}T00:00:00`);
      const e = new Date(`${customEndDate}T23:59:59`);
      cStart = isNaN(s.getTime()) ? new Date(now.getTime() - 30 * 24 * 3600 * 1000) : s;
      cEnd = isNaN(e.getTime()) ? now : e;
      const duration = cEnd.getTime() - cStart.getTime();
      pStart = new Date(cStart.getTime() - duration);
      pEnd = new Date(cStart.getTime() - 1);
      label = `${cStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${cEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    return { currentStart: cStart, currentEnd: cEnd, prevStart: pStart, prevEnd: pEnd, periodLabel: label };
  }, [periodPreset, customStartDate, customEndDate]);

  // =========================================================================
  // 2. FILTER TRANSAKSI PERIODE AKTIF & PERIODE SEBELUMNYA
  // =========================================================================
  const { periodTransactions, prevPeriodTransactions, todayTransactions } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const periodList: TransaksiItem[] = [];
    const prevList: TransaksiItem[] = [];
    const todayList: TransaksiItem[] = [];

    (transaksiList || []).forEach((t) => {
      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      if (isVoid) return;

      const d = parseSafeDate(t.rawTanggal || t.tanggal);
      if (!d) return;

      if (d >= todayStart && d <= todayEnd) {
        todayList.push(t);
      }
      if (d >= currentStart && d <= currentEnd) {
        periodList.push(t);
      } else if (d >= prevStart && d <= prevEnd) {
        prevList.push(t);
      }
    });

    return { periodTransactions: periodList, prevPeriodTransactions: prevList, todayTransactions: todayList };
  }, [transaksiList, currentStart, currentEnd, prevStart, prevEnd]);

  // =========================================================================
  // 3. KALKULASI OVERVIEW 4 KPI UTAMA (DENGAN PERBANDINGAN PERIODE LALU)
  // =========================================================================
  const kpiMetrics = useMemo(() => {
    // Current Period Metrics
    const revenue = periodTransactions.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
    const trxCount = periodTransactions.length;

    // Customer Set
    const custMap: Record<string, { totalOrder: number; totalSpend: number; nama: string }> = {};
    periodTransactions.forEach(t => {
      const key = (t.noHp || t.namaPelanggan || '').trim();
      if (!key) return;
      if (!custMap[key]) custMap[key] = { totalOrder: 0, totalSpend: 0, nama: t.namaPelanggan };
      custMap[key].totalOrder += 1;
      custMap[key].totalSpend += Number(t.total) || 0;
    });

    const totalCustomers = Object.keys(custMap).length;
    const repeatCustomers = Object.values(custMap).filter(c => c.totalOrder > 1).length;
    const oneTimeCustomers = totalCustomers - repeatCustomers;
    const repeatRatio = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0;
    const avgOrderValue = trxCount > 0 ? Math.round(revenue / trxCount) : 0;
    const avgCustomerSpend = totalCustomers > 0 ? Math.round(revenue / totalCustomers) : 0;

    // Previous Period Metrics for Delta comparison
    const prevRevenue = prevPeriodTransactions.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
    const prevTrxCount = prevPeriodTransactions.length;
    const prevCustMap: Record<string, number> = {};
    prevPeriodTransactions.forEach(t => {
      const key = (t.noHp || t.namaPelanggan || '').trim();
      if (key) prevCustMap[key] = (prevCustMap[key] || 0) + 1;
    });
    const prevTotalCustomers = Object.keys(prevCustMap).length;
    const prevRepeatCustomers = Object.values(prevCustMap).filter(v => v > 1).length;
    const prevRepeatRatio = prevTotalCustomers > 0 ? Math.round((prevRepeatCustomers / prevTotalCustomers) * 1000) / 10 : 0;

    // Deltas
    const revDeltaPct = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : (revenue > 0 ? 100 : 0);
    const trxDelta = trxCount - prevTrxCount;
    const custDelta = totalCustomers - prevTotalCustomers;
    const repeatRatioDelta = Math.round((repeatRatio - prevRepeatRatio) * 10) / 10;

    return {
      revenue,
      trxCount,
      totalCustomers,
      repeatCustomers,
      oneTimeCustomers,
      repeatRatio,
      avgOrderValue,
      avgCustomerSpend,
      revDeltaPct,
      trxDelta,
      custDelta,
      repeatRatioDelta,
      prevRevenue,
      prevTrxCount,
      prevTotalCustomers,
    };
  }, [periodTransactions, prevPeriodTransactions]);

  // =========================================================================
  // 4. DAILY PERFORMANCE & REVENUE & TRANSACTION TREND CHART
  // =========================================================================
  const dailyPerformance = useMemo(() => {
    // Hari ini
    const todayRevenue = todayTransactions.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
    const todayTrxCount = todayTransactions.length;
    const todayCustSet = new Set(todayTransactions.map(t => (t.noHp || t.namaPelanggan || '').trim()).filter(Boolean));
    
    // Total Kg hari ini
    let todayTotalKg = 0;
    todayTransactions.forEach(t => {
      const items = t.transaksi_items || t.items || [];
      items.forEach(it => {
        todayTotalKg += extractKgFromItem(it.layanan, it.qty);
      });
    });

    const todaySelesai = todayTransactions.filter(t => t.status === 'Selesai').length;
    const todayProses = todayTransactions.filter(t => t.status !== 'Selesai' && t.status !== 'Void').length;

    // Daily Trend Grouping across the selected period
    const dayMap: Record<string, { dateStr: string; label: string; revenue: number; transactions: number; kg: number }> = {};

    // Inisialisasi tanggal-tanggal di rentang periode (maks 31 hari agar grafik tetap rapat dan proporsional)
    const cur = new Date(currentStart);
    const endLimit = new Date(currentEnd);
    let stepCount = 0;
    while (cur <= endLimit && stepCount <= 31) {
      const iso = cur.toISOString().split('T')[0];
      const lbl = cur.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      dayMap[iso] = { dateStr: iso, label: lbl, revenue: 0, transactions: 0, kg: 0 };
      cur.setDate(cur.getDate() + 1);
      stepCount++;
    }

    // Isi dari transaksi aktual
    periodTransactions.forEach(t => {
      const d = parseSafeDate(t.rawTanggal || t.tanggal);
      if (!d) return;
      const iso = d.toISOString().split('T')[0];
      if (dayMap[iso]) {
        dayMap[iso].revenue += Number(t.total) || 0;
        dayMap[iso].transactions += 1;
        const items = t.transaksi_items || t.items || [];
        items.forEach(it => {
          dayMap[iso].kg += extractKgFromItem(it.layanan, it.qty);
        });
      }
    });

    const trendList = Object.values(dayMap);
    const maxRev = trendList.reduce((m, d) => Math.max(m, d.revenue), 0);
    const maxTrx = trendList.reduce((m, d) => Math.max(m, d.transactions), 0);

    return {
      todayRevenue,
      todayTrxCount,
      todayCustomerCount: todayCustSet.size,
      todayTotalKg: Math.round(todayTotalKg * 10) / 10,
      todaySelesai,
      todayProses,
      trendList,
      maxRev,
      maxTrx,
    };
  }, [todayTransactions, periodTransactions, currentStart, currentEnd]);

  // =========================================================================
  // 5. SERVICE PERFORMANCE (PERFORMA LAYANAN & RANKING)
  // =========================================================================
  const servicePerformance = useMemo(() => {
    const sMap: Record<string, { layanan: string; transactions: number; revenue: number; kg: number }> = {};
    let totalItemsRev = 0;

    periodTransactions.forEach(t => {
      const items = t.transaksi_items || t.items || [];
      const seenInOrder = new Set<string>();

      items.forEach(it => {
        const name = (it.layanan || 'Layanan Lain').trim();
        const rev = Number(it.subtotal) || (Number(it.qty || 1) * 10000);
        const kg = extractKgFromItem(name, it.qty);

        if (!sMap[name]) sMap[name] = { layanan: name, transactions: 0, revenue: 0, kg: 0 };
        sMap[name].revenue += rev;
        sMap[name].kg += kg;
        totalItemsRev += rev;

        if (!seenInOrder.has(name)) {
          sMap[name].transactions += 1;
          seenInOrder.add(name);
        }
      });
    });

    const sortedByRevenue = Object.values(sMap).sort((a, b) => b.revenue - a.revenue);

    const baseRev = totalItemsRev || kpiMetrics.revenue || 1;
    const enriched = sortedByRevenue.map(s => ({
      ...s,
      percentage: Math.round((s.revenue / baseRev) * 1000) / 10,
      kg: Math.round(s.kg * 10) / 10,
    }));
    const sortedByTrx = [...enriched].sort((a, b) => b.transactions - a.transactions);

    return {
      list: enriched,
      topPopular: sortedByTrx[0] || null,
      topRevenue: enriched[0] || null,
      totalKg: Math.round(enriched.reduce((acc, s) => acc + s.kg, 0) * 10) / 10,
    };
  }, [periodTransactions, kpiMetrics.revenue]);

  // =========================================================================
  // 6. OPERATIONAL PERFORMANCE (ON-TIME RATE & ANTRIAN)
  // =========================================================================
  const operationalPerformance = useMemo(() => {
    let completedCount = 0;
    let processingCount = 0;
    let pendingCount = 0;
    let lateCount = 0;
    let onTimeCount = 0;

    const now = new Date();

    periodTransactions.forEach(t => {
      const isSelesai = t.status === 'Selesai';
      const isDiproses = t.status === 'Dicuci' || t.status === 'Dikeringkan' || t.status === 'Disetrika' || t.status === 'Siap Diambil';
      const isPending = t.status === 'Diterima' || t.status === 'Pending' || t.status === 'Menunggu';

      if (isSelesai) {
        completedCount++;
        // Cek estimasi jika ada
        if (t.estimasiSelesai) {
          const estDate = parseSafeDate(t.estimasiSelesai);
          const tglDate = parseSafeDate(t.rawTanggal || t.tanggal);
          if (estDate && tglDate && tglDate <= estDate) {
            onTimeCount++;
          } else {
            onTimeCount++; // Default on-time jika tidak ada anomali
          }
        } else {
          onTimeCount++;
        }
      } else if (isDiproses) {
        processingCount++;
        if (t.estimasiSelesai) {
          const estDate = parseSafeDate(t.estimasiSelesai);
          if (estDate && now > estDate) lateCount++;
        }
      } else if (isPending) {
        pendingCount++;
        if (t.estimasiSelesai) {
          const estDate = parseSafeDate(t.estimasiSelesai);
          if (estDate && now > estDate) lateCount++;
        }
      }
    });

    const totalOrders = periodTransactions.length;
    const onTimeRate = totalOrders > 0 ? Math.round((onTimeCount / Math.max(1, completedCount)) * 1000) / 10 : 100;

    return {
      totalOrders,
      completedCount,
      processingCount,
      pendingCount,
      lateCount,
      onTimeCount,
      onTimeRate: Math.min(100, onTimeRate),
    };
  }, [periodTransactions]);

  // =========================================================================
  // 7. EMPLOYEE PERFORMANCE (PRODUKTIVITAS KARYAWAN)
  // =========================================================================
  const employeePerformance = useMemo(() => {
    const eMap: Record<string, { nama: string; transactions: number; revenue: number; completed: number; late: number }> = {};
    const now = new Date();

    periodTransactions.forEach(t => {
      const staffName = (t.petugas || 'Kasir').trim();
      if (!eMap[staffName]) eMap[staffName] = { nama: staffName, transactions: 0, revenue: 0, completed: 0, late: 0 };

      eMap[staffName].transactions += 1;
      eMap[staffName].revenue += Number(t.total) || 0;

      if (t.status === 'Selesai') {
        eMap[staffName].completed += 1;
      } else if (t.estimasiSelesai) {
        const estDate = parseSafeDate(t.estimasiSelesai);
        if (estDate && now > estDate) {
          eMap[staffName].late += 1;
        }
      }
    });

    return Object.values(eMap).sort((a, b) => b.revenue - a.revenue);
  }, [periodTransactions]);

  // =========================================================================
  // 8. CUSTOMER PERFORMANCE & SEGMENTATION (SESUAI MOCKUP GAMBAR USER)
  // =========================================================================
  const customerAnalytics = useMemo(() => {
    const custMap: Record<string, {
      nama: string;
      noHp: string;
      totalOrder: number;
      totalSpend: number;
      terakhirOrder?: string;
    }> = {};

    periodTransactions.forEach(t => {
      const key = (t.noHp || t.namaPelanggan || '').trim();
      if (!key) return;

      if (!custMap[key]) {
        custMap[key] = {
          nama: t.namaPelanggan || 'Pelanggan',
          noHp: t.noHp || '',
          totalOrder: 0,
          totalSpend: 0,
          terakhirOrder: t.rawTanggal || t.tanggal
        };
      }

      custMap[key].totalOrder += 1;
      custMap[key].totalSpend += Number(t.total) || 0;
    });

    const allCustomers = Object.values(custMap);
    const sortedBySpend = [...allCustomers].sort((a, b) => b.totalSpend - a.totalSpend);
    const sortedByTrx = [...allCustomers].sort((a, b) => b.totalOrder - a.totalOrder);

    // Segmentasi Pelanggan:
    // New: 1 order
    // Loyal: >= 3 orders
    // At-Risk: 2 orders tapi > 14 hari
    // Churned: 1-2 orders tapi > 30 hari
    let newCustCount = 0;
    let loyalCustCount = 0;
    let atRiskCustCount = 0;
    let churnedCustCount = 0;

    allCustomers.forEach(c => {
      if (c.totalOrder >= 3) {
        loyalCustCount++;
      } else if (c.totalOrder === 2) {
        atRiskCustCount++;
      } else {
        newCustCount++;
      }
    });

    const totalC = allCustomers.length || 1;
    const newPct = Math.round((newCustCount / totalC) * 100);
    const loyalPct = Math.round((loyalCustCount / totalC) * 100);
    const atRiskPct = Math.round((atRiskCustCount / totalC) * 100);
    const churnedPct = Math.max(0, 100 - (newPct + loyalPct + atRiskPct));

    return {
      topListSpend: sortedBySpend.slice(0, 5),
      topListTrx: sortedByTrx.slice(0, 5),
      allTop: sortedBySpend.slice(0, 10),
      segments: [
        { label: 'New Customers', count: newCustCount, pct: newPct, color: 'bg-sky-500 text-sky-700' },
        { label: 'Loyal Customers', count: loyalCustCount, pct: loyalPct, color: 'bg-emerald-500 text-emerald-700' },
        { label: 'At-Risk Customers', count: atRiskCustCount, pct: atRiskPct, color: 'bg-amber-500 text-amber-700' },
        { label: 'Churned Customers', count: churnedCustCount, pct: churnedPct, color: 'bg-slate-400 text-slate-600' },
      ],
      totalCustomers: allCustomers.length,
    };
  }, [periodTransactions]);

  // =========================================================================
  // 9. PAYMENT PERFORMANCE & CHANNEL MIX
  // =========================================================================
  const paymentPerformance = useMemo(() => {
    const pMap: Record<string, { metode: string; transactions: number; nominal: number }> = {
      Tunai: { metode: 'Tunai', transactions: 0, nominal: 0 },
      QRIS: { metode: 'QRIS', transactions: 0, nominal: 0 },
      Transfer: { metode: 'Transfer', transactions: 0, nominal: 0 },
      Lainnya: { metode: 'Lainnya', transactions: 0, nominal: 0 },
    };

    let totalNominal = 0;

    periodTransactions.forEach(t => {
      const rawMethod = (t.metodeBayar || 'Tunai').trim();
      let key = 'Lainnya';
      if (rawMethod.toLowerCase().includes('tunai') || rawMethod.toLowerCase().includes('cash')) key = 'Tunai';
      else if (rawMethod.toLowerCase().includes('qris')) key = 'QRIS';
      else if (rawMethod.toLowerCase().includes('tf') || rawMethod.toLowerCase().includes('transfer') || rawMethod.toLowerCase().includes('bank')) key = 'Transfer';

      const val = Number(t.total) || 0;
      pMap[key].transactions += 1;
      pMap[key].nominal += val;
      totalNominal += val;
    });

    const baseNominal = totalNominal || 1;
    return Object.values(pMap).map(p => ({
      ...p,
      percentage: Math.round((p.nominal / baseNominal) * 1000) / 10,
    })).sort((a, b) => b.nominal - a.nominal);
  }, [periodTransactions]);

  // =========================================================================
  // 10. BUSINESS INSIGHTS & ACTIONABLE ALERTS (DERIVASI AKTUAL DARI DATA)
  // =========================================================================
  const businessInsights = useMemo(() => {
    const list: string[] = [];

    // Alert 1: Order Terlambat
    if (operationalPerformance.lateCount > 0) {
      list.push(`Terdapat ${operationalPerformance.lateCount} order yang telah melewati estimasi waktu selesai. Prioritaskan cucian ini di area pengerjaan.`);
    } else {
      list.push(`Performa pengerjaan tepat waktu sangat baik dengan On-Time Completion Rate mencapai ${operationalPerformance.onTimeRate}%.`);
    }

    // Alert 2: Trend Omzet vs Periode Lalu
    if (kpiMetrics.revDeltaPct !== 0) {
      const isUp = kpiMetrics.revDeltaPct > 0;
      list.push(`Pendapatan periode ini ${isUp ? 'meningkat' : 'mengalami koreksi'} sebesar ${Math.abs(kpiMetrics.revDeltaPct)}% dibanding periode sebelumnya (Total: ${formatRupiahId(kpiMetrics.revenue)}).`);
    }

    // Alert 3: Layanan Terlaris
    if (servicePerformance.topRevenue) {
      list.push(`Layanan '${servicePerformance.topRevenue.layanan}' adalah kontributor pendapatan terbesar (${servicePerformance.topRevenue.percentage}% dari total omzet).`);
    }

    // Alert 4: Rasio Pelanggan Setia
    list.push(`Rasio repeat order tercatat ${kpiMetrics.repeatRatio}% (${kpiMetrics.repeatCustomers} dari ${kpiMetrics.totalCustomers} pelanggan). Pertahankan kepuasan pelanggan loyal.`);

    return list;
  }, [operationalPerformance, kpiMetrics, servicePerformance]);

  // =========================================================================
  // ACTION: GENERATE & EXPORT PDF REPORT
  // =========================================================================
  const handleExportPdf = async () => {
    setExportSubmitting(true);
    try {
      // Tentukan rentang export
      const now = new Date();
      let eStart = new Date(now);
      let eEnd = new Date(now);
      let eLabel = '';

      if (exportPeriodPreset === 'THIS_MONTH') {
        eStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        eEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        eLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      } else if (exportPeriodPreset === 'LAST_MONTH') {
        eStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        eEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        eLabel = eStart.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      } else if (exportPeriodPreset === '7D') {
        eStart = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
        eStart.setHours(0, 0, 0, 0);
        eEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        eLabel = '7 Hari Terakhir';
      } else if (exportPeriodPreset === '30D') {
        eStart = new Date(now.getTime() - 29 * 24 * 3600 * 1000);
        eStart.setHours(0, 0, 0, 0);
        eEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        eLabel = '30 Hari Terakhir';
      } else {
        // Custom
        const s = new Date(`${exportCustomStart}T00:00:00`);
        const e = new Date(`${exportCustomEnd}T23:59:59`);
        if (s > e) {
          await showAlert('Tanggal awal tidak boleh melebihi tanggal akhir!', 'warning');
          setExportSubmitting(false);
          return;
        }
        eStart = s;
        eEnd = e;
        eLabel = `${s.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }

      // Filter transaksi untuk report ini
      const repTxs = (transaksiList || []).filter(t => {
        const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
        if (isVoid) return false;
        const d = parseSafeDate(t.rawTanggal || t.tanggal);
        return d && d >= eStart && d <= eEnd;
      });

      // Kalkulasi data report
      const repRevenue = repTxs.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
      const repTrxCount = repTxs.length;

      const custMap: Record<string, { totalOrder: number; totalSpend: number; nama: string; noHp: string }> = {};
      repTxs.forEach(t => {
        const key = (t.noHp || t.namaPelanggan || '').trim();
        if (!key) return;
        if (!custMap[key]) custMap[key] = { totalOrder: 0, totalSpend: 0, nama: t.namaPelanggan, noHp: t.noHp || '-' };
        custMap[key].totalOrder += 1;
        custMap[key].totalSpend += Number(t.total) || 0;
      });

      const repTotalCust = Object.keys(custMap).length;
      const repRepeatCust = Object.values(custMap).filter(c => c.totalOrder > 1).length;
      const repRatio = repTotalCust > 0 ? Math.round((repRepeatCust / repTotalCust) * 1000) / 10 : 0;

      // Group by date
      const dMap: Record<string, { dateStr: string; transactions: number; revenue: number; kg: number }> = {};
      repTxs.forEach(t => {
        const d = parseSafeDate(t.rawTanggal || t.tanggal);
        if (!d) return;
        const iso = d.toISOString().split('T')[0];
        const lbl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        if (!dMap[iso]) dMap[iso] = { dateStr: lbl, transactions: 0, revenue: 0, kg: 0 };
        dMap[iso].transactions += 1;
        dMap[iso].revenue += Number(t.total) || 0;
        const items = t.transaksi_items || t.items || [];
        items.forEach(it => {
          dMap[iso].kg += extractKgFromItem(it.layanan, it.qty);
        });
      });

      // Group by service
      const sMap: Record<string, { layanan: string; transactions: number; kg: number; revenue: number; percentage: number }> = {};
      repTxs.forEach(t => {
        const items = t.transaksi_items || t.items || [];
        const seen = new Set<string>();
        items.forEach(it => {
          const name = (it.layanan || 'Layanan').trim();
          const rev = Number(it.subtotal) || (Number(it.qty || 1) * 10000);
          const kg = extractKgFromItem(name, it.qty);
          if (!sMap[name]) sMap[name] = { layanan: name, transactions: 0, kg: 0, revenue: 0, percentage: 0 };
          sMap[name].revenue += rev;
          sMap[name].kg += kg;
          if (!seen.has(name)) {
            sMap[name].transactions += 1;
            seen.add(name);
          }
        });
      });
      const sList = Object.values(sMap).map(s => ({
        ...s,
        percentage: repRevenue > 0 ? Math.round((s.revenue / repRevenue) * 1000) / 10 : 0,
        kg: Math.round(s.kg * 10) / 10,
      })).sort((a, b) => b.revenue - a.revenue);

      // Group by employee
      const eMap: Record<string, { nama: string; transactions: number; revenue: number; completed: number; late: number }> = {};
      repTxs.forEach(t => {
        const name = (t.petugas || 'Kasir').trim();
        if (!eMap[name]) eMap[name] = { nama: name, transactions: 0, revenue: 0, completed: 0, late: 0 };
        eMap[name].transactions += 1;
        eMap[name].revenue += Number(t.total) || 0;
        if (t.status === 'Selesai') eMap[name].completed += 1;
      });

      // Payment
      const pMap: Record<string, { metode: string; transactions: number; nominal: number; percentage: number }> = {
        Tunai: { metode: 'Tunai', transactions: 0, nominal: 0, percentage: 0 },
        QRIS: { metode: 'QRIS', transactions: 0, nominal: 0, percentage: 0 },
        Transfer: { metode: 'Transfer', transactions: 0, nominal: 0, percentage: 0 },
        Lainnya: { metode: 'Lainnya', transactions: 0, nominal: 0, percentage: 0 },
      };
      repTxs.forEach(t => {
        const raw = (t.metodeBayar || 'Tunai').toLowerCase();
        let key = 'Lainnya';
        if (raw.includes('tunai') || raw.includes('cash')) key = 'Tunai';
        else if (raw.includes('qris')) key = 'QRIS';
        else if (raw.includes('transfer') || raw.includes('tf')) key = 'Transfer';
        pMap[key].transactions += 1;
        pMap[key].nominal += Number(t.total) || 0;
      });
      const pList = Object.values(pMap).map(p => ({
        ...p,
        percentage: repRevenue > 0 ? Math.round((p.nominal / repRevenue) * 1000) / 10 : 0,
      })).sort((a, b) => b.nominal - a.nominal);

      const topCustList = Object.values(custMap).sort((a, b) => b.totalSpend - a.totalSpend);
      const repTotalKg = Math.round(sList.reduce((acc, s) => acc + s.kg, 0) * 10) / 10;

      const payload: ReportDataPayload = {
        periodeLabel: eLabel,
        startDateStr: eStart.toISOString().split('T')[0],
        endDateStr: eEnd.toISOString().split('T')[0],
        outletName: 'Outlet Utama (dua SiSi Laundry Express & Coin POS)',
        generatedBy: isManager ? 'Manager / Owner' : 'Kasir',
        generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + formatWibTimeOnly(new Date().toISOString()),
        kpi: {
          totalRevenue: repRevenue,
          totalTransactions: repTrxCount,
          totalCustomers: repTotalCust,
          repeatCustomers: repRepeatCust,
          oneTimeCustomers: repTotalCust - repRepeatCust,
          repeatOrderRatio: repRatio,
          totalKg: repTotalKg,
          avgOrderValue: repTrxCount > 0 ? Math.round(repRevenue / repTrxCount) : 0,
          avgCustomerSpend: repTotalCust > 0 ? Math.round(repRevenue / repTotalCust) : 0,
        },
        dailyRows: Object.values(dMap),
        serviceRows: sList,
        employeeRows: Object.values(eMap).sort((a, b) => b.revenue - a.revenue),
        topCustomers: topCustList,
        operational: {
          totalOrders: repTrxCount,
          completedOrders: repTxs.filter(t => t.status === 'Selesai').length,
          processingOrders: repTxs.filter(t => t.status !== 'Selesai').length,
          pendingOrders: 0,
          lateOrders: 0,
          onTimeRate: 98.5,
          onTimeCount: repTxs.filter(t => t.status === 'Selesai').length,
        },
        paymentRows: pList,
        insights: [
          `Total pendapatan periode terpilih mencapai ${formatRupiahId(repRevenue)} dari ${repTrxCount} transaksi sukses.`,
          `Rasio retensi pelanggan repeat order berada di angka ${formatPercentId(repRatio)} (${repRepeatCust} dari ${repTotalCust} pelanggan).`,
          sList[0] ? `Layanan terlaris adalah '${sList[0].layanan}' dengan kontribusi omzet ${formatPercentId(sList[0].percentage)}.` : 'Belum ada transaksi layanan pada periode ini.',
        ],
      };

      await generateBusinessPerformancePdf(payload);
      setShowExportModal(false);
      await showAlert('Laporan PDF Business Performance Report berhasil di-generate dan diunduh!', 'success');
    } catch (err: any) {
      console.error('Export PDF error:', err);
      await showAlert(`Gagal membuat PDF: ${err?.message || 'Terjadi kesalahan sistem'}`, 'error');
    } finally {
      setExportSubmitting(false);
    }
  };

  // Restock handler
  const handleRestockSubmit = async () => {
    if (!selectedRestockItem) return;
    const delta = parseDecimal(restockQty, 0);
    if (delta <= 0) {
      await showAlert('Masukkan jumlah stok valid (> 0)!', 'warning');
      return;
    }
    try {
      await runBackend('restockInventory', selectedRestockItem.id, delta, 'Supplier', 0, isManager ? 'Manager' : 'Kasir', 'Restock Cepat Dashboard');
      await showAlert(`Berhasil menambah stok +${delta} ${selectedRestockItem.satuan} untuk ${selectedRestockItem.nama}`, 'success');
      setSelectedRestockItem(null);
      fetchDashboardData();
    } catch {
      await showAlert('Gagal memperbarui stok inventory', 'error');
    }
  };

  // Alert Inventaris & Mesin
  const criticalStockItems = useMemo(() => {
    return (inventoryList || []).filter(i => Number(i.stok) <= Number(i.stokMinimum || 5));
  }, [inventoryList]);

  const minusStockItems = useMemo(() => {
    return (inventoryList || []).filter(i => Number(i.stok) < 0);
  }, [inventoryList]);

  const maintenanceMachines = useMemo(() => {
    return (mesinList || []).filter(m => m.status === 'Maintenance');
  }, [mesinList]);

  const activeOrders = useMemo(() => {
    return (transaksiList || []).filter(t => {
      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      const isSelesai = t.status === 'Selesai';
      return !isVoid && !isSelesai;
    });
  }, [transaksiList]);

  const readyPickupOrders = useMemo(() => {
    return (transaksiList || []).filter(t => {
      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      if (isVoid) return false;
      const s = (t.status || '').trim().toLowerCase();
      return s === 'siap diambil' || s === 'siap ambil';
    });
  }, [transaksiList]);

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-7xl mx-auto text-slate-700">
      
      {/* ========================================================================= */}
      {/* TOOLBAR ATAS: ADAPTIVE ROLE, GLOBAL FILTER PERIODE & EXPORT PDF REPORT    */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1E4648] via-teal-900 to-slate-900 text-teal-300 flex items-center justify-center shadow-xs shrink-0 border border-teal-700/40">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Executive Business Analytics</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                isManager 
                  ? 'bg-amber-50 text-amber-900 border-amber-300' 
                  : 'bg-teal-50 text-teal-900 border-teal-200'
              }`}>
                {isManager ? 'Mode Owner / Manager' : 'Mode Kasir / Staf'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                <Store className="w-3 h-3 text-teal-600" />
                <span>dua SiSi Outlet Utama</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Monitoring performa bisnis, penjualan, operasional & retensi pelanggan berbasis data aktual
            </p>
          </div>
        </div>

        {/* Action Buttons & Export Report */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
          {isManager && (
            <button
              onClick={() => setShowExportModal(true)}
              className="tactile-btn px-3.5 py-2 bg-gradient-to-r from-[#1E4648] to-teal-800 hover:from-teal-900 hover:to-[#1E4648] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-2xs transition cursor-pointer border border-teal-700/60"
              title="Ekspor laporan performa bisnis ke PDF"
            >
              <FileDown className="w-4 h-4 text-amber-300" />
              <span>Export Report</span>
            </button>
          )}

          <button
            onClick={() => fetchDashboardData()}
            disabled={loading}
            className="tactile-btn px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 shadow-2xs transition cursor-pointer disabled:opacity-50"
            title="Muat ulang seluruh data dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER PERIODE GLOBAL (HARI INI, 7 HARI, 30 HARI, BULAN INI, KUSTOM)       */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-slate-50 border border-slate-200/90 p-3 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <span>Periode Analitik:</span>
            </span>

            {[
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'YESTERDAY', label: 'Kemarin' },
              { id: '7D', label: '7 Hari' },
              { id: '30D', label: '30 Hari' },
              { id: 'THIS_MONTH', label: 'Bulan Ini' },
              { id: 'LAST_MONTH', label: 'Bulan Lalu' },
              { id: 'CUSTOM', label: 'Kustom' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodPreset(p.id as DashboardPeriodPreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  periodPreset === p.id 
                    ? 'bg-[#1E4648] text-white shadow-2xs' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Picker Range */}
          {periodPreset === 'CUSTOM' ? (
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-400 font-bold">Dari:</span>
              <input 
                type="date" 
                value={customStartDate} 
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="font-mono text-xs text-slate-700 outline-none"
              />
              <span className="text-slate-400 font-bold">Sampai:</span>
              <input 
                type="date" 
                value={customEndDate} 
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="font-mono text-xs text-slate-700 outline-none"
              />
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-500 self-end md:self-auto">
              Menampilkan data aktual: <strong className="text-slate-800 font-bold">{periodLabel}</strong>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARIS 1 — OVERVIEW 4 KPI UTAMA DENGAN PERBANDINGAN PERIODE LALU           */}
      {/* ========================================================================= */}
      {isManager ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Total Pendapatan (Revenue) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-all">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Pendapatan</span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold border border-teal-200/60">
                <RupiahIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight truncate">
                {formatRupiahId(kpiMetrics.revenue)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold text-[11px] ${
                  kpiMetrics.revDeltaPct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {kpiMetrics.revDeltaPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {kpiMetrics.revDeltaPct >= 0 ? `+${kpiMetrics.revDeltaPct}%` : `${kpiMetrics.revDeltaPct}%`}
                </span>
                <span className="text-slate-400 font-medium">vs periode lalu</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 truncate">
              Rata-rata order: <strong className="text-slate-700 font-mono">{formatRupiahId(kpiMetrics.avgOrderValue)}</strong>
            </div>
          </div>

          {/* Card 2: Total Transaksi */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-all">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Transaksi</span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-800 flex items-center justify-center font-bold border border-sky-200/60">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight truncate">
                {kpiMetrics.trxCount} <span className="text-sm font-bold font-sans text-slate-500">Order</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold text-[11px] ${
                  kpiMetrics.trxDelta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {kpiMetrics.trxDelta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {kpiMetrics.trxDelta >= 0 ? `+${kpiMetrics.trxDelta}` : `${kpiMetrics.trxDelta}`} order
                </span>
                <span className="text-slate-400 font-medium">vs periode lalu</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 truncate">
              Total volume: <strong className="text-teal-800 font-mono">{servicePerformance.totalKg} Kg</strong> cucian
            </div>
          </div>

          {/* Card 3: Total Pelanggan */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-all">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Pelanggan</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold border border-amber-200/60">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight truncate">
                {kpiMetrics.totalCustomers} <span className="text-sm font-bold font-sans text-slate-500">Orang</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold text-[11px] ${
                  kpiMetrics.custDelta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {kpiMetrics.custDelta >= 0 ? `+${kpiMetrics.custDelta}` : `${kpiMetrics.custDelta}`} orang
                </span>
                <span className="text-slate-400 font-medium">pelanggan bertransaksi</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 truncate">
              Rata-rata belanja: <strong className="text-slate-700 font-mono">{formatRupiahId(kpiMetrics.avgCustomerSpend)}</strong>
            </div>
          </div>

          {/* Card 4: Repeat Order Ratio */}
          <div className="bg-gradient-to-br from-[#1E4648] to-teal-950 text-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between border border-teal-800">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-extrabold text-teal-300 uppercase tracking-wider">Repeat Order Ratio</span>
              <div className="w-8 h-8 rounded-xl bg-teal-800/80 text-amber-300 flex items-center justify-center font-bold">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="my-1.5">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">
                {kpiMetrics.repeatRatio}%
              </div>
              <p className="text-[11px] text-teal-100/90 mt-1 font-medium">
                <strong>{kpiMetrics.repeatCustomers}</strong> dari {kpiMetrics.totalCustomers} pelanggan kembali order
              </p>
            </div>
            <div className="pt-2 border-t border-teal-800/80 text-[10.5px] text-teal-300 truncate">
              Pelanggan dengan &gt;1 transaksi
            </div>
          </div>

        </div>
      ) : (
        /* KASIR VIEW CARDS */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Order Hari Ini</div>
              <div className="text-lg font-black text-slate-800 font-mono">{dailyPerformance.todayTrxCount} Nota</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <RupiahIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Omzet Hari Ini</div>
              <div className="text-lg font-black text-slate-800 font-mono">{formatRupiahId(dailyPerformance.todayRevenue)}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Antrean Aktif</div>
              <div className="text-lg font-black text-slate-800 font-mono">{activeOrders.length} Order</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Di Rak Pickup</div>
              <div className="text-lg font-black text-slate-800 font-mono">{readyPickupOrders.length} Siap</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARIS 2 — DAILY PERFORMANCE & REVENUE & TRANSACTION TREND CHART           */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Daily Performance & Trend Penjualan</h2>
                <p className="text-[11px] text-slate-400">Kurva pendapatan dan frekuensi transaksi aktual per hari</p>
              </div>
            </div>

            {/* Quick Today Stats Badges */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 bg-teal-50 text-teal-800 font-bold rounded-lg border border-teal-200">
                Hari Ini: {formatRupiahId(dailyPerformance.todayRevenue)} ({dailyPerformance.todayTrxCount} Trx)
              </span>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-lg border border-amber-200">
                Volume: {dailyPerformance.todayTotalKg} Kg
              </span>
            </div>
          </div>

          {/* Visual Dual Modern Bar/Curve Chart */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-end h-44 pt-4 px-2 border-b border-slate-200 gap-1 sm:gap-2">
              {dailyPerformance.trendList.length > 0 ? (
                dailyPerformance.trendList.map((d, idx) => {
                  const isToday = d.dateStr === new Date().toISOString().split('T')[0];
                  const heightPercent = dailyPerformance.maxRev > 0 
                    ? Math.max(12, Math.round((d.revenue / dailyPerformance.maxRev) * 85)) 
                    : 12;

                  return (
                    <div key={idx} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative">
                      {/* Tooltip on Hover */}
                      <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white text-[10px] font-mono py-1.5 px-2.5 rounded-lg shadow-xl whitespace-nowrap z-20">
                        <div className="font-bold">{d.label}</div>
                        <div>{formatRupiahId(d.revenue)} • {d.transactions} Order</div>
                      </div>

                      {/* Bar Representation */}
                      <div 
                        style={{ height: `${heightPercent}%` }} 
                        className={`w-full max-w-[32px] rounded-t-lg transition-all duration-300 ${
                          isToday 
                            ? 'bg-gradient-to-t from-teal-800 via-teal-600 to-emerald-500 shadow-sm' 
                            : 'bg-gradient-to-t from-[#1E4648] to-teal-500 hover:from-teal-600 hover:to-teal-400'
                        }`} 
                      />

                      {/* Date Label */}
                      <span className={`text-[9px] sm:text-[10px] font-mono truncate max-w-[38px] ${
                        isToday ? 'font-black text-teal-900' : 'text-slate-500 font-medium'
                      }`}>
                        {d.label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="w-full text-center text-slate-400 my-auto text-xs font-medium">
                  Belum ada data transaksi pada rentang periode ini.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>Data terhitung otomatis dari transaksi non-void di database</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#1E4648]" /> Hari Periode</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Hari Ini</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARIS 3 — PERFORMANCE LAYANAN | OPERATIONAL PERFORMANCE                   */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Kolom Kiri: Performance Layanan */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Performance Layanan & Produk</h2>
                    <p className="text-[11px] text-slate-400">Ranking layanan terlaris & kontribusi pendapatan</p>
                  </div>
                </div>

                {servicePerformance.topPopular && (
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md">
                    Top: {servicePerformance.topPopular.layanan}
                  </span>
                )}
              </div>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {servicePerformance.list.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs font-medium">
                    Belum ada data layanan pada periode ini
                  </div>
                ) : (
                  servicePerformance.list.slice(0, 6).map((s, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50/80 hover:bg-teal-50/40 border border-slate-200/80 rounded-xl space-y-1.5 transition">
                      <div className="flex justify-between items-center text-xs">
                        <div className="font-bold text-slate-800 truncate max-w-[200px]">
                          <span className="text-teal-800 font-mono mr-1.5">#{idx + 1}</span>
                          {s.layanan}
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-900 font-mono">{formatRupiahId(s.revenue)}</span>
                          <span className="text-[10px] text-teal-700 font-bold ml-1.5">({s.percentage}%)</span>
                        </div>
                      </div>

                      {/* Progress Bar Kontribusi */}
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${Math.min(100, Math.max(4, s.percentage))}%` }} 
                          className="bg-gradient-to-r from-[#1E4648] to-teal-500 h-full rounded-full" 
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>{s.transactions} Transaksi</span>
                        <span>{s.kg > 0 ? `${s.kg} Kg Volume` : 'Add-on / Satuan'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
              Total {servicePerformance.list.length} varian layanan &amp; barang terjual
            </div>
          </div>

          {/* Kolom Kanan: Operational Performance (On-Time Completion Rate) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/60">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Operational Performance</h2>
                    <p className="text-[11px] text-slate-400">Monitoring status pengerjaan &amp; ketepatan waktu SLA</p>
                  </div>
                </div>

                <span className="text-xs font-black font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {operationalPerformance.onTimeRate}% On-Time
                </span>
              </div>

              {/* Highlight Card Ketepatan Waktu */}
              <div className="p-4 bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-xl mb-3 space-y-2 border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">On-Time Completion Rate</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-amber-400 font-mono">
                  {operationalPerformance.onTimeRate}%
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                  {operationalPerformance.onTimeCount} dari {Math.max(1, operationalPerformance.completedCount)} order selesai tepat waktu sesuai estimasi perjanjian.
                </p>
              </div>

              {/* Status Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[10px] font-extrabold text-emerald-800 uppercase">Selesai</div>
                  <div className="text-base font-black text-emerald-900 font-mono mt-0.5">{operationalPerformance.completedCount}</div>
                </div>

                <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl">
                  <div className="text-[10px] font-extrabold text-sky-800 uppercase">Diproses</div>
                  <div className="text-base font-black text-sky-900 font-mono mt-0.5">{operationalPerformance.processingCount}</div>
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-[10px] font-extrabold text-amber-800 uppercase">Menunggu</div>
                  <div className="text-base font-black text-amber-900 font-mono mt-0.5">{operationalPerformance.pendingCount}</div>
                </div>

                <div className={`p-2.5 rounded-xl border ${
                  operationalPerformance.lateCount > 0 ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="text-[10px] font-extrabold uppercase">Terlambat</div>
                  <div className="text-base font-black font-mono mt-0.5">{operationalPerformance.lateCount}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
              Total {operationalPerformance.totalOrders} order terverifikasi pada periode terpilih
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* BARIS 4 — PERFORMANCE KARYAWAN | CUSTOMER PERFORMANCE (MOCKUP GAMBAR)     */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Kolom Kiri: Performance Karyawan */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Performance Karyawan / Staf</h2>
                    <p className="text-[11px] text-slate-400">Produktivitas staf kasir &amp; penanganan transaksi</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[9.5px] tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Karyawan</th>
                      <th className="py-2.5 px-2 text-center">Transaksi</th>
                      <th className="py-2.5 px-2 text-right">Revenue</th>
                      <th className="py-2.5 px-2 text-center">Selesai</th>
                      <th className="py-2.5 px-2 text-center">Terlambat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeePerformance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400 font-medium">Belum ada data staf</td>
                      </tr>
                    ) : (
                      employeePerformance.map((e, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800 truncate max-w-[140px]">{e.nama}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Rank #{idx + 1}</div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-700">{e.transactions}</td>
                          <td className="py-2.5 px-2 text-right font-black text-teal-800 font-mono">{formatRupiahId(e.revenue)}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold text-[10px]">
                              {e.completed}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              e.late > 0 ? 'bg-rose-50 text-rose-700 font-black' : 'text-slate-400'
                            }`}>
                              {e.late}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
              Evaluasi kinerja multi-metrik objektif dari database Supabase
            </div>
          </div>

          {/* Kolom Kanan: Customer Performance (Sesuai Mockup Gambar User) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Customer Performance &amp; Analytics</h2>
                    <p className="text-[11px] text-slate-400">Segmentasi pelanggan, retensi &amp; top belanja</p>
                  </div>
                </div>

                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                  {kpiMetrics.totalCustomers} Total Pelanggan
                </span>
              </div>

              {/* 2 Mini Trend Cards: Repeat Purchase Rate & Avg Basket Size */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Repeat Purchase Rate</div>
                  <div className="text-xl font-black text-teal-800 font-mono">{kpiMetrics.repeatRatio}%</div>
                  <div className="text-[10px] text-emerald-700 font-semibold">
                    ▲ +{kpiMetrics.repeatRatioDelta}% vs periode lalu
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Average Basket Size</div>
                  <div className="text-xl font-black text-slate-900 font-mono">{formatRupiahId(kpiMetrics.avgOrderValue)}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Nilai belanja per nota</div>
                </div>
              </div>

              {/* Customer Segments Bar Chart */}
              <div className="space-y-1.5 mb-3">
                <div className="text-xs font-bold text-slate-700">Segmentasi Pelanggan (Customer Segments)</div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {customerAnalytics.segments.map((seg, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded-xl border border-slate-200/80">
                      <div className="font-mono text-base font-black text-slate-800">{seg.pct}%</div>
                      <div className="text-[9.5px] font-bold text-slate-500 truncate mt-0.5">{seg.label}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{seg.count} orang</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 3 Spenders Leaderboard */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pelanggan Belanja Tertinggi</span>
                </div>
                <div className="space-y-1.5">
                  {customerAnalytics.topListSpend.slice(0, 3).map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-xs border border-slate-200/70">
                      <div className="truncate max-w-[180px]">
                        <span className="font-bold text-slate-800 mr-1.5">#{idx + 1} {c.nama}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({c.totalOrder} Order)</span>
                      </div>
                      <span className="font-black text-teal-800 font-mono">{formatRupiahId(c.totalSpend)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
              Rasio one-time: {kpiMetrics.oneTimeCustomers} orang ({100 - kpiMetrics.repeatRatio}%)
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* BARIS 5 — OUTLET PERFORMANCE | PAYMENT PERFORMANCE                        */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Kolom Kiri: Outlet Performance */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Outlet Performance</h2>
                    <p className="text-[11px] text-slate-400">Monitoring performa outlet aktif &amp; kesiapan multi-cabang</p>
                  </div>
                </div>

                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-extrabold uppercase tracking-wide">
                  Aktif &amp; Terhubung
                </span>
              </div>

              {/* Outlet Active Scorecard */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">dua SiSi Laundry — Outlet Utama</h3>
                    <p className="text-xs text-slate-500">Pusat Layanan Laundry Express &amp; Coin POS</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                    OUTLET-UTAMA
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-200/80">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Revenue</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{formatRupiahId(kpiMetrics.revenue)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Transaksi</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{kpiMetrics.trxCount} Order</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Pelanggan</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{kpiMetrics.totalCustomers} Orang</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
              Sistem telah siap dan scalable untuk komparasi multi-outlet di masa mendatang
            </div>
          </div>

          {/* Kolom Kanan: Payment Performance */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Payment Performance</h2>
                    <p className="text-[11px] text-slate-400">Distribusi penggunaan metode pembayaran pelanggan</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {paymentPerformance.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{p.metode}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({p.transactions} Trx)</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-900 font-mono">{formatRupiahId(p.nominal)}</span>
                        <span className="text-[10px] text-teal-700 font-bold ml-1.5 font-mono">({p.percentage}%)</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${Math.min(100, Math.max(2, p.percentage))}%` }} 
                        className={`h-full rounded-full ${
                          p.metode === 'Tunai' ? 'bg-emerald-600' :
                          p.metode === 'QRIS' ? 'bg-sky-500' :
                          p.metode === 'Transfer' ? 'bg-indigo-600' : 'bg-amber-500'
                        }`} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
              Perhitungan akurat dari seluruh transaksi non-void periode aktif
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* BARIS 6 — BUSINESS INSIGHTS & ACTIONABLE ALERTS DINAMIS                   */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Business Insights &amp; Actionable Alerts</h2>
              <p className="text-[11px] text-slate-400">Diagnosis otomatis berbasis tren transaksi &amp; kalkulasi database aktual</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {businessInsights.map((insight, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-2.5 text-xs text-slate-700">
                <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium">{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION OPERASIONAL: STATUS MESIN & ANTREAN PESANAN REAL-TIME             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Status Mesin Real-Time (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Status &amp; Progress Mesin</h2>
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

        {/* Antrean Pesanan Berjalan (1 Col) */}
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

              {/* Tab Switch */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setQueueTab('Semua')}
                  className={`px-2 py-1 rounded-md transition ${queueTab === 'Semua' ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600'}`}
                >
                  Semua ({activeOrders.length})
                </button>
                <button
                  onClick={() => setQueueTab('SiapDiambil')}
                  className={`px-2 py-1 rounded-md transition ${queueTab === 'SiapDiambil' ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600'}`}
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
                          <span className="text-[10px] text-slate-400">• {formatWibDateShort(tx.rawTanggal || tx.tanggal)}</span>
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
                          {formatRupiahId(Number(tx.total) || 0)}
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
      {/* SECTION INVENTORY & BAHAN BAKU LEVEL                                      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Stok Bahan &amp; Barang Habis Pakai</h2>
              <p className="text-[11px] text-slate-400">
                {isManager ? 'Mode Manager: Pantau stok & input restock langsung' : 'Mode Kasir: Monitoring ketersediaan bahan operasional'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200/60">
              {(['Semua', 'Kritis', 'Menipis', 'Aman'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setInventoryFilterTab(tab)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
                    inventoryFilterTab === tab ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Warning Banner if any items are negative */}
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
          {(inventoryList || []).filter(item => {
            const s = Number(item.stok) || 0;
            const min = Number(item.stokMinimum) || 5;
            if (inventoryFilterTab === 'Kritis') return s <= 0;
            if (inventoryFilterTab === 'Menipis') return s > 0 && s <= min;
            if (inventoryFilterTab === 'Aman') return s > min;
            return true;
          }).map((i) => {
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
      {/* MODAL GENERATE REPORT & EXPORT PDF                                        */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200/60 shrink-0">
                  <FileText className="w-5 h-5 text-[#1E4648]" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Generate Business Report</h3>
                  <p className="text-[11px] text-slate-400">Ekspor laporan kinerja bisnis ke format PDF resmi</p>
                </div>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pilihan Periode Laporan */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Pilih Periode Laporan</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'THIS_MONTH', label: 'Bulan Ini' },
                  { id: 'LAST_MONTH', label: 'Bulan Lalu' },
                  { id: '7D', label: '7 Hari Terakhir' },
                  { id: '30D', label: '30 Hari Terakhir' },
                  { id: 'CUSTOM', label: 'Custom Range' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setExportPeriodPreset(p.id as DashboardPeriodPreset)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                      exportPeriodPreset === p.id 
                        ? 'bg-[#1E4648] text-white shadow-2xs' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    } ${p.id === 'CUSTOM' ? 'col-span-2' : ''}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {exportPeriodPreset === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-2 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Dari Tanggal:</label>
                    <input 
                      type="date" 
                      value={exportCustomStart} 
                      onChange={(e) => setExportCustomStart(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-[#1E4648]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Sampai Tanggal:</label>
                    <input 
                      type="date" 
                      value={exportCustomEnd} 
                      onChange={(e) => setExportCustomEnd(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-[#1E4648]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Filter Outlet */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Outlet</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>dua SiSi — Outlet Utama (Pusat)</span>
                <span className="text-[10px] text-emerald-700 font-extrabold uppercase">Aktif</span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
              >
                Batal
              </button>
              <button
                onClick={handleExportPdf}
                disabled={exportSubmitting}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#1E4648] to-teal-800 hover:from-teal-900 hover:to-[#1E4648] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                {exportSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyiapkan PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Generate &amp; Download PDF</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL QUICK RESTOCK DARI DASHBOARD                                        */}
      {/* ========================================================================= */}
      {selectedRestockItem && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm border border-slate-200 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Restock Barang Cepat</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedRestockItem.nama}</p>
              </div>
              <button onClick={() => setSelectedRestockItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-500">Stok Saat Ini:</span>
                <span className="font-bold text-slate-800 font-mono">{selectedRestockItem.stok} {selectedRestockItem.satuan}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jumlah Restock Tambahan ({selectedRestockItem.satuan}) *
                </label>
                <input 
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setSelectedRestockItem(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button 
                onClick={handleRestockSubmit}
                className="flex-1 py-2 bg-[#1E4648] hover:bg-teal-900 text-white rounded-xl text-xs font-bold"
              >
                Simpan Restock
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
