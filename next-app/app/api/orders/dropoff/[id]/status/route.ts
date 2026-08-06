import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { actor, HttpError, jsonBody, respondError } from '@/lib/route-handler';
const steps = ['Diterima', 'Dicuci', 'Dikeringkan', 'Disetrika', 'Siap Diambil', 'Selesai'];
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const b = await jsonBody(request); const a = actor(request);
    if (!steps.includes(b.status)) throw new HttpError(400, 'Status drop-off tidak valid');
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.transaction.findUnique({ where: { id }, include: { pipelineSteps: true } });
      if (!order) throw new HttpError(404, 'Order tidak ditemukan');
      const current = steps.indexOf(order.status), next = steps.indexOf(b.status);
      if (next !== current + 1 && !(b.status === order.status)) throw new HttpError(409, 'Perubahan status harus mengikuti urutan lifecycle');
      if (b.status === 'Dicuci' && b.washerId) await tx.machine.update({ where: { id: b.washerId }, data: { status: 'Digunakan', mulaiPakai: new Date(), keterangan: order.noNota } }).catch(() => { throw new HttpError(400, 'Washer tidak ditemukan'); });
      if (b.status === 'Dikeringkan' && b.dryerId) await tx.machine.update({ where: { id: b.dryerId }, data: { status: 'Digunakan', mulaiPakai: new Date(), keterangan: order.noNota } }).catch(() => { throw new HttpError(400, 'Dryer tidak ditemukan'); });
      const updated = await tx.transaction.update({ where: { id }, data: { status: b.status } });
      const step = order.pipelineSteps.find((p) => p.namaStep === b.status);
      if (step) await tx.pipelineStep.update({ where: { id: step.id }, data: { status: 'Selesai', idPegawai: a.id, mesinId: b.washerId || b.dryerId || null, waktuSelesai: new Date(), catatan: b.catatan || null } });
      return updated;
    });
    return NextResponse.json({ data: result });
  } catch (e) { return respondError(e); }
}
