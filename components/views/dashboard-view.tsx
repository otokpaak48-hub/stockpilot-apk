'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  Package, DollarSign, AlertTriangle, TrendingUp, Zap, BarChart3,
  Award, Clock, Calendar, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';

export function DashboardView() {
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? [];
  const saleItems = useLiveQuery(() => db.saleItems.toArray(), []) ?? [];
  const movements = useLiveQuery(() => db.movements.toArray(), []) ?? [];

  // KPIs
  const totalStockValue = products.reduce((s, p) => s + (p.cost ?? 0) * p.quantity, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const todaySales = sales.filter((s) => s.createdAt >= todayMs);
  const todayRevenue = todaySales.reduce((s, x) => s + x.total, 0);
  const lowStockProducts = products.filter((p) => p.quantity <= p.lowStockThreshold);

  // Weekly sales (last 7 days)
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const dayStart = todayMs - (6 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    const daySales = sales.filter((s) => s.createdAt >= dayStart && s.createdAt < dayEnd);
    return {
      label: new Date(dayStart).toLocaleDateString('en', { weekday: 'short' }),
      value: daySales.reduce((sum, s) => sum + s.total, 0),
      count: daySales.length,
    };
  });
  const maxWeekly = Math.max(...weeklyData.map((d) => d.value), 1);

  // 30-day trend
  const monthlyData = Array.from({ length: 30 }, (_, i) => {
    const dayStart = todayMs - (29 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    return sales.filter((s) => s.createdAt >= dayStart && s.createdAt < dayEnd).reduce((sum, s) => sum + s.total, 0);
  });

  // Stock by category
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const categoryMap = new Map(categories.map((c) => [c.id!, c]));
  const stockByCategory: Record<string, { value: number; count: number; color: string }> = {};
  for (const p of products) {
    const catName = p.categoryId ? (categoryMap.get(p.categoryId)?.name ?? 'Uncategorized') : 'Uncategorized';
    const cat = categoryMap.get(p.categoryId);
    if (!stockByCategory[catName]) {
      stockByCategory[catName] = { value: 0, count: 0, color: cat?.color ?? '#059669' };
    }
    stockByCategory[catName].value += (p.cost ?? 0) * p.quantity;
    stockByCategory[catName].count++;
  }
  const totalCatValue = Object.values(stockByCategory).reduce((s, x) => s + x.value, 0) || 1;

  // Best sellers (top 5 by qty sold)
  const productQtyMap: Record<number, { qty: number; revenue: number; name: string }> = {};
  for (const item of saleItems) {
    const product = products.find((p) => p.id === item.productId);
    if (!productQtyMap[item.productId]) {
      productQtyMap[item.productId] = { qty: 0, revenue: 0, name: product?.name ?? 'Unknown' };
    }
    productQtyMap[item.productId].qty += item.qty;
    productQtyMap[item.productId].revenue += item.lineTotal;
  }
  const bestSellers = Object.entries(productQtyMap)
    .map(([id, data]) => ({ id: +id, ...data }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Slow movers (products with stock but no sales in 30 days)
  const thirtyDaysAgo = todayMs - 30 * 86400000;
  const soldProductIds = new Set(saleItems.filter((i) => {
    const sale = sales.find((s) => s.id === i.saleId);
    return sale && sale.createdAt >= thirtyDaysAgo;
  }).map((i) => i.productId));
  const slowMovers = products.filter((p) => p.quantity > 0 && !soldProductIds.has(p.id!)).slice(0, 5);

  // Expiring soon (within 30 days)
  const expiringSoon = products
    .filter((p) => p.expiryDate)
    .map((p) => ({ ...p, daysLeft: Math.floor((new Date(p.expiryDate!).getTime() - todayMs) / 86400000) }))
    .filter((p) => p.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  // Recent activity (last 10 movements)
  const recentMovements = movements.slice(-10).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Business overview at a glance</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Stock Value" value={formatCurrency(totalStockValue)} color="primary" />
        <StatCard icon={DollarSign} label="Today's Sales" value={formatCurrency(todayRevenue)} color="success" />
        <StatCard icon={TrendingUp} label="Transactions" value={String(todaySales.length)} color="info" />
        <StatCard icon={AlertTriangle} label="Low Stock Items" value={String(lowStockProducts.length)} color="warning" />
      </div>

      {/* Weekly sales chart */}
      <div className="card-premium p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-base">Weekly sales</h2>
        </div>
        <div className="flex items-end justify-between gap-2 h-40">
          {weeklyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] text-muted-foreground font-semibold">{d.count > 0 ? d.count : ''}</div>
              <div className="w-full bg-muted rounded-t-lg overflow-hidden flex items-end" style={{ height: '100px' }}>
                <div
                  className="w-full bg-gradient-to-t from-primary to-primary/70 transition-all duration-500 rounded-t-lg"
                  style={{ height: `${(d.value / maxWeekly) * 100}%`, minHeight: d.value > 0 ? '4px' : '0' }}
                  title={formatCurrency(d.value)}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{d.label}</div>
              <div className="text-[10px] font-semibold">{d.value > 0 ? formatCurrency(d.value).replace('.00', '') : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 30-day trend line */}
      <div className="card-premium p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-base">30-day sales trend</h2>
        </div>
        <div className="relative h-32">
          <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              points={monthlyData.map((v, i) => {
                const max = Math.max(...monthlyData, 1);
                return `${(i / (monthlyData.length - 1)) * 300},${100 - (v / max) * 90}`;
              }).join(' ')}
            />
            <polygon
              fill="hsl(var(--primary) / 0.1)"
              points={`0,100 ${monthlyData.map((v, i) => {
                const max = Math.max(...monthlyData, 1);
                return `${(i / (monthlyData.length - 1)) * 300},${100 - (v / max) * 90}`;
              }).join(' ')} 300,100`}
            />
          </svg>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>30 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Two columns: best sellers + slow movers */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Best sellers */}
        <div className="card-premium overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Award className="w-5 h-5 text-warning" />
            <h2 className="font-semibold text-base">Best sellers</h2>
          </div>
          <div className="divide-y divide-border">
            {bestSellers.map((p, i) => (
              <div key={p.id} className="p-3 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.qty} units sold</div>
                </div>
                <div className="font-bold text-sm text-success">{formatCurrency(p.revenue)}</div>
              </div>
            ))}
            {bestSellers.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">No sales yet</div>
            )}
          </div>
        </div>

        {/* Slow movers */}
        <div className="card-premium overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-base">Slow movers (30+ days)</h2>
          </div>
          <div className="divide-y divide-border">
            {slowMovers.map((p) => (
              <div key={p.id} className="p-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.quantity} in stock</div>
                </div>
                <div className="text-xs text-warning">{formatCurrency((p.cost ?? 0) * p.quantity)}</div>
              </div>
            ))}
            {slowMovers.length === 0 && (
              <div className="p-6 text-center text-success text-sm">All products selling well! 🎉</div>
            )}
          </div>
        </div>
      </div>

      {/* Expiring soon */}
      {expiringSoon.length > 0 && (
        <div className="card-premium overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Calendar className="w-5 h-5 text-warning" />
            <h2 className="font-semibold text-base">Expiring soon (30 days)</h2>
          </div>
          <div className="divide-y divide-border">
            {expiringSoon.map((p) => (
              <div key={p.id} className="p-3 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  p.daysLeft < 0 ? 'bg-danger/15 text-danger' : p.daysLeft <= 7 ? 'bg-warning/15 text-warning' : 'bg-info/15 text-info'
                }`}>
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.quantity} units · expires {p.expiryDate}</div>
                </div>
                <div className={`text-xs font-bold ${p.daysLeft < 0 ? 'text-danger' : p.daysLeft <= 7 ? 'text-warning' : 'text-info'}`}>
                  {p.daysLeft < 0 ? 'Expired' : `${p.daysLeft}d`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-base">Recent activity</h2>
        </div>
        <div className="divide-y divide-border">
          {recentMovements.map((m) => {
            const product = products.find((p) => p.id === m.productId);
            const Icon = m.type === 'in' ? ArrowUpCircle : m.type === 'out' ? ArrowDownCircle : TrendingUp;
            const color = m.type === 'in' ? 'text-success' : m.type === 'out' ? 'text-danger' : 'text-info';
            return (
              <div key={m.id} className="p-3 flex items-center gap-3">
                <Icon className={`w-4 h-4 ${color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{product?.name ?? 'Unknown'}</div>
                  <div className="text-xs text-muted-foreground">{m.reason ?? m.type}</div>
                </div>
                <div className={`text-sm font-bold ${color}`}>
                  {m.qty > 0 ? '+' : ''}{m.qty}
                </div>
              </div>
            );
          })}
          {recentMovements.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Package; label: string; value: string;
  color: 'primary' | 'success' | 'info' | 'warning';
}) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    info:    'text-info bg-info/10',
    warning: 'text-warning bg-warning/10',
  };
  return (
    <div className="kpi-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-xl font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
