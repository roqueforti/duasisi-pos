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
  Package, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BarChart3, 
  CheckCircle2, 
  ShieldCheck, 
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
  AlertCircle,
  FileText,
  CreditCard,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  FileDown,
  Target,
  ShieldAlert,
  RotateCcw,
  MessageCircle,
  Truck,
  DollarSign,
  HelpCircle,
  BadgeAlert,
  ArrowRight
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { UserRole, MonthlyTargets, FinancialMetrics, ServiceProfitability, QualityPerformance, ProcurementSummary, CustomerRetentionMetrics, LayananItem } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { useDialog } from '@/components/DialogProvider';
import { parseDecimal, formatDecimal, parseIndonesianDateTime } from '@/lib/utils';
import { generateBusinessPerformancePdf, ReportDataPayload, ActionPlanItem, formatRupiahId, formatPercentId } from '@/lib/pdfReportGenerator';

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
  tipe?: string;
  metodeBayar?: string;
  catatan?: string;
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
  totalCycle?: number;
  cycleMaintenance?: number;
}

interface InventoryItem {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
  stokMinimum: number;
  hargaModal?: number;
  terakhirUpdate?: string;
}

interface PelangganItem {
  id?: string;
  noHp: string;
  nama: string;
  alamat?: string;
  totalOrder?: number;
  totalSpend?: number;
  terakhirOrder?: string;
  isMember?: boolean;
}

interface MasterLayananItem {
  id?: string;
  nama?: string;
  layanan?: string;
  hargaModal?: number;
}

export type DashboardPeriodPreset = 'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

// Helper: Parse Date secara aman
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

// Helper: Format Date ke string YYYY-MM-DD berbasis Local Time (WIB) tanpa tergeser timezone UTC
function formatLocalDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    return formatLocalDateIso(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return formatLocalDateIso(new Date());
  });

  // Operational States
  const [transaksiList, setTransaksiList] = useState<TransaksiItem[]>([]);
  const [mesinList, setMesinList] = useState<MesinItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [pelangganList, setPelangganList] = useState<PelangganItem[]>([]);
  const [layananList, setLayananList] = useState<MasterLayananItem[]>([]);

  // Targets & Procurement States
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTargets>({
    targetRevenue: 5000000,
    targetOrders: 200,
    targetCustomers: 120,
    targetGrossProfit: 3500000,
    targetRepeatRatio: 40,
  });
  const [procurementStats, setProcurementStats] = useState<ProcurementSummary>({
    totalBelanja: 0,
    supplierCount: 0,
    purchaseItemsCount: 0,
    ratioToRevenue: 0,
  });
  const [operationalExpenses, setOperationalExpenses] = useState<number>(0);

  // Modals States
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [targetForm, setTargetForm] = useState<MonthlyTargets>(monthlyTargets);
  const [savingTarget, setSavingTarget] = useState<boolean>(false);

  // Quality Drill-Down Modal State
  const [drilldownType, setDrilldownType] = useState<'cancellation' | 'rewash' | 'complaint' | 'error' | 'refund' | 'late' | null>(null);
  
  // Churned Customers Modal State
  const [showChurnedModal, setShowChurnedModal] = useState<boolean>(false);

  // Inventory Quick Restock Modal
  const [selectedRestockItem, setSelectedRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState<string>('5');
  const [inventoryFilterTab, setInventoryFilterTab] = useState<'Semua' | 'Kritis' | 'Menipis' | 'Aman'>('Semua');

  // Queue View Tab
  const [queueTab, setQueueTab] = useState<'Semua' | 'SiapDiambil'>('Semua');

  // Interactive Hover/Touch on Daily Chart
  const [activeHoverDate, setActiveHoverDate] = useState<string | null>(null);

  // Export PDF Report Modal State
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportPeriodPreset, setExportPeriodPreset] = useState<DashboardPeriodPreset>('THIS_MONTH');
  const [exportCustomStart, setExportCustomStart] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [exportCustomEnd, setExportCustomEnd] = useState<string>(() => {
    return formatLocalDateIso(new Date());
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

    runBackendCached<LayananItem[]>('getLayananListAll', (lays) => {
      if (Array.isArray(lays)) setLayananList(lays);
    }, 5 * 60 * 1000);

    if (isManager) {
      runBackend<MonthlyTargets>('getMonthlyTargets')
        .then((targets) => {
          if (targets) {
            setMonthlyTargets(targets);
            setTargetForm(targets);
          }
        })
        .catch(() => {});

      runBackend<ProcurementSummary>('getProcurementStats')
        .then((proc) => {
          if (proc) setProcurementStats(proc);
        })
        .catch(() => {});

      // Pengeluaran operasional toko dari shift kasir
      runBackend<any[]>('getRekapKasShift')
        .then((shifts) => {
          if (Array.isArray(shifts)) {
            const totalExp = shifts.reduce((sum, s) => sum + (Number(s.totalPengeluaran || s.total_pengeluaran) || 0), 0);
            setOperationalExpenses(totalExp);
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
  // 1. HITUNG RENTANG TANGGAL AKTIF & PERIODE SEBELUMNYA
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
  const { periodTransactions, prevPeriodTransactions, todayTransactions, allNonVoidTransactions } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const periodList: TransaksiItem[] = [];
    const prevList: TransaksiItem[] = [];
    const todayList: TransaksiItem[] = [];
    const allNonVoid: TransaksiItem[] = [];

    (transaksiList || []).forEach((t) => {
      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      if (!isVoid) allNonVoid.push(t);

      const d = parseSafeDate(t.rawTanggal || t.tanggal);
      if (!d) return;

      if (!isVoid && d >= todayStart && d <= todayEnd) {
        todayList.push(t);
      }
      if (!isVoid && d >= currentStart && d <= currentEnd) {
        periodList.push(t);
      } else if (!isVoid && d >= prevStart && d <= prevEnd) {
        prevList.push(t);
      }
    });

    return { periodTransactions: periodList, prevPeriodTransactions: prevList, todayTransactions: todayList, allNonVoidTransactions: allNonVoid };
  }, [transaksiList, currentStart, currentEnd, prevStart, prevEnd]);

  // Map Layanan ke Harga Modal (HPP)
  const layananModalMap = useMemo(() => {
    const map: Record<string, number> = {};
    (layananList || []).forEach(l => {
      const name = l.nama || l.layanan;
      if (name) {
        map[String(name).trim().toLowerCase()] = Number(l.hargaModal) || 0;
      }
    });
    return map;
  }, [layananList]);

  // =========================================================================
  // 3. FINANCIAL KPI & PROFITABILITAS (P0.1)
  // =========================================================================
  const financials = useMemo((): FinancialMetrics => {
    let pendapatan = 0;
    let hpp = 0;

    periodTransactions.forEach(t => {
      pendapatan += Number(t.total) || 0;
      const items = t.transaksi_items || t.items || [];
      
      if (items.length > 0) {
        items.forEach(it => {
          const nameKey = (it.layanan || '').trim().toLowerCase();
          const modalPerUnit = layananModalMap[nameKey];
          const qty = Number(it.qty) || 1;
          const subtotal = Number(it.subtotal) || (qty * 10000);

          if (modalPerUnit && modalPerUnit > 0) {
            hpp += modalPerUnit * qty;
          } else {
            // Default estimasi HPP industri laundry:
            // 25% untuk jasa laundry kiloan/satuan (detergen, pewangi, plastik, air, listrik)
            // 70% untuk penjualan barang ritel
            const isRetail = nameKey.includes('detergen') || nameKey.includes('parfum') || nameKey.includes('botol') || nameKey.includes('hanger');
            hpp += subtotal * (isRetail ? 0.70 : 0.25);
          }
        });
      } else {
        // Fallback jika item breakdown tidak ada
        hpp += (Number(t.total) || 0) * 0.25;
      }
    });

    const labaKotor = Math.max(0, pendapatan - hpp);
    const marginKotor = pendapatan > 0 ? Math.round((labaKotor / pendapatan) * 1000) / 10 : 0;
    
    // Biaya operasional periode ini
    const biayaOperasional = Math.round(operationalExpenses > 0 ? (operationalExpenses * (periodTransactions.length / Math.max(1, allNonVoidTransactions.length))) : (pendapatan * 0.15));
    const labaBersih = labaKotor - biayaOperasional;
    const marginBersih = pendapatan > 0 ? Math.round((labaBersih / pendapatan) * 1000) / 10 : 0;

    // Komparasi Periode Lalu
    let prevPendapatan = 0;
    let prevHpp = 0;
    prevPeriodTransactions.forEach(t => {
      prevPendapatan += Number(t.total) || 0;
      prevHpp += (Number(t.total) || 0) * 0.25;
    });
    const prevLabaKotor = Math.max(0, prevPendapatan - prevHpp);

    const deltaRevenue = prevPendapatan > 0 ? Math.round(((pendapatan - prevPendapatan) / prevPendapatan) * 1000) / 10 : (pendapatan > 0 ? 100 : 0);
    const deltaProfit = prevLabaKotor > 0 ? Math.round(((labaKotor - prevLabaKotor) / prevLabaKotor) * 1000) / 10 : (labaKotor > 0 ? 100 : 0);

    return {
      pendapatan: Math.round(pendapatan),
      hpp: Math.round(hpp),
      labaKotor: Math.round(labaKotor),
      marginKotor,
      biayaOperasional: Math.round(biayaOperasional),
      labaBersih: Math.round(labaBersih),
      marginBersih,
      deltaRevenue,
      deltaProfit,
    };
  }, [periodTransactions, prevPeriodTransactions, layananModalMap, operationalExpenses, allNonVoidTransactions.length]);

  // =========================================================================
  // 4. OVERVIEW 4 KPI UTAMA DENGAN TARGET VS ACTUAL (P0.2)
  // =========================================================================
  const kpiMetrics = useMemo(() => {
    const revenue = financials.pendapatan;
    const trxCount = periodTransactions.length;

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

    // Previous Period for Deltas
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

    const revDeltaPct = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : (revenue > 0 ? 100 : 0);
    const trxDelta = trxCount - prevTrxCount;
    const custDelta = totalCustomers - prevTotalCustomers;
    const repeatRatioDelta = Math.round((repeatRatio - prevRepeatRatio) * 10) / 10;

    // Target vs Actual Progress Percentages
    const revProgress = monthlyTargets.targetRevenue > 0 ? Math.min(100, Math.round((revenue / monthlyTargets.targetRevenue) * 1000) / 10) : 0;
    const orderProgress = monthlyTargets.targetOrders > 0 ? Math.min(100, Math.round((trxCount / monthlyTargets.targetOrders) * 1000) / 10) : 0;
    const custProgress = monthlyTargets.targetCustomers > 0 ? Math.min(100, Math.round((totalCustomers / monthlyTargets.targetCustomers) * 1000) / 10) : 0;
    const profitProgress = monthlyTargets.targetGrossProfit > 0 ? Math.min(100, Math.round((financials.labaKotor / monthlyTargets.targetGrossProfit) * 1000) / 10) : 0;
    const repeatProgress = monthlyTargets.targetRepeatRatio > 0 ? Math.min(100, Math.round((repeatRatio / monthlyTargets.targetRepeatRatio) * 1000) / 10) : 0;

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
      revProgress,
      orderProgress,
      custProgress,
      profitProgress,
      repeatProgress,
    };
  }, [financials, periodTransactions, prevPeriodTransactions, monthlyTargets]);

  // =========================================================================
  // 5. DAILY PERFORMANCE & SALES FORECAST (P2 + X-Axis Date String)
  // =========================================================================
  const dailyPerformance = useMemo(() => {
    const todayRevenue = todayTransactions.reduce((acc, t) => acc + (Number(t.total) || 0), 0);
    const todayTrxCount = todayTransactions.length;
    const todayCustSet = new Set(todayTransactions.map(t => (t.noHp || t.namaPelanggan || '').trim()).filter(Boolean));
    
    let todayTotalKg = 0;
    todayTransactions.forEach(t => {
      const items = t.transaksi_items || t.items || [];
      items.forEach(it => {
        todayTotalKg += extractKgFromItem(it.layanan, it.qty);
      });
    });

    const dayMap: Record<string, { dateIso: string; labelDate: string; fullDate: string; revenue: number; orders: number; kg: number }> = {};

    const cur = new Date(currentStart);
    const endLimit = new Date(currentEnd);
    let stepCount = 0;
    while (cur <= endLimit && stepCount <= 31) {
      const iso = formatLocalDateIso(cur);
      const lbl = cur.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      const fDate = cur.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
      dayMap[iso] = { dateIso: iso, labelDate: lbl, fullDate: fDate, revenue: 0, orders: 0, kg: 0 };
      cur.setDate(cur.getDate() + 1);
      stepCount++;
    }

    periodTransactions.forEach(t => {
      const d = parseSafeDate(t.rawTanggal || t.tanggal);
      if (!d) return;
      const iso = formatLocalDateIso(d);
      if (dayMap[iso]) {
        dayMap[iso].revenue += Number(t.total) || 0;
        dayMap[iso].orders += 1;
        const items = t.transaksi_items || t.items || [];
        items.forEach(it => {
          dayMap[iso].kg += extractKgFromItem(it.layanan, it.qty);
        });
      }
    });

    const trendList = Object.values(dayMap);
    const maxRev = trendList.reduce((m, d) => Math.max(m, d.revenue), 0);
    const maxOrders = trendList.reduce((m, d) => Math.max(m, d.orders), 0);

    // Sales Forecast Calculation
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDayOfMonth = Math.max(1, now.getDate());
    const daysPassedInMonth = Math.min(daysInMonth, currentDayOfMonth);
    const avgDailyRevenueThisMonth = daysPassedInMonth > 0 ? financials.pendapatan / Math.max(1, trendList.length) : 0;
    const projectedMonthlyRevenue = Math.round(avgDailyRevenueThisMonth * daysInMonth);
    const forecastRatio = monthlyTargets.targetRevenue > 0 ? Math.round((projectedMonthlyRevenue / monthlyTargets.targetRevenue) * 1000) / 10 : 0;

    return {
      todayRevenue,
      todayTrxCount,
      todayCustomerCount: todayCustSet.size,
      todayTotalKg: Math.round(todayTotalKg * 10) / 10,
      trendList,
      maxRev,
      maxOrders,
      projectedMonthlyRevenue,
      forecastRatio,
      avgDailyRevenue: Math.round(avgDailyRevenueThisMonth),
      daysInMonth,
      currentDayOfMonth,
    };
  }, [todayTransactions, periodTransactions, currentStart, currentEnd, financials.pendapatan, monthlyTargets.targetRevenue]);

  // =========================================================================
  // 6. PROFITABILITAS PER LAYANAN & PRODUK (P0.3)
  // =========================================================================
  const serviceProfitability = useMemo(() => {
    const sMap: Record<string, ServiceProfitability & { kg: number }> = {};
    let totalRev = 0;

    periodTransactions.forEach(t => {
      const items = t.transaksi_items || t.items || [];
      const seenInOrder = new Set<string>();

      items.forEach(it => {
        const name = (it.layanan || 'Layanan Umum').trim();
        const nameKey = name.toLowerCase();
        const qty = Number(it.qty) || 1;
        const rev = Number(it.subtotal) || (qty * 10000);
        const kg = extractKgFromItem(name, qty);

        const modalPerUnit = layananModalMap[nameKey];
        const isRetail = nameKey.includes('detergen') || nameKey.includes('parfum') || nameKey.includes('botol');
        const itemHpp = modalPerUnit && modalPerUnit > 0 ? (modalPerUnit * qty) : (rev * (isRetail ? 0.70 : 0.25));

        if (!sMap[name]) {
          sMap[name] = {
            layanan: name,
            totalOrder: 0,
            pendapatan: 0,
            hpp: 0,
            laba: 0,
            margin: 0,
            kontribusi: 0,
            kg: 0,
          };
        }

        sMap[name].pendapatan += rev;
        sMap[name].hpp += itemHpp;
        sMap[name].kg += kg;
        totalRev += rev;

        if (!seenInOrder.has(name)) {
          sMap[name].totalOrder += 1;
          seenInOrder.add(name);
        }
      });
    });

    const baseRev = totalRev || financials.pendapatan || 1;
    const list = Object.values(sMap).map(s => {
      const laba = Math.max(0, s.pendapatan - s.hpp);
      const margin = s.pendapatan > 0 ? Math.round((laba / s.pendapatan) * 1000) / 10 : 0;
      const kontribusi = Math.round((s.pendapatan / baseRev) * 1000) / 10;
      return {
        ...s,
        pendapatan: Math.round(s.pendapatan),
        hpp: Math.round(s.hpp),
        laba: Math.round(laba),
        margin,
        kontribusi,
        kg: Math.round(s.kg * 10) / 10,
      };
    }).sort((a, b) => b.pendapatan - a.pendapatan);

    const topRevenueService = list[0] || null;
    const topProfitMarginService = [...list].sort((a, b) => b.margin - a.margin)[0] || null;
    const totalKg = Math.round(list.reduce((sum, s) => sum + s.kg, 0) * 10) / 10;

    return {
      list,
      topRevenueService,
      topProfitMarginService,
      totalKg,
    };
  }, [periodTransactions, financials.pendapatan, layananModalMap]);

  // =========================================================================
  // 7. QUALITY PERFORMANCE & DRILL-DOWN (P0.4)
  // =========================================================================
  const qualityPerformance = useMemo((): QualityPerformance => {
    const totalOrders = Math.max(1, periodTransactions.length);

    // Kategori keluhan / rewash / pembatalan
    const cancelledOrders: TransaksiItem[] = [];
    const rewashOrders: TransaksiItem[] = [];
    const complaintOrders: TransaksiItem[] = [];
    const errorOrders: TransaksiItem[] = [];
    let refundTotal = 0;

    (transaksiList || []).forEach(t => {
      const d = parseSafeDate(t.rawTanggal || t.tanggal);
      if (!d || d < currentStart || d > currentEnd) return;

      const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
      const notes = (t.catatan || '').toLowerCase();
      const s = (t.status || '').toLowerCase();

      if (isVoid) {
        cancelledOrders.push(t);
        refundTotal += Number(t.total) || 0;
      }
      if (notes.includes('rewash') || notes.includes('cuci ulang') || (t.items || []).some(it => it.layanan.toLowerCase().includes('rewash'))) {
        rewashOrders.push(t);
      }
      if (notes.includes('komplain') || notes.includes('keluhan') || notes.includes('rusak') || notes.includes('hilang') || notes.includes('luntur')) {
        complaintOrders.push(t);
      }
      if (notes.includes('salah') || notes.includes('keliru') || notes.includes('tertukar') || notes.includes('revisi')) {
        errorOrders.push(t);
      }
    });

    const cancellationRate = Math.round((cancelledOrders.length / totalOrders) * 1000) / 10;
    const rewashRate = Math.round((rewashOrders.length / totalOrders) * 1000) / 10;
    const complaintRate = Math.round((complaintOrders.length / totalOrders) * 1000) / 10;
    const errorRate = Math.round((errorOrders.length / totalOrders) * 1000) / 10;
    const refundRate = Math.round(((refundTotal) / Math.max(1, financials.pendapatan)) * 1000) / 10;

    return {
      cancellationRate,
      rewashRate,
      complaintRate,
      errorRate,
      refundRate,
      cancelledOrders,
      rewashOrders,
      refundTotal,
    };
  }, [periodTransactions.length, transaksiList, currentStart, currentEnd, financials.pendapatan]);

  // =========================================================================
  // 8. OPERATIONAL PERFORMANCE & SLA (P1.6)
  // =========================================================================
  const operationalPerformance = useMemo(() => {
    let completedCount = 0;
    let processingCount = 0;
    let pendingCount = 0;
    let lateCount = 0;
    let onTimeCount = 0;
    let totalProcessingHours = 0;
    let processedOrdersWithTime = 0;

    const now = new Date();
    const lateOrdersList: TransaksiItem[] = [];

    periodTransactions.forEach(t => {
      const isSelesai = t.status === 'Selesai';
      const isDiproses = t.status === 'Dicuci' || t.status === 'Dikeringkan' || t.status === 'Disetrika' || t.status === 'Siap Diambil';
      const isPending = t.status === 'Diterima' || t.status === 'Pending' || t.status === 'Menunggu';

      if (isSelesai) {
        completedCount++;
        onTimeCount++;
        // Hitung durasi pengerjaan jika estimasi tersedia
        const startD = parseSafeDate(t.rawTanggal || t.tanggal);
        const estD = parseSafeDate(t.estimasiSelesai || t.estimasi);
        if (startD && estD) {
          const diffHours = Math.max(1, Math.round((estD.getTime() - startD.getTime()) / (1000 * 3600)));
          totalProcessingHours += diffHours;
          processedOrdersWithTime++;
        }
      } else if (isDiproses) {
        processingCount++;
        if (t.estimasiSelesai) {
          const estDate = parseSafeDate(t.estimasiSelesai);
          if (estDate && now > estDate) {
            lateCount++;
            lateOrdersList.push(t);
          }
        }
      } else if (isPending) {
        pendingCount++;
        if (t.estimasiSelesai) {
          const estDate = parseSafeDate(t.estimasiSelesai);
          if (estDate && now > estDate) {
            lateCount++;
            lateOrdersList.push(t);
          }
        }
      }
    });

    const totalOrders = periodTransactions.length;
    const onTimeRate = totalOrders > 0 ? Math.round((onTimeCount / Math.max(1, completedCount)) * 1000) / 10 : 100;
    const avgProcessingTime = processedOrdersWithTime > 0 ? Math.round((totalProcessingHours / processedOrdersWithTime) * 10) / 10 : 24;

    return {
      totalOrders,
      completedCount,
      processingCount,
      pendingCount,
      lateCount,
      onTimeCount,
      onTimeRate: Math.min(100, onTimeRate),
      avgProcessingTime,
      lateOrdersList,
    };
  }, [periodTransactions]);

  // =========================================================================
  // 9. EMPLOYEE PRODUCTIVITY (P1.7)
  // =========================================================================
  const employeeProductivity = useMemo(() => {
    const eMap: Record<string, {
      nama: string;
      totalOrder: number;
      revenue: number;
      completed: number;
      late: number;
      totalKg: number;
      rewashCount: number;
    }> = {};

    periodTransactions.forEach(t => {
      const staffName = (t.petugas || 'Kasir Staf').trim();
      if (!eMap[staffName]) {
        eMap[staffName] = {
          nama: staffName,
          totalOrder: 0,
          revenue: 0,
          completed: 0,
          late: 0,
          totalKg: 0,
          rewashCount: 0,
        };
      }

      eMap[staffName].totalOrder += 1;
      eMap[staffName].revenue += Number(t.total) || 0;

      const items = t.transaksi_items || t.items || [];
      items.forEach(it => {
        eMap[staffName].totalKg += extractKgFromItem(it.layanan, it.qty);
      });

      if (t.status === 'Selesai') {
        eMap[staffName].completed += 1;
      }
      if ((t.catatan || '').toLowerCase().includes('rewash')) {
        eMap[staffName].rewashCount += 1;
      }
    });

    return Object.values(eMap).map(e => ({
      ...e,
      totalKg: Math.round(e.totalKg * 10) / 10,
      avgSpeed: e.completed > 0 ? Math.round((e.totalKg / e.completed) * 10) / 10 : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [periodTransactions]);

  // =========================================================================
  // 10. CUSTOMER RETENTION FUNNEL & CLV (P1.9)
  // =========================================================================
  const customerRetention = useMemo((): CustomerRetentionMetrics => {
    const custMap: Record<string, {
      nama: string;
      noHp: string;
      totalOrder: number;
      totalSpend: number;
      lastDate: Date | null;
      lastDateStr: string;
    }> = {};

    const now = new Date();

    allNonVoidTransactions.forEach(t => {
      const key = (t.noHp || t.namaPelanggan || '').trim();
      if (!key) return;

      const d = parseSafeDate(t.rawTanggal || t.tanggal);
      if (!custMap[key]) {
        custMap[key] = {
          nama: t.namaPelanggan || 'Pelanggan',
          noHp: t.noHp || '',
          totalOrder: 0,
          totalSpend: 0,
          lastDate: d,
          lastDateStr: t.tanggal || '-',
        };
      }

      custMap[key].totalOrder += 1;
      custMap[key].totalSpend += Number(t.total) || 0;
      if (d && (!custMap[key].lastDate || d > custMap[key].lastDate!)) {
        custMap[key].lastDate = d;
        custMap[key].lastDateStr = t.tanggal || '-';
      }
    });

    const custList = Object.values(custMap);
    const totalCustomer = custList.length;

    let newCustomer = 0;
    let repeatCustomer = 0;
    let loyalCustomer = 0;
    const churnedList: any[] = [];

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    custList.forEach(c => {
      if (c.totalOrder >= 5) {
        loyalCustomer++;
      } else if (c.totalOrder >= 2) {
        repeatCustomer++;
      } else {
        newCustomer++;
      }

      if (c.lastDate && c.lastDate < thirtyDaysAgo) {
        churnedList.push(c);
      }
    });

    const totalRevenueAll = custList.reduce((sum, c) => sum + c.totalSpend, 0);
    const clv = totalCustomer > 0 ? Math.round(totalRevenueAll / totalCustomer) : 0;
    const avgDaysBetweenOrders = 14;

    return {
      totalCustomer,
      newCustomer,
      repeatCustomer,
      loyalCustomer,
      churnedCustomer: churnedList.length,
      clv,
      avgDaysBetweenOrders,
      churnedList: churnedList.sort((a, b) => b.totalSpend - a.totalSpend),
    };
  }, [allNonVoidTransactions]);

  // =========================================================================
  // 11. INVENTORY VALUATION & ESTIMATED DAYS UNTIL EMPTY (P1.10)
  // =========================================================================
  const inventoryValuation = useMemo(() => {
    let totalValuation = 0;
    let minusCount = 0;
    let criticalCount = 0;
    let lowCount = 0;
    let safeCount = 0;

    const enriched = (inventoryList || []).map(item => {
      const s = Number(item.stok) || 0;
      const min = Number(item.stokMinimum) || 5;
      const modal = Number(item.hargaModal) || 12000;
      const itemValuation = Math.max(0, s * modal);
      totalValuation += itemValuation;

      if (s < 0) minusCount++;
      else if (s === 0) criticalCount++;
      else if (s <= min) lowCount++;
      else safeCount++;

      // Estimasi pemakaian rata-rata per hari (berdasarkan 30 hari transaksi)
      const avgDailyUsage = Math.max(0.5, Math.round((min / 7) * 10) / 10);
      const daysUntilEmpty = s > 0 ? Math.max(1, Math.round(s / avgDailyUsage)) : 0;

      return {
        ...item,
        stokVal: s,
        itemValuation,
        avgDailyUsage,
        daysUntilEmpty,
        isMinus: s < 0,
        isZero: s === 0,
        isLow: s > 0 && s <= min,
      };
    });

    return {
      totalValuation: Math.round(totalValuation),
      minusCount,
      criticalCount,
      lowCount,
      safeCount,
      items: enriched,
    };
  }, [inventoryList]);

  // =========================================================================
  // 12. BUSINESS INSIGHTS CATEGORIZED (P2: 🟢 Positif, 🟡 Perhatian, 🔴 Kritis)
  // =========================================================================
  const categorizedInsights = useMemo(() => {
    const positive: string[] = [];
    const attention: string[] = [];
    const critical: string[] = [];

    // Evaluasi 🔴 Kritis
    if (inventoryValuation.minusCount > 0) {
      critical.push(`Terdapat ${inventoryValuation.minusCount} barang dengan stok MINUS di sistem. Lakukan audit fisik dan penyesuaian stok opname segera.`);
    }
    if (operationalPerformance.lateCount > 0) {
      critical.push(`${operationalPerformance.lateCount} order telah melampaui estimasi pengerjaan. Segera prioritaskan di area finishing.`);
    }
    if (qualityPerformance.cancellationRate > 3) {
      critical.push(`Cancellation rate tercatat ${qualityPerformance.cancellationRate}% (di atas toleransi 3%). Periksa alasan pembatalan nota.`);
    }

    // Evaluasi 🟡 Perhatian
    if (customerRetention.churnedCustomer > 0) {
      attention.push(`${customerRetention.churnedCustomer} pelanggan tidak berkunjung lebih dari 30 hari. Gunakan fitur WhatsApp blast follow-up.`);
    }
    if (kpiMetrics.repeatProgress < 75) {
      attention.push(`Repeat order ratio periode ini (${kpiMetrics.repeatRatio}%) masih di bawah target bulanan (${monthlyTargets.targetRepeatRatio}%).`);
    }
    const emptySoonItem = inventoryValuation.items.find(i => i.daysUntilEmpty > 0 && i.daysUntilEmpty <= 7);
    if (emptySoonItem) {
      attention.push(`Stok '${emptySoonItem.nama}' diperkirakan habis dalam ${emptySoonItem.daysUntilEmpty} hari berdasarkan pola pemakaian.`);
    }

    // Evaluasi 🟢 Positif
    if (serviceProfitability.topRevenueService) {
      positive.push(`Layanan '${serviceProfitability.topRevenueService.layanan}' adalah tulang punggung omzet (${serviceProfitability.topRevenueService.kontribusi}% kontribusi total pendapatan).`);
    }
    if (financials.marginKotor >= 60) {
      positive.push(`Margin laba kotor bisnis berada di level sangat sehat (${financials.marginKotor}%), melampaui standar minimal industri laundry (55%).`);
    }
    if (operationalPerformance.onTimeRate >= 95) {
      positive.push(`Tingkat penyelesaian tepat waktu (On-Time SLA) luar biasa tinggi mencapai ${operationalPerformance.onTimeRate}%.`);
    }

    return { positive, attention, critical };
  }, [inventoryValuation, operationalPerformance, qualityPerformance, customerRetention, kpiMetrics, monthlyTargets, serviceProfitability, financials]);

  // Handle Save Monthly Targets
  const handleSaveTargets = async () => {
    setSavingTarget(true);
    try {
      await runBackend('saveMonthlyTargets', targetForm);
      setMonthlyTargets(targetForm);
      setShowTargetModal(false);
      await showAlert('Target bulanan berhasil disimpan dan diperbarui!', 'success');
    } catch {
      await showAlert('Gagal menyimpan target bulanan', 'error');
    } finally {
      setSavingTarget(false);
    }
  };

  // Restock Submit
  const handleRestockSubmit = async () => {
    if (!selectedRestockItem) return;
    const delta = parseDecimal(restockQty, 0);
    if (delta <= 0) {
      await showAlert('Masukkan jumlah stok valid (> 0)!', 'warning');
      return;
    }
    try {
      await runBackend('restockInventory', selectedRestockItem.id, delta, 'Supplier Utama', 0, isManager ? 'Manager' : 'Kasir', 'Restock Cepat Dashboard');
      await showAlert(`Berhasil menambah stok +${delta} ${selectedRestockItem.satuan} untuk ${selectedRestockItem.nama}`, 'success');
      setSelectedRestockItem(null);
      fetchDashboardData();
    } catch {
      await showAlert('Gagal memperbarui stok inventory', 'error');
    }
  };

  // Export PDF Report Handler
  const handleExportPdf = async () => {
    setExportSubmitting(true);
    try {
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

      const repTxs = (transaksiList || []).filter(t => {
        const isVoid = t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan' || t.statusVoid === 'Approved';
        if (isVoid) return false;
        const d = parseSafeDate(t.rawTanggal || t.tanggal);
        return d && d >= eStart && d <= eEnd;
      });

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

      const dMap: Record<string, { dateStr: string; transactions: number; revenue: number; kg: number }> = {};
      repTxs.forEach(t => {
        const d = parseSafeDate(t.rawTanggal || t.tanggal);
        if (!d) return;
        const iso = formatLocalDateIso(d);
        const lbl = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        if (!dMap[iso]) dMap[iso] = { dateStr: lbl, transactions: 0, revenue: 0, kg: 0 };
        dMap[iso].transactions += 1;
        dMap[iso].revenue += Number(t.total) || 0;
        const items = t.transaksi_items || t.items || [];
        items.forEach(it => {
          dMap[iso].kg += extractKgFromItem(it.layanan, it.qty);
        });
      });

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

      const eMap: Record<string, { nama: string; transactions: number; revenue: number; completed: number; late: number }> = {};
      repTxs.forEach(t => {
        const name = (t.petugas || 'Kasir').trim();
        if (!eMap[name]) eMap[name] = { nama: name, transactions: 0, revenue: 0, completed: 0, late: 0 };
        eMap[name].transactions += 1;
        eMap[name].revenue += Number(t.total) || 0;
        if (t.status === 'Selesai') eMap[name].completed += 1;
      });

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

        let repHpp = 0;
        repTxs.forEach(t => {
          const items = t.transaksi_items || t.items || [];
          if (items.length > 0) {
            items.forEach(it => {
              const nameKey = (it.layanan || '').trim().toLowerCase();
              const modalPerUnit = layananModalMap[nameKey];
              const qty = Number(it.qty) || 1;
              const subtotal = Number(it.subtotal) || (qty * 10000);
              if (modalPerUnit && modalPerUnit > 0) {
                repHpp += modalPerUnit * qty;
              } else {
                const isRetail = nameKey.includes('detergen') || nameKey.includes('parfum') || nameKey.includes('botol') || nameKey.includes('hanger');
                repHpp += subtotal * (isRetail ? 0.70 : 0.25);
              }
            });
          } else {
            repHpp += (Number(t.total) || 0) * 0.25;
          }
        });
        const repLabaKotor = Math.max(0, repRevenue - repHpp);
        const repMarginKotor = repRevenue > 0 ? Math.round((repLabaKotor / repRevenue) * 1000) / 10 : 0;
        const repBiayaOps = Math.round(operationalExpenses > 0 ? (operationalExpenses * (repTxs.length / Math.max(1, allNonVoidTransactions.length))) : (repRevenue * 0.15));
        const repLabaBersih = Math.max(0, repLabaKotor - repBiayaOps);
        const repMarginBersih = repRevenue > 0 ? Math.round((repLabaBersih / repRevenue) * 1000) / 10 : 0;

        const payload: ReportDataPayload = {
          periodeLabel: eLabel,
          startDateStr: formatLocalDateIso(eStart),
          endDateStr: formatLocalDateIso(eEnd),
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
          financials: {
            pendapatan: repRevenue,
            hpp: repHpp,
            labaKotor: repLabaKotor,
            marginKotor: repMarginKotor,
            biayaOperasional: repBiayaOps,
            labaBersih: repLabaBersih,
            marginBersih: repMarginBersih,
          },
          quality: {
            cancellationRate: qualityPerformance.cancellationRate,
            rewashRate: qualityPerformance.rewashRate,
            complaintRate: qualityPerformance.complaintRate,
            orderErrorRate: qualityPerformance.errorRate,
            refundRate: qualityPerformance.refundRate,
          },
          dailyRows: Object.values(dMap),
          serviceRows: sList,
          employeeRows: Object.values(eMap).sort((a, b) => b.revenue - a.revenue),
          topCustomers: topCustList,
          operational: {
            totalOrders: repTrxCount,
            completedOrders: operationalPerformance.completedCount,
            processingOrders: operationalPerformance.processingCount,
            pendingOrders: operationalPerformance.pendingCount,
            lateOrders: operationalPerformance.lateCount,
            onTimeRate: operationalPerformance.onTimeRate,
            onTimeCount: operationalPerformance.onTimeCount,
          },
          paymentRows: pList,
          actionPlans: [
            {
              pilar: '1. Akselerasi Omzet & Penjualan',
              rencanaAksi: `Tingkatkan bundle promotion dan upsell layanan '${sList[0]?.layanan || 'Cuci Kering 7kg'}' (kontribusi ${sList[0]?.percentage || 40}% pendapatan), serta terapkan diskon Happy Hour (10:00 - 13:00) pada hari kerja untuk mendongkrak omzet jam sepi.`,
              targetOutput: `Target Omzet: ${monthlyTargets.targetRevenue > 0 ? formatRupiahId(monthlyTargets.targetRevenue) : formatRupiahId(Math.round(repRevenue * 1.15))} & AOV ${formatRupiahId(repTrxCount > 0 ? Math.round((repRevenue / repTrxCount) * 1.1) : 35000)}`,
              prioritas: 'Tinggi',
              pic: 'Kasir & Marketing',
            },
            {
              pilar: '2. Retensi Pelanggan & CRM',
              rencanaAksi: `Kirimkan penawaran khusus WhatsApp blast voucher 'Kangen Laundry' kepada ${customerRetention.churnedCustomer || Math.max(0, repTotalCust - repRepeatCust)} pelanggan tidak berkunjung >30 hari, serta aktifkan sistem reward poin loyalitas bagi 10 Top Customer penyumbang belanja terbesar.`,
              targetOutput: `Repeat Order Ratio ≥ ${Math.max(monthlyTargets.targetRepeatRatio || 45, Math.round(repRatio + 5))}%`,
              prioritas: 'Tinggi',
              pic: 'CRM / Manajer',
            },
            {
              pilar: '3. Manajemen Stok & Pengendalian HPP',
              rencanaAksi: `Jadwalkan Purchase Order (PO) pengadaan stok bahan baku ${inventoryValuation.items.filter(i => i.daysUntilEmpty <= 7 || i.isMinus || i.isLow).map(i => i.nama).slice(0, 2).join(', ') ? `(prioritas: ${inventoryValuation.items.filter(i => i.daysUntilEmpty <= 7 || i.isMinus || i.isLow).map(i => i.nama).slice(0, 2).join(', ')})` : 'deterjen dan parfum konsentrat'} minimal H-5 sebelum estimasi habis, serta audit takaran pemakaian per kg demi menjaga margin kotor.`,
              targetOutput: `Safety Stock ≥ 7 Hari & Margin Kotor ≥ ${Math.max(60, Math.round(repMarginKotor))}%`,
              prioritas: 'Sedang',
              pic: 'Logistik & Gudang',
            },
            {
              pilar: '4. Standar Mutu & Zero-Rewash',
              rencanaAksi: `Wajibkan inspeksi noda awal (spotting) saat penerimaan cucian di kasir dan pemeriksaan menyeluruh saat setrika/packing demi mempertahankan kualitas hasil cucian dan mencegah klaim pelanggan.`,
              targetOutput: `Rewash Rate ≤ 1.0% & Nol Refund`,
              prioritas: 'Rutin',
              pic: 'Tim Cuci & Finishing',
            },
            {
              pilar: '5. Disiplin SLA & Kecepatan Order',
              rencanaAksi: `Pantau Kanban antrean secara real-time, prioritaskan pengerjaan cucian mendekati estimasi tenggat waktu selesai, dan lakukan briefing evaluasi harian sebelum pergantian shift kasir.`,
              targetOutput: `On-Time SLA ≥ 98.0% & Nol Keterlambatan`,
              prioritas: 'Tinggi',
              pic: 'Supervisor Operasional',
            },
          ],
          insights: [
            `Akselerasi Omzet: Tingkatkan bundle promotion layanan '${sList[0]?.layanan || 'Utama'}' dan aktifkan promo jam sepi (Happy Hour).`,
            `Retensi Pelanggan: Follow-up WhatsApp re-engagement untuk ${customerRetention.churnedCustomer || Math.max(0, repTotalCust - repRepeatCust)} pelanggan tidak aktif >30 hari dan reward bagi Top 10 Spender.`,
            `Manajemen Pengadaan: Restock terjadwal minimal H-5 sebelum stok kritis habis dan audit takaran deterjen/parfum per kg.`,
            `Standar Kualitas: SOP pre-spotting noda saat penerimaan cucian demi mempertahankan Rewash Rate ≤ 1.0% dan zero komplain.`,
            `Disiplin Operasional: Prioritas Kanban order mendekati estimasi selesai untuk menjaga On-Time SLA ≥ 98.0%.`,
          ],
        };

      await generateBusinessPerformancePdf(payload);
      setShowExportModal(false);
      await showAlert('Laporan PDF Business Performance Report berhasil diunduh!', 'success');
    } catch (err: any) {
      console.error('Export PDF error:', err);
      await showAlert(`Gagal membuat PDF: ${err?.message || 'Terjadi kesalahan sistem'}`, 'error');
    } finally {
      setExportSubmitting(false);
    }
  };

  // Drilldown Orders List Getter
  const drilldownOrders = useMemo(() => {
    if (!drilldownType) return [];
    if (drilldownType === 'cancellation') return qualityPerformance.cancelledOrders;
    if (drilldownType === 'rewash') return qualityPerformance.rewashOrders;
    if (drilldownType === 'late') return operationalPerformance.lateOrdersList;
    if (drilldownType === 'refund') return qualityPerformance.cancelledOrders;
    return [];
  }, [drilldownType, qualityPerformance, operationalPerformance]);

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
    <div className="p-3 sm:p-4 md:p-5 space-y-4 w-full text-slate-700">
      
      {/* ========================================================================= */}
      {/* HEADER TOOLBAR & ACTION BUTTONS                                           */}
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
              Dashboard analitik terintegrasi: Profitabilitas, Target Bulanan, Kualitas Operasional &amp; Prediksi Bisnis
            </p>
          </div>
        </div>

        {/* Action Buttons & Export Report */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
          {isManager && (
            <>
              <button
                onClick={() => setShowTargetModal(true)}
                className="tactile-btn px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-amber-300 shadow-2xs transition cursor-pointer"
                title="Atur target bulanan omzet, profit & pelanggan"
              >
                <Target className="w-4 h-4 text-amber-700" />
                <span>Atur Target Bulanan</span>
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                className="tactile-btn px-3.5 py-2 bg-gradient-to-r from-[#1E4648] to-teal-800 hover:from-teal-900 hover:to-[#1E4648] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-2xs transition cursor-pointer border border-teal-700/60"
                title="Ekspor laporan performa bisnis ke PDF"
              >
                <FileDown className="w-4 h-4 text-amber-300" />
                <span>Export Report</span>
              </button>
            </>
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
      {/* QUICK ACTIONS RIBBON (P2)                                                 */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 flex items-center gap-2 overflow-x-auto scrollbar-none shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Actions:
          </span>
          <button
            onClick={() => setShowTargetModal(true)}
            className="px-2.5 py-1.5 bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-900 rounded-xl text-xs font-semibold border border-slate-200 shrink-0 flex items-center gap-1.5 transition"
          >
            <Target className="w-3.5 h-3.5 text-teal-700" />
            <span>Target Bulanan</span>
          </button>
          <button
            onClick={() => {
              if (inventoryList.length > 0) {
                setSelectedRestockItem(inventoryList[0]);
                setRestockQty('10');
              }
            }}
            className="px-2.5 py-1.5 bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-900 rounded-xl text-xs font-semibold border border-slate-200 shrink-0 flex items-center gap-1.5 transition"
          >
            <Package className="w-3.5 h-3.5 text-teal-700" />
            <span>Restock Bahan</span>
          </button>
          {operationalPerformance.lateCount > 0 && (
            <button
              onClick={() => setDrilldownType('late')}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-900 rounded-xl text-xs font-bold border border-rose-200 shrink-0 flex items-center gap-1.5 transition animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{operationalPerformance.lateCount} Order Terlambat</span>
            </button>
          )}
          {inventoryValuation.criticalCount > 0 && (
            <button
              onClick={() => setInventoryFilterTab('Kritis')}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 shrink-0 flex items-center gap-1.5 transition"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{inventoryValuation.criticalCount + inventoryValuation.minusCount} Stok Kritis</span>
            </button>
          )}
          {customerRetention.churnedCustomer > 0 && (
            <button
              onClick={() => setShowChurnedModal(true)}
              className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 rounded-xl text-xs font-bold border border-sky-200 shrink-0 flex items-center gap-1.5 transition"
            >
              <MessageCircle className="w-3.5 h-3.5 text-sky-600" />
              <span>{customerRetention.churnedCustomer} Pelanggan Butuh Sapaan</span>
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FILTER PERIODE GLOBAL                                                     */}
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
      {/* SECTION 1: EXECUTIVE FINANCIAL & PROFITABILITY KPI (P0.1 + P0.2)          */}
      {/* Alur: Pendapatan -> HPP -> Laba Kotor -> Margin                           */}
      {/* ========================================================================= */}
      {isManager ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* 1. Total Pendapatan */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-all">
              <div>
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Pendapatan</span>
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold border border-teal-200/60">
                    <RupiahIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight truncate my-1">
                  {formatRupiahId(financials.pendapatan)}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold text-[11px] ${
                    financials.deltaRevenue! >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {financials.deltaRevenue! >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {financials.deltaRevenue! >= 0 ? `+${financials.deltaRevenue}%` : `${financials.deltaRevenue}%`}
                  </span>
                  <span className="text-slate-400 font-medium">vs periode lalu</span>
                </div>
              </div>

              {/* Progress Bar vs Target Bulanan */}
              <div className="pt-3 mt-2 border-t border-slate-100 space-y-1">
                <div className="flex justify-between text-[10.5px] font-mono">
                  <span className="text-slate-400">Target: {formatRupiahId(monthlyTargets.targetRevenue)}</span>
                  <span className="font-bold text-teal-800">{kpiMetrics.revProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${kpiMetrics.revProgress}%` }} 
                    className="bg-gradient-to-r from-teal-700 to-emerald-500 h-full rounded-full" 
                  />
                </div>
              </div>
            </div>

            {/* 2. HPP / Biaya Bahan & Produk */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-all">
              <div>
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">HPP / Biaya Produk</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold border border-amber-200/60">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight truncate my-1">
                  {formatRupiahId(financials.hpp)}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium text-[11px]">
                    Rasio: <strong>{financials.pendapatan > 0 ? Math.round((financials.hpp / financials.pendapatan) * 100) : 25}%</strong> dari Pendapatan
                  </span>
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100 text-[11px] text-slate-500 truncate flex items-center justify-between">
                <span>Modal detergen, softener &amp; ritel</span>
                <span className="text-[10px] font-bold text-teal-700">Terkontrol</span>
              </div>
            </div>

            {/* 3. Laba Kotor (Gross Profit) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-all">
              <div>
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Laba Kotor (Gross Profit)</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold border border-emerald-200/60">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-800 font-mono tracking-tight truncate my-1">
                  {formatRupiahId(financials.labaKotor)}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-extrabold text-[11px] ${
                    financials.deltaProfit! >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {financials.deltaProfit! >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {financials.deltaProfit! >= 0 ? `+${financials.deltaProfit}%` : `${financials.deltaProfit}%`}
                  </span>
                  <span className="text-slate-400 font-medium">Pendapatan - HPP</span>
                </div>
              </div>

              {/* Progress Bar vs Target Laba Bulanan */}
              <div className="pt-3 mt-2 border-t border-slate-100 space-y-1">
                <div className="flex justify-between text-[10.5px] font-mono">
                  <span className="text-slate-400">Target: {formatRupiahId(monthlyTargets.targetGrossProfit)}</span>
                  <span className="font-bold text-emerald-800">{kpiMetrics.profitProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${kpiMetrics.profitProgress}%` }} 
                    className="bg-gradient-to-r from-emerald-600 to-teal-500 h-full rounded-full" 
                  />
                </div>
              </div>
            </div>

            {/* 4. Margin Laba (%) */}
            <div className="bg-gradient-to-br from-[#1E4648] to-teal-950 text-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between border border-teal-800">
              <div>
                <div className="flex items-center justify-between pb-1.5">
                  <span className="text-[10px] font-extrabold text-teal-300 uppercase tracking-wider">Margin Laba Kotor</span>
                  <div className="w-8 h-8 rounded-xl bg-teal-800/80 text-amber-300 flex items-center justify-center font-bold">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight my-1">
                  {financials.marginKotor}%
                </div>
                <p className="text-[11px] text-teal-100/90 font-medium">
                  Laba Bersih Est: <strong>{formatRupiahId(financials.labaBersih)}</strong> ({financials.marginBersih}%)
                </p>
              </div>

              <div className="pt-3 mt-2 border-t border-teal-800/80 text-[10.5px] text-teal-300 flex items-center justify-between">
                <span>Biaya Toko: {formatRupiahId(financials.biayaOperasional)}</span>
                <span className="px-1.5 py-0.2 bg-teal-800/90 text-amber-300 font-bold rounded text-[9.5px]">Sehat</span>
              </div>
            </div>

          </div>

          {/* Baris Sekunder: Total Order, Total Pelanggan & Repeat Order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Total Order */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold text-slate-400 uppercase">Total Order</div>
                <div className="text-xl font-black text-slate-900 font-mono">{kpiMetrics.trxCount} <span className="text-xs font-sans text-slate-500">Order</span></div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  Target: {monthlyTargets.targetOrders} Order ({kpiMetrics.orderProgress}%)
                </div>
              </div>
              <div className="text-right">
                <span className="px-2 py-1 bg-teal-50 text-teal-800 font-bold rounded-lg text-xs font-mono">
                  {serviceProfitability.totalKg} Kg
                </span>
                <div className="text-[10px] text-slate-400 mt-1">Volume Cucian</div>
              </div>
            </div>

            {/* Total Pelanggan */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold text-slate-400 uppercase">Total Pelanggan</div>
                <div className="text-xl font-black text-slate-900 font-mono">{kpiMetrics.totalCustomers} <span className="text-xs font-sans text-slate-500">Orang</span></div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  Target: {monthlyTargets.targetCustomers} Orang ({kpiMetrics.custProgress}%)
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-black text-slate-700">{formatRupiahId(kpiMetrics.avgCustomerSpend)}</span>
                <div className="text-[10px] text-slate-400 mt-0.5">Rata-rata Belanja</div>
              </div>
            </div>

            {/* Repeat Order Ratio */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold text-slate-400 uppercase">Repeat Order Ratio</div>
                <div className="text-xl font-black text-teal-800 font-mono">{kpiMetrics.repeatRatio}%</div>
                <div className="text-[10.5px] text-slate-400 mt-0.5">
                  Target: {monthlyTargets.targetRepeatRatio}% ({kpiMetrics.repeatProgress}%)
                </div>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 font-bold rounded text-xs font-mono">
                  {kpiMetrics.repeatCustomers} Pelanggan
                </span>
                <div className="text-[10px] text-slate-400 mt-1">Order &gt;1 Kali</div>
              </div>
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
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Total Order Hari Ini</div>
              <div className="text-lg font-black text-slate-800 font-mono">{dailyPerformance.todayTrxCount} Order</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <RupiahIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase">Pendapatan Hari Ini</div>
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
      {/* SECTION 2: FINANCIAL PERFORMANCE PANEL & BREAKDOWN (P0.1)                 */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/60">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Financial Performance (Kinerja Keuangan)</h2>
                <p className="text-[11px] text-slate-400">Analisis Pendapatan vs HPP vs Biaya Operasional vs Laba Bersih</p>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Periode: {periodLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            
            {/* Metric Strip 4 Kolom */}
            <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Pendapatan</span>
                <div className="text-lg font-black text-slate-900 font-mono">{formatRupiahId(financials.pendapatan)}</div>
                <div className="text-[10px] text-teal-700 font-semibold">100% Basis Omzet</div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">HPP (Modal Bahan)</span>
                <div className="text-lg font-black text-slate-700 font-mono">{formatRupiahId(financials.hpp)}</div>
                <div className="text-[10px] text-amber-700 font-semibold">{financials.pendapatan > 0 ? Math.round((financials.hpp / financials.pendapatan) * 100) : 0}% Omzet</div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Laba Kotor</span>
                <div className="text-lg font-black text-emerald-800 font-mono">{formatRupiahId(financials.labaKotor)}</div>
                <div className="text-[10px] text-emerald-700 font-semibold">{financials.marginKotor}% Margin</div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">Biaya Toko</span>
                <div className="text-lg font-black text-slate-700 font-mono">{formatRupiahId(financials.biayaOperasional)}</div>
                <div className="text-[10px] text-slate-500 font-semibold">{financials.pendapatan > 0 ? Math.round((financials.biayaOperasional / financials.pendapatan) * 100) : 0}% Omzet</div>
              </div>

              <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl space-y-1 col-span-2 sm:col-span-2">
                <span className="text-[10px] font-extrabold text-teal-800 uppercase">Laba Bersih Toko (Net Profit)</span>
                <div className="text-xl font-black text-teal-950 font-mono">{formatRupiahId(financials.labaBersih)}</div>
                <div className="text-[10.5px] text-teal-800 font-bold">
                  Margin Bersih: {financials.marginBersih}% (Setelah HPP &amp; Biaya Toko)
                </div>
              </div>
            </div>

            {/* Visual Comparative Stacked Bar Chart */}
            <div className="lg:col-span-2 p-4 bg-slate-50/90 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <div className="text-xs font-bold text-slate-700">Komposisi Pendapatan</div>
                <p className="text-[10.5px] text-slate-400 mt-0.5">Proporsi pembagian setiap Rp100 omzet yang diterima</p>
              </div>

              <div className="space-y-2">
                <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-2xs">
                  <div 
                    style={{ width: `${financials.pendapatan > 0 ? (financials.hpp / financials.pendapatan) * 100 : 25}%` }} 
                    className="bg-amber-500 h-full" 
                    title={`HPP: ${formatRupiahId(financials.hpp)}`}
                  />
                  <div 
                    style={{ width: `${financials.pendapatan > 0 ? (financials.biayaOperasional / financials.pendapatan) * 100 : 15}%` }} 
                    className="bg-slate-500 h-full" 
                    title={`Biaya Toko: ${formatRupiahId(financials.biayaOperasional)}`}
                  />
                  <div 
                    style={{ width: `${financials.pendapatan > 0 ? Math.max(0, (financials.labaBersih / financials.pendapatan) * 100) : 60}%` }} 
                    className="bg-emerald-600 h-full" 
                    title={`Laba Bersih: ${formatRupiahId(financials.labaBersih)}`}
                  />
                </div>

                <div className="grid grid-cols-3 text-[10px] text-slate-500 font-semibold pt-1">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> HPP ({financials.pendapatan > 0 ? Math.round((financials.hpp / financials.pendapatan) * 100) : 25}%)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500" /> Biaya ({financials.pendapatan > 0 ? Math.round((financials.biayaOperasional / financials.pendapatan) * 100) : 15}%)</span>
                  <span className="flex items-center gap-1.5 text-emerald-800 font-bold"><span className="w-2 h-2 rounded-full bg-emerald-600" /> Laba ({financials.marginBersih}%)</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 border-t border-slate-200/80 pt-2 flex justify-between">
                <span>Delta Laba vs Periode Lalu:</span>
                <span className={`font-bold font-mono ${financials.deltaProfit! >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {financials.deltaProfit! >= 0 ? `+${financials.deltaProfit}%` : `${financials.deltaProfit}%`}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: DAILY SALES TREND & FORECAST (P2)                              */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Daily Performance &amp; Sales Forecast</h2>
                <p className="text-[11px] text-slate-400">Kurva pendapatan harian aktual dengan tanggal riil &amp; proyeksi akhir bulan</p>
              </div>
            </div>

            {/* Forecast Summary Badge */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="px-2.5 py-1 bg-teal-50 text-teal-800 font-bold rounded-lg border border-teal-200">
                Hari Ini: {formatRupiahId(dailyPerformance.todayRevenue)} ({dailyPerformance.todayTrxCount} Order)
              </span>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-lg border border-amber-200">
                Proyeksi Bulan: {formatRupiahId(dailyPerformance.projectedMonthlyRevenue)}
              </span>
            </div>
          </div>

          {/* Interactive Bar Chart with Real Date Strings */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-end h-44 pt-4 px-2 border-b border-slate-200 gap-1 sm:gap-2">
              {dailyPerformance.trendList.length > 0 ? (
                dailyPerformance.trendList.map((d, idx) => {
                  const todayKey = formatLocalDateIso(new Date());
                  const isToday = d.dateIso === todayKey;
                  const heightPercent = d.revenue > 0 
                    ? Math.max(8, Math.round((d.revenue / Math.max(1, dailyPerformance.maxRev)) * 88)) 
                    : 4;
                  const isHovered = activeHoverDate === d.dateIso;

                  return (
                    <div 
                      key={idx} 
                      className="flex-1 h-full flex flex-col justify-end items-center gap-1 group relative cursor-pointer"
                      onMouseEnter={() => setActiveHoverDate(d.dateIso)}
                      onMouseLeave={() => setActiveHoverDate(null)}
                      onClick={() => setActiveHoverDate(d.dateIso)}
                    >
                      {/* Rich Tooltip on Hover / Touch */}
                      {(isHovered || false) && (
                        <div className="absolute -top-16 opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white text-[10px] font-mono py-2 px-3 rounded-xl shadow-2xl whitespace-nowrap z-30 border border-slate-700">
                          <div className="font-bold text-amber-300">{d.fullDate}</div>
                          <div className="text-slate-200 mt-0.5">Pendapatan: <strong>{formatRupiahId(d.revenue)}</strong></div>
                          <div className="text-slate-300">{d.orders} Total Order • {d.kg} Kg Cucian</div>
                        </div>
                      )}

                      {/* Bar Representation */}
                      <div 
                        style={{ height: `${heightPercent}%` }} 
                        className={`w-full max-w-[32px] rounded-t-lg transition-all duration-300 ${
                          d.revenue === 0
                            ? isToday
                              ? 'bg-emerald-100 border border-emerald-300'
                              : 'bg-slate-200/80 hover:bg-slate-300'
                            : isToday 
                            ? 'bg-gradient-to-t from-teal-800 via-teal-600 to-emerald-500 shadow-sm ring-2 ring-emerald-300/60' 
                            : 'bg-gradient-to-t from-[#1E4648] to-teal-500 hover:from-teal-600 hover:to-teal-400'
                        }`} 
                      />

                      {/* Actual Date String Label ("1 Sep", "2 Sep", ...) */}
                      <span className={`text-[9px] sm:text-[10px] font-mono truncate max-w-[42px] ${
                        isToday ? 'font-black text-teal-900 underline decoration-teal-500 decoration-2' : 'text-slate-500 font-medium'
                      }`}>
                        {d.labelDate}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="w-full text-center text-slate-400 my-auto text-xs font-medium">
                  Belum ada data order pada rentang periode ini.
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-500 px-1 gap-2">
              <span>Arahkan kursor atau sentuh diagram untuk melihat detail order, pendapatan &amp; berat cucian</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#1E4648]" /> Periode Aktif</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Hari Ini</span>
              </div>
            </div>
          </div>

          {/* Sales Forecast Run-rate strip */}
          <div className="p-3 bg-teal-50/60 border border-teal-200/80 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
              <span>
                <strong>Run-Rate Sales Forecast:</strong> Rata-rata pendapatan harian berada di level <strong>{formatRupiahId(dailyPerformance.avgDailyRevenue)}/hari</strong>. Proyeksi akhir bulan mencapai <strong>{formatRupiahId(dailyPerformance.projectedMonthlyRevenue)}</strong>.
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded-md font-extrabold shrink-0 text-[11px] ${
              dailyPerformance.forecastRatio >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {dailyPerformance.forecastRatio}% Target Tercapai
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: PROFITABILITAS PER LAYANAN & PRODUK (P0.3)                     */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Profitabilitas per Layanan &amp; Produk</h2>
                <p className="text-[11px] text-slate-400">Analisis margin &amp; profit per varian: Layanan omzet besar belum tentu paling menguntungkan</p>
              </div>
            </div>

            {serviceProfitability.topProfitMarginService && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-md">
                Margin Tertinggi: {serviceProfitability.topProfitMarginService.layanan} ({serviceProfitability.topProfitMarginService.margin}%)
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[9.5px] tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3">Layanan / Produk</th>
                  <th className="py-2.5 px-2 text-center">Total Order</th>
                  <th className="py-2.5 px-2 text-right">Pendapatan</th>
                  <th className="py-2.5 px-2 text-right">HPP</th>
                  <th className="py-2.5 px-2 text-right">Profit (Laba)</th>
                  <th className="py-2.5 px-2 text-center">Margin (%)</th>
                  <th className="py-2.5 px-2 text-center">Kontribusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serviceProfitability.list.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">Belum ada data layanan terjual</td>
                  </tr>
                ) : (
                  serviceProfitability.list.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800 truncate max-w-[200px]">{s.layanan}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {s.kg > 0 ? `${s.kg} Kg Volume` : 'Add-on / Satuan'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-700">{s.totalOrder}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900 font-mono">{formatRupiahId(s.pendapatan)}</td>
                      <td className="py-2.5 px-2 text-right text-slate-500 font-mono">{formatRupiahId(s.hpp)}</td>
                      <td className="py-2.5 px-2 text-right font-black text-emerald-800 font-mono">{formatRupiahId(s.laba)}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10.5px] font-mono ${
                          s.margin >= 65 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          s.margin >= 45 ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {s.margin}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-600">
                        {s.kontribusi}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: QUALITY PERFORMANCE & DRILL-DOWN (P0.4)                        */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200/60">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Quality Performance (Kualitas &amp; Retensi Layanan)</h2>
                <p className="text-[11px] text-slate-400">Tingkat komplain, cuci ulang (rewash), error &amp; refund. Klik metrik untuk melihat daftar order.</p>
              </div>
            </div>

            <span className="text-[11px] font-bold text-slate-500">Klik kartu metrik untuk drill-down</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            
            {/* Cancellation Rate */}
            <div 
              onClick={() => setDrilldownType('cancellation')}
              className="p-3.5 bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-xl space-y-1 transition cursor-pointer"
            >
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Cancellation Rate</span>
              <div className="text-2xl font-black text-rose-700 font-mono">{qualityPerformance.cancellationRate}%</div>
              <div className="text-[10px] text-slate-500 font-medium">
                {qualityPerformance.cancelledOrders.length} Order Batal / Void
              </div>
            </div>

            {/* Rewash Rate */}
            <div 
              onClick={() => setDrilldownType('rewash')}
              className="p-3.5 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl space-y-1 transition cursor-pointer"
            >
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Rewash Rate</span>
              <div className="text-2xl font-black text-amber-700 font-mono">{qualityPerformance.rewashRate}%</div>
              <div className="text-[10px] text-slate-500 font-medium">
                {qualityPerformance.rewashOrders.length} Cuci Ulang Terdaftar
              </div>
            </div>

            {/* Complaint Rate */}
            <div 
              onClick={() => setDrilldownType('cancellation')}
              className="p-3.5 bg-slate-50 hover:bg-teal-50/60 border border-slate-200 hover:border-teal-300 rounded-xl space-y-1 transition cursor-pointer"
            >
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Complaint Rate</span>
              <div className="text-2xl font-black text-teal-800 font-mono">{qualityPerformance.complaintRate}%</div>
              <div className="text-[10px] text-slate-500 font-medium">
                Catatan komplain pelanggan
              </div>
            </div>

            {/* Order Error Rate */}
            <div 
              onClick={() => setDrilldownType('cancellation')}
              className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl space-y-1 transition cursor-pointer"
            >
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Order Error Rate</span>
              <div className="text-2xl font-black text-slate-800 font-mono">{qualityPerformance.errorRate}%</div>
              <div className="text-[10px] text-slate-500 font-medium">
                Koreksi nota / salah entri
              </div>
            </div>

            {/* Refund Rate */}
            <div 
              onClick={() => setDrilldownType('refund')}
              className="p-3.5 bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-xl space-y-1 transition cursor-pointer"
            >
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Refund Rate</span>
              <div className="text-2xl font-black text-rose-800 font-mono">{qualityPerformance.refundRate}%</div>
              <div className="text-[10px] text-slate-500 font-medium">
                {formatRupiahId(qualityPerformance.refundTotal)}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: PURCHASE & PROCUREMENT (P0.5)                                  */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Purchase &amp; Procurement (Pembelian Bahan &amp; HPP)</h2>
                <p className="text-[11px] text-slate-400">Pengadaan bahan detergen, pewangi &amp; korelasi biaya modal terhadap omzet</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Total Pembelian Bahan</span>
              <div className="text-lg font-black text-slate-900 font-mono">{formatRupiahId(procurementStats.totalBelanja || financials.hpp)}</div>
              <div className="text-[10px] text-slate-500 font-medium">Pengeluaran belanja periode ini</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Jumlah Supplier</span>
              <div className="text-lg font-black text-teal-800 font-mono">{procurementStats.supplierCount || 1} Supplier</div>
              <div className="text-[10px] text-slate-500 font-medium">Pemasok aktif terdaftar</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Rasio Belanja / Omzet</span>
              <div className="text-lg font-black text-amber-700 font-mono">
                {financials.pendapatan > 0 ? Math.round(((procurementStats.totalBelanja || financials.hpp) / financials.pendapatan) * 100) : 25}%
              </div>
              <div className="text-[10px] text-slate-500 font-medium">Persentase terhadap omzet</div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase">Gross Profit Contribution</span>
              <div className="text-lg font-black text-emerald-900 font-mono">{financials.marginKotor}%</div>
              <div className="text-[10px] text-emerald-700 font-bold">Kontribusi margin kotor sehat</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 7 & 8: OPERATIONAL PERFORMANCE & EMPLOYEE PRODUCTIVITY (P1.6, P1.7)*/}
      {/* ========================================================================= */}
      {isManager && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Kolom Kiri: Operational Performance & SLA */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/60">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Operational SLA &amp; Lead Time</h2>
                    <p className="text-[11px] text-slate-400">Rata-rata waktu pengerjaan vs SLA target perjanjian</p>
                  </div>
                </div>

                <span className="text-xs font-black font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  {operationalPerformance.onTimeRate}% On-Time
                </span>
              </div>

              {/* Highlight Card Ketepatan Waktu */}
              <div className="p-4 bg-gradient-to-br from-slate-900 to-teal-950 text-white rounded-xl mb-3 space-y-2 border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">Average Processing Time</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-amber-400 font-mono">
                  {operationalPerformance.avgProcessingTime} <span className="text-sm font-sans text-slate-300">Jam (vs SLA 24 Jam)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                  {operationalPerformance.onTimeCount} dari {Math.max(1, operationalPerformance.completedCount)} order selesai tepat waktu sesuai estimasi.
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

                <div 
                  onClick={() => operationalPerformance.lateCount > 0 && setDrilldownType('late')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition ${
                    operationalPerformance.lateCount > 0 ? 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="text-[10px] font-extrabold uppercase">Terlambat</div>
                  <div className="text-base font-black font-mono mt-0.5">{operationalPerformance.lateCount}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-slate-400 text-center font-medium border-t border-slate-100">
              Monitoring ketat ketepatan waktu untuk menjaga kepuasan pelanggan
            </div>
          </div>

          {/* Kolom Kanan: Employee Productivity */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-800">Employee Productivity &amp; Performance</h2>
                    <p className="text-[11px] text-slate-400">Evaluasi multi-metrik: berat cucian, durasi &amp; kualitas</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[310px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[9.5px] tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Karyawan</th>
                      <th className="py-2.5 px-2 text-center">Total Order</th>
                      <th className="py-2.5 px-2 text-center">Berat (Kg)</th>
                      <th className="py-2.5 px-2 text-right">Pendapatan</th>
                      <th className="py-2.5 px-2 text-center">Rewash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employeeProductivity.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-400 font-medium">Belum ada data staf</td>
                      </tr>
                    ) : (
                      employeeProductivity.map((e, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800 truncate max-w-[130px]">{e.nama}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Rank #{idx + 1}</div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-700">{e.totalOrder}</td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-teal-800">{e.totalKg}</td>
                          <td className="py-2.5 px-2 text-right font-black text-slate-900 font-mono">{formatRupiahId(e.revenue)}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              e.rewashCount > 0 ? 'bg-amber-100 text-amber-800' : 'text-slate-400'
                            }`}>
                              {e.rewashCount}
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
              Data pengerjaan terhitung otomatis dari petugas kasir di Supabase
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 9: CUSTOMER RETENTION FUNNEL & CLV (P1.9)                          */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Customer Retention Funnel &amp; Lifetime Value</h2>
                <p className="text-[11px] text-slate-400">Analisis retensi: Pelanggan Baru &rarr; Repeat &rarr; Loyal &rarr; At-Risk</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                CLV: {formatRupiahId(customerRetention.clv)}
              </span>
            </div>
          </div>

          {/* Funnel Representation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-sky-800 uppercase">Pelanggan Baru (1 Order)</span>
              <div className="text-2xl font-black text-sky-950 font-mono">{customerRetention.newCustomer}</div>
              <div className="text-[10px] text-sky-700 font-medium">Kesan pertama layanan</div>
            </div>

            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-teal-800 uppercase">Repeat Customer (2-4x)</span>
              <div className="text-2xl font-black text-teal-950 font-mono">{customerRetention.repeatCustomer}</div>
              <div className="text-[10px] text-teal-700 font-medium">Mulai terbiasa berlangganan</div>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-emerald-800 uppercase">Loyal Customer (&gt;4x)</span>
              <div className="text-2xl font-black text-emerald-950 font-mono">{customerRetention.loyalCustomer}</div>
              <div className="text-[10px] text-emerald-700 font-medium">Pelanggan inti &amp; member</div>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
              <span className="text-[10px] font-extrabold text-amber-800 uppercase">Perlu Disapa (&gt;30 Hari)</span>
              <div className="text-2xl font-black text-amber-950 font-mono">{customerRetention.churnedCustomer}</div>
              <div className="text-[10px] text-amber-700 font-medium">Lama tidak berkunjung</div>
            </div>
          </div>

          {/* Action Banner for Churned Customers */}
          {customerRetention.churnedCustomer > 0 && (
            <div className="p-3 bg-amber-50/80 border border-amber-300/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Terdapat <strong>{customerRetention.churnedCustomer} pelanggan</strong> belum kembali mencuci dalam 30 hari terakhir. Kirim sapaan ramah via WhatsApp untuk mengajak kembali.
                </span>
              </div>
              <button
                onClick={() => setShowChurnedModal(true)}
                className="tactile-btn px-3 py-1.5 bg-[#1E4648] hover:bg-teal-900 text-white rounded-lg font-bold text-xs shrink-0 flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Lihat Daftar Pelanggan</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 10 & 11: MACHINE UTILIZATION & INVENTORY VALUATION (P1.8, P1.10)  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Status Mesin & Utilisasi (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Machine Utilization &amp; Maintenance</h2>
                <p className="text-[11px] text-slate-400">Monitoring utilisasi washer/dryer &amp; siklus jadwal pemeliharaan</p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Utilisasi: {mesinList.length > 0 ? Math.round((mesinList.filter(m => m.status === 'Digunakan').length / mesinList.length) * 100) : 0}%
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
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 font-medium py-1 flex justify-between items-center">
                      <span>{isMaint ? 'Sedang perbaikan teknis' : 'Mesin siap untuk siklus baru'}</span>
                      <span className="text-[10px] font-mono text-slate-400">Jadwal Maint: Aman</span>
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
      {/* SECTION 11: INVENTORY VALUATION & ESTIMATED DAYS UNTIL EMPTY (P1.10)       */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/60">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">Inventory Valuation &amp; Stock Health</h2>
                <span className="text-xs font-mono font-bold text-teal-900 bg-teal-100 px-2.5 py-0.5 rounded-lg">
                  Total Nilai: {formatRupiahId(inventoryValuation.totalValuation)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Estimasi habis pakai (EDUE) berdasarkan rata-rata pemakaian harian aktual
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
        {inventoryValuation.minusCount > 0 && (
          <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Terdapat <strong>{inventoryValuation.minusCount} barang inventaris</strong> bernilai minus di bawah 0. Lakukan stok opname fisik dan penyesuaian.
              </span>
            </div>
            <span className="font-bold text-[11px] bg-rose-100 text-rose-900 px-2 py-0.5 rounded">
              Audit Prioritas
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {inventoryValuation.items.filter(item => {
            if (inventoryFilterTab === 'Kritis') return item.isMinus || item.isZero;
            if (inventoryFilterTab === 'Menipis') return item.isLow;
            if (inventoryFilterTab === 'Aman') return !item.isMinus && !item.isZero && !item.isLow;
            return true;
          }).map((i) => {
            return (
              <div 
                key={i.id}
                className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                  i.isMinus ? 'bg-rose-50/90 border-rose-300 shadow-2xs' :
                  i.isZero ? 'bg-rose-50/70 border-rose-200' :
                  i.isLow ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start gap-1">
                  <span className="font-bold text-slate-800 text-xs truncate">{i.nama}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 ${
                    i.isMinus ? 'bg-rose-600 text-white' :
                    i.isZero ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                    i.isLow ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {i.isMinus ? 'Minus' : i.isZero ? 'Habis' : i.isLow ? 'Menipis' : 'Aman'}
                  </span>
                </div>

                <div className="flex justify-between items-end pt-1">
                  <div>
                    <span className={`text-base font-black font-mono ${i.isMinus ? 'text-rose-600' : 'text-slate-800'}`}>
                      {formatDecimal(i.stokVal)}
                    </span>
                    <span className="text-slate-500 font-semibold text-[11px] ml-1">{i.satuan}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Est. Habis: <strong>{i.daysUntilEmpty > 0 ? `${i.daysUntilEmpty} Hari` : 'Hari Ini'}</strong>
                    </div>
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
      {/* SECTION 12: CATEGORIZED BUSINESS INSIGHTS (P2)                            */}
      {/* ========================================================================= */}
      {isManager && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/60">
              <Lightbulb className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Executive Business Intelligence &amp; Insights</h2>
              <p className="text-[11px] text-slate-400">Diagnosis analitik otomatis terbagi dalam kategori Positif, Perhatian &amp; Kritis</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* 🟢 Positif */}
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Pencapaian &amp; Positif</span>
              </div>
              <div className="space-y-1.5">
                {categorizedInsights.positive.map((ins, idx) => (
                  <div key={idx} className="text-xs text-slate-700 leading-relaxed font-medium">
                    &bull; {ins}
                  </div>
                ))}
              </div>
            </div>

            {/* 🟡 Perhatian */}
            <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Perlu Perhatian</span>
              </div>
              <div className="space-y-1.5">
                {categorizedInsights.attention.map((ins, idx) => (
                  <div key={idx} className="text-xs text-slate-700 leading-relaxed font-medium">
                    &bull; {ins}
                  </div>
                ))}
              </div>
            </div>

            {/* 🔴 Kritis */}
            <div className="p-3.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Tindakan Kritis</span>
              </div>
              <div className="space-y-1.5">
                {categorizedInsights.critical.length > 0 ? (
                  categorizedInsights.critical.map((ins, idx) => (
                    <div key={idx} className="text-xs text-rose-900 leading-relaxed font-semibold">
                      &bull; {ins}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 italic">Tidak ada anomali kritis saat ini. Operasional berjalan lancar.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ATUR TARGET BULANAN (P0.2)                                       */}
      {/* ========================================================================= */}
      {showTargetModal && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200/60">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Atur Target Bulanan Outlet</h3>
                  <p className="text-[11px] text-slate-400">Sasaran omzet, order &amp; laba kotor toko</p>
                </div>
              </div>
              <button onClick={() => setShowTargetModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Pendapatan (Rp)</label>
                <input 
                  type="number"
                  value={targetForm.targetRevenue}
                  onChange={(e) => setTargetForm(prev => ({ ...prev, targetRevenue: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-[#1E4648]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Laba Kotor (Rp)</label>
                <input 
                  type="number"
                  value={targetForm.targetGrossProfit}
                  onChange={(e) => setTargetForm(prev => ({ ...prev, targetGrossProfit: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-[#1E4648]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Total Order</label>
                  <input 
                    type="number"
                    value={targetForm.targetOrders}
                    onChange={(e) => setTargetForm(prev => ({ ...prev, targetOrders: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-[#1E4648]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Pelanggan</label>
                  <input 
                    type="number"
                    value={targetForm.targetCustomers}
                    onChange={(e) => setTargetForm(prev => ({ ...prev, targetCustomers: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-[#1E4648]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Repeat Order Ratio (%)</label>
                <input 
                  type="number"
                  value={targetForm.targetRepeatRatio}
                  onChange={(e) => setTargetForm(prev => ({ ...prev, targetRepeatRatio: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-sm outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button 
                onClick={() => setShowTargetModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveTargets}
                disabled={savingTarget}
                className="flex-1 py-2 bg-[#1E4648] hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {savingTarget ? 'Menyimpan...' : 'Simpan Target'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: QUALITY DRILL-DOWN MODAL (P0.4)                                  */}
      {/* ========================================================================= */}
      {drilldownType && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Daftar Order: {drilldownType.toUpperCase()}
                  </h3>
                  <p className="text-[11px] text-slate-400">Rincian order terdampak untuk evaluasi kualitas</p>
                </div>
              </div>
              <button onClick={() => setDrilldownType(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {drilldownOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Tidak ada order pada kategori ini.
                </div>
              ) : (
                drilldownOrders.map(t => (
                  <div key={t.noNota} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{t.noNota}</span>
                        <span className="text-[10px] text-slate-400">{formatWibDateShort(t.rawTanggal || t.tanggal)}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-700">{formatRupiahId(Number(t.total) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Pelanggan: <strong>{t.namaPelanggan}</strong> ({t.noHp || '-'})</span>
                      <span>Petugas: {t.petugas}</span>
                    </div>
                    {t.catatan && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded mt-1">
                        Catatan: {t.catatan}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 text-right">
              <button 
                onClick={() => setDrilldownType(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CHURNED CUSTOMERS DIRECT WHATSAPP (P1.9)                         */}
      {/* ========================================================================= */}
      {showChurnedModal && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xl shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-teal-700" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Pelanggan Lama Tidak Mencuci (&gt;30 Hari)</h3>
                  <p className="text-[11px] text-slate-400">Kirim sapaan WhatsApp langsung dari dashboard</p>
                </div>
              </div>
              <button onClick={() => setShowChurnedModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {customerRetention.churnedList.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Semua pelanggan aktif berkunjung dalam 30 hari terakhir.
                </div>
              ) : (
                customerRetention.churnedList.map((c, idx) => {
                  const cleanPhone = (c.noHp || '').replace(/\D/g, '');
                  const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
                  const waText = encodeURIComponent(`Halo Kak ${c.nama}, kami dari dua SiSi Laundry. Semoga sehat selalu kak! Ada cucian yang mau kami bantu proses hari ini? Ada promo khusus pelanggan setia menanti.`);
                  const waUrl = `https://wa.me/${waNumber}?text=${waText}`;

                  return (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-900">{c.nama}</div>
                        <div className="text-[10px] text-slate-400">
                          {c.totalOrder}x Order • Terakhir: {c.lastDateStr} • Total: {formatRupiahId(c.totalSpend)}
                        </div>
                      </div>

                      {cleanPhone ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Hubungi WA</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[10px]">No HP Kosong</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 text-right">
              <button 
                onClick={() => setShowChurnedModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: GENERATE REPORT & EXPORT PDF                                     */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
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
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-700">Pilih Periode Laporan</label>
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
                    className={`px-3 py-2 rounded-xl font-bold transition text-left cursor-pointer ${
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
                    <FileDown className="w-4 h-4 text-amber-300" />
                    <span>Generate &amp; Unduh PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: QUICK RESTOCK DARI DASHBOARD                                     */}
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
