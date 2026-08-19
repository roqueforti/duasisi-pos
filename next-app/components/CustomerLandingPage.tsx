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
  Lock
} from 'lucide-react';
import GradientWaves from '@/components/GradientWaves';
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
        setSearchError(res?.message || `Nota "${query}" tidak ditemukan. Pastikan format nomor nota sesuai (Contoh: LDY-260819-0001).`);
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
      <div className="relative">
        <div className="fixed top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => setFoundTx(null)}
            className="bg-black/80 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg cursor-pointer backdrop-blur-md"
          >
            ← Kembali ke Beranda
          </button>
        </div>
        <ENotaView noNota={foundTx.noNota} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C1E20] text-slate-100 relative selection:bg-teal-500 selection:text-white overflow-x-hidden font-sans">
      {/* Dynamic Ambient Background Waves */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-80">
        <GradientWaves
          horizonColor="#0E2829"
          waveColor="#2E6F73"
          crestColor="#AEE2DC"
          speed={0.3}
          amplitude={2.2}
          waveScale={0.6}
          waveRatio={0.9}
          swell={32}
          turbulence={18}
          tilt={1.11}
          zoom={1.0}
          height={5.5}
          fogDepth={16}
          detail="medium"
          brightness={1.0}
          opacity={0.9}
          mouseInteraction={true}
          parallaxStrength={0.4}
          grain={true}
          grainIntensity={0.04}
        />
      </div>

      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navigation Bar */}
        <header className="w-full border-b border-teal-800/40 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shadow-md">
                <img
                  src="/assets/logo-full-black.svg"
                  alt="Dua SiSi"
                  className="h-5 w-auto"
                />
              </div>
              <div>
                <span className="font-black text-sm tracking-wide text-white">DUA SISI LAUNDRY</span>
                <span className="hidden sm:inline-block text-[10px] text-teal-300 font-medium ml-2 px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-700/50">
                  Express & Self Service
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/6289682020699"
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp CS</span>
              </a>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-950/80 border border-teal-500/40 text-teal-300 text-xs font-semibold mb-6 backdrop-blur-sm shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Portal Pelanggan Resmi Dua SiSi Laundry</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white max-w-2xl leading-tight mb-4">
            Cucian Bersih, Cepat, & Terpantau Secara Real-Time.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mb-8 leading-relaxed">
            Layanan Drop Off & Self Service Coin Laundry modern di Malang. Cek status pengerjaan cucian Anda atau unduh E-Nota resmi di sini.
          </p>

          {/* Search Box Card */}
          <div className="w-full max-w-lg bg-slate-900/90 border border-teal-600/40 backdrop-blur-xl p-5 sm:p-6 rounded-2xl shadow-2xl mb-12 text-left">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-teal-400" />
                <span>Lacak Status Cucian / E-Nota</span>
              </label>
              <span className="text-[10px] text-slate-400">Contoh: LDY-260819-0001</span>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={searchNota}
                onChange={(e) => setSearchNota(e.target.value)}
                placeholder="Ketik Nomor Nota..."
                className="flex-1 bg-slate-950/90 border border-slate-700 focus:border-teal-400 text-white font-mono text-sm px-4 py-3 rounded-xl outline-hidden transition placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-[#1E4648] hover:bg-[#285e61] text-white font-bold text-xs px-5 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 shrink-0 border border-teal-500/30"
              >
                {searching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mencari...</span>
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
              <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Service Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left mb-12">
            <div className="bg-slate-900/70 border border-teal-800/40 backdrop-blur-md p-5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 mb-3">
                <Shirt className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-sm text-white mb-1">Drop Off Service</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tinggal serahkan pakaian, staf kami akan mencuci, mengeringkan, dan menyetrika dengan rapi. Estimasi selesai tepat waktu.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-teal-800/40 backdrop-blur-md p-5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 mb-3">
                <Coins className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-sm text-white mb-1">Self Service Coin</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cuci dan keringkan pakaian secara mandiri dengan mesin berkapasitas besar. Bersih maksimal dan selesai dalam 60 menit.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-teal-800/40 backdrop-blur-md p-5 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-sm text-white mb-1">E-Nota & Poin Reward</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Struk digital resmi tersimpan di cloud, bebas hilang, dan kumpulkan poin loyalitas untuk diskon atau layanan gratis.
              </p>
            </div>
          </div>

          {/* Outlet Info & Location Card */}
          <div className="w-full bg-slate-900/80 border border-teal-800/50 backdrop-blur-md rounded-2xl p-6 text-left flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="text-xs font-bold text-teal-400 uppercase tracking-wider">Lokasi & Fasilitas Outlet</div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Dua SiSi Laundry Malang</span>
              </h2>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Jl. Pangestu Raya, Kasin, Ampeldento, Kec. Karang Ploso, Kabupaten Malang, Jawa Timur 65152 (Belakang Kampus UMM 3)
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-teal-200 pt-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>07.00 - 22.00 WIB (Buka Setiap Hari)</span>
                </span>
                <span className="flex items-center gap-1.5">
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
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Petunjuk Arah</span>
              </a>
              <a
                href="https://wa.me/6289682020699"
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Hubungi CS</span>
              </a>
            </div>
          </div>
        </main>

        {/* Footer with Discreet Staff Portal Link */}
        <footer className="w-full border-t border-teal-900/40 bg-slate-950/80 backdrop-blur-md py-6 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              © {new Date().getFullYear()} Dua SiSi Laundry. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/terminal-pos-internal"
                className="text-slate-600 hover:text-slate-400 transition flex items-center gap-1 text-[11px]"
                title="Akses Kasir / Staff"
              >
                <Lock className="w-3 h-3" />
                <span>Portal Kasir POS</span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
