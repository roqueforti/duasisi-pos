'use client';

import React, { useState } from 'react';
import { 
  Crown, 
  Sparkles, 
  Store, 
  MessageCircleHeart,
  Shield
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

  // Role info
  const roleInfo = isManager
    ? {
        name: 'Manager Outlet',
        badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500',
        ringColor: 'ring-2 ring-amber-400/80 shadow-amber-500/20',
        cheers: [
          'Outlet bersih, cuan lancar!',
          'Halo Manager! Semangat monitoring ya.',
          'Dua Sisi Laundromat siap prima hari ini!'
        ]
      }
    : {
        name: 'Kasir & Front Desk',
        badgeColor: 'bg-gradient-to-r from-teal-500 to-emerald-500',
        ringColor: 'ring-2 ring-teal-400/80 shadow-teal-500/20',
        cheers: [
          'Hai kak! Siap melayani pelanggan.',
          'Baju wangi, pelanggan hepi!',
          'Semangat layani antrean kasir hari ini!'
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
      {/* Floating Interactive Speech Bubble */}
      {speechBubble && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap animate-bounce flex items-center gap-1 pointer-events-none">
          <MessageCircleHeart className="w-3 h-3 text-amber-400 shrink-0" />
          <span>{speechBubble}</span>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-r border-b border-slate-700" />
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
          /* HUMAN VECTOR ASSET: MANAGER OUTLET (100% Clean Vector SVG)   */
          /* ============================================================ */
          <svg viewBox="0 0 64 64" className="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="mgr-vector-bg" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#FFA726" />
                <stop offset="50%" stopColor="#FB8C00" />
                <stop offset="100%" stopColor="#E65100" />
              </linearGradient>
            </defs>

            {/* Background */}
            <rect width="64" height="64" fill="url(#mgr-vector-bg)" />

            {/* Subtle light aura */}
            <circle cx="32" cy="28" r="22" fill="#FFFFFF" fillOpacity="0.15" />

            {/* Shoulders / Blazer */}
            <path d="M 12 64 C 12 50, 20 46, 32 46 C 44 46, 52 50, 52 64 Z" fill="#1E293B" />

            {/* White Shirt Collar */}
            <path d="M 27 46 L 32 55 L 37 46 Z" fill="#FFFFFF" />

            {/* Gold / Amber Tie */}
            <path d="M 30.5 49 L 33.5 49 L 34.5 59 L 32 63 L 29.5 59 Z" fill="#F59E0B" stroke="#D97706" strokeWidth="0.6" />

            {/* Manager Gold Star Badge on Lapel */}
            <polygon points="21,51 22,53 24,53 22.5,54.5 23,56.5 21,55 19,56.5 19.5,54.5 18,53 20,53" fill="#FDE047" stroke="#B45309" strokeWidth="0.4" />

            {/* Neck */}
            <rect x="29" y="39" width="6" height="8" rx="2" fill="#FED7AA" />

            {/* Ears */}
            <circle cx="21" cy="32" r="3" fill="#FED7AA" />
            <circle cx="43" cy="32" r="3" fill="#FED7AA" />

            {/* Face */}
            <path d="M 22 28 C 22 18, 42 18, 42 28 C 42 39, 37 44, 32 44 C 27 44, 22 39, 22 28 Z" fill="#FDE68A" />

            {/* Rosy Cheeks */}
            <circle cx="25" cy="35" r="2.5" fill="#FB7185" opacity="0.4" />
            <circle cx="39" cy="35" r="2.5" fill="#FB7185" opacity="0.4" />

            {/* Eyes with CSS Blinking Animation */}
            <g className="animate-eye-blink">
              <circle cx="27" cy="30" r="2.2" fill="#1E293B" />
              <circle cx="37" cy="30" r="2.2" fill="#1E293B" />
              <circle cx="26.3" cy="29.2" r="0.8" fill="#FFFFFF" />
              <circle cx="36.3" cy="29.2" r="0.8" fill="#FFFFFF" />
            </g>

            {/* Eyebrows */}
            <path d="M 25 26 Q 27 25 29 26" stroke="#451A03" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 35 26 Q 37 25 39 26" stroke="#451A03" strokeWidth="1.2" strokeLinecap="round" />

            {/* Friendly Confident Smile */}
            <path d="M 29 37 Q 32 40 35 37" stroke="#78350F" strokeWidth="1.4" strokeLinecap="round" fill="none" />

            {/* Professional Hair */}
            <path d="M 20 28 C 18 19, 22 12, 33 12 C 43 12, 45 18, 44 26 C 42 22, 38 19, 33 19 C 27 19, 23 23, 20 28 Z" fill="#292524" />
            <path d="M 20 24 C 20 21, 23 18, 28 17" stroke="#44403C" strokeWidth="1" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          /* ============================================================ */
          /* HUMAN VECTOR ASSET: KASIR / STAFF (100% Clean Vector SVG)   */
          /* ============================================================ */
          <svg viewBox="0 0 64 64" className="w-full h-full select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="ksr-vector-bg" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#14B8A6" />
                <stop offset="50%" stopColor="#0D9488" />
                <stop offset="100%" stopColor="#0F766E" />
              </linearGradient>
            </defs>

            {/* Background */}
            <rect width="64" height="64" fill="url(#ksr-vector-bg)" />

            {/* Subtle light aura */}
            <circle cx="32" cy="28" r="22" fill="#FFFFFF" fillOpacity="0.15" />

            {/* Shoulders / Dua Sisi Teal Polo Uniform */}
            <path d="M 12 64 C 12 50, 20 46, 32 46 C 44 46, 52 50, 52 64 Z" fill="#0F766E" />

            {/* Polo Collar */}
            <path d="M 26 46 L 32 54 L 38 46" stroke="#134E4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="#115E59" />
            <circle cx="32" cy="56" r="0.8" fill="#FFFFFF" />
            <circle cx="32" cy="59" r="0.8" fill="#FFFFFF" />

            {/* Dua Sisi Employee ID Badge on Chest */}
            <rect x="20" y="52" width="6" height="7" rx="1.2" fill="#FFFFFF" stroke="#0D9488" strokeWidth="0.5" />
            <rect x="21" y="53.5" width="4" height="2" rx="0.5" fill="#0D9488" />

            {/* Neck */}
            <rect x="29" y="39" width="6" height="8" rx="2" fill="#FED7AA" />

            {/* Ears */}
            <circle cx="21" cy="32" r="3" fill="#FED7AA" />
            <circle cx="43" cy="32" r="3" fill="#FED7AA" />

            {/* Face */}
            <path d="M 22 28 C 22 18, 42 18, 42 28 C 42 39, 37 44, 32 44 C 27 44, 22 39, 22 28 Z" fill="#FED7AA" />

            {/* Cheerful Rosy Cheeks */}
            <circle cx="24" cy="35" r="2.8" fill="#F43F5E" opacity="0.45" />
            <circle cx="40" cy="35" r="2.8" fill="#F43F5E" opacity="0.45" />

            {/* Big Friendly Eyes with Blinking Animation */}
            <g className="animate-eye-blink">
              <ellipse cx="27" cy="30" rx="2.2" ry="2.6" fill="#0F172A" />
              <ellipse cx="37" cy="30" rx="2.2" ry="2.6" fill="#0F172A" />
              <circle cx="26.3" cy="29" r="0.9" fill="#FFFFFF" />
              <circle cx="36.3" cy="29" r="0.9" fill="#FFFFFF" />
              <circle cx="27.8" cy="31" r="0.4" fill="#FFFFFF" />
              <circle cx="37.8" cy="31" r="0.4" fill="#FFFFFF" />
            </g>

            {/* Eyelashes */}
            <path d="M 24.5 28 Q 25.5 27 27 27.5" stroke="#0F172A" strokeWidth="1" strokeLinecap="round" />
            <path d="M 39.5 28 Q 38.5 27 37 27.5" stroke="#0F172A" strokeWidth="1" strokeLinecap="round" />

            {/* Warm Smiling Mouth */}
            <path d="M 28 36 Q 32 41 36 36" stroke="#991B1B" strokeWidth="1.6" strokeLinecap="round" fill="#FECDD3" />

            {/* Cute Hair with Side Ponytail */}
            <path d="M 19 28 C 17 17, 24 11, 32 11 C 40 11, 47 17, 45 28 C 45 32, 43 35, 41 32 C 40 26, 38 21, 32 21 C 26 21, 24 26, 23 32 C 21 35, 19 32, 19 28 Z" fill="#451A03" />
            <ellipse cx="45" cy="22" rx="4" ry="7" fill="#451A03" transform="rotate(25 45 22)" />
            <circle cx="43" cy="18" r="2" fill="#14B8A6" />

            {/* Front-Desk Cashier Headset */}
            <path d="M 19 30 C 18 17, 45 17, 44 29" stroke="#E2E8F0" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <rect x="18" y="27" width="3.5" height="6" rx="1.5" fill="#0D9488" stroke="#FFFFFF" strokeWidth="0.8" />
            <path d="M 19 32 Q 21 39 27 38" stroke="#CBD5E1" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            <circle cx="27.5" cy="38" r="1.6" fill="#10B981" />
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
