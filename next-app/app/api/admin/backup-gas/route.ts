import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qgzxrtnelfwlhqisgjcq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_zPwkOk-2BZUGiVY1BpJ5Eg__jfCPLh0';
const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbwhy6jhKdsCJSOrDzVO1Av1NXwK1mgJ5u-_7PsefOihNwhsSnTO1C26RfRHrvqHDyWEMA/exec';

function getSbClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function callGas(action: string, args: any[] = [], sessionToken = ''): Promise<any> {
  const payload = JSON.stringify({
    action,
    args,
    sessionToken: sessionToken || undefined,
  });

  const res = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: payload,
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`Google Apps Script HTTP Error: ${res.status}`);
  return await res.json();
}

async function getGasSessionToken(): Promise<string> {
  try {
    const authRes = await callGas('verifikasiPin', ['888888']);
    if (authRes && authRes.sessionToken) {
      return authRes.sessionToken;
    }
  } catch (err: any) {
    console.warn('[backup-gas] Gagal verifikasi PIN Manager ke GAS:', err?.message);
  }
  return '';
}

// GET: Cek status pencadangan terakhir & ringkasan record
export async function GET() {
  try {
    const sb = getSbClient();

    // 1. Ambil info backup terakhir dari app_settings
    const { data: settingRow } = await sb
      .from('app_settings')
      .select('value, updated_at')
      .eq('key', 'gas_last_backup_info')
      .maybeSingle();

    const lastBackupInfo = settingRow?.value || null;

    // 2. Hitung jumlah total di Supabase
    const { count: totalTrx } = await sb
      .from('transaksi')
      .select('no_nota', { count: 'exact', head: true });

    const { count: totalCust } = await sb
      .from('pelanggan')
      .select('id', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      lastBackupInfo,
      supabaseStats: {
        totalTransaksi: totalTrx || 0,
        totalPelanggan: totalCust || 0,
      },
      gasApiUrlConfigured: !!GAS_API_URL,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal membaca status backup' },
      { status: 500 }
    );
  }
}

// POST: Jalankan proses backup dari Supabase ke Google Apps Script
export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    let actor = 'Manager';
    try {
      const body = await request.json();
      if (body?.actor) actor = String(body.actor);
    } catch {}

    const sb = getSbClient();

    // 1. Dapatkan Token Sesi Manager dari Google Apps Script
    const sessionToken = await getGasSessionToken();

    // 2. Ambil daftar transaksi yang sudah ada di Google Sheets (anti-duplikasi)
    let existingNotas = new Set<string>();
    try {
      const sheetTrx = await callGas('getTransaksiList', ['Semua'], sessionToken);
      if (Array.isArray(sheetTrx)) {
        sheetTrx.forEach((t: any) => {
          if (t.noNota) existingNotas.add(String(t.noNota).trim());
        });
      }
    } catch (err: any) {
      console.warn('[backup-gas] Pengecekan getTransaksiList Sheets gagal:', err?.message);
    }

    // 3. Ambil transaksi dari Supabase beserta transaksi_items
    const { data: supabaseTrx, error: trxErr } = await sb
      .from('transaksi')
      .select(`
        *,
        transaksi_items (*)
      `)
      .order('tanggal', { ascending: true })
      .limit(1000);

    if (trxErr) throw trxErr;

    // Filter transaksi yang belum ada di Google Sheets
    const newTransactionsToBackup = (supabaseTrx || []).filter(
      (t: any) => !existingNotas.has(String(t.no_nota).trim())
    );

    let syncedTrxCount = 0;
    if (newTransactionsToBackup.length > 0) {
      const importRows: any[] = [];
      for (const t of newTransactionsToBackup) {
        const items = Array.isArray(t.transaksi_items) ? t.transaksi_items : [];
        if (items.length === 0) {
          importRows.push({
            noNota: t.no_nota,
            tanggal: t.tanggal,
            namaPelanggan: t.nama_pelanggan,
            noHp: t.no_hp,
            petugas: t.petugas,
            tipe: t.tipe,
            status: t.status,
            metodeBayar: t.metode_bayar,
            statusPembayaran: t.status_pembayaran,
            catatan: t.catatan || 'Backup Otomatis Supabase',
            layanan: 'Layanan',
            qty: 1,
            hargaSatuan: Number(t.total) || 0,
          });
        } else {
          for (const it of items) {
            importRows.push({
              noNota: t.no_nota,
              tanggal: t.tanggal,
              namaPelanggan: t.nama_pelanggan,
              noHp: t.no_hp,
              petugas: t.petugas,
              tipe: t.tipe,
              status: t.status,
              metodeBayar: t.metode_bayar,
              statusPembayaran: t.status_pembayaran,
              catatan: t.catatan || 'Backup Otomatis Supabase',
              layanan: it.layanan,
              qty: Number(it.qty) || 1,
              hargaSatuan: Number(it.harga_satuan) || 0,
            });
          }
        }
      }

      // Kirim dalam chunks maksimal 25 nota (atau ~50 baris) per batch untuk menghindari timeout
      const CHUNK_SIZE = 40;
      for (let i = 0; i < importRows.length; i += CHUNK_SIZE) {
        const chunk = importRows.slice(i, i + CHUNK_SIZE);
        await callGas('importTransaksiBatch', [chunk], sessionToken);
      }
      syncedTrxCount = newTransactionsToBackup.length;
    }

    // 4. Periksa & Cadangkan Pelanggan Baru
    let existingPhones = new Set<string>();
    try {
      const sheetCust = await callGas('getDaftarPelanggan', [], sessionToken);
      if (Array.isArray(sheetCust)) {
        sheetCust.forEach((c: any) => {
          if (c.noHp) existingPhones.add(String(c.noHp).trim());
        });
      }
    } catch (err: any) {
      console.warn('[backup-gas] Pengecekan getDaftarPelanggan Sheets gagal:', err?.message);
    }

    const { data: supabaseCust } = await sb.from('pelanggan').select('*').limit(1000);
    const newCust = (supabaseCust || []).filter(
      (c: any) => !existingPhones.has(String(c.no_hp).trim())
    );

    let syncedCustCount = 0;
    if (newCust.length > 0) {
      const custPayload = newCust.map((c: any) => ({
        nama: c.nama,
        noHp: c.no_hp,
        alamat: c.alamat || '',
        tglLahir: c.tgl_lahir || '',
        isMember: c.is_member,
        saldoPoin: c.saldo_poin,
        totalOrder: c.total_order,
        stamps75: c.stamps_75,
        stamps45: c.stamps_45,
      }));

      const CHUNK_CUST = 50;
      for (let i = 0; i < custPayload.length; i += CHUNK_CUST) {
        const chunk = custPayload.slice(i, i + CHUNK_CUST);
        await callGas('importPelangganBatch', [chunk], sessionToken);
      }
      syncedCustCount = newCust.length;
    }

    const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));

    // 5. Simpan catatan riwayat backup ke tabel app_settings
    const backupLog = {
      timestamp: new Date().toISOString(),
      actor,
      newTransactions: syncedTrxCount,
      newCustomers: syncedCustCount,
      totalSupabaseTransactions: supabaseTrx?.length || 0,
      totalSupabaseCustomers: supabaseCust?.length || 0,
      existingSheetTransactions: existingNotas.size + syncedTrxCount,
      existingSheetCustomers: existingPhones.size + syncedCustCount,
      durationSeconds,
      status: 'success',
    };

    await sb.from('app_settings').upsert({
      key: 'gas_last_backup_info',
      value: backupLog,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

    let message = 'Seluruh data Supabase dan Google Sheets telah sinkron!';
    if (syncedTrxCount > 0 || syncedCustCount > 0) {
      message = `Berhasil mencadangkan ${syncedTrxCount} transaksi baru dan ${syncedCustCount} pelanggan baru ke Google Sheets!`;
    }

    return NextResponse.json({
      success: true,
      message,
      data: backupLog,
    });
  } catch (err: any) {
    const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
    console.error('[backup-gas] Backup failed:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal mencadangkan data ke Google Apps Script: ' + (err?.message || 'Error server'),
        durationSeconds,
      },
      { status: 500 }
    );
  }
}
