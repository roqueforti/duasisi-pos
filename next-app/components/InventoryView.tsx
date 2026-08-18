'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, Trash2, Edit3, AlertTriangle, Download, Upload } from 'lucide-react';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { toCSV, downloadCSV, parseCSV, readFileAsText } from '@/lib/csvUtils';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

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

  // Bi-directional Sync States
  const [isDijual, setIsDijual] = useState(false);
  const [hargaJual, setHargaJual] = useState('');
  const [kategori, setKategori] = useState('Add On');
  const [kategoriList, setKategoriList] = useState<{id: string, nama: string, aktif: string}[]>([]);

  const loadInventory = () => {
    setLoading(true);
    runBackendCached<InventoryItem[]>(
      'getInventoryList',
      (data, fromCache) => {
        if (Array.isArray(data)) setItems(data);
        if (!fromCache) setLoading(false);
      },
      3 * 60 * 1000
    );
    setLoading(false);
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

  const handleUpdateStok = async (id: string, delta: number) => {
    try {
      await runBackend('updateStokInventory', id, delta);
      loadInventory();
    } catch (err) {
      await showAlert('Gagal mengupdate stok', 'error');
    }
  };

  const handleDelete = async (id: string, namaBarang: string) => {
    const isConfirmed = await showConfirm(`Hapus barang ${namaBarang}?`);
    if (!isConfirmed) return;
    try {
      await runBackend('hapusInventory', id);
      loadInventory();
    } catch (err) {
      await showAlert('Gagal menghapus barang', 'error');
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
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Belum ada data stok bahan
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isMenipis = item.stok <= item.stokMinimum;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-600">{item.nama}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {item.stok} <span className="text-slate-400 font-normal text-[11px]">{item.satuan}</span>
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleUpdateStok(item.id, -1)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold"
                              title="Kurangi Stok"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => handleUpdateStok(item.id, 1)}
                              className="px-2 py-1 bg-[#1E4648] hover:bg-[#163536] text-white rounded text-xs font-bold"
                              title="Tambah Stok"
                            >
                              +1
                            </button>
                            {/* Hapus hanya untuk MANAGER */}
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
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    placeholder="pcs / liter"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Contoh: liter, pcs, botol.</p>
                </div>
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
