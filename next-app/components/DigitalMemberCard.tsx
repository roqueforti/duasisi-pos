'use client';

import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { 
  Sparkles, 
  Gift, 
  Check, 
  Plus, 
  Minus, 
  Download, 
  Share2, 
  Award, 
  CheckCircle2, 
  QrCode,
  Layers,
  RotateCcw,
  Smartphone
} from 'lucide-react';
import { PelangganItem } from '@/components/PelangganView';
import { useDialog } from '@/components/DialogProvider';

interface DigitalMemberCardProps {
  customer: PelangganItem;
  onUpdateStamps?: (type: '75' | '45', newCount: number) => void;
  canEdit?: boolean;
}

export default function DigitalMemberCard({
  customer,
  onUpdateStamps,
  canEdit = true
}: DigitalMemberCardProps) {
  const { showAlert, showConfirm } = useDialog();
  const [activeCardType, setActiveCardType] = useState<'75' | '45'>('75');
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Local stamp counts if not yet persisted
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
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
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
      `Berikut adalah update *Digital Loyalty Stamp Card* Anda di *Dua SiSi Laundry*:`,
      ``,
      `🧺 *Kartu Member ${activeCardType === '75' ? '7,5 KG' : '4,5 KG'}*`,
      `⭐ Stempel Terkumpul: *${currentStamps} dari 10 Stempel*`,
      isRewardReady 
        ? `🎉 *SELAMAT! Anda berhak mendapatkan 1x Cuci GRATIS! Tunjukkan pesan ini saat berkunjung.*` 
        : `✨ Kumpulkan *${remainingStamps} stempel lagi* untuk mendapatkan 1x Cuci Gratis!`,
      ``,
      `Terima kasih telah mempercayakan cucian Anda di Dua SiSi Laundry! 🫧`
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

        {/* 2-Card Switcher Pills */}
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
      {/* DIGITAL CARD CANVAS (Matches Member-Card.svg Design) */}
      {/* ========================================================================= */}
      <div className="flex justify-center">
        <div 
          ref={cardRef}
          className="w-full max-w-xl aspect-[1.636/1] rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xl border border-teal-700/50 flex flex-col justify-between select-none text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #0d3133 0%, #164649 45%, #1E4648 70%, #0a2628 100%)',
            boxShadow: '0 20px 40px -15px rgba(13, 49, 51, 0.45)'
          }}
        >
          {/* Subtle Background Pattern & Watermark */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />
          <div className="absolute -left-16 -top-16 w-64 h-64 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

          {/* CARD HEADER */}
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-md">
                  MEMBER CARD
                </span>
                <span className="text-[10px] text-teal-300/80 font-mono">DUA SISI LAUNDRY</span>
              </div>
              <div className="text-base sm:text-xl font-black text-white tracking-wide mt-1 drop-shadow-xs">
                DUA SISI LAUNDRY
              </div>
            </div>

            {/* WEIGHT BADGE CIRCLE (7.5 KG / 4.5 KG) */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white text-slate-900 shadow-lg border-2 border-amber-300 flex flex-col items-center justify-center shrink-0">
              <span className="text-sm sm:text-lg font-black leading-none text-slate-950">
                {activeCardType === '75' ? '7,5' : '4,5'}
              </span>
              <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-tighter text-slate-600">
                KG
              </span>
            </div>
          </div>

          {/* CARD BODY: NAME & PHONE NUMBER PILLS */}
          <div className="relative z-10 grid grid-cols-12 gap-2 sm:gap-3 my-2">
            <div className="col-span-7 bg-white text-slate-900 px-3 py-1.5 sm:py-2 rounded-xl shadow-xs border border-slate-100 min-w-0">
              <div className="text-[8px] sm:text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">NAMA</div>
              <div className="text-xs sm:text-sm font-black truncate text-slate-950 uppercase">
                {customer.nama || 'PELANGGAN'}
              </div>
            </div>

            <div className="col-span-5 bg-white text-slate-900 px-3 py-1.5 sm:py-2 rounded-xl shadow-xs border border-slate-100 min-w-0">
              <div className="text-[8px] sm:text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">NO. HP</div>
              <div className="text-xs sm:text-sm font-mono font-bold truncate text-slate-900">
                {customer.maskedHp || customer.noHp}
              </div>
            </div>
          </div>

          {/* CARD FOOTER: 10 STAMP CIRCLES (2 Rows x 5 Columns) */}
          <div className="relative z-10 space-y-1.5 sm:space-y-2">
            {/* Top Row: Stamps 1 to 5 */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
              {[1, 2, 3, 4, 5].map((slot) => {
                const isStamped = currentStamps >= slot;
                return (
                  <div
                    key={slot}
                    className={`aspect-square rounded-full flex flex-col items-center justify-center relative transition-all duration-300 shadow-sm ${
                      isStamped
                        ? 'bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-100 text-slate-950 border-2 border-amber-200 ring-2 ring-amber-400/40 scale-100'
                        : 'bg-white/90 text-slate-600 border border-white/40'
                    }`}
                  >
                    {isStamped ? (
                      <div className="flex flex-col items-center justify-center animate-scale-in">
                        <Check className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-teal-950 stroke-[3]" />
                        <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter text-teal-950 -mt-0.5">
                          VALID
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-600">
                        {slot}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Row: Stamps 6 to 10 */}
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
              {[6, 7, 8, 9, 10].map((slot) => {
                const isStamped = currentStamps >= slot;
                const isRewardSlot = slot === 10;
                return (
                  <div
                    key={slot}
                    className={`aspect-square rounded-full flex flex-col items-center justify-center relative transition-all duration-300 shadow-sm ${
                      isStamped
                        ? isRewardSlot
                          ? 'bg-gradient-to-tr from-yellow-300 via-amber-400 to-amber-500 text-slate-950 border-2 border-yellow-200 ring-4 ring-yellow-400/60 animate-pulse'
                          : 'bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-100 text-slate-950 border-2 border-amber-200 ring-2 ring-amber-400/40'
                        : isRewardSlot
                        ? 'bg-amber-100 text-amber-900 border-2 border-dashed border-amber-400'
                        : 'bg-white/90 text-slate-600 border border-white/40'
                    }`}
                  >
                    {isStamped ? (
                      <div className="flex flex-col items-center justify-center animate-scale-in">
                        {isRewardSlot ? (
                          <>
                            <Gift className="w-4 h-4 sm:w-6 sm:h-6 text-slate-950" />
                            <span className="text-[6px] sm:text-[7px] font-black uppercase text-slate-950 leading-tight">
                              GRATIS
                            </span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-teal-950 stroke-[3]" />
                            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter text-teal-950 -mt-0.5">
                              VALID
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      isRewardSlot ? (
                        <div className="flex flex-col items-center justify-center text-amber-800">
                          <Gift className="w-3 h-3 sm:w-4 sm:h-4 text-amber-700" />
                          <span className="text-[6px] sm:text-[7px] font-extrabold uppercase">FREE</span>
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-xs sm:text-sm text-slate-600">
                          {slot}
                        </span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
