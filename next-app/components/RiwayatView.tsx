'use client';

import React, { useState, useEffect } from 'react';
import { Search, Printer, Send, Eye, CheckCircle, RefreshCw, X, FileText } from 'lucide-react';
import { Transaksi } from '@/lib/types';
import { runBackend } from '@/lib/api';
import { getLocalTxCache } from '@/lib/syncEngine';

export default function RiwayatView() {
  const [filter, setFilter] = useState<'Semua' | 'SelfService' | 'FullService'>('Semua');
  const [search, setSearch] = useState('');
  const [txList, setTxList] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null);

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
    <div className="p-5 space-y-4 max-w-6xl mx-auto">
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

        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
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
            onClick={loadRiwayat}
            className="p-2 border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition"
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
    </div>
  );
}
