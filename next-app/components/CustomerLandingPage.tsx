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
  Sparkles,
  CheckCircle2,
  Circle,
  Phone,
  Gift,
  FileText,
  X,
  ExternalLink,
  ChevronRight,
  Shirt
} from 'lucide-react';
import MoltenMetal from '@/components/MoltenMetal';
import { runBackend } from '@/lib/api';
import { Transaksi } from '@/lib/types';
import ENotaView from '@/components/ENotaView';
import { maskPhone } from '@/lib/utils';

interface PelangganPoinData {
  maskedNama: string;
  maskedHp: string;
  saldoPoin: number;
  totalOrder: number;
  isMember: boolean;
  statusMember: string;
  activeOrders?: Array<{
    noNota: string;
    tipe: string;
    status: string;
    estimasiSelesai: string;
  }>;
}

const ORDER_STEPS = [
  { key: 'Diterima', label: 'Diterima' },
  { key: 'Dicuci', label: 'Dicuci' },
  { key: 'Dikeringkan', label: 'Dikeringkan' },
  { key: 'Disetrika', label: 'Disetrika / Packing' },
  { key: 'Siap Diambil', label: 'Siap Diambil' }
];

function getStepIndex(statusStr: string): number {
  const s = (statusStr || '').toLowerCase();
  if (s.includes('selesai') || s.includes('diambil')) return 4;
  if (s.includes('siap')) return 4;
  if (s.includes('setrika') || s.includes('packing') || s.includes('lipat')) return 3;
  if (s.includes('kering') || s.includes('dryer')) return 2;
  if (s.includes('cuci') || s.includes('washer') || s.includes('proses')) return 1;
  return 0; // Diterima
}

export default function CustomerLandingPage() {
  const [activeTab, setActiveTab] = useState<'lacak' | 'poin'>('lacak');
  const [queryInput, setQueryInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Results
  const [foundTx, setFoundTx] = useState<Transaksi | null>(null);
  const [foundPoin, setFoundPoin] = useState<PelangganPoinData | null>(null);
  const [viewFullNota, setViewFullNota] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = queryInput.trim();
    if (!query) {
      setErrorMsg(activeTab === 'lacak' ? 'Masukkan nomor nota Anda.' : 'Masukkan nomor WhatsApp Anda.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setFoundTx(null);
    setFoundPoin(null);

    try {
      if (activeTab === 'lacak') {
        const res = await runBackend<{ success?: boolean; transaksi?: Transaksi; message?: string }>(
          'getTransaksiByNota',
          query.toUpperCase(),
          ''
        );

        if (res?.success && res.transaksi) {
          setFoundTx(res.transaksi);
        } else {
          setErrorMsg(res?.message || `Nota "${query}" tidak ditemukan. Pastikan format nomor nota sesuai (Contoh: LDY-260819-0001).`);
        }
      } else {
        // Cek Poin by Phone
        const res = await runBackend<{ success?: boolean; pelanggan?: PelangganPoinData; message?: string }>(
          'cekPoinPelanggan',
          query
        );

        if (res?.success && res.pelanggan) {
          setFoundPoin(res.pelanggan);
        } else {
          setErrorMsg(res?.message || `Nomor "${query}" belum terdaftar sebagai pelanggan di Dua SiSi Laundry.`);
        }
      }
    } catch (err) {
      setErrorMsg('Gagal memuat data. Silakan periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  };

  // If user clicked to view official full E-Nota
  if (viewFullNota) {
    return (
      <div className="relative min-h-screen bg-[#0C1E20]">
        <div className="fixed top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => setViewFullNota(null)}
            className="bg-white hover:bg-slate-100 text-black px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shadow-2xl cursor-pointer"
          >
            ← Kembali ke Pencarian
          </button>
        </div>
        <ENotaView noNota={viewFullNota} />
      </div>
    );
  }

  const currentStepIdx = foundTx ? getStepIndex(foundTx.status) : 0;

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

      {/* 2. Hero Centerpiece with Tab Switcher */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-10 sm:py-16 flex flex-col items-center justify-center text-center my-auto w-full">
        {/* Tab Switcher Pills */}
        <div className="inline-flex items-center p-1 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-xl mb-6 shadow-xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab('lacak');
              setQueryInput('');
              setErrorMsg('');
              setFoundTx(null);
              setFoundPoin(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'lacak'
                ? 'bg-white text-slate-950 shadow-md'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Lacak Cucian</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('poin');
              setQueryInput('');
              setErrorMsg('');
              setFoundTx(null);
              setFoundPoin(null);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'poin'
                ? 'bg-white text-slate-950 shadow-md'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cek Poin & Member</span>
          </button>
        </div>

        {/* Clean, Massive Typography */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white max-w-2xl leading-[1.1] mb-4">
          {activeTab === 'lacak'
            ? 'Cucian Bersih. Cepat & Terpantau.'
            : 'Poin Loyalitas & Keuntungan Member.'}
        </h1>

        <p className="text-xs sm:text-sm text-white/60 max-w-md mb-8 leading-relaxed font-normal">
          {activeTab === 'lacak'
            ? 'Pantau progres cucian Drop Off Anda langkah demi langkah atau unduh E-Nota bukti pembayaran.'
            : 'Cek akumulasi poin cashback Anda dan tukarkan dengan diskon cuci atau deterjen di kasir.'}
        </p>

        {/* 3. Minimalist Floating Pill Search Bar */}
        <div className="w-full max-w-md mb-6">
          <form
            onSubmit={handleSearch}
            className="rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-2xl p-1.5 flex items-center shadow-2xl transition focus-within:border-white/40 focus-within:bg-white/[0.1]"
          >
            <div className="pl-3.5 pr-2 text-white/40">
              {activeTab === 'lacak' ? <Search className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            </div>
            <input
              type={activeTab === 'lacak' ? 'text' : 'tel'}
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={
                activeTab === 'lacak'
                  ? 'Ketik nomor nota (LDY-260819-0001)...'
                  : 'Ketik nomor WhatsApp (08123456789)...'
              }
              className="flex-1 bg-transparent border-none text-white text-xs sm:text-sm outline-hidden placeholder:text-white/40 font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-white hover:bg-white/90 text-slate-950 font-semibold text-xs px-5 py-2.5 rounded-full transition flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-60 shrink-0"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>{activeTab === 'lacak' ? 'Lacak' : 'Cek Poin'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {errorMsg && (
            <div className="mt-3 py-2 px-3.5 rounded-full border border-rose-500/30 bg-rose-950/60 backdrop-blur-md text-rose-200 text-xs flex items-center justify-center gap-1.5 animate-fade-in shadow-md">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* 4. RESULT CARD (Lacak Cucian Stepper / Poin Member) */}
        {foundTx && (
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-white/[0.05] backdrop-blur-2xl p-5 text-left mb-6 shadow-2xl animate-fade-in">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div>
                <span className="text-[10px] text-white/50 uppercase tracking-wider block font-mono">No. Nota</span>
                <span className="text-sm font-bold font-mono text-white">{foundTx.noNota}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-white/50 uppercase tracking-wider block">Layanan</span>
                <span className="text-xs font-semibold text-teal-300">{foundTx.tingkatLayanan || foundTx.tipe || 'Drop Off'}</span>
              </div>
            </div>

            {/* Live Progress Stepper (Khusus Drop Off) */}
            <div className="py-2 mb-4">
              <div className="text-xs font-semibold text-white/80 mb-3 flex items-center justify-between">
                <span>Alur Proses Cuci</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/40 text-teal-300 font-bold">
                  Status: {foundTx.status || 'Diterima'}
                </span>
              </div>

              {/* Step indicator bar */}
              <div className="space-y-2">
                {ORDER_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 p-2 rounded-xl transition ${
                        isCurrent
                          ? 'bg-white/[0.08] border border-teal-400/40 text-white shadow-inner'
                          : isDone
                          ? 'text-white/80'
                          : 'text-white/30'
                      }`}
                    >
                      <div className="shrink-0">
                        {isDone ? (
                          <div className="w-5 h-5 rounded-full bg-teal-500 text-black flex items-center justify-center font-bold text-[10px]">
                            ✓
                          </div>
                        ) : isCurrent ? (
                          <div className="w-5 h-5 rounded-full bg-white text-slate-950 flex items-center justify-center font-bold text-[10px] animate-pulse">
                            ●
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-xs font-medium">{step.label}</div>
                      {isCurrent && (
                        <span className="text-[10px] text-teal-300 font-mono font-semibold animate-pulse">
                          Sedang Berlangsung
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Details & E-Nota CTA */}
            <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs text-white/70 mb-4">
              <div className="flex justify-between">
                <span>Pelanggan</span>
                <span className="text-white font-medium">{foundTx.namaPelanggan || 'Pelanggan'}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimasi Selesai</span>
                <span className="text-white font-medium">{foundTx.estimasi || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Status Pembayaran</span>
                <span className={`font-bold ${foundTx.statusPembayaran === 'DP' || foundTx.statusPembayaran === 'Belum Bayar' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {foundTx.statusPembayaran || 'Lunas'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewFullNota(foundTx.noNota)}
              className="w-full bg-white hover:bg-slate-100 text-black font-semibold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Buka E-Nota Bukti Pembayaran</span>
            </button>
          </div>
        )}

        {foundPoin && (
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-white/[0.05] backdrop-blur-2xl p-5 text-left mb-6 shadow-2xl animate-fade-in">
            {/* Member Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 text-black flex items-center justify-center font-bold text-sm shadow-md">
                  ⭐
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">{foundPoin.maskedNama}</span>
                  <span className="text-[10px] font-mono text-white/50">{foundPoin.maskedHp}</span>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal-950/80 border border-teal-500/40 text-teal-300">
                {foundPoin.statusMember}
              </span>
            </div>

            {/* Saldo Poin Display */}
            <div className="bg-gradient-to-r from-teal-950/70 via-slate-900/60 to-teal-950/70 border border-teal-500/30 rounded-xl p-4 text-center mb-4 shadow-inner">
              <span className="text-[11px] text-teal-200/80 block font-medium mb-0.5">Total Saldo Poin Anda</span>
              <div className="text-3xl font-black font-mono text-white tracking-tight">
                {foundPoin.saldoPoin} <span className="text-sm font-bold text-teal-300">Poin</span>
              </div>
              <p className="text-[11px] text-white/60 mt-1">
                Setara potongan diskon <strong className="text-teal-300">Rp {(foundPoin.saldoPoin * 100).toLocaleString('id-ID')}</strong> di kasir
              </p>
            </div>

            {/* Reward Info */}
            <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs text-white/70 mb-4">
              <div className="flex items-center gap-2 text-white/80 font-medium">
                <Gift className="w-3.5 h-3.5 text-teal-400" />
                <span>Total Riwayat Cuci: {foundPoin.totalOrder} kali</span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed pl-5.5">
                Kumpulkan poin pada setiap transaksi cuci. Poin dapat langsung ditukarkan untuk diskon atau gratis cuci.
              </p>
            </div>

            {/* Active Orders for this customer */}
            {foundPoin.activeOrders && foundPoin.activeOrders.length > 0 && (
              <div className="space-y-2 mb-2">
                <span className="text-[11px] font-semibold text-white/60 block">Cucian Aktif Saat Ini:</span>
                {foundPoin.activeOrders.map((ord) => (
                  <div
                    key={ord.noNota}
                    className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-white block">{ord.noNota}</span>
                      <span className="text-[10px] text-white/50">Status: {ord.status}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQueryInput(ord.noNota);
                        setActiveTab('lacak');
                        setFoundPoin(null);
                        setFoundTx({ noNota: ord.noNota, status: ord.status } as any);
                      }}
                      className="text-xs text-teal-300 hover:text-teal-200 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lacak</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Elegant Minimalist Info Badges */}
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

      {/* 6. Minimalist Clean Footer */}
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
