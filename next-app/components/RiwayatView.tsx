'use client';

import React, { useState, useEffect } from 'react';
import { Search, Printer, Send, Eye, RefreshCw, X, FileText, Plus, ShieldAlert, AlertTriangle, Check, Download, Upload, Calendar, ArrowRight, Coins, Smartphone, CreditCard, Banknote, CheckCircle2, Clock, History, UserCheck, Edit3 } from 'lucide-react';
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
  const [periodePreset, setPeriodePreset] = useState<'all' | 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('all');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [recordedShifts, setRecordedShifts] = useState<any[]>([]);
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

  const getFilterLabel = (f: 'Semua' | 'SelfService' | 'FullService' | 'NonLayanan' | 'PendingVoid') => {
    switch (f) {
      case 'Semua': return 'Semua Tipe';
      case 'SelfService': return 'Self Service';
      case 'FullService': return 'Drop Off';
      case 'NonLayanan': return 'Non-Layanan / Retail';
      case 'PendingVoid': return `🛑 Void Pending (${pendingVoidCount})`;
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'No Nota', 'Tanggal', 'Nama Pelanggan', 'No HP', 'Tipe Layanan', 'Total',
      'Metode Bayar', 'Status Pembayaran', 'Status Pengerjaan', 'Kasir', 'Detail Items', 'Catatan'
    ];
    const rows = filteredTx.map(t => [
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
    downloadCSV(`riwayat_transaksi_${Date.now()}.csv`, toCSV(headers, rows));
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
                <span>🛑 Void Pending</span>
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

          <div className="ml-auto text-[11px] text-slate-400 font-semibold">
            Menampilkan <strong>{filteredTx.length}</strong> transaksi (<strong>{nonVoidFilteredTx.length}</strong> valid)
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
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span>🟢 Shift Aktif ({activeShift.namaKasir})</span>
              </button>
            )}

            {/* Select Dropdown: Shift Tercatat (Selesai/Tutup) */}
            {recordedShifts.length > 0 && (
              <div className="relative flex items-center">
                <select
                  value={selectedShiftId !== 'all' && selectedShiftId !== 'active' ? selectedShiftId : ''}
                  onChange={(e) => {
                    if (e.target.value) setSelectedShiftId(e.target.value);
                    else setSelectedShiftId('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border outline-none transition cursor-pointer ${
                    selectedShiftId !== 'all' && selectedShiftId !== 'active'
                      ? 'bg-[#1E4648] text-white border-[#1E4648] shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <option value="" className="text-slate-800 bg-white">
                    📋 Riwayat Shift Tercatat ({recordedShifts.length} Shift)...
                  </option>
                  {recordedShifts.map((s) => (
                    <option key={s.idShift} value={s.idShift} className="text-slate-800 bg-white">
                      Shift {s.idShift} · {s.namaKasir} ({s.waktuBuka}{s.waktuTutup ? ` s/d ${s.waktuTutup.split(' ')[1] || s.waktuTutup}` : ''})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Filter Button */}
            {selectedShiftId !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedShiftId('all')}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
              >
                ✕ Reset Shift
              </button>
            )}
          </div>

          {selectedShiftId !== 'all' && (
            <div className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>
                {selectedShiftId === 'active'
                  ? `Shift Aktif: ${activeShift?.namaKasir || 'Kasir'}`
                  : `Shift: ${recordedShifts.find(s => s.idShift === selectedShiftId)?.namaKasir || selectedShiftId}`}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Summary Cards: Uang Riil Diterima & Rincian per Metode Pembayaran (Non-Void) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Riil Uang Diterima (Bersih Non-Void) */}
        <div className="bg-gradient-to-br from-[#042f2e] to-[#115e59] rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between border border-teal-600/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
              <Banknote className="w-4 h-4 text-emerald-300" />
              <span>Total Uang Riil Diterima</span>
            </span>
            <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full font-black border border-emerald-400/30">
              NON-VOID ✅
            </span>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-black font-mono tracking-tight text-white">
              Rp {totalRealDiterima.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-teal-200/90 mt-0.5">
              Bersih dari <strong>{nonVoidFilteredTx.length}</strong> transaksi valid
            </div>
          </div>
          {voidCountInFilter > 0 ? (
            <div className="text-[10px] text-rose-200 bg-rose-950/40 border border-rose-500/30 px-2 py-1 rounded-xl flex items-center justify-between">
              <span>🚫 {voidCountInFilter} Nota Void Diabaikan:</span>
              <span className="font-mono font-bold">-Rp {totalVoidNominal.toLocaleString('id-ID')}</span>
            </div>
          ) : (
            <div className="text-[10px] text-teal-300/80 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Semua transaksi pada filter ini berstatus aktif/valid</span>
            </div>
          )}
        </div>

        {/* Card 2: Pemasukan Kas Tunai */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>Tunai (Kas Laci)</span>
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
              Fisik Laci
            </span>
          </div>
          <div className="my-2">
            <div className="text-xl font-black font-mono text-slate-900">
              Rp {(methodBreakdown['Tunai'] || 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {totalRealDiterima > 0 ? Math.round(((methodBreakdown['Tunai'] || 0) / totalRealDiterima) * 100) : 0}% dari total uang masuk
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
              style={{ width: `${totalRealDiterima > 0 ? ((methodBreakdown['Tunai'] || 0) / totalRealDiterima) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Card 3: Pemasukan QRIS Digital */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span>QRIS Digital</span>
            </span>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
              Merchant QRIS
            </span>
          </div>
          <div className="my-2">
            <div className="text-xl font-black font-mono text-slate-900">
              Rp {(methodBreakdown['QRIS'] || 0).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {totalRealDiterima > 0 ? Math.round(((methodBreakdown['QRIS'] || 0) / totalRealDiterima) * 100) : 0}% dari total uang masuk
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-300" 
              style={{ width: `${totalRealDiterima > 0 ? ((methodBreakdown['QRIS'] || 0) / totalRealDiterima) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Card 4: Transfer Bank / EDC / Non-Tunai Lainnya */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-sky-600" />
              <span>Transfer & EDC</span>
            </span>
            <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-bold border border-sky-200">
              Non-Tunai
            </span>
          </div>
          <div className="my-2">
            <div className="text-xl font-black font-mono text-slate-900">
              Rp {(
                (methodBreakdown['Transfer BCA'] || 0) + 
                (methodBreakdown['Transfer'] || 0) + 
                (methodBreakdown['EDC'] || 0) + 
                (methodBreakdown['Debit'] || 0)
              ).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Rekening Bank & Mesin Gesek
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-sky-500 rounded-full transition-all duration-300" 
              style={{ 
                width: `${totalRealDiterima > 0 ? (((methodBreakdown['Transfer BCA'] || 0) + (methodBreakdown['Transfer'] || 0) + (methodBreakdown['EDC'] || 0) + (methodBreakdown['Debit'] || 0)) / totalRealDiterima) * 100 : 0}%` 
              }}
            />
          </div>
        </div>
      </div>

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
              ) : filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Belum ada riwayat transaksi
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => {
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            <span>🚫 Dibatalkan (Void)</span>
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
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-rose-50 text-rose-700 border-rose-200">
                            🚫 Tidak Lunas (Void)
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
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Detail Nota {selectedTx.noNota}</h3>
                <p className="text-[11px] text-slate-400">{formatDateTime(selectedTx.tanggal)}</p>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Info Transaksi */}
            <div className="space-y-1.5 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggan</span>
                <span className="font-semibold text-slate-700">{selectedTx.namaPelanggan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No HP</span>
                <span className="text-slate-600">{maskPhone(selectedTx.noHp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kasir</span>
                <span className="text-slate-600">{selectedTx.petugas || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tipe</span>
                <span className="text-slate-600">{selectedTx.tipe === 'FullService' ? 'Drop Off' : 'Self Service'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Order</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${
                  selectedTx.status === 'Selesai' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : selectedTx.status === 'Void' || selectedTx.status === 'Batal' ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-[#B5C9C9]/20 text-[#1E4648] border-[#B5C9C9]'
                }`}>{selectedTx.status}</span>
              </div>
              {selectedTx.catatan && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Catatan</span>
                  <span className="text-slate-600 text-right max-w-[60%]">{selectedTx.catatan}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="mb-4">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Layanan / Item</div>
              <div className="space-y-2">
                {(selectedTx.items || []).length > 0 ? (
                  (selectedTx.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      <div>
                        <div className="font-semibold text-slate-700">{item.layanan}</div>
                        <div className="text-[10px] text-slate-400">{item.qty} x Rp {(Number(item.hargaSatuan) || 0).toLocaleString('id-ID')}</div>
                      </div>
                      <span className="font-bold text-[#1E4648]">Rp {(Number(item.qty) * (Number(item.hargaSatuan) || 0)).toLocaleString('id-ID')}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 italic text-center py-2">Tidak ada detail item</div>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="space-y-1.5 text-xs pt-3 border-t border-slate-100">
              <div className="flex justify-between font-bold text-sm">
                <span className="text-slate-700">Total</span>
                <span className="text-[#1E4648]">Rp {(Number(selectedTx.total) || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Metode Bayar</span>
                <span className="font-medium text-slate-700">{selectedTx.metodeBayar || 'Tunai'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Dibayar</span>
                <span className="font-medium text-slate-700">Rp {(Number(selectedTx.nominalDP) || Number(selectedTx.total) || 0).toLocaleString('id-ID')}</span>
              </div>
              {(Number(selectedTx.sisaTagihan) || 0) > 0 ? (
                <div className="flex justify-between font-bold text-rose-600">
                  <span>Sisa Tagihan</span>
                  <span>Rp {(Number(selectedTx.sisaTagihan) || 0).toLocaleString('id-ID')}</span>
                </div>
              ) : (
                <div className="flex justify-between text-slate-500">
                  <span>Kembali</span>
                  <span className="font-medium text-[#1E4648]">Rp {Math.max(0, (Number(selectedTx.nominalDP) || Number(selectedTx.total) || 0) - (Number(selectedTx.total) || 0)).toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Status Bayar</span>
                <span className={`font-bold text-[10px] px-2 py-0.5 rounded border ${
                  selectedTx.statusPembayaran === 'Lunas' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>{selectedTx.statusPembayaran || 'Lunas'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 flex-wrap">
              <button
                onClick={() => { handleWhatsAppStruk(selectedTx); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#1E4648] text-white text-xs font-bold py-2.5 rounded-lg hover:bg-[#163536] transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </button>

              <button
                onClick={() => handlePrintReceipt(selectedTx)}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                title="Cetak Struk Thermal"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak</span>
              </button>

              {currentRole === 'MANAGER' && (
                <button
                  onClick={() => {
                    const tx = selectedTx;
                    setSelectedTx(null);
                    handleOpenEditKasir(tx);
                  }}
                  className="px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                  title="Ubah Nama Kasir pada Transaksi Ini"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Edit Kasir</span>
                </button>
              )}

              {selectedTx.status !== 'Batal' && selectedTx.status !== 'Void' && selectedTx.statusVoid !== 'Approved' && (
                <button
                  onClick={() => {
                    const tx = selectedTx;
                    setSelectedTx(null);
                    setTxToVoid(tx);
                    setShowVoidModal(true);
                  }}
                  className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                  title="Batalkan atau Void Transaksi ini"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Void Transaksi</span>
                </button>
              )}

              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition"
              >
                Tutup
              </button>
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
                <div className="w-8 h-8 rounded-lg bg-[#B5C9C9]/20 border border-[#B5C9C9]200 text-[#1E4648] flex items-center justify-center font-bold text-sm">
                  📝
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
