'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  User, 
  Tag, 
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
  Edit3,
  Bluetooth,
  BluetoothOff,
  TrendingUp,
  Camera,
  RefreshCw,
  Gift,
  Lightbulb,
  Zap,
  AlertTriangle,
  Shirt,
  Layers,
  ShoppingBag,
  Utensils,
  Flame,
  Folder,
  Star,
  Delete,
  Copy,
  Coins,
  Smartphone
} from 'lucide-react';
import { LayananItem, CartItem, ShiftKasir, AbsensiConfig, UserRole } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import {
  isBluetoothSupported,
  getActiveDeviceInfo,
  requestAndConnectBluetoothDevice,
  sendRawEscPosData,
  generateTagEscPos,
  generateReceiptEscPos,
} from '@/lib/bluetoothPrinter';
import PrinterModal from '@/components/PrinterModal';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { validateAttendanceSecurity } from '@/lib/attendanceSecurity';
import { useDialog } from '@/components/DialogProvider';

interface CustomerState {
  nama: string;
  noHp: string;
  alamat?: string;
  tglLahir?: string;
  memberStatus?: string;
  isMember?: boolean;
  poin?: number;
  totalOrder?: number;
}

import { getLayananStyleConfig, getIconComponent, KategoriItem } from '@/lib/categoryUtils';

export default function PosView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert, showConfirm } = useDialog();
  const [layananList, setLayananList] = useState<LayananItem[]>([]);
  const [layananLoading, setLayananLoading] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('Semua');
  const [kategoriList, setKategoriList] = useState<KategoriItem[]>([]);
  const [poinRate, setPoinRate] = useState<number>(10000);
  
  // 1. Cart & Order State
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [customer, setCustomer] = useState<CustomerState>({ nama: '', noHp: '' });
  const [customerMode, setCustomerMode] = useState<'UMUM' | 'MEMBER'>('UMUM');
  const [customerSource, setCustomerSource] = useState<'BARU' | 'TERDAFTAR'>('BARU');
  const [showQuickAddMember, setShowQuickAddMember] = useState<boolean>(false);
  const [newMemberForm, setNewMemberForm] = useState({ nama: '', noHp: '', alamat: '', tglLahir: '' });
  const [savingMember, setSavingMember] = useState<boolean>(false);
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [voucherMsg, setVoucherMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [diskonApplied, setDiskonApplied] = useState<{ kode: string; nilai: number }>({ kode: '', nilai: 0 });
  const [promoList, setPromoList] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [showRekomendasiModal, setShowRekomendasiModal] = useState<boolean>(false);

  // Order Details Form State
  const [tipeLayanan, setTipeLayanan] = useState<'SelfService' | 'FullService' | ''>('');
  const [tingkatLayanan, setTingkatLayanan] = useState<string>('Reguler');
  const [dropOffPriorities, setDropOffPriorities] = useState<Array<{ id: string; nama: string; durasiJam: number; aktif?: boolean; multiplier?: number }>>([
    { id: 'p1', nama: 'Reguler', durasiJam: 48, aktif: true },
    { id: 'p2', nama: 'Express', durasiJam: 24, aktif: true },
    { id: 'p3', nama: 'Kilat', durasiJam: 6, aktif: true }
  ]);
  const [catatanOrderInput, setCatatanOrderInput] = useState<string>('');

  // Payment Form State
  const [namaKasirInput, setNamaKasirInput] = useState('Kasir 1');
  const [metodeBayar, setMetodeBayar] = useState<'Tunai' | 'QRIS' | 'Transfer' | 'Debit'>('Tunai');
  const [uangBayarInput, setUangBayarInput] = useState<string>('');
  const [qrisStatus, setQrisStatus] = useState<'PENDING' | 'SUCCESS'>('PENDING');
  const [refNoInput, setRefNoInput] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // Post Payment & Receipt State
  const [completedOrderData, setCompletedOrderData] = useState<any>(null);
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm' | 'label'>('58mm');
  const [successModalTab, setSuccessModalTab] = useState<'struk' | 'label'>('struk');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [btPrinting, setBtPrinting] = useState(false);
  const [showStrukModal, setShowStrukModal] = useState(false);

  // Expense tracking for shift close (Item-per-Item)
  const [expenseItemList, setExpenseItemList] = useState<Array<{ nama: string; nominal: string }>>([
    { nama: '', nominal: '' }
  ]);
  const [shiftExpenseCategory, setShiftExpenseCategory] = useState<string>('');
  const [expensePhotos, setExpensePhotos] = useState<Array<{ file: File; preview: string }>>([]);

  const totalShiftExpense = expenseItemList.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);

  const handleAddExpenseItem = () => {
    setExpenseItemList(prev => [...prev, { nama: '', nominal: '' }]);
  };

  const handleRemoveExpenseItem = (idx: number) => {
    setExpenseItemList(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      return updated.length > 0 ? updated : [{ nama: '', nominal: '' }];
    });
  };

  const handleUpdateExpenseItem = (idx: number, field: 'nama' | 'nominal', value: string) => {
    setExpenseItemList(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

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
    { nama: 'Budi Santoso', noHp: '081234567890', memberStatus: 'Member Gold', alamat: 'Jl. Melati No. 12', poin: 150 },
    { nama: 'Siti Rahma', noHp: '085712345678', memberStatus: 'Regular', alamat: 'Jl. Mawar No. 45', poin: 45 },
    { nama: 'Agus Wijaya', noHp: '082198765432', memberStatus: 'Member Silver', alamat: 'Griya Asri B3/10', poin: 80 },
  ]);
  const [staffList, setStaffList] = useState<{ id: string; nama: string; jabatan?: string }[]>([
    { id: '1', nama: 'Kasir 1 (Shift Pagi)' },
    { id: '2', nama: 'Kasir 2 (Shift Siang)' },
    { id: '3', nama: 'Admin Utama' },
  ]);

  const [showDetailTransaksiModal, setShowDetailTransaksiModal] = useState<boolean>(false);
  const [showKonfirmasiBayarModal, setShowKonfirmasiBayarModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [showPreviewStrukModal, setShowPreviewStrukModal] = useState<boolean>(false);

  const [showBukaShiftModal, setShowBukaShiftModal] = useState<boolean>(false);
  const [showTutupShiftModal, setShowTutupShiftModal] = useState<boolean>(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState<boolean>(false);
  const [showMobileCart, setShowMobileCart] = useState<boolean>(false);
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'list'>('grid');

  // Strict Mode Lock Screen State
  const [lockScreenStep, setLockScreenStep] = useState<1 | 2>(1);
  const [clockInShift, setClockInShift] = useState('Pagi');
  const [clockInCatatan, setClockInCatatan] = useState('');
  const [clockInSubmitting, setClockInSubmitting] = useState(false);

  // Shift & Kas State
  const [shiftAktif, setShiftAktif] = useState<ShiftKasir | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [closeShiftMode, setCloseShiftMode] = useState<'SERAH_TERIMA' | 'TUTUP_HARIAN'>('SERAH_TERIMA');
  const [replacementEmployeeId, setReplacementEmployeeId] = useState('');
  const [handoverResult, setHandoverResult] = useState<{ eligible: boolean; message: string } | null>(null);

  const [kasAwalInput, setKasAwalInput] = useState('100000');
  const [saldoMerchantAwalInput, setSaldoMerchantAwalInput] = useState('0');
  const [kasAkhirFisik, setKasAkhirFisik] = useState('');
  const [saldoMerchantAkhirInput, setSaldoMerchantAkhirInput] = useState('');
  const [customItemForm, setCustomItemForm] = useState({
    layanan: '',
    hargaSatuan: '',
    kategori: 'Add On' as LayananItem['kategori']
  });

  // Fetch Master Data â€” stale-while-revalidate (instant dari cache, fresh di background)
  useEffect(() => {
    // 1. Layanan Catalog
    runBackendCached<any[]>(
      'getLayananListAll',
      (data) => {
        if (Array.isArray(data)) {
          const activeData = data.filter(item => item.aktif === 'Y');
          setLayananList(activeData.map((item) => ({
            layanan: item.nama,
            hargaSatuan: Number(item.harga),
            tipe: item.tipe || 'SelfService',
            satuan: item.satuan || 'paket',
            icon: item.icon,
            kategori: item.kategori || (item.tipe === 'FullService' ? 'Drop Off' : 'Self Service'),
            kategoriDropOff: item.kategoriDropOff || '',
            kategoriWarna: item.kategoriWarna,
            kategoriIcon: item.kategoriIcon,
            idInventory: item.idInventory || null,
          })));
        }
        setLayananLoading(false);
      },
      10 * 60 * 1000 // 10 menit TTL — katalog jarang berubah
    );

    // Fetch Kategori
    runBackendCached<any[]>(
      'getKategoriList',
      (data) => {
        if (Array.isArray(data)) {
          setKategoriList(data.filter(item => item.aktif === 'Y'));
        }
      },
      10 * 60 * 1000
    );

    // 2. Customers List
    runBackendCached<any[]>(
      'getDaftarPelanggan',
      (data) => {
        if (Array.isArray(data)) {
          setCustomerList(data.map((c) => {
            const isMem = c.isMember || c.statusMember === 'MEMBER';
            const totalTx = Number(c.totalOrder || 0);
            return {
              nama: c.nama,
              noHp: c.noHp,
              alamat: c.alamat,
              isMember: isMem,
              memberStatus: isMem ? 'Member' : (totalTx > 1 ? 'Pelanggan Lama' : 'Pelanggan Baru'),
              poin: Number(c.saldoPoin || c.poin || 0),
              totalOrder: totalTx,
            };
          }));
        }
      },
      5 * 60 * 1000 // 5 menit TTL
    );

    // 3. Staff List
    runBackendCached<any[]>(
      'getPegawaiList',
      (data) => {
        if (Array.isArray(data)) {
          const activeStaff = data.filter((s: any) => s.status !== 'Resign' && s.status !== 'Non-Aktif');
          setStaffList(activeStaff);
          if (activeStaff[0]?.nama) setNamaKasirInput(activeStaff[0].nama);
        }
      },
      15 * 60 * 1000 // 15 menit TTL â€” pegawai sangat jarang berubah
    );

    // 4. Poin Config & Priority Drop Off Config
    runBackend<{rate: number}>('getPoinConfig').then(res => {
      if (res && res.rate) setPoinRate(res.rate);
    }).catch(() => {});

    runBackendCached<any[]>('getPriorityConfig', (data) => {
      if (Array.isArray(data) && data.length > 0) {
        setDropOffPriorities(data);
      }
    }, 10 * 60 * 1000);

    // 5. Promo List
    runBackendCached<any[]>(
      'getPromoList',
      (data) => {
        if (Array.isArray(data)) {
          setPromoList(data.filter(p => p.statusAktif));
        }
      },
      5 * 60 * 1000
    );

    // 6. Inventory List
    runBackendCached<any[]>(
      'getInventoryList',
      (data) => {
        if (Array.isArray(data)) {
          setInventoryList(data);
        }
      },
      3 * 60 * 1000
    );
  }, []);

  const refreshActiveShift = useCallback(async () => {
    setShiftLoading(true);
    try {
      const data = await runBackend<ShiftKasir | null>('getKasShiftAktif', 'OUTLET-UTAMA');
      if (data && data.idShift) {
        setShiftAktif(data);
      } else {
        setShiftAktif(null);
      }
    } catch (error) {
      console.error('Gagal memuat kas shift:', error);
      setToastMsg('Kas shift belum dapat dimuat. Periksa koneksi backend.');
      setShiftAktif(null);
    } finally {
      setShiftLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshActiveShift(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshActiveShift]);

  // Dynamic categories combining Master Kategori and loaded product categories
  const effectiveCategories = React.useMemo(() => {
    const catsMap = new Map<string, { id: string; label: string; icon: any; warna?: string }>();
    
    // Always start with 'Semua'
    catsMap.set('semua', { id: 'Semua', label: 'Semua Produk', icon: Layers, warna: '' });

    // 1. Add categories from master kategoriList
    kategoriList.forEach(k => {
      if (k.nama && k.nama.trim()) {
        catsMap.set(k.nama.toLowerCase().trim(), {
          id: k.nama.trim(),
          label: k.nama.trim(),
          icon: getIconComponent(k.icon),
          warna: k.warna
        });
      }
    });

    // 2. Add any unique categories found on loaded products
    layananList.forEach(l => {
      const katName = (l.kategori || (l.tipe === 'FullService' ? 'Drop Off' : 'Self Service')).trim();
      if (katName && !catsMap.has(katName.toLowerCase())) {
        const style = getLayananStyleConfig(l, kategoriList);
        catsMap.set(katName.toLowerCase(), {
          id: katName,
          label: katName,
          icon: style.Icon,
          warna: l.kategoriWarna
        });
      }
    });

    return Array.from(catsMap.values());
  }, [kategoriList, layananList]);

  const filteredLayanan = React.useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    const filtered = (layananList || []).filter((item) => {
      const { categoryName } = getLayananStyleConfig(item, kategoriList);
      const matchSearch =
        item.layanan.toLowerCase().includes(searchLower) ||
        categoryName.toLowerCase().includes(searchLower);

      if (!matchSearch) return false;
      if (selectedCategoryTab === 'Semua') return true;

      const itemKat = categoryName.toLowerCase().trim();
      const selectedKat = selectedCategoryTab.toLowerCase().trim();

      return itemKat === selectedKat;
    });

    // Build category index map based on effectiveCategories (Master Kategori order)
    const categoryOrderMap = new Map<string, number>();
    effectiveCategories.forEach((cat, index) => {
      if (cat.id) categoryOrderMap.set(cat.id.toLowerCase().trim(), index);
      if (cat.label) categoryOrderMap.set(cat.label.toLowerCase().trim(), index);
    });

    // Sort products matching the category tab sequence
    return [...filtered].sort((a, b) => {
      const { categoryName: catA } = getLayananStyleConfig(a, kategoriList);
      const { categoryName: catB } = getLayananStyleConfig(b, kategoriList);

      const keyA = (catA || '').toLowerCase().trim();
      const keyB = (catB || '').toLowerCase().trim();

      const orderA = categoryOrderMap.has(keyA) ? categoryOrderMap.get(keyA)! : 999;
      const orderB = categoryOrderMap.has(keyB) ? categoryOrderMap.get(keyB)! : 999;

      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return 0; // preserve original order inside same category
    });
  }, [layananList, search, selectedCategoryTab, kategoriList, effectiveCategories]);

  // Calculate totals
  const cartArray = Object.values(cart);
  const totalCartItems = cartArray.reduce((acc, curr) => acc + curr.qty, 0);
  
  const subtotalCart = cartArray.reduce((acc, curr) => {
    return acc + (curr.qty * curr.hargaSatuan);
  }, 0);
  
  const grandTotal = Math.max(0, subtotalCart - diskonApplied.nilai);

  // Dynamic Recommendation Engine for POS
  const rekomendasiKasir = React.useMemo(() => {
    const list: Array<{
      id: string;
      tipe: 'PROMO' | 'UPSELL' | 'POIN' | 'PERINGATAN';
      judul: string;
      deskripsi: string;
      badge: string;
      badgeColor: string;
      actionText?: string;
      onAction?: () => void;
    }> = [];

    // 1. Rekomendasi Promo / Voucher Terbaik yang memenuhi kriteria belanja
    if (promoList.length > 0 && subtotalCart > 0) {
      const eligiblePromos = promoList.filter(p => p.statusAktif && subtotalCart >= (p.minTransaksi || 0));
      if (eligiblePromos.length > 0) {
        // Hitung estimasi diskon terbesar
        const bestPromo = [...eligiblePromos].sort((a, b) => {
          const potA = a.jenisDiskon === 'Persen' ? (subtotalCart * a.nilaiDiskon) / 100 : a.nilaiDiskon;
          const potB = b.jenisDiskon === 'Persen' ? (subtotalCart * b.nilaiDiskon) / 100 : b.nilaiDiskon;
          return potB - potA;
        })[0];

        const potVal = bestPromo.jenisDiskon === 'Persen'
          ? Math.round((subtotalCart * bestPromo.nilaiDiskon) / 100)
          : bestPromo.nilaiDiskon;

        const isCurrentlyApplied = diskonApplied.kode.toUpperCase() === bestPromo.kodeVoucher.toUpperCase();

        if (!isCurrentlyApplied) {
          list.push({
            id: `promo-${bestPromo.idPromo || bestPromo.kodeVoucher}`,
            tipe: 'PROMO',
            judul: `Promo Hemat: Voucher ${bestPromo.kodeVoucher}`,
            deskripsi: `Belanja telah memenuhi syarat min. Rp ${(bestPromo.minTransaksi || 0).toLocaleString('id-ID')}. Dapatkan potongan Rp ${potVal.toLocaleString('id-ID')} (${bestPromo.jenisDiskon === 'Persen' ? `${bestPromo.nilaiDiskon}%` : `Rp ${bestPromo.nilaiDiskon.toLocaleString('id-ID')}`}).`,
            badge: 'Hemat Promo',
            badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            actionText: 'Terapkan Voucher',
            onAction: () => {
              setVoucherInput(bestPromo.kodeVoucher);
              setDiskonApplied({
                kode: bestPromo.kodeVoucher,
                nilai: potVal
              });
              setVoucherMsg({
                type: 'success',
                text: `Voucher ${bestPromo.kodeVoucher} berhasil dipasang!`
              });
              setShowRekomendasiModal(false);
            }
          });
        }
      }
    }

    // 2. Rekomendasi Poin Loyalitas Pelanggan
    const currCust = customerList.find(c => (customer.noHp && c.noHp === customer.noHp) || (customer.nama && c.nama === customer.nama));
    const poinPelanggan = currCust?.poin || 0;
    if (poinPelanggan >= 10 && subtotalCart > 0 && diskonApplied.nilai === 0) {
      const nilaiPotonganPoin = poinPelanggan * 100; // Tiap 1 poin = Rp 100
      list.push({
        id: 'poin-loyalty',
        tipe: 'POIN',
        judul: `Tukar ${poinPelanggan} Poin Pelanggan`,
        deskripsi: `Pelanggan memiliki ${poinPelanggan} Poin. Tawarkan penukaran poin senilai diskon Rp ${nilaiPotonganPoin.toLocaleString('id-ID')}.`,
        badge: 'Reward Poin',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        actionText: 'Gunakan Diskon Poin',
        onAction: () => {
          setDiskonApplied({
            kode: `POIN-${poinPelanggan}PTS`,
            nilai: nilaiPotonganPoin
          });
          setVoucherMsg({
            type: 'success',
            text: `Diskon Poin ${poinPelanggan} pts (-Rp ${nilaiPotonganPoin.toLocaleString('id-ID')}) diterapkan!`
          });
          setShowRekomendasiModal(false);
        }
      });
    }

    // 3. Rekomendasi Add-On / Upselling Dinamis dari katalog layanan
    const hasServiceInCart = cartArray.some(item => 
      item.tipe === 'SelfService' || 
      item.tipe === 'FullService' || 
      item.kategori === 'Self Service' || 
      item.kategori === 'Drop Off'
    );
    const addOnServices = layananList.filter(l => l.kategori === 'Add On' || !l.tipe || (l.tipe as string) === '');
    if (hasServiceInCart && addOnServices.length > 0) {
      const unselectedAddOns = addOnServices.filter(a => !cart[a.layanan]);
      if (unselectedAddOns.length > 0) {
        unselectedAddOns.slice(0, 3).forEach(addon => {
          list.push({
            id: `addon-${addon.layanan}`,
            tipe: 'UPSELL',
            judul: `Tawarkan: ${addon.layanan}`,
            deskripsi: `Lengkapi cucian dengan ${addon.layanan} hanya Rp ${(addon.hargaSatuan || 0).toLocaleString('id-ID')}/${addon.satuan || 'item'}.`,
            badge: 'Saran Tambahan',
            badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
            actionText: '+ Tambah ke Keranjang',
            onAction: () => {
              updateCart({
                layanan: addon.layanan,
                hargaSatuan: addon.hargaSatuan,
                tipe: addon.tipe,
                satuan: addon.satuan,
                idInventory: addon.idInventory,
                inventoryDeductionQty: (addon as any).inventoryDeductionQty
              }, 1);
            }
          });
        });
      }
    }

    // 4. Peringatan Stok Inventory Kritis
    cartArray.forEach(item => {
      if (item.idInventory) {
        const inv = inventoryList.find(i => i.id === item.idInventory);
        if (inv) {
          const deduction = (item.inventoryDeductionQty !== undefined ? Number(item.inventoryDeductionQty) : 1) * item.qty;
          const sisaStok = inv.stok - deduction;
          if (sisaStok <= (inv.stokMinimum || 0)) {
            list.push({
              id: `stock-warn-${inv.id}`,
              tipe: 'PERINGATAN',
              judul: `Peringatan Stok: ${inv.nama}`,
              deskripsi: `Sisa stok saat ini ${inv.stok} ${inv.satuan}. Transaksi ini akan menyisakan ${sisaStok.toFixed(1)} ${inv.satuan} (mencapai batas minimum ${inv.stokMinimum} ${inv.satuan}).`,
              badge: sisaStok <= 0 ? 'Stok Habis' : 'Stok Menipis',
              badgeColor: 'bg-rose-100 text-rose-800 border-rose-200'
            });
          }
        }
      }
    });

    return list;
  }, [cartArray, subtotalCart, promoList, diskonApplied, customerList, customer, layananList, inventoryList, cart]);

  // Quick Member Registration Handler
  const handleDaftarMemberQuick = async (namaVal?: string, hpVal?: string, alamatVal?: string, tglLahirVal?: string) => {
    const finalNama = (namaVal || newMemberForm.nama || customer.nama).trim();
    const finalHp = (hpVal || newMemberForm.noHp || customer.noHp).trim();
    const finalAlamat = (alamatVal || newMemberForm.alamat || customer.alamat || '').trim();
    const finalTglLahir = (tglLahirVal || newMemberForm.tglLahir || '').trim();

    if (!finalNama || !finalHp) {
      await showAlert('Nama dan No. WhatsApp/HP wajib diisi untuk mendaftarkan member!', 'warning');
      return;
    }
    if (!finalTglLahir) {
      await showAlert('Tanggal Lahir (TTL) wajib diisi untuk pendaftaran Member!', 'warning');
      return;
    }
    if (!finalAlamat) {
      await showAlert('Alamat tempat tinggal wajib diisi untuk pendaftaran Member!', 'warning');
      return;
    }

    setSavingMember(true);
    try {
      const res = await runBackend<{ success: boolean; message: string }>('daftarMember', {
        nama: finalNama,
        noHp: finalHp,
        alamat: finalAlamat,
        tglLahir: finalTglLahir
      });

      if (res && res.success) {
        clearCache('getDaftarPelanggan');
        const updatedList = await runBackend<any[]>('getDaftarPelanggan');
        if (Array.isArray(updatedList)) {
          setCustomerList(updatedList.map((c) => {
            const isMem = c.isMember || c.statusMember === 'MEMBER';
            const totalTx = Number(c.totalOrder || 0);
            return {
              nama: c.nama,
              noHp: c.noHp,
              alamat: c.alamat,
              tglLahir: c.tglLahir,
              isMember: isMem,
              memberStatus: isMem ? 'Member' : (totalTx > 1 ? 'Pelanggan Lama' : 'Pelanggan Baru'),
              poin: Number(c.saldoPoin || c.poin || 0),
              totalOrder: totalTx,
            };
          }));
        }

        setCustomer({
          nama: finalNama,
          noHp: finalHp,
          alamat: finalAlamat,
          tglLahir: finalTglLahir,
          isMember: true,
          memberStatus: 'Member',
          poin: 0,
          totalOrder: 0
        });
        setCustomerMode('MEMBER');
        setCustomerSource('TERDAFTAR');
        setShowQuickAddMember(false);
        setNewMemberForm({ nama: '', noHp: '', alamat: '', tglLahir: '' });
        await showAlert(res.message || `Member ${finalNama} berhasil didaftarkan!`, 'success');
      } else {
        await showAlert(res?.message || 'Gagal mendaftarkan member baru.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      await showAlert('Terjadi kesalahan saat mendaftar member: ' + (err?.message || String(err)), 'error');
    } finally {
      setSavingMember(false);
    }
  };

  // Handle phone input change with auto-check
  const handleCustomerPhoneInput = (phoneVal: string) => {
    const clean = phoneVal.replace(/[^0-9]/g, '');
    setCustomer(prev => {
      if (clean.length >= 8) {
        const found = customerList.find(c => {
          const cClean = (c.noHp || '').replace(/[^0-9]/g, '');
          return cClean && (cClean === clean || cClean.endsWith(clean) || clean.endsWith(cClean));
        });

        if (found) {
          return {
            ...prev,
            noHp: phoneVal,
            nama: prev.nama && prev.nama !== 'Pelanggan Umum' ? prev.nama : found.nama,
            alamat: found.alamat,
            isMember: found.isMember,
            memberStatus: found.memberStatus,
            poin: Number(found.poin || 0),
            totalOrder: Number(found.totalOrder || 0),
          };
        }
      }
      return { ...prev, noHp: phoneVal };
    });
  };

  // Toast Auto Clear
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Auto-sync tingkatLayanan to mapped priority of Drop Off item in cart
  useEffect(() => {
    const items = Object.values(cart);
    const dropOffItem = items.find(i => (i as any).kategoriDropOff || i.tipe === 'FullService' || (i.kategori || '').toLowerCase().includes('drop'));
    if (dropOffItem) {
      const mappedPri = (dropOffItem as any).kategoriDropOff;
      if (mappedPri) {
        setTingkatLayanan(mappedPri);
      } else {
        const nLower = (dropOffItem.layanan || '').toLowerCase();
        if (nLower.includes('kilat')) setTingkatLayanan('Kilat');
        else if (nLower.includes('express') || nLower.includes('ekspres')) setTingkatLayanan('Express');
        else if (nLower.includes('sameday')) setTingkatLayanan('Sameday');
      }
    }
  }, [cart]);

  // Cart Helper
  const updateCart = (layanan: LayananItem, delta: number, catatanOverride?: string) => {
    if (delta > 0) {
      if (layanan.kategoriDropOff) {
        setTingkatLayanan(layanan.kategoriDropOff);
      } else if (layanan.tipe === 'FullService' || (layanan.kategori || '').toLowerCase().includes('drop')) {
        const nLower = (layanan.layanan || '').toLowerCase();
        if (nLower.includes('kilat')) setTingkatLayanan('Kilat');
        else if (nLower.includes('express') || nLower.includes('ekspres')) setTingkatLayanan('Express');
        else if (nLower.includes('sameday')) setTingkatLayanan('Sameday');
      }
    }

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
          kategori: layanan.kategori,
          kategoriDropOff: layanan.kategoriDropOff || '',
          idInventory: layanan.idInventory || null,
          inventoryDeductionQty: layanan.inventoryDeductionQty,
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

  // Voucher Application (Connected to Backend Promo Database)
  const handleApplyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherMsg({ type: 'error', text: 'Masukkan kode voucher terlebih dahulu' });
      return;
    }
    const isMemberCust = Boolean(customer.isMember || customerMode === 'MEMBER');
    const custPhone = customer.noHp ? customer.noHp.trim() : '';

    try {
      const res = await runBackend<{ valid: boolean; kode?: string; nilai?: number; message?: string }>('validasiVoucher', code, subtotalCart, custPhone, isMemberCust);
      if (res.valid && res.nilai !== undefined) {
        setDiskonApplied({ kode: code, nilai: res.nilai });
        setVoucherMsg({ type: 'success', text: `Voucher ${code} terpasang (Diskon - Rp ${(res.nilai || 0).toLocaleString('id-ID')})` });
      } else {
        setVoucherMsg({ type: 'error', text: res.message || 'Kode voucher tidak valid' });
      }
    } catch {
      // Fallback local check
      if (code === 'HEMAT10') {
        const pot = Math.round(subtotalCart * 0.1);
        setDiskonApplied({ kode: code, nilai: pot });
        setVoucherMsg({ type: 'success', text: `Voucher ${code} terpasang (Diskon 10% - Rp ${(pot || 0).toLocaleString('id-ID')})` });
      } else if (code === 'MEMBERVIP' && !isMemberCust) {
        setVoucherMsg({ type: 'error', text: 'Voucher MEMBERVIP khusus untuk pelanggan Member terdaftar.' });
      } else {
        setVoucherMsg({ type: 'error', text: 'Kode voucher tidak valid' });
      }
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

  // Step 3: Handle Add New Customer Sub-Form & Save to Google Sheets
  const handleAddNewCustomer = async () => {
    if (!newCustNama.trim() || !newCustNoHp.trim()) {
      await showAlert('Nama dan No. HP Pelanggan wajib diisi!', 'warning');
      return;
    }
    const newEntry: CustomerState = {
      nama: newCustNama.trim(),
      noHp: newCustNoHp.trim(),
      alamat: newCustAlamat.trim() || undefined,
      memberStatus: 'Pelanggan Baru'
    };
    try {
      await runBackend('simpanPelangganJikaBaru', newCustNama.trim(), newCustNoHp.trim(), newCustAlamat.trim());
    } catch (e) {
      console.warn('Backend save customer error:', e);
    }
    setCustomerList([newEntry, ...customerList]);
    setCustomer(newEntry);
    setShowAddCustForm(false);
    setNewCustNama('');
    setNewCustNoHp('');
    setNewCustAlamat('');
    setShowCustModal(false);
  };

  // Estimasi selesai khusus Drop Off berdasarkan konfigurasi prioritas
  const calculateEstimasiSelesai = (prioritasName: string = 'Reguler') => {
    const priority = dropOffPriorities.find(p => p.nama.toLowerCase() === prioritasName.toLowerCase()) || { durasiJam: 48 };
    const durasi = Number(priority.durasiJam) || 48;
    const targetDate = new Date(Date.now() + durasi * 3600 * 1000);
    const dateStr = targetDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = targetDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr} WIB (${durasi} Jam)`;
  };

  const handleConfirmPaymentSafe = async () => {
    if (paymentSubmitting) return;
    if (!shiftAktif) {
      await showAlert('Buka kas shift terlebih dahulu sebelum memproses pembayaran.', 'warning');
      setShowDetailTransaksiModal(false);
      setShowBukaShiftModal(true);
      return;
    }
    const kasir = namaKasirInput || 'Kasir 1';
    const custName = customer.nama || 'Pelanggan Umum';
    const total = grandTotal;
    const bayar = Number(uangBayarInput) || total;

    if (!customer.nama.trim() || !customer.noHp.trim()) {
      await showAlert('Nama dan No. HP / WhatsApp pelanggan wajib diisi.', 'warning');
      return;
    }
    if (metodeBayar === 'Tunai' && (!uangBayarInput || bayar < total)) {
      await showAlert('Nominal uang tunai belum cukup.', 'warning');
      return;
    }
    if (metodeBayar !== 'Tunai' && qrisStatus !== 'SUCCESS') {
      // Non-tunai: langsung lanjut tanpa verifikasi tambahan
    }

    setPaymentSubmitting(true);
    try {
      const hasDropOff = cartArray.some((i) => i.tipe === 'FullService' || (i as any).kategori === 'Drop Off');
      const hasSelfService = cartArray.some((i) => i.tipe === 'SelfService' || (i as any).kategori === 'Self Service');
      const autoTipeLayanan = hasDropOff ? 'FullService' : (hasSelfService ? 'SelfService' : 'Retail');

      const res = await runBackend<{ success: boolean; noNota: string; total: number; token?: string }>('simpanTransaksi', {
        namaPelanggan: custName,
        noHp: customer.noHp,
        kasir,
        tipeLayanan: autoTipeLayanan,
        tingkatLayanan: hasDropOff ? tingkatLayanan : 'Reguler',
        metodeBayar,
        nominalBayar: metodeBayar === 'Tunai' ? bayar : total,
        referensiPembayaran: refNoInput.trim(),
        voucher: diskonApplied.kode || 'None',
        diskon: diskonApplied.nilai,
        catatan: catatanOrderInput,
        items: cartArray.map((i) => {
          return { layanan: i.layanan, qty: i.qty, hargaSatuan: i.hargaSatuan, idInventory: i.idInventory, inventoryDeductionQty: i.inventoryDeductionQty };
        })
      });
      if (!res?.success || !res.noNota) throw new Error('Backend tidak mengembalikan nomor nota');

      const resTotal = Number(res.total) || grandTotal;
      const estimasi = hasDropOff ? calculateEstimasiSelesai(tingkatLayanan) : '';
      const currCust = customerList.find(c => (customer.noHp && c.noHp === customer.noHp) || (customer.nama && c.nama === customer.nama));
      const isActualMember = Boolean((customer.isMember || customerMode === 'MEMBER') && (customer.isMember || currCust?.isMember));
      const saldoPoinLama = Number(customer.poin || currCust?.poin || 0);
      const poinEarned = isActualMember ? Math.floor(resTotal / (poinRate || 10000)) : 0;
      const saldoPoinBaru = isActualMember ? (saldoPoinLama + poinEarned) : 0;

      setCompletedOrderData({
        trxId: res.noNota,
        token: res.token || '',
        kasir,
        pelanggan: custName,
        noHp: customer.noHp,
        isMember: isActualMember,
        metodeBayar,
        subtotal: subtotalCart,
        diskon: diskonApplied.nilai || 0,
        diskonKode: diskonApplied.kode || '',
        poinEarned,
        saldoPoinAwal: isActualMember ? saldoPoinLama : 0,
        saldoPoinAkhir: isActualMember ? saldoPoinBaru : 0,
        total: resTotal,
        uangBayar: Number(bayar) || resTotal,
        kembalian: Math.max(0, (Number(bayar) || resTotal) - resTotal),
        items: cartArray.map(i => {
          return { ...i, hargaSatuan: Number(i.hargaSatuan) || 0, qty: Number(i.qty) || 0 };
        }),
        catatan: catatanOrderInput,
        tipeLayanan: autoTipeLayanan,
        tingkatLayanan,
        estimasiSelesai: estimasi,
        waktu: new Date().toLocaleTimeString('id-ID') + ' WIB',
        tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      });
      setShowDetailTransaksiModal(false);
      setShowSuccessModal(true);
      clearCache('getTransaksiList');
      clearCache('getLaporanRange');
    } catch (error) {
      console.error('Gagal menyimpan transaksi:', error);
      const msg = error instanceof Error ? error.message : 'Transaksi gagal disimpan.';
      await showAlert(`Transaksi gagal: ${msg}\n\nPastikan Apps Script sudah di-deploy ulang dan koneksi internet stabil.`, 'error');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // ── THERMAL PRINT (Bluetooth: Struk & Label Tag) ────────────────────────
  const handlePrintReceipt = async (type: 'struk' | 'label' = 'struk') => {
    if (!completedOrderData) return;
    if (!isBluetoothSupported()) {
      await showAlert('Browser ini tidak mendukung Web Bluetooth.\nGunakan Chrome / Edge di Android atau Desktop.', 'warning');
      return;
    }
    setBtPrinting(true);
    try {
      // Cek apakah printer sudah terkoneksi
      const deviceInfo = getActiveDeviceInfo();
      if (!deviceInfo.connected) {
        setToastMsg('Mencari printer Bluetooth...');
        await requestAndConnectBluetoothDevice();
      }
      // Siapkan data transaksi untuk ESC/POS
      const txForPrint = {
        noNota: completedOrderData.trxId,
        tanggal: completedOrderData.tanggal,
        namaPelanggan: completedOrderData.pelanggan,
        noHp: completedOrderData.noHp,
        total: completedOrderData.total,
        status: 'Selesai',
        estimasi: completedOrderData.estimasiSelesai || '',
        petugas: completedOrderData.kasir,
        tipe: completedOrderData.tipeLayanan || 'SelfService',
        tingkatLayanan: completedOrderData.tingkatLayanan || 'Reguler',
        catatan: completedOrderData.catatan || '',
        metodeBayar: completedOrderData.metodeBayar || 'Tunai',
        uangBayar: completedOrderData.uangBayar,
        kembalian: completedOrderData.kembalian,
        items: (completedOrderData.items || []).map((i: any) => ({
          layanan: i.layanan,
          qty: Number(i.qty) || 1,
          hargaSatuan: Number(i.hargaSatuan) || 0,
          subtotal: (Number(i.qty) || 1) * (Number(i.hargaSatuan) || 0),
          catatan: i.catatan || '',
        })),
      };
      const escData = type === 'label'
        ? generateTagEscPos(txForPrint as any)
        : generateReceiptEscPos(txForPrint as any, poinRate);
      await sendRawEscPosData(escData);
      setToastMsg(`✅ ${type === 'label' ? 'Label Tag' : 'Struk Thermal'} berhasil dicetak!`);
    } catch (err: any) {
      const msg = err?.message || 'Gagal mencetak';
      if (msg.includes('User cancelled') || msg.includes('cancelled')) {
        setToastMsg('Cetak dibatalkan.');
      } else {
        await showAlert(`Gagal cetak thermal:\n${msg}`, 'error');
      }
    } finally {
      setBtPrinting(false);
    }
  };

  const handlePrintThermalLabel = async () => {
    return handlePrintReceipt('label');
  };

  const handleOpenShift = async () => {
    const kasAwal = Number(kasAwalInput);
    if (!Number.isFinite(kasAwal) || kasAwal < 0) {
      await showAlert('Kas awal laci harus berupa angka nol atau lebih.', 'warning');
      return;
    }
    const saldoMerchantAwal = Number(saldoMerchantAwalInput);
    if (!Number.isFinite(saldoMerchantAwal) || saldoMerchantAwal < 0) {
      await showAlert('Saldo awal aplikasi merchant harus berupa angka nol atau lebih.', 'warning');
      return;
    }
    const selectedStaff = staffList.find((staff) => staff.nama === namaKasirInput) || staffList[0];
    setShiftSubmitting(true);
    try {
      const result = await runBackend<{ success: boolean; data?: ShiftKasir; message?: string }>('openKasShift', {
        idOutlet: 'OUTLET-UTAMA',
        userId: selectedStaff?.id || '-',
        namaKasir: selectedStaff?.nama || namaKasirInput || 'Kasir',
        kasAwal,
        saldoMerchantAwal,
      });
      if (!result?.success || !result.data) throw new Error(result?.message || 'Kas shift gagal dibuka.');
      setShiftAktif(result.data);
      setShowBukaShiftModal(false);
      setToastMsg(`Kas shift ${result.data.idShift} berhasil dibuka.`);
    } catch (error) {
      console.error(error);
      await showAlert(error instanceof Error ? error.message : 'Kas shift gagal dibuka.', 'error');
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleClockIn = async () => {
    const selectedStaff = staffList.find((staff) => staff.nama === namaKasirInput) || staffList[0];
    if (!selectedStaff) {
      await showAlert('Pilih nama kasir terlebih dahulu.', 'warning');
      return;
    }
    setClockInSubmitting(true);
    try {
      // Validasi Lokasi GPS & IP Whitelist jika diaktifkan di Pengaturan
      const absConfig = await runBackend<AbsensiConfig>('getAbsensiConfig').catch(() => null);
      const sec = await validateAttendanceSecurity(absConfig);
      if (!sec.valid) {
        await showAlert(sec.message || 'Verifikasi keamanan presensi gagal.', 'warning');
        return;
      }

      const res = await runBackend<{ success: boolean; message: string }>('clockInPegawai', selectedStaff.nama, clockInShift, clockInCatatan);
      if (res && res.success) {
        setLockScreenStep(2);
      } else {
        throw new Error(res?.message || 'Gagal Clock In.');
      }
    } catch (error) {
      console.error(error);
      await showAlert(error instanceof Error ? error.message : 'Terjadi kesalahan saat Clock In.', 'error');
    } finally {
      setClockInSubmitting(false);
    }
  };

  const handleCheckHandover = async () => {
    if (!shiftAktif || !replacementEmployeeId) {
      await showAlert('Pilih staf shift pengganti terlebih dahulu.', 'warning');
      return;
    }
    setShiftSubmitting(true);
    try {
      const result = await runBackend<{ eligible: boolean; message: string }>('handoverCheckKasShift', {
        shiftId: shiftAktif.idShift,
        idOutlet: 'OUTLET-UTAMA',
        replacementEmployeeId,
      });
      setHandoverResult(result);
    } catch (error) {
      console.error(error);
      setHandoverResult({ eligible: false, message: error instanceof Error ? error.message : 'Verifikasi handover gagal.' });
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!shiftAktif) return;
    const kasAkhir = Number(kasAkhirFisik);
    if (!Number.isFinite(kasAkhir) || kasAkhir < 0) {
      await showAlert('Kas akhir fisik harus berupa angka nol atau lebih.', 'warning');
      return;
    }
    if (closeShiftMode === 'SERAH_TERIMA' && !handoverResult?.eligible) {
      await showAlert('Clock In staf pengganti harus diverifikasi sebelum serah terima.', 'warning');
      return;
    }
    setShiftSubmitting(true);
    try {
      const result = await runBackend<{ success: boolean; message?: string; selisihKas?: number }>('closeKasShift', {
        shiftId: shiftAktif.idShift,
        mode: closeShiftMode,
        kasAkhir,
        replacementEmployeeId: closeShiftMode === 'SERAH_TERIMA' ? replacementEmployeeId : '',
        handoverConfirmed: closeShiftMode === 'SERAH_TERIMA',
        userName: shiftAktif.namaKasir,
      });
      if (!result?.success) throw new Error(result?.message || 'Kas shift gagal ditutup.');
      setShiftAktif(null);
      setShowTutupShiftModal(false);
      setKasAkhirFisik('');
      setReplacementEmployeeId('');
      setHandoverResult(null);
      setToastMsg(`Kas shift ditutup. Selisih kas Rp ${(result.selisihKas || 0).toLocaleString('id-ID')}.`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Kas shift gagal ditutup.');
    } finally {
      setShiftSubmitting(false);
    }
  };

  // Enhanced Close Shift with Expense & Photo Upload
  const handleExpensePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setExpensePhotos(prev => [...prev, { file, preview: reader.result as string }]);
        };
        reader.readAsDataURL(file);
      }
    });
    e.target.value = ''; // Reset input
  };

  const removeExpensePhoto = (index: number) => {
    setExpensePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotoToGoogleDrive = async (file: File): Promise<string | null> => {
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const result = await runBackend('uploadExpensePhoto', {
        fileName: file.name,
        fileData: base64,
        mimeType: file.type,
        shiftId: shiftAktif?.idShift || '',
      });

      return result?.fileUrl || null;
    } catch (error) {
      console.error('Failed to upload photo:', error);
      return null;
    }
  };

  const handleCloseShiftWithExpense = async () => {
    if (!shiftAktif) return;
    const kasAkhir = Number(kasAkhirFisik);
    if (!Number.isFinite(kasAkhir) || kasAkhir < 0) {
      await showAlert('Kas akhir fisik laci harus berupa angka nol atau lebih.', 'warning');
      return;
    }
    const saldoMerchantAkhir = Number(saldoMerchantAkhirInput);
    if (!Number.isFinite(saldoMerchantAkhir) || saldoMerchantAkhir < 0) {
      await showAlert('Saldo akhir di aplikasi merchant harus berupa angka nol atau lebih.', 'warning');
      return;
    }
    if (closeShiftMode === 'SERAH_TERIMA' && !handoverResult?.eligible) {
      await showAlert('Clock In staf pengganti harus diverifikasi sebelum serah terima.', 'warning');
      return;
    }

    setShiftSubmitting(true);
    try {
      // 1. Upload photos to Google Drive first
      const photoUrls: string[] = [];
      if (expensePhotos.length > 0) {
        for (const photo of expensePhotos) {
          const url = await uploadPhotoToGoogleDrive(photo.file);
          if (url) photoUrls.push(url);
        }
      }

      // 2. Format items into clean itemized description & send
      const formattedExpenseDesc = expenseItemList
        .filter(item => item.nama.trim())
        .map(item => `${item.nama.trim()}${Number(item.nominal) > 0 ? ` (Rp ${(Number(item.nominal) || 0).toLocaleString('id-ID')})` : ''}`)
        .join(', ');

      const result = await runBackend<{ success: boolean; message?: string; selisihKas?: number; selisihMerchant?: number }>('closeKasShift', {
        shiftId: shiftAktif.idShift,
        mode: closeShiftMode,
        kasAkhir,
        saldoMerchantAkhir,
        replacementEmployeeId: closeShiftMode === 'SERAH_TERIMA' ? replacementEmployeeId : '',
        handoverConfirmed: closeShiftMode === 'SERAH_TERIMA',
        userName: shiftAktif.namaKasir,
        // Expense data
        expenseDesc: formattedExpenseDesc,
        expenseAmount: totalShiftExpense,
        expenseCategory: shiftExpenseCategory || 'Operasional',
        expensePhotos: photoUrls,
      });

      if (!result?.success) throw new Error(result?.message || 'Kas shift gagal ditutup.');
      
      // Reset states
      setShiftAktif(null);
      setShowTutupShiftModal(false);
      setKasAkhirFisik('');
      setSaldoMerchantAkhirInput('');
      setReplacementEmployeeId('');
      setHandoverResult(null);
      setExpenseItemList([{ nama: '', nominal: '' }]);
      setShiftExpenseCategory('');
      setExpensePhotos([]);
      
      setToastMsg(`Kas shift ditutup berhasil! Selisih kas Rp ${(result.selisihKas || 0).toLocaleString('id-ID')}.`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Kas shift gagal ditutup.');
    } finally {
      setShiftSubmitting(false);
    }
  };

  // Helper: Calculate estimasi selesai berdasarkan tingkatLayanan
  const calculateEstimasi = (tingkatNama: string): string => {
    const now = new Date();
    const target = new Date(now);
    const priConfig = dropOffPriorities.find(p => p.nama.toLowerCase() === (tingkatNama || '').toLowerCase());
    let jam = priConfig?.durasiJam;
    if (!jam) {
      const nLower = (tingkatNama || '').toLowerCase();
      if (nLower.includes('kilat')) jam = 6;
      else if (nLower.includes('express') || nLower.includes('ekspres')) jam = 24;
      else if (nLower.includes('sameday')) jam = 12;
      else jam = 48;
    }
    target.setHours(target.getHours() + jam);
    
    return target.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) 
      + ' ' + target.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
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

  if (!shiftLoading && !shiftAktif) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100 p-4 relative overflow-hidden">
        {/* Background Decorative Pattern */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1E4648 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 w-full max-w-md overflow-hidden relative z-10">
          <div className="bg-[#1E4648] p-6 text-center text-white">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 shadow-inner">
              <Lock className="w-8 h-8 text-teal-100" />
            </div>
            <h2 className="text-xl font-bold mb-1">Layar Terkunci</h2>
            <p className="text-teal-100 text-sm">Selesaikan {lockScreenStep === 1 ? 'Absensi' : 'Kas Awal'} untuk membuka POS</p>
          </div>

          <div className="p-6">
            {/* Progress Indicator */}
            <div className="flex items-center gap-2 mb-8 px-4">
              <div className={`flex-1 h-1.5 rounded-full ${lockScreenStep >= 1 ? 'bg-[#1E4648]' : 'bg-slate-200'}`} />
              <div className={`flex-1 h-1.5 rounded-full transition-colors duration-500 ${lockScreenStep === 2 ? 'bg-[#1E4648]' : 'bg-slate-200'}`} />
            </div>

            {lockScreenStep === 1 ? (
              <div className="space-y-4 animate-fade-in">
                <h3 className="font-bold text-slate-700 text-center mb-6">Langkah 1: Absensi (Clock In)</h3>
                
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Kasir</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={namaKasirInput}
                      onChange={(e) => setNamaKasirInput(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20 transition-all appearance-none"
                    >
                      {staffList.map((s) => (
                        <option key={s.id} value={s.nama}>{s.nama} {s.jabatan ? `— ${s.jabatan}` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Jadwal Shift</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={clockInShift}
                      onChange={(e) => setClockInShift(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20 transition-all appearance-none"
                    >
                      <option value="Pagi">Pagi (08:00 - 16:00)</option>
                      <option value="Siang">Siang (12:00 - 20:00)</option>
                      <option value="Sore">Sore (15:00 - 22:00)</option>
                      <option value="Full Day">Full Day</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleClockIn}
                  disabled={clockInSubmitting}
                  className="w-full mt-6 bg-[#1E4648] hover:bg-[#163536] disabled:opacity-50 text-white rounded-xl text-sm font-bold py-3.5 shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  {clockInSubmitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Lanjut Clock In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-4 cursor-pointer" onClick={() => setLockScreenStep(1)}>
                  <button className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ArrowRight className="w-4 h-4 text-slate-400 rotate-180" /></button>
                  <h3 className="font-bold text-slate-700">Langkah 2: Cek Uang Kasir & Merchant</h3>
                </div>
                
                <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3.5 text-amber-800 text-xs font-medium leading-relaxed mb-3 flex gap-2.5 items-start">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <p>Harap hitung fisik uang di laci kasir dan periksa saldo awal di aplikasi merchant (QRIS/EDC/E-Wallet) sebelum memulai shift.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>1. Uang Fisik Kasir (Laci Kas)</span>
                    <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded">Tunai</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</div>
                    <input
                      type="number"
                      value={kasAwalInput}
                      onChange={(e) => setKasAwalInput(e.target.value)}
                      placeholder="Contoh: 150000"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-700 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>2. Saldo Aplikasi Merchant</span>
                    <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded">QRIS / EDC / E-Wallet</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</div>
                    <input
                      type="number"
                      value={saldoMerchantAwalInput}
                      onChange={(e) => setSaldoMerchantAwalInput(e.target.value)}
                      placeholder="Contoh: 0 atau saldo awal merchant"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-700 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  onClick={handleOpenShift}
                  disabled={shiftSubmitting}
                  className="w-full mt-4 bg-[#FF9500] hover:bg-[#E58600] disabled:opacity-50 text-white rounded-xl text-sm font-bold py-3.5 shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                  {shiftSubmitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Unlock className="w-5 h-5" />
                      <span>Buka POS Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-3 p-3 sm:p-4 bg-slate-50 relative overflow-hidden text-slate-600">
      
      {/* Toast Notification Banner (Step 8) */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-[999] bg-[#1E4648] text-white px-4 py-3 rounded-lg shadow-lg border border-[#B5C9C9]600/40 flex items-center gap-2.5 animate-bounce-in max-w-sm text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-[#B5C9C9] shrink-0" />
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="ml-auto p-1 text-[#B5C9C9] hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* LEFT: Catalog & Filter Section */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-lg border border-slate-200/80 shrink-0 overflow-hidden shadow-2xs">
        
        {/* Search & Header Controls */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center bg-white">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk / layanan..."
              className="w-full pl-9 md:pl-11 pr-4 py-2 md:py-3 bg-slate-50 border border-slate-200/80 rounded-lg text-sm outline-none focus:border-[#1E4648] focus:bg-white transition"
            />
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {currentRole === 'MANAGER' && (
              <button
                onClick={() => setShowCustomItemModal(true)}
                className="bg-[#1E4648] hover:bg-[#163536] text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Baru</span>
              </button>
            )}

            {shiftLoading ? (
              <button disabled className="bg-slate-50 border border-slate-200 text-slate-400 px-4 py-2.5 rounded-lg text-sm font-semibold">
                Memuat Shift...
              </button>
            ) : shiftAktif ? (
              <button
                onClick={() => setShowTutupShiftModal(true)}
                className="bg-[#B5C9C9]/20 border border-[#B5C9C9] text-[#1E4648] hover:bg-[#B5C9C9]/30 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
              >
                <Unlock className="w-4 h-4 text-[#1E4648]" />
                <span className="hidden sm:inline">Shift (Rp {(shiftAktif?.kasAwal || 0).toLocaleString('id-ID')})</span>
              </button>
            ) : (
              <button
                onClick={() => setShowBukaShiftModal(true)}
                className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition"
              >
                <Lock className="w-4 h-4 text-rose-600" />
                <span>Buka Shift</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills Row & View Toggle */}
        <div className="px-3 sm:px-4 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar bg-slate-50/30 justify-between flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {effectiveCategories.map((tab) => {
              const isActive = selectedCategoryTab === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategoryTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 border ${
                    isActive
                      ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-200' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <button
              onClick={() => setCatalogViewMode('grid')}
              className={`p-2 rounded-lg border transition ${
                catalogViewMode === 'grid'
                  ? 'bg-[#1E4648] border-[#1E4648] text-white'
                  : 'bg-white border-slate-200/80 text-slate-400 hover:text-slate-600'
              }`}
              title="Tampilan Grid"
            >
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                <div className="bg-current rounded-sm" />
                <div className="bg-current rounded-sm" />
                <div className="bg-current rounded-sm" />
                <div className="bg-current rounded-sm" />
              </div>
            </button>
            <button
              onClick={() => setCatalogViewMode('list')}
              className={`p-2 rounded-lg border transition ${
                catalogViewMode === 'list'
                  ? 'bg-[#1E4648] border-[#1E4648] text-white'
                  : 'bg-white border-slate-200/80 text-slate-400 hover:text-slate-600'
              }`}
              title="Tampilan List"
            >
              <div className="w-4 h-4 flex flex-col gap-0.5">
                <div className="h-0.5 bg-current" />
                <div className="h-0.5 bg-current" />
                <div className="h-0.5 bg-current" />
              </div>
            </button>
          </div>
        </div>

        {/* STEP 1: Product Cards Grid or List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 md:pb-4">
          {catalogViewMode === 'grid' ? (
            // GRID VIEW
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 auto-rows-auto">
              {layananLoading ? (
                // SKELETON LOADING GRID
                Array.from({ length: 10 }).map((_, idx) => (
                  <div
                    key={`skeleton-grid-${idx}`}
                    className="bg-white rounded-2xl border-2 border-slate-100 p-3 flex flex-col justify-between gap-3 animate-pulse shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 w-full pb-2">
                        <div className="h-4 bg-slate-200 rounded-md w-16" />
                        <div className="h-3 bg-slate-100 rounded w-8" />
                      </div>
                      <div className="flex items-start gap-2.5 pt-1">
                        <div className="w-8 h-8 rounded-xl bg-slate-200 shrink-0" />
                        <div className="flex-1 space-y-1.5 py-0.5">
                          <div className="h-3.5 bg-slate-200 rounded w-full" />
                          <div className="h-2.5 bg-slate-100 rounded w-2/3" />
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 space-y-2">
                      <div className="h-5 bg-slate-200 rounded w-20" />
                      <div className="h-7 bg-slate-100 rounded-xl w-full" />
                    </div>
                  </div>
                ))
              ) : filteredLayanan.length === 0 ? (
                <div className="col-span-full text-center py-16 text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-xs">Tidak ada produk ditemukan.</p>
                </div>
              ) : (
                filteredLayanan.map((item, idx) => {
                  const qtyInCart = cart[item.layanan] ? cart[item.layanan].qty : 0;
                  const { Icon, categoryName, badgeStyle, iconBg, iconColor } = getLayananStyleConfig(item, kategoriList);

                  let pointerStartX = 0;
                  let pointerStartY = 0;

                  return (
                    <div
                      key={`${item.layanan}-${idx}`}
                      onPointerDown={(e) => {
                        pointerStartX = e.clientX;
                        pointerStartY = e.clientY;
                      }}
                      onPointerUp={(e) => {
                        const dx = Math.abs(e.clientX - pointerStartX);
                        const dy = Math.abs(e.clientY - pointerStartY);
                        if (dx < 8 && dy < 8) {
                          updateCart(item, 1);
                        }
                      }}
                      className={`bg-white rounded-2xl border-2 p-3 flex flex-col justify-between gap-2.5 cursor-pointer select-none active:scale-98 transition-all duration-150 touch-pan-y ${
                        qtyInCart > 0
                          ? 'ring-2 ring-[#1E4648]/40 border-[#1E4648] bg-[#1E4648]/[0.02] shadow-md'
                          : 'border-slate-200/90 shadow-2xs hover:border-[#1E4648] hover:shadow-md'
                      }`}
                    >
                      <div>
                        {/* Top Category Badge & Satuan */}
                        <div className="flex items-center justify-between gap-1 w-full pb-1.5">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border shadow-2xs ${badgeStyle}`}>
                            <Icon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{categoryName}</span>
                          </span>
                          {item.satuan && (
                            <span className="text-[10px] font-bold text-slate-400">
                              /{item.satuan}
                            </span>
                          )}
                        </div>

                        {/* Product Icon & Name */}
                        <div className="flex items-start gap-2.5 pt-1">
                          <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                            <Icon className={`w-4 h-4 ${iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-slate-900 leading-snug line-clamp-2">
                              {item.layanan}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        {/* Harga - Prominent */}
                        <div className="pt-1">
                          <div className="text-sm sm:text-base font-extrabold text-[#1E4648] leading-tight font-mono">
                            Rp {(item.hargaSatuan || 0).toLocaleString('id-ID')}
                          </div>
                        </div>

                        {/* Qty Stepper - Bottom */}
                        <div className="flex items-center justify-between gap-1 pt-2" onClick={(e) => e.stopPropagation()}>
                          {qtyInCart > 0 ? (
                            <div className="flex items-center bg-[#1E4648] text-white rounded-xl overflow-hidden flex-1 h-7 shadow-xs">
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                                className="w-7 h-full flex items-center justify-center hover:bg-white/20 transition font-bold text-xs"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-black flex-1 text-center font-mono">{qtyInCart}</span>
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                                className="w-7 h-full flex items-center justify-center hover:bg-white/20 transition font-bold text-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-full h-7 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-[#1E4648] hover:text-white hover:border-[#1E4648] text-slate-500 transition shadow-2xs font-bold text-xs gap-1">
                              <Plus className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-bold">Tambah</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // LIST VIEW
            <div className="space-y-2">
              {layananLoading ? (
                // SKELETON LOADING LIST
                Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={`skeleton-list-${idx}`}
                    className="flex items-center justify-between p-3.5 bg-white rounded-2xl border-2 border-slate-100 animate-pulse shadow-2xs"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="h-4 bg-slate-200 rounded w-16" />
                          <div className="h-4 bg-slate-200 rounded w-28" />
                        </div>
                        <div className="h-3.5 bg-slate-100 rounded w-20" />
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-slate-100 ml-4 shrink-0" />
                  </div>
                ))
              ) : filteredLayanan.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-xs">Tidak ada produk ditemukan.</p>
                </div>
              ) : (
                filteredLayanan.map((item, idx) => {
                  const qtyInCart = cart[item.layanan] ? cart[item.layanan].qty : 0;
                  let pointerStartX = 0;
                  let pointerStartY = 0;

                  const { Icon, categoryName, badgeStyle, iconBg, iconColor } = getLayananStyleConfig(item, kategoriList);

                  return (
                    <div
                      key={`${item.layanan}-${idx}`}
                      onPointerDown={(e) => {
                        pointerStartX = e.clientX;
                        pointerStartY = e.clientY;
                      }}
                      onPointerUp={(e) => {
                        const dx = Math.abs(e.clientX - pointerStartX);
                        const dy = Math.abs(e.clientY - pointerStartY);
                        if (dx < 8 && dy < 8) {
                          updateCart(item, 1);
                        }
                      }}
                      className={`flex items-center justify-between p-3.5 bg-white rounded-2xl border-2 cursor-pointer select-none transition hover:shadow-md touch-pan-y ${
                        qtyInCart > 0
                          ? 'ring-2 ring-[#1E4648]/40 border-[#1E4648] bg-[#1E4648]/[0.02]'
                          : 'border-slate-200/90 hover:border-[#1E4648]'
                      }`}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                          <Icon className={`w-5 h-5 ${iconColor}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-2xs ${badgeStyle}`}>
                              {categoryName}
                            </span>
                            <p className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">{item.layanan}</p>
                          </div>
                          <div className="text-xs font-extrabold text-[#1E4648] font-mono mt-0.5">
                            Rp {(item.hargaSatuan || 0).toLocaleString('id-ID')} {item.satuan ? `/${item.satuan}` : ''}
                          </div>
                        </div>
                      </div>

                      {qtyInCart > 0 ? (
                        <div 
                          className="flex items-center bg-[#1E4648] text-white rounded-xl overflow-hidden ml-4 shrink-0 shadow-xs" 
                          onPointerDown={(e) => e.stopPropagation()}
                          onPointerUp={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white/20 transition font-bold text-sm"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-black px-3 font-mono">{qtyInCart}</span>
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white/20 transition font-bold text-sm"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-[#1E4648] hover:text-white hover:border-[#1E4648] transition ml-4 shrink-0 shadow-2xs">
                          <Plus className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* STEP 1 MODAL: "Tambah Item / Edit Catatan Item" */}
      {showTambahItemModal && itemModalTarget && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm border border-slate-100 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-600">Detail & Catatan Item</h3>
              <button onClick={() => setShowTambahItemModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nama Layanan</label>
                <input type="text" readOnly value={itemModalTarget.layanan} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jumlah (Qty)</label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setItemModalQty(Math.max(1, itemModalQty - 1))}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-bold"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold text-slate-700 w-8 text-center">{itemModalQty}</span>
                  <button 
                    onClick={() => setItemModalQty(itemModalQty + 1)}
                    className="p-2 bg-[#1E4648] text-white rounded-lg hover:bg-[#163536] font-bold"
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
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowTambahItemModal(false)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                Batal
              </button>
              <button onClick={handleSaveItemModal} className="flex-1 bg-[#1E4648] text-white rounded-lg text-xs font-bold py-2.5">
                Simpan ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Sticky Bottom Bar on Mobile (< 768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[120] bg-[#1E4648] text-white px-4 py-3 flex items-center justify-between shadow-lg border-t border-[#B5C9C9]800">
        <div className="flex items-center gap-3 min-w-0" onClick={() => setShowMobileCart(true)}>
          <div className="relative shrink-0">
            <ShoppingCart className="w-6 h-6 text-[#B5C9C9]" />
            {totalCartItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#FF9500] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-2xs">
                {totalCartItems}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">
              {totalCartItems > 0 ? `Total: Rp ${(grandTotal || 0).toLocaleString('id-ID')}` : 'Keranjang Kosong'}
            </div>
            <div className="text-xs text-[#B5C9C9]/90 truncate">
              {totalCartItems > 0 ? `${totalCartItems} item dipilih` : 'Klik item di atas untuk memilih'}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowMobileCart(true)}
          disabled={totalCartItems === 0}
          className="bg-[#FF9500] hover:bg-[#FF9500] disabled:opacity-40 text-white text-sm font-bold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shrink-0 shadow-2xs"
        >
          <span>Lihat Order</span>
          <ArrowRight className="w-4 h-4" />
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
      <div className={`fixed inset-0 z-[300] bg-white flex flex-col w-full md:static md:w-[260px] lg:w-[280px] xl:w-[300px] md:z-auto border border-slate-200/80 rounded-lg shrink-0 overflow-hidden shadow-2xs transition-all duration-200 ${
        showMobileCart ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-0 md:opacity-100 hidden md:flex'
      }`}>
        {/* Header Order & Customer Button */}
        <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4 text-[#1E4648]" />
            <h2 className="text-sm font-bold text-slate-600">Order</h2>
          </div>
          <div className="flex items-center gap-1.5">
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
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
          <div className="flex-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pelanggan:</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-600">{customer.nama || 'Pelanggan Umum'}</span>
              {customer.noHp && <span className="text-xs text-slate-500">({customer.noHp})</span>}
              {customer.poin !== undefined && (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#FF9500]/10 text-[#FF9500] border border-[#FF9500]/30 px-2 py-0.5 rounded">
                  â­ {customer.poin} Poin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cart Items List - Simple Text Format */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-slate-50/40">
          {cartArray.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <ShoppingCart className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-sm font-bold text-slate-600">Keranjang Kosong</div>
              <div className="text-xs text-slate-400 mt-1">Pilih produk di katalog sebelah kiri</div>
            </div>
          ) : (
            cartArray.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2.5 bg-white border border-slate-200/60 rounded-lg hover:shadow-sm transition group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-600 leading-tight truncate">{item.layanan}</div>
                  <div className="text-xs text-slate-500 font-semibold">
                    Rp {(item.hargaSatuan || 0).toLocaleString('id-ID')} × {item.qty}
                  </div>
                </div>
                <button
                  onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, -item.qty)}
                  className="text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition ml-2 shrink-0 opacity-0 group-hover:opacity-100"
                  title="Hapus Item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Recommendation Trigger Banner (Dynamic) */}
        {rekomendasiKasir.length > 0 && (
          <div className="px-4 pt-3 pb-1 bg-white border-t border-slate-100">
            <button
              onClick={() => setShowRekomendasiModal(true)}
              className="w-full flex items-center justify-between p-2.5 sm:p-3 bg-gradient-to-r from-amber-50/80 via-orange-50/30 to-teal-50/40 border border-amber-200/90 hover:border-amber-400 rounded-2xl transition-all duration-150 group text-left shadow-2xs hover:shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 leading-tight">Rekomendasi Kasir</span>
                    <span className="px-2 py-0.5 bg-[#FF9500] text-white text-[9px] font-black rounded-full whitespace-nowrap shadow-2xs">
                      {rekomendasiKasir.length} Saran
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5 font-medium">
                    {rekomendasiKasir[0]?.judul || 'Ada promo & diskon untuk transaksi ini'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 text-xs font-bold text-[#1E4648] group-hover:translate-x-0.5 transition shrink-0 ml-2 pl-2 border-l border-amber-200/60">
                <span>Lihat</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        )}

        {/* Voucher & Promo Input Box */}
        <div className="px-4 py-3 bg-white border-t border-slate-100 space-y-2">
          {diskonApplied.nilai > 0 ? (
            <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-emerald-900 uppercase font-mono">{diskonApplied.kode}</span>
                  <span className="text-emerald-700 ml-1.5 font-semibold">
                    (-Rp {diskonApplied.nilai.toLocaleString('id-ID')})
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setDiskonApplied({ kode: '', nilai: 0 });
                  setVoucherInput('');
                  setVoucherMsg(null);
                }}
                className="p-1 text-emerald-600 hover:text-rose-600 hover:bg-emerald-100/60 rounded-lg transition shrink-0"
                title="Hapus Voucher"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  placeholder="Kode voucher / promo..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white transition"
                />
              </div>
              <button
                onClick={handleApplyVoucher}
                className="bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold px-4 py-2 rounded-xl transition shrink-0 shadow-2xs"
              >
                Pasang
              </button>
            </div>
          )}
          {voucherMsg && (
            <div className={`text-[11px] font-bold px-1 ${voucherMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
              {voucherMsg.text}
            </div>
          )}
        </div>

        {/* Financial Summary & Process Payment Button */}
        <div className="p-4 border-t border-slate-200/80 bg-white space-y-3">
          <div className="space-y-1.5 text-sm text-slate-500">
            <div className="flex justify-between">
              <span>Subtotal :</span>
              <span className="font-bold text-slate-600">Rp {(subtotalCart || 0).toLocaleString('id-ID')}</span>
            </div>
            {diskonApplied.nilai > 0 && (
              <div className="flex justify-between text-[#1E4648]">
                <span>Diskon ({diskonApplied.kode}) :</span>
                <span className="font-bold">-Rp {(diskonApplied?.nilai || 0).toLocaleString('id-ID')}</span>
              </div>
            )}
            {customerMode === 'MEMBER' && customer.isMember && Math.floor(grandTotal / poinRate) > 0 && (
              <div className="flex justify-between text-[#FF9500]">
                <span>Estimasi Poin (Member) :</span>
                <span className="font-bold">+{Math.floor(grandTotal / poinRate)} Poin</span>
              </div>
            )}
          </div>

          <div className="bg-slate-900 text-white rounded-lg p-4 flex justify-between items-center shadow-inner my-1.5">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-300">Total Tagihan</span>
            <span className="text-xl font-bold text-[#B5C9C9]">Rp {(grandTotal || 0).toLocaleString('id-ID')}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={clearCart}
              disabled={cartArray.length === 0}
              className="p-3.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg transition disabled:opacity-40 border border-slate-200/80"
              title="Kosongkan keranjang"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (cartArray.length === 0) return;
                const dropOffItem = cartArray.find(i => (i as any).kategoriDropOff || i.tipe === 'FullService');
                if (dropOffItem) {
                  const mapped = (dropOffItem as any).kategoriDropOff;
                  if (mapped) {
                    setTingkatLayanan(mapped);
                  } else {
                    const nLower = (dropOffItem.layanan || '').toLowerCase();
                    if (nLower.includes('express') || nLower.includes('ekspres')) setTingkatLayanan('Express');
                    else if (nLower.includes('kilat')) setTingkatLayanan('Kilat');
                    else if (nLower.includes('sameday')) setTingkatLayanan('Sameday');
                    else setTingkatLayanan('Reguler');
                  }
                }
                setShowDetailTransaksiModal(true);
              }}
              disabled={cartArray.length === 0}
              className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-3.5 rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-md cursor-pointer"
            >
              <CreditCard className="w-5 h-5" />
              <span>Proses Bayar Rp {(grandTotal || 0).toLocaleString('id-ID')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* STEP 3: MODAL "Pilih Pelanggan" (Repeat Order & 4-Digit Lookup Flow) */}
      {showCustModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-md border border-slate-100 shadow-lg flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#1E4648]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-600">Pilih / Cari Pelanggan</h3>
                  <p className="text-[10px] text-slate-500">Ketik 4 digit terakhir No. HP atau nama pelanggan</p>
                </div>
              </div>
              <button onClick={() => setShowCustModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            {/* Search Input Bar */}
            <div className="py-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchCust}
                  onChange={(e) => setSearchCust(e.target.value)}
                  placeholder="Ketik 4 digit terakhir (misal: 7890) / Nama..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648] font-semibold"
                />
              </div>
            </div>

            {/* Customer Lookup Logic */}
            {(() => {
              const query = searchCust.trim();
              const cleanQ = query.replace(/[^0-9]/g, '');

              const filtered = customerList.filter((c) => {
                if (!query) return true;
                const cleanHp = String(c.noHp || '').replace(/[^0-9]/g, '');
                if (cleanQ.length >= 3 && cleanHp.endsWith(cleanQ)) return true;
                if (cleanQ.length >= 3 && cleanHp.includes(cleanQ)) return true;
                return c.nama.toLowerCase().includes(query.toLowerCase());
              });

              const maskHp = (hp: string) => {
                const norm = hp.replace(/[^0-9]/g, '');
                if (norm.length >= 10) {
                  return `${norm.substring(0, 4)}*****${norm.substring(norm.length - 4)}`;
                }
                return hp;
              };

              return (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1">
                  {/* Case 0: Search query entered but 0 results found */}
                  {query && filtered.length === 0 && (
                    <div className="p-4 bg-[#FF9500]/10/70 border border-[#FF9500]/30 rounded-lg text-center space-y-2">
                      <div className="text-xs font-bold text-[#FF9500]">
                        Tidak ditemukan kecocokan untuk "{query}"
                      </div>
                      <p className="text-[11px] text-[#FF9500]">
                        Nomor HP atau nama belum terdaftar di database. Silakan input sebagai Pelanggan Baru.
                      </p>
                      <button
                        onClick={() => {
                          setShowAddCustForm(true);
                          if (cleanQ.length >= 8) setNewCustNoHp(cleanQ);
                          else if (!isNaN(Number(query))) setNewCustNoHp(query);
                          else setNewCustNama(query);
                        }}
                        className="px-3 py-1.5 bg-[#1E4648] text-white text-xs font-bold rounded-lg shadow-2xs hover:bg-[#163536]"
                      >
                        + Input Pelanggan Baru
                      </button>
                    </div>
                  )}

                  {/* Case 1: Exactly 1 result found (Requires Kasir Name Confirmation) */}
                  {query && filtered.length === 1 && (
                    <div className="p-3 bg-[#B5C9C9]/20 border-2 border-[#B5C9C9] rounded-lg space-y-2">
                      <div className="text-[10px] font-bold text-[#1E4648] uppercase tracking-wider">
                        Ditemukan 1 Kecocokan â€” Mohon Cocokkan Nama Pelanggan:
                      </div>
                      <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-[#B5C9C9]">
                        <div>
                          <div className="text-xs font-bold text-slate-700">{filtered[0].nama}</div>
                          <div className="text-[11px] font-mono text-slate-500">{maskHp(filtered[0].noHp)}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-[#B5C9C9]/30 text-[#1E4648] rounded-full">
                          {filtered[0].memberStatus || 'Pelanggan'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setCustomer(filtered[0]);
                          setShowCustModal(false);
                        }}
                        className="w-full py-2 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold rounded-lg shadow-2xs flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#B5C9C9]" />
                        <span>Konfirmasi & Gunakan Data Ini</span>
                      </button>
                    </div>
                  )}

                  {/* Case 2: >1 results found or default list (Show Masked Phone List & Count Header) */}
                  {(filtered.length > 1 || !query) && (
                    <>
                      {query && (
                        <div className="text-[11px] font-bold text-slate-600 px-1 py-1">
                          Ditemukan {filtered.length} kecocokan untuk "{query}" (Tanyakan nama ke pelanggan):
                        </div>
                      )}
                      {filtered.map((c, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            setCustomer(c);
                            setShowCustModal(false);
                          }}
                          className="p-3 bg-slate-50 hover:bg-[#B5C9C9]/20/50 border border-slate-200 hover:border-[#B5C9C9] rounded-lg cursor-pointer transition flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-600">{c.nama}</div>
                            <div className="text-[11px] font-mono text-slate-500">{maskHp(c.noHp)} {c.alamat ? `• ${c.alamat}` : ''}</div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-[#B5C9C9]/30 text-[#1E4648] rounded-full">
                            {c.memberStatus || 'Pelanggan'}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}

            {/* Add New Customer Toggle Form */}
            {showAddCustForm ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 mt-2">
                <div className="text-xs font-bold text-slate-600">Form Pelanggan Baru</div>
                <input type="text" value={newCustNama} onChange={(e) => setNewCustNama(e.target.value)} placeholder="Nama Lengkap Pelanggan *" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold" />
                <input type="tel" value={newCustNoHp} onChange={(e) => setNewCustNoHp(e.target.value)} placeholder="No. HP / WhatsApp Lengkap *" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono font-bold" />
                <input type="text" value={newCustAlamat} onChange={(e) => setNewCustAlamat(e.target.value)} placeholder="Alamat (Opsional)" className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold" />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setShowAddCustForm(false)} className="px-3 py-1.5 bg-slate-200 text-xs font-bold rounded-lg">Batal</button>
                  <button onClick={handleAddNewCustomer} className="flex-1 bg-[#1E4648] text-white text-xs font-bold py-1.5 rounded-lg">Simpan & Pilih Pelanggan</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowAddCustForm(true)} 
                className="w-full py-2.5 border-2 border-dashed border-[#1E4648]/40 text-[#1E4648] font-bold text-xs rounded-lg hover:bg-[#B5C9C9]/20/50 transition mt-2 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Input Pelanggan Baru</span>
              </button>
            )}

            <div className="pt-3 mt-3 border-t border-slate-100 flex gap-2">
              <button onClick={() => setShowCustModal(false)} className="w-full py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL "Detail Transaksi & Pembayaran" (Split Layout: Kiri Detail Order & Customer, Kanan Kasir & Pembayaran) */}
      {showDetailTransaksiModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative bg-white rounded-3xl w-full max-w-5xl border border-slate-200/90 shadow-2xl flex flex-col lg:flex-row overflow-hidden my-auto max-h-[94vh] animate-scale-in">
            
            {/* Prominent Modal Close Button - Top Right Corner */}
            <button 
              type="button"
              onClick={() => setShowDetailTransaksiModal(false)} 
              className="absolute top-3.5 right-3.5 z-50 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-rose-600 text-white flex items-center justify-center transition-all shadow-md backdrop-blur-xs cursor-pointer active:scale-95 border border-white/20"
              title="Tutup Modal (Esc)"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* LEFT PANEL: Transaction Summary & Customer Details */}
            <div className="flex-1 flex flex-col overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 min-w-0 bg-white">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1E4648] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 leading-tight">Detail Transaksi & Pelanggan</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Lengkapi identitas pemesan & instruksi pengerjaan</p>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-5 space-y-4 text-xs font-semibold text-slate-700">
                {/* Customer Type Segmented Toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-slate-700">Tipe Pelanggan *</label>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {customerMode === 'MEMBER' ? '⭐ Mode Loyalitas & Member' : '👤 Mode Pelanggan Umum'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('UMUM');
                        setCustomerSource('BARU');
                        setShowQuickAddMember(false);
                      }}
                      className={`py-2.5 px-3 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 ${
                        customerMode === 'UMUM'
                          ? 'bg-[#1E4648] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Pelanggan Umum</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('MEMBER');
                        setCustomerSource('TERDAFTAR');
                      }}
                      className={`py-2.5 px-3 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 ${
                        customerMode === 'MEMBER'
                          ? 'bg-[#1E4648] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Member Terdaftar</span>
                    </button>
                  </div>
                </div>

                {/* Registered Member Search, Select & Quick Add */}
                {customerMode === 'MEMBER' && (
                  <div className="space-y-2 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-amber-950 text-xs">Pilih Data Member Terdaftar *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickAddMember(!showQuickAddMember);
                          if (!showQuickAddMember) {
                            setNewMemberForm({
                              nama: customer.nama !== 'Pelanggan Umum' ? customer.nama : '',
                              noHp: customer.noHp,
                              alamat: customer.alamat || '',
                              tglLahir: ''
                            });
                          }
                        }}
                        className="text-[11px] font-bold text-[#1E4648] hover:underline flex items-center gap-1"
                      >
                        {showQuickAddMember ? '✕ Tutup Form' : '+ Daftar Member Baru'}
                      </button>
                    </div>

                    {!showQuickAddMember ? (
                      <select
                        value={customer.isMember ? customer.noHp : ''}
                        onChange={(e) => {
                          const found = customerList.find((c) => c.noHp === e.target.value && c.isMember);
                          if (found) {
                            setCustomer({
                              ...found,
                              isMember: true,
                              memberStatus: 'Member',
                              poin: Number(found.poin || 0),
                            });
                          }
                        }}
                        className="w-full px-3 py-2.5 bg-white border border-amber-200 rounded-xl font-bold text-xs outline-none focus:border-[#1E4648]"
                      >
                        <option value="">-- Cari / Pilih Member Terdaftar --</option>
                        {customerList.filter((c) => c.isMember).length === 0 ? (
                          <option value="" disabled>Belum ada member terdaftar (Klik + Daftar Member Baru)</option>
                        ) : (
                          customerList.filter((c) => c.isMember).map((c) => (
                            <option key={c.noHp} value={c.noHp}>
                              ⭐ {c.nama} ({c.noHp}) {c.poin ? `· ${c.poin} Poin` : ''} {c.totalOrder ? `· ${c.totalOrder}x order` : ''}
                            </option>
                          ))
                        )}
                      </select>
                    ) : (
                      /* Quick Inline Member Registration Form */
                      <div className="bg-white p-3 rounded-xl border border-amber-300 space-y-2.5">
                        <div className="text-xs font-bold text-amber-900 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Daftarkan Member Baru Langsung di Kasir</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Nama Lengkap Member *"
                            value={newMemberForm.nama}
                            onChange={(e) => setNewMemberForm({ ...newMemberForm, nama: e.target.value })}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648]"
                          />
                          <input
                            type="tel"
                            placeholder="No. WhatsApp / HP *"
                            value={newMemberForm.noHp}
                            onChange={(e) => setNewMemberForm({ ...newMemberForm, noHp: e.target.value })}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648]"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Tanggal Lahir (TTL) *</label>
                            <input
                              type="date"
                              required
                              value={newMemberForm.tglLahir}
                              onChange={(e) => setNewMemberForm({ ...newMemberForm, tglLahir: e.target.value })}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[#1E4648]"
                            />
                          </div>
                          <div>
                            <AddressAutocomplete
                              label="Alamat Lengkap Member"
                              required
                              value={newMemberForm.alamat}
                              onChange={(addr) => setNewMemberForm({ ...newMemberForm, alamat: addr })}
                              placeholder="Ketik nama jalan / komplek / kos..."
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={savingMember}
                            onClick={() => handleDaftarMemberQuick()}
                            className="flex-1 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{savingMember ? 'Mendaftarkan...' : 'Simpan & Aktifkan Member'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowQuickAddMember(false)}
                            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-xs cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Member Points Card & Loyalty Projection (ONLY FOR VERIFIED MEMBERS) */}
                {customerMode === 'MEMBER' && customer.isMember && (
                  <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-300/90 rounded-2xl p-3 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-[#FF9500] text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                        <Star className="w-4 h-4 fill-white text-white" />
                      </div>
                      <div>
                        <div className="font-extrabold text-xs text-slate-900">
                          Poin Loyalitas Pelanggan (Member)
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Saldo Saat Ini: <span className="font-bold text-slate-900 font-mono">{customer.poin || 0} Poin</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[9px] font-bold text-amber-800 uppercase block">Dapat dari Order Ini</span>
                      <span className="text-xs font-black text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 inline-block">
                        +{Math.floor((grandTotal || 0) / (poinRate || 10000))} Poin
                      </span>
                    </div>
                  </div>
                )}

                {/* Customer Identity Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Nama Pelanggan *</label>
                    <input
                      type="text"
                      value={customer.nama}
                      disabled={customerMode === 'MEMBER' && !showQuickAddMember && !!customer.noHp}
                      onChange={(e) => setCustomer({ ...customer, nama: e.target.value })}
                      placeholder="Nama lengkap pemesan"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-[#1E4648] focus:bg-white disabled:opacity-60 transition"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">No. WhatsApp / HP *</label>
                    <input
                      type="tel"
                      value={customer.noHp}
                      disabled={customerMode === 'MEMBER' && !showQuickAddMember && !!customer.noHp}
                      onChange={(e) => handleCustomerPhoneInput(e.target.value)}
                      placeholder="08123456789"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-[#1E4648] focus:bg-white disabled:opacity-60 transition"
                    />
                  </div>
                </div>

                {/* Auto-check Customer Detection Banner in Pelanggan Umum Mode */}
                {customerMode === 'UMUM' && (() => {
                  const cleanInputHp = (customer.noHp || '').replace(/[^0-9]/g, '');
                  if (cleanInputHp.length < 8) return null;

                  const detected = customerList.find(c => {
                    const cHp = (c.noHp || '').replace(/[^0-9]/g, '');
                    return cHp && (cHp === cleanInputHp || cHp.endsWith(cleanInputHp) || cleanInputHp.endsWith(cHp));
                  });

                  if (detected) {
                    if (detected.isMember) {
                      return (
                        <div className="bg-amber-500/10 border border-amber-300/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⭐</span>
                            <div>
                              <div className="font-bold text-amber-950">Terdaftar Sebagai Member: {detected.nama}</div>
                              <div className="text-[10px] text-amber-700">Saldo: {detected.poin || 0} Poin · {detected.totalOrder || 0}x Transaksi</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerMode('MEMBER');
                              setCustomerSource('TERDAFTAR');
                              setCustomer({ ...detected, isMember: true, poin: Number(detected.poin || 0) });
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] transition shadow-2xs"
                          >
                            Gunakan Data Member
                          </button>
                        </div>
                      );
                    } else {
                      return (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-slate-700">
                            <span className="text-base">👤</span>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>Pelanggan Umum: {detected.nama}</span>
                                <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.2 rounded-full">Bukan Member</span>
                              </div>
                              <div className="text-[10px] text-slate-500">Pernah order {detected.totalOrder || 1}x sebelumnya · Belum terdaftar member</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerMode('MEMBER');
                              setShowQuickAddMember(true);
                              setNewMemberForm({ nama: detected.nama || customer.nama, noHp: detected.noHp || customer.noHp, alamat: detected.alamat || '', tglLahir: (detected as any)?.tglLahir || '' });
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-white" />
                            <span>+ Daftarkan Member</span>
                          </button>
                        </div>
                      );
                    }
                  } else {
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2 text-slate-600">
                          <span className="text-base">✨</span>
                          <div>
                            <div className="font-bold text-slate-800">Pelanggan Baru (Belum Terdaftar)</div>
                            <div className="text-[10px] text-slate-400">Nomor ini belum pernah order sebelumnya.</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerMode('MEMBER');
                            setShowQuickAddMember(true);
                            setNewMemberForm({ nama: customer.nama, noHp: customer.noHp, alamat: '', tglLahir: '' });
                          }}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] transition shadow-2xs flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-white" />
                          <span>+ Daftarkan Jadi Member</span>
                        </button>
                      </div>
                    );
                  }
                })()}

                {/* Staff Kasir & Service Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Staf Kasir / Pemroses *</label>
                    <select
                      value={namaKasirInput}
                      onChange={(e) => setNamaKasirInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:border-[#1E4648] focus:bg-white transition"
                    >
                      {staffList.map((s) => (
                        <option key={s.id || s.nama} value={s.nama}>
                          {s.nama} {s.jabatan ? `(${s.jabatan})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Komposisi Transaksi (Terdeteksi Otomatis)</label>
                    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                      {cartArray.some((i) => i.tipe === 'FullService') && (
                        <span className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 font-bold text-[11px] flex items-center gap-1 shadow-2xs">
                          🧺 Drop Off
                        </span>
                      )}
                      {cartArray.some((i) => i.tipe === 'SelfService') && (
                        <span className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-900 font-bold text-[11px] flex items-center gap-1 shadow-2xs">
                          ⚡ Self Service
                        </span>
                      )}
                      {cartArray.some((i) => !i.tipe || (i.tipe !== 'FullService' && i.tipe !== 'SelfService')) && (
                        <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-900 font-bold text-[11px] flex items-center gap-1 shadow-2xs">
                          🛒 Retail / FnB
                        </span>
                      )}
                      {cartArray.length === 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-500 font-bold text-[11px]">
                          Belum ada item
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Priority Option automatically appears if cart contains Drop Off items */}
                {cartArray.some((i) => i.tipe === 'FullService' || (i as any).kategoriDropOff || (i.kategori || '').toLowerCase().includes('drop')) && (() => {
                  const dropOffItemsInCart = cartArray.filter(
                    (i) => i.tipe === 'FullService' || (i as any).kategoriDropOff || (i.kategori || '').toLowerCase().includes('drop')
                  );
                  const registeredCartCategories = Array.from(
                    new Set(
                      dropOffItemsInCart
                        .map((i) => (i as any).kategoriDropOff)
                        .filter((k): k is string => Boolean(k && k.trim()))
                    )
                  );

                  const displayedPriorities = dropOffPriorities.filter((p) => {
                    if (p.aktif === false) return false;
                    if (registeredCartCategories.length > 0) {
                      return registeredCartCategories.some((cat) => cat.toLowerCase() === p.nama.toLowerCase());
                    }
                    return true;
                  });

                  const finalPriorities = displayedPriorities.length > 0 
                    ? displayedPriorities 
                    : (registeredCartCategories.length > 0 
                        ? registeredCartCategories.map(cat => ({ nama: cat, durasiJam: 0, aktif: true }))
                        : dropOffPriorities.filter(p => p.aktif !== false)
                      );

                  return (
                    <div className="bg-amber-50/70 border border-amber-200/90 p-3.5 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block font-bold text-amber-950 text-xs">
                          Prioritas Pengerjaan Cucian Drop Off:
                        </label>
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                          {finalPriorities.length === 1 ? 'Sesuai Layanan Terpilih' : 'Otomatis Masuk Antrean SOP'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {finalPriorities.map((pri) => (
                          <button
                            key={pri.nama}
                            type="button"
                            onClick={() => setTingkatLayanan(pri.nama)}
                            className={`py-2 px-3 rounded-xl font-bold text-xs border transition flex items-center gap-1.5 ${
                              tingkatLayanan.toLowerCase() === pri.nama.toLowerCase()
                                ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                                : 'bg-white text-slate-700 border-amber-200/90 hover:bg-amber-100/50'
                            }`}
                          >
                            <span>{pri.nama}</span>
                            {pri.durasiJam ? (
                              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                                tingkatLayanan.toLowerCase() === pri.nama.toLowerCase() ? 'bg-teal-900/40 text-teal-200' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {pri.durasiJam} Jam
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>

                      {/* Estimasi Maksimal Selesai */}
                      <div className="pt-2 border-t border-amber-200/70 flex items-center justify-between flex-wrap gap-1.5 text-xs">
                        <span className="text-amber-950 font-semibold flex items-center gap-1.5 text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Estimasi Maksimal Selesai:</span>
                        </span>
                        <span className="font-mono font-bold text-[#1E4648] bg-white px-2 py-0.5 rounded-lg border border-amber-300 shadow-2xs text-[11px]">
                          {calculateEstimasi(tingkatLayanan)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Catatan Tambahan */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Catatan Khusus Pesanan</label>
                  <textarea
                    rows={2}
                    value={catatanOrderInput}
                    onChange={(e) => setCatatanOrderInput(e.target.value)}
                    placeholder="Contoh: Pisahkan pakaian putih, jemput besok sore..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs outline-none focus:border-[#1E4648] focus:bg-white transition"
                  />
                </div>

                {/* Line Items & Financial Breakdown Summary Box */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Item Pesanan ({cartArray.length})</span>
                    <span>Subtotal</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                    {cartArray.map((i, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-slate-700">
                        <span className="font-semibold truncate pr-2">
                          {i.layanan} <span className="text-slate-400 font-mono">×{i.qty}</span>
                        </span>
                        <span className="font-bold font-mono shrink-0">
                          Rp {(i.qty * (i.hargaSatuan || 0)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600 font-semibold">
                      <span>Subtotal Item:</span>
                      <span className="font-mono">Rp {(subtotalCart || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {diskonApplied.nilai > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-200/60">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" /> Diskon ({diskonApplied.kode}):
                        </span>
                        <span className="font-mono">-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {customerMode === 'MEMBER' && customer.isMember && Math.floor((grandTotal || 0) / (poinRate || 10000)) > 0 && (
                      <div className="flex justify-between text-amber-800 font-bold pt-0.5">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Perolehan Poin (Member):
                        </span>
                        <span className="font-mono">+{Math.floor((grandTotal || 0) / (poinRate || 10000))} Poin</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Payment Calculator & Numpad */}
            <div className="w-full lg:w-[360px] xl:w-[390px] flex flex-col bg-slate-50 shrink-0 overflow-hidden">
              {/* Total Banner - Compact */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white py-3 px-4 text-center shrink-0 shadow-md">
                <span className="text-[9px] text-teal-200 font-extrabold uppercase tracking-widest block">
                  TOTAL PEMBAYARAN
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white font-mono drop-shadow-sm leading-tight block mt-0.5">
                  Rp {(grandTotal || 0).toLocaleString('id-ID')}
                </span>
                <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] font-medium">
                  {diskonApplied.nilai > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-semibold">
                      Diskon -Rp {diskonApplied.nilai.toLocaleString('id-ID')}
                    </span>
                  )}
                  {customerMode === 'MEMBER' && customer.isMember && Math.floor((grandTotal || 0) / (poinRate || 10000)) > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      +{Math.floor((grandTotal || 0) / (poinRate || 10000))} Poin
                    </span>
                  )}
                </div>
              </div>

              {/* Payment Method Tabs - Compact Row */}
              <div className="px-3 py-2 border-b border-slate-200 bg-white shrink-0">
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'Tunai', label: 'Tunai', icon: Receipt },
                    { id: 'QRIS', label: 'QRIS', icon: QrCode },
                    { id: 'Transfer', label: 'Transfer', icon: Send },
                    { id: 'Debit', label: 'Debit', icon: CreditCard },
                  ].map((m) => {
                    const MethodIcon = m.icon;
                    const isSelected = metodeBayar === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMetodeBayar(m.id as any)}
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200/90 hover:border-[#1E4648] hover:bg-slate-50'
                        }`}
                      >
                        <MethodIcon className="w-3.5 h-3.5" />
                        <span className="text-[10px]">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tunai: Numpad Calculator - Auto Fit */}
              {metodeBayar === 'Tunai' ? (
                <div className="flex-1 flex flex-col justify-between p-3 overflow-hidden">
                  {/* Display Input & Quick Reset */}
                  <div className="mb-1.5">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-bold text-slate-600 text-[11px]">Uang Diterima:</span>
                      {uangBayarInput && uangBayarInput !== '0' && (
                        <button
                          type="button"
                          onClick={() => setUangBayarInput('0')}
                          className="text-[10px] font-bold text-rose-500 hover:underline"
                        >
                          Reset (C)
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      readOnly
                      value={uangBayarInput ? `Rp ${Number(uangBayarInput).toLocaleString('id-ID')}` : 'Rp 0'}
                      className="w-full px-3 py-1.5 bg-white border-2 border-slate-300 rounded-xl font-black text-xl text-[#1E4648] text-right font-mono shadow-2xs"
                    />
                  </div>

                  {/* Quick Shortcut Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                    <button
                      type="button"
                      onClick={() => setUangBayarInput((grandTotal || 0).toString())}
                      className="py-1 bg-white border border-slate-200 hover:bg-teal-50 hover:border-[#1E4648] text-[#1E4648] font-bold rounded-lg text-[11px] transition shadow-2xs"
                    >
                      Uang Pas
                    </button>
                    <button
                      type="button"
                      onClick={() => setUangBayarInput('20000')}
                      className="py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] transition shadow-2xs"
                    >
                      20K
                    </button>
                    <button
                      type="button"
                      onClick={() => setUangBayarInput('50000')}
                      className="py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] transition shadow-2xs"
                    >
                      50K
                    </button>
                    <button
                      type="button"
                      onClick={() => setUangBayarInput('100000')}
                      className="py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] transition shadow-2xs"
                    >
                      100K
                    </button>
                  </div>

                  {/* Numpad Grid - Compact & Complete with 0, 00, 000 */}
                  <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                    {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() =>
                          setUangBayarInput((prev) => (prev === '0' || !prev ? num.toString() : prev + num))
                        }
                        className="py-1.5 sm:py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-lg shadow-2xs active:scale-95 transition font-mono"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '0'))}
                      className="py-1.5 sm:py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-lg shadow-2xs active:scale-95 transition font-mono"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '00'))}
                      className="py-1.5 sm:py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-base shadow-2xs active:scale-95 transition font-mono"
                    >
                      00
                    </button>
                    <button
                      type="button"
                      onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '000'))}
                      className="py-1.5 sm:py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-base shadow-2xs active:scale-95 transition font-mono"
                    >
                      000
                    </button>
                    <button
                      type="button"
                      onClick={() => setUangBayarInput('0')}
                      className="py-1.5 sm:py-2 bg-rose-50 border-2 border-rose-200 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-sm shadow-2xs active:scale-95 transition"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      onClick={() => setUangBayarInput((prev) => prev.slice(0, -1) || '0')}
                      className="col-span-2 py-1.5 sm:py-2 bg-slate-100 border-2 border-slate-200 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs shadow-2xs active:scale-95 transition flex items-center justify-center gap-1.5"
                    >
                      <Delete className="w-4 h-4" />
                      <span>Hapus</span>
                    </button>
                  </div>

                  {/* Kembalian / Kekurangan Display - Compact Bar */}
                  {Number(uangBayarInput) >= grandTotal && Number(uangBayarInput) > 0 ? (
                    <div className="bg-emerald-50 border border-emerald-300 rounded-xl py-1.5 px-3 flex items-center justify-between shadow-2xs">
                      <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">KEMBALIAN:</span>
                      <span className="text-base font-black text-emerald-700 font-mono">
                        Rp {(Number(uangBayarInput) - grandTotal).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ) : Number(uangBayarInput) > 0 ? (
                    <div className="bg-rose-50 border border-rose-300 rounded-xl py-1.5 px-3 flex items-center justify-between shadow-2xs">
                      <span className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">KURANG:</span>
                      <span className="text-base font-black text-rose-700 font-mono">
                        Rp {(grandTotal - Number(uangBayarInput)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ) : (
                    <div className="py-1 text-center text-[10px] text-slate-400 font-medium">
                      Pilih shortcut atau tekan tombol angka untuk bayar tunai
                    </div>
                  )}
                </div>
              ) : (
                /* Non-Tunai Display */
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-[#1E4648] flex items-center justify-center shadow-2xs">
                    {metodeBayar === 'QRIS' ? (
                      <QrCode className="w-6 h-6" />
                    ) : (
                      <CreditCard className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Pembayaran {metodeBayar}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nominal: <span className="font-bold text-[#1E4648] font-mono">Rp {grandTotal.toLocaleString('id-ID')}</span>
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-xl p-2.5 mt-1 max-w-xs shadow-2xs">
                    Pastikan dana telah masuk atau struk EDC berhasil keluar sebelum konfirmasi.
                  </div>
                </div>
              )}

              {/* Bottom Submit Action - Compact */}
              <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                <button
                  type="button"
                  onClick={handleConfirmPaymentSafe}
                  disabled={
                    paymentSubmitting ||
                    (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal)
                  }
                  className={`w-full font-bold py-3 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition ${
                    paymentSubmitting ||
                    (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal)
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-[#1E4648] hover:bg-[#163536] text-white shadow-teal-900/20'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{paymentSubmitting ? 'Memproses...' : 'Konfirmasi & Selesaikan Bayar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6 & 7: UNIFIED MODAL "Pembayaran Berhasil & Live Preview Cetakan" */}
      {showSuccessModal && completedOrderData && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative bg-white rounded-3xl w-full max-w-5xl border border-slate-200/90 shadow-2xl flex flex-col lg:flex-row overflow-hidden my-auto max-h-[94vh] animate-scale-in">
            
            {/* Prominent Modal Close Button - Top Right Corner */}
            <button 
              type="button"
              onClick={handleCompleteFlowAndReset} 
              className="absolute top-3.5 right-3.5 z-50 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-rose-600 text-white flex items-center justify-center transition-all shadow-md backdrop-blur-xs cursor-pointer active:scale-95 border border-white/20"
              title="Tutup & Selesai (Esc)"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* LEFT PANEL: Ringkasan Pembayaran & Tombol Aksi */}
            <div className="w-full lg:w-[410px] p-5 sm:p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50 overflow-y-auto shrink-0">
              <div>
                {/* Success Header Badge */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 leading-tight">Pembayaran Berhasil!</h3>
                    <p className="text-xs text-slate-500 font-medium">Transaksi order telah sukses disimpan</p>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 text-xs space-y-2 shadow-xs mb-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500 font-semibold">No. Invoice</span>
                    <span className="font-mono font-black text-[#1E4648] bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                      {completedOrderData.trxId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Pelanggan</span>
                    <span className="font-bold text-slate-800">{completedOrderData.pelanggan}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">No. WhatsApp</span>
                    <span className="font-mono font-semibold text-slate-700">{completedOrderData.noHp || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Kasir / Staff</span>
                    <span className="font-bold text-slate-800">{completedOrderData.kasir || 'Kasir'}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Layanan</span>
                    <span className="font-bold text-slate-800">
                      {completedOrderData.tipeLayanan === 'FullService'
                        ? `Drop Off (${completedOrderData.tingkatLayanan || 'Reguler'})`
                        : (completedOrderData.tipeLayanan === 'SelfService' ? 'Self Service' : 'Retail / Add On')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Metode Bayar</span>
                    <span className="font-bold text-slate-800">{completedOrderData.metodeBayar}</span>
                  </div>

                  {/* Financial Details (Subtotal & Diskon) */}
                  {Number(completedOrderData.diskon) > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1 text-slate-600">
                      <div className="flex justify-between items-center">
                        <span>Subtotal Belanja:</span>
                        <span className="font-mono font-bold">Rp {(Number(completedOrderData.subtotal) || Number(completedOrderData.total) || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-rose-600 font-bold">
                        <span>Diskon ({completedOrderData.diskonKode || 'Promo'}):</span>
                        <span className="font-mono">-Rp {Number(completedOrderData.diskon).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-slate-700 font-bold">Total Tagihan</span>
                    <span className="font-mono font-black text-[#1E4648] text-base">
                      Rp {(completedOrderData?.total || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {completedOrderData.metodeBayar === 'Tunai' && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Uang Diterima:</span>
                        <span className="font-mono font-bold">Rp {(completedOrderData?.uangBayar || completedOrderData?.total || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between items-center text-[#1E4648] font-bold bg-teal-50/80 px-2 py-1 rounded-lg border border-teal-200/60">
                        <span>Kembalian:</span>
                        <span className="font-mono font-black text-sm">Rp {(completedOrderData?.kembalian || 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  )}

                  {/* Loyalty Points Info */}
                  <div className="pt-2 border-t border-slate-100 bg-amber-50/70 -mx-1 p-2 rounded-xl space-y-1 border border-amber-200/60 text-[11px]">
                    <div className="flex justify-between items-center text-amber-900 font-bold">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Poin Transaksi:</span>
                      </span>
                      <span className="font-mono">+{completedOrderData.poinEarned || 0} Poin</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-800">
                      <span>Total Saldo Poin:</span>
                      <span className="font-mono font-bold">{completedOrderData.saldoPoinAkhir || 0} Poin</span>
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium italic pt-0.5 border-t border-amber-200/50">
                      Tukarkan poin dengan potongan harga/layanan gratis/produk di kasir!
                    </div>
                  </div>

                  {completedOrderData.tipeLayanan === 'FullService' && completedOrderData.estimasiSelesai && (
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-amber-800 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" /> Estimasi Selesai:
                      </span>
                      <span className="font-mono font-bold text-amber-900">{completedOrderData.estimasiSelesai}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 text-[11px] text-slate-400">
                    <span>Waktu:</span>
                    <span>{completedOrderData.tanggal} {completedOrderData.waktu}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Left Panel */}
              <div className="space-y-2 pt-2">
                {/* 1. Kirim WA */}
                <button
                  type="button"
                  onClick={() => {
                    const phone = String(completedOrderData.noHp || '').replace(/^0/, '62').replace(/\D/g, '');
                    const nama = completedOrderData.pelanggan || 'Pelanggan';
                    const noNota = completedOrderData.trxId || '';
                    const tanggal = `${completedOrderData.tanggal || ''}, ${completedOrderData.waktu || ''}`;
                    const total = (Number(completedOrderData?.total) || 0).toLocaleString('id-ID');
                    const subtotal = (Number(completedOrderData?.subtotal) || Number(completedOrderData?.total) || 0).toLocaleString('id-ID');
                    const diskonNilai = Number(completedOrderData?.diskon) || 0;
                    const diskonKode = completedOrderData?.diskonKode || '';
                    const poinEarned = Number(completedOrderData?.poinEarned) || 0;
                    const saldoPoin = Number(completedOrderData?.saldoPoinAkhir) || 0;

                    const isDropOff = completedOrderData.tipeLayanan === 'FullService';
                    const isSelfService = completedOrderData.tipeLayanan === 'SelfService';

                    const items = (completedOrderData.items || [])
                      .map((i: any) => `- ${i.layanan} (x${i.qty}) = Rp ${(Number(i.hargaSatuan) || 0).toLocaleString('id-ID')}`)
                      .join('\n');
                    const eNotaUrl = `https://duasisilaundry-pos.vercel.app/?t=${completedOrderData.token || noNota}`;

                    const msgLines = [
                      `*DUA SISI LAUNDRY*`,
                      `_Express & Self Service Laundry_`,
                      `--------------------------------`,
                      `Halo *${nama}*! Berikut rincian bukti transaksi Anda:`,
                      ``,
                      `*No. Nota*     : ${noNota}`,
                      `*Tanggal*      : ${tanggal}`,
                      `*Kasir/Staff*  : ${completedOrderData.kasir || 'Kasir'}`,
                    ];

                    if (isDropOff) {
                      msgLines.push(`*Layanan*      : Drop Off (Full Service)`);
                      msgLines.push(`*Kecepatan*    : ${completedOrderData.tingkatLayanan || 'Reguler'}`);
                      if (completedOrderData.estimasiSelesai) {
                        msgLines.push(`*Estimasi Selesai*: ${completedOrderData.estimasiSelesai}`);
                      }
                    } else if (isSelfService) {
                      msgLines.push(`*Layanan*      : Self Service (Cuci / Kering Mandiri)`);
                    } else {
                      msgLines.push(`*Kategori*     : Penjualan Produk / Retail`);
                    }

                    msgLines.push(``);
                    msgLines.push(`*Detail Layanan:*`);
                    msgLines.push(items);
                    msgLines.push(`--------------------------------`);

                    if (diskonNilai > 0) {
                      msgLines.push(`Subtotal       : Rp ${subtotal}`);
                      msgLines.push(`Diskon (${diskonKode || 'Promo'}): -Rp ${diskonNilai.toLocaleString('id-ID')}`);
                    }

                    msgLines.push(`*TOTAL BAYAR   : Rp ${total}*`);
                    msgLines.push(`Metode Bayar   : ${completedOrderData.metodeBayar || 'Tunai'}`);
                    if (completedOrderData.metodeBayar === 'Tunai' && (completedOrderData.kembalian || 0) > 0) {
                      msgLines.push(`Kembalian      : Rp ${(completedOrderData.kembalian || 0).toLocaleString('id-ID')}`);
                    }

                    msgLines.push(`--------------------------------`);
                    if (completedOrderData.isMember && poinEarned > 0) {
                      msgLines.push(`* *Poin Transaksi* : +${poinEarned} Poin`);
                      msgLines.push(`* *Total Saldo Poin*: ${saldoPoin} Poin`);
                      msgLines.push(`_(Tukarkan poin Anda dengan potongan harga/layanan gratis/produk di kasir!)_`);
                      msgLines.push(`--------------------------------`);
                    }
                    msgLines.push(`*Lihat E-Nota Resmi:*`);
                    msgLines.push(eNotaUrl);
                    msgLines.push(``);
                    msgLines.push(`Terima kasih telah mempercayakan cucian Anda di Dua SiSi Laundry!`);

                    const msg = msgLines.filter(Boolean).join('\n');
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="w-full bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Struk ke WhatsApp</span>
                </button>

                {/* 2. Selesai (Transaksi Baru) */}
                <button
                  type="button"
                  onClick={handleCompleteFlowAndReset}
                  className="w-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
                >
                  Selesai (Transaksi Baru)
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: Live Preview Cetakan (Struk & Label Tag) */}
            <div className="flex-1 p-5 sm:p-6 flex flex-col min-w-0 bg-white overflow-hidden">
              {/* Header Preview Toolbar */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 gap-2 flex-wrap shrink-0">
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setSuccessModalTab('struk')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      successModalTab === 'struk'
                        ? 'bg-[#1E4648] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Struk Thermal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuccessModalTab('label')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      successModalTab === 'label'
                        ? 'bg-[#1E4648] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Label Tag Drop Off</span>
                  </button>
                </div>

                {successModalTab === 'struk' && (
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400 font-semibold">Format:</span>
                    <button
                      type="button"
                      onClick={() => setPaperSize('58mm')}
                      className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${paperSize === '58mm' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      58mm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperSize('80mm')}
                      className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${paperSize === '80mm' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      80mm
                    </button>
                  </div>
                )}
              </div>

              {/* Realistic Paper Scroll View */}
              <div className="flex-1 overflow-y-auto py-4 px-2 flex justify-center bg-slate-100/80 rounded-2xl my-3 border border-slate-200/80 shadow-inner">
                {successModalTab === 'struk' ? (
                  /* THERMAL RECEIPT PREVIEW */
                  <div className={`bg-white p-5 rounded-none shadow-md border border-slate-300 font-mono text-[11px] leading-tight text-slate-800 my-auto ${paperSize === '80mm' ? 'w-[320px]' : 'w-[260px]'}`}>
                    <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-300">
                      <div className="text-sm font-black tracking-wide text-slate-900">DUA SISI LAUNDRY</div>
                      <div className="text-[10px] text-slate-500 font-sans">Express & Self Service Coin Laundry</div>
                      <div className="text-[8.5px] text-slate-600 font-sans leading-tight">
                        Jl. Pangestu Raya, Kasin, Karangploso, Malang (Belakang UMM 3)
                      </div>
                      <div className="text-[8.5px] text-slate-600 font-sans font-semibold">
                        Hotline WA: +62 896-8202-0699
                      </div>
                    </div>

                    <div className="py-2 border-b border-dashed border-slate-300 text-[10px] space-y-0.5 text-slate-600">
                      <div className="flex justify-between"><span>No Nota :</span><span className="font-bold text-slate-900">{completedOrderData.trxId}</span></div>
                      <div className="flex justify-between"><span>Waktu   :</span><span>{completedOrderData.tanggal} {completedOrderData.waktu}</span></div>
                      <div className="flex justify-between"><span>Kasir   :</span><span>{completedOrderData.kasir || 'Kasir'}</span></div>
                      <div className="flex justify-between"><span>Cust    :</span><span className="font-bold text-slate-900">{completedOrderData.pelanggan}</span></div>
                      <div className="flex justify-between">
                        <span>Layanan :</span>
                        <span className="font-bold text-slate-900">
                          {completedOrderData.tipeLayanan === 'FullService'
                            ? `Drop Off (${completedOrderData.tingkatLayanan || 'Reguler'})`
                            : (completedOrderData.tipeLayanan === 'SelfService' ? 'Self Service' : 'Retail / Add On')}
                        </span>
                      </div>
                      {completedOrderData.tipeLayanan === 'FullService' && completedOrderData.estimasiSelesai && (
                        <div className="flex justify-between text-slate-900 font-bold border-t border-dashed border-slate-200 pt-0.5 mt-0.5">
                          <span>Estimasi:</span>
                          <span className="text-[9.5px]">{completedOrderData.estimasiSelesai}</span>
                        </div>
                      )}
                    </div>

                    <div className="py-2 border-b border-dashed border-slate-300 space-y-1.5 text-[10px]">
                      {(completedOrderData.items || []).map((i: any, idx: number) => (
                        <div key={idx}>
                          <div className="font-bold text-slate-900 truncate">{i.layanan}</div>
                          <div className="flex justify-between text-slate-600">
                            <span>{i.qty} × Rp {(Number(i.hargaSatuan) || 0).toLocaleString('id-ID')}</span>
                            <span className="font-bold font-mono">Rp {(i.qty * (Number(i.hargaSatuan) || 0)).toLocaleString('id-ID')}</span>
                          </div>
                          {i.catatan && (
                            <div className="text-[9px] text-slate-400 italic">Catatan: {i.catatan}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="py-2 border-b border-dashed border-slate-300 space-y-0.5 text-[10px]">
                      {Number(completedOrderData.diskon) > 0 && (
                        <>
                          <div className="flex justify-between text-slate-600">
                            <span>Subtotal :</span>
                            <span className="font-mono">Rp {(Number(completedOrderData.subtotal) || Number(completedOrderData.total) || 0).toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between text-slate-900 font-bold">
                            <span>Diskon ({completedOrderData.diskonKode || 'Promo'}) :</span>
                            <span className="font-mono">-Rp {Number(completedOrderData.diskon).toLocaleString('id-ID')}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-dashed border-slate-200">
                        <span>TOTAL :</span>
                        <span className="font-mono text-xs">Rp {(Number(completedOrderData?.total) || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 font-normal">
                        <span>BAYAR ({completedOrderData.metodeBayar}):</span>
                        <span className="font-mono font-bold">Rp {(Number(completedOrderData?.uangBayar || completedOrderData?.total) || 0).toLocaleString('id-ID')}</span>
                      </div>
                      {(completedOrderData?.kembalian || 0) > 0 && (
                        <div className="flex justify-between text-slate-900 font-bold">
                          <span>KEMBALI :</span>
                          <span className="font-mono">Rp {(Number(completedOrderData?.kembalian) || 0).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    <div className="py-1.5 border-b border-dashed border-slate-300 text-[9.5px] text-slate-600 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Poin Transaksi:</span>
                        <span className="font-bold font-mono">+{completedOrderData.poinEarned || 0} Pts</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-800">
                        <span>Total Saldo Poin:</span>
                        <span className="font-mono">{completedOrderData.saldoPoinAkhir || 0} Pts</span>
                      </div>
                    </div>

                    <div className="py-1.5 border-b border-dashed border-slate-300 text-[9px] text-center space-y-0.5 text-slate-600">
                      <div className="font-bold">WiFi: DuaSisiLaundry</div>
                      <div>Password: datanglagi</div>
                    </div>

                    <div className="text-center pt-2 text-[9px] text-slate-500 space-y-0.5">
                      <div className="font-bold text-slate-700">*** TERIMA KASIH ***</div>
                      <div>Kritik & Saran: +62 896-8202-0699</div>
                      <div>Tukarkan poin Anda dengan diskon/layanan gratis/produk di kasir!</div>
                      <div className="text-[8px] font-mono break-all pt-1 text-slate-400">
                        E-Nota: duasisilaundry-pos.vercel.app/?t={completedOrderData.token || completedOrderData.trxId}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* LABEL TAG PREVIEW (Khusus Drop Off) */
                  <div className="w-[280px] bg-white p-4 rounded-xl shadow-md border-2 border-slate-800 font-mono text-slate-900 my-auto space-y-2">
                    <div className="text-center py-1 border-b-2 border-slate-800 font-bold">
                      DUA SISI - LABEL CUCIAN
                    </div>
                    <div className="text-center py-1 border-b-2 border-slate-800">
                      <div className="text-xs text-slate-500">NO. NOTA</div>
                      <div className="text-base font-black tracking-wider">{completedOrderData.trxId}</div>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pelanggan:</span>
                        <span className="font-bold">{completedOrderData.pelanggan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">No. HP:</span>
                        <span className="font-bold">{completedOrderData.noHp || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Layanan:</span>
                        <span className="font-bold">{completedOrderData.tingkatLayanan || 'Reguler'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Estimasi:</span>
                        <span className="font-bold">{completedOrderData.estimasiSelesai || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Petugas:</span>
                        <span className="font-bold">{completedOrderData.kasir}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-dashed border-slate-400 text-center text-[10px] text-slate-500">
                      Tempelkan pada kantong/hanger pakaian
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Quick Controls for Right Panel */}
              <div className="flex items-center justify-between gap-2 pt-1 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const nama = completedOrderData.pelanggan || 'Pelanggan';
                    const noNota = completedOrderData.trxId || '';
                    const tanggal = `${completedOrderData.tanggal || ''}, ${completedOrderData.waktu || ''}`;
                    const total = (Number(completedOrderData?.total) || 0).toLocaleString('id-ID');
                    const subtotal = (Number(completedOrderData?.subtotal) || Number(completedOrderData?.total) || 0).toLocaleString('id-ID');
                    const diskonNilai = Number(completedOrderData?.diskon) || 0;
                    const diskonKode = completedOrderData?.diskonKode || '';
                    const poinEarned = Number(completedOrderData?.poinEarned) || 0;
                    const saldoPoin = Number(completedOrderData?.saldoPoinAkhir) || 0;

                    const isDropOff = completedOrderData.tipeLayanan === 'FullService';
                    const isSelfService = completedOrderData.tipeLayanan === 'SelfService';

                    const items = (completedOrderData.items || [])
                      .map((i: any) => `- ${i.layanan} (x${i.qty}) = Rp ${(Number(i.hargaSatuan) || 0).toLocaleString('id-ID')}`)
                      .join('\n');

                    const lines = [
                      `DUA SISI LAUNDRY`,
                      `No Nota: ${noNota}`,
                      `Tanggal: ${tanggal}`,
                      `Kasir/Staff: ${completedOrderData.kasir || 'Kasir'}`,
                      `Pelanggan: ${nama}`,
                    ];

                    if (isDropOff) {
                      lines.push(`Layanan: Drop Off (Full Service) - ${completedOrderData.tingkatLayanan || 'Reguler'}`);
                      if (completedOrderData.estimasiSelesai) {
                        lines.push(`Estimasi Selesai: ${completedOrderData.estimasiSelesai}`);
                      }
                    } else if (isSelfService) {
                      lines.push(`Layanan: Self Service (Cuci/Kering Mandiri)`);
                    } else {
                      lines.push(`Kategori: Penjualan Produk / Retail`);
                    }

                    lines.push(``);
                    lines.push(`Item:`);
                    lines.push(items);
                    lines.push(``);

                    if (diskonNilai > 0) {
                      lines.push(`Subtotal: Rp ${subtotal}`);
                      lines.push(`Diskon (${diskonKode || 'Promo'}): -Rp ${diskonNilai.toLocaleString('id-ID')}`);
                    }

                    lines.push(`Total: Rp ${total}`);
                    lines.push(`Status: Lunas (${completedOrderData.metodeBayar})`);
                    lines.push(`Poin Transaksi: +${poinEarned} Pts | Saldo Poin: ${saldoPoin} Pts`);
                    lines.push(`(Tukarkan poin Anda dengan potongan harga/layanan gratis/produk di kasir)`);
                    lines.push(`Terima kasih!`);

                    const text = lines.join('\n');
                    navigator.clipboard.writeText(text);
                    setToastMsg('Teks struk berhasil disalin ke clipboard!');
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Teks Struk</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Browser (A4/PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintReceipt(successModalTab)}
                    disabled={btPrinting}
                    className="px-4 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Bluetooth className="w-3.5 h-3.5" />
                    <span>Cetak {successModalTab === 'label' ? 'Label Tag' : 'Struk Thermal'}</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Buka Shift Modal */}
      {showBukaShiftModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-slate-100 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800 mb-1">Buka Shift Kasir Baru</h3>
            <p className="text-xs text-slate-500 mb-4">Cek dan masukkan modal fisik laci kas dan saldo aplikasi merchant sebelum mulai.</p>
            
            <div className="space-y-3.5 mb-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>1. Uang Fisik Kasir (Laci Kas)</span>
                  <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded">Tunai</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</div>
                  <input
                    type="number"
                    value={kasAwalInput}
                    onChange={(e) => setKasAwalInput(e.target.value)}
                    placeholder="100000"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>2. Saldo Aplikasi Merchant</span>
                  <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded">QRIS / EDC / E-Wallet</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</div>
                  <input
                    type="number"
                    value={saldoMerchantAwalInput}
                    onChange={(e) => setSaldoMerchantAwalInput(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button onClick={() => setShowBukaShiftModal(false)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">Batal</button>
              <button
                onClick={handleOpenShift}
                disabled={shiftSubmitting}
                className="flex-1 bg-[#1E4648] hover:bg-[#163536] disabled:opacity-50 text-white rounded-xl text-xs font-bold py-2.5 shadow-md transition"
              >
                {shiftSubmitting ? 'Membuka Shift...' : 'Buka Shift Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Tutup Shift Modal with Summary, Merchant Reconcile & Expense Items with Receipt Photos */}
      {showTutupShiftModal && shiftAktif && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden border border-slate-100 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Tutup Shift & Rekap Kas Laci & Merchant</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kasir: <strong className="text-slate-700">{shiftAktif.namaKasir}</strong> • Shift dibuka {new Date(shiftAktif?.waktuBuka || Date.now()).toLocaleDateString('id-ID')} ({new Date(shiftAktif?.waktuBuka || Date.now()).toLocaleTimeString('id-ID')})
                </p>
              </div>
              <button onClick={() => setShowTutupShiftModal(false)} className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                {/* LEFT COLUMN: Uang Laci & Saldo Merchant */}
                <div className="space-y-5">
                  {/* Card 1: Rekap Uang Kasir (Laci Kas) */}
                  <div className="bg-teal-50/50 border border-teal-200/70 rounded-2xl p-4">
                    <h4 className="font-bold text-teal-900 mb-3 text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-teal-700" />
                        1. Rekonsiliasi Uang Fisik Kasir (Laci)
                      </span>
                      <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">Tunai</span>
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Kas Awal Laci:</span>
                        <span className="font-semibold text-slate-800">Rp {(shiftAktif?.kasAwal || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Total Pemasukan Tunai:</span>
                        <span className="font-semibold text-teal-700">+ Rp {(shiftAktif?.totalOmzetTunai || 0).toLocaleString('id-ID')}</span>
                      </div>
                      {totalShiftExpense > 0 && (
                        <div className="flex justify-between text-rose-600 font-semibold">
                          <span>Total Belanja Barang Shift:</span>
                          <span>- Rp {totalShiftExpense.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      <hr className="border-teal-200/60 my-1" />
                      <div className="flex justify-between text-xs font-bold text-teal-950">
                        <span>Ekspektasi Uang Laci:</span>
                        <span>Rp {((shiftAktif?.kasAwal || 0) + (shiftAktif?.totalOmzetTunai || 0) - totalShiftExpense).toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-teal-200/60">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Total Fisik Kas di Laci Saat Ini (Rp) *</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</div>
                        <input
                          type="number"
                          value={kasAkhirFisik}
                          onChange={(e) => setKasAkhirFisik(e.target.value)}
                          placeholder="Hitung jumlah uang fisik di laci kasir"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-teal-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20"
                        />
                      </div>
                      {kasAkhirFisik && (
                        <div className={`mt-2 p-2 rounded-lg text-xs font-bold flex items-center justify-between ${
                          (Number(kasAkhirFisik) || 0) === ((shiftAktif?.kasAwal || 0) + (shiftAktif?.totalOmzetTunai || 0) - totalShiftExpense) 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          <span>Selisih Kas Laci:</span>
                          <span>Rp {((Number(kasAkhirFisik) || 0) - ((shiftAktif?.kasAwal || 0) + (shiftAktif?.totalOmzetTunai || 0) - totalShiftExpense)).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Rekap Saldo di Aplikasi Merchant */}
                  <div className="bg-indigo-50/50 border border-indigo-200/70 rounded-2xl p-4">
                    <h4 className="font-bold text-indigo-900 mb-3 text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-indigo-700" />
                        2. Rekonsiliasi Saldo Aplikasi Merchant
                      </span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">QRIS / EDC</span>
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Saldo Awal Merchant:</span>
                        <span className="font-semibold text-slate-800">Rp {(shiftAktif?.saldoMerchantAwal || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Pemasukan Non-Tunai (QRIS/EDC):</span>
                        <span className="font-semibold text-indigo-700">+ Rp {(shiftAktif?.totalOmzetMerchant || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <hr className="border-indigo-200/60 my-1" />
                      <div className="flex justify-between text-xs font-bold text-indigo-950">
                        <span>Ekspektasi Saldo Merchant:</span>
                        <span>Rp {((shiftAktif?.saldoMerchantAwal || 0) + (shiftAktif?.totalOmzetMerchant || 0)).toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-indigo-200/60">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Saldo di Aplikasi Merchant Saat Ini (Rp) *</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">Rp</div>
                        <input
                          type="number"
                          value={saldoMerchantAkhirInput}
                          onChange={(e) => setSaldoMerchantAkhirInput(e.target.value)}
                          placeholder="Periksa saldo akhir di aplikasi merchant"
                          className="w-full pl-9 pr-3 py-2 bg-white border border-indigo-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20"
                        />
                      </div>
                      {saldoMerchantAkhirInput && (
                        <div className={`mt-2 p-2 rounded-lg text-xs font-bold flex items-center justify-between ${
                          (Number(saldoMerchantAkhirInput) || 0) === ((shiftAktif?.saldoMerchantAwal || 0) + (shiftAktif?.totalOmzetMerchant || 0)) 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          <span>Selisih Merchant:</span>
                          <span>Rp {((Number(saldoMerchantAkhirInput) || 0) - ((shiftAktif?.saldoMerchantAwal || 0) + (shiftAktif?.totalOmzetMerchant || 0))).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mode Penutupan */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Mode Penutupan</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => { setCloseShiftMode('SERAH_TERIMA'); setHandoverResult(null); }}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${closeShiftMode === 'SERAH_TERIMA' ? 'bg-[#1E4648] border-[#1E4648] text-white shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        Serah Terima Shift
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCloseShiftMode('TUTUP_HARIAN'); setHandoverResult(null); }}
                        className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${closeShiftMode === 'TUTUP_HARIAN' ? 'bg-rose-600 border-rose-600 text-white shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      >
                        Tutup Hari Ini
                      </button>
                    </div>
                  </div>

                  {/* Conditional: Staff Pengganti */}
                  {closeShiftMode === 'SERAH_TERIMA' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Staf Shift Pengganti</label>
                      <div className="flex gap-2">
                        <select
                          value={replacementEmployeeId}
                          onChange={(event) => { setReplacementEmployeeId(event.target.value); setHandoverResult(null); }}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-[#1E4648]"
                        >
                          <option value="">Pilih staf pengganti...</option>
                          {staffList.filter((staff) => staff.id !== shiftAktif.idUser).map((staff) => (
                            <option key={staff.id} value={staff.id}>{staff.nama}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleCheckHandover}
                          disabled={shiftSubmitting || !replacementEmployeeId}
                          className="px-3 py-2 rounded-lg bg-[#1E4648] hover:bg-[#163536] text-white disabled:opacity-50 text-xs font-bold transition"
                        >
                          Verifikasi
                        </button>
                      </div>
                      {handoverResult && (
                        <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-bold ${handoverResult.eligible ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {handoverResult.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Belanja Barang & Slot Foto Nota */}
                <div className="space-y-5">
                  {/* Card Belanja Barang (Item per Item) */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-rose-600" />
                        Pencatatan Belanja Barang Operasional
                      </h4>
                      <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2 py-0.5 rounded-full">
                        Item per Item
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Catat rincian setiap barang yang dibeli selama shift beserta nominal biayanya (opsional).</p>

                    {/* Dynamic Item Rows */}
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {expenseItemList.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={item.nama}
                              onChange={(e) => handleUpdateExpenseItem(idx, 'nama', e.target.value)}
                              placeholder={`Barang #${idx + 1} (contoh: Sabun Cuci 5L)`}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-[#1E4648]"
                            />
                          </div>
                          <div className="w-32 relative">
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-[11px]">Rp</div>
                            <input
                              type="number"
                              value={item.nominal}
                              onChange={(e) => handleUpdateExpenseItem(idx, 'nominal', e.target.value)}
                              placeholder="0"
                              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#1E4648]"
                            />
                          </div>
                          {expenseItemList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveExpenseItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus baris ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleAddExpenseItem}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E4648] hover:text-[#163536] bg-teal-50 hover:bg-teal-100/80 px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Barang</span>
                      </button>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Total Belanja Barang:</span>
                        <span className="text-sm font-bold text-rose-700">Rp {totalShiftExpense.toLocaleString('id-ID')}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400">Total belanja otomatis memotong perhitungan kas akhir laci.</p>

                    {/* Slot Foto Bukti Nota Pembelian */}
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-blue-600" />
                        <span>Slot Foto Nota Pembelian (Bukti Struk)</span>
                      </label>
                      
                      <div className="mt-1">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          onChange={handleExpensePhotoUpload}
                          id="expense-receipt-upload"
                          className="hidden"
                        />
                        <label
                          htmlFor="expense-receipt-upload"
                          className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#1E4648] bg-white flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-600 hover:text-[#1E4648] transition group"
                        >
                          <Camera className="w-5 h-5 text-slate-400 group-hover:text-[#1E4648] transition" />
                          <span className="text-xs font-bold">Ambil Foto / Upload Foto Nota</span>
                          <span className="text-[10px] text-slate-400">Dapat mengunggah beberapa lembar foto nota sekaligus</span>
                        </label>
                      </div>

                      {expensePhotos.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-600 block">{expensePhotos.length} foto nota siap tersimpan:</span>
                          <div className="grid grid-cols-3 gap-2">
                            {expensePhotos.map((photo, idx) => (
                              <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                                <img src={photo.preview} alt={`Nota ${idx + 1}`} className="w-full h-20 object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removeExpensePhoto(idx)}
                                  className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-md hover:bg-rose-700 transition"
                                  title="Hapus foto"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={() => setShowTutupShiftModal(false)} 
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                onClick={handleCloseShiftWithExpense}
                disabled={shiftSubmitting || !kasAkhirFisik || !saldoMerchantAkhirInput || (closeShiftMode === 'SERAH_TERIMA' && !handoverResult?.eligible)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold py-2.5 flex items-center justify-center gap-2 shadow-md transition"
              >
                {shiftSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Menutup Kas Shift...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Tutup Shift & Simpan Rekonsiliasi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tambah Produk Custom Modal */}
      {showCustomItemModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm border border-slate-100 shadow-lg">
            <h3 className="text-sm font-bold text-slate-600 mb-3">Tambah Produk / Layanan Baru</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Produk / Layanan *</label>
                <input
                  type="text"
                  value={customItemForm.layanan}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, layanan: e.target.value })}
                  placeholder="Contoh: Cuci Karpet Jumbo"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Harga Satuan (Rp) *</label>
                <input
                  type="number"
                  value={customItemForm.hargaSatuan}
                  onChange={(e) => setCustomItemForm({ ...customItemForm, hargaSatuan: e.target.value })}
                  placeholder="25000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCustomItemModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Batal</button>
              <button onClick={async () => {
                if (!customItemForm.layanan || !customItemForm.hargaSatuan) {
                  await showAlert('Mohon isi nama dan harga produk!', 'warning');
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
                setCustomItemForm({ layanan: '', hargaSatuan: '', kategori: 'Add On' });
              }} className="flex-1 bg-[#1E4648] text-white rounded-lg text-xs font-bold py-2">Tambah Produk</button>
            </div>
          </div>
        </div>
      )}

      {/* SMART RECOMMENDATION MODAL (POS) */}
      {showRekomendasiModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#1E4648] text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Sistem Rekomendasi Keputusan Kasir</h3>
                  <p className="text-[10px] text-slate-400">Analisis otomatis promo, poin loyalitas, upsell add-on, & stok</p>
                </div>
              </div>
              <button onClick={() => setShowRekomendasiModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              {rekomendasiKasir.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold text-slate-600">Semua pengaturan transaksi sudah optimal.</p>
                  <p className="text-[11px] text-slate-400">Belum ada saran promo tambahan atau peringatan stok saat ini.</p>
                </div>
              ) : (
                rekomendasiKasir.map((rek) => (
                  <div key={rek.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 hover:border-[#1E4648]/40 transition">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-1.5">
                        {rek.tipe === 'PROMO' && <Gift className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {rek.tipe === 'POIN' && <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />}
                        {rek.tipe === 'UPSELL' && <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" />}
                        {rek.tipe === 'PERINGATAN' && <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />}
                        <span className="font-bold text-slate-800">{rek.judul}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase shrink-0 ${rek.badgeColor}`}>
                        {rek.badge}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">{rek.deskripsi}</p>
                    {rek.actionText && rek.onAction && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={rek.onAction}
                          className="px-3 py-1.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-md text-[11px] flex items-center gap-1 shadow-xs transition"
                        >
                          <Zap className="w-3 h-3 text-amber-300" />
                          <span>{rek.actionText}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 mt-3">
              <button onClick={() => setShowRekomendasiModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PrinterModal untuk Cetak Struk */}
      {showStrukModal && completedOrderData && (
        <PrinterModal
          isOpen={showStrukModal}
          onClose={() => setShowStrukModal(false)}
          printType="struk"
          tx={{
            noNota: completedOrderData.trxId,
            tanggal: completedOrderData.tanggal,
            namaPelanggan: completedOrderData.pelanggan,
            noHp: completedOrderData.noHp,
            total: completedOrderData.total,
            status: 'Selesai',
            petugas: completedOrderData.kasir,
            tipe: completedOrderData.tipeLayanan || 'SelfService',
            tingkatLayanan: 'Reguler',
            catatan: completedOrderData.catatan || '',
            statusVoid: 'None',
            metodeBayar: completedOrderData.metodeBayar,
            nominalDP: completedOrderData.uangBayar,
            kembalian: completedOrderData.kembalian,
            items: (completedOrderData.items || []).map((i: any) => ({
              layanan: i.layanan,
              qty: Number(i.qty) || 1,
              hargaSatuan: Number(i.hargaSatuan) || 0,
              subtotal: (Number(i.qty) || 1) * (Number(i.hargaSatuan) || 0),
              catatan: i.catatan || '',
            })),
          } as any}
          onPrintSuccess={() => setShowStrukModal(false)}
        />
      )}

    </div>
  );
}
