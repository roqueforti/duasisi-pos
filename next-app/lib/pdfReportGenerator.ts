import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportDataPayload {
  periodeLabel: string;
  startDateStr: string;
  endDateStr: string;
  outletName: string;
  generatedBy: string;
  generatedAt: string;
  // Executive Summary
  kpi: {
    totalRevenue: number;
    totalTransactions: number;
    totalCustomers: number;
    repeatCustomers: number;
    oneTimeCustomers: number;
    repeatOrderRatio: number;
    totalKg: number;
    avgOrderValue: number;
    avgCustomerSpend: number;
  };
  // Daily Performance
  dailyRows: Array<{
    dateStr: string;
    transactions: number;
    revenue: number;
    kg: number;
  }>;
  // Service Performance
  serviceRows: Array<{
    layanan: string;
    transactions: number;
    kg: number;
    revenue: number;
    percentage: number;
  }>;
  // Employee Performance
  employeeRows: Array<{
    nama: string;
    transactions: number;
    revenue: number;
    completed: number;
    late: number;
  }>;
  // Customer Top List
  topCustomers: Array<{
    nama: string;
    noHp: string;
    totalOrder: number;
    totalSpend: number;
  }>;
  // Operational Performance
  operational: {
    totalOrders: number;
    completedOrders: number;
    processingOrders: number;
    pendingOrders: number;
    lateOrders: number;
    onTimeRate: number;
    onTimeCount: number;
  };
  // Payment Performance
  paymentRows: Array<{
    metode: string;
    transactions: number;
    nominal: number;
    percentage: number;
  }>;
  // Business Insights
  insights: string[];
}

// Helper Format Rupiah Indonesia
export function formatRupiahId(val: number): string {
  const n = Math.round(Number(val) || 0);
  return 'Rp' + n.toLocaleString('id-ID');
}

// Helper Format Persentase Indonesia (koma sebagai pemisah desimal)
export function formatPercentId(val: number): string {
  const n = Number(val) || 0;
  return n.toFixed(1).replace('.', ',') + '%';
}

/**
 * Generate dan langsung mengunduh PDF Business Performance Report SiSi Laundry
 */
export async function generateBusinessPerformancePdf(data: ReportDataPayload): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryDarkTeal = [30, 70, 72]; // #1E4648
  const accentTurquoise = [13, 148, 136]; // #0D9488
  const lightBg = [248, 250, 252]; // #F8FAFC
  const borderGray = [226, 232, 240]; // #E2E8F0
  const textDark = [30, 41, 59]; // #1E293B
  const textMuted = [100, 116, 139]; // #64748B

  // Helper Header Halaman
  const renderHeader = (isFirstPage: boolean) => {
    // Header Bar Top
    doc.setFillColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.rect(0, 0, pageWidth, isFirstPage ? 28 : 14, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 14 : 10);
    doc.setTextColor(255, 255, 255);
    doc.text('dua SiSi Laundry Express & Coin POS', margin, isFirstPage ? 12 : 9);

    if (isFirstPage) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(204, 251, 241); // teal light
      doc.text('BUSINESS PERFORMANCE & ANALYTICS REPORT', margin, 18);
      doc.setFontSize(8);
      doc.setTextColor(226, 232, 240);
      doc.text(`Periode: ${data.periodeLabel}  |  Outlet: ${data.outletName}`, margin, 24);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(204, 251, 241);
      doc.text(`Business Performance Report — ${data.periodeLabel}`, pageWidth - margin, 9, { align: 'right' });
    }
  };

  let curY = 35;
  renderHeader(true);

  // Jika tidak ada transaksi sama sekali
  if (data.kpi.totalTransactions === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('No data available for the selected period.', pageWidth / 2, 70, { align: 'center' });
    doc.save(`SiSi_Laundry_Report_${data.startDateStr}_${data.endDateStr}.pdf`);
    return;
  }

  // =========================================================================
  // SECTION B: EXECUTIVE SUMMARY (KPI CARDS)
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('B. EXECUTIVE SUMMARY', margin, curY);
  curY += 4;

  const cardWidth = (contentWidth - 6) / 3;
  const cardHeight = 16;

  const kpiItems = [
    { label: 'TOTAL REVENUE', val: formatRupiahId(data.kpi.totalRevenue), sub: `${data.kpi.totalTransactions} Total Transaksi` },
    { label: 'TOTAL TRANSAKSI', val: `${data.kpi.totalTransactions} Order`, sub: `Rata-rata: ${formatRupiahId(data.kpi.avgOrderValue)}/order` },
    { label: 'REPEAT ORDER RATIO', val: formatPercentId(data.kpi.repeatOrderRatio), sub: `${data.kpi.repeatCustomers} dari ${data.kpi.totalCustomers} Pelanggan` },
    { label: 'TOTAL PELANGGAN', val: `${data.kpi.totalCustomers} Orang`, sub: `${data.kpi.oneTimeCustomers} Baru / 1-Time` },
    { label: 'TOTAL BERAT CUCIAN', val: `${data.kpi.totalKg.toLocaleString('id-ID')} Kg`, sub: 'Estimasi volume cucian' },
    { label: 'AVG CUSTOMER SPEND', val: formatRupiahId(data.kpi.avgCustomerSpend), sub: 'Rata-rata belanja/pelanggan' },
  ];

  kpiItems.forEach((item, idx) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const x = margin + col * (cardWidth + 3);
    const y = curY + row * (cardHeight + 2.5);

    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(item.label, x + 3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.text(item.val, x + 3, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(item.sub, x + 3, y + 14);
  });

  curY += 2 * (cardHeight + 2.5) + 6;

  // =========================================================================
  // SECTION C: DAILY PERFORMANCE
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('C. DAILY PERFORMANCE (KINERJA HARIAN)', margin, curY);
  curY += 3;

  const dailyTableBody = data.dailyRows.map(r => [
    r.dateStr,
    r.transactions.toString(),
    formatRupiahId(r.revenue),
    r.kg > 0 ? `${r.kg} Kg` : '-'
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Tanggal', 'Jumlah Transaksi', 'Revenue (Omzet)', 'Estimasi Kg']],
    body: dailyTableBody.length > 0 ? dailyTableBody : [['-', '0', 'Rp0', '-']],
    theme: 'striped',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [30, 70, 72],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 55, halign: 'right' },
      3: { cellWidth: 42, halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // =========================================================================
  // SECTION D: SERVICE PERFORMANCE
  // =========================================================================
  if (curY > pageHeight - 50) {
    doc.addPage();
    renderHeader(false);
    curY = 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('D. SERVICE PERFORMANCE (PERFORMA LAYANAN)', margin, curY);
  curY += 3;

  const serviceTableBody = data.serviceRows.map(s => [
    s.layanan,
    s.transactions.toString(),
    s.kg > 0 ? `${s.kg} Kg` : '-',
    formatRupiahId(s.revenue),
    formatPercentId(s.percentage)
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Nama Layanan / Produk', 'Transaksi', 'Volume (Kg)', 'Revenue', 'Kontribusi (%)']],
    body: serviceTableBody.length > 0 ? serviceTableBody : [['Belum ada data', '-', '-', 'Rp0', '0%']],
    theme: 'striped',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [30, 70, 72],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 42, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // =========================================================================
  // SECTION E: EMPLOYEE PERFORMANCE
  // =========================================================================
  if (curY > pageHeight - 50) {
    doc.addPage();
    renderHeader(false);
    curY = 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('E. EMPLOYEE PERFORMANCE (PRODUKTIVITAS KARYAWAN)', margin, curY);
  curY += 3;

  const employeeTableBody = data.employeeRows.map(e => [
    e.nama,
    e.transactions.toString(),
    formatRupiahId(e.revenue),
    e.completed.toString(),
    e.late.toString()
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Nama Karyawan / Staf', 'Transaksi Ditangani', 'Total Revenue', 'Order Selesai', 'Order Terlambat']],
    body: employeeTableBody.length > 0 ? employeeTableBody : [['Belum ada data staf', '-', 'Rp0', '-', '-']],
    theme: 'striped',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [30, 70, 72],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // =========================================================================
  // SECTION F: OPERATIONAL PERFORMANCE & PAYMENT PERFORMANCE (2 COLS)
  // =========================================================================
  if (curY > pageHeight - 60) {
    doc.addPage();
    renderHeader(false);
    curY = 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('F. OPERATIONAL & PAYMENT PERFORMANCE', margin, curY);
  curY += 4;

  const halfWidth = (contentWidth - 6) / 2;

  // Operational Card
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, curY, halfWidth, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('Kinerja Ketepatan Waktu Operasional', margin + 4, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(accentTurquoise[0], accentTurquoise[1], accentTurquoise[2]);
  doc.text(`${formatPercentId(data.operational.onTimeRate)} On-Time Rate`, margin + 4, curY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`• Total Order: ${data.operational.totalOrders}`, margin + 4, curY + 19);
  doc.text(`• Selesai Tepat Waktu: ${data.operational.onTimeCount} order`, margin + 4, curY + 24);
  doc.text(`• Sedang Diproses / Menunggu: ${data.operational.processingOrders + data.operational.pendingOrders} order`, margin + 4, curY + 29);
  doc.text(`• Melewati Estimasi (Terlambat): ${data.operational.lateOrders} order`, margin + 4, curY + 34);

  // Payment Table on the right
  const payBody = data.paymentRows.map(p => [
    p.metode,
    p.transactions.toString(),
    formatRupiahId(p.nominal),
    formatPercentId(p.percentage)
  ]);

  autoTable(doc, {
    startY: curY,
    margin: { left: margin + halfWidth + 6, right: margin },
    head: [['Metode Bayar', 'Trx', 'Nominal', 'Pangsa']],
    body: payBody,
    theme: 'plain',
    headStyles: {
      fillColor: [30, 70, 72],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 18, halign: 'right' },
    },
  });

  curY += 43;

  // =========================================================================
  // SECTION G: CUSTOMER ANALYTICS & TOP CUSTOMERS
  // =========================================================================
  if (curY > pageHeight - 55) {
    doc.addPage();
    renderHeader(false);
    curY = 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('G. CUSTOMER ANALYTICS & TOP CUSTOMERS', margin, curY);
  curY += 3;

  const topCustBody = data.topCustomers.slice(0, 10).map((c, idx) => [
    `#${idx + 1}`,
    c.nama,
    c.noHp || '-',
    `${c.totalOrder}x Transaksi`,
    formatRupiahId(c.totalSpend)
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['No', 'Nama Pelanggan', 'Kontak No. HP', 'Frekuensi Order', 'Total Spending']],
    body: topCustBody.length > 0 ? topCustBody : [['-', 'Belum ada data pelanggan', '-', '-', 'Rp0']],
    theme: 'striped',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [30, 70, 72],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 40 },
      3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 40, halign: 'right' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // =========================================================================
  // SECTION H: BUSINESS INSIGHTS & ALERTS
  // =========================================================================
  if (curY > pageHeight - 45) {
    doc.addPage();
    renderHeader(false);
    curY = 22;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('H. BUSINESS INSIGHTS & ACTIONABLE ALERTS', margin, curY);
  curY += 4;

  data.insights.forEach((insight) => {
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(accentTurquoise[0], accentTurquoise[1], accentTurquoise[2]);
    doc.rect(margin, curY, contentWidth, 7, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`• ${insight}`, margin + 3, curY + 4.8);
    curY += 8.5;
  });

  // =========================================================================
  // REPORT FOOTER DI SEMUA HALAMAN (Page X of Y)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer divider line
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

    // Kiri: Title
    doc.text('dua SiSi Laundry — Business Performance Report', margin, pageHeight - 8);

    // Tengah: Generated info
    doc.text(`Generated at: ${data.generatedAt} WIB by ${data.generatedBy}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

    // Kanan: Page number
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Trigger download PDF ke browser
  const filename = `duaSiSi_Business_Report_${data.startDateStr}_${data.endDateStr}.pdf`;
  doc.save(filename);
}
