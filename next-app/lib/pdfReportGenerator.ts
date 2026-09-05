import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DUASISI_LOGO_WHITE_BASE64 } from './reportLogo';

export interface ReportDataPayload {
  periodeLabel: string;
  startDateStr: string;
  endDateStr: string;
  outletName: string;
  generatedBy: string;
  generatedAt: string;
  executiveSummaryOpening?: string;
  aiProvider?: string;
  logoDataUrl?: string;
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
  // Financial Performance (HPP, Laba Kotor & Bersih)
  financials?: {
    pendapatan: number;
    hpp: number;
    labaKotor: number;
    marginKotor: number;
    biayaOperasional: number;
    labaBersih: number;
    marginBersih: number;
  };
  // Quality Performance
  quality?: {
    cancellationRate: number;
    rewashRate: number;
    complaintRate: number;
    orderErrorRate: number;
    refundRate: number;
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
  // Business Action Plan & Insights
  actionPlans?: ActionPlanItem[];
  insights?: string[];
}

export interface ActionPlanItem {
  pilar: string;
  rencanaAksi: string;
  targetOutput: string;
  prioritas: 'Tinggi' | 'Sedang' | 'Rutin';
  pic: string;
}

// Helper Sensor No. HP Pelanggan demi Privasi & Keamanan Data (Informasi Keluar dari Sistem)
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '-';
  const clean = phone.trim();
  if (clean === '' || clean === '-') return '-';
  const digits = clean.replace(/\D/g, '');
  if (digits.length <= 6) return '****';

  if (digits.length >= 10) {
    const front = digits.slice(0, 4);
    const back = digits.slice(-4);
    return `${front}-****-${back}`;
  } else {
    const front = digits.slice(0, 3);
    const back = digits.slice(-3);
    return `${front}-****-${back}`;
  }
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

// Sanitize teks agar Unicode yang tidak didukung jsPDF Helvetica terganti ASCII
function sanitizePdfText(text: string): string {
  return (text || '')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/•/g, '-')
    .replace(/…/g, '...');
}

/**
 * Generate dan langsung mengunduh PDF Business Performance Report SiSi Laundry
 * Dirancang elegan, informatif, bab dimulai dari abjad A, dilengkapi grafik visual vektor.
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

  // Curated Color Palette
  const primaryDarkTeal = [30, 70, 72]; // #1E4648
  const accentTurquoise = [13, 148, 136]; // #0D9488
  const emeraldGreen = [16, 185, 129]; // #10B981
  const warmAmber = [245, 158, 11]; // #F59E0B
  const roseRed = [225, 29, 72]; // #E11D48
  const lightBg = [248, 250, 252]; // #F8FAFC
  const borderGray = [226, 232, 240]; // #E2E8F0
  const textDark = [15, 23, 42]; // #0F172A
  const textMuted = [100, 116, 139]; // #64748B

  // Helper Header Halaman dengan Logo Resmi dua SiSi
  const renderHeader = (isFirstPage: boolean) => {
    // Header Bar Top
    doc.setFillColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.rect(0, 0, pageWidth, isFirstPage ? 32 : 15, 'F');

    const logoSrc = data.logoDataUrl || DUASISI_LOGO_WHITE_BASE64;

    try {
      if (isFirstPage) {
        // Logo banner di sebelah kiri
        if (logoSrc) {
          doc.addImage(logoSrc, 'PNG', margin, 5.5, 27, 8.04);
        }

        // Title & metadata di sebelah kanan logo
        const textX = margin + 31;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(255, 255, 255);
        doc.text('dua SiSi Laundry Express & Coin POS', textX, 11);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(204, 251, 241); // teal light
        doc.text('EXECUTIVE BUSINESS PERFORMANCE & PROFITABILITY REPORT', textX, 17);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(226, 232, 240);
        doc.text(`Periode: ${data.periodeLabel}  |  Outlet: ${data.outletName}  |  Dibuat oleh: ${data.generatedBy}`, textX, 23.5);
      } else {
        // Halaman lanjutan: logo kecil di kiri
        if (logoSrc) {
          doc.addImage(logoSrc, 'PNG', margin, 3.8, 18, 5.36);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('dua SiSi Laundry Express & Coin POS', margin + 21, 9.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(204, 251, 241);
        doc.text(`Executive Performance Report — ${data.periodeLabel}`, pageWidth - margin, 9.5, { align: 'right' });
      }
    } catch (e) {
      console.warn('Gagal memuat logo ke PDF header:', e);
      // Fallback text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isFirstPage ? 14 : 10);
      doc.setTextColor(255, 255, 255);
      doc.text('dua SiSi Laundry Express & Coin POS', margin, isFirstPage ? 12 : 9);
    }
  };

  let curY = 39;
  renderHeader(true);

  // Jika tidak ada transaksi sama sekali
  if (data.kpi.totalTransactions === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Tidak ada data transaksi pada rentang periode yang dipilih.', pageWidth / 2, 70, { align: 'center' });
    doc.save(`duaSiSi_Business_Report_${data.startDateStr}_${data.endDateStr}.pdf`);
    return;
  }

  // Helper render Chapter Section Title with Alphabet Badge (A, B, C, ...)
  const renderSectionHeader = (letter: string, title: string, requiredSpace: number = 30) => {
    if (curY > pageHeight - requiredSpace) {
      doc.addPage();
      renderHeader(false);
      curY = 22;
    }

    // Letter badge pill
    doc.setFillColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.roundedRect(margin, curY, 6.5, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(letter, margin + 3.25, curY + 4.6, { align: 'center' });

    // Section title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.text(title, margin + 9, curY + 4.8);

    curY += 9;
  };

  // =========================================================================
  // BAB A: RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)
  // =========================================================================
  renderSectionHeader('A', 'RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)', 60);

  // Paragraf Pembuka Ringkasan Eksekutif (AI Analysis / Heuristics)
  const defaultOpening = `Laporan kinerja bisnis dua SiSi Laundry Express & Coin POS periode ${data.periodeLabel} menyajikan evaluasi komprehensif terhadap performa finansial, efisiensi operasional, dan dinamika retensi pelanggan. Dokumen ini disusun secara sistematis guna memberikan gambaran holistik bagi manajemen dalam mengidentifikasi pencapaian kunci, mengendalikan beban pokok penjualan (HPP), serta merumuskan prioritas strategis demi akselerasi pertumbuhan outlet yang berkelanjutan.`;
  const openingText = sanitizePdfText(data.executiveSummaryOpening?.trim() || defaultOpening);
  const openingLines = doc.splitTextToSize(openingText, contentWidth - 6);
  const badgeExtraH = data.aiProvider ? 7 : 0;
  const openingBoxH = Math.max(13, openingLines.length * 3.6 + 4 + badgeExtraH);

  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.roundedRect(margin, curY, contentWidth, openingBoxH, 1.5, 1.5, 'FD');

  // Left Accent Bar
  doc.setFillColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.rect(margin, curY, 2, openingBoxH, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(openingLines, margin + 4, curY + 4.2);

  // AI Provider Badge (kecil di pojok kanan bawah kotak)
  if (data.aiProvider) {
    const badgeText = `Analyzed by ${data.aiProvider}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    const badgeW = doc.getTextWidth(badgeText) + 4;
    const badgeX = margin + contentWidth - badgeW - 2;
    const badgeY = curY + openingBoxH - 5.5;
    doc.setFillColor(13, 148, 136); // accentTurquoise
    doc.roundedRect(badgeX, badgeY, badgeW, 4, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, badgeX + 2, badgeY + 2.9);
  }

  curY += openingBoxH + 4;

  const cardWidth = (contentWidth - 6) / 3;
  const cardHeight = 17;

  const kpiItems = [
    { label: 'TOTAL PENDAPATAN', val: formatRupiahId(data.kpi.totalRevenue), sub: `${data.kpi.totalTransactions} Total Order Sukses`, accent: primaryDarkTeal },
    { label: 'TOTAL ORDER', val: `${data.kpi.totalTransactions} Order`, sub: `Rata-rata ${formatRupiahId(data.kpi.avgOrderValue)}/order`, accent: accentTurquoise },
    { label: 'REPEAT ORDER RATIO', val: formatPercentId(data.kpi.repeatOrderRatio), sub: `${data.kpi.repeatCustomers} dari ${data.kpi.totalCustomers} Pelanggan`, accent: emeraldGreen },
    { label: 'TOTAL PELANGGAN', val: `${data.kpi.totalCustomers} Orang`, sub: `${data.kpi.oneTimeCustomers} Pelanggan Baru (1-Time)`, accent: accentTurquoise },
    { label: 'VOLUME BERAT CUCIAN', val: `${data.kpi.totalKg.toLocaleString('id-ID')} Kg`, sub: 'Estimasi beban cucian toko', accent: warmAmber },
    { label: 'RATA-RATA BELANJA', val: formatRupiahId(data.kpi.avgCustomerSpend), sub: 'Belanja per orang (Customer Spend)', accent: primaryDarkTeal },
  ];

  kpiItems.forEach((item, idx) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const x = margin + col * (cardWidth + 3);
    const y = curY + row * (cardHeight + 2.5);

    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

    // Left Accent Stripe
    doc.setFillColor(item.accent[0], item.accent[1], item.accent[2]);
    doc.roundedRect(x, y, 1.8, cardHeight, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(item.label, x + 4, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.text(item.val, x + 4, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(item.sub, x + 4, y + 14.5);
  });

  curY += 2 * (cardHeight + 2.5) + 6;

  // =========================================================================
  // BAB B: KINERJA FINANSIAL & PROFITABILITAS (FINANCIAL PERFORMANCE)
  // =========================================================================
  renderSectionHeader('B', 'KINERJA FINANSIAL & PROFITABILITAS (FINANCIAL PERFORMANCE)', 50);

  if (data.financials) {
    const fin = data.financials;

    // GRAFIK 1: SEGMENTED REVENUE BREAKDOWN BAR (KOMPOSISI OMZET)
    const breakdownH = 17;
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(margin, curY, contentWidth, breakdownH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.text('Komposisi Pembagian Pendapatan (HPP vs Biaya Toko vs Laba Bersih)', margin + 3.5, curY + 4.5);

    // Segmented Bar
    const barX = margin + 3.5;
    const barY = curY + 6.5;
    const totalBarW = contentWidth - 7;
    const barH = 3.5;

    const baseRev = Math.max(1, fin.pendapatan);
    const hppRatio = fin.hpp / baseRev;
    const opsRatio = fin.biayaOperasional / baseRev;
    const netRatio = Math.max(0, fin.labaBersih / baseRev);

    const hppW = Math.max(1, hppRatio * totalBarW);
    const opsW = Math.max(1, opsRatio * totalBarW);
    const netW = Math.max(1, totalBarW - hppW - opsW);

    // Background Bar Track
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(barX, barY, totalBarW, barH, 1, 1, 'F');

    // HPP Segment (Amber)
    doc.setFillColor(warmAmber[0], warmAmber[1], warmAmber[2]);
    doc.rect(barX, barY, hppW, barH, 'F');

    // Ops Segment (Slate)
    doc.setFillColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.rect(barX + hppW, barY, opsW, barH, 'F');

    // Net Profit Segment (Emerald)
    doc.setFillColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
    doc.rect(barX + hppW + opsW, barY, netW, barH, 'F');

    // Legend Underneath
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    // Amber dot & text
    doc.setFillColor(warmAmber[0], warmAmber[1], warmAmber[2]);
    doc.circle(barX + 2, barY + 7, 1.2, 'F');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`HPP / Bahan: ${formatRupiahId(fin.hpp)} (${formatPercentId(hppRatio * 100)})`, barX + 5, barY + 7.8);

    // Slate dot & text
    const col2X = barX + totalBarW * 0.36;
    doc.setFillColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.circle(col2X + 2, barY + 7, 1.2, 'F');
    doc.text(`Biaya Toko: ${formatRupiahId(fin.biayaOperasional)} (${formatPercentId(opsRatio * 100)})`, col2X + 5, barY + 7.8);

    // Emerald dot & text
    const col3X = barX + totalBarW * 0.70;
    doc.setFillColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
    doc.circle(col3X + 2, barY + 7, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text(`Laba Bersih: ${formatRupiahId(fin.labaBersih)} (${formatPercentId(fin.marginBersih)})`, col3X + 5, barY + 7.8);

    curY += breakdownH + 4;

    // Financial Table
    const finTableBody = [
      ['Total Pendapatan (Omzet)', formatRupiahId(fin.pendapatan), '100,0%', 'Basis 100% omzet bruto pesanan non-void'],
      ['HPP / Biaya Bahan & Produk', formatRupiahId(fin.hpp), formatPercentId((fin.hpp / baseRev) * 100), 'Biaya detergen, softener, plastik packing & modal ritel'],
      ['Laba Kotor (Gross Profit)', formatRupiahId(fin.labaKotor), formatPercentId(fin.marginKotor), 'Pendapatan dikurangi HPP (Keuntungan kotor jasa)'],
      ['Biaya Operasional Toko', formatRupiahId(fin.biayaOperasional), formatPercentId((fin.biayaOperasional / baseRev) * 100), 'Beban operasional listrik, air, sewa & kasbon kasir'],
      ['Laba Bersih Toko (Net Profit)', formatRupiahId(fin.labaBersih), formatPercentId(fin.marginBersih), 'Laba bersih akhir yang menjadi hak pemilik bisnis']
    ];

    autoTable(doc, {
      startY: curY,
      head: [['Komponen Finansial', 'Nominal (Rp)', 'Rasio / Margin', 'Keterangan Analisis']],
      body: finTableBody,
      theme: 'striped',
      margin: { left: margin, right: margin, bottom: 20 },
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
        0: { cellWidth: 55 },
        1: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 67 },
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 7;
  }

  // =========================================================================
  // BAB C: TREN PENDAPATAN & GRAFIK HARIAN (DAILY PERFORMANCE)
  // =========================================================================
  renderSectionHeader('C', 'TREN PENDAPATAN & GRAFIK HARIAN (DAILY PERFORMANCE)', 65);

  // GRAFIK 2: DIAGRAM BATANG VEKTOR TREN PENJUALAN HARIAN
  if (data.dailyRows && data.dailyRows.length > 0) {
    const chartCardH = 44;
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(margin, curY, contentWidth, chartCardH, 2, 2, 'FD');

    // Header Chart
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.text('Grafik Penjualan Harian Aktual (WIB)', margin + 3.5, curY + 4.5);

    const maxDailyRev = Math.max(...data.dailyRows.map(r => r.revenue), 1000);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(`Puncak Tertinggi: ${formatRupiahId(maxDailyRev)}`, pageWidth - margin - 4, curY + 4.5, { align: 'right' });

    // Chart Area Boundaries
    const chartLeft = margin + 4;
    const chartRight = margin + contentWidth - 4;
    const chartW = chartRight - chartLeft;
    const baselineY = curY + 34;
    const maxBarH = 22;

    // Gridlines (50% & 100%)
    doc.setDrawColor(226, 232, 240);
    doc.setLineDashPattern([1, 1.5], 0);
    doc.line(chartLeft, baselineY - maxBarH, chartRight, baselineY - maxBarH);
    doc.line(chartLeft, baselineY - maxBarH / 2, chartRight, baselineY - maxBarH / 2);
    doc.setLineDashPattern([], 0); // reset

    // Baseline Line
    doc.setDrawColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.line(chartLeft, baselineY, chartRight, baselineY);

    // Bars
    const totalBars = data.dailyRows.length;
    const slotW = chartW / totalBars;
    const barW = Math.max(2, Math.min(10, slotW * 0.65));

    data.dailyRows.forEach((r, idx) => {
      const barX = chartLeft + idx * slotW + (slotW - barW) / 2;
      const barH = r.revenue > 0 ? Math.max(2, Math.round((r.revenue / maxDailyRev) * maxBarH)) : 0.8;
      const barY = baselineY - barH;

      const isPeak = r.revenue === maxDailyRev && r.revenue > 0;

      if (r.revenue > 0) {
        if (isPeak) {
          doc.setFillColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
        } else {
          doc.setFillColor(accentTurquoise[0], accentTurquoise[1], accentTurquoise[2]);
        }
        doc.roundedRect(barX, barY, barW, barH, 0.8, 0.8, 'F');
      } else {
        doc.setFillColor(226, 232, 240);
        doc.rect(barX, barY, barW, barH, 'F');
      }

      // X-Axis Date Labels (skip labels if crowded > 15 bars)
      const shouldShowLabel = totalBars <= 12 || (totalBars <= 20 && idx % 2 === 0) || (idx % 3 === 0) || idx === totalBars - 1;
      if (shouldShowLabel) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
        // Extract short label e.g. "5 Sep"
        const cleanDate = r.dateStr.replace(/,.*$/, '').slice(0, 6);
        doc.text(cleanDate, barX + barW / 2, baselineY + 3.8, { align: 'center' });
      }

      // Peak Indicator Text
      if (isPeak) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
        doc.text(formatRupiahId(r.revenue), barX + barW / 2, barY - 1.5, { align: 'center' });
      }
    });

    curY += chartCardH + 4;
  }

  // Daily Table
  const dailyTableBody = data.dailyRows.map(r => [
    r.dateStr,
    r.transactions.toString(),
    formatRupiahId(r.revenue),
    r.kg > 0 ? `${r.kg} Kg` : '-'
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Tanggal', 'Total Order', 'Pendapatan Harian', 'Estimasi Volume (Kg)']],
    body: dailyTableBody.length > 0 ? dailyTableBody : [['-', '0', 'Rp0', '-']],
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 20 },
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
      0: { cellWidth: 50 },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 55, halign: 'right' },
      3: { cellWidth: 42, halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // =========================================================================
  // BAB D: ANALISIS PERFORMA LAYANAN & PRODUK (SERVICE PERFORMANCE)
  // =========================================================================
  renderSectionHeader('D', 'ANALISIS PERFORMA LAYANAN & PRODUK (SERVICE PERFORMANCE)', 50);

  // GRAFIK 3: PROGRESS BAR KONTRIBUSI LAYANAN UNGGULAN (TOP 4 SERVICES)
  const topServices = data.serviceRows.slice(0, 4);
  if (topServices.length > 0) {
    const serviceCardH = 26;
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.roundedRect(margin, curY, contentWidth, serviceCardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.text('Kontribusi Layanan Unggulan terhadap Total Omzet Toko', margin + 3.5, curY + 4.5);

    topServices.forEach((s, idx) => {
      const rowY = curY + 7 + idx * 4.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);

      // Service Name (truncate if long)
      const sName = s.layanan.length > 25 ? s.layanan.slice(0, 25) + '...' : s.layanan;
      doc.text(sName, margin + 4, rowY + 2.5);

      // Bar Track
      const pBarX = margin + 55;
      const pBarW = contentWidth - 85;
      const fillW = Math.max(1, (s.percentage / 100) * pBarW);

      doc.setFillColor(226, 232, 240);
      doc.roundedRect(pBarX, rowY, pBarW, 2.5, 0.8, 0.8, 'F');

      doc.setFillColor(idx === 0 ? primaryDarkTeal[0] : accentTurquoise[0], idx === 0 ? primaryDarkTeal[1] : accentTurquoise[1], idx === 0 ? primaryDarkTeal[2] : accentTurquoise[2]);
      doc.roundedRect(pBarX, rowY, fillW, 2.5, 0.8, 0.8, 'F');

      // Metric numbers
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
      doc.text(`${formatPercentId(s.percentage)} (${formatRupiahId(s.revenue)})`, pBarX + pBarW + 2, rowY + 2.2);
    });

    curY += serviceCardH + 4;
  }

  // Service Table
  const serviceTableBody = data.serviceRows.map(s => [
    s.layanan,
    s.transactions.toString(),
    s.kg > 0 ? `${s.kg} Kg` : '-',
    formatRupiahId(s.revenue),
    formatPercentId(s.percentage)
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Nama Layanan / Produk', 'Total Order', 'Volume (Kg)', 'Pendapatan', 'Kontribusi (%)']],
    body: serviceTableBody.length > 0 ? serviceTableBody : [['Belum ada data', '-', '-', 'Rp0', '0%']],
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 20 },
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
      0: { cellWidth: 65 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 42, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // =========================================================================
  // BAB E: PRODUKTIVITAS KARYAWAN & STAF (EMPLOYEE PERFORMANCE)
  // =========================================================================
  renderSectionHeader('E', 'PRODUKTIVITAS KARYAWAN & STAF (EMPLOYEE PERFORMANCE)', 45);

  const employeeTableBody = data.employeeRows.map(e => [
    e.nama,
    e.transactions.toString(),
    formatRupiahId(e.revenue),
    e.completed.toString(),
    e.late.toString()
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Nama Karyawan / Staf', 'Total Order Ditangani', 'Omzet Dihasilkan', 'Order Selesai', 'Order Terlambat']],
    body: employeeTableBody.length > 0 ? employeeTableBody : [['Belum ada data staf', '-', 'Rp0', '-', '-']],
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 20 },
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
      0: { cellWidth: 60 },
      1: { cellWidth: 32, halign: 'center' },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // =========================================================================
  // BAB F: KUALITAS OPERASIONAL & METODE BAYAR (OPERATIONAL & PAYMENT)
  // =========================================================================
  renderSectionHeader('F', 'KUALITAS OPERASIONAL & METODE PEMBAYARAN', 55);

  const halfWidth = (contentWidth - 6) / 2;

  // Operational SLA Card (Left)
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.roundedRect(margin, curY, halfWidth, 42, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
  doc.text('Ketepatan Waktu Operasional (SLA)', margin + 4, curY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(accentTurquoise[0], accentTurquoise[1], accentTurquoise[2]);
  doc.text(`${formatPercentId(data.operational.onTimeRate)} On-Time Rate`, margin + 4, curY + 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`• Total Order Terdaftar: ${data.operational.totalOrders} order`, margin + 4, curY + 20);
  doc.text(`• Selesai Tepat Waktu: ${data.operational.onTimeCount} order`, margin + 4, curY + 25);
  doc.text(`• Sedang Diproses / Antrean: ${data.operational.processingOrders + data.operational.pendingOrders} order`, margin + 4, curY + 30);
  doc.text(`• Melewati Estimasi (Terlambat): ${data.operational.lateOrders} order`, margin + 4, curY + 35);

  // Quality Table (Right)
  if (data.quality) {
    const q = data.quality;
    const qualTableBody = [
      ['Cancellation Rate', formatPercentId(q.cancellationRate), q.cancellationRate <= 2 ? 'Baik (<2%)' : 'Perhatian'],
      ['Rewash Rate', formatPercentId(q.rewashRate), q.rewashRate <= 1 ? 'Sangat Baik (<1%)' : 'Evaluasi Cuci'],
      ['Complaint Rate', formatPercentId(q.complaintRate), q.complaintRate <= 1 ? 'Optimal' : 'Tindak Lanjuti'],
      ['Order Error Rate', formatPercentId(q.orderErrorRate), q.orderErrorRate <= 1 ? 'Aman' : 'Audit SOP'],
      ['Refund Rate', formatPercentId(q.refundRate), q.refundRate === 0 ? 'Nol Refund' : 'Klaim Pelanggan']
    ];

    autoTable(doc, {
      startY: curY,
      margin: { left: margin + halfWidth + 6, right: margin },
      head: [['Indikator Kualitas', 'Aktual', 'Status']],
      body: qualTableBody,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 70, 72],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 6.8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 28, halign: 'center' },
      },
    });
  }

  curY += 46;

  // Payment Breakdown Table
  const payBody = data.paymentRows.map(p => [
    p.metode,
    p.transactions.toString(),
    formatRupiahId(p.nominal),
    formatPercentId(p.percentage)
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['Metode Pembayaran', 'Total Transaksi', 'Total Nominal (Rp)', 'Pangsa Pasar (%)']],
    body: payBody.length > 0 ? payBody : [['Tunai', '0', 'Rp0', '0%']],
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 20 },
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
      0: { cellWidth: 60 },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 50, halign: 'right' },
      3: { cellWidth: 37, halign: 'right' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 7;

  // =========================================================================
  // BAB G: ANALISIS PELANGGAN & TOP 10 PELANGGAN (CUSTOMER ANALYTICS)
  // =========================================================================
  renderSectionHeader('G', 'ANALISIS PELANGGAN & TOP 10 PELANGGAN (CUSTOMER ANALYTICS)', 45);

  const topCustBody = data.topCustomers.slice(0, 10).map((c, idx) => [
    `#${idx + 1}`,
    c.nama,
    maskPhoneNumber(c.noHp),
    `${c.totalOrder}x Order`,
    formatRupiahId(c.totalSpend)
  ]);

  autoTable(doc, {
    startY: curY,
    head: [['No', 'Nama Pelanggan', 'Kontak No. HP (Disensor)', 'Frekuensi Order', 'Total Spending']],
    body: topCustBody.length > 0 ? topCustBody : [['-', 'Belum ada data pelanggan', '-', '-', 'Rp0']],
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 20 },
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
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 45 },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 40, halign: 'right' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 8;

  // =========================================================================
  // BAB H: RENCANA TINDAKAN STRATEGIS BULAN DEPAN (MONTHLY ACTION PLAN)
  // =========================================================================
  renderSectionHeader('H', 'RENCANA TINDAKAN STRATEGIS BULAN DEPAN (ACTION PLAN)', 65);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    'Rekomendasi inisiatif operasional, bisnis, dan pemasaran prioritas untuk dieksekusi oleh manajemen dan staf pada bulan berikutnya:',
    margin,
    curY
  );

  // AI Provider Badge untuk Action Plan
  if (data.aiProvider) {
    const apBadgeText = `Powered by ${data.aiProvider}`;
    const apBadgeW = doc.getTextWidth(apBadgeText) + 4;
    doc.setFillColor(13, 148, 136);
    doc.roundedRect(pageWidth - margin - apBadgeW, curY - 3.2, apBadgeW, 4, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text(apBadgeText, pageWidth - margin - apBadgeW + 2, curY - 0.3);
  }

  curY += 4.5;

  const actionTableBody = (data.actionPlans && data.actionPlans.length > 0)
    ? data.actionPlans.map(ap => [
        sanitizePdfText(ap.pilar),
        sanitizePdfText(ap.rencanaAksi),
        sanitizePdfText(ap.targetOutput),
        `${sanitizePdfText(ap.prioritas)}\n(${sanitizePdfText(ap.pic)})`
      ])
    : (data.insights && data.insights.length > 0)
      ? data.insights.map((ins, idx) => [
          `Inisiatif #${idx + 1}`,
          sanitizePdfText(ins),
          'Peningkatan Kinerja',
          'Tinggi\n(Operasional)'
        ])
      : [['-', 'Belum ada rencana tindakan yang dikonfigurasi', '-', '-']];

  autoTable(doc, {
    startY: curY,
    head: [['Pilar Strategis & Fokus', 'Rencana Tindakan Bulan Depan (Action Plan)', 'Target Indikator', 'Prioritas & PIC']],
    body: actionTableBody,
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 20 },
    headStyles: {
      fillColor: [15, 118, 110], // Dark Teal Primary
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2.6,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', textColor: [15, 118, 110] },
      1: { cellWidth: 70 },
      2: { cellWidth: 46 },
      3: { cellWidth: 28, halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 8;

  // =========================================================================
  // BAB I: GLOSARIUM & DEFINISI METRIK BISNIS (GLOSSARY)
  // =========================================================================
  renderSectionHeader('I', 'GLOSARIUM & DEFINISI METRIK BISNIS (GLOSSARY)', 65);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    'Panduan terminologi operasional, indikator kinerja utama (KPI), serta formula perhitungan yang diterapkan dalam laporan ini:',
    margin,
    curY
  );
  curY += 4.5;

  const glossaryRows = [
    [
      'Total Omzet / Pendapatan',
      'Akumulasi nilai bruto dari seluruh order layanan dan ritel yang berstatus sukses (non-void).',
      'Sum(Total Transaksi Sukses)',
      'Pertumbuhan Positif MoM'
    ],
    [
      'HPP (Harga Pokok Penjualan)',
      'Total biaya langsung bahan baku operasional (deterjen, parfum, plastik) dan modal ritel terpakai.',
      'Sum(Bahan Baku + Modal Ritel Terpakai)',
      'Maksimal 35% - 40% Omzet'
    ],
    [
      'Laba Kotor & Gross Margin',
      'Selisih total pendapatan terhadap HPP sebelum dipotong beban operasional tetap (OPEX).',
      '(Pendapatan - HPP) / Pendapatan x 100%',
      'Sehat: >= 55% - 60%'
    ],
    [
      'Biaya Operasional (OPEX)',
      'Pengeluaran rutin toko (listrik, air, gas, sewa tempat, gaji staf, maintenance mesin) di luar HPP.',
      'Alokasi Beban Operasional Terdistribusi',
      'Efisien: <= 20% Omzet'
    ],
    [
      'Laba Bersih & Net Margin',
      'Profit bersih riil yang dihasilkan outlet setelah dikurangi HPP dan seluruh biaya operasional.',
      '(Laba Kotor - OPEX) / Pendapatan x 100%',
      'Prima: >= 35% - 45%'
    ],
    [
      'On-Time SLA',
      'Ketepatan waktu pengerjaan order tepat pada atau sebelum estimasi tanggal & jam janji serah terima.',
      '(Order Tepat Waktu / Total Selesai) x 100%',
      'Standar Prima: >= 95.0%'
    ],
    [
      'Repeat Order Ratio',
      'Tingkat retensi pelanggan yang bertransaksi lebih dari 1 kali dalam rentang periode laporan.',
      '(Pelanggan Repeat / Total Pelanggan) x 100%',
      'Target Sehat: >= 40% - 50%'
    ],
    [
      'AOV (Average Order Value)',
      'Rata-rata nominal uang yang dibelanjakan pelanggan dalam satu kali nota transaksi.',
      'Total Omzet / Total Order Sukses',
      'Meningkat dengan Upsell / Bundle'
    ],
    [
      'CLV (Customer Lifetime Value)',
      'Estimasi total nilai kontribusi belanja rata-rata yang dihasilkan seorang pelanggan sepanjang hubungan.',
      'Rata-rata Belanja x Frekuensi Kunjungan',
      'Maksimalisasi via Loyalitas'
    ],
    [
      'Rewash Rate',
      'Persentase cucian yang harus dicuci ulang karena noda belum tuntas atau keluhan aroma/kebersihan.',
      '(Order Cuci Ulang / Total Order) x 100%',
      'Standar SOP: <= 1.0%'
    ],
    [
      'Cancellation Rate',
      'Persentase nota yang dibatalkan/void oleh kasir terhadap seluruh nota yang terbit.',
      '(Order Void / Total Order) x 100%',
      'Toleransi Aman: <= 2.0%'
    ],
    [
      'Safety Stock (Days to Empty)',
      'Estimasi sisa hari ketahanan stok bahan baku/produk berdasarkan rata-rata konsumsi harian.',
      'Stok Tersedia / Rata-rata Pemakaian Harian',
      'Reorder Point: H-5 Sebelum Habis'
    ],
  ];

  autoTable(doc, {
    startY: curY,
    head: [['Istilah / Metrik', 'Definisi & Penjelasan Operasional', 'Formula / Cara Hitung', 'Standar Acuan']],
    body: glossaryRows,
    theme: 'striped',
    margin: { left: margin, right: margin, bottom: 20 },
    headStyles: {
      fillColor: [30, 70, 72],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', textColor: [30, 70, 72] },
      1: { cellWidth: 74 },
      2: { cellWidth: 42, fontStyle: 'italic' },
      3: { cellWidth: 28, halign: 'center' },
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 8;

  // =========================================================================
  // FOOTER HALAMAN OTOMATIS (HALAMAN X DARI Y) - 2-TIER ANTI-OVERLAP
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer Divider Line
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    // Bersihkan format WIB ganda jika ada
    const cleanGeneratedAt = data.generatedAt.replace(/\s*WIB\s*WIB/gi, ' WIB').replace(/\s*WIB$/i, '') + ' WIB';

    // Baris 1 Footer (y = pageHeight - 7.5)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(primaryDarkTeal[0], primaryDarkTeal[1], primaryDarkTeal[2]);
    doc.text('dua SiSi Laundry Express & Coin POS', margin, pageHeight - 7.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });

    // Baris 2 Footer (y = pageHeight - 4)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('Dokumen Laporan Kinerja Bisnis & Finansial (Kerahasiaan Manajemen)', margin, pageHeight - 4);
    doc.text(`Dicetak: ${cleanGeneratedAt}  |  Oleh: ${data.generatedBy}`, pageWidth - margin, pageHeight - 4, { align: 'right' });
  }

  // Trigger Unduh Dokumen PDF
  const filename = `duaSiSi_Business_Report_${data.startDateStr}_${data.endDateStr}.pdf`;
  doc.save(filename);
}
