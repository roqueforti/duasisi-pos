'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, Plus, RefreshCw, Play, CheckCircle2, Wrench, Trash2, Clock, WashingMachine, Flame } from 'lucide-react';
import { runBackend } from '@/lib/api';

interface MesinItem {
  id: string;
  nama: string;
  tipe: 'Washer' | 'Dryer';
  status: 'Kosong' | 'Digunakan' | 'Maintenance';
  keterangan?: string;
  mulaiPakai?: string;
  estimasiSelesai?: string;
}

export default function MesinView() {
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
    if (!nama.trim()) { alert('Masukkan nama mesin!'); return; }
    setLoading(true);
    try {
      await runBackend('tambahMesin', { nama: nama.trim(), tipe });
      setShowAddModal(false);
      setNama('');
      loadMesin();
    } catch (err) {
      alert('Gagal menambah mesin');
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
    } catch (err) {
      alert('Gagal menjalankan mesin');
    } finally {
      setLoading(false);
    }
  };

  const handleSelesai = async (id: string) => {
    try {
      await runBackend('selesaiMesin', id);
      loadMesin();
    } catch (err) {
      alert('Gagal menghentikan mesin');
    }
  };

  const handleToggleMaintenance = async (id: string, currentStatus: string) => {
    const isMaintenance = currentStatus === 'Maintenance';
    try {
      await runBackend('setMaintenanceMesin', id, !isMaintenance);
      loadMesin();
    } catch (err) {
      alert('Gagal mengupdate status maintenance');
    }
  };

  const handleDelete = async (id: string, namaMesin: string) => {
    if (!confirm(`Hapus ${namaMesin}?`)) return;
    try {
      await runBackend('hapusMesin', id);
      loadMesin();
    } catch (err) {
      alert('Gagal menghapus mesin');
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Header & Control */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Cpu className="w-4 h-4 text-[#1E4648]" />
          <span>Status Operational Mesin Cuci & Dryer</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMesin}
            className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-3.5 py-1.5 rounded-md text-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Mesin
          </button>
        </div>
      </div>

      {/* Mesin Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
              <div className="h-8 bg-slate-100 rounded w-full mt-4" />
            </div>
          ))
        ) : mesinList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-lg border border-slate-200">
            Belum ada data mesin
          </div>
        ) : (
          mesinList.map((m) => {
            const isRunning = m.status === 'Digunakan';
            const isMaintenance = m.status === 'Maintenance';

            return (
              <div
                key={m.id}
                className={`bg-white rounded-lg border p-4 flex flex-col justify-between transition-colors ${
                  isRunning
                    ? 'border-teal-500 bg-teal-50/20'
                    : isMaintenance
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{m.tipe === 'Washer' ? <WashingMachine className="w-4 h-4 text-[#2d4d38]" /> : <Flame className="w-4 h-4 text-amber-600" />}</span>
                      <span>{m.nama}</span>
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        isRunning
                          ? 'bg-teal-100 text-teal-800'
                          : isMaintenance
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-1 mb-3">
                    {isRunning ? (
                      <>
                        <p>Catatan: <span className="font-semibold text-slate-700">{m.keterangan || 'Proses mencuci'}</span></p>
                        <p className="flex items-center gap-1 text-teal-700 font-medium">
                          <Clock className="w-3 h-3" /> Mulai: {m.mulaiPakai} (Est: {m.estimasiSelesai})
                        </p>
                      </>
                    ) : isMaintenance ? (
                      <p className="text-amber-700 font-medium">Mesin sedang perbaikan / servis</p>
                    ) : (
                      <p className="text-slate-400">Siap digunakan untuk pelanggan</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 pt-3 border-t border-slate-100">
                  {isRunning ? (
                    <button
                      onClick={() => handleSelesai(m.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1.5 rounded-md text-xs transition flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                    </button>
                  ) : isMaintenance ? (
                    <button
                      onClick={() => handleToggleMaintenance(m.id, m.status)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 rounded-md text-xs transition flex items-center justify-center gap-1"
                    >
                      <Wrench className="w-3.5 h-3.5" /> Normal
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { setSelectedMesinId(m.id); setShowMulaiModal(true); }}
                        className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-medium py-1.5 rounded-md text-xs transition flex items-center justify-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5" /> Jalankan
                      </button>
                      <button
                        onClick={() => handleToggleMaintenance(m.id, m.status)}
                        className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-md transition"
                        title="Set Maintenance"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(m.id, m.nama)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded transition"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Tambah Mesin Baru</h3>
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
              <button onClick={handleAddMesin} className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-4 py-2 rounded-md text-xs">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Mulai Modal */}
      {showMulaiModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Jalankan Mesin</h3>
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
              <button onClick={handleConfirmMulai} className="bg-[#1E4648] hover:bg-[#153334] text-white font-medium px-4 py-2 rounded-md text-xs">Mulai Pakai</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
