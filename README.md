# StockPilot — Native APK Project (Capacitor + Next.js 16 PWA)

> **Offline-first inventory management for African SMBs.**
> 170+ features • 12-layer anti-hack security • Top-notch offline/online sync engine.
>
> **Developer:** ObandeTechHub • 07036001818 • © 2026
> **License:** Proprietary — 50 license keys + 50 Full Access PINs + 50 tier upgrade keys (SHA-256 hashed).

---

## 📖 Table of Contents

1. [What is StockPilot?](#what-is-stockpilot)
2. [Repo Layout](#repo-layout)
3. [Prerequisites](#prerequisites)
4. [Quick Start (5 minutes)](#quick-start-5-minutes)
5. [8-Phase Development Roadmap](#8-phase-development-roadmap)
6. [Security Architecture (12 Layers)](#security-architecture-12-layers)
7. [Offline/Online Sync Engine](#offlineonline-sync-engine)
8. [Tier System & Licensing](#tier-system--licensing)
9. [Building the APK](#building-the-apk)
10. [Signing & Distributing](#signing--distributing)
11. [Troubleshooting](#troubleshooting)
12. [Support](#support)

---

## What is StockPilot?

StockPilot is an offline-first inventory + POS platform built for African small businesses — pharmacies, fabric merchants, hardware stores, electronics shops, etc. It works **100% offline**, and goes online only for cloud sync, payment gateways, and real-time pushes (Business / Premium tiers).

This repo converts the existing Next.js 16 PWA into a **native Android APK** using Capacitor. The APK ships with:

- Native camera barcode scanning (ML Kit)
- Native push notifications (low-stock + credit alerts)
- Native filesystem backups (Downloads folder)
- Native biometric auth (fingerprint / face)
- Native Bluetooth thermal printing (58mm + 80mm ESC/POS)
- Background sync service (Business tier cloud sync)
- 12-layer anti-hack security (encryption, hash chains, tamper detection, ProGuard)
- Signed APK ready for Play Store or direct distribution

---

## Repo Layout

```
stockpilot-apk/
├── app/                    # Next.js 16 App Router (PWA shell)
│   ├── layout.tsx          # Root layout (ErrorBoundary, Theme, Auth, SW)
│   ├── page.tsx            # App shell (license gate -> login -> app)
│   └── globals.css         # Theme + utilities
├── components/
│   ├── ui/                 # shadcn/ui primitives (button, dialog, toast, etc.)
│   └── views/              # 13 feature views (home, sell, products, reports...)
├── hooks/                  # use-auth, use-pwa, use-sync, use-toast, use-mobile
├── lib/                    # Core logic
│   ├── db-client.ts        # Dexie v7 schema + all DB ops
│   ├── crypto.ts           # AES-256-GCM + PBKDF2 (Web Crypto)
│   ├── security.ts         # 12-layer security orchestrator
│   ├── audit-log.ts        # Hash-chained immutable audit trail
│   ├── license.ts          # License + trial + PIN validation
│   ├── tiers.ts            # Tier gating + FeatureGate
│   ├── sync-engine.ts      # Background sync queue + conflict resolution
│   ├── payment-gateways.ts # Paystack / Flutterwave / Opay / Moniepoint / Bank
│   ├── permissions.ts      # Role -> permission map
│   ├── format.ts           # Currency / date / number / CSV
│   └── utils.ts            # cn() helper
├── native/                 # Capacitor native bridges
│   ├── barcode-scanner.ts  # ML Kit
│   ├── biometric.ts        # Fingerprint / face
│   ├── filesystem.ts       # Backups to device storage
│   ├── printer.ts          # Bluetooth thermal (ESC/POS)
│   ├── notifications.ts    # Push + local notifications
│   ├── network.ts          # Online/offline detection
│   ├── secure-storage.ts   # Encrypted key-value storage
│   ├── haptics.ts          # Haptic feedback
│   └── splash-screen.ts    # Splash + status bar
├── public/                 # PWA assets (manifest, service worker, icons)
├── android/                # Android Studio project (Capacitor-generated)
├── scripts/                # Key generators + build/sign scripts
├── docs/                   # 8 phase-by-phase development guides
└── download/               # Generated key files + PDFs (gitignored)
```

---

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| **Node.js** | ≥ 20 LTS | Next.js 16 runtime |
| **npm** | ≥ 10 | Package manager |
| **Android Studio** | Hedgehog+ | Android SDK + emulator |
| **JDK** | 17 | Gradle 8 build |
| **Python** | ≥ 3.10 | Key-generation scripts |
| **Git** | ≥ 2.40 | Version control |
| **A physical Android device** | API 24+ (Android 7.0+) | For real-world testing (biometric, Bluetooth, camera) |

**Install Android SDK components via Android Studio → SDK Manager:**
- Android SDK Platform 34 (Android 14)
- Android SDK Build-Tools 34.0.0
- Android SDK Platform-Tools
- Android NDK (optional, for native libs)

Set environment variables (add to `~/.bashrc` or `~/.zshrc`):
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
```

---

## Quick Start (5 minutes)

```bash
# 1. Clone
git clone https://github.com/obandetechhub/stockpilot-apk.git
cd stockpilot-apk

# 2. Install dependencies
npm install

# 3. Generate the 150 private keys (license + PIN + tier)
npm run keys:all

# 4. Run the PWA in dev mode (http://localhost:3000)
npm run dev

# 5. When ready for APK — build, sync to Android, open in Android Studio
npm run cap:sync
npm run cap:open
```

> The first `npm run cap:sync` will auto-create the `android/` project. If it doesn't, run `npm run cap:add:android` first.

---

## 8-Phase Development Roadmap

Each phase has a dedicated, copy-paste-ready guide in `docs/`:

| Phase | Doc | What you build | Time |
|------:|-----|----------------|------|
| **1** | [docs/PHASE_1_SETUP.md](docs/PHASE_1_SETUP.md) | Repo init, dependencies, env, first `npm run dev` | 30 min |
| **2** | [docs/PHASE_2_PWA_FOUNDATION.md](docs/PHASE_2_PWA_FOUNDATION.md) | Next.js PWA shell, Dexie schema, theme, layout | 1 day |
| **3** | [docs/PHASE_3_CAPACITOR_INTEGRATION.md](docs/PHASE_3_CAPACITOR_INTEGRATION.md) | Capacitor init, `cap add android`, sync pipeline | 2 hrs |
| **4** | [docs/PHASE_4_NATIVE_PLUGINS.md](docs/PHASE_4_NATIVE_PLUGINS.md) | All 9 native bridges (barcode, biometric, printer, etc.) | 1 day |
| **5** | [docs/PHASE_5_SECURITY.md](docs/PHASE_5_SECURITY.md) | 12-layer security (encryption, hash chains, brute-force, audit) | 2 days |
| **6** | [docs/PHASE_6_SYNC_ENGINE.md](docs/PHASE_6_SYNC_ENGINE.md) | Offline-first sync queue + conflict resolution + WebSocket | 2 days |
| **7** | [docs/PHASE_7_BUILD_APK.md](docs/PHASE_7_BUILD_APK.md) | Gradle build, ProGuard, debug + release APK | 1 hr |
| **8** | [docs/PHASE_8_SIGN_DISTRIBUTE.md](docs/PHASE_8_SIGN_DISTRIBUTE.md) | Keystore, sign APK, Play Store / direct distribution | 1 hr |

**Total: ~7 working days** for an experienced React Native / Capacitor dev.

---

## Security Architecture (12 Layers)

| # | Layer | Implementation file |
|--:|-------|---------------------|
| 1 | AES-256-GCM data encryption at rest | `lib/crypto.ts` |
| 2 | PBKDF2 password hashing (100k iter + salt) | `lib/crypto.ts` |
| 3 | Session timeout (15 min, warning at 14) | `hooks/use-auth.tsx` |
| 4 | Brute-force protection (escalating lockouts) | `lib/security.ts` |
| 5 | Tamper detection (hash chain on sales/movements/audit) | `lib/audit-log.ts` |
| 6 | Input validation (Zod schemas, no HTML, no SQLi) | `lib/security.ts` |
| 7 | Encrypted backups (AES-256 + password) | `lib/crypto.ts` |
| 8 | Device fingerprinting | `lib/security.ts` |
| 9 | Secure communication (TLS 1.2+, JWT, HMAC, CSRF) | `lib/sync-engine.ts` |
| 10 | Immutable audit trail (hash-chained) | `lib/audit-log.ts` |
| 11 | Two-factor auth (admin SMS OTP) | `lib/security.ts` |
| 12 | Anti-reverse-engineering (ProGuard, root detection) | `android/app/proguard-rules.pro` |

See [docs/PHASE_5_SECURITY.md](docs/PHASE_5_SECURITY.md) for layer-by-layer implementation details.

---

## Offline/Online Sync Engine

**Design principle:** *Offline-First, Online-Enhanced*. The app works fully offline. Online connectivity adds cloud sync, real-time pushes, and payment webhooks — but is never required.

```
[Device A — Offline Sale]
    │ (instant write to IndexedDB)
    │ (added to syncQueue with status=pending)
    ▼
[Network returns]
    │ (Background sync fires)
    │ (Sync engine flushes queue)
    │ (POST to cloud API)
    ▼
[Cloud Backend]
    │ (stores record)
    │ (fires WebSocket push to Device B)
    ▼
[Device B — receives push]
    │ (updates IndexedDB)
    │ (dashboard refreshes automatically)
```

Key files: `lib/sync-engine.ts`, `hooks/use-sync.ts`, `public/sw.js`. Full spec in [docs/PHASE_6_SYNC_ENGINE.md](docs/PHASE_6_SYNC_ENGINE.md).

---

## Tier System & Licensing

| Tier | Price | Highlights |
|------|-------|------------|
| **Starter** | ₦5,000 one-time | Offline inventory + sales, barcode, credit, multi-user, local encrypted backups, hash chains, audit trail |
| **Business** | ₦2,000/mo | Everything in Starter + auto cloud sync, WebSocket real-time, email/SMS alerts, payment webhooks, 2FA |
| **Premium** | ₦5,000/mo | Everything in Business + profit analytics, dead-stock reports, custom receipt branding, priority support |

- **50 license keys** (SHA-256 hashed) → `download/license_keys.txt`
- **50 Full Access PINs** (SHA-256 hashed) → `download/full_access_pins.txt`
- **50 tier upgrade keys** (25 Business + 25 Premium) → `download/tier_upgrade_keys.txt`

Generate all keys with `npm run keys:all`. See [docs/PHASE_1_SETUP.md](docs/PHASE_1_SETUP.md) for key generation details.

---

## Building the APK

```bash
# 1. Build Next.js → static export to ./out
npm run build

# 2. Sync web assets to android/
npx cap sync android

# 3. Build debug APK (quick test on device)
npm run apk:debug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# 4. Build release APK (optimized, signed later)
npm run apk:release
# Output: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

See [docs/PHASE_7_BUILD_APK.md](docs/PHASE_7_BUILD_APK.md) for full Gradle, ProGuard, and release-build details.

---

## Signing & Distributing

```bash
# 1. Generate a release keystore (ONCE — back this up securely!)
keytool -genkey -v -keystore stockpilot.keystore -alias stockpilot \
  -keyalg RSA -keysize 2048 -validity 36500 \
  -dname "CN=ObandeTechHub, O=ObandeTechHub, L=Lagos, C=NG" \
  -storepass YOUR_KEYSTORE_PASS -keypass YOUR_KEY_PASS

# 2. Sign the release APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore stockpilot.keystore \
  android/app/build/outputs/apk/release/app-release-unsigned.apk stockpilot

# 3. Align (zipalign)
zipalign -v 4 app-release-unsigned.apk StockPilot-v1.0.0.apk

# 4. Distribute
#    - Play Store:  → https://play.google.com/console
#    - Direct:      → Send the .apk via WhatsApp/Drive/GitHub Releases
```

See [docs/PHASE_8_SIGN_DISTRIBUTE.md](docs/PHASE_8_SIGN_DISTRIBUTE.md) for full instructions including Play Store listing setup.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `cap sync` fails | Make sure `out/` exists (`npm run build` first) |
| Build fails with `minSdkVersion` error | Open `android/variables.gradle`, set `minSdkVersion=24` |
| Barcode scanner blank on emulator | Use a physical device — emulator camera lacks ML Kit support |
| `OutOfMemoryError` during build | Add `org.gradle.jvmargs=-Xmx4g` to `android/gradle.properties` |
| APK crashes on rooted device | That's the root-detection layer working as designed (Layer 12) |
| Biometric not available | Device lacks fingerprint sensor — falls back to PIN login |
| Sync queue not flushing | Check `hooks/use-sync.ts` — ensure `Network.addListener` is registered |

More in [docs/](docs/).

---

## Support

- **Phone / WhatsApp:** 07036001818
- **Developer:** ObandeTechHub
- **Email:** support@obandetechhub.com
- **Issues:** https://github.com/obandetechhub/stockpilot-apk/issues

© 2026 ObandeTechHub. All rights reserved. StockPilot is proprietary software — unauthorized distribution or reverse engineering is prohibited.
