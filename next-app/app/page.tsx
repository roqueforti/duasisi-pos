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
import { UserRole } from '@/lib/types';

export default function HomePage() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentRole, setCurrentRole] = useState<UserRole>('');
  const [currentTab, setCurrentTab] = useState<string>('transaksi');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const handleLoginSuccess = (role: UserRole, label: string) => {
    setCurrentRole(role);
    if (role === 'MANAGER') {
      setCurrentTab('riwayat');
    } else {
      setCurrentTab('transaksi');
    }
  };

  const handleLogout = () => {
    setCurrentRole('');
  };

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

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
              {['pegawai', 'produk', 'rekap'].includes(currentTab) && (
                <div className="p-8 text-center text-slate-400">
                  <div className="text-4xl mb-2">📊</div>
                  <div className="text-sm font-bold text-slate-700">Fitur Manager Sedang Di-load...</div>
                  <div className="text-xs text-slate-400 mt-1">Khusus akun Manager/Owner</div>
                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </>
  );
}
