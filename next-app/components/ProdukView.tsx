'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, RefreshCw, Trash2, Edit3, RotateCcw, Check, X } from 'lucide-react';
import { runBackend } from '@/lib/api';

interface LayananItemBackend {
  id: string;
  nama: string;
  harga: number;
  satuan: string;
  icon: string;
  aktif: string;
  tipe: 'SelfService' | 'FullService';
}

export default function ProdukView() {
  const [layananList, setLayananList] = useState<LayananItemBackend[]>([]);
  const [loading, setLoading] = useState(false);

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nama, setNama] = useState('');
  const [harga, setHarga] = useState('');
  const [satuan, setSatuan] = useState('kg');
  const [icon, setIcon] = useState('🧺');
  const [tipe, setTipe] = useState<'SelfService' | 'FullService'>('SelfService');

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

  useEffect(() => {
    loadProduk();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNama(''); setHarga(''); setSatuan('kg'); setIcon('🧺'); setTipe('SelfService');
    setShowModal(true);
  };

  const handleOpenEdit = (item: LayananItemBackend) => {
    setEditingId(item.id);
    setNama(item.nama);
    setHarga(item.harga.toString());
    setSatuan(item.satuan || 'kg');
    setIcon(item.icon || '🧺');
    setTipe(item.tipe || 'SelfService');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nama.trim()) { alert('Nama layanan wajib diisi!'); return; }
    setLoading(true);
    try {
      const payload = {
        nama: nama.trim(),
        harga: Number(harga) || 0,
        satuan: satuan.trim(),
        icon: icon.trim() || '🧺',
        tipe: tipe
      };

      if (editingId) {
        await runBackend('updateLayanan', editingId, payload);
      } else {
        await runBackend('tambahLayanan', payload);
      }
      setShowModal(false);
      loadProduk();
    } catch (err) {
      alert('Gagal menyimpan produk');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAktif = async (id: string, currentAktif: string) => {
    const isY = currentAktif === 'Y';
    try {
      await runBackend('toggleAktifLayanan', id, !isY);
      loadProduk();
    } catch (err) {
      alert('Gagal mengubah status aktif');
    }
  };

  const handleDelete = async (id: string, namaLayanan: string) => {
    if (!confirm(`Hapus layanan ${namaLayanan}?`)) return;
    try {
      await runBackend('hapusLayanan', id);
      loadProduk();
    } catch (err) {
      alert('Gagal menghapus layanan');
    }
  };

  const handleResetSelfService = async () => {
    if (!confirm('Reset semua katalog Self Service ke default?')) return;
    setLoading(true);
    try {
      await runBackend('resetLayananSelfService');
      loadProduk();
    } catch (err) {
      alert('Gagal me-reset layanan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Header & Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Tag className="w-4 h-4 text-[#1E4648]" />
          <span>Katalog Produk & Harga Layanan</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProduk}
            className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleResetSelfService}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium px-3 py-1.5 rounded-md text-xs transition flex items-center gap-1.5"
            title="Reset Self Service ke Default"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-3.5 py-1.5 rounded-md text-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Layanan
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Icon</th>
                <th className="py-3 px-4">Nama Layanan</th>
                <th className="py-3 px-4">Tipe</th>
                <th className="py-3 px-4">Harga Satuan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-6 w-6 bg-slate-100 rounded" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-36" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : layananList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Belum ada katalog layanan
                  </td>
                </tr>
              ) : (
                layananList.map((item) => {
                  const isAktif = item.aktif === 'Y';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-lg">{item.icon || '🧺'}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{item.nama}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.tipe}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1E4648]">
                        Rp {item.harga.toLocaleString('id-ID')} <span className="text-slate-400 font-normal text-[11px]">/{item.satuan}</span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleAktif(item.id, item.aktif)}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded transition ${
                            isAktif
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                        >
                          {isAktif ? 'Aktif' : 'Non-Aktif'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 rounded transition"
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">
              {editingId ? 'Edit Layanan' : 'Tambah Layanan Baru'}
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nama Layanan *</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Cuci 7.5 Kg"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Harga (Rp)</label>
                  <input
                    type="number"
                    value={harga}
                    onChange={(e) => setHarga(e.target.value)}
                    placeholder="10000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    placeholder="kg / paket / pcs"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tipe Layanan</label>
                  <select
                    value={tipe}
                    onChange={(e) => setTipe(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white"
                  >
                    <option value="SelfService">Self Service</option>
                    <option value="FullService">Full Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Emoji Icon</label>
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="🫧 / 🧺 / 👔"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">
                Batal
              </button>
              <button onClick={handleSave} className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-4 py-2 rounded-md text-xs">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
