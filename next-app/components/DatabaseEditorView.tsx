'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Database,
  Lock,
  Unlock,
  KeyRound,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ShoppingCart,
  Users,
  Package,
  Tag,
  UserCheck,
  WashingMachine,
  Coins,
  Gift,
  Award,
  GitMerge,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

interface DatabaseEditorViewProps {
  currentRole?: UserRole;
}

interface TableStats {
  count: number;
  primaryKey: string;
  label: string;
  icon: string;
  description: string;
}

const TABLE_ICONS: Record<string, any> = {
  transaksi: ShoppingCart,
  transaksi_items: Layers,
  pelanggan: Users,
  inventory: Package,
  layanan: Tag,
  pegawai: UserCheck,
  mesin: WashingMachine,
  kas_shift: Coins,
  promo: Gift,
  loyalty_programs: Award,
  pipeline_steps: GitMerge,
  audit_logs: ShieldCheck,
  app_settings: SlidersHorizontal,
};

export default function DatabaseEditorView({ currentRole }: DatabaseEditorViewProps) {
  const { showAlert, showConfirm } = useDialog();

  // Security Gate State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('duasisi_db_editor_unlocked') === 'true';
    }
    return false;
  });
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>('');
  const [verifyingPassword, setVerifyingPassword] = useState<boolean>(false);

  // Change Password Modal State
  const [showChangePassModal, setShowChangePassModal] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');

  // Table Selection & Data State
  const [tables, setTables] = useState<Record<string, TableStats>>({});
  const [activeTable, setActiveTable] = useState<string>('layanan');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [loadingTables, setLoadingTables] = useState<boolean>(false);

  // Grid Data State
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string>('id');
  const [totalRows, setTotalRows] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loadingRows, setLoadingRows] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Inline Cell Editing State
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colName: string; pkVal: any } | null>(null);
  const [editVal, setEditVal] = useState<string>('');
  const [savingCell, setSavingCell] = useState<boolean>(false);
  const [cellFeedback, setCellFeedback] = useState<{ rowIdx: number; colName: string; status: 'saved' | 'error' } | null>(null);

  // Insert Row Modal State
  const [showInsertModal, setShowInsertModal] = useState<boolean>(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [insertingRow, setInsertingRow] = useState<boolean>(false);

  // 1. Load Table Summaries on mount if unlocked
  useEffect(() => {
    if (isUnlocked) {
      loadTables();
    }
  }, [isUnlocked]);

  // 2. Load Rows whenever activeTable, page, limit, sortCol, sortDir change
  useEffect(() => {
    if (isUnlocked && activeTable) {
      loadRows();
    }
  }, [isUnlocked, activeTable, page, limit, sortCol, sortDir]);

  // Search debounce
  useEffect(() => {
    if (!isUnlocked || !activeTable) return;
    const timer = setTimeout(() => {
      setPage(1);
      loadRows();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadTables = async () => {
    setLoadingTables(true);
    try {
      const res = await fetch('/api/admin/db-editor');
      const data = await res.json();
      if (data.success && data.tables) {
        setTables(data.tables);
        // Default activeTable if current not found
        if (!data.tables[activeTable]) {
          const firstKey = Object.keys(data.tables)[0] || 'layanan';
          setActiveTable(firstKey);
        }
      }
    } catch (e) {
      console.error('Failed to load table stats:', e);
    } finally {
      setLoadingTables(false);
    }
  };

  const loadRows = async () => {
    setLoadingRows(true);
    setEditingCell(null);
    try {
      const params = new URLSearchParams({
        table: activeTable,
        page: String(page),
        limit: String(limit),
      });
      if (searchQuery) params.set('search', searchQuery);
      if (sortCol) {
        params.set('sortCol', sortCol);
        params.set('sortDir', sortDir);
      }

      const res = await fetch(`/api/admin/db-editor?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.rows || []);
        setColumns(data.columns || []);
        setPrimaryKey(data.primaryKey || 'id');
        setTotalRows(data.totalRows || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        showAlert(data.message || 'Gagal memuat data baris.', 'error');
      }
    } catch (err: any) {
      showAlert('Koneksi ke database Supabase gagal: ' + err.message, 'error');
    } finally {
      setLoadingRows(false);
    }
  };

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('Silakan masukkan kata sandi alfanumerik.');
      return;
    }

    setVerifyingPassword(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/admin/db-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verifyPassword',
          password: passwordInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsUnlocked(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('duasisi_db_editor_unlocked', 'true');
        }
        setPasswordInput('');
      } else {
        setPasswordError(data.message || 'Kata sandi alfanumerik salah.');
      }
    } catch (err: any) {
      setPasswordError('Gagal memverifikasi: ' + (err?.message || 'Error jaringan'));
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleLockSession = () => {
    setIsUnlocked(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('duasisi_db_editor_unlocked');
    }
    setPasswordInput('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      showAlert('Lengkapi kata sandi lama dan baru!', 'warning');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('Kata sandi baru minimal 6 karakter alfanumerik!', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/admin/db-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changePassword',
          oldPassword: oldPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await showAlert('Kata sandi Database Editor berhasil diperbarui!', 'success');
        setShowChangePassModal(false);
        setOldPassword('');
        setNewPassword('');
      } else {
        await showAlert(data.message || 'Gagal mengubah kata sandi.', 'error');
      }
    } catch (e: any) {
      showAlert(e.message || 'Error', 'error');
    }
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const startEditCell = (rowIdx: number, colName: string, pkVal: any, currentVal: any) => {
    // Jangan izinkan edit kolom primary key secara inline untuk keamanan relasi
    if (colName === primaryKey) {
      showAlert(`Kolom primary key '${primaryKey}' tidak dapat diubah langsung.`, 'warning');
      return;
    }
    setEditingCell({ rowIdx, colName, pkVal });
    if (currentVal === null || currentVal === undefined) {
      setEditVal('');
    } else if (typeof currentVal === 'object') {
      setEditVal(JSON.stringify(currentVal));
    } else {
      setEditVal(String(currentVal));
    }
  };

  const commitEditCell = async () => {
    if (!editingCell) return;
    const { rowIdx, colName, pkVal } = editingCell;
    const currentVal = rows[rowIdx]?.[colName];

    // Cek apakah ada perubahan
    const strCurrent = currentVal === null || currentVal === undefined ? '' : typeof currentVal === 'object' ? JSON.stringify(currentVal) : String(currentVal);
    if (strCurrent === editVal.trim()) {
      setEditingCell(null);
      return;
    }

    setSavingCell(true);
    try {
      const res = await fetch('/api/admin/db-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateCell',
          table: activeTable,
          primaryKey,
          primaryKeyValue: pkVal,
          column: colName,
          value: editVal.trim(),
          actor: 'Manager (Live Editor)',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Update state lokal baris
        const updated = [...rows];
        updated[rowIdx] = {
          ...updated[rowIdx],
          [colName]: data.updatedRow?.[colName] ?? editVal.trim(),
        };
        setRows(updated);
        setCellFeedback({ rowIdx, colName, status: 'saved' });
        setTimeout(() => setCellFeedback(null), 2500);
      } else {
        setCellFeedback({ rowIdx, colName, status: 'error' });
        showAlert(data.message || 'Gagal menyimpan perubahan sel.', 'error');
      }
    } catch (err: any) {
      showAlert('Gagal memperbarui sel: ' + err.message, 'error');
    } finally {
      setSavingCell(false);
      setEditingCell(null);
    }
  };

  const handleDeleteRow = async (pkVal: any) => {
    const confirmed = await showConfirm(
      `Hapus permanen baris dengan ${primaryKey} = "${pkVal}" dari tabel "${activeTable}"? Data akan langsung terhapus dari Supabase.`,
      'Hapus Baris'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/db-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteRow',
          table: activeTable,
          primaryKey,
          primaryKeyValue: pkVal,
          actor: 'Manager (Live Editor)',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showAlert(`Baris berhasil dihapus dari Supabase!`, 'success');
        loadRows();
        loadTables();
      } else {
        showAlert(data.message || 'Gagal menghapus baris.', 'error');
      }
    } catch (e: any) {
      showAlert(e.message || 'Gagal menghapus baris', 'error');
    }
  };

  const handleOpenInsertModal = () => {
    const initial: Record<string, any> = {};
    columns.forEach(col => {
      if (col === primaryKey && primaryKey === 'id') {
        // Biarkan kosong untuk auto UUID
        initial[col] = '';
      } else if (col.endsWith('_at')) {
        initial[col] = new Date().toISOString();
      } else {
        initial[col] = '';
      }
    });
    setNewRowData(initial);
    setShowInsertModal(true);
  };

  const handleInsertRowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInsertingRow(true);

    try {
      // Bersihkan nilai kosong jika id
      const cleanData: Record<string, any> = { ...newRowData };
      if (!cleanData[primaryKey] && primaryKey === 'id') {
        delete cleanData[primaryKey];
      }

      // Convert number/boolean types
      Object.keys(cleanData).forEach(k => {
        const v = cleanData[k];
        if (v === 'true') cleanData[k] = true;
        else if (v === 'false') cleanData[k] = false;
        else if (v === '') cleanData[k] = null;
        else if (typeof v === 'string' && !isNaN(Number(v)) && !k.includes('no_') && !k.includes('kode') && !k.includes('phone')) {
          cleanData[k] = Number(v);
        }
      });

      const res = await fetch('/api/admin/db-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'insertRow',
          table: activeTable,
          rowData: cleanData,
          actor: 'Manager (Live Editor)',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showAlert(`Baris baru berhasil ditambahkan ke tabel '${activeTable}'!`, 'success');
        setShowInsertModal(false);
        loadRows();
        loadTables();
      } else {
        showAlert(data.message || 'Gagal menambahkan baris baru.', 'error');
      }
    } catch (err: any) {
      showAlert(err.message || 'Error inserting row', 'error');
    } finally {
      setInsertingRow(false);
    }
  };

  const filteredTablesList = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    return Object.entries(tables).filter(([key, info]) => {
      if (!q) return true;
      return key.toLowerCase().includes(q) || (info.label || '').toLowerCase().includes(q);
    });
  }, [tables, tableSearch]);

  // If role is not manager
  if (currentRole && currentRole !== 'MANAGER') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-6 text-center text-slate-500">
        <div className="max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Akses Terkunci</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Halaman Database Table Editor adalah fitur tingkat tinggi yang hanya diperuntukkan bagi <b>Manager / Owner</b>.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. SECURITY PASSWORD GATE (Layar Gembok Alfanumerik) - TEMA DUA SISI
  // =========================================================================
  if (!isUnlocked) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-4 sm:p-6 text-slate-800 relative overflow-hidden select-none">
        {/* Subtle decorative background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-60 pointer-events-none" />

        <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-in zoom-in-95 duration-200">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-[#1E4648] flex items-center justify-center mx-auto shadow-sm border border-teal-200">
              <Database className="w-8 h-8" />
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                Live Database Grid
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                PIN Alfanumerik
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Database Table Editor</h1>
            <p className="text-xs text-slate-500 leading-relaxed px-2">
              Akses langsung ke seluruh tabel database secara <i>live</i>. Masukkan kata sandi alfanumerik khusus Manager untuk membuka editor.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Kata Sandi Akses Database</span>
                <span className="text-[10px] text-slate-400 font-medium">Huruf &amp; Angka</span>
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Masukkan kata sandi..."
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-[#1E4648] focus:bg-white focus:ring-2 focus:ring-teal-800/10 transition font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                >
                  {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[11px] text-rose-600 font-medium mt-1.5 flex items-center gap-1 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={verifyingPassword || !passwordInput.trim()}
              className="w-full py-2.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              <Unlock className={`w-4 h-4 ${verifyingPassword ? 'animate-spin' : ''}`} />
              <span>{verifyingPassword ? 'Memverifikasi...' : 'Buka Kunci Editor'}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Akses terlindungi &amp; khusus otorisasi Manajer</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. MAIN DATABASE EDITOR & SPREADSHEET GRID - TEMA DUA SISI
  // =========================================================================
  const activeTableMeta = tables[activeTable];
  const ActiveIcon = TABLE_ICONS[activeTable] || Database;

  return (
    <div className="flex h-full w-full bg-slate-50 text-slate-800 overflow-hidden select-none">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* LEFT SIDEBAR: TABLES EXPLORER                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <aside className="w-64 sm:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        {/* Header Sidebar */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#1E4648] flex items-center justify-center border border-teal-200">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-extrabold text-slate-900 tracking-tight">Database Table</h2>
                <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Connected
                </span>
              </div>
            </div>

            <button
              onClick={handleLockSession}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition text-[11px] flex items-center gap-1 cursor-pointer"
              title="Kunci Akses Database"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search table input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Cari tabel..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#1E4648] focus:bg-white transition"
            />
          </div>
        </div>

        {/* List of Tables */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Daftar Tabel ({filteredTablesList.length})</span>
            <button
              onClick={loadTables}
              disabled={loadingTables}
              className="hover:text-[#1E4648] text-slate-400 transition cursor-pointer"
              title="Segarkan jumlah baris"
            >
              <RefreshCw className={`w-3 h-3 ${loadingTables ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {filteredTablesList.map(([tblKey, info]) => {
            const Icon = TABLE_ICONS[tblKey] || FileSpreadsheet;
            const isSelected = activeTable === tblKey;

            return (
              <button
                key={tblKey}
                onClick={() => {
                  setActiveTable(tblKey);
                  setPage(1);
                  setSearchQuery('');
                  setSortCol('');
                }}
                className={`w-full text-left p-2 rounded-xl text-xs font-medium transition flex items-center justify-between gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-50 text-[#1E4648] border border-teal-200 shadow-2xs font-bold'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#1E4648]' : 'text-slate-400'}`} />
                  <div className="truncate">
                    <span className="block truncate font-bold text-[11px] leading-tight">{info.label || tblKey}</span>
                    <span className="text-[9px] text-slate-400 font-mono">{tblKey}</span>
                  </div>
                </div>

                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                  isSelected ? 'bg-[#1E4648] text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {info.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer Sidebar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500">
          <button
            onClick={() => setShowChangePassModal(true)}
            className="hover:text-[#1E4648] transition flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Ganti Sandi DB</span>
          </button>
          <span className="text-[10px] font-mono text-slate-400">v2.4 Live</span>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MAIN VIEW: TABLE HEADER, TOOLBAR, & SPREADSHEET GRID                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
        {/* Top Control Toolbar */}
        <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          {/* Active Table Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#1E4648] flex items-center justify-center border border-teal-200 shrink-0">
              <ActiveIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  {activeTableMeta?.label || activeTable}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  PK: {primaryKey}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {totalRows} Baris
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                {activeTableMeta?.description || `Tabel database "${activeTable}"`}
              </p>
            </div>
          </div>

          {/* Search, Action Buttons & Limit */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari di tabel..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#1E4648] focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Insert Row Button */}
            <button
              onClick={handleOpenInsertModal}
              className="tactile-btn px-3 py-1.5 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              title="Tambah baris baru ke tabel"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tambah Baris</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => {
                loadRows();
                loadTables();
              }}
              disabled={loadingRows}
              className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs flex items-center justify-center transition cursor-pointer disabled:opacity-50"
              title="Segarkan data tabel"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRows ? 'animate-spin text-[#1E4648]' : ''}`} />
            </button>

            {/* Row limit dropdown */}
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-slate-200 text-slate-700 rounded-xl px-2 py-1.5 text-xs outline-none focus:border-[#1E4648] cursor-pointer font-bold"
            >
              <option value="10">10 baris</option>
              <option value="25">25 baris</option>
              <option value="50">50 baris</option>
              <option value="100">100 baris</option>
            </select>
          </div>
        </div>

        {/* Helper bar: Inline Edit Instructions */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            <span>
              <b className="text-slate-700">Spreadsheet Mode:</b> Klik ganda (atau ikon pensil) pada sel nilai untuk mengedit langsung. Tekan <b>Enter</b> atau klik luar untuk menyimpan.
            </span>
          </span>
          <span className="hidden sm:inline font-mono text-slate-400">
            {savingCell ? '💾 Menyimpan perubahan ke Database...' : 'Tekan ESC untuk membatalkan'}
          </span>
        </div>

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* SPREADSHEET GRID CONTAINER                                        */}
        {/* ───────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto relative scrollbar-thin scrollbar-thumb-slate-300 bg-white">
          {loadingRows ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
              <RefreshCw className="w-8 h-8 animate-spin text-[#1E4648]" />
              <p className="text-xs font-semibold text-slate-600">Memuat data tabel "{activeTable}"...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
              <FileSpreadsheet className="w-10 h-10 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Tidak ada baris data yang ditemukan.</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-teal-700 hover:underline cursor-pointer"
                >
                  Bersihkan pencarian "{searchQuery}"
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-mono">
              {/* Table Header */}
              <thead className="bg-slate-100/90 backdrop-blur-xs sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                <tr>
                  <th className="p-2.5 w-12 text-center text-slate-600 border-r border-slate-200 font-bold bg-slate-100/90">
                    #
                  </th>
                  <th className="p-2.5 w-16 text-center text-slate-600 border-r border-slate-200 font-bold bg-slate-100/90">
                    Aksi
                  </th>
                  {columns.map(col => {
                    const isPk = col === primaryKey;
                    const isSorted = sortCol === col;

                    return (
                      <th
                        key={col}
                        onClick={() => handleSort(col)}
                        className={`p-2.5 text-slate-700 font-bold border-r border-slate-200 hover:bg-slate-200/50 cursor-pointer transition select-none ${
                          isPk ? 'bg-teal-50 text-[#1E4648]' : ''
                        }`}
                        style={{ minWidth: col.includes('alamat') || col.includes('catatan') || col.includes('detail') ? 220 : 130 }}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate flex items-center gap-1">
                            <span>{col}</span>
                            {isPk && <span className="text-[9px] px-1 py-0.2 bg-teal-100 text-teal-800 rounded font-bold border border-teal-200">PK</span>}
                          </span>
                          <span className="text-slate-400">
                            {isSorted ? (
                              sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1E4648]" /> : <ArrowDown className="w-3 h-3 text-[#1E4648]" />
                            ) : (
                              <ArrowUpDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
                            )}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body Rows */}
              <tbody className="divide-y divide-slate-200">
                {rows.map((row, rowIdx) => {
                  const pkVal = row[primaryKey];
                  const displayIndex = (page - 1) * limit + rowIdx + 1;

                  return (
                    <tr 
                      key={String(pkVal || rowIdx)}
                      className="hover:bg-teal-50/40 transition group"
                    >
                      {/* Row Index # */}
                      <td className="p-2 text-center text-slate-500 bg-slate-50/80 border-r border-slate-200 text-[11px] font-bold">
                        {displayIndex}
                      </td>

                      {/* Row Actions: Delete */}
                      <td className="p-2 text-center border-r border-slate-200">
                        <button
                          onClick={() => handleDeleteRow(pkVal)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title={`Hapus baris ${primaryKey} = ${pkVal}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* Columns / Cells */}
                      {columns.map(col => {
                        const cellVal = row[col];
                        const isEditingThis = editingCell?.rowIdx === rowIdx && editingCell?.colName === col;
                        const isPk = col === primaryKey;
                        const feedback = cellFeedback?.rowIdx === rowIdx && cellFeedback?.colName === col ? cellFeedback.status : null;

                        let displayStr = '';
                        if (cellVal === null || cellVal === undefined) {
                          displayStr = 'null';
                        } else if (typeof cellVal === 'object') {
                          displayStr = JSON.stringify(cellVal);
                        } else if (typeof cellVal === 'boolean') {
                          displayStr = cellVal ? 'true' : 'false';
                        } else {
                          displayStr = String(cellVal);
                        }

                        return (
                          <td
                            key={col}
                            onDoubleClick={() => startEditCell(rowIdx, col, pkVal, cellVal)}
                            className={`p-2 border-r border-slate-200 relative transition max-w-xs truncate ${
                              isPk ? 'bg-teal-50/30 font-bold text-[#1E4648]' : 'text-slate-800'
                            } ${
                              feedback === 'saved' ? 'bg-emerald-50 text-emerald-800 font-bold' : feedback === 'error' ? 'bg-rose-50 text-rose-800 font-bold' : ''
                            }`}
                          >
                            {isEditingThis ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editVal}
                                  onChange={(e) => setEditVal(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitEditCell();
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  onBlur={commitEditCell}
                                  autoFocus
                                  disabled={savingCell}
                                  className="w-full px-2 py-1 bg-white border-2 border-[#1E4648] rounded text-xs text-slate-900 outline-none font-mono shadow-xs"
                                />
                                {savingCell && <RefreshCw className="w-3 h-3 animate-spin text-[#1E4648] shrink-0" />}
                              </div>
                            ) : (
                              <div 
                                className="flex items-center justify-between group/cell cursor-pointer"
                                title="Klik 2x untuk mengedit sel ini"
                              >
                                <span className={`truncate ${
                                  cellVal === null || cellVal === undefined 
                                    ? 'text-slate-400 italic font-sans' 
                                    : typeof cellVal === 'boolean' 
                                    ? (cellVal ? 'inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200' : 'inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200') 
                                    : 'text-slate-800'
                                }`}>
                                  {displayStr}
                                </span>
                                {!isPk && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditCell(rowIdx, col, pkVal, cellVal);
                                    }}
                                    className="opacity-0 group-hover/cell:opacity-100 p-0.5 text-slate-400 hover:text-[#1E4648] transition shrink-0 ml-1 cursor-pointer"
                                    title="Edit sel"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* BOTTOM PAGINATION CONTROLS                                        */}
        {/* ───────────────────────────────────────────────────────────────── */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div>
            Menampilkan baris <b>{totalRows > 0 ? (page - 1) * limit + 1 : 0}</b> - <b>{Math.min(page * limit, totalRows)}</b> dari <b>{totalRows}</b> baris
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 transition flex items-center gap-1 cursor-pointer font-bold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </button>
            <span className="font-mono font-bold text-slate-800 px-2">
              Halaman {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 transition flex items-center gap-1 cursor-pointer font-bold"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>

      {/* =================================================================== */}
      {/* MODAL 1: INSERT NEW ROW - TEMA DUA SISI                             */}
      {/* =================================================================== */}
      {showInsertModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-pop-scale text-slate-800">
            {/* Header Modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#1E4648] flex items-center justify-center border border-teal-200">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">Tambah Baris Baru ke "{activeTable}"</h3>
              </div>
              <button
                onClick={() => setShowInsertModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleInsertRowSubmit} className="p-5 overflow-y-auto space-y-3 text-xs flex-1">
              <p className="text-[11px] text-slate-500">
                Isi kolom-kolom berikut untuk menambahkan data langsung ke tabel <b>{activeTable}</b>:
              </p>

              {columns.map(col => {
                const isPk = col === primaryKey;

                return (
                  <div key={col}>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="font-mono">{col}</span>
                      {isPk && <span className="text-[9px] text-[#1E4648] uppercase font-bold">Primary Key (Kosongkan jika auto UUID)</span>}
                    </label>
                    <input
                      type="text"
                      value={newRowData[col] ?? ''}
                      onChange={(e) => setNewRowData({ ...newRowData, [col]: e.target.value })}
                      placeholder={isPk && primaryKey === 'id' ? 'Auto Generated UUID...' : `Nilai kolom ${col}`}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#1E4648] focus:bg-white font-mono transition"
                    />
                  </div>
                );
              })}

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInsertModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={insertingRow}
                  className="px-4 py-2 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{insertingRow ? 'Menyimpan...' : 'Simpan Baris Baru'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: GANTI KATA SANDI DATABASE EDITOR - TEMA DUA SISI           */}
      {/* =================================================================== */}
      {showChangePassModal && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-pop-scale text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-teal-50 text-[#1E4648] flex items-center justify-center border border-teal-200">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                Ganti Sandi Database Editor
              </h3>
              <button
                onClick={() => setShowChangePassModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Kata Sandi Lama</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Masukkan sandi saat ini..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#1E4648] focus:bg-white font-mono transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Kata Sandi Baru (Min. 6 Karakter)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Campuran huruf dan angka..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#1E4648] focus:bg-white font-mono transition"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowChangePassModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1E4648] hover:bg-[#163536] text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                >
                  Simpan Sandi Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
