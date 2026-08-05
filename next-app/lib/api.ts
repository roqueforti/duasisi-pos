/**
 * api.ts — single entry point untuk semua data operations
 * GAS (Google Apps Script) sudah dihapus, semua via Supabase (db.ts)
 */
export * from './db';
export { cachedFetch } from './cache';

import * as db from './db';
import { cachedFetch, writeCache, readCache, isCacheStale } from './cache';

/**
 * runBackendCached — backward-compat wrapper untuk komponen yang belum dimigrate.
 * Action string di-map ke fungsi db.ts yang sesuai.
 */
export function runBackendCached<T = any>(
  action: string,
  onData: (data: T, fromCache: boolean) => void,
  ttlMs = 5 * 60 * 1000,
  ...args: any[]
): void {
  cachedFetch<T>(
    action,
    () => dispatchAction<T>(action, args),
    onData,
    ttlMs,
  );
}

/**
 * runBackend — backward-compat async wrapper.
 */
export async function runBackend<T = any>(action: string, ...args: any[]): Promise<T> {
  return dispatchAction<T>(action, args);
}

// Dispatcher: action string → db.ts function
async function dispatchAction<T>(action: string, args: any[]): Promise<T> {
  const fn: Record<string, (...a: any[]) => Promise<any>> = {
    verifikasiPin:          db.verifikasiPin,
    getLayananListAll:      db.getLayananListAll,
    tambahLayanan:          db.tambahLayanan,
    updateLayanan:          db.updateLayanan,
    toggleAktifLayanan:     db.toggleAktifLayanan,
    hapusLayanan:           db.hapusLayanan,
    getPromoList:           db.getPromoList,
    tambahPromo:            db.tambahPromo,
    hapusPromo:             db.hapusPromo,
    validasiVoucher:        db.validasiVoucher,
    getDaftarPelanggan:     db.getDaftarPelanggan,
    simpanPelangganJikaBaru: db.simpanPelangganJikaBaru,
    updateDataPelanggan:    db.updateDataPelanggan,
    getRiwayatPelangganByHp: db.getRiwayatPelangganByHp,
    simpanTransaksi:        db.simpanTransaksi,
    getTransaksiList:       db.getTransaksiList,
    getTransaksiByNota:     db.getTransaksiByNota,
    updateStatus:           db.updateStatus,
    ajukanVoidTransaksi:    db.ajukanVoidTransaksi,
    approveVoidTransaksi:   db.approveVoidTransaksi,
    pelunasanDP:            db.pelunasanDP,
    getInventoryList:       db.getInventoryList,
    tambahInventory:        db.tambahInventory,
    updateStokInventory:    db.updateStokInventory,
    hapusInventory:         db.hapusInventory,
    getMesinList:           db.getMesinList,
    tambahMesin:            db.tambahMesin,
    mulaiPakaiMesin:        db.mulaiPakaiMesin,
    selesaiMesin:           db.selesaiMesin,
    setMaintenanceMesin:    db.setMaintenanceMesin,
    hapusMesin:             db.hapusMesin,
    getPegawaiList:         db.getPegawaiList,
    tambahPegawai:          db.tambahPegawai,
    hapusPegawai:           db.hapusPegawai,
    getRekapKinerjaPegawai: db.getRekapKinerjaPegawai,
    getRekapAbsensi:        db.getRekapAbsensi,
    getMasterShift:         db.getMasterShift,
    clockInPegawai:         db.clockInPegawai,
    clockOutPegawai:        db.clockOutPegawai,
    getLaporanRange:        db.getLaporanRange,
    getLaporanKeuangan:     (period: string) => {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - (period === '30d' ? 30 : 7) * 86400000).toISOString().split('T')[0];
      return db.getLaporanRange(start, end);
    },
    getAuditLogs:           db.getAuditLogs,
    // Legacy GAS actions yang tidak lagi relevan — return empty
    resetAndSeed6Bulan:     async () => ({ success: false, message: 'Tidak tersedia di Supabase mode' }),
    addAuditLog:            async () => ({ success: true }),
  };

  const handler = fn[action];
  if (!handler) throw new Error(`Action '${action}' tidak ditemukan`);
  return handler(...args) as Promise<T>;
}
