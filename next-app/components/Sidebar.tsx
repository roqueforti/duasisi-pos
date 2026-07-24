'use client';

import React from 'react';
import { UserRole } from '@/lib/types';
import { 
  ShoppingCart, 
  History, 
  Clock, 
  Package, 
  Cpu, 
  Users, 
  Tag, 
  BarChart3, 
  X,
  LogOut 
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentRole: UserRole;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  currentRole,
  isSidebarOpen,
  setIsSidebarOpen,
  onLogout
}: SidebarProps) {
  const handleNavClick = (tabKey: string) => {
    if (tabKey === 'transaksi' && currentRole === 'MANAGER') {
      alert('🔒 Fitur POS Kasir hanya untuk Staff/Kasir');
      return;
    }
    if (['pegawai', 'produk', 'rekap'].includes(tabKey) && currentRole !== 'MANAGER') {
      alert('🔒 Akses Ditolak — Khusus Manager/Owner');
      return;
    }
    setCurrentTab(tabKey);
    setIsSidebarOpen(false);
  };

  const navClass = (tabKey: string) => {
    const isActive = currentTab === tabKey;
    return `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
      isActive 
        ? 'bg-[#1E4648] text-white shadow-md' 
        : 'text-slate-300 hover:bg-white/10'
    }`;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[150] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`w-64 bg-[#11292B] text-white flex flex-col p-5 shrink-0 z-[200] fixed md:static inset-y-0 left-0 transition-transform duration-300 ease-out overflow-y-auto ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2.5">
            <img 
              src="./assets/logo-full-white.svg" 
              alt="Dua SiSi Laundry Express & Coin" 
              className="h-9 w-auto max-w-[170px]"
            />
          </div>
          <button 
            className="md:hidden text-slate-400 hover:text-white p-1"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-6 flex-1">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 opacity-70">
              Operasional
            </div>
            <div className="space-y-1">
              {currentRole !== 'MANAGER' && (
                <button className={navClass('transaksi')} onClick={() => handleNavClick('transaksi')}>
                  <ShoppingCart className="w-4 h-4" /> Transaksi Baru
                </button>
              )}
              <button className={navClass('riwayat')} onClick={() => handleNavClick('riwayat')}>
                <History className="w-4 h-4" /> Riwayat Transaksi
              </button>
              <button className={navClass('absensi')} onClick={() => handleNavClick('absensi')}>
                <Clock className="w-4 h-4" /> Absensi Shift
              </button>
              <button className={navClass('inventory')} onClick={() => handleNavClick('inventory')}>
                <Package className="w-4 h-4" /> Inventory Stok
              </button>
              <button className={navClass('mesin')} onClick={() => handleNavClick('mesin')}>
                <Cpu className="w-4 h-4" /> Status Mesin
              </button>
            </div>
          </div>

          {currentRole === 'MANAGER' && (
            <div>
              <div className="text-[10px] font-bold text-teal-300/80 uppercase tracking-widest px-3 mb-2 opacity-80 flex items-center gap-1">
                👑 Manajerial
              </div>
              <div className="space-y-1">
                <button className={navClass('pegawai')} onClick={() => handleNavClick('pegawai')}>
                  <Users className="w-4 h-4" /> Pegawai & Kinerja
                </button>
                <button className={navClass('produk')} onClick={() => handleNavClick('produk')}>
                  <Tag className="w-4 h-4" /> Produk & Layanan
                </button>
                <button className={navClass('rekap')} onClick={() => handleNavClick('rekap')}>
                  <BarChart3 className="w-4 h-4" /> Laporan Omzet
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Logout Section */}
        <div className="pt-4 border-t border-white/10 mt-auto">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition text-slate-300 hover:text-white"
          >
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-red-400" />
              <span>Keluar Sesi</span>
            </div>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-400">PIN</span>
          </button>
        </div>
      </aside>
    </>
  );
}
