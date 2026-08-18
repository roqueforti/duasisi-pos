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
  UserCheck
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
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  managerOnly?: boolean;
  staffOnly?: boolean;
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
  badgeCounts
}: SidebarProps) {
  const { showAlert } = useDialog();
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
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = async (tabKey: string) => {
    if (tabKey === 'transaksi' && currentRole === 'MANAGER') {
      await showAlert('Fitur POS Kasir hanya untuk Staff/Kasir', 'warning');
      return;
    }
    if (['pegawai', 'payroll', 'produk', 'kategori', 'shift', 'rekap', 'keamanan', 'menu', 'langkah'].includes(tabKey) && currentRole !== 'MANAGER') {
      await showAlert('Akses Ditolak — Khusus Manager/Owner', 'error');
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
        { id: 'transaksi', label: 'POS Kasir', icon: ShoppingCart, staffOnly: true },
        { id: 'pesanan', label: 'Pesanan Drop-off', icon: ClipboardList },
        { id: 'riwayat', label: 'Riwayat Transaksi', icon: History },
        { id: 'pelanggan', label: 'Data Pelanggan', icon: Users }
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
        { id: 'absensi', label: 'Presensi & Cuti', icon: Clock },
        { id: 'shift', label: 'Kas Shift & Serah Terima', icon: Coins, managerOnly: true },
        { id: 'pegawai', label: 'Data Pegawai', icon: UserCheck, managerOnly: true },
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

  const navClass = (tabKey: string) => {
    const isActive = currentTab === tabKey;
    return `w-full text-left flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'} rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
      isActive 
        ? 'bg-[#1E4648] text-white font-bold shadow-xs' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;
  };

  const iconClass = (tabKey: string) => {
    return currentTab === tabKey ? 'text-white' : 'text-slate-400 group-hover:text-slate-600';
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
        isCollapsed ? 'lg:w-[68px]' : 'lg:w-60'
      } ${isSidebarOpen ? 'w-60 translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Header Logo & Minimize */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3 py-4 px-2 border-b border-slate-100">
            <img 
              src="./assets/Asset 5.svg" 
              alt="Dua SiSi" 
              className="h-8 w-8 object-contain"
            />
            <button
              onClick={() => setIsCollapsed(false)}
              className="hidden lg:flex text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              title="Perluas Sidebar"
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
                className="hidden lg:flex text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                title="Kecilkan Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button 
                className="lg:hidden text-slate-400 hover:text-slate-600 p-1.5"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* User Role Badge */}
        <div className={`px-3.5 py-3 border-b border-slate-100 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs ${
            currentRole === 'MANAGER' ? 'bg-[#FF9500]' : 'bg-[#1E4648]'
          }`}>
            {currentRole === 'MANAGER' ? 'M' : 'S'}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">
                {currentRole === 'MANAGER' ? 'Manager Outlet' : 'Kasir / Staff'}
              </div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {currentRole === 'MANAGER' ? 'Owner / Manager' : 'Staff On Duty'}
              </div>
            </div>
          )}
        </div>

        {/* Grouped Navigation Menu */}
        <nav className="flex-1 px-3 py-3 space-y-4">
          {navGroups.map((group, gIdx) => {
            // Filter items visible to the current role
            const visibleItems = group.items.filter(item => {
              if (item.managerOnly && currentRole !== 'MANAGER') return false;
              if (item.staffOnly && currentRole === 'MANAGER') return false;
              return true;
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1">
                {!isCollapsed ? (
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2.5 pb-1">
                    {group.groupName}
                  </div>
                ) : (
                  <div className="w-full border-t border-slate-100 my-2" />
                )}

                {visibleItems.map(item => {
                  const IconComp = item.icon;
                  const isActive = currentTab === item.id;
                  const count = badgeCounts ? (badgeCounts as any)[item.id] || 0 : 0;

                  return (
                    <button
                      key={item.id}
                      className={navClass(item.id)}
                      onClick={() => handleNavClick(item.id)}
                      title={item.label}
                    >
                      <div className="relative shrink-0">
                        <IconComp className={`w-4 h-4 transition-colors ${iconClass(item.id)}`} />
                        {isCollapsed && count > 0 && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                        )}
                      </div>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                      {!isCollapsed && count > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white shadow-2xs animate-pulse shrink-0">
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                      {!isCollapsed && isActive && count === 0 && (
                        <ChevronRight className="w-3.5 h-3.5 ml-auto text-teal-200" />
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
            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'} rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors`}
          >
            <LogOut className="w-4 h-4 shrink-0 text-rose-500" />
            {!isCollapsed && <span>Keluar Sesi</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
