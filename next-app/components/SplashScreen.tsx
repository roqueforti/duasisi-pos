'use client';

import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Phase 1: 'drop' (tetesan air jatuh di atas background transparan 100%)
  // Phase 2: 'reveal' (background gelap menyapu lembut & logo Dua SiSi tampil)
  // Phase 3: 'exit' (fade out ke layar login)
  const [phase, setPhase] = useState<'drop' | 'reveal' | 'exit'>('drop');

  useEffect(() => {
    // 0s - 0.85s: Tetesan air & riak gelombang (100% transparan)
    const t1 = setTimeout(() => {
      setPhase('reveal');
    }, 850);

    // 0.85s - 2.2s: Logo Dua SiSi & progress indicator
    const t2 = setTimeout(() => {
      setPhase('exit');
    }, 2200);

    // 2.2s - 2.5s: Selesai & unmount
    const t3 = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden transition-all duration-500 select-none ${
        phase === 'drop'
          ? 'bg-transparent'
          : phase === 'reveal'
          ? 'bg-[#11292B] text-white'
          : 'bg-[#11292B] opacity-0 pointer-events-none'
      }`}
    >
      {/* FASE 1: ANIMASI TETESAN AIR (Background Transparan 100%) */}
      {phase === 'drop' && (
        <div className="relative flex items-center justify-center w-full h-full">
          {/* Tetesan Air Organik */}
          <div className="animate-water-drop absolute">
            <svg
              className="w-10 h-14 text-[#1E4648] filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.15)]"
              viewBox="0 0 24 32"
              fill="currentColor"
            >
              <path d="M12 0C12 0 0 14 0 20C0 26.6274 5.37258 32 12 32C18.6274 32 24 26.6274 24 20C24 14 12 0 12 0Z" />
            </svg>
          </div>

          {/* Gelombang Riak Air Halus */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full border border-[#1E4648]/40 animate-ripple-soft-1" />
            <div className="w-20 h-20 rounded-full border border-[#1E4648]/25 animate-ripple-soft-2" />
          </div>
        </div>
      )}

      {/* FASE 2 & 3: BACKGROUND GELAP & LOGO DUA SISI */}
      {phase !== 'drop' && (
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-6 animate-logo-reveal">
          {/* Logo Brand Dua SiSi */}
          <div className="mb-5">
            <img
              src="./assets/logo-full-white.svg"
              alt="Dua SiSi Laundry Express & Coin"
              className="h-12 w-auto brightness-0 invert opacity-95"
            />
          </div>

          {/* Minimalist Progress Line */}
          <div className="w-36 h-1 bg-white/10 rounded-full overflow-hidden mb-3 relative">
            <div className="h-full bg-[#2DD4BF] rounded-full animate-line-progress" />
          </div>

          {/* Subtitle */}
          <div className="text-[11px] font-medium text-slate-300 tracking-wider uppercase opacity-80">
            Express & Coin Laundry
          </div>
        </div>
      )}

      {/* Embedded Styles */}
      <style jsx>{`
        @keyframes waterDrop {
          0% {
            transform: translateY(-200px) scale(0.7);
            opacity: 0;
          }
          60% {
            opacity: 1;
          }
          85% {
            transform: translateY(0) scale(1.05);
          }
          100% {
            transform: translateY(0) scale(0.95);
            opacity: 0;
          }
        }

        @keyframes rippleSoft {
          0% {
            transform: scale(0.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(3.2);
            opacity: 0;
          }
        }

        @keyframes lineProgress {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }

        @keyframes logoReveal {
          0% {
            transform: scale(0.94);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-water-drop {
          animation: waterDrop 0.75s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .animate-ripple-soft-1 {
          animation: rippleSoft 0.8s ease-out 0.55s forwards;
        }
        .animate-ripple-soft-2 {
          animation: rippleSoft 0.8s ease-out 0.7s forwards;
        }

        .animate-line-progress {
          animation: lineProgress 1.3s ease-in-out forwards;
        }

        .animate-logo-reveal {
          animation: logoReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}


