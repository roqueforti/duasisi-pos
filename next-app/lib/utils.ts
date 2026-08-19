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
 * Encode noNota ke URL token — base64url(noNota) saja (tanpa HMAC).
 * HMAC hanya di-verify di backend GAS. Frontend cukup encode base64.
 * Format sama: base64url(noNota) + "." + "0000000000000000" (placeholder)
 * Backend akan verify HMAC-nya sendiri.
 *
 * Untuk link dari Riwayat (tidak punya token asli dari GAS),
 * gunakan format ?nota=noNota saja sebagai fallback.
 */
export function eNotaUrl(noNota: string, token?: string): string {
  const base = 'https://duasisilaundry-pos.vercel.app/';
  if (token) return `${base}?t=${encodeURIComponent(token)}`;
  // fallback — noNota visible, tapi masih bisa dibuka
  return `${base}?nota=${encodeURIComponent(noNota)}`;
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
