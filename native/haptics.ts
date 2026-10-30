/**
 * StockPilot — Native Haptics + Splash + Status Bar
 * All no-ops on web (graceful fallback).
 */

import { isNative } from './index';

export async function hapticLight(): Promise<void> {
  if (!isNative()) return;
  const { Haptics, ImpactStyle } = await import(/* webpackIgnore: true */ '@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function hapticMedium(): Promise<void> {
  if (!isNative()) return;
  const { Haptics, ImpactStyle } = await import(/* webpackIgnore: true */ '@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Medium });
}

export async function hapticHeavy(): Promise<void> {
  if (!isNative()) return;
  const { Haptics, ImpactStyle } = await import(/* webpackIgnore: true */ '@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Heavy });
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  const { Haptics, NotificationType } = await import(/* webpackIgnore: true */ '@capacitor/haptics');
  await Haptics.notification({ type: NotificationType.Success });
}

export async function hapticError(): Promise<void> {
  if (!isNative()) return;
  const { Haptics, NotificationType } = await import(/* webpackIgnore: true */ '@capacitor/haptics');
  await Haptics.notification({ type: NotificationType.Error });
}

export async function hideSplash(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import(/* webpackIgnore: true */ '@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* ignore */ }
}

export async function setStatusBarDark(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import(/* webpackIgnore: true */ '@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#059669' });
  } catch { /* ignore */ }
}

export async function setStatusBarLight(): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import(/* webpackIgnore: true */ '@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
  } catch { /* ignore */ }
}
