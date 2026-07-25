'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { UserRole } from '@/lib/types';
import { runBackend } from '@/lib/api';

interface LoginModalProps {
  onSuccess: (role: UserRole, label: string) => void;
}

export default function LoginModal({ onSuccess }: LoginModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!pin) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await runBackend('verifikasiPin', pin);
      if (res.success) {
        onSuccess(res.role as UserRole, res.label);
      } else {
        setErrorMsg(res.message || 'PIN tidak valid');
        setPin('');
      }
    } catch (err: any) {
      setErrorMsg('Gagal terhubung ke server');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 transition-all duration-500"
      style={{ backgroundImage: `linear-gradient(rgba(15, 30, 32, 0.72), rgba(15, 30, 32, 0.85)), url('./assets/bg-outlet.png')` }}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-7 text-center max-w-sm w-full border border-white/40 shadow-2xl animate-fade-in">
        {/* Logo */}
        <div className="mb-5 flex items-center justify-center">
          <img 
            src="./assets/logo-full-teal.svg" 
            alt="Dua SiSi Laundry Express & Coin" 
            className="h-10 w-auto"
          />
        </div>

        <div className="text-xs text-slate-500 mb-5">Masukkan PIN untuk masuk</div>

        {errorMsg && (
          <div className="mb-3 text-[11px] font-medium text-red-600 bg-red-50 p-2 rounded-md border border-red-200">
            {errorMsg}
          </div>
        )}

        <div className="mb-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="• • • •"
            maxLength={6}
            className="w-full text-center text-2xl font-bold tracking-[8px] py-3 px-4 border border-slate-200 rounded-lg outline-none focus:border-[#1E4648]"
            onKeyUp={(e) => { if (e.key === 'Enter') handleLogin(); }}
            disabled={loading}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !pin}
          className="w-full bg-[#1E4648] hover:bg-[#153334] text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{loading ? 'Memverifikasi...' : 'Masuk'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="mt-4 text-[11px] text-slate-400 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 text-left">
          <strong className="text-slate-500">Default PIN:</strong>
          <br />• Staff / Kasir: <code className="font-semibold text-slate-700">1234</code>
          <br />• Manager / Owner: <code className="font-semibold text-slate-700">8888</code>
        </div>
      </div>
    </div>
  );
}
