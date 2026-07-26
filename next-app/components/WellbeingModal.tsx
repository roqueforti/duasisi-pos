'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Heart, Sun, Smile, ArrowRight, ShieldCheck, Coffee } from 'lucide-react';
import { UserRole } from '@/lib/types';

interface WellbeingModalProps {
  role: UserRole;
  label: string;
  onFinish: () => void;
}

const AFFIRMATIONS = [
  {
    icon: Sparkles,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-400/30',
    title: 'Semangat Kerja Hari Ini! 🌟',
    quote: 'Pelayanan ramah dan senyumanmu hari ini membawa keberkahan serta kepuasan bagi setiap pelanggan Dua SiSi.'
  },
  {
    icon: Heart,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10 border-rose-400/30',
    title: 'Terima Kasih Atas Kerja Kerasmu 💖',
    quote: 'Ketelitian dan kebersihan laundry yang kamu selesaikan adalah alasan utama pelanggan selalu merasa puas.'
  },
  {
    icon: Coffee,
    color: 'text-teal-300',
    bgColor: 'bg-teal-500/10 border-teal-400/30',
    title: 'Jaga Kesehatan & Wellbeing ☕',
    quote: 'Jangan lupa minum air putih yang cukup, istirahat sejenak di sela tugas, dan jaga selalu kesehatanmu!'
  },
  {
    icon: Sun,
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-500/10 border-yellow-400/30',
    title: 'Hari Baru, Energi Positif Baru ☀️',
    quote: 'Setiap lembar pakaian bersih yang kamu kerjakan adalah bukti profesionalisme dan dedikasi terbaikmu.'
  },
  {
    icon: Smile,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-400/30',
    title: 'Suasana Kerja Bahagia 🌿',
    quote: 'Kerja dengan ikhlas dan gembira akan membuat waktu berjalan cepat dan hasil kerjamu bernilai tinggi.'
  }
];

export default function WellbeingModal({ role, label, onFinish }: WellbeingModalProps) {
  const [affirmation, setAffirmation] = useState(AFFIRMATIONS[0]);
  const [greeting, setGreeting] = useState<string>('Selamat Bertugas!');

  useEffect(() => {
    // Pick random affirmation
    const randomIndex = Math.floor(Math.random() * AFFIRMATIONS.length);
    setAffirmation(AFFIRMATIONS[randomIndex]);

    // Time-based greeting
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('Selamat Pagi ☀️');
    } else if (hour >= 12 && hour < 18) {
      setGreeting('Selamat Siang 🌤️');
    } else {
      setGreeting('Selamat Malam 🌙');
    }

    // Auto finish after 3.8s if not clicked
    const timer = setTimeout(() => {
      onFinish();
    }, 3800);

    return () => clearTimeout(timer);
  }, [onFinish]);

  const IconComp = affirmation.icon;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/90 animate-fade-in select-none">
      <div className="relative bg-[#11292B] border border-slate-700 text-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center overflow-hidden animate-scale-up">
        {/* Role Badge */}
        <div className="inline-flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700 text-xs font-semibold text-teal-200 mb-5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>{label || (role === 'MANAGER' ? 'Manager / Owner' : 'Staff / Kasir')}</span>
        </div>

        {/* Dynamic Icon */}
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 border ${affirmation.bgColor} shadow-md animate-bounce-subtle`}>
          <IconComp className={`w-8 h-8 ${affirmation.color}`} />
        </div>

        {/* Greeting & Title */}
        <h2 className="text-xl font-bold tracking-tight text-white mb-1">
          {greeting}
        </h2>
        <h3 className={`text-sm font-semibold mb-3 ${affirmation.color}`}>
          {affirmation.title}
        </h3>

        {/* Positive Quote Text */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6 font-normal px-3 py-3.5 rounded-xl bg-slate-900 border border-slate-800">
          "{affirmation.quote}"
        </p>

        {/* Progress Line */}
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-6 relative">
          <div className="h-full bg-[#2DD4BF] rounded-full animate-wellbeing-progress" />
        </div>

        {/* Action Button */}
        <button
          onClick={onFinish}
          className="w-full bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-3 px-6 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 border border-teal-400/30 shadow-md active:scale-98"
        >
          <span>Siap Bertugas & Melayani 🚀</span>
          <ArrowRight className="w-4 h-4 text-teal-300" />
        </button>
      </div>

      <style jsx>{`
        @keyframes wellbeingProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes bounceSubtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-wellbeing-progress {
          animation: wellbeingProgress 3.8s linear forwards;
        }
        .animate-bounce-subtle {
          animation: bounceSubtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
