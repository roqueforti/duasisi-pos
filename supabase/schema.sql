-- ============================================================
-- DUA SISI POS LAUNDRY — SUPABASE DATABASE SCHEMA
-- Version: 3.0 (PostgreSQL Migration)
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. MASTER INVENTORY
-- ============================================================
create table if not exists inventory (
    id text primary key,
    nama text not null,
    stok numeric(12, 4) not null default 0,
    satuan text not null default 'unit',
    stok_minimum numeric(12, 4) not null default 0,
    is_dijual boolean not null default false,
    harga_jual numeric(12, 2) default 0,
    kategori_layanan text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_inventory_nama on inventory(lower(nama));

-- ============================================================
-- 2. MASTER LAYANAN & RESEP BAHAN BAKU (BOM)
-- ============================================================
create table if not exists layanan (
    id text primary key,
    nama text not null,
    harga numeric(12, 2) not null default 0,
    satuan text default 'paket',
    icon text default 'Package',
    tipe text default 'SelfService', -- 'SelfService', 'FullService', ''
    kategori text default 'Self Service',
    kategori_drop_off text,
    kategori_warna text,
    kategori_icon text,
    id_inventory text references inventory(id) on delete set null,
    inventory_deduction_qty numeric(12, 4) default 1,
    harga_modal numeric(12, 2) default 0,
    aktif text default 'Y',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_layanan_nama on layanan(lower(nama));
create index if not exists idx_layanan_tipe on layanan(tipe);
create index if not exists idx_layanan_kategori on layanan(kategori);

-- Tabel Resep Bahan Baku (BOM Multi-Bahan)
create table if not exists layanan_bahan_baku (
    id uuid primary key default gen_random_uuid(),
    layanan_id text not null references layanan(id) on delete cascade,
    inventory_id text not null references inventory(id) on delete cascade,
    qty numeric(12, 4) not null default 1,
    tahap text not null default 'Dicuci',
    created_at timestamptz default now()
);

create index if not exists idx_lbb_layanan on layanan_bahan_baku(layanan_id);

-- ============================================================
-- 3. MASTER PELANGGAN & MEMBER
-- ============================================================
create table if not exists pelanggan (
    id uuid primary key default gen_random_uuid(),
    nama text not null,
    no_hp text not null unique,
    alamat text,
    tgl_lahir date,
    is_member boolean not null default false,
    saldo_poin int not null default 0,
    total_order int not null default 0,
    stamps_75 int not null default 0,
    stamps_45 int not null default 0,
    assigned_card_7kg_id text default 'CARD_7KG_LEGACY',
    assigned_card_4kg_id text default 'CARD_4KG_STANDARD',
    reward_ready_7kg boolean default false,
    reward_ready_4kg boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create unique index if not exists idx_pelanggan_nohp on pelanggan(no_hp);
create index if not exists idx_pelanggan_nama on pelanggan(lower(nama));

-- ============================================================
-- 3B. MASTER PROGRAM KARTU LOYALTY (MULTI-CARD & CUSTOM CLAIM RULES)
-- ============================================================
create table if not exists loyalty_programs (
    id text primary key,
    nama text not null,
    deskripsi text,
    kapasitas text not null default '7kg', -- '7kg', '4kg', 'all', 'custom'
    syarat_layanan text not null default 'washer_dryer', -- 'washer_dryer', 'washer_only', 'all', 'custom'
    total_stamps int not null default 10,
    claim_rule text not null default 'FREE_ON_NEXT_TRX', -- 'FREE_ON_NTH' vs 'FREE_ON_NEXT_TRX'
    reward_deskripsi text not null default '1x Cuci Gratis',
    reward_type text not null default 'FREE_SERVICE', -- 'FREE_SERVICE', 'DISCOUNT_PERCENT', 'DISCOUNT_NOMINAL'
    reward_value numeric(12,2) default 100,
    warna_tema text not null default 'teal',
    is_active boolean not null default true,
    is_default boolean not null default false,
    urutan int default 1,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Seed Default Loyalty Programs
insert into loyalty_programs (id, nama, deskripsi, kapasitas, syarat_layanan, total_stamps, claim_rule, reward_deskripsi, reward_type, reward_value, warna_tema, is_active, is_default, urutan)
values
  ('CARD_7KG_LEGACY', 'Kartu 7 KG Member Lama (Free ke-10)', 'Aturan member lama: langsung klaim gratis di stempel ke-10', '7kg', 'washer_dryer', 10, 'FREE_ON_NTH', '1x Cuci Gratis 7 KG', 'FREE_SERVICE', 100, 'teal', true, false, 1),
  ('CARD_7KG_NEW', 'Kartu 7 KG Reguler Baru (10 Stamp, ke-11 Free)', 'Aturan baru: 10 stempel penuh dulu, baru transaksi ke-11 gratis', '7kg', 'washer_dryer', 10, 'FREE_ON_NEXT_TRX', '1x Cuci Gratis 7 KG', 'FREE_SERVICE', 100, 'emerald', true, true, 2),
  ('CARD_4KG_STANDARD', 'Kartu 4 KG Standar (10 Stamp, ke-11 Free)', 'Program kartu 4 KG: 10 stempel penuh dulu, transaksi ke-11 gratis', '4kg', 'washer_dryer', 10, 'FREE_ON_NEXT_TRX', '1x Cuci Gratis 4 KG', 'FREE_SERVICE', 100, 'gold', true, true, 3)
on conflict (id) do nothing;

-- ============================================================
-- 4. MASTER MESIN (WASHER & DRYER)
-- ============================================================
create table if not exists mesin (
    id text primary key,
    nama text not null,
    tipe text not null, -- 'Washer', 'Dryer'
    status text not null default 'Siap', -- 'Siap', 'Sedang Jalan', 'Selesai', 'Perawatan', 'Rusak'
    no_nota text,
    nama_pelanggan text,
    layanan text,
    waktu_mulai timestamptz,
    estimasi_selesai timestamptz,
    sisa_waktu_menit int default 0,
    catatan text,
    updated_at timestamptz default now()
);

-- ============================================================
-- 5. KAS SHIFT KASIR
-- ============================================================
create table if not exists kas_shift (
    id_shift text primary key,
    id_outlet text default 'OUTLET-UTAMA',
    nama_kasir text not null,
    id_user text,
    waktu_buka timestamptz not null default now(),
    waktu_tutup timestamptz,
    kas_awal numeric(12, 2) not null default 0,
    saldo_merchant_awal numeric(12, 2) default 0,
    kas_akhir_fisik numeric(12, 2) default 0,
    saldo_merchant_akhir numeric(12, 2) default 0,
    total_penjualan_tunai numeric(12, 2) default 0,
    total_penjualan_non_tunai numeric(12, 2) default 0,
    total_pengeluaran numeric(12, 2) default 0,
    selisih_kas numeric(12, 2) default 0,
    status text not null default 'Buka', -- 'Buka', 'Tutup'
    catatan text,
    nama_pengganti text,
    mode_tutup text,
    created_at timestamptz default now()
);

create index if not exists idx_shift_status on kas_shift(status);

create table if not exists kas_shift_pengeluaran (
    id uuid primary key default gen_random_uuid(),
    id_shift text not null references kas_shift(id_shift) on delete cascade,
    nama text not null,
    nominal numeric(12, 2) not null,
    kategori text,
    foto_url text,
    created_at timestamptz default now()
);

-- ============================================================
-- 6. TRANSAKSI & DETAIL NOTA
-- ============================================================
create table if not exists transaksi (
    no_nota text primary key,
    tanggal timestamptz not null default now(),
    pelanggan_id uuid references pelanggan(id) on delete set null,
    nama_pelanggan text not null,
    no_hp text,
    alamat text,
    is_member boolean default false,
    poin_earned int default 0,
    petugas text not null default 'Kasir',
    id_shift text references kas_shift(id_shift) on delete set null,
    id_outlet text default 'OUTLET-UTAMA',
    tipe text default 'SelfService', -- 'SelfService', 'FullService', 'Retail'
    tingkat_layanan text default 'Reguler', -- 'Reguler', 'Express', 'Kilat'
    subtotal numeric(12, 2) not null default 0,
    diskon numeric(12, 2) not null default 0,
    diskon_kode text,
    voucher text,
    pajak numeric(12, 2) default 0,
    total numeric(12, 2) not null default 0,
    nominal_bayar numeric(12, 2) not null default 0,
    nominal_dp numeric(12, 2) default 0,
    sisa_tagihan numeric(12, 2) default 0,
    metode_bayar text not null default 'Tunai',
    status_pembayaran text not null default 'Lunas', -- 'Lunas', 'DP', 'Belum Bayar'
    referensi_pembayaran text,
    status text not null default 'Selesai', -- 'Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil', 'Selesai', 'Void', 'Batal'
    status_void text default 'None', -- 'None', 'PendingApproval', 'Approved', 'Rejected'
    alasan_void text,
    catatan text,
    estimasi_selesai timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_transaksi_tanggal on transaksi(tanggal desc);
create index if not exists idx_transaksi_status on transaksi(status);
create index if not exists idx_transaksi_nohp on transaksi(no_hp);

create table if not exists transaksi_items (
    id uuid primary key default gen_random_uuid(),
    no_nota text not null references transaksi(no_nota) on delete cascade,
    layanan text not null,
    qty numeric(12, 4) not null default 1,
    harga_satuan numeric(12, 2) not null default 0,
    subtotal numeric(12, 2) not null default 0,
    catatan text,
    id_inventory text references inventory(id) on delete set null,
    inventory_deduction_qty numeric(12, 4) default 1
);

create index if not exists idx_items_nota on transaksi_items(no_nota);

create table if not exists pipeline_steps (
    id uuid primary key default gen_random_uuid(),
    no_nota text not null references transaksi(no_nota) on delete cascade,
    step int not null,
    nama_step text not null,
    status text not null default 'Pending', -- 'Pending', 'Aktif', 'Selesai'
    assigned_staff text,
    mesin_id text,
    waktu_mulai timestamptz,
    waktu_selesai timestamptz
);

create index if not exists idx_pipeline_nota on pipeline_steps(no_nota);

-- ============================================================
-- 7. PROMO & VOUCHER
-- ============================================================
create table if not exists promo (
    id_promo text primary key,
    kode_voucher text not null unique,
    jenis_diskon text not null default 'Persen', -- 'Persen', 'Nominal'
    nilai_diskon numeric(12, 2) not null default 0,
    min_transaksi numeric(12, 2) default 0,
    maks_potongan numeric(12, 2) default 0,
    tgl_mulai date,
    tgl_berakhir date,
    kuota int default 9999,
    dipakai int default 0,
    status_aktif boolean default true
);

-- ============================================================
-- 8. PEGAWAI & KATEGORI MASTER
-- ============================================================
create table if not exists pegawai (
    id text primary key,
    nama text not null,
    no_hp text,
    jabatan text default 'Kasir',
    role text not null default 'STAFF', -- 'STAFF', 'MANAGER'
    status text default 'Aktif',
    nik text,
    nama_panggilan text,
    alamat text,
    shift_utama text,
    tanggal_bergabung date,
    pin_hash text,
    created_at timestamptz default now()
);

create table if not exists master_kategori (
    id text primary key,
    nama text not null unique,
    icon text default 'Folder',
    warna text default 'teal',
    aktif text default 'Y',
    urutan int default 0
);

create table if not exists app_settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz default now()
);

create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    action text not null,
    user_name text not null default 'System',
    detail text,
    payload jsonb,
    created_at timestamptz default now()
);

create index if not exists idx_audit_time on audit_logs(created_at desc);

-- ============================================================
-- 9. STORED PROCEDURES & ATOMIC TRANSACTIONS
-- ============================================================

-- Function 1: Update Stok Inventory Atomik dengan Lock
create or replace function update_stok_inventory(
    p_id text,
    p_delta numeric
)
returns numeric
language plpgsql
as $$
declare
    v_new_stok numeric(12, 4);
begin
    update inventory
    set stok = round((stok + p_delta)::numeric, 4),
        updated_at = now()
    where id = p_id
    returning stok into v_new_stok;

    return coalesce(v_new_stok, 0);
end;
$$;

-- Function 2: Atomik Checkout Transaksi POS
create or replace function checkout_transaksi(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
    v_no_nota text;
    v_item jsonb;
    v_tipe text;
    v_deduct_mult numeric(12, 4);
    v_total_deduct numeric(12, 4);
    v_step record;
    v_pelanggan_id uuid;
    v_poin_rate numeric := 10000;
    v_poin_earned int := 0;
begin
    -- Tentukan Nomor Nota
    v_no_nota := payload->>'noNota';
    if v_no_nota is null or trim(v_no_nota) = '' then
        v_no_nota := 'TRX-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');
    end if;

    v_tipe := coalesce(payload->>'tipe', 'SelfService');

    -- Simpan Header Transaksi
    insert into transaksi (
        no_nota,
        tanggal,
        nama_pelanggan,
        no_hp,
        alamat,
        is_member,
        poin_earned,
        petugas,
        id_shift,
        tipe,
        tingkat_layanan,
        subtotal,
        diskon,
        diskon_kode,
        voucher,
        total,
        nominal_bayar,
        nominal_dp,
        sisa_tagihan,
        metode_bayar,
        status_pembayaran,
        referensi_pembayaran,
        status,
        catatan,
        estimasi_selesai
    ) values (
        v_no_nota,
        coalesce((payload->>'tanggal')::timestamptz, now()),
        coalesce(payload->>'namaPelanggan', 'Pelanggan Umum'),
        payload->>'noHp',
        payload->>'alamat',
        coalesce((payload->>'isMember')::boolean, false),
        coalesce((payload->>'poinEarned')::int, 0),
        coalesce(payload->>'petugas', 'Kasir'),
        payload->>'idShift',
        v_tipe,
        coalesce(payload->>'tingkatLayanan', 'Reguler'),
        coalesce((payload->>'subtotal')::numeric, 0),
        coalesce((payload->>'diskon')::numeric, 0),
        payload->>'diskonKode',
        payload->>'voucher',
        coalesce((payload->>'total')::numeric, 0),
        coalesce((payload->>'nominalBayar')::numeric, (payload->>'total')::numeric, 0),
        coalesce((payload->>'nominalDP')::numeric, 0),
        coalesce((payload->>'sisaTagihan')::numeric, 0),
        coalesce(payload->>'metodeBayar', 'Tunai'),
        coalesce(payload->>'statusPembayaran', 'Lunas'),
        payload->>'referensiPembayaran',
        case when v_tipe = 'FullService' then 'Diterima' else 'Selesai' end,
        payload->>'catatan',
        (payload->>'estimasiSelesai')::timestamptz
    );

    -- Simpan Item Detail & Potong Stok Non-DropOff
    if jsonb_array_length(payload->'items') > 0 then
        for v_item in select * from jsonb_array_elements(payload->'items')
        loop
            insert into transaksi_items (
                no_nota,
                layanan,
                qty,
                harga_satuan,
                subtotal,
                catatan,
                id_inventory,
                inventory_deduction_qty
            ) values (
                v_no_nota,
                v_item->>'layanan',
                coalesce((v_item->>'qty')::numeric, 1),
                coalesce((v_item->>'hargaSatuan')::numeric, 0),
                coalesce((v_item->>'subtotal')::numeric, ((v_item->>'qty')::numeric * (v_item->>'hargaSatuan')::numeric)),
                v_item->>'catatan',
                v_item->>'idInventory',
                coalesce((v_item->>'inventoryDeductionQty')::numeric, 1)
            );

            -- Pemotongan stok langsung untuk Non-DropOff (Self Service / Retail)
            if v_tipe <> 'FullService' and (v_item->>'idInventory') is not null and trim(v_item->>'idInventory') <> '' and trim(v_item->>'idInventory') <> 'none' then
                v_deduct_mult := coalesce((v_item->>'inventoryDeductionQty')::numeric, 1);
                v_total_deduct := round(((v_item->>'qty')::numeric * v_deduct_mult)::numeric, 4);
                perform update_stok_inventory(v_item->>'idInventory', -v_total_deduct);
            end if;
        end loop;
    end if;

    -- Update atau Insert Data Pelanggan jika ada No HP
    if payload->>'noHp' is not null and trim(payload->>'noHp') <> '' then
        insert into pelanggan (nama, no_hp, alamat, total_order)
        values (
            coalesce(payload->>'namaPelanggan', 'Pelanggan'),
            trim(payload->>'noHp'),
            payload->>'alamat',
            1
        )
        on conflict (no_hp) do update
        set total_order = pelanggan.total_order + 1,
            nama = coalesce(excluded.nama, pelanggan.nama),
            updated_at = now()
        returning id into v_pelanggan_id;

        update transaksi set pelanggan_id = v_pelanggan_id where no_nota = v_no_nota;
    end if;

    return jsonb_build_object(
        'success', true,
        'noNota', v_no_nota,
        'total', (payload->>'total')::numeric,
        'message', 'Transaksi berhasil disimpan'
    );
end;
$$;

-- Enable Realtime on core tables
alter publication supabase_realtime add table transaksi;
alter publication supabase_realtime add table pipeline_steps;
alter publication supabase_realtime add table mesin;
alter publication supabase_realtime add table inventory;
