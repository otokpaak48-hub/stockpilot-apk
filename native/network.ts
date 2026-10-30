/**
 * StockPilot — Native Network Status
 * On native: uses @capacitor/network.
 * On web: uses navigator.onLine + window online/offline events.
 */

export type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown';

export interface NetStatus {
  connected: boolean;
  type: NetworkType;
}

let currentStatus: NetStatus = { connected: true, type: 'unknown' };
const listeners: Set<(s: NetStatus) => void> = new Set();

let initialized = false;

export async function initNetwork(): Promise<NetStatus> {
  if (initialized) return currentStatus;
  initialized = true;

  // Try native first
  try {
    const isNativeFlag = (await import('./index')).isNative();
    if (isNativeFlag) {
      const { Network } = await import('@capacitor/network');
      const status = await Network.getStatus();
      currentStatus = { connected: status.connected, type: (status.connectionType as NetworkType) ?? 'unknown' };
      Network.addListener('networkStatusChange', (s) => {
        currentStatus = { connected: s.connected, type: (s.connectionType as NetworkType) ?? 'unknown' };
        listeners.forEach((fn) => fn(currentStatus));
      });
      return currentStatus;
    }
  } catch { /* fall through to web */ }

  // Web fallback
  currentStatus = { connected: navigator.onLine, type: navigator.onLine ? 'wifi' : 'none' };
  window.addEventListener('online',  () => { currentStatus = { connected: true,  type: 'wifi' }; listeners.forEach((fn) => fn(currentStatus)); });
  window.addEventListener('offline', () => { currentStatus = { connected: false, type: 'none' }; listeners.forEach((fn) => fn(currentStatus)); });
  return currentStatus;
}

export function getNetworkStatus(): NetStatus { return currentStatus; }

export function onNetworkChange(fn: (s: NetStatus) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
