/** API facade untuk frontend. Database utama adalah Google Spreadsheet melalui Apps Script. */
import { cachedFetch } from './cache';
import { gasAction } from './db';
export { clearBackendSession, setBackendSession } from './db';

export { cachedFetch, gasAction };

export function runBackendCached<T = any>(action: string, onData: (data: T, fromCache: boolean) => void, ttlMs = 5 * 60 * 1000, ...args: any[]) {
  cachedFetch<T>(action + JSON.stringify(args), () => gasAction<T>(action, ...args), onData, ttlMs);
}

export async function runBackend<T = any>(action: string, ...args: any[]): Promise<T> {
  return gasAction<T>(action, ...args);
}
