// ============================================================
// LAPORAN & VISUALISASI
// ============================================================
function getLaporanRange(startDateStr, endDateStr) {
  const sh = SS.getSheetByName(SHEET_TRANSAKSI);
  const shD = SS.getSheetByName(SHEET_DETAIL);

  const dataHeader = sh.getDataRange().getValues();
  dataHeader.shift();
  const dataDetail = shD.getDataRange().getValues();
  dataDetail.shift();

  const filtered = dataHeader.filter(r => {
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    const isVoid = r[9] === "Approved" || r[5] === "Void" || r[5] === "Batal";
    return tgl >= startDateStr && tgl <= endDateStr && !isVoid;
  });

  let totalOmzet = 0;
  const omzetHarianMap = {};
  const transaksiList = [];
  let selfCount = 0, fullCount = 0;

  filtered.forEach(r => {
    const tgl = fmtWib(r[1], "yyyy-MM-dd");
    const total = r[4];
    totalOmzet += total;
    if (r[8] === "FullService") fullCount++; else selfCount++;

    if (!omzetHarianMap[tgl]) omzetHarianMap[tgl] = { omzet: 0, jumlah: 0 };
    omzetHarianMap[tgl].omzet += total;
    omzetHarianMap[tgl].jumlah += 1;

    const items = dataDetail.filter(d => d[0] === r[0]).map(d => ({ layanan: d[1], qty: d[2], subtotal: d[4] }));
    transaksiList.push({
      noNota: r[0], tanggal: fmtWib(r[1]), namaPelanggan: r[2], noHp: String(r[3] || ''),
      total: total, status: r[5], petugas: r[7] || "Kasir", tipe: r[8] || "SelfService",
      statusVoid: r[9] || "None", alasanVoid: r[10] || "", metodeBayar: r[13] || "",
      statusPembayaran: r[14] || "Lunas", nominalDP: Number(r[15]) || 0,
      sisaTagihan: Number(r[16]) || 0, items: items
    });
  });

  const omzetHarian = Object.keys(omzetHarianMap).sort().map(tgl => ({
    tanggal: tgl, omzet: omzetHarianMap[tgl].omzet, jumlahTransaksi: omzetHarianMap[tgl].jumlah
  }));

  const notaSet = {};
  filtered.forEach(r => notaSet[r[0]] = true);
  const layananMap = {};
  dataDetail.forEach(d => {
    if (notaSet[d[0]]) {
      const nama = d[1];
      if (!layananMap[nama]) layananMap[nama] = { qty: 0, omzet: 0 };
      layananMap[nama].qty += Number(d[2]);
      layananMap[nama].omzet += Number(d[4]);
    }
  });
  const layananTerlaris = Object.keys(layananMap)
    .map(nama => ({ layanan: nama, qty: layananMap[nama].qty, omzet: layananMap[nama].omzet }))
    .sort((a, b) => b.omzet - a.omzet);

  const jumlahTransaksi = filtered.length;
  const rataRata = jumlahTransaksi > 0 ? Math.round(totalOmzet / jumlahTransaksi) : 0;

  return {
    ringkasan: {
      totalOmzet: Number(totalOmzet) || 0,
      jumlahTransaksi: Number(jumlahTransaksi) || 0,
      rataRata: Number(rataRata) || 0,
      selfCount: Number(selfCount) || 0,
      fullCount: Number(fullCount) || 0
    },
    omzetHarian,
    layananTerlaris,
    transaksiList: transaksiList.reverse()
  };
}
