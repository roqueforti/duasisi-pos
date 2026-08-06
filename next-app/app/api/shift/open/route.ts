import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { actor, HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const b = await jsonBody(request); const a = actor(request);
    if (!b.namaKasir || b.kasAwal === undefined) throw new HttpError(400, 'namaKasir dan kasAwal wajib diisi');
    const result = await prisma.$transaction(async (tx) => {
      const open = await tx.shift.findFirst({ where: { status: 'Buka', idPegawai: b.idPegawai || a.id } });
      if (open) throw new HttpError(409, 'Pegawai masih memiliki shift terbuka');
      return tx.shift.create({ data: { namaKasir: b.namaKasir, kasAwal: b.kasAwal, idPegawai: b.idPegawai || a.id, status: 'Buka', waktuBuka: new Date(), catatan: b.catatan || null } });
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) { return respondError(e); }
}
