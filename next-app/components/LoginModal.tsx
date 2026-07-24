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
        setErrorMsg(res.message || 'PIN Akses tidak valid');
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
    <div className="fixed inset-0 z-[1000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-7 text-center max-w-xs w-full shadow-2xl animate-fade-in border border-slate-100">
        {/* Full Teal Logo */}
        <div className="h-14 px-3 mb-4 mx-auto flex items-center justify-center">
          <img 
            src="./assets/logo-full-teal.svg" 
            alt="Dua SiSi Laundry Express & Coin" 
            className="h-12 w-auto max-w-full"
          />
        </div>

        <div className="text-xs text-slate-500 mb-5">Masukkan PIN Keamanan untuk Masuk</div>

        {errorMsg && (
          <div className="mb-3 text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-xl border border-red-200">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="mb-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="• • • •"
            maxLength={6}
            className="w-full text-center text-2xl font-extrabold tracking-[8px] py-3 px-4 border border-slate-200 rounded-2xl outline-none focus:border-[#1E4648] focus:ring-4 focus:ring-teal-500/10"
            onKeyUp={(e) => {
              if (e.key === 'Enter') handleLogin();
            }}
            disabled={loading}
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading || !pin}
          className="w-full bg-[#1E4648] hover:bg-[#153334] text-white font-extrabold py-3 px-4 rounded-2xl text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{loading ? 'Memverifikasi...' : 'Masuk Aplikasi'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="mt-5 text-[11px] text-slate-400 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 text-left">
          💡 <strong>Default PIN:</strong>
          <br />• Staff / Kasir: <code className="font-bold text-slate-700">1234</code>
          <br />• Manager / Owner: <code className="font-bold text-slate-700">8888</code>
        </div>
      </div>
    </div>
  );
}
