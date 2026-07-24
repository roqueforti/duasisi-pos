'use client';

import React, { useState, useEffect } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { UserRole } from '@/lib/types';

interface NavbarProps {
  currentTab: string;
  currentRole: UserRole;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

const tabTitles: Record<string, string> = {
  transaksi: 'Transaksi Baru',
  riwayat: 'Riwayat Transaksi',
  absensi: 'Absensi Shift',
  inventory: 'Inventory Stok',
  mesin: 'Status Mesin',
  pegawai: 'Pegawai & Kinerja',
  produk: 'Produk & Layanan',
  rekap: 'Laporan Omzet',
};

export default function Navbar({
  currentTab,
  currentRole,
  onToggleSidebar,
  onLogout,
}: NavbarProps) {
  const [clockStr, setClockStr] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      setClockStr(wib.toLocaleTimeString('id-ID') + ' WIB');
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-30">
      <div className="flex items-center gap-3">
        <button
          className="md:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg border border-slate-200"
          onClick={onToggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
          {tabTitles[currentTab] || 'Dua SiSi POS'}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Clock */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 font-extrabold text-xs">
          <span>⏰</span>
          <span>{clockStr || '00.00.00 WIB'}</span>
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 pr-3 rounded-xl border border-slate-200/80">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white ${
            currentRole === 'MANAGER' ? 'bg-[#1E4648]' : 'bg-emerald-600'
          }`}>
            {currentRole === 'MANAGER' ? 'M' : 'S'}
          </div>
          <div className="text-[11px] font-bold text-slate-700">
            {currentRole === 'MANAGER' ? 'Manager / Owner' : 'Kasir 1 (Staff)'}
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Keluar Sesi"
          className="text-slate-400 hover:text-red-600 transition p-1.5 rounded-lg"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
