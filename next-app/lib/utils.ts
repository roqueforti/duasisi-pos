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
