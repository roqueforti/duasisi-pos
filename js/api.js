/* ============================================================
   DUA SISI POS — REST API BRIDGE & RPC HELPER
   Connects GitHub Pages Frontend to Google Apps Script Backend
   ============================================================ */

// Paste your deployed Google Apps Script Web App URL here
let EXTERNAL_GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxVfZcTiFhZqQIVjvxoIAtIJbpVJbVz8MWloZztbk3GIV50hNa2Fr0Lu50MHWoaSGM1Mw/exec';

/**
 * Universal RPC Invoker
 * Automatically detects if running natively in GAS iframe or on GitHub Pages / Vercel
 */
function runBackend(fn, cb, ...args) {
  // Option A: Running directly inside Apps Script iframe
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    const runner = google.script.run
      .withSuccessHandler(cb)
      .withFailureHandler(err => {
        console.error('[GAS Error]', fn, err);
        showToast('⚠️ Backend Error: ' + err.message, 'error');
      });

    if (args.length === 0) runner[fn]();
    else if (args.length === 1) runner[fn](args[0]);
    else if (args.length === 2) runner[fn](args[0], args[1]);
    else if (args.length === 3) runner[fn](args[0], args[1], args[2]);
    else if (args.length === 4) runner[fn](args[0], args[1], args[2], args[3]);
  }
  // Option B: External Frontend (GitHub Pages / Vercel) calling GAS via fetch POST
  else if (EXTERNAL_GAS_API_URL && EXTERNAL_GAS_API_URL.startsWith('http')) {
    fetch(EXTERNAL_GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: fn, args: args }),
      redirect: 'follow'
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.error) {
          console.error('[API Response Error]', fn, data.message);
          showToast('⚠️ API Error: ' + data.message, 'error');
        } else if (cb) {
          cb(data);
        }
      })
      .catch(err => {
        console.error('[Fetch Connection Error]', fn, err);
        showToast('⚠️ Connection Error: Gagal terhubung ke database. Pastikan URL Web App benar.', 'error');
      });
  } else {
    console.warn('[API Warning] Backend URL is not set in JS/api.js');
    showToast('⚠️ URL Backend Web App belum diisi di js/api.js!', 'error');
  }
}
