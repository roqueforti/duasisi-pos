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
  Edit2
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import { runBackend } from '@/lib/api';
import { toCSV, downloadCSV } from '@/lib/csvUtils';
import { UserRole, PayrollItem, PayrollSummary } from '@/lib/types';
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
    let rawPhone = String(item.noHp || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);

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
      `+ Gaji Pokok   : Rp ${item.gajiPokok.toLocaleString('id-ID')}`,
      `+ Tunjangan    : Rp ${item.tunjangan.toLocaleString('id-ID')}`,
      `+ Bonus/Komisi : Rp ${item.bonusKomisi.toLocaleString('id-ID')}`,
      ``,
      `*POTONGAN:*`,
      `- Potongan     : Rp ${item.potongan.toLocaleString('id-ID')}`,
      `-----------------------------------------`,
      `*TOTAL GAJI BERSIH (TAKE HOME PAY):*`,
      `👉 *Rp ${item.totalGajiBersih.toLocaleString('id-ID')}*`,
      `-----------------------------------------`,
      `Rekening Tujuan : ${item.bank || 'Tunai'} ${item.noRekening || ''} (${item.namaRekening || item.nama})`,
      `Status Bayar    : *${item.statusPembayaran.toUpperCase()}*`,
      ``,
      `_Terima kasih atas kerja keras dan dedikasinya di Dua Sisi Laundry!_`
    ].join('\n');

    const url = rawPhone 
      ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleExportCSV = () => {
    if (!payrollData || !payrollData.items) return;
    const bulanLabel = BULAN_OPTIONS.find(b => b.value === selectedBulan)?.label || selectedBulan;
    const headers = [
      'Periode', 'ID Pegawai', 'Nama Pegawai', 'Jabatan', 'Status Pegawai', 'No HP',
      'Kehadiran (Hari)', 'Total Jam Kerja', 'Jumlah Keterlambatan',
      'Gaji Pokok', 'Tunjangan', 'Bonus/Komisi', 'Potongan', 'Total Gaji Bersih',
      'Bank', 'No Rekening', 'Atas Nama', 'Status Pembayaran', 'Metode Bayar', 'Catatan'
    ];
    const rows = payrollData.items.map(i => [
      `${bulanLabel} ${selectedTahun}`, i.idPegawai, i.nama, i.jabatan, i.statusKepegawaian || '', i.noHp || '',
      i.jumlahHadir, i.totalJamKerja, i.jumlahTelat,
      i.gajiPokok, i.tunjangan, i.bonusKomisi, i.potongan, i.totalGajiBersih,
      i.bank || '', i.noRekening || '', i.namaRekening || '', i.statusPembayaran, i.metodePembayaran || '', i.catatan || ''
    ]);
    downloadCSV(`Payroll_DuaSisi_${selectedTahun}_${selectedBulan}.csv`, toCSV(headers, rows));
  };

  const filteredItems = (payrollData?.items || []).filter(item => {
    const matchStatus = filterStatus === 'Semua' || item.statusPembayaran === filterStatus;
    const q = search.toLowerCase().trim();
    const matchSearch = !q || 
      item.nama.toLowerCase().includes(q) || 
      item.jabatan.toLowerCase().includes(q) ||
      (item.bank && item.bank.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  const bulanLabel = BULAN_OPTIONS.find(b => b.value === selectedBulan)?.label || selectedBulan;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto print:p-0 print:m-0">
      
      {/* Header Bar (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <RupiahIcon className="w-6 h-6 text-[#1E4648]" />
            <span>Payroll & Penggajian Karyawan</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Hitung total anggaran gaji bulanan, integrasi data absensi & komisi, serta cetak slip gaji karyawan.
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
              Rp {(payrollData?.totalPengeluaranGaji || 0).toLocaleString('id-ID')}
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
              Rp {((payrollData?.totalGajiPokok || 0) + (payrollData?.totalTunjangan || 0)).toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
              <span>Pokok: Rp {(payrollData?.totalGajiPokok || 0).toLocaleString('id-ID')}</span>
              <span>Tunj: Rp {(payrollData?.totalTunjangan || 0).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Total Bonus & Potongan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bonus vs Potongan</span>
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900 flex items-baseline gap-2">
              <span className="text-emerald-600">+Rp {(payrollData?.totalBonus || 0).toLocaleString('id-ID')}</span>
              <span className="text-rose-500 text-sm font-semibold">-Rp {(payrollData?.totalPotongan || 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Komisi omzet staf & potongan kasbon/telat
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
                <th className="py-3.5 px-3 text-right">Tunjangan</th>
                <th className="py-3.5 px-3 text-right">Bonus/Komisi</th>
                <th className="py-3.5 px-3 text-right">Potongan</th>
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

                  {/* Tunjangan */}
                  <td className="py-3.5 px-3 text-right font-semibold text-slate-700">
                    Rp {item.tunjangan.toLocaleString('id-ID')}
                  </td>

                  {/* Bonus */}
                  <td className="py-3.5 px-3 text-right font-semibold text-emerald-600">
                    +Rp {item.bonusKomisi.toLocaleString('id-ID')}
                  </td>

                  {/* Potongan */}
                  <td className="py-3.5 px-3 text-right font-semibold text-rose-500">
                    -Rp {item.potongan.toLocaleString('id-ID')}
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
                      <span className="text-slate-600">Tunjangan</span>
                      <span className="font-bold">Rp {activeSlipItem.tunjangan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Bonus / Komisi</span>
                      <span className="font-bold text-emerald-600">+Rp {activeSlipItem.bonusKomisi.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800">
                      <span>Total Penerimaan</span>
                      <span>Rp {(activeSlipItem.gajiPokok + activeSlipItem.tunjangan + activeSlipItem.bonusKomisi).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                {/* Potongan */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 text-xs border-b border-slate-200">
                    B. POTONGAN
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Potongan Rutin / BPJS / Kasbon</span>
                      <span className="font-bold text-rose-500">-Rp {activeSlipItem.potongan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Keterlambatan</span>
                      <span>{activeSlipItem.jumlahTelat > 0 ? `${activeSlipItem.jumlahTelat}x Tercatat` : '0'}</span>
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

    </div>
  );
}
