import { NextResponse } from 'next/server';
import { openKasShift } from '@/lib/db';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (typeof body.kasAwal !== 'number' || body.kasAwal < 0) throw new HttpError(400, 'kasAwal harus berupa angka >= 0');
    const data = await openKasShift(body);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return respondError(error); }
}
