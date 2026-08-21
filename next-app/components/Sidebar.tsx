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
  GitMerge,
  ShieldCheck,
  FolderOpen,
  Sparkles,
  Coins,
  UserCheck,
  WashingMachine
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { useDialog } from '@/components/DialogProvider';
import { BadgeCounts } from '@/lib/useGlobalNotifications';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentRole: UserRole;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
  badgeCounts?: BadgeCounts;
  isShiftActive?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  managerOnly?: boolean;
  staffOnly?: boolean;
  requiresShift?: boolean;
  isShiftCta?: boolean;
}

interface NavGroup {
  groupName: string;
  items: NavItem[];
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  currentRole,
  isSidebarOpen,
  setIsSidebarOpen,
  onLogout,
  badgeCounts,
  isShiftActive = false
}: SidebarProps) {
  const { showAlert } = useDialog();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const handleNavClick = async (tabKey: string, requiresShift?: boolean) => {
    if (tabKey === 'transaksi' && currentRole === 'MANAGER') {
      await showAlert('Fitur POS Kasir hanya untuk Staff/Kasir', 'warning');
      return;
    }
    if (['pegawai', 'payroll', 'produk', 'kategori', 'shift', 'rekap', 'keamanan', 'menu', 'langkah'].includes(tabKey) && currentRole !== 'MANAGER') {
      await showAlert('Akses Ditolak — Khusus Manager/Owner', 'error');
      return;
    }

    // Cek apakah menu memerlukan kas shift aktif
    if (requiresShift && !isShiftActive && currentRole !== 'MANAGER') {
      await showAlert('🔒 Menu ini terkunci. Harap Buka Shift terlebih dahulu di menu "Shift Saya" untuk memulai operasional kasir.', 'warning');
      setCurrentTab('shift_saya');
      setIsSidebarOpen(false);
      return;
    }

    setCurrentTab(tabKey);
    setIsSidebarOpen(false);
  };

  const navGroups: NavGroup[] = [
    {
      groupName: 'Operasional Kasir',
      items: [
        { id: 'dashboard', label: 'Dashboard Utama', icon: LayoutDashboard },
        { id: 'transaksi', label: 'POS Kasir', icon: ShoppingCart, staffOnly: true, requiresShift: true },
        { id: 'pesanan', label: 'Pesanan Drop-off', icon: ClipboardList, requiresShift: true },
        { id: 'mesin', label: 'Daftar & Status Mesin', icon: WashingMachine, requiresShift: true },
        { id: 'riwayat', label: 'Riwayat Transaksi', icon: History },
        { id: 'pelanggan', label: 'Data Pelanggan', icon: Users }
      ]
    },
    {
      groupName: 'Shift & Kas',
      items: [
        { id: 'shift_saya', label: 'Shift Saya', icon: Clock, isShiftCta: true },
        { id: 'pengeluaran', label: 'Pengeluaran', icon: Coins, requiresShift: true },
        { id: 'riwayat_shift', label: 'Riwayat Shift', icon: History }
      ]
    },
    {
      groupName: 'Katalog & Inventory',
      items: [
        { id: 'inventory', label: 'Stok Inventory', icon: Package },
        { id: 'produk', label: 'Manajemen Layanan', icon: Tag, managerOnly: true },
        { id: 'kategori', label: 'Kategori Layanan', icon: FolderOpen, managerOnly: true },
        { id: 'langkah', label: 'Pipeline Langkah', icon: GitMerge, managerOnly: true },
        { id: 'menu', label: 'Menu Digital', icon: Sparkles, managerOnly: true }
      ]
    },
    {
      groupName: 'Kepegawaian & Gaji',
      items: [
        { id: 'absensi', label: 'Presensi & Cuti', icon: UserCheck },
        { id: 'shift', label: 'Master Shift & Config', icon: Coins, managerOnly: true },
        { id: 'pegawai', label: 'Data Pegawai', icon: Users, managerOnly: true },
        { id: 'payroll', label: 'Payroll & Gaji', icon: RupiahIcon, managerOnly: true }
      ]
    },
    {
      groupName: 'Laporan & Pengaturan',
      items: [
        { id: 'rekap', label: 'Laporan Rekap', icon: BarChart3, managerOnly: true },
        { id: 'keamanan', label: 'Keamanan & PIN', icon: ShieldCheck, managerOnly: true }
      ]
    }
  ];

  return (
    <>
      {/* Mobile & Tablet Backdrop (< 1024px) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-[150] lg:hidden backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Sidebar Aside */}
      <aside className={`bg-white text-slate-600 border-r border-slate-200/80 flex flex-col shrink-0 z-[200] fixed lg:static inset-y-0 left-0 transition-all duration-200 overflow-y-auto ${
        isCollapsed ? 'lg:w-[68px]' : 'lg:w-60'
      } ${
        isSidebarOpen ? 'w-64 sm:w-72 translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
      }`}>
        
        {/* Header Logo & Minimize / Close */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 min-h-[56px]">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <img 
              src="./assets/Asset 5.svg" 
              alt="Dua SiSi Laundry Express & Coin" 
              className={`object-contain transition-all ${
                isCollapsed ? 'lg:h-7 lg:w-7' : 'h-8 w-auto max-w-[140px]'
              }`}
            />
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse / Expand Toggle Button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
              title={isCollapsed ? 'Perluas Sidebar' : 'Kecilkan Sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            {/* Mobile / Tablet Drawer Close Button */}
            <button 
              className="lg:hidden text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              onClick={() => setIsSidebarOpen(false)}
              title="Tutup Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Role Badge */}
        <div className={`px-3.5 py-3 border-b border-slate-100 flex items-center ${
          isCollapsed ? 'lg:justify-center' : 'gap-3'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs ${
            currentRole === 'MANAGER' ? 'bg-[#FF9500]' : 'bg-[#1E4648]'
          }`}>
            {currentRole === 'MANAGER' ? 'M' : 'S'}
          </div>
          
          {/* Text is always visible in Mobile/Tablet Drawer, and hidden on desktop ONLY if isCollapsed */}
          <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
            <div className="text-xs font-bold text-slate-800 truncate">
              {currentRole === 'MANAGER' ? 'Manager Outlet' : 'Kasir / Staff'}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {currentRole === 'MANAGER' ? 'Owner / Manager' : (isShiftActive ? '🟢 Shift Aktif' : '⚪ Belum Buka Shift')}
            </div>
          </div>
        </div>

        {/* Grouped Navigation Menu */}
        <nav className="flex-1 px-3 py-3 space-y-4">
          {navGroups.map((group, gIdx) => {
            const visibleItems = group.items.filter(item => {
              if (item.managerOnly && currentRole !== 'MANAGER') return false;
              if (item.staffOnly && currentRole === 'MANAGER') return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                {/* Section Header */}
                <div className={`text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2.5 pb-1 ${
                  isCollapsed ? 'lg:hidden' : 'block'
                }`}>
                  {group.groupName}
                </div>

                {isCollapsed && (
                  <div className="hidden lg:block w-full border-t border-slate-100 my-2" />
                )}

                {visibleItems.map(item => {
                  const IconComp = item.icon;
                  const isActive = currentTab === item.id;
                  const count = badgeCounts ? (badgeCounts as any)[item.id] || 0 : 0;
                  const isLocked = item.requiresShift && !isShiftActive && currentRole !== 'MANAGER';
                  const isShiftNotice = item.isShiftCta && !isShiftActive && currentRole !== 'MANAGER';

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id, item.requiresShift)}
                      title={item.label}
                      className={`w-full text-left flex items-center rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer tactile-btn ${
                        isCollapsed 
                          ? 'lg:justify-center lg:px-2 lg:py-2 gap-2.5 px-3 py-2.5' 
                          : 'gap-2.5 px-3 py-2.5'
                      } ${
                        isActive 
                          ? 'bg-gradient-to-r from-[#042f2e] to-[#115e59] text-white font-extrabold shadow-md border border-teal-500/30' 
                          : isShiftNotice
                          ? 'bg-teal-50/80 border border-teal-200 text-[#042f2e] font-extrabold shadow-xs'
                          : isLocked
                          ? 'text-slate-400 hover:bg-slate-50'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <IconComp className={`w-4 h-4 transition-colors ${isActive ? 'text-teal-300' : isShiftNotice ? 'text-teal-700' : isLocked ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        {isCollapsed && count > 0 && (
                          <span className="hidden lg:block absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                        )}
                      </div>

                      {/* Label Text */}
                      <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'block'} ${isLocked ? 'text-slate-400' : ''}`}>
                        {item.label}
                      </span>

                      {/* Locked Badge */}
                      {isLocked && !isCollapsed && (
                        <span className="ml-auto text-[11px] text-slate-400">🔒</span>
                      )}

                      {/* Shift Saya Active / Action Badge */}
                      {isShiftNotice && !isCollapsed && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-black bg-teal-600 text-white shadow-xs animate-pulse">
                          Buka Shift
                        </span>
                      )}

                      {/* Notification Count Badge */}
                      {count > 0 && !isLocked && (
                        <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white shadow-xs animate-pulse shrink-0 ${
                          isCollapsed ? 'lg:hidden' : 'block'
                        }`}>
                          {count > 99 ? '99+' : count}
                        </span>
                      )}

                      {/* Active Indicator Chevron */}
                      {isActive && count === 0 && !isLocked && !isShiftNotice && (
                        <ChevronRight className={`w-3.5 h-3.5 ml-auto text-teal-300 ${isCollapsed ? 'lg:hidden' : 'block'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>


        {/* Logout Button */}
        <div className="px-3 py-3 border-t border-slate-100">
          <button 
            onClick={onLogout}
            title="Keluar Sesi"
            className={`w-full flex items-center rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors ${
              isCollapsed ? 'lg:justify-center lg:px-2 lg:py-2 gap-2.5 px-3 py-2.5' : 'gap-2.5 px-3 py-2.5'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
            <span className={isCollapsed ? 'lg:hidden' : 'block'}>Keluar Sesi</span>
          </button>
        </div>
      </aside>
    </>
  );
}
