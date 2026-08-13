'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Edit3,
  Bluetooth,
  BluetoothOff
} from 'lucide-react';
import { LayananItem, CartItem, ShiftKasir } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import {
  isBluetoothSupported,
  getActiveDeviceInfo,
  requestAndConnectBluetoothDevice,
  sendRawEscPosData,
  generateTagEscPos,
} from '@/lib/bluetoothPrinter';
import PrinterModal from '@/components/PrinterModal';
import { UserRole } from '@/lib/types';

interface CustomerState {
  nama: string;
  noHp: string;
  alamat?: string;
  memberStatus?: string;
  poin?: number;
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

function getLayananStyleConfig(item: LayananItem) {
  const name = item.layanan;
  const kategori = item.kategori;

  // Icon
  let Icon = WashingMachine;
  if (name.includes('Softener') || name.includes('Deterjen') || name.includes('Kresek')) Icon = Package;
  else if (name.includes('Air') || name.includes('Kopi') || name.includes('Teh')) Icon = Coffee;
  else if (name.includes('Setrika') || name.includes('Express') || name.includes('Setrika')) Icon = Sparkles;

  // Subtle color scheme — semua pakai nuansa teal/slate, hanya icon bg yang beda tipis
  if (kategori === 'MakananMinuman') {
    return { Icon, iconBg: 'bg-[#FF9500]/10', iconColor: 'text-[#FF9500]', dot: 'bg-orange-400' };
  }
  if (kategori === 'Produk') {
    return { Icon, iconBg: 'bg-slate-100', iconColor: 'text-slate-500', dot: 'bg-slate-400' };
  }
  if (kategori === 'Layanan Tambahan') {
    return { Icon, iconBg: 'bg-[#B5C9C9]/20', iconColor: 'text-[#1E4648]', dot: 'bg-teal-400' };
  }
  // Default: Layanan Utama
  return { Icon, iconBg: 'bg-[#B5C9C9]/20', iconColor: 'text-[#1E4648]', dot: 'bg-[#1E4648]' };
}

export default function PosView({ currentRole }: { currentRole?: UserRole } = {}) {
  const [layananList, setLayananList] = useState<LayananItem[]>(defaultLayanan);
  const [search, setSearch] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'Semua' | 'SelfService' | 'Dropoff' | 'MakananMinuman'>('Semua');
  
  // 1. Cart & Order State
  const [cart, setCart] = useState<{ [key: string]: CartItem }>({});
  const [customer, setCustomer] = useState<CustomerState>({ nama: '', noHp: '' });
  const [customerMode, setCustomerMode] = useState<'UMUM' | 'MEMBER'>('UMUM');
  const [customerSource, setCustomerSource] = useState<'BARU' | 'TERDAFTAR'>('BARU');
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [voucherMsg, setVoucherMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [diskonApplied, setDiskonApplied] = useState<{ kode: string; nilai: number }>({ kode: '', nilai: 0 });

  // Order Details Form State
  const [tipeLayanan, setTipeLayanan] = useState<'SelfService' | 'FullService'>('SelfService');
  const [tingkatLayanan, setTingkatLayanan] = useState<'Reguler' | 'Express' | 'Kilat'>('Reguler');
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [btPrinting, setBtPrinting] = useState(false);
  const [showStrukModal, setShowStrukModal] = useState(false);

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

  // Shift & Kas State
  const [shiftAktif, setShiftAktif] = useState<ShiftKasir | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [closeShiftMode, setCloseShiftMode] = useState<'SERAH_TERIMA' | 'TUTUP_HARIAN'>('SERAH_TERIMA');
  const [replacementEmployeeId, setReplacementEmployeeId] = useState('');
  const [handoverResult, setHandoverResult] = useState<{ eligible: boolean; message: string } | null>(null);

  const [kasAwalInput, setKasAwalInput] = useState('100000');
  const [kasAkhirFisik, setKasAkhirFisik] = useState('');
  const [customItemForm, setCustomItemForm] = useState({
    layanan: '',
    hargaSatuan: '',
    kategori: 'Layanan' as LayananItem['kategori']
  });

  // Fetch Master Data — stale-while-revalidate (instant dari cache, fresh di background)
  useEffect(() => {
    // 1. Layanan Catalog
    runBackendCached<any[]>(
      'getLayananListAll',
      (data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLayananList(data.map((item) => ({
            layanan: item.nama,
            hargaSatuan: Number(item.harga),
            tipe: item.tipe || 'SelfService',
            satuan: item.satuan || 'paket',
            kategori: item.kategori === 'MakananMinuman'
              ? 'MakananMinuman'
              : item.tipe === 'FullService' ? 'Layanan Tambahan' : 'Layanan',
          })));
        }
      },
      10 * 60 * 1000 // 10 menit TTL — katalog jarang berubah
    );

    // 2. Customers List
    runBackendCached<any[]>(
      'getDaftarPelanggan',
      (data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCustomerList(data.map((c) => ({
            nama: c.nama,
            noHp: c.noHp,
            alamat: c.alamat,
            memberStatus: c.isRepeatOrder ? 'Member Regular' : 'Pelanggan Baru',
          })));
        }
      },
      5 * 60 * 1000 // 5 menit TTL
    );

    // 3. Staff List
    runBackendCached<any[]>(
      'getPegawaiList',
      (data) => {
        if (Array.isArray(data) && data.length > 0) {
          setStaffList(data);
          if (data[0]?.nama) setNamaKasirInput(data[0].nama);
        }
      },
      15 * 60 * 1000 // 15 menit TTL — pegawai sangat jarang berubah
    );
  }, []);

  const refreshActiveShift = useCallback(async () => {
    setShiftLoading(true);
    try {
      const data = await runBackend<ShiftKasir | null>('getKasShiftAktif', 'OUTLET-UTAMA');
      setShiftAktif(data || null);
    } catch (error) {
      console.error('Gagal memuat kas shift:', error);
      setToastMsg('Kas shift belum dapat dimuat. Periksa koneksi backend.');
    } finally {
      setShiftLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshActiveShift(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshActiveShift]);

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

  // Voucher Application (Connected to Backend Promo Database)
  const handleApplyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherMsg({ type: 'error', text: 'Masukkan kode voucher terlebih dahulu' });
      return;
    }
    try {
      const res = await runBackend<{ valid: boolean; kode?: string; nilai?: number; message?: string }>('validasiVoucher', code, subtotalCart);
      if (res.valid && res.nilai !== undefined) {
        setDiskonApplied({ kode: code, nilai: res.nilai });
        setVoucherMsg({ type: 'success', text: `Voucher ${code} terpasang (Diskon - Rp ${(res.nilai || 0).toLocaleString('id-ID')})` });
      } else {
        setVoucherMsg({ type: 'error', text: res.message || 'Kode voucher tidak valid' });
      }
    } catch {
      // Fallback local check
      if (code === 'HEMAT10' || code === 'DUASISI') {
        const pot = Math.round(subtotalCart * 0.1);
        setDiskonApplied({ kode: code, nilai: pot });
        setVoucherMsg({ type: 'success', text: `Voucher ${code} terpasang (Diskon 10% - Rp ${(pot || 0).toLocaleString('id-ID')})` });
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
      alert('Nama dan No. HP Pelanggan wajib diisi!');
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

  const handleConfirmPaymentSafe = async () => {
    if (paymentSubmitting) return;
    if (!shiftAktif) {
      alert('Buka kas shift terlebih dahulu sebelum memproses pembayaran.');
      setShowDetailTransaksiModal(false);
      setShowBukaShiftModal(true);
      return;
    }
    const kasir = namaKasirInput || 'Kasir 1';
    const custName = customer.nama || 'Pelanggan Umum';
    const total = grandTotal;
    const bayar = Number(uangBayarInput) || total;

    if (!customer.nama.trim() || !customer.noHp.trim()) {
      alert('Nama dan No. HP / WhatsApp pelanggan wajib diisi.');
      return;
    }
    if (metodeBayar === 'Tunai' && (!uangBayarInput || bayar < total)) {
      alert('Nominal uang tunai belum cukup.');
      return;
    }
    if (metodeBayar !== 'Tunai' && qrisStatus !== 'SUCCESS') {
      alert('Pembayaran nontunai belum diverifikasi.');
      return;
    }

    setPaymentSubmitting(true);
    try {
      const res = await runBackend<{ success: boolean; noNota: string; total: number; token?: string }>('simpanTransaksi', {
        namaPelanggan: custName,
        noHp: customer.noHp,
        kasir,
        tipeLayanan,
        tingkatLayanan,
        metodeBayar,
        nominalBayar: metodeBayar === 'Tunai' ? bayar : total,
        referensiPembayaran: refNoInput.trim(),
        diskon: diskonApplied.nilai,
        catatan: catatanOrderInput,
        items: cartArray.map((i) => ({ layanan: i.layanan, qty: i.qty, hargaSatuan: i.hargaSatuan }))
      });
      if (!res?.success || !res.noNota) throw new Error('Backend tidak mengembalikan nomor nota');

      const resTotal = Number(res.total) || grandTotal;
      setCompletedOrderData({
        trxId: res.noNota,
        token: res.token || '',
        kasir,
        pelanggan: custName,
        noHp: customer.noHp,
        metodeBayar,
        total: resTotal,
        uangBayar: Number(bayar) || resTotal,
        kembalian: Math.max(0, (Number(bayar) || resTotal) - resTotal),
        items: cartArray.map(i => ({ ...i, hargaSatuan: Number(i.hargaSatuan) || 0, qty: Number(i.qty) || 0 })),
        catatan: catatanOrderInput,
        tipeLayanan,
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
      alert(`Transaksi gagal: ${msg}\n\nPastikan Apps Script sudah di-deploy ulang dan koneksi internet stabil.`);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // ── THERMAL LABEL PRINT (Bluetooth) ──────────────────────────
  const handlePrintThermalLabel = async () => {
    if (!completedOrderData) return;
    if (!isBluetoothSupported()) {
      alert('Browser ini tidak mendukung Web Bluetooth.\nGunakan Chrome / Edge di Android atau Desktop.');
      return;
    }
    setBtPrinting(true);
    try {
      // Cek apakah printer sudah terkoneksi
      const deviceInfo = getActiveDeviceInfo();
      if (!deviceInfo.connected) {
        // Belum konek — minta user pilih device
        setToastMsg('Mencari printer Bluetooth…');
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
        petugas: completedOrderData.kasir,
        tipe: completedOrderData.tipeLayanan || 'SelfService',
        tingkatLayanan: 'Reguler',
        catatan: completedOrderData.catatan || '',
        items: (completedOrderData.items || []).map((i: any) => ({
          layanan: i.layanan,
          qty: Number(i.qty) || 1,
          hargaSatuan: Number(i.hargaSatuan) || 0,
          subtotal: (Number(i.qty) || 1) * (Number(i.hargaSatuan) || 0),
          catatan: i.catatan || '',
        })),
      };
      const escData = generateTagEscPos(txForPrint as any);
      await sendRawEscPosData(escData);
      setToastMsg('✅ Label thermal berhasil dicetak!');
    } catch (err: any) {
      const msg = err?.message || 'Gagal mencetak';
      if (msg.includes('User cancelled') || msg.includes('cancelled')) {
        setToastMsg('Cetak dibatalkan.');
      } else {
        alert(`Gagal cetak thermal:\n${msg}`);
      }
    } finally {
      setBtPrinting(false);
    }
  };

  const handleOpenShift = async () => {
    const kasAwal = Number(kasAwalInput);
    if (!Number.isFinite(kasAwal) || kasAwal < 0) {
      alert('Kas awal harus berupa angka nol atau lebih.');
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
      });
      if (!result?.success || !result.data) throw new Error(result?.message || 'Kas shift gagal dibuka.');
      setShiftAktif(result.data);
      setShowBukaShiftModal(false);
      setToastMsg(`Kas shift ${result.data.idShift} berhasil dibuka.`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Kas shift gagal dibuka.');
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleCheckHandover = async () => {
    if (!shiftAktif || !replacementEmployeeId) {
      alert('Pilih staf shift pengganti terlebih dahulu.');
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
      alert('Kas akhir fisik harus berupa angka nol atau lebih.');
      return;
    }
    if (closeShiftMode === 'SERAH_TERIMA' && !handoverResult?.eligible) {
      alert('Clock In staf pengganti harus diverifikasi sebelum serah terima.');
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

        {/* Category Pills Row */}
        <div className="px-3 sm:px-4 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar bg-slate-50/30">
          {[
            { id: 'Semua', label: 'Semua Produk' },
            { id: 'SelfService', label: 'Self Service' },
            { id: 'Dropoff', label: 'Drop-off' },
            { id: 'MakananMinuman', label: 'Makanan & Minuman' },
          ].map((tab) => {
            const isActive = selectedCategoryTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategoryTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition shrink-0 border ${
                  isActive
                    ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-2xs font-bold'
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* STEP 1: Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 md:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 auto-rows-auto sm:auto-rows-fr">
            {(() => {
              const renderCard = (item: LayananItem, idx: number) => {
                const qtyInCart = cart[item.layanan] ? cart[item.layanan].qty : 0;
                const { Icon, iconBg, iconColor } = getLayananStyleConfig(item);
                const isBest = idx % 3 === 0;

                // Track pointer start position to distinguish tap vs scroll
                let pointerStartX = 0;
                let pointerStartY = 0;

                return (
                  <div
                    key={idx}
                    onPointerDown={(e) => {
                      pointerStartX = e.clientX;
                      pointerStartY = e.clientY;
                    }}
                    onPointerUp={(e) => {
                      const dx = Math.abs(e.clientX - pointerStartX);
                      const dy = Math.abs(e.clientY - pointerStartY);
                      // Only add to cart if pointer barely moved (tap, not scroll)
                      if (dx < 8 && dy < 8) {
                        updateCart(item, 1);
                      }
                    }}
                    className={`bg-white rounded-lg border p-4 flex flex-col gap-3 cursor-pointer select-none active:scale-95 transition-transform duration-75 touch-pan-y ${
                      qtyInCart > 0
                        ? 'ring-2 ring-[#1E4648]/25 border-[#1E4648] bg-[#1E4648]/[0.02]'
                        : 'border-slate-200/80 shadow-2xs hover:border-slate-200 hover:shadow-md'
                    }`}
                  >
                    {/* Icon + Nama produk */}
                    <div className="flex items-start gap-2.5">
                      <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-sm text-slate-600 leading-snug">
                        {item.layanan}
                      </p>
                    </div>

                    {/* Harga + badge + stepper */}
                    <div className="flex items-center justify-between gap-1 min-w-0 max-[380px]:flex-col max-[380px]:items-stretch" onClick={(e) => e.stopPropagation()}>
                      <div className="min-w-0 shrink">
                        <div className="text-base font-bold text-slate-700 leading-none whitespace-nowrap">
                          Rp {(item.hargaSatuan || 0).toLocaleString('id-ID')}
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                          isBest ? 'bg-[#FF9500]/15 text-[#FF9500]' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {isBest ? 'Best' : 'Ready'}
                        </span>
                      </div>

                      {qtyInCart > 0 ? (
                        <div className="flex items-center bg-[#1E4648] text-white rounded-lg overflow-hidden shrink-0 max-[380px]:self-end">
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                            className="w-9 h-9 flex items-center justify-center hover:bg-white/20 transition font-bold text-base"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-bold px-2 min-w-[24px] text-center">{qtyInCart}</span>
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); updateCart(item, 1); }}
                            className="w-9 h-9 flex items-center justify-center hover:bg-white/20 transition font-bold text-base"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#1E4648]/10 flex items-center justify-center shrink-0">
                          <Plus className="w-5 h-5 text-[#1E4648]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              const filterLower = search.toLowerCase().trim();
              const filteredAll = (layananList || []).filter((i) => i.layanan.toLowerCase().includes(filterLower));

              if (selectedCategoryTab !== 'Semua') {
                const tabFiltered = filteredAll.filter((i) => {
                  if (selectedCategoryTab === 'SelfService') return i.tipe === 'SelfService' && i.kategori !== 'MakananMinuman';
                  if (selectedCategoryTab === 'Dropoff') return i.tipe === 'FullService';
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
      <div className={`fixed inset-0 z-[300] bg-white flex flex-col w-full md:static md:w-[320px] lg:w-[360px] xl:w-[400px] md:z-auto border border-slate-200/80 rounded-lg shrink-0 overflow-hidden shadow-2xs transition-all duration-200 ${
        showMobileCart ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-0 md:opacity-100 hidden md:flex'
      }`}>
        {/* Header Order & Customer Button */}
        <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#1E4648]" />
            <h2 className="text-base font-bold text-slate-600">Order Detail</h2>
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
                  ⭐ {customer.poin} Poin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
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
              <div key={idx} className="p-3.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <h4 className="font-bold text-sm text-slate-600 leading-snug">{item.layanan}</h4>
                    <div className="text-xs font-bold text-[#1E4648] mt-0.5">
                      Rp {(item.hargaSatuan || 0).toLocaleString('id-ID')} × {item.qty} = Rp {(item.qty * (item.hargaSatuan || 0)).toLocaleString('id-ID')}
                    </div>
                  </div>
                  <button
                    onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, -item.qty)}
                    className="text-rose-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                    title="Hapus Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-lg p-0.5">
                    <button
                      onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, -1)}
                      className="w-8 h-8 bg-white text-slate-600 font-bold rounded-md flex items-center justify-center border border-slate-200"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold text-slate-600 px-2">{item.qty}</span>
                    <button
                      onClick={() => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, 1)}
                      className="w-8 h-8 bg-[#1E4648] text-white font-bold rounded-md flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.catatan || ''}
                    onChange={(e) => updateCart({ layanan: item.layanan, hargaSatuan: item.hargaSatuan, tipe: 'SelfService' }, 0, e.target.value)}
                    placeholder="+ Catatan"
                    className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1E4648] text-right w-28"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Voucher Input Box */}
        <div className="px-4 py-3 bg-white border-t border-slate-100 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={voucherInput}
              onChange={(e) => setVoucherInput(e.target.value)}
              placeholder="Kode Voucher (HEMAT10)"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold uppercase outline-none focus:border-[#1E4648]"
            />
            <button
              onClick={handleApplyVoucher}
              className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-lg transition"
            >
              Pasang
            </button>
          </div>
          {voucherMsg && (
            <div className={`text-xs font-bold ${voucherMsg.type === 'success' ? 'text-[#1E4648]' : 'text-rose-500'}`}>
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
              onClick={() => setShowDetailTransaksiModal(true)}
              disabled={cartArray.length === 0}
              className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-3.5 rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-40 shadow-md"
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
                        Ditemukan 1 Kecocokan — Mohon Cocokkan Nama Pelanggan:
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

      {/* 4. MODAL "Detail Transaksi & Pembayaran" (Split Layout: Kiri Summary, Kanan Numpad Kalkulator) */}
      {showDetailTransaksiModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 overflow-hidden">
          <div className="bg-white rounded-lg w-full h-[95vh] max-w-6xl border border-slate-100 shadow-lg flex flex-col md:flex-row overflow-hidden">
            
            {/* LEFT PANEL: Transaction Summary & Details */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0 bg-slate-50">
                <div>
                  <h3 className="text-base font-bold text-slate-600">Detail Transaksi</h3>
                  <p className="text-xs text-slate-500">Lengkapi data order & customer</p>
                </div>
                <button onClick={() => setShowDetailTransaksiModal(false)} className="p-1.5 rounded hover:bg-slate-200"><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* Customer Type */}
                <div>
                  <label className="block font-bold text-slate-700 mb-2">Jenis Pelanggan *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['UMUM', 'MEMBER'] as const).map((type) => (
                      <button key={type} type="button" onClick={() => setCustomerMode(type)} className={`py-2.5 rounded-lg border font-bold text-sm ${customerMode === type ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {type === 'UMUM' ? 'Pelanggan Biasa' : 'Member'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Source */}
                <div>
                  <label className="block font-bold text-slate-700 mb-2">Data Pelanggan *</label>
                  <select value={customerSource} onChange={(e) => setCustomerSource(e.target.value as 'BARU' | 'TERDAFTAR')} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-sm outline-none focus:border-[#1E4648]">
                    <option value="BARU">Pelanggan Baru</option>
                    <option value="TERDAFTAR">Pilih Pelanggan Terdaftar</option>
                  </select>
                </div>

                {customerSource === 'TERDAFTAR' && (
                  <select value={customer.noHp} onChange={(e) => { const found = customerList.find((c) => c.noHp === e.target.value); if (found) setCustomer({ ...found, memberStatus: customerMode === 'MEMBER' ? 'Member' : 'Regular' }); }} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-sm outline-none focus:border-[#1E4648]">
                    <option value="">Pilih pelanggan...</option>
                    {customerList.map((c) => <option key={c.noHp} value={c.noHp}>{c.nama} - {c.noHp}</option>)}
                  </select>
                )}

                {/* Staff Kasir */}
                <div>
                  <label className="block font-bold text-slate-700 mb-2">Nama Staff Memproses *</label>
                  <select value={namaKasirInput} onChange={(e) => setNamaKasirInput(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-sm outline-none focus:border-[#1E4648]">
                    {staffList.map((s) => (
                      <option key={s.id || s.nama} value={s.nama}>
                        {s.nama} {s.jabatan ? `(${s.jabatan})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-2">Nama Pelanggan *</label>
                    <input type="text" value={customer.nama} disabled={customerSource === 'TERDAFTAR'} onChange={(e) => setCustomer({ ...customer, nama: e.target.value })} placeholder="Nama Pelanggan" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-sm outline-none focus:border-[#1E4648] disabled:opacity-60" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-2">No. HP / WhatsApp *</label>
                    <input type="tel" value={customer.noHp} disabled={customerSource === 'TERDAFTAR'} onChange={(e) => setCustomer({ ...customer, noHp: e.target.value })} placeholder="08..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-sm outline-none focus:border-[#1E4648] disabled:opacity-60" />
                  </div>
                </div>

                {/* Tipe Layanan */}
                <div>
                  <label className="block font-bold text-slate-700 mb-2">Tipe Layanan</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTipeLayanan('SelfService')} className={`py-2.5 rounded-lg font-bold text-sm border ${tipeLayanan === 'SelfService' ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-white text-slate-700 border-slate-200'}`}>
                      Self Service
                    </button>
                    <button type="button" onClick={() => setTipeLayanan('FullService')} className={`py-2.5 rounded-lg font-bold text-sm border ${tipeLayanan === 'FullService' ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-white text-slate-700 border-slate-200'}`}>
                      Full Service
                    </button>
                  </div>
                </div>

                {tipeLayanan === 'FullService' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-2">Prioritas Pengerjaan</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Reguler', 'Express', 'Kilat'] as const).map((priority) => (
                        <button key={priority} type="button" onClick={() => setTingkatLayanan(priority)} className={`py-2.5 rounded-lg text-sm font-bold border ${tingkatLayanan === priority ? 'bg-[#FF9500] border-[#FF9500] text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                          {priority}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Catatan */}
                <div>
                  <label className="block font-bold text-slate-700 mb-2">Catatan Tambahan Order</label>
                  <textarea rows={2} value={catatanOrderInput} onChange={(e) => setCatatanOrderInput(e.target.value)} placeholder="Misal: Jemput jam 5 sore" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg font-medium text-sm outline-none focus:border-[#1E4648]" />
                </div>

                {/* Item Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="font-bold text-slate-600 text-sm border-b border-slate-200 pb-2 mb-2">Ringkasan Item:</div>
                  <div className="max-h-32 overflow-y-auto space-y-1.5">
                    {cartArray.map((i, idx) => (
                      <div key={idx} className="flex justify-between text-slate-700 text-sm">
                        <span>{i.layanan} ×{i.qty}</span>
                        <span className="font-bold">Rp {(i.qty * (i.hargaSatuan || 0)).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Payment Calculator (Numpad) */}
            <div className="w-full md:w-[450px] flex flex-col bg-slate-50">
              {/* Total Banner */}
              <div className="bg-slate-900 text-white p-6 text-center shrink-0">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Total Tagihan:</span>
                <span className="text-4xl font-bold text-[#B5C9C9]">Rp {(grandTotal || 0).toLocaleString('id-ID')}</span>
              </div>

              {/* Payment Method Selection */}
              <div className="p-4 border-b border-slate-200 bg-white">
                <label className="block font-bold text-slate-700 mb-2 text-sm">Metode Pembayaran *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Tunai', label: 'Tunai' },
                    { id: 'QRIS', label: 'QRIS' },
                    { id: 'Transfer', label: 'Transfer' },
                    { id: 'Debit', label: 'Debit' },
                  ].map((m) => (
                    <button key={m.id} type="button" onClick={() => setMetodeBayar(m.id as any)} className={`py-3 rounded-lg text-sm font-bold border ${metodeBayar === m.id ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-white text-slate-700 border-slate-200'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tunai: Numpad Calculator */}
              {metodeBayar === 'Tunai' ? (
                <div className="flex-1 flex flex-col p-4">
                  {/* Display Input */}
                  <div className="mb-4">
                    <label className="block font-bold text-slate-600 mb-2 text-sm">Uang Diterima:</label>
                    <input type="text" readOnly value={uangBayarInput ? `Rp ${Number(uangBayarInput).toLocaleString('id-ID')}` : 'Rp 0'} className="w-full px-4 py-4 bg-white border-2 border-slate-300 rounded-lg font-bold text-2xl text-[#1E4648] text-right" />
                  </div>

                  {/* Quick Buttons */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <button type="button" onClick={() => setUangBayarInput((grandTotal || 0).toString())} className="py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs">
                      Uang Pas
                    </button>
                    <button type="button" onClick={() => setUangBayarInput('50000')} className="py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs">
                      50K
                    </button>
                    <button type="button" onClick={() => setUangBayarInput('100000')} className="py-2 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs">
                      100K
                    </button>
                  </div>

                  {/* Numpad Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
                      <button key={num} type="button" onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? num.toString() : prev + num))} className="py-6 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-3xl shadow-sm active:scale-95 transition">
                        {num}
                      </button>
                    ))}
                    <button type="button" onClick={() => setUangBayarInput('0')} className="py-6 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-3xl shadow-sm active:scale-95 transition">
                      C
                    </button>
                    <button type="button" onClick={() => setUangBayarInput((prev) => (prev === '0' || !prev ? '0' : prev + '0'))} className="py-6 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-3xl shadow-sm active:scale-95 transition">
                      0
                    </button>
                    <button type="button" onClick={() => setUangBayarInput((prev) => prev.slice(0, -1) || '0')} className="py-6 bg-white border-2 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold rounded-xl text-2xl shadow-sm active:scale-95 transition">
                      ⌫
                    </button>
                  </div>

                  {/* Kembalian Display */}
                  {Number(uangBayarInput) >= grandTotal && Number(uangBayarInput) > 0 ? (
                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4 text-center">
                      <div className="text-xs font-bold text-emerald-700 mb-1">KEMBALIAN:</div>
                      <div className="text-2xl font-bold text-emerald-600">Rp {(Number(uangBayarInput) - grandTotal).toLocaleString('id-ID')}</div>
                    </div>
                  ) : Number(uangBayarInput) > 0 ? (
                    <div className="bg-rose-50 border-2 border-rose-300 rounded-lg p-4 text-center">
                      <div className="text-xs font-bold text-rose-700 mb-1">UANG KURANG:</div>
                      <div className="text-2xl font-bold text-rose-600">Rp {(grandTotal - Number(uangBayarInput)).toLocaleString('id-ID')}</div>
                    </div>
                  ) : null}
                </div>
              ) : (
                /* Non-Tunai UI */
                <div className="flex-1 p-4 flex flex-col items-center justify-center">
                  {metodeBayar === 'QRIS' && (
                    <>
                      <div className="w-40 h-40 bg-white border-2 border-slate-200 rounded-xl flex items-center justify-center mb-4 shadow-sm">
                        <QrCode className="w-32 h-32 text-slate-600" />
                      </div>
                      <div className="text-sm font-bold text-slate-700 mb-4">Scan QRIS Pembayaran Dua SiSi POS</div>
                      <button type="button" onClick={() => { setQrisStatus('SUCCESS'); alert('Pembayaran QRIS Terverifikasi!'); }} className="px-6 py-3 bg-[#1E4648] text-white rounded-lg text-sm font-bold hover:bg-[#163536]">
                        Cek Status Pembayaran
                      </button>
                    </>
                  )}
                  {metodeBayar !== 'QRIS' && (
                    <>
                      <div className="text-lg font-bold text-slate-700 mb-2">Pembayaran {metodeBayar}</div>
                      <div className="text-sm text-slate-500 mb-4">Total: Rp {grandTotal.toLocaleString('id-ID')}</div>
                      <button type="button" onClick={() => { setQrisStatus('SUCCESS'); alert(`Pembayaran ${metodeBayar} Terverifikasi!`); }} className="px-6 py-3 bg-[#1E4648] text-white rounded-lg text-sm font-bold hover:bg-[#163536]">
                        Verifikasi Pembayaran
                      </button>
                    </>
                  )}

                  {/* Referensi */}
                  <div className="w-full mt-6">
                    <label className="block font-bold text-slate-700 mb-2 text-sm">Referensi / No. Transaksi (Optional)</label>
                    <input type="text" value={refNoInput} onChange={(e) => setRefNoInput(e.target.value)} placeholder="Auto-generated" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none" />
                  </div>
                </div>
              )}

              {/* Bottom Action */}
              <div className="p-4 border-t border-slate-200 bg-white">
                <button type="button" onClick={handleConfirmPaymentSafe} disabled={paymentSubmitting || (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal)} className={`w-full font-bold py-4 rounded-lg text-base flex items-center justify-center gap-2 shadow-md transition ${paymentSubmitting || (metodeBayar === 'Tunai' && Number(uangBayarInput) < grandTotal) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-[#1E4648] hover:bg-[#163536] text-white'}`}>
                  <span>{paymentSubmitting ? 'Menyimpan...' : 'Konfirmasi & Selesaikan Bayar'}</span>
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-600">Detail Transaksi & Pembayaran</h3>
                <p className="text-[11px] text-slate-500 font-medium">Lengkapi rincian order & pilih metode pembayaran</p>
              </div>
              <button onClick={() => setShowDetailTransaksiModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

      {/* STEP 6: MODAL "Pembayaran Berhasil" */}
      {showSuccessModal && completedOrderData && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                  <div className="font-bold text-slate-600 text-xs uppercase tracking-wider text-[#1E4648] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                    <span>1. Detail Order & Customer</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Jenis Pelanggan *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['UMUM', 'MEMBER'] as const).map((type) => (
                        <button key={type} type="button" onClick={() => setCustomerMode(type)} className={`py-2 rounded-lg border font-bold text-[11px] ${customerMode === type ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-white text-slate-600 border-slate-200'}`}>
                          {type === 'UMUM' ? 'Pelanggan Biasa' : 'Member'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Data Pelanggan *</label>
                    <select value={customerSource} onChange={(e) => setCustomerSource(e.target.value as 'BARU' | 'TERDAFTAR')} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none focus:border-[#1E4648]">
                      <option value="BARU">Pelanggan Baru</option>
                      <option value="TERDAFTAR">Pilih Pelanggan Terdaftar</option>
                    </select>
                  </div>

                  {customerSource === 'TERDAFTAR' && (
                    <select value={customer.noHp} onChange={(e) => { const found = customerList.find((c) => c.noHp === e.target.value); if (found) setCustomer({ ...found, memberStatus: customerMode === 'MEMBER' ? 'Member' : 'Regular' }); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none focus:border-[#1E4648]">
                      <option value="">Pilih pelanggan...</option>
                      {customerList.map((c) => <option key={c.noHp} value={c.noHp}>{c.nama} - {c.noHp}</option>)}
                    </select>
                  )}

                  {/* Staff Kasir Selector / Input */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Staff Memproses *</label>
                    <select
                      value={namaKasirInput}
                      onChange={(e) => setNamaKasirInput(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none focus:border-[#1E4648]"
                    >
                      {staffList.map((s) => (
                        <option key={s.id || s.nama} value={s.nama}>
                          {s.nama} {s.jabatan ? `(${s.jabatan})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Customer Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Pelanggan *</label>
                      <input type="text" value={customer.nama} disabled={customerSource === 'TERDAFTAR'} onChange={(e) => setCustomer({ ...customer, nama: e.target.value })} placeholder="Nama Pelanggan" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none focus:border-[#1E4648] disabled:opacity-60" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">No. HP / WhatsApp *</label>
                      <input type="tel" value={customer.noHp} disabled={customerSource === 'TERDAFTAR'} onChange={(e) => setCustomer({ ...customer, noHp: e.target.value })} placeholder="08..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold outline-none focus:border-[#1E4648] disabled:opacity-60" />
                    </div>
                  </div>

                  {/* Tipe Layanan Selection */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tipe Layanan</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTipeLayanan('SelfService')}
                        className={`py-2 px-2.5 rounded-lg font-bold transition text-center text-[11px] border ${
                          tipeLayanan === 'SelfService' 
                            ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Self Service (Cuci Sendiri)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipeLayanan('FullService')}
                        className={`py-2 px-2.5 rounded-lg font-bold transition text-center text-[11px] border ${
                          tipeLayanan === 'FullService' 
                            ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Full Service (Terima Beres)
                      </button>
                    </div>
                  </div>

                  {tipeLayanan === 'FullService' && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Prioritas Pengerjaan</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Reguler', 'Express', 'Kilat'] as const).map((priority) => (
                          <button
                            key={priority}
                            type="button"
                            onClick={() => setTingkatLayanan(priority)}
                            className={`py-2 rounded-lg text-[11px] font-bold border transition ${
                              tingkatLayanan === priority
                                ? 'bg-[#FF9500] border-[#FF9500] text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {priority}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Catatan Tambahan */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan Order</label>
                    <textarea
                      rows={2}
                      value={catatanOrderInput}
                      onChange={(e) => setCatatanOrderInput(e.target.value)}
                      placeholder="Misal: Jemput jam 5 sore, pisahkan baju putih"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium outline-none focus:border-[#1E4648]"
                    />
                  </div>

                  {/* Readonly Item List Summary */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                    <div className="font-bold text-slate-600 border-b border-slate-200 pb-1">Ringkasan Item:</div>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {cartArray.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-slate-700 text-[11px]">
                          <span>{i.layanan} ×{i.qty}</span>
                          <span className="font-bold">Rp {(i.qty * (i.hargaSatuan || 0)).toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: PEMBAYARAN */}
                <div className="space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="font-bold text-slate-600 text-xs uppercase tracking-wider text-[#1E4648] pb-1 border-b border-slate-100">
                      2. Pembayaran Transaksi
                    </div>

                    {/* Total Tagihan Banner */}
                    <div className="bg-slate-900 text-white rounded-lg p-4 text-center shadow-inner">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Tagihan:</span>
                      <span className="text-2xl sm:text-3xl font-bold text-[#B5C9C9]">Rp {(grandTotal || 0).toLocaleString('id-ID')}</span>
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
                            className={`py-2 px-2 rounded-lg text-xs font-bold transition border text-center ${
                              metodeBayar === m.id 
                                ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-xs' 
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Conditional Tunai Input, Uang Kurang Warning, & Kembalian */}
                    {metodeBayar === 'Tunai' ? (
                      <div className="bg-[#f8fafc] border-2 border-slate-200 rounded-lg p-3.5 space-y-2.5 shadow-2xs">
                        <div className="flex justify-between items-center gap-2">
                          <label className="font-bold text-slate-600">Jumlah Uang Diterima (Rp):</label>
                          <input
                            type="number"
                            value={uangBayarInput}
                            onChange={(e) => setUangBayarInput(e.target.value)}
                            placeholder={grandTotal.toString()}
                            className="w-36 px-3 py-1.5 bg-white border-2 border-slate-200 rounded-lg font-bold text-[#1E4648] outline-none text-right focus:border-[#1E4648]"
                          />
                        </div>

                        <div className="flex gap-1.5 overflow-x-auto">
                          <button type="button" onClick={() => setUangBayarInput((grandTotal || 0).toString())} className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-lg text-[10px] shadow-2xs">
                            Uang Pas (Rp {(grandTotal || 0).toLocaleString('id-ID')})
                          </button>
                          <button type="button" onClick={() => setUangBayarInput('50000')} className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-lg text-[10px] shadow-2xs">
                            Rp 50.000
                          </button>
                          <button type="button" onClick={() => setUangBayarInput('100000')} className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-lg text-[10px] shadow-2xs">
                            Rp 100.000
                          </button>
                        </div>

                        {/* State 1: Uang Kurang Warning (Red Alert) */}
                        {Number(uangBayarInput) > 0 && Number(uangBayarInput) < grandTotal && (
                          <div className="flex justify-between items-center text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>Uang Kurang:</span>
                            </span>
                            <span className="text-sm font-bold text-rose-600">
                              -Rp {((grandTotal || 0) - Number(uangBayarInput || 0)).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}

                        {/* State 2: Kembalian Normal (Emerald Box) */}
                        {Number(uangBayarInput) >= (grandTotal || 0) && (
                          <div className="flex justify-between items-center text-xs font-bold text-[#1E4648] bg-[#B5C9C9]/20/90 border border-[#B5C9C9] p-2.5 rounded-lg">
                            <span>Kembalian:</span>
                            <span className="text-base font-bold text-[#1E4648]">
                              Rp {(Number(uangBayarInput || 0) - (grandTotal || 0)).toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Non-Tunai UI */
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center space-y-2">
                        {/* QR Code hanya untuk QRIS */}
                        {metodeBayar === 'QRIS' && (
                          <>
                            <div className="w-28 h-28 bg-white border border-slate-200 rounded-lg mx-auto flex items-center justify-center p-2 shadow-xs">
                              <QrCode className="w-20 h-20 text-slate-600" />
                            </div>
                            <div className="text-[11px] font-bold text-slate-600">Scan QRIS Pembayaran Dua SiSi POS</div>
                            <button
                              type="button"
                              onClick={() => {
                                setQrisStatus('SUCCESS');
                                alert('Pembayaran QRIS Terverifikasi Berhasil!');
                              }}
                              className="px-3 py-1 bg-[#1E4648] text-white rounded-lg text-[11px] font-bold hover:bg-[#163536] transition"
                            >
                              Cek Status Pembayaran
                            </button>
                          </>
                        )}
                        
                        {/* Non-QRIS Payment Info */}
                        {metodeBayar !== 'QRIS' && (
                          <div className="py-4">
                            <div className="text-sm font-bold text-slate-700 mb-2">Pembayaran {metodeBayar}</div>
                            <div className="text-xs text-slate-500">
                              Total: Rp {grandTotal.toLocaleString('id-ID')}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setQrisStatus('SUCCESS');
                                alert(`Pembayaran ${metodeBayar} Terverifikasi Berhasil!`);
                              }}
                              className="mt-3 px-4 py-2 bg-[#1E4648] text-white rounded-lg text-xs font-bold hover:bg-[#163536] transition"
                            >
                              Verifikasi Pembayaran
                            </button>
                          </div>
                        )}
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
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium outline-none"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

      {/* STEP 6: MODAL "Pembayaran Berhasil" */}
      {showSuccessModal && completedOrderData && (
        <div className="fixed inset-0 z-[600] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-5 sm:p-6 w-full max-w-md border border-slate-100 shadow-lg my-auto text-center animate-scale-in">
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-full bg-[#B5C9C9]/30 text-[#1E4648] flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-base font-bold text-slate-600">Pembayaran Berhasil!</h3>
            <p className="text-xs text-slate-500 font-medium mb-4">Transaksi order telah sukses disimpan</p>

            {/* Summary Box */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-lg p-3.5 text-xs text-left space-y-1.5 mb-5">
              <div className="flex justify-between"><span className="text-slate-500">No. Invoice:</span><span className="font-bold text-slate-700">{completedOrderData.trxId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Pelanggan:</span><span className="font-bold text-slate-600">{completedOrderData.pelanggan}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Metode Bayar:</span><span className="font-bold text-slate-600">{completedOrderData.metodeBayar}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Dibayar:</span><span className="font-bold text-slate-700">Rp {(completedOrderData?.total || 0).toLocaleString('id-ID')}</span></div>
              {completedOrderData.metodeBayar === 'Tunai' && (
                <div className="flex justify-between text-[#1E4648] font-bold pt-1 border-t border-slate-200">
                  <span>Kembalian:</span>
                  <span className="font-bold">Rp {(completedOrderData?.kembalian || 0).toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                <span>Waktu:</span>
                <span>{completedOrderData.tanggal} {completedOrderData.waktu}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {/* Kirim WA — utama */}
              <button
                onClick={() => {
                  const phone = String(completedOrderData.noHp || '').replace(/^0/, '62').replace(/\D/g, '');
                  const nama = completedOrderData.pelanggan || 'Pelanggan';
                  const noNota = completedOrderData.trxId || '';
                  const tanggal = `${completedOrderData.tanggal || ''}, ${completedOrderData.waktu || ''}`;
                  const total = (Number(completedOrderData?.total) || 0).toLocaleString('id-ID');
                  const items = (completedOrderData.items || [])
                    .map((i: any) => `• ${i.layanan} (x${i.qty}) - Rp ${(Number(i.hargaSatuan) || 0).toLocaleString('id-ID')}`)
                    .join('\n');
                  const eNotaUrl = `https://duasisilaundry-pos.vercel.app/?t=${completedOrderData.token || noNota}`;
                  const msg = [
                    `Halo ${nama}! Struk dari Dua SiSi Laundry`,
                    ``,
                    `No Nota     : ${noNota}`,
                    `Tanggal     : ${tanggal}`,
                    `Kecepatan   : ${completedOrderData.tipeLayanan === 'FullService' ? 'Full Service' : 'Self Service'} - Reguler`,
                    ``,
                    `Detail Layanan:`,
                    items,
                    ``,
                    `TOTAL       : Rp ${total}`,
                    `Metode Bayar: ${completedOrderData.metodeBayar || 'Tunai'}`,
                    ``,
                    `Lihat E-Nota Resmi:`,
                    eNotaUrl,
                    ``,
                    `Terima kasih telah mencuci di Dua SiSi Laundry!`,
                  ].join('\n');
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                }}
                className="w-full bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-3 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Struk ke WhatsApp</span>
              </button>

              {/* Cetak Label Thermal — cek BT */}
              <button
                onClick={handlePrintThermalLabel}
                disabled={btPrinting}
                className="w-full bg-[#B5C9C9]/20 hover:bg-[#B5C9C9]/30 disabled:opacity-50 text-[#1E4648] font-bold py-2.5 rounded-lg text-xs border border-[#B5C9C9] flex items-center justify-center gap-2"
              >
                {btPrinting ? (
                  <>
                    <Bluetooth className="w-4 h-4 animate-pulse" />
                    <span>Menghubungkan Printer…</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Cetak Label Thermal</span>
                  </>
                )}
              </button>

              {/* Cetak Struk — buka PrinterModal */}
              <button
                onClick={() => setShowStrukModal(true)}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-2.5 rounded-lg text-xs border border-slate-200 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk</span>
              </button>

              <button
                onClick={handleCompleteFlowAndReset}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-lg text-xs"
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
          <div className="bg-white rounded-lg p-5 sm:p-6 w-full max-w-md border border-slate-100 shadow-lg my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-600">Preview & Cetak Struk</h3>
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
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                    paperSize === p.id ? 'bg-[#1E4648] text-white border-[#1E4648]' : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Thermal Struk Paper Preview */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 rounded-lg font-mono text-[11px] leading-tight text-slate-600 space-y-2 border border-slate-200/80 shadow-inner">
              <div className="text-center font-bold">
                <div className="text-sm font-bold">DUA SISI LAUNDRY</div>
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
                {(completedOrderData.items || []).map((i: any, idx: number) => (
                  <div key={idx}>
                    <div className="font-bold">{i.layanan}</div>
                    <div className="flex justify-between text-[10px]">
                      <span>{i.qty} x Rp {(Number(i.hargaSatuan) || 0).toLocaleString('id-ID')}</span>
                      <span>Rp {(i.qty * (Number(i.hargaSatuan) || 0)).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
                <div className="border-b border-dashed border-slate-400 my-2" />
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-0.5 font-bold">
                <div className="flex justify-between"><span>TOTAL :</span><span>Rp {(Number(completedOrderData?.total) || 0).toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span>BAYAR ({completedOrderData?.metodeBayar || 'Tunai'}):</span><span>Rp {(Number(completedOrderData?.uangBayar) || 0).toLocaleString('id-ID')}</span></div>
                {(completedOrderData?.kembalian || 0) > 0 && (
                  <div className="flex justify-between text-[#1E4648]"><span>KEMBALI :</span><span>Rp {(Number(completedOrderData?.kembalian) || 0).toLocaleString('id-ID')}</span></div>
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
                onClick={handlePrintThermalLabel}
                disabled={btPrinting}
                className="bg-[#1E4648] hover:bg-[#163536] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                {btPrinting ? (
                  <><Bluetooth className="w-4 h-4 animate-pulse" /><span>Menghubungkan…</span></>
                ) : (
                  <><Printer className="w-4 h-4" /><span>Cetak Label Thermal</span></>
                )}
              </button>

              <button
                onClick={handleCompleteFlowAndReset}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-lg text-xs"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-sm border border-slate-100 shadow-lg">
            <h3 className="text-sm font-bold text-slate-600 mb-3">Buka Shift Kasir Baru</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kas Awal Laci (Rp)</label>
                <input
                  type="number"
                  value={kasAwalInput}
                  onChange={(e) => setKasAwalInput(e.target.value)}
                  placeholder="100000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBukaShiftModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Batal</button>
              <button
                onClick={handleOpenShift}
                disabled={shiftSubmitting}
                className="flex-1 bg-[#1E4648] disabled:opacity-50 text-white rounded-lg text-xs font-bold py-2"
              >
                {shiftSubmitting ? 'Membuka...' : 'Buka Shift Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutup Shift Modal */}
      {showTutupShiftModal && shiftAktif && (
        <div className="fixed inset-0 z-[500] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm border border-slate-100 shadow-lg">
            <h3 className="text-sm font-bold text-slate-600 mb-3">Tutup Shift & Rekap Kas Laci</h3>
            <div className="space-y-2 text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg">
              <div className="flex justify-between"><span>Kas Awal:</span><span className="font-bold text-slate-600">Rp {(shiftAktif?.kasAwal || 0).toLocaleString('id-ID')}</span></div>
              <div className="flex justify-between"><span>Waktu Buka:</span><span className="font-bold text-slate-600">{new Date(shiftAktif?.waktuBuka || Date.now()).toLocaleTimeString('id-ID')}</span></div>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mode Penutupan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setCloseShiftMode('SERAH_TERIMA'); setHandoverResult(null); }}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-bold ${closeShiftMode === 'SERAH_TERIMA' ? 'bg-[#1E4648] border-[#1E4648] text-white' : 'border-slate-200 text-slate-600'}`}
                  >
                    Serah Terima
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCloseShiftMode('TUTUP_HARIAN'); setHandoverResult(null); }}
                    className={`rounded-lg border px-2 py-2 text-[11px] font-bold ${closeShiftMode === 'TUTUP_HARIAN' ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-200 text-slate-600'}`}
                  >
                    Tutup Hari Ini
                  </button>
                </div>
              </div>

              {closeShiftMode === 'SERAH_TERIMA' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Staf Shift Pengganti</label>
                  <div className="flex gap-2">
                    <select
                      value={replacementEmployeeId}
                      onChange={(event) => { setReplacementEmployeeId(event.target.value); setHandoverResult(null); }}
                      className="min-w-0 flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
                    >
                      <option value="">Pilih staf...</option>
                      {staffList.filter((staff) => staff.id !== shiftAktif.idUser).map((staff) => (
                        <option key={staff.id} value={staff.id}>{staff.nama}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleCheckHandover}
                      disabled={shiftSubmitting || !replacementEmployeeId}
                      className="px-3 py-2 rounded-lg bg-slate-100 text-[#1E4648] disabled:opacity-50 text-[11px] font-bold"
                    >
                      Verifikasi
                    </button>
                  </div>
                  {handoverResult && (
                    <p className={`mt-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold ${handoverResult.eligible ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {handoverResult.message}
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                  Gunakan hanya untuk shift terakhir saat operasional outlet benar-benar selesai.
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Total Fisik Kas di Laci (Rp)</label>
                <input
                  type="number"
                  value={kasAkhirFisik}
                  onChange={(e) => setKasAkhirFisik(e.target.value)}
                  placeholder="Hitung jumlah uang fisik di laci"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTutupShiftModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">Batal</button>
              <button
                onClick={handleCloseShift}
                disabled={shiftSubmitting || (closeShiftMode === 'SERAH_TERIMA' && !handoverResult?.eligible)}
                className="flex-1 bg-rose-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold py-2"
              >
                {shiftSubmitting ? 'Memproses...' : 'Tutup Shift Kasir'}
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
              }} className="flex-1 bg-[#1E4648] text-white rounded-lg text-xs font-bold py-2">Tambah Produk</button>
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
            estimasi: completedOrderData.estimasiSelesai || '',
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
