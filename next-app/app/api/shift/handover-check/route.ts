import { NextResponse } from 'next/server';
import { runBackend } from '@/lib/api';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!body.shiftId) throw new HttpError(400, 'shiftId wajib diisi');
    if (!body.replacementEmployeeId) throw new HttpError(400, 'replacementEmployeeId wajib diisi');
    const data = await runBackend('handoverCheckKasShift', body);
    if (!data?.clockedIn) throw new HttpError(409, 'Staf pengganti belum Clock In');
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
