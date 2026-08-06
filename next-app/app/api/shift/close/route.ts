import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';
import { HttpError, jsonBody, requireActor, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const user = requireActor(request);
    if (!body.shiftId || !['SERAH_TERIMA', 'TUTUP_HARIAN'].includes(body.mode)) throw new HttpError(400, 'shiftId dan mode penutupan wajib diisi');
    if (typeof body.kasAkhir !== 'number' || body.kasAkhir < 0) throw new HttpError(400, 'kasAkhir harus berupa angka >= 0');
    if (body.mode === 'SERAH_TERIMA' && !body.handoverConfirmed) throw new HttpError(409, 'Serah-terima harus dikonfirmasi');
    if (body.mode === 'TUTUP_HARIAN' && body.handoverConfirmed === true) throw new HttpError(400, 'handoverConfirmed tidak diperlukan untuk tutup harian');
    const data = await gasAction('closeKasShift', { ...body, userId: user.id, userName: user.name, closedAt: new Date().toISOString() });
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
