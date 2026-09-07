'use client';

import React, { useState, useEffect } from 'react';
import { runBackend } from '@/lib/api';
import { UserRole } from '@/lib/types';
import { ShieldCheck, KeyRound, Save, Mail, CloudUpload, FileSpreadsheet, Database } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';
import BackupGasModal from '@/components/BackupGasModal';

export default function KeamananView({ currentRole }: { currentRole?: UserRole }) {
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState(false);
  
  // Manager PIN State
  const [oldManagerPin, setOldManagerPin] = useState('');
  const [newManagerPin, setNewManagerPin] = useState('');
  const [emailManager, setEmailManager] = useState('');
  
  // Staff PIN State
  const [newStaffPin, setNewStaffPin] = useState('');

  // Backup Modal State
  const [showBackupModal, setShowBackupModal] = useState(false);

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
    if (oldManagerPin.length < 4 || oldManagerPin.length > 6) {
      await showAlert('PIN Lama harus 4 atau 6 digit!', 'warning');
      return;
    }
    if (newManagerPin.length !== 6) {
      await showAlert('PIN Manager Baru harus tepat 6 digit!', 'warning');
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
        await showAlert('Pengaturan Keamanan PIN Manager (6 digit) berhasil disimpan!', 'success');
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
    if (newStaffPin.length !== 4 && newStaffPin.length !== 6) {
      await showAlert('PIN Staff harus 4 atau 6 digit angka!', 'warning');
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
          Manajemen Keamanan & PIN
        </h1>
        <p className="text-sm text-slate-500 mt-1">Kelola PIN akses terminal (Manager 6-digit & Staff) serta email pemulihan.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        
        {/* Manager PIN Box */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
            <KeyRound className="w-5 h-5 text-rose-500" />
            Pengaturan Keamanan Manager (6 Digit)
          </h3>
          <p className="text-[11px] text-slate-400">PIN 6-digit untuk mengakses menu manajemen, rekap, payroll, dan pemulihan jika lupa PIN.</p>
          
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
            <label className="block text-xs font-bold text-slate-600 mb-1">PIN Lama (4 - 6 digit)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={oldManagerPin}
              onChange={e => setOldManagerPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="• • • • • •"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 text-center tracking-[8px] font-bold"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">PIN Manager Baru (Wajib 6 Digit)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newManagerPin}
              onChange={e => setNewManagerPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="• • • • • •"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 text-center tracking-[8px] font-bold"
            />
          </div>

          <button
            onClick={handleChangeManagerPin}
            disabled={loading || oldManagerPin.length < 4 || newManagerPin.length !== 6 || !emailManager}
            className="w-full mt-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan PIN Manager (6 Digit)
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
            <label className="block text-xs font-bold text-slate-600 mb-1">PIN Staff Baru (4 atau 6 digit)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newStaffPin}
              onChange={e => setNewStaffPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="• • • •"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]/20 text-center tracking-[8px] font-bold"
            />
          </div>

          <button
            onClick={handleChangeStaffPin}
            disabled={loading || (newStaffPin.length !== 4 && newStaffPin.length !== 6)}
            className="w-full mt-2 bg-[#1E4648]/10 text-[#1E4648] hover:bg-[#1E4648]/20 font-bold py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Update PIN Staff
          </button>
        </div>

        {/* Cloud-to-Cloud Backup Card (Google Apps Script / Sheets) */}
        <div className="lg:col-span-2 bg-gradient-to-br from-white to-teal-50/40 rounded-xl shadow-sm border border-teal-200/90 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                <CloudUpload className="w-5 h-5 text-[#1E4648]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span>Sinkronisasi &amp; Cadangan Google Apps Script</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase">
                    Cloud Safety Net
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sinkronkan seluruh data transaksi dan pelanggan dari database Supabase ke Google Sheets secara on-demand.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowBackupModal(true)}
              className="tactile-btn px-4 py-2 bg-gradient-to-r from-[#1E4648] to-teal-800 hover:from-teal-900 hover:to-[#1E4648] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer shrink-0 border border-teal-700/50"
            >
              <CloudUpload className="w-4 h-4 text-amber-300" />
              <span>Backup Data Sekarang</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold">Tujuan Sinkronisasi</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Google Sheets POS
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold">Jadwal Otomatis</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Tiap 02:00 WIB (GitHub Actions)
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 block font-semibold">Metode Proteksi</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                Idempotent (Anti-Duplikasi)
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Modal Backup */}
      <BackupGasModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
      />
    </div>
  );
}
