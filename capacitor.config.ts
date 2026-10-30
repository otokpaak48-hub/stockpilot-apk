// StockPilot — Capacitor Configuration
// (Type-only declaration inline so we don't need @capacitor/cli installed for web build)
// To install for native APK builds: npm install -D @capacitor/cli

interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  backgroundColor?: string;
  android?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
  server?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * StockPilot — Capacitor Configuration
 * Wraps the Next.js PWA (exported to ./out) as a native Android APK.
 *
 * Run `npm run cap:sync` after `npm run build` to push web assets to Android.
 */
const config: CapacitorConfig = {
  appId: 'com.obandetechhub.stockpilot',
  appName: 'StockPilot',
  webDir: 'out',
  backgroundColor: '#059669',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#059669',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#FFFFFF',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#059669',
      overlaysWebView: false,
    },
    Haptics: {
      enable: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_stockpilot',
      iconColor: '#059669',
      sound: 'bell.wav',
    },
    BiometricAuth: {
      allowDeviceCredentials: true,
    },
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
};

export default config;
