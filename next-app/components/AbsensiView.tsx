'use client';

import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, RefreshCw, UserCheck } from 'lucide-react';
import { runBackend } from '@/lib/api';
import { Pegawai } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

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

interface MasterShift {
  id: string;
  nama: string;
  jamMasuk: string;
  jamKeluar: string;
}

export default function AbsensiView() {
  const { showAlert } = useDialog();
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [shiftList, setShiftList] = useState<MasterShift[]>([]);
  const [namaPegawai, setNamaPegawai] = useState('');
  const [shift, setShift] = useState('Shift 1 (Pagi)');
  const [catatan, setCatatan] = useState('');
  const [loading, setLoading] = useState(false);
  const [rekap, setRekap] = useState<AbsensiRecord[]>([]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rekapRes, pegawaiRes, shiftRes] = await Promise.all([
        runBackend<AbsensiRecord[]>('getRekapAbsensi').catch(() => []),
        runBackend<Pegawai[]>('getPegawaiList').catch(() => []),
        runBackend<MasterShift[]>('getMasterShiftList').catch(() => [])
      ]);

      if (Array.isArray(rekapRes)) setRekap(rekapRes);
      if (Array.isArray(pegawaiRes) && pegawaiRes.length > 0) {
        const activeStaff = pegawaiRes.filter((s: any) => s.status !== 'Resign' && s.status !== 'Non-Aktif');
        setPegawaiList(activeStaff);
        if (activeStaff.length > 0) {
          setNamaPegawai(activeStaff[0].nama);
        }
      } else {
        setPegawaiList([
          { nama: 'Siti Rahma', jabatan: 'Kasir', role: 'STAFF' },
          { nama: 'Budi Santoso', jabatan: 'Operator Laundry', role: 'STAFF' }
        ]);
        setNamaPegawai('Siti Rahma');
      }

      if (Array.isArray(shiftRes) && shiftRes.length > 0) {
        setShiftList(shiftRes);
        setShift(shiftRes[0].nama);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleClockIn = async () => {
    if (!namaPegawai.trim()) { await showAlert('Pilih nama pegawai!', 'warning'); return; }
    setLoading(true);
    try {
      const res = await runBackend<{message: string}>('clockInPegawai', namaPegawai.trim(), shift, catatan.trim());
      await showAlert(res.message || 'Clock In Berhasil', 'success');
      setCatatan('');
      loadInitialData();
    } catch (err) {
      await showAlert('Gagal Clock In', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!namaPegawai.trim()) { await showAlert('Pilih nama pegawai!', 'warning'); return; }
    setLoading(true);
    try {
      const res = await runBackend<{message: string}>('clockOutPegawai', namaPegawai.trim(), catatan.trim());
      await showAlert(res.message || 'Clock Out Berhasil', 'success');
      setCatatan('');
      loadInitialData();
    } catch (err) {
      await showAlert('Gagal Clock Out', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Clock In / Out Box */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-600">
          <Clock className="w-4 h-4 text-[#1E4648]" />
          <span>Presensi Shift Pegawai</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Pilih Pegawai *</label>
            <select
              value={namaPegawai}
              onChange={(e) => setNamaPegawai(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white font-medium text-slate-600"
            >
              {pegawaiList.map((p, idx) => (
                <option key={idx} value={p.nama}>
                  {p.nama} {p.jabatan ? `(${p.jabatan})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Pilih Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white text-slate-600"
            >
              {shiftList.length > 0 ? (
                shiftList.map((s, idx) => (
                  <option key={idx} value={s.nama}>
                    {s.nama} ({s.jamMasuk} - {s.jamKeluar})
                  </option>
                ))
              ) : (
                <>
                  <option value="Shift 1 (Pagi)">Shift 1 (07.00 - 15.00)</option>
                  <option value="Shift 2 (Sore/Malam)">Shift 2 (15.00 - 23.00)</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Catatan (Opsional)</label>
            <input
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Keterangan shift..."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleClockIn}
            disabled={loading}
            className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-medium py-2 rounded-md text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <LogIn className="w-3.5 h-3.5" /> Clock In (Masuk)
          </button>
          <button
            onClick={handleClockOut}
            disabled={loading}
            className="flex-1 bg-[#FF9500] hover:bg-amber-700 text-white font-medium py-2 rounded-md text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" /> Clock Out (Pulang)
          </button>
        </div>
      </div>

      {/* Rekap Absensi Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden w-full">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <UserCheck className="w-4 h-4 text-[#1E4648]" />
            <span>Riwayat Absensi</span>
          </div>
          <button
            onClick={loadInitialData}
            className="p-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto w-full">
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
                rekap.map((r) => {
                  const isLate = r.catatan?.includes('[TERLAMBAT');
                  return (
                  <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${isLate ? 'bg-rose-50/50' : ''}`}>
                    <td className="py-3 px-4 text-slate-600 font-medium">{r.tanggal}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{r.namaPegawai}</td>
                    <td className="py-3 px-4 text-slate-600">{r.shift}</td>
                    <td className={`py-3 px-4 font-medium ${isLate ? 'text-rose-600' : 'text-[#1E4648]'}`}>{r.clockIn}</td>
                    <td className="py-3 px-4 text-[#FF9500] font-medium">{r.clockOut || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{r.durasi}</td>
                    <td className={`py-3 px-4 ${isLate ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>{r.catatan}</td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
