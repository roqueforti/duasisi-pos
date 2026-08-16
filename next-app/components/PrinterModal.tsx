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
import { runBackend } from '@/lib/api';

export type PrintType = 'struk' | 'label';

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
  printType: initialPrintType = 'struk',
  onPrintSuccess,
}: PrinterModalProps) {
  const [deviceInfo, setDeviceInfo] = useState<BluetoothDeviceInfo>({
    id: '',
    name: 'Belum Ada Device',
    connected: false,
  });
  const [selectedPrintType, setSelectedPrintType] = useState<PrintType>(initialPrintType);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [btSupported, setBtSupported] = useState(true);
  const [poinRate, setPoinRate] = useState(10000);

  useEffect(() => {
    if (isOpen) {
      setBtSupported(isBluetoothSupported());
      setDeviceInfo(getActiveDeviceInfo());
      setErrorMsg(null);
      setSuccessMsg(null);
      setSelectedPrintType(initialPrintType);
      
      runBackend<{rate: number}>('getPoinConfig')
        .then(res => { if (res && res.rate) setPoinRate(res.rate); })
        .catch(() => {});
    }
  }, [isOpen, initialPrintType]);

  const handleConnect = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const info = await requestAndConnectBluetoothDevice();
      setDeviceInfo(info);
      setSuccessMsg(`Terhubung ke ${info.name}`);
    } catch (err: any) {
      if (!err.message?.includes('cancelled') && !err.message?.includes('User cancelled')) {
        setErrorMsg(err.message || 'Gagal menghubungkan printer.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectBluetoothDevice();
      setDeviceInfo(getActiveDeviceInfo());
      setSuccessMsg('Printer diputuskan.');
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
      if (!deviceInfo.connected) await requestAndConnectBluetoothDevice();
      await sendRawEscPosData(generateTestPrintEscPos());
      setSuccessMsg('Tes print berhasil!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal tes print.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!tx) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (!deviceInfo.connected) {
        const info = await requestAndConnectBluetoothDevice();
        setDeviceInfo(info);
      }
      const data = selectedPrintType === 'label'
        ? generateTagEscPos(tx)
        : generateReceiptEscPos(tx, poinRate);
      await sendRawEscPosData(data);
      setSuccessMsg(selectedPrintType === 'label'
        ? 'Label tag berhasil dicetak!'
        : 'Struk berhasil dicetak!');
      onPrintSuccess?.();
      setTimeout(onClose, 1200);
    } catch (err: any) {
      if (err.message?.includes('cancelled') || err.message?.includes('User cancelled')) {
        setErrorMsg('Cetak dibatalkan.');
      } else {
        setErrorMsg(err.message || 'Gagal mencetak.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm overflow-hidden border border-slate-100">

        {/* Header */}
        <div className="bg-[#1E4648] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Printer className="w-5 h-5 text-[#B5C9C9]" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Cetak Thermal</h3>
              <p className="text-[11px] text-[#B5C9C9]">Bluetooth Printer</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition">
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-lg bg-[#B5C9C9]/20 border border-[#B5C9C9] text-[#1E4648] text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* BT not supported */}
          {!btSupported && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
              Browser tidak mendukung Web Bluetooth. Gunakan Chrome atau Edge.
            </div>
          )}

          {/* Koneksi Printer */}
          <div className={`p-4 rounded-lg border ${deviceInfo.connected ? 'bg-[#B5C9C9]/10 border-[#B5C9C9]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Printer</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${deviceInfo.connected ? 'bg-[#B5C9C9]/30 text-[#1E4648]' : 'bg-slate-200 text-slate-500'}`}>
                {deviceInfo.connected ? '● Terhubung' : '○ Belum Terhubung'}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2.5 rounded-lg ${deviceInfo.connected ? 'bg-[#1E4648] text-white' : 'bg-slate-200 text-slate-500'}`}>
                {deviceInfo.connected ? <Bluetooth className="w-5 h-5" /> : <BluetoothOff className="w-5 h-5" />}
              </div>
              <div>
                <div className="font-bold text-slate-700 text-sm">{deviceInfo.name}</div>
                <div className="text-[11px] text-slate-500">
                  {deviceInfo.connected ? 'Siap mencetak' : 'Hubungkan printer thermal'}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {btSupported && (
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{deviceInfo.connected ? 'Ganti / Ulang' : 'Hubungkan Printer'}</span>
                </button>
              )}
              {deviceInfo.connected && (
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold transition"
                >
                  Putuskan
                </button>
              )}
            </div>
          </div>

          {/* Pilih Dokumen */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Dokumen</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedPrintType('struk')}
                className={`p-3 rounded-lg border text-left transition ${
                  selectedPrintType === 'struk'
                    ? 'border-[#1E4648] bg-[#B5C9C9]/10 ring-1 ring-[#1E4648]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <FileText className={`w-4 h-4 mb-1 ${selectedPrintType === 'struk' ? 'text-[#1E4648]' : 'text-slate-500'}`} />
                <div className={`font-bold text-xs ${selectedPrintType === 'struk' ? 'text-[#1E4648]' : 'text-slate-600'}`}>Struk</div>
                <div className="text-[10px] text-slate-400">Bukti pembayaran</div>
              </button>

              <button
                onClick={() => setSelectedPrintType('label')}
                className={`p-3 rounded-lg border text-left transition ${
                  selectedPrintType === 'label'
                    ? 'border-[#FF9500] bg-[#FF9500]/5 ring-1 ring-[#FF9500]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <Tag className={`w-4 h-4 mb-1 ${selectedPrintType === 'label' ? 'text-[#FF9500]' : 'text-slate-500'}`} />
                <div className={`font-bold text-xs ${selectedPrintType === 'label' ? 'text-[#FF9500]' : 'text-slate-600'}`}>Label Tag</div>
                <div className="text-[10px] text-slate-400">Penanda cucian</div>
              </button>
            </div>
          </div>

          {/* Preview transaksi */}
          {tx && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600 flex items-center gap-1">
                  {selectedPrintType === 'label'
                    ? <Tag className="w-3.5 h-3.5 text-[#FF9500]" />
                    : <FileText className="w-3.5 h-3.5 text-[#1E4648]" />}
                  {selectedPrintType === 'label' ? 'Label Tag Cucian' : 'Struk Transaksi'}
                </span>
                <span className="font-mono font-bold text-slate-700">{tx.noNota}</span>
              </div>
              <div className="text-slate-500">Pelanggan: <span className="font-semibold text-slate-700">{tx.namaPelanggan}</span></div>
              <div className="text-slate-500">Kasir: <span className="font-semibold text-slate-700">{tx.petugas || '-'}</span></div>
              <div className="text-slate-500">Total: <span className="font-bold text-[#1E4648]">Rp {(tx.total || 0).toLocaleString('id-ID')}</span></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between gap-2">
          <button
            onClick={handleTestPrint}
            disabled={loading || !deviceInfo.connected}
            className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-40"
          >
            Tes Print
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Batal
            </button>
            {tx && (
              <button
                onClick={handlePrint}
                disabled={loading || !btSupported}
                className="flex items-center gap-1.5 bg-[#1E4648] hover:bg-[#163536] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition"
              >
                <Printer className="w-4 h-4" />
                <span>{loading ? 'Mencetak…' : selectedPrintType === 'label' ? 'Cetak Label' : 'Cetak Struk'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
