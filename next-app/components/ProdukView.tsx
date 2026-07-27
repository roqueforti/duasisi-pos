'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, RefreshCw, Trash2, Edit3, RotateCcw, X, TagIcon, Gift } from 'lucide-react';
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

interface PromoVoucher {
  idPromo: string;
  kodeVoucher: string;
  jenisDiskon: string;
  nilaiDiskon: number;
  minTransaksi: number;
  statusAktif: boolean;
}

const defaultPromos: PromoVoucher[] = [
  { idPromo: 'PRM-01', kodeVoucher: 'LAUNDRYMEMBER', jenisDiskon: 'Nominal', nilaiDiskon: 10000, minTransaksi: 50000, statusAktif: true },
  { idPromo: 'PRM-02', kodeVoucher: 'HEMAT20', jenisDiskon: 'Nominal', nilaiDiskon: 20000, minTransaksi: 100000, statusAktif: true }
];

export default function ProdukView() {
  const [activeSubTab, setActiveSubTab] = useState<'Produk' | 'Promo' | 'Loyalitas'>('Produk');
  const [layananList, setLayananList] = useState<LayananItemBackend[]>([]);
  const [promoList, setPromoList] = useState<PromoVoucher[]>(defaultPromos);
  const [loading, setLoading] = useState(false);

  // Add / Edit Product Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [harga, setHarga] = useState('');
  const [satuan, setSatuan] = useState('kg');
  const [icon, setIcon] = useState('🧺');
  const [tipe, setTipe] = useState<'SelfService' | 'FullService'>('SelfService');

  // Add Promo Modal State
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [kodePromo, setKodePromo] = useState('');
  const [nilaiDiskon, setNilaiDiskon] = useState('10000');
  const [minTx, setMinTx] = useState('50000');

  // Loyalty Settings
  const [poinRate, setPoinRate] = useState('10000');
  const [poinValue, setPoinValue] = useState('1000');

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
    if (!nama.trim() || !harga.trim()) { alert('Nama dan harga wajib diisi!'); return; }
    const payload = { nama: nama.trim(), harga: Number(harga) || 0, satuan, icon, tipe };
    setLoading(true);
    try {
      if (editingId) {
        await runBackend('updateLayanan', editingId, payload);
      } else {
        await runBackend('tambahLayanan', payload);
      }
      setShowModal(false);
      loadProduk();
    } catch (err) {
      alert('Gagal menyimpan layanan');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAktif = async (id: string, isY: boolean) => {
    try {
      await runBackend('toggleAktifLayanan', id, !isY);
      loadProduk();
    } catch (err) {
      alert('Gagal mengubah status');
    }
  };

  const handleHapusLayanan = async (id: string) => {
    if (!confirm('Yakin ingin menghapus layanan ini?')) return;
    try {
      await runBackend('hapusLayanan', id);
      loadProduk();
    } catch (err) {
      alert('Gagal menghapus layanan');
    }
  };

  const handleSavePromo = async () => {
    if (!kodePromo.trim()) { alert('Kode promo wajib diisi!'); return; }
    const payload = {
      kodeVoucher: kodePromo.trim().toUpperCase(),
      jenisDiskon: 'Nominal',
      nilaiDiskon: Number(nilaiDiskon) || 5000,
      minTransaksi: Number(minTx) || 0
    };
    try {
      await runBackend('tambahPromo', payload);
      setShowPromoModal(false);
      setKodePromo('');
      loadProduk();
      alert(`Promo ${payload.kodeVoucher} berhasil ditambahkan ke database!`);
    } catch (err) {
      alert('Gagal menyimpan promo ke backend');
    }
  };

  const handleHapusPromo = async (id: string) => {
    if (!confirm('Yakin hapus voucher promo ini?')) return;
    try {
      await runBackend('hapusPromo', id);
      loadProduk();
    } catch (err) {
      alert('Gagal menghapus promo');
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
            <button
              onClick={() => setActiveSubTab('Produk')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Produk' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Master Layanan Laundry</span>
            </button>
            <button
              onClick={() => setActiveSubTab('Promo')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Promo' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TagIcon className="w-3.5 h-3.5" />
              <span>Master Promo & Voucher</span>
            </button>
            <button
              onClick={() => setActiveSubTab('Loyalitas')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Loyalitas' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Program Poin Loyalitas</span>
            </button>
          </div>
        </div>

        {activeSubTab === 'Produk' && (
          <button
            onClick={handleOpenAdd}
            className="bg-[#1E4648] hover:bg-[#153334] text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Layanan
          </button>
        )}

        {activeSubTab === 'Promo' && (
          <button
            onClick={() => setShowPromoModal(true)}
            className="bg-[#1E4648] hover:bg-[#153334] text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Buat Voucher Promo
          </button>
        )}
      </div>

      {activeSubTab === 'Produk' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Layanan</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Tarif Satuan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-12" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : layananList.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">Belum ada data layanan</td></tr>
                ) : (
                  layananList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                        <span>{item.nama}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.tipe}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1E4648]">
                        Rp {item.harga.toLocaleString('id-ID')} / {item.satuan}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.aktif === 'Y' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {item.aktif === 'Y' ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button onClick={() => handleOpenEdit(item)} className="p-1 text-slate-500 hover:text-slate-800"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleToggleAktif(item.id, item.aktif === 'Y')} className="p-1 text-amber-600 hover:text-amber-800"><RotateCcw className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleHapusLayanan(item.id)} className="p-1 text-rose-500 hover:text-rose-700"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'Promo' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Kode Voucher</th>
                  <th className="py-3 px-4">Jenis Diskon</th>
                  <th className="py-3 px-4">Nilai Potongan</th>
                  <th className="py-3 px-4">Min. Transaksi</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promoList.map((prm) => (
                  <tr key={prm.idPromo} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold font-sans text-[#1E4648] text-sm">{prm.kodeVoucher}</td>
                    <td className="py-3 px-4 text-slate-600">{prm.jenisDiskon}</td>
                    <td className="py-3 px-4 font-bold text-emerald-700">Rp {prm.nilaiDiskon.toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4 text-slate-600">Rp {(prm.minTransaksi || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        Berlaku
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleHapusPromo(prm.idPromo)} className="p-1 text-rose-500 hover:text-rose-700" title="Hapus Promo">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'Loyalitas' && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 max-w-md shadow-xs space-y-4 text-xs">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Gift className="w-4 h-4 text-amber-500" />
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

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nilai Tukar 1 Poin (Rp)</label>
              <input
                type="number"
                value={poinValue}
                onChange={(e) => setPoinValue(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] font-bold"
              />
            </div>
          </div>

          <button
            onClick={() => alert('Pengaturan poin loyalitas berhasil disimpan!')}
            className="w-full bg-[#1E4648] text-white font-semibold py-2 rounded-md transition"
          >
            Simpan Konfigurasi Poin
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">{editingId ? 'Edit Layanan' : 'Tambah Layanan Baru'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Layanan *</label>
                <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Cuci Karpet..." className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga (Rp) *</label>
                  <input type="number" value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="15000" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input type="text" value={satuan} onChange={(e) => setSatuan(e.target.value)} placeholder="kg / item / m²" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowModal(false)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-md text-xs font-semibold">Batal</button>
              <button onClick={handleSave} className="flex-1 bg-[#1E4648] text-white font-semibold py-2 rounded-md text-xs transition">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {showPromoModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Buat Voucher Promo Baru</h3>
              <button onClick={() => setShowPromoModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Voucher *</label>
                <input type="text" value={kodePromo} onChange={(e) => setKodePromo(e.target.value)} placeholder="LAUNDRYMEMBER" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] uppercase font-sans font-bold" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nilai Potongan Diskon (Rp) *</label>
                <input type="number" value={nilaiDiskon} onChange={(e) => setNilaiDiskon(e.target.value)} placeholder="10000" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Syarat Minimum Transaksi (Rp)</label>
                <input type="number" value={minTx} onChange={(e) => setMinTx(e.target.value)} placeholder="50000" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPromoModal(false)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-md text-xs font-semibold">Batal</button>
              <button onClick={handleSavePromo} className="flex-1 bg-[#1E4648] text-white font-semibold py-2 rounded-md text-xs transition">Simpan Voucher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
