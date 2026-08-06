import { NextResponse } from 'next/server';
import { gasActionWithSession } from '@/lib/db';
import { HttpError, jsonBody, requireActor, requireBackendSession, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const user = requireActor(request);
    const sessionToken = requireBackendSession(request);
    if (typeof body.kasAwal !== 'number' || body.kasAwal < 0) throw new HttpError(400, 'kasAwal harus berupa angka >= 0');
    body.namaKasir ||= user.name;
    const data = await gasActionWithSession(sessionToken, 'openKasShift', { ...body, userId: user.id, openedAt: new Date().toISOString() });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return respondError(error); }
}
