'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, User, X, Check, CreditCard, Printer, Send, CheckCircle2, DollarSign } from 'lucide-react';
import { LayananItem, CartItem, Pegawai, Transaksi } from '@/lib/types';
import { runBackend } from '@/lib/api';
import { saveLocalTxCache } from '@/lib/syncEngine';

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
  
  // Modals & State
  const [showCustModal, setShowCustModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [lastCompletedTx, setLastCompletedTx] = useState<Transaksi | null>(null);

  // Custom Item Input State
  const [customItemNama, setCustomItemNama] = useState('');
  const [customItemHarga, setCustomItemHarga] = useState('');

  const handleAddCustomItem = () => {
    if (!customItemNama.trim()) { alert('Nama layanan kustom wajib diisi!'); return; }
    const price = Number(customItemHarga);
    if (isNaN(price) || price <= 0) { alert('Harga harus angka lebih dari 0!'); return; }

    const customItem: LayananItem = {
      layanan: customItemNama.trim(),
      hargaSatuan: price,
      tipe: mode,
      satuan: 'item',
      icon: '✨'
    };
    updateCart(customItem, 1);
    setCustomItemNama('');
    setCustomItemHarga('');
    setShowCustomItemModal(false);
  };

  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [selectedPetugas, setSelectedPetugas] = useState('');
  const [estimasi, setEstimasi] = useState('');
  const [custNamaInput, setCustNamaInput] = useState('');
  const [custNoHpInput, setCustNoHpInput] = useState('');
  
  // Payment Method & Cash Change calculation
  const [metodeBayar, setMetodeBayar] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');
  const [uangDibayar, setUangDibayar] = useState<string>('');

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
  const numUangDibayar = Number(uangDibayar) || grandTotal;
  const kembalian = Math.max(0, numUangDibayar - grandTotal);

  const handleProcessCheckout = () => {
    if (cartArray.length === 0) { alert('Keranjang masih kosong!'); return; }
    setCustNamaInput(customer.nama);
    setCustNoHpInput(customer.noHp);
    setUangDibayar(grandTotal.toString());

    const defaultNames = pegawaiList.length > 0
      ? pegawaiList.map(p => p.nama + (p.jabatan ? ` (${p.jabatan})` : ''))
      : ['Siti Rahma (Kasir)', 'Budi Santoso (Operator)', 'Manager / Owner (Manager)'];
    if (!selectedPetugas && defaultNames.length > 0) setSelectedPetugas(defaultNames[0]);
    setShowCheckoutModal(true);
  };

  const handleConfirmSave = async () => {
    if (!custNamaInput.trim()) { alert('Nama pelanggan wajib diisi!'); return; }
    if (metodeBayar === 'Tunai' && numUangDibayar < grandTotal) {
      alert(`Uang dibayar kurang! Minimal Rp ${grandTotal.toLocaleString('id-ID')}`);
      return;
    }

    const payload = {
      namaPelanggan: custNamaInput.trim(),
      noHp: custNoHpInput.trim(),
      petugas: selectedPetugas || 'Kasir 1',
      tipe: mode,
      estimasi: estimasi,
      metodeBayar: metodeBayar,
      uangDibayar: numUangDibayar,
      kembalian: kembalian,
      items: cartArray,
      total: grandTotal
    };

    try {
      const res = await runBackend('simpanTransaksi', payload);
      const noNotaGenerated = res?.noNota || `LDY-${Date.now().toString().slice(-6)}`;
      
      const completedTxObj: Transaksi = {
        noNota: noNotaGenerated,
        tanggal: new Date().toLocaleString('id-ID'),
        namaPelanggan: payload.namaPelanggan,
        noHp: payload.noHp,
        petugas: payload.petugas,
        tipe: payload.tipe,
        total: payload.total,
        status: 'Diterima',
        items: payload.items
      };
      saveLocalTxCache(completedTxObj);
      setLastCompletedTx(completedTxObj);
      setShowCheckoutModal(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('[POS] Simpan transaksi gagal:', err);
      alert('Gagal menyimpan transaksi ke server. Silakan periksa koneksi internet Anda dan coba lagi.');
    }
  };

  const handleFinishSuccess = () => {
    setCart({});
    setCustomer({ nama: '', noHp: '' });
    setLastCompletedTx(null);
    setShowSuccessModal(false);
  };

  const handlePrintReceipt = (tx: Transaksi) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = tx.items
      .map(
        (i) => `
      <tr>
        <td style="padding: 4px 0; text-align: left;">${i.layanan}<br/><span style="color:#666;">${i.qty} x Rp ${i.hargaSatuan.toLocaleString('id-ID')}</span></td>
        <td style="padding: 4px 0; text-align: right; vertical-align: top;">Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Struk ${tx.noNota}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 10px; color: #000; }
            .header { text-align: center; margin-bottom: 12px; }
            .header h2 { margin: 0; font-size: 16px; }
            .header p { margin: 2px 0; font-size: 10px; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .total { font-weight: bold; font-size: 13px; text-align: right; margin-top: 8px; }
            .footer { text-align: center; margin-top: 16px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>DUA SISI LAUNDRY</h2>
            <p>Express & Coin Laundry</p>
            <p>Nota: ${tx.noNota}</p>
            <p>${tx.tanggal}</p>
          </div>
          <div class="line"></div>
          <p>Pelanggan: <b>${tx.namaPelanggan}</b> ${tx.noHp ? `(${tx.noHp})` : ''}</p>
          <div class="line"></div>
          <table>${itemsHtml}</table>
          <div class="line"></div>
          <div class="total">TOTAL: Rp ${tx.total.toLocaleString('id-ID')}</div>
          <div class="line"></div>
          <div class="footer">
            <p>Terima kasih atas kunjungan Anda!</p>
            <p>Simpan nota ini sebagai bukti pengambilan.</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWhatsAppStruk = (tx: Transaksi) => {
    let rawPhone = (tx.noHp || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);
    if (!rawPhone) {
      alert('Nomor HP / WhatsApp pelanggan tidak tersedia.');
      return;
    }

    const itemsStr = tx.items.map(i => `• ${i.layanan} (x${i.qty}) - Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}`).join('\n');
    const msg = `*HALO ${tx.namaPelanggan.toUpperCase()}, STRUK DUA SISI LAUNDRY*\n\n` +
      `No Nota: *${tx.noNota}*\n` +
      `Tanggal: ${tx.tanggal}\n` +
      `Status: *${tx.status}*\n\n` +
      `*Detail Layanan:*\n${itemsStr}\n\n` +
      `*TOTAL: Rp ${tx.total.toLocaleString('id-ID')}*\n\n` +
      `Terima kasih telah mencuci di Dua SiSi Laundry! 🙏`;

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-56px)] overflow-hidden w-full">
      {/* LEFT: Catalog */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Category tabs + Search */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-4 flex-wrap">
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

          <div className="relative flex-1 min-w-[200px] flex items-center gap-2">
            <div className="relative flex-1">
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

            <button
              onClick={() => setShowCustomItemModal(true)}
              className="bg-teal-50 border border-teal-200 text-[#1E4648] hover:bg-teal-100 px-3 py-2 rounded-md text-xs font-semibold flex items-center gap-1 transition shrink-0"
              title="Tambah Layanan / Item Manual"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Item Manual</span>
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
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
      <div className="w-[280px] sm:w-[310px] md:w-[320px] lg:w-[340px] bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden">
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
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
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
          <div className="bg-white rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                <span>Total Tagihan</span>
                <span className="text-[#1E4648]">Rp {grandTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Nama Pelanggan *</label>
                <input type="text" value={custNamaInput} onChange={(e) => setCustNamaInput(e.target.value)} placeholder="Nama pelanggan" className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">No HP / WhatsApp</label>
                <input type="tel" value={custNoHpInput} onChange={(e) => setCustNoHpInput(e.target.value)} placeholder="08..." className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" />
              </div>

              {/* Metode Pembayaran */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Metode Pembayaran</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Tunai', 'QRIS', 'Transfer'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodeBayar(m)}
                      className={`py-2 rounded-md text-xs font-medium border transition ${
                        metodeBayar === m
                          ? 'border-[#1E4648] bg-teal-50 text-[#1E4648]'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Paid & Change */}
              {metodeBayar === 'Tunai' && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Uang Diterima (Rp)</label>
                    <input
                      type="number"
                      value={uangDibayar}
                      onChange={(e) => setUangDibayar(e.target.value)}
                      placeholder={grandTotal.toString()}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-bold outline-none focus:border-[#1E4648] bg-white"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 pt-1 border-t border-slate-200">
                    <span>Kembalian:</span>
                    <span className="text-[#1E4648] font-bold text-sm">Rp {kembalian.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Kasir / Petugas *</label>
                  <select
                    value={selectedPetugas}
                    onChange={(e) => setSelectedPetugas(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white text-slate-800 font-medium"
                  >
                    {pegawaiList.map((p, idx) => (
                      <option key={idx} value={`${p.nama}${p.jabatan ? ` (${p.jabatan})` : ''}`}>
                        {p.nama} {p.jabatan ? `(${p.jabatan})` : ''}
                      </option>
                    ))}
                    <option value="Siti Rahma (Kasir)">Siti Rahma (Kasir)</option>
                    <option value="Budi Santoso (Operator)">Budi Santoso (Operator)</option>
                  </select>
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
                <Check className="w-4 h-4" /> Bayar & Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT SUCCESS CONFIRMATION MODAL */}
      {showSuccessModal && lastCompletedTx && (
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm text-center">
            {/* Big Check Icon */}
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-slate-800">Pembayaran Berhasil!</h3>
            <p className="text-xs text-slate-500 mt-0.5">Nota: <span className="font-semibold text-slate-800">{lastCompletedTx.noNota}</span></p>

            {/* Receipt Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 my-4 text-xs text-left space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Pelanggan:</span>
                <span className="font-semibold text-slate-800">{lastCompletedTx.namaPelanggan}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Metode:</span>
                <span className="font-semibold text-slate-800">{metodeBayar}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total:</span>
                <span className="font-bold text-[#1E4648]">Rp {lastCompletedTx.total.toLocaleString('id-ID')}</span>
              </div>
              {metodeBayar === 'Tunai' && (
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>Kembalian:</span>
                  <span className="font-bold text-slate-800">Rp {kembalian.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>

            {/* Print & WA Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => handlePrintReceipt(lastCompletedTx)}
                className="w-full bg-[#1E4648] hover:bg-[#153334] text-white font-medium py-2.5 rounded-md text-xs transition flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Cetak Struk Thermal
              </button>

              <button
                onClick={() => handleWhatsAppStruk(lastCompletedTx)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-md text-xs transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Kirim Struk WhatsApp
              </button>

              <button
                onClick={handleFinishSuccess}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-md text-xs transition mt-2"
              >
                ➕ Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ITEM / MANUAL INPUT MODAL */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-[550] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Tambah Layanan Manual</h3>
              <button onClick={() => setShowCustomItemModal(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="block font-medium text-slate-600 mb-1">Nama Layanan / Barang *</label>
                <input
                  type="text"
                  value={customItemNama}
                  onChange={(e) => setCustomItemNama(e.target.value)}
                  placeholder="Misal: Cuci Karpet Masjid 10m²"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">Harga Satuan (Rp) *</label>
                <input
                  type="number"
                  value={customItemHarga}
                  onChange={(e) => setCustomItemHarga(e.target.value)}
                  placeholder="Misal: 150000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCustomItemModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-3 py-2 rounded-md text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleAddCustomItem}
                className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-semibold py-2 rounded-md text-xs transition"
              >
                + Masukkan ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
