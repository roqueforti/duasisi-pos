import { NextResponse } from 'next/server';
import { gasActionWithSession } from '@/lib/db';
import { HttpError, jsonBody, requireActor, requireBackendSession, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const user = requireActor(request);
    const sessionToken = requireBackendSession(request);
    if (!body.shiftId) throw new HttpError(400, 'shiftId wajib diisi');
    if (!body.replacementEmployeeId) throw new HttpError(400, 'replacementEmployeeId wajib diisi');
    const data = await gasActionWithSession(sessionToken, 'handoverCheckKasShift', { ...body, checkedBy: user.id });
    if (data?.eligible === false || data?.clockedIn !== true) throw new HttpError(409, 'Staf pengganti belum Clock In; serah-terima belum dapat dilakukan');
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
