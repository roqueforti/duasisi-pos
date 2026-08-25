'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Trash2,
  Edit3,
  ShieldCheck,
  RotateCcw,
  Save,
  X,
  Loader2
} from 'lucide-react';
import { runBackend } from '@/lib/api';
import { clearCache } from '@/lib/cache';
import { useDialog } from '@/components/DialogProvider';
import { DuplicateGroup, DuplicateResolutionPayload } from '@/lib/types';

interface DuplicateCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
  initialGroups?: DuplicateGroup[];
}

interface ItemResolutionState {
  action: 'KEEP' | 'AUTO_RECODE' | 'RENAME' | 'DELETE';
  customCode: string;
}

export default function DuplicateCodesModal({
  isOpen,
  onClose,
  onResolved,
  initialGroups = []
}: DuplicateCodesModalProps) {
  const { showAlert, showConfirm } = useDialog();
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>(initialGroups);
  
  // Mapping: `${rowIndex}` -> resolution state
  const [resolutions, setResolutions] = useState<Record<number, ItemResolutionState>>({});

  const initResolutions = (groups: DuplicateGroup[]) => {
    const map: Record<number, ItemResolutionState> = {};
    groups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.isPrimary) {
          map[item.rowIndex] = {
            action: 'KEEP',
            customCode: item.id
          };
        } else {
          // Default to AUTO_RECODE to prevent accidental data deletion
          map[item.rowIndex] = {
            action: 'AUTO_RECODE',
            customCode: item.suggestedCode || `${item.id}-NEW`
          };
        }
      });
    });
    setResolutions(map);
  };

  const fetchDuplicates = async () => {
    setIsScanning(true);
    try {
      clearCache('getLayananListAll');
      clearCache('getLayananList');
      const res = await runBackend<{
        hasDuplicates: boolean;
        totalDuplicateGroups: number;
        totalDuplicateRows: number;
        duplicateGroups: DuplicateGroup[];
      }>('checkDuplicateItemCodes');

      if (res && Array.isArray(res.duplicateGroups)) {
        setDuplicateGroups(res.duplicateGroups);
        initResolutions(res.duplicateGroups);
      } else {
        setDuplicateGroups([]);
        setResolutions({});
      }
    } catch (err: any) {
      console.error('Gagal memindai duplikasi kode:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialGroups && initialGroups.length > 0) {
        setDuplicateGroups(initialGroups);
        initResolutions(initialGroups);
      } else {
        fetchDuplicates();
      }
    }
  }, [isOpen, initialGroups]);

  if (!isOpen) return null;

  const totalDuplicates = duplicateGroups.reduce(
    (acc, g) => acc + g.items.filter((i) => !i.isPrimary).length,
    0
  );

  const handleActionChange = (
    rowIndex: number,
    action: 'KEEP' | 'AUTO_RECODE' | 'RENAME' | 'DELETE',
    defaultCode?: string
  ) => {
    setResolutions((prev) => ({
      ...prev,
      [rowIndex]: {
        action,
        customCode: defaultCode !== undefined ? defaultCode : (prev[rowIndex]?.customCode || '')
      }
    }));
  };

  const handleCustomCodeChange = (rowIndex: number, val: string) => {
    setResolutions((prev) => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        customCode: val.trim().toUpperCase()
      }
    }));
  };

  const handleApplyAutoRecodeAll = () => {
    const newMap: Record<number, ItemResolutionState> = { ...resolutions };
    duplicateGroups.forEach((group) => {
      group.items.forEach((item) => {
        if (!item.isPrimary) {
          newMap[item.rowIndex] = {
            action: 'AUTO_RECODE',
            customCode: item.suggestedCode || `${item.id}-NEW`
          };
        }
      });
    });
    setResolutions(newMap);
  };

  const handleSaveResolutions = async () => {
    // Validate custom codes
    const payload: DuplicateResolutionPayload[] = [];
    const usedNewCodes = new Set<string>();

    // Collect all primary codes first
    duplicateGroups.forEach((g) => {
      g.items.forEach((item) => {
        const res = resolutions[item.rowIndex];
        if (res && (res.action === 'KEEP' || item.isPrimary)) {
          usedNewCodes.add(item.id.toUpperCase());
        }
      });
    });

    for (const group of duplicateGroups) {
      for (const item of group.items) {
        const res = resolutions[item.rowIndex];
        if (!res) continue;

        if (res.action === 'AUTO_RECODE' || res.action === 'RENAME') {
          const targetCode = res.customCode.trim().toUpperCase();
          if (!targetCode) {
            await showAlert(
              `Kode baru untuk item "${item.nama}" (baris ${item.rowIndex}) tidak boleh kosong!`,
              'warning'
            );
            return;
          }
          if (usedNewCodes.has(targetCode)) {
            await showAlert(
              `Kode baru "${targetCode}" untuk "${item.nama}" bentrok/sama dengan item lain. Harap gunakan kode unik!`,
              'warning'
            );
            return;
          }
          usedNewCodes.add(targetCode);

          payload.push({
            rowIndex: item.rowIndex,
            originalId: item.id,
            nama: item.nama,
            action: res.action,
            newCode: targetCode
          });
        } else if (res.action === 'DELETE') {
          payload.push({
            rowIndex: item.rowIndex,
            originalId: item.id,
            nama: item.nama,
            action: 'DELETE'
          });
        }
      }
    }

    if (payload.length === 0) {
      await showAlert('Tidak ada perubahan perapian kode yang dipilih.', 'info');
      onClose();
      return;
    }

    const deleteCount = payload.filter((p) => p.action === 'DELETE').length;
    const renameCount = payload.filter(
      (p) => p.action === 'AUTO_RECODE' || p.action === 'RENAME'
    ).length;

    let confirmMsg = `Terapkan perapian kode?\n• ${renameCount} item akan diperbarui kodenya (data tetap aman)\n`;
    if (deleteCount > 0) {
      confirmMsg += `• ⚠️ ${deleteCount} item akan DIHAPUS permanen`;
    }

    const isConfirmed = await showConfirm(confirmMsg, 'Konfirmasi Perapian Kode');
    if (!isConfirmed) return;

    setLoading(true);
    try {
      const res = await runBackend<{
        success: boolean;
        updatedCount?: number;
        deletedCount?: number;
        message?: string;
      }>('resolveDuplicateItemCodes', payload, 'Manager');

      if (res && res.success) {
        clearCache('getLayananListAll');
        clearCache('getLayananList');
        clearCache('checkDuplicateItemCodes');
        await showAlert(
          res.message || 'Perapian kode produk berhasil diterapkan!',
          'success',
          'Selesai'
        );
        onResolved();
        onClose();
      } else {
        await showAlert(
          res?.message || 'Gagal menerapkan perapian kode.',
          'error'
        );
      }
    } catch (err: any) {
      console.error(err);
      await showAlert(
        'Terjadi kesalahan: ' + (err?.message || String(err)),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto flex flex-col max-h-[92vh] overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 border border-white/30 shadow-inner">
              <AlertTriangle className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                Peringatan & Perapian Kode Item Duplikat
                <span className="text-xs bg-amber-950/40 text-amber-100 px-2.5 py-0.5 rounded-full font-medium border border-white/20">
                  {duplicateGroups.length} Grup Duplikat ({totalDuplicates} Item)
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-amber-100/90 mt-0.5">
                Sistem mendeteksi beberapa produk memiliki kode yang sama. Silakan tinjau dan rapikan kodenya.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
            title="Tutup Modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Safety & Notice Banner */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3.5 flex items-start gap-3 text-xs sm:text-sm text-emerald-900 shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-emerald-800">Keamanan Data Existing Terjamin (Zero Data Loss):</span>{' '}
            Semua riwayat transaksi, harga, dan bahan baku Anda <strong>tetap 100% aman</strong>.
            Sistem secara default merekomendasikan <strong>"Beri Kode Baru Unik"</strong>. Item Anda tidak akan dihapus kecuali jika Anda sengaja memilih tombol hapus.
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyAutoRecodeAll}
              disabled={loading || duplicateGroups.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>🪄 Beri Kode Baru ke Semua Duplikat (100% Aman)</span>
            </button>

            <button
              type="button"
              onClick={fetchDuplicates}
              disabled={isScanning || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition-all shadow-2xs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Pindai Ulang</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            💡 Baris pertama tiap grup adalah item utama (Primary).
          </div>
        </div>

        {/* Main Content / Table of Duplicates */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {isScanning ? (
            <div className="py-20 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
              <p className="text-sm font-medium">Sedang memindai seluruh sheet produk...</p>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Luar Biasa! Tidak Ada Kode Duplikat
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Seluruh produk dan layanan di outlet Anda sudah memiliki kode yang unik dan rapi.
              </p>
            </div>
          ) : (
            duplicateGroups.map((group, gIdx) => (
              <div
                key={`group-${group.code}-${gIdx}`}
                className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
              >
                {/* Group Header */}
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200/80 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-amber-600 text-white font-mono font-bold text-xs rounded-md shadow-2xs">
                      {group.code}
                    </span>
                    <span className="text-xs font-semibold text-amber-900">
                      Ditemukan {group.items.length} item dengan kode kembar ini
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium">
                    Pilih tindakan untuk masing-masing item di bawah
                  </span>
                </div>

                {/* Table for this group */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-4 w-28">Status</th>
                        <th className="py-2.5 px-4">Nama Produk</th>
                        <th className="py-2.5 px-3 w-28">Kategori</th>
                        <th className="py-2.5 px-3 w-28">Harga</th>
                        <th className="py-2.5 px-4 min-w-[320px]">Tindakan Perapian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item, idx) => {
                        const state = resolutions[item.rowIndex] || {
                          action: item.isPrimary ? 'KEEP' : 'AUTO_RECODE',
                          customCode: item.suggestedCode || item.id
                        };

                        const isPrimary = item.isPrimary || idx === 0;

                        return (
                          <tr
                            key={`item-${item.rowIndex}-${idx}`}
                            className={`transition-colors ${
                              state.action === 'DELETE'
                                ? 'bg-rose-50/70 opacity-80'
                                : state.action === 'AUTO_RECODE' || state.action === 'RENAME'
                                ? 'bg-indigo-50/40'
                                : isPrimary
                                ? 'bg-white'
                                : 'bg-slate-50/80'
                            }`}
                          >
                            {/* Status Badge */}
                            <td className="py-3 px-4">
                              {isPrimary ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  🌟 Utama
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  ⚠️ Duplikat #{idx}
                                </span>
                              )}
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Baris Sheet: {item.rowIndex}
                              </div>
                            </td>

                            {/* Nama Produk */}
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <span>{item.icon || '🧺'}</span>
                                <span>{item.nama}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>Kode saat ini: <code className="font-mono font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{item.id}</code></span>
                                <span>•</span>
                                <span>Satuan: {item.satuan}</span>
                              </div>
                            </td>

                            {/* Kategori & Tipe */}
                            <td className="py-3 px-3">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {item.kategori || 'Self Service'}
                              </span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {item.tipe || 'SelfService'}
                              </div>
                            </td>

                            {/* Harga */}
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-800">
                                Rp {Number(item.harga || 0).toLocaleString('id-ID')}
                              </span>
                            </td>

                            {/* Action Options */}
                            <td className="py-3 px-4">
                              {isPrimary ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Pertahankan Kode Asli ({item.id})
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {/* Auto Recode Button */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleActionChange(
                                          item.rowIndex,
                                          'AUTO_RECODE',
                                          item.suggestedCode || `${item.id}-NEW`
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                                        state.action === 'AUTO_RECODE'
                                          ? 'bg-indigo-600 text-white shadow-2xs'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                      }`}
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-300" />
                                      <span>Beri Kode Baru</span>
                                    </button>

                                    {/* Rename Manual Button */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleActionChange(item.rowIndex, 'RENAME')
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                                        state.action === 'RENAME'
                                          ? 'bg-blue-600 text-white shadow-2xs'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                      }`}
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Edit Manual</span>
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleActionChange(item.rowIndex, 'DELETE')
                                      }
                                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                                        state.action === 'DELETE'
                                          ? 'bg-rose-600 text-white shadow-2xs'
                                          : 'bg-slate-100 text-rose-600 hover:bg-rose-100'
                                      }`}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Hapus Duplikat</span>
                                    </button>
                                  </div>

                                  {/* Code Input for AUTO_RECODE / RENAME */}
                                  {(state.action === 'AUTO_RECODE' ||
                                    state.action === 'RENAME') && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className="text-[11px] text-slate-500 font-medium">
                                        Kode baru:
                                      </span>
                                      <input
                                        type="text"
                                        value={state.customCode}
                                        onChange={(e) =>
                                          handleCustomCodeChange(
                                            item.rowIndex,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Misal: SS-002"
                                        className="font-mono text-xs font-bold uppercase px-2.5 py-1 bg-white border border-indigo-300 rounded-md focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden w-36 text-indigo-900 shadow-2xs"
                                      />
                                      {item.suggestedCode &&
                                        state.customCode === item.suggestedCode && (
                                          <span className="text-[10px] text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded font-medium">
                                            Rekomendasi Otomatis
                                          </span>
                                        )}
                                    </div>
                                  )}

                                  {state.action === 'DELETE' && (
                                    <div className="text-[11px] text-rose-700 font-medium bg-rose-100/80 px-2 py-0.5 rounded-md inline-block">
                                      ⚠️ Baris ini akan dihapus dari sheet saat disimpan.
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {duplicateGroups.length > 0 ? (
              <span>
                Total <strong>{duplicateGroups.length} grup</strong> kode kembar ditemukan.
              </span>
            ) : (
              <span>Semua kode sudah unik.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Nanti Saja
            </button>

            <button
              type="button"
              onClick={handleSaveResolutions}
              disabled={loading || duplicateGroups.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan & Terapkan Perapian Kode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
