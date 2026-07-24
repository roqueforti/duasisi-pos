'use client';

import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, RefreshCw, Calendar, UserCheck } from 'lucide-react';
import { runBackend } from '@/lib/api';

interface AbsensiRecord {
  id: string;
  tanggal: string;
  namaPegawai: string;
  shift: string;
  clockIn: string;
  clockOut: string;
  durasi: string;
  catatan: string;
}

export default function AbsensiView() {
  const [namaPegawai, setNamaPegawai] = useState('');
  const [shift, setShift] = useState('Shift 1 (Pagi)');
  const [catatan, setCatatan] = useState('');
  const [loading, setLoading] = useState(false);
  const [rekap, setRekap] = useState<AbsensiRecord[]>([]);

  const loadAbsensi = async () => {
    setLoading(true);
    try {
      const data = await runBackend<AbsensiRecord[]>('getRekapAbsensi');
      if (Array.isArray(data)) setRekap(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAbsensi();
  }, []);

  const handleClockIn = async () => {
    if (!namaPegawai.trim()) { alert('Masukkan nama pegawai!'); return; }
    setLoading(true);
    try {
      const res = await runBackend('clockInPegawai', namaPegawai.trim(), shift, catatan.trim());
      alert(res.message || 'Clock In Berhasil');
      setCatatan('');
      loadAbsensi();
    } catch (err) {
      alert('Gagal Clock In');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!namaPegawai.trim()) { alert('Masukkan nama pegawai!'); return; }
    setLoading(true);
    try {
      const res = await runBackend('clockOutPegawai', namaPegawai.trim(), catatan.trim());
      alert(res.message || 'Clock Out Berhasil');
      setCatatan('');
      loadAbsensi();
    } catch (err) {
      alert('Gagal Clock Out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 space-y-5 max-w-5xl mx-auto">
      {/* Clock In / Out Box */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-800">
          <Clock className="w-4 h-4 text-[#1E4648]" />
          <span>Presensi Shift Pegawai</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nama Pegawai</label>
            <input
              type="text"
              value={namaPegawai}
              onChange={(e) => setNamaPegawai(e.target.value)}
              placeholder="Contoh: Siti Rahma"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Pilih Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white"
            >
              <option value="Shift 1 (Pagi)">Shift 1 (07.00 - 15.00)</option>
              <option value="Shift 2 (Sore/Malam)">Shift 2 (15.00 - 23.00)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Catatan (Opsional)</label>
            <input
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Keterangan..."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleClockIn}
            disabled={loading}
            className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-medium py-2 rounded-md text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <LogIn className="w-3.5 h-3.5" /> Clock In (Masuk)
          </button>
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 rounded-md text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" /> Clock Out (Pulang)
          </button>
        </div>
      </div>

      {/* Rekap Absensi Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <UserCheck className="w-4 h-4 text-[#1E4648]" />
            <span>Riwayat Absensi</span>
          </div>
          <button
            onClick={loadAbsensi}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Pegawai</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4">Durasi</th>
                <th className="py-3 px-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                  </tr>
                ))
              ) : rekap.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Belum ada data absensi
                  </td>
                </tr>
              ) : (
                rekap.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-medium">{r.tanggal}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{r.namaPegawai}</td>
                    <td className="py-3 px-4 text-slate-600">{r.shift}</td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">{r.clockIn}</td>
                    <td className="py-3 px-4 text-amber-700 font-medium">{r.clockOut || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{r.durasi}</td>
                    <td className="py-3 px-4 text-slate-500">{r.catatan}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
