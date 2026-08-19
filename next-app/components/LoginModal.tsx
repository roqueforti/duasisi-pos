'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/lib/types';
import { runBackend, setBackendSession, clearBackendSession } from '@/lib/api';
import { KeyRound, Loader2, Clock, ShieldAlert, Lock } from 'lucide-react';

interface LoginModalProps {
  onSuccess: (role: UserRole, label: string) => void;
  initialNotice?: string | null;
}

const STORAGE_LOCKOUT_KEY = 'duasisi_pin_lockout_until';
const STORAGE_FAILED_KEY = 'duasisi_pin_failed_count';
const MAX_ATTEMPTS = 5;

export default function LoginModal({ onSuccess, initialNotice }: LoginModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState<string | null>(initialNotice || null);
  const [lockoutRemainingSecs, setLockoutRemainingSecs] = useState<number>(0);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  // Check initial lockout on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkLockout = () => {
      const storedLockout = localStorage.getItem(STORAGE_LOCKOUT_KEY);
      if (storedLockout) {
        const lockoutTime = Number(storedLockout);
        const now = Date.now();
        if (lockoutTime > now) {
          setLockoutRemainingSecs(Math.ceil((lockoutTime - now) / 1000));
        } else {
          localStorage.removeItem(STORAGE_LOCKOUT_KEY);
          localStorage.removeItem(STORAGE_FAILED_KEY);
          setLockoutRemainingSecs(0);
          setAttemptsLeft(MAX_ATTEMPTS);
        }
      }
    };

    checkLockout();
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutRemainingSecs <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemainingSecs((prev) => {
        if (prev <= 1) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_LOCKOUT_KEY);
            localStorage.removeItem(STORAGE_FAILED_KEY);
          }
          setAttemptsLeft(MAX_ATTEMPTS);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemainingSecs]);

  useEffect(() => {
    if (initialNotice) {
      setNotice(initialNotice);
    }
  }, [initialNotice]);

  const processPinVerification = async (pinValue: string) => {
    if (!pinValue || pinValue.length < 4 || loading || lockoutRemainingSecs > 0) return;
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
        locked?: boolean;
        lockoutUntil?: number;
        attemptsLeft?: number;
      }>('verifikasiPin', pinValue);

      if (res && res.success) {
        if (!res.role) throw new Error('Role pengguna tidak diterima');
        if (res.sessionToken) setBackendSession(res.sessionToken);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_LOCKOUT_KEY);
          localStorage.removeItem(STORAGE_FAILED_KEY);
        }
        onSuccess(res.role, res.label || res.role);
      } else {
        // Handle lockout or failed attempt
        if (res?.locked && res.lockoutUntil) {
          const secs = Math.ceil((res.lockoutUntil - Date.now()) / 1000);
          setLockoutRemainingSecs(secs);
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_LOCKOUT_KEY, String(res.lockoutUntil));
          }
          setErrorMsg('Akses login dikunci selama 15 menit karena terlalu banyak percobaan salah.');
        } else {
          // Client-side fail tracker fallback
          const currentFails = (Number(localStorage.getItem(STORAGE_FAILED_KEY)) || 0) + 1;
          localStorage.setItem(STORAGE_FAILED_KEY, String(currentFails));
          const left = res?.attemptsLeft !== undefined ? res.attemptsLeft : Math.max(0, MAX_ATTEMPTS - currentFails);
          setAttemptsLeft(left);

          if (left <= 0) {
            const lockTime = Date.now() + 15 * 60 * 1000;
            localStorage.setItem(STORAGE_LOCKOUT_KEY, String(lockTime));
            setLockoutRemainingSecs(15 * 60);
            setErrorMsg('Akses login dikunci selama 15 menit karena 5x salah PIN.');
          } else {
            setErrorMsg(res?.message || `PIN salah! Sisa kesempatan: ${left} kali.`);
          }
        }
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
    if (lockoutRemainingSecs > 0) return;
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 4) {
      setPin(val);
      setErrorMsg('');
      if (val.length === 4) {
        processPinVerification(val);
      }
    }
  };

  const formatLockoutTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const bgImgUrl = '/assets/bg-outlet.jpeg';
  const isLocked = lockoutRemainingSecs > 0;

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
          <span>Masukkan 4-digit PIN Terminal POS</span>
        </div>

        {/* Lockout Active Banner */}
        {isLocked ? (
          <div className="mb-5 p-4 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-100 text-left shadow-lg animate-pulse">
            <div className="flex items-center gap-2 font-bold text-rose-300 mb-1 text-xs">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Akses Login Dikunci Sementara</span>
            </div>
            <p className="text-[11px] text-rose-200 leading-snug mb-2">
              Terlalu banyak percobaan PIN salah (5x). Demi keamanan data outlet, silakan tunggu sebelum mencoba kembali.
            </p>
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-rose-900/80 border border-rose-600/60 font-mono font-black text-lg text-white">
              <Lock className="w-4 h-4 text-rose-300" />
              <span>{formatLockoutTimer(lockoutRemainingSecs)}</span>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* 4 Digit PIN Input (Auto-Verify on 4th Digit) */}
        <div className="mb-5 relative">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={handlePinChange}
            placeholder="• • • •"
            maxLength={4}
            autoFocus
            disabled={loading || isLocked}
            className="w-full text-center text-3xl font-bold tracking-[14px] py-3.5 px-4 bg-slate-900 text-white placeholder-slate-600 border border-slate-700 rounded-xl outline-hidden focus:border-[#B5C9C9] focus:bg-slate-950 transition-all shadow-inner font-sans disabled:opacity-30"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B5C9C9]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>

        {/* On-screen Numpad (tablet & touch friendly) */}
        {!loading && !isLocked && (
          <div className="grid grid-cols-3 gap-2.5 mb-2">
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
                if (next.length <= 4) {
                  setPin(next);
                  setErrorMsg('');
                  if (next.length === 4) processPinVerification(next);
                }
              }}
              disabled={loading || pin.length >= 4}
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
        )}

        {/* Security Footer Notice */}
        <div className="text-[10.5px] text-slate-400 text-center mt-4">
          Proteksi keamanan PIN aktif • Maksimal 5x percobaan salah
        </div>
      </div>
    </div>
  );
}
