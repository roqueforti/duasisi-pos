'use client';

import React, { useState, useEffect } from 'react';
import { runBackend } from '@/lib/api';
import { UserRole } from '@/lib/types';
import { GitMerge, Plus, Save, Trash2, ArrowUp, ArrowDown, X, Settings } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

interface PipelineStep {
  step: number;
  nama: string;
  needStaff: boolean;
  needMesin: boolean;
}

export default function PipelineView({ currentRole }: { currentRole?: UserRole }) {
  const { showAlert, showConfirm } = useDialog();
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [namaStep, setNamaStep] = useState('');
  const [needStaff, setNeedStaff] = useState(false);
  const [needMesin, setNeedMesin] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await runBackend<PipelineStep[]>('getPipelineConfigData');
      if (Array.isArray(res)) {
        setSteps(res.sort((a, b) => a.step - b.step));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveAll = async (newSteps: PipelineStep[]) => {
    setLoading(true);
    try {
      // Re-assign step numbers sequentially
      const updated = newSteps.map((s, idx) => ({ ...s, step: idx + 1 }));
      await runBackend('savePipelineConfigData', updated);
      setSteps(updated);
      await showAlert('Urutan pipeline berhasil disimpan!', 'success');
    } catch (err) {
      await showAlert('Gagal menyimpan urutan pipeline.', 'error');
      loadData(); // Revert
    } finally {
      setLoading(false);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    handleSaveAll(newSteps);
  };

  const moveDown = (index: number) => {
    if (index === steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[index + 1], newSteps[index]] = [newSteps[index], newSteps[index + 1]];
    handleSaveAll(newSteps);
  };

  const handleDelete = async (index: number) => {
    const isConfirmed = await showConfirm('Hapus langkah ini? (Perubahan akan langsung disimpan)');
    if (!isConfirmed) return;
    const newSteps = steps.filter((_, i) => i !== index);
    handleSaveAll(newSteps);
  };

  const handleOpenAdd = () => {
    setEditingIndex(null);
    setNamaStep('');
    setNeedStaff(false);
    setNeedMesin(false);
    setShowModal(true);
  };

  const handleOpenEdit = (index: number) => {
    setEditingIndex(index);
    setNamaStep(steps[index].nama);
    setNeedStaff(steps[index].needStaff);
    setNeedMesin(steps[index].needMesin);
    setShowModal(true);
  };

  const handleSaveModal = async () => {
    if (!namaStep.trim()) {
      await showAlert('Nama langkah harus diisi', 'warning');
      return;
    }
    const newSteps = [...steps];
    if (editingIndex !== null) {
      newSteps[editingIndex] = {
        ...newSteps[editingIndex],
        nama: namaStep.trim(),
        needStaff,
        needMesin
      };
    } else {
      newSteps.push({
        step: newSteps.length + 1,
        nama: namaStep.trim(),
        needStaff,
        needMesin
      });
    }
    setShowModal(false);
    handleSaveAll(newSteps);
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
          <GitMerge className="w-6 h-6 text-[#1E4648]" />
          Manajemen Drop Off (Pipeline)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Atur urutan dan persyaratan untuk setiap tahap pekerjaan (Drop Off). Transaksi baru akan mengikuti urutan ini.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden max-w-4xl">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-700">Daftar Langkah Pipeline</h3>
          <button
            onClick={handleOpenAdd}
            className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#1E4648]/20"
          >
            <Plus className="w-4 h-4" /> Tambah Langkah
          </button>
        </div>

        <div className="p-5">
          {loading && steps.length === 0 ? (
            <div className="text-center text-slate-400 py-8">Memuat pipeline...</div>
          ) : (
            <div className="space-y-3">
              {steps.map((item, idx) => (
                <div 
                  key={item.step} 
                  className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:border-[#1E4648] hover:shadow-sm transition-all group bg-white"
                >
                  <div className="flex flex-col gap-1 items-center justify-center text-slate-300">
                    <button 
                      onClick={() => moveUp(idx)} 
                      disabled={idx === 0 || loading}
                      className="hover:text-[#1E4648] disabled:opacity-30 transition"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-black text-slate-800 w-5 text-center">{idx + 1}</span>
                    <button 
                      onClick={() => moveDown(idx)} 
                      disabled={idx === steps.length - 1 || loading}
                      className="hover:text-[#1E4648] disabled:opacity-30 transition"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1">
                    <h4 className="font-bold text-slate-700 text-sm">{item.nama}</h4>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.needStaff ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {item.needStaff ? 'Wajib Input Pegawai' : 'Tanpa Pegawai'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.needMesin ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                        {item.needMesin ? 'Wajib Pilih Mesin' : 'Tanpa Mesin'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(idx)}
                      disabled={loading}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(idx)}
                      disabled={loading}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-slate-800">{editingIndex !== null ? 'Edit Langkah' : 'Tambah Langkah'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Langkah *</label>
                <input
                  type="text"
                  value={namaStep}
                  onChange={e => setNamaStep(e.target.value)}
                  placeholder="Contoh: Disetrika"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#1E4648] focus:ring-1 focus:ring-[#1E4648]/20 transition"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-5 h-5 border-2 rounded border-slate-300 group-hover:border-blue-500 transition-colors">
                    <input 
                      type="checkbox" 
                      className="absolute opacity-0 cursor-pointer"
                      checked={needStaff}
                      onChange={(e) => setNeedStaff(e.target.checked)}
                    />
                    {needStaff && <div className="w-2.5 h-2.5 bg-blue-500 rounded-sm" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-700">Wajib Input Pegawai</div>
                    <div className="text-[10px] text-slate-500">Staf harus memilih namanya untuk lanjut ke tahap berikutnya.</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-5 h-5 border-2 rounded border-slate-300 group-hover:border-amber-500 transition-colors">
                    <input 
                      type="checkbox" 
                      className="absolute opacity-0 cursor-pointer"
                      checked={needMesin}
                      onChange={(e) => setNeedMesin(e.target.checked)}
                    />
                    {needMesin && <div className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-700">Wajib Pilih Mesin</div>
                    <div className="text-[10px] text-slate-500">Staf wajib menentukan mesin mana yang digunakan.</div>
                  </div>
                </label>
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
                onClick={handleSaveModal}
                disabled={loading}
                className="px-6 py-2 text-sm font-bold text-white bg-[#1E4648] hover:bg-[#153436] rounded-lg transition shadow-md shadow-[#1E4648]/20 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
