'use client';

import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Phase 1: 'drop' (water drop falling, transparent background)
  // Phase 2: 'wave' (ripple wave expand, bg fill & Dua SiSi branding)
  // Phase 3: 'exit' (smooth fade out)
  const [phase, setPhase] = useState<'drop' | 'wave' | 'exit'>('drop');

  useEffect(() => {
    // 0s - 1.0s: Water drop falls & ripples (100% transparent bg)
    const t1 = setTimeout(() => {
      setPhase('wave');
    }, 1000);

    // 1.0s - 2.8s: Dua SiSi branding & wave fill
    const t2 = setTimeout(() => {
      setPhase('exit');
    }, 2800);

    // 2.8s - 3.2s: Finish & unmount
    const t3 = setTimeout(() => {
      onFinish();
    }, 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden transition-all duration-700 select-none ${
        phase === 'drop'
          ? 'bg-transparent'
          : phase === 'wave'
          ? 'bg-[#0A1719] text-white'
          : 'bg-[#0A1719] opacity-0 pointer-events-none'
      }`}
    >
      {/* PHASE 1: WATER DROP ANIMATION (Background is 100% Transparent) */}
      {phase === 'drop' && (
        <div className="relative flex items-center justify-center w-full h-full">
          {/* Falling Water Drop SVG */}
          <div className="animate-water-drop absolute">
            <svg
              className="w-12 h-16 text-teal-400 drop-shadow-[0_10px_25px_rgba(45,212,191,0.8)]"
              viewBox="0 0 24 32"
              fill="currentColor"
            >
              <path d="M12 0C12 0 0 14 0 20C0 26.6274 5.37258 32 12 32C18.6274 32 24 26.6274 24 20C24 14 12 0 12 0Z" />
            </svg>
          </div>

          {/* Concentric Water Ripple Waves upon impact */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-24 h-24 rounded-full border-2 border-teal-400/90 animate-ripple-1" />
            <div className="w-24 h-24 rounded-full border-2 border-cyan-300/70 animate-ripple-2" />
            <div className="w-24 h-24 rounded-full border-2 border-teal-200/50 animate-ripple-3" />
          </div>
        </div>
      )}

      {/* PHASE 2 & 3: WAVE FILL & DUA SISI BRANDING */}
      {phase !== 'drop' && (
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-6 animate-fade-in-scale">
          {/* Glowing Emblem Logo */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-teal-500/20 blur-2xl rounded-full animate-pulse" />
            <img
              src="./assets/logo-full-white.svg"
              alt="Dua SiSi Laundry Express & Coin"
              className="h-14 w-auto relative z-10 brightness-0 invert filter drop-shadow-[0_4px_16px_rgba(45,212,191,0.4)]"
            />
          </div>

          {/* Liquid Wave Progress Bar */}
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mb-4 relative">
            <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-300 rounded-full animate-wave-progress" />
          </div>

          {/* Loading Subtitle */}
          <div className="text-xs font-medium text-teal-200/90 tracking-wide flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
            <span>Memuat Sistem Kasir Dua SiSi POS...</span>
          </div>
        </div>
      )}

      {/* Embedded CSS Animations */}
      <style jsx>{`
        @keyframes waterDrop {
          0% {
            transform: translateY(-250px) scale(0.7);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          85% {
            transform: translateY(0) scale(1.1);
          }
          100% {
            transform: translateY(0) scale(0.9);
            opacity: 0;
          }
        }

        @keyframes ripple {
          0% {
            transform: scale(0.1);
            opacity: 1;
          }
          100% {
            transform: scale(3.5);
            opacity: 0;
          }
        }

        @keyframes waveProgress {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }

        @keyframes fadeInScale {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-water-drop {
          animation: waterDrop 0.85s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-ripple-1 {
          animation: ripple 0.9s ease-out 0.6s forwards;
        }
        .animate-ripple-2 {
          animation: ripple 0.9s ease-out 0.75s forwards;
        }
        .animate-ripple-3 {
          animation: ripple 0.9s ease-out 0.9s forwards;
        }

        .animate-wave-progress {
          animation: waveProgress 1.6s ease-in-out forwards;
        }

        .animate-fade-in-scale {
          animation: fadeInScale 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

