# Phase 5 — Security Architecture (12 Layers)

**Goal:** Understand, verify, and tighten the 12-layer anti-hack architecture.

**Time estimate:** 2 days (mostly verification + testing).

---

## Layer overview

| # | Layer | Implementation file | Status |
|--:|-------|---------------------|--------|
| 1 | AES-256-GCM data encryption at rest | `lib/crypto.ts` | ✅ Implemented |
| 2 | PBKDF2 password hashing (100k iter + salt) | `lib/crypto.ts` | ✅ Implemented |
| 3 | Session timeout (15 min, warning at 14) | `hooks/use-auth.tsx` | ✅ Implemented |
| 4 | Brute-force protection (escalating lockouts) | `lib/security.ts` | ✅ Implemented |
| 5 | Tamper detection (hash chain) | `lib/audit-log.ts` | ✅ Implemented |
| 6 | Input validation (Zod schemas) | `lib/security.ts` | ✅ Implemented |
| 7 | Encrypted backups (AES-256 + password) | `lib/crypto.ts` | ✅ Implemented |
| 8 | Device fingerprinting | `lib/security.ts` | ✅ Implemented |
| 9 | Secure communication (TLS, JWT, HMAC, CSRF) | `lib/sync-engine.ts` + Android `network_security_config.xml` | ✅ Implemented |
| 10 | Immutable audit trail (hash-chained) | `lib/audit-log.ts` | ✅ Implemented |
| 11 | Two-factor auth (admin SMS OTP) | `lib/security.ts` | ✅ Implemented |
| 12 | Anti-reverse-engineering (ProGuard, root detection) | `android/app/proguard-rules.pro` | ✅ Configured |

---

## Layer 1 — Data encryption at rest

**File:** `lib/crypto.ts` → `deriveMasterKey()`, `aesEncrypt()`, `aesDecrypt()`

How it works:
1. On license activation, derive a 256-bit AES master key from `(licenseKey + deviceFingerprint)` via PBKDF2 (100k iterations)
2. Store the key in Web Crypto's non-extractable key store — it can be USED for crypto but not EXPORTED
3. Sensitive fields in IndexedDB tables (`sales.customerName`, `creditors.name`, `creditors.phone`, `users.passwordHash`, `settings.value`) are AES-256-GCM encrypted before write
4. On read, decrypted transparently

**Verify:**
```bash
# Open browser DevTools → Application → IndexedDB → StockPilotDB → creditors
# The `name` field should show as base64 ciphertext, not plaintext
```

**TODO for production:** Add Dexie hooks (`db.creditor.hook('creating', ...)` etc.) to auto-encrypt on write and auto-decrypt on read. The current stubs require explicit encrypt/decrypt at call sites.

---

## Layer 2 — Password security

**File:** `lib/crypto.ts` → `hashPassword()`, `verifyPassword()`

PBKDF2-SHA256 with 100,000 iterations + per-user 16-byte salt. Storage format is PHC-style: `pbkdf2$100000$<saltHex>$<hashHex>`.

**Verify:**
1. Open Users view → create a new user with password "test1234"
2. In DevTools → IndexedDB → users table, the `passwordHash` field should start with `pbkdf2$100000$` — NOT be the plaintext password
3. Log out, log back in with the password — should succeed
4. Try wrong password — should fail

---

## Layer 3 — Session management

**File:** `hooks/use-auth.tsx`

- 15-minute inactivity timeout
- Warning shown at 14 minutes
- Activity tracked via `mousedown`, `keydown`, `touchstart`, `scroll` events
- Session token held in memory only (never localStorage)
- Auto-logout fires `writeAudit('login', 'Session timed out')`

**Verify:**
1. Log in
2. Wait 14 minutes (or temporarily change `SESSION_TIMEOUT_MS` to 60s and `SESSION_WARNING_MS` to 50s in the source)
3. Warning toast should appear
4. After timeout, redirected to login screen

---

## Layer 4 — Brute-force protection

**File:** `lib/security.ts`

Three independent lockout trackers:

| Action | Threshold → Lockout |
|--------|---------------------|
| Login attempts | 3 → 30s, 5 → 5min, 10 → 30min + alert admin |
| License key attempts | 5 → 10min, 10 → 1 hour |
| PIN attempts | 3 → 1hr, 5 → 24hr, 10 → **permanent lock** |

**Verify:**
1. Open the License screen
2. Enter 5 invalid keys → on the 5th, you should see "Locked. Try again in 600s."
3. Wait 10 minutes (or temporarily reduce the lockout in `LOCKOUT_SCHEDULE.license`)
4. Try again

**Permanent PIN lock recovery:** The user must contact ObandeTechHub (07036001818) — there is no in-app recovery. Document this in your support policy.

---

## Layer 5 — Data tamper detection (hash chain)

**File:** `lib/audit-log.ts`

Each sale, movement, credit payment, and audit entry includes a `recordHash`:
```
hash(N) = SHA-256(hash(N-1) + JSON.stringify(recordData(N)))
```

On app startup, `validateAllChains()` walks each chain and verifies every hash. If a record was tampered with, the chain breaks at that record → audit log entry + UI alert.

**Verify:**
1. Make a few sales
2. Open DevTools → IndexedDB → sales table → edit a record's `total` field directly (simulating tampering)
3. Reload the app
4. You should see a "Tamper detected in sales #X" entry in the Activity Log

---

## Layer 6 — Input validation

**File:** `lib/security.ts` → `schemas`

Zod schemas for: product, sale, movement, creditor, user, licenseKey, pin, tierKey.

Defense in depth:
- Zod validation at the call site (catches malformed input)
- `sanitizeText()` strips `<`, `>`, `"`, `'` (XSS hardening)
- React auto-escapes rendered content
- CSP header in `next.config.js`: `script-src 'self'` only

**Verify:**
1. Try creating a product with name `<script>alert(1)</script>` — Zod regex `/^[^<>]+$/` should reject it
2. Try a sale with `qty: -5` — Zod should reject with "Must be positive"

---

## Layer 7 — Encrypted backups

**File:** `lib/crypto.ts` → `encryptBackup()`, `decryptBackup()`

Format: `SPBK1$<saltHex>$<ivHex+cipherHex>`
- AES-256-GCM with PBKDF2 key derivation (50k iterations)
- 12-byte GCM IV (random per backup)
- 16-byte salt (random per backup)

**Verify:**
1. Open Backups view → Export (encrypted) → enter password "secret123"
2. Open the resulting `.spbk` file in a text editor — it should look like random hex, not readable JSON
3. Try `decryptBackup(blob, "wrong")` → should throw "Invalid backup password"

---

## Layer 8 — Device fingerprinting

**File:** `lib/security.ts` → `generateDeviceFingerprint()`

Components:
- Screen resolution + color depth
- Timezone
- Language
- Platform
- Hardware concurrency (CPU cores)

All hashed with SHA-256. The fingerprint is included in every sync request — server validates the device is authorized before accepting writes.

**License enforcement:** Each license key activates on ONE device only. To move to a new device: Settings → Deactivate License (calls backend to revoke old fingerprint, then activate on new device).

**Verify:**
```ts
import { generateDeviceFingerprint } from '@/lib/security';
const fp = await generateDeviceFingerprint();
console.log(fp.hash);  // 64-char hex SHA-256
console.log(fp.components);
```

---

## Layer 9 — Secure communication

**Files:** `lib/sync-engine.ts` + `android/app/src/main/res/xml/network_security_config.xml`

HTTPS-only (TLS 1.2+ enforced):
- `capacitor.config.ts`: `android.allowMixedContent = false`
- `next.config.js`: CSP header
- `network_security_config.xml`: `cleartextTrafficPermitted="false"` + certificate pinning for `api.stockpilot.app`

JWT auth:
- Stored in Android Keystore via `@capacitor-community/secure-storage`
- Refreshed every 24h
- Sent as `Authorization: Bearer <token>`

HMAC-SHA256 request signing:
- Each API request signed with `X-Signature` header
- Signature = `HMAC-SHA256(secret, "METHOD|path|timestamp|body")`
- Server re-computes and compares (constant-time)

CSRF protection:
- Same-site cookies
- `X-CSRF-Token` header

Rate limiting:
- 100 requests/minute per device (server-side)

Retry with exponential backoff:
- 1s, 2s, 4s, 8s, 16s, 32s, 60s (max)

---

## Layer 10 — Immutable audit trail

**File:** `lib/audit-log.ts`

The `activityLogs` table is itself hash-chained (Layer 5). Logged events:

- Sale recorded (who, when, amount, payment method)
- Stock movement (who, when, product, qty, type)
- User created/deleted/role changed
- License activated/deactivated (device fingerprint, timestamp)
- Tier upgraded
- Login attempt (username, success/fail, timestamp, device)
- Backup exported/imported
- Data tamper detected (record ID, expected hash, actual hash)

**Verify:**
1. Make a sale
2. Open Activity Log view → see "Sale recorded" entry
3. Try editing the activityLogs table directly → on next reload, tamper detection fires

---

## Layer 11 — Two-factor auth (admin, Business tier)

**File:** `lib/security.ts` → `generateOtp()`, `verifyOtp()`

- Triggers for admin role on Business+ tier
- 6-digit OTP, 5-minute TTL
- In production: integrate Twilio / Termii / Africa's Talking SMS gateway
- For dev: OTP returned to console — wire it to your SMS gateway

**Verify:**
1. Set `localStorage.setItem('sp_tier', 'business')` to simulate Business tier
2. Create an admin user, log in
3. After password, app prompts for OTP
4. OTP code is logged to the console (dev mode) — enter it
5. Login succeeds

---

## Layer 12 — Anti-reverse-engineering (APK)

**File:** `android/app/proguard-rules.pro` + `android/app/build.gradle` + `AndroidManifest.xml`

- **ProGuard/R8 obfuscation + minification** enabled in `release` build type
- **String encryption:** R8 with `-allowaccessmodification` strips debug info, renames classes/methods to short garbage names
- **WebView debugging disabled** in release: `WebView.setWebContentsDebuggingEnabled(false)` (in `MainActivity.java`)
- **allowBackup=false** in AndroidManifest (prevents `adb backup` extracting app data)
- **debuggable=false** in release manifest
- **Cleartext traffic disabled** (HTTPS only)

**Optional hardening (advanced):**
- Root detection: integrate `net.scottyab:rootbeer` library
- SafetyNet attestation: integrate `com.google.android.gms:play-services-safetynet`
- APK signature verification: check `getPackageManager().getPackageInfo(packageName, PackageManager.GET_SIGNATURES)` at runtime

These are noted as TODOs in `MainActivity.java` — implement when you're ready to ship.

---

## Security checklist before release

- [ ] `npm run keys:all` has been run, and `lib/license-data.ts`, `lib/pin-data.ts`, `lib/tier-data.ts` contain real hashes (not placeholders)
- [ ] Plaintext keys in `download/` are backed up to a secure off-device location
- [ ] `capacitor.config.ts` → `webContentsDebuggingEnabled: false`
- [ ] `android/app/build.gradle` → release build uses `minifyEnabled true` + `shrinkResources true`
- [ ] `AndroidManifest.xml` → `allowBackup="false"`, `debuggable="false"` (release)
- [ ] Test the hash chain: tamper a sale in IndexedDB → reload → tamper alert should fire
- [ ] Test brute-force: 5 wrong license keys → lockout
- [ ] Test session timeout: leave idle 15 min → auto-logout
- [ ] Test encrypted backups: open `.spbk` file → unreadable
- [ ] APK reverse-engineering attempt: `jadx` the APK → code should be obfuscated

## What's next

→ [Phase 6 — Sync Engine](./PHASE_6_SYNC_ENGINE.md): Offline-first sync architecture.
