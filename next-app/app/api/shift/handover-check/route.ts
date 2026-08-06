import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';
export async function POST(request: Request) {
  try {
    const b = await jsonBody(request); if (!b.replacementEmployeeId) throw new HttpError(400, 'replacementEmployeeId wajib diisi');
    const attendance = await prisma.absensi.findFirst({ where: { idPegawai: b.replacementEmployeeId, jamMasuk: { not: null }, ...(b.shiftId ? { idShift: b.shiftId } : {}) }, orderBy: { jamMasuk: 'desc' } });
    return NextResponse.json({ eligible: !!attendance, attendance: attendance || null });
  } catch (e) { return respondError(e); }
}
