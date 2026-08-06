/** Client data layer: seluruh operasi diarahkan ke Google Apps Script Web App. */
const gasUrl = process.env.NEXT_PUBLIC_GAS_API_URL;
const SESSION_KEY = 'duasisi_backend_session';

let inMemorySessionToken = '';

export function setBackendSession(token: string) {
  inMemorySessionToken = token;
  if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_KEY, token);
}

export function clearBackendSession() {
  inMemorySessionToken = '';
  if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY);
}

function getBackendSession() {
  if (inMemorySessionToken) return inMemorySessionToken;
  if (typeof window === 'undefined') return '';
  inMemorySessionToken = sessionStorage.getItem(SESSION_KEY) || '';
  return inMemorySessionToken;
}

export async function gasAction<T = any>(action: string, ...args: any[]): Promise<T> {
  if (!gasUrl) throw new Error('NEXT_PUBLIC_GAS_API_URL belum dikonfigurasi');
  const response = await fetch(gasUrl, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, args, sessionToken: getBackendSession() }),
  });
  if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
  const data = await response.json();
  if (data?.error) throw new Error(data.message || 'Apps Script error');
  return data as T;
}
