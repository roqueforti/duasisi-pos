'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Award,
  Printer,
  QrCode,
  FileText,
  Send,
  Clock,
  Check,
  ChevronRight,
  ChevronLeft,
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
  Smartphone,
  Eye,
  Loader2,
  Image as ImageIcon,
  UserPlus,
  Scale
} from 'lucide-react';
import { LayananItem, CartItem, ShiftKasir, AbsensiConfig, UserRole, InsufficientStockItem, StockValidationResult, InventoryUsageStats } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { formatWaPhone, parseDecimal, formatDecimal, formatDateTime, formatTargetSelesai } from '@/lib/utils';
import { generateWhatsAppReceiptMessage } from '@/lib/whatsappUtils';
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
import { useDisplaySettings } from '@/components/DisplaySettingsContext';
import { resolveCustomerProgram } from '@/lib/loyaltyUtils';

export interface ExpensePhotoItem {
  id: string;
  name: string;
  base64: string;
  preview: string;
  sizeKb: number;
}

/**
 * Compresses an image File using an offscreen HTML5 Canvas.
 * Max dimension 1280px, quality 0.75 (JPEG).
 * Drastically reduces payload from ~10MB to ~150KB for fast, reliable upload to Drive.
 */
async function compressImageFile(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.75): Promise<{ base64: string; mimeType: string; preview: string; sizeKb: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas foto'));
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return reject(new Error('Format berkas tidak valid'));
      
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat format gambar'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const rawBase64 = src.split(',')[1] || '';
          resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg', preview: src, sizeKb: Math.round(file.size / 1024) });
          return;
        }
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1] || '';
        const sizeKb = Math.round((base64.length * 3) / 4 / 1024);
        resolve({ base64, mimeType: 'image/jpeg', preview: dataUrl, sizeKb });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

interface CustomerState {
  nama: string;
  noHp: string;
  alamat?: string;
  tglLahir?: string;
  memberStatus?: string;
  isMember?: boolean;
  poin?: number;
  totalOrder?: number;
  stamps75?: number;
  stamps45?: number;
  assignedCard7kgId?: string;
  assignedCard4kgId?: string;
  rewardReady7kg?: boolean;
  rewardReady4kg?: boolean;
}

export function detectWasherAndDryer(items: Array<{ layanan: string; qty?: number; tipe?: string; kategori?: string }>): {
  hasWasher: boolean;
  hasDryer: boolean;
  isEligible: boolean;
  cardType: '75' | '45';
  stampsToAdd: number;
} {
  if (!items || items.length === 0) {
    return { hasWasher: false, hasDryer: false, isEligible: false, cardType: '75', stampsToAdd: 0 };
  }

  let hasWasher = false;
  let hasDryer = false;
  let is45 = false;
  let comboCount = 0;
  let washerCount = 0;
  let dryerCount = 0;

  for (const item of items) {
    const name = (item.layanan || '').toLowerCase();
    const tipe = (item.tipe || '').toLowerCase();
    const kat = (item.kategori || '').toLowerCase();
    const qty = Math.max(1, Number(item.qty) || 1);

    // Capacity detection: cek variasi 4kg, 4.5kg, 4,5kg
    // Regex mendeteksi '4kg', '4 kg', '4.5kg', '4.5 kg', '4,5kg', '4,5 kg'
    const match4 = /\b4([.,]5)?\s*kg\b/i.test(name) || name.includes('4,5') || name.includes('4.5') || name.includes('4kg') || name.includes('4 kg');
    const match7 = /\b7([.,]5)?\s*kg\b/i.test(name) || name.includes('7,5') || name.includes('7.5') || name.includes('7kg') || name.includes('7 kg');

    if (match4) {
      is45 = true;
    }

    // 1. Combo washer + dryer: e.g. "cuci + kering", "cuci lipat", "cuci setrika", or drop off full service
    const isCombo = (name.includes('cuci') && (name.includes('kering') || name.includes('dry'))) ||
                    name.includes('cuci lipat') ||
                    name.includes('cuci setrika') ||
                    tipe === 'fullservice' ||
                    kat.includes('drop');

    if (isCombo) {
      hasWasher = true;
      hasDryer = true;
      comboCount += qty;
      continue;
    }

    // 2. Washer only
    const isWasherItem = (name.includes('cuci') || name.includes('washer')) && !name.includes('setrika saja');
    if (isWasherItem) {
      hasWasher = true;
      washerCount += qty;
    }

    // 3. Dryer only
    const isDryerItem = name.includes('kering') || name.includes('pengering') || name.includes('dryer') || name.includes('dry');
    if (isDryerItem) {
      hasDryer = true;
      dryerCount += qty;
    }
  }

  const isEligible = (hasWasher && hasDryer) || comboCount > 0;
  const stampsToAdd = isEligible 
    ? Math.max(1, comboCount + Math.min(washerCount, dryerCount))
    : 0;

  return {
    hasWasher,
    hasDryer,
    isEligible,
    cardType: is45 ? '45' : '75',
    stampsToAdd
  };
}

import { getLayananStyleConfig, getIconComponent, KategoriItem } from '@/lib/categoryUtils';

export default function PosView({ 
  currentRole,
  onNavigateTab
}: { 
  currentRole?: UserRole;
  onNavigateTab?: (tab: string) => void;
} = {}) {

  const { showAlert, showConfirm } = useDialog();
  let inverseZoom = 1;
  try {
    const { settings } = useDisplaySettings();
    const zoomFactor = (settings?.zoomScale || 100) / 100;
    inverseZoom = 1 / (zoomFactor || 1);
  } catch {}
  const [layananList, setLayananList] = useState<LayananItem[]>([]);
  const [layananLoading, setLayananLoading] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('Semua');
  const [kategoriList, setKategoriList] = useState<KategoriItem[]>([]);
  const [poinRate, setPoinRate] = useState<number>(10000);
  
  // 1. Cart & Order State
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [customer, setCustomer] = useState<CustomerState>({ nama: '', noHp: '' });
  const [isManualCustomer, setIsManualCustomer] = useState<boolean>(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'noHp' | 'nama' | null>(null);
  const [showQuickAddMember, setShowQuickAddMember] = useState<boolean>(false);
  const [newMemberForm, setNewMemberForm] = useState({ nama: '', noHp: '', alamat: '', tglLahir: '' });
  const [savingMember, setSavingMember] = useState<boolean>(false);
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [voucherMsg, setVoucherMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [diskonApplied, setDiskonApplied] = useState<{ kode: string; nilai: number }>({ kode: '', nilai: 0 });
  const [claimedLoyaltyCardType, setClaimedLoyaltyCardType] = useState<'75' | '45' | null>(null);
  const [promoList, setPromoList] = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [showRekomendasiModal, setShowRekomendasiModal] = useState<boolean>(false);

  // DSS Inventory Stock Decision States
  const [showStockDecisionModal, setShowStockDecisionModal] = useState<boolean>(false);
  const [stockDecisionItems, setStockDecisionItems] = useState<InsufficientStockItem[]>([]);
  const [quickActionModal, setQuickActionModal] = useState<{
    type: 'ADJUST' | 'RESTOCK';
    item: InsufficientStockItem;
    inputQty: string;
    submitting: boolean;
  } | null>(null);

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
  const [namaKasirInput, setNamaKasirInput] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('pos_active_shift_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.namaKasir && (parsed.status === 'Buka' || parsed.status === 'Aktif')) {
            return parsed.namaKasir;
          }
        }
      } catch {}
    }
    return 'Kasir 1';
  });
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
  const [expensePhotos, setExpensePhotos] = useState<ExpensePhotoItem[]>([]);
  const [isCompressingPhotos, setIsCompressingPhotos] = useState<boolean>(false);
  const [shiftSubmitStatusText, setShiftSubmitStatusText] = useState<string>('');
  const [previewModalPhoto, setPreviewModalPhoto] = useState<{ src: string; title: string } | null>(null);

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
  const [mobileCheckoutTab, setMobileCheckoutTab] = useState<'detail' | 'bayar'>('detail');
  const [showKonfirmasiBayarModal, setShowKonfirmasiBayarModal] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [showPreviewStrukModal, setShowPreviewStrukModal] = useState<boolean>(false);

  const [showBukaShiftModal, setShowBukaShiftModal] = useState<boolean>(false);
  const [showTutupShiftModal, setShowTutupShiftModal] = useState<boolean>(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState<boolean>(false);
  const [showMobileCart, setShowMobileCart] = useState<boolean>(false);
  const [catalogViewMode, setCatalogViewMode] = useState<'auto' | 'grid' | 'list'>('auto');
  const [catalogContainerWidth, setCatalogContainerWidth] = useState<number>(1000);
  const catalogContainerRef = React.useRef<HTMLDivElement>(null);

  // Auto-detect container width to automatically switch to List view if cards get squished
  useEffect(() => {
    if (!catalogContainerRef.current) return;
    const updateWidth = () => {
      if (catalogContainerRef.current) {
        setCatalogContainerWidth(catalogContainerRef.current.clientWidth);
      }
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setCatalogContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(catalogContainerRef.current);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, []);

  const isAutoList = catalogViewMode === 'auto' && catalogContainerWidth < 460;
  const effectiveCatalogView = catalogViewMode === 'list' || isAutoList ? 'list' : 'grid';

  // Strict Mode Lock Screen State
  const [lockScreenStep, setLockScreenStep] = useState<1 | 2>(1);
  const [clockInShift, setClockInShift] = useState('Pagi');
  const [clockInCatatan, setClockInCatatan] = useState('');
  const [clockInSubmitting, setClockInSubmitting] = useState(false);

  // Shift & Kas State (Initialized with persistent active shift cache to eliminate refresh jump)
  const [cachedInitialShift] = useState<ShiftKasir | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('pos_active_shift_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.idShift && (parsed.status === 'Buka' || parsed.status === 'Aktif')) return parsed;
      }
    } catch {}
    return null;
  });
  const [shiftAktif, setShiftAktifState] = useState<ShiftKasir | null>(cachedInitialShift);
  const [shiftLoading, setShiftLoading] = useState(!cachedInitialShift);

  const setShiftAktif = useCallback((data: ShiftKasir | null) => {
    setShiftAktifState(data);
    if (typeof window !== 'undefined') {
      try {
        if (data && data.idShift && (data.status === 'Buka' || data.status === 'Aktif')) {
          localStorage.setItem('pos_active_shift_cache', JSON.stringify(data));
        } else {
          localStorage.removeItem('pos_active_shift_cache');
        }
      } catch {}
    }
  }, []);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [closeShiftMode, setCloseShiftMode] = useState<'SERAH_TERIMA' | 'TUTUP_HARIAN'>('SERAH_TERIMA');
  const [replacementEmployeeId, setReplacementEmployeeId] = useState('');
  const [handoverResult, setHandoverResult] = useState<{ eligible: boolean; message: string } | null>(null);

  const [kasAwalInput, setKasAwalInput] = useState('100000');
  const [saldoMerchantAwalInput, setSaldoMerchantAwalInput] = useState('0');
  const [kasAkhirFisik, setKasAkhirFisik] = useState('');
  const [saldoMerchantAkhirInput, setSaldoMerchantAkhirInput] = useState('');
  const [closeShiftCatatan, setCloseShiftCatatan] = useState('');
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
          const activeData = data.filter(item => item && item.aktif === 'Y');
          // Deduplicate items cleanly so POS screen never displays duplicate product cards
          const seen = new Set<string>();
          const dedupedList: LayananItem[] = [];
          for (const item of activeData) {
            const key = `${(item.id || item.nama || '').trim().toLowerCase()}_${(item.kategori || '').toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              dedupedList.push({
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
                inventoryDeductionQty: item.inventoryDeductionQty !== undefined ? parseDecimal(item.inventoryDeductionQty, 1) : 1,
                bahanBakuList: item.bahanBakuList,
              });
            }
          }
          setLayananList(dedupedList);
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
              memberStatus: isMem ? 'Member' : (totalTx >= 1 ? 'Pelanggan Lama' : 'Pelanggan Baru'),
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
          if (activeStaff[0]?.nama) {
            setNamaKasirInput((prev: string) => (shiftAktif?.namaKasir || cachedInitialShift?.namaKasir || prev || activeStaff[0].nama));
          }
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
        if (data && data.namaKasir) {
          setNamaKasirInput(data.namaKasir);
        }
      } else {
        setShiftAktif(null);
        runBackend<any[]>('getRekapKasShift').then(rekap => {
          if (Array.isArray(rekap) && rekap.length > 0) {
            const last = rekap[0];
            if (last && last.kasAkhirFisik !== undefined && Number(last.kasAkhirFisik) > 0) {
              setKasAwalInput(String(last.kasAkhirFisik));
            }
            if (last && last.saldoMerchantAkhir !== undefined && Number(last.saldoMerchantAkhir) > 0) {
              setSaldoMerchantAwalInput(String(last.saldoMerchantAkhir));
            }
            if (last && last.namaPengganti) {
              setNamaKasirInput(last.namaPengganti);
            }
          }
        }).catch(() => {});
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

  // Evaluasi Hak Klaim Reward Loyalty Card Dinamis
  const claimableRewardInfo = useMemo(() => {
    const custObj = customerList.find(c => 
      (customer.noHp && c.noHp === customer.noHp) || 
      (customer.nama && customer.nama !== 'Pelanggan Umum' && c.nama === customer.nama)
    );
    if (!custObj && !customer.noHp) return null;

    const targetCust = custObj || customer;
    const detection = detectWasherAndDryer(cartArray);
    const targetCard = detection.isEligible ? detection.cardType : '75';
    const prog = resolveCustomerProgram(targetCust, targetCard);
    const targetStamps = prog.totalStamps || 10;
    const currentStamps = targetCard === '45' 
      ? Number(targetCust.stamps45 || 0) 
      : Number(targetCust.stamps75 || 0);

    const washItem = cartArray.find(item => 
      (item.layanan || '').toLowerCase().includes('cuci') || 
      (item.layanan || '').toLowerCase().includes('washer') ||
      (item.layanan || '').toLowerCase().includes('kiloan')
    );
    const washPrice = washItem ? Number(washItem.hargaSatuan) || 0 : 0;

    // Mode 1: FREE_ON_NTH (Free langsung di stempel ke-10)
    if (prog.claimRule === 'FREE_ON_NTH') {
      const willReach = (currentStamps + (detection.isEligible ? detection.stampsToAdd : 0)) >= targetStamps;
      if ((currentStamps >= targetStamps || willReach) && washPrice > 0) {
        return {
          cardType: targetCard,
          programName: prog.nama,
          claimRule: prog.claimRule,
          title: `Hadiah Cuci Gratis (${targetCard === '75' ? '7 KG' : '4 KG'})`,
          ruleText: `Member Lama: Stempel ke-${targetStamps} langsung gratis!`,
          nominal: washPrice,
          applied: diskonApplied.kode.startsWith('REWARD-FREE-CUCI')
        };
      }
    }

    // Mode 2: FREE_ON_NEXT_TRX (10 stamp penuh dulu, baru transaksi ke-11 free)
    if (prog.claimRule === 'FREE_ON_NEXT_TRX') {
      const isReady = currentStamps >= targetStamps || (targetCard === '45' ? targetCust.rewardReady4kg : targetCust.rewardReady7kg);
      if (isReady && washPrice > 0) {
        return {
          cardType: targetCard,
          programName: prog.nama,
          claimRule: prog.claimRule,
          title: `Hadiah Cuci Gratis Transaksi ke-11 (${targetCard === '75' ? '7 KG' : '4 KG'})`,
          ruleText: `10 Stempel penuh! Klaim reward cuci gratis hari ini.`,
          nominal: washPrice,
          applied: diskonApplied.kode.startsWith('REWARD-FREE-CUCI')
        };
      }
    }

    return null;
  }, [customerList, customer, cartArray, diskonApplied]);

  const handleClaimLoyaltyReward = () => {
    if (!claimableRewardInfo) return;
    setDiskonApplied({
      kode: `REWARD-FREE-CUCI-${claimableRewardInfo.cardType === '75' ? '7KG' : '4KG'}`,
      nilai: claimableRewardInfo.nominal
    });
    setClaimedLoyaltyCardType(claimableRewardInfo.cardType);
    setVoucherMsg({
      type: 'success',
      text: `Reward 1x Cuci Gratis diterapkan (-Rp ${claimableRewardInfo.nominal.toLocaleString('id-ID')})!`
    });
  };

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
          const deduction = (item.inventoryDeductionQty !== undefined ? parseDecimal(item.inventoryDeductionQty, 1) : 1) * item.qty;
          const sisaStok = inv.stok - deduction;
          if (sisaStok <= (inv.stokMinimum || 0)) {
            list.push({
              id: `stock-warn-${inv.id}`,
              tipe: 'PERINGATAN',
              judul: `Peringatan Stok: ${inv.nama}`,
              deskripsi: `Sisa stok saat ini ${formatDecimal(inv.stok)} ${inv.satuan}. Transaksi ini akan menyisakan ${formatDecimal(sisaStok)} ${inv.satuan} (mencapai batas minimum ${formatDecimal(inv.stokMinimum)} ${inv.satuan}).`,
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
              memberStatus: isMem ? 'Member' : (totalTx >= 1 ? 'Pelanggan Lama' : 'Pelanggan Baru'),
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
          const isMem = Boolean(found.isMember || found.memberStatus?.toLowerCase().includes('member'));
          return {
            ...prev,
            noHp: phoneVal,
            nama: prev.nama && prev.nama !== 'Pelanggan Umum' ? prev.nama : found.nama,
            alamat: found.alamat,
            tglLahir: found.tglLahir,
            isMember: isMem,
            memberStatus: isMem ? 'Member' : 'Pelanggan Lama',
            poin: Number(found.poin || 0),
            totalOrder: Number(found.totalOrder || 0),
          };
        } else {
          return {
            ...prev,
            noHp: phoneVal,
            isMember: false,
            memberStatus: 'Pelanggan Baru',
            poin: 0,
            totalOrder: 0,
          };
        }
      }
      return {
        ...prev,
        noHp: phoneVal,
        isMember: false,
        memberStatus: undefined,
        poin: 0
      };
    });
  };

  // Handle customer name input change with auto-check on exact match
  const handleCustomerNameInput = (nameVal: string) => {
    setCustomer(prev => {
      const q = nameVal.trim().toLowerCase();
      if (q && q !== 'pelanggan umum') {
        const found = customerList.find(c => (c.nama || '').trim().toLowerCase() === q);
        if (found) {
          const isMem = Boolean(found.isMember || found.memberStatus?.toLowerCase().includes('member'));
          return {
            ...prev,
            nama: nameVal,
            noHp: prev.noHp || found.noHp,
            alamat: found.alamat,
            tglLahir: found.tglLahir,
            isMember: isMem,
            memberStatus: isMem ? 'Member' : 'Pelanggan Lama',
            poin: Number(found.poin || 0),
            totalOrder: Number(found.totalOrder || 0),
          };
        }
      }
      return { ...prev, nama: nameVal };
    });
  };

  // Handle select customer from live suggestions
  const handleSelectCustomer = (c: CustomerState) => {
    const isMem = Boolean(c.isMember || c.memberStatus?.toLowerCase().includes('member'));
    setCustomer({
      ...c,
      nama: c.nama,
      noHp: c.noHp,
      alamat: c.alamat,
      tglLahir: c.tglLahir,
      isMember: isMem,
      memberStatus: isMem ? 'Member' : 'Pelanggan Lama',
      poin: Number(c.poin || 0),
      totalOrder: Number(c.totalOrder || 0)
    });
    setIsManualCustomer(false);
    setActiveSuggestionField(null);
  };

  // Live matching customers for Phone input (matches phone digits OR name)
  const phoneMatches = useMemo(() => {
    const raw = (customer.noHp || '').trim();
    const clean = raw.replace(/\D/g, '');
    if (!raw || (clean.length < 2 && raw.length < 2)) return [];
    return customerList.filter(c => {
      const cHpClean = (c.noHp || '').replace(/\D/g, '');
      const cNameLower = (c.nama || '').toLowerCase();
      return (clean && cHpClean.includes(clean)) || (raw.length >= 2 && cNameLower.includes(raw.toLowerCase()));
    }).slice(0, 6);
  }, [customer.noHp, customerList]);

  // Live matching customers for Name input (matches letter-by-letter OR phone digits)
  const nameMatches = useMemo(() => {
    const raw = (customer.nama || '').trim();
    if (!raw || raw.length < 1 || raw.toLowerCase() === 'pelanggan umum') return [];
    const clean = raw.replace(/\D/g, '');
    return customerList.filter(c => {
      const cNameLower = (c.nama || '').toLowerCase();
      const cHpClean = (c.noHp || '').replace(/\D/g, '');
      return cNameLower.includes(raw.toLowerCase()) || (clean && clean.length >= 2 && cHpClean.includes(clean));
    }).slice(0, 6);
  }, [customer.nama, customerList]);

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

      // DSS Stock Verification before adding / incrementing
      if (layanan.idInventory && inventoryList.length > 0) {
        const inv = inventoryList.find(i => i.id === layanan.idInventory);
        if (inv) {
          const existingQty = cart[layanan.layanan]?.qty || 0;
          const targetQty = existingQty + delta;
          const ratio = Number(layanan.inventoryDeductionQty) || 1;
          const totalNeeded = Math.round((targetQty * ratio) * 10000) / 10000;
          if (inv.stok < totalNeeded) {
            const kekurangan = Math.round((totalNeeded - inv.stok) * 10000) / 10000;
            const auditFisik = inv.stokFisikTerakhir;
            const hasReadyAdjustment = auditFisik !== undefined && auditFisik >= totalNeeded;
            setStockDecisionItems([{
              idInventory: inv.id,
              namaItem: inv.nama,
              layanan: layanan.layanan,
              stokSistem: inv.stok,
              satuan: inv.satuan,
              kebutuhan: totalNeeded,
              kekurangan: kekurangan,
              stokFisikTerakhir: auditFisik,
              tglOpnameTerakhir: inv.tglOpnameTerakhir,
              rekomendasi: hasReadyAdjustment
                ? `Perhatian: Terdapat kemungkinan selisih stok. Stok fisik terakhir tercatat ${auditFisik} ${inv.satuan}. Lakukan Stock Adjustment (+${Math.round((auditFisik - inv.stok) * 100) / 100}) terlebih dahulu, kemudian proses transaksi.`
                : `Silakan periksa stok fisik ${inv.nama} terlebih dahulu.\n• Jika stok fisik tersedia di toko → lakukan Stock Adjustment sebelum memproses transaksi.\n• Jika stok fisik memang tidak tersedia → lakukan Restock jika barang perlu dibeli.`,
              tipeRekomendasi: hasReadyAdjustment ? 'ADJUSTMENT_READY' : 'CHECK_OR_RESTOCK'
            }]);
            setShowStockDecisionModal(true);
            return;
          }
        }
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
    const isMemberCust = Boolean(customer.isMember);
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
    const custName = (customer.nama || '').trim() || 'Pelanggan Umum';
    const custHp = (customer.noHp || '').trim();
    const total = grandTotal;
    const bayar = Number(uangBayarInput) || total;

    if (!isManualCustomer) {
      if (!customer.nama.trim() || !customer.noHp.trim()) {
        await showAlert('Nama dan No. HP / WhatsApp pelanggan wajib diisi.\n\nJika pelanggan tidak ingin memberikan nomor HP / turis asing / data tidak lengkap, centang opsi "Input Manual / Data Pelanggan Tidak Lengkap".', 'warning');
        return;
      }
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
      // DSS Inventory Stock Verification (Negative Stock Disallowed)
      try {
        const stockCheck = await runBackend<StockValidationResult>('validateCartStock', cartArray.map(i => ({
          layanan: i.layanan,
          qty: i.qty,
          idInventory: i.idInventory,
          inventoryDeductionQty: i.inventoryDeductionQty
        })));

        if (stockCheck && !stockCheck.valid && stockCheck.insufficientItems.length > 0) {
          setStockDecisionItems(stockCheck.insufficientItems);
          setShowStockDecisionModal(true);
          setPaymentSubmitting(false);
          return;
        }
      } catch (stockErr) {
        console.warn('[handleConfirmPaymentSafe] Gagal validasi stok DSS:', stockErr);
      }

      const hasDropOff = cartArray.some((i) => i.tipe === 'FullService' || (i as any).kategori === 'Drop Off');
      const hasSelfService = cartArray.some((i) => i.tipe === 'SelfService' || (i as any).kategori === 'Self Service');
      const autoTipeLayanan = hasDropOff ? 'FullService' : (hasSelfService ? 'SelfService' : 'Retail');
      const estimasi = hasDropOff ? calculateEstimasiSelesai(tingkatLayanan) : '';
      let estimasiISO: string | null = null;
      if (hasDropOff) {
        const priority = dropOffPriorities.find(p => p.nama.toLowerCase() === tingkatLayanan.toLowerCase()) || { durasiJam: 48 };
        const durasi = Number(priority.durasiJam) || 48;
        estimasiISO = new Date(Date.now() + durasi * 3600 * 1000).toISOString();
      }

      const res = await runBackend<{ success: boolean; noNota: string; total: number; token?: string }>('simpanTransaksi', {
        idShift: shiftAktif?.idShift || undefined,
        namaPelanggan: custName,
        noHp: custHp,
        kasir,
        petugas: kasir,
        tipe: autoTipeLayanan,
        tipeLayanan: autoTipeLayanan,
        tingkatLayanan: hasDropOff ? tingkatLayanan : 'Reguler',
        estimasiSelesai: estimasiISO,
        estimasi: estimasi,
        metodeBayar,
        total,
        subtotal: subtotalCart,
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
      const currCust = custHp ? customerList.find(c => c.noHp === custHp) : (custName !== 'Pelanggan Umum' ? customerList.find(c => c.nama === custName) : null);
      const isActualMember = Boolean(customer.isMember || currCust?.isMember);
      const saldoPoinLama = Number(customer.poin || currCust?.poin || 0);
      const poinEarned = isActualMember ? Math.floor(resTotal / (poinRate || 10000)) : 0;
      const saldoPoinBaru = isActualMember ? (saldoPoinLama + poinEarned) : 0;

      // =========================================================================
      // LOYALTY STAMP / REWARD CLAIM PROCESSING
      // =========================================================================
      let stampInfo = null;

      if (claimedLoyaltyCardType && custHp) {
        // KASUS A: Transaksi ini adalah KLAIM REWARD CUCI GRATIS
        // Stempel kartu terkait di-reset kembali ke 0
        runBackend('updateStempelPelanggan', custHp, claimedLoyaltyCardType, 0).catch(err => {
          console.error('Failed to reset stamps after reward claim:', err);
        });
        setCustomerList(prev => prev.map(c => {
          if (c.noHp === custHp || (custName !== 'Pelanggan Umum' && c.nama === custName)) {
            return {
              ...c,
              [claimedLoyaltyCardType === '45' ? 'stamps45' : 'stamps75']: 0,
              [claimedLoyaltyCardType === '45' ? 'rewardReady4kg' : 'rewardReady7kg']: false
            };
          }
          return c;
        }));
        clearCache('getDaftarPelanggan');

        const prog = resolveCustomerProgram(currCust || customer, claimedLoyaltyCardType);
        stampInfo = {
          earned: false,
          isClaimed: true,
          cardType: claimedLoyaltyCardType,
          cardLabel: claimedLoyaltyCardType === '75' ? 'Kartu 7 KG' : 'Kartu 4 KG',
          programName: prog.nama,
          claimRule: prog.claimRule,
          stampsAdded: 0,
          oldStamps: prog.totalStamps || 10,
          newTotal: 0,
          isRewardReady: false,
          rewardMessage: `Reward 1x Cuci Gratis berhasil diklaim & kartu di-reset ke 0 stempel.`
        };
      } else {
        // KASUS B: Transaksi Biasa -> Auto-detection Stempel Washer + Dryer
        const stampDetection = detectWasherAndDryer(cartArray);
        if (stampDetection.isEligible) {
          const targetCardType = stampDetection.cardType; // '75' | '45'
          const currentProg = resolveCustomerProgram(currCust || customer, targetCardType);
          const targetMax = currentProg.totalStamps || 10;
          const oldStamps = targetCardType === '45'
            ? Number(currCust?.stamps45 ?? (customer as any)?.stamps45 ?? 0)
            : Number(currCust?.stamps75 ?? (customer as any)?.stamps75 ?? 0);
          const stampsAdded = stampDetection.stampsToAdd;
          const newTotal = Math.min(targetMax, oldStamps + stampsAdded);
          const isTargetReached = newTotal >= targetMax;

          stampInfo = {
            earned: true,
            cardType: targetCardType,
            cardLabel: targetCardType === '75' ? 'Kartu 7 KG (Sisi Depan)' : 'Kartu 4 KG (Sisi Belakang)',
            programName: currentProg.nama,
            claimRule: currentProg.claimRule,
            stampsAdded,
            oldStamps,
            newTotal,
            targetStamps: targetMax,
            isRewardReady: isTargetReached
          };

          // If phone number is present, sync with backend & update local customer list
          if (custHp) {
            runBackend('updateStempelPelanggan', custHp, targetCardType, newTotal).catch(err => {
              console.error('Failed to auto-update stamps:', err);
            });
            setCustomerList(prev => prev.map(c => {
              if (c.noHp === custHp || (custName !== 'Pelanggan Umum' && c.nama === custName)) {
                return {
                  ...c,
                  [targetCardType === '45' ? 'stamps45' : 'stamps75']: newTotal,
                  [targetCardType === '45' ? 'rewardReady4kg' : 'rewardReady7kg']: isTargetReached
                };
              }
              return c;
            }));
            clearCache('getDaftarPelanggan');
          }
        }
      }

      setCompletedOrderData({
        trxId: res.noNota,
        token: res.token || '',
        kasir,
        pelanggan: custName,
        noHp: custHp,
        isMember: isActualMember,
        metodeBayar,
        subtotal: subtotalCart,
        diskon: diskonApplied.nilai || 0,
        diskonKode: diskonApplied.kode || '',
        poinEarned,
        saldoPoinAwal: isActualMember ? saldoPoinLama : 0,
        saldoPoinAkhir: isActualMember ? saldoPoinBaru : 0,
        stampInfo,
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
      setToastMsg(`${type === 'label' ? 'Label Tag' : 'Struk Thermal'} berhasil dicetak!`);
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
    const selectedStaff = staffList.find(s => s.id === replacementEmployeeId || s.nama === replacementEmployeeId);
    setShiftSubmitting(true);
    try {
      const result = await runBackend<{ eligible: boolean; message: string }>('handoverCheckKasShift', {
        shiftId: shiftAktif.idShift,
        idOutlet: 'OUTLET-UTAMA',
        replacementEmployeeId,
        replacementName: selectedStaff?.nama || ''
      });
      setHandoverResult(result || { eligible: true, message: 'Staf pengganti siap serah terima.' });
    } catch (error) {
      console.error(error);
      setHandoverResult({ eligible: true, message: 'Staf pengganti berhasil dipilih.' });
    } finally {
      setShiftSubmitting(false);
    }
  };

  // Enhanced Close Shift with Expense & Auto-Compressed Photo Upload
  const handleExpensePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsCompressingPhotos(true);
    try {
      const newItems: ExpensePhotoItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          try {
            const compressed = await compressImageFile(file);
            newItems.push({
              id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name || `nota_${Date.now()}_${i + 1}.jpg`,
              base64: compressed.base64,
              preview: compressed.preview,
              sizeKb: compressed.sizeKb
            });
          } catch (err) {
            console.error('Gagal mengompresi foto nota:', err);
          }
        }
      }
      if (newItems.length > 0) {
        setExpensePhotos(prev => [...prev, ...newItems]);
      }
    } finally {
      setIsCompressingPhotos(false);
      e.target.value = ''; // Reset input
    }
  };

  const removeExpensePhoto = (index: number) => {
    setExpensePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotoToGoogleDrive = async (photo: ExpensePhotoItem, index: number, total: number): Promise<string | null> => {
    try {
      setShiftSubmitStatusText(`Mengunggah foto nota (${index + 1}/${total}) ke Drive...`);
      const fileName = `nota_${shiftAktif?.idShift || 'shift'}_${Date.now()}_${index + 1}.jpg`;

      const result = await runBackend<{ success: boolean; fileUrl?: string; message?: string }>(
        'uploadExpensePhoto',
        fileName,
        photo.base64,
        'image/jpeg',
        shiftAktif?.idShift || ''
      );

      if (result && result.fileUrl) {
        return result.fileUrl;
      }
      if (result && !result.success) {
        console.warn('Google Drive photo upload response:', result.message);
      }
      return null;
    } catch (error) {
      console.warn('Gagal upload foto ke Google Drive:', error);
      return null;
    }
  };

  const handleCloseShiftWithExpense = async () => {
    if (!shiftAktif) return;

    if (shiftAktif.pendingVoidCount && shiftAktif.pendingVoidCount > 0) {
      const confirmProceed = await showConfirm(
        `Terdapat ${shiftAktif.pendingVoidCount} transaksi void yang masih MENUNGGU PERSETUJUAN Manager (Total Rp ${(shiftAktif.pendingVoidTotal || 0).toLocaleString('id-ID')}).\n\nUang transaksi ini sementara masih tercatat di kas laci.\n\nTetap lanjutkan penutupan kas shift sekarang?`
      );
      if (!confirmProceed) return;
    }

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

    // Perhitungan Selisih Kas & Merchant
    const expectedKas = (shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalShiftExpense;
    const selisihKas = kasAkhir - expectedKas;
    const expectedMerchant = (shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0);
    const selisihMerchant = saldoMerchantAkhir - expectedMerchant;
    const hasSelisih = selisihKas !== 0 || selisihMerchant !== 0;

    // ATURAN: Jika ada selisih, tetap bisa diproses asalkan WAJIB mengisi catatan alasan selisih
    if (hasSelisih && !closeShiftCatatan.trim()) {
      await showAlert(
        `Terdapat SELISIH antara uang riil dan catatan sistem:\n` +
        (selisihKas !== 0 ? `• Selisih Kas Laci : ${selisihKas > 0 ? '+' : ''}Rp ${selisihKas.toLocaleString('id-ID')} (${selisihKas > 0 ? 'LEBIH' : 'KURANG'})\n` : '') +
        (selisihMerchant !== 0 ? `• Selisih Merchant : ${selisihMerchant > 0 ? '+' : ''}Rp ${selisihMerchant.toLocaleString('id-ID')} (${selisihMerchant > 0 ? 'LEBIH' : 'KURANG'})\n` : '') +
        `\nAnda WAJIB mengisi kolom Catatan/Keterangan alasan selisih sebelum melanjutkan ganti/tutup shift.`,
        'warning'
      );
      return;
    }

    // Jika ada selisih dan catatan sudah diisi, tampilkan konfirmasi ringkasan selisih
    if (hasSelisih) {
      const confirmProceedWithDiff = await showConfirm(
        `Konfirmasi Rekonsiliasi Kas dengan SELISIH:\n\n` +
        (selisihKas !== 0 ? `• Kas Laci: ${selisihKas > 0 ? '+' : ''}Rp ${selisihKas.toLocaleString('id-ID')} (${selisihKas > 0 ? 'LEBIH' : 'KURANG'})\n` : '') +
        (selisihMerchant !== 0 ? `• Merchant: ${selisihMerchant > 0 ? '+' : ''}Rp ${selisihMerchant.toLocaleString('id-ID')} (${selisihMerchant > 0 ? 'LEBIH' : 'KURANG'})\n` : '') +
        `• Catatan: "${closeShiftCatatan.trim()}"\n\n` +
        `Tetap lanjutkan proses ${closeShiftMode === 'SERAH_TERIMA' ? 'Serah Terima Shift' : 'Tutup Kas Shift'} sekarang?`
      );
      if (!confirmProceedWithDiff) return;
    }

    setShiftSubmitting(true);
    setShiftSubmitStatusText('Menyiapkan rekonsiliasi kas...');
    try {
      // 1. Upload photos to Google Drive in parallel
      const photoUrls: string[] = [];
      let failedUploadCount = 0;
      if (expensePhotos.length > 0) {
        setShiftSubmitStatusText(`Mengunggah ${expensePhotos.length} foto nota ke Drive...`);
        const uploadPromises = expensePhotos.map(async (photo, i) => {
          const url = await uploadPhotoToGoogleDrive(photo, i, expensePhotos.length);
          return url;
        });
        const uploadResults = await Promise.all(uploadPromises);
        uploadResults.forEach(url => {
          if (url) {
            photoUrls.push(url);
          } else {
            failedUploadCount++;
          }
        });
      }

      setShiftSubmitStatusText('Menyimpan data rekonsiliasi kas & belanja...');

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
        catatan: closeShiftCatatan.trim(),
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
      setCloseShiftCatatan('');
      setReplacementEmployeeId('');
      setHandoverResult(null);
      setExpenseItemList([{ nama: '', nominal: '' }]);
      setShiftExpenseCategory('');
      setExpensePhotos([]);
      
      let successMsg = `Kas shift berhasil ditutup! Selisih kas: Rp ${(result.selisihKas || 0).toLocaleString('id-ID')}.`;
      if (expensePhotos.length > 0) {
        if (photoUrls.length > 0) {
          successMsg += ` (${photoUrls.length} bukti foto nota tersimpan di Google Drive)`;
        } else if (failedUploadCount > 0) {
          successMsg += ` (Catatan: Foto nota gagal diunggah ke Google Drive karena kebijakan folder/koneksi).`;
        }
      }
      setToastMsg(successMsg);
      await showAlert(successMsg, 'success');
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : 'Kas shift gagal ditutup.';
      await showAlert(`Gagal menutup kas shift: ${errMsg}`, 'error');
    } finally {
      setShiftSubmitting(false);
      setShiftSubmitStatusText('');
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
    setCustomer({ nama: '', noHp: '' });
    setIsManualCustomer(false);
    setShowQuickAddMember(false);
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
                      <option value="Pagi">Shift 1 Pagi (07:00 - 15:00)</option>
                      <option value="Sore">Shift 2 Sore / Malam (15:00 - 23:00)</option>
                      <option value="Full Day">Shift Full Day (07:00 - 23:00)</option>
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
                type="button"
                onClick={() => onNavigateTab ? onNavigateTab('shift_saya') : setShowTutupShiftModal(true)}
                className="bg-[#B5C9C9]/20 border border-[#B5C9C9] text-[#1E4648] hover:bg-[#B5C9C9]/30 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Buka Menu Shift Saya & Kas Laci"
              >
                <Unlock className="w-4 h-4 text-[#1E4648]" />
                <span className="hidden sm:inline">Shift (Rp {(shiftAktif?.kasAwal || 0).toLocaleString('id-ID')})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab ? onNavigateTab('shift_saya') : setShowBukaShiftModal(true)}
                className="bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
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

          {/* View Mode Toggle: Auto, Grid, List */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 ml-auto shrink-0">
            <button
              onClick={() => setCatalogViewMode('auto')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer tactile-btn ${
                catalogViewMode === 'auto'
                  ? 'bg-[#1E4648] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Mode Otomatis: Beralih ke List jika layar sempit atau zoom besar, Grid jika layar lebar"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Auto{isAutoList ? ' (List)' : ''}</span>
            </button>
            <button
              onClick={() => setCatalogViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer tactile-btn ${
                catalogViewMode === 'grid'
                  ? 'bg-[#1E4648] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Tampilan Grid (Kotak)"
            >
              <div className="w-3.5 h-3.5 grid grid-cols-2 gap-0.5">
                <div className="bg-current rounded-xs" />
                <div className="bg-current rounded-xs" />
                <div className="bg-current rounded-xs" />
                <div className="bg-current rounded-xs" />
              </div>
            </button>
            <button
              onClick={() => setCatalogViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer tactile-btn ${
                catalogViewMode === 'list'
                  ? 'bg-[#1E4648] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Tampilan List (Daftar Baris)"
            >
              <div className="w-3.5 h-3.5 flex flex-col justify-between py-0.5">
                <div className="h-0.5 bg-current rounded-full" />
                <div className="h-0.5 bg-current rounded-full" />
                <div className="h-0.5 bg-current rounded-full" />
              </div>
            </button>
          </div>
        </div>

        {/* STEP 1: Product Cards Grid or List */}
        <div ref={catalogContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 md:pb-4">
          {effectiveCatalogView === 'grid' ? (
            // GRID VIEW
            <div 
              className="grid gap-2.5 sm:gap-3 auto-rows-auto"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))'
              }}
            >
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
                      className={`glass-card card-hover-lift rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 cursor-pointer select-none tactile-btn touch-pan-y ${
                        qtyInCart > 0
                          ? 'ring-2 ring-teal-700/60 border-teal-700 bg-teal-50/30 shadow-md'
                          : 'border-slate-200/90 shadow-xs hover:border-teal-600 hover:shadow-md'
                      }`}
                    >
                      <div>
                        {/* Top Category Badge & Satuan */}
                        <div className="flex items-center justify-between gap-1.5 w-full pb-1.5 min-w-0">
                          <span 
                            className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border shadow-2xs min-w-0 flex-1 ${badgeStyle}`}
                            title={categoryName}
                          >
                            <Icon className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{categoryName}</span>
                          </span>
                          {item.satuan && (
                            <span className="text-[10px] font-bold text-slate-400 shrink-0 whitespace-nowrap">
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
                            <p className="font-extrabold text-xs text-slate-900 leading-snug line-clamp-2">
                              {item.layanan}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        {/* Harga - Prominent */}
                        <div className="pt-1">
                          <div className="text-sm sm:text-base font-black text-teal-950 leading-tight font-mono">
                            Rp {(item.hargaSatuan || 0).toLocaleString('id-ID')}
                          </div>
                        </div>

                        {/* Qty Stepper - Bottom */}
                        <div className="flex items-center justify-between gap-1 pt-2" onClick={(e) => e.stopPropagation()}>
                          {qtyInCart > 0 ? (
                            <div className="flex items-center btn-glow-emerald rounded-xl overflow-hidden flex-1 h-7 shadow-xs">
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                                className="w-7 h-full flex items-center justify-center hover:bg-white/20 transition font-bold text-xs cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-black flex-1 text-center font-mono">{qtyInCart}</span>
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onPointerUp={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                                className="w-7 h-full flex items-center justify-center hover:bg-white/20 transition font-bold text-xs cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-full h-7 rounded-xl bg-slate-50/80 border border-slate-200 flex items-center justify-center hover:bg-teal-900 hover:text-white hover:border-teal-900 text-slate-600 transition shadow-2xs font-bold text-xs gap-1 cursor-pointer">
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
                          <div className="flex items-center gap-2 min-w-0">
                            <span 
                              className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-2xs shrink-0 max-w-[120px] truncate ${badgeStyle}`}
                              title={categoryName}
                            >
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
        <div 
          className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ zoom: inverseZoom }}
        >
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

      {/* STEP 2:       {/* STEP 2: RIGHT KERANJANG ORDER PANEL (Selalu Terbuka di Desktop/Tablet, Auto-Fit No-Scroll) */}
      <div className={`fixed inset-0 z-[300] bg-white flex flex-col w-full md:static md:w-[280px] lg:w-[310px] xl:w-[340px] md:z-auto border border-slate-200/90 rounded-2xl shrink-0 overflow-hidden shadow-xs transition-all duration-200 h-full max-h-full justify-between ${
        showMobileCart ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-0 md:opacity-100 hidden md:flex'
      }`}>
        {/* Header Order & Customer Button */}
        <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-[#1E4648]" />
            </div>
            <h2 className="text-sm font-black text-slate-800">Keranjang Order</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMobileCart(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              title="Tutup Keranjang"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Information Badge */}
        <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Pelanggan:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-black text-xs text-slate-800 truncate">{customer.nama || 'Pelanggan Umum'}</span>
              {customer.noHp && <span className="text-[11px] text-slate-500 font-mono font-bold">({customer.noHp})</span>}
              {customer.poin !== undefined && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.2 rounded-full">
                  ⭐ {customer.poin} Poin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cart Items List - Auto-Scrollable Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5 bg-slate-50/40">
          {cartArray.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-2">
                <ShoppingCart className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-xs font-bold text-slate-600">Keranjang Kosong</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Pilih produk di katalog sebelah kiri</div>
            </div>
          ) : (
            cartArray.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-2xs hover:shadow-xs transition group">
                <div className="flex-1 min-w-0 pr-1">
                  <div className="text-xs font-bold text-slate-800 leading-tight truncate">{item.layanan}</div>
                  <div className="text-[11px] text-slate-500 font-semibold font-mono mt-0.5">
                    Rp {(item.hargaSatuan || 0).toLocaleString('id-ID')} × {item.qty}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-black text-slate-900 font-mono">
                    Rp {((item.hargaSatuan || 0) * (item.qty || 1)).toLocaleString('id-ID')}
                  </span>
                  <button
                    onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, -item.qty)}
                    className="text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition opacity-80 group-hover:opacity-100"
                    title="Hapus Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Voucher & Promo Input Box & Claim Reward Bar */}
        <div className="px-3 py-2 bg-white border-t border-slate-100 shrink-0 space-y-2">
          
          {/* Banner Hadiah Cuci Gratis yang Siap Diklaim */}
          {claimableRewardInfo && !claimableRewardInfo.applied && (
            <div className="p-2.5 bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-orange-500/15 border border-amber-400/60 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <Gift className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                <div className="truncate">
                  <span className="font-black text-amber-950 text-xs block leading-tight truncate">
                    {claimableRewardInfo.title}
                  </span>
                  <span className="text-[10px] text-amber-800 block leading-tight">
                    {claimableRewardInfo.ruleText}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClaimLoyaltyReward}
                className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-lg shadow-xs cursor-pointer shrink-0 transition"
              >
                Klaim Gratis
              </button>
            </div>
          )}

          {diskonApplied.nilai > 0 ? (
            <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div className="truncate text-[11px]">
                  <span className="font-black text-emerald-900 uppercase font-mono">{diskonApplied.kode}</span>
                  <span className="text-emerald-700 ml-1 font-semibold">
                    (-Rp {diskonApplied.nilai.toLocaleString('id-ID')})
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setDiskonApplied({ kode: '', nilai: 0 });
                  setClaimedLoyaltyCardType(null);
                  setVoucherInput('');
                  setVoucherMsg(null);
                }}
                className="p-1 text-emerald-600 hover:text-rose-600 hover:bg-emerald-100 rounded-lg transition shrink-0"
                title="Hapus Voucher"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <div className="relative flex-1 min-w-0">
                <Tag className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  placeholder="Kode voucher / promo..."
                  className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white transition"
                />
              </div>
              <button
                onClick={handleApplyVoucher}
                className="bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-black px-3 py-1.5 rounded-xl transition shrink-0 shadow-2xs"
              >
                Pasang
              </button>
            </div>
          )}
          {voucherMsg && (
            <div className={`text-[10px] font-bold px-1 ${voucherMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-500'}`}>
              {voucherMsg.text}
            </div>
          )}
        </div>

        {/* Financial Summary & Process Payment Button */}
        <div className="p-3 sm:p-3.5 border-t border-slate-200 bg-white shrink-0 space-y-2.5">
          <div className="space-y-1 text-xs text-slate-500 font-semibold">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-700 font-mono">Rp {(subtotalCart || 0).toLocaleString('id-ID')}</span>
            </div>
            {diskonApplied.nilai > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Diskon ({diskonApplied.kode}):</span>
                <span className="font-bold font-mono">-Rp {(diskonApplied?.nilai || 0).toLocaleString('id-ID')}</span>
              </div>
            )}
            {customer.isMember && Math.floor((grandTotal || 0) / (poinRate || 10000)) > 0 && (
              <div className="flex justify-between text-amber-700">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Poin Member:
                </span>
                <span className="font-bold font-mono">+{Math.floor((grandTotal || 0) / (poinRate || 10000))} Poin</span>
              </div>
            )}
          </div>

          {/* TOTAL TAGIHAN DISPLAY (Card Info Display, BUKAN Tombol) */}
          <div className="bg-slate-50 border-2 border-slate-200/90 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Total Tagihan
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {cartArray.length} item cucian
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              Rp {(grandTotal || 0).toLocaleString('id-ID')}
            </span>
          </div>

          {/* ACTION BUTTONS: Trash + Primary PROSES BAYAR Button */}
          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={clearCart}
              disabled={cartArray.length === 0}
              className="p-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 hover:border-rose-200 rounded-xl transition disabled:opacity-30 border border-slate-200 shrink-0 cursor-pointer"
              title="Kosongkan keranjang"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              type="button"
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
                setMobileCheckoutTab('detail');
                setShowDetailTransaksiModal(true);
              }}
              disabled={cartArray.length === 0}
              className={`flex-1 py-3.5 px-4 rounded-xl font-black text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer ${
                cartArray.length === 0
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-700 to-[#1E4648] hover:from-emerald-500 hover:to-[#163536] text-white shadow-md shadow-emerald-900/20 active:scale-[0.98]'
              }`}
            >
              <CreditCard className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>Proses Bayar</span>
              <ArrowRight className="w-4 h-4 text-emerald-200 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* STEP 3: MODAL "Pilih Pelanggan" (Repeat Order & 4-Digit Lookup Flow) */}
      {showCustModal && (
        <div 
          className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          style={{ zoom: inverseZoom }}
        >
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
                          const isMem = Boolean(filtered[0].isMember || filtered[0].memberStatus?.toLowerCase().includes('member'));
                          setCustomer({
                            ...filtered[0],
                            isMember: isMem,
                            memberStatus: isMem ? 'Member' : 'Pelanggan Lama',
                            poin: Number(filtered[0].poin || 0),
                            totalOrder: Number(filtered[0].totalOrder || 0)
                          });
                          setIsManualCustomer(false);
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
                            const isMem = Boolean(c.isMember || c.memberStatus?.toLowerCase().includes('member'));
                            setCustomer({
                              ...c,
                              isMember: isMem,
                              memberStatus: isMem ? 'Member' : 'Pelanggan Lama',
                              poin: Number(c.poin || 0),
                              totalOrder: Number(c.totalOrder || 0)
                            });
                            setIsManualCustomer(false);
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

      {/* 4. MODAL "Detail Transaksi & Pembayaran" (Full Page Terminal: Kiri Detail Order & Customer, Kanan Kasir & Pembayaran) */}
      {showDetailTransaksiModal && (
        <div 
          className="fixed inset-0 z-[500] bg-slate-950/80 flex flex-col w-full h-[100dvh] max-h-[100dvh] overflow-hidden animate-fade-in backdrop-blur-xs"
          style={{ zoom: inverseZoom }}
        >
          <div className="relative bg-white w-full h-full max-h-[100dvh] flex flex-col lg:flex-row overflow-hidden">
            
            {/* MOBILE & TABLET PORTRAIT TOP BAR (< lg screens only) */}
            <div className="lg:hidden shrink-0 bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowDetailTransaksiModal(false)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition shrink-0 cursor-pointer"
                  title="Kembali ke Layar Kasir"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div className="text-[9.5px] text-teal-300 font-extrabold uppercase tracking-wider">TOTAL TAGIHAN</div>
                  <div className="text-sm font-black font-mono leading-tight truncate text-white">
                    Rp {(grandTotal || 0).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById('pos-section-bayar')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#1E4648] hover:bg-teal-700 text-teal-100 border border-teal-500/40 flex items-center gap-1 cursor-pointer transition shadow-xs"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Pilih Bayar ↓</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDetailTransaksiModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center transition shrink-0 cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* LEFT PANEL / MAIN SCROLLABLE CONTAINER */}
            <div className="flex-1 min-w-0 flex flex-col h-full max-h-full overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200 bg-white">
              {/* Header with Back Button (Visible on Desktop / lg+) */}
              <div className="hidden lg:flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDetailTransaksiModal(false)}
                    className="tactile-btn p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition shadow-2xs flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                    title="Kembali ke Layar Kasir"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Kembali</span>
                  </button>
                  <div className="w-10 h-10 rounded-2xl bg-[#1E4648] text-white flex items-center justify-center shadow-xs shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 leading-tight">Detail Transaksi & Pelanggan</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Lengkapi identitas pemesan & instruksi pengerjaan</p>
                  </div>
                </div>
              </div>

              {/* Form Content - Continuous, touch-friendly scroll container */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-5 text-sm font-semibold text-slate-700 overscroll-contain">
                {/* Unified Customer Data Form Section */}
                <div className="space-y-4">
                  {/* Section Title Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-100/80 text-[#1E4648] flex items-center justify-center shadow-2xs shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <label className="block font-black text-slate-800 text-sm sm:text-base leading-tight">Data Pelanggan</label>
                        <p className="text-[11px] text-slate-400 font-normal mt-0.5">Satu form untuk semua pelanggan · Deteksi otomatis Member & Pelanggan Lama</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCustModal(true)}
                      className="tactile-btn px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#1E4648] hover:text-[#163536] rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs border border-slate-200"
                      title="Cari / Pilih dari data pelanggan terdaftar"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Cari Pelanggan</span>
                    </button>
                  </div>

                  {/* Checkbox Card: Input Manual / Data Pelanggan Tidak Lengkap */}
                  <div className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all ${
                    isManualCustomer 
                      ? 'bg-amber-50/80 border-amber-300 shadow-2xs' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isManualCustomer}
                        onChange={(e) => setIsManualCustomer(e.target.checked)}
                        className="w-4.5 h-4.5 mt-0.5 rounded text-[#1E4648] border-slate-300 focus:ring-[#1E4648] cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-black text-xs sm:text-sm text-slate-800">
                            Input Manual / Data Pelanggan Tidak Lengkap
                          </span>
                          {isManualCustomer && (
                            <span className="text-[10px] font-black text-amber-900 bg-amber-200/90 px-2.5 py-0.5 rounded-full border border-amber-300">
                              Identitas Fleksibel
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                          Gunakan jika pelanggan tidak ingin memberikan nomor HP, turis asing/bule, atau data diri belum lengkap.
                        </p>
                      </div>
                    </label>
                    {isManualCustomer && (
                      <div className="mt-2.5 pt-2.5 border-t border-amber-200/90 text-xs text-amber-950 flex items-center gap-1.5 font-semibold">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>No. WhatsApp & data lainnya bersifat <strong>opsional</strong>. Transaksi tetap dapat diproses langsung tanpa validasi nomor HP.</span>
                      </div>
                    )}
                  </div>

                  {/* Guidance Banner (Normal Mode) */}
                  {!isManualCustomer && !customer.noHp && (
                    <div className="flex items-center gap-3 p-3.5 bg-gradient-to-r from-teal-50/90 via-emerald-50/80 to-teal-50/90 border border-teal-200 rounded-2xl text-xs sm:text-sm text-teal-950 shadow-2xs">
                      <div className="p-2 rounded-xl bg-[#1E4648] text-white shrink-0 shadow-2xs">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="leading-relaxed font-medium text-xs sm:text-sm">
                        <span className="font-black text-[#1E4648]">Petunjuk Kasir:</span> Masukkan <strong>No. WhatsApp / HP</strong> terlebih dahulu. Sistem otomatis mendeteksi status keanggotaan pelanggan (Member / Reguler).
                      </div>
                    </div>
                  )}

                  {/* Customer Identity Inputs with Live Letter-by-Letter Suggestions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Slot 1: No. WhatsApp / HP */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block font-black text-slate-800 text-sm">
                          No. WhatsApp / HP {isManualCustomer ? <span className="text-xs text-slate-400 font-normal">(Opsional)</span> : '*'}
                        </label>
                        {(() => {
                          const digits = (customer.noHp || '').replace(/\D/g, '');
                          if (digits.length === 0) {
                            return (
                              <span className="text-xs text-slate-400 font-normal">
                                {isManualCustomer ? 'Boleh dikosongkan' : 'Wajib diisi'}
                              </span>
                            );
                          }
                          if (digits.length < 8) {
                            return <span className="text-xs text-amber-600 font-bold">Min. 8 digit</span>;
                          }
                          if (customer.isMember) {
                            return (
                              <span className="text-xs text-amber-900 bg-amber-100 font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Member
                              </span>
                            );
                          }
                          if (customer.memberStatus === 'Pelanggan Lama') {
                            return (
                              <span className="text-xs text-teal-900 bg-teal-100 font-black px-2 py-0.5 rounded-full border border-teal-300 flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-teal-700" /> Pelanggan Lama
                              </span>
                            );
                          }
                          return (
                            <span className="text-xs text-sky-900 bg-sky-100 font-black px-2 py-0.5 rounded-full border border-sky-300 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-sky-600" /> Pelanggan Baru
                            </span>
                          );
                        })()}
                      </div>
                      <div className="relative">
                        <input
                          type="tel"
                          value={customer.noHp}
                          onFocus={() => setActiveSuggestionField('noHp')}
                          onBlur={() => setTimeout(() => setActiveSuggestionField(null), 250)}
                          onChange={(e) => {
                            handleCustomerPhoneInput(e.target.value);
                            setActiveSuggestionField('noHp');
                          }}
                          placeholder={isManualCustomer ? "Ketik No. HP / Nama (Opsional)" : "Ketik No. HP / Cari Nama..."}
                          className="w-full pl-4 pr-10 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-base text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white transition shadow-2xs"
                        />
                        {customer.noHp && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomer(prev => ({ ...prev, noHp: '', isMember: false, memberStatus: undefined, poin: 0 }));
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/70 transition cursor-pointer"
                            title="Hapus nomor HP"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Live Suggestions Dropdown for Phone Field */}
                      {activeSuggestionField === 'noHp' && phoneMatches.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border-2 border-teal-600 rounded-2xl shadow-2xl overflow-hidden animate-fade-in divide-y divide-slate-100 max-h-64 overflow-y-auto">
                          <div className="px-3.5 py-2 bg-teal-50/90 text-[11px] font-black text-[#1E4648] flex items-center justify-between sticky top-0 backdrop-blur-xs">
                            <span className="flex items-center gap-1.5">
                              <Search className="w-3.5 h-3.5" /> Ditemukan {phoneMatches.length} pelanggan:
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Klik untuk memilih</span>
                          </div>
                          {phoneMatches.map((c, idx) => {
                            const isMem = Boolean(c.isMember || c.memberStatus?.toLowerCase().includes('member'));
                            return (
                              <div
                                key={idx}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectCustomer(c);
                                }}
                                className="p-3 hover:bg-teal-50/80 cursor-pointer transition flex items-center justify-between gap-3 text-left group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                                    isMem ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-teal-100 text-[#1E4648]'
                                  }`}>
                                    {isMem ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <User className="w-4 h-4 text-[#1E4648]" />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                                      <span className="group-hover:text-[#1E4648] transition-colors">{c.nama}</span>
                                      {isMem && (
                                        <span className="text-[9.5px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.2 rounded border border-amber-300">
                                          Member
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono font-semibold truncate">
                                      {c.noHp} {c.alamat ? `· ${c.alamat}` : ''}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  {isMem ? (
                                    <span className="text-[11px] font-mono font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                      {c.poin || 0} Poin
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                      {c.totalOrder || 1}x Order
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Slot 2: Nama Pelanggan */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block font-black text-slate-800 text-sm">
                          Nama Pelanggan {isManualCustomer ? <span className="text-xs text-slate-400 font-normal">(Opsional)</span> : '*'}
                        </label>
                        {customer.nama && customer.nama !== 'Pelanggan Umum' && (
                          <span className="text-xs text-slate-400 font-normal">Nama pemesan</span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={customer.nama}
                          onFocus={() => setActiveSuggestionField('nama')}
                          onBlur={() => setTimeout(() => setActiveSuggestionField(null), 250)}
                          onChange={(e) => {
                            handleCustomerNameInput(e.target.value);
                            setActiveSuggestionField('nama');
                          }}
                          placeholder={isManualCustomer ? "Nama pemesan (default: Pelanggan Umum)" : "Ketik nama pelanggan..."}
                          className="w-full pl-4 pr-10 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-base text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white transition shadow-2xs"
                        />
                        {customer.nama && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomer(prev => ({ ...prev, nama: '' }));
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/70 transition cursor-pointer"
                            title="Hapus nama"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Live Suggestions Dropdown for Name Field */}
                      {activeSuggestionField === 'nama' && nameMatches.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border-2 border-teal-600 rounded-2xl shadow-2xl overflow-hidden animate-fade-in divide-y divide-slate-100 max-h-64 overflow-y-auto">
                          <div className="px-3.5 py-2 bg-teal-50/90 text-[11px] font-black text-[#1E4648] flex items-center justify-between sticky top-0 backdrop-blur-xs">
                            <span className="flex items-center gap-1.5">
                              <Search className="w-3.5 h-3.5" /> Ditemukan {nameMatches.length} nama pelanggan:
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Klik untuk memilih</span>
                          </div>
                          {nameMatches.map((c, idx) => {
                            const isMem = Boolean(c.isMember || c.memberStatus?.toLowerCase().includes('member'));
                            return (
                              <div
                                key={idx}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectCustomer(c);
                                }}
                                className="p-3 hover:bg-teal-50/80 cursor-pointer transition flex items-center justify-between gap-3 text-left group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                                    isMem ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-teal-100 text-[#1E4648]'
                                  }`}>
                                    {isMem ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <User className="w-4 h-4 text-[#1E4648]" />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                                      <span className="group-hover:text-[#1E4648] transition-colors">{c.nama}</span>
                                      {isMem && (
                                        <span className="text-[9.5px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.2 rounded border border-amber-300">
                                          Member
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono font-semibold truncate">
                                      {c.noHp} {c.alamat ? `· ${c.alamat}` : ''}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  {isMem ? (
                                    <span className="text-[11px] font-mono font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                      {c.poin || 0} Poin
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                                      {c.totalOrder || 1}x Order
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Auto-check Customer Detection Banner / Loyalty Cards */}
                  {(() => {
                    const cleanHp = (customer.noHp || '').replace(/[^0-9]/g, '');
                    if (cleanHp.length < 8 && !customer.isMember) return null;

                    if (customer.isMember) {
                      return (
                        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/10 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between shadow-2xs flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-[#FF9500] text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                              <Star className="w-5 h-5 fill-white text-white" />
                            </div>
                            <div>
                              <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                                <span>⭐ Member Terdaftar: {customer.nama || 'Member'}</span>
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                Saldo: <span className="font-black text-slate-900 font-mono text-sm">{customer.poin || 0} Poin</span> · {customer.totalOrder || 0}x Order
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-extrabold text-amber-800 uppercase block tracking-wider">Dapat dari Order Ini</span>
                            <span className="text-sm font-black text-emerald-700 font-mono bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-300 inline-block mt-0.5">
                              +{Math.floor((grandTotal || 0) / (poinRate || 10000))} Poin
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (customer.memberStatus === 'Pelanggan Lama') {
                      return (
                        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex items-center justify-between text-sm flex-wrap gap-2 shadow-xs">
                          <div className="flex items-center gap-3 text-slate-700">
                            <div className="w-9 h-9 rounded-xl bg-teal-100 text-[#1E4648] flex items-center justify-center font-bold text-base shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                                <span>Pelanggan Lama: {customer.nama || 'Pelanggan'}</span>
                                <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full">Pelanggan Biasa</span>
                              </div>
                              <div className="text-xs text-slate-500 font-medium mt-0.5">
                                Pernah order {customer.totalOrder || 1}x sebelumnya · Belum terdaftar member
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowQuickAddMember(!showQuickAddMember);
                              if (!showQuickAddMember) {
                                setNewMemberForm({
                                  nama: customer.nama && customer.nama !== 'Pelanggan Umum' ? customer.nama : '',
                                  noHp: customer.noHp,
                                  alamat: customer.alamat || '',
                                  tglLahir: customer.tglLahir || ''
                                });
                              }
                            }}
                            className={`px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                              showQuickAddMember
                                ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                            }`}
                          >
                            {showQuickAddMember ? (
                              <>
                                <X className="w-4 h-4" />
                                <span>Tutup Form</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 text-white" />
                                <span>+ Daftarkan Member</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    }

                    // Pelanggan Baru
                    return (
                      <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex items-center justify-between text-sm flex-wrap gap-2 shadow-xs">
                        <div className="flex items-center gap-3 text-slate-600">
                          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-base shrink-0">
                            <Sparkles className="w-4 h-4 text-sky-600" />
                          </div>
                          <div>
                            <div className="font-black text-slate-800 text-sm sm:text-base">Pelanggan Baru</div>
                            <div className="text-xs text-slate-500 mt-0.5">Nomor ini belum pernah order sebelumnya.</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickAddMember(!showQuickAddMember);
                            if (!showQuickAddMember) {
                              setNewMemberForm({
                                nama: customer.nama && customer.nama !== 'Pelanggan Umum' ? customer.nama : '',
                                noHp: customer.noHp,
                                alamat: '',
                                tglLahir: ''
                              });
                            }
                          }}
                          className={`px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition shadow-xs flex items-center gap-1.5 cursor-pointer ${
                            showQuickAddMember
                              ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                          }`}
                        >
                          {showQuickAddMember ? (
                            <>
                              <X className="w-4 h-4" />
                              <span>Tutup Form</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-white" />
                              <span>+ Daftarkan Jadi Member</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Inline Quick Member Registration Form */}
                  {showQuickAddMember && (
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-amber-300 space-y-3.5 shadow-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                        <div className="text-sm font-black text-amber-950 flex items-center gap-2">
                          <Sparkles className="w-4.5 h-4.5 text-amber-600" />
                          <span>Daftarkan Sebagai Member Resmi (Dapatkan Poin Loyalitas)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddMember(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Member *</label>
                          <input
                            type="text"
                            placeholder="Nama Lengkap Member"
                            value={newMemberForm.nama}
                            onChange={(e) => setNewMemberForm({ ...newMemberForm, nama: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp / HP *</label>
                          <input
                            type="tel"
                            placeholder="No. WhatsApp / HP"
                            value={newMemberForm.noHp}
                            onChange={(e) => setNewMemberForm({ ...newMemberForm, noHp: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Lahir (TTL) *</label>
                          <input
                            type="date"
                            required
                            value={newMemberForm.tglLahir}
                            onChange={(e) => setNewMemberForm({ ...newMemberForm, tglLahir: e.target.value })}
                            className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white"
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
                          className="flex-1 py-3 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{savingMember ? 'Mendaftarkan...' : 'Simpan & Aktifkan Member'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddMember(false)}
                          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Staff Kasir & Service Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-black text-slate-800 mb-2 text-sm">Staf Kasir / Pemroses *</label>
                    <select
                      value={namaKasirInput}
                      onChange={(e) => setNamaKasirInput(e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-sm text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white transition shadow-2xs"
                    >
                      {staffList.map((s) => (
                        <option key={s.id || s.nama} value={s.nama}>
                          {s.nama} {s.jabatan ? `(${s.jabatan})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-black text-slate-800 mb-2 text-sm">Komposisi Transaksi (Terdeteksi Otomatis)</label>
                    <div className="flex flex-wrap items-center gap-2 py-0.5">
                      {cartArray.some((i) => i.tipe === 'FullService') && (
                        <span className="px-3.5 py-2.5 rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 text-amber-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs">
                          <Package className="w-4 h-4 text-amber-700" />
                          <span>Drop Off</span>
                        </span>
                      )}
                      {cartArray.some((i) => i.tipe === 'SelfService') && (
                        <span className="px-3.5 py-2.5 rounded-2xl bg-sky-500/15 border-2 border-sky-500/30 text-sky-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs">
                          <Coins className="w-4 h-4 text-sky-700" />
                          <span>Self Service</span>
                        </span>
                      )}
                      {cartArray.some((i) => !i.tipe || (i.tipe !== 'FullService' && i.tipe !== 'SelfService')) && (
                        <span className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 text-emerald-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs">
                          <ShoppingBag className="w-4 h-4 text-emerald-700" />
                          <span>Retail / FnB</span>
                        </span>
                      )}
                      {cartArray.length === 0 && (
                        <span className="px-3.5 py-2 rounded-2xl bg-slate-100 text-slate-500 font-bold text-xs">
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
                    <div className="bg-amber-50/80 border-2 border-amber-300 p-4 sm:p-5 rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <label className="block font-black text-amber-950 text-sm">
                          Prioritas Pengerjaan Cucian Drop Off:
                        </label>
                        <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                          {finalPriorities.length === 1 ? 'Sesuai Layanan Terpilih' : 'Otomatis Masuk Antrean SOP'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {finalPriorities.map((pri) => (
                          <button
                            key={pri.nama}
                            type="button"
                            onClick={() => setTingkatLayanan(pri.nama)}
                            className={`py-2.5 px-4 rounded-xl font-black text-sm border-2 transition flex items-center gap-2 cursor-pointer ${
                              tingkatLayanan.toLowerCase() === pri.nama.toLowerCase()
                                ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                                : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/60'
                            }`}
                          >
                            <span>{pri.nama}</span>
                            {pri.durasiJam ? (
                              <span className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                                tingkatLayanan.toLowerCase() === pri.nama.toLowerCase() ? 'bg-teal-900/40 text-teal-200' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {pri.durasiJam} Jam
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>

                      {/* Estimasi Maksimal Selesai */}
                      <div className="pt-2.5 border-t border-amber-200 flex items-center justify-between flex-wrap gap-2 text-sm">
                        <span className="text-amber-950 font-bold flex items-center gap-1.5 text-xs sm:text-sm">
                          <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Estimasi Maksimal Selesai:</span>
                        </span>
                        <span className="font-mono font-black text-[#1E4648] bg-white px-3 py-1 rounded-xl border-2 border-amber-300 shadow-2xs text-xs sm:text-sm">
                          {calculateEstimasi(tingkatLayanan)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Catatan Tambahan */}
                <div>
                  <label className="block font-black text-slate-800 mb-2 text-sm">Catatan Khusus Pesanan</label>
                  <textarea
                    rows={2}
                    value={catatanOrderInput}
                    onChange={(e) => setCatatanOrderInput(e.target.value)}
                    placeholder="Contoh: Pisahkan pakaian putih, jemput besok sore..."
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl font-medium text-sm text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white transition shadow-2xs min-h-[85px]"
                  />
                </div>

                {/* Line Items & Financial Breakdown Summary Box */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <span>Item Pesanan ({cartArray.length})</span>
                    <span>Subtotal</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                    {cartArray.map((i, idx) => (
                      <div key={idx} className="flex justify-between text-sm text-slate-800">
                        <span className="font-bold truncate pr-2">
                          {i.layanan} <span className="text-slate-400 font-mono">×{i.qty}</span>
                        </span>
                        <span className="font-black font-mono shrink-0">
                          Rp {(i.qty * (i.hargaSatuan || 0)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="pt-2.5 border-t border-slate-200 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-600 font-bold">
                      <span>Subtotal Item:</span>
                      <span className="font-mono font-black text-slate-800">Rp {(subtotalCart || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {diskonApplied.nilai > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <span className="flex items-center gap-1.5">
                          <Tag className="w-4 h-4" /> Diskon ({diskonApplied.kode}):
                        </span>
                        <span className="font-mono font-black">-Rp {diskonApplied.nilai.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {customer.isMember && Math.floor((grandTotal || 0) / (poinRate || 10000)) > 0 && (
                      <div className="flex justify-between text-amber-800 font-bold pt-0.5">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-500" /> Perolehan Poin (Member):
                        </span>
                        <span className="font-mono font-black">+{Math.floor((grandTotal || 0) / (poinRate || 10000))} Poin</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* MOBILE / TABLET PORTRAIT ONLY: SECTION 3 PEMBAYARAN (< lg) */}
                <div id="pos-section-bayar" className="lg:hidden pt-3 space-y-4 border-t-2 border-slate-200">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-base">
                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-[#1E4648] flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <span>Metode Pembayaran</span>
                  </div>

                  {/* Payment Method Selector Grid */}
                  <div className="grid grid-cols-4 gap-2">
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
                          className={`py-2.5 px-2 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#1E4648] hover:bg-white'
                          }`}
                        >
                          <MethodIcon className="w-4 h-4" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tunai / Non-Tunai Calculator Card on Mobile */}
                  <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 shadow-xs">
                    {metodeBayar === 'Tunai' ? (
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-700 text-xs">Uang Tunai Diterima:</span>
                            {uangBayarInput && uangBayarInput !== '0' && (
                              <button
                                type="button"
                                onClick={() => setUangBayarInput('0')}
                                className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                              >
                                Reset (C)
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            readOnly
                            value={uangBayarInput ? `Rp ${Number(uangBayarInput).toLocaleString('id-ID')}` : 'Rp 0'}
                            className="w-full px-4 py-2.5 bg-white border-2 border-slate-300 rounded-xl font-black text-2xl text-[#1E4648] text-right font-mono shadow-2xs"
                          />
                        </div>

                        {/* Shortcuts */}
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => setUangBayarInput((grandTotal || 0).toString())}
                            className="py-2 bg-white border border-slate-200 hover:bg-teal-50 hover:border-[#1E4648] text-[#1E4648] font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                          >
                            Uang Pas
                          </button>
                          <button
                            type="button"
                            onClick={() => setUangBayarInput('20000')}
                            className="py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                          >
                            20K
                          </button>
                          <button
                            type="button"
                            onClick={() => setUangBayarInput('50000')}
                            className="py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                          >
                            50K
                          </button>
                          <button
                            type="button"
                            onClick={() => setUangBayarInput('100000')}
                            className="py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition shadow-2xs cursor-pointer"
                          >
                            100K
                          </button>
                        </div>

                        {/* Numpad */}
                        <div className="grid grid-cols-3 gap-2">
                          {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() =>
                                setUangBayarInput((prev) => (prev === '0' || !prev ? num.toString() : prev + num))
                              }
                              className="py-2.5 sm:py-3 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xl shadow-2xs active:scale-95 transition font-mono cursor-pointer"
                            >
                              {num}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '0'))}
                            className="py-2.5 sm:py-3 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-xl shadow-2xs active:scale-95 transition font-mono cursor-pointer"
                          >
                            0
                          </button>
                          <button
                            type="button"
                            onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '00'))}
                            className="py-2.5 sm:py-3 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-lg shadow-2xs active:scale-95 transition font-mono cursor-pointer"
                          >
                            00
                          </button>
                          <button
                            type="button"
                            onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '000'))}
                            className="py-2.5 sm:py-3 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-base shadow-2xs active:scale-95 transition font-mono cursor-pointer"
                          >
                            000
                          </button>
                          <button
                            type="button"
                            onClick={() => setUangBayarInput('0')}
                            className="py-2.5 bg-rose-50 border-2 border-rose-200 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-sm shadow-2xs active:scale-95 transition cursor-pointer"
                          >
                            C
                          </button>
                          <button
                            type="button"
                            onClick={() => setUangBayarInput((prev) => prev.slice(0, -1) || '0')}
                            className="col-span-2 py-2.5 bg-slate-100 border-2 border-slate-200 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs shadow-2xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Delete className="w-4 h-4" />
                            <span>Hapus</span>
                          </button>
                        </div>

                        {/* Kembalian / Kurang */}
                        {Number(uangBayarInput) >= grandTotal && Number(uangBayarInput) > 0 ? (
                          <div className="bg-emerald-50 border border-emerald-300 rounded-xl py-2 px-3 flex items-center justify-between shadow-2xs">
                            <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">KEMBALIAN:</span>
                            <span className="text-lg font-black text-emerald-700 font-mono">
                              Rp {(Number(uangBayarInput) - grandTotal).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ) : Number(uangBayarInput) > 0 ? (
                          <div className="bg-rose-50 border border-rose-300 rounded-xl py-2 px-3 flex items-center justify-between shadow-2xs">
                            <span className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">KURANG:</span>
                            <span className="text-lg font-black text-rose-700 font-mono">
                              Rp {(grandTotal - Number(uangBayarInput)).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ) : (
                          <div className="py-1 text-center text-xs text-slate-400 font-medium">
                            Pilih shortcut atau tekan tombol angka untuk bayar tunai
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2.5 p-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-[#1E4648] flex items-center justify-center shadow-2xs">
                          {metodeBayar === 'QRIS' ? (
                            <QrCode className="w-6 h-6" />
                          ) : (
                            <CreditCard className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800">Pembayaran {metodeBayar}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Nominal Tagihan: <span className="font-black text-[#1E4648] font-mono text-sm">Rp {grandTotal.toLocaleString('id-ID')}</span>
                          </p>
                        </div>
                        <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl p-2.5 max-w-xs shadow-2xs leading-relaxed">
                          Pastikan dana telah masuk atau struk EDC berhasil keluar sebelum konfirmasi pembayaran.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MOBILE / TABLET PORTRAIT STICKY BOTTOM CONFIRM BAR */}
              <div className="lg:hidden shrink-0 sticky bottom-0 z-30 bg-white border-t-2 border-slate-200 p-3 sm:p-4 shadow-[0_-6px_24px_rgba(0,0,0,0.12)] flex items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="min-w-0 pr-1 shrink-0">
                  <div className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest leading-none">TOTAL TAGIHAN</div>
                  <div className="text-lg sm:text-xl font-black text-[#1E4648] font-mono leading-tight mt-0.5">
                    Rp {(grandTotal || 0).toLocaleString('id-ID')}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                    <span>Metode:</span>
                    <span className="px-1.5 py-0.2 bg-teal-50 text-teal-800 rounded font-black border border-teal-200">{metodeBayar}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmPaymentSafe}
                  disabled={
                    paymentSubmitting ||
                    (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal)
                  }
                  className={`flex-1 font-black py-3.5 px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-[0.98] ${
                    paymentSubmitting ||
                    (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-700 to-[#1E4648] hover:from-emerald-500 hover:to-[#163536] text-white shadow-emerald-900/20'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="tracking-wide">
                    {paymentSubmitting 
                      ? 'Memproses...' 
                      : (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal
                          ? `Kurang Rp ${(grandTotal - Number(uangBayarInput)).toLocaleString('id-ID')}`
                          : 'Konfirmasi & Selesaikan Bayar'
                        )
                    }
                  </span>
                </button>
              </div>
            </div>

            {/* RIGHT PANEL (DESKTOP & TABLET LANDSCAPE ONLY, >= lg) */}
            <div className="hidden lg:flex w-[390px] lg:w-[420px] xl:w-[450px] flex-col bg-slate-50 shrink-0 border-l border-slate-200 h-full max-h-full overflow-hidden justify-between">
              {/* Total Banner with Close Button */}
              <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white py-3.5 sm:py-4 px-4 sm:px-5 shrink-0 shadow-md relative flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-[9.5px] text-teal-200 font-extrabold uppercase tracking-widest block">
                    TOTAL PEMBAYARAN
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono drop-shadow-sm leading-tight block mt-0.5">
                    Rp {(grandTotal || 0).toLocaleString('id-ID')}
                  </span>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium flex-wrap">
                    {diskonApplied.nilai > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-semibold">
                        Diskon -Rp {diskonApplied.nilai.toLocaleString('id-ID')}
                      </span>
                    )}
                    {customer.isMember && Math.floor((grandTotal || 0) / (poinRate || 10000)) > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        +{Math.floor((grandTotal || 0) / (poinRate || 10000))} Poin
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => setShowDetailTransaksiModal(false)} 
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center transition-all shadow-md backdrop-blur-xs cursor-pointer active:scale-95 border border-white/20 shrink-0 ml-2"
                  title="Tutup & Kembali ke Kasir (Esc)"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
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
                        className={`py-1.5 px-1 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
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

              {/* Scrollable Center Area: Numpad / Non-Tunai Display */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 overscroll-contain flex flex-col justify-start">
                {metodeBayar === 'Tunai' ? (
                  <div className="space-y-2">
                    {/* Display Input & Quick Reset */}
                    <div>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-bold text-slate-600 text-[11px]">Uang Diterima:</span>
                        {uangBayarInput && uangBayarInput !== '0' && (
                          <button
                            type="button"
                            onClick={() => setUangBayarInput('0')}
                            className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
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
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setUangBayarInput((grandTotal || 0).toString())}
                        className="py-1 bg-white border border-slate-200 hover:bg-teal-50 hover:border-[#1E4648] text-[#1E4648] font-bold rounded-lg text-[11px] transition shadow-2xs cursor-pointer"
                      >
                        Uang Pas
                      </button>
                      <button
                        type="button"
                        onClick={() => setUangBayarInput('20000')}
                        className="py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] transition shadow-2xs cursor-pointer"
                      >
                        20K
                      </button>
                      <button
                        type="button"
                        onClick={() => setUangBayarInput('50000')}
                        className="py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] transition shadow-2xs cursor-pointer"
                      >
                        50K
                      </button>
                      <button
                        type="button"
                        onClick={() => setUangBayarInput('100000')}
                        className="py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px] transition shadow-2xs cursor-pointer"
                      >
                        100K
                      </button>
                    </div>

                    {/* Numpad Grid - Compact & Complete with 0, 00, 000 */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() =>
                            setUangBayarInput((prev) => (prev === '0' || !prev ? num.toString() : prev + num))
                          }
                          className="py-1.5 sm:py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-lg shadow-2xs active:scale-95 transition font-mono cursor-pointer"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '0'))}
                        className="py-1.5 sm:py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-lg shadow-2xs active:scale-95 transition font-mono cursor-pointer"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '00'))}
                        className="py-1.5 sm:py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-base shadow-2xs active:scale-95 transition font-mono cursor-pointer"
                      >
                        00
                      </button>
                      <button
                        type="button"
                        onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '000'))}
                        className="py-1.5 sm:py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-base shadow-2xs active:scale-95 transition font-mono cursor-pointer"
                      >
                        000
                      </button>
                      <button
                        type="button"
                        onClick={() => setUangBayarInput('0')}
                        className="py-1.5 sm:py-2 bg-rose-50 border-2 border-rose-200 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-sm shadow-2xs active:scale-95 transition cursor-pointer"
                      >
                        C
                      </button>
                      <button
                        type="button"
                        onClick={() => setUangBayarInput((prev) => prev.slice(0, -1) || '0')}
                        className="col-span-2 py-1.5 sm:py-2 bg-slate-100 border-2 border-slate-200 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs shadow-2xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
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
                  <div className="my-auto flex flex-col items-center justify-center gap-3 p-4 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-[#1E4648] flex items-center justify-center shadow-2xs">
                      {metodeBayar === 'QRIS' ? (
                        <QrCode className="w-7 h-7" />
                      ) : (
                        <CreditCard className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-800">Pembayaran {metodeBayar}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Nominal Tagihan: <span className="font-black text-[#1E4648] font-mono text-sm">Rp {grandTotal.toLocaleString('id-ID')}</span>
                      </p>
                    </div>
                    <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl p-3 max-w-xs shadow-2xs leading-relaxed">
                      Pastikan dana telah masuk atau struk EDC berhasil keluar sebelum konfirmasi pembayaran.
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Submit Action - ALWAYS VISIBLE STICKY FOOTER ON DESKTOP */}
              <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0 z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={handleConfirmPaymentSafe}
                  disabled={
                    paymentSubmitting ||
                    (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal)
                  }
                  className={`w-full font-black py-3.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-[0.98] ${
                    paymentSubmitting ||
                    (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                      : 'bg-gradient-to-r from-emerald-600 via-teal-700 to-[#1E4648] hover:from-emerald-500 hover:to-[#163536] text-white shadow-emerald-900/20'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="tracking-wide">
                    {paymentSubmitting 
                      ? 'Memproses Pembayaran...' 
                      : (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal
                          ? `Kurang Rp ${(grandTotal - Number(uangBayarInput)).toLocaleString('id-ID')}`
                          : 'Konfirmasi & Selesaikan Bayar'
                        )
                    }
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6 & 7: UNIFIED MODAL "Pembayaran Berhasil & Live Preview Cetakan" */}
      {showSuccessModal && completedOrderData && (
        <div 
          className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          style={{ zoom: inverseZoom }}
        >
          <div className="relative bg-white rounded-3xl w-full max-w-5xl border border-slate-200/90 shadow-2xl flex flex-col lg:flex-row overflow-hidden my-auto max-h-[94dvh] animate-scale-in">
            
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

                  {/* NOTIFIKASI PENAMBAHAN STEMPEL (WASHER & DRYER) */}
                  {completedOrderData.stampInfo && completedOrderData.stampInfo.earned && (
                    <div className="pt-2.5 border-t border-slate-100 bg-gradient-to-br from-teal-50 via-emerald-50/60 to-teal-50 -mx-1 p-3 rounded-2xl space-y-2 border-2 border-teal-300 shadow-xs animate-scale-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#1E4648] text-amber-300 flex items-center justify-center shadow-xs shrink-0">
                            <Award className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-xs block leading-tight">
                              +{completedOrderData.stampInfo.stampsAdded} Stempel Berhasil Didapat!
                            </span>
                            <span className="text-[10px] text-teal-800 font-medium">
                              Transaksi mencakup layanan Washer (Cuci) &amp; Dryer (Kering)
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 bg-teal-800 text-white text-[10px] font-extrabold rounded-full shadow-2xs whitespace-nowrap">
                          {completedOrderData.stampInfo.cardType === '75' ? 'Kartu 7 KG' : 'Kartu 4 KG'}
                        </span>
                      </div>

                      {/* Visual 10 Stamp Circles Indicator */}
                      <div className="bg-white/90 p-2.5 rounded-xl border border-teal-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-600">Progres Stempel:</span>
                          <span className="font-mono text-xs font-black text-teal-900">
                            {completedOrderData.stampInfo.newTotal} / 10
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {Array.from({ length: 10 }).map((_, idx) => (
                            <div
                              key={idx}
                              className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black transition-all ${
                                idx < completedOrderData.stampInfo.newTotal
                                  ? (idx === 9 ? 'bg-amber-400 text-amber-950 ring-1 ring-amber-500 shadow-xs' : 'bg-teal-600 text-white shadow-xs')
                                  : 'bg-slate-200 text-slate-400'
                              }`}
                              title={`Stempel #${idx + 1}`}
                            >
                              {idx < completedOrderData.stampInfo.newTotal ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : (
                                idx + 1
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {completedOrderData.stampInfo.isRewardReady ? (
                        <div className="p-2 bg-amber-100 border border-amber-300 rounded-xl text-amber-950 font-extrabold text-[11px] text-center flex items-center justify-center gap-1.5 shadow-2xs">
                          <Gift className="w-4 h-4 text-amber-700 animate-bounce" />
                          <span>Target 10 Stempel Tercapai! Berhak Klaim 1x Cuci Gratis!</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-teal-800 text-center font-medium">
                          Tersisa <strong>{10 - completedOrderData.stampInfo.newTotal} stempel</strong> lagi untuk klaim <strong>1x Cuci Gratis</strong>.
                        </div>
                      )}
                    </div>
                  )}

                  {/* NOTIFIKASI KLAIM REWARD SELESAI */}
                  {completedOrderData.stampInfo && completedOrderData.stampInfo.isClaimed && (
                    <div className="pt-2.5 border-t border-slate-100 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 -mx-1 p-3 rounded-2xl space-y-1.5 border-2 border-amber-300 shadow-xs animate-scale-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs shrink-0">
                            <Gift className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-black text-amber-950 text-xs block leading-tight">
                              Reward 1x Cuci Gratis Berhasil Diklaim!
                            </span>
                            <span className="text-[10px] text-amber-800 font-medium">
                              {completedOrderData.stampInfo.rewardMessage}
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-0.5 bg-amber-600 text-white text-[10px] font-extrabold rounded-full shadow-2xs whitespace-nowrap">
                          {completedOrderData.stampInfo.cardLabel}
                        </span>
                      </div>
                    </div>
                  )}

                  {completedOrderData.tipeLayanan === 'FullService' && completedOrderData.estimasiSelesai && (
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-amber-800 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" /> Estimasi Selesai:
                      </span>
                      <span className="font-mono font-bold text-amber-900">{formatTargetSelesai(completedOrderData.estimasiSelesai)}</span>
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
                    const phone = formatWaPhone(completedOrderData.noHp);
                    const noNota = completedOrderData.trxId || '';
                    const tanggal = `${completedOrderData.tanggal || ''}, ${completedOrderData.waktu || ''}`;
                    const nama = completedOrderData.pelanggan || 'Pelanggan';

                    const msg = generateWhatsAppReceiptMessage({
                      noNota: noNota,
                      namaPelanggan: nama,
                      noHp: phone,
                      tanggal: tanggal,
                      kasir: completedOrderData.kasir || 'Kasir',
                      tipeLayanan: completedOrderData.tipeLayanan,
                      tingkatLayanan: completedOrderData.tingkatLayanan,
                      estimasiSelesai: completedOrderData.estimasiSelesai,
                      items: (completedOrderData.items || []).map((i: any) => ({
                        layanan: i.layanan,
                        qty: i.qty,
                        hargaSatuan: i.hargaSatuan,
                        subtotal: Number(i.hargaSatuan || 0) * Number(i.qty || 1)
                      })),
                      subtotal: Number(completedOrderData?.subtotal) || Number(completedOrderData?.total) || 0,
                      diskonNilai: Number(completedOrderData?.diskon) || 0,
                      diskonKode: completedOrderData?.diskonKode || '',
                      total: Number(completedOrderData?.total) || 0,
                      metodeBayar: completedOrderData.metodeBayar || 'Tunai',
                      kembalian: Number(completedOrderData.kembalian) || 0,
                      isMember: Boolean(completedOrderData.isMember),
                      poinEarned: Number(completedOrderData.poinEarned) || 0,
                      saldoPoin: Number(completedOrderData.saldoPoinAkhir) || 0,
                      token: completedOrderData.token,
                      stampInfo: completedOrderData.stampInfo
                    });
                    
                    // Log Activity to Audit Trail
                    runBackend(
                      'logClientActivity', 
                      completedOrderData.kasir || 'Kasir', 
                      'Kirim Struk WA', 
                      noNota, 
                      '-', 
                      `No WhatsApp: ${phone}`, 
                      `Kirim link e-nota digital WhatsApp untuk nota ${noNota} ke ${nama || 'Pelanggan'}`
                    ).catch(() => {});

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
                          <span className="text-[9.5px]">{formatTargetSelesai(completedOrderData.estimasiSelesai)}</span>
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
                        <span className="font-bold">{formatTargetSelesai(completedOrderData.estimasiSelesai)}</span>
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
        <div 
          className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ zoom: inverseZoom }}
        >
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
        <div 
          className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3"
          style={{ zoom: inverseZoom }}
        >
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden border border-slate-100 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Tutup Shift & Rekap Kas Laci & Merchant</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kasir: <strong className="text-slate-700">{shiftAktif.namaKasir}</strong> • Shift dibuka {formatDateTime(shiftAktif?.waktuBuka)}
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

                      {/* Info Kumulatif Hari Ini (Jika Ganti Shift) */}
                      {shiftAktif?.kumulatif?.isGantiShift && (
                        <div className="mt-2 pt-2 border-t border-teal-200/60 text-[10px] text-slate-500 space-y-0.5">
                          <div className="font-bold text-teal-950 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-teal-700" />
                              <span>Kumulatif Hari Ini (Shift 1 s/d {shiftAktif.kumulatif.shiftKe}):</span>
                            </span>
                            <span className="text-teal-800 font-mono">Modal Pagi: Rp {(shiftAktif.kumulatif.modalAwalHariIni || 0).toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>• Total Tunai Kumulatif:</span>
                            <span className="font-mono text-teal-700 font-bold">+ Rp {(shiftAktif.kumulatif.omzetTunaiHariIni || 0).toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>• Total Belanja Kumulatif:</span>
                            <span className="font-mono text-rose-600 font-bold">- Rp {(shiftAktif.kumulatif.totalBelanjaHariIni || 0).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      )}
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

                  {/* Warning: Ada Pengajuan Void yang Belum Di-Approve */}
                  {shiftAktif?.pendingVoidCount && shiftAktif.pendingVoidCount > 0 ? (
                    <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 space-y-2 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-amber-950">
                            Ada {shiftAktif.pendingVoidCount} Pengajuan Void Menunggu Approval Manager
                          </h4>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Total tertahan <strong>Rp {(shiftAktif.pendingVoidTotal || 0).toLocaleString('id-ID')}</strong> masih terhitung di kas laci karena belum disetujui Manager.
                          </p>
                        </div>
                      </div>

                      {shiftAktif.pendingVoidList && shiftAktif.pendingVoidList.length > 0 && (
                        <div className="bg-white/80 border border-amber-200 rounded-xl p-2 divide-y divide-amber-100 max-h-24 overflow-y-auto">
                          {shiftAktif.pendingVoidList.map((pv, idx) => (
                            <div key={idx} className="py-1 flex items-center justify-between text-[11px]">
                              <span className="font-mono font-bold text-slate-800">{pv.noNota} <span className="font-normal text-slate-500">({pv.namaPelanggan})</span></span>
                              <span className="font-mono font-bold text-rose-600">Rp {(pv.nominal || 0).toLocaleString('id-ID')} <span className="text-[9px] text-amber-700">[{pv.metodeBayar}]</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

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
                          {(() => {
                            const filtered = staffList.filter((staff) => shiftAktif ? (staff.id !== shiftAktif.idUser && staff.nama !== shiftAktif.namaKasir) : true);
                            const display = filtered.length > 0 ? filtered : staffList;
                            return display.map((staff) => (
                              <option key={staff.id} value={staff.id}>{staff.nama}</option>
                            ));
                          })()}
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

                  {/* Catatan / Keterangan Penutupan */}
                  {(() => {
                    const expectedKas = (shiftAktif?.kasAwal || 0) + (shiftAktif?.totalOmzetTunai || 0) - totalShiftExpense;
                    const diffKas = kasAkhirFisik !== '' ? (Number(kasAkhirFisik) || 0) - expectedKas : 0;
                    const expectedMerch = (shiftAktif?.saldoMerchantAwal || 0) + (shiftAktif?.totalOmzetMerchant || 0);
                    const diffMerch = saldoMerchantAkhirInput !== '' ? (Number(saldoMerchantAkhirInput) || 0) - expectedMerch : 0;
                    const hasDiff = (kasAkhirFisik !== '' && diffKas !== 0) || (saldoMerchantAkhirInput !== '' && diffMerch !== 0);

                    return (
                      <div className={`p-3 rounded-xl border transition ${
                        hasDiff ? 'bg-amber-50/70 border-amber-300 shadow-2xs' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                          <span>Catatan / Keterangan Penutupan {hasDiff ? <span className="text-rose-600 font-black">* (Wajib Diisi Karena Ada Selisih)</span> : <span className="text-slate-400 font-normal">(Opsional)</span>}</span>
                          {hasDiff && (
                            <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full animate-pulse">
                              Ada Selisih
                            </span>
                          )}
                        </label>
                        <textarea
                          value={closeShiftCatatan}
                          onChange={(e) => setCloseShiftCatatan(e.target.value)}
                          placeholder={hasDiff ? 'Jelaskan alasan selisih kas fisik atau saldo merchant di sini (wajib)...' : 'Contoh: Uang fisik sesuai, operasional shift lancar...'}
                          rows={2}
                          className={`w-full px-3 py-2 rounded-xl text-xs outline-none transition bg-white border ${
                            hasDiff 
                              ? 'border-amber-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-300/30' 
                              : 'border-slate-200 focus:border-[#1E4648]'
                          }`}
                        />
                        {hasDiff && (
                          <p className="text-[11px] text-amber-800 font-medium mt-1.5 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Sistem tetap memproses ganti/tutup shift meskipun ada selisih, asalkan Anda mengisi alasan di kolom ini.</span>
                          </p>
                        )}
                      </div>
                    );
                  })()}
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
                          disabled={shiftSubmitting || isCompressingPhotos}
                        />
                        <label
                          htmlFor="expense-receipt-upload"
                          className={`w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#1E4648] bg-white flex flex-col items-center justify-center gap-1.5 cursor-pointer text-slate-600 hover:text-[#1E4648] transition group ${
                            (shiftSubmitting || isCompressingPhotos) ? 'opacity-50 pointer-events-none' : ''
                          }`}
                        >
                          <Camera className="w-5 h-5 text-slate-400 group-hover:text-[#1E4648] transition" />
                          <span className="text-xs font-bold">Ambil Foto / Upload Foto Nota</span>
                          <span className="text-[10px] text-slate-400">Otomatis dikompresi agar upload cepat & anti-gagal</span>
                        </label>
                      </div>

                      {/* Compressing Indicator */}
                      {isCompressingPhotos && (
                        <div className="mt-2.5 p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-blue-800 text-xs font-semibold animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Mengompresi foto bukti nota...</span>
                        </div>
                      )}

                      {/* Uploaded Photo List */}
                      {expensePhotos.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-600 block flex items-center justify-between">
                            <span>{expensePhotos.length} foto nota siap diunggah:</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Total: ~{expensePhotos.reduce((sum, p) => sum + (p.sizeKb || 0), 0)} KB
                            </span>
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            {expensePhotos.map((photo, idx) => (
                              <div key={photo.id || idx} className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
                                <img 
                                  src={photo.preview} 
                                  alt={photo.name || `Nota ${idx + 1}`} 
                                  className="w-full h-20 object-cover cursor-pointer hover:opacity-90 transition"
                                  onClick={() => setPreviewModalPhoto({ src: photo.preview, title: photo.name || `Nota ${idx + 1}` })}
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-2xs text-[9px] text-white font-medium px-1.5 py-0.5 truncate flex items-center justify-between">
                                  <span>{photo.sizeKb} KB</span>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewModalPhoto({ src: photo.preview, title: photo.name || `Nota ${idx + 1}` })}
                                    className="text-white hover:text-teal-300"
                                    title="Lihat ukuran penuh"
                                  >
                                    <Eye className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeExpensePhoto(idx)}
                                  disabled={shiftSubmitting}
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
                disabled={shiftSubmitting}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleCloseShiftWithExpense}
                disabled={shiftSubmitting || isCompressingPhotos || !kasAkhirFisik || !saldoMerchantAkhirInput || (closeShiftMode === 'SERAH_TERIMA' && !handoverResult?.eligible)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold py-2.5 flex items-center justify-center gap-2 shadow-md transition"
              >
                {shiftSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{shiftSubmitStatusText || 'Menutup Kas Shift...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tutup Shift & Simpan Rekonsiliasi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tambah Produk Custom Modal */}
      {showCustomItemModal && (
        <div 
          className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ zoom: inverseZoom }}
        >
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
      {/* ========================================================================= */}
      {/* DSS: MODAL PENCEGATAN STOK TIDAK MENCUKUPI (DECISION SUPPORT MODAL)       */}
      {/* ========================================================================= */}
      {showStockDecisionModal && stockDecisionItems.length > 0 && (
        <div 
          className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          style={{ zoom: inverseZoom }}
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-2xl border border-rose-200 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">Stok Bahan Tidak Mencukupi</h3>
                  <p className="text-[11px] text-slate-400">Peringatan ketersediaan stok & rekomendasi tindakan (DSS)</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowStockDecisionModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="overflow-y-auto space-y-3.5 pr-1 flex-1 text-xs">
              {stockDecisionItems.map((item, idx) => {
                return (
                  <div key={idx} className="p-4 bg-rose-50/40 border border-rose-200 rounded-xl space-y-3">
                    {/* Item Title & Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800 text-sm">{item.namaItem}</span>
                        <span className="text-[11px] text-slate-400 block">Layanan: {item.layanan}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                        Stok Kurang {item.kekurangan} {item.satuan}
                      </span>
                    </div>

                    {/* Data Relevan (Grid) */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-semibold">Stok Sistem</span>
                        <span className="text-sm font-black text-rose-600">{item.stokSistem} {item.satuan}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-semibold">Kebutuhan Order</span>
                        <span className="text-sm font-bold text-slate-700">{item.kebutuhan} {item.satuan}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-teal-200 shadow-2xs">
                        <span className="text-[10px] text-teal-700 block font-semibold">Fisik Terakhir</span>
                        <span className="text-sm font-black text-teal-900">
                          {item.stokFisikTerakhir !== undefined ? `${item.stokFisikTerakhir} ${item.satuan}` : 'Belum Ada'}
                        </span>
                      </div>
                    </div>

                    {/* Rekomendasi Tindakan */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 block flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        Tindakan yang Disarankan:
                      </span>
                      <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed font-medium">
                        {item.rekomendasi}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-1 flex items-center justify-end gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickActionModal({
                            type: 'ADJUST',
                            item: item,
                            inputQty: String(item.stokFisikTerakhir !== undefined ? item.stokFisikTerakhir : Math.max(item.kebutuhan, 1)),
                            submitting: false
                          });
                        }}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Cek / Stock Adjustment</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuickActionModal({
                            type: 'RESTOCK',
                            item: item,
                            inputQty: String(Math.max(10, item.kebutuhan * 2)),
                            submitting: false
                          });
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Lanjut ke Restock</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 italic">
                *Sistem memblokir stok minus untuk menjaga integritas data akuntansi.
              </span>
              <button
                type="button"
                onClick={() => setShowStockDecisionModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Tutup / Ubah Pesanan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADJUST / RESTOCK SUB-MODAL DIRECTLY INSIDE POS */}
      {quickActionModal && (
        <div 
          className="fixed inset-0 z-[650] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          style={{ zoom: inverseZoom }}
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                {quickActionModal.type === 'ADJUST' ? <Scale className="w-4 h-4 text-teal-600" /> : <ShoppingCart className="w-4 h-4 text-amber-600" />}
                <span>{quickActionModal.type === 'ADJUST' ? 'Penyesuaian Cepat Stok Fisik' : 'Restock Cepat Barang Masuk'}</span>
              </h4>
              <button onClick={() => setQuickActionModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3 mb-4 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-800 block">{quickActionModal.item.namaItem}</span>
                <span className="text-[11px] text-slate-500">Stok Sistem Saat Ini: {quickActionModal.item.stokSistem} {quickActionModal.item.satuan}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {quickActionModal.type === 'ADJUST' ? 'Hitungan Stok Fisik Riil di Toko' : 'Jumlah Masuk dari Pembelian'}:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={quickActionModal.inputQty}
                    onChange={(e) => setQuickActionModal({ ...quickActionModal, inputQty: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648]"
                  />
                  <span className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">
                    {quickActionModal.item.satuan}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickActionModal(null)}
                disabled={quickActionModal.submitting}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={quickActionModal.submitting || parseDecimal(quickActionModal.inputQty, -1) < 0}
                onClick={async () => {
                  const qty = parseDecimal(quickActionModal.inputQty, -1);
                  if (qty < 0) {
                    await showAlert('Nilai stok tidak boleh negatif!', 'warning');
                    return;
                  }

                  setQuickActionModal(prev => prev ? { ...prev, submitting: true } : null);
                  try {
                    if (quickActionModal.type === 'ADJUST') {
                      const res = await runBackend<{ success: boolean; stokBaru?: number; delta?: number }>('adjustInventory', quickActionModal.item.idInventory, qty, 'Koreksi Cepat POS saat Transaksi', 'Koreksi kasir', namaKasirInput || 'Kasir');
                      if (res && res.success) {
                        clearCache('getInventoryList');
                        const updated = await runBackend<any[]>('getInventoryList');
                        if (Array.isArray(updated)) setInventoryList(updated);
                        setQuickActionModal(null);
                        setShowStockDecisionModal(false);
                        await showAlert(`Stok fisik ${quickActionModal.item.namaItem} berhasil disesuaikan menjadi ${res.stokBaru} ${quickActionModal.item.satuan}.\n\nAnda dapat melanjutkan transaksi!`, 'success');
                      }
                    } else {
                      const res = await runBackend<{ success: boolean; stokBaru?: number }>('restockInventory', quickActionModal.item.idInventory, qty, 'Pembelian Kasir', 0, 'Restock cepat dari POS', namaKasirInput || 'Kasir');
                      if (res && res.success) {
                        clearCache('getInventoryList');
                        const updated = await runBackend<any[]>('getInventoryList');
                        if (Array.isArray(updated)) setInventoryList(updated);
                        setQuickActionModal(null);
                        setShowStockDecisionModal(false);
                        await showAlert(`Restock +${qty} ${quickActionModal.item.satuan} ${quickActionModal.item.namaItem} berhasil disimpan.\n\nAnda dapat melanjutkan transaksi!`, 'success');
                      }
                    }
                  } catch (err: any) {
                    await showAlert('Gagal memperbarui stok: ' + (err?.message || String(err)), 'error');
                  } finally {
                    setQuickActionModal(prev => prev ? { ...prev, submitting: false } : null);
                  }
                }}
                className={`px-4 py-1.5 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  quickActionModal.type === 'ADJUST' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {quickActionModal.submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Simpan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMART RECOMMENDATION MODAL (POS) */}
      {showRekomendasiModal && (
        <div 
          className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ zoom: inverseZoom }}
        >
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

      {/* Fullscreen Photo Preview Modal */}
      {previewModalPhoto && (
        <div 
          className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ zoom: inverseZoom }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold truncate max-w-xs">{previewModalPhoto.title}</span>
              </div>
              <button 
                onClick={() => setPreviewModalPhoto(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
              <img 
                src={previewModalPhoto.src} 
                alt={previewModalPhoto.title} 
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end bg-slate-950">
              <button 
                onClick={() => setPreviewModalPhoto(null)}
                className="px-4 py-1.5 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold rounded-lg transition"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
