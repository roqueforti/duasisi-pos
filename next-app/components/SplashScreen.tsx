'use client';

import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setFadeOut(true);
    }, 1400);

    const timer2 = setTimeout(() => {
      onFinish();
    }, 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div className={`fixed inset-0 z-[2000] bg-[#11292B] flex flex-col items-center justify-center p-6 text-white transition-opacity duration-500 select-none ${
      fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}>
      {/* Brand Full White Logo */}
      <div className="mb-8 animate-pop-scale">
        <img 
          src="./assets/logo-full-white.svg" 
          alt="Dua SiSi Laundry Express & Coin" 
          className="h-16 w-auto max-w-xs drop-shadow-xl brightness-0 invert"
        />
      </div>

      {/* Modern Spinner */}
      <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-2 rounded-2xl backdrop-blur-md shadow-lg animate-pulse">
        <div className="w-4 h-4 border-2 border-teal-300 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-black tracking-wide text-teal-100">Memuat Sistem POS...</span>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 text-[11px] font-bold text-teal-200/50">
        Dua SiSi Smart Laundry Management System v2.5
      </div>
    </div>
  );
}
