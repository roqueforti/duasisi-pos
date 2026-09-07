/**
 * Dua Sisi POS — Backup & Cloud Safety Net Service
 * Sinkronisasi data dari Supabase ke Google Apps Script / Google Sheets
 */

export interface BackupLogInfo {
  timestamp: string;
  actor: string;
  newTransactions: number;
  newCustomers: number;
  totalSupabaseTransactions: number;
  totalSupabaseCustomers: number;
  existingSheetTransactions: number;
  existingSheetCustomers: number;
  durationSeconds: number;
  status: 'success' | 'error';
}

export interface BackupStatusResponse {
  success: boolean;
  lastBackupInfo: BackupLogInfo | null;
  supabaseStats?: {
    totalTransaksi: number;
    totalPelanggan: number;
  };
  gasApiUrlConfigured?: boolean;
  message?: string;
}

export interface BackupResultResponse {
  success: boolean;
  message: string;
  data?: BackupLogInfo;
  durationSeconds?: number;
}

export async function fetchBackupStatus(): Promise<BackupStatusResponse> {
  try {
    const res = await fetch('/api/admin/backup-gas', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.warn('[backupService] fetchBackupStatus error:', err);
    return {
      success: false,
      lastBackupInfo: null,
      message: err.message || 'Gagal memuat status backup',
    };
  }
}

export async function executeGasBackup(actor = 'Manager'): Promise<BackupResultResponse> {
  try {
    const res = await fetch('/api/admin/backup-gas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || `HTTP error ${res.status}`);
    }
    return data;
  } catch (err: any) {
    console.error('[backupService] executeGasBackup error:', err);
    return {
      success: false,
      message: err?.message || 'Terjadi kesalahan saat memproses backup.',
    };
  }
}
