'use client';

import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Wifi, WifiOff, Download, Printer } from 'lucide-react';
import { UserRole } from '@/lib/types';
import PrinterModal from '@/components/PrinterModal';
import { getActiveDeviceInfo } from '@/lib/bluetoothPrinter';

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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [printerConnected, setPrinterConnected] = useState<boolean>(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => { setIsOnline(true); };
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

      // Refresh printer connection state
      const info = getActiveDeviceInfo();
      setPrinterConnected(info.connected);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(interval);
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
    <>
      <header className="h-14 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition"
            onClick={onToggleSidebar}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-slate-800">
              {tabTitles[currentTab] || 'Dua SiSi POS'}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Dashboard • {currentTab}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bluetooth Thermal Printer Status & Config Button */}
          <button
            onClick={() => setIsPrinterModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              printerConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Pengecekan Bluetooth & Setting Thermal Printer"
          >
            <div className="relative">
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                printerConnected ? 'bg-emerald-500' : 'bg-slate-400'
              }`} />
            </div>
            <span className="hidden sm:inline">
              {printerConnected ? 'Printer Thermal (Terhubung)' : 'Cek Printer BT'}
            </span>
          </button>

          {/* PWA Install Button */}
          <button
            onClick={handleInstallPWA}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
            title="Instal Aplikasi Dua SiSi POS ke HP/PC"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Install PWA App</span>
          </button>

          {/* Online Status */}
          {isOnline ? (
            <div className="hidden sm:flex items-center gap-1.5 text-emerald-600 text-xs font-semibold px-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold px-2">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline</span>
            </div>
          )}

          {/* Clock */}
          <div className="hidden lg:block text-xs text-slate-500 font-semibold px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-xl">
            {clockStr || '00.00.00 WIB'}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xs ${
              currentRole === 'MANAGER' ? 'bg-amber-600' : 'bg-[#1E4648]'
            }`}>
              {currentRole === 'MANAGER' ? 'M' : 'S'}
            </div>
            <span className="hidden sm:inline text-xs font-bold text-slate-800">
              {currentRole === 'MANAGER' ? 'Manager' : 'Kasir 1'}
            </span>
            <button
              onClick={onLogout}
              title="Keluar Sesi"
              className="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-rose-50"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Printer Modal */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />
    </>
  );
}
