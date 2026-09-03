import { LoyaltyProgram, LoyaltyClaimRule } from './types';
import { runBackend } from './api';

export const DEFAULT_LOYALTY_PROGRAMS: LoyaltyProgram[] = [
  {
    id: 'CARD_7KG_LEGACY',
    nama: 'Kartu 7 KG Member Lama (Free ke-10)',
    deskripsi: 'Khusus member lama: Klaim gratis langsung didapat pada stempel ke-10.',
    kapasitas: '7kg',
    syaratLayanan: 'washer_dryer',
    totalStamps: 10,
    claimRule: 'FREE_ON_NTH',
    rewardDeskripsi: '1x Cuci Gratis 7 KG',
    rewardType: 'FREE_SERVICE',
    rewardValue: 100,
    warnaTema: 'teal',
    isActive: true,
    isDefault: false,
    urutan: 1,
  },
  {
    id: 'CARD_7KG_NEW',
    nama: 'Kartu 7 KG Reguler Baru (10 Stamp, ke-11 Free)',
    deskripsi: 'Aturan standar baru: Kumpulkan 10 stempel penuh dulu, baru transaksi ke-11 gratis.',
    kapasitas: '7kg',
    syaratLayanan: 'washer_dryer',
    totalStamps: 10,
    claimRule: 'FREE_ON_NEXT_TRX',
    rewardDeskripsi: '1x Cuci Gratis 7 KG',
    rewardType: 'FREE_SERVICE',
    rewardValue: 100,
    warnaTema: 'emerald',
    isActive: true,
    isDefault: true,
    urutan: 2,
  },
  {
    id: 'CARD_4KG_STANDARD',
    nama: 'Kartu 4 KG Standar (10 Stamp, ke-11 Free)',
    deskripsi: 'Program loyalty kartu sisi belakang untuk kapasitas mesin 4 KG.',
    kapasitas: '4kg',
    syaratLayanan: 'washer_dryer',
    totalStamps: 10,
    claimRule: 'FREE_ON_NEXT_TRX',
    rewardDeskripsi: '1x Cuci Gratis 4 KG',
    rewardType: 'FREE_SERVICE',
    rewardValue: 100,
    warnaTema: 'gold',
    isActive: true,
    isDefault: true,
    urutan: 3,
  },
];

const LOCAL_STORAGE_KEY = 'duasisi_loyalty_programs';

export function getLoyaltyProgramsLocal(): LoyaltyProgram[] {
  if (typeof window === 'undefined') return DEFAULT_LOYALTY_PROGRAMS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed reading loyalty programs from localStorage:', e);
  }
  return DEFAULT_LOYALTY_PROGRAMS;
}

export function saveLoyaltyProgramsLocal(programs: LoyaltyProgram[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(programs));
  } catch (e) {
    console.error('Failed saving loyalty programs to localStorage:', e);
  }
}

export async function fetchLoyaltyPrograms(): Promise<LoyaltyProgram[]> {
  try {
    const remote = await runBackend<LoyaltyProgram[]>('getLoyaltyPrograms');
    if (Array.isArray(remote) && remote.length > 0) {
      saveLoyaltyProgramsLocal(remote);
      return remote;
    }
  } catch (err) {
    // Fallback to local
  }
  return getLoyaltyProgramsLocal();
}

/**
 * Mendapatkan program loyalty spesifik yang di-assign untuk pelanggan tertentu.
 * Jika pelanggan belum punya assignment, otomatis menggunakan default untuk kapasitas tersebut.
 */
export function resolveCustomerProgram(
  customer: any | null | undefined,
  cardType: '75' | '45',
  programs: LoyaltyProgram[] = getLoyaltyProgramsLocal()
): LoyaltyProgram {
  const activeList = programs.filter(p => p.isActive);
  const targetKapasitas = cardType === '45' ? '4kg' : '7kg';

  // 1. Cek assignment spesifik di data pelanggan
  const assignedId = cardType === '45' 
    ? (customer?.assignedCard4kgId || customer?.assigned_card_4kg_id)
    : (customer?.assignedCard7kgId || customer?.assigned_card_7kg_id);

  if (assignedId) {
    const matched = activeList.find(p => p.id === assignedId);
    if (matched) return matched;
  }

  // 2. Jika tidak ada, cari kartu default untuk kapasitas tersebut
  const defaultCard = activeList.find(p => p.kapasitas === targetKapasitas && p.isDefault)
    || activeList.find(p => p.kapasitas === targetKapasitas)
    || activeList.find(p => p.isDefault)
    || DEFAULT_LOYALTY_PROGRAMS[cardType === '45' ? 2 : 1];

  return defaultCard;
}
