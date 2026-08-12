'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import LoginModal from '@/components/LoginModal';
import PosView from '@/components/PosView';
import RiwayatView from '@/components/RiwayatView';
import AbsensiView from '@/components/AbsensiView';
import InventoryView from '@/components/InventoryView';
import MesinView from '@/components/MesinView';
import PegawaiView from '@/components/PegawaiView';
import ProdukView from '@/components/ProdukView';
import RekapView from '@/components/RekapView';
import ENotaView from '@/components/ENotaView';
import PelangganView from '@/components/PelangganView';
import DashboardView from '@/components/DashboardView';
import PesananView from '@/components/PesananView';
import { UserRole } from '@/lib/types';
import { clearBackendSession } from '@/lib/api';

export default function HomePage() {
  const [currentRole, setCurrentRole] = useState<UserRole>('');
  const [currentTab, setCurrentTab] = useState<string>('transaksi');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [publicNotaParam, setPublicNotaParam] = useState<string | null>(null);
  const [publicNotaToken, setPublicNotaToken] = useState<string | null>(null);

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

  const handleLoginSuccess = (role: UserRole, label: string) => {
    setCurrentRole(role);
    setCurrentTab('transaksi');
  };

  const handleLogout = () => {
    clearBackendSession();
    setCurrentRole('');
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
        <LoginModal onSuccess={handleLoginSuccess} />
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
            />

            <main className="flex-1 overflow-y-auto bg-slate-50">
              {currentTab === 'dashboard' && <DashboardView currentRole={currentRole} />}
              {currentTab === 'transaksi' && <PosView currentRole={currentRole} />}
              {currentTab === 'riwayat' && <RiwayatView currentRole={currentRole} />}
              {currentTab === 'pesanan' && <PesananView />}
              {currentTab === 'absensi' && <AbsensiView />}
              {currentTab === 'pelanggan' && <PelangganView currentRole={currentRole} />}
              {currentTab === 'inventory' && <InventoryView currentRole={currentRole} />}
              {currentTab === 'mesin' && <MesinView currentRole={currentRole} />}
              {currentTab === 'pegawai' && <PegawaiView />}
              {currentTab === 'produk' && <ProdukView />}
              {currentTab === 'rekap' && <RekapView />}
            </main>
          </div>
        </div>
      )}
    </>
  );
}
