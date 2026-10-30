# StockPilot — Changelog

All notable changes to StockPilot will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Initial Capacitor 6 + Next.js 16 PWA project structure
- 12-layer anti-hack security architecture (encryption, hash chains, brute-force protection, audit trail, etc.)
- Offline-first sync engine with progressive queue + conflict resolution
- 9 native Capacitor bridges (barcode ML Kit, biometric, filesystem, Bluetooth printer, notifications, network, secure storage, haptics, splash)
- 8-phase development documentation (`docs/PHASE_1_SETUP.md` through `PHASE_8_SIGN_DISTRIBUTE.md`)
- Python key generators for 50 license keys + 50 Full Access PINs + 50 tier upgrade keys
- ProGuard/R8 anti-reverse-engineering config (Layer 12)
- 3-tier system (Starter / Business / Premium) with feature gates
- 4-role permission system (admin / manager / stockkeeper / salesperson)
- 13 view components (home, sell, products, movements, purchase orders, suppliers, dashboard, reports, profit analytics, creditors, users, activity log, backups, settings)
- 5 Nigerian payment gateways (Paystack, Flutterwave, Opay, Moniepoint, Bank Transfer)
- PWA service worker v48 with background sync

### Security
- AES-256-GCM encryption for sensitive IndexedDB fields (Layer 1)
- PBKDF2-SHA256 password hashing with 100k iterations + per-user salt (Layer 2)
- 15-minute session timeout with 14-minute warning (Layer 3)
- Escalating brute-force lockouts for login, license, and PIN (Layer 4)
- SHA-256 hash chains on sales / movements / credit payments / audit logs (Layer 5)
- Zod input validation across all data entry points (Layer 6)
- AES-256 encrypted backups with PBKDF2 key derivation (Layer 7)
- Device fingerprinting via SHA-256(screen + tz + lang + platform + cores) (Layer 8)
- HTTPS-only with HMAC-SHA256 request signing (Layer 9)
- Immutable audit trail (Layer 10)
- Two-factor auth (admin SMS OTP, Business+ tier) (Layer 11)
- ProGuard obfuscation + WebView debugging disabled + allowBackup=false (Layer 12)

## [1.0.0] — TBD

First public release. See [docs/PHASE_8_SIGN_DISTRIBUTE.md](docs/PHASE_8_SIGN_DISTRIBUTE.md) for the launch checklist.

---

Maintained by **ObandeTechHub** · 07036001818 · © 2026
