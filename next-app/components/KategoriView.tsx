'use client';

import React, { useState, useEffect } from 'react';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { Plus, Edit2, Trash2, FolderOpen, Save, X } from 'lucide-react';
import { UserRole } from '@/lib/types';

export interface KategoriItem {
  id: string;
  nama: string;
  aktif: string;
  warna?: string;
}

const PALETTE = [
  { label: 'Biru', value: 'bg-blue-100 text-blue-800 border-blue-200' },
  { label: 'Kuning', value: 'bg-amber-100 text-amber-800 border-amber-200' },
  { label: 'Hijau', value: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { label: 'Merah Muda', value: 'bg-rose-100 text-rose-800 border-rose-200' },
  { label: 'Ungu', value: 'bg-purple-100 text-purple-800 border-purple-200' },
  { label: 'Abu-abu', value: 'bg-slate-100 text-slate-800 border-slate-200' },
];

export default function KategoriView({ currentRole }: { currentRole?: UserRole }) {
  const [data, setData] = useState<KategoriItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [namaKategori, setNamaKategori] = useState('');
  const [warna, setWarna] = useState(PALETTE[5].value);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await runBackend<KategoriItem[]>('getKategoriList');
      if (Array.isArray(res)) {
        setData(res);
      } else {
        setData([]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat kategori');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNamaKategori('');
    setWarna(PALETTE[5].value);
    setShowModal(true);
  };

  const handleOpenEdit = (item: KategoriItem) => {
    setEditingId(item.id);
    setNamaKategori(item.nama);
    setWarna(item.warna || PALETTE[5].value);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!namaKategori.trim()) {
      alert('Nama Kategori wajib diisi');
      return;
    }
    
    setLoading(true);
    try {
      if (editingId) {
        await runBackend('updateKategori', editingId, { nama: namaKategori, warna });
      } else {
        await runBackend('tambahKategori', { nama: namaKategori, warna });
      }
      setShowModal(false);
      clearCache('getKategoriList');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kategori');
      setLoading(false);
    }
  };

  const handleToggleAktif = async (id: string, currentAktif: string) => {
    if (!confirm(`Yakin ingin ${currentAktif === 'Y' ? 'menonaktifkan' : 'mengaktifkan'} kategori ini?`)) return;
    setLoading(true);
    try {
      await runBackend('toggleAktifKategori', id, currentAktif !== 'Y');
      clearCache('getKategoriList');
      loadData();
    } catch (err: any) {
      alert('Gagal mengubah status');
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus kategori ini? Data yang terkait dengan kategori ini di produk mungkin tidak dapat ditampilkan di POS dengan benar.')) return;
    setLoading(true);
    try {
      await runBackend('hapusKategori', id);
      clearCache('getKategoriList');
      loadData();
    } catch (err: any) {
      alert('Gagal menghapus kategori');
      setLoading(false);
    }
  };

  if (currentRole !== 'MANAGER') {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <p>Akses ditolak. Halaman ini hanya untuk Manager.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 lg:p-6 overflow-hidden">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-[#1E4648]" />
            Manajemen Kategori
          </h1>
          <p className="text-sm text-slate-500 mt-1">Kelola kategori produk dan layanan yang akan tampil sebagai tab di kasir.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#1E4648] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-[#1E4648]/20 hover:bg-[#153436] transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {loading && data.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Memuat data...</div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-red-500 text-sm font-semibold">{errorMsg}</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Belum ada kategori. Silakan tambahkan kategori baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs font-bold">
                <tr>
                  <th className="px-6 py-4">Nama Kategori</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-semibold text-slate-800 flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border ${item.warna || 'bg-slate-100 border-slate-200'}`} />
                      {item.nama}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAktif(item.id, item.aktif)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${
                          item.aktif === 'Y' 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {item.aktif === 'Y' ? 'Aktif' : 'Non-aktif'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Edit Kategori"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                        title="Hapus Kategori"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-slate-800">{editingId ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Kategori *</label>
                <input
                  type="text"
                  value={namaKategori}
                  onChange={e => setNamaKategori(e.target.value)}
                  placeholder="Contoh: Kiloan Reguler"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Warna Label (Tampil di POS)</label>
                <div className="grid grid-cols-3 gap-2">
                  {PALETTE.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setWarna(c.value)}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border-2 transition ${warna === c.value ? 'border-[#1E4648] bg-slate-50' : 'border-transparent hover:bg-slate-50'}`}
                    >
                      <div className={`w-6 h-6 rounded-full border ${c.value}`} />
                      <span className="text-[10px] text-slate-500 mt-1">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 text-sm font-bold text-white bg-[#1E4648] hover:bg-[#153436] rounded-lg transition shadow-md shadow-[#1E4648]/20 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
