import { getSupabase } from './supabaseClient';
import { LayananItem, InventoryItem, Transaksi, ShiftKasir, Mesin, AuditLog, DropoffIncentiveConfig } from './types';
import { formatDateTime, parseIndonesianDateTime, normalizePhone, maskPhone, maskName, decodeNotaToken } from './utils';

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

export async function sbHapusInventory(id: string, actor?: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  // 1. Ambil data item sebelum dihapus untuk diarsipkan (Soft Delete)
  const { data: item, error: fetchErr } = await sb
    .from('inventory')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!item) return { success: false, message: 'Item tidak ditemukan' };

  // 2. Simpan ke arsip sampah di app_settings
  const { data: curTrash } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'inventory_trash')
    .maybeSingle();

  const trashList: any[] = Array.isArray(curTrash?.value) ? curTrash.value : [];
  const softDeletedItem = {
    id: item.id,
    nama: item.nama,
    stok: Number(item.stok) || 0,
    satuan: item.satuan,
    stokMinimum: Number(item.stok_minimum) || 0,
    isDijual: item.is_dijual,
    hargaJual: Number(item.harga_jual) || 0,
    kategoriLayanan: item.kategori_layanan,
    deletedAt: new Date().toISOString(),
    deletedBy: actor || 'Manager / Owner',
  };

  const nextTrash = [softDeletedItem, ...trashList.filter((t: any) => t.id !== id)];
  await sb.from('app_settings').upsert({ key: 'inventory_trash', value: nextTrash }, { onConflict: 'key' });

  // 3. Hapus dari tabel aktif inventory
  const { error: delErr } = await sb.from('inventory').delete().eq('id', id);
  if (delErr) throw delErr;

  // 4. Catat ke audit_logs
  try {
    await sb.from('audit_logs').insert({
      nama_user: actor || 'Manager',
      jenis_aktivitas: 'Soft Delete Inventory',
      referensi: id,
      detail: `Bahan ${item.nama} (Stok: ${item.stok} ${item.satuan}) diarsipkan ke sampah`,
    });
  } catch (logErr) {
    console.warn('Gagal mencatat audit log soft delete:', logErr);
  }

  return { success: true };
}

export async function sbGetTrashInventory(): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'inventory_trash')
    .maybeSingle();

  return Array.isArray(data?.value) ? data.value : [];
}

export async function sbRestoreInventory(id: string, actor?: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: curTrash } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'inventory_trash')
    .maybeSingle();

  const trashList: any[] = Array.isArray(curTrash?.value) ? curTrash.value : [];
  const itemToRestore = trashList.find((t: any) => t.id === id);
  if (!itemToRestore) throw new Error('Item tidak ditemukan di arsip sampah');

  // Masukkan kembali ke tabel inventory
  await sbTambahInventory({
    id: itemToRestore.id,
    nama: itemToRestore.nama,
    stok: itemToRestore.stok,
    satuan: itemToRestore.satuan,
    stokMinimum: itemToRestore.stokMinimum,
    isDijual: itemToRestore.isDijual,
    hargaJual: itemToRestore.hargaJual,
    kategoriLayanan: itemToRestore.kategoriLayanan,
  });

  // Hapus dari list sampah
  const nextTrash = trashList.filter((t: any) => t.id !== id);
  await sb.from('app_settings').upsert({ key: 'inventory_trash', value: nextTrash }, { onConflict: 'key' });

  // Catat ke audit_logs
  try {
    await sb.from('audit_logs').insert({
      nama_user: actor || 'Manager',
      jenis_aktivitas: 'Restore Inventory',
      referensi: id,
      detail: `Bahan ${itemToRestore.nama} dipulihkan kembali ke inventaris`,
    });
  } catch (logErr) {
    console.warn('Gagal mencatat audit log restore:', logErr);
  }

  return { success: true };
}

export async function sbPermanentDeleteInventory(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: curTrash } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'inventory_trash')
    .maybeSingle();

  const trashList: any[] = Array.isArray(curTrash?.value) ? curTrash.value : [];
  const nextTrash = trashList.filter((t: any) => t.id !== id);
  await sb.from('app_settings').upsert({ key: 'inventory_trash', value: nextTrash }, { onConflict: 'key' });
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

  // Ambil data custom pipeline steps per layanan dari app_settings
  let pipelineMap: Record<string, any[]> = {};
  try {
    const { data: pipeSetting } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'layanan_pipeline_steps')
      .maybeSingle();
    if (pipeSetting?.value && typeof pipeSetting.value === 'object') {
      pipelineMap = pipeSetting.value;
    }
  } catch {}

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
    pipelineSteps: pipelineMap[row.id] || [],
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

  // Simpan custom pipeline steps jika ada
  if (Array.isArray(payload.pipelineSteps)) {
    try {
      const { data: cur } = await sb.from('app_settings').select('value').eq('key', 'layanan_pipeline_steps').maybeSingle();
      const map = (cur?.value && typeof cur.value === 'object') ? { ...cur.value } : {};
      map[id] = payload.pipelineSteps;
      await sb.from('app_settings').upsert({
        key: 'layanan_pipeline_steps',
        value: map,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    } catch (e) {
      console.warn('[sbTambahLayanan] Gagal simpan pipelineSteps ke app_settings:', e);
    }
  }

  // LAYER 1 HYBRID BACKUP: Non-blocking trigger ke Google Sheets
  try {
    const gasUrl = process.env.NEXT_PUBLIC_GAS_API_URL;
    if (gasUrl && typeof window !== 'undefined') {
      setTimeout(() => {
        fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'tambahLayanan',
            args: [payload],
            sessionToken: typeof window !== 'undefined' ? localStorage.getItem('gas_session_token') : undefined,
          }),
        }).catch(e => console.warn('[Backup Tambah Layanan ke Google Sheets error]:', e));
      }, 100);
    }
  } catch {}

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

  // Simpan custom pipeline steps jika ada
  if (Array.isArray(payload.pipelineSteps)) {
    try {
      const { data: cur } = await sb.from('app_settings').select('value').eq('key', 'layanan_pipeline_steps').maybeSingle();
      const map = (cur?.value && typeof cur.value === 'object') ? { ...cur.value } : {};
      map[id] = payload.pipelineSteps;
      await sb.from('app_settings').upsert({
        key: 'layanan_pipeline_steps',
        value: map,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    } catch (e) {
      console.warn('[sbUpdateLayanan] Gagal simpan pipelineSteps ke app_settings:', e);
    }
  }

  // LAYER 1 HYBRID BACKUP: Non-blocking trigger ke Google Sheets
  try {
    const gasUrl = process.env.NEXT_PUBLIC_GAS_API_URL;
    if (gasUrl && typeof window !== 'undefined') {
      setTimeout(() => {
        fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'updateLayanan',
            args: [id, payload],
            sessionToken: typeof window !== 'undefined' ? localStorage.getItem('gas_session_token') : undefined,
          }),
        }).catch(e => console.warn('[Backup Update Layanan ke Google Sheets error]:', e));
      }, 100);
    }
  } catch {}

  return { success: true, id };
}

export async function sbHapusLayanan(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb.from('layanan').delete().eq('id', id);
  if (error) throw error;

  try {
    const { data: cur } = await sb.from('app_settings').select('value').eq('key', 'layanan_pipeline_steps').maybeSingle();
    if (cur?.value && typeof cur.value === 'object' && cur.value[id]) {
      const map = { ...cur.value };
      delete map[id];
      await sb.from('app_settings').upsert({
        key: 'layanan_pipeline_steps',
        value: map,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    }
  } catch (e) {}

  // LAYER 1 HYBRID BACKUP: Non-blocking trigger ke Google Sheets
  try {
    const gasUrl = process.env.NEXT_PUBLIC_GAS_API_URL;
    if (gasUrl && typeof window !== 'undefined') {
      setTimeout(() => {
        fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'hapusLayanan',
            args: [id],
            sessionToken: typeof window !== 'undefined' ? localStorage.getItem('gas_session_token') : undefined,
          }),
        }).catch(e => console.warn('[Backup Hapus Layanan ke Google Sheets error]:', e));
      }, 100);
    }
  } catch {}

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

export async function sbCreatePipelineStepsForOrder(sb: any, noNota: string, items: any[], petugas = 'Kasir') {
  let customStepsToUse: any[] | null = null;
  try {
    const { data: pipeSetting } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'layanan_pipeline_steps')
      .maybeSingle();
    const pipeMap = (pipeSetting?.value && typeof pipeSetting.value === 'object') ? pipeSetting.value : {};

    for (const it of items) {
      if (it.layanan && pipeMap[it.layanan] && pipeMap[it.layanan].length > 0) {
        customStepsToUse = pipeMap[it.layanan];
        break;
      }
    }
    if (!customStepsToUse) {
      const { data: allLay } = await sb.from('layanan').select('id, nama');
      for (const it of items) {
        const itName = String(it.layanan || '').trim().toLowerCase();
        const match = allLay?.find((l: any) =>
          String(l.nama || '').trim().toLowerCase() === itName ||
          String(l.id || '').trim().toLowerCase() === itName
        );
        if (match && pipeMap[match.id] && pipeMap[match.id].length > 0) {
          customStepsToUse = pipeMap[match.id];
          break;
        }
      }
    }
  } catch {}

  // Fallback deduksi cerdas berbasis nama item layanan
  if (!customStepsToUse || customStepsToUse.length === 0) {
    const allNames = items.map((i: any) => String(i.layanan || '').toLowerCase()).join(' ');
    if (allNames.includes('cuci kering') || (allNames.includes('kering') && !allNames.includes('setrika') && !allNames.includes('komplit'))) {
      customStepsToUse = [
        { nama: 'Diterima', icon: 'Inbox' },
        { nama: 'Dicuci', icon: 'Droplets' },
        { nama: 'Dikeringkan', icon: 'Wind' },
        { nama: 'Siap Diambil', icon: 'CheckCircle' },
      ];
    } else if (allNames.includes('setrika') && !allNames.includes('cuci')) {
      customStepsToUse = [
        { nama: 'Diterima', icon: 'Inbox' },
        { nama: 'Disetrika / Packing', icon: 'Sparkles' },
        { nama: 'Siap Diambil', icon: 'CheckCircle' },
      ];
    } else if (allNames.includes('lipat') && !allNames.includes('setrika')) {
      customStepsToUse = [
        { nama: 'Diterima', icon: 'Inbox' },
        { nama: 'Dicuci', icon: 'Droplets' },
        { nama: 'Dikeringkan', icon: 'Wind' },
        { nama: 'Dilipat / Packing', icon: 'Package' },
        { nama: 'Siap Diambil', icon: 'CheckCircle' },
      ];
    } else {
      customStepsToUse = [
        { nama: 'Diterima', icon: 'Inbox' },
        { nama: 'Dicuci', icon: 'Droplets' },
        { nama: 'Dikeringkan', icon: 'Wind' },
        { nama: 'Disetrika / Packing', icon: 'Sparkles' },
        { nama: 'Siap Diambil', icon: 'CheckCircle' },
      ];
    }
  }

  const firstStepName = String(customStepsToUse[0]?.nama || '').trim().toLowerCase();
  const startsWithDiterima = firstStepName.includes('terima');

  const stepsToInsert = customStepsToUse.map((cs, idx) => {
    let status = 'Pending';
    let waktu_mulai = null;
    let waktu_selesai = null;

    if (startsWithDiterima) {
      if (idx === 0) {
        status = 'Selesai';
        waktu_selesai = new Date().toISOString();
      } else if (idx === 1) {
        status = 'Aktif';
        waktu_mulai = new Date().toISOString();
      }
    } else {
      if (idx === 0) {
        status = 'Aktif';
        waktu_mulai = new Date().toISOString();
      }
    }

    return {
      no_nota: noNota,
      step: idx + 1,
      nama_step: cs.nama || `Langkah ${idx + 1}`,
      status,
      assigned_staff: (startsWithDiterima && idx === 0) ? (petugas || 'Kasir') : null,
      waktu_selesai,
      waktu_mulai,
    };
  });

  try {
    await sb.from('pipeline_steps').delete().eq('no_nota', noNota);
    await sb.from('pipeline_steps').insert(stepsToInsert);
  } catch (e) {
    console.error('[sbCreatePipelineStepsForOrder] Error insert pipeline steps:', e);
  }
}

// ============================================================
// TRANSAKSI & CHECKOUT
// ============================================================
export async function sbSimpanTransaksi(payload: any): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const items = Array.isArray(payload.items) ? payload.items : [];
  const tipe = payload.tipe || payload.tipeLayanan || 'SelfService';
  const petugas = payload.petugas || payload.kasir || 'Kasir';
  const subtotal = items.reduce((sum: number, it: any) => sum + (Number(it.qty || 1) * Number(it.hargaSatuan || 0)), 0);
  const diskon = Number(payload.diskon) || 0;
  const total = payload.total !== undefined ? Number(payload.total) : Math.max(0, subtotal - diskon);
  const nominalBayar = payload.nominalBayar !== undefined ? Number(payload.nominalBayar) : total;
  const sisaTagihan = Math.max(0, total - nominalBayar);
  const statusPembayaran = sisaTagihan === 0 ? 'Lunas' : nominalBayar > 0 ? 'DP' : 'Belum Bayar';
  const status = payload.status || (tipe === 'FullService' ? 'Diterima' : 'Selesai');

  // Sanitasi estimasiSelesai: hanya kirim string ISO jika valid, jika kosong/teks durasi kirim null
  let estimasiSelesaiISO: string | null = null;
  const rawEstimasi = payload.estimasiSelesai || payload.estimasi;
  if (rawEstimasi && typeof rawEstimasi === 'string' && rawEstimasi.trim()) {
    const parsedDate = parseIndonesianDateTime(rawEstimasi);
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      estimasiSelesaiISO = parsedDate.toISOString();
    }
  }

  // Tentukan Nomor Nota format resmi: LDY-YYMMDD-XXXX
  let noNota = payload.noNota ? String(payload.noNota).trim() : '';
  if (!noNota || noNota.startsWith('TRX-')) {
    const now = new Date();
    const jktOffset = 7 * 60;
    const localTime = new Date(now.getTime() + (now.getTimezoneOffset() + jktOffset) * 60000);
    const yy = String(localTime.getFullYear()).slice(-2);
    const mm = String(localTime.getMonth() + 1).padStart(2, '0');
    const dd = String(localTime.getDate()).padStart(2, '0');
    const prefix = `LDY-${yy}${mm}${dd}-`;

    const { data: latestTxs } = await sb
      .from('transaksi')
      .select('no_nota')
      .like('no_nota', `${prefix}%`)
      .order('no_nota', { ascending: false })
      .limit(1);

    let nextSeq = 1;
    if (latestTxs && latestTxs.length > 0) {
      const lastNota = latestTxs[0].no_nota;
      const parts = lastNota.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num)) nextSeq = num + 1;
    }
    noNota = `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  // Resolusi id_shift: gunakan dari payload jika ada, jika tidak otomatis kaitkan ke kas shift aktif yang berstatus Buka
  let activeShiftId = payload.idShift || payload.shiftId || null;
  if (!activeShiftId) {
    try {
      const { data: curShift } = await sb
        .from('kas_shift')
        .select('id_shift')
        .eq('status', 'Buka')
        .order('waktu_buka', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (curShift?.id_shift) {
        activeShiftId = curShift.id_shift;
      }
    } catch {}
  }

  const normalizedPayload = {
    ...payload,
    noNota,
    idShift: activeShiftId,
    tanggal: payload.tanggal || new Date().toISOString(),
    namaPelanggan: (payload.namaPelanggan || payload.pelanggan || 'Pelanggan Umum').trim(),
    noHp: (payload.noHp || '').trim() || null,
    alamat: (payload.alamat || '').trim() || null,
    isMember: Boolean(payload.isMember),
    poinEarned: Number(payload.poinEarned) || 0,
    petugas,
    tipe,
    tingkatLayanan: payload.tingkatLayanan || 'Reguler',
    subtotal,
    diskon,
    diskonKode: payload.diskonKode || payload.voucher || null,
    voucher: payload.voucher || payload.diskonKode || 'None',
    total,
    nominalBayar,
    nominalDP: payload.nominalDP || 0,
    sisaTagihan,
    metodeBayar: payload.metodeBayar || 'Tunai',
    statusPembayaran,
    referensiPembayaran: payload.referensiPembayaran || '',
    status,
    catatan: payload.catatan || '',
    estimasiSelesai: estimasiSelesaiISO,
    items: items.map((it: any) => ({
      layanan: it.layanan,
      qty: Number(it.qty) || 1,
      hargaSatuan: Number(it.hargaSatuan) || 0,
      subtotal: Number(it.subtotal) || (Number(it.qty || 1) * Number(it.hargaSatuan || 0)),
      idInventory: it.idInventory || null,
      inventoryDeductionQty: Number(it.inventoryDeductionQty) || 1,
    })),
  };

  // 1. Coba via RPC checkout_transaksi
  try {
    const { data: rpcData, error: rpcErr } = await sb.rpc('checkout_transaksi', {
      payload: normalizedPayload,
    });
    if (!rpcErr && rpcData) {
      if (tipe === 'FullService' || tipe === 'DropOff' || tipe === 'Drop Off') {
        await sbCreatePipelineStepsForOrder(sb, noNota, normalizedPayload.items, petugas);
      }
      return {
        success: true,
        noNota,
        total,
        subtotal,
        diskon,
        nominalBayar,
        sisaTagihan,
        statusPembayaran,
        message: 'Transaksi berhasil disimpan',
      };
    }
    if (rpcErr) {
      console.warn('[sbSimpanTransaksi] RPC checkout_transaksi gagal, fallback ke direct table insert:', rpcErr);
    }
  } catch (rpcEx) {
    console.warn('[sbSimpanTransaksi] Exception pada RPC checkout_transaksi:', rpcEx);
  }

  // 2. Fallback: Direct Table Insert
  const { error: insErr } = await sb.from('transaksi').insert({
    no_nota: noNota,
    tanggal: normalizedPayload.tanggal,
    nama_pelanggan: normalizedPayload.namaPelanggan,
    no_hp: normalizedPayload.noHp,
    alamat: normalizedPayload.alamat,
    is_member: normalizedPayload.isMember,
    poin_earned: normalizedPayload.poinEarned,
    petugas: normalizedPayload.petugas,
    id_shift: normalizedPayload.idShift || null,
    tipe: normalizedPayload.tipe,
    tingkat_layanan: normalizedPayload.tingkatLayanan,
    subtotal: normalizedPayload.subtotal,
    diskon: normalizedPayload.diskon,
    diskon_kode: normalizedPayload.diskonKode,
    voucher: normalizedPayload.voucher,
    total: normalizedPayload.total,
    nominal_bayar: normalizedPayload.nominalBayar,
    nominal_dp: normalizedPayload.nominalDP,
    sisa_tagihan: normalizedPayload.sisaTagihan,
    metode_bayar: normalizedPayload.metodeBayar,
    status_pembayaran: normalizedPayload.statusPembayaran,
    referensi_pembayaran: normalizedPayload.referensiPembayaran,
    status: normalizedPayload.status,
    catatan: normalizedPayload.catatan,
    estimasi_selesai: normalizedPayload.estimasiSelesai,
  });

  if (insErr) {
    console.error('[sbSimpanTransaksi] Direct insert transaksi gagal:', insErr);
    throw insErr;
  }

  // Insert items
  if (normalizedPayload.items.length > 0) {
    const itemRows = normalizedPayload.items.map((it: any) => ({
      no_nota: noNota,
      layanan: it.layanan,
      qty: it.qty,
      harga_satuan: it.hargaSatuan,
      subtotal: it.subtotal,
      id_inventory: it.idInventory,
      inventory_deduction_qty: it.inventoryDeductionQty,
    }));
    try {
      await sb.from('transaksi_items').insert(itemRows);
    } catch (e) {
      console.error('Error insert items:', e);
    }
  }

  // Upsert pelanggan
  if (normalizedPayload.noHp) {
    try {
      await sb.from('pelanggan').upsert({
        nama: normalizedPayload.namaPelanggan,
        no_hp: normalizedPayload.noHp,
        alamat: normalizedPayload.alamat,
      }, { onConflict: 'no_hp' });
    } catch (e) {
      console.error('Error upsert pelanggan:', e);
    }
  }

  // Deduct inventory for Non-FullService items
  if (tipe !== 'FullService') {
    for (const it of normalizedPayload.items) {
      if (it.idInventory && it.idInventory !== 'none') {
        const delta = Math.round((Number(it.qty) * Number(it.inventoryDeductionQty || 1)) * 10000) / 10000;
        try {
          await sbUpdateStokInventory(it.idInventory, -delta);
        } catch (e) {
          console.error('Error deduct inventory:', e);
        }
      }
    }
  }

  // Create pipeline for FullService / DropOff
  if (tipe === 'FullService' || tipe === 'DropOff' || tipe === 'Drop Off') {
    await sbCreatePipelineStepsForOrder(sb, noNota, normalizedPayload.items, petugas);
  }

  try {
    const totalStr = `Rp ${(Number(total) || 0).toLocaleString('id-ID')}`;
    await sbLogClientActivity(
      normalizedPayload.petugas || 'Kasir',
      'Transaksi Baru',
      noNota,
      '-',
      `Status: ${normalizedPayload.status || 'Selesai'}, Total: ${totalStr}`,
      `Transaksi baru ${normalizedPayload.tipe || 'SelfService'} - ${normalizedPayload.namaPelanggan || 'Pelanggan'} (${normalizedPayload.metodeBayar || 'Tunai'}, ${statusPembayaran})`
    );
  } catch (e) {
    console.warn('[sbSimpanTransaksi] Gagal catat audit log:', e);
  }

  return {
    success: true,
    noNota,
    total,
    subtotal,
    diskon,
    nominalBayar,
    sisaTagihan,
    statusPembayaran,
    message: 'Transaksi berhasil disimpan',
  };
}

export async function sbGetTransaksiList(limitOrFilter: number | string = 100): Promise<Transaksi[]> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  let query = sb
    .from('transaksi')
    .select(`
      *,
      transaksi_items (*),
      pipeline_steps (*)
    `)
    .order('tanggal', { ascending: false });

  if (typeof limitOrFilter === 'number' && limitOrFilter > 0) {
    query = query.limit(limitOrFilter);
  } else if (limitOrFilter && limitOrFilter !== 'Semua' && !isNaN(Number(limitOrFilter))) {
    query = query.limit(Number(limitOrFilter));
  } else {
    query = query.limit(200);
  }

  const { data: trxList, error } = await query;

  if (error) throw error;

  return (trxList || []).map((t: any) => ({
    noNota: t.no_nota,
    tanggal: formatDateTime(t.tanggal),
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
    pipeline: (t.pipeline_steps || []).sort((a: any, b: any) => (a.step || 0) - (b.step || 0)).map((p: any) => ({
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

export async function sbUpdateDropoffStatus(noNota: string | any, newStatus?: string, petugas = 'Kasir'): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  let targetNota = noNota;
  let targetStatus = newStatus;
  let targetPetugas = petugas;
  let washerId = '';
  let dryerId = '';
  let catatan = '';

  if (typeof noNota === 'object' && noNota !== null) {
    targetNota = noNota.noNota || noNota.no_nota || noNota.id;
    targetStatus = noNota.status || noNota.statusBaru;
    targetPetugas = noNota.assignedStaff || noNota.userName || noNota.petugas || 'Kasir';
    washerId = noNota.washerId || '';
    dryerId = noNota.dryerId || '';
    catatan = noNota.catatan || '';
  }

  if (!targetNota || !targetStatus) {
    throw new Error('Nomor nota atau status baru tidak valid.');
  }

  const { error: trxErr } = await sb
    .from('transaksi')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('no_nota', targetNota);

  if (trxErr) throw trxErr;

  // Update pipeline_steps if existing
  try {
    const { data: steps } = await sb
      .from('pipeline_steps')
      .select('*')
      .eq('no_nota', targetNota);

    if (steps && steps.length > 0) {
      const nowIso = new Date().toISOString();
      if (targetStatus === 'Selesai') {
        // Tandai step aktif yang diselesaikan oleh petugas penyerah
        await sb
          .from('pipeline_steps')
          .update({ 
            status: 'Selesai', 
            waktu_selesai: nowIso,
            assigned_staff: targetPetugas || 'Kasir'
          })
          .eq('no_nota', targetNota)
          .eq('status', 'Aktif');

        // Pastikan semua step lainnya juga berstatus Selesai
        await sb
          .from('pipeline_steps')
          .update({ status: 'Selesai', waktu_selesai: nowIso })
          .eq('no_nota', targetNota)
          .neq('status', 'Selesai');
      } else {
        await sb
          .from('pipeline_steps')
          .update({ status: 'Selesai', waktu_selesai: nowIso })
          .eq('no_nota', targetNota)
          .eq('status', 'Aktif');

        await sb
          .from('pipeline_steps')
          .update({
            status: 'Aktif',
            waktu_mulai: nowIso,
            assigned_staff: targetPetugas,
            mesin_id: washerId || dryerId || null,
          })
          .eq('no_nota', targetNota)
          .ilike('nama_step', targetStatus);
      }
    }
  } catch (pipeErr) {
    console.warn('Error updating pipeline steps:', pipeErr);
  }

  // Jika masuk ke status 'Dicuci', otomatis potong stok bahan baku layanan
  if (targetStatus === 'Dicuci') {
    const { data: items } = await sb
      .from('transaksi_items')
      .select('layanan, qty, id_inventory, inventory_deduction_qty')
      .eq('no_nota', targetNota);

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

  try {
    await sbLogClientActivity(
      targetPetugas || 'Kasir',
      'Update Pipeline Cucian',
      String(targetNota),
      '-',
      `Status: ${targetStatus}`,
      `Perubahan status pengerjaan ${targetNota} menjadi ${targetStatus} oleh ${targetPetugas || 'Kasir'}`
    );
  } catch (e) {}

  return { success: true, newStatus: targetStatus };
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

function getStartOfTodayWIB(): Date {
  const now = new Date();
  const jktOffset = 7 * 60;
  const jktTime = new Date(now.getTime() + (now.getTimezoneOffset() + jktOffset) * 60000);
  const y = jktTime.getFullYear();
  const m = jktTime.getMonth();
  const d = jktTime.getDate();
  return new Date(Date.UTC(y, m, d, 0 - 7, 0, 0, 0));
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

  // 1. Hitung omzet transaksi real-time selama shift ini berjalan
  let omzetTunai = 0;
  let omzetMerchant = 0;
  let pendingVoidCount = 0;
  let pendingVoidTotal = 0;
  const pendingVoidList: Array<{
    noNota: string;
    namaPelanggan: string;
    nominal: number;
    metodeBayar: string;
    alasan?: string;
  }> = [];

  try {
    const { data: txList } = await sb
      .from('transaksi')
      .select('no_nota, tanggal, nama_pelanggan, total, nominal_bayar, nominal_dp, sisa_tagihan, metode_bayar, status, status_pembayaran, status_void, alasan_void, id_shift')
      .or(`id_shift.eq.${data.id_shift},tanggal.gte.${data.waktu_buka}`);

    for (const tx of txList || []) {
      // Abaikan transaksi yang berstatus batal / void disetujui
      if (
        tx.status === 'Void' ||
        tx.status === 'Batal' ||
        tx.status_void === 'Approved'
      ) {
        continue;
      }

      const totalTagihan = Number(tx.total) || 0;
      const nominalDP = Number(tx.nominal_dp) || 0;
      const sisaTagihan = Number(tx.sisa_tagihan) || 0;
      let nominal = 0;

      if (tx.status_pembayaran === 'Belum Bayar') {
        nominal = 0;
      } else if (sisaTagihan > 0 && nominalDP > 0) {
        nominal = nominalDP;
      } else {
        nominal = totalTagihan;
      }

      // Deteksi transaksi pending approval void
      if (tx.status_void === 'PendingApproval') {
        pendingVoidCount++;
        pendingVoidTotal += nominal;
        pendingVoidList.push({
          noNota: tx.no_nota || '',
          namaPelanggan: tx.nama_pelanggan || 'Pelanggan',
          nominal: nominal,
          metodeBayar: tx.metode_bayar || 'Tunai',
          alasan: tx.alasan_void || '-',
        });
        continue;
      }

      const metode = String(tx.metode_bayar || 'Tunai').trim().toLowerCase();
      if (metode === 'tunai') {
        omzetTunai += nominal;
      } else {
        omzetMerchant += nominal;
      }
    }
  } catch (txErr) {
    console.warn('[sbGetKasShiftAktif] Gagal hitung omzet transaksi:', txErr);
  }

  // 2. Hitung total belanja operasional tercatat pada shift ini
  let nominalBelanjaShift = Number(data.total_pengeluaran) || 0;
  try {
    const { data: expList } = await sb
      .from('kas_shift_pengeluaran')
      .select('nominal')
      .eq('id_shift', data.id_shift);
    if (expList && expList.length > 0) {
      const sumExp = expList.reduce((sum: number, e: any) => sum + (Number(e.nominal) || 0), 0);
      nominalBelanjaShift = Math.max(nominalBelanjaShift, sumExp);
    }
  } catch {}

  // 3. Hitung Data Kumulatif Hari Ini (Seluruh shift sejak 00:00 WIB hari ini)
  let kumulatifData = undefined;
  try {
    const startOfTodayWIB = getStartOfTodayWIB();
    const startIso = startOfTodayWIB.toISOString();

    const [shiftsTodayRes, txsTodayRes] = await Promise.all([
      sb
        .from('kas_shift')
        .select('*')
        .eq('id_outlet', outletId)
        .gte('waktu_buka', startIso)
        .order('waktu_buka', { ascending: true }),
      sb
        .from('transaksi')
        .select('total, nominal_dp, sisa_tagihan, metode_bayar, status, status_pembayaran, status_void')
        .gte('tanggal', startIso),
    ]);

    const todayShifts = shiftsTodayRes.data || [];
    const todayTxs = txsTodayRes.data || [];

    let omzetTunaiHariIni = 0;
    let omzetMerchantHariIni = 0;
    for (const tx of todayTxs) {
      if (tx.status === 'Void' || tx.status === 'Batal' || tx.status_void === 'Approved' || tx.status_void === 'PendingApproval') continue;
      const totalTagihan = Number(tx.total) || 0;
      const nominalDP = Number(tx.nominal_dp) || 0;
      const sisaTagihan = Number(tx.sisa_tagihan) || 0;
      let nominal = 0;
      if (tx.status_pembayaran === 'Belum Bayar') nominal = 0;
      else if (sisaTagihan > 0 && nominalDP > 0) nominal = nominalDP;
      else nominal = totalTagihan;

      if (String(tx.metode_bayar || 'Tunai').trim().toLowerCase() === 'tunai') {
        omzetTunaiHariIni += nominal;
      } else {
        omzetMerchantHariIni += nominal;
      }
    }

    const modalAwalHariIni = todayShifts.length > 0 ? (Number(todayShifts[0].kas_awal) || 0) : (Number(data.kas_awal) || 0);
    const totalBelanjaHariIni = todayShifts.reduce((sum: number, s: any) => sum + (Number(s.total_pengeluaran) || 0), 0) + nominalBelanjaShift;

    const shiftKe = todayShifts.length || 1;
    const isGantiShift = shiftKe > 1;
    const prevShift = isGantiShift ? todayShifts[todayShifts.length - 2] : null;

    kumulatifData = {
      shiftKe,
      isGantiShift,
      modalAwalHariIni,
      omzetTunaiHariIni,
      omzetMerchantHariIni,
      totalBelanjaHariIni,
      ekspektasiKasHariIni: modalAwalHariIni + omzetTunaiHariIni - totalBelanjaHariIni,
      prevShift: prevShift ? {
        idShift: prevShift.id_shift,
        namaKasir: prevShift.nama_kasir,
        waktuBuka: prevShift.waktu_buka,
        waktuTutup: prevShift.waktu_tutup,
        kasAwal: Number(prevShift.kas_awal) || 0,
        kasAkhirFisik: Number(prevShift.kas_akhir_fisik) || 0,
        selisihKas: Number(prevShift.selisih_kas) || 0,
        modeTutup: prevShift.mode_tutup,
      } : null,
      todayShifts: todayShifts.map((s: any) => ({
        idShift: s.id_shift,
        namaKasir: s.nama_kasir,
        waktuBuka: s.waktu_buka,
        waktuTutup: s.waktu_tutup,
        kasAwal: Number(s.kas_awal) || 0,
        kasAkhirFisik: Number(s.kas_akhir_fisik) || 0,
        selisihKas: Number(s.selisih_kas) || 0,
        status: s.status,
        totalBelanja: Number(s.total_pengeluaran) || 0,
      })),
    };
  } catch (kErr) {
    console.warn('[sbGetKasShiftAktif] Gagal hitung data kumulatif shift:', kErr);
  }

  const kasAwal = Number(data.kas_awal) || 0;

  return {
    idShift: data.id_shift,
    idOutlet: data.id_outlet,
    namaKasir: data.nama_kasir,
    idUser: data.id_user || 'USER-1',
    waktuBuka: data.waktu_buka,
    kasAwal,
    saldoMerchantAwal: Number(data.saldo_merchant_awal) || 0,
    kasAkhir: Number(data.kas_akhir_fisik) || 0,
    totalOmzetTunai: omzetTunai,
    totalOmzetMerchant: omzetMerchant,
    nominalBelanja: nominalBelanjaShift,
    selisihKas: Number(data.selisih_kas) || 0,
    status: data.status,
    pendingVoidCount,
    pendingVoidTotal,
    pendingVoidList,
    kumulatif: kumulatifData,
  };
}

export async function sbOpenKasShift(payload: any): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const outletId = payload.idOutlet || payload.outlet || 'OUTLET-UTAMA';
  // Cek apakah sudah ada shift aktif yang masih berstatus Buka
  const { data: existingActive } = await sb
    .from('kas_shift')
    .select('*')
    .eq('id_outlet', outletId)
    .eq('status', 'Buka')
    .order('waktu_buka', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingActive) {
    return { success: true, shift: existingActive, message: 'Kas shift aktif sudah berjalan.' };
  }

  const idShift = payload.idShift || `SHIFT-${Date.now()}`;
  const { data, error } = await sb.from('kas_shift').insert({
    id_shift: idShift,
    id_outlet: outletId,
    nama_kasir: payload.namaKasir || 'Kasir',
    kas_awal: Number(payload.kasAwal) || 0,
    saldo_merchant_awal: Number(payload.saldoMerchantAwal) || 0,
    status: 'Buka',
  }).select().single();

  if (error) throw error;

  try {
    const kasAwalStr = `Rp ${(Number(payload.kasAwal) || 0).toLocaleString('id-ID')}`;
    await sbLogClientActivity(
      payload.namaKasir || 'Kasir',
      'Buka Kas Shift',
      idShift,
      '-',
      `Kas Awal: ${kasAwalStr}`,
      `Buka kas shift laci ${outletId} - Kas awal ${kasAwalStr}`
    );
  } catch {}

  return { success: true, shift: data };
}

export async function sbCloseKasShift(payload: any): Promise<any> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const idShift = payload.idShift || payload.shiftId;
  if (!idShift) throw new Error('ID Shift tidak ditemukan.');

  // Ambil data shift untuk dasar kalkulasi selisih yang presisi
  const { data: shiftRow } = await sb
    .from('kas_shift')
    .select('*')
    .eq('id_shift', idShift)
    .maybeSingle();

  const kasAkhirFisik = Number(payload.kasAkhirFisik ?? payload.kasAkhir) || 0;
  const saldoMerchantAkhir = Number(payload.saldoMerchantAkhir ?? payload.merchantAkhir) || 0;
  const totalPengeluaran = Number(payload.totalPengeluaran ?? payload.expenseAmount) || 0;
  const namaPengganti = payload.namaPengganti || payload.replacementName || null;
  const modeTutup = payload.mode || payload.modeTutup || 'TUTUP_HARIAN';
  const catatan = payload.catatan || null;

  let totalOmzetTunai = Number(payload.totalOmzetTunai ?? payload.omzetTunai);
  let totalOmzetMerchant = Number(payload.totalOmzetMerchant ?? payload.omzetMerchant);

  // Jika omzet tidak disertakan, hitung langsung dari transaksi
  if (isNaN(totalOmzetTunai) || isNaN(totalOmzetMerchant)) {
    const waktuBuka = shiftRow?.waktu_buka;
    totalOmzetTunai = 0;
    totalOmzetMerchant = 0;
    if (waktuBuka) {
      try {
        const { data: txList } = await sb
          .from('transaksi')
          .select('total, nominal_dp, sisa_tagihan, metode_bayar, status, status_pembayaran, status_void')
          .or(`id_shift.eq.${idShift},tanggal.gte.${waktuBuka}`);

        for (const tx of txList || []) {
          if (tx.status === 'Void' || tx.status === 'Batal' || tx.status_void === 'Approved' || tx.status_void === 'PendingApproval') continue;
          const totalTagihan = Number(tx.total) || 0;
          const nominalDP = Number(tx.nominal_dp) || 0;
          const sisaTagihan = Number(tx.sisa_tagihan) || 0;
          let nominal = 0;
          if (tx.status_pembayaran === 'Belum Bayar') nominal = 0;
          else if (sisaTagihan > 0 && nominalDP > 0) nominal = nominalDP;
          else nominal = totalTagihan;

          if (String(tx.metode_bayar || 'Tunai').trim().toLowerCase() === 'tunai') {
            totalOmzetTunai += nominal;
          } else {
            totalOmzetMerchant += nominal;
          }
        }
      } catch {}
    }
  }

  const kasAwal = Number(shiftRow?.kas_awal) || 0;
  const saldoMerchantAwal = Number(shiftRow?.saldo_merchant_awal) || 0;

  const expectedKas = kasAwal + totalOmzetTunai - totalPengeluaran;
  const selisihKas = payload.selisihKas !== undefined ? Number(payload.selisihKas) : (kasAkhirFisik - expectedKas);

  const expectedMerchant = saldoMerchantAwal + totalOmzetMerchant;
  const selisihMerchant = payload.selisihMerchant !== undefined ? Number(payload.selisihMerchant) : (saldoMerchantAkhir - expectedMerchant);

  const { data, error } = await sb
    .from('kas_shift')
    .update({
      waktu_tutup: new Date().toISOString(),
      kas_akhir_fisik: kasAkhirFisik,
      saldo_merchant_akhir: saldoMerchantAkhir,
      total_penjualan_tunai: totalOmzetTunai,
      total_penjualan_non_tunai: totalOmzetMerchant,
      total_pengeluaran: totalPengeluaran,
      selisih_kas: selisihKas,
      status: 'Tutup',
      catatan: catatan,
      mode_tutup: modeTutup,
      nama_pengganti: namaPengganti,
    })
    .eq('id_shift', idShift)
    .select()
    .single();

  if (error) throw error;

  try {
    const kasAwalStr = `Rp ${(Number(shiftRow?.kas_awal) || 0).toLocaleString('id-ID')}`;
    const kasAkhirStr = `Rp ${kasAkhirFisik.toLocaleString('id-ID')}`;
    const selisihStr = `Rp ${(Number(selisihKas) || 0).toLocaleString('id-ID')}`;
    await sbLogClientActivity(
      shiftRow?.nama_kasir || payload.namaKasir || 'Kasir',
      'Tutup Kas Shift',
      idShift,
      `Kas Awal: ${kasAwalStr}`,
      `Kas Fisik: ${kasAkhirStr}, Selisih: ${selisihStr}`,
      `Tutup kas shift ${idShift} (${modeTutup}) - Kas fisik ${kasAkhirStr}`
    );
  } catch {}

  // Simpan rincian pengeluaran ke kas_shift_pengeluaran jika ada
  if (Array.isArray(payload.expenses) && payload.expenses.length > 0) {
    const expenseRows = payload.expenses.map((e: any) => ({
      id_shift: idShift,
      nama_pengeluaran: e.nama || e.nama_pengeluaran || 'Pengeluaran Kasir',
      nominal: Number(e.nominal) || 0,
      kategori: e.kategori || 'Operasional Lainnya',
      foto_url: e.fotoUrl || e.foto_url || null,
    }));
    try {
      await sb.from('kas_shift_pengeluaran').insert(expenseRows);
    } catch (expErr) {
      console.warn('[sbCloseKasShift] Gagal simpan rincian pengeluaran:', expErr);
    }
  }

  // ============================================================
  // LAYER 1 HYBRID BACKUP: Non-blocking trigger ke Google Sheets
  // ============================================================
  try {
    const gasUrl = process.env.NEXT_PUBLIC_GAS_API_URL;
    if (gasUrl && typeof window !== 'undefined') {
      setTimeout(() => {
        fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'closeKasShift',
            args: [{
              ...payload,
              idShift,
              kasAkhirFisik,
              saldoMerchantAkhir,
              totalPengeluaran,
              totalOmzetTunai,
              totalOmzetMerchant,
              selisihKas,
              selisihMerchant,
            }],
            sessionToken: typeof window !== 'undefined' ? localStorage.getItem('gas_session_token') : undefined,
          }),
        }).catch(e => console.warn('[Backup Kas Shift ke Google Sheets background error]:', e));
      }, 100);
    }
  } catch {}

  return { success: true, shift: data, selisihKas, selisihMerchant };
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
  return (data || []).map((s: any) => {
    const kasAwal = Number(s.kas_awal) || 0;
    const omzetTunai = Number(s.total_penjualan_tunai) || 0;
    const omzetMerchant = Number(s.total_penjualan_non_tunai) || 0;
    const totalBelanja = Number(s.total_pengeluaran) || 0;
    const kasAkhirSistem = kasAwal + omzetTunai - totalBelanja;

    return {
      idShift: s.id_shift,
      idOutlet: s.id_outlet,
      namaKasir: s.nama_kasir,
      idUser: s.id_user,
      waktuBuka: s.waktu_buka,
      waktuTutup: s.waktu_tutup,
      kasAwal,
      omzetTunai,
      omzetMerchant,
      kasAkhirSistem,
      kasAkhirFisik: Number(s.kas_akhir_fisik) || 0,
      selisihKas: Number(s.selisih_kas) || 0,
      status: s.status === 'Tutup' ? 'Ditutup' : s.status,
      modeTutup: s.mode_tutup,
      namaPengganti: s.nama_pengganti,
      catatan: s.catatan,
      saldoMerchantAwal: Number(s.saldo_merchant_awal) || 0,
      saldoMerchantAkhir: Number(s.saldo_merchant_akhir) || 0,
      totalBelanja,
    };
  });
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

// ============================================================
// PELANGGAN & MEMBER MUTATIONS
// ============================================================
export async function sbTambahPelanggan(payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('pelanggan')
    .insert({
      nama: String(payload.nama || 'Pelanggan').trim(),
      no_hp: String(payload.noHp).trim(),
      alamat: payload.alamat || null,
      tgl_lahir: payload.tglLahir || null,
      is_member: Boolean(payload.isMember),
      saldo_poin: Number(payload.saldoPoin) || 0,
      total_order: Number(payload.totalOrder) || 0,
      stamps_75: Number(payload.stamps75) || 0,
      stamps_45: Number(payload.stamps45) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbUpdateDataPelanggan(noHp: string, payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const updates: any = { updated_at: new Date().toISOString() };
  if (payload.nama !== undefined) updates.nama = payload.nama;
  if (payload.alamat !== undefined) updates.alamat = payload.alamat;
  if (payload.tglLahir !== undefined) updates.tgl_lahir = payload.tglLahir;
  if (payload.isMember !== undefined) updates.is_member = Boolean(payload.isMember);
  if (payload.saldoPoin !== undefined) updates.saldo_poin = Number(payload.saldoPoin);
  if (payload.stamps75 !== undefined) updates.stamps_75 = Number(payload.stamps75);
  if (payload.stamps45 !== undefined) updates.stamps_45 = Number(payload.stamps45);

  const { data, error } = await sb
    .from('pelanggan')
    .update(updates)
    .eq('no_hp', noHp)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbUpdateStempelPelanggan(noHp: string, delta75: number, delta45: number) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: current, error: getErr } = await sb
    .from('pelanggan')
    .select('stamps_75, stamps_45')
    .eq('no_hp', noHp)
    .single();

  if (getErr) throw getErr;

  const new75 = Math.max(0, (current?.stamps_75 || 0) + (Number(delta75) || 0));
  const new45 = Math.max(0, (current?.stamps_45 || 0) + (Number(delta45) || 0));

  const { data, error } = await sb
    .from('pelanggan')
    .update({
      stamps_75: new75,
      stamps_45: new45,
      updated_at: new Date().toISOString(),
    })
    .eq('no_hp', noHp)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbDaftarMember(noHp: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('pelanggan')
    .update({ is_member: true, updated_at: new Date().toISOString() })
    .eq('no_hp', noHp)
    .select()
    .single();

  if (error) throw error;

  try {
    await sbLogClientActivity(
      'Kasir',
      'Daftar Member',
      noHp,
      '-',
      `Member Aktif (Poin: ${data?.poin || 0})`,
      `Registrasi membership loyalitas untuk ${data?.nama || noHp}`
    );
  } catch {}

  return { success: true, data };
}

// ============================================================
// MESIN WASHER & DRYER
// ============================================================
export async function sbTambahMesin(payload: { nama: string; tipe: string }) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const id = `M-${Date.now()}`;
  const { data, error } = await sb
    .from('mesin')
    .insert({
      id,
      nama: payload.nama,
      tipe: payload.tipe || 'Washer',
      status: 'Siap',
      sisa_waktu_menit: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbMulaiPakaiMesin(id: string, catatan: string, durasiStr: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const minutes = parseInt(String(durasiStr).replace(/\D/g, '')) || 45;
  const now = new Date();
  const estimasi = new Date(now.getTime() + minutes * 60 * 1000);

  const { data, error } = await sb
    .from('mesin')
    .update({
      status: 'Sedang Jalan',
      catatan: catatan || null,
      waktu_mulai: now.toISOString(),
      estimasi_selesai: estimasi.toISOString(),
      sisa_waktu_menit: minutes,
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbSelesaiMesin(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('mesin')
    .update({
      status: 'Siap',
      catatan: null,
      waktu_mulai: null,
      estimasi_selesai: null,
      sisa_waktu_menit: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbSetMaintenanceMesin(id: string, isMaintenance: boolean) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const status = isMaintenance ? 'Perawatan' : 'Siap';
  const { data, error } = await sb
    .from('mesin')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbHapusMesin(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb.from('mesin').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================
// PROMO & VOUCHER
// ============================================================
export async function sbTambahPromo(payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const id = payload.idPromo || `PRM-${Date.now()}`;
  const { data, error } = await sb
    .from('promo')
    .insert({
      id_promo: id,
      kode_voucher: String(payload.kodeVoucher).trim().toUpperCase(),
      jenis_diskon: payload.jenisDiskon || 'Persen',
      nilai_diskon: Number(payload.nilaiDiskon) || 0,
      min_transaksi: Number(payload.minTransaksi) || 0,
      maks_potongan: Number(payload.maksPotongan) || 0,
      status_aktif: payload.statusAktif !== false,
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbEditPromo(id: string, payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const updates: any = {};
  if (payload.kodeVoucher !== undefined) updates.kode_voucher = String(payload.kodeVoucher).trim().toUpperCase();
  if (payload.jenisDiskon !== undefined) updates.jenis_diskon = payload.jenisDiskon;
  if (payload.nilaiDiskon !== undefined) updates.nilai_diskon = Number(payload.nilaiDiskon);
  if (payload.minTransaksi !== undefined) updates.min_transaksi = Number(payload.minTransaksi);
  if (payload.maksPotongan !== undefined) updates.maks_potongan = Number(payload.maksPotongan);
  if (payload.statusAktif !== undefined) updates.status_aktif = Boolean(payload.statusAktif);

  const { data, error } = await sb
    .from('promo')
    .update(updates)
    .eq('id_promo', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbHapusPromo(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb.from('promo').delete().eq('id_promo', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================
// MASTER KATEGORI
// ============================================================
export async function sbTambahKategori(payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const id = payload.id || `KAT-${Date.now()}`;
  const { data, error } = await sb
    .from('master_kategori')
    .insert({
      id,
      nama: String(payload.nama).trim(),
      warna: payload.warna || 'teal',
      icon: payload.icon || 'Folder',
      aktif: payload.aktif || 'Y',
      urutan: Number(payload.urutan) || 0,
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbUpdateKategori(id: string, payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const updates: any = {};
  if (payload.nama !== undefined) updates.nama = String(payload.nama).trim();
  if (payload.warna !== undefined) updates.warna = payload.warna;
  if (payload.icon !== undefined) updates.icon = payload.icon;
  if (payload.aktif !== undefined) updates.aktif = payload.aktif;
  if (payload.urutan !== undefined) updates.urutan = Number(payload.urutan);

  const { data, error } = await sb
    .from('master_kategori')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbToggleAktifKategori(id: string, aktifSekarang?: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const nextVal = (aktifSekarang === 'Y' || aktifSekarang === 'true') ? 'N' : 'Y';
  const { data, error } = await sb
    .from('master_kategori')
    .update({ aktif: nextVal })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbHapusKategori(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb.from('master_kategori').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================
// PEGAWAI CRUD
// ============================================================
export async function sbTambahPegawai(payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const id = payload.id || `EMP-${Date.now()}`;
  const isManager = (payload.jabatan && payload.jabatan.toLowerCase().includes('manager')) || payload.role === 'MANAGER';
  const role = isManager ? 'MANAGER' : 'STAFF';

  const { data, error } = await sb
    .from('pegawai')
    .insert({
      id,
      nama: String(payload.nama).trim(),
      no_hp: payload.noHp || null,
      jabatan: payload.jabatan || 'Kasir / Staff',
      role,
      status: payload.status || 'Aktif',
      nik: payload.nik || null,
      nama_panggilan: payload.namaPanggilan || null,
      alamat: payload.alamat || null,
      shift_utama: payload.shiftUtama || null,
      tanggal_bergabung: payload.tanggalMasuk || payload.tanggalBergabung || null,
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, id, data };
}

export async function sbUpdatePegawai(id: string, payload: any) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const updates: any = {};
  if (payload.nama !== undefined) updates.nama = String(payload.nama).trim();
  if (payload.noHp !== undefined) updates.no_hp = payload.noHp;
  if (payload.jabatan !== undefined) {
    updates.jabatan = payload.jabatan;
    if (payload.jabatan.toLowerCase().includes('manager')) updates.role = 'MANAGER';
  }
  if (payload.role !== undefined) updates.role = payload.role;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.nik !== undefined) updates.nik = payload.nik;
  if (payload.namaPanggilan !== undefined) updates.nama_panggilan = payload.namaPanggilan;
  if (payload.alamat !== undefined) updates.alamat = payload.alamat;
  if (payload.shiftUtama !== undefined) updates.shift_utama = payload.shiftUtama;
  if (payload.tanggalMasuk || payload.tanggalBergabung) {
    updates.tanggal_bergabung = payload.tanggalMasuk || payload.tanggalBergabung;
  }

  const { data, error } = await sb
    .from('pegawai')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbHapusPegawai(id: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb.from('pegawai').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================
// TRANSAKSI & PIPELINE MUTATIONS
// ============================================================
export async function sbUpdateKasirTransaksi(noNota: string, namaKasirBaru: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('transaksi')
    .update({ petugas: namaKasirBaru })
    .eq('no_nota', noNota)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbGetTransaksiByPipeline(statusFilter = 'Semua'): Promise<Transaksi[]> {
  const sb = getSupabase();
  if (!sb) return [];

  let query = sb
    .from('transaksi')
    .select(`
      *,
      transaksi_items (*),
      pipeline_steps (*)
    `)
    .in('tipe', ['FullService', 'DropOff', 'Drop Off'])
    .order('tanggal', { ascending: false });

  if (statusFilter && statusFilter !== 'Semua') {
    query = query.eq('status', statusFilter);
  } else {
    query = query.not('status', 'in', '(Selesai,Void,Batal)');
  }

  const { data, error } = await query.limit(200);
  if (error) return [];

  // Ambil data custom pipeline steps per layanan dari app_settings
  let pipeMap: Record<string, any[]> = {};
  let allLay: any[] = [];
  try {
    const { data: pipeSetting } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'layanan_pipeline_steps')
      .maybeSingle();
    if (pipeSetting?.value && typeof pipeSetting.value === 'object') {
      pipeMap = pipeSetting.value;
    }
    const { data: layData } = await sb.from('layanan').select('id, nama');
    if (Array.isArray(layData)) allLay = layData;
  } catch {}

  return (data || []).map((t: any) => {
    let rawPipeline: any[] = (t.pipeline_steps || [])
      .sort((a: any, b: any) => (a.step || 0) - (b.step || 0))
      .map((p: any) => ({
        id: p.id,
        noNota: p.no_nota,
        step: p.step,
        namaStep: p.nama_step,
        status: p.status,
        assignedStaff: p.assigned_staff,
        mesinId: p.mesin_id,
        waktuMulai: p.waktu_mulai,
        waktuSelesai: p.waktu_selesai,
      }));

    // Jika belum ada pipeline_steps di database, bangun alur dinamis sesuai konfigurasi aktif layanan
    if (rawPipeline.length === 0) {
      const items = t.transaksi_items || [];
      let customSteps: any[] | null = null;
      for (const it of items) {
        if (it.layanan && pipeMap[it.layanan] && pipeMap[it.layanan].length > 0) {
          customSteps = pipeMap[it.layanan];
          break;
        }
      }
      if (!customSteps) {
        for (const it of items) {
          const itName = String(it.layanan || '').trim().toLowerCase();
          const match = allLay.find((l: any) =>
            String(l.nama || '').trim().toLowerCase() === itName ||
            String(l.id || '').trim().toLowerCase() === itName
          );
          if (match && pipeMap[match.id] && pipeMap[match.id].length > 0) {
            customSteps = pipeMap[match.id];
            break;
          }
        }
      }

      const txStatus = String(t.status || 'Diterima').toLowerCase().trim();

      if (Array.isArray(customSteps) && customSteps.length > 0) {
        const targetStepIdx = (() => {
          if (txStatus === 'selesai' || txStatus.includes('diambil') || txStatus.includes('siap')) {
            return customSteps.length - 1;
          }
          const idx = customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase() === txStatus);
          if (idx >= 0) return idx;
          if (txStatus.includes('cuci')) return customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase().includes('cuci'));
          if (txStatus.includes('kering')) return customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase().includes('kering'));
          if (txStatus.includes('setrika')) return customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase().includes('setrika'));
          if (txStatus.includes('lipat')) return customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase().includes('lipat'));
          return 0;
        })();

        rawPipeline = customSteps.map((cs: any, idx: number) => {
          let st = 'Pending';
          if (txStatus === 'selesai') {
            st = 'Selesai';
          } else if (idx < targetStepIdx) {
            st = 'Selesai';
          } else if (idx === targetStepIdx) {
            st = 'Aktif';
          }
          return {
            id: `virt-${t.no_nota}-${idx + 1}`,
            noNota: t.no_nota,
            step: idx + 1,
            namaStep: cs.nama || `Langkah ${idx + 1}`,
            status: st,
            assignedStaff: idx <= targetStepIdx ? (t.petugas || 'Kasir') : null,
            waktuMulai: idx <= targetStepIdx ? t.tanggal : undefined,
            waktuSelesai: idx < targetStepIdx ? t.tanggal : undefined,
          };
        });
      } else {
        const allItemNames = items.map((i: any) => String(i.layanan || '').toLowerCase()).join(' ');
        let defaultStepNames = ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika / Packing', 'Siap Diambil'];
        if (allItemNames.includes('cuci kering') || (allItemNames.includes('kering') && !allItemNames.includes('setrika') && !allItemNames.includes('komplit'))) {
          defaultStepNames = ['Diterima', 'Dicuci', 'Dikeringkan', 'Siap Diambil'];
        } else if (allItemNames.includes('setrika') && !allItemNames.includes('cuci')) {
          defaultStepNames = ['Diterima', 'Disetrika / Packing', 'Siap Diambil'];
        } else if (allItemNames.includes('lipat') && !allItemNames.includes('setrika')) {
          defaultStepNames = ['Diterima', 'Dicuci', 'Dikeringkan', 'Dilipat / Packing', 'Siap Diambil'];
        }

        const targetStepIdx = (() => {
          if (txStatus === 'selesai' || txStatus.includes('diambil') || txStatus.includes('siap')) {
            return defaultStepNames.length - 1;
          }
          const idx = defaultStepNames.findIndex((name) => name.toLowerCase().includes(txStatus));
          if (idx >= 0) return idx;
          if (txStatus.includes('cuci')) return defaultStepNames.findIndex(n => n.toLowerCase().includes('cuci'));
          if (txStatus.includes('kering')) return defaultStepNames.findIndex(n => n.toLowerCase().includes('kering'));
          if (txStatus.includes('setrika')) return defaultStepNames.findIndex(n => n.toLowerCase().includes('setrika'));
          if (txStatus.includes('lipat')) return defaultStepNames.findIndex(n => n.toLowerCase().includes('lipat'));
          return 0;
        })();

        rawPipeline = defaultStepNames.map((name, idx) => {
          let st = 'Pending';
          if (txStatus === 'selesai') {
            st = 'Selesai';
          } else if (idx < targetStepIdx) {
            st = 'Selesai';
          } else if (idx === targetStepIdx) {
            st = 'Aktif';
          }
          return {
            id: `virt-${t.no_nota}-${idx + 1}`,
            noNota: t.no_nota,
            step: idx + 1,
            namaStep: name,
            status: st,
            assignedStaff: idx <= targetStepIdx ? (t.petugas || 'Kasir') : null,
            waktuMulai: idx <= targetStepIdx ? t.tanggal : undefined,
            waktuSelesai: idx < targetStepIdx ? t.tanggal : undefined,
          };
        });
      }
    }

    return {
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
      catatan: t.catatan,
      estimasiSelesai: t.estimasi_selesai,
      items: (t.transaksi_items || []).map((it: any) => ({
        layanan: it.layanan,
        qty: Number(it.qty) || 1,
        hargaSatuan: Number(it.harga_satuan) || 0,
        subtotal: Number(it.subtotal) || 0,
      })),
      pipeline: rawPipeline,
    };
  });
}

// ============================================================
// VERIFIKASI PIN INSTAN (<15ms)
// ============================================================
function createSessionToken(role: 'MANAGER' | 'STAFF', label: string): string {
  const payload = {
    role,
    label,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };
  const jsonStr = JSON.stringify(payload);
  const b64 = typeof window !== 'undefined'
    ? btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
    : Buffer.from(jsonStr).toString('base64');
  const b64url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url}.sig_${Date.now()}`;
}

let cachedSecuritySettings: { pinManager: string; pinStaff: string; emailManager: string; fetchedAt: number } | null = null;

export function invalidateSecurityCache() {
  cachedSecuritySettings = null;
}

export async function sbVerifikasiPin(pin: string) {
  const cleanPin = String(pin).trim();
  const sb = getSupabase();

  let managerPin = '888888';
  let staffPin = '1234';

  const now = Date.now();
  if (cachedSecuritySettings && (now - cachedSecuritySettings.fetchedAt < 60000)) {
    managerPin = cachedSecuritySettings.pinManager;
    staffPin = cachedSecuritySettings.pinStaff;
  } else if (sb) {
    try {
      const { data: secSetting } = await sb
        .from('app_settings')
        .select('value')
        .eq('key', 'security_settings')
        .maybeSingle();

      if (secSetting?.value) {
        if (secSetting.value.pinManager) managerPin = String(secSetting.value.pinManager);
        if (secSetting.value.pinStaff) staffPin = String(secSetting.value.pinStaff);
        cachedSecuritySettings = {
          pinManager: managerPin,
          pinStaff: staffPin,
          emailManager: secSetting.value.emailManager || '',
          fetchedAt: now,
        };
      }
    } catch {
      // fallback
    }
  }

  let matchedRole: 'MANAGER' | 'STAFF' | null = null;
  let matchedLabel = '';

  if (cleanPin === managerPin) {
    matchedRole = 'MANAGER';
    matchedLabel = 'Manager / Owner';
  } else if (cleanPin === staffPin) {
    matchedRole = 'STAFF';
    matchedLabel = 'Staff / Kasir';
  } else {
    return { success: false, message: 'PIN Salah! Akses Ditolak.' };
  }

  // Generate Supabase session token secara instan (<5ms)
  const sessionToken = createSessionToken(matchedRole, matchedLabel);

  // Jalankan fetch token GAS secara asinkron di background (fire-and-forget)
  // tanpa memblokir respon login pengguna
  const gasUrl = process.env.NEXT_PUBLIC_GAS_API_URL;
  if (gasUrl && typeof window !== 'undefined') {
    setTimeout(() => {
      fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'verifikasiPin', args: [cleanPin] }),
      })
        .then((res) => res.json())
        .then((gasData) => {
          if (gasData && gasData.success && gasData.sessionToken) {
            try {
              localStorage.setItem('gas_session_token', gasData.sessionToken);
            } catch {}
          }
        })
        .catch(() => {});
    }, 50);
  }

  return {
    success: true,
    role: matchedRole,
    label: matchedLabel,
    sessionToken,
  };
}

export async function sbCheckDuplicateItemCodes() {
  const sb = getSupabase();
  if (!sb) return { hasDuplicates: false, totalDuplicateGroups: 0, totalDuplicateRows: 0, duplicateGroups: [] };

  try {
    const { data, error } = await sb
      .from('layanan')
      .select('id, nama, harga, satuan, icon, tipe, kategori');

    if (error || !data || data.length === 0) {
      return { hasDuplicates: false, totalDuplicateGroups: 0, totalDuplicateRows: 0, duplicateGroups: [] };
    }

    const codeMap: Record<string, any[]> = {};
    data.forEach((item: any) => {
      const code = String(item.id || '').trim();
      if (!code) return;
      const upper = code.toUpperCase();
      if (!codeMap[upper]) codeMap[upper] = [];
      codeMap[upper].push(item);
    });

    const duplicateGroups: any[] = [];
    let totalDuplicateRows = 0;

    for (const [code, items] of Object.entries(codeMap)) {
      if (items.length > 1) {
        totalDuplicateRows += items.length;
        duplicateGroups.push({
          originalCode: code,
          totalItems: items.length,
          items: items.map((it: any, idx: number) => ({
            id: it.id,
            nama: it.nama,
            tipe: it.tipe,
            kategori: it.kategori,
            harga: Number(it.harga) || 0,
            suggestedCode: idx === 0 ? it.id : `${it.id}-${idx + 1}`,
          })),
        });
      }
    }

    return {
      hasDuplicates: duplicateGroups.length > 0,
      totalDuplicateGroups: duplicateGroups.length,
      totalDuplicateRows,
      duplicateGroups,
    };
  } catch (err) {
    console.error('[sbCheckDuplicateItemCodes] Error:', err);
    return { hasDuplicates: false, totalDuplicateGroups: 0, totalDuplicateRows: 0, duplicateGroups: [] };
  }
}

export async function sbGetRekapKinerjaPegawai(startDateStr?: string, endDateStr?: string) {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    // 1. Ambil daftar pegawai
    const { data: pegawaiList } = await sb
      .from('pegawai')
      .select('id, nama, jabatan')
      .order('nama', { ascending: true });

    const pegawaiMap: Record<string, { id: string; nama: string; jabatan: string; totalTransaksi: number; totalOmzet: number }> = {};
    (pegawaiList || []).forEach((p: any) => {
      pegawaiMap[p.nama] = {
        id: p.id || '-',
        nama: p.nama,
        jabatan: p.jabatan || 'Kasir',
        totalTransaksi: 0,
        totalOmzet: 0,
      };
    });

    // 2. Ambil transaksi non-batal & non-void
    let query = sb
      .from('transaksi')
      .select('petugas, total, status, status_void, tanggal')
      .neq('status', 'Batal')
      .neq('status', 'Void')
      .neq('status_void', 'Approved');

    if (startDateStr) {
      query = query.gte('tanggal', startDateStr);
    }
    if (endDateStr) {
      query = query.lte('tanggal', `${endDateStr}T23:59:59`);
    }

    const { data: trxList } = await query;

    (trxList || []).forEach((t: any) => {
      const namaPetugas = t.petugas || 'Kasir';
      const total = Number(t.total) || 0;
      if (!pegawaiMap[namaPetugas]) {
        pegawaiMap[namaPetugas] = {
          id: '-',
          nama: namaPetugas,
          jabatan: 'Kasir/Petugas',
          totalTransaksi: 0,
          totalOmzet: 0,
        };
      }
      pegawaiMap[namaPetugas].totalTransaksi += 1;
      pegawaiMap[namaPetugas].totalOmzet += total;
    });

    return Object.values(pegawaiMap);
  } catch (err) {
    console.error('[sbGetRekapKinerjaPegawai] Error:', err);
    return [];
  }
}

export async function sbGetSecuritySettings() {
  const sb = getSupabase();
  if (!sb) return { emailManager: '' };

  const { data } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'security_settings')
    .maybeSingle();

  return data?.value || { emailManager: '' };
}

export async function sbSaveSecuritySettings(role: string, oldPin: string, newPin: string, emailManager?: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: cur } = await sb
    .from('app_settings')
    .select('value')
    .eq('key', 'security_settings')
    .maybeSingle();

  const currentVal = cur?.value || { pinManager: '888888', pinStaff: '1234', emailManager: '' };

  if (role === 'MANAGER') {
    if (oldPin && String(oldPin) !== String(currentVal.pinManager || '888888')) {
      return { success: false, message: 'PIN Manager lama salah!' };
    }
    if (newPin) currentVal.pinManager = String(newPin);
    if (emailManager) currentVal.emailManager = emailManager;
  } else if (role === 'STAFF') {
    if (newPin) currentVal.pinStaff = String(newPin);
  }

  await sb.from('app_settings').upsert({
    key: 'security_settings',
    value: currentVal,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  invalidateSecurityCache();

  return { success: true, message: 'Pengaturan keamanan berhasil disimpan.' };
}

// ============================================================
// LAPORAN OMZET & AGREGASI KILAT (<50ms)
// ============================================================
export async function sbGetLaporanRange(startDate: string, endDate: string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const startIso = new Date(`${startDate}T00:00:00+07:00`).toISOString();
  const endIso = new Date(`${endDate}T23:59:59+07:00`).toISOString();

  const { data: trxList, error } = await sb
    .from('transaksi')
    .select(`
      no_nota,
      tanggal,
      nama_pelanggan,
      no_hp,
      tipe,
      subtotal,
      diskon,
      total,
      metode_bayar,
      status_pembayaran,
      status,
      status_void,
      alasan_void,
      petugas,
      transaksi_items (
        layanan,
        qty,
        subtotal
      )
    `)
    .gte('tanggal', startIso)
    .lte('tanggal', endIso)
    .order('tanggal', { ascending: false });

  if (error) throw error;

  let totalOmzet = 0;
  let selfCount = 0;
  let fullCount = 0;
  let activeTrxCount = 0;
  const omzetHarianMap = new Map<string, { omzet: number; count: number }>();
  const layananMap = new Map<string, { qty: number; omzet: number }>();

  for (const t of trxList || []) {
    // Abaikan transaksi yang berstatus Void/Batal atau Approved Void dalam hitungan omzet
    const isVoidApproved = t.status_void === 'Approved' || t.status === 'Void' || t.status === 'Batal' || t.status === 'Dibatalkan';
    if (isVoidApproved) continue;

    activeTrxCount++;
    const total = Number(t.total) || 0;
    totalOmzet += total;
    if (t.tipe === 'FullService') fullCount++;
    else selfCount++;

    const dateStr = t.tanggal ? t.tanggal.slice(0, 10) : '';
    if (dateStr) {
      const cur = omzetHarianMap.get(dateStr) || { omzet: 0, count: 0 };
      cur.omzet += total;
      cur.count += 1;
      omzetHarianMap.set(dateStr, cur);
    }

    if (Array.isArray(t.transaksi_items)) {
      for (const it of t.transaksi_items) {
        const lay = it.layanan || 'Item';
        const cur = layananMap.get(lay) || { qty: 0, omzet: 0 };
        cur.qty += Number(it.qty) || 1;
        cur.omzet += Number(it.subtotal) || 0;
        layananMap.set(lay, cur);
      }
    }
  }

  const jumlahTransaksi = activeTrxCount;
  const rataRata = jumlahTransaksi > 0 ? Math.round(totalOmzet / jumlahTransaksi) : 0;

  const omzetHarian = Array.from(omzetHarianMap.entries())
    .map(([tanggal, val]) => ({ tanggal, omzet: val.omzet, jumlahTransaksi: val.count }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const layananTerlaris = Array.from(layananMap.entries())
    .map(([layanan, val]) => ({ layanan, qty: val.qty, omzet: val.omzet }))
    .sort((a, b) => b.omzet - a.omzet)
    .slice(0, 10);

  return {
    ringkasan: {
      totalOmzet,
      jumlahTransaksi,
      rataRata,
      selfCount,
      fullCount,
    },
    omzetHarian,
    layananTerlaris,
    transaksiList: (trxList || []).map((t: any) => ({
      noNota: t.no_nota,
      tanggal: t.tanggal,
      namaPelanggan: t.nama_pelanggan,
      noHp: t.no_hp,
      tipe: t.tipe,
      subtotal: Number(t.subtotal) || 0,
      diskon: Number(t.diskon) || 0,
      total: Number(t.total) || 0,
      metodeBayar: t.metode_bayar,
      statusPembayaran: t.status_pembayaran,
      status: t.status,
      statusVoid: t.status_void,
      alasanVoid: t.alasan_void,
      petugas: t.petugas,
      items: Array.isArray(t.transaksi_items) ? t.transaksi_items.map((it: any) => ({
        layanan: it.layanan,
        qty: Number(it.qty) || 1,
        subtotal: Number(it.subtotal) || 0,
      })) : [],
    })),
  };
}

export async function sbGetPendingVoidList(): Promise<Transaksi[]> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: trxList, error } = await sb
    .from('transaksi')
    .select(`
      *,
      transaksi_items (*),
      pipeline_steps (*)
    `)
    .eq('status_void', 'PendingApproval')
    .order('tanggal', { ascending: false });

  if (error) throw error;

  return (trxList || []).map((t: any) => ({
    noNota: t.no_nota,
    tanggal: formatDateTime(t.tanggal),
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
  }));
}

// ============================================================
// APP CONFIGURATIONS & SETTINGS (INSTANT)
// ============================================================
export async function sbGetPoinConfig(): Promise<{ rate: number }> {
  const sb = getSupabase();
  if (!sb) return { rate: 10000 };

  try {
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'poin_config')
      .maybeSingle();

    if (data?.value?.rate) return { rate: Number(data.value.rate) || 10000 };
  } catch {}
  return { rate: 10000 };
}

export async function sbSavePoinConfig(rate: number) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  await sb.from('app_settings').upsert({
    key: 'poin_config',
    value: { rate: Number(rate) || 10000 },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  return { success: true, rate };
}

export async function sbGetPriorityConfig(): Promise<any[]> {
  const DEFAULT_PRIORITIES = [
    { nama: 'Reguler', durasiJam: 48, biayaTambahan: 0, deskripsi: 'Selesai dalam 48 jam' },
    { nama: 'Express', durasiJam: 24, biayaTambahan: 5000, deskripsi: 'Selesai dalam 24 jam' },
    { nama: 'Kilat', durasiJam: 6, biayaTambahan: 10000, deskripsi: 'Selesai dalam 6 jam' },
  ];

  const sb = getSupabase();
  if (!sb) return DEFAULT_PRIORITIES;

  try {
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'priority_config')
      .maybeSingle();

    if (Array.isArray(data?.value) && data.value.length > 0) return data.value;
  } catch {}
  return DEFAULT_PRIORITIES;
}

export async function sbSavePriorityConfig(priorities: any[]) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  await sb.from('app_settings').upsert({
    key: 'priority_config',
    value: priorities,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  return { success: true };
}

export async function sbGetPipelineConfigData(): Promise<any[]> {
  const DEFAULT_STEPS = [
    { step: 1, nama: 'Diterima', color: 'blue', icon: 'Inbox' },
    { step: 2, nama: 'Dicuci', color: 'teal', icon: 'Droplets' },
    { step: 3, nama: 'Dikeringkan', color: 'amber', icon: 'Wind' },
    { step: 4, nama: 'Disetrika', color: 'purple', icon: 'Flame' },
    { step: 5, nama: 'Dilipat', color: 'indigo', icon: 'Fold' },
    { step: 6, nama: 'Siap Diambil', color: 'emerald', icon: 'CheckCircle' },
    { step: 7, nama: 'Selesai', color: 'slate', icon: 'CheckCheck' },
  ];

  const sb = getSupabase();
  if (!sb) return DEFAULT_STEPS;

  try {
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', 'pipeline_config')
      .maybeSingle();

    if (Array.isArray(data?.value) && data.value.length > 0) return data.value;
  } catch {}
  return DEFAULT_STEPS;
}

export async function sbSavePipelineConfigData(steps: any[]) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  await sb.from('app_settings').upsert({
    key: 'pipeline_config',
    value: steps,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  return { success: true };
}

export async function sbGetRiwayatPelangganByHp(noHp: string): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('transaksi')
    .select(`
      *,
      transaksi_items (*)
    `)
    .eq('no_hp', noHp)
    .order('tanggal', { ascending: false });

  if (error) return [];
  return (data || []).map((t: any) => ({
    noNota: t.no_nota,
    tanggal: formatDateTime(t.tanggal),
    namaPelanggan: t.nama_pelanggan,
    total: Number(t.total) || 0,
    status: t.status,
    statusPembayaran: t.status_pembayaran,
    metodeBayar: t.metode_bayar,
    tipe: t.tipe,
    items: (t.transaksi_items || []).map((it: any) => ({
      layanan: it.layanan,
      qty: Number(it.qty) || 1,
      hargaSatuan: Number(it.harga_satuan) || 0,
      subtotal: Number(it.subtotal) || 0,
    })),
  }));
}

export async function sbGetTransaksiByNota(
  noNota?: string,
  token?: string,
  last4Phone?: string
): Promise<{ success: boolean; transaksi?: any; message?: string }> {
  const sb = getSupabase();
  if (!sb) return { success: false, message: 'Database Supabase belum terhubung.' };

  let resolvedNota = (noNota || '').trim().toUpperCase();

  // Kalau ada token, decode untuk dapat noNota (URL mode: ?t=token)
  if (token && !resolvedNota) {
    const decoded = decodeNotaToken(token);
    if (decoded) {
      resolvedNota = decoded.trim().toUpperCase();
    } else {
      return { success: false, message: 'Link e-nota tidak valid atau telah kedaluwarsa.' };
    }
  }

  // Kalau ada keduanya, verifikasi token cocok dengan noNota
  if (token && resolvedNota) {
    const decoded = decodeNotaToken(token);
    if (decoded && decoded.trim().toUpperCase() !== resolvedNota) {
      return { success: false, message: 'Token e-nota tidak sesuai dengan nomor nota.' };
    }
  }

  if (!resolvedNota) {
    return { success: false, message: 'Parameter nomor nota tidak ditemukan.' };
  }

  const { data, error } = await sb
    .from('transaksi')
    .select(`
      *,
      transaksi_items (*),
      pipeline_steps (*)
    `)
    .ilike('no_nota', resolvedNota)
    .maybeSingle();

  if (error || !data) {
    return { success: false, message: `Nota "${resolvedNota}" tidak ditemukan di sistem.` };
  }

  // Proteksi 2-Faktor untuk pencarian manual publik tanpa token
  if (!token) {
    const clean4 = String(last4Phone || '').replace(/\D/g, '');
    if (clean4.length !== 4) {
      return {
        success: false,
        message: 'Verifikasi keamanan: Masukkan 4 digit terakhir nomor HP yang terdaftar pada nota.'
      };
    }
    const normPhone = normalizePhone(data.no_hp || '');
    if (!normPhone || !normPhone.endsWith(clean4)) {
      return {
        success: false,
        message: `Nota "${resolvedNota}" tidak cocok dengan 4 digit nomor HP yang dimasukkan.`
      };
    }
  }

  let rawPipeline: any[] = (data.pipeline_steps || [])
      .sort((a: any, b: any) => (Number(a.step) || 0) - (Number(b.step) || 0))
      .map((p: any) => ({
        step: p.step,
        namaStep: p.nama_step,
        status: p.status,
        assignedStaff: p.assigned_staff,
      }));

    // Jika belum ada pipeline_steps di database, selesaikan langkah aktif spesifik per layanan dari app_settings / nama layanan
    if (rawPipeline.length === 0 && (data.tipe === 'FullService' || data.tipe === 'DropOff' || data.tipe === 'Drop Off')) {
      try {
        const { data: pipeSetting } = await sb
          .from('app_settings')
          .select('value')
          .eq('key', 'layanan_pipeline_steps')
          .maybeSingle();
        const pipeMap = (pipeSetting?.value && typeof pipeSetting.value === 'object') ? pipeSetting.value : {};

        let customSteps: any[] | null = null;
        const items = data.transaksi_items || [];

        for (const it of items) {
          if (it.layanan && pipeMap[it.layanan] && pipeMap[it.layanan].length > 0) {
            customSteps = pipeMap[it.layanan];
            break;
          }
        }

        if (!customSteps) {
          const { data: allLay } = await sb.from('layanan').select('id, nama');
          for (const it of items) {
            const itName = String(it.layanan || '').trim().toLowerCase();
            const match = allLay?.find((l: any) =>
              String(l.nama || '').trim().toLowerCase() === itName ||
              String(l.id || '').trim().toLowerCase() === itName
            );
            if (match && pipeMap[match.id] && pipeMap[match.id].length > 0) {
              customSteps = pipeMap[match.id];
              break;
            }
          }
        }

        const txStatus = String(data.status || 'Diterima').toLowerCase();

        if (Array.isArray(customSteps) && customSteps.length > 0) {
          const targetStepIdx = (() => {
            if (txStatus === 'selesai' || txStatus.includes('diambil') || txStatus.includes('siap')) {
              return customSteps.length - 1;
            }
            const idx = customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase() === txStatus);
            if (idx >= 0) return idx;
            if (txStatus.includes('setrika')) return customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase().includes('setrika'));
            if (txStatus.includes('lipat')) return customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase().includes('lipat'));
            if (txStatus.includes('kering')) return customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase().includes('kering'));
            if (txStatus.includes('cuci')) return customSteps.findIndex((cs: any) => String(cs.nama || '').toLowerCase().includes('cuci'));
            return 0;
          })();

          rawPipeline = customSteps.map((cs: any, idx: number) => {
            let st = 'Pending';
            if (txStatus === 'selesai') {
              st = 'Selesai';
            } else if (idx < targetStepIdx) {
              st = 'Selesai';
            } else if (idx === targetStepIdx) {
              st = 'Aktif';
            }
            return {
              step: idx + 1,
              namaStep: cs.nama || `Langkah ${idx + 1}`,
              status: st,
              assignedStaff: null,
            };
          });
        } else {
          // Analisis deduksi berbasis nama layanan jika belum ada di pipeMap
          const allItemNames = items.map((i: any) => String(i.layanan || '').toLowerCase()).join(' ');
          let defaultStepNames = ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika / Packing', 'Siap Diambil'];
          if (allItemNames.includes('cuci kering') || (allItemNames.includes('kering') && !allItemNames.includes('setrika') && !allItemNames.includes('komplit'))) {
            defaultStepNames = ['Diterima', 'Dicuci', 'Dikeringkan', 'Siap Diambil'];
          } else if (allItemNames.includes('setrika') && !allItemNames.includes('cuci')) {
            defaultStepNames = ['Diterima', 'Disetrika / Packing', 'Siap Diambil'];
          } else if (allItemNames.includes('lipat') && !allItemNames.includes('setrika')) {
            defaultStepNames = ['Diterima', 'Dicuci', 'Dikeringkan', 'Dilipat / Packing', 'Siap Diambil'];
          }

          const targetStepIdx = (() => {
            if (txStatus === 'selesai' || txStatus.includes('diambil') || txStatus.includes('siap')) {
              return defaultStepNames.length - 1;
            }
            const idx = defaultStepNames.findIndex((name) => name.toLowerCase().includes(txStatus));
            if (idx >= 0) return idx;
            if (txStatus.includes('cuci')) return defaultStepNames.findIndex(n => n.toLowerCase().includes('cuci'));
            if (txStatus.includes('kering')) return defaultStepNames.findIndex(n => n.toLowerCase().includes('kering'));
            if (txStatus.includes('setrika')) return defaultStepNames.findIndex(n => n.toLowerCase().includes('setrika'));
            if (txStatus.includes('lipat')) return defaultStepNames.findIndex(n => n.toLowerCase().includes('lipat'));
            return 0;
          })();

          rawPipeline = defaultStepNames.map((name, idx) => {
            let st = 'Pending';
            if (txStatus === 'selesai') {
              st = 'Selesai';
            } else if (idx < targetStepIdx) {
              st = 'Selesai';
            } else if (idx === targetStepIdx) {
              st = 'Aktif';
            }
            return {
              step: idx + 1,
              namaStep: name,
              status: st,
              assignedStaff: null,
            };
          });
        }
      } catch (e) {
        console.warn('[sbGetTransaksiByNota] Error resolving dynamic pipeline steps:', e);
      }
    }

    const txFormatted = {
      noNota: data.no_nota,
      tanggal: formatDateTime(data.tanggal),
      namaPelanggan: data.nama_pelanggan,
      noHp: data.no_hp,
      alamat: data.alamat,
      isMember: data.is_member,
      poinEarned: data.poin_earned,
      petugas: data.petugas,
      tipe: data.tipe,
      tingkatLayanan: data.tingkat_layanan,
      subtotal: Number(data.subtotal) || 0,
      diskon: Number(data.diskon) || 0,
      total: Number(data.total) || 0,
      nominalDP: Number(data.nominal_dp) || 0,
      sisaTagihan: Number(data.sisa_tagihan) || 0,
      nominalBayar: Number(data.nominal_bayar) || 0,
      metodeBayar: data.metode_bayar,
      statusPembayaran: data.status_pembayaran,
      status: data.status,
      statusVoid: data.status_void,
      alasanVoid: data.alasan_void,
      catatan: data.catatan,
      estimasiSelesai: data.estimasi_selesai,
      items: (data.transaksi_items || []).map((it: any) => ({
        layanan: it.layanan,
        qty: Number(it.qty) || 1,
        hargaSatuan: Number(it.harga_satuan) || 0,
        subtotal: Number(it.subtotal) || 0,
      })),
      pipeline: rawPipeline,
    };

  return {
    success: true,
    transaksi: txFormatted,
  };
}

export async function sbPelunasanDP(noNota: string, nominal: number, metode = 'Tunai') {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: trx, error: getErr } = await sb
    .from('transaksi')
    .select('nominal_bayar, sisa_tagihan, total')
    .eq('no_nota', noNota)
    .single();

  if (getErr) throw getErr;

  const curBayar = Number(trx?.nominal_bayar) || 0;
  const curSisa = Number(trx?.sisa_tagihan) || 0;
  const newBayar = curBayar + Number(nominal);
  const newSisa = Math.max(0, curSisa - Number(nominal));
  const newStatus = newSisa <= 0 ? 'Lunas' : 'DP';

  const { data, error } = await sb
    .from('transaksi')
    .update({
      nominal_bayar: newBayar,
      sisa_tagihan: newSisa,
      status_pembayaran: newStatus,
      metode_bayar: metode,
      updated_at: new Date().toISOString(),
    })
    .eq('no_nota', noNota)
    .select()
    .single();

  if (error) throw error;

  try {
    await sbLogClientActivity(
      'Kasir',
      'Pelunasan Nota',
      noNota,
      `Sisa Tagihan: Rp ${curSisa.toLocaleString('id-ID')}`,
      `Bayar: Rp ${Number(nominal).toLocaleString('id-ID')} (${metode}), Sisa: Rp ${newSisa.toLocaleString('id-ID')}`,
      `Pelunasan tagihan nota ${noNota} sebesar Rp ${Number(nominal).toLocaleString('id-ID')} via ${metode} (Status: ${newStatus})`
    );
  } catch (e) {}

  return { success: true, message: 'Pelunasan DP berhasil disimpan', data };
}

// ============================================================
// OPERASIONAL LANJUTAN (VOUCHER, VOID, AUDIT, HANDOVER, SHIFT)
// ============================================================
export async function sbValidasiVoucher(kode: string, subtotal: number, noHp?: string, isMember = false) {
  const sb = getSupabase();
  if (!sb) return { valid: false, message: 'Database belum terhubung' };

  const cleanKode = String(kode || '').trim().toUpperCase();
  const { data: promo, error } = await sb
    .from('promo')
    .select('*')
    .eq('kode_voucher', cleanKode)
    .maybeSingle();

  if (error || !promo) {
    return { valid: false, message: 'Kode voucher tidak ditemukan.' };
  }

  if (promo.status_aktif === false) {
    return { valid: false, message: 'Voucher sudah tidak aktif.' };
  }

  const minTrx = Number(promo.min_transaksi) || 0;
  if (subtotal < minTrx) {
    return { valid: false, message: `Minimal transaksi untuk voucher ini adalah Rp ${minTrx.toLocaleString('id-ID')}` };
  }

  let potongan = 0;
  const nilai = Number(promo.nilai_diskon) || 0;
  if (promo.jenis_diskon === 'Persen') {
    potongan = Math.round((subtotal * nilai) / 100);
    const maks = Number(promo.maks_potongan) || 0;
    if (maks > 0 && potongan > maks) potongan = maks;
  } else {
    potongan = nilai;
  }

  return {
    valid: true,
    kode: cleanKode,
    nilai: potongan,
    jenisDiskon: promo.jenis_diskon,
    potongan,
    message: `Voucher berhasil digunakan! Hemat Rp ${potongan.toLocaleString('id-ID')}`,
  };
}

export async function sbCekPoinPelanggan(noHp: string) {
  const sb = getSupabase();
  if (!sb) return { success: false, message: 'Database Supabase belum terhubung.' };

  const cleanPhone = String(noHp || '').trim();
  const norm = normalizePhone(cleanPhone);
  if (!norm || norm.length < 9) {
    return { success: false, message: 'Format nomor WhatsApp tidak valid. Masukkan minimal 9 digit.' };
  }

  // Ambil data pelanggan untuk dicocokkan nomor teleponnya (mendukung 08..., 8..., +62...)
  const { data: allPelanggan, error } = await sb
    .from('pelanggan')
    .select('*');

  if (error || !allPelanggan || allPelanggan.length === 0) {
    return { success: false, message: `Nomor "${cleanPhone}" belum terdaftar sebagai pelanggan di Dua SiSi Laundry.` };
  }

  const found = allPelanggan.find((p: any) => {
    const pNorm = normalizePhone(p.no_hp);
    return pNorm === norm || pNorm.endsWith(norm) || norm.endsWith(pNorm);
  });

  if (!found) {
    return { success: false, message: `Nomor "${cleanPhone}" belum terdaftar sebagai pelanggan di Dua SiSi Laundry.` };
  }

  // Ambil riwayat order aktif jika ada
  const activeOrders: Array<{
    noNota: string;
    tipe: string;
    status: string;
    estimasiSelesai: string;
  }> = [];

  try {
    const { data: txList } = await sb
      .from('transaksi')
      .select('no_nota, tipe, status, estimasi_selesai, created_at')
      .or(`no_hp.eq.${found.no_hp},no_hp.eq.${norm}`)
      .not('status', 'in', '("Selesai","Dibatalkan","Void")')
      .order('created_at', { ascending: false })
      .limit(3);

    if (txList && txList.length > 0) {
      for (const t of txList) {
        activeOrders.push({
          noNota: t.no_nota,
          tipe: t.tipe || 'Drop Off',
          status: t.status || 'Diterima',
          estimasiSelesai: t.estimasi_selesai ? formatDateTime(t.estimasi_selesai) : '-'
        });
      }
    }
  } catch (e) {
    console.warn('[sbCekPoinPelanggan] Gagal memuat pesanan aktif:', e);
  }

  const isMember = Boolean(found.is_member) || String(found.status_member || '').toUpperCase() === 'MEMBER';
  const totalOrder = Number(found.total_order) || 0;
  const saldoPoin = Number(found.saldo_poin) || 0;

  return {
    success: true,
    pelanggan: {
      noHp: found.no_hp || norm,
      nama: found.nama || 'Pelanggan',
      maskedNama: maskName(found.nama || 'Pelanggan'),
      maskedHp: maskPhone(found.no_hp || norm),
      alamat: found.alamat || '',
      saldoPoin: saldoPoin,
      totalOrder: totalOrder,
      totalSpend: Number(found.total_spend) || 0,
      terakhirOrder: found.terakhir_order ? formatDateTime(found.terakhir_order) : '-',
      isMember: isMember,
      statusMember: isMember ? 'MEMBER VIP' : 'PELANGGAN REGULER',
      statusKategori: isMember ? 'Member' : (totalOrder > 1 ? 'Pelanggan Lama' : 'Pelanggan Baru'),
      tglDaftar: found.tgl_daftar ? formatDateTime(found.tgl_daftar) : '',
      stamps75: Number(found.stamps_75) || 0,
      stamps45: Number(found.stamps_45) || 0,
      activeOrders: activeOrders
    }
  };
}

export async function sbToggleAktifLayanan(id: string, aktif: boolean | string) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const aktifStr = (aktif === true || aktif === 'Y' || aktif === 'true') ? 'Y' : 'N';
  const { data, error } = await sb
    .from('layanan')
    .update({ aktif: aktifStr })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

export async function sbPautkanInventoryLayanan(idLayanan: string, idInventory: string, deductionQty = 1) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('layanan')
    .update({
      id_inventory: idInventory || null,
      inventory_deduction_qty: Number(deductionQty) || 1,
    })
    .eq('id', idLayanan)
    .select()
    .single();

  if (error) throw error;
  return { success: true, data };
}

function sbFormatWib(dateInput: string | Date | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const wib = new Date(d.getTime() + 7 * 3600000);
    const yyyy = wib.getUTCFullYear();
    const mm = String(wib.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(wib.getUTCDate()).padStart(2, '0');
    const hh = String(wib.getUTCHours()).padStart(2, '0');
    const min = String(wib.getUTCMinutes()).padStart(2, '0');
    const ss = String(wib.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  } catch {
    return String(dateInput);
  }
}

export function mapAuditRow(l: any): AuditLog {
  const p = (l.payload && typeof l.payload === 'object') ? l.payload : {};
  const idStr = l.id ? String(l.id) : '';
  const shortId = idStr.length > 18 ? `LOG-${idStr.substring(0, 8).toUpperCase()}` : (idStr || `LOG-${Date.now()}`);

  return {
    idLog: shortId,
    idUser: p.idUser || l.user_id,
    namaUser: l.user_name || p.namaUser || 'System',
    jenisAktivitas: l.action || p.jenisAktivitas || 'Aktivitas',
    referensi: p.referensi || l.referensi || '-',
    detail: l.detail || p.detail || '-',
    dataSebelum: p.dataSebelum || '-',
    dataSesudah: p.dataSesudah || '-',
    waktu: sbFormatWib(l.created_at),
  };
}

export async function sbLogClientActivity(
  namaUser: string,
  jenisAktivitas: string,
  referensi?: string,
  dataSebelum?: string,
  dataSesudah?: string,
  detail?: string
): Promise<{ success: boolean; data?: any; message?: string }> {
  const sb = getSupabase();
  if (!sb) return { success: false, message: 'Supabase belum dikonfigurasi' };

  try {
    const payloadData: Record<string, any> = {
      referensi: referensi || '-',
      dataSebelum: dataSebelum || '-',
      dataSesudah: dataSesudah || '-',
      detail: detail || `${jenisAktivitas || 'Aktivitas'} pada ${referensi || 'sistem'}`,
      namaUser: namaUser || 'System',
    };

    const { data, error } = await sb.from('audit_logs').insert([
      {
        action: jenisAktivitas || 'Aktivitas',
        user_name: namaUser || 'System',
        detail: detail || `${jenisAktivitas || 'Aktivitas'} pada ${referensi || 'sistem'}`,
        payload: payloadData,
      },
    ]).select();

    if (error) {
      console.warn('Gagal mencatat audit log ke Supabase:', error);
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.warn('Error saat sbLogClientActivity:', err);
    return { success: false, message: err.message };
  }
}

export async function sbBackfillAuditLogs(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;

  try {
    const { data: txList } = await sb
      .from('transaksi')
      .select('*')
      .order('tanggal', { ascending: true });

    const { data: shiftList } = await sb
      .from('kas_shift')
      .select('*')
      .order('waktu_buka', { ascending: true });

    const { data: memberList } = await sb
      .from('pelanggan')
      .select('*')
      .eq('is_member', true)
      .limit(50);

    const generatedLogs: any[] = [];

    // Map shifts
    for (const s of shiftList || []) {
      const kasAwalStr = `Rp ${(Number(s.kas_awal) || 0).toLocaleString('id-ID')}`;
      const kasAkhirStr = `Rp ${(Number(s.kas_akhir_fisik) || 0).toLocaleString('id-ID')}`;
      const openTime = s.waktu_buka || s.created_at;

      generatedLogs.push({
        action: 'Buka Kas Shift',
        user_name: s.nama_kasir || 'Kasir',
        detail: `Buka kas shift laci - Kas awal ${kasAwalStr}`,
        payload: {
          referensi: s.id_shift,
          dataSebelum: '-',
          dataSesudah: `Kas Awal: ${kasAwalStr}`,
          detail: `Buka kas shift laci - Kas awal ${kasAwalStr}`,
          namaUser: s.nama_kasir || 'Kasir',
        },
        created_at: openTime,
      });

      if (s.status === 'Tutup' || s.waktu_tutup) {
        const closeTime = s.waktu_tutup || s.created_at;
        const selisihStr = `Rp ${(Number(s.selisih_kas) || 0).toLocaleString('id-ID')}`;
        generatedLogs.push({
          action: 'Tutup Kas Shift',
          user_name: s.nama_kasir || 'Kasir',
          detail: `Tutup kas shift - Kas fisik ${kasAkhirStr}, Selisih ${selisihStr}`,
          payload: {
            referensi: s.id_shift,
            dataSebelum: `Kas Awal: ${kasAwalStr}`,
            dataSesudah: `Kas Fisik: ${kasAkhirStr}`,
            detail: `Tutup kas shift (${s.mode_tutup || 'Tutup Harian'}) - Kas fisik ${kasAkhirStr}`,
            namaUser: s.nama_kasir || 'Kasir',
          },
          created_at: closeTime,
        });
      }
    }

    // Map members
    for (const m of memberList || []) {
      generatedLogs.push({
        action: 'Daftar Member',
        user_name: 'Kasir',
        detail: `Registrasi membership loyalitas - ${m.nama} (${m.no_hp || '-'})`,
        payload: {
          referensi: m.no_hp || m.id || '-',
          dataSebelum: '-',
          dataSesudah: `Member Aktif (Poin: ${m.poin || 0})`,
          detail: `Registrasi membership loyalitas - ${m.nama}`,
          namaUser: 'Kasir',
        },
        created_at: m.created_at || new Date().toISOString(),
      });
    }

    // Map transactions
    for (const t of txList || []) {
      const totalStr = `Rp ${(Number(t.total) || 0).toLocaleString('id-ID')}`;
      const act = 
        t.status_void === 'PendingApproval' ? 'Pengajuan Void' :
        (t.status_void === 'Approved' || t.status === 'Dibatalkan') ? 'Void Transaksi' :
        'Transaksi Baru';

      generatedLogs.push({
        action: act,
        user_name: t.petugas || 'Kasir',
        detail: `Transaksi ${t.tipe || 'SelfService'} - ${t.nama_pelanggan || 'Pelanggan'} (${t.status_pembayaran || 'Lunas'}, ${totalStr})`,
        payload: {
          referensi: t.no_nota,
          dataSebelum: '-',
          dataSesudah: `Status: ${t.status || 'Selesai'}, Total: ${totalStr}`,
          detail: `Transaksi ${t.tipe || 'SelfService'} - ${t.nama_pelanggan || 'Pelanggan'} (${t.metode_bayar || 'Tunai'}, ${t.status_pembayaran || 'Lunas'})`,
          namaUser: t.petugas || 'Kasir',
        },
        created_at: t.tanggal || t.created_at || new Date().toISOString(),
      });
    }

    if (generatedLogs.length === 0) return 0;

    // Sort by created_at asc so insertion maintains chronological order
    generatedLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Insert in batches of 50
    const chunkSize = 50;
    for (let i = 0; i < generatedLogs.length; i += chunkSize) {
      const chunk = generatedLogs.slice(i, i + chunkSize);
      await sb.from('audit_logs').insert(chunk);
    }

    return generatedLogs.length;
  } catch (e) {
    console.error('Backfill audit logs gagal:', e);
    return 0;
  }
}

export async function sbGetAuditLogs(limit = 500): Promise<AuditLog[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[sbGetAuditLogs] Error:', error);
    return [];
  }

  // Jika tabel masih kosong, lakukan auto-backfill dari data transaksi, shift, dan member
  if (!data || data.length === 0) {
    await sbBackfillAuditLogs();
    const { data: refetched } = await sb
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (refetched || []).map(mapAuditRow);
  }

  return data.map(mapAuditRow);
}

export async function sbAjukanVoidTransaksi(noNota: string, alasan: string, petugas = 'Kasir') {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb
    .from('transaksi')
    .update({
      status_void: 'PendingApproval',
      alasan_void: alasan || 'Diajukan pembatalan oleh kasir',
      updated_at: new Date().toISOString(),
    })
    .eq('no_nota', noNota)
    .select()
    .single();

  if (error) throw error;

  try {
    await sbLogClientActivity(
      petugas || 'Kasir',
      'Pengajuan Void',
      noNota,
      'Status: Aktif',
      'Status Void: PendingApproval',
      `Permohonan void nota ${noNota}. Alasan: ${alasan || '-'}`
    );
  } catch (e) {}

  return { success: true, data };
}

export async function sbApproveVoidTransaksi(
  noNota: string, 
  statusApproval: string | boolean,
  managerName = 'Manager / Owner',
  managerId = 'MANAGER',
  catatan = ''
) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const isApproved = statusApproval === true || statusApproval === 'Approved';
  const updates: any = {
    status_void: isApproved ? 'Approved' : 'Rejected',
    updated_at: new Date().toISOString(),
  };
  if (isApproved) {
    updates.status = 'Dibatalkan';
  }

  const { data, error } = await sb
    .from('transaksi')
    .update(updates)
    .eq('no_nota', noNota)
    .select()
    .single();

  if (error) throw error;

  // Kembalikan stok inventory yang sempat terpotong jika void disetujui
  if (isApproved) {
    try {
      const { data: items } = await sb
        .from('transaksi_items')
        .select('*')
        .eq('no_nota', noNota);

      for (const it of items || []) {
        if (it.id_inventory) {
          const mult = Number(it.inventory_deduction_qty) || 1;
          const returnQty = (Number(it.qty) || 1) * mult;
          await sbUpdateStokInventory(it.id_inventory, returnQty);
        }
      }
    } catch (e) {
      console.warn('Gagal kembalikan stok inventory void:', e);
    }
  }

  try {
    await sbLogClientActivity(
      managerName || 'Manager',
      isApproved ? 'Approve Void' : 'Reject Void',
      noNota,
      'Status Void: PendingApproval',
      isApproved ? 'Void Disetujui (Dibatalkan)' : 'Void Ditolak',
      `${isApproved ? 'Persetujuan' : 'Penolakan'} permohonan void nota ${noNota} oleh ${managerName}. Catatan: ${catatan || '-'}`
    );
  } catch (e) {}

  return { success: true, data };
}

export async function sbHandoverCheckKasShift(idOutlet = 'OUTLET-UTAMA') {
  const sb = getSupabase();
  if (!sb) return { adaShiftAktif: false };

  const { data: shift } = await sb
    .from('kas_shift')
    .select('*')
    .eq('id_outlet', idOutlet)
    .eq('status', 'Buka')
    .order('waktu_buka', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return { adaShiftAktif: false };

  return {
    adaShiftAktif: true,
    idShift: shift.id_shift,
    namaKasir: shift.nama_kasir,
    waktuBuka: shift.waktu_buka,
    kasAwal: Number(shift.kas_awal) || 0,
    saldoMerchantAwal: Number(shift.saldo_merchant_awal) || 0,
    totalPenjualanTunai: Number(shift.total_penjualan_tunai) || 0,
    totalPenjualanNonTunai: Number(shift.total_penjualan_non_tunai) || 0,
  };
}

export async function sbGetMasterShiftList(): Promise<any[]> {
  const sb = getSupabase();
  const DEFAULT_SHIFTS = [
    { id: 'SHIFT-1', nama: 'Shift Pagi', jamMasuk: '07:00', jamPulang: '15:00', status: 'Aktif' },
    { id: 'SHIFT-2', nama: 'Shift Siang', jamMasuk: '15:00', jamPulang: '23:00', status: 'Aktif' },
  ];
  if (!sb) return DEFAULT_SHIFTS;

  try {
    const { data } = await sb.from('app_settings').select('value').eq('key', 'master_shifts').maybeSingle();
    if (Array.isArray(data?.value) && data.value.length > 0) return data.value;
  } catch {}
  return DEFAULT_SHIFTS;
}

export const DEFAULT_DROPOFF_INCENTIVE_CONFIG: DropoffIncentiveConfig = {
  rates: {
    'Dicuci': 1500,
    'Dikeringkan': 1500,
    'Disetrika': 2500,
    'Lipat & Packing': 1000,
    'Packing': 1000,
    'Spotting Noda': 2000,
    'Treatment Khusus': 3000,
  },
  umumSteps: ['Pesanan Diterima', 'Diterima', 'Siap Diambil', 'Selesai'],
  customSteps: ['Dicuci', 'Dikeringkan', 'Disetrika', 'Lipat & Packing', 'Packing', 'Spotting Noda', 'Treatment Khusus'],
};

export async function sbGetDropoffIncentiveConfig(): Promise<DropoffIncentiveConfig> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_DROPOFF_INCENTIVE_CONFIG;

  try {
    const { data } = await sb.from('app_settings').select('value').eq('key', 'dropoff_incentive_config').maybeSingle();
    if (data?.value && typeof data.value === 'object') {
      return {
        rates: { ...DEFAULT_DROPOFF_INCENTIVE_CONFIG.rates, ...(data.value.rates || {}) },
        umumSteps: Array.isArray(data.value.umumSteps) ? data.value.umumSteps : DEFAULT_DROPOFF_INCENTIVE_CONFIG.umumSteps,
        customSteps: Array.isArray(data.value.customSteps) ? data.value.customSteps : DEFAULT_DROPOFF_INCENTIVE_CONFIG.customSteps,
      };
    }
  } catch (e) {
    console.warn('[sbGetDropoffIncentiveConfig] Error:', e);
  }
  return DEFAULT_DROPOFF_INCENTIVE_CONFIG;
}

export async function sbSaveDropoffIncentiveConfig(config: DropoffIncentiveConfig): Promise<{ success: boolean; data?: any; message?: string }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data, error } = await sb.from('app_settings').upsert({
    key: 'dropoff_incentive_config',
    value: config,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' }).select();

  if (error) throw error;

  try {
    await sbLogClientActivity(
      'Manager',
      'Pengaturan Tarif Insentif',
      'Drop Off Pipeline',
      '-',
      JSON.stringify(config.rates),
      'Pembaruan tarif insentif pengerjaan drop off per pipeline khusus'
    );
  } catch {}

  return { success: true, data };
}

// ============================================================
// MASTER SHIFTS MUTATION
// ============================================================
export async function sbTambahMasterShift(payload: any): Promise<{ success: boolean; data?: any }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const curList = await sbGetMasterShiftList();
  const id = `SHIFT-${Date.now()}`;
  const newItem = {
    id,
    nama: String(payload.nama || 'Shift').trim(),
    jamMasuk: String(payload.jamMasuk || '07:00').trim(),
    jamKeluar: String(payload.jamKeluar || payload.jamPulang || '15:00').trim(),
    keterangan: payload.keterangan || '',
    status: 'Aktif',
  };
  const updatedList = [...curList, newItem];

  const { error } = await sb.from('app_settings').upsert({
    key: 'master_shifts',
    value: updatedList,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  if (error) throw error;
  return { success: true, data: newItem };
}

export async function sbUpdateMasterShift(id: string, payload: any): Promise<{ success: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const curList = await sbGetMasterShiftList();
  const updatedList = curList.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        nama: payload.nama !== undefined ? String(payload.nama).trim() : item.nama,
        jamMasuk: payload.jamMasuk !== undefined ? String(payload.jamMasuk).trim() : item.jamMasuk,
        jamKeluar: (payload.jamKeluar || payload.jamPulang) !== undefined ? String(payload.jamKeluar || payload.jamPulang).trim() : item.jamKeluar,
        keterangan: payload.keterangan !== undefined ? payload.keterangan : item.keterangan,
        status: payload.status !== undefined ? payload.status : item.status,
      };
    }
    return item;
  });

  const { error } = await sb.from('app_settings').upsert({
    key: 'master_shifts',
    value: updatedList,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  if (error) throw error;
  return { success: true };
}

export async function sbHapusMasterShift(id: string): Promise<{ success: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const curList = await sbGetMasterShiftList();
  const updatedList = curList.filter((item) => item.id !== id);

  const { error } = await sb.from('app_settings').upsert({
    key: 'master_shifts',
    value: updatedList,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  if (error) throw error;
  return { success: true };
}

// ============================================================
// ABSENSI CONFIG
// ============================================================
export async function sbGetAbsensiConfig(): Promise<any> {
  const sb = getSupabase();
  const DEFAULT_CONFIG = {
    jamBuka: '07:00',
    toleransiTelatMenit: 15,
    dendaPerMenit: 1000,
    maxDendaPerHari: 50000,
    gpsRadiusMeter: 150,
    latKantor: -6.2088,
    lngKantor: 106.8456,
  };
  if (!sb) return DEFAULT_CONFIG;

  try {
    const { data } = await sb.from('app_settings').select('value').eq('key', 'absensi_config').maybeSingle();
    if (data?.value && typeof data.value === 'object') {
      return { ...DEFAULT_CONFIG, ...data.value };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export async function sbSaveAbsensiConfig(configOrJamBuka: any, toleransiTelatMenit?: number): Promise<{ success: boolean; message?: string }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  let configToSave: any;
  if (typeof configOrJamBuka === 'object' && configOrJamBuka !== null) {
    configToSave = configOrJamBuka;
  } else {
    const cur = await sbGetAbsensiConfig();
    configToSave = {
      ...cur,
      jamBuka: String(configOrJamBuka || cur.jamBuka),
      toleransiTelatMenit: toleransiTelatMenit !== undefined ? Number(toleransiTelatMenit) : cur.toleransiTelatMenit,
    };
  }

  const { error } = await sb.from('app_settings').upsert({
    key: 'absensi_config',
    value: configToSave,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  if (error) throw error;
  return { success: true, message: 'Konfigurasi absensi berhasil disimpan' };
}

// ============================================================
// BATCH OPERATIONS & BULK IMPORTS
// ============================================================
export async function sbImportPelangganBatch(items: any[]): Promise<{ success: boolean; added: number; updated: number }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, added: 0, updated: 0 };
  }

  let added = 0;
  let updated = 0;

  const { data: existingList } = await sb.from('pelanggan').select('id, no_hp');
  const existingMap = new Map<string, string>();
  if (existingList) {
    for (const c of existingList) {
      if (c.no_hp) {
        existingMap.set(String(c.no_hp).trim(), c.id);
        const n = normalizePhone(String(c.no_hp));
        if (n) existingMap.set(n, c.id);
      }
    }
  }

  for (const item of items) {
    const rawHp = item.hp || item.noHp || item.no_hp;
    if (!rawHp) continue;
    const cleanHp = String(rawHp).trim();
    const norm = normalizePhone(cleanHp);
    const nama = String(item.nama || 'Pelanggan').trim();
    const alamat = item.alamat ? String(item.alamat).trim() : null;
    const tglLahir = item.tglLahir ? String(item.tglLahir).trim() : null;

    const matchedId = existingMap.get(cleanHp) || (norm ? existingMap.get(norm) : undefined);

    if (matchedId && matchedId !== 'new') {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (nama) updateData.nama = nama;
      if (alamat) updateData.alamat = alamat;
      if (tglLahir) updateData.tgl_lahir = tglLahir;
      await sb.from('pelanggan').update(updateData).eq('id', matchedId);
      updated++;
    } else {
      await sb.from('pelanggan').insert({
        nama,
        no_hp: cleanHp,
        alamat,
        tgl_lahir: tglLahir,
        is_member: false,
        saldo_poin: 0,
        total_order: 0,
        stamps_75: 0,
        stamps_45: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      existingMap.set(cleanHp, 'new');
      if (norm) existingMap.set(norm, 'new');
      added++;
    }
  }

  return { success: true, added, updated };
}

export async function sbImportInventoryBatch(items: any[]): Promise<{ success: boolean; importedCount: number }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, importedCount: 0 };
  }

  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const nama = String(item.nama || '').trim();
    if (!nama) continue;

    const id = item.id || `INV-${Date.now()}-${i + 1}`;
    await sb.from('inventory').insert({
      id,
      nama,
      stok: Number(item.stok) || 0,
      satuan: String(item.satuan || 'pcs').trim(),
      stok_minimum: Number(item.stokMinimum || item.stok_minimum) || 0,
      is_dijual: Boolean(item.isDijual),
      harga_jual: Number(item.hargaJual || item.harga_jual) || 0,
      kategori_layanan: item.kategoriLayanan || item.kategori_layanan || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    count++;
  }

  return { success: true, importedCount: count };
}

export async function sbImportLayananBatch(items: any[]): Promise<{ success: boolean; importedCount: number }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  if (!Array.isArray(items) || items.length === 0) {
    return { success: true, importedCount: 0 };
  }

  let count = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.nama) continue;
    await sbTambahLayanan(item);
    count++;
  }

  return { success: true, importedCount: count };
}

export async function sbBatchToggleAktifLayanan(ids: string[], aktif: boolean): Promise<{ success: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb
    .from('layanan')
    .update({ aktif: aktif ? 'Y' : 'N', updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) throw error;
  return { success: true };
}

export async function sbBatchHapusLayanan(ids: string[]): Promise<{ success: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb
    .from('layanan')
    .delete()
    .in('id', ids);

  if (error) throw error;
  return { success: true };
}

export async function sbBatchUbahKategoriLayanan(ids: string[], targetKategori: string): Promise<{ success: boolean }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { error } = await sb
    .from('layanan')
    .update({ kategori: targetKategori, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) throw error;
  return { success: true };
}

export async function sbRegenerateProductCodes(): Promise<{ success: boolean; message?: string }> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase belum dikonfigurasi');

  const { data: layananList, error } = await sb.from('layanan').select('*').order('kategori', { ascending: true }).order('nama', { ascending: true });
  if (error || !layananList) throw error || new Error('Gagal memuat layanan');

  const prefixCounters: Record<string, number> = {};
  const getPrefix = (kat?: string, tip?: string) => {
    const k = (kat || '').toLowerCase().trim();
    const t = (tip || '').toLowerCase().trim();
    if (t === 'selfservice' || k.includes('self')) return 'SS';
    if (t === 'fullservice' || k.includes('drop') || k.includes('full')) return 'DO';
    if (k.includes('add') || k.includes('tambahan')) return 'ADD';
    if (k.includes('retail') || k.includes('eceran') || k.includes('makan') || k.includes('minum')) return 'RTL';
    return 'PRD';
  };

  for (const item of layananList) {
    const prefix = getPrefix(item.kategori, item.tipe);
    prefixCounters[prefix] = (prefixCounters[prefix] || 0) + 1;
    const newCode = `${prefix}-${String(prefixCounters[prefix]).padStart(3, '0')}`;

    if (item.id !== newCode) {
      const { data: existing } = await sb.from('layanan').select('id').eq('id', newCode).maybeSingle();
      if (!existing) {
        const copy = { ...item, id: newCode, updated_at: new Date().toISOString() };
        await sb.from('layanan').insert(copy);
        await sb.from('layanan').delete().eq('id', item.id);
      }
    }
  }

  return { success: true, message: 'Kode produk berhasil disesuaikan menurut kategori & tipe' };
}
