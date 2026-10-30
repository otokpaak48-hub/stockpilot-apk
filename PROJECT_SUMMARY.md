# 📦 StockPilot APK — Project Summary

A complete, GitHub-ready, production-ready codebase for converting the StockPilot Next.js PWA into a native Android APK using Capacitor 6.

## What's in this package

- **106 files** organized into 15 directories
- **58 TypeScript/TSX files** — full source code
- **11 Markdown docs** — master README + 8 phased guides + CHANGELOG + CONTRIBUTING
- **3 Python scripts** — generate 150 license/PIN/tier keys
- **3 Bash scripts** — setup Android env, build APK, sign APK
- **18 Android config files** — AndroidManifest, build.gradle, ProGuard, resources

## Quick start

```bash
cd stockpilot-apk
npm install
npm run keys:all           # Generate 150 private keys
npm run dev                # Run PWA at http://localhost:3000

# When ready for APK:
bash scripts/setup-android.sh   # One-time Android setup
bash scripts/build-apk.sh debug # Build debug APK
bash scripts/sign-apk.sh        # Sign release APK (after creating keystore)
```

## Project structure

```
stockpilot-apk/
├── app/                    # Next.js 16 App Router (PWA shell)
├── components/
│   ├── ui/                 # shadcn/ui primitives (placeholder — add as needed)
│   └── views/              # 14 feature views
├── hooks/                  # use-auth, use-pwa, use-sync, use-toast, use-mobile
├── lib/                    # Core logic (14 files)
│   ├── db-client.ts        # Dexie v7 schema + 18 tables
│   ├── crypto.ts           # AES-256-GCM + PBKDF2 + SHA-256 + HMAC (Layers 1, 2, 7, 9)
│   ├── security.ts         # Brute-force + Zod + device fingerprint + 2FA (Layers 4, 6, 8, 11)
│   ├── audit-log.ts        # Hash-chained immutable audit (Layers 5, 10)
│   ├── license.ts          # License + trial + PIN + tier validation
│   ├── sync-engine.ts      # Offline-first sync + WebSocket + conflict resolution
│   └── ...
├── native/                 # 9 Capacitor native bridges
├── public/                 # PWA manifest + service worker v48
├── android/                # Android Studio project (Capacitor)
├── scripts/                # Key generators + build/sign scripts
├── docs/                   # 8 phase-by-phase development guides
└── README.md               # Master documentation
```

## 8-Phase development roadmap

| Phase | Doc | Time |
|------:|-----|------|
| 1 | Project Setup | 30 min |
| 2 | PWA Foundation | 1 day |
| 3 | Capacitor Integration | 2 hrs |
| 4 | Native Plugins | 1 day |
| 5 | Security (12 layers) | 2 days |
| 6 | Sync Engine | 2 days |
| 7 | Build APK | 1 hr |
| 8 | Sign & Distribute | 1 hr |
| **Total** | | **~7 days** |

## 12-Layer security architecture

1. AES-256-GCM data encryption at rest (`lib/crypto.ts`)
2. PBKDF2 password hashing (100k iter + salt) (`lib/crypto.ts`)
3. Session timeout (15 min, warning at 14) (`hooks/use-auth.tsx`)
4. Brute-force protection (escalating lockouts) (`lib/security.ts`)
5. Tamper detection (hash chain) (`lib/audit-log.ts`)
6. Input validation (Zod schemas) (`lib/security.ts`)
7. Encrypted backups (AES-256 + password) (`lib/crypto.ts`)
8. Device fingerprinting (`lib/security.ts`)
9. Secure communication (TLS, JWT, HMAC, CSRF) (`lib/sync-engine.ts`)
10. Immutable audit trail (hash-chained) (`lib/audit-log.ts`)
11. Two-factor auth (admin SMS OTP) (`lib/security.ts`)
12. Anti-reverse-engineering (ProGuard, root detection) (`android/app/proguard-rules.pro`)

## Native plugins included

- `@capacitor-mlkit/barcode-scanning` — Native barcode scanning
- `@capacitor-community/biometric-auth` — Fingerprint / face unlock
- `@capacitor/filesystem` — Backups to device storage
- `@capacitor-community/bluetooth-serial` — Thermal printer (ESC/POS)
- `@capacitor/local-notifications` — Low-stock, credit-due alerts
- `@capacitor/network` — Online/offline detection
- `@capacitor-community/secure-storage` — Android Keystore for JWT/HMAC
- `@capacitor/haptics` — Haptic feedback
- `@capacitor/splash-screen` + `@capacitor/status-bar` — Native chrome

## Tier system

| Tier | Price | Highlights |
|------|-------|------------|
| Starter | ₦5,000 one-time | Offline inventory + sales + credit + multi-user + hash chains + audit |
| Business | ₦2,000/mo | + Cloud sync, real-time WebSocket, payment webhooks, 2FA |
| Premium | ₦5,000/mo | + Profit analytics, dead-stock reports, custom receipts |

## License keys

- 50 license keys (SHA-256 hashed) — `download/license_keys.txt` (after `npm run keys:license`)
- 50 Full Access PINs (SHA-256 hashed) — `download/full_access_pins.txt`
- 50 tier upgrade keys (25 Business + 25 Premium) — `download/tier_upgrade_keys.txt`

## Contact

**ObandeTechHub** · 07036001818 · © 2026
