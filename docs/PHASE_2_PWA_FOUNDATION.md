# Phase 2 — PWA Foundation

**Goal:** Build out the Next.js PWA shell — Dexie schema, theme system, layout, and the basic CRUD flows for products, sales, and stock movements.

**Time estimate:** 1 day.

---

## What's already in place

The repo ships with:

| File | What it does |
|------|--------------|
| `app/layout.tsx` | Root layout — wires ErrorBoundary, ThemeProvider, AuthProvider, ToastProvider, network listener, audit chain init |
| `app/page.tsx` | Main app shell — license gate → login → sidebar + view router |
| `app/globals.css` | Theme tokens (light/dark), dot-grid background, custom scrollbar, glassmorphism utilities |
| `lib/db-client.ts` | Dexie v7 schema — 18 tables including syncQueue + encrypted settings |
| `lib/crypto.ts` | AES-256-GCM + PBKDF2 + SHA-256 + HMAC + encrypted backups (Layers 1, 2, 7, 9) |
| `lib/security.ts` | Brute-force protection + Zod schemas + device fingerprint + 2FA OTP (Layers 4, 6, 8, 11) |
| `lib/audit-log.ts` | Hash-chained immutable audit trail (Layers 5, 10) |
| `lib/license.ts` | License + trial + PIN + tier validation |
| `lib/tiers.ts` | Tier feature gates |
| `lib/permissions.ts` | Role → permission map (admin, manager, stockkeeper, salesperson) |
| `lib/format.ts` | Currency / date / CSV formatters |
| `lib/payment-gateways.ts` | Paystack / Flutterwave / Opay / Moniepoint / Bank Transfer |
| `hooks/use-auth.tsx` | Auth context (login, 2FA, session timeout) |
| `hooks/use-pwa.ts` | SW registration + install prompt + network status |
| `hooks/use-sync.ts` | Sync queue flusher + badge state |
| `hooks/use-toast.tsx` | Toast notifications |
| `hooks/use-mobile.ts` | Mobile viewport detection |
| `components/error-boundary.tsx` | Crash recovery screen |
| `components/license-screen.tsx` | License activation |
| `components/login-screen.tsx` | Username + password + 2FA |
| `components/trial-gate.tsx` | Full Access PIN gate (post-trial) |
| `components/sidebar.tsx` | Permission-filtered nav |
| `components/feature-gate.tsx` | Tier-based conditional rendering |
| `components/sync-badge.tsx` | Synced / syncing / offline indicator |
| `components/barcode-scanner.tsx` | Camera scanner modal |
| `components/views/*.tsx` | 13 view components (home, sell, products, movements, etc.) |

---

## Step 2.1 — Verify the build

```bash
npm run build
```

You should see Next.js build to `./out/` (static export). The build output should report no errors.

If you see TypeScript errors:
- Most likely cause: missing placeholder values in `lib/license-data.ts`, `lib/pin-data.ts`, `lib/tier-data.ts`. Run `npm run keys:all` (Phase 1.3).
- Second most likely: a view file imports something that doesn't exist yet. Check the import path against the file list above.

---

## Step 2.2 — Customize the brand

Open these files and adjust:

1. **`tailwind.config.ts`** — colors, fonts, spacing. The brand emerald `#059669` is the primary; if you want a different brand color, change it here and ripple through `app/globals.css`, `capacitor.config.ts`, and `android/app/src/main/res/values/colors.xml`.

2. **`public/manifest.json`** — PWA name, short_name, icons. Drop your own PNG icons into `public/icons/` (32, 192, 512, maskable-512).

3. **`android/app/src/main/res/values/strings.xml`** — Android app name (defaults to "StockPilot").

4. **`components/sidebar.tsx`** — footer text "ObandeTechHub · 07036001818". Update with your branding.

---

## Step 2.3 — Extend the views (if needed)

The 13 views in `components/views/` are functional stubs — they wire up the data layer but the UI is intentionally minimal. You can extend each one:

| View | Currently does | You should add |
|------|----------------|----------------|
| `home-view.tsx` | KPI cards + trial progress + quick actions | Recent activity feed, weekly chart |
| `sell-view.tsx` | Add to cart, checkout, payment method | Barcode scan, credit sale inline creditor creation, receipt modal |
| `products-view.tsx` | List + add dialog + search | Edit/delete, bulk paste from CSV, categories sub-tab, measurement presets (11 presets) |
| `movements-view.tsx` | List only | Stock In/Out/Adjust dialog with multi-product bulk, pack/card/piece selector |
| `purchase-orders-view.tsx` | List only | PO create dialog with auto-suggestions, receive dialog, A4 printable |
| `suppliers-view.tsx` | List only | CRUD dialog |
| `creditors-view.tsx` | KPI cards + list | Payment recording dialog, reminder scheduling |
| `dashboard-view.tsx` | KPI cards | Bar/line/pie charts, best sellers, slow movers, expiring soon |
| `reports-view.tsx` | Stub grid | 6 report types with date range filters, printable |
| `profit-analytics-view.tsx` | FeatureGate stub | Top 10 by revenue, dead stock, best-selling hours/days |
| `users-view.tsx` | List only | CRUD dialog, password reset, role change, deactivate |
| `activity-log-view.tsx` | List only | Filter by type, search, hash-chain validation indicator |
| `backups-view.tsx` | Export buttons | Import dialog, history with restore, share-store snapshot, CSV import |
| `settings-view.tsx` | Tier + currency | Store profile, payment gateways, security settings, sync settings, about |

For each view, the underlying data layer is already there — see `lib/db-client.ts` for all available tables and `lib/audit-log.ts` for hash-chain helpers.

---

## Step 2.4 — Add measurement unit presets (11)

The product form currently only captures `baseUnitSalePrice`. To support the 11 measurement presets (pharmacy tablet→card→pack, wire meter→roll, etc.), extend `components/views/products-view.tsx` → `AddProductDialog` to:

1. Show a preset dropdown (Pharmacy / Wire / Fabric / Liquid ml / Liquid L / Pieces/Dozen / Pieces/Carton / Weight g / Weight kg / Length cm / Custom)
2. Auto-fill `packSize`, `cardSize`, `baseUnitName`, `packName`, `cardName` from the preset
3. Show top-down pricing: pack price → auto-calc card → auto-calc unit
4. Allow fixed price override for card/unit

Reference the full preset table in the master prompt under section "6. MEASUREMENT UNITS".

---

## Step 2.5 — Wire up encrypted backups (Layer 7)

The `components/views/backups-view.tsx` already supports encrypted export via `lib/crypto.ts → encryptBackup()`. Verify it works:

1. Go to Backups view in the running app
2. Tap "Export (encrypted)"
3. Enter a password
4. The `.spbk` file is written to `Documents/StockPilot/` (Android) or downloaded (web)
5. To restore: implement an Import button that calls `decryptBackup(blob, password)`, then `db.tables.bulkAdd()` each table from the decrypted JSON

---

## What you have now

✅ A complete, runnable Next.js PWA with all 13 views
✅ All security layer stubs in place (real implementations in `lib/crypto.ts`, `lib/security.ts`, `lib/audit-log.ts`)
✅ Theme system (light/dark/system)
✅ Permission-filtered sidebar
✅ License + trial + PIN + tier gating
✅ Hash-chained audit trail
✅ Sync queue + flush engine (offline-ready)
✅ PWA installable on Android/desktop

## What's next

→ [Phase 3 — Capacitor Integration](./PHASE_3_CAPACITOR_INTEGRATION.md): Wrap the PWA as a native Android project.
