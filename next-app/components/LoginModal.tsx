'use client';

import React, { useState } from 'react';
import { UserRole } from '@/lib/types';
import { runBackend } from '@/lib/api';
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
      const res = await runBackend('verifikasiPin', pinValue);
      if (res && res.success) {
        onSuccess(res.role as UserRole, res.label);
      } else {
        setErrorMsg(res?.message || 'PIN salah! Akses ditolak.');
        setPin('');
      }
    } catch (err: any) {
      // Local fallback verification if backend offline
      if (pinValue === '1234') {
        onSuccess('STAFF', 'Staff / Kasir');
      } else if (pinValue === '8888') {
        onSuccess('MANAGER', 'Manager / Owner');
      } else {
        setErrorMsg('PIN salah! Silakan coba lagi.');
        setPin('');
      }
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

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-outlet-login flex items-center justify-center p-4 transition-all duration-500"
    >
      <div className="bg-[#11292B] rounded-2xl p-8 text-center max-w-sm w-full border border-slate-700 shadow-2xl text-white">
        {/* Logo Header */}
        <div className="mb-6 flex items-center justify-center">
          <img 
            src="./assets/logo-full-white.svg" 
            alt="Dua SiSi Laundry Express & Coin" 
            className="h-10 w-auto brightness-0 invert"
          />
        </div>

        <div className="text-xs font-medium text-teal-200/90 mb-5 flex items-center justify-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-teal-400" />
          <span>Masukkan 4-digit PIN untuk masuk</span>
        </div>

        {errorMsg && (
          <div className="mb-4 text-xs font-semibold text-rose-300 bg-rose-950/80 p-2.5 rounded-xl border border-rose-700 animate-shake">
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
            className="w-full text-center text-3xl font-bold tracking-[14px] py-3.5 px-4 bg-slate-900 text-white placeholder-slate-500 border border-slate-700 rounded-xl outline-none focus:border-teal-400 focus:bg-slate-950 transition-all shadow-inner font-sans"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

