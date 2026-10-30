/**
 * StockPilot — Security Orchestrator (Layers 4, 6, 8, 11)
 * ------------------------------------------------------------------
 * Centralizes the non-crypto security layers:
 *   Layer 4  — Brute-force protection (escalating lockouts)
 *   Layer 6  — Input validation (Zod schemas)
 *   Layer 8  — Device fingerprinting
 *   Layer 11 — Two-factor auth (admin SMS OTP)
 *
 * Crypto layers (1, 2, 5, 7, 9, 10) live in:
 *   lib/crypto.ts (1, 2, 7, 9)
 *   lib/audit-log.ts (5, 10)
 *   android/app/proguard-rules.pro (12)
 */

import { z } from 'zod';
import { sha256 } from './crypto';

// ===========================================================================
// LAYER 4 — Brute-force protection
// ===========================================================================

type LockoutKey = 'login' | 'license' | 'pin';

interface LockoutState {
  attempts: number;
  lockedUntil: number; // epoch ms
}

const lockouts: Record<LockoutKey, LockoutState> = {
  login:   { attempts: 0, lockedUntil: 0 },
  license: { attempts: 0, lockedUntil: 0 },
  pin:     { attempts: 0, lockedUntil: 0 },
};

/** Escalating lockout schedule. DISABLED for now — set all to 0. */
const LOCKOUT_SCHEDULE: Record<LockoutKey, { threshold: number; ms: number }[]> = {
  login: [
    { threshold: 999, ms: 0 },   // never lock
  ],
  license: [
    { threshold: 999, ms: 0 },   // never lock
  ],
  pin: [
    { threshold: 999, ms: 0 },   // never lock (permanent lock removed too)
  ],
};

export function isLocked(key: LockoutKey): boolean {
  return Date.now() < lockouts[key].lockedUntil;
}

export function getLockoutMsRemaining(key: LockoutKey): number {
  return Math.max(0, lockouts[key].lockedUntil - Date.now());
}

export function recordFailedAttempt(key: LockoutKey): { locked: boolean; ms: number } {
  const s = lockouts[key];
  s.attempts++;
  for (const tier of LOCKOUT_SCHEDULE[key]) {
    if (s.attempts === tier.threshold) {
      s.lockedUntil = Date.now() + tier.ms;
      return { locked: true, ms: tier.ms };
    }
  }
  return { locked: false, ms: 0 };
}

export function resetAttempts(key: LockoutKey): void {
  lockouts[key] = { attempts: 0, lockedUntil: 0 };
}

// ===========================================================================
// LAYER 6 — Input validation (Zod schemas)
// ===========================================================================

export const schemas = {
  product: z.object({
    name: z.string().min(1).max(200).regex(/^[^<>]+$/, 'No HTML tags allowed'),
    sku: z.string().min(1).max(50).regex(/^[A-Za-z0-9-]+$/, 'Alphanumeric + hyphens only'),
    barcode: z.string().regex(/^\d*$/).optional(),
    quantity: z.number().int().nonnegative(),
    cost: z.number().nonnegative().optional(),
    baseUnitSalePrice: z.number().nonnegative().optional(),
    lowStockThreshold: z.number().int().nonnegative().default(5),
    expiryDate: z.string().optional(),
  }),

  sale: z.object({
    receiptNumber: z.string().min(1).max(50),
    storeId: z.number().int().positive(),
    paymentMethod: z.enum(['cash', 'card', 'transfer', 'credit', 'other']),
    total: z.number().nonnegative().max(1_000_000_000),
    customerName: z.string().max(200).optional(),
    items: z.array(z.object({
      productId: z.number().int().positive(),
      qty: z.number().positive(),
      unitPrice: z.number().nonnegative(),
      sellBy: z.enum(['pack', 'card', 'base']),
      lineTotal: z.number().nonnegative(),
    })).min(1),
  }),

  movement: z.object({
    productId: z.number().int().positive(),
    type: z.enum(['in', 'out', 'adjust']),
    qty: z.number().int(),
    reason: z.string().max(500).optional(),
  }),

  creditor: z.object({
    name: z.string().min(1).max(200).regex(/^[^<>]+$/),
    phone: z.string().regex(/^\+?\d{7,15}$/).optional(),
    address: z.string().max(500).optional(),
  }),

  user: z.object({
    username: z.string().min(3).max(30).regex(/^[A-Za-z0-9_]+$/),
    password: z.string()
      .min(8)
      .regex(/[A-Za-z]/, 'Must contain a letter')
      .regex(/\d/, 'Must contain a number'),
    role: z.enum(['admin', 'manager', 'stockkeeper', 'salesperson']),
  }),

  licenseKey: z.string().regex(/^SP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  pin: z.string().regex(/^\d{6}$/),
  tierKey: z.string().regex(/^(BIZ|PRM)-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
};

export function validate<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input); // throws ZodError on invalid — caught at call site
}

/** XSS-safe sanitizer for free-text fields (defense in depth beyond Zod). */
export function sanitizeText(s: string): string {
  return s
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ===========================================================================
// LAYER 8 — Device fingerprinting
// ===========================================================================

export interface DeviceFingerprint {
  hash: string;
  components: {
    screen: string;
    timezone: string;
    language: string;
    platform: string;
    cores: number;
  };
}

export async function generateDeviceFingerprint(): Promise<DeviceFingerprint> {
  const components = {
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    cores: navigator.hardwareConcurrency || 0,
  };
  const hash = await sha256(JSON.stringify(components));
  return { hash, components };
}

// ===========================================================================
// LAYER 11 — Two-factor auth (admin SMS OTP)
// ===========================================================================

const OTP_TTL_MS = 5 * 60_000; // 5 minutes
const otpStore: Map<string, { code: string; expires: number }> = new Map();

/** Generate a 6-digit OTP for the given admin phone. */
export function generateOtp(phone: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { code, expires: Date.now() + OTP_TTL_MS });
  // In production: integrate Twilio / Termii / Africa's Talking SMS gateway here
  // For now, return the code so the dev console / SMS gateway can pick it up.
  // console.log(`[2FA] OTP for ${phone}: ${code}`);
  return code;
}

export function verifyOtp(phone: string, code: string): boolean {
  const entry = otpStore.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expires) {
    otpStore.delete(phone);
    return false;
  }
  if (entry.code !== code) return false;
  otpStore.delete(phone);
  return true;
}
