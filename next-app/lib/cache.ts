/**
 * localStorage cache dengan stale-while-revalidate pattern.
 * - Langsung return data dari cache (instant)
 * - Fetch fresh data di background
 * - Update cache setelah fresh data datang
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 menit

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

function cacheKey(action: string): string {
  return `pos_cache_${action}`;
}

export function readCache<T>(action: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(action));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export function isCacheStale(action: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(cacheKey(action));
    if (!raw) return true;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.timestamp > entry.ttl;
  } catch {
    return true;
  }
}

export function writeCache<T>(action: string, data: T, ttl = DEFAULT_TTL_MS): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
    localStorage.setItem(cacheKey(action), JSON.stringify(entry));
  } catch {
    // localStorage mungkin penuh, ignore
  }
}

export function clearCache(action?: string): void {
  if (typeof window === 'undefined') return;
  if (action) {
    localStorage.removeItem(cacheKey(action));
  } else {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('pos_cache_'))
      .forEach((k) => localStorage.removeItem(k));
  }
}

/**
 * Stale-while-revalidate fetch.
 * 1. Kalau ada cache → langsung panggil onData(cachedData) SEKARANG (instant)
 * 2. Kalau cache stale / tidak ada → fetch dari backend
 * 3. Setelah fetch selesai → panggil onData lagi dengan data fresh + update cache
 */
export function cachedFetch<T>(
  action: string,
  fetcher: () => Promise<T>,
  onData: (data: T, fromCache: boolean) => void,
  ttl = DEFAULT_TTL_MS
): void {
  const cached = readCache<T>(action);

  if (cached !== null) {
    // Instant render dari cache
    onData(cached, true);

    if (!isCacheStale(action)) {
      // Cache masih fresh, tidak perlu fetch
      return;
    }
  }

  // Fetch di background (tidak blocking)
  fetcher()
    .then((fresh) => {
      writeCache(action, fresh, ttl);
      onData(fresh, false);
    })
    .catch((err) => {
      console.warn(`[cache] Background fetch failed for ${action}:`, err);
      // Tetap pakai cache lama kalau fetch gagal
    });
}
