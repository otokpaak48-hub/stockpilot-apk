/**
 * StockPilot — Native Bluetooth Thermal Printer (ESC/POS)
 * Native build: uses @capacitor-community/bluetooth-serial.
 * Web build: ESC/POS byte generation still works (for testing), but no actual printing.
 */
import { isNative } from './index';

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

const cmds = {
  init:        () => Uint8Array.from([ESC, 0x40]),
  alignCenter: () => Uint8Array.from([ESC, 0x61, 0x01]),
  alignLeft:   () => Uint8Array.from([ESC, 0x61, 0x00]),
  alignRight:  () => Uint8Array.from([ESC, 0x61, 0x02]),
  boldOn:      () => Uint8Array.from([ESC, 0x45, 0x01]),
  boldOff:     () => Uint8Array.from([ESC, 0x45, 0x00]),
  doubleSize:  () => Uint8Array.from([GS, 0x21, 0x11]),
  normalSize:  () => Uint8Array.from([GS, 0x21, 0x00]),
  cut:         () => Uint8Array.from([GS, 0x56, 0x00]),
  feed:        (n: number) => Uint8Array.from([ESC, 0x64, n]),
};

export interface ReceiptData {
  shopName: string;
  address?: string;
  phone?: string;
  receiptNumber: string;
  date: number;
  cashier?: string;
  items: Array<{ name: string; qty: number; price: number; lineTotal: number }>;
  total: number;
  paymentMethod: string;
  customerName?: string;
  footer?: string;
}

export function buildReceipt(r: ReceiptData, cols: 32 | 48 = 32): Uint8Array {
  const chunks: Uint8Array[] = [];
  const push = (arr: Uint8Array) => chunks.push(arr);
  const text = (s: string) => push(Uint8Array.from([...encodeText(s), LF]));
  const pad = (l: string, r: string, w = cols) => l + ' '.repeat(Math.max(1, w - l.length - r.length)) + r;

  push(cmds.init());
  push(cmds.alignCenter());
  push(cmds.boldOn());
  push(cmds.doubleSize());
  text(r.shopName.slice(0, Math.floor(cols / 2)));
  push(cmds.normalSize());
  push(cmds.boldOff());
  if (r.address) text(r.address.slice(0, cols));
  if (r.phone)   text(r.phone.slice(0, cols));
  push(cmds.feed(1));
  push(cmds.alignLeft());
  text('-'.repeat(cols));
  text(`Receipt #: ${r.receiptNumber}`);
  text(`Date: ${new Date(r.date).toLocaleString()}`);
  if (r.cashier) text(`Cashier: ${r.cashier}`);
  if (r.customerName) text(`Customer: ${r.customerName}`);
  text('-'.repeat(cols));
  for (const it of r.items) {
    text(it.name.slice(0, cols));
    text(pad(`  ${it.qty} x ${it.price.toFixed(2)}`, it.lineTotal.toFixed(2), cols));
  }
  text('-'.repeat(cols));
  push(cmds.boldOn());
  push(cmds.doubleSize());
  text(pad('TOTAL', r.total.toFixed(2), cols));
  push(cmds.normalSize());
  push(cmds.boldOff());
  text(`Paid via: ${r.paymentMethod}`);
  push(cmds.feed(1));
  push(cmds.alignCenter());
  if (r.footer) text(r.footer);
  text('Powered by StockPilot');
  text('ObandeTechHub · 07036001818');
  push(cmds.feed(3));
  push(cmds.cut());
  return concat(chunks);
}

function encodeText(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0) < 256 ? c.charCodeAt(0) : 0x3f);
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

export async function listBondedPrinters(): Promise<{ address: string; name: string }[]> {
  if (!isNative()) return [];
  const { BluetoothSerial } = await import(/* webpackIgnore: true */ '@capacitor-community/bluetooth-serial');
  try {
    const result = await BluetoothSerial.devices();
    return (result.devices ?? []).map((d) => ({ address: d.address, name: d.name }));
  } catch {
    return [];
  }
}

export async function connectPrinter(address: string): Promise<boolean> {
  if (!isNative()) return false;
  const { BluetoothSerial } = await import(/* webpackIgnore: true */ '@capacitor-community/bluetooth-serial');
  try { await BluetoothSerial.connect({ address }); return true; } catch { return false; }
}

export async function disconnectPrinter(): Promise<void> {
  if (!isNative()) return;
  const { BluetoothSerial } = await import(/* webpackIgnore: true */ '@capacitor-community/bluetooth-serial');
  await BluetoothSerial.disconnect();
}

export async function printBytes(bytes: Uint8Array): Promise<boolean> {
  if (!isNative()) return false;
  const { BluetoothSerial } = await import(/* webpackIgnore: true */ '@capacitor-community/bluetooth-serial');
  try { await BluetoothSerial.write({ value: Array.from(bytes) }); return true; } catch { return false; }
}

export async function printReceipt(r: ReceiptData, cols: 32 | 48 = 32): Promise<boolean> {
  const bytes = buildReceipt(r, cols);
  return printBytes(bytes);
}
