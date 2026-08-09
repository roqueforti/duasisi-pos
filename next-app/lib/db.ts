/**
 * db.ts — thin wrapper untuk API routes di app/api/
 * Semua fungsi di sini hanya proxy ke GAS via runBackend
 */
import { runBackend } from './api';

export async function gasAction<T = any>(action: string, ...args: any[]): Promise<T> {
  return runBackend<T>(action, ...args);
}

export async function gasActionWithSession<T = any>(action: string, ...args: any[]): Promise<T> {
  return runBackend<T>(action, ...args);
}

export async function approveVoidTransaksi(orderId: string, approved: boolean) {
  return runBackend('approveVoidTransaksi', orderId, approved, 'Manager / Owner');
}

export async function simpanTransaksi(payload: any) {
  return runBackend('simpanTransaksi', payload);
}

export async function openKasShift(payload: any) {
  return runBackend('bukaShift', payload);
}

export async function closeKasShift(payload: any) {
  return runBackend('tutupShift', payload);
}

export async function updateOrderStatus(id: string, status: string) {
  return runBackend('updateStatus', id, status);
}

export async function ajukanVoid(id: string, alasan: string) {
  return runBackend('ajukanVoidTransaksi', id, alasan, 'Kasir');
}
