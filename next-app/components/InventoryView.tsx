'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, Trash2, Edit3, AlertTriangle, Download, Upload, X, Loader2 } from 'lucide-react';
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

  const handleDelete = async (id: string, namaBarang: string) => {
    const isConfirmed = await showConfirm(`Hapus barang ${namaBarang}?`);
    if (!isConfirmed) return;
    try {
      clearCache('getInventoryList');
      await runBackend('hapusInventory', id);
      loadInventory();
    } catch (err: any) {
      await showAlert(`Gagal menghapus barang: ${err?.message || String(err)}`, 'error');
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
                                onClick={() => handleDelete(item.id, item.nama)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                                title="Hapus Barang"
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
                            ({formatStok(originalStok)} ➔ {formatStok(curStokNum)})
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
