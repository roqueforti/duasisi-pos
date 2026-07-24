'use client';

import React, { useState } from 'react';
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
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen
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
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

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
    return `w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'} rounded-xl text-xs font-bold transition-all duration-200 active:scale-95 ${
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

      <aside className={`bg-[#11292B] text-white flex flex-col p-4 shrink-0 z-[200] fixed md:static inset-y-0 left-0 transition-all duration-300 ease-out overflow-y-auto border-r border-white/5 ${
        isCollapsed ? 'md:w-20' : 'md:w-64'
      } ${isSidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Brand Header & Toggle Minimize */}
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <img 
                src="./assets/logo-emblem-white.svg" 
                alt="Dua SiSi" 
                className="h-8 w-8 mx-auto drop-shadow-md"
              />
            ) : (
              <img 
                src="./assets/logo-full-white.svg" 
                alt="Dua SiSi Laundry Express & Coin" 
                className="h-9 w-auto max-w-[160px] drop-shadow-md"
              />
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
              title={isCollapsed ? 'Expand Sidebar' : 'Minimize Sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button 
              className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Info Capsule */}
        <div className={`mb-6 p-2.5 bg-white/5 border border-white/10 rounded-2xl flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-inner shrink-0 ${
            currentRole === 'MANAGER' ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-emerald-500 to-teal-700'
          }`}>
            {currentRole === 'MANAGER' ? '👑' : '👨‍💼'}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-white truncate">
                {currentRole === 'MANAGER' ? 'Manager / Owner' : 'Kasir 1 (Staff)'}
              </div>
              <div className="text-[10px] text-teal-300/80 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Sesi Terverifikasi
              </div>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-5 flex-1">
          <div>
            {!isCollapsed && (
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-3 mb-2 opacity-70 flex items-center justify-between">
                <span>Operasional</span>
                <Sparkles className="w-3 h-3 text-teal-400 opacity-60" />
              </div>
            )}
            <div className="space-y-1.5">
              {currentRole !== 'MANAGER' && (
                <button 
                  className={navClass('transaksi')} 
                  onClick={() => handleNavClick('transaksi')}
                  title={isCollapsed ? 'Transaksi Baru' : ''}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-4 h-4 text-teal-300 shrink-0" />
                    {!isCollapsed && <span>Transaksi Baru</span>}
                  </div>
                  {!isCollapsed && (
                    <span className="text-[10px] bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded font-black">POS</span>
                  )}
                </button>
              )}
              <button 
                className={navClass('riwayat')} 
                onClick={() => handleNavClick('riwayat')}
                title={isCollapsed ? 'Riwayat Transaksi' : ''}
              >
                <div className="flex items-center gap-3">
                  <History className="w-4 h-4 text-teal-300 shrink-0" />
                  {!isCollapsed && <span>Riwayat Transaksi</span>}
                </div>
              </button>
              <button 
                className={navClass('absensi')} 
                onClick={() => handleNavClick('absensi')}
                title={isCollapsed ? 'Absensi Shift' : ''}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-teal-300 shrink-0" />
                  {!isCollapsed && <span>Absensi Shift</span>}
                </div>
              </button>
              <button 
                className={navClass('inventory')} 
                onClick={() => handleNavClick('inventory')}
                title={isCollapsed ? 'Inventory Stok' : ''}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-4 h-4 text-teal-300 shrink-0" />
                  {!isCollapsed && <span>Inventory Stok</span>}
                </div>
              </button>
              <button 
                className={navClass('mesin')} 
                onClick={() => handleNavClick('mesin')}
                title={isCollapsed ? 'Status Mesin' : ''}
              >
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-teal-300 shrink-0" />
                  {!isCollapsed && <span>Status Mesin</span>}
                </div>
              </button>
            </div>
          </div>

          {currentRole === 'MANAGER' && (
            <div>
              {!isCollapsed && (
                <div className="text-[10px] font-extrabold text-amber-300/90 uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
                  <span>👑 Manajerial</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                </div>
              )}
              <div className="space-y-1.5">
                <button 
                  className={navClass('pegawai')} 
                  onClick={() => handleNavClick('pegawai')}
                  title={isCollapsed ? 'Pegawai & Kinerja' : ''}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-amber-300 shrink-0" />
                    {!isCollapsed && <span>Pegawai & Kinerja</span>}
                  </div>
                </button>
                <button 
                  className={navClass('produk')} 
                  onClick={() => handleNavClick('produk')}
                  title={isCollapsed ? 'Produk & Layanan' : ''}
                >
                  <div className="flex items-center gap-3">
                    <Tag className="w-4 h-4 text-amber-300 shrink-0" />
                    {!isCollapsed && <span>Produk & Layanan</span>}
                  </div>
                </button>
                <button 
                  className={navClass('rekap')} 
                  onClick={() => handleNavClick('rekap')}
                  title={isCollapsed ? 'Laporan Omzet' : ''}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-amber-300 shrink-0" />
                    {!isCollapsed && <span>Laporan Omzet</span>}
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
            title={isCollapsed ? 'Keluar Sesi' : ''}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'} rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 text-xs font-bold transition-all text-slate-300 hover:text-red-300 active:scale-95`}
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 text-red-400 shrink-0" />
              {!isCollapsed && <span>Keluar Sesi</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-slate-400 font-extrabold">PIN</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
