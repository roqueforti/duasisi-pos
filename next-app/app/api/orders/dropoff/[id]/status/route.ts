import { NextResponse } from 'next/server';
import { runBackend } from '@/lib/api';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';

const VALID_STATUSES = ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil', 'Selesai'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request);
    if (!VALID_STATUSES.includes(body.status)) throw new HttpError(400, 'Status tidak valid');
    const data = await runBackend('updateDropoffStatus', { noNota: body.noNota || id, ...body });
    if (!data?.success) throw new HttpError(409, 'Status gagal diperbarui');
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
