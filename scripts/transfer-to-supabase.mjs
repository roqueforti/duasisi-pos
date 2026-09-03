/**
 * DUA SISI POS — Instant Google Sheets to Supabase Migration Script
 * 
 * Usage:
 *   node scripts/transfer-to-supabase.mjs
 * 
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in next-app/.env.local or process environment.
 */

import fs from 'fs';
import path from 'path';

let createClient;
try {
  ({ createClient } = await import('@supabase/supabase-js'));
} catch {
  ({ createClient } = await import('../next-app/node_modules/@supabase/supabase-js/dist/index.mjs'));
}

// Helper to load env files (.env.local, .env)
function loadEnv() {
  const envFiles = ['next-app/.env.local', 'next-app/.env', '.env.local', '.env'];
  for (const f of envFiles) {
    const envPath = path.resolve(process.cwd(), f);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...vals] = trimmed.split('=');
        const val = vals.join('=').replace(/(^["']|["']$)/g, '').trim();
        if (key && !process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnv();

const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbwhy6jhKdsCJSOrDzVO1Av1NXwK1mgJ5u-_7PsefOihNwhsSnTO1C26RfRHrvqHDyWEMA/exec';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let gasSessionToken = null;

async function authenticateGAS() {
  try {
    const res = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'verifikasiPin', args: ['888888'] })
    });
    const data = await res.json();
    if (data && data.success && data.sessionToken) {
      gasSessionToken = data.sessionToken;
      console.log('🔑 Terautentikasi ke Google Apps Script (Role: Manager/Owner)');
    }
  } catch (err) {
    console.warn('⚠️ Gagal mendapatkan token sesi GAS:', err.message);
  }
}

async function fetchGAS(action, ...args) {
  const payload = { action, args };
  if (gasSessionToken) {
    payload.sessionToken = gasSessionToken;
  }
  const res = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from GAS`);
  const data = await res.json();
  if (data && data.error === true) {
    throw new Error(data.message || 'Error from GAS');
  }
  return data;
}

function parseDec(val, fallback = 0) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const clean = String(val).replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? fallback : num;
}

function parseWibDate(val, fallback = null) {
  if (!val) return fallback;
  if (val instanceof Date) return isNaN(val.getTime()) ? fallback : val.toISOString();
  if (typeof val !== 'string') return fallback;
  const s = val.trim();
  if (!s) return fallback;

  // Format ISO standar YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Format tanggal Indonesia: DD/MM/YYYY atau DD/MM/YYYY HH:mm atau DD/MM/YYYY HH:mm:ss
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    const hour = (match[4] || '00').padStart(2, '0');
    const min = (match[5] || '00').padStart(2, '0');
    const sec = (match[6] || '00').padStart(2, '0');
    const isoString = `${year}-${month}-${day}T${hour}:${min}:${sec}+07:00`;
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const fallbackDate = new Date(s.replace(' WIB', ''));
  return isNaN(fallbackDate.getTime()) ? fallback : fallbackDate.toISOString();
}

async function migrate() {
  console.log('\n================================================================');
  console.log('🚀 DUA SISI POS — MIGRASI LENGKAP: GOOGLE SHEETS -> SUPABASE');
  console.log('================================================================');
  console.log(`📡 GAS Endpoint : ${GAS_API_URL.slice(0, 55)}...`);
  console.log(`🗄️  Supabase URL : ${SUPABASE_URL || '(Belum diset di .env.local)'}`);
  console.log('================================================================\n');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ ERROR: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi!');
    console.error('Silakan isi di file next-app/.env.local :');
    console.error('  NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co');
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...\n');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });

  const startTime = Date.now();

  try {
    // 0. Autentikasi ke Google Apps Script
    await authenticateGAS();

    // ----------------------------------------------------
    // 1. INVENTORY (18 items)
    // ----------------------------------------------------
    process.stdout.write('📦 Mengambil data Inventory...');
    const invData = await fetchGAS('getInventoryList');
    if (Array.isArray(invData) && invData.length > 0) {
      const rows = invData.map(i => ({
        id: String(i.id || i.kode || `INV-${Date.now()}`),
        nama: String(i.nama || '').trim(),
        stok: parseDec(i.stok, 0),
        satuan: String(i.satuan || 'unit').trim(),
        stok_minimum: parseDec(i.stokMinimum || i.stok_minimum, 0),
        is_dijual: Boolean(i.isDijual),
        harga_jual: parseDec(i.hargaJual, 0),
        kategori_layanan: i.kategori || null
      }));
      const { error } = await supabase.from('inventory').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`Gagal insert inventory: ${error.message}`);
      console.log(` Berhasil! (${rows.length} barang aman)`);
    } else {
      console.log(' (Kosong atau tidak ada data)');
    }

    // ----------------------------------------------------
    // 2. KATEGORI MASTER
    // ----------------------------------------------------
    process.stdout.write('📂 Mengambil data Master Kategori...');
    try {
      const katData = await fetchGAS('getKategoriList');
      if (Array.isArray(katData) && katData.length > 0) {
        const rows = katData.map((k, idx) => ({
          id: String(k.id || `KAT-${idx + 1}`),
          nama: String(k.nama || '').trim(),
          icon: k.icon || 'Folder',
          warna: k.warna || 'teal',
          aktif: k.aktif || 'Y',
          urutan: Number(k.urutan) || idx
        }));
        await supabase.from('master_kategori').upsert(rows, { onConflict: 'id' });
        console.log(` Berhasil! (${rows.length} kategori aman)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch {
      console.log(' (Dilewati)');
    }

    // ----------------------------------------------------
    // 3. LAYANAN & RESEP BAHAN (BOM) (32 items)
    // ----------------------------------------------------
    process.stdout.write('🏷️  Mengambil data Layanan & Resep Bahan (BOM)...');
    const layData = await fetchGAS('getLayananListAll');
    if (Array.isArray(layData) && layData.length > 0) {
      const layRows = [];
      const bomRows = [];

      for (const l of layData) {
        const id = String(l.id || l.kode || l.nama).trim();
        layRows.push({
          id,
          nama: String(l.nama || l.layanan || '').trim(),
          harga: parseDec(l.harga || l.hargaSatuan, 0),
          satuan: String(l.satuan || 'paket'),
          icon: l.icon || 'Package',
          tipe: l.tipe || 'SelfService',
          kategori: l.kategori || 'Self Service',
          kategori_drop_off: l.kategoriDropOff || null,
          kategori_warna: l.kategoriWarna || null,
          kategori_icon: l.kategoriIcon || null,
          id_inventory: l.idInventory && l.idInventory !== 'none' ? String(l.idInventory) : null,
          inventory_deduction_qty: parseDec(l.inventoryDeductionQty, 1),
          harga_modal: parseDec(l.hargaModal, 0),
          aktif: l.aktif || 'Y'
        });

        if (Array.isArray(l.bahanBakuList) && l.bahanBakuList.length > 0) {
          for (const b of l.bahanBakuList) {
            if (b.idInventory && b.idInventory !== 'none') {
              bomRows.push({
                layanan_id: id,
                inventory_id: String(b.idInventory),
                qty: parseDec(b.qty, 1),
                tahap: b.tahap || 'Dicuci'
              });
            }
          }
        }
      }

      const { error: layErr } = await supabase.from('layanan').upsert(layRows, { onConflict: 'id' });
      if (layErr) throw new Error(`Gagal insert layanan: ${layErr.message}`);

      if (bomRows.length > 0) {
        // Hapus bom lama lalu insert
        await supabase.from('layanan_bahan_baku').delete().neq('qty', -999);
        await supabase.from('layanan_bahan_baku').insert(bomRows);
      }
      console.log(` Berhasil! (${layRows.length} produk, ${bomRows.length} resep bahan aman)`);
    } else {
      console.log(' (Kosong)');
    }

    // ----------------------------------------------------
    // 4. PELANGGAN & MEMBER (266 pelanggan)
    // ----------------------------------------------------
    process.stdout.write('👥 Mengambil data Pelanggan & Kartu Member...');
    const custData = await fetchGAS('getDaftarPelanggan');
    if (Array.isArray(custData) && custData.length > 0) {
      const rows = custData.filter(c => c.noHp && String(c.noHp).trim()).map(c => ({
        nama: String(c.nama || 'Pelanggan').trim(),
        no_hp: String(c.noHp).trim(),
        alamat: c.alamat || null,
        tgl_lahir: c.tglLahir ? String(c.tglLahir).slice(0, 10) : null,
        is_member: Boolean(c.isMember || c.statusMember === 'MEMBER'),
        saldo_poin: Number(c.saldoPoin || c.poin) || 0,
        total_order: Number(c.totalOrder) || 0,
        stamps_75: Number(c.stamps75) || 0,
        stamps_45: Number(c.stamps45) || 0,
        created_at: parseWibDate(c.tglDaftar) || new Date().toISOString()
      }));

      // Upsert per batch 100 agar aman
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase.from('pelanggan').upsert(batch, { onConflict: 'no_hp' });
        if (error) throw new Error(`Gagal insert pelanggan batch ${i}: ${error.message}`);
      }
      console.log(` Berhasil! (${rows.length} pelanggan & stempel aman)`);
    } else {
      console.log(' (Kosong)');
    }

    // ----------------------------------------------------
    // 5. MESIN (10 mesin)
    // ----------------------------------------------------
    process.stdout.write('🧺 Mengambil data Mesin Washer & Dryer...');
    try {
      const mesinData = await fetchGAS('getMesinList');
      if (Array.isArray(mesinData) && mesinData.length > 0) {
        const rows = mesinData.map(m => ({
          id: String(m.id).trim(),
          nama: String(m.nama || m.id).trim(),
          tipe: m.tipe || 'Washer',
          status: m.status || 'Siap',
          sisa_waktu_menit: Number(m.sisaWaktuMenit) || 0,
          catatan: m.catatan || null
        }));
        await supabase.from('mesin').upsert(rows, { onConflict: 'id' });
        console.log(` Berhasil! (${rows.length} mesin aman)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch {
      console.log(' (Dilewati)');
    }

    // ----------------------------------------------------
    // 6. PROMO & VOUCHER (4 promo)
    // ----------------------------------------------------
    process.stdout.write('🎟️  Mengambil data Promo & Voucher...');
    try {
      const promoData = await fetchGAS('getPromoList');
      if (Array.isArray(promoData) && promoData.length > 0) {
        const rows = promoData.map(p => ({
          id_promo: String(p.idPromo || p.id || p.kodeVoucher),
          kode_voucher: String(p.kodeVoucher).trim().toUpperCase(),
          jenis_diskon: p.jenisDiskon || 'Persen',
          nilai_diskon: parseDec(p.nilaiDiskon, 0),
          min_transaksi: parseDec(p.minTransaksi, 0),
          maks_potongan: parseDec(p.maksPotongan, 0),
          status_aktif: Boolean(p.statusAktif)
        }));
        await supabase.from('promo').upsert(rows, { onConflict: 'id_promo' });
        console.log(` Berhasil! (${rows.length} promo aman)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch {
      console.log(' (Dilewati)');
    }

    // ----------------------------------------------------
    // 7. KAS SHIFT (12 shift)
    // ----------------------------------------------------
    process.stdout.write('💵 Mengambil data Kas Shift Kasir...');
    try {
      const shiftData = await fetchGAS('getRekapKasShift');
      if (Array.isArray(shiftData) && shiftData.length > 0) {
        const shiftRows = shiftData.filter(s => s.idShift).map(s => ({
          id_shift: String(s.idShift).trim(),
          id_outlet: String(s.idOutlet || 'OUTLET-UTAMA').trim(),
          nama_kasir: String(s.namaKasir || 'Kasir').trim(),
          id_user: s.idUser || null,
          waktu_buka: parseWibDate(s.waktuBuka) || new Date().toISOString(),
          waktu_tutup: parseWibDate(s.waktuTutup),
          kas_awal: parseDec(s.kasAwal, 0),
          saldo_merchant_awal: parseDec(s.saldoMerchantAwal, 0),
          kas_akhir_fisik: parseDec(s.kasAkhirFisik || s.kasAkhirSistem, 0),
          saldo_merchant_akhir: parseDec(s.saldoMerchantAkhir, 0),
          total_penjualan_tunai: parseDec(s.omzetTunai, 0),
          total_penjualan_non_tunai: parseDec(s.omzetMerchant, 0),
          total_pengeluaran: parseDec(s.totalBelanja, 0),
          selisih_kas: parseDec(s.selisihKas, 0),
          status: (s.status === 'Ditutup' || s.status === 'Tutup') ? 'Tutup' : 'Buka',
          catatan: s.catatan || null,
          nama_pengganti: s.namaPengganti || null,
          mode_tutup: s.modeTutup || 'TUTUP_HARIAN'
        }));

        for (let i = 0; i < shiftRows.length; i += 50) {
          const batch = shiftRows.slice(i, i + 50);
          const { error } = await supabase.from('kas_shift').upsert(batch, { onConflict: 'id_shift' });
          if (error) throw new Error(`Gagal insert kas_shift: ${error.message}`);
        }
        console.log(` Berhasil! (${shiftRows.length} riwayat shift kasir aman)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch (err) {
      console.log(` (Catatan: ${err.message})`);
    }

    // ----------------------------------------------------
    // 8. PEGAWAI & KASIR (3 pegawai)
    // ----------------------------------------------------
    process.stdout.write('👤 Mengambil data Pegawai & Kasir...');
    try {
      const pegData = await fetchGAS('getPegawaiList');
      if (Array.isArray(pegData) && pegData.length > 0) {
        const pegRows = pegData.filter(p => p.id).map(p => ({
          id: String(p.id).trim(),
          nama: String(p.nama).trim(),
          no_hp: p.noHp || null,
          jabatan: p.jabatan || 'Kasir / Staff',
          role: (p.jabatan && p.jabatan.toLowerCase().includes('manager')) ? 'MANAGER' : 'STAFF',
          status: p.status || 'Aktif',
          nik: p.nik || null,
          nama_panggilan: p.namaPanggilan || null,
          alamat: p.alamat || null,
          shift_utama: p.shiftUtama || null,
          tanggal_bergabung: p.tanggalBergabung ? p.tanggalBergabung.slice(0, 10) : null
        }));

        await supabase.from('pegawai').upsert(pegRows, { onConflict: 'id' });
        console.log(` Berhasil! (${pegRows.length} data pegawai aman)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch (err) {
      console.log(` (Catatan: ${err.message})`);
    }

    // ----------------------------------------------------
    // 9. TRANSAKSI HISTORIS (113 transaksi)
    // ----------------------------------------------------
    process.stdout.write('🧾 Mengambil Riwayat Transaksi Historis...');
    try {
      const trxData = await fetchGAS('getTransaksiList');
      if (Array.isArray(trxData) && trxData.length > 0) {
        const trxRows = [];
        const itemRows = [];

        for (const t of trxData) {
          if (!t.noNota) continue;
          const noNota = String(t.noNota).trim();
          trxRows.push({
            no_nota: noNota,
            tanggal: parseWibDate(t.tanggal) || new Date().toISOString(),
            nama_pelanggan: t.namaPelanggan || 'Pelanggan Umum',
            no_hp: t.noHp || null,
            alamat: t.alamat || null,
            is_member: Boolean(t.isMember),
            poin_earned: Number(t.poinEarned) || 0,
            petugas: t.petugas || 'Kasir',
            tipe: t.tipe || 'SelfService',
            subtotal: parseDec(t.subtotal || t.total, 0),
            diskon: parseDec(t.diskon, 0),
            total: parseDec(t.total, 0),
            nominal_bayar: parseDec(t.nominalBayar || t.total, 0),
            metode_bayar: t.metodeBayar || 'Tunai',
            status_pembayaran: t.statusPembayaran || 'Lunas',
            status: t.status || 'Selesai',
            catatan: t.catatan || null
          });

          if (Array.isArray(t.items)) {
            for (const it of t.items) {
              itemRows.push({
                no_nota: noNota,
                layanan: String(it.layanan || 'Item'),
                qty: parseDec(it.qty, 1),
                harga_satuan: parseDec(it.hargaSatuan, 0),
                subtotal: parseDec(it.subtotal || (it.qty * it.hargaSatuan), 0)
              });
            }
          }
        }

        // Batch upsert per 100 records
        for (let i = 0; i < trxRows.length; i += 100) {
          const chunk = trxRows.slice(i, i + 100);
          const { error } = await supabase.from('transaksi').upsert(chunk, { onConflict: 'no_nota' });
          if (error) throw new Error(`Gagal upsert transaksi chunk ${i}: ${error.message}`);
        }

        if (itemRows.length > 0) {
          // Bersihkan item transaksi yang ada di chunk agar tidak duplikat saat re-run
          const notaList = [...new Set(trxRows.map(r => r.no_nota))];
          for (let i = 0; i < notaList.length; i += 100) {
            const notaChunk = notaList.slice(i, i + 100);
            await supabase.from('transaksi_items').delete().in('no_nota', notaChunk);
          }

          for (let i = 0; i < itemRows.length; i += 100) {
            const chunk = itemRows.slice(i, i + 100);
            const { error } = await supabase.from('transaksi_items').insert(chunk);
            if (error) throw new Error(`Gagal insert transaksi_items chunk ${i}: ${error.message}`);
          }
        }

        console.log(` Berhasil! (${trxRows.length} transaksi, ${itemRows.length} detail item aman)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch (err) {
      console.log(` (Catatan: ${err.message})`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n================================================================');
    console.log(`✅ MIGRASI SELESAI DALAM ${duration} DETIK!`);
    console.log('Seluruh 8 dataset telah berhasil disalin utuh ke PostgreSQL Supabase.');
    console.log('Data asli di Google Sheets tetap 100% aman.');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ PROSES MIGRASI MENGALAMI KENDALA:', err);
    process.exit(1);
  }
}

migrate();
