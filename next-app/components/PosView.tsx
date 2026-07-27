'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Plus, Minus, Trash2, User, X, Check, CreditCard, Printer, Send, CheckCircle2, DollarSign,
  Zap, Tag, Clock, ShieldAlert, FileSpreadsheet, Lock, Unlock, TagIcon, ShoppingCart, ArrowRight,
  WashingMachine, Wind, Flame, Sparkles, Droplets, ShoppingBag, Shirt, Package, Coffee, CupSoda, Utensils
} from 'lucide-react';
import { LayananItem, CartItem, Pegawai, Transaksi, KecepatanLayanan, ShiftKasir } from '@/lib/types';
import { runBackend } from '@/lib/api';
import PrinterModal, { PrintType } from '@/components/PrinterModal';

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

  // Bluetooth Thermal Printer Modal State
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [printTypeForModal, setPrintTypeForModal] = useState<PrintType>('struk');
  const [txForModal, setTxForModal] = useState<Transaksi | null>(null);

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

  const handleBukaShift = async () => {
    const val = Number(kasAwalInput) || 0;
    const kasirNama = selectedPetugas || 'Siti Rahma (Kasir)';
    const newShift: ShiftKasir = {
      idShift: `SHF-${Date.now().toString().slice(-6)}`,
      idUser: 'KASIR-01',
      namaKasir: kasirNama,
      kasAwal: val,
      status: 'Buka',
      waktuBuka: new Date().toLocaleString('id-ID')
    };
    setShiftAktif(newShift);
    localStorage.setItem('duasisi_shift_aktif', JSON.stringify(newShift));
    setShowBukaShiftModal(false);

    // Auto sync Clock In Presensi to backend
    try {
      await runBackend('clockInPegawai', kasirNama, 'Shift Kasir POS', `Buka Shift Saldo Kas Awal Rp ${val.toLocaleString('id-ID')}`);
    } catch (err) {}
  };

  const handleTutupShift = async () => {
    if (!shiftAktif) return;
    const fisik = Number(kasAkhirFisik) || (shiftAktif.kasAwal + (shiftAktif.totalOmzetTunai || 0));
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

    // Auto sync Clock Out Presensi to backend
    try {
      await runBackend('clockOutPegawai', shiftAktif.namaKasir, `Tutup Shift Kas Fisik Rp ${fisik.toLocaleString('id-ID')} | Selisih Rp ${selisih.toLocaleString('id-ID')}`);
    } catch (err) {}

    alert(`✅ Shift Kasir & Clock Out Presensi Selesai!\nKas Fisik: Rp ${fisik.toLocaleString('id-ID')} | Selisih: Rp ${selisih.toLocaleString('id-ID')}`);
    setShowBukaShiftModal(true);
  };

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
      const adjustedPrice = item.hargaSatuan;
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

    // Auto calculate SLA estimation date (24 hours default)
    const now = new Date();
    now.setHours(now.getHours() + 24);
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
    setTxForModal(tx);
    setPrintTypeForModal('struk');
    setIsPrinterModalOpen(true);
  };

  const handlePrintItemTag = (tx: Transaksi) => {
    setTxForModal(tx);
    setPrintTypeForModal('label');
    setIsPrinterModalOpen(true);
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
    <div className="flex gap-0 h-[calc(100vh-56px)] overflow-hidden w-full bg-slate-50">
      {/* LEFT: Catalog */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar with Shift Indicator & Speed Selector */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
          {/* Service Mode Segmented Control */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0">
            <button
              onClick={() => setMode('SelfService')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'SelfService'
                  ? 'bg-[#1E4648] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Self Service
            </button>
            <button
              onClick={() => setMode('FullService')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'FullService'
                  ? 'bg-[#1E4648] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Service
            </button>
          </div>

          {/* Shift Status Widget */}
          <div className="flex items-center gap-2 shrink-0">
            {shiftAktif ? (
              <button
                onClick={() => setShowTutupShiftModal(true)}
                className="bg-emerald-50/80 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition"
                title="Shift Berjalan — Klik untuk Tutup Shift Kasir"
              >
                <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Shift Aktif (Rp {shiftAktif.kasAwal.toLocaleString('id-ID')})</span>
              </button>
            ) : (
              <button
                onClick={() => setShowBukaShiftModal(true)}
                className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Buka Shift</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar & Manual Add */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari layanan, produk laundry, makanan..."
              className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648] bg-slate-50/50 focus:bg-white transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowCustomItemModal(true)}
            className="bg-slate-100 border border-slate-200 text-slate-700 hover:bg-[#1E4648] hover:text-white hover:border-[#1E4648] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition shrink-0"
            title="Tambah Layanan / Item Manual"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Item Manual</span>
          </button>
        </div>

        {/* Category Filter Bar */}
        <div className="px-4 py-2 bg-white border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shrink-0 border ${
                  isActive
                    ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-300' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
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
                  const effectivePrice = item.hargaSatuan;
                  const styleCfg = getLayananStyleConfig(item.layanan);
                  const IconComp = styleCfg.Icon;

                  // Parse specifications
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
                      className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between transition-all duration-150 cursor-pointer relative select-none hover:shadow-sm ${
                        qtyInCart > 0 
                          ? 'border-[#1E4648] bg-teal-50/20 ring-1 ring-[#1E4648]/20' 
                          : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                      onClick={() => updateCart(item, 1)}
                    >
                      {/* Active Quantity Badge */}
                      {qtyInCart > 0 && (
                        <span className="absolute -top-2 -right-2 bg-[#1E4648] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs border border-white flex items-center gap-0.5 z-10">
                          <Check className="w-3 h-3 text-teal-300" />
                          <span>{qtyInCart}x</span>
                        </span>
                      )}

                      <div>
                        {/* Top Row: Clean Icon & Spec Badge */}
                        <div className="flex items-center justify-between gap-1.5 mb-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                            <IconComp className="w-4 h-4 text-[#1E4648]" />
                          </div>

                          {combinedSpec && (
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 shrink-0">
                              {combinedSpec}
                            </span>
                          )}
                        </div>

                        {/* Product Title */}
                        <h3 className="font-semibold text-xs sm:text-sm text-slate-800 leading-snug mb-1.5 line-clamp-2">
                          {item.layanan}
                        </h3>

                        {/* Price */}
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-sm font-bold text-[#1E4648] tracking-tight">
                            Rp {effectivePrice.toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            /{item.satuan || 'paket'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Controls */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        {qtyInCart > 0 ? (
                          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-teal-200">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                              className="w-6 h-6 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold rounded-md flex items-center justify-center transition"
                              title="Kurangi Qty"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="flex-1 text-center text-xs font-bold text-[#1E4648]">
                              {qtyInCart}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                              className="w-6 h-6 bg-[#1E4648] text-white font-bold rounded-md flex items-center justify-center transition"
                              title="Tambah Qty"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                            className="w-full bg-slate-50 hover:bg-[#1E4648] text-slate-600 hover:text-white border border-slate-200/80 font-medium py-1.5 rounded-lg text-xs transition flex items-center justify-center gap-1"
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

                const mainServices = filteredAll.filter(
                  (i) => i.kategori === 'Layanan' || (!i.kategori && getLayananStyleConfig(i.layanan).categoryGroup === 'Layanan Utama')
                );
                const extraServices = filteredAll.filter(
                  (i) => i.kategori === 'Layanan Tambahan' || (!i.kategori && getLayananStyleConfig(i.layanan).categoryGroup === 'Layanan Tambahan')
                );
                const laundryProducts = filteredAll.filter(
                  (i) => i.kategori === 'Produk' || (!i.kategori && getLayananStyleConfig(i.layanan).categoryGroup === 'Produk Laundry')
                );
                const fnbProducts = filteredAll.filter(
                  (i) => i.kategori === 'MakananMinuman' || (!i.kategori && getLayananStyleConfig(i.layanan).categoryGroup === 'Makanan & Minuman')
                );

                if (selectedCategoryTab !== 'Semua') {
                  const tabFiltered = (layananList || []).filter((i) => {
                    const matchSearch = i.layanan.toLowerCase().includes(filterLower);
                    let matchTab = false;
                    if (selectedCategoryTab === 'Layanan') {
                      matchTab = i.kategori === 'Layanan' || (!i.kategori && getLayananStyleConfig(i.layanan).categoryGroup === 'Layanan Utama');
                    } else if (selectedCategoryTab === 'Layanan Tambahan') {
                      matchTab = i.kategori === 'Layanan Tambahan' || (!i.kategori && getLayananStyleConfig(i.layanan).categoryGroup === 'Layanan Tambahan');
                    } else if (selectedCategoryTab === 'Produk') {
                      matchTab = i.kategori === 'Produk' || (!i.kategori && getLayananStyleConfig(i.layanan).categoryGroup === 'Produk Laundry');
                    } else if (selectedCategoryTab === 'MakananMinuman') {
                      matchTab = i.kategori === 'MakananMinuman' || (!i.kategori && getLayananStyleConfig(i.layanan).categoryGroup === 'Makanan & Minuman');
                    }
                    return matchSearch && matchTab;
                  });

                  if (tabFiltered.length === 0) {
                    return (
                      <div className="col-span-full text-center py-12 text-slate-400 text-xs">
                        Tidak ada item ditemukan untuk kategori ini.
                      </div>
                    );
                  }

                  return (
                    <div className="col-span-full grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                      {tabFiltered.map((item, idx) => renderCard(item, idx))}
                    </div>
                  );
                }

                return (
                  <div className="col-span-full space-y-5">
                    {/* Group 1: Layanan Utama */}
                    {mainServices.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2.5 px-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1E4648]" />
                          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Layanan Laundry Utama
                          </h2>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.2 rounded-full">
                            {mainServices.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                          {mainServices.map((item, idx) => renderCard(item, idx))}
                        </div>
                      </div>
                    )}

                    {/* Group 2: Layanan Tambahan */}
                    {extraServices.length > 0 && (
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-2.5 px-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Layanan Tambahan & Special Care
                          </h2>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.2 rounded-full">
                            {extraServices.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                          {extraServices.map((item, idx) => renderCard(item, idx + 200))}
                        </div>
                      </div>
                    )}

                    {/* Group 3: Produk Laundry */}
                    {laundryProducts.length > 0 && (
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-2.5 px-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Produk Laundry & Packing
                          </h2>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.2 rounded-full">
                            {laundryProducts.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                          {laundryProducts.map((item, idx) => renderCard(item, idx + 400))}
                        </div>
                      </div>
                    )}

                    {/* Group 4: Makanan & Minuman */}
                    {fnbProducts.length > 0 && (
                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-2.5 px-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Makanan & Minuman (F&B Retail)
                          </h2>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.2 rounded-full">
                            {fnbProducts.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
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

      {/* Floating Sticky Bottom Bar on Mobile (< md) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[120] bg-[#1E4648] text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 min-w-0" onClick={() => setShowMobileCart(true)}>
          <div className="relative shrink-0">
            <ShoppingCart className="w-5 h-5 text-teal-200" />
            {totalCartItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
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
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shrink-0"
        >
          <span>Keranjang & Bayar</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* RIGHT: Order Panel Backdrop & Responsive Drawer (< md Drawer, >= md Static Panel) */}
      {showMobileCart && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-[250] md:hidden animate-fade-in"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      <div className={`fixed inset-0 z-[300] bg-white flex flex-col w-full md:static md:w-[320px] lg:w-[340px] md:z-auto border-l border-slate-200/80 shrink-0 overflow-hidden transition-all duration-200 ${
        showMobileCart ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-0 md:opacity-100 hidden md:flex'
      }`}>
        {/* Order Header */}
        <div className="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between bg-white">
          <h2 className="text-sm font-bold text-slate-800">Keranjang Order</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCustModal(true)}
              className="text-xs font-medium text-[#1E4648] bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-slate-200/60 transition"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>{customer.nama || 'Pilih Pelanggan'}</span>
            </button>
            <button
              onClick={() => setShowMobileCart(false)}
              className="md:hidden p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
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
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                <ShoppingCart className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-xs font-semibold text-slate-600">Keranjang kosong</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Pilih layanan di sebelah kiri</div>
            </div>
          ) : (
            <div className="space-y-2">
              {cartArray.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-1.5">
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
                    className="w-full px-2.5 py-1 bg-white border border-slate-200/80 rounded-lg text-[11px] outline-none focus:border-[#1E4648]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Promo Code Section */}
        <div className="px-4 py-2.5 border-t border-slate-200/80 bg-slate-50/40">
          <div className="flex items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={kodePromoInput}
              onChange={(e) => setKodePromoInput(e.target.value)}
              placeholder="Kode voucher promo..."
              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-[#1E4648] uppercase font-medium placeholder:normal-case"
            />
            <button
              onClick={handleApplyPromo}
              className="px-3 py-1.5 bg-[#1E4648] hover:bg-[#153334] text-white text-xs font-semibold rounded-lg transition shrink-0"
            >
              Gunakan
            </button>
          </div>
          {diskonApplied.nilai > 0 && (
            <div className="flex justify-between items-center text-xs text-emerald-700 font-semibold mt-1.5 px-0.5">
              <span>Voucher ({diskonApplied.kode})</span>
              <span>-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        {/* Total & Checkout */}
        <div className="px-4 py-3.5 border-t border-slate-200/80 space-y-3 bg-white">
          <div className="space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-medium text-slate-700">Rp {subtotalCart.toLocaleString('id-ID')}</span>
            </div>
            {diskonApplied.nilai > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Diskon Voucher</span>
                <span>-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-slate-800 pt-2 border-t border-slate-100">
            <span>Total Tagihan</span>
            <span className="text-base font-extrabold text-[#1E4648]">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={clearCart}
              disabled={cartArray.length === 0}
              className="p-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-xl transition disabled:opacity-30 border border-slate-200/80"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1E4648] font-sans font-medium" 
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
                        <span className="text-slate-500 font-sans text-[10px]">{m.noHp}</span>
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

      {/* Shift Tutup Modal (FR-POS-29) — Integrated with Staff Clock In / Clock Out Presensi */}
      {showTutupShiftModal && shiftAktif && (
        <div className="fixed inset-0 z-[600] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Tutup Shift & Clock Out Presensi</h3>
                <p className="text-[11px] text-slate-500">Rekonsiliasi kas laci & pencatatan jam kerja staf</p>
              </div>
              <button onClick={() => setShowTutupShiftModal(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            
            {/* Section 1: Staff Clock In & Clock Out Presensi */}
            <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-200/80 space-y-2 text-xs mb-4">
              <div className="flex items-center justify-between font-bold text-[#1E4648] border-b border-teal-200/60 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-700" />
                  Staf / Petugas Kasir:
                </span>
                <span className="text-sm font-extrabold">{shiftAktif.namaKasir}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">⏰ Jam Clock In (Masuk)</span>
                  <span className="font-bold text-slate-800">{shiftAktif.waktuBuka}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">🏁 Jam Clock Out (Keluar)</span>
                  <span className="font-bold text-emerald-700">{new Date().toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Cash Reconciliation (Kas Laci) */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs mb-4">
              <div className="font-bold text-slate-800 border-b border-slate-200/80 pb-1 flex items-center justify-between">
                <span>💵 Rekonsiliasi Kas Laci</span>
                <span className="text-[10px] text-slate-400 font-medium">Shift ID: {shiftAktif.idShift}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Saldo Modal Kas Awal:</span>
                <span className="font-semibold">Rp {shiftAktif.kasAwal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Omzet Tunai Shift Ini:</span>
                <span className="font-bold text-emerald-700">+Rp {(shiftAktif.totalOmzetTunai || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 text-sm pt-2 border-t border-slate-200">
                <span>Ekspektasi Kas Fisik:</span>
                <span className="text-[#1E4648] text-base">Rp {(shiftAktif.kasAwal + (shiftAktif.totalOmzetTunai || 0)).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Section 3: Kas Fisik Akhir & Dynamic Difference Indicator */}
            <div className="space-y-3 mb-5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Hitung Kas Fisik Akhir di Laci (Rp) *</label>
                <input
                  type="number"
                  value={kasAkhirFisik}
                  onChange={(e) => setKasAkhirFisik(e.target.value)}
                  placeholder={(shiftAktif.kasAwal + (shiftAktif.totalOmzetTunai || 0)).toString()}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-extrabold outline-none focus:border-[#1E4648] bg-white font-sans"
                />
              </div>

              {/* Dynamic Status / Selisih Badge */}
              {(() => {
                const ekspektasi = shiftAktif.kasAwal + (shiftAktif.totalOmzetTunai || 0);
                const inputFisik = Number(kasAkhirFisik) || ekspektasi;
                const selisih = inputFisik - ekspektasi;

                if (selisih === 0) {
                  return (
                    <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg p-2 text-xs flex items-center justify-between font-bold">
                      <span>✅ Status Kas Fisik:</span>
                      <span>PAS (Selisih Rp 0)</span>
                    </div>
                  );
                } else if (selisih < 0) {
                  return (
                    <div className="bg-rose-50 border border-rose-300 text-rose-800 rounded-lg p-2 text-xs flex items-center justify-between font-bold">
                      <span>⚠️ Status Kas Fisik:</span>
                      <span>KURANG -Rp {Math.abs(selisih).toLocaleString('id-ID')}</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-2 text-xs flex items-center justify-between font-bold">
                      <span>ℹ️ Status Kas Fisik:</span>
                      <span>LEBIH +Rp {selisih.toLocaleString('id-ID')}</span>
                    </div>
                  );
                }
              })()}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowTutupShiftModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-xs font-bold transition">
                Batal
              </button>
              <button onClick={handleTutupShift} className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-2.5 rounded-lg text-xs transition shadow-md flex items-center justify-center gap-1.5">
                <span>Selesaikan Shift & Clock Out</span>
                <ArrowRight className="w-4 h-4" />
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-[#1E4648] font-sans font-medium" 
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
                          <span className="text-slate-500 font-sans text-[10px]">{m.noHp}</span>
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
      {/* Printer Modal for Struk & Label */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        tx={txForModal}
        printType={printTypeForModal}
      />
    </div>
  );
}

