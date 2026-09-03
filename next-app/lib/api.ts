import { cachedFetch } from './cache';
import { UserRole } from './types';

const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbwhy6jhKdsCJSOrDzVO1Av1NXwK1mgJ5u-_7PsefOihNwhsSnTO1C26RfRHrvqHDyWEMA/exec';

const SESSION_KEY = 'gas_session_token';
const ACTIVITY_KEY = 'gas_session_last_activity';
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 Menit Tidak Ada Interaksi

export interface BackendSessionPayload {
  role: UserRole;
  label?: string;
  exp: number;
}

export function touchSessionActivity(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  }
}

export function getLastActivityTime(): number {
  if (typeof window !== 'undefined') {
    const val = localStorage.getItem(ACTIVITY_KEY);
    if (val) {
      const num = Number(val);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return Date.now();
}

export function setBackendSession(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, token);
    touchSessionActivity();
  }
}

export function clearBackendSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
  }
}

export function getBackendSession(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(SESSION_KEY);
  }
  return null;
}

export function parseSessionToken(token?: string | null): BackendSessionPayload | null {
  const t = token ?? getBackendSession();
  if (!t) return null;
  try {
    const parts = t.split('.');
    if (parts.length !== 2) return null;
    let b64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(atob(b64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const data = JSON.parse(jsonStr);
    if (!data.exp || !data.role) return null;
    return data as BackendSessionPayload;
  } catch {
    return null;
  }
}

export function isSessionIdleExpired(): boolean {
  const token = getBackendSession();
  if (!token) return true;
  const lastAct = getLastActivityTime();
  return Date.now() - lastAct > SESSION_IDLE_TIMEOUT_MS;
}

export function isSessionValid(): boolean {
  const payload = parseSessionToken();
  if (!payload) return false;
  return !isSessionIdleExpired();
}

type SessionExpiredListener = (message: string) => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

export function notifySessionExpired(message = 'Sesi Anda telah kedaluwarsa karena tidak ada aktivitas selama 30 menit. Silakan login kembali.'): void {
  clearBackendSession();
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener(message);
    } catch (e) {
      console.error('Error in session expired listener:', e);
    }
  });
}

import { isSupabaseConfigured } from './supabaseClient';
import * as sb from './supabaseService';

export async function runBackend<T = any>(action: string, ...args: any[]): Promise<T> {
  // Jika Supabase terkonfigurasi, prioritaskan eksekusi via Supabase PostgreSQL
  if (isSupabaseConfigured()) {
    try {
      switch (action) {
        case 'getInventoryList':
          return (await sb.sbGetInventoryList()) as any;
        case 'updateStokInventory':
          return (await sb.sbUpdateStokInventory(args[0], args[1])) as any;
        case 'tambahInventory':
          return (await sb.sbTambahInventory(args[0])) as any;
        case 'updateInventoryItem':
          return (await sb.sbUpdateInventoryItem(args[0], args[1])) as any;
        case 'hapusInventory':
          return (await sb.sbHapusInventory(args[0])) as any;
        case 'getLayananListAll':
        case 'getLayananList':
          return (await sb.sbGetLayananListAll()) as any;
        case 'tambahLayanan':
          return (await sb.sbTambahLayanan(args[0])) as any;
        case 'updateLayanan':
          return (await sb.sbUpdateLayanan(args[0], args[1])) as any;
        case 'hapusLayanan':
          return (await sb.sbHapusLayanan(args[0])) as any;
        case 'getDaftarPelanggan':
          return (await sb.sbGetDaftarPelanggan()) as any;
        case 'simpanPelangganJikaBaru':
          return (await sb.sbSimpanPelangganJikaBaru(args[0], args[1], args[2])) as any;
        case 'simpanTransaksi':
          return (await sb.sbSimpanTransaksi(args[0])) as any;
        case 'getTransaksiList':
        case 'getTransaksiListAll':
          return (await sb.sbGetTransaksiList(args[0])) as any;
        case 'updateDropoffStatus':
          return (await sb.sbUpdateDropoffStatus(args[0], args[1], args[2])) as any;
        case 'getMesinList':
          return (await sb.sbGetMesinList()) as any;
        case 'getKasShiftAktif':
          return (await sb.sbGetKasShiftAktif(args[0])) as any;
        case 'openKasShift':
          return (await sb.sbOpenKasShift(args[0])) as any;
        case 'closeKasShift':
          return (await sb.sbCloseKasShift(args[0])) as any;
        case 'getPromoList':
          return (await sb.sbGetPromoList()) as any;
        case 'getKategoriList':
          return (await sb.sbGetKategoriList()) as any;
        case 'getLoyaltyPrograms':
          return (await sb.sbGetLoyaltyPrograms()) as any;
        case 'saveLoyaltyProgram':
          return (await sb.sbSaveLoyaltyProgram(args[0])) as any;
        case 'deleteLoyaltyProgram':
          return (await sb.sbDeleteLoyaltyProgram(args[0])) as any;
        case 'assignCustomerLoyalty':
          return (await sb.sbAssignCustomerLoyalty(args[0], args[1], args[2])) as any;
      }
    } catch (sbErr: any) {
      console.warn(`[Supabase Error] Action '${action}' gagal, fallback ke Google Apps Script:`, sbErr);
    }
  }
  const isPublicAction =
    action === 'verifikasiPin' ||
    action === 'recoverPin' ||
    action === 'getTransaksiByNota' ||
    action === 'cekPoinPelanggan' ||
    action === 'logClientActivity';
  const sessionToken = isPublicAction ? null : getBackendSession();

  // Untuk action yang membutuhkan autentikasi: periksa apakah inaktif selama 30 menit
  if (!isPublicAction && sessionToken) {
    if (isSessionIdleExpired()) {
      notifySessionExpired('Sesi Anda telah kedaluwarsa karena tidak ada aktivitas selama 30 menit. Silakan masukkan PIN kembali.');
      throw new Error('Sesi kedaluwarsa karena tidak ada aktivitas.');
    }
    // Refresh user activity timestamp on API call
    touchSessionActivity();
  }

  const payload: Record<string, any> = { action, args };
  if (!isPublicAction && sessionToken) payload.sessionToken = sessionToken;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let response: Response;
  try {
    response = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Koneksi ke server timeout (lebih dari 25 detik). Silakan periksa jaringan internet.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  const data = await response.json() as any;

  // Surface GAS-level errors as JS errors
  if (data?.error === true) {
    const errMsg = String(data.message || 'GAS error');
    const lowerMsg = errMsg.toLowerCase();
    if (
      lowerMsg.includes('kedaluwarsa') ||
      lowerMsg.includes('sesi tidak valid') ||
      lowerMsg.includes('session expired') ||
      (lowerMsg.includes('akses ditolak') && lowerMsg.includes('sesi'))
    ) {
      notifySessionExpired('Sesi Anda telah berakhir atau kedaluwarsa. Silakan masukkan PIN kembali.');
    }
    throw new Error(errMsg);
  }

  return data as T;
}

export function runBackendCached<T = any>(
  action: string,
  onData: (data: T, fromCache: boolean) => void,
  ttlMs = 5 * 60 * 1000,
  ...args: any[]
): void {
  cachedFetch<T>(
    action,
    () => runBackend<T>(action, ...args),
    onData,
    ttlMs,
  );
}

