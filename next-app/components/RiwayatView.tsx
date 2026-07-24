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
      alert('⚠️ Gagal meng-update status');
    }
  };

  const handleWhatsAppStruk = (tx: Transaksi) => {
    let rawPhone = (tx.noHp || '').replace(/[^0-9]/g, '');
    if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);
    if (!rawPhone) {
      alert('⚠️ No HP pelanggan belum diisi!');
      return;
    }

    let itemText = '';
    (tx.items || []).forEach((i) => {
      itemText += `• ${i.layanan} (${i.qty}x) = Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}\n`;
    });

    const msg =
      `✨ *DUA SISI POS — NOTA LAUNDRY DIGITAL* ✨\n` +
      `====================================\n` +
      `No. Nota   : ${tx.noNota}\n` +
      `Tanggal    : ${tx.tanggal}\n` +
      `Pelanggan  : ${tx.namaPelanggan}\n` +
      `Layanan    : ${tx.tipe}\n` +
      `Petugas    : ${tx.petugas}\n` +
      `------------------------------------\n` +
      `*RINCIAN ITEM:*\n` +
      itemText +
      `------------------------------------\n` +
      `*TOTAL BAYAR : Rp ${Number(tx.total).toLocaleString('id-ID')}*\n` +
      `====================================\n` +
      `Status : ${tx.status}\n\n` +
      `Terima kasih telah mencuci di *Dua SiSi POS*! 🧺\n` +
      `Pakaian Bersih, Rapi & Wangi ✨`;

    window.open(`https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCetakThermal = (tx: Transaksi) => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (!printWindow) return;

    let itemHtml = '';
    (tx.items || []).forEach((i) => {
      itemHtml += `<div style="display:flex;justify-content:space-between;margin:2px 0;"><span>${i.layanan} x${i.qty}</span><span>${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</span></div>`;
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Struk Thermal - ${tx.noNota}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 58mm; padding: 4px; margin: 0 auto; color: #000; }
            .r-header { text-align: center; margin-bottom: 8px; }
            .r-title { font-size: 14px; font-weight: bold; }
            .r-divider { border-top: 1px dashed #000; margin: 6px 0; }
            .r-footer { text-align: center; margin-top: 10px; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="r-header">
            <img src="./assets/logo-full-black.svg" style="width: 130px; margin: 0 auto 6px auto; display: block;" />
            <div>Telp/WA: 0812-XXXX-XXXX</div>
          </div>
          <div class="r-divider"></div>
          <div>Nota: ${tx.noNota}</div>
          <div>Tgl: ${tx.tanggal}</div>
          <div>Pelanggan: ${tx.namaPelanggan}</div>
          <div>Petugas: ${tx.petugas}</div>
          <div class="r-divider"></div>
          ${itemHtml}
          <div class="r-divider"></div>
          <div style="font-weight:bold; font-size:12px; display:flex; justify-content:space-between;"><span>TOTAL</span><span>Rp ${Number(tx.total).toLocaleString('id-ID')}</span></div>
          <div class="r-divider"></div>
          <div class="r-footer">
            <div>Terima kasih atas kunjungan Anda!</div>
            <div>Pakaian Bersih, Rapi & Wangi</div>
          </div>
          <script>window.print(); setTimeout(() => window.close(), 1000);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredTx = txList.filter((t) => {
    const matchFilter = filter === 'Semua' || t.tipe === filter;
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      t.noNota.toLowerCase().includes(q) ||
      (t.namaPelanggan && t.namaPelanggan.toLowerCase().includes(q)) ||
      (t.noHp && t.noHp.includes(q));
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto animate-slide-up">
      {/* Header Filters & Search */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          {(['Semua', 'SelfService', 'FullService'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95 ${
                filter === f
                  ? 'bg-[#1E4648] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {f === 'Semua' ? 'Semua Nota' : f === 'SelfService' ? 'Self Service' : 'Full Service'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nota / nama pelanggan..."
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648] bg-slate-50/50 focus:bg-white transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={loadRiwayat}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-12 bg-slate-100 animate-pulse rounded-xl w-full" />
            ))}
          </div>
        ) : filteredTx.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-xs">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <div className="font-bold">Belum ada transaksi ditemukan.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 font-extrabold border-b border-slate-200">
                  <th className="py-3.5 px-4 text-left">No Nota & Tanggal</th>
                  <th className="py-3.5 px-4 text-left">Pelanggan</th>
                  <th className="py-3.5 px-4 text-left">Total (Rp)</th>
                  <th className="py-3.5 px-4 text-left">Tipe</th>
                  <th className="py-3.5 px-4 text-left">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((tx) => (
                  <tr key={tx.noNota} className="border-b border-slate-100 hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-black text-[#1E4648]">{tx.noNota}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">{tx.tanggal}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800">{tx.namaPelanggan}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">{tx.noHp || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">
                      Rp {Number(tx.total).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-md shadow-2xs ${
                        tx.tipe === 'FullService' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tx.tipe === 'FullService' ? 'Full Service' : 'Self Service'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-md shadow-2xs ${
                        tx.status === 'Selesai'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tx.status === 'Batal'
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {tx.status === 'Selesai' ? '✅ Selesai' : tx.status === 'Batal' ? '🚫 Batal' : '🟢 Diterima'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="bg-[#1E4648] hover:bg-[#153334] text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95"
                      >
                        Detail & Struk
                      </button>
                      {tx.status !== 'Selesai' && (
                        <button
                          onClick={() => handleUpdateStatus(tx.noNota, 'Selesai')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl shadow-sm transition active:scale-95"
                        >
                          Selesai
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL & STRUK MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-[500] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 my-auto text-left animate-pop-scale">
            <div className="text-base font-extrabold text-slate-900 mb-1 flex justify-between items-center">
              <span>🧾 Detail {selectedTx.noNota}</span>
              <span className="text-xs font-black bg-teal-50 text-[#1E4648] px-2.5 py-0.5 rounded-full border border-teal-200">
                {selectedTx.tipe}
              </span>
            </div>
            <div className="text-xs text-slate-500 mb-3 leading-relaxed">
              Pelanggan: <strong>{selectedTx.namaPelanggan}</strong> ({selectedTx.noHp || '-'})
              <br />
              Tanggal: {selectedTx.tanggal} · Petugas: {selectedTx.petugas}
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl mb-4 space-y-1.5 border border-slate-200/80">
              {(selectedTx.items || []).map((i, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 border-b border-dashed border-slate-200 text-xs">
                  <div>
                    <div className="font-extrabold text-slate-800">{i.layanan}</div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Rp {Number(i.hargaSatuan).toLocaleString('id-ID')} x {i.qty}
                    </div>
                  </div>
                  <div className="font-black text-slate-900">
                    Rp {(i.qty * i.hargaSatuan).toLocaleString('id-ID')}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center font-black text-sm text-slate-900 mb-5">
              <span>TOTAL BAYAR</span>
              <span className="text-[#1E4648] text-lg font-black">
                Rp {Number(selectedTx.total).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => handleWhatsAppStruk(selectedTx)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <Send className="w-3.5 h-3.5" /> Kirim WA Struk
              </button>
              <button
                onClick={() => handleCetakThermal(selectedTx)}
                className="bg-[#1E4648] hover:bg-[#153334] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Struk
              </button>
              <button
                onClick={() => setSelectedTx(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2.5 rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
