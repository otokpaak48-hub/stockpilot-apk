'use client';

/**
 * StockPilot — Root Layout
 * ------------------------------------------------------------------
 * Wires up: ErrorBoundary → ThemeProvider → AuthProvider → ToastProvider → App
 * On startup:
 *   - Initializes audit chains (Layer 5 tamper check)
 *   - Validates all hash chains
 *   - Initializes network listener
 *   - Hides splash screen after 1.5s
 *   - Checks for low-stock products and sends notification
 *   - Checks for overdue credit sales and sends notification
 */

import { ReactNode, useEffect } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/hooks/use-auth';
import { ToastProvider } from '@/hooks/use-toast';
import { initAuditChains, validateAllChains, writeAudit } from '@/lib/audit-log';
import { initNetwork, hideSplash, setStatusBarDark, requestNotificationPermission, notifyLowStock, notifyCreditDue } from '@/native';
import { db } from '@/lib/db-client';

import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    (async () => {
      try {
        // 1. Initialize audit chains
        await initAuditChains();

        // 2. Validate hash chains (tamper detection)
        const results = await validateAllChains();
        const broken = results.filter((r) => !r.ok);
        if (broken.length > 0) {
          await writeAudit('tamper', `Tamper detected on startup in: ${broken.map((b) => b.table).join(', ')}`);
        }

        // 3. Request notification permission (for low-stock + credit alerts)
        await requestNotificationPermission();

        // 4. Check for low-stock products
        const products = await db.products.toArray();
        const lowStock = products.filter((p) => p.quantity <= p.lowStockThreshold && p.quantity > 0);
        const outOfStock = products.filter((p) => p.quantity <= 0);
        if (lowStock.length > 0 || outOfStock.length > 0) {
          const total = lowStock.length + outOfStock.length;
          await notifyLowStock(`${total} product(s) need attention`, total);
        }

        // 5. Check for overdue credit sales
        const creditSales = await db.creditSales.toArray();
        const overdue = creditSales.filter((s) => s.status !== 'paid' && s.dueDate < Date.now());
        if (overdue.length > 0) {
          const totalOwed = overdue.reduce((sum, s) => sum + (s.amount - s.paidAmount), 0);
          await notifyCreditDue(`${overdue.length} overdue debt(s)`, totalOwed, Date.now());
        }
      } catch (e) {
        console.error('[Layout] Startup error:', e);
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
