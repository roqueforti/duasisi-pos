import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DUASISI_LOGO_WHITE_BASE64 } from './reportLogo';
import { PayrollItem } from './types';

// Helper angka terbilang dalam Bahasa Indonesia
export function angkaTerbilang(nilai: number): string {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];

  const n = Math.floor(Math.abs(nilai));
  if (n === 0) return 'Nol Rupiah';

  function sebut(x: number): string {
    if (x < 12) return bilangan[x];
    if (x < 20) return sebut(x - 10) + ' Belas';
    if (x < 100) return sebut(Math.floor(x / 10)) + ' Puluh ' + sebut(x % 10);
    if (x < 200) return 'Seratus ' + sebut(x - 100);
    if (x < 1000) return sebut(Math.floor(x / 100)) + ' Ratus ' + sebut(x % 100);
    if (x < 2000) return 'Seribu ' + sebut(x - 1000);
    if (x < 1000000) return sebut(Math.floor(x / 1000)) + ' Ribu ' + sebut(x % 1000);
    if (x < 1000000000) return sebut(Math.floor(x / 1000000)) + ' Juta ' + sebut(x % 1000000);
    if (x < 1000000000000) return sebut(Math.floor(x / 1000000000)) + ' Milyar ' + sebut(x % 1000000000);
    return '';
  }

  const hasil = sebut(n).replace(/\s+/g, ' ').trim();
  return `${hasil} Rupiah`;
}

function sanitize(str: string): string {
  if (!str) return '';
  return str
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '-')
    .replace(/…/g, '...');
}

export function generateSlipGajiPdf(
  item: PayrollItem,
  bulanLabel: string,
  tahun: string
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Warna Brand
  const primaryDarkTeal = [30, 70, 72]; // #1E4648
  const emeraldGreen = [16, 185, 129];  // #10B981
  const warmAmber = [217, 119, 6];      // #D97706
  const roseRed = [225, 29, 72];        // #E11D48
  const lightBg = [248, 250, 252];      // #F8FAFC
  const borderGray = [226, 232, 240];   // #E2E8F0

  // 1. KOP SURAT ATAS
  doc.setFillColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Logo di kiri
  try {
    if (DUASISI_LOGO_WHITE_BASE64) {
      doc.addImage(DUASISI_LOGO_WHITE_BASE64, 'PNG', margin, 6, 28, 8.3);
    }
  } catch (e) {
    console.warn('Gagal memuat logo slip gaji:', e);
  }

  // Nama Laundry & Subtitle
  const textX = margin + 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('DUA SISI LAUNDRY EXPRESS & COIN', textX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(204, 251, 241);
  doc.text('Outlet Resmi • Professional Laundry Care Services', textX, 16);
  doc.text('Sistem Informasi Manajemen Payroll Karyawan', textX, 20.5);

  // Judul Dokumen di Kanan Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('SLIP GAJI KARYAWAN', pageWidth - margin, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(254, 240, 138); // amber light
  doc.text(`Periode: ${bulanLabel.toUpperCase()} ${tahun}`, pageWidth - margin, 18, { align: 'right' });

  let currentY = 36;

  // 2. KOTAK INFORMASI DOKUMEN & PEGAWAI
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, currentY, contentWidth, 34, 2, 2, 'FD');

  const noSlip = `SLIP/DSL/${(item.periode || `${tahun}-01`).replace('-', '')}/${item.idPegawai || 'EMP'}`;
  const tglCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Kolom 1 (Kiri)
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('No. Dokumen', margin + 4, currentY + 6);
  doc.text('Nama Pegawai', margin + 4, currentY + 12);
  doc.text('Jabatan / Posisi', margin + 4, currentY + 18);
  doc.text('Status Kerja', margin + 4, currentY + 24);
  doc.text('Nomor HP / WA', margin + 4, currentY + 30);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${noSlip}`, margin + 30, currentY + 6);
  doc.text(`: ${item.nama}`, margin + 30, currentY + 12);
  doc.text(`: ${item.jabatan || 'Staff'}`, margin + 30, currentY + 18);
  doc.text(`: ${item.statusKepegawaian || 'Tetap'}`, margin + 30, currentY + 24);
  doc.text(`: ${item.noHp || '-'}`, margin + 30, currentY + 30);

  // Kolom 2 (Kanan)
  const col2LabelX = margin + 95;
  const col2ValX = margin + 124;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Tanggal Terbit', col2LabelX, currentY + 6);
  doc.text('Kehadiran', col2LabelX, currentY + 12);
  doc.text('Total Jam Kerja', col2LabelX, currentY + 18);
  doc.text('Rekening Tujuan', col2LabelX, currentY + 24);
  doc.text('Status Bayar', col2LabelX, currentY + 30);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`: ${tglCetak}`, col2ValX, currentY + 6);
  doc.text(`: ${item.jumlahHadir || 0} Hari Kerja`, col2ValX, currentY + 12);
  doc.text(`: ${item.totalJamKerja || 0} Jam ${item.jumlahTelat ? `(${item.jumlahTelat}x Telat)` : ''}`, col2ValX, currentY + 18);

  const bankStr = `${item.bank || 'Tunai'} ${item.noRekening ? `- ${item.noRekening}` : ''} ${item.namaRekening ? `(a.n ${item.namaRekening})` : ''}`.trim();
  doc.text(`: ${bankStr}`, col2ValX, currentY + 24);

  const isLunas = item.statusPembayaran === 'Sudah Dibayar';
  if (isLunas) {
    doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
    doc.text(`: LUNAS (Sudah Ditransfer)`, col2ValX, currentY + 30);
  } else {
    doc.setTextColor(warmAmber[0], warmAmber[1], warmAmber[2]);
    doc.text(`: PENDING (Menunggu Transfer)`, col2ValX, currentY + 30);
  }

  currentY += 40;

  // 3. TABEL RINCIAN GAJI (PENERIMAAN & POTONGAN)
  const formatRp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

  const rows: any[] = [];

  // Bagian Penerimaan
  rows.push([
    { content: 'A. PENERIMAAN (INCOME)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } }
  ]);
  rows.push(['  1. Gaji Pokok', formatRp(item.gajiPokok)]);
  rows.push([
    `  2. Tunjangan Kehadiran (${item.jumlahHadir || 0} Hari Hadir)`,
    formatRp(item.tunjanganKehadiran || item.tunjangan || 0)
  ]);
  rows.push([
    `  3. Insentif Drop Off (${item.totalTahapKhusus || 0} Tahap Khusus Selesai)`,
    `+${formatRp(item.insentifDropOff || 0)}`
  ]);

  // Breakdown tahap khusus jika ada
  if (item.dropoffKhususBreakdown && Object.keys(item.dropoffKhususBreakdown).length > 0) {
    Object.entries(item.dropoffKhususBreakdown).forEach(([step, data]) => {
      rows.push([
        `      • ${sanitize(step)}: ${data.count}x @${formatRp(data.rate)}`,
        formatRp(data.subtotal)
      ]);
    });
  }

  const totalPenerimaan = (item.gajiPokok || 0) + (item.tunjanganKehadiran || item.tunjangan || 0) + (item.insentifDropOff || 0);
  rows.push([
    { content: '  Subtotal Penerimaan (A)', styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
    { content: formatRp(totalPenerimaan), styles: { fontStyle: 'bold', textColor: [15, 23, 42] } }
  ]);

  // Bagian Potongan
  rows.push([
    { content: 'B. POTONGAN (DEDUCTION)', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } }
  ]);

  if (item.dendaTelat && item.dendaTelat > 0) {
    rows.push([
      `  1. Denda Keterlambatan (${item.jumlahTelat || 0}x Terlambat)`,
      `-${formatRp(item.dendaTelat)}`
    ]);
  }

  const potonganLain = item.potonganRutin || item.potongan || 0;
  rows.push([
    `  2. Potongan Rutin / Kasbon / Lainnya`,
    `-${formatRp(potonganLain)}`
  ]);

  const totalPotongan = (item.dendaTelat || 0) + potonganLain;
  rows.push([
    { content: '  Subtotal Potongan (B)', styles: { fontStyle: 'bold', textColor: [225, 29, 72] } },
    { content: `-${formatRp(totalPotongan)}`, styles: { fontStyle: 'bold', textColor: [225, 29, 72] } }
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [
      ['Komponen Penggajian', 'Nominal (IDR)']
    ],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [30, 70, 72],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: contentWidth - 45 },
      1: { cellWidth: 45, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 70;
  currentY = finalY + 4;

  // 4. KOTAK TOTAL GAJI BERSIH (TAKE HOME PAY)
  doc.setFillColor(30, 70, 72);
  doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(204, 251, 241);
  doc.text('TOTAL GAJI BERSIH (TAKE HOME PAY)', margin + 5, currentY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Total penerimaan bersih yang dibayarkan ke karyawan', margin + 5, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(254, 240, 138); // warm yellow
  doc.text(formatRp(item.totalGajiBersih), pageWidth - margin - 5, currentY + 12, { align: 'right' });

  // Teks Terbilang
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(204, 251, 241);
  const terbilangStr = `Terbilang: # ${angkaTerbilang(item.totalGajiBersih)} #`;
  doc.text(terbilangStr, margin + 5, currentY + 17);

  currentY += 25;

  // 5. STATUS TRANSFER & BUKTI TRANSFER INFO
  if (isLunas) {
    doc.setFillColor(236, 253, 245); // light green bg
    doc.setDrawColor(16, 185, 129);  // green border
    doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text('STATUS PEMBAYARAN: LUNAS / TELAH DITRANSFER', margin + 4, currentY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81);
    const detailTf = `Tgl Pembayaran: ${item.tanggalPembayaran || tglCetak} • Metode: ${item.metodePembayaran || 'Transfer'} • Rekening: ${bankStr} ${item.buktiTransfer ? '• (Bukti transfer struk telah terlampir/terverifikasi)' : ''}`;
    doc.text(detailTf, margin + 4, currentY + 10.5);
    currentY += 19;
  } else {
    doc.setFillColor(254, 252, 232); // light amber bg
    doc.setDrawColor(245, 158, 11);  // amber border
    doc.roundedRect(margin, currentY, contentWidth, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text('STATUS PEMBAYARAN: MENUNGGU TRANSFER (PENDING)', margin + 4, currentY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81);
    doc.text(`Silakan transfer nominal Rp ${Math.round(item.totalGajiBersih).toLocaleString('id-ID')} ke ${bankStr} sebelum mengonfirmasi pembayaran.`, margin + 4, currentY + 10.5);
    currentY += 19;
  }

  // 6. LAMPIRAN BUKTI TRANSFER (JIKA ADA & BISA DITAMPILKAN DI SLIP)
  if (item.buktiTransfer && item.buktiTransfer.startsWith('data:image')) {
    try {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Lampiran Bukti Transfer Valid:', margin, currentY);

      // Gambar bukti transfer kecil (thumbnail struk ~30x25 mm)
      doc.addImage(item.buktiTransfer, 'JPEG', margin, currentY + 2, 32, 24);
      currentY += 28;
    } catch (err) {
      console.warn('Gagal menempelkan bukti transfer di PDF:', err);
    }
  }

  // 7. TANDA TANGAN (SIGNATURES)
  const sigY = Math.max(currentY + 5, 235);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');

  // Kiri: Diterima Oleh Pegawai
  doc.text('Diterima Oleh,', margin + 25, sigY, { align: 'center' });
  doc.line(margin + 5, sigY + 22, margin + 45, sigY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(item.nama, margin + 25, sigY + 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(item.jabatan || 'Staff', margin + 25, sigY + 30, { align: 'center' });

  // Kanan: Disetujui Oleh Management / Finance
  doc.setFontSize(8);
  doc.text('Disetujui Oleh,', pageWidth - margin - 25, sigY, { align: 'center' });
  doc.line(pageWidth - margin - 45, sigY + 22, pageWidth - margin - 5, sigY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Management / Finance', pageWidth - margin - 25, sigY + 26, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Dua Sisi Laundry Express & Coin', pageWidth - margin - 25, sigY + 30, { align: 'center' });

  // 8. FOOTER DOKUMEN
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.line(margin, 282, pageWidth - margin, 282);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Dokumen ini diterbitkan secara resmi melalui Sistem Informasi Dua Sisi POS dan sah sebagai bukti tanda terima pembayaran gaji.', margin, 286);
  doc.text(`Waktu Cetak: ${new Date().toLocaleString('id-ID')} WIB`, pageWidth - margin, 286, { align: 'right' });

  return doc;
}

export function downloadSlipGajiPdf(
  item: PayrollItem,
  bulanLabel: string,
  tahun: string
): void {
  const doc = generateSlipGajiPdf(item, bulanLabel, tahun);
  const cleanName = (item.nama || 'Pegawai').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Slip_Gaji_${cleanName}_${bulanLabel}_${tahun}.pdf`;
  doc.save(filename);
}
