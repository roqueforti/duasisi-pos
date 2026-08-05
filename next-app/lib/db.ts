/**
 * db.ts — Supabase query functions pengganti semua GAS actions
 * Setiap fungsi = 1 action GAS
 */
import { supabase } from './supabase';
import { writeCache, readCache } from './cache';

// ─── PIN / AUTH ───────────────────────────────────────────────────────────────
export async function verifikasiPin(pin: string) {
  if (pin === '8888') return { success: true, role: 'MANAGER', label: 'Manager / Owner' };
  if (pin === '1234') return { success: true, role: 'STAFF',   label: 'Staff / Kasir'  };
  return { success: false, message: 'PIN salah! Akses ditolak.' };
}

// ─── LAYANAN / SERVICE ────────────────────────────────────────────────────────
export async function getLayananListAll() {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('aktif', true)
    .order('kategori')
    .order('nama_layanan');
  if (error) throw error;
  return (data || []).map((s: any) => ({
    id: s.id, nama: s.nama_layanan, harga: Number(s.harga_satuan),
    tipe: s.tipe, satuan: s.satuan, icon: s.icon, kategori: s.kategori, aktif: s.aktif,
  }));
}

export async function tambahLayanan(payload: any) {
  const { data, error } = await supabase.from('services').insert({
    nama_layanan: payload.nama, harga_satuan: payload.harga,
    tipe: payload.tipe || 'SelfService', satuan: payload.satuan,
    icon: payload.icon, kategori: payload.kategori || 'Layanan', aktif: true,
  }).select().single();
  if (error) throw error;
  return { success: true, id: data.id };
}

export async function updateLayanan(id: string, payload: any) {
  const { error } = await supabase.from('services').update({
    nama_layanan: payload.nama, harga_satuan: payload.harga,
    tipe: payload.tipe, satuan: payload.satuan, icon: payload.icon,
  }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function toggleAktifLayanan(id: string, aktif: boolean) {
  const { error } = await supabase.from('services').update({ aktif }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function hapusLayanan(id: string) {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ─── PROMO / VOUCHER ──────────────────────────────────────────────────────────
export async function getPromoList() {
  const { data, error } = await supabase.from('promos').select('*').eq('status_aktif', true);
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id, kodeVoucher: p.kode_voucher, jenisDiskon: p.jenis_diskon,
    nilaiDiskon: Number(p.nilai_diskon), minTransaksi: Number(p.min_transaksi || 0),
    statusAktif: p.status_aktif,
  }));
}

export async function tambahPromo(payload: any) {
  const { error } = await supabase.from('promos').insert({
    kode_voucher: payload.kodeVoucher, jenis_diskon: payload.jenisDiskon || 'Nominal',
    nilai_diskon: payload.nilaiDiskon, min_transaksi: payload.minTransaksi || 0,
    status_aktif: true,
  });
  if (error) throw error;
  return { success: true };
}

export async function hapusPromo(id: string) {
  const { error } = await supabase.from('promos').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function validasiVoucher(kode: string, subtotal: number) {
  const { data, error } = await supabase
    .from('promos').select('*').eq('kode_voucher', kode.toUpperCase())
    .eq('status_aktif', true).single();
  if (error || !data) return { valid: false, message: 'Kode voucher tidak valid' };
  if (data.min_transaksi && subtotal < Number(data.min_transaksi))
    return { valid: false, message: `Minimum transaksi Rp ${Number(data.min_transaksi).toLocaleString('id-ID')}` };
  const nilai = data.jenis_diskon === 'Persentase'
    ? Math.round(subtotal * Number(data.nilai_diskon) / 100)
    : Number(data.nilai_diskon);
  return { valid: true, kode, nilai };
}

// ─── PELANGGAN / CUSTOMER ─────────────────────────────────────────────────────
export async function getDaftarPelanggan() {
  const { data, error } = await supabase
    .from('customers').select('*').order('terakhir_order', { ascending: false });
  if (error) throw error;
  return (data || []).map((c: any) => ({
    noHp: c.no_hp, nama: c.nama, alamat: c.alamat || '',
    tglDaftar: c.tanggal_daftar, totalOrder: c.total_transaksi,
    totalSpend: Number(c.total_belanja), terakhirOrder: c.terakhir_order || '',
    catatan: c.catatan || '', isRepeatOrder: c.total_transaksi > 1,
  }));
}

export async function simpanPelangganJikaBaru(nama: string, noHp: string, alamat?: string) {
  const clean = noHp.replace(/\D/g, '');
  const { data: existing } = await supabase.from('customers').select('id').eq('no_hp', clean).single();
  if (existing) return { success: true, isNew: false };
  const { error } = await supabase.from('customers').insert({
    nama, no_hp: clean, alamat: alamat || '', total_transaksi: 0, total_belanja: 0,
  });
  if (error) throw error;
  return { success: true, isNew: true };
}

export async function updateDataPelanggan(oldHp: string, newHp: string, nama: string, alamat: string, catatan: string) {
  const { error } = await supabase.from('customers')
    .update({ no_hp: newHp.replace(/\D/g, ''), nama, alamat, catatan })
    .eq('no_hp', oldHp.replace(/\D/g, ''));
  if (error) throw error;
  return { success: true, message: 'Data pelanggan berhasil diperbarui!' };
}

export async function getRiwayatPelangganByHp(noHp: string) {
  const clean = noHp.replace(/\D/g, '');
  const { data, error } = await supabase
    .from('transactions').select('*, transaction_items(*)')
    .eq('no_hp_pelanggan', clean).order('tanggal', { ascending: false }).limit(20);
  if (error) throw error;
  return (data || []).map((t: any) => ({
    noNota: t.no_nota, tanggal: t.tanggal, total: Number(t.total),
    status: t.status, tipe: t.tipe,
    items: (t.transaction_items || []).map((i: any) => ({
      layanan: i.nama_layanan, qty: Number(i.qty), subtotal: Number(i.subtotal),
    })),
  }));
}

// ─── TRANSAKSI ────────────────────────────────────────────────────────────────
function generateNoNota() {
  const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `LDY-${today}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
}

export async function simpanTransaksi(payload: any) {
  const noNota = payload.noNota || generateNoNota();
  const { data: tx, error: txErr } = await supabase.from('transactions').insert({
    no_nota: noNota,
    tanggal: new Date().toISOString(),
    nama_pelanggan: payload.namaPelanggan,
    no_hp_pelanggan: payload.noHp || null,
    petugas: payload.kasir || 'Kasir',
    tipe: payload.tipeLayanan || 'SelfService',
    total: payload.total,
    diskon: payload.diskon || 0,
    metode_bayar: payload.metodeBayar,
    status: 'Diterima',
    estimasi_selesai: payload.estimasiSelesai ? new Date(payload.estimasiSelesai).toISOString() : null,
    catatan: payload.catatan || null,
  }).select().single();
  if (txErr) throw txErr;

  if (Array.isArray(payload.items) && payload.items.length > 0) {
    const items = payload.items.map((i: any) => ({
      id_transaksi: tx.id,
      nama_layanan: i.layanan,
      qty: i.qty,
      harga_satuan: i.hargaSatuan,
      subtotal: i.qty * i.hargaSatuan,
    }));
    const { error: itemErr } = await supabase.from('transaction_items').insert(items);
    if (itemErr) console.warn('Items save error:', itemErr);
  }

  // Update stats pelanggan jika ada HP
  if (payload.noHp) {
    const clean = payload.noHp.replace(/\D/g, '');
    try {
      await supabase.rpc('increment_customer_stats', { p_no_hp: clean, p_total: payload.total });
    } catch { /* non-critical */ }
  }

  return { success: true, noNota };
}

export async function getTransaksiList(filter?: string) {
  let q = supabase.from('transactions').select('*, transaction_items(*)').order('tanggal', { ascending: false }).limit(200);
  if (filter && filter !== 'Semua') q = q.eq('status', filter);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((t: any) => ({
    noNota: t.no_nota, tanggal: t.tanggal, namaPelanggan: t.nama_pelanggan,
    noHp: t.no_hp_pelanggan || '', petugas: t.petugas, tipe: t.tipe,
    total: Number(t.total), diskon: Number(t.diskon || 0),
    metodeBayar: t.metode_bayar, status: t.status,
    statusVoid: t.status_void || 'None', alasanVoid: t.alasan_void || '',
    sisaTagihan: Number(t.sisa_tagihan || 0), nominalDP: Number(t.nominal_dp || 0),
    estimasi: t.estimasi_selesai, catatan: t.catatan || '',
    items: (t.transaction_items || []).map((i: any) => ({
      layanan: i.nama_layanan, qty: Number(i.qty), hargaSatuan: Number(i.harga_satuan),
    })),
  }));
}

export async function getTransaksiByNota(noNota: string) {
  const { data, error } = await supabase
    .from('transactions').select('*, transaction_items(*)')
    .eq('no_nota', noNota).single();
  if (error) return { success: false, message: 'Nota tidak ditemukan' };
  return {
    success: true,
    transaksi: {
      noNota: data.no_nota, tanggal: data.tanggal,
      namaPelanggan: data.nama_pelanggan, noHp: data.no_hp_pelanggan || '',
      petugas: data.petugas, tipe: data.tipe, total: Number(data.total),
      diskon: Number(data.diskon || 0), metodeBayar: data.metode_bayar,
      status: data.status, catatan: data.catatan || '',
      items: (data.transaction_items || []).map((i: any) => ({
        layanan: i.nama_layanan, qty: Number(i.qty), hargaSatuan: Number(i.harga_satuan),
      })),
    },
  };
}

export async function updateStatus(noNota: string, status: string) {
  const { error } = await supabase.from('transactions').update({ status }).eq('no_nota', noNota);
  if (error) throw error;
  return { success: true };
}

export async function ajukanVoidTransaksi(noNota: string, alasan: string, namaKasir: string) {
  const { error } = await supabase.from('transactions')
    .update({ status_void: 'PendingApproval', alasan_void: alasan }).eq('no_nota', noNota);
  if (error) throw error;
  return { success: true };
}

export async function approveVoidTransaksi(noNota: string, isApproved: boolean, namaManager: string) {
  const statusVoid = isApproved ? 'Approved' : 'Rejected';
  const status = isApproved ? 'Batal' : undefined;
  const upd: any = { status_void: statusVoid };
  if (status) upd.status = status;
  const { error } = await supabase.from('transactions').update(upd).eq('no_nota', noNota);
  if (error) throw error;
  return { success: true };
}

export async function pelunasanDP(noNota: string, nominal: number, metode: string) {
  const { data: tx } = await supabase.from('transactions').select('sisa_tagihan').eq('no_nota', noNota).single();
  const sisaBaru = Math.max(0, Number(tx?.sisa_tagihan || 0) - nominal);
  const { error } = await supabase.from('transactions').update({
    sisa_tagihan: sisaBaru, metode_bayar: metode,
    status: sisaBaru <= 0 ? 'Selesai' : undefined,
  }).eq('no_nota', noNota);
  if (error) throw error;
  return { success: true };
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
export async function getInventoryList() {
  const { data, error } = await supabase.from('inventory').select('*').order('nama');
  if (error) throw error;
  return (data || []).map((i: any) => ({
    id: i.id, nama: i.nama, stok: Number(i.stok), satuan: i.satuan,
    stokMinimum: Number(i.min_stok),
    terakhirUpdate: i.terakhir_update || '',
  }));
}

export async function tambahInventory(payload: any) {
  const { data, error } = await supabase.from('inventory').insert({
    nama: payload.nama, stok: payload.stok, satuan: payload.satuan,
    min_stok: payload.stokMinimum, terakhir_update: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return { success: true, id: data.id };
}

export async function updateStokInventory(id: string, delta: number) {
  const { data: inv } = await supabase.from('inventory').select('stok').eq('id', id).single();
  const stokBaru = Math.max(0, Number(inv?.stok || 0) + delta);
  const { error } = await supabase.from('inventory').update({
    stok: stokBaru, terakhir_update: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
  return { success: true, stokBaru };
}

export async function hapusInventory(id: string) {
  const { error } = await supabase.from('inventory').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ─── MESIN ────────────────────────────────────────────────────────────────────
export async function getMesinList() {
  const { data, error } = await supabase.from('machines').select('*').order('nama_mesin');
  if (error) throw error;
  return (data || []).map((m: any) => ({
    id: m.id, nama: m.nama_mesin, tipe: m.tipe, status: m.status,
    keterangan: m.keterangan || '',
    mulaiPakai: m.mulai_pakai ? new Date(m.mulai_pakai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '',
    estimasiSelesai: m.estimasi_selesai || '',
  }));
}

export async function tambahMesin(payload: any) {
  const { data, error } = await supabase.from('machines').insert({
    nama_mesin: payload.nama, tipe: payload.tipe || 'Washer', status: 'Kosong',
  }).select().single();
  if (error) throw error;
  return { success: true, id: data.id };
}

export async function mulaiPakaiMesin(id: string, keterangan: string, estimasiSelesai: string) {
  const { error } = await supabase.from('machines').update({
    status: 'Digunakan', keterangan,
    mulai_pakai: new Date().toISOString(), estimasi_selesai: estimasiSelesai,
  }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function selesaiMesin(id: string) {
  const { error } = await supabase.from('machines').update({
    status: 'Kosong', keterangan: null, mulai_pakai: null, estimasi_selesai: null,
  }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function setMaintenanceMesin(id: string, aktifkan: boolean) {
  const { error } = await supabase.from('machines').update({
    status: aktifkan ? 'Maintenance' : 'Kosong',
    keterangan: aktifkan ? 'Perbaikan/servis' : null,
  }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function hapusMesin(id: string) {
  const { error } = await supabase.from('machines').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ─── PEGAWAI ──────────────────────────────────────────────────────────────────
export async function getPegawaiList() {
  const { data, error } = await supabase.from('employees').select('*').eq('aktif', true).order('nama');
  if (error) throw error;
  return (data || []).map((e: any) => ({
    id: e.id, nama: e.nama, jabatan: e.jabatan, noHp: e.no_hp || '', role: e.role,
  }));
}

export async function tambahPegawai(payload: any) {
  const { error } = await supabase.from('employees').insert({
    nama: payload.nama, jabatan: payload.jabatan,
    no_hp: payload.noHp || null, role: payload.role || 'STAFF', aktif: true,
  });
  if (error) throw error;
  return { success: true };
}

export async function hapusPegawai(id: string) {
  const { error } = await supabase.from('employees').update({ aktif: false }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function getRekapKinerjaPegawai() {
  const { data, error } = await supabase
    .from('transactions').select('petugas').order('petugas');
  if (error) throw error;
  const counts: Record<string, number> = {};
  (data || []).forEach((t: any) => { counts[t.petugas] = (counts[t.petugas] || 0) + 1; });
  return Object.entries(counts).map(([nama, jumlah]) => ({ nama, jumlah }));
}

// ─── ABSENSI ──────────────────────────────────────────────────────────────────
export async function getRekapAbsensi(bulan?: string) {
  let q = supabase.from('absensi').select('*, employees(nama, jabatan)').order('tanggal', { ascending: false });
  if (bulan) q = q.gte('tanggal', `${bulan}-01`).lte('tanggal', `${bulan}-31`);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((a: any) => ({
    id: a.id, idPegawai: a.id_pegawai,
    namaPegawai: a.employees?.nama || '', jabatan: a.employees?.jabatan || '',
    tanggal: a.tanggal, namaShift: a.nama_shift || '',
    jamMasuk: a.jam_masuk || '', jamKeluar: a.jam_keluar || '',
    status: a.status, catatan: a.catatan || '',
  }));
}

export async function getMasterShift() {
  const { data, error } = await supabase.from('master_shifts').select('*').order('jam_mulai');
  if (error) throw error;
  return (data || []).map((s: any) => ({
    id: s.id, namaShift: s.nama_shift, jamMulai: s.jam_mulai,
    jamSelesai: s.jam_selesai, deskripsi: s.deskripsi || '',
  }));
}

export async function clockInPegawai(idPegawai: string, idShift?: string, namaShift?: string) {
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('absensi').insert({
    id_pegawai: idPegawai, id_shift: idShift || null,
    nama_shift: namaShift || '', tanggal: today,
    jam_masuk: new Date().toISOString(), status: 'Hadir',
  });
  if (error) throw error;
  return { success: true };
}

export async function clockOutPegawai(idPegawai: string) {
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('absensi')
    .update({ jam_keluar: new Date().toISOString() })
    .eq('id_pegawai', idPegawai).eq('tanggal', today).is('jam_keluar', null);
  if (error) throw error;
  return { success: true };
}

// ─── LAPORAN / REKAP ──────────────────────────────────────────────────────────
export async function getLaporanRange(startDate: string, endDate: string) {
  const { data, error } = await supabase.from('transactions')
    .select('*, transaction_items(*)')
    .gte('tanggal', `${startDate}T00:00:00`)
    .lte('tanggal', `${endDate}T23:59:59`)
    .neq('status', 'Batal');
  if (error) throw error;
  const txs = data || [];
  const totalOmzet = txs.reduce((s: number, t: any) => s + Number(t.total), 0);
  const jumlahTransaksi = txs.length;
  const omzetByDate: Record<string, number> = {};
  txs.forEach((t: any) => {
    const d = t.tanggal?.split('T')[0] || '';
    omzetByDate[d] = (omzetByDate[d] || 0) + Number(t.total);
  });
  const omzetHarian = Object.entries(omzetByDate)
    .map(([tanggal, omzet]) => ({ tanggal, omzet, jumlahTransaksi: txs.filter((t: any) => t.tanggal?.startsWith(tanggal)).length }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const layananCount: Record<string, { qty: number; omzet: number }> = {};
  txs.forEach((t: any) => (t.transaction_items || []).forEach((i: any) => {
    const k = i.nama_layanan;
    if (!layananCount[k]) layananCount[k] = { qty: 0, omzet: 0 };
    layananCount[k].qty += Number(i.qty);
    layananCount[k].omzet += Number(i.subtotal);
  }));
  const layananTerlaris = Object.entries(layananCount)
    .map(([layanan, v]) => ({ layanan, ...v }))
    .sort((a, b) => b.omzet - a.omzet).slice(0, 5);
  return {
    ringkasan: { totalOmzet, jumlahTransaksi, rataRata: jumlahTransaksi ? Math.round(totalOmzet / jumlahTransaksi) : 0,
      selfCount: txs.filter((t: any) => t.tipe === 'SelfService').length,
      fullCount: txs.filter((t: any) => t.tipe === 'FullService').length },
    omzetHarian, layananTerlaris,
  };
}

export async function getAuditLogs() {
  const { data, error } = await supabase.from('audit_logs')
    .select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []).map((l: any) => ({
    id: l.id, namaUser: l.nama_user, jenisAktivitas: l.jenis_aktivitas,
    referensi: l.referensi || '', detail: l.detail || '', waktu: l.created_at,
  }));
}
