'use client';

/**
 * StockPilot — Main App Shell (Premium UI + Swipe Navigation + Online)
 * ------------------------------------------------------------------
 * - Mobile-first responsive layout
 * - Swipe RIGHT to go back to previous view (replaces back button)
 * - Swipe LEFT to open menu (alternative to hamburger)
 * - Hamburger moved down a bit for thumb reach
 * - Bigger icons and text throughout
 * - Online status indicator (sync, network)
 */

import { useState, useEffect, useRef } from 'react';
import { Menu, Sun, Moon, Monitor, Bell, User as UserIcon, Wifi, WifiOff, Cloud } from 'lucide-react';
import { getGateState, GateState } from '@/lib/license';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/components/theme-provider';
import { usePwa } from '@/hooks/use-pwa';
import { LicenseScreen } from '@/components/license-screen';
import { LoginScreen } from '@/components/login-screen';
import { TrialGate } from '@/components/trial-gate';
import { Sidebar, ViewKey } from '@/components/sidebar';

import { HomeView } from '@/components/views/home-view';
import { SellView } from '@/components/views/sell-view';
import { ProductsView } from '@/components/views/products-view';
import { CategoriesView } from '@/components/views/categories-view';
import { MovementsView } from '@/components/views/movements-view';
import { PurchaseOrdersView } from '@/components/views/purchase-orders-view';
import { SuppliersView } from '@/components/views/suppliers-view';
import { DashboardView } from '@/components/views/dashboard-view';
import { ReportsView } from '@/components/views/reports-view';
import { ProfitAnalyticsView } from '@/components/views/profit-analytics-view';
import { CreditorsView } from '@/components/views/creditors-view';
import { UsersView } from '@/components/views/users-view';
import { ActivityLogView } from '@/components/views/activity-log-view';
import { BackupsView } from '@/components/views/backups-view';
import { SettingsView } from '@/components/views/settings-view';

export default function Page() {
  const { user, loading } = useAuth();
  const { theme, setTheme } = useTheme();
  const { online } = usePwa();
  const [gate, setGate] = useState<GateState>('license');
  const [view, setView] = useState<ViewKey>('home');
  const [viewHistory, setViewHistory] = useState<ViewKey[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Touch tracking for swipe gestures
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { setGate(getGateState()); }, [user]);

  const navigateTo = (v: ViewKey) => {
    setViewHistory((prev) => [...prev, view]);
    setView(v);
  };

  const goBack = () => {
    setViewHistory((prev) => {
      if (prev.length === 0) {
        setView('home');
        return prev;
      }
      const last = prev[prev.length - 1];
      setView(last);
      return prev.slice(0, -1);
    });
  };

  // Swipe gesture handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchEnd.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const dx = touchEnd.current.x - touchStart.current.x;
    const dy = touchEnd.current.y - touchStart.current.y;
    // Only horizontal swipes (dx > 2× dy)
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) / 2) return;

    if (dx > 0) {
      // Swipe RIGHT → go back
      if (viewHistory.length > 0) {
        goBack();
      } else if (!mobileNavOpen) {
        setMobileNavOpen(true);
      }
    } else {
      // Swipe LEFT → close menu (if open) or no-op
      if (mobileNavOpen) setMobileNavOpen(false);
    }
    touchStart.current = null;
    touchEnd.current = null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-white font-bold text-3xl">S</span>
          </div>
          <p className="mt-4 text-base text-muted-foreground">Loading StockPilot...</p>
        </div>
      </div>
    );
  }

  if (gate === 'license') return <LicenseScreen onActivated={() => setGate('trial')} />;
  if (gate === 'trial-gate') return <TrialGate onUnlocked={() => setGate('unlocked')} />;
  if (!user) return <LoginScreen />;

  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

  return (
    <div
      className="flex min-h-screen bg-gradient-hero"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Sidebar
        active={view}
        onSelect={navigateTo}
        isMobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Premium header — hamburger moved down for thumb reach */}
        <header className="glass sticky top-0 z-30 border-b border-border">
          <div className="px-4 lg:px-6 pt-3 pb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {/* Hamburger (mobile only) — moved down via pt-3 above */}
              <button
                onClick={() => setMobileNavOpen(true)}
                className="lg:hidden btn-ghost p-3 -ml-2"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Breadcrumb — bigger text */}
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                  StockPilot
                </div>
                <div className="text-lg font-bold capitalize truncate">
                  {view.replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Online status indicator */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold ${
                  online
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground'
                }`}
                title={online ? 'Online — cloud sync active' : 'Offline — changes saved locally'}
              >
                {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
              </div>

              {/* Cloud sync indicator */}
              <div
                className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs bg-primary/10 text-primary"
                title="Cloud sync enabled"
              >
                <Cloud className="w-3.5 h-3.5" />
              </div>

              {/* Theme toggle — bigger */}
              <button
                onClick={() => setTheme(nextTheme)}
                className="btn-ghost p-2.5"
                title={`Theme: ${theme}`}
              >
                {theme === 'light' && <Sun className="w-5 h-5" />}
                {theme === 'dark' && <Moon className="w-5 h-5" />}
                {theme === 'system' && <Monitor className="w-5 h-5" />}
              </button>

              {/* Notifications — bigger */}
              <button className="btn-ghost p-2.5 relative" title="Notifications">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-danger rounded-full" />
              </button>

              {/* User chip — bigger */}
              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-full pl-1 pr-3 py-1">
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold hidden sm:inline">{user.username}</span>
              </div>
            </div>
          </div>

          {/* Swipe hint (mobile only) */}
          <div className="lg:hidden px-4 pb-1 text-[10px] text-muted-foreground/60 text-center">
            ← Swipe right to go back · Swipe right from edge to open menu →
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div key={view} className="fade-in max-w-7xl mx-auto">
            {renderView(view, navigateTo)}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50 px-4 lg:px-6 py-2 text-[11px] text-center text-muted-foreground/70">
          StockPilot v1.0.7 · Full Access · ObandeTechHub · 07036001818 · © 2026
        </footer>
      </div>
    </div>
  );
}

function renderView(view: ViewKey, goTo: (v: ViewKey) => void) {
  switch (view) {
    case 'home':            return <HomeView goTo={(v) => goTo(v as ViewKey)} />;
    case 'sell':            return <SellView />;
    case 'products':        return <ProductsView />;
    case 'categories':      return <CategoriesView />;
    case 'movements':       return <MovementsView />;
    case 'purchase_orders': return <PurchaseOrdersView />;
    case 'suppliers':       return <SuppliersView />;
    case 'dashboard':       return <DashboardView />;
    case 'reports':         return <ReportsView />;
    case 'profit_analytics':return <ProfitAnalyticsView />;
    case 'creditors':       return <CreditorsView />;
    case 'users':           return <UsersView />;
    case 'activity_log':    return <ActivityLogView />;
    case 'backups':         return <BackupsView />;
    case 'settings':        return <SettingsView />;
    default:                return <HomeView goTo={(v) => goTo(v as ViewKey)} />;
  }
}
