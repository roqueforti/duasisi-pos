'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';

export interface LocationSuggestion {
  name: string;
  street?: string;
  district?: string;
  city?: string;
  state?: string;
  fullAddress: string;
  lat?: number;
  lon?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, details?: LocationSuggestion) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  readOnly?: boolean;
  disabled?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Ketik jalan, komplek, kos, atau area...',
  label,
  required = false,
  className = '',
  readOnly = false,
  disabled = false,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setInputValue(query);
    onChange(query);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!query || query.trim().length < 3 || readOnly || disabled) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Photon API (OpenStreetMap Nominatim index, focused on Malang: -7.95, 112.63)
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=-7.95&lon=112.63&limit=5&lang=id`
        );
        const data = await res.json();

        if (data && data.features && Array.isArray(data.features)) {
          const list: LocationSuggestion[] = data.features.map((f: any) => {
            const props = f.properties || {};
            const name = props.name || props.street || '';
            const street = props.street || '';
            const district = props.district || props.suburb || props.locality || '';
            const city = props.city || props.county || '';
            const state = props.state || '';

            const parts = [
              name,
              street && street !== name ? street : '',
              district,
              city,
              state
            ].filter(Boolean);

            const full = parts.join(', ');

            return {
              name,
              street,
              district,
              city,
              state,
              fullAddress: full || query,
              lat: f.geometry?.coordinates?.[1],
              lon: f.geometry?.coordinates?.[0],
            };
          });

          setSuggestions(list);
          setShowDropdown(list.length > 0);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleSelect = (item: LocationSuggestion) => {
    setInputValue(item.fullAddress);
    onChange(item.fullAddress, item);
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-600 mb-0.5 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#1E4648]" />
            <span>{label} {required && <span className="text-rose-500">*</span>}</span>
          </span>
          <span className="text-[9px] text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.2 rounded">Maps OpenStreetMap</span>
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0 && !readOnly && !disabled) setShowDropdown(true);
          }}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          required={required}
          className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648] focus:bg-white transition"
        />
        <div className="absolute left-2.5 text-slate-400 pointer-events-none">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E4648]" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </div>

        {inputValue && !readOnly && !disabled && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              onChange('');
              setSuggestions([]);
              setShowDropdown(false);
            }}
            className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Suggestion Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
          <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 flex items-center justify-between">
            <span>Saran Lokasi dari OpenStreetMap</span>
            <span className="text-teal-700">Pilih untuk auto-fill</span>
          </div>
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full px-3 py-2 text-left hover:bg-teal-50/80 transition flex items-start gap-2.5 group cursor-pointer text-xs"
            >
              <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 truncate">{item.name}</div>
                <div className="text-[10px] text-slate-500 truncate leading-tight">
                  {[item.district, item.city, item.state].filter(Boolean).join(', ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
