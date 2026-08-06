'use client';

import React, { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';

const PAIN_POINTS = [
  "📝 Pembukuan masih manual (pakai buku tulis)",
  "💸 Sering selisih/salah hitung uang di kasir",
  "🔍 Susah melacak pakaian pelanggan (sering tertukar/hilang)",
  "⚙️ Susah memantau mesin mana yang sedang dipakai (khusus koin/self-service)",
  "💬 Pelanggan sering komplain nanya \"cucian saya sudah selesai belum?\"",
  "📈 Tidak tahu pasti berapa keuntungan atau kerugian bulan ini",
  "🤷‍♂️ Tidak tahu siapa penanggung jawab di suatu proses tiap ordernya"
];

const FEATURES = [
  "📱 Kirim pesan WhatsApp otomatis ke pelanggan kalau cucian selesai",
  "🖨️ Bisa cetak struk/nota pembayaran langsung",
  "📊 Laporan pendapatan dan omzet otomatis tiap hari",
  "🧺 Fitur pantau mesin (tahu mesin mana yang kosong/rusak/jalan)",
  "📦 Pencatatan stok barang (sabun, parfum, plastik, dll)",
  "👥 Ada sistem pergantian shift kasir (biar ketahuan uangnya pas atau tidak)"
];

export default function RequirementsForm() {
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    laundryType: '',
    painPoints: [] as string[],
    features: [] as string[],
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (field: 'painPoints' | 'features', value: string) => {
    setFormData(prev => {
      const list = prev[field];
      if (list.includes(value)) {
        return { ...prev, [field]: list.filter(item => item !== value) };
      } else {
        return { ...prev, [field]: [...list, value] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...formData, version: 'v2' })
      });
      
      if (res.ok) {
        setIsSuccess(true);
        setFormData({
          name: '',
          role: '',
          laundryType: '',
          painPoints: [],
          features: [],
          notes: ''
        });
      }
    } catch (error) {
      console.error('Failed to submit form', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="h-screen overflow-y-auto bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Terima Kasih!</h2>
          <p className="text-gray-600">
            Masukan Anda sangat berarti bagi kami untuk membuat sistem Kasir Laundry yang paling mudah digunakan.
          </p>
          <button
            onClick={() => setIsSuccess(false)}
            className="mt-6 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Kirim Masukan Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Survei Kebutuhan Kasir Laundry
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Bantu kami merancang aplikasi POS (Kasir) yang paling pas dan mudah dipakai untuk usaha Laundry Anda (Self-Service & Drop-off).
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
            
            {/* 1. Data Diri */}
            <div className="space-y-5">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2">1. Kenalan Dulu Ya</h3>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Anda / Nama Usaha</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border bg-gray-50"
                  placeholder="Contoh: Budi (Budi Laundry)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Peran Anda</label>
                  <select
                    name="role"
                    required
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border bg-gray-50"
                  >
                    <option value="">-- Pilih --</option>
                    <option value="Pemilik Usaha">Pemilik Usaha (Owner)</option>
                    <option value="Kasir / Karyawan">Kasir / Karyawan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fokus Layanan Laundry</label>
                  <select
                    name="laundryType"
                    required
                    value={formData.laundryType}
                    onChange={handleChange}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border bg-gray-50"
                  >
                    <option value="">-- Pilih --</option>
                    <option value="Self Service (Koin)">Full Self Service (Koin/QRIS)</option>
                    <option value="Drop-off (Kiloan/Satuan)">Full Drop-off (Kiloan/Satuan)</option>
                    <option value="Campuran (Keduanya)">Campuran (Keduanya)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Masalah */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2">2. Masalah Apa Saja yang Sering Dialami?</h3>
              <p className="text-sm text-gray-500">Boleh pilih lebih dari satu yang paling bikin pusing.</p>
              
              <div className="space-y-3 mt-3">
                {PAIN_POINTS.map((point, idx) => (
                  <label key={idx} className="flex items-start space-x-3 cursor-pointer group p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                    <div className="flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={formData.painPoints.includes(point)}
                        onChange={() => handleCheckboxChange('painPoints', point)}
                        className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-gray-700 text-sm md:text-base leading-snug group-hover:text-blue-700">{point}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. Fitur */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2">3. Fitur Apa yang Paling Anda Harapkan?</h3>
              <p className="text-sm text-gray-500">Pilih fitur yang menurut Anda wajib ada di mesin kasir nanti.</p>
              
              <div className="space-y-3 mt-3">
                {FEATURES.map((feat, idx) => (
                  <label key={idx} className="flex items-start space-x-3 cursor-pointer group p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                    <div className="flex-shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={formData.features.includes(feat)}
                        onChange={() => handleCheckboxChange('features', feat)}
                        className="h-5 w-5 text-green-500 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-gray-700 text-sm md:text-base leading-snug group-hover:text-green-700">{feat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 4. Lainnya */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800 border-b pb-2">4. Punya Curhatan / Ide Tambahan? (Opsional)</h3>
              <div>
                <textarea
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={handleChange}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border bg-gray-50"
                  placeholder="Ketik di sini jika ada fitur atau masalah lain yang belum disebutkan di atas..."
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? (
                  'Menyimpan...'
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Kirim Jawaban
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
