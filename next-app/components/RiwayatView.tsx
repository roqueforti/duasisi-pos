'use client';

import React, { useState, useEffect } from 'react';
import { Search, Printer, Send, Eye, CheckCircle, RefreshCw, X, FileText, Plus, Calendar, User, CreditCard, Check } from 'lucide-react';
import { Transaksi } from '@/lib/types';
import { runBackend } from '@/lib/api';
import { getLocalTxCache, saveLocalTxCache } from '@/lib/syncEngine';

export default function RiwayatView() {
  const [filter, setFilter] = useState<'Semua' | 'SelfService' | 'FullService'>('Semua');
  const [search, setSearch] = useState('');
  const [txList, setTxList] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null);

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
    // Local ISO string format YYYY-MM-DDTHH:mm
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
    if (!manualNama.trim()) {
      alert('Nama pelanggan wajib diisi!');
      return;
    }
    const hargaNum = Number(manualHarga) || 0;
    const qtyNum = Number(manualQty) || 1;
    const grandTotal = hargaNum * qtyNum;

    if (grandTotal <= 0) {
      alert('Total nominal transaksi harus lebih dari 0!');
      return;
    }

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
      items: [
        {
          layanan: manualLayanan.trim() || 'Layanan Manual',
          qty: qtyNum,
          hargaSatuan: hargaNum
        }
      ]
    };

    let generatedNota = manualNoNota.trim() || `MAN-${Date.now().toString().slice(-6)}`;

    try {
      const res = await runBackend('simpanTransaksi', payload);
      if (res && res.noNota) {
        generatedNota = res.noNota;
      }
    } catch (err) {
      console.warn('[Manual Tx] Save to backend failed, saving locally:', err);
    }

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

    saveLocalTxCache(newTxObj);
    setShowManualModal(false);
    setSavingManual(false);
    alert(`✅ Transaksi manual ${generatedNota} berhasil disimpan!`);
    loadRiwayat();
  };

  const loadRiwayat = async () => {
    setLoading(true);
    const localCached = getLocalTxCache();
    
    if (!navigator.onLine) {
      setTxList(localCached);
      setLoading(false);
      return;
    }

    try {
      const data = await runBackend<Transaksi[]>('getTransaksiList', 'Semua');
      if (Array.isArray(data)) {
        const seen = new Set(data.map(t => t.noNota));
        const unSyncedLocal = localCached.filter(t => !seen.has(t.noNota));
        setTxList([...unSyncedLocal, ...data]);
      } else {
        setTxList(localCached);
      }
    } catch (err) {
      setTxList(localCached);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiwayat();
  }, []);

  const handleUpdateStatus = async (noNota: string, newStatus: string) => {
    if (!confirm(`Tandai nota ${noNota} sebagai '${newStatus}'?`)) return;
    try {
      await runBackend('updateStatus', noNota, newStatus);
      alert(`Status nota ${noNota} diperbarui menjadi ${newStatus}`);
      loadRiwayat();
    } catch (err) {
      alert('Gagal meng-update status');
    }
  };

  const handleWhatsAppStruk = (tx: Transaksi) => {
    let rawPhone = (tx.noHp || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);
    if (!rawPhone) {
      alert('Nomor HP / WhatsApp pelanggan tidak tersedia.');
      return;
    }

    const itemsStr = tx.items.map(i => `• ${i.layanan} (x${i.qty}) - Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}`).join('\n');
    const msg = `*HALO ${tx.namaPelanggan.toUpperCase()}, STRUK DUA SISI LAUNDRY*\n\n` +
      `No Nota: *${tx.noNota}*\n` +
      `Tanggal: ${tx.tanggal}\n` +
      `Status: *${tx.status}*\n\n` +
      `*Detail Layanan:*\n${itemsStr}\n\n` +
      `*TOTAL: Rp ${tx.total.toLocaleString('id-ID')}*\n\n` +
      `Terima kasih telah mencuci di Dua SiSi Laundry! 🙏`;

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handlePrintReceipt = (tx: Transaksi) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = tx.items
      .map(
        (i) => `
      <tr>
        <td style="padding: 4px 0; text-align: left;">${i.layanan}<br/><span style="color:#666;">${i.qty} x Rp ${i.hargaSatuan.toLocaleString('id-ID')}</span></td>
        <td style="padding: 4px 0; text-align: right; vertical-align: top;">Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Struk ${tx.noNota}</title>
          <style>
            body { font-family: monospace; font-size: 12px; margin: 10px; color: #000; }
            .header { text-align: center; margin-bottom: 12px; }
            .header h2 { margin: 0; font-size: 16px; }
            .header p { margin: 2px 0; font-size: 10px; }
            .line { border-bottom: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .total { font-weight: bold; font-size: 13px; text-align: right; margin-top: 8px; }
            .footer { text-align: center; margin-top: 16px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>DUA SISI LAUNDRY</h2>
            <p>Express & Coin Laundry</p>
            <p>Nota: ${tx.noNota}</p>
            <p>${tx.tanggal}</p>
          </div>
          <div class="line"></div>
          <p>Pelanggan: <b>${tx.namaPelanggan}</b> ${tx.noHp ? `(${tx.noHp})` : ''}</p>
          <div class="line"></div>
          <table>${itemsHtml}</table>
          <div class="line"></div>
          <div class="total">TOTAL: Rp ${tx.total.toLocaleString('id-ID')}</div>
          <div class="line"></div>
          <div class="footer">
            <p>Terima kasih atas kunjungan Anda!</p>
            <p>Simpan nota ini sebagai bukti pengambilan.</p>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex bg-slate-100 p-0.5 rounded-md gap-0.5">
          {(['Semua', 'SelfService', 'FullService'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                filter === f
                  ? 'bg-[#1E4648] text-white'
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
            <span>Input Transaksi Manual</span>
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
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">No Nota</th>
                <th className="py-3 px-4">Pelanggan</th>
                <th className="py-3 px-4">Tipe</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Total</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
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
                    <td className="py-3 px-4 font-semibold text-slate-800">{tx.noNota}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{tx.namaPelanggan}</div>
                      {tx.noHp && <div className="text-[11px] text-slate-400">{tx.noHp}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {tx.tipe}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{tx.tanggal}</td>
                    <td className="py-3 px-4 font-semibold text-[#1E4648]">
                      Rp {tx.total.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          tx.status === 'Selesai'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : tx.status === 'Batal'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                          title="Detail"
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
                        <button
                          onClick={() => handleWhatsAppStruk(tx)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition"
                          title="Kirim WA"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        {tx.status !== 'Selesai' && (
                          <button
                            onClick={() => handleUpdateStatus(tx.noNota, 'Selesai')}
                            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded transition"
                            title="Tandai Selesai"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
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

      {/* Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-[500] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-md animate-pop-scale">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Detail Nota {selectedTx.noNota}</h3>
                <p className="text-[11px] text-slate-400">{selectedTx.tanggal}</p>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-md">
                <div>
                  <span className="text-slate-400 text-[11px]">Pelanggan:</span>
                  <p className="font-semibold text-slate-700">{selectedTx.namaPelanggan}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">No HP:</span>
                  <p className="font-semibold text-slate-700">{selectedTx.noHp || '-'}</p>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-medium mb-1 block">Rincian Layanan:</span>
                <div className="space-y-1.5">
                  {selectedTx.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                      <span className="text-slate-700">{item.layanan} ×{item.qty}</span>
                      <span className="font-semibold text-[#1E4648]">Rp {(item.qty * item.hargaSatuan).toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between font-bold text-sm text-slate-800 pt-2 border-t border-slate-200">
                <span>Total Pembayaran</span>
                <span className="text-[#1E4648]">Rp {selectedTx.total.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => handlePrintReceipt(selectedTx)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded-md text-xs flex items-center justify-center gap-1">
                <Printer className="w-3.5 h-3.5" /> Cetak Struk
              </button>
              <button onClick={() => handleWhatsAppStruk(selectedTx)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-md text-xs flex items-center justify-center gap-1">
                <Send className="w-3.5 h-3.5" /> Kirim WA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Transaction Input Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 w-full max-w-lg max-h-[92vh] overflow-y-auto space-y-4 shadow-xl">
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
                  <option value="Selesai">🏁 Selesai (Langsung Lunas & Selesai)</option>
                  <option value="Diterima">📥 Diterima (Proses Pengerjaan)</option>
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
                  <option value="Tunai">💵 Tunai</option>
                  <option value="QRIS">📱 QRIS</option>
                  <option value="Transfer">🏦 Transfer Bank</option>
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
    </div>
  );
}
