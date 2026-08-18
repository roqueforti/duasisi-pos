'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Printer, 
  RefreshCw, 
  Sparkles, 
  Palette, 
  ZoomIn, 
  ZoomOut, 
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Phone,
  ShieldCheck,
  Zap,
  Droplets,
  Layers,
  Loader2
} from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { runBackend } from '@/lib/api';

interface LayananItemBackend {
  id: string;
  nama: string;
  harga: number;
  satuan: string;
  icon?: string;
  aktif: string;
  tipe: 'SelfService' | 'FullService' | '';
  kategori?: string;
}

const FORMATS = [
  { id: 'a4-portrait', name: 'A4 / Poster (Potret)', width: 794, height: 1123, defaultCols: 1 },
  { id: 'a4-landscape', name: 'A4 / TV Display (Lanskap)', width: 1123, height: 794, defaultCols: 2 },
  { id: 'ig-feed', name: 'Instagram Feed (1:1)', width: 1080, height: 1080, defaultCols: 2 },
  { id: 'ig-story', name: 'IG Story / WhatsApp (9:16)', width: 1080, height: 1920, defaultCols: 1 }
];

const THEMES = [
  {
    id: 'signature-teal',
    name: 'Signature Teal',
    bg: 'bg-gradient-to-b from-[#0E2426] via-[#11292B] to-[#0A1B1C]',
    cardBg: 'bg-white/95 backdrop-blur-md text-slate-800 border-white/20',
    titleBadge: 'bg-[#1E4648] text-white border-white/30',
    accentText: 'text-[#1E4648]',
    priceBadge: 'bg-[#1E4648] text-white border-[#1E4648]/20',
    dotColor: 'border-[#1E4648]/30',
    subText: 'text-slate-500',
    headerText: 'text-white',
    logoSrc: './assets/logo-full-white.svg',
    haloColor: 'bg-teal-500/10'
  },
  {
    id: 'clean-pearl',
    name: 'Clean Pearl Light',
    bg: 'bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200',
    cardBg: 'bg-white text-slate-800 border-slate-200/80 shadow-md',
    titleBadge: 'bg-[#1E4648] text-white border-slate-700',
    accentText: 'text-[#1E4648]',
    priceBadge: 'bg-[#1E4648] text-white border-[#1E4648]/20',
    dotColor: 'border-slate-300',
    subText: 'text-slate-500',
    headerText: 'text-slate-800',
    logoSrc: './assets/logo-full-teal.svg',
    haloColor: 'bg-teal-600/5'
  },
  {
    id: 'luxury-midnight',
    name: 'Luxury Midnight Gold',
    bg: 'bg-gradient-to-b from-[#090D16] via-[#0F172A] to-[#050811]',
    cardBg: 'bg-slate-900/90 backdrop-blur-md text-slate-100 border-amber-500/30 shadow-xl',
    titleBadge: 'bg-gradient-to-r from-amber-600 to-amber-500 text-white border-amber-300/40',
    accentText: 'text-amber-400',
    priceBadge: 'bg-gradient-to-r from-amber-600 to-amber-500 text-white border-amber-400/30',
    dotColor: 'border-amber-400/20',
    subText: 'text-slate-400',
    headerText: 'text-white',
    logoSrc: './assets/logo-full-white.svg',
    haloColor: 'bg-amber-500/10'
  }
];

export default function MenuGeneratorView() {
  const [layananList, setLayananList] = useState<LayananItemBackend[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'png' | 'jpeg' | null>(null);
  const [format, setFormat] = useState(FORMATS[0]);
  const [theme, setTheme] = useState(THEMES[0]);
  const [filterTipe, setFilterTipe] = useState<'Semua' | 'SelfService' | 'FullService'>('Semua');
  const [showUnit, setShowUnit] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [zoom, setZoom] = useState(0.5);
  const [columnCount, setColumnCount] = useState<1 | 2>(1);

  const printRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await runBackend<LayananItemBackend[]>('getLayananListAll');
      if (Array.isArray(data)) {
        setLayananList(data.filter(d => d.aktif === 'Y'));
      }
    } catch (err) {
      console.error('Gagal memuat katalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update default columns when format changes
  useEffect(() => {
    setColumnCount(format.defaultCols as 1 | 2);
  }, [format]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async (formatType: 'png' | 'jpeg') => {
    if (!printRef.current) return;
    setDownloading(formatType);
    try {
      const node = printRef.current;
      const options = {
        pixelRatio: 2, // 2X High resolution render
        cacheBust: true,
        style: {
          transform: 'none',
          transformOrigin: 'top left',
          margin: '0',
        },
      };

      const dataUrl = formatType === 'png'
        ? await toPng(node, options)
        : await toJpeg(node, { ...options, quality: 0.95 });

      const link = document.createElement('a');
      link.download = `DuaSisi-Pricelist-${format.id}-${Date.now()}.${formatType}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download error:', err);
      alert('Gagal mengunduh gambar. Silakan gunakan opsi Cetak/PDF.');
    } finally {
      setDownloading(null);
    }
  };

  // Grouping logic
  const filteredData = layananList.filter(
    item => filterTipe === 'Semua' || item.tipe === filterTipe
  );

  const groups: Record<string, LayananItemBackend[]> = {};
  filteredData.forEach(item => {
    const kat = item.kategori || (item.tipe === 'SelfService' ? 'Self Service' : item.tipe === 'FullService' ? 'Drop Off' : 'Layanan');
    if (!groups[kat]) {
      groups[kat] = [];
    }
    groups[kat].push(item);
  });

  const getCategoryIcon = (katName: string) => {
    const k = katName.toLowerCase();
    if (k.includes('self') || k.includes('koin')) return '🧺';
    if (k.includes('drop') || k.includes('full') || k.includes('cuci')) return '👕';
    if (k.includes('setrika') || k.includes('lipat')) return '👔';
    if (k.includes('sepatu') || k.includes('tas')) return '👟';
    if (k.includes('karpet') || k.includes('bedcover')) return '🛏️';
    if (k.includes('add') || k.includes('deterjen') || k.includes('parfum') || k.includes('pewangi')) return '🧴';
    if (k.includes('makan') || k.includes('minum') || k.includes('snack') || k.includes('kopi')) return '☕';
    return '✨';
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 p-4 lg:p-6 print:p-0 print:bg-white print:block">
      {/* Control Panel Header (Hidden on print) */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 mb-5 print:hidden flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
        
        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Format / Ukuran */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Ukuran / Format</label>
            <select 
              value={format.id}
              onChange={e => setFormat(FORMATS.find(f => f.id === e.target.value) || FORMATS[0])}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#1E4648]"
            >
              {FORMATS.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Tema Warna */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Tema Desain</label>
            <select 
              value={theme.id}
              onChange={e => setTheme(THEMES.find(t => t.id === e.target.value) || THEMES[0])}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#1E4648]"
            >
              {THEMES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Tipe */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Kategori Menu</label>
            <select 
              value={filterTipe}
              onChange={e => setFilterTipe(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#1E4648]"
            >
              <option value="Semua">Semua Layanan</option>
              <option value="SelfService">Khusus Self Service</option>
              <option value="FullService">Khusus Drop Off</option>
            </select>
          </div>

          {/* Kolom Layout */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Tata Letak</label>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                onClick={() => setColumnCount(1)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${columnCount === 1 ? 'bg-white text-[#1E4648] shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                1 Kolom
              </button>
              <button
                onClick={() => setColumnCount(2)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${columnCount === 2 ? 'bg-white text-[#1E4648] shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
              >
                2 Kolom
              </button>
            </div>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="range" min="0.25" max="1.25" step="0.05" 
              value={zoom} onChange={e => setZoom(Number(e.target.value))}
              className="w-20 accent-[#1E4648]"
              title={`Zoom: ${Math.round(zoom * 100)}%`}
            />
            <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500 w-10">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Action Buttons: Download JPEG, PNG, Print */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
          <button 
            onClick={loadData} 
            title="Muat Ulang Katalog Layanan"
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Download PNG */}
          <button
            onClick={() => handleDownload('png')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition shadow-2xs"
          >
            {downloading === 'png' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download PNG</span>
          </button>

          {/* Download JPEG */}
          <button
            onClick={() => handleDownload('jpeg')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E4648] hover:bg-[#163536] active:bg-[#11292B] disabled:opacity-60 text-white rounded-lg text-xs font-bold transition shadow-2xs"
          >
            {downloading === 'jpeg' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            <span>Download JPEG</span>
          </button>

          {/* Print / PDF */}
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Canvas Scroll Area */}
      <div className="flex-1 overflow-auto flex justify-center items-start print:overflow-visible print:block bg-slate-300/40 p-4 lg:p-8 rounded-xl border border-slate-200/80">
        
        {/* Dynamic Print Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: ${format.width}px ${format.height}px; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}} />

        {/* Scaled Preview Wrapper */}
        <div 
          style={{ width: format.width * zoom, height: format.height * zoom }} 
          className="print:w-auto print:h-auto shrink-0 transition-all duration-150"
        >
          {/* THE ACTUAL CANVAS FOR EXPORT / PRINT */}
          <div 
            ref={printRef}
            className={`relative overflow-hidden shadow-2xl print:shadow-none mx-auto origin-top-left flex flex-col justify-between ${theme.bg}`}
            style={{ 
              width: `${format.width}px`, 
              height: `${format.height}px`,
              transform: `scale(${zoom})`, 
              fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif" 
            }}
          >
            {/* Background Aesthetic Ornaments & Radial Halos */}
            <div className={`absolute top-0 right-0 w-[500px] h-[500px] rounded-full ${theme.haloColor} blur-[90px] pointer-events-none`} />
            <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full ${theme.haloColor} blur-[100px] pointer-events-none`} />
            <div className="absolute -top-16 -left-16 w-60 h-60 rounded-full border-[10px] border-white/5 blur-[1px] pointer-events-none" />
            <div className="absolute top-1/3 -right-24 w-72 h-72 rounded-full border-[14px] border-white/5 blur-[2px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full border-[16px] border-white/5 blur-[3px] pointer-events-none" />

            {/* MAIN CONTENT CONTAINER */}
            <div className="relative z-10 p-8 sm:p-12 flex flex-col h-full w-full justify-between">
              
              {/* TOP HEADER */}
              <div className="flex flex-col items-center text-center">
                
                {/* Official Logo Banner */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  <img 
                    src={theme.logoSrc} 
                    className="h-14 sm:h-16 w-auto object-contain drop-shadow-md" 
                    alt="Dua Sisi Laundry" 
                  />
                </div>

                {/* Subtitle & Tagline Bar */}
                <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.25em] text-white/90">
                    DAFTAR HARGA & LAYANAN RESMI
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>

                {/* Feature Highlights Pills */}
                <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold text-white/80 mt-1">
                  <span className="inline-flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> Selesai Cepat & Tepat
                  </span>
                  <span className="opacity-40">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-400" /> Air Higienis Terfilter
                  </span>
                  <span className="opacity-40">•</span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Sabun & Pewangi Premium
                  </span>
                </div>

                <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-white/40 to-transparent mt-4 mb-6" />
              </div>

              {/* SERVICE / PRICELIST ITEMS GRID */}
              <div className="flex-1 w-full max-w-5xl mx-auto z-10 flex flex-col justify-center">
                <div className={`grid ${columnCount === 2 ? 'grid-cols-2 gap-5' : 'grid-cols-1 gap-5'} w-full`}>
                  {Object.entries(groups).map(([groupName, items]) => {
                    if (items.length === 0) return null;
                    return (
                      <div 
                        key={groupName} 
                        className={`rounded-2xl p-5 sm:p-6 shadow-lg border relative transition-all ${theme.cardBg}`}
                      >
                        {/* Category Header Badge */}
                        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100/60">
                          <div className="flex items-center gap-2">
                            <span className="text-xl leading-none">{getCategoryIcon(groupName)}</span>
                            <h3 className="font-extrabold text-base sm:text-lg tracking-tight uppercase">
                              {groupName}
                            </h3>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {items.length} Pilihan
                          </span>
                        </div>

                        {/* Items Rows */}
                        <div className="space-y-3">
                          {items.map((item, index) => (
                            <div key={item.id} className="flex items-center gap-3 group">
                              
                              {/* Index / Bullet */}
                              <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-[#1E4648] group-hover:text-white transition">
                                {index + 1}
                              </div>

                              {/* Service Name & Optional Unit */}
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-sm sm:text-base leading-snug truncate">
                                  {item.nama}
                                </span>
                                {showUnit && item.satuan && (
                                  <span className="text-[10px] font-medium opacity-65 -mt-0.5">
                                    per {item.satuan}
                                  </span>
                                )}
                              </div>

                              {/* Elegant Dotted Leader Line */}
                              <div className={`flex-1 border-b-2 border-dotted ${theme.dotColor} relative top-0.5 min-w-6`} />

                              {/* Price Badge */}
                              <div className={`font-black text-sm sm:text-base px-3.5 py-1 rounded-xl shrink-0 shadow-2xs whitespace-nowrap ${theme.priceBadge}`}>
                                Rp {item.harga.toLocaleString('id-ID')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BOTTOM FOOTER */}
              {showFooter && (
                <div className="mt-8 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-white/80 text-[11px] font-medium">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Buka Setiap Hari: <strong>07.00 - 21.00 WIB</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Dua Sisi Laundry Express & Coin — Bersih, Cepat & Terpercaya</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Layanan Pelanggan: <strong>Hubungi Kasir Outlet</strong></span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
