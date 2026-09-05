'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, Trash2, Edit3, AlertTriangle, Download, Upload, X, Loader2, ShieldAlert, Archive, RotateCcw, ShieldCheck } from 'lucide-react';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { toCSV, downloadCSV, downloadExcel, readSpreadsheetFile } from '@/lib/csvUtils';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import { formatFriendlyErrorMessage, parseDecimal, formatDecimal } from '@/lib/utils';
import SatuanInput from '@/components/SatuanInput';
import ImportProgressToast from '@/components/ImportProgressToast';

interface InventoryItem {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
  stokMinimum: number;
  terakhirUpdate?: string;
}

interface InventoryViewProps {
  currentRole?: UserRole;
}

export default function InventoryView({ currentRole }: InventoryViewProps = {}) {
  const { showAlert, showConfirm } = useDialog();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add/Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [stok, setStok] = useState('');
  const [satuan, setSatuan] = useState('pcs');
  const [stokMin, setStokMin] = useState('5');
  const [originalStok, setOriginalStok] = useState<number | null>(null);
  const [showDecimalOptions, setShowDecimalOptions] = useState(false);

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

  const handleEditClick = (item: InventoryItem) => {
    setEditId(item.id);
    setNama(item.nama);
    setStok(item.stok.toString());
    setSatuan(item.satuan);
    setStokMin(item.stokMinimum.toString());
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
    const rows = items.map(i => [i.nama, i.stok, i.satuan, i.stokMinimum]);
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
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Package className="w-4 h-4 text-[#1E4648]" />
          <span>Stok Bahan & Deterjen</span>
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
              <button onClick={() => { handleCloseModal(); setShowAddModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E4648] hover:bg-[#163536] text-white rounded-md text-xs font-semibold transition shadow-sm">
                <Plus className="w-4 h-4" /> Tambah Bahan
              </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-3">Kode</th>
                <th className="py-3 px-4">Nama Barang</th>
                <th className="py-3 px-4">Stok Saat Ini</th>
                <th className="py-3 px-4">Stok Min.</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Terakhir Update</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-3"><div className="h-3.5 bg-slate-100 rounded w-14" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-12" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Belum ada data stok bahan
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isMenipis = item.stok <= item.stokMinimum;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.id}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{item.nama}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {formatStok(item.stok)} <span className="text-slate-400 font-normal text-[11px]">{item.satuan}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatStok(item.stokMinimum)} {item.satuan}</td>
                      <td className="py-3 px-4">
                        {isMenipis ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-[#FF9500]/10 text-[#FF9500] border border-[#FF9500]/30 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" /> Menipis
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-[#B5C9C9]/20 text-[#1E4648] border border-[#B5C9C9] px-2 py-0.5 rounded">
                            Aman
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{item.terakhirUpdate || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        {(currentRole === 'STAFF' || currentRole === 'MANAGER' || !currentRole) ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEditClick(item)}
                              className="p-1.5 text-slate-500 hover:text-[#1E4648] hover:bg-slate-100 rounded transition"
                              title="Edit & Sesuaikan Stok"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {currentRole === 'MANAGER' && (
                              <button
                                onClick={() => handleOpenDeleteModal(item)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Hapus / Arsipkan Bahan (Soft Delete)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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
