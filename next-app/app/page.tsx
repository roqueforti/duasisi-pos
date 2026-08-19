'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import LoginModal from '@/components/LoginModal';
import PosView from '@/components/PosView';
import RiwayatView from '@/components/RiwayatView';
import AbsensiView from '@/components/AbsensiView';
import InventoryView from '@/components/InventoryView';
import PegawaiView from '@/components/PegawaiView';
import ProdukView from '@/components/ProdukView';
import RekapView from '@/components/RekapView';
import ENotaView from '@/components/ENotaView';
import PelangganView from '@/components/PelangganView';
import DashboardView from '@/components/DashboardView';
import PesananView from '@/components/PesananView';
import MenuGeneratorView from '@/components/MenuGeneratorView';
import KategoriView from '@/components/KategoriView';
import ShiftView from '@/components/ShiftView';
import LangkahView from '@/components/LangkahView';
import PayrollView from '@/components/PayrollView';
import KeamananView from '@/components/KeamananView';
import { UserRole } from '@/lib/types';
import { clearBackendSession, parseSessionToken, onSessionExpired, notifySessionExpired, isSessionIdleExpired, touchSessionActivity } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { useGlobalNotifications } from '@/lib/useGlobalNotifications';

const VALID_TABS = [
  'dashboard', 'transaksi', 'riwayat', 'pesanan', 'absensi',
  'pelanggan', 'inventory', 'pegawai', 'payroll', 'produk',
  'kategori', 'langkah', 'shift', 'menu', 'rekap', 'keamanan'
];

const MANAGER_ONLY_TABS = [
  'pegawai', 'payroll', 'produk', 'kategori', 'langkah',
  'shift', 'menu', 'rekap', 'keamanan'
];

function getValidInitialTab(savedTab: string | null, role: UserRole): string {
  const fallback = role === 'MANAGER' ? 'dashboard' : 'transaksi';
  if (!savedTab || !VALID_TABS.includes(savedTab)) return fallback;
  if (role === 'MANAGER' && savedTab === 'transaksi') return 'dashboard';
  if (role !== 'MANAGER' && MANAGER_ONLY_TABS.includes(savedTab)) return 'transaksi';
  return savedTab;
}

function PosAppRoot() {
  const [currentRole, setCurrentRole] = useState<UserRole>('');
  const [currentTab, setCurrentTab] = useState<string>('transaksi');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('duasisi_last_active_tab', tab);
      } catch (e) {}
    }
  };

  const {
    notifications,
    unreadCount,
    badgeCounts,
    markAsRead,
    markAllAsRead,
    refreshNotifications
  } = useGlobalNotifications(currentRole);

  // Restore session & Setup 30-minute inactivity auto-expiration with interaction reset
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check existing session
    const payload = parseSessionToken();
    if (payload) {
      if (!isSessionIdleExpired()) {
        setCurrentRole(payload.role);
        let savedTab: string | null = null;
        try {
          savedTab = localStorage.getItem('duasisi_last_active_tab');
        } catch (e) {}
        setCurrentTab(getValidInitialTab(savedTab, payload.role));
        touchSessionActivity();
      } else {
        notifySessionExpired('Sesi sebelumnya telah kedaluwarsa karena tidak ada aktivitas. Silakan masukkan PIN untuk melanjutkan.');
      }
    }

    // Subscribe to session expired events
    const unsubscribe = onSessionExpired((message) => {
      setCurrentRole('');
      setSessionNotice(message);
    });

    // Global interaction listeners to reset 30-minute idle countdown
    let lastTouch = 0;
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastTouch > 5000) {
        lastTouch = now;
        touchSessionActivity();
      }
    };

    const interactionEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    interactionEvents.forEach((ev) => window.addEventListener(ev, handleUserInteraction, { passive: true }));

    // Heartbeat checker to automatically detect expiration when tab is idle for 30 minutes
    const checkExpiration = () => {
      const activePayload = parseSessionToken();
      if (activePayload && isSessionIdleExpired()) {
        notifySessionExpired('Sesi Anda telah kedaluwarsa karena tidak ada aktivitas selama 30 menit. Silakan masukkan PIN kembali.');
      }
    };

    const interval = setInterval(checkExpiration, 15000);
    return () => {
      unsubscribe();
      interactionEvents.forEach((ev) => window.removeEventListener(ev, handleUserInteraction));
      clearInterval(interval);
    };
  }, []);

  const handleLoginSuccess = (role: UserRole) => {
    setCurrentRole(role);
    setSessionNotice(null);
    let savedTab: string | null = null;
    try {
      savedTab = localStorage.getItem('duasisi_last_active_tab');
    } catch (e) {}
    const initialTab = getValidInitialTab(savedTab, role);
    handleTabChange(initialTab);
  };

  const handleLogout = () => {
    clearBackendSession();
    clearCache();
    setCurrentRole('');
    setSessionNotice(null);
  };

  const handleGlobalRefresh = () => {
    clearCache();
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <>
      {!currentRole ? (
        <LoginModal onSuccess={handleLoginSuccess} initialNotice={sessionNotice} />
      ) : (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 relative select-none">
          {/* Sidebar Navigation */}
          <Sidebar
            currentTab={currentTab}
            setCurrentTab={handleTabChange}
            currentRole={currentRole}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            onLogout={handleLogout}
            badgeCounts={badgeCounts}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            <Navbar
              currentTab={currentTab}
              currentRole={currentRole}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              onLogout={handleLogout}
              onRefresh={() => {
                handleGlobalRefresh();
                refreshNotifications();
              }}
              onNavigate={(tab) => handleTabChange(tab)}
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
            />

            <main key={refreshKey} className="flex-1 overflow-y-auto bg-slate-50">
              {currentTab === 'dashboard' && <DashboardView currentRole={currentRole} />}
              {currentTab === 'transaksi' && <PosView currentRole={currentRole} />}
              {currentTab === 'riwayat' && <RiwayatView currentRole={currentRole} />}
              {currentTab === 'pesanan' && <PesananView />}
              {currentTab === 'absensi' && <AbsensiView currentRole={currentRole} />}
              {currentTab === 'pelanggan' && <PelangganView currentRole={currentRole} />}
              {currentTab === 'inventory' && <InventoryView currentRole={currentRole} />}
              {currentTab === 'pegawai' && <PegawaiView currentRole={currentRole} />}
              {currentTab === 'payroll' && <PayrollView currentRole={currentRole} />}
              {currentTab === 'produk' && <ProdukView currentRole={currentRole} />}
              {currentTab === 'kategori' && <KategoriView currentRole={currentRole} />}
              {currentTab === 'langkah' && <LangkahView currentRole={currentRole} />}
              {currentTab === 'shift' && <ShiftView currentRole={currentRole} />}

              {currentTab === 'menu' && <MenuGeneratorView />}
              {currentTab === 'rekap' && <RekapView />}
              {currentTab === 'keamanan' && <KeamananView currentRole={currentRole} />}
            </main>
          </div>
        </div>
      )}
    </>
  );
}

function PageDispatcher() {
  const searchParams = useSearchParams();
  const publicNotaParam = searchParams.get('nota');
  const publicNotaToken = searchParams.get('t');

  // If there's an E-Nota token or nota param, render ONLY ENotaView without touching login or POS app
  if (publicNotaParam || publicNotaToken) {
    return (
      <ENotaView
        noNota={publicNotaParam || ''}
        token={publicNotaToken || undefined}
        onBackToApp={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }}
      />
    );
  }

  return <PosAppRoot />;
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mb-3" />
        <span className="text-xs font-semibold text-slate-400">Memuat Dua SiSi POS...</span>
      </div>
    }>
      <PageDispatcher />
    </Suspense>
  );
}
