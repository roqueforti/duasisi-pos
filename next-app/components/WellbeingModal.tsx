'use client';

import React, { useEffect, useState } from 'react';
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
    color: 'text-[#1E4648]',
    iconBg: 'bg-teal-50 border-teal-200 text-[#1E4648]',
    title: 'Semangat Kerja Hari Ini!',
    quote: 'Pelayanan ramah dan senyumanmu hari ini membawa keberkahan serta kepuasan utama bagi setiap pelanggan Dua SiSi.'
  },
  {
    category: 'Kualitas & Dedikasi',
    icon: Heart,
    color: 'text-rose-600',
    iconBg: 'bg-rose-50 border-rose-200 text-rose-600',
    title: 'Terima Kasih Atas Dedikasimu',
    quote: 'Ketelitian dan kebersihan laundry yang kamu selesaikan adalah alasan utama pelanggan selalu mempercayai layanan kita.'
  },
  {
    category: 'Kesehatan & Self-Care',
    icon: Coffee,
    color: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    title: 'Jaga Kesehatan & Wellbeing',
    quote: 'Jangan lupa minum air putih yang cukup, istirahat sejenak di sela tugas, dan jaga selalu energi kebaikanmu!'
  },
  {
    category: 'Energi Positif',
    icon: Sun,
    color: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200 text-amber-600',
    title: 'Hari Baru, Energi Positif',
    quote: 'Setiap lembar pakaian bersih yang kamu kerjakan adalah bukti profesionalisme tinggi dan hasil kerja terbaikmu.'
  },
  {
    category: 'Kebahagiaan Kerja',
    icon: Smile,
    color: 'text-teal-700',
    iconBg: 'bg-teal-50 border-teal-200 text-teal-700',
    title: 'Suasana Kerja Bahagia',
    quote: 'Bekerja dengan rasa bahagia dan ikhlas akan membuat waktu berjalan cepat dan hasil kerjamu bernilai sangat tinggi.'
  },
  {
    category: 'Kerjasama Tim',
    icon: Zap,
    color: 'text-indigo-600',
    iconBg: 'bg-indigo-50 border-indigo-200 text-indigo-600',
    title: 'Kekuatan Tim Dua SiSi',
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

  useEffect(() => {
    // Pick random initial affirmation
    const randomIndex = Math.floor(Math.random() * AFFIRMATIONS.length);
    setAffirmationIndex(randomIndex);

    // Time-based greeting
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting({ main: 'Selamat Pagi', sub: 'Semoga pagi ini penuh keberkahan & semangat baru!' });
    } else if (hour >= 12 && hour < 15) {
      setGreeting({ main: 'Selamat Siang', sub: 'Tetap jaga kebugaran & tunjukkan performa terbaikmu!' });
    } else if (hour >= 15 && hour < 18) {
      setGreeting({ main: 'Selamat Sore', sub: 'Terima kasih atas kerja keras dan dedikasimu hari ini!' });
    } else {
      setGreeting({ main: 'Selamat Malam', sub: 'Tetap teliti, utamakan kenyamanan & keselamatan bertugas.' });
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
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in select-none">
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative bg-white text-slate-800 rounded-lg p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 text-center overflow-hidden animate-pop-scale"
      >
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#1E4648]" />

        {/* Header Badge */}
        <div className="flex items-center justify-between mb-4 pt-1">
          <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full text-xs font-semibold text-[#1E4648]">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>{label || (role === 'MANAGER' ? 'Manager / Owner' : 'Staff / Kasir')}</span>
          </div>

          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-md">
            {affirmation.category}
          </span>
        </div>

        {/* Icon */}
        <div className="mx-auto w-14 h-14 mb-3 flex items-center justify-center">
          <div className={`w-14 h-14 rounded-lg flex items-center justify-center border shadow-xs transition-all duration-200 ${affirmation.iconBg}`}>
            <IconComp className={`w-7 h-7 ${isChanging ? 'scale-75 opacity-50' : 'scale-100 opacity-100'} transition-all duration-200`} />
          </div>
        </div>

        {/* Greeting & Title */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-slate-900 mb-0.5">
            {greeting.main}
          </h2>
          <p className="text-xs text-slate-500 mb-2">
            {greeting.sub}
          </p>
          <h3 className={`text-xs font-bold ${affirmation.color} transition-all duration-200 ${isChanging ? 'opacity-0' : 'opacity-100'}`}>
            {affirmation.title}
          </h3>
        </div>

        {/* Quote Box */}
        <div className="relative mb-4 text-left bg-slate-50 border border-slate-200/80 rounded-lg p-4 overflow-hidden">
          <Quote className="absolute top-2 left-2 w-6 h-6 text-slate-300 pointer-events-none" />
          <Quote className="absolute bottom-2 right-2 w-6 h-6 text-slate-300 pointer-events-none rotate-180" />

          <p className={`relative z-10 text-xs sm:text-xs text-slate-700 leading-relaxed font-medium italic text-center transition-all duration-200 ${isChanging ? 'opacity-0' : 'opacity-100'}`}>
            "{affirmation.quote}"
          </p>

          {/* Shuffle Button */}
          <button
            type="button"
            onClick={handleNextQuote}
            title="Ganti motivasi baru"
            className="mt-2.5 mx-auto flex items-center gap-1.5 text-[11px] font-semibold text-[#1E4648] hover:text-[#153334] bg-white hover:bg-teal-50 border border-slate-200 px-3 py-1 rounded-full transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3 h-3 ${isChanging ? 'animate-spin' : ''}`} />
            <span>Ganti Motivation Quote</span>
          </button>
        </div>

        {/* Progress Line */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mb-1.5 px-0.5">
            <span>{isPaused ? '⏸️ Jeda saat kursor di atas modal' : 'Melanjutkan ke aplikasi...'}</span>
            <span>{Math.min(100, Math.round(progress))}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative border border-slate-200">
            <div
              className="h-full bg-[#1E4648] rounded-full transition-all duration-75"
              ref={(el) => {
                if (el) el.style.width = `${progress}%`;
              }}
            />
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onFinish}
          className="w-full bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-2.5 px-5 rounded-lg text-xs transition-all shadow-sm active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Siap Bertugas & Melayani</span>
          <ArrowRight className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
