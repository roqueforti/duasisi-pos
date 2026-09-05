'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, Plus, RefreshCw, Trash2, Edit3, AlertTriangle, Download, Upload, X, 
  Loader2, ShieldAlert, Archive, RotateCcw, ShieldCheck, TrendingUp, Scale, 
  ShoppingCart, Info, Sparkles, CheckCircle2, AlertCircle, ArrowUpRight, 
  ArrowDownRight, Layers, HelpCircle
} from 'lucide-react';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { toCSV, downloadCSV, downloadExcel, readSpreadsheetFile } from '@/lib/csvUtils';
import { UserRole, InventoryItem, InventoryUsageStats } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import { formatFriendlyErrorMessage, parseDecimal, formatDecimal, formatDateTime } from '@/lib/utils';
import SatuanInput from '@/components/SatuanInput';
import ImportProgressToast from '@/components/ImportProgressToast';

interface InventoryViewProps {
  currentRole?: UserRole;
}

export default function InventoryView({ currentRole }: InventoryViewProps = {}) {
  const { showAlert, showConfirm } = useDialog();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // DSS KPI Filter State: 'SEMUA' | 'KRITIS' | 'RENDAH' | 'SELISIH' | 'AMAN'
  const [filterKesehatan, setFilterKesehatan] = useState<'SEMUA' | 'KRITIS' | 'RENDAH' | 'SELISIH' | 'AMAN'>('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [stok, setStok] = useState('');
  const [satuan, setSatuan] = useState('pcs');
  const [stokMin, setStokMin] = useState('5');
  const [originalStok, setOriginalStok] = useState<number | null>(null);
  const [showDecimalOptions, setShowDecimalOptions] = useState(false);

  // Smart Restock Modal State
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockStats, setRestockStats] = useState<InventoryUsageStats | null>(null);
  const [restockLoadingStats, setRestockLoadingStats] = useState(false);
  const [restockQty, setRestockQty] = useState('');
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockBiaya, setRestockBiaya] = useState('');
  const [restockCatatan, setRestockCatatan] = useState('');
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  // Stock Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustStokFisik, setAdjustStokFisik] = useState('');
  const [adjustAlasan, setAdjustAlasan] = useState('Stock Opname');
  const [adjustCatatan, setAdjustCatatan] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Soft Delete & Protection Modal states
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Trash / Arsip Modal states
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashList, setTrashList] = useState<any[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Bi-directional Sync States
  const [isDijual, setIsDijual] = useState(false);
  const [hargaJual, setHargaJual] = useState('');
  const [kategori, setKategori] = useState('Add On');
  const [kategoriList, setKategoriList] = useState<{id: string, nama: string, aktif: string}[]>([]);

  const loadInventory = () => {
    setLoading(true);
    runBackendCached<InventoryItem[]>(
      'getInventoryList',
      (data) => {
        if (Array.isArray(data)) setItems(data);
        setLoading(false);
      },
      3 * 60 * 1000
    );
  };

  const loadTrashCount = async () => {
    try {
      const data = await runBackend<any[]>('getTrashInventory');
      if (Array.isArray(data)) {
        setTrashCount(data.length);
      }
    } catch {
      // ignore
    }
  };

  const loadKategori = async () => {
    try {
      const data = await runBackend<{id: string, nama: string, aktif: string}[]>('getKategoriList');
      if (Array.isArray(data)) setKategoriList(data.filter(k => k.aktif === 'Y'));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInventory();
    loadKategori();
    loadTrashCount();
  }, []);

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditId(null);
    setNama('');
    setStok('');
    setSatuan('pcs');
    setStokMin('5');
    setOriginalStok(null);
    setShowDecimalOptions(false);
    setHargaJual('');
    setIsDijual(false);
  };

  // DSS Computations
  const kpiStats = useMemo(() => {
    let kritis = 0;
    let rendah = 0;
    let selisih = 0;
    let aman = 0;

    items.forEach(item => {
      if (item.stok <= 0) kritis++;
      else if (item.statusKesehatan === 'SELISIH') selisih++;
      else if (item.stok <= (item.stokMinimum || 5)) rendah++;
      else aman++;
    });

    return { kritis, rendah, selisih, aman, total: items.length };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.nama.toLowerCase().includes(q);
        const matchId = item.id.toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }

      if (filterKesehatan === 'KRITIS') return item.stok <= 0;
      if (filterKesehatan === 'RENDAH') return item.stok > 0 && item.stok <= (item.stokMinimum || 5);
      if (filterKesehatan === 'SELISIH') return item.statusKesehatan === 'SELISIH';
      if (filterKesehatan === 'AMAN') return item.stok > (item.stokMinimum || 5) && item.statusKesehatan !== 'SELISIH';

      return true;
    });
  }, [items, searchQuery, filterKesehatan]);

  // Handle Smart Restock Modal
  const handleOpenRestockModal = async (item: InventoryItem) => {
    setRestockItem(item);
    setRestockQty('');
    setRestockSupplier('');
    setRestockBiaya('');
    setRestockCatatan('');
    setShowRestockModal(true);
    setRestockLoadingStats(true);
    setRestockStats(null);

    try {
      const stats = await runBackend<InventoryUsageStats>('getInventoryUsageStats', item.id, 7);
      if (stats) {
        setRestockStats(stats);
        setRestockQty(String(stats.recommendedRestockQty || 10));
      }
    } catch (err) {
      console.warn('Gagal memuat analitik restock:', err);
    } finally {
      setRestockLoadingStats(false);
    }
  };

  const handleSubmitRestock = async () => {
    if (!restockItem) return;
    const qty = parseDecimal(restockQty, 0);
    if (qty <= 0) {
      await showAlert('Jumlah restock harus lebih dari 0 unit!', 'warning');
      return;
    }

    setRestockSubmitting(true);
    try {
      const biaya = parseDecimal(restockBiaya, 0);
      const res = await runBackend<{ success: boolean; stokBaru?: number; message?: string }>(
        'restockInventory',
        restockItem.id,
        qty,
        restockSupplier.trim(),
        biaya,
        restockCatatan.trim(),
        currentRole || 'Kasir'
      );

      if (res && res.success) {
        clearCache('getInventoryList');
        loadInventory();
        setShowRestockModal(false);
        await showAlert(
          `Restock berhasil disimpan!\n\nBarang: ${restockItem.nama}\nJumlah Masuk: +${qty} ${restockItem.satuan}\nStok Sistem Baru: ${res.stokBaru} ${restockItem.satuan}`,
          'success',
          'Restock Berhasil'
        );
      } else {
        await showAlert(res?.message || 'Gagal menyimpan restock barang.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      await showAlert('Terjadi kesalahan saat restock: ' + (err?.message || String(err)), 'error');
    } finally {
      setRestockSubmitting(false);
    }
  };

  // Handle Stock Adjustment Modal
  const handleOpenAdjustModal = (item: InventoryItem) => {
    setAdjustItem(item);
    const initialFisik = item.stokFisikTerakhir !== undefined ? item.stokFisikTerakhir : Math.max(0, item.stok);
    setAdjustStokFisik(String(initialFisik));
    setAdjustAlasan(item.stok < 0 ? 'Koreksi Stok Anomali/Minus' : 'Stock Opname');
    setAdjustCatatan('');
    setShowAdjustModal(true);
  };

  const handleSubmitAdjust = async () => {
    if (!adjustItem) return;
    const fisik = parseDecimal(adjustStokFisik, -1);
    if (fisik < 0) {
      await showAlert('Stok fisik tidak boleh bernilai negatif (< 0)! Periksa kembali hitungan fisik di toko.', 'warning');
      return;
    }

    setAdjustSubmitting(true);
    try {
      const res = await runBackend<{ success: boolean; stokBaru?: number; delta?: number; message?: string }>(
        'adjustInventory',
        adjustItem.id,
        fisik,
        adjustAlasan,
        adjustCatatan.trim(),
        currentRole || 'Kasir'
      );

      if (res && res.success) {
        clearCache('getInventoryList');
        loadInventory();
        setShowAdjustModal(false);
        const deltaStr = (res.delta || 0) >= 0 ? `+${res.delta}` : `${res.delta}`;
        await showAlert(
          `Stock adjustment berhasil!\n\nBarang: ${adjustItem.nama}\nStok Sistem Lama: ${adjustItem.stok} ${adjustItem.satuan}\nStok Fisik Baru: ${res.stokBaru} ${adjustItem.satuan}\nPenyesuaian (Selisih): ${deltaStr} ${adjustItem.satuan}`,
          'success',
          'Penyesuaian Stok Berhasil'
        );
      } else {
        await showAlert(res?.message || 'Gagal melakukan stock adjustment.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      await showAlert('Terjadi kesalahan saat stock adjustment: ' + (err?.message || String(err)), 'error');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleEditClick = (item: InventoryItem) => {
    setEditId(item.id);
    setNama(item.nama);
    setStok(item.stok.toString());
    setSatuan(item.satuan);
    setStokMin((item.stokMinimum ?? 0).toString());
    setOriginalStok(item.stok);
    setShowDecimalOptions(false);
    setIsDijual(false);
    setShowAddModal(true);
  };

  const handleQuickAdjustStok = (step: number) => {
    const current = parseDecimal(stok, 0);
    const next = Math.max(0, Math.round((current + step + Number.EPSILON) * 10000) / 10000);
    setStok(next.toString());
  };

  const handleSave = async () => {
    if (!nama.trim()) { await showAlert('Masukkan nama barang!', 'warning'); return; }
    
    // Check duplicate inventory item name
    const duplicate = items.find(i => i.nama.trim().toLowerCase() === nama.trim().toLowerCase() && (!editId || i.id !== editId));
    if (duplicate) {
      await showAlert(`Barang dengan nama "${nama.trim()}" sudah ada di master inventory (ID: ${duplicate.id}). Gunakan nama yang unik!`, 'warning');
      return;
    }

    setLoading(true);
    try {
      if (editId) {
        await runBackend('updateInventoryItem', editId, {
          nama: nama.trim(),
          stok: parseDecimal(stok, 0),
          satuan: satuan.trim(),
          stokMinimum: parseDecimal(stokMin, 0),
        });
      } else {
        await runBackend('tambahInventory', {
          nama: nama.trim(),
          stok: parseDecimal(stok, 0),
          satuan: satuan.trim(),
          stokMinimum: parseDecimal(stokMin, 0),
          isDijual,
          hargaJual: isDijual ? (Number(hargaJual) || 0) : undefined,
          kategoriLayanan: isDijual ? kategori : undefined
        });
        clearCache('getLayananListAll'); // Clear catalog cache as well
      }
      clearCache('getInventoryList');
      handleCloseModal();
      loadInventory();
      await showAlert(`Berhasil ${editId ? 'mengubah' : 'menambah'} barang!`, 'success');
    } catch (err: any) {
      await showAlert(`Gagal ${editId ? 'mengubah' : 'menambah'} barang: ` + (err.message || String(err)), 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatStok = (val: number | string) => {
    return formatDecimal(val, 4);
  };

  const handleOpenDeleteModal = (item: InventoryItem) => {
    setItemToDelete(item);
    setConfirmCheckbox(false);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    if (itemToDelete.stok > 0 && !confirmCheckbox) {
      await showAlert('Harap centang kotak persetujuan karena bahan masih memiliki sisa stok!', 'warning');
      return;
    }

    setIsDeleting(true);
    try {
      clearCache('getInventoryList');
      await runBackend('hapusInventory', itemToDelete.id, currentRole || 'Manager / Owner');
      setItemToDelete(null);
      loadInventory();
      loadTrashCount();
      await showAlert(`Bahan "${itemToDelete.nama}" berhasil diarsipkan (Soft Delete). Riwayat transaksi dan resep tetap aman!`, 'success');
    } catch (err: any) {
      await showAlert(`Gagal mengarsipkan barang: ${err?.message || String(err)}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenTrashModal = async () => {
    setShowTrashModal(true);
    setLoadingTrash(true);
    try {
      const data = await runBackend<any[]>('getTrashInventory');
      setTrashList(Array.isArray(data) ? data : []);
      setTrashCount(Array.isArray(data) ? data.length : 0);
    } catch (err: any) {
      await showAlert(`Gagal memuat arsip terhapus: ${err?.message || String(err)}`, 'error');
    } finally {
      setLoadingTrash(false);
    }
  };

  const handleRestoreItem = async (item: any) => {
    setRestoringId(item.id);
    try {
      await runBackend('restoreInventory', item.id, currentRole || 'Manager / Owner');
      clearCache('getInventoryList');
      loadInventory();
      const data = await runBackend<any[]>('getTrashInventory');
      setTrashList(Array.isArray(data) ? data : []);
      setTrashCount(Array.isArray(data) ? data.length : 0);
      await showAlert(`Bahan "${item.nama}" berhasil dipulihkan kembali ke inventaris!`, 'success');
    } catch (err: any) {
      await showAlert(`Gagal memulihkan bahan: ${err?.message || String(err)}`, 'error');
    } finally {
      setRestoringId(null);
    }
  };

  const handleExport = () => {
    const rows = items.map(i => [i.nama, i.stok, i.satuan, i.stokMinimum ?? 0]);
    downloadExcel('export_inventory.xlsx', ['Nama Barang', 'Stok', 'Satuan', 'Stok Minimum'], rows, 'Master Inventory');
  };

  const handleDownloadTemplate = () => {
    downloadExcel(
      'template_inventory_kosong.xlsx',
      ['Nama Barang', 'Stok', 'Satuan', 'Stok Minimum'],
      [['Deterjen Cair Premium', 10, 'liter', 3], ['Pewangi Sakura', 5, 'botol', 2]],
      'Template Inventory'
    );
  };

  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importProgressText, setImportProgressText] = useState('');
  const [importProgressPercent, setImportProgressPercent] = useState(0);
  const [importIsComplete, setImportIsComplete] = useState(false);
  const [importIsError, setImportIsError] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setImportProgressText(`Memvalidasi ${rows.length} baris barang stok...`);

      const itemsToImport: any[] = [];
      let fail = 0;

      for (const row of rows) {
        const nama = row['Nama Barang'] || row['nama'] || row['Nama'] || '';
        if (!nama.trim()) { fail++; continue; }
        itemsToImport.push({
          nama: nama.trim(),
          stok: parseDecimal(row['Stok'] || row['stok'] || row['Jumlah'], 0),
          satuan: (row['Satuan'] || row['satuan'] || 'pcs').trim(),
          stokMinimum: parseDecimal(row['Stok Minimum'] || row['stok_minimum'] || row['Stok Min'], 0),
        });
      }

      if (itemsToImport.length === 0) {
        setImportIsError(true);
        setImportProgressText('Tidak ada data barang valid untuk diimpor.');
        await showAlert('Tidak ada data barang yang valid untuk diimpor.', 'warning');
        setTimeout(() => setIsImporting(false), 3000);
        return;
      }

      setImportProgressPercent(60);
      setImportProgressText(`Menyimpan ${itemsToImport.length} barang ke database...`);
      let success = 0;

      try {
        const res = await runBackend<{ success: boolean; importedCount?: number; message?: string }>('importInventoryBatch', itemsToImport);
        if (res && res.success) {
          success = res.importedCount || itemsToImport.length;
        } else {
          throw new Error(res?.message || 'Gagal import batch');
        }
      } catch {
        for (let i = 0; i < itemsToImport.length; i++) {
          const item = itemsToImport[i];
          const pct = 60 + Math.round(((i + 1) / itemsToImport.length) * 30);
          setImportProgressPercent(pct);
          setImportProgressText(`Menyimpan ${i + 1}/${itemsToImport.length}: ${item.nama}`);
          try {
            await runBackend('tambahInventory', item);
            success++;
          } catch {
            fail++;
          }
        }
      }

      setImportProgressPercent(90);
      setImportProgressText('Menyinkronkan data stok...');
      clearCache('getInventoryList');
      loadInventory();

      setImportProgressPercent(100);
      setImportIsComplete(true);
      setImportProgressText(`Selesai! ${success} barang berhasil disimpan.`);

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

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1E4648]/10 text-[#1E4648] flex items-center justify-center font-bold">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Inventory & Monitoring Stok (DSS)</h1>
            <p className="text-[11px] text-slate-400">Monitoring kesehatan stok, rekomendasi restock, & penyesuaian opname fisik.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadInventory} className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition" title="Refresh Data">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {/* CSV buttons hanya untuk MANAGER */}
          {currentRole === 'MANAGER' && (
            <>
              {/* Export data */}
              <button onClick={handleExport} className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition" title="Export Data ke CSV">
                <Download className="w-3.5 h-3.5" />
              </button>
              {/* Download template kosong */}
              <button onClick={handleDownloadTemplate} className="px-3 py-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 text-xs font-medium transition cursor-pointer" title="Download Template Master Excel (.xlsx) Kosong">
                Template Excel
              </button>
              {/* Import Excel / CSV */}
              <label className="cursor-pointer px-3 py-1.5 border border-[#B5C9C9] rounded-md text-[#1E4648] hover:bg-[#B5C9C9]/10 text-xs font-medium transition flex items-center gap-1.5" title="Import Data dari Berkas Excel (.xlsx, .xls) atau CSV">
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
              </label>

              {/* Arsip Terhapus (Soft Delete Trash) */}
              <button
                onClick={handleOpenTrashModal}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-md text-xs font-medium transition cursor-pointer"
                title="Lihat Bahan yang Dihapus / Diarsipkan (Soft Delete)"
              >
                <Archive className="w-3.5 h-3.5 text-slate-500" />
                <span>Arsip Terhapus</span>
                {trashCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full">
                    {trashCount}
                  </span>
                )}
              </button>
            </>
          )}
          
          {/* Tambah barang - STAFF dan MANAGER */}
          {(currentRole === 'STAFF' || currentRole === 'MANAGER') && (
            <button onClick={() => { handleCloseModal(); setShowAddModal(true); }} className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer">
              <Plus className="w-4 h-4" /> Tambah Bahan Baru
            </button>
          )}
        </div>
      </div>

      {/* 4 Decision KPI Cards (DSS Overview & Filter) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Critical Stock (0 / Minus) */}
        <button
          type="button"
          onClick={() => setFilterKesehatan(prev => prev === 'KRITIS' ? 'SEMUA' : 'KRITIS')}
          className={`p-3.5 rounded-xl border text-left transition relative cursor-pointer ${
            filterKesehatan === 'KRITIS'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400 shadow-xs'
              : 'bg-white border-slate-200 hover:border-rose-200 hover:bg-rose-50/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              Stok Kritis
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
              {kpiStats.kritis} Item
            </span>
          </div>
          <div className="text-2xl font-black text-rose-900 tracking-tight">
            {kpiStats.kritis}
          </div>
          <p className="text-[11px] text-rose-700 font-medium mt-1 leading-tight">
            Stok 0 atau minus. <strong>Rekomendasi: Restock / Cek Fisik Segera</strong>
          </p>
        </button>

        {/* Card 2: Low Stock (<= Min) */}
        <button
          type="button"
          onClick={() => setFilterKesehatan(prev => prev === 'RENDAH' ? 'SEMUA' : 'RENDAH')}
          className={`p-3.5 rounded-xl border text-left transition relative cursor-pointer ${
            filterKesehatan === 'RENDAH'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Stok Rendah
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">
              {kpiStats.rendah} Item
            </span>
          </div>
          <div className="text-2xl font-black text-amber-900 tracking-tight">
            {kpiStats.rendah}
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-1 leading-tight">
            Di bawah batas minimum. <strong>Rekomendasi: Pertimbangkan Restock</strong>
          </p>
        </button>

        {/* Card 3: Stock Discrepancy (Selisih Opname) */}
        <button
          type="button"
          onClick={() => setFilterKesehatan(prev => prev === 'SELISIH' ? 'SEMUA' : 'SELISIH')}
          className={`p-3.5 rounded-xl border text-left transition relative cursor-pointer ${
            filterKesehatan === 'SELISIH'
              ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-400 shadow-xs'
              : 'bg-white border-slate-200 hover:border-sky-200 hover:bg-sky-50/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-sky-700 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-sky-600" />
              Selisih Fisik
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800">
              {kpiStats.selisih} Item
            </span>
          </div>
          <div className="text-2xl font-black text-sky-900 tracking-tight">
            {kpiStats.selisih}
          </div>
          <p className="text-[11px] text-sky-700 font-medium mt-1 leading-tight">
            Fisik berbeda sistem. <strong>Rekomendasi: Stock Adjustment</strong>
          </p>
        </button>

        {/* Card 4: Healthy Stock (Aman) */}
        <button
          type="button"
          onClick={() => setFilterKesehatan(prev => prev === 'AMAN' ? 'SEMUA' : 'AMAN')}
          className={`p-3.5 rounded-xl border text-left transition relative cursor-pointer ${
            filterKesehatan === 'AMAN'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400 shadow-xs'
              : 'bg-white border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Stok Aman
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
              {kpiStats.aman} Item
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-900 tracking-tight">
            {kpiStats.aman}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1 leading-tight">
            Kapasitas di atas batas aman. <strong>Status: Optimal</strong>
          </p>
        </button>
      </div>

      {/* Filter Bar & Real-time Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Filter:
          </span>
          <button
            type="button"
            onClick={() => setFilterKesehatan('SEMUA')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterKesehatan === 'SEMUA'
                ? 'bg-[#1E4648] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({kpiStats.total})
          </button>
          <button
            type="button"
            onClick={() => setFilterKesehatan('KRITIS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center ${
              filterKesehatan === 'KRITIS'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${filterKesehatan === 'KRITIS' ? 'bg-white' : 'bg-rose-500'}`} />
            <span>Kritis ({kpiStats.kritis})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterKesehatan('RENDAH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center ${
              filterKesehatan === 'RENDAH'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${filterKesehatan === 'RENDAH' ? 'bg-white' : 'bg-amber-500'}`} />
            <span>Rendah ({kpiStats.rendah})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterKesehatan('SELISIH')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center ${
              filterKesehatan === 'SELISIH'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${filterKesehatan === 'SELISIH' ? 'bg-white' : 'bg-sky-500'}`} />
            <span>Selisih ({kpiStats.selisih})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterKesehatan('AMAN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center ${
              filterKesehatan === 'AMAN'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${filterKesehatan === 'AMAN' ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>Aman ({kpiStats.aman})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau kode barang..."
            className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Enhanced DSS Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <th className="py-3 px-3.5">Kode</th>
                <th className="py-3 px-3.5">Nama Barang</th>
                <th className="py-3 px-3.5 text-center">Stok Sistem</th>
                <th className="py-3 px-3.5 text-center">Fisik Terakhir</th>
                <th className="py-3 px-3.5 text-center">Min.</th>
                <th className="py-3 px-3.5">Status & Rekomendasi Tindakan (DSS)</th>
                <th className="py-3 px-3.5">Update</th>
                <th className="py-3 px-3.5 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-3.5"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                    <td className="py-3.5 px-3.5 text-center"><div className="h-3.5 bg-slate-100 rounded w-16 mx-auto" /></td>
                    <td className="py-3.5 px-3.5 text-center"><div className="h-3.5 bg-slate-100 rounded w-16 mx-auto" /></td>
                    <td className="py-3.5 px-3.5 text-center"><div className="h-3.5 bg-slate-100 rounded w-12 mx-auto" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-3.5 bg-slate-100 rounded w-48" /></td>
                    <td className="py-3.5 px-3.5"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3.5 px-3.5 text-right"><div className="h-3.5 bg-slate-100 rounded w-28 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                    <p className="font-bold text-slate-600 text-sm">Tidak ada data bahan pada filter ini</p>
                    <p className="text-xs text-slate-400 mt-1">Coba gunakan filter 'Semua' atau bersihkan kolom pencarian.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isMinus = item.stok < 0;
                  const isZero = item.stok === 0;
                  const isLow = item.stok > 0 && item.stok <= (item.stokMinimum || 5);
                  const hasDiscrepancy = item.statusKesehatan === 'SELISIH';
                  const selisihQty = item.stokFisikTerakhir !== undefined ? (item.stokFisikTerakhir - item.stok) : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Kode */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.id}
                        </span>
                      </td>

                      {/* 2. Nama Barang */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-bold text-slate-800 block text-xs">{item.nama}</span>
                        {item.isDijual && (
                          <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-100 inline-block mt-0.5">
                            Retail: Rp {(item.hargaJual || 0).toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>

                      {/* 3. Stok Sistem */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <div className={`inline-flex flex-col items-center px-2.5 py-1 rounded-lg font-bold text-xs ${
                          isMinus ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          isZero ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          isLow ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          <span>{formatStok(item.stok)}</span>
                          <span className="text-[10px] font-normal text-slate-500">{item.satuan}</span>
                        </div>
                      </td>

                      {/* 4. Stok Fisik Terakhir */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        {item.stokFisikTerakhir !== undefined ? (
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">
                              {formatStok(item.stokFisikTerakhir)} <span className="text-[10px] text-slate-400 font-normal">{item.satuan}</span>
                            </span>
                            {hasDiscrepancy && (
                              <span className={`block text-[10px] font-bold ${
                                selisihQty > 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                {selisihQty > 0 ? `+${selisihQty}` : selisihQty} {item.satuan}
                              </span>
                            )}
                            {item.tglOpnameTerakhir && (
                              <span className="block text-[9px] text-slate-400 font-medium">{item.tglOpnameTerakhir.split(',')[0]}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs italic">-</span>
                        )}
                      </td>

                      {/* 5. Batas Min */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <span className="text-slate-600 font-medium text-xs">
                          {formatStok(item.stokMinimum || 5)} <span className="text-[10px] text-slate-400">{item.satuan}</span>
                        </span>
                      </td>

                      {/* 6. Status & Rekomendasi Tindakan (DSS) */}
                      <td className="py-3.5 px-3.5 max-w-xs">
                        <div className="space-y-1">
                          {isMinus ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> STOK ANOMALI / MINUS
                            </span>
                          ) : isZero ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> KRITIS (HABIS)
                            </span>
                          ) : hasDiscrepancy ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-50 text-sky-800 border border-sky-200 inline-flex items-center gap-1">
                              <Scale className="w-3 h-3" /> SELISIH FISIK ({selisihQty > 0 ? `+${selisihQty}` : selisihQty})
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> STOK MENIPIS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> AMAN (OPTIMAL)
                            </span>
                          )}

                          <p className="text-[11px] text-slate-600 font-medium leading-snug">
                            {item.rekomendasiTindakan || 'Kapasitas stok optimal.'}
                          </p>
                        </div>
                      </td>

                      {/* 7. Terakhir Update */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap text-slate-500 text-[11px]">
                        {item.terakhirUpdate ? formatDateTime(item.terakhirUpdate) : '-'}
                      </td>

                      {/* 8. Aksi Cepat DSS */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Restock */}
                          <button
                            type="button"
                            onClick={() => handleOpenRestockModal(item)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-[11px] font-bold transition shadow-2xs cursor-pointer"
                            title="Lakukan Restock barang dari supplier"
                          >
                            <ShoppingCart className="w-3 h-3 text-amber-700" />
                            <span>Restock</span>
                          </button>

                          {/* Tombol Adjust */}
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustModal(item)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-md text-[11px] font-bold transition shadow-2xs cursor-pointer"
                            title="Koreksi / Penyesuaian stok fisik (Stock Opname)"
                          >
                            <Scale className="w-3 h-3 text-teal-700" />
                            <span>Adjust</span>
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleEditClick(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="Edit Data Master Barang"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Soft Delete */}
                          {currentRole === 'MANAGER' && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Hapus / Arsipkan (Soft Delete)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">
                {editId ? 'Edit Stok Bahan' : 'Tambah Stok Bahan Baru'}
              </h3>
              <div className="flex items-center gap-2">
                {editId && (
                  <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {editId}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3.5 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nama Barang</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Deterjen Cair"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Nama bahan baku, produk, atau perlengkapan.</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 items-start">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Jumlah Stok</label>
                  <input
                    type="number"
                    step="any"
                    value={stok}
                    onChange={(e) => setStok(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] font-bold text-slate-700"
                  />
                </div>
                <SatuanInput
                  value={satuan}
                  onChange={setSatuan}
                  label="Satuan"
                  helperText="Contoh: liter, pcs, botol, kg, atau ketik kustom."
                />
              </div>

              {/* Panel Penyesuaian Stok Cepat (+ / - / Desimal) */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">Penyesuaian Stok Cepat:</span>
                  {editId && originalStok !== null && (
                    <span className="text-[10px] text-slate-400">
                      Stok Awal: <strong className="text-slate-600">{formatStok(originalStok)} {satuan}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleQuickAdjustStok(-1)}
                    disabled={parseDecimal(stok, 0) <= 0}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 rounded text-xs font-bold transition border border-slate-300 shadow-2xs select-none"
                    title="Kurangi Stok (-1)"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAdjustStok(1)}
                    className="px-2.5 py-1 bg-[#1E4648] hover:bg-[#163536] active:bg-[#102728] text-white rounded text-xs font-bold transition shadow-2xs select-none"
                    title="Tambah Stok (+1)"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDecimalOptions(!showDecimalOptions)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition shadow-2xs select-none border ${
                      showDecimalOptions
                        ? 'bg-teal-700 text-white border-teal-800'
                        : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border-teal-300'
                    }`}
                    title="Buka panel ubah stok desimal / takaran kecil"
                  >
                    ±Desimal
                  </button>
                </div>

                {/* Sub-panel opsi desimal */}
                {showDecimalOptions && (
                  <div className="pt-2 border-t border-slate-200/80 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between text-[10px] text-teal-800 font-medium mb-1.5">
                      <span>Takaran Kecil / Desimal:</span>
                      <span className="text-[9px] text-teal-600 font-normal">Contoh: 0.02 L = 20 ml</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustStok(-0.5)}
                        disabled={parseDecimal(stok, 0) <= 0}
                        className="px-2 py-0.5 bg-white hover:bg-teal-50 disabled:opacity-40 text-teal-900 rounded text-[11px] font-bold border border-teal-200 transition"
                      >
                        -0.5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustStok(-0.1)}
                        disabled={parseDecimal(stok, 0) <= 0}
                        className="px-2 py-0.5 bg-white hover:bg-teal-50 disabled:opacity-40 text-teal-900 rounded text-[11px] font-bold border border-teal-200 transition"
                      >
                        -0.1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustStok(-0.02)}
                        disabled={parseDecimal(stok, 0) <= 0}
                        className="px-2 py-0.5 bg-white hover:bg-teal-50 disabled:opacity-40 text-teal-900 rounded text-[11px] font-bold border border-teal-200 transition"
                      >
                        -0.02
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustStok(0.02)}
                        className="px-2 py-0.5 bg-white hover:bg-teal-50 text-teal-900 rounded text-[11px] font-bold border border-teal-200 transition"
                      >
                        +0.02
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustStok(0.1)}
                        className="px-2 py-0.5 bg-white hover:bg-teal-50 text-teal-900 rounded text-[11px] font-bold border border-teal-200 transition"
                      >
                        +0.1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAdjustStok(0.5)}
                        className="px-2 py-0.5 bg-white hover:bg-teal-50 text-teal-900 rounded text-[11px] font-bold border border-teal-200 transition"
                      >
                        +0.5
                      </button>
                    </div>
                  </div>
                )}

                {/* Selisih stok yang diedit */}
                {editId && originalStok !== null && (
                  (() => {
                    const curStokNum = parseDecimal(stok, 0);
                    const diff = Math.round((curStokNum - originalStok + Number.EPSILON) * 10000) / 10000;
                    if (diff === 0) return null;
                    return (
                      <div className="pt-1.5 border-t border-slate-200/60 text-[11px] flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Perubahan:</span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                              diff > 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {diff > 0 ? `+${formatStok(diff)}` : formatStok(diff)} {satuan}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({formatStok(originalStok)} → {formatStok(curStokNum)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStok(originalStok.toString())}
                          className="text-[10px] text-slate-400 hover:text-rose-600 underline transition cursor-pointer"
                        >
                          Reset ke awal
                        </button>
                      </div>
                    );
                  })()
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Stok Minimum Peringatan</label>
                <input
                  type="number"
                  step="any"
                  value={stokMin}
                  onChange={(e) => setStokMin(e.target.value)}
                  placeholder="5"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
                <p className="text-[10px] text-slate-400 mt-1">Tanda peringatan (Menipis) akan muncul jika stok di bawah angka ini.</p>
              </div>
              
              {!editId && (
                <div className="pt-2 border-t border-slate-100 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox" checked={isDijual} onChange={(e) => setIsDijual(e.target.checked)} className="w-4 h-4 text-[#1E4648] rounded border-slate-300 focus:ring-[#1E4648]" />
                    <span className="text-xs font-semibold text-slate-700">Jual barang ini di Kasir (Produk Otomatis)</span>
                  </label>
                  
                  {isDijual && (
                    <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-slate-50 rounded-md border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Harga Jual (Rp)</label>
                        <input
                          type="number"
                          value={hargaJual}
                          onChange={(e) => setHargaJual(e.target.value)}
                          placeholder="Contoh: 5000"
                          className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Kategori Menu</label>
                        <select
                          value={kategori}
                          onChange={(e) => setKategori(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                        >
                          {kategoriList.map(kat => (
                            <option key={kat.id} value={kat.nama}>{kat.nama}</option>
                          ))}
                          {kategoriList.length === 0 && <option value="Add On">Add On</option>}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="bg-[#1E4648] hover:bg-[#163536] disabled:opacity-50 text-white font-medium px-4 py-2 rounded-md text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SMART RESTOCK MODAL (DECISION SUPPORT SYSTEM)                         */}
      {/* ========================================================================= */}
      {showRestockModal && restockItem && (
        <div className="fixed inset-0 z-[520] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-800 flex items-center justify-center font-bold">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Restock Barang Masuk</h3>
                  <p className="text-[11px] text-slate-400">Pencatatan barang masuk dari supplier / belanja stok.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRestockModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Item Pill */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 mb-4 flex items-center justify-between gap-3">
              <div>
                <span className="font-mono text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {restockItem.id}
                </span>
                <span className="font-bold text-slate-800 text-sm ml-2">{restockItem.nama}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-medium">Stok Sistem Saat Ini:</span>
                <span className={`text-sm font-black ${restockItem.stok <= 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {formatStok(restockItem.stok)} {restockItem.satuan}
                </span>
              </div>
            </div>

            {/* Decision Support Intelligence Box */}
            <div className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 p-4 rounded-xl border border-amber-200/80 shadow-2xs mb-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Analisis Penggunaan & Rekomendasi Restock
                </span>
                {restockLoadingStats && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />}
              </div>

              {restockStats ? (
                <div className="space-y-3">
                  {/* Grid 4 Mini Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-lg border border-amber-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block">Last Restock</span>
                      <span className="font-bold text-slate-700">
                        {restockStats.lastRestockQty !== undefined ? `${restockStats.lastRestockQty} ${restockStats.satuan}` : '-'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-amber-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block">Tgl Restock</span>
                      <span className="font-bold text-slate-700 text-[11px]">
                        {restockStats.lastRestockDate ? restockStats.lastRestockDate.split(',')[0] : '-'}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-amber-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block">Usage 7 Hari</span>
                      <span className="font-bold text-slate-700">
                        {restockStats.usage7Days} {restockStats.satuan}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-amber-100 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block">Rata-rata/Hari</span>
                      <span className="font-bold text-slate-700">
                        {restockStats.avgDailyUsage} {restockStats.satuan}
                      </span>
                    </div>
                  </div>

                  {/* Prediction & Suggestion Banner */}
                  <div className="bg-white p-3 rounded-lg border border-amber-200 flex items-center justify-between gap-3 flex-wrap">
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-slate-600">
                        Daya tahan stok saat ini: <strong>±{restockStats.estimatedDaysLeft} hari</strong>
                      </div>
                      <div className="text-xs font-bold text-amber-900">
                        Rekomendasi Restock: <span className="text-sm font-black text-amber-700">{restockStats.recommendedRestockQty} {restockStats.satuan}</span>
                        <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Target buffer ±14 hari)</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRestockQty(String(restockStats.recommendedRestockQty))}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Gunakan {restockStats.recommendedRestockQty} {restockStats.satuan}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Memuat analisis konsumsi bahan...</p>
              )}
            </div>

            {/* Input Form Fields */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah Barang Masuk ({restockItem.satuan}) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    placeholder="Contoh: 15"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">
                    {restockItem.satuan}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Kuantitas diinput manual oleh staf/manager sesuai barang yang diterima.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier / Toko (Opsional)</label>
                  <input
                    type="text"
                    value={restockSupplier}
                    onChange={(e) => setRestockSupplier(e.target.value)}
                    placeholder="Contoh: Toko Plastik Berkah"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Total Biaya Belanja (Rp)</label>
                  <input
                    type="number"
                    value={restockBiaya}
                    onChange={(e) => setRestockBiaya(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={restockCatatan}
                  onChange={(e) => setRestockCatatan(e.target.value)}
                  placeholder="Contoh: Pembelian stok operasional mingguan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRestockModal(false)}
                disabled={restockSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitRestock}
                disabled={restockSubmitting || parseDecimal(restockQty, 0) <= 0}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {restockSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                <span>Simpan Restock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. STOCK ADJUSTMENT MODAL (KOREKSI FISIK / OPNAME)                        */}
      {/* ========================================================================= */}
      {showAdjustModal && adjustItem && (
        <div className="fixed inset-0 z-[520] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-800 flex items-center justify-center font-bold">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Stock Adjustment (Koreksi Fisik)</h3>
                  <p className="text-[11px] text-slate-400">Koreksi ketika stok fisik di toko berbeda dengan stok sistem.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Item Info */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 mb-4 flex items-center justify-between gap-3">
              <div>
                <span className="font-mono text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {adjustItem.id}
                </span>
                <span className="font-bold text-slate-800 text-sm ml-2">{adjustItem.nama}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-medium">Stok Sistem Saat Ini:</span>
                <span className={`text-sm font-black ${adjustItem.stok <= 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {formatStok(adjustItem.stok)} {adjustItem.satuan}
                </span>
              </div>
            </div>

            {/* Calculation Card: System vs Physical vs Delta */}
            {(() => {
              const currentSystem = adjustItem.stok;
              const inputFisik = parseDecimal(adjustStokFisik, 0);
              const delta = Math.round((inputFisik - currentSystem) * 10000) / 10000;
              const isPlus = delta > 0;
              const isMinus = delta < 0;

              return (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                      <span className="text-[10px] text-slate-400 block font-semibold">Stok Sistem</span>
                      <span className="text-sm font-bold text-slate-700">{formatStok(currentSystem)} {adjustItem.satuan}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-teal-300 ring-2 ring-teal-400/30 shadow-2xs">
                      <span className="text-[10px] text-teal-700 block font-bold">Stok Fisik Baru</span>
                      <span className="text-sm font-black text-teal-900">{formatStok(inputFisik)} {adjustItem.satuan}</span>
                    </div>

                    <div className={`p-2.5 rounded-lg border shadow-2xs ${
                      isPlus ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                      isMinus ? 'bg-rose-50 border-rose-200 text-rose-800' :
                      'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                      <span className="text-[10px] block font-semibold">Selisih Koreksi</span>
                      <span className="text-sm font-black">
                        {isPlus ? `+${formatStok(delta)}` : formatStok(delta)} {adjustItem.satuan}
                      </span>
                    </div>
                  </div>

                  {delta !== 0 && (
                    <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      isPlus ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                      'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        {isPlus 
                          ? `Stok sistem akan DITAMBAHKAN sebesar +${formatStok(delta)} ${adjustItem.satuan} agar cocok dengan fisik.` 
                          : `Stok sistem akan DIKURANGI sebesar ${formatStok(Math.abs(delta))} ${adjustItem.satuan} agar cocok dengan fisik.`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Input Form */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah Stok Fisik Riil di Toko ({adjustItem.satuan}) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={adjustStokFisik}
                    onChange={(e) => setAdjustStokFisik(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]"
                  />
                  <span className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">
                    {adjustItem.satuan}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Aturan: <strong>Stok fisik tidak boleh bernilai negatif (&lt; 0)</strong>. Masukkan angka riil hasil hitungan fisik rak.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Alasan Penyesuaian <span className="text-rose-500">*</span></label>
                <select
                  value={adjustAlasan}
                  onChange={(e) => setAdjustAlasan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
                >
                  <option value="Stock Opname">Hasil Stock Opname Fisik Berkala</option>
                  <option value="Barang Rusak / Bocor">Barang Rusak, Bocor, atau Cacat Kemasan</option>
                  <option value="Barang Expired">Barang Kedaluwarsa (Expired)</option>
                  <option value="Koreksi Selisih Kasir">Koreksi Selisih Transaksi Kasir</option>
                  <option value="Koreksi Stok Anomali/Minus">Koreksi Anomali Stok Negatif Sistem Lama</option>
                  <option value="Bonus / Sample Belum Tercatat">Bonus Supplier / Sample Belum Tercatat</option>
                  <option value="Lainnya">Alasan Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Keterangan / Catatan Audit</label>
                <input
                  type="text"
                  value={adjustCatatan}
                  onChange={(e) => setAdjustCatatan(e.target.value)}
                  placeholder="Contoh: Ditemukan 1 bungkus di rak belakang kasir"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                disabled={adjustSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitAdjust}
                disabled={adjustSubmitting || parseDecimal(adjustStokFisik, -1) < 0}
                className="px-5 py-2 bg-[#1E4648] hover:bg-[#163536] disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {adjustSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
                <span>Konfirmasi Adjustment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi & Proteksi Hapus Bahan (Soft Delete) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[550] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0 border border-rose-100">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Konfirmasi Hapus Bahan</h3>
                  <p className="text-[11px] text-slate-400">Proteksi Keamanan & Soft Delete</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Item Details */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 mb-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Nama Bahan:</span>
                <span className="font-bold text-slate-800">{itemToDelete.nama}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Kode Item:</span>
                <span className="font-mono text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">{itemToDelete.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Sisa Stok:</span>
                <span className={`font-bold ${itemToDelete.stok > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                  {formatStok(itemToDelete.stok)} {itemToDelete.satuan}
                </span>
              </div>
            </div>

            {/* Sisa Stok Warning & Checkbox Protection */}
            {itemToDelete.stok > 0 ? (
              <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 mb-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-900 leading-relaxed">
                    <strong>Peringatan Proteksi:</strong> Bahan ini masih memiliki sisa stok sebanyak <strong>{formatStok(itemToDelete.stok)} {itemToDelete.satuan}</strong>.
                  </div>
                </div>
                <label className="flex items-start gap-2 pt-2 border-t border-amber-200/70 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox}
                    onChange={(e) => setConfirmCheckbox(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-rose-600 border-amber-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-[11px] font-semibold text-amber-950">
                    Saya menyadari masih ada sisa stok dan setuju untuk mengarsipkan bahan ini
                  </span>
                </label>
              </div>
            ) : null}

            {/* Soft Delete Information */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 mb-4 flex items-start gap-2 text-[11px] text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Proteksi Soft Delete Aktif:</strong> Bahan ini tidak akan dihapus permanen, melainkan dipindahkan ke <strong>Arsip Terhapus</strong>. Riwayat transaksi, penjualan, dan resep terdahulu tetap terjaga aman dan dapat dipulihkan sewaktu-waktu.
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-md text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || (itemToDelete.stok > 0 && !confirmCheckbox)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-md text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Hapus (Pindahkan ke Arsip)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Daftar Bahan Terhapus (Arsip Soft Delete) */}
      {showTrashModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#1E4648] flex items-center justify-center">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Arsip Bahan Terhapus (Soft Delete)</h3>
                  <p className="text-[10px] text-slate-400">Bahan yang dihapus disimpan di sini dan dapat dipulihkan sewaktu-waktu</p>
                </div>
                <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                  {trashList.length} Bahan
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTrashModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto py-3 flex-1">
              {loadingTrash ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1E4648]" />
                  <span className="text-xs">Memuat arsip bahan terhapus...</span>
                </div>
              ) : trashList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Archive className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                  <span>Tidak ada bahan di arsip terhapus.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {trashList.map((t) => (
                    <div key={t.id} className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/70 rounded-lg transition">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {t.id}
                          </span>
                          <span className="font-semibold text-slate-800 text-xs">{t.nama}</span>
                          <span className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            Sisa stok: <strong>{formatStok(t.stok)} {t.satuan}</strong>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>Dihapus: {t.deletedAt ? new Date(t.deletedAt).toLocaleString('id-ID') : '-'}</span>
                          <span>•</span>
                          <span>Oleh: {t.deletedBy || 'Manager'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestoreItem(t)}
                          disabled={restoringId === t.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 active:bg-teal-200 text-teal-800 border border-teal-200 rounded-md text-xs font-semibold transition cursor-pointer"
                          title="Pulihkan kembali ke inventaris aktif"
                        >
                          {restoringId === t.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          <span>Pulihkan</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="text-[11px] text-slate-400">
                Data bahan di sini aman dari hard-delete dan tidak mengganggu performa kasir.
              </span>
              <button
                type="button"
                onClick={() => setShowTrashModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-md text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Style Floating Progress Bar (Pojok Kanan Bawah) */}
      <ImportProgressToast
        isOpen={isImporting}
        title="Mengimpor Data Stok"
        fileName={importFileName || 'inventory.csv'}
        statusText={importProgressText}
        progressPercent={importProgressPercent}
        isComplete={importIsComplete}
        isError={importIsError}
        onClose={() => setIsImporting(false)}
      />
    </div>
  );
}
