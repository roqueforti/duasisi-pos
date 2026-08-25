/**
 * Mask phone number — tampilkan hanya 4 digit terakhir, sisanya bintang.
 * Contoh: "081395448773" → "********8773"
 */
export function maskPhone(hp: string | undefined | null): string {
  if (!hp) return '-';
  const digits = String(hp).replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * Helper to encode noNota into Base64URL with deterministic hash
 */
export function encodeNotaToken(noNota: string): string {
  if (!noNota) return '';
  try {
    const cleanNota = String(noNota).trim();
    const b64 = typeof window !== 'undefined'
      ? btoa(unescape(encodeURIComponent(cleanNota))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      : Buffer.from(cleanNota).toString('base64url');
    // Generate deterministic 16-char hex hash from string
    let hash = 0;
    for (let i = 0; i < cleanNota.length; i++) {
      hash = ((hash << 5) - hash) + cleanNota.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0') + 'bdaabde5';
    return `${b64}.${hex.slice(0, 16)}`;
  } catch (e) {
    return noNota;
  }
}

/**
 * URL E-Nota resmi pelanggan.
 * Selalu menggunakan format aman dengan token terenkripsi (?t=<token>)
 * dan TIDAK PERNAH menampilkan format ?nota=...
 */
export function eNotaUrl(noNota: string, token?: string): string {
  const base = 'https://duasisilaundry-pos.vercel.app/';
  const activeToken = token || encodeNotaToken(noNota);
  return `${base}?t=${encodeURIComponent(activeToken)}`;
}

/**
 * Format string ISO date/time menjadi HH.mm
 */
export function formatTime(timeStr: string | undefined | null): string {
  if (!timeStr) return '';
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return timeStr;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}.${mm}`;
  } catch (e) {
    return timeStr;
  }
}

/**
 * Normalisasi nomor HP ke format WhatsApp internasional (62xxxx).
 * Menangani input:
 * - "089682020699" -> "6289682020699"
 * - "89682020699"  -> "6289682020699"
 * - "+6289682020699" -> "6289682020699"
 * - "6289682020699" -> "6289682020699"
 */
export function formatWaPhone(hp: string | undefined | null): string {
  if (!hp) return '';
  let clean = String(hp).replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  } else if (clean.startsWith('62')) {
    // already valid
  }
  return clean;
}

/**
 * Mengubah pesan error teknis menjadi pesan yang ramah pengguna, jelas, dan solutif.
 */
export function formatFriendlyErrorMessage(err: any): { title: string; detail: string; suggestion?: string } {
  const rawMsg = String(err?.message || err || '').trim();
  const lower = rawMsg.toLowerCase();

  // 1. Network / Timeout
  if (lower.includes('timeout') || lower.includes('aborterror') || lower.includes('failed to fetch') || lower.includes('network') || lower.includes('koneksi')) {
    return {
      title: 'Koneksi Terputus atau Lambat',
      detail: 'Aplikasi tidak dapat terhubung ke server database Google Sheets.',
      suggestion: 'Pastikan koneksi internet aktif dan stabil, lalu coba beberapa saat lagi.'
    };
  }

  // 2. Sesi / Auth
  if (lower.includes('sesi') || lower.includes('session') || lower.includes('kedaluwarsa') || lower.includes('akses ditolak')) {
    return {
      title: 'Sesi Login Kedaluwarsa',
      detail: 'Sesi Anda telah berakhir demi keamanan data.',
      suggestion: 'Silakan masukkan kembali PIN kasir / manager Anda untuk melanjutkan.'
    };
  }

  // 3. Format Berkas / Excel / CSV
  if (
    lower.includes('reading') ||
    lower.includes('undefined') ||
    lower.includes('cannot read') ||
    lower.includes('tidak sesuai') ||
    lower.includes('kolom') ||
    lower.includes('data kosong')
  ) {
    return {
      title: 'Format Berkas Tidak Sesuai',
      detail: 'Ada kolom atau baris pada file yang kosong atau formatnya tidak sesuai.',
      suggestion: 'Gunakan tombol "Template Excel" untuk memastikan susunan kolom (No HP, Nama, dsb) sesuai dengan format baku.'
    };
  }

  // 4. Data Duplikat
  if (lower.includes('duplikat') || lower.includes('duplicate') || lower.includes('sudah digunakan') || lower.includes('already exist')) {
    return {
      title: 'Ditemukan Kode/Data Duplikat',
      detail: rawMsg,
      suggestion: 'Periksa kembali kode atau nomor yang Anda masukkan agar tidak ganda.'
    };
  }

  // 5. Default
  return {
    title: 'Gagal Memproses Data',
    detail: rawMsg || 'Terjadi kendala saat berkomunikasi dengan server.',
    suggestion: 'Silakan periksa data input Anda atau hubungi manager jika kendala berlanjut.'
  };
}

