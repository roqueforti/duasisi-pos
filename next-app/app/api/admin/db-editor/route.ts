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
      // Cari di kolom nama, no_nota, no_hp, atau key jika ada
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
        pipeline_steps: ['no_nota', 'step', 'nama_step'],
        audit_logs: ['action', 'user_name'],
        app_settings: ['key'],
      };

      const cols = searchableCols[tableParam];
      if (cols && cols.length > 0) {
        const ilikeFilters = cols.map(c => `${c}.ilike.%${search}%`).join(',');
        query = query.or(ilikeFilters);
      }
    }

    const { data: rows, count, error } = await query.range(fromIndex, toIndex);

    if (error) throw error;

    // Ekstraksi kolom dari baris pertama atau query kosong
    let columns: string[] = [];
    if (rows && rows.length > 0) {
      columns = Object.keys(rows[0]);
    } else {
      // Ambil struktur sample 1 baris
      const { data: sample } = await sb.from(tableParam).select('*').limit(1);
      if (sample && sample[0]) {
        columns = Object.keys(sample[0]);
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

// POST: Aksi Verifikasi Password, Inline Edit Sel, Insert Row, Delete Row, Change Password
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

      // Format tipe nilai jika perlu (angka, boolean, json, atau string)
      let parsedVal: any = value;
      if (value === 'true') parsedVal = true;
      else if (value === 'false') parsedVal = false;
      else if (value === 'null' || value === '') parsedVal = value === '' ? (column.endsWith('_at') || column === 'tanggal' ? null : '') : null;
      else if (typeof value === 'string' && !isNaN(Number(value)) && value.trim() !== '' && !column.includes('no_') && !column.includes('phone') && !column.includes('pin') && !column.includes('kode')) {
        // Parse numerik hanya jika kolom memang angka
        parsedVal = Number(value);
      }

      const { data, error } = await sb
        .from(table)
        .update({ [column]: parsedVal, updated_at: table !== 'audit_logs' && table !== 'kas_shift' ? new Date().toISOString() : undefined })
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
      const { table, rowData } = body;

      if (!table || !TABLE_PRIMARY_KEYS[table]) {
        return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
      }
      if (!rowData || typeof rowData !== 'object') {
        return NextResponse.json({ success: false, message: 'Data baris tidak boleh kosong' }, { status: 400 });
      }

      const pk = TABLE_PRIMARY_KEYS[table];
      // Jika PK belum diisi dan tabel membutuhkan id generik
      if (!rowData[pk] && pk === 'id') {
        // biarkan database generate default UUID atau generate nanoid sederhana
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
            detail: `Menambahkan 1 baris baru ke tabel ${table}`,
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

    // 5. Delete Row dari Tabel
    if (action === 'deleteRow') {
      const { table, primaryKey, primaryKeyValue } = body;

      if (!table || !TABLE_PRIMARY_KEYS[table]) {
        return NextResponse.json({ success: false, message: 'Tabel tidak valid' }, { status: 400 });
      }

      const pk = primaryKey || TABLE_PRIMARY_KEYS[table];
      if (!primaryKeyValue) {
        return NextResponse.json({ success: false, message: 'Primary key value wajib ada' }, { status: 400 });
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
