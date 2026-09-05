'use client';

import React, { useState, useEffect } from 'react';
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
  Laptop,
  ChevronDown,
  Check
} from 'lucide-react';
import MoltenMetal from '@/components/MoltenMetal';
import CardNav, { CardNavItem } from '@/components/CardNav';
import FoldText from '@/components/FoldText';
import DriftWall, { DriftWallItem } from '@/components/DriftWall';
import ClickSpark from '@/components/ClickSpark';
import { runBackend } from '@/lib/api';
import { Transaksi } from '@/lib/types';
import ENotaView from '@/components/ENotaView';
import DigitalMemberCard from '@/components/DigitalMemberCard';
import { PelangganItem } from '@/components/PelangganView';

interface PelangganPoinData {
  maskedNama: string;
  maskedHp: string;
  noHp?: string;
  nama?: string;
  alamat?: string;
  saldoPoin: number;
  totalOrder: number;
  totalSpend?: number;
  terakhirOrder?: string;
  isMember: boolean;
  statusMember: string;
  statusKategori?: 'Member' | 'Pelanggan Lama' | 'Pelanggan Baru';
  tglDaftar?: string;
  stamps75?: number;
  stamps45?: number;
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
  { image: '/assets/galeri/outlet-depan.png', title: 'Tampak Depan Dua SiSi Laundry' },
  { image: '/assets/galeri/outlet-mesin-washer.jpeg', title: 'Mesin Cuci Washer Modern' },
  { image: '/assets/galeri/outlet-ruang-tunggu.jpeg', title: 'Lounge Work From Laundry' },
  { image: '/assets/galeri/outlet-mesin-koin.jpeg', title: 'Fasilitas Self Service Coin' },
  { image: '/assets/galeri/outlet-suasana-area-cuci.jpeg', title: 'Area Cuci Bersih & Higienis' },
  { image: '/assets/galeri/outlet-suasana-modern.png', title: 'Suasana Interior Modern Dua SiSi' }
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

  // 1. Log Activity: Visit Landing Page (Throttled per session)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const hasLogged = sessionStorage.getItem('duasisi_visited_landing');
        if (!hasLogged) {
          sessionStorage.setItem('duasisi_visited_landing', 'true');
          const devType = window.innerWidth < 768 ? 'Smartphone (Mobile Web)' : 'Desktop / Tablet Web';
          runBackend(
            'logClientActivity', 
            'Pengunjung Web', 
            'Kunjungan Landing Page', 
            'Beranda Publik', 
            '-', 
            devType, 
            `Pengunjung mengakses landing page Dua SiSi Laundry via ${devType}`
          ).catch(() => {});
        }
      }
    } catch (e) {}
  }, []);

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
          // Log Activity: Cek Status Cucian Berhasil
          runBackend(
            'logClientActivity', 
            `Pelanggan: ${res.transaksi.namaPelanggan}`, 
            'Cek Status Cucian', 
            nota, 
            '-', 
            `Status: ${res.transaksi.status} (${res.transaksi.tipe || 'Drop Off'})`, 
            `Pelanggan ${res.transaksi.namaPelanggan} mengecek progress cucian nota ${nota} via website publik`
          ).catch(() => {});
        } else {
          setErrorMsg(res?.message || `Nota "${nota}" tidak cocok dengan 4 digit nomor HP yang dimasukkan.`);
          // Log Activity: Cek Status Cucian Gagal
          runBackend(
            'logClientActivity', 
            'Pengunjung Web', 
            'Cek Status Cucian', 
            nota, 
            '-', 
            `Verifikasi Gagal (4 Digit: ${clean4})`, 
            `Pencarian status nota ${nota} tidak ditemukan / verifikasi 4 digit gagal`
          ).catch(() => {});
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
          // Log Activity: Cek Poin Member Berhasil
          runBackend(
            'logClientActivity', 
            `Pelanggan: ${res.pelanggan.maskedNama || 'Pelanggan'}`, 
            'Cek Poin Member', 
            phone, 
            '-', 
            `Saldo: ${res.pelanggan.saldoPoin} Poin (${res.pelanggan.statusMember})`, 
            `Pelanggan ${res.pelanggan.maskedNama || 'Pelanggan'} mengecek saldo poin loyalty reward di website publik`
          ).catch(() => {});
        } else {
          setErrorMsg(res?.message || `Nomor "${phone}" belum terdaftar sebagai pelanggan di Dua SiSi Laundry.`);
          // Log Activity: Cek Poin Belum Terdaftar
          runBackend(
            'logClientActivity', 
            'Pengunjung Web', 
            'Cek Poin Member', 
            phone, 
            '-', 
            'Nomor Belum Terdaftar', 
            `Pengecekan poin untuk nomor WhatsApp ${phone} belum terdaftar`
          ).catch(() => {});
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
        <ENotaView noNota={viewFullNota} initialData={foundTx} last4Phone={last4Phone} />
      </div>
    );
  }

  const currentStepIdx = foundTx ? getStepIndex(foundTx.status) : 0;

  return (
    <ClickSpark
      sparkColor="#2dd4bf"
      sparkSize={12}
      sparkRadius={22}
      sparkCount={8}
      duration={450}
      extraScale={1.1}
    >
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
              <span>Cek Poin & Kartu Stempel</span>
            </button>
          </div>

          {/* 3D Animated Unfolding Typography - Fixed Height Container */}
          <div className="mb-3 max-w-2xl text-center min-h-[85px] sm:min-h-[110px] flex items-center justify-center">
            <FoldText
              key={activeTab}
              text={
                activeTab === 'lacak'
                  ? 'Cucian Bersih. Cepat & Terpantau.'
                  : 'Poin Loyalitas & Kartu Stempel Member.'
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
                : 'Cek kartu stempel digital (7.5kg & 4.5kg) serta akumulasi saldo poin loyalty reward Anda.'}
            </p>
          </div>

          {/* 3. Minimalist Unified Luxury Search Capsule */}
          <div className="w-full max-w-xl mb-5">
            <form onSubmit={handleSearch} className="w-full">
              {activeTab === 'lacak' ? (
                /* Tab Lacak: 1 Unified Solid Luxury Capsule */
                <div className="w-full rounded-2xl sm:rounded-full border border-[#1a464c] bg-[#07191b] shadow-2xl p-1.5 flex flex-col sm:flex-row items-center gap-1 transition focus-within:border-teal-400/60 focus-within:shadow-[0_0_25px_rgba(45,212,191,0.15)]">
                  {/* Field 1: No. Nota */}
                  <div className="w-full sm:flex-1 h-11 px-3 flex items-center">
                    <Search className="w-4 h-4 text-teal-400 shrink-0 mr-2.5" />
                    <input
                      type="text"
                      value={searchNota}
                      onChange={(e) => setSearchNota(e.target.value)}
                      placeholder="Nomor Nota (LDY-260819-0001)..."
                      className="w-full bg-transparent border-none text-white text-xs sm:text-sm outline-hidden placeholder:text-white/35 font-mono uppercase tracking-wide"
                    />
                  </div>

                  {/* Vertical Divider (Desktop) */}
                  <div className="hidden sm:block h-7 w-[1px] bg-white/10 shrink-0" />

                  {/* Field 2: 4 Digit No. HP */}
                  <div className="w-full sm:w-36 h-11 px-3 flex items-center border-t sm:border-t-0 border-white/5">
                    <KeyRound className="w-3.5 h-3.5 text-teal-400 shrink-0 mr-2" />
                    <input
                      type="tel"
                      maxLength={4}
                      value={last4Phone}
                      onChange={(e) => setLast4Phone(e.target.value.replace(/\D/g, ''))}
                      placeholder="4 Digit HP"
                      className="w-full bg-transparent border-none text-white text-xs sm:text-sm outline-hidden placeholder:text-white/35 font-mono"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto h-11 px-5 rounded-xl sm:rounded-full bg-white hover:bg-white/90 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Lacak</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Tab Poin & Stempel: 1 Unified Solid Luxury Capsule */
                <div className="w-full rounded-2xl sm:rounded-full border border-[#1a464c] bg-[#07191b] shadow-2xl p-1.5 flex flex-col sm:flex-row items-center gap-1 transition focus-within:border-teal-400/60 focus-within:shadow-[0_0_25px_rgba(45,212,191,0.15)]">
                  <div className="w-full sm:flex-1 h-11 px-3.5 flex items-center">
                    <Phone className="w-4 h-4 text-teal-400 shrink-0 mr-2.5" />
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="Nomor WhatsApp Pelanggan (08123456789)..."
                      className="w-full bg-transparent border-none text-white text-xs sm:text-sm outline-hidden placeholder:text-white/35 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full sm:w-auto h-11 px-6 rounded-xl sm:rounded-full bg-white hover:bg-white/90 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Cek Poin & Stempel</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>

            {/* Privacy Badge info under search */}
            <div className="min-h-[20px] mt-2.5 flex items-center justify-center">
              {activeTab === 'lacak' ? (
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/50">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>Proteksi 2-Faktor: Hanya pemilik nota & no. HP yang dapat melihat rincian</span>
                </div>
              ) : (
                <span className="text-[11px] text-white/50">Cek kartu stempel digital (7.5kg & 4.5kg) & saldo cashback loyalty reward</span>
              )}
            </div>

            {errorMsg && (
              <div className="mt-3 py-2 px-4 rounded-full border border-rose-500/40 bg-[#1c090c] text-rose-200 text-xs flex items-center justify-center gap-2 animate-fade-in shadow-xl">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* 4. RESULT CARD (Lacak Cucian Stepper / Poin Member) - Solid Minimalist Dark Card */}
          {foundTx && (() => {
            const isDropOffOrder = Boolean(
              foundTx.tipe === 'FullService' ||
              (foundTx.tipe as string) === 'DropOff' ||
              (foundTx.tipe as string) === 'Drop Off'
            );

            // Dynamically construct active steps (from order pipeline if available, or fallback to ORDER_STEPS)
            const activeSteps: Array<{ key: string; label: string }> = (() => {
              if (Array.isArray(foundTx.pipeline) && foundTx.pipeline.length > 0) {
                const pSteps = foundTx.pipeline
                  .filter((p: any) => p.namaStep !== 'Pesanan Diterima')
                  .map((p: any) => ({
                    key: p.namaStep,
                    label: p.namaStep
                  }));
                if (pSteps.length > 0) {
                  return [{ key: 'Diterima', label: 'Diterima' }, ...pSteps];
                }
              }
              return ORDER_STEPS;
            })();

            const currentStepIdx = (() => {
              const curStatus = String(foundTx.status || '').toLowerCase();
              const foundIdx = activeSteps.findIndex(s => s.key.toLowerCase() === curStatus);
              if (foundIdx >= 0) return foundIdx;
              if (curStatus.includes('cuci')) return activeSteps.findIndex(s => s.key.toLowerCase().includes('cuci'));
              if (curStatus.includes('kering')) return activeSteps.findIndex(s => s.key.toLowerCase().includes('kering'));
              if (curStatus.includes('lipat')) return activeSteps.findIndex(s => s.key.toLowerCase().includes('lipat'));
              if (curStatus.includes('setrika')) return activeSteps.findIndex(s => s.key.toLowerCase().includes('setrika'));
              if (curStatus.includes('siap') || curStatus.includes('ambil')) return activeSteps.findIndex(s => s.key.toLowerCase().includes('siap') || s.key.toLowerCase().includes('ambil'));
              return 0;
            })();

            return (
              <div className="w-full max-w-lg rounded-2xl border border-[#153a3e] bg-[#061517] p-5 text-left mb-6 shadow-2xl animate-fade-in">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                  <div>
                    <span className="text-[10px] text-white/50 uppercase tracking-wider block font-mono">No. Nota</span>
                    <span className="text-sm font-bold font-mono text-white">{foundTx.noNota}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-white/50 uppercase tracking-wider block">Kategori Layanan</span>
                    <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mt-0.5 ${isDropOffOrder ? 'bg-[#0a272a] border border-teal-500/40 text-teal-300' : 'bg-[#0b291d] border border-emerald-500/40 text-emerald-300'}`}>
                      {isDropOffOrder ? (foundTx.tingkatLayanan || 'Drop Off') : 'Self Service (Koin)'}
                    </span>
                  </div>
                </div>

                {isDropOffOrder ? (
                  /* Live Progress Horizontal Stepper (Menyamping) */
                  <div className="py-2 mb-4">
                    <div className="text-xs font-semibold text-white/80 mb-4 flex items-center justify-between">
                      <span>Alur Proses Cuci</span>
                      <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#0a272a] border border-teal-500/40 text-teal-300 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                        <span>Status: {foundTx.status || 'Diterima'}</span>
                      </span>
                    </div>

                    {/* Horizontal Steps Track */}
                    <div className="relative flex items-start justify-between w-full px-2 pt-1 pb-2">
                      {/* Background connecting line */}
                      <div className="absolute left-6 right-6 top-[18px] h-0.5 bg-white/10 z-0" />
                      {/* Active progress fill line */}
                      <div
                        className="absolute left-6 top-[18px] h-0.5 bg-teal-500 transition-all duration-500 z-0"
                        style={{
                          width: activeSteps.length > 1
                            ? `${Math.min(100, Math.max(0, (Math.max(0, currentStepIdx) / (activeSteps.length - 1)) * 100))}%`
                            : '0%'
                        }}
                      />

                      {activeSteps.map((step, idx) => {
                        const isDone = idx < currentStepIdx || foundTx.status === 'Selesai';
                        const isCurrent = idx === currentStepIdx && foundTx.status !== 'Selesai';

                        return (
                          <div key={idx} className="relative z-10 flex flex-col items-center group flex-1">
                            {/* Step Circle */}
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] transition-all duration-300 ${
                                isDone
                                  ? 'bg-teal-500 text-slate-950 shadow-[0_0_12px_rgba(20,184,166,0.5)]'
                                  : isCurrent
                                  ? 'bg-[#061517] border-2 border-teal-400 text-teal-300 shadow-[0_0_15px_rgba(45,212,191,0.6)] scale-110'
                                  : 'bg-[#0c2427] border border-white/20 text-white/40'
                              }`}
                            >
                              {isDone ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : isCurrent ? (
                                <span className="w-2 h-2 rounded-full bg-teal-300 animate-ping" />
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>

                            {/* Step Label */}
                            <span
                              className={`mt-2 text-[10px] text-center transition-colors px-0.5 leading-tight line-clamp-2 ${
                                isCurrent
                                  ? 'text-teal-300 font-extrabold'
                                  : isDone
                                  ? 'text-white/80 font-medium'
                                  : 'text-white/30'
                              }`}
                            >
                              {step.label}
                            </span>
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
                {(() => {
                  const displayEstimasi = (() => {
                    if (foundTx.estimasi && String(foundTx.estimasi).trim()) return String(foundTx.estimasi).trim();
                    if (foundTx.estimasiSelesai && String(foundTx.estimasiSelesai).trim()) return String(foundTx.estimasiSelesai).trim();
                    if (isDropOffOrder) {
                      const prioritas = String(foundTx.tingkatLayanan || 'Reguler').toLowerCase();
                      const durasi = prioritas.includes('kilat') ? 6 : prioritas.includes('express') ? 24 : 48;
                      const baseDate = foundTx.tanggal ? new Date(foundTx.tanggal) : new Date();
                      const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
                      const targetDate = new Date(validBase.getTime() + durasi * 3600 * 1000);
                      const dateStr = targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                      const timeStr = targetDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      return `${dateStr}, ${timeStr} WIB (${durasi} Jam)`;
                    }
                    return '-';
                  })();

                  return (
                    <div className="bg-[#030d0f] rounded-xl p-3 border border-white/5 space-y-1.5 text-xs text-white/70 mb-4">
                      <div className="flex justify-between">
                        <span>Pelanggan</span>
                        <span className="text-white font-medium">{foundTx.namaPelanggan || 'Pelanggan'}</span>
                      </div>
                      {isDropOffOrder && (
                        <div className="flex justify-between">
                          <span>Estimasi Selesai</span>
                          <span className="text-white font-medium text-teal-300 font-mono">{displayEstimasi}</span>
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
                  );
                })()}

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

          {foundPoin && (() => {
            const memberCustomerData: PelangganItem = {
              noHp: foundPoin.noHp || phoneInput.trim(),
              maskedHp: foundPoin.maskedHp || phoneInput.trim(),
              nama: foundPoin.nama || foundPoin.maskedNama || 'Pelanggan Member',
              alamat: foundPoin.alamat || '',
              totalOrder: foundPoin.totalOrder || 0,
              totalSpend: foundPoin.totalSpend || 0,
              terakhirOrder: foundPoin.terakhirOrder || '-',
              catatan: '',
              isRepeatOrder: (foundPoin.totalOrder || 0) > 1,
              saldoPoin: foundPoin.saldoPoin || 0,
              isMember: foundPoin.isMember !== false,
              statusMember: foundPoin.statusMember || (foundPoin.isMember ? 'MEMBER VIP' : 'PELANGGAN REGULER'),
              statusKategori: foundPoin.statusKategori || (foundPoin.isMember ? 'Member' : 'Pelanggan Baru'),
              stamps75: foundPoin.stamps75 !== undefined ? foundPoin.stamps75 : 0,
              stamps45: foundPoin.stamps45 !== undefined ? foundPoin.stamps45 : 0,
              tglDaftar: foundPoin.tglDaftar || ''
            };

            return (
              <div className="w-full max-w-xl text-left mb-6 space-y-4 animate-fade-in">
                {/* 1. Digital Member Stamp Card (3D Flip & Rubber Stamp Seals) */}
                <div className="w-full">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Kartu Member & Stempel Digital Anda</span>
                    </div>
                    <span className="text-[10px] text-white/50">Klik kartu untuk membalik (3D Flip)</span>
                  </div>

                  <DigitalMemberCard
                    customer={memberCustomerData}
                    canEdit={false}
                  />
                </div>

                {/* 2. Saldo Poin & Summary Card */}
                <div className="rounded-2xl border border-[#153a3e] bg-[#061517] p-5 shadow-2xl space-y-4">
                  {/* Member Header */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
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
                  <div className="bg-[#030d0f] border border-teal-500/30 rounded-xl p-4 text-center shadow-inner">
                    <span className="text-[11px] text-teal-200/80 block font-medium mb-0.5">Total Saldo Poin Cashback</span>
                    <div className="text-3xl font-black font-mono text-white tracking-tight">
                      {foundPoin.saldoPoin} <span className="text-sm font-bold text-teal-300">Poin</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-1">
                      Kumpulkan stempel & tukarkan poin Anda langsung di kasir outlet Dua SiSi Laundry
                    </p>
                  </div>

                  {/* Reward & Stamp Quick Summary */}
                  <div className="bg-[#030d0f] rounded-xl p-3 border border-white/5 space-y-2 text-xs text-white/70">
                    <div className="flex items-center gap-2 text-white/80 font-medium">
                      <Gift className="w-3.5 h-3.5 text-teal-400" />
                      <span>Total Riwayat Cuci: {foundPoin.totalOrder} kali</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 text-[11px]">
                      <div className="bg-[#061517] p-2.5 rounded-lg border border-teal-500/20">
                        <span className="text-white/50 block text-[10px]">Stempel 7 KG:</span>
                        <span className="text-teal-300 font-bold font-mono text-xs">{foundPoin.stamps75 || 0} / 10 Stempel</span>
                      </div>
                      <div className="bg-[#061517] p-2.5 rounded-lg border border-teal-500/20">
                        <span className="text-white/50 block text-[10px]">Stempel 4 KG:</span>
                        <span className="text-teal-300 font-bold font-mono text-xs">{foundPoin.stamps45 || 0} / 10 Stempel</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Orders for this customer */}
                  {foundPoin.activeOrders && foundPoin.activeOrders.length > 0 && (
                    <div className="space-y-2">
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
              </div>
            );
          })()}

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

          {/* 6. Animated Scroll Down Indicator */}
          <div className="pt-8 sm:pt-10">
            <button
              type="button"
              onClick={() => {
                document.getElementById('pilihan-layanan')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group inline-flex flex-col items-center gap-1.5 text-white/50 hover:text-teal-300 transition cursor-pointer"
            >
              <span className="text-[11px] font-medium tracking-wide group-hover:text-white transition-colors">
                Scroll untuk info layanan & outlet
              </span>
              <div className="w-7 h-7 rounded-full border border-white/20 bg-white/[0.04] group-hover:border-teal-400 group-hover:bg-teal-950/60 flex items-center justify-center transition shadow-lg animate-bounce">
                <ChevronDown className="w-3.5 h-3.5 text-white/70 group-hover:text-teal-300 transition" />
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* 7. Penjelasan Layanan: Drop Off & Self Service (Section Terpisah di Bawah Lipatan) */}
      <section id="pilihan-layanan" className="relative z-20 w-full bg-[#040e10] py-20 border-t border-white/10 text-left">
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
        <div className="w-full h-[480px] sm:h-[560px] overflow-hidden relative">
          <DriftWall
            items={OUTLET_GALLERY}
            columns={5}
            tileWidth={280}
            tileHeight={185}
            gap={18}
            tilt={0}
            turn={0}
            roll={0}
            depth={0}
            speed={18}
            variance={0.2}
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
    </ClickSpark>
  );
}
