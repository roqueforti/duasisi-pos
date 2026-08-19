'use client';

import React, { useState, useEffect } from 'react';
import { runBackend } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  FolderOpen, 
  Save, 
  X,
  Zap,
  Shirt,
  Sparkles,
  Coffee,
  Package,
  Tag,
  ShoppingBag,
  Utensils,
  Flame,
  WashingMachine,
  Folder,
  Star,
  Layers,
  Check
} from 'lucide-react';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

import { PALETTE, ICON_OPTIONS, getIconComponent, KategoriItem } from '@/lib/categoryUtils';
export { getIconComponent };
export type { KategoriItem };

export default function KategoriView({ currentRole }: { currentRole?: UserRole }) {
  const { showAlert, showConfirm } = useDialog();
  const [data, setData] = useState<KategoriItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [namaKategori, setNamaKategori] = useState('');
  const [warna, setWarna] = useState(PALETTE[0].value);
  const [icon, setIcon] = useState('Zap');

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
    setWarna(PALETTE[0].value);
    setIcon('Zap');
    setShowModal(true);
  };

  const handleOpenEdit = (item: KategoriItem) => {
    setEditingId(item.id);
    setNamaKategori(item.nama);
    setWarna(item.warna || PALETTE[0].value);
    setIcon(item.icon || 'Tag');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!namaKategori.trim()) {
      await showAlert('Nama Kategori wajib diisi!', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      if (editingId) {
        await runBackend('updateKategori', editingId, { nama: namaKategori.trim(), warna, icon });
      } else {
        await runBackend('tambahKategori', { nama: namaKategori.trim(), warna, icon });
      }
      setShowModal(false);
      clearCache('getKategoriList');
      clearCache('getLayananList');
      clearCache('getLayananListAll');
      loadData();
      await showAlert('Kategori berhasil disimpan!', 'success');
    } catch (err: any) {
      await showAlert(err.message || 'Gagal menyimpan kategori', 'error');
      setLoading(false);
    }
  };

  const handleToggleAktif = async (id: string, currentAktif: string) => {
    const isConfirmed = await showConfirm(`Yakin ingin ${currentAktif === 'Y' ? 'menonaktifkan' : 'mengaktifkan'} kategori ini?`);
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await runBackend('toggleAktifKategori', id, currentAktif !== 'Y');
      clearCache('getKategoriList');
      clearCache('getLayananList');
      clearCache('getLayananListAll');
      loadData();
      await showAlert(`Kategori berhasil di${currentAktif === 'Y' ? 'nonaktifkan' : 'aktifkan'}.`, 'success');
    } catch (err: any) {
      await showAlert('Gagal mengubah status', 'error');
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await showConfirm('Yakin ingin menghapus kategori ini? Data produk yang terkait mungkin perlu disesuaikan kembali.');
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await runBackend('hapusKategori', id);
      clearCache('getKategoriList');
      clearCache('getLayananList');
      clearCache('getLayananListAll');
      loadData();
      await showAlert('Kategori berhasil dihapus.', 'success');
    } catch (err: any) {
      await showAlert('Gagal menghapus kategori', 'error');
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

  const PreviewIcon = getIconComponent(icon);

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 lg:p-6 overflow-hidden space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs shrink-0">
        <div>
          <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#1E4648]" />
            Manajemen Kategori Layanan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Kelola nama, warna label, dan ikon kategori yang akan tampil di POS Kasir dan Antrean.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-[#1E4648] hover:bg-[#163536] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kategori Baru</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
        {loading && data.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-semibold">Memuat data kategori...</div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-rose-500 text-xs font-semibold">{errorMsg}</div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-xs font-semibold">Belum ada kategori. Silakan tambahkan kategori baru.</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-bold text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Kode</th>
                  <th className="px-5 py-3.5">Nama & Tampilan Label</th>
                  <th className="px-5 py-3.5">Ikon & Warna Tema</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((item) => {
                  const ItemIcon = getIconComponent(item.icon);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {item.id}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 border shadow-2xs ${item.warna || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                            <ItemIcon className="w-3.5 h-3.5" />
                            <span>{item.nama}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-semibold">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border shadow-2xs ${item.warna || 'bg-slate-100 border-slate-200'}`}>
                            <ItemIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono">Icon: {item.icon || 'Tag'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleToggleAktif(item.id, item.aktif)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                            item.aktif === 'Y' 
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {item.aktif === 'Y' ? 'Aktif' : 'Non-aktif'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg transition"
                          title="Edit Kategori"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal (Edit & Tambah Kategori) */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 my-8">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{editingId ? 'Edit Kategori' : 'Tambah Kategori Baru'}</h3>
                <p className="text-[11px] text-slate-400">Atur nama, warna label, dan ikon kategori</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4.5 text-xs">
              
              {/* Live Preview Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Preview Tampilan di POS:</span>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-2 border shadow-xs ${warna}`}>
                    <PreviewIcon className="w-4 h-4" />
                    <span>{namaKategori.trim() || 'Nama Kategori'}</span>
                  </span>
                </div>
              </div>

              {/* Nama Kategori */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Kategori *</label>
                <input
                  type="text"
                  value={namaKategori}
                  onChange={e => setNamaKategori(e.target.value)}
                  placeholder="Contoh: Self Service, Drop Off, Cuci Sepatu..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#1E4648] transition"
                />
              </div>

              {/* Pilih Icon Kategori */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-700">Pilih Ikon Kategori</label>
                  <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    Ikon: {icon}
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {ICON_OPTIONS.map(i => {
                    const IconC = i.icon;
                    const isSelected = icon === i.id;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => setIcon(i.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${
                          isSelected
                            ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                        title={i.label}
                      >
                        <IconC className="w-5 h-5" />
                        <span className="text-[8px] font-bold mt-1 truncate max-w-full">{i.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pilih Warna Label */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Pilih Warna Label (Palette)</label>
                <div className="grid grid-cols-4 gap-2">
                  {PALETTE.map(c => {
                    const isSelected = warna === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setWarna(c.value)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${
                          isSelected
                            ? 'border-[#1E4648] bg-teal-50/50 ring-2 ring-[#1E4648]/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${c.value}`}>
                          {isSelected && <Check className="w-3 h-3 text-current" />}
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 mt-1 truncate max-w-full">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#1E4648] hover:bg-[#163536] rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'Menyimpan...' : 'Simpan Kategori'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
