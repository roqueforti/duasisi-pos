import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Download, 
  Printer, 
  RefreshCw, 
  Bell, 
  CheckCheck, 
  AlertTriangle, 
  Package, 
  ClipboardList, 
  ShieldAlert, 
  Clock, 
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { UserRole } from '@/lib/types';
import PrinterModal from '@/components/PrinterModal';
import { getActiveDeviceInfo } from '@/lib/bluetoothPrinter';
import { useDialog } from '@/components/DialogProvider';
import { GlobalNotificationItem } from '@/lib/useGlobalNotifications';

interface NavbarProps {
  currentTab: string;
  currentRole: UserRole;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onRefresh?: () => void;
  onNavigate?: (tab: string) => void;
  notifications?: GlobalNotificationItem[];
  unreadCount?: number;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
}

const tabTitles: Record<string, string> = {
  transaksi: 'Point of Sale (POS)',
  riwayat: 'Riwayat Transaksi',
  pesanan: 'Manajemen Pesanan Drop-off',
  absensi: 'Presensi & Cuti',
  inventory: 'Stok Inventory Bahan',
  pegawai: 'Data Pegawai',
  payroll: 'Payroll & Penggajian',
  produk: 'Manajemen Layanan & Produk',
  kategori: 'Manajemen Kategori',
  langkah: 'Pipeline Langkah Pengerjaan',
  shift: 'Kas Shift & Serah Terima',
  rekap: 'Laporan Rekap & Analytics',
  menu: 'Menu Digital & Desain Poster',
  keamanan: 'Manajemen Keamanan & PIN',
  dashboard: 'Dashboard Outlet'
};

export default function Navbar({
  currentTab,
  currentRole,
  onToggleSidebar,
  onLogout,
  onRefresh,
  onNavigate,
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
}: NavbarProps) {
  const { showAlert } = useDialog();
  const [clockStr, setClockStr] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [printerConnected, setPrinterConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notif popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      await showAlert('Untuk menginstal PWA Dua SiSi POS:\n\n• Chrome/Edge: Klik titik tiga (⋮) → "Install DuaSiSi POS" atau "Add to Home Screen"\n• Safari iOS: Klik Share → "Add to Home Screen"', 'info', 'Cara Instalasi');
    }
  };

  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
      setIsRefreshing(true);
      setTimeout(() => {
        setIsRefreshing(false);
      }, 700);
    }
  };

  return (
    <>
      <header className="h-12 bg-white border-b border-slate-200/80 px-2 sm:px-3 md:px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial mr-2">
          <button
            className="lg:hidden text-slate-500 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0"
            onClick={onToggleSidebar}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-slate-600 truncate whitespace-nowrap max-w-[100px] xs:max-w-[150px] sm:max-w-none">
              {tabTitles[currentTab] || 'Dua SiSi POS'}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium hidden md:block truncate">Dashboard • {currentTab}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Bluetooth Thermal Printer Status & Config Button */}
          <button
            onClick={() => setIsPrinterModalOpen(true)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition border shrink-0 ${
              printerConnected
                ? 'bg-[#B5C9C9]/20 text-[#1E4648] border-[#B5C9C9] hover:bg-[#B5C9C9]/30'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Pengecekan Bluetooth & Setting Thermal Printer"
          >
            <div className="relative">
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                printerConnected ? 'bg-[#B5C9C9]/200' : 'bg-slate-400'
              }`} />
            </div>
            <span className="hidden md:inline">
              {printerConnected ? 'Printer Thermal (Terhubung)' : 'Cek Printer BT'}
            </span>
          </button>

          {/* Refresh Data Button */}
          {onRefresh && (
            <button
              onClick={handleRefreshClick}
              className={`flex items-center gap-1.5 border px-2 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                isRefreshing 
                  ? 'bg-[#B5C9C9]/20 text-[#1E4648] border-[#B5C9C9]' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'
              }`}
              title="Refresh / Muat Ulang Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1E4648]' : 'text-slate-500'}`} />
              <span className="hidden md:inline">{isRefreshing ? 'Memuat...' : 'Refresh Data'}</span>
            </button>
          )}

          {/* PWA Install Button */}
          <button
            onClick={handleInstallPWA}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 px-2 py-1 rounded-lg text-xs font-semibold transition shrink-0"
            title="Instal Aplikasi Dua SiSi POS ke HP/PC"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Install PWA App</span>
          </button>

          {/* Online Status */}
          {isOnline ? (
            <div className="hidden sm:flex items-center gap-1.5 text-[#1E4648] text-xs font-semibold px-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#B5C9C9]/200" />
              <span className="hidden md:inline">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold px-1.5 shrink-0">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Offline</span>
            </div>
          )}

          {/* Clock */}
          <div className="hidden lg:block text-xs text-slate-500 font-semibold px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-lg shrink-0">
            {clockStr || '00.00.00 WIB'}
          </div>

          {/* Global Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative p-1.5 rounded-lg border transition ${
                isNotifOpen || unreadCount > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200/80'
              }`}
              title="Notifikasi & Peringatan Operasional"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-xs animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Popover Dropdown */}
            {isNotifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 z-[300] text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-[#1E4648]" />
                    <h3 className="font-bold text-slate-800 text-xs">Pusat Notifikasi POS</h3>
                    {unreadCount > 0 && (
                      <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                        {unreadCount} baru
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && onMarkAllAsRead && (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-[10px] text-teal-700 hover:text-teal-900 font-bold hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="w-3 h-3" />
                      <span>Tandai Semua Dibaca</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <CheckCheck className="w-8 h-8 mx-auto mb-1.5 text-emerald-500 opacity-60" />
                      <p className="font-bold text-xs text-slate-600">Semua Operasional Lancar</p>
                      <p className="text-[10px] mt-0.5">Tidak ada stok kritis atau antrean yang butuh perhatian khusus.</p>
                    </div>
                  ) : (
                    notifications.map(n => {
                      const getCategoryIcon = () => {
                        if (n.category === 'inventory') return <Package className="w-3.5 h-3.5 text-amber-600" />;
                        if (n.category === 'pesanan') return <ClipboardList className="w-3.5 h-3.5 text-teal-600" />;
                        if (n.category === 'void') return <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />;
                        if (n.category === 'cuti') return <Clock className="w-3.5 h-3.5 text-indigo-600" />;
                        return <AlertTriangle className="w-3.5 h-3.5 text-slate-600" />;
                      };

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (onMarkAsRead) onMarkAsRead(n.id);
                            if (onNavigate && n.targetTab) {
                              onNavigate(n.targetTab);
                              setIsNotifOpen(false);
                            }
                          }}
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 hover:shadow-xs ${
                            n.type === 'error'
                              ? 'bg-rose-50/70 border-rose-200/80 hover:bg-rose-100/60'
                              : n.type === 'warning'
                              ? 'bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/60'
                              : 'bg-teal-50/60 border-teal-200/80 hover:bg-teal-100/50'
                          }`}
                        >
                          <div className="mt-0.5 p-1 rounded-lg bg-white shadow-2xs shrink-0">
                            {getCategoryIcon()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-bold text-slate-900 text-xs truncate">{n.title}</h4>
                              <span className="text-[9px] text-slate-400 font-semibold shrink-0">{n.timestamp}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{n.message}</p>
                            <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-black/5">
                              <span className="text-[9px] font-bold text-[#1E4648] flex items-center gap-0.5">
                                <span>Buka Menu {tabTitles[n.targetTab] || n.targetTab}</span>
                                <ChevronRight className="w-2.5 h-2.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 shrink-0">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xs shrink-0 ${
              currentRole === 'MANAGER' ? 'bg-[#FF9500]' : 'bg-[#1E4648]'
            }`}>
              {currentRole === 'MANAGER' ? 'M' : 'S'}
            </div>
            <span className="hidden md:inline text-xs font-bold text-slate-600">
              {currentRole === 'MANAGER' ? 'Manager' : 'Kasir 1'}
            </span>
            <button
              onClick={onLogout}
              title="Keluar Sesi"
              className="text-slate-400 hover:text-rose-600 transition p-1 sm:p-1.5 rounded-lg hover:bg-rose-50 shrink-0"
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
