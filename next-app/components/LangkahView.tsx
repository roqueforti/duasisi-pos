'use client';

import React, { useState, useEffect } from 'react';
import { runBackend } from '@/lib/api';
import { UserRole } from '@/lib/types';
import { GitMerge, Plus, Save, Trash2, ArrowUp, ArrowDown, X, Settings, Edit3 } from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

export interface MasterPipelineStep {
  step: number;
  nama: string;
  needStaff: boolean;
  needMesin: boolean;
}

export default function LangkahView({ currentRole }: { currentRole?: UserRole }) {
  const { showAlert, showConfirm } = useDialog();
  const [steps, setSteps] = useState<MasterPipelineStep[]>([]);
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
      const res = await runBackend<MasterPipelineStep[]>('getPipelineConfigData');
      if (Array.isArray(res)) {
        setSteps(res.sort((a, b) => a.step - b.step));
      } else {
        setSteps([]);
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

  const handleSaveAll = async (newSteps: MasterPipelineStep[]) => {
    setLoading(true);
    try {
      // Re-assign step numbers sequentially
      const updated = newSteps.map((s, idx) => ({ ...s, step: idx + 1 }));
      await runBackend('savePipelineConfigData', updated);
      setSteps(updated);
      await showAlert('Data master langkah berhasil disimpan!', 'success');
    } catch (err) {
      await showAlert('Gagal menyimpan master langkah.', 'error');
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
    const isConfirmed = await showConfirm('Hapus langkah ini dari Master Data? (Perubahan akan langsung disimpan)');
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
      await showAlert('Nama langkah wajib diisi.', 'error');
      return;
    }

    const newStep: MasterPipelineStep = {
      step: 0, // will be re-assigned
      nama: namaStep.trim(),
      needStaff,
      needMesin
    };

    const newSteps = [...steps];
    if (editingIndex !== null) {
      newSteps[editingIndex] = newStep;
    } else {
      newSteps.push(newStep);
    }

    await handleSaveAll(newSteps);
    setShowModal(false);
  };

  if (currentRole !== 'MANAGER') {
    return (
      <div className="p-6 text-center text-slate-500">
        Anda tidak memiliki akses ke halaman ini.
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-4xl mx-auto text-slate-600">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-lg border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1E4648] text-white flex items-center justify-center shadow-md">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-700 leading-tight">Master Langkah Pengerjaan</h1>
            <p className="text-xs text-slate-500 font-medium">Buat daftar standar template langkah operasional</p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Langkah Baru</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#1E4648]" />
          <h2 className="font-bold text-slate-700 text-sm">Urutan Standar Master Langkah</h2>
        </div>
        
        <div className="p-4">
          <p className="text-xs text-slate-500 mb-4">
            Master langkah di bawah ini akan muncul sebagai opsi <i>dropdown</i> saat Anda menambahkan langkah pengerjaan ke suatu layanan / produk (Menu Manajemen Produk).
          </p>

          {loading ? (
            <div className="text-center py-6 text-slate-400 text-xs font-bold animate-pulse">Memuat data master...</div>
          ) : steps.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                <GitMerge className="w-6 h-6" />
              </div>
              <p className="text-slate-500 text-sm font-bold mb-1">Belum Ada Master Langkah</p>
              <p className="text-slate-400 text-xs max-w-xs mx-auto mb-4">Tambahkan langkah baru untuk digunakan sebagai template di layanan Anda.</p>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition"
              >
                Tambah Langkah Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-[#1E4648]/30 transition group">
                  <div className="flex flex-col gap-1 w-8 items-center text-slate-400">
                    <button onClick={() => moveUp(index)} disabled={index === 0} className="hover:text-[#1E4648] disabled:opacity-30">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 w-5 h-5 flex items-center justify-center rounded">
                      {step.step}
                    </span>
                    <button onClick={() => moveDown(index)} disabled={index === steps.length - 1} className="hover:text-[#1E4648] disabled:opacity-30">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-700 text-sm">{step.nama}</h3>
                    <div className="flex gap-2 mt-1">
                      {step.needStaff && (
                        <span className="px-2 py-0.5 bg-[#FF9500]/10 text-[#FF9500] text-[10px] font-bold uppercase rounded">Wajib Isi Staff</span>
                      )}
                      {step.needMesin && (
                        <span className="px-2 py-0.5 bg-[#1E4648]/10 text-[#1E4648] text-[10px] font-bold uppercase rounded">Wajib Pilih Mesin</span>
                      )}
                      {!step.needStaff && !step.needMesin && (
                        <span className="text-[10px] text-slate-400 font-semibold italic">Tanpa aturan khusus</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenEdit(index)} className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-[#1E4648] hover:border-[#1E4648] rounded-md transition shadow-2xs">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(index)} className="p-2 bg-white border border-slate-200 text-rose-400 hover:text-white hover:bg-rose-500 hover:border-rose-500 rounded-md transition shadow-2xs">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 sm:p-6 w-full max-w-md border border-slate-100 shadow-xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 rounded p-1">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              {editingIndex !== null ? 'Edit Master Langkah' : 'Tambah Master Langkah'}
            </h3>
            <p className="text-xs text-slate-500 mb-5 border-b border-slate-100 pb-3">Atur nama langkah dan aturan yang berlaku.</p>
            
            <div className="space-y-4 text-sm font-semibold">
              <div>
                <label className="block text-slate-700 mb-1.5">Nama Langkah *</label>
                <input
                  type="text"
                  value={namaStep}
                  onChange={(e) => setNamaStep(e.target.value)}
                  placeholder="Contoh: Dicuci, Dikeringkan, Setrika..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1E4648] transition"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={needStaff}
                      onChange={(e) => setNeedStaff(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-slate-300 rounded peer-checked:bg-[#1E4648] peer-checked:border-[#1E4648] transition" />
                    <svg className="absolute w-3.5 h-3.5 text-white top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-700 group-hover:text-[#1E4648] transition">Wajib Isi Staff / PIC</span>
                    <span className="text-[10px] text-slate-400 font-medium">Memaksa kasir mencatat siapa yang mengerjakan tahap ini.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={needMesin}
                      onChange={(e) => setNeedMesin(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 border-2 border-slate-300 rounded peer-checked:bg-[#1E4648] peer-checked:border-[#1E4648] transition" />
                    <svg className="absolute w-3.5 h-3.5 text-white top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-700 group-hover:text-[#1E4648] transition">Wajib Pilih Mesin</span>
                    <span className="text-[10px] text-slate-400 font-medium">Memaksa sistem mencari mesin kosong (Washer/Dryer).</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs transition"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveModal}
                className="flex-1 py-2.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-lg text-xs transition shadow-md flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Master</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
