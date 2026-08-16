'use client';

import React, { useState, useEffect } from 'react';
import { runBackend } from '@/lib/api';
import { UserRole } from '@/lib/types';
import { ShieldCheck, KeyRound, Save, Mail } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

export default function KeamananView({ currentRole }: { currentRole?: UserRole }) {
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(false);
  
  // Manager PIN State
  const [oldManagerPin, setOldManagerPin] = useState('');
  const [newManagerPin, setNewManagerPin] = useState('');
  const [emailManager, setEmailManager] = useState('');
  
  // Staff PIN State
  const [newStaffPin, setNewStaffPin] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await runBackend<{emailManager: string}>('getSecuritySettings');
      if (res && res.emailManager) {
        setEmailManager(res.emailManager);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeManagerPin = async () => {
    if (oldManagerPin.length !== 4 || newManagerPin.length !== 4) {
      await showAlert('PIN harus tepat 4 digit!', 'warning');
      return;
    }
    if (isNaN(Number(oldManagerPin)) || isNaN(Number(newManagerPin))) {
      await showAlert('PIN hanya boleh berisi angka!', 'warning');
      return;
    }
    if (!emailManager || !emailManager.includes('@')) {
      await showAlert('Email pemulihan tidak valid!', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const res = await runBackend<{success: boolean, message: string}>('saveSecuritySettings', 'MANAGER', oldManagerPin, newManagerPin, emailManager);
      if (res && res.success) {
        await showAlert('Pengaturan Keamanan Manager berhasil diubah!', 'success');
        setOldManagerPin('');
        setNewManagerPin('');
      } else {
        await showAlert(res?.message || 'Gagal mengubah pengaturan Manager.', 'error');
      }
    } catch (err: any) {
      await showAlert('Terjadi kesalahan: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStaffPin = async () => {
    if (newStaffPin.length !== 4) {
      await showAlert('PIN harus tepat 4 digit!', 'warning');
      return;
    }
    if (isNaN(Number(newStaffPin))) {
      await showAlert('PIN hanya boleh berisi angka!', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await runBackend<{success: boolean, message: string}>('saveSecuritySettings', 'STAFF', '', newStaffPin);
      if (res && res.success) {
        await showAlert('PIN Staff berhasil diubah!', 'success');
        setNewStaffPin('');
      } else {
        await showAlert(res?.message || 'Gagal mengubah PIN Staff.', 'error');
      }
    } catch (err: any) {
      await showAlert('Terjadi kesalahan: ' + err.message, 'error');
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
        <p className="text-sm text-slate-500 mt-1">Kelola PIN akses dan pengaturan pemulihan (Lupa PIN).</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        
        {/* Manager PIN Box */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
            <KeyRound className="w-5 h-5 text-rose-500" />
            Pengaturan Keamanan Manager
          </h3>
          <p className="text-[11px] text-slate-400">PIN untuk mengakses menu manajemen, serta email untuk pemulihan jika lupa PIN.</p>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Email Pemulihan</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={emailManager}
                onChange={e => setEmailManager(e.target.value)}
                placeholder="email@contoh.com"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 font-medium"
              />
            </div>
          </div>

          <div className="pt-2">
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
            disabled={loading || oldManagerPin.length !== 4 || newManagerPin.length !== 4 || !emailManager}
            className="w-full mt-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan
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
