/* ============================================================
   DUA SISI POS — MAIN APPLICATION CONTROLLER
   Version 2.5 — Modular PWA Architecture
   ============================================================ */

// ============ GLOBAL STATE ============
let currentRole = '';
let currentServiceMode = 'SelfService';
let layananData = [];
let keranjang = {};
let customerDraft = { nama: '', noHp: '' };
let chartOmzet = null;
let chartLayanan = null;
let deferredPrompt = null;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
  initCuteSplashScreen();
  initPWA();
  initClock();
  initLucideIcons();
});

function initCuteSplashScreen() {
  const splash = document.getElementById('appSplashScreen');
  const tagline = document.getElementById('splashCuteTagline');
  if (!splash) return;

  const taglines = [
    'Sedang membilas data... 🫧',
    'Memutar drum mesin... 🌀',
    'Menyiapkan wangi parfum... 🧺',
    'Hampir bersih! ✨'
  ];

  let i = 0;
  const interval = setInterval(() => {
    i++;
    if (tagline && i < taglines.length) {
      tagline.innerText = taglines[i];
    }
  }, 450);

  setTimeout(() => {
    clearInterval(interval);
    splash.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => splash.remove(), 700);
  }, 1800);
}

function initLucideIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ============ PWA & INSTALL PROMPT ============
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('SW registration note:', err);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('btnInstallPwa');
    if (btn) btn.classList.remove('hidden');

    if (!sessionStorage.getItem('pwaPromptShown')) {
      setTimeout(() => {
        showPwaInstallModal();
        sessionStorage.setItem('pwaPromptShown', 'true');
      }, 1500);
    }
  });
}

function showPwaInstallModal() {
  if (deferredPrompt) {
    openModal(
      '<div class="text-center py-2">' +
        '<div class="w-16 h-16 bg-[#1E4648] text-white rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">✨</div>' +
        '<div class="text-xl font-extrabold text-slate-900 mb-1">Install Aplikasi Dua SiSi POS</div>' +
        '<div class="text-xs text-slate-500 mb-6 leading-relaxed">' +
          'Install ke layar utama HP / Tablet untuk akses instan full-screen tanpa address bar browser.' +
        '</div>' +
        '<button class="w-full bg-[#1E4648] hover:bg-[#153334] text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg transition active:scale-95 mb-3" onclick="trigPwaInstall()">📲 Install Sekarang (1-Klik)</button>' +
        '<button class="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl transition" onclick="closeModal()">Nanti Saja</button>' +
      '</div>'
    );
  } else {
    openModal(
      '<div class="text-left">' +
        '<div class="text-lg font-extrabold text-slate-900 mb-4">📲 Cara Install Dua SiSi POS</div>' +
        '<div class="text-xs text-slate-700 space-y-3 leading-relaxed">' +
          '<p><strong>Android (Google Chrome / Edge):</strong><br>1. Klik titik tiga (<strong>⋮</strong>) di kanan atas browser.<br>2. Pilih <strong>"Tambah ke Layar Utama"</strong> atau <strong>"Install Aplikasi"</strong>.</p>' +
          '<hr class="border-dashed border-slate-200">' +
          '<p><strong>iPhone / iPad (Safari):</strong><br>1. Klik tombol Share (<strong>📤</strong>) di Safari.<br>2. Pilih <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong>.</p>' +
        '</div>' +
        '<div class="mt-6 flex justify-end"><button class="bg-[#1E4648] text-white font-bold px-5 py-2.5 rounded-xl" onclick="closeModal()">Mengerti</button></div>' +
      '</div>'
    );
  }
}

function trigPwaInstall() {
  closeModal();
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((res) => {
      if (res.outcome === 'accepted') showToast('🎉 Dua SiSi POS berhasil diinstall!');
      deferredPrompt = null;
    });
  }
}

function installPWA() {
  showPwaInstallModal();
}

// ============ AUTHENTICATION ============
function loginVerifikasiPin() {
  const pin = document.getElementById('inputPinAkses').value;
  if (!pin) return;

  runBackend('verifikasiPin', res => {
    if (res.success) {
      currentRole = res.role;
      const modal = document.getElementById('loginModalOverlay');
      modal.classList.add('hidden');

      document.getElementById('userRoleAvatar').innerText = res.role === 'MANAGER' ? 'M' : 'S';
      document.getElementById('userRoleLabel').innerText = res.label;

      const mgrSec = document.getElementById('navManagerSection');
      const posBtn = document.getElementById('navTransaksiBtn');

      if (res.role === 'MANAGER') {
        if (mgrSec) mgrSec.classList.remove('hidden');
        if (posBtn) posBtn.classList.add('hidden');
        switchTab('riwayat');
      } else {
        if (mgrSec) mgrSec.classList.add('hidden');
        if (posBtn) posBtn.classList.remove('hidden');
        switchTab('transaksi');
      }

      showToast('Selamat datang, ' + res.label);
    } else {
      showToast('⚠️ ' + res.message, 'error');
      document.getElementById('inputPinAkses').value = '';
    }
  }, pin);
}

function logoutSession() {
  currentRole = '';
  const modal = document.getElementById('loginModalOverlay');
  modal.classList.remove('hidden');
  document.getElementById('inputPinAkses').value = '';
  document.getElementById('inputPinAkses').focus();
}

// ============ CLOCK ============
function initClock() {
  setInterval(() => {
    const now = new Date();
    const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const timeStr = wib.toLocaleTimeString('id-ID') + ' WIB';
    const clockEl = document.getElementById('clockWib');
    if (clockEl) clockEl.innerText = timeStr;
  }, 1000);
}

// ============ NAVIGATION & SIDEBAR ============
function toggleSidebar(show) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (show) {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

function switchTab(tab) {
  if (tab === 'transaksi' && currentRole === 'MANAGER') {
    showToast('🔒 Fitur POS Kasir hanya untuk Staff/Kasir', 'error');
    return;
  }
  if (['pegawai', 'produk', 'rekap'].includes(tab) && currentRole !== 'MANAGER') {
    showToast('🔒 Akses Ditolak — Khusus Manager/Owner', 'error');
    return;
  }

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.remove('bg-[#1E4648]', 'text-white', 'shadow-md');
    n.classList.add('text-slate-300', 'hover:bg-white/10');
  });

  const activeNav = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (activeNav) {
    activeNav.classList.remove('text-slate-300', 'hover:bg-white/10');
    activeNav.classList.add('bg-[#1E4648]', 'text-white', 'shadow-md');
  }

  toggleSidebar(false);

  ['transaksi', 'riwayat', 'absensi', 'inventory', 'mesin', 'pegawai', 'produk', 'rekap'].forEach(t => {
    const el = document.getElementById('tab-' + t);
    if (el) {
      if (t === tab) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });

  const titles = {
    transaksi: 'Transaksi Baru', riwayat: 'Riwayat Transaksi', absensi: 'Absensi Shift',
    inventory: 'Inventory Stok', mesin: 'Status Mesin', pegawai: 'Pegawai & Kinerja',
    produk: 'Produk & Layanan', rekap: 'Laporan Omzet'
  };
  document.getElementById('pageTitle').innerText = titles[tab] || 'Dua SiSi POS';

  if (tab === 'riwayat') loadRiwayatTransaksi();
  if (tab === 'absensi') loadAbsensiUI();
  if (tab === 'inventory') loadInventory();
  if (tab === 'mesin') loadMesin();
  if (tab === 'pegawai') { loadPegawaiManagement(); loadRekapKinerjaPegawai(); }
  if (tab === 'produk') loadLayananManagement();
  if (tab === 'rekap') {
    if (!document.getElementById('tglSelesai').value) {
      const today = new Date(); const weekAgo = new Date(); weekAgo.setDate(today.getDate() - 6);
      document.getElementById('tglSelesai').valueAsDate = today;
      document.getElementById('tglMulai').valueAsDate = weekAgo;
    }
    loadLaporan();
  }

  setTimeout(initLucideIcons, 50);
}

// ============ SERVICE MODE ============
function setServiceMode(mode) {
  currentServiceMode = mode;
  keranjang = {};
  document.querySelectorAll('#modeToggle .mode-btn').forEach(b => {
    b.classList.remove('bg-[#1E4648]', 'text-white', 'shadow-sm');
    b.classList.add('text-slate-500');
  });

  if (event && event.currentTarget) {
    event.currentTarget.classList.remove('text-slate-500');
    event.currentTarget.classList.add('bg-[#1E4648]', 'text-white', 'shadow-sm');
  }

  loadLayananPOS();
}

// ============ LAYANAN & POS MOKA GRID ============
function loadLayananPOS() {
  runBackend('getLayananList', list => {
    layananData = list || [];
    renderGrid();
  }, currentServiceMode);
}

function renderGrid() {
  const q = (document.getElementById('searchLayanan').value || '').toLowerCase();
  const filtered = layananData.filter(l => l.nama.toLowerCase().includes(q));
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  if (filtered.length === 0) {
    if (currentServiceMode === 'FullService') {
      grid.innerHTML =
        '<div class="col-span-full text-center py-12 px-4">' +
          '<div class="text-5xl mb-3">👔</div>' +
          '<div class="text-base font-extrabold text-slate-800 mb-1">Full Service — Segera Hadir</div>' +
          '<div class="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">Produk Full Service belum ditambahkan.<br>Manager dapat menambahkan layanan melalui menu <strong>🏷️ Produk & Layanan</strong>.</div>' +
        '</div>';
    } else {
      grid.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400 text-sm">Tidak ada layanan ditemukan.</div>';
    }
    renderLiveCart();
    return;
  }

  filtered.forEach(l => {
    const qty = keranjang[l.nama] ? keranjang[l.nama].qty : 0;
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-1 transition duration-200 flex flex-direction-column justify-between relative group';
    card.innerHTML =
      '<div class="h-20 bg-gradient-to-br from-teal-50 to-emerald-100 flex items-center justify-center text-3xl relative">' +
        (l.icon || '🧺') +
        (qty > 0 ? `<div class="absolute top-2 right-2 bg-[#1E4648] text-white font-extrabold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-pop">${qty}</div>` : '') +
      '</div>' +
      '<div class="p-3 flex-1 flex flex-col justify-between">' +
        '<div>' +
          '<div class="font-bold text-xs text-slate-800 leading-tight mb-1">' + l.nama + '</div>' +
          '<div class="text-sm font-extrabold text-[#1E4648]">Rp ' + Number(l.harga).toLocaleString('id-ID') + ' <span class="text-[10px] font-medium text-slate-400">/' + l.satuan + '</span></div>' +
        '</div>' +
        '<div class="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-slate-100">' +
          `<button class="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-[#1E4648] hover:text-white font-bold text-sm text-[#1E4648] transition flex items-center justify-center" onclick="event.stopPropagation(); ubahQty('${l.nama.replace(/'/g, "\\'")}', ${l.harga}, -1)">−</button>` +
          `<span class="font-extrabold text-xs text-slate-700 w-5 text-center">${qty}</span>` +
          `<button class="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-[#1E4648] hover:text-white font-bold text-sm text-[#1E4648] transition flex items-center justify-center" onclick="event.stopPropagation(); ubahQty('${l.nama.replace(/'/g, "\\'")}', ${l.harga}, 1)">+</button>` +
        '</div>' +
      '</div>';

    card.onclick = () => ubahQty(l.nama, l.harga, 1);
    grid.appendChild(card);
  });

  renderLiveCart();
}

function ubahQty(nama, harga, delta) {
  if (!keranjang[nama]) keranjang[nama] = { layanan: nama, hargaSatuan: harga, qty: 0 };
  keranjang[nama].qty = Math.max(0, keranjang[nama].qty + delta);
  if (keranjang[nama].qty === 0) delete keranjang[nama];
  renderGrid();
}

function renderLiveCart() {
  const items = Object.values(keranjang);
  const body = document.getElementById('cartItemsBody');
  const badge = document.getElementById('cartModeBadge');
  if (badge) badge.innerText = currentServiceMode === 'SelfService' ? 'Self Service' : 'Full Service';

  let total = 0;
  if (!body) return;

  if (items.length === 0) {
    body.innerHTML = '<div class="text-center text-xs text-slate-400 my-auto py-8">Keranjang kosong</div>';
  } else {
    let html = '';
    items.forEach(i => {
      const sub = i.qty * i.hargaSatuan;
      total += sub;
      html +=
        '<div class="cart-item-row">' +
          '<div>' +
            '<div class="font-bold text-xs text-slate-800">' + i.layanan + '</div>' +
            '<div class="text-[11px] text-slate-400 mt-0.5">Rp ' + Number(i.hargaSatuan).toLocaleString('id-ID') + ' x ' + i.qty + '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<div class="flex items-center gap-1.5">' +
              `<button class="w-6 h-6 rounded-full border border-slate-200 bg-white hover:bg-[#1E4648] hover:text-white text-xs font-bold text-[#1E4648] transition flex items-center justify-center" onclick="ubahQty('${i.layanan.replace(/'/g, "\\'")}', ${i.hargaSatuan}, -1)">−</button>` +
              `<span class="font-extrabold text-xs text-slate-700 min-w-[14px] text-center">${i.qty}</span>` +
              `<button class="w-6 h-6 rounded-full border border-slate-200 bg-white hover:bg-[#1E4648] hover:text-white text-xs font-bold text-[#1E4648] transition flex items-center justify-center" onclick="ubahQty('${i.layanan.replace(/'/g, "\\'")}', ${i.hargaSatuan}, 1)">+</button>` +
            '</div>' +
            '<div class="font-extrabold text-xs text-slate-800 min-w-[65px] text-right">Rp ' + sub.toLocaleString('id-ID') + '</div>' +
          '</div>' +
        '</div>';
    });
    body.innerHTML = html;
  }

  const subEl = document.getElementById('cartSubtotal');
  const totEl = document.getElementById('cartTotal');
  const chgEl = document.getElementById('chargeBtnTotal');
  if (subEl) subEl.innerText = 'Rp ' + total.toLocaleString('id-ID');
  if (totEl) totEl.innerText = 'Rp ' + total.toLocaleString('id-ID');
  if (chgEl) chgEl.innerText = 'Rp ' + total.toLocaleString('id-ID');
}

function clearCart() {
  if (Object.keys(keranjang).length === 0) return;
  if (confirm('Kosongkan keranjang belanja?')) {
    keranjang = {};
    renderGrid();
  }
}

function bukaCustomerInputQuick() {
  openModal(
    '<div class="text-left">' +
      '<div class="text-lg font-extrabold text-slate-900 mb-4">👤 Atur Pelanggan</div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Nama Pelanggan</label><input id="qNamaPlg" value="' + (customerDraft.nama || '') + '" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Masukkan nama pelanggan"></div>' +
      '<div class="mb-4"><label class="block text-xs font-bold text-slate-500 mb-1">No HP / WA</label><input id="qNoHpPlg" value="' + (customerDraft.noHp || '') + '" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="08..."></div>' +
      '<div class="flex gap-2 justify-end">' +
        '<button class="bg-slate-100 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs" onclick="closeModal()">Batal</button>' +
        '<button class="bg-[#1E4648] text-white font-bold px-4 py-2 rounded-xl text-xs" onclick="simpanCustomerQuick()">Simpan</button>' +
      '</div>' +
    '</div>'
  );
}

function simpanCustomerQuick() {
  const nama = document.getElementById('qNamaPlg').value.trim();
  const noHp = document.getElementById('qNoHpPlg').value.trim();
  customerDraft = { nama, noHp };
  const label = document.getElementById('cartCustomerLabel');
  if (label) label.innerText = nama ? '👤 ' + nama : '+ Add Customer';
  closeModal();
  showToast(nama ? 'Pelanggan: ' + nama : 'Pelanggan direset');
}

function buildCartTable() {
  const items = Object.values(keranjang);
  let rows = '';
  let grandTotal = 0;
  items.forEach(i => {
    const sub = i.qty * i.hargaSatuan;
    grandTotal += sub;
    rows += `<tr><td class="py-2 px-3">${i.layanan}</td><td class="text-center py-2 px-3">${i.qty}</td><td class="text-right py-2 px-3 font-semibold">Rp ${sub.toLocaleString('id-ID')}</td></tr>`;
  });
  return {
    html: '<div class="overflow-x-auto bg-white rounded-xl border border-slate-200 mb-4"><table class="w-full text-xs"><thead><tr class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200"><th class="text-left py-2 px-3">Layanan</th><th class="text-center py-2 px-3">Qty</th><th class="text-right py-2 px-3">Subtotal</th></tr></thead><tbody>' + rows +
      `<tr class="font-extrabold bg-slate-50 border-t border-slate-200"><td colspan="2" class="py-2.5 px-3">TOTAL</td><td class="text-right py-2.5 px-3 text-[#1E4648] text-sm">Rp ${grandTotal.toLocaleString('id-ID')}</td></tr></tbody></table></div>`,
    total: grandTotal
  };
}

function prosesTransaksi() {
  const items = Object.values(keranjang);
  if (items.length === 0) {
    showToast('⚠️ Keranjang kosong!', 'error');
    return;
  }
  const cart = buildCartTable();
  const modeBadge = currentServiceMode === 'SelfService'
    ? '<span class="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Self Service</span>'
    : '<span class="bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Full Service</span>';

  openModal(
    '<div class="text-left">' +
      '<div class="text-base font-extrabold text-slate-900 mb-3 flex items-center justify-between">💳 Proses Transaksi ' + modeBadge + '</div>' +
      cart.html +
      '<div class="pt-3 border-t border-dashed border-slate-200 space-y-3">' +
        '<div class="text-xs font-bold text-slate-800">📝 Data Pelanggan & Petugas</div>' +
        '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">Nama Pelanggan <span class="text-red-500">*</span></label><input id="cNamaPelanggan" value="' + (customerDraft.nama || '') + '" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Masukkan nama pelanggan"></div>' +
        '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">No HP / WhatsApp</label><input id="cNoHp" type="tel" value="' + (customerDraft.noHp || '') + '" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="08..."></div>' +
        '<div class="grid grid-cols-2 gap-3">' +
          '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">Nama Petugas <span class="text-red-500">*</span></label><select id="cNamaPetugas" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648] bg-white"><option value="">— Memuat Petugas... —</option></select></div>' +
          '<div><label class="block text-[11px] font-bold text-slate-500 mb-1">Estimasi Selesai</label><input id="cEstimasi" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"></div>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-2 mt-5 pt-3 border-t border-slate-100"><button class="bg-slate-100 text-slate-600 font-bold px-4 py-2.5 rounded-xl text-xs" onclick="closeModal()">← Kembali</button><button class="flex-1 bg-[#1E4648] hover:bg-[#153334] text-white font-extrabold py-2.5 rounded-xl text-xs shadow-md transition active:scale-95" onclick="konfirmasiTransaksi()">✅ Konfirmasi & Simpan</button></div>' +
    '</div>'
  );

  runBackend('getPegawaiList', function(pList) {
    const sel = document.getElementById('cNamaPetugas');
    if (!sel) return;
    sel.innerHTML = '';

    const list = pList && pList.length > 0 ? pList : [
      { nama: 'Siti Rahma', jabatan: 'Kasir' },
      { nama: 'Budi Santoso', jabatan: 'Operator Laundry' },
      { nama: 'Manager / Owner', jabatan: 'Manager' }
    ];

    list.forEach((p, idx) => {
      const o = document.createElement('option');
      const val = p.nama;
      o.value = val;
      o.innerText = p.nama + (p.jabatan ? ' (' + p.jabatan + ')' : '');
      if (idx === 0) o.selected = true;
      sel.appendChild(o);
    });
  });
}

function konfirmasiTransaksi() {
  const nama = document.getElementById('cNamaPelanggan').value.trim();
  const petugas = document.getElementById('cNamaPetugas').value.trim();
  if (!nama) {
    showToast('⚠️ Nama pelanggan wajib diisi!', 'error');
    document.getElementById('cNamaPelanggan').focus();
    return;
  }
  if (!petugas) {
    showToast('⚠️ Nama petugas wajib diisi!', 'error');
    document.getElementById('cNamaPetugas').focus();
    return;
  }

  const data = {
    namaPelanggan: nama,
    noHp: document.getElementById('cNoHp').value.trim(),
    estimasiSelesai: document.getElementById('cEstimasi').value,
    namaPetugas: petugas,
    tipeLayanan: currentServiceMode,
    items: Object.values(keranjang)
  };

  runBackend('simpanTransaksi', res => {
    closeModal();
    showToast('✅ ' + res.noNota + ' — Rp ' + res.total.toLocaleString('id-ID'));
    keranjang = {};
    customerDraft = { nama: '', noHp: '' };
    const label = document.getElementById('cartCustomerLabel');
    if (label) label.innerText = '+ Add Customer';
    renderGrid();
  }, data);
}

// ============ RIWAYAT TRANSAKSI & STRUK ============
let riwayatDataCache = [];
let currentRiwayatFilter = 'Semua';

function loadRiwayatTransaksi() {
  runBackend('getTransaksiList', function(txList) {
    riwayatDataCache = txList || [];
    renderRiwayatList();
  }, 'Semua');
}

function filterRiwayat(filter, btnEl) {
  currentRiwayatFilter = filter;
  if (btnEl) {
    document.querySelectorAll('#tab-riwayat .filter-btn').forEach(b => {
      b.classList.remove('bg-[#1E4648]', 'text-white', 'shadow-sm');
      b.classList.add('bg-slate-200', 'text-slate-700');
    });
    btnEl.classList.remove('bg-slate-200', 'text-slate-700');
    btnEl.classList.add('bg-[#1E4648]', 'text-white', 'shadow-sm');
  }
  renderRiwayatList();
}

function renderRiwayatList() {
  const searchEl = document.getElementById('searchRiwayat');
  const query = (searchEl ? searchEl.value : '').toLowerCase().trim();
  const wrapper = document.getElementById('riwayatTableWrapper');
  if (!wrapper) return;

  let filtered = riwayatDataCache;
  if (currentRiwayatFilter !== 'Semua') {
    filtered = filtered.filter(t => t.tipe === currentRiwayatFilter);
  }
  if (query) {
    filtered = filtered.filter(t => 
      t.noNota.toLowerCase().includes(query) || 
      (t.namaPelanggan && t.namaPelanggan.toLowerCase().includes(query)) ||
      (t.noHp && t.noHp.includes(query))
    );
  }

  if (filtered.length === 0) {
    wrapper.innerHTML = '<div class="text-center py-12 text-slate-400 text-xs">Belum ada riwayat transaksi.</div>';
    return;
  }

  let html = `
    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
            <th class="py-3 px-4 text-left">No Nota & Tanggal</th>
            <th class="py-3 px-4 text-left">Pelanggan</th>
            <th class="py-3 px-4 text-left">Total (Rp)</th>
            <th class="py-3 px-4 text-left">Tipe</th>
            <th class="py-3 px-4 text-left">Status</th>
            <th class="py-3 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
  `;

  filtered.forEach(tx => {
    const tipeBadge = tx.tipe === 'FullService'
      ? '<span class="bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded">Full Service</span>'
      : '<span class="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded">Self Service</span>';

    let statusBadge = '<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">Diterima</span>';
    if (tx.status === 'Selesai') {
      statusBadge = '<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">✅ Selesai</span>';
    } else if (tx.status === 'Batal') {
      statusBadge = '<span class="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded">🚫 Batal</span>';
    }

    html += `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
        <td class="py-3 px-4">
          <div class="font-extrabold text-[#1E4648]">${tx.noNota}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${tx.tanggal}</div>
        </td>
        <td class="py-3 px-4">
          <div class="font-bold text-slate-800">${tx.namaPelanggan}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${tx.noHp || '-'}</div>
        </td>
        <td class="py-3 px-4 font-extrabold text-slate-900">
          Rp ${Number(tx.total).toLocaleString('id-ID')}
        </td>
        <td class="py-3 px-4">${tipeBadge}</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4 text-right space-x-1">
          <button class="bg-[#1E4648] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-[#153334] transition" onclick="bukaDetailRiwayatModal('${tx.noNota}')">Detail & Struk</button>
          ${tx.status !== 'Selesai' ? `<button class="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg hover:bg-emerald-700 transition" onclick="updateStatusTransaksiUI('${tx.noNota}', 'Selesai')">Selesai</button>` : ''}
        </td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  wrapper.innerHTML = html;
}

function updateStatusTransaksiUI(noNota, status) {
  if (!confirm(`Tandai nota ${noNota} sebagai '${status}'?`)) return;
  runBackend('updateStatus', function(res) {
    showToast('Status diperbarui menjadi ' + status);
    loadRiwayatTransaksi();
  }, noNota, status);
}

function bukaDetailRiwayatModal(noNota) {
  const tx = riwayatDataCache.find(t => t.noNota === noNota);
  if (!tx) { showToast('⚠️ Data nota tidak ditemukan', 'error'); return; }

  let itemRows = '';
  (tx.items || []).forEach(i => {
    itemRows += `
      <div class="flex justify-between items-center py-1.5 border-b border-dashed border-slate-100 text-xs">
        <div>
          <div class="font-bold text-slate-800">${i.layanan}</div>
          <div class="text-[10px] text-slate-400">Rp ${Number(i.hargaSatuan).toLocaleString('id-ID')} x ${i.qty}</div>
        </div>
        <div class="font-extrabold text-slate-800">Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</div>
      </div>
    `;
  });

  openModal(
    '<div class="text-left">' +
      `<div class="text-base font-extrabold text-slate-900 mb-1 flex justify-between items-center"><span>🧾 Detail ${noNota}</span><span class="text-xs font-bold bg-teal-50 text-[#1E4648] px-2 py-0.5 rounded-full">${tx.tipe}</span></div>` +
      `<div class="text-xs text-slate-500 mb-3">Pelanggan: <strong>${tx.namaPelanggan}</strong> (${tx.noHp || '-'})<br>Tanggal: ${tx.tanggal} · Petugas: ${tx.petugas}</div>` +
      '<div class="bg-slate-50 p-3 rounded-xl mb-3 space-y-1">' + itemRows + '</div>' +
      `<div class="flex justify-between items-center font-extrabold text-sm text-slate-900 mb-4"><span>TOTAL BAYAR</span><span class="text-[#1E4648] text-base">Rp ${Number(tx.total).toLocaleString('id-ID')}</span></div>` +
      '<div class="flex flex-wrap gap-2 justify-end pt-2 border-t border-slate-100">' +
        `<button class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition" onclick="kirimWhatsAppStrukDirect('${tx.noNota}')">📱 Kirim WA Struk</button>` +
        `<button class="bg-[#1E4648] hover:bg-[#153334] text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition" onclick="cetakStrukDirect('${tx.noNota}')">🖨️ Cetak Struk</button>` +
        '<button class="bg-slate-100 text-slate-600 font-bold px-3.5 py-2 rounded-xl text-xs" onclick="closeModal()">Tutup</button>' +
      '</div>' +
    '</div>'
  );
}

function kirimWhatsAppStrukDirect(noNota) {
  const tx = riwayatDataCache.find(t => t.noNota === noNota);
  if (!tx) { showToast('⚠️ Data nota tidak ditemukan', 'error'); return; }

  let rawPhone = (tx.noHp || '').replace(/[^0-9]/g, '');
  if (rawPhone.startsWith('0')) rawPhone = '62' + rawPhone.substring(1);
  if (!rawPhone) { showToast('⚠️ No HP pelanggan belum diisi!', 'error'); return; }

  let itemText = '';
  (tx.items || []).forEach(i => {
    itemText += `• ${i.layanan} (${i.qty}x) = Rp ${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}\n`;
  });

  const msg = `✨ *DUA SISI POS — NOTA LAUNDRY DIGITAL* ✨\n` +
    `====================================\n` +
    `No. Nota   : ${tx.noNota}\n` +
    `Tanggal    : ${tx.tanggal}\n` +
    `Pelanggan  : ${tx.namaPelanggan}\n` +
    `Layanan    : ${tx.tipe}\n` +
    `Petugas    : ${tx.petugas}\n` +
    `------------------------------------\n` +
    `*RINCIAN ITEM:*\n` +
    itemText +
    `------------------------------------\n` +
    `*TOTAL BAYAR : Rp ${Number(tx.total).toLocaleString('id-ID')}*\n` +
    `====================================\n` +
    `Status : ${tx.status}\n\n` +
    `Terima kasih telah mencuci di *Dua SiSi POS*! 🧺\n` +
    `Pakaian Bersih, Rapi & Wangi ✨`;

  const waUrl = `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}

function cetakStrukDirect(noNota) {
  const tx = riwayatDataCache.find(t => t.noNota === noNota);
  if (!tx) return;

  const receipt = document.getElementById('thermalReceipt');
  if (!receipt) return;

  let itemHtml = '';
  (tx.items || []).forEach(i => {
    itemHtml += `<div class="r-row"><span>${i.layanan} x${i.qty}</span><span>${(i.qty * i.hargaSatuan).toLocaleString('id-ID')}</span></div>`;
  });

  receipt.innerHTML = `
    <div class="r-header">
      <img src="./assets/logo-full-black.svg" alt="Dua SiSi" style="width: 130px; height: auto; margin: 0 auto 6px auto; display: block;">
      <div>Telp/WA: 0812-XXXX-XXXX</div>
    </div>
    <div class="r-divider"></div>
    <div class="r-row"><span>Nota:</span><span>${tx.noNota}</span></div>
    <div class="r-row"><span>Tgl:</span><span>${tx.tanggal}</span></div>
    <div class="r-row"><span>Pelanggan:</span><span>${tx.namaPelanggan}</span></div>
    <div class="r-row"><span>Petugas:</span><span>${tx.petugas}</span></div>
    <div class="r-divider"></div>
    ${itemHtml}
    <div class="r-divider"></div>
    <div class="r-row" style="font-weight:bold; font-size:12px;"><span>TOTAL</span><span>Rp ${Number(tx.total).toLocaleString('id-ID')}</span></div>
    <div class="r-divider"></div>
    <div class="r-footer">
      <div>Terima kasih atas kunjungan Anda!</div>
      <div>Pakaian Bersih, Rapi & Wangi</div>
    </div>
  `;

  document.body.classList.add('printing-receipt');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-receipt'), 1000);
}

// ============ ABSENSI SHIFT ============
function loadAbsensiUI() {
  populasiOptionPegawai();
  populasiOptionShift();
  loadRekapAbsensiTable();
}

function populasiOptionShift() {
  runBackend('getMasterShiftList', function(list) {
    const sel = document.getElementById('absensiShift'); if (!sel) return; sel.innerHTML = '';
    if (!list || list.length === 0) { sel.innerHTML = '<option>Shift Normal</option>'; return; }
    list.forEach(s => { const o = document.createElement('option'); o.value = s.nama + ' (' + s.jamMasuk + '-' + s.jamKeluar + ')'; o.innerText = o.value; sel.appendChild(o); });
  });
}

function populasiOptionPegawai() {
  runBackend('getPegawaiList', function(list) {
    const sel = document.getElementById('absensiNamaPegawai'); if (!sel) return; sel.innerHTML = '';
    if (!list || list.length === 0) { sel.innerHTML = '<option value="">Belum ada pegawai</option>'; return; }
    list.forEach(p => { const o = document.createElement('option'); o.value = p.nama; o.innerText = p.nama + ' (' + (p.jabatan || 'Staff') + ')'; sel.appendChild(o); });
    cekStatusAbsensiUI();
  });
}

function cekStatusAbsensiUI() {
  const nama = document.getElementById('absensiNamaPegawai').value; if (!nama) return;
  runBackend('getStatusAbsensiHariIni', function(res) {
    const badge = document.getElementById('absensiStatusBadge');
    const btnIn = document.getElementById('btnClockIn');
    const btnOut = document.getElementById('btnClockOut');
    if (res.status === 'SUDAH_IN') {
      badge.innerHTML = '🟢 <strong>Sedang Bekerja</strong> (' + res.shift + ')<br><small>In: ' + res.clockIn + '</small>';
      badge.className = 'p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs border border-emerald-200';
      btnIn.disabled = true; btnIn.style.opacity = '.5'; btnOut.disabled = false; btnOut.style.opacity = '1';
    } else if (res.status === 'SUDAH_OUT') {
      badge.innerHTML = '🔴 <strong>Shift Selesai</strong><br><small>' + res.clockIn + ' → ' + res.clockOut + ' (' + res.durasi + ')</small>';
      badge.className = 'p-3 rounded-xl bg-slate-100 text-slate-600 text-xs border border-slate-200';
      btnIn.disabled = false; btnIn.style.opacity = '1'; btnOut.disabled = true; btnOut.style.opacity = '.5';
    } else {
      badge.innerHTML = '⚪ <strong>Belum Clock In</strong>';
      badge.className = 'p-3 rounded-xl bg-amber-50 text-amber-700 text-xs border border-amber-200';
      btnIn.disabled = false; btnIn.style.opacity = '1'; btnOut.disabled = true; btnOut.style.opacity = '.5';
    }
  }, nama);
}

function doClockIn() {
  const nama = document.getElementById('absensiNamaPegawai').value;
  const shift = document.getElementById('absensiShift').value;
  const cat = document.getElementById('absensiCatatan').value.trim();
  if (!nama) { showToast('⚠️ Pilih pegawai terlebih dahulu', 'error'); return; }
  runBackend('clockInPegawai', res => {
    if (res.success) {
      showToast(res.message);
      cekStatusAbsensiUI();
      loadRekapAbsensiTable();
    } else showToast('⚠️ ' + res.message, 'error');
  }, nama, shift, cat);
}

function doClockOut() {
  const nama = document.getElementById('absensiNamaPegawai').value;
  const cat = document.getElementById('absensiCatatan').value.trim();
  if (!nama) return;
  if (!confirm('Clock Out untuk ' + nama + '?')) return;
  runBackend('clockOutPegawai', res => {
    if (res.success) {
      showToast(res.message);
      cekStatusAbsensiUI();
      loadRekapAbsensiTable();
    } else showToast('⚠️ ' + res.message, 'error');
  }, nama, cat);
}

function loadRekapAbsensiTable() {
  runBackend('getRekapAbsensi', function(list) {
    const w = document.getElementById('absensiTable');
    if (!list || list.length === 0) { w.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">Belum ada riwayat.</div>'; return; }
    let h = '<table class="w-full text-xs"><thead><tr class="bg-slate-50 text-slate-500 border-b border-slate-200"><th class="py-2.5 px-3 text-left">Tanggal</th><th class="py-2.5 px-3 text-left">Pegawai</th><th class="py-2.5 px-3 text-left">Shift</th><th class="py-2.5 px-3 text-left">Clock In</th><th class="py-2.5 px-3 text-left">Clock Out</th><th class="py-2.5 px-3 text-left">Durasi</th></tr></thead><tbody>';
    list.forEach(a => {
      h += `<tr class="border-b border-slate-100"><td class="py-2.5 px-3">${a.tanggal}</td><td class="py-2.5 px-3 font-bold">${a.namaPegawai}</td><td class="py-2.5 px-3"><span class="bg-teal-50 text-[#1E4648] px-2 py-0.5 rounded font-semibold text-[11px]">${a.shift}</span></td><td class="py-2.5 px-3">${a.clockIn}</td><td class="py-2.5 px-3">${a.clockOut}</td><td class="py-2.5 px-3 font-bold">${a.durasi}</td></tr>`;
    });
    h += 'tbody></table>'; w.innerHTML = h;
  });
}

// ============ INVENTORY MANAGEMENT ============
function loadInventory() {
  runBackend('getInventoryList', function(list) {
    const el = document.getElementById('listInventory'); el.innerHTML = '';
    if (!list || list.length === 0) { el.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">Belum ada data.</div>'; return; }
    list.forEach(b => {
      const low = b.stok <= b.stokMinimum;
      const div = document.createElement('div');
      div.className = 'bg-white rounded-2xl border border-slate-200 p-4 mb-3 flex items-center justify-between shadow-sm';
      div.innerHTML =
        '<div class="flex items-center gap-3.5">' +
          '<div class="w-11 h-11 rounded-xl bg-teal-50 text-xl flex items-center justify-center text-[#1E4648]">📦</div>' +
          '<div>' +
            `<div class="font-bold text-sm text-slate-800">${b.nama}</div>` +
            `<div class="text-xs text-slate-400 mt-0.5">Stok: <span class="${low ? 'text-red-500 font-extrabold' : 'text-emerald-600 font-extrabold'}">${b.stok}</span> ${b.satuan} (Min: ${b.stokMinimum}) · Update: ${b.terakhirUpdate}</div>` +
          '</div>' +
        '</div>' +
        '<div class="flex gap-2">' +
          `<button class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50" onclick="updateStokUI('${b.id}', 1)">+1</button>` +
          `<button class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50" onclick="updateStokUI('${b.id}', -1)">−1</button>` +
          `<button class="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100" onclick="hapusInvUI('${b.id}')">Hapus</button>` +
        '</div>';
      el.appendChild(div);
    });
  });
}

function openModalInventory() {
  openModal(
    '<div class="text-left">' +
      '<div class="text-base font-extrabold text-slate-900 mb-3">Tambah Barang Inventory</div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Nama Barang</label><input id="mNamaInv" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Deterjen / Plastik"></div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Stok Awal</label><input id="mStokInv" type="number" value="10" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"></div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Satuan</label><input id="mSatuanInv" value="pcs" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"></div>' +
      '<div class="mb-4"><label class="block text-xs font-bold text-slate-500 mb-1">Stok Minimum</label><input id="mMinInv" type="number" value="5" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"></div>' +
      '<div class="flex gap-2 justify-end"><button class="bg-slate-100 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs" onclick="closeModal()">Batal</button><button class="bg-[#1E4648] text-white font-bold px-4 py-2 rounded-xl text-xs" onclick="simpanInv()">Simpan</button></div>' +
    '</div>'
  );
}

function simpanInv() {
  const d = { nama: document.getElementById('mNamaInv').value.trim(), stok: Number(document.getElementById('mStokInv').value), satuan: document.getElementById('mSatuanInv').value.trim(), stokMinimum: Number(document.getElementById('mMinInv').value) };
  if (!d.nama) { showToast('⚠️ Nama barang wajib diisi', 'error'); return; }
  runBackend('tambahInventory', () => { closeModal(); showToast('✅ Barang ditambahkan'); loadInventory(); }, d);
}

function updateStokUI(id, delta) { runBackend('updateStokInventory', () => { showToast('Stok diperbarui'); loadInventory(); }, id, delta); }
function hapusInvUI(id) { if (!confirm('Hapus barang ini?')) return; runBackend('hapusInventory', () => { showToast('Dihapus'); loadInventory(); }, id); }

// ============ MESIN CUCI & DRYER ============
function loadMesin() {
  runBackend('getMesinList', function(list) {
    const el = document.getElementById('mesinGrid'); el.innerHTML = '';
    if (!list || list.length === 0) { el.innerHTML = '<div class="col-span-full text-center py-8 text-slate-400 text-xs">Belum ada mesin.</div>'; return; }
    list.forEach(m => {
      const isKosong = m.status === 'Kosong';
      const isDigunakan = m.status === 'Digunakan';
      const borderClass = isKosong ? 'border-emerald-500' : isDigunakan ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300 opacity-75';
      const chipClass = isKosong ? 'bg-emerald-100 text-emerald-800' : isDigunakan ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600';
      const icon = m.tipe === 'Dryer' ? '♨️' : '🫧';

      let actions = '';
      if (isKosong) actions = `<button class="bg-[#1E4648] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow" onclick="mulaiMesinUI('${m.id}')">▶️ Mulai</button><button class="border border-slate-200 text-slate-600 text-xs font-bold px-2 py-1.5 rounded-lg" onclick="maintenanceUI('${m.id}', true)">🔧</button>`;
      else if (isDigunakan) actions = `<button class="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow" onclick="selesaiMesinUI('${m.id}')">✅ Selesai</button>`;
      else actions = `<button class="border border-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg" onclick="maintenanceUI('${m.id}', false)">✅ Aktifkan</button>`;

      const div = document.createElement('div');
      div.className = `bg-white rounded-2xl border-2 ${borderClass} p-4 transition shadow-sm flex flex-col justify-between`;
      div.innerHTML =
        '<div>' +
          `<div class="text-3xl mb-2">${icon}</div>` +
          `<div class="font-extrabold text-sm text-slate-800">${m.nama}</div>` +
          `<div class="text-[10px] font-bold text-slate-400 uppercase mb-2">${m.tipe}</div>` +
          `<span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${chipClass}">${m.status}</span>` +
          (isDigunakan ? `<div class="text-[11px] text-slate-500 mt-2 pt-2 border-t border-dashed border-slate-200">Mulai: ${m.mulaiPakai}</div>` : '') +
        '</div>' +
        `<div class="mt-4 pt-2 flex gap-1.5 flex-wrap">${actions}</div>`;
      el.appendChild(div);
    });
  });
}

function openModalMesin() {
  openModal(
    '<div class="text-left">' +
      '<div class="text-base font-extrabold text-slate-900 mb-3">Tambah Mesin</div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Nama Mesin</label><input id="mNamaMesin" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Mesin Cuci 3"></div>' +
      '<div class="mb-4"><label class="block text-xs font-bold text-slate-500 mb-1">Tipe</label><select id="mTipeMesin" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"><option>Washer</option><option>Dryer</option></select></div>' +
      '<div class="flex gap-2 justify-end"><button class="bg-slate-100 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs" onclick="closeModal()">Batal</button><button class="bg-[#1E4648] text-white font-bold px-4 py-2 rounded-xl text-xs" onclick="simpanMesin()">Simpan</button></div>' +
    '</div>'
  );
}

function simpanMesin() {
  runBackend('tambahMesin', () => { closeModal(); showToast('✅ Mesin ditambahkan'); loadMesin(); }, { nama: document.getElementById('mNamaMesin').value.trim(), tipe: document.getElementById('mTipeMesin').value });
}
function mulaiMesinUI(id) { runBackend('mulaiPakaiMesin', () => { showToast('Mesin mulai digunakan'); loadMesin(); }, id, '', ''); }
function selesaiMesinUI(id) { runBackend('selesaiMesin', () => { showToast('Mesin selesai'); loadMesin(); }, id); }
function maintenanceUI(id, aktif) { runBackend('setMaintenanceMesin', () => { showToast(aktif ? 'Mesin maintenance' : 'Mesin aktif'); loadMesin(); }, id, aktif); }

// ============ PEGAWAI & MASTER SHIFT ============
function loadPegawaiManagement() {
  loadMasterShiftManagement();
  runBackend('getPegawaiList', function(list) {
    const el = document.getElementById('listPegawai'); el.innerHTML = '';
    if (!list || list.length === 0) { el.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">Belum ada pegawai.</div>'; return; }
    list.forEach(p => {
      const div = document.createElement('div');
      div.className = 'bg-white rounded-2xl border border-slate-200 p-4 mb-3 flex items-center justify-between shadow-sm';
      div.innerHTML =
        '<div class="flex items-center gap-3">' +
          '<div class="w-10 h-10 rounded-xl bg-teal-50 text-slate-700 text-xl flex items-center justify-center">👨‍💼</div>' +
          '<div>' +
            `<div class="font-bold text-sm text-slate-800">${p.nama} <span class="bg-teal-50 text-[#1E4648] px-2 py-0.5 rounded text-[11px] font-semibold ml-1">${p.jabatan || 'Operator'}</span></div>` +
            `<div class="text-xs text-slate-400 mt-0.5">HP: ${p.noHp || '-'} · ${p.status}</div>` +
          '</div>' +
        '</div>' +
        `<button class="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100" onclick="hapusPegawaiUI('${p.id}')">Hapus</button>`;
      el.appendChild(div);
    });
  });
}

function loadRekapKinerjaPegawai() {
  runBackend('getRekapKinerjaPegawai', function(list) {
    const w = document.getElementById('rekapKinerjaTable');
    if (!list || list.length === 0) { w.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">Belum ada data.</div>'; return; }
    let h = '<table class="w-full text-xs"><thead><tr class="bg-slate-50 text-slate-500 border-b border-slate-200"><th class="py-2.5 px-3 text-left">Pegawai</th><th class="py-2.5 px-3 text-left">Jabatan</th><th class="py-2.5 px-3 text-left">Transaksi</th><th class="py-2.5 px-3 text-left">Omzet</th></tr></thead><tbody>';
    list.forEach(p => {
      h += `<tr class="border-b border-slate-100"><td class="py-2.5 px-3 font-bold">${p.nama}</td><td class="py-2.5 px-3">${p.jabatan}</td><td class="py-2.5 px-3">${p.totalTransaksi}</td><td class="py-2.5 px-3 font-extrabold text-[#1E4648]">Rp ${p.totalOmzet.toLocaleString('id-ID')}</td></tr>`;
    });
    h += '</tbody></table>'; w.innerHTML = h;
  });
}

function openModalPegawai() {
  openModal(
    '<div class="text-left">' +
      '<div class="text-base font-extrabold text-slate-900 mb-3">Tambah Pegawai</div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Nama Pegawai</label><input id="mNamaPegawai" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Budi Santoso"></div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">No HP</label><input id="mNoHpPegawai" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="08..."></div>' +
      '<div class="mb-4"><label class="block text-xs font-bold text-slate-500 mb-1">Jabatan</label><input id="mJabatanPegawai" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Operator / Kasir"></div>' +
      '<div class="flex gap-2 justify-end"><button class="bg-slate-100 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs" onclick="closeModal()">Batal</button><button class="bg-[#1E4648] text-white font-bold px-4 py-2 rounded-xl text-xs" onclick="simpanPegawai()">Simpan</button></div>' +
    '</div>'
  );
}

function simpanPegawai() {
  const d = { nama: document.getElementById('mNamaPegawai').value.trim(), noHp: document.getElementById('mNoHpPegawai').value.trim(), jabatan: document.getElementById('mJabatanPegawai').value.trim() };
  if (!d.nama) { showToast('⚠️ Nama wajib diisi', 'error'); return; }
  runBackend('tambahPegawai', () => { closeModal(); showToast('✅ Pegawai ditambahkan'); loadPegawaiManagement(); loadRekapKinerjaPegawai(); }, d);
}

function hapusPegawaiUI(id) { if (!confirm('Hapus pegawai ini?')) return; runBackend('hapusPegawai', () => { showToast('Dihapus'); loadPegawaiManagement(); }, id); }

function loadMasterShiftManagement() {
  runBackend('getMasterShiftList', function(list) {
    const el = document.getElementById('listMasterShift'); if (!el) return; el.innerHTML = '';
    if (!list || list.length === 0) { el.innerHTML = '<div class="text-center py-6 text-slate-400 text-xs">Belum ada shift.</div>'; return; }
    list.forEach(s => {
      const div = document.createElement('div');
      div.className = 'bg-white rounded-2xl border border-slate-200 p-3.5 mb-2.5 flex items-center justify-between shadow-sm';
      div.innerHTML =
        '<div class="flex items-center gap-3">' +
          '<div class="w-9 h-9 rounded-xl bg-teal-50 text-[#1E4648] text-lg flex items-center justify-center">⏰</div>' +
          '<div>' +
            `<div class="font-bold text-xs text-slate-800">${s.nama}</div>` +
            `<div class="text-xs text-slate-500 mt-0.5"><strong class="text-[#1E4648]">${s.jamMasuk} - ${s.jamKeluar} WIB</strong> ${s.keterangan ? '· ' + s.keterangan : ''}</div>` +
          '</div>' +
        '</div>' +
        `<button class="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100" onclick="hapusMasterShiftUI('${s.id}')">Hapus</button>`;
      el.appendChild(div);
    });
  });
}

function openModalTambahShift() {
  openModal(
    '<div class="text-left">' +
      '<div class="text-base font-extrabold text-slate-900 mb-3">Tambah Shift</div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Nama Shift</label><input id="mNamaShift" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Shift 3 (Malam)"></div>' +
      '<div class="grid grid-cols-2 gap-2 mb-3">' +
        '<div><label class="block text-xs font-bold text-slate-500 mb-1">Jam Masuk</label><input id="mJamMasuk" type="time" value="07:00" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"></div>' +
        '<div><label class="block text-xs font-bold text-slate-500 mb-1">Jam Keluar</label><input id="mJamKeluar" type="time" value="15:00" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"></div>' +
      '</div>' +
      '<div class="mb-4"><label class="block text-xs font-bold text-slate-500 mb-1">Keterangan</label><input id="mKetShift" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Opsional"></div>' +
      '<div class="flex gap-2 justify-end"><button class="bg-slate-100 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs" onclick="closeModal()">Batal</button><button class="bg-[#1E4648] text-white font-bold px-4 py-2 rounded-xl text-xs" onclick="simpanMasterShift()">Simpan</button></div>' +
    '</div>'
  );
}

function simpanMasterShift() {
  const d = { nama: document.getElementById('mNamaShift').value.trim(), jamMasuk: document.getElementById('mJamMasuk').value, jamKeluar: document.getElementById('mJamKeluar').value, keterangan: document.getElementById('mKetShift').value.trim() };
  if (!d.nama) { showToast('⚠️ Nama wajib diisi', 'error'); return; }
  runBackend('tambahMasterShift', () => { closeModal(); showToast('✅ Shift ditambahkan'); loadMasterShiftManagement(); }, d);
}

function hapusMasterShiftUI(id) { if (!confirm('Hapus shift ini?')) return; runBackend('hapusMasterShift', () => { showToast('Dihapus'); loadMasterShiftManagement(); }, id); }

// ============ PRODUK & LAYANAN ============
function loadPriceListSelfServiceUI() {
  if (!confirm('Reset daftar Self Service ke default?')) return;
  runBackend('resetLayananSelfService', () => { showToast('✅ Self Service direset'); loadLayananManagement(); loadLayananPOS(); });
}

function loadLayananManagement() {
  runBackend('getLayananListAll', function(list) {
    const el = document.getElementById('listLayanan'); el.innerHTML = '';
    if (!list || list.length === 0) { el.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">Belum ada layanan.</div>'; return; }
    list.forEach(l => {
      const div = document.createElement('div');
      div.className = 'bg-white rounded-2xl border border-slate-200 p-4 mb-3 flex items-center justify-between shadow-sm';
      const tipeTag = l.tipe === 'FullService' ? '<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded ml-2">Full</span>' : '<span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded ml-2">Self</span>';
      div.innerHTML =
        '<div class="flex items-center gap-3.5">' +
          `<div class="w-11 h-11 rounded-xl bg-teal-50 text-2xl flex items-center justify-center">${l.icon || '🧺'}</div>` +
          '<div>' +
            `<div class="font-bold text-sm text-slate-800">${l.nama} ${l.aktif !== 'Y' ? '<span class="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded ml-1">Nonaktif</span>' : ''}${tipeTag}</div>` +
            `<div class="text-xs text-slate-400 mt-0.5">Rp ${Number(l.harga).toLocaleString('id-ID')} / ${l.satuan}</div>` +
          '</div>' +
        '</div>' +
        '<div class="flex gap-2">' +
          `<button class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50" onclick="toggleLayananUI('${l.id}', ${l.aktif === 'Y' ? 'false' : 'true'})">${l.aktif === 'Y' ? '🚫' : '✅'}</button>` +
          `<button class="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100" onclick="hapusLayananUI('${l.id}')">Hapus</button>` +
        '</div>';
      el.appendChild(div);
    });
  });
}

function openModalLayanan() {
  openModal(
    '<div class="text-left">' +
      '<div class="text-base font-extrabold text-slate-900 mb-3">Tambah Layanan</div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Nama Layanan</label><input id="mNamaLay" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="Cuci Lipat"></div>' +
      '<div class="mb-3"><label class="block text-xs font-bold text-slate-500 mb-1">Harga (Rp)</label><input id="mHargaLay" type="number" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]" placeholder="10000"></div>' +
      '<div class="grid grid-cols-2 gap-2 mb-3">' +
        '<div><label class="block text-xs font-bold text-slate-500 mb-1">Satuan</label><input id="mSatuanLay" value="kg" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"></div>' +
        '<div><label class="block text-xs font-bold text-slate-500 mb-1">Icon Emoji</label><input id="mIconLay" value="🧺" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"></div>' +
      '</div>' +
      '<div class="mb-4"><label class="block text-xs font-bold text-slate-500 mb-1">Tipe Layanan</label><select id="mTipeLay" class="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1E4648]"><option value="SelfService">Self Service</option><option value="FullService">Full Service</option></select></div>' +
      '<div class="flex gap-2 justify-end"><button class="bg-slate-100 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs" onclick="closeModal()">Batal</button><button class="bg-[#1E4648] text-white font-bold px-4 py-2 rounded-xl text-xs" onclick="simpanLayanan()">Simpan</button></div>' +
    '</div>'
  );
}

function simpanLayanan() {
  const d = { nama: document.getElementById('mNamaLay').value.trim(), harga: Number(document.getElementById('mHargaLay').value), satuan: document.getElementById('mSatuanLay').value.trim(), icon: document.getElementById('mIconLay').value.trim(), tipe: document.getElementById('mTipeLay').value };
  if (!d.nama || !d.harga) { showToast('⚠️ Nama & harga wajib diisi', 'error'); return; }
  runBackend('tambahLayanan', () => { closeModal(); showToast('✅ Layanan ditambahkan'); loadLayananManagement(); loadLayananPOS(); }, d);
}

function toggleLayananUI(id, aktif) { runBackend('toggleAktifLayanan', () => { showToast('Status diubah'); loadLayananManagement(); loadLayananPOS(); }, id, aktif); }
function hapusLayananUI(id) { if (!confirm('Hapus layanan ini?')) return; runBackend('hapusLayanan', () => { showToast('Dihapus'); loadLayananManagement(); loadLayananPOS(); }, id); }

// ============ LAPORAN & VISUALISASI ============
function loadLaporan() {
  const start = document.getElementById('tglMulai').value;
  const end = document.getElementById('tglSelesai').value;
  if (!start || !end) return;

  runBackend('getLaporanRange', function(data) {
    const r = (data && data.ringkasan) || { totalOmzet: 0, jumlahTransaksi: 0, rataRata: 0, selfCount: 0, fullCount: 0 };
    document.getElementById('rekapCards').innerHTML =
      `<div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><div class="text-xs font-bold text-slate-400 mb-1">Total Omzet</div><div class="text-xl font-extrabold text-[#1E4648]">Rp ${r.totalOmzet.toLocaleString('id-ID')}</div></div>` +
      `<div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><div class="text-xs font-bold text-slate-400 mb-1">Jumlah Transaksi</div><div class="text-xl font-extrabold text-[#1E4648]">${r.jumlahTransaksi}</div></div>` +
      `<div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><div class="text-xs font-bold text-slate-400 mb-1">Rata-rata / Transaksi</div><div class="text-xl font-extrabold text-[#1E4648]">Rp ${r.rataRata.toLocaleString('id-ID')}</div></div>` +
      `<div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"><div class="text-xs font-bold text-slate-400 mb-1">Self / Full Service</div><div class="text-lg font-extrabold text-slate-700">${r.selfCount || 0} / ${r.fullCount || 0}</div></div>`;

    if (chartOmzet) chartOmzet.destroy();
    const omzetCtx = document.getElementById('chartOmzet');
    if (omzetCtx) {
      chartOmzet = new Chart(omzetCtx, {
        type: 'bar',
        data: { labels: (data.omzetHarian || []).map(d => d.tanggal), datasets: [{ label: 'Omzet', data: (data.omzetHarian || []).map(d => d.omzet), backgroundColor: 'rgba(30,70,72,0.85)', borderRadius: 6 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    if (chartLayanan) chartLayanan.destroy();
    const top5 = (data.layananTerlaris || []).slice(0, 5);
    const layCtx = document.getElementById('chartLayanan');
    if (layCtx) {
      chartLayanan = new Chart(layCtx, {
        type: 'doughnut',
        data: { labels: top5.map(l => l.layanan), datasets: [{ data: top5.map(l => l.omzet), backgroundColor: ['#1E4648', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
      });
    }

    let h = '<table class="w-full text-xs"><thead><tr class="bg-slate-50 text-slate-500 border-b border-slate-200"><th class="py-2.5 px-3 text-left">Nota</th><th class="py-2.5 px-3 text-left">Pelanggan</th><th class="py-2.5 px-3 text-left">Total</th><th class="py-2.5 px-3 text-left">Tipe</th><th class="py-2.5 px-3 text-left">Status</th></tr></thead><tbody>';
    (data.transaksiList || []).forEach(t => {
      const tTag = t.tipe === 'FullService' ? '<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded">Full</span>' : '<span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">Self</span>';
      h += `<tr class="border-b border-slate-100"><td class="py-2.5 px-3"><strong>${t.noNota}</strong><br><span class="text-[10px] text-slate-400">${t.tanggal}</span></td><td class="py-2.5 px-3">${t.namaPelanggan}</td><td class="py-2.5 px-3 font-bold text-[#1E4648]">Rp ${t.total.toLocaleString('id-ID')}</td><td class="py-2.5 px-3">${tTag}</td><td class="py-2.5 px-3">${t.status}</td></tr>`;
    });
    h += '</tbody></table>';
    document.getElementById('laporanTable').innerHTML = h;
  }, start, end);
}

// ============ UTILITIES & MODAL ============
function openModal(html) {
  const m = document.getElementById('modalOverlay');
  const b = document.getElementById('modalBox');
  if (b) b.innerHTML = html;
  if (m) {
    m.classList.remove('hidden');
    m.classList.add('flex');
    m.style.display = 'flex';
  }
}

function closeModal() {
  const m = document.getElementById('modalOverlay');
  if (m) {
    m.classList.add('hidden');
    m.classList.remove('flex');
    m.style.display = 'none';
  }
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  if (type === 'error') {
    t.className = 'fixed top-5 left-1/2 -translate-x-1/2 bg-red-600 text-white px-5 py-3 rounded-xl font-bold text-xs shadow-xl z-[9999] transition duration-300';
  } else {
    t.className = 'fixed top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-xs shadow-xl z-[9999] transition duration-300';
  }
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3500);
}
