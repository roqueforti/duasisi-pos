'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  RefreshCw, 
  UserCheck, 
  Calendar as CalendarIcon, 
  AlertTriangle, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Users, 
  ShieldAlert, 
  ShieldCheck,
  Sun, 
  Moon, 
  Coffee, 
  Check, 
  X,
  ChevronRight,
  TrendingDown,
  Sparkles,
  MapPin,
  Globe,
  Navigation,
  LocateFixed
} from 'lucide-react';
import { runBackend } from '@/lib/api';
import { 
  PegawaiDetail, 
  AbsensiConfig, 
  JadwalKerjaItem, 
  CutiItem, 
  HariLiburItem,
  UserRole
} from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import { formatTime } from '@/lib/utils';
import RupiahIcon from '@/components/RupiahIcon';
import { getCurrentGpsLocation, getClientIpAddress, validateAttendanceSecurity } from '@/lib/attendanceSecurity';

interface AbsensiRecord {
  id: string;
  tanggal: string;
  tanggalRaw?: string;
  namaPegawai: string;
  shift: string;
  clockIn: string;
  clockOut: string;
  durasi: string;
  catatan: string;
  menitTelat?: number;
  denda?: number;
  isFromShift?: boolean;
}

interface MasterShift {
  id: string;
  nama: string;
  jamMasuk: string;
  jamKeluar: string;
  keterangan?: string;
}

const HARI_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export default function AbsensiView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert, showConfirm } = useDialog();
  const [activeTab, setActiveTab] = useState<'presensi' | 'jadwal' | 'cuti' | 'libur'>('presensi');

  // Master Data
  const [pegawaiList, setPegawaiList] = useState<PegawaiDetail[]>([]);
  const [shiftList, setShiftList] = useState<MasterShift[]>([]);
  const [loading, setLoading] = useState(false);

  // Presensi State
  const [namaPegawai, setNamaPegawai] = useState('');
  const [shift, setShift] = useState('Shift 1 (Pagi)');
  const [catatan, setCatatan] = useState('');
  const [rekap, setRekap] = useState<AbsensiRecord[]>([]);

  // Config & Denda State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configModalTab, setConfigModalTab] = useState<'shift' | 'security'>('shift');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [ipLoading, setIpLoading] = useState(false);
  const [config, setConfig] = useState<AbsensiConfig>({
    jamBuka: '07:00',
    toleransiTelatMenit: 15,
    aktifDenda: false,
    tipeDenda: 'MENIT',
    tarifDenda: 1000,
    tunjanganKehadiranPerHari: 15000,
    insentifDropOffPerTahap: 1500,
    aktifIpWhitelist: false,
    ipWhitelist: '',
    aktifGeofence: false,
    outletLatitude: 0,
    outletLongitude: 0,
    geofenceRadiusMeter: 100
  });

  // Jadwal Kerja State
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedBulanJadwal, setSelectedBulanJadwal] = useState(currentMonthStr);
  const [jadwalList, setJadwalList] = useState<JadwalKerjaItem[]>([]);
  const [showAddJadwalModal, setShowAddJadwalModal] = useState(false);
  const [jadwalModalMode, setJadwalModalMode] = useState<'single' | 'weekly_off'>('weekly_off');
  const [formJadwal, setFormJadwal] = useState({
    idPegawai: '',
    namaPegawai: '',
    tanggal: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    shift: 'Shift 1 (Pagi)',
    status: 'Masuk' as 'Masuk' | 'Libur' | 'Cuti' | 'Tukar Shift',
    catatan: ''
  });

  // Auto Roster with 1 Day Off per Week
  const [autoHariLibur, setAutoHariLibur] = useState<string>('Minggu');
  const [autoShiftUtama, setAutoShiftUtama] = useState<string>('Shift 1 (Pagi)');

  const handleGenerateMonthlyRoster = async () => {
    if (!formJadwal.idPegawai) {
      await showAlert('Pilih pegawai terlebih dahulu!', 'warning');
      return;
    }
    const targetBulan = selectedBulanJadwal || currentMonthStr;
    const [yearStr, monthStr] = targetBulan.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const targetPeg = pegawaiList.find(p => p.id === formJadwal.idPegawai);
    const namaPeg = targetPeg ? targetPeg.nama : formJadwal.namaPegawai;

    const rowsToSave: any[] = [];
    let liburCount = 0;
    let kerjaCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayIndex = (dateObj.getDay() + 6) % 7; // 0: Senin, 6: Minggu
      const dayName = HARI_NAMES[dayIndex];

      const isOffDay = dayName.toLowerCase() === autoHariLibur.toLowerCase();
      if (isOffDay) liburCount++;
      else kerjaCount++;

      rowsToSave.push({
        idPegawai: formJadwal.idPegawai,
        namaPegawai: namaPeg,
        tanggal: dateStr,
        hari: dayName,
        shift: isOffDay ? 'Libur / Off Day' : autoShiftUtama,
        status: isOffDay ? 'Libur' : 'Masuk',
        catatan: isOffDay ? `Jatah Libur Mingguan (${dayName})` : 'Bertugas'
      });
    }

    setLoading(true);
    try {
      await runBackend('saveJadwalKerjaBatch', rowsToSave);
      setShowAddJadwalModal(false);
      await showAlert(
        `Roster ${namaPeg} berhasil digenerate untuk ${daysInMonth} hari (${kerjaCount} hari kerja & ${liburCount} hari libur setiap ${autoHariLibur})!`,
        'success'
      );
      loadInitialData();
    } catch (err) {
      console.error(err);
      await showAlert('Gagal generate roster bulanan', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cuti & Izin State
  const [cutiList, setCutiList] = useState<CutiItem[]>([]);
  const [showAddCutiModal, setShowAddCutiModal] = useState(false);
  const [formCuti, setFormCuti] = useState({
    idPegawai: '',
    namaPegawai: '',
    jenisCuti: 'Cuti Tahunan',
    tglMulai: new Date().toISOString().split('T')[0],
    tglSelesai: new Date().toISOString().split('T')[0],
    jumlahHari: 1,
    alasan: ''
  });

  // Hari Libur State
  const [liburList, setLiburList] = useState<HariLiburItem[]>([]);
  const [showAddLiburModal, setShowAddLiburModal] = useState(false);
  const [formLibur, setFormLibur] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    namaLibur: '',
    kategori: 'Libur Nasional' as 'Libur Nasional' | 'Libur Outlet',
    keterangan: ''
  });

  const [tabLoaded, setTabLoaded] = useState<{ jadwal: boolean; cuti: boolean; libur: boolean }>({
    jadwal: false,
    cuti: false,
    libur: false,
  });

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Muat hanya data esensial untuk Presensi (Rekap, Pegawai, MasterShift, Config)
      const [rekapRes, pegRes, shiftRes, configRes] = await Promise.all([
        runBackend<AbsensiRecord[]>('getRekapAbsensi').catch(() => []),
        runBackend<PegawaiDetail[]>('getPegawaiList').catch(() => []),
        runBackend<MasterShift[]>('getMasterShiftList').catch(() => []),
        runBackend<AbsensiConfig>('getAbsensiConfig').catch(() => null),
      ]);

      if (Array.isArray(rekapRes)) setRekap(rekapRes);
      if (Array.isArray(pegRes) && pegRes.length > 0) {
        const activeStaff = pegRes.filter(s => s.status !== 'Nonaktif' && s.status !== 'Resign');
        setPegawaiList(activeStaff);
        if (activeStaff.length > 0) {
          setNamaPegawai(activeStaff[0].nama);
          setFormJadwal(prev => ({ ...prev, idPegawai: activeStaff[0].id, namaPegawai: activeStaff[0].nama }));
          setFormCuti(prev => ({ ...prev, idPegawai: activeStaff[0].id, namaPegawai: activeStaff[0].nama }));
        }
      }
      if (Array.isArray(shiftRes) && shiftRes.length > 0) {
        setShiftList(shiftRes);
        // Auto-select shift berdasarkan jam saat ini (WIB)
        const curHour = new Date().getHours();
        const soreShift = shiftRes.find(s => s.nama.toLowerCase().includes('sore') || s.nama.toLowerCase().includes('malam') || s.nama.includes('2'));
        if (curHour >= 14 && soreShift) {
          setShift(soreShift.nama);
        } else {
          setShift(shiftRes[0].nama);
        }
      }
      if (configRes) setConfig(configRes);
    } catch (err) {
      console.error('Gagal memuat data awal absensi:', err);
    } finally {
      setLoading(false);
    }
  };

  // Lazy Load Data Khusus Tab Tertentu
  const loadTabSpecificData = async (tab: 'jadwal' | 'cuti' | 'libur') => {
    setLoading(true);
    try {
      if (tab === 'jadwal') {
        const jadwalRes = await runBackend<JadwalKerjaItem[]>('getJadwalKerjaList', selectedBulanJadwal).catch(() => []);
        if (Array.isArray(jadwalRes)) setJadwalList(jadwalRes);
        setTabLoaded(prev => ({ ...prev, jadwal: true }));
      } else if (tab === 'cuti') {
        const cutiRes = await runBackend<CutiItem[]>('getCutiList', selectedBulanJadwal).catch(() => []);
        if (Array.isArray(cutiRes)) setCutiList(cutiRes);
        setTabLoaded(prev => ({ ...prev, cuti: true }));
      } else if (tab === 'libur') {
        const liburRes = await runBackend<HariLiburItem[]>('getHariLiburList', String(now.getFullYear())).catch(() => []);
        if (Array.isArray(liburRes)) setLiburList(liburRes);
        setTabLoaded(prev => ({ ...prev, libur: true }));
      }
    } catch (err) {
      console.error(`Gagal memuat tab ${tab}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'jadwal') {
      loadTabSpecificData('jadwal');
    } else if (activeTab === 'cuti') {
      loadTabSpecificData('cuti');
    } else if (activeTab === 'libur') {
      loadTabSpecificData('libur');
    }
  }, [activeTab, selectedBulanJadwal]);


  // Presensi Actions
  const handleClockIn = async () => {
    if (!namaPegawai.trim()) { await showAlert('Pilih nama pegawai!', 'warning'); return; }
    setLoading(true);
    try {
      // 1. Validasi Keamanan Presensi: IP & GPS Whitelist
      const sec = await validateAttendanceSecurity(config);
      if (!sec.valid) {
        await showAlert(sec.message || 'Validasi lokasi/IP presensi gagal.', 'warning');
        return;
      }

      const res = await runBackend<{ message: string }>('clockInPegawai', namaPegawai.trim(), shift, catatan.trim());
      await showAlert(res?.message || 'Clock In Berhasil', 'success');
      setCatatan('');
      loadInitialData();
    } catch (err) {
      await showAlert('Gagal Clock In', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!namaPegawai.trim()) { await showAlert('Pilih nama pegawai!', 'warning'); return; }
    setLoading(true);
    try {
      // 1. Validasi Keamanan Presensi: IP & GPS Whitelist
      const sec = await validateAttendanceSecurity(config);
      if (!sec.valid) {
        await showAlert(sec.message || 'Validasi lokasi/IP presensi gagal.', 'warning');
        return;
      }

      const res = await runBackend<{ message: string }>('clockOutPegawai', namaPegawai.trim(), catatan.trim());
      await showAlert(res?.message || 'Clock Out Berhasil', 'success');
      setCatatan('');
      loadInitialData();
    } catch (err) {
      await showAlert('Gagal Clock Out', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGetGpsCurrent = async () => {
    setGpsLoading(true);
    try {
      const loc = await getCurrentGpsLocation();
      setConfig(prev => ({
        ...prev,
        outletLatitude: parseFloat(loc.latitude.toFixed(6)),
        outletLongitude: parseFloat(loc.longitude.toFixed(6)),
      }));
      await showAlert(`Titik koordinat berhasil didapatkan!\nLat: ${loc.latitude.toFixed(6)}, Lng: ${loc.longitude.toFixed(6)}\nAkurasi GPS: ±${Math.round(loc.accuracy)} meter`, 'success');
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mengambil lokasi GPS.', 'error');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleGetIpCurrent = async () => {
    setIpLoading(true);
    try {
      const ip = await getClientIpAddress();
      if (!ip) throw new Error('Tidak dapat mendeteksi IP jaringan saat ini.');
      const currentList = (config.ipWhitelist || '').split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
      if (!currentList.includes(ip)) {
        currentList.push(ip);
      }
      setConfig(prev => ({
        ...prev,
        ipWhitelist: currentList.join(', ')
      }));
      await showAlert(`IP ${ip} berhasil ditambahkan ke daftar whitelist!`, 'success');
    } catch (err: any) {
      await showAlert(err.message || 'Gagal mendeteksi IP.', 'error');
    } finally {
      setIpLoading(false);
    }
  };

  // Config & Denda Actions
  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      const res = await runBackend<{ success: boolean; message?: string }>('saveAbsensiConfig', config);
      if (!res?.success) throw new Error(res?.message || 'Gagal menyimpan');
      setShowConfigModal(false);
      await showAlert('Pengaturan denda & absensi berhasil disimpan!', 'success');
      loadInitialData();
    } catch (err) {
      await showAlert('Gagal menyimpan konfigurasi absensi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Jadwal Actions
  const handleSaveJadwal = async () => {
    if (!formJadwal.namaPegawai || !formJadwal.tanggal) {
      await showAlert('Pegawai dan tanggal wajib dipilih!', 'warning');
      return;
    }
    const d = new Date(formJadwal.tanggal);
    const dayIndex = (d.getDay() + 6) % 7; // 0: Senin
    const hari = HARI_NAMES[dayIndex];

    setLoading(true);
    try {
      await runBackend('saveJadwalKerjaBatch', [{
        ...formJadwal,
        hari
      }]);
      setShowAddJadwalModal(false);
      await showAlert('Jadwal kerja berhasil ditambahkan!', 'success');
      loadInitialData();
    } catch (err) {
      await showAlert('Gagal menyimpan jadwal', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJadwal = async (id: string) => {
    const confirm = await showConfirm('Hapus jadwal kerja ini?');
    if (!confirm) return;
    try {
      await runBackend('hapusJadwalKerja', id);
      loadInitialData();
      await showAlert('Jadwal berhasil dihapus.', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus jadwal', 'error');
    }
  };

  // Cuti Actions
  const handleSaveCuti = async () => {
    if (!formCuti.namaPegawai || !formCuti.tglMulai || !formCuti.tglSelesai) {
      await showAlert('Lengkapi data pengajuan cuti!', 'warning');
      return;
    }
    setLoading(true);
    try {
      await runBackend('tambahCuti', formCuti);
      setShowAddCutiModal(false);
      await showAlert('Pengajuan cuti berhasil dicatat!', 'success');
      loadInitialData();
    } catch (err) {
      await showAlert('Gagal mengajukan cuti', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatusCuti = async (id: string, status: 'Disetujui' | 'Ditolak') => {
    try {
      await runBackend('updateStatusCuti', id, status);
      loadInitialData();
      await showAlert(`Status cuti berhasil diubah menjadi ${status}!`, 'success');
    } catch (err) {
      await showAlert('Gagal mengubah status cuti', 'error');
    }
  };

  const handleDeleteCuti = async (id: string) => {
    const confirm = await showConfirm('Hapus data cuti ini?');
    if (!confirm) return;
    try {
      await runBackend('hapusCuti', id);
      loadInitialData();
      await showAlert('Data cuti berhasil dihapus.', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus cuti', 'error');
    }
  };

  // Hari Libur Actions
  const handleSaveLibur = async () => {
    if (!formLibur.namaLibur || !formLibur.tanggal) {
      await showAlert('Tanggal dan nama libur wajib diisi!', 'warning');
      return;
    }
    setLoading(true);
    try {
      await runBackend('tambahHariLibur', formLibur);
      setShowAddLiburModal(false);
      setFormLibur({ tanggal: new Date().toISOString().split('T')[0], namaLibur: '', kategori: 'Libur Nasional', keterangan: '' });
      await showAlert('Hari libur berhasil ditambahkan!', 'success');
      loadInitialData();
    } catch (err) {
      await showAlert('Gagal menambah libur', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLibur = async (id: string) => {
    const confirm = await showConfirm('Hapus hari libur ini?');
    if (!confirm) return;
    try {
      await runBackend('hapusHariLibur', id);
      loadInitialData();
      await showAlert('Hari libur dihapus.', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus libur', 'error');
    }
  };

  // Total denda terakumulasi
  const totalDendaBulanIni = rekap.reduce((acc, r) => acc + (r.denda || 0), 0);

  return (
    <div className="p-3 sm:p-4 md:p-5 lg:p-6 space-y-6 w-full">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-[#1E4648]" />
            <span>Absensi, Jadwal & Manajemen Cuti</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Presensi shift, jadwal kerja (roster), pengajuan cuti/izin, hari libur, dan kalkulasi denda keterlambatan.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadInitialData}
            title="Segarkan Data"
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {currentRole === 'MANAGER' && (
            <button
              onClick={() => {
                setConfigModalTab('shift');
                setShowConfigModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold transition shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 text-[#1E4648]" />
              <span>Pengaturan Denda & Keamanan</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1 overflow-x-auto">
        {[
          { id: 'presensi', label: 'Presensi & Rekap', icon: UserCheck },
          { id: 'jadwal', label: 'Jadwal Kerja (Roster)', icon: CalendarIcon },
          { id: 'cuti', label: 'Manajemen Cuti & Izin', icon: Coffee },
          { id: 'libur', label: 'Hari Libur & Kalender', icon: Sun },
        ].map(t => {
          const IconComp = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                isActive ? 'bg-[#1E4648] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <IconComp className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. TAB PRESENSI & REKAP */}
      {/* ========================================================================= */}
      {activeTab === 'presensi' && (
        <div className="space-y-5">
          {/* Clock In / Out Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Clock className="w-4 h-4 text-[#1E4648]" />
                <span>Clock In / Clock Out Shift</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {config.aktifGeofence && (
                  <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-800" title={`Geofence Radius: ${config.geofenceRadiusMeter || 100}m`}>
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    <span>GPS Whitelist Aktif</span>
                  </div>
                )}
                {config.aktifIpWhitelist && (
                  <div className="flex items-center gap-1 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full text-[10px] font-bold text-sky-800">
                    <Globe className="w-3 h-3 text-sky-600" />
                    <span>IP Whitelist Aktif</span>
                  </div>
                )}
                {config.aktifDenda && (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full text-[11px] font-bold text-rose-700">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>
                      Denda Aktif: Rp {config.tarifDenda.toLocaleString('id-ID')} / {config.tipeDenda === 'MENIT' ? 'Menit' : config.tipeDenda === 'JAM' ? 'Jam' : 'Telat'} (Toleransi {config.toleransiTelatMenit} Menit)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Pegawai *</label>
                <select
                  value={namaPegawai}
                  onChange={e => setNamaPegawai(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1E4648]"
                >
                  {pegawaiList.map(p => (
                    <option key={p.id} value={p.nama}>
                      {p.nama} ({p.jabatan})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Shift</label>
                <select
                  value={shift}
                  onChange={e => setShift(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1E4648]"
                >
                  {shiftList.length > 0 ? (
                    shiftList.map(s => (
                      <option key={s.id} value={s.nama}>
                        {s.nama} ({formatTime(s.jamMasuk)} - {formatTime(s.jamKeluar)})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Shift 1 (Pagi)">Shift 1 (07:00 - 15:00)</option>
                      <option value="Shift 2 (Sore/Malam)">Shift 2 (15:00 - 23:00)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan / Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={catatan}
                  onChange={e => setCatatan(e.target.value)}
                  placeholder="Misal: Tukar shift / izin keluar sebentar..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClockIn}
                disabled={loading}
                className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>Clock In (Masuk Shift)</span>
              </button>
              <button
                onClick={handleClockOut}
                disabled={loading}
                className="flex-1 bg-[#FF9500] hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Clock Out (Selesai Shift)</span>
              </button>
            </div>
          </div>

          {/* Rekap Absensi Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#1E4648]" />
                <h3 className="text-xs font-bold text-slate-800">Riwayat & Log Kehadiran Pegawai</h3>
              </div>

              {config.aktifDenda && (
                <div className="text-xs text-rose-700 font-bold bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
                  Total Denda Keterlambatan: Rp {totalDendaBulanIni.toLocaleString('id-ID')}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Pegawai</th>
                    <th className="py-3 px-4">Shift</th>
                    <th className="py-3 px-4">Clock In</th>
                    <th className="py-3 px-4">Clock Out</th>
                    <th className="py-3 px-4">Durasi</th>
                    <th className="py-3 px-4">Status Kehadiran</th>
                    <th className="py-3 px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                        <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                        <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                        <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                        <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                        <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                        <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                        <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                      </tr>
                    ))
                  ) : rekap.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-xs">Belum ada riwayat absensi pada periode ini.</p>
                      </td>
                    </tr>
                  ) : (
                    rekap.map(r => {
                      const isLate = r.catatan?.includes('[TERLAMBAT') || (r.menitTelat && r.menitTelat > 0);
                      return (
                        <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${isLate ? 'bg-amber-50/40' : ''}`}>
                          <td className="py-3 px-4 font-semibold text-slate-700">{r.tanggal}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{r.namaPegawai}</td>
                          <td className="py-3 px-4 text-slate-600">{r.shift}</td>
                          <td className={`py-3 px-4 font-bold ${isLate ? 'text-amber-700' : 'text-[#1E4648]'}`}>
                            {r.clockIn}
                          </td>
                          <td className="py-3 px-4 text-amber-700 font-semibold">{r.clockOut || '-'}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{r.durasi}</td>
                          <td className="py-3 px-4">
                            {isLate ? (
                              <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-200 inline-flex items-center gap-1">
                                <span>Terlambat</span>
                                {r.menitTelat ? <span className="font-normal">({r.menitTelat} mnt)</span> : null}
                              </span>
                            ) : r.isFromShift ? (
                              <span className="bg-teal-50 text-teal-800 font-bold px-2 py-0.5 rounded text-[11px] border border-teal-200 inline-flex items-center gap-1">
                                <span>Shift Kasir</span>
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded text-[11px] border border-emerald-200 inline-flex items-center gap-1">
                                <span>Tepat Waktu</span>
                              </span>
                            )}
                          </td>
                          <td className={`py-3 px-4 ${isLate ? 'text-amber-800 font-medium' : 'text-slate-500'}`}>
                            {r.catatan}
                          </td>
                        </tr>
                      );
                    })
                  )}

                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB JADWAL KERJA (ROSTER) */}
      {/* ========================================================================= */}
      {activeTab === 'jadwal' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Pilih Bulan Roster:</label>
              <input
                type="month"
                value={selectedBulanJadwal}
                onChange={e => setSelectedBulanJadwal(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#1E4648]"
              />
            </div>

            {currentRole === 'MANAGER' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setJadwalModalMode('weekly_off');
                    setShowAddJadwalModal(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  title="Generate otomatis 1 bulan jadwal dengan jatah 1 hari libur per minggu"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Auto Roster (6 Kerja + 1 Libur)</span>
                </button>

                <button
                  onClick={() => {
                    setJadwalModalMode('single');
                    setShowAddJadwalModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Jadwal Harian</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3.5 px-4">Tanggal & Hari</th>
                    <th className="py-3.5 px-4">Nama Pegawai</th>
                    <th className="py-3.5 px-4">Penugasan Shift</th>
                    <th className="py-3.5 px-4">Status Roster</th>
                    <th className="py-3.5 px-4">Catatan</th>
                    {currentRole === 'MANAGER' && <th className="py-3.5 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jadwalList.length === 0 ? (
                    <tr>
                      <td colSpan={currentRole === 'MANAGER' ? 6 : 5} className="py-12 text-center text-slate-400">
                        <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-xs">Belum ada roster jadwal untuk bulan ini.</p>
                      </td>
                    </tr>
                  ) : (
                    jadwalList.map(j => (
                      <tr key={j.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {j.tanggal} <span className="text-slate-400 font-semibold">({j.hari})</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#1E4648]">{j.namaPegawai}</td>
                        <td className="py-3 px-4 text-slate-700">{j.shift}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            j.status === 'Masuk' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            j.status === 'Libur' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {j.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{j.catatan || '-'}</td>
                        {currentRole === 'MANAGER' && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteJadwal(j.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB MANAJEMEN CUTI & IZIN */}
      {/* ========================================================================= */}
      {activeTab === 'cuti' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-xs font-bold text-slate-600">
              Daftar Permohonan & Catatan Cuti Pegawai
            </div>

            <button
              onClick={() => setShowAddCutiModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Ajukan / Catat Cuti Baru</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3.5 px-4">Pegawai</th>
                    <th className="py-3.5 px-4">Jenis Cuti</th>
                    <th className="py-3.5 px-4">Rentang Tanggal</th>
                    <th className="py-3.5 px-4">Durasi</th>
                    <th className="py-3.5 px-4">Alasan</th>
                    <th className="py-3.5 px-4">Status Persetujuan</th>
                    <th className="py-3.5 px-4 text-right">{currentRole === 'MANAGER' ? 'Aksi Persetujuan' : 'Keterangan'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cutiList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Coffee className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-xs">Belum ada data pengajuan cuti.</p>
                      </td>
                    </tr>
                  ) : (
                    cutiList.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{c.namaPegawai}</td>
                        <td className="py-3 px-4 font-semibold text-teal-800">{c.jenisCuti}</td>
                        <td className="py-3 px-4 text-slate-700">
                          {c.tglMulai} s/d {c.tglSelesai}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{c.jumlahHari} Hari</td>
                        <td className="py-3 px-4 text-slate-600">{c.alasan || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            c.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-800' :
                            c.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {currentRole === 'MANAGER' ? (
                            <div className="flex items-center justify-end gap-1">
                              {c.status === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatusCuti(c.id, 'Disetujui')}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                    title="Setujui Cuti"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatusCuti(c.id, 'Ditolak')}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                    title="Tolak Cuti"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteCuti(c.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold italic">
                              {c.status === 'Pending' ? 'Menunggu Approval' : c.status === 'Disetujui' ? 'Disetujui' : 'Ditolak'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB HARI LIBUR & KALENDER */}
      {/* ========================================================================= */}
      {activeTab === 'libur' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="text-xs font-bold text-slate-600">
              Daftar Tanggal Merah Nasional & Hari Libur Outlet
            </div>

            {currentRole === 'MANAGER' && (
              <button
                onClick={() => setShowAddLiburModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Hari Libur</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3.5 px-4">Tanggal</th>
                    <th className="py-3.5 px-4">Nama Hari Libur</th>
                    <th className="py-3.5 px-4">Kategori</th>
                    <th className="py-3.5 px-4">Keterangan</th>
                    {currentRole === 'MANAGER' && <th className="py-3.5 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {liburList.length === 0 ? (
                    <tr>
                      <td colSpan={currentRole === 'MANAGER' ? 5 : 4} className="py-12 text-center text-slate-400">
                        <Sun className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold text-xs">Belum ada data hari libur khusus yang dicatat.</p>
                      </td>
                    </tr>
                  ) : (
                    liburList.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-rose-600">{l.tanggal}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{l.namaLibur}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            l.kategori === 'Libur Nasional' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-teal-50 text-teal-800 border border-teal-200'
                          }`}>
                            {l.kategori}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{l.keterangan || '-'}</td>
                        {currentRole === 'MANAGER' && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteLibur(l.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL PENGATURAN DENDA, SHIFT & KEAMANAN ==================== */}
      {showConfigModal && currentRole === 'MANAGER' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-3 shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#1E4648]" />
                  <span>Pengaturan Absensi & Keamanan Whitelist</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Konfigurasi parameter keterlambatan, denda, IP & lokasi GPS tablet</p>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setConfigModalTab('shift')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  configModalTab === 'shift'
                    ? 'bg-[#1E4648] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Parameter Shift & Denda</span>
              </button>
              <button
                type="button"
                onClick={() => setConfigModalTab('security')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  configModalTab === 'security'
                    ? 'bg-[#1E4648] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Keamanan IP & GPS Whitelist</span>
              </button>
            </div>

            <div className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              {configModalTab === 'shift' ? (
                <>
                  {/* Toleransi Menit */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Toleransi Keterlambatan (Menit)</label>
                    <input
                      type="number"
                      value={config.toleransiTelatMenit}
                      onChange={e => setConfig({ ...config, toleransiTelatMenit: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-[#1E4648] focus:outline-none focus:border-[#1E4648]"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Contoh: 15 menit pertama tidak dikenakan denda.</p>
                  </div>

                  {/* Denda Toggle */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="font-bold text-slate-800 block text-xs">Denda Keterlambatan (Opsional)</label>
                        <span className="text-[10px] text-slate-500">Aktifkan pemotongan otomatis pada payroll</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.aktifDenda}
                        onChange={e => setConfig({ ...config, aktifDenda: e.target.checked })}
                        className="w-4 h-4 rounded text-[#1E4648] focus:ring-[#1E4648]"
                      />
                    </div>

                    {config.aktifDenda && (
                      <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Aturan Denda</label>
                          <select
                            value={config.tipeDenda}
                            onChange={e => setConfig({ ...config, tipeDenda: e.target.value as any })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-[#1E4648]"
                          >
                            <option value="MENIT">Per Menit Telat</option>
                            <option value="JAM">Per Jam Telat</option>
                            <option value="FLAT">Flat Per Keterlambatan</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Tarif Denda (Rp)</label>
                          <input
                            type="number"
                            value={config.tarifDenda}
                            onChange={e => setConfig({ ...config, tarifDenda: Number(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-rose-600 focus:outline-none focus:border-[#1E4648]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tunjangan Kehadiran Default */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Standar Tunjangan Kehadiran (Rp / Hari Hadir)</label>
                    <input
                      type="number"
                      value={config.tunjanganKehadiranPerHari}
                      onChange={e => setConfig({ ...config, tunjanganKehadiranPerHari: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700 focus:outline-none focus:border-[#1E4648]"
                    />
                  </div>

                  {/* Insentif Drop Off Per Tahap */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Standar Insentif Drop Off (Rp / Tahap Selesai)</label>
                    <input
                      type="number"
                      value={config.insentifDropOffPerTahap}
                      onChange={e => setConfig({ ...config, insentifDropOffPerTahap: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-amber-700 focus:outline-none focus:border-[#1E4648]"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Dihitung dari banyaknya kontribusi tahap drop off yang diselesaikan staf.</p>
                  </div>
                </>
              ) : (
                /* TAB 2: SECURITY SETTINGS (GPS GEOFENCE & IP WHITELIST) */
                <div className="space-y-4">
                  {/* GPS GEOFENCING SECTION */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-800 block text-xs">Koordinat GPS Whitelist (Geofencing)</label>
                          <span className="text-[10px] text-slate-500">Membatasi absensi hanya di sekitar lokasi outlet</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.aktifGeofence}
                        onChange={e => setConfig({ ...config, aktifGeofence: e.target.checked })}
                        className="w-4 h-4 rounded text-[#1E4648] focus:ring-[#1E4648]"
                      />
                    </div>

                    {config.aktifGeofence && (
                      <div className="space-y-3 pt-2 border-t border-slate-200/80">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Latitude Outlet</label>
                            <input
                              type="number"
                              step="0.000001"
                              placeholder="-6.200000"
                              value={config.outletLatitude || ''}
                              onChange={e => setConfig({ ...config, outletLatitude: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-[#1E4648]"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Longitude Outlet</label>
                            <input
                              type="number"
                              step="0.000001"
                              placeholder="106.816666"
                              value={config.outletLongitude || ''}
                              onChange={e => setConfig({ ...config, outletLongitude: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-[#1E4648]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Radius Toleransi (Meter)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="10"
                              max="2000"
                              value={config.geofenceRadiusMeter || 100}
                              onChange={e => setConfig({ ...config, geofenceRadiusMeter: Number(e.target.value) || 100 })}
                              className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-[#1E4648] text-xs focus:outline-none focus:border-[#1E4648]"
                            />
                            <span className="text-slate-500 font-semibold text-[11px]">meter dari titik outlet</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Disarankan 50 - 150 meter untuk memperhitungkan akurasi GPS dalam ruangan.</p>
                        </div>

                        <button
                          type="button"
                          onClick={handleGetGpsCurrent}
                          disabled={gpsLoading}
                          className="w-full py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-2xs"
                        >
                          <LocateFixed className={`w-3.5 h-3.5 text-emerald-700 ${gpsLoading ? 'animate-spin' : ''}`} />
                          <span>{gpsLoading ? 'Mendeteksi Titik GPS...' : 'Ambil Titik Koordinat GPS Tablet Saat Ini'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* IP WHITELIST SECTION */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-800 block text-xs">IP Whitelist Outlet</label>
                          <span className="text-[10px] text-slate-500">Hanya izinkan presensi dari jaringan Wi-Fi outlet</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.aktifIpWhitelist}
                        onChange={e => setConfig({ ...config, aktifIpWhitelist: e.target.checked })}
                        className="w-4 h-4 rounded text-[#1E4648] focus:ring-[#1E4648]"
                      />
                    </div>

                    {config.aktifIpWhitelist && (
                      <div className="space-y-3 pt-2 border-t border-slate-200/80">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Daftar IP Diizinkan (Pisahkan koma)</label>
                          <textarea
                            rows={2}
                            value={config.ipWhitelist || ''}
                            onChange={e => setConfig({ ...config, ipWhitelist: e.target.value })}
                            placeholder="Contoh: 180.252.12.34, 114.124.50.10"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-[#1E4648]"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">Gunakan wildcard `*` untuk range subnet jika IP outlet bersifat dinamis (contoh: `180.252.*`).</p>
                        </div>

                        <button
                          type="button"
                          onClick={handleGetIpCurrent}
                          disabled={ipLoading}
                          className="w-full py-2.5 px-3 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-2xs"
                        >
                          <Globe className={`w-3.5 h-3.5 text-sky-700 ${ipLoading ? 'animate-spin' : ''}`} />
                          <span>{ipLoading ? 'Mendeteksi IP Jaringan...' : 'Ambil & Tambahkan IP Wi-Fi Saat Ini'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4 shrink-0">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition text-xs"
              >
                Batal
              </button>
              <button
                disabled={loading}
                onClick={handleSaveConfig}
                className="px-5 py-2.5 bg-[#1E4648] hover:bg-[#163536] text-white rounded-xl font-bold transition shadow-sm disabled:opacity-50 text-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Konfigurasi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL TAMBAH JADWAL & JATAH LIBUR MINGGUAN ==================== */}
      {showAddJadwalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-[#1E4648]" />
                  <span>Penugasan Roster & Jatah Libur Mingguan</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Atur jadwal kerja dan tetapkan jatah 1 hari libur dalam seminggu</p>
              </div>
              <button onClick={() => setShowAddJadwalModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 gap-1">
              <button
                type="button"
                onClick={() => setJadwalModalMode('weekly_off')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  jadwalModalMode === 'weekly_off' 
                    ? 'bg-[#1E4648] text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pola 6 Kerja + 1 Libur</span>
              </button>
              <button
                type="button"
                onClick={() => setJadwalModalMode('single')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  jadwalModalMode === 'single' 
                    ? 'bg-[#1E4648] text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Jadwal Harian / Manual</span>
              </button>
            </div>

            {/* MODE 1: WEEKLY OFF-DAY AUTO ROSTER GENERATOR */}
            {jadwalModalMode === 'weekly_off' ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pilih Pegawai *</label>
                  <select
                    value={formJadwal.idPegawai}
                    onChange={e => {
                      const p = pegawaiList.find(x => x.id === e.target.value);
                      setFormJadwal({ ...formJadwal, idPegawai: e.target.value, namaPegawai: p?.nama || '' });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-[#1E4648]"
                  >
                    {pegawaiList.map(p => (
                      <option key={p.id} value={p.id}>{p.nama} ({p.jabatan})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Bulan Roster *</label>
                    <input
                      type="month"
                      value={selectedBulanJadwal}
                      onChange={e => setSelectedBulanJadwal(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-[#1E4648]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Shift Kerja Utama</label>
                    <select
                      value={autoShiftUtama}
                      onChange={e => setAutoShiftUtama(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:border-[#1E4648]"
                    >
                      {shiftList.map(s => (
                        <option key={s.id} value={s.nama}>{s.nama} ({formatTime(s.jamMasuk)} - {formatTime(s.jamKeluar)})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Day Off Selector (1 Day Off / Week) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-slate-800">
                      Jatah Hari Libur Mingguan (1 Hari / Minggu) *
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Libur: {autoHariLibur}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">Pilih hari libur tetap dalam seminggu untuk pegawai ini:</p>
                  
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {HARI_NAMES.map(h => {
                      const isSelected = autoHariLibur.toLowerCase() === h.toLowerCase();
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setAutoHariLibur(h)}
                          className={`py-2 px-1 rounded-xl text-center font-bold text-xs transition border ${
                            isSelected
                              ? 'bg-rose-500 text-white border-rose-600 shadow-xs ring-2 ring-rose-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="text-[9px] opacity-80 uppercase tracking-tighter">Hari</div>
                          <div className="font-extrabold">{h.slice(0, 3)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary Box */}
                <div className="bg-teal-50/70 border border-teal-200/80 p-3.5 rounded-2xl space-y-1">
                  <div className="font-bold text-[#1E4648] text-xs flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
                    <span>Ringkasan Penugasan Otomatis:</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Pegawai <strong>{pegawaiList.find(p => p.id === formJadwal.idPegawai)?.nama || 'Pegawai'}</strong> akan bertugas <strong>6 hari kerja ({autoShiftUtama})</strong> dan mendapatkan jatah <strong>libur 1 hari setiap minggu pada hari {autoHariLibur}</strong> untuk seluruh tanggal di bulan terpilih.
                  </p>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
                  <button onClick={() => setShowAddJadwalModal(false)} className="px-3.5 py-2 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition">
                    Batal
                  </button>
                  <button
                    disabled={loading}
                    onClick={handleGenerateMonthlyRoster}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{loading ? 'Memproses...' : 'Terapkan Roster 1 Bulan'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* MODE 2: SINGLE DAY JADWAL MANUAL */
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pilih Pegawai *</label>
                  <select
                    value={formJadwal.idPegawai}
                    onChange={e => {
                      const p = pegawaiList.find(x => x.id === e.target.value);
                      setFormJadwal({ ...formJadwal, idPegawai: e.target.value, namaPegawai: p?.nama || '' });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    {pegawaiList.map(p => (
                      <option key={p.id} value={p.id}>{p.nama} ({p.jabatan})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal *</label>
                  <input
                    type="date"
                    value={formJadwal.tanggal}
                    onChange={e => setFormJadwal({ ...formJadwal, tanggal: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Roster</label>
                  <select
                    value={formJadwal.status}
                    onChange={e => {
                      const st = e.target.value as any;
                      setFormJadwal({ 
                        ...formJadwal, 
                        status: st,
                        shift: st === 'Libur' ? 'Libur / Off Day' : formJadwal.shift,
                        catatan: st === 'Libur' ? 'Jatah Libur Mingguan' : formJadwal.catatan
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  >
                    <option value="Masuk">Masuk Bertugas</option>
                    <option value="Libur">Hari Libur Mingguan (Off Day)</option>
                    <option value="Cuti">Cuti / Izin</option>
                    <option value="Tukar Shift">Tukar Shift</option>
                  </select>
                </div>

                {formJadwal.status !== 'Libur' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Shift</label>
                    <select
                      value={formJadwal.shift}
                      onChange={e => setFormJadwal({ ...formJadwal, shift: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                    >
                      {shiftList.map(s => (
                        <option key={s.id} value={s.nama}>{s.nama} ({formatTime(s.jamMasuk)} - {formatTime(s.jamKeluar)})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Catatan</label>
                  <input
                    type="text"
                    value={formJadwal.catatan}
                    onChange={e => setFormJadwal({ ...formJadwal, catatan: e.target.value })}
                    placeholder="Catatan penugasan..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
                  <button onClick={() => setShowAddJadwalModal(false)} className="px-3.5 py-2 bg-slate-100 rounded-xl font-bold">Batal</button>
                  <button onClick={handleSaveJadwal} className="px-4 py-2 bg-[#1E4648] text-white rounded-xl font-bold">Simpan Jadwal</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL TAMBAH CUTI ==================== */}
      {showAddCutiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Formulir Pengajuan / Pencatatan Cuti</h3>
              <button onClick={() => setShowAddCutiModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Pegawai *</label>
                <select
                  value={formCuti.idPegawai}
                  onChange={e => {
                    const p = pegawaiList.find(x => x.id === e.target.value);
                    setFormCuti({ ...formCuti, idPegawai: e.target.value, namaPegawai: p?.nama || '' });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  {pegawaiList.map(p => (
                    <option key={p.id} value={p.id}>{p.nama} ({p.jabatan})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jenis Cuti / Izin</label>
                <select
                  value={formCuti.jenisCuti}
                  onChange={e => setFormCuti({ ...formCuti, jenisCuti: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="Cuti Tahunan">Cuti Tahunan</option>
                  <option value="Sakit">Sakit (Dengan / Tanpa Surat Dokter)</option>
                  <option value="Izin Khusus">Izin Keperluan Khusus</option>
                  <option value="Cuti Menikah">Cuti Menikah</option>
                  <option value="Cuti Melahirkan">Cuti Melahirkan</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tgl Mulai *</label>
                  <input
                    type="date"
                    value={formCuti.tglMulai}
                    onChange={e => setFormCuti({ ...formCuti, tglMulai: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tgl Selesai *</label>
                  <input
                    type="date"
                    value={formCuti.tglSelesai}
                    onChange={e => setFormCuti({ ...formCuti, tglSelesai: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jumlah Hari</label>
                <input
                  type="number"
                  min="1"
                  value={formCuti.jumlahHari}
                  onChange={e => setFormCuti({ ...formCuti, jumlahHari: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alasan Cuti / Keterangan</label>
                <textarea
                  rows={2}
                  value={formCuti.alasan}
                  onChange={e => setFormCuti({ ...formCuti, alasan: e.target.value })}
                  placeholder="Keterangan keperluan cuti..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
              <button onClick={() => setShowAddCutiModal(false)} className="px-3.5 py-2 bg-slate-100 rounded-xl font-bold">Batal</button>
              <button onClick={handleSaveCuti} className="px-4 py-2 bg-[#1E4648] text-white rounded-xl font-bold">Simpan Cuti</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL TAMBAH LIBUR ==================== */}
      {showAddLiburModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Tambah Hari Libur / Tanggal Merah</h3>
              <button onClick={() => setShowAddLiburModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal *</label>
                <input
                  type="date"
                  value={formLibur.tanggal}
                  onChange={e => setFormLibur({ ...formLibur, tanggal: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Hari Libur *</label>
                <input
                  type="text"
                  value={formLibur.namaLibur}
                  onChange={e => setFormLibur({ ...formLibur, namaLibur: e.target.value })}
                  placeholder="Misal: Idul Fitri, Libur Maintenance Outlet..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kategori Libur</label>
                <select
                  value={formLibur.kategori}
                  onChange={e => setFormLibur({ ...formLibur, kategori: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="Libur Nasional">Libur Nasional / Tanggal Merah</option>
                  <option value="Libur Outlet">Libur Khusus Operasional Outlet</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan (Opsional)</label>
                <input
                  type="text"
                  value={formLibur.keterangan}
                  onChange={e => setFormLibur({ ...formLibur, keterangan: e.target.value })}
                  placeholder="Catatan libur..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-4">
              <button onClick={() => setShowAddLiburModal(false)} className="px-3.5 py-2 bg-slate-100 rounded-xl font-bold">Batal</button>
              <button onClick={handleSaveLibur} className="px-4 py-2 bg-[#1E4648] text-white rounded-xl font-bold">Simpan Hari Libur</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
