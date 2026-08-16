'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, RefreshCw, Trash2, Edit3, RotateCcw, X, TagIcon, Gift, Download, Upload, Zap } from 'lucide-react';
import { runBackend } from '@/lib/api';
import { toCSV, downloadCSV, parseCSV, readFileAsText } from '@/lib/csvUtils';
import { UserRole } from '@/lib/types';

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

const defaultPromos: PromoVoucher[] = [];

interface ProdukViewProps {
  currentRole?: UserRole;
}

export default function ProdukView({ currentRole }: ProdukViewProps = {}) {
  const [activeSubTab, setActiveSubTab] = useState<'Produk' | 'Promo' | 'Loyalitas' | 'Prioritas'>('Produk');
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
  const [kategori, setKategori] = useState<'Self Service' | 'Drop Off' | 'Add On' | 'Makanan dan Minuman'>('Self Service');

  // Add Promo Modal State
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [kodePromo, setKodePromo] = useState('');
  const [nilaiDiskon, setNilaiDiskon] = useState('10000');
  const [minTx, setMinTx] = useState('50000');

  // Loyalty Settings
  const [poinRate, setPoinRate] = useState('10000');
  const [poinValue, setPoinValue] = useState('1000');

  // Priority Settings
  const [priorityLevels, setPriorityLevels] = useState<any[]>([]);
  const [prioritySaving, setPrioritySaving] = useState(false);

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

  const loadPoinConfig = async () => {
    try {
      const config = await runBackend<{rate: number, value: number}>('getPoinConfig');
      if (config) {
        setPoinRate(config.rate.toString());
        setPoinValue(config.value.toString());
      }
    } catch (err) {
      console.error('Gagal memuat konfigurasi poin:', err);
    }
  };

  const loadPriorityConfig = async () => {
    try {
      const config = await runBackend<any[]>('getPriorityConfig');
      if (Array.isArray(config)) {
        setPriorityLevels(config);
      }
    } catch (err) {
      console.error('Gagal memuat konfigurasi prioritas:', err);
    }
  };

  const handleSavePriority = async () => {
    setPrioritySaving(true);
    try {
      const cleanLevels = priorityLevels.map(p => ({
        id: p.id || `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nama: p.nama,
        sla: Number(p.sla),
        multiplier: Number(p.multiplier)
      }));
      await runBackend('savePriorityConfig', cleanLevels);
      setPriorityLevels(cleanLevels);
      alert('Pengaturan prioritas berhasil disimpan!');
    } catch (err) {
      alert('Gagal menyimpan pengaturan prioritas');
    } finally {
      setPrioritySaving(false);
    }
  };

  const handleAddPriorityLevel = () => {
    setPriorityLevels([...priorityLevels, { id: `p_${Date.now()}`, nama: 'Level Baru', sla: 24, multiplier: 1 }]);
  };

  const handleRemovePriorityLevel = (idx: number) => {
    setPriorityLevels(priorityLevels.filter((_, i) => i !== idx));
  };

  const handlePriorityChange = (idx: number, field: string, value: string | number) => {
    const newLevels = [...priorityLevels];
    newLevels[idx] = { ...newLevels[idx], [field]: value };
    setPriorityLevels(newLevels);
  };

  const loadPromo = async () => {
    try {
      const data = await runBackend<PromoVoucher[]>('getPromoList');
      if (Array.isArray(data) && data.length > 0) setPromoList(data);
    } catch (err) {
      console.error('Gagal memuat promo:', err);
    }
  };

  useEffect(() => {
    loadProduk();
    loadPromo();
    loadPoinConfig();
    loadPriorityConfig();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNama(''); setHarga(''); setSatuan('kg'); setIcon('🧺'); setTipe('SelfService'); setKategori('Self Service');
    setShowModal(true);
  };

  const handleOpenEdit = (item: LayananItemBackend & { kategori?: any }) => {
    setEditingId(item.id);
    setNama(item.nama);
    setHarga(item.harga.toString());
    setSatuan(item.satuan || 'kg');
    setIcon(item.icon || '🧺');
    setTipe(item.tipe || 'SelfService');
    setKategori(item.kategori || 'Self Service');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nama.trim() || !harga.trim()) { alert('Nama dan harga wajib diisi!'); return; }
    const payload = { nama: nama.trim(), harga: Number(harga) || 0, satuan, icon, tipe, kategori };
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
      if (editingPromoId) {
        await runBackend('editPromo', editingPromoId, payload);
      } else {
        await runBackend('tambahPromo', payload);
      }
      setShowPromoModal(false);
      setKodePromo('');
      loadPromo();
      alert(`Promo ${payload.kodeVoucher} berhasil disimpan ke database!`);
    } catch (err) {
      alert('Gagal menyimpan promo ke backend');
    }
  };

  const handleOpenEditPromo = (prm: PromoVoucher) => {
    setEditingPromoId(prm.idPromo);
    setKodePromo(prm.kodeVoucher);
    setNilaiDiskon(prm.nilaiDiskon.toString());
    setMinTx(prm.minTransaksi?.toString() || '0');
    setShowPromoModal(true);
  };

  const handleHapusPromo = async (id: string) => {
    if (!confirm('Yakin hapus voucher promo ini?')) return;
    try {
      await runBackend('hapusPromo', id);
      loadPromo();
    } catch (err) {
      alert('Gagal menghapus promo');
    }
  };

  const handleExportProduk = () => {
    const rows = layananList.map(l => [l.nama, l.harga, l.satuan, l.tipe, l.aktif === 'Y' ? 'Aktif' : 'Non-Aktif']);
    downloadCSV('export_produk.csv', toCSV(['Nama Layanan', 'Harga', 'Satuan', 'Tipe', 'Status'], rows));
  };

  const handleDownloadTemplateProduk = () => {
    downloadCSV('template_produk_kosong.csv', toCSV(
      ['Nama Layanan', 'Harga', 'Satuan', 'Tipe', 'Status'],
      [['Cuci Kiloan', 8000, 'kg', 'SelfService', 'Aktif'], ['Setrika', 5000, 'kg', 'FullService', 'Aktif']]
    ));
  };

  const handleImportProduk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) { alert('File CSV kosong atau format salah.'); return; }
      let success = 0, fail = 0;
      for (const row of rows) {
        const nama = row['Nama Layanan'] || row['nama'] || '';
        if (!nama.trim()) { fail++; continue; }
        const tipeRaw = (row['Tipe'] || row['tipe'] || 'SelfService').trim();
        const tipeVal: 'SelfService' | 'FullService' = tipeRaw === 'FullService' ? 'FullService' : 'SelfService';
        const aktifRaw = (row['Status'] || row['status'] || 'Aktif').trim().toLowerCase();
        const aktifVal = aktifRaw === 'aktif' || aktifRaw === 'y';
        try {
          const id = await runBackend('tambahLayanan', {
            nama: nama.trim(),
            harga: Number(row['Harga'] || row['harga']) || 0,
            satuan: (row['Satuan'] || row['satuan'] || 'kg').trim(),
            icon: '🧺',
            tipe: tipeVal,
          });
          if (id && !aktifVal) await runBackend('toggleAktifLayanan', id, false);
          success++;
        } catch { fail++; }
      }
      loadProduk();
      alert(`Import selesai: ${success} berhasil${fail > 0 ? `, ${fail} gagal` : ''}.`);
    } catch (err) {
      alert('Gagal membaca file CSV.');
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
                activeSubTab === 'Produk' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Master Layanan Laundry</span>
            </button>
            <button
              onClick={() => setActiveSubTab('Promo')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Promo' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <TagIcon className="w-3.5 h-3.5" />
              <span>Master Promo & Voucher</span>
            </button>
            <button
              onClick={() => setActiveSubTab('Loyalitas')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Loyalitas' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Program Poin Loyalitas</span>
            </button>
            <button
              onClick={() => setActiveSubTab('Prioritas')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'Prioritas' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Prioritas & SLA</span>
            </button>
          </div>
        </div>

        {activeSubTab === 'Produk' && (
          <div className="flex items-center gap-2">
            {currentRole === 'MANAGER' && (
              <>
                <button onClick={handleExportProduk} className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition" title="Export Data Layanan ke CSV">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleDownloadTemplateProduk} className="px-3 py-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 text-xs font-medium transition" title="Download Template Kosong">
                  Template
                </button>
                <label className="cursor-pointer px-3 py-1.5 border border-[#B5C9C9] rounded-md text-[#1E4648] hover:bg-[#B5C9C9]/10 text-xs font-medium transition flex items-center gap-1.5" title="Import Data Layanan dari CSV">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleImportProduk} />
                </label>
                <button
                  onClick={handleOpenAdd}
                  className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Layanan
                </button>
              </>
            )}
          </div>
        )}

        {activeSubTab === 'Promo' && currentRole === 'MANAGER' && (
          <button
            onClick={() => {
              setEditingPromoId(null);
              setKodePromo(''); setNilaiDiskon('10000'); setMinTx('50000');
              setShowPromoModal(true);
            }}
            className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-xs"
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
                      <td className="py-3 px-4 font-semibold text-slate-600 flex items-center gap-2">
                        <span>{item.nama}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.tipe}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1E4648]">
                        Rp {(item?.harga || 0).toLocaleString('id-ID')} / {item.satuan}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.aktif === 'Y' ? 'bg-[#B5C9C9]/20 text-[#1E4648]' : 'bg-slate-100 text-slate-500'}`}>
                          {item.aktif === 'Y' ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        {currentRole === 'MANAGER' ? (
                          <>
                            <button onClick={() => handleOpenEdit(item)} className="p-1 text-slate-500 hover:text-slate-600"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleToggleAktif(item.id, item.aktif === 'Y')} className="p-1 text-[#FF9500] hover:text-[#FF9500]"><RotateCcw className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleHapusLayanan(item.id)} className="p-1 text-rose-500 hover:text-rose-700"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
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
                    <td className="py-3 px-4 font-bold text-[#1E4648]">Rp {(prm?.nilaiDiskon || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4 text-slate-600">Rp {(prm.minTransaksi || 0).toLocaleString('id-ID')}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#B5C9C9]/20 text-[#1E4648] border border-[#B5C9C9] px-2 py-0.5 rounded text-[10px] font-bold">
                        Berlaku
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {currentRole === 'MANAGER' ? (
                        <>
                          <button onClick={() => handleOpenEditPromo(prm)} className="p-1 text-slate-500 hover:text-slate-600" title="Edit Promo">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleHapusPromo(prm.idPromo)} className="p-1 text-rose-500 hover:text-rose-700" title="Hapus Promo">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
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
          <h3 className="font-bold text-slate-600 text-sm flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#FF9500]" />
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
              <p className="text-[10px] text-slate-400 mt-1">Nominal potongan harga yang diberikan untuk setiap penukaran 1 Poin.</p>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const res = await runBackend<{success: boolean, message: string}>('savePoinConfig', Number(poinRate) || 10000, Number(poinValue) || 1000);
                alert(res?.message || 'Pengaturan poin loyalitas berhasil disimpan!');
              } catch (err) {
                alert('Gagal menyimpan konfigurasi poin!');
              }
            }}
            className="w-full bg-[#1E4648] text-white font-semibold py-2 rounded-md transition"
          >
            Simpan Konfigurasi Poin
          </button>
        </div>
      )}

      {/* =========================================
            TAB PRIORITAS & SLA
        ========================================= */}
      {activeSubTab === 'Prioritas' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm p-4 md:p-5">
          <div className="max-w-3xl">
            <h2 className="text-sm font-extrabold text-slate-700 mb-2">Pengaturan Prioritas & SLA Dinamis</h2>
            <p className="text-xs text-slate-500 mb-6">Tambahkan level prioritas layanan sebanyak apa pun yang Anda mau. Waktu selesai (SLA) dihitung dari saat pesanan masuk, dan Pengali Harga akan dikalikan dengan subtotal dari item kategori Layanan (produk fisik dikecualikan).</p>
            
            <div className="space-y-4">
              {priorityLevels.map((level, idx) => (
                <div key={level.id || idx} className="grid grid-cols-12 gap-3 p-4 border border-slate-200 rounded-lg bg-slate-50 relative items-start group">
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Nama Level</label>
                    <input type="text" value={level.nama} onChange={e => handlePriorityChange(idx, 'nama', e.target.value)} placeholder="e.g. Super VIP" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-[#1E4648] outline-none" />
                    <p className="text-[10px] text-slate-400 mt-1">Contoh: Reguler, Express, Kilat.</p>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">SLA Waktu (Jam)</label>
                    <input type="number" value={level.sla} onChange={e => handlePriorityChange(idx, 'sla', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-[#1E4648] outline-none" />
                    <p className="text-[10px] text-slate-400 mt-1">Estimasi pengerjaan sejak pesanan dibuat.</p>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Pengali Harga (x)</label>
                    <input type="number" step="0.1" value={level.multiplier} onChange={e => handlePriorityChange(idx, 'multiplier', e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:border-[#1E4648] outline-none" />
                    <p className="text-[10px] text-slate-400 mt-1">Isi 1 untuk harga normal, 2 untuk harga dua kali lipat.</p>
                  </div>
                  <div className="col-span-12 sm:col-span-2 flex items-center justify-end sm:mt-5">
                    <button 
                      onClick={() => handleRemovePriorityLevel(idx)} 
                      className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition"
                      title="Hapus Level"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={handleAddPriorityLevel}
                  className="bg-white border-2 border-dashed border-slate-300 hover:border-[#1E4648] hover:text-[#1E4648] text-slate-500 px-4 py-2.5 rounded-lg text-xs font-bold transition flex justify-center items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Tambah Level Prioritas
                </button>
                <button 
                  onClick={handleSavePriority}
                  disabled={prioritySaving}
                  className="bg-[#1E4648] hover:bg-[#163536] text-white px-6 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {prioritySaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  {prioritySaving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-600">{editingId ? 'Edit Layanan' : 'Tambah Layanan Baru'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Layanan *</label>
                <input type="text" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Cuci Karpet..." className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                <p className="text-[10px] text-slate-400 mt-1">Nama yang akan tampil di struk dan kasir.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori *</label>
                <select value={kategori} onChange={(e) => setKategori(e.target.value as any)} className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]">
                  <option value="Self Service">Self Service (Cuci Sendiri)</option>
                  <option value="Drop Off">Drop Off (Cuci & Setrika, dll)</option>
                  <option value="Add On">Add On (Setrika, Parfum, Kantong, dll)</option>
                  <option value="Makanan dan Minuman">Makanan dan Minuman</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Pengali harga (SLA) hanya berlaku untuk Layanan utama (Self Service & Drop Off).</p>
              </div>

              {(kategori === 'Self Service' || kategori === 'Drop Off') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipe Layanan</label>
                  <select value={tipe} onChange={(e) => setTipe(e.target.value as 'SelfService' | 'FullService')} className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]">
                    <option value="SelfService">Self Service (Cuci Sendiri)</option>
                    <option value="FullService">Full Service (Cuci & Setrika)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Mengelompokkan layanan pada daftar antrean dan laporan.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga *</label>
                  <input type="number" value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                  <p className="text-[10px] text-slate-400 mt-1">Harga dasar per satuan.</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input type="text" value={satuan} onChange={(e) => setSatuan(e.target.value)} placeholder="paket / kg" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                  <p className="text-[10px] text-slate-400 mt-1">Contoh: kg, pc, paket.</p>
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
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-600">{editingPromoId ? 'Edit Voucher Promo' : 'Buat Voucher Promo Baru'}</h3>
              <button onClick={() => setShowPromoModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Voucher *</label>
                <input type="text" value={kodePromo} onChange={(e) => setKodePromo(e.target.value)} placeholder="LAUNDRYMEMBER" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] uppercase font-sans font-bold" />
                <p className="text-[10px] text-slate-400 mt-1">Kode unik yang dimasukkan kasir saat checkout.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nilai Potongan Diskon (Rp) *</label>
                <input type="number" value={nilaiDiskon} onChange={(e) => setNilaiDiskon(e.target.value)} placeholder="10000" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                <p className="text-[10px] text-slate-400 mt-1">Nominal potongan harga tetap.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Syarat Minimum Transaksi (Rp)</label>
                <input type="number" value={minTx} onChange={(e) => setMinTx(e.target.value)} placeholder="50000" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                <p className="text-[10px] text-slate-400 mt-1">Kosongkan atau isi 0 jika tanpa syarat belanja minimal.</p>
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
