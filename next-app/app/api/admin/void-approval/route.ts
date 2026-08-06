import { NextResponse } from 'next/server';
import { gasAction } from '@/lib/db';
import { HttpError, jsonBody, requireRole, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const user = requireRole(request, ['MANAGER', 'OWNER']);
    const body = await jsonBody(request);
    if (!body.orderId || typeof body.approved !== 'boolean') throw new HttpError(400, 'orderId dan approved wajib diisi');
    if (!body.catatan?.trim()) throw new HttpError(400, 'Catatan approval wajib diisi');
    const data = await gasAction('approveVoidTransaksi', body.orderId, body.approved, user.name, user.id, body.catatan.trim());
    return NextResponse.json({ data });
  } catch (error) { return respondError(error); }
}
