# Phase 3 — Capacitor Integration

**Goal:** Wrap the Next.js PWA as a native Android project using Capacitor 6.

**Time estimate:** 2 hours.

---

## What is Capacitor?

Capacitor is the official native runtime from Ionic. It wraps your existing PWA in a native Android (and iOS) WebView, then exposes native device features (camera, biometric, filesystem, etc.) through JavaScript bridges.

Unlike React Native (which rewrites your UI in native components), Capacitor keeps your existing React/Tailwind UI untouched — you only swap browser APIs for native plugins where needed.

**Why Capacitor for StockPilot?**
- 170+ existing features already built as a Next.js PWA — rewriting in React Native would waste months
- All Dexie/IndexedDB code works as-is inside Android WebView
- Native plugins cover every required feature (camera ML Kit, biometric, Bluetooth, filesystem)

---

## Step 3.1 — Verify Capacitor config

Open `capacitor.config.ts`. Key fields:

```ts
{
  appId: 'com.obandetechhub.stockpilot',  // ← Android package name
  appName: 'StockPilot',
  webDir: 'out',                          // ← Next.js static export output
  backgroundColor: '#059669',
  android: {
    allowMixedContent: false,             // ← Layer 9: HTTPS only
    webContentsDebuggingEnabled: false,   // ← Layer 12: anti-debug
  },
  // ...splash, status bar, haptics config
}
```

The `webDir: 'out'` is critical — Capacitor copies this folder into the APK.

---

## Step 3.2 — Verify next.config.js static export

Open `next.config.js`. The key line is:

```js
output: 'export',  // ← tells Next.js to build a static site (no server)
```

This is what enables Capacitor to host the app entirely from local files inside the APK.

---

## Step 3.3 — First sync

```bash
npm run build           # → builds Next.js → ./out
npx cap sync android    # → copies ./out → android/app/src/main/assets/public
```

You should see output like:
```
✔ Copying web assets from out to android/app/src/main/assets/public in 2.34s
✔ Creating android/app/src/main/assets/capacitor.config.json in 1.23ms
✔ copy android
✔ Updating Android plugins
✔ update android
✔ Sync finished in 4.56s
```

---

## Step 3.4 — Open in Android Studio

```bash
npx cap open android
```

This launches Android Studio with the `android/` project loaded.

**First-time Gradle sync:** Android Studio will spend 1–3 minutes downloading Gradle 8.5 and all dependencies. Let it finish — don't cancel.

---

## Step 3.5 — Run on a device or emulator

1. **Physical device (recommended for native features):**
   - Enable Developer Options on your Android phone (Settings → About → tap Build Number 7 times)
   - Enable USB Debugging
   - Plug in via USB
   - In Android Studio, select your device from the dropdown at the top
   - Click ▶️ Run

2. **Emulator:**
   - In Android Studio: Tools → Device Manager → Create Device → Pixel 7 → API 34
   - Click ▶️ Run

You should see the StockPilot app launch on the device. The license activation screen should appear.

---

## Step 3.6 — Replace browser APIs with native plugins

The PWA uses some browser APIs that need native equivalents in the APK:

| Browser API | Native replacement | Bridge file |
|-------------|---------------------|-------------|
| `navigator.onLine` | `@capacitor/network` | `native/network.ts` |
| `BarcodeDetector` (Chrome only) | `@capacitor-mlkit/barcode-scanning` | `native/barcode-scanner.ts` |
| `navigator.share` | `@capacitor/share` | (use directly) |
| `Web Crypto` (works, but...) | `@capacitor-community/secure-storage` for keys | `native/secure-storage.ts` |
| `localStorage` | `@capacitor/preferences` | (use localStorage for non-sensitive) |
| `Notification` (web) | `@capacitor/local-notifications` | `native/notifications.ts` |

The bridge files in `native/` already handle the conditional logic — they use `isNative()` from `@capacitor/core` to call the native plugin on Android, falling back to the browser API on web.

---

## Step 3.7 — Configure splash screen + status bar

Already wired in `capacitor.config.ts`:

```ts
SplashScreen: {
  launchShowDuration: 1200,    // 1.2s splash
  backgroundColor: '#059669',
  splashFullScreen: true,
  splashImmersive: true,
},
StatusBar: {
  style: 'DARK',               // white text
  backgroundColor: '#059669',
  overlaysWebView: false,
},
```

The app layout calls `hideSplash()` after 1.5s (see `app/layout.tsx`) to dismiss the splash once React has hydrated.

To customize the splash image, drop a `splash.png` (1024×1024) into `android/app/src/main/res/drawable/` and reference it as `android:src="@drawable/splash"` in `splash.xml`.

---

## Step 3.8 — Verify native network listener

The `usePwa()` hook (in `hooks/use-pwa.ts`) calls `initNetwork()` on mount, which registers a Capacitor network listener. When the device goes offline → online, the `useSync()` hook fires `flushSyncQueue()`.

To test:
1. Build the APK and install on a device
2. Open the app, log in
3. Toggle airplane mode ON
4. The header badge should show "Offline — 0 pending"
5. Record a sale (it goes to IndexedDB + syncQueue)
6. The badge should show "Offline — 1 pending"
7. Toggle airplane mode OFF
8. The badge should briefly show "Syncing..." then "Synced"

(Note: actual cloud sync requires a backend — see Phase 6.)

---

## Step 3.9 — Configure app shortcuts (long-press icon)

Already configured in `android/app/src/main/res/xml/shortcuts.xml`:

- **Quick Sale** → `stockpilot://view/sell`
- **Stock In** → `stockpilot://view/movements`
- **Reports** → `stockpilot://view/reports`

To handle these deep links in your React code, add to `app/page.tsx`:

```tsx
import { App } from '@capacitor/app';

useEffect(() => {
  App.addListener('appUrlOpen', ({ url }) => {
    if (url.startsWith('stockpilot://view/')) {
      const view = url.replace('stockpilot://view/', '');
      setView(view as ViewKey);
    }
  });
}, []);
```

---

## What you have now

✅ A native Android app that opens your PWA in a WebView
✅ Native splash screen + status bar
✅ Native network listener (replaces navigator.onLine)
✅ App shortcuts (long-press icon)
✅ AndroidManifest with all required permissions
✅ ProGuard / R8 config (Layer 12) ready for release builds

## What's next

→ [Phase 4 — Native Plugins](./PHASE_4_NATIVE_PLUGINS.md): Wire up all 9 native bridges (barcode, biometric, printer, etc.).
