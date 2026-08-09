import { NextResponse } from 'next/server';
import { approveVoidTransaksi } from '@/lib/db';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!body.orderId || typeof body.approved !== 'boolean') throw new HttpError(400, 'orderId dan approved wajib diisi');
    const data = await approveVoidTransaksi(body.orderId, body.approved);
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
