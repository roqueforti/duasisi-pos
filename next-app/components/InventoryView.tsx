'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, Trash2, Edit3, AlertTriangle, Download, Upload, Check, X, Loader2 } from 'lucide-react';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { toCSV, downloadCSV, parseCSV, readFileAsText } from '@/lib/csvUtils';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import SatuanInput from '@/components/SatuanInput';

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
  
  // Pending quick adjustment per item: { [itemId]: delta }
  const [pendingDeltas, setPendingDeltas] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Add/Edit Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [stok, setStok] = useState('');
  const [satuan, setSatuan] = useState('pcs');
  const [stokMin, setStokMin] = useState('5');

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

  const handleEditClick = (item: InventoryItem) => {
    setEditId(item.id);
    setNama(item.nama);
    setStok(item.stok.toString());
    setSatuan(item.satuan);
    setStokMin(item.stokMinimum.toString());
    setIsDijual(false);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!nama.trim()) { await showAlert('Masukkan nama barang!', 'warning'); return; }
    setLoading(true);
    try {
      if (editId) {
        await runBackend('updateInventoryItem', editId, {
          nama: nama.trim(),
          stok: Number(stok) || 0,
          satuan: satuan.trim(),
          stokMinimum: Number(stokMin) || 0,
        });
      } else {
        await runBackend('tambahInventory', {
          nama: nama.trim(),
          stok: Number(stok) || 0,
          satuan: satuan.trim(),
          stokMinimum: Number(stokMin) || 0,
          isDijual,
          hargaJual: isDijual ? (Number(hargaJual) || 0) : undefined,
          kategoriLayanan: isDijual ? kategori : undefined
        });
        clearCache('getLayananListAll'); // Clear catalog cache as well
      }
      clearCache('getInventoryList');
      setShowAddModal(false);
      setEditId(null);
      setNama(''); setStok(''); setSatuan(''); setStokMin(''); setHargaJual(''); setIsDijual(false);
      loadInventory();
      await showAlert(`Berhasil ${editId ? 'mengubah' : 'menambah'} barang!`, 'success');
    } catch (err: any) {
      await showAlert(`Gagal ${editId ? 'mengubah' : 'menambah'} barang: ` + (err.message || String(err)), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustDelta = (item: InventoryItem, step: number) => {
    const currentDelta = pendingDeltas[item.id] || 0;
    const newDelta = Math.round((currentDelta + step) * 100) / 100;

    // Cegah stok akhir kurang dari 0
    if (item.stok + newDelta < 0) return;

    if (newDelta === 0) {
      setPendingDeltas((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } else {
      setPendingDeltas((prev) => ({
        ...prev,
        [item.id]: newDelta,
      }));
    }
  };

  const handleCancelDelta = (id: string) => {
    setPendingDeltas((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveDelta = async (item: InventoryItem) => {
    const delta = pendingDeltas[item.id];
    if (!delta) return;

    setSavingId(item.id);
    const previousItems = [...items];

    // Optimistic UI update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, stok: Math.max(0, Math.round((Number(i.stok) + delta) * 100) / 100) }
          : i
      )
    );

    clearCache('getInventoryList');

    try {
      const res = await runBackend<{ success: boolean; stokBaru?: number; message?: string }>(
        'updateStokInventory',
        item.id,
        delta
      );
      if (res && res.success && res.stokBaru !== undefined) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, stok: res.stokBaru! } : i))
        );
      }
      handleCancelDelta(item.id);
    } catch (err: any) {
      // Rollback jika request gagal
      setItems(previousItems);
      await showAlert(`Gagal mengubah stok: ${err?.message || String(err)}`, 'error');
    } finally {
      setSavingId(null);
    }
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
    downloadCSV('template_inventory.csv', toCSV(['Nama Barang', 'Stok', 'Satuan', 'Stok Minimum'], rows));
  };

  const handleDownloadTemplate = () => {
    downloadCSV('template_inventory_kosong.csv', toCSV(
      ['Nama Barang', 'Stok', 'Satuan', 'Stok Minimum'],
      [['Deterjen Cair', 10, 'liter', 3], ['Pewangi', 5, 'botol', 2]]
    ));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) { await showAlert('File CSV kosong atau format salah.', 'warning'); return; }
      let success = 0, fail = 0;
      for (const row of rows) {
        const nama = row['Nama Barang'] || row['nama'] || '';
        if (!nama.trim()) { fail++; continue; }
        try {
          await runBackend('tambahInventory', {
            nama: nama.trim(),
            stok: Number(row['Stok'] || row['stok']) || 0,
            satuan: (row['Satuan'] || row['satuan'] || 'pcs').trim(),
            stokMinimum: Number(row['Stok Minimum'] || row['stok_minimum']) || 0,
          });
          success++;
        } catch { fail++; }
      }
      clearCache('getInventoryList');
      loadInventory();
      await showAlert(`Import selesai: ${success} berhasil${fail > 0 ? `, ${fail} gagal` : ''}.`, 'success');
    } catch (err) {
      await showAlert('Gagal membaca file CSV.', 'error');
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
              <button onClick={handleDownloadTemplate} className="px-3 py-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 text-xs font-medium transition" title="Download Template Kosong">
                Template
              </button>
              {/* Import CSV */}
              <label className="cursor-pointer px-3 py-1.5 border border-[#B5C9C9] rounded-md text-[#1E4648] hover:bg-[#B5C9C9]/10 text-xs font-medium transition flex items-center gap-1.5" title="Import Data dari CSV">
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </label>
            </>
          )}
          
          {/* Tambah barang - STAFF dan MANAGER */}
          {(currentRole === 'STAFF' || currentRole === 'MANAGER') && (
              <button onClick={() => { setEditId(null); setNama(''); setStok(''); setSatuan(''); setStokMin(''); setIsDijual(false); setShowAddModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E4648] hover:bg-[#163536] text-white rounded-md text-xs font-semibold transition shadow-sm">
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
                  const delta = pendingDeltas[item.id] || 0;
                  const previewStok = Math.max(0, Math.round((Number(item.stok) + delta) * 100) / 100);
                  const isMenipis = (delta ? previewStok : item.stok) <= item.stokMinimum;
                  return (
                    <tr key={item.id} className={`transition-colors ${delta ? 'bg-amber-50/40' : 'hover:bg-slate-50/80'}`}>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.id}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600">{item.nama}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {delta !== 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400 line-through text-[11px]">{item.stok}</span>
                            <span className="text-slate-400 font-normal text-xs">➔</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-bold border ${
                                delta > 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-rose-50 text-rose-700 border-rose-300'
                              }`}
                            >
                              {previewStok} {item.satuan}
                              <span className="text-[10px] ml-1 font-semibold opacity-80">
                                ({delta > 0 ? `+${delta}` : delta})
                              </span>
                            </span>
                          </div>
                        ) : (
                          <>
                            {item.stok} <span className="text-slate-400 font-normal text-[11px]">{item.satuan}</span>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{item.stokMinimum} {item.satuan}</td>
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
                        {(currentRole === 'STAFF' || currentRole === 'MANAGER') ? (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {delta !== 0 ? (
                              <div className="flex items-center gap-1 bg-emerald-50/80 border border-emerald-200 p-0.5 rounded-md animate-fade-in shadow-2xs">
                                {/* Stepper -1 / +1 */}
                                <button
                                  onClick={() => handleAdjustDelta(item, -1)}
                                  disabled={item.stok + delta <= 0 || savingId === item.id}
                                  className="px-2 py-0.5 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded text-xs font-bold border border-slate-200 transition select-none"
                                  title="Kurangi 1 lagi"
                                >
                                  -1
                                </button>
                                <button
                                  onClick={() => handleAdjustDelta(item, 1)}
                                  disabled={savingId === item.id}
                                  className="px-2 py-0.5 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded text-xs font-bold border border-slate-200 transition select-none"
                                  title="Tambah 1 lagi"
                                >
                                  +1
                                </button>

                                {/* Tombol Simpan */}
                                <button
                                  onClick={() => handleSaveDelta(item)}
                                  disabled={savingId === item.id}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-bold transition shadow-2xs select-none"
                                  title="Simpan Perubahan Stok"
                                >
                                  {savingId === item.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>Simpan</span>
                                </button>

                                {/* Tombol Batal */}
                                <button
                                  onClick={() => handleCancelDelta(item.id)}
                                  disabled={savingId === item.id}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-white transition"
                                  title="Batal"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleAdjustDelta(item, -1)}
                                  disabled={item.stok <= 0}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 rounded text-xs font-bold transition shadow-xs select-none"
                                  title="Kurangi Stok (-1)"
                                >
                                  -1
                                </button>
                                <button
                                  onClick={() => handleAdjustDelta(item, 1)}
                                  className="px-2.5 py-1 bg-[#1E4648] hover:bg-[#163536] active:bg-[#102728] text-white rounded text-xs font-bold transition shadow-xs select-none"
                                  title="Tambah Stok (+1)"
                                >
                                  +1
                                </button>
                                {currentRole === 'MANAGER' && (
                                  <>
                                    <button
                                      onClick={() => handleEditClick(item)}
                                      className="p-1.5 text-slate-400 hover:text-blue-500 rounded transition"
                                      title="Edit"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(item.id, item.nama)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 rounded transition"
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </>
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
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-600 mb-4">{editId ? 'Edit Stok Bahan' : 'Tambah Stok Bahan Baru'}</h3>
            <div className="space-y-3 mb-4">
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Jumlah Stok</label>
                  <input
                    type="number"
                    step="any"
                    value={stok}
                    onChange={(e) => setStok(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                  />
                </div>
                <SatuanInput
                  value={satuan}
                  onChange={setSatuan}
                  label="Satuan"
                  helperText="Contoh: liter, pcs, botol, kg, atau ketik kustom."
                />
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
              <button onClick={() => { setShowAddModal(false); setEditId(null); setNama(''); setStok(''); setSatuan(''); setStokMin(''); setIsDijual(false); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">
                Batal
              </button>
              <button onClick={handleSave} className="bg-[#1E4648] hover:bg-[#163536] text-white font-medium px-4 py-2 rounded-md text-xs">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
