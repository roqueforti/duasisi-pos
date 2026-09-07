/**
 * DUA SISI POS — BACKUP SUPABASE KE GOOGLE SHEETS
 * Script sinkronisasi otomatis harian (Cloud-to-Cloud Safety Net)
 * Berjalan otomatis via GitHub Actions tiap 02:00 WIB atau on-demand.
 */

let createClient;
try {
  ({ createClient } = await import('@supabase/supabase-js'));
} catch (err) {
  try {
    ({ createClient } = await import('../next-app/node_modules/@supabase/supabase-js/dist/index.mjs'));
  } catch (err2) {
    ({ createClient } = await import('./next-app/node_modules/@supabase/supabase-js/dist/index.mjs'));
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qgzxrtnelfwlhqisgjcq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_zPwkOk-2BZUGiVY1BpJ5Eg__jfCPLh0';
const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbwhy6jhKdsCJSOrDzVO1Av1NXwK1mgJ5u-_7PsefOihNwhsSnTO1C26RfRHrvqHDyWEMA/exec';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let cachedSessionToken = '';
async function getSessionToken() {
  if (cachedSessionToken) return cachedSessionToken;
  try {
    const authRes = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'verifikasiPin', args: ['888888'] }),
      redirect: 'follow',
    });
    const authJson = await authRes.json();
    if (authJson && authJson.sessionToken) {
      cachedSessionToken = authJson.sessionToken;
    }
  } catch (e) {
    console.warn('⚠️ Gagal verifikasi session token GAS:', e.message);
  }
  return cachedSessionToken;
}

async function callGas(action, ...args) {
  const sessionToken = await getSessionToken();
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

  if (!res.ok) throw new Error(`GAS HTTP Error: ${res.status}`);
  return await res.json();
}

async function runBackup() {
  console.log('🚀 [BACKUP] Memulai sinkronisasi Supabase -> Google Sheets...');
  const startTime = Date.now();

  // 1. Ambil daftar nomor nota yang sudah ada di Google Sheets untuk anti-duplikasi
  console.log('📥 Mengambil daftar transaksi yang ada di Google Sheets...');
  let existingNotas = new Set();
  try {
    const sheetTrx = await callGas('getTransaksiList', 'Semua');
    if (Array.isArray(sheetTrx)) {
      sheetTrx.forEach(t => {
        if (t.noNota) existingNotas.add(String(t.noNota).trim());
      });
    }
    console.log(`ℹ️ Google Sheets saat ini memiliki ${existingNotas.size} transaksi.`);
  } catch (err) {
    console.warn('⚠️ Gagal membaca transaksi Google Sheets, melanjutkan dengan proteksi:', err.message);
  }

  // 2. Ambil transaksi dari Supabase (hingga 1000 transaksi terbaru)
  console.log('📥 Mengambil transaksi terbaru dari Supabase...');
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
  const newTransactionsToBackup = (supabaseTrx || []).filter(t => !existingNotas.has(String(t.no_nota).trim()));

  console.log(`📊 Ditemukan ${newTransactionsToBackup.length} transaksi baru yang belum masuk Google Sheets.`);

  if (newTransactionsToBackup.length > 0) {
    // Siapkan baris importTransaksiBatch
    const importRows = [];
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

    console.log(`📤 Mengirim ${importRows.length} baris detail transaksi ke Google Sheets (dalam batch aman)...`);
    const CHUNK_SIZE = 40;
    for (let i = 0; i < importRows.length; i += CHUNK_SIZE) {
      const chunk = importRows.slice(i, i + CHUNK_SIZE);
      const importRes = await callGas('importTransaksiBatch', chunk);
      console.log(`✅ Batch ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(importRows.length / CHUNK_SIZE)}:`, importRes?.importedCount || chunk.length, 'baris');
    }
  }

  // 3. Cek Pelanggan Baru
  console.log('📥 Memeriksa sinkronisasi pelanggan...');
  let existingCustPhone = new Set();
  try {
    const sheetCust = await callGas('getDaftarPelanggan');
    if (Array.isArray(sheetCust)) {
      sheetCust.forEach(c => {
        if (c.noHp) existingCustPhone.add(String(c.noHp).trim());
      });
    }
  } catch {}

  const { data: supabaseCust } = await sb.from('pelanggan').select('*').limit(1000);
  const newCust = (supabaseCust || []).filter(c => !existingCustPhone.has(String(c.no_hp).trim()));

  if (newCust.length > 0) {
    console.log(`📤 Mencadangkan ${newCust.length} pelanggan baru ke Google Sheets...`);
    const custPayload = newCust.map(c => ({
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
      await callGas('importPelangganBatch', chunk);
    }
    console.log('✅ Pelanggan baru berhasil dicadangkan.');
  }

  // Update app_settings di Supabase dengan riwayat backup
  try {
    await sb.from('app_settings').upsert({
      key: 'gas_last_backup_info',
      value: {
        timestamp: new Date().toISOString(),
        actor: 'GitHub Actions / Scheduler',
        newTransactions: newTransactionsToBackup.length,
        newCustomers: newCust.length,
        totalSupabaseTransactions: (supabaseTrx || []).length,
        totalSupabaseCustomers: (supabaseCust || []).length,
        durationSeconds: Number(((Date.now() - startTime) / 1000).toFixed(1)),
        status: 'success'
      },
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  } catch (errSet) {
    console.warn('⚠️ Gagal menyimpan log backup ke app_settings:', errSet.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`🎉 [BACKUP SELESAI] Sinkronisasi ke Google Sheets berhasil dalam ${duration} detik.`);
}

runBackup().catch(err => {
  console.error('❌ [BACKUP GAGAL]:', err);
  process.exit(1);
});
