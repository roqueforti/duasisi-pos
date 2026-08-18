'use client';

import React, { useState, useRef } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import { PegawaiDetail } from '@/lib/types';
import { X, Download, Printer, RefreshCw, Palette, Sparkles, QrCode, Shield, Check } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

interface IdCardModalProps {
  pegawai: PegawaiDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

type CardTheme = 'teal' | 'navy' | 'dark' | 'gold';
type CardSide = 'front' | 'back' | 'both';

export default function IdCardModal({ pegawai, isOpen, onClose }: IdCardModalProps) {
  const { showAlert } = useDialog();
  const [theme, setTheme] = useState<CardTheme>('teal');
  const [activeSide, setActiveSide] = useState<CardSide>('front');
  const [customRole, setCustomRole] = useState(pegawai?.jabatan || 'Kasir / Staff');
  const [exporting, setExporting] = useState(false);
  const cardFrontRef = useRef<HTMLDivElement>(null);
  const cardBackRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !pegawai) return null;

  // Theme Palettes
  const themeStyles = {
    teal: {
      bg: 'from-[#1E4648] via-[#163536] to-[#0D2122]',
      accent: 'bg-emerald-400 text-[#0D2122]',
      border: 'border-emerald-500/30',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
      highlight: '#34D399',
      qrColor: '#1E4648'
    },
    navy: {
      bg: 'from-[#0F172A] via-[#1E293B] to-[#020617]',
      accent: 'bg-sky-400 text-[#0F172A]',
      border: 'border-sky-500/30',
      badge: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
      highlight: '#38BDF8',
      qrColor: '#0F172A'
    },
    dark: {
      bg: 'from-[#18181B] via-[#27272A] to-[#09090B]',
      accent: 'bg-amber-400 text-[#18181B]',
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
      highlight: '#FBBF24',
      qrColor: '#18181B'
    },
    gold: {
      bg: 'from-[#292211] via-[#1C1608] to-[#0F0B03]',
      accent: 'bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-900',
      border: 'border-amber-500/40',
      badge: 'bg-amber-400/20 text-amber-200 border-amber-400/50',
      highlight: '#F59E0B',
      qrColor: '#292211'
    }
  }[theme];

  // Quick export canvas to image using html-to-image
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

  const employeePhoto = pegawai.foto || null;
  const initial = (pegawai.nama || 'P').charAt(0).toUpperCase();
  const joinedYear = pegawai.tanggalMasuk ? new Date(pegawai.tanggalMasuk).getFullYear() : '2026';

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      
      {/* Modal Box */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col md:flex-row">
        
        {/* LEFT PANEL: Live Card Preview Area */}
        <div className="flex-1 bg-gradient-to-br from-slate-100 to-slate-200 p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden border-b md:border-b-0 md:border-r border-slate-200">
          
          {/* Dimensional specs badge */}
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-extrabold text-slate-700 shadow-xs border border-slate-200/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Format Standar CR80 (54mm × 85mm)</span>
          </div>

          {/* Sisi Switcher */}
          <div className="flex bg-white/80 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80 gap-1 mb-6 mt-4">
            <button
              onClick={() => setActiveSide('front')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSide === 'front' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sisi Depan (Front)
            </button>
            <button
              onClick={() => setActiveSide('back')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSide === 'back' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sisi Belakang (Back)
            </button>
          </div>

          {/* CARD CONTAINER (Preserved strictly at 54mm x 85mm aspect ratio = 270px x 425px) */}
          <div className="relative shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 transform hover:scale-[1.02]">
            
            {/* FRONT SIDE */}
            <div
              ref={cardFrontRef}
              id="id-card-front"
              className={`w-[270px] h-[425px] bg-gradient-to-br ${themeStyles.bg} text-white p-5 flex flex-col justify-between relative overflow-hidden border ${themeStyles.border} ${
                activeSide === 'back' ? 'hidden' : 'flex'
              }`}
            >
              {/* Background Geometric Ornaments */}
              <div className="absolute -right-16 -top-16 w-44 h-44 bg-white/5 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -left-12 bottom-16 w-36 h-36 bg-white/5 rounded-full blur-xl pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />

              {/* Top Header: Brand Logo & Title */}
              <div className="relative z-10 text-center flex flex-col items-center">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-6 h-6 rounded-md bg-white text-[#1E4648] flex items-center justify-center font-black text-xs shadow-md">
                    2S
                  </div>
                  <span className="font-black text-sm tracking-wider uppercase text-white drop-shadow-sm">
                    Dua Sisi Laundry
                  </span>
                </div>
                <p className="text-[8.5px] font-bold text-slate-300 tracking-widest uppercase">
                  Express & Coin Laundry
                </p>
                <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-white/50 to-transparent my-1.5" />
              </div>

              {/* Middle Section: Photo & Identity */}
              <div className="relative z-10 flex flex-col items-center my-auto">
                {/* Photo Frame */}
                <div className="relative mb-3 group">
                  <div className="w-24 h-24 rounded-2xl p-1 bg-gradient-to-tr from-white/40 via-white/10 to-white/40 shadow-xl overflow-hidden backdrop-blur-md">
                    {employeePhoto ? (
                      <img
                        src={employeePhoto}
                        alt={pegawai.nama}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-800 rounded-xl flex items-center justify-center font-black text-2xl text-white">
                        {initial}
                      </div>
                    )}
                  </div>
                  {/* Hologram badge icon */}
                  <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white text-emerald-700 flex items-center justify-center shadow-md border border-slate-200">
                    <Shield className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>

                {/* Name */}
                <h2 className="font-extrabold text-base text-center leading-tight tracking-tight text-white px-2">
                  {pegawai.nama}
                </h2>
                {pegawai.namaPanggilan && (
                  <p className="text-[11px] font-semibold text-slate-300">
                    "{pegawai.namaPanggilan}"
                  </p>
                )}

                {/* Role Badge */}
                <div className="mt-2">
                  <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${themeStyles.accent} shadow-md`}>
                    {customRole || pegawai.jabatan || 'Kasir'}
                  </span>
                </div>
              </div>

              {/* Bottom Section: NIP & Security QR / Barcode info */}
              <div className="relative z-10 pt-2 border-t border-white/15 flex items-center justify-between">
                <div>
                  <span className="text-[8px] uppercase tracking-widest text-slate-400 font-bold block">
                    ID / NIP Pegawai
                  </span>
                  <span className="font-mono text-xs font-black tracking-wider text-white">
                    {pegawai.id}
                  </span>
                </div>

                {/* Micro QR Code Representation */}
                <div className="w-10 h-10 bg-white p-1 rounded-lg shadow-md flex items-center justify-center">
                  <div className="w-full h-full bg-slate-900 rounded flex items-center justify-center text-[7px] font-mono font-bold text-white text-center leading-none">
                    QR
                  </div>
                </div>
              </div>
            </div>

            {/* BACK SIDE */}
            <div
              ref={cardBackRef}
              id="id-card-back"
              className={`w-[270px] h-[425px] bg-gradient-to-br ${themeStyles.bg} text-white p-5 flex flex-col justify-between relative overflow-hidden border ${themeStyles.border} ${
                activeSide === 'front' ? 'hidden' : 'flex'
              }`}
            >
              {/* Background Geometric Ornaments */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />

              {/* Top: Magnetic / Smart Chip Graphic bar */}
              <div className="relative z-10">
                <div className="w-full h-8 bg-slate-900/90 rounded-md border border-white/10 flex items-center px-3 mb-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  </div>
                  <span className="ml-auto font-mono text-[9px] text-slate-400 font-bold">
                    SECURE AUTH CHIP
                  </span>
                </div>

                <h4 className="font-bold text-[10px] uppercase tracking-wider text-slate-300 border-b border-white/15 pb-1">
                  Ketentuan Penggunaan
                </h4>
                <ul className="text-[8px] text-slate-300/90 space-y-1.5 mt-2 list-disc list-inside leading-snug">
                  <li>Kartu ini adalah identitas resmi staf Dua SiSi Laundry.</li>
                  <li>Wajib dikenakan selama bertugas pada jam kerja operasional.</li>
                  <li>Jika menemukan kartu ini, mohon kembalikan ke outlet resmi Dua SiSi Laundry terdekat.</li>
                </ul>
              </div>

              {/* Center Info Grid */}
              <div className="relative z-10 bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10 space-y-1 text-[8.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Tahun Bergabung:</span>
                  <span className="font-bold text-white">{joinedYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Shift Kerja:</span>
                  <span className="font-bold text-white">{pegawai.shiftUtama || 'Pagi'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Hotline Outlet:</span>
                  <span className="font-bold text-emerald-300">0812-3456-7890</span>
                </div>
              </div>

              {/* Bottom: Simulated Barcode & Authorization */}
              <div className="relative z-10 text-center pt-2 border-t border-white/15">
                {/* Barcode Graphic */}
                <div className="bg-white p-1.5 rounded-md flex flex-col items-center justify-center mb-1.5 shadow-sm">
                  <div className="h-6 w-full flex items-center justify-between px-2 gap-0.5">
                    {Array.from({ length: 28 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-full bg-slate-900 ${
                          i % 3 === 0 ? 'w-1' : i % 2 === 0 ? 'w-0.5' : 'w-1.5'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[8px] font-extrabold text-slate-800 tracking-widest mt-0.5">
                    *{pegawai.id}*
                  </span>
                </div>
                <p className="text-[7.5px] text-slate-400 font-medium">
                  Authorized by Dua SiSi Laundry Management
                </p>
              </div>
            </div>

          </div>

          <p className="text-[11px] text-slate-400 font-medium mt-4">
            Klik tombol <strong>Cetak / Print</strong> untuk mencetak ukuran pas ID card plastik / kertas glossy.
          </p>
        </div>

        {/* RIGHT PANEL: Customizer & Actions */}
        <div className="w-full md:w-80 p-6 sm:p-7 flex flex-col justify-between bg-white space-y-6">
          
          <div>
            {/* Modal Title */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1E4648]" />
                  <span>Generator ID Card</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Desain kartu identitas staf otomatis</p>
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
              
              {/* Theme Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#1E4648]" />
                  <span>Pilihan Tema Warna</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'teal', label: 'Neo Teal', color: 'bg-[#1E4648]' },
                    { id: 'navy', label: 'Midnight Navy', color: 'bg-[#0F172A]' },
                    { id: 'dark', label: 'Dark Carbon', color: 'bg-[#18181B]' },
                    { id: 'gold', label: 'Gold Luxury', color: 'bg-[#292211]' },
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

              {/* Custom Title / Role */}
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

              {/* Employee Summary Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
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
            padding: 4mm !important;
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
