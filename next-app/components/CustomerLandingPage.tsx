'use client';

import React, { useState } from 'react';
import {
  Search,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  MessageCircle,
  MapPin,
  Clock,
  Wifi,
  Lock,
  ExternalLink
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
      setSearchError('Masukkan nomor nota Anda (Contoh: LDY-260819-0001)');
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
            `Nota "${query}" tidak ditemukan. Pastikan format nomor nota sesuai.`
        );
      }
    } catch (err) {
      setSearchError('Gagal memuat status cucian. Periksa koneksi Anda.');
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
            className="bg-white hover:bg-slate-100 text-black px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shadow-2xl cursor-pointer"
          >
            ← Kembali ke Beranda
          </button>
        </div>
        <ENotaView noNota={foundTx.noNota} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061113] text-white relative selection:bg-white selection:text-black overflow-x-hidden font-sans flex flex-col justify-between">
      {/* Dynamic Molten Metal Ambient Background (Teal/Emerald Fluid) */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-80">
        <MoltenMetal
          color1="#061618"
          color2="#185257"
          color3="#9EECE3"
          speed={0.3}
          scale={3.8}
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
          opacity={0.85}
        />
      </div>

      {/* 1. Ultra-Clean Floating Pill Navbar */}
      <header className="relative z-20 w-full pt-4 sm:pt-6 px-4">
        <div className="max-w-4xl mx-auto rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-2xl px-5 py-3 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 shadow-md">
              <img
                src="/assets/logo-full-black.svg"
                alt="Dua SiSi"
                className="h-4 w-auto filter brightness-0"
              />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">Dua SiSi Laundry</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://maps.google.com/?q=Dua+SiSi+Laundry+Malang"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/70 hover:text-white transition px-3 py-1.5 hidden sm:inline-block"
            >
              Lokasi Outlet
            </a>
            <a
              href="https://wa.me/6289682020699"
              target="_blank"
              rel="noreferrer"
              className="bg-white hover:bg-white/90 text-slate-950 font-semibold text-xs px-4 py-1.5 rounded-full transition shadow-md flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Hubungi CS</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. Hero Centerpiece (Minimalist & Luxury) */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12 sm:py-20 flex flex-col items-center justify-center text-center my-auto">
        {/* Subtle Pill Pill Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md text-xs text-white/80 mb-6 shadow-sm">
          <span className="bg-white text-slate-950 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
            PORTAL
          </span>
          <span className="font-medium">Layanan Cuci & E-Nota Resmi</span>
        </div>

        {/* Clean, Massive Solid White Typography */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white max-w-2xl leading-[1.08] mb-5">
          Cucian Bersih. Cepat & Terpantau.
        </h1>

        <p className="text-sm sm:text-base text-white/60 max-w-md mb-9 leading-relaxed font-normal">
          Lacak status pengerjaan cucian Anda secara real-time atau unduh E-Nota bukti pembayaran resmi.
        </p>

        {/* 3. Minimalist Floating Pill Search Bar */}
        <div className="w-full max-w-md mb-6">
          <form
            onSubmit={handleSearch}
            className="rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-2xl p-1.5 flex items-center shadow-2xl transition focus-within:border-white/40 focus-within:bg-white/[0.1]"
          >
            <div className="pl-3.5 pr-2 text-white/40">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchNota}
              onChange={(e) => setSearchNota(e.target.value)}
              placeholder="Ketik nomor nota (LDY-260819-0001)..."
              className="flex-1 bg-transparent border-none text-white text-xs sm:text-sm outline-hidden placeholder:text-white/40 font-mono"
            />
            <button
              type="submit"
              disabled={searching}
              className="bg-white hover:bg-white/90 text-slate-950 font-semibold text-xs px-5 py-2.5 rounded-full transition flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-60 shrink-0"
            >
              {searching ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Cek</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {searchError && (
            <div className="mt-3 py-2 px-3.5 rounded-full border border-rose-500/30 bg-rose-950/60 backdrop-blur-md text-rose-200 text-xs flex items-center justify-center gap-1.5 animate-fade-in shadow-md">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </div>

        {/* 4. Elegant Minimalist Info Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/50 pt-2">
          <div className="px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-sm flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-white/60" />
            <span>07.00 - 22.00 WIB</span>
          </div>
          <div className="px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-sm flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-white/60" />
            <span>Karangploso, Malang (Belakang UMM 3)</span>
          </div>
          <div className="px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-sm flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-white/60" />
            <span>Free WiFi: DuaSisiLaundry</span>
          </div>
        </div>
      </main>

      {/* 5. Minimalist Clean Footer */}
      <footer className="relative z-20 w-full pb-6 px-4 text-center text-xs text-white/40">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/5 pt-4">
          <div>
            © {new Date().getFullYear()} Dua SiSi Laundry.
          </div>
          <a
            href="/terminal-pos-internal"
            className="text-white/40 hover:text-white/80 transition flex items-center gap-1 text-[11px]"
            title="Akses Staf / Kasir"
          >
            <Lock className="w-3 h-3" />
            <span>Terminal POS</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
