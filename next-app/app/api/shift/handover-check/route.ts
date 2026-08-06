import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!body.replacementEmployeeId) throw new HttpError(400, 'replacementEmployeeId wajib diisi');
    const data = await gasAction('handoverCheckKasShift', body);
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
