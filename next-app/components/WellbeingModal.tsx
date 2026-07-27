'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Heart, Sun, Smile, ArrowRight, ShieldCheck, Coffee, RefreshCw, Quote, Zap } from 'lucide-react';
import { UserRole } from '@/lib/types';

interface WellbeingModalProps {
  role: UserRole;
  label: string;
  onFinish: () => void;
}

const AFFIRMATIONS = [
  {
    category: 'Pelayanan Prima',
    icon: Sparkles,
    color: 'text-amber-300',
    iconBg: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
    glowColor: 'shadow-amber-500/25',
    title: 'Semangat Kerja Hari Ini! 🌟',
    quote: 'Pelayanan ramah dan senyumanmu hari ini membawa keberkahan serta kepuasan utama bagi setiap pelanggan Dua SiSi.'
  },
  {
    category: 'Kualitas & Dedikasi',
    icon: Heart,
    color: 'text-rose-300',
    iconBg: 'bg-rose-500/15 border-rose-400/40 text-rose-300',
    glowColor: 'shadow-rose-500/25',
    title: 'Terima Kasih Atas Dedikasimu 💖',
    quote: 'Ketelitian dan kebersihan laundry yang kamu selesaikan adalah alasan utama pelanggan selalu mempercayai layanan kita.'
  },
  {
    category: 'Kesehatan & Self-Care',
    icon: Coffee,
    color: 'text-teal-300',
    iconBg: 'bg-teal-500/15 border-teal-400/40 text-teal-300',
    glowColor: 'shadow-teal-500/25',
    title: 'Jaga Kesehatan & Wellbeing ☕',
    quote: 'Jangan lupa minum air putih yang cukup, istirahat sejenak di sela tugas, dan jaga selalu energi kebaikanmu!'
  },
  {
    category: 'Energi Positif',
    icon: Sun,
    color: 'text-yellow-300',
    iconBg: 'bg-yellow-500/15 border-yellow-400/40 text-yellow-300',
    glowColor: 'shadow-yellow-500/25',
    title: 'Hari Baru, Energi Positif ☀️',
    quote: 'Setiap lembar pakaian bersih yang kamu kerjakan adalah bukti profesionalisme tinggi dan hasil kerja terbaikmu.'
  },
  {
    category: 'Kebahagiaan Kerja',
    icon: Smile,
    color: 'text-emerald-300',
    iconBg: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300',
    glowColor: 'shadow-emerald-500/25',
    title: 'Suasana Kerja Bahagia 🌿',
    quote: 'Bekerja dengan rasa bahagia dan ikhlas akan membuat waktu berjalan cepat dan hasil kerjamu bernilai sangat tinggi.'
  },
  {
    category: 'Kerjasama Tim',
    icon: Zap,
    color: 'text-cyan-300',
    iconBg: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300',
    glowColor: 'shadow-cyan-500/25',
    title: 'Kekuatan Tim Dua SiSi ⚡',
    quote: 'Kerjasama yang hangat dan saling mendukung antar staf membuat pekerjaan terasa lebih ringan dan menyenangkan.'
  }
];

export default function WellbeingModal({ role, label, onFinish }: WellbeingModalProps) {
  const [affirmationIndex, setAffirmationIndex] = useState(0);
  const [greeting, setGreeting] = useState<{ main: string; sub: string }>({
    main: 'Selamat Bertugas!',
    sub: 'Semoga harimu menyenangkan'
  });
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isChanging, setIsChanging] = useState(false);

  const DURATION_MS = 4500; // 4.5 seconds auto dismiss
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Pick random initial affirmation
    const randomIndex = Math.floor(Math.random() * AFFIRMATIONS.length);
    setAffirmationIndex(randomIndex);

    // Time-based greeting
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting({ main: 'Selamat Pagi ☀️', sub: 'Semoga pagi ini penuh keberkahan & semangat baru!' });
    } else if (hour >= 12 && hour < 15) {
      setGreeting({ main: 'Selamat Siang 🌤️', sub: 'Tetap jaga kebugaran & tunjukkan performa terbaikmu!' });
    } else if (hour >= 15 && hour < 18) {
      setGreeting({ main: 'Selamat Sore 🌅', sub: 'Terima kasih atas kerja keras dan dedikasimu hari ini!' });
    } else {
      setGreeting({ main: 'Selamat Malam 🌙', sub: 'Tetap teliti, utamakan kenyamanan & keselamatan bertugas.' });
    }
  }, []);

  // Timer & Progress logic with pause support
  useEffect(() => {
    if (isPaused) return;

    const intervalStep = 50;
    const increment = (intervalStep / DURATION_MS) * 100;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          onFinish();
          return 100;
        }
        return prev + increment;
      });
    }, intervalStep);

    return () => clearInterval(interval);
  }, [isPaused, onFinish]);

  const handleNextQuote = () => {
    setIsChanging(true);
    setTimeout(() => {
      setAffirmationIndex((prev) => (prev + 1) % AFFIRMATIONS.length);
      setIsChanging(false);
      setProgress(0); // reset timer line
    }, 150);
  };

  const affirmation = AFFIRMATIONS[affirmationIndex];
  const IconComp = affirmation.icon;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      {/* Background Glowing Ambient Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/15 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/15 rounded-full blur-[90px] pointer-events-none animate-pulse animation-delay-1500" />

      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative bg-gradient-to-b from-slate-900/95 via-[#0c2426]/95 to-[#07191b]/98 border border-teal-500/30 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[0_20px_60px_-15px_rgba(13,148,136,0.35)] text-center overflow-hidden animate-pop-scale backdrop-blur-xl"
      >
        {/* Top Glowing Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400" />

        {/* Header Badge */}
        <div className="flex items-center justify-between mb-5">
          <div className="inline-flex items-center gap-2 bg-teal-950/70 border border-teal-500/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-teal-200 shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>{label || (role === 'MANAGER' ? 'Manager / Owner' : 'Staff / Kasir')}</span>
          </div>

          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/50">
            {affirmation.category}
          </span>
        </div>

        {/* Dynamic Icon with 3D Ring Glow */}
        <div className="relative mx-auto w-20 h-20 mb-4 flex items-center justify-center">
          <div className={`absolute inset-0 rounded-2xl blur-lg opacity-60 ${affirmation.glowColor}`} />
          <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border shadow-xl transition-all duration-300 transform hover:scale-105 ${affirmation.iconBg}`}>
            <IconComp className={`w-8 h-8 ${affirmation.color} ${isChanging ? 'scale-75 opacity-50' : 'scale-100 opacity-100'} transition-all duration-200`} />
          </div>
        </div>

        {/* Greeting & Title */}
        <div className="mb-4">
          <h2 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-teal-100 mb-1">
            {greeting.main}
          </h2>
          <p className="text-xs text-slate-400 font-medium mb-3">
            {greeting.sub}
          </p>
          <h3 className={`text-sm font-bold transition-all duration-200 ${affirmation.color} ${isChanging ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
            {affirmation.title}
          </h3>
        </div>

        {/* Positive Quote Box */}
        <div className="relative mb-5 text-left bg-slate-950/70 border border-teal-500/20 rounded-2xl p-4 sm:p-5 shadow-inner overflow-hidden group">
          <Quote className="absolute top-2 left-2 w-8 h-8 text-teal-500/10 pointer-events-none" />
          <Quote className="absolute bottom-2 right-2 w-8 h-8 text-teal-500/10 pointer-events-none rotate-180" />

          <p className={`relative z-10 text-xs sm:text-sm text-slate-200 leading-relaxed font-medium italic text-center transition-all duration-200 ${isChanging ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
            "{affirmation.quote}"
          </p>

          {/* Shuffle Quote Button */}
          <button
            type="button"
            onClick={handleNextQuote}
            title="Ganti motivasi baru"
            className="mt-3 mx-auto flex items-center gap-1.5 text-[11px] font-semibold text-teal-400 hover:text-teal-200 bg-teal-950/50 hover:bg-teal-900/60 border border-teal-500/30 px-3 py-1 rounded-full transition active:scale-95 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3 h-3 ${isChanging ? 'animate-spin' : ''}`} />
            <span>Ganti Motivation Quote</span>
          </button>
        </div>

        {/* Progress Line with Glowing Tip */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 mb-1.5 px-0.5">
            <span>{isPaused ? '⏸️ Jeda saat kursor di atas modal' : '⚡ Otomatis masuk aplikasi...'}</span>
            <span>{Math.min(100, Math.round(progress))}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden relative border border-slate-700/40">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full transition-all duration-75 relative shadow-[0_0_12px_#2DD4BF]"
              ref={(el) => {
                if (el) el.style.width = `${progress}%`;
              }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_#ffffff]" />
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onFinish}
          className="w-full group relative overflow-hidden bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 hover:from-teal-400 hover:via-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold py-3.5 px-6 rounded-2xl text-sm transition-all duration-200 shadow-[0_8px_25px_-5px_rgba(16,185,129,0.4)] hover:shadow-[0_12px_30px_-5px_rgba(16,185,129,0.6)] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 border border-teal-300/40"
        >
          <span className="relative z-10 tracking-wide font-extrabold">Siap Bertugas & Melayani</span>
          <ArrowRight className="w-4 h-4 text-slate-950 relative z-10 transition-transform duration-200 group-hover:translate-x-1" />
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
        </button>
      </div>
    </div>
  );
}

