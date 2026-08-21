/**
 * In-memory cache dengan stale-while-revalidate pattern.
 * - Berjalan "sewajarnya" (hanya hidup selama tab browser belum direfresh)
 * - Jika di-refresh (F5), cache langsung hilang (full online)
 * - Langsung return data dari cache memori (instant)
 * - Fetch fresh data di background jika cache sudah expired
 */

const DEFAULT_TTL_MS = 1 * 60 * 1000; // Dikurangi jadi 1 menit agar lebih real-time

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Global memory cache (hilang kalau direfresh)
const memoryCache = new Map<string, CacheEntry<any>>();

function cacheKey(action: string): string {
  return `pos_cache_${action}`;
}

export function readCache<T>(action: string): T | null {
  const key = cacheKey(action);
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!.data as T;
  }
  return null;
}

export function isCacheStale(action: string): boolean {
  const key = cacheKey(action);
  if (!memoryCache.has(key)) return true;
  
  const entry = memoryCache.get(key)!;
  return Date.now() - entry.timestamp > entry.ttl;
}

export function writeCache<T>(action: string, data: T, ttl = DEFAULT_TTL_MS): void {
  const key = cacheKey(action);
  memoryCache.set(key, { data, timestamp: Date.now(), ttl });
}

export function clearCache(action?: string): void {
  if (action) {
    memoryCache.delete(cacheKey(action));
  } else {
    memoryCache.clear();
  }
}

/**
 * Mem-fetch data dengan prioritas Cache In-Memory
 */
export function cachedFetch<T>(
  action: string,
  fetcher: () => Promise<T>,
  onData: (data: T, fromCache: boolean) => void,
  ttl = DEFAULT_TTL_MS,
  onError?: (err: any) => void
): void {
  const cached = readCache<T>(action);

  if (cached !== null) {
    // Render instan dari memori
    onData(cached, true);

    if (!isCacheStale(action)) {
      // Cache memori masih fresh (belum 1 menit), tidak perlu hit backend
      return;
    }
  }

  // Hit backend di background (non-blocking)
  fetcher()
    .then((fresh) => {
      writeCache(action, fresh, ttl);
      onData(fresh, false);
    })
    .catch((err) => {
      console.warn(`[cache] Background fetch failed for ${action}:`, err);
      if (onError) {
        onError(err);
      } else if (cached === null) {
        // Fallback aman jika data awal gagal dimuat agar spinner loading UI tidak hang selamanya
        onData([] as any, false);
      }
    });
}

