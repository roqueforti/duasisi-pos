import { NextResponse } from 'next/server';
import { gasActionWithSession } from '@/lib/db';
import { HttpError, jsonBody, requireActor, requireBackendSession, respondError } from '@/lib/route-handler';

const statuses = ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil', 'Selesai'];
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request); const user = requireActor(request);
    const sessionToken = requireBackendSession(request);
    if (!statuses.includes(body.status)) throw new HttpError(400, 'Status drop-off tidak valid');
    if (['Dicuci', 'Dikeringkan'].includes(body.status) && !body.washerId && !body.dryerId) throw new HttpError(400, 'Nomor washer/dryer wajib diisi pada tahap mesin');
    const data = await gasActionWithSession(sessionToken, 'updateDropoffStatus', {
      noNota: body.noNota || id,
      status: body.status,
      washerId: body.washerId,
      dryerId: body.dryerId,
      catatan: body.catatan,
      assignedStaff: body.assignedStaff || user.name,
      userName: user.name,
      userId: user.id,
    });
    if (!data?.success) throw new HttpError(409, data?.message || 'Status drop-off gagal diperbarui');
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
