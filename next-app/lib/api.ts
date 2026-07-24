const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxnc_m6BqGoFKXXPnJLVT0QuJRJw0PXaKLmnjOfli2EWcpMtPosq2vJEGYNXkAo9cjKPQ/exec';

export async function runBackend<T = any>(action: string, ...args: any[]): Promise<T> {
  const payload = { action, args };

  try {
    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data as T;
  } catch (err: any) {
    console.error(`[API Error] ${action}:`, err);
    throw err;
  }
}
