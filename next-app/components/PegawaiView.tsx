'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit3,
  Eye,
  Award, 
  Calendar, 
  Download, 
  Upload, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  GraduationCap, 
  Briefcase, 
  AlertCircle, 
  User, 
  CheckCircle2, 
  X,
  Building,
  LayoutList,
  LayoutGrid,
  Contact,
  Send
} from 'lucide-react';
import RupiahIcon from '@/components/RupiahIcon';
import IdCardModal from '@/components/IdCardModal';
import { runBackend } from '@/lib/api';
import { toCSV, downloadCSV } from '@/lib/csvUtils';
import { UserRole, PegawaiDetail } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

interface RekapKinerja {
  id: string;
  nama: string;
  jabatan: string;
  totalTransaksi: number;
  totalOmzet: number;
}

const DEFAULT_FORM_STATE: Partial<PegawaiDetail> = {
  nama: '',
  nik: '',
  namaPanggilan: '',
  foto: '',
  jenisKelamin: 'Laki-laki',
  tempatLahir: '',
  tanggalLahir: '',
  noHp: '',
  alamat: '',

  pendidikanJenjang: 'SMA/SMK',
  pendidikanInstitusi: '',
  pendidikanJurusan: '',
  pendidikanTahunMasuk: '',
  pendidikanTahunLulus: '',
  pendidikanStatus: 'Lulus',

  jabatan: 'Kasir / Staff',
  statusKepegawaian: 'Tetap',
  tanggalMasuk: '',
  tanggalKeluar: '',
  shiftUtama: 'Pagi',
  status: 'Aktif',

  gajiPokok: 0,
  tunjangan: 0,
  potongan: 0,
  bank: 'BCA',
  noRekening: '',
  namaRekening: '',

  kontakDaruratNama: '',
  kontakDaruratHubungan: 'Keluarga',
  kontakDaruratNoHp: ''
};

export default function PegawaiView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert, showConfirm } = useDialog();
  const [pegawaiList, setPegawaiList] = useState<PegawaiDetail[]>([]);
  const [kinerjaList, setKinerjaList] = useState<RekapKinerja[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'Aktif' | 'Nonaktif'>('Semua');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pribadi' | 'pendidikan' | 'pekerjaan' | 'penggajian' | 'darurat'>('pribadi');
  const [formData, setFormData] = useState<Partial<PegawaiDetail>>(DEFAULT_FORM_STATE);

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPegawai, setSelectedPegawai] = useState<PegawaiDetail | null>(null);

  // View Mode & ID Card Modal State
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [selectedIdCardPegawai, setSelectedIdCardPegawai] = useState<PegawaiDetail | null>(null);

  const openIdCardModal = (peg: PegawaiDetail) => {
    setSelectedIdCardPegawai(peg);
    setShowIdCardModal(true);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [pegRes, kinRes] = await Promise.all([
        runBackend<PegawaiDetail[]>('getPegawaiList').catch(() => []),
        runBackend<RekapKinerja[]>('getRekapKinerjaPegawai').catch(() => [])
      ]);
      if (Array.isArray(pegRes)) setPegawaiList(pegRes);
      if (Array.isArray(kinRes)) setKinerjaList(kinRes);
    } catch (err) {
      console.error('Gagal memuat data pegawai:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setIsEditMode(false);
    setEditId(null);
    setFormData({
      ...DEFAULT_FORM_STATE,
      tanggalMasuk: new Date().toISOString().slice(0, 10)
    });
    setActiveTab('pribadi');
    setShowModal(true);
  };

  const openEditModal = (peg: PegawaiDetail) => {
    setIsEditMode(true);
    setEditId(peg.id);
    setFormData({ ...peg });
    setActiveTab('pribadi');
    setShowModal(true);
  };

  const openDetailModal = (peg: PegawaiDetail) => {
    setSelectedPegawai(peg);
    setShowDetailModal(true);
  };

  const handleSavePegawai = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama?.trim()) {
      await showAlert('Nama Pegawai wajib diisi!', 'warning');
      setActiveTab('pribadi');
      return;
    }

    setLoading(true);
    try {
      if (isEditMode && editId) {
        const res = await runBackend<{ success: boolean; message?: string }>('updatePegawai', editId, formData);
        if (!res?.success) throw new Error(res?.message || 'Gagal memperbarui pegawai');
        await showAlert('Data pegawai berhasil diperbarui!', 'success');
      } else {
        const res = await runBackend<{ success: boolean; id?: string; message?: string }>('tambahPegawai', formData);
        if (!res?.success) throw new Error(res?.message || 'Gagal menambah pegawai');
        await showAlert('Pegawai baru berhasil ditambahkan!', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      await showAlert(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePegawai = async (id: string, namaPegawai: string) => {
    const isConfirmed = await showConfirm(`Hapus data pegawai "${namaPegawai}"?`);
    if (!isConfirmed) return;
    try {
      await runBackend('hapusPegawai', id);
      loadData();
      await showAlert('Pegawai berhasil dihapus.', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus pegawai', 'error');
    }
  };

  const handleExport = () => {
    const headers = [
      'ID Pegawai', 'NIK', 'Nama Lengkap', 'Nama Panggilan', 'Jenis Kelamin', 'Tempat Lahir', 'Tanggal Lahir', 'No HP', 'Alamat',
      'Pendidikan Jenjang', 'Institusi', 'Jurusan', 'Tahun Lulus',
      'Jabatan', 'Status Pegawai', 'Shift', 'Status',
      'Gaji Pokok', 'Tunjangan', 'Potongan', 'Bank', 'No Rekening', 'Atas Nama Rekening',
      'Kontak Darurat Nama', 'Kontak Darurat Hubungan', 'Kontak Darurat No HP'
    ];
    const rows = pegawaiList.map(p => [
      p.id, p.nik || '', p.nama, p.namaPanggilan || '', p.jenisKelamin || '', p.tempatLahir || '', p.tanggalLahir || '', p.noHp || '', p.alamat || '',
      p.pendidikanJenjang || '', p.pendidikanInstitusi || '', p.pendidikanJurusan || '', p.pendidikanTahunLulus || '',
      p.jabatan, p.statusKepegawaian || '', p.shiftUtama || '', p.status,
      p.gajiPokok || 0, p.tunjangan || 0, p.potongan || 0, p.bank || '', p.noRekening || '', p.namaRekening || '',
      p.kontakDaruratNama || '', p.kontakDaruratHubungan || '', p.kontakDaruratNoHp || ''
    ]);
    downloadCSV(`pegawai_duasisi_${Date.now()}.csv`, toCSV(headers, rows));
  };

  const filteredPegawai = pegawaiList.filter(p => {
    const matchStatus = filterStatus === 'Semua' || p.status === filterStatus;
    const q = search.toLowerCase().trim();
    const matchSearch = !q || 
      p.nama.toLowerCase().includes(q) || 
      (p.namaPanggilan && p.namaPanggilan.toLowerCase().includes(q)) || 
      (p.jabatan && p.jabatan.toLowerCase().includes(q)) || 
      (p.noHp && p.noHp.includes(q)) ||
      (p.nik && p.nik.includes(q));
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#1E4648]" />
            <span>Data Pegawai & Karyawan</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola profil lengkap staf, pendidikan, kontrak kerja, rekening payroll, dan kontak darurat.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            title="Segarkan Data"
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pegawai</span>
          </button>
        </div>
      </div>

      {/* Filter, Search Bar & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="flex bg-slate-100 p-0.5 rounded-xl gap-1">
            {(['Semua', 'Aktif', 'Nonaktif'] as const).map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterStatus === st ? 'bg-[#1E4648] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'table' ? 'bg-white text-[#1E4648] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Tabel (Rekomendasi)"
            >
              <LayoutList className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">Tabel</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'grid' ? 'bg-white text-[#1E4648] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Grid Kartu"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-[11px] hidden sm:inline">Kartu</span>
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIP, jabatan, HP..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
          />
        </div>
      </div>

      {/* 1. TABLE VIEW (DEFAULT) */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3.5 px-4">ID / NIP</th>
                  <th className="py-3.5 px-4">Pegawai</th>
                  <th className="py-3.5 px-4">Jabatan & Shift</th>
                  <th className="py-3.5 px-4">Kontak & WA</th>
                  <th className="py-3.5 px-4">Status Kerja</th>
                  <th className="py-3.5 px-4">Gaji Pokok & Rekening</th>
                  <th className="py-3.5 px-4">Total Kinerja</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-12" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredPegawai.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-xs">Tidak ada data pegawai yang sesuai.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPegawai.map(peg => {
                    const kin = kinerjaList.find(k => k.id === peg.id || k.nama === peg.nama);
                    const cleanPhone = (peg.noHp || '').replace(/[^0-9]/g, '');
                    const waPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.substring(1) : cleanPhone;

                    return (
                      <tr key={peg.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            {peg.id}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1E4648] to-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-2xs">
                              {peg.foto ? (
                                <img src={peg.foto} alt={peg.nama} className="w-full h-full object-cover" />
                              ) : (
                                <span>{(peg.nama || 'P').charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                                <span>{peg.nama}</span>
                                {peg.namaPanggilan && (
                                  <span className="text-[10px] text-slate-400 font-semibold">({peg.namaPanggilan})</span>
                                )}
                              </div>
                              {peg.nik && (
                                <div className="text-[10px] text-slate-400 font-mono">NIK: {peg.nik}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-teal-50 text-teal-800 border border-teal-200/60">
                            {peg.jabatan}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">Shift {peg.shiftUtama || 'Pagi'}</div>
                        </td>
                        <td className="py-3 px-4">
                          {peg.noHp ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-700">{peg.noHp}</span>
                              <a
                                href={`https://wa.me/${waPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition"
                                title="Chat WhatsApp"
                              >
                                <Send className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-700">{peg.statusKepegawaian || 'Tetap'}</div>
                          <div className="text-[10px] text-slate-400">{peg.pendidikanJenjang || 'SMA/SMK'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1E4648]">Rp {(peg.gajiPokok || 0).toLocaleString('id-ID')}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                            {peg.bank ? `${peg.bank} ${peg.noRekening || ''}` : 'Belum diatur'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {kin ? (
                            <div>
                              <div className="font-bold text-amber-700">{kin.totalTransaksi} Transaksi</div>
                              <div className="text-[10px] text-slate-400">Rp {kin.totalOmzet.toLocaleString('id-ID')}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">0 Trx</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            peg.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {peg.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openDetailModal(peg)}
                              className="p-1.5 text-slate-500 hover:text-[#1E4648] hover:bg-slate-100 rounded-lg transition"
                              title="Lihat Profil Lengkap"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openIdCardModal(peg)}
                              className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg transition"
                              title="Buat / Cetak ID Card (54mm × 85mm)"
                            >
                              <Contact className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(peg)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title="Edit Data Pegawai"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePegawai(peg.id, peg.nama)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus Pegawai"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      ) : (
        /* 2. GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPegawai.map(peg => {
            const kin = kinerjaList.find(k => k.id === peg.id || k.nama === peg.nama);
            return (
              <div 
                key={peg.id} 
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group"
              >
                <div>
                  {/* Header Profile */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1E4648] to-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-xs overflow-hidden">
                        {peg.foto ? (
                          <img src={peg.foto} alt={peg.nama} className="w-full h-full object-cover" />
                        ) : (
                          <span>{peg.nama ? peg.nama.charAt(0).toUpperCase() : 'P'}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-snug flex items-center gap-1.5">
                          <span>{peg.nama}</span>
                          {peg.namaPanggilan && (
                            <span className="text-[11px] font-semibold text-slate-400">({peg.namaPanggilan})</span>
                          )}
                        </h3>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {peg.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-teal-50 text-teal-800 border border-teal-200/60">
                            {peg.jabatan}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      peg.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {peg.status}
                    </span>
                  </div>

                  {/* Quick Info Grid */}
                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> No. HP:
                      </span>
                      <span className="font-semibold">{peg.noHp || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5" /> Status / Shift:
                      </span>
                      <span className="font-semibold">{peg.statusKepegawaian || 'Tetap'} • Shift {peg.shiftUtama || 'Pagi'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Rekening:
                      </span>
                      <span className="font-semibold truncate max-w-[150px]">
                        {peg.bank ? `${peg.bank} ${peg.noRekening || ''}` : 'Belum diatur'}
                      </span>
                    </div>
                  </div>

                  {/* Kinerja Badge */}
                  {kin && (
                    <div className="flex items-center justify-between bg-amber-50/60 border border-amber-200/70 px-3 py-1.5 rounded-xl text-[11px] mb-3 text-amber-900">
                      <span className="flex items-center gap-1 font-semibold">
                        <Award className="w-3.5 h-3.5 text-amber-600" /> Total Transaksi:
                      </span>
                      <span className="font-bold">{kin.totalTransaksi} Trx (Rp {kin.totalOmzet.toLocaleString('id-ID')})</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => openDetailModal(peg)}
                    className="p-1.5 text-slate-500 hover:text-[#1E4648] hover:bg-slate-100 rounded-lg transition"
                    title="Lihat Profil Lengkap"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openIdCardModal(peg)}
                    className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-lg transition"
                    title="Buat ID Card (54mm × 85mm)"
                  >
                    <Contact className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditModal(peg)}
                    className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                    title="Edit Data Pegawai"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePegawai(peg.id, peg.nama)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Hapus Pegawai"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredPegawai.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Tidak ada data pegawai yang sesuai.</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== ADD / EDIT PEGAWAI MODAL ==================== */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {isEditMode ? 'Edit Data Pegawai' : 'Tambah Pegawai Baru'}
                </h2>
                <p className="text-xs text-slate-500">
                  Semua field bersifat <strong>opsional</strong> (hanya Nama yang wajib).
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 mb-5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('pribadi')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'pribadi' ? 'bg-white text-[#1E4648] shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Pribadi
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pendidikan')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'pendidikan' ? 'bg-white text-[#1E4648] shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" /> Pendidikan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pekerjaan')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'pekerjaan' ? 'bg-white text-[#1E4648] shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" /> Pekerjaan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('penggajian')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'penggajian' ? 'bg-white text-[#1E4648] shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <RupiahIcon className="w-3.5 h-3.5" /> Payroll
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('darurat')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'darurat' ? 'bg-white text-[#1E4648] shadow-xs' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" /> Kontak Darurat
              </button>
            </div>

            {/* FORM CONTENT */}
            <form onSubmit={handleSavePegawai}>
              
              {/* 1. DATA PRIBADI */}
              {activeTab === 'pribadi' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                      <input
                        type="text"
                        required
                        value={formData.nama || ''}
                        onChange={e => setFormData({ ...formData, nama: e.target.value })}
                        placeholder="Contoh: Budi Santoso"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Panggilan</label>
                      <input
                        type="text"
                        value={formData.namaPanggilan || ''}
                        onChange={e => setFormData({ ...formData, namaPanggilan: e.target.value })}
                        placeholder="Contoh: Budi"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">NIK (Nomor Induk Kependudukan)</label>
                      <input
                        type="text"
                        value={formData.nik || ''}
                        onChange={e => setFormData({ ...formData, nik: e.target.value })}
                        placeholder="16 digit NIK KTP"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                      <select
                        value={formData.jenisKelamin || 'Laki-laki'}
                        onChange={e => setFormData({ ...formData, jenisKelamin: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tempat Lahir</label>
                      <input
                        type="text"
                        value={formData.tempatLahir || ''}
                        onChange={e => setFormData({ ...formData, tempatLahir: e.target.value })}
                        placeholder="Contoh: Jakarta"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Lahir</label>
                      <input
                        type="date"
                        value={formData.tanggalLahir || ''}
                        onChange={e => setFormData({ ...formData, tanggalLahir: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">No. HP / WhatsApp</label>
                      <input
                        type="text"
                        value={formData.noHp || ''}
                        onChange={e => setFormData({ ...formData, noHp: e.target.value })}
                        placeholder="0812xxxxxxxx"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">URL Foto Profil (Opsional)</label>
                      <input
                        type="url"
                        value={formData.foto || ''}
                        onChange={e => setFormData({ ...formData, foto: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Tinggal</label>
                    <textarea
                      rows={2}
                      value={formData.alamat || ''}
                      onChange={e => setFormData({ ...formData, alamat: e.target.value })}
                      placeholder="Alamat domisili lengkap..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                    />
                  </div>
                </div>
              )}

              {/* 2. PENDIDIKAN */}
              {activeTab === 'pendidikan' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Jenjang Pendidikan</label>
                      <select
                        value={formData.pendidikanJenjang || 'SMA/SMK'}
                        onChange={e => setFormData({ ...formData, pendidikanJenjang: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="SMP">SMP / MTs</option>
                        <option value="SMA/SMK">SMA / SMK / MA</option>
                        <option value="Diploma (D3)">Diploma (D3)</option>
                        <option value="Sarjana (S1)">Sarjana (S1)</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Status Kelulusan</label>
                      <select
                        value={formData.pendidikanStatus || 'Lulus'}
                        onChange={e => setFormData({ ...formData, pendidikanStatus: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="Lulus">Lulus</option>
                        <option value="Sedang Menempuh">Sedang Menempuh</option>
                        <option value="Tidak Lulus">Tidak Lulus</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Institusi / Sekolah</label>
                      <input
                        type="text"
                        value={formData.pendidikanInstitusi || ''}
                        onChange={e => setFormData({ ...formData, pendidikanInstitusi: e.target.value })}
                        placeholder="Contoh: SMKN 1 Jakarta"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Jurusan / Peminatan</label>
                      <input
                        type="text"
                        value={formData.pendidikanJurusan || ''}
                        onChange={e => setFormData({ ...formData, pendidikanJurusan: e.target.value })}
                        placeholder="Contoh: Tata Niaga / Otomotif / IPA"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Masuk</label>
                      <input
                        type="text"
                        value={formData.pendidikanTahunMasuk || ''}
                        onChange={e => setFormData({ ...formData, pendidikanTahunMasuk: e.target.value })}
                        placeholder="Contoh: 2018"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tahun Lulus</label>
                      <input
                        type="text"
                        value={formData.pendidikanTahunLulus || ''}
                        onChange={e => setFormData({ ...formData, pendidikanTahunLulus: e.target.value })}
                        placeholder="Contoh: 2021"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. PEKERJAAN */}
              {activeTab === 'pekerjaan' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Jabatan / Posisi</label>
                      <select
                        value={formData.jabatan || 'Kasir / Staff'}
                        onChange={e => setFormData({ ...formData, jabatan: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="Kasir / Staff">Kasir / Front Desk</option>
                        <option value="Operator Cuci & Lipat">Operator Cuci & Lipat</option>
                        <option value="Operator Setrika / Press">Operator Setrika / Press</option>
                        <option value="Kurir / Antar-Jemput">Kurir / Antar-Jemput</option>
                        <option value="Supervisor Outlet">Supervisor Outlet</option>
                        <option value="Manager">Manager Outlet</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Status Kepegawaian</label>
                      <select
                        value={formData.statusKepegawaian || 'Tetap'}
                        onChange={e => setFormData({ ...formData, statusKepegawaian: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="Tetap">Karyawan Tetap</option>
                        <option value="Kontrak">Karyawan Kontrak</option>
                        <option value="Part-time">Part-time / Paruh Waktu</option>
                        <option value="Harian Lepas">Harian Lepas</option>
                        <option value="Magang">Magang / Internship</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Shift Kerja Utama</label>
                      <select
                        value={formData.shiftUtama || 'Pagi'}
                        onChange={e => setFormData({ ...formData, shiftUtama: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="Pagi">Shift Pagi (07.00 - 15.00)</option>
                        <option value="Siang">Shift Siang (13.00 - 21.00)</option>
                        <option value="Malam">Shift Malam / Full</option>
                        <option value="Fleksibel">Fleksibel / Rolling</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Status Aktif</label>
                      <select
                        value={formData.status || 'Aktif'}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="Aktif">Aktif Bekerja</option>
                        <option value="Cuti">Cuti</option>
                        <option value="Nonaktif">Nonaktif / Resign</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Mulai Bekerja</label>
                      <input
                        type="date"
                        value={formData.tanggalMasuk || ''}
                        onChange={e => setFormData({ ...formData, tanggalMasuk: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Keluar (Jika Resign)</label>
                      <input
                        type="date"
                        value={formData.tanggalKeluar || ''}
                        onChange={e => setFormData({ ...formData, tanggalKeluar: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. PENGGAJIAN & REKENING */}
              {activeTab === 'penggajian' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Gaji Pokok (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.gajiPokok || ''}
                        onChange={e => setFormData({ ...formData, gajiPokok: Number(e.target.value) })}
                        placeholder="Contoh: 2500000"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tunjangan (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.tunjangan || ''}
                        onChange={e => setFormData({ ...formData, tunjangan: Number(e.target.value) })}
                        placeholder="Uang makan, transport"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Potongan Rutin (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.potongan || ''}
                        onChange={e => setFormData({ ...formData, potongan: Number(e.target.value) })}
                        placeholder="BPJS, kasbon"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Bank / E-Wallet</label>
                      <select
                        value={formData.bank || 'BCA'}
                        onChange={e => setFormData({ ...formData, bank: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="BCA">BCA</option>
                        <option value="Mandiri">Mandiri</option>
                        <option value="BRI">BRI</option>
                        <option value="BNI">BNI</option>
                        <option value="BSI">BSI (Syariah)</option>
                        <option value="CIMB Niaga">CIMB Niaga</option>
                        <option value="Bank Jago">Bank Jago</option>
                        <option value="SeaBank">SeaBank</option>
                        <option value="DANA">DANA</option>
                        <option value="GoPay">GoPay</option>
                        <option value="Tunai">Tunai (Tanpa Bank)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">No. Rekening</label>
                      <input
                        type="text"
                        value={formData.noRekening || ''}
                        onChange={e => setFormData({ ...formData, noRekening: e.target.value })}
                        placeholder="Contoh: 8830123456"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Atas Nama Rekening</label>
                      <input
                        type="text"
                        value={formData.namaRekening || ''}
                        onChange={e => setFormData({ ...formData, namaRekening: e.target.value })}
                        placeholder="Nama pemilik buku tabungan"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. KONTAK DARURAT */}
              {activeTab === 'darurat' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nama Kontak Darurat</label>
                      <input
                        type="text"
                        value={formData.kontakDaruratNama || ''}
                        onChange={e => setFormData({ ...formData, kontakDaruratNama: e.target.value })}
                        placeholder="Nama kerabat/keluarga"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Hubungan</label>
                      <select
                        value={formData.kontakDaruratHubungan || 'Keluarga'}
                        onChange={e => setFormData({ ...formData, kontakDaruratHubungan: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      >
                        <option value="Orang Tua">Orang Tua</option>
                        <option value="Suami / Istri">Suami / Istri</option>
                        <option value="Saudara Kandung">Saudara Kandung</option>
                        <option value="Keluarga">Keluarga</option>
                        <option value="Teman">Teman</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">No. HP Darurat</label>
                      <input
                        type="text"
                        value={formData.kontakDaruratNoHp || ''}
                        onChange={e => setFormData({ ...formData, kontakDaruratNoHp: e.target.value })}
                        placeholder="0812xxxxxxxx"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1E4648]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* FOOTER ACTIONS */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-6">
                <div className="text-[11px] text-slate-400">
                  Tab saat ini: <strong className="capitalize">{activeTab}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                  >
                    {loading ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Tambah Pegawai'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DETAIL PROFIL PEGAWAI MODAL ==================== */}
      {showDetailModal && selectedPegawai && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#1E4648] text-white flex items-center justify-center font-bold text-xl shadow-xs overflow-hidden">
                  {selectedPegawai.foto ? (
                    <img src={selectedPegawai.foto} alt={selectedPegawai.nama} className="w-full h-full object-cover" />
                  ) : (
                    <span>{selectedPegawai.nama.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-snug">
                    {selectedPegawai.nama} {selectedPegawai.namaPanggilan && `(${selectedPegawai.namaPanggilan})`}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-teal-50 text-teal-800 border border-teal-200/60">
                      {selectedPegawai.jabatan}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedPegawai.status === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {selectedPegawai.status}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Tabs & Detail Sections */}
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 text-xs">
              
              {/* 1. Data Pribadi */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xs border-b border-slate-200 pb-1.5 mb-2">
                  <User className="w-4 h-4 text-[#1E4648]" /> Data Pribadi
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div><span className="text-slate-400">NIK:</span> <strong>{selectedPegawai.nik || '-'}</strong></div>
                  <div><span className="text-slate-400">Gender:</span> <strong>{selectedPegawai.jenisKelamin || '-'}</strong></div>
                  <div><span className="text-slate-400">TTL:</span> <strong>{selectedPegawai.tempatLahir || '-'}, {selectedPegawai.tanggalLahir || '-'}</strong></div>
                  <div><span className="text-slate-400">No. HP:</span> <strong>{selectedPegawai.noHp || '-'}</strong></div>
                  <div className="col-span-2"><span className="text-slate-400">Alamat:</span> <strong>{selectedPegawai.alamat || '-'}</strong></div>
                </div>
              </div>

              {/* 2. Pendidikan */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xs border-b border-slate-200 pb-1.5 mb-2">
                  <GraduationCap className="w-4 h-4 text-[#1E4648]" /> Pendidikan Terakhir
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div><span className="text-slate-400">Jenjang:</span> <strong>{selectedPegawai.pendidikanJenjang || '-'}</strong></div>
                  <div><span className="text-slate-400">Status:</span> <strong>{selectedPegawai.pendidikanStatus || '-'}</strong></div>
                  <div><span className="text-slate-400">Institusi:</span> <strong>{selectedPegawai.pendidikanInstitusi || '-'}</strong></div>
                  <div><span className="text-slate-400">Jurusan:</span> <strong>{selectedPegawai.pendidikanJurusan || '-'}</strong></div>
                  <div><span className="text-slate-400">Periode:</span> <strong>{selectedPegawai.pendidikanTahunMasuk || '-'} - {selectedPegawai.pendidikanTahunLulus || '-'}</strong></div>
                </div>
              </div>

              {/* 3. Pekerjaan & Kontrak */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xs border-b border-slate-200 pb-1.5 mb-2">
                  <Briefcase className="w-4 h-4 text-[#1E4648]" /> Pekerjaan & Shift
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div><span className="text-slate-400">Status Pegawai:</span> <strong>{selectedPegawai.statusKepegawaian || 'Tetap'}</strong></div>
                  <div><span className="text-slate-400">Shift Utama:</span> <strong>{selectedPegawai.shiftUtama || 'Pagi'}</strong></div>
                  <div><span className="text-slate-400">Tgl Masuk:</span> <strong>{selectedPegawai.tanggalMasuk || '-'}</strong></div>
                  <div><span className="text-slate-400">Tgl Keluar:</span> <strong>{selectedPegawai.tanggalKeluar || '-'}</strong></div>
                </div>
              </div>

              {/* 4. Rekening Payroll */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xs border-b border-slate-200 pb-1.5 mb-2">
                  <CreditCard className="w-4 h-4 text-[#1E4648]" /> Payroll & Rekening
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div><span className="text-slate-400">Gaji Pokok:</span> <strong>Rp {(selectedPegawai.gajiPokok || 0).toLocaleString('id-ID')}</strong></div>
                  <div><span className="text-slate-400">Tunjangan:</span> <strong>Rp {(selectedPegawai.tunjangan || 0).toLocaleString('id-ID')}</strong></div>
                  <div><span className="text-slate-400">Potongan:</span> <strong>Rp {(selectedPegawai.potongan || 0).toLocaleString('id-ID')}</strong></div>
                  <div><span className="text-slate-400">Bank & No Rek:</span> <strong>{selectedPegawai.bank || '-'} {selectedPegawai.noRekening || ''}</strong></div>
                  <div className="col-span-2"><span className="text-slate-400">Atas Nama:</span> <strong>{selectedPegawai.namaRekening || '-'}</strong></div>
                </div>
              </div>

              {/* 5. Kontak Darurat */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 text-xs border-b border-slate-200 pb-1.5 mb-2">
                  <AlertCircle className="w-4 h-4 text-[#1E4648]" /> Kontak Darurat
                </h4>
                <div className="grid grid-cols-3 gap-2 text-slate-600">
                  <div><span className="text-slate-400">Nama:</span> <strong>{selectedPegawai.kontakDaruratNama || '-'}</strong></div>
                  <div><span className="text-slate-400">Hubungan:</span> <strong>{selectedPegawai.kontakDaruratHubungan || '-'}</strong></div>
                  <div><span className="text-slate-400">No. HP:</span> <strong>{selectedPegawai.kontakDaruratNoHp || '-'}</strong></div>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  openEditModal(selectedPegawai);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Data Ini
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ID CARD GENERATOR MODAL ==================== */}
      <IdCardModal
        pegawai={selectedIdCardPegawai}
        isOpen={showIdCardModal}
        onClose={() => setShowIdCardModal(false)}
      />

    </div>
  );
}
