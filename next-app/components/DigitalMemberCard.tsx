'use client';

import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { 
  Award, 
  CheckCircle2, 
  Gift, 
  Minus, 
  Plus, 
  Share2, 
  Download,
  Sparkles
} from 'lucide-react';
import { PelangganItem } from '@/components/PelangganView';
import { useDialog } from '@/components/DialogProvider';

interface DigitalMemberCardProps {
  customer: PelangganItem;
  onUpdateStamps?: (type: '75' | '45', newCount: number) => void;
  canEdit?: boolean;
}

const STAMP_COORDS = [
  // Row 1 (y = 1121)
  { slot: 1, cx: 534, cy: 1121, rot: -4 },
  { slot: 2, cx: 1104, cy: 1121, rot: 5 },
  { slot: 3, cx: 1674, cy: 1121, rot: -3 },
  { slot: 4, cx: 2244, cy: 1121, rot: 4 },
  { slot: 5, cx: 2814, cy: 1121, rot: -5 },
  // Row 2 (y = 1649)
  { slot: 6, cx: 534, cy: 1649, rot: 6 },
  { slot: 7, cx: 1104, cy: 1649, rot: -4 },
  { slot: 8, cx: 1674, cy: 1649, rot: 5 },
  { slot: 9, cx: 2244, cy: 1649, rot: -3 },
  { slot: 10, cx: 2814, cy: 1649, rot: 0 },
];

export default function DigitalMemberCard({
  customer,
  onUpdateStamps,
  canEdit = true
}: DigitalMemberCardProps) {
  const { showAlert, showConfirm } = useDialog();
  const [activeCardType, setActiveCardType] = useState<'75' | '45'>('75');
  const [downloading, setDownloading] = useState(false);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // Local stamp counts
  const [localStamps75, setLocalStamps75] = useState<number>(customer.stamps75 ?? 0);
  const [localStamps45, setLocalStamps45] = useState<number>(customer.stamps45 ?? 0);

  const currentStamps = activeCardType === '75' ? localStamps75 : localStamps45;
  const isRewardReady = currentStamps >= 10;
  const remainingStamps = Math.max(0, 10 - currentStamps);

  const handleAddStamp = async () => {
    if (currentStamps >= 10) {
      await showAlert('Stempel sudah penuh (10/10)! Silakan klaim reward cuci gratis terlebih dahulu.', 'info');
      return;
    }
    const nextVal = currentStamps + 1;
    if (activeCardType === '75') {
      setLocalStamps75(nextVal);
      onUpdateStamps?.('75', nextVal);
    } else {
      setLocalStamps45(nextVal);
      onUpdateStamps?.('45', nextVal);
    }
  };

  const handleSubtractStamp = () => {
    if (currentStamps <= 0) return;
    const nextVal = currentStamps - 1;
    if (activeCardType === '75') {
      setLocalStamps75(nextVal);
      onUpdateStamps?.('75', nextVal);
    } else {
      setLocalStamps45(nextVal);
      onUpdateStamps?.('45', nextVal);
    }
  };

  const handleClaimReward = async () => {
    const confirmed = await showConfirm(
      `Klaim Reward Cuci Gratis untuk Kartu ${activeCardType === '75' ? '7,5 KG' : '4,5 KG'} atas nama ${customer.nama}?\n\nStempel akan di-reset kembali ke 0.`,
      'Konfirmasi Klaim Reward'
    );
    if (!confirmed) return;

    if (activeCardType === '75') {
      setLocalStamps75(0);
      onUpdateStamps?.('75', 0);
    } else {
      setLocalStamps45(0);
      onUpdateStamps?.('45', 0);
    }
    await showAlert(`🎉 Selamat! Reward 1x Cuci Gratis ${activeCardType === '75' ? '7,5 KG' : '4,5 KG'} berhasil diklaim dan kartu di-reset ke 0 stempel.`, 'success');
  };

  const handleDownloadPNG = async () => {
    if (!cardContainerRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardContainerRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        quality: 0.95,
      });
      const link = document.createElement('a');
      link.download = `Member-Card-${activeCardType === '75' ? '7.5KG' : '4.5KG'}-${customer.nama.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      await showAlert('Gagal mengunduh kartu member digital.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = () => {
    const phone = customer.noHp.replace(/[^0-9]/g, '');
    const targetPhone = phone.startsWith('0') ? '62' + phone.substring(1) : phone;
    const msg = [
      `Halo Kak *${customer.nama}*! 👋`,
      `Berikut adalah update *Digital Member Loyalty Stamp Card* Anda di *Dua SiSi Laundry*:`,
      ``,
      `🧺 *Kartu Member: ${activeCardType === '75' ? '7,5 KG' : '4,5 KG'}*`,
      `⭐ Progres Stempel: *${currentStamps} dari 10 Stempel*`,
      isRewardReady 
        ? `🎉 *SELAMAT! Anda berhak mendapatkan 1x Cuci GRATIS! Tunjukkan pesan ini saat berkunjung ke outlet.*` 
        : `✨ Kumpulkan *${remainingStamps} stempel lagi* untuk mendapatkan 1x Cuci Gratis!`,
      ``,
      `Terima kasih telah mencuci di Dua SiSi Laundry! 🫧`
    ].join('\n');

    const url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
      
      {/* Top Header & Card Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-900 text-teal-200 flex items-center justify-center shadow-xs">
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
              <span>Digital Member Loyalty Card</span>
              <span className="text-[10px] bg-teal-100 text-teal-900 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Anti-Pemalsuan
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">Kumpulkan 10 stempel untuk klaim 1x cuci gratis</p>
          </div>
        </div>

        {/* 2-Card Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveCardType('75')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              activeCardType === '75'
                ? 'bg-[#1E4648] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>🧺 Kartu 7,5 KG</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeCardType === '75' ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
            }`}>
              {localStamps75}/10
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCardType('45')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
              activeCardType === '45'
                ? 'bg-[#1E4648] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <span>🧺 Kartu 4,5 KG</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeCardType === '45' ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
            }`}>
              {localStamps45}/10
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 100% EXACT SVG VECTOR CANVAS */}
      {/* ========================================================================= */}
      <div className="flex justify-center w-full">
        <div 
          ref={cardContainerRef}
          className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 select-none bg-slate-950 relative"
          style={{ aspectRatio: '3322 / 2030' }}
        >
          <svg 
            viewBox="0 0 3322 2030" 
            className="w-full h-full block"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
          >
            {/* 1. Underlying SVG Original Graphics */}
            <image 
              href="/assets/member-card/Member-Card.svg" 
              width="3322" 
              height="2030" 
              preserveAspectRatio="none" 
            />

            {/* 2. Customer Name Text Overlay (Inside rect x="224" y="554" width="1450" height="248") */}
            <rect x="224" y="554" width="1450" height="248" rx="48" fill="#FFFFFF" />
            <text 
              x="300" 
              y="695" 
              fill="#1E4648" 
              fontSize="68" 
              fontWeight="900" 
              fontFamily="sans-serif"
              letterSpacing="2"
            >
              NAMA:
            </text>
            <text 
              x="570" 
              y="695" 
              fill="#0F172A" 
              fontSize="78" 
              fontWeight="900" 
              fontFamily="sans-serif"
              letterSpacing="1"
            >
              {(customer.nama || 'PELANGGAN').toUpperCase()}
            </text>

            {/* 3. Customer Phone Text Overlay (Inside rect x="1758" y="554" width="1340" height="248") */}
            <rect x="1758" y="554" width="1340" height="248" rx="48" fill="#FFFFFF" />
            <text 
              x="1830" 
              y="695" 
              fill="#1E4648" 
              fontSize="68" 
              fontWeight="900" 
              fontFamily="sans-serif"
              letterSpacing="2"
            >
              NO. HP:
            </text>
            <text 
              x="2130" 
              y="695" 
              fill="#0F172A" 
              fontSize="78" 
              fontWeight="900" 
              fontFamily="monospace"
              letterSpacing="1"
            >
              {customer.maskedHp || customer.noHp}
            </text>

            {/* 4. Top-Right Weight Badge Overlay (circle cx="2942" cy="261" r="156") */}
            <circle cx="2942" cy="261" r="156" fill="#FFFFFF" stroke="#1E4648" strokeWidth="8" />
            <text 
              x="2942" 
              y="265" 
              textAnchor="middle" 
              fill="#0F172A" 
              fontSize="120" 
              fontWeight="900" 
              fontFamily="sans-serif"
            >
              {activeCardType === '75' ? '7,5' : '4,5'}
            </text>
            <text 
              x="2942" 
              y="340" 
              textAnchor="middle" 
              fill="#1E4648" 
              fontSize="52" 
              fontWeight="900" 
              fontFamily="sans-serif"
            >
              KG
            </text>

            {/* 5. 10 STAMP CIRCLES OVERLAY */}
            {STAMP_COORDS.map(({ slot, cx, cy, rot }) => {
              const isStamped = currentStamps >= slot;
              const isReward = slot === 10;

              if (!isStamped) {
                // Unstamped slot: Render slot number faintly inside the original circle
                return (
                  <g key={slot}>
                    <text 
                      x={cx} 
                      y={cy + (isReward ? -10 : 35)} 
                      textAnchor="middle" 
                      fill="#94A3B8" 
                      fontSize={isReward ? "70" : "110"} 
                      fontWeight="900" 
                      fontFamily="sans-serif"
                    >
                      {isReward ? "🎁 FREE" : slot}
                    </text>
                    {isReward && (
                      <text 
                        x={cx} 
                        y={cy + 75} 
                        textAnchor="middle" 
                        fill="#D97706" 
                        fontSize="44" 
                        fontWeight="800" 
                        fontFamily="sans-serif"
                      >
                        REWARD
                      </text>
                    )}
                  </g>
                );
              }

              // STAMPED SLOT OVERLAY (Authentic Dua Sisi Digital Rubber Seal)
              if (isReward) {
                // Slot 10 Celebratory Reward Seal
                return (
                  <g key={slot} transform={`rotate(${rot}, ${cx}, ${cy})`}>
                    <circle cx={cx} cy={cy} r="225" fill="#FEF3C7" stroke="#D97706" strokeWidth="12" strokeDasharray="16 8" />
                    <circle cx={cx} cy={cy} r="195" fill="#F59E0B" stroke="#B45309" strokeWidth="8" />
                    <circle cx={cx} cy={cy} r="160" fill="#78350F" />
                    
                    {/* Stars */}
                    <text x={cx} y={cy - 85} textAnchor="middle" fill="#FDE68A" fontSize="42" fontWeight="900">
                      ★ ★ ★ ★ ★
                    </text>
                    <text x={cx} y={cy - 20} textAnchor="middle" fill="#FFFFFF" fontSize="64" fontWeight="900" fontFamily="sans-serif">
                      GRATIS
                    </text>
                    <text x={cx} y={cy + 45} textAnchor="middle" fill="#FDE68A" fontSize="56" fontWeight="900" fontFamily="sans-serif">
                      1x CUCI
                    </text>
                    <text x={cx} y={cy + 105} textAnchor="middle" fill="#FEF3C7" fontSize="36" fontWeight="800">
                      DUA SISI LAUNDRY
                    </text>
                  </g>
                );
              }

              // Regular Stamped Seal (Slots 1-9)
              return (
                <g key={slot} transform={`rotate(${rot}, ${cx}, ${cy})`}>
                  {/* Outer Seal Rings */}
                  <circle cx={cx} cy={cy} r="225" fill="#E6FFFA" stroke="#0D9488" strokeWidth="12" strokeDasharray="14 6" />
                  <circle cx={cx} cy={cy} r="195" fill="#1E4648" stroke="#115E59" strokeWidth="6" />
                  <circle cx={cx} cy={cy} r="165" fill="#0D3133" stroke="#2DD4BF" strokeWidth="4" />

                  {/* Stamp Header Text */}
                  <text x={cx} y={cy - 80} textAnchor="middle" fill="#99F6E4" fontSize="34" fontWeight="800" letterSpacing="3">
                    DUA SISI LAUNDRY
                  </text>

                  {/* Stamp Checkmark & Stamp ID */}
                  <path 
                    d={`M ${cx - 50} ${cy - 10} L ${cx - 15} ${cy + 30} L ${cx + 55} ${cy - 45}`} 
                    fill="none" 
                    stroke="#FBBF24" 
                    strokeWidth="18" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />

                  {/* Stamp Verified Text */}
                  <text x={cx} y={cy + 75} textAnchor="middle" fill="#FDE68A" fontSize="42" fontWeight="900" letterSpacing="4">
                    VALID
                  </text>
                  <text x={cx} y={cy + 120} textAnchor="middle" fill="#5EEAD4" fontSize="30" fontWeight="700">
                    STAMP #{slot}
                  </text>
                </g>
              );
            })}

          </svg>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REWARD BANNER (IF 10/10 REACHED) */}
      {/* ========================================================================= */}
      {isRewardReady && (
        <div className="p-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-2xl text-slate-950 font-bold flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-bounce-subtle border border-yellow-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black">🎉 TARGET 10 STEMPEL TERCAPAI!</div>
              <div className="text-xs font-semibold text-slate-900">
                Pelanggan berhak mendapatkan <strong>1x Cuci Gratis ({activeCardType === '75' ? '7,5 KG' : '4,5 KG'})</strong>.
              </div>
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={handleClaimReward}
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 text-amber-300 hover:text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Klaim Reward & Reset</span>
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTION TOOLBAR & STAMP CONTROLS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        
        {/* Stamp Counter & Add/Subtract Buttons */}
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={handleSubtractStamp}
                disabled={currentStamps <= 0}
                className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded-xl font-bold transition disabled:opacity-30 cursor-pointer border border-slate-200"
                title="Kurangi Stempel (-1)"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-xl text-center">
                <span className="text-[10px] text-teal-800 font-bold block uppercase leading-none">Stempel</span>
                <span className="text-sm font-black font-mono text-[#1E4648]">
                  {currentStamps} / 10
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddStamp}
                disabled={currentStamps >= 10}
                className="px-3.5 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs disabled:opacity-40 cursor-pointer"
                title="Tambah Stempel (+1)"
              >
                <Plus className="w-4 h-4" />
                <span>Beri Stempel (+1)</span>
              </button>
            </>
          )}
        </div>

        {/* Share & Download Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Kirim WA</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPNG}
            disabled={downloading}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Mengunduh...' : 'Unduh PNG'}</span>
          </button>
        </div>

      </div>

    </div>
  );
}
