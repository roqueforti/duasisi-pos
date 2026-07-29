'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Bluetooth,
  BluetoothOff,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  X,
  FileText,
  Tag,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { Transaksi } from '@/lib/types';
import {
  isBluetoothSupported,
  getActiveDeviceInfo,
  requestAndConnectBluetoothDevice,
  disconnectBluetoothDevice,
  sendRawEscPosData,
  generateReceiptEscPos,
  generateTagEscPos,
  generateTestPrintEscPos,
  BluetoothDeviceInfo,
} from '@/lib/bluetoothPrinter';

export type PrintType = 'struk' | 'label' | 'test' | 'config';
export type PrintMode = 'thermal' | 'system';

interface PrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  tx?: Transaksi | null;
  printType?: PrintType;
  onPrintSuccess?: () => void;
}

export default function PrinterModal({
  isOpen,
  onClose,
  tx,
  printType = 'config',
  onPrintSuccess,
}: PrinterModalProps) {
  const [deviceInfo, setDeviceInfo] = useState<BluetoothDeviceInfo>({
    id: '',
    name: 'Belum Ada Device',
    connected: false,
  });
  const [printMode, setPrintMode] = useState<PrintMode>('thermal');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [btSupported, setBtSupported] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setBtSupported(isBluetoothSupported());
      refreshStatus();

      // Read saved print mode preference
      const savedMode = localStorage.getItem('duasisi_print_mode') as PrintMode;
      if (savedMode === 'system' || savedMode === 'thermal') {
        setPrintMode(savedMode);
      }
    }
  }, [isOpen]);

  const refreshStatus = () => {
    const info = getActiveDeviceInfo();
    setDeviceInfo(info);
  };

  const handleModeChange = (mode: PrintMode) => {
    setPrintMode(mode);
    localStorage.setItem('duasisi_print_mode', mode);
  };

  const handleConnectBluetooth = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const info = await requestAndConnectBluetoothDevice();
      setDeviceInfo(info);
      setSuccessMsg(`Berhasil terhubung ke printer ${info.name}!`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menghubungkan printer Bluetooth.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await disconnectBluetoothDevice();
      refreshStatus();
      setSuccessMsg('Koneksi Bluetooth printer telah diputuskan.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memutuskan koneksi.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (printMode === 'thermal') {
        const testData = generateTestPrintEscPos();
        await sendRawEscPosData(testData);
        setSuccessMsg('Struk tes print berhasil dikirim ke Bluetooth Thermal Printer!');
      } else {
        // System print test fallback
        const printWindow = window.open('', '_blank', 'width=350,height=400');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Tes Print Dua SiSi POS</title>
                <link rel="stylesheet" href="/duasisi-pos/globals.css" />
              </head>
              <body class="print-receipt-body print-receipt-header">
                <h2>DUA SISI LAUNDRY</h2>
                <p>--- TES PRINTER SYSTEM ---</p>
                <p>Status: OK</p>
                <script>window.onload = function() { window.print(); window.close(); }</script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal melakukan tes cetak.');
    } finally {
      setLoading(false);
    }
  };

  const executeSystemPrintReceipt = (transaction: Transaksi) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const itemsHtml = transaction.items
      .map(
        (i) => `
      <tr>
        <td class="print-receipt-cell-left">
          ${i.layanan}<br/>
          <span class="print-receipt-cell-sub">${i.qty} x Rp ${i.hargaSatuan.toLocaleString('id-ID')}</span>
          ${i.catatan ? `<br/><small class="print-receipt-cell-note">Catatan: ${i.catatan}</small>` : ''}
        </td>
        <td class="print-receipt-cell-right">Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Struk ${transaction.noNota}</title>
          <link rel="stylesheet" href="/duasisi-pos/globals.css" />
        </head>
        <body class="print-receipt-body">
          <div class="print-receipt-header">
            <h2>DUA SISI LAUNDRY</h2>
            <p>Express & Coin Laundry</p>
            <p>Nota: ${transaction.noNota}</p>
            <p>${transaction.tanggal}</p>
            <p>Kecepatan: <b>${transaction.tingkatLayanan || 'Reguler'}</b></p>
          </div>
          <div class="print-receipt-line"></div>
          <p>Pelanggan: <b>${transaction.namaPelanggan}</b> ${transaction.noHp ? `(${transaction.noHp})` : ''}</p>
          <div class="print-receipt-line"></div>
          <table class="print-receipt-table">${itemsHtml}</table>
          <div class="print-receipt-line"></div>
          ${transaction.diskon ? `<div class="print-receipt-text-right">Diskon: -Rp ${transaction.diskon.toLocaleString('id-ID')}</div>` : ''}
          <div class="print-receipt-total">TOTAL: Rp ${transaction.total.toLocaleString('id-ID')}</div>
          ${transaction.nominalDP ? `<div class="print-receipt-text-right-bold">DP Paid: Rp ${transaction.nominalDP.toLocaleString('id-ID')}</div><div class="print-receipt-text-red-bold">Sisa Tagihan: Rp ${(transaction.sisaTagihan || 0).toLocaleString('id-ID')}</div>` : ''}
          <div class="print-receipt-line"></div>
          <div class="print-receipt-footer">
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

  const executeSystemPrintTag = (transaction: Transaksi) => {
    const printWindow = window.open('', '_blank', 'width=350,height=400');
    if (!printWindow) return;

    const tagsHtml = transaction.items
      .map(
        (item, idx) => `
      <div class="print-tag-box">
        <div class="print-tag-title">DUA SISI LAUNDRY TAG</div>
        <div class="print-tag-subtitle">ORDER TAG #${idx + 1} OF ${transaction.items.length}</div>
        <hr class="print-tag-dashed"/>
        <div class="print-tag-nota">NOTA: ${transaction.noNota}</div>
        <div class="print-tag-nama">NAMA: ${transaction.namaPelanggan.toUpperCase()}</div>
        <div class="print-tag-item">ITEM: <b>${item.layanan}</b> (Qty: ${item.qty})</div>
        <div class="print-tag-proses">PROSES: ${transaction.tingkatLayanan || 'Reguler'}</div>
        ${transaction.catatan ? `<div class="print-tag-catatan">CATATAN: ${transaction.catatan}</div>` : ''}
        <hr class="print-tag-dashed"/>
        <div class="print-tag-tanggal">TGL MASUK: ${transaction.tanggal}</div>
      </div>
    `
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Tag Cucian - ${transaction.noNota}</title>
          <link rel="stylesheet" href="/duasisi-pos/globals.css" />
        </head>
        <body class="print-tag-body">
          ${tagsHtml}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExecutePrintAction = async () => {
    if (!tx) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (printMode === 'thermal') {
        if (!deviceInfo.connected) {
          // Attempt auto reconnect or prompt connect
          await handleConnectBluetooth();
        }

        if (printType === 'label') {
          const tagData = generateTagEscPos(tx);
          await sendRawEscPosData(tagData);
          setSuccessMsg('Label Tag Cucian berhasil dicetak ke Bluetooth Printer!');
        } else {
          const receiptData = generateReceiptEscPos(tx);
          await sendRawEscPosData(receiptData);
          setSuccessMsg('Struk Transaksi berhasil dicetak ke Bluetooth Printer!');
        }
      } else {
        // System Print Window
        if (printType === 'label') {
          executeSystemPrintTag(tx);
        } else {
          executeSystemPrintReceipt(tx);
        }
        setSuccessMsg('Jendela cetak system telah dibuka.');
      }

      if (onPrintSuccess) onPrintSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat mencetak.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-[#1E4648] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#B5C9C9]/200/20 rounded-lg text-[#B5C9C9]">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Pengecekan & Pemilihan Printer</h3>
              <p className="text-[11px] text-[#B5C9C9]">Koneksi Bluetooth Thermal Printer</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-[#B5C9C9]/20 border border-[#B5C9C9] text-[#1E4648] text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* Bluetooth Compatibility Warning */}
          {!btSupported && (
            <div className="p-3 bg-[#FF9500]/10 border border-[#FF9500]/30 rounded-lg text-[#FF9500] text-xs flex items-start gap-2">
              <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF9500]" />
              <div>
                Browser ini belum mendukung Web Bluetooth API. Anda dapat menggunakan mode <b>Printer System (Standard)</b> atau gunakan peramban Chrome / Edge.
              </div>
            </div>
          )}

          {/* Bluetooth Connection Status Card */}
          <div className={`p-4 rounded-lg border transition ${
            deviceInfo.connected
              ? 'bg-[#B5C9C9]/20/50 border-[#B5C9C9]'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Status Koneksi Printer
              </span>
              {deviceInfo.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#B5C9C9]/30 text-[#1E4648]">
                  <span className="w-2 h-2 rounded-full bg-[#B5C9C9]/200 animate-pulse" />
                  Terhubung
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Belum Terhubung
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${
                deviceInfo.connected ? 'bg-[#B5C9C9]/200 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {deviceInfo.connected ? <Bluetooth className="w-6 h-6" /> : <BluetoothOff className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-sm truncate">
                  {deviceInfo.name}
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {deviceInfo.connected ? 'Thermal Printer Siap Mencetak' : 'Silakan hubungkan printer bluetooth thermal'}
                </p>
              </div>
            </div>

            {/* Connection Actions */}
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-200/60">
              {btSupported && (
                <button
                  type="button"
                  onClick={handleConnectBluetooth}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{deviceInfo.connected ? 'Ganti / Hubungkan Ulang' : 'Pilih & Hubungkan Thermal Printer'}</span>
                </button>
              )}

              {deviceInfo.connected && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold transition"
                >
                  Putuskan
                </button>
              )}
            </div>
          </div>

          {/* Mode Cetak Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Pilih Mode Printer
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('thermal')}
                className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                  printMode === 'thermal'
                    ? 'border-[#1E4648] bg-[#B5C9C9]/20/40 text-[#1E4648] ring-1 ring-[#1E4648]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Zap className="w-4 h-4 text-[#1E4648]" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#B5C9C9]/30 text-[#1E4648]">Cepat</span>
                </div>
                <div>
                  <div className="font-bold text-xs">Bluetooth Thermal</div>
                  <div className="text-[10px] opacity-75">Direct ESC/POS 58mm/80mm</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('system')}
                className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                  printMode === 'system'
                    ? 'border-[#1E4648] bg-[#B5C9C9]/20/40 text-[#1E4648] ring-1 ring-[#1E4648]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Standard</span>
                </div>
                <div>
                  <div className="font-bold text-xs">Printer System</div>
                  <div className="text-[10px] opacity-75">Pop-up Browser / PDF</div>
                </div>
              </button>
            </div>
          </div>

          {/* Pending Print Job Preview if triggered with tx */}
          {tx && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  {printType === 'label' ? <Tag className="w-3.5 h-3.5 text-[#FF9500]" /> : <FileText className="w-3.5 h-3.5 text-[#1E4648]" />}
                  {printType === 'label' ? 'Dokumen Tag / Label Cucian' : 'Dokumen Struk Transaksi'}
                </span>
                <span className="text-[11px] font-sans font-bold text-slate-700">{tx.noNota}</span>
              </div>
              <div className="text-xs text-slate-600">
                Pelanggan: <span className="font-semibold text-slate-800">{tx.namaPelanggan}</span> ({tx.items?.length || 0} items)
              </div>
              <div className="text-xs text-slate-600">
                Total Transaksi: <span className="font-semibold text-[#1E4648]">Rp {tx.total?.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={loading}
            className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition"
          >
            Tes Print
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
            >
              Batal
            </button>

            {tx && (
              <button
                type="button"
                onClick={handleExecutePrintAction}
                disabled={loading || (printMode === 'thermal' && !deviceInfo.connected && !btSupported)}
                className="flex items-center gap-1.5 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{printType === 'label' ? 'Cetak Label Tag' : 'Cetak Struk Now'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
