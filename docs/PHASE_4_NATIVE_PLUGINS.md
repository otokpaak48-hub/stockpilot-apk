# Phase 4 — Native Plugins

**Goal:** Wire up all 9 native Capacitor bridges so that camera scanning, biometric unlock, Bluetooth printing, filesystem backups, haptics, and notifications work on Android.

**Time estimate:** 1 day.

---

## Native bridges in this repo

All bridges live in `native/` and are exported via `native/index.ts`:

| Bridge | Plugin | Used for |
|--------|--------|----------|
| `barcode-scanner.ts` | `@capacitor-mlkit/barcode-scanning` | Native barcode scanning (EAN-13, EAN-8, UPC-A, QR, Code128) |
| `biometric.ts` | `@capacitor-community/biometric-auth` | Fingerprint / face unlock |
| `filesystem.ts` | `@capacitor/filesystem` | Encrypted backups to `Documents/StockPilot/` |
| `printer.ts` | `@capacitor-community/bluetooth-serial` | ESC/POS thermal printer (58mm + 80mm) |
| `notifications.ts` | `@capacitor/local-notifications` | Low-stock, credit-due, sync-failure alerts |
| `network.ts` | `@capacitor/network` | Online/offline detection (Layer 9) |
| `secure-storage.ts` | `@capacitor-community/secure-storage` | JWT + HMAC secret in Android Keystore |
| `haptics.ts` | `@capacitor/haptics` + `@capacitor/splash-screen` + `@capacitor/status-bar` | Haptic feedback + splash + status bar |
| `splash-screen.ts` | re-exports from `haptics.ts` | (combined for simplicity) |

Each bridge checks `isNative()` (from `@capacitor/core`) — on web dev mode they fall back to browser APIs or no-op.

---

## Step 4.1 — Barcode scanner

**File:** `native/barcode-scanner.ts` + `components/barcode-scanner.tsx`

The bridge opens a full-screen ML Kit scanner that supports:
- EAN-13, EAN-8 (most retail products)
- UPC-A (US products)
- QR Code
- Code128

**Wiring into the Sell view** (already done in `components/views/products-view.tsx`):

```tsx
import { BarcodeScanner } from '@/components/barcode-scanner';
const [scannerOpen, setScannerOpen] = useState(false);
// ... on "Scan" button click: setScannerOpen(true)
{scannerOpen && <BarcodeScanner onDetected={(code) => setSearch(code)} onClose={() => setScannerOpen(false)} />}
```

**Test on device:**
1. Build the APK and install on a physical device (emulator cameras don't work well with ML Kit)
2. Open Products view → tap "📷 Scan"
3. Camera permission prompt appears → Allow
4. Point at any product barcode
5. The scanner auto-detects → search box fills with the code → list filters

---

## Step 4.2 — Biometric auth

**File:** `native/biometric.ts`

Use case: After the user enters their Full Access PIN once, offer fingerprint unlock for subsequent app opens.

**Wiring into the license gate** (optional — add to `app/page.tsx`):

```tsx
import { authenticateWithBiometric, checkBiometric } from '@/native/biometric';

// On app startup, if isPermanentlyUnlocked():
const bio = await checkBiometric();
if (bio.available) {
  const ok = await authenticateWithBiometric('Unlock StockPilot');
  if (ok) { /* skip PIN screen, go to login */ }
}
```

The bridge gracefully degrades: if the device lacks a fingerprint sensor, `checkBiometric().available === false`, and your code falls back to the PIN gate.

---

## Step 4.3 — Filesystem (backups)

**File:** `native/filesystem.ts`

Encrypted backups (`.spbk` files) are written to `Documents/StockPilot/`. Users can find them in any file manager and share via WhatsApp / Drive.

Already wired in `components/views/backups-view.tsx`:

```tsx
import { writeBackupFile } from '@/native/filesystem';
import { encryptBackup } from '@/lib/crypto';

const blob = await encryptBackup(json, password);
const uri = await writeBackupFile(filename, blob);
```

**Test on device:**
1. Build APK → install → open Backups view
2. Tap "Export (encrypted)"
3. Enter a password
4. Toast shows the file URI
5. Open Android Files app → Documents → StockPilot → see the `.spbk` file
6. Long-press → Share → send via WhatsApp

---

## Step 4.4 — Bluetooth thermal printer (ESC/POS)

**File:** `native/printer.ts`

Generates ESC/POS byte sequences for 58mm (32-col) and 80mm (48-col) thermal printers. Supports:
- Bold / double-size text
- Center / left / right alignment
- Auto-cut
- Line feeds

**Pairing a printer:**
1. Power on the Bluetooth thermal printer
2. Pair it from Android Bluetooth settings
3. In your app, call:

```tsx
import { listBondedPrinters, connectPrinter, printReceipt } from '@/native/printer';

const printers = await listBondedPrinters();
// → [{ address: '00:11:22:33:44:55', name: 'MTP-2' }, ...]
await connectPrinter(printers[0].address);

await printReceipt({
  shopName: 'Obande Pharmacy',
  address: '123 Market Road, Lagos',
  phone: '07036001818',
  receiptNumber: 'SP-ABC12345',
  date: Date.now(),
  cashier: 'Obande',
  items: [
    { name: 'Paracetamol 500mg', qty: 2, price: 100, lineTotal: 200 },
    { name: 'Vitamin C',         qty: 1, price: 350, lineTotal: 350 },
  ],
  total: 550,
  paymentMethod: 'Cash',
  footer: 'Thank you!',
}, 32);  // 32 = 58mm, 48 = 80mm
```

**Wire this into the Sell view receipt modal** — after `completeSale()`, offer a "Print via Bluetooth" button.

---

## Step 4.5 — Local notifications

**File:** `native/notifications.ts`

Pre-built helpers:
- `notifyLowStock(productName, qty)` — when stock drops below threshold
- `notifyCreditDue(creditorName, amount, dueMs)` — 3 days before due date
- `notifySyncFailure(failedCount)` — dead-letter queue items

**Wire into your data layer:**
```tsx
// In lib/db-client.ts (after a sale that drops a product below threshold)
import { notifyLowStock } from '@/native/notifications';

if (newQty <= product.lowStockThreshold) {
  await notifyLowStock(product.name, newQty);
}
```

**Test on device:**
1. Build APK → install
2. Open Settings → Apps → StockPilot → Notifications → Allow
3. Add a product with `quantity = 1`, `lowStockThreshold = 5`
4. Make a sale that drops it to 0
5. Notification appears in the system tray

---

## Step 4.6 — Secure storage (JWT + HMAC secret)

**File:** `native/secure-storage.ts`

Used by `lib/sync-engine.ts` to store the JWT + HMAC secret in the Android Keystore (encrypted at the OS level — can't be extracted without root).

```tsx
import { setSecure, getSecure, SECURE_KEYS } from '@/native/secure-storage';

// After login (Business+ tier)
await setSecure(SECURE_KEYS.jwt, jwtFromServer);
await setSecure(SECURE_KEYS.jwtExpires, String(Date.now() + 24 * 60 * 60 * 1000));
await setSecure(SECURE_KEYS.hmacSecret, hmacSecretFromServer);

// Later, in sync-engine
const jwt = await getSecure(SECURE_KEYS.jwt);
```

---

## Step 4.7 — Haptics + splash + status bar

**File:** `native/haptics.ts`

Pre-built helpers:
- `hapticLight()` — button taps
- `hapticMedium()` — important actions
- `hapticHeavy()` — destructive actions
- `hapticSuccess()` — sale completed
- `hapticError()` — validation failure
- `setStatusBarDark()` / `setStatusBarLight()` — theme sync
- `hideSplash()` — dismiss after app loads

Already called in `components/views/sell-view.tsx` after `completeSale()`.

---

## Step 4.8 — Network listener

**File:** `native/network.ts`

Replaces `navigator.onLine` with a unified listener. Already wired into `hooks/use-pwa.ts` and `hooks/use-sync.ts`.

The sync hook automatically flushes the sync queue when the network transitions offline → online.

---

## What you have now

✅ All 9 native bridges functional
✅ Camera barcode scanning (ML Kit)
✅ Fingerprint unlock
✅ Encrypted backups to device storage
✅ Bluetooth thermal printer (58mm + 80mm ESC/POS)
✅ Local notifications (low-stock, credit-due, sync-failure)
✅ Android Keystore-backed secure storage
✅ Haptic feedback
✅ Native network listener

## What's next

→ [Phase 5 — Security Architecture](./PHASE_5_SECURITY.md): Deep-dive into all 12 anti-hack layers.
