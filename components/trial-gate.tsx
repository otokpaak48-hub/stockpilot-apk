'use client';

/**
 * StockPilot — Trial Gate (post-90-day Full Access PIN)
 * ------------------------------------------------------------------
 * Shows when the 90-day trial has expired. User enters one of the 50
 * Full Access PINs (SHA-256 hashed) to permanently unlock the app.
 * Brute-force: 3 → 1hr, 5 → 24hr, 10 → permanent lock.
 */

import { useState } from 'react';
import { unlockWithPin, getTrialProgressPct } from '@/lib/license';

export function TrialGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pct = getTrialProgressPct();

  const submit = async () => {
    setError(null);
    setLoading(true);
    const result = await unlockWithPin(pin);
    setLoading(false);
    if (result.ok) { onUnlocked(); return; }
    setError(result.error ?? 'Invalid PIN');
    setPin('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-danger to-warning">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-2">🔒</div>
          <h1 className="text-2xl font-bold">Trial complete</h1>
          <p className="text-sm text-muted-foreground">Your 90-day trial has ended ({pct.toFixed(0)}% used).</p>
        </div>

        <div className="bg-warning/10 border border-warning rounded-xl p-4 text-sm">
          <p className="font-semibold mb-1">Enter your Full Access PIN</p>
          <p className="text-xs text-muted-foreground">
            Your PIN was provided when you purchased StockPilot. Contact 07036001818 if you've lost it.
          </p>
        </div>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6-digit PIN"
          className="w-full px-4 py-3 rounded-xl border bg-background text-center font-mono text-2xl tracking-widest"
          inputMode="numeric"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {error && <div className="bg-danger/10 text-danger px-4 py-2 rounded-lg text-sm text-center">{error}</div>}

        <button
          onClick={submit}
          disabled={loading || pin.length !== 6}
          className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Unlocking...' : 'Unlock StockPilot'}
        </button>

        <p className="text-center text-xs text-muted-foreground pt-2">ObandeTechHub · 07036001818</p>
      </div>
    </div>
  );
}
