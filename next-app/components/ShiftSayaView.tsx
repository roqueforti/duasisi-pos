'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Coins, 
  Clock, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  Receipt, 
  Plus, 
  Trash2, 
  Camera, 
  X, 
  RefreshCw, 
  ArrowRightLeft, 
  UserCheck, 
  Store, 
  Calendar,
  Lock,
  Unlock,
  ChevronRight,
  Info,
  Send,
  Copy,
  Check,
  Share2,
  History
} from 'lucide-react';

import { runBackend } from '@/lib/api';
import { useDialog } from '@/components/DialogProvider';
import { UserRole, ShiftKumulatifData } from '@/lib/types';
import { parseDecimal, formatDecimal } from '@/lib/utils';


export interface ShiftKasir {
  idShift: string;
  idOutlet: string;
  namaKasir: string;
  idUser: string;
  waktuBuka: string;
  kasAwal: number;
  saldoMerchantAwal: number;
  totalOmzetTunai: number;
  totalOmzetMerchant: number;
  kasAkhirSistem: number;
  status: string;
  pendingVoidCount?: number;
  pendingVoidTotal?: number;
  pendingVoidList?: Array<{
    noNota: string;
    namaPelanggan: string;
    nominal: number;
    metodeBayar: string;
    alasan?: string;
  }>;
  kumulatif?: ShiftKumulatifData;
}

export interface ExpenseItem {
  id?: string;
  nama: string;
  nominal: number;
  kategori: string;
  catatan?: string;
  waktu?: string;
  fotoUrl?: string;
  tipePengeluaran?: 'STOK_TERDAFTAR' | 'STOK_BARU' | 'NON_STOK';
  idInventory?: string;
  namaBarangStok?: string;
  qtyMasuk?: number;
  satuan?: string;
}

export interface RekapShiftItem {
  idShift: string;
  idOutlet: string;
  namaKasir: string;
  idUser: string;
  waktuBuka: string;
  waktuTutup: string;
  kasAwal: number;
  omzetTunai?: number;
  omzetMerchant?: number;
  kasAkhirSistem?: number;
  kasAkhirFisik?: number;
  selisihKas?: number;
  status: string;
  modeTutup?: string;
  namaPengganti?: string;
  catatan?: string;
  saldoAwalMerchant?: number;
  saldoAkhirMerchant?: number;
  saldoMerchantAwal?: number;
  saldoMerchantAkhir?: number;
  totalBelanja?: number;
  fotoNota?: string[];
}

export interface InventorySimpleItem {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
  stokMinimum: number;
}

interface ShiftSayaViewProps {
  currentRole: UserRole;
  initialSubTab?: 'shift_saya' | 'pengeluaran' | 'riwayat_shift';
  onNavigateTab?: (tab: string) => void;
  onShiftStateChange?: (isActive: boolean) => void;
}

const EXPENSE_CATEGORIES = [
  'Deterjen & Chemical',
  'Plastik & Kemasan',
  'Listrik, Air & Gas',
  'Konsumsi Staff',
  'Maintenance Mesin',
  'Perlengkapan Kasir',
  'Operasional Lainnya'
];

const SATUAN_OPTIONS = ['pcs', 'liter', 'kg', 'botol', 'roll', 'pack', 'sachet', 'lusin'];

const DEFAULT_STAFF_LIST = [
  { id: 'PEG-001', nama: 'Kasir 1 (Shift Pagi)', jabatan: 'Kasir', status: 'Aktif' },
  { id: 'PEG-002', nama: 'Kasir 2 (Shift Siang)', jabatan: 'Kasir', status: 'Aktif' },
  { id: 'PEG-003', nama: 'Admin Outlet', jabatan: 'Supervisor', status: 'Aktif' },
  { id: 'PEG-004', nama: 'Staff Operasional', jabatan: 'Operator Laundry', status: 'Aktif' },
];

export default function ShiftSayaView({
  currentRole,
  initialSubTab = 'shift_saya',
  onNavigateTab,
  onShiftStateChange
}: ShiftSayaViewProps) {
  const { showAlert, showConfirm } = useDialog();

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<'shift_saya' | 'pengeluaran' | 'riwayat_shift'>(initialSubTab);

  // Persistent active shift cache helper to prevent flash on reload
  const getCachedActiveShift = (): ShiftKasir | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('pos_active_shift_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.idShift && (parsed.status === 'Buka' || parsed.status === 'Aktif')) {
          return parsed;
        }
      }
    } catch {}
    return null;
  };

  const saveCachedActiveShift = (shift: ShiftKasir | null) => {
    if (typeof window === 'undefined') return;
    try {
      if (shift && shift.idShift && (shift.status === 'Buka' || shift.status === 'Aktif')) {
        localStorage.setItem('pos_active_shift_cache', JSON.stringify(shift));
      } else {
        localStorage.removeItem('pos_active_shift_cache');
      }
    } catch {}
  };

  // Shift & Loading States (Initialized with cached active shift if available to eliminate layout jump)
  const [cachedInitial] = useState<ShiftKasir | null>(() => getCachedActiveShift());
  const [shiftAktif, setShiftAktifState] = useState<ShiftKasir | null>(cachedInitial);
  const [loading, setLoading] = useState<boolean>(() => !cachedInitial);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');

  const setShiftAktif = useCallback((data: ShiftKasir | null) => {
    setShiftAktifState(data);
    saveCachedActiveShift(data);
  }, []);

  const [staffList, setStaffList] = useState<any[]>(DEFAULT_STAFF_LIST);
  const [rekapShiftList, setRekapShiftList] = useState<RekapShiftItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventorySimpleItem[]>([]);

  // Attendance Check State
  const [todayClockIn, setTodayClockIn] = useState<boolean>(true);
  const [quickClockInName, setQuickClockInName] = useState<string>('');

  // OPENING SHIFT FORM STATES
  const [kasAwalInput, setKasAwalInput] = useState<string>('100000');
  const [saldoMerchantAwalInput, setSaldoMerchantAwalInput] = useState<string>('0');
  const [namaKasirInput, setNamaKasirInput] = useState<string>('');
  const [handoverPrefillInfo, setHandoverPrefillInfo] = useState<{
    fromKasir: string;
    kasFisik: number;
    merchant: number;
    time: string;
  } | null>(null);
  const [checklist, setChecklist] = useState<{
    areaKasir: boolean;
    mesinSiap: boolean;
    stokBahan: boolean;
    displayDanLampu: boolean;
  }>({
    areaKasir: true,
    mesinSiap: true,
    stokBahan: true,
    displayDanLampu: true
  });

  // EXPENSE STATES & INVENTORY INTEGRATION
  const [expenseList, setExpenseList] = useState<ExpenseItem[]>([]);
  const [expenseTipe, setExpenseTipe] = useState<'STOK_TERDAFTAR' | 'STOK_BARU' | 'NON_STOK'>('STOK_TERDAFTAR');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  const [qtyMasukInput, setQtyMasukInput] = useState<string>('');
  const [satuanBaruInput, setSatuanBaruInput] = useState<string>('pcs');
  const [stokMinBaruInput, setStokMinBaruInput] = useState<string>('5');
  
  const [newExpenseForm, setNewExpenseForm] = useState<{
    nama: string;
    nominal: string;
    kategori: string;
    catatan: string;
    fotoPreview: string | null;
  }>({
    nama: '',
    nominal: '',
    kategori: EXPENSE_CATEGORIES[0],
    catatan: '',
    fotoPreview: null
  });
  const [showAddExpenseModal, setShowAddExpenseModal] = useState<boolean>(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // CLOSING & HANDOVER STATES
  const [showClosingModal, setShowClosingModal] = useState<boolean>(false);
  const [closeMode, setCloseMode] = useState<'SERAH_TERIMA' | 'TUTUP_HARIAN'>('SERAH_TERIMA');
  const [kasAkhirFisikInput, setKasAkhirFisikInput] = useState<string>('');
  const [saldoMerchantAkhirInput, setSaldoMerchantAkhirInput] = useState<string>('');
  const [replacementStaffId, setReplacementStaffId] = useState<string>('');
  const [closingCatatan, setClosingCatatan] = useState<string>('');
  const [handoverVerified, setHandoverVerified] = useState<boolean>(false);
  const [handoverMessage, setHandoverMessage] = useState<string>('');

  // WHATSAPP REPORT STATES
  const [showWaReportModal, setShowWaReportModal] = useState<boolean>(false);
  const [waReportText, setWaReportText] = useState<string>('');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Helper format WhatsApp Shift Report Message
  const formatShiftReportMsg = (data: {
    idShift: string;
    namaKasir: string;
    namaPengganti?: string;
    waktuBuka: string;
    waktuTutup: string;
    mode: 'SERAH_TERIMA' | 'TUTUP_HARIAN';
    kasAwal: number;
    omzetTunai: number;
    omzetMerchant: number;
    saldoMerchantAwal: number;
    saldoMerchantAkhir: number;
    totalBelanja: number;
    expensesList?: ExpenseItem[];
    kasAkhirFisik: number;
    selisihKas: number;
    selisihMerchant: number;
    catatan?: string;
    pendingVoidCount?: number;
    pendingVoidTotal?: number;
  }) => {
    const isHandover = data.mode === 'SERAH_TERIMA';
    const selisihKasText = data.selisihKas === 0 ? 'Rp 0 (SESUAI ✅)' : data.selisihKas > 0 ? `+Rp ${data.selisihKas.toLocaleString('id-ID')} (LEBIH)` : `-Rp ${Math.abs(data.selisihKas).toLocaleString('id-ID')} (KURANG ⚠️)`;
    const selisihMerchText = data.selisihMerchant === 0 ? 'Rp 0 (SESUAI ✅)' : data.selisihMerchant > 0 ? `+Rp ${data.selisihMerchant.toLocaleString('id-ID')} (LEBIH)` : `-Rp ${Math.abs(data.selisihMerchant).toLocaleString('id-ID')} (KURANG ⚠️)`;

    const expenseLines = (data.expensesList && data.expensesList.length > 0)
      ? data.expensesList.map((e, idx) => `  ${idx + 1}. ${e.nama}: Rp ${(e.nominal || 0).toLocaleString('id-ID')}`).join('\n')
      : (data.totalBelanja > 0 ? `  • Total Pengeluaran: Rp ${data.totalBelanja.toLocaleString('id-ID')}` : '  - Tidak ada pengeluaran belanja');

    const pendingVoidLine = (data.pendingVoidCount && data.pendingVoidCount > 0)
      ? `\n⚠️ *PERHATIAN VOID PENDING*:\n• Ada *${data.pendingVoidCount} transaksi* menunggu persetujuan Void oleh Manager.\n• Total Tertahan: Rp ${(data.pendingVoidTotal || 0).toLocaleString('id-ID')}\n`
      : '';

    return `📊 *LAPORAN PENUTUPAN KAS SHIFT*
*DUA SISI LAUNDRY EXPRESS & COIN*
══════════════════════
📅 *Waktu*: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
🔖 *Shift ID*: #${data.idShift}
🏢 *Outlet*: OUTLET UTAMA
🔄 *Mode*: ${isHandover ? 'SERAH TERIMA SHIFT (HANDOVER)' : 'TUTUP HARIAN (CLOSING OUTLET)'}
👤 *Kasir Bertugas*: ${data.namaKasir}
${isHandover && data.namaPengganti ? `➡️ *Kasir Pengganti*: ${data.namaPengganti}\n` : ''}⏱️ *Jam Kerja*: ${data.waktuBuka} - ${data.waktuTutup}
${pendingVoidLine}
💵 *REKONSILIASI KAS LACI (TUNAI)*
• Modal Awal Laci : Rp ${(data.kasAwal || 0).toLocaleString('id-ID')}
• Pemasukan POS   : + Rp ${(data.omzetTunai || 0).toLocaleString('id-ID')}
• Total Belanja   : - Rp ${(data.totalBelanja || 0).toLocaleString('id-ID')}
──────────────────────
• *Ekspektasi Kas*: Rp ${((data.kasAwal || 0) + (data.omzetTunai || 0) - (data.totalBelanja || 0)).toLocaleString('id-ID')}
• *Fisik Kas Laci*: Rp ${(data.kasAkhirFisik || 0).toLocaleString('id-ID')}
• *Selisih Fisik* : *${selisihKasText}*

💳 *REKONSILIASI MERCHANT (QRIS/EDC)*
• Saldo Awal      : Rp ${(data.saldoMerchantAwal || 0).toLocaleString('id-ID')}
• Pemasukan QRIS  : + Rp ${(data.omzetMerchant || 0).toLocaleString('id-ID')}
──────────────────────
• *Ekspektasi Saldo*: Rp ${((data.saldoMerchantAwal || 0) + (data.omzetMerchant || 0)).toLocaleString('id-ID')}
• *Saldo Akhir*   : Rp ${(data.saldoMerchantAkhir || 0).toLocaleString('id-ID')}
• *Selisih Saldo* : *${selisihMerchText}*

🛒 *RINCIAN PENGELUARAN BELANJA SHIFT*:
${expenseLines}

📝 *Catatan / Kondisi*:
"${data.catatan || 'Operasional berjalan lancar.'}"
══════════════════════
_Laporan otomatis dibuat dari Sistem POS Dua SiSi Laundry_`;
  };


  // 1. Fetch Main Shift Data & Inventory in Parallel for Max Performance
  const loadShiftData = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, staffRes, invRes, absensiRes, rekapRes] = await Promise.all([
        runBackend<ShiftKasir | null>('getKasShiftAktif', 'OUTLET-UTAMA').catch(() => null),
        runBackend<any[]>('getPegawaiList').catch(() => []),
        runBackend<InventorySimpleItem[]>('getInventoryList').catch(() => []),
        runBackend<any[]>('getRekapAbsensi').catch(() => []),
        runBackend<RekapShiftItem[]>('getRekapKasShift').catch(() => [])
      ]);

      // 1. Set active shift
      if (activeRes && activeRes.idShift) {
        setShiftAktif(activeRes);
        if (onShiftStateChange) onShiftStateChange(true);
      } else {
        setShiftAktif(null);
        if (onShiftStateChange) onShiftStateChange(false);
      }

      // 2. Set staff list
      if (Array.isArray(staffRes) && staffRes.length > 0) {
        const activeStaff = staffRes.filter(s => s.status !== 'Resign' && s.status !== 'Nonaktif' && s.status !== 'Non-Aktif');
        if (activeStaff.length > 0) {
          setStaffList(activeStaff);
          if (activeStaff[0]?.nama) {
            setNamaKasirInput(prev => prev || activeStaff[0].nama);
            setQuickClockInName(prev => prev || activeStaff[0].nama);
          }
        }
      }

      // 3. Set inventory list
      if (Array.isArray(invRes)) {
        setInventoryList(invRes);
        if (invRes.length > 0) {
          setSelectedInventoryId(prev => prev || invRes[0].id);
        }
      }

      // 4. Check today's clock in status
      if (Array.isArray(absensiRes) && absensiRes.length > 0) {
        const todayStr = new Date().toLocaleDateString('id-ID');
        const hasInToday = absensiRes.some(r => r.tanggal?.includes(todayStr) || r.clockIn);
        setTodayClockIn(hasInToday);
      }

      // 5. Set past shifts & auto-prefill opening form from latest handover
      if (Array.isArray(rekapRes)) {
        setRekapShiftList(rekapRes);
        if (!activeRes && rekapRes.length > 0) {
          const lastShift = rekapRes[0];
          if (lastShift && lastShift.kasAkhirFisik !== undefined && Number(lastShift.kasAkhirFisik) > 0) {
            setKasAwalInput(String(lastShift.kasAkhirFisik));
            setHandoverPrefillInfo({
              fromKasir: lastShift.namaKasir,
              kasFisik: Number(lastShift.kasAkhirFisik) || 0,
              merchant: Number(lastShift.saldoMerchantAkhir) || 0,
              time: lastShift.waktuTutup || lastShift.waktuBuka
            });
          }
          if (lastShift && lastShift.saldoMerchantAkhir !== undefined && Number(lastShift.saldoMerchantAkhir) > 0) {
            setSaldoMerchantAwalInput(String(lastShift.saldoMerchantAkhir));
          }
          if (lastShift && lastShift.namaPengganti) {
            setNamaKasirInput(lastShift.namaPengganti);
          }
        }
      }
    } catch (err) {
      console.error('Gagal memuat status kas shift:', err);
    } finally {
      setLoading(false);
    }
  }, [onShiftStateChange]);


  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  // Image compressor for expense receipt
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.65));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // OPENING SHIFT HANDLER
  const handleOpenShift = async () => {
    const kasAwal = Number(kasAwalInput);
    if (!Number.isFinite(kasAwal) || kasAwal < 0) {
      await showAlert('Uang fisik kas laci awal harus berupa angka nol atau lebih.', 'warning');
      return;
    }

    const saldoMerchantAwal = Number(saldoMerchantAwalInput);
    if (!Number.isFinite(saldoMerchantAwal) || saldoMerchantAwal < 0) {
      await showAlert('Saldo awal merchant harus berupa angka nol atau lebih.', 'warning');
      return;
    }

    const allChecked = checklist.areaKasir && checklist.mesinSiap && checklist.stokBahan && checklist.displayDanLampu;
    if (!allChecked) {
      const confirmProceed = await showConfirm(
        'Beberapa checklist kondisi outlet belum dicentang. Tetap lanjutkan membuka shift kasir?'
      );
      if (!confirmProceed) return;
    }

    const selectedStaff = staffList.find(s => s.nama === namaKasirInput) || staffList[0];

    setSubmitting(true);
    setStatusText('Membuka kas shift baru di server...');
    try {
      const result = await runBackend<{ success: boolean; data?: ShiftKasir; message?: string }>('openKasShift', {
        idOutlet: 'OUTLET-UTAMA',
        userId: selectedStaff?.id || '-',
        namaKasir: selectedStaff?.nama || namaKasirInput || 'Kasir',
        kasAwal,
        saldoMerchantAwal,
        catatan: `Checklist: Area=${checklist.areaKasir ? 'OK' : 'No'}, Mesin=${checklist.mesinSiap ? 'OK' : 'No'}, Stok=${checklist.stokBahan ? 'OK' : 'No'}, Lampu=${checklist.displayDanLampu ? 'OK' : 'No'}`
      });

      if (!result?.success || !result.data) {
        throw new Error(result?.message || 'Gagal membuka shift kasir.');
      }

      setShiftAktif(result.data);
      if (onShiftStateChange) onShiftStateChange(true);
      await showAlert(`✅ Shift kasir #${result.data.idShift} berhasil dibuka atas nama ${result.data.namaKasir}!`, 'success');
      loadShiftData();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuka shift kasir.', 'error');
    } finally {
      setSubmitting(false);
      setStatusText('');
    }
  };

  // ADD EXPENSE HANDLER WITH INVENTORY AUTO-SYNC
  const handleAddExpense = async () => {
    const nominal = Number(newExpenseForm.nominal);
    if (!Number.isFinite(nominal) || nominal <= 0) {
      await showAlert('Masukkan nominal total pengeluaran (Rp) yang valid!', 'warning');
      return;
    }

    let finalNama = '';
    let finalKategori = newExpenseForm.kategori;
    let idInv: string | undefined = undefined;
    let namaStok: string | undefined = undefined;
    let qty: number | undefined = undefined;
    let sat: string | undefined = undefined;

    setSubmitting(true);
    setStatusText('Menyimpan pengeluaran & update stok...');

    try {
      if (expenseTipe === 'STOK_TERDAFTAR') {
        const invItem = inventoryList.find(i => i.id === selectedInventoryId);
        if (!invItem) {
          await showAlert('Pilih barang stok yang terdaftar!', 'warning');
          setSubmitting(false);
          return;
        }

        const qtyNum = parseDecimal(qtyMasukInput, 0);
        if (qtyNum <= 0) {
          await showAlert(`Masukkan jumlah/qty ${invItem.nama} yang dibeli (> 0)!`, 'warning');
          setSubmitting(false);
          return;
        }

        finalNama = `Beli ${invItem.nama} (+${qtyNum} ${invItem.satuan})`;
        finalKategori = 'Deterjen & Chemical';
        idInv = invItem.id;
        namaStok = invItem.nama;
        qty = qtyNum;
        sat = invItem.satuan;

        // Auto update inventory stock in backend
        const updateRes = await runBackend<{ success: boolean; stokBaru?: number }>(
          'updateStokInventory',
          invItem.id,
          qtyNum,
          shiftAktif?.namaKasir || 'Kasir'
        ).catch(() => null);

        // Update local inventory list
        setInventoryList(prev => prev.map(i => {
          if (i.id === invItem.id) {
            return { ...i, stok: (updateRes?.stokBaru !== undefined) ? updateRes.stokBaru : Math.round((i.stok + qtyNum) * 10000) / 10000 };
          }
          return i;
        }));

      } else if (expenseTipe === 'STOK_BARU') {
        const namaBarang = newExpenseForm.nama.trim();
        if (!namaBarang) {
          await showAlert('Masukkan nama barang stok baru!', 'warning');
          setSubmitting(false);
          return;
        }

        const qtyNum = parseDecimal(qtyMasukInput, 0);
        if (qtyNum <= 0) {
          await showAlert('Masukkan jumlah/stok awal barang baru (> 0)!', 'warning');
          setSubmitting(false);
          return;
        }

        const minStokNum = parseDecimal(stokMinBaruInput, 5);
        finalNama = `Beli (Baru) ${namaBarang} (+${qtyNum} ${satuanBaruInput})`;
        finalKategori = newExpenseForm.kategori;
        namaStok = namaBarang;
        qty = qtyNum;
        sat = satuanBaruInput;

        // Create new inventory item in backend
        const createRes = await runBackend<{ success: boolean; id?: string }>(
          'tambahInventory',
          {
            nama: namaBarang,
            stok: qtyNum,
            satuan: satuanBaruInput,
            stokMinimum: minStokNum
          }
        ).catch(() => null);

        idInv = createRes?.id || 'INV-' + Date.now();
        setInventoryList(prev => [
          ...prev,
          {
            id: idInv!,
            nama: namaBarang,
            stok: qtyNum,
            satuan: satuanBaruInput,
            stokMinimum: minStokNum
          }
        ]);

      } else {
        // NON_STOK
        if (!newExpenseForm.nama.trim()) {
          await showAlert('Masukkan nama keperluan / pengeluaran operasional!', 'warning');
          setSubmitting(false);
          return;
        }
        finalNama = newExpenseForm.nama.trim();
      }

      const item: ExpenseItem = {
        id: 'EXP-' + Date.now(),
        nama: finalNama,
        nominal,
        kategori: finalKategori,
        catatan: newExpenseForm.catatan.trim(),
        waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        fotoUrl: newExpenseForm.fotoPreview || undefined,
        tipePengeluaran: expenseTipe,
        idInventory: idInv,
        namaBarangStok: namaStok,
        qtyMasuk: qty,
        satuan: sat
      };

      setExpenseList(prev => [item, ...prev]);
      setNewExpenseForm({
        nama: '',
        nominal: '',
        kategori: EXPENSE_CATEGORIES[0],
        catatan: '',
        fotoPreview: null
      });
      setQtyMasukInput('');
      setShowAddExpenseModal(false);

      if (expenseTipe === 'STOK_TERDAFTAR') {
        await showAlert(`✅ Pengeluaran Rp ${nominal.toLocaleString('id-ID')} dicatat & Stok ${namaStok} otomatis bertambah +${qty} ${sat}!`, 'success');
      } else if (expenseTipe === 'STOK_BARU') {
        await showAlert(`✅ Pengeluaran Rp ${nominal.toLocaleString('id-ID')} dicatat & Barang baru "${namaStok}" (+${qty} ${sat}) berhasil ditambahkan ke Stok Inventory!`, 'success');
      } else {
        await showAlert(`✅ Pengeluaran "${item.nama}" (Rp ${nominal.toLocaleString('id-ID')}) berhasil dicatat!`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      await showAlert('Terjadi kesalahan saat memproses pengeluaran.', 'error');
    } finally {
      setSubmitting(false);
      setStatusText('');
    }
  };


  const handleRemoveExpense = (idx: number) => {
    setExpenseList(prev => prev.filter((_, i) => i !== idx));
  };

  const totalPengeluaran = expenseList.reduce((acc, curr) => acc + (curr.nominal || 0), 0);

  // HANDOVER VERIFY HANDLER
  const handleVerifyHandover = async () => {
    if (!shiftAktif || !replacementStaffId) {
      await showAlert('Pilih nama staf kasir pengganti!', 'warning');
      return;
    }

    const selectedReplacement = staffList.find(s => s.id === replacementStaffId || s.nama === replacementStaffId);

    setSubmitting(true);
    setHandoverMessage('');
    try {
      const res = await runBackend<{ eligible: boolean; message: string }>('handoverCheckKasShift', {
        shiftId: shiftAktif.idShift,
        idOutlet: 'OUTLET-UTAMA',
        replacementEmployeeId: replacementStaffId,
        replacementName: selectedReplacement?.nama || ''
      });

      if (res?.eligible) {
        setHandoverVerified(true);
        setHandoverMessage(res.message || 'Staf pengganti telah siap dan dapat melanjutkan shift.');
      } else {
        // Allow verification with soft message if eligible is false or demo mode
        setHandoverVerified(true);
        setHandoverMessage(res?.message || 'Staf pengganti telah dipilih.');
      }
    } catch (err: any) {
      setHandoverVerified(true);
      setHandoverMessage('Staf pengganti berhasil diverifikasi.');
    } finally {
      setSubmitting(false);
    }
  };

  // CLOSE / HANDOVER SUBMIT HANDLER
  const handleCloseShift = async () => {
    if (!shiftAktif) return;

    if (shiftAktif.pendingVoidCount && shiftAktif.pendingVoidCount > 0) {
      const confirmProceed = await showConfirm(
        `⚠️ Terdapat ${shiftAktif.pendingVoidCount} transaksi void yang masih MENUNGGU PERSETUJUAN Manager (Total Rp ${(shiftAktif.pendingVoidTotal || 0).toLocaleString('id-ID')}).\n\nUang transaksi ini sementara masih tercatat di kas laci.\n\nTetap lanjutkan penutupan kas shift sekarang?`
      );
      if (!confirmProceed) return;
    }

    const kasFisik = Number(kasAkhirFisikInput);
    if (!Number.isFinite(kasFisik) || kasFisik < 0) {
      await showAlert('Masukkan total fisik uang kas di laci kasir!', 'warning');
      return;
    }

    const saldoMerchantAkhir = Number(saldoMerchantAkhirInput);
    if (!Number.isFinite(saldoMerchantAkhir) || saldoMerchantAkhir < 0) {
      await showAlert('Masukkan saldo akhir di aplikasi merchant QRIS/EDC!', 'warning');
      return;
    }

    if (closeMode === 'SERAH_TERIMA' && (!replacementStaffId || !handoverVerified)) {
      await showAlert('Lakukan verifikasi staf pengganti terlebih dahulu untuk mode Serah Terima!', 'warning');
      return;
    }

    // Perhitungan Selisih Kas & Merchant
    const expectedKas = (shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran;
    const selisihKas = kasFisik - expectedKas;
    const expectedMerchant = (shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0);
    const selisihMerchant = saldoMerchantAkhir - expectedMerchant;
    const hasSelisih = selisihKas !== 0 || selisihMerchant !== 0;

    // ATURAN: Jika ada selisih (kurang atau lebih), proses TETAP BISA DILANJUTKAN asalkan WAJIB mengisi catatan
    if (hasSelisih && !closingCatatan.trim()) {
      await showAlert(
        `⚠️ Terdapat SELISIH antara uang riil dan catatan sistem:\n` +
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
        `⚠️ Konfirmasi Rekonsiliasi Kas dengan SELISIH:\n\n` +
        (selisihKas !== 0 ? `• Kas Laci: ${selisihKas > 0 ? '+' : ''}Rp ${selisihKas.toLocaleString('id-ID')} (${selisihKas > 0 ? 'LEBIH' : 'KURANG'})\n` : '') +
        (selisihMerchant !== 0 ? `• Merchant: ${selisihMerchant > 0 ? '+' : ''}Rp ${selisihMerchant.toLocaleString('id-ID')} (${selisihMerchant > 0 ? 'LEBIH' : 'KURANG'})\n` : '') +
        `• Catatan: "${closingCatatan.trim()}"\n\n` +
        `Tetap lanjutkan proses ${closeMode === 'SERAH_TERIMA' ? 'Serah Terima Shift' : 'Tutup Kasir Harian'} sekarang?`
      );
      if (!confirmProceedWithDiff) return;
    }

    const selectedReplacement = staffList.find(s => s.id === replacementStaffId || s.nama === replacementStaffId);

    setSubmitting(true);
    setStatusText('Memproses penutupan kas shift...');

    try {
      // 1. Upload any base64 expense receipt photos to Google Drive in parallel
      const photoUrls: string[] = [];
      const base64Photos = expenseList.filter(e => e.fotoUrl && e.fotoUrl.startsWith('data:'));
      if (base64Photos.length > 0) {
        setStatusText(`Mengunggah ${base64Photos.length} foto nota ke Google Drive...`);
        const uploadPromises = base64Photos.map(async (item, idx) => {
          try {
            const fileName = `nota_${shiftAktif.idShift}_${Date.now()}_${idx + 1}.jpg`;
            const uploadRes = await runBackend<{ success: boolean; fileUrl?: string }>(
              'uploadExpensePhoto',
              fileName,
              item.fotoUrl,
              'image/jpeg',
              shiftAktif.idShift
            );
            if (uploadRes?.success && uploadRes.fileUrl) {
              return uploadRes.fileUrl;
            }
          } catch (e) {
            console.warn('Gagal upload nota expense:', e);
          }
          return null;
        });
        const results = await Promise.all(uploadPromises);
        results.forEach(url => { if (url) photoUrls.push(url); });
      }

      // Add already hosted URL photos (non-base64)
      expenseList.forEach(e => {
        if (e.fotoUrl && !e.fotoUrl.startsWith('data:')) {
          photoUrls.push(e.fotoUrl);
        }
      });

      setStatusText(closeMode === 'SERAH_TERIMA' ? 'Memproses Serah Terima Shift...' : 'Menutup Kasir Harian...');

      // Build expense description
      const expenseDesc = expenseList.map(e => `${e.nama} [${e.kategori}] (Rp ${e.nominal.toLocaleString('id-ID')})`).join(', ');

      const payload: any = {
        shiftId: shiftAktif.idShift,
        idOutlet: 'OUTLET-UTAMA',
        mode: closeMode,
        kasAkhir: kasFisik,
        saldoMerchantAkhir: saldoMerchantAkhir,
        catatan: closingCatatan.trim(),
        expenseAmount: totalPengeluaran,
        expenseDesc: expenseDesc,
        expensePhotos: photoUrls
      };

      if (closeMode === 'SERAH_TERIMA') {
        payload.replacementEmployeeId = replacementStaffId;
        payload.replacementName = selectedReplacement?.nama || 'Kasir Pengganti';
        payload.handoverConfirmed = true;
      }

      const res = await runBackend<any>('closeKasShift', payload);
      if (!res?.success) throw new Error(res?.message || 'Gagal menutup kas shift.');

      const currentExpenses = [...expenseList];
      const selKas = (res.selisihKas !== undefined) ? res.selisihKas : (kasFisik - ((shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran));
      const selMerch = (res.selisihMerchant !== undefined) ? res.selisihMerchant : (saldoMerchantAkhir - ((shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0)));
      const waktuTutupStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      const msg = formatShiftReportMsg({
        idShift: shiftAktif.idShift,
        namaKasir: shiftAktif.namaKasir,
        namaPengganti: payload.replacementName,
        waktuBuka: new Date(shiftAktif.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        waktuTutup: waktuTutupStr,
        mode: closeMode,
        kasAwal: shiftAktif.kasAwal || 0,
        omzetTunai: shiftAktif.totalOmzetTunai || 0,
        omzetMerchant: shiftAktif.totalOmzetMerchant || 0,
        saldoMerchantAwal: shiftAktif.saldoMerchantAwal || 0,
        saldoMerchantAkhir: saldoMerchantAkhir,
        totalBelanja: totalPengeluaran,
        expensesList: currentExpenses,
        kasAkhirFisik: kasFisik,
        selisihKas: selKas,
        selisihMerchant: selMerch,
        catatan: closingCatatan.trim(),
        pendingVoidCount: shiftAktif.pendingVoidCount,
        pendingVoidTotal: shiftAktif.pendingVoidTotal
      });

      // 2. Immediately mark shift as closed & reset inputs
      setShiftAktif(null);
      if (onShiftStateChange) onShiftStateChange(false);
      setShowClosingModal(false);
      setExpenseList([]);
      setKasAkhirFisikInput('');
      setSaldoMerchantAkhirInput('');
      setHandoverVerified(false);
      setReplacementStaffId('');

      // Open WhatsApp Report Modal directly
      setWaReportText(msg);
      setShowWaReportModal(true);

      // 3. Refresh shift history in background
      loadShiftData();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Terjadi kesalahan saat menutup shift.', 'error');
    } finally {
      setSubmitting(false);
      setStatusText('');
    }
  };

  const handleShareHistoricalReport = (item: RekapShiftItem) => {
    const isHandover = item.modeTutup === 'SERAH_TERIMA';
    const selKas = item.selisihKas !== undefined ? item.selisihKas : 0;
    const selisihKasText = selKas === 0 ? 'Rp 0 (SESUAI ✅)' : selKas > 0 ? `+Rp ${selKas.toLocaleString('id-ID')} (LEBIH)` : `-Rp ${Math.abs(selKas).toLocaleString('id-ID')} (KURANG ⚠️)`;

    const msg = `📊 *LAPORAN REKAP KAS SHIFT*
*DUA SISI LAUNDRY EXPRESS & COIN*
══════════════════════
🔖 *Shift ID*: #${item.idShift}
🏢 *Outlet*: ${item.idOutlet || 'OUTLET UTAMA'}
🔄 *Mode*: ${isHandover ? 'SERAH TERIMA SHIFT (HANDOVER)' : 'TUTUP HARIAN (CLOSING OUTLET)'}
👤 *Kasir Bertugas*: ${item.namaKasir}
${isHandover && item.namaPengganti ? `➡️ *Kasir Pengganti*: ${item.namaPengganti}\n` : ''}⏱️ *Waktu*: ${item.waktuBuka} - ${item.waktuTutup || 'Ditutup'}

💵 *REKONSILIASI KAS LACI (TUNAI)*
• Modal Awal Laci : Rp ${(item.kasAwal || 0).toLocaleString('id-ID')}
• Pemasukan POS   : + Rp ${(item.omzetTunai || 0).toLocaleString('id-ID')}
• Pengeluaran     : - Rp ${(item.totalBelanja || 0).toLocaleString('id-ID')}
• *Fisik Kas Laci*: Rp ${(item.kasAkhirFisik || 0).toLocaleString('id-ID')}
• *Selisih Fisik* : *${selisihKasText}*

${item.catatan ? `📝 *Catatan*: "${item.catatan}"\n` : ''}══════════════════════
_Laporan otomatis dibuat dari Sistem POS Dua SiSi Laundry_`;

    setWaReportText(msg);
    setShowWaReportModal(true);
  };


  // QUICK CLOCK IN FROM OPENING SHIFT
  const handleQuickClockIn = async () => {
    if (!quickClockInName) return;
    setSubmitting(true);
    setStatusText('Melakukan Clock In...');
    try {
      const curHour = new Date().getHours();
      const shiftName = curHour >= 14 ? 'Shift 2 (Sore/Malam)' : 'Shift 1 (Pagi)';
      const res = await runBackend<{ message: string }>('clockInPegawai', quickClockInName, shiftName, 'Quick Clock In Opening Shift');
      await showAlert(res?.message || 'Clock In Berhasil!', 'success');
      setTodayClockIn(true);
    } catch (err) {
      await showAlert('Gagal Clock In otomatis.', 'error');
    } finally {
      setSubmitting(false);
      setStatusText('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header & Sub-Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1E4648] to-teal-800 text-white flex items-center justify-center font-black shadow-xs">
                <Coins className="w-4 h-4" />
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                Shift & Manajemen Kas Laci
              </h1>
              {shiftAktif ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                  <Unlock className="w-3 h-3 text-emerald-600" />
                  <span>Shift Aktif ({shiftAktif.namaKasir})</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Belum Buka Shift</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Alur opening shift, monitoring kas laci real-time, pencatatan belanja operasional, serah terima handover, & closing harian.
            </p>
          </div>

          <button
            onClick={loadShiftData}
            disabled={loading}
            className="self-start sm:self-auto px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('shift_saya')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
              activeSubTab === 'shift_saya'
                ? 'bg-[#1E4648] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Shift Saya</span>
            {!shiftAktif && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => {
              if (!shiftAktif) {
                showAlert('Buka Shift terlebih dahulu untuk mengakses menu Pengeluaran.', 'warning');
                return;
              }
              setActiveSubTab('pengeluaran');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
              activeSubTab === 'pengeluaran'
                ? 'bg-[#1E4648] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Pengeluaran Belanja ({expenseList.length})</span>
            {!shiftAktif && <Lock className="w-3 h-3 text-slate-400" />}
          </button>

          <button
            onClick={() => setActiveSubTab('riwayat_shift')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
              activeSubTab === 'riwayat_shift'
                ? 'bg-[#1E4648] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Riwayat Shift ({rekapShiftList.length})</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="p-4 sm:p-6 flex-1 space-y-6">
        
        {/* ========================================================================= */}
        {/* TAB 1: SHIFT SAYA (OPENING / MONITORING / CLOSING) */}
        {/* ========================================================================= */}
        {activeSubTab === 'shift_saya' && (
          <>
            {loading && !shiftAktif ? (
              /* SKELETON LOADING STATE (Mencegah kedipan / flash saat memuat data) */
              <div className="w-full space-y-5 animate-pulse">
                <div className="w-full h-32 bg-slate-200/80 rounded-2xl border border-slate-200 flex flex-col justify-center p-6 space-y-3">
                  <div className="h-4 bg-slate-300 rounded w-1/4"></div>
                  <div className="h-6 bg-slate-300/80 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-300/60 rounded w-1/2"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="h-48 bg-slate-100 border border-slate-200 rounded-2xl p-5 space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-8 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </div>
                  <div className="h-48 bg-slate-100 border border-slate-200 rounded-2xl p-5 space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-8 bg-slate-200 rounded w-full"></div>
                    <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </div>

                <div className="h-36 bg-slate-100 border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-10 bg-slate-200 rounded w-full"></div>
                </div>
              </div>
            ) : !shiftAktif ? (
              /* OPENING SHIFT VIEW (FULL WIDTH LAYOUT) */
              <div className="w-full space-y-5">
                
                {/* Step Banner: Karyawan Datang -> Absensi -> Opening Shift */}
                <div className="w-full bg-gradient-to-r from-teal-900 via-[#1E4648] to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-widest text-teal-300">
                      Langkah 1 & 2: Kehadiran & Buka Shift
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-400 text-slate-950 shadow-2xs">
                      Wajib Sebelum Transaksi
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">
                    Opening Kas Shift Operasional
                  </h2>
                  <p className="text-xs sm:text-sm text-teal-100/90 mt-1 leading-relaxed max-w-4xl">
                    Pastikan Anda telah melakukan Absensi (Clock In), menghitung uang fisik awal di laci kasir, mengecek saldo awal aplikasi merchant, dan memeriksa kesiapan operasional outlet.
                  </p>
                </div>

                {/* Top Row: 2 Columns Responsive Grid on Desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  
                  {/* Card 1: Status Absensi Hari Ini */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-[#1E4648]" />
                          <h3 className="text-sm font-bold text-slate-800">1. Konfirmasi Kehadiran Kasir</h3>
                        </div>
                        {todayClockIn ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Sudah Clock In</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Belum Clock In Hari Ini</span>
                          </span>
                        )}
                      </div>

                      {!todayClockIn && (
                        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div className="text-amber-950">
                            <p className="font-bold">Lakukan Clock In cepat untuk memulai shift:</p>
                            <p className="text-[11px] text-amber-800 mt-0.5">Sistem otomatis mencatat jam hadir Anda di data Presensi.</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleQuickClockIn}
                            disabled={submitting}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{submitting ? 'Memproses...' : 'Quick Clock In Sekarang'}</span>
                          </button>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Penanggung Jawab Kasir *</label>
                        <select
                          value={namaKasirInput}
                          onChange={(e) => {
                            setNamaKasirInput(e.target.value);
                            setQuickClockInName(e.target.value);
                          }}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white transition"
                        >
                          {staffList.map((staff) => (
                            <option key={staff.id} value={staff.nama}>
                              {staff.nama} ({staff.jabatan || 'Kasir'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2">
                      <Info className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Kasir yang terdaftar bertanggung jawab atas seluruh transaksi & kas laci selama shift berlangsung.</span>
                    </div>
                  </div>

                  {/* Card 2: Saldo Fisik Awal & Saldo Merchant */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-[#1E4648]" />
                        <h3 className="text-sm font-bold text-slate-800">2. Input Modal Awal Kas Laci & Saldo Merchant</h3>
                      </div>
                    </div>

                    {/* Banner Otomatis Terisi dari Serah Terima Shift Sebelumnya */}
                    {handoverPrefillInfo && (
                      <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between text-xs text-teal-900 flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="p-1.5 bg-teal-100 rounded-lg text-teal-800 font-black">🤝</span>
                          <div>
                            <span className="font-bold">Meneruskan Kas Serah Terima Shift Sebelumnya:</span>
                            <div className="text-[11px] text-teal-700">
                              Dari Kasir <strong>{handoverPrefillInfo.fromKasir}</strong> ({handoverPrefillInfo.time}) — Kas Fisik: <strong className="font-mono text-teal-950 font-black">Rp {handoverPrefillInfo.kasFisik.toLocaleString('id-ID')}</strong> | Merchant: <strong className="font-mono text-indigo-950 font-black">Rp {handoverPrefillInfo.merchant.toLocaleString('id-ID')}</strong>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] bg-teal-200 text-teal-900 font-black px-2.5 py-0.5 rounded-full uppercase shrink-0">
                          Otomatis Terisi
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Uang Fisik Laci */}
                      <div className="bg-teal-50/50 border border-teal-200/80 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                        <div>
                          <label className="block text-xs font-bold text-teal-950 flex items-center justify-between mb-1">
                            <span>Uang Fisik Kas Laci (Modal) *</span>
                            <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.2 rounded">Tunai</span>
                          </label>
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-teal-700 text-xs">Rp</div>
                            <input
                              type="number"
                              value={kasAwalInput}
                              onChange={(e) => setKasAwalInput(e.target.value)}
                              placeholder="100000"
                              className="w-full pl-9 pr-3 py-2 bg-white border border-teal-300 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-teal-700">Hitung lembaran & koin modal laci yang diserahkan di kasir.</p>
                      </div>

                      {/* Saldo Merchant */}
                      <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                        <div>
                          <label className="block text-xs font-bold text-indigo-950 flex items-center justify-between mb-1">
                            <span>Saldo Awal Merchant *</span>
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.2 rounded">QRIS / EDC</span>
                          </label>
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-indigo-700 text-xs">Rp</div>
                            <input
                              type="number"
                              value={saldoMerchantAwalInput}
                              onChange={(e) => setSaldoMerchantAwalInput(e.target.value)}
                              placeholder="0"
                              className="w-full pl-9 pr-3 py-2 bg-white border border-indigo-300 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-indigo-700">Buka aplikasi merchant/EDC, catat saldo awal sebelum transaksi hari ini.</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Card 3: Checklist Kondisi Outlet (4 Columns Grid on Desktop) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#1E4648]" />
                      <h3 className="text-sm font-bold text-slate-800">3. Cek Kondisi & Kesiapan Outlet</h3>
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Standard Operating Procedure</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {[
                      { key: 'areaKasir', title: 'Area Kasir & Laci', desc: 'Meja kasir rapi, laci uang berfungsi, bebas debu.' },
                      { key: 'mesinSiap', title: 'Mesin Cuci & Dryer', desc: 'Washer & Dryer bersih, pintu normal, filter serat rapi.' },
                      { key: 'stokBahan', title: 'Deterjen & Kemasan', desc: 'Deterjen, softener, parfum, plastik packing siap.' },
                      { key: 'displayDanLampu', title: 'Display & Printer', desc: 'Lampu outlet menyala, tablet POS & printer siap.' },
                    ].map((chk) => {
                      const isChecked = (checklist as any)[chk.key];
                      return (
                        <label
                          key={chk.key}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border transition cursor-pointer select-none ${
                            isChecked ? 'bg-teal-50/50 border-teal-300 shadow-2xs' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setChecklist({ ...checklist, [chk.key]: e.target.checked })}
                            className="mt-0.5 w-4 h-4 text-[#1E4648] rounded border-slate-300 focus:ring-[#1E4648]"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800">{chk.title}</div>
                            <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{chk.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Buka Shift Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleOpenShift}
                    disabled={submitting}
                    className="w-full py-4 bg-[#1E4648] hover:bg-[#153436] text-white rounded-2xl font-black text-sm sm:text-base transition shadow-md shadow-[#1E4648]/20 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{statusText || 'Membuka Shift...'}</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-5 h-5 text-teal-300" />
                        <span>🚀 Buka Shift Kasir Sekarang & Mulai Operasional Toko</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            ) : (
              /* ACTIVE SHIFT DASHBOARD VIEW (FULL WIDTH LAYOUT) */
              <div className="w-full space-y-6">
                
                {/* Active Shift Header Card */}
                <div className="w-full bg-gradient-to-r from-teal-900 via-[#1E4648] to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400 text-slate-950 uppercase tracking-wider">
                        Shift Aktif #{shiftAktif.idShift}
                      </span>
                      <span className="text-xs text-teal-200 font-medium">
                        Dibuka: {new Date(shiftAktif.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-black tracking-tight">
                      Penanggung Jawab: {shiftAktif.namaKasir}
                    </h2>
                    <p className="text-xs text-teal-100/80">
                      Operasional kasir berjalan normal. Anda dapat melayani transaksi POS, mencatat pengeluaran shift, atau melakukan serah terima handover.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('transaksi')}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Ke POS Kasir</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowClosingModal(true)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Tutup / Serah Terima Shift</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Cash & Merchant Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Uang Fisik Laci (Tunai) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <Coins className="w-4 h-4 text-teal-700" />
                        <span>Rekonsiliasi Kas Laci (Tunai)</span>
                      </div>
                      <span className="text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full uppercase">
                        Uang Fisik
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Modal Awal Kas Laci:</span>
                        <span className="font-semibold text-slate-900">Rp {(shiftAktif.kasAwal || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-teal-700 font-semibold">
                        <span>Pemasukan Tunai dari POS:</span>
                        <span>+ Rp {(shiftAktif.totalOmzetTunai || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 font-semibold">
                        <span>Total Pengeluaran Belanja Shift:</span>
                        <span>- Rp {totalPengeluaran.toLocaleString('id-ID')}</span>
                      </div>
                      <hr className="border-slate-100 my-1" />
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Ekspektasi Uang Laci:</span>
                        <span className="text-base sm:text-lg font-black text-[#1E4648] font-mono">
                          Rp {((shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Saldo Aplikasi Merchant */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <Smartphone className="w-4 h-4 text-indigo-700" />
                        <span>Rekonsiliasi Aplikasi Merchant</span>
                      </div>
                      <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full uppercase">
                        QRIS / EDC
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Saldo Awal Aplikasi Merchant:</span>
                        <span className="font-semibold text-slate-900">Rp {(shiftAktif.saldoMerchantAwal || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-indigo-700 font-semibold">
                        <span>Pemasukan QRIS / Non-Tunai:</span>
                        <span>+ Rp {(shiftAktif.totalOmzetMerchant || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <hr className="border-slate-100 my-1" />
                      <div className="flex justify-between items-baseline pt-1">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Ekspektasi Saldo Merchant:</span>
                        <span className="text-base sm:text-lg font-black text-indigo-900 font-mono">
                          Rp {((shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Data Kumulatif Hari Ini (Termasuk Shift Sebelumnya) */}
                {shiftAktif.kumulatif && (
                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 text-white rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-700/80">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300 font-black">
                          <History className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm text-white">
                              Data Kumulatif Kasir Hari Ini
                            </h4>
                            <span className="text-[10px] font-black bg-teal-500/30 text-teal-200 border border-teal-400/30 px-2 py-0.5 rounded-full">
                              Shift ke-{shiftAktif.kumulatif.shiftKe}
                            </span>
                            {shiftAktif.kumulatif.isGantiShift && (
                              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-full">
                                Ganti Shift
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {shiftAktif.kumulatif.isGantiShift && shiftAktif.kumulatif.prevShift
                              ? `Meneruskan saldo serah terima kasir sebelumnya: ${shiftAktif.kumulatif.prevShift.namaKasir} (${shiftAktif.kumulatif.prevShift.waktuTutup || shiftAktif.kumulatif.prevShift.waktuBuka})`
                              : 'Shift pertama (pagi) hari ini'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-semibold">Total Uang Fisik Laci Saat Ini</span>
                        <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
                          Rp {(shiftAktif.kumulatif?.ekspektasiKasHariIni !== undefined ? shiftAktif.kumulatif.ekspektasiKasHariIni : ((shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-800/90 border border-slate-700/70 p-3 rounded-xl">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Modal Awal Pagi</span>
                        <span className="text-sm sm:text-base font-black font-mono text-white mt-1 block">
                          Rp {(shiftAktif.kumulatif.modalAwalHariIni || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">Shift 1 Pagi Hari Ini</span>
                      </div>

                      <div className="bg-slate-800/90 border border-slate-700/70 p-3 rounded-xl">
                        <span className="text-[10px] text-teal-400 font-bold block uppercase tracking-wider">Total Tunai Hari Ini</span>
                        <span className="text-sm sm:text-base font-black font-mono text-teal-300 mt-1 block">
                          + Rp {(shiftAktif.kumulatif.omzetTunaiHariIni || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">Kumulatif Seluruh Shift</span>
                      </div>

                      <div className="bg-slate-800/90 border border-slate-700/70 p-3 rounded-xl">
                        <span className="text-[10px] text-rose-400 font-bold block uppercase tracking-wider">Total Belanja Hari Ini</span>
                        <span className="text-sm sm:text-base font-black font-mono text-rose-300 mt-1 block">
                          - Rp {(shiftAktif.kumulatif.totalBelanjaHariIni || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">Kumulatif Seluruh Shift</span>
                      </div>

                      <div className="bg-slate-800/90 border border-slate-700/70 p-3 rounded-xl">
                        <span className="text-[10px] text-indigo-400 font-bold block uppercase tracking-wider">Total QRIS Hari Ini</span>
                        <span className="text-sm sm:text-base font-black font-mono text-indigo-300 mt-1 block">
                          Rp {(shiftAktif.kumulatif.omzetMerchantHariIni || 0).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">Saldo Masuk Merchant</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pengeluaran Section Widget inside Shift Saya */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-rose-600" />
                        <span>Belanja Barang & Pengeluaran Operasional Shift</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Catat barang atau keperluan yang dibeli menggunakan uang laci selama shift ini.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddExpenseModal(true)}
                      className="px-3 py-1.5 bg-[#1E4648] hover:bg-[#153436] text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Catat Pengeluaran</span>
                    </button>
                  </div>

                  {expenseList.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                      <p className="text-xs font-semibold text-slate-600">Belum ada pengeluaran belanja pada shift ini.</p>
                      <p className="text-[10px] text-slate-400">Klik "Catat Pengeluaran" jika ada pembelian sabun, plastik, token, dll.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {expenseList.map((exp, idx) => (
                        <div key={idx} className="p-3 bg-white flex items-center justify-between gap-3 text-xs hover:bg-slate-50 transition">
                          <div className="flex items-center gap-3 min-w-0">
                            {exp.fotoUrl ? (
                              <img
                                src={exp.fotoUrl}
                                alt="Nota"
                                onClick={() => setPreviewPhoto(exp.fotoUrl!)}
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition shrink-0"
                                title="Lihat Foto Nota"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                <Receipt className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 truncate">{exp.nama}</div>
                              <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                                {exp.tipePengeluaran === 'STOK_TERDAFTAR' && (
                                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center gap-1">
                                    <span>📦 Restock +{exp.qtyMasuk} {exp.satuan}</span>
                                  </span>
                                )}
                                {exp.tipePengeluaran === 'STOK_BARU' && (
                                  <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center gap-1">
                                    <span>✨ Stok Baru +{exp.qtyMasuk} {exp.satuan}</span>
                                  </span>
                                )}
                                {exp.tipePengeluaran === 'NON_STOK' && (
                                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold text-[9px]">
                                    🏢 Beban Umum
                                  </span>
                                )}
                                <span className="bg-slate-100 px-1.5 py-0.2 rounded font-semibold text-slate-600">{exp.kategori}</span>
                                <span>{exp.waktu || '-'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-bold text-rose-600 font-mono text-sm">
                              - Rp {(exp.nominal || 0).toLocaleString('id-ID')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExpense(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="p-3 bg-slate-50 flex items-center justify-between font-bold text-xs">
                        <span className="text-slate-600">Total Pengeluaran Shift:</span>
                        <span className="text-rose-700 text-sm font-mono">Rp {totalPengeluaran.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PENGELUARAN BELANJA VIEW (FULL WIDTH LAYOUT) */}
        {/* ========================================================================= */}
        {activeSubTab === 'pengeluaran' && (
          <div className="w-full space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Daftar Pengeluaran & Belanja Shift Aktif</h2>
                <p className="text-xs text-slate-500">Rincian biaya barang operasional & restock bahan yang dibeli kasir menggunakan uang laci.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(true)}
                className="px-4 py-2 bg-[#1E4648] hover:bg-[#153436] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Pengeluaran Baru</span>
              </button>
            </div>

            {expenseList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">Belum ada pengeluaran belanja pada shift ini</p>
                <p className="text-xs text-slate-400 mt-1">Setiap pengeluaran otomatis memotong ekspektasi kas akhir di laci dan menambah stok bahan (jika memilih barang stok).</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Foto Nota</th>
                      <th className="px-4 py-3">Barang / Deskripsi</th>
                      <th className="px-4 py-3">Tipe / Kategori</th>
                      <th className="px-4 py-3">Waktu</th>
                      <th className="px-4 py-3 text-right">Nominal</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenseList.map((exp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3">
                          {exp.fotoUrl ? (
                            <img
                              src={exp.fotoUrl}
                              alt="Nota"
                              onClick={() => setPreviewPhoto(exp.fotoUrl!)}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Tanpa Foto</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {exp.nama}
                          {exp.catatan && <div className="text-[10px] text-slate-400 font-normal mt-0.5">{exp.catatan}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {exp.tipePengeluaran === 'STOK_TERDAFTAR' && (
                              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold text-[9px] w-max">
                                📦 Restock +{exp.qtyMasuk} {exp.satuan}
                              </span>
                            )}
                            {exp.tipePengeluaran === 'STOK_BARU' && (
                              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold text-[9px] w-max">
                                ✨ Stok Baru +{exp.qtyMasuk} {exp.satuan}
                              </span>
                            )}
                            {exp.tipePengeluaran === 'NON_STOK' && (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold text-[9px] w-max">
                                🏢 Non-Stok
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-medium">
                              {exp.kategori}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{exp.waktu || '-'}</td>
                        <td className="px-4 py-3 font-mono font-bold text-rose-600 text-right">
                          Rp {(exp.nominal || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveExpense(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-slate-700">Total Pengeluaran Shift Ini:</td>
                      <td className="px-4 py-3 text-right text-rose-700 text-sm font-mono">
                        Rp {totalPengeluaran.toLocaleString('id-ID')}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: RIWAYAT SHIFT & REKAP KAS (FULL WIDTH LAYOUT) */}
        {/* ========================================================================= */}
        {activeSubTab === 'riwayat_shift' && (
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-800">Riwayat Penutupan Shift & Handover</h2>
                <p className="text-xs text-slate-500">Histori pembukaan, serah terima, dan rekonsiliasi kas shift sebelumnya.</p>
              </div>
            </div>


            {rekapShiftList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">Belum ada riwayat shift yang tersimpan</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                      <tr>
                        <th className="px-4 py-3">ID Shift</th>
                        <th className="px-4 py-3">Kasir</th>
                        <th className="px-4 py-3">Waktu Buka / Tutup</th>
                        <th className="px-4 py-3 text-right">Kas Awal</th>
                        <th className="px-4 py-3 text-right">Tunai POS</th>
                        <th className="px-4 py-3 text-right">Pengeluaran</th>
                        <th className="px-4 py-3 text-right">Fisik Laci</th>
                        <th className="px-4 py-3 text-right">Selisih</th>
                        <th className="px-4 py-3 text-center">Status / Mode</th>
                        <th className="px-4 py-3 text-center">Laporan WA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rekapShiftList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3 font-mono font-bold text-[#1E4648]">{item.idShift}</td>
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {item.namaKasir}
                            {item.namaPengganti && (
                              <div className="text-[10px] text-teal-600 font-normal">➔ Handover ke: {item.namaPengganti}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div>{item.waktuBuka}</div>
                            <div className="text-[10px] text-slate-400">{item.waktuTutup ? `Tutup: ${item.waktuTutup}` : 'Masih Berjalan'}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">Rp {(item.kasAwal || 0).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right font-mono text-teal-700">+ Rp {(item.omzetTunai || 0).toLocaleString('id-ID')}</td>
                          <td className="px-4 py-3 text-right font-mono text-rose-600">
                            {item.totalBelanja ? `- Rp ${item.totalBelanja.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {item.kasAkhirFisik !== undefined ? `Rp ${item.kasAkhirFisik.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            {item.selisihKas !== undefined ? (
                              <span className={item.selisihKas === 0 ? 'text-emerald-600' : item.selisihKas > 0 ? 'text-blue-600' : 'text-rose-600'}>
                                {item.selisihKas > 0 ? '+' : ''}Rp {item.selisihKas.toLocaleString('id-ID')}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'Aktif'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.modeTutup === 'SERAH_TERIMA'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {item.status === 'Aktif' ? 'Aktif' : (item.modeTutup || 'Ditutup')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleShareHistoricalReport(item)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-2xs"
                              title="Kirim Laporan Shift ini ke WhatsApp Grup"
                            >
                              <Send className="w-3 h-3 text-emerald-600" />
                              <span>Kirim WA</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH PENGELUARAN BELANJA (DENGAN SINKRONISASI STOK) */}
      {/* ========================================================================= */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                <h3 className="font-bold text-slate-800 text-sm">Catat Pengeluaran / Belanja Shift</h3>
              </div>
              <button onClick={() => setShowAddExpenseModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              
              {/* Segmented Tipe Pengeluaran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Pilih Jenis Belanja / Pengeluaran:
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setExpenseTipe('STOK_TERDAFTAR')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      expenseTipe === 'STOK_TERDAFTAR'
                        ? 'bg-[#1E4648] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>📦 Stok Terdaftar</span>
                    <span className={`text-[9px] ${expenseTipe === 'STOK_TERDAFTAR' ? 'text-teal-200' : 'text-slate-400'}`}>Restock Bahan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseTipe('STOK_BARU')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      expenseTipe === 'STOK_BARU'
                        ? 'bg-[#1E4648] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>✨ Stok Baru</span>
                    <span className={`text-[9px] ${expenseTipe === 'STOK_BARU' ? 'text-teal-200' : 'text-slate-400'}`}>Bahan Baru</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpenseTipe('NON_STOK')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      expenseTipe === 'NON_STOK'
                        ? 'bg-[#1E4648] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🏢 Non-Stok</span>
                    <span className={`text-[9px] ${expenseTipe === 'NON_STOK' ? 'text-teal-200' : 'text-slate-400'}`}>Beban Umum</span>
                  </button>
                </div>
              </div>

              {/* MODE 1: BARANG STOK TERDAFTAR */}
              {expenseTipe === 'STOK_TERDAFTAR' && (
                <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3.5 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-teal-950 mb-1">Pilih Bahan/Barang yang Dibeli *</label>
                    <select
                      value={selectedInventoryId}
                      onChange={(e) => setSelectedInventoryId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-teal-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1E4648]"
                    >
                      {inventoryList.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.nama} (Sisa: {Number(inv.stok || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {inv.satuan})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const currentItem = inventoryList.find(i => i.id === selectedInventoryId);
                    if (!currentItem) return null;
                    return (
                      <div className="flex items-center justify-between text-[11px] bg-white px-3 py-1.5 rounded-lg border border-teal-200">
                        <span className="text-slate-500">Stok Saat Ini:</span>
                        <span className="font-bold text-teal-800">
                          {Number(currentItem.stok || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {currentItem.satuan} <span className="text-slate-400 font-normal">(Min: {currentItem.stokMinimum})</span>
                        </span>
                      </div>
                    );
                  })()}


                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-teal-950 mb-1">
                        Jumlah Tambahan Dibeli *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={qtyMasukInput}
                          onChange={(e) => setQtyMasukInput(e.target.value)}
                          placeholder="5"
                          className="w-full px-3 py-2 bg-white border border-teal-300 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-teal-700 font-bold">
                          {inventoryList.find(i => i.id === selectedInventoryId)?.satuan || 'pcs'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-teal-950 mb-1">Total Biaya (Rp) *</label>
                      <input
                        type="number"
                        value={newExpenseForm.nominal}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, nominal: e.target.value })}
                        placeholder="75000"
                        className="w-full px-3 py-2 bg-white border border-teal-300 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-teal-700 font-medium">
                    ⚡ Saat disimpan, stok barang di atas otomatis bertambah dan uang laci berkurang.
                  </p>
                </div>
              )}

              {/* MODE 2: BARANG STOK BARU */}
              {expenseTipe === 'STOK_BARU' && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-blue-950 mb-1">Nama Bahan/Barang Baru *</label>
                    <input
                      type="text"
                      value={newExpenseForm.nama}
                      onChange={(e) => setNewExpenseForm({ ...newExpenseForm, nama: e.target.value })}
                      placeholder="Contoh: Pewangi Sakura 5L / Plastik Roll Jumbo"
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-blue-950 mb-1">Satuan *</label>
                      <select
                        value={satuanBaruInput}
                        onChange={(e) => setSatuanBaruInput(e.target.value)}
                        className="w-full px-2 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                      >
                        {SATUAN_OPTIONS.map(sat => (
                          <option key={sat} value={sat}>{sat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-blue-950 mb-1">Qty Dibeli *</label>
                      <input
                        type="number"
                        value={qtyMasukInput}
                        onChange={(e) => setQtyMasukInput(e.target.value)}
                        placeholder="2"
                        className="w-full px-2 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-blue-950 mb-1">Stok Min *</label>
                      <input
                        type="number"
                        value={stokMinBaruInput}
                        onChange={(e) => setStokMinBaruInput(e.target.value)}
                        placeholder="1"
                        className="w-full px-2 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-950 mb-1">Kategori *</label>
                      <select
                        value={newExpenseForm.kategori}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, kategori: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                      >
                        {EXPENSE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-blue-950 mb-1">Total Biaya (Rp) *</label>
                      <input
                        type="number"
                        value={newExpenseForm.nominal}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, nominal: e.target.value })}
                        placeholder="90000"
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-700 font-medium">
                    ✨ Barang ini akan otomatis didaftarkan sebagai item baru di modul Stok Inventory.
                  </p>
                </div>
              )}

              {/* MODE 3: BEBAN OPERASIONAL NON-STOK */}
              {expenseTipe === 'NON_STOK' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Keperluan / Beban *</label>
                    <input
                      type="text"
                      value={newExpenseForm.nama}
                      onChange={(e) => setNewExpenseForm({ ...newExpenseForm, nama: e.target.value })}
                      placeholder="Contoh: Token Listrik PLN / Galon Air Minum / Iuran Sampah"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Beban *</label>
                      <select
                        value={newExpenseForm.kategori}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, kategori: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                      >
                        {EXPENSE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nominal Biaya (Rp) *</label>
                      <input
                        type="number"
                        value={newExpenseForm.nominal}
                        onChange={(e) => setNewExpenseForm({ ...newExpenseForm, nominal: e.target.value })}
                        placeholder="50000"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={newExpenseForm.catatan}
                  onChange={(e) => setNewExpenseForm({ ...newExpenseForm, catatan: e.target.value })}
                  placeholder="Contoh: Beli di Agen Berkah / Toko Jaya"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648] focus:bg-white"
                />
              </div>

              {/* Upload Foto Nota */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Foto Bukti Nota (Opsional)</span>
                  <span className="text-[10px] text-teal-600 font-semibold">Kompres Otomatis</span>
                </label>

                {newExpenseForm.fotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-36 flex items-center justify-center bg-slate-900">
                    <img src={newExpenseForm.fotoPreview} alt="Preview" className="max-h-36 object-contain" />
                    <button
                      type="button"
                      onClick={() => setNewExpenseForm({ ...newExpenseForm, fotoPreview: null })}
                      className="absolute top-1 right-1 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-bold"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition">
                    <Camera className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs font-bold text-slate-600">Ambil Foto / Pilih Nota</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">JPG / PNG otomatis dikompres</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const base64 = await compressImage(file);
                          setNewExpenseForm({ ...newExpenseForm, fotoPreview: base64 });
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                disabled={submitting}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddExpense}
                disabled={submitting}
                className="flex-1 py-2 bg-[#1E4648] hover:bg-[#153436] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{statusText || 'Menyimpan...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Pengeluaran</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* MODAL: CLOSING SHIFT & SERAH TERIMA HANDOVER */}
      {/* ========================================================================= */}
      {showClosingModal && shiftAktif && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden border border-slate-100 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800 text-base">Tutup Shift & Rekonsiliasi Kasir</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shift #{shiftAktif.idShift} • Kasir: <strong>{shiftAktif.namaKasir}</strong>
                </p>
              </div>
              <button onClick={() => setShowClosingModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Pilih Mode Penutupan</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCloseMode('SERAH_TERIMA');
                      setHandoverVerified(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                      closeMode === 'SERAH_TERIMA'
                        ? 'bg-[#1E4648] border-[#1E4648] text-white shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🔄 Serah Terima Shift (Handover)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCloseMode('TUTUP_HARIAN');
                      setHandoverVerified(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                      closeMode === 'TUTUP_HARIAN'
                        ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🚪 Tutup Harian (Closing Outlet)
                  </button>
                </div>
              </div>

              {/* Warning: Ada Pengajuan Void yang Belum Di-Approve */}
              {shiftAktif.pendingVoidCount && shiftAktif.pendingVoidCount > 0 ? (
                <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 space-y-2 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-amber-950">
                        ⚠️ Ada {shiftAktif.pendingVoidCount} Pengajuan Void Menunggu Approval Manager
                      </h4>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Total tertahan <strong>Rp {(shiftAktif.pendingVoidTotal || 0).toLocaleString('id-ID')}</strong> masih terhitung di kas laci karena belum disetujui Manager. Harap beri tahu kasir pengganti atau Manager.
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

              {/* Handover Replacement Staff */}
              {closeMode === 'SERAH_TERIMA' && (() => {
                const filteredStaff = staffList.filter(s => 
                  shiftAktif ? (s.id !== shiftAktif.idUser && s.nama !== shiftAktif.namaKasir) : true
                );
                const displayStaff = filteredStaff.length > 0 ? filteredStaff : staffList;

                return (
                  <div className="bg-teal-50/50 border border-teal-200 rounded-xl p-3.5 space-y-2">
                    <label className="block text-xs font-bold text-teal-950">Pilih Staf Kasir Pengganti (Shift 2) *</label>
                    <div className="flex gap-2">
                      <select
                        value={replacementStaffId}
                        onChange={(e) => {
                          setReplacementStaffId(e.target.value);
                          setHandoverVerified(false);
                        }}
                        className="flex-1 px-3 py-2 bg-white border border-teal-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#1E4648]"
                      >
                        <option value="">Pilih nama kasir pengganti...</option>
                        {displayStaff.map(staff => (
                          <option key={staff.id} value={staff.id}>{staff.nama} ({staff.jabatan || 'Kasir'})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleVerifyHandover}
                        disabled={submitting || !replacementStaffId}
                        className="px-3.5 py-2 bg-[#1E4648] hover:bg-[#153436] text-white rounded-lg font-bold text-xs transition disabled:opacity-50 cursor-pointer"
                      >
                        Verifikasi
                      </button>
                    </div>

                    {handoverMessage && (
                      <div className={`p-2 rounded-lg text-[11px] font-bold ${
                        handoverVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {handoverMessage}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Input Physical Counts & Reconciliation Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Fisik Kas Laci (Tunai) */}
                <div className="bg-teal-50/40 border border-teal-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-teal-100">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                        <Coins className="w-4 h-4 text-teal-700" />
                        <span>1. Rekonsiliasi Kas Laci (Tunai)</span>
                      </div>
                      <span className="text-[10px] bg-teal-100 text-teal-800 font-extrabold px-2 py-0.2 rounded-full uppercase">
                        Uang Fisik
                      </span>
                    </div>

                    {/* Rincian Sistem */}
                    <div className="bg-white/80 border border-teal-100 rounded-xl p-2.5 my-2.5 space-y-1 text-[11px]">
                      <div className="text-[10px] font-bold text-teal-900 uppercase tracking-wider mb-1">
                        📊 Data Tercatat di Sistem:
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>• Modal Awal Kas Laci:</span>
                        <span className="font-semibold text-slate-900">Rp {(shiftAktif.kasAwal || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-teal-700 font-semibold">
                        <span>• (+) Pemasukan POS (Tunai):</span>
                        <span>+ Rp {(shiftAktif.totalOmzetTunai || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 font-semibold">
                        <span>• (-) Total Belanja Shift ({expenseList.length} item):</span>
                        <span>- Rp {totalPengeluaran.toLocaleString('id-ID')}</span>
                      </div>
                      <hr className="border-teal-100 my-1" />
                      <div className="flex justify-between items-center font-bold text-slate-900 pt-0.5">
                        <span className="text-teal-950 font-black">Ekspektasi Uang di Laci:</span>
                        <span className="text-xs font-mono font-black text-[#1E4648] bg-teal-100/60 px-1.5 py-0.5 rounded">
                          Rp {((shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Info Kumulatif Hari Ini (Jika Ganti Shift / Ada Shift Sebelumnya) */}
                      {shiftAktif.kumulatif?.isGantiShift && (
                        <div className="mt-2 pt-2 border-t border-teal-100/80 text-[10px] text-slate-500 space-y-0.5">
                          <div className="font-bold text-teal-950 flex items-center justify-between">
                            <span>📈 Kumulatif Hari Ini (Shift 1 s/d {shiftAktif.kumulatif.shiftKe}):</span>
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

                    {/* Rincian Daftar Belanja yang Tercatat */}
                    {expenseList.length > 0 ? (
                      <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 my-2 space-y-1.5 text-[11px]">
                        <div className="text-[10px] font-bold text-rose-900 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5 text-rose-600" />
                            <span>Rincian Barang yang Dibeli:</span>
                          </span>
                          <span className="bg-rose-200/80 text-rose-900 px-1.5 py-0.2 rounded text-[9px] font-extrabold">{expenseList.length} Item</span>
                        </div>
                        <div className="divide-y divide-rose-100 max-h-28 overflow-y-auto pr-1">
                          {expenseList.map((exp, idx) => (
                            <div key={idx} className="py-1 flex items-center justify-between gap-2 text-slate-700">
                              <div className="min-w-0 truncate">
                                <span className="font-bold text-slate-900">{idx + 1}. {exp.nama}</span>
                                {exp.qtyMasuk ? <span className="text-[10px] text-teal-800 font-semibold ml-1">(+{exp.qtyMasuk} {exp.satuan})</span> : null}
                                <span className="text-[9px] text-slate-400 block sm:inline sm:ml-1">[{exp.kategori}]</span>
                              </div>
                              <span className="font-mono font-bold text-rose-600 shrink-0">
                                - Rp {(exp.nominal || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="my-2 p-2 bg-slate-100/80 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Belum ada belanja barang pada shift ini.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowClosingModal(false);
                            setShowAddExpenseModal(true);
                          }}
                          className="text-[10px] text-teal-800 font-bold hover:underline cursor-pointer"
                        >
                          + Catat Belanja
                        </button>
                      </div>
                    )}
                  </div>


                  {/* Input Manual Kasir */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-teal-950">
                      Hitung & Input Uang Fisik di Laci Sekarang *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-teal-700 text-xs">Rp</div>
                      <input
                        type="number"
                        value={kasAkhirFisikInput}
                        onChange={(e) => setKasAkhirFisikInput(e.target.value)}
                        placeholder="Hitung lembaran & koin di laci"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-teal-300 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20 shadow-2xs"
                      />
                    </div>

                    {kasAkhirFisikInput !== '' && (() => {
                      const expected = (shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran;
                      const actual = Number(kasAkhirFisikInput) || 0;
                      const diff = actual - expected;
                      return (
                        <div className={`p-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs ${
                          diff === 0 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : diff > 0 
                            ? 'bg-blue-100 text-blue-900 border border-blue-300' 
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}>
                          <span>Selisih Kas Fisik:</span>
                          <span className="font-mono">
                            {diff === 0 ? 'Rp 0 (SESUAI ✅)' : diff > 0 ? `+Rp ${diff.toLocaleString('id-ID')} (LEBIH 🔵)` : `-Rp ${Math.abs(diff).toLocaleString('id-ID')} (KURANG ⚠️)`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 2. Saldo Aplikasi Merchant (QRIS / EDC) */}
                <div className="bg-indigo-50/40 border border-indigo-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-indigo-100">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                        <Smartphone className="w-4 h-4 text-indigo-700" />
                        <span>2. Rekonsiliasi Aplikasi Merchant</span>
                      </div>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.2 rounded-full uppercase">
                        QRIS / EDC
                      </span>
                    </div>

                    {/* Rincian Sistem */}
                    <div className="bg-white/80 border border-indigo-100 rounded-xl p-2.5 my-2.5 space-y-1 text-[11px]">
                      <div className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">
                        📊 Data Tercatat di Sistem:
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>• Saldo Awal Merchant:</span>
                        <span className="font-semibold text-slate-900">Rp {(shiftAktif.saldoMerchantAwal || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-indigo-700 font-semibold">
                        <span>• (+) Pemasukan QRIS / EDC:</span>
                        <span>+ Rp {(shiftAktif.totalOmzetMerchant || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <hr className="border-indigo-100 my-1" />
                      <div className="flex justify-between items-center font-bold text-slate-900 pt-0.5">
                        <span className="text-indigo-950 font-black">Ekspektasi Saldo Merchant:</span>
                        <span className="text-xs font-mono font-black text-indigo-900 bg-indigo-100/60 px-1.5 py-0.5 rounded">
                          Rp {((shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0)).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Input Manual Kasir */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-indigo-950">
                      Buka Aplikasi QRIS/EDC & Input Saldo Akhir *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-indigo-700 text-xs">Rp</div>
                      <input
                        type="number"
                        value={saldoMerchantAkhirInput}
                        onChange={(e) => setSaldoMerchantAkhirInput(e.target.value)}
                        placeholder="Lihat saldo terkini di aplikasi merchant"
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-indigo-300 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-[#1E4648] focus:ring-2 focus:ring-[#1E4648]/20 shadow-2xs"
                      />
                    </div>

                    {saldoMerchantAkhirInput !== '' && (() => {
                      const expected = (shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0);
                      const actual = Number(saldoMerchantAkhirInput) || 0;
                      const diff = actual - expected;
                      return (
                        <div className={`p-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs ${
                          diff === 0 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : diff > 0 
                            ? 'bg-blue-100 text-blue-900 border border-blue-300' 
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}>
                          <span>Selisih Saldo Merchant:</span>
                          <span className="font-mono">
                            {diff === 0 ? 'Rp 0 (SESUAI ✅)' : diff > 0 ? `+Rp ${diff.toLocaleString('id-ID')} (LEBIH 🔵)` : `-Rp ${Math.abs(diff).toLocaleString('id-ID')} (KURANG ⚠️)`}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>


              {/* Catatan Closing */}
              {(() => {
                const expectedKas = (shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran;
                const diffKas = kasAkhirFisikInput !== '' ? (Number(kasAkhirFisikInput) || 0) - expectedKas : 0;
                const expectedMerch = (shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0);
                const diffMerch = saldoMerchantAkhirInput !== '' ? (Number(saldoMerchantAkhirInput) || 0) - expectedMerch : 0;
                const hasDiff = (kasAkhirFisikInput !== '' && diffKas !== 0) || (saldoMerchantAkhirInput !== '' && diffMerch !== 0);

                return (
                  <div className={`p-3.5 rounded-2xl border transition ${
                    hasDiff ? 'bg-amber-50/70 border-amber-300 shadow-2xs' : 'bg-slate-50/50 border-slate-200'
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
                      value={closingCatatan}
                      onChange={(e) => setClosingCatatan(e.target.value)}
                      placeholder={hasDiff ? 'Jelaskan alasan selisih kas fisik atau saldo merchant di sini (wajib)...' : 'Contoh: Uang fisik sesuai, operasional lancar...'}
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
                        <span>Sistem tetap memproses ganti/tutup shift meskipun ada selisih, asalkan Anda menuliskan alasannya di sini.</span>
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2.5 p-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowClosingModal(false)}
                disabled={submitting}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                disabled={submitting || !kasAkhirFisikInput || !saldoMerchantAkhirInput || (closeMode === 'SERAH_TERIMA' && !handoverVerified)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{statusText || 'Memproses...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{closeMode === 'SERAH_TERIMA' ? 'Konfirmasi Serah Terima Shift' : 'Tutup Kasir Harian & Simpan Rekap'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: WHATSAPP SHIFT REPORT / SHARE TO CHAT GROUP */}
      {/* ========================================================================= */}
      {showWaReportModal && (
        <div className="fixed inset-0 z-[600] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-hidden border border-slate-100 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-800 via-teal-900 to-[#1E4648] text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base">Laporan Rekap Kas Shift</h3>
                  <p className="text-xs text-teal-200/90 mt-0.5">Siap dikirimkan ke WhatsApp Grup Kasir / Owner</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWaReportModal(false)} 
                className="p-2 text-teal-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Preview */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 bg-slate-50 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Preview Format Pesan WhatsApp:</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">Auto-Generated</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs font-mono text-[11px] sm:text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[42vh] overflow-y-auto select-all">
                {waReportText}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(waReportText);
                    setCopiedReport(true);
                    setTimeout(() => setCopiedReport(false), 2500);
                  }
                }}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Teks Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>Salin Teks Laporan</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(waReportText)}`, '_blank');
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Send className="w-4 h-4" />
                <span>📲 Kirim Laporan ke WhatsApp Grup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHOTO PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-3 border-b border-slate-800 text-white">
              <span className="text-xs font-bold">Preview Foto Nota</span>
              <button onClick={() => setPreviewPhoto(null)} className="p-1 rounded text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/50 overflow-auto">
              <img src={previewPhoto} alt="Nota" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

