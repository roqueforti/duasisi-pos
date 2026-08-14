"use client";

import { useState, useEffect } from "react";
import { Clock, Wallet, Calculator, Send, ArrowRightCircle, DollarSign, LogOut } from "lucide-react";
import { openKasShift, closeKasShift } from "@/lib/db";

// Helper function to format Rp
function formatRp(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Helper to remove non-numeric chars for input
function parseRp(value: string): number {
  return parseInt(value.replace(/\D/g, ""), 10) || 0;
}

interface Expense {
  id: string;
  deskripsi: string;
  jumlah: number;
}

export default function ShiftPage() {
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [kasAwal, setKasAwal] = useState<number>(0);
  
  // Data simulasi saat shift berjalan
  const [omzetTunai, setOmzetTunai] = useState<number>(0);
  const [pemasukanNonTunai, setPemasukanNonTunai] = useState<number>(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  
  // Tutup Shift Inputs
  const [totalFisikKas, setTotalFisikKas] = useState<number>(0);
  const [modePenutupan, setModePenutupan] = useState<"Tutup Hari Ini" | "Serah Terima">("Tutup Hari Ini");
  const [namaStafPengganti, setNamaStafPengganti] = useState("");
  const [nomorWA, setNomorWA] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Derived calculations
  const totalPengeluaran = expenses.reduce((acc, curr) => acc + curr.jumlah, 0);
  const ekspektasiKasAkhir = kasAwal + omzetTunai - totalPengeluaran;
  const selisihKas = totalFisikKas - ekspektasiKasAkhir;

  // Lifecycle mock: In real app, we fetch from GAS if there is an active shift
  useEffect(() => {
    // Check local storage or similar for active shift mock
    const activeShift = localStorage.getItem("activeShift");
    if (activeShift) {
      const data = JSON.parse(activeShift);
      setIsShiftOpen(true);
      setKasAwal(data.kasAwal);
      // Simulate some transactions during shift
      setOmzetTunai(150000);
      setPemasukanNonTunai(50000);
    }
  }, []);

  const handleBukaShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Call GAS (mocked here if we don't have real endpoint yet)
      // await openKasShift({ kasAwal, timestamp: new Date() });
      localStorage.setItem("activeShift", JSON.stringify({ kasAwal, timestamp: new Date().toISOString() }));
      setIsShiftOpen(true);
      setOmzetTunai(0);
      setPemasukanNonTunai(0);
      setExpenses([]);
    } catch (error) {
      console.error(error);
      alert("Gagal membuka shift");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || expenseAmount <= 0) return;
    setExpenses([...expenses, { id: Date.now().toString(), deskripsi: expenseDesc, jumlah: expenseAmount }]);
    setExpenseDesc("");
    setExpenseAmount(0);
  };

  const handleRemoveExpense = (id: string) => {
    setExpenses(expenses.filter(ex => ex.id !== id));
  };

  const handleTutupShift = async () => {
    if (!nomorWA) {
      alert("Harap masukkan nomor WhatsApp tujuan pelaporan.");
      return;
    }
    
    setIsLoading(true);
    try {
      const payload = {
        kasAwal,
        omzetTunai,
        pemasukanNonTunai,
        totalPengeluaran,
        ekspektasiKasAkhir,
        totalFisikKas,
        selisihKas,
        modePenutupan,
        namaStafPengganti: modePenutupan === "Serah Terima" ? namaStafPengganti : null,
        expenses
      };
      
      // await closeKasShift(payload);
      localStorage.removeItem("activeShift");
      setIsShiftOpen(false);

      // Generate WA Message
      const message = `*LAPORAN TUTUP SHIFT* 🧾\n\n`
        + `*Mode Penutupan:* ${modePenutupan}\n`
        + (modePenutupan === "Serah Terima" ? `*Staf Pengganti:* ${namaStafPengganti}\n` : "")
        + `\n*Kas Awal:* ${formatRp(kasAwal)}\n`
        + `*Omzet Tunai:* ${formatRp(omzetTunai)}\n`
        + `*Non-Tunai:* ${formatRp(pemasukanNonTunai)}\n`
        + `*Pengeluaran:* -${formatRp(totalPengeluaran)}\n`
        + `-----------------------------------\n`
        + `*Ekspektasi Kas Laci:* ${formatRp(ekspektasiKasAkhir)}\n`
        + `*Fisik Laci:* ${formatRp(totalFisikKas)}\n`
        + `*Selisih:* ${selisihKas < 0 ? "-" : "+"}${formatRp(Math.abs(selisihKas))} ${selisihKas !== 0 ? "⚠️" : "✅"}\n\n`
        + `_Dibuat otomatis oleh Sistem POS_`;

      const encodedMessage = encodeURIComponent(message);
      // Remove any non-numeric from WA
      let cleanPhone = nomorWA.replace(/\D/g, "");
      if (cleanPhone.startsWith("0")) cleanPhone = "62" + cleanPhone.substring(1);
      
      const waLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
      
      // Open WA Link
      window.open(waLink, "_blank");
      
      // Reset State
      setKasAwal(0);
      setTotalFisikKas(0);
      setExpenses([]);
      setNomorWA("");
      
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat menutup shift");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isShiftOpen) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 text-center text-white">
            <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-sm mb-4">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Buka Kasir</h1>
            <p className="text-emerald-100 text-sm">Silakan masukkan kas awal (modal laci) untuk memulai shift Anda hari ini.</p>
          </div>
          
          <form onSubmit={handleBukaShift} className="p-8">
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Kas Awal (Modal Laci)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-medium">Rp</span>
                </div>
                <input 
                  type="text" 
                  required
                  value={kasAwal.toLocaleString("id-ID")}
                  onChange={(e) => setKasAwal(parseRp(e.target.value))}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-semibold text-lg text-slate-800"
                  placeholder="0"
                />
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
            >
              <ArrowRightCircle className="w-5 h-5" />
              {isLoading ? "Memproses..." : "Buka Shift Sekarang"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header Shift Aktif */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-bold tracking-wider uppercase">Shift Aktif</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Manajemen Penutupan Kasir</h1>
          </div>
          <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 flex items-center gap-3">
             <Wallet className="w-5 h-5 text-slate-500" />
             <div>
               <p className="text-xs text-slate-500 font-medium">Kas Awal</p>
               <p className="font-bold text-slate-800">{formatRp(kasAwal)}</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Kolom Kiri: Omzet & Pengeluaran */}
          <div className="space-y-6">
            
            {/* Omzet Shift */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-500" />
                Ringkasan Omzet
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Omzet Tunai</span>
                  <span className="font-bold text-emerald-600">{formatRp(omzetTunai)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-600 font-medium">Pemasukan Non-Tunai</span>
                  <span className="font-bold text-blue-600">{formatRp(pemasukanNonTunai)}</span>
                </div>
              </div>
            </div>

            {/* Pengeluaran */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-rose-500" />
                Input Pengeluaran
              </h2>
              <p className="text-sm text-slate-500 mb-4">Catat pengeluaran kas kecil (petty cash) selama shift berlangsung.</p>
              
              <form onSubmit={handleAddExpense} className="flex flex-col gap-3 mb-6">
                <input 
                  type="text" 
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Keterangan (Cth: Beli Sabun)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium"
                />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-400 text-sm font-medium">Rp</span>
                    </div>
                    <input 
                      type="text" 
                      value={expenseAmount.toLocaleString("id-ID")}
                      onChange={(e) => setExpenseAmount(parseRp(e.target.value))}
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                    />
                  </div>
                  <button type="submit" className="bg-slate-800 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-slate-700 transition">
                    Tambah
                  </button>
                </div>
              </form>

              {/* List Pengeluaran */}
              <div className="space-y-2">
                {expenses.map((exp) => (
                  <div key={exp.id} className="flex justify-between items-center p-3 bg-rose-50 border border-rose-100 rounded-lg">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{exp.deskripsi}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-rose-600">-{formatRp(exp.jumlah)}</span>
                      <button onClick={() => handleRemoveExpense(exp.id)} className="text-rose-400 hover:text-rose-600 font-bold px-2">×</button>
                    </div>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-sm">
                    Belum ada pengeluaran dicatat.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Kolom Kanan: Rekap & Penutupan */}
          <div className="space-y-6">
            
            {/* Hitung Fisik Laci */}
            <div className="bg-white rounded-2xl shadow-xl shadow-emerald-900/5 border border-emerald-100 p-6 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
              
              <h2 className="text-lg font-bold text-slate-800 mb-4">Rekap & Hitung Fisik</h2>
              
              <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-500 font-medium">Ekspektasi Kas Laci</span>
                </div>
                <div className="text-3xl font-black text-slate-800">{formatRp(ekspektasiKasAkhir)}</div>
                <div className="text-xs text-slate-400 mt-2 flex justify-between">
                  <span>Kas Awal: {formatRp(kasAwal)}</span>
                  <span>Tunai: +{formatRp(omzetTunai)}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Total Fisik Uang di Laci
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-bold text-lg">Rp</span>
                  </div>
                  <input 
                    type="text" 
                    value={totalFisikKas.toLocaleString("id-ID")}
                    onChange={(e) => setTotalFisikKas(parseRp(e.target.value))}
                    className="w-full pl-14 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 outline-none text-2xl font-black text-slate-800 transition-all shadow-sm"
                  />
                </div>
                
                {/* Indikator Selisih */}
                {totalFisikKas > 0 && (
                  <div className={`mt-3 p-3 rounded-lg border flex items-center justify-between ${
                    selisihKas === 0 ? "bg-emerald-50 border-emerald-200" : 
                    selisihKas > 0 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"
                  }`}>
                    <span className={`text-sm font-bold ${
                      selisihKas === 0 ? "text-emerald-700" : selisihKas > 0 ? "text-amber-700" : "text-rose-700"
                    }`}>
                      {selisihKas === 0 ? "✅ Uang Pas!" : selisihKas > 0 ? "Selisih Lebih (Plus)" : "Selisih Kurang (Minus)"}
                    </span>
                    <span className={`font-black ${
                      selisihKas === 0 ? "text-emerald-700" : selisihKas > 0 ? "text-amber-700" : "text-rose-700"
                    }`}>
                      {formatRp(Math.abs(selisihKas))}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Mode Penutupan</label>
                  <select 
                    value={modePenutupan}
                    onChange={(e) => setModePenutupan(e.target.value as any)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Tutup Hari Ini">Tutup Hari Ini (End of Day)</option>
                    <option value="Serah Terima">Serah Terima Shift Baru</option>
                  </select>
                </div>

                {modePenutupan === "Serah Terima" && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Staf Pengganti</label>
                    <input 
                      type="text" 
                      value={namaStafPengganti}
                      onChange={(e) => setNamaStafPengganti(e.target.value)}
                      placeholder="Masukkan nama staf..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-2">
                    <Send className="w-4 h-4" /> Kirim Laporan ke WhatsApp (Nomor)
                  </label>
                  <input 
                    type="text" 
                    value={nomorWA}
                    onChange={(e) => setNomorWA(e.target.value)}
                    placeholder="081234567890"
                    className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl font-bold text-emerald-800 placeholder-emerald-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={handleTutupShift}
                disabled={isLoading || !nomorWA}
                className="w-full mt-8 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-slate-900/20 flex justify-center items-center gap-2 active:scale-[0.98]"
              >
                <LogOut className="w-5 h-5" />
                {isLoading ? "Memproses..." : "Tutup Shift & Kirim WA"}
              </button>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
