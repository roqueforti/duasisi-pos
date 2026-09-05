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
  Award,
  Layers,
  Loader2,
  Star,
  Check,
  Flame,
  Shirt,
  ShoppingBag
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
    id: 'neo-studio',
    name: 'Studio Neo-Poster (Teal & Gold)',
    bg: 'bg-[#0c1f21]',
    bgPattern: 'radial-gradient(circle at 50% 0%, rgba(30,70,72,0.8) 0%, rgba(12,31,33,1) 75%)',
    frameBorder: 'border-white/15',
    headerTitleColor: 'text-white',
    subRibbonBg: 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-slate-950 shadow-amber-950/40',
    categoryRibbons: {
      self: 'bg-gradient-to-r from-[#FF9500] to-[#E07A00] text-white',
      drop: 'bg-gradient-to-r from-[#0284C7] to-[#0369A1] text-white',
      addon: 'bg-gradient-to-r from-[#10B981] to-[#047857] text-white',
      fnb: 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white',
      default: 'bg-gradient-to-r from-[#1E4648] to-[#11292B] text-white',
    },
    cardContainer: 'bg-[#142d30]/90 backdrop-blur-md border border-teal-500/20 shadow-2xl',
    itemRow: 'bg-white/5 hover:bg-white/10 border-white/5 text-white',
    numberBadge: 'bg-amber-400 text-slate-950 font-black shadow-xs',
    itemName: 'text-white font-bold',
    itemUnit: 'text-teal-200/70',
    dottedLine: 'border-teal-400/25',
    priceTag: 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md border border-amber-300',
    footerBg: 'bg-[#081516] border-teal-500/20 text-teal-100/80',
    logoSrc: './assets/logo-full-white.svg',
    stampBorder: 'border-amber-400/30 text-amber-300 bg-amber-400/10'
  },
  {
    id: 'fresh-minimal',
    name: 'Scandinavian Clean (Warm Cream & Teal)',
    bg: 'bg-[#F9F7F2]',
    bgPattern: 'radial-gradient(circle at 50% 0%, #FFFFFF 0%, #F4F0E8 85%)',
    frameBorder: 'border-[#1E4648]/20',
    headerTitleColor: 'text-[#1E4648]',
    subRibbonBg: 'bg-[#1E4648] text-white shadow-slate-400/30',
    categoryRibbons: {
      self: 'bg-[#1E4648] text-white',
      drop: 'bg-[#0F766E] text-white',
      addon: 'bg-[#334155] text-white',
      fnb: 'bg-[#D97706] text-white',
      default: 'bg-[#1E4648] text-white',
    },
    cardContainer: 'bg-white border-2 border-[#1E4648]/15 shadow-xl',
    itemRow: 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-200/60 text-slate-800',
    numberBadge: 'bg-[#1E4648] text-white font-black shadow-xs',
    itemName: 'text-slate-900 font-bold',
    itemUnit: 'text-slate-500',
    dottedLine: 'border-slate-300',
    priceTag: 'bg-[#1E4648] text-white font-black shadow-sm border border-[#1E4648]',
    footerBg: 'bg-[#EFECE4] border-[#1E4648]/20 text-slate-700',
    logoSrc: './assets/logo-full-teal.svg',
    stampBorder: 'border-[#1E4648]/30 text-[#1E4648] bg-[#1E4648]/5'
  },
  {
    id: 'cyber-dark',
    name: 'Cyber Express (Obsidian & Electric Cyan)',
    bg: 'bg-[#0A0D14]',
    bgPattern: 'radial-gradient(circle at 50% 0%, #151D2A 0%, #080A0F 85%)',
    frameBorder: 'border-cyan-500/30',
    headerTitleColor: 'text-white',
    subRibbonBg: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-cyan-900/50',
    categoryRibbons: {
      self: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white',
      drop: 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white',
      addon: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950',
      fnb: 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950',
      default: 'bg-gradient-to-r from-slate-700 to-slate-800 text-white',
    },
    cardContainer: 'bg-[#111622]/90 backdrop-blur-md border border-cyan-500/20 shadow-2xl shadow-cyan-950/40',
    itemRow: 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-100',
    numberBadge: 'bg-cyan-400 text-slate-950 font-black shadow-xs',
    itemName: 'text-slate-100 font-bold',
    itemUnit: 'text-cyan-300/70',
    dottedLine: 'border-cyan-500/30',
    priceTag: 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-black shadow-md border border-cyan-300',
    footerBg: 'bg-[#07090E] border-cyan-500/20 text-slate-400',
    logoSrc: './assets/logo-full-white.svg',
    stampBorder: 'border-cyan-400/30 text-cyan-400 bg-cyan-400/10'
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
  const [showStamp, setShowStamp] = useState(true);
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
        pixelRatio: 2, // 2x HD Output
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

  const getCategoryRibbon = (katName: string) => {
    const k = katName.toLowerCase();
    if (k.includes('self') || k.includes('koin')) return theme.categoryRibbons.self;
    if (k.includes('drop') || k.includes('full') || k.includes('cuci')) return theme.categoryRibbons.drop;
    if (k.includes('add') || k.includes('deterjen') || k.includes('parfum') || k.includes('pewangi')) return theme.categoryRibbons.addon;
    if (k.includes('makan') || k.includes('minum') || k.includes('snack') || k.includes('kopi')) return theme.categoryRibbons.fnb;
    return theme.categoryRibbons.default;
  };

  const getCategoryIcon = (katName: string) => {
    const k = katName.toLowerCase();
    if (k.includes('self') || k.includes('koin')) return <Zap className="w-4 h-4" />;
    if (k.includes('drop') || k.includes('full') || k.includes('cuci')) return <Shirt className="w-4 h-4" />;
    if (k.includes('add') || k.includes('deterjen') || k.includes('parfum')) return <Sparkles className="w-4 h-4" />;
    if (k.includes('makan') || k.includes('minum')) return <ShoppingBag className="w-4 h-4" />;
    return <Star className="w-4 h-4" />;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 p-4 lg:p-6 print:p-0 print:bg-white print:text-black print:block">
      
      {/* Control Panel Header (Hidden on print) */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 mb-5 print:hidden flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
        
        {/* Filter & Customization Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Format / Ukuran */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Ukuran / Format</label>
            <select 
              value={format.id}
              onChange={e => setFormat(FORMATS.find(f => f.id === e.target.value) || FORMATS[0])}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:border-[#1E4648]"
            >
              {FORMATS.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Gaya Desain Poster */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Gaya Desain Poster</label>
            <select 
              value={theme.id}
              onChange={e => setTheme(THEMES.find(t => t.id === e.target.value) || THEMES[0])}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:border-[#1E4648]"
            >
              {THEMES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Kategori */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Filter Kategori</label>
            <select 
              value={filterTipe}
              onChange={e => setFilterTipe(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:border-[#1E4648]"
            >
              <option value="Semua">Semua Kategori</option>
              <option value="SelfService">Khusus Self Service</option>
              <option value="FullService">Khusus Drop Off</option>
            </select>
          </div>

          {/* Kolom Layout */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Kolom</label>
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-100">
              <button
                onClick={() => setColumnCount(1)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${columnCount === 1 ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                1 Kolom
              </button>
              <button
                onClick={() => setColumnCount(2)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${columnCount === 2 ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                2 Kolom
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-3 pt-4 sm:pt-0">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={showStamp} 
                onChange={e => setShowStamp(e.target.checked)}
                className="rounded text-[#1E4648] focus:ring-[#1E4648]" 
              />
              <span>Stempel Garansi</span>
            </label>
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
            <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="range" min="0.25" max="1.25" step="0.05" 
              value={zoom} onChange={e => setZoom(Number(e.target.value))}
              className="w-20 accent-[#1E4648]"
              title={`Zoom: ${Math.round(zoom * 100)}%`}
            />
            <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-600 w-10">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Action Buttons: Download JPEG, PNG, Print */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
          <button 
            onClick={loadData} 
            title="Muat Ulang Katalog Layanan"
            className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Download PNG */}
          <button
            onClick={() => handleDownload('png')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            {downloading === 'png' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download PNG (HD)</span>
          </button>

          {/* Download JPEG */}
          <button
            onClick={() => handleDownload('jpeg')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#FF9500] hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            {downloading === 'jpeg' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            <span>Download JPEG (HD)</span>
          </button>

          {/* Print / PDF */}
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-[#1E4648] hover:bg-[#163536] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Canvas Scroll Area */}
      <div className="flex-1 overflow-auto flex justify-center items-start print:overflow-visible print:block bg-slate-200/60 p-4 lg:p-8 rounded-3xl border border-slate-200 shadow-inner">
        
        {/* Dynamic Print Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: ${format.width}px ${format.height}px; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: transparent; }
          }
        `}} />

        {/* Scaled Preview Wrapper */}
        <div 
          style={{ width: format.width * zoom, height: format.height * zoom }} 
          className="print:w-auto print:h-auto shrink-0 transition-all duration-150"
        >
          {/* THE ACTUAL GRAPHIC DESIGN POSTER CANVAS */}
          <div 
            ref={printRef}
            className={`relative overflow-hidden shadow-2xl print:shadow-none mx-auto origin-top-left flex flex-col justify-between ${theme.bg}`}
            style={{ 
              width: `${format.width}px`, 
              height: `${format.height}px`,
              background: theme.bgPattern,
              transform: `scale(${zoom})`, 
              fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif" 
            }}
          >
            {/* POSTER GRAPHIC FRAMING & ACCENT CORNERS */}
            <div className={`absolute inset-4 sm:inset-6 border-2 ${theme.frameBorder} rounded-3xl pointer-events-none z-20`}>
              {/* Corner Crosshairs / Accents */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-400 rounded-full shadow-xs" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full shadow-xs" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-amber-400 rounded-full shadow-xs" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full shadow-xs" />
            </div>

            {/* BACKGROUND ABSTRACT GRAPHIC SHAPES */}
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-teal-500/10 blur-[90px] pointer-events-none" />
            <div className="absolute top-1/2 -right-32 w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-cyan-500/10 blur-[90px] pointer-events-none" />

            {/* MAIN POSTER CONTENT CONTAINER */}
            <div className="relative z-10 p-8 sm:p-12 flex flex-col h-full w-full justify-between">
              
              {/* ==================== HERO HEADER SECTION ==================== */}
              <div className="relative flex flex-col items-center text-center pt-2">
                
                {/* Circular Guarantee Stamp (Floating Top Right) */}
                {showStamp && (
                  <div className={`absolute -top-2 right-0 sm:right-2 hidden sm:flex flex-col items-center justify-center w-24 h-24 rounded-full border-2 border-dashed ${theme.stampBorder} transform rotate-12 shadow-lg backdrop-blur-xs select-none`}>
                    <Award className="w-6 h-6 mb-0.5" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-center leading-tight">
                      100% HIGIENIS<br />& BERSIH
                    </span>
                  </div>
                )}

                {/* Official Logo Banner */}
                <div className="mb-4">
                  <img 
                    src={theme.logoSrc} 
                    className="h-16 sm:h-20 w-auto object-contain drop-shadow-md mx-auto" 
                    alt="Dua Sisi Laundry" 
                  />
                </div>

                {/* High-Impact Graphic Title Block */}
                <div className="relative inline-block mb-3">
                  <h1 className={`text-4xl sm:text-5xl font-black uppercase tracking-tighter ${theme.headerTitleColor} drop-shadow-lg`}>
                    DAFTAR HARGA
                  </h1>
                </div>

                {/* Skewed Ribbon Banner */}
                <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-xl font-black text-sm sm:text-base uppercase tracking-widest transform -rotate-1 shadow-lg ${theme.subRibbonBg}`}>
                  <Sparkles className="w-4 h-4" />
                  <span>LAUNDRY SERVICE & COIN EXPRESS</span>
                  <Sparkles className="w-4 h-4" />
                </div>

                {/* Key Benefits Pills Bar */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] font-extrabold uppercase tracking-wider text-white/90">
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 inline-flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Selesai Cepat & Tepat
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 inline-flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" /> Air Higienis 3 Tahap
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Sabun & Pewangi Premium
                  </span>
                </div>

                {/* Divider Line */}
                <div className="w-32 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent mt-5 mb-4 rounded-full opacity-80" />
              </div>

              {/* ==================== PRICELIST CATEGORIES GRID ==================== */}
              <div className="flex-1 w-full max-w-5xl mx-auto z-10 flex flex-col justify-center my-2">
                <div className={`grid ${columnCount === 2 ? 'grid-cols-2 gap-5' : 'grid-cols-1 gap-5'} w-full`}>
                  {Object.entries(groups).map(([groupName, items]) => {
                    if (items.length === 0) return null;
                    return (
                      <div 
                        key={groupName} 
                        className={`rounded-3xl p-5 sm:p-6 relative overflow-hidden transition-all ${theme.cardContainer}`}
                      >
                        {/* CATEGORY SECTION HEADER RIBBON */}
                        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-white/10">
                          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl font-black text-sm sm:text-base tracking-wide uppercase shadow-md ${getCategoryRibbon(groupName)}`}>
                            {getCategoryIcon(groupName)}
                            <span>{groupName}</span>
                          </div>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-white/10 text-white/90 border border-white/10">
                            {items.length} Menu
                          </span>
                        </div>

                        {/* ITEMS LIST */}
                        <div className="space-y-2.5">
                          {items.map((item, index) => (
                            <div 
                              key={item.id} 
                              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all ${theme.itemRow}`}
                            >
                              {/* Number Badge */}
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${theme.numberBadge}`}>
                                {index + 1}
                              </div>

                              {/* Service Name & Subtitle Unit */}
                              <div className="flex flex-col min-w-0">
                                <span className={`text-sm sm:text-base leading-snug truncate ${theme.itemName}`}>
                                  {item.nama}
                                </span>
                                {showUnit && item.satuan && (
                                  <span className={`text-[10px] font-semibold -mt-0.5 ${theme.itemUnit}`}>
                                    Satuan: {item.satuan}
                                  </span>
                                )}
                              </div>

                              {/* Leader Dots */}
                              <div className={`flex-1 border-b-2 border-dotted ${theme.dottedLine} relative top-0.5 min-w-4`} />

                              {/* Bold Price Sticker Tag */}
                              <div className={`text-sm sm:text-base px-3.5 py-1 rounded-xl shrink-0 whitespace-nowrap leading-tight tracking-tight ${theme.priceTag}`}>
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

              {/* ==================== FOOTER BRANDING & OPERATIONAL INFO ==================== */}
              {showFooter && (
                <div className={`mt-6 p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold ${theme.footerBg}`}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Jam Operasional: <strong>07.00 - 23.00 WIB (Buka Tiap Hari)</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dua Sisi Laundry — <strong>Cepat • Bersih • Wangi</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Customer Service: <strong>Hubungi Kasir Outlet</strong></span>
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
