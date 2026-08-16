'use client';

import React, { useState } from 'react';
import { UserRole } from '@/lib/types';
import { 
  LayoutDashboard,
  ShoppingCart, 
  History, 
  Clock, 
  Package, 
  Users, 
  Tag, 
  BarChart3, 
  X,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  GitMerge,
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
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Auto-collapse on tablet landscape (<=1280px)
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1280) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };
    handleResize(); // trigger on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = (tabKey: string) => {
    if (tabKey === 'transaksi' && currentRole === 'MANAGER') {
      alert('Fitur POS Kasir hanya untuk Staff/Kasir');
      return;
    }
    if (['pegawai', 'produk', 'kategori', 'shift', 'pipeline', 'rekap'].includes(tabKey) && currentRole !== 'MANAGER') {
      alert('Akses Ditolak — Khusus Manager/Owner');
      return;
    }
    setCurrentTab(tabKey);
    setIsSidebarOpen(false);
  };

  const navClass = (tabKey: string) => {
    const isActive = currentTab === tabKey;
    return `w-full text-left flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
      isActive 
        ? 'bg-slate-100 text-slate-700 font-bold shadow-2xs' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
    }`;
  };

  const iconClass = (tabKey: string) => {
    return currentTab === tabKey ? 'text-[#1E4648]' : 'text-slate-400';
  };

  return (
    <>
      {/* Mobile & Tablet Backdrop (< 1024px) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-[150] lg:hidden backdrop-blur-xs"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`bg-white text-slate-600 border-r border-slate-200/80 flex flex-col shrink-0 z-[200] fixed lg:static inset-y-0 left-0 transition-all duration-200 overflow-y-auto ${
        isCollapsed ? 'lg:w-[64px]' : 'lg:w-60'
      } ${isSidebarOpen ? 'w-60 translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Header Logo & Minimize */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3 py-4 px-2 border-b border-slate-100">
            <img 
              src="./assets/Asset 5.svg" 
              alt="Dua SiSi" 
              className="h-8 w-8"
            />
            <button
              onClick={() => setIsCollapsed(false)}
              className="hidden lg:flex text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
              title="Expand Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
            <img 
              src="./assets/Asset 5.svg" 
              alt="Dua SiSi Laundry Express & Coin" 
              className="h-9 w-auto object-contain max-w-[140px]"
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCollapsed(true)}
                className="hidden lg:flex text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
                title="Minimize Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button 
                className="lg:hidden text-slate-400 hover:text-slate-600 p-1"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* User Info Badge */}
        <div className={`px-3.5 py-3 border-b border-slate-100 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs ${
            currentRole === 'MANAGER' ? 'bg-[#FF9500]' : 'bg-[#1E4648]'
          }`}>
            {currentRole === 'MANAGER' ? 'M' : 'S'}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-600 truncate">
                {currentRole === 'MANAGER' ? 'Manager' : 'Kasir 1'}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                {currentRole === 'MANAGER' ? 'Owner / Manager' : 'Staff On Duty'}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-3 space-y-1">
          {!isCollapsed && (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
              Menu Utama
            </div>
          )}
          
          <button className={navClass('dashboard')} onClick={() => handleNavClick('dashboard')} title="Dashboard Utama">
            <LayoutDashboard className={`w-[18px] h-[18px] shrink-0 ${iconClass('dashboard')}`} />
            {!isCollapsed && <span>Dashboard Utama</span>}
            {!isCollapsed && currentTab === 'dashboard' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" />}
          </button>

          {currentRole !== 'MANAGER' && (
            <>
              <button className={navClass('transaksi')} onClick={() => handleNavClick('transaksi')} title="POS Kasir">
                <ShoppingCart className={`w-[18px] h-[18px] shrink-0 ${iconClass('transaksi')}`} />
                {!isCollapsed && <span>POS Kasir</span>}
                {!isCollapsed && currentTab === 'transaksi' && <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" />}
              </button>
            </>
          )}
          <button className={navClass('riwayat')} onClick={() => handleNavClick('riwayat')} title="Riwayat">
            <History className={`w-[18px] h-[18px] shrink-0 ${iconClass('riwayat')}`} />
            {!isCollapsed && <span>Riwayat Transaksi</span>}
          </button>
          <button className={navClass('pesanan')} onClick={() => handleNavClick('pesanan')} title="Pesanan Drop-off">
            <ClipboardList className={`w-[18px] h-[18px] shrink-0 ${iconClass('pesanan')}`} />
            {!isCollapsed && <span>Pesanan Drop-off</span>}
          </button>
          <button className={navClass('absensi')} onClick={() => handleNavClick('absensi')} title="Absensi">
            <Clock className={`w-[18px] h-[18px] shrink-0 ${iconClass('absensi')}`} />
            {!isCollapsed && <span>Absensi Staf</span>}
          </button>
          <button className={navClass('pelanggan')} onClick={() => handleNavClick('pelanggan')} title="Data Pelanggan">
            <Users className={`w-[18px] h-[18px] shrink-0 ${iconClass('pelanggan')}`} />
            {!isCollapsed && <span>Data Pelanggan</span>}
          </button>
          <button className={navClass('inventory')} onClick={() => handleNavClick('inventory')} title="Inventory">
            <Package className={`w-[18px] h-[18px] shrink-0 ${iconClass('inventory')}`} />
            {!isCollapsed && <span>Stok Inventory</span>}
          </button>

          {currentRole === 'MANAGER' && (
            <>
              {!isCollapsed && (
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mt-4 mb-1.5">
                  Manajemen
                </div>
              )}
              <button className={navClass('pegawai')} onClick={() => handleNavClick('pegawai')} title="Pegawai">
                <Users className={`w-[18px] h-[18px] shrink-0 ${iconClass('pegawai')}`} />
                {!isCollapsed && <span>Data Pegawai</span>}
              </button>
              <button className={navClass('shift')} onClick={() => handleNavClick('shift')} title="Shift & Absensi">
                <Clock className={`w-[18px] h-[18px] shrink-0 ${iconClass('shift')}`} />
                {!isCollapsed && <span>Shift & Absensi</span>}
              </button>
              <button className={navClass('pipeline')} onClick={() => handleNavClick('pipeline')} title="Drop Off Pipeline">
                <GitMerge className={`w-[18px] h-[18px] shrink-0 ${iconClass('pipeline')}`} />
                {!isCollapsed && <span>Manajemen Drop Off</span>}
              </button>
              <button className={navClass('produk')} onClick={() => handleNavClick('produk')} title="Produk">
                <Tag className={`w-[18px] h-[18px] shrink-0 ${iconClass('produk')}`} />
                {!isCollapsed && <span>Manajemen Produk</span>}
              </button>
              <button className={navClass('kategori')} onClick={() => handleNavClick('kategori')} title="Kategori">
                <FolderOpen className={`w-[18px] h-[18px] shrink-0 ${iconClass('kategori')}`} />
                {!isCollapsed && <span>Manajemen Kategori</span>}
              </button>
              <button className={navClass('keamanan')} onClick={() => handleNavClick('keamanan')} title="Keamanan">
                <ShieldCheck className={`w-[18px] h-[18px] shrink-0 ${iconClass('keamanan')}`} />
                {!isCollapsed && <span>Manajemen Keamanan</span>}
              </button>
              <button className={navClass('menu')} onClick={() => handleNavClick('menu')} title="Desain Menu">
                <LayoutDashboard className={`w-[18px] h-[18px] shrink-0 ${iconClass('menu')}`} />
                {!isCollapsed && <span>Menu Digital</span>}
              </button>
              <button className={navClass('rekap')} onClick={() => handleNavClick('rekap')} title="Laporan">
                <BarChart3 className={`w-[18px] h-[18px] shrink-0 ${iconClass('rekap')}`} />
                {!isCollapsed && <span>Laporan Rekap</span>}
              </button>
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-slate-100">
          <button 
            onClick={onLogout}
            title="Keluar Sesi"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'} rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors`}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0 text-rose-500" />
            {!isCollapsed && <span>Keluar Sesi</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
