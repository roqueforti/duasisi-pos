import { cachedFetch } from './cache';

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwhy6jhKdsCJSOrDzVO1Av1NXwK1mgJ5u-_7PsefOihNwhsSnTO1C26RfRHrvqHDyWEMA/exec';

export async function runBackend<T = any>(action: string, ...args: any[]): Promise<T> {
  const payload = { action, args };

  try {
    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);

    const data = await response.json();
    return data as T;
  } catch (err: any) {
    console.error(`[API Error] ${action}:`, err);
    throw err;
  }
}

/**
 * Stale-while-revalidate wrapper untuk GET-style calls.
 * Langsung render dari cache, fetch fresh data di background.
 *
 * @param action   - nama action GAS (juga dipakai sebagai cache key)
 * @param onData   - callback dipanggil dua kali: pertama dari cache (instant), lalu dari network
 * @param ttlMs    - berapa lama cache dianggap fresh (default 5 menit)
 * @param args     - argumen tambahan ke GAS action
 */
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
    ttlMs
  );
}
