import { AbsensiConfig } from './types';

/**
 * Menghitung jarak antara dua koordinat GPS menggunakan formula Haversine (dalam meter)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radius bumi dalam meter
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Mengambil koordinat GPS dari perangkat tablet / browser
 */
export function getCurrentGpsLocation(): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Browser / Perangkat tablet tidak mendukung GPS Geolocation.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
        });
      },
      (error) => {
        let msg = 'Gagal mendeteksi lokasi GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Izin akses lokasi GPS ditolak oleh browser/tablet. Silakan izinkan akses lokasi (GPS) pada pengaturan browser.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Informasi sinyal lokasi GPS tidak tersedia pada perangkat.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Waktu permintaan lokasi GPS habis (timeout). Silakan coba lagi.';
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
  });
}

/**
 * Mengambil alamat IP publik koneksi perangkat
 */
export async function getClientIpAddress(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
    const json = await res.json();
    if (json && json.ip) return json.ip.trim();
  } catch {
    // Fallback 1
  }

  try {
    const res2 = await fetch('https://icanhazip.com', { signal: AbortSignal.timeout(4000) });
    const text = await res2.text();
    if (text && text.trim()) return text.trim();
  } catch {
    // Fallback 2
  }

  return '';
}

/**
 * Validasi keamanan presensi: IP Whitelist & GPS Geofencing Whitelist
 * CATATAN: Sesuai arahan, aturan IP whitelist dinonaktifkan / dibypass.
 */
export async function validateAttendanceSecurity(
  config?: AbsensiConfig | null
): Promise<{
  valid: boolean;
  message?: string;
  clientIp?: string;
  distanceMeter?: number;
}> {
  if (!config) {
    return { valid: true };
  }

  // 1. ATURAN IP WHITELIST: DINONAKTIFKAN / BYPASS
  // Tidak memblokir dan tidak melakukan blocking network IP call

  // 2. VALIDASI GPS GEOFENCING (Hanya jika diaktifkan secara eksplisit)
  if (
    config.aktifGeofence &&
    config.outletLatitude !== undefined &&
    config.outletLongitude !== undefined &&
    (config.outletLatitude !== 0 || config.outletLongitude !== 0)
  ) {
    try {
      const coords = await getCurrentGpsLocation();
      const distance = calculateDistance(
        coords.latitude,
        coords.longitude,
        config.outletLatitude,
        config.outletLongitude
      );
      const radiusMaks = config.geofenceRadiusMeter || 100;

      if (distance > radiusMaks) {
        return {
          valid: false,
          distanceMeter: Math.round(distance),
          message: `Akses Presensi Ditolak: Anda berada di luar radius outlet (Jarak: ${Math.round(
            distance
          )} meter, Batas Maksimal: ${radiusMaks} meter).`,
        };
      }

      return {
        valid: true,
        distanceMeter: Math.round(distance),
      };
    } catch (gpsError: any) {
      return {
        valid: false,
        message: `Validasi GPS Gagal: ${gpsError.message || 'Harap aktifkan GPS pada tablet untuk absensi.'}`,
      };
    }
  }

  return { valid: true };
}

