'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { formatCurrency } from '@/lib/format';
import { getTrialProgressPct, getTrialRemainingMs } from '@/lib/license';
import {
  Package, DollarSign, AlertTriangle, Clock,
  ShoppingCart, Plus, ArrowUpDown, ClipboardList, FileText, Settings,
  TrendingUp, ArrowRight, BarChart3, Users, Activity,
} from 'lucide-react';
import { ViewKey } from '@/components/sidebar';

export function HomeView({ goTo }: { goTo: (v: string) => void }) {
  const products = useLiveQuery(() => db.products.count(), []);
  const todaySales = useLiveQuery(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const items = await db.sales.where('createdAt').above(start.getTime()).toArray();
    return { count: items.length, total: items.reduce((sum, s) => sum + s.total, 0) };
  }, []);
  const lowStock = useLiveQuery(async () => {
    const all = await db.products.toArray();
    return all.filter((p) => p.quantity <= p.lowStockThreshold).length;
  }, []);
  const totalStockValue = useLiveQuery(async () => {
    const all = await db.products.toArray();
    return all.reduce((s, p) => s + (p.cost ?? 0) * p.quantity, 0);
  }, []);
  const creditorsOutstanding = useLiveQuery(async () => {
    const all = await db.creditSales.toArray();
    return all
      .filter((s) => s.status === 'active' || s.status === 'overdue')
      .reduce((sum, s) => sum + (s.amount - s.paidAmount), 0);
  }, []);
  const recentSalesCount = useLiveQuery(async () => {
    const weekAgo = Date.now() - 7 * 86400000;
    return await db.sales.where('createdAt').above(weekAgo).count();
  }, []);

  const pct = getTrialProgressPct();
  const trialDays = Math.floor(getTrialRemainingMs() / (24 * 60 * 60 * 1000));

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <div className="card-premium p-6 bg-gradient-to-br from-primary/10 via-card to-info/5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Welcome back 👋</h1>
            <p className="text-sm text-muted-foreground mt-1">Here's what's happening in your business today.</p>
            <div className="flex gap-4 mt-3 text-sm">
              <div>
                <span className="text-muted-foreground">This week: </span>
                <span className="font-bold">{recentSalesCount ?? 0} sales</span>
              </div>
              <div>
                <span className="text-muted-foreground">Outstanding: </span>
                <span className="font-bold text-danger">{formatCurrency(creditorsOutstanding ?? 0)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => goTo('sell')}
            className="btn-primary flex items-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            New Sale
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Package} label="Products" value={String(products ?? 0)} color="primary" onClick={() => goTo('products')} />
        <KpiCard icon={DollarSign} label="Today's Sales" value={formatCurrency(todaySales?.total ?? 0)} color="success" onClick={() => goTo('dashboard')} />
        <KpiCard icon={BarChart3} label="Stock Value" value={formatCurrency(totalStockValue ?? 0)} color="info" onClick={() => goTo('dashboard')} />
        <KpiCard icon={AlertTriangle} label="Low Stock" value={String(lowStock ?? 0)} color={lowStock && lowStock > 0 ? 'warning' : 'muted'} onClick={() => goTo('products')} />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-semibold text-base mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction icon={ShoppingCart} label="Quick Sale" desc="Make a sale" color="primary" onClick={() => goTo('sell')} />
          <QuickAction icon={Plus} label="Add Product" desc="New inventory" color="info" onClick={() => goTo('products')} />
          <QuickAction icon={ArrowUpDown} label="Stock In" desc="Record movement" color="success" onClick={() => goTo('movements')} />
          <QuickAction icon={ClipboardList} label="Purchase Order" desc="Reorder stock" color="warning" onClick={() => goTo('purchase_orders')} />
          <QuickAction icon={FileText} label="Reports" desc="View analytics" color="primary" onClick={() => goTo('reports')} />
          <QuickAction icon={TrendingUp} label="Dashboard" desc="Business overview" color="info" onClick={() => goTo('dashboard')} />
          <QuickAction icon={Users} label="Users" desc="Manage staff" color="success" onClick={() => goTo('users')} />
          <QuickAction icon={Settings} label="Settings" desc="Configure app" color="warning" onClick={() => goTo('settings')} />
        </div>
      </div>

      {/* Trial progress */}
      <div className="card-premium p-5 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-base">Trial progress</h2>
            <p className="text-xs text-muted-foreground">Full access — all features unlocked</p>
          </div>
          <span className="text-2xl font-bold text-primary">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{trialDays} days remaining</span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" /> All systems operational
          </span>
        </div>
      </div>

      {/* Insights preview */}
      <div className="card-premium p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-base">Business insights</h2>
          </div>
          <button onClick={() => goTo('dashboard')} className="text-xs text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all">
            View dashboard <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Open the Dashboard to see weekly sales charts, 30-day trend, stock-by-category breakdown, best sellers, slow movers, and expiring products.
        </p>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, color, onClick,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'muted';
  onClick?: () => void;
}) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    info:    'text-info bg-info/10',
    muted:   'text-muted-foreground bg-muted',
  };
  return (
    <button onClick={onClick} className="kpi-card text-left">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl lg:text-2xl font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </button>
  );
}

function QuickAction({
  icon: Icon, label, desc, color, onClick,
}: {
  icon: typeof Package;
  label: string;
  desc: string;
  color: 'primary' | 'success' | 'warning' | 'info';
  onClick: () => void;
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    info:    'bg-info/10 text-info',
  };
  return (
    <button onClick={onClick} className="card-premium p-4 text-left group">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm">{label}</div>
          <div className="text-xs text-muted-foreground truncate">{desc}</div>
        </div>
      </div>
    </button>
  );
}
