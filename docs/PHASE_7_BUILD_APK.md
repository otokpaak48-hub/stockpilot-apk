# Phase 7 — Build the APK

**Goal:** Compile a signed, optimized release APK ready for distribution.

**Time estimate:** 1 hour (after Phase 1–6 are done).

---

## Step 7.1 — Pre-build checklist

Before building, verify:

- [ ] `npm run keys:all` has been run (real hashes in `lib/license-data.ts`, `lib/pin-data.ts`, `lib/tier-data.ts`)
- [ ] `npm run build` succeeds with no errors
- [ ] `npx cap sync android` succeeds
- [ ] Android SDK is installed (`$ANDROID_HOME` set)
- [ ] JDK 17 installed (`java -version` returns 17)
- [ ] A physical Android device or emulator available for testing

---

## Step 7.2 — Build the debug APK first

Always test with a debug build before release. Debug builds skip ProGuard (faster iteration) and include extra logging.

```bash
bash scripts/build-apk.sh debug
```

Output:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected device:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Test the core flows:
1. License activation (use a key from `download/license_keys.txt`)
2. Login (create a user first)
3. Add a product
4. Make a sale
5. Verify the audit log shows the sale
6. Verify the sync queue has 1 pending entry (if Business tier)
7. Test barcode scanning (Products view → 📷 Scan)
8. Test haptic feedback (button taps)
9. Test theme toggle (light/dark/system)
10. Test offline mode (airplane mode → make sale → airplane off → badge should update)

---

## Step 7.3 — Build the release APK

Once debug works, build the release APK with full ProGuard/R8 obfuscation:

```bash
bash scripts/build-apk.sh release
```

This:
1. Runs `npm run build` (Next.js → `./out`)
2. Runs `npx cap sync android` (copies assets to `android/app/src/main/assets/public/`)
3. Runs `./gradlew assembleRelease` (compiles + obfuscates + minifies)
4. Outputs to:
   ```
   android/app/build/outputs/apk/release/app-release-unsigned.apk
   ```

The release APK is unsigned at this point. Proceed to Phase 8 for signing.

---

## Step 7.4 — Common build errors

### Error: `OutOfMemoryError` during Gradle build

Edit `android/gradle.properties` and bump the heap:
```
org.gradle.jvmargs=-Xmx8g -XX:+UseParallelGC
```

### Error: `minSdkVersion 24 not satisfied`

StockPilot requires Android 7.0+. If your device is older, you'd need to lower `minSdk 24` in `android/app/build.gradle`, but we don't recommend it — Android 7 covers 95%+ of the Nigerian market.

### Error: `Could not resolve all files for configuration ':classpath'`

Open Android Studio → File → Project Structure → Project → set Android Gradle Plugin to 8.5.0 and Gradle to 8.7.

### Error: `MLKit barcode-scanning: dependency failed to resolve`

Make sure `maven { url 'https://jitpack.io' }` is in `android/build.gradle` → `allprojects → repositories`.

### Error: `Next.js build fails with "window is not defined"`

A component is using `window` during SSR. Add `'use client';` at the top of the file (already done for all client components in this repo).

### Error: `cap sync fails with "webDir 'out' does not exist"`

Run `npm run build` first to generate the static export.

### Error: ProGuard strips too much, app crashes on launch

Open `android/app/proguard-rules.pro` and add keep rules for any class that's accessed via reflection. The default rules in this repo keep Capacitor + ML Kit + Bluetooth classes — you shouldn't need to add more unless you add custom native plugins.

---

## Step 7.5 — Inspect the APK

After a successful release build, inspect what's inside:

```bash
# Decompile APK to Java (uses jadx)
jadx-gui android/app/build/outputs/apk/release/app-release-unsigned.apk
```

Verify:
- Class names are obfuscated (e.g. `a.b.c` instead of `com.obandetechhub.stockpilot.MainActivity`)
- String literals like license hashes are present (they have to be — but they're SHA-256, so unreadable)
- No `Log.d()` calls remain (ProGuard strips them per the rules)
- `WebView.setWebContentsDebuggingEnabled` shows as `false`

If you see readable class names or `Log.d` calls, ProGuard isn't running — check `android/app/build.gradle` → `release { minifyEnabled true }`.

---

## Step 7.6 — APK size optimization

The default release APK should be ~10–15 MB. To reduce further:

1. **App bundle (AAB) instead of APK** — Google Play uses AAB and serves per-device optimized APKs:
   ```bash
   npm run apk:bundle
   # → android/app/build/outputs/bundle/release/app-release.aab
   ```
   Upload the `.aab` to Play Store.

2. **Remove unused Capacitor plugins** — if you don't need Bluetooth printer or biometric, comment them out in `android/settings.gradle` and `package.json`.

3. **Image optimization** — compress PNG icons in `public/icons/` with `pngquant`:
   ```bash
   pngquant --quality=65-80 public/icons/*.png
   ```

4. **Tree-shake Next.js** — verify `next.config.js → output: 'export'` (already set).

---

## Step 7.7 — Generate SHA fingerprints

For Google Maps API keys, Firebase, Facebook SDK, etc.:

```bash
# Debug SHA-1
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1

# Release SHA-1 (after creating your release keystore in Phase 8)
keytool -list -v -keystore android/stockpilot.keystore -alias stockpilot -storepass YOUR_PASS | grep SHA1
```

---

## What you have now

✅ A debug APK for testing on real devices
✅ A release APK with ProGuard obfuscation + minification
✅ An unsigned `.apk` ready for signing

## What's next

→ [Phase 8 — Sign & Distribute](./PHASE_8_SIGN_DISTRIBUTE.md): Create a release keystore, sign the APK, and ship it.
