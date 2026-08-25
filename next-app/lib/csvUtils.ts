/**
 * Spreadsheet & CSV Utilities — export data, download template, parse import (.xlsx & .csv)
 */
import * as XLSX from 'xlsx';

/** Convert array of objects to CSV string */
export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [headers.map(escape).join(',')];
  rows.forEach((row) => lines.push(row.map(escape).join(',')));
  return lines.join('\r\n');
}

/** Trigger browser download of a CSV file with UTF-8 BOM */
export function downloadCSV(filename: string, csv: string): void {
  const bom = '\uFEFF'; // UTF-8 BOM — agar Excel baca benar
  const finalFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download native Excel (.xlsx) file with styled column widths */
export function downloadExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  sheetName = 'Data'
): void {
  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.[^/.]+$/, '')}.xlsx`;
  const aoa = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Auto-calculate column widths
  const colWidths = headers.map((header, colIdx) => {
    let maxLen = header.length;
    for (let r = 0; r < rows.length; r++) {
      const cellVal = String(rows[r]?.[colIdx] ?? '');
      if (cellVal.length > maxLen) maxLen = cellVal.length;
    }
    return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, finalFilename);
}

/**
 * Universal spreadsheet reader: reads both Excel (.xlsx, .xls) and CSV (.csv, .txt)
 * Returns array of objects keyed by header row (in lowercase trimmed format)
 */
export async function readSpreadsheetFile(file: File): Promise<Record<string, string>[]> {
  const fileName = file.name.toLowerCase();

  // 1. Handle Excel files (.xlsx, .xls)
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const worksheet = workbook.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (rawRows.length < 2) return [];

    const headers = rawRows[0].map((h: any) => String(h ?? '').trim());
    return rawRows.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h: string, idx: number) => {
        if (h) {
          const val = String(row[idx] ?? '').trim();
          obj[h] = val;
          obj[h.toLowerCase()] = val;
        }
      });
      return obj;
    }).filter((row) => Object.values(row).some((v) => v !== ''));
  }

  // 2. Handle Text / CSV files
  const text = await readFileAsText(file);
  return parseCSV(text);
}

/** Parse CSV string to array of objects keyed by header row with smart delimiter detection */
export function parseCSV(text: string): Record<string, string>[] {
  // Strip BOM if present
  let cleanText = text.replace(/^\uFEFF/, '');

  let delimiter: string | null = null;
  // Check for explicit "sep=;" or "sep=," header
  if (cleanText.startsWith('sep=')) {
    const newlineIdx = cleanText.indexOf('\n');
    if (newlineIdx !== -1) {
      delimiter = cleanText.substring(4, newlineIdx).replace(/\r/, '').trim();
      cleanText = cleanText.substring(newlineIdx + 1);
    }
  }

  const lines = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Auto-detect delimiter from the first line if not explicitly set
  if (!delimiter) {
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ';';
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = '\t';
    } else {
      delimiter = ',';
    }
  }

  const headers = splitCSVLine(lines[0], delimiter);
  return lines
    .slice(1)
    .map((line) => {
      const vals = splitCSVLine(line, delimiter!);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        const key = h.trim();
        const val = (vals[i] ?? '').trim();
        if (key) {
          obj[key] = val;
          obj[key.toLowerCase()] = val;
        }
      });
      return obj;
    })
    .filter((row) => Object.values(row).some((v) => v !== ''));
}

function splitCSVLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/** Read a File object as text */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}
