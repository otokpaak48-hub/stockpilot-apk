# Phase 6 — Sync Engine (Offline-first, Online-enhanced)

**Goal:** Understand and deploy the offline-first sync engine that powers Business + Premium tier cloud sync.

**Time estimate:** 2 days (mostly backend setup).

---

## Design principle

**Offline-First, Online-Enhanced.** The app works FULLY offline. Online connectivity adds:
- Cloud sync (auto, background)
- Real-time updates across devices (WebSocket)
- Payment gateway webhooks (Paystack / Flutterwave)

Online is NEVER required for core operations.

---

## Architecture

```
[Device A — Offline Sale]
    │ (instant write to IndexedDB)
    │ (added to syncQueue with status=pending)
    ▼
[Network returns]
    │ (useSync hook fires flushSyncQueue)
    │ (POST to cloud API with JWT + HMAC signature)
    ▼
[Cloud Backend]
    │ (stores record)
    │ (fires WebSocket push to Device B)
    ▼
[Device B — receives push]
    │ (updates IndexedDB)
    │ (dashboard refreshes automatically)
```

---

## Key files

| File | Purpose |
|------|---------|
| `lib/sync-engine.ts` | Queue, flusher, conflict resolution, WebSocket, HTTP layer |
| `lib/db-client.ts` | `syncQueue` table schema |
| `hooks/use-sync.ts` | React hook that subscribes to network changes and flushes queue |
| `public/sw.js` | Service worker `sync` event listener (background sync) |
| `native/network.ts` | Network status listener (Capacitor) |

---

## Sync queue data model

```ts
syncQueue: ++id, table, recordId, operation (create|update|delete),
           payload (JSON), status (pending|syncing|synced|conflict|failed),
           attempts, lastError, createdAt, syncedAt
```

Every write to a synced table (sales, movements, products, creditors, etc.) adds a corresponding entry to `syncQueue` via `enqueueSync()`.

---

## Step 6.1 — Understand the flusher

`flushSyncQueue()` in `lib/sync-engine.ts`:

1. Checks `hasFeature('cloud_sync')` — only runs on Business+ tier
2. Reads all pending + conflict entries from `syncQueue`
3. Sorts by priority: sales first (critical), then movements, then products
4. For each entry:
   - Calls `apiCall('POST', path, payload)` — includes JWT + HMAC signature
   - On 200: marks as `synced`
   - On 409 (conflict): applies conflict-resolution strategy, marks as `conflict`
   - On retryable error: increments `attempts`, schedules exponential backoff
   - On max attempts exceeded: marks as `failed` (dead-letter)

---

## Step 6.2 — Conflict resolution strategies

| Table | Strategy | Behavior |
|-------|----------|----------|
| `settings`, `products` (price/name) | Last-write-wins (LWW) | Server timestamp authoritative |
| `sales` | Merge | Receipt number is unique key — duplicates skipped |
| `movements` (qty changes) | Alert | Hold local, surface alert in UI for manual resolution |
| `creditors`, `creditSales` | LWW | Server authoritative |

To customize: edit `resolveConflict()` in `lib/sync-engine.ts`.

---

## Step 6.3 — API endpoints (backend contract)

Your backend (Supabase / Firebase / custom Node) must implement:

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/sales` | Sale + items | `{ saleId, syncedAt }` or `409 Conflict` |
| POST | `/api/movements` | Movement | `{ movementId, syncedAt }` |
| POST | `/api/products/sync` | Product + lastModifiedAt | `{ product, serverModifiedAt }` (bidirectional) |
| POST | `/api/creditors` | Creditor | `{ creditorId, syncedAt }` |
| POST | `/api/credit-sales` | CreditSale | `{ creditSaleId, syncedAt }` |
| POST | `/api/credit-payments` | CreditPayment | `{ creditPaymentId, syncedAt }` |
| GET | `/api/sales/since?ts=<epoch>` | — | `[{ sale, items }, ...]` |
| GET | `/api/notifications` | — | `[{ type, payload }, ...]` |
| POST | `/api/payments/paystack-webhook` | Paystack signature + body | `200 OK` |
| POST | `/api/payments/flutterwave-webhook` | Flutterwave signature + body | `200 OK` |
| GET | `/api/dashboard` | — | `{ totalSales, stockValue, lowStockCount, ... }` |

**Auth:** All endpoints require:
- `Authorization: Bearer <JWT>`
- `X-Timestamp: <epoch ms>`
- `X-Signature: <HMAC-SHA256(secret, "METHOD|path|timestamp|body)">`

---

## Step 6.4 — WebSocket push (Premium tier)

`connectWebSocket()` in `lib/sync-engine.ts`:

1. Opens WebSocket to `wss://api.stockpilot.app/ws?token=<JWT>`
2. Server pushes messages like `{ table: 'sales', record: {...} }` when another device makes a sale
3. Hook `onPush(table, record)` writes the record to IndexedDB → dashboard refreshes automatically

**Wire into your app:**

```tsx
// In app/layout.tsx
import { connectWebSocket, disconnectWebSocket } from '@/lib/sync-engine';
import { hasFeature } from '@/lib/tiers';

useEffect(() => {
  if (hasFeature('realtime_websocket')) {
    connectWebSocket((table, record) => {
      // Dexie live queries will auto-refresh UI
      console.log('Push received:', table, record);
    });
    return () => disconnectWebSocket();
  }
}, []);
```

---

## Step 6.5 — Service worker background sync

`public/sw.js` registers a `sync` event listener:

```js
self.addEventListener('sync', (event) => {
  if (event.tag === 'stockpilot-sync') {
    event.waitUntil(flushSyncQueueFromSW());
  }
});
```

**Note:** Service workers only run on web (PWA), not inside the Capacitor WebView. For native Android background sync, you have two options:

1. **Foreground service** (recommended): Implement a native Android service that runs `flushSyncQueue()` periodically when the app is foregrounded. See `RECEIVE_BOOT_COMPLETED` + `FOREGROUND_SERVICE` permissions in AndroidManifest.

2. **WorkManager** (advanced): Schedule periodic background work via Android's WorkManager API. Requires a custom Capacitor plugin.

For v1, the in-app `useSync()` hook is sufficient — it flushes whenever the app is open and network is online.

---

## Step 6.6 — Sync status indicator

The header badge (in `components/sync-badge.tsx`) shows:

- 🟢 **Synced** — all records uploaded, no pending
- 🟡 **Syncing...** (pulsing) — flush in progress
- 🔴 **Offline — X pending** — offline, X records queued

Users can tap the badge to manually flush (`flushNow()`).

---

## Step 6.7 — Sync history log

Add a "Sync History" sub-section in Settings:

```tsx
import { db } from '@/lib/db-client';
import { useLiveQuery } from 'dexie-react-hooks';

const history = useLiveQuery(() =>
  db.syncQueue.where('status').equals('synced').reverse().limit(50).toArray()
) ?? [];
// Render: timestamp, table, recordId, status
```

---

## Step 6.8 — Backend deployment options

### Option A: Supabase (recommended — fastest setup)
1. Create project at https://supabase.com
2. Use Supabase Edge Functions for the API endpoints
3. Use Supabase Realtime for WebSocket push
4. Use Supabase Auth for JWT issuance
5. Set `NEXT_PUBLIC_API_BASE=https://<your-project>.supabase.co/functions/v1`

### Option B: Firebase
1. Create project at https://console.firebase.google.com
2. Use Cloud Functions for the API endpoints
3. Use Firestore real-time listeners for push
4. Use Firebase Auth for JWT
5. Set `NEXT_PUBLIC_API_BASE=https://us-central1-<your-project>.cloudfunctions.net`

### Option C: Custom Node.js backend
1. Deploy Express + PostgreSQL to Render / Railway / Fly.io
2. Use `ws` library for WebSocket
3. Use `jsonwebtoken` for JWT
4. Set `NEXT_PUBLIC_API_BASE=https://api.yourdomain.com`

---

## Step 6.9 — Payment gateway webhooks

When Paystack / Flutterwave confirms a payment, the server:
1. Receives webhook → verifies HMAC signature (see `lib/payment-gateways.ts → verifyPaystackWebhook()`)
2. Marks the corresponding sale as `paid`
3. Pushes a WebSocket message to all admin devices: `{ table: 'sale', record: { id, paid: true } }`
4. All dashboards refresh in real-time

---

## Verify

1. Set `localStorage.setItem('sp_tier', 'business')` to simulate Business tier
2. Configure JWT + HMAC secret via `configureSync()` in your login flow:
   ```ts
   import { configureSync } from '@/lib/sync-engine';
   configureSync({ jwt: '<token>', hmacSecret: '<secret>' });
   ```
3. Make a sale while offline (airplane mode)
4. SyncBadge should show "Offline — 1 pending"
5. Turn off airplane mode
6. SyncBadge should briefly show "Syncing..." then "Synced"
7. Check the backend — sale should be there

---

## What's next

→ [Phase 7 — Build APK](./PHASE_7_BUILD_APK.md): Compile the release APK.
