'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, User, Check, X } from 'lucide-react';
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
  const [layananList, setLayananList] = useState<LayananItem[]>(defaultLayanan);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [customer, setCustomer] = useState<{ nama: string; noHp: string }>({ nama: '', noHp: '' });
  
  // Modals
  const [showCustModal, setShowCustModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [selectedPetugas, setSelectedPetugas] = useState('');
  const [estimasi, setEstimasi] = useState('');
  const [custNamaInput, setCustNamaInput] = useState('');
  const [custNoHpInput, setCustNoHpInput] = useState('');

  useEffect(() => {
    runBackend('getLayananList')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) setLayananList(res);
      })
      .catch(() => {});

    runBackend('getPegawaiList')
      .then((res) => {
        if (Array.isArray(res)) setPegawaiList(res);
      })
      .catch(() => {});
  }, []);

  const filteredLayanan = layananList.filter(l => 
    l.tipe === mode && l.layanan.toLowerCase().includes(search.toLowerCase().trim())
  );

  const updateCart = (item: LayananItem, delta: number) => {
    setCart((prev) => {
      const copy = { ...prev };
      const currentQty = copy[item.layanan] ? copy[item.layanan].qty : 0;
      const nextQty = currentQty + delta;

      if (nextQty <= 0) {
        delete copy[item.layanan];
      } else {
        copy[item.layanan] = {
          layanan: item.layanan,
          hargaSatuan: item.hargaSatuan,
          qty: nextQty,
        };
      }
      return copy;
    });
  };

  const clearCart = () => {
    setCart({});
  };

  const cartArray = Object.values(cart);
  const grandTotal = cartArray.reduce((acc, i) => acc + (i.qty * i.hargaSatuan), 0);

  const handleProcessCheckout = () => {
    if (cartArray.length === 0) {
      alert('⚠️ Keranjang belanja masih kosong!');
      return;
    }
    setCustNamaInput(customer.nama);
    setCustNoHpInput(customer.noHp);

    const defaultNames = pegawaiList.length > 0
      ? pegawaiList.map(p => p.nama + (p.jabatan ? ` (${p.jabatan})` : ''))
      : ['Siti Rahma (Kasir)', 'Budi Santoso (Operator)', 'Manager / Owner (Manager)'];

    if (!selectedPetugas && defaultNames.length > 0) {
      setSelectedPetugas(defaultNames[0]);
    }
    setShowCheckoutModal(true);
  };

  const handleConfirmSave = async () => {
    if (!custNamaInput.trim()) {
      alert('⚠️ Nama pelanggan wajib diisi!');
      return;
    }

    const payload = {
      namaPelanggan: custNamaInput.trim(),
      noHp: custNoHpInput.trim(),
      petugas: selectedPetugas || 'Kasir 1',
      tipe: mode,
      estimasi: estimasi,
      items: cartArray,
      total: grandTotal
    };

    if (navigator.onLine) {
      try {
        const res = await runBackend('simpanTransaksi', payload);
        if (res && res.success) {
          alert(`🎉 Transaksi Berhasil! Nota: ${res.noNota}`);
          const txObj: Transaksi = {
            noNota: res.noNota,
            tanggal: new Date().toLocaleString('id-ID'),
            namaPelanggan: payload.namaPelanggan,
            noHp: payload.noHp,
            petugas: payload.petugas,
            tipe: payload.tipe,
            total: payload.total,
            status: 'Diterima',
            items: payload.items
          };
          saveLocalTxCache(txObj);
          setCart({});
          setCustomer({ nama: '', noHp: '' });
          setShowCheckoutModal(false);
          return;
        }
      } catch (err) {
        // Fallback to offline outbox
      }
    }

    // OFFLINE SYNC ENGINE FALLBACK:
    const offlineItem = addToPendingOutbox(payload);
    const localTx: Transaksi = {
      noNota: offlineItem.id,
      tanggal: new Date().toLocaleString('id-ID') + ' (Offline)',
      namaPelanggan: payload.namaPelanggan,
      noHp: payload.noHp,
      petugas: payload.petugas,
      tipe: payload.tipe,
      total: payload.total,
      status: 'Diterima',
      items: payload.items
    };
    saveLocalTxCache(localTx);

    alert(`📶 Mode Offline: Transaksi disimpan lokal (Nota: ${offlineItem.id}). Otomatis tersinkron saat internet tersambung!`);
    setCart({});
    setCustomer({ nama: '', noHp: '' });
    setShowCheckoutModal(false);
  };

  return (
    <div className="pos-container flex gap-4 h-[calc(100vh-84px)] overflow-hidden p-4">
      {/* LEFT: Catalog Grid & Search */}
      <div className="pos-left flex-1 flex flex-col min-w-0 overflow-y-auto pr-1">
        {/* Toggle Service Mode & Search */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-4 flex items-center justify-between gap-3 shadow-sm flex-wrap">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setMode('SelfService')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                mode === 'SelfService'
                  ? 'bg-[#1E4648] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🫧 Self Service
            </button>
            <button
              onClick={() => setMode('FullService')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                mode === 'FullService'
                  ? 'bg-[#1E4648] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👔 Full Service
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari layanan..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"
            />
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredLayanan.map((item, idx) => {
            const qtyInCart = cart[item.layanan] ? cart[item.layanan].qty : 0;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between relative group"
              >
                {qtyInCart > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#1E4648] text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                    {qtyInCart}
                  </span>
                )}
                <div>
                  <div className="text-3xl mb-2">{item.icon || '🫧'}</div>
                  <h3 className="font-extrabold text-xs text-slate-800 leading-snug mb-1">
                    {item.layanan}
                  </h3>
                  <div className="text-xs font-bold text-[#1E4648]">
                    Rp {item.hargaSatuan.toLocaleString('id-ID')}
                    <span className="text-[10px] font-normal text-slate-400">/{item.satuan || 'kg'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100">
                  {qtyInCart > 0 ? (
                    <>
                      <button
                        onClick={() => updateCart(item, -1)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 rounded-lg text-xs flex items-center justify-center"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-xs font-extrabold text-slate-800">{qtyInCart}</span>
                      <button
                        onClick={() => updateCart(item, 1)}
                        className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-1.5 rounded-lg text-xs flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => updateCart(item, 1)}
                      className="w-full bg-teal-50 hover:bg-[#1E4648] text-[#1E4648] hover:text-white font-extrabold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Live Cart Bill Panel (Moka Style) */}
      <div className="pos-right w-[360px] bg-white rounded-2xl border border-slate-200 flex flex-col shrink-0 shadow-sm overflow-hidden">
        {/* Customer Header */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => setShowCustModal(true)}
            className="text-xs font-bold text-[#1E4648] bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 hover:bg-teal-100 transition"
          >
            <User className="w-3.5 h-3.5" />
            <span>{customer.nama ? customer.nama : '+ Add Customer'}</span>
          </button>
          <span className="text-[10px] font-extrabold bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-lg uppercase">
            {mode}
          </span>
        </div>

        {/* Cart List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cartArray.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
              <div className="text-4xl mb-2">🧺</div>
              <div className="text-xs font-bold">Keranjang Kosong</div>
              <div className="text-[11px] text-slate-400">Pilih layanan di sebelah kiri</div>
            </div>
          ) : (
            cartArray.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                <div className="flex-1 pr-2">
                  <div className="font-extrabold text-xs text-slate-800">{item.layanan}</div>
                  <div className="text-[11px] text-slate-400">
                    Rp {item.hargaSatuan.toLocaleString('id-ID')} x {item.qty}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-xs text-[#1E4648]">
                    Rp {(item.qty * item.hargaSatuan).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Charge Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="flex justify-between items-center text-xs font-bold text-slate-500">
            <span>Subtotal</span>
            <span>Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
            <span>TOTAL</span>
            <span className="text-base text-[#1E4648]">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={clearCart}
              disabled={cartArray.length === 0}
              className="p-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition disabled:opacity-40"
              title="Clear Sale"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleProcessCheckout}
              disabled={cartArray.length === 0}
              className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-extrabold py-3 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <CreditCard className="w-4 h-4" />
              <span>Charge Rp {grandTotal.toLocaleString('id-ID')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK CUSTOMER MODAL */}
      {showCustModal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 my-auto">
            <div className="text-base font-extrabold text-slate-900 mb-4 flex items-center justify-between">
              <span>👤 Data Pelanggan</span>
              <button onClick={() => setShowCustModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Nama Pelanggan</label>
                <input
                  type="text"
                  value={customer.nama}
                  onChange={(e) => setCustomer({ ...customer, nama: e.target.value })}
                  placeholder="Masukkan nama pelanggan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">No HP / WhatsApp</label>
                <input
                  type="tel"
                  value={customer.noHp}
                  onChange={(e) => setCustomer({ ...customer, noHp: e.target.value })}
                  placeholder="08..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCustModal(false)} className="bg-slate-100 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs">
                Batal
              </button>
              <button onClick={() => setShowCustModal(false)} className="bg-[#1E4648] text-white font-bold px-4 py-2 rounded-xl text-xs">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL WITH SEARCHABLE PETUGAS COMBOBOX */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 my-auto text-left">
            <div className="text-base font-extrabold text-slate-900 mb-3 flex items-center justify-between">
              <span>💳 Proses Transaksi</span>
              <button onClick={() => setShowCheckoutModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            {/* Cart Table Breakdown */}
            <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-2 text-xs">
              {cartArray.map((i, idx) => (
                <div key={idx} className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1.5">
                  <span className="font-bold text-slate-800">{i.layanan} x{i.qty}</span>
                  <span className="font-extrabold text-[#1E4648]">Rp {(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</span>
                </div>
              ))}
              <div className="flex justify-between font-black text-sm text-slate-900 pt-1">
                <span>TOTAL</span>
                <span className="text-[#1E4648]">Rp {grandTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Nama Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={custNamaInput}
                  onChange={(e) => setCustNamaInput(e.target.value)}
                  placeholder="Masukkan nama pelanggan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">No HP / WhatsApp</label>
                <input
                  type="tel"
                  value={custNoHpInput}
                  onChange={(e) => setCustNoHpInput(e.target.value)}
                  placeholder="08..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Nama Petugas <span className="text-red-500">*</span>
                  </label>
                  <input
                    list="petugasNextDatalist"
                    value={selectedPetugas}
                    onChange={(e) => setSelectedPetugas(e.target.value)}
                    placeholder="🔍 Cari / pilih nama..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648] bg-white"
                    autoComplete="off"
                  />
                  <datalist id="petugasNextDatalist">
                    {pegawaiList.map((p, idx) => (
                      <option key={idx} value={`${p.nama}${p.jabatan ? ` (${p.jabatan})` : ''}`} />
                    ))}
                    <option value="Siti Rahma (Kasir)" />
                    <option value="Budi Santoso (Operator Laundry)" />
                    <option value="Manager / Owner (Manager)" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Estimasi Selesai</label>
                  <input
                    type="date"
                    value={estimasi}
                    onChange={(e) => setEstimasi(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="bg-slate-100 text-slate-600 font-bold px-4 py-2.5 rounded-xl text-xs"
              >
                ← Kembali
              </button>
              <button
                onClick={handleConfirmSave}
                className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-extrabold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Konfirmasi & Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
