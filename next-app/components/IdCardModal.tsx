'use client';

import React, { useState, useRef } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { PegawaiDetail } from '@/lib/types';
import { 
  X, 
  Download, 
  Printer, 
  Palette, 
  Sparkles, 
  Shield, 
  Upload, 
  User, 
  Building2, 
  PhoneCall, 
  CheckCircle2, 
  QrCode,
  Image as ImageIcon
} from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

interface IdCardModalProps {
  pegawai: PegawaiDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

type CardTheme = 'teal' | 'navy' | 'dark' | 'gold';
type CardSide = 'front' | 'back';

export default function IdCardModal({ pegawai, isOpen, onClose }: IdCardModalProps) {
  const { showAlert } = useDialog();
  const [theme, setTheme] = useState<CardTheme>('teal');
  const [activeSide, setActiveSide] = useState<CardSide>('front');
  const [customRole, setCustomRole] = useState(pegawai?.jabatan || 'Kasir / Staff');
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  
  const cardFrontRef = useRef<HTMLDivElement>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !pegawai) return null;

  // Active Photo (uploaded or existing)
  const activePhoto = customPhoto || pegawai.foto || null;
  const initial = (pegawai.nama || 'P').charAt(0).toUpperCase();
  const joinedYear = pegawai.tanggalMasuk ? new Date(pegawai.tanggalMasuk).getFullYear() : '2026';

  // Theme Palettes
  const themeStyles = {
    teal: {
      cardBg: 'from-[#0d3133] via-[#124245] to-[#082022]',
      accentPill: 'bg-emerald-400 text-slate-950 font-black shadow-md',
      borderAccent: 'border-emerald-400/40',
      headerRibbon: 'bg-[#1E4648] text-emerald-300 border-b border-emerald-500/30',
      glow: 'rgba(52, 211, 153, 0.25)',
      photoRing: 'from-emerald-400 via-teal-200 to-emerald-500'
    },
    navy: {
      cardBg: 'from-[#0a1128] via-[#101f42] to-[#040817]',
      accentPill: 'bg-sky-400 text-slate-950 font-black shadow-md',
      borderAccent: 'border-sky-400/40',
      headerRibbon: 'bg-[#0f1d3d] text-sky-300 border-b border-sky-500/30',
      glow: 'rgba(56, 189, 248, 0.25)',
      photoRing: 'from-sky-400 via-blue-200 to-sky-500'
    },
    dark: {
      cardBg: 'from-[#121214] via-[#1c1c20] to-[#08080a]',
      accentPill: 'bg-amber-400 text-slate-950 font-black shadow-md',
      borderAccent: 'border-amber-400/40',
      headerRibbon: 'bg-[#1f1f24] text-amber-300 border-b border-amber-500/30',
      glow: 'rgba(251, 191, 36, 0.25)',
      photoRing: 'from-amber-400 via-yellow-200 to-amber-500'
    },
    gold: {
      cardBg: 'from-[#211a09] via-[#33280c] to-[#120d03]',
      accentPill: 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md',
      borderAccent: 'border-amber-500/50',
      headerRibbon: 'bg-[#291f08] text-amber-300 border-b border-amber-500/40',
      glow: 'rgba(245, 158, 11, 0.3)',
      photoRing: 'from-yellow-300 via-amber-200 to-yellow-500'
    }
  }[theme];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Quick export canvas to image
  const handleExportImage = async (format: 'png' | 'jpeg') => {
    setExporting(true);
    try {
      const targetElement = activeSide === 'back' ? cardBackRef.current : cardFrontRef.current;
      if (!targetElement) throw new Error('Elemen kartu tidak ditemukan');

      const dataUrl = format === 'png' 
        ? await toPng(targetElement, { pixelRatio: 3, cacheBust: true })
        : await toJpeg(targetElement, { pixelRatio: 3, quality: 0.95, cacheBust: true });

      const link = document.createElement('a');
      link.download = `ID_CARD_${pegawai.id}_${activeSide.toUpperCase()}.${format}`;
      link.href = dataUrl;
      link.click();
      await showAlert(`ID Card (${activeSide === 'front' ? 'Depan' : 'Belakang'}) berhasil diunduh (${format.toUpperCase()})!`, 'success');
    } catch (err) {
      console.error(err);
      await showAlert('Gagal mengekspor kartu. Silakan gunakan tombol Cetak / Print PDF.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Dynamic QR Code endpoint using employee ID
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(pegawai.id)}`;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      
      {/* Modal Card Box */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col md:flex-row">
        
        {/* LEFT PANEL: Card Preview Area */}
        <div className="flex-1 bg-slate-900 p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-800">
          
          {/* Top Info Badge */}
          <div className="flex items-center justify-between w-full max-w-xs mb-4">
            <span className="bg-slate-800/90 text-slate-300 text-[10px] font-bold px-3 py-1 rounded-full border border-slate-700 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Standar CR80 (54mm × 85mm)</span>
            </span>

            {/* Sisi Switcher */}
            <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700 gap-1">
              <button
                onClick={() => setActiveSide('front')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  activeSide === 'front' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Depan
              </button>
              <button
                onClick={() => setActiveSide('back')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  activeSide === 'back' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Belakang
              </button>
            </div>
          </div>

          {/* CARD CONTAINER (Fixed physical aspect ratio 54mm x 85mm => 270px x 425px) */}
          <div className="relative shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 transform hover:scale-[1.01] my-2">
            
            {/* Lanyard Hole Punch Indicator */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-2 bg-slate-950/80 rounded-full border border-white/20 z-20" />

            {/* ================= SISI DEPAN (FRONT) ================= */}
            <div
              ref={cardFrontRef}
              id="id-card-front"
              className={`w-[270px] h-[425px] bg-gradient-to-b ${themeStyles.cardBg} text-white flex flex-col justify-between relative overflow-hidden border ${themeStyles.borderAccent} select-none ${
                activeSide === 'back' ? 'hidden' : 'flex'
              }`}
            >
              {/* Background Abstract Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0d_1px,transparent_1px)] [background-size:10px_10px] opacity-70 pointer-events-none" />
              <div className="absolute -top-20 -right-20 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />

              {/* 1. Card Header */}
              <div className={`relative z-10 pt-6 pb-2.5 px-4 text-center ${themeStyles.headerRibbon}`}>
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-white text-[#1E4648] flex items-center justify-center font-black text-[11px] shadow-sm">
                    2S
                  </div>
                  <span className="font-black text-xs tracking-wider uppercase text-white drop-shadow-md">
                    DUA SISI LAUNDRY
                  </span>
                </div>
                <p className="text-[8px] font-extrabold text-emerald-300/90 tracking-widest uppercase mt-0.5">
                  Express & Coin Laundry
                </p>
              </div>

              {/* 2. Employee Identity Section */}
              <div className="relative z-10 flex flex-col items-center justify-center my-auto px-4">
                
                {/* Photo Avatar */}
                <div className="relative mb-3">
                  <div className={`w-24 h-24 rounded-2xl p-1 bg-gradient-to-tr ${themeStyles.photoRing} shadow-xl overflow-hidden`}>
                    {activePhoto ? (
                      <img
                        src={activePhoto}
                        alt={pegawai.nama}
                        className="w-full h-full object-cover rounded-xl bg-slate-800"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center font-black text-3xl text-white">
                        {initial}
                      </div>
                    )}
                  </div>
                  
                  {/* Hologram Shield Badge */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 text-emerald-400 border border-emerald-400/60 flex items-center justify-center shadow-lg">
                    <Shield className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>

                {/* Name */}
                <h2 className="font-black text-[15px] text-center text-white leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tight">
                  {pegawai.nama}
                </h2>
                {pegawai.namaPanggilan && (
                  <p className="text-[11px] font-bold text-emerald-300 drop-shadow-sm">
                    "{pegawai.namaPanggilan}"
                  </p>
                )}

                {/* Role Pill */}
                <div className="mt-2">
                  <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${themeStyles.accentPill}`}>
                    {customRole || pegawai.jabatan || 'Staff'}
                  </span>
                </div>
              </div>

              {/* 3. Card Footer: ID & Live QR Code */}
              <div className="relative z-10 p-3 bg-slate-950/70 backdrop-blur-md border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[7.5px] uppercase tracking-widest text-slate-400 font-bold block">
                    ID / NIP PEGAWAI
                  </span>
                  <span className="font-mono text-xs font-black tracking-wider text-white">
                    {pegawai.id}
                  </span>
                </div>

                {/* Actual Dynamic QR Code */}
                <div className="w-11 h-11 bg-white p-1 rounded-lg shadow-md flex items-center justify-center overflow-hidden">
                  <img
                    src={qrCodeUrl}
                    alt={`QR ${pegawai.id}`}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

            </div>

            {/* ================= SISI BELAKANG (BACK) ================= */}
            <div
              ref={cardBackRef}
              id="id-card-back"
              className={`w-[270px] h-[425px] bg-gradient-to-b ${themeStyles.cardBg} text-white flex flex-col justify-between relative overflow-hidden border ${themeStyles.borderAccent} select-none ${
                activeSide === 'front' ? 'hidden' : 'flex'
              }`}
            >
              {/* Background Abstract Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0d_1px,transparent_1px)] [background-size:10px_10px] opacity-70 pointer-events-none" />

              {/* 1. Smart Magnetic Stripe Header */}
              <div className="relative z-10 pt-6 px-3">
                <div className="w-full h-7 bg-slate-950 rounded border border-white/10 flex items-center px-2.5 mb-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  </div>
                  <span className="ml-auto font-mono text-[8px] text-slate-400 font-extrabold tracking-widest">
                    DUA SISI AUTHENTICATED
                  </span>
                </div>

                <h4 className="font-bold text-[9.5px] uppercase tracking-wider text-emerald-300 border-b border-white/15 pb-1">
                  Ketentuan Kartu Pegawai
                </h4>
                <ul className="text-[8px] text-slate-200/90 space-y-1.5 mt-2 list-disc list-inside leading-snug">
                  <li>Kartu ini adalah tanda pengenal resmi staf Dua SiSi Laundry.</li>
                  <li>Wajib dikenakan selama bertugas di outlet operasional.</li>
                  <li>Jika menemukan kartu ini, mohon kembalikan ke outlet Dua SiSi Laundry terdekat.</li>
                </ul>
              </div>

              {/* 2. Outlet Quick Info */}
              <div className="relative z-10 mx-3 bg-slate-950/60 backdrop-blur-md p-2.5 rounded-xl border border-white/10 space-y-1 text-[8.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Tahun Masuk:</span>
                  <span className="font-bold text-white">{joinedYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Shift Tugas:</span>
                  <span className="font-bold text-white">{pegawai.shiftUtama || 'Pagi'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Hotline WhatsApp:</span>
                  <span className="font-bold text-emerald-300">0812-3456-7890</span>
                </div>
              </div>

              {/* 3. Barcode & Authorization */}
              <div className="relative z-10 p-3 bg-slate-950/80 border-t border-white/10 text-center">
                {/* Barcode Graphic */}
                <div className="bg-white p-1.5 rounded-md flex flex-col items-center justify-center mb-1 shadow-sm">
                  <div className="h-5 w-full flex items-center justify-between px-1 gap-0.5">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-full bg-slate-900 ${
                          i % 4 === 0 ? 'w-1' : i % 2 === 0 ? 'w-0.5' : 'w-1.5'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[7.5px] font-black text-slate-800 tracking-widest mt-0.5">
                    *{pegawai.id}*
                  </span>
                </div>
                <p className="text-[7px] text-slate-400 font-medium">
                  Authorized & Verified by Dua SiSi Management
                </p>
              </div>

            </div>

          </div>

          <p className="text-[11px] text-slate-400 font-medium mt-2">
            Klik <strong>Cetak ID Card</strong> untuk cetak langsung ke printer PVC atau kertas glossy.
          </p>
        </div>

        {/* RIGHT PANEL: Customizer & Action Controls */}
        <div className="w-full md:w-80 p-6 sm:p-7 flex flex-col justify-between bg-white space-y-6">
          
          <div>
            {/* Modal Title */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1E4648]" />
                  <span>Desain ID Card Staf</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Ukuran resmi 54mm × 85mm</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customization Options */}
            <div className="space-y-4">
              
              {/* Photo Upload Option */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#1E4648]" />
                  <span>Ganti / Upload Foto</span>
                </label>
                <label className="cursor-pointer w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih Foto dari Galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>

              {/* Theme Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#1E4648]" />
                  <span>Pilihan Warna Tema</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'teal', label: 'Neo Teal', color: 'bg-[#124245]' },
                    { id: 'navy', label: 'Navy Blue', color: 'bg-[#101f42]' },
                    { id: 'dark', label: 'Carbon Black', color: 'bg-[#1c1c20]' },
                    { id: 'gold', label: 'Gold Luxury', color: 'bg-[#33280c]' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as any)}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                        theme === t.id
                          ? 'border-[#1E4648] bg-[#1E4648]/10 text-[#1E4648]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full ${t.color}`} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Role / Title on Card */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jabatan pada Kartu
                </label>
                <input
                  type="text"
                  value={customRole}
                  onChange={e => setCustomRole(e.target.value)}
                  placeholder="Misal: Kasir Utama, Supervisor"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Profile Summary Badge */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 text-xs">{pegawai.nama}</div>
                <div className="text-[11px] text-slate-500 font-mono">NIP: {pegawai.id}</div>
                <div className="text-[11px] text-slate-500">Status: <span className="font-semibold text-emerald-700">{pegawai.status}</span></div>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <button
              onClick={handlePrint}
              className="w-full py-2.5 px-4 bg-[#1E4648] hover:bg-[#153537] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak ID Card (54mm × 85mm)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={exporting}
                onClick={() => handleExportImage('png')}
                className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG HD</span>
              </button>

              <button
                disabled={exporting}
                onClick={() => handleExportImage('jpeg')}
                className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JPEG HD</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Print Media Specific CSS Styling for Exact 54mm x 85mm standard */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #id-card-front, #id-card-front *,
          #id-card-back, #id-card-back * {
            visibility: visible;
          }
          #id-card-front, #id-card-back {
            position: fixed;
            top: 0;
            left: 0;
            width: 54mm !important;
            height: 85mm !important;
            margin: 0;
            padding: 0 !important;
            border-radius: 3mm !important;
            page-break-after: always;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: 54mm 85mm;
            margin: 0;
          }
        }
      `}</style>

    </div>
  );
}
