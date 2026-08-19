'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Printer,
  Share2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Download,
  Image as ImageIcon,
  Copy,
  Check,
  ArrowLeft,
  Clock,
  ExternalLink,
  QrCode
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { runBackend } from '@/lib/api';
import { Transaksi } from '@/lib/types';
import { maskPhone } from '@/lib/utils';
import { useDialog } from '@/components/DialogProvider';

interface ENotaViewProps {
  noNota: string;
  token?: string;
}

export default function ENotaView({ noNota, token }: ENotaViewProps) {
  const { showAlert } = useDialog();
  const [loading, setLoading] = useState<boolean>(true);
  const [tx, setTx] = useState<Transaksi | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [poinRate, setPoinRate] = useState<number>(10000);
  const [downloadingPng, setDownloadingPng] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const fetchNota = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await runBackend<{ success?: boolean; transaksi?: Transaksi; message?: string }>(
        'getTransaksiByNota',
        noNota || '',
        token || ''
      );

      if (res?.success && res.transaksi) {
        setTx(res.transaksi);
      } else {
        setErrorMsg(res?.message || 'Nota transaksi tidak ditemukan.');
      }

      try {
        const conf = await runBackend<{ rate: number }>('getPoinConfig');
        if (conf && conf.rate) setPoinRate(conf.rate);
      } catch (e) {}
    } catch (err: any) {
      setErrorMsg('Gagal memverifikasi nota dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (noNota || token) {
      fetchNota();
    }
  }, [noNota, token]);

  const handleDownloadPng = async () => {
    const el = document.getElementById('enota-print-area');
    if (!el) return;
    try {
      setDownloadingPng(true);
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#fafaf9'
      });
      const link = document.createElement('a');
      link.download = `E-Nota-${tx?.noNota || 'DuaSiSi'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: any) {
      console.error('Failed to download PNG:', err);
      showAlert('Gagal mengunduh gambar nota. Anda dapat menggunakan opsi Cetak / PDF.', 'error');
    } finally {
      setDownloadingPng(false);
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const custName = tx?.namaPelanggan || 'Pelanggan';
    const total = (Number(tx?.total) || 0).toLocaleString('id-ID');
    const isDropOff = tx?.tipe === 'FullService';

    const lines = [
      `*DUA SISI LAUNDRY - E-NOTA RESMI*`,
      `_Express & Self Service Laundry_`,
      `--------------------------------`,
      `Halo *${custName}*! Berikut rincian bukti transaksi resmi Anda:`,
      ``,
      `*No. Nota*     : ${tx?.noNota || ''}`,
      `*Tanggal*      : ${tx?.tanggal || ''}`,
      `*Kasir/Staff*  : ${tx?.petugas || 'Kasir'}`,
      isDropOff ? `*Layanan*      : Drop Off (${tx?.tingkatLayanan || 'Reguler'})` : `*Layanan*      : Self Service`,
      isDropOff && tx?.estimasi ? `*Estimasi Selesai*: ${tx.estimasi}` : '',
      ``,
      `*TOTAL BAYAR   : Rp ${total}*`,
      `Metode Bayar   : ${tx?.metodeBayar || 'Tunai'}`,
      `--------------------------------`,
      `*Lihat & Download E-Nota Resmi:*`,
      url,
      ``,
      `Terima kasih telah mempercayakan cucian Anda di Dua SiSi Laundry! 🙏✨`
    ];

    const msg = lines.filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCopyLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      showAlert('Link E-Nota berhasil disalin ke clipboard!', 'success');
    } catch (e) {
      // fallback
    }
  };

  const getSecurityHash = (notaStr: string) => {
    let hash = 0;
    for (let i = 0; i < notaStr.length; i++) {
      hash = (hash << 5) - hash + notaStr.charCodeAt(i);
      hash |= 0;
    }
    return `DS-SEC-${Math.abs(hash).toString(16).toUpperCase()}-VERIFIED`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 text-slate-700 select-none overflow-y-auto">
      {/* Background Graphic Watermark */}
      <div className="fixed inset-0 bg-[radial-gradient(#1E4648_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

      {loading ? (
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-200 my-auto z-10">
          <RefreshCw className="w-10 h-10 text-[#1E4648] animate-spin mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-800 mb-1">Memverifikasi E-Nota...</h3>
          <p className="text-xs text-slate-500">Mengecek sertifikat keamanan di Cloud Dua SiSi POS</p>
        </div>
      ) : errorMsg || !tx ? (
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl border border-rose-200 my-auto z-10">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">E-Nota Tidak Ditemukan</h3>
          <p className="text-xs text-slate-600">{errorMsg || 'Nomor nota tidak terdaftar pada sistem server Dua SiSi POS.'}</p>
        </div>
      ) : (
        /* Split Layout: Receipt on Left, Control Panel on Right */
        <div className="w-full max-w-3xl flex flex-col md:flex-row items-center md:items-start justify-center gap-5 relative z-10 my-auto py-3">
          
          {/* LEFT: COMPACT THERMAL PAPER RECEIPT */}
          <div
            id="enota-print-area"
            className="w-full max-w-[340px] sm:max-w-[360px] bg-stone-50 border border-stone-300 rounded-2xl p-4 sm:p-5 shadow-2xl text-slate-800 font-sans relative overflow-hidden shrink-0 print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white print:max-w-full"
          >
            {/* Top Zig-Zag Thermal Paper Decoration */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] [background-size:6px_6px] print:hidden" />

            {/* Receipt Header */}
            <div className="text-center pb-2.5 border-b border-dashed border-stone-300">
              <div className="inline-block p-1 rounded-lg bg-[#1E4648]/10 mb-1">
                <img
                  src="/assets/logo-full-black.svg"
                  alt="Dua SiSi Logo"
                  className="h-6 w-auto mx-auto filter brightness-0"
                />
              </div>
              <h2 className="text-xs font-black tracking-tight text-slate-900 uppercase">DUA SISI LAUNDRY</h2>
              <p className="text-[9.5px] text-slate-500 font-medium">Express & Self Service Coin Laundry</p>
              <p className="text-[8.5px] text-slate-400">Hotline CS: 0812-3456-7890</p>
            </div>

            {/* Receipt Metadata */}
            <div className="py-2 text-[10.5px] space-y-0.5 border-b border-dashed border-stone-300 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">NO. NOTA:</span>
                <span className="font-bold text-slate-900">{tx.noNota}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">TANGGAL:</span>
                <span className="text-slate-700">{tx.tanggal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">PELANGGAN:</span>
                <span className="font-bold text-slate-900">{tx.namaPelanggan} ({maskPhone(tx.noHp || '')})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">KASIR/STAFF:</span>
                <span className="text-slate-700 font-semibold">{tx.petugas || 'Kasir Dua SiSi'}</span>
              </div>

              {tx.tipe === 'FullService' ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">LAYANAN:</span>
                    <span className="font-bold text-slate-900">Drop Off ({tx.tingkatLayanan || 'Reguler'})</span>
                  </div>
                  {tx.estimasi && (
                    <div className="flex justify-between text-amber-900 font-bold bg-amber-50/80 px-1 rounded">
                      <span className="font-sans text-[10px]">ESTIMASI:</span>
                      <span className="text-[10px]">{tx.estimasi}</span>
                    </div>
                  )}
                </>
              ) : tx.tipe === 'SelfService' ? (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">LAYANAN:</span>
                  <span className="font-bold text-slate-900">Self Service</span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">KATEGORI:</span>
                  <span className="font-bold text-slate-900">Retail / Add On</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-0.5 font-sans">
                <span className="text-slate-500">STATUS ORDER:</span>
                <span className="bg-teal-50 text-[#1E4648] font-bold text-[9px] px-1.5 py-0.2 rounded border border-teal-200">
                  {tx.status || 'Diterima'}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-2 border-b border-dashed border-stone-300">
              <div className="text-[10px] font-bold text-slate-700 mb-1 flex justify-between uppercase">
                <span>ITEM / LAYANAN</span>
                <span>SUBTOTAL</span>
              </div>
              <div className="space-y-1 text-[10.5px]">
                {tx.items && tx.items.length > 0 ? (
                  tx.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 truncate">{item.layanan}</div>
                        <div className="text-[9.5px] text-slate-500 font-mono">
                          {item.qty} × Rp {(Number(item.hargaSatuan || 0) || 0).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div className="font-bold text-slate-900 font-mono shrink-0">
                        Rp {(Number(item.qty * item.hargaSatuan) || 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center italic py-1 text-[10px]">Detail item terdaftar pada nota.</div>
                )}
              </div>
            </div>

            {/* Totals & Payment Summary */}
            <div className="py-2 text-[10.5px] space-y-1 border-b border-dashed border-stone-300 font-mono">
              {Number(tx.diskon || 0) > 0 && (
                <>
                  <div className="flex justify-between text-slate-600 font-sans">
                    <span>Subtotal:</span>
                    <span>Rp {(Number(tx.subtotal || tx.total) || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-bold font-sans">
                    <span>Diskon Promo:</span>
                    <span>-Rp {(Number(tx.diskon) || 0).toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center text-xs font-black text-slate-900 pt-0.5 border-t border-dashed border-stone-200">
                <span className="font-sans">TOTAL TAGIHAN:</span>
                <span className="text-sm text-[#1E4648]">Rp {(Number(tx.total) || 0).toLocaleString('id-ID')}</span>
              </div>

              {tx.metodeBayar && (
                <div className="flex justify-between text-slate-600 font-sans">
                  <span>METODE BAYAR:</span>
                  <span className="font-bold text-slate-800">{tx.metodeBayar}</span>
                </div>
              )}

              {tx.statusPembayaran && (
                <div className="flex justify-between text-slate-600 font-sans items-center">
                  <span>STATUS BAYAR:</span>
                  <span
                    className={`font-bold text-[9px] px-1.5 py-0.2 rounded border ${
                      tx.statusPembayaran === 'Lunas'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {tx.statusPembayaran}
                  </span>
                </div>
              )}
            </div>

            {/* Loyalty Points Section */}
            <div className="my-1.5 px-2.5 py-1.5 bg-amber-50/70 rounded-lg border border-amber-200/60 text-[9.5px] space-y-0.5">
              <div className="flex justify-between items-center font-bold text-amber-900">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Poin Transaksi:</span>
                </span>
                <span className="font-mono">+{Math.floor((Number(tx.total) || 0) / (poinRate || 10000))} Poin</span>
              </div>
              <div className="text-[8.5px] text-amber-800 italic">
                Tukarkan poin dengan potongan harga/layanan gratis/produk di kasir!
              </div>
            </div>

            {/* Security Digital Seal & Barcode */}
            <div className="pt-1 text-center space-y-1">
              <div className="flex justify-center items-center gap-0.5 h-6 px-3 py-1 bg-white rounded border border-slate-200">
                {[4, 2, 6, 1, 8, 3, 5, 2, 7, 4, 2, 6, 8, 1, 5, 3, 7, 2, 4, 8, 2, 6].map((w, i) => (
                  <div
                    key={i}
                    className="bg-slate-900 h-full rounded-xs"
                    ref={(el) => {
                      if (el) el.style.width = `${w}px`;
                    }}
                  />
                ))}
              </div>
              <div className="text-[8.5px] text-slate-400 font-mono tracking-widest">
                *{tx.noNota}*
              </div>
              <p className="text-[8px] text-slate-400 italic">
                E-Nota resmi Cloud Dua SiSi POS
              </p>
            </div>
          </div>

          {/* RIGHT: CONTROL PANEL, ACTIONS & SECURITY INFO */}
          <div className="w-full md:w-[280px] space-y-3 shrink-0 print:hidden">
            {/* 1. Official Security Badge */}
            <div className="bg-emerald-950/80 border border-emerald-600/50 rounded-2xl p-3.5 flex items-center justify-between gap-2.5 text-emerald-200 shadow-lg">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-400/40">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-emerald-200 flex items-center gap-1">
                    <span>E-NOTA RESMI</span>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="text-[9px] text-emerald-400/80 font-mono truncate">
                    {getSecurityHash(tx.noNota)}
                  </div>
                </div>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/40 shrink-0">
                VALID
              </span>
            </div>

            {/* 2. Action Buttons Stack */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-xl">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Aksi & Simpan Nota
              </div>

              {/* Download PNG */}
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={downloadingPng}
                className="w-full bg-white hover:bg-slate-100 text-slate-800 font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
              >
                {downloadingPng ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[#1E4648]" />
                ) : (
                  <Download className="w-4 h-4 text-[#1E4648]" />
                )}
                <span>Unduh Gambar PNG</span>
              </button>

              {/* Download / Cetak PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-300" />
                <span>Cetak / Download PDF</span>
              </button>

              {/* Share WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan ke WhatsApp</span>
              </button>

              {/* Salin Link */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-semibold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Link Berhasil Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Salin Tautan E-Nota</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Customer Note */}
            <div className="px-2 text-[10.5px] text-slate-500 text-center leading-relaxed">
              Bukti transaksi digital resmi ini sah dan dapat disimpan sebagai arsip pembayaran.
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
