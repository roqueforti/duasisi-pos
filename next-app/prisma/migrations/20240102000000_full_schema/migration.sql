-- =============================================
-- Full schema migration: GAS → PostgreSQL/Supabase
-- Adds missing fields + Pipeline + Absensi + MasterShift
-- =============================================

-- ============ ALTER EXISTING TABLES ============

-- customers: tambah kolom yang ada di GAS tapi belum di schema
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "total_transaksi"  INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_belanja"    DECIMAL     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "terakhir_order"   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "catatan"          TEXT;

-- customers: no_hp harus unique
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_no_hp_key'
  ) THEN
    ALTER TABLE "customers" ADD CONSTRAINT "customers_no_hp_key" UNIQUE ("no_hp");
  END IF;
END $$;

-- employees: tambah kolom aktif
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "aktif" BOOLEAN NOT NULL DEFAULT true;

-- services: tambah kolom aktif
ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "aktif" BOOLEAN NOT NULL DEFAULT true;

-- machines: tambah kolom runtime state
ALTER TABLE "machines"
  ADD COLUMN IF NOT EXISTS "keterangan"       TEXT,
  ADD COLUMN IF NOT EXISTS "mulai_pakai"      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "estimasi_selesai" TEXT;

-- shifts: tambah catatan
ALTER TABLE "shifts"
  ADD COLUMN IF NOT EXISTS "catatan" TEXT;

-- inventory: tambah terakhir_update
ALTER TABLE "inventory"
  ADD COLUMN IF NOT EXISTS "terakhir_update" TIMESTAMPTZ;

-- promos: tambah terpakai counter
ALTER TABLE "promos"
  ADD COLUMN IF NOT EXISTS "terpakai" INTEGER NOT NULL DEFAULT 0;

-- transaction_items: tambah subtotal
ALTER TABLE "transaction_items"
  ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL NOT NULL DEFAULT 0;

-- ============ CREATE NEW TABLES ============

-- master_shifts: template jadwal shift
CREATE TABLE IF NOT EXISTS "master_shifts" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nama_shift"  TEXT        NOT NULL,
    "jam_mulai"   TEXT        NOT NULL,
    "jam_selesai" TEXT        NOT NULL,
    "deskripsi"   TEXT,
    CONSTRAINT "master_shifts_pkey" PRIMARY KEY ("id")
);

-- absensi: clock-in / clock-out pegawai
CREATE TABLE IF NOT EXISTS "absensi" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_pegawai"  UUID        NOT NULL,
    "id_shift"    UUID,
    "nama_shift"  TEXT,
    "tanggal"     DATE        NOT NULL,
    "jam_masuk"   TIMESTAMPTZ,
    "jam_keluar"  TIMESTAMPTZ,
    "status"      TEXT        NOT NULL DEFAULT 'Hadir',
    "catatan"     TEXT,
    CONSTRAINT "absensi_pkey" PRIMARY KEY ("id")
);

-- pipeline_steps: tracking status proses laundry per nota
CREATE TABLE IF NOT EXISTS "pipeline_steps" (
    "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_transaksi"   UUID        NOT NULL,
    "no_nota"        TEXT        NOT NULL,
    "step"           INTEGER     NOT NULL,
    "nama_step"      TEXT        NOT NULL,
    "status"         TEXT        NOT NULL DEFAULT 'Pending',
    "id_pegawai"     UUID,
    "mesin_id"       TEXT,
    "waktu_mulai"    TIMESTAMPTZ,
    "waktu_selesai"  TIMESTAMPTZ,
    "catatan"        TEXT,
    CONSTRAINT "pipeline_steps_pkey" PRIMARY KEY ("id")
);

-- ============ FOREIGN KEYS ============

ALTER TABLE "absensi"
  DROP CONSTRAINT IF EXISTS "absensi_id_pegawai_fkey",
  ADD CONSTRAINT "absensi_id_pegawai_fkey"
    FOREIGN KEY ("id_pegawai") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "absensi"
  DROP CONSTRAINT IF EXISTS "absensi_id_shift_fkey",
  ADD CONSTRAINT "absensi_id_shift_fkey"
    FOREIGN KEY ("id_shift") REFERENCES "master_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pipeline_steps"
  DROP CONSTRAINT IF EXISTS "pipeline_steps_id_transaksi_fkey",
  ADD CONSTRAINT "pipeline_steps_id_transaksi_fkey"
    FOREIGN KEY ("id_transaksi") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pipeline_steps"
  DROP CONSTRAINT IF EXISTS "pipeline_steps_id_pegawai_fkey",
  ADD CONSTRAINT "pipeline_steps_id_pegawai_fkey"
    FOREIGN KEY ("id_pegawai") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS "idx_transactions_tanggal"       ON "transactions"("tanggal" DESC);
CREATE INDEX IF NOT EXISTS "idx_transactions_status"        ON "transactions"("status");
CREATE INDEX IF NOT EXISTS "idx_transactions_id_pelanggan"  ON "transactions"("id_pelanggan");
CREATE INDEX IF NOT EXISTS "idx_transaction_items_transaksi" ON "transaction_items"("id_transaksi");
CREATE INDEX IF NOT EXISTS "idx_pipeline_nota"              ON "pipeline_steps"("no_nota");
CREATE INDEX IF NOT EXISTS "idx_pipeline_transaksi"         ON "pipeline_steps"("id_transaksi");
CREATE INDEX IF NOT EXISTS "idx_absensi_pegawai"            ON "absensi"("id_pegawai");
CREATE INDEX IF NOT EXISTS "idx_absensi_tanggal"            ON "absensi"("tanggal" DESC);
CREATE INDEX IF NOT EXISTS "idx_customers_no_hp"            ON "customers"("no_hp");
CREATE INDEX IF NOT EXISTS "idx_inventory_nama"             ON "inventory"("nama");

-- ============ SEED DATA — LAYANAN DEFAULT ============

INSERT INTO "services" ("id", "nama_layanan", "harga_satuan", "tipe", "satuan", "icon", "kategori", "aktif")
VALUES
  (gen_random_uuid(), 'Cuci 7,5 Kg',                    10000, 'SelfService', 'paket', '🫧', 'Layanan',           true),
  (gen_random_uuid(), 'Cuci 4,5 Kg',                     7000, 'SelfService', 'paket', '🫧', 'Layanan',           true),
  (gen_random_uuid(), 'Cuci + Kering 7,5 Kg (45 Mnt)',  18000, 'SelfService', 'paket', '🧺', 'Layanan',           true),
  (gen_random_uuid(), 'Cuci + Kering 4,5 Kg (45 Mnt)',  13000, 'SelfService', 'paket', '🧺', 'Layanan',           true),
  (gen_random_uuid(), 'Pengering (15 Menit)',             5000, 'SelfService', 'paket', '♨️', 'Layanan',           true),
  (gen_random_uuid(), 'Cuci Lipat',                       7000, 'FullService', 'kg',    '👕', 'Layanan Tambahan',  true),
  (gen_random_uuid(), 'Cuci Setrika',                    10000, 'FullService', 'kg',    '👔', 'Layanan Tambahan',  true),
  (gen_random_uuid(), 'Cuci Setrika Express (6 Jam)',    18000, 'FullService', 'kg',    '⚡', 'Layanan Tambahan',  true),
  (gen_random_uuid(), 'Setrika Saja',                     5000, 'FullService', 'kg',    '🔥', 'Layanan Tambahan',  true),
  (gen_random_uuid(), 'Cuci Bed Cover (Kecil)',          25000, 'FullService', 'paket', '🛏️', 'Layanan Tambahan',  true),
  (gen_random_uuid(), 'Cuci Bed Cover (Besar)',          35000, 'FullService', 'paket', '🛏️', 'Layanan Tambahan',  true),
  (gen_random_uuid(), 'Cuci Karpet /m²',                15000, 'FullService', 'm²',    '🟫', 'Layanan Tambahan',  true),
  (gen_random_uuid(), 'Deterjen Cair',                    1000, 'SelfService', 'porsi', '🧴', 'Produk',            true),
  (gen_random_uuid(), 'Softener',                         1000, 'SelfService', 'porsi', '🌸', 'Produk',            true),
  (gen_random_uuid(), 'Deterjen Sachet',                  1500, 'SelfService', 'sachet','🧴', 'Produk',            true),
  (gen_random_uuid(), 'Softener Sachet',                  1500, 'SelfService', 'sachet','🌸', 'Produk',            true),
  (gen_random_uuid(), 'Kresek Besar',                     1000, 'SelfService', 'pcs',   '🛍️', 'Produk',            true),
  (gen_random_uuid(), 'Air Mineral 600ml',                3000, 'SelfService', 'botol', '💧', 'MakananMinuman',    true),
  (gen_random_uuid(), 'Kopi Hitam / Teh Warm',            4000, 'SelfService', 'cangkir','☕', 'MakananMinuman',   true)
ON CONFLICT DO NOTHING;

-- ============ SEED DATA — MASTER SHIFT ============

INSERT INTO "master_shifts" ("id", "nama_shift", "jam_mulai", "jam_selesai", "deskripsi")
VALUES
  (gen_random_uuid(), 'Shift Pagi',  '07:00', '15:00', 'Shift pagi reguler'),
  (gen_random_uuid(), 'Shift Siang', '11:00', '19:00', 'Shift siang / overlap'),
  (gen_random_uuid(), 'Shift Malam', '15:00', '23:00', 'Shift sore / malam')
ON CONFLICT DO NOTHING;

-- ============ SEED DATA — INVENTORY DEFAULT ============

INSERT INTO "inventory" ("id", "nama", "stok", "satuan", "min_stok")
VALUES
  (gen_random_uuid(), 'Deterjen Cair',     20, 'liter',  5),
  (gen_random_uuid(), 'Softener',          15, 'liter',  3),
  (gen_random_uuid(), 'Deterjen Sachet',  100, 'sachet', 20),
  (gen_random_uuid(), 'Softener Sachet',   80, 'sachet', 20),
  (gen_random_uuid(), 'Plastik Kresek',   200, 'pcs',    50),
  (gen_random_uuid(), 'Plastik Press',    100, 'pcs',    30)
ON CONFLICT DO NOTHING;

-- ============ SEED DATA — PROMO DEFAULT ============

INSERT INTO "promos" ("id", "kode_voucher", "jenis_diskon", "nilai_diskon", "min_transaksi", "status_aktif")
VALUES
  (gen_random_uuid(), 'HEMAT10',   'Persentase', 10, 20000, true),
  (gen_random_uuid(), 'DUASISI',   'Persentase', 10, 0,     true),
  (gen_random_uuid(), 'GRATIS5K',  'Nominal',    5000, 30000, true)
ON CONFLICT DO NOTHING;
