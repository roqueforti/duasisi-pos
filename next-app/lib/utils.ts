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
 * Parse string tanggal Indonesia, format DD/MM/YYYY, ISO, timestamp, dsb.
 * Menangani nama & singkatan bulan Indonesia (Agu, Mei, Okt, Des dsb) yang gagal di-parse oleh new Date() standar.
 */
export function parseIndonesianDateTime(val: string | Date | undefined | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  let str = String(val).trim();
  if (!str || str === '-') return null;

  // Hapus teks zona waktu umum
  str = str.replace(/\s*WIB|\s*WITA|\s*WIT/gi, '').trim();

  // 1. Coba format DD/MM/YYYY [HH:mm[:ss]]
  if (str.includes('/')) {
    const spaceParts = str.split(' ');
    const dateParts = spaceParts[0].split('/');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const year = parseInt(dateParts[2], 10);
      let hh = 0, mm = 0, ss = 0;
      if (spaceParts[1]) {
        const timeParts = spaceParts[1].split(':');
        hh = parseInt(timeParts[0], 10) || 0;
        mm = parseInt(timeParts[1], 10) || 0;
        ss = parseInt(timeParts[2], 10) || 0;
      }
      const d = new Date(year, month, day, hh, mm, ss);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 2. Coba format tanggal dengan nama/singkatan bulan Indonesia atau Inggris
  const indoMonths: Record<string, number> = {
    jan: 0, januari: 0, january: 0,
    feb: 1, februari: 1, february: 1,
    mar: 2, maret: 2, march: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5, june: 5,
    jul: 6, juli: 6, july: 6,
    agu: 7, ags: 7, agustus: 7, aug: 7, august: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9, oct: 9, october: 9,
    nov: 10, november: 10,
    des: 11, desember: 11, dec: 11, december: 11,
  };

  const textMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:[,\s]+(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?)?/);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const mKey = textMatch[2].toLowerCase();
    const month = indoMonths[mKey];
    const year = parseInt(textMatch[3], 10);
    const hh = parseInt(textMatch[4] || '0', 10);
    const mm = parseInt(textMatch[5] || '0', 10);
    const ss = parseInt(textMatch[6] || '0', 10);
    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      const d = new Date(year, month, day, hh, mm, ss);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 3. Fallback standard JavaScript Date parse (ISO string dsb.)
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format string tanggal & waktu (ISO, timestamps, dd/MM/yyyy dsb) menjadi tampilan
 * yang rapi, mudah dibaca, dan selalu disesuaikan ke zona waktu Indonesia (WIB).
 *
 * Contoh hasil:
 * - "2026-09-03T14:39:00+00:00" -> "03 Sep 2026, 21:39 WIB"
 * - "2026-09-03T21:39:00"       -> "03 Sep 2026, 21:39 WIB"
 * - "03/09/2026 21:39:00"       -> "03 Sep 2026, 21:39 WIB"
 */
export function formatDateTime(
  val: string | Date | undefined | null,
  options?: { showWib?: boolean; showTime?: boolean; dateOnly?: boolean; timeOnly?: boolean }
): string {
  if (!val) return '-';
  try {
    let d: Date | null = null;
    if (val instanceof Date) {
      d = val;
    } else {
      const str = String(val).trim();
      if (!str || str === '-') return '-';

      // Tangani format "DD/MM/YYYY HH:mm[:ss]" atau "DD/MM/YYYY"
      if (str.includes('/')) {
        const cleanStr = str.replace(/\s*WIB|\s*WITA|\s*WIT/gi, '').trim();
        const spaceParts = cleanStr.split(' ');
        const dateParts = spaceParts[0].split('/');
        if (dateParts.length === 3) {
          const day = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          const year = parseInt(dateParts[2], 10);
          let hh = 0, mm = 0, ss = 0;
          const hasTime = Boolean(spaceParts[1]);
          if (hasTime) {
            const timeParts = spaceParts[1].split(':');
            hh = parseInt(timeParts[0], 10) || 0;
            mm = parseInt(timeParts[1], 10) || 0;
            ss = parseInt(timeParts[2], 10) || 0;
          }
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          const monthStr = months[month] || String(month + 1);
          const dayStr = String(day).padStart(2, '0');
          const hhStr = String(hh).padStart(2, '0');
          const mmStr = String(mm).padStart(2, '0');
          const wibSuffix = options?.showWib !== false ? ' WIB' : '';

          if (options?.dateOnly || !hasTime) {
            return `${dayStr} ${monthStr} ${year}`;
          }
          if (options?.timeOnly) {
            return `${hhStr}:${mmStr}${wibSuffix}`;
          }
          return `${dayStr} ${monthStr} ${year}, ${hhStr}:${mmStr}${wibSuffix}`;
        }
      }

      d = new Date(str);
    }

    if (!d || isNaN(d.getTime())) return String(val);

    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    let day = '', month = '', year = '', hour = '', minute = '';
    for (const part of parts) {
      if (part.type === 'day') day = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'year') year = part.value;
      if (part.type === 'hour') hour = part.value;
      if (part.type === 'minute') minute = part.value;
    }

    const wibSuffix = options?.showWib !== false ? ' WIB' : '';
    if (options?.dateOnly) {
      return `${day} ${month} ${year}`;
    }
    if (options?.timeOnly) {
      return `${hour}:${minute}${wibSuffix}`;
    }

    return `${day} ${month} ${year}, ${hour}:${minute}${wibSuffix}`;
  } catch {
    return String(val || '-');
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

/**
 * Normalisasi dan parse angka desimal secara aman.
 * Mendukung format string Indonesia (koma) maupun standar internasional (titik).
 * Contoh: "0,02" -> 0.02, "0.02" -> 0.02, 0.02 -> 0.02, null/undefined -> defaultVal
 */
export function parseDecimal(val: any, defaultVal = 0): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const str = String(val).trim().replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? defaultVal : n;
}

/**
 * Format angka desimal untuk tampilan UI dengan batas maksimal digit desimal
 * dan membersihkan floating-point rounding issue (misal 19.980000000000004 -> "19,98").
 */
export function formatDecimal(val: number | string | undefined | null, maxDigits = 4): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'number' ? val : parseDecimal(val, 0);
  if (isNaN(num)) return '0';
  const factor = Math.pow(10, maxDigits);
  const rounded = Math.round((num + Number.EPSILON) * factor) / factor;
  return rounded.toLocaleString('id-ID', { maximumFractionDigits: maxDigits });
}


