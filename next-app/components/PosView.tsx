'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  User, 
  Tag as TagIcon, 
  X,
  Lock,
  Unlock,
  Sparkles,
  WashingMachine,
  Package,
  Coffee,
  Receipt,
  CreditCard
} from 'lucide-react';
import { LayananItem, CartItem, ShiftKasir } from '@/lib/types';

interface CustomerState {
  nama: string;
  noHp: string;
}

const defaultLayanan: LayananItem[] = [
  { layanan: 'Cuci + Kering 7,5 Kg (45 Mnt)', hargaSatuan: 18000, tipe: 'SelfService', satuan: 'paket', kategori: 'Layanan' },
  { layanan: 'Cuci 7,5 Kg', hargaSatuan: 10000, tipe: 'SelfService', satuan: 'paket', kategori: 'Layanan' },
  { layanan: 'Pengering (15 Menit)', hargaSatuan: 5000, tipe: 'SelfService', satuan: 'paket', kategori: 'Layanan' },
  { layanan: 'Cuci + Kering 4,5 Kg (45 Mnt)', hargaSatuan: 13000, tipe: 'SelfService', satuan: 'paket', kategori: 'Layanan' },
  { layanan: 'Cuci 4,5 Kg', hargaSatuan: 7000, tipe: 'SelfService', satuan: 'paket', kategori: 'Layanan' },
  { layanan: 'Layanan Setrika Uap Express', hargaSatuan: 12000, tipe: 'FullService', satuan: 'paket', kategori: 'Layanan Tambahan' },
  { layanan: 'Deterjen Cair', hargaSatuan: 1000, tipe: 'SelfService', satuan: 'porsi', kategori: 'Produk' },
  { layanan: 'Softener Premium', hargaSatuan: 1000, tipe: 'SelfService', satuan: 'porsi', kategori: 'Produk' },
  { layanan: 'Kresek Besar', hargaSatuan: 1000, tipe: 'SelfService', satuan: 'pcs', kategori: 'Produk' },
  { layanan: 'Air Mineral 600ml', hargaSatuan: 3000, tipe: 'SelfService', satuan: 'botol', kategori: 'MakananMinuman' },
  { layanan: 'Kopi Hitam / Teh Warm', hargaSatuan: 4000, tipe: 'SelfService', satuan: 'cangkir', kategori: 'MakananMinuman' },
];

function getLayananStyleConfig(name: string) {
  if (name.includes('Softener') || name.includes('Deterjen') || name.includes('Kresek')) {
    return { Icon: Package };
  }
  if (name.includes('Air') || name.includes('Kopi') || name.includes('Teh')) {
    return { Icon: Coffee };
  }
  if (name.includes('Setrika') || name.includes('Express')) {
    return { Icon: Sparkles };
  }
  return { Icon: WashingMachine };
}

export default function PosView() {
  const [layananList, setLayananList] = useState<LayananItem[]>(defaultLayanan);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'SelfService' | 'FullService'>('SelfService');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'Semua' | 'Layanan' | 'Layanan Tambahan' | 'Produk' | 'MakananMinuman'>('Semua');
  
  // Cart & Order State
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [customer, setCustomer] = useState<CustomerState>({ nama: '', noHp: '' });
  const [diskonApplied, setDiskonApplied] = useState<{ kode: string; nilai: number }>({ kode: '', nilai: 0 });

  // Modals
  const [showCustModal, setShowCustModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showBukaShiftModal, setShowBukaShiftModal] = useState(false);
  const [showTutupShiftModal, setShowTutupShiftModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);

  // Shift & Kas
  const [shiftAktif, setShiftAktif] = useState<ShiftKasir | null>({
    idShift: 'SHIFT-DEMO',
    idUser: 'U1',
    namaKasir: 'Kasir 1',
    kasAwal: 100000,
    waktuBuka: new Date().toISOString(),
    status: 'Buka',
    totalOmzetTunai: 0
  });

  const [kasAwalInput, setKasAwalInput] = useState('100000');
  const [kasAkhirFisik, setKasAkhirFisik] = useState('');

  // Custom Item Modal Form
  const [customItemForm, setCustomItemForm] = useState({
    nama: '',
    harga: '',
    kategori: 'Layanan Utama'
  });

  const updateCart = (item: LayananItem, delta: number) => {
    setCart((prev) => {
      const existing = prev[item.layanan];
      const newQty = (existing ? existing.qty : 0) + delta;
      
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[item.layanan];
        return next;
      }

      return {
        ...prev,
        [item.layanan]: {
          layanan: item.layanan,
          hargaSatuan: item.hargaSatuan,
          qty: newQty,
          catatan: existing ? existing.catatan : ''
        }
      };
    });
  };

  const clearCart = () => {
    setCart({});
    setDiskonApplied({ kode: '', nilai: 0 });
  };

  const cartArray = Object.values(cart);
  const subtotalCart = cartArray.reduce((acc, curr) => acc + (curr.qty * curr.hargaSatuan), 0);
  const grandTotal = Math.max(0, subtotalCart - diskonApplied.nilai);

  const handleBukaShift = () => {
    const nominal = Number(kasAwalInput) || 0;
    setShiftAktif({
      idShift: `SHIFT-${Date.now()}`,
      idUser: 'U1',
      namaKasir: 'Kasir 1',
      kasAwal: nominal,
      waktuBuka: new Date().toISOString(),
      status: 'Buka',
      totalOmzetTunai: 0
    });
    setShowBukaShiftModal(false);
  };

  const handleTutupShift = () => {
    setShiftAktif(null);
    setShowTutupShiftModal(false);
  };

  const handleProcessCheckout = () => {
    if (cartArray.length === 0) return;
    if (!shiftAktif) {
      alert('Shift Kasir belum dibuka! Buka shift terlebih dahulu.');
      setShowBukaShiftModal(true);
      return;
    }
    setShowCheckoutModal(true);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-3 sm:p-4 min-h-[calc(100vh-56px)] bg-slate-100/70 overflow-hidden w-full">
      {/* LEFT: Main Catalog Panel (RestroBit Clean White Card Container) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        
        {/* Top Header Bar: Search & Action Header */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-white">
          <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk / layanan..."
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648] bg-slate-50/50 focus:bg-white transition"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Service Mode Segmented Control */}
            <div className="hidden sm:flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0">
              <button
                onClick={() => setMode('SelfService')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  mode === 'SelfService' ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Self Service
              </button>
              <button
                onClick={() => setMode('FullService')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  mode === 'FullService' ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full Service
              </button>
            </div>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCustomItemModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Baru</span>
            </button>

            {shiftAktif ? (
              <button
                onClick={() => setShowTutupShiftModal(true)}
                className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Shift (Rp {shiftAktif.kasAwal.toLocaleString('id-ID')})</span>
              </button>
            ) : (
              <button
                onClick={() => setShowBukaShiftModal(true)}
                className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>Buka Shift</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Row (Matches RestroBit reference image!) */}
        <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar bg-slate-50/30">
          {[
            { id: 'Semua', label: 'Semua Produk' },
            { id: 'Layanan', label: 'Layanan Utama' },
            { id: 'Layanan Tambahan', label: 'Layanan Tambahan' },
            { id: 'Produk', label: 'Produk Laundry' },
            { id: 'MakananMinuman', label: 'Makanan & Minuman' },
          ].map((tab) => {
            const isActive = selectedCategoryTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategoryTab(tab.id as any)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 border ${
                  isActive
                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid (Matching RestroBit circular icon top & bold price) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 md:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
            {(() => {
              const renderCard = (item: LayananItem, idx: number) => {
                const qtyInCart = cart[item.layanan] ? cart[item.layanan].qty : 0;
                const effectivePrice = item.hargaSatuan;
                const styleCfg = getLayananStyleConfig(item.layanan);
                const IconComp = styleCfg.Icon;

                return (
                  <div
                    key={idx}
                    onClick={() => updateCart(item, 1)}
                    className={`aspect-square bg-white rounded-2xl border p-2.5 sm:p-3 flex flex-col items-center justify-between text-center transition-all duration-200 cursor-pointer relative select-none hover:-translate-y-0.5 hover:shadow-md ${
                      qtyInCart > 0 
                        ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/20' 
                        : 'border-slate-200/80 shadow-2xs hover:border-slate-300'
                    }`}
                  >
                    {/* Qty Badge Top Right */}
                    {qtyInCart > 0 && (
                      <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-2xs z-10">
                        {qtyInCart}
                      </span>
                    )}

                    {/* Centered Circular Icon Container (Aspect-Square 1:1 Optimized) */}
                    <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-inner text-[#1E4648] mt-0.5">
                      <IconComp className="w-5 h-5 sm:w-6 sm:h-6 text-[#1E4648]" />
                    </div>

                    {/* Product Name */}
                    <h3 className="font-bold text-[11px] sm:text-xs text-slate-800 leading-tight line-clamp-2 px-0.5 my-auto">
                      {item.layanan}
                    </h3>

                    {/* Price */}
                    <div className="text-[11px] sm:text-xs font-extrabold text-amber-600 mb-1">
                      Rp {effectivePrice.toLocaleString('id-ID')}
                    </div>

                    {/* Bottom Action: Stepper or Plus Button */}
                    <div className="w-full pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      {qtyInCart > 0 ? (
                        <div className="flex items-center justify-between bg-slate-50 p-0.5 rounded-xl border border-amber-200">
                          <button
                            onClick={() => updateCart(item, -1)}
                            className="w-5 h-5 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-bold rounded-lg flex items-center justify-center border border-slate-200 transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-[11px] font-bold text-slate-800 px-1">{qtyInCart}</span>
                          <button
                            onClick={() => updateCart(item, 1)}
                            className="w-5 h-5 bg-amber-500 text-white font-bold rounded-lg flex items-center justify-center hover:bg-amber-600 transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateCart(item, 1)}
                          className="w-full bg-slate-50 hover:bg-amber-500 text-slate-700 hover:text-white border border-slate-200/80 font-bold py-1 rounded-xl text-[11px] transition flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Pilih</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              };

              const filterLower = search.toLowerCase().trim();
              const filteredAll = (layananList || []).filter((i) => i.layanan.toLowerCase().includes(filterLower));

              if (selectedCategoryTab !== 'Semua') {
                const tabFiltered = filteredAll.filter((i) => {
                  if (selectedCategoryTab === 'Layanan') return i.kategori === 'Layanan';
                  if (selectedCategoryTab === 'Layanan Tambahan') return i.kategori === 'Layanan Tambahan';
                  if (selectedCategoryTab === 'Produk') return i.kategori === 'Produk';
                  if (selectedCategoryTab === 'MakananMinuman') return i.kategori === 'MakananMinuman';
                  return true;
                });

                if (tabFiltered.length === 0) {
                  return (
                    <div className="col-span-full text-center py-12 text-slate-400 text-xs">
                      Tidak ada produk ditemukan dalam kategori ini.
                    </div>
                  );
                }

                return (
                  <div className="col-span-full grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                    {tabFiltered.map((item, idx) => renderCard(item, idx))}
                  </div>
                );
              }

              return filteredAll.map((item, idx) => renderCard(item, idx));
            })()}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart / Order Panel (Matches RestroBit Order #20 layout!) */}
      <div className="bg-white flex flex-col w-full md:w-[340px] lg:w-[360px] border border-slate-200/80 rounded-2xl shrink-0 overflow-hidden shadow-2xs">
        {/* Header: Order # & Customer Select */}
        <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-800">Order #20</h2>
          </div>
          <button
            onClick={() => setShowCustModal(true)}
            className="text-xs font-semibold text-[#1E4648] bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl flex items-center gap-1.5 hover:bg-slate-100 transition"
          >
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span>{customer.nama || 'Pilih Pelanggan'}</span>
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/40">
          {cartArray.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <ShoppingCart className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-xs font-bold text-slate-600">Keranjang Kosong</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Pilih produk di katalog sebelah kiri</div>
            </div>
          ) : (
            cartArray.map((item, idx) => (
              <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">{item.layanan}</h4>
                    <div className="text-xs font-extrabold text-amber-600 mt-0.5">
                      Rp {item.hargaSatuan.toLocaleString('id-ID')} × {item.qty} = Rp {(item.qty * item.hargaSatuan).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <button
                    onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, -item.qty)}
                    className="text-rose-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                    title="Hapus Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg p-0.5">
                    <button
                      onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, -1)}
                      className="w-5 h-5 bg-white text-slate-600 font-bold rounded flex items-center justify-center border border-slate-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-slate-800 px-1">{item.qty}</span>
                    <button
                      onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, 1)}
                      className="w-5 h-5 bg-amber-500 text-white font-bold rounded flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.catatan || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCart(prev => ({
                        ...prev,
                        [item.layanan]: { ...prev[item.layanan], catatan: val }
                      }));
                    }}
                    placeholder="+ Catatan"
                    className="text-[11px] px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-500 text-right w-24"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Financial Summary (Subtotal, Promo, Total) */}
        <div className="p-4 border-t border-slate-200/80 bg-white space-y-2">
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Sub total :</span>
              <span className="font-bold text-slate-800">Rp {subtotalCart.toLocaleString('id-ID')}</span>
            </div>
            {diskonApplied.nilai > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Diskon Promo :</span>
                <span className="font-bold">-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Voucher Coupon :</span>
              <span className="font-bold text-slate-800">Rp 0</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
            <span>Total :</span>
            <span className="text-lg font-black text-slate-900">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={clearCart}
              disabled={cartArray.length === 0}
              className="p-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl transition disabled:opacity-40 border border-slate-200/80"
              title="Kosongkan keranjang"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleProcessCheckout}
              disabled={cartArray.length === 0}
              className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-xs"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proses Bayar Rp {grandTotal.toLocaleString('id-ID')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Customer Modal */}
      {showCustModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm border border-slate-100 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#1E4648]" />
                <span className="text-sm font-bold text-slate-800">Data Pelanggan</span>
              </div>
              <button onClick={() => setShowCustModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">No HP / WhatsApp *</label>
                <input 
                  type="tel" 
                  value={customer.noHp} 
                  onChange={(e) => setCustomer({ ...customer, noHp: e.target.value })} 
                  placeholder="08..." 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1E4648]" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pelanggan *</label>
                <input 
                  type="text" 
                  value={customer.nama} 
                  onChange={(e) => setCustomer({ ...customer, nama: e.target.value })} 
                  placeholder="Masukkan nama pelanggan" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1E4648]" 
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCustModal(false)} className="w-full bg-[#1E4648] text-white font-bold py-2.5 rounded-xl text-xs">
                Simpan Pelanggan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-100 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-slate-800">Proses Pembayaran Order</span>
              <button onClick={() => setShowCheckoutModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 mb-4 space-y-2 text-xs border border-slate-200/80">
              {cartArray.map((i, idx) => (
                <div key={idx} className="flex justify-between border-b border-slate-200/60 pb-1.5 last:border-0">
                  <span className="text-slate-700 font-medium">{i.layanan} ×{i.qty}</span>
                  <span className="font-bold text-[#1E4648]">Rp {(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</span>
                </div>
              ))}
              <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Tagihan</span>
                <span className="text-amber-600">Rp {grandTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowCheckoutModal(false)} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold">
                Batal
              </button>
              <button 
                onClick={() => {
                  alert('Pembayaran sukses diselesaikan!');
                  clearCart();
                  setShowCheckoutModal(false);
                }} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-sm"
              >
                Selesaikan Pembayaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buka Shift Modal */}
      {showBukaShiftModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Buka Shift Kasir Baru</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kas Awal Laci (Rp)</label>
                <input
                  type="number"
                  value={kasAwalInput}
                  onChange={(e) => setKasAwalInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1E4648] font-bold"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBukaShiftModal(false)} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold">
                Batal
              </button>
              <button onClick={handleBukaShift} className="flex-1 bg-[#1E4648] text-white font-bold py-2.5 rounded-xl text-xs">
                Mulai Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutup Shift Modal */}
      {showTutupShiftModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Tutup Shift Kasir</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hitung Kas Fisik (Rp)</label>
                <input
                  type="number"
                  value={kasAkhirFisik}
                  onChange={(e) => setKasAkhirFisik(e.target.value)}
                  placeholder="100000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1E4648] font-bold"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTutupShiftModal(false)} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold">
                Batal
              </button>
              <button onClick={handleTutupShift} className="flex-1 bg-[#1E4648] text-white font-bold py-2.5 rounded-xl text-xs">
                Selesaikan Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Item Modal */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Tambah Produk / Layanan Manual</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Item *</label>
                <input
                  type="text"
                  value={customItemForm.nama}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, nama: e.target.value })}
                  placeholder="Contoh: Cuci Karpet"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Satuan (Rp) *</label>
                <input
                  type="number"
                  value={customItemForm.harga}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, harga: e.target.value })}
                  placeholder="15000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCustomItemModal(false)} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold">
                Batal
              </button>
              <button 
                onClick={() => {
                  if (!customItemForm.nama || !customItemForm.harga) return;
                  const newItem: LayananItem = {
                    layanan: customItemForm.nama,
                    hargaSatuan: Number(customItemForm.harga) || 0,
                    tipe: 'SelfService',
                    kategori: 'Layanan'
                  };
                  setLayananList(prev => [newItem, ...prev]);
                  updateCart(newItem, 1);
                  setShowCustomItemModal(false);
                }} 
                className="flex-1 bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs"
              >
                Tambah Ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
