import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';
import { actor, HttpError, jsonBody, requireActor, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const user = requireActor(request);
    if (typeof body.kasAwal !== 'number' || body.kasAwal < 0) throw new HttpError(400, 'kasAwal harus berupa angka >= 0');
    body.namaKasir ||= user.name;
    const data = await gasAction('openKasShift', { ...body, userId: user.id, openedAt: new Date().toISOString() });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return respondError(error); }
}
