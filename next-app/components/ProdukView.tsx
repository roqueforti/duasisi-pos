'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, RefreshCw, Trash2, Edit3, RotateCcw, X, TagIcon, Gift, Download, Upload, Zap, ArrowUp, ArrowDown, Sparkles, Shirt, Clock, Flame, Star, Layers, Delete } from 'lucide-react';
import { runBackend } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { toCSV, downloadCSV, parseCSV, readFileAsText } from '@/lib/csvUtils';
import { UserRole, LayananBahanBaku } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import SatuanInput from '@/components/SatuanInput';
import { getIconComponent, KategoriItem, PALETTE, ICON_OPTIONS } from '@/lib/categoryUtils';
import { getStepIconComponent } from '@/components/LangkahView';

export interface DropOffPriorityItem {
  id: string;
  nama: string;
  durasiJam: number;
  warna?: string;
  icon?: string;
  keterangan?: string;
  aktif?: boolean;
}

interface LayananItemBackend {
  id: string;
  nama: string;
  harga: number;
  satuan: string;
  icon: string;
  aktif: string;
  tipe: 'SelfService' | 'FullService' | '';
  kategori?: string;
  kategoriDropOff?: string;
  idInventory?: string | null;
  bahanBakuList?: LayananBahanBaku[];
  pipelineSteps?: any[];
  hargaModal?: number;
  inventoryDeductionQty?: number;
}

interface InventoryItem {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
}

export interface CustomPipelineStep {
  step: number;
  nama: string;
  needStaff: boolean;
  needMesin: boolean;
  icon?: string;
}

interface PromoVoucher {
  idPromo: string;
  kodeVoucher: string;
  jenisDiskon: string;
  nilaiDiskon: number;
  minTransaksi: number;
  statusAktif: boolean;
}

const defaultPromos: PromoVoucher[] = [];

interface ProdukViewProps {
  currentRole?: UserRole;
}

export default function ProdukView({ currentRole }: ProdukViewProps = {}) {
  const { showAlert, showConfirm, showPrompt } = useDialog();
  const [activeSubTab, setActiveSubTab] = useState<'Produk' | 'DropOff' | 'Promo' | 'Loyalitas'>('Produk');
  const [layananList, setLayananList] = useState<LayananItemBackend[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [promoList, setPromoList] = useState<PromoVoucher[]>(defaultPromos);
  const [loading, setLoading] = useState(false);
  const [filterKategori, setFilterKategori] = useState<string>('Semua');

  // Drop Off Categories / Priorities State
  const [dropOffCategories, setDropOffCategories] = useState<DropOffPriorityItem[]>([
    { id: 'p1', nama: 'Reguler', durasiJam: 48, icon: 'Clock', warna: 'bg-teal-100 text-teal-800 border-teal-300', keterangan: 'Pengerjaan standar 2 hari kerja (48 Jam)', aktif: true },
    { id: 'p2', nama: 'Express', durasiJam: 24, icon: 'Flame', warna: 'bg-amber-100 text-amber-800 border-amber-300', keterangan: 'Pengerjaan cepat 24 Jam', aktif: true },
    { id: 'p3', nama: 'Kilat', durasiJam: 6, icon: 'Zap', warna: 'bg-rose-100 text-rose-800 border-rose-300', keterangan: 'Pengerjaan super kilat 6 Jam', aktif: true }
  ]);
  const [showDropOffModal, setShowDropOffModal] = useState(false);
  const [editingDropOffId, setEditingDropOffId] = useState<string | null>(null);
  const [dropOffForm, setDropOffForm] = useState<Omit<DropOffPriorityItem, 'id'>>({
    nama: '',
    durasiJam: 24,
    icon: 'Clock',
    warna: 'bg-teal-100 text-teal-800 border-teal-300',
    keterangan: '',
    aktif: true
  });

  // Add / Edit Product Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [harga, setHarga] = useState('');
  const [hargaModal, setHargaModal] = useState('');
  const [satuan, setSatuan] = useState('kg');
  const [icon, setIcon] = useState('🧺');
  const [tipe, setTipe] = useState<'SelfService' | 'FullService' | ''>('');
  const [kategoriDropOff, setKategoriDropOff] = useState<string>('Reguler');
  const [idInventory, setIdInventory] = useState<string>('');
  const [inventoryDeductionQty, setInventoryDeductionQty] = useState<string>('1');
  const [bahanBakuList, setBahanBakuList] = useState<LayananBahanBaku[]>([]);
  const [kategori, setKategori] = useState<string>('Self Service');
  const [kategoriList, setKategoriList] = useState<KategoriItem[]>([]);
  
  // Pipeline Steps selection
  const [customPipelineSteps, setCustomPipelineSteps] = useState<CustomPipelineStep[]>([]);
  const [masterPipelineSteps, setMasterPipelineSteps] = useState<CustomPipelineStep[]>([]);
  const [showMasterStepModal, setShowMasterStepModal] = useState(false);

  // Add Promo Modal State
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [kodePromo, setKodePromo] = useState('');
  const [nilaiDiskon, setNilaiDiskon] = useState('10000');
  const [minTx, setMinTx] = useState('50000');

  // Loyalty Settings
  const [poinRate, setPoinRate] = useState('10000');

  // Pending Inventory Linking
  const [pendingInventory, setPendingInventory] = useState<Record<string, string>>({});

  const loadProduk = async () => {
    setLoading(true);
    try {
      const data = await runBackend<LayananItemBackend[]>('getLayananListAll');
      if (Array.isArray(data)) setLayananList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateCodes = async () => {
    const isConfirmed = await showConfirm('Sesuaikan seluruh kode produk/layanan berdasarkan kategori dan tipenya (contoh: SS-001, DO-001, ADD-001, RTL-001)?');
    if (!isConfirmed) return;
    try {
      setLoading(true);
      const res = await runBackend<{ success: boolean; message?: string }>('regenerateProductCodes');
      if (res && res.success) {
        clearCache('getLayananList');
        clearCache('getLayananListAll');
        await showAlert(res.message || 'Kode produk berhasil disesuaikan menurut kategori & tipe!', 'success');
        await loadProduk();
        return;
      }

      // Fallback: Batch client-side update
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
        await runBackend('updateLayanan', item.id, {
          ...item,
          kode: newCode
        });
      }
      clearCache('getLayananList');
      clearCache('getLayananListAll');
      await showAlert('Kode produk berhasil disesuaikan menurut kategori & tipe!', 'success');
      await loadProduk();
    } catch (err: any) {
      console.error(err);
      await showAlert('Gagal menyesuaikan kode produk: ' + (err?.message || String(err)), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    try {
      const data = await runBackend<InventoryItem[]>('getInventoryList');
      if (Array.isArray(data)) setInventoryList(data);
    } catch (err) {
      console.error('Gagal memuat inventory:', err);
    }
  };

  const loadPoinConfig = async () => {
    try {
      const config = await runBackend<{rate: number}>('getPoinConfig');
      if (config) {
        setPoinRate(config.rate.toString());
      }
    } catch (err) {
      console.error('Gagal memuat konfigurasi poin:', err);
    }
  };

  const loadDropOffCategories = async () => {
    try {
      const data = await runBackend<DropOffPriorityItem[]>('getPriorityConfig');
      if (Array.isArray(data) && data.length > 0) {
        setDropOffCategories(data.map(d => ({
          id: d.id || `do-${Date.now()}-${Math.random()}`,
          nama: d.nama,
          durasiJam: Number(d.durasiJam || (d as any).sla || 24),
          icon: d.icon || 'Clock',
          warna: d.warna || 'bg-teal-100 text-teal-800 border-teal-300',
          keterangan: d.keterangan || '',
          aktif: d.aktif !== false
        })));
      }
    } catch (err) {
      console.error('Gagal memuat kategori drop off:', err);
    }
  };

  const handleOpenAddDropOff = () => {
    setEditingDropOffId(null);
    setDropOffForm({
      nama: '',
      durasiJam: 24,
      icon: 'Clock',
      warna: 'bg-teal-100 text-teal-800 border-teal-300',
      keterangan: '',
      aktif: true
    });
    setShowDropOffModal(true);
  };

  const handleOpenEditDropOff = (item: DropOffPriorityItem) => {
    setEditingDropOffId(item.id);
    setDropOffForm({
      nama: item.nama,
      durasiJam: item.durasiJam || 24,
      icon: item.icon || 'Clock',
      warna: item.warna || 'bg-teal-100 text-teal-800 border-teal-300',
      keterangan: item.keterangan || '',
      aktif: item.aktif !== false
    });
    setShowDropOffModal(true);
  };

  const handleSaveDropOffCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropOffForm.nama.trim()) {
      await showAlert('Nama kategori / prioritas Drop Off harus diisi!', 'warning');
      return;
    }
    setLoading(true);
    try {
      let updated: DropOffPriorityItem[];
      if (editingDropOffId) {
        updated = dropOffCategories.map(item =>
          item.id === editingDropOffId ? { ...item, ...dropOffForm } : item
        );
      } else {
        const newItem: DropOffPriorityItem = {
          id: `p-${Date.now()}`,
          ...dropOffForm
        };
        updated = [...dropOffCategories, newItem];
      }
      setDropOffCategories(updated);
      await runBackend('savePriorityConfig', updated);
      clearCache('getPriorityConfig');
      setShowDropOffModal(false);
      setEditingDropOffId(null);
      await showAlert('Kategori / Prioritas Drop Off berhasil disimpan!', 'success');
    } catch (err: any) {
      console.error(err);
      await showAlert('Gagal menyimpan kategori drop off: ' + (err?.message || String(err)), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAktifDropOff = async (id: string, currentAktif: boolean) => {
    const updated = dropOffCategories.map(item =>
      item.id === id ? { ...item, aktif: !currentAktif } : item
    );
    setDropOffCategories(updated);
    try {
      await runBackend('savePriorityConfig', updated);
      clearCache('getPriorityConfig');
    } catch (err) {
      console.error(err);
    }
  };

  const handleHapusDropOffCategory = async (id: string) => {
    const isConfirmed = await showConfirm('Hapus kategori / prioritas Drop Off ini?');
    if (!isConfirmed) return;
    const updated = dropOffCategories.filter(item => item.id !== id);
    setDropOffCategories(updated);
    setLoading(true);
    try {
      await runBackend('savePriorityConfig', updated);
      clearCache('getPriorityConfig');
      await showAlert('Kategori Drop Off berhasil dihapus.', 'success');
    } catch (err: any) {
      console.error(err);
      await showAlert('Gagal menghapus kategori drop off.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMasterPipelineSteps = async () => {
    try {
      const data = await runBackend<CustomPipelineStep[]>('getPipelineConfigData');
      if (Array.isArray(data)) {
        setMasterPipelineSteps(data);
      }
    } catch (err) {
      console.error('Gagal memuat master langkah:', err);
    }
  };

  const loadPromo = async () => {
    try {
      const data = await runBackend<PromoVoucher[]>('getPromoList');
      if (Array.isArray(data) && data.length > 0) setPromoList(data);
    } catch (err) {
      console.error('Gagal memuat promo:', err);
    }
  };

  const loadKategori = async () => {
    try {
      const data = await runBackend<KategoriItem[]>('getKategoriList');
      if (Array.isArray(data)) setKategoriList(data.filter(k => k.aktif === 'Y'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProduk();
    loadInventory();
    loadPromo();
    loadPoinConfig();
    loadKategori();
    loadDropOffCategories();
    loadMasterPipelineSteps();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setKode('');
    setNama(''); setHarga(''); setHargaModal(''); setSatuan('paket'); setIcon('🧺'); setTipe(''); setKategori('Self Service'); setKategoriDropOff('Reguler'); setIdInventory('none'); setInventoryDeductionQty('1');
    setBahanBakuList([]);
    setCustomPipelineSteps([]);
    setShowModal(true);
  };

  const handleOpenEdit = (item: LayananItemBackend) => {
    setEditingId(item.id);
    setKode(item.id);
    setNama(item.nama);
    setHarga(item.harga.toString());
    setHargaModal((item.hargaModal || 0).toString());
    setSatuan(item.satuan || 'kg');
    setIcon(item.icon || '🧺');
    
    // Sanitize tipe to ensure it matches the dropdown options
    const validTipe = ['SelfService', 'FullService'].includes(item.tipe || '') ? item.tipe : '';
    setTipe(validTipe as '' | 'SelfService' | 'FullService');
    setKategoriDropOff(item.kategoriDropOff || 'Reguler');
    
    setIdInventory(item.idInventory || 'none');
    setKategori(item.kategori || 'Self Service');
    setInventoryDeductionQty(
      item.inventoryDeductionQty !== undefined && item.inventoryDeductionQty !== null
        ? item.inventoryDeductionQty.toString()
        : '1'
    );
    setBahanBakuList(
      Array.isArray(item.bahanBakuList) && item.bahanBakuList.length > 0
        ? item.bahanBakuList
        : (item.idInventory && item.idInventory !== 'none' ? [{ idInventory: item.idInventory, qty: item.inventoryDeductionQty || 1, tahap: 'Dicuci' }] : [])
    );
    setCustomPipelineSteps(item.pipelineSteps ? (item.pipelineSteps as CustomPipelineStep[]) : []);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nama.trim() || !harga.trim()) { await showAlert('Nama dan harga wajib diisi!', 'warning'); return; }
    const payloadPipeline = customPipelineSteps.map((s, i) => ({ ...s, step: i + 1 }));
    const filteredBahan = bahanBakuList.filter(b => b.idInventory && b.idInventory.trim());
    const payload = {
        kode: kode.trim(),
        nama: nama.trim(),
        harga: Number(harga) || 0,
        satuan,
        icon,
        tipe: tipe || '',
        kategori,
        kategoriDropOff: (tipe === 'FullService' || (kategori || '').toLowerCase().includes('drop')) ? kategoriDropOff : '',
        idInventory: tipe === 'FullService' ? (filteredBahan[0]?.idInventory || 'none') : (idInventory ? idInventory : 'none'),
        inventoryDeductionQty: tipe === 'FullService' ? (filteredBahan[0]?.qty || undefined) : (idInventory && idInventory !== 'none' ? (isNaN(parseFloat(inventoryDeductionQty)) ? 1 : parseFloat(inventoryDeductionQty)) : undefined),
        bahanBakuList: tipe === 'FullService' ? (filteredBahan.length > 0 ? filteredBahan : undefined) : undefined,
        hargaModal: Number(hargaModal) || 0,
        pipelineSteps: tipe === 'FullService' ? customPipelineSteps : []
      };
    setLoading(true);
    try {
      if (editingId) {
        await runBackend('updateLayanan', editingId, payload);
      } else {
        await runBackend('tambahLayanan', payload);
      }
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      setShowModal(false);
      loadProduk();
      await showAlert('Layanan berhasil disimpan!', 'success');
    } catch (err) {
      await showAlert('Gagal menyimpan layanan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAktif = async (id: string, isY: boolean) => {
    try {
      await runBackend('toggleAktifLayanan', id, !isY);
      loadProduk();
      await showAlert(`Layanan berhasil di${isY ? 'nonaktifkan' : 'aktifkan'}!`, 'success');
    } catch (err) {
      await showAlert('Gagal mengubah status', 'error');
    }
  };

  const handleHapusLayanan = async (id: string) => {
    const isConfirmed = await showConfirm('Yakin ingin menghapus layanan ini?');
    if (!isConfirmed) return;
    try {
      await runBackend('hapusLayanan', id);
      loadProduk();
      await showAlert('Layanan berhasil dihapus!', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus layanan', 'error');
    }
  };

  const handleSavePromo = async () => {
    if (!kodePromo.trim()) { await showAlert('Kode promo wajib diisi!', 'warning'); return; }
    const payload = {
      kodeVoucher: kodePromo.trim().toUpperCase(),
      jenisDiskon: 'Nominal',
      nilaiDiskon: Number(nilaiDiskon) || 5000,
      minTransaksi: Number(minTx) || 0
    };
    try {
      if (editingPromoId) {
        await runBackend('editPromo', editingPromoId, payload);
      } else {
        await runBackend('tambahPromo', payload);
      }
      setShowPromoModal(false);
      setKodePromo('');
      loadPromo();
      await showAlert(`Promo ${payload.kodeVoucher} berhasil disimpan ke database!`, 'success');
    } catch (err) {
      await showAlert('Gagal menyimpan promo ke backend', 'error');
    }
  };

  const handleOpenEditPromo = (prm: PromoVoucher) => {
    setEditingPromoId(prm.idPromo);
    setKodePromo(prm.kodeVoucher);
    setNilaiDiskon(prm.nilaiDiskon.toString());
    setMinTx(prm.minTransaksi?.toString() || '0');
    setShowPromoModal(true);
  };

  const handleHapusPromo = async (id: string) => {
    const isConfirmed = await showConfirm('Yakin hapus voucher promo ini?');
    if (!isConfirmed) return;
    try {
      await runBackend('hapusPromo', id);
      loadPromo();
      await showAlert('Promo berhasil dihapus!', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus promo', 'error');
    }
  };

  const handleExportProduk = () => {
    const rows = layananList.map(l => [l.nama, l.kategori || 'Self Service', l.harga, l.tipe || 'Bukan Layanan', l.aktif === 'Y' ? 'Aktif' : 'Non-Aktif']);
    downloadCSV('export_produk.csv', toCSV(['Nama Layanan', 'Kategori', 'Harga', 'Tipe', 'Status'], rows));
  };

  const handleDownloadTemplateProduk = () => {
    downloadCSV('template_produk_kosong.csv', toCSV(
      ['Nama Layanan', 'Kategori', 'Harga', 'Tipe', 'Status'],
      [['Cuci Karpet', 'Self Service', 15000, 'SelfService', 'Aktif']]
    ));
  };

  const handleImportProduk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) { await showAlert('File CSV kosong atau format salah.', 'warning'); return; }
      let success = 0, fail = 0;
      for (const row of rows) {
        const nama = row['Nama Layanan'] || row['nama'] || '';
        if (!nama.trim()) { fail++; continue; }
        const tipeRaw = String(row['Tipe'] || row['tipe'] || 'SelfService').trim();
        let tipeVal: 'SelfService' | 'FullService' | '' = 'SelfService';
        if (tipeRaw.toLowerCase().includes('bukan') || tipeRaw.toLowerCase() === 'kosong' || tipeRaw === '') {
          tipeVal = '';
        } else if (tipeRaw === 'FullService' || tipeRaw.toLowerCase().includes('drop off')) {
          tipeVal = 'FullService';
        }
        
        const aktifRaw = String(row['Status'] || row['status'] || 'Aktif').trim().toLowerCase();
        const aktifVal = aktifRaw === 'aktif' || aktifRaw === 'y';
        try {
          const id = await runBackend('tambahLayanan', {
            nama: String(row['Nama Layanan'] || row['nama'] || '').trim(),
            kategori: String(row['Kategori'] || row['kategori'] || 'Self Service').trim(),
            harga: Number(row['Harga'] || row['harga']) || 0,
            satuan: '',
            icon: '🧺',
            tipe: (row['Tipe'] || row['tipe'] || '').trim().toLowerCase() === 'bukan layanan' ? '' : (row['Tipe'] || row['tipe'] || '').trim(),
          });
          if (id && !aktifVal) await runBackend('toggleAktifLayanan', id, false);
          success++;
        } catch { fail++; }
      }
      loadProduk();
      await showAlert(`Import selesai: ${success} berhasil${fail > 0 ? `, ${fail} gagal` : ''}.`, 'info');
    } catch (err) {
      await showAlert('Gagal membaca file CSV.', 'error');
    }
  };

  const uniqueKategoriList = ['Semua', ...Array.from(new Set(layananList.map(item => item.kategori || 'Self Service')))];
  const filteredLayananList = filterKategori === 'Semua' ? layananList : layananList.filter(item => (item.kategori || 'Self Service') === filterKategori);

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
            <button
              onClick={() => setActiveSubTab('Produk')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Produk' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Master Layanan Laundry</span>
            </button>
            <button
              onClick={() => setActiveSubTab('DropOff')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'DropOff' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <Shirt className="w-3.5 h-3.5" />
              <span>Kategori Drop Off</span>
            </button>
            <button
              onClick={() => setActiveSubTab('Promo')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Promo' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <TagIcon className="w-3.5 h-3.5" />
              <span>Master Promo & Voucher</span>
            </button>
            <button
              onClick={() => setActiveSubTab('Loyalitas')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Loyalitas' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Program Poin Loyalitas</span>
            </button>
          </div>
        </div>

        {activeSubTab === 'DropOff' && currentRole === 'MANAGER' && (
          <button
            onClick={handleOpenAddDropOff}
            className="bg-[#1E4648] hover:bg-[#163536] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Kategori Drop Off
          </button>
        )}

        {activeSubTab === 'Produk' && (
          <div className="flex items-center gap-2">
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] text-xs text-slate-600 bg-white shadow-sm"
            >
              {uniqueKategoriList.map(kat => (
                <option key={kat} value={kat}>{kat === 'Semua' ? 'Semua Kategori' : kat}</option>
              ))}
            </select>
            {currentRole === 'MANAGER' && (
              <>
                <button onClick={handleExportProduk} className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition" title="Export Data Layanan ke CSV">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleDownloadTemplateProduk} className="px-3 py-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 text-xs font-medium transition" title="Download Template Kosong">
                  Template
                </button>
                <label className="cursor-pointer px-3 py-1.5 border border-[#B5C9C9] rounded-md text-[#1E4648] hover:bg-[#B5C9C9]/10 text-xs font-medium transition flex items-center gap-1.5" title="Import Data Layanan dari CSV">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleImportProduk} />
                </label>
                <button
                  onClick={handleRegenerateCodes}
                  className="px-3 py-1.5 border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-[#1E4648] rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                  title="Sesuaikan Kode Produk Berdasarkan Kategori & Tipe (SS-xxx, DO-xxx, ADD-xxx, RTL-xxx)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>Auto Kode Kategori</span>
                </button>
                <button
                  onClick={handleOpenAdd}
                  className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Layanan
                </button>
              </>
            )}
          </div>
        )}

        {activeSubTab === 'Promo' && currentRole === 'MANAGER' && (
          <button
            onClick={() => {
              setEditingPromoId(null);
              setKodePromo(''); setNilaiDiskon('10000'); setMinTx('50000');
              setShowPromoModal(true);
            }}
            className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Buat Voucher Promo
          </button>
        )}
      </div>

      {activeSubTab === 'Produk' && (
        <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Kode</th>
                  <th className="py-2.5 px-3">Nama Produk / Layanan</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Tipe</th>
                  <th className="py-2.5 px-3">Inventory</th>
                  <th className="py-2.5 px-3">Potongan Stok</th>
                  {currentRole === 'MANAGER' && <th className="py-2.5 px-3">Modal & Profit</th>}
                  <th className="py-2.5 px-3">Tarif Jual</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-16" /></td>
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-28" /></td>
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-16" /></td>
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-14" /></td>
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-20" /></td>
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-12" /></td>
                      {currentRole === 'MANAGER' && <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-16" /></td>}
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-16" /></td>
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-10" /></td>
                      <td className="py-2 px-3"><div className="h-3 bg-slate-100 rounded w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredLayananList.length === 0 ? (
                  <tr><td colSpan={currentRole === 'MANAGER' ? 10 : 9} className="py-8 text-center text-slate-400">Belum ada data layanan</td></tr>
                ) : (
                  filteredLayananList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                          {item.id}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-slate-700 text-xs">
                        {item.nama}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                        {(() => {
                          if (!item.kategori) return <span className="text-slate-300 text-xs">-</span>;
                          const kat = kategoriList.find(k => k.nama.toLowerCase() === (item.kategori || '').toLowerCase());
                          const KatIcon = kat ? getIconComponent(kat.icon) : Tag;
                          return (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 border shadow-2xs ${kat?.warna || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              <KatIcon className="w-3 h-3" />
                              <span>{item.kategori}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        {item.tipe === 'FullService' || (item.kategori || '').toLowerCase().includes('drop') ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-[#1E4648] border border-teal-200">
                              Drop Off
                            </span>
                            {item.kategoriDropOff && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                {item.kategoriDropOff}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${!item.tipe || String(item.tipe).toLowerCase() === 'bukan layanan' || String(item.tipe) === '' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                            {!item.tipe || String(item.tipe).toLowerCase() === 'bukan layanan' || String(item.tipe) === '' ? 'Bukan Layanan' : item.tipe}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        {(!item.tipe || String(item.tipe).toLowerCase() === 'bukan layanan' || String(item.tipe) === '') ? (
                          <div className="flex items-center">
                            <select
                              value={pendingInventory[item.id] !== undefined ? pendingInventory[item.id] : (item.idInventory && item.idInventory !== 'none' ? item.idInventory : 'none')}
                              onChange={(e) => {
                                setPendingInventory(prev => ({ ...prev, [item.id]: e.target.value }));
                              }}
                              className={`w-36 text-[10px] py-0.5 px-1.5 border rounded-lg outline-none cursor-pointer truncate font-bold ${
                                (pendingInventory[item.id] !== undefined ? pendingInventory[item.id] : (item.idInventory || 'none')) === 'none'
                                  ? 'bg-slate-100 border-slate-300 text-slate-600'
                                  : (pendingInventory[item.id] !== undefined ? pendingInventory[item.id] : item.idInventory) === 'auto'
                                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              }`}
                            >
                              <option value="none">⛔ Tidak Ada (Tanpa Stok)</option>
                              <option value="auto">✨ + Buat Baru Otomatis</option>
                              {inventoryList.map(inv => (
                                <option key={inv.id} value={inv.id}>📦 {inv.nama} (Stok: {inv.stok} {inv.satuan})</option>
                              ))}
                            </select>
                            
                            {pendingInventory[item.id] !== undefined && pendingInventory[item.id] !== (item.idInventory || 'none') && (
                              <button
                                onClick={async () => {
                                  const newVal = pendingInventory[item.id];
                                  const isConfirmed = await showConfirm(
                                    newVal === 'auto' 
                                      ? 'Buat item stok baru secara otomatis untuk produk ini?' 
                                      : newVal === 'none'
                                      ? 'Hapus pautan inventory (produk ini tidak akan memotong stok)?'
                                      : 'Ubah pautan inventory untuk produk ini?'
                                  );
                                  if (!isConfirmed) {
                                    setPendingInventory(prev => {
                                      const newObj = { ...prev };
                                      delete newObj[item.id];
                                      return newObj;
                                    });
                                    return;
                                  }
                                  
                                  setLoading(true);
                                  try {
                                    await runBackend('updateLayanan', item.id, {
                                      ...item,
                                      tipe: '',
                                      idInventory: newVal === 'none' ? 'none' : newVal
                                    });
                                    clearCache('getInventoryList');
                                    clearCache('getLayananListAll');
                                    clearCache('getDaftarLayanan');
                                    await loadInventory();
                                    await loadProduk();
                                    setPendingInventory(prev => {
                                      const newObj = { ...prev };
                                      delete newObj[item.id];
                                      return newObj;
                                    });
                                    await showAlert(
                                      newVal === 'none'
                                        ? 'Pautan stok dilepas. Produk ini tidak akan mengubah stok item.'
                                        : 'Pautan inventory berhasil disimpan!',
                                      'success'
                                    );
                                  } catch (err: any) {
                                    await showAlert('Gagal: ' + (err.message || String(err)), 'error');
                                  } finally {
                                    setLoading(false);
                                  }
                                }}
                                className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#1E4648] text-white hover:bg-[#153233] transition shadow-xs cursor-pointer"
                              >
                                Simpan
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        {item.bahanBakuList && item.bahanBakuList.length > 0 ? (
                          <div className="flex flex-col gap-1 max-w-[180px]">
                            {item.bahanBakuList.map((b, bIdx) => {
                              const inv = inventoryList.find(i => i.id === b.idInventory);
                              return (
                                <span key={bIdx} className="text-[9px] font-mono text-orange-900 bg-orange-50/90 px-1.5 py-0.5 rounded border border-orange-200 truncate" title={`${inv?.nama || b.idInventory}: ${b.qty} ${inv?.satuan || 'unit'} (${b.tahap || 'Dicuci'})`}>
                                  <strong>{inv?.nama || b.idInventory}</strong>: {b.qty} {inv?.satuan || 'unit'}
                                  <span className="text-orange-600/80 text-[8px] ml-1">({b.tahap || 'Dicuci'})</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (item.idInventory && item.idInventory !== 'none' && inventoryList.some(inv => inv.id === item.idInventory)) ? (
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 text-[11px] font-mono">
                              {item.inventoryDeductionQty !== undefined && item.inventoryDeductionQty !== null ? item.inventoryDeductionQty : 1}
                              <span className="text-orange-900/70 font-medium text-[9px] ml-1">
                                {inventoryList.find(inv => inv.id === item.idInventory)?.satuan || 'unit'}
                              </span>
                            </span>
                            <span className="text-[9px] text-slate-400">/ trx</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Tanpa Stok</span>
                        )}
                      </td>
                      {currentRole === 'MANAGER' && (
                        <td className="py-1.5 px-3 text-xs whitespace-nowrap">
                          <div className="font-semibold text-slate-600 font-mono text-[11px]">Rp {(item?.hargaModal || 0).toLocaleString('id-ID')}</div>
                          {(() => {
                            const hJual = item?.harga || 0;
                            const hModal = item?.hargaModal || 0;
                            if (hJual > 0) {
                              const profitMargin = ((hJual - hModal) / hJual) * 100;
                              return (
                                <div className={`text-[9px] font-bold ${profitMargin < 0 ? 'text-red-500' : (profitMargin > 30 ? 'text-emerald-600' : 'text-[#FF9500]')}`}>
                                  Margin: {profitMargin.toFixed(1)}%
                                </div>
                              );
                            }
                            return <div className="text-[9px] text-slate-400">Margin: -</div>;
                          })()}
                        </td>
                      )}
                      <td className="py-1.5 px-3 font-black text-slate-900 font-mono text-xs whitespace-nowrap">
                        Rp {(item?.harga || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-1.5 px-3 whitespace-nowrap">
                        {currentRole === 'MANAGER' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAktif(item.id, item.aktif === 'Y')}
                            title={item.aktif === 'Y' ? 'Klik untuk Non-Aktifkan' : 'Klik untuk Aktifkan'}
                            className="inline-flex items-center gap-1.5 cursor-pointer select-none group"
                          >
                            <div
                              className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                                item.aktif === 'Y' ? 'bg-[#1E4648]' : 'bg-slate-300 group-hover:bg-slate-400'
                              }`}
                            >
                              <div
                                className={`bg-white w-3 h-3 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                                  item.aktif === 'Y' ? 'translate-x-3' : 'translate-x-0'
                                }`}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${item.aktif === 'Y' ? 'text-[#1E4648]' : 'text-slate-400'}`}>
                              {item.aktif === 'Y' ? 'Aktif' : 'Off'}
                            </span>
                          </button>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.aktif === 'Y' ? 'bg-[#B5C9C9]/20 text-[#1E4648]' : 'bg-slate-100 text-slate-500'}`}>
                            {item.aktif === 'Y' ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right space-x-1 whitespace-nowrap">
                        {currentRole === 'MANAGER' ? (
                          <>
                            <button onClick={() => handleOpenEdit(item)} title="Edit Produk" className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleHapusLayanan(item.id)} title="Hapus Produk" className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'DropOff' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Shirt className="w-4 h-4 text-[#1E4648]" />
                <span>Manajemen Kategori & Prioritas Drop Off</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Atur pengkategorian prioritas pengerjaan & SLA durasi waktu yang otomatis muncul saat kasir memproses pesanan Drop Off.
              </p>
            </div>
            {currentRole === 'MANAGER' && (
              <button
                onClick={handleOpenAddDropOff}
                className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" /> Tambah Kategori
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-4">Kategori / Prioritas</th>
                  <th className="py-2.5 px-4">Estimasi SLA Pengerjaan</th>
                  <th className="py-2.5 px-4">Keterangan / SOP</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dropOffCategories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada kategori / prioritas Drop Off. Klik tombol Tambah Kategori di atas.
                    </td>
                  </tr>
                ) : (
                  dropOffCategories.map((item) => {
                    const CatIcon = getIconComponent(item.icon || 'Clock');
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${item.warna || 'bg-teal-100 text-teal-800 border-teal-300'}`}>
                              <CatIcon className="w-3.5 h-3.5" />
                              <span>{item.nama}</span>
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-mono font-bold text-slate-800 text-xs bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {item.durasiJam} Jam
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5">
                            ({(item.durasiJam / 24).toFixed(item.durasiJam % 24 === 0 ? 0 : 1)} Hari)
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                          {item.keterangan || '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          {currentRole === 'MANAGER' ? (
                            <button
                              type="button"
                              onClick={() => handleToggleAktifDropOff(item.id, item.aktif !== false)}
                              title={item.aktif !== false ? 'Klik untuk Non-Aktifkan' : 'Klik untuk Aktifkan'}
                              className="inline-flex items-center gap-1.5 cursor-pointer select-none group"
                            >
                              <div
                                className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                                  item.aktif !== false ? 'bg-[#1E4648]' : 'bg-slate-300 group-hover:bg-slate-400'
                                }`}
                              >
                                <div
                                  className={`bg-white w-3 h-3 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                                    item.aktif !== false ? 'translate-x-3' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                              <span className={`text-[10px] font-bold ${item.aktif !== false ? 'text-[#1E4648]' : 'text-slate-400'}`}>
                                {item.aktif !== false ? 'Aktif' : 'Off'}
                              </span>
                            </button>
                          ) : (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.aktif !== false ? 'bg-teal-100 text-[#1E4648]' : 'bg-slate-100 text-slate-500'}`}>
                              {item.aktif !== false ? 'Aktif' : 'Non-Aktif'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-1 whitespace-nowrap">
                          {currentRole === 'MANAGER' ? (
                            <>
                              <button
                                onClick={() => handleOpenEditDropOff(item)}
                                title="Edit Kategori Drop Off"
                                className="p-1 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleHapusDropOffCategory(item.id)}
                                title="Hapus Kategori Drop Off"
                                className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'Promo' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Kode Voucher</th>
                  <th className="py-3 px-4">Jenis Diskon</th>
                  <th className="py-3 px-4">Nilai Potongan</th>
                  <th className="py-3 px-4">Min. Transaksi</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promoList.map((prm) => (
                  <tr key={prm.idPromo} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold font-sans text-[#1E4648] text-sm">{prm.kodeVoucher}</td>
                    <td className="py-3 px-4 text-slate-600">{prm.jenisDiskon}</td>
                    <td className="py-3 px-4 font-bold text-[#1E4648]">Rp {(prm?.nilaiDiskon || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4 text-slate-600">Rp {(prm.minTransaksi || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#B5C9C9]/20 text-[#1E4648] border border-[#B5C9C9] px-2 py-0.5 rounded text-[10px] font-bold">
                        Berlaku
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {currentRole === 'MANAGER' ? (
                        <>
                          <button onClick={() => handleOpenEditPromo(prm)} className="p-1 text-slate-500 hover:text-slate-600" title="Edit Promo">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleHapusPromo(prm.idPromo)} className="p-1 text-rose-500 hover:text-rose-700" title="Hapus Promo">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'Loyalitas' && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 max-w-md shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-600 text-sm flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#FF9500]" />
            <span>Pengaturan Skema Poin Pelanggan</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nilai Transaksi Per 1 Poin (Rp)</label>
              <input
                type="number"
                value={poinRate}
                onChange={(e) => setPoinRate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Setiap kelipatan nominal di atas, pelanggan mendapat 1 Poin.</p>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const res = await runBackend<{success: boolean, message: string}>('savePoinConfig', Number(poinRate) || 10000);
                await showAlert(res?.message || 'Pengaturan poin loyalitas berhasil disimpan!', 'success');
              } catch (err) {
                await showAlert('Gagal menyimpan konfigurasi poin!', 'error');
              }
            }}
            className="w-full bg-[#1E4648] text-white font-semibold py-2 rounded-md transition"
          >
            Simpan Konfigurasi Poin
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm sm:text-base font-bold text-slate-800">{editingId ? 'Edit Layanan' : 'Tambah Layanan Baru'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto pr-1 space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kolom Kiri: Informasi Dasar Layanan */}
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kode Produk / Layanan (Opsional)</label>
                    <input 
                      type="text" 
                      value={kode} 
                      onChange={(e) => setKode(e.target.value)} 
                      placeholder="Otomatis (contoh: SS-001, DO-001, ADD-001)" 
                      className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] font-mono text-xs" 
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Kosongkan untuk penomoran otomatis berdasarkan kategori & tipe.</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Layanan *</label>
                    <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Cuci Karpet..." className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                    <p className="text-[10px] text-slate-400 mt-1">Nama yang akan tampil di struk dan kasir.</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kategori *</label>
                    <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]">
                      {kategoriList.map(kat => (
                        <option key={kat.id} value={kat.nama}>{kat.nama}</option>
                      ))}
                      {kategoriList.length === 0 && <option value="Self Service">Self Service</option>}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Kategori master produk & layanan.</p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tipe Layanan (Opsional)</label>
                    <select value={tipe} onChange={(e) => setTipe(e.target.value as 'SelfService' | 'FullService' | '')} className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]">
                      <option value="">Bukan Layanan / Kosong</option>
                      <option value="SelfService">Self Service</option>
                      <option value="FullService">Drop Off</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Mengelompokkan layanan pada daftar antrean dan laporan.</p>
                  </div>

                  {(tipe === 'FullService' || (kategori || '').toLowerCase().includes('drop')) && (
                    <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2">
                      <label className="block font-bold text-[#1E4648] text-xs">
                        Kategori & Estimasi Deadline Drop Off *
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {dropOffCategories.filter(d => d.aktif !== false).map(cat => {
                          const isSel = (kategoriDropOff || 'Reguler').toLowerCase() === cat.nama.toLowerCase();
                          const CatIcon = getIconComponent(cat.icon || 'Clock');
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setKategoriDropOff(cat.nama)}
                              className={`py-1.5 px-2 rounded-lg border text-center transition flex flex-col items-center justify-center gap-0.5 ${
                                isSel
                                  ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-1 font-bold text-xs">
                                <CatIcon className="w-3 h-3" />
                                <span>{cat.nama}</span>
                              </div>
                              <span className={`text-[9px] font-mono ${isSel ? 'text-teal-200' : 'text-slate-400'}`}>
                                {cat.durasiJam} Jam
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Otomatis memasang estimasi deadline waktu pengerjaan di antrean POS.
                      </p>
                    </div>
                  )}

                  <div>
                    <SatuanInput
                      value={satuan}
                      onChange={setSatuan}
                      label="Satuan Penjualan"
                      helperText={
                        idInventory && inventoryList.find(i => i.id === idInventory)?.satuan
                          ? `Tersinkronisasi otomatis dari unit stok inventory: ${inventoryList.find(i => i.id === idInventory)?.satuan}.`
                          : "Contoh: paket, kg, pcs, botol, porsi, atau ketik kustom."
                      }
                    />
                    {idInventory && inventoryList.find(i => i.id === idInventory)?.satuan && (
                      <div className="mt-1 flex items-center justify-between text-[11px] bg-teal-50 border border-teal-200 text-teal-900 px-2.5 py-1 rounded-lg">
                        <span>📦 Unit Stok Inventory: <strong>{inventoryList.find(i => i.id === idInventory)?.satuan}</strong></span>
                        {satuan !== inventoryList.find(i => i.id === idInventory)?.satuan && (
                          <button
                            type="button"
                            onClick={() => {
                              const invSat = inventoryList.find(i => i.id === idInventory)?.satuan;
                              if (invSat) setSatuan(invSat);
                            }}
                            className="text-[10px] font-bold text-[#1E4648] hover:underline"
                          >
                            Samakan ke Satuan Inventory
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Inventory & Harga */}
                <div className="space-y-3">
                  {tipe === 'FullService' ? (
                    <div className="space-y-2.5 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                      <div className="flex justify-between items-center">
                        <div>
                          <label className="block font-bold text-slate-800 text-xs">🧪 Resep Bahan Baku Inventory (BOM)</label>
                          <p className="text-[10px] text-slate-500">Bahan yang otomatis terpotong saat pengerjaan Drop Off.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBahanBakuList(prev => [...prev, { idInventory: '', qty: 1, tahap: 'Dicuci' }]);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-[#1E4648] text-white rounded-lg hover:bg-[#163436] transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Tambah Bahan
                        </button>
                      </div>

                      {bahanBakuList.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-300 rounded-lg p-3 text-center text-xs text-slate-400">
                          Belum ada bahan baku terpaut. Klik <strong>+ Tambah Bahan</strong> untuk memasukkan Deterjen, Softener, Plastik Kemasan, dll.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {bahanBakuList.map((item, idx) => {
                            const selectedInv = inventoryList.find(i => i.id === item.idInventory);
                            return (
                              <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-xl space-y-2 shadow-2xs">
                                <div className="flex gap-2 items-center">
                                  <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Item Inventory #{idx + 1}</label>
                                    <select
                                      value={item.idInventory}
                                      onChange={(e) => {
                                        const newArr = [...bahanBakuList];
                                        newArr[idx].idInventory = e.target.value;
                                        setBahanBakuList(newArr);
                                      }}
                                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#1E4648]"
                                    >
                                      <option value="">-- Pilih Bahan Baku --</option>
                                      {inventoryList.map(inv => (
                                        <option key={inv.id} value={inv.id}>{inv.nama} (Stok: {inv.stok} {inv.satuan})</option>
                                      ))}
                                    </select>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBahanBakuList(bahanBakuList.filter((_, i) => i !== idx));
                                    }}
                                    className="mt-3.5 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                    title="Hapus Bahan"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Takaran per 1 {satuan || 'layanan'}</label>
                                    <div className="flex gap-1.5 items-center">
                                      <input
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => {
                                          const newArr = [...bahanBakuList];
                                          newArr[idx].qty = parseFloat(e.target.value) || 0;
                                          setBahanBakuList(newArr);
                                        }}
                                        min="0"
                                        step="0.1"
                                        placeholder="1"
                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#1E4648] font-bold text-slate-800"
                                      />
                                      <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                                        {selectedInv?.satuan || 'unit'}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Tahap Pengurangan</label>
                                    <select
                                      value={item.tahap || 'Dicuci'}
                                      onChange={(e) => {
                                        const newArr = [...bahanBakuList];
                                        newArr[idx].tahap = e.target.value;
                                        setBahanBakuList(newArr);
                                      }}
                                      className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded-lg outline-none focus:border-[#1E4648] bg-slate-50 font-medium"
                                    >
                                      <option value="Dicuci">Tahap Dicuci (Washer)</option>
                                      <option value="Dikeringkan">Tahap Dikeringkan (Dryer)</option>
                                      <option value="Disetrika">Tahap Disetrika</option>
                                      <option value="Dilipat">Tahap Dilipat (Packaging)</option>
                                      <option value="Siap Diambil">Tahap Siap Diambil</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1 text-xs">Pautkan ke Stok Inventory (Opsional)</label>
                        <select 
                          value={idInventory || 'none'} 
                          onChange={(e) => {
                            const newId = e.target.value;
                            setIdInventory(newId);
                            if (newId && newId !== 'none' && newId !== 'auto') {
                              const inv = inventoryList.find(i => i.id === newId);
                              if (inv && inv.satuan) {
                                setSatuan(inv.satuan);
                              }
                            }
                          }} 
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#1E4648] text-xs font-semibold"
                        >
                          <option value="none">⛔ Tidak Ada (Tanpa Pengurangan Stok)</option>
                          <option value="auto">✨ + Buat Item Baru di Inventory Otomatis</option>
                          {inventoryList.map(inv => (
                            <option key={inv.id} value={inv.id}>📦 {inv.nama} (Stok: {inv.stok} {inv.satuan})</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {idInventory === 'none' || !idInventory
                            ? 'Pilihan "Tidak Ada" memastikan transaksi produk ini tidak mengubah / memotong stok bahan.'
                            : idInventory === 'auto'
                            ? 'Sistem akan otomatis membuat item baru di daftar inventory.'
                            : `Terpaut dengan stok ${inventoryList.find(i => i.id === idInventory)?.nama}.`}
                        </p>
                      </div>
                      {idInventory && idInventory !== 'none' && idInventory !== '' && (
                        <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg">
                          <label className="block font-semibold text-orange-900 mb-1 text-xs">Potongan Stok per 1 Transaksi</label>
                          <div className="flex gap-2 items-center">
                            <input 
                              type="number" 
                              value={inventoryDeductionQty} 
                              onChange={(e) => setInventoryDeductionQty(e.target.value)} 
                              min="0" 
                              step="0.1" 
                              placeholder="1" 
                              className="w-28 px-3 py-1.5 border border-orange-200 rounded-lg outline-none focus:border-orange-500 font-bold text-orange-900 bg-white text-xs" 
                            />
                            <span className="text-xs font-semibold text-orange-800">{inventoryList.find(i => i.id === idInventory)?.satuan || 'unit'}</span>
                          </div>
                          <p className="text-[10px] text-orange-700 mt-1">
                            Jumlah stok yang akan dikurangi setiap kali 1 {satuan || 'layanan'} dipesan.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {currentRole === 'MANAGER' && (
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Harga Modal *</label>
                        <input type="number" value={hargaModal} onChange={(e) => setHargaModal(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                        <p className="text-[10px] text-slate-400 mt-1">Biaya pokok.</p>
                      </div>
                    )}
                    <div className={currentRole !== 'MANAGER' ? 'col-span-2' : ''}>
                      <label className="block font-semibold text-slate-700 mb-1">Harga Jual *</label>
                      <input type="number" value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                      <p className="text-[10px] text-slate-400 mt-1">Harga jual pelanggan.</p>
                    </div>
                  </div>
                </div>
              </div>

              {tipe === 'FullService' && (
                <div className="pt-3 border-t border-slate-100 mt-2">
                  <label className="block font-semibold text-slate-700 mb-1">Langkah Pengerjaan (Pipeline)</label>
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
                    {customPipelineSteps.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Belum ada langkah pipeline.</p>
                    ) : (
                      customPipelineSteps.map((step, idx) => {
                        const StepIcon = getStepIconComponent(step.icon, step.nama);
                        return (
                          <div key={idx} className="flex flex-col gap-2 p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-[#1E4648] text-white flex items-center justify-center">
                                  <StepIcon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-bold text-slate-800">Langkah {idx + 1}: {step.nama}</span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => {
                                  if (idx > 0) {
                                    const newArr = [...customPipelineSteps];
                                    [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
                                    setCustomPipelineSteps(newArr);
                                  }
                                }} className="p-1 text-slate-400 hover:text-slate-600 rounded" title="Naik"><ArrowUp className="w-3.5 h-3.5" /></button>
                                <button onClick={() => {
                                  if (idx < customPipelineSteps.length - 1) {
                                    const newArr = [...customPipelineSteps];
                                    [newArr[idx + 1], newArr[idx]] = [newArr[idx], newArr[idx + 1]];
                                    setCustomPipelineSteps(newArr);
                                  }
                                }} className="p-1 text-slate-400 hover:text-slate-600 rounded" title="Turun"><ArrowDown className="w-3.5 h-3.5" /></button>
                                <button onClick={() => {
                                  setCustomPipelineSteps(customPipelineSteps.filter((_, i) => i !== idx));
                                }} className="p-1 text-rose-400 hover:text-rose-600 rounded" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                            <div className="flex gap-4 text-[10px] text-slate-500 font-semibold pl-8">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={step.needStaff} onChange={e => {
                                  const newArr = [...customPipelineSteps];
                                  newArr[idx].needStaff = e.target.checked;
                                  setCustomPipelineSteps(newArr);
                                }} className="rounded border-slate-300 text-[#1E4648] focus:ring-[#1E4648]" />
                                Wajib Input Pegawai
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={step.needMesin} onChange={e => {
                                  const newArr = [...customPipelineSteps];
                                  newArr[idx].needMesin = e.target.checked;
                                  setCustomPipelineSteps(newArr);
                                }} className="rounded border-slate-300 text-[#1E4648] focus:ring-[#1E4648]" />
                                Wajib Pilih Mesin
                              </label>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[11px] font-bold text-slate-600 mb-2">Pilih dari Master Langkah:</p>
                      <div className="flex flex-wrap gap-2">
                        {masterPipelineSteps.map((mst, i) => {
                          const isSelected = customPipelineSteps.some(c => c.nama === mst.nama);
                          const MasterIcon = getStepIconComponent(mst.icon, mst.nama);
                          return (
                            <label key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl cursor-pointer transition select-none ${isSelected ? 'bg-[#1E4648]/10 border-[#1E4648] text-[#1E4648]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCustomPipelineSteps(prev => [...prev, { step: prev.length + 1, nama: mst.nama, needStaff: mst.needStaff, needMesin: mst.needMesin, icon: mst.icon }]);
                                  } else {
                                    setCustomPipelineSteps(prev => prev.filter(c => c.nama !== mst.nama));
                                  }
                                }} 
                              />
                              <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-[#1E4648] border-[#1E4648]' : 'border-slate-300'}`}>
                                {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <MasterIcon className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-[11px] font-bold">{mst.nama}</span>
                            </label>
                          );
                        })}
                      </div>
                      <button onClick={async (e) => {
                        e.preventDefault();
                        const namaLangkah = await showPrompt("Masukkan nama langkah manual:", "Contoh: Lipat Ekstra");
                        if (namaLangkah) {
                          setCustomPipelineSteps(prev => [...prev, { step: prev.length + 1, nama: namaLangkah.trim(), needStaff: false, needMesin: false }]);
                        }
                      }} className="mt-3 text-[10px] font-bold text-slate-500 hover:text-[#1E4648] hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Tambah Manual
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Atur urutan proses spesifik untuk produk ini.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-3">
              <button onClick={() => setShowModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-md text-xs font-semibold transition">Batal</button>
              <button onClick={handleSave} disabled={loading} className="bg-[#1E4648] hover:bg-[#153233] text-white px-6 py-2 rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50">
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}



      {showDropOffModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#1E4648] flex items-center justify-center border border-teal-200">
                  <Shirt className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {editingDropOffId ? 'Edit Kategori Drop Off' : 'Tambah Kategori Drop Off'}
                </h3>
              </div>
              <button onClick={() => setShowDropOffModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDropOffCategory} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Kategori / Prioritas *</label>
                <input
                  type="text"
                  required
                  value={dropOffForm.nama}
                  onChange={(e) => setDropOffForm(prev => ({ ...prev, nama: e.target.value }))}
                  placeholder="Contoh: Reguler, Express, Kilat, Sameday"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#1E4648] font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Estimasi Durasi Pengerjaan (SLA Jam) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={dropOffForm.durasiJam}
                  onChange={(e) => setDropOffForm(prev => ({ ...prev, durasiJam: Number(e.target.value) || 24 }))}
                  placeholder="48"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#1E4648] font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">Contoh: 48 = 2 Hari, 24 = 1 Hari, 6 = 6 Jam pengerjaan</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Pilih Warna Badge</label>
                <div className="grid grid-cols-4 gap-2">
                  {PALETTE.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDropOffForm(prev => ({ ...prev, warna: p.value }))}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition text-center truncate ${p.value} ${
                        dropOffForm.warna === p.value ? 'ring-2 ring-[#1E4648] ring-offset-1 font-extrabold' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Pilih Ikon</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Clock', 'Flame', 'Zap', 'Sparkles', 'Shirt', 'Star', 'Tag', 'Package'].map((ic) => {
                    const IcComp = getIconComponent(ic);
                    return (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setDropOffForm(prev => ({ ...prev, icon: ic }))}
                        className={`p-2 border rounded-xl flex items-center justify-center gap-1.5 transition ${
                          dropOffForm.icon === ic
                            ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <IcComp className="w-4 h-4" />
                        <span className="text-[10px] font-semibold">{ic}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan / Catatan SOP</label>
                <textarea
                  rows={2}
                  value={dropOffForm.keterangan}
                  onChange={(e) => setDropOffForm(prev => ({ ...prev, keterangan: e.target.value }))}
                  placeholder="Contoh: Estimasi selesai 2 hari kerja, pakaian disortir terpisah."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#1E4648] text-xs font-medium"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDropOffModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#1E4648] hover:bg-[#153233] text-white font-bold py-2 rounded-xl text-xs shadow-xs transition disabled:opacity-50"
                >
                  {loading ? 'Menyimpan...' : 'Simpan Kategori Drop Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPromoModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-600">{editingPromoId ? 'Edit Voucher Promo' : 'Buat Voucher Promo Baru'}</h3>
              <button onClick={() => setShowPromoModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Voucher *</label>
                <input type="text" value={kodePromo} onChange={(e) => setKodePromo(e.target.value)} placeholder="LAUNDRYMEMBER" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] uppercase font-sans font-bold" />
                <p className="text-[10px] text-slate-400 mt-1">Kode unik yang dimasukkan kasir saat checkout.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nilai Potongan Diskon (Rp) *</label>
                <input type="number" value={nilaiDiskon} onChange={(e) => setNilaiDiskon(e.target.value)} placeholder="10000" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                <p className="text-[10px] text-slate-400 mt-1">Nominal potongan harga tetap.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Syarat Minimum Transaksi (Rp)</label>
                <input type="number" value={minTx} onChange={(e) => setMinTx(e.target.value)} placeholder="50000" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                <p className="text-[10px] text-slate-400 mt-1">Kosongkan atau isi 0 jika tanpa syarat belanja minimal.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPromoModal(false)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-md text-xs font-semibold">Batal</button>
              <button onClick={handleSavePromo} className="flex-1 bg-[#1E4648] text-white font-semibold py-2 rounded-md text-xs transition">Simpan Voucher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
