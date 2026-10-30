'use client';

/**
 * StockPilot — PWA hook (web + Capacitor unified)
 */
import { useEffect, useState } from 'react';
import { isNative } from '@/native';
import { onNetworkChange, NetStatus, initNetwork } from '@/native/network';

interface PwaState {
  isNative: boolean;
  online: boolean;
  installPromptAvailable: boolean;
  triggerInstall: () => Promise<boolean>;
  swRegistered: boolean;
}

export function usePwa(): PwaState {
  const [online, setOnline] = useState(true);
  const [installPromptAvailable, setInstallPromptAvailable] = useState(false);
  const [swRegistered, setSwRegistered] = useState(false);
  const deferredPromptRef: { current: any } = { current: null };

  useEffect(() => {
    initNetwork().then((s: NetStatus) => setOnline(s.connected));
    const off = onNetworkChange((s) => setOnline(s.connected));

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setInstallPromptAvailable(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    if (!isNative() && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => setSwRegistered(true)).catch(() => {});
    } else {
      setSwRegistered(true);
    }

    return () => {
      off();
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  const triggerInstall = async (): Promise<boolean> => {
    if (!deferredPromptRef.current) return false;
    deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;
    deferredPromptRef.current = null;
    setInstallPromptAvailable(false);
    return outcome === 'accepted';
  };

  return { isNative: isNative(), online, installPromptAvailable, triggerInstall, swRegistered };
}
