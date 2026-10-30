# Phase 1 — Project Setup

**Goal:** Get the repo cloned, dependencies installed, and the dev server running locally.

**Time estimate:** 30 minutes.

---

## Step 1.1 — Prerequisites check

Open a terminal and verify each tool is installed:

```bash
node --version          # ≥ 20.x
npm --version           # ≥ 10.x
python3 --version       # ≥ 3.10
git --version           # ≥ 2.40
java -version           # 17 (for Android builds)
echo $ANDROID_HOME      # should point to Android SDK
```

If anything is missing, see the **Prerequisites** section in the main README.

---

## Step 1.2 — Clone and install

```bash
git clone https://github.com/obandetechhub/stockpilot-apk.git
cd stockpilot-apk
npm install
```

> The `npm install` will pull in Next.js 16, Capacitor 6, Dexie 4, Tailwind 4, and all the native plugins. Expect 2–4 minutes on a fresh install.

---

## Step 1.3 — Generate the 150 private keys

StockPilot ships with placeholder hashes in:
- `lib/license-data.ts` (50 license keys)
- `lib/pin-data.ts` (50 Full Access PINs)
- `lib/tier-data.ts` (50 tier upgrade keys: 25 Business + 25 Premium)

Generate the real keys + hashes:

```bash
npm run keys:all
```

This runs three Python scripts that:
1. Generate the plaintext keys → `download/license_keys.txt`, `download/full_access_pins.txt`, `download/tier_upgrade_keys.txt`
2. Compute SHA-256 hashes (with per-app salt) and overwrite the placeholder `.ts` files.

**IMPORTANT:** The three `.txt` files are gitignored — they contain the master keys. Back them up to a secure off-device location (encrypted cloud drive, password manager, hardware security module).

---

## Step 1.4 — Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 — you should see the StockPilot license activation screen.

Try entering one of the keys from `download/license_keys.txt`. The app should activate and drop you on the Home view.

---

## Step 1.5 — Verify the file structure

```bash
ls -la
# Should see:
# - app/              (Next.js App Router)
# - components/       (UI + 13 views)
# - hooks/            (auth, pwa, sync, toast, mobile)
# - lib/              (db, crypto, security, license, sync, etc.)
# - native/           (9 Capacitor bridges)
# - public/           (manifest, sw.js, icons)
# - android/          (Capacitor Android project)
# - scripts/          (key generators, build scripts)
# - docs/             (this file + 7 more)
# - download/         (your private keys — gitignored)
```

---

## What you have now

✅ A working Next.js PWA running locally
✅ 50 valid license keys + 50 PINs + 50 tier keys
✅ All 12 security layer files in place (with placeholder data)
✅ All native bridge stubs ready for Phase 3+ integration

## What's next

→ [Phase 2 — PWA Foundation](./PHASE_2_PWA_FOUNDATION.md): Wire up Dexie schema, theme, layout, and basic CRUD.

## Troubleshooting

**`npm install` fails with peer-dependency errors**
→ Run `npm install --legacy-peer-deps` once, then commit `package-lock.json`.

**`npm run keys:all` fails with `python3: not found`**
→ Install Python 3.10+ from https://python.org or `apt install python3`.

**Dev server shows blank page**
→ Check the browser console. Most likely the `lib/license-data.ts` is still showing the placeholder — re-run `npm run keys:all`.
