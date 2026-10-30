'use client';

import { useState } from 'react';
import { activateLicense } from '@/lib/license';
import { validate, schemas, generateDeviceFingerprint } from '@/lib/security';
import { deriveMasterKey } from '@/lib/crypto';
import { setMasterKey } from '@/lib/db-client';
import { Store, Key, User as UserIcon, Loader2, CheckCircle2 } from 'lucide-react';

export function LicenseScreen({ onActivated }: { onActivated: () => void }) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    try { validate(schemas.licenseKey, key); }
    catch { setError('Invalid key format. Expected: SP-XXXX-XXXX-XXXX-XXXX'); return; }

    setLoading(true);
    const result = await activateLicense(key, name);
    if (!result.ok) {
      setError(result.error ?? 'Activation failed');
      setLoading(false);
      return;
    }

    const fp = await generateDeviceFingerprint();
    const mk = await deriveMasterKey(key, fp.hash);
    setMasterKey(mk);

    setLoading(false);
    onActivated();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-primary via-primary to-primary-700">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 text-white">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-white/15 backdrop-blur items-center justify-center shadow-xl mb-3">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">StockPilot</h1>
          <p className="text-sm opacity-80">Offline-first inventory for African SMBs</p>
        </div>

        <div className="card-premium p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Customer / Business name</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. He Cares Shop"
                className="input-premium pl-10"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">License key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="SP-XXXX-XXXX-XXXX-XXXX"
                className="input-premium pl-10 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Don't have a key? Contact ObandeTechHub on 07036001818.
            </p>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !key || !name}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating...</> : <><CheckCircle2 className="w-4 h-4" /> Activate license</>}
          </button>
        </div>

        <p className="text-center text-[10px] text-white/70 mt-4">
          ObandeTechHub · 07036001818 · © 2026
        </p>
      </div>
    </div>
  );
}
