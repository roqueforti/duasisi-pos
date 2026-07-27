import { Transaksi } from './types';

// Helper Web Bluetooth Thermal Printer & ESC/POS Command Encoder

let activeBluetoothDevice: any = null;
let activeGattServer: any = null;
let activeWriteCharacteristic: any = null;

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
}

const COMMON_PRINTER_SERVICES = [
  '49535343-fe7d-434e-875f-44d3735e805d', // ISSC Transparent Service (Most 58mm/80mm Bluetooth Printers)
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '0000ff00-0000-1000-8000-00805f9b34fb', // Custom ESC/POS Service
  '0000e7e0-0000-1000-8000-00805f9b34fb', // SPP GATT Service
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile
];

export function isBluetoothSupported(): boolean {
  return typeof window !== 'undefined' && 'navigator' in window && 'bluetooth' in window.navigator;
}

export function getSavedPrinterInfo(): BluetoothDeviceInfo | null {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem('duasisi_bt_printer');
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch (e) {
    return null;
  }
}

export function savePrinterInfo(info: BluetoothDeviceInfo | null) {
  if (typeof window === 'undefined') return;
  if (info) {
    localStorage.setItem('duasisi_bt_printer', JSON.stringify(info));
  } else {
    localStorage.removeItem('duasisi_bt_printer');
  }
}

export function getActiveDeviceInfo(): BluetoothDeviceInfo {
  const saved = getSavedPrinterInfo();
  const isConnected = !!(activeGattServer && activeGattServer.connected && activeWriteCharacteristic);
  return {
    id: activeBluetoothDevice?.id || saved?.id || '',
    name: activeBluetoothDevice?.name || saved?.name || 'Printer Bluetooth (Belum Dipilih)',
    connected: isConnected,
  };
}

export async function requestAndConnectBluetoothDevice(): Promise<BluetoothDeviceInfo> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth API tidak didukung di browser ini. Gunakan Google Chrome, MS Edge, atau Opera.');
  }

  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: COMMON_PRINTER_SERVICES,
  });

  if (!device) {
    throw new Error('Tidak ada device yang dipilih.');
  }

  activeBluetoothDevice = device;

  // Listen disconnect
  device.addEventListener('gattserverdisconnected', () => {
    console.log('Bluetooth device disconnected');
    activeGattServer = null;
    activeWriteCharacteristic = null;
  });

  const connectedInfo = await connectToGatt(device);
  savePrinterInfo(connectedInfo);
  return connectedInfo;
}

export async function connectToGatt(device: any): Promise<BluetoothDeviceInfo> {
  if (!device || !device.gatt) {
    throw new Error('Device Bluetooth tidak memiliki GATT Server.');
  }

  const server = await device.gatt.connect();
  activeGattServer = server;

  // Search through services & characteristics for writable one
  let writeChar: any = null;

  // Try standard primary services
  const services = await server.getPrimaryServices().catch(() => []);
  for (const service of services) {
    const characteristics = await service.getCharacteristics().catch(() => []);
    for (const char of characteristics) {
      if (char.properties.write || char.properties.writeWithoutResponse) {
        writeChar = char;
        break;
      }
    }
    if (writeChar) break;
  }

  if (!writeChar) {
    throw new Error('Gagal menemukan Write Characteristic pada device printer Bluetooth ini.');
  }

  activeWriteCharacteristic = writeChar;

  const info: BluetoothDeviceInfo = {
    id: device.id,
    name: device.name || 'Thermal Printer',
    connected: true,
  };

  return info;
}

export async function disconnectBluetoothDevice() {
  if (activeGattServer && activeGattServer.connected) {
    activeGattServer.disconnect();
  }
  activeBluetoothDevice = null;
  activeGattServer = null;
  activeWriteCharacteristic = null;
  savePrinterInfo(null);
}

export async function sendRawEscPosData(data: Uint8Array): Promise<boolean> {
  if (!activeGattServer || !activeGattServer.connected || !activeWriteCharacteristic) {
    const saved = getSavedPrinterInfo();
    if (activeBluetoothDevice) {
      await connectToGatt(activeBluetoothDevice);
    } else if (saved) {
      throw new Error('Koneksi Bluetooth terputus. Silakan hubungkan ulang device printer Bluetooth.');
    } else {
      throw new Error('Belum ada printer Bluetooth yang terhubung.');
    }
  }

  // Send chunks (max 512 bytes per write)
  const chunkSize = 100;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    if (activeWriteCharacteristic.properties.writeWithoutResponse) {
      await activeWriteCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await activeWriteCharacteristic.writeValue(chunk);
    }
    // Small delay between chunks
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return true;
}

// -------------------------------------------------------------
// ESC/POS Command Encoder Helper (58mm / 80mm Thermal Printers)
// -------------------------------------------------------------

class EscPosBuilder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  private init() {
    // ESC @ (Initialize printer)
    this.buffer.push(0x1b, 0x40);
  }

  align(align: 'left' | 'center' | 'right'): EscPosBuilder {
    const n = align === 'left' ? 0 : align === 'center' ? 1 : 2;
    this.buffer.push(0x1b, 0x61, n);
    return this;
  }

  bold(enable: boolean): EscPosBuilder {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  size(widthMultiplier: number = 1, heightMultiplier: number = 1): EscPosBuilder {
    const w = Math.min(Math.max(widthMultiplier - 1, 0), 7);
    const h = Math.min(Math.max(heightMultiplier - 1, 0), 7);
    const n = (w << 4) | h;
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  text(str: string): EscPosBuilder {
    // Basic ASCII conversion with fallback
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      if (code > 255) code = 63; // '?'
      this.buffer.push(code);
    }
    return this;
  }

  line(str: string = ''): EscPosBuilder {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  dashedLine(width: number = 32): EscPosBuilder {
    this.line('-'.repeat(width));
    return this;
  }

  doubleDashedLine(width: number = 32): EscPosBuilder {
    this.line('='.repeat(width));
    return this;
  }

  twoColumn(left: string, right: string, width: number = 32): EscPosBuilder {
    const rightLen = right.length;
    const availableLeft = width - rightLen - 1;
    let truncatedLeft = left;
    if (left.length > availableLeft) {
      truncatedLeft = left.substring(0, availableLeft);
    }
    const spaces = width - truncatedLeft.length - rightLen;
    const spaceStr = ' '.repeat(Math.max(1, spaces));
    this.line(truncatedLeft + spaceStr + right);
    return this;
  }

  feedLines(lines: number = 3): EscPosBuilder {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  cut(): EscPosBuilder {
    this.feedLines(3);
    // GS V 66 0 (Partial cut)
    this.buffer.push(0x1d, 0x56, 0x42, 0x00);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export function generateReceiptEscPos(tx: Transaksi): Uint8Array {
  const builder = new EscPosBuilder();

  builder
    .align('center')
    .bold(true)
    .size(2, 2)
    .line('DUA SISI LAUNDRY')
    .size(1, 1)
    .bold(false)
    .line('Express & Coin Laundry')
    .line('Jl. Nota Resmi Dua SiSi POS')
    .dashedLine(32)
    .align('left')
    .twoColumn('No Nota:', tx.noNota, 32)
    .twoColumn('Tanggal:', tx.tanggal, 32)
    .twoColumn('Pelanggan:', tx.namaPelanggan.substring(0, 16), 32);

  if (tx.noHp) {
    builder.twoColumn('No HP:', tx.noHp, 32);
  }

  builder
    .twoColumn('Layanan:', tx.tingkatLayanan || 'Reguler', 32)
    .twoColumn('Kasir:', tx.petugas || 'Staff', 32)
    .dashedLine(32);

  tx.items.forEach((item) => {
    builder.bold(true).line(item.layanan).bold(false);
    const qtyPrice = `${item.qty} x Rp ${item.hargaSatuan.toLocaleString('id-ID')}`;
    const totalItem = `Rp ${(item.qty * item.hargaSatuan).toLocaleString('id-ID')}`;
    builder.twoColumn(`  ${qtyPrice}`, totalItem, 32);
    if (item.catatan) {
      builder.line(`  *Note: ${item.catatan}`);
    }
  });

  builder.dashedLine(32);

  if (tx.diskon && tx.diskon > 0) {
    builder.twoColumn('Diskon:', `-Rp ${tx.diskon.toLocaleString('id-ID')}`, 32);
  }

  builder
    .bold(true)
    .size(1, 2)
    .twoColumn('TOTAL:', `Rp ${tx.total.toLocaleString('id-ID')}`, 32)
    .size(1, 1)
    .bold(false);

  if (tx.nominalDP && tx.nominalDP > 0) {
    builder.twoColumn('DP Dibayar:', `Rp ${tx.nominalDP.toLocaleString('id-ID')}`, 32);
    builder.bold(true).twoColumn('Sisa Tagihan:', `Rp ${(tx.sisaTagihan || 0).toLocaleString('id-ID')}`, 32).bold(false);
  }

  builder
    .twoColumn('Metode Bayar:', tx.metodeBayar || 'Tunai', 32)
    .dashedLine(32)
    .align('center')
    .line('Terima Kasih atas Kunjungan Anda!')
    .line('Simpan Struk ini sebagai Bukti')
    .line('Pengambilan Laundry')
    .feedLines(4);

  return builder.build();
}

export function generateTagEscPos(tx: Transaksi): Uint8Array {
  const builder = new EscPosBuilder();

  tx.items.forEach((item, idx) => {
    builder
      .align('center')
      .bold(true)
      .size(2, 2)
      .line('DUA SISI LAUNDRY')
      .size(1, 1)
      .line(`ORDER TAG #${idx + 1} OF ${tx.items.length}`)
      .dashedLine(32)
      .align('left')
      .bold(true)
      .twoColumn('NOTA:', tx.noNota, 32)
      .twoColumn('NAMA:', tx.namaPelanggan.toUpperCase().substring(0, 16), 32)
      .bold(false)
      .line(`ITEM: ${item.layanan}`)
      .line(`QTY : ${item.qty}`)
      .line(`PROSES: ${tx.tingkatLayanan || 'Reguler'}`);

    if (tx.catatan || item.catatan) {
      builder.line(`NOTE: ${item.catatan || tx.catatan}`);
    }

    builder
      .twoColumn('TGL:', tx.tanggal.substring(0, 10), 32)
      .dashedLine(32)
      .feedLines(3);
  });

  return builder.build();
}

export function generateTestPrintEscPos(): Uint8Array {
  const builder = new EscPosBuilder();
  builder
    .align('center')
    .bold(true)
    .size(2, 2)
    .line('TES PRINTER')
    .size(1, 1)
    .bold(false)
    .line('Dua SiSi POS Bluetooth Thermal')
    .doubleDashedLine(32)
    .align('left')
    .line('Status: Bluetooth Connected OK')
    .line(`Waktu : ${new Date().toLocaleTimeString('id-ID')}`)
    .dashedLine(32)
    .align('center')
    .line('Printer Thermal Siap Digunakan!')
    .feedLines(4);
  return builder.build();
}
