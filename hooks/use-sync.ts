'use client';

/**
 * StockPilot — Sync hook
 * ------------------------------------------------------------------
 * Subscribes to network changes and flushes the sync queue when online.
 * Polls sync status every 30s for the SyncBadge.
 */

import { useEffect, useState, useCallback } from 'react';
import { flushSyncQueue, getSyncStatus } from '@/lib/sync-engine';
import { onNetworkChange, initNetwork } from '@/native/network';
import { hasFeature } from '@/lib/tiers';
import { writeAudit } from '@/lib/audit-log';

export type SyncBadge = 'synced' | 'syncing' | 'offline';

export function useSync() {
  const [badge, setBadge] = useState<SyncBadge>('synced');
  const [pending, setPending] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | undefined>();

  const refresh = useCallback(async () => {
    if (!hasFeature('cloud_sync')) {
      setBadge('synced');
      setPending(0);
      return;
    }
    const s = await getSyncStatus();
    setBadge(s.status);
    setPending(s.pending);
    setLastSyncAt(s.lastSyncAt);
  }, []);

  useEffect(() => {
    initNetwork();
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const off = onNetworkChange(async (s) => {
      if (s.connected && hasFeature('cloud_sync')) {
        setBadge('syncing');
        const result = await flushSyncQueue();
        await writeAudit('sync', `Sync flushed: ${result.succeeded} ok, ${result.failed} failed, ${result.conflicts} conflicts`);
        await refresh();
      } else if (!s.connected) {
        setBadge('offline');
      }
    });
    return off;
  }, [refresh]);

  const flushNow = useCallback(async () => {
    setBadge('syncing');
    const result = await flushSyncQueue();
    await writeAudit('sync', `Manual sync: ${result.succeeded} ok, ${result.failed} failed`, undefined);
    await refresh();
    return result;
  }, [refresh]);

  return { badge, pending, lastSyncAt, flushNow, refresh };
}
