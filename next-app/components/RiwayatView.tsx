'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Printer, Send, Eye, RefreshCw, X, FileText, Plus, ShieldAlert, AlertTriangle, Check, Download, Upload, Calendar, ArrowRight, Coins, Smartphone, CreditCard, Banknote, CheckCircle2, Clock, History, UserCheck, Edit3, Ban, ClipboardList, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Receipt, User } from 'lucide-react';
import { Transaksi } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { maskPhone, eNotaUrl as buildENotaUrl, formatWaPhone, formatFriendlyErrorMessage, formatDateTime, parseIndonesianDateTime } from '@/lib/utils';
import { generateWhatsAppReceiptFromTx } from '@/lib/whatsappUtils';
import { toCSV, downloadCSV, downloadExcel, readSpreadsheetFile } from '@/lib/csvUtils';
import PrinterModal from '@/components/PrinterModal';
import ImportProgressToast from '@/components/ImportProgressToast';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

export default function RiwayatView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert, showConfirm } = useDialog();
  const [filter, setFilter] = useState<'Semua' | 'SelfService' | 'FullService' | 'NonLayanan' | 'PendingVoid'>('Semua');
  const [paymentFilter, setPaymentFilter] = useState<'Semua' | 'Tunai' | 'QRIS' | 'Transfer'>('Semua');
  const [periodePreset, setPeriodePreset] = useState<'all' | 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('all');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [recordedShifts, setRecordedShifts] = useState<any[]>([]);
  const [shiftGroupMode, setShiftGroupMode] = useState<'date' | 'time' | 'kasir'>('date');
  const [search, setSearch] = useState('');
  const [txList, setTxList] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null);

  // Import CSV Toast Progress State
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importProgressText, setImportProgressText] = useState('');
  const [importProgressPercent, setImportProgressPercent] = useState(0);
  const [importIsComplete, setImportIsComplete] = useState(false);
  const [importIsError, setImportIsError] = useState(false);

  // Edit Cashier Name Modal State (Manager Only)
  const [showEditKasirModal, setShowEditKasirModal] = useState(false);
  const [txToEditKasir, setTxToEditKasir] = useState<Transaksi | null>(null);
  const [selectedKasirName, setSelectedKasirName] = useState('');
  const [savingEditKasir, setSavingEditKasir] = useState(false);
  const [staffOptions, setStaffOptions] = useState<string[]>([]);

  // Bluetooth Thermal Printer Modal State
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [txForPrintModal, setTxForPrintModal] = useState<Transaksi | null>(null);

  // State for Void Request Modal (FR-POS-24)
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [txToVoid, setTxToVoid] = useState<Transaksi | null>(null);
  const [alasanVoidInput, setAlasanVoidInput] = useState('');
  const [submittingVoid, setSubmittingVoid] = useState(false);

  // State for DP Settlement Modal (FR-POS-16)
  const [showPelunasanModal, setShowPelunasanModal] = useState(false);
  const [txToLunas, setTxToLunas] = useState<Transaksi | null>(null);
  const [pelunasanNominalInput, setPelunasanNominalInput] = useState('');
  const [pelunasanMetode, setPelunasanMetode] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');

  // State for Manual Transaction Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [manualNoNota, setManualNoNota] = useState('');
  const [manualTanggal, setManualTanggal] = useState('');
  const [manualNama, setManualNama] = useState('');
  const [manualNoHp, setManualNoHp] = useState('');
  const [manualTipe, setManualTipe] = useState<'SelfService' | 'FullService'>('SelfService');
  const [manualLayanan, setManualLayanan] = useState('Layanan Manual / Paket');
  const [manualQty, setManualQty] = useState('1');
  const [manualHarga, setManualHarga] = useState('15000');
  const [manualMetode, setManualMetode] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');
  const [manualStatus, setManualStatus] = useState<'Diterima' | 'Selesai'>('Selesai');
  const [manualPetugas, setManualPetugas] = useState('Kasir');

  const openManualModal = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setManualTanggal(localISOTime);
    setManualNoNota('');
    setManualNama('');
    setManualNoHp('');
    setManualTipe('SelfService');
    setManualLayanan('Cuci + Kering Express');
    setManualQty('1');
    setManualHarga('20000');
    setManualMetode('Tunai');
    setManualStatus('Selesai');
    setManualPetugas('Siti Rahma (Kasir)');
    setShowManualModal(true);
  };

  const handleSaveManualTx = async () => {
    if (!manualNama.trim()) { await showAlert('Nama pelanggan wajib diisi!', 'warning'); return; }
    const hargaNum = Number(manualHarga) || 0;
    const qtyNum = Number(manualQty) || 1;
    const grandTotal = hargaNum * qtyNum;

    if (grandTotal <= 0) { await showAlert('Total nominal transaksi harus lebih dari 0!', 'warning'); return; }

    setSavingManual(true);
    const payload = {
      noNota: manualNoNota.trim() || undefined,
      tanggal: manualTanggal ? new Date(manualTanggal).toISOString() : new Date().toISOString(),
      namaPelanggan: manualNama.trim(),
      noHp: manualNoHp.trim(),
      petugas: manualPetugas,
      tipe: manualTipe,
      status: manualStatus,
      metodeBayar: manualMetode,
      nominalBayar: grandTotal,
      diskon: 0,
      total: grandTotal,
      items: [{ layanan: manualLayanan.trim() || 'Layanan Manual', qty: qtyNum, hargaSatuan: hargaNum }]
    };

    let generatedNota = manualNoNota.trim();

    try {
      const res = await runBackend<{ success: boolean; noNota?: string; message?: string }>('simpanTransaksi', payload);
      if (!res?.success || !res.noNota) throw new Error(res?.message || 'Backend tidak mengembalikan nomor nota.');
      generatedNota = res.noNota;
    } catch (error) {
      console.error(error);
      setSavingManual(false);
      await showAlert(error instanceof Error ? error.message : 'Transaksi manual gagal disimpan.', 'error');
      return;
    }

    setShowManualModal(false);
    setSavingManual(false);
    await showAlert(`Transaksi manual ${generatedNota} berhasil disimpan!`, 'success');
    loadRiwayat();
  };

  const loadRiwayat = async () => {
    setLoading(true);
    try {
      const [txData, activeShiftData, rekapShiftData, pegawaiData] = await Promise.all([
        runBackend<Transaksi[]>('getTransaksiList', 'Semua'),
        runBackend<any>('getKasShiftAktif').catch(() => null),
        runBackend<any[]>('getRekapKasShift').catch(() => []),
        runBackend<any[]>('getPegawaiList').catch(() => []),
      ]);
      setTxList(Array.isArray(txData) ? txData : []);
      setActiveShift(activeShiftData || null);
      setRecordedShifts(Array.isArray(rekapShiftData) ? rekapShiftData : []);
      if (Array.isArray(pegawaiData) && pegawaiData.length > 0) {
        const names = pegawaiData
          .filter((p: any) => p.status !== 'Resign' && p.status !== 'Non-Aktif')
          .map((p: any) => (p.nama || p.name || '').trim())
          .filter(Boolean);
        setStaffOptions(Array.from(new Set(names)));
      }
    } catch (err) {
      console.error('Gagal memuat riwayat:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiwayat();
  }, []);

  const handleAjukanVoid = async () => {
    if (!txToVoid || submittingVoid) return;
    const alasan = alasanVoidInput.trim();
    if (!alasan) { 
      await showAlert('Alasan pembatalan (void) wajib diisi!', 'warning'); 
      return; 
    }

    const noNota = txToVoid.noNota;
    setSubmittingVoid(true);
    // Tutup modal input pengajuan segera agar kasir tidak dapat menekan tombol berulang kali
    setShowVoidModal(false);

    try {
      const result = await runBackend<{ success: boolean; message?: string }>('ajukanVoidTransaksi', noNota, alasan, 'Kasir 1');
      if (result?.success || (result?.message && result.message.toLowerCase().includes('sudah menunggu approval'))) {
        setAlasanVoidInput('');
        setTxToVoid(null);
        clearCache('getTransaksiList');
        clearCache('getKasShiftAktif');
        clearCache('getLaporanRange');
        clearCache('getPendingVoidList');
        await loadRiwayat();
        await showAlert(`Permohonan void nota ${noNota} berhasil dikirim ke Manager/Owner.`, 'success');
      } else {
        throw new Error(result?.message || 'Pengajuan void ditolak backend');
      }
    } catch (error: any) {
      console.error(error);
      const errMsg = error?.message || '';
      if (errMsg.toLowerCase().includes('sudah menunggu approval')) {
        setAlasanVoidInput('');
        setTxToVoid(null);
        clearCache('getTransaksiList');
        clearCache('getKasShiftAktif');
        clearCache('getLaporanRange');
        clearCache('getPendingVoidList');
        await loadRiwayat();
        await showAlert(`Permohonan void nota ${noNota} sudah terkirim dan menunggu approval Manager.`, 'info');
      } else {
        await showAlert(errMsg || 'Gagal mengajukan void. Data transaksi tidak diubah.', 'error');
      }
    } finally {
      setSubmittingVoid(false);
    }
  };

  const handleProsesPelunasan = async () => {
    if (!txToLunas) return;
    const nominal = Number(pelunasanNominalInput) || (txToLunas.sisaTagihan || 0);
    try {
      const result = await runBackend<{ success: boolean; message?: string }>('pelunasanDP', txToLunas.noNota, nominal, pelunasanMetode);
      if (!result?.success) throw new Error(result?.message || 'Pelunasan ditolak backend.');
      await showAlert(`Pelunasan Rp ${(nominal || 0).toLocaleString('id-ID')} untuk nota ${txToLunas.noNota} berhasil!`, 'success');
      setShowPelunasanModal(false);
      loadRiwayat();
    } catch (error) {
      console.error(error);
      await showAlert('Pelunasan gagal dicatat. Silakan coba lagi.', 'error');
    }
  };

  const handleOpenEditKasir = async (tx: Transaksi) => {
    setTxToEditKasir(tx);
    setSelectedKasirName(tx.petugas || '');
    setShowEditKasirModal(true);
    if (staffOptions.length === 0) {
      try {
        const pegData = await runBackend<any[]>('getPegawaiList').catch(() => []);
        if (Array.isArray(pegData) && pegData.length > 0) {
          const names = pegData
            .filter((p: any) => p.status !== 'Resign' && p.status !== 'Non-Aktif')
            .map((p: any) => (p.nama || p.name || '').trim())
            .filter(Boolean);
          setStaffOptions(Array.from(new Set(names)));
        }
      } catch (e) {
        console.error('Gagal memuat daftar kasir:', e);
      }
    }
  };

  const handleSaveKasirEdit = async () => {
    if (!txToEditKasir || savingEditKasir) return;
    const finalKasir = selectedKasirName.trim();
    if (!finalKasir) {
      await showAlert('Silakan pilih nama kasir terlebih dahulu!', 'warning');
      return;
    }
    setSavingEditKasir(true);
    try {
      const res: any = await runBackend('updateKasirTransaksi', txToEditKasir.noNota, finalKasir, 'Manager');
      if (res && res.success === false) {
        await showAlert(res.message || 'Gagal mengubah nama kasir', 'error');
        setSavingEditKasir(false);
        return;
      }
      clearCache('getTransaksiList');
      await showAlert(`Nama kasir untuk nota ${txToEditKasir.noNota} berhasil diubah menjadi "${finalKasir}"!`, 'success');
      setShowEditKasirModal(false);
      if (selectedTx && selectedTx.noNota === txToEditKasir.noNota) {
        setSelectedTx(prev => prev ? { ...prev, petugas: finalKasir } : null);
      }
      loadRiwayat();
    } catch (err: any) {
      console.error(err);
      await showAlert(err.message || 'Terjadi kesalahan saat mengubah nama kasir', 'error');
    } finally {
      setSavingEditKasir(false);
    }
  };

  const handleSendSiapWA = async (tx: Transaksi) => {
    const rawPhone = formatWaPhone(tx.noHp);
    if (!rawPhone) {
      await showAlert('Nomor HP / WhatsApp pelanggan tidak tersedia atau tidak valid.', 'warning');
      return;
    }

    const itemsSummary = (tx.items || []).map(it => `${it.qty}x ${it.layanan}`).join(', ');
    const sisaTagihan = Number(tx.sisaTagihan) || 0;
    const statusBayar = sisaTagihan > 0 ? `Belum Lunas (Sisa: Rp ${sisaTagihan.toLocaleString('id-ID')})` : 'Lunas';

    const nowTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const nowDateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const waktuSelesaiStr = `${nowDateStr}, ${nowTimeStr}`;

    const msg = [
      `*NOTIFIKASI LAUNDRY SIAP DIAMBIL*`,
      `*Dua SiSi Laundry Express & Coin*`,
      ``,
      `Halo Kak *${tx.namaPelanggan || 'Pelanggan'}*,`,
      `Kabar baik! Cucian Anda telah selesai diproses dengan bersih, rapi, dan wangi, serta *SIAP DIAMBIL* di outlet kami.`,
      ``,
      `- No. Nota      : ${tx.noNota}`,
      `- Layanan       : ${itemsSummary || 'Drop Off'}`,
      ...(tx.tanggal ? [`- Waktu Masuk   : ${formatDateTime(tx.tanggal)}`] : []),
      `- Waktu Selesai : ${waktuSelesaiStr}`,
      `- Status Bayar  : ${statusBayar}`,
      ``,
      `*Lokasi Outlet* : Dua SiSi Laundry Express & Coin`,
      `*Jam Buka*      : 07.00 - 23.00 WIB`,
      ``,
      `Silakan datang ke outlet untuk pengambilan cucian. Terima kasih telah mencuci di Dua SiSi Laundry!`
    ].join('\n');

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleWhatsAppStruk = (tx: Transaksi) => {
    const rawPhone = formatWaPhone(tx.noHp);
    const msg = generateWhatsAppReceiptFromTx(tx);

    // Log Activity to Audit Trail
    runBackend(
      'logClientActivity',
      tx.petugas || 'Kasir',
      'Kirim Struk WA',
      tx.noNota,
      '-',
      `No WhatsApp: ${rawPhone || '-'}`,
      `Kirim struk WhatsApp untuk nota ${tx.noNota} ke ${tx.namaPelanggan || 'Pelanggan'}`
    ).catch(() => {});

    const waUrl = rawPhone
      ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handlePrintReceipt = (tx: Transaksi) => {
    setTxForPrintModal(tx);
    setIsPrinterModalOpen(true);
  };

  // Helper Parsing Timestamp (Menggunakan parser tanggal Indonesia yang tangguh)
  const parseTimestamp = (ts: string | Date | undefined | null): Date | null => {
    return parseIndonesianDateTime(ts);
  };

  const isTxInSelectedShift = (txTanggal: string | undefined): boolean => {
    if (selectedShiftId === 'all') return true;
    const txDate = parseTimestamp(txTanggal);
    if (!txDate) return false;

    if (selectedShiftId === 'active') {
      if (!activeShift?.waktuBuka) return true;
      const start = parseTimestamp(activeShift.waktuBuka);
      if (!start) return true;
      return txDate.getTime() >= start.getTime();
    }

    const shift = recordedShifts.find((s) => s.idShift === selectedShiftId);
    if (!shift || !shift.waktuBuka) return true;
    const start = parseTimestamp(shift.waktuBuka);
    const end = shift.waktuTutup ? parseTimestamp(shift.waktuTutup) : null;
    if (!start) return true;
    if (end) {
      return txDate.getTime() >= start.getTime() && txDate.getTime() <= end.getTime();
    }
    return txDate.getTime() >= start.getTime();
  };

  // Helper memproses dan mengurutkan shift tercatat
  const sortedShifts = useMemo(() => {
    return [...recordedShifts].sort((a, b) => {
      const timeA = parseTimestamp(a.waktuBuka)?.getTime() || 0;
      const timeB = parseTimestamp(b.waktuBuka)?.getTime() || 0;
      return timeB - timeA;
    });
  }, [recordedShifts]);

  // Kelompokkan Shift per Tanggal: tanggal terbaru di atas, dalam 1 tanggal diurutkan kronologis (Pagi -> Malam)
  const groupedByDateShifts = useMemo(() => {
    const groups: { dateKey: string; label: string; shifts: any[] }[] = [];
    const dateMap = new Map<string, any[]>();

    for (const s of sortedShifts) {
      const d = parseTimestamp(s.waktuBuka);
      let dateKey = 'Lainnya';
      if (d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateKey = `${y}-${m}-${day}`;
      }
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(s);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();

    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    for (const [dateKey, shifts] of dateMap.entries()) {
      // Urutkan shift dalam 1 hari secara kronologis (Shift 1 pagi -> Shift 2 sore/malam)
      shifts.sort((a, b) => {
        const timeA = parseTimestamp(a.waktuBuka)?.getTime() || 0;
        const timeB = parseTimestamp(b.waktuBuka)?.getTime() || 0;
        return timeA - timeB;
      });

      let label = `📅 ${dateKey} (${shifts.length} Shift)`;
      if (dateKey !== 'Lainnya') {
        const [yStr, mStr, dStr] = dateKey.split('-');
        const dObj = new Date(Number(yStr), Number(mStr) - 1, Number(dStr));
        const dayTime = dObj.getTime();
        const formatted = `${dayNames[dObj.getDay()]}, ${String(dObj.getDate()).padStart(2, '0')} ${monthNames[dObj.getMonth()]} ${dObj.getFullYear()}`;

        if (dayTime === today) {
          label = `📅 Hari Ini · ${formatted} (${shifts.length} Shift)`;
        } else if (dayTime === yesterday) {
          label = `📅 Kemarin · ${formatted} (${shifts.length} Shift)`;
        } else {
          label = `📅 ${formatted} (${shifts.length} Shift)`;
        }
      }

      groups.push({ dateKey, label, shifts });
    }

    return groups;
  }, [sortedShifts]);

  // Kelompokkan Shift per Kasir: urut nama kasir, lalu shift terbaru
  const groupedByKasirShifts = useMemo(() => {
    const kasirMap = new Map<string, any[]>();
    for (const s of sortedShifts) {
      const kasir = (s.namaKasir || 'Kasir').trim();
      if (!kasirMap.has(kasir)) {
        kasirMap.set(kasir, []);
      }
      kasirMap.get(kasir)!.push(s);
    }

    const groups: { kasir: string; label: string; shifts: any[] }[] = [];
    for (const [kasir, shifts] of kasirMap.entries()) {
      groups.push({
        kasir,
        label: `👤 Kasir: ${kasir} (${shifts.length} Shift)`,
        shifts,
      });
    }

    groups.sort((a, b) => a.kasir.localeCompare(b.kasir));
    return groups;
  }, [sortedShifts]);

  // Helper Period Matching
  const isDateInSelectedPeriod = (tglStr: string): boolean => {
    if (periodePreset === 'all') return true;
    if (!tglStr) return false;
    
    const d = parseTimestamp(tglStr);
    if (!d) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const txDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (periodePreset === 'today') {
      return txDay.getTime() === today.getTime();
    }
    if (periodePreset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      return txDay.getTime() === yest.getTime();
    }
    if (periodePreset === 'last7days') {
      const sevenAgo = new Date(today);
      sevenAgo.setDate(sevenAgo.getDate() - 7);
      return txDay >= sevenAgo && txDay <= today;
    }
    if (periodePreset === 'thisMonth') {
      return txDay.getFullYear() === now.getFullYear() && txDay.getMonth() === now.getMonth();
    }
    if (periodePreset === 'lastMonth') {
      const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return txDay.getFullYear() === lastMonthYear && txDay.getMonth() === lastMonth;
    }
    if (periodePreset === 'custom') {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
      }
      if (customStartDate) {
        const start = new Date(customStartDate);
        return d >= start;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return d <= end;
      }
    }
    return true;
  };

  const pendingVoidCount = (txList || []).filter((t) => t?.statusVoid === 'PendingApproval').length;

  const filteredTx = (txList || []).filter((t) => {
    if (!t) return false;
    let matchFilter = true;
    if (filter === 'SelfService') {
      matchFilter = t.tipe === 'SelfService';
    } else if (filter === 'FullService') {
      matchFilter = t.tipe === 'FullService';
    } else if (filter === 'NonLayanan') {
      matchFilter = !t.tipe || t.tipe === '' || t.tipe === 'NonLayanan' || t.tipe === 'Bukan Layanan';
    } else if (filter === 'PendingVoid') {
      matchFilter = t.statusVoid === 'PendingApproval';
    }

    // Jika filter shift spesifik sedang dipilih, abaikan filter preset tanggal agar tidak saling bertabrakan
    const matchPeriod = (filter === 'PendingVoid' || selectedShiftId !== 'all') ? true : isDateInSelectedPeriod(t.tanggal);
    const matchShift = isTxInSelectedShift(t.tanggal);

    const q = (search || '').toLowerCase().trim();
    const matchSearch =
      !q ||
      (t.noNota || '').toLowerCase().includes(q) ||
      (t.namaPelanggan && (t.namaPelanggan || '').toLowerCase().includes(q)) ||
      (t.noHp && (t.noHp || '').includes(q));
    return matchFilter && matchPeriod && matchShift && matchSearch;
  });

  const getTxPaymentCategory = (t: Transaksi): 'Tunai' | 'QRIS' | 'Transfer' => {
    const raw = (t.metodeBayar || 'Tunai').trim().toLowerCase();
    if (raw.includes('tunai') || raw.includes('cash')) return 'Tunai';
    if (raw.includes('qris')) return 'QRIS';
    return 'Transfer';
  };

  const displayedTx = useMemo(() => {
    if (paymentFilter === 'Semua') return filteredTx;
    return filteredTx.filter((t) => getTxPaymentCategory(t) === paymentFilter);
  }, [filteredTx, paymentFilter]);

  // Pagination & Page Size State (Default 25 transactions)
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset to page 1 whenever search, filter, period, shift, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, paymentFilter, periodePreset, customStartDate, customEndDate, selectedShiftId, search, pageSize]);

  const totalItems = displayedTx.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedTx = useMemo(() => {
    if (pageSize === 'all') return displayedTx;
    const start = (safePage - 1) * pageSize;
    return displayedTx.slice(start, start + pageSize);
  }, [displayedTx, safePage, pageSize]);

  const startIndex = totalItems === 0 ? 0 : pageSize === 'all' ? 1 : (safePage - 1) * pageSize + 1;
  const endIndex = pageSize === 'all' ? totalItems : Math.min(safePage * pageSize, totalItems);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (safePage <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (safePage >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
    }
    return pages;
  };

  const getFilterLabel = (f: 'Semua' | 'SelfService' | 'FullService' | 'NonLayanan' | 'PendingVoid') => {
    switch (f) {
      case 'Semua': return 'Semua Tipe';
      case 'SelfService': return 'Self Service';
      case 'FullService': return 'Drop Off';
      case 'NonLayanan': return 'Non-Layanan / Retail';
      case 'PendingVoid': return `Void Pending (${pendingVoidCount})`;
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'No Nota', 'Tanggal', 'Nama Pelanggan', 'No HP', 'Tipe Layanan', 'Total',
      'Metode Bayar', 'Status Pembayaran', 'Status Pengerjaan', 'Kasir', 'Detail Items', 'Catatan'
    ];
    const rows = displayedTx.map(t => [
      t.noNota,
      formatDateTime(t.tanggal),
      t.namaPelanggan,
      t.noHp || '',
      t.tipe || 'SelfService',
      t.total || 0,
      t.metodeBayar || 'Tunai',
      t.statusPembayaran || 'Lunas',
      t.status || 'Selesai',
      t.petugas || 'Kasir',
      (t.items || []).map(i => `${i.layanan} (${i.qty}x)`).join('; '),
      t.catatan || ''
    ]);
    downloadCSV(`riwayat_transaksi_${paymentFilter !== 'Semua' ? paymentFilter.toLowerCase() + '_' : ''}${Date.now()}.csv`, toCSV(headers, rows));
  };

  const handleDownloadTemplateTransaksi = () => {
    const headers = [
      'No Nota', 'Tanggal', 'Nama Pelanggan', 'No HP', 'Tipe Layanan', 'Item / Layanan', 'Qty', 'Harga Satuan', 'Metode Bayar', 'Status Pembayaran', 'Petugas', 'Catatan'
    ];
    const sampleRows = [
      ['LDY-260801-0001', '2026-08-01 10:00', 'Ibu Ratna', '081234567890', 'SelfService', 'Cuci 7,5 Kg', 1, 10000, 'Tunai', 'Lunas', 'Kasir Siti', 'Pembukuan Offline'],
      ['LDY-260801-0002', '2026-08-01 11:30', 'Pak Hendra', '082345678901', 'Drop Off', 'Cuci Kering 7,5 Kg', 2, 18000, 'QRIS', 'Lunas', 'Kasir Siti', 'Titip selesai sore']
    ];
    downloadExcel('template_import_transaksi_offline.xlsx', headers, sampleRows, 'Template Transaksi');
  };

  const handleImportTransaksiCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const currentFileName = file.name;
    e.target.value = '';
    try {
      setIsImporting(true);
      setImportFileName(currentFileName);
      setImportProgressPercent(15);
      setImportProgressText('Membaca berkas Excel/CSV transaksi...');
      setImportIsComplete(false);
      setImportIsError(false);

      const rows = await readSpreadsheetFile(file);
      if (rows.length === 0) {
        setImportIsError(true);
        setImportProgressText('Berkas Excel/CSV kosong atau format tidak sesuai.');
        await showAlert('Berkas Excel/CSV kosong atau format tidak sesuai.', 'warning');
        setTimeout(() => setIsImporting(false), 3000);
        return;
      }

      setImportProgressPercent(45);
      setImportProgressText(`Menyimpan ${rows.length} transaksi ke database...`);

      const res = await runBackend<{ success: boolean; importedCount: number; failedCount: number; errors?: string[]; message?: string }>(
        'importTransaksiBatch',
        rows
      );
      if (!res?.success) throw new Error(res?.message || 'Gagal memproses import transaksi');

      setImportProgressPercent(90);
      setImportProgressText('Memperbarui data riwayat...');
      clearCache('getTransaksiList');
      clearCache('getLaporanRange');
      await loadRiwayat();

      setImportProgressPercent(100);
      setImportIsComplete(true);
      setImportProgressText(`Selesai! ${res.importedCount} transaksi berhasil dimasukkan.`);

      setTimeout(() => {
        setIsImporting(false);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      const friendly = formatFriendlyErrorMessage(err);
      setImportIsError(true);
      setImportProgressText(`Gagal: ${friendly.title}`);
      await showAlert(friendly.detail, 'error', friendly.title, friendly.suggestion);
      setTimeout(() => setIsImporting(false), 4000);
    }
  };

  const nonVoidFilteredTx = (filteredTx || []).filter(t => 
    t && 
    t.status !== 'Void' && 
    t.status !== 'Batal' && 
    t.statusVoid !== 'Approved'
  );

  const totalRealDiterima = nonVoidFilteredTx.reduce((sum, t) => {
    const paid = (t.sisaTagihan && t.sisaTagihan > 0) 
      ? Math.max(0, (t.total || 0) - t.sisaTagihan) 
      : (t.total || 0);
    return sum + paid;
  }, 0);

  const paymentMethodStats = useMemo(() => {
    let tunaiNominal = 0;
    let tunaiCount = 0;
    let qrisNominal = 0;
    let qrisCount = 0;
    let transferNominal = 0;
    let transferCount = 0;

    nonVoidFilteredTx.forEach((t) => {
      const cat = getTxPaymentCategory(t);
      const paid = (t.sisaTagihan && t.sisaTagihan > 0)
        ? Math.max(0, (t.total || 0) - t.sisaTagihan)
        : (t.total || 0);

      if (cat === 'Tunai') {
        tunaiNominal += paid;
        tunaiCount += 1;
      } else if (cat === 'QRIS') {
        qrisNominal += paid;
        qrisCount += 1;
      } else {
        transferNominal += paid;
        transferCount += 1;
      }
    });

    return {
      tunaiNominal,
      tunaiCount,
      qrisNominal,
      qrisCount,
      transferNominal,
      transferCount,
    };
  }, [nonVoidFilteredTx]);

  const methodBreakdown = nonVoidFilteredTx.reduce((acc, t) => {
    const rawMethod = (t.metodeBayar || 'Tunai').trim();
    const paid = (t.sisaTagihan && t.sisaTagihan > 0) 
      ? Math.max(0, (t.total || 0) - t.sisaTagihan) 
      : (t.total || 0);
    acc[rawMethod] = (acc[rawMethod] || 0) + paid;
    return acc;
  }, {} as Record<string, number>);

  const totalVoidNominal = (filteredTx || [])
    .filter(t => t && (t.status === 'Void' || t.status === 'Batal' || t.statusVoid === 'Approved'))
    .reduce((sum, t) => sum + (t.total || 0), 0);

  const voidCountInFilter = (filteredTx || [])
    .filter(t => t && (t.status === 'Void' || t.status === 'Batal' || t.statusVoid === 'Approved')).length;

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      
      {/* Top Banner Alert for Pending Void */}
      {pendingVoidCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-pop-scale">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 font-bold shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-xs text-rose-950">
                  Ada {pendingVoidCount} Transaksi Menunggu Persetujuan Void (Batal)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white shadow-xs animate-pulse">
                  {pendingVoidCount} Pending
                </span>
              </div>
              <p className="text-[11px] text-rose-800 mt-0.5">
                {currentRole === 'MANAGER'
                  ? 'Klik tombol di samping untuk meninjau dan menyetujui / menolak permohonan void kasir.'
                  : 'Permohonan void kasir sedang dalam antrean review persetujuan oleh Manager.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilter(filter === 'PendingVoid' ? 'Semua' : 'PendingVoid')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-xs ${
              filter === 'PendingVoid'
                ? 'bg-slate-800 hover:bg-slate-900 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {filter === 'PendingVoid' ? 'Tampilkan Semua Transaksi' : `Filter ${pendingVoidCount} Nota Void`}
          </button>
        </div>
      )}

      {/* Header Filters & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        
        {/* Top Row: Type Tabs + Search + Action Buttons */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5 flex-wrap">
            {(['Semua', 'SelfService', 'FullService', 'NonLayanan'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filter === f
                    ? 'bg-[#1E4648] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {getFilterLabel(f)}
              </button>
            ))}

            {pendingVoidCount > 0 && (
              <button
                onClick={() => setFilter('PendingVoid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  filter === 'PendingVoid'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Void Pending</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                  filter === 'PendingVoid' ? 'bg-white text-rose-700' : 'bg-rose-600 text-white'
                }`}>
                  {pendingVoidCount}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari no nota, nama pelanggan, no HP..."
                className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#1E4648] bg-slate-50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Export & Import Buttons for Offline Bookkeeping */}
            {currentRole === 'MANAGER' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 px-3 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-2xs"
                  title="Export Transaksi ke CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                <button 
                  onClick={handleDownloadTemplateTransaksi}
                  className="px-2.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                  title="Download Template Excel (.xlsx) Pembukuan Offline"
                >
                  Template Excel
                </button>

                <label 
                  className="cursor-pointer flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-[#1E4648] hover:text-white text-slate-700 font-bold rounded-xl text-xs transition shadow-2xs"
                  title="Import Transaksi dari Berkas Excel (.xlsx, .xls) atau CSV"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportTransaksiCSV} />
                </label>

                <button
                  onClick={openManualModal}
                  className="bg-[#1E4648] hover:bg-[#163536] text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition shadow-sm"
                  title="Input Transaksi Manual"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Transaksi Manual</span>
                </button>
              </div>
            )}

            <button
              onClick={loadRiwayat}
              className="p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition shrink-0"
              title="Segarkan Riwayat"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Row: Periodic Date Filters (Hari ini, Kemarin, 7 Hari, Bulan ini, Custom) */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs font-bold">
          <div className="flex items-center gap-1 text-slate-400 uppercase text-[10px] tracking-wider shrink-0 mr-1">
            <Calendar className="w-3.5 h-3.5 text-[#1E4648]" /> Periode:
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80 flex-wrap">
            {[
              { id: 'all', label: 'Semua Tanggal' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: 'last7days', label: '7 Hari Terakhir' },
              { id: 'thisMonth', label: 'Bulan Ini' },
              { id: 'lastMonth', label: 'Bulan Lalu' },
              { id: 'custom', label: 'Custom Range' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodePreset(p.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs transition ${
                  periodePreset === p.id 
                    ? 'bg-[#1E4648] text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {periodePreset === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
            </div>
          )}

          <div className="ml-auto text-[11px] text-slate-400 font-semibold flex items-center gap-2 flex-wrap">
            <span>
              Menampilkan <strong>{totalItems === 0 ? 0 : `${startIndex}–${endIndex}`}</strong> dari <strong>{displayedTx.length}</strong>{paymentFilter !== 'Semua' ? ` (${paymentFilter === 'Transfer' ? 'Transfer & EDC' : paymentFilter})` : ''} transaksi (<strong>{nonVoidFilteredTx.length}</strong> valid)
            </span>
            {paymentFilter !== 'Semua' && (
              <button
                type="button"
                onClick={() => setPaymentFilter('Semua')}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold underline flex items-center gap-0.5 cursor-pointer ml-1"
                title="Tampilkan semua metode pembayaran"
              >
                <X className="w-3 h-3" /> Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Shift Filter: Semua Shift | Shift Aktif | Shift Tercatat */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs">
          <div className="flex items-center gap-1 text-slate-500 font-bold uppercase text-[10px] tracking-wider shrink-0 mr-1">
            <Clock className="w-3.5 h-3.5 text-[#1E4648]" /> Filter Shift:
          </div>

          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {/* Button: Semua Shift */}
            <button
              type="button"
              onClick={() => setSelectedShiftId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedShiftId === 'all'
                  ? 'bg-[#1E4648] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <span>Semua Shift</span>
            </button>

            {/* Button: Shift Sedang Aktif */}
            {activeShift && (
              <button
                type="button"
                onClick={() => setSelectedShiftId('active')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  selectedShiftId === 'active'
                    ? 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-500/30'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                }`}
                title={`Shift aktif: ${activeShift.namaKasir}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>Shift Aktif ({activeShift.namaKasir})</span>
              </button>
            )}

            {/* Select Dropdown: Shift Tercatat (Selesai/Tutup) dengan Pengelompokan & Urutan Waktu */}
            {recordedShifts.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="relative flex items-center">
                  <select
                    value={selectedShiftId !== 'all' && selectedShiftId !== 'active' ? selectedShiftId : ''}
                    onChange={(e) => {
                      if (e.target.value) setSelectedShiftId(e.target.value);
                      else setSelectedShiftId('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border outline-none transition cursor-pointer max-w-full sm:max-w-md ${
                      selectedShiftId !== 'all' && selectedShiftId !== 'active'
                        ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <option value="" className="text-slate-800 bg-white font-bold">
                      {shiftGroupMode === 'date'
                        ? `📅 Riwayat Shift Tercatat (${recordedShifts.length} Shift · Per Tanggal)...`
                        : shiftGroupMode === 'time'
                        ? `⏱️ Riwayat Shift Tercatat (${recordedShifts.length} Shift · Urutan Waktu)...`
                        : `👤 Riwayat Shift Tercatat (${recordedShifts.length} Shift · Per Kasir)...`}
                    </option>

                    {/* Mode 1: Pengelompokan per Tanggal & Urutan Kronologis Shift (Pagi -> Malam) */}
                    {shiftGroupMode === 'date' &&
                      groupedByDateShifts.map((group) => (
                        <optgroup
                          key={group.dateKey}
                          label={group.label}
                          className="font-bold text-slate-900 bg-slate-100"
                        >
                          {group.shifts.map((s, idx) => {
                            const start = formatDateTime(s.waktuBuka, { timeOnly: true });
                            const end = s.waktuTutup ? formatDateTime(s.waktuTutup, { timeOnly: true }) : 'Berjalan';
                            const shiftNum = group.shifts.length > 1 ? `Shift ${idx + 1} ` : '';
                            const dateShort = formatDateTime(s.waktuBuka, { dateOnly: true });
                            const shortId = s.idShift ? `[#${s.idShift.replace(/^(SHIFT-|KAS-)/i, '')}]` : '';
                            return (
                              <option key={s.idShift} value={s.idShift} className="text-slate-800 bg-white font-normal">
                                {`${shiftNum}(${start} - ${end}) · ${s.namaKasir} · ${dateShort} ${shortId}`.trim()}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}

                    {/* Mode 2: Urutan Waktu Kronologis Murni (Terbaru -> Terlama) */}
                    {shiftGroupMode === 'time' &&
                      sortedShifts.map((s) => {
                        const dateStr = formatDateTime(s.waktuBuka, { dateOnly: true });
                        const start = formatDateTime(s.waktuBuka, { timeOnly: true });
                        const end = s.waktuTutup ? formatDateTime(s.waktuTutup, { timeOnly: true }) : 'Berjalan';
                        const shortId = s.idShift ? `[#${s.idShift.replace(/^(SHIFT-|KAS-)/i, '')}]` : '';
                        return (
                          <option key={s.idShift} value={s.idShift} className="text-slate-800 bg-white font-normal">
                            {`${dateStr} · ${start} - ${end} · ${s.namaKasir} ${shortId}`.trim()}
                          </option>
                        );
                      })}

                    {/* Mode 3: Pengelompokan per Kasir */}
                    {shiftGroupMode === 'kasir' &&
                      groupedByKasirShifts.map((group) => (
                        <optgroup
                          key={group.kasir}
                          label={group.label}
                          className="font-bold text-slate-900 bg-slate-100"
                        >
                          {group.shifts.map((s) => {
                            const dateStr = formatDateTime(s.waktuBuka, { dateOnly: true });
                            const start = formatDateTime(s.waktuBuka, { timeOnly: true });
                            const end = s.waktuTutup ? formatDateTime(s.waktuTutup, { timeOnly: true }) : 'Berjalan';
                            const shortId = s.idShift ? `[#${s.idShift.replace(/^(SHIFT-|KAS-)/i, '')}]` : '';
                            return (
                              <option key={s.idShift} value={s.idShift} className="text-slate-800 bg-white font-normal">
                                {`${dateStr} (${start} - ${end}) · ${s.namaKasir} ${shortId}`.trim()}
                              </option>
                            );
                          })}
                        </optgroup>
                      ))}
                  </select>
                </div>

                {/* Mode Selector Pill: Per Tanggal | Urutan Waktu | Per Kasir */}
                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[10px] font-bold text-slate-600 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShiftGroupMode('date')}
                    className={`px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      shiftGroupMode === 'date'
                        ? 'bg-white text-[#1E4648] shadow-2xs font-extrabold'
                        : 'hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title="Kelompokkan Shift per Tanggal & Urutan Shift (Pagi -> Malam)"
                  >
                    <Calendar className="w-3 h-3" />
                    <span className="hidden sm:inline">Per Tanggal</span>
                    <span className="sm:hidden">Tanggal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftGroupMode('time')}
                    className={`px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      shiftGroupMode === 'time'
                        ? 'bg-white text-[#1E4648] shadow-2xs font-extrabold'
                        : 'hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title="Urutan Waktu Terbaru (Kronologis)"
                  >
                    <Clock className="w-3 h-3" />
                    <span className="hidden sm:inline">Urutan Waktu</span>
                    <span className="sm:hidden">Waktu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftGroupMode('kasir')}
                    className={`px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                      shiftGroupMode === 'kasir'
                        ? 'bg-white text-[#1E4648] shadow-2xs font-extrabold'
                        : 'hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                    title="Kelompokkan Shift per Kasir"
                  >
                    <UserCheck className="w-3 h-3" />
                    <span className="hidden sm:inline">Per Kasir</span>
                    <span className="sm:hidden">Kasir</span>
                  </button>
                </div>
              </div>
            )}

            {/* Reset Filter Button */}
            {selectedShiftId !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedShiftId('all')}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Reset Shift</span>
              </button>
            )}
          </div>

          {selectedShiftId !== 'all' && (
            <div className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
              <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>
                {selectedShiftId === 'active'
                  ? `Shift Aktif: ${activeShift?.namaKasir || 'Kasir'}`
                  : (() => {
                      const s = recordedShifts.find((item) => item.idShift === selectedShiftId);
                      if (!s) return `Shift: ${selectedShiftId}`;
                      const dateStr = formatDateTime(s.waktuBuka, { dateOnly: true });
                      const start = formatDateTime(s.waktuBuka, { timeOnly: true });
                      const end = s.waktuTutup ? formatDateTime(s.waktuTutup, { timeOnly: true }) : 'Berjalan';
                      return `Shift: ${s.namaKasir} (${dateStr}, ${start} - ${end})`;
                    })()}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Summary Cards: Uang Riil Diterima & Rincian per Metode Pembayaran (Non-Void) - Klik untuk Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Riil Uang Diterima (Bersih Non-Void) -> Filter: Semua */}
        <button
          type="button"
          onClick={() => setPaymentFilter('Semua')}
          title="Klik untuk melihat SEMUA transaksi (Reset Filter)"
          className={`rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between text-left transition-all duration-200 cursor-pointer select-none group relative overflow-hidden ${
            paymentFilter === 'Semua'
              ? 'bg-gradient-to-br from-[#042f2e] to-[#115e59] border-2 border-emerald-400 ring-4 ring-emerald-400/20 shadow-md'
              : 'bg-gradient-to-br from-[#042f2e]/90 to-[#115e59]/90 border border-teal-600/30 opacity-85 hover:opacity-100 hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-300" />
              <span>Total Uang Riil Diterima</span>
            </span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border flex items-center gap-1 transition ${
              paymentFilter === 'Semua'
                ? 'bg-emerald-400 text-[#042f2e] border-emerald-300 shadow-2xs font-extrabold'
                : 'bg-emerald-500/30 text-emerald-200 border-emerald-400/30 group-hover:bg-emerald-400 group-hover:text-[#042f2e]'
            }`}>
              <Check className="w-2.5 h-2.5" />
              {paymentFilter === 'Semua' ? 'SEMUA AKTIF' : 'RESET KE SEMUA'}
            </span>
          </div>
          <div className="my-2.5 w-full">
            <div className="text-2xl font-black font-mono tracking-tight text-white">
              Rp {totalRealDiterima.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-teal-200/90 mt-0.5 flex items-center justify-between">
              <span>Bersih dari <strong>{nonVoidFilteredTx.length}</strong> transaksi valid</span>
              {paymentFilter !== 'Semua' && (
                <span className="text-[10px] font-bold text-emerald-300 underline group-hover:text-emerald-200">
                  Tampilkan Semua
                </span>
              )}
            </div>
          </div>
          {voidCountInFilter > 0 ? (
            <div className="text-[10px] text-rose-200 bg-rose-950/40 border border-rose-500/30 px-2 py-1 rounded-xl flex items-center justify-between w-full">
              <span className="flex items-center gap-1">
                <Ban className="w-3 h-3 text-rose-400" />
                {voidCountInFilter} Nota Void Diabaikan:
              </span>
              <span className="font-mono font-bold">-Rp {totalVoidNominal.toLocaleString('id-ID')}</span>
            </div>
          ) : (
            <div className="text-[10px] text-teal-300/80 flex items-center gap-1 w-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Semua transaksi pada filter ini berstatus aktif/valid</span>
            </div>
          )}
        </button>

        {/* Card 2: Pemasukan Kas Tunai -> Filter: Tunai */}
        <button
          type="button"
          onClick={() => setPaymentFilter(prev => prev === 'Tunai' ? 'Semua' : 'Tunai')}
          title="Klik untuk memfilter hanya transaksi Tunai (Kas Laci)"
          className={`rounded-2xl p-4 text-left flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group relative overflow-hidden ${
            paymentFilter === 'Tunai'
              ? 'bg-emerald-50/70 border-2 border-emerald-500 ring-4 ring-emerald-500/20 shadow-md scale-[1.01]'
              : 'bg-white border border-slate-200 shadow-xs hover:border-emerald-300 hover:bg-emerald-50/25 hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              paymentFilter === 'Tunai' ? 'text-emerald-800' : 'text-slate-500 group-hover:text-emerald-700'
            }`}>
              <Coins className={`w-4 h-4 ${paymentFilter === 'Tunai' ? 'text-emerald-600' : 'text-emerald-600 group-hover:scale-110 transition-transform'}`} />
              <span>Tunai (Kas Laci)</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition flex items-center gap-1 ${
              paymentFilter === 'Tunai'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-extrabold'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 group-hover:border-emerald-300'
            }`}>
              {paymentFilter === 'Tunai' && <Check className="w-2.5 h-2.5" />}
              {paymentFilter === 'Tunai' ? 'Filter Aktif' : 'Fisik Laci'}
            </span>
          </div>
          <div className="my-2 w-full">
            <div className="text-xl font-black font-mono text-slate-900 flex items-baseline justify-between">
              <span>Rp {paymentMethodStats.tunaiNominal.toLocaleString('id-ID')}</span>
              <span className="text-[11px] font-bold font-sans text-slate-400">
                {paymentMethodStats.tunaiCount} nota
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>
                {totalRealDiterima > 0 ? Math.round((paymentMethodStats.tunaiNominal / totalRealDiterima) * 100) : 0}% dari total uang masuk
              </span>
              {paymentFilter === 'Tunai' && (
                <span className="text-[10px] font-bold text-emerald-700 underline">Lepas filter</span>
              )}
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
              style={{ width: `${totalRealDiterima > 0 ? ((paymentMethodStats.tunaiNominal / totalRealDiterima) * 100) : 0}%` }}
            />
          </div>
        </button>

        {/* Card 3: Pemasukan QRIS Digital -> Filter: QRIS */}
        <button
          type="button"
          onClick={() => setPaymentFilter(prev => prev === 'QRIS' ? 'Semua' : 'QRIS')}
          title="Klik untuk memfilter hanya transaksi QRIS Digital"
          className={`rounded-2xl p-4 text-left flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group relative overflow-hidden ${
            paymentFilter === 'QRIS'
              ? 'bg-indigo-50/70 border-2 border-indigo-500 ring-4 ring-indigo-500/20 shadow-md scale-[1.01]'
              : 'bg-white border border-slate-200 shadow-xs hover:border-indigo-300 hover:bg-indigo-50/25 hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              paymentFilter === 'QRIS' ? 'text-indigo-800' : 'text-slate-500 group-hover:text-indigo-700'
            }`}>
              <Smartphone className={`w-4 h-4 ${paymentFilter === 'QRIS' ? 'text-indigo-600' : 'text-indigo-600 group-hover:scale-110 transition-transform'}`} />
              <span>QRIS Digital</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition flex items-center gap-1 ${
              paymentFilter === 'QRIS'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-extrabold'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 group-hover:border-indigo-300'
            }`}>
              {paymentFilter === 'QRIS' && <Check className="w-2.5 h-2.5" />}
              {paymentFilter === 'QRIS' ? 'Filter Aktif' : 'Merchant QRIS'}
            </span>
          </div>
          <div className="my-2 w-full">
            <div className="text-xl font-black font-mono text-slate-900 flex items-baseline justify-between">
              <span>Rp {paymentMethodStats.qrisNominal.toLocaleString('id-ID')}</span>
              <span className="text-[11px] font-bold font-sans text-slate-400">
                {paymentMethodStats.qrisCount} nota
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>
                {totalRealDiterima > 0 ? Math.round((paymentMethodStats.qrisNominal / totalRealDiterima) * 100) : 0}% dari total uang masuk
              </span>
              {paymentFilter === 'QRIS' && (
                <span className="text-[10px] font-bold text-indigo-700 underline">Lepas filter</span>
              )}
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
              style={{ width: `${totalRealDiterima > 0 ? ((paymentMethodStats.qrisNominal / totalRealDiterima) * 100) : 0}%` }}
            />
          </div>
        </button>

        {/* Card 4: Transfer Bank / EDC / Non-Tunai Lainnya -> Filter: Transfer */}
        <button
          type="button"
          onClick={() => setPaymentFilter(prev => prev === 'Transfer' ? 'Semua' : 'Transfer')}
          title="Klik untuk memfilter hanya transaksi Transfer Bank & EDC"
          className={`rounded-2xl p-4 text-left flex flex-col justify-between transition-all duration-200 cursor-pointer select-none group relative overflow-hidden ${
            paymentFilter === 'Transfer'
              ? 'bg-sky-50/70 border-2 border-sky-500 ring-4 ring-sky-500/20 shadow-md scale-[1.01]'
              : 'bg-white border border-slate-200 shadow-xs hover:border-sky-300 hover:bg-sky-50/25 hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              paymentFilter === 'Transfer' ? 'text-sky-800' : 'text-slate-500 group-hover:text-sky-700'
            }`}>
              <CreditCard className={`w-4 h-4 ${paymentFilter === 'Transfer' ? 'text-sky-600' : 'text-sky-600 group-hover:scale-110 transition-transform'}`} />
              <span>Transfer & EDC</span>
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border transition flex items-center gap-1 ${
              paymentFilter === 'Transfer'
                ? 'bg-sky-600 text-white border-sky-600 shadow-2xs font-extrabold'
                : 'bg-sky-50 text-sky-700 border-sky-200 group-hover:border-sky-300'
            }`}>
              {paymentFilter === 'Transfer' && <Check className="w-2.5 h-2.5" />}
              {paymentFilter === 'Transfer' ? 'Filter Aktif' : 'Non-Tunai'}
            </span>
          </div>
          <div className="my-2 w-full">
            <div className="text-xl font-black font-mono text-slate-900 flex items-baseline justify-between">
              <span>Rp {paymentMethodStats.transferNominal.toLocaleString('id-ID')}</span>
              <span className="text-[11px] font-bold font-sans text-slate-400">
                {paymentMethodStats.transferCount} nota
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
              <span>
                {totalRealDiterima > 0 && paymentMethodStats.transferNominal > 0 ? `${Math.round((paymentMethodStats.transferNominal / totalRealDiterima) * 100)}% · ` : ''}Rekening Bank & Mesin Gesek
              </span>
              {paymentFilter === 'Transfer' && (
                <span className="text-[10px] font-bold text-sky-700 underline">Lepas filter</span>
              )}
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-sky-500 rounded-full transition-all duration-300" 
              style={{ 
                width: `${totalRealDiterima > 0 ? ((paymentMethodStats.transferNominal / totalRealDiterima) * 100) : 0}%` 
              }}
            />
          </div>
        </button>
      </div>

      {/* Active Payment Method Banner Alert */}
      {paymentFilter !== 'Semua' && (
        <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center justify-between shadow-xs border border-slate-700 animate-pop-scale">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Menampilkan filter metode: <strong className="text-emerald-300 font-extrabold uppercase">{paymentFilter === 'Transfer' ? 'Transfer & EDC' : paymentFilter}</strong> ({displayedTx.length} dari {filteredTx.length} transaksi)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPaymentFilter('Semua')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Tampilkan Semua</span>
          </button>
        </div>
      )}

      {/* Transaction Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                <th className="py-2.5 px-3.5">No Nota</th>
                <th className="py-2.5 px-3">Tanggal & Kasir</th>
                <th className="py-2.5 px-3">Pelanggan</th>
                <th className="py-2.5 px-3">Layanan & Item</th>
                <th className="py-2.5 px-3">Status Pengerjaan</th>
                <th className="py-2.5 px-3">Total Tagihan</th>
                <th className="py-2.5 px-3">Pembayaran</th>
                <th className="py-2.5 px-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-2.5 px-3.5"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-2.5 px-3"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-2.5 px-3"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-2.5 px-3"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                    <td className="py-2.5 px-3"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-2.5 px-3"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-2.5 px-3"><div className="h-3.5 bg-slate-100 rounded w-14" /></td>
                    <td className="py-2.5 px-3.5"><div className="h-3.5 bg-slate-100 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : displayedTx.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    {paymentFilter !== 'Semua' ? (
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-600">
                          Tidak ada transaksi dengan metode pembayaran &quot;{paymentFilter === 'Transfer' ? 'Transfer & EDC' : paymentFilter}&quot;
                        </p>
                        <button
                          type="button"
                          onClick={() => setPaymentFilter('Semua')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E4648] text-white rounded-xl text-xs font-bold shadow-2xs hover:bg-[#163536] transition cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Tampilkan Semua Metode
                        </button>
                      </div>
                    ) : (
                      'Belum ada riwayat transaksi'
                    )}
                  </td>
                </tr>
              ) : (
                paginatedTx.map((tx) => {
                  const isDropOff = Boolean(tx.tipe === 'FullService' || tx.tipe === 'Drop Off' || (tx.tipe as string) === 'DropOff');
                  const isSelfService = Boolean(tx.tipe === 'SelfService' || tx.tipe === 'Self Service');
                  const speedLower = String(tx.tingkatLayanan || 'Reguler').toLowerCase();
                  const isVoid = Boolean(
                    tx.status === 'Void' || 
                    tx.status === 'Batal' || 
                    tx.statusVoid === 'Approved'
                  );

                  return (
                    <tr key={tx.noNota} className={`hover:bg-slate-50/80 transition-colors text-xs ${isVoid ? 'bg-slate-50/40 opacity-75' : ''}`}>
                      {/* 1. No Nota */}
                      <td className="py-2.5 px-3.5 font-bold text-slate-700 whitespace-nowrap">
                        <div className={`font-mono text-xs ${isVoid ? 'line-through text-slate-400' : ''}`}>{tx.noNota}</div>
                        {tx.statusVoid === 'PendingApproval' ? (
                          <span className="text-[9px] text-[#FF9500] font-semibold bg-[#FF9500]/10 border border-[#FF9500]/30 px-1 py-0.2 rounded mt-0.5 inline-block">
                            Pending Void
                          </span>
                        ) : isVoid ? (
                          <span className="text-[9px] text-rose-600 font-bold bg-rose-50 border border-rose-200 px-1 py-0.2 rounded mt-0.5 inline-block">
                            Void
                          </span>
                        ) : null}
                      </td>

                      {/* 2. Tanggal & Kasir */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-700 text-[11px]">{formatDateTime(tx.tanggal)}</div>
                        <div className="text-[10px] text-slate-400">Kasir: {tx.petugas || 'Kasir'}</div>
                      </td>

                      {/* 3. Pelanggan */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 text-xs truncate max-w-[120px]">{tx.namaPelanggan || '-'}</div>
                        {tx.noHp && <div className="text-[10px] text-slate-400 font-mono">{maskPhone(tx.noHp)}</div>}
                      </td>

                      {/* 4. Layanan & Item (Compact) */}
                      <td className="py-2.5 px-3 min-w-[140px] max-w-[200px]">
                        <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                          {isDropOff ? (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              speedLower.includes('kilat') ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              speedLower.includes('express') ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-teal-50 text-teal-800 border-teal-200'
                            }`}>
                              Drop Off · {tx.tingkatLayanan || 'Reguler'}
                            </span>
                          ) : isSelfService ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-sky-50 text-sky-800 border-sky-200">
                              Self Service (Koin)
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-slate-100 text-slate-700 border-slate-200">
                              Retail / FnB
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 truncate leading-tight" title={(tx.items || []).map(i => `${i.qty}x ${i.layanan}`).join(', ')}>
                          {(tx.items && tx.items.length > 0)
                            ? tx.items.map(i => `${i.qty}x ${i.layanan}`).join(', ')
                            : (tx.tipe || 'Layanan')}
                        </p>
                      </td>

                      {/* 5. Status Pengerjaan (Produksi) */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isVoid ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
                            <Ban className="w-3 h-3 text-rose-600" />
                            <span>Dibatalkan (Void)</span>
                          </span>
                        ) : isDropOff ? (() => {
                          const st = String(tx.status || 'Diterima');
                          const badgeCls =
                            st === 'Siap Diambil'
                              ? 'bg-teal-50 text-teal-800 border-teal-300 font-extrabold'
                              : st === 'Selesai'
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : st === 'Dicuci'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : st === 'Dikeringkan'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : (st.includes('Lipat') || st.includes('Setrika'))
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200';

                          return (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeCls}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              <span>{st}</span>
                            </span>
                          );
                        })() : (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                            Selesai di Tempat
                          </span>
                        )}
                      </td>

                      {/* 6. Total Tagihan */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isVoid ? (
                          <div>
                            <div className="font-bold text-slate-400 line-through text-xs">
                              Rp {(tx?.total || 0).toLocaleString('id-ID')}
                            </div>
                            <span className="text-[9px] font-black text-rose-600 uppercase tracking-tight">
                              [Dibatalkan]
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-[#1E4648] text-xs">Rp {(tx?.total || 0).toLocaleString('id-ID')}</div>
                            {tx.sisaTagihan && tx.sisaTagihan > 0 ? (
                              <div className="text-[9px] text-rose-600 font-bold">
                                Sisa: Rp {(tx?.sisaTagihan || 0).toLocaleString('id-ID')}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400">{tx.metodeBayar || 'Tunai'}</div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 7. Status Pembayaran */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isVoid ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-rose-50 text-rose-700 border-rose-200 inline-flex items-center gap-1">
                            <Ban className="w-3 h-3 text-rose-600" />
                            Tidak Lunas (Void)
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              tx.statusPembayaran === 'DP' || (tx.sisaTagihan || 0) > 0
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            <span>{tx.statusPembayaran || ((tx.sisaTagihan || 0) > 0 ? 'DP' : 'Lunas')}</span>
                          </span>
                        )}
                      </td>

                      {/* 8. Aksi & Approval */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            title="Detail Nota"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handlePrintReceipt(tx)}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            title="Cetak Struk"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          
{/* Edit Kasir Button (Manager Only) */}
                          {currentRole === 'MANAGER' && (
                            <button
                              onClick={() => handleOpenEditKasir(tx)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title="Edit Nama Kasir"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Send WA Notification */}
                          {!isVoid && (
                            <button
                              onClick={() => tx.status === 'Siap Diambil' ? handleSendSiapWA(tx) : handleWhatsAppStruk(tx)}
                              className="p-1.5 text-[#1E4648] hover:bg-[#B5C9C9]/20 rounded-lg transition"
                              title={tx.status === 'Siap Diambil' ? "Kirim WA Siap Diambil" : "Kirim WA Struk"}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* DP Pelunasan Button */}
                          {tx.sisaTagihan && tx.sisaTagihan > 0 ? (
                            <button
                              onClick={() => { setTxToLunas(tx); setPelunasanNominalInput((tx.sisaTagihan || 0).toString()); setShowPelunasanModal(true); }}
                              className="p-1 text-[11px] bg-[#1E4648] text-white hover:bg-[#163536] rounded px-2 font-semibold transition shadow-2xs"
                              title="Pelunasan DP"
                            >
                              Lunas
                            </button>
                          ) : null}

                          {/* Void Request Button */}
                          {tx.status !== 'Batal' && tx.status !== 'Void' && tx.statusVoid !== 'PendingApproval' && tx.statusVoid !== 'Approved' && (
                            <button
                              onClick={() => { setTxToVoid(tx); setShowVoidModal(true); }}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              title="Ajukan Void Transaksi"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Rows Per Page Controls */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-between w-full sm:w-auto">
            {/* Rows Per Page Selector: 25, 50, 100, Semua */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500">Tampilkan:</span>
              <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200 shadow-2xs">
                {([25, 50, 100, 'all'] as const).map((opt) => {
                  const isSelected = pageSize === opt;
                  const label = opt === 'all' ? 'Semua' : opt.toString();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPageSize(opt)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1E4648] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Range info */}
            <div className="text-slate-500 font-medium text-[11px]">
              {totalItems > 0 ? (
                <span>
                  Menampilkan <strong className="text-slate-800 font-bold">{startIndex}–{endIndex}</strong> dari <strong className="text-slate-800 font-bold">{totalItems}</strong> transaksi
                </span>
              ) : (
                <span>0 transaksi</span>
              )}
            </div>
          </div>

          {/* Pagination Navigation Buttons */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 mx-0.5">
                {getPageNumbers().map((p, idx) => {
                  if (typeof p === 'string') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold select-none">
                        ...
                      </span>
                    );
                  }
                  const isActive = p === safePage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p as number)}
                      className={`min-w-[28px] h-7 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#1E4648] text-white shadow-2xs ring-2 ring-[#1E4648]/20'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-2xs'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition shadow-2xs"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Void Request Modal (FR-POS-24) */}
      {showVoidModal && txToVoid && (
        <div className="fixed inset-0 z-[550] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-rose-600 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Pengajuan Void Transaksi</span>
              </div>
              <button onClick={() => setShowVoidModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Ajukan pembatalan (void) untuk Nota <span className="font-bold">{txToVoid.noNota}</span> (Total Rp {(txToVoid?.total || 0).toLocaleString('id-ID')}). Permohonan membutuhkan persetujuan Manager/Owner.
            </p>
            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Pembatalan *</label>
                <textarea
                  value={alasanVoidInput}
                  onChange={(e) => setAlasanVoidInput(e.target.value)}
                  placeholder="Misal: Salah input layanan, pelanggan batal..."
                  className="w-full p-2.5 border border-slate-200 rounded-md outline-none focus:border-rose-500 h-20"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowVoidModal(false)} 
                disabled={submittingVoid}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-3 py-2 rounded-md text-xs cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={handleAjukanVoid} 
                disabled={submittingVoid}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 rounded-md text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submittingVoid ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <span>Kirim Pengajuan Void</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DP Pelunasan Modal (FR-POS-16) */}
      {showPelunasanModal && txToLunas && (
        <div className="fixed inset-0 z-[550] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-600">Pelunasan Pengambilan Cucian</h3>
              <button onClick={() => setShowPelunasanModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs mb-3 space-y-1">
              <div className="flex justify-between text-slate-600"><span>Nota:</span><span className="font-bold">{txToLunas.noNota}</span></div>
              <div className="flex justify-between text-slate-600"><span>Pelanggan:</span><span className="font-bold">{txToLunas.namaPelanggan}</span></div>
              <div className="flex justify-between text-rose-600 font-bold pt-1 border-t border-slate-200">
                <span>Sisa Tagihan:</span>
                <span>Rp {(txToLunas.sisaTagihan || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Pelunasan (Rp)</label>
                <input
                  type="number"
                  value={pelunasanNominalInput}
                  onChange={(e) => setPelunasanNominalInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metode Bayar Pelunasan</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['Tunai', 'QRIS', 'Transfer'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPelunasanMetode(m)}
                      className={`py-1.5 rounded text-xs font-semibold border ${pelunasanMetode === m ? 'bg-[#B5C9C9]/20 border-[#1E4648] text-[#1E4648]' : 'border-slate-200 text-slate-600'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPelunasanModal(false)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-md text-xs font-semibold">Batal</button>
              <button onClick={handleProsesPelunasan} className="flex-1 bg-[#1E4648] hover:bg-[#1E4648] text-white font-semibold py-2 rounded-md text-xs transition">
                Simpan Pelunasan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTx && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedTx(null); }}
          className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1E4648]/10 text-[#1E4648] flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-slate-800 tracking-tight">Nota {selectedTx.noNota}</h3>
                    {(selectedTx.status === 'Void' || selectedTx.status === 'Batal') && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                        Void
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatDateTime(selectedTx.tanggal)}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 border border-slate-200/60 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
              {/* Info Pelanggan & Petugas Card */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80">
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200/60">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Pelanggan</span>
                    <div className="font-bold text-slate-800 truncate" title={selectedTx.namaPelanggan}>
                      {selectedTx.namaPelanggan || 'Umum / Walk-in'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      {selectedTx.noHp ? maskPhone(selectedTx.noHp) : '-'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Kasir & Tipe</span>
                    <div className="font-semibold text-slate-800 truncate" title={selectedTx.petugas}>
                      {selectedTx.petugas || 'Kasir'}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                        selectedTx.tipe === 'FullService'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : selectedTx.tipe === 'SelfService'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {selectedTx.tipe === 'FullService' ? 'Drop Off' : selectedTx.tipe === 'SelfService' ? 'Self Service' : 'Retail / FnB'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Pengerjaan */}
                <div className="flex items-center justify-between pt-2.5">
                  <span className="text-slate-500 font-medium">Status Pengerjaan:</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] border inline-flex items-center gap-1.5 ${
                    selectedTx.status === 'Selesai' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : selectedTx.status === 'Void' || selectedTx.status === 'Batal' ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : selectedTx.status === 'Siap Diambil' ? 'bg-teal-50 text-teal-800 border-teal-300 font-extrabold'
                    : 'bg-[#B5C9C9]/20 text-[#1E4648] border-[#B5C9C9]'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>{selectedTx.status || 'Selesai'}</span>
                  </span>
                </div>

                {selectedTx.catatan && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Catatan:</span>
                    <p className="text-slate-600 italic bg-white/80 p-2 rounded-lg border border-slate-200/50">{selectedTx.catatan}</p>
                  </div>
                )}
              </div>

              {/* Rincian Layanan / Item */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Layanan / Item
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {(selectedTx.items || []).length} Item
                  </span>
                </div>
                
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5">
                  {(selectedTx.items || []).length > 0 ? (
                    (selectedTx.items || []).map((item: any, idx: number) => {
                      const qty = Number(item.qty) || 1;
                      const harga = Number(item.hargaSatuan) || 0;
                      const subtotal = qty * harga;
                      return (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/70 rounded-xl px-3.5 py-2.5 transition-colors"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="font-bold text-slate-800 text-xs truncate" title={item.layanan}>
                              {item.layanan}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <span className="font-semibold text-slate-700">{qty}x</span> @ Rp {harga.toLocaleString('id-ID')}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-[#1E4648] text-xs">
                              Rp {subtotal.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-slate-400 italic text-center py-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Tidak ada rincian item
                    </div>
                  )}
                </div>
              </div>

              {/* Rincian Pembayaran */}
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Metode Bayar</span>
                  <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {selectedTx.metodeBayar || 'Tunai'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <span>Dibayar</span>
                  <span className="font-semibold text-slate-800">
                    Rp {(Number(selectedTx.nominalDP) || Number(selectedTx.total) || 0).toLocaleString('id-ID')}
                  </span>
                </div>

                {(Number(selectedTx.sisaTagihan) || 0) > 0 ? (
                  <div className="flex justify-between items-center font-bold text-rose-600">
                    <span>Sisa Tagihan (DP)</span>
                    <span>Rp {(Number(selectedTx.sisaTagihan) || 0).toLocaleString('id-ID')}</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Kembali</span>
                    <span className="font-semibold text-slate-800">
                      Rp {Math.max(0, (Number(selectedTx.nominalDP) || Number(selectedTx.total) || 0) - (Number(selectedTx.total) || 0)).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-600">
                  <span>Status Pembayaran</span>
                  <span className={`font-bold text-[10px] px-2.5 py-0.5 rounded-md border ${
                    selectedTx.statusPembayaran === 'Lunas' || (!selectedTx.statusPembayaran && (Number(selectedTx.sisaTagihan) || 0) <= 0)
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedTx.statusPembayaran || ((Number(selectedTx.sisaTagihan) || 0) > 0 ? 'DP' : 'Lunas')}
                  </span>
                </div>

                {/* Total Tagihan Bar */}
                <div className="pt-2.5 mt-2 border-t border-slate-200/80 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-black text-slate-800 block">Total Tagihan</span>
                    <span className="text-[10px] text-slate-400">Total seluruh layanan</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#1E4648]">
                      Rp {(Number(selectedTx.total) || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons Footer */}
            <div className="p-4 bg-slate-50/90 border-t border-slate-200/80 space-y-2">
              {/* Baris 1: Aksi Utama (Kirim WA & Cetak Struk) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleWhatsAppStruk(selectedTx)}
                  className="flex items-center justify-center gap-2 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim WA</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintReceipt(selectedTx)}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Struk</span>
                </button>
              </div>

              {/* Baris 2: Pelunasan DP jika ada sisa tagihan */}
              {(Number(selectedTx.sisaTagihan) || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const tx = selectedTx;
                    setSelectedTx(null);
                    setTxToLunas(tx);
                    setPelunasanNominalInput((tx.sisaTagihan || 0).toString());
                    setShowPelunasanModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-2xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Pelunasan Sisa Tagihan (Rp {(Number(selectedTx.sisaTagihan) || 0).toLocaleString('id-ID')})</span>
                </button>
              )}

              {/* Baris 3: Opsi Tambahan (Edit Kasir, Void, Tutup) - rapi dan proporsional */}
              <div className="flex items-center gap-2">
                {currentRole === 'MANAGER' && (
                  <button
                    type="button"
                    onClick={() => {
                      const tx = selectedTx;
                      setSelectedTx(null);
                      handleOpenEditKasir(tx);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold py-2 px-2 rounded-xl transition cursor-pointer"
                    title="Ubah Nama Kasir pada Transaksi Ini"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span className="truncate">Edit Kasir</span>
                  </button>
                )}

                {selectedTx.status !== 'Batal' && selectedTx.status !== 'Void' && selectedTx.statusVoid !== 'Approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      const tx = selectedTx;
                      setSelectedTx(null);
                      setTxToVoid(tx);
                      setShowVoidModal(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold py-2 px-2 rounded-xl transition cursor-pointer"
                    title="Batalkan atau Void Transaksi ini"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span className="truncate">Void Nota</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Transaction Input Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-lg max-h-[92vh] overflow-y-auto space-y-4 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-[#1E4648] flex items-center justify-center font-bold text-sm">
                  <FileText className="w-4 h-4 text-teal-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-600">Input Transaksi Manual</h3>
                  <p className="text-[11px] text-slate-500">Catat transaksi susulan / khusus ke database server online</p>
                </div>
              </div>
              <button onClick={() => setShowManualModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Tanggal & Waktu */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal & Waktu Transaksi</label>
                <input
                  type="datetime-local"
                  value={manualTanggal}
                  onChange={(e) => setManualTanggal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] bg-slate-50"
                />
              </div>

              {/* No Nota (Opsional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">No Nota (Kosongkan = Otomatis)</label>
                <input
                  type="text"
                  value={manualNoNota}
                  onChange={(e) => setManualNoNota(e.target.value)}
                  placeholder="Contoh: MAN-001 / LDY-..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Nama Pelanggan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Pelanggan *</label>
                <input
                  type="text"
                  value={manualNama}
                  onChange={(e) => setManualNama(e.target.value)}
                  placeholder="Nama pelanggan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* No HP */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">No HP / WhatsApp</label>
                <input
                  type="tel"
                  value={manualNoHp}
                  onChange={(e) => setManualNoHp(e.target.value)}
                  placeholder="08..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Tipe Layanan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tipe Layanan</label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-md">
                  <button
                    type="button"
                    onClick={() => setManualTipe('SelfService')}
                    className={`py-1.5 rounded text-xs font-semibold transition ${
                      manualTipe === 'SelfService' ? 'bg-[#1E4648] text-white' : 'text-slate-600'
                    }`}
                  >
                    Self Service
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualTipe('FullService')}
                    className={`py-1.5 rounded text-xs font-semibold transition ${
                      manualTipe === 'FullService' ? 'bg-[#1E4648] text-white' : 'text-slate-600'
                    }`}
                  >
                    Full Service
                  </button>
                </div>
              </div>


              {/* Status Nota */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status Nota</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] bg-white font-medium text-slate-600"
                >
                  <option value="Selesai">Selesai (Langsung Lunas & Selesai)</option>
                  <option value="Diterima">Diterima (Proses Pengerjaan)</option>
                </select>
              </div>

              {/* Nama Layanan / Deskripsi */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Deskripsi / Nama Layanan</label>
                <input
                  type="text"
                  value={manualLayanan}
                  onChange={(e) => setManualLayanan(e.target.value)}
                  placeholder="Contoh: Cuci Komplit 7.5 Kg / Paket Karpet"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Jumlah & Harga Satuan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jumlah (Qty / Kg)</label>
                <input
                  type="number"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Harga Satuan (Rp)</label>
                <input
                  type="number"
                  value={manualHarga}
                  onChange={(e) => setManualHarga(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Metode Pembayaran */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Metode Pembayaran</label>
                <select
                  value={manualMetode}
                  onChange={(e) => setManualMetode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] bg-white font-medium"
                >
                  <option value="Tunai">Tunai</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer Bank</option>
                </select>
              </div>

              {/* Petugas / Kasir */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kasir / Petugas</label>
                <input
                  type="text"
                  value={manualPetugas}
                  onChange={(e) => setManualPetugas(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            {/* Total Ringkasan Box */}
            <div className="bg-[#B5C9C9]/20/60 border border-[#B5C9C9]200/80 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#1E4648]">Total Nominal Transaksi</span>
                <p className="text-[11px] text-[#1E4648]">{manualQty || 1} × Rp {(Number(manualHarga) || 0).toLocaleString('id-ID')}</p>
              </div>
              <div className="text-base font-bold text-[#1E4648]">
                Rp {((Number(manualHarga) || 0) * (Number(manualQty) || 1)).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowManualModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2.5 rounded-md text-xs transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveManualTx}
                disabled={savingManual}
                className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2.5 rounded-md text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {savingManual ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Simpan Transaksi Manual</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Edit Nama Kasir (Manager Only) */}
      {showEditKasirModal && txToEditKasir && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Edit Nama Kasir</h3>
                  <p className="text-[11px] text-slate-500">Nota: <span className="font-mono font-semibold text-slate-700">{txToEditKasir.noNota}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowEditKasirModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed">
              <p className="font-semibold text-amber-900 mb-0.5">Khusus Manajemen / Manager</p>
              <p>Hanya nama petugas/kasir yang akan diperbarui. Data item, harga, status pembayaran, dan total nota tidak akan berubah.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Kasir Sebelumnya</label>
                <div className="px-3 py-2 bg-slate-100 rounded-xl text-xs font-medium text-slate-600 border border-slate-200">
                  {txToEditKasir.petugas || '(Belum tercantum / kosong)'}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Pilih Petugas / Kasir Baru</label>
                <select
                  value={selectedKasirName}
                  onChange={(e) => setSelectedKasirName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648] cursor-pointer"
                >
                  <option value="">-- Pilih Kasir / Petugas --</option>
                  {staffOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {txToEditKasir.petugas && !staffOptions.includes(txToEditKasir.petugas) && (
                    <option value={txToEditKasir.petugas}>{txToEditKasir.petugas} (Saat Ini)</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditKasirModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveKasirEdit}
                disabled={savingEditKasir || !selectedKasirName.trim()}
                className="px-4 py-2 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingEditKasir ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printer Modal */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        tx={txForPrintModal}
        printType="struk"
      />

      {/* Google Drive Style Floating Progress Bar (Pojok Kanan Bawah) */}
      <ImportProgressToast
        isOpen={isImporting}
        title="Mengimpor Data Transaksi"
        fileName={importFileName || 'transaksi.csv'}
        statusText={importProgressText}
        progressPercent={importProgressPercent}
        isComplete={importIsComplete}
        isError={importIsError}
        onClose={() => setIsImporting(false)}
      />
    </div>
  );
}
