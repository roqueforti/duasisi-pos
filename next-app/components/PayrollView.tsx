'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  RefreshCw, 
  Download, 
  Printer, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  User, 
  CreditCard, 
  Search, 
  Eye, 
  Check, 
  X,
  FileText,
  TrendingUp,
  Award,
  ShieldCheck,
  Edit2,
  Settings,
  Building,
  Sliders,
  Sparkles,
  Layers,
  HelpCircle,
  Plus,
  Trash2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Info,
  Lightbulb,
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { runBackend } from '@/lib/api';
import { toCSV, downloadCSV } from '@/lib/csvUtils';
import { UserRole, PayrollItem, PayrollSummary, PegawaiDetail, DropoffIncentiveConfig, DropoffDetailedTask } from '@/lib/types';
import { formatWaPhone, formatDateTime } from '@/lib/utils';
import { useDialog } from '@/components/DialogProvider';

const BULAN_OPTIONS = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' }
];

export default function PayrollView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert, showConfirm } = useDialog();
  const now = new Date();
  const [selectedBulan, setSelectedBulan] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [selectedTahun, setSelectedTahun] = useState(String(now.getFullYear()));

  const [payrollData, setPayrollData] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'Belum Dibayar' | 'Sudah Dibayar'>('Semua');

  // Modal Detail Slip Gaji
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [activeSlipItem, setActiveSlipItem] = useState<PayrollItem | null>(null);

  // Modal Penyesuaian Gaji (Bonus / Potongan / Catatan)
  const [showEditPayModal, setShowEditPayModal] = useState(false);
  const [editItem, setEditItem] = useState<PayrollItem | null>(null);
  const [editGajiPokok, setEditGajiPokok] = useState('');
  const [editTunjangan, setEditTunjangan] = useState('');
  const [editBonus, setEditBonus] = useState('');
  const [editPotongan, setEditPotongan] = useState('');
  const [editMetode, setEditMetode] = useState('Transfer');
  const [editCatatan, setEditCatatan] = useState('');
  const [editSyncMaster, setEditSyncMaster] = useState(false);

  // Modal Master Pengaturan Gaji Pegawai
  const [showSalaryConfigModal, setShowSalaryConfigModal] = useState(false);
  const [masterPegawaiList, setMasterPegawaiList] = useState<PegawaiDetail[]>([]);
  const [editingMasterPegawai, setEditingMasterPegawai] = useState<PegawaiDetail | null>(null);
  const [masterGajiPokok, setMasterGajiPokok] = useState('0');
  const [masterTunjangan, setMasterTunjangan] = useState('0');
  const [masterPotongan, setMasterPotongan] = useState('0');
  const [masterBank, setMasterBank] = useState('BCA');
  const [masterNoRekening, setMasterNoRekening] = useState('');
  const [masterNamaRekening, setMasterNamaRekening] = useState('');
  const [savingSalaryId, setSavingSalaryId] = useState<string | null>(null);

  // Modal Rekapitulasi & Pengaturan Insentif Drop Off
  const DEFAULT_DROPOFF_CONFIG: DropoffIncentiveConfig = {
    rates: {
      'Dicuci': 1500,
      'Dikeringkan': 1500,
      'Disetrika': 2500,
      'Lipat & Packing': 1000,
      'Packing': 1000,
      'Spotting Noda': 2000,
      'Treatment Khusus': 3000,
    },
    umumSteps: ['Pesanan Diterima', 'Diterima', 'Siap Diambil', 'Selesai'],
    customSteps: ['Dicuci', 'Dikeringkan', 'Disetrika', 'Lipat & Packing', 'Packing', 'Spotting Noda', 'Treatment Khusus'],
  };

  const [showInsentifModal, setShowInsentifModal] = useState(false);
  const [insentifModalTab, setInsentifModalTab] = useState<'Matriks' | 'DetailStaff' | 'Pengaturan'>('Matriks');
  const [selectedInsentifStaffId, setSelectedInsentifStaffId] = useState<string | null>(null);
  const [insentifSearchQuery, setInsentifSearchQuery] = useState('');
  const [dropoffConfig, setDropoffConfig] = useState<DropoffIncentiveConfig>(DEFAULT_DROPOFF_CONFIG);
  const [draftRates, setDraftRates] = useState<Record<string, number>>(DEFAULT_DROPOFF_CONFIG.rates);
  const [newStepNameDraft, setNewStepNameDraft] = useState('');
  const [newStepRateDraft, setNewStepRateDraft] = useState('1500');
  const [savingDropoffConfig, setSavingDropoffConfig] = useState(false);

  const loadDropoffConfig = async () => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('duasisi_dropoff_incentive_config') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.rates) {
          const merged = {
            rates: { ...DEFAULT_DROPOFF_CONFIG.rates, ...parsed.rates },
            umumSteps: parsed.umumSteps || DEFAULT_DROPOFF_CONFIG.umumSteps,
            customSteps: parsed.customSteps || DEFAULT_DROPOFF_CONFIG.customSteps,
          };
          setDropoffConfig(merged);
          setDraftRates(merged.rates);
        }
      }
      const remote = await runBackend<DropoffIncentiveConfig>('getDropoffIncentiveConfig');
      if (remote && remote.rates) {
        const merged = {
          rates: { ...DEFAULT_DROPOFF_CONFIG.rates, ...remote.rates },
          umumSteps: remote.umumSteps || DEFAULT_DROPOFF_CONFIG.umumSteps,
          customSteps: remote.customSteps || DEFAULT_DROPOFF_CONFIG.customSteps,
        };
        setDropoffConfig(merged);
        setDraftRates(merged.rates);
        if (typeof window !== 'undefined') {
          localStorage.setItem('duasisi_dropoff_incentive_config', JSON.stringify(merged));
        }
      }
    } catch (e) {
      console.warn('Gagal memuat dropoff incentive config:', e);
    }
  };

  useEffect(() => {
    loadDropoffConfig();
  }, []);

  const handleSaveDropoffConfig = async (newConfig: DropoffIncentiveConfig) => {
    setSavingDropoffConfig(true);
    try {
      setDropoffConfig(newConfig);
      setDraftRates(newConfig.rates);
      if (typeof window !== 'undefined') {
        localStorage.setItem('duasisi_dropoff_incentive_config', JSON.stringify(newConfig));
      }
      await runBackend('saveDropoffIncentiveConfig', newConfig);
      await showAlert('Tarif insentif drop off per pipeline khusus berhasil disimpan!', 'success');
      loadPayroll();
    } catch (e) {
      console.error(e);
      await showAlert('Tarif insentif tersimpan di penyimpanan browser lokal.', 'warning');
    } finally {
      setSavingDropoffConfig(false);
    }
  };

  const printSlipRef = useRef<HTMLDivElement>(null);

  const periodeQuery = `${selectedTahun}-${selectedBulan}`;

  const loadPayroll = async () => {
    setLoading(true);
    try {
      const data = await runBackend<PayrollSummary>('getPayrollSummary', periodeQuery);
      if (data && Array.isArray(data.items)) {
        setPayrollData(data);
      } else {
        setPayrollData({
          periode: periodeQuery,
          totalGajiPokok: 0,
          totalTunjangan: 0,
          totalBonus: 0,
          totalPotongan: 0,
          totalPengeluaranGaji: 0,
          totalPegawai: 0,
          sudahDibayarCount: 0,
          belumDibayarCount: 0,
          items: []
        });
      }
    } catch (err) {
      console.error('Gagal memuat data payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  const openSalaryConfigModal = async () => {
    setLoading(true);
    try {
      const data = await runBackend<PegawaiDetail[]>('getPegawaiList');
      if (Array.isArray(data)) setMasterPegawaiList(data);
      setShowSalaryConfigModal(true);
    } catch (err) {
      console.error(err);
      await showAlert('Gagal memuat daftar pegawai', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEditMasterPegawaiSalary = (peg: PegawaiDetail) => {
    setEditingMasterPegawai(peg);
    setMasterGajiPokok(String(peg.gajiPokok || 0));
    setMasterTunjangan(String(peg.tunjangan || 0));
    setMasterPotongan(String(peg.potongan || 0));
    setMasterBank(peg.bank || 'BCA');
    setMasterNoRekening(peg.noRekening || '');
    setMasterNamaRekening(peg.namaRekening || '');
  };

  const handleSaveMasterPegawaiSalary = async () => {
    if (!editingMasterPegawai) return;
    setSavingSalaryId(editingMasterPegawai.id);
    try {
      const updated: PegawaiDetail = {
        ...editingMasterPegawai,
        gajiPokok: Number(masterGajiPokok) || 0,
        tunjangan: Number(masterTunjangan) || 0,
        potongan: Number(masterPotongan) || 0,
        bank: masterBank,
        noRekening: masterNoRekening,
        namaRekening: masterNamaRekening
      };
      await runBackend('updatePegawai', editingMasterPegawai.id, updated);
      setMasterPegawaiList(prev => prev.map(p => p.id === editingMasterPegawai.id ? updated : p));
      setEditingMasterPegawai(null);
      loadPayroll();
      await showAlert(`Gaji pokok & rekening ${editingMasterPegawai.nama} berhasil diperbarui!`, 'success');
    } catch (err) {
      console.error(err);
      await showAlert('Gagal menyimpan gaji pokok pegawai', 'error');
    } finally {
      setSavingSalaryId(null);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, [selectedBulan, selectedTahun]);

  const openSlipModal = (item: PayrollItem) => {
    setActiveSlipItem(item);
    setShowSlipModal(true);
  };

  const openEditPayModal = (item: PayrollItem) => {
    setEditItem(item);
    setEditGajiPokok(String(item.gajiPokok || 0));
    setEditTunjangan(String(item.tunjangan || 0));
    setEditBonus(String(item.bonusKomisi || 0));
    setEditPotongan(String(item.potongan || 0));
    setEditMetode(item.metodePembayaran || (item.bank ? 'Transfer' : 'Tunai'));
    setEditCatatan(item.catatan || '');
    setEditSyncMaster(false);
    setShowEditPayModal(true);
  };

  const handleSaveEditPayroll = async () => {
    if (!editItem) return;
    const gPokok = Number(editGajiPokok) || 0;
    const tunj = Number(editTunjangan) || 0;
    const bon = Number(editBonus) || 0;
    const pot = Number(editPotongan) || 0;
    const totalBersih = Math.max(0, (gPokok + tunj + bon) - pot);

    setLoading(true);
    try {
      const payload = {
        ...editItem,
        gajiPokok: gPokok,
        tunjangan: tunj,
        bonusKomisi: bon,
        potongan: pot,
        totalGajiBersih: totalBersih,
        metodePembayaran: editMetode,
        catatan: editCatatan
      };

      const res = await runBackend<{ success: boolean; message?: string }>(
        'savePayrollPayment',
        editItem.idPegawai,
        periodeQuery,
        payload
      );

      if (!res?.success) throw new Error(res?.message || 'Gagal menyimpan penyesuaian');

      // If user opted to also save to Master Pegawai profile permanently
      if (editSyncMaster) {
        const pegRes = await runBackend<PegawaiDetail[]>('getPegawaiList').catch(() => []);
        const targetPeg = pegRes?.find(p => p.id === editItem.idPegawai || p.nama === editItem.nama);
        if (targetPeg) {
          await runBackend('updatePegawai', targetPeg.id, {
            ...targetPeg,
            gajiPokok: gPokok,
            tunjangan: tunj,
            potongan: pot
          }).catch(console.error);
        }
      }

      setShowEditPayModal(false);
      loadPayroll();
      await showAlert('Penyesuaian gaji berhasil disimpan!', 'success');
    } catch (err) {
      console.error(err);
      await showAlert(err instanceof Error ? err.message : 'Gagal menyimpan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePaymentStatus = async (item: PayrollItem) => {
    const newStatus = item.statusPembayaran === 'Sudah Dibayar' ? 'Belum Dibayar' : 'Sudah Dibayar';
    const confirm = await showConfirm(`Ubah status pembayaran gaji ${item.nama} menjadi "${newStatus}"?`);
    if (!confirm) return;

    setLoading(true);
    try {
      const res = await runBackend<{ success: boolean; message?: string }>(
        'savePayrollPayment',
        item.idPegawai,
        periodeQuery,
        {
          ...item,
          statusPembayaran: newStatus
        }
      );
      if (!res?.success) throw new Error(res?.message || 'Gagal mengubah status bayar');
      loadPayroll();
      await showAlert(`Status gaji ${item.nama} berhasil diubah ke ${newStatus}!`, 'success');
    } catch (err) {
      console.error(err);
      await showAlert('Gagal mengubah status pembayaran.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  const handleSendSlipWhatsApp = (item: PayrollItem) => {
    const rawPhone = formatWaPhone(item.noHp);

    const bulanLabel = BULAN_OPTIONS.find(b => b.value === selectedBulan)?.label || selectedBulan;

    const msg = [
      `*SLIP GAJI KARYAWAN — DUA SISI LAUNDRY*`,
      `Periode: *${bulanLabel} ${selectedTahun}*`,
      `-----------------------------------------`,
      `Nama Pegawai : *${item.nama}*`,
      `Jabatan      : ${item.jabatan}`,
      `Status Kerja : ${item.statusKepegawaian || 'Tetap'}`,
      `Kehadiran    : ${item.jumlahHadir} Hari (${item.totalJamKerja} Jam Kerja)`,
      `-----------------------------------------`,
      `*PENERIMAAN:*`,
      `+ Gaji Pokok            : Rp ${item.gajiPokok.toLocaleString('id-ID')}`,
      `+ Tunjangan Kehadiran   : Rp ${(item.tunjanganKehadiran || item.tunjangan).toLocaleString('id-ID')} (${item.jumlahHadir} Hari Hadir)`,
      `+ Insentif Drop Off     : Rp ${(item.insentifDropOff || 0).toLocaleString('id-ID')} (${item.totalTahapKhusus || 0} Tahap Khusus)`,
      ...(item.dropoffKhususBreakdown && Object.keys(item.dropoffKhususBreakdown).length > 0
        ? Object.entries(item.dropoffKhususBreakdown).map(([st, val]) => `  • ${st}: ${val.count}x @Rp ${val.rate.toLocaleString('id-ID')} = Rp ${val.subtotal.toLocaleString('id-ID')}`)
        : []),
      ``,
      `*POTONGAN:*`,
      item.dendaTelat && item.dendaTelat > 0 ? `- Denda Keterlambatan   : Rp ${item.dendaTelat.toLocaleString('id-ID')} (${item.jumlahTelat}x Telat)` : null,
      `- Potongan Lain/Rutin   : Rp ${(item.potonganRutin || item.potongan || 0).toLocaleString('id-ID')}`,
      `-----------------------------------------`,
      `*TOTAL GAJI BERSIH (TAKE HOME PAY):*`,
      `*Rp ${item.totalGajiBersih.toLocaleString('id-ID')}*`,
      `-----------------------------------------`,
      `Rekening Tujuan : ${item.bank || 'Tunai'} ${item.noRekening || ''} (${item.namaRekening || item.nama})`,
      `Status Bayar    : *${item.statusPembayaran.toUpperCase()}*`,
      ``,
      `_Terima kasih atas kerja keras dan dedikasinya di Dua Sisi Laundry!_`
    ].filter(Boolean).join('\n');

    const url = rawPhone 
      ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const isKhususStep = (stepName: string) => {
    const s = (stepName || '').trim().toLowerCase();
    const umum = (dropoffConfig.umumSteps || ['Pesanan Diterima', 'Diterima', 'Siap Diambil', 'Selesai']).map(u => u.trim().toLowerCase());
    return !umum.includes(s);
  };

  // Dinamis menghitung insentif berdasarkan tarif pipeline khusus terkini
  const computedItems = React.useMemo<PayrollItem[]>(() => {
    if (!payrollData?.items) return [];

    return payrollData.items.map(item => {
      const breakdown = item.dropoffBreakdown || {};
      const khususBreakdown: Record<string, { count: number; rate: number; subtotal: number }> = {};
      const umumBreakdown: Record<string, number> = {};
      let totalKhusus = 0;
      let totalInsentifKhusus = 0;

      Object.entries(breakdown).forEach(([step, count]) => {
        if (isKhususStep(step)) {
          const rate = dropoffConfig.rates[step] !== undefined ? dropoffConfig.rates[step] : 1500;
          const subtotal = count * rate;
          khususBreakdown[step] = { count, rate, subtotal };
          totalKhusus += count;
          totalInsentifKhusus += subtotal;
        } else {
          umumBreakdown[step] = count;
        }
      });

      const gajiPokok = item.gajiPokok || 0;
      const tunjangan = item.tunjanganKehadiran || item.tunjangan || 0;
      const potongan = item.potongan || 0;
      const insentifDropOff = totalInsentifKhusus;
      const totalGajiBersih = Math.max(0, gajiPokok + tunjangan + insentifDropOff - potongan);

      return {
        ...item,
        insentifDropOff,
        bonusKomisi: insentifDropOff,
        totalTahapKhusus: totalKhusus,
        dropoffKhususBreakdown: khususBreakdown,
        dropoffUmumBreakdown: umumBreakdown,
        totalGajiBersih,
      };
    });
  }, [payrollData, dropoffConfig]);

  const allKhususSteps = React.useMemo(() => {
    const rawSteps = payrollData?.allDropoffSteps || [];
    const configSteps = dropoffConfig.customSteps || Object.keys(dropoffConfig.rates);
    const combined = Array.from(new Set([...rawSteps, ...configSteps]));
    return combined.filter(s => isKhususStep(s));
  }, [payrollData, dropoffConfig]);

  const filteredItems = React.useMemo(() => {
    return computedItems.filter(item => {
      const matchStatus = filterStatus === 'Semua' || item.statusPembayaran === filterStatus;
      const q = search.toLowerCase().trim();
      const matchSearch = !q || 
        item.nama.toLowerCase().includes(q) || 
        item.jabatan.toLowerCase().includes(q) ||
        (item.bank && item.bank.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [computedItems, filterStatus, search]);

  const totalPengeluaranGajiComputed = React.useMemo(() => {
    return computedItems.reduce((acc, it) => acc + (it.totalGajiBersih || 0), 0);
  }, [computedItems]);

  const totalGajiPokokComputed = React.useMemo(() => {
    return computedItems.reduce((acc, it) => acc + (it.gajiPokok || 0), 0);
  }, [computedItems]);

  const totalTunjanganComputed = React.useMemo(() => {
    return computedItems.reduce((acc, it) => acc + (it.tunjanganKehadiran || it.tunjangan || 0), 0);
  }, [computedItems]);

  const totalInsentifDropoffComputed = React.useMemo(() => {
    return computedItems.reduce((acc, it) => acc + (it.insentifDropOff || 0), 0);
  }, [computedItems]);

  const totalPotonganComputed = React.useMemo(() => {
    return computedItems.reduce((acc, it) => acc + (it.potongan || 0), 0);
  }, [computedItems]);

  const handleExportCSV = () => {
    if (!payrollData || !payrollData.items) return;
    const bulanLabel = BULAN_OPTIONS.find(b => b.value === selectedBulan)?.label || selectedBulan;
    const headers = [
      'Periode', 'ID Pegawai', 'Nama Pegawai', 'Jabatan', 'Status Pegawai', 'No HP',
      'Kehadiran (Hari)', 'Total Jam Kerja', 'Jumlah Keterlambatan',
      'Gaji Pokok', 'Tunjangan', 'Insentif Drop Off (Khusus)', 'Total Tahap Khusus', 'Potongan', 'Total Gaji Bersih',
      'Bank', 'No Rekening', 'Atas Nama', 'Status Pembayaran', 'Metode Bayar', 'Catatan'
    ];
    const rows: (string | number)[][] = computedItems.map(i => [
      `${bulanLabel} ${selectedTahun}`, i.idPegawai, i.nama, i.jabatan, i.statusKepegawaian || '', i.noHp || '',
      i.jumlahHadir, i.totalJamKerja, i.jumlahTelat,
      i.gajiPokok || 0, (i.tunjanganKehadiran || i.tunjangan || 0), i.insentifDropOff || 0, i.totalTahapKhusus || 0, i.potongan || 0, i.totalGajiBersih || 0,
      i.bank || '', i.noRekening || '', i.namaRekening || '', i.statusPembayaran, i.metodePembayaran || '', i.catatan || ''
    ]);
    downloadCSV(`Payroll_DuaSisi_${selectedTahun}_${selectedBulan}.csv`, toCSV(headers, rows));
  };

  const bulanLabel = BULAN_OPTIONS.find(b => b.value === selectedBulan)?.label || selectedBulan;

  return (
    <div className="p-3 sm:p-4 md:p-5 lg:p-6 space-y-6 w-full print:p-0 print:m-0">
      
      {/* Header Bar (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <RupiahIcon className="w-6 h-6 text-[#1E4648]" />
            <span>Payroll & Penggajian Karyawan</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Hitung total anggaran gaji bulanan, integrasi data absensi & komisi pengerjaan drop off, serta cetak slip gaji karyawan.
          </p>
        </div>

        {/* Periode Selector & Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          {/* Month Selector */}
          <select
            value={selectedBulan}
            onChange={e => setSelectedBulan(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1E4648]"
          >
            {BULAN_OPTIONS.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedTahun}
            onChange={e => setSelectedTahun(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#1E4648]"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          <button
            onClick={loadPayroll}
            title="Segarkan Payroll"
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setInsentifModalTab('Matriks');
              setShowInsentifModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-emerald-300 text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Lihat Rincian Kontribusi & Insentif Drop Off Pegawai"
          >
            <Award className="w-3.5 h-3.5 text-emerald-600" />
            <span>Rekap Insentif Drop Off</span>
          </button>

          <button
            onClick={() => {
              setDraftRates({ ...dropoffConfig.rates });
              setInsentifModalTab('Pengaturan');
              setShowInsentifModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-teal-300 text-teal-900 bg-teal-50/80 hover:bg-teal-100 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Atur Besaran Nilai Insentif Tiap Pipeline Khusus"
          >
            <Sliders className="w-3.5 h-3.5 text-[#1E4648]" />
            <span>Atur Tarif Insentif</span>
          </button>

          <button
            onClick={openSalaryConfigModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-2xs"
            title="Atur Gaji Pokok, Tunjangan & Rekening Seluruh Pegawai"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Pengaturan Gaji Master</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Rekap CSV</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Cards (Hidden on print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        
        {/* Total Pengeluaran Gaji */}
        <div className="bg-gradient-to-br from-[#1E4648] to-[#122B2C] text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-teal-200 uppercase tracking-wider">Total Gaji Bersih</span>
            <RupiahIcon className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="text-2xl font-black tracking-tight">
              Rp {totalPengeluaranGajiComputed.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-teal-100/80 mt-1">
              Periode {bulanLabel} {selectedTahun}
            </div>
          </div>
        </div>

        {/* Total Gaji Pokok & Tunjangan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pokok & Tunjangan</span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">
              Rp {(totalGajiPokokComputed + totalTunjanganComputed).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
              <span>Pokok: Rp {totalGajiPokokComputed.toLocaleString('id-ID')}</span>
              <span>Tunj: Rp {totalTunjanganComputed.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Total Bonus & Potongan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Insentif vs Potongan</span>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 flex items-baseline gap-2">
              <span className="text-emerald-600 font-extrabold">+Rp {totalInsentifDropoffComputed.toLocaleString('id-ID')}</span>
              <span className="text-rose-500 text-sm font-semibold">-Rp {totalPotonganComputed.toLocaleString('id-ID')}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Insentif pengerjaan khusus & potongan staf
            </div>
          </div>
        </div>

        {/* Status Realisasi Pembayaran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Pembayaran</span>
            <ShieldCheck className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="text-emerald-600 font-extrabold">{payrollData?.sudahDibayarCount || 0} Lunas</span>
              <span className="text-slate-300">/</span>
              <span className="text-amber-600 font-semibold">{payrollData?.belumDibayarCount || 0} Pending</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Dari total {payrollData?.totalPegawai || 0} staf aktif
            </div>
          </div>
        </div>

      </div>

      {/* Filter & Search Bar (Hidden on print) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs print:hidden">
        <div className="flex bg-slate-100 p-0.5 rounded-lg gap-1 w-full sm:w-auto">
          {(['Semua', 'Belum Dibayar', 'Sudah Dibayar'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                filterStatus === st ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama pegawai, jabatan..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#1E4648]"
          />
        </div>
      </div>

      {/* Payroll Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Pegawai</th>
                <th className="py-3.5 px-3">Absensi</th>
                <th className="py-3.5 px-3 text-right">Gaji Pokok</th>
                <th className="py-3.5 px-3 text-right">Tunjangan Hadir</th>
                <th className="py-3.5 px-3 text-right">Insentif Drop Off</th>
                <th className="py-3.5 px-3 text-right">Potongan & Denda</th>
                <th className="py-3.5 px-4 text-right font-black text-slate-900">Total Bersih</th>
                <th className="py-3.5 px-3">Rekening</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-center print:hidden">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.idPegawai} className="hover:bg-slate-50/60 transition-colors">
                  
                  {/* Pegawai Info */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 text-sm">{item.nama}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{item.jabatan} • {item.statusKepegawaian || 'Tetap'}</div>
                  </td>

                  {/* Absensi */}
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-slate-700">{item.jumlahHadir} Hari</div>
                    <div className="text-[10px] text-slate-400">{item.totalJamKerja} Jam {item.jumlahTelat > 0 && `• ${item.jumlahTelat}x Telat`}</div>
                  </td>

                  {/* Gaji Pokok */}
                  <td className="py-3.5 px-3 text-right font-semibold text-slate-700">
                    Rp {item.gajiPokok.toLocaleString('id-ID')}
                  </td>

                  {/* Tunjangan Hadir */}
                  <td className="py-3.5 px-3 text-right font-semibold text-slate-700">
                    <div>Rp {(item.tunjanganKehadiran || item.tunjangan).toLocaleString('id-ID')}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{item.jumlahHadir} Hari Hadir</div>
                  </td>

                  {/* Insentif Drop Off */}
                  <td className="py-3.5 px-3 text-right font-semibold text-emerald-600">
                    <div className="font-extrabold text-sm">+Rp {(item.insentifDropOff || 0).toLocaleString('id-ID')}</div>
                    <div className="text-[10px] text-emerald-700 font-bold">{item.totalTahapKhusus || 0} Tahap Khusus</div>
                    {item.dropoffKhususBreakdown && Object.keys(item.dropoffKhususBreakdown).length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1 mt-1 max-w-[220px] ml-auto">
                        {Object.entries(item.dropoffKhususBreakdown).map(([st, data]) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setSelectedInsentifStaffId(item.idPegawai);
                              setInsentifModalTab('DetailStaff');
                              setShowInsentifModal(true);
                            }}
                            title={`Klik untuk lihat rincian ${st} oleh ${item.nama}`}
                            className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200/90 shadow-2xs transition cursor-pointer"
                          >
                            <span>{st}: {data.count}x</span>
                            <span className="text-[8px] text-emerald-600 font-normal">(@Rp {data.rate.toLocaleString('id-ID')})</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {item.dropoffUmumBreakdown && Object.keys(item.dropoffUmumBreakdown).length > 0 && (
                      <div className="text-[9px] text-slate-400 mt-1 font-medium">
                        Umum: {Object.values(item.dropoffUmumBreakdown).reduce((a, b) => a + b, 0)}x (Rp 0)
                      </div>
                    )}
                  </td>

                  {/* Potongan & Denda */}
                  <td className="py-3.5 px-3 text-right font-semibold text-rose-500">
                    <div>-Rp {item.potongan.toLocaleString('id-ID')}</div>
                    {item.dendaTelat && item.dendaTelat > 0 ? (
                      <div className="text-[10px] text-rose-600 font-normal">Denda: Rp {item.dendaTelat.toLocaleString('id-ID')}</div>
                    ) : null}
                  </td>

                  {/* Total Bersih */}
                  <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                    Rp {item.totalGajiBersih.toLocaleString('id-ID')}
                  </td>

                  {/* Rekening */}
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-slate-700">{item.bank || 'Tunai'}</div>
                    <div className="text-[10px] text-slate-400">{item.noRekening || '-'}</div>
                  </td>

                  {/* Status Pembayaran */}
                  <td className="py-3.5 px-3 text-center">
                    <button
                      onClick={() => handleTogglePaymentStatus(item)}
                      title="Klik untuk ubah status pembayaran"
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                        item.statusPembayaran === 'Sudah Dibayar'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      {item.statusPembayaran === 'Sudah Dibayar' ? (
                        <><Check className="w-3 h-3" /> Lunas</>
                      ) : (
                        <><Clock className="w-3 h-3" /> Pending</>
                      )}
                    </button>
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEditPayModal(item)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Penyesuaian Bonus / Potongan"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openSlipModal(item)}
                        className="p-1.5 text-slate-400 hover:text-[#1E4648] hover:bg-slate-100 rounded-lg transition"
                        title="Lihat & Cetak Slip Gaji"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSendSlipWhatsApp(item)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Kirim Slip via WhatsApp"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <RupiahIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-xs">Tidak ada data payroll untuk periode {bulanLabel} {selectedTahun}.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== MODAL SLIP GAJI FORMAL ==================== */}
      {showSlipModal && activeSlipItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-6 print:shadow-none print:border-none print:p-0 print:max-w-none">
            
            {/* Modal Actions Bar (Hidden on print) */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1E4648]" />
                <h3 className="font-bold text-slate-800 text-base">Slip Gaji Karyawan</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak / PDF
                </button>
                <button
                  onClick={() => handleSendSlipWhatsApp(activeSlipItem)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button onClick={() => setShowSlipModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE SLIP CONTENT */}
            <div ref={printSlipRef} className="text-slate-800 text-xs space-y-5">
              
              {/* Slip Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <img src="./assets/Asset 5.svg" alt="Dua Sisi" className="h-10 w-auto" />
                  <div>
                    <h2 className="font-black text-base text-slate-900 tracking-tight uppercase">Dua Sisi Laundry</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Laundry Express & Coin • Outlet Resmi</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-[#1E4648] uppercase tracking-wider">SLIP GAJI</div>
                  <div className="text-[11px] font-bold text-slate-600">{bulanLabel} {selectedTahun}</div>
                </div>
              </div>

              {/* Employee & Attendance Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <div><span className="text-slate-400">Nama Pegawai :</span> <strong className="text-slate-800">{activeSlipItem.nama}</strong></div>
                  <div><span className="text-slate-400">Jabatan      :</span> <strong>{activeSlipItem.jabatan}</strong></div>
                  <div><span className="text-slate-400">Status Kerja :</span> <strong>{activeSlipItem.statusKepegawaian || 'Tetap'}</strong></div>
                </div>
                <div className="space-y-1 text-right">
                  <div><span className="text-slate-400">Kehadiran :</span> <strong>{activeSlipItem.jumlahHadir} Hari Kerja</strong></div>
                  <div><span className="text-slate-400">Total Jam :</span> <strong>{activeSlipItem.totalJamKerja} Jam</strong></div>
                  <div><span className="text-slate-400">Metode    :</span> <strong>{activeSlipItem.bank || 'Tunai'} {activeSlipItem.noRekening || ''}</strong></div>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Penerimaan */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 text-xs border-b border-slate-200">
                    A. PENERIMAAN
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gaji Pokok</span>
                      <span className="font-bold">Rp {activeSlipItem.gajiPokok.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <div>
                        <span className="text-slate-600">Tunjangan Kehadiran</span>
                        <div className="text-[10px] text-slate-400 font-normal">{activeSlipItem.jumlahHadir} Hari Hadir</div>
                      </div>
                      <span className="font-bold">Rp {(activeSlipItem.tunjanganKehadiran || activeSlipItem.tunjangan).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <div>
                        <span className="text-slate-600">Insentif Drop Off</span>
                        <div className="text-[10px] text-emerald-600 font-normal">{activeSlipItem.totalTahapKhusus || 0} Tahap Khusus Selesai</div>
                      </div>
                      <span className="font-bold text-emerald-600">+Rp {(activeSlipItem.insentifDropOff || 0).toLocaleString('id-ID')}</span>
                    </div>
                    {activeSlipItem.dropoffKhususBreakdown && Object.keys(activeSlipItem.dropoffKhususBreakdown).length > 0 && (
                      <div className="pl-2 border-l-2 border-emerald-200 text-[10px] text-slate-500 space-y-0.5">
                        {Object.entries(activeSlipItem.dropoffKhususBreakdown).map(([st, val]) => (
                          <div key={st} className="flex justify-between">
                            <span>• {st} ({val.count}x @Rp {val.rate.toLocaleString('id-ID')})</span>
                            <span className="font-medium text-slate-700">Rp {val.subtotal.toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800">
                      <span>Total Penerimaan</span>
                      <span>Rp {(activeSlipItem.gajiPokok + (activeSlipItem.tunjanganKehadiran || activeSlipItem.tunjangan) + (activeSlipItem.insentifDropOff || 0)).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                {/* Potongan */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 text-xs border-b border-slate-200">
                    B. POTONGAN
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    {activeSlipItem.dendaTelat && activeSlipItem.dendaTelat > 0 ? (
                      <div className="flex justify-between">
                        <div>
                          <span className="text-slate-600">Denda Keterlambatan</span>
                          <div className="text-[10px] text-rose-500 font-normal">{activeSlipItem.jumlahTelat}x Terlambat</div>
                        </div>
                        <span className="font-bold text-rose-500">-Rp {activeSlipItem.dendaTelat.toLocaleString('id-ID')}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <span className="text-slate-600">Potongan Rutin / BPJS / Kasbon</span>
                      <span className="font-bold text-rose-500">-Rp {(activeSlipItem.potonganRutin || activeSlipItem.potongan || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800">
                      <span>Total Potongan</span>
                      <span className="text-rose-500">Rp {activeSlipItem.potongan.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Total Take Home Pay Box */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-teal-300 font-bold uppercase tracking-wider">GAJI BERSIH (TAKE HOME PAY)</div>
                  <div className="text-[10px] text-slate-400">Total penerimaan setelah dikurangi potongan</div>
                </div>
                <div className="text-xl font-black tracking-tight text-amber-300">
                  Rp {activeSlipItem.totalGajiBersih.toLocaleString('id-ID')}
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs">
                <div>
                  <p className="text-slate-400 mb-12">Diterima Oleh,</p>
                  <p className="font-bold text-slate-800 border-t border-slate-300 pt-1.5 inline-block min-w-[140px]">
                    {activeSlipItem.nama}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 mb-12">Disetujui Oleh,</p>
                  <p className="font-bold text-slate-800 border-t border-slate-300 pt-1.5 inline-block min-w-[140px]">
                    Manager / Finance
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ==================== MODAL PENYESUAIAN GAJI ==================== */}
      {showEditPayModal && editItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Penyesuaian Gaji — {editItem.nama}</h3>
                <p className="text-xs text-slate-500">Periode {bulanLabel} {selectedTahun}</p>
              </div>
              <button onClick={() => setShowEditPayModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gaji Pokok (Rp)</label>
                  <input
                    type="number"
                    value={editGajiPokok}
                    onChange={e => setEditGajiPokok(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#1E4648]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tunjangan (Rp)</label>
                  <input
                    type="number"
                    value={editTunjangan}
                    onChange={e => setEditTunjangan(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#1E4648]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bonus / Komisi (Rp)</label>
                  <input
                    type="number"
                    value={editBonus}
                    onChange={e => setEditBonus(e.target.value)}
                    placeholder="Contoh: 150000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#1E4648]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Potongan / Kasbon (Rp)</label>
                  <input
                    type="number"
                    value={editPotongan}
                    onChange={e => setEditPotongan(e.target.value)}
                    placeholder="Contoh: 50000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#1E4648]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Metode Pembayaran</label>
                <select
                  value={editMetode}
                  onChange={e => setEditMetode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#1E4648]"
                >
                  <option value="Transfer">Transfer Bank ({editItem.bank || 'Bank'})</option>
                  <option value="Tunai">Tunai / Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={editCatatan}
                  onChange={e => setEditCatatan(e.target.value)}
                  placeholder="Misal: Bonus lembur akhir pekan..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Checkbox Simpan ke Master Pegawai */}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-emerald-50/70 border border-emerald-200/80 p-2.5 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editSyncMaster}
                  onChange={e => setEditSyncMaster(e.target.checked)}
                  className="rounded text-[#1E4648] focus:ring-[#1E4648]"
                />
                <span>Simpan juga perubahan ini sebagai Gaji Pokok & Tunjangan permanen di profil Pegawai</span>
              </label>

              {/* Preview Total Bersih */}
              <div className="bg-slate-100 p-3 rounded-xl flex items-center justify-between font-bold">
                <span>Total Bersih Baru:</span>
                <span className="text-[#1E4648] text-sm">
                  Rp {Math.max(0, (Number(editGajiPokok) || 0) + (Number(editTunjangan) || 0) + (Number(editBonus) || 0) - (Number(editPotongan) || 0)).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-5">
              <button
                type="button"
                onClick={() => setShowEditPayModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSaveEditPayroll}
                className="px-5 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan Penyesuaian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL PENGATURAN MASTER GAJI PEGAWAI ==================== */}
      {showSalaryConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#1E4648]" />
                  <span>Pengaturan Gaji Pokok, Tunjangan & Rekening Pegawai</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Atur paket kompensasi default setiap pegawai untuk perhitungan otomatis payroll bulanan.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSalaryConfigModal(false);
                  setEditingMasterPegawai(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Table of Employees with Quick Edit */}
            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">Pegawai</th>
                    <th className="py-3 px-3.5">Gaji Pokok</th>
                    <th className="py-3 px-3.5">Tunjangan</th>
                    <th className="py-3 px-3.5">Potongan Rutin</th>
                    <th className="py-3 px-3.5">Bank & Rekening</th>
                    <th className="py-3 px-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {masterPegawaiList.map(peg => {
                    const isEditingThis = editingMasterPegawai?.id === peg.id;
                    return (
                      <tr key={peg.id} className={isEditingThis ? 'bg-teal-50/50' : 'hover:bg-slate-50/60'}>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-800">{peg.nama}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{peg.id} • {peg.jabatan}</div>
                        </td>
                        
                        {isEditingThis ? (
                          <>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={masterGajiPokok}
                                onChange={e => setMasterGajiPokok(e.target.value)}
                                className="w-28 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-[#1E4648] text-xs focus:outline-none focus:border-[#1E4648]"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={masterTunjangan}
                                onChange={e => setMasterTunjangan(e.target.value)}
                                className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-emerald-700 text-xs focus:outline-none focus:border-[#1E4648]"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={masterPotongan}
                                onChange={e => setMasterPotongan(e.target.value)}
                                className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-rose-600 text-xs focus:outline-none focus:border-[#1E4648]"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <div className="space-y-1">
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={masterBank}
                                    onChange={e => setMasterBank(e.target.value)}
                                    placeholder="Bank"
                                    className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-bold"
                                  />
                                  <input
                                    type="text"
                                    value={masterNoRekening}
                                    onChange={e => setMasterNoRekening(e.target.value)}
                                    placeholder="No Rekening"
                                    className="w-28 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px]"
                                  />
                                </div>
                                <input
                                  type="text"
                                  value={masterNamaRekening}
                                  onChange={e => setMasterNamaRekening(e.target.value)}
                                  placeholder="Atas Nama"
                                  className="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px]"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  disabled={savingSalaryId === peg.id}
                                  onClick={handleSaveMasterPegawaiSalary}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs"
                                >
                                  {savingSalaryId === peg.id ? '...' : 'Simpan'}
                                </button>
                                <button
                                  onClick={() => setEditingMasterPegawai(null)}
                                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition"
                                >
                                  Batal
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-3.5 font-bold text-[#1E4648]">
                              Rp {(peg.gajiPokok || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-3.5 font-semibold text-emerald-700">
                              Rp {(peg.tunjangan || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-3.5 font-semibold text-rose-600">
                              Rp {(peg.potongan || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-3.5">
                              {peg.bank ? (
                                <div>
                                  <span className="font-bold text-slate-700">{peg.bank}</span> {peg.noRekening || '-'}
                                  {peg.namaRekening && <div className="text-[10px] text-slate-400">a.n {peg.namaRekening}</div>}
                                </div>
                              ) : (
                                <span className="text-slate-400">Belum diatur</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <button
                                onClick={() => openEditMasterPegawaiSalary(peg)}
                                className="px-3 py-1 bg-slate-100 hover:bg-[#1E4648] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition"
                              >
                                Edit Gaji
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4 mt-4">
              <button
                onClick={() => {
                  setShowSalaryConfigModal(false);
                  setEditingMasterPegawai(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL REKAPITULASI & PENGATURAN INSENTIF DROP OFF ==================== */}
      {showInsentifModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 my-6 max-h-[92vh] flex flex-col">
            
            {/* Modal Header & Tab Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-800">
                    Insentif Drop Off Pegawai — Periode {bulanLabel} {selectedTahun}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Perhitungan komisi berbasis tahapan <strong>Pipeline Khusus</strong> (Dicuci, Dikeringkan, Disetrika, Packing, dll). Pipeline Umum bernilai Rp 0.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* 3 Tabs Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                  <button
                    onClick={() => setInsentifModalTab('Matriks')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      insentifModalTab === 'Matriks'
                        ? 'bg-white text-[#1E4648] shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Matriks Rekap</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!selectedInsentifStaffId && computedItems.length > 0) {
                        setSelectedInsentifStaffId(computedItems[0].idPegawai);
                      }
                      setInsentifModalTab('DetailStaff');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      insentifModalTab === 'DetailStaff'
                        ? 'bg-white text-[#1E4648] shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Rincian Per Staf</span>
                  </button>
                  <button
                    onClick={() => {
                      setDraftRates({ ...dropoffConfig.rates });
                      setInsentifModalTab('Pengaturan');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      insentifModalTab === 'Pengaturan'
                        ? 'bg-white text-[#1E4648] shadow-xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Atur Tarif</span>
                  </button>
                </div>

                <button
                  onClick={() => setShowInsentifModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              
              {/* ================= TAB 1: MATRIKS REKAP ================= */}
              {insentifModalTab === 'Matriks' && (
                <div className="space-y-4">
                  
                  {/* Notice Banner */}
                  <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-3.5 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-[#1E4648] shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-700">
                      <strong>Ketentuan Insentif:</strong> Setiap kolom di bawah ini adalah <strong>Pipeline Khusus</strong> berbayar.
                      Pipeline umum seperti <em>Pesanan Diterima</em>, <em>Siap Diambil</em>, dan <em>Selesai</em> adalah SOP standar dan bernilai <strong>Rp 0</strong>.
                    </div>
                  </div>

                  {/* Filter Search inside Modal */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={insentifSearchQuery}
                        onChange={e => setInsentifSearchQuery(e.target.value)}
                        placeholder="Cari nama staf..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Menampilkan {computedItems.length} staf aktif
                    </div>
                  </div>

                  {/* Matriks Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Nama Pegawai</th>
                          <th className="py-3 px-3">Jabatan</th>
                          
                          {/* Special Pipeline Columns with Rate Badges */}
                          {allKhususSteps.map(st => {
                            const rate = dropoffConfig.rates[st] !== undefined ? dropoffConfig.rates[st] : 1500;
                            return (
                              <th key={st} className="py-2.5 px-3 text-center bg-teal-50/60 text-[#1E4648] border-x border-teal-100/50 min-w-[90px]">
                                <div>{st}</div>
                                <div className="text-[9px] font-normal text-teal-700">@Rp {rate.toLocaleString('id-ID')}</div>
                              </th>
                            );
                          })}

                          <th className="py-3 px-3 text-center font-black bg-emerald-50 text-emerald-900 min-w-[100px]">
                            Total Khusus
                          </th>
                          <th className="py-3 px-4 text-right font-black bg-emerald-100/70 text-emerald-950 min-w-[110px]">
                            Total Insentif
                          </th>
                          <th className="py-3 px-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {computedItems
                          .filter(it => !insentifSearchQuery || it.nama.toLowerCase().includes(insentifSearchQuery.toLowerCase()))
                          .map(item => {
                            return (
                              <tr key={item.idPegawai} className="hover:bg-slate-50/70 transition">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900">{item.nama}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{item.idPegawai}</div>
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-600">
                                  {item.jabatan}
                                </td>

                                {/* Step Counts & Subtotal */}
                                {allKhususSteps.map(st => {
                                  const data = item.dropoffKhususBreakdown?.[st];
                                  const count = data?.count || 0;
                                  const subtotal = data?.subtotal || 0;
                                  return (
                                    <td key={st} className="py-3 px-3 text-center border-x border-slate-100">
                                      {count > 0 ? (
                                        <div>
                                          <span className="inline-block bg-teal-100 text-[#1E4648] font-black px-2 py-0.5 rounded-md text-xs border border-teal-200">
                                            {count}x
                                          </span>
                                          <div className="text-[9px] text-teal-800/80 font-bold mt-0.5">
                                            Rp {subtotal.toLocaleString('id-ID')}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-300">-</span>
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Total Tahap Khusus */}
                                <td className="py-3 px-3 text-center font-bold text-emerald-800 bg-emerald-50/40">
                                  <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-black">
                                    {item.totalTahapKhusus || 0} Tahap
                                  </span>
                                </td>

                                {/* Total Insentif */}
                                <td className="py-3 px-4 text-right font-black text-emerald-700 bg-emerald-50/60 text-sm">
                                  Rp {(item.insentifDropOff || 0).toLocaleString('id-ID')}
                                </td>

                                {/* Action */}
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => {
                                      setSelectedInsentifStaffId(item.idPegawai);
                                      setInsentifModalTab('DetailStaff');
                                    }}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-[#1E4648] hover:text-white text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1 mx-auto"
                                    title="Lihat Rincian Riwayat Tugas Staf Ini"
                                  >
                                    <span>Detail</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      
                      {/* Grand Total Footer */}
                      <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                        <tr>
                          <td colSpan={2} className="py-3 px-4 uppercase text-[11px] tracking-wider font-black">
                            Total Seluruh Staf
                          </td>
                          {allKhususSteps.map(st => {
                            const totalCount = computedItems.reduce((acc, it) => acc + (it.dropoffKhususBreakdown?.[st]?.count || 0), 0);
                            const totalSubtotal = computedItems.reduce((acc, it) => acc + (it.dropoffKhususBreakdown?.[st]?.subtotal || 0), 0);
                            return (
                              <td key={st} className="py-3 px-3 text-center border-x border-slate-200">
                                <div className="font-extrabold text-[#1E4648]">{totalCount}x</div>
                                <div className="text-[9px] text-teal-800 font-bold">Rp {totalSubtotal.toLocaleString('id-ID')}</div>
                              </td>
                            );
                          })}
                          <td className="py-3 px-3 text-center font-black text-emerald-900 bg-emerald-100/60">
                            {computedItems.reduce((acc, it) => acc + (it.totalTahapKhusus || 0), 0)} Tahap
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-900 bg-emerald-100 text-sm">
                            Rp {computedItems.reduce((acc, it) => acc + (it.insentifDropOff || 0), 0).toLocaleString('id-ID')}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                </div>
              )}

              {/* ================= TAB 2: RINCIAN PER STAF ================= */}
              {insentifModalTab === 'DetailStaff' && (() => {
                const selectedStaff = computedItems.find(it => it.idPegawai === selectedInsentifStaffId) || computedItems[0];
                if (!selectedStaff) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Tidak ada data staf untuk ditampilkan.
                    </div>
                  );
                }

                const totalUmumCount = Object.values(selectedStaff.dropoffUmumBreakdown || {}).reduce((a, b) => a + b, 0);

                return (
                  <div className="space-y-4">
                    
                    {/* Staff Selector Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Pilih Staf:</span>
                      {computedItems.map(staf => (
                        <button
                          key={staf.idPegawai}
                          onClick={() => setSelectedInsentifStaffId(staf.idPegawai)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                            selectedStaff.idPegawai === staf.idPegawai
                              ? 'bg-[#1E4648] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {staf.nama}
                        </button>
                      ))}
                    </div>

                    {/* Staff KPI Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      
                      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-4 rounded-2xl shadow-xs">
                        <div className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider">Total Insentif Khusus</div>
                        <div className="text-2xl font-black mt-1">
                          Rp {(selectedStaff.insentifDropOff || 0).toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-emerald-100/80 mt-0.5">
                          Siap ditransfer / dibayarkan dalam slip gaji
                        </div>
                      </div>

                      <div className="bg-teal-50/80 border border-teal-200 p-4 rounded-2xl">
                        <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">Pengerjaan Pipeline Khusus</div>
                        <div className="text-2xl font-black text-[#1E4648] mt-1">
                          {selectedStaff.totalTahapKhusus || 0} <span className="text-sm font-semibold">Tahap Selesai</span>
                        </div>
                        <div className="text-[10px] text-teal-700 mt-0.5">
                          Tercatat sebagai pengerja/petugas pengerjaan
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tahapan Pipeline Umum</div>
                        <div className="text-2xl font-black text-slate-700 mt-1">
                          {totalUmumCount} <span className="text-sm font-semibold">Tugas (Rp 0)</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Diterima, siap diambil, atau transaksi selesai
                        </div>
                      </div>

                    </div>

                    {/* Breakdown per Pipeline Sections */}
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Rincian Pengerjaan Pipeline Khusus (Berinsentif):</span>
                      </div>

                      {Object.keys(selectedStaff.dropoffKhususBreakdown || {}).length === 0 ? (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                          Staf ini belum memiliki riwayat pengerjaan pipeline khusus pada periode ini.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(selectedStaff.dropoffKhususBreakdown || {}).map(([st, data]) => (
                            <div key={st} className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-slate-900 text-xs">{st}</span>
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                  {data.count}x Selesai
                                </span>
                              </div>
                              <div className="flex items-baseline justify-between border-t border-slate-100 pt-2 text-xs">
                                <span className="text-slate-400 text-[11px]">Tarif: @Rp {data.rate.toLocaleString('id-ID')}</span>
                                <span className="font-extrabold text-emerald-700">Rp {data.subtotal.toLocaleString('id-ID')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pipeline Umum (Standar) */}
                    {selectedStaff.dropoffUmumBreakdown && Object.keys(selectedStaff.dropoffUmumBreakdown).length > 0 && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="text-xs font-bold text-slate-600 mb-2 flex items-center justify-between">
                          <span>Tahapan Pipeline Umum (Standar Bebas Insentif - Rp 0):</span>
                          <span className="text-[10px] font-normal text-slate-400">Standar Operasional SOP</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(selectedStaff.dropoffUmumBreakdown).map(([st, count]) => (
                            <span key={st} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium">
                              <span>{st}:</span>
                              <strong className="text-slate-900">{count}x</strong>
                              <span className="text-[10px] text-slate-400">(Rp 0)</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed Task History (if available) */}
                    {selectedStaff.dropoffDetailedTasks && selectedStaff.dropoffDetailedTasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Log Riwayat Tugas Pesanan:</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            Total {selectedStaff.dropoffDetailedTasks.length} aktivitas terekam
                          </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">No. Order / Pelanggan</th>
                                <th className="py-2.5 px-3">Tahapan Pipeline</th>
                                <th className="py-2.5 px-3">Waktu Selesai</th>
                                <th className="py-2.5 px-3 text-right">Nilai Insentif</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedStaff.dropoffDetailedTasks.map((task, idx) => {
                                const isKhusus = task.stepCategory === 'khusus' || task.isKhusus;
                                const rate = task.incentiveRate !== undefined ? task.incentiveRate : (task.tarif || 0);
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50">
                                    <td className="py-2 px-3">
                                      <div className="font-bold text-slate-800">{task.orderId || task.noNota}</div>
                                      <div className="text-[10px] text-slate-400">{task.customerName || task.namaPelanggan || '-'}</div>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isKhusus
                                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}>
                                        {task.stepName || task.namaStep}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-slate-500 text-[11px]">
                                      {formatDateTime(task.completedAt || task.waktuSelesai)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                      {isKhusus ? `+Rp ${rate.toLocaleString('id-ID')}` : 'Rp 0'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}

              {/* ================= TAB 3: PENGATURAN TARIF ================= */}
              {insentifModalTab === 'Pengaturan' && (
                <div className="space-y-5">
                  
                  {/* Banner Description */}
                  <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-4 flex items-start gap-3">
                    <Sliders className="w-5 h-5 text-[#1E4648] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1E4648]">Pengaturan Nilai Insentif Tiap Pipeline Khusus</h4>
                      <p className="text-xs text-slate-600 mt-1">
                        Atur nilai nominal (Rp) yang diberikan kepada staf setiap kali menyelesaikan satu tahapan pipeline khusus pada pesanan drop off.
                        Tarif ini hanya berlaku untuk <strong>Pipeline Khusus</strong>, sedangkan Pipeline Umum berstatus standar (Rp 0).
                      </p>
                    </div>
                  </div>

                  {/* List of Special Pipeline Steps with Rate Editors */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Daftar Pipeline Khusus & Tarif per Pengerjaan:</span>
                      <span className="text-[11px] text-slate-400">Diperbarui saat disimpan</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {allKhususSteps.map(stepName => {
                        const currentRate = draftRates[stepName] !== undefined ? draftRates[stepName] : 1500;
                        return (
                          <div key={stepName} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-teal-700" />
                                <span>{stepName}</span>
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                Pipeline Khusus
                              </span>
                            </div>

                            {/* Rate Input Field */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">Rp</span>
                              <input
                                type="number"
                                step="500"
                                min="0"
                                value={currentRate}
                                onChange={e => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  setDraftRates(prev => ({ ...prev, [stepName]: val }));
                                }}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-[#1E4648]"
                              />
                            </div>

                            {/* Quick Presets */}
                            <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-100">
                              <span className="text-[10px] text-slate-400 mr-1">Pilihan Cepat:</span>
                              {[1000, 1500, 2000, 2500, 3000].map(amt => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setDraftRates(prev => ({ ...prev, [stepName]: amt }))}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                                    currentRate === amt
                                      ? 'bg-[#1E4648] text-white shadow-2xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {amt.toLocaleString('id-ID')}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add New Custom Pipeline Step Form */}
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-teal-700" />
                      <span>Tambah Pipeline Khusus Baru:</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2.5">
                      <input
                        type="text"
                        placeholder="Nama pipeline (misal: Pewangi Karpet, Dry Clean Express)..."
                        value={newStepNameDraft}
                        onChange={e => setNewStepNameDraft(e.target.value)}
                        className="w-full sm:flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#1E4648]"
                      />
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <span className="text-xs font-bold text-slate-500">Rp</span>
                        <input
                          type="number"
                          step="500"
                          min="0"
                          placeholder="Tarif (Rp)"
                          value={newStepRateDraft}
                          onChange={e => setNewStepRateDraft(e.target.value)}
                          className="w-28 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#1E4648]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const name = newStepNameDraft.trim();
                          if (!name) return;
                          const rate = Math.max(0, Number(newStepRateDraft) || 0);
                          setDraftRates(prev => ({ ...prev, [name]: rate }));
                          const currentCustom = dropoffConfig.customSteps || [];
                          if (!currentCustom.includes(name)) {
                            setDropoffConfig(prev => ({
                              ...prev,
                              customSteps: [...(prev.customSteps || []), name]
                            }));
                          }
                          setNewStepNameDraft('');
                          setNewStepRateDraft('1500');
                        }}
                        className="w-full sm:w-auto px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Pipeline</span>
                      </button>
                    </div>
                  </div>

                  {/* Reference to Pipeline Umum */}
                  <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl">
                    <div className="flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-amber-900">Pipeline Umum (Standar Operasional Bebas Insentif):</h5>
                        <p className="text-xs text-amber-800/90 mt-0.5">
                          Tahapan di bawah ini otomatis dikelompokkan sebagai tugas umum (tarif Rp 0) sesuai SOP laundry:
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(dropoffConfig.umumSteps || ['Pesanan Diterima', 'Diterima', 'Siap Diambil', 'Selesai']).map(u => (
                            <span key={u} className="px-2.5 py-1 bg-white border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold">
                              {u} (Rp 0)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer for Settings */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftRates({ ...DEFAULT_DROPOFF_CONFIG.rates });
                      }}
                      className="text-xs text-slate-500 hover:text-rose-600 font-semibold transition"
                    >
                      Kembalikan Tarif ke Standar Default
                    </button>
                    <button
                      type="button"
                      disabled={savingDropoffConfig}
                      onClick={() => {
                        const newConfig: DropoffIncentiveConfig = {
                          ...dropoffConfig,
                          rates: draftRates,
                        };
                        handleSaveDropoffConfig(newConfig);
                      }}
                      className="px-5 py-2.5 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {savingDropoffConfig ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan Pengaturan Tarif</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Bottom Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4 mt-2">
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Perubahan tarif langsung mempengaruhi perhitungan slip gaji dan rekapitulasi penggajian.</span>
              </div>
              <button
                onClick={() => setShowInsentifModal(false)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup Jendela
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
