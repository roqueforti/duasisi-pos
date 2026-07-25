import { Transaksi } from './types';

// Deprecated offline cache - all operations are online real-time via REST API
export function saveLocalTxCache(tx: Transaksi) {
  // Pass-through: online system only
}

export function getLocalTxCache(): Transaksi[] {
  return [];
}

