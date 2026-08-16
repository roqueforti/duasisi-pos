'use client';

import React, { useState, useEffect } from 'react';
import { Tag, Plus, RefreshCw, Trash2, Edit3, RotateCcw, X, TagIcon, Gift, Download, Upload, Zap, ArrowUp, ArrowDown } from 'lucide-react';
import { runBackend } from '@/lib/api';
import { toCSV, downloadCSV, parseCSV, readFileAsText } from '@/lib/csvUtils';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

interface LayananItemBackend {
  id: string;
  nama: string;
  harga: number;
  satuan: string;
  icon: string;
  aktif: string;
  tipe: 'SelfService' | 'FullService' | '';
  kategori?: string;
  pipelineSteps?: any[];
}

export interface CustomPipelineStep {
  step: number;
  nama: string;
  needStaff: boolean;
  needMesin: boolean;
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
  const { showAlert, showConfirm, showPrompt } = useDialog();
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
  const [tipe, setTipe] = useState<'SelfService' | 'FullService' | ''>('');
  const [kategori, setKategori] = useState<string>('Self Service');
  const [kategoriList, setKategoriList] = useState<{id: string, nama: string, aktif: string}[]>([]);
  
  // Pipeline Steps selection
  const [customPipelineSteps, setCustomPipelineSteps] = useState<CustomPipelineStep[]>([]);
  const [masterPipelineSteps, setMasterPipelineSteps] = useState<CustomPipelineStep[]>([]);
  const [showMasterStepModal, setShowMasterStepModal] = useState(false);

  // Add Promo Modal State
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [kodePromo, setKodePromo] = useState('');
  const [nilaiDiskon, setNilaiDiskon] = useState('10000');
  const [minTx, setMinTx] = useState('50000');

  // Loyalty Settings
  const [poinRate, setPoinRate] = useState('10000');

  // Priority Settings (Removed)

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
      const config = await runBackend<{rate: number}>('getPoinConfig');
      if (config) {
        setPoinRate(config.rate.toString());
      }
    } catch (err) {
      console.error('Gagal memuat konfigurasi poin:', err);
    }
  };
  // Priority Config Logic (Removed)
  const loadMasterPipelineSteps = async () => {
    try {
      const data = await runBackend<CustomPipelineStep[]>('getPipelineConfigData');
      if (Array.isArray(data)) {
        setMasterPipelineSteps(data);
      }
    } catch (err) {
      console.error('Gagal memuat master langkah:', err);
    }
  };

  const loadPromo = async () => {
    try {
      const data = await runBackend<PromoVoucher[]>('getPromoList');
      if (Array.isArray(data) && data.length > 0) setPromoList(data);
    } catch (err) {
      console.error('Gagal memuat promo:', err);
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
    loadProduk();
    loadPromo();
    loadPoinConfig();
    loadKategori();
    loadMasterPipelineSteps();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNama(''); setHarga(''); setSatuan('paket'); setIcon('🧺'); setTipe(''); setKategori('Self Service');
    setCustomPipelineSteps([]);
    setShowModal(true);
  };

  const handleOpenEdit = (item: LayananItemBackend & { kategori?: any }) => {
    setEditingId(item.id);
    setNama(item.nama);
    setHarga(item.harga.toString());
    setSatuan(item.satuan || 'kg');
    setIcon(item.icon || '🧺');
    setTipe(item.tipe || '');
    setKategori(item.kategori || 'Self Service');
    setCustomPipelineSteps(item.pipelineSteps ? (item.pipelineSteps as CustomPipelineStep[]) : []);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nama.trim() || !harga.trim()) { await showAlert('Nama dan harga wajib diisi!', 'warning'); return; }
    const payloadPipeline = customPipelineSteps.map((s, i) => ({ ...s, step: i + 1 }));
    const payload = { nama: nama.trim(), harga: Number(harga) || 0, satuan, icon, tipe, kategori, pipelineSteps: tipe === 'FullService' ? payloadPipeline : [] };
    setLoading(true);
    try {
      if (editingId) {
        await runBackend('updateLayanan', editingId, payload);
      } else {
        await runBackend('tambahLayanan', payload);
      }
      setShowModal(false);
      loadProduk();
      await showAlert('Layanan berhasil disimpan!', 'success');
    } catch (err) {
      await showAlert('Gagal menyimpan layanan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAktif = async (id: string, isY: boolean) => {
    try {
      await runBackend('toggleAktifLayanan', id, !isY);
      loadProduk();
      await showAlert(`Layanan berhasil di${isY ? 'nonaktifkan' : 'aktifkan'}!`, 'success');
    } catch (err) {
      await showAlert('Gagal mengubah status', 'error');
    }
  };

  const handleHapusLayanan = async (id: string) => {
    const isConfirmed = await showConfirm('Yakin ingin menghapus layanan ini?');
    if (!isConfirmed) return;
    try {
      await runBackend('hapusLayanan', id);
      loadProduk();
      await showAlert('Layanan berhasil dihapus!', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus layanan', 'error');
    }
  };

  const handleSavePromo = async () => {
    if (!kodePromo.trim()) { await showAlert('Kode promo wajib diisi!', 'warning'); return; }
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
      await showAlert(`Promo ${payload.kodeVoucher} berhasil disimpan ke database!`, 'success');
    } catch (err) {
      await showAlert('Gagal menyimpan promo ke backend', 'error');
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
    const isConfirmed = await showConfirm('Yakin hapus voucher promo ini?');
    if (!isConfirmed) return;
    try {
      await runBackend('hapusPromo', id);
      loadPromo();
      await showAlert('Promo berhasil dihapus!', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus promo', 'error');
    }
  };

  const handleExportProduk = () => {
    const rows = layananList.map(l => [l.nama, l.kategori || 'Self Service', l.harga, l.tipe || 'Bukan Layanan', l.aktif === 'Y' ? 'Aktif' : 'Non-Aktif']);
    downloadCSV('export_produk.csv', toCSV(['Nama Layanan', 'Kategori', 'Harga', 'Tipe', 'Status'], rows));
  };

  const handleDownloadTemplateProduk = () => {
    downloadCSV('template_produk_kosong.csv', toCSV(
      ['Nama Layanan', 'Kategori', 'Harga', 'Tipe', 'Status'],
      [['Cuci Karpet', 'Self Service', 15000, 'SelfService', 'Aktif']]
    ));
  };

  const handleImportProduk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) { await showAlert('File CSV kosong atau format salah.', 'warning'); return; }
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
            nama: String(row['Nama Layanan'] || row['nama'] || '').trim(),
            kategori: String(row['Kategori'] || row['kategori'] || 'Self Service').trim(),
            harga: Number(row['Harga'] || row['harga']) || 0,
            satuan: '',
            icon: '🧺',
            tipe: (row['Tipe'] || row['tipe'] || '').trim().toLowerCase() === 'bukan layanan' ? '' : (row['Tipe'] || row['tipe'] || '').trim(),
          });
          if (id && !aktifVal) await runBackend('toggleAktifLayanan', id, false);
          success++;
        } catch { fail++; }
      }
      loadProduk();
      await showAlert(`Import selesai: ${success} berhasil${fail > 0 ? `, ${fail} gagal` : ''}.`, 'info');
    } catch (err) {
      await showAlert('Gagal membaca file CSV.', 'error');
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
                  <th className="py-3 px-4">Nama Produk / Layanan</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Tipe</th>
                  <th className="py-3 px-4">Tarif</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-12" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : layananList.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-400">Belum ada data layanan</td></tr>
                ) : (
                  layananList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-600 flex items-center gap-2">
                        <span>{item.nama}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-medium">
                        {item.kategori || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${!item.tipe || (item.tipe as string).toLowerCase() === 'bukan layanan' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                          {!item.tipe || (item.tipe as string).toLowerCase() === 'bukan layanan' ? 'Bukan Layanan' : item.tipe}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-[#1E4648]">
                        Rp {(item?.harga || 0).toLocaleString('id-ID')}
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
          </div>

          <button
            onClick={async () => {
              try {
                const res = await runBackend<{success: boolean, message: string}>('savePoinConfig', Number(poinRate) || 10000);
                await showAlert(res?.message || 'Pengaturan poin loyalitas berhasil disimpan!', 'success');
              } catch (err) {
                await showAlert('Gagal menyimpan konfigurasi poin!', 'error');
              }
            }}
            className="w-full bg-[#1E4648] text-white font-semibold py-2 rounded-md transition"
          >
            Simpan Konfigurasi Poin
          </button>
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
                <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]">
                  {kategoriList.map(kat => (
                    <option key={kat.id} value={kat.nama}>{kat.nama}</option>
                  ))}
                  {kategoriList.length === 0 && <option value="Self Service">Self Service</option>}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Pengali harga (SLA) hanya berlaku untuk Layanan utama (Self Service & Drop Off).</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe Layanan (Opsional)</label>
                <select value={tipe} onChange={(e) => setTipe(e.target.value as 'SelfService' | 'FullService' | '')} className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]">
                  <option value="">Bukan Layanan / Kosong</option>
                  <option value="SelfService">Self Service</option>
                  <option value="FullService">Drop Off</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Mengelompokkan layanan pada daftar antrean dan laporan.</p>
              </div>

              {tipe === 'FullService' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Langkah Pengerjaan (Pipeline)</label>
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
                    {customPipelineSteps.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Belum ada langkah pipeline.</p>
                    ) : (
                      customPipelineSteps.map((step, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-2.5 bg-white border border-slate-200 rounded-md shadow-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700">Langkah {idx + 1}: {step.nama}</span>
                            <div className="flex gap-1">
                              <button onClick={() => {
                                if (idx > 0) {
                                  const newArr = [...customPipelineSteps];
                                  [newArr[idx - 1], newArr[idx]] = [newArr[idx], newArr[idx - 1]];
                                  setCustomPipelineSteps(newArr);
                                }
                              }} className="p-1 text-slate-400 hover:text-slate-600" title="Naik"><ArrowUp className="w-3.5 h-3.5" /></button>
                              <button onClick={() => {
                                if (idx < customPipelineSteps.length - 1) {
                                  const newArr = [...customPipelineSteps];
                                  [newArr[idx + 1], newArr[idx]] = [newArr[idx], newArr[idx + 1]];
                                  setCustomPipelineSteps(newArr);
                                }
                              }} className="p-1 text-slate-400 hover:text-slate-600" title="Turun"><ArrowDown className="w-3.5 h-3.5" /></button>
                              <button onClick={() => {
                                setCustomPipelineSteps(customPipelineSteps.filter((_, i) => i !== idx));
                              }} className="p-1 text-rose-400 hover:text-rose-600" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          <div className="flex gap-4 text-[10px] text-slate-500 font-semibold">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={step.needStaff} onChange={e => {
                                const newArr = [...customPipelineSteps];
                                newArr[idx].needStaff = e.target.checked;
                                setCustomPipelineSteps(newArr);
                              }} className="rounded border-slate-300 text-[#1E4648] focus:ring-[#1E4648]" />
                              Wajib Input Pegawai
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={step.needMesin} onChange={e => {
                                const newArr = [...customPipelineSteps];
                                newArr[idx].needMesin = e.target.checked;
                                setCustomPipelineSteps(newArr);
                              }} className="rounded border-slate-300 text-[#1E4648] focus:ring-[#1E4648]" />
                              Wajib Pilih Mesin
                            </label>
                          </div>
                        </div>
                      ))
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[11px] font-bold text-slate-600 mb-2">Pilih dari Master Langkah:</p>
                      <div className="flex flex-wrap gap-2">
                        {masterPipelineSteps.map((mst, i) => {
                          const isSelected = customPipelineSteps.some(c => c.nama === mst.nama);
                          return (
                            <label key={i} className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md cursor-pointer transition select-none ${isSelected ? 'bg-[#1E4648]/10 border-[#1E4648] text-[#1E4648]' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCustomPipelineSteps(prev => [...prev, { step: prev.length + 1, nama: mst.nama, needStaff: mst.needStaff, needMesin: mst.needMesin }]);
                                  } else {
                                    setCustomPipelineSteps(prev => prev.filter(c => c.nama !== mst.nama));
                                  }
                                }} 
                              />
                              <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-[#1E4648] border-[#1E4648]' : 'border-slate-300'}`}>
                                {isSelected && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <span className="text-[11px] font-semibold">{mst.nama}</span>
                            </label>
                          );
                        })}
                      </div>
                      <button onClick={async (e) => {
                        e.preventDefault();
                        const namaLangkah = await showPrompt("Masukkan nama langkah manual:", "Contoh: Lipat Ekstra");
                        if (namaLangkah) {
                          setCustomPipelineSteps(prev => [...prev, { step: prev.length + 1, nama: namaLangkah.trim(), needStaff: false, needMesin: false }]);
                        }
                      }} className="mt-3 text-[10px] font-bold text-slate-500 hover:text-[#1E4648] hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Tambah Manual
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Atur urutan proses spesifik untuk produk ini.</p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Harga *</label>
                <input type="number" value={harga} onChange={(e) => setHarga(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]" />
                <p className="text-[10px] text-slate-400 mt-1">Harga jual produk atau layanan.</p>
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
