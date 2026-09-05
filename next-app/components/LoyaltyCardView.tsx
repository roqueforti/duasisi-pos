'use client';

import React, { useState, useEffect } from 'react';
import { LoyaltyProgram, LoyaltyClaimRule, LoyaltyTargetKapasitas, LoyaltySyaratLayanan, UserRole } from '@/lib/types';
import { 
  DEFAULT_LOYALTY_PROGRAMS, 
  getLoyaltyProgramsLocal, 
  saveLoyaltyProgramsLocal, 
  fetchLoyaltyPrograms 
} from '@/lib/loyaltyUtils';
import { runBackend } from '@/lib/api';
import { useDialog } from '@/components/DialogProvider';
import { 
  Award, 
  Plus, 
  Edit3, 
  Trash2, 
  Star, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Layers, 
  Info,
  Gift,
  WashingMachine,
  ShieldCheck,
  RefreshCw,
  Copy,
  X
} from 'lucide-react';

interface LoyaltyCardViewProps {
  currentRole?: UserRole;
}

const TEMA_CONFIG = {
  emerald: {
    bg: 'from-emerald-900 to-teal-950',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    btn: 'bg-emerald-600 hover:bg-emerald-700',
    glow: 'shadow-emerald-900/40',
    name: 'Emerald Green'
  },
  teal: {
    bg: 'from-teal-900 to-cyan-950',
    border: 'border-teal-500/30',
    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    btn: 'bg-teal-600 hover:bg-teal-700',
    glow: 'shadow-teal-900/40',
    name: 'Teal Cyan'
  },
  gold: {
    bg: 'from-amber-900 to-yellow-950',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    btn: 'bg-amber-600 hover:bg-amber-700',
    glow: 'shadow-amber-900/40',
    name: 'Royal Gold'
  },
  sapphire: {
    bg: 'from-blue-900 to-indigo-950',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    btn: 'bg-blue-600 hover:bg-blue-700',
    glow: 'shadow-blue-900/40',
    name: 'Sapphire Blue'
  },
  slate: {
    bg: 'from-slate-800 to-slate-950',
    border: 'border-slate-600/30',
    badge: 'bg-slate-700/40 text-slate-200 border-slate-600/40',
    btn: 'bg-slate-700 hover:bg-slate-600',
    glow: 'shadow-slate-900/40',
    name: 'Dark Onyx'
  }
};

export default function LoyaltyCardView({ currentRole }: LoyaltyCardViewProps) {
  const { showAlert, showConfirm } = useDialog();
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterTab, setFilterTab] = useState<'all' | '7kg' | '4kg' | 'active'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);

  // Form Fields
  const [formId, setFormId] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formKapasitas, setFormKapasitas] = useState<LoyaltyTargetKapasitas>('7kg');
  const [formSyarat, setFormSyarat] = useState<LoyaltySyaratLayanan>('washer_dryer');
  const [formTotalStamps, setFormTotalStamps] = useState<number>(10);
  const [formClaimRule, setFormClaimRule] = useState<LoyaltyClaimRule>('FREE_ON_NEXT_TRX');
  const [formRewardDeskripsi, setFormRewardDeskripsi] = useState('1x Cuci Gratis');
  const [formWarnaTema, setFormWarnaTema] = useState<'emerald' | 'teal' | 'gold' | 'sapphire' | 'slate'>('emerald');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formIsDefault, setFormIsDefault] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchLoyaltyPrograms();
      setPrograms(data);
    } catch (e) {
      setPrograms(getLoyaltyProgramsLocal());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProgram(null);
    const newId = `CARD_${Date.now()}`;
    setFormId(newId);
    setFormNama('');
    setFormDeskripsi('');
    setFormKapasitas('7kg');
    setFormSyarat('washer_dryer');
    setFormTotalStamps(10);
    setFormClaimRule('FREE_ON_NEXT_TRX');
    setFormRewardDeskripsi('1x Cuci Gratis 7 KG');
    setFormWarnaTema('emerald');
    setFormIsActive(true);
    setFormIsDefault(false);
    setIsModalOpen(true);
  };

  const openEditModal = (prog: LoyaltyProgram) => {
    setEditingProgram(prog);
    setFormId(prog.id);
    setFormNama(prog.nama);
    setFormDeskripsi(prog.deskripsi || '');
    setFormKapasitas(prog.kapasitas);
    setFormSyarat(prog.syaratLayanan);
    setFormTotalStamps(prog.totalStamps);
    setFormClaimRule(prog.claimRule);
    setFormRewardDeskripsi(prog.rewardDeskripsi);
    setFormWarnaTema(prog.warnaTema);
    setFormIsActive(prog.isActive);
    setFormIsDefault(prog.isDefault);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNama.trim()) {
      await showAlert('Nama Program Kartu Loyalty wajib diisi.', 'warning');
      return;
    }

    const payload: LoyaltyProgram = {
      id: formId,
      nama: formNama.trim(),
      deskripsi: formDeskripsi.trim() || undefined,
      kapasitas: formKapasitas,
      syaratLayanan: formSyarat,
      totalStamps: Math.max(1, Number(formTotalStamps) || 10),
      claimRule: formClaimRule,
      rewardDeskripsi: formRewardDeskripsi.trim() || '1x Cuci Gratis',
      rewardType: 'FREE_SERVICE',
      rewardValue: 100,
      warnaTema: formWarnaTema,
      isActive: formIsActive,
      isDefault: formIsDefault,
      urutan: editingProgram ? editingProgram.urutan : programs.length + 1,
    };

    let updatedList = [...programs];
    // If set as default for this capacity, unset other defaults for same capacity
    if (payload.isDefault) {
      updatedList = updatedList.map(p => 
        p.kapasitas === payload.kapasitas ? { ...p, isDefault: false } : p
      );
    }

    const idx = updatedList.findIndex(p => p.id === payload.id);
    if (idx >= 0) {
      updatedList[idx] = payload;
    } else {
      updatedList.push(payload);
    }

    setPrograms(updatedList);
    saveLoyaltyProgramsLocal(updatedList);
    setIsModalOpen(false);

    try {
      await runBackend('saveLoyaltyProgram', payload);
    } catch (err) {
      console.warn('Backend sync loyalty program:', err);
    }

    await showAlert('Program Kartu Loyalty berhasil disimpan!', 'success');
  };

  const handleDelete = async (prog: LoyaltyProgram) => {
    if (programs.length <= 1) {
      await showAlert('Minimal harus ada 1 program kartu loyalty.', 'warning');
      return;
    }

    const confirmed = await showConfirm(
      `Hapus program kartu "${prog.nama}"? Pelanggan yang ditugaskan ke kartu ini akan dialihkan ke kartu default.`,
      'Konfirmasi Hapus Kartu'
    );
    if (!confirmed) return;

    const filtered = programs.filter(p => p.id !== prog.id);
    setPrograms(filtered);
    saveLoyaltyProgramsLocal(filtered);

    try {
      await runBackend('deleteLoyaltyProgram', prog.id);
    } catch (err) {
      console.warn('Backend delete loyalty program:', err);
    }

    await showAlert(`Program kartu "${prog.nama}" berhasil dihapus.`, 'success');
  };

  const handleToggleActive = async (prog: LoyaltyProgram) => {
    const updated = programs.map(p => p.id === prog.id ? { ...p, isActive: !p.isActive } : p);
    setPrograms(updated);
    saveLoyaltyProgramsLocal(updated);

    try {
      await runBackend('saveLoyaltyProgram', { ...prog, isActive: !prog.isActive });
    } catch (e) {}
  };

  const handleSetDefault = async (prog: LoyaltyProgram) => {
    const updated = programs.map(p => {
      if (p.kapasitas === prog.kapasitas) {
        return { ...p, isDefault: p.id === prog.id };
      }
      return p;
    });
    setPrograms(updated);
    saveLoyaltyProgramsLocal(updated);

    try {
      await runBackend('saveLoyaltyProgram', { ...prog, isDefault: true });
    } catch (e) {}
    await showAlert(`"${prog.nama}" dijadikan program default untuk kapasitas ${prog.kapasitas.toUpperCase()}.`, 'success');
  };

  // Filtered list
  const filteredPrograms = programs.filter(p => {
    if (filterTab === '7kg') return p.kapasitas === '7kg';
    if (filterTab === '4kg') return p.kapasitas === '4kg';
    if (filterTab === 'active') return p.isActive;
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1E4648] via-[#143234] to-[#0A1D1E] rounded-2xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-300 text-[10px] font-bold uppercase tracking-wider border border-teal-400/30">
                Fitur Manajer &amp; Owner
              </span>
              <span className="text-white/40 text-xs">•</span>
              <span className="text-white/70 text-xs">Aturan Klaim Stempel Fleksibel</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Award className="w-8 h-8 text-amber-300 drop-shadow-sm" />
              <span>Manajemen Kartu Loyalty</span>
            </h1>
            <p className="text-white/70 text-xs md:text-sm max-w-2xl leading-relaxed">
              Atur berbagai jenis program kartu member, jumlah stempel, dan aturan klaim (misal member lama free di stempel ke-10 vs aturan baru 10 stempel dulu baru transaksi ke-11 free).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10 text-xs flex items-center gap-1.5 font-semibold"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs md:text-sm shadow-lg shadow-teal-950/40 flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tambah Program Kartu</span>
            </button>
          </div>
        </div>

        {/* Quick Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-white/10">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-white/60 text-[10px] block">Total Program</span>
            <span className="text-lg font-black text-white">{programs.length} Kartu</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-white/60 text-[10px] block">Default Kapasitas 7 KG</span>
            <span className="text-xs font-bold text-teal-300 truncate block">
              {programs.find(p => p.kapasitas === '7kg' && p.isDefault)?.nama || 'Belum Diatur'}
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-white/60 text-[10px] block">Default Kapasitas 4 KG</span>
            <span className="text-xs font-bold text-amber-300 truncate block">
              {programs.find(p => p.kapasitas === '4kg' && p.isDefault)?.nama || 'Belum Diatur'}
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-white/60 text-[10px] block">Mode Aturan Tersedia</span>
            <span className="text-xs font-bold text-emerald-300">Free ke-10 &amp; Ke-11 Free</span>
          </div>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl w-fit border border-slate-300/70 text-xs">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
            filterTab === 'all' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Semua Kartu ({programs.length})
        </button>
        <button
          onClick={() => setFilterTab('7kg')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
            filterTab === '7kg' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Kapasitas 7 KG ({programs.filter(p => p.kapasitas === '7kg').length})
        </button>
        <button
          onClick={() => setFilterTab('4kg')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
            filterTab === '4kg' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Kapasitas 4 KG ({programs.filter(p => p.kapasitas === '4kg').length})
        </button>
        <button
          onClick={() => setFilterTab('active')}
          className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
            filterTab === 'active' ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Aktif ({programs.filter(p => p.isActive).length})
        </button>
      </div>

      {/* Grid of Loyalty Programs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPrograms.map((prog) => {
          const tema = TEMA_CONFIG[prog.warnaTema] || TEMA_CONFIG.emerald;
          const isLegacyClaim = prog.claimRule === 'FREE_ON_NTH';

          return (
            <div
              key={prog.id}
              className={`rounded-2xl border ${tema.border} bg-gradient-to-b ${tema.bg} text-white p-5 shadow-xl relative flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] ${!prog.isActive ? 'opacity-60 grayscale-[30%]' : ''}`}
            >
              {/* Card Header & Badges */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono text-[10px] font-black tracking-wider uppercase">
                      {prog.kapasitas === 'all' ? 'SEMUA KAPASITAS' : `KAPASITAS ${prog.kapasitas.toUpperCase()}`}
                    </span>
                    {prog.isDefault && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[9px] flex items-center gap-1 shadow-xs">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        DEFAULT
                      </span>
                    )}
                    {!prog.isActive && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[9px] font-bold">
                        NON-AKTIF
                      </span>
                    )}
                  </div>

                  {/* Weight Circle Graphic Indicator */}
                  <div className="w-10 h-10 rounded-full bg-white text-slate-950 flex items-center justify-center font-black text-sm shadow-md shrink-0">
                    {prog.kapasitas === '4kg' ? '4' : '7'}
                  </div>
                </div>

                {/* Title & Desc */}
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white leading-snug">
                    {prog.nama}
                  </h3>
                  <p className="text-white/70 text-xs mt-1 leading-relaxed line-clamp-2">
                    {prog.deskripsi || 'Tidak ada deskripsi tambahan.'}
                  </p>
                </div>

                {/* Claim Rule Pill (Highlight Feature) */}
                <div className={`p-3 rounded-xl border ${
                  isLegacyClaim 
                    ? 'bg-teal-500/10 border-teal-400/30 text-teal-200' 
                    : 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                } space-y-1`}>
                  <div className="flex items-center gap-1.5 text-[11px] font-black">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>
                      {isLegacyClaim ? 'Aturan Member Lama' : 'Aturan Standar Baru'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-tight text-white/90 font-medium">
                    {isLegacyClaim 
                      ? 'Klaim gratis langsung didapat pada stempel ke-10 saat transaksi berlangsung.'
                      : 'Kumpulkan 10 stempel penuh dulu, reward baru bisa dipakai di transaksi berikutnya (ke-11).'}
                  </p>
                </div>

                {/* Properties Summary Table */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/10">
                  <div>
                    <span className="text-white/50 text-[10px] block">Target Stempel:</span>
                    <span className="font-mono font-bold text-white text-xs">{prog.totalStamps} Stempel</span>
                  </div>
                  <div>
                    <span className="text-white/50 text-[10px] block">Syarat Layanan:</span>
                    <span className="font-bold text-white text-xs">
                      {prog.syaratLayanan === 'washer_dryer' ? 'Washer & Dryer' : 'Semua Layanan'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-white/50 text-[10px] block">Bentuk Reward:</span>
                    <span className="font-bold text-amber-300 text-xs flex items-center gap-1">
                      <Gift className="w-3 h-3" />
                      {prog.rewardDeskripsi}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {!prog.isDefault && prog.isActive && (
                    <button
                      onClick={() => handleSetDefault(prog)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition border border-white/10 cursor-pointer"
                      title="Jadikan Program Bawaan"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(prog)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border cursor-pointer ${
                      prog.isActive 
                        ? 'bg-slate-800/80 text-white/80 hover:bg-slate-700 border-white/10' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-500'
                    }`}
                  >
                    {prog.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(prog)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                    title="Edit Program Kartu"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(prog)}
                    className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition cursor-pointer"
                    title="Hapus Program Kartu"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add / Edit Program */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1E4648] to-[#143234] p-4 md:p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-300" />
                  <span>{editingProgram ? 'Edit Program Kartu Loyalty' : 'Tambah Program Kartu Loyalty'}</span>
                </h3>
                <p className="text-white/70 text-xs mt-0.5">
                  Tentukan target kapasitas, jumlah stempel, dan aturan klaim reward.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              
              {/* Nama Program */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Program / Kartu *</label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Kartu 7 KG Member Lama atau Kartu 7 KG Baru"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-slate-800 text-xs font-semibold"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Deskripsi Tambahan</label>
                <textarea
                  rows={2}
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  placeholder="Catatan tujuan kartu loyalty ini untuk kasir/manajer..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 text-slate-800 text-xs"
                />
              </div>

              {/* Kapasitas & Syarat Layanan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Kapasitas Mesin</label>
                  <select
                    value={formKapasitas}
                    onChange={(e) => setFormKapasitas(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-teal-600 text-slate-800 font-semibold"
                  >
                    <option value="7kg">Kapasitas 7 KG (Sisi Depan)</option>
                    <option value="4kg">Kapasitas 4 KG (Sisi Belakang)</option>
                    <option value="all">Semua Kapasitas / Bebas</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Syarat Layanan</label>
                  <select
                    value={formSyarat}
                    onChange={(e) => setFormSyarat(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-teal-600 text-slate-800 font-semibold"
                  >
                    <option value="washer_dryer">Washer + Dryer (Cuci &amp; Kering)</option>
                    <option value="washer_only">Washer Saja (Hanya Cuci)</option>
                    <option value="all">Semua Layanan Laundry</option>
                  </select>
                </div>
              </div>

              {/* Target Stempel & Bentuk Reward */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Jumlah Stempel Penuh</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    value={formTotalStamps}
                    onChange={(e) => setFormTotalStamps(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-teal-600 font-mono font-bold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-500">Standar adalah 10 stempel</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Deskripsi Reward</label>
                  <input
                    type="text"
                    required
                    value={formRewardDeskripsi}
                    onChange={(e) => setFormRewardDeskripsi(e.target.value)}
                    placeholder="Contoh: 1x Cuci Gratis 7 KG"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-teal-600 font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* ATURAN KLAIM (CORE FEATURE) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <label className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Aturan Klaim Reward Stempel *</span>
                </label>

                <div className="space-y-2">
                  {/* Option 1: FREE_ON_NEXT_TRX */}
                  <label 
                    onClick={() => setFormClaimRule('FREE_ON_NEXT_TRX')}
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                      formClaimRule === 'FREE_ON_NEXT_TRX'
                        ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="claimRule"
                      checked={formClaimRule === 'FREE_ON_NEXT_TRX'}
                      onChange={() => setFormClaimRule('FREE_ON_NEXT_TRX')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>Kumpulkan 10 Stamp Dulu, Transaksi ke-11 Free (Standar Baru)</span>
                      </span>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Member menyelesaikan 10 transaksi stempel (bayar normal). Setelah mencapai 10/10 stempel, reward berstatus Siap Klaim dan dapat digunakan pada <strong>transaksi berikutnya (kunjungan ke-11)</strong>.
                      </p>
                    </div>
                  </label>

                  {/* Option 2: FREE_ON_NTH */}
                  <label 
                    onClick={() => setFormClaimRule('FREE_ON_NTH')}
                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                      formClaimRule === 'FREE_ON_NTH'
                        ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="claimRule"
                      checked={formClaimRule === 'FREE_ON_NTH'}
                      onChange={() => setFormClaimRule('FREE_ON_NTH')}
                      className="mt-0.5 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                        <span>Free Langsung di Stempel ke-10 (Khusus Member Lama)</span>
                      </span>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Begitu member mencapai stempel ke-10 pada transaksi saat itu, <strong>transaksi ke-10 tersebut langsung gratis</strong> tanpa perlu menunggu kunjungan ke-11.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tema Warna & Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tema Visual Kartu</label>
                  <select
                    value={formWarnaTema}
                    onChange={(e) => setFormWarnaTema(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl outline-none focus:border-teal-600 text-slate-800 font-semibold"
                  >
                    <option value="emerald">Emerald Green (Standar Baru)</option>
                    <option value="teal">Teal Cyan (Klasik Member Lama)</option>
                    <option value="gold">Royal Gold (Kapasitas 4 KG / VIP)</option>
                    <option value="sapphire">Sapphire Blue (Spesial)</option>
                    <option value="slate">Dark Onyx (Eksklusif)</option>
                  </select>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="font-bold text-slate-800">Program Aktif</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIsDefault}
                      onChange={(e) => setFormIsDefault(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="font-bold text-slate-800">Jadikan Default untuk {formKapasitas.toUpperCase()}</span>
                  </label>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black shadow-md shadow-teal-900/20 transition cursor-pointer"
                >
                  Simpan Program Kartu
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
