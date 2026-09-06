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
  ChevronDown,
  ClipboardList,
  GitMerge,
  ShieldCheck,
  FolderOpen,
  FolderArchive,
  Sparkles,
  Coins,
  UserCheck,
  WashingMachine,
  SlidersHorizontal,
  Award,
  CheckCheck,
  Lock,
  ChevronsDown,
  ChevronsUp,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import CuteRoleAvatar from './CuteRoleAvatar';
import RupiahIcon from '@/components/RupiahIcon';
import { useDialog } from '@/components/DialogProvider';
import { useDisplaySettings } from '@/components/DisplaySettingsContext';
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
  id: string;
  groupName: string;
  icon: any;
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
  const { openSettingsModal } = useDisplaySettings();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Accordion open/close state per group (default open Kasir & Katalog so it's welcoming)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('duasisi_sidebar_accordions_v3');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      kasir_operasional: true,
      kas_shift: false,
      katalog_stok: true,
      sdm_payroll: false,
      laporan_sistem: false
    };
  });

  const handleNavClick = async (tabKey: string, requiresShift?: boolean) => {
    if (tabKey === 'tampilan') {
      openSettingsModal();
      setIsSidebarOpen(false);
      return;
    }

    if (tabKey === 'transaksi' && currentRole === 'MANAGER') {
      await showAlert('Fitur POS Kasir hanya untuk Staff/Kasir', 'warning');
      return;
    }
    if (['pegawai', 'payroll', 'produk', 'kategori', 'shift', 'rekap', 'arsip_laporan', 'keamanan', 'menu', 'langkah', 'loyalty_card'].includes(tabKey) && currentRole !== 'MANAGER') {
      await showAlert('Akses Ditolak — Khusus Manager/Owner', 'error');
      return;
    }

    // Cek apakah menu memerlukan kas shift aktif
    if (requiresShift && !isShiftActive && currentRole !== 'MANAGER') {
      await showAlert('Menu ini terkunci. Harap Buka Shift terlebih dahulu di menu "Shift Saya" untuk memulai operasional kasir.', 'warning');
      setCurrentTab('shift_saya');
      setIsSidebarOpen(false);
      return;
    }

    setCurrentTab(tabKey);
    setIsSidebarOpen(false);
  };

  const navGroups: NavGroup[] = [
    {
      id: 'kasir_operasional',
      groupName: 'Kasir & Order',
      icon: ShoppingCart,
      items: [
        { id: 'transaksi', label: 'POS Kasir', icon: ShoppingCart, staffOnly: true, requiresShift: true },
        { id: 'pesanan', label: 'Antrean Drop-off', icon: ClipboardList, requiresShift: true },
        { id: 'riwayat_dropoff', label: 'Drop-off Selesai', icon: CheckCheck, requiresShift: true },
        { id: 'mesin', label: 'Monitoring Mesin', icon: WashingMachine, requiresShift: true },
        { id: 'riwayat', label: 'Riwayat Transaksi', icon: History },
        { id: 'pelanggan', label: 'Data Pelanggan', icon: Users }
      ]
    },
    {
      id: 'kas_shift',
      groupName: 'Kas & Shift',
      icon: Coins,
      items: [
        { id: 'shift_saya', label: 'Shift Saya', icon: Clock, isShiftCta: true },
        { id: 'pengeluaran', label: 'Kas & Pengeluaran', icon: Coins, requiresShift: true },
        { id: 'riwayat_shift', label: 'Riwayat Shift', icon: History }
      ]
    },
    {
      id: 'katalog_stok',
      groupName: 'Katalog & Stok',
      icon: Package,
      items: [
        { id: 'produk', label: 'Produk & Layanan', icon: Tag, managerOnly: true },
        { id: 'inventory', label: 'Stok Bahan (Inventory)', icon: Package },
        { id: 'kategori', label: 'Kategori Produk & Jasa', icon: FolderOpen, managerOnly: true },
        { id: 'langkah', label: 'Alur Pengerjaan (SOP)', icon: GitMerge, managerOnly: true },
        { id: 'loyalty_card', label: 'Program Loyalty', icon: Award, managerOnly: true },
        { id: 'menu', label: 'Katalog & Menu Digital', icon: Sparkles, managerOnly: true }
      ]
    },
    {
      id: 'sdm_payroll',
      groupName: 'Tim & Karyawan',
      icon: Users,
      items: [
        { id: 'absensi', label: 'Presensi Staf', icon: UserCheck },
        { id: 'pegawai', label: 'Data Karyawan', icon: Users, managerOnly: true },
        { id: 'shift', label: 'Master Jadwal Shift', icon: Coins, managerOnly: true },
        { id: 'payroll', label: 'Gaji & Payroll', icon: RupiahIcon, managerOnly: true }
      ]
    },
    {
      id: 'laporan_sistem',
      groupName: 'Laporan & Sistem',
      icon: BarChart3,
      items: [
        { id: 'rekap', label: 'Laporan Rekap', icon: BarChart3, managerOnly: true },
        { id: 'arsip_laporan', label: 'Arsip Laporan Bulanan', icon: FolderArchive, managerOnly: true },
        { id: 'keamanan', label: 'Keamanan & Hak Akses', icon: ShieldCheck, managerOnly: true },
        { id: 'tampilan', label: 'Pengaturan Tampilan', icon: SlidersHorizontal }
      ]
    }
  ];

  // Automatically expand group containing active tab
  React.useEffect(() => {
    const activeGroup = navGroups.find(group => 
      group.items.some(item => item.id === currentTab)
    );
    if (activeGroup) {
      setOpenGroups(prev => {
        if (prev[activeGroup.id]) return prev;
        const updated = { ...prev, [activeGroup.id]: true };
        try {
          localStorage.setItem('duasisi_sidebar_accordions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  }, [currentTab]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const updated = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem('duasisi_sidebar_accordions', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const isAllOpen = navGroups.every(g => !!openGroups[g.id]);
  const toggleAllGroups = () => {
    const newState: Record<string, boolean> = {};
    navGroups.forEach(g => {
      newState[g.id] = !isAllOpen;
    });
    setOpenGroups(newState);
    try {
      localStorage.setItem('duasisi_sidebar_accordions', JSON.stringify(newState));
    } catch {}
  };

  const renderNavButton = (item: NavItem, isSubmenu: boolean = false) => {
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
        className={`w-full text-left flex items-center rounded-xl whitespace-nowrap transition-all duration-150 cursor-pointer tactile-btn ${
          isCollapsed 
            ? 'lg:justify-center lg:px-2 lg:py-2 gap-2.5 px-3 py-2.5 text-xs font-semibold' 
            : isSubmenu
            ? 'gap-2 px-2.5 py-1.5 text-[11.5px]'
            : 'gap-2.5 px-3 py-2 text-xs font-semibold'
        } ${
          isActive 
            ? 'bg-gradient-to-r from-[#042f2e] to-[#115e59] text-white font-extrabold shadow-md border border-teal-500/30' 
            : isShiftNotice
            ? 'bg-teal-50/80 border border-teal-200 text-[#042f2e] font-extrabold shadow-xs'
            : isLocked
            ? 'text-slate-400 hover:bg-slate-50'
            : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900'
        }`}
      >
        <div className="relative shrink-0">
          <IconComp className={`transition-colors ${isSubmenu && !isCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isActive ? 'text-teal-300' : isShiftNotice ? 'text-teal-700' : isLocked ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-600'}`} />
          {isCollapsed && count > 0 && (
            <span className="hidden lg:block absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
          )}
        </div>

        {/* Label Text */}
        <span className={`truncate ${isCollapsed ? 'lg:hidden' : 'block'} ${isLocked ? 'text-slate-400' : ''} ${isActive ? 'font-bold' : isSubmenu ? 'font-medium' : 'font-semibold'}`}>
          {item.label}
        </span>

        {/* Locked Badge */}
        {isLocked && !isCollapsed && (
          <Lock className="ml-auto w-3.5 h-3.5 text-slate-400" />
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
  };

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
        isCollapsed ? 'lg:w-[68px]' : 'lg:w-64'
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
          <CuteRoleAvatar
            role={currentRole}
            size="md"
            shape="squircle"
            className="shrink-0"
            bubblePlacement="left"
          />
          
          {/* Text is always visible in Mobile/Tablet Drawer, and hidden on desktop ONLY if isCollapsed */}
          <div className={`min-w-0 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
            <div className="text-xs font-bold text-slate-800 truncate">
              {currentRole === 'MANAGER' ? 'Manager Outlet' : 'Kasir / Staff'}
            </div>
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center">
              {currentRole === 'MANAGER' ? (
                'Owner / Manager'
              ) : isShiftActive ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Shift Aktif
                </>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 mr-1.5" />
                  Belum Buka Shift
                </>
              )}
            </div>
          </div>
        </div>

        {/* Grouped Navigation Menu */}
        <nav className="flex-1 px-3 py-3 space-y-2 overflow-y-auto">
          {/* Pinned Quick Access: Dashboard Utama */}
          <div className="mb-2">
            <button
              onClick={() => handleNavClick('dashboard')}
              title="Dashboard Utama"
              className={`w-full text-left flex items-center rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer tactile-btn ${
                isCollapsed 
                  ? 'lg:justify-center lg:px-2 lg:py-2.5 gap-2.5 px-3 py-2.5' 
                  : 'gap-2.5 px-3 py-2.5'
              } ${
                currentTab === 'dashboard'
                  ? 'bg-gradient-to-r from-[#042f2e] to-[#115e59] text-white font-extrabold shadow-md border border-teal-500/30'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 bg-slate-50/70 border border-slate-100'
              }`}
            >
              <div className="relative shrink-0">
                <LayoutDashboard className={`w-4 h-4 transition-colors ${currentTab === 'dashboard' ? 'text-teal-300' : 'text-teal-700'}`} />
              </div>
              <span className={`truncate font-bold ${isCollapsed ? 'lg:hidden' : 'block'}`}>
                Dashboard Utama
              </span>
              {currentTab === 'dashboard' && (
                <ChevronRight className={`w-3.5 h-3.5 ml-auto text-teal-300 ${isCollapsed ? 'lg:hidden' : 'block'}`} />
              )}
            </button>
          </div>

          {/* Section Header & Expand/Collapse All Button */}
          <div className={`flex items-center justify-between px-2 pt-2 pb-1.5 ${isCollapsed ? 'lg:hidden' : 'flex'}`}>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Menu Modul
            </span>
            <button
              type="button"
              onClick={toggleAllGroups}
              title={isAllOpen ? 'Tutup semua accordion modul' : 'Buka semua accordion modul'}
              className="tactile-btn inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-800 border border-slate-200 hover:border-teal-300 shadow-2xs transition-all cursor-pointer select-none active:scale-95"
            >
              {isAllOpen ? (
                <>
                  <ChevronsUp className="w-3 h-3 text-slate-500" />
                  <span>Tutup Semua</span>
                </>
              ) : (
                <>
                  <ChevronsDown className="w-3 h-3 text-teal-600" />
                  <span>Buka Semua</span>
                </>
              )}
            </button>
          </div>

          {/* Accordion Groups */}
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(item => {
              if (item.managerOnly && currentRole !== 'MANAGER') return false;
              if (item.staffOnly && currentRole === 'MANAGER') return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            const isOpen = !!openGroups[group.id];
            const hasActiveItem = visibleItems.some(i => i.id === currentTab);
            const groupAlertCount = visibleItems.reduce((sum, itm) => sum + (badgeCounts ? (badgeCounts as any)[itm.id] || 0 : 0), 0);

            return (
              <div key={group.id} className="space-y-1">
                {/* Desktop Mini Mode Separator */}
                {isCollapsed && (
                  <div className="hidden lg:block w-full border-t border-slate-100 my-2" />
                )}

                {/* Accordion Group Header (Wide & Mobile) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  title={`${group.groupName} (${isOpen ? 'Klik untuk tutup modul' : 'Klik untuk buka modul'})`}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all duration-150 select-none tactile-btn cursor-pointer ${
                    isCollapsed ? 'lg:hidden' : 'flex'
                  } ${
                    hasActiveItem 
                      ? 'bg-teal-50/90 text-[#042f2e] font-extrabold border border-teal-300/80 shadow-2xs' 
                      : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 hover:text-slate-900 border border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      hasActiveItem 
                        ? 'bg-[#1E4648] text-teal-100 shadow-2xs' 
                        : 'bg-slate-200/90 text-slate-600'
                    }`}>
                      <group.icon className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-bold tracking-tight truncate">
                      {group.groupName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* If collapsed and has notifications inside, alert user with red badge */}
                    {!isOpen && groupAlertCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
                        {groupAlertCount > 99 ? '99+' : groupAlertCount}
                      </span>
                    )}
                    {/* Dedicated tactile toggle pill */}
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                      isOpen
                        ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                        : 'bg-white border-slate-200/90 text-slate-500 shadow-2xs'
                    }`}>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`} />
                    </div>
                  </div>
                </button>

                {/* Submenu Items with Tree Line Indentation */}
                <div className={`${
                  isCollapsed 
                    ? 'lg:block space-y-1' 
                    : isOpen 
                    ? `block ml-3 pl-2.5 my-1 space-y-0.5 border-l-2 ${hasActiveItem ? 'border-teal-300/80' : 'border-slate-200/80'}`
                    : 'hidden'
                }`}>
                  {visibleItems.map(item => renderNavButton(item, true))}
                </div>
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
