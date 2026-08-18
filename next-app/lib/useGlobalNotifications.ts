'use client';

import { useState, useEffect, useCallback } from 'react';
import { runBackendCached, runBackend } from './api';
import { UserRole } from './types';

export interface GlobalNotificationItem {
  id: string;
  category: 'inventory' | 'pesanan' | 'void' | 'cuti' | 'absensi' | 'transaksi';
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  targetTab: string;
  count?: number;
  read?: boolean;
}

export interface BadgeCounts {
  pesanan: number;
  inventory: number;
  absensi: number;
  riwayat: number;
}

const READ_STORAGE_KEY = 'duasisi_read_notifications';

export function useGlobalNotifications(currentRole: UserRole) {
  const [notifications, setNotifications] = useState<GlobalNotificationItem[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({
    pesanan: 0,
    inventory: 0,
    absensi: 0,
    riwayat: 0
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(allIds));
    } catch {}
  }, [notifications]);

  const fetchGlobalNotifications = useCallback(async () => {
    if (!currentRole) return;
    setLoading(true);
    try {
      const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const items: GlobalNotificationItem[] = [];
      const counts: BadgeCounts = { pesanan: 0, inventory: 0, absensi: 0, riwayat: 0 };

      // 1. Check Inventory Low Stock (Stok <= MinStok)
      try {
        const bahanList = await runBackend<any[]>('getBahanList');
        if (Array.isArray(bahanList)) {
          const lowStock = bahanList.filter(b => {
            const stok = Number(b.stok) || 0;
            const min = Number(b.minStok) || 0;
            return min > 0 && stok <= min;
          });

          counts.inventory = lowStock.length;
          if (lowStock.length > 0) {
            items.push({
              id: `inv-low-${lowStock.length}`,
              category: 'inventory',
              title: `⚠️ ${lowStock.length} Bahan Stok Kritis`,
              message: lowStock.slice(0, 3).map(b => `${b.namaBahan || b.nama} (Sisa ${b.stok} ${b.satuan})`).join(', ') + (lowStock.length > 3 ? '...' : ''),
              type: 'warning',
              timestamp: nowStr,
              targetTab: 'inventory',
              count: lowStock.length
            });
          }
        }
      } catch (e) {}

      // 2. Check Active Drop Off Orders
      try {
        const pesananList = await runBackend<any[]>('getPesananDropOffList');
        if (Array.isArray(pesananList)) {
          const activeOrders = pesananList.filter(p => p.status !== 'Selesai' && p.status !== 'Batal' && p.status !== 'Void');
          counts.pesanan = activeOrders.length;
          if (activeOrders.length > 0) {
            const readyToPickup = activeOrders.filter(p => p.status === 'Siap Diambil').length;
            items.push({
              id: `pesanan-active-${activeOrders.length}`,
              category: 'pesanan',
              title: `📦 ${activeOrders.length} Pesanan Drop-off Aktif`,
              message: readyToPickup > 0 
                ? `${readyToPickup} pesanan siap diambil pelanggan, ${activeOrders.length - readyToPickup} sedang dalam proses pencucian/setrika.`
                : `${activeOrders.length} pesanan sedang dikerjakan dalam pipeline antrean.`,
              type: 'info',
              timestamp: nowStr,
              targetTab: 'pesanan',
              count: activeOrders.length
            });
          }
        }
      } catch (e) {}

      // 3. Check Void Requests Pending
      try {
        const txList = await runBackend<any[]>('getTransaksiList', 'Semua');
        if (Array.isArray(txList)) {
          const pendingVoid = txList.filter(t => t.statusVoid === 'PendingApproval');
          counts.riwayat = pendingVoid.length;
          if (pendingVoid.length > 0) {
            items.push({
              id: `void-pending-${pendingVoid.length}`,
              category: 'void',
              title: `🛑 ${pendingVoid.length} Pengajuan Void Menunggu Persetujuan`,
              message: pendingVoid.slice(0, 2).map(t => `Nota ${t.noNota} (Rp ${(t.total || 0).toLocaleString('id-ID')})`).join(', '),
              type: 'error',
              timestamp: nowStr,
              targetTab: currentRole === 'MANAGER' ? 'rekap' : 'riwayat',
              count: pendingVoid.length
            });
          }
        }
      } catch (e) {}

      // 4. Check Pending Leave / Cuti (For Manager)
      if (currentRole === 'MANAGER') {
        try {
          const cutiList = await runBackend<any[]>('getCutiList');
          if (Array.isArray(cutiList)) {
            const pendingCuti = cutiList.filter(c => c.status === 'Pending');
            counts.absensi = pendingCuti.length;
            if (pendingCuti.length > 0) {
              items.push({
                id: `cuti-pending-${pendingCuti.length}`,
                category: 'cuti',
                title: `📋 ${pendingCuti.length} Pengajuan Cuti Menunggu Approval`,
                message: pendingCuti.slice(0, 2).map(c => `${c.namaPegawai} (${c.jenisCuti} ${c.jumlahHari} hari)`).join(', '),
                type: 'info',
                timestamp: nowStr,
                targetTab: 'absensi',
                count: pendingCuti.length
              });
            }
          }
        } catch (e) {}
      }

      setNotifications(items);
      setBadgeCounts(counts);
    } catch (err) {
      console.error('Gagal memuat notifikasi global:', err);
    } finally {
      setLoading(false);
    }
  }, [currentRole]);

  useEffect(() => {
    fetchGlobalNotifications();
    const interval = setInterval(fetchGlobalNotifications, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [fetchGlobalNotifications]);

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;

  return {
    notifications,
    unreadCount,
    badgeCounts,
    markAsRead,
    markAllAsRead,
    refreshNotifications: fetchGlobalNotifications,
    loading
  };
}
