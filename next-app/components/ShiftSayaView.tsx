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
  Info
} from 'lucide-react';

import { runBackend } from '@/lib/api';
import { useDialog } from '@/components/DialogProvider';
import { UserRole } from '@/lib/types';

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

export default function ShiftSayaView({
  currentRole,
  initialSubTab = 'shift_saya',
  onNavigateTab,
  onShiftStateChange
}: ShiftSayaViewProps) {
  const { showAlert, showConfirm } = useDialog();

  // Active Sub-Tab
  const [activeSubTab, setActiveSubTab] = useState<'shift_saya' | 'pengeluaran' | 'riwayat_shift'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // Loading States
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');

  // Shift States
  const [shiftAktif, setShiftAktif] = useState<ShiftKasir | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [rekapShiftList, setRekapShiftList] = useState<RekapShiftItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventorySimpleItem[]>([]);

  // Attendance Check State
  const [todayClockIn, setTodayClockIn] = useState<boolean>(true);
  const [quickClockInName, setQuickClockInName] = useState<string>('');

  // OPENING SHIFT FORM STATES
  const [kasAwalInput, setKasAwalInput] = useState<string>('100000');
  const [saldoMerchantAwalInput, setSaldoMerchantAwalInput] = useState<string>('0');
  const [namaKasirInput, setNamaKasirInput] = useState<string>('');
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

  // 1. Fetch Main Shift Data & Inventory
  const loadShiftData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch active shift
      const activeRes = await runBackend<ShiftKasir | null>('getKasShiftAktif', 'OUTLET-UTAMA').catch(() => null);
      if (activeRes && activeRes.idShift) {
        setShiftAktif(activeRes);
        if (onShiftStateChange) onShiftStateChange(true);
      } else {
        setShiftAktif(null);
        if (onShiftStateChange) onShiftStateChange(false);
      }

      // 2. Fetch staff list
      const staffRes = await runBackend<any[]>('getPegawaiList').catch(() => []);
      if (Array.isArray(staffRes)) {
        const activeStaff = staffRes.filter(s => s.status !== 'Resign' && s.status !== 'Nonaktif' && s.status !== 'Non-Aktif');
        setStaffList(activeStaff);
        if (activeStaff[0]?.nama) {
          setNamaKasirInput(prev => prev || activeStaff[0].nama);
          setQuickClockInName(prev => prev || activeStaff[0].nama);
        }
      }

      // 3. Fetch inventory list
      const invRes = await runBackend<InventorySimpleItem[]>('getInventoryList').catch(() => []);
      if (Array.isArray(invRes)) {
        setInventoryList(invRes);
        if (invRes.length > 0) {
          setSelectedInventoryId(prev => prev || invRes[0].id);
        }
      }

      // 4. Check today's clock in status
      const absensiRes = await runBackend<any[]>('getRekapAbsensi').catch(() => []);
      if (Array.isArray(absensiRes) && absensiRes.length > 0) {
        const todayStr = new Date().toLocaleDateString('id-ID');
        const hasInToday = absensiRes.some(r => r.tanggal?.includes(todayStr) || r.clockIn);
        setTodayClockIn(hasInToday);
      }

      // 5. Fetch past shifts
      const rekapRes = await runBackend<RekapShiftItem[]>('getRekapKasShift').catch(() => []);
      if (Array.isArray(rekapRes)) {
        setRekapShiftList(rekapRes.reverse());
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

        const qtyNum = Number(qtyMasukInput);
        if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
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
            return { ...i, stok: (updateRes?.stokBaru !== undefined) ? updateRes.stokBaru : (i.stok + qtyNum) };
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

        const qtyNum = Number(qtyMasukInput);
        if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
          await showAlert('Masukkan jumlah/stok awal barang baru (> 0)!', 'warning');
          setSubmitting(false);
          return;
        }

        const minStokNum = Number(stokMinBaruInput) || 5;
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

    setSubmitting(true);
    setHandoverMessage('');
    try {
      const res = await runBackend<{ eligible: boolean; message: string }>('handoverCheckKasShift', {
        shiftId: shiftAktif.idShift,
        idOutlet: 'OUTLET-UTAMA',
        replacementEmployeeId: replacementStaffId
      });

      if (res?.eligible) {
        setHandoverVerified(true);
        setHandoverMessage(res.message || 'Staf pengganti telah Clock In dan siap serah terima.');
      } else {
        setHandoverVerified(false);
        setHandoverMessage(res?.message || 'Staf pengganti belum Clock In hari ini.');
      }
    } catch (err: any) {
      setHandoverVerified(false);
      setHandoverMessage('Gagal verifikasi staf pengganti.');
    } finally {
      setSubmitting(false);
    }
  };

  // CLOSE / HANDOVER SUBMIT HANDLER
  const handleCloseShift = async () => {
    if (!shiftAktif) return;

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

    const selectedReplacement = staffList.find(s => s.id === replacementStaffId);

    // Build expense description & photos
    const expenseDesc = expenseList.map(e => `${e.nama} [${e.kategori}] (Rp ${e.nominal.toLocaleString('id-ID')})`).join(', ');
    const expensePhotos = expenseList.filter(e => !!e.fotoUrl).map(e => e.fotoUrl!);

    setSubmitting(true);
    setStatusText(closeMode === 'SERAH_TERIMA' ? 'Memproses Serah Terima Shift...' : 'Menutup Kasir Harian...');

    try {
      const payload: any = {
        shiftId: shiftAktif.idShift,
        idOutlet: 'OUTLET-UTAMA',
        mode: closeMode,
        kasAkhir: kasFisik,
        saldoMerchantAkhir: saldoMerchantAkhir,
        catatan: closingCatatan.trim(),
        expenseAmount: totalPengeluaran,
        expenseDesc: expenseDesc,
        expensePhotos: expensePhotos
      };

      if (closeMode === 'SERAH_TERIMA') {
        payload.replacementEmployeeId = replacementStaffId;
        payload.replacementName = selectedReplacement?.nama || 'Kasir Pengganti';
        payload.handoverConfirmed = true;
      }

      const res = await runBackend<any>('closeKasShift', payload);
      if (!res?.success) throw new Error(res?.message || 'Gagal menutup kas shift.');

      setShowClosingModal(false);
      setExpenseList([]);
      setKasAkhirFisikInput('');
      setSaldoMerchantAkhirInput('');
      setHandoverVerified(false);
      setReplacementStaffId('');

      if (closeMode === 'SERAH_TERIMA') {
        await showAlert(
          `✅ Serah Terima Shift Selesai!\nShift #${shiftAktif.idShift} telah ditutup dan diserahkan kepada ${payload.replacementName}.\nSelisih Kas: Rp ${(res.selisihKas || 0).toLocaleString('id-ID')}`,
          'success'
        );
      } else {
        await showAlert(
          `✅ Closing Outlet Harian Selesai!\nTotal Omzet Tunai: Rp ${(shiftAktif.totalOmzetTunai || 0).toLocaleString('id-ID')}\nTotal Pengeluaran: Rp ${totalPengeluaran.toLocaleString('id-ID')}\nKas Akhir Fisik: Rp ${kasFisik.toLocaleString('id-ID')}`,
          'success'
        );
      }

      loadShiftData();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Terjadi kesalahan saat menutup shift.', 'error');
    } finally {
      setSubmitting(false);
      setStatusText('');
    }
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
            {!shiftAktif ? (
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
                          {inv.nama} (Sisa: {inv.stok} {inv.satuan})
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
                          {currentItem.stok} {currentItem.satuan} <span className="text-slate-400 font-normal">(Min: {currentItem.stokMinimum})</span>
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

              {/* Handover Replacement Staff */}
              {closeMode === 'SERAH_TERIMA' && (
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
                      {staffList.filter(s => s.id !== shiftAktif.idUser).map(staff => (
                        <option key={staff.id} value={staff.id}>{staff.nama} ({staff.jabatan || 'Kasir'})</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleVerifyHandover}
                      disabled={submitting || !replacementStaffId}
                      className="px-3.5 py-2 bg-[#1E4648] hover:bg-[#153436] text-white rounded-lg font-bold text-xs transition disabled:opacity-50"
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
              )}

              {/* Input Physical Counts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fisik Kas Laci */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">1. Total Uang Fisik Kas Laci *</span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.2 rounded">Tunai</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Ekspektasi Kas:</span>
                    <span className="font-bold font-mono text-slate-700">
                      Rp {((shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</div>
                    <input
                      type="number"
                      value={kasAkhirFisikInput}
                      onChange={(e) => setKasAkhirFisikInput(e.target.value)}
                      placeholder="Hitung uang di laci"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 outline-none focus:border-[#1E4648]"
                    />
                  </div>
                  {kasAkhirFisikInput && (
                    <div className={`p-1.5 rounded text-[11px] font-bold flex justify-between ${
                      (Number(kasAkhirFisikInput) || 0) === ((shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      <span>Selisih Fisik:</span>
                      <span>
                        Rp {((Number(kasAkhirFisikInput) || 0) - ((shiftAktif.kasAwal || 0) + (shiftAktif.totalOmzetTunai || 0) - totalPengeluaran)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Saldo Merchant */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">2. Saldo Akhir Aplikasi Merchant *</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">QRIS</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Ekspektasi Saldo:</span>
                    <span className="font-bold font-mono text-slate-700">
                      Rp {((shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0)).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</div>
                    <input
                      type="number"
                      value={saldoMerchantAkhirInput}
                      onChange={(e) => setSaldoMerchantAkhirInput(e.target.value)}
                      placeholder="Cek saldo merchant"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 outline-none focus:border-[#1E4648]"
                    />
                  </div>
                  {saldoMerchantAkhirInput && (
                    <div className={`p-1.5 rounded text-[11px] font-bold flex justify-between ${
                      (Number(saldoMerchantAkhirInput) || 0) === ((shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0))
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      <span>Selisih Merchant:</span>
                      <span>
                        Rp {((Number(saldoMerchantAkhirInput) || 0) - ((shiftAktif.saldoMerchantAwal || 0) + (shiftAktif.totalOmzetMerchant || 0))).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Catatan Closing */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan / Keterangan Penutupan</label>
                <input
                  type="text"
                  value={closingCatatan}
                  onChange={(e) => setClosingCatatan(e.target.value)}
                  placeholder="Contoh: Uang fisik sesuai, operasional lancar..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
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
      {/* PHOTO PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-3 border-b border-slate-800 text-white">
              <span className="text-xs font-bold">Preview Foto Nota</span>
              <button onClick={() => setPreviewPhoto(null)} className="p-1 rounded text-slate-400 hover:text-white">
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
