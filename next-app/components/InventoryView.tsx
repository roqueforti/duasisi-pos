'use client';

import React, { useState, useEffect } from 'react';
import { Package, Plus, RefreshCw, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import { runBackend } from '@/lib/api';

interface InventoryItem {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
  stokMinimum: number;
  terakhirUpdate?: string;
}

export default function InventoryView() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [nama, setNama] = useState('');
  const [stok, setStok] = useState('');
  const [satuan, setSatuan] = useState('pcs');
  const [stokMin, setStokMin] = useState('5');

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await runBackend<InventoryItem[]>('getInventoryList');
      if (Array.isArray(data)) setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleAdd = async () => {
    if (!nama.trim()) { alert('Masukkan nama barang!'); return; }
    setLoading(true);
    try {
      await runBackend('tambahInventory', {
        nama: nama.trim(),
        stok: Number(stok) || 0,
        satuan: satuan.trim(),
        stokMinimum: Number(stokMin) || 0
      });
      setShowAddModal(false);
      setNama(''); setStok('');
      loadInventory();
    } catch (err) {
      alert('Gagal menambah barang');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStok = async (id: string, delta: number) => {
    try {
      await runBackend('updateStokInventory', id, delta);
      loadInventory();
    } catch (err) {
      alert('Gagal mengupdate stok');
    }
  };

  const handleDelete = async (id: string, namaBarang: string) => {
    if (!confirm(`Hapus barang ${namaBarang}?`)) return;
    try {
      await runBackend('hapusInventory', id);
      loadInventory();
    } catch (err) {
      alert('Gagal menghapus barang');
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Header & Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Package className="w-4 h-4 text-[#1E4648]" />
          <span>Stok Bahan & Deterjen</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadInventory}
            className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-3.5 py-1.5 rounded-md text-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Bahan
          </button>
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
                      <td className="py-3 px-4 font-semibold text-slate-800">{item.nama}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.stok} <span className="text-slate-400 font-normal text-[11px]">{item.satuan}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{item.stokMinimum} {item.satuan}</td>
                      <td className="py-3 px-4">
                        {isMenipis ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" /> Menipis
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                            Aman
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{item.terakhirUpdate || '-'}</td>
                      <td className="py-3 px-4 text-right">
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
                            className="px-2 py-1 bg-[#1E4648] hover:bg-[#153334] text-white rounded text-xs font-bold"
                            title="Tambah Stok"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.nama)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded transition"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Tambah Stok Bahan Baru</h3>
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
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Jumlah Stok</label>
                  <input
                    type="number"
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
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Stok Minimum Peringatan</label>
                <input
                  type="number"
                  value={stokMin}
                  onChange={(e) => setStokMin(e.target.value)}
                  placeholder="5"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">
                Batal
              </button>
              <button onClick={handleAdd} className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-4 py-2 rounded-md text-xs">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
