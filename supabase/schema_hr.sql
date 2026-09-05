-- ============================================================
-- DUA SISI POS LAUNDRY — SUPABASE DATABASE SCHEMA (MODUL HR)
-- Version: 3.1 (HR, Absensi, Roster, Cuti, & Payroll)
-- ============================================================

-- Enable UUID extension if not yet enabled
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. TABEL ABSENSI & KEHADIRAN
-- ============================================================
create table if not exists absensi (
    id text primary key,
    tanggal date not null default current_date,
    id_pegawai text,
    nama_pegawai text not null,
    shift text not null default 'Pagi',
    clock_in timestamptz not null default now(),
    clock_out timestamptz,
    durasi text,
    catatan text,
    menit_telat int default 0,
    denda numeric(12, 2) default 0,
    created_at timestamptz default now()
);

create index if not exists idx_absensi_tanggal on absensi(tanggal);
create index if not exists idx_absensi_pegawai on absensi(nama_pegawai);
create index if not exists idx_absensi_id_pegawai on absensi(id_pegawai);

-- ============================================================
-- 2. TABEL JADWAL KERJA PEGAWAI (ROSTER)
-- ============================================================
create table if not exists jadwal_kerja (
    id text primary key,
    id_pegawai text not null,
    nama_pegawai text not null,
    tanggal date not null,
    hari text,
    shift text default 'Shift 1 (Pagi)',
    status text default 'Masuk', -- 'Masuk', 'Libur', 'Cuti', 'Tukar Shift'
    catatan text,
    created_at timestamptz default now(),
    unique(id_pegawai, tanggal)
);

create index if not exists idx_jadwal_tanggal on jadwal_kerja(tanggal);
create index if not exists idx_jadwal_pegawai on jadwal_kerja(id_pegawai);

-- ============================================================
-- 3. TABEL MANAJEMEN CUTI & IZIN
-- ============================================================
create table if not exists cuti (
    id text primary key,
    id_pegawai text,
    nama_pegawai text not null,
    jenis_cuti text not null default 'Cuti Tahunan',
    tgl_mulai date not null,
    tgl_selesai date not null,
    jumlah_hari int not null default 1,
    alasan text,
    status text not null default 'Disetujui', -- 'Disetujui', 'Pending', 'Ditolak'
    waktu_pengajuan timestamptz default now(),
    disetujui_oleh text
);

create index if not exists idx_cuti_pegawai on cuti(id_pegawai);
create index if not exists idx_cuti_status on cuti(status);
create index if not exists idx_cuti_tgl_mulai on cuti(tgl_mulai);

-- ============================================================
-- 4. TABEL HARI LIBUR (NASIONAL & OUTLET)
-- ============================================================
create table if not exists hari_libur (
    id text primary key,
    tanggal date not null,
    nama_libur text not null,
    kategori text default 'Libur Nasional', -- 'Libur Nasional', 'Libur Outlet'
    keterangan text,
    created_at timestamptz default now()
);

create index if not exists idx_libur_tanggal on hari_libur(tanggal);

-- ============================================================
-- 5. TABEL PAYROLL (RIWAYAT & STATUS PEMBAYARAN GAJI)
-- ============================================================
create table if not exists payroll (
    id text primary key,
    periode text not null, -- 'YYYY-MM'
    id_pegawai text not null,
    nama_pegawai text not null,
    jabatan text,
    gaji_pokok numeric(12, 2) default 0,
    tunjangan numeric(12, 2) default 0,
    bonus_komisi numeric(12, 2) default 0,
    potongan numeric(12, 2) default 0,
    total_gaji_bersih numeric(12, 2) default 0,
    jumlah_hadir int default 0,
    jumlah_telat int default 0,
    total_jam_kerja numeric(8, 1) default 0,
    status_pembayaran text default 'Sudah Dibayar', -- 'Sudah Dibayar', 'Belum Dibayar'
    tanggal_pembayaran timestamptz default now(),
    metode_pembayaran text default 'Transfer',
    catatan text,
    created_at timestamptz default now(),
    unique(periode, id_pegawai)
);

create index if not exists idx_payroll_periode on payroll(periode);
create index if not exists idx_payroll_pegawai on payroll(id_pegawai);

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- Dinonaktifkan untuk POS Terminal dengan proteksi PIN level aplikasi
-- ============================================================
alter table if exists absensi disable row level security;
alter table if exists jadwal_kerja disable row level security;
alter table if exists cuti disable row level security;
alter table if exists hari_libur disable row level security;
alter table if exists payroll disable row level security;

-- Enable Realtime
alter publication supabase_realtime add table absensi;
alter publication supabase_realtime add table jadwal_kerja;
alter publication supabase_realtime add table cuti;
alter publication supabase_realtime add table hari_libur;
alter publication supabase_realtime add table payroll;
