# Phase 8 — Sign & Distribute

**Goal:** Sign the release APK with your keystore, then distribute via Play Store or direct APK share.

**Time estimate:** 1 hour.

---

## Step 8.1 — Generate your release keystore (ONCE)

This keystore defines your app's identity for its entire lifetime. **Lose it, and you cannot publish updates to the same Play Store listing.**

```bash
keytool -genkey -v -keystore android/stockpilot.keystore -alias stockpilot \
  -keyalg RSA -keysize 2048 -validity 36500 \
  -dname "CN=ObandeTechHub, O=ObandeTechHub, L=Lagos, C=NG" \
  -storepass YOUR_KEYSTORE_PASS -keypass YOUR_KEY_PASS
```

**Back up this keystore to multiple secure off-device locations:**
- Encrypted Google Drive folder
- Password manager attachment (1Password, Bitwarden)
- USB stick in a locked drawer
- (Optional) Hardware security module

**Do NOT commit `stockpilot.keystore` to Git.** It's already in `.gitignore`.

---

## Step 8.2 — Configure keystore.properties

```bash
cd android
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties` and fill in your real credentials:

```properties
storeFile=stockpilot.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=stockpilot
keyPassword=YOUR_KEY_PASSWORD
```

**Do NOT commit `keystore.properties` to Git.** Already in `.gitignore`.

---

## Step 8.3 — Sign the APK

```bash
bash scripts/sign-apk.sh
```

This script:
1. Reads `android/keystore.properties`
2. Runs `jarsigner` on the unsigned APK with your keystore
3. Runs `zipalign` to optimize the APK layout
4. Outputs the final signed APK:
   ```
   android/app/build/outputs/apk/release/StockPilot-v1.0.0.apk
   ```

---

## Step 8.4 — Verify the signature

```bash
# Verify the APK is signed
jarsigner -verify -verbose -certs android/app/build/outputs/apk/release/StockPilot-v1.0.0.apk

# Should print: jar verified.
```

---

## Step 8.5 — Distribution option A — Direct APK share

For testing with a small group of beta users, just share the signed APK:

1. Copy `StockPilot-v1.0.0.apk` to your phone (via USB, Drive, WhatsApp)
2. On the recipient's Android phone: enable "Install unknown apps" for the file manager or browser
3. Tap the APK → Install

**Direct APK distribution checklist:**
- [ ] Recipient has enabled "Install unknown apps" for their browser/file manager
- [ ] APK is signed with your release keystore
- [ ] Version code increments with every new build (edit `android/app/build.gradle → versionCode`)

---

## Step 8.6 — Distribution option B — Google Play Store

For broad public distribution, publish to Play Store.

### Step 8.6.1 — Create a Play Console account

1. Go to https://play.google.com/console
2. Sign in with your Google account
3. Pay the one-time $25 registration fee
4. Complete developer identity verification

### Step 8.6.2 — Create the app listing

1. Play Console → "Create app"
2. App name: **StockPilot — Offline Inventory**
3. Default language: English
4. App type: **App** (not Game)
5. Pricing: **Paid** (₦5,000 starter license — users pay ObandeTechHub directly, then receive a license key) OR **Free with in-app purchases** (more complex — requires Play Billing integration)

> **Recommendation:** Mark the app as **Free** on Play Store, but require a license key on first launch (your existing model). Users contact ObandeTechHub on 07036001818 to purchase keys.

### Step 8.6.3 — Set up the store listing

Required assets:

| Asset | Spec | Tool |
|-------|------|------|
| App icon | 512×512 PNG | Use existing `public/icons/icon-512.png` |
| Feature graphic | 1024×500 PNG | Create with Canva / Figma |
| Phone screenshots | Min 2, 16:9 or 9:16, JPEG/PNG, ≤ 8MB each | Take from emulator/device |
| 7-inch tablet screenshots | Optional but recommended | |
| 10-inch tablet screenshots | Optional but recommended | |

Suggested screenshot flow:
1. License activation screen
2. Home dashboard with KPI cards
3. Quick Sale POS with cart
4. Products grid with barcode scan
5. Dashboard with charts
6. Activity log / audit trail
7. Settings → Tier & Upgrades

### Step 8.6.4 — Upload the AAB (not APK)

Google Play requires Android App Bundles (`.aab`), not APKs:

```bash
# Build AAB instead of APK
cd android && ./gradlew bundleRelease

# Output:
# android/app/build/outputs/bundle/release/app-release.aab
```

The AAB must be signed with your upload key. Play Console will then:
1. Generate optimized APKs per device (smaller download for users)
2. Sign the final APKs with the Play App Signing key (managed by Google)

**Play App Signing:** During your first upload, Google will ask you to opt in. **OPT IN.** This lets Google manage your app signing key — if you ever lose your upload keystore, Google can reset it for you. Without this, losing the keystore means you can never update the app.

### Step 8.6.5 — Complete the content rating questionnaire

Play Console → App content → Content rating → Fill out the IARC questionnaire. For StockPilot:
- Contains user-generated content? No
- Allows digital purchases? Yes (license keys sold outside Play Store)
- Shares user info? Yes (cloud sync — mention in privacy policy)
- Result: Rated "Everyone" (suitable for all ages)

### Step 8.6.6 — Privacy policy URL

Required. Host a privacy policy on your website (e.g. `https://obandetechhub.com/stockpilot-privacy`). Cover:
- What data is collected: products, sales, customers, audit logs
- Where data is stored: device IndexedDB (encrypted) + cloud backend (Business+ tier)
- Third-party services: Paystack, Flutterwave (payment), Supabase/Firebase (sync), Twilio/Termii (SMS 2FA)
- Data retention: until user deletes
- User rights: export, delete via in-app Settings

### Step 8.6.7 — Data safety form

Play Console → App content → Data safety → Declare:
- Personal info collected: Name, phone, email (for creditor + customer records)
- Financial info: Payment methods (no card numbers stored — Paystack/Flutterwave handle that)
- App activity: Sales, stock movements, audit log
- Encryption: Yes (AES-256 in transit and at rest)
- User can request deletion: Yes

### Step 8.6.8 — Target audience

Play Console → App content → Target audience → 18+ (financial app)

### Step 8.6.9 — Government apps / News apps declarations

StockPilot is neither — select "No" for both.

### Step 8.6.10 — Submit for review

Play Console → Publishing → Production → Create release → Upload `app-release.aab` → Add release notes → Review release → Start rollout.

**Review time:** 1–7 days for first submission, 1–3 days for updates.

---

## Step 8.7 — Post-launch operations

### Update flow

1. Bump version in `android/app/build.gradle`:
   ```gradle
   versionCode 2          // increment every release
   versionName "1.0.1"    // user-visible
   ```
2. Commit + tag: `git tag v1.0.1 && git push --tags`
3. Build + sign new AAB
4. Upload to Play Console → Production → Create release
5. Users get auto-updated within 24 hours

### License key distribution workflow

1. Customer pays ₦5,000 to ObandeTechHub (bank transfer, cash, POS)
2. Open `download/license_keys.txt`, copy an unused key
3. Send the key to the customer (WhatsApp, SMS, email)
4. Mark the key as "used — [customer name, date]" in your tracking spreadsheet
5. Customer opens app → enters key → 90-day trial starts
6. After 90 days, customer contacts you for the Full Access PIN

### Tier upgrade workflow

1. Customer pays ₦2,000/mo (Business) or ₦5,000/mo (Premium) to ObandeTechHub
2. Open `download/tier_upgrade_keys.txt`, copy an unused key of the right kind
3. Send the key to the customer
4. Customer opens app → Settings → Tier & Upgrades → enters key → tier upgraded

### Refund / cancellation policy

- License keys: Once activated, non-refundable (you've already used a slot)
- Tier upgrades: Refundable within 7 days if not yet redeemed
- After redemption: Customer must contact support — you can remotely revoke the tier via the backend (if you've implemented cloud tier validation)

---

## Step 8.8 — Long-term maintenance

### Security audits

Every 6 months:
- Review `lib/security.ts` brute-force thresholds
- Audit the Activity Log for suspicious patterns
- Rotate the JWT signing key + HMAC secret
- Run `npm audit` and update vulnerable packages

### License key rotation

If a license key is leaked:
1. Remove its hash from `lib/license-data.ts`
2. Add it to a revoked list
3. Rebuild + redeploy the APK
4. Already-activated installs continue working (they have the trial/PIN unlocked)

### Backup your keystore!

Set a calendar reminder every 6 months to verify your keystore backups are still accessible. If your backups fail, regenerate the keystore and re-publish under a new package name (you'll lose your existing install base — drastic).

---

## Final checklist

- [ ] Release keystore generated and backed up to 3+ secure locations
- [ ] `keystore.properties` configured (gitignored)
- [ ] Signed APK / AAB builds successfully
- [ ] `jarsigner -verify` confirms signature
- [ ] App tested on at least 3 different Android devices (different screen sizes, API levels)
- [ ] All 12 security layers verified (Phase 5)
- [ ] Privacy policy URL live
- [ ] Play Console listing complete (screenshots, description, content rating, data safety)
- [ ] First AAB uploaded and approved
- [ ] License key tracking spreadsheet set up
- [ ] Support phone (07036001818) monitored during business hours

---

## 🎉 Congratulations!

You've successfully:
- Built a complete offline-first inventory + POS app
- Wrapped it as a native Android APK with Capacitor
- Implemented 12-layer anti-hack security
- Set up an offline/online sync engine
- Published to the Play Store (or distributed via direct APK)

StockPilot is now ready for African SMBs. 🚀

For support: **ObandeTechHub · 07036001818 · © 2026**
