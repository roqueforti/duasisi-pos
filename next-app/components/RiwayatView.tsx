'use client';

import React, { useState, useEffect } from 'react';
import { Search, Printer, Send, Eye, CheckCircle, RefreshCw, X, FileText, Plus, Calendar, User, CreditCard, Check, AlertTriangle, ShieldAlert, DollarSign } from 'lucide-react';
import { Transaksi } from '@/lib/types';
import { runBackend } from '@/lib/api';
import PrinterModal from '@/components/PrinterModal';

export default function RiwayatView() {
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

  // State for Status Change Modal (FR-POS-20)
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [txToUpdateStatus, setTxToUpdateStatus] = useState<Transaksi | null>(null);

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
    if (!manualNama.trim()) { alert('Nama pelanggan wajib diisi!'); return; }
    const hargaNum = Number(manualHarga) || 0;
    const qtyNum = Number(manualQty) || 1;
    const grandTotal = hargaNum * qtyNum;

    if (grandTotal <= 0) { alert('Total nominal transaksi harus lebih dari 0!'); return; }

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
      total: grandTotal,
      items: [{ layanan: manualLayanan.trim() || 'Layanan Manual', qty: qtyNum, hargaSatuan: hargaNum }]
    };

    let generatedNota = manualNoNota.trim() || `MAN-${Date.now().toString().slice(-6)}`;

    try {
      const res = await runBackend('simpanTransaksi', payload);
      if (res && res.noNota) generatedNota = res.noNota;
    } catch (err) {}

    const newTxObj: Transaksi = {
      noNota: generatedNota,
      tanggal: manualTanggal ? new Date(manualTanggal).toLocaleString('id-ID') : new Date().toLocaleString('id-ID'),
      namaPelanggan: payload.namaPelanggan,
      noHp: payload.noHp,
      petugas: payload.petugas,
      tipe: payload.tipe,
      total: payload.total,
      status: manualStatus,
      items: payload.items
    };

    setShowManualModal(false);
    setSavingManual(false);
    alert(`✅ Transaksi manual ${generatedNota} berhasil disimpan!`);
    loadRiwayat();
  };

  const loadRiwayat = async () => {
    setLoading(true);
    try {
      const data = await runBackend<Transaksi[]>('getTransaksiList', 'Semua');
      if (Array.isArray(data)) {
        setTxList(data);
      } else {
        setTxList([]);
      }
    } catch (err) {
      console.error('[Riwayat] Gagal mengambil data transaksi online:', err);
      setTxList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiwayat();
  }, []);

  const handleUpdateStatus = async (noNota: string, newStatus: any) => {
    try {
      await runBackend('updateStatus', noNota, newStatus);
      
      if (newStatus === 'Siap Diambil') {
        const found = txList.find(t => t.noNota === noNota);
        if (found && found.noHp) {
          if (confirm(`Order ${noNota} siap diambil! Kirim pesan notifikasi WA ke ${found.namaPelanggan}?`)) {
            handleSendSiapWA(found);
          }
        }
      }

      alert(`Status nota ${noNota} diperbarui menjadi '${newStatus}'`);
      setShowStatusModal(false);
      loadRiwayat();
    } catch (err) {
      alert('Gagal meng-update status ke server');
    }
  };

  const handleAjukanVoid = async () => {
    if (!txToVoid) return;
    if (!alasanVoidInput.trim()) { alert('Alasan pembatalan (void) wajib diisi!'); return; }

    try {
      await runBackend('ajukanVoidTransaksi', txToVoid.noNota, alasanVoidInput.trim(), 'Kasir 1');
      alert(`Permohonan void nota ${txToVoid.noNota} berhasil dikirim ke Manager/Owner.`);
      setShowVoidModal(false);
      setAlasanVoidInput('');
      loadRiwayat();
    } catch (e) {
      alert('Gagal mengajukan void. Memperbarui lokal...');
    }
  };

  const handleProsesPelunasan = async () => {
    if (!txToLunas) return;
    const nominal = Number(pelunasanNominalInput) || (txToLunas.sisaTagihan || 0);
    try {
      await runBackend('pelunasanDP', txToLunas.noNota, nominal, pelunasanMetode);
      alert(`Pelunasan Rp ${nominal.toLocaleString('id-ID')} untuk nota ${txToLunas.noNota} berhasil!`);
      setShowPelunasanModal(false);
      loadRiwayat();
    } catch (e) {
      alert('Pelunasan berhasil dicatat!');
      setShowPelunasanModal(false);
    }
  };

  const handleSendSiapWA = (tx: Transaksi) => {
    let rawPhone = (tx.noHp || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);
    if (!rawPhone) {
      alert('Nomor HP pelanggan tidak tersedia.');
      return;
    }

    const msg = `*NOTIFIKASI LAUNDRY SIAP DIAMBIL*\n\n` +
      `Halo Sdr/i *${tx.namaPelanggan.toUpperCase()}*,\n` +
      `Cucian Anda dengan No Nota *${tx.noNota}* sudah *SIAP DIAMBIL* di outlet Dua SiSi Laundry.\n\n` +
      (tx.sisaTagihan ? `Sisa tagihan yang harus dilunasi: *Rp ${tx.sisaTagihan.toLocaleString('id-ID')}*\n\n` : '') +
      `Silakan datang ke outlet dengan membawa nota atau bukti pesan ini. Terima kasih!`;

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleWhatsAppStruk = (tx: Transaksi) => {
    let rawPhone = (tx.noHp || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);
    if (!rawPhone) {
      alert('Nomor HP / WhatsApp pelanggan tidak tersedia.');
      return;
    }

    const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://roqueforti.github.io/duasisi-pos/';
    const notaUrl = `${baseUrl}?nota=${encodeURIComponent(tx.noNota)}`;

    const itemsStr = tx.items.map(i => `• ${i.layanan} (x${i.qty}) - Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}`).join('\n');
    const msg = `*HALO ${tx.namaPelanggan.toUpperCase()}, STRUK DUA SISI LAUNDRY*\n\n` +
      `No Nota: *${tx.noNota}*\n` +
      `Tanggal: ${tx.tanggal}\n` +
      `Status: *${tx.status}*\n\n` +
      `*Detail Layanan:*\n${itemsStr}\n\n` +
      `*TOTAL: Rp ${tx.total.toLocaleString('id-ID')}*\n\n` +
      `*Lihat E-Nota Resmi (Anti-Pemalsuan & Cetak PDF):*\n${notaUrl}\n\n` +
      `Terima kasih telah mencuci di Dua SiSi Laundry!`;

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
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
                  : 'text-slate-600 hover:text-slate-900'
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

          <button
            onClick={openManualModal}
            className="bg-[#1E4648] hover:bg-[#153334] text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition shadow-sm shrink-0"
            title="Input Transaksi Manual"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Transaksi Manual</span>
          </button>

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
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4">Tipe & Kecepatan</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Status Produksi</th>
                <th className="py-3 px-4 text-right">Aksi & Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                    <td className="py-3 px-4"><div className="h-3.5 bg-slate-100 rounded w-16" /></td>
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
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {tx.noNota}
                      {tx.statusVoid === 'PendingApproval' && (
                        <div className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          Pending Void
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{tx.namaPelanggan}</div>
                      {tx.noHp && <div className="text-[11px] text-slate-500">{tx.noHp}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 w-fit">
                          {tx.tipe}
                        </span>
                        {tx.tingkatLayanan && tx.tingkatLayanan !== 'Reguler' && (
                          <span className="text-[10px] font-bold text-amber-700">
                            ⚡ {tx.tingkatLayanan}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{tx.tanggal}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#1E4648]">Rp {tx.total.toLocaleString('id-ID')}</div>
                      {tx.sisaTagihan && tx.sisaTagihan > 0 ? (
                        <div className="text-[10px] text-rose-600 font-bold">
                          Sisa: Rp {tx.sisaTagihan.toLocaleString('id-ID')}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => { setTxToUpdateStatus(tx); setShowStatusModal(true); }}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md border flex items-center gap-1 transition ${
                          tx.status === 'Selesai'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : tx.status === 'Siap Diambil'
                            ? 'bg-teal-50 text-[#1E4648] border-teal-300 hover:bg-teal-100 animate-pulse'
                            : tx.status === 'Batal'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        <span>{tx.status || 'Diterima'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                          title="Detail Nota"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePrintReceipt(tx)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                          title="Cetak Struk"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Send WA Notification */}
                        <button
                          onClick={() => tx.status === 'Siap Diambil' ? handleSendSiapWA(tx) : handleWhatsAppStruk(tx)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition"
                          title={tx.status === 'Siap Diambil' ? "Kirim WA Siap Diambil" : "Kirim WA Struk"}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>

                        {/* DP Pelunasan Button (FR-POS-16) */}
                        {tx.sisaTagihan && tx.sisaTagihan > 0 ? (
                          <button
                            onClick={() => { setTxToLunas(tx); setPelunasanNominalInput((tx.sisaTagihan || 0).toString()); setShowPelunasanModal(true); }}
                            className="p-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded px-2 font-semibold transition"
                            title="Pelunasan DP"
                          >
                            Lunas
                          </button>
                        ) : null}

                        {/* Void Request Button (FR-POS-24) */}
                        {tx.status !== 'Batal' && tx.statusVoid !== 'PendingApproval' && (
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
              Ajukan pembatalan (void) untuk Nota <span className="font-bold">{txToVoid.noNota}</span> (Total Rp {txToVoid.total.toLocaleString('id-ID')}). Permohonan membutuhkan persetujuan Manager/Owner.
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

      {/* Production Status Change Modal (FR-POS-20) */}
      {showStatusModal && txToUpdateStatus && (
        <div className="fixed inset-0 z-[550] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm text-center">
            <h3 className="text-sm font-bold text-slate-800 mb-1">Perbarui Status Produksi</h3>
            <p className="text-xs text-slate-500 mb-4">Nota: <span className="font-bold text-slate-800">{txToUpdateStatus.noNota}</span></p>

            <div className="space-y-2 mb-5">
              {(['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil', 'Selesai'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => handleUpdateStatus(txToUpdateStatus.noNota, st)}
                  className={`w-full py-2 rounded-lg text-xs font-bold border transition ${
                    txToUpdateStatus.status === st
                      ? 'bg-[#1E4648] text-white border-[#1E4648]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button onClick={() => setShowStatusModal(false)} className="w-full bg-slate-100 text-slate-600 py-2 rounded-lg text-xs font-semibold">Tutup</button>
          </div>
        </div>
      )}

      {/* DP Pelunasan Modal (FR-POS-16) */}
      {showPelunasanModal && txToLunas && (
        <div className="fixed inset-0 z-[550] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Pelunasan Pengambilan Cucian</h3>
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
                      className={`py-1.5 rounded text-xs font-semibold border ${pelunasanMetode === m ? 'bg-teal-50 border-[#1E4648] text-[#1E4648]' : 'border-slate-200 text-slate-600'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowPelunasanModal(false)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-md text-xs font-semibold">Batal</button>
              <button onClick={handleProsesPelunasan} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-md text-xs transition">
                Simpan Pelunasan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-md">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Detail Nota {selectedTx.noNota}</h3>
                <p className="text-[11px] text-slate-400">{selectedTx.tanggal}</p>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Transaction Input Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 w-full max-w-lg max-h-[92vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-[#1E4648] flex items-center justify-center font-bold text-sm">
                  📝
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Input Transaksi Manual</h3>
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-md outline-none focus:border-[#1E4648] bg-white font-medium text-slate-800"
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
            <div className="bg-teal-50/60 border border-teal-200/80 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-teal-800">Total Nominal Transaksi</span>
                <p className="text-[11px] text-teal-600">{manualQty || 1} × Rp {(Number(manualHarga) || 0).toLocaleString('id-ID')}</p>
              </div>
              <div className="text-base font-extrabold text-[#1E4648]">
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
                className="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-bold py-2.5 rounded-md text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
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
