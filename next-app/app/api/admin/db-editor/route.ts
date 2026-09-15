import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qgzxrtnelfwlhqisgjcq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_zPwkOk-2BZUGiVY1BpJ5Eg__jfCPLh0';

function getSb(): any {
  return createClient(SUPABASE_URL, SUPABASE_KEY) as any;
}

export const TABLE_PRIMARY_KEYS: Record<string, string> = {
  transaksi: 'no_nota',
  transaksi_items: 'id',
  pelanggan: 'id',
  inventory: 'id',
  layanan: 'id',
  pegawai: 'id',
  mesin: 'id',
  kas_shift: 'id_shift',
  promo: 'id_promo',
  loyalty_programs: 'id',
  pipeline_steps: 'id',
  audit_logs: 'id',
  app_settings: 'key',
};

export const TABLE_COLUMNS: Record<string, string[]> = {
  transaksi: ['no_nota', 'tanggal', 'pelanggan_id', 'nama_pelanggan', 'no_hp', 'alamat', 'is_member', 'poin_earned', 'petugas', 'id_shift', 'id_outlet', 'tipe', 'tingkat_layanan', 'subtotal', 'diskon', 'diskon_kode', 'voucher', 'pajak', 'total', 'nominal_bayar', 'nominal_dp', 'sisa_tagihan', 'metode_bayar', 'status_pembayaran', 'referensi_pembayaran', 'status', 'status_void', 'alasan_void', 'catatan', 'estimasi_selesai', 'created_at', 'updated_at'],
  transaksi_items: ['id', 'no_nota', 'layanan', 'qty', 'harga_satuan', 'subtotal', 'catatan', 'id_inventory', 'inventory_deduction_qty'],
  pelanggan: ['id', 'nama', 'no_hp', 'alamat', 'tgl_lahir', 'is_member', 'saldo_poin', 'total_order', 'stamps_75', 'stamps_45', 'assigned_card_7kg_id', 'assigned_card_4kg_id', 'reward_ready_7kg', 'reward_ready_4kg', 'created_at', 'updated_at'],
  inventory: ['id', 'nama', 'stok', 'satuan', 'stok_minimum', 'is_dijual', 'harga_jual', 'kategori_layanan', 'created_at', 'updated_at'],
  layanan: ['id', 'nama', 'harga', 'satuan', 'icon', 'tipe', 'kategori', 'kategori_drop_off', 'kategori_warna', 'kategori_icon', 'id_inventory', 'inventory_deduction_qty', 'harga_modal', 'aktif', 'created_at', 'updated_at'],
  pegawai: ['id', 'nama', 'no_hp', 'jabatan', 'role', 'status', 'nik', 'nama_panggilan', 'alamat', 'shift_utama', 'tanggal_bergabung', 'pin_hash', 'created_at'],
  mesin: ['id', 'nama', 'tipe', 'status', 'no_nota', 'nama_pelanggan', 'layanan', 'waktu_mulai', 'estimasi_selesai', 'sisa_waktu_menit', 'catatan', 'updated_at'],
  kas_shift: ['id_shift', 'id_outlet', 'nama_kasir', 'id_user', 'waktu_buka', 'waktu_tutup', 'kas_awal', 'saldo_merchant_awal', 'kas_akhir_fisik', 'saldo_merchant_akhir', 'total_penjualan_tunai', 'total_penjualan_non_tunai', 'total_pengeluaran', 'selisih_kas', 'status', 'catatan', 'nama_pengganti', 'mode_tutup', 'created_at'],
  promo: ['id_promo', 'kode_voucher', 'jenis_diskon', 'nilai_diskon', 'min_transaksi', 'maks_potongan', 'tgl_mulai', 'tgl_berakhir', 'kuota', 'dipakai', 'status_aktif'],
  loyalty_programs: ['id', 'nama', 'deskripsi', 'kapasitas', 'syarat_layanan', 'total_stamps', 'claim_rule'],
  pipeline_steps: ['id', 'no_nota', 'step', 'nama_step', 'status', 'assigned_staff', 'mesin_id', 'waktu_mulai', 'waktu_selesai'],
  audit_logs: ['id', 'action', 'user_name', 'detail', 'payload', 'created_at'],
  app_settings: ['key', 'value', 'updated_at'],
};

const TABLES_WITH_UPDATED_AT = new Set([
  'transaksi', 'pelanggan', 'inventory', 'layanan', 'mesin', 'app_settings'
]);

export const TABLE_METADATA: Record<string, { label: string; icon: string; description: string }> = {
  transaksi: { label: 'Transaksi', icon: 'ShoppingCart', description: 'Data master penjualan POS dan order drop-off' },
  transaksi_items: { label: 'Transaksi Items', icon: 'Layers', description: 'Rincian item layanan/produk per transaksi' },
  pelanggan: { label: 'Pelanggan', icon: 'Users', description: 'Master data customer, kontak WA, poin & kartu loyalitas' },
  inventory: { label: 'Inventory', icon: 'Package', description: 'Stok bahan baku, deterjen, softener & barang retail' },
  layanan: { label: 'Layanan & Jasa', icon: 'Tag', description: 'Katalog harga, jenis laundry, dan konfigurasi SOP' },
  pegawai: { label: 'Pegawai', icon: 'UserCheck', description: 'Daftar staf, kasir, teknisi, dan jabatan outlet' },
  mesin: { label: 'Mesin Cuci & Dryer', icon: 'WashingMachine', description: 'Status mesin cuci, pengering, dan pemeliharaan' },
  kas_shift: { label: 'Kas Shift', icon: 'Coins', description: 'Log pembukaan & penutupan laci kasir per shift' },
  promo: { label: 'Voucher & Promo', icon: 'Gift', description: 'Master kode diskon dan kuota promosi' },
  loyalty_programs: { label: 'Program Loyalitas', icon: 'Award', description: 'Konfigurasi stempel loyalty card pelanggan' },
  pipeline_steps: { label: 'Pipeline SOP', icon: 'GitMerge', description: 'Langkah tracking pengerjaan order laundry' },
  audit_logs: { label: 'Audit Logs', icon: 'ShieldCheck', description: 'Riwayat keamanan dan log aktivitas sistem' },
  app_settings: { label: 'App Settings', icon: 'SlidersHorizontal', description: 'Konfigurasi global dan parameter aplikasi' },
};

const DEFAULT_DB_PASSWORD = 'duasisi2026';

function generateAutoId(table: string): string {
  const ts = Date.now().toString();
  const rand4 = Math.floor(1000 + Math.random() * 9000);
  switch (table) {
    case 'layanan':
      return `LAY-${ts.slice(-6)}${rand4.toString().slice(-2)}`;
    case 'inventory':
      return `INV-${ts.slice(-6)}${rand4.toString().slice(-2)}`;
    case 'pegawai':
      return `PEG-${ts.slice(-6)}`;
    case 'mesin':
      return `MC-${rand4.toString().slice(-2)}`;
    case 'kas_shift':
      return `SHF-${ts.slice(-8)}`;
    case 'promo':
      return `PRM-${ts.slice(-6)}`;
    case 'transaksi':
      return `TRX-${ts}`;
    case 'loyalty_programs':
      return `LOY-${ts.slice(-6)}`;
    case 'app_settings':
      return `SETTING-${ts.slice(-6)}`;
    default:
      return crypto.randomUUID();
  }
}

// Helper: Ambil password database editor aktif
async function getActivePassword(sb: any): Promise<string> {
  try {
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'database_editor_password')
      .maybeSingle();

    if (data?.value && typeof data.value === 'string') {
      return data.value;
    }
    if (data?.value?.password) {
      return String(data.value.password);
    }
  } catch (e) {
    console.warn('[db-editor] Gagal membaca password custom, fallback ke default:', e);
  }
  return DEFAULT_DB_PASSWORD;
}

// GET: Ambil ringkasan seluruh tabel atau data baris tabel tertentu
export async function GET(request: Request) {
  try {
    const sb = getSb();
    const { searchParams } = new URL(request.url);
    const tableParam = searchParams.get('table');

    // Jika tidak ada parameter table: kembalikan list tabel dan jumlah barisnya
    if (!tableParam) {
      const stats: Record<string, { count: number; primaryKey: string; label: string; icon: string; description: string }> = {};

      await Promise.all(
        Object.entries(TABLE_PRIMARY_KEYS).map(async ([tbl, pk]) => {
          try {
            const { count, error } = await sb.from(tbl).select(pk, { count: 'exact', head: true });
            stats[tbl] = {
              count: error ? 0 : (count || 0),
              primaryKey: pk,
              label: TABLE_METADATA[tbl]?.label || tbl,
              icon: TABLE_METADATA[tbl]?.icon || 'Database',
              description: TABLE_METADATA[tbl]?.description || '',
            };
          } catch {
            stats[tbl] = {
              count: 0,
              primaryKey: pk,
              label: TABLE_METADATA[tbl]?.label || tbl,
              icon: TABLE_METADATA[tbl]?.icon || 'Database',
              description: TABLE_METADATA[tbl]?.description || '',
            };
          }
        })
      );

      return NextResponse.json({
        success: true,
        tables: stats,
      });
    }

    // Validasi tabel yang diperbolehkan
    if (!TABLE_PRIMARY_KEYS[tableParam]) {
      return NextResponse.json(
        { success: false, message: `Tabel '${tableParam}' tidak diizinkan atau tidak ditemukan.` },
        { status: 400 }
      );
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '25', 10)));
    const search = (searchParams.get('search') || '').trim();
    const sortCol = (searchParams.get('sortCol') || '').trim();
    const sortDir = (searchParams.get('sortDir') || 'desc').toLowerCase() === 'asc';

    const pk = TABLE_PRIMARY_KEYS[tableParam];
    const fromIndex = (page - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    let query = sb.from(tableParam).select('*', { count: 'exact' });

    // Tambahkan sortir
    if (sortCol) {
      query = query.order(sortCol, { ascending: sortDir });
    } else {
      query = query.order(pk, { ascending: false });
    }

    // Filter pencarian teks sederhana bila disediakan
    if (search) {
      const cleanSearch = search.replace(/[,()]/g, ' ').trim();
      if (cleanSearch) {
        const searchableCols: Record<string, string[]> = {
          transaksi: ['no_nota', 'nama_pelanggan', 'no_hp', 'petugas'],
          transaksi_items: ['no_nota', 'layanan'],
          pelanggan: ['nama', 'no_hp', 'alamat'],
          inventory: ['nama', 'satuan'],
          layanan: ['nama', 'kategori', 'tipe'],
          pegawai: ['nama', 'jabatan', 'no_hp'],
          mesin: ['nama', 'tipe', 'status'],
          kas_shift: ['id_shift', 'nama_kasir', 'status'],
          promo: ['kode_voucher'],
          loyalty_programs: ['nama'],
          pipeline_steps: ['no_nota', 'nama_step', 'assigned_staff', 'mesin_id'],
          audit_logs: ['action', 'user_name'],
          app_settings: ['key'],
        };

        const cols = searchableCols[tableParam];
        if (cols && cols.length > 0) {
          const ilikeFilters = cols.map(c => `${c}.ilike.%${cleanSearch}%`).join(',');
          query = query.or(ilikeFilters);
        }
      }
    }

    const { data: rows, count, error } = await query.range(fromIndex, toIndex);

    if (error) throw error;

    // Ekstraksi kolom dari baris pertama, sample, atau schema fallback
    let columns: string[] = [];
    if (rows && rows.length > 0) {
      columns = Object.keys(rows[0]);
    } else {
      const { data: sample } = await sb.from(tableParam).select('*').limit(1);
      if (sample && sample[0]) {
        columns = Object.keys(sample[0]);
      } else if (TABLE_COLUMNS[tableParam]) {
        columns = TABLE_COLUMNS[tableParam];
      }
    }

    return NextResponse.json({
      success: true,
      table: tableParam,
      primaryKey: pk,
      totalRows: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      columns,
      rows: rows || [],
    });
  } catch (error: any) {
    console.error('[db-editor GET error]:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memuat data tabel' },
      { status: 500 }
    );
  }
}

// POST: Aksi Verifikasi Password, Inline Edit Sel, Insert Row, Update Row, Delete Row, Change Password
export async function POST(request: Request) {
  try {
    const sb = getSb();
    const body = await request.json();
    const { action } = body;

    // 1. Verifikasi Password Tambahan (Alfanumerik)
    if (action === 'verifyPassword') {
      const inputPass = String(body.password || '').trim();
      const activePass = await getActivePassword(sb);

      if (inputPass === activePass) {
        return NextResponse.json({
          success: true,
          message: 'Kata sandi database editor valid!',
        });
      } else {
        return NextResponse.json(
          { success: false, message: 'Kata sandi alfanumerik salah!' },
          { status: 401 }
        );
      }
    }

    // 2. Ganti Password Database Editor
    if (action === 'changePassword') {
      const { oldPassword, newPassword } = body;
      const activePass = await getActivePassword(sb);

      if (String(oldPassword || '').trim() !== activePass) {
        return NextResponse.json(
          { success: false, message: 'Kata sandi lama tidak sesuai.' },
          { status: 400 }
        );
      }

      const cleanNew = String(newPassword || '').trim();
      if (cleanNew.length < 6) {
        return NextResponse.json(
          { success: false, message: 'Kata sandi baru minimal 6 karakter.' },
          { status: 400 }
        );
      }

      // Simpan ke app_settings
      await sb.from('app_settings').upsert({
        key: 'database_editor_password',
        value: cleanNew,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

      return NextResponse.json({
        success: true,
        message: 'Kata sandi Database Editor berhasil diperbarui!',
      });
    }

    // 3. Update Nilai Sel Tertentu (Inline Editing Spreadsheet)
    if (action === 'updateCell') {
      const { table, primaryKey, primaryKeyValue, column, value } = body;

      if (!table || !TABLE_PRIMARY_KEYS[table]) {
        return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
      }
      if (!column) {
        return NextResponse.json({ success: false, message: 'Nama kolom tidak boleh kosong' }, { status: 400 });
      }

      const pk = primaryKey || TABLE_PRIMARY_KEYS[table];

      // Format tipe nilai secara akurat
      let parsedVal: any = value;
      if (value === 'true' || value === true) {
        parsedVal = true;
      } else if (value === 'false' || value === false) {
        parsedVal = false;
      } else if (value === 'null' || value === null) {
        parsedVal = null;
      } else if (value === '') {
        if (column.endsWith('_at') || column === 'tanggal' || column.startsWith('tgl_')) {
          parsedVal = null;
        } else if (column.startsWith('id_') || column.endsWith('_id') || column === 'pelanggan_id') {
          parsedVal = null;
        } else if (['harga', 'stok', 'qty', 'harga_satuan', 'subtotal', 'diskon', 'pajak', 'total', 'nominal_bayar', 'nominal_dp', 'sisa_tagihan', 'kas_awal', 'kas_akhir_fisik', 'selisih_kas', 'stok_minimum', 'harga_jual', 'harga_modal', 'inventory_deduction_qty', 'nilai_diskon', 'min_transaksi', 'maks_potongan', 'kuota', 'dipakai', 'saldo_poin', 'total_order', 'stamps_75', 'stamps_45', 'sisa_waktu_menit', 'step'].includes(column)) {
          parsedVal = 0;
        } else if (['is_member', 'is_dijual', 'reward_ready_7kg', 'reward_ready_4kg', 'status_aktif'].includes(column)) {
          parsedVal = false;
        } else {
          parsedVal = '';
        }
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if ((column === 'value' && table === 'app_settings') || column === 'payload') {
          try {
            parsedVal = JSON.parse(trimmed);
          } catch {
            parsedVal = trimmed;
          }
        } else if (!isNaN(Number(trimmed)) && trimmed !== '' && !column.includes('no_') && !column.includes('phone') && !column.includes('hp') && !column.includes('pin') && !column.includes('kode') && !column.includes('nik') && !column.includes('card_') && column !== pk) {
          parsedVal = Number(trimmed);
        } else {
          parsedVal = trimmed;
        }
      }

      const updatePayload: Record<string, any> = { [column]: parsedVal };
      if (TABLES_WITH_UPDATED_AT.has(table)) {
        updatePayload.updated_at = new Date().toISOString();
      }

      const { data, error } = await sb
        .from(table)
        .update(updatePayload)
        .eq(pk, primaryKeyValue)
        .select()
        .single();

      if (error) throw error;

      // Catat log audit jika bukan audit_logs itu sendiri
      if (table !== 'audit_logs') {
        try {
          await sb.from('audit_logs').insert({
            action: `DB Editor: Update [${table}.${column}]`,
            user_name: body.actor || 'Manager (DB Editor)',
            detail: `Mengubah baris ${pk}=${primaryKeyValue} pada kolom '${column}' menjadi: ${String(value).slice(0, 80)}`,
            created_at: new Date().toISOString(),
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: `Kolom '${column}' berhasil diperbarui!`,
        updatedRow: data,
      });
    }

    // 4. Insert Row Baru ke Tabel
    if (action === 'insertRow') {
      const { table, rowData: rawRowData } = body;

      if (!table || !TABLE_PRIMARY_KEYS[table]) {
        return NextResponse.json({ success: false, message: `Tabel '${table}' tidak valid.` }, { status: 400 });
      }
      if (!rawRowData || typeof rawRowData !== 'object') {
        return NextResponse.json({ success: false, message: 'Data baris tidak boleh kosong.' }, { status: 400 });
      }

      const pk = TABLE_PRIMARY_KEYS[table];
      const rowData: Record<string, any> = { ...rawRowData };

      // Pastikan Primary Key terisi secara otomatis jika kosong
      if (!rowData[pk] || String(rowData[pk]).trim() === '') {
        rowData[pk] = generateAutoId(table);
      } else {
        rowData[pk] = String(rowData[pk]).trim();
      }

      // Validasi kolom wajib minimal per tabel
      if (table === 'layanan' && (!rowData.nama || String(rowData.nama).trim() === '')) {
        return NextResponse.json({ success: false, message: 'Nama layanan wajib diisi!' }, { status: 400 });
      }
      if (table === 'pelanggan' && (!rowData.nama || !rowData.no_hp)) {
        return NextResponse.json({ success: false, message: 'Nama dan Nomor HP pelanggan wajib diisi!' }, { status: 400 });
      }
      if (table === 'inventory' && (!rowData.nama || String(rowData.nama).trim() === '')) {
        return NextResponse.json({ success: false, message: 'Nama barang inventory wajib diisi!' }, { status: 400 });
      }
      if (table === 'pegawai' && (!rowData.nama || String(rowData.nama).trim() === '')) {
        return NextResponse.json({ success: false, message: 'Nama pegawai wajib diisi!' }, { status: 400 });
      }
      if (table === 'mesin' && (!rowData.nama || !rowData.tipe)) {
        return NextResponse.json({ success: false, message: 'Nama dan Tipe mesin wajib diisi!' }, { status: 400 });
      }
      if (table === 'promo' && (!rowData.kode_voucher || String(rowData.kode_voucher).trim() === '')) {
        return NextResponse.json({ success: false, message: 'Kode voucher wajib diisi!' }, { status: 400 });
      }

      // Terapkan default values yang aman jika tidak diisi atau string kosong
      if (table === 'layanan') {
        if (rowData.harga === undefined || rowData.harga === null || rowData.harga === '') rowData.harga = 0;
        else rowData.harga = Number(rowData.harga) || 0;
        if (!rowData.satuan || String(rowData.satuan).trim() === '') rowData.satuan = 'paket';
        if (!rowData.icon || String(rowData.icon).trim() === '') rowData.icon = 'Package';
        if (!rowData.tipe || String(rowData.tipe).trim() === '') rowData.tipe = 'SelfService';
        if (!rowData.kategori || String(rowData.kategori).trim() === '') rowData.kategori = 'Self Service';
        if (!rowData.aktif || String(rowData.aktif).trim() === '') rowData.aktif = 'Y';
        if (rowData.harga_modal === undefined || rowData.harga_modal === null || rowData.harga_modal === '') rowData.harga_modal = 0;
        else rowData.harga_modal = Number(rowData.harga_modal) || 0;
        if (rowData.inventory_deduction_qty === undefined || rowData.inventory_deduction_qty === null || rowData.inventory_deduction_qty === '') rowData.inventory_deduction_qty = 1;
        else rowData.inventory_deduction_qty = Number(rowData.inventory_deduction_qty) || 1;
        if (rowData.id_inventory === '' || rowData.id_inventory === 'none') rowData.id_inventory = null;
      } else if (table === 'inventory') {
        if (rowData.stok === undefined || rowData.stok === null || rowData.stok === '') rowData.stok = 0;
        else rowData.stok = Number(rowData.stok) || 0;
        if (!rowData.satuan || String(rowData.satuan).trim() === '') rowData.satuan = 'unit';
        if (rowData.is_dijual === undefined || rowData.is_dijual === null || rowData.is_dijual === '') rowData.is_dijual = false;
        else rowData.is_dijual = rowData.is_dijual === true || rowData.is_dijual === 'true';
        if (rowData.harga_jual === undefined || rowData.harga_jual === null || rowData.harga_jual === '') rowData.harga_jual = 0;
        else rowData.harga_jual = Number(rowData.harga_jual) || 0;
        if (rowData.stok_minimum === undefined || rowData.stok_minimum === null || rowData.stok_minimum === '') rowData.stok_minimum = 0;
        else rowData.stok_minimum = Number(rowData.stok_minimum) || 0;
      } else if (table === 'pelanggan') {
        if (rowData.is_member === undefined || rowData.is_member === null || rowData.is_member === '') rowData.is_member = false;
        else rowData.is_member = rowData.is_member === true || rowData.is_member === 'true';
        if (rowData.saldo_poin === undefined || rowData.saldo_poin === null || rowData.saldo_poin === '') rowData.saldo_poin = 0;
        else rowData.saldo_poin = Number(rowData.saldo_poin) || 0;
        if (rowData.total_order === undefined || rowData.total_order === null || rowData.total_order === '') rowData.total_order = 0;
        else rowData.total_order = Number(rowData.total_order) || 0;
        if (rowData.stamps_75 === undefined || rowData.stamps_75 === null || rowData.stamps_75 === '') rowData.stamps_75 = 0;
        else rowData.stamps_75 = Number(rowData.stamps_75) || 0;
        if (rowData.stamps_45 === undefined || rowData.stamps_45 === null || rowData.stamps_45 === '') rowData.stamps_45 = 0;
        else rowData.stamps_45 = Number(rowData.stamps_45) || 0;
      } else if (table === 'mesin') {
        if (!rowData.status || String(rowData.status).trim() === '') rowData.status = 'Siap';
      } else if (table === 'pegawai') {
        if (!rowData.role || String(rowData.role).trim() === '') rowData.role = 'STAFF';
        if (!rowData.status || String(rowData.status).trim() === '') rowData.status = 'Aktif';
        if (!rowData.jabatan || String(rowData.jabatan).trim() === '') rowData.jabatan = 'Kasir';
      } else if (table === 'promo') {
        if (!rowData.jenis_diskon || String(rowData.jenis_diskon).trim() === '') rowData.jenis_diskon = 'Persen';
        if (rowData.nilai_diskon === undefined || rowData.nilai_diskon === null || rowData.nilai_diskon === '') rowData.nilai_diskon = 0;
        else rowData.nilai_diskon = Number(rowData.nilai_diskon) || 0;
        if (rowData.status_aktif === undefined || rowData.status_aktif === null || rowData.status_aktif === '') rowData.status_aktif = true;
        else rowData.status_aktif = rowData.status_aktif === true || rowData.status_aktif === 'true';
      }

      // Bersihkan string kosong pada kolom yang nullable/FK
      Object.keys(rowData).forEach(k => {
        const v = rowData[k];
        if (v === '') {
          if (k.endsWith('_id') || k.startsWith('id_') || k.endsWith('_fk') || k.endsWith('_at') || k === 'tanggal' || k === 'tgl_lahir' || k === 'tgl_mulai' || k === 'tgl_berakhir') {
            rowData[k] = null;
          }
        }
      });

      if (TABLES_WITH_UPDATED_AT.has(table)) {
        rowData.updated_at = new Date().toISOString();
      }
      if (['transaksi', 'pelanggan', 'inventory', 'layanan', 'kas_shift', 'audit_logs', 'pegawai'].includes(table) && !rowData.created_at) {
        rowData.created_at = new Date().toISOString();
      }

      const { data, error } = await sb
        .from(table)
        .insert(rowData)
        .select()
        .single();

      if (error) throw error;

      // Catat audit
      if (table !== 'audit_logs') {
        try {
          await sb.from('audit_logs').insert({
            action: `DB Editor: Insert [${table}]`,
            user_name: body.actor || 'Manager (DB Editor)',
            detail: `Menambahkan 1 baris baru ke tabel ${table} (${pk}=${rowData[pk]})`,
            created_at: new Date().toISOString(),
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: `Baris baru berhasil ditambahkan ke tabel '${table}'!`,
        insertedRow: data,
      });
    }

    // 5. Update Seluruh Row (Full Row Edit Modal)
    if (action === 'updateRow') {
      const { table, primaryKey, primaryKeyValue, rowData: rawRowData } = body;

      if (!table || !TABLE_PRIMARY_KEYS[table]) {
        return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
      }
      const pk = primaryKey || TABLE_PRIMARY_KEYS[table];
      if (!primaryKeyValue) {
        return NextResponse.json({ success: false, message: 'Primary key value wajib ada' }, { status: 400 });
      }

      const rowData: Record<string, any> = { ...rawRowData };
      delete rowData[pk]; // Jangan ubah primary key

      // Sanitasi nilai
      Object.keys(rowData).forEach(k => {
        const v = rowData[k];
        if (v === '') {
          if (k.endsWith('_id') || k.startsWith('id_') || k.endsWith('_at') || k === 'tanggal' || k.startsWith('tgl_')) {
            rowData[k] = null;
          } else if (typeof v === 'string' && !isNaN(Number(v)) && !k.includes('no_') && !k.includes('hp') && !k.includes('phone') && !k.includes('pin') && !k.includes('kode')) {
            rowData[k] = Number(v);
          }
        } else if (v === 'true') {
          rowData[k] = true;
        } else if (v === 'false') {
          rowData[k] = false;
        } else if (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== '' && !k.includes('no_') && !k.includes('hp') && !k.includes('phone') && !k.includes('pin') && !k.includes('kode')) {
          rowData[k] = Number(v);
        }
      });

      if (TABLES_WITH_UPDATED_AT.has(table)) {
        rowData.updated_at = new Date().toISOString();
      }

      const { data, error } = await sb
        .from(table)
        .update(rowData)
        .eq(pk, primaryKeyValue)
        .select()
        .single();

      if (error) throw error;

      if (table !== 'audit_logs') {
        try {
          await sb.from('audit_logs').insert({
            action: `DB Editor: Update Row [${table}]`,
            user_name: body.actor || 'Manager (DB Editor)',
            detail: `Memperbarui baris ${pk}=${primaryKeyValue} di tabel ${table}`,
            created_at: new Date().toISOString(),
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: `Baris '${primaryKeyValue}' berhasil diperbarui!`,
        updatedRow: data,
      });
    }

    // 6. Delete Row dari Tabel
    if (action === 'deleteRow') {
      const { table, primaryKey, primaryKeyValue } = body;

      if (!table || !TABLE_PRIMARY_KEYS[table]) {
        return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
      }

      const pk = primaryKey || TABLE_PRIMARY_KEYS[table];
      if (!primaryKeyValue) {
        return NextResponse.json({ success: false, message: 'Primary key value wajib ada' }, { status: 400 });
      }

      // Bersihkan relasi dependent sebelum delete jika ada
      if (table === 'layanan') {
        try {
          await sb.from('layanan_bahan_baku').delete().eq('layanan_id', primaryKeyValue);
        } catch (e) {
          console.warn('[db-editor deleteRow] Gagal cascade hapus layanan_bahan_baku:', e);
        }
      } else if (table === 'transaksi') {
        try {
          await sb.from('transaksi_items').delete().eq('no_nota', primaryKeyValue);
          await sb.from('pipeline_steps').delete().eq('no_nota', primaryKeyValue);
        } catch (e) {
          console.warn('[db-editor deleteRow] Gagal cascade hapus transaksi items/pipeline:', e);
        }
      } else if (table === 'kas_shift') {
        try {
          await sb.from('kas_shift_pengeluaran').delete().eq('id_shift', primaryKeyValue);
        } catch (e) {
          console.warn('[db-editor deleteRow] Gagal cascade hapus kas_shift_pengeluaran:', e);
        }
      }

      const { error } = await sb
        .from(table)
        .delete()
        .eq(pk, primaryKeyValue);

      if (error) throw error;

      // Catat audit
      if (table !== 'audit_logs') {
        try {
          await sb.from('audit_logs').insert({
            action: `DB Editor: Delete [${table}]`,
            user_name: body.actor || 'Manager (DB Editor)',
            detail: `Menghapus baris ${pk}=${primaryKeyValue} dari tabel ${table}`,
            created_at: new Date().toISOString(),
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: `Baris '${primaryKeyValue}' berhasil dihapus dari tabel '${table}'!`,
      });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    console.error('[db-editor POST error]:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal mengeksekusi operasi database' },
      { status: 500 }
    );
  }
}
