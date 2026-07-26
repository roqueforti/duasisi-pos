'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import LoginModal from '@/components/LoginModal';
import SplashScreen from '@/components/SplashScreen';
import PosView from '@/components/PosView';
import RiwayatView from '@/components/RiwayatView';
import AbsensiView from '@/components/AbsensiView';
import InventoryView from '@/components/InventoryView';
import MesinView from '@/components/MesinView';
import PegawaiView from '@/components/PegawaiView';
import ProdukView from '@/components/ProdukView';
import RekapView from '@/components/RekapView';
import { UserRole } from '@/lib/types';

export default function HomePage() {
  const [showSplash, setShowSplash] = useState<boolean>(false);
  const [pendingRole, setPendingRole] = useState<{ role: UserRole; label: string } | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('');
  const [currentTab, setCurrentTab] = useState<string>('transaksi');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const handleLoginSuccess = (role: UserRole, label: string) => {
    setPendingRole({ role, label });
    setShowSplash(true);
  };

  const handleSplashFinish = () => {
    if (pendingRole) {
      setCurrentRole(pendingRole.role);
      if (pendingRole.role === 'MANAGER') {
        setCurrentTab('riwayat');
      } else {
        setCurrentTab('transaksi');
      }
    }
    setShowSplash(false);
  };

  const handleLogout = () => {
    setCurrentRole('');
    setPendingRole(null);
    setShowSplash(false);
  };

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}

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
              {currentTab === 'transaksi' && <PosView />}
              {currentTab === 'riwayat' && <RiwayatView />}
              {currentTab === 'absensi' && <AbsensiView />}
              {currentTab === 'inventory' && <InventoryView />}
              {currentTab === 'mesin' && <MesinView />}
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
