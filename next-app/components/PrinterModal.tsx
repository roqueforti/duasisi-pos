'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Send,
  Download,
  QrCode,
  Sparkles,
  Scissors
} from 'lucide-react';
import { Transaksi } from '@/lib/types';
import { generateWhatsAppReceiptFromTx } from '@/lib/whatsappUtils';
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
import { maskPhone, formatWaPhone, formatDateTime } from '@/lib/utils';
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
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [btSupported, setBtSupported] = useState(true);
  const [poinRate, setPoinRate] = useState(10000);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  // Fallback sample transaction for previewing printer test mode
  const sampleTx: Transaksi = {
    noNota: 'NOTA-SAMPLE-01',
    tanggal: new Date().toLocaleDateString('id-ID') + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    namaPelanggan: 'Pelanggan Sample',
    noHp: '081234567890',
    petugas: 'Kasir 1',
    tipe: 'FullService',
    tingkatLayanan: 'Reguler',
    total: 35000,
    metodeBayar: 'Tunai',
    statusPembayaran: 'Lunas',
    status: 'Diterima',
    items: [
      { layanan: 'Cuci Kering Setrika 5 Kg', qty: 5, hargaSatuan: 6000, subtotal: 30000 } as any,
      { layanan: 'Parfum Premium Floral', qty: 1, hargaSatuan: 5000, subtotal: 5000 } as any
    ] as any
  };

  const activeTx = tx || sampleTx;

  useEffect(() => {
    if (isOpen) {
      setBtSupported(isBluetoothSupported());
      setDeviceInfo(getActiveDeviceInfo());
      setErrorMsg(null);
      setSuccessMsg(null);
      setSelectedPrintType(initialPrintType);
      
      runBackend<{ rate: number }>('getPoinConfig')
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
      setSuccessMsg('Tes print thermal berhasil dikirim!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal tes print thermal.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintThermal = async () => {
    if (!activeTx) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (!deviceInfo.connected) {
        const info = await requestAndConnectBluetoothDevice();
        setDeviceInfo(info);
      }
      const data = selectedPrintType === 'label'
        ? generateTagEscPos(activeTx)
        : generateReceiptEscPos(activeTx, poinRate);
      await sendRawEscPosData(data);
      setSuccessMsg(selectedPrintType === 'label'
        ? 'Label tag cucian berhasil dicetak!'
        : 'Struk transaksi berhasil dicetak!');
      
      // Log Activity to Audit Trail
      runBackend(
        'logClientActivity', 
        activeTx.petugas || 'Kasir', 
        selectedPrintType === 'label' ? 'Cetak Label' : 'Cetak Struk', 
        activeTx.noNota, 
        '-', 
        `Mode: Thermal ESC/POS (${paperWidth})`, 
        `Cetak ${selectedPrintType === 'label' ? 'label pakaian' : 'struk pembayaran'} nota ${activeTx.noNota} (${activeTx.namaPelanggan})`
      ).catch(() => {});

      onPrintSuccess?.();
      setTimeout(onClose, 1200);
    } catch (err: any) {
      if (err.message?.includes('cancelled') || err.message?.includes('User cancelled')) {
        setErrorMsg('Cetak dibatalkan.');
      } else {
        setErrorMsg(err.message || 'Gagal mencetak thermal.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserPrint = () => {
    if (activeTx) {
      runBackend(
        'logClientActivity', 
        activeTx.petugas || 'Kasir', 
        'Cetak Struk', 
        activeTx.noNota, 
        '-', 
        `Mode: Browser Print (${paperWidth})`, 
        `Cetak browser struk nota ${activeTx.noNota} (${activeTx.namaPelanggan})`
      ).catch(() => {});
    }
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!activeTx) return;
    const rawPhone = formatWaPhone(activeTx.noHp);
    const msg = generateWhatsAppReceiptFromTx(activeTx);

    runBackend(
      'logClientActivity', 
      activeTx.petugas || 'Kasir', 
      'Kirim Struk WA', 
      activeTx.noNota, 
      '-', 
      `No WhatsApp: ${rawPhone || '-'}`, 
      `Kirim struk digital WhatsApp untuk nota ${activeTx.noNota} ke ${activeTx.namaPelanggan}`
    ).catch(() => {});

    window.open(`https://wa.me/${rawPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:block">
      
      {/* Dynamic Thermal Print Styles for Browser Print */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: ${paperWidth === '58mm' ? '58mm auto' : '80mm auto'}; margin: 0; }
          body { margin: 0; padding: 0; background: #fff !important; }
          .thermal-preview-paper { 
            width: ${paperWidth === '58mm' ? '58mm' : '80mm'} !important; 
            max-width: 100% !important; 
            box-shadow: none !important; 
            border: none !important; 
            padding: 4mm !important;
            margin: 0 auto !important;
          }
          .non-print-area { display: none !important; }
        }
      `}} />

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 my-auto flex flex-col max-h-[94vh] non-print-area">
        
        {/* Top Header */}
        <div className="bg-[#1E4648] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Printer className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Preview & Cetak Nota Thermal</h3>
              <p className="text-[11px] text-teal-200/80">Lihat tampilan fisik kertas struk atau label tag sebelum dicetak</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 2 Columns (Left: Thermal Paper Preview, Right: Options & Printer BT Connection) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50">
          
          {/* ================= LEFT COLUMN: REALISTIC THERMAL PREVIEW ================= */}
          <div className="md:col-span-7 flex flex-col items-center">
            
            {/* View Selector Controls (Struk vs Label & Width) */}
            <div className="w-full flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedPrintType('struk')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                    selectedPrintType === 'struk'
                      ? 'bg-[#1E4648] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Struk Transaksi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPrintType('label')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                    selectedPrintType === 'label'
                      ? 'bg-[#FF9500] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Label Tag Cucian</span>
                </button>
              </div>

              {selectedPrintType === 'struk' && (
                <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPaperWidth('58mm')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      paperWidth === '58mm' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    58 mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperWidth('80mm')}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      paperWidth === '80mm' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    80 mm
                  </button>
                </div>
              )}
            </div>

            {/* Visual Paper Container with drop-shadow & jagged edge */}
            <div className="w-full flex justify-center py-2 overflow-x-auto">
              <div
                ref={receiptPrintRef}
                style={{ width: paperWidth === '58mm' ? '280px' : '340px' }}
                className="thermal-preview-paper bg-white p-5 rounded-2xl shadow-xl border border-slate-200/90 font-mono text-[11px] leading-tight text-slate-800 space-y-2 select-text transition-all duration-200"
              >
                {selectedPrintType === 'struk' ? (
                  /* ================= STRUK BUKTI PEMBAYARAN ================= */
                  <>
                    {/* Header */}
                    <div className="text-center space-y-1">
                      <div className="font-extrabold text-sm tracking-wider text-slate-900">DUA SISI LAUNDRY</div>
                      <div className="text-[10px] text-slate-500 font-sans font-medium">EXPRESS & COIN SELF SERVICE</div>
                      <div className="text-[10px] text-slate-500">Jl. Pandanwangi, Malang</div>
                      <div className="text-[10px] text-slate-500">WA: 0812-3456-7890</div>
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Metadata Nota */}
                    <div className="text-[10px] space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500">No. Nota</span>
                        <span className="font-bold text-slate-900">{activeTx.noNota}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Waktu</span>
                        <span className="text-slate-700">{formatDateTime(activeTx.tanggal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pelanggan</span>
                        <span className="font-bold text-slate-900">{activeTx.namaPelanggan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">No. HP</span>
                        <span className="text-slate-700">{maskPhone(activeTx.noHp)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kasir</span>
                        <span className="text-slate-700">{activeTx.petugas || 'Kasir 1'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Layanan</span>
                        <span className="font-semibold text-slate-800">
                          {activeTx.tipe === 'FullService' ? 'Drop Off' : 'Self Service'} ({activeTx.tingkatLayanan || 'Reguler'})
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Item List */}
                    <div className="space-y-1.5 text-[10px]">
                      {(activeTx.items && activeTx.items.length > 0 ? activeTx.items : [
                        { layanan: 'Layanan Laundry', qty: 1, hargaSatuan: activeTx.total, subtotal: activeTx.total } as any
                      ]).map((item: any, idx: number) => {
                        const qty = Number(item.qty) || 1;
                        const harga = Number(item.hargaSatuan) || 0;
                        const sub = Number(item.subtotal || qty * harga);
                        return (
                          <div key={idx} className="space-y-0.5">
                            <div className="font-bold text-slate-900">{item.layanan || item.nama}</div>
                            <div className="flex justify-between text-slate-600 pl-2">
                              <span>{qty} x Rp {harga.toLocaleString('id-ID')}</span>
                              <span className="font-semibold">Rp {sub.toLocaleString('id-ID')}</span>
                            </div>
                            {item.catatan && (
                              <div className="text-[9px] text-slate-400 italic pl-2">*{item.catatan}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Calculation Summary */}
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span>Rp {(activeTx.subtotal || activeTx.total).toLocaleString('id-ID')}</span>
                      </div>
                      {Boolean(activeTx.diskon && activeTx.diskon > 0) && (
                        <div className="flex justify-between text-emerald-700 font-semibold">
                          <span>Diskon Promo</span>
                          <span>- Rp {(activeTx.diskon || 0).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300 text-slate-900">
                        <span>TOTAL</span>
                        <span>Rp {(activeTx.total || 0).toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Metode Bayar</span>
                        <span className="font-semibold">{activeTx.metodeBayar || 'Tunai'}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Status Bayar</span>
                        <span className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                          activeTx.statusPembayaran === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {activeTx.statusPembayaran || 'Lunas'}
                        </span>
                      </div>
                      {Boolean(activeTx.sisaTagihan && activeTx.sisaTagihan > 0) && (
                        <div className="flex justify-between font-bold text-rose-600 pt-0.5">
                          <span>SISA TAGIHAN</span>
                          <span>Rp {(activeTx.sisaTagihan || 0).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-dashed border-slate-400 my-2" />

                    {/* Footer Instructions */}
                    <div className="text-center space-y-1 text-[9px] text-slate-500 pt-1">
                      <div className="font-bold text-slate-700">*** TERIMA KASIH ***</div>
                      <p>Simpan struk ini sebagai bukti resmi pengambilan pakaian Anda.</p>
                      <p>Komplain maksimal 1x24 jam dengan membawa nota resmi.</p>
                      <div className="pt-1 text-[8px] text-slate-400">Printed via Dua SiSi POS Cloud</div>
                    </div>
                  </>
                ) : (
                  /* ================= LABEL TAG PENANDA CUCIAN ================= */
                  <>
                    <div className="text-center space-y-1 border-b border-dashed border-slate-400 pb-2">
                      <div className="font-black text-xs tracking-wider text-slate-900 bg-amber-100 py-1 rounded-lg">
                        🏷️ LABEL TAG PENANDA CUCIAN
                      </div>
                      <div className="font-extrabold text-sm text-slate-900 pt-1 font-mono">
                        {activeTx.noNota}
                      </div>
                    </div>

                    <div className="space-y-1 text-[10px] py-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pelanggan:</span>
                        <span className="font-black text-slate-900 text-xs">{activeTx.namaPelanggan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">No. HP:</span>
                        <span className="font-bold text-slate-800">{activeTx.noHp || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tipe / Speed:</span>
                        <span className="font-bold text-teal-800">
                          {activeTx.tipe === 'FullService' ? 'Drop Off' : 'Self Service'} - {activeTx.tingkatLayanan || 'Reguler'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Waktu Masuk:</span>
                        <span className="text-slate-700">{formatDateTime(activeTx.tanggal)}</span>
                      </div>
                    </div>

                    {/* Checklist Pengerjaan Staff */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[10px] space-y-1.5 my-2">
                      <div className="font-bold text-slate-700 uppercase tracking-wider text-[9px] border-b border-slate-200 pb-1">
                        Checklist Tahap Pengerjaan:
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 border border-slate-400 rounded-sm inline-block shrink-0" />
                          <span>1. Dicuci</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 border border-slate-400 rounded-sm inline-block shrink-0" />
                          <span>2. Dikeringkan</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 border border-slate-400 rounded-sm inline-block shrink-0" />
                          <span>3. Disetrika</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 border border-slate-400 rounded-sm inline-block shrink-0" />
                          <span>4. Siap Ambil</span>
                        </div>
                      </div>
                    </div>

                    {activeTx.catatan && (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[10px]">
                        <strong className="text-amber-900">Catatan Khusus:</strong>
                        <p className="text-amber-800 mt-0.5">{activeTx.catatan}</p>
                      </div>
                    )}

                    <div className="text-center text-[9px] text-slate-400 border-t border-dashed border-slate-400 pt-2">
                      Tempelkan label ini pada keranjang / plastik pakaian pelanggan
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ================= RIGHT COLUMN: PRINTER CONTROLS & SETTINGS ================= */}
          <div className="md:col-span-5 space-y-4 flex flex-col justify-between">
            
            <div className="space-y-4">
              {/* Alert Messages */}
              {errorMsg && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 text-teal-800 text-xs flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Bluetooth Printer Status Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                deviceInfo.connected ? 'bg-teal-50/60 border-teal-200' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Koneksi Thermal</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    deviceInfo.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${deviceInfo.connected ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                    <span>{deviceInfo.connected ? 'Terhubung' : 'Belum Ada'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    deviceInfo.connected ? 'bg-[#1E4648] text-white shadow-xs' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {deviceInfo.connected ? <Bluetooth className="w-5 h-5" /> : <BluetoothOff className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-xs truncate">{deviceInfo.name}</h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {deviceInfo.connected ? 'Printer Bluetooth Siap Cetak' : 'Klik tombol hubungkan di bawah'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {btSupported && (
                    <button
                      onClick={handleConnect}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold px-3 py-2 rounded-xl transition disabled:opacity-50 shadow-2xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>{deviceInfo.connected ? 'Scan Ulang BT' : 'Scan & Hubungkan BT'}</span>
                    </button>
                  )}
                  {deviceInfo.connected && (
                    <button
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition border border-rose-200"
                    >
                      Putus
                    </button>
                  )}
                </div>
              </div>

              {/* Action: Send WhatsApp Receipt */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Kirim Bukti Digital
                </div>
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="w-full flex items-center justify-center gap-2 bg-[#1E4648] hover:bg-[#163536] text-white text-xs font-bold py-2.5 rounded-xl transition shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Struk ke WhatsApp Pelanggan</span>
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="space-y-2 pt-4 border-t border-slate-200">
              <button
                onClick={handlePrintThermal}
                disabled={loading || !btSupported}
                className="w-full flex items-center justify-center gap-2 bg-[#1E4648] hover:bg-[#163536] disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl shadow-md transition"
              >
                <Printer className="w-4 h-4" />
                <span>{loading ? 'Mencetak…' : selectedPrintType === 'label' ? '🖨️ Cetak Thermal Label Tag' : '🖨️ Cetak Thermal Struk'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleBrowserPrint}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 rounded-xl transition border border-slate-200"
                  title="Cetak via dialog browser / simpan PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Cetak / PDF</span>
                </button>
                <button
                  onClick={handleTestPrint}
                  disabled={loading || !deviceInfo.connected}
                  className="flex-1 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition border border-slate-200 disabled:opacity-40"
                >
                  Tes Printer
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
