/**
 * StockPilot — Crypto Layer (Layer 1, 2, 7)
 * ------------------------------------------------------------------
 * Pure-Web-Crypto implementation. Works in:
 *   - Browser PWA
 *   - Android WebView (Capacitor) — Web Crypto API supported
 *
 * Provides:
 *   - AES-256-GCM encrypt/decrypt (Layer 1: data at rest)
 *   - PBKDF2-SHA256 password hashing (Layer 2: passwords)
 *   - PBKDF2 key derivation (master key from license + device fingerprint)
 *   - SHA-256 hashing (audit chain, license keys, device fingerprint)
 *   - HMAC-SHA256 request signing (Layer 9: API auth)
 *   - AES-256-GCM backup encryption with password (Layer 7: encrypted backups)
 */

const subtle = globalThis.crypto?.subtle;
if (!subtle) {
  throw new Error('[StockPilot] Web Crypto API not available in this environment.');
}

const TEXT = new TextEncoder();
const BYTES = new TextDecoder();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toBytes(s: string): Uint8Array { return TEXT.encode(s); }
export function fromBytes(b: Uint8Array): string { return BYTES.decode(b); }

export function toHex(b: ArrayBuffer | Uint8Array): string {
  const view = b instanceof Uint8Array ? b : new Uint8Array(b);
  let hex = '';
  for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, '0');
  return hex;
}

export function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

export function toBase64(b: ArrayBuffer | Uint8Array): string {
  const view = b instanceof Uint8Array ? b : new Uint8Array(b);
  let bin = '';
  for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

// ---------------------------------------------------------------------------
// SHA-256
// ---------------------------------------------------------------------------

export async function sha256(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === 'string' ? toBytes(data) : data;
  const hash = await subtle.digest('SHA-256', buf);
  return toHex(hash);
}

/** SHA-256 with salt — used for license key / PIN / tier key validation */
export async function sha256Salted(input: string, salt: string): Promise<string> {
  return sha256(salt + input + salt);
}

// ---------------------------------------------------------------------------
// PBKDF2 (Layer 2 — password hashing, master key derivation)
// ---------------------------------------------------------------------------

const PBKDF2_ITER = 100_000; // per OWASP 2024 recommendations
const MASTER_KEY_ITER = 100_000;
const BACKUP_KEY_ITER = 50_000;

async function pbkdf2Raw(
  password: string,
  salt: Uint8Array,
  iterations: number,
  length: number = 32,
): Promise<ArrayBuffer> {
  const baseKey = await subtle.importKey('raw', toBytes(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    length * 8,
  );
}

/** PBKDF2-SHA256 (100k iter) password hash — Layer 2.
 *  Returns `pbkdf2$iter$saltHex$hashHex` (PHC-style, easy to verify). */
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const saltBytes = salt ? fromHex(salt) : randomBytes(16);
  const hash = await pbkdf2Raw(password, saltBytes, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${toHex(saltBytes)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, iterStr, saltHex, hashHex] = stored.split('$');
  if (!iterStr || !saltHex || !hashHex) return false;
  const iter = parseInt(iterStr, 10);
  const computed = await pbkdf2Raw(password, fromHex(saltHex), iter);
  return toHex(computed) === hashHex;
}

// ---------------------------------------------------------------------------
// AES-256-GCM (Layer 1 — data at rest; Layer 7 — encrypted backups)
// ---------------------------------------------------------------------------

const GCM_IV_LEN = 12; // 96-bit IV recommended for GCM

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Derive a 256-bit AES master key from (license key + device fingerprint).
 *  Used for transparent IndexedDB field encryption (Layer 1). */
export async function deriveMasterKey(
  licenseKey: string,
  deviceFingerprint: string,
): Promise<CryptoKey> {
  const salt = toBytes(deviceFingerprint);
  const raw = await pbkdf2Raw(licenseKey, salt, MASTER_KEY_ITER, 32);
  return importAesKey(new Uint8Array(raw));
}

/** Encrypt a string. Returns base64(iv | ciphertext | tag). */
export async function aesEncrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const iv = randomBytes(GCM_IV_LEN);
  const ct = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    toBytes(plaintext),
  );
  // Concatenate iv + ciphertext (GCM tag is appended automatically)
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return toBase64(combined);
}

export async function aesDecrypt(b64: string, key: CryptoKey): Promise<string> {
  const combined = fromBase64(b64);
  const iv = combined.slice(0, GCM_IV_LEN);
  const ct = combined.slice(GCM_IV_LEN);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return fromBytes(new Uint8Array(plain));
}

// ---------------------------------------------------------------------------
// Encrypted backups (Layer 7)
// Format: SPBK1$<saltHex>$<ivHex>$<cipherHex>
// ---------------------------------------------------------------------------

export async function encryptBackup(
  json: string,
  password: string,
): Promise<string> {
  const salt = randomBytes(16);
  const rawKey = await pbkdf2Raw(password, salt, BACKUP_KEY_ITER, 32);
  const key = await importAesKey(new Uint8Array(rawKey));
  const iv = randomBytes(GCM_IV_LEN);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, toBytes(json));
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return `SPBK1$${toHex(salt)}$${toHex(combined)}`;
}

export async function decryptBackup(blob: string, password: string): Promise<string> {
  const [, version, saltHex, payloadHex] = blob.split('$');
  if (version !== 'SPBK1' || !saltHex || !payloadHex) {
    throw new Error('Invalid backup format');
  }
  const rawKey = await pbkdf2Raw(password, fromHex(saltHex), BACKUP_KEY_ITER, 32);
  const key = await importAesKey(new Uint8Array(rawKey));
  const combined = fromHex(payloadHex);
  const iv = combined.slice(0, GCM_IV_LEN);
  const ct = combined.slice(GCM_IV_LEN);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return fromBytes(new Uint8Array(plain));
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 (Layer 9 — API request signing)
// ---------------------------------------------------------------------------

export async function hmacSha256(
  secret: string,
  message: string,
): Promise<string> {
  const key = await subtle.importKey(
    'raw',
    toBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await subtle.sign('HMAC', key, toBytes(message));
  return toHex(sig);
}

/** Constant-time string compare (anti-timing-attack for HMAC verification) */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Random ID generator (for receipt numbers, sync IDs, etc.)
// ---------------------------------------------------------------------------

export function randomId(len: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}
