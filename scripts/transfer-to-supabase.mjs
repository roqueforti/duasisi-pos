/**
 * DUA SISI POS — Instant Google Sheets to Supabase Migration Script
 * 
 * Usage:
 *   node scripts/transfer-to-supabase.mjs
 * 
 * Requirements:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in .env.local or process environment.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Helper to load .env.local if exists
function loadEnv() {
  const envPath = path.resolve(process.cwd(), 'next-app/.env.local');
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

loadEnv();

const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_API_URL || 'https://script.google.com/macros/s/AKfycbwhy6jhKdsCJSOrDzVO1Av1NXwK1mgJ5u-_7PsefOihNwhsSnTO1C26RfRHrvqHDyWEMA/exec';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌ ERROR: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi!');
  console.error('Silakan buat file next-app/.env.local dan isi:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=eyJh...\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function fetchGAS(action, ...args) {
  const res = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, args })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from GAS`);
  return await res.json();
}

function parseDec(val, fallback = 0) {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const clean = String(val).replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? fallback : num;
}

async function migrate() {
  console.log('\n======================================================');
  console.log('🚀 MEMULAI INSTANT TRANSFER DATA: Google Sheets -> Supabase');
  console.log(`📡 GAS Endpoint: ${GAS_API_URL.slice(0, 50)}...`);
  console.log(`🗄️  Supabase URL: ${SUPABASE_URL}`);
  console.log('======================================================\n');

  const startTime = Date.now();

  try {
    // ----------------------------------------------------
    // 1. INVENTORY
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
        harga_jual: parseDec(i.hargaJual, 0)
      }));
      const { error } = await supabase.from('inventory').upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`Gagal insert inventory: ${error.message}`);
      console.log(` Berhasil! (${rows.length} barang)`);
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
        console.log(` Berhasil! (${rows.length} kategori)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch {
      console.log(' (Dilewati)');
    }

    // ----------------------------------------------------
    // 3. LAYANAN & RESEP BOM
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
      console.log(` Berhasil! (${layRows.length} produk, ${bomRows.length} resep bahan)`);
    } else {
      console.log(' (Kosong)');
    }

    // ----------------------------------------------------
    // 4. PELANGGAN
    // ----------------------------------------------------
    process.stdout.write('👥 Mengambil data Pelanggan...');
    const custData = await fetchGAS('getDaftarPelanggan');
    if (Array.isArray(custData) && custData.length > 0) {
      const rows = custData.filter(c => c.noHp && String(c.noHp).trim()).map(c => ({
        nama: String(c.nama || 'Pelanggan').trim(),
        no_hp: String(c.noHp).trim(),
        alamat: c.alamat || null,
        is_member: Boolean(c.isMember || c.statusMember === 'MEMBER'),
        saldo_poin: Number(c.saldoPoin || c.poin) || 0,
        total_order: Number(c.totalOrder) || 0,
        stamps_75: Number(c.stamps75) || 0,
        stamps_45: Number(c.stamps45) || 0
      }));
      const { error } = await supabase.from('pelanggan').upsert(rows, { onConflict: 'no_hp' });
      if (error) throw new Error(`Gagal insert pelanggan: ${error.message}`);
      console.log(` Berhasil! (${rows.length} pelanggan)`);
    } else {
      console.log(' (Kosong)');
    }

    // ----------------------------------------------------
    // 5. MESIN
    // ----------------------------------------------------
    process.stdout.write('🧺 Mengambil data Mesin...');
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
        console.log(` Berhasil! (${rows.length} mesin)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch {
      console.log(' (Dilewati)');
    }

    // ----------------------------------------------------
    // 6. PROMO
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
        console.log(` Berhasil! (${rows.length} promo)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch {
      console.log(' (Dilewati)');
    }

    // ----------------------------------------------------
    // 7. TRANSAKSI HISTORIS
    // ----------------------------------------------------
    process.stdout.write('🧾 Mengambil Riwayat Transaksi...');
    try {
      const trxData = await fetchGAS('getTransaksiList');
      if (Array.isArray(trxData) && trxData.length > 0) {
        const trxRows = [];
        const itemRows = [];

        for (const t of trxData) {
          if (!t.noNota) continue;
          trxRows.push({
            no_nota: String(t.noNota).trim(),
            tanggal: t.tanggal ? new Date(t.tanggal).toISOString() : new Date().toISOString(),
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
                no_nota: String(t.noNota).trim(),
                layanan: String(it.layanan || 'Item'),
                qty: parseDec(it.qty, 1),
                harga_satuan: parseDec(it.hargaSatuan, 0),
                subtotal: parseDec(it.subtotal || (it.qty * it.hargaSatuan), 0)
              });
            }
          }
        }

        // Batch insert per 200 records
        for (let i = 0; i < trxRows.length; i += 200) {
          const chunk = trxRows.slice(i, i + 200);
          await supabase.from('transaksi').upsert(chunk, { onConflict: 'no_nota' });
        }

        if (itemRows.length > 0) {
          for (let i = 0; i < itemRows.length; i += 200) {
            const chunk = itemRows.slice(i, i + 200);
            await supabase.from('transaksi_items').insert(chunk);
          }
        }

        console.log(` Berhasil! (${trxRows.length} transaksi, ${itemRows.length} detail item)`);
      } else {
        console.log(' (Kosong)');
      }
    } catch (err) {
      console.log(` (Catatan: ${err.message})`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n======================================================');
    console.log(`✅ INSTANT TRANSFER SELESAI DALAM ${duration} DETIK!`);
    console.log('Semua data berhasil disalin utuh ke database Supabase.');
    console.log('======================================================\n');

  } catch (err) {
    console.error('\n❌ GAGAL MENGIRIM DATA KE SUPABASE:', err);
    process.exit(1);
  }
}

migrate();
