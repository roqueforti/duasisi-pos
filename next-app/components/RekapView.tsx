'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, RefreshCw, TrendingUp, ShoppingBag, DollarSign, Award } from 'lucide-react';
import { runBackend } from '@/lib/api';

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
  transaksiList: Array<any>;
}

export default function RekapView() {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LaporanResponse | null>(null);

  const loadLaporan = async () => {
    setLoading(true);
    try {
      const res = await runBackend<LaporanResponse>('getLaporanRange', startDate, endDate);
      if (res && res.ringkasan) setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLaporan();
  }, []);

  const ringkasan = data?.ringkasan || { totalOmzet: 0, jumlahTransaksi: 0, rataRata: 0, selfCount: 0, fullCount: 0 };
  const omzetHarian = data?.omzetHarian || [];
  const layananTerlaris = data?.layananTerlaris || [];

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Header & Date Range Filter */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <BarChart3 className="w-4 h-4 text-[#1E4648]" />
          <span>Laporan Omzet & Analytics Penjualan</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs">
            <span className="text-slate-500">Dari:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent outline-none font-medium text-slate-800"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs">
            <span className="text-slate-500">Sampai:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent outline-none font-medium text-slate-800"
            />
          </div>

          <button
            onClick={loadLaporan}
            className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Tampilkan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 mb-1">Total Omzet Penjualan</div>
          <div className="text-lg font-bold text-[#1E4648]">
            Rp {ringkasan.totalOmzet.toLocaleString('id-ID')}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 mb-1">Jumlah Transaksi Nota</div>
          <div className="text-lg font-bold text-slate-800">
            {ringkasan.jumlahTransaksi} <span className="text-xs font-normal text-slate-400">nota</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 mb-1">Rata-rata Nota</div>
          <div className="text-lg font-bold text-slate-800">
            Rp {ringkasan.rataRata.toLocaleString('id-ID')}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-[11px] font-medium text-slate-500 mb-1">Self vs Full Service</div>
          <div className="text-sm font-bold text-slate-800 flex items-center gap-2 mt-1">
            <span className="text-teal-700">{ringkasan.selfCount} Self</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-700">{ringkasan.fullCount} Full</span>
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Omzet Harian */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-xs text-slate-800">
            Rincian Omzet Harian
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
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      Belum ada data transaksi pada rentang tanggal ini
                    </td>
                  </tr>
                ) : (
                  omzetHarian.map((o, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{o.tanggal}</td>
                      <td className="py-3 px-4 text-slate-600">{o.jumlahTransaksi} nota</td>
                      <td className="py-3 px-4 font-bold text-[#1E4648] text-right">
                        Rp {o.omzet.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Layanan Terlaris */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-xs text-slate-800">
            Layanan & Produk Terlaris
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Nama Layanan</th>
                  <th className="py-2.5 px-4">Total Terjual</th>
                  <th className="py-2.5 px-4 text-right">Total Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : layananTerlaris.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      Belum ada data penjualan layanan
                    </td>
                  </tr>
                ) : (
                  layananTerlaris.map((l, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{l.layanan}</td>
                      <td className="py-3 px-4 text-slate-600">{l.qty} item</td>
                      <td className="py-3 px-4 font-bold text-[#1E4648] text-right">
                        Rp {l.omzet.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
