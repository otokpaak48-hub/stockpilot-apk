'use client';

/**
 * StockPilot — Safe Live Query Hook
 * ------------------------------------------------------------------
 * Wraps useLiveQuery with error handling to prevent app crashes
 * when IndexedDB operations fail (corruption, quota, etc.)
 */

import { useState, useEffect } from 'react';
import { db } from '@/lib/db-client';

export function useSafeQuery<T>(
  queryFn: () => Promise<T>,
  deps: any[] = [],
  defaultValue: T
): { data: T; loading: boolean; error: string | null } {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const result = await queryFn();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          console.error('[useSafeQuery] Error:', e);
          setError(e instanceof Error ? e.message : 'Unknown error');
          setData(defaultValue);
          setLoading(false);
        }
      }
    };

    run();

    // Re-run when DB changes
    const subscription = db.on('changes', () => {
      run();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
