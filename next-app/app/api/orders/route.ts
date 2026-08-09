import { NextResponse } from 'next/server';
import { simpanTransaksi } from '@/lib/db';
import { HttpError, jsonBody, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (!body.namaPelanggan?.trim()) throw new HttpError(400, 'namaPelanggan wajib diisi');
    if (!Array.isArray(body.items) || body.items.length === 0) throw new HttpError(400, 'Order minimal memiliki satu item');
    const data = await simpanTransaksi(body);
    if (!data?.success) throw new HttpError(409, 'Order gagal disimpan');
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return respondError(error); }
}
