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
  Sparkles,
  CheckCircle2,
  Phone,
  Gift,
  FileText,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  Shirt,
  Coins,
  Star,
  Coffee,
  ExternalLink,
  Laptop
} from 'lucide-react';
import MoltenMetal from '@/components/MoltenMetal';
import CardNav, { CardNavItem } from '@/components/CardNav';
import FoldText from '@/components/FoldText';
import DriftWall, { DriftWallItem } from '@/components/DriftWall';
import { runBackend } from '@/lib/api';
import { Transaksi } from '@/lib/types';
import ENotaView from '@/components/ENotaView';

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

const NAV_ITEMS: CardNavItem[] = [
  {
    label: 'Layanan',
    bgColor: '#0c282b',
    textColor: '#ffffff',
    links: [
      { label: 'Drop Off Express & Kilat', href: 'https://wa.me/6289682020699?text=Halo%20Dua%20SiSi%20Laundry,%20mau%20order%20Drop%20Off' },
      { label: 'Self Service Coin 60 Menit', href: 'https://wa.me/6289682020699?text=Halo%20Dua%20SiSi%20Laundry,%20tanya%20Self%20Service%20Coin' }
    ]
  },
  {
    label: 'Outlet',
    bgColor: '#113539',
    textColor: '#ffffff',
    links: [
      { label: 'Petunjuk Arah Google Maps', href: 'https://maps.google.com/?q=Dua+SiSi+Laundry+Malang' },
      { label: 'Jam Buka: 07.00 - 23.00 WIB', href: 'https://maps.google.com/?q=Dua+SiSi+Laundry+Malang' },
      { label: 'Free WiFi', href: 'https://maps.google.com/?q=Dua+SiSi+Laundry+Malang' }
    ]
  },
  {
    label: 'Bantuan',
    bgColor: '#18474d',
    textColor: '#ffffff',
    links: [
      { label: 'WhatsApp CS Hotline', href: 'https://wa.me/6289682020699' },
      { label: 'Kritik & Saran Layanan', href: 'https://wa.me/6289682020699?text=Halo%20Dua%20SiSi%20Laundry,%20saya%20ingin%20memberikan%20saran' }
    ]
  }
];

const OUTLET_GALLERY: DriftWallItem[] = [
  { image: '/assets/bg-outlet.jpeg', title: 'Outlet Dua SiSi Laundry' },
  { image: '/assets/bg-outlet.png', title: 'Mesin Washer & Dryer Koin' },
  { image: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=600&auto=format&fit=crop&q=80', title: 'Station Cuci Modern' },
  { image: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=600&auto=format&fit=crop&q=80', title: 'Hasil Cuci Bersih & Rapi' },
  { image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=600&auto=format&fit=crop&q=80', title: 'Setrika Uap & Packing Wangi' },
  { image: 'https://images.unsplash.com/photo-1521656693074-0ef32e80a5d5?w=600&auto=format&fit=crop&q=80', title: 'Work From Laundry Lounge' },
  { image: 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=600&auto=format&fit=crop&q=80', title: 'Self Service Coin Washer' },
  { image: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=600&auto=format&fit=crop&q=80', title: 'Deterjen & Pelembut Premium' },
  { image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80', title: 'Layanan Drop Off Kilat' }
];

export default function CustomerLandingPage() {
  const [activeTab, setActiveTab] = useState<'lacak' | 'poin'>('lacak');
  const [searchNota, setSearchNota] = useState<string>('');
  const [last4Phone, setLast4Phone] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Results
  const [foundTx, setFoundTx] = useState<Transaksi | null>(null);
  const [foundPoin, setFoundPoin] = useState<PelangganPoinData | null>(null);
  const [viewFullNota, setViewFullNota] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setFoundTx(null);
    setFoundPoin(null);

    try {
      if (activeTab === 'lacak') {
        const nota = searchNota.trim().toUpperCase();
        const clean4 = last4Phone.trim().replace(/\D/g, '');

        if (!nota) {
          setErrorMsg('Masukkan nomor nota Anda (Contoh: LDY-260819-0001).');
          setLoading(false);
          return;
        }

        if (clean4.length !== 4) {
          setErrorMsg('Masukkan 4 digit terakhir nomor HP Anda untuk verifikasi keamanan.');
          setLoading(false);
          return;
        }

        const res = await runBackend<{ success?: boolean; transaksi?: Transaksi; message?: string }>(
          'getTransaksiByNota',
          nota,
          '',
          clean4
        );

        if (res?.success && res.transaksi) {
          setFoundTx(res.transaksi);
        } else {
          setErrorMsg(res?.message || `Nota "${nota}" tidak cocok dengan 4 digit nomor HP yang dimasukkan.`);
        }
      } else {
        // Cek Poin by Phone
        const phone = phoneInput.trim();
        if (!phone || phone.length < 9) {
          setErrorMsg('Masukkan nomor WhatsApp yang valid (minimal 9 digit).');
          setLoading(false);
          return;
        }

        const res = await runBackend<{ success?: boolean; pelanggan?: PelangganPoinData; message?: string }>(
          'cekPoinPelanggan',
          phone
        );

        if (res?.success && res.pelanggan) {
          setFoundPoin(res.pelanggan);
        } else {
          setErrorMsg(res?.message || `Nomor "${phone}" belum terdaftar sebagai pelanggan di Dua SiSi Laundry.`);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memuat data. Silakan periksa koneksi Anda.');
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
    <div className="min-h-screen bg-[#040e10] text-white relative selection:bg-white selection:text-black overflow-x-hidden font-sans flex flex-col justify-between">
      {/* Dynamic Molten Metal Ambient Background (Crystal Clear Luminous Teal) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <MoltenMetal
          color1="#041214"
          color2="#1BA5A0"
          color3="#FFFFFF"
          speed={0.35}
          scale={3.8}
          detail={3}
          glow={1.8}
          coreSize={0.12}
          swirl={1}
          fold={-0.2}
          blackPoint={0.04}
          brightness={1.35}
          colorMode="molten"
          grain={true}
          grainIntensity={0.03}
          mouseInteraction={true}
          mouseStrength={0.3}
          opacity={1.0}
        />
      </div>

      {/* 1. React Bits Interactive Animated CardNav (Fixed Top Floating Layer - Never shifts content) */}
      <header className="fixed top-4 sm:top-6 left-0 right-0 z-50 pointer-events-none px-4">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <CardNav
            logo="/assets/logo-emblem-white.svg"
            logoAlt="Dua SiSi"
            brandTitle="Dua SiSi Laundry"
            items={NAV_ITEMS}
            baseColor="rgba(255, 255, 255, 0.05)"
            menuColor="#ffffff"
            buttonBgColor="#ffffff"
            buttonTextColor="#000000"
            ctaText="WhatsApp CS"
            onCtaClick={() => window.open('https://wa.me/6289682020699', '_blank')}
          />
        </div>
      </header>

      {/* 2. Hero Centerpiece (100vh Full Screen Initial Fold) */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 pt-24 pb-8 w-full relative z-10 my-auto">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center w-full">
          {/* Tab Switcher Pills - Permanently Anchored */}
          <div className="inline-flex items-center p-1 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-xl mb-5 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('lacak');
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

          {/* 3D Animated Unfolding Typography - Fixed Height Container */}
          <div className="mb-3 max-w-2xl text-center min-h-[85px] sm:min-h-[110px] flex items-center justify-center">
            <FoldText
              key={activeTab}
              text={
                activeTab === 'lacak'
                  ? 'Cucian Bersih. Cepat & Terpantau.'
                  : 'Poin Loyalitas & Keuntungan Member.'
              }
              splitBy="word"
              hinge="top"
              trigger="mount"
              duration={0.7}
              stagger={0.06}
              ease="power3.out"
              perspective={800}
              creaseShading={0.55}
              fontSize="clamp(2.2rem, 5.5vw, 3.75rem)"
              fontWeight={800}
              color="#ffffff"
              className="drop-shadow-lg"
            />
          </div>

          {/* Fixed Subtitle Container */}
          <div className="min-h-[40px] sm:min-h-[44px] max-w-md mb-6 flex items-center justify-center">
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed font-normal">
              {activeTab === 'lacak'
                ? 'Proteksi 2-Faktor: Masukkan nomor nota dan 4 digit terakhir nomor HP Anda untuk melacak status pengerjaan.'
                : 'Cek akumulasi poin cashback Anda dan nikmati promo cuci hemat di kasir.'}
            </p>
          </div>

          {/* 3. Minimalist 2-Factor Floating Search Bar - Fixed Unified Dimensions */}
          <div className="w-full max-w-lg mb-5">
            <form onSubmit={handleSearch} className="flex gap-2.5 items-center justify-center w-full">
              {activeTab === 'lacak' ? (
                <div className="flex flex-col sm:flex-row gap-2.5 items-center w-full">
                  {/* Input 1: No. Nota */}
                  <div className="w-full sm:flex-1 h-12 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-2xl px-2 flex items-center shadow-2xl transition focus-within:border-white/40 focus-within:bg-white/[0.1]">
                    <div className="pl-2 pr-2 text-white/40">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={searchNota}
                      onChange={(e) => setSearchNota(e.target.value)}
                      placeholder="No. Nota (LDY-260819-0001)..."
                      className="flex-1 bg-transparent border-none text-white text-xs sm:text-sm outline-hidden placeholder:text-white/40 font-mono uppercase"
                    />
                  </div>

                  {/* Input 2: 4 Digit Terakhir No. HP */}
                  <div className="w-full sm:w-48 h-12 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-2xl px-2 flex items-center shadow-2xl transition focus-within:border-white/40 focus-within:bg-white/[0.1]">
                    <div className="pl-2 pr-1.5 text-white/40">
                      <KeyRound className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="tel"
                      maxLength={4}
                      value={last4Phone}
                      onChange={(e) => setLast4Phone(e.target.value.replace(/\D/g, ''))}
                      placeholder="4 digit HP..."
                      className="flex-1 bg-transparent border-none text-white text-xs sm:text-sm outline-hidden placeholder:text-white/40 font-mono text-center"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-white hover:bg-white/90 text-slate-950 font-semibold text-xs h-8 px-3.5 rounded-full transition flex items-center justify-center gap-1 shadow-lg cursor-pointer disabled:opacity-60 shrink-0 ml-1"
                    >
                      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                /* Tab Poin: Input No. WhatsApp with matching height */
                <div className="w-full h-12 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-2xl px-2 flex items-center shadow-2xl transition focus-within:border-white/40 focus-within:bg-white/[0.1]">
                  <div className="pl-3 pr-2 text-white/40">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="Nomor WhatsApp (08123456789)..."
                    className="flex-1 bg-transparent border-none text-white text-xs sm:text-sm outline-hidden placeholder:text-white/40 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-white hover:bg-white/90 text-slate-950 font-semibold text-xs h-8 px-4 rounded-full transition flex items-center justify-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Cek Poin</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>

            {/* Privacy Badge info under search */}
            <div className="min-h-[20px] mt-2 flex items-center justify-center">
              {activeTab === 'lacak' ? (
                <div className="flex items-center justify-center gap-1 text-[11px] text-white/40">
                  <ShieldCheck className="w-3 h-3 text-teal-400" />
                  <span>Privasi Terlindungi: Nota hanya dapat dibuka dengan kecocokan 4 digit nomor HP</span>
                </div>
              ) : (
                <span className="text-[11px] text-white/40">Poin dapat langsung digunakan untuk potongan cuci di kasir</span>
              )}
            </div>

            {errorMsg && (
              <div className="mt-3 py-2 px-3.5 rounded-full border border-rose-500/30 bg-rose-950/60 backdrop-blur-md text-rose-200 text-xs flex items-center justify-center gap-1.5 animate-fade-in shadow-md">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* 4. RESULT CARD (Lacak Cucian Stepper / Poin Member) - Solid Minimalist Dark Card */}
          {foundTx && (() => {
            const isDropOffOrder = Boolean(
              foundTx.tipe === 'FullService' ||
              (foundTx.items && foundTx.items.some((it) => {
                const name = (it.layanan || '').toLowerCase();
                return (
                  name.includes('cuci') ||
                  name.includes('setrika') ||
                  name.includes('kiloan') ||
                  name.includes('satuan') ||
                  name.includes('bedcover') ||
                  name.includes('selimut') ||
                  name.includes('express') ||
                  name.includes('kilat') ||
                  name.includes('reguler') ||
                  name.includes('drop off') ||
                  name.includes('dry clean')
                ) && !name.includes('koin') && !name.includes('self service');
              })) ||
              (['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil'].includes(foundTx.status) && foundTx.tipe !== 'SelfService')
            );

            return (
              <div className="w-full max-w-lg rounded-2xl border border-[#153a3e] bg-[#061517] p-5 text-left mb-6 shadow-2xl animate-fade-in">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                  <div>
                    <span className="text-[10px] text-white/50 uppercase tracking-wider block font-mono">No. Nota</span>
                    <span className="text-sm font-bold font-mono text-white">{foundTx.noNota}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider block">Layanan</span>
                    <span className="text-xs font-semibold text-teal-300">
                      {isDropOffOrder ? (foundTx.tingkatLayanan || 'Drop Off') : 'Self Service / Pembelian'}
                    </span>
                  </div>
                </div>

                {isDropOffOrder ? (
                  /* Live Progress Stepper (Khusus Drop Off) */
                  <div className="py-2 mb-4">
                    <div className="text-xs font-semibold text-white/80 mb-3 flex items-center justify-between">
                      <span>Alur Proses Cuci</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#0a272a] border border-teal-500/40 text-teal-300 font-bold">
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
                                ? 'bg-[#0e3135] border border-teal-400/40 text-white shadow-inner'
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
                ) : (
                  /* Self Service / Retail Item: Tampilan Langsung Selesai di Tempat */
                  <div className="py-2 mb-4">
                    <div className="p-3.5 rounded-xl bg-[#092226] border border-teal-500/30 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs text-white block">Layanan Mandiri / Langsung Selesai</span>
                        <p className="text-[11px] text-white/70 leading-relaxed mt-0.5">
                          Nota ini berisi layanan <strong>Self Service (Koin)</strong> atau pembelian produk outlet. Transaksi langsung selesai di tempat tanpa proses pengerjaan bertahap.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Summary Details & E-Nota CTA */}
                <div className="bg-[#030d0f] rounded-xl p-3 border border-white/5 space-y-1.5 text-xs text-white/70 mb-4">
                  <div className="flex justify-between">
                    <span>Pelanggan</span>
                    <span className="text-white font-medium">{foundTx.namaPelanggan || 'Pelanggan'}</span>
                  </div>
                  {isDropOffOrder && (
                    <div className="flex justify-between">
                      <span>Estimasi Selesai</span>
                      <span className="text-white font-medium">{foundTx.estimasi || '-'}</span>
                    </div>
                  )}

                  {/* Rincian item jika ada pembelian item / multi-item */}
                  {foundTx.items && foundTx.items.length > 0 && (
                    <div className="border-t border-white/10 pt-2 mt-2 space-y-1">
                      <span className="text-[10px] text-white/40 uppercase tracking-wider block font-semibold mb-1">Rincian Nota:</span>
                      {foundTx.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-white/80">
                          <span>{it.qty}x {it.layanan}</span>
                          <span className="font-mono text-white/60">Rp {(it.subtotal || (it.qty * it.hargaSatuan) || 0).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                    <span>Total Pembayaran</span>
                    <span className="text-white font-mono font-bold">
                      Rp {(foundTx.total || 0).toLocaleString('id-ID')}
                      <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${foundTx.statusPembayaran === 'DP' || foundTx.statusPembayaran === 'Belum Bayar' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {foundTx.statusPembayaran || 'Lunas'}
                      </span>
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
            );
          })()}

          {foundPoin && (
            <div className="w-full max-w-lg rounded-2xl border border-[#153a3e] bg-[#061517] p-5 text-left mb-6 shadow-2xl animate-fade-in">
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
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#0a272a] border border-teal-500/40 text-teal-300">
                  {foundPoin.statusMember}
                </span>
              </div>

              {/* Saldo Poin Display */}
              <div className="bg-[#030d0f] border border-teal-500/30 rounded-xl p-4 text-center mb-4 shadow-inner">
                <span className="text-[11px] text-teal-200/80 block font-medium mb-0.5">Total Saldo Poin Anda</span>
                <div className="text-3xl font-black font-mono text-white tracking-tight">
                  {foundPoin.saldoPoin} <span className="text-sm font-bold text-teal-300">Poin</span>
                </div>
                <p className="text-[11px] text-white/60 mt-1">
                  Untuk info promo & penukaran (redeem) poin, silakan tanyakan langsung ke kasir kami
                </p>
              </div>

              {/* Reward Info */}
              <div className="bg-[#030d0f] rounded-xl p-3 border border-white/5 space-y-1.5 text-xs text-white/70 mb-4">
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
                      className="p-2.5 rounded-xl bg-[#030d0f] border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-white block">{ord.noNota}</span>
                        <span className="text-[10px] text-white/50">Status: {ord.status}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchNota(ord.noNota);
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

          {/* 5. Minimalist Quick Badges & Slogan WFL */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/60 pt-1">
            <div className="px-3.5 py-1.5 rounded-full border border-[#143236] bg-[#061416] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-300" />
              <span>07.00 - 23.00 WIB</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-full border border-[#143236] bg-[#061416] flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-teal-300" />
              <span>Free WiFi</span>
            </div>
            <div className="px-3.5 py-1.5 rounded-full border border-teal-500/40 bg-[#0a272a] flex items-center gap-1.5 text-teal-200">
              <Laptop className="w-3.5 h-3.5 text-teal-300" />
              <span className="font-semibold">Work From Laundry</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Penjelasan Layanan: Drop Off & Self Service (Section Terpisah di Bawah Lipatan) */}
      <section className="relative z-20 w-full bg-[#040e10] py-20 border-t border-white/10 text-left">
        <div className="max-w-5xl mx-auto px-4 space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Pilihan Layanan Kami</h2>
            <p className="text-xs sm:text-sm text-white/50 mt-1.5">Pilih layanan sesuai kebutuhan waktu & kenyamanan Anda</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Drop Off Service */}
            <div className="rounded-2xl border border-[#1a464c] bg-[#0b2124] p-6 sm:p-7 shadow-2xl hover:border-teal-400/50 transition">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-11 h-11 rounded-xl bg-[#12363b] border border-teal-500/30 flex items-center justify-center text-teal-300">
                  <Shirt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Drop Off Service</h3>
                  <span className="text-xs text-teal-300 font-medium">Serahkan pakaian, kami selesaikan</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed mb-5">
                Layanan lengkap cuci, pengeringan higienis, setrika uap rapi, dan packing harum. Tinggal drop pakaian Anda dan pantau statusnya lewat WhatsApp & E-Nota.
              </p>
              <div className="space-y-2 text-xs text-white/70 border-t border-white/10 pt-4">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span><strong>Kilat 4 Jam</strong> / <strong>Express 1 Hari</strong> / <strong>Reguler 2 Hari</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Deterjen & softener premium ramah serat kain</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Notifikasi live status pengerjaan via WhatsApp & E-Nota</span>
                </div>
              </div>
            </div>

            {/* Card 2: Self Service Coin */}
            <div className="rounded-2xl border border-[#1a464c] bg-[#0b2124] p-6 sm:p-7 shadow-2xl hover:border-teal-400/50 transition">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#12363b] border border-teal-500/30 flex items-center justify-center text-teal-300">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Self Service Coin Laundry</h3>
                  <span className="text-xs text-teal-300 font-medium">Cuci & Kering Cepat 60 Menit</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed mb-5">
                Operasikan mesin washer dan dryer berkapasitas besar secara mandiri. Pakaian bersih maksimal, bebas kusut, dan 100% kering siap lipat.
              </p>
              <div className="space-y-2 text-xs text-white/70 border-t border-white/10 pt-4">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span><strong>1 Mesin 1 Pelanggan</strong> (Higienis & tidak dicampur)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Selesai cepat dalam 60 menit (Cuci 30m + Kering 30m)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Area <strong>Work From Laundry</strong> nyaman ber-AC & Free WiFi</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. React Bits DriftWall: Full-Width 3D Gallery Foto Outlet (Solid Opaque & Full-Width Edge-to-Edge) */}
      <section className="relative z-20 w-full bg-[#040e10] py-14 overflow-hidden border-t border-white/5 text-center">
        <div className="max-w-5xl mx-auto px-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Galeri Suasana Outlet</h2>
          <p className="text-xs text-white/50 mt-1">Fasilitas modern, bersih, dan nyaman untuk mencuci maupun bekerja</p>
        </div>

        {/* 100% Full-Width Edge-to-Edge Container */}
        <div className="w-full h-[460px] sm:h-[540px] overflow-hidden relative">
          <DriftWall
            items={OUTLET_GALLERY}
            columns={6}
            tileWidth={240}
            tileHeight={155}
            gap={16}
            tilt={0}
            turn={0}
            roll={0}
            depth={0}
            speed={20}
            variance={0.15}
            parallax={0.2}
            pauseOnHover={false}
            overlayColor="transparent"
            dim={1.0}
            lift={36}
          />
        </div>
      </section>

      {/* 8. Full-Width Solid Dark Footer with Embedded Google Maps & Reviews */}
      <footer className="relative z-20 w-full bg-[#030b0d] border-t border-white/10 pt-12 pb-8 px-4 text-left">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-10">
            {/* Left Column: Store Details & Rating */}
            <div className="lg:col-span-5 space-y-4">
              {/* Google Review Bintang 5 Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d282b] border border-teal-500/40 text-amber-300 text-xs font-semibold">
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                  ))}
                </div>
                <span>5.0 Bintang di Google Maps</span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight">Dua SiSi Laundry Malang</h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Jl. Pangestu Raya, Kasin, Ampeldento, Kec. Karang Ploso, Kabupaten Malang, Jawa Timur 65152 (Belakang Kampus UMM 3)
              </p>

              <div className="space-y-2 text-xs text-white/60 pt-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>Buka Setiap Hari: <strong>07.00 - 23.00 WIB</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="w-3.5 h-3.5 text-teal-400" />
                  <span>Fasilitas: <strong>Free WiFi & Area Work From Laundry (WFL)</strong></span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="https://maps.google.com/?q=Dua+SiSi+Laundry+Malang"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white hover:bg-white/90 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-full transition flex items-center gap-1.5 shadow-lg"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Google Maps</span>
                </a>
                <a
                  href="https://wa.me/6289682020699"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-full transition flex items-center gap-1.5 shadow-lg"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>WhatsApp CS</span>
                </a>
              </div>
            </div>

            {/* Right Column: Google Maps Embedded Iframe */}
            <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#143236] bg-[#061416] shadow-2xl">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3951.766582136624!2d112.60813967476743!3d-7.919432992104073!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e78816025fe6e1f%3A0x2b4fdea8a4f0bbcb!2sDua%20Sisi%20Laundry!5e0!3m2!1sid!2sid!4v1787119397656!5m2!1sid!2sid"
                width="100%"
                height="280"
                style={{ border: 0 }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                title="Lokasi Dua SiSi Laundry Google Maps"
              />
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="border-t border-white/5 pt-6 text-center text-xs text-white/40">
            © {new Date().getFullYear()} Dua SiSi Laundry. All rights reserved. • Work From Laundry
          </div>
        </div>
      </footer>
    </div>
  );
}
