/**
 * StockPilot — Formatting utilities (currency, date, number, CSV)
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', NGN: '₦', KES: 'KSh', GHS: 'GH₵',
  ZAR: 'R', INR: '₹', JPY: '¥', CNY: '¥',
};

let activeCurrency = 'NGN';

export function setCurrency(code: string) { activeCurrency = code; }
export function getCurrency() { return activeCurrency; }

export function formatCurrency(amount: number, currency = activeCurrency): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? '';
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${formatted}`;
}

export function formatDate(ts: number, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...opts,
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatDate(ts);
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(','));
  return lines.join('\n');
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = cells[j] ?? ''; });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export const CURRENCIES = Object.keys(CURRENCY_SYMBOLS);
