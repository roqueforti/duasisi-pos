import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';
import { actor, HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const user = actor(request);
    if (!body.namaKasir || body.kasAwal === undefined) throw new HttpError(400, 'namaKasir dan kasAwal wajib diisi');
    const data = await gasAction('openKasShift', { ...body, userId: user.id });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return respondError(error); }
}
