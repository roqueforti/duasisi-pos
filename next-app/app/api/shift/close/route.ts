import { NextResponse } from 'next/server';
import { closeKasShift } from '@/lib/db';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!body.shiftId) throw new HttpError(400, 'shiftId wajib diisi');
    if (typeof body.kasAkhir !== 'number' || body.kasAkhir < 0) throw new HttpError(400, 'kasAkhir harus berupa angka >= 0');
    const data = await closeKasShift(body);
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
