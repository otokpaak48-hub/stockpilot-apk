/**
 * StockPilot — Native Bridges Index
 * ------------------------------------------------------------------
 * Single entry-point that gracefully degrades to web APIs when running
 * outside Capacitor (e.g. browser dev mode, PWA install).
 *
 * Each module dynamically imports its Capacitor plugin only when on
 * native platform. On web, all functions return safe defaults.
 */

export function isNative(): boolean {
  return false; // Web-only build; set to true via Capacitor.isNativePlatform() in APK build
}

export function platform(): 'android' | 'ios' | 'web' {
  return 'web';
}

export * from './barcode-scanner';
export * from './biometric';
export * from './filesystem';
export * from './printer';
export * from './notifications';
export * from './network';
export * from './secure-storage';
export * from './haptics';
export * from './splash-screen';
