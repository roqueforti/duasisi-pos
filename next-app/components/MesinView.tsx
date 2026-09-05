'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, Plus, RefreshCw, Play, CheckCircle2, Wrench, Trash2, Clock, WashingMachine, Flame } from 'lucide-react';
import { runBackend } from '@/lib/api';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

interface MesinItem {
  id: string;
  nama: string;
  tipe: 'Washer' | 'Dryer';
  status: 'Kosong' | 'Digunakan' | 'Maintenance';
  keterangan?: string;
  mulaiPakai?: string;
  estimasiSelesai?: string;
}

export default function MesinView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert, showConfirm } = useDialog();
  const [mesinList, setMesinList] = useState<MesinItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [nama, setNama] = useState('');
  const [tipe, setTipe] = useState<'Washer' | 'Dryer'>('Washer');

  const [showMulaiModal, setShowMulaiModal] = useState(false);
  const [selectedMesinId, setSelectedMesinId] = useState('');
  const [ketMulai, setKetMulai] = useState('');
  const [estMulai, setEstMulai] = useState('45');

  const loadMesin = async () => {
    setLoading(true);
    try {
      const data = await runBackend<MesinItem[]>('getMesinList');
      if (Array.isArray(data)) setMesinList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMesin();
  }, []);

  const handleAddMesin = async () => {
    if (!nama.trim()) { await showAlert('Masukkan nama mesin!', 'warning'); return; }
    setLoading(true);
    try {
      await runBackend('tambahMesin', { nama: nama.trim(), tipe });
      setShowAddModal(false);
      setNama('');
      loadMesin();
      await showAlert('Mesin berhasil ditambahkan!', 'success');
    } catch (err) {
      await showAlert('Gagal menambah mesin', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMulai = async () => {
    if (!selectedMesinId) return;
    setLoading(true);
    try {
      await runBackend('mulaiPakaiMesin', selectedMesinId, ketMulai.trim(), `${estMulai} Menit`);
      setShowMulaiModal(false);
      setKetMulai('');
      loadMesin();
      await showAlert('Mesin berhasil dijalankan!', 'success');
    } catch (err) {
      await showAlert('Gagal menjalankan mesin', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelesai = async (id: string) => {
    try {
      await runBackend('selesaiMesin', id);
      loadMesin();
      await showAlert('Mesin berhasil dihentikan!', 'success');
    } catch (err) {
      await showAlert('Gagal menghentikan mesin', 'error');
    }
  };

  const handleToggleMaintenance = async (id: string, currentStatus: string) => {
    const isMaintenance = currentStatus === 'Maintenance';
    try {
      await runBackend('setMaintenanceMesin', id, !isMaintenance);
      loadMesin();
      await showAlert(`Status maintenance mesin berhasil diperbarui!`, 'success');
    } catch (err) {
      await showAlert('Gagal mengupdate status maintenance', 'error');
    }
  };

  const handleDelete = async (id: string, namaMesin: string) => {
    const isConfirmed = await showConfirm(`Hapus ${namaMesin}?`);
    if (!isConfirmed) return;
    try {
      await runBackend('hapusMesin', id);
      loadMesin();
      await showAlert('Mesin berhasil dihapus!', 'success');
    } catch (err) {
      await showAlert('Gagal menghapus mesin', 'error');
    }
  };

  return (
    <div className="w-full space-y-4 p-3 sm:p-5">
      {/* Header Bar */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">Status Operasional Mesin</h2>
            <p className="text-xs text-slate-500 font-medium">Monitoring real-time mesin cuci (Washer) & pengering (Dryer)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMesin}
            className="tactile-btn p-2 border border-slate-200 bg-white rounded-xl text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {currentRole === 'MANAGER' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="tactile-btn btn-glow-emerald font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> <span>Tambah Mesin</span>
            </button>
          )}
        </div>
      </div>

      {/* Mesin Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="glass-card p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
              <div className="h-8 bg-slate-100 rounded w-full mt-4" />
            </div>
          ))
        ) : mesinList.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 glass-panel rounded-2xl border-dashed">
            Belum ada data mesin
          </div>
        ) : (
          mesinList.map((m) => {
            const isRunning = m.status === 'Digunakan';
            const isMaintenance = m.status === 'Maintenance';

            return (
              <div
                key={m.id}
                className={`glass-card card-hover-lift p-4 sm:p-5 flex flex-col justify-between ${
                  isRunning
                    ? 'border-teal-400/60 bg-teal-50/20'
                    : isMaintenance
                    ? 'border-amber-400/60 bg-amber-50/20'
                    : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-slate-100 text-teal-800">
                        {m.tipe === 'Washer' ? <WashingMachine className="w-4 h-4 text-teal-700" /> : <Flame className="w-4 h-4 text-amber-600" />}
                      </span>
                      <span>{m.nama}</span>
                    </span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        isRunning
                          ? 'badge-glow-teal'
                          : isMaintenance
                          ? 'badge-glow-amber'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <Clock className="w-3 h-3 text-teal-600 animate-pulse" />
                          <span>Digunakan</span>
                        </>
                      ) : isMaintenance ? (
                        <>
                          <Wrench className="w-3 h-3 text-amber-600" />
                          <span>Maintenance</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Tersedia</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1.5 mb-4">
                    {isRunning ? (
                      <>
                        <p className="font-medium text-slate-700">Catatan: <span className="font-bold">{m.keterangan || 'Proses mencuci'}</span></p>
                        <p className="flex items-center gap-1 text-teal-800 font-bold text-[11px] bg-teal-50 px-2 py-1 rounded-lg border border-teal-200">
                          <Clock className="w-3.5 h-3.5" /> Mulai: {m.mulaiPakai} (Est: {m.estimasiSelesai})
                        </p>
                      </>
                    ) : isMaintenance ? (
                      <p className="text-amber-700 font-bold text-xs bg-amber-50 p-2 rounded-lg border border-amber-200">Mesin sedang perbaikan / servis berkala</p>
                    ) : (
                      <p className="text-slate-400 font-medium">Mesin siap digunakan untuk load berikutnya</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  {isRunning ? (
                    <button
                      onClick={() => handleSelesai(m.id)}
                      className="tactile-btn flex-1 bg-teal-800 hover:bg-teal-900 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-200" /> <span>Selesai</span>
                    </button>
                  ) : isMaintenance ? (
                    currentRole === 'MANAGER' ? (
                      <button
                        onClick={() => handleToggleMaintenance(m.id, m.status)}
                        className="tactile-btn flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" /> <span>Set Normal</span>
                      </button>
                    ) : (
                      <div className="flex-1 text-center py-2 text-xs font-bold text-amber-700">Sedang Maintenance</div>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => { setSelectedMesinId(m.id); setShowMulaiModal(true); }}
                        className="tactile-btn flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 text-teal-200" /> <span>Jalankan</span>
                      </button>
                      {currentRole === 'MANAGER' && (
                        <button
                          onClick={() => handleToggleMaintenance(m.id, m.status)}
                          className="tactile-btn p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-xl transition cursor-pointer"
                          title="Set Maintenance"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                  {currentRole === 'MANAGER' && (
                    <button
                      onClick={() => handleDelete(m.id, m.nama)}
                      className="tactile-btn p-2 text-slate-400 hover:text-red-500 rounded-xl transition cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-600 mb-4">Tambah Mesin Baru</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nama Mesin</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Mesin Cuci 4"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipe Mesin</label>
                <select
                  value={tipe}
                  onChange={(e) => setTipe(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white"
                >
                  <option value="Washer">Washer (Mesin Cuci)</option>
                  <option value="Dryer">Dryer (Mesin Pengering)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">Batal</button>
              <button onClick={handleAddMesin} className="bg-[#1E4648] hover:bg-[#163536] text-white font-medium px-4 py-2 rounded-md text-xs">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Mulai Modal */}
      {showMulaiModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-600 mb-4">Jalankan Mesin</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Keterangan / No Nota / Pelanggan</label>
                <input
                  type="text"
                  value={ketMulai}
                  onChange={(e) => setKetMulai(e.target.value)}
                  placeholder="Contoh: LDY-260724-0001 (Pak Budi)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Durasi Timer (Menit)</label>
                <input
                  type="number"
                  value={estMulai}
                  onChange={(e) => setEstMulai(e.target.value)}
                  placeholder="45"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMulaiModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">Batal</button>
              <button onClick={handleConfirmMulai} className="bg-[#1E4648] hover:bg-[#163536] text-white font-medium px-4 py-2 rounded-md text-xs">Mulai Pakai</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
