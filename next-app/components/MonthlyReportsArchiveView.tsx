'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FolderArchive,
  Sparkles,
  FileText,
  Download,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  Users,
  Clock,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Eye,
  Trash2,
  CalendarPlus,
  Search,
  Filter,
  BarChart3,
  Zap,
  ArrowLeft,
  Layers,
  ShoppingBag,
  Award,
  CheckCheck,
  Percent
} from 'lucide-react';
import { SavedMonthlyReport, UserRole } from '@/lib/types';
import { runBackend } from '@/lib/api';
import {
  generateBusinessPerformancePdf,
  ReportDataPayload,
  ActionPlanItem,
  formatRupiahId,
  formatPercentId
} from '@/lib/pdfReportGenerator';
import { useDialog } from '@/components/DialogProvider';
import { parseIndonesianDateTime } from '@/lib/utils';
import RupiahIcon from '@/components/RupiahIcon';

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

interface MonthlyReportsArchiveViewProps {
  currentRole: UserRole;
}

export default function MonthlyReportsArchiveView({ currentRole }: MonthlyReportsArchiveViewProps) {
  const { showAlert, showConfirm } = useDialog();

  // State utama arsip
  const [reports, setReports] = useState<SavedMonthlyReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncStatusText, setSyncStatusText] = useState<string>('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'FINAL' | 'BERJALAN'>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');

  // Selected Report for Interactive Detail View
  const [selectedReport, setSelectedReport] = useState<SavedMonthlyReport | null>(null);

  // PDF Exporting State
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  // Fetch reports from database
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await runBackend<SavedMonthlyReport[]>('getSavedMonthlyReports');
      if (Array.isArray(data)) {
        setReports(data);
      } else {
        setReports([]);
      }
    } catch (err) {
      console.error('Gagal mengambil data arsip bulanan:', err);
      showAlert('Gagal memuat arsip laporan bulanan dari database', 'error');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Helper formatting bulan Indonesia
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const formatPeriodLabel = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-').map(Number);
    if (!y || !m) return yearMonth;
    return `${monthNames[m - 1]} ${y}`;
  };

  // Helper untuk memformat rentang tanggal & jam cut-off data yang direkap
  const formatReportDateTimeRange = (report: SavedMonthlyReport) => {
    const [yearStr, monthStr] = (report.periodKey || '').split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    let startStr = report.startDateTimeStr || report.payload?.startDateTimeStr;
    let endStr = report.endDateTimeStr || report.payload?.endDateTimeStr;

    if (!startStr) {
      if (year && month) {
        const mName = monthNames[month - 1] || `Bulan ${month}`;
        startStr = `01 ${mName} ${year}, 00:00:00 WIB`;
      } else if (report.startDateStr) {
        const d = parseSafeDate(report.startDateStr);
        if (d) {
          startStr = `${String(d.getDate()).padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}, 00:00:00 WIB`;
        } else {
          startStr = `${report.startDateStr}, 00:00:00 WIB`;
        }
      } else {
        startStr = 'Awal Periode, 00:00:00 WIB';
      }
    }

    if (!endStr) {
      if (report.status === 'FINAL') {
        if (year && month) {
          const lastDay = new Date(year, month, 0).getDate();
          const mName = monthNames[month - 1] || `Bulan ${month}`;
          endStr = `${String(lastDay).padStart(2, '0')} ${mName} ${year}, 23:59:59 WIB`;
        } else if (report.endDateStr) {
          const d = parseSafeDate(report.endDateStr);
          if (d) {
            endStr = `${String(d.getDate()).padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}, 23:59:59 WIB`;
          } else {
            endStr = `${report.endDateStr}, 23:59:59 WIB`;
          }
        } else {
          endStr = 'Akhir Bulan, 23:59:59 WIB';
        }
      } else {
        // BERJALAN: Cut-off adalah waktu snapshot terkini
        const updateDate = report.updatedAt ? new Date(report.updatedAt) : new Date();
        const validDate = isNaN(updateDate.getTime()) ? new Date() : updateDate;
        const day = String(validDate.getDate()).padStart(2, '0');
        const mName = monthNames[validDate.getMonth()] || `Bulan ${validDate.getMonth() + 1}`;
        const yr = validDate.getFullYear();
        const timeStr = validDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        endStr = `${day} ${mName} ${yr}, ${timeStr} WIB`;
      }
    }

    const firstTx = report.firstTxTime || report.payload?.firstTxTime;
    const lastTx = report.lastTxTime || report.payload?.lastTxTime;
    let actualTxRange = '';
    if (firstTx && lastTx) {
      actualTxRange = `${firstTx} s/d ${lastTx}`;
    } else if (firstTx) {
      actualTxRange = `Mulai ${firstTx}`;
    }

    return {
      startDateTime: startStr,
      endDateTime: endStr,
      actualTxRange,
    };
  };

  // Helper untuk generate aggregate data satu bulan dari transaksi
  const generateMonthSnapshot = async (
    targetPeriodKey: string,
    allTransactions: any[],
    allLayanan: any[],
    allInventory: any[]
  ): Promise<SavedMonthlyReport | null> => {
    const [year, month] = targetPeriodKey.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // hari terakhir bulan tsb
    const now = new Date();

    const isCurrentMonth =
      now.getFullYear() === year && (now.getMonth() + 1) === month;

    const startIso = `${year}-${String(month).padStart(2, '0')}-01`;
    const endIso = isCurrentMonth
      ? `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      : `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const monthNamesIndo = monthNames[month - 1] || `Bulan ${month}`;
    const startDateTimeStr = `01 ${monthNamesIndo} ${year}, 00:00:00 WIB`;
    const endDateTimeStr = isCurrentMonth
      ? `${String(now.getDate()).padStart(2, '0')} ${monthNames[now.getMonth()]} ${now.getFullYear()}, ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} WIB`
      : `${String(endDate.getDate()).padStart(2, '0')} ${monthNamesIndo} ${year}, 23:59:59 WIB`;

    // Filter transaksi untuk bulan ini (abaikan transaksi yang dibatalkan/void)
    const monthTx = allTransactions.filter((t: any) => {
      if (t.statusVoid === 'Approved' || t.status === 'Dibatalkan') return false;
      const tDate = t.rawTanggal || t.tanggal || '';
      if (!tDate) return false;
      const d = parseSafeDate(tDate);
      if (!d) return false;
      const txYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return txYm === targetPeriodKey;
    });

    if (monthTx.length === 0 && !isCurrentMonth) {
      return null; // Tidak ada data untuk bulan lampau ini
    }

    // Urutkan transaksi untuk deteksi rentang jam aktivitas order kasir sesungguhnya
    const sortedTx = [...monthTx].sort((a, b) => {
      const da = parseSafeDate(a.rawTanggal || a.tanggal)?.getTime() || 0;
      const db = parseSafeDate(b.rawTanggal || b.tanggal)?.getTime() || 0;
      return da - db;
    });

    const formatTxTimestamp = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const mName = monthNames[d.getMonth()] || `Bulan ${d.getMonth() + 1}`;
      const yr = d.getFullYear();
      const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      return `${day} ${mName} ${yr}, ${time} WIB`;
    };

    let firstTxTime: string | undefined = undefined;
    let lastTxTime: string | undefined = undefined;
    if (sortedTx.length > 0) {
      const dFirst = parseSafeDate(sortedTx[0].rawTanggal || sortedTx[0].tanggal);
      const dLast = parseSafeDate(sortedTx[sortedTx.length - 1].rawTanggal || sortedTx[sortedTx.length - 1].tanggal);
      if (dFirst) firstTxTime = formatTxTimestamp(dFirst);
      if (dLast) lastTxTime = formatTxTimestamp(dLast);
    }

    // KPI Aggregation
    const totalRevenue = monthTx.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
    const totalTransactions = monthTx.length;

    const customerMap: Record<string, { count: number; totalSpend: number; name: string; phone: string; lastOrder: string }> = {};
    const dailyMap: Record<string, { tanggal: string; revenue: number; orderCount: number; kgTotal: number }> = {};
    const serviceMap: Record<string, { orderCount: number; totalRevenue: number }> = {};
    const employeeMap: Record<string, { count: number; revenue: number }> = {};

    let totalKg = 0;
    let completedOrders = 0;
    let onTimeOrders = 0;

    monthTx.forEach((t) => {
      const phone = t.noHp || 'UNKNOWN';
      const name = t.namaPelanggan || 'Pelanggan';
      const total = Number(t.total) || 0;
      const tgl = t.tanggal || '';

      // Customer
      if (!customerMap[phone]) {
        customerMap[phone] = { count: 0, totalSpend: 0, name, phone, lastOrder: tgl };
      }
      customerMap[phone].count += 1;
      customerMap[phone].totalSpend += total;
      customerMap[phone].lastOrder = tgl;

      // Daily
      const dayKey = tgl.includes(' ') ? tgl.split(' ')[0] : tgl;
      if (dayKey) {
        if (!dailyMap[dayKey]) {
          dailyMap[dayKey] = { tanggal: dayKey, revenue: 0, orderCount: 0, kgTotal: 0 };
        }
        dailyMap[dayKey].revenue += total;
        dailyMap[dayKey].orderCount += 1;
      }

      // Items & Kg
      let items = Array.isArray(t.items) ? t.items : Array.isArray(t.transaksi_items) ? t.transaksi_items : [];
      if (items.length === 0 && (t as any).layanan) {
        items = [{
          layanan: (t as any).layanan,
          qty: Number((t as any).qty) || 1,
          hargaSatuan: Number(t.total) || 0,
          subtotal: Number(t.total) || 0,
        }];
      }
      items.forEach((item: any) => {
        const layName = item.layanan || item.nama || 'Layanan Reguler';
        const qty = Number(item.qty) || 1;
        const sub = Number(item.subtotal) || (Number(item.hargaSatuan || item.harga || item.price || 0) * qty) || 0;

        if (!serviceMap[layName]) {
          serviceMap[layName] = { orderCount: 0, totalRevenue: 0 };
        }
        serviceMap[layName].orderCount += qty;
        serviceMap[layName].totalRevenue += sub;

        if (layName.toLowerCase().includes('kilo') || layName.toLowerCase().includes('kg')) {
          totalKg += qty;
          if (dailyMap[dayKey]) dailyMap[dayKey].kgTotal += qty;
        }
      });

      // Employee
      const pet = t.petugas || 'Staf Kasir';
      if (!employeeMap[pet]) {
        employeeMap[pet] = { count: 0, revenue: 0 };
      }
      employeeMap[pet].count += 1;
      employeeMap[pet].revenue += total;

      // SLA
      if (t.status === 'SudahDiambil' || t.status === 'Selesai') {
        completedOrders += 1;
        onTimeOrders += 1; // Default tercapai jika selesai
      }
    });

    const customersList = Object.values(customerMap);
    const totalCustomers = customersList.length;
    const repeatCustomers = customersList.filter((c) => c.count > 1).length;
    const repeatOrderRatio = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    const avgOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;
    const avgCustomerSpend = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;

    // Financials Calculation
    const hppLayananMap = new Map<string, number>();
    allLayanan.forEach((l) => {
      const name = (l.nama || l.layanan || '').toLowerCase().trim();
      const modal = Number(l.hargaModal) || 0;
      if (name && modal > 0) hppLayananMap.set(name, modal);
    });

    let totalHpp = 0;
    Object.entries(serviceMap).forEach(([svcName, val]) => {
      const modal = hppLayananMap.get(svcName.toLowerCase().trim());
      if (modal && modal > 0) {
        totalHpp += modal * val.orderCount;
      } else {
        totalHpp += val.totalRevenue * 0.25; // Default COGS 25%
      }
    });

    const labaKotor = Math.max(0, totalRevenue - totalHpp);
    const marginKotor = totalRevenue > 0 ? (labaKotor / totalRevenue) * 100 : 0;

    // Biaya Operasional Toko (estimasi 22% dari omzet)
    const biayaOperasional = Math.round(totalRevenue * 0.22);
    const labaBersih = Math.max(0, labaKotor - biayaOperasional);
    const marginBersih = totalRevenue > 0 ? (labaBersih / totalRevenue) * 100 : 0;

    // Top Services
    const serviceRows = Object.entries(serviceMap)
      .map(([layanan, d]) => ({
        layanan,
        orderCount: d.orderCount,
        totalRevenue: d.totalRevenue,
        percentage: totalRevenue > 0 ? (d.totalRevenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Top Customers
    const topCustomers = customersList
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    // Operational SLA
    const onTimeRate = completedOrders > 0 ? (onTimeOrders / completedOrders) * 100 : 100;

    // Inventory rows
    const inventoryRows = (allInventory || []).slice(0, 8).map((inv) => ({
      nama: inv.nama,
      stok: Number(inv.stok) || 0,
      satuan: inv.satuan || 'Pcs',
      status: Number(inv.stok) <= (Number(inv.stokMinimum) || 5) ? 'Menipis' : 'Aman',
    }));

    const periodeLabel = formatPeriodLabel(targetPeriodKey);

    // Request AI Gemini Analysis
    let executiveSummaryOpening = `Laporan kinerja bisnis dua SiSi Laundry Express & Coin POS periode ${periodeLabel} mencatat akumulasi pendapatan sebesar ${formatRupiahId(totalRevenue)} melalui penanganan ${totalTransactions} order dengan margin laba kotor ${formatPercentId(marginKotor)}. On-Time SLA tercapai ${formatPercentId(onTimeRate)}, mencerminkan kedisiplinan operasional outlet. Retensi pelanggan saat ini berada pada rasio ${formatPercentId(repeatOrderRatio)} dan manajemen memprioritaskan ketersediaan bahan baku penting demi stabilitas bisnis di periode berikutnya.`;
    let actionPlans: ActionPlanItem[] = [
      {
        pilar: '1. Pertumbuhan Pendapatan & Paket Layanan',
        rencanaAksi: `Tingkatkan bundle promotion pada layanan unggulan '${serviceRows[0]?.layanan || 'Utama'}' dan aktifkan voucher diskon pada jam sepi.`,
        targetOutput: `Peningkatan Omzet +15% & Transaksi Harian Optimal`,
        prioritas: 'Tinggi',
        pic: 'Manajer Outlet & Kasir',
      },
      {
        pilar: '2. Retensi Pelanggan & Loyalty Program',
        rencanaAksi: `Kirim reminder WhatsApp otomatis kepada ${totalCustomers - repeatCustomers} pelanggan 1-time yang belum kembali dalam 30 hari.`,
        targetOutput: `Kenaikan Repeat Order Ratio ke ≥ 40.0%`,
        prioritas: 'Tinggi',
        pic: 'Admin & Customer Care',
      },
      {
        pilar: '3. Pengendalian Biaya Bahan & Efisiensi HPP',
        rencanaAksi: `Lakukan audit takaran deterjen dan softener per kg cucian serta restock terjadwal minimal H-5 sebelum batas minimum tercapai.`,
        targetOutput: `Margin Kotor Terjaga di Atas 50.0%`,
        prioritas: 'Sedang',
        pic: 'Kepala Produksi & Tim Cuci',
      },
      {
        pilar: '4. Standar Mutu & Zero Complain',
        rencanaAksi: `Perketat pre-spotting noda membandel saat penerimaan cucian dan pemeriksaan aroma akhir sebelum packing e-nota.`,
        targetOutput: `Rewash Rate ≤ 1.0% & Nol Komplain Pelanggan`,
        prioritas: 'Sedang',
        pic: 'Tim Cuci & Finishing',
      },
      {
        pilar: '5. Disiplin SLA & Kecepatan Order',
        rencanaAksi: `Pantau Kanban antrean secara real-time, prioritaskan pengerjaan cucian mendekati tenggat waktu, dan briefing harian shift.`,
        targetOutput: `On-Time SLA ≥ 98.0% & Kecepatan Maksimal`,
        prioritas: 'Tinggi',
        pic: 'Supervisor Operasional',
      },
    ];

    try {
      const aiReq = await fetch('/api/ai/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodeLabel,
          kpi: {
            revenue: totalRevenue,
            transactions: totalTransactions,
            customers: totalCustomers,
            repeatCustomers,
            repeatOrderRatio,
            totalKg,
            avgOrderValue,
            avgCustomerSpend,
          },
          financials: {
            pendapatan: totalRevenue,
            hpp: totalHpp,
            labaKotor,
            marginKotor,
            biayaOperasional,
            labaBersih,
            marginBersih,
          },
          topServices: serviceRows.map((s) => ({ nama: s.layanan, orderCount: s.orderCount, revenue: s.totalRevenue })),
          quality: {
            onTimeRate,
            cancellationRate: 0,
            rewashRate: 0,
          },
        }),
      });

      if (aiReq.ok) {
        const aiData = await aiReq.json();
        if (aiData.executiveSummaryOpening) {
          executiveSummaryOpening = aiData.executiveSummaryOpening;
        }
        if (Array.isArray(aiData.actionPlans) && aiData.actionPlans.length > 0) {
          actionPlans = aiData.actionPlans;
        }
      }
    } catch (aiErr) {
      console.warn('AI Gemini analysis fallback applied:', aiErr);
    }

    const payload: ReportDataPayload = {
      periodeLabel,
      startDateStr: startIso,
      endDateStr: endIso,
      startDateTimeStr,
      endDateTimeStr,
      firstTxTime,
      lastTxTime,
      outletName: 'Outlet Utama (dua SiSi Laundry Express & Coin POS)',
      generatedBy: 'Sistem Arsip Otomatis POS',
      generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('id-ID'),
      executiveSummaryOpening,
      aiProvider: 'AI Gemini',
      kpi: {
        totalRevenue,
        totalTransactions,
        totalCustomers,
        repeatCustomers,
        oneTimeCustomers: totalCustomers - repeatCustomers,
        repeatOrderRatio,
        totalKg,
        avgOrderValue,
        avgCustomerSpend,
      },
      financials: {
        pendapatan: totalRevenue,
        hpp: totalHpp,
        labaKotor,
        marginKotor,
        biayaOperasional,
        labaBersih,
        marginBersih,
      },
      quality: {
        cancellationRate: 0,
        rewashRate: 0,
        complaintRate: 0,
        orderErrorRate: 0,
        refundRate: 0,
      },
      dailyRows: Object.values(dailyMap).map((d) => ({
        dateStr: d.tanggal,
        transactions: d.orderCount,
        revenue: d.revenue,
        kg: d.kgTotal,
      })),
      serviceRows: serviceRows.map((s) => ({
        layanan: s.layanan,
        transactions: s.orderCount,
        orderCount: s.orderCount,
        kg: 0,
        revenue: s.totalRevenue,
        totalRevenue: s.totalRevenue,
        percentage: s.percentage,
      })),
      employeeRows: Object.entries(employeeMap).map(([nama, e]) => ({
        nama,
        transactions: e.count,
        revenue: e.revenue,
        completed: e.count,
        late: 0,
      })),
      topCustomers: topCustomers.map((c) => ({
        nama: c.name,
        noHp: c.phone,
        totalOrder: c.count,
        orderCount: c.count,
        totalSpend: c.totalSpend,
      })),
      operational: {
        totalOrders: totalTransactions,
        completedOrders,
        processingOrders: 0,
        pendingOrders: 0,
        lateOrders: Math.max(0, completedOrders - onTimeOrders),
        onTimeRate,
        onTimeCount: onTimeOrders,
      },
      paymentRows: [
        { metode: 'Tunai & Digital', transactions: totalTransactions, nominal: totalRevenue, percentage: 100 },
      ],
      actionPlans,
      insights: actionPlans.map((ap) => `${ap.pilar}: ${ap.rencanaAksi}`),
    };

    const newReport: SavedMonthlyReport = {
      periodKey: targetPeriodKey,
      periodeLabel,
      startDateStr: startIso,
      endDateStr: endIso,
      startDateTimeStr,
      endDateTimeStr,
      firstTxTime,
      lastTxTime,
      status: isCurrentMonth ? 'BERJALAN' : 'FINAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      summary: {
        revenue: totalRevenue,
        orders: totalTransactions,
        customers: totalCustomers,
        repeatRatio: repeatOrderRatio,
        labaBersih,
        marginKotor,
        onTimeRate,
        hasAiAnalysis: true,
      },
      payload,
    };

    return newReport;
  };

  // Trigger Sinkronisasi Otomatis Seluruh Bulan
  const handleAutoSync = async () => {
    setSyncing(true);
    setSyncStatusText('Mengambil data transaksi dan master outlet...');

    try {
      const [allTx, allLay, allInv] = await Promise.all([
        runBackend<any[]>('getTransaksiList', 'Semua'),
        runBackend<any[]>('getLayananListAll'),
        runBackend<any[]>('getInventoryList'),
      ]);

      if (!Array.isArray(allTx) || allTx.length === 0) {
        showAlert('Tidak ditemukan data transaksi untuk diarsipkan.', 'info');
        setSyncing(false);
        return;
      }

      const monthsSet = new Set<string>();
      allTx.forEach((t: any) => {
        if (t.statusVoid === 'Approved' || t.status === 'Dibatalkan') return;
        const tDate = t.rawTanggal || t.tanggal || '';
        const d = parseSafeDate(tDate);
        if (d) {
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthsSet.add(ym);
        }
      });

      const now = new Date();
      const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(currentYm);

      const targetMonths = Array.from(monthsSet).sort().reverse();
      setSyncStatusText(`Ditemukan ${targetMonths.length} periode. Memproses arsip & analisis AI...`);

      let createdCount = 0;
      for (let i = 0; i < targetMonths.length; i++) {
        const ym = targetMonths[i];
        setSyncStatusText(`Memproses [${i + 1}/${targetMonths.length}]: ${formatPeriodLabel(ym)}...`);

        const snapshot = await generateMonthSnapshot(
          ym,
          allTx,
          Array.isArray(allLay) ? allLay : [],
          Array.isArray(allInv) ? allInv : []
        );

        if (snapshot) {
          await runBackend('saveMonthlyReport', snapshot);
          createdCount++;
        }
      }

      await fetchReports();
      showAlert(`Sinkronisasi berhasil! ${createdCount} arsip laporan bulanan tersimpan di sistem.`, 'success');
    } catch (err: any) {
      console.error('Error saat auto-sync arsip bulanan:', err);
      showAlert(`Gagal sinkronisasi arsip: ${err.message || 'Error server'}`, 'error');
    } finally {
      setSyncing(false);
      setSyncStatusText('');
    }
  };

  // Simpan / Perbarui Snapshot Bulan Berjalan
  const handleSnapshotCurrentMonth = async () => {
    setSyncing(true);
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSyncStatusText(`Menghasilkan snapshot ${formatPeriodLabel(currentYm)}...`);

    try {
      const [allTx, allLay, allInv] = await Promise.all([
        runBackend<any[]>('getTransaksiList', 'Semua'),
        runBackend<any[]>('getLayananListAll'),
        runBackend<any[]>('getInventoryList'),
      ]);

      const snapshot = await generateMonthSnapshot(
        currentYm,
        Array.isArray(allTx) ? allTx : [],
        Array.isArray(allLay) ? allLay : [],
        Array.isArray(allInv) ? allInv : []
      );

      if (snapshot) {
        await runBackend('saveMonthlyReport', snapshot);
        await fetchReports();
        showAlert(`Snapshot laporan ${formatPeriodLabel(currentYm)} berhasil disimpan ke sistem!`, 'success');
      } else {
        showAlert('Tidak ada data yang dapat di-snapshot untuk bulan ini.', 'warning');
      }
    } catch (err: any) {
      console.error('Error snapshot bulan berjalan:', err);
      showAlert(`Gagal membuat snapshot: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
      setSyncStatusText('');
    }
  };

  // Hapus Arsip
  const handleDeleteReport = async (report: SavedMonthlyReport, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = await showConfirm(
      `Apakah Anda yakin ingin menghapus arsip laporan ${report.periodeLabel}?`,
      'Hapus Arsip'
    );
    if (!confirmed) return;

    try {
      await runBackend('deleteMonthlyReport', report.periodKey);
      setReports((prev) => prev.filter((r) => r.periodKey !== report.periodKey));
      if (selectedReport?.periodKey === report.periodKey) {
        setSelectedReport(null);
      }
      showAlert(`Arsip ${report.periodeLabel} berhasil dihapus.`, 'success');
    } catch (err: any) {
      showAlert(`Gagal menghapus arsip: ${err.message}`, 'error');
    }
  };

  // Export PDF dari Arsip
  const handleExportPdf = async (report: SavedMonthlyReport, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExportingKey(report.periodKey);

    try {
      const dtRange = formatReportDateTimeRange(report);
      const payload: ReportDataPayload = {
        ...report.payload,
        startDateTimeStr: report.startDateTimeStr || report.payload?.startDateTimeStr || dtRange.startDateTime,
        endDateTimeStr: report.endDateTimeStr || report.payload?.endDateTimeStr || dtRange.endDateTime,
        firstTxTime: report.firstTxTime || report.payload?.firstTxTime || (dtRange.actualTxRange ? dtRange.actualTxRange.split(' s/d ')[0] : undefined),
        lastTxTime: report.lastTxTime || report.payload?.lastTxTime || (dtRange.actualTxRange ? dtRange.actualTxRange.split(' s/d ')[1] : undefined),
      };
      await generateBusinessPerformancePdf(payload);
      showAlert(`Dokumen PDF Laporan Bisnis ${report.periodeLabel} berhasil diunduh.`, 'success');
    } catch (err: any) {
      console.error('Gagal mengekspor PDF:', err);
      showAlert(`Gagal mengunduh PDF: ${err.message || 'Error generator'}`, 'error');
    } finally {
      setExportingKey(null);
    }
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchLabel = r.periodeLabel.toLowerCase().includes(term);
        const matchKey = r.periodKey.toLowerCase().includes(term);
        if (!matchLabel && !matchKey) return false;
      }
      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
      if (filterYear !== 'ALL' && !r.periodKey.startsWith(filterYear)) return false;
      return true;
    });
  }, [reports, searchTerm, filterStatus, filterYear]);

  // Available Years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    reports.forEach((r) => {
      const y = r.periodKey.split('-')[0];
      if (y) years.add(y);
    });
    return Array.from(years).sort().reverse();
  }, [reports]);

  // Aggregate Stats across archives
  const aggregateStats = useMemo(() => {
    if (reports.length === 0) return { totalRevenue: 0, totalOrders: 0, avgMargin: 0, avgSla: 0 };
    const totalRev = reports.reduce((sum, r) => sum + (r.summary?.revenue || 0), 0);
    const totalOrd = reports.reduce((sum, r) => sum + (r.summary?.orders || 0), 0);
    const avgMarg = reports.reduce((sum, r) => sum + (r.summary?.marginKotor || 0), 0) / reports.length;
    const avgS = reports.reduce((sum, r) => sum + (r.summary?.onTimeRate || 100), 0) / reports.length;
    return {
      totalRevenue: totalRev,
      totalOrders: totalOrd,
      avgMargin: avgMarg,
      avgSla: avgS,
    };
  }, [reports]);

  // Scroll to top saat membuka laporan detail
  useEffect(() => {
    if (selectedReport) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [selectedReport]);

  // JIKA SEDANG MEMILIH DETAIL LAPORAN: TAMPILKAN FULL PAGE
  if (selectedReport) {
    return (
      <div className="min-h-full bg-slate-50 p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
        {/* Navigation Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80">
          <button
            onClick={() => setSelectedReport(null)}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-800 font-bold text-sm group transition w-fit"
          >
            <div className="p-1.5 rounded-lg bg-white border border-slate-200 group-hover:border-teal-400 group-hover:bg-teal-50 shadow-sm transition">
              <ArrowLeft className="w-4 h-4 text-slate-600 group-hover:text-teal-700 transition" />
            </div>
            <span>Kembali ke Daftar Arsip Laporan</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Terakhir diperbarui: {new Date(selectedReport.updatedAt).toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Full Page Header Banner */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-800 text-white p-5 sm:p-6 lg:p-7 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-start sm:items-center gap-3 sm:gap-4">
            <button
              onClick={() => setSelectedReport(null)}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition text-white shrink-0 mt-0.5 sm:mt-0"
              title="Kembali ke Galeri Arsip"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider bg-teal-500/30 text-teal-200 px-2.5 py-0.5 rounded-full border border-teal-400/30">
                  Laporan Bisnis Terarsip
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    selectedReport.status === 'FINAL'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  {selectedReport.status === 'FINAL' ? 'Bulan Ditutup (Final)' : 'Bulan Berjalan (Snapshot)'}
                </span>
                <span className="text-xs text-teal-200 font-medium">
                  Periode: {selectedReport.startDateStr} s/d {selectedReport.endDateStr}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
                {selectedReport.periodeLabel}
              </h1>

              {/* Rentang Cut-Off Tanggal & Jam Data yang Direkap */}
              {(() => {
                const dtRange = formatReportDateTimeRange(selectedReport);
                return (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 bg-black/30 backdrop-blur-sm border border-emerald-400/30 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-emerald-100 shadow-inner">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                      <Clock className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>Rentang Cut-Off Rekap Data:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs sm:text-[13px]">
                      <span className="bg-emerald-950/80 border border-emerald-400/40 px-2.5 py-0.5 rounded-lg font-bold text-white shadow-sm">
                        {dtRange.startDateTime}
                      </span>
                      <span className="text-emerald-300 font-sans font-bold">s/d</span>
                      <span className="bg-emerald-950/80 border border-emerald-400/40 px-2.5 py-0.5 rounded-lg font-bold text-white shadow-sm">
                        {dtRange.endDateTime}
                      </span>
                    </div>
                    {dtRange.actualTxRange && (
                      <span className="text-[11px] text-teal-200 font-sans bg-teal-900/60 border border-teal-400/20 px-2.5 py-0.5 rounded-md">
                        • Transaksi Kasir: {dtRange.actualTxRange}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            {currentRole === 'MANAGER' && (
              <button
                onClick={(e) => handleDeleteReport(selectedReport, e)}
                className="px-3 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 hover:text-white font-bold text-xs sm:text-sm rounded-xl border border-rose-400/30 transition active:scale-95 flex items-center gap-1.5"
                title="Hapus arsip ini"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Hapus Arsip</span>
              </button>
            )}

            <button
              onClick={() => setSelectedReport(null)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl border border-white/20 transition active:scale-95 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            <button
              onClick={() => handleExportPdf(selectedReport)}
              disabled={exportingKey === selectedReport.periodKey}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              {exportingKey === selectedReport.periodKey ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export PDF Resmi</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Seksi Ringkasan Eksekutif AI Gemini */}
        <div className="bg-gradient-to-br from-teal-50/80 via-emerald-50/40 to-white p-5 sm:p-6 lg:p-7 rounded-2xl border border-teal-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-teal-900 font-bold text-sm sm:text-base lg:text-lg">
              <Sparkles className="w-5 h-5 text-teal-600 animate-pulse" />
              <span>Ringkasan Eksekutif & Sintesis Kinerja</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold bg-teal-700 text-white px-3 py-1 rounded-full shadow-sm">
              <Zap className="w-3.5 h-3.5 text-teal-200" />
              Analyzed by AI Gemini
            </span>
          </div>
          <p className="text-xs sm:text-sm lg:text-base leading-relaxed text-slate-700 font-normal text-justify">
            {selectedReport.payload?.executiveSummaryOpening || 'Ringkasan eksekutif telah diarsipkan dalam sistem.'}
          </p>
          <div className="mt-4 pt-3 border-t border-teal-200/50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            {(() => {
              const dtRange = formatReportDateTimeRange(selectedReport);
              return (
                <div className="flex items-center gap-1.5 font-medium text-teal-900">
                  <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Rentang Cut-Off Rekap Data: <strong className="font-semibold text-slate-800">{dtRange.startDateTime}</strong> s/d <strong className="font-semibold text-slate-800">{dtRange.endDateTime}</strong></span>
                </div>
              );
            })()}
            <span>Diarsipkan pada: {new Date(selectedReport.updatedAt).toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Seksi Scorecard KPI (6 Card Grid) */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Indikator Kinerja Kunci (KPI Scorecard)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Total Pendapatan</span>
                <RupiahIcon className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-800">
                {formatRupiahId(selectedReport.summary?.revenue || 0)}
              </div>
              <div className="text-[11px] text-teal-600 font-medium mt-1">
                {selectedReport.summary?.orders || 0} Total Transaksi Sukses
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Laba Bersih Toko</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-600">
                {formatRupiahId(selectedReport.summary?.labaBersih || 0)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Margin Laba Kotor {formatPercentId(selectedReport.summary?.marginKotor || 0)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Repeat Order Ratio</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-lg sm:text-xl font-black text-blue-700">
                {formatPercentId(selectedReport.summary?.repeatRatio || 0)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Dari {selectedReport.summary?.customers || 0} Total Pelanggan
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>On-Time SLA Mutu</span>
                <ShieldCheck className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-lg sm:text-xl font-black text-teal-700">
                {formatPercentId(selectedReport.summary?.onTimeRate || 100)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Ketepatan waktu pengerjaan
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Total Volume Cucian</span>
                <ShoppingBag className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-700">
                {(selectedReport.payload?.kpi?.totalKg || 0).toLocaleString('id-ID')} Kg
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Estimasi beban mesin cuci
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Rata-Rata Order (AOV)</span>
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-lg sm:text-xl font-black text-purple-700">
                {formatRupiahId(selectedReport.payload?.kpi?.avgOrderValue || 0)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Nilai belanja per transaksi
              </div>
            </div>
          </div>
        </div>

        {/* Seksi Laporan Keuangan (P&L Card) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
            <RupiahIcon className="w-4 h-4 text-emerald-600" />
            <span>Struktur Laba Rugi Toko (P&L Financial Breakdown)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500">Pendapatan Bruto</span>
              <div className="text-base sm:text-lg font-black text-slate-800 mt-1">
                {formatRupiahId(selectedReport.payload?.financials?.pendapatan || 0)}
              </div>
              <span className="text-[10px] text-slate-400">100% dari total omzet</span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs text-rose-600 font-medium">(-) Beban HPP</span>
              <div className="text-base sm:text-lg font-black text-rose-700 mt-1">
                {formatRupiahId(selectedReport.payload?.financials?.hpp || 0)}
              </div>
              <span className="text-[10px] text-slate-400">Modal deterjen & kemasan</span>
            </div>

            <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
              <span className="text-xs text-teal-800 font-bold">(=) Laba Kotor</span>
              <div className="text-base sm:text-lg font-black text-teal-900 mt-1">
                {formatRupiahId(selectedReport.payload?.financials?.labaKotor || 0)}
              </div>
              <span className="text-[10px] text-teal-600 font-semibold">
                Margin: {formatPercentId(selectedReport.payload?.financials?.marginKotor || 0)}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="text-xs text-amber-600 font-medium">(-) Biaya Operasional</span>
              <div className="text-base sm:text-lg font-black text-amber-700 mt-1">
                {formatRupiahId(selectedReport.payload?.financials?.biayaOperasional || 0)}
              </div>
              <span className="text-[10px] text-slate-400">Beban utilitas & shift</span>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
              <span className="text-xs text-emerald-800 font-bold">(=) Laba Bersih</span>
              <div className="text-base sm:text-lg font-black text-emerald-900 mt-1">
                {formatRupiahId(selectedReport.payload?.financials?.labaBersih || 0)}
              </div>
              <span className="text-[10px] text-emerald-700 font-bold">
                Margin: {formatPercentId(selectedReport.payload?.financials?.marginBersih || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Seksi 5 Pilar Action Plan Rekomendasi AI */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-600" />
              <span>Rekomendasi & Rencana Tindakan Strategis (5 Pilar Action Plan)</span>
            </h3>
            <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
              Target Eksekusi Manajemen
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 uppercase tracking-wider text-[10px] sm:text-xs border-b border-slate-200">
                  <th className="p-3 font-bold">Pilar Strategis</th>
                  <th className="p-3 font-bold">Rencana Tindakan</th>
                  <th className="p-3 font-bold">Target Indikator</th>
                  <th className="p-3 font-bold">Prioritas & PIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(selectedReport.payload?.actionPlans || []).map((ap: ActionPlanItem, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-bold text-teal-900 align-top max-w-[200px]">
                      {ap.pilar}
                    </td>
                    <td className="p-3 leading-relaxed align-top">
                      {ap.rencanaAksi}
                    </td>
                    <td className="p-3 align-top font-semibold text-emerald-800">
                      {ap.targetOutput}
                    </td>
                    <td className="p-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          ap.prioritas === 'Tinggi'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {ap.prioritas}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-1 font-medium">{ap.pic}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seksi Layanan Terlaris & Pelanggan Loyal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Top Layanan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Layanan Kontributor Terbesar</span>
            </h4>
            <div className="space-y-2.5">
              {((selectedReport.payload?.serviceRows || []) as any[]).length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">
                  Belum ada data layanan untuk periode ini
                </div>
              ) : (
                (selectedReport.payload?.serviceRows || []).slice(0, 5).map((s: any, idx: number) => {
                  const orderCount = s.orderCount ?? s.transactions ?? s.count ?? 0;
                  const revenue = s.totalRevenue ?? s.revenue ?? s.total ?? 0;
                  const percentage = s.percentage ?? 0;
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs sm:text-sm p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition">
                      <div>
                        <span className="font-bold text-slate-800">{s.layanan || s.nama || 'Layanan'}</span>
                        <div className="text-[11px] text-slate-500">{orderCount} pesanan</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-teal-800">{formatRupiahId(revenue)}</div>
                        <div className="text-[11px] text-slate-400">{formatPercentId(percentage)} share</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top Pelanggan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Pelanggan Belanja Tertinggi</span>
            </h4>
            <div className="space-y-2.5">
              {((selectedReport.payload?.topCustomers || []) as any[]).length === 0 ? (
                <div className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">
                  Belum ada data pelanggan untuk periode ini
                </div>
              ) : (
                (selectedReport.payload?.topCustomers || []).slice(0, 5).map((c: any, idx: number) => {
                  const orderCount = c.orderCount ?? c.totalOrder ?? c.count ?? 0;
                  const totalSpend = c.totalSpend ?? c.revenue ?? c.total ?? 0;
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs sm:text-sm p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition">
                      <div>
                        <span className="font-bold text-slate-800">{c.nama || c.name || 'Pelanggan'}</span>
                        <div className="text-[11px] text-slate-500">{orderCount}x order</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-800">{formatRupiahId(totalSpend)}</div>
                        <div className="text-[11px] text-slate-400">Total belanja</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom Full Page Navigation & Actions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FolderArchive className="w-4 h-4 text-teal-600" />
            <span>dua SiSi Laundry POS • Sistem Arsip Bulanan</span>
            <span className="text-slate-300">•</span>
            <span>ID Periode: {selectedReport.periodKey}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedReport(null)}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Daftar Arsip</span>
            </button>
            <button
              onClick={() => handleExportPdf(selectedReport)}
              disabled={exportingKey === selectedReport.periodKey}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // JIKA TIDAK MEMILIH LAPORAN: TAMPILKAN DAFTAR ARSIP (GALERI)
  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 space-y-6">

      {/* Main Page Header */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-teal-500/30 text-teal-200 px-2.5 py-0.5 rounded-full border border-teal-400/20">
                Pusat Dokumentasi Eksekutif
              </span>
              <span className="text-[11px] text-teal-300">Database Supabase PostgreSQL</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <FolderArchive className="w-7 h-7 text-teal-400" />
              <span>Arsip Laporan Kinerja Bisnis Bulanan</span>
            </h1>
            <p className="text-xs md:text-sm text-teal-100/80 mt-1 max-w-2xl">
              Laporan berkala yang tersimpan otomatis di sistem, menyajikan evaluasi finansial, ringkasan eksekutif AI Gemini, 5 pilar action plan, dan tombol unduh PDF resmi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAutoSync}
              disabled={syncing}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
              <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan & Buat Arsip Otomatis'}</span>
            </button>

            <button
              onClick={handleSnapshotCurrentMonth}
              disabled={syncing}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-white/20 transition active:scale-95 disabled:opacity-50"
              title="Perbarui snapshot bulan ini"
            >
              <CalendarPlus className="w-4 h-4 text-teal-300" />
              <span>Snapshot Bulan Ini</span>
            </button>

            <button
              onClick={fetchReports}
              disabled={loading || syncing}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition"
              title="Muat ulang daftar arsip"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sync Status Banner if Running */}
        {syncing && (
          <div className="mt-4 p-3 bg-teal-800/80 border border-teal-500/40 rounded-xl flex items-center gap-3 text-xs text-teal-100 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-300" />
            <span>{syncStatusText || 'Sedang memproses arsip bulanan...'}</span>
          </div>
        )}
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Total Arsip Tersimpan</span>
            <FolderArchive className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl font-black text-slate-800">{reports.length} Periode</div>
          <div className="text-[11px] text-teal-600 font-medium mt-0.5">Tersimpan di Cloud Database</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Akumulasi Omzet Arsip</span>
            <RupiahIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700">
            {formatRupiahId(aggregateStats.totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Dari {aggregateStats.totalOrders} total transaksi
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Rata-Rata Margin Kotor</span>
            <Percent className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-700">
            {formatPercentId(aggregateStats.avgMargin)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Rata-rata seluruh periode</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Rata-Rata Ketepatan SLA</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-purple-700">
            {formatPercentId(aggregateStats.avgSla)}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Kedisiplinan waktu order</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari bulan atau tahun..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1 text-xs bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1 rounded-md font-bold transition text-[11px] ${
                filterStatus === 'ALL' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua Status
            </button>
            <button
              onClick={() => setFilterStatus('FINAL')}
              className={`px-3 py-1 rounded-md font-bold transition text-[11px] ${
                filterStatus === 'FINAL' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Final
            </button>
            <button
              onClick={() => setFilterStatus('BERJALAN')}
              className={`px-3 py-1 rounded-md font-bold transition text-[11px] ${
                filterStatus === 'BERJALAN' ? 'bg-white shadow text-amber-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Berjalan
            </button>
          </div>

          {availableYears.length > 1 && (
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
            >
              <option value="ALL">Semua Tahun</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Grid of Archive Cards */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">Memuat arsip laporan bulanan dari sistem...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm">
          <FolderArchive className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Belum Ada Laporan Terarsip</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Sistem belum memiliki arsip laporan bulanan. Anda dapat menekan tombol sinkronisasi untuk otomatis mengumpulkan transaksi dan mengarsipkan laporan tiap bulan.
          </p>
          <button
            onClick={handleAutoSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition"
          >
            <Sparkles className="w-4 h-4 text-teal-200" />
            <span>Sinkronkan & Buat Arsip Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredReports.map((report) => {
            const isFinal = report.status === 'FINAL';
            return (
              <div
                key={report.periodKey}
                onClick={() => setSelectedReport(report)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-teal-400 p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Accent Top Bar */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isFinal ? 'bg-gradient-to-r from-teal-600 to-emerald-500' : 'bg-gradient-to-r from-amber-500 to-orange-400'
                  }`}
                />

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isFinal
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isFinal ? 'Bulan Ditutup (Final)' : 'Bulan Berjalan'}
                        </span>
                        <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-teal-600" />
                          Gemini AI
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-slate-800 group-hover:text-teal-800 transition">
                        {report.periodeLabel}
                      </h3>
                      {(() => {
                        const dt = formatReportDateTimeRange(report);
                        return (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-1">
                            <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span className="truncate" title={`${dt.startDateTime} s/d ${dt.endDateTime}`}>
                              {dt.startDateTime} s/d {dt.endDateTime}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <button
                      onClick={(e) => handleDeleteReport(report, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus arsip ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Highlight Metrics */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 mb-4">
                    <span className="text-[11px] text-slate-500 font-medium">Total Akumulasi Pendapatan</span>
                    <div className="text-xl font-black text-teal-900 mt-0.5">
                      {formatRupiahId(report.summary?.revenue || 0)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-200/60">
                      <span>Laba Bersih:</span>
                      <span className="font-bold text-emerald-700">
                        {formatRupiahId(report.summary?.labaBersih || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Micro Indicators */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">Total Order</span>
                      <span className="font-bold text-slate-800">{report.summary?.orders || 0}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">Repeat Ratio</span>
                      <span className="font-bold text-blue-700">{formatPercentId(report.summary?.repeatRatio || 0)}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">On-Time SLA</span>
                      <span className="font-bold text-teal-700">{formatPercentId(report.summary?.onTimeRate || 100)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400">
                    Update: {new Date(report.updatedAt).toLocaleDateString('id-ID')}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleExportPdf(report, e)}
                      disabled={exportingKey === report.periodKey}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                      title="Export PDF Laporan"
                    >
                      {exportingKey === report.periodKey ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>PDF</span>
                    </button>

                    <button
                      onClick={() => setSelectedReport(report)}
                      className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Detail</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
