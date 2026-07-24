import { runBackend } from './api';
import { Transaksi } from './types';

const PENDING_QUEUE_KEY = 'duasisi_pos_pending_outbox';
const LOCAL_TRANSAKSI_KEY = 'duasisi_pos_local_tx_cache';

export interface PendingPayload {
  id: string;
  timestamp: string;
  payload: any;
}

// Get pending offline queue
export function getPendingOutbox(): PendingPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

// Add transaction payload to pending outbox
export function addToPendingOutbox(payload: any): PendingPayload {
  const queue = getPendingOutbox();
  const newItem: PendingPayload = {
    id: 'OFF-' + Date.now(),
    timestamp: new Date().toISOString(),
    payload
  };
  queue.push(newItem);
  if (typeof window !== 'undefined') {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  }
  return newItem;
}

// Save transaction locally to history cache
export function saveLocalTxCache(tx: Transaksi) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_TRANSAKSI_KEY);
    const list: Transaksi[] = raw ? JSON.parse(raw) : [];
    list.unshift(tx);
    localStorage.setItem(LOCAL_TRANSAKSI_KEY, JSON.stringify(list));
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

// Sync all pending outbox items to Google Apps Script backend
export async function syncOutboxToServer(): Promise<{ syncedCount: number; errors: number }> {
  const queue = getPendingOutbox();
  if (queue.length === 0) return { syncedCount: 0, errors: 0 };

  let syncedCount = 0;
  let errors = 0;
  const remainingQueue: PendingPayload[] = [];

  for (const item of queue) {
    try {
      const res = await runBackend('simpanTransaksi', item.payload);
      if (res && res.success) {
        syncedCount++;
      } else {
        remainingQueue.push(item);
        errors++;
      }
    } catch (err) {
      remainingQueue.push(item);
      errors++;
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remainingQueue));
  }

  return { syncedCount, errors };
}
