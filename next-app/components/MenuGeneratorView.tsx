'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, Monitor, Smartphone, BookOpen, Presentation, RefreshCw, Printer } from 'lucide-react';
import { runBackend } from '@/lib/api';

interface LayananItemBackend {
  id: string;
  nama: string;
  harga: number;
  satuan: string;
  aktif: string;
  tipe: 'SelfService' | 'FullService';
  kategori?: string;
}

const KATEGORI_MAPPING: Record<string, string> = {
  'SelfService': 'Self Service',
  'FullService': 'Full Service',
  'Add On': 'Tambahan'
};

const FORMATS = [
  { id: 'a4-portrait', name: 'A4 / Poster (Potret)', width: 794, height: 1123, scale: 1 },
  { id: 'a4-landscape', name: 'A4 / TV (Lanskap)', width: 1123, height: 794, scale: 1 },
  { id: 'ig-feed', name: 'IG Feed (1:1)', width: 1080, height: 1080, scale: 1.3 },
  { id: 'ig-story', name: 'IG Story (9:16)', width: 1080, height: 1920, scale: 1.5 }
];

export default function MenuGeneratorView() {
  const [layananList, setLayananList] = useState<LayananItemBackend[]>([]);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState(FORMATS[0]);
  const [filterTipe, setFilterTipe] = useState<'Semua' | 'SelfService' | 'FullService'>('Semua');
  const [zoom, setZoom] = useState(0.5);
  const printRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await runBackend<LayananItemBackend[]>('getLayananListAll');
      if (Array.isArray(data)) {
        setLayananList(data.filter(d => d.aktif === 'Y'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Grouping logic
  const filteredData = layananList.filter(item => filterTipe === 'Semua' || item.tipe === filterTipe);
  
  // To mimic the reference image precisely:
  // Cuci, Cuci + Kering, Tambahan
  // Since we don't have exactly these categories from DB (we only have Layanan, Layanan Tambahan, Produk, MakananMinuman),
  // we will try to infer or group by "tipe" or name.
  const groups: Record<string, LayananItemBackend[]> = {
    'Cuci': [],
    'Cuci + Kering': [],
    'Tambahan': []
  };

  filteredData.forEach(item => {
    const nameLower = item.nama.toLowerCase();
    if (nameLower.includes('kering') || nameLower.includes('setrika')) {
      groups['Cuci + Kering'].push(item);
    } else if (item.tipe === 'FullService' || nameLower.includes('cuci')) {
      groups['Cuci'].push(item);
    } else {
      groups['Tambahan'].push(item);
    }
  });

  return (
    <div className="flex flex-col h-full bg-slate-100 p-4 lg:p-6 print:p-0 print:bg-white print:block">
      {/* Control Panel (Hidden on print) */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 print:hidden flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Ukuran / Format</label>
            <select 
              value={format.id}
              onChange={e => setFormat(FORMATS.find(f => f.id === e.target.value) || FORMATS[0])}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1E4648]"
            >
              {FORMATS.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Filter Tipe</label>
            <select 
              value={filterTipe}
              onChange={e => setFilterTipe(e.target.value as any)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1E4648]"
            >
              <option value="Semua">Semua Tipe</option>
              <option value="SelfService">Self Service</option>
              <option value="FullService">Full Service</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="block text-xs font-bold text-slate-500 mb-1">Zoom ({Math.round(zoom * 100)}%)</label>
            <input 
              type="range" min="0.2" max="2" step="0.1" 
              value={zoom} onChange={e => setZoom(Number(e.target.value))}
              className="w-24 mt-2"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#1E4648] hover:bg-[#163536] text-white px-5 py-2.5 rounded-lg text-sm font-bold transition shadow-sm"
          >
            <Printer className="w-4 h-4" /> Cetak / PDF
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto flex justify-center items-start print:overflow-visible print:block bg-slate-200/50 p-4 rounded-xl border border-slate-200">
        
        {/* Style injection for printing dynamically sized pages */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page { size: ${format.width}px ${format.height}px; margin: 0; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}} />

        <div style={{ width: format.width * zoom, height: format.height * zoom }} className="print:w-auto print:h-auto shrink-0">
          <div 
            ref={printRef}
            className="relative bg-[#1a383a] overflow-hidden shadow-2xl print:shadow-none mx-auto origin-top-left flex flex-col"
            style={{ 
              width: `${format.width}px`, 
              height: `${format.height}px`,
              transform: `scale(${zoom})`, 
              fontFamily: "'Inter', sans-serif" 
            }}
          >
          {/* Decorative Bubbles (Glassmorphism) */}
          <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full border-[15px] border-white/5 blur-[2px]"></div>
          <div className="absolute top-40 -right-32 w-80 h-80 rounded-full border-[20px] border-white/10 blur-[4px]"></div>
          <div className="absolute bottom-10 -left-10 w-40 h-40 rounded-full border-[10px] border-white/5 blur-[3px]"></div>
          <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full border-[25px] border-white/5 blur-[5px]"></div>
          
          <div className="relative z-10 p-12 flex flex-col h-full w-full">
            {/* Header / Logo */}
            <div className="flex justify-center items-center gap-3 mb-10">
              <img src="./assets/Asset 5.svg" className="h-14 brightness-0 invert" alt="Logo" />
              <div className="text-white">
                <div className="font-extrabold text-2xl tracking-tight leading-none">dua SiSi</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-80">Laundry Express & Coin</div>
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col items-center mb-10">
              <div className="bg-[#1e4648] text-white px-8 py-2 font-black text-3xl uppercase tracking-widest shadow-lg border border-white/20 transform -rotate-1">
                DAFTAR HARGA
              </div>
              <div className="bg-white text-[#1a383a] px-10 py-2 font-black text-2xl uppercase tracking-widest shadow-lg transform rotate-1 -mt-2">
                {filterTipe === 'Semua' ? 'LAUNDRY SERVICE' : KATEGORI_MAPPING[filterTipe]?.toUpperCase()}
              </div>
            </div>

            {/* Content Groups */}
            <div className="flex-1 flex flex-col gap-6 w-full max-w-2xl mx-auto z-10 relative">
              {Object.entries(groups).map(([groupName, items]) => {
                if (items.length === 0) return null;
                return (
                  <div key={groupName} className="relative mt-4">
                    {/* Badge Title */}
                    <div className="absolute -top-4 left-6 bg-[#1a383a] text-white font-black px-4 py-1.5 rounded text-lg border-2 border-white/20 z-20 shadow-md">
                      {groupName}
                    </div>
                    {/* List Box */}
                    <div className="bg-white rounded-xl p-6 pt-8 pb-4 shadow-xl border-4 border-white/40">
                      <div className="space-y-4">
                        {items.map((item, index) => (
                          <div key={item.id} className="flex items-center gap-4">
                            {/* Number */}
                            <div className="w-8 h-8 rounded bg-[#1a383a] text-white flex items-center justify-center font-bold text-lg shrink-0">
                              {index + 1}
                            </div>
                            {/* Name */}
                            <div className="font-bold text-[#1a383a] text-xl whitespace-nowrap">
                              {item.nama}
                            </div>
                            {/* Dotted Line */}
                            <div className="flex-1 border-b-2 border-dashed border-[#1a383a]/30 relative top-1 mx-2"></div>
                            {/* Price */}
                            <div className="bg-[#a8bdbd] text-[#1a383a] font-black px-4 py-1.5 rounded-lg text-lg border-2 border-[#1a383a]/10 shrink-0">
                              Rp{item.harga.toLocaleString('id-ID')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
