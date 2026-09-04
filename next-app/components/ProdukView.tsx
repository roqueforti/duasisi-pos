'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tag, Plus, RefreshCw, Trash2, Edit3, RotateCcw, X, TagIcon, Gift, Download, Upload, Zap, ArrowUp, ArrowDown, Sparkles, Shirt, Clock, Flame, Star, Layers, Delete, Search, Users, Loader2, CheckCircle, XCircle, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { runBackend } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { toCSV, downloadCSV, downloadExcel, readSpreadsheetFile } from '@/lib/csvUtils';
import { UserRole, LayananBahanBaku } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import { formatFriendlyErrorMessage, parseDecimal, formatDecimal } from '@/lib/utils';
import SatuanInput from '@/components/SatuanInput';
import { getIconComponent, getLayananStyleConfig, KategoriItem, PALETTE, ICON_OPTIONS } from '@/lib/categoryUtils';
import { getStepIconComponent } from '@/components/LangkahView';
import ImportProgressToast from '@/components/ImportProgressToast';
import InventorySelectDropdown from '@/components/InventorySelectDropdown';
import DuplicateCodesModal from '@/components/DuplicateCodesModal';

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
  targetPelanggan?: 'SEMUA' | 'MEMBER';
  maxPakaiPerPelanggan?: number;
}

const defaultPromos: PromoVoucher[] = [];

interface ProdukViewProps {
  currentRole?: UserRole;
}

export default function ProdukView({ currentRole }: ProdukViewProps = {}) {
  const { showAlert, showConfirm, showPrompt } = useDialog();
  const [activeSubTab, setActiveSubTabState] = useState<'Produk' | 'DropOff' | 'Promo' | 'Loyalitas'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('duasisi_produk_subtab');
        if (saved && ['Produk', 'DropOff', 'Promo', 'Loyalitas'].includes(saved)) {
          return saved as 'Produk' | 'DropOff' | 'Promo' | 'Loyalitas';
        }
      } catch (e) {}
    }
    return 'Produk';
  });

  const setActiveSubTab = (tab: 'Produk' | 'DropOff' | 'Promo' | 'Loyalitas') => {
    setActiveSubTabState(tab);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('duasisi_produk_subtab', tab);
      } catch (e) {}
    }
  };
  const [layananList, setLayananList] = useState<LayananItemBackend[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [promoList, setPromoList] = useState<PromoVoucher[]>(defaultPromos);
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importProgressText, setImportProgressText] = useState('');
  const [importProgressPercent, setImportProgressPercent] = useState(0);
  const [importIsComplete, setImportIsComplete] = useState(false);
  const [importIsError, setImportIsError] = useState(false);
  const [filterKategori, setFilterKategori] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'kategori' | 'nama' | 'kode' | 'harga' | 'tipe'>('kategori');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Checkbox & Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [bulkTargetCategory, setBulkTargetCategory] = useState('');

  const handleHeaderSort = (field: 'kategori' | 'nama' | 'kode' | 'harga' | 'tipe') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
  const [jenisDiskonPromo, setJenisDiskonPromo] = useState<'Nominal' | 'Persen'>('Nominal');
  const [nilaiDiskon, setNilaiDiskon] = useState('10000');
  const [minTx, setMinTx] = useState('0');
  const [targetPelangganPromo, setTargetPelangganPromo] = useState<'SEMUA' | 'MEMBER'>('SEMUA');
  const [maxPakaiPerPelanggan, setMaxPakaiPerPelanggan] = useState('0');

  // Loyalty Settings
  const [poinRate, setPoinRate] = useState('10000');

  // Pending Inventory Linking
  const [pendingInventory, setPendingInventory] = useState<Record<string, string>>({});

  // Duplicate Codes Audit Modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isSilentSyncing, setIsSilentSyncing] = useState(false);

  // Map of code occurrences across loaded products
  const duplicateCodeMap = useMemo(() => {
    const counts: Record<string, number> = {};
    layananList.forEach(l => {
      const c = (l.id || '').trim().toUpperCase();
      if (c) counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [layananList]);

  // Real-time duplicate check for the Add/Edit Product form
  const duplicateCheck = useMemo(() => {
    const trimmed = kode.trim().toUpperCase();
    if (!trimmed) return null;
    const found = layananList.find(l => l.id.toUpperCase() === trimmed && (!editingId || l.id !== editingId));
    return found ? found.nama : null;
  }, [kode, layananList, editingId]);

  const loadAllData = useCallback(async (forceFresh = false, isSilent = false) => {
    if (isSilent) {
      setIsSilentSyncing(true);
    } else {
      setLoading(true);
    }
    if (forceFresh) {
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      clearCache('getKategoriList');
      clearCache('getInventoryList');
      clearCache('getPromoList');
      clearCache('getPoinConfig');
      clearCache('getPriorityConfig');
      clearCache('getPipelineConfigData');
    }
    try {
      const [layData, katData, invData, promoData, poinData, priorityData, pipeData] = await Promise.all([
        runBackend<LayananItemBackend[]>('getLayananListAll').catch(() => []),
        runBackend<KategoriItem[]>('getKategoriList').catch(() => []),
        runBackend<InventoryItem[]>('getInventoryList').catch(() => []),
        runBackend<PromoVoucher[]>('getPromoList').catch(() => []),
        runBackend<{ rate: number }>('getPoinConfig').catch(() => null),
        runBackend<DropOffPriorityItem[]>('getPriorityConfig').catch(() => null),
        runBackend<CustomPipelineStep[]>('getPipelineConfigData').catch(() => []),
      ]);

      if (Array.isArray(katData)) {
        setKategoriList(katData.filter(k => k.aktif === 'Y'));
      }
      if (Array.isArray(layData)) {
        setLayananList(layData);
      }
      if (Array.isArray(invData)) {
        setInventoryList(invData);
      }
      if (Array.isArray(promoData) && promoData.length > 0) {
        setPromoList(promoData);
      }
      if (poinData && poinData.rate) {
        setPoinRate(poinData.rate.toString());
      }
      if (Array.isArray(priorityData) && priorityData.length > 0) {
        setDropOffCategories(priorityData.map(d => ({
          id: d.id || `do-${Date.now()}-${Math.random()}`,
          nama: d.nama,
          durasiJam: Number(d.durasiJam || (d as any).sla || 24),
          icon: d.icon || 'Clock',
          warna: d.warna || 'bg-teal-100 text-teal-800 border-teal-300',
          keterangan: d.keterangan || '',
          aktif: d.aktif !== false
        })));
      }
      if (Array.isArray(pipeData)) {
        setMasterPipelineSteps(pipeData);
      }
    } catch (err) {
      console.error('Gagal memuat master data:', err);
    } finally {
      setLoading(false);
      setIsSilentSyncing(false);
    }
  }, []);

  const loadProduk = useCallback((isSilent = false) => loadAllData(true, isSilent), [loadAllData]);
  const loadKategori = useCallback(() => loadAllData(false), [loadAllData]);
  const loadInventory = useCallback(() => loadAllData(false), [loadAllData]);
  const loadPromo = useCallback(() => loadAllData(false), [loadAllData]);
  const loadPoinConfig = useCallback(() => loadAllData(false), [loadAllData]);
  const loadDropOffCategories = useCallback(() => loadAllData(false), [loadAllData]);
  const loadMasterPipelineSteps = useCallback(() => loadAllData(false), [loadAllData]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

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
        await loadAllData(true);
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
      await loadAllData(true);
    } catch (err: any) {
      console.error(err);
      await showAlert('Gagal menyesuaikan kode produk: ' + (err?.message || String(err)), 'error');
    } finally {
      setLoading(false);
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
        ? item.bahanBakuList.map(b => ({ ...b, qty: parseDecimal(b.qty, 1) }))
        : (item.idInventory && item.idInventory !== 'none' ? [{ idInventory: item.idInventory, qty: parseDecimal(item.inventoryDeductionQty, 1), tahap: 'Dicuci' }] : [])
    );
    let pSteps: CustomPipelineStep[] = [];
    if (Array.isArray(item.pipelineSteps) && item.pipelineSteps.length > 0) {
      pSteps = item.pipelineSteps as CustomPipelineStep[];
    } else if (typeof item.pipelineSteps === 'string' && (item.pipelineSteps as string).trim()) {
      try {
        pSteps = JSON.parse(item.pipelineSteps as string);
      } catch {}
    }
    setCustomPipelineSteps(pSteps);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nama.trim() || !harga.trim()) { await showAlert('Nama dan harga wajib diisi!', 'warning'); return; }
    
    // Check duplicate code client-side
    if (kode.trim()) {
      const trimmed = kode.trim().toUpperCase();
      const duplicateItem = layananList.find(l => l.id.toUpperCase() === trimmed && (!editingId || l.id !== editingId));
      if (duplicateItem) {
        await showAlert(`Kode produk "${kode.trim()}" sudah digunakan oleh "${duplicateItem.nama}". Kode produk harus unik!`, 'warning');
        return;
      }
    }

    const payloadPipeline = customPipelineSteps.map((s, i) => ({ ...s, step: i + 1 }));
    const filteredBahan = bahanBakuList.filter(b => b.idInventory && b.idInventory.trim());
    const isMultiBahan = tipe === 'FullService' || (kategori || '').toLowerCase().includes('drop') || filteredBahan.length > 0;
    const cleanDedQty = parseDecimal(inventoryDeductionQty, 1);
    const isFullServiceOrDrop = tipe === 'FullService' || (kategori || '').toLowerCase().includes('drop');
    const payload = {
        kode: kode.trim(),
        nama: nama.trim(),
        harga: Number(harga) || 0,
        satuan,
        icon,
        tipe: tipe || '',
        kategori,
        kategoriDropOff: isFullServiceOrDrop ? kategoriDropOff : '',
        idInventory: isMultiBahan ? (filteredBahan[0]?.idInventory || 'none') : (idInventory ? idInventory : 'none'),
        inventoryDeductionQty: isMultiBahan ? (filteredBahan[0]?.qty !== undefined ? parseDecimal(filteredBahan[0]?.qty, 1) : undefined) : (idInventory && idInventory !== 'none' ? cleanDedQty : undefined),
        bahanBakuList: isMultiBahan ? (filteredBahan.length > 0 ? filteredBahan.map(b => ({ ...b, qty: parseDecimal(b.qty, 1) })) : undefined) : undefined,
        hargaModal: Number(hargaModal) || 0,
        pipelineSteps: isFullServiceOrDrop ? payloadPipeline : []
      };
    setLoading(true);
    try {
      let res: any;
      if (editingId) {
        res = await runBackend('updateLayanan', editingId, payload);
      } else {
        res = await runBackend('tambahLayanan', payload);
      }
      if (res && res.success === false) {
        await showAlert(res.message || 'Gagal menyimpan layanan', 'error');
        setLoading(false);
        return;
      }

      // Optimistic local state update (Zero-flicker, instant response)
      const savedCode = (res && res.id) ? res.id : (payload.kode || editingId || 'NEW');
      const optimisticItem: LayananItemBackend = {
        id: savedCode,
        nama: payload.nama,
        harga: payload.harga,
        satuan: payload.satuan,
        icon: payload.icon,
        aktif: 'Y',
        tipe: (payload.tipe || '') as '' | 'SelfService' | 'FullService',
        kategori: payload.kategori,
        kategoriDropOff: payload.kategoriDropOff,
        idInventory: payload.idInventory,
        hargaModal: payload.hargaModal,
        inventoryDeductionQty: payload.inventoryDeductionQty,
        bahanBakuList: payload.bahanBakuList,
        pipelineSteps: payload.pipelineSteps
      };
      setLayananList((prev) => {
        if (editingId) {
          return prev.map((item) => (item.id === editingId ? { ...item, ...optimisticItem } : item));
        } else {
          return [optimisticItem, ...prev];
        }
      });

      setShowModal(false);
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      // Silent sync with backend without destroying the table
      loadProduk(true);
      await showAlert('Layanan berhasil disimpan!', 'success');
    } catch (err: any) {
      await showAlert(err?.message || 'Gagal menyimpan layanan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLinkInventory = async (idLayanan: string, newIdInv: string, productName: string) => {
    // Optimistic update
    setLayananList(prev => prev.map(item => item.id === idLayanan ? { ...item, idInventory: newIdInv === 'none' ? '' : newIdInv } : item));
    try {
      const res = await runBackend<{ success: boolean; idLayanan?: string; idInventory?: string; message?: string }>(
        'pautkanInventoryLayanan',
        idLayanan,
        newIdInv
      );

      clearCache('getInventoryList');
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      clearCache('getDaftarLayanan');

      loadAllData(true, true);

      const isAuto = newIdInv === 'auto';
      const isUnlink = newIdInv === 'none' || !newIdInv;
      if (isAuto) {
        await showAlert(`Berhasil membuat item stok baru dan menautkannya ke "${productName}"!`, 'success');
      } else if (isUnlink) {
        await showAlert(`Pautan stok untuk "${productName}" telah dilepas.`, 'info');
      } else {
        const invObj = inventoryList.find(i => i.id === newIdInv);
        await showAlert(`"${productName}" berhasil ditautkan ke stok "${invObj?.nama || newIdInv}"!`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      try {
        const item = layananList.find(l => l.id === idLayanan);
        if (item) {
          await runBackend('updateLayanan', idLayanan, {
            ...item,
            idInventory: newIdInv === 'none' ? '' : newIdInv
          });
          clearCache('getInventoryList');
          clearCache('getLayananListAll');
          clearCache('getLayananList');
          loadAllData(true, true);
          await showAlert(`Pautan stok berhasil diperbarui!`, 'success');
        }
      } catch (fallbackErr: any) {
        await showAlert('Gagal mengubah pautan stok: ' + (fallbackErr.message || String(fallbackErr)), 'error');
      }
    }
  };

  const handleToggleAktif = async (id: string, isY: boolean) => {
    // Optimistic update
    setLayananList(prev => prev.map(item => item.id === id ? { ...item, aktif: isY ? 'N' : 'Y' } : item));
    try {
      await runBackend('toggleAktifLayanan', id, !isY);
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      loadProduk(true);
      await showAlert(`Layanan berhasil di${isY ? 'nonaktifkan' : 'aktifkan'}!`, 'success');
    } catch (err) {
      // Revert on error
      setLayananList(prev => prev.map(item => item.id === id ? { ...item, aktif: isY ? 'Y' : 'N' } : item));
      await showAlert('Gagal mengubah status', 'error');
    }
  };

  const handleHapusLayanan = async (id: string) => {
    const isConfirmed = await showConfirm('Yakin ingin menghapus layanan ini?');
    if (!isConfirmed) return;
    const previous = [...layananList];
    // Optimistic delete
    setLayananList(prev => prev.filter(item => item.id !== id));
    try {
      await runBackend('hapusLayanan', id);
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      loadProduk(true);
      await showAlert('Layanan berhasil dihapus!', 'success');
    } catch (err) {
      setLayananList(previous);
      await showAlert('Gagal menghapus layanan', 'error');
    }
  };

  const handleOpenAddPromo = () => {
    setEditingPromoId(null);
    setKodePromo('');
    setJenisDiskonPromo('Nominal');
    setNilaiDiskon('10000');
    setMinTx('0');
    setTargetPelangganPromo('SEMUA');
    setMaxPakaiPerPelanggan('0');
    setShowPromoModal(true);
  };

  const handleSavePromo = async () => {
    if (!kodePromo.trim()) { await showAlert('Kode promo wajib diisi!', 'warning'); return; }
    const payload = {
      kodeVoucher: kodePromo.trim().toUpperCase(),
      jenisDiskon: jenisDiskonPromo,
      nilaiDiskon: Number(nilaiDiskon) || 0,
      minTransaksi: Number(minTx) || 0,
      targetPelanggan: targetPelangganPromo,
      maxPakaiPerPelanggan: Number(maxPakaiPerPelanggan) || 0
    };
    try {
      if (editingPromoId) {
        await runBackend('editPromo', editingPromoId, payload);
      } else {
        await runBackend('tambahPromo', payload);
      }
      clearCache('getPromoList');
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
    setJenisDiskonPromo((prm.jenisDiskon as any) || 'Nominal');
    setNilaiDiskon(prm.nilaiDiskon.toString());
    setMinTx(prm.minTransaksi?.toString() || '0');
    setTargetPelangganPromo(prm.targetPelanggan === 'MEMBER' ? 'MEMBER' : 'SEMUA');
    setMaxPakaiPerPelanggan((prm.maxPakaiPerPelanggan !== undefined ? prm.maxPakaiPerPelanggan : 0).toString());
    setShowPromoModal(true);
  };

  const handleToggleAktifPromo = async (id: string, currentAktif: boolean) => {
    try {
      await runBackend('editPromo', id, { statusAktif: !currentAktif });
      clearCache('getPromoList');
      loadPromo();
    } catch (err: any) {
      await showAlert('Gagal mengubah status promo: ' + (err.message || String(err)), 'error');
    }
  };

  const handleHapusPromo = async (id: string) => {
    const isConfirmed = await showConfirm('Yakin hapus voucher promo ini?');
    if (!isConfirmed) return;
    try {
      await runBackend('hapusPromo', id);
      clearCache('getPromoList');
      loadPromo();
      await showAlert('Promo berhasil dihapus!', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus promo', 'error');
    }
  };

  const handleExportProduk = () => {
    if (layananList.length === 0) {
      showAlert('Belum ada data layanan untuk diexport.', 'warning');
      return;
    }
    const categoryOrderMap = new Map<string, number>();
    kategoriList.forEach((k, idx) => {
      categoryOrderMap.set((k.nama || '').toLowerCase().trim(), idx);
    });
    const sorted = [...layananList].sort((a, b) => {
      const katA = (a.kategori || 'Self Service').toLowerCase().trim();
      const katB = (b.kategori || 'Self Service').toLowerCase().trim();
      if (katA !== katB) {
        const orderA = categoryOrderMap.has(katA) ? categoryOrderMap.get(katA)! : 999;
        const orderB = categoryOrderMap.has(katB) ? categoryOrderMap.get(katB)! : 999;
        if (orderA !== orderB) return orderA - orderB;
        return katA.localeCompare(katB, 'id');
      }
      return (a.nama || '').localeCompare(b.nama || '', 'id');
    });

    const headers = [
      'Kode',
      'Nama Layanan',
      'Kategori',
      'Sub Kategori (Drop Off)',
      'Tipe Layanan',
      'Harga Jual',
      'Harga Modal',
      'Satuan',
      'Status'
    ];

    const rows = sorted.map(l => [
      l.id || '',
      l.nama || '',
      l.kategori || 'Self Service',
      l.kategoriDropOff || (l.tipe === 'FullService' ? 'Reguler' : ''),
      l.tipe === 'FullService' ? 'FullService' : (l.tipe === 'SelfService' ? 'SelfService' : 'Bukan Layanan'),
      l.harga || 0,
      l.hargaModal || 0,
      l.satuan || 'kg',
      l.aktif === 'Y' ? 'Aktif' : 'Non-Aktif'
    ]);

    downloadExcel('export_produk_layanan.xlsx', headers, rows, 'Master Layanan');
  };

  const handleDownloadTemplateProduk = () => {
    const headers = [
      'Kode',
      'Nama Layanan',
      'Kategori',
      'Sub Kategori (Drop Off)',
      'Tipe Layanan',
      'Harga Jual',
      'Harga Modal',
      'Satuan',
      'Status'
    ];

    const sampleRows = [
      ['DO-001', 'Cuci Lipat Reguler', 'Drop Off', 'Reguler', 'FullService', 7000, 3000, 'kg', 'Aktif'],
      ['DO-002', 'Cuci Setrika Express (24 Jam)', 'Drop Off', 'Express', 'FullService', 15000, 6000, 'kg', 'Aktif'],
      ['DO-003', 'Cuci Bed Cover (Besar)', 'Drop Off', 'Reguler', 'FullService', 35000, 12000, 'pcs', 'Aktif'],
      ['SS-001', 'Cuci + Kering 7.5 Kg (45 Mnt)', 'Self Service', '', 'SelfService', 18000, 5000, 'paket', 'Aktif'],
      ['SS-002', 'Pengering Saja (15 Menit)', 'Self Service', '', 'SelfService', 5000, 1500, 'paket', 'Aktif'],
      ['ADD-001', 'Deterjen Cair Premium (1 Porsi)', 'Add On', '', 'Bukan Layanan', 1500, 700, 'porsi', 'Aktif'],
      ['ADD-002', 'Softener Aroma Sakura', 'Add On', '', 'Bukan Layanan', 1000, 500, 'porsi', 'Aktif'],
      ['ADD-003', 'Kantong Plastik Besar', 'Add On', '', 'Bukan Layanan', 1000, 400, 'pcs', 'Aktif'],
      ['RTL-001', 'Air Mineral 600ml', 'Makanan dan Minuman', '', 'Bukan Layanan', 4000, 2500, 'botol', 'Aktif']
    ];

    downloadExcel('template_layanan_duasisi.xlsx', headers, sampleRows, 'Master Layanan');
  };

  const handleImportProduk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const currentFileName = file.name;
    e.target.value = '';
    try {
      setIsImporting(true);
      setImportFileName(currentFileName);
      setImportProgressPercent(15);
      setImportProgressText('Membaca berkas Excel/CSV...');
      setImportIsComplete(false);
      setImportIsError(false);

      const rows = await readSpreadsheetFile(file);
      if (rows.length === 0) {
        setImportIsError(true);
        setImportProgressText('Berkas Excel/CSV kosong atau format tidak sesuai.');
        await showAlert('Berkas Excel/CSV kosong atau format tidak sesuai.', 'warning');
        setTimeout(() => setIsImporting(false), 3000);
        return;
      }

      setImportProgressPercent(35);
      setImportProgressText(`Memvalidasi ${rows.length} baris produk...`);

      const itemsToImport: any[] = [];
      let failCount = 0;

      for (const row of rows) {
        // Helper fleksibel untuk membaca kolom dengan berbagai variasi nama header
        const getCol = (...keys: string[]) => {
          for (const key of keys) {
            const foundKey = Object.keys(row).find(k => k.trim().toLowerCase() === key.toLowerCase());
            if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
              return row[foundKey].trim();
            }
          }
          return '';
        };

        const nama = getCol('Nama Layanan', 'Nama Produk', 'nama', 'Nama');
        if (!nama) {
          failCount++;
          continue;
        }

        const kode = getCol('Kode', 'Kode Produk', 'ID', 'kode', 'id');
        const kategori = getCol('Kategori', 'kategori') || 'Self Service';
        const subKategori = getCol('Sub Kategori (Drop Off)', 'Sub Kategori', 'Kecepatan Drop Off', 'kategoriDropOff', 'sub_kategori');
        
        // Tipe Layanan parsing (SelfService / FullService / Bukan Layanan)
        const tipeRaw = getCol('Tipe Layanan', 'Tipe', 'tipe');
        let tipeVal: 'SelfService' | 'FullService' | '' = 'SelfService';
        const tipeLower = tipeRaw.toLowerCase();
        if (tipeLower.includes('bukan') || tipeLower === 'addon' || tipeLower === 'add on' || tipeLower === 'retail' || tipeLower === '') {
          tipeVal = '';
        } else if (tipeLower.includes('full') || tipeLower.includes('drop') || tipeLower.includes('do')) {
          tipeVal = 'FullService';
        } else if (tipeLower.includes('self') || tipeLower.includes('ss')) {
          tipeVal = 'SelfService';
        }

        // Parsing angka uang (hilangkan "Rp", titik, dsb)
        const parseCurrency = (raw: string) => {
          if (!raw) return 0;
          const cleaned = raw.replace(/[^0-9,-]/g, '').replace(',', '.');
          return Number(cleaned) || 0;
        };

        const hargaVal = parseCurrency(getCol('Harga Jual', 'Harga', 'Tarif', 'harga'));
        const hargaModalVal = parseCurrency(getCol('Harga Modal', 'HPP', 'Modal', 'hargaModal', 'modal'));
        const satuanVal = getCol('Satuan', 'satuan') || (tipeVal === 'FullService' ? 'kg' : (tipeVal === 'SelfService' ? 'paket' : 'pcs'));
        
        // Deteksi icon otomatis cerdas jika tidak disediakan di file
        const detectIcon = () => {
          const userIcon = getCol('Icon', 'Emoji', 'icon');
          if (userIcon) return userIcon;
          const n = nama.toLowerCase();
          const k = kategori.toLowerCase();
          if (n.includes('bed cover') || n.includes('sprei') || n.includes('selimut')) return '🛏️';
          if (n.includes('sepatu')) return '👟';
          if (n.includes('karpet') || n.includes('gorden')) return '🧹';
          if (n.includes('setrika') || n.includes('gosok')) return '👔';
          if (n.includes('kering') || n.includes('dryer') || n.includes('pengering')) return '♨️';
          if (n.includes('deterjen') || n.includes('sabun')) return '🧴';
          if (n.includes('softener') || n.includes('pewangi') || n.includes('parfum')) return '🌸';
          if (n.includes('plastik') || n.includes('kresek') || n.includes('bag')) return '🛍️';
          if (n.includes('kopi') || n.includes('teh') || n.includes('minum') || n.includes('air') || n.includes('mineral')) return '🥤';
          if (n.includes('snack') || n.includes('makan') || n.includes('roti')) return '🍿';
          if (n.includes('express') || n.includes('kilat') || n.includes('cepat')) return '⚡';
          if (tipeVal === 'FullService' || k.includes('drop')) return '👕';
          if (k.includes('add') || k.includes('tambahan')) return '✨';
          return '🧺';
        };

        const statusRaw = (getCol('Status', 'Aktif', 'status', 'aktif') || 'Aktif').toLowerCase();
        const aktifVal = statusRaw === 'aktif' || statusRaw === 'y' || statusRaw === 'true' || statusRaw === '1';

        const rawInvCol = getCol('Inventory', 'idInventory', 'Barang Stok', 'Bahan', 'Stok', 'Item Stok');
        let idInvToUse = 'none';
        if (rawInvCol) {
          const invColLower = rawInvCol.toLowerCase().trim();
          if (invColLower === 'auto' || invColLower === 'otomatis' || invColLower === 'ya' || invColLower === 'y' || invColLower === 'true') {
            idInvToUse = 'auto';
          } else if (invColLower !== 'none' && invColLower !== 'tidak' && invColLower !== 'tanpa stok' && invColLower !== '-') {
            const matchInv = inventoryList.find(i => i.id.toLowerCase() === invColLower || i.nama.toLowerCase() === invColLower);
            idInvToUse = matchInv ? matchInv.id : 'auto';
          }
        }

        itemsToImport.push({
          kode: kode || undefined,
          nama,
          kategori,
          subKategori,
          kategoriDropOff: (tipeVal === 'FullService' || kategori.toLowerCase().includes('drop')) ? (subKategori || 'Reguler') : '',
          harga: hargaVal,
          hargaModal: hargaModalVal,
          satuan: satuanVal,
          icon: detectIcon(),
          tipe: tipeVal,
          idInventory: idInvToUse,
          pipelineSteps: [],
          aktif: aktifVal ? 'Y' : 'N'
        });
      }

      if (itemsToImport.length === 0) {
        setImportIsError(true);
        setImportProgressText('Tidak ada produk valid yang dapat diimpor.');
        await showAlert('Tidak ada produk valid yang dapat diimpor dari file CSV.', 'warning');
        setTimeout(() => setIsImporting(false), 3000);
        return;
      }

      setImportProgressPercent(60);
      setImportProgressText(`Menyimpan ${itemsToImport.length} produk ke database...`);

      let importedCount = 0;
      try {
        // Coba jalur cepat batch import
        const res = await runBackend<{ success: boolean; importedCount?: number; message?: string }>('importLayananBatch', itemsToImport);
        if (res && res.success) {
          importedCount = res.importedCount || itemsToImport.length;
        } else {
          throw new Error(res?.message || 'Gagal import batch');
        }
      } catch (batchErr) {
        console.warn('Batch import gagal / belum tersedia, fallback ke mode sekuensial...', batchErr);
        // Fallback sekuensial jika batch API belum terdeploy
        let seqSuccess = 0;
        for (let i = 0; i < itemsToImport.length; i++) {
          const item = itemsToImport[i];
          const pct = 60 + Math.round(((i + 1) / itemsToImport.length) * 30);
          setImportProgressPercent(pct);
          setImportProgressText(`Menyimpan produk ${i + 1}/${itemsToImport.length}: ${item.nama}`);
          try {
            const res = await runBackend<{ success: boolean; id?: string }>('tambahLayanan', item);
            const createdId = res?.id || (typeof res === 'string' ? res : '');
            if (createdId && item.aktif === 'N') {
              await runBackend('toggleAktifLayanan', createdId, false);
            }
            seqSuccess++;
          } catch {
            failCount++;
          }
        }
        importedCount = seqSuccess;
      }

      setImportProgressPercent(90);
      setImportProgressText('Menyinkronkan data katalog...');
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      await loadAllData(true);

      setImportProgressPercent(100);
      setImportIsComplete(true);
      setImportProgressText(`Selesai! ${importedCount} produk berhasil masuk database.`);

      setTimeout(() => {
        setIsImporting(false);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      const friendly = formatFriendlyErrorMessage(err);
      setImportIsError(true);
      setImportProgressText(`Gagal: ${friendly.title}`);
      await showAlert(friendly.detail, 'error', friendly.title, friendly.suggestion);
      setTimeout(() => setIsImporting(false), 4000);
    }
  };

  // Map category name to index from master kategoriList
  const categoryOrderMap = new Map<string, number>();
  kategoriList.forEach((k, idx) => {
    categoryOrderMap.set((k.nama || '').toLowerCase().trim(), idx);
  });

  const uniqueKategoriList = [
    'Semua',
    ...Array.from(new Set(layananList.map(item => item.kategori || 'Self Service'))).sort((a, b) => {
      const katA = a.toLowerCase().trim();
      const katB = b.toLowerCase().trim();
      const orderA = categoryOrderMap.has(katA) ? categoryOrderMap.get(katA)! : 999;
      const orderB = categoryOrderMap.has(katB) ? categoryOrderMap.get(katB)! : 999;
      if (orderA !== orderB) return orderA - orderB;
      return katA.localeCompare(katB, 'id');
    })
  ];

  const filteredLayananList = layananList
    .filter(item => {
      const matchKategori = filterKategori === 'Semua' || (item.kategori || 'Self Service') === filterKategori;
      if (!matchKategori) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchNama = (item.nama || '').toLowerCase().includes(q);
      const matchKode = (item.id || '').toLowerCase().includes(q);
      const matchTipe = (item.tipe || '').toLowerCase().includes(q);
      const matchKat = (item.kategori || '').toLowerCase().includes(q);
      const matchDropOff = (item.kategoriDropOff || '').toLowerCase().includes(q);
      const matchSatuan = (item.satuan || '').toLowerCase().includes(q);
      return matchNama || matchKode || matchTipe || matchKat || matchDropOff || matchSatuan;
    })
    .sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;

      if (sortField === 'kategori') {
        const katA = (a.kategori || 'Self Service').toLowerCase().trim();
        const katB = (b.kategori || 'Self Service').toLowerCase().trim();
        if (katA !== katB) {
          const orderA = categoryOrderMap.has(katA) ? categoryOrderMap.get(katA)! : 999;
          const orderB = categoryOrderMap.has(katB) ? categoryOrderMap.get(katB)! : 999;
          if (orderA !== orderB) return (orderA - orderB) * dir;
          return katA.localeCompare(katB, 'id') * dir;
        }
        // Sub-sort by name
        return (a.nama || '').localeCompare(b.nama || '', 'id');
      }

      if (sortField === 'nama') {
        return (a.nama || '').localeCompare(b.nama || '', 'id') * dir;
      }

      if (sortField === 'kode') {
        return (a.id || '').localeCompare(b.id || '', 'id') * dir;
      }

      if (sortField === 'harga') {
        return ((a.harga || 0) - (b.harga || 0)) * dir;
      }

      if (sortField === 'tipe') {
        return (a.tipe || '').localeCompare(b.tipe || '', 'id') * dir;
      }

      return 0;
    });

  // Checkbox helpers & Bulk Action Handlers
  const isAllSelected = filteredLayananList.length > 0 && filteredLayananList.every(item => selectedIds.has(item.id));
  const isSomeSelected = filteredLayananList.some(item => selectedIds.has(item.id)) && !isAllSelected;

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const next = new Set(selectedIds);
      filteredLayananList.forEach(item => next.add(item.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredLayananList.forEach(item => next.delete(item.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectRow = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkToggleStatus = async (aktif: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const actionName = aktif ? 'mengaktifkan' : 'menonaktifkan';
    const isConfirmed = await showConfirm(`Apakah Anda yakin ingin ${actionName} ${ids.length} layanan yang dipilih?`);
    if (!isConfirmed) return;

    setLoading(true);
    try {
      try {
        await runBackend('batchToggleAktifLayanan', ids, aktif);
      } catch (e) {
        for (const id of ids) {
          await runBackend('toggleAktifLayanan', id, aktif);
        }
      }
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      await loadAllData(true);
      setSelectedIds(new Set());
      await showAlert(`${ids.length} layanan berhasil di${aktif ? 'aktifkan' : 'nonaktifkan'}!`, 'success');
    } catch (err: any) {
      await showAlert(`Gagal mengubah status layanan: ${err?.message || String(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkHapus = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const isConfirmed = await showConfirm(
      `⚠️ PERINGATAN: Apakah Anda yakin ingin menghapus ${ids.length} layanan terpilih secara permanen? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!isConfirmed) return;

    setLoading(true);
    try {
      try {
        await runBackend('batchHapusLayanan', ids);
      } catch (e) {
        for (const id of ids) {
          await runBackend('hapusLayanan', id);
        }
      }
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      await loadAllData(true);
      setSelectedIds(new Set());
      await showAlert(`${ids.length} layanan berhasil dihapus dari database!`, 'success');
    } catch (err: any) {
      await showAlert(`Gagal menghapus layanan: ${err?.message || String(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUbahKategori = async () => {
    if (selectedIds.size === 0 || !bulkTargetCategory) return;
    const ids = Array.from(selectedIds);
    setLoading(true);
    try {
      try {
        await runBackend('batchUbahKategoriLayanan', ids, bulkTargetCategory);
      } catch (e) {
        for (const id of ids) {
          const item = layananList.find(l => l.id === id);
          if (item) {
            await runBackend('updateLayanan', id, { ...item, kategori: bulkTargetCategory });
          }
        }
      }
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      await loadAllData(true);
      setSelectedIds(new Set());
      setShowBulkCategoryModal(false);
      await showAlert(`Kategori ${ids.length} layanan berhasil diubah menjadi "${bulkTargetCategory}"!`, 'success');
    } catch (err: any) {
      await showAlert(`Gagal mengubah kategori: ${err?.message || String(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;
    const selectedItems = layananList.filter(l => selectedIds.has(l.id));
    const headers = [
      'Kode',
      'Nama Layanan',
      'Kategori',
      'Sub Kategori (Drop Off)',
      'Tipe Layanan',
      'Harga Jual',
      'Harga Modal',
      'Satuan',
      'Status'
    ];
    const rows = selectedItems.map(l => [
      l.id || '',
      l.nama || '',
      l.kategori || 'Self Service',
      l.kategoriDropOff || (l.tipe === 'FullService' ? 'Reguler' : ''),
      l.tipe === 'FullService' ? 'FullService' : (l.tipe === 'SelfService' ? 'SelfService' : 'Bukan Layanan'),
      l.harga || 0,
      l.hargaModal || 0,
      l.satuan || 'kg',
      l.aktif === 'Y' ? 'Aktif' : 'Non-Aktif'
    ]);
    downloadCSV(`export_layanan_terpilih_${selectedItems.length}.csv`, toCSV(headers, rows));
  };

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
            className="bg-[#1E4648] hover:bg-[#163536] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Kategori Drop Off
          </button>
        )}

        {activeSubTab === 'Promo' && currentRole === 'MANAGER' && (
          <button
            onClick={handleOpenAddPromo}
            className="bg-[#1E4648] hover:bg-[#163536] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> + Buat Voucher Promo
          </button>
        )}

        {activeSubTab === 'Produk' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input Filter */}
            <div className="relative min-w-[180px] sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari produk / kode..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648] focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#1E4648] text-xs font-semibold text-slate-700 bg-white shadow-2xs cursor-pointer"
            >
              {uniqueKategoriList.map(kat => (
                <option key={kat} value={kat}>{kat === 'Semua' ? 'Semua Kategori' : kat}</option>
              ))}
            </select>

            <button
              onClick={() => loadAllData(true, layananList.length > 0)}
              disabled={loading || isSilentSyncing}
              className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer flex items-center justify-center disabled:opacity-50"
              title="Refresh / Muat Ulang Data Layanan & Kategori"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || isSilentSyncing ? 'animate-spin text-[#1E4648]' : ''}`} />
            </button>

            {currentRole === 'MANAGER' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDuplicateModal(true)}
                  className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 cursor-pointer ${
                    Object.values(duplicateCodeMap).some(count => count > 1)
                      ? 'bg-amber-100 border-amber-300 text-amber-900 animate-pulse font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Audit dan rapikan jika ditemukan kode produk kembar/duplikat"
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${Object.values(duplicateCodeMap).some(count => count > 1) ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span>Audit Kode {Object.values(duplicateCodeMap).some(count => count > 1) && `(Duplikat!)`}</span>
                </button>
                <button onClick={handleExportProduk} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 cursor-pointer" title="Export Data Layanan yang ada ke CSV">
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
                <button onClick={handleDownloadTemplateProduk} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-semibold transition shadow-2xs cursor-pointer" title="Download Template Master Excel (.xlsx) Baru">
                  Template Excel
                </button>
                <label className="cursor-pointer px-2.5 py-1.5 border border-[#B5C9C9] rounded-lg text-[#1E4648] hover:bg-[#B5C9C9]/10 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs" title="Import Data Layanan dari Berkas Excel (.xlsx, .xls) atau CSV">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportProduk} />
                </label>
                <button
                  onClick={handleOpenAdd}
                  className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs cursor-pointer"
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
        <div className="space-y-3">
          {/* Floating / Sticky Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="bg-[#1E4648] text-white p-2.5 px-4 rounded-xl flex items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2 duration-200 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="bg-white/20 text-white font-bold text-xs px-2.5 py-1 rounded-lg">
                  {selectedIds.size} Layanan Terpilih
                </span>
                <span className="text-xs text-white/80 hidden sm:inline">• Aksi Cepat Massal</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleBulkToggleStatus(true)}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Aktifkan seluruh layanan terpilih"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Aktifkan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggleStatus(false)}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Nonaktifkan seluruh layanan terpilih"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-300" />
                  <span>Nonaktifkan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkTargetCategory(kategoriList[0]?.nama || 'Self Service');
                    setShowBulkCategoryModal(true);
                  }}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Ubah kategori seluruh layanan terpilih"
                >
                  <Tag className="w-3.5 h-3.5 text-amber-300" />
                  <span>Ubah Kategori</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkExport}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Export hanya layanan yang dipilih ke CSV"
                >
                  <Download className="w-3.5 h-3.5 text-teal-300" />
                  <span>Export</span>
                </button>
                {currentRole === 'MANAGER' && (
                  <button
                    type="button"
                    onClick={handleBulkHapus}
                    className="px-2.5 py-1.5 bg-rose-500/80 hover:bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Hapus seluruh layanan terpilih"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="p-1.5 hover:bg-white/20 text-white/70 hover:text-white rounded-lg transition cursor-pointer ml-1"
                  title="Batalkan Pilihan"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider select-none">
                    <th className="w-10 py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-[#1E4648] rounded border-slate-300 focus:ring-[#1E4648] cursor-pointer"
                        title={isAllSelected ? 'Batalkan pilih semua' : 'Pilih semua'}
                      />
                    </th>
                    <th 
                      onClick={() => handleHeaderSort('kode')}
                      className="py-2.5 px-3 cursor-pointer hover:text-[#1E4648] hover:bg-slate-100/80 transition"
                      title="Klik untuk mengurutkan berdasarkan Kode"
                    >
                      <div className="flex items-center gap-1">
                        <span>Kode</span>
                        {sortField === 'kode' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1E4648]" /> : <ArrowDown className="w-3 h-3 text-[#1E4648]" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleHeaderSort('nama')}
                      className="py-2.5 px-3 cursor-pointer hover:text-[#1E4648] hover:bg-slate-100/80 transition"
                      title="Klik untuk mengurutkan berdasarkan Nama Layanan"
                    >
                      <div className="flex items-center gap-1">
                        <span>Nama Produk / Layanan</span>
                        {sortField === 'nama' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1E4648]" /> : <ArrowDown className="w-3 h-3 text-[#1E4648]" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleHeaderSort('kategori')}
                      className={`py-2.5 px-3 cursor-pointer transition ${sortField === 'kategori' ? 'bg-teal-50/70 text-[#1E4648]' : 'hover:text-[#1E4648] hover:bg-slate-100/80'}`}
                      title="Klik untuk mengurutkan berdasarkan Kategori (Bawaan)"
                    >
                      <div className="flex items-center gap-1 font-extrabold text-[#1E4648]">
                        <span>Kategori</span>
                        {sortField === 'kategori' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUp className="w-3 h-3 opacity-30" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleHeaderSort('tipe')}
                      className="py-2.5 px-3 cursor-pointer hover:text-[#1E4648] hover:bg-slate-100/80 transition"
                      title="Klik untuk mengurutkan berdasarkan Tipe"
                    >
                      <div className="flex items-center gap-1">
                        <span>Tipe</span>
                        {sortField === 'tipe' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1E4648]" /> : <ArrowDown className="w-3 h-3 text-[#1E4648]" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Inventory</th>
                    <th className="py-2.5 px-3">Potongan Stok</th>
                    {currentRole === 'MANAGER' && <th className="py-2.5 px-3">Modal & Profit</th>}
                    <th 
                      onClick={() => handleHeaderSort('harga')}
                      className="py-2.5 px-3 cursor-pointer hover:text-[#1E4648] hover:bg-slate-100/80 transition"
                      title="Klik untuk mengurutkan berdasarkan Tarif Jual"
                    >
                      <div className="flex items-center gap-1">
                        <span>Tarif Jual</span>
                        {sortField === 'harga' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1E4648]" /> : <ArrowDown className="w-3 h-3 text-[#1E4648]" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-2 px-3 text-center"><div className="w-4 h-4 bg-slate-100 rounded mx-auto" /></td>
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
                    <tr><td colSpan={currentRole === 'MANAGER' ? 11 : 10} className="py-8 text-center text-slate-400">Belum ada data layanan</td></tr>
                  ) : (
                    filteredLayananList.map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => handleToggleSelectRow(item.id)}
                        className={`transition cursor-pointer ${
                          selectedIds.has(item.id) 
                            ? 'bg-teal-50/70 border-l-2 border-l-[#1E4648]' 
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={(e) => handleToggleSelectRow(item.id, e)}
                            className="w-4 h-4 text-[#1E4648] rounded border-slate-300 focus:ring-[#1E4648] cursor-pointer"
                          />
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80">
                              {item.id}
                            </span>
                            {(duplicateCodeMap[(item.id || '').trim().toUpperCase()] || 0) > 1 && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-0.5 cursor-pointer hover:bg-amber-200 transition"
                                title="Kode ini terdeteksi kembar/duplikat! Klik tombol Audit Kode untuk merapikannya."
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDuplicateModal(true);
                                }}
                              >
                                ⚠️ Duplikat
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-3 font-semibold text-slate-700 text-xs">
                          {item.nama}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500 font-medium whitespace-nowrap">
                          {(() => {
                            if (!item.kategori) return <span className="text-slate-300 text-xs">-</span>;
                            const kat = kategoriList.find(k => (k.nama || '').toLowerCase().trim() === (item.kategori || '').toLowerCase().trim());
                            const style = getLayananStyleConfig(
                              { layanan: item.nama, kategori: item.kategori, tipe: item.tipe as any } as any,
                              kategoriList
                            );
                            const KatIcon = kat ? getIconComponent(kat.icon) : (style.Icon || Tag);
                            const badgeColor = kat?.warna || style.badgeStyle || 'bg-slate-100 text-slate-700 border-slate-200';
                            return (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 border shadow-2xs ${badgeColor}`}>
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
                        <td className="py-1.5 px-3" onClick={(e) => e.stopPropagation()}>
                          {(!item.tipe || String(item.tipe).toLowerCase() === 'bukan layanan' || String(item.tipe) === '') ? (
                            <InventorySelectDropdown
                              currentId={item.idInventory}
                              productName={item.nama}
                              productSatuan={item.satuan}
                              inventoryList={inventoryList}
                              onSelect={(newId) => handleQuickLinkInventory(item.id, newId, item.nama)}
                              size="sm"
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 whitespace-nowrap">
                          {(item.tipe === 'FullService' || (item.kategori || '').toLowerCase().includes('drop')) && item.bahanBakuList && item.bahanBakuList.length > 0 ? (
                            <div className="flex flex-col gap-1 max-w-[180px]">
                              {item.bahanBakuList.map((b, bIdx) => {
                                const inv = inventoryList.find(i => i.id === b.idInventory);
                                return (
                                  <span key={bIdx} className="text-[10px] font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate" title={`${inv?.nama || b.idInventory}: ${formatDecimal(b.qty)} ${inv?.satuan || 'unit'}`}>
                                    <strong className="text-slate-800">{inv?.nama || b.idInventory}</strong>: {formatDecimal(b.qty)} {inv?.satuan || 'unit'}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (item.idInventory && item.idInventory !== 'none' && inventoryList.some(inv => inv.id === item.idInventory)) ? (
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-[#1E4648] bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/80 text-[11px] font-mono">
                                {formatDecimal(item.inventoryDeductionQty !== undefined && item.inventoryDeductionQty !== null ? item.inventoryDeductionQty : 1)}
                                <span className="text-teal-900/80 font-medium text-[9px] ml-1">
                                  {inventoryList.find(inv => inv.id === item.idInventory)?.satuan || 'unit'}
                                </span>
                              </span>
                              <span className="text-[9px] text-slate-400 font-medium">/ trx</span>
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
                        <td className="py-1.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        <td className="py-1.5 px-3 text-right space-x-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Kode Voucher</th>
                  <th className="py-3 px-4">Jenis Diskon</th>
                  <th className="py-3 px-4">Nilai Potongan</th>
                  <th className="py-3 px-4">Min. Belanja</th>
                  <th className="py-3 px-4">Berlaku Untuk</th>
                  <th className="py-3 px-4">Batas / Pelanggan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promoList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Belum ada voucher promo. Klik tombol <strong>+ Buat Voucher Promo</strong> di atas.
                    </td>
                  </tr>
                ) : (
                  promoList.map((prm) => (
                    <tr key={prm.idPromo} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold font-mono text-[#1E4648] text-sm">{prm.kodeVoucher}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-semibold">{prm.jenisDiskon === 'Persen' ? 'Persentase' : 'Nominal'}</span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1E4648] font-mono">
                        {prm.jenisDiskon === 'Persen' ? `${prm.nilaiDiskon}%` : `Rp ${(prm?.nilaiDiskon || 0).toLocaleString('id-ID')}`}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {prm.minTransaksi > 0 ? `Rp ${prm.minTransaksi.toLocaleString('id-ID')}` : <span className="text-slate-400">Tanpa Min.</span>}
                      </td>
                      <td className="py-3 px-4">
                        {prm.targetPelanggan === 'MEMBER' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-lg text-[11px] font-bold shadow-2xs">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Khusus Member</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-teal-50 text-[#1E4648] border border-teal-200 px-2.5 py-0.5 rounded-lg text-[11px] font-bold">
                            <Users className="w-3 h-3 text-[#1E4648]" />
                            <span>Semua Pelanggan</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {prm.maxPakaiPerPelanggan && prm.maxPakaiPerPelanggan > 0 ? (
                          <span className="inline-block bg-slate-100 text-slate-700 font-mono font-bold px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
                            {prm.maxPakaiPerPelanggan}x / orang
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-[11px]">Tanpa Batas</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {currentRole === 'MANAGER' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAktifPromo(prm.idPromo, prm.statusAktif !== false)}
                            title={prm.statusAktif !== false ? 'Klik untuk Non-Aktifkan' : 'Klik untuk Aktifkan'}
                            className="inline-flex items-center gap-1.5 cursor-pointer select-none group"
                          >
                            <div
                              className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                                prm.statusAktif !== false ? 'bg-[#1E4648]' : 'bg-slate-300 group-hover:bg-slate-400'
                              }`}
                            >
                              <div
                                className={`bg-white w-3 h-3 rounded-full shadow-xs transform transition-transform duration-200 ease-in-out ${
                                  prm.statusAktif !== false ? 'translate-x-3' : 'translate-x-0'
                                }`}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${prm.statusAktif !== false ? 'text-[#1E4648]' : 'text-slate-400'}`}>
                              {prm.statusAktif !== false ? 'Aktif' : 'Off'}
                            </span>
                          </button>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prm.statusAktif !== false ? 'bg-teal-50 text-[#1E4648]' : 'bg-slate-100 text-slate-500'}`}>
                            {prm.statusAktif !== false ? 'Aktif' : 'Non-Aktif'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        {currentRole === 'MANAGER' ? (
                          <>
                            <button onClick={() => handleOpenEditPromo(prm)} className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition" title="Edit Promo">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleHapusPromo(prm.idPromo)} className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition" title="Hapus Promo">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
                      className={`w-full px-3 py-2 border rounded-md outline-none font-mono text-xs ${
                        duplicateCheck
                          ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                          : 'border-slate-200 focus:border-[#1E4648]'
                      }`}
                    />
                    {duplicateCheck ? (
                      <div className="mt-1 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md flex items-center gap-1.5 animate-shake">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>Kode ini sudah digunakan oleh "{duplicateCheck}". Kode produk harus unik!</span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 mt-1">Kosongkan untuk penomoran otomatis berdasarkan kategori & tipe.</p>
                    )}
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
                        <span>Unit Stok Inventory: <strong>{inventoryList.find(i => i.id === idInventory)?.satuan}</strong></span>
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
                    <div className="space-y-3 bg-slate-50 border border-slate-200/90 p-3.5 rounded-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <label className="block font-bold text-slate-800 text-xs truncate">
                            Resep Bahan Baku (BOM)
                          </label>
                          <p className="text-[10px] text-slate-500 line-clamp-1">
                            Bahan otomatis terpotong saat pengerjaan Drop Off
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBahanBakuList(prev => [...prev, { idInventory: '', qty: 1, tahap: 'Dicuci' }]);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold bg-[#1E4648] text-white rounded-lg hover:bg-[#163436] transition inline-flex items-center gap-1 shadow-xs shrink-0 cursor-pointer whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah Bahan</span>
                        </button>
                      </div>

                      {bahanBakuList.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-3.5 text-center text-xs">
                          <p className="font-semibold text-slate-600 mb-0.5">Belum ada bahan baku terpaut</p>
                          <p className="text-[10px] text-slate-400">
                            Klik <strong className="text-slate-600">+ Tambah Bahan</strong> untuk memasukkan Deterjen, Softener, Plastik, dll.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {bahanBakuList.map((item, idx) => {
                            const selectedInv = inventoryList.find(i => i.id === item.idInventory);
                            return (
                              <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-xl space-y-2 shadow-2xs">
                                <div className="flex gap-2 items-center">
                                  <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Bahan Inventory #{idx + 1}</label>
                                    <select
                                      value={item.idInventory}
                                      onChange={(e) => {
                                        const newArr = [...bahanBakuList];
                                        newArr[idx].idInventory = e.target.value;
                                        setBahanBakuList(newArr);
                                      }}
                                      className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#1E4648] bg-slate-50 font-semibold"
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
                                    className="mt-3.5 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Hapus Bahan"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Takaran / 1 {satuan || 'layanan'}</label>
                                    <div className="flex gap-1.5 items-center">
                                      <input
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => {
                                          const newArr = [...bahanBakuList];
                                          newArr[idx].qty = parseDecimal(e.target.value, 0);
                                          setBahanBakuList(newArr);
                                        }}
                                        min="0"
                                        step="any"
                                        placeholder="1 (misal 0.02)"
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
                        <InventorySelectDropdown
                          currentId={idInventory || 'none'}
                          productName={nama || 'Produk'}
                          productSatuan={satuan}
                          inventoryList={inventoryList}
                          onSelect={(newId) => {
                            setIdInventory(newId);
                            if (newId && newId !== 'none' && newId !== 'auto') {
                              const inv = inventoryList.find(i => i.id === newId);
                              if (inv && inv.satuan) {
                                setSatuan(inv.satuan);
                              }
                            }
                          }}
                          size="md"
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          {idInventory === 'none' || !idInventory
                            ? 'Pilihan "Tanpa Stok" memastikan transaksi produk ini tidak mengubah / memotong stok bahan.'
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
                              step="any" 
                              placeholder="1" 
                              className="w-32 px-3 py-1.5 border border-orange-200 rounded-lg outline-none focus:border-orange-500 font-bold text-orange-900 bg-white text-xs" 
                            />
                            <span className="text-xs font-semibold text-orange-800">{inventoryList.find(i => i.id === idInventory)?.satuan || 'unit'}</span>
                          </div>
                          <p className="text-[10px] text-orange-700 mt-1">
                            Jumlah stok yang dikurangi per 1 transaksi (contoh: <strong>0.02</strong> untuk 20 ml jika satuan liter, atau <strong>1</strong> porsi/sachet).
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
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#1E4648] flex items-center justify-center border border-teal-200">
                  <TagIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {editingPromoId ? 'Edit Voucher Promo' : 'Buat Voucher Promo Baru'}
                </h3>
              </div>
              <button onClick={() => setShowPromoModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kode Voucher *</label>
                <input
                  type="text"
                  value={kodePromo}
                  onChange={(e) => setKodePromo(e.target.value.toUpperCase())}
                  placeholder="Contoh: HEMAT10, MEMBERVIP, PROMOJUMAT"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#1E4648] uppercase font-mono font-bold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">Kode kupon yang diketik kasir pada saat checkout.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Jenis Diskon *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setJenisDiskonPromo('Nominal')}
                    className={`py-2 px-3 rounded-xl font-bold border transition text-center ${
                      jenisDiskonPromo === 'Nominal'
                        ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Nominal (Rp)
                  </button>
                  <button
                    type="button"
                    onClick={() => setJenisDiskonPromo('Persen')}
                    className={`py-2 px-3 rounded-xl font-bold border transition text-center ${
                      jenisDiskonPromo === 'Persen'
                        ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Persentase (%)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {jenisDiskonPromo === 'Persen' ? 'Diskon (%) *' : 'Potongan (Rp) *'}
                  </label>
                  <input
                    type="number"
                    value={nilaiDiskon}
                    onChange={(e) => setNilaiDiskon(e.target.value)}
                    placeholder={jenisDiskonPromo === 'Persen' ? '10' : '10000'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#1E4648] font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Min. Belanja (Rp)</label>
                  <input
                    type="number"
                    value={minTx}
                    onChange={(e) => setMinTx(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#1E4648] font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Target Keanggotaan: Semua Pelanggan vs Khusus Member */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block font-bold text-slate-800">
                  Target Pelanggan yang Berhak Menggunakan *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetPelangganPromo('SEMUA')}
                    className={`py-2 px-2.5 rounded-lg font-bold border transition text-left flex items-center gap-1.5 ${
                      targetPelangganPromo === 'SEMUA'
                        ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] leading-tight">Semua Pelanggan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetPelangganPromo('MEMBER')}
                    className={`py-2 px-2.5 rounded-lg font-bold border transition text-left flex items-center gap-1.5 ${
                      targetPelangganPromo === 'MEMBER'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] leading-tight">Khusus Member</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  {targetPelangganPromo === 'MEMBER'
                    ? '⭐ Hanya nomor pelanggan yang berstatus Member terdaftar yang dapat menggunakan voucher ini saat checkout.'
                    : '👥 Berlaku bebas untuk Pelanggan Umum maupun Member.'}
                </p>
              </div>

              {/* Batas Pemakaian per Pelanggan */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">
                    Batas Pemakaian Tiap Pelanggan
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                    {Number(maxPakaiPerPelanggan) > 0 ? `${maxPakaiPerPelanggan}x per orang` : 'Tanpa Batas'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={maxPakaiPerPelanggan}
                    onChange={(e) => setMaxPakaiPerPelanggan(e.target.value)}
                    placeholder="0"
                    className="w-28 px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-[#1E4648] font-mono font-bold text-slate-800 bg-white"
                  />
                  <div className="text-[11px] text-slate-600 font-medium leading-tight">
                    {Number(maxPakaiPerPelanggan) === 0
                      ? 'Isi 0 untuk tanpa batas (bebas dipakai berkali-kali).'
                      : `Maksimal hanya dapat dipakai ${maxPakaiPerPelanggan} kali oleh tiap nomor pelanggan.`}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setShowPromoModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSavePromo}
                className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2.5 rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Simpan Voucher Promo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ubah Kategori Massal */}
      {showBulkCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 text-[#1E4648] border border-teal-100">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Ubah Kategori Massal</h3>
                  <p className="text-[11px] text-slate-500">{selectedIds.size} produk terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkCategoryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Pilih Kategori Baru:</label>
              <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {kategoriList.map(kat => {
                  const KatIcon = getIconComponent(kat.icon);
                  const isSelected = (bulkTargetCategory || '').toLowerCase().trim() === (kat.nama || '').toLowerCase().trim();
                  return (
                    <button
                      key={kat.id}
                      type="button"
                      onClick={() => setBulkTargetCategory(kat.nama)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition text-left cursor-pointer ${
                        isSelected
                          ? 'border-[#1E4648] bg-teal-50/70 text-[#1E4648] shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg border text-xs ${kat.warna || 'bg-slate-100 text-slate-700'}`}>
                          <KatIcon className="w-3.5 h-3.5" />
                        </span>
                        <span>{kat.nama}</span>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-[#1E4648]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkCategoryModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold transition flex-1"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBulkUbahKategori}
                disabled={!bulkTargetCategory}
                className="bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs transition disabled:opacity-50 flex-1 cursor-pointer"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Style Floating Progress Bar (Pojok Kanan Bawah) */}
      <ImportProgressToast
        isOpen={isImporting}
        title="Mengimpor Master Produk"
        fileName={importFileName || 'layanan.csv'}
        statusText={importProgressText}
        progressPercent={importProgressPercent}
        isComplete={importIsComplete}
        isError={importIsError}
        onClose={() => setIsImporting(false)}
      />

      {/* Modal Audit & Perapian Duplikasi Kode */}
      <DuplicateCodesModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onResolved={() => {
          setShowDuplicateModal(false);
          loadAllData(true);
        }}
      />
    </div>
  );
}
