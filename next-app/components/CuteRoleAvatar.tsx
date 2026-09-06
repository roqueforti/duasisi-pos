'use client';

import React, { useState } from 'react';
import { 
  Crown, 
  Sparkles, 
  MessageCircleHeart
} from 'lucide-react';

export interface CuteRoleAvatarProps {
  role?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'squircle' | 'circle';
  className?: string;
  showBadge?: boolean;
  showFloatingBubbles?: boolean;
  showSparkle?: boolean;
  interactive?: boolean;
  bubblePlacement?: 'left' | 'right' | 'center';
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
  bubblePlacement = 'left',
  onClick
}: CuteRoleAvatarProps) {
  const isManager = (role || '').toUpperCase().includes('MANAGER') || (role || '').toUpperCase().includes('OWNER');
  
  const [isHovered, setIsHovered] = useState(false);
  const [isWiggling, setIsWiggling] = useState(false);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);

  // Size dimensions
  const sizeClasses = {
    sm: 'w-7 h-7 sm:w-8 sm:h-8',
    md: 'w-9 h-9 sm:w-9.5 sm:h-9.5',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }[size] || 'w-9 h-9';

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  // Role info & punchy cheer messages
  const roleInfo = isManager
    ? {
        name: 'Manager Outlet',
        badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500',
        ringColor: 'ring-2 ring-amber-400/80 shadow-amber-500/20',
        cheers: [
          'Outlet prima, cuan lancar!',
          'Semangat pantau outlet!',
          'Dua Sisi siap prima!',
          'Performa tim mantap!'
        ]
      }
    : {
        name: 'Kasir & Front Desk',
        badgeColor: 'bg-gradient-to-r from-teal-500 to-emerald-500',
        ringColor: 'ring-2 ring-teal-400/80 shadow-teal-500/20',
        cheers: [
          'Hai! Siap layani pelanggan.',
          'Baju wangi, pelanggan hepi!',
          'Semangat transaksi kasir!',
          'Pelayanan bersih & cepat!'
        ]
      };

  const handleClick = () => {
    setIsWiggling(true);
    setTimeout(() => setIsWiggling(false), 600);

    const randomCheer = roleInfo.cheers[Math.floor(Math.random() * roleInfo.cheers.length)];
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
      onClick={interactive ? handleClick : undefined}
      title={`${roleInfo.name} (Klik untuk interaksi!)`}
    >
      {/* Floating Interactive Speech Bubble - Clamped position prevents edge cut-off */}
      {speechBubble && (
        <div 
          className={`absolute -top-9 z-50 bg-slate-900/95 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-xl border border-slate-700/80 whitespace-nowrap animate-bounce flex items-center gap-1.5 pointer-events-none ${
            bubblePlacement === 'right' 
              ? 'right-0' 
              : bubblePlacement === 'center' 
              ? 'left-1/2 -translate-x-1/2' 
              : 'left-0'
          }`}
        >
          <MessageCircleHeart className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{speechBubble}</span>
          {/* Pointer indicator arrow directly aligned to avatar */}
          <div 
            className={`absolute -bottom-1 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700 ${
              bubblePlacement === 'right' 
                ? 'right-3.5' 
                : bubblePlacement === 'center' 
                ? 'left-1/2 -translate-x-1/2' 
                : 'left-3.5'
            }`} 
          />
        </div>
      )}

      {/* Floating Animated Soap Bubbles (Pure CSS micro-movement) */}
      {showFloatingBubbles && (
        <>
          {/* Top-Right Bubble */}
          <span 
            className={`absolute -top-1 -right-1 pointer-events-none z-20 rounded-full transition-transform duration-300 ${
              isHovered ? 'scale-125' : 'animate-bubble-float-a'
            }`}
            style={{
              width: size === 'sm' ? '7px' : '9px',
              height: size === 'sm' ? '7px' : '9px',
              background: isManager 
                ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(251,191,36,0.6) 45%, rgba(245,158,11,0.2) 80%)'
                : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(45,212,191,0.6) 45%, rgba(13,148,136,0.2) 80%)',
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
              width: size === 'sm' ? '5px' : '7px',
              height: size === 'sm' ? '5px' : '7px',
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

      {/* Main Avatar Container */}
      <div 
        className={`relative overflow-hidden flex items-center justify-center shadow-xs transition-all duration-300 ${sizeClasses} ${shapeClass} ${roleInfo.ringColor} ${
          isWiggling ? 'animate-mascot-wiggle' : isHovered ? 'scale-105 shadow-md -translate-y-0.5' : 'animate-mascot-bob'
        }`}
      >
        {isManager ? (
          /* ============================================================ */
          /* HUMAN VECTOR ASSET: MANAGER OUTLET (Modern, Warm, Refined)   */
          /* ============================================================ */
          <svg viewBox="0 0 64 64" className="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="mgr-vector-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFA726" />
                <stop offset="55%" stopColor="#FB8C00" />
                <stop offset="100%" stopColor="#E65100" />
              </linearGradient>
              <linearGradient id="mgr-suit-grad" x1="0" y1="45" x2="0" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>
              <linearGradient id="mgr-tie-grad" x1="0" y1="48" x2="0" y2="63" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>

            {/* Background */}
            <rect width="64" height="64" fill="url(#mgr-vector-bg)" />

            {/* Subtle luminous aura */}
            <circle cx="32" cy="27" r="23" fill="#FFFFFF" fillOpacity="0.14" />

            {/* Shoulders / Tailored Suit */}
            <path d="M 10 64 C 10 49, 18 45, 32 45 C 46 45, 54 49, 54 64 Z" fill="url(#mgr-suit-grad)" />

            {/* Crisp White Shirt Collar */}
            <path d="M 26 45 L 32 55 L 38 45 Z" fill="#FFFFFF" />

            {/* Golden Amber Tie */}
            <path d="M 30.5 48.5 L 33.5 48.5 L 34.5 58 L 32 63 L 29.5 58 Z" fill="url(#mgr-tie-grad)" stroke="#B45309" strokeWidth="0.5" />

            {/* Lapel Lines */}
            <path d="M 22 46 L 27 57 L 27 64" stroke="#334155" strokeWidth="1" strokeLinecap="round" fill="none" />
            <path d="M 42 46 L 37 57 L 37 64" stroke="#334155" strokeWidth="1" strokeLinecap="round" fill="none" />

            {/* Manager Gold Lapel Star Pin */}
            <polygon points="19,51 20,52.5 22,52.5 20.5,53.8 21,55.5 19,54.2 17,55.5 17.5,53.8 16,52.5 18,52.5" fill="#FDE047" stroke="#B45309" strokeWidth="0.4" />

            {/* Neck */}
            <rect x="29" y="38" width="6" height="9" rx="2" fill="#F7CEB6" />
            <path d="M 29 42 Q 32 45 35 42" stroke="#EAA886" strokeWidth="1" fill="none" opacity="0.6" />

            {/* Ears */}
            <circle cx="20.5" cy="31" r="2.8" fill="#F7CEB6" />
            <circle cx="20.5" cy="31" r="1.4" fill="#EAA886" opacity="0.4" />
            <circle cx="43.5" cy="31" r="2.8" fill="#F7CEB6" />
            <circle cx="43.5" cy="31" r="1.4" fill="#EAA886" opacity="0.4" />

            {/* Head / Natural Warm Skin Tone */}
            <path d="M 22 27 C 22 17, 42 17, 42 27 C 42 38, 37 43, 32 43 C 27 43, 22 38, 22 27 Z" fill="#FBD5B5" />

            {/* Subtle Rosy Cheeks */}
            <ellipse cx="25" cy="34" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.32" />
            <ellipse cx="39" cy="34" rx="2.5" ry="1.5" fill="#FB7185" opacity="0.32" />

            {/* Eyes with CSS Blinking Animation */}
            <g className="animate-eye-blink">
              <ellipse cx="27" cy="29.5" rx="2" ry="2.3" fill="#1E293B" />
              <ellipse cx="37" cy="29.5" rx="2" ry="2.3" fill="#1E293B" />
              <circle cx="26.3" cy="28.8" r="0.75" fill="#FFFFFF" />
              <circle cx="36.3" cy="28.8" r="0.75" fill="#FFFFFF" />
            </g>

            {/* Refined Eyebrows */}
            <path d="M 24.5 25.5 Q 27 24.5 29.5 25.5" stroke="#292524" strokeWidth="1.2" strokeLinecap="round" fill="none" />
            <path d="M 34.5 25.5 Q 37 24.5 39.5 25.5" stroke="#292524" strokeWidth="1.2" strokeLinecap="round" fill="none" />

            {/* Friendly Confident Smile */}
            <path d="M 29.5 36 Q 32 38.8 34.5 36" stroke="#9A3412" strokeWidth="1.3" strokeLinecap="round" fill="none" />

            {/* Sleek Modern Haircut */}
            <path d="M 19.5 27 C 18 18, 23 11, 33 11 C 42 11, 45 17, 44 26 C 42 21, 37 18.5, 31 18.5 C 26 18.5, 22 22, 19.5 27 Z" fill="#292524" />
            <path d="M 22 17 C 25 14.5, 31 14, 37 15" stroke="#44403C" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          /* ============================================================ */
          /* HUMAN VECTOR ASSET: KASIR / STAFF (Modern, Warm, Refined)    */
          /* ============================================================ */
          <svg viewBox="0 0 64 64" className="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="ksr-vector-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#14B8A6" />
                <stop offset="55%" stopColor="#0D9488" />
                <stop offset="100%" stopColor="#0F766E" />
              </linearGradient>
              <linearGradient id="ksr-shirt-grad" x1="0" y1="45" x2="0" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0F766E" />
                <stop offset="100%" stopColor="#115E59" />
              </linearGradient>
            </defs>

            {/* Background */}
            <rect width="64" height="64" fill="url(#ksr-vector-bg)" />

            {/* Subtle luminous aura */}
            <circle cx="32" cy="27" r="23" fill="#FFFFFF" fillOpacity="0.14" />

            {/* Shoulders / Dua Sisi Signature Teal Polo Uniform */}
            <path d="M 10 64 C 10 49, 18 45, 32 45 C 46 45, 54 49, 54 64 Z" fill="url(#ksr-shirt-grad)" />

            {/* Polo Collar & Placket */}
            <path d="M 25 45 L 32 53 L 39 45" stroke="#134E4A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="#134E4A" />
            <circle cx="32" cy="55.5" r="0.8" fill="#FFFFFF" />
            <circle cx="32" cy="59" r="0.8" fill="#FFFFFF" />

            {/* Dua Sisi Employee ID Badge on Chest */}
            <rect x="19" y="51" width="6.5" height="8" rx="1.2" fill="#FFFFFF" stroke="#0D9488" strokeWidth="0.5" />
            <rect x="20.5" y="52.5" width="3.5" height="2" rx="0.5" fill="#0D9488" />
            <line x1="20.5" y1="56" x2="24" y2="56" stroke="#94A3B8" strokeWidth="0.6" />
            <line x1="20.5" y1="57.5" x2="23" y2="57.5" stroke="#94A3B8" strokeWidth="0.6" />

            {/* Neck */}
            <rect x="29" y="38" width="6" height="9" rx="2" fill="#F7CEB6" />
            <path d="M 29 42 Q 32 45 35 42" stroke="#EAA886" strokeWidth="1" fill="none" opacity="0.6" />

            {/* Ears */}
            <circle cx="20.5" cy="31" r="2.8" fill="#F7CEB6" />
            <circle cx="43.5" cy="31" r="2.8" fill="#F7CEB6" />

            {/* Face / Natural Warm Skin Tone */}
            <path d="M 22 27 C 22 17, 42 17, 42 27 C 42 38, 37 43, 32 43 C 27 43, 22 38, 22 27 Z" fill="#FBD5B5" />

            {/* Cheerful Rosy Cheeks */}
            <circle cx="24.5" cy="34.5" r="2.6" fill="#F43F5E" opacity="0.35" />
            <circle cx="39.5" cy="34.5" r="2.6" fill="#F43F5E" opacity="0.35" />

            {/* Big Friendly Sparkling Eyes with Blinking Animation */}
            <g className="animate-eye-blink">
              <ellipse cx="27" cy="29.5" rx="2.2" ry="2.6" fill="#0F172A" />
              <ellipse cx="37" cy="29.5" rx="2.2" ry="2.6" fill="#0F172A" />
              <circle cx="26.2" cy="28.7" r="0.9" fill="#FFFFFF" />
              <circle cx="36.2" cy="28.7" r="0.9" fill="#FFFFFF" />
              <circle cx="27.8" cy="30.6" r="0.45" fill="#FFFFFF" />
              <circle cx="37.8" cy="30.6" r="0.45" fill="#FFFFFF" />
            </g>

            {/* Eyelashes */}
            <path d="M 24.5 27.5 Q 25.5 26.5 27 27" stroke="#0F172A" strokeWidth="1" strokeLinecap="round" />
            <path d="M 39.5 27.5 Q 38.5 26.5 37 27" stroke="#0F172A" strokeWidth="1" strokeLinecap="round" />

            {/* Warm Smiling Mouth */}
            <path d="M 28.5 35.5 Q 32 39.5 35.5 35.5" stroke="#991B1B" strokeWidth="1.5" strokeLinecap="round" fill="#FECDD3" />

            {/* Cute Hair with Side Ponytail */}
            <path d="M 19 27 C 17 16, 24 10.5, 32 10.5 C 40 10.5, 47 16, 45 27 C 45 31, 43 33.5, 41 31 C 40 25, 38 20.5, 32 20.5 C 26 20.5, 24 25, 23 31 C 21 33.5, 19 31, 19 27 Z" fill="#3B2014" />
            <ellipse cx="44.5" cy="22" rx="3.8" ry="6.5" fill="#3B2014" transform="rotate(22 44.5 22)" />
            <circle cx="43" cy="17.5" r="2.2" fill="#14B8A6" />

            {/* Front-Desk Cashier Headset */}
            <path d="M 19.5 29 C 19 18, 44.5 18, 44 29" stroke="#E2E8F0" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <rect x="18" y="27" width="3.2" height="5.5" rx="1.5" fill="#0D9488" stroke="#FFFFFF" strokeWidth="0.7" />
            <path d="M 19.5 31 Q 21.5 37.5 27 37" stroke="#CBD5E1" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <circle cx="27.5" cy="37" r="1.5" fill="#10B981" />
          </svg>
        )}
      </div>

      {/* Role Corner Badge */}
      {showBadge && (
        <div 
          className={`absolute -bottom-0.5 -right-0.5 z-30 rounded-full flex items-center justify-center ring-2 ring-white shadow-xs ${
            size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
          } ${roleInfo.badgeColor} text-white`}
          title={roleInfo.name}
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
