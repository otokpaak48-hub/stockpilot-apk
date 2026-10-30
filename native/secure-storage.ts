/**
 * StockPilot — Native Secure Storage
 * On native: uses @capacitor-community/secure-storage (Android Keystore).
 * On web: uses in-memory Map (dev only — never ship web to production).
 */

import { isNative } from './index';

const memoryFallback: Map<string, string> = new Map();

export async function setSecure(key: string, value: string): Promise<void> {
  if (!isNative()) { memoryFallback.set(key, value); return; }
  try {
    const { SecureStorage } = await import(/* webpackIgnore: true */ '@capacitor-community/secure-storage');
    await SecureStorage.set({ key, value });
  } catch {
    memoryFallback.set(key, value);
  }
}

export async function getSecure(key: string): Promise<string | null> {
  if (!isNative()) return memoryFallback.get(key) ?? null;
  try {
    const { SecureStorage } = await import(/* webpackIgnore: true */ '@capacitor-community/secure-storage');
    const result = await SecureStorage.get({ key });
    return result.value;
  } catch {
    return null;
  }
}

export async function removeSecure(key: string): Promise<void> {
  if (!isNative()) { memoryFallback.delete(key); return; }
  try {
    const { SecureStorage } = await import(/* webpackIgnore: true */ '@capacitor-community/secure-storage');
    await SecureStorage.remove({ key });
  } catch { /* ignore */ }
}

export async function clearSecure(): Promise<void> {
  if (!isNative()) { memoryFallback.clear(); return; }
  try {
    const { SecureStorage } = await import(/* webpackIgnore: true */ '@capacitor-community/secure-storage');
    await SecureStorage.clear();
  } catch { /* ignore */ }
}

export const SECURE_KEYS = {
  jwt:           'sp_jwt',
  jwtExpires:    'sp_jwt_expires',
  hmacSecret:    'sp_hmac_secret',
  masterKeyHint: 'sp_master_key_hint',
} as const;
