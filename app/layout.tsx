'use client';

/**
 * StockPilot — Root Layout
 * ------------------------------------------------------------------
 * Wires up: ErrorBoundary → ThemeProvider → AuthProvider → ToastProvider → App
 * Registers network listener + initializes audit chains on mount.
 */

import { ReactNode, useEffect } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/hooks/use-auth';
import { ToastProvider } from '@/hooks/use-toast';
import { initAuditChains, validateAllChains } from '@/lib/audit-log';
import { initNetwork, hideSplash, setStatusBarDark } from '@/native';
import { writeAudit } from '@/lib/audit-log';

import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // App startup — Layer 5 tamper check
    (async () => {
      await initAuditChains();
      const results = await validateAllChains();
      const broken = results.filter((r) => !r.ok);
      if (broken.length > 0) {
        await writeAudit('tamper', `Tamper detected on startup in: ${broken.map((b) => b.table).join(', ')}`);
      }
    })();

    // Native setup
    initNetwork();
    setStatusBarDark();
    setTimeout(() => hideSplash(), 1500);
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
