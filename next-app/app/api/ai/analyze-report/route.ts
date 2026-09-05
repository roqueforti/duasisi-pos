import { NextResponse } from 'next/server';

export interface ActionPlanItem {
  pilar: string;
  rencanaAksi: string;
  targetOutput: string;
  prioritas: 'Tinggi' | 'Sedang' | 'Rutin';
  pic: string;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      periodeLabel,
      kpi,
      financials,
      quality,
      serviceRows = [],
      topCustomers = [],
      operational,
      criticalItems = [],
      churnedCount = 0,
      monthlyTargets = {},
    } = body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // Helper format rupiah lokal
    const formatRp = (val: number) => 'Rp' + (Math.round(Number(val) || 0)).toLocaleString('id-ID');
    const formatPct = (val: number) => (Number(val) || 0).toFixed(1).replace('.', ',') + '%';

    const topService = serviceRows[0] || { layanan: 'Cuci Kering 7kg', percentage: 40, revenue: 0 };
    const revTotal = kpi?.totalRevenue || 0;
    const trxCount = kpi?.totalTransactions || 0;
    const custCount = kpi?.totalCustomers || 0;
    const repCustCount = kpi?.repeatCustomers || 0;
    const repRatio = kpi?.repeatOrderRatio || 0;
    const aov = kpi?.avgOrderValue || (trxCount > 0 ? Math.round(revTotal / trxCount) : 35000);
    const marginKotor = financials?.marginKotor || 60;
    const marginBersih = financials?.marginBersih || 45;
    const onTimeRate = operational?.onTimeRate || 100;
    const rewashRate = quality?.rewashRate || 0;

    // 1. JIKA ADA GEMINI API KEY, GUNAKAN GEMINI AI RESMI
    if (apiKey) {
      try {
        const prompt = `Anda adalah Senior Business & Operations Analyst terkemuka untuk bisnis jaringan laundry modern ("dua SiSi Laundry Express & Coin POS").
Berdasarkan data performa aktual berikut:
- Periode: ${periodeLabel}
- Total Pendapatan / Omzet: ${formatRp(revTotal)} dari ${trxCount} total order sukses
- Total Pelanggan: ${custCount} orang (${repCustCount} repeat order, rasio retensi: ${formatPct(repRatio)})
- Rata-rata Nilai Order (AOV): ${formatRp(aov)}
- Finansial: HPP ${formatRp(financials?.hpp || 0)}, Laba Kotor ${formatRp(financials?.labaKotor || 0)} (Margin: ${formatPct(marginKotor)}), Laba Bersih ${formatRp(financials?.labaBersih || 0)} (Margin: ${formatPct(marginBersih)})
- Kualitas & SLA: On-Time SLA ${formatPct(onTimeRate)}, Rewash Rate ${formatPct(rewashRate)}, Cancellation Rate ${formatPct(quality?.cancellationRate || 0)}
- Layanan Terlaris: "${topService.layanan}" (${formatPct(topService.percentage)} kontribusi omzet)
- Stok Kritis/Menipis: ${criticalItems.length > 0 ? criticalItems.join(', ') : 'Semua stok dalam batas aman'}
- Pelanggan Tidak Aktif (>30 hari): ${churnedCount} pelanggan
- Target Omzet Bulanan Toko: ${monthlyTargets?.targetRevenue ? formatRp(monthlyTargets.targetRevenue) : formatRp(Math.round(revTotal * 1.15))}

Hasilkan analisis bisnis formal profesional dalam format JSON MURNI tanpa markdown tambahan (jangan gunakan triple backticks \`\`\`json):
{
  "executiveSummaryOpening": "Paragraf pembuka ringkasan eksekutif formal sepanjang 3-4 kalimat padat yang mengevaluasi performa finansial, efisiensi operasional, dan kepuasan pelanggan periode ini.",
  "actionPlans": [
    {
      "pilar": "1. Akselerasi Omzet & Penjualan",
      "rencanaAksi": "Rencana tindakan konkret pemasaran/penjualan bulan depan...",
      "targetOutput": "Target angka terukur (misal target omzet / AOV)...",
      "prioritas": "Tinggi",
      "pic": "Kasir & Marketing"
    },
    {
      "pilar": "2. Retensi Pelanggan & CRM",
      "rencanaAksi": "Rencana tindakan retensi & re-engagement pelanggan churn...",
      "targetOutput": "Target rasio repeat order terukur...",
      "prioritas": "Tinggi",
      "pic": "CRM / Manajer"
    },
    {
      "pilar": "3. Manajemen Stok & Pengendalian HPP",
      "rencanaAksi": "Rencana pengadaan bahan baku & audit pemakaian...",
      "targetOutput": "Target buffer stock & margin kotor...",
      "prioritas": "Sedang",
      "pic": "Logistik & Gudang"
    },
    {
      "pilar": "4. Standar Mutu & Zero-Rewash",
      "rencanaAksi": "SOP penanganan noda (spotting) dan pencegahan rewash...",
      "targetOutput": "Target rewash rate <= 1%...",
      "prioritas": "Rutin",
      "pic": "Tim Cuci & Finishing"
    },
    {
      "pilar": "5. Disiplin SLA & Efisiensi Pengerjaan",
      "rencanaAksi": "Sistem antrean Kanban dan kecepatan turnaround...",
      "targetOutput": "Target on-time rate >= 98%...",
      "prioritas": "Tinggi",
      "pic": "Supervisor Operasional"
    }
  ],
  "insights": [
    "Insight strategis 1",
    "Insight strategis 2",
    "Insight strategis 3",
    "Insight strategis 4",
    "Insight strategis 5"
  ]
}`;

        // Gunakan model gemini-3.5-flash (latest stable)
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
        const aiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
          }),
        });

        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          const candidateText = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleanedText = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedText);

          if (parsed.executiveSummaryOpening && Array.isArray(parsed.actionPlans)) {
            return NextResponse.json({
              success: true,
              aiGenerated: true,
              provider: 'Google Gemini AI',
              data: parsed,
            });
          }
        }
      } catch (geminiError) {
        console.warn('Gemini API call failed, falling back to Intelligent Heuristics Engine:', geminiError);
      }
    }

    // 2. FALLBACK: HEURISTIC AI ENGINE (dua SiSi Deep Heuristic Analyst)
    // Mesin analitik deterministik berbasis aturan cerdas yang menganalisis angka secara mendalam
    const criticalStr = criticalItems.length > 0 ? criticalItems.slice(0, 2).join(' dan ') : '';
    const targetOmzetStr = monthlyTargets?.targetRevenue > 0
      ? formatRp(monthlyTargets.targetRevenue)
      : formatRp(Math.round(revTotal * 1.15));

    const executiveSummaryOpening = `Laporan kinerja bisnis dua SiSi Laundry Express & Coin POS periode ${periodeLabel} mencatat akumulasi pendapatan sebesar ${formatRp(revTotal)} melalui penanganan ${trxCount} order dengan margin laba kotor yang berada pada level sehat ${formatPct(marginKotor)}. Tingkat ketepatan waktu pengerjaan (On-Time SLA) tercapai sebesar ${formatPct(onTimeRate)}, mencerminkan efisiensi operasional harian yang disiplin. Analisis data menunjukkan potensi penguatan pada retensi repeat order yang saat ini berada di angka ${formatPct(repRatio)}, serta pengamanan ketersediaan stok bahan baku penting guna mempertahankan laju pertumbuhan outlet pada bulan berikutnya.`;

    const actionPlans: ActionPlanItem[] = [
      {
        pilar: '1. Akselerasi Omzet & Penjualan',
        rencanaAksi: `Tingkatkan promosi paket bundling dan upselling untuk layanan unggulan '${topService.layanan}' (penyumbang ${formatPct(topService.percentage)} omzet), serta aktifkan program diskon Happy Hour (pukul 10.00-13.00) pada hari kerja guna memaksimalkan utilitas mesin di jam sepi.`,
        targetOutput: `Target Omzet: ${targetOmzetStr} & AOV ${formatRp(Math.round(aov * 1.1))}`,
        prioritas: 'Tinggi',
        pic: 'Kasir & Marketing',
      },
      {
        pilar: '2. Retensi Pelanggan & CRM',
        rencanaAksi: `Lakukan kampanye WhatsApp re-engagement terarah dengan kupon selamat datang kembali kepada ${churnedCount || Math.max(1, custCount - repCustCount)} pelanggan yang belum bertransaksi dalam 30 hari terakhir, serta tawarkan benefit poin loyalitas eksklusif untuk 10 pelanggan pembelanja terbesar (Top Spender).`,
        targetOutput: `Repeat Order Ratio ≥ ${Math.max(monthlyTargets?.targetRepeatRatio || 45, Math.round(repRatio + 5))}%`,
        prioritas: 'Tinggi',
        pic: 'CRM / Manajer',
      },
      {
        pilar: '3. Manajemen Stok & Pengendalian HPP',
        rencanaAksi: `Jadwalkan Purchase Order (PO) pengadaan stok bahan baku ${criticalStr ? `(prioritas: ${criticalStr})` : 'deterjen dan parfum konsentrat'} minimal H-5 sebelum estimasi habis pakai, serta berlakukan audit takaran per kg cucian demi menjaga margin kotor tetap di atas 60%.`,
        targetOutput: `Safety Stock ≥ 7 Hari & Margin Kotor ≥ ${Math.max(60, Math.round(marginKotor))}%`,
        prioritas: 'Sedang',
        pic: 'Logistik & Gudang',
      },
      {
        pilar: '4. Standar Mutu & Zero-Rewash',
        rencanaAksi: `Wajibkan inspeksi noda awal (spotting) saat penerimaan pakaian di kasir dan pemeriksaan menyeluruh saat proses finishing/packing untuk memastikan pakaian bebas noda dan aroma segar maksimal demi mempertahankan reputasi kualitas.`,
        targetOutput: `Rewash Rate ≤ 1.0% & Nol Refund`,
        prioritas: 'Rutin',
        pic: 'Tim Cuci & Finishing',
      },
      {
        pilar: '5. Disiplin SLA & Kecepatan Order',
        rencanaAksi: `Pantau papan antrean Kanban secara real-time, prioritaskan proses pencucian untuk nota yang mendekati estimasi tenggat waktu selesai, dan lakukan evaluasi harian sebelum pergantian shift kasir demi mencegah komplain keterlambatan.`,
        targetOutput: `On-Time SLA ≥ 98.0% & Nol Keterlambatan`,
        prioritas: 'Tinggi',
        pic: 'Supervisor Operasional',
      },
    ];

    const insights = [
      `Akselerasi Penjualan: Fokuskan promosi pada '${topService.layanan}' (${formatPct(topService.percentage)} pendapatan) dan program happy-hour jam sepi.`,
      `Retensi Pelanggan: Reaktivasi ${churnedCount || Math.max(1, custCount - repCustCount)} pelanggan tidak aktif >30 hari via WhatsApp voucher promo.`,
      `Efisiensi HPP: Jaga margin kotor pada kisaran ${formatPct(marginKotor)} dengan audit takaran deterjen dan safety stock teratur.`,
      `Standar Kualitas: Pertahankan rewash rate pada ${formatPct(rewashRate)} dengan SOP spotting noda saat penerimaan cucian.`,
      `Ketepatan Waktu: Monitor Kanban real-time untuk mempertahankan On-Time SLA pada level ${formatPct(onTimeRate)}.`,
    ];

    return NextResponse.json({
      success: true,
      aiGenerated: false,
      provider: 'dua SiSi Intelligence Engine',
      data: {
        executiveSummaryOpening,
        actionPlans,
        insights,
      },
    });
  } catch (err: any) {
    console.error('API AI Report Error:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
