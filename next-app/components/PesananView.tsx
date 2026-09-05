'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Columns3,
  List,
  RefreshCw,
  Search,
  WashingMachine,
  Wind,
  Sparkles,
  Package,
  Tag,
  X,
  MessageCircle,
  Send,
  Check,
  Inbox,
  Timer,
  Hourglass,
  Printer,
  ExternalLink,
  Workflow,
  User,
  Phone
} from 'lucide-react';
import { Mesin, Transaksi, LayananBahanBaku, PipelineStep } from '@/lib/types';
import { runBackend } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { formatWaPhone, parseDecimal, formatDecimal, eNotaUrl } from '@/lib/utils';
import { DropOffPriorityItem } from './ProdukView';
import PrinterModal from '@/components/PrinterModal';

function getFormattedDuration(startStr?: string | null, endStr?: string | null): string {
  if (!startStr) return '-';
  const parseD = (s: string) => {
    if (s.includes('/')) {
      const parts = s.split(' ')[0].split('/');
      const timePart = s.split(' ')[1] || '00:00';
      const [hh, mm, ss] = timePart.split(':');
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), Number(hh) || 0, Number(mm) || 0, Number(ss) || 0);
    }
    return new Date(s);
  };
  const start = parseD(startStr);
  const end = endStr ? parseD(endStr) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalMins = Math.floor(diffMs / 60000);
  if (totalMins < 1) return '< 1 Menit';
  if (totalMins < 60) return `${totalMins} Menit`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) return `${hours} Jam ${mins > 0 ? `${mins} Mnt` : ''}`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days} Hari ${remHours > 0 ? `${remHours} Jam` : ''}`;
}

function formatWibDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  let d: Date;
  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split(' ')[0].split('/');
    const timePart = dateStr.split(' ')[1] || '00:00';
    const [hh, mm, ss] = timePart.split(':');
    d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), Number(hh) || 0, Number(mm) || 0, Number(ss) || 0);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return String(dateStr);
  const dateFormatted = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeFormatted = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  return `${dateFormatted}, ${timeFormatted}`;
}

function getWorkflowIcon(status: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('terima')) return Inbox;
  if (s.includes('cuci')) return WashingMachine;
  if (s.includes('kering')) return Wind;
  if (s.includes('setrika') || s.includes('gosok')) return Sparkles;
  if (s.includes('lipat') || s.includes('pack')) return Package;
  if (s.includes('siap') || s.includes('ambil') || s.includes('selesai')) return CheckCircle2;
  return Tag;
}

interface StaffItem {
  id: string;
  nama: string;
  jabatan?: string;
}

function activeMachine(order: Transaksi) {
  const active = order.pipeline?.find((step) => step.status === 'Aktif');
  return active?.mesinId || active?.washerId || active?.dryerId || '';
}

interface PesananViewProps {
  initialFilterTab?: 'Semua' | 'Diproses' | 'SiapDiambil' | 'BelumWA' | 'SudahDiambil';
}

export default function PesananView({ initialFilterTab }: PesananViewProps = {}) {
  const [orders, setOrders] = useState<Transaksi[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Transaksi[]>([]);
  const [machines, setMachines] = useState<Mesin[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [layananList, setLayananList] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [masterSteps, setMasterSteps] = useState<any[]>([]);
  const [dropOffPriorities, setDropOffPriorities] = useState<DropOffPriorityItem[]>([
    { id: 'p1', nama: 'Reguler', durasiJam: 48, icon: 'Clock', warna: 'bg-teal-100 text-teal-800 border-teal-300', aktif: true },
    { id: 'p2', nama: 'Express', durasiJam: 24, icon: 'Flame', warna: 'bg-amber-100 text-amber-800 border-amber-300', aktif: true },
    { id: 'p3', nama: 'Kilat', durasiJam: 6, icon: 'Zap', warna: 'bg-rose-100 text-rose-800 border-rose-300', aktif: true }
  ]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<string>('Semua');
  const [filterTab, setFilterTab] = useState<'Semua' | 'Diproses' | 'SiapDiambil' | 'BelumWA' | 'SudahDiambil'>(initialFilterTab || 'Semua');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selected, setSelected] = useState<Transaksi | null>(null);
  const [detailModalOrder, setDetailModalOrder] = useState<Transaksi | null>(null);
  const [machineId, setMachineId] = useState('');
  const [staffName, setStaffName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [waReminders, setWaReminders] = useState<Record<string, string>>({});
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [txToPrint, setTxToPrint] = useState<Transaksi | null>(null);

  useEffect(() => {
    if (initialFilterTab) {
      setFilterTab(initialFilterTab);
    }
  }, [initialFilterTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, completedData, machineData, staffData, priorityData, layData, invData, pipeData] = await Promise.all([
        runBackend<Transaksi[]>('getTransaksiByPipeline', 'Semua').catch(() => []),
        runBackend<Transaksi[]>('getTransaksiByPipeline', 'Selesai').catch(() => []),
        runBackend<Mesin[]>('getMesinList').catch(() => []),
        runBackend<StaffItem[]>('getPegawaiList').catch(() => []),
        runBackend<DropOffPriorityItem[]>('getPriorityConfig').catch(() => null),
        runBackend<any[]>('getLayananListAll').catch(() => []),
        runBackend<any[]>('getInventoryList').catch(() => []),
        runBackend<any[]>('getPipelineConfigData').catch(() => []),
      ]);

      const validOrders = Array.isArray(orderData) ? orderData : [];
      const validCompleted = Array.isArray(completedData) ? completedData : [];
      setOrders(validOrders);
      setCompletedOrders(validCompleted);
      setMachines(Array.isArray(machineData) ? machineData : []);
      setLayananList(Array.isArray(layData) ? layData : []);
      setInventoryList(Array.isArray(invData) ? invData : []);
      setMasterSteps(Array.isArray(pipeData) ? pipeData : []);
      if (Array.isArray(priorityData) && priorityData.length > 0) {
        setDropOffPriorities(priorityData);
      }
      
      const activeStaff = Array.isArray(staffData) ? staffData.filter((s: any) => s.status !== 'Resign' && s.status !== 'Non-Aktif') : [];
      setStaff(activeStaff);
      if (activeStaff?.[0]?.nama) setStaffName((current) => current || activeStaff[0].nama);

      // Load WA reminder state from localStorage
      if (typeof window !== 'undefined') {
        const storedMap: Record<string, string> = {};
        validOrders.forEach(o => {
          const val = localStorage.getItem('wa_reminder_' + o.noNota);
          if (val) storedMap[o.noNota] = val;
        });
        setWaReminders(storedMap);
      }
    } catch (loadError) {
      console.error(loadError);
      setError('Data pesanan belum dapat dimuat. Periksa koneksi backend dan sesi login.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  // Handle WhatsApp Reminder for ready-for-pickup orders
  const handleSendSiapWA = (order: Transaksi, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const rawPhone = formatWaPhone(order.noHp);
    if (!rawPhone) {
      alert('Nomor WhatsApp pelanggan tidak valid atau belum diisi.');
      return;
    }

    const itemsSummary = (order.items || []).map(it => `${it.qty}x ${it.layanan}`).join(', ');
    const sisaTagihan = Number(order.sisaTagihan) || 0;
    const statusBayar = sisaTagihan > 0 ? `Belum Lunas (Sisa: Rp ${sisaTagihan.toLocaleString('id-ID')})` : 'Lunas';

    const nowTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const nowDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const waktuSelesaiStr = `${nowDateStr}, ${nowTimeStr}`;

    const msg = [
      `*NOTIFIKASI LAUNDRY SIAP DIAMBIL*`,
      `*Dua SiSi Laundry Express & Coin*`,
      ``,
      `Halo Kak *${order.namaPelanggan || 'Pelanggan'}*,`,
      `Kabar baik! Cucian Anda telah selesai diproses dengan bersih, rapi, dan wangi, serta *SIAP DIAMBIL* di outlet kami.`,
      ``,
      `- No. Nota      : ${order.noNota}`,
      `- Layanan       : ${itemsSummary || 'Drop Off'}`,
      ...(order.tanggal ? [`- Waktu Masuk   : ${order.tanggal}`] : []),
      `- Waktu Selesai : ${waktuSelesaiStr}`,
      `- Status Bayar  : ${statusBayar}`,
      ``,
      `*Lokasi Outlet* : Dua SiSi Laundry Express & Coin`,
      `*Jam Buka*      : 07.00 - 23.00 WIB`,
      ``,
      `Silakan datang ke outlet untuk pengambilan cucian. Terima kasih telah mencuci di Dua SiSi Laundry!`
    ].join('\n');

    const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ')';
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_reminder_' + order.noNota, nowStr);
    }
    setWaReminders(prev => ({ ...prev, [order.noNota]: nowStr }));

    // Log Activity to Audit Trail
    runBackend(
      'logClientActivity', 
      order.petugas || 'Staff', 
      'Kirim Reminder WA', 
      order.noNota, 
      '-', 
      `No WhatsApp: ${rawPhone}, Status: ${order.status}`, 
      `Kirim notifikasi pesan reminder cucian selesai ke ${order.namaPelanggan} (${order.noNota})`
    ).catch(() => {});

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Handle WhatsApp message for picked-up / completed orders
  const handleSendTerimaKasihWA = (order: Transaksi, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const rawPhone = formatWaPhone(order.noHp);
    if (!rawPhone) {
      alert('Nomor WhatsApp pelanggan tidak valid atau belum diisi.');
      return;
    }

    const itemsSummary = (order.items || []).map(it => `${it.qty}x ${it.layanan}`).join(', ');
    const notaLink = eNotaUrl(order.noNota);

    const msg = [
      `*TERIMA KASIH TELAH MENCUCI DI DUA SISI LAUNDRY* 🙏`,
      `*Dua SiSi Laundry Express & Coin*`,
      ``,
      `Halo Kak *${order.namaPelanggan || 'Pelanggan'}*,`,
      `Terima kasih telah mempercayakan cucian Anda kepada kami. Cucian untuk nota *${order.noNota}* telah diserahkan/diambil.`,
      ``,
      `- Layanan : ${itemsSummary || 'Drop Off'}`,
      `- Total   : Rp ${(Number(order.total) || 0).toLocaleString('id-ID')}`,
      `- e-Nota  : ${notaLink}`,
      ``,
      `Semoga Anda puas dengan layanan kami! Sampai jumpa pada cucian berikutnya. 😊`
    ].join('\n');

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Dynamically compute Kanban columns from Master Steps and all active orders, starting with Diterima
  const kanbanColumns = useMemo(() => {
    const cols: string[] = ['Diterima'];

    if (Array.isArray(masterSteps) && masterSteps.length > 0) {
      masterSteps.forEach((s) => {
        const name = String(s.nama || '').trim();
        if (
          name &&
          !cols.some(c => c.toLowerCase() === name.toLowerCase()) &&
          name !== 'Selesai' &&
          name.toLowerCase() !== 'pesanan diterima' &&
          name.toLowerCase() !== 'diterima'
        ) {
          cols.push(name);
        }
      });
    } else {
      ['Dicuci', 'Dikeringkan', 'Disetrika', 'Dilipat', 'Siap Diambil'].forEach((name) => {
        if (!cols.some(c => c.toLowerCase() === name.toLowerCase())) cols.push(name);
      });
    }

    const activeOrders = orders.filter(o => {
      const s = (o.status || '').trim().toLowerCase();
      return s !== 'selesai' && s !== 'void' && s !== 'batal';
    });

    activeOrders.forEach((o) => {
      if (Array.isArray(o.pipeline)) {
        o.pipeline.forEach((p) => {
          const name = String(p.namaStep || '').trim();
          const nameLower = name.toLowerCase();
          if (
            name &&
            !cols.some(c => c.toLowerCase() === nameLower) &&
            nameLower !== 'selesai' &&
            nameLower !== 'void' &&
            nameLower !== 'batal' &&
            nameLower !== 'pesanan diterima' &&
            nameLower !== 'diterima'
          ) {
            cols.push(name);
          }
        });
      }
      const statusStr = String(o.status || '').trim();
      const statusLower = statusStr.toLowerCase();
      if (
        statusStr &&
        !cols.some(c => c.toLowerCase() === statusLower) &&
        statusLower !== 'selesai' &&
        statusLower !== 'void' &&
        statusLower !== 'batal' &&
        statusLower !== 'pesanan diterima' &&
        statusLower !== 'diterima'
      ) {
        cols.push(statusStr);
      }
    });

    return cols;
  }, [masterSteps, orders]);

  const displayedKanbanColumns = useMemo(() => {
    if (filterTab === 'Diproses') {
      return kanbanColumns.filter(c => c.toLowerCase() !== 'siap diambil');
    }
    return kanbanColumns;
  }, [kanbanColumns, filterTab]);

  // Fallback and effective pipeline steps generation strictly tailored per service
  const getEffectivePipelineSteps = useCallback((order: Transaksi): PipelineStep[] => {
    if (Array.isArray(order.pipeline) && order.pipeline.length > 0) {
      return [...order.pipeline].sort((a, b) => (a.step || 0) - (b.step || 0));
    }

    let customSteps: any[] = [];
    for (const item of order.items || []) {
      const itemLayLower = String(item.layanan || '').trim().toLowerCase();
      const lay = layananList.find(l => 
        (l.nama || '').trim().toLowerCase() === itemLayLower ||
        (l.id || '').trim().toLowerCase() === itemLayLower
      );
      if (lay && Array.isArray(lay.pipelineSteps) && lay.pipelineSteps.length > 0) {
        customSteps = lay.pipelineSteps;
        break;
      }
    }

    if (customSteps.length === 0) {
      const allItemNames = (order.items || []).map((i: any) => String(i.layanan || '').toLowerCase()).join(' ');
      if (allItemNames.includes('cuci kering') || (allItemNames.includes('kering') && !allItemNames.includes('setrika') && !allItemNames.includes('komplit'))) {
        customSteps = [
          { nama: 'Diterima', icon: 'Inbox' },
          { nama: 'Dicuci', icon: 'Droplets' },
          { nama: 'Dikeringkan', icon: 'Wind' },
          { nama: 'Siap Diambil', icon: 'CheckCircle' },
        ];
      } else if (allItemNames.includes('setrika') && !allItemNames.includes('cuci')) {
        customSteps = [
          { nama: 'Diterima', icon: 'Inbox' },
          { nama: 'Disetrika / Packing', icon: 'Sparkles' },
          { nama: 'Siap Diambil', icon: 'CheckCircle' },
        ];
      } else if (allItemNames.includes('lipat') && !allItemNames.includes('setrika')) {
        customSteps = [
          { nama: 'Diterima', icon: 'Inbox' },
          { nama: 'Dicuci', icon: 'Droplets' },
          { nama: 'Dikeringkan', icon: 'Wind' },
          { nama: 'Dilipat / Packing', icon: 'Package' },
          { nama: 'Siap Diambil', icon: 'CheckCircle' },
        ];
      }
    }

    const stepNames = customSteps.length > 0
      ? customSteps.map(s => s.nama)
      : ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika / Packing', 'Siap Diambil'];

    const curStatus = (order.status || '').toLowerCase().trim();
    const isOrderCompleted = curStatus === 'selesai';
    const waktuMasuk = order.tanggal || '';
    const waktuSelesai = (order as any).updated_at || order.tanggal || '';

    const targetStepIdx = (() => {
      if (isOrderCompleted || curStatus.includes('diambil') || curStatus.includes('siap')) {
        return stepNames.length - 1;
      }
      const idx = stepNames.findIndex(n => n.toLowerCase().includes(curStatus));
      if (idx >= 0) return idx;
      if (curStatus.includes('cuci')) return stepNames.findIndex(n => n.toLowerCase().includes('cuci'));
      if (curStatus.includes('kering')) return stepNames.findIndex(n => n.toLowerCase().includes('kering'));
      if (curStatus.includes('setrika')) return stepNames.findIndex(n => n.toLowerCase().includes('setrika'));
      if (curStatus.includes('lipat')) return stepNames.findIndex(n => n.toLowerCase().includes('lipat'));
      return 0;
    })();

    return stepNames.map((nama, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === stepNames.length - 1;
      const stepStatus: 'Pending' | 'Aktif' | 'Selesai' = isOrderCompleted 
        ? 'Selesai' 
        : (idx < targetStepIdx ? 'Selesai' : (idx === targetStepIdx ? 'Aktif' : 'Pending'));

      let staff = order.petugas || 'Kasir';
      if (!isOrderCompleted && !isFirst) {
        staff = idx === targetStepIdx ? (order.petugas || 'Staff Outlet') : '-';
      }

      return {
        id: `fallback-${order.noNota}-${idx}`,
        noNota: order.noNota,
        step: idx + 1,
        namaStep: nama,
        status: stepStatus,
        assignedStaff: staff,
        waktuMulai: idx <= targetStepIdx ? waktuMasuk : undefined,
        waktuSelesai: idx < targetStepIdx ? waktuMasuk : (isOrderCompleted && isLast ? waktuSelesai : undefined),
      };
    });
  }, [layananList]);

  // Determine the next step strictly tailored to each order's active pipeline
  const getNextStatusForOrder = useCallback((order: Transaksi): string | null => {
    const curStatus = (order.status || 'Diterima').trim().toLowerCase();

    // Use order's effective pipeline steps (guaranteed customized to service)
    const effectiveSteps = getEffectivePipelineSteps(order);

    if (Array.isArray(effectiveSteps) && effectiveSteps.length > 0) {
      // Physical processing steps in pipeline (e.g. Dicuci, Dikeringkan, Siap Diambil)
      const realSteps = effectiveSteps.filter((p) => {
        const stepName = (p.namaStep || '').trim().toLowerCase();
        return stepName !== 'pesanan diterima' && stepName !== 'diterima';
      });

      // 1. If newly received (Diterima / Pesanan Diterima)
      if (curStatus === 'diterima' || curStatus === 'pesanan diterima' || curStatus === 'pending' || curStatus === 'baru') {
        return realSteps.length > 0 ? realSteps[0].namaStep : 'Dicuci';
      }

      // 2. Find index matching current status by exact name first
      let activeIdx = realSteps.findIndex(
        (p) => (p.namaStep || '').trim().toLowerCase() === curStatus
      );
      if (activeIdx < 0) {
        activeIdx = realSteps.findIndex((p) => p.status === 'Aktif');
      }

      if (activeIdx >= 0 && activeIdx < realSteps.length - 1) {
        return realSteps[activeIdx + 1].namaStep;
      }
      if (activeIdx === realSteps.length - 1) {
        return 'Selesai';
      }
    }

    return null;
  }, [getEffectivePipelineSteps]);

  // Count summaries for quick tabs with daily re-chat check
  const summaryCounts = useMemo(() => {
    let siapCount = 0;
    let belumWaCount = 0;
    let diprosesCount = 0;
    const todayDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    const activeOrders = orders.filter(o => {
      const s = (o.status || '').trim().toLowerCase();
      return s !== 'selesai' && s !== 'void' && s !== 'batal';
    });

    activeOrders.forEach(o => {
      const isSiap = o.status === 'Siap Diambil' || (o.pipeline && o.pipeline.some(p => p.namaStep === 'Siap Diambil' && p.status === 'Aktif'));
      if (isSiap) {
        siapCount++;
        const reminded = waReminders[o.noNota];
        const isRemindedToday = Boolean(reminded && reminded.includes(todayDateStr));
        if (!isRemindedToday) {
          belumWaCount++;
        }
      } else {
        diprosesCount++;
      }
    });

    return { 
      siapCount, 
      belumWaCount, 
      diprosesCount, 
      selesaiCount: completedOrders.length, 
      total: activeOrders.length 
    };
  }, [orders, completedOrders, waReminders]);

  const filteredOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const todayDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    return orders.filter((order) => {
      const curStatus = (order.status || '').trim().toLowerCase();
      if (curStatus === 'selesai' || curStatus === 'void' || curStatus === 'batal') {
        return false;
      }

      const orderPriority = order.tingkatLayanan || 'Reguler';
      const priorityMatch = priority === 'Semua' || orderPriority.toLowerCase() === priority.toLowerCase();
      const searchMatch = !keyword
        || order.noNota.toLowerCase().includes(keyword)
        || order.namaPelanggan.toLowerCase().includes(keyword)
        || (order.noHp || '').includes(keyword);

      if (!priorityMatch || !searchMatch) return false;

      const isSiap = order.status === 'Siap Diambil' || (order.pipeline && order.pipeline.some(p => p.namaStep === 'Siap Diambil' && p.status === 'Aktif'));
      if (filterTab === 'Diproses') return !isSiap;
      if (filterTab === 'SiapDiambil') return isSiap;
      if (filterTab === 'BelumWA') {
        const reminded = waReminders[order.noNota];
        const isRemindedToday = Boolean(reminded && reminded.includes(todayDateStr));
        return isSiap && !isRemindedToday;
      }

      return true;
    });
  }, [orders, priority, query, filterTab, waReminders]);

  // Filtered orders for completed / picked-up drop-off orders
  const filteredCompletedOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return completedOrders.filter((order) => {
      const orderPriority = order.tingkatLayanan || 'Reguler';
      const priorityMatch = priority === 'Semua' || orderPriority.toLowerCase() === priority.toLowerCase();
      const searchMatch = !keyword
        || order.noNota.toLowerCase().includes(keyword)
        || order.namaPelanggan.toLowerCase().includes(keyword)
        || (order.noHp || '').includes(keyword);

      return priorityMatch && searchMatch;
    });
  }, [completedOrders, priority, query]);

  const targetStatus = selected ? getNextStatusForOrder(selected) : null;
  const isTargetWasher = targetStatus?.toLowerCase().includes('cuci');
  const isTargetDryer = targetStatus?.toLowerCase().includes('kering');
  const requiresMachine = Boolean(isTargetWasher || isTargetDryer);

  const availableMachines = machines.filter((machine) => {
    if (machine.status !== 'Kosong') return false;
    if (isTargetWasher) return machine.tipe === 'Washer';
    if (isTargetDryer) return machine.tipe === 'Dryer';
    return false;
  });

  const openProgress = (order: Transaksi) => {
    setSelected(order);
    setMachineId('');
    setNote('');
    setError('');
  };

  const handleProgress = async () => {
    if (!selected || !targetStatus) return;
    if (requiresMachine && !machineId) {
      setError(`Pilih ${isTargetWasher ? 'washer' : 'dryer'} yang kosong.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await runBackend<{ success: boolean; message?: string }>('updateDropoffStatus', {
        noNota: selected.noNota,
        status: targetStatus,
        washerId: isTargetWasher ? machineId : '',
        dryerId: isTargetDryer ? machineId : '',
        assignedStaff: staffName,
        catatan: note.trim(),
        userName: staffName || 'Staff',
      });
      if (!result?.success) throw new Error(result?.message || 'Status pesanan gagal diperbarui.');
      clearCache('getTransaksiList');
      setSelected(null);
      await loadData();
    } catch (updateError) {
      console.error(updateError);
      setError(updateError instanceof Error ? updateError.message : 'Status pesanan gagal diperbarui.');
    } finally {
      setSubmitting(false);
    }
  };

  const getMachineDisplayName = useCallback((rawMachineId: string) => {
    if (!rawMachineId) return '';
    const cleanId = String(rawMachineId).trim();
    const found = machines.find(
      (m) => String(m.id).toLowerCase() === cleanId.toLowerCase() || String(m.nama).toLowerCase() === cleanId.toLowerCase()
    );
    if (found?.nama) return found.nama;
    return cleanId;
  }, [machines]);

  const renderCard = (order: Transaksi) => {
    const next = getNextStatusForOrder(order);
    const rawMachine = activeMachine(order);
    const machineName = getMachineDisplayName(rawMachine);
    const orderPriority = order.tingkatLayanan || 'Reguler';
    const priConfig = dropOffPriorities.find((p) => p.nama.toLowerCase() === orderPriority.toLowerCase());
    const badgeWarna = priConfig?.warna || (
      orderPriority.toLowerCase().includes('kilat') ? 'bg-rose-100 text-rose-700 border-rose-300' :
      orderPriority.toLowerCase().includes('express') ? 'bg-amber-100 text-amber-800 border-amber-300' :
      'bg-teal-100 text-teal-800 border-teal-300'
    );
    const isSiapDiambil = order.status === 'Siap Diambil' || next === 'Selesai';
    const remindedTime = waReminders[order.noNota];
    const todayDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const isRemindedToday = Boolean(remindedTime && remindedTime.includes(todayDateStr));

    const daysInOutlet = (() => {
      if (!order.tanggal) return 0;
      const orderDate = new Date(order.tanggal);
      if (isNaN(orderDate.getTime())) return 0;
      const diffMs = Date.now() - orderDate.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    })();

    // Active pipeline step info & start time & live elapsed duration
    const activeStepInfo = (() => {
      const curStatus = (order.status || 'Diterima').trim().toLowerCase();
      const matchedStep = order.pipeline?.find(
        (p) => p.status === 'Aktif' || p.namaStep.toLowerCase() === curStatus
      );

      const startTimeRaw = matchedStep?.waktuMulai || order.tanggal || '';
      if (!startTimeRaw) return { timeStr: '-', elapsedStr: '-', elapsedMins: 0 };

      // Parse date gracefully (support "YYYY-MM-DD HH:mm:ss", "DD/MM/YYYY HH:mm", ISO, etc.)
      let startDate: Date;
      if (typeof startTimeRaw === 'string' && startTimeRaw.includes('/')) {
        const parts = startTimeRaw.split(' ')[0].split('/');
        const timePart = startTimeRaw.split(' ')[1] || '00:00';
        const [hh, mm, ss] = timePart.split(':');
        startDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), Number(hh) || 0, Number(mm) || 0, Number(ss) || 0);
      } else {
        startDate = new Date(startTimeRaw);
      }

      if (isNaN(startDate.getTime())) {
        return { timeStr: startTimeRaw, elapsedStr: '-', elapsedMins: 0 };
      }

      const timeStr = startDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      const nowMs = Date.now();
      const diffMs = Math.max(0, nowMs - startDate.getTime());
      const totalMins = Math.floor(diffMs / (1000 * 60));

      let elapsedStr = '';
      if (totalMins < 1) {
        elapsedStr = 'Baru saja (< 1 mnt)';
      } else if (totalMins < 60) {
        elapsedStr = `${totalMins} Menit`;
      } else if (totalMins < 1440) {
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        elapsedStr = `${h} Jam ${m > 0 ? `${m} Mnt` : ''}`;
      } else {
        const d = Math.floor(totalMins / 1440);
        const h = Math.floor((totalMins % 1440) / 60);
        elapsedStr = `${d} Hari ${h > 0 ? `${h} Jam` : ''}`;
      }

      return { timeStr, elapsedStr, elapsedMins: totalMins };
    })();

    // Receipt creation timestamp (jam struk diterima)
    const jamDiterimaStr = (() => {
      if (!order.tanggal) return '';
      let d: Date;
      if (typeof order.tanggal === 'string' && order.tanggal.includes('/')) {
        const parts = order.tanggal.split(' ')[0].split('/');
        const timePart = order.tanggal.split(' ')[1] || '';
        const [hh, mm] = timePart.split(':');
        d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), Number(hh) || 0, Number(mm) || 0);
      } else {
        d = new Date(order.tanggal);
      }
      if (isNaN(d.getTime())) return String(order.tanggal);

      const isToday = new Date().toDateString() === d.toDateString();
      const timeOnly = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      if (isToday) return timeOnly;
      const dateOnly = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      return `${dateOnly}, ${timeOnly}`;
    })();

    return (
      <article 
        key={order.noNota} 
        onClick={() => setDetailModalOrder(order)}
        className="glass-card card-hover-lift p-3.5 space-y-3 cursor-pointer transition hover:shadow-md hover:border-teal-300"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="truncate text-xs font-black text-slate-800 font-mono tracking-tight">{order.noNota}</p>
              {jamDiterimaStr && (
                <span className="text-[10px] font-semibold text-slate-400 font-mono">
                  • {jamDiterimaStr}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{order.namaPelanggan}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border shadow-2xs ${badgeWarna}`}>
              {orderPriority}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-[11px] text-slate-500">
          {/* 1. Waktu Masuk Tahap & Durasi Berjalan */}
          <div className="bg-slate-50/90 rounded-lg p-2 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Clock3 className="h-3 w-3 text-slate-400" />
                <span>Mulai {order.status || 'Tahap Ini'}:</span>
              </span>
              <span className="font-bold text-slate-700 font-mono">{activeStepInfo.timeStr}</span>
            </div>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Timer className="h-3 w-3 text-teal-600" />
                <span>Durasi Berjalan:</span>
              </span>
              <span className="font-extrabold text-teal-800 bg-teal-100/70 px-1.5 py-0.2 rounded border border-teal-300/80 font-mono text-[10px]">
                {activeStepInfo.elapsedStr}
              </span>
            </div>
          </div>

          {/* 2. Estimasi Target Selesai Order */}
          <div className="flex items-center justify-between text-[10.5px] px-0.5 text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <span>🎯 Target Selesai:</span>
            </span>
            <span className="font-bold text-slate-700">{order.estimasiSelesai || order.estimasi || '-'}</span>
          </div>

          {machineName && (
            <div className="flex items-center gap-1.5 font-bold text-teal-800 bg-teal-50/80 px-2 py-1 rounded-md border border-teal-200">
              <WashingMachine className="h-3.5 w-3.5 text-teal-700 shrink-0" />
              <span className="truncate">Mesin: {machineName}</span>
            </div>
          )}

          <p className="line-clamp-2 text-slate-600 font-medium pt-0.5">
            {order.items.map((item) => `${item.layanan} ×${item.qty}`).join(', ')}
          </p>
          
          {/* Linked Multi-Bahan Material Indicator */}
          {(() => {
            const mats: string[] = [];
            (order.items || []).forEach(it => {
              const lay = layananList.find(l => l.nama === it.layanan);
              if (lay) {
                const listBahan: LayananBahanBaku[] = Array.isArray(lay.bahanBakuList) && lay.bahanBakuList.length > 0
                  ? lay.bahanBakuList
                  : (lay.idInventory ? [{ idInventory: lay.idInventory, qty: lay.inventoryDeductionQty || 1, tahap: 'Dicuci' }] : []);
                
                listBahan.forEach(b => {
                  const inv = inventoryList.find(i => i.id === b.idInventory);
                  const deductionPerUnit = parseDecimal(b.qty, 1);
                  const total = Math.round(((Number(it.qty) || 1) * deductionPerUnit + 1e-7) * 10000) / 10000;
                  mats.push(`${inv?.nama || b.idInventory}: ${formatDecimal(total)} ${inv?.satuan || 'unit'}`);
                });
              }
            });

            if (mats.length === 0) return null;
            return (
              <div className="pt-1 flex items-center gap-1 text-[10px] text-amber-800 font-semibold truncate">
                <span className="shrink-0">🧪 Bahan:</span>
                <span className="truncate bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">{mats.join(', ')}</span>
              </div>
            );
          })()}
        </div>

        {/* Khusus Tahap Siap Diambil: Menampilkan Reminder WhatsApp & Tombol Serahkan */}
        {isSiapDiambil ? (
          <div className="pt-2.5 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {daysInOutlet > 0 ? `Di Rak ${daysInOutlet} Hari:` : 'Status Di Rak:'}
              </span>
              {isRemindedToday ? (
                <span className="badge-glow-emerald flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" title={`Terakhir dikirim: ${remindedTime}`}>
                  <Check className="w-3 h-3 stroke-[3]" /> Sudah di-WA Hari Ini
                </span>
              ) : (
                <span className="badge-glow-amber flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                  <AlertCircle className="w-3 h-3" /> {remindedTime ? 'Butuh Re-chat Hari Ini' : 'Belum di-WA'}
                </span>
              )}
            </div>

            {/* Tombol Kirim WA Reminder */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSendSiapWA(order, e);
              }}
              className="tactile-btn btn-glow-emerald flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold shadow-xs cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>
                {isRemindedToday
                  ? 'Kirim Ulang WhatsApp'
                  : (remindedTime ? `Kirim Re-chat WA (Hari ke-${daysInOutlet + 1})` : 'Kirim WA Siap Diambil')}
              </span>
            </button>

            {/* Tombol Serahkan / Selesai */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openProgress(order);
              }}
              className="tactile-btn flex w-full items-center justify-between rounded-xl bg-[#1E4648] hover:bg-[#163536] px-3.5 py-2 text-[11px] font-bold text-white transition shadow-xs cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-200" />
                <span>Serahkan ke Pelanggan (Selesai)</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          next && (() => {
            const NextIcon = getWorkflowIcon(next);
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openProgress(order);
                }}
                className="tactile-btn mt-3 flex w-full items-center justify-between rounded-xl bg-[#1E4648] hover:bg-[#163536] px-3.5 py-2 text-[11px] font-bold text-white transition shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <NextIcon className="w-3.5 h-3.5 text-teal-200" />
                  <span>Lanjut ke {next}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            );
          })()
        )}
      </article>
    );
  };

  const renderCompletedCard = (order: Transaksi) => {
    const orderPriority = order.tingkatLayanan || 'Reguler';
    const priConfig = dropOffPriorities.find((p) => p.nama.toLowerCase() === orderPriority.toLowerCase());
    const badgeWarna = priConfig?.warna || (
      orderPriority.toLowerCase().includes('kilat') ? 'bg-rose-100 text-rose-700 border-rose-300' :
      orderPriority.toLowerCase().includes('express') ? 'bg-amber-100 text-amber-800 border-amber-300' :
      'bg-teal-100 text-teal-800 border-teal-300'
    );

    const waktuSelesaiStr = (() => {
      const raw = (order as any).updated_at || order.tanggal || '';
      if (!raw) return '-';
      const d = new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      return `${dateStr}, ${timeStr}`;
    })();

    const sisaTagihan = Number(order.sisaTagihan) || 0;
    const isLunas = sisaTagihan <= 0;

    return (
      <article 
        key={order.noNota} 
        onClick={() => setDetailModalOrder(order)}
        className="glass-card card-hover-lift p-4 space-y-3 border-emerald-200/80 cursor-pointer transition hover:shadow-md hover:border-emerald-300 relative group"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="truncate text-xs font-black text-slate-800 font-mono tracking-tight">{order.noNota}</p>
              <span className="badge-glow-emerald flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3 stroke-[3]" /> Sudah Diambil
              </span>
            </div>
            <p className="mt-1 truncate text-xs font-bold text-slate-700">{order.namaPelanggan}</p>
            {order.noHp && (
              <p className="text-[10px] font-mono text-slate-400">{order.noHp}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border shadow-2xs ${badgeWarna}`}>
            {orderPriority}
          </span>
        </div>

        <div className="space-y-2 text-[11px] text-slate-500">
          <div className="bg-slate-50/90 rounded-lg p-2.5 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Clock3 className="h-3 w-3 text-emerald-600" />
                <span>Waktu Selesai / Diambil:</span>
              </span>
              <span className="font-bold text-slate-700 font-mono text-[10.5px]">{waktuSelesaiStr}</span>
            </div>
            {order.petugas && (
              <div className="flex items-center justify-between text-[10.5px] pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Petugas Penyerah:</span>
                <span className="font-bold text-slate-700">{order.petugas}</span>
              </div>
            )}
          </div>

          <p className="line-clamp-2 text-slate-600 font-medium pt-0.5 text-xs">
            {order.items && order.items.length > 0
              ? order.items.map((item) => `${item.layanan} ×${item.qty}`).join(', ')
              : 'Drop Off Service'}
          </p>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
            <span className="font-medium text-slate-500">Total Biaya:</span>
            <div className="text-right">
              <span className="font-black text-slate-900 text-xs font-mono">
                Rp {(Number(order.total) || 0).toLocaleString('id-ID')}
              </span>
              <span className={`block text-[10px] font-bold ${isLunas ? 'text-emerald-600' : 'text-amber-600'}`}>
                {isLunas ? '• Lunas' : `• Sisa: Rp ${sisaTagihan.toLocaleString('id-ID')}`}
              </span>
            </div>
          </div>
        </div>

        {/* Tombol Aksi Langsung ke Detail Riwayat Pipeline */}
        <div className="pt-0.5">
          <div className="w-full py-1.5 px-2.5 rounded-xl bg-slate-50 group-hover:bg-teal-50/80 text-[#1E4648] border border-slate-200/80 group-hover:border-teal-300 text-[11px] font-bold flex items-center justify-between transition">
            <span className="flex items-center gap-1.5">
              <Workflow className="w-3.5 h-3.5 text-teal-700" />
              <span>Detail Riwayat Pipeline & Petugas</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Quick Actions: Cetak Struk, e-Nota, WhatsApp */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTxToPrint(order);
              setIsPrinterModalOpen(true);
            }}
            className="tactile-btn flex items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-slate-200 py-2 px-2 text-[10px] font-bold text-slate-700 transition cursor-pointer"
            title="Cetak Struk Thermal"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Struk</span>
          </button>

          <a
            href={eNotaUrl(order.noNota)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="tactile-btn flex items-center justify-center gap-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 py-2 px-2 text-[10px] font-bold transition cursor-pointer"
            title="Lihat e-Nota Digital"
          >
            <ExternalLink className="w-3.5 h-3.5 text-teal-700" />
            <span>e-Nota</span>
          </a>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSendTerimaKasihWA(order, e);
            }}
            className="tactile-btn flex items-center justify-center gap-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2 px-2 text-[10px] font-bold transition cursor-pointer"
            title="Kirim WA Terima Kasih"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>WA</span>
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="w-full space-y-4 p-3 sm:p-5">
      <section className="glass-panel p-4 sm:p-5 rounded-2xl space-y-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">Manajemen Pesanan Drop-off</h2>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">Pengerjaan fisik, staf, washer/dryer, status rak, dan reminder penjemputan WhatsApp.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('kanban')} className={`tactile-btn rounded-xl border p-2 ${view === 'kanban' ? 'border-teal-700 bg-teal-800 text-white shadow-xs' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`} title="Kanban"><Columns3 className="h-4 w-4" /></button>
            <button onClick={() => setView('list')} className={`tactile-btn rounded-xl border p-2 ${view === 'list' ? 'border-teal-700 bg-teal-800 text-white shadow-xs' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`} title="List"><List className="h-4 w-4" /></button>
            <button onClick={loadData} disabled={loading} className="tactile-btn rounded-xl border border-slate-200 p-2 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        {/* Quick Filter Tabs (Semua, Diproses, Siap Diambil, Belum di-WA) */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          <button
            onClick={() => setFilterTab('Semua')}
            className={`tactile-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filterTab === 'Semua'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Semua Pesanan</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${filterTab === 'Semua' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {summaryCounts.total}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('Diproses')}
            className={`tactile-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filterTab === 'Diproses'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Sedang Diproses</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${filterTab === 'Diproses' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {summaryCounts.diprosesCount}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('SiapDiambil')}
            className={`tactile-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filterTab === 'SiapDiambil'
                ? 'badge-glow-teal text-teal-950 font-black shadow-xs'
                : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
            }`}
          >
            <span>Siap Diambil (Di Rak)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${filterTab === 'SiapDiambil' ? 'bg-teal-800 text-white' : 'bg-teal-200 text-teal-900'}`}>
              {summaryCounts.siapCount}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('BelumWA')}
            className={`tactile-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filterTab === 'BelumWA'
                ? 'badge-glow-amber text-amber-950 font-black shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>Belum di-WA</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${filterTab === 'BelumWA' ? 'bg-amber-800 text-white' : 'bg-amber-200 text-amber-900'}`}>
              {summaryCounts.belumWaCount}
            </span>
          </button>

          <button
            onClick={() => setFilterTab('SudahDiambil')}
            className={`tactile-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              filterTab === 'SudahDiambil'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sudah Diambil (Riwayat)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${filterTab === 'SudahDiambil' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-900'}`}>
              {summaryCounts.selesaiCount}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nota, pelanggan, atau no. HP..." className="input-glow w-full rounded-xl py-2 pl-10 pr-3 text-xs" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['Semua', ...dropOffPriorities.filter(p => p.aktif !== false).map(p => p.nama)].map((item) => (
              <button
                key={item}
                onClick={() => setPriority(item)}
                className={`tactile-btn shrink-0 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition ${
                  priority.toLowerCase() === item.toLowerCase()
                    ? 'border-teal-700 bg-teal-800 text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && !selected && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700"><AlertCircle className="h-4 w-4" />{error}</div>}

      {/* Contextual Status Banners */}
      {filterTab === 'SiapDiambil' && filteredOrders.length > 0 && (
        <div className="flex items-center justify-between bg-teal-50/80 border border-teal-200/80 rounded-xl px-4 py-2.5 text-xs text-teal-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
            <span className="font-semibold">
              Menampilkan <strong>{filteredOrders.length} cucian</strong> yang sudah selesai diproses dan siap diambil di rak outlet.
            </span>
          </div>
          <span className="text-[11px] font-bold text-teal-800 bg-teal-100/80 px-2.5 py-0.5 rounded-full">
            Siap Diambil di Rak
          </span>
        </div>
      )}
      {filterTab === 'BelumWA' && filteredOrders.length > 0 && (
        <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/80 rounded-xl px-4 py-2.5 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">
              Menampilkan <strong>{filteredOrders.length} cucian di rak</strong> yang belum dikirimi pesan WhatsApp hari ini.
            </span>
          </div>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
            Belum di-WA Hari Ini
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
      ) : filterTab === 'SudahDiambil' ? (
        filteredCompletedOrders.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-dashed border-slate-300 p-16 text-center text-xs text-slate-500">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            Tidak ada riwayat pesanan drop-off yang sudah diambil pada filter ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filteredCompletedOrders.map(renderCompletedCard)}
          </div>
        )
      ) : filteredOrders.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-dashed border-slate-300 p-16 text-center text-xs text-slate-500">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          {filterTab === 'SiapDiambil'
            ? 'Tidak ada cucian di rak yang siap diambil saat ini.'
            : filterTab === 'BelumWA'
            ? 'Semua cucian di rak sudah dikirimi notifikasi WhatsApp hari ini.'
            : 'Tidak ada pesanan aktif pada filter ini.'}
        </div>
      ) : filterTab === 'SiapDiambil' || filterTab === 'BelumWA' || view === 'list' ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{filteredOrders.map(renderCard)}</div>
      ) : (
        <div className="flex snap-x gap-3.5 overflow-x-auto pb-4">
          {displayedKanbanColumns.map((status) => {
            const statusOrders = filteredOrders.filter((order) => {
              const curStatus = (order.status || 'Diterima').trim().toLowerCase();
              const colName = status.trim().toLowerCase();

              // Active pipeline step if any
              const activeStep = order.pipeline?.find((p) => p.status === 'Aktif')?.namaStep?.trim().toLowerCase();

              // 1. Column Diterima (Pesanan Baru Masuk)
              if (colName === 'diterima' || colName === 'pesanan diterima') {
                if (activeStep) {
                  return activeStep === 'diterima' || activeStep === 'pesanan diterima';
                }
                return curStatus === 'diterima' || curStatus === 'pesanan diterima' || curStatus === 'pending' || curStatus === 'baru';
              }

              // 2. Processing Columns (Dicuci, Dikeringkan, Disetrika, Dilipat, Siap Diambil, etc.)
              if (activeStep) {
                return activeStep === colName;
              }

              return curStatus === colName;
            });
            const StatusIcon = getWorkflowIcon(status);
            return (
              <section key={status} className="glass-kanban-col w-[86vw] max-w-[320px] shrink-0 snap-start p-3.5 sm:w-[300px]">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-teal-800 text-white flex items-center justify-center shadow-2xs">
                      <StatusIcon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-black text-slate-800">{status}</h3>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-slate-600 border border-slate-200/80 shadow-2xs">{statusOrders.length}</span>
                </div>
                <div className="space-y-3">{statusOrders.length ? statusOrders.map(renderCard) : <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-xs font-medium text-slate-400">Antrean kosong</div>}</div>
              </section>
            );
          })}
        </div>
      )}

      {selected && targetStatus && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-md">
          <div className="glass-modal max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div><h3 className="text-sm font-black text-slate-800">Lanjut ke {targetStatus}</h3><p className="mt-0.5 text-xs text-slate-500 font-mono font-bold">{selected.noNota} · {selected.namaPelanggan}</p></div>
              <button onClick={() => setSelected(null)} className="tactile-btn rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Staf Memproses</label><select value={staffName} onChange={(event) => setStaffName(event.target.value)} className="input-glow w-full rounded-xl px-3.5 py-2.5 text-xs outline-none">{staff.map((item) => <option key={item.id} value={item.nama}>{item.nama}{item.jabatan ? ` (${item.jabatan})` : ''}</option>)}</select></div>

              {requiresMachine && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">{isTargetWasher ? 'Washer' : 'Dryer'} *</label>
                  <select value={machineId} onChange={(event) => setMachineId(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#1E4648]">
                    <option value="">Pilih mesin kosong...</option>
                    {availableMachines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.nama} ({machine.tipe})
                      </option>
                    ))}
                  </select>
                  {availableMachines.length === 0 && <p className="mt-1 text-[11px] font-semibold text-rose-600">Tidak ada mesin kosong untuk tahap ini.</p>}
                </div>
              )}

              {/* Pemakaian Bahan Baku Inventory saat Tahap ini */}
              {(() => {
                const stageMaterials: any[] = [];
                (selected.items || []).forEach(it => {
                  const lay = layananList.find(l => l.nama === it.layanan);
                  if (lay) {
                    const listBahan: LayananBahanBaku[] = Array.isArray(lay.bahanBakuList) && lay.bahanBakuList.length > 0
                      ? lay.bahanBakuList
                      : (lay.idInventory ? [{ idInventory: lay.idInventory, qty: lay.inventoryDeductionQty || 1, tahap: 'Dicuci' }] : []);
                    
                    listBahan.forEach(b => {
                      const stepTarget = b.tahap || 'Dicuci';
                      if (stepTarget === targetStatus || (stepTarget === 'Dicuci' && targetStatus === 'Dicuci')) {
                        const inv = inventoryList.find(i => i.id === b.idInventory);
                        const deductionPerUnit = parseDecimal(b.qty, 1);
                        const totalQty = Math.round(((Number(it.qty) || 1) * deductionPerUnit + 1e-7) * 10000) / 10000;
                        stageMaterials.push({
                          namaLayanan: it.layanan,
                          orderQty: it.qty,
                          namaBahan: inv?.nama || b.idInventory,
                          satuanBahan: inv?.satuan || 'unit',
                          totalPemakaian: totalQty,
                          sisaStok: inv?.stok
                        });
                      }
                    });
                  }
                });

                if (stageMaterials.length === 0) return null;

                return (
                  <div className="bg-amber-50/80 border border-amber-200/90 p-3 rounded-xl space-y-1.5 text-xs">
                    <div className="font-bold text-amber-950 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>🧪</span>
                        <span>Pemakaian Bahan Baku ({targetStatus}):</span>
                      </span>
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full">
                        Otomatis Potong Stok
                      </span>
                    </div>
                    <div className="space-y-1 pt-1">
                      {stageMaterials.map((mat: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-amber-200/80 text-[11px]">
                          <div>
                            <span className="font-bold text-slate-800">{mat.namaBahan}</span>
                            <span className="text-slate-400 text-[10px] ml-1">({mat.orderQty}x order)</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-black text-[#1E4648] bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-xs">
                              {mat.totalPemakaian} {mat.satuanBahan}
                            </span>
                            {mat.sisaStok !== undefined && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Sisa: {mat.sisaStok} {mat.satuanBahan}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div><label className="mb-1 block text-xs font-bold text-slate-700">Catatan Proses</label><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Opsional: kondisi cucian atau instruksi proses" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#1E4648]" /></div>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{error}</p>}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setSelected(null)} disabled={submitting} className="rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600">Batal</button>
              <button onClick={handleProgress} disabled={submitting || (requiresMachine && !machineId)} className="flex-1 rounded-lg bg-[#1E4648] py-2.5 text-xs font-bold text-white disabled:opacity-50">{submitting ? 'Menyimpan...' : `Konfirmasi ${targetStatus}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Riwayat Pengerjaan Per Pipeline */}
      {detailModalOrder && (() => {
        const order = detailModalOrder;
        const steps = getEffectivePipelineSteps(order);
        const orderPriority = order.tingkatLayanan || 'Reguler';
        const priConfig = dropOffPriorities.find((p) => p.nama.toLowerCase() === orderPriority.toLowerCase());
        const badgeWarna = priConfig?.warna || 'bg-teal-100 text-teal-800 border-teal-300';
        const sisaTagihan = Number(order.sisaTagihan) || 0;
        const isLunas = sisaTagihan <= 0;
        const waktuMasukStr = formatWibDate(order.tanggal);
        const waktuSelesaiRaw = (order as any).updated_at || order.tanggal;
        const waktuSelesaiStr = formatWibDate(waktuSelesaiRaw);
        const totalDurasi = getFormattedDuration(order.tanggal, (order.status || '').toLowerCase() === 'selesai' ? waktuSelesaiRaw : undefined);

        return (
          <div className="fixed inset-0 z-[650] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="glass-modal max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 animate-scale-in">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#1E4648] border border-teal-200 flex items-center justify-center shrink-0 shadow-xs">
                    <Workflow className="w-5 h-5 text-teal-800" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-800 tracking-tight">Riwayat Pengerjaan Pipeline</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border shadow-2xs ${badgeWarna}`}>
                        {orderPriority}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (order.status || '').toLowerCase() === 'selesai'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-teal-100 text-[#1E4648] border border-teal-300'
                      }`}>
                        {(order.status || '').toLowerCase() === 'selesai' ? '✓ Sudah Diambil' : order.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 font-medium">
                      No. Nota: <span className="font-mono font-bold text-slate-800">{order.noNota}</span> · Pelanggan: <strong className="text-slate-700">{order.namaPelanggan}</strong> {order.noHp && `(${order.noHp})`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setDetailModalOrder(null)} 
                  className="tactile-btn rounded-xl p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  title="Tutup"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Ringkasan Pesanan Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Waktu & Durasi</span>
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>Masuk: {waktuMasukStr}</span>
                  </div>
                  {(order.status || '').toLowerCase() === 'selesai' && (
                    <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Selesai: {waktuSelesaiStr}</span>
                    </div>
                  )}
                  <div className="text-[11px] font-extrabold text-[#1E4648] bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-md inline-block font-mono">
                    Total: {totalDurasi}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Petugas Penyerah & Kasir</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>{order.petugas || 'Kasir'}</span>
                  </div>
                  <div className="text-slate-500 font-medium">
                    Bayar: <span className="font-bold text-slate-700">{order.metodeBayar || 'Tunai'}</span>
                  </div>
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${isLunas ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {isLunas ? 'Lunas' : `Sisa: Rp ${sisaTagihan.toLocaleString('id-ID')}`}
                  </span>
                </div>

                <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Layanan & Total Biaya</span>
                  <p className="line-clamp-2 text-slate-700 font-semibold text-[11px]">
                    {order.items && order.items.length > 0
                      ? order.items.map((it) => `${it.layanan} ×${it.qty}`).join(', ')
                      : 'Drop Off Service'}
                  </p>
                  <div className="font-black text-slate-900 text-sm font-mono pt-0.5">
                    Rp {(Number(order.total) || 0).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Timeline / Stepper Per Pipeline Step */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Tahapan Pengerjaan Fisik ({steps.length} Langkah)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Lengkap dengan petugas & mesin per proses
                  </span>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {steps.map((step, idx) => {
                    const isStepSelesai = step.status === 'Selesai';
                    const isStepAktif = step.status === 'Aktif';
                    const StepIcon = getWorkflowIcon(step.namaStep);
                    const machineName = getMachineDisplayName(step.mesinId || step.washerId || step.dryerId || '');
                    const durationStr = getFormattedDuration(step.waktuMulai, step.waktuSelesai);
                    const startTimeStr = step.waktuMulai ? formatWibDate(step.waktuMulai) : null;
                    const endTimeStr = step.waktuSelesai ? formatWibDate(step.waktuSelesai) : null;

                    // Petugas pengerja resolution
                    const staffName = step.assignedStaff || (isStepSelesai ? (order.petugas || 'Staff Outlet') : '-');

                    return (
                      <div key={idx} className="relative group">
                        {/* Step Marker Indicator */}
                        <div className={`absolute -left-6 top-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition shadow-xs z-10 ${
                          isStepSelesai
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                            : isStepAktif
                            ? 'bg-[#1E4648] text-white ring-4 ring-teal-100 animate-pulse'
                            : 'bg-slate-200 text-slate-600 ring-4 ring-slate-50'
                        }`}>
                          {isStepSelesai ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>

                        {/* Step Card Box */}
                        <div className={`rounded-xl border p-3 transition space-y-2.5 ${
                          isStepAktif
                            ? 'bg-white border-teal-500 shadow-sm ring-1 ring-teal-200'
                            : isStepSelesai
                            ? 'bg-white border-slate-200 hover:border-slate-300'
                            : 'bg-slate-50/70 border-slate-200/60 opacity-70'
                        }`}>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${
                                isStepSelesai ? 'bg-emerald-50 text-emerald-700' : isStepAktif ? 'bg-teal-50 text-[#1E4648]' : 'bg-slate-100 text-slate-500'
                              }`}>
                                <StepIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-black text-slate-800">
                                  Langkah {idx + 1}: {step.namaStep}
                                </span>
                              </div>
                            </div>

                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isStepSelesai
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : isStepAktif
                                ? 'bg-teal-100 text-[#1E4648] border border-teal-300 font-black animate-pulse'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {isStepSelesai ? '✓ Selesai' : isStepAktif ? '⚡ Sedang Dikerjakan' : '⏳ Menunggu Antrean'}
                            </span>
                          </div>

                          {/* Detail Grid: Petugas, Mesin, Waktu */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                            {/* Petugas Pengerja */}
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                              <div className="w-6 h-6 rounded-md bg-teal-100/70 text-teal-800 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] text-slate-400 block font-medium">Petugas Pengerja</span>
                                <span className="font-bold text-slate-800 truncate block">
                                  {staffName !== '-' ? staffName : 'Belum Ditugaskan'}
                                </span>
                              </div>
                            </div>

                            {/* Mesin Digunakan */}
                            {machineName ? (
                              <div className="flex items-center gap-2 bg-teal-50/70 p-2 rounded-lg border border-teal-200/80">
                                <div className="w-6 h-6 rounded-md bg-teal-200/70 text-teal-900 flex items-center justify-center shrink-0">
                                  <WashingMachine className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-[10px] text-teal-700 block font-medium">Mesin / Washer-Dryer</span>
                                  <span className="font-bold text-teal-950 truncate block">
                                    {machineName}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                                <div className="w-6 h-6 rounded-md bg-slate-200/60 text-slate-600 flex items-center justify-center shrink-0">
                                  <Clock3 className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-[10px] text-slate-400 block font-medium">Estimasi Durasi</span>
                                  <span className="font-bold text-slate-700 font-mono text-[11px] block">
                                    {durationStr !== '-' ? durationStr : 'Proses Manual / Rak'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Timestamp Mulai & Selesai */}
                          {(startTimeStr || endTimeStr) && (
                            <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] text-slate-500 pt-1 font-mono">
                              {startTimeStr && (
                                <span>Mulai: <strong className="text-slate-700">{startTimeStr}</strong></span>
                              )}
                              {endTimeStr && (
                                <span>Selesai: <strong className="text-slate-700">{endTimeStr}</strong></span>
                              )}
                              {durationStr !== '-' && (
                                <span className="text-teal-800 font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                                  ⏱ {durationStr}
                                </span>
                              )}
                            </div>
                          )}

                          {step.catatan && (
                            <div className="text-[10.5px] italic text-slate-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                              Catatan: "{step.catatan}"
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-4 border-t border-slate-100 mt-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => {
                      setTxToPrint(order);
                      setIsPrinterModalOpen(true);
                    }}
                    className="tactile-btn flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 py-2 px-3 text-xs font-bold text-slate-700 transition cursor-pointer"
                    title="Cetak Struk Thermal"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Cetak Struk</span>
                  </button>

                  <a
                    href={eNotaUrl(order.noNota)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tactile-btn flex items-center gap-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 py-2 px-3 text-xs font-bold transition cursor-pointer"
                    title="Buka e-Nota Digital"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-teal-700" />
                    <span>e-Nota</span>
                  </a>

                  <button
                    onClick={(e) => handleSendTerimaKasihWA(order, e)}
                    className="tactile-btn flex items-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2 px-3 text-xs font-bold transition cursor-pointer"
                    title="Kirim Pesan WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailModalOrder(null)}
                  className="tactile-btn px-5 py-2 rounded-xl bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Printer Modal untuk Cetak Struk Drop-off */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => {
          setIsPrinterModalOpen(false);
          setTxToPrint(null);
        }}
        tx={txToPrint}
      />
    </div>
  );
}
