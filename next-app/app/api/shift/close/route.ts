import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { actor, HttpError, jsonBody, respondError } from '@/lib/route-handler';
export async function POST(request: Request) {
  try {
    const b = await jsonBody(request); const a = actor(request);
    if (!b.shiftId || !['SERAH_TERIMA', 'TUTUP_HARIAN'].includes(b.mode)) throw new HttpError(400, 'shiftId dan mode penutupan wajib diisi');
    const result = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: b.shiftId } });
      if (!shift || shift.status !== 'Buka') throw new HttpError(404, 'Shift terbuka tidak ditemukan');
      if (b.mode === 'SERAH_TERIMA') {
        if (!b.replacementEmployeeId) throw new HttpError(400, 'replacementEmployeeId wajib untuk serah-terima');
        const ok = await tx.absensi.findFirst({ where: { idPegawai: b.replacementEmployeeId, jamMasuk: { not: null }, ...(b.replacementShiftId ? { idShift: b.replacementShiftId } : {}) } });
        if (!ok) throw new HttpError(409, 'Shift belum dapat ditutup: staf pengganti belum clock-in');
      }
      const closed = await tx.shift.update({ where: { id: shift.id }, data: { status: 'Tutup', kasAkhir: b.kasAkhir, waktuTutup: new Date(), selisihKas: b.kasAkhir !== undefined ? Number(b.kasAkhir) - Number(shift.kasAwal) : null, catatan: b.catatan || (b.mode === 'TUTUP_HARIAN' ? 'Tutup operasional hari ini' : null) } });
      await tx.auditLog.create({ data: { idUser: a.id, namaUser: a.name, jenisAktivitas: 'SHIFT_CLOSE', referensi: shift.id, detail: JSON.stringify({ mode: b.mode, replacementEmployeeId: b.replacementEmployeeId || null }) } });
      return closed;
    });
    return NextResponse.json({ data: result });
  } catch (e) { return respondError(e); }
}
