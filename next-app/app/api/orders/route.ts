import { NextResponse } from 'next/server';
import { gasActionWithSession } from '@/lib/db';
import { HttpError, jsonBody, requireActor, requireBackendSession, respondError } from '@/lib/route-handler';

interface OrderItemInput {
  layanan: string;
  qty: number;
  hargaSatuan: number;
  catatan?: string;
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const user = requireActor(request);
    const sessionToken = requireBackendSession(request);
    const items = Array.isArray(body.items) ? body.items as OrderItemInput[] : [];

    if (!body.namaPelanggan?.trim()) throw new HttpError(400, 'namaPelanggan wajib diisi');
    if (!body.noHp?.trim()) throw new HttpError(400, 'noHp/WhatsApp wajib diisi');
    if (items.length === 0) throw new HttpError(400, 'Order minimal memiliki satu item');
    if (items.some((item) => !item.layanan?.trim() || !Number.isFinite(item.qty) || item.qty <= 0 || !Number.isFinite(item.hargaSatuan) || item.hargaSatuan < 0)) {
      throw new HttpError(400, 'Item order tidak valid');
    }
    if (!Number.isFinite(body.nominalBayar) || body.nominalBayar < 0) throw new HttpError(400, 'nominalBayar tidak valid');

    const data = await gasActionWithSession<{
      success: boolean;
      noNota?: string;
      total?: number;
      message?: string;
    }>(sessionToken, 'simpanTransaksi', {
      ...body,
      petugas: body.petugas || user.name,
      items,
    });
    if (!data?.success || !data.noNota) throw new HttpError(409, data?.message || 'Order gagal disimpan');

    const machineTicketPayload = {
      type: 'TIKET_MESIN',
      noNota: data.noNota,
      pelanggan: body.namaPelanggan.trim(),
      tipeLayanan: body.tipeLayanan || body.tipe || 'SelfService',
      prioritas: body.tingkatLayanan || body.prioritas || 'Reguler',
      items: items.map((item) => ({ layanan: item.layanan, qty: item.qty, catatan: item.catatan || '' })),
      catatan: body.catatan || '',
      includePrices: false,
    };

    const whatsappMock = {
      provider: 'MOCK',
      status: 'ACCEPTED',
      destination: body.noHp.trim(),
      template: 'NOTA_LENGKAP',
      eNotaPath: `/?nota=${encodeURIComponent(data.noNota)}`,
    };

    return NextResponse.json({ data, machineTicketPayload, whatsappMock }, { status: 201 });
  } catch (error) {
    return respondError(error);
  }
}
