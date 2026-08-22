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
  Inbox
} from 'lucide-react';
import { Mesin, Transaksi, LayananBahanBaku } from '@/lib/types';
import { runBackend } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { formatWaPhone } from '@/lib/utils';
import { DropOffPriorityItem } from './ProdukView';

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

export default function PesananView() {
  const [orders, setOrders] = useState<Transaksi[]>([]);
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
  const [filterTab, setFilterTab] = useState<'Semua' | 'Diproses' | 'SiapDiambil' | 'BelumWA'>('Semua');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selected, setSelected] = useState<Transaksi | null>(null);
  const [machineId, setMachineId] = useState('');
  const [staffName, setStaffName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [waReminders, setWaReminders] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, machineData, staffData, priorityData, layData, invData, pipeData] = await Promise.all([
        runBackend<Transaksi[]>('getTransaksiByPipeline', 'Semua').catch(() => []),
        runBackend<Mesin[]>('getMesinList').catch(() => []),
        runBackend<StaffItem[]>('getPegawaiList').catch(() => []),
        runBackend<DropOffPriorityItem[]>('getPriorityConfig').catch(() => null),
        runBackend<any[]>('getLayananListAll').catch(() => []),
        runBackend<any[]>('getInventoryList').catch(() => []),
        runBackend<any[]>('getPipelineConfigData').catch(() => []),
      ]);

      const validOrders = Array.isArray(orderData) ? orderData : [];
      setOrders(validOrders);
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

    orders.forEach((o) => {
      if (Array.isArray(o.pipeline)) {
        o.pipeline.forEach((p) => {
          const name = String(p.namaStep || '').trim();
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
      }
      const statusStr = String(o.status || '').trim();
      if (
        statusStr &&
        !cols.some(c => c.toLowerCase() === statusStr.toLowerCase()) &&
        statusStr !== 'Selesai' &&
        statusStr.toLowerCase() !== 'pesanan diterima' &&
        statusStr.toLowerCase() !== 'diterima'
      ) {
        cols.push(statusStr);
      }
    });

    return cols;
  }, [masterSteps, orders]);

  // Determine the next step tailored specifically to each order's pipeline
  const getNextStatusForOrder = useCallback((order: Transaksi): string | null => {
    const curStatus = (order.status || 'Diterima').trim().toLowerCase();

    if (Array.isArray(order.pipeline) && order.pipeline.length > 0) {
      // Physical processing steps in pipeline (e.g. Dicuci, Dikeringkan, Disetrika, Dilipat, Siap Diambil)
      const realSteps = order.pipeline.filter((p) => {
        const stepName = (p.namaStep || '').trim().toLowerCase();
        return stepName !== 'pesanan diterima' && stepName !== 'diterima';
      });

      // 1. If the order is newly received (Diterima / Pesanan Diterima)
      if (curStatus === 'diterima' || curStatus === 'pesanan diterima') {
        return realSteps.length > 0 ? realSteps[0].namaStep : (kanbanColumns[1] || 'Dicuci');
      }

      // 2. If it's already in one of the real steps
      const activeIdx = realSteps.findIndex(
        (p) => p.namaStep.toLowerCase() === curStatus || p.status === 'Aktif'
      );

      if (activeIdx >= 0 && activeIdx < realSteps.length - 1) {
        return realSteps[activeIdx + 1].namaStep;
      }
      if (activeIdx === realSteps.length - 1) {
        return 'Selesai';
      }
    }

    // Fallback based on kanbanColumns
    const curIdx = kanbanColumns.findIndex(c => c.toLowerCase() === curStatus);
    if (curIdx >= 0 && curIdx < kanbanColumns.length - 1) {
      return kanbanColumns[curIdx + 1];
    }
    if (curIdx === kanbanColumns.length - 1) {
      return 'Selesai';
    }

    if (curStatus === 'diterima' || curStatus === 'pesanan diterima') {
      return kanbanColumns.find(c => c.toLowerCase() !== 'diterima' && c.toLowerCase() !== 'pesanan diterima') || 'Dicuci';
    }

    return null;
  }, [kanbanColumns]);

  // Count summaries for quick tabs with daily re-chat check
  const summaryCounts = useMemo(() => {
    let siapCount = 0;
    let belumWaCount = 0;
    let diprosesCount = 0;
    const todayDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    orders.forEach(o => {
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

    return { siapCount, belumWaCount, diprosesCount, total: orders.length };
  }, [orders, waReminders]);

  const filteredOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const todayDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    return orders.filter((order) => {
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

  const renderCard = (order: Transaksi) => {
    const next = getNextStatusForOrder(order);
    const machine = activeMachine(order);
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

    return (
      <article key={order.noNota} className="glass-card card-hover-lift p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-slate-800 font-mono tracking-tight">{order.noNota}</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-slate-500">{order.namaPelanggan}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border shadow-2xs ${badgeWarna}`}>
            {orderPriority}
          </span>
        </div>

        <div className="space-y-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 font-medium"><Clock3 className="h-3.5 w-3.5 text-slate-400" /><span>{order.estimasiSelesai || order.estimasi || 'Estimasi -'}</span></div>
          {machine && <div className="flex items-center gap-1.5 font-bold text-teal-800"><WashingMachine className="h-3.5 w-3.5" /><span>Mesin {machine}</span></div>}
          <p className="line-clamp-2 text-slate-600 font-medium">{order.items.map((item) => `${item.layanan} ×${item.qty}`).join(', ')}</p>
          
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
                  const deductionPerUnit = Number(b.qty) || 1;
                  mats.push(`${inv?.nama || b.idInventory}: ${(Number(it.qty) || 1) * deductionPerUnit} ${inv?.satuan || 'unit'}`);
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
              onClick={(e) => handleSendSiapWA(order, e)}
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
              onClick={() => openProgress(order)}
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
                onClick={() => openProgress(order)}
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

      {loading ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
      ) : filteredOrders.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-dashed border-slate-300 p-16 text-center text-xs text-slate-500"><CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Tidak ada pesanan aktif pada filter ini.</div>
      ) : view === 'list' ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">{filteredOrders.map(renderCard)}</div>
      ) : (
        <div className="flex snap-x gap-3.5 overflow-x-auto pb-4">
          {kanbanColumns.map((status) => {
            const statusOrders = filteredOrders.filter((order) => {
              const curStatus = (order.status || 'Diterima').trim().toLowerCase();
              const colName = status.trim().toLowerCase();

              // 1. Column Diterima (Pesanan Baru Masuk)
              if (colName === 'diterima' || colName === 'pesanan diterima') {
                if (curStatus === 'diterima' || curStatus === 'pesanan diterima') {
                  return true;
                }
                const activeStep = order.pipeline?.find((p) => p.status === 'Aktif')?.namaStep?.trim().toLowerCase();
                if (activeStep === 'diterima' || activeStep === 'pesanan diterima') {
                  return true;
                }
                const hasStartedProcessing = order.pipeline?.some(
                  (p) => p.namaStep.toLowerCase() !== 'pesanan diterima' && p.namaStep.toLowerCase() !== 'diterima' && (p.status === 'Aktif' || p.status === 'Selesai')
                );
                return !hasStartedProcessing && curStatus !== 'selesai' && curStatus !== 'void' && curStatus !== 'batal';
              }

              // 2. Processing Columns (Dicuci, Dikeringkan, Disetrika, Dilipat, Siap Diambil, etc.)
              if (curStatus === colName && curStatus !== 'diterima') {
                return true;
              }

              const activeStep = order.pipeline?.find((p) => p.status === 'Aktif')?.namaStep?.trim().toLowerCase();
              if (activeStep === colName && curStatus !== 'diterima') {
                return true;
              }

              return false;
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
                    {availableMachines.map((machine) => <option key={machine.id} value={machine.id}>{machine.id} · {machine.nama}</option>)}
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
                        const deductionPerUnit = Number(b.qty) || 1;
                        const totalQty = (Number(it.qty) || 1) * deductionPerUnit;
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
    </div>
  );
}
