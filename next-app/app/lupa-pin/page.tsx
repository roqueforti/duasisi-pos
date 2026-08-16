'use client';

import React, { useState } from 'react';
import { runBackend } from '@/lib/api';
import { KeyRound, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function LupaPinPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMsg('Masukkan alamat email yang valid.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    
    try {
      const res = await runBackend<{success: boolean, message: string}>('recoverPin', email);
      if (res && res.success) {
        setSuccess(true);
      } else {
        setErrorMsg(res?.message || 'Gagal memulihkan PIN.');
      }
    } catch (err: any) {
      setErrorMsg('Terjadi kesalahan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-[#B5C9C9]/30">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        
        {/* Decor */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#B5C9C9] to-transparent opacity-50" />
        
        <div className="mb-8 text-center space-y-2">
          <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700/50 shadow-inner">
            <KeyRound className="w-8 h-8 text-[#B5C9C9]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Pemulihan PIN</h1>
          <p className="text-sm text-slate-400">Masukkan email pemulihan Manager Anda</p>
        </div>

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-emerald-400 font-bold mb-1">Email Terkirim!</h3>
              <p className="text-sm text-emerald-500/80 leading-relaxed">
                PIN pemulihan telah dikirimkan ke alamat email Anda. Silakan cek kotak masuk atau folder spam.
              </p>
            </div>
            <Link 
              href="/"
              className="inline-flex items-center justify-center w-full mt-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg text-sm transition-all"
            >
              Kembali ke Halaman Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Manager Terdaftar</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@contoh.com"
                  autoFocus
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-950 text-white placeholder-slate-600 border border-slate-700 rounded-xl outline-none focus:border-[#B5C9C9] focus:ring-1 focus:ring-[#B5C9C9]/30 transition-all font-medium"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg text-center animate-in fade-in slide-in-from-top-1">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4 pt-2">
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#1E4648]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  'Kirim PIN Pemulihan'
                )}
              </button>

              <div className="text-center">
                <Link 
                  href="/"
                  className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Kembali ke Kasir
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
