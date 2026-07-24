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
    }, 1200);

    const timer2 = setTimeout(() => {
      onFinish();
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div className={`fixed inset-0 z-[2000] bg-[#11292B] flex flex-col items-center justify-center p-6 text-white transition-opacity duration-300 select-none ${
      fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}>
      {/* Logo */}
      <div className="mb-6">
        <img 
          src="./assets/logo-full-white.svg" 
          alt="Dua SiSi Laundry Express & Coin" 
          className="h-12 w-auto brightness-0 invert"
        />
      </div>

      {/* Clean Spinner */}
      <div className="flex items-center gap-2.5 text-slate-300">
        <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium tracking-wide">Memuat POS...</span>
      </div>
    </div>
  );
}
