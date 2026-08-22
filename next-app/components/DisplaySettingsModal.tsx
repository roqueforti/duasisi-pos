'use client';

import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Sliders, 
  Type, 
  Sparkles, 
  Maximize2, 
  Layers, 
  Check, 
  Monitor, 
  Smartphone, 
  Tablet, 
  ShoppingCart,
  Tag,
  Coins,
  ChevronRight,
  Eye
} from 'lucide-react';
import { 
  useDisplaySettings, 
  ZOOM_PRESETS, 
  FONT_OPTIONS, 
  FontOption 
} from './DisplaySettingsContext';

interface DisplaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DisplaySettingsModal({ isOpen, onClose }: DisplaySettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useDisplaySettings();
  const [activeTab, setActiveTab] = useState<'size' | 'font' | 'preview'>('size');

  if (!isOpen) return null;

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.min(160, Math.max(70, Math.round(newZoom)));
    updateSettings({ zoomScale: clamped });
  };

  const handleStepZoom = (delta: number) => {
    handleZoomChange(settings.zoomScale + delta);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in select-none">
      <div 
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-pop-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-teal-50/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1E4648] to-[#115e59] text-white flex items-center justify-center shadow-md shadow-teal-900/10 shrink-0">
              <Sliders className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-800 tracking-tight">
                  Pengaturan Ukuran Tampilan & Font
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200">
                  Live Preview
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Sesuaikan ukuran layar, skala zoom, dan tipografi agar paling pas di layar perangkat Anda.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-2xl transition cursor-pointer shrink-0"
            title="Tutup Pengaturan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <button
            onClick={() => setActiveTab('size')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'size'
                ? 'bg-white text-[#1E4648] shadow-sm border border-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Skala Ukuran ({settings.zoomScale}%)</span>
          </button>

          <button
            onClick={() => setActiveTab('font')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'font'
                ? 'bg-white text-[#1E4648] shadow-sm border border-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Pilihan Font ({settings.fontFamily})</span>
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ml-auto ${
              activeTab === 'preview'
                ? 'bg-white text-[#1E4648] shadow-sm border border-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-amber-500" />
            <span>Lihat Contoh Display</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: SIZE & ZOOM */}
          {activeTab === 'size' && (
            <div className="space-y-6">
              {/* Granular Zoom Slider with Steppers */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4.5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-teal-700" />
                    <label className="text-xs font-bold text-slate-800">
                      Pengaturan Skala Halus (Granular Slider)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Skala Aktif:</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#1E4648] text-white text-xs font-black shadow-xs">
                      {settings.zoomScale}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => handleStepZoom(-5)}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1 shrink-0 tactile-btn"
                    title="Perkecil 5%"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                    <span>-5%</span>
                  </button>

                  <div className="flex-1 relative flex items-center">
                    <input
                      type="range"
                      min={70}
                      max={160}
                      step={1}
                      value={settings.zoomScale}
                      onChange={(e) => handleZoomChange(Number(e.target.value))}
                      className="w-full accent-[#1E4648] cursor-pointer h-2 bg-slate-200 rounded-lg"
                    />
                  </div>

                  <button
                    onClick={() => handleStepZoom(5)}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1 shrink-0 tactile-btn"
                    title="Perbesar 5%"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>+5%</span>
                  </button>
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-1">
                  <span>70% (Ultra Ringkas)</span>
                  <span>100% (Standar)</span>
                  <span>125% (Kasir POS)</span>
                  <span>160% (Jumbo)</span>
                </div>
              </div>

              {/* Comprehensive Presets Grid (Grouped) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Pilihan Cepat Ukuran (Presets Siap Pakai)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Klik untuk mencoba langsung</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ZOOM_PRESETS.map((preset) => {
                    const isSelected = settings.zoomScale === preset.value;
                    return (
                      <button
                        key={preset.value}
                        onClick={() => handleZoomChange(preset.value)}
                        className={`p-3 rounded-2xl border text-left transition-all duration-150 relative tactile-btn cursor-pointer flex flex-col justify-between min-h-[72px] ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#1E4648] to-[#115e59] text-white border-teal-600 shadow-md shadow-teal-900/15 scale-[1.02]'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-base font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {preset.label}
                          </span>
                          {isSelected ? (
                            <div className="w-4 h-4 rounded-full bg-teal-300 text-teal-900 flex items-center justify-center text-[10px]">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-bold">{preset.group.split('/')[0]}</span>
                          )}
                        </div>
                        <span className={`text-[10px] font-semibold mt-1 truncate ${
                          isSelected ? 'text-teal-200' : 'text-slate-500'
                        }`}>
                          {preset.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Density Options */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-700" />
                  <label className="text-xs font-bold text-slate-800">
                    Kepadatan Jarak & Padding (Layout Density)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => updateSettings({ density: 'compact' })}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer tactile-btn ${
                      settings.density === 'compact'
                        ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold ring-1 ring-teal-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Ringkas (Compact)</span>
                      {settings.density === 'compact' && <Check className="w-3.5 h-3.5 text-teal-700" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Jarak rapat, informasi lebih banyak terlihat.</p>
                  </button>

                  <button
                    onClick={() => updateSettings({ density: 'normal' })}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer tactile-btn ${
                      settings.density === 'normal'
                        ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold ring-1 ring-teal-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Standar (Normal)</span>
                      {settings.density === 'normal' && <Check className="w-3.5 h-3.5 text-teal-700" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Proporsi ideal dan seimbang untuk semua monitor.</p>
                  </button>

                  <button
                    onClick={() => updateSettings({ density: 'comfortable' })}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer tactile-btn ${
                      settings.density === 'comfortable'
                        ? 'bg-teal-50 border-teal-500 text-teal-900 font-bold ring-1 ring-teal-500'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Lega (Touch POS)</span>
                      {settings.density === 'comfortable' && <Check className="w-3.5 h-3.5 text-teal-700" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tombol & baris lebih besar untuk sentuhan jari.</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FONT & TYPOGRAPHY */}
          {activeTab === 'font' && (
            <div className="space-y-6">
              {/* Font Weight & Base Size Sub-bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Font Weight */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-teal-700" />
                    <span>Ketebalan Teks (Font Weight)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'normal', label: 'Normal' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'semibold', label: 'Tegas Kontras' }
                    ].map((w) => (
                      <button
                        key={w.id}
                        onClick={() => updateSettings({ fontWeightMode: w.id as any })}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          settings.fontWeightMode === w.id
                            ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base Font Size */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-teal-700" />
                      <span>Ukuran Dasar Huruf</span>
                    </label>
                    <span className="text-xs font-black text-slate-800">{settings.fontBaseSize}px</span>
                  </div>
                  <div className="flex items-center gap-1 justify-between">
                    {[12, 13, 14, 15, 16, 17, 18].map((size) => (
                      <button
                        key={size}
                        onClick={() => updateSettings({ fontBaseSize: size })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                          settings.fontBaseSize === size
                            ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Font Gallery Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Galeri Jenis Huruf (Pilihan Font)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Pilih font untuk melihat perbedaannya</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {FONT_OPTIONS.map((font: FontOption) => {
                    const isSelected = settings.fontFamily === font.name || settings.fontFamily === font.id;
                    return (
                      <button
                        key={font.id}
                        onClick={() => updateSettings({ fontFamily: font.name })}
                        className={`p-3.5 rounded-2xl border text-left transition-all duration-150 relative tactile-btn cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-teal-50/90 border-teal-600 shadow-sm ring-1 ring-teal-500'
                            : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-sm font-extrabold text-slate-900 tracking-tight"
                              style={{ fontFamily: font.family }}
                            >
                              {font.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              {font.category}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {/* Live Font Sample rendering */}
                        <div 
                          className="mt-2 p-2 rounded-xl bg-slate-50/80 border border-slate-100 text-xs text-slate-800"
                          style={{ fontFamily: font.family }}
                        >
                          <div className="font-bold">Dua SiSi POS — Cuci Komplit 7.5kg</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Rp 55.000 • Nota #LDY-260822-0001</div>
                        </div>

                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
                          {font.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-teal-700" />
                  <span>Simulasi Tampilan Komponen POS</span>
                </h3>
                <span className="text-xs text-slate-500 font-semibold">
                  Font: <strong className="text-[#1E4648]">{settings.fontFamily}</strong> • Skala: <strong className="text-[#1E4648]">{settings.zoomScale}%</strong>
                </span>
              </div>

              {/* Sample POS Item Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Sample Cashier Card 1 */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 border border-teal-200">
                      Drop-off Kiloan
                    </span>
                    <span className="text-xs font-black text-emerald-600">Rp 55.000</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Cuci Kering Lipat 7.5kg</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Estimasi pengerjaan: 2 Hari kerja</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Stempel Member: <strong>+1 Stamp</strong></span>
                    <button className="px-3 py-1.5 rounded-xl bg-[#1E4648] text-white text-xs font-bold shadow-xs hover:bg-[#163536] transition">
                      + Tambah ke Nota
                    </button>
                  </div>
                </div>

                {/* Sample Cashier Card 2 */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                      Self Service Koin
                    </span>
                    <span className="text-xs font-black text-emerald-600">Rp 20.000</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Token Washer Mesin 1</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Durasi putaran cuci: 45 Menit</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">Status: <strong className="text-emerald-600">Mesin Tersedia</strong></span>
                    <button className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-xs hover:bg-amber-700 transition">
                      Mulai Mesin
                    </button>
                  </div>
                </div>
              </div>

              {/* Sample Table / Invoice Row */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-2">
                <div className="text-xs font-bold text-slate-700">Contoh Ringkasan Transaksi Kasir:</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-extrabold uppercase">
                        <th className="text-left py-1.5">No. Nota</th>
                        <th className="text-left py-1.5">Pelanggan</th>
                        <th className="text-right py-1.5">Total</th>
                        <th className="text-center py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      <tr>
                        <td className="py-2 font-mono font-bold text-[#1E4648]">#LDY-260822-0001</td>
                        <td className="py-2">Bpk. Hendar (0812-3456-7890)</td>
                        <td className="py-2 text-right font-black text-slate-900">Rp 75.000</td>
                        <td className="py-2 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            Lunas
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 font-mono font-bold text-[#1E4648]">#LDY-260822-0002</td>
                        <td className="py-2">Ibu Sarah (0857-1234-5678)</td>
                        <td className="py-2 text-right font-black text-slate-900">Rp 120.000</td>
                        <td className="py-2 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                            Proses Cuci
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
          <button
            onClick={resetSettings}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer tactile-btn"
            title="Kembalikan ke ukuran standar (100% & Plus Jakarta Sans)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Kembalikan ke Standar</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#1E4648] to-[#115e59] hover:from-[#163536] hover:to-[#0f4e4a] text-white shadow-md shadow-teal-900/15 transition cursor-pointer tactile-btn"
            >
              Simpan & Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
