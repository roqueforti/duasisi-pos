import { getSupabase } from './supabaseClient';
import { LayananItem, InventoryItem, Transaksi, ShiftKasir, Mesin } from './types';

// ============================================================
// INVENTORY
// ============================================================
export async function sbGetInventoryList(): Promise<InventoryItem[]> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('inventory')
    .select('*')
    .order('nama', { ascending: true });

  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    nama: row.nama,
    stok: Number(row.stok) || 0,
    satuan: row.satuan,
    stokMinimum: Number(row.stok_minimum) || 0,
    isDijual: row.is_dijual,
    hargaJual: Number(row.harga_jual) || 0,
    kategori: row.kategori_layanan,
  }));
}

export async function sbUpdateStokInventory(id: string, delta: number): Promise<{ success: boolean; stokBaru?: number }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb.rpc('update_stok_inventory', {
    p_id: id,
    p_delta: delta,
  });

  if (error) throw error;
  return { success: true, stokBaru: Number(data) };
}

export async function sbTambahInventory(item: Partial<InventoryItem> & { isDijual?: boolean; hargaJual?: number; kategoriLayanan?: string }) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const id = item.id || `INV-${Date.now()}`;
  const { data, error } = await sb
    .from('inventory')
    .insert({
      id,
      nama: item.nama,
      stok: item.stok || 0,
      satuan: item.satuan || 'unit',
      stok_minimum: item.stokMinimum || 0,
      is_dijual: Boolean(item.isDijual),
      harga_jual: item.hargaJual || 0,
      kategori_layanan: item.kategoriLayanan,
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbUpdateInventoryItem(id: string, item: Partial<InventoryItem>) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('inventory')
    .update({
      nama: item.nama,
      stok: item.stok,
      satuan: item.satuan,
      stok_minimum: item.stokMinimum,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbHapusInventory(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb.from('inventory').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================
// LAYANAN & RESEP BAHAN BAKU (BOM)
// ============================================================
export async function sbGetLayananListAll(): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: layananList, error: layError } = await sb
    .from('layanan')
    .select('*')
    .order('nama', { ascending: true });

  if (layError) throw layError;

  const { data: bomList, error: bomError } = await sb
    .from('layanan_bahan_baku')
    .select('*');

  if (bomError) throw bomError;

  const bomMap = new Map<string, any[]>();
  (bomList || []).forEach((b: any) => {
    const list = bomMap.get(b.layanan_id) || [];
    list.push({
      idInventory: b.inventory_id,
      qty: Number(b.qty) || 1,
      tahap: b.tahap || 'Dicuci',
    });
    bomMap.set(b.layanan_id, list);
  });

  return (layananList || []).map((row: any) => ({
    id: row.id,
    kode: row.id,
    nama: row.nama,
    harga: Number(row.harga) || 0,
    satuan: row.satuan,
    icon: row.icon,
    tipe: row.tipe,
    kategori: row.kategori,
    kategoriDropOff: row.kategori_drop_off,
    kategoriWarna: row.kategori_warna,
    kategoriIcon: row.kategori_icon,
    idInventory: row.id_inventory,
    inventoryDeductionQty: Number(row.inventory_deduction_qty) || 1,
    hargaModal: Number(row.harga_modal) || 0,
    aktif: row.aktif || 'Y',
    bahanBakuList: bomMap.get(row.id) || [],
  }));
}

export async function sbTambahLayanan(payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const id = (payload.kode || payload.id || `LAY-${Date.now()}`).trim();
  const { error: layErr } = await sb.from('layanan').insert({
    id,
    nama: payload.nama,
    harga: payload.harga || 0,
    satuan: payload.satuan || 'paket',
    icon: payload.icon || 'Package',
    tipe: payload.tipe || 'SelfService',
    kategori: payload.kategori || 'Self Service',
    kategori_drop_off: payload.kategoriDropOff || null,
    kategori_warna: payload.kategoriWarna || null,
    kategori_icon: payload.kategoriIcon || null,
    id_inventory: payload.idInventory && payload.idInventory !== 'none' ? payload.idInventory : null,
    inventory_deduction_qty: payload.inventoryDeductionQty || 1,
    harga_modal: payload.hargaModal || 0,
    aktif: 'Y',
  });

  if (layErr) throw layErr;

  if (Array.isArray(payload.bahanBakuList) && payload.bahanBakuList.length > 0) {
    const bomRows = payload.bahanBakuList
      .filter((b: any) => b.idInventory && b.idInventory !== 'none')
      .map((b: any) => ({
        layanan_id: id,
        inventory_id: b.idInventory,
        qty: b.qty || 1,
        tahap: b.tahap || 'Dicuci',
      }));

    if (bomRows.length > 0) {
      await sb.from('layanan_bahan_baku').insert(bomRows);
    }
  }

  return { success: true, id };
}

export async function sbUpdateLayanan(id: string, payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error: layErr } = await sb
    .from('layanan')
    .update({
      nama: payload.nama,
      harga: payload.harga,
      satuan: payload.satuan,
      icon: payload.icon,
      tipe: payload.tipe,
      kategori: payload.kategori,
      kategori_drop_off: payload.kategoriDropOff || null,
      kategori_warna: payload.kategoriWarna || null,
      kategori_icon: payload.kategoriIcon || null,
      id_inventory: payload.idInventory && payload.idInventory !== 'none' ? payload.idInventory : null,
      inventory_deduction_qty: payload.inventoryDeductionQty || 1,
      harga_modal: payload.hargaModal || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (layErr) throw layErr;

  await sb.from('layanan_bahan_baku').delete().eq('layanan_id', id);

  if (Array.isArray(payload.bahanBakuList) && payload.bahanBakuList.length > 0) {
    const bomRows = payload.bahanBakuList
      .filter((b: any) => b.idInventory && b.idInventory !== 'none')
      .map((b: any) => ({
        layanan_id: id,
        inventory_id: b.idInventory,
        qty: b.qty || 1,
        tahap: b.tahap || 'Dicuci',
      }));

    if (bomRows.length > 0) {
      await sb.from('layanan_bahan_baku').insert(bomRows);
    }
  }

  return { success: true, id };
}

export async function sbHapusLayanan(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb.from('layanan').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================
// PELANGGAN
// ============================================================
export async function sbGetDaftarPelanggan(): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('pelanggan')
    .select('*')
    .order('nama', { ascending: true });

  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    nama: c.nama,
    noHp: c.no_hp,
    alamat: c.alamat,
    isMember: c.is_member,
    saldoPoin: c.saldo_poin,
    totalOrder: c.total_order,
    stamps75: c.stamps_75,
    stamps45: c.stamps_45,
    assignedCard7kgId: c.assigned_card_7kg_id || 'CARD_7KG_LEGACY',
    assignedCard4kgId: c.assigned_card_4kg_id || 'CARD_4KG_STANDARD',
    rewardReady7kg: Boolean(c.reward_ready_7kg),
    rewardReady4kg: Boolean(c.reward_ready_4kg),
  }));
}

export async function sbSimpanPelangganJikaBaru(nama: string, noHp: string, alamat = ''): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const cleanHp = (noHp || '').trim();
  if (!cleanHp) return { success: false, message: 'No HP wajib' };

  const { data, error } = await sb
    .from('pelanggan')
    .upsert(
      {
        nama: (nama || 'Pelanggan').trim(),
        no_hp: cleanHp,
        alamat: alamat.trim() || null,
      },
      { onConflict: 'no_hp' }
    )
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

// ============================================================
// TRANSAKSI & CHECKOUT
// ============================================================
export async function sbSimpanTransaksi(payload: any): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb.rpc('checkout_transaksi', {
    payload,
  });

  if (error) throw error;
  return data;
}

export async function sbGetTransaksiList(limit = 100): Promise<Transaksi[]> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: trxList, error } = await sb
    .from('transaksi')
    .select(`
      *,
      transaksi_items (*),
      pipeline_steps (*)
    `)
    .order('tanggal', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (trxList || []).map((t: any) => ({
    noNota: t.no_nota,
    tanggal: t.tanggal,
    namaPelanggan: t.nama_pelanggan,
    noHp: t.no_hp,
    alamat: t.alamat,
    isMember: t.is_member,
    poinEarned: t.poin_earned,
    petugas: t.petugas,
    tipe: t.tipe,
    tingkatLayanan: t.tingkat_layanan,
    subtotal: Number(t.subtotal) || 0,
    diskon: Number(t.diskon) || 0,
    diskonKode: t.diskon_kode,
    voucher: t.voucher,
    total: Number(t.total) || 0,
    nominalDP: Number(t.nominal_dp) || 0,
    sisaTagihan: Number(t.sisa_tagihan) || 0,
    metodeBayar: t.metode_bayar,
    statusPembayaran: t.status_pembayaran,
    referensiPembayaran: t.referensi_pembayaran,
    status: t.status,
    statusVoid: t.status_void,
    alasanVoid: t.alasan_void,
    catatan: t.catatan,
    estimasiSelesai: t.estimasi_selesai,
    items: (t.transaksi_items || []).map((it: any) => ({
      layanan: it.layanan,
      qty: Number(it.qty) || 1,
      hargaSatuan: Number(it.harga_satuan) || 0,
      subtotal: Number(it.subtotal) || 0,
      idInventory: it.id_inventory,
      inventoryDeductionQty: Number(it.inventory_deduction_qty) || 1,
    })),
    pipeline: (t.pipeline_steps || []).map((p: any) => ({
      id: p.id,
      noNota: p.no_nota,
      step: p.step,
      namaStep: p.nama_step,
      status: p.status,
      assignedStaff: p.assigned_staff,
      mesinId: p.mesin_id,
      waktuMulai: p.waktu_mulai,
      waktuSelesai: p.waktu_selesai,
    })),
  }));
}

export async function sbUpdateDropoffStatus(noNota: string, newStatus: string, petugas = 'Kasir'): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error: trxErr } = await sb
    .from('transaksi')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('no_nota', noNota);

  if (trxErr) throw trxErr;

  // Jika masuk ke status 'Dicuci', otomatis potong stok bahan baku layanan
  if (newStatus === 'Dicuci') {
    const { data: items } = await sb
      .from('transaksi_items')
      .select('layanan, qty, id_inventory, inventory_deduction_qty')
      .eq('no_nota', noNota);

    if (items && items.length > 0) {
      for (const it of items) {
        // Cari resep BOM layanan
        const { data: lay } = await sb.from('layanan').select('id').ilike('nama', it.layanan).single();
        if (lay) {
          const { data: boms } = await sb.from('layanan_bahan_baku').select('inventory_id, qty').eq('layanan_id', lay.id);
          if (boms && boms.length > 0) {
            for (const b of boms) {
              const totalDeduct = Math.round((Number(it.qty) * Number(b.qty)) * 10000) / 10000;
              await sbUpdateStokInventory(b.inventory_id, -totalDeduct);
            }
          }
        }
      }
    }
  }

  return { success: true, newStatus };
}

// ============================================================
// MESIN & SHIFT
// ============================================================
export async function sbGetMesinList(): Promise<Mesin[]> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb.from('mesin').select('*').order('nama', { ascending: true });
  if (error) throw error;
  return (data || []).map((m: any) => ({
    id: m.id,
    nama: m.nama,
    tipe: m.tipe,
    status: m.status,
    sisaWaktuMenit: m.sisa_waktu_menit || 0,
    noNota: m.no_nota,
    namaPelanggan: m.nama_pelanggan,
    layanan: m.layanan,
    catatan: m.catatan,
  }));
}

export async function sbGetKasShiftAktif(outletId = 'OUTLET-UTAMA'): Promise<ShiftKasir | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('kas_shift')
    .select('*')
    .eq('id_outlet', outletId)
    .eq('status', 'Buka')
    .order('waktu_buka', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    idShift: data.id_shift,
    idOutlet: data.id_outlet,
    namaKasir: data.nama_kasir,
    idUser: data.id_user || 'USER-1',
    waktuBuka: data.waktu_buka,
    kasAwal: Number(data.kas_awal) || 0,
    saldoMerchantAwal: Number(data.saldo_merchant_awal) || 0,
    kasAkhir: Number(data.kas_akhir_fisik) || 0,
    totalOmzetTunai: Number(data.total_penjualan_tunai) || 0,
    totalOmzetMerchant: Number(data.total_penjualan_non_tunai) || 0,
    nominalBelanja: Number(data.total_pengeluaran) || 0,
    selisihKas: Number(data.selisih_kas) || 0,
    status: data.status,
  };
}

export async function sbOpenKasShift(payload: any): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const idShift = payload.idShift || `SHIFT-${Date.now()}`;
  const { data, error } = await sb.from('kas_shift').insert({
    id_shift: idShift,
    nama_kasir: payload.namaKasir || 'Kasir',
    kas_awal: Number(payload.kasAwal) || 0,
    saldo_merchant_awal: Number(payload.saldoMerchantAwal) || 0,
    status: 'Buka',
  }).select().single();

  if (error) throw error;
  return { success: true, shift: data };
}

export async function sbCloseKasShift(payload: any): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('kas_shift')
    .update({
      waktu_tutup: new Date().toISOString(),
      kas_akhir_fisik: Number(payload.kasAkhirFisik) || 0,
      saldo_merchant_akhir: Number(payload.saldoMerchantAkhir) || 0,
      total_pengeluaran: Number(payload.totalPengeluaran) || 0,
      selisih_kas: Number(payload.selisihKas) || 0,
      status: 'Tutup',
      catatan: payload.catatan || null,
      mode_tutup: payload.mode || 'TUTUP_HARIAN',
      nama_pengganti: payload.namaPengganti || null,
    })
    .eq('id_shift', payload.idShift)
    .select()
    .single();

  if (error) throw error;
  return { success: true, shift: data };
}

export async function sbGetPromoList(): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.from('promo').select('*').order('min_transaksi', { ascending: true });
  if (error) return [];
  return (data || []).map((p: any) => ({
    idPromo: p.id_promo,
    kodeVoucher: p.kode_voucher,
    jenisDiskon: p.jenis_diskon,
    nilaiDiskon: Number(p.nilai_diskon) || 0,
    minTransaksi: Number(p.min_transaksi) || 0,
    maksPotongan: Number(p.maks_potongan) || 0,
    statusAktif: p.status_aktif,
  }));
}

export async function sbGetKategoriList(): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb.from('master_kategori').select('*').order('urutan', { ascending: true });
  if (error) return [];
  return (data || []).map((k: any) => ({
    id: k.id,
    nama: k.nama,
    icon: k.icon,
    warna: k.warna,
    aktif: k.aktif,
  }));
}

// ============================================================
// LOYALTY CARD PROGRAMS
// ============================================================
export async function sbGetLoyaltyPrograms(): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('loyalty_programs')
    .select('*')
    .order('urutan', { ascending: true });

  if (error || !data) return [];
  return data.map((p: any) => ({
    id: p.id,
    nama: p.nama,
    deskripsi: p.deskripsi,
    kapasitas: p.kapasitas,
    syaratLayanan: p.syarat_layanan,
    totalStamps: Number(p.total_stamps) || 10,
    claimRule: p.claim_rule,
    rewardDeskripsi: p.reward_deskripsi,
    rewardType: p.reward_type,
    rewardValue: Number(p.reward_value) || 100,
    warnaTema: p.warna_tema,
    isActive: Boolean(p.is_active),
    isDefault: Boolean(p.is_default),
    urutan: Number(p.urutan) || 1,
  }));
}

export async function sbSaveLoyaltyProgram(program: any): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const payload = {
    id: program.id,
    nama: program.nama,
    deskripsi: program.deskripsi || null,
    kapasitas: program.kapasitas || '7kg',
    syarat_layanan: program.syaratLayanan || 'washer_dryer',
    total_stamps: Number(program.totalStamps) || 10,
    claim_rule: program.claimRule || 'FREE_ON_NEXT_TRX',
    reward_deskripsi: program.rewardDeskripsi || '1x Cuci Gratis',
    reward_type: program.rewardType || 'FREE_SERVICE',
    reward_value: Number(program.rewardValue) || 100,
    warna_tema: program.warnaTema || 'teal',
    is_active: program.isActive !== false,
    is_default: Boolean(program.isDefault),
    urutan: Number(program.urutan) || 1,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb.from('loyalty_programs').upsert(payload, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return { success: true, data };
}

export async function sbDeleteLoyaltyProgram(id: string): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb.from('loyalty_programs').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function sbAssignCustomerLoyalty(noHp: string, cardType: '75' | '45', programId: string): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const field = cardType === '45' ? 'assigned_card_4kg_id' : 'assigned_card_7kg_id';
  const { error } = await sb
    .from('pelanggan')
    .update({ [field]: programId, updated_at: new Date().toISOString() })
    .eq('no_hp', noHp);

  if (error) throw error;
  return { success: true };
}

// ============================================================
// REKAP KAS SHIFT & PEGAWAI
// ============================================================
export async function sbGetRekapKasShift(): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('kas_shift')
    .select('*')
    .order('waktu_buka', { ascending: false });

  if (error) return [];
  return (data || []).map((s: any) => ({
    idShift: s.id_shift,
    idOutlet: s.id_outlet,
    namaKasir: s.nama_kasir,
    idUser: s.id_user,
    waktuBuka: s.waktu_buka,
    waktuTutup: s.waktu_tutup,
    kasAwal: Number(s.kas_awal) || 0,
    kasAkhirSistem: Number(s.kas_akhir_fisik) || 0,
    kasAkhirFisik: Number(s.kas_akhir_fisik) || 0,
    selisihKas: Number(s.selisih_kas) || 0,
    status: s.status === 'Tutup' ? 'Ditutup' : s.status,
    modeTutup: s.mode_tutup,
    namaPengganti: s.nama_pengganti,
    catatan: s.catatan,
    saldoMerchantAwal: Number(s.saldo_merchant_awal) || 0,
    saldoMerchantAkhir: Number(s.saldo_merchant_akhir) || 0,
    totalBelanja: Number(s.total_pengeluaran) || 0,
  }));
}

export async function sbGetPegawaiList(): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('pegawai')
    .select('*')
    .order('nama', { ascending: true });

  if (error) return [];
  return (data || []).map((p: any) => ({
    id: p.id,
    nama: p.nama,
    noHp: p.no_hp,
    jabatan: p.jabatan,
    status: p.status,
    role: p.role,
    nik: p.nik,
    namaPanggilan: p.nama_panggilan,
    alamat: p.alamat,
    shiftUtama: p.shift_utama,
    tanggalBergabung: p.tanggal_bergabung,
  }));
}

