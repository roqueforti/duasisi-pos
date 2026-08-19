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
} from 'lucide-react';
import { Mesin, Transaksi } from '@/lib/types';
import { runBackend } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { DropOffPriorityItem } from './ProdukView';

const workflow = ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil', 'Selesai'] as const;
type DropoffStatus = (typeof workflow)[number];

function getWorkflowIcon(status: string) {
  const s = (status || '').toLowerCase();
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

function nextStatus(status: string): DropoffStatus | null {
  const index = workflow.indexOf(status as DropoffStatus);
  return index >= 0 && index < workflow.length - 1 ? workflow[index + 1] : null;
}

function activeMachine(order: Transaksi) {
  const active = order.pipeline?.find((step) => step.status === 'Aktif');
  return active?.mesinId || active?.washerId || active?.dryerId || '';
}

export default function PesananView() {
  const [orders, setOrders] = useState<Transaksi[]>([]);
  const [machines, setMachines] = useState<Mesin[]>([]);
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [dropOffPriorities, setDropOffPriorities] = useState<DropOffPriorityItem[]>([
    { id: 'p1', nama: 'Reguler', durasiJam: 48, icon: 'Clock', warna: 'bg-teal-100 text-teal-800 border-teal-300', aktif: true },
    { id: 'p2', nama: 'Express', durasiJam: 24, icon: 'Flame', warna: 'bg-amber-100 text-amber-800 border-amber-300', aktif: true },
    { id: 'p3', nama: 'Kilat', durasiJam: 6, icon: 'Zap', warna: 'bg-rose-100 text-rose-800 border-rose-300', aktif: true }
  ]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<string>('Semua');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [selected, setSelected] = useState<Transaksi | null>(null);
  const [machineId, setMachineId] = useState('');
  const [staffName, setStaffName] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, machineData, staffData, priorityData] = await Promise.all([
        runBackend<Transaksi[]>('getTransaksiByPipeline', 'Semua'),
        runBackend<Mesin[]>('getMesinList'),
        runBackend<StaffItem[]>('getPegawaiList'),
        runBackend<DropOffPriorityItem[]>('getPriorityConfig').catch(() => null),
      ]);
      setOrders(Array.isArray(orderData) ? orderData : []);
      setMachines(Array.isArray(machineData) ? machineData : []);
      if (Array.isArray(priorityData) && priorityData.length > 0) {
        setDropOffPriorities(priorityData);
      }
      
      const activeStaff = Array.isArray(staffData) ? staffData.filter((s: any) => s.status !== 'Resign' && s.status !== 'Non-Aktif') : [];
      setStaff(activeStaff);
      if (activeStaff?.[0]?.nama) setStaffName((current) => current || activeStaff[0].nama);
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

  const filteredOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return orders.filter((order) => {
      const orderPriority = order.tingkatLayanan || 'Reguler';
      const priorityMatch = priority === 'Semua' || orderPriority.toLowerCase() === priority.toLowerCase();
      const searchMatch = !keyword
        || order.noNota.toLowerCase().includes(keyword)
        || order.namaPelanggan.toLowerCase().includes(keyword)
        || (order.noHp || '').includes(keyword);
      return priorityMatch && searchMatch;
    });
  }, [orders, priority, query]);

  const targetStatus = selected ? nextStatus(selected.status) : null;
  const availableMachines = machines.filter((machine) => {
    if (machine.status !== 'Kosong') return false;
    if (targetStatus === 'Dicuci') return machine.tipe === 'Washer';
    if (targetStatus === 'Dikeringkan') return machine.tipe === 'Dryer';
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
    if ((targetStatus === 'Dicuci' || targetStatus === 'Dikeringkan') && !machineId) {
      setError(`Pilih ${targetStatus === 'Dicuci' ? 'washer' : 'dryer'} yang kosong.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await runBackend<{ success: boolean; message?: string }>('updateDropoffStatus', {
        noNota: selected.noNota,
        status: targetStatus,
        washerId: targetStatus === 'Dicuci' ? machineId : '',
        dryerId: targetStatus === 'Dikeringkan' ? machineId : '',
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
    const next = nextStatus(order.status);
    const machine = activeMachine(order);
    const orderPriority = order.tingkatLayanan || 'Reguler';
    const priConfig = dropOffPriorities.find((p) => p.nama.toLowerCase() === orderPriority.toLowerCase());
    const badgeWarna = priConfig?.warna || (
      orderPriority.toLowerCase().includes('kilat') ? 'bg-rose-100 text-rose-700 border-rose-300' :
      orderPriority.toLowerCase().includes('express') ? 'bg-amber-100 text-amber-800 border-amber-300' :
      'bg-teal-100 text-teal-800 border-teal-300'
    );

    return (
      <article key={order.noNota} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold text-slate-700">{order.noNota}</p>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{order.namaPelanggan}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold border ${badgeWarna}`}>
            {orderPriority}
          </span>
        </div>

        <div className="mt-3 space-y-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /><span>{order.estimasiSelesai || 'Estimasi belum diisi'}</span></div>
          {machine && <div className="flex items-center gap-1.5 font-semibold text-[#1E4648]"><WashingMachine className="h-3.5 w-3.5" /><span>Mesin {machine}</span></div>}
          <p className="line-clamp-2">{order.items.map((item) => `${item.layanan} ×${item.qty}`).join(', ')}</p>
        </div>

        {next && (() => {
          const NextIcon = getWorkflowIcon(next);
          return (
            <button
              onClick={() => openProgress(order)}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-[#1E4648] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#163536] shadow-2xs"
            >
              <div className="flex items-center gap-1.5">
                <NextIcon className="w-3.5 h-3.5 text-teal-200" />
                <span>Lanjut ke {next}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          );
        })()}
      </article>
    );
  };

  return (
    <div className="w-full space-y-3 p-3 sm:p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-700">Manajemen Pesanan Drop-off</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">Pengerjaan fisik, staf, washer, dan dryer. Data keuangan tetap di Riwayat Transaksi.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('kanban')} className={`rounded-lg border p-2 ${view === 'kanban' ? 'border-[#1E4648] bg-[#1E4648] text-white' : 'border-slate-200 text-slate-500'}`} title="Kanban"><Columns3 className="h-4 w-4" /></button>
            <button onClick={() => setView('list')} className={`rounded-lg border p-2 ${view === 'list' ? 'border-[#1E4648] bg-[#1E4648] text-white' : 'border-slate-200 text-slate-500'}`} title="List"><List className="h-4 w-4" /></button>
            <button onClick={loadData} disabled={loading} className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-50" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nota, pelanggan, atau no. HP..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#1E4648]" />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {['Semua', ...dropOffPriorities.filter(p => p.aktif !== false).map(p => p.nama)].map((item) => (
              <button
                key={item}
                onClick={() => setPriority(item)}
                className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-bold transition ${
                  priority.toLowerCase() === item.toLowerCase()
                    ? 'border-[#1E4648] bg-[#1E4648] text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && !selected && <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"><AlertCircle className="h-4 w-4" />{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center text-xs text-slate-500"><CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />Tidak ada pesanan aktif pada filter ini.</div>
      ) : view === 'list' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredOrders.map(renderCard)}</div>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-3">
          {workflow.slice(0, -1).map((status) => {
            const statusOrders = filteredOrders.filter((order) => order.status === status);
            const StatusIcon = getWorkflowIcon(status);
            return (
              <section key={status} className="w-[86vw] max-w-[320px] shrink-0 snap-start rounded-2xl bg-slate-100/80 p-3 sm:w-[300px] border border-slate-200/80 shadow-2xs">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className="w-4 h-4 text-[#1E4648]" />
                    <h3 className="text-xs font-extrabold text-slate-700">{status}</h3>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-2xs">{statusOrders.length}</span>
                </div>
                <div className="space-y-2.5">{statusOrders.length ? statusOrders.map(renderCard) : <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-5 text-center text-[11px] text-slate-400">Antrean kosong</div>}</div>
              </section>
            );
          })}
        </div>
      )}

      {selected && targetStatus && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div><h3 className="text-sm font-extrabold text-slate-700">Lanjut ke {targetStatus}</h3><p className="mt-0.5 text-[11px] text-slate-500">{selected.noNota} · {selected.namaPelanggan}</p></div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 space-y-3">
              <div><label className="mb-1 block text-xs font-bold text-slate-700">Staf Memproses</label><select value={staffName} onChange={(event) => setStaffName(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#1E4648]">{staff.map((item) => <option key={item.id} value={item.nama}>{item.nama}{item.jabatan ? ` (${item.jabatan})` : ''}</option>)}</select></div>

              {(targetStatus === 'Dicuci' || targetStatus === 'Dikeringkan') && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">{targetStatus === 'Dicuci' ? 'Washer' : 'Dryer'} *</label>
                  <select value={machineId} onChange={(event) => setMachineId(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#1E4648]">
                    <option value="">Pilih mesin kosong...</option>
                    {availableMachines.map((machine) => <option key={machine.id} value={machine.id}>{machine.id} · {machine.nama}</option>)}
                  </select>
                  {availableMachines.length === 0 && <p className="mt-1 text-[11px] font-semibold text-rose-600">Tidak ada mesin kosong untuk tahap ini.</p>}
                </div>
              )}

              <div><label className="mb-1 block text-xs font-bold text-slate-700">Catatan Proses</label><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Opsional: kondisi cucian atau instruksi proses" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#1E4648]" /></div>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{error}</p>}
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => setSelected(null)} disabled={submitting} className="rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600">Batal</button>
              <button onClick={handleProgress} disabled={submitting || ((targetStatus === 'Dicuci' || targetStatus === 'Dikeringkan') && !machineId)} className="flex-1 rounded-lg bg-[#1E4648] py-2.5 text-xs font-bold text-white disabled:opacity-50">{submitting ? 'Menyimpan...' : `Konfirmasi ${targetStatus}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
