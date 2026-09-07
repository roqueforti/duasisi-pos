'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  CloudUpload, 
  FileSpreadsheet, 
  CheckCircle2, 
  RefreshCw, 
  Clock, 
  Database, 
  ShieldCheck, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Zap,
  Layers
} from 'lucide-react';
import { fetchBackupStatus, executeGasBackup, BackupLogInfo } from '@/lib/backupService';

interface BackupGasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BackupGasModal({ isOpen, onClose, onSuccess }: BackupGasModalProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingStatus, setFetchingStatus] = useState<boolean>(false);
  const [lastBackup, setLastBackup] = useState<BackupLogInfo | null>(null);
  const [supabaseStats, setSupabaseStats] = useState<{ totalTransaksi: number; totalPelanggan: number } | null>(null);
  const [progressStep, setProgressStep] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setResultMessage(null);
      setProgressStep('');
      setProgressPercent(0);
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setFetchingStatus(true);
    try {
      const res = await fetchBackupStatus();
      if (res.lastBackupInfo) {
        setLastBackup(res.lastBackupInfo);
      }
      if (res.supabaseStats) {
        setSupabaseStats(res.supabaseStats);
      }
    } catch (e) {
      console.warn('Gagal memuat status backup:', e);
    } finally {
      setFetchingStatus(false);
    }
  };

  const handleStartBackup = async () => {
    setLoading(true);
    setResultMessage(null);
    setProgressPercent(15);
    setProgressStep('Menghubungkan & memverifikasi PIN Manager ke Google Apps Script...');

    try {
      // Step simulator for smooth UX
      const timer1 = setTimeout(() => {
        setProgressPercent(40);
        setProgressStep('Memeriksa nota transaksi yang sudah ada di Google Sheets...');
      }, 800);

      const timer2 = setTimeout(() => {
        setProgressPercent(75);
        setProgressStep('Mengunggah transaksi & pelanggan baru ke spreadsheet...');
      }, 2000);

      const res = await executeGasBackup('Manager Outlet');

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (res.success) {
        setProgressPercent(100);
        setProgressStep('Pencadangan data ke Google Apps Script selesai!');
        setResultMessage({
          type: 'success',
          text: res.message || 'Data Supabase berhasil dicadangkan ke Google Sheets!',
        });
        if (res.data) {
          setLastBackup(res.data);
        }
        if (onSuccess) onSuccess();
      } else {
        setResultMessage({
          type: 'error',
          text: res.message || 'Gagal melakukan backup ke Google Apps Script.',
        });
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err?.message || 'Terjadi gangguan koneksi internet saat backup.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Belum ada riwayat backup';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white border border-slate-200/90 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-pop-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-[#1E4648] via-teal-900 to-[#1E4648] p-5 text-white flex items-center justify-between border-b border-teal-800/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-teal-200 shadow-xs">
              <CloudUpload className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Backup Data ke Google Apps Script
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-900 uppercase tracking-wide">
                  Khusus Manajer
                </span>
              </div>
              <p className="text-xs text-teal-100/80 mt-0.5">
                Sinkronisasi Cloud-to-Cloud (Supabase → Google Sheets)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl hover:bg-white/10 text-teal-200 hover:text-white transition disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Status & Info Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="font-semibold text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-700" />
                  Backup Terakhir
                </span>
                <button 
                  onClick={loadStatus} 
                  disabled={fetchingStatus}
                  className="hover:text-teal-800 transition p-0.5"
                  title="Segarkan info"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingStatus ? 'animate-spin text-teal-700' : ''}`} />
                </button>
              </div>
              <div className="text-xs font-bold text-slate-800">
                {formatDate(lastBackup?.timestamp)}
              </div>
              {lastBackup && (
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-2">
                  <span>Oleh: <b>{lastBackup.actor || 'Manager'}</b></span>
                  <span>•</span>
                  <span>Durasi: <b>{lastBackup.durationSeconds}s</b></span>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between">
              <span className="font-semibold text-[11px] text-slate-500 flex items-center gap-1.5 mb-1">
                <Database className="w-3.5 h-3.5 text-teal-700" />
                Data Aktif Supabase
              </span>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block font-normal">Transaksi</span>
                  <span className="text-sm font-black text-teal-900">
                    {supabaseStats ? supabaseStats.totalTransaksi : '...'}
                  </span>
                </div>
                <div className="border-l border-slate-200 pl-4">
                  <span className="text-[10px] text-slate-400 block font-normal">Pelanggan</span>
                  <span className="text-sm font-black text-teal-900">
                    {supabaseStats ? supabaseStats.totalPelanggan : '...'}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-emerald-700 mt-1 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Siap disinkronkan ke Google Sheets</span>
              </div>
            </div>
          </div>

          {/* Cakupan Data yang Dicadangkan */}
          <div className="bg-teal-50/50 border border-teal-200/80 rounded-2xl p-3.5 space-y-2">
            <h4 className="font-bold text-teal-950 flex items-center gap-1.5 text-xs">
              <FileSpreadsheet className="w-4 h-4 text-[#1E4648]" />
              Target & Cakupan Data Cadangan
            </h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Pencadangan ini mengirimkan data dari database utama <b>Supabase</b> ke spreadsheet <b>Google Sheets</b> melalui Webhook API <b>Google Apps Script</b> resmi:
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Transaksi & Nomor Nota</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Rincian Item / Layanan</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Master Data Pelanggan</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Proteksi Anti-Duplikasi Otomatis</span>
              </div>
            </div>
          </div>

          {/* Progress Bar & Status (Saat Proses Berjalan) */}
          {loading && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-700" />
                  Memproses Cadangan Data...
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-[#1E4648] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-amber-800 font-medium">
                {progressStep}
              </p>
            </div>
          )}

          {/* Result Alert */}
          {resultMessage && !loading && (
            <div className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
              resultMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {resultMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs">
                <h5 className="font-bold">
                  {resultMessage.type === 'success' ? 'Pencadangan Berhasil' : 'Pencadangan Gagal'}
                </h5>
                <p className="text-[11px] mt-0.5 leading-snug">{resultMessage.text}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[10px] text-slate-400 hidden sm:flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
            <span>Aman & idempotent (tidak menduplikasi nota yang sudah ada)</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition disabled:opacity-50 cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleStartBackup}
              disabled={loading}
              className="tactile-btn px-4 py-2 bg-gradient-to-r from-[#1E4648] to-teal-800 hover:from-teal-900 hover:to-[#1E4648] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition disabled:opacity-50 cursor-pointer border border-teal-700/60"
            >
              <CloudUpload className={`w-4 h-4 text-amber-300 ${loading ? 'animate-bounce' : ''}`} />
              <span>{loading ? 'Menyinkronkan...' : 'Cadangkan Sekarang'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
