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
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight
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
      alert('Fitur POS Kasir hanya untuk Staff/Kasir');
      return;
    }
    if (['pegawai', 'produk', 'rekap'].includes(tabKey) && currentRole !== 'MANAGER') {
      alert('Akses Ditolak — Khusus Manager/Owner');
      return;
    }
    setCurrentTab(tabKey);
    setIsSidebarOpen(false);
  };

  const navClass = (tabKey: string) => {
    const isActive = currentTab === tabKey;
    return `w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-lg text-[13px] font-medium transition-colors ${
      isActive 
        ? 'bg-white/15 text-white' 
        : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'
    }`;
  };

  const iconClass = (tabKey: string) => {
    return currentTab === tabKey ? 'text-white' : 'text-slate-500';
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[150] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`bg-[#11292B] text-white flex flex-col shrink-0 z-[200] fixed md:static inset-y-0 left-0 transition-all duration-200 overflow-y-auto ${
        isCollapsed ? 'md:w-[72px]' : 'md:w-60'
      } ${isSidebarOpen ? 'w-60 translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/8">
          {isCollapsed ? (
            <img 
              src="./assets/logo-emblem-white.svg" 
              alt="Dua SiSi" 
              className="h-7 w-7 mx-auto brightness-0 invert"
            />
          ) : (
            <img 
              src="./assets/logo-full-white.svg" 
              alt="Dua SiSi Laundry Express & Coin" 
              className="h-8 w-auto brightness-0 invert"
            />
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex text-slate-500 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition"
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <button 
              className="md:hidden text-slate-400 hover:text-white p-1"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className={`px-4 py-3 border-b border-white/8 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
            currentRole === 'MANAGER' ? 'bg-amber-600' : 'bg-teal-600'
          }`}>
            {currentRole === 'MANAGER' ? 'M' : 'S'}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {currentRole === 'MANAGER' ? 'Manager' : 'Kasir'}
              </div>
              <div className="text-[11px] text-slate-500">
                {currentRole === 'MANAGER' ? 'Owner' : 'Staff'}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {!isCollapsed && (
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              Menu
            </div>
          )}
          
          {currentRole !== 'MANAGER' && (
            <button className={navClass('transaksi')} onClick={() => handleNavClick('transaksi')} title="POS">
              <ShoppingCart className={`w-[18px] h-[18px] shrink-0 ${iconClass('transaksi')}`} />
              {!isCollapsed && <span>POS</span>}
              {!isCollapsed && currentTab === 'transaksi' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-500" />}
            </button>
          )}
          <button className={navClass('riwayat')} onClick={() => handleNavClick('riwayat')} title="Riwayat">
            <History className={`w-[18px] h-[18px] shrink-0 ${iconClass('riwayat')}`} />
            {!isCollapsed && <span>Riwayat</span>}
          </button>
          <button className={navClass('absensi')} onClick={() => handleNavClick('absensi')} title="Absensi">
            <Clock className={`w-[18px] h-[18px] shrink-0 ${iconClass('absensi')}`} />
            {!isCollapsed && <span>Absensi</span>}
          </button>
          <button className={navClass('inventory')} onClick={() => handleNavClick('inventory')} title="Inventory">
            <Package className={`w-[18px] h-[18px] shrink-0 ${iconClass('inventory')}`} />
            {!isCollapsed && <span>Inventory</span>}
          </button>
          <button className={navClass('mesin')} onClick={() => handleNavClick('mesin')} title="Mesin">
            <Cpu className={`w-[18px] h-[18px] shrink-0 ${iconClass('mesin')}`} />
            {!isCollapsed && <span>Mesin</span>}
          </button>

          {currentRole === 'MANAGER' && (
            <>
              {!isCollapsed && (
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 mt-5 mb-2">
                  Manajemen
                </div>
              )}
              <button className={navClass('pegawai')} onClick={() => handleNavClick('pegawai')} title="Pegawai">
                <Users className={`w-[18px] h-[18px] shrink-0 ${iconClass('pegawai')}`} />
                {!isCollapsed && <span>Pegawai</span>}
              </button>
              <button className={navClass('produk')} onClick={() => handleNavClick('produk')} title="Produk">
                <Tag className={`w-[18px] h-[18px] shrink-0 ${iconClass('produk')}`} />
                {!isCollapsed && <span>Produk</span>}
              </button>
              <button className={navClass('rekap')} onClick={() => handleNavClick('rekap')} title="Laporan">
                <BarChart3 className={`w-[18px] h-[18px] shrink-0 ${iconClass('rekap')}`} />
                {!isCollapsed && <span>Laporan</span>}
              </button>
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-white/8">
          <button 
            onClick={onLogout}
            title="Keluar"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-lg text-[13px] font-medium text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors`}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!isCollapsed && <span>Keluar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
