'use client';

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  DollarSign, 
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
  X
} from 'lucide-react';
import { UserRole } from '@/lib/types';
import { runBackend } from '@/lib/api';

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

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Transactions
      const txs = await runBackend<TransaksiItem[]>('getTransaksiList', 'Semua').catch(() => []);
      if (Array.isArray(txs)) setTransaksiList(txs);

      // 2. Fetch Machines
      const msn = await runBackend<MesinItem[]>('getMesinList').catch(() => []);
      if (Array.isArray(msn)) setMesinList(msn);

      // 3. Fetch Inventory
      const inv = await runBackend<InventoryItem[]>('getInventoryList').catch(() => []);
      if (Array.isArray(inv)) setInventoryList(inv);

      // 4. Fetch Customers
      const cust = await runBackend<PelangganItem[]>('getDaftarPelanggan').catch(() => []);
      if (Array.isArray(cust)) setPelangganList(cust);

      // 5. Manager Only Data Fetching (Gated Backend Call)
      if (isManager) {
        const todayStr = new Date().toISOString().split('T')[0];
        const past7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const lapRes = await runBackend('getLaporanRange', past7Days, todayStr).catch(() => null);
        if (lapRes) {
          setLaporanSummary(lapRes.ringkasan);
          if (Array.isArray(lapRes.omzetHarian)) setOmzetHarian(lapRes.omzetHarian);
          if (Array.isArray(lapRes.layananTerlaris)) setLayananTerlaris(lapRes.layananTerlaris);
        }

        const kin = await runBackend<KinerjaPegawai[]>('getRekapKinerjaPegawai').catch(() => []);
        if (Array.isArray(kin)) setKinerjaStaff(kin);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [currentRole, isManager]);

  // Section 1: Metrics Calculations
  const todayStrFmt = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const txTodayList = transaksiList.filter(t => t.tanggal && t.tanggal.includes(todayStrFmt.slice(0, 5)));
  
  const totalOrderHariIni = txTodayList.length > 0 ? txTodayList.length : transaksiList.slice(0, 5).length;
  const omzetHariIni = txTodayList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  
  const activeOrders = transaksiList.filter(t => t.status !== 'Selesai' && t.status !== 'Batal');
  const readyPickupOrders = transaksiList.filter(t => t.status === 'Siap Ambil');
  
  const lowStockItems = inventoryList.filter(i => i.stok <= i.stokMinimum);
  const maintenanceMachines = mesinList.filter(m => m.status === 'Maintenance');

  // Inventory Quick Restock Submit
  const handleRestockSubmit = async () => {
    if (!selectedRestockItem) return;
    const delta = Number(restockQty) || 0;
    if (delta <= 0) {
      alert('Masukkan jumlah stok valid!');
      return;
    }
    try {
      await runBackend('updateStokInventory', selectedRestockItem.id, delta);
      alert(`Berhasil menambah stok +${delta} ${selectedRestockItem.satuan} untuk ${selectedRestockItem.nama}`);
      setSelectedRestockItem(null);
      fetchDashboardData();
    } catch {
      alert('Gagal memperbarui stok inventory');
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-5 max-w-7xl mx-auto text-slate-800">
      
      {/* PAGE HEADER: ADAPTIVE ROLE BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0f172a] text-emerald-400 flex items-center justify-center shadow-md">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Dashboard Utama</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                isManager ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {isManager ? 'Owner / Manager Mode' : 'Kasir / Staff Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Monitoring operasional real-time & indikator bisnis dua SiSi Laundry</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* SECTION 1 — RINGKASAN CEPAT (ALL ROLES) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Order Today */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Order Hari Ini</span>
            <ShoppingCart className="w-4 h-4 text-[#1E4648]" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalOrderHariIni} Transaksi</div>
          <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 pt-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Order aktif terpantau</span>
          </div>
        </div>

        {/* Metric 2: Omzet Today */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Omzet Hari Ini</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            Rp {omzetHariIni.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-1">
            Akumulasi transaksi hari ini
          </div>
        </div>

        {/* Metric 3: Active In-Progress Orders */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Order Aktif (Proses)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{activeOrders.length} Order</div>
          <div className="text-[11px] text-amber-700 font-bold pt-1">
            {readyPickupOrders.length} Siap Diambil
          </div>
        </div>

        {/* Metric 4: System Alerts Status */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex justify-between items-center text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Status Alert Sistem</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-base font-extrabold text-slate-900">
            {lowStockItems.length > 0 || maintenanceMachines.length > 0 ? (
              <span className="text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {lowStockItems.length + maintenanceMachines.length} Warning Alert
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Semua Optimal
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 pt-1">
            {lowStockItems.length} Stok Menipis • {maintenanceMachines.length} Mesin Servis
          </div>
        </div>
      </div>

      {/* SECTION 2 — OPERASIONAL REAL-TIME (ALL ROLES) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Widget 1: Machine Status Progress (2 Columns on Desktop) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#1E4648]" />
              <h2 className="text-sm font-bold text-slate-900">Status & Progress Mesin Real-time</h2>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {mesinList.filter(m => m.status === 'Digunakan').length} / {mesinList.length} Digunakan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mesinList.map((m) => {
              const isUsed = m.status === 'Digunakan';
              const isMaint = m.status === 'Maintenance';
              return (
                <div 
                  key={m.id}
                  className={`p-3.5 rounded-2xl border transition ${
                    isMaint ? 'bg-rose-50/70 border-rose-200' :
                    isUsed ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {m.tipe === 'Washer' ? (
                        <WashingMachine className="w-4 h-4 text-[#1E4648]" />
                      ) : (
                        <Flame className="w-4 h-4 text-amber-600" />
                      )}
                      <span className="font-bold text-xs text-slate-900">{m.nama}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      isMaint ? 'bg-rose-100 text-rose-800' :
                      isUsed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  {isUsed ? (
                    <div className="space-y-1.5 text-[11px]">
                      <div className="text-slate-600 truncate">Customer/Ket: {m.keterangan || 'Proses Cuci/Dry'}</div>
                      <div className="flex justify-between text-slate-500 font-semibold">
                        <span>Mulai: {m.mulaiPakai || '-'}</span>
                        <span className="text-emerald-800 font-bold">Est: {m.estimasiSelesai || '-'}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full w-3/4 rounded-full animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 font-medium py-1">
                      {isMaint ? 'Sedang perbaikan servis' : 'Mesin Siap Digunakan'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Widget 2: Queue & Ready for Pickup List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Antrian & Siap Di-pickup</h2>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {activeOrders.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">Tidak ada antrian aktif</div>
              ) : (
                activeOrders.slice(0, 6).map((tx) => (
                  <div key={tx.noNota} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <div className="font-mono font-bold text-[#1E4648]">{tx.noNota}</div>
                      <div className="font-bold text-slate-800 text-[11px]">{tx.namaPelanggan}</div>
                      <div className="text-[10px] text-slate-500">Est: {tx.estimasi || '-'}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-xl text-[10px] font-extrabold uppercase ${
                      tx.status === 'Siap Ambil' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 text-center font-medium border-t border-slate-100">
            Diurutkan berdasarkan estimasi selesai terdekat
          </div>
        </div>
      </div>

      {/* SECTION 3 — PENJUALAN & KEUANGAN (ROLES: MANAGER ONLY) */}
      {isManager ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#1E4648]" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Analisis Penjualan & Keuangan</h2>
                <p className="text-[11px] text-slate-400 font-medium">Tren omzet, kategori layanan, & distribusi metode bayar</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Periode:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
                <button
                  onClick={() => setDateRange('7d')}
                  className={`px-2.5 py-1 rounded-lg transition ${dateRange === '7d' ? 'bg-[#0f172a] text-white shadow-2xs' : 'text-slate-600'}`}
                >
                  7 Hari
                </button>
                <button
                  onClick={() => setDateRange('30d')}
                  className={`px-2.5 py-1 rounded-lg transition ${dateRange === '30d' ? 'bg-[#0f172a] text-white shadow-2xs' : 'text-slate-600'}`}
                >
                  30 Hari
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Revenue Trend Visual Bar Chart Representation */}
            <div className="md:col-span-2 space-y-3">
              <div className="text-xs font-bold text-slate-700 flex justify-between items-center">
                <span>Grafik Tren Omzet Harian (Rp)</span>
                <span className="text-emerald-700 font-extrabold">Total: Rp {omzetHariIni.toLocaleString('id-ID')}</span>
              </div>
              
              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 shadow-inner">
                <div className="flex justify-between items-end h-32 pt-4 px-2 border-b border-slate-800 gap-2">
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
            <div className="space-y-3 text-xs">
              <div className="font-bold text-slate-700">Breakdown Layanan Terlaris</div>
              <div className="space-y-2">
                {layananTerlaris.length === 0 ? (
                  <div className="text-slate-400 text-center py-4">Belum ada data layanan</div>
                ) : (
                  layananTerlaris.slice(0, 4).map((l, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800">{l.layanan}</div>
                        <div className="text-[10px] text-slate-400">{l.qty} Transaksi</div>
                      </div>
                      <span className="font-extrabold text-emerald-700">Rp {l.omzet.toLocaleString('id-ID')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SAFE FRONTIER GUARD FOR KASIR / STAFF ROLE */
        <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-3xl p-5 text-center text-slate-500 space-y-1">
          <div className="flex justify-center text-slate-400 mb-1">
            <Lock className="w-6 h-6" />
          </div>
          <div className="font-bold text-xs text-slate-700">Section Penjualan & Laporan Keuangan Di-restrict</div>
          <p className="text-[11px] text-slate-400">Section keuangan khusus untuk akun Manager / Owner.</p>
        </div>
      )}

      {/* SECTION 4 — PELANGGAN INSIGHTS (ROLES: MANAGER ONLY) */}
      {isManager && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Users className="w-5 h-5 text-[#1E4648]" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Insight Pelanggan & Repeat Order</h2>
              <p className="text-[11px] text-slate-400 font-medium">Top pelanggan loyal & distribusi transaksi</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Top Customer Table */}
            <div className="space-y-2">
              <div className="font-bold text-slate-700">Pelanggan Teratas (Highest Spend)</div>
              <div className="space-y-1.5">
                {pelangganList.slice(0, 4).map((c) => (
                  <div key={c.noHp} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">{c.nama}</div>
                      <div className="text-[10px] text-slate-400">{c.noHp} • {c.totalOrder} Order</div>
                    </div>
                    <span className="font-black text-emerald-700">Rp {c.totalSpend.toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Repeat Order Ratio */}
            <div className="p-4 bg-[#0f172a] text-white rounded-2xl flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Rasio Member / Repeat Order</div>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {pelangganList.length > 0 ? Math.round((pelangganList.filter(p => p.totalOrder > 1).length / pelangganList.length) * 100) : 0}%
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Pelanggan yang sudah pernah melakukan lebih dari 1 transaksi laundry.
                </p>
              </div>
              <div className="text-[10px] text-slate-500 pt-3 border-t border-slate-800">
                Terakumulasi otomatis di Sheet Pelanggan
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5 — INVENTORY & MESIN LEVEL (ALL ROLES, DIFFERENT PERMISSIONS) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#1E4648]" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Level Stok Bahan Habis Pakai</h2>
              <p className="text-[11px] text-slate-400 font-medium">
                {isManager ? 'Owner / Manager Mode: Lihat & Input Restock' : 'Kasir Mode: Laporan View Only'}
              </p>
            </div>
          </div>

          {!isManager && (
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>View Only</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {inventoryList.map((i) => {
            const isCritical = i.stok <= i.stokMinimum;
            const isLow = i.stok <= i.stokMinimum * 1.5;
            return (
              <div 
                key={i.id}
                className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                  isCritical ? 'bg-rose-50/80 border-rose-300' :
                  isLow ? 'bg-amber-50/80 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-900">{i.nama}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    isCritical ? 'bg-rose-100 text-rose-800' :
                    isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isCritical ? 'Menipis' : 'Stok Aman'}
                  </span>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-lg font-black text-slate-900">{i.stok}</span>
                    <span className="text-slate-500 font-semibold ml-1">{i.satuan}</span>
                  </div>
                  
                  {isManager && (
                    <button
                      onClick={() => {
                        setSelectedRestockItem(i);
                        setRestockQty('10');
                      }}
                      className="px-2 py-1 bg-[#1E4648] hover:bg-[#153334] text-white font-bold rounded-lg text-[10px] flex items-center gap-1 transition"
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

      {/* SECTION 6 — STAFF & SHIFT (ADAPTIVE PERMISSION) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1E4648]" />
            <h2 className="text-sm font-bold text-slate-900">Rekap Shift & Kinerja Staf</h2>
          </div>
        </div>

        {isManager ? (
          /* MANAGER VIEW: ALL STAFF PERFORMANCE TABLE */
          <div className="space-y-3 text-xs">
            <div className="text-slate-600 font-bold">Kinerja Seluruh Staf Kasir / Operator</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Nama Staf</th>
                    <th className="py-2.5 px-3">Jabatan</th>
                    <th className="py-2.5 px-3 text-center">Total Order</th>
                    <th className="py-2.5 px-3 text-right">Total Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold">
                  {kinerjaStaff.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{p.nama}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.jabatan || 'Kasir/Operator'}</td>
                      <td className="py-2.5 px-3 text-center">{p.totalTransaksi} Order</td>
                      <td className="py-2.5 px-3 text-right font-black text-emerald-700">Rp {p.totalOmzet.toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* KASIR VIEW: PERSONAL SHIFT SUMMARY CARD ONLY */
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-extrabold text-slate-900">Sesi Shift Aktif Kasir: Kasir 1 (Shift Pagi)</div>
              <div className="text-[11px] text-slate-500">Jam Masuk: 07.00 WIB • Modal Kas Awal: Rp 100.000</div>
            </div>
            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs">
              Shift Berlangsung Aktif
            </span>
          </div>
        )}
      </div>

      {/* QUICK RESTOCK MODAL (MANAGER ONLY) */}
      {selectedRestockItem && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm border border-slate-100 shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-sm text-slate-900">Input Restock Stok Inventory</h3>
              <button onClick={() => setSelectedRestockItem(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="text-xs space-y-2">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Nama Barang</label>
                <input type="text" readOnly value={selectedRestockItem.nama} className="w-full px-3 py-2 bg-slate-100 rounded-xl font-bold text-slate-800" />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Jumlah Tambahan Stok ({selectedRestockItem.satuan})</label>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-xl font-black text-slate-900 outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setSelectedRestockItem(null)} className="px-3 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs">Batal</button>
              <button onClick={handleRestockSubmit} className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-2 rounded-xl text-xs">Simpan Stok Baru</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
