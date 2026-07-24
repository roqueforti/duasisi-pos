'use client';

import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Wifi, WifiOff, RefreshCw, Download } from 'lucide-react';
import { UserRole } from '@/lib/types';
import { getPendingOutbox, syncOutboxToServer } from '@/lib/syncEngine';

interface NavbarProps {
  currentTab: string;
  currentRole: UserRole;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

const tabTitles: Record<string, string> = {
  transaksi: 'Point of Sale (POS)',
  riwayat: 'Riwayat Transaksi',
  absensi: 'Absensi Shift Presensi',
  inventory: 'Inventory Stok Bahan',
  mesin: 'Status Mesin Cuci & Dryer',
  pegawai: 'Pegawai & Kinerja',
  produk: 'Produk & Layanan',
  rekap: 'Laporan Omzet & Analytics',
};

export default function Navbar({
  currentTab,
  currentRole,
  onToggleSidebar,
  onLogout,
}: NavbarProps) {
  const [clockStr, setClockStr] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const checkSyncState = async () => {
    const queue = getPendingOutbox();
    setPendingCount(queue.length);
    if (navigator.onLine && queue.length > 0 && !isSyncing) {
      setIsSyncing(true);
      const res = await syncOutboxToServer();
      setIsSyncing(false);
      setPendingCount(getPendingOutbox().length);
      if (res.syncedCount > 0) {
        alert(`${res.syncedCount} transaksi offline berhasil disinkronkan ke server!`);
      }
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    checkSyncState();

    const handleOnline = () => { setIsOnline(true); checkSyncState(); };
    const handleOffline = () => { setIsOnline(false); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Catch PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const updateClock = () => {
      const now = new Date();
      const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      setClockStr(wib.toLocaleTimeString('id-ID') + ' WIB');
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    const syncInterval = setInterval(checkSyncState, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('Untuk menginstal PWA Dua SiSi POS:\n\n• Chrome/Edge: Klik titik tiga (⋮) → "Install DuaSiSi POS" atau "Add to Home Screen"\n• Safari iOS: Klik Share → "Add to Home Screen"');
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button
          className="md:hidden text-slate-500 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-100 transition"
          onClick={onToggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-800">
            {tabTitles[currentTab] || 'Dua SiSi POS'}
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block">Dashboard • {currentTab}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* PWA Install Button */}
        <button
          onClick={handleInstallPWA}
          className="flex items-center gap-1.5 bg-[#1E4648] hover:bg-[#153334] text-white px-2.5 py-1 rounded-md text-[11px] font-medium transition"
          title="Instal Aplikasi Dua SiSi POS ke HP/PC"
        >
          <Download className="w-3.5 h-3.5 text-teal-300" />
          <span className="hidden sm:inline">Install PWA App</span>
        </button>

        {/* Sync Status */}
        {pendingCount > 0 ? (
          <button
            onClick={checkSyncState}
            className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-md text-[11px] font-medium transition hover:bg-amber-100"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{pendingCount} Pending</span>
          </button>
        ) : isOnline ? (
          <div className="hidden sm:flex items-center gap-1.5 text-emerald-600 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <Wifi className="w-3 h-3" />
            <span>Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </div>
        )}

        {/* Clock */}
        <div className="hidden lg:block text-[11px] text-slate-500 font-medium px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md">
          {clockStr || '00.00.00 WIB'}
        </div>

        {/* User */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${
            currentRole === 'MANAGER' ? 'bg-amber-600' : 'bg-[#1E4648]'
          }`}>
            {currentRole === 'MANAGER' ? 'M' : 'S'}
          </div>
          <span className="hidden sm:inline text-[12px] font-medium text-slate-700">
            {currentRole === 'MANAGER' ? 'Manager' : 'Kasir'}
          </span>
          <button
            onClick={onLogout}
            title="Keluar Sesi"
            className="text-slate-400 hover:text-red-500 transition p-1 rounded-md hover:bg-slate-50"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
