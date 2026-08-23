'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Package, Search, X, Check, Sparkles, Ban, AlertCircle, ChevronDown, Loader2 } from 'lucide-react';
import { InventoryItem } from '@/lib/types';

interface InventorySelectDropdownProps {
  currentId?: string | null;
  productName: string;
  productSatuan?: string;
  inventoryList: InventoryItem[];
  onSelect: (newId: string) => Promise<void> | void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export default function InventorySelectDropdown({
  currentId,
  productName,
  productSatuan,
  inventoryList,
  onSelect,
  disabled = false,
  size = 'sm',
  className = ''
}: InventorySelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedItem = inventoryList.find(
    (inv) => inv.id === currentId && currentId !== 'none' && currentId !== '' && currentId !== null
  );

  // Position calculation for fixed rendering (prevents overflow clipping in table cells)
  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const popoverHeight = 320; // estimated max popover height
      
      let top = rect.bottom + 4;
      // If bottom space is tight, render above trigger
      if (rect.bottom + popoverHeight > viewportHeight && rect.top - popoverHeight > 0) {
        top = rect.top - popoverHeight - 4;
      }

      setDropdownPosition({
        top: Math.max(8, top),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
        width: Math.max(260, rect.width)
      });
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isSaving) return;
    updatePosition();
    setIsOpen(prev => !prev);
    setSearch('');
  };

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Click outside and scroll/resize handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const handleSelectOption = async (idVal: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsOpen(false);
    setIsSaving(true);
    try {
      await onSelect(idVal);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter list
  const filteredList = inventoryList.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      (inv.nama || '').toLowerCase().includes(q) ||
      (inv.satuan || '').toLowerCase().includes(q) ||
      (inv.id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} onClick={(e) => e.stopPropagation()}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || isSaving}
        onClick={handleOpen}
        className={`group flex items-center justify-between gap-1.5 rounded-lg border transition text-left cursor-pointer select-none font-semibold ${
          size === 'sm' ? 'px-2 py-1 text-[11px] min-w-[145px] max-w-[190px]' : 'px-3 py-2 text-xs w-full'
        } ${
          isSaving
            ? 'bg-slate-100 border-slate-300 text-slate-400 opacity-80 cursor-wait'
            : selectedItem
            ? 'bg-teal-50/90 hover:bg-teal-100/90 border-teal-300/90 text-[#1E4648] shadow-2xs'
            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700'
        }`}
        title={
          selectedItem
            ? `Terpaut ke: ${selectedItem.nama} (Stok: ${selectedItem.stok} ${selectedItem.satuan})`
            : 'Klik untuk memilih item stok atau buat baru otomatis'
        }
      >
        <div className="flex items-center gap-1.5 truncate flex-1">
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E4648] shrink-0" />
          ) : selectedItem ? (
            <Package className="w-3.5 h-3.5 text-teal-700 shrink-0" />
          ) : (
            <Ban className="w-3 h-3 text-slate-400 shrink-0" />
          )}

          <div className="truncate flex items-center gap-1">
            <span className="truncate">{selectedItem ? selectedItem.nama : 'Tanpa Stok'}</span>
            {selectedItem && (
              <span
                className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold shrink-0 ${
                  selectedItem.stok <= 0
                    ? 'bg-rose-100 text-rose-800'
                    : selectedItem.stok <= (selectedItem.stokMinimum || 0)
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-teal-100 text-teal-800'
                }`}
              >
                {selectedItem.stok} {selectedItem.satuan || ''}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-[#1E4648]' : ''
          }`}
        />
      </button>

      {/* Floating Searchable Popover Menu */}
      {isOpen && dropdownPosition && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 9999
          }}
          className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[340px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/90 flex items-center gap-1.5 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari barang / stok..."
              className="w-full text-xs bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 font-medium"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="p-1.5 border-b border-slate-100 bg-white space-y-1 shrink-0">
            {/* Auto Create & Link Button */}
            <button
              type="button"
              onClick={(e) => handleSelectOption('auto', e)}
              className="w-full text-left p-2 rounded-lg text-xs font-bold transition flex items-center justify-between gap-2 text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">
                  + Buat <strong className="text-teal-950">"{productName}"</strong> di Stok
                </span>
              </div>
              <span className="text-[9px] bg-teal-200/70 text-teal-900 px-1.5 py-0.5 rounded font-bold shrink-0">
                Otomatis
              </span>
            </button>

            {/* Unlink / No Stock Option */}
            <button
              type="button"
              onClick={(e) => handleSelectOption('none', e)}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-between gap-2 cursor-pointer ${
                !currentId || currentId === 'none'
                  ? 'bg-slate-100 text-slate-800 font-bold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Tanpa Stok (Lepas Kaitan)</span>
              </div>
              {(!currentId || currentId === 'none') && (
                <Check className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              )}
            </button>
          </div>

          {/* Item List Section */}
          <div className="overflow-y-auto flex-1 p-1 space-y-0.5 max-h-48 divide-y divide-slate-50">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pilih dari Stok Tersedia ({filteredList.length})
            </div>

            {filteredList.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 space-y-1">
                <AlertCircle className="w-4 h-4 mx-auto text-slate-300" />
                <p>Tidak ada stok yang cocok "{search}"</p>
              </div>
            ) : (
              filteredList.map((inv) => {
                const isSelected = currentId === inv.id;
                const isLow = inv.stok <= (inv.stokMinimum || 0);
                const isZero = inv.stok <= 0;

                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={(e) => handleSelectOption(inv.id, e)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 text-[#1E4648] font-bold border border-teal-200/80 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <Package
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-teal-700' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{inv.nama}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isZero
                            ? 'bg-rose-100 text-rose-800'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inv.stok} {inv.satuan || ''}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#1E4648] shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
