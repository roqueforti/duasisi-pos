'use client';

import React, { useState, useEffect } from 'react';
import { runBackend, runBackendCached } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';
import { Clock, Edit2, Trash2, Plus, Save, X, Settings2 } from 'lucide-react';

interface MasterShift {
  id: string;
  nama: string;
  jamMasuk: string;
  jamKeluar: string;
  keterangan: string;
}

interface AbsensiConfig {
  jamBuka: string;
  toleransiTelatMenit: number;
}

const formatShiftTime = (timeStr: string) => {
  if (!timeStr) return '-';
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) return timeStr.substring(0, 5);
  
  if (timeStr.includes('T') || timeStr.includes('-')) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta', 
        hour: '2-digit', 
        minute: '2-digit'
      }).replace('.', ':');
    }
  }
  return timeStr;
};

export default function ShiftView({ currentRole }: { currentRole?: UserRole }) {
  const { showAlert, showConfirm } = useDialog();
  const [shifts, setShifts] = useState<MasterShift[]>([]);
  const [config, setConfig] = useState<AbsensiConfig>({ jamBuka: '07:00', toleransiTelatMenit: 15 });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [namaShift, setNamaShift] = useState('');
  const [jamMasuk, setJamMasuk] = useState('07:00');
  const [jamKeluar, setJamKeluar] = useState('15:00');
  const [keterangan, setKeterangan] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const shiftRes = await runBackend<MasterShift[]>('getMasterShiftList');
      if (Array.isArray(shiftRes)) setShifts(shiftRes);

      const configRes = await runBackend<AbsensiConfig>('getAbsensiConfig');
      if (configRes) setConfig(configRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await runBackend('saveAbsensiConfig', config.jamBuka, Number(config.toleransiTelatMenit));
      await showAlert('Pengaturan absensi berhasil disimpan!', 'success');
    } catch (err) {
      await showAlert('Gagal menyimpan pengaturan absensi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setNamaShift('');
    setJamMasuk('07:00');
    setJamKeluar('15:00');
    setKeterangan('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: MasterShift) => {
    setEditingId(item.id);
    setNamaShift(item.nama);
    setJamMasuk(formatShiftTime(item.jamMasuk));
    setJamKeluar(formatShiftTime(item.jamKeluar));
    setKeterangan(item.keterangan || '');
    setShowModal(true);
  };

  const handleSaveShift = async () => {
    if (!namaShift.trim() || !jamMasuk || !jamKeluar) {
      await showAlert('Nama, jam masuk, dan jam keluar wajib diisi!', 'warning');
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await runBackend('updateMasterShift', editingId, {
          nama: namaShift,
          jamMasuk,
          jamKeluar,
          keterangan
        });
      } else {
        await runBackend('tambahMasterShift', {
          nama: namaShift,
          jamMasuk,
          jamKeluar,
          keterangan
        });
      }
      setShowModal(false);
      loadData();
      await showAlert('Shift berhasil disimpan!', 'success');
    } catch (err) {
      await showAlert('Gagal menyimpan shift.', 'error');
      setLoading(false);
    }
  };

  const handleDeleteShift = async (id: string) => {
    const isConfirmed = await showConfirm('Yakin ingin menghapus shift ini?');
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await runBackend('hapusMasterShift', id);
      loadData();
      await showAlert('Shift berhasil dihapus!', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus shift.', 'error');
      setLoading(false);
    }
  };

  if (currentRole !== 'MANAGER') {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <p>Akses ditolak. Halaman ini hanya untuk Manager.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 lg:p-6 overflow-y-auto space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Clock className="w-6 h-6 text-[#1E4648]" />
          Manajemen Shift & Absensi
        </h1>
        <p className="text-sm text-slate-500 mt-1">Kelola jam kerja staf dan konfigurasi batas keterlambatan absensi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Settings Box */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Settings2 className="w-5 h-5 text-indigo-500" />
              Pengaturan Absensi
            </h3>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Jam Buka Operasional</label>
              <input
                type="time"
                value={config.jamBuka}
                onChange={e => setConfig({...config, jamBuka: e.target.value})}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#1E4648]"
              />
              <p className="text-[10px] text-slate-400 mt-1">Acuan jam buka toko untuk laporan harian.</p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Toleransi Keterlambatan (Menit)</label>
              <input
                type="number"
                value={config.toleransiTelatMenit}
                onChange={e => setConfig({...config, toleransiTelatMenit: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#1E4648]"
              />
              <p className="text-[10px] text-slate-400 mt-1">Batas waktu sebelum sistem melabeli absensi staf dengan <strong>[TERLAMBAT]</strong>.</p>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={loading}
              className="w-full mt-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold py-2 rounded-lg text-sm transition disabled:opacity-50"
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>

        {/* Master Shift Box */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-700">Daftar Master Shift</h3>
              <button
                onClick={handleOpenAdd}
                className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#1E4648]/20"
              >
                <Plus className="w-4 h-4" /> Tambah Shift
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Nama Shift</th>
                    <th className="px-5 py-3">Jam Masuk</th>
                    <th className="px-5 py-3">Jam Keluar</th>
                    <th className="px-5 py-3">Keterangan</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && shifts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">Memuat shift...</td>
                    </tr>
                  ) : shifts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">Belum ada shift.</td>
                    </tr>
                  ) : (
                    shifts.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3 font-semibold text-slate-800">{item.nama}</td>
                        <td className="px-5 py-3 font-mono text-[#1E4648]">{formatShiftTime(item.jamMasuk)}</td>
                        <td className="px-5 py-3 font-mono text-[#FF9500]">{formatShiftTime(item.jamKeluar)}</td>
                        <td className="px-5 py-3 text-slate-500">{item.keterangan || '-'}</td>
                        <td className="px-5 py-3 text-right space-x-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteShift(item.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-slate-800">{editingId ? 'Edit Shift' : 'Tambah Shift'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Shift *</label>
                <input
                  type="text"
                  value={namaShift}
                  onChange={e => setNamaShift(e.target.value)}
                  placeholder="Contoh: Shift Pagi"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]/20 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Jam Masuk *</label>
                  <input
                    type="time"
                    value={jamMasuk}
                    onChange={e => setJamMasuk(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Jam Keluar *</label>
                  <input
                    type="time"
                    value={jamKeluar}
                    onChange={e => setJamKeluar(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]/20 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Keterangan</label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={e => setKeterangan(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]/20 transition"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveShift}
                disabled={loading}
                className="px-6 py-2 text-sm font-bold text-white bg-[#1E4648] hover:bg-[#153436] rounded-lg transition shadow-md shadow-[#1E4648]/20 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
