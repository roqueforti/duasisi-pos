'use client';

import React, { useState, useEffect } from 'react';
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

export default function HomePage() {
  const [currentRole, setCurrentRole] = useState<UserRole>('');
  const [currentTab, setCurrentTab] = useState<string>('transaksi');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [publicNotaParam, setPublicNotaParam] = useState<string | null>(null);
  const [publicNotaToken, setPublicNotaToken] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // Restore session & Setup 30-minute inactivity auto-expiration with interaction reset
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check existing session
    const payload = parseSessionToken();
    if (payload) {
      if (!isSessionIdleExpired()) {
        setCurrentRole(payload.role);
        setCurrentTab(payload.role === 'MANAGER' ? 'dashboard' : 'transaksi');
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
      // Throttle recording to once every 5 seconds to optimize performance
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const nota = params.get('nota');
      const t = params.get('t');
      if (nota || t) {
        setPublicNotaParam(nota || '');
        setPublicNotaToken(t);
      }
    }
  }, []);

  const handleLoginSuccess = (role: UserRole) => {
    setCurrentRole(role);
    setSessionNotice(null);
    if (role === 'MANAGER') {
      setCurrentTab('dashboard');
    } else {
      setCurrentTab('transaksi');
    }
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

  if (publicNotaParam) {
    return (
      <ENotaView
        noNota={publicNotaParam}
        token={publicNotaToken || undefined}
        onBackToApp={() => {
          setPublicNotaParam(null);
          setPublicNotaToken(null);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  return (
    <>
      {!currentRole ? (
        <LoginModal onSuccess={handleLoginSuccess} initialNotice={sessionNotice} />
      ) : (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 relative select-none">
          {/* Sidebar Navigation */}
          <Sidebar
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            currentRole={currentRole}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            onLogout={handleLogout}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            <Navbar
              currentTab={currentTab}
              currentRole={currentRole}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              onLogout={handleLogout}
              onRefresh={handleGlobalRefresh}
            />

            <main key={refreshKey} className="flex-1 overflow-y-auto bg-slate-50">
              {currentTab === 'dashboard' && <DashboardView currentRole={currentRole} />}
              {currentTab === 'transaksi' && <PosView currentRole={currentRole} />}
              {currentTab === 'riwayat' && <RiwayatView currentRole={currentRole} />}
              {currentTab === 'pesanan' && <PesananView />}
              {currentTab === 'absensi' && <AbsensiView />}
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
