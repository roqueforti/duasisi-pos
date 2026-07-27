'use client';

import React, { useState, useEffect } from 'react';
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
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Printer,
  QrCode,
  FileText,
  Send,
  Clock,
  Check,
  ChevronRight,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { LayananItem, CartItem, ShiftKasir } from '@/lib/types';

interface CustomerState {
  nama: string;
  noHp: string;
  alamat?: string;
  memberStatus?: string;
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
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'Semua' | 'Layanan' | 'Layanan Tambahan' | 'Produk' | 'MakananMinuman'>('Semua');
  
  // 1. Cart & Order State
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [customer, setCustomer] = useState<CustomerState>({ nama: '', noHp: '' });
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [voucherMsg, setVoucherMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [diskonApplied, setDiskonApplied] = useState<{ kode: string; nilai: number }>({ kode: '', nilai: 0 });

  // Order Details Form State
  const [tipeLayanan, setTipeLayanan] = useState<'SelfService' | 'FullService'>('SelfService');
  const [estimasiSelesai, setEstimasiSelesai] = useState<string>('Hari ini, 17.00 WIB');
  const [catatanOrderInput, setCatatanOrderInput] = useState<string>('');

  // Payment Form State
  const [namaKasirInput, setNamaKasirInput] = useState('Kasir 1');
  const [metodeBayar, setMetodeBayar] = useState<'Tunai' | 'QRIS' | 'Transfer' | 'Debit'>('Tunai');
  const [uangBayarInput, setUangBayarInput] = useState<string>('');
  const [qrisStatus, setQrisStatus] = useState<'PENDING' | 'SUCCESS'>('PENDING');
  const [refNoInput, setRefNoInput] = useState<string>('');

  // Post Payment & Receipt State
  const [completedOrderData, setCompletedOrderData] = useState<any>(null);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'label'>('58mm');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals for the 8-Step Flow:
  const [showTambahItemModal, setShowTambahItemModal] = useState<boolean>(false);
  const [itemModalTarget, setItemModalTarget] = useState<LayananItem | null>(null);
  const [itemModalQty, setItemModalQty] = useState<number>(1);
  const [itemModalCatatan, setItemModalCatatan] = useState<string>('');

  const [showCustModal, setShowCustModal] = useState<boolean>(false);
  const [searchCust, setSearchCust] = useState<string>('');
  const [showAddCustForm, setShowAddCustForm] = useState<boolean>(false);
  const [newCustNama, setNewCustNama] = useState<string>('');
  const [newCustNoHp, setNewCustNoHp] = useState<string>('');
  const [newCustAlamat, setNewCustAlamat] = useState<string>('');
  const [customerList, setCustomerList] = useState<CustomerState[]>([
    { nama: 'Budi Santoso', noHp: '081234567890', memberStatus: 'Member Gold', alamat: 'Jl. Melati No. 12' },
    { nama: 'Siti Rahma', noHp: '085712345678', memberStatus: 'Regular', alamat: 'Jl. Mawar No. 45' },
    { nama: 'Agus Wijaya', noHp: '082198765432', memberStatus: 'Member Silver', alamat: 'Griya Asri B3/10' },
  ]);

  const [showDetailTransaksiModal, setShowDetailTransaksiModal] = useState<boolean>(false);
  const [showKonfirmasiBayarModal, setShowKonfirmasiBayarModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [showPreviewStrukModal, setShowPreviewStrukModal] = useState<boolean>(false);

  const [showBukaShiftModal, setShowBukaShiftModal] = useState<boolean>(false);
  const [showTutupShiftModal, setShowTutupShiftModal] = useState<boolean>(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState<boolean>(false);
  const [showMobileCart, setShowMobileCart] = useState<boolean>(false);

  // Shift & Kas State
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
  const [customItemForm, setCustomItemForm] = useState({
    layanan: '',
    hargaSatuan: '',
    kategori: 'Layanan' as LayananItem['kategori']
  });

  // Calculate totals
  const cartArray = Object.values(cart);
  const totalCartItems = cartArray.reduce((acc, curr) => acc + curr.qty, 0);
  const subtotalCart = cartArray.reduce((acc, curr) => acc + (curr.qty * curr.hargaSatuan), 0);
  const grandTotal = Math.max(0, subtotalCart - diskonApplied.nilai);

  // Toast Auto Clear
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Cart Helper
  const updateCart = (layanan: LayananItem, delta: number, catatanOverride?: string) => {
    setCart((prev) => {
      const existing = prev[layanan.layanan];
      const newQty = (existing ? existing.qty : 0) + delta;
      
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[layanan.layanan];
        return copy;
      }
      
      return {
        ...prev,
        [layanan.layanan]: {
          layanan: layanan.layanan,
          hargaSatuan: layanan.hargaSatuan,
          qty: newQty,
          tipe: layanan.tipe,
          satuan: layanan.satuan,
          catatan: catatanOverride !== undefined ? catatanOverride : (existing?.catatan || '')
        }
      };
    });
  };

  const clearCart = () => {
    setCart({});
    setDiskonApplied({ kode: '', nilai: 0 });
    setVoucherInput('');
    setVoucherMsg(null);
  };

  // Voucher Application
  const handleApplyVoucher = () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherMsg({ type: 'error', text: 'Masukkan kode voucher terlebih dahulu' });
      return;
    }
    if (code === 'HEMAT10' || code === 'DUASISI') {
      const pot = Math.round(subtotalCart * 0.1);
      setDiskonApplied({ kode: code, nilai: pot });
      setVoucherMsg({ type: 'success', text: `Voucher ${code} terpasang (Diskon 10% - Rp ${pot.toLocaleString('id-ID')})` });
    } else {
      setVoucherMsg({ type: 'error', text: 'Kode voucher tidak valid' });
    }
  };

  // Open "Tambah Item" detail modal for items needing notes
  const openItemDetailModal = (item: LayananItem) => {
    setItemModalTarget(item);
    setItemModalQty(cart[item.layanan]?.qty || 1);
    setItemModalCatatan(cart[item.layanan]?.catatan || '');
    setShowTambahItemModal(true);
  };

  const handleSaveItemModal = () => {
    if (itemModalTarget) {
      updateCart(itemModalTarget, itemModalQty - (cart[itemModalTarget.layanan]?.qty || 0), itemModalCatatan);
    }
    setShowTambahItemModal(false);
  };

  // Step 3: Handle Add New Customer Sub-Form
  const handleAddNewCustomer = () => {
    if (!newCustNama.trim() || !newCustNoHp.trim()) {
      alert('Nama dan No. HP Pelanggan wajib diisi!');
      return;
    }
    const newEntry: CustomerState = {
      nama: newCustNama.trim(),
      noHp: newCustNoHp.trim(),
      alamat: newCustAlamat.trim() || undefined,
      memberStatus: 'Baru'
    };
    setCustomerList([newEntry, ...customerList]);
    setCustomer(newEntry);
    setShowAddCustForm(false);
    setNewCustNama('');
    setNewCustNoHp('');
    setNewCustAlamat('');
    setShowCustModal(false);
  };

  // Step 5: Confirm Payment & Complete Transaction
  const handleConfirmPayment = () => {
    const trxId = `TRX-${Date.now().toString().slice(-6)}`;
    const kasir = namaKasirInput || 'Kasir 1';
    const custName = customer.nama || 'Pelanggan Umum';
    const total = grandTotal;
    const bayar = Number(uangBayarInput) || total;
    const returnChange = Math.max(0, bayar - total);

    const summary = {
      trxId,
      kasir,
      pelanggan: custName,
      noHp: customer.noHp || '-',
      metodeBayar,
      total,
      uangBayar: bayar,
      kembalian: returnChange,
      items: [...cartArray],
      catatan: catatanOrderInput,
      tipeLayanan,
      estimasiSelesai,
      waktu: new Date().toLocaleTimeString('id-ID') + ' WIB',
      tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    setCompletedOrderData(summary);
    setShowKonfirmasiBayarModal(false);
    setShowSuccessModal(true);
  };

  // Step 8: Return to POS Main Page
  const handleCompleteFlowAndReset = () => {
    const trxId = completedOrderData?.trxId || 'TRX-POS';
    clearCart();
    setCatatanOrderInput('');
    setUangBayarInput('');
    setShowSuccessModal(false);
    setShowPreviewStrukModal(false);
    setCompletedOrderData(null);
    setToastMsg(`Transaksi #${trxId} berhasil disimpan! Siap terima order berikutnya.`);
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-3 p-3 sm:p-4 bg-slate-50 relative overflow-hidden text-slate-800">
      
      {/* Toast Notification Banner (Step 8) */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-[999] bg-[#2d4d38] text-white px-4 py-3 rounded-2xl shadow-2xl border border-teal-600/40 flex items-center gap-2.5 animate-bounce-in max-w-sm text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="ml-auto p-1 text-teal-200 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* LEFT: Catalog & Filter Section */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200/80 shrink-0 overflow-hidden shadow-2xs">
        
        {/* Search & Header Controls */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center bg-white">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk / layanan..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs outline-none focus:border-[#2d4d38] focus:bg-white transition"
            />
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCustomItemModal(true)}
              className="bg-[#2d4d38] hover:bg-[#213b2a] text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Baru</span>
            </button>

            {shiftAktif ? (
              <button
                onClick={() => setShowTutupShiftModal(true)}
                className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Shift (Rp {shiftAktif.kasAwal.toLocaleString('id-ID')})</span>
              </button>
            ) : (
              <button
                onClick={() => setShowBukaShiftModal(true)}
                className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>Buka Shift</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Row (Sajiwa UI Style) */}
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
                    ? 'bg-[#2d4d38] text-white border-[#2d4d38] shadow-2xs font-bold'
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* STEP 1: Product Cards Grid (Aspect Square 1:1, Compact Font, Tap -> Cart / Double Tap -> Note Modal) */}
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
                    onDoubleClick={() => openItemDetailModal(item)}
                    className={`aspect-square bg-white rounded-2xl border p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-200 cursor-pointer relative select-none hover:-translate-y-0.5 hover:shadow-md ${
                      qtyInCart > 0 
                        ? 'border-[#2d4d38] ring-2 ring-[#2d4d38]/20 bg-[#2d4d38]/[0.02]' 
                        : 'border-slate-200/80 shadow-2xs hover:border-slate-300'
                    }`}
                  >
                    {/* Top Container for Image/Icon */}
                    <div className="bg-slate-100/80 rounded-xl flex-1 min-h-0 flex items-center justify-center relative overflow-hidden mb-1.5 group p-1">
                      {/* Status Badge Top-Left */}
                      <span className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-2xs z-10 ${
                        idx % 3 === 0 ? 'bg-amber-500 text-white' : 'bg-[#2d4d38] text-white'
                      }`}>
                        {idx % 3 === 0 ? 'Best' : 'Ready'}
                      </span>

                      {/* Qty Badge Top-Right */}
                      {qtyInCart > 0 && (
                        <span className="absolute top-1.5 right-1.5 bg-[#2d4d38] text-white text-[10px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs z-10">
                          {qtyInCart}
                        </span>
                      )}

                      {/* Circular Centered Icon */}
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white shadow-xs border border-slate-100 flex items-center justify-center text-[#2d4d38] group-hover:scale-105 transition duration-200">
                        <IconComp className="w-4 h-4 sm:w-5 sm:h-5 text-[#2d4d38]" />
                      </div>
                    </div>

                    {/* Product Name */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h3 className="font-bold text-[10px] sm:text-[11px] text-slate-800 leading-tight line-clamp-2 text-left flex-1">
                        {item.layanan}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openItemDetailModal(item);
                        }}
                        className="text-slate-400 hover:text-[#2d4d38] p-0.5 rounded hover:bg-slate-100 shrink-0"
                        title="Tambah Catatan Item"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Price & Action Button Bottom Row */}
                    <div className="flex items-end justify-between pt-1 border-t border-slate-100 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="text-left">
                        <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold block uppercase tracking-wider leading-none mb-0.5">Harga</span>
                        <span className="text-[10px] sm:text-xs font-extrabold text-slate-900 leading-tight">
                          Rp {effectivePrice.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {qtyInCart > 0 ? (
                        <div className="flex items-center gap-0.5 bg-[#2d4d38] text-white p-0.5 rounded-lg shadow-2xs">
                          <button
                            onClick={() => updateCart(item, -1)}
                            className="w-4 h-4 bg-white/20 hover:bg-white/30 text-white font-bold rounded flex items-center justify-center transition"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-[10px] font-bold px-1">{qtyInCart}</span>
                          <button
                            onClick={() => updateCart(item, 1)}
                            className="w-4 h-4 bg-white/20 hover:bg-white/30 text-white font-bold rounded flex items-center justify-center transition"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateCart(item, 1)}
                          className="bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-bold px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] flex items-center gap-0.5 transition shadow-2xs hover:border-slate-300"
                        >
                          <ShoppingCart className="w-3 h-3 text-slate-500" />
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
                return tabFiltered.map(renderCard);
              }

              if (filteredAll.length === 0) {
                return (
                  <div className="col-span-full text-center py-12 text-slate-400 text-xs">
                    Tidak ada produk ditemukan.
                  </div>
                );
              }
              return filteredAll.map(renderCard);
            })()}
          </div>
        </div>
      </div>

      {/* STEP 1 MODAL: "Tambah Item / Edit Catatan Item" */}
      {showTambahItemModal && itemModalTarget && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm border border-slate-100 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">Detail & Catatan Item</h3>
              <button onClick={() => setShowTambahItemModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nama Layanan</label>
                <input type="text" readOnly value={itemModalTarget.layanan} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jumlah (Qty)</label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setItemModalQty(Math.max(1, itemModalQty - 1))}
                    className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 font-bold"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-extrabold text-slate-900 w-8 text-center">{itemModalQty}</span>
                  <button 
                    onClick={() => setItemModalQty(itemModalQty + 1)}
                    className="p-2 bg-[#2d4d38] text-white rounded-xl hover:bg-[#213b2a] font-bold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Catatan Khusus Item (Opsional)</label>
                <textarea
                  rows={2}
                  value={itemModalCatatan}
                  onChange={(e) => setItemModalCatatan(e.target.value)}
                  placeholder="Misal: Jangan pakai pewangi, lipat rapi"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#2d4d38]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowTambahItemModal(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">
                Batal
              </button>
              <button onClick={handleSaveItemModal} className="flex-1 bg-[#2d4d38] text-white rounded-xl text-xs font-bold py-2.5">
                Simpan ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sticky Bottom Bar on Mobile (< 768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[120] bg-[#1E4648] text-white px-3.5 py-2.5 flex items-center justify-between shadow-2xl border-t border-teal-800">
        <div className="flex items-center gap-2.5 min-w-0" onClick={() => setShowMobileCart(true)}>
          <div className="relative shrink-0">
            <ShoppingCart className="w-5 h-5 text-teal-300" />
            {totalCartItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-2xs">
                {totalCartItems}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">
              {totalCartItems > 0 ? `Total: Rp ${grandTotal.toLocaleString('id-ID')}` : 'Keranjang Kosong'}
            </div>
            <div className="text-[10px] text-teal-200/90 truncate">
              {totalCartItems > 0 ? `${totalCartItems} item dipilih` : 'Klik item di atas untuk memilih'}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowMobileCart(true)}
          disabled={totalCartItems === 0}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 shrink-0 shadow-2xs"
        >
          <span>Lihat Order</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {showMobileCart && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-[250] md:hidden animate-fade-in backdrop-blur-xs"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      {/* STEP 2: RIGHT KERANJANG ORDER PANEL (Selalu Terbuka di Desktop/Tablet) */}
      <div className={`fixed inset-0 z-[300] bg-white flex flex-col w-full md:static md:w-[300px] lg:w-[340px] xl:w-[360px] md:z-auto border border-slate-200/80 rounded-2xl shrink-0 overflow-hidden shadow-2xs transition-all duration-200 ${
        showMobileCart ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-0 md:opacity-100 hidden md:flex'
      }`}>
        {/* Header Order & Customer Button */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#2d4d38]" />
            <h2 className="text-sm font-bold text-slate-800">Order Detail</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCustModal(true)}
              className="text-xs font-semibold text-[#2d4d38] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl flex items-center gap-1 hover:bg-slate-100 transition"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="truncate max-w-[100px] sm:max-w-[120px]">{customer.nama || 'Pilih Pelanggan'}</span>
            </button>
            <button
              onClick={() => setShowMobileCart(false)}
              className="md:hidden p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              title="Tutup Keranjang"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Information Badge */}
        <div className="px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pelanggan:</span>
            <span className="font-bold text-slate-800">{customer.nama || 'Pelanggan Umum'}</span>
            {customer.noHp && <span className="text-[10px] text-slate-500 ml-1">({customer.noHp})</span>}
          </div>
          <button onClick={() => setShowCustModal(true)} className="text-[10px] font-bold text-[#2d4d38] hover:underline">
            Ubah
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50/40">
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
                  <div className="flex-1 pr-2">
                    <h4 className="font-bold text-xs text-slate-800 leading-snug">{item.layanan}</h4>
                    <div className="text-[11px] font-bold text-[#2d4d38] mt-0.5">
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

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-lg p-0.5">
                    <button
                      onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, -1)}
                      className="w-5 h-5 bg-white text-slate-600 font-bold rounded flex items-center justify-center border border-slate-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-slate-800 px-1.5">{item.qty}</span>
                    <button
                      onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, 1)}
                      className="w-5 h-5 bg-[#2d4d38] text-white font-bold rounded flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.catatan || ''}
                    onChange={(e) => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, 0, e.target.value)}
                    placeholder="+ Catatan"
                    className="text-[11px] px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#2d4d38] text-right w-24"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Voucher Input Box */}
        <div className="px-3.5 py-2.5 bg-white border-t border-slate-100 space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={voucherInput}
              onChange={(e) => setVoucherInput(e.target.value)}
              placeholder="Kode Voucher (HEMAT10)"
              className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold uppercase outline-none focus:border-[#2d4d38]"
            />
            <button
              onClick={handleApplyVoucher}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition"
            >
              Pasang
            </button>
          </div>
          {voucherMsg && (
            <div className={`text-[10px] font-bold ${voucherMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
              {voucherMsg.text}
            </div>
          )}
        </div>

        {/* Financial Summary & Process Payment Button */}
        <div className="p-4 border-t border-slate-200/80 bg-white space-y-2">
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal :</span>
              <span className="font-bold text-slate-800">Rp {subtotalCart.toLocaleString('id-ID')}</span>
            </div>
            {diskonApplied.nilai > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Diskon ({diskonApplied.kode}) :</span>
                <span className="font-bold">-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
            <span>Total Tagihan :</span>
            <span className="text-lg font-black text-slate-900">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>

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
              onClick={() => setShowDetailTransaksiModal(true)}
              disabled={cartArray.length === 0}
              className="flex-1 bg-[#2d4d38] hover:bg-[#213b2a] text-white font-bold py-3 rounded-2xl text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-md"
            >
              <CreditCard className="w-4 h-4" />
              <span>Proses Bayar Rp {grandTotal.toLocaleString('id-ID')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* STEP 3: MODAL "Pilih Pelanggan" */}
      {showCustModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl p-5 w-full max-w-md border border-slate-100 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#2d4d38]" />
                <h3 className="text-sm font-bold text-slate-800">Pilih Pelanggan</h3>
              </div>
              <button onClick={() => setShowCustModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            {/* Search Bar */}
            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchCust}
                  onChange={(e) => setSearchCust(e.target.value)}
                  placeholder="Cari Nama / No. HP Pelanggan..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#2d4d38]"
                />
              </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
              {customerList
                .filter(c => c.nama.toLowerCase().includes(searchCust.toLowerCase()) || c.noHp.includes(searchCust))
                .map((c, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      setCustomer(c);
                      setShowCustModal(false);
                    }}
                    className="p-3 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 rounded-2xl cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">{c.nama}</div>
                      <div className="text-[11px] text-slate-500">{c.noHp} {c.alamat ? `• ${c.alamat}` : ''}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                      {c.memberStatus || 'Pelanggan'}
                    </span>
                  </div>
                ))}
            </div>

            {/* Add New Customer Toggle Form */}
            {showAddCustForm ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 mt-2">
                <div className="text-xs font-bold text-slate-800">Form Pelanggan Baru</div>
                <input type="text" value={newCustNama} onChange={(e) => setNewCustNama(e.target.value)} placeholder="Nama Lengkap *" className="w-full p-2 border border-slate-200 rounded-xl text-xs" />
                <input type="tel" value={newCustNoHp} onChange={(e) => setNewCustNoHp(e.target.value)} placeholder="No. HP / WhatsApp *" className="w-full p-2 border border-slate-200 rounded-xl text-xs" />
                <input type="text" value={newCustAlamat} onChange={(e) => setNewCustAlamat(e.target.value)} placeholder="Alamat (Opsional)" className="w-full p-2 border border-slate-200 rounded-xl text-xs" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowAddCustForm(false)} className="px-3 py-1.5 bg-slate-200 text-xs font-bold rounded-xl">Batal</button>
                  <button onClick={handleAddNewCustomer} className="flex-1 bg-[#2d4d38] text-white text-xs font-bold py-1.5 rounded-xl">Simpan & Pilih</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowAddCustForm(true)} 
                className="w-full py-2.5 border-2 border-dashed border-[#2d4d38]/40 text-[#2d4d38] font-bold text-xs rounded-2xl hover:bg-emerald-50/50 transition mt-2 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Pelanggan Baru</span>
              </button>
            )}

            <div className="pt-3 mt-3 border-t border-slate-100 flex gap-2">
              <button onClick={() => setShowCustModal(false)} className="w-full py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL "Detail Transaksi & Pembayaran" (Gabungan Sebelum Bayar) */}
      {showDetailTransaksiModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-2xl border border-slate-100 shadow-2xl my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800">Detail Transaksi & Pembayaran</h3>
                <p className="text-[11px] text-slate-500 font-medium">Lengkapi rincian order & pilih metode pembayaran</p>
              </div>
              <button onClick={() => setShowDetailTransaksiModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            {/* Scrollable Content: 2-Column Grid on Desktop */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* COLUMN 1: DETAIL ORDER */}
                <div className="space-y-3.5">
                  <div className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[#2d4d38] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                    <span>1. Detail Order & Customer</span>
                  </div>

                  {/* Staff Kasir Selector / Input */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Staff Memproses *</label>
                    <select
                      value={namaKasirInput}
                      onChange={(e) => setNamaKasirInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-[#2d4d38]"
                    >
                      <option value="Kasir 1">Kasir 1 (Shift Pagi)</option>
                      <option value="Kasir 2">Kasir 2 (Shift Siang)</option>
                      <option value="Kasir 3">Kasir 3 (Shift Malam)</option>
                      <option value="Admin Utama">Admin Utama</option>
                    </select>
                  </div>

                  {/* Customer Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Pelanggan *</label>
                      <input type="text" value={customer.nama} onChange={(e) => setCustomer({ ...customer, nama: e.target.value })} placeholder="Nama Pelanggan" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-[#2d4d38]" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">No. HP / WhatsApp *</label>
                      <input type="tel" value={customer.noHp} onChange={(e) => setCustomer({ ...customer, noHp: e.target.value })} placeholder="08..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-[#2d4d38]" />
                    </div>
                  </div>

                  {/* Tipe Layanan Selection */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tipe Layanan</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipeLayanan('SelfService')}
                        className={`py-2 px-2.5 rounded-xl font-bold border transition text-center text-[11px] ${
                          tipeLayanan === 'SelfService' ? 'bg-[#2d4d38] text-white border-[#2d4d38]' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        Self Service (Cuci Sendiri)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipeLayanan('FullService')}
                        className={`py-2 px-2.5 rounded-xl font-bold border transition text-center text-[11px] ${
                          tipeLayanan === 'FullService' ? 'bg-[#2d4d38] text-white border-[#2d4d38]' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        Full Service (Terima Beres)
                      </button>
                    </div>
                  </div>

                  {/* Estimasi Selesai */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Estimasi Selesai Laundry</label>
                    <input
                      type="text"
                      value={estimasiSelesai}
                      onChange={(e) => setEstimasiSelesai(e.target.value)}
                      placeholder="Hari ini, 17.00 WIB"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-[#2d4d38]"
                    />
                  </div>

                  {/* Catatan Tambahan */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan Order</label>
                    <textarea
                      rows={2}
                      value={catatanOrderInput}
                      onChange={(e) => setCatatanOrderInput(e.target.value)}
                      placeholder="Misal: Jemput jam 5 sore, pisahkan baju putih"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-[#2d4d38]"
                    />
                  </div>

                  {/* Readonly Item List Summary */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5">
                    <div className="font-bold text-slate-800 border-b border-slate-200 pb-1">Ringkasan Item:</div>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {cartArray.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-slate-700 text-[11px]">
                          <span>{i.layanan} ×{i.qty}</span>
                          <span className="font-bold">Rp {(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: PEMBAYARAN */}
                <div className="space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[#2d4d38] pb-1 border-b border-slate-100">
                      2. Pembayaran Transaksi
                    </div>

                    {/* Total Tagihan Banner */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 text-center shadow-inner">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Tagihan:</span>
                      <span className="text-2xl sm:text-3xl font-black text-emerald-400">Rp {grandTotal.toLocaleString('id-ID')}</span>
                    </div>

                    {/* Metode Pembayaran Selection */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1.5">Metode Pembayaran *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'Tunai', label: 'Tunai' },
                          { id: 'QRIS', label: 'QRIS' },
                          { id: 'Transfer', label: 'Transfer Bank' },
                          { id: 'Debit', label: 'Debit / Kartu' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setMetodeBayar(m.id as any)}
                            className={`py-2 px-2 rounded-xl text-xs font-bold transition border text-center ${
                              metodeBayar === m.id ? 'bg-[#2d4d38] text-white border-[#2d4d38]' : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Conditional Tunai Input & Kembalian */}
                    {metodeBayar === 'Tunai' ? (
                      <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <label className="font-bold text-slate-800">Jumlah Uang Diterima (Rp):</label>
                          <input
                            type="number"
                            value={uangBayarInput}
                            onChange={(e) => setUangBayarInput(e.target.value)}
                            placeholder={grandTotal.toString()}
                            className="w-32 px-3 py-1.5 bg-white border border-emerald-300 rounded-xl font-bold outline-none text-right focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div className="flex gap-1.5 overflow-x-auto">
                          <button type="button" onClick={() => setUangBayarInput(grandTotal.toString())} className="px-2 py-1 bg-white border border-emerald-300 rounded-lg font-bold text-emerald-800 text-[10px]">
                            Uang Pas (Rp {grandTotal.toLocaleString('id-ID')})
                          </button>
                          <button type="button" onClick={() => setUangBayarInput('50000')} className="px-2 py-1 bg-white border border-emerald-300 rounded-lg font-bold text-emerald-800 text-[10px]">
                            Rp 50.000
                          </button>
                          <button type="button" onClick={() => setUangBayarInput('100000')} className="px-2 py-1 bg-white border border-emerald-300 rounded-lg font-bold text-emerald-800 text-[10px]">
                            Rp 100.000
                          </button>
                        </div>

                        {Number(uangBayarInput) >= grandTotal && (
                          <div className="flex justify-between items-center text-xs font-bold text-emerald-800 pt-1.5 border-t border-emerald-200">
                            <span>Kembalian:</span>
                            <span className="text-base font-black">
                              Rp {(Number(uangBayarInput) - grandTotal).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Non-Tunai / QRIS UI */
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
                        <div className="w-28 h-28 bg-white border border-slate-300 rounded-xl mx-auto flex items-center justify-center p-2 shadow-xs">
                          <QrCode className="w-20 h-20 text-slate-800" />
                        </div>
                        <div className="text-[11px] font-bold text-slate-800">Scan QRIS Pembayaran Dua SiSi POS</div>
                        <button
                          type="button"
                          onClick={() => {
                            setQrisStatus('SUCCESS');
                            alert('Pembayaran QRIS / Non-Tunai Terverifikasi Berhasil!');
                          }}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition"
                        >
                          Cek Status Pembayaran
                        </button>
                      </div>
                    )}

                    {/* Referensi / No Transaksi */}
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Referensi / No. Transaksi (Optional)</label>
                      <input
                        type="text"
                        value={refNoInput}
                        onChange={(e) => setRefNoInput(e.target.value)}
                        placeholder="Auto-generated (#TRX-XXXXXX)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Action Buttons Footer */}
            <div className="flex gap-3 pt-3 border-t border-slate-100 shrink-0">
              <button 
                type="button"
                onClick={() => setShowDetailTransaksiModal(false)} 
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl text-xs transition shrink-0"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 bg-[#2d4d38] hover:bg-[#213b2a] text-white font-bold py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition"
              >
                <span>Konfirmasi & Selesaikan Bayar</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: MODAL "Pembayaran Berhasil" */}
      {showSuccessModal && completedOrderData && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md border border-slate-100 shadow-2xl my-auto text-center animate-scale-in">
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-base font-bold text-slate-800">Pembayaran Berhasil!</h3>
            <p className="text-xs text-slate-500 font-medium mb-4">Transaksi order telah sukses disimpan</p>

            {/* Summary Box */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5 text-xs text-left space-y-1.5 mb-5">
              <div className="flex justify-between"><span className="text-slate-500">No. Invoice:</span><span className="font-extrabold text-slate-900">{completedOrderData.trxId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Pelanggan:</span><span className="font-bold text-slate-800">{completedOrderData.pelanggan}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Metode Bayar:</span><span className="font-bold text-slate-800">{completedOrderData.metodeBayar}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Dibayar:</span><span className="font-black text-slate-900">Rp {completedOrderData.total.toLocaleString('id-ID')}</span></div>
              {completedOrderData.metodeBayar === 'Tunai' && (
                <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                  <span>Kembalian:</span>
                  <span className="font-black">Rp {completedOrderData.kembalian.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                <span>Waktu:</span>
                <span>{completedOrderData.tanggal} {completedOrderData.waktu}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setShowPreviewStrukModal(true);
                }}
                className="w-full bg-[#2d4d38] hover:bg-[#213b2a] text-white font-bold py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" />
                <span>Preview & Cetak Struk</span>
              </button>

              <button
                onClick={() => {
                  const phone = completedOrderData.noHp.replace(/^0/, '62').replace(/\D/g, '');
                  const waUrl = `https://wa.me/${phone || ''}?text=${encodeURIComponent(`Halo Kak ${completedOrderData.pelanggan}, ini nota resmi transaksi laundry Dua SiSi POS #${completedOrderData.trxId} sebesar Rp ${completedOrderData.total.toLocaleString('id-ID')}. Terima kasih!`)}`;
                  window.open(waUrl, '_blank');
                }}
                className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2.5 rounded-2xl text-xs border border-emerald-200 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Kirim ke WhatsApp Pelanggan</span>
              </button>

              <button
                onClick={handleCompleteFlowAndReset}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-2xl text-xs"
              >
                Selesai (Tanpa Cetak)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 7: MODAL "Preview & Cetak Struk" */}
      {showPreviewStrukModal && completedOrderData && (
        <div className="fixed inset-0 z-[700] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md border border-slate-100 shadow-2xl my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-800">Preview & Cetak Struk</h3>
              <button onClick={() => setShowPreviewStrukModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            {/* Paper Size Format Selector */}
            <div className="py-3 flex items-center gap-2 justify-center shrink-0">
              <span className="text-xs font-bold text-slate-600">Format Kertas:</span>
              {[
                { id: '58mm', label: '58mm Thermal' },
                { id: '80mm', label: '80mm Thermal' },
                { id: 'label', label: 'Label Tag' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPaperSize(p.id as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                    paperSize === p.id ? 'bg-[#2d4d38] text-white border-[#2d4d38]' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Thermal Struk Paper Preview */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 rounded-2xl font-mono text-[11px] leading-tight text-slate-800 space-y-2 border border-slate-200/80 shadow-inner">
              <div className="text-center font-bold">
                <div className="text-sm font-black">DUA SISI LAUNDRY</div>
                <div>Express & Coin Laundry</div>
                <div className="text-[10px] font-normal text-slate-600">Jl. Pemuda No. 88, Jakarta • Telp: 0812345678</div>
                <div className="border-b border-dashed border-slate-400 my-2" />
              </div>

              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between"><span>No TRX :</span><span>{completedOrderData.trxId}</span></div>
                <div className="flex justify-between"><span>Waktu  :</span><span>{completedOrderData.tanggal} {completedOrderData.waktu}</span></div>
                <div className="flex justify-between"><span>Kasir  :</span><span>{completedOrderData.kasir}</span></div>
                <div className="flex justify-between"><span>Cust   :</span><span>{completedOrderData.pelanggan}</span></div>
                <div className="border-b border-dashed border-slate-400 my-2" />
              </div>

              {/* Items List */}
              <div className="space-y-1">
                {completedOrderData.items.map((i: any, idx: number) => (
                  <div key={idx}>
                    <div className="font-bold">{i.layanan}</div>
                    <div className="flex justify-between text-[10px]">
                      <span>{i.qty} x Rp {i.hargaSatuan.toLocaleString('id-ID')}</span>
                      <span>Rp {(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
                <div className="border-b border-dashed border-slate-400 my-2" />
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-0.5 font-bold">
                <div className="flex justify-between"><span>TOTAL :</span><span>Rp {completedOrderData.total.toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span>BAYAR ({completedOrderData.metodeBayar}):</span><span>Rp {completedOrderData.uangBayar.toLocaleString('id-ID')}</span></div>
                {completedOrderData.kembalian > 0 && (
                  <div className="flex justify-between text-emerald-800"><span>KEMBALI :</span><span>Rp {completedOrderData.kembalian.toLocaleString('id-ID')}</span></div>
                )}
                <div className="border-b border-dashed border-slate-400 my-2" />
              </div>

              <div className="text-center text-[10px] font-normal pt-1">
                <div>*** TERIMA KASIH ***</div>
                <div>Pakaian Bersih & Wangi Garansi 100%</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 shrink-0 mt-3">
              <button
                onClick={() => alert(`Mengirim cetak struk format ${paperSize} ke Thermal Printer...`)}
                className="bg-[#2d4d38] hover:bg-[#213b2a] text-white font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk</span>
              </button>

              <button
                onClick={handleCompleteFlowAndReset}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-2xl text-xs"
              >
                Tutup & Selesai
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
                  placeholder="100000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#2d4d38]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBukaShiftModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Batal</button>
              <button onClick={() => {
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
              }} className="flex-1 bg-[#2d4d38] text-white rounded-xl text-xs font-bold py-2">Buka Shift Sekarang</button>
            </div>
          </div>
        </div>
      )}

      {/* Tutup Shift Modal */}
      {showTutupShiftModal && shiftAktif && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Tutup Shift & Rekap Kas Laci</h3>
            <div className="space-y-2 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl">
              <div className="flex justify-between"><span>Kas Awal:</span><span className="font-bold text-slate-800">Rp {shiftAktif.kasAwal.toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between"><span>Waktu Buka:</span><span className="font-bold text-slate-800">{new Date(shiftAktif.waktuBuka).toLocaleTimeString('id-ID')}</span></div>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Total Fisik Kas di Laci (Rp)</label>
                <input
                  type="number"
                  value={kasAkhirFisik}
                  onChange={(e) => setKasAkhirFisik(e.target.value)}
                  placeholder="Hitung jumlah uang fisik di laci"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#2d4d38]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTutupShiftModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Batal</button>
              <button onClick={() => {
                setShiftAktif(null);
                setShowTutupShiftModal(false);
                setKasAkhirFisik('');
                alert('Shift berhasil ditutup & rekap kas laci disimpan!');
              }} className="flex-1 bg-rose-600 text-white rounded-xl text-xs font-bold py-2">Tutup Shift Kasir</button>
            </div>
          </div>
        </div>
      )}

      {/* Tambah Produk Custom Modal */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Tambah Produk / Layanan Baru</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Produk / Layanan *</label>
                <input
                  type="text"
                  value={customItemForm.layanan}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, layanan: e.target.value })}
                  placeholder="Contoh: Cuci Karpet Jumbo"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#2d4d38]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Satuan (Rp) *</label>
                <input
                  type="number"
                  value={customItemForm.hargaSatuan}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, hargaSatuan: e.target.value })}
                  placeholder="25000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:border-[#2d4d38]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCustomItemModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Batal</button>
              <button onClick={() => {
                if (!customItemForm.layanan || !customItemForm.hargaSatuan) {
                  alert('Mohon isi nama dan harga produk!');
                  return;
                }
                const newItem: LayananItem = {
                  layanan: customItemForm.layanan,
                  hargaSatuan: Number(customItemForm.hargaSatuan),
                  tipe: 'SelfService',
                  satuan: 'paket',
                  kategori: customItemForm.kategori
                };
                setLayananList([newItem, ...layananList]);
                setShowCustomItemModal(false);
                setCustomItemForm({ layanan: '', hargaSatuan: '', kategori: 'Layanan' });
              }} className="flex-1 bg-[#2d4d38] text-white rounded-xl text-xs font-bold py-2">Tambah Produk</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
