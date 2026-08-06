import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';
import { HttpError, jsonBody, requireActor, respondError } from '@/lib/route-handler';

const statuses = ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil', 'Selesai'];
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request); const user = requireActor(request);
    if (!statuses.includes(body.status)) throw new HttpError(400, 'Status drop-off tidak valid');
    if (['Dicuci', 'Dikeringkan'].includes(body.status) && !body.washerId && !body.dryerId) throw new HttpError(400, 'Nomor washer/dryer wajib diisi pada tahap mesin');
    const data = await gasAction('updateStatus', body.noNota || id, body.status, { washerId: body.washerId, dryerId: body.dryerId, catatan: body.catatan, userId: user.id });
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
