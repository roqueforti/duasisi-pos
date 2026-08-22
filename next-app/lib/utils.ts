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
