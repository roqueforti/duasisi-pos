'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface DisplaySettings {
  zoomScale: number; // 70 to 160 (percent, e.g. 100)
  fontFamily: string; // e.g. 'Plus Jakarta Sans', 'Inter', etc.
  fontBaseSize: number; // 12 to 18 (px, default 14)
  fontWeightMode: 'normal' | 'medium' | 'semibold';
  density: 'compact' | 'normal' | 'comfortable';
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  zoomScale: 100,
  fontFamily: 'Plus Jakarta Sans',
  fontBaseSize: 14,
  fontWeightMode: 'normal',
  density: 'normal',
};

export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: string;
  description: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'plus-jakarta',
    name: 'Plus Jakarta Sans',
    family: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Modern',
    description: 'Bawaan resmi — Bersih, modern, dan sangat nyaman dibaca'
  },
  {
    id: 'inter',
    name: 'Inter',
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Clean UI',
    description: 'Standar aplikasi global — Sangat tajam dan presisi'
  },
  {
    id: 'outfit',
    name: 'Outfit',
    family: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Geometric',
    description: 'Geometris premium — Elegan dan berkarakter'
  },
  {
    id: 'poppins',
    name: 'Poppins',
    family: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Friendly',
    description: 'Tegas dan ramah — Tulisan tebal dan jelas dari kejauhan'
  },
  {
    id: 'roboto',
    name: 'Roboto',
    family: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Material',
    description: 'Google Material standard — Netral dan proporsional'
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    family: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Modern',
    description: 'Modern minimalis — Kontras seimbang dan estetik'
  },
  {
    id: 'nunito',
    name: 'Nunito',
    family: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Rounded',
    description: 'Rounded lembut — Sentuhan kasual dan bersahabat'
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    family: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Tech',
    description: 'Tech & futuristic — Nuansa modern yang unik'
  },
  {
    id: 'quicksand',
    name: 'Quicksand',
    family: "'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Rounded',
    description: 'Rounded modern — Nyaman dipandang pada display kasir'
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    family: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Architectural',
    description: 'Tegas dan berbobot — Sangat cocok untuk judul & angka nota'
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    family: "'JetBrains Mono', monospace",
    category: 'Monospace',
    description: 'Monospace data — Angka sejajar rapi seperti struk kasir'
  },
  {
    id: 'system',
    name: 'System Default',
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    category: 'Native',
    description: 'Font bawaan OS — Ringan dan cepat tanpa unduhan font'
  }
];

export const ZOOM_PRESETS = [
  { value: 70, label: '70%', tag: 'Ultra Compact', group: 'Layar Kecil / Multi-Window' },
  { value: 75, label: '75%', tag: 'Ekstra Kecil', group: 'Layar Kecil / Multi-Window' },
  { value: 80, label: '80%', tag: 'Sangat Ringkas', group: 'Layar Kecil / Multi-Window' },
  { value: 85, label: '85%', tag: 'Ringkas Desktop', group: 'Laptop & Desktop Standar' },
  { value: 90, label: '90%', tag: 'Sedikit Ringkas', group: 'Laptop & Desktop Standar' },
  { value: 95, label: '95%', tag: 'Hampir Standar', group: 'Laptop & Desktop Standar' },
  { value: 100, label: '100%', tag: 'Standar Bawaan ⭐', group: 'Laptop & Desktop Standar' },
  { value: 105, label: '105%', tag: 'Sedikit Lebih Luas', group: 'Monitor Besar & Tablet' },
  { value: 110, label: '110%', tag: 'Nyaman (Comfort)', group: 'Monitor Besar & Tablet' },
  { value: 115, label: '115%', tag: 'Laptop 13-14"', group: 'Monitor Besar & Tablet' },
  { value: 120, label: '120%', tag: 'Touchscreen 15"', group: 'Monitor Besar & Tablet' },
  { value: 125, label: '125%', tag: 'Touch POS Kasir ⭐', group: 'Touch POS Kasir & Kiosk' },
  { value: 130, label: '130%', tag: 'Lega / Tablet Stand', group: 'Touch POS Kasir & Kiosk' },
  { value: 140, label: '140%', tag: 'Ekstra Besar', group: 'Touch POS Kasir & Kiosk' },
  { value: 150, label: '150%', tag: 'Jumbo Display', group: 'Touch POS Kasir & Kiosk' },
  { value: 160, label: '160%', tag: 'Maksimum POS', group: 'Touch POS Kasir & Kiosk' },
];

interface DisplaySettingsContextType {
  settings: DisplaySettings;
  updateSettings: (newSettings: Partial<DisplaySettings>) => void;
  resetSettings: () => void;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

const DisplaySettingsContext = createContext<DisplaySettingsContextType | null>(null);

const STORAGE_KEY = 'duasisi_display_settings';

export function applyDisplaySettingsToDOM(settings: DisplaySettings) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;

  // 1. Apply zoom scale (support CSS zoom and custom variable)
  const zoomFactor = settings.zoomScale / 100;
  if (body) {
    (body.style as any).zoom = zoomFactor.toString();
  }
  root.style.setProperty('--ui-scale', zoomFactor.toString());
  root.style.setProperty('--ui-scale-percent', `${settings.zoomScale}%`);

  // 2. Apply Font Family
  const matchedFont = FONT_OPTIONS.find(f => f.name === settings.fontFamily || f.id === settings.fontFamily);
  const fontFamilyValue = matchedFont ? matchedFont.family : settings.fontFamily;
  root.style.setProperty('--font-sans', fontFamilyValue);
  if (body) {
    body.style.fontFamily = fontFamilyValue;
  }

  // 3. Apply Base Font Size
  root.style.setProperty('--ui-font-size-base', `${settings.fontBaseSize}px`);

  // 4. Apply Density Mode
  root.setAttribute('data-density', settings.density);
  if (body) {
    body.setAttribute('data-density', settings.density);
  }

  // 5. Apply Font Weight Mode
  root.setAttribute('data-font-weight', settings.fontWeightMode);
  if (body) {
    body.setAttribute('data-font-weight', settings.fontWeightMode);
  }
}

export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Load saved settings from localStorage on initial mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged: DisplaySettings = {
          ...DEFAULT_DISPLAY_SETTINGS,
          ...parsed,
        };
        setSettings(merged);
        applyDisplaySettingsToDOM(merged);
        return;
      }
    } catch (e) {
      console.warn('Failed to load display settings from localStorage:', e);
    }
    applyDisplaySettingsToDOM(DEFAULT_DISPLAY_SETTINGS);
  }, []);

  const updateSettings = (newSettings: Partial<DisplaySettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save display settings:', e);
      }
      applyDisplaySettingsToDOM(updated);
      return updated;
    });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_DISPLAY_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DISPLAY_SETTINGS));
    } catch (e) {}
    applyDisplaySettingsToDOM(DEFAULT_DISPLAY_SETTINGS);
  };

  const openSettingsModal = () => setIsModalOpen(true);
  const closeSettingsModal = () => setIsModalOpen(false);

  return (
    <DisplaySettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        isModalOpen,
        setIsModalOpen,
        openSettingsModal,
        closeSettingsModal
      }}
    >
      {children}
    </DisplaySettingsContext.Provider>
  );
}

export function useDisplaySettings() {
  const context = useContext(DisplaySettingsContext);
  if (!context) {
    throw new Error('useDisplaySettings must be used within a DisplaySettingsProvider');
  }
  return context;
}
