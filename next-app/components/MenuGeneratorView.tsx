'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Download, 
  Printer, 
  RefreshCw, 
  Sparkles, 
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
  Loader2,
  Shirt,
  ShoppingBag,
  Maximize2,
  SlidersHorizontal,
  Layers,
  Sparkle
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
  { id: 'ig-feed', name: 'Instagram Feed (1:1)', width: 1080, height: 1080, defaultCols: 2 },
  { id: 'ig-story', name: 'IG Story / WhatsApp (9:16)', width: 1080, height: 1920, defaultCols: 1 },
  { id: 'a4-portrait', name: 'A4 Poster Dinding (Potret)', width: 794, height: 1123, defaultCols: 2 },
  { id: 'a4-landscape', name: 'A4 / TV Display Outlet (Lanskap)', width: 1123, height: 794, defaultCols: 4 },
  { id: 'auto-fit', name: 'Auto Fit (Panjang Sesuai Isi)', width: 1080, height: 'auto', defaultCols: 2 }
];

const THEMES = [
  {
    id: 'dua-sisi-signature',
    name: 'Dua Sisi Signature (Teal & Gold)',
    bg: 'bg-[#0D2324]',
    bgPattern: 'radial-gradient(circle at 50% 10%, rgba(30,70,72,0.6) 0%, rgba(13,35,36,1) 80%)',
    frameBorder: 'border-teal-500/20',
    headerTitleColor: 'text-white',
    headerSubtitleColor: 'text-teal-200/80',
    pillBg: 'bg-white/10 text-teal-100 border-white/10',
    categoryRibbons: {
      self: 'bg-gradient-to-r from-[#FF9500] to-[#D97706] text-white',
      drop: 'bg-gradient-to-r from-[#0284C7] to-[#0369A1] text-white',
      addon: 'bg-gradient-to-r from-[#10B981] to-[#047857] text-white',
      fnb: 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white',
      default: 'bg-gradient-to-r from-[#1E4648] to-[#11292B] text-white',
    },
    cardContainer: 'bg-[#143236]/90 border border-teal-500/20 shadow-xl',
    itemRow: 'bg-white/5 hover:bg-white/10 border-white/5 text-white',
    numberBadge: 'bg-amber-400 text-slate-950 font-black',
    itemName: 'text-white font-bold',
    itemUnit: 'text-teal-200/70',
    dottedLine: 'border-teal-400/20',
    priceTag: 'bg-amber-400 text-slate-950 font-black shadow-xs',
    footerBg: 'bg-[#091A1B] border-teal-500/20 text-teal-200/80',
    logoSrc: './assets/logo-full-white.svg',
    stampBorder: 'border-amber-400/40 text-amber-300 bg-amber-400/10'
  },
  {
    id: 'scandinavian-light',
    name: 'Scandinavian Clean (Putih Minimalist)',
    bg: 'bg-[#FFFFFF]',
    bgPattern: 'radial-gradient(circle at 50% 0%, #FFFFFF 0%, #F8FAFC 85%)',
    frameBorder: 'border-slate-200',
    headerTitleColor: 'text-[#1E4648]',
    headerSubtitleColor: 'text-slate-500',
    pillBg: 'bg-slate-100 text-slate-700 border-slate-200',
    categoryRibbons: {
      self: 'bg-[#1E4648] text-white',
      drop: 'bg-[#0F766E] text-white',
      addon: 'bg-[#334155] text-white',
      fnb: 'bg-[#D97706] text-white',
      default: 'bg-[#1E4648] text-white',
    },
    cardContainer: 'bg-[#F8FAFC] border border-slate-200 shadow-sm',
    itemRow: 'bg-white hover:bg-slate-50 border-slate-100 text-slate-800',
    numberBadge: 'bg-[#1E4648] text-white font-black',
    itemName: 'text-slate-900 font-bold',
    itemUnit: 'text-slate-400',
    dottedLine: 'border-slate-200',
    priceTag: 'bg-[#1E4648] text-white font-black shadow-xs',
    footerBg: 'bg-slate-100 border-slate-200 text-slate-600',
    logoSrc: './assets/logo-full-teal.svg',
    stampBorder: 'border-[#1E4648]/30 text-[#1E4648] bg-[#1E4648]/5'
  },
  {
    id: 'minimal-slate',
    name: 'Modern Slate (Obsidian & Gold)',
    bg: 'bg-[#0F172A]',
    bgPattern: 'radial-gradient(circle at 50% 0%, #1E293B 0%, #0F172A 85%)',
    frameBorder: 'border-slate-700',
    headerTitleColor: 'text-white',
    headerSubtitleColor: 'text-slate-400',
    pillBg: 'bg-slate-800 text-slate-300 border-slate-700',
    categoryRibbons: {
      self: 'bg-amber-500 text-slate-950',
      drop: 'bg-teal-500 text-slate-950',
      addon: 'bg-emerald-500 text-slate-950',
      fnb: 'bg-purple-500 text-white',
      default: 'bg-slate-700 text-white',
    },
    cardContainer: 'bg-[#1E293B]/90 border border-slate-700 shadow-xl',
    itemRow: 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-100',
    numberBadge: 'bg-amber-400 text-slate-950 font-black',
    itemName: 'text-slate-100 font-bold',
    itemUnit: 'text-slate-400',
    dottedLine: 'border-slate-700',
    priceTag: 'bg-amber-400 text-slate-950 font-black shadow-xs',
    footerBg: 'bg-[#0A0F1D] border-slate-800 text-slate-400',
    logoSrc: './assets/logo-full-white.svg',
    stampBorder: 'border-amber-400/30 text-amber-300 bg-amber-400/10'
  }
];

// Order of categories for laundromat business logic
const CANONICAL_CATEGORY_ORDER = [
  'Self Service',
  'Drop Off',
  'Add On',
  'Makanan dan Minuman'
];

export default function MenuGeneratorView() {
  const [layananList, setLayananList] = useState<LayananItemBackend[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'png' | 'jpeg' | null>(null);
  const [format, setFormat] = useState(FORMATS[0]);
  const [theme, setTheme] = useState(THEMES[0]);
  const [filterTipe, setFilterTipe] = useState<'Semua' | 'SelfService' | 'FullService' | 'Retail'>('Semua');
  const [density, setDensity] = useState<'compact' | 'normal'>('compact');
  const [columnCount, setColumnCount] = useState<number>(2);
  const [showUnit, setShowUnit] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [zoom, setZoom] = useState(0.5);

  const printRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // Ambil layanan & produk
      const [layData, invData] = await Promise.all([
        runBackend<LayananItemBackend[]>('getLayananListAll').catch(() => []),
        runBackend<any[]>('getInventoryList').catch(() => [])
      ]);

      const items: LayananItemBackend[] = [];
      const seenNames = new Set<string>();

      if (Array.isArray(layData)) {
        layData.filter(d => d.aktif === 'Y').forEach(item => {
          items.push(item);
          seenNames.add(item.nama.toLowerCase().trim());
        });
      }

      // Gabungkan jika ada item inventory yang dijual langsung dan belum terdaftar di layanan
      if (Array.isArray(invData)) {
        invData.forEach(inv => {
          if (inv.is_dijual && inv.harga_jual > 0 && !seenNames.has(inv.nama.toLowerCase().trim())) {
            items.push({
              id: inv.id,
              nama: inv.nama,
              harga: Number(inv.harga_jual) || 0,
              satuan: inv.satuan || 'pcs',
              aktif: 'Y',
              tipe: '',
              kategori: inv.kategori || 'Makanan dan Minuman'
            });
            seenNames.add(inv.nama.toLowerCase().trim());
          }
        });
      }

      setLayananList(items);
    } catch (err) {
      console.error('Gagal memuat katalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update column count based on format
  useEffect(() => {
    if (format.defaultCols) {
      setColumnCount(format.defaultCols);
    }
  }, [format]);

  // Auto-fit zoom to viewport on load / format change
  const handleAutoFitZoom = () => {
    if (!scrollAreaRef.current) return;
    const containerW = scrollAreaRef.current.clientWidth - 48; // padding
    const targetW = typeof format.width === 'number' ? format.width : 1080;
    const calculated = Math.min(1, Math.max(0.25, containerW / targetW));
    setZoom(Math.round(calculated * 100) / 100);
  };

  useEffect(() => {
    const timer = setTimeout(handleAutoFitZoom, 200);
    return () => clearTimeout(timer);
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

  // Filter items
  const filteredData = useMemo(() => {
    return layananList.filter(item => {
      if (filterTipe === 'Semua') return true;
      if (filterTipe === 'SelfService') return item.tipe === 'SelfService' && item.kategori === 'Self Service';
      if (filterTipe === 'FullService') return item.tipe === 'FullService' || item.kategori === 'Drop Off';
      if (filterTipe === 'Retail') return item.kategori === 'Add On' || item.kategori === 'Makanan dan Minuman';
      return true;
    });
  }, [layananList, filterTipe]);

  // Group items by category in canonical business order
  const categorizedGroups = useMemo(() => {
    const map: Record<string, LayananItemBackend[]> = {};
    
    filteredData.forEach(item => {
      let kat = item.kategori;
      if (!kat) {
        if (item.tipe === 'SelfService') kat = 'Self Service';
        else if (item.tipe === 'FullService') kat = 'Drop Off';
        else kat = 'Layanan Lainnya';
      }
      if (!map[kat]) map[kat] = [];
      map[kat].push(item);
    });

    // Sort categories canonically
    const sortedKeys = Object.keys(map).sort((a, b) => {
      const idxA = CANONICAL_CATEGORY_ORDER.indexOf(a);
      const idxB = CANONICAL_CATEGORY_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map(key => ({
      name: key,
      items: map[key]
    }));
  }, [filteredData]);

  // Balance into columns when columnCount === 2
  // Col 1: Self Service + Drop Off
  // Col 2: Add On + Makanan & Minuman
  const twoColumnLayout = useMemo(() => {
    const col1: typeof categorizedGroups = [];
    const col2: typeof categorizedGroups = [];

    categorizedGroups.forEach(group => {
      const lower = group.name.toLowerCase();
      if (lower.includes('self') || lower.includes('drop') || lower.includes('cuci')) {
        col1.push(group);
      } else {
        col2.push(group);
      }
    });

    // Fallback if imbalanced
    if (col1.length === 0 && col2.length > 0) {
      return { col1: col2.slice(0, Math.ceil(col2.length / 2)), col2: col2.slice(Math.ceil(col2.length / 2)) };
    }
    if (col2.length === 0 && col1.length > 0) {
      return { col1: col1.slice(0, Math.ceil(col1.length / 2)), col2: col1.slice(Math.ceil(col1.length / 2)) };
    }

    return { col1, col2 };
  }, [categorizedGroups]);

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
    if (k.includes('self') || k.includes('koin')) return <Zap className="w-3.5 h-3.5" />;
    if (k.includes('drop') || k.includes('full') || k.includes('cuci')) return <Shirt className="w-3.5 h-3.5" />;
    if (k.includes('add') || k.includes('deterjen') || k.includes('parfum')) return <Sparkles className="w-3.5 h-3.5" />;
    if (k.includes('makan') || k.includes('minum')) return <ShoppingBag className="w-3.5 h-3.5" />;
    return <Sparkle className="w-3.5 h-3.5" />;
  };

  const isAutoHeight = format.id === 'auto-fit';
  const computedCanvasHeight = isAutoHeight ? 'auto' : `${format.height}px`;

  // Render a single category card with ultra-clean minimalist styling
  const renderCategoryCard = (group: { name: string; items: LayananItemBackend[] }) => (
    <div 
      key={group.name} 
      className={`rounded-2xl p-3.5 sm:p-4 relative transition-all ${theme.cardContainer}`}
    >
      {/* Category Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs sm:text-sm tracking-wide uppercase ${getCategoryRibbon(group.name)}`}>
          {getCategoryIcon(group.name)}
          <span>{group.name}</span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-white/90">
          {group.items.length} Menu
        </span>
      </div>

      {/* Items List */}
      <div className={density === 'compact' ? 'space-y-1.5' : 'space-y-2'}>
        {group.items.map((item, index) => (
          <div 
            key={item.id} 
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition-all ${theme.itemRow} ${
              density === 'compact' ? 'text-xs' : 'text-sm py-1.5'
            }`}
          >
            {/* Number */}
            <span className={`w-4.5 h-4.5 rounded-md flex items-center justify-center text-[10px] shrink-0 font-bold ${theme.numberBadge}`}>
              {index + 1}
            </span>

            {/* Name & Unit */}
            <div className="flex items-baseline gap-1.5 min-w-0 truncate">
              <span className={`truncate leading-snug ${theme.itemName} ${density === 'compact' ? 'text-xs' : 'text-sm'}`}>
                {item.nama}
              </span>
              {showUnit && item.satuan && (
                <span className={`text-[10px] shrink-0 font-medium ${theme.itemUnit}`}>
                  /{item.satuan}
                </span>
              )}
            </div>

            {/* Leader line dots */}
            <div className={`flex-1 border-b border-dotted ${theme.dottedLine} min-w-2`} />

            {/* Price Tag */}
            <div className={`px-2.5 py-0.5 rounded-lg shrink-0 text-xs font-black tracking-tight ${theme.priceTag}`}>
              Rp {item.harga.toLocaleString('id-ID')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 p-3 sm:p-4 lg:p-6 print:p-0 print:bg-white print:text-black print:block">
      
      {/* ========================================================================= */}
      {/* RESPONSIVE TOOLBAR CONTROLS (Hidden on print)                              */}
      {/* ========================================================================= */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-slate-200 mb-4 print:hidden flex flex-col xl:flex-row gap-3 items-start xl:items-center justify-between">
        
        {/* Left Toolbar: Customization Dropdowns & Presets */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full xl:w-auto">
          {/* Format / Ukuran */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ukuran / Format</label>
            <select 
              value={format.id}
              onChange={e => setFormat(FORMATS.find(f => f.id === e.target.value) || FORMATS[0])}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-[#1E4648]"
            >
              {FORMATS.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Gaya Desain Minimalis */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Gaya Desain</label>
            <select 
              value={theme.id}
              onChange={e => setTheme(THEMES.find(t => t.id === e.target.value) || THEMES[0])}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-[#1E4648]"
            >
              {THEMES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Kategori */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filter Kategori</label>
            <select 
              value={filterTipe}
              onChange={e => setFilterTipe(e.target.value as any)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:border-[#1E4648]"
            >
              <option value="Semua">Semua Layanan & Produk ({layananList.length})</option>
              <option value="SelfService">Khusus Self Service</option>
              <option value="FullService">Khusus Drop Off</option>
              <option value="Retail">Khusus Add-On & Snack</option>
            </select>
          </div>

          {/* Kolom Layout */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Kolom</label>
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-100 text-xs font-bold">
              <button
                onClick={() => setColumnCount(1)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${columnCount === 1 ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                1 Kolom
              </button>
              <button
                onClick={() => setColumnCount(2)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${columnCount === 2 ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                2 Kolom
              </button>
              {format.width >= 1000 && (
                <button
                  onClick={() => setColumnCount(4)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${columnCount === 4 ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  4 Kolom
                </button>
              )}
            </div>
          </div>

          {/* Kepadatan (Density) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Kepadatan Baris</label>
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-100 text-xs font-bold">
              <button
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${density === 'compact' ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                title="Rapat agar seluruh 30+ menu muat tanpa terpotong"
              >
                Rapat (Muat Semua)
              </button>
              <button
                onClick={() => setDensity('normal')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${density === 'normal' ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Normal
              </button>
            </div>
          </div>
        </div>

        {/* Right Toolbar: Zoom & Export Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100">
          {/* Auto Fit Zoom Button */}
          <button
            onClick={handleAutoFitZoom}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Sesuaikan ukuran preview ke layar Anda"
          >
            <Maximize2 className="w-3.5 h-3.5 text-teal-700" />
            <span>Fit Layar</span>
          </button>

          {/* Zoom Slider */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200">
            <ZoomOut className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="range" min="0.2" max="1.2" step="0.05" 
              value={zoom} onChange={e => setZoom(Number(e.target.value))}
              className="w-16 accent-[#1E4648] cursor-pointer"
              title={`Zoom: ${Math.round(zoom * 100)}%`}
            />
            <ZoomIn className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-extrabold text-slate-600 w-8">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Refresh */}
          <button 
            onClick={loadData} 
            title="Muat Ulang Katalog Layanan & Produk"
            className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Download PNG */}
          <button
            onClick={() => handleDownload('png')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            {downloading === 'png' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Download PNG (HD)</span>
          </button>

          {/* Download JPEG */}
          <button
            onClick={() => handleDownload('jpeg')}
            disabled={downloading !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF9500] hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            {downloading === 'jpeg' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            <span>JPEG</span>
          </button>

          {/* Print / PDF */}
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-[#1E4648] hover:bg-[#163536] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CANVAS SCROLL & RESPONSIVE PREVIEW AREA                                   */}
      {/* ========================================================================= */}
      <div 
        ref={scrollAreaRef}
        className="flex-1 overflow-auto flex justify-center items-start print:overflow-visible print:block bg-slate-200/50 p-2 sm:p-4 lg:p-6 rounded-3xl border border-slate-200 shadow-inner"
      >
        {/* Dynamic Print Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: ${format.width}px ${format.height === 'auto' ? 'auto' : `${format.height}px`}; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: transparent; }
          }
        `}} />

        {/* Scaled Preview Wrapper */}
        <div 
          style={{ 
            width: typeof format.width === 'number' ? format.width * zoom : 'auto', 
            height: isAutoHeight ? 'auto' : (format.height as number) * zoom 
          }} 
          className="print:w-auto print:h-auto shrink-0 transition-all duration-150"
        >
          {/* THE ACTUAL GRAPHIC DESIGN POSTER CANVAS */}
          <div 
            ref={printRef}
            className={`relative overflow-hidden shadow-xl print:shadow-none mx-auto origin-top-left flex flex-col justify-between ${theme.bg}`}
            style={{ 
              width: `${format.width}px`, 
              height: computedCanvasHeight,
              minHeight: isAutoHeight ? '1080px' : undefined,
              background: theme.bgPattern,
              transform: `scale(${zoom})`, 
              fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif" 
            }}
          >
            {/* Minimalist Framing Border */}
            <div className={`absolute inset-3 sm:inset-4 border ${theme.frameBorder} rounded-2xl pointer-events-none z-20`} />

            {/* ==================== CONTENT CONTAINER ==================== */}
            <div className="relative z-10 p-5 sm:p-7 flex flex-col h-full w-full justify-between gap-3">
              
              {/* HEADER SECTION (Clean, Minimalist & Compact) */}
              <div className="flex flex-col items-center text-center pt-1 pb-1">
                {/* Logo */}
                <div className="mb-2">
                  <img 
                    src={theme.logoSrc} 
                    className="h-9 sm:h-11 w-auto object-contain mx-auto" 
                    alt="Dua Sisi Laundry" 
                  />
                </div>

                {/* Minimalist Title */}
                <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${theme.headerTitleColor}`}>
                  DAFTAR HARGA & LAYANAN
                </h1>
                
                {/* Tagline Subtitle */}
                <p className={`text-xs font-semibold mt-0.5 ${theme.headerSubtitleColor}`}>
                  Dua Sisi Laundromat • Self Service & Drop Off Express
                </p>

                {/* Key Benefits Minimalist Chips */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5 text-[10px] font-bold uppercase tracking-wider">
                  <span className={`px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${theme.pillBg}`}>
                    <Droplets className="w-3 h-3 text-cyan-400" /> Air Higienis 3 Tahap
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${theme.pillBg}`}>
                    <Sparkles className="w-3 h-3 text-amber-400" /> Sabun & Pewangi Premium
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${theme.pillBg}`}>
                    <Zap className="w-3 h-3 text-emerald-400" /> Selesai Cepat & Tepat
                  </span>
                </div>
              </div>

              {/* CATEGORIES GRID (Smart Multi-Column Layout) */}
              <div className="flex-1 w-full my-auto">
                {columnCount === 2 ? (
                  /* 2-Column Balanced Layout (Laundry Left, Retail/Add-on Right) */
                  <div className="grid grid-cols-2 gap-3.5 w-full items-start">
                    {/* Column 1: Laundry Services (Self Service & Drop Off) */}
                    <div className="flex flex-col gap-3">
                      {twoColumnLayout.col1.map(renderCategoryCard)}
                    </div>

                    {/* Column 2: Add-On & Retail Goods (Snacks & Supplies) */}
                    <div className="flex flex-col gap-3">
                      {twoColumnLayout.col2.map(renderCategoryCard)}
                    </div>
                  </div>
                ) : columnCount === 4 ? (
                  /* 4-Column Layout (e.g. A4 Landscape / TV Display) */
                  <div className="grid grid-cols-4 gap-3 w-full items-start">
                    {categorizedGroups.map(renderCategoryCard)}
                  </div>
                ) : (
                  /* 1-Column Layout (e.g. IG Story / A4 Portrait) */
                  <div className="flex flex-col gap-3 w-full">
                    {categorizedGroups.map(renderCategoryCard)}
                  </div>
                )}
              </div>

              {/* FOOTER SECTION (Clean Operational Info) */}
              {showFooter && (
                <div className={`mt-2 p-2.5 sm:p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-[11px] font-semibold ${theme.footerBg}`}>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Jam Operasional: <strong>07.00 - 23.00 WIB (Buka Setiap Hari)</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Dua Sisi Laundry — <strong>Cepat • Bersih • Wangi</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
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
