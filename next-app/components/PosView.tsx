'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, User, X, Check, CreditCard } from 'lucide-react';
import { LayananItem, CartItem, Pegawai, Transaksi } from '@/lib/types';
import { runBackend } from '@/lib/api';
import { addToPendingOutbox, saveLocalTxCache } from '@/lib/syncEngine';

const defaultLayanan: LayananItem[] = [
  { layanan: 'Cuci 7.5 Kg', hargaSatuan: 10000, tipe: 'SelfService', satuan: 'kg', icon: '🫧' },
  { layanan: 'Cuci + Kering 7.5 Kg (All-in)', hargaSatuan: 18000, tipe: 'SelfService', satuan: 'paket', icon: '🧺' },
  { layanan: 'Deterjen Sachet', hargaSatuan: 1500, tipe: 'SelfService', satuan: 'pcs', icon: '🧴' },
  { layanan: 'Softener', hargaSatuan: 1500, tipe: 'SelfService', satuan: 'pcs', icon: '🌸' },
  { layanan: 'Cuci Komplit Kilat 7.5 Kg', hargaSatuan: 25000, tipe: 'FullService', satuan: 'paket', icon: '👔' },
  { layanan: 'Setrika Saja 7.5 Kg', hargaSatuan: 12000, tipe: 'FullService', satuan: 'kg', icon: '👔' },
  { layanan: 'Plastik Packing Laundry', hargaSatuan: 2000, tipe: 'SelfService', satuan: 'pcs', icon: '📦' }
];

export default function PosView() {
  const [mode, setMode] = useState<'SelfService' | 'FullService'>('SelfService');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [layananList, setLayananList] = useState<LayananItem[]>(defaultLayanan);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [customer, setCustomer] = useState<{ nama: string; noHp: string }>({ nama: '', noHp: '' });
  
  const [showCustModal, setShowCustModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [selectedPetugas, setSelectedPetugas] = useState('');
  const [estimasi, setEstimasi] = useState('');
  const [custNamaInput, setCustNamaInput] = useState('');
  const [custNoHpInput, setCustNoHpInput] = useState('');

  useEffect(() => {
    setLoading(true);
    runBackend('getLayananList')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          const mapped: LayananItem[] = res.map((item: any) => ({
            layanan: item.nama || item.layanan || '',
            hargaSatuan: item.harga ?? item.hargaSatuan ?? 0,
            tipe: item.tipe || 'SelfService',
            satuan: item.satuan || 'pcs',
            icon: item.icon || '🧺',
          }));
          setLayananList(mapped);
        }
      })
      .catch(() => {
        console.warn('[POS] Backend unreachable, using default layanan list.');
      })
      .finally(() => setLoading(false));

    runBackend('getPegawaiList')
      .then((res) => {
        if (Array.isArray(res)) setPegawaiList(res);
      })
      .catch(() => {});
  }, []);

  const filteredLayanan = (layananList || []).filter(l => 
    l && l.tipe === mode && (l.layanan || '').toLowerCase().includes((search || '').toLowerCase().trim())
  );

  const updateCart = (item: LayananItem, delta: number) => {
    setCart((prev) => {
      const copy = { ...prev };
      const currentQty = copy[item.layanan] ? copy[item.layanan].qty : 0;
      const nextQty = currentQty + delta;
      if (nextQty <= 0) {
        delete copy[item.layanan];
      } else {
        copy[item.layanan] = { layanan: item.layanan, hargaSatuan: item.hargaSatuan, qty: nextQty };
      }
      return copy;
    });
  };

  const clearCart = () => setCart({});
  const cartArray = Object.values(cart);
  const grandTotal = cartArray.reduce((acc, i) => acc + (i.qty * i.hargaSatuan), 0);

  const handleProcessCheckout = () => {
    if (cartArray.length === 0) { alert('Keranjang masih kosong!'); return; }
    setCustNamaInput(customer.nama);
    setCustNoHpInput(customer.noHp);
    const defaultNames = pegawaiList.length > 0
      ? pegawaiList.map(p => p.nama + (p.jabatan ? ` (${p.jabatan})` : ''))
      : ['Siti Rahma (Kasir)', 'Budi Santoso (Operator)', 'Manager / Owner (Manager)'];
    if (!selectedPetugas && defaultNames.length > 0) setSelectedPetugas(defaultNames[0]);
    setShowCheckoutModal(true);
  };

  const handleConfirmSave = async () => {
    if (!custNamaInput.trim()) { alert('Nama pelanggan wajib diisi!'); return; }
    const payload = {
      namaPelanggan: custNamaInput.trim(), noHp: custNoHpInput.trim(),
      petugas: selectedPetugas || 'Kasir 1', tipe: mode, estimasi, items: cartArray, total: grandTotal
    };

    if (navigator.onLine) {
      try {
        const res = await runBackend('simpanTransaksi', payload);
        if (res && res.success) {
          alert(`Transaksi Berhasil! Nota: ${res.noNota}`);
          const txObj: Transaksi = {
            noNota: res.noNota, tanggal: new Date().toLocaleString('id-ID'),
            namaPelanggan: payload.namaPelanggan, noHp: payload.noHp, petugas: payload.petugas,
            tipe: payload.tipe, total: payload.total, status: 'Diterima', items: payload.items
          };
          saveLocalTxCache(txObj);
          setCart({}); setCustomer({ nama: '', noHp: '' }); setShowCheckoutModal(false);
          return;
        }
      } catch (err) {}
    }
    const offlineItem = addToPendingOutbox(payload);
    const localTx: Transaksi = {
      noNota: offlineItem.id, tanggal: new Date().toLocaleString('id-ID') + ' (Offline)',
      namaPelanggan: payload.namaPelanggan, noHp: payload.noHp, petugas: payload.petugas,
      tipe: payload.tipe, total: payload.total, status: 'Diterima', items: payload.items
    };
    saveLocalTxCache(localTx);
    alert(`Mode Offline: Transaksi disimpan lokal (${offlineItem.id}). Sinkron otomatis saat online.`);
    setCart({}); setCustomer({ nama: '', noHp: '' }); setShowCheckoutModal(false);
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-56px)] overflow-hidden">
      {/* LEFT: Catalog */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Category tabs + Search */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center gap-4 flex-wrap">
          <div className="flex bg-slate-100 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => setMode('SelfService')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${
                mode === 'SelfService' ? 'bg-[#1E4648] text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Self Service
            </button>
            <button
              onClick={() => setMode('FullService')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${
                mode === 'FullService' ? 'bg-[#1E4648] text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Service
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari layanan..."
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100" />
                  <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              ))
            ) : (
              filteredLayanan.map((item, idx) => {
                const qtyInCart = cart[item.layanan] ? cart[item.layanan].qty : 0;
                return (
                  <div
                    key={idx}
                    className={`bg-white rounded-lg border p-4 flex flex-col justify-between transition-colors cursor-pointer ${
                      qtyInCart > 0 ? 'border-[#1E4648] bg-teal-50/30' : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => updateCart(item, 1)}
                  >
                    {qtyInCart > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#1E4648] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {qtyInCart}
                      </span>
                    )}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-xl mb-3">
                        {item.icon || '🧺'}
                      </div>
                      <h3 className="font-semibold text-xs text-slate-800 leading-snug mb-1">{item.layanan}</h3>
                      <div className="text-xs font-bold text-[#1E4648]">
                        Rp {item.hargaSatuan.toLocaleString('id-ID')}
                        <span className="text-[10px] font-normal text-slate-400 ml-0.5">/{item.satuan || 'kg'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-slate-100">
                      {qtyInCart > 0 ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-1.5 rounded-md text-xs flex items-center justify-center transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-bold text-slate-800">{qtyInCart}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                            className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-medium py-1.5 rounded-md text-xs flex items-center justify-center transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                          className="w-full bg-slate-50 hover:bg-[#1E4648] text-slate-600 hover:text-white font-medium py-1.5 rounded-md text-xs transition flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Tambah
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Order Panel */}
      <div className="w-[340px] bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden">
        {/* Order Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Order</h2>
          <button
            onClick={() => setShowCustModal(true)}
            className="text-[11px] font-medium text-[#1E4648] bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md flex items-center gap-1 hover:bg-teal-100 transition"
          >
            <User className="w-3 h-3" />
            {customer.nama || 'Pelanggan'}
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cartArray.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <div className="text-3xl mb-2">🧺</div>
              <div className="text-xs font-medium text-slate-500">Keranjang kosong</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Pilih layanan di sebelah kiri</div>
            </div>
          ) : (
            <div className="space-y-0">
              {cartArray.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex-1 pr-2">
                    <div className="font-medium text-xs text-slate-800">{item.layanan}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Rp {item.hargaSatuan.toLocaleString('id-ID')} × {item.qty}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-[#1E4648]">
                    Rp {(item.qty * item.hargaSatuan).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total & Buttons */}
        <div className="px-4 py-3 border-t border-slate-200 space-y-3">
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>Subtotal ({cartArray.reduce((a, b) => a + b.qty, 0)} item)</span>
            <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-slate-800 pt-2 border-t border-slate-200">
            <span>Total</span>
            <span className="text-base text-[#1E4648]">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={clearCart}
              disabled={cartArray.length === 0}
              className="p-2.5 bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-500 rounded-md transition disabled:opacity-30"
              title="Hapus semua"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleProcessCheckout}
              disabled={cartArray.length === 0}
              className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-semibold py-2.5 rounded-md text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-30"
            >
              <CreditCard className="w-4 h-4" />
              Bayar Rp {grandTotal.toLocaleString('id-ID')}
            </button>
          </div>
        </div>
      </div>

      {/* Customer Modal */}
      {showCustModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm animate-pop-scale">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-800">Data Pelanggan</span>
              <button onClick={() => setShowCustModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nama</label>
                <input type="text" value={customer.nama} onChange={(e) => setCustomer({ ...customer, nama: e.target.value })} placeholder="Nama pelanggan" className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">No HP</label>
                <input type="tel" value={customer.noHp} onChange={(e) => setCustomer({ ...customer, noHp: e.target.value })} placeholder="08..." className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCustModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">Batal</button>
              <button onClick={() => setShowCustModal(false)} className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-4 py-2 rounded-md text-xs">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto animate-pop-scale">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-800">Proses Pembayaran</span>
              <button onClick={() => setShowCheckoutModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            {/* Item summary */}
            <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-2 text-xs border border-slate-100">
              {cartArray.map((i, idx) => (
                <div key={idx} className="flex justify-between border-b border-slate-200/50 pb-1.5 last:border-0">
                  <span className="text-slate-700">{i.layanan} ×{i.qty}</span>
                  <span className="font-semibold text-[#1E4648]">Rp {(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-sm text-slate-800 pt-1">
                <span>Total</span>
                <span className="text-[#1E4648]">Rp {grandTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Nama Pelanggan *</label>
                <input type="text" value={custNamaInput} onChange={(e) => setCustNamaInput(e.target.value)} placeholder="Nama pelanggan" className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">No HP</label>
                <input type="tel" value={custNoHpInput} onChange={(e) => setCustNoHpInput(e.target.value)} placeholder="08..." className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Petugas *</label>
                  <input list="petugasDatalist" value={selectedPetugas} onChange={(e) => setSelectedPetugas(e.target.value)} placeholder="Cari petugas..." className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" autoComplete="off" />
                  <datalist id="petugasDatalist">
                    {pegawaiList.map((p, idx) => (<option key={idx} value={`${p.nama}${p.jabatan ? ` (${p.jabatan})` : ''}`} />))}
                    <option value="Siti Rahma (Kasir)" />
                    <option value="Budi Santoso (Operator Laundry)" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Estimasi Selesai</label>
                  <input type="date" value={estimasi} onChange={(e) => setEstimasi(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5 pt-3 border-t border-slate-100">
              <button onClick={() => setShowCheckoutModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">Batal</button>
              <button onClick={handleConfirmSave} className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-semibold py-2 rounded-md text-xs transition flex items-center justify-center gap-1">
                <Check className="w-4 h-4" /> Konfirmasi & Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
