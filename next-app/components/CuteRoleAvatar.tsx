'use client';

import React, { useState } from 'react';
import { Sparkles, Crown, MessageCircleHeart } from 'lucide-react';

export interface CuteRoleAvatarProps {
  role?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'squircle' | 'circle';
  className?: string;
  showBadge?: boolean;
  showFloatingBubbles?: boolean;
  showSparkle?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export default function CuteRoleAvatar({
  role = 'STAFF',
  size = 'md',
  shape = 'squircle',
  className = '',
  showBadge = true,
  showFloatingBubbles = true,
  showSparkle = true,
  interactive = true,
  onClick
}: CuteRoleAvatarProps) {
  const isManager = (role || '').toUpperCase().includes('MANAGER') || (role || '').toUpperCase().includes('OWNER');
  
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isWiggling, setIsWiggling] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);

  // Size dimensions
  const sizeClasses = {
    sm: 'w-7 h-7 sm:w-8 sm:h-8 text-xs',
    md: 'w-9 h-9 sm:w-9.5 sm:h-9.5 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  }[size] || 'w-9 h-9';

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  // Mascot details
  const mascotInfo = isManager
    ? {
        name: 'Bubu',
        title: 'Manager Outlet',
        badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500',
        ringColor: 'ring-2 ring-amber-400/80 shadow-amber-500/20',
        src: '/assets/mascots/avatar-manager.jpg',
        cheers: [
          'Outlet bersih, cuan mengalir! ✨',
          'Halo Manager! Semangat monitoring ya! 👑',
          'Laundromat Dua Sisi siap prima hari ini! 🧺'
        ]
      }
    : {
        name: 'Mimi',
        title: 'Kasir & Front Desk',
        badgeColor: 'bg-gradient-to-r from-teal-500 to-emerald-500',
        ringColor: 'ring-2 ring-teal-400/80 shadow-teal-500/20',
        src: '/assets/mascots/avatar-kasir.jpg',
        cheers: [
          'Hai kak! Siap bantu pelanggan nih! 🫧',
          'Baju wangi, pelanggan hepi! ✨',
          'Semangat layani antrean kasir hari ini! 🧺'
        ]
      };

  const handleMascotClick = () => {
    setIsWiggling(true);
    setTimeout(() => setIsWiggling(false), 600);

    // Pick random cheer
    const randomCheer = mascotInfo.cheers[Math.floor(Math.random() * mascotInfo.cheers.length)];
    setSpeechBubble(randomCheer);
    setTimeout(() => {
      setSpeechBubble(null);
    }, 2400);

    if (onClick) onClick();
  };

  return (
    <div 
      className={`relative select-none inline-block shrink-0 ${interactive ? 'cursor-pointer' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={interactive ? handleMascotClick : undefined}
      title={`${mascotInfo.name} — ${mascotInfo.title} (Klik untuk sapa!)`}
    >
      {/* Floating Interactive Speech Bubble */}
      {speechBubble && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap animate-bounce flex items-center gap-1 pointer-events-none">
          <MessageCircleHeart className="w-3 h-3 text-amber-400 shrink-0" />
          <span>{speechBubble}</span>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700" />
        </div>
      )}

      {/* Floating Animated Soap Bubbles (Micro movements) */}
      {showFloatingBubbles && (
        <>
          {/* Top-Right Bubble */}
          <span 
            className={`absolute -top-1 -right-1 pointer-events-none z-20 rounded-full transition-transform duration-300 ${
              isHovered ? 'scale-125' : 'animate-bubble-float-a'
            }`}
            style={{
              width: size === 'sm' ? '8px' : '10px',
              height: size === 'sm' ? '8px' : '10px',
              background: isManager 
                ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(251,191,36,0.5) 45%, rgba(245,158,11,0.2) 80%)'
                : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(45,212,191,0.5) 45%, rgba(13,148,136,0.2) 80%)',
              boxShadow: '0 0 4px rgba(255,255,255,0.8), inset 0 0 2px rgba(255,255,255,0.9)',
              border: '0.5px solid rgba(255,255,255,0.7)'
            }}
          />

          {/* Bottom-Left Mini Bubble */}
          <span 
            className={`absolute -bottom-0.5 -left-1 pointer-events-none z-20 rounded-full transition-transform duration-300 ${
              isHovered ? 'scale-125' : 'animate-bubble-float-b'
            }`}
            style={{
              width: size === 'sm' ? '6px' : '8px',
              height: size === 'sm' ? '6px' : '8px',
              background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.95), rgba(165,243,252,0.6) 50%, rgba(56,189,248,0.2) 85%)',
              boxShadow: '0 0 3px rgba(255,255,255,0.7), inset 0 0 2px rgba(255,255,255,0.8)',
              border: '0.5px solid rgba(255,255,255,0.6)'
            }}
          />
        </>
      )}

      {/* Twinkling Sparkle Star */}
      {showSparkle && (
        <span 
          className={`absolute -top-1.5 left-0 pointer-events-none z-20 transition-opacity duration-300 ${
            isHovered ? 'opacity-100 scale-125' : 'animate-sparkle-twinkle'
          }`}
        >
          <Sparkles className={`w-2.5 h-2.5 ${isManager ? 'text-amber-400 fill-amber-300' : 'text-teal-300 fill-teal-200'}`} />
        </span>
      )}

      {/* Main Mascot Avatar Frame */}
      <div 
        className={`relative overflow-hidden flex items-center justify-center shadow-sm transition-all duration-300 ${sizeClasses} ${shapeClass} ${mascotInfo.ringColor} ${
          isWiggling ? 'animate-mascot-wiggle' : isHovered ? 'scale-105 shadow-md -translate-y-0.5' : 'animate-mascot-bob'
        } ${isManager ? 'bg-[#FF9500]' : 'bg-[#1E4648]'}`}
      >
        {!imgError ? (
          <img
            src={mascotInfo.src}
            alt={`${mascotInfo.name} ${mascotInfo.title}`}
            className="w-full h-full object-cover select-none pointer-events-none"
            loading="eager"
            onError={() => setImgError(true)}
          />
        ) : (
          /* High quality animated SVG vector fallback mascot if image is unavailable */
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full p-0.5 select-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background gradient */}
            <rect width="64" height="64" rx="16" fill={isManager ? 'url(#m-grad)' : 'url(#k-grad)'} />
            <defs>
              <linearGradient id="m-grad" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
              <linearGradient id="k-grad" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#14B8A6" />
                <stop offset="100%" stopColor="#0F766E" />
              </linearGradient>
            </defs>

            {/* Cute Cat Mascot Base */}
            {/* Left Ear */}
            <polygon points="16,28 10,12 26,18" fill={isManager ? '#FED7AA' : '#F8FAFC'} />
            <polygon points="16,26 12,15 23,19" fill="#F472B6" opacity="0.6" />
            
            {/* Right Ear */}
            <polygon points="48,28 54,12 38,18" fill={isManager ? '#FED7AA' : '#F8FAFC'} />
            <polygon points="48,26 52,15 41,19" fill="#F472B6" opacity="0.6" />

            {/* Head */}
            <ellipse cx="32" cy="36" rx="20" ry="17" fill={isManager ? '#FED7AA' : '#FFFFFF'} />

            {/* Blushing Cheeks */}
            <circle cx="21" cy="40" r="3.5" fill="#FB7185" opacity="0.5" />
            <circle cx="43" cy="40" r="3.5" fill="#FB7185" opacity="0.5" />

            {/* Eyes */}
            <ellipse cx="24" cy="34" rx="2.5" ry="3.5" fill="#1E293B" />
            <ellipse cx="40" cy="34" rx="2.5" ry="3.5" fill="#1E293B" />
            <circle cx="23" cy="33" r="1.2" fill="#FFFFFF" />
            <circle cx="39" cy="33" r="1.2" fill="#FFFFFF" />

            {/* Nose & Mouth */}
            <polygon points="30.5,38 33.5,38 32,40" fill="#F43F5E" />
            <path d="M 29 41 Q 32 44 35 41" stroke="#334155" strokeWidth="1.2" strokeLinecap="round" fill="none" />

            {/* Manager Bowtie OR Cashier Headset */}
            {isManager ? (
              <g transform="translate(24, 48)">
                <polygon points="0,2 7,6 0,10" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
                <polygon points="16,2 9,6 16,10" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
                <circle cx="8" cy="6" r="2.5" fill="#EAB308" />
              </g>
            ) : (
              <g>
                <path d="M 12 34 C 12 18, 52 18, 52 34" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <circle cx="52" cy="34" r="3.5" fill="#0F766E" />
                <path d="M 52 35 Q 48 46 38 46" stroke="#0D9488" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                <circle cx="38" cy="46" r="2" fill="#14B8A6" />
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Role Corner Badge */}
      {showBadge && (
        <div 
          className={`absolute -bottom-0.5 -right-0.5 z-30 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs ${
            size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
          } ${mascotInfo.badgeColor} text-white`}
          title={mascotInfo.title}
        >
          {isManager ? (
            <Crown className={size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'} />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}
