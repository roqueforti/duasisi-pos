// ============ HELPER ============
function getWibTimeZone() { return TIMEZONE_WIB; }

/**
 * ID terurut dan mudah dibaca: ID-YYYYMMDD-NNNN.
 * Counter disimpan di Script Properties agar tetap unik antar request.
 */
function generateId(prefix) {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), TIMEZONE_WIB, "yyyyMMdd");
  const key = "ID_COUNTER_" + today;
  const next = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(next));
  return (prefix || "ID") + "-" + today + "-" + String(next).padStart(4, "0");
}

/** Migrasi satu kali ID lama menjadi ID ber-prefix tanpa menghapus data. */
function migrasiIdTerstruktur() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const entities = [
      { sheet: SHEET_LAYANAN, prefix: "SVC" },
      { sheet: SHEET_INVENTORY, prefix: "INV" },
      { sheet: SHEET_MESIN, prefix: "MCH" },
      { sheet: SHEET_PEGAWAI, prefix: "EMP" },
      { sheet: SHEET_ABSENSI, prefix: "ABS" },
      { sheet: SHEET_SHIFT, prefix: "SFT" },
      { sheet: SHEET_PIPELINE, prefix: "PIP" },
      { sheet: SHEET_PROMO, prefix: "PRM" },
      { sheet: SHEET_AUDIT, prefix: "LOG" }
    ];
    const result = {};
    entities.forEach(function(entity) {
      const sheet = SS.getSheetByName(entity.sheet);
      if (!sheet || sheet.getLastRow() < 2) { result[entity.sheet] = 0; return; }
      const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      let changed = 0;
      values.forEach(function(row, index) {
        const current = String(row[0] || "");
        if (!current.startsWith(entity.prefix + "-")) {
          sheet.getRange(index + 2, 1).setValue(generateId(entity.prefix));
          changed++;
        }
      });
      result[entity.sheet] = changed;
    });
    SpreadsheetApp.flush();
    return { success: true, updated: result, message: "Migrasi ID terstruktur selesai." };
  } finally {
    lock.releaseLock();
  }
}

function fmtWib(date, pattern) {
  if (!date) return "";
  let d;
  if (typeof date === "string") {
    const parts = date.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
      const timeParts = date.match(/(\d{2}):(\d{2})/);
      const hh = timeParts ? parseInt(timeParts[1], 10) : 0;
      const mm = timeParts ? parseInt(timeParts[2], 10) : 0;
      d = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10), hh, mm);
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  if (isNaN(d.getTime())) return String(date);
  return Utilities.formatDate(d, TIMEZONE_WIB, pattern || "dd/MM/yyyy HH:mm 'WIB'");
}

function getSessionSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("SESSION_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("SESSION_SECRET", secret);
  }
  return secret;
}

function signSessionPayload_(payload) {
  const signature = Utilities.computeHmacSha256Signature(payload, getSessionSecret_());
  return Utilities.base64EncodeWebSafe(signature).replace(/=+$/, "");
}

function createSessionToken_(role, label) {
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    role: role,
    label: label,
    exp: Date.now() + (24 * 60 * 60 * 1000)
  })).replace(/=+$/, "");
  return payload + "." + signSessionPayload_(payload);
}

function verifySessionToken_(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 2 || signSessionPayload_(parts[0]) !== parts[1]) return null;
    const data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!data.exp || Number(data.exp) < Date.now() || ["STAFF", "MANAGER"].indexOf(data.role) === -1) return null;
    return data;
  } catch (error) {
    return null;
  }
}

function verifikasiPin(pin) {
  const props = PropertiesService.getScriptProperties();
  const managerPin = props.getProperty("PIN_MANAGER") || PIN_MANAGER;
  const staffPin = props.getProperty("PIN_STAFF") || PIN_STAFF;

  if (String(pin) === managerPin) return { success: true, role: "MANAGER", label: "Manager / Owner", sessionToken: createSessionToken_("MANAGER", "Manager / Owner") };
  if (String(pin) === staffPin) return { success: true, role: "STAFF", label: "Staff / Kasir", sessionToken: createSessionToken_("STAFF", "Staff / Kasir") };

  return { success: false, message: "PIN Salah! Akses Ditolak." };
}

// ============ SECURITY & SANITIZATION ENGINE (ANTI-SQL/FORMULA INJECTION) ============
function sanitizeValue(val) {
  if (typeof val === 'string') {
    let s = val;
    // 1. Prevent Formula / Command Injection in Google Sheets (=, +, -, @)
    if (s.length > 0 && ('=+-@').indexOf(s.charAt(0)) !== -1) {
      s = "'" + s;
    }
    // 2. Strip dangerous HTML script tags and null bytes
    s = s.replace(/\0/g, '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return s;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === 'object') {
    let cleanObj = {};
    for (let k in val) {
      if (Object.prototype.hasOwnProperty.call(val, k)) {
        cleanObj[sanitizeValue(k)] = sanitizeValue(val[k]);
      }
    }
    return cleanObj;
  }
  return val;
}
