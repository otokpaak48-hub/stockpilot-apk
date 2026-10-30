'use client';

/**
 * StockPilot — Error Boundary (Layer "Self-healing" — Enhanced)
 * ------------------------------------------------------------------
 * Catches React render crashes anywhere in the tree.
 * Shows a recovery screen with options to:
 *   - Reload the app
 *   - Go to Home (reset view state)
 *   - Clear cache (if reload doesn't fix it)
 * Logs the error to the audit trail.
 */

import { Component, ReactNode } from 'react';
import { writeAudit } from '@/lib/audit-log';
import { RefreshCw, Home, Trash2, AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; message?: string; stack?: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message, stack: err.stack };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', err, info);
    void writeAudit('tamper', `App crash: ${err.message}`, undefined, {
      stack: err.stack,
      info: info.componentStack,
    });
  }

  reload = () => {
    window.location.reload();
  };

  goHome = () => {
    // Clear in-memory state by reloading to root
    window.location.href = '/';
  };

  clearCache = () => {
    if (confirm('This will clear all cached data and reload. Your sales/products are safe (stored in IndexedDB). Continue?')) {
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      }
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-6">
          <div className="max-w-md w-full text-center space-y-4 bg-card border rounded-2xl p-8 shadow-lg">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-warning/15 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.message ?? 'An unexpected error occurred. Your data is safe — it was saved locally before the crash.'}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={this.reload}
                className="btn-primary flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Reload app
              </button>
              <button
                onClick={this.goHome}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" /> Go to Home
              </button>
              <button
                onClick={this.clearCache}
                className="btn-ghost flex items-center justify-center gap-2 text-sm"
              >
                <Trash2 className="w-4 h-4" /> Clear cache (keep data)
              </button>
            </div>
            {this.state.stack && (
              <details className="text-left text-xs text-muted-foreground bg-muted/30 p-2 rounded mt-4">
                <summary className="cursor-pointer">Error details</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.stack}</pre>
              </details>
            )}
            <p className="text-xs text-muted-foreground pt-2">© ObandeTechHub · 07036001818</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
