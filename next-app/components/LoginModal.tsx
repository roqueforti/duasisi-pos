'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/lib/types';
import { runBackend, setBackendSession, clearBackendSession } from '@/lib/api';
import { KeyRound, Loader2, Clock } from 'lucide-react';
import Link from 'next/link';

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
    // Clear any previous lockout keys
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('duasisi_pin_lockout_until');
        localStorage.removeItem('duasisi_pin_failed_count');
      } catch (e) {}
    }
  }, []);

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
      clearBackendSession();
      const res = await runBackend<{
        success: boolean;
        role?: UserRole;
        label?: string;
        message?: string;
        sessionToken?: string;
      }>('verifikasiPin', pinValue);

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
    if (val.length <= 6) {
      setPin(val);
      setErrorMsg('');
      if (val.length === 6) {
        processPinVerification(val);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pin.length >= 4 && !loading) {
      processPinVerification(pin);
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
      <div className="bg-[#11292B] rounded-2xl p-7 sm:p-8 text-center max-w-sm w-full border border-slate-700 shadow-2xl text-white backdrop-blur-md">
        {/* Logo Header */}
        <div className="mb-5 flex items-center justify-center">
          <img
            src="./assets/logo-full-white.svg"
            alt="Dua SiSi Laundry Express & Coin"
            className="h-10 w-auto brightness-0 invert"
          />
        </div>

        <div className="text-xs font-medium text-[#B5C9C9]/90 mb-4 flex items-center justify-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-[#B5C9C9]" />
          <span>Masukkan PIN Terminal POS (4 - 6 Digit)</span>
        </div>

        {notice && !errorMsg && (
          <div className="mb-4 text-xs font-medium text-amber-200 bg-amber-950/80 border border-amber-500/40 p-3 rounded-xl flex items-start gap-2 text-left animate-fade-in shadow-sm">
            <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">
              <span className="font-semibold block text-amber-300">Sesi Berakhir</span>
              {notice}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 text-xs font-semibold text-rose-300 bg-rose-950/80 p-2.5 rounded-xl border border-rose-700 animate-shake">
            {errorMsg}
          </div>
        )}

        {/* 4-6 Digit PIN Input (Auto-Verify on 6th Digit or Submit Button) */}
        <div className="mb-4 relative">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={handlePinChange}
            onKeyDown={handleKeyDown}
            placeholder="• • • • • •"
            maxLength={6}
            autoFocus
            disabled={loading}
            className="w-full text-center text-3xl font-bold tracking-[10px] py-3.5 px-4 bg-slate-900 text-white placeholder-slate-600 border border-slate-700 rounded-xl outline-hidden focus:border-[#B5C9C9] focus:bg-slate-950 transition-all shadow-inner font-sans"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B5C9C9]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>

        {/* On-screen Numpad (tablet & touch friendly) */}
        {!loading && (
          <div className="space-y-2.5 mb-2">
            <div className="grid grid-cols-3 gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    const next = pin + num;
                    if (next.length <= 6) {
                      setPin(next);
                      setErrorMsg('');
                      if (next.length === 6) processPinVerification(next);
                    }
                  }}
                  disabled={loading || pin.length >= 6}
                  className="py-3.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-xl rounded-xl border border-slate-700/80 transition-all disabled:opacity-40 select-none shadow-sm cursor-pointer"
                >
                  {num}
                </button>
              ))}
              {/* Bottom row: clear left, 0 center, backspace right */}
              <button
                type="button"
                onClick={() => {
                  setPin('');
                  setErrorMsg('');
                }}
                disabled={loading}
                className="py-3.5 bg-slate-800/90 hover:bg-rose-900 active:bg-rose-800 text-rose-400 font-bold text-sm rounded-xl border border-slate-700/80 transition-all disabled:opacity-40 select-none cursor-pointer"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = pin + '0';
                  if (next.length <= 6) {
                    setPin(next);
                    setErrorMsg('');
                    if (next.length === 6) processPinVerification(next);
                  }
                }}
                disabled={loading || pin.length >= 6}
                className="py-3.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-bold text-xl rounded-xl border border-slate-700/80 transition-all disabled:opacity-40 select-none shadow-sm cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => {
                  setPin((p) => p.slice(0, -1));
                  setErrorMsg('');
                }}
                disabled={loading || pin.length === 0}
                className="py-3.5 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-bold text-xl rounded-xl border border-slate-700/80 transition-all disabled:opacity-40 select-none cursor-pointer"
              >
                ⌫
              </button>
            </div>

            {/* Direct Submit Action Button (Active when >= 4 digits) */}
            <button
              type="button"
              onClick={() => processPinVerification(pin)}
              disabled={loading || pin.length < 4}
              className={`w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                pin.length >= 4
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-700 to-[#1E4648] text-white hover:brightness-110'
                  : 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <span>Masuk Terminal POS</span>
              <span>➔</span>
            </button>

            {/* Lupa PIN Link */}
            <div className="pt-2 text-center">
              <Link
                href="/lupa-pin"
                className="text-xs text-slate-400 hover:text-[#B5C9C9] transition-colors inline-flex items-center gap-1 font-medium hover:underline"
              >
                <span>Lupa PIN Manager?</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
