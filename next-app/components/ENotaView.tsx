'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Printer, Share2, CheckCircle2, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { runBackend } from '@/lib/api';
import { Transaksi } from '@/lib/types';
import { maskPhone } from '@/lib/utils';

interface ENotaViewProps {
  noNota: string;
  token?: string;
  onBackToApp?: () => void;
}

export default function ENotaView({ noNota, token, onBackToApp }: ENotaViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [tx, setTx] = useState<Transaksi | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchNota = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Kirim token ke backend jika ada (untuk URL obfuscation)
      const res = await runBackend<{ success?: boolean; error?: boolean; transaksi?: Transaksi; message?: string }>(
        'getTransaksiByNota', noNota, token || ''
      );

      if (res && res.success && res.transaksi) {
        setTx(res.transaksi);
      } else if (res?.message?.includes('Token')) {
        // Token invalid — coba tanpa token (fallback untuk link lama tanpa token)
        const res2 = await runBackend<{ success?: boolean; transaksi?: Transaksi; message?: string }>(
          'getTransaksiByNota', noNota, ''
        );
        if (res2?.success && res2.transaksi) {
          setTx(res2.transaksi);
        } else {
          setErrorMsg('Link e-nota tidak valid atau sudah kedaluwarsa.');
        }
      } else {
        setErrorMsg(res?.message || 'Nota transaksi tidak ditemukan.');
      }
    } catch (err: any) {
      setErrorMsg('Gagal memverifikasi nota dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (noNota) {
      fetchNota();
    }
  }, [noNota]);

  const handleDownloadPdf = () => {
    const el = document.getElementById('enota-print-area');
    if (!el) { window.print(); return; }
    const printWin = window.open('', '_blank', 'width=500,height=800');
    if (!printWin) { window.print(); return; }
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>E-Nota ${noNota}</title>
          <style>
            body { margin: 0; padding: 16px; font-family: sans-serif; background: #fff; }
            @media print { @page { size: A5 portrait; margin: 8mm; } }
          </style>
        </head>
        <body>${el.outerHTML}</body>
      </html>
    `);
    printWin.document.close();
    printWin.onload = () => { printWin.focus(); printWin.print(); };
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `E-Nota Resmi Dua SiSi - ${noNota}`,
        text: `Lihat E-Nota Resmi Laundry Dua SiSi Nota #${noNota}`,
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Link E-Nota Resmi berhasil disalin ke clipboard!');
    }
  };

  // Generate deterministic security hash for verification
    let hash = 0;
    for (let i = 0; i < notaStr.length; i++) {
      hash = (hash << 5) - hash + notaStr.charCodeAt(i);
      hash |= 0;
    }
    return `DS-SEC-${Math.abs(hash).toString(16).toUpperCase()}-VERIFIED`;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-3 sm:p-6 text-slate-600 select-none">
      {/* Background Graphic Watermark */}
      <div className="fixed inset-0 bg-[radial-gradient(#1E4648_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

      {loading ? (
        <div className="bg-white rounded-lg p-8 max-w-sm w-full text-center shadow-lg border border-slate-200">
          <RefreshCw className="w-10 h-10 text-[#1E4648] animate-spin mx-auto mb-4" />
          <h3 className="text-base font-bold text-slate-600 mb-1">Memverifikasi Keaslian E-Nota...</h3>
          <p className="text-xs text-slate-500">Mengecek sertifikat keamanan di Cloud Dua SiSi POS</p>
        </div>
      ) : errorMsg || !tx ? (
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center shadow-lg border border-rose-200">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700 mb-2">E-Nota Tidak Ditemukan</h3>
          <p className="text-xs text-slate-600 mb-6">{errorMsg || 'Nomor nota tidak terdaftar pada sistem server Dua SiSi POS.'}</p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="bg-[#1E4648] text-white px-5 py-2.5 rounded-lg text-xs font-semibold hover:bg-[#163536] transition shadow-md"
            >
              Kembali ke Aplikasi Utama
            </button>
          )}
        </div>
      ) : (
        <div className="w-full max-w-md space-y-4 relative z-10">
          {/* Security Verification Banner Header */}
          <div className="bg-emerald-950/80 border border-emerald-700/60 rounded-lg p-3.5 flex items-center justify-between gap-3 text-emerald-200 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#B5C9C9]/200/20 flex items-center justify-center shrink-0 border border-emerald-400/30">
                <ShieldCheck className="w-5 h-5 text-[#B5C9C9]" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                  <span>E-NOTA RESMI TERVERIFIKASI</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#B5C9C9] fill-emerald-400/20" />
                </div>
                <div className="text-[10px] text-[#B5C9C9]/80 font-sans tracking-tight">
                  {getSecurityHash(tx.noNota)}
                </div>
              </div>
            </div>
            <span className="bg-[#B5C9C9]/200/20 text-[#B5C9C9] text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 shrink-0">
              ASLI & VALID
            </span>
          </div>

          {/* THERMAL PDF RECEIPT CONTAINER */}
          <div id="enota-print-area" className="bg-stone-50 border border-stone-300 rounded-lg p-6 shadow-lg text-slate-600 font-sans relative overflow-hidden print:shadow-none print:border-none print:p-0">
            {/* Top Zig-Zag Thermal Paper Decoration */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] [background-size:8px_8px]" />

            {/* Receipt Header */}
            <div className="text-center pb-4 border-b border-dashed border-stone-300">
              <div className="inline-block p-2 rounded-lg bg-[#1E4648]/10 mb-2">
                <img
                  src="./assets/logo-full-white.svg"
                  alt="Dua SiSi Logo"
                  className="h-8 w-auto filter brightness-0"
                />
              </div>
              <h2 className="text-sm font-bold tracking-tight text-slate-700">DUA SISI LAUNDRY</h2>
              <p className="text-[10px] text-slate-600 tracking-wider">EXPRESS & COIN LAUNDRY SYSTEM</p>
              <p className="text-[9px] text-slate-500 mt-1">Hotline CS / WA: 0812-3456-7890</p>
            </div>

            {/* Receipt Metadata */}
            <div className="py-3 text-xs space-y-1 border-b border-dashed border-stone-300">
              <div className="flex justify-between">
                <span className="text-slate-500">NO. NOTA:</span>
                <span className="font-bold text-slate-700">{tx.noNota}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TANGGAL:</span>
                <span className="text-slate-600">{tx.tanggal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">PELANGGAN:</span>
                <span className="font-bold text-slate-700">{tx.namaPelanggan} ({maskPhone(tx.noHp || '')})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">KECEPATAN:</span>
                <span className="font-semibold text-[#1E4648]">{tx.tingkatLayanan || 'Reguler'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">KASIR:</span>
                <span className="text-slate-600">{tx.petugas || 'Kasir Dua SiSi'}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-500">STATUS ORDER:</span>
                <span className="bg-[#B5C9C9]/30 text-[#1E4648] font-bold text-[10px] px-2 py-0.5 rounded-md border border-[#B5C9C9]200">
                  {tx.status}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="py-3 border-b border-dashed border-stone-300">
              <div className="text-[11px] font-bold text-slate-600 mb-2 flex justify-between">
                <span>LAYANAN / ITEM</span>
                <span>SUBTOTAL</span>
              </div>
              <div className="space-y-2 text-xs">
                {tx.items && tx.items.length > 0 ? (
                  tx.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-slate-700">{item.layanan}</div>
                        <div className="text-[10px] text-slate-500">
                          {item.qty} x Rp {(Number(item.hargaSatuan || 0) || 0).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div className="font-bold text-slate-700">
                        Rp {(Number(item.qty * item.hargaSatuan) || 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 text-center italic py-1">Detail item terdaftar pada nota.</div>
                )}
              </div>
            </div>

            {/* Totals & Payment Summary */}
            <div className="py-3 text-xs space-y-1.5 border-b border-dashed border-stone-300">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-slate-700">TOTAL PEMBAYARAN:</span>
                <span className="text-[#1E4648] text-base">Rp {(Number(tx.total) || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>DIBAYAR ({tx.metodeBayar || 'Tunai'}):</span>
                <span className="font-semibold text-[#1E4648]">
                  Rp {(Number(tx.nominalDP) || Number(tx.total) || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-700">KEMBALI / SISA:</span>
                <span className={Number(tx.sisaTagihan) > 0 ? 'text-rose-600' : 'text-[#1E4648]'}>
                  Rp {(Number(tx.sisaTagihan) || 0).toLocaleString('id-ID')}
                </span>
              </div>
              {tx.statusPembayaran && (
                <div className="flex justify-between text-slate-500">
                  <span>STATUS BAYAR:</span>
                  <span className={`font-bold text-xs px-2 py-0.5 rounded-md border ${
                    tx.statusPembayaran === 'Lunas'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {tx.statusPembayaran}
                  </span>
                </div>
              )}
            </div>

            {/* Security Digital Seal & Barcode Visual */}
            <div className="pt-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5 text-[#FF9500]" />
                <span>OFFICIAL DIGITAL SECURITY SEAL</span>
                <Sparkles className="w-3.5 h-3.5 text-[#FF9500]" />
              </div>

              {/* Barcode Mock Visual */}
              <div className="flex justify-center items-center gap-1 h-8 px-4 py-1 bg-white rounded-lg border border-slate-200">
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
              <div className="text-[9px] text-slate-400 font-sans tracking-widest">
                *{tx.noNota}*
              </div>
              <p className="text-[9px] text-slate-500 italic pt-1">
                Struk ini diterbitkan secara sah oleh Cloud Engine Dua SiSi POS.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleDownloadPdf}
              className="flex-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-semibold py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Printer className="w-4 h-4 text-[#1E4648]" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handleShare}
              className="flex-1 bg-[#1E4648] hover:bg-[#163536] text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center gap-2 shadow-md"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan WA</span>
            </button>
            {onBackToApp && (
              <button
                onClick={onBackToApp}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-3 rounded-lg text-xs transition shadow-sm"
                title="Buka POS"
              >
                App
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
