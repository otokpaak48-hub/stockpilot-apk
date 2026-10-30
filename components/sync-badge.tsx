'use client';

/**
 * StockPilot — Sync Badge (header status indicator)
 * ------------------------------------------------------------------
 * Green "Synced" / amber "Syncing..." (pulse) / red "Offline — X pending"
 */

import { useSync } from '@/hooks/use-sync';
import { hasFeature } from '@/lib/tiers';

export function SyncBadge() {
  const { badge, pending, flushNow } = useSync();

  if (!hasFeature('cloud_sync')) {
    // Starter tier — manual sync only (export/import)
    return <div className="bg-muted px-2 py-1 rounded text-xs">Offline mode</div>;
  }

  const config = {
    synced:  { label: 'Synced',          bg: 'bg-sync-synced',    pulse: false },
    syncing: { label: 'Syncing...',      bg: 'bg-sync-syncing',   pulse: true  },
    offline: { label: `Offline — ${pending} pending`, bg: 'bg-sync-offline', pulse: false },
  }[badge];

  return (
    <button
      onClick={flushNow}
      className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-white ${config.bg} ${config.pulse ? 'animate-pulse-slow' : ''}`}
      title="Tap to flush sync queue now"
    >
      <span className="w-2 h-2 rounded-full bg-white inline-block" />
      {config.label}
    </button>
  );
}
