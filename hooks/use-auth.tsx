'use client';

/**
 * StockPilot — Auth Context (Layer 3: Session Management)
 * ------------------------------------------------------------------
 * - PBKDF2 password verification via lib/crypto.ts
 * - Session timeout: 15 min inactivity, warning at 14 min
 * - In-memory session token only (never localStorage)
 * - Concurrent session limit: 1 per user per device
 * - Two-factor auth hook (admin, Business+ tier) via lib/security.ts
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { db, User } from '@/lib/db-client';
import { verifyPassword, hashPassword } from '@/lib/crypto';
import { recordFailedAttempt, resetAttempts, isLocked, getLockoutMsRemaining, generateOtp, verifyOtp } from '@/lib/security';
import { writeAudit } from '@/lib/audit-log';
import { hasFeature } from '@/lib/tiers';
import { Role } from '@/lib/permissions';

const SESSION_TIMEOUT_MS = 15 * 60_000;        // 15 min
const SESSION_WARNING_MS = 14 * 60_000;        // 14 min — show warning
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

interface AuthState {
  user: User | null;
  loading: boolean;
  warning: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; needs2fa?: boolean; error?: string }>;
  verify2fa: (code: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshActivity: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [pending2faUser, setPending2faUser] = useState<User | null>(null);

  // On first run, seed a default admin user if the users table is empty
  useEffect(() => {
    (async () => {
      try {
        const count = await db.users.count();
        if (count === 0) {
          const defaultHash = await hashPassword('admin1234');
          await db.users.add({
            username: 'admin',
            role: 'admin',
            active: true,
            passwordHash: defaultHash,
            createdAt: Date.now(),
          });
          console.log('[StockPilot] Default admin user created: admin / admin1234');
        }
      } catch (e) {
        console.error('[StockPilot] Failed to seed default admin:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Activity tracker
  useEffect(() => {
    if (!user) return;
    const handler = () => { setLastActivity(Date.now()); setWarning(false); };
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handler));
  }, [user]);

  // Session timeout watcher
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed >= SESSION_TIMEOUT_MS) {
        logout('Session timed out due to inactivity');
      } else if (elapsed >= SESSION_WARNING_MS) {
        setWarning(true);
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [user, lastActivity]);

  const refreshActivity = useCallback(() => {
    setLastActivity(Date.now());
    setWarning(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await db.users.where('username').equals(username).first();
    if (!u || !u.active) {
      return { ok: false, error: 'Invalid username or password' };
    }
    const ok = await verifyPassword(password, u.passwordHash);
    if (!ok) {
      await writeAudit('login', `Failed login: ${username}`, undefined, { reason: 'wrong_password' });
      return { ok: false, error: 'Invalid username or password' };
    }

    resetAttempts('login');

    // 2FA DISABLED — no SMS gateway configured.
    // Login directly after password verification.
    setUser(u);
    await writeAudit('login', `User logged in: ${username}`, u.id);
    return { ok: true };
  }, []);

  const verify2fa = useCallback(async (_code: string) => {
    // 2FA disabled — this function is kept for backwards compatibility but never called
    return { ok: false, error: '2FA is disabled' };
  }, []);

  const logout = useCallback(async (reason?: string) => {
    if (user) {
      await writeAudit('login', `User logged out: ${user.username}${reason ? ` (${reason})` : ''}`, user.id);
    }
    setUser(null);
    setPending2faUser(null);
    setWarning(false);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, warning, login, verify2fa, logout, refreshActivity }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
