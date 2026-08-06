import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { HttpError, jsonBody, requireRole, respondError } from '@/lib/route-handler';

export async function POST(request: Request) {
  try {
    const a = requireRole(request, ['MANAGER', 'OWNER']);
    const b = await jsonBody(request);
    if (!b.orderId || typeof b.approved !== 'boolean') throw new HttpError(400, 'orderId dan approved wajib diisi');
    const result = await prisma.$transaction(async (db: Prisma.TransactionClient) => {
      const order = await db.transaction.findUnique({ where: { id: b.orderId } });
      if (!order) throw new HttpError(404, 'Order tidak ditemukan');
      if (order.statusVoid !== 'PendingApproval') throw new HttpError(409, 'Order tidak berada dalam antrean approval');
      const statusVoid = b.approved ? 'Approved' : 'Rejected';
      const updated = await db.transaction.update({ where: { id: order.id }, data: { statusVoid, ...(b.approved ? { status: 'Batal' } : {}) } });
      await db.auditLog.create({ data: { idUser: a.id, namaUser: a.name, jenisAktivitas: b.approved ? 'VOID_APPROVED' : 'VOID_REJECTED', referensi: order.noNota, detail: JSON.stringify({ alasan: order.alasanVoid }) } });
      return updated;
    });
    return NextResponse.json({ data: result });
  } catch (e) { return respondError(e); }
}
