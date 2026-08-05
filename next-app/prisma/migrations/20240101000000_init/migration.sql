-- CreateTable
CREATE TABLE IF NOT EXISTS "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nama" TEXT NOT NULL,
    "jabatan" TEXT NOT NULL,
    "no_hp" TEXT,
    "role" TEXT NOT NULL,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nama" TEXT NOT NULL,
    "no_hp" TEXT NOT NULL,
    "alamat" TEXT,
    "saldo_poin" INTEGER NOT NULL DEFAULT 0,
    "is_blacklist" BOOLEAN NOT NULL DEFAULT false,
    "tanggal_daftar" DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nama_layanan" TEXT NOT NULL,
    "harga_satuan" DECIMAL NOT NULL,
    "tipe" TEXT NOT NULL,
    "satuan" TEXT,
    "icon" TEXT,
    "kategori" TEXT,
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "machines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nama_mesin" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_pegawai" UUID,
    "nama_kasir" TEXT NOT NULL,
    "kas_awal" DECIMAL NOT NULL,
    "kas_akhir" DECIMAL,
    "total_omzet_tunai" DECIMAL,
    "selisih_kas" DECIMAL,
    "status" TEXT NOT NULL,
    "waktu_buka" TIMESTAMPTZ NOT NULL,
    "waktu_tutup" TIMESTAMPTZ,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "promos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kode_voucher" TEXT NOT NULL,
    "jenis_diskon" TEXT NOT NULL,
    "nilai_diskon" DECIMAL NOT NULL,
    "min_transaksi" DECIMAL,
    "periode_selesai" TIMESTAMPTZ,
    "kuota" INTEGER,
    "status_aktif" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "no_nota" TEXT NOT NULL,
    "tanggal" TIMESTAMPTZ NOT NULL,
    "id_pelanggan" UUID,
    "nama_pelanggan" TEXT NOT NULL,
    "no_hp_pelanggan" TEXT,
    "petugas" TEXT NOT NULL,
    "tipe" TEXT NOT NULL,
    "tingkat_layanan" TEXT,
    "subtotal" DECIMAL,
    "diskon" DECIMAL NOT NULL DEFAULT 0,
    "pajak" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "nominal_dp" DECIMAL NOT NULL DEFAULT 0,
    "sisa_tagihan" DECIMAL NOT NULL DEFAULT 0,
    "metode_bayar" TEXT,
    "status" TEXT NOT NULL,
    "status_void" TEXT NOT NULL DEFAULT 'None',
    "alasan_void" TEXT,
    "catatan" TEXT,
    "estimasi_selesai" TIMESTAMPTZ,
    "id_outlet" TEXT,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "transaction_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_transaksi" UUID,
    "id_layanan" UUID,
    "nama_layanan" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL,
    "harga_satuan" DECIMAL NOT NULL,
    "catatan" TEXT,
    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nama" TEXT NOT NULL,
    "stok" DECIMAL NOT NULL,
    "satuan" TEXT NOT NULL,
    "min_stok" DECIMAL NOT NULL,
    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_user" UUID,
    "nama_user" TEXT NOT NULL,
    "jenis_aktivitas" TEXT NOT NULL,
    "referensi" TEXT,
    "detail" TEXT,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "laundry_type" TEXT,
    "pain_points" TEXT[],
    "features" TEXT[],
    "notes" TEXT,
    "version" TEXT DEFAULT 'v2',
    "empathize" TEXT,
    "define" TEXT,
    "ideate" TEXT,
    "prototype" TEXT,
    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "promos_kode_voucher_key" ON "promos"("kode_voucher");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_no_nota_key" ON "transactions"("no_nota");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_id_pegawai_fkey"
    FOREIGN KEY ("id_pegawai") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_id_pelanggan_fkey"
    FOREIGN KEY ("id_pelanggan") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_id_transaksi_fkey"
    FOREIGN KEY ("id_transaksi") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_id_layanan_fkey"
    FOREIGN KEY ("id_layanan") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
