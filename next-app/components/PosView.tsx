'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, User, X, Check, CreditCard, Printer, Send, CheckCircle2, DollarSign,
  Zap, Tag, Clock, ShieldAlert, FileSpreadsheet, Lock, Unlock, TagIcon, ShoppingCart, ArrowRight,
  WashingMachine, Wind, Flame, Sparkles, Droplets, ShoppingBag, Shirt, Package, Coffee, CupSoda, Utensils
} from 'lucide-react';
import { LayananItem, CartItem, Pegawai, Transaksi, KecepatanLayanan, ShiftKasir } from '@/lib/types';
import { runBackend } from '@/lib/api';

function getLayananStyleConfig(name: string, catFromItem?: string) {
  const lower = name.toLowerCase();
  
  if (catFromItem === 'MakananMinuman' || lower.includes('kopi') || lower.includes('teh') || lower.includes('air mineral') || lower.includes('snack') || lower.includes('biskuit') || lower.includes('minum')) {
    return {
      Icon: Coffee,
      bg: 'bg-amber-50 border-amber-200/80 text-amber-900',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      categoryGroup: 'Makanan & Minuman'
    };
  }
  if (catFromItem === 'Layanan Tambahan' || lower.includes('dry clean') || lower.includes('sepatu') || lower.includes('noda') || lower.includes('treatment')) {
    return {
      Icon: Sparkles,
      bg: 'bg-purple-50 border-purple-200/80 text-purple-800',
      badgeColor: 'bg-purple-100 text-purple-900 border-purple-200',
      categoryGroup: 'Layanan Tambahan'
    };
  }
  if (lower.includes('cuci + kering') || lower.includes('komplit')) {
    return {
      Icon: WashingMachine,
      bg: 'bg-teal-50 border-teal-200/80 text-[#1E4648]',
      badgeColor: 'bg-teal-100/90 text-[#1E4648] border-teal-200',
      categoryGroup: 'Layanan Utama'
    };
  }
  if (lower.includes('cuci')) {
    return {
      Icon: Droplets,
      bg: 'bg-sky-50 border-sky-200/80 text-sky-700',
      badgeColor: 'bg-sky-100/90 text-sky-800 border-sky-200',
      categoryGroup: 'Layanan Utama'
    };
  }
  if (lower.includes('kering') || lower.includes('pengering') || lower.includes('dry')) {
    return {
      Icon: Wind,
      bg: 'bg-amber-50 border-amber-200/80 text-amber-700',
      badgeColor: 'bg-amber-100/90 text-amber-800 border-amber-200',
      categoryGroup: 'Layanan Utama'
    };
  }
  if (lower.includes('setrika')) {
    return {
      Icon: Flame,
      bg: 'bg-orange-50 border-orange-200/80 text-orange-700',
      badgeColor: 'bg-orange-100/90 text-orange-800 border-orange-200',
      categoryGroup: 'Layanan Utama'
    };
  }
  if (lower.includes('deterjen') || lower.includes('softener')) {
    return {
      Icon: Package,
      bg: 'bg-rose-50 border-rose-200/80 text-rose-700',
      badgeColor: 'bg-rose-100/90 text-rose-800 border-rose-200',
      categoryGroup: 'Produk Laundry'
    };
  }
  if (lower.includes('kresek') || lower.includes('plastik') || lower.includes('tas') || lower.includes('packing')) {
    return {
      Icon: ShoppingBag,
      bg: 'bg-emerald-50 border-emerald-200/80 text-emerald-700',
      badgeColor: 'bg-emerald-100/90 text-emerald-800 border-emerald-200',
      categoryGroup: 'Produk Laundry'
    };
  }
  
  return {
    Icon: Shirt,
    bg: 'bg-indigo-50 border-indigo-200/80 text-indigo-700',
    badgeColor: 'bg-indigo-100/90 text-indigo-800 border-indigo-200',
    categoryGroup: 'Layanan Utama'
  };
}

const defaultLayanan: LayananItem[] = [
  // LAYANAN UTAMA
  { layanan: 'Cuci 7.5 Kg', hargaSatuan: 10000, tipe: 'SelfService', satuan: 'kg', icon: '🫧', kategori: 'Layanan' },
  { layanan: 'Cuci + Kering 7.5 Kg (All-in)', hargaSatuan: 18000, tipe: 'SelfService', satuan: 'paket', icon: '🧺', kategori: 'Layanan' },
  { layanan: 'Cuci Komplit Reguler 7.5 Kg', hargaSatuan: 20000, tipe: 'FullService', satuan: 'paket', icon: '👔', kategori: 'Layanan' },
  { layanan: 'Setrika Saja 7.5 Kg', hargaSatuan: 12000, tipe: 'FullService', satuan: 'kg', icon: '👔', kategori: 'Layanan' },
  
  // LAYANAN TAMBAHAN
  { layanan: 'Dry Clean Jas / Gaun', hargaSatuan: 45000, tipe: 'FullService', satuan: 'pcs', icon: '🧥', kategori: 'Layanan Tambahan' },
  { layanan: 'Cuci Sepatu Premium', hargaSatuan: 35000, tipe: 'FullService', satuan: 'pasang', icon: '👟', kategori: 'Layanan Tambahan' },
  { layanan: 'Treatment Anti Noda Bandel', hargaSatuan: 15000, tipe: 'FullService', satuan: 'pcs', icon: '✨', kategori: 'Layanan Tambahan' },

  // PRODUK LAUNDRY
  { layanan: 'Deterjen Sachet', hargaSatuan: 1500, tipe: 'SelfService', satuan: 'pcs', icon: '🧴', kategori: 'Produk' },
  { layanan: 'Softener Parfum', hargaSatuan: 1500, tipe: 'SelfService', satuan: 'pcs', icon: '🌸', kategori: 'Produk' },
  { layanan: 'Plastik Packing Laundry', hargaSatuan: 2000, tipe: 'SelfService', satuan: 'pcs', icon: '📦', kategori: 'Produk' },

  // MAKANAN & MINUMAN (F&B RETAIL)
  { layanan: 'Air Mineral 600ml', hargaSatuan: 4000, tipe: 'SelfService', satuan: 'botol', icon: '💧', kategori: 'MakananMinuman' },
  { layanan: 'Kopi Espresso Dua SiSi', hargaSatuan: 12000, tipe: 'SelfService', satuan: 'cup', icon: '☕', kategori: 'MakananMinuman' },
  { layanan: 'Teh Manis Dingin', hargaSatuan: 5000, tipe: 'SelfService', satuan: 'cup', icon: '🧋', kategori: 'MakananMinuman' },
  { layanan: 'Snack & Biskuit Outlet', hargaSatuan: 6000, tipe: 'SelfService', satuan: 'pcs', icon: '🍪', kategori: 'MakananMinuman' }
];

export default function PosView() {
  const [mode, setMode] = useState<'SelfService' | 'FullService'>('SelfService');
  const [search, setSearch] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'Semua' | 'Layanan' | 'Layanan Tambahan' | 'Produk' | 'MakananMinuman'>('Semua');
  const [loading, setLoading] = useState(true);
  const [layananList, setLayananList] = useState<LayananItem[]>(defaultLayanan);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [customer, setCustomer] = useState<{ nama: string; noHp: string }>({ nama: '', noHp: '' });
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Kecepatan Layanan & Speed Multiplier (FR-POS-07)
  const [kecepatan, setKecepatan] = useState<KecepatanLayanan>('Reguler');

  // Promo / Voucher (FR-POS-09)
  const [kodePromoInput, setKodePromoInput] = useState('');
  const [diskonApplied, setDiskonApplied] = useState<{ kode: string; nilai: number }>({ kode: '', nilai: 0 });

  // Shift Kasir (FR-POS-02 & FR-POS-29)
  const [shiftAktif, setShiftAktif] = useState<ShiftKasir | null>(null);
  const [showBukaShiftModal, setShowBukaShiftModal] = useState(false);
  const [showTutupShiftModal, setShowTutupShiftModal] = useState(false);
  const [kasAwalInput, setKasAwalInput] = useState('100000');
  const [kasAkhirFisik, setKasAkhirFisik] = useState('');

  // Modals & State
  const [showCustModal, setShowCustModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [lastCompletedTx, setLastCompletedTx] = useState<Transaksi | null>(null);

  // Custom Item Input State
  const [customItemNama, setCustomItemNama] = useState('');
  const [customItemHarga, setCustomItemHarga] = useState('');

  // Payment Options (Tunai, QRIS, Transfer, Kartu, Split & DP) (FR-POS-12..16)
  const [metodeBayar, setMetodeBayar] = useState<'Tunai' | 'QRIS' | 'Transfer' | 'Kartu' | 'Split'>('Tunai');
  const [isDP, setIsDP] = useState(false);
  const [nominalDPInput, setNominalDPInput] = useState('');
  const [uangDibayar, setUangDibayar] = useState<string>('');
  const [catatanOrderGlobal, setCatatanOrderGlobal] = useState('');

  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [selectedPetugas, setSelectedPetugas] = useState('');
  const [estimasi, setEstimasi] = useState('');
  const [custNamaInput, setCustNamaInput] = useState('');
  const [custNoHpInput, setCustNoHpInput] = useState('');
  const [custLookupState, setCustLookupState] = useState<{
    found: boolean;
    nama?: string;
    totalOrder?: number;
    totalSpend?: number;
    isRepeatOrder?: boolean;
    terakhirOrder?: string;
  }>({ found: false });
  const [custLookupMatches, setCustLookupMatches] = useState<Array<{
    nama: string;
    noHp: string;
    totalOrder: number;
    totalSpend: number;
    terakhirOrder: string;
  }>>([]);

  const handlePhoneAutoLookup = async (inputHp: string, target: 'inputModal' | 'checkoutModal') => {
    const cleanQuery = inputHp.replace(/[^0-9]/g, '');
    
    if (target === 'inputModal') {
      setCustomer(prev => ({ ...prev, noHp: inputHp }));
    } else {
      setCustNoHpInput(inputHp);
    }

    if (cleanQuery.length < 3) {
      setCustLookupState({ found: false });
      setCustLookupMatches([]);
      return;
    }

    // 1. Instant check in local cache (match by full string or last digits)
    let localMatches: any[] = [];
    try {
      const cachedStr = localStorage.getItem('duasisi_cust_cache') || '{}';
      const cache = JSON.parse(cachedStr);
      for (let hpKey in cache) {
        if (hpKey === cleanQuery || hpKey.endsWith(cleanQuery) || hpKey.includes(cleanQuery)) {
          localMatches.push({
            noHp: hpKey,
            nama: cache[hpKey].nama,
            totalOrder: cache[hpKey].totalOrder || 1,
            totalSpend: cache[hpKey].totalSpend || 0,
            terakhirOrder: cache[hpKey].terakhirOrder || ''
          });
        }
      }
    } catch (err) {}

    if (localMatches.length > 0) {
      const best = localMatches[0];
      if (target === 'inputModal') {
        setCustomer(prev => ({ ...prev, nama: best.nama, noHp: best.noHp }));
      } else {
        setCustNamaInput(best.nama);
        setCustNoHpInput(best.noHp);
      }
      setCustLookupState({
        found: true,
        nama: best.nama,
        totalOrder: best.totalOrder,
        totalSpend: best.totalSpend,
        isRepeatOrder: true,
        terakhirOrder: best.terakhirOrder
      });
      setCustLookupMatches(localMatches);
    }

    // 2. Query Google Apps Script Backend for live 4-digit match
    try {
      const res = await runBackend('cariPelangganByHp', cleanQuery);
      if (res && res.found && res.matches && res.matches.length > 0) {
        const best = res.bestMatch || res.matches[0];
        if (target === 'inputModal') {
          setCustomer(prev => ({ ...prev, nama: best.nama, noHp: best.noHp }));
        } else {
          setCustNamaInput(best.nama);
          setCustNoHpInput(best.noHp);
        }
        setCustLookupState({
          found: true,
          nama: best.nama,
          totalOrder: best.totalOrder,
          totalSpend: best.totalSpend,
          isRepeatOrder: best.isRepeatOrder,
          terakhirOrder: best.terakhirOrder
        });
        setCustLookupMatches(res.matches);

        // Update local cache
        try {
          const cachedStr = localStorage.getItem('duasisi_cust_cache') || '{}';
          const cache = JSON.parse(cachedStr);
          res.matches.forEach((m: any) => {
            const k = m.cleanHp || m.noHp;
            cache[k] = {
              nama: m.nama,
              totalOrder: m.totalOrder,
              totalSpend: m.totalSpend,
              terakhirOrder: m.terakhirOrder
            };
          });
          localStorage.setItem('duasisi_cust_cache', JSON.stringify(cache));
        } catch (err) {}
      } else if (localMatches.length === 0) {
        setCustLookupState({ found: false });
        setCustLookupMatches([]);
      }
    } catch (err) {}
  };

  useEffect(() => {
    // Check saved shift in localStorage
    try {
      const savedShift = localStorage.getItem('duasisi_shift_aktif');
      if (savedShift) setShiftAktif(JSON.parse(savedShift));
      else setShowBukaShiftModal(true);
    } catch (e) {}

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
      .catch(() => {})
      .finally(() => setLoading(false));

    runBackend('getPegawaiList')
      .then((res) => {
        if (Array.isArray(res)) setPegawaiList(res);
      })
      .catch(() => {});
  }, []);

  const handleBukaShift = () => {
    const val = Number(kasAwalInput) || 0;
    const newShift: ShiftKasir = {
      idShift: `SHF-${Date.now().toString().slice(-6)}`,
      idUser: 'KASIR-01',
      namaKasir: selectedPetugas || 'Siti Rahma (Kasir)',
      kasAwal: val,
      status: 'Buka',
      waktuBuka: new Date().toLocaleString('id-ID')
    };
    setShiftAktif(newShift);
    localStorage.setItem('duasisi_shift_aktif', JSON.stringify(newShift));
    setShowBukaShiftModal(false);
  };

  const handleTutupShift = () => {
    if (!shiftAktif) return;
    const fisik = Number(kasAkhirFisik) || 0;
    const totalOmzet = shiftAktif.totalOmzetTunai || 0;
    const ekspektasiKas = shiftAktif.kasAwal + totalOmzet;
    const selisih = fisik - ekspektasiKas;

    const closedShift: ShiftKasir = {
      ...shiftAktif,
      kasAkhir: fisik,
      selisihKas: selisih,
      status: 'Tutup',
      waktuTutup: new Date().toLocaleString('id-ID')
    };
    localStorage.removeItem('duasisi_shift_aktif');
    setShiftAktif(null);
    setShowTutupShiftModal(false);
    alert(`Shift ditutup. Kas Fisik: Rp ${fisik.toLocaleString('id-ID')} | Selisih: Rp ${selisih.toLocaleString('id-ID')}`);
    setShowBukaShiftModal(true);
  };

  const speedMultiplier = kecepatan === 'Express' ? 1.5 : kecepatan === 'Kilat' ? 2.0 : 1.0;

  const filteredLayanan = (layananList || []).filter((item) => {
    if (!item) return false;
    const matchesMode = item.tipe === mode || item.kategori === 'Produk' || item.kategori === 'MakananMinuman';
    const matchesSearch = (item.layanan || '').toLowerCase().includes((search || '').toLowerCase().trim());

    if (selectedCategoryTab === 'Semua') {
      return matchesMode && matchesSearch;
    }

    const itemCat = item.kategori || (getLayananStyleConfig(item.layanan, item.kategori).categoryGroup === 'Layanan Utama' ? 'Layanan' : 'Produk');
    return matchesMode && matchesSearch && itemCat === selectedCategoryTab;
  });

  const updateCart = (item: LayananItem, delta: number) => {
    setCart((prev) => {
      const copy = { ...prev };
      const adjustedPrice = Math.round(item.hargaSatuan * speedMultiplier);
      const currentQty = copy[item.layanan] ? copy[item.layanan].qty : 0;
      const nextQty = currentQty + delta;
      if (nextQty <= 0) {
        delete copy[item.layanan];
      } else {
        copy[item.layanan] = { 
          layanan: item.layanan, 
          hargaSatuan: adjustedPrice, 
          qty: nextQty,
          catatan: copy[item.layanan]?.catatan || ''
        };
      }
      return copy;
    });
  };

  const handleApplyPromo = () => {
    const code = kodePromoInput.trim().toUpperCase();
    if (!code) return;
    if (code === 'LAUNDRYMEMBER' || code === 'PROMO10') {
      setDiskonApplied({ kode: code, nilai: 10000 });
      alert(`Voucher ${code} berhasil dipasang! Diskon Rp 10.000`);
    } else if (code === 'HEMAT20') {
      setDiskonApplied({ kode: code, nilai: 20000 });
      alert(`Voucher ${code} berhasil dipasang! Diskon Rp 20.000`);
    } else {
      alert('Kode voucher/promo tidak ditemukan atau sudah kedaluwarsa.');
    }
  };

  const clearCart = () => {
    setCart({});
    setDiskonApplied({ kode: '', nilai: 0 });
    setKodePromoInput('');
  };

  const cartArray = Object.values(cart);
  const totalCartItems = cartArray.reduce((acc, i) => acc + i.qty, 0);
  const subtotalCart = cartArray.reduce((acc, i) => acc + (i.qty * i.hargaSatuan), 0);
  const grandTotal = Math.max(0, subtotalCart - diskonApplied.nilai);

  const dpAmount = isDP ? (Number(nominalDPInput) || Math.round(grandTotal * 0.5)) : 0;
  const tagihanAktif = isDP ? dpAmount : grandTotal;
  const numUangDibayar = Number(uangDibayar) || tagihanAktif;
  const kembalian = Math.max(0, numUangDibayar - tagihanAktif);
  const sisaTagihan = isDP ? Math.max(0, grandTotal - dpAmount) : 0;

  const handleProcessCheckout = () => {
    if (cartArray.length === 0) { alert('Keranjang masih kosong!'); return; }
    setCustNamaInput(customer.nama);
    setCustNoHpInput(customer.noHp);
    setUangDibayar(tagihanAktif.toString());

    const defaultNames = pegawaiList.length > 0
      ? pegawaiList.map(p => p.nama + (p.jabatan ? ` (${p.jabatan})` : ''))
      : ['Siti Rahma (Kasir)', 'Budi Santoso (Operator)', 'Manager / Owner (Manager)'];
    if (!selectedPetugas && defaultNames.length > 0) setSelectedPetugas(defaultNames[0]);

    // Auto calculate SLA estimation date
    const now = new Date();
    if (kecepatan === 'Kilat') now.setHours(now.getHours() + 6);
    else if (kecepatan === 'Express') now.setHours(now.getHours() + 24);
    else now.setHours(now.getHours() + 48);
    setEstimasi(now.toISOString().slice(0, 10));

    setShowCheckoutModal(true);
  };

  const handleConfirmSave = async () => {
    if (!custNamaInput.trim()) { alert('Nama pelanggan wajib diisi!'); return; }
    if (metodeBayar === 'Tunai' && numUangDibayar < tagihanAktif) {
      alert(`Uang dibayar kurang! Minimal Rp ${tagihanAktif.toLocaleString('id-ID')}`);
      return;
    }

    const payload = {
      namaPelanggan: custNamaInput.trim(),
      noHp: custNoHpInput.trim(),
      petugas: selectedPetugas || 'Kasir 1',
      tipe: mode,
      tingkatLayanan: kecepatan,
      subtotal: subtotalCart,
      diskon: diskonApplied.nilai,
      total: grandTotal,
      nominalDP: dpAmount,
      sisaTagihan: sisaTagihan,
      metodeBayar: metodeBayar,
      catatan: catatanOrderGlobal,
      estimasi: estimasi,
      items: cartArray
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
        tingkatLayanan: payload.tingkatLayanan,
        subtotal: subtotalCart,
        diskon: diskonApplied.nilai,
        total: payload.total,
        nominalDP: dpAmount,
        sisaTagihan: sisaTagihan,
        metodeBayar: payload.metodeBayar,
        catatan: payload.catatan,
        estimasiSelesai: payload.estimasi,
        status: 'Diterima',
        items: payload.items
      };

      setLastCompletedTx(completedTxObj);

      // Update shift cash total if cash payment
      if (shiftAktif && metodeBayar === 'Tunai') {
        const updatedShift = {
          ...shiftAktif,
          totalOmzetTunai: (shiftAktif.totalOmzetTunai || 0) + (isDP ? dpAmount : grandTotal)
        };
        setShiftAktif(updatedShift);
        localStorage.setItem('duasisi_shift_aktif', JSON.stringify(updatedShift));
      }

      setShowCheckoutModal(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('[POS] Simpan transaksi gagal:', err);
      alert('Gagal menyimpan transaksi ke server online. Silakan periksa koneksi internet Anda dan coba lagi.');
    }
  };

  const handleFinishSuccess = () => {
    setCart({});
    setCustomer({ nama: '', noHp: '' });
    setDiskonApplied({ kode: '', nilai: 0 });
    setCatatanOrderGlobal('');
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
        <td style="padding: 4px 0; text-align: left;">
          ${i.layanan}<br/>
          <span style="color:#666;">${i.qty} x Rp ${i.hargaSatuan.toLocaleString('id-ID')}</span>
          ${i.catatan ? `<br/><small style="color:#e11d48;">Catatan: ${i.catatan}</small>` : ''}
        </td>
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
            <p>Kecepatan: <b>${tx.tingkatLayanan || 'Reguler'}</b></p>
          </div>
          <div class="line"></div>
          <p>Pelanggan: <b>${tx.namaPelanggan}</b> ${tx.noHp ? `(${tx.noHp})` : ''}</p>
          <div class="line"></div>
          <table>${itemsHtml}</table>
          <div class="line"></div>
          ${tx.diskon ? `<div style="text-align:right;">Diskon: -Rp ${tx.diskon.toLocaleString('id-ID')}</div>` : ''}
          <div class="total">TOTAL: Rp ${tx.total.toLocaleString('id-ID')}</div>
          ${tx.nominalDP ? `<div style="text-align:right; font-weight:bold;">DP Paid: Rp ${tx.nominalDP.toLocaleString('id-ID')}</div><div style="text-align:right; color:#e11d48; font-weight:bold;">Sisa Tagihan: Rp ${(tx.sisaTagihan || 0).toLocaleString('id-ID')}</div>` : ''}
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

  const handlePrintItemTag = (tx: Transaksi) => {
    const printWindow = window.open('', '_blank', 'width=350,height=400');
    if (!printWindow) return;

    const tagsHtml = tx.items.map((item, idx) => `
      <div style="border: 2px solid #000; padding: 10px; margin-bottom: 15px; border-radius: 8px; page-break-after: always;">
        <div style="text-align:center; font-weight:bold; font-size:16px;">DUA SISI LAUNDRY TAG</div>
        <div style="text-align:center; font-size:11px; margin-bottom:8px;">ORDER TAG #${idx + 1} OF ${tx.items.length}</div>
        <hr style="border:1px dashed #000;"/>
        <div style="font-size:14px; font-weight:bold; margin-top:6px;">NOTA: ${tx.noNota}</div>
        <div style="font-size:14px; font-weight:bold;">NAMA: ${tx.namaPelanggan.toUpperCase()}</div>
        <div style="font-size:12px; margin-top:4px;">ITEM: <b>${item.layanan}</b> (Qty: ${item.qty})</div>
        <div style="font-size:12px; color:#c53030; font-weight:bold; margin-top:4px;">PROSES: ${tx.tingkatLayanan || 'Reguler'}</div>
        ${tx.catatan ? `<div style="font-size:11px; margin-top:4px; font-style:italic;">CATATAN: ${tx.catatan}</div>` : ''}
        <hr style="border:1px dashed #000; margin-top:8px;"/>
        <div style="text-align:center; font-size:10px; margin-top:4px;">TGL MASUK: ${tx.tanggal}</div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Tag Cucian - ${tx.noNota}</title>
          <style>body { font-family: sans-serif; font-size: 12px; margin: 10px; }</style>
        </head>
        <body>
          ${tagsHtml}
          <script>window.onload = function() { window.print(); window.close(); }</script>
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

    const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://roqueforti.github.io/duasisi-pos/';
    const notaUrl = `${baseUrl}?nota=${encodeURIComponent(tx.noNota)}`;

    const itemsStr = tx.items.map(i => `• ${i.layanan} (x${i.qty}) - Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}`).join('\n');
    const msg = `*HALO ${tx.namaPelanggan.toUpperCase()}, STRUK DUA SISI LAUNDRY*\n\n` +
      `No Nota: *${tx.noNota}*\n` +
      `Tanggal: ${tx.tanggal}\n` +
      `Kecepatan: *${tx.tingkatLayanan || 'Reguler'}*\n` +
      `Status: *${tx.status}*\n\n` +
      `*Detail Layanan:*\n${itemsStr}\n\n` +
      `*TOTAL: Rp ${tx.total.toLocaleString('id-ID')}*\n` +
      (tx.nominalDP ? `*DP Terbayar: Rp ${tx.nominalDP.toLocaleString('id-ID')}*\n*Sisa Tagihan: Rp ${(tx.sisaTagihan || 0).toLocaleString('id-ID')}*\n` : '') +
      `\n📄 *Lihat E-Nota Resmi (Anti-Pemalsuan & Cetak PDF):*\n${notaUrl}\n\n` +
      `Terima kasih telah mencuci di Dua SiSi Laundry! 🙏`;

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-56px)] overflow-hidden w-full">
      {/* LEFT: Catalog */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar with Shift Indicator & Speed Selector */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          {/* Category Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1 shrink-0">
            <button
              onClick={() => setMode('SelfService')}
              className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition ${
                mode === 'SelfService' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Self Service
            </button>
            <button
              onClick={() => setMode('FullService')}
              className={`px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition ${
                mode === 'FullService' ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Service
            </button>
          </div>

          {/* Kecepatan Layanan Selector (FR-POS-07) */}
          <div className="flex items-center gap-1 bg-amber-50/80 border border-amber-200/80 px-2 py-1 rounded-lg text-xs flex-wrap">
            <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-semibold text-amber-800">Speed:</span>
            <div className="flex gap-1">
              {(['Reguler', 'Express', 'Kilat'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKecepatan(k)}
                  className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition ${
                    kecepatan === k 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {k} {k === 'Express' ? '(+50%)' : k === 'Kilat' ? '(+100%)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Shift Status Widget (FR-POS-02) */}
          <div className="flex items-center gap-2 shrink-0">
            {shiftAktif ? (
              <button
                onClick={() => setShowTutupShiftModal(true)}
                className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition"
                title="Shift Berjalan — Klik untuk Tutup Shift Kasir"
              >
                <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-none">Shift (Rp {shiftAktif.kasAwal.toLocaleString('id-ID')})</span>
              </button>
            ) : (
              <button
                onClick={() => setShowBukaShiftModal(true)}
                className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition animate-pulse"
              >
                <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Buka Shift</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Manual Add */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari layanan, produk, makanan, minuman..."
              className="w-full pl-9 pr-8 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowCustomItemModal(true)}
            className="bg-teal-50 border border-teal-200 text-[#1E4648] hover:bg-teal-100 px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shrink-0"
            title="Tambah Layanan / Item Manual"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Item Manual</span>
          </button>
        </div>

        {/* Category Filter Tabs Bar */}
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'Semua', label: 'Semua', icon: Tag },
            { id: 'Layanan', label: 'Layanan Utama', icon: WashingMachine },
            { id: 'Layanan Tambahan', label: 'Layanan Tambahan', icon: Sparkles },
            { id: 'Produk', label: 'Produk Laundry', icon: Package },
            { id: 'MakananMinuman', label: 'Makanan & Minuman', icon: Coffee },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = selectedCategoryTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategoryTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 select-none ${
                  isActive
                    ? 'bg-[#1E4648] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-300' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 lg:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100" />
                  <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              ))
            ) : (
              (() => {
                const renderCard = (item: LayananItem, idx: number) => {
                  const qtyInCart = cart[item.layanan] ? cart[item.layanan].qty : 0;
                  const effectivePrice = Math.round(item.hargaSatuan * speedMultiplier);
                  const styleCfg = getLayananStyleConfig(item.layanan);
                  const IconComp = styleCfg.Icon;

                  // Parse & combine specifications cleanly
                  const weightMatch = item.layanan.match(/(\d+([.,]\d+)?\s*Kg)/i);
                  const durationMatch = item.layanan.match(/(\d+\s*(Mnt|Menit|Min))/i);
                  const packMatch = item.layanan.match(/(Sachet|Pouch|Porsi|Pcs|Jumbo|Premium)/i);

                  const specParts: string[] = [];
                  if (weightMatch) specParts.push(weightMatch[1]);
                  if (durationMatch) specParts.push(durationMatch[1]);
                  if (packMatch && !weightMatch && !durationMatch) specParts.push(packMatch[1]);

                  const combinedSpec = specParts.join(' • ');

                  return (
                    <div
                      key={idx}
                      className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between transition-all duration-200 cursor-pointer relative select-none hover:-translate-y-0.5 hover:shadow-md ${
                        qtyInCart > 0 
                          ? 'border-2 border-[#1E4648] bg-teal-50/50 shadow-md ring-2 ring-[#1E4648]/10' 
                          : 'border-slate-200/90 shadow-2xs hover:border-[#1E4648]/40'
                      }`}
                      onClick={() => updateCart(item, 1)}
                    >
                      {/* Active Quantity Badge Top Right */}
                      {qtyInCart > 0 && (
                        <span className="absolute -top-2 -right-2 bg-[#1E4648] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full shadow-md animate-scale-up border border-white flex items-center gap-0.5 z-10">
                          <Check className="w-3 h-3 text-teal-300" />
                          <span>{qtyInCart}x</span>
                        </span>
                      )}

                      <div>
                        {/* Top Header Row: Color-Coded Vector Icon & Combined Spec Badge */}
                        <div className="flex items-start justify-between gap-1.5 mb-2.5">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs ${styleCfg.bg}`}>
                            <IconComp className="w-5 h-5" />
                          </div>

                          {/* Combined Unified Spec Pill */}
                          {combinedSpec && (
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${styleCfg.badgeColor}`}>
                              {combinedSpec}
                            </span>
                          )}
                        </div>

                        {/* Product Title */}
                        <h3 className="font-bold text-xs sm:text-sm text-slate-800 leading-snug mb-1 line-clamp-2">
                          {item.layanan}
                        </h3>

                        {/* Prominent Price & Subdued Unit */}
                        <div className="flex items-baseline gap-1 mt-1.5">
                          <span className="text-sm sm:text-base font-black text-[#1E4648] tracking-tight">
                            Rp {effectivePrice.toLocaleString('id-ID')}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            /{item.satuan || 'paket'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Action Controls */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100">
                        {qtyInCart > 0 ? (
                          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-teal-200 shadow-2xs">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                              className="w-7 h-7 bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-bold rounded-md flex items-center justify-center transition active:scale-95"
                              title="Kurangi Qty"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="flex-1 text-center text-xs font-extrabold text-[#1E4648]">
                              {qtyInCart}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                              className="w-7 h-7 bg-[#1E4648] hover:bg-[#153334] text-white font-bold rounded-md flex items-center justify-center transition active:scale-95"
                              title="Tambah Qty"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                            className="w-full bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-all shadow-2xs hover:shadow-md flex items-center justify-center gap-1.5 active:scale-97"
                          >
                            <Plus className="w-3.5 h-3.5 text-teal-300" />
                            <span>Tambah</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                };

                const mainServices = filteredLayanan.filter(item => getLayananStyleConfig(item.layanan, item.kategori).categoryGroup === 'Layanan Utama');
                const extraServices = filteredLayanan.filter(item => getLayananStyleConfig(item.layanan, item.kategori).categoryGroup === 'Layanan Tambahan');
                const laundryProducts = filteredLayanan.filter(item => getLayananStyleConfig(item.layanan, item.kategori).categoryGroup === 'Produk Laundry');
                const fnbProducts = filteredLayanan.filter(item => getLayananStyleConfig(item.layanan, item.kategori).categoryGroup === 'Makanan & Minuman');

                return (
                  <div className="col-span-full space-y-6">
                    {/* Group 1: Layanan Utama */}
                    {mainServices.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-3 px-0.5">
                          <span className="w-2 h-2 rounded-full bg-[#1E4648]" />
                          <h2 className="text-xs font-extrabold text-[#1E4648] uppercase tracking-wider">
                            Layanan Laundry Utama
                          </h2>
                          <span className="text-[10px] font-bold bg-teal-100 text-[#1E4648] px-2 py-0.2 rounded-full border border-teal-200">
                            {mainServices.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                          {mainServices.map((item, idx) => renderCard(item, idx))}
                        </div>
                      </div>
                    )}

                    {/* Group 2: Layanan Tambahan */}
                    {extraServices.length > 0 && (
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-3 px-0.5">
                          <span className="w-2 h-2 rounded-full bg-purple-600" />
                          <h2 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider">
                            Layanan Tambahan & Special Care
                          </h2>
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-900 px-2 py-0.2 rounded-full border border-purple-200">
                            {extraServices.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                          {extraServices.map((item, idx) => renderCard(item, idx + 200))}
                        </div>
                      </div>
                    )}

                    {/* Group 3: Produk Laundry */}
                    {laundryProducts.length > 0 && (
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-3 px-0.5">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <h2 className="text-xs font-extrabold text-rose-900 uppercase tracking-wider">
                            Produk Laundry & Packing
                          </h2>
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.2 rounded-full border border-rose-200">
                            {laundryProducts.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                          {laundryProducts.map((item, idx) => renderCard(item, idx + 400))}
                        </div>
                      </div>
                    )}

                    {/* Group 4: Makanan & Minuman */}
                    {fnbProducts.length > 0 && (
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-3 px-0.5">
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                          <h2 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                            Makanan & Minuman (F&B Retail)
                          </h2>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.2 rounded-full border border-amber-200">
                            {fnbProducts.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                          {fnbProducts.map((item, idx) => renderCard(item, idx + 600))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* Floating Sticky Bottom Bar on Mobile (< lg) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[120] bg-[#11292B] text-white px-4 py-3 flex items-center justify-between shadow-2xl border-t border-teal-800/80">
        <div className="flex items-center gap-3 min-w-0" onClick={() => setShowMobileCart(true)}>
          <div className="relative shrink-0">
            <ShoppingCart className="w-5 h-5 text-teal-300" />
            {totalCartItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {totalCartItems}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate">
              {totalCartItems > 0 ? `Total: Rp ${grandTotal.toLocaleString('id-ID')}` : 'Keranjang Kosong'}
            </div>
            <div className="text-[10px] text-teal-200/90 truncate">
              {totalCartItems > 0 ? `${totalCartItems} item dipilih` : 'Klik item di atas untuk menambah'}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowMobileCart(true)}
          disabled={totalCartItems === 0}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shrink-0 shadow-md"
        >
          <span>Keranjang & Bayar</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* RIGHT: Order Panel Backdrop & Responsive Drawer (< lg Drawer, >= lg Static Panel) */}
      {showMobileCart && (
        <div 
          className="fixed inset-0 bg-black/60 z-[250] lg:hidden animate-fade-in"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      <div className={`fixed inset-0 z-[300] bg-white flex flex-col w-full lg:static lg:w-[340px] lg:z-auto border-l border-slate-200 shrink-0 overflow-hidden transition-all duration-300 ${
        showMobileCart ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 lg:translate-y-0 lg:opacity-100 hidden lg:flex'
      }`}>
        {/* Order Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-slate-800">Keranjang Order</h2>
            {kecepatan !== 'Reguler' && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                {kecepatan}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCustModal(true)}
              className="text-[11px] font-medium text-[#1E4648] bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-md flex items-center gap-1 hover:bg-teal-100 transition"
            >
              <User className="w-3 h-3" />
              {customer.nama || 'Pilih Pelanggan'}
            </button>
            <button
              onClick={() => setShowMobileCart(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
              title="Tutup Keranjang"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
            <div className="space-y-2">
              {cartArray.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                      <div className="font-semibold text-xs text-slate-800">{item.layanan}</div>
                      <div className="text-[11px] text-slate-500">
                        Rp {item.hargaSatuan.toLocaleString('id-ID')} × {item.qty}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#1E4648]">
                      Rp {(item.qty * item.hargaSatuan).toLocaleString('id-ID')}
                    </div>
                  </div>
                  {/* Catatan Per Item */}
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
                    placeholder="Catatan item (noda/luntur...)"
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-[#1E4648]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Promo Code & Voucher Section (FR-POS-09) */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <input
              type="text"
              value={kodePromoInput}
              onChange={(e) => setKodePromoInput(e.target.value)}
              placeholder="Kode Voucher (LAUNDRYMEMBER)"
              className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-white outline-none focus:border-[#1E4648] uppercase"
            />
            <button
              onClick={handleApplyPromo}
              className="px-2.5 py-1 bg-[#1E4648] hover:bg-[#153334] text-white text-xs font-semibold rounded transition shrink-0"
            >
              Pasang
            </button>
          </div>
          {diskonApplied.nilai > 0 && (
            <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold mt-1">
              <span>Promo {diskonApplied.kode}</span>
              <span>-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        {/* Total & Buttons */}
        <div className="px-4 py-3 border-t border-slate-200 space-y-2.5 bg-white">
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>Rp {subtotalCart.toLocaleString('id-ID')}</span>
            </div>
            {diskonApplied.nilai > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Diskon Promo</span>
                <span>-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-slate-800 pt-2 border-t border-slate-200">
            <span>Total Tagihan</span>
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
              className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-semibold py-2.5 rounded-md text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-30 shadow-xs"
            >
              <CreditCard className="w-4 h-4" />
              Proses Bayar Rp {grandTotal.toLocaleString('id-ID')}
            </button>
          </div>
        </div>
      </div>

      {/* Customer Modal */}
      {showCustModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#1E4648]" />
                <span className="text-sm font-bold text-slate-800">Data Pelanggan</span>
              </div>
              <button onClick={() => setShowCustModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">No HP / WhatsApp (Unik) *</label>
                <input 
                  type="tel" 
                  value={customer.noHp} 
                  onChange={(e) => handlePhoneAutoLookup(e.target.value, 'inputModal')} 
                  placeholder="08... (Auto Read Nama)" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1E4648] font-mono font-medium" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pelanggan *</label>
                <input 
                  type="text" 
                  value={customer.nama} 
                  onChange={(e) => setCustomer({ ...customer, nama: e.target.value })} 
                  placeholder="Masukkan nama pelanggan" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1E4648]" 
                />
              </div>

              {/* Multiple Match Quick Selection Dropdown (4 Digit Terakhir) */}
              {custLookupMatches.length > 1 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5 text-xs animate-fade-in">
                  <div className="font-bold text-[#1E4648] text-[11px] flex items-center justify-between">
                    <span>👥 Match {custLookupMatches.length} Pelanggan (4 Digit Terakhir):</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {custLookupMatches.map((m, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCustomer({ nama: m.nama, noHp: m.noHp });
                          setCustNamaInput(m.nama);
                          setCustNoHpInput(m.noHp);
                          setCustLookupState({
                            found: true,
                            nama: m.nama,
                            totalOrder: m.totalOrder,
                            totalSpend: m.totalSpend,
                            isRepeatOrder: true,
                            terakhirOrder: m.terakhirOrder
                          });
                        }}
                        className="w-full text-left px-2.5 py-1.5 bg-white hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-md text-[11px] flex justify-between items-center transition shadow-2xs"
                      >
                        <span className="font-bold text-slate-800">{m.nama}</span>
                        <span className="text-slate-500 font-mono text-[10px]">{m.noHp}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Repeat Order Badge Notification */}
              {custLookupState.found ? (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg p-2.5 text-xs flex items-center justify-between animate-fade-in shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-sm">🔁</span>
                    <span>Repeat Order ({custLookupState.totalOrder || 1}x Transaksi)</span>
                  </div>
                  <div className="text-[10px] font-semibold text-emerald-700">
                    Rp {(custLookupState.totalSpend || 0).toLocaleString('id-ID')}
                  </div>
                </div>
              ) : customer.noHp.length >= 3 ? (
                <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-lg p-2 text-xs flex items-center gap-1.5 animate-fade-in">
                  <span>🆕</span>
                  <span className="font-semibold text-[11px]">Pelanggan Baru — Otomatis tersimpan ke Database</span>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCustModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2 rounded-lg text-xs">Batal</button>
              <button onClick={() => setShowCustModal(false)} className="bg-[#1E4648] hover:bg-[#153334] text-white font-semibold px-4 py-2 rounded-lg text-xs">Simpan Data</button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Buka Modal (FR-POS-02) */}
      {showBukaShiftModal && (
        <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-3">
              <Unlock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">Buka Shift Kasir Baru</h3>
            <p className="text-xs text-slate-500 mb-4">Masukkan saldo kas modal awal di laci kas sebelum memulai transaksi.</p>
            
            <div className="text-left space-y-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Saldo Kas Awal (Rp)</label>
                <input
                  type="number"
                  value={kasAwalInput}
                  onChange={(e) => setKasAwalInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:border-[#1E4648]"
                  placeholder="100000"
                />
              </div>
            </div>

            <button
              onClick={handleBukaShift}
              className="w-full bg-[#1E4648] hover:bg-[#153334] text-white font-semibold py-2.5 rounded-lg text-xs transition shadow-sm"
            >
              Mulai Sesi Shift Kasir
            </button>
          </div>
        </div>
      )}

      {/* Shift Tutup Modal (FR-POS-29) */}
      {showTutupShiftModal && shiftAktif && (
        <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-base font-bold text-slate-800">Tutup Shift Kasir (Rekonsiliasi)</h3>
              <button onClick={() => setShowTutupShiftModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs mb-4">
              <div className="flex justify-between text-slate-600">
                <span>Waktu Buka Shift:</span>
                <span className="font-semibold">{shiftAktif.waktuBuka}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Saldo Kas Awal:</span>
                <span className="font-semibold">Rp {shiftAktif.kasAwal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Omzet Tunai Shift Ini:</span>
                <span className="font-bold text-emerald-700">Rp {(shiftAktif.totalOmzetTunai || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 text-sm pt-1 border-t border-slate-200">
                <span>Ekspektasi Kas Fisik:</span>
                <span className="text-[#1E4648]">Rp {(shiftAktif.kasAwal + (shiftAktif.totalOmzetTunai || 0)).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kas Fisik Akhir di Laci (Rp) *</label>
                <input
                  type="number"
                  value={kasAkhirFisik}
                  onChange={(e) => setKasAkhirFisik(e.target.value)}
                  placeholder={(shiftAktif.kasAwal + (shiftAktif.totalOmzetTunai || 0)).toString()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowTutupShiftModal(false)} className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-lg text-xs font-semibold">Batal</button>
              <button onClick={handleTutupShift} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-lg text-xs transition">
                Selesaikan & Tutup Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-slate-800">Proses Pembayaran Order</span>
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
              <div className="flex justify-between text-slate-600 pt-1">
                <span>Subtotal</span>
                <span>Rp {subtotalCart.toLocaleString('id-ID')}</span>
              </div>
              {diskonApplied.nilai > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Diskon Promo ({diskonApplied.kode})</span>
                  <span>-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-800 pt-1 border-t border-slate-200">
                <span>Total Tagihan</span>
                <span className="text-[#1E4648]">Rp {grandTotal.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">No HP / WhatsApp (Unik) *</label>
                    <input 
                      type="tel" 
                      value={custNoHpInput} 
                      onChange={(e) => handlePhoneAutoLookup(e.target.value, 'checkoutModal')} 
                      placeholder="08..." 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1E4648] font-mono font-medium" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Pelanggan *</label>
                    <input 
                      type="text" 
                      value={custNamaInput} 
                      onChange={(e) => setCustNamaInput(e.target.value)} 
                      placeholder="Nama" 
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1E4648]" 
                    />
                  </div>
                </div>

                {/* Multiple Match Quick Selection Dropdown (4 Digit Terakhir) */}
                {custLookupMatches.length > 1 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1.5 text-xs animate-fade-in">
                    <div className="font-bold text-[#1E4648] text-[11px] flex items-center justify-between">
                      <span>👥 Match {custLookupMatches.length} Pelanggan (4 Digit Terakhir):</span>
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {custLookupMatches.map((m, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCustomer({ nama: m.nama, noHp: m.noHp });
                            setCustNamaInput(m.nama);
                            setCustNoHpInput(m.noHp);
                            setCustLookupState({
                              found: true,
                              nama: m.nama,
                              totalOrder: m.totalOrder,
                              totalSpend: m.totalSpend,
                              isRepeatOrder: true,
                              terakhirOrder: m.terakhirOrder
                            });
                          }}
                          className="w-full text-left px-2.5 py-1.5 bg-white hover:bg-teal-50 hover:border-teal-300 border border-slate-200 rounded-md text-[11px] flex justify-between items-center transition shadow-2xs"
                        >
                          <span className="font-bold text-slate-800">{m.nama}</span>
                          <span className="text-slate-500 font-mono text-[10px]">{m.noHp}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Repeat Order Badge in Checkout */}
                {custLookupState.found ? (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg p-2 text-xs flex items-center justify-between animate-fade-in shadow-2xs">
                    <div className="flex items-center gap-1 font-bold">
                      <span className="text-xs">🔁</span>
                      <span>Repeat Order ({custLookupState.totalOrder || 1}x Order)</span>
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-700">
                      Total Rp {(custLookupState.totalSpend || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                ) : custNoHpInput.length >= 3 ? (
                  <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-lg p-2 text-xs flex items-center gap-1.5 animate-fade-in">
                    <span>🆕</span>
                    <span className="font-semibold text-[11px]">Pelanggan Baru — Otomatis tersimpan ke Database</span>
                  </div>
                ) : null}
              </div>

              {/* Opsi DP / Uang Muka (FR-POS-14) */}
              <div className="flex items-center justify-between bg-teal-50/60 p-2.5 rounded-lg border border-teal-200/60">
                <div className="text-xs">
                  <span className="font-semibold text-[#1E4648]">Pembayaran Sebagian (DP)?</span>
                  <p className="text-[10px] text-slate-500">Pelunasan dilakukan saat pengambilan cucian.</p>
                </div>
                <input
                  type="checkbox"
                  checked={isDP}
                  onChange={(e) => setIsDP(e.target.checked)}
                  className="w-4 h-4 accent-[#1E4648] cursor-pointer"
                />
              </div>

              {isDP && (
                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 space-y-2 text-xs">
                  <div>
                    <label className="block font-semibold text-amber-900 mb-1">Nominal Uang Muka (DP) (Rp)</label>
                    <input
                      type="number"
                      value={nominalDPInput}
                      onChange={(e) => setNominalDPInput(e.target.value)}
                      placeholder={Math.round(grandTotal * 0.5).toString()}
                      className="w-full px-3 py-1.5 border border-amber-300 rounded text-xs font-bold outline-none bg-white"
                    />
                  </div>
                  <div className="flex justify-between font-semibold text-amber-900 text-[11px]">
                    <span>Sisa Tagihan Nanti:</span>
                    <span>Rp {sisaTagihan.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              {/* Metode Pembayaran (FR-POS-12..15) */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Metode Pembayaran</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Tunai', 'QRIS', 'Transfer', 'Kartu'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodeBayar(m)}
                      className={`py-1.5 rounded text-xs font-semibold border transition ${
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
                      placeholder={tagihanAktif.toString()}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs font-bold outline-none focus:border-[#1E4648] bg-white"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 pt-1 border-t border-slate-200">
                    <span>Kembalian:</span>
                    <span className="text-[#1E4648] font-bold text-sm">Rp {kembalian.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Kasir / Petugas *</label>
                  <select
                    value={selectedPetugas}
                    onChange={(e) => setSelectedPetugas(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white text-slate-800 font-medium"
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
                  <input type="date" value={estimasi} onChange={(e) => setEstimasi(e.target.value)} className="w-full px-3 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
              <button onClick={() => setShowCheckoutModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">Batal</button>
              <button onClick={handleConfirmSave} className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-semibold py-2 rounded-md text-xs transition flex items-center justify-center gap-1">
                <Check className="w-4 h-4" /> Bayar & Simpan Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT SUCCESS CONFIRMATION MODAL */}
      {showSuccessModal && lastCompletedTx && (
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold text-slate-800">Order Berhasil Disimpan!</h3>
            <p className="text-xs text-slate-500 mt-0.5">Nota: <span className="font-semibold text-slate-800">{lastCompletedTx.noNota}</span></p>

            {/* Receipt Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 my-3 text-xs text-left space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Pelanggan:</span>
                <span className="font-semibold text-slate-800">{lastCompletedTx.namaPelanggan}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Layanan Kecepatan:</span>
                <span className="font-bold text-amber-700">{lastCompletedTx.tingkatLayanan || 'Reguler'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total:</span>
                <span className="font-bold text-[#1E4648]">Rp {lastCompletedTx.total.toLocaleString('id-ID')}</span>
              </div>
              {lastCompletedTx.nominalDP ? (
                <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
                  <span>DP Terbayar / Sisa:</span>
                  <span className="font-bold text-rose-600">Rp {lastCompletedTx.nominalDP.toLocaleString('id-ID')} / Rp {(lastCompletedTx.sisaTagihan || 0).toLocaleString('id-ID')}</span>
                </div>
              ) : null}
            </div>

            {/* Print & Tag & WA Action Buttons */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handlePrintReceipt(lastCompletedTx)}
                  className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium py-2 rounded-md text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Struk
                </button>

                <button
                  onClick={() => handlePrintItemTag(lastCompletedTx)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 rounded-md text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Tag className="w-3.5 h-3.5" /> Label Tag
                </button>
              </div>

              <button
                onClick={() => handleWhatsAppStruk(lastCompletedTx)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-md text-xs transition flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" /> Kirim Struk WhatsApp
              </button>

              <button
                onClick={handleFinishSuccess}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-md text-xs transition mt-1"
              >
                ➕ Order Baru
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
                onClick={() => {
                  if (!customItemNama.trim()) return;
                  const price = Number(customItemHarga) || 0;
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
                }}
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

