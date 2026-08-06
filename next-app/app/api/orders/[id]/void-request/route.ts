import { NextResponse } from 'next/server';
import { gasActionWithSession } from '@/lib/db';
import { HttpError, jsonBody, requireActor, requireBackendSession, respondError } from '@/lib/route-handler';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request);
    const user = requireActor(request);
    const sessionToken = requireBackendSession(request);
    if (!body.alasan?.trim()) throw new HttpError(400, 'Alasan void wajib diisi');
    const data = await gasActionWithSession(sessionToken, 'ajukanVoidTransaksi', body.noNota || id, body.alasan.trim(), user.name, user.id);
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
