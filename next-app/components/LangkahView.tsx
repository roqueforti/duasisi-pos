'use client';

import React, { useState, useEffect } from 'react';
import { runBackend } from '@/lib/api';
import { UserRole } from '@/lib/types';
import { 
  GitMerge, 
  Plus, 
  Save, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  X, 
  Settings, 
  Edit3, 
  User, 
  Cpu, 
  CheckCircle2, 
  WashingMachine, 
  Wind, 
  Sparkles, 
  Package, 
  Workflow, 
  ChevronRight, 
  RefreshCw, 
  Info,
  SlidersHorizontal,
  Check,
  AlertCircle
} from 'lucide-react';
import { useDialog } from '@/components/DialogProvider';

export interface MasterPipelineStep {
  step: number;
  nama: string;
  needStaff: boolean;
  needMesin: boolean;
}

const getStepTheme = (nama: string) => {
  const n = (nama || '').toLowerCase();
  if (n.includes('cuci')) {
    return {
      icon: WashingMachine,
      bg: 'bg-sky-50/70 border-sky-200/80',
      iconBg: 'bg-sky-500 text-white',
      badge: 'bg-sky-100 text-sky-800 border-sky-300',
      tag: 'Cuci & Chemical',
      desc: 'Pencucian pakaian menggunakan mesin washer, deterjen & softener.'
    };
  }
  if (n.includes('kering')) {
    return {
      icon: Wind,
      bg: 'bg-amber-50/70 border-amber-200/80',
      iconBg: 'bg-amber-500 text-white',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      tag: 'Pengeringan',
      desc: 'Pengeringan pakaian basah menggunakan mesin dryer / tumble.'
    };
  }
  if (n.includes('setrika') || n.includes('gosok')) {
    return {
      icon: Sparkles,
      bg: 'bg-purple-50/70 border-purple-200/80',
      iconBg: 'bg-purple-600 text-white',
      badge: 'bg-purple-100 text-purple-800 border-purple-300',
      tag: 'Finishing Uap',
      desc: 'Penyetrikaan dan perapihan serat pakaian menggunakan setrika uap.'
    };
  }
  if (n.includes('lipat') || n.includes('pack') || n.includes('kemas')) {
    return {
      icon: Package,
      bg: 'bg-teal-50/70 border-teal-200/80',
      iconBg: 'bg-teal-600 text-white',
      badge: 'bg-teal-100 text-teal-800 border-teal-300',
      tag: 'Packing & Lipat',
      desc: 'Pelipatan rapi, QC akhir, dan pengemasan ke dalam kantong plastik.'
    };
  }
  if (n.includes('siap') || n.includes('ambil') || n.includes('selesai') || n.includes('rak') || n.includes('antar')) {
    return {
      icon: CheckCircle2,
      bg: 'bg-emerald-50/70 border-emerald-200/80',
      iconBg: 'bg-emerald-600 text-white',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      tag: 'Serah Terima',
      desc: 'Pakaian selesai diproses, masuk rak simpan, dan siap diserahkan.'
    };
  }
  return {
    icon: Workflow,
    bg: 'bg-slate-50 border-slate-200/90',
    iconBg: 'bg-slate-700 text-white',
    badge: 'bg-slate-100 text-slate-800 border-slate-300',
    tag: 'Custom Step',
    desc: 'Langkah pemrosesan operasional kustom outlet.'
  };
};

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

  const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;

    await handleSaveAll(newSteps);
  };

  const handleDelete = async (index: number) => {
    const isConfirmed = await showConfirm(`Hapus langkah "${steps[index]?.nama}" dari Master Data? (Perubahan akan langsung disimpan)`);
    if (!isConfirmed) return;
    const newSteps = steps.filter((_, i) => i !== index);
    handleSaveAll(newSteps);
  };

  const handleOpenAdd = () => {
    setEditingIndex(null);
    setNamaStep('');
    setNeedStaff(true);
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
      await showAlert('Nama langkah wajib diisi.', 'warning');
      return;
    }

    const newStep: MasterPipelineStep = {
      step: 0,
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
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 max-w-lg mx-auto my-12 shadow-xs">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 text-base">Akses Dibatasi</h3>
        <p className="text-xs text-slate-500 mt-1">Menu Master Langkah hanya dapat diakses dan dikonfigurasi oleh Manager.</p>
      </div>
    );
  }

  // Calculate statistics
  const totalLangkah = steps.length;
  const needMesinCount = steps.filter(s => s.needMesin).length;
  const needStaffCount = steps.filter(s => s.needStaff).length;
  const autoStepCount = steps.filter(s => !s.needMesin && !s.needStaff).length;

  const modalPreviewTheme = getStepTheme(namaStep || 'Pratinjau');

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto w-full text-slate-700">
      
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#1E4648] text-white flex items-center justify-center shadow-md shrink-0">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Master Langkah Pengerjaan</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                SOP Pipeline Drop Off
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Standar alur kerja pengerjaan pesanan Drop Off dari awal proses pencucian hingga siap diambil pelanggan.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={loadData}
            title="Segarkan Data"
            className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Langkah Baru</span>
          </button>
        </div>
      </div>

      {/* 2. Overview KPI / Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Tahap</span>
            <div className="w-7 h-7 rounded-xl bg-teal-50 text-[#1E4648] flex items-center justify-center">
              <GitMerge className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2 font-mono">{totalLangkah}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Tahap dalam alur pengerjaan</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Alokasi Mesin</span>
            <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-700 mt-2 font-mono">{needMesinCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Wajib pilih Washer / Dryer</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">PIC Operator</span>
            <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 font-mono">{needStaffCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Wajib dicatat nama staf pengerja</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tahap Akhir</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">{autoStepCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Serah terima & simpan rak</p>
        </div>
      </div>

      {/* 3. Visual Workflow Timeline Sequence Strip */}
      {steps.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Workflow className="w-4 h-4 text-[#1E4648]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Urutan Alur Pengerjaan (Workflow Sequence)</h2>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">Tersinkronisasi otomatis dengan nota tracking & pengerjaan kasir</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
            {steps.map((s, idx) => {
              const theme = getStepTheme(s.nama);
              const StepIcon = theme.icon;
              return (
                <React.Fragment key={idx}>
                  <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200/90 px-3.5 py-2 rounded-xl shadow-2xs">
                    <span className="w-5 h-5 rounded-full bg-[#1E4648] text-white text-[10px] font-black flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <StepIcon className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-xs font-bold text-slate-800">{s.nama}</span>
                    {s.needMesin && (
                      <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 rounded text-[9px] font-black">
                        MESIN
                      </span>
                    )}
                    {s.needStaff && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black">
                        STAFF
                      </span>
                    )}
                  </div>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Detailed Master Steps Cards Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#1E4648]" />
              <span>Daftar Master Langkah & Konfigurasi Syarat</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Langkah di bawah ini akan menjadi pilihan checklist saat Anda mengatur tahapan pengerjaan pada tiap produk Drop Off (di menu Manajemen Produk).
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 animate-pulse space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="w-8 h-8 bg-slate-200 rounded-xl" />
                    <div className="w-16 h-4 bg-slate-200 rounded" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-28" />
                  <div className="h-3 bg-slate-200 rounded w-full" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-5 bg-slate-200 rounded w-20" />
                    <div className="h-5 bg-slate-200 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-xs border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <GitMerge className="w-7 h-7 text-[#1E4648]" />
              </div>
              <p className="text-slate-800 text-sm font-bold mb-1">Belum Ada Master Langkah</p>
              <p className="text-slate-400 text-xs max-w-sm mx-auto mb-4 leading-relaxed">
                Tambahkan langkah operasional (misal: Dicuci, Dikeringkan, Disetrika, Dilipat, Siap Diambil) untuk digunakan sebagai template pengerjaan.
              </p>
              <button
                onClick={handleOpenAdd}
                className="px-5 py-2.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-xl text-xs shadow-xs transition"
              >
                + Tambah Langkah Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {steps.map((step, index) => {
                const theme = getStepTheme(step.nama);
                const StepIcon = theme.icon;

                return (
                  <div
                    key={index}
                    className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-3.5 transition-all duration-150 hover:shadow-md ${theme.bg}`}
                  >
                    <div>
                      {/* Top Row: Step sequence badge & Reorder + Actions */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-lg bg-[#1E4648] text-white text-[10px] font-black font-mono shadow-2xs">
                            LANGKAH #{index + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-2xs ${theme.badge}`}>
                            {theme.tag}
                          </span>
                        </div>

                        {/* Reorder & Action buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveStep(index, 'up')}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Pindah ke Atas (Urutan Lebih Awal)"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveStep(index, 'down')}
                            disabled={index === steps.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Pindah ke Bawah (Urutan Selanjutnya)"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <div className="h-3 w-px bg-slate-300 mx-0.5" />
                          <button
                            onClick={() => handleOpenEdit(index)}
                            className="p-1 text-slate-500 hover:text-[#1E4648] hover:bg-white rounded-lg transition shadow-2xs"
                            title="Edit Langkah"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Hapus Langkah"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Main Title & Contextual Icon */}
                      <div className="flex items-start gap-3 pt-2.5">
                        <div className={`w-10 h-10 rounded-2xl ${theme.iconBg} flex items-center justify-center shrink-0 shadow-xs`}>
                          <StepIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm leading-tight">{step.nama}</h3>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {theme.desc}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Informative Requirements Matrix */}
                    <div className="pt-2.5 border-t border-slate-200/60 flex flex-col gap-1.5 text-[11px]">
                      <div className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-xl border border-slate-200/70">
                        <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>Pencatatan PIC Staff</span>
                        </span>
                        {step.needStaff ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center gap-1">
                            <Check className="w-3 h-3 text-amber-600" />
                            <span>Wajib Isi Staff</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold text-[10px]">
                            Opsional
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-xl border border-slate-200/70">
                        <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-slate-400" />
                          <span>Alokasi Mesin Laundry</span>
                        </span>
                        {step.needMesin ? (
                          <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 font-bold text-[10px] flex items-center gap-1">
                            <Check className="w-3 h-3 text-sky-600" />
                            <span>Wajib Pilih Mesin</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold text-[10px]">
                            Tanpa Mesin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Modal Add / Edit Langkah */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-slate-200 shadow-2xl relative my-8 animate-fade-in">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#1E4648] flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {editingIndex !== null ? 'Edit Master Langkah' : 'Tambah Master Langkah Baru'}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-5 border-b border-slate-100 pb-3">
              Tentukan nama tahapan dan syarat pengerjaan (staf/mesin) dalam alur pipeline.
            </p>
            
            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Nama Langkah Pengerjaan *</label>
                <input
                  type="text"
                  value={namaStep}
                  onChange={(e) => setNamaStep(e.target.value)}
                  placeholder="Contoh: Dicuci, Dikeringkan, Disetrika, Dilipat..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#1E4648] focus:bg-white transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">Nama langkah akan muncul pada status tracking nota pelanggan & pipeline dapur.</p>
              </div>

              {/* Live Preview of the Step */}
              {namaStep.trim() && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${modalPreviewTheme.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
                    <modalPreviewTheme.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 text-xs truncate">{namaStep}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border shadow-2xs ${modalPreviewTheme.badge}`}>
                        {modalPreviewTheme.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">{modalPreviewTheme.desc}</p>
                  </div>
                </div>
              )}

              {/* Requirement Checkboxes */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-3.5">
                <label className="flex items-start gap-3 cursor-pointer group select-none">
                  <input 
                    type="checkbox" 
                    checked={needStaff}
                    onChange={(e) => setNeedStaff(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#1E4648] focus:ring-[#1E4648]"
                  />
                  <div className="flex flex-col">
                    <span className="text-slate-800 font-bold group-hover:text-[#1E4648] transition">Wajib Isi Petugas (PIC Staff)</span>
                    <span className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      Kasir/operator wajib memilih nama staf yang mengerjakan saat update status tahap ini (digunakan juga untuk kalkulasi insentif payroll).
                    </span>
                  </div>
                </label>

                <div className="h-px bg-slate-200/70" />

                <label className="flex items-start gap-3 cursor-pointer group select-none">
                  <input 
                    type="checkbox" 
                    checked={needMesin}
                    onChange={(e) => setNeedMesin(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-[#1E4648] focus:ring-[#1E4648]"
                  />
                  <div className="flex flex-col">
                    <span className="text-slate-800 font-bold group-hover:text-[#1E4648] transition">Wajib Pilih Mesin Laundry</span>
                    <span className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      Sistem akan mewajibkan kasir memilih mesin cuci (Washer) atau mesin pengering (Dryer) yang sedang berstatus Kosong.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 mt-6 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveModal}
                className="flex-1 py-2.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Master</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
