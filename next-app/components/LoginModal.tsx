'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/lib/types';
import { runBackend, setBackendSession } from '@/lib/api';
import { KeyRound, Loader2, Clock, AlertTriangle } from 'lucide-react';

interface LoginModalProps {
  onSuccess: (role: UserRole, label: string) => void;
  initialNotice?: string | null;
}

export default function LoginModal({ onSuccess, initialNotice }: LoginModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState<string | null>(initialNotice || null);

  useEffect(() => {
    if (initialNotice) {
      setNotice(initialNotice);
    }
  }, [initialNotice]);

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

        {notice && !errorMsg && (
          <div className="mb-4 text-xs font-medium text-amber-200 bg-amber-950/80 border border-amber-500/40 p-3 rounded-lg flex items-start gap-2 text-left animate-fade-in shadow-sm">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">
              <span className="font-semibold block text-amber-300">Sesi Berakhir</span>
              {notice}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 text-xs font-semibold text-rose-300 bg-rose-950/80 p-2.5 rounded-lg border border-rose-700 animate-shake">
            {errorMsg}
          </div>
        )}

        {/* 4 Digit PIN Input (Auto-Verify on 4th Digit) */}
        <div className="mb-6 relative">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={handlePinChange}
            placeholder="• • • •"
            maxLength={4}
            autoFocus
            disabled={loading}
            className="w-full text-center text-3xl font-bold tracking-[14px] py-3.5 px-4 bg-slate-900 text-white placeholder-slate-500 border border-slate-700 rounded-lg outline-none focus:border-[#B5C9C9] focus:bg-slate-950 transition-all shadow-inner font-sans"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B5C9C9]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>


        {/* On-screen Numpad (tablet-friendly) */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  const next = pin + num;
                  if (next.length <= 4) {
                    setPin(next);
                    setErrorMsg('');
                    if (next.length === 4) processPinVerification(next);
                  }
                }}
                disabled={loading || pin.length >= 4}
                className="py-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-xl rounded-lg border border-slate-600 transition-all disabled:opacity-40 select-none"
              >
                {num}
              </button>
            ))}
            {/* Bottom row: clear left, 0 center, backspace right */}
            <button
              type="button"
              onClick={() => { setPin(''); setErrorMsg(''); }}
              disabled={loading}
              className="py-4 bg-slate-800 hover:bg-rose-900 active:bg-rose-800 text-rose-400 font-bold text-sm rounded-lg border border-slate-600 transition-all disabled:opacity-40 select-none"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => {
                const next = pin + '0';
                if (next.length <= 4) {
                  setPin(next);
                  setErrorMsg('');
                  if (next.length === 4) processPinVerification(next);
                }
              }}
              disabled={loading || pin.length >= 4}
              className="py-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-xl rounded-lg border border-slate-600 transition-all disabled:opacity-40 select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => { setPin((p) => p.slice(0, -1)); setErrorMsg(''); }}
              disabled={loading || pin.length === 0}
              className="py-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-bold text-xl rounded-lg border border-slate-600 transition-all disabled:opacity-40 select-none"
            >
              ⌫
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

