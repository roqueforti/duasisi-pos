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

export async function runBackend<T = any>(action: string, ...args: any[]): Promise<T> {
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

