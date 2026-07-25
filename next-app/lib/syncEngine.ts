import { Transaksi } from './types';

const LOCAL_TRANSAKSI_KEY = 'duasisi_pos_local_tx_cache';

// Clear old legacy outbox queue from localStorage if present
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('duasisi_pos_pending_outbox');
  } catch (e) {}
}

// Save transaction locally to history cache
export function saveLocalTxCache(tx: Transaksi) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_TRANSAKSI_KEY);
    const list: Transaksi[] = raw ? JSON.parse(raw) : [];
    // Deduplicate by noNota
    const filtered = list.filter(t => t.noNota !== tx.noNota);
    filtered.unshift(tx);
    localStorage.setItem(LOCAL_TRANSAKSI_KEY, JSON.stringify(filtered.slice(0, 100)));
  } catch (err) {}
}

// Get cached local transactions
export function getLocalTxCache(): Transaksi[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_TRANSAKSI_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}
