'use client';

import React, { useState } from 'react';
import { UserRole } from '@/lib/types';
import { runBackend, setBackendSession } from '@/lib/api';
import { KeyRound, ShieldCheck, Loader2 } from 'lucide-react';

interface LoginModalProps {
  onSuccess: (role: UserRole, label: string) => void;
}

export default function LoginModal({ onSuccess }: LoginModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const processPinVerification = async (pinValue: string) => {
    if (!pinValue || pinValue.length < 4 || loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await runBackend<{ success: boolean; role?: UserRole; label?: string; message?: string; sessionToken?: string }>('verifikasiPin', pinValue);
      if (res && res.success) {
        if (!res.role) throw new Error('Role pengguna tidak diterima');
        if (res.sessionToken) setBackendSession(res.sessionToken);
        onSuccess(res.role, res.label || res.role);
      } else {
        setErrorMsg(res?.message || 'PIN salah! Akses ditolak.');
        setPin('');
      }
    } catch {
      setErrorMsg('Tidak dapat memverifikasi login. Periksa koneksi lalu coba lagi.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 4) {
      setPin(val);
      setErrorMsg('');
      if (val.length === 4) {
        processPinVerification(val);
      }
    }
  };

  const bgImgUrl = '/assets/bg-outlet.jpeg';

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-outlet-login flex items-center justify-center p-4 transition-all duration-500"
      style={{
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.88)), url('${bgImgUrl}')`
      }}
    >
      <div className="bg-[#11292B] rounded-lg p-8 text-center max-w-sm w-full border border-slate-700 shadow-lg text-white">
        {/* Logo Header */}
        <div className="mb-6 flex items-center justify-center">
          <img 
            src="./assets/logo-full-white.svg" 
            alt="Dua SiSi Laundry Express & Coin" 
            className="h-10 w-auto brightness-0 invert"
          />
        </div>

        <div className="text-xs font-medium text-[#B5C9C9]/90 mb-5 flex items-center justify-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-[#B5C9C9]" />
          <span>Masukkan 4-digit PIN untuk masuk</span>
        </div>

        {errorMsg && (
          <div className="mb-4 text-xs font-semibold text-rose-300 bg-rose-950/80 p-2.5 rounded-lg border border-rose-700 animate-shake">
            {errorMsg}
          </div>
        )}

        {/* 4 Digit PIN Input (Auto-Verify on 4th Digit) */}
        <div className="mb-6 relative">
          <input
            type="password"
            value={pin}
            onChange={handlePinChange}
            placeholder="• • • •"
            maxLength={4}
            autoFocus
            disabled={loading}
            className="w-full text-center text-3xl font-bold tracking-[14px] py-3.5 px-4 bg-slate-900 text-white placeholder-slate-500 border border-slate-700 rounded-lg outline-none focus:border-[#B5C9C9]400 focus:bg-slate-950 transition-all shadow-inner font-sans"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B5C9C9]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

