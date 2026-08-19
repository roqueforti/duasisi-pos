import {
  Zap,
  Shirt,
  Sparkles,
  Coffee,
  Package,
  Tag,
  ShoppingBag,
  Utensils,
  Flame,
  WashingMachine,
  Folder,
  Star,
  Layers,
  LucideIcon
} from 'lucide-react';
import { LayananItem } from './types';

export interface KategoriItem {
  id: string;
  nama: string;
  aktif: string;
  warna?: string;
  icon?: string;
}

export const PALETTE = [
  { label: 'Teal POS', value: 'bg-teal-100 text-teal-800 border-teal-300', dot: 'bg-[#1E4648]', iconBg: 'bg-[#1E4648] text-white' },
  { label: 'Emerald Hijau', value: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500', iconBg: 'bg-emerald-600 text-white' },
  { label: 'Amber Oranye', value: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-[#FF9500]', iconBg: 'bg-amber-500 text-white' },
  { label: 'Sky Biru', value: 'bg-sky-100 text-sky-800 border-sky-300', dot: 'bg-sky-500', iconBg: 'bg-sky-600 text-white' },
  { label: 'Rose Merah', value: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500', iconBg: 'bg-rose-600 text-white' },
  { label: 'Purple Ungu', value: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500', iconBg: 'bg-purple-600 text-white' },
  { label: 'Orange Cokelat', value: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-500', iconBg: 'bg-orange-600 text-white' },
  { label: 'Slate Netral', value: 'bg-slate-100 text-slate-800 border-slate-300', dot: 'bg-slate-500', iconBg: 'bg-slate-700 text-white' },
];

export const ICON_OPTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'Zap', label: 'Petir / Koin', icon: Zap },
  { id: 'Shirt', label: 'Baju / Drop Off', icon: Shirt },
  { id: 'Sparkles', label: 'Kilau / Setrika', icon: Sparkles },
  { id: 'Coffee', label: 'Kopi / Minuman', icon: Coffee },
  { id: 'Package', label: 'Paket / Deterjen', icon: Package },
  { id: 'Tag', label: 'Tag / Label', icon: Tag },
  { id: 'ShoppingBag', label: 'Tas / Plastik', icon: ShoppingBag },
  { id: 'Utensils', label: 'Makanan / Snack', icon: Utensils },
  { id: 'Flame', label: 'Kilat / Fast', icon: Flame },
  { id: 'WashingMachine', label: 'Mesin Cuci', icon: WashingMachine },
  { id: 'Folder', label: 'Folder Umum', icon: Folder },
  { id: 'Star', label: 'Spesial / Bintang', icon: Star },
  { id: 'Layers', label: 'Layers / Semua', icon: Layers },
];

export const getIconComponent = (iconName?: string): LucideIcon => {
  if (!iconName) return Tag;
  const found = ICON_OPTIONS.find(i => i.id.toLowerCase() === iconName.toLowerCase());
  if (found) return found.icon;
  // Fallbacks by keyword
  const nameLower = iconName.toLowerCase();
  if (nameLower.includes('zap') || nameLower.includes('petir') || nameLower.includes('koin')) return Zap;
  if (nameLower.includes('shirt') || nameLower.includes('baju') || nameLower.includes('drop')) return Shirt;
  if (nameLower.includes('sparkle') || nameLower.includes('setrika') || nameLower.includes('add')) return Sparkles;
  if (nameLower.includes('coffee') || nameLower.includes('kopi') || nameLower.includes('minum') || nameLower.includes('makan')) return Coffee;
  if (nameLower.includes('package') || nameLower.includes('paket') || nameLower.includes('deterjen')) return Package;
  if (nameLower.includes('bag') || nameLower.includes('tas') || nameLower.includes('plastik') || nameLower.includes('kresek')) return ShoppingBag;
  if (nameLower.includes('utensil') || nameLower.includes('snack')) return Utensils;
  if (nameLower.includes('flame') || nameLower.includes('kilat') || nameLower.includes('fast') || nameLower.includes('express')) return Flame;
  if (nameLower.includes('machine') || nameLower.includes('cuci') || nameLower.includes('mesin')) return WashingMachine;
  if (nameLower.includes('star') || nameLower.includes('bintang')) return Star;
  return Tag;
};

export const getCategoryTheme = (warna?: string) => {
  const w = (warna || '').toLowerCase();
  if (w.includes('teal')) {
    return {
      badge: 'bg-teal-100 text-teal-800 border-teal-300',
      iconBg: 'bg-[#1E4648] text-white',
      iconColor: 'text-white',
      dot: 'bg-[#1E4648]'
    };
  }
  if (w.includes('sky') || w.includes('blue')) {
    return {
      badge: 'bg-sky-100 text-sky-800 border-sky-300',
      iconBg: 'bg-sky-600 text-white',
      iconColor: 'text-white',
      dot: 'bg-sky-500'
    };
  }
  if (w.includes('amber') || w.includes('yellow')) {
    return {
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      iconBg: 'bg-amber-500 text-white',
      iconColor: 'text-white',
      dot: 'bg-[#FF9500]'
    };
  }
  if (w.includes('emerald') || w.includes('green')) {
    return {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      iconBg: 'bg-emerald-600 text-white',
      iconColor: 'text-white',
      dot: 'bg-emerald-500'
    };
  }
  if (w.includes('rose') || w.includes('red')) {
    return {
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      iconBg: 'bg-rose-600 text-white',
      iconColor: 'text-white',
      dot: 'bg-rose-500'
    };
  }
  if (w.includes('purple') || w.includes('violet')) {
    return {
      badge: 'bg-purple-100 text-purple-800 border-purple-300',
      iconBg: 'bg-purple-600 text-white',
      iconColor: 'text-white',
      dot: 'bg-purple-500'
    };
  }
  if (w.includes('orange')) {
    return {
      badge: 'bg-orange-100 text-orange-800 border-orange-300',
      iconBg: 'bg-orange-600 text-white',
      iconColor: 'text-white',
      dot: 'bg-orange-500'
    };
  }
  return {
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    iconBg: 'bg-slate-700 text-white',
    iconColor: 'text-white',
    dot: 'bg-slate-500'
  };
};

export const getLayananStyleConfig = (
  item: LayananItem,
  kategoriList?: Array<{ nama: string; warna?: string; icon?: string }>
) => {
  const itemKatName = (item.kategori || '').trim();
  const matchedKat = kategoriList?.find(
    k => k.nama.toLowerCase() === itemKatName.toLowerCase()
  );

  let categoryName = matchedKat?.nama || itemKatName || (item.tipe === 'FullService' ? 'Drop Off' : 'Self Service');
  let warna = matchedKat?.warna || item.kategoriWarna;
  let iconName = matchedKat?.icon || item.kategoriIcon;

  // Fallback defaults if color or icon is missing
  if (!warna || !iconName) {
    const katLower = categoryName.toLowerCase();
    const nameLower = (item.layanan || '').toLowerCase();

    if (katLower.includes('self') || katLower.includes('koin') || nameLower.includes('cuci 7') || nameLower.includes('cuci 4') || nameLower.includes('cuci kering')) {
      if (!warna) warna = 'bg-sky-100 text-sky-800 border-sky-300';
      if (!iconName) iconName = 'Zap';
    } else if (katLower.includes('drop') || katLower.includes('full') || item.tipe === 'FullService' || nameLower.includes('setrika') || nameLower.includes('lipat') || nameLower.includes('drop off')) {
      if (!warna) warna = 'bg-amber-100 text-amber-800 border-amber-300';
      if (!iconName) iconName = 'Shirt';
    } else if (katLower.includes('add') || katLower.includes('deterjen') || katLower.includes('softener') || katLower.includes('pewangi') || nameLower.includes('deterjen') || nameLower.includes('softener') || nameLower.includes('kresek') || nameLower.includes('plastik')) {
      if (!warna) warna = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      if (!iconName) iconName = 'Sparkles';
    } else if (katLower.includes('makan') || katLower.includes('minum') || katLower.includes('snack') || katLower.includes('kopi') || nameLower.includes('air') || nameLower.includes('kopi') || nameLower.includes('teh') || nameLower.includes('snack')) {
      if (!warna) warna = 'bg-rose-100 text-rose-800 border-rose-300';
      if (!iconName) iconName = 'Coffee';
    } else {
      if (!warna) warna = 'bg-slate-100 text-slate-800 border-slate-300';
      if (!iconName) iconName = 'Tag';
    }
  }

  const theme = getCategoryTheme(warna);
  const Icon = getIconComponent(iconName);

  return {
    Icon,
    categoryName,
    badgeStyle: warna || theme.badge,
    iconBg: theme.iconBg,
    iconColor: theme.iconColor,
    dot: theme.dot
  };
};
