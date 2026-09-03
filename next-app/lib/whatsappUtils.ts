import { Transaksi } from './types';
import { formatWaPhone, eNotaUrl as buildENotaUrl } from './utils';

export interface WhatsAppReceiptParams {
  noNota: string;
  namaPelanggan?: string;
  noHp?: string;
  tanggal?: string;
  kasir?: string;
  tipeLayanan?: string;
  tingkatLayanan?: string;
  estimasiSelesai?: string;
  items?: Array<{ layanan?: string; nama?: string; qty: number; hargaSatuan?: number; subtotal?: number }>;
  subtotal?: number;
  diskonNilai?: number;
  diskonKode?: string;
  total: number;
  metodeBayar?: string;
  kembalian?: number;
  sisaTagihan?: number;
  statusPembayaran?: string;
  isMember?: boolean;
  poinEarned?: number;
  saldoPoin?: number;
  token?: string;
  stampInfo?: {
    earned?: boolean;
    isClaimed?: boolean;
    cardType?: '75' | '45';
    stampsAdded?: number;
    newTotal?: number;
    isRewardReady?: boolean;
    rewardMessage?: string;
  };
}

/**
 * Standard WhatsApp Receipt Generator (Matching Dua SiSi Official POS Receipt)
 */
export function generateWhatsAppReceiptMessage(params: WhatsAppReceiptParams): string {
  const nama = params.namaPelanggan || 'Pelanggan';
  const noNota = params.noNota || '';
  const tanggal = params.tanggal || '';
  const kasir = params.kasir || 'Kasir';
  const totalNum = Number(params.total) || 0;
  const total = totalNum.toLocaleString('id-ID');
  const subtotalNum = params.subtotal !== undefined ? Number(params.subtotal) : totalNum;
  const subtotal = subtotalNum.toLocaleString('id-ID');
  const diskonNilai = Number(params.diskonNilai) || 0;
  const diskonKode = params.diskonKode || 'Promo';
  const poinEarned = Number(params.poinEarned) || 0;
  const saldoPoin = Number(params.saldoPoin) || 0;

  const isDropOff =
    params.tipeLayanan === 'FullService' ||
    (params.tipeLayanan as string) === 'DropOff' ||
    (params.tipeLayanan as string) === 'Drop Off' ||
    Boolean(params.tingkatLayanan);

  const isSelfService =
    params.tipeLayanan === 'SelfService' ||
    (params.tipeLayanan as string) === 'Self Service';

  const items = (params.items || []).map((i) => {
    const itemName = i.layanan || i.nama || 'Layanan Laundry';
    const itemQty = Number(i.qty) || 1;
    const itemPrice = i.subtotal !== undefined
      ? Number(i.subtotal)
      : (Number(i.hargaSatuan || 0) * itemQty);
    return `  • ${itemName} (x${itemQty}) = Rp ${itemPrice.toLocaleString('id-ID')}`;
  }).join('\n');

  const eNotaUrl = params.token
    ? `https://duasisilaundry-pos.vercel.app/?t=${params.token}`
    : buildENotaUrl(noNota);

  const msgLines: string[] = [
    `*DUA SISI LAUNDRY*`,
    `_Express & Self Service Laundry_`,
    `--------------------------------`,
    `Halo *${nama}*! Berikut rincian bukti transaksi Anda:`,
    ``,
    `*No. Nota*     : ${noNota}`,
    `*Tanggal*      : ${tanggal}`,
    `*Kasir/Staff*  : ${kasir}`,
  ];

  if (isDropOff) {
    msgLines.push(`*Layanan*      : Drop Off (Full Service)`);
    msgLines.push(`*Kecepatan*    : ${params.tingkatLayanan || 'Reguler'}`);
    if (params.estimasiSelesai) {
      msgLines.push(`*Estimasi Selesai*: ${params.estimasiSelesai}`);
    }
  } else if (isSelfService) {
    msgLines.push(`*Layanan*      : Self Service (Cuci / Kering Mandiri)`);
  } else {
    msgLines.push(`*Kategori*     : Penjualan Produk / Retail`);
  }

  msgLines.push(``);
  msgLines.push(`*Detail Layanan:*`);
  if (items) {
    msgLines.push(items);
  } else {
    msgLines.push(`  • Layanan Laundry (x1) = Rp ${total}`);
  }
  msgLines.push(`--------------------------------`);

  if (diskonNilai > 0) {
    msgLines.push(`Subtotal       : Rp ${subtotal}`);
    msgLines.push(`Diskon (${diskonKode}): -Rp ${diskonNilai.toLocaleString('id-ID')}`);
  }

  msgLines.push(`*TOTAL BAYAR   : Rp ${total}*`);
  msgLines.push(`Metode Bayar   : ${params.metodeBayar || 'Tunai'}`);

  if (params.metodeBayar === 'Tunai' && (params.kembalian || 0) > 0) {
    msgLines.push(`Kembalian      : Rp ${(params.kembalian || 0).toLocaleString('id-ID')}`);
  }

  if (params.sisaTagihan && params.sisaTagihan > 0) {
    msgLines.push(`Sisa Tagihan   : Rp ${params.sisaTagihan.toLocaleString('id-ID')}`);
    msgLines.push(`Status Bayar   : ${params.statusPembayaran || 'Belum Lunas'}`);
  }

  msgLines.push(`--------------------------------`);

  if (params.isMember || poinEarned > 0 || saldoPoin > 0) {
    if (poinEarned > 0) {
      msgLines.push(`  • *Poin Transaksi* : +${poinEarned} Poin`);
    }
    if (saldoPoin > 0) {
      msgLines.push(`  • *Total Saldo Poin*: ${saldoPoin} Poin`);
    }
    msgLines.push(`_(Tukarkan poin Anda dengan potongan harga/layanan gratis/produk di kasir!)_`);
    msgLines.push(`--------------------------------`);
  }

  if (params.stampInfo?.isClaimed) {
    const cardLbl = params.stampInfo.cardType === '75' ? '7 KG' : '4 KG';
    msgLines.push(`*KLAIM REWARD MEMBER:*`);
    msgLines.push(`  🎉 *1x Cuci Gratis ${cardLbl} Berhasil Diklaim!*`);
    msgLines.push(`  • Stempel kartu ini telah di-reset kembali ke 0/10.`);
    msgLines.push(`--------------------------------`);
  } else if (params.stampInfo?.earned) {
    const cardLbl = params.stampInfo.cardType === '75' ? '7 KG' : '4 KG';
    msgLines.push(`*STEMPEL LOYALTY CARD:*`);
    msgLines.push(`  • Penambahan  : +${params.stampInfo.stampsAdded || 1} Stempel (Kartu ${cardLbl})`);
    msgLines.push(`  • Total Stempel: *${params.stampInfo.newTotal || 0}/10 Stempel* ${params.stampInfo.isRewardReady ? '🎉 (SIAP KLAIM 1x CUCI GRATIS!)' : `(Kurang ${Math.max(0, 10 - (params.stampInfo.newTotal || 0))} lagi)`}`);
    msgLines.push(`--------------------------------`);
  }

  msgLines.push(`*Lihat E-Nota Resmi:*`);
  msgLines.push(eNotaUrl);
  msgLines.push(``);
  msgLines.push(`*Jam Buka*: 07.00 - 23.00 WIB (Setiap Hari)`);
  msgLines.push(`Terima kasih telah mempercayakan cucian Anda di Dua SiSi Laundry!`);

  return msgLines.filter(Boolean).join('\n');
}

/**
 * Generate standard WhatsApp Receipt string directly from a Transaksi object
 */
export function generateWhatsAppReceiptFromTx(
  tx: Transaksi,
  extra?: { token?: string; saldoPoin?: number; kembalian?: number; isMember?: boolean }
): string {
  const estimasi = tx.estimasi || tx.estimasiSelesai || '';
  const isMember = extra?.isMember !== undefined
    ? extra.isMember
    : (tx.isMember !== undefined ? tx.isMember : Boolean((tx as any).saldoPoin && (tx as any).saldoPoin > 0));
  const poinEarned = tx.poinEarned !== undefined && tx.poinEarned > 0
    ? tx.poinEarned
    : (isMember ? Math.max(1, Math.floor((tx.total || 0) / 10000)) : 0);
  const saldoPoin = extra?.saldoPoin !== undefined
    ? extra.saldoPoin
    : (tx as any).saldoPoin;
  const token = extra?.token || (tx as any).token;

  return generateWhatsAppReceiptMessage({
    noNota: tx.noNota,
    namaPelanggan: tx.namaPelanggan,
    noHp: tx.noHp,
    tanggal: tx.tanggal,
    kasir: tx.petugas,
    tipeLayanan: tx.tipe,
    tingkatLayanan: tx.tingkatLayanan,
    estimasiSelesai: estimasi,
    items: tx.items,
    subtotal: tx.subtotal,
    diskonNilai: tx.diskon,
    diskonKode: tx.voucher && tx.voucher !== 'None' ? tx.voucher : tx.diskonKode,
    total: tx.total,
    metodeBayar: tx.metodeBayar,
    kembalian: extra?.kembalian,
    sisaTagihan: tx.sisaTagihan,
    statusPembayaran: tx.statusPembayaran,
    isMember: isMember,
    poinEarned: poinEarned,
    saldoPoin: saldoPoin,
    token: token
  });
}
