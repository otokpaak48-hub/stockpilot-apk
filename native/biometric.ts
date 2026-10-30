/**
 * StockPilot — Native Biometric Auth
 * On web: returns false (always).
 */
import { isNative } from './index';

export interface BiometricAvailability {
  available: boolean;
  biometryType?: string;
  hasPermission: boolean;
}

export async function checkBiometric(): Promise<BiometricAvailability> {
  if (!isNative()) return { available: false, hasPermission: false };
  const { BiometricAuth } = await import(/* webpackIgnore: true */ '@capacitor-community/biometric-auth');
  const { isAvailable, biometryType } = await BiometricAuth.checkBiometry();
  const perm = await BiometricAuth.checkPermissions();
  return { available: isAvailable, biometryType: biometryType as string | undefined, hasPermission: perm.biometry === 'granted' };
}

export async function requestBiometricPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const { BiometricAuth } = await import(/* webpackIgnore: true */ '@capacitor-community/biometric-auth');
  const perm = await BiometricAuth.checkPermissions();
  if (perm.biometry === 'granted') return true;
  const after = await BiometricAuth.requestPermissions();
  return after.biometry === 'granted';
}

export async function authenticateWithBiometric(reason = 'Unlock StockPilot'): Promise<boolean> {
  if (!isNative()) return false;
  const { BiometricAuth } = await import(/* webpackIgnore: true */ '@capacitor-community/biometric-auth');
  const ok = await checkBiometric();
  if (!ok.available) return false;
  if (!ok.hasPermission) {
    const granted = await requestBiometricPermission();
    if (!granted) return false;
  }
  try {
    await BiometricAuth.authenticate({ reason, allowDeviceCredentials: true });
    return true;
  } catch {
    return false;
  }
}
