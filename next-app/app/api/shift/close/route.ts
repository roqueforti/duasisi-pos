import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';
import { actor, HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const user = actor(request);
    if (!body.shiftId || !['SERAH_TERIMA', 'TUTUP_HARIAN'].includes(body.mode)) throw new HttpError(400, 'shiftId dan mode penutupan wajib diisi');
    const data = await gasAction('closeKasShift', { ...body, userId: user.id, userName: user.name });
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
