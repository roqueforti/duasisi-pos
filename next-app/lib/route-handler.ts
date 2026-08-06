import { NextResponse } from 'next/server';

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function jsonBody(request: Request) {
  try { return await request.json(); } catch { throw new HttpError(400, 'Body JSON tidak valid'); }
}
export function actor(request: Request) {
  return { id: request.headers.get('x-user-id'), name: request.headers.get('x-user-name') || 'System User', role: request.headers.get('x-user-role') || 'STAFF' };
}
export function respondError(error: unknown) {
  console.error(error);
  const e = error instanceof HttpError ? error : new HttpError(500, 'Terjadi kesalahan server');
  return NextResponse.json({ error: e.message }, { status: e.status });
}
export function requireRole(request: Request, roles: string[]) { const a = actor(request); if (!roles.includes(a.role)) throw new HttpError(403, 'Akses ditolak'); return a; }
