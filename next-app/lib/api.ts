import { cachedFetch } from './cache';

const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbwhy6jhKdsCJSOrDzVO1Av1NXwK1mgJ5u-_7PsefOihNwhsSnTO1C26RfRHrvqHDyWEMA/exec';

const SESSION_KEY = 'gas_session_token';

export function setBackendSession(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, token);
  }
}

export function clearBackendSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

function getBackendSession(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(SESSION_KEY);
  }
  return null;
}

export async function runBackend<T = any>(action: string, ...args: any[]): Promise<T> {
  const sessionToken = getBackendSession();
  const payload: Record<string, any> = { action, args };
  if (sessionToken) payload.sessionToken = sessionToken;

  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  const data = await response.json() as any;

  // Surface GAS-level errors as JS errors
  if (data?.error === true) {
    throw new Error(data.message || 'GAS error');
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
