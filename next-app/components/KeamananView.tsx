'use client';

import React, { useState } from 'react';
import { runBackend } from '@/lib/api';
import { UserRole } from '@/lib/types';
import { ShieldCheck, KeyRound, Save } from 'lucide-react';

export default function KeamananView({ currentRole }: { currentRole?: UserRole }) {
  const [loading, setLoading] = useState(false);
  
  // Manager PIN State
  const [oldManagerPin, setOldManagerPin] = useState('');
  const [newManagerPin, setNewManagerPin] = useState('');
  
  // Staff PIN State
  const [newStaffPin, setNewStaffPin] = useState('');

  const handleChangeManagerPin = async () => {
    if (oldManagerPin.length !== 4 || newManagerPin.length !== 4) {
      alert('PIN harus tepat 4 digit!');
      return;
    }
    if (isNaN(Number(oldManagerPin)) || isNaN(Number(newManagerPin))) {
      alert('PIN hanya boleh berisi angka!');
      return;
    }
    
    setLoading(true);
    try {
      const res = await runBackend<{success: boolean, message: string}>('changePin', 'MANAGER', oldManagerPin, newManagerPin);
      if (res && res.success) {
        alert('PIN Manager berhasil diubah!');
        setOldManagerPin('');
        setNewManagerPin('');
      } else {
        alert(res?.message || 'Gagal mengubah PIN Manager.');
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStaffPin = async () => {
    if (newStaffPin.length !== 4) {
      alert('PIN harus tepat 4 digit!');
      return;
    }
    if (isNaN(Number(newStaffPin))) {
      alert('PIN hanya boleh berisi angka!');
      return;
    }

    setLoading(true);
    try {
      const res = await runBackend<{success: boolean, message: string}>('changePin', 'STAFF', '', newStaffPin);
      if (res && res.success) {
        alert('PIN Staff berhasil diubah!');
        setNewStaffPin('');
      } else {
        alert(res?.message || 'Gagal mengubah PIN Staff.');
      }
    } catch (err: any) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (currentRole !== 'MANAGER') {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <p>Akses ditolak. Halaman ini hanya untuk Manager.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 lg:p-6 overflow-y-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#1E4648]" />
          Manajemen Keamanan
        </h1>
        <p className="text-sm text-slate-500 mt-1">Kelola PIN akses untuk Manager dan Staff (Kasir).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        
        {/* Manager PIN Box */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
            <KeyRound className="w-5 h-5 text-rose-500" />
            Ubah PIN Manager
          </h3>
          <p className="text-[11px] text-slate-400">Gunakan PIN ini untuk mengakses menu manajemen dan merestui void transaksi.</p>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">PIN Lama (4 digit)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={oldManagerPin}
              onChange={e => setOldManagerPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="• • • •"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 text-center tracking-[8px] font-bold"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">PIN Baru (4 digit)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newManagerPin}
              onChange={e => setNewManagerPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="• • • •"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 text-center tracking-[8px] font-bold"
            />
          </div>

          <button
            onClick={handleChangeManagerPin}
            disabled={loading || oldManagerPin.length !== 4 || newManagerPin.length !== 4}
            className="w-full mt-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Update PIN Manager
          </button>
        </div>

        {/* Staff PIN Box */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
            <KeyRound className="w-5 h-5 text-[#1E4648]" />
            Ubah PIN Staff
          </h3>
          <p className="text-[11px] text-slate-400">PIN untuk staf kasir login dan melakukan operasional sehari-hari.</p>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">PIN Baru (4 digit)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newStaffPin}
              onChange={e => setNewStaffPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="• • • •"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]/20 text-center tracking-[8px] font-bold"
            />
          </div>

          <button
            onClick={handleChangeStaffPin}
            disabled={loading || newStaffPin.length !== 4}
            className="w-full mt-2 bg-[#1E4648]/10 text-[#1E4648] hover:bg-[#1E4648]/20 font-bold py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Update PIN Staff
          </button>
        </div>

      </div>
    </div>
  );
}
