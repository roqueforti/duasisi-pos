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
  LogOut,
  Sparkles,
  ShieldCheck
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
    return `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
      isActive 
        ? 'bg-gradient-to-r from-[#1E4648] to-[#2B5E61] text-white shadow-lg shadow-teal-950/40 border border-teal-500/20 ring-1 ring-teal-400/20' 
        : 'text-slate-300 hover:bg-white/10 hover:text-white'
    }`;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[150] md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`w-64 bg-[#11292B] text-white flex flex-col p-5 shrink-0 z-[200] fixed md:static inset-y-0 left-0 transition-transform duration-300 ease-out overflow-y-auto border-r border-white/5 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-7 px-1">
          <div className="flex items-center gap-2.5">
            <img 
              src="./assets/logo-full-white.svg" 
              alt="Dua SiSi Laundry Express & Coin" 
              className="h-10 w-auto max-w-[170px] drop-shadow-md"
            />
          </div>
          <button 
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info Capsule */}
        <div className="mb-6 p-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-inner ${
            currentRole === 'MANAGER' ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-emerald-500 to-teal-700'
          }`}>
            {currentRole === 'MANAGER' ? '👑' : '👨‍💼'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black text-white truncate">
              {currentRole === 'MANAGER' ? 'Manager / Owner' : 'Kasir 1 (Staff)'}
            </div>
            <div className="text-[10px] text-teal-300/80 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Sesi Terverifikasi
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-6 flex-1">
          <div>
            <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2 opacity-70 flex items-center justify-between">
              <span>Operasional</span>
              <Sparkles className="w-3 h-3 text-teal-400 opacity-60" />
            </div>
            <div className="space-y-1.5">
              {currentRole !== 'MANAGER' && (
                <button className={navClass('transaksi')} onClick={() => handleNavClick('transaksi')}>
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-4 h-4 text-teal-300" />
                    <span>Transaksi Baru</span>
                  </div>
                  <span className="text-[10px] bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded font-black">POS</span>
                </button>
              )}
              <button className={navClass('riwayat')} onClick={() => handleNavClick('riwayat')}>
                <div className="flex items-center gap-3">
                  <History className="w-4 h-4 text-teal-300" />
                  <span>Riwayat Transaksi</span>
                </div>
              </button>
              <button className={navClass('absensi')} onClick={() => handleNavClick('absensi')}>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-teal-300" />
                  <span>Absensi Shift</span>
                </div>
              </button>
              <button className={navClass('inventory')} onClick={() => handleNavClick('inventory')}>
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-teal-300" />
                  <span>Inventory Stok</span>
                </div>
              </button>
              <button className={navClass('mesin')} onClick={() => handleNavClick('mesin')}>
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-teal-300" />
                  <span>Status Mesin</span>
                </div>
              </button>
            </div>
          </div>

          {currentRole === 'MANAGER' && (
            <div>
              <div className="text-[10px] font-extrabold text-amber-300/90 uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
                <span>👑 Manajerial</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              </div>
              <div className="space-y-1.5">
                <button className={navClass('pegawai')} onClick={() => handleNavClick('pegawai')}>
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-amber-300" />
                    <span>Pegawai & Kinerja</span>
                  </div>
                </button>
                <button className={navClass('produk')} onClick={() => handleNavClick('produk')}>
                  <div className="flex items-center gap-3">
                    <Tag className="w-4 h-4 text-amber-300" />
                    <span>Produk & Layanan</span>
                  </div>
                </button>
                <button className={navClass('rekap')} onClick={() => handleNavClick('rekap')}>
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-amber-300" />
                    <span>Laporan Omzet</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </nav>

        {/* Logout Section */}
        <div className="pt-4 border-t border-white/10 mt-auto">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 text-xs font-bold transition-all text-slate-300 hover:text-red-300 active:scale-95"
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 text-red-400" />
              <span>Keluar Sesi</span>
            </div>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-400 font-extrabold">PIN</span>
          </button>
        </div>
      </aside>
    </>
  );
}
