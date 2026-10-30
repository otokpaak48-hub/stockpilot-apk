'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Store, User as UserIcon, Lock, Loader2, Shield } from 'lucide-react';

export function LoginScreen() {
  const { login, verify2fa } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.ok) return;
    if (result.needs2fa) { setNeeds2fa(true); return; }
    setError(result.error ?? 'Login failed');
  };

  const submit2fa = async () => {
    setError(null);
    setLoading(true);
    const result = await verify2fa(otp);
    setLoading(false);
    if (!result.ok) setError(result.error ?? 'Invalid OTP');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-hero">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-primary items-center justify-center shadow-lg mb-3">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-xs text-muted-foreground">Sign in to StockPilot</p>
        </div>

        <div className="card-premium p-6 space-y-4">
          {!needs2fa ? (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="input-premium pl-10"
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-premium pl-10"
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                  />
                </div>
              </div>

              <button
                onClick={submit}
                disabled={loading || !username || !password}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign in'}
              </button>

              {/* Default creds hint */}
              <div className="bg-info/10 border border-info/20 rounded-lg p-3 text-xs">
                <div className="font-semibold text-info mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Default credentials
                </div>
                <div className="text-muted-foreground">
                  Username: <span className="font-mono font-semibold">admin</span><br />
                  Password: <span className="font-mono font-semibold">admin1234</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Enter the 6-digit code sent to your phone.
              </p>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="input-premium text-center font-mono text-2xl tracking-widest"
                inputMode="numeric"
                onKeyDown={(e) => e.key === 'Enter' && submit2fa()}
              />
              <button
                onClick={submit2fa}
                disabled={loading || otp.length !== 6}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : 'Verify OTP'}
              </button>
            </>
          )}

          {error && (
            <div className="bg-danger/10 border border-danger/20 text-danger px-3 py-2 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/70 mt-4">
          ObandeTechHub · 07036001818 · © 2026
        </p>
      </div>
    </div>
  );
}
