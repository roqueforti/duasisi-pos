import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';
import { HttpError, jsonBody, requireActor, respondError } from '@/lib/route-handler';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request);
    const user = requireActor(request);
    if (!body.alasan?.trim()) throw new HttpError(400, 'Alasan void wajib diisi');
    const data = await gasAction('ajukanVoidTransaksi', body.noNota || id, body.alasan.trim(), user.name, user.id);
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
