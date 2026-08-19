'use client';

import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Wifi,
  Shirt,
  Coins,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  RefreshCw,
  Lock,
  FileText,
  User,
  Calendar,
  Layers
} from 'lucide-react';
import MoltenMetal from '@/components/MoltenMetal';
import { runBackend } from '@/lib/api';
import { Transaksi } from '@/lib/types';
import ENotaView from '@/components/ENotaView';

export default function CustomerLandingPage() {
  const [searchNota, setSearchNota] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>('');
  const [foundTx, setFoundTx] = useState<Transaksi | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchNota.trim().toUpperCase();
    if (!query) {
      setSearchError('Silakan masukkan nomor nota Anda.');
      return;
    }

    setSearching(true);
    setSearchError('');
    setFoundTx(null);

    try {
      const res = await runBackend<{ success?: boolean; transaksi?: Transaksi; message?: string }>(
        'getTransaksiByNota',
        query,
        ''
      );

      if (res?.success && res.transaksi) {
        setFoundTx(res.transaksi);
      } else {
        setSearchError(
          res?.message ||
            `Nota "${query}" tidak ditemukan. Pastikan format nomor nota sesuai (Contoh: LDY-260819-0001).`
        );
      }
    } catch (err) {
      setSearchError('Gagal memuat status cucian. Silakan periksa koneksi internet Anda.');
    } finally {
      setSearching(false);
    }
  };

  // If user searched and wants to view the full e-nota
  if (foundTx) {
    return (
      <div className="relative min-h-screen bg-[#0C1E20]">
        <div className="fixed top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => setFoundTx(null)}
            className="bg-white/90 hover:bg-white text-slate-900 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xl cursor-pointer backdrop-blur-md"
          >
            ← Kembali ke Beranda
          </button>
        </div>
        <ENotaView noNota={foundTx.noNota} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061415] text-white relative selection:bg-teal-400 selection:text-slate-950 overflow-x-hidden font-sans">
      {/* Dynamic MoltenMetal Ambient Background (Dua SiSi Fluid Teal Theme) */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-85">
        <MoltenMetal
          color1="#07191B"
          color2="#1F696E"
          color3="#9DF3E9"
          speed={0.3}
          scale={3.5}
          detail={3}
          glow={1.6}
          coreSize={0.1}
          swirl={1}
          fold={-0.2}
          blackPoint={0.05}
          brightness={1.25}
          colorMode="molten"
          grain={true}
          grainIntensity={0.04}
          mouseInteraction={true}
          mouseStrength={0.3}
          opacity={0.9}
        />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navigation Bar */}
        <header className="w-full border-b border-teal-500/20 bg-slate-950/75 backdrop-blur-xl sticky top-0 z-30 shadow-lg">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md">
                <img
                  src="/assets/logo-full-black.svg"
                  alt="Dua SiSi"
                  className="h-5 w-auto"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-wide text-white">DUA SISI LAUNDRY</span>
                <span className="text-[10px] text-teal-300 font-medium">Express & Self Service Coin</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href="https://wa.me/6289682020699"
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp CS</span>
              </a>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex flex-col items-center justify-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-950/90 border border-teal-400/40 text-teal-200 text-xs font-semibold mb-6 backdrop-blur-md shadow-lg">
            <Sparkles className="w-3.5 h-3.5 text-teal-300" />
            <span>Portal Resmi Pelanggan Dua SiSi Laundry</span>
          </div>

          {/* High-Contrast Crisp Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-3xl leading-[1.15] mb-5 drop-shadow-md">
            Cucian Bersih, Cepat, & Terpantau{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-teal-300 to-emerald-300">
              Secara Real-Time
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-200 max-w-2xl mb-8 leading-relaxed font-medium drop-shadow-xs">
            Layanan Drop Off & Self Service Coin Laundry modern di Malang. Masukkan nomor nota Anda di bawah untuk mengecek status pencucian atau unduh E-Nota resmi.
          </p>

          {/* Search Box Card */}
          <div className="w-full max-w-xl bg-slate-950/80 border border-teal-500/40 backdrop-blur-2xl p-5 sm:p-6 rounded-2xl shadow-2xl mb-12 text-left ring-1 ring-teal-500/20">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-4 h-4 text-teal-400" />
                <span>Lacak Status Cucian / E-Nota</span>
              </label>
              <span className="text-[10px] font-mono text-teal-400/80 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/60">
                Contoh: LDY-260819-0001
              </span>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchNota}
                  onChange={(e) => setSearchNota(e.target.value)}
                  placeholder="Ketik Nomor Nota..."
                  className="w-full bg-slate-900/90 border border-slate-700 focus:border-teal-400 text-white font-mono text-sm px-4 py-3 rounded-xl outline-hidden transition placeholder:text-slate-500 shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 shrink-0 border border-teal-400/30"
              >
                {searching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengecek...</span>
                  </>
                ) : (
                  <>
                    <span>Cek Nota</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {searchError && (
              <div className="mt-3.5 p-3 rounded-xl bg-rose-950/90 border border-rose-600/60 text-rose-100 text-xs flex items-start gap-2.5 shadow-md">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{searchError}</span>
              </div>
            )}
          </div>

          {/* Service Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left mb-12">
            <div className="bg-slate-950/70 border border-teal-800/50 backdrop-blur-xl p-5 rounded-2xl shadow-xl hover:border-teal-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 mb-3 shadow-inner">
                <Shirt className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-sm text-white mb-1.5">Drop Off Service</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tinggal serahkan pakaian, staf kami mencuci, mengeringkan, dan menyetrika dengan rapi. Pilihan Reguler, Express, atau Kilat.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-teal-800/50 backdrop-blur-xl p-5 rounded-2xl shadow-xl hover:border-teal-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 mb-3 shadow-inner">
                <Coins className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-sm text-white mb-1.5">Self Service Coin</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cuci & keringkan pakaian secara mandiri dengan mesin kapasitas besar. Higienis 1 mesin 1 pelanggan, selesai 60 menit.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-teal-800/50 backdrop-blur-xl p-5 rounded-2xl shadow-xl hover:border-teal-500/50 transition">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 mb-3 shadow-inner">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-sm text-white mb-1.5">E-Nota & Poin Reward</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bukti transaksi digital resmi anti hilang, dapat diunduh PDF/PNG, serta dapatkan poin cashback diskon tiap transaksi.
              </p>
            </div>
          </div>

          {/* Outlet Info & Location Card */}
          <div className="w-full bg-slate-950/80 border border-teal-700/50 backdrop-blur-2xl rounded-2xl p-6 sm:p-7 text-left flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Lokasi & Fasilitas Outlet</span>
              </div>
              <h2 className="text-base font-bold text-white">
                Dua SiSi Laundry Malang
              </h2>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Jl. Pangestu Raya, Kasin, Ampeldento, Kec. Karang Ploso, Kabupaten Malang, Jawa Timur 65152 (Belakang Kampus UMM 3)
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-teal-200 pt-1">
                <span className="flex items-center gap-1.5 bg-teal-950/80 px-2.5 py-1 rounded-lg border border-teal-800/60">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>07.00 - 22.00 WIB (Buka Setiap Hari)</span>
                </span>
                <span className="flex items-center gap-1.5 bg-teal-950/80 px-2.5 py-1 rounded-lg border border-teal-800/60">
                  <Wifi className="w-3.5 h-3.5 text-teal-400" />
                  <span>Free WiFi: DuaSisiLaundry (Pass: datanglagi)</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto shrink-0">
              <a
                href="https://maps.google.com/?q=Dua+SiSi+Laundry+Malang"
                target="_blank"
                rel="noreferrer"
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-600 shadow-md"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Petunjuk Arah</span>
              </a>
              <a
                href="https://wa.me/6289682020699"
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Hubungi CS</span>
              </a>
            </div>
          </div>
        </main>

        {/* Footer with Discreet Staff Portal Link */}
        <footer className="w-full border-t border-teal-900/40 bg-slate-950/90 backdrop-blur-md py-6 text-center text-xs text-slate-400">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              © {new Date().getFullYear()} Dua SiSi Laundry. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/terminal-pos-internal"
                className="text-slate-400 hover:text-teal-300 transition flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded bg-slate-900/80 border border-slate-800"
                title="Akses Kasir / Staff"
              >
                <Lock className="w-3 h-3 text-teal-400" />
                <span>Portal Kasir POS</span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
