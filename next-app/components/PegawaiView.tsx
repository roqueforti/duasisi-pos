'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, RefreshCw, Trash2, Award, Calendar, Download, Upload } from 'lucide-react';
import { runBackend } from '@/lib/api';
import { toCSV, downloadCSV, parseCSV, readFileAsText } from '@/lib/csvUtils';
import { UserRole } from '@/lib/types';

interface PegawaiItem {
  id: string;
  nama: string;
  noHp?: string;
  jabatan: string;
  status: string;
}

interface RekapKinerja {
  id: string;
  nama: string;
  jabatan: string;
  totalTransaksi: number;
  totalOmzet: number;
}

export default function PegawaiView({ currentRole }: { currentRole?: UserRole } = {}) {
  const [pegawaiList, setPegawaiList] = useState<PegawaiItem[]>([]);
  const [kinerjaList, setKinerjaList] = useState<RekapKinerja[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Pegawai Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [nama, setNama] = useState('');
  const [noHp, setNoHp] = useState('');
  const [jabatan, setJabatan] = useState('Kasir / Staff');

  const loadData = async () => {
    setLoading(true);
    try {
      const [pegRes, kinRes] = await Promise.all([
        runBackend<PegawaiItem[]>('getPegawaiList').catch(() => []),
        runBackend<RekapKinerja[]>('getRekapKinerjaPegawai').catch(() => [])
      ]);
      if (Array.isArray(pegRes)) setPegawaiList(pegRes);
      if (Array.isArray(kinRes)) setKinerjaList(kinRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPegawai = async () => {
    if (!nama.trim()) { alert('Nama pegawai wajib diisi!'); return; }
    setLoading(true);
    try {
      await runBackend('tambahPegawai', {
        nama: nama.trim(),
        noHp: noHp.trim(),
        jabatan: jabatan.trim()
      });
      setShowAddModal(false);
      setNama(''); setNoHp('');
      loadData();
    } catch (err) {
      alert('Gagal menambah pegawai');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePegawai = async (id: string, namaPegawai: string) => {
    if (!confirm(`Hapus pegawai ${namaPegawai}?`)) return;
    try {
      await runBackend('hapusPegawai', id);
      loadData();
    } catch (err) {
      alert('Gagal menghapus pegawai');
    }
  };

  const handleExport = () => {
    const rows = pegawaiList.map(p => [p.nama, p.jabatan, p.noHp || '', p.status]);
    downloadCSV('export_pegawai.csv', toCSV(['Nama', 'Jabatan', 'No HP', 'Status'], rows));
  };

  const handleDownloadTemplate = () => {
    downloadCSV('template_pegawai_kosong.csv', toCSV(
      ['Nama', 'Jabatan', 'No HP', 'Status'],
      [['Budi Santoso', 'Kasir', '081234567890', 'Aktif'], ['Siti Aminah', 'Operator', '082345678901', 'Aktif']]
    ));
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) { alert('File CSV kosong atau format salah.'); return; }
      let success = 0, fail = 0;
      for (const row of rows) {
        const nama = row['Nama'] || row['nama'] || '';
        if (!nama.trim()) { fail++; continue; }
        try {
          await runBackend('tambahPegawai', {
            nama: nama.trim(),
            jabatan: (row['Jabatan'] || row['jabatan'] || 'Staff').trim(),
            noHp: (row['No HP'] || row['noHp'] || '').trim(),
          });
          success++;
        } catch { fail++; }
      }
      loadData();
      alert(`Import selesai: ${success} berhasil${fail > 0 ? `, ${fail} gagal` : ''}.`);
    } catch (err) {
      alert('Gagal membaca file CSV.');
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Header & Control */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Users className="w-4 h-4 text-[#1E4648]" />
          <span>Manajemen Data Pegawai & Kinerja</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition" title="Refresh Data">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {currentRole === 'MANAGER' && (
            <>
              <button onClick={handleExport} className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition" title="Export Data Pegawai ke CSV">
                <Download className="w-3.5 h-3.5" />
              </button>
              <button onClick={handleDownloadTemplate} className="px-3 py-1.5 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 text-xs font-medium transition" title="Download Template Kosong">
                Template
              </button>
              <label className="cursor-pointer px-3 py-1.5 border border-[#B5C9C9] rounded-md text-[#1E4648] hover:bg-[#B5C9C9]/10 text-xs font-medium transition flex items-center gap-1.5" title="Import Data Pegawai dari CSV">
                <Upload className="w-3.5 h-3.5" />
                <span>Import</span>
                <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
              </label>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-[#1E4648] hover:bg-[#163536] text-white font-medium px-3.5 py-1.5 rounded-md text-xs transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Pegawai
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Daftar Pegawai */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-xs text-slate-600 flex items-center justify-between">
            <span>Daftar Tim Pegawai</span>
            <span className="text-slate-400 font-normal">{pegawaiList.length} Orang</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Nama</th>
                  <th className="py-2.5 px-4">Jabatan</th>
                  <th className="py-2.5 px-4">No HP</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : pegawaiList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Belum ada data pegawai
                    </td>
                  </tr>
                ) : (
                  pegawaiList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-600">{p.nama}</td>
                      <td className="py-3 px-4 text-slate-600">{p.jabatan}</td>
                      <td className="py-3 px-4 text-slate-500">{p.noHp || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        {currentRole === 'MANAGER' ? (
                          <button
                            onClick={() => handleDeletePegawai(p.id, p.nama)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded transition"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Rekap Kinerja Omzet */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-semibold text-xs text-slate-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#FF9500]" /> Rekap Kinerja Penjualan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Pegawai</th>
                  <th className="py-2.5 px-4">Jumlah Tx</th>
                  <th className="py-2.5 px-4 text-right">Total Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                      <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24 ml-auto" /></td>
                    </tr>
                  ))
                ) : kinerjaList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">
                      Belum ada rekap kinerja
                    </td>
                  </tr>
                ) : (
                  kinerjaList.map((k, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-600">{k.nama}</td>
                      <td className="py-3 px-4 font-bold text-slate-700">{k.totalTransaksi} nota</td>
                      <td className="py-3 px-4 font-bold text-[#1E4648] text-right">
                        Rp {(k.totalOmzet || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-slate-600 mb-4">Tambah Pegawai Baru</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Rina Rahmawati"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Jabatan</label>
                <input
                  type="text"
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  placeholder="Kasir / Operator / Staff"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">No HP / WhatsApp</label>
                <input
                  type="tel"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  placeholder="08..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-4 py-2 rounded-md text-xs">
                Batal
              </button>
              <button onClick={handleAddPegawai} className="bg-[#1E4648] hover:bg-[#163536] text-white font-medium px-4 py-2 rounded-md text-xs">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
