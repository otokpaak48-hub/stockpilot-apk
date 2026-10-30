/**
 * StockPilot — Audit Log & Tamper Detection (Layer 5 + Layer 10)
 * ------------------------------------------------------------------
 * Hash-chained immutable audit trail. Every sensitive record (sale, movement,
 * credit payment, audit entry) includes a `recordHash`:
 *
 *   hash(N) = SHA-256( hash(N-1) + JSON.stringify(recordData(N)) )
 *
 * Modifying any record breaks the chain — detected on app startup and on
 * every read of an affected table.
 *
 * The chain is per-table (sales / movements / creditPayments / activityLogs).
 */

import { db, Sale, Movement, CreditPayment, ActivityLog } from './db-client';
import { sha256 } from './crypto';

// ---------------------------------------------------------------------------
// Chain head cache (last hash per table, in-memory for fast appends)
// ---------------------------------------------------------------------------

const chainHeads: Record<string, string | null> = {
  sales: null,
  movements: null,
  creditPayments: null,
  activityLogs: null,
};

let initialized = false;

/** Load the last hash for each chain from the DB. Call once on app startup. */
export async function initAuditChains(): Promise<void> {
  if (initialized) return;

  chainHeads.sales = (await db.sales.orderBy('id').last())?.recordHash ?? null;
  chainHeads.movements = (await db.movements.orderBy('id').last())?.recordHash ?? null;
  chainHeads.creditPayments = (await db.creditPayments.orderBy('id').last())?.recordHash ?? null;
  chainHeads.activityLogs = (await db.activityLogs.orderBy('id').last())?.recordHash ?? null;

  initialized = true;
}

// ---------------------------------------------------------------------------
// Hash computation
// ---------------------------------------------------------------------------

export async function computeRecordHash(
  table: keyof typeof chainHeads,
  recordData: Record<string, unknown>,
): Promise<string> {
  const prevHash = chainHeads[table] ?? 'GENESIS';
  const payload = prevHash + JSON.stringify(sortKeys(recordData));
  const hash = await sha256(payload);
  chainHeads[table] = hash;
  return hash;
}

function sortKeys<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[k] = sortKeys((obj as Record<string, unknown>)[k]);
  }
  return sorted as T;
}

// ---------------------------------------------------------------------------
// Chain validation (run on startup — Layer 5)
// ---------------------------------------------------------------------------

export interface ValidationResult {
  table: string;
  ok: boolean;
  brokenAt?: number;
  expectedHash?: string;
  actualHash?: string;
}

export async function validateAllChains(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  results.push(await validateChain('sales',        await db.sales.toArray()));
  results.push(await validateChain('movements',    await db.movements.toArray()));
  results.push(await validateChain('creditPayments', await db.creditPayments.toArray()));
  results.push(await validateChain('activityLogs', await db.activityLogs.toArray()));

  return results;
}

async function validateChain(
  table: string,
  records: Array<{ id?: number; recordHash?: string } & Record<string, unknown>>,
): Promise<ValidationResult> {
  let prevHash = 'GENESIS';
  for (const r of records) {
    if (!r.id) continue;
    const { recordHash, ...rest } = r;
    const expected = await sha256(prevHash + JSON.stringify(sortKeys(rest)));
    if (expected !== recordHash) {
      // Log the tamper event to activityLogs (chain for that table will catch up)
      await logTamper(table, r.id, expected, recordHash ?? '');
      return { table, ok: false, brokenAt: r.id, expectedHash: expected, actualHash: recordHash };
    }
    prevHash = recordHash!;
  }
  return { table, ok: true };
}

// ---------------------------------------------------------------------------
// Audit log write helper
// ---------------------------------------------------------------------------

export async function writeAudit(
  type: ActivityLog['type'],
  message: string,
  userId?: number,
  meta?: Record<string, unknown>,
): Promise<void> {
  const entry: Omit<ActivityLog, 'id' | 'recordHash'> = {
    type,
    userId,
    createdAt: Date.now(),
    message,
    meta: meta ? JSON.stringify(meta) : undefined,
  };
  const hash = await computeRecordHash('activityLogs', entry);
  await db.activityLogs.add({ ...entry, recordHash: hash });
}

async function logTamper(
  table: string,
  recordId: number,
  expected: string,
  actual: string,
): Promise<void> {
  await writeAudit('tamper', `Tamper detected in ${table} #${recordId}`, undefined, {
    table, recordId, expectedHash: expected, actualHash: actual,
  });
}

// ---------------------------------------------------------------------------
// Convenience: append hash to a sale / movement / creditPayment before save
// ---------------------------------------------------------------------------

export async function withSaleHash(sale: Omit<Sale, 'recordHash'>): Promise<Sale> {
  const recordHash = await computeRecordHash('sales', sale);
  return { ...sale, recordHash };
}

export async function withMovementHash(m: Omit<Movement, 'recordHash'>): Promise<Movement> {
  const recordHash = await computeRecordHash('movements', m);
  return { ...m, recordHash };
}

export async function withCreditPaymentHash(p: Omit<CreditPayment, 'recordHash'>): Promise<CreditPayment> {
  const recordHash = await computeRecordHash('creditPayments', p);
  return { ...p, recordHash };
}
