'use client';

import React, { useState, useEffect } from 'react';

export const COMMON_SATUAN_OPTIONS = [
  { value: 'liter', label: 'Liter (liter)' },
  { value: 'pcs', label: 'Pcs / Buah (pcs)' },
  { value: 'botol', label: 'Botol (botol)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'gram', label: 'Gram (gram)' },
  { value: 'ml', label: 'Mililiter (ml)' },
  { value: 'box', label: 'Box / Dus (box)' },
  { value: 'galon', label: 'Galon (galon)' },
  { value: 'jerigen', label: 'Jerigen (jerigen)' },
  { value: 'sachet', label: 'Sachet (sachet)' },
  { value: 'roll', label: 'Roll / Gulungan (roll)' },
  { value: 'lembar', label: 'Lembar (lembar)' },
  { value: 'paket', label: 'Paket (paket)' },
  { value: 'porsi', label: 'Porsi (porsi)' },
  { value: 'cangkir', label: 'Cangkir (cangkir)' },
];

interface SatuanInputProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  label?: string;
  helperText?: string;
  required?: boolean;
}

export default function SatuanInput({
  value,
  onChange,
  className = '',
  label = 'Satuan',
  helperText = 'Pilih satuan umum dari dropdown atau pilih Lainnya untuk ketik bebas.',
  required = false,
}: SatuanInputProps) {
  const isPreset = COMMON_SATUAN_OPTIONS.some(
    (opt) => opt.value.toLowerCase() === (value || '').trim().toLowerCase()
  );
  const [isCustom, setIsCustom] = useState(!isPreset && Boolean(value && value.trim()));

  useEffect(() => {
    const isValPreset = COMMON_SATUAN_OPTIONS.some(
      (opt) => opt.value.toLowerCase() === (value || '').trim().toLowerCase()
    );
    if (!isValPreset && value && value.trim()) {
      setIsCustom(true);
    } else if (isValPreset) {
      setIsCustom(false);
    }
  }, [value]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__CUSTOM__') {
      setIsCustom(true);
      if (isPreset) onChange('');
    } else {
      setIsCustom(false);
      onChange(selected);
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="space-y-1.5">
        <select
          value={isCustom ? '__CUSTOM__' : (value || 'pcs')}
          onChange={handleSelectChange}
          className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white text-slate-700 font-medium"
        >
          <optgroup label="Pilihan Satuan Populer">
            {COMMON_SATUAN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
          <option value="__CUSTOM__">✍️ Lainnya (Ketik Bebas / Kustom)...</option>
        </select>

        {isCustom && (
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Ketik satuan bebas (misal: lusin, meter, jerigen)..."
              autoFocus
              className="w-full px-3 py-2 border border-[#1E4648] bg-slate-50 rounded-md text-xs outline-none focus:ring-1 focus:ring-[#1E4648] text-slate-800 font-medium"
            />
          </div>
        )}
      </div>

      {helperText && <p className="text-[10px] text-slate-400 mt-1">{helperText}</p>}
    </div>
  );
}
