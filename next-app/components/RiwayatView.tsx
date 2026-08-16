'use client';

import React, { useState, useEffect } from 'react';
import { Search, Printer, Send, Eye, RefreshCw, X, FileText, Plus, ShieldAlert, Check } from 'lucide-react';
import { Transaksi } from '@/lib/types';
import { runBackend, runBackendCached } from '@/lib/api';
import { maskPhone, eNotaUrl as buildENotaUrl } from '@/lib/utils';
import PrinterModal from '@/components/PrinterModal';
import { UserRole } from '@/lib/types';
import { useDialog } from '@/components/DialogProvider';

export default function RiwayatView({ currentRole }: { currentRole?: UserRole } = {}) {
  const { showAlert } = useDialog();
  const [filter, setFilter] = useState<'Semua' | 'SelfService' | 'FullService'>('Semua');
  const [search, setSearch] = useState('');
  const [txList, setTxList] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null);

  // Bluetooth Thermal Printer Modal State
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [txForPrintModal, setTxForPrintModal] = useState<Transaksi | null>(null);

  // State for Void Request Modal (FR-POS-24)
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [txToVoid, setTxToVoid] = useState<Transaksi | null>(null);
  const [alasanVoidInput, setAlasanVoidInput] = useState('');

  // State for DP Settlement Modal (FR-POS-16)
  const [showPelunasanModal, setShowPelunasanModal] = useState(false);
  const [txToLunas, setTxToLunas] = useState<Transaksi | null>(null);
  const [pelunasanNominalInput, setPelunasanNominalInput] = useState('');
  const [pelunasanMetode, setPelunasanMetode] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');

  // State for Manual Transaction Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [manualNoNota, setManualNoNota] = useState('');
  const [manualTanggal, setManualTanggal] = useState('');
  const [manualNama, setManualNama] = useState('');
  const [manualNoHp, setManualNoHp] = useState('');
  const [manualTipe, setManualTipe] = useState<'SelfService' | 'FullService'>('SelfService');
  const [manualLayanan, setManualLayanan] = useState('Layanan Manual / Paket');
  const [manualQty, setManualQty] = useState('1');
  const [manualHarga, setManualHarga] = useState('15000');
  const [manualMetode, setManualMetode] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');
  const [manualStatus, setManualStatus] = useState<'Diterima' | 'Selesai'>('Selesai');
  const [manualPetugas, setManualPetugas] = useState('Kasir');

  const openManualModal = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setManualTanggal(localISOTime);
    setManualNoNota('');
    setManualNama('');
    setManualNoHp('');
    setManualTipe('SelfService');
    setManualLayanan('Cuci + Kering Express');
    setManualQty('1');
    setManualHarga('20000');
    setManualMetode('Tunai');
    setManualStatus('Selesai');
    setManualPetugas('Siti Rahma (Kasir)');
    setShowManualModal(true);
  };

  const handleSaveManualTx = async () => {
    if (!manualNama.trim()) { await showAlert('Nama pelanggan wajib diisi!', 'warning'); return; }
    const hargaNum = Number(manualHarga) || 0;
    const qtyNum = Number(manualQty) || 1;
    const grandTotal = hargaNum * qtyNum;

    if (grandTotal <= 0) { await showAlert('Total nominal transaksi harus lebih dari 0!', 'warning'); return; }

    setSavingManual(true);
    const payload = {
      noNota: manualNoNota.trim() || undefined,
      tanggal: manualTanggal ? new Date(manualTanggal).toISOString() : new Date().toISOString(),
      namaPelanggan: manualNama.trim(),
      noHp: manualNoHp.trim(),
      petugas: manualPetugas,
      tipe: manualTipe,
      status: manualStatus,
      metodeBayar: manualMetode,
      nominalBayar: grandTotal,
      diskon: 0,
      total: grandTotal,
      items: [{ layanan: manualLayanan.trim() || 'Layanan Manual', qty: qtyNum, hargaSatuan: hargaNum }]
    };

    let generatedNota = manualNoNota.trim();

    try {
      const res = await runBackend<{ success: boolean; noNota?: string; message?: string }>('simpanTransaksi', payload);
      if (!res?.success || !res.noNota) throw new Error(res?.message || 'Backend tidak mengembalikan nomor nota.');
      generatedNota = res.noNota;
    } catch (error) {
      console.error(error);
      setSavingManual(false);
      await showAlert(error instanceof Error ? error.message : 'Transaksi manual gagal disimpan.', 'error');
      return;
    }

    setShowManualModal(false);
    setSavingManual(false);
    await showAlert(`Transaksi manual ${generatedNota} berhasil disimpan!`, 'success');
    loadRiwayat();
  };

  const loadRiwayat = () => {
    setLoading(true);
    runBackendCached<Transaksi[]>(
      'getTransaksiList',
      (data, fromCache) => {
        setTxList(Array.isArray(data) ? data : []);
        if (!fromCache) setLoading(false);
      },
      2 * 60 * 1000,
      'Semua'
    );
  };

  useEffect(() => {
    loadRiwayat();
  }, []);

  const handleAjukanVoid = async () => {
    if (!txToVoid) return;
    if (!alasanVoidInput.trim()) { await showAlert('Alasan pembatalan (void) wajib diisi!', 'warning'); return; }

    try {
      const result = await runBackend<{ success: boolean; message?: string }>('ajukanVoidTransaksi', txToVoid.noNota, alasanVoidInput.trim(), 'Kasir 1');
      if (!result?.success) throw new Error(result?.message || 'Pengajuan void ditolak backend');
      await showAlert(`Permohonan void nota ${txToVoid.noNota} berhasil dikirim ke Manager/Owner.`, 'success');
      setShowVoidModal(false);
      setAlasanVoidInput('');
      loadRiwayat();
    } catch (error) {
      console.error(error);
      await showAlert('Gagal mengajukan void. Data transaksi tidak diubah.', 'error');
    }
  };

  const handleProsesPelunasan = async () => {
    if (!txToLunas) return;
    const nominal = Number(pelunasanNominalInput) || (txToLunas.sisaTagihan || 0);
    try {
      const result = await runBackend<{ success: boolean; message?: string }>('pelunasanDP', txToLunas.noNota, nominal, pelunasanMetode);
      if (!result?.success) throw new Error(result?.message || 'Pelunasan ditolak backend.');
      await showAlert(`Pelunasan Rp ${(nominal || 0).toLocaleString('id-ID')} untuk nota ${txToLunas.noNota} berhasil!`, 'success');
      setShowPelunasanModal(false);
      loadRiwayat();
    } catch (error) {
      console.error(error);
      await showAlert('Pelunasan gagal dicatat. Silakan coba lagi.', 'error');
    }
  };

  const handleSendSiapWA = async (tx: Transaksi) => {
    let rawPhone = String(tx.noHp || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);
    if (!rawPhone) {
      await showAlert('Nomor HP pelanggan tidak tersedia.', 'warning');
      return;
    }

    const msg = `*NOTIFIKASI LAUNDRY SIAP DIAMBIL*\n\n` +
      `Halo Sdr/i *${tx.namaPelanggan.toUpperCase()}*,\n` +
      `Cucian Anda dengan No Nota *${tx.noNota}* sudah *SIAP DIAMBIL* di outlet Dua SiSi Laundry.\n\n` +
      (tx.sisaTagihan ? `Sisa tagihan yang harus dilunasi: *Rp ${(tx?.sisaTagihan || 0).toLocaleString('id-ID')}*\n\n` : '') +
      `Silakan datang ke outlet dengan membawa nota atau bukti pesan ini. Terima kasih!`;

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleWhatsAppStruk = (tx: Transaksi) => {
    let rawPhone = String(tx.noHp || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);

    const eNotaUrl = buildENotaUrl(tx.noNota);
    const itemsStr = (tx.items || []).map((i: any) =>
      `- ${i.layanan} (x${i.qty}) - Rp ${(Number(i.hargaSatuan) || 0).toLocaleString('id-ID')}`
    ).join('\n');

    const msg = [
      `Halo ${tx.namaPelanggan || 'Pelanggan'}! Struk dari Dua SiSi Laundry`,
      ``,
      `No Nota     : ${tx.noNota}`,
      `Tanggal     : ${tx.tanggal}`,
      `Tipe        : ${tx.tipe === 'FullService' ? 'Full Service' : 'Self Service'}`,
      `Status      : ${tx.status}`,
      ``,
      `Detail Layanan:`,
      itemsStr,
      ``,
      `TOTAL       : Rp ${(tx?.total || 0).toLocaleString('id-ID')}`,
      `Metode Bayar: ${tx.metodeBayar || 'Tunai'}`,
      ...(tx.sisaTagihan && tx.sisaTagihan > 0
        ? [`Sisa Tagihan: Rp ${(tx.sisaTagihan || 0).toLocaleString('id-ID')}`]
        : []),
      ``,
      `Lihat E-Nota Resmi:`,
      eNotaUrl,
      ``,
      `Terima kasih telah mencuci di Dua SiSi Laundry!`,
    ].join('\n');

    const waUrl = rawPhone
      ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handlePrintReceipt = (tx: Transaksi) => {
    setTxForPrintModal(tx);
    setIsPrinterModalOpen(true);
  };

  const filteredTx = (txList || []).filter((t) => {
    if (!t) return false;
    const matchFilter = filter === 'Semua' || t.tipe === filter;
    const q = (search || '').toLowerCase().trim();
    const matchSearch =
      !q ||
      (t.noNota || '').toLowerCase().includes(q) ||
      (t.namaPelanggan && (t.namaPelanggan || '').toLowerCase().includes(q)) ||
      (t.noHp && (t.noHp || '').includes(q));
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-3 md:p-4 space-y-4 w-full">
      {/* Header Filters & Search */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap shadow-xs">
        <div className="flex bg-slate-100 p-0.5 rounded-md gap-0.5">
          {(['Semua', 'SelfService', 'FullService'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                filter === f
                  ? 'bg-[#1E4648] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              {f === 'Semua' ? 'Semua Tipe' : f === 'SelfService' ? 'Self Service' : 'Full Service'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nota, pelanggan, no HP..."
              className="w-full pl-9 pr-8 py-1.5 border border-slate-200 rounded-md text-xs outline-none focus:border-[#1E4648] bg-white"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {currentRole === 'MANAGER' && (
            <button
              onClick={openManualModal}
              className="bg-[#1E4648] hover:bg-[#163536] text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-sm shrink-0"
              title="Input Transaksi Manual"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Transaksi Manual</span>
            </button>
          )}

          <button
            onClick={loadRiwayat}
            className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">No Nota</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Status Bayar</th>
                <th className="py-3 px-4 text-right">Aksi & Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-28" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-20" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Belum ada riwayat transaksi
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx) => (
                  <tr key={tx.noNota} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-600">
                      {tx.noNota}
                      {tx.statusVoid === 'PendingApproval' && (
                        <div className="text-[10px] text-[#FF9500] font-semibold bg-[#FF9500]/10 border border-[#FF9500]/30 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          Pending Void
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{tx.tanggal}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-700">{tx.namaPelanggan || '-'}</div>
                      {tx.noHp && <div className="text-[10px] text-slate-400">{maskPhone(tx.noHp)}</div>}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-600">{tx.petugas || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1E4648]">Rp {(tx?.total || 0).toLocaleString('id-ID')}</div>
                      {tx.sisaTagihan && tx.sisaTagihan > 0 ? (
                        <div className="text-[10px] text-rose-600 font-bold">
                          Sisa: Rp {(tx?.sisaTagihan || 0).toLocaleString('id-ID')}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${
                          tx.statusVoid === 'Approved' || tx.status === 'Void' || tx.status === 'Batal'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : tx.statusPembayaran === 'DP' || (tx.sisaTagihan || 0) > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <span>{tx.statusVoid === 'Approved' || tx.status === 'Void' || tx.status === 'Batal' ? 'VOID' : tx.statusPembayaran || ((tx.sisaTagihan || 0) > 0 ? 'DP' : 'Lunas')}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1.5 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded transition"
                          title="Detail Nota"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePrintReceipt(tx)}
                          className="p-1.5 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded transition"
                          title="Cetak Struk"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Send WA Notification */}
                        <button
                          onClick={() => tx.status === 'Siap Diambil' ? handleSendSiapWA(tx) : handleWhatsAppStruk(tx)}
                          className="p-1.5 text-[#1E4648] hover:bg-[#B5C9C9]/20 rounded transition"
                          title={tx.status === 'Siap Diambil' ? "Kirim WA Siap Diambil" : "Kirim WA Struk"}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>

                        {/* DP Pelunasan Button (FR-POS-16) */}
                        {tx.sisaTagihan && tx.sisaTagihan > 0 ? (
                          <button
                            onClick={() => { setTxToLunas(tx); setPelunasanNominalInput((tx.sisaTagihan || 0).toString()); setShowPelunasanModal(true); }}
                            className="p-1 text-xs bg-[#1E4648] text-white hover:bg-[#1E4648] rounded px-2 font-semibold transition"
                            title="Pelunasan DP"
                          >
                            Lunas
                          </button>
                        ) : null}

                        {/* Void Request Button (FR-POS-24) */}
                        {tx.status !== 'Batal' && tx.status !== 'Void' && tx.statusVoid !== 'PendingApproval' && tx.statusVoid !== 'Approved' && (
                          <button
                            onClick={() => { setTxToVoid(tx); setShowVoidModal(true); }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition"
                            title="Ajukan Void Transaksi"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void Request Modal (FR-POS-24) */}
      {showVoidModal && txToVoid && (
        <div className="fixed inset-0 z-[550] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-rose-600 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Pengajuan Void Transaksi</span>
              </div>
              <button onClick={() => setShowVoidModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Ajukan pembatalan (void) untuk Nota <span className="font-bold">{txToVoid.noNota}</span> (Total Rp {(txToVoid?.total || 0).toLocaleString('id-ID')}). Permohonan membutuhkan persetujuan Manager/Owner.
            </p>
            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Pembatalan *</label>
                <textarea
                  value={alasanVoidInput}
                  onChange={(e) => setAlasanVoidInput(e.target.value)}
                  placeholder="Misal: Salah input layanan, pelanggan batal..."
                  className="w-full p-2.5 border border-slate-200 rounded-md outline-none focus:border-rose-500 h-20"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowVoidModal(false)} className="bg-slate-100 text-slate-600 font-semibold px-3 py-2 rounded-md text-xs">Batal</button>
              <button onClick={handleAjukanVoid} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 rounded-md text-xs transition">
                Kirim Pengajuan Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DP Pelunasan Modal (FR-POS-16) */}
      {showPelunasanModal && txToLunas && (
        <div className="fixed inset-0 z-[550] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-600">Pelunasan Pengambilan Cucian</h3>
              <button onClick={() => setShowPelunasanModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs mb-3 space-y-1">
              <div className="flex justify-between text-slate-600"><span>Nota:</span><span className="font-bold">{txToLunas.noNota}</span></div>
              <div className="flex justify-between text-slate-600"><span>Pelanggan:</span><span className="font-bold">{txToLunas.namaPelanggan}</span></div>
              <div className="flex justify-between text-rose-600 font-bold pt-1 border-t border-slate-200">
                <span>Sisa Tagihan:</span>
                <span>Rp {(txToLunas.sisaTagihan || 0).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal Pelunasan (Rp)</label>
                <input
                  type="number"
                  value={pelunasanNominalInput}
                  onChange={(e) => setPelunasanNominalInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metode Bayar Pelunasan</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['Tunai', 'QRIS', 'Transfer'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPelunasanMetode(m)}
                      className={`py-1.5 rounded text-xs font-semibold border ${pelunasanMetode === m ? 'bg-[#B5C9C9]/20 border-[#1E4648] text-[#1E4648]' : 'border-slate-200 text-slate-600'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPelunasanModal(false)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-md text-xs font-semibold">Batal</button>
              <button onClick={handleProsesPelunasan} className="flex-1 bg-[#1E4648] hover:bg-[#1E4648] text-white font-semibold py-2 rounded-md text-xs transition">
                Simpan Pelunasan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Detail Nota {selectedTx.noNota}</h3>
                <p className="text-[11px] text-slate-400">{selectedTx.tanggal}</p>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Info Transaksi */}
            <div className="space-y-1.5 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggan</span>
                <span className="font-semibold text-slate-700">{selectedTx.namaPelanggan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">No HP</span>
                <span className="text-slate-600">{maskPhone(selectedTx.noHp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kasir</span>
                <span className="text-slate-600">{selectedTx.petugas || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tipe</span>
                <span className="text-slate-600">{selectedTx.tipe === 'FullService' ? 'Drop Off' : 'Self Service'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Order</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] border ${
                  selectedTx.status === 'Selesai' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : selectedTx.status === 'Void' || selectedTx.status === 'Batal' ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-[#B5C9C9]/20 text-[#1E4648] border-[#B5C9C9]'
                }`}>{selectedTx.status}</span>
              </div>
              {selectedTx.catatan && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Catatan</span>
                  <span className="text-slate-600 text-right max-w-[60%]">{selectedTx.catatan}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="mb-4">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Layanan / Item</div>
              <div className="space-y-2">
                {(selectedTx.items || []).length > 0 ? (
                  (selectedTx.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      <div>
                        <div className="font-semibold text-slate-700">{item.layanan}</div>
                        <div className="text-[10px] text-slate-400">{item.qty} x Rp {(Number(item.hargaSatuan) || 0).toLocaleString('id-ID')}</div>
                      </div>
                      <span className="font-bold text-[#1E4648]">Rp {(Number(item.qty) * (Number(item.hargaSatuan) || 0)).toLocaleString('id-ID')}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-400 italic text-center py-2">Tidak ada detail item</div>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="space-y-1.5 text-xs pt-3 border-t border-slate-100">
              <div className="flex justify-between font-bold text-sm">
                <span className="text-slate-700">Total</span>
                <span className="text-[#1E4648]">Rp {(Number(selectedTx.total) || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Metode Bayar</span>
                <span className="font-medium text-slate-700">{selectedTx.metodeBayar || 'Tunai'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Dibayar</span>
                <span className="font-medium text-slate-700">Rp {(Number(selectedTx.nominalDP) || Number(selectedTx.total) || 0).toLocaleString('id-ID')}</span>
              </div>
              {(Number(selectedTx.sisaTagihan) || 0) > 0 ? (
                <div className="flex justify-between font-bold text-rose-600">
                  <span>Sisa Tagihan</span>
                  <span>Rp {(Number(selectedTx.sisaTagihan) || 0).toLocaleString('id-ID')}</span>
                </div>
              ) : (
                <div className="flex justify-between text-slate-500">
                  <span>Kembali</span>
                  <span className="font-medium text-[#1E4648]">Rp {Math.max(0, (Number(selectedTx.nominalDP) || Number(selectedTx.total) || 0) - (Number(selectedTx.total) || 0)).toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Status Bayar</span>
                <span className={`font-bold text-[10px] px-2 py-0.5 rounded border ${
                  selectedTx.statusPembayaran === 'Lunas' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>{selectedTx.statusPembayaran || 'Lunas'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 flex-wrap">
              <button
                onClick={() => { handleWhatsAppStruk(selectedTx); }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#1E4648] text-white text-xs font-bold py-2.5 rounded-lg hover:bg-[#163536] transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </button>
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Transaction Input Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-lg max-h-[92vh] overflow-y-auto space-y-4 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#B5C9C9]/20 border border-[#B5C9C9]200 text-[#1E4648] flex items-center justify-center font-bold text-sm">
                  📝
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-600">Input Transaksi Manual</h3>
                  <p className="text-[11px] text-slate-500">Catat transaksi susulan / khusus ke database server online</p>
                </div>
              </div>
              <button onClick={() => setShowManualModal(false)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Tanggal & Waktu */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal & Waktu Transaksi</label>
                <input
                  type="datetime-local"
                  value={manualTanggal}
                  onChange={(e) => setManualTanggal(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] bg-slate-50"
                />
              </div>

              {/* No Nota (Opsional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">No Nota (Kosongkan = Otomatis)</label>
                <input
                  type="text"
                  value={manualNoNota}
                  onChange={(e) => setManualNoNota(e.target.value)}
                  placeholder="Contoh: MAN-001 / LDY-..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Nama Pelanggan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Pelanggan *</label>
                <input
                  type="text"
                  value={manualNama}
                  onChange={(e) => setManualNama(e.target.value)}
                  placeholder="Nama pelanggan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* No HP */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">No HP / WhatsApp</label>
                <input
                  type="tel"
                  value={manualNoHp}
                  onChange={(e) => setManualNoHp(e.target.value)}
                  placeholder="08..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Tipe Layanan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tipe Layanan</label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-md">
                  <button
                    type="button"
                    onClick={() => setManualTipe('SelfService')}
                    className={`py-1.5 rounded text-xs font-semibold transition ${
                      manualTipe === 'SelfService' ? 'bg-[#1E4648] text-white' : 'text-slate-600'
                    }`}
                  >
                    Self Service
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualTipe('FullService')}
                    className={`py-1.5 rounded text-xs font-semibold transition ${
                      manualTipe === 'FullService' ? 'bg-[#1E4648] text-white' : 'text-slate-600'
                    }`}
                  >
                    Full Service
                  </button>
                </div>
              </div>


              {/* Status Nota */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status Nota</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] bg-white font-medium text-slate-600"
                >
                  <option value="Selesai">Selesai (Langsung Lunas & Selesai)</option>
                  <option value="Diterima">Diterima (Proses Pengerjaan)</option>
                </select>
              </div>

              {/* Nama Layanan / Deskripsi */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Deskripsi / Nama Layanan</label>
                <input
                  type="text"
                  value={manualLayanan}
                  onChange={(e) => setManualLayanan(e.target.value)}
                  placeholder="Contoh: Cuci Komplit 7.5 Kg / Paket Karpet"
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Jumlah & Harga Satuan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jumlah (Qty / Kg)</label>
                <input
                  type="number"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Harga Satuan (Rp)</label>
                <input
                  type="number"
                  value={manualHarga}
                  onChange={(e) => setManualHarga(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>

              {/* Metode Pembayaran */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Metode Pembayaran</label>
                <select
                  value={manualMetode}
                  onChange={(e) => setManualMetode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] bg-white font-medium"
                >
                  <option value="Tunai">Tunai</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Transfer">Transfer Bank</option>
                </select>
              </div>

              {/* Petugas / Kasir */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kasir / Petugas</label>
                <input
                  type="text"
                  value={manualPetugas}
                  onChange={(e) => setManualPetugas(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648]"
                />
              </div>
            </div>

            {/* Total Ringkasan Box */}
            <div className="bg-[#B5C9C9]/20/60 border border-[#B5C9C9]200/80 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#1E4648]">Total Nominal Transaksi</span>
                <p className="text-[11px] text-[#1E4648]">{manualQty || 1} × Rp {(Number(manualHarga) || 0).toLocaleString('id-ID')}</p>
              </div>
              <div className="text-base font-bold text-[#1E4648]">
                Rp {((Number(manualHarga) || 0) * (Number(manualQty) || 1)).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowManualModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-4 py-2.5 rounded-md text-xs transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveManualTx}
                disabled={savingManual}
                className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-bold py-2.5 rounded-md text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {savingManual ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Simpan Transaksi Manual</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Printer Modal */}
      <PrinterModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        tx={txForPrintModal}
        printType="struk"
      />
    </div>
  );
}
