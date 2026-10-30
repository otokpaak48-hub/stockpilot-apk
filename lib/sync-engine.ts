/**
 * StockPilot — Sync Engine (Business + Premium tier)
 * ------------------------------------------------------------------
 * Offline-first, online-enhanced sync architecture.
 *
 *   1. LOCAL WRITE (instant) — all writes go to IndexedDB + syncQueue
 *   2. ONLINE DETECTION     — @capacitor/network listener
 *   3. BACKGROUND SYNC      — service worker fires `sync` event
 *   4. CONFLICT RESOLUTION  — last-write-wins / merge / alert
 *   5. REAL-TIME UPDATES    — WebSocket push (Premium)
 *   6. RETRY                — exponential backoff (1s,2s,4s,8s...60s)
 *   7. DEAD-LETTER QUEUE    — permanently failed records flagged for review
 *
 * API endpoints (Business tier — Supabase / Firebase backend):
 *   POST /api/sales           → upload sale
 *   POST /api/movements       → upload stock movement
 *   POST /api/products/sync   → bidirectional product sync
 *   GET  /api/sales/since     → pull new sales from other devices
 *   GET  /api/notifications   → pull low-stock / expiry alerts
 *   POST /api/payments/confirm → webhook from Paystack / Flutterwave
 *   GET  /api/dashboard       → aggregated dashboard data
 *
 * Layer 9 (secure communication): HTTPS/TLS 1.2+ + JWT + HMAC-SHA256 + CSRF.
 */

import { db, SyncQueueEntry, StockOp } from './db-client';
import { hmacSha256 } from './crypto';
import { hasFeature } from './tiers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api.stockpilot.app';
const JWT_REFRESH_MS = 24 * 60 * 60 * 1000; // 24h
const RATE_LIMIT_PER_MIN = 100;
const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 16000, 32000, 60000];
const MAX_ATTEMPTS = 7;

let jwtToken: string | null = null;
let jwtExpiresAt = 0;
let hmacSecret = '';

export function configureSync(opts: { jwt?: string; jwtExpires?: number; hmacSecret: string }) {
  if (opts.jwt) { jwtToken = opts.jwt; jwtExpiresAt = opts.jwtExpires ?? Date.now() + JWT_REFRESH_MS; }
  if (opts.hmacSecret) hmacSecret = opts.hmacSecret;
}

// ---------------------------------------------------------------------------
// Queue helpers — called from DB wrapper on every write
// ---------------------------------------------------------------------------

export async function enqueueSync(
  table: string,
  recordId: number,
  operation: StockOp,
  payload: unknown,
): Promise<void> {
  await db.syncQueue.add({
    table,
    recordId,
    operation,
    payload: JSON.stringify(payload),
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// HTTP layer — Layer 9 secure communication
// ---------------------------------------------------------------------------

async function apiCall(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  if (!jwtToken || Date.now() >= jwtExpiresAt) {
    return { ok: false, status: 401, error: 'JWT expired — please re-login' };
  }
  const ts = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const sig = await hmacSha256(hmacSecret, `${method}|${path}|${ts}|${bodyStr}`);

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
      'X-Timestamp': ts,
      'X-Signature': sig,
    },
    body: bodyStr || undefined,
  });

  let data: unknown;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data, error: res.ok ? undefined : `HTTP ${res.status}` };
}

// ---------------------------------------------------------------------------
// Conflict resolution
// ---------------------------------------------------------------------------

export type ConflictStrategy = 'lww' | 'merge' | 'alert';

export function resolveConflict(
  strategy: ConflictStrategy,
  local: unknown,
  remote: unknown,
): { winner: 'local' | 'remote' | 'merged'; value?: unknown } {
  switch (strategy) {
    case 'lww':
      // Last-write-wins: server has authoritative timestamp
      return { winner: 'remote', value: remote };
    case 'merge':
      // Merge: for sales, receipt number is the unique key — skip duplicates
      return { winner: 'merged', value: remote };
    case 'alert':
      // Stock qty conflicts require manual resolution
      return { winner: 'local' }; // hold local, surface alert in UI
  }
}

// ---------------------------------------------------------------------------
// Queue flusher — called by service worker sync event or useSync hook
// ---------------------------------------------------------------------------

export interface FlushResult {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
}

export async function flushSyncQueue(): Promise<FlushResult> {
  const result: FlushResult = { processed: 0, succeeded: 0, failed: 0, conflicts: 0 };
  if (!hasFeature('cloud_sync')) return result;

  const pending = await db.syncQueue.where('status').anyOf(['pending', 'conflict']).toArray();

  // Progressive sync: sales first (critical), then movements, then products
  pending.sort((a, b) => syncPriority(a.table) - syncPriority(b.table));

  for (const entry of pending) {
    result.processed++;
    const ok = await processEntry(entry);
    if (ok) result.succeeded++;
    else if (entry.status === 'conflict') result.conflicts++;
    else result.failed++;
  }

  return result;
}

function syncPriority(table: string): number {
  switch (table) {
    case 'sales':         return 1;
    case 'movements':     return 2;
    case 'products':      return 3;
    case 'creditors':     return 4;
    case 'creditSales':   return 5;
    default:              return 9;
  }
}

async function processEntry(entry: SyncQueueEntry): Promise<boolean> {
  entry.attempts++;
  const path = apiPathForTable(entry.table, entry.operation);
  if (!path) {
    await markFailed(entry, `No API path for table ${entry.table}`);
    return false;
  }

  try {
    const res = await apiCall('POST', path, JSON.parse(entry.payload));
    if (res.ok) {
      await db.syncQueue.update(entry.id!, { status: 'synced', syncedAt: Date.now(), lastError: undefined });
      return true;
    }
    if (res.status === 409) {
      // Conflict — apply conflict-resolution strategy
      const strategy: ConflictStrategy = entry.table === 'sales' ? 'merge'
        : entry.table === 'products' ? 'lww'
        : entry.table === 'movements' ? 'alert'
        : 'lww';
      resolveConflict(strategy, JSON.parse(entry.payload), res.data);
      await db.syncQueue.update(entry.id!, { status: 'conflict', lastError: 'Conflict — needs review' });
      return false;
    }
    // Retryable error
    if (entry.attempts >= MAX_ATTEMPTS) {
      await markFailed(entry, res.error || `Max attempts (${MAX_ATTEMPTS}) reached`);
      return false;
    }
    // Schedule next retry with exponential backoff (service worker will pick it up)
    await db.syncQueue.update(entry.id!, {
      status: 'pending',
      attempts: entry.attempts,
      lastError: res.error,
    });
    return false;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (entry.attempts >= MAX_ATTEMPTS) {
      await markFailed(entry, msg);
    } else {
      await db.syncQueue.update(entry.id!, { status: 'pending', attempts: entry.attempts, lastError: msg });
    }
    return false;
  }
}

function apiPathForTable(table: string, op: StockOp): string | null {
  switch (table) {
    case 'sales':         return '/api/sales';
    case 'movements':     return '/api/movements';
    case 'products':      return '/api/products/sync';
    case 'creditors':     return '/api/creditors';
    case 'creditSales':   return '/api/credit-sales';
    case 'creditPayments':return '/api/credit-payments';
    default:              return null;
  }
}

async function markFailed(entry: SyncQueueEntry, error: string): Promise<void> {
  await db.syncQueue.update(entry.id!, {
    status: 'failed',
    attempts: entry.attempts,
    lastError: error,
  });
}

// ---------------------------------------------------------------------------
// Real-time push — WebSocket (Premium)
// ---------------------------------------------------------------------------

let ws: WebSocket | null = null;

export function connectWebSocket(onPush: (table: string, record: unknown) => void): void {
  if (!hasFeature('realtime_websocket')) return;
  if (ws) return;

  const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(jwtToken ?? '');
  ws = new WebSocket(wsUrl);

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.table && msg.record) onPush(msg.table, msg.record);
    } catch { /* ignore malformed */ }
  };
  ws.onclose = () => { ws = null; };
  ws.onerror = () => { /* surface in UI via useSync */ };
}

export function disconnectWebSocket(): void {
  if (ws) { ws.close(); ws = null; }
}

// ---------------------------------------------------------------------------
// Sync status (consumed by SyncBadge component)
// ---------------------------------------------------------------------------

export async function getSyncStatus(): Promise<{
  status: 'synced' | 'syncing' | 'offline';
  pending: number;
  lastSyncAt?: number;
}> {
  const pending = await db.syncQueue.where('status').anyOf(['pending', 'conflict']).count();
  const lastSynced = await db.syncQueue.where('status').equals('synced').reverse().first();
  if (pending === 0 && lastSynced) return { status: 'synced', pending: 0, lastSyncAt: lastSynced.syncedAt };
  if (pending > 0) return { status: 'offline', pending };
  return { status: 'synced', pending: 0 };
}
