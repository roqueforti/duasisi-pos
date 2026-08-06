import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { actor, HttpError, jsonBody, respondError } from '@/lib/route-handler';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const b = await jsonBody(request); const a = actor(request); if (!b.alasan?.trim()) throw new HttpError(400, 'Alasan void wajib diisi');
    const tx = await prisma.$transaction(async (db) => { const order = await db.transaction.findUnique({ where: { id } }); if (!order) throw new HttpError(404, 'Order tidak ditemukan'); if (order.statusVoid !== 'None') throw new HttpError(409, 'Order sudah memiliki proses void'); return db.transaction.update({ where: { id }, data: { statusVoid: 'PendingApproval', alasanVoid: b.alasan } }); });
    return NextResponse.json({ data: tx });
  } catch (e) { return respondError(e); }
}
