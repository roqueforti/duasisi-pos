import { cachedFetch } from './cache';

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwhy6jhKdsCJSOrDzVO1Av1NXwK1mgJ5u-_7PsefOihNwhsSnTO1C26RfRHrvqHDyWEMA/exec';

export async function runBackend<T = any>(action: string, ...args: any[]): Promise<T> {
  const payload = { action, args };
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  return response.json() as Promise<T>;
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

// Session stubs — PIN-based auth tidak butuh server session
export function setBackendSession(_token: string): void {}
export function clearBackendSession(): void {}
