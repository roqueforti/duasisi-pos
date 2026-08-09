import { NextResponse } from 'next/server';
import { runBackend } from '@/lib/api';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await jsonBody(request);
    if (!body.alasan?.trim()) throw new HttpError(400, 'Alasan void wajib diisi');
    const data = await runBackend('ajukanVoidTransaksi', body.noNota || id, body.alasan.trim());
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
