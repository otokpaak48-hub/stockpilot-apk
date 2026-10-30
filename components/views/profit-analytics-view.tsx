'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { formatCurrency } from '@/lib/format';
import { TrendingUp, DollarSign, Percent, Package, AlertTriangle, Award, Clock } from 'lucide-react';

export function ProfitAnalyticsView() {
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? [];
  const saleItems = useLiveQuery(() => db.saleItems.toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  // Calculate REAL profit
  const productMap = new Map(products.map((p) => [p.id!, p]));

  let totalRevenue = 0;
  let totalCost = 0;
  const productRevenue: Record<number, { revenue: number; cost: number; qty: number; name: string }> = {};

  for (const sale of sales) {
    totalRevenue += sale.total;
    const items = saleItems.filter((i) => i.saleId === sale.id);
    for (const item of items) {
      const product = productMap.get(item.productId);
      const cost = product?.cost ?? 0;
      const itemCost = cost * item.qty;
      const itemRevenue = item.lineTotal;
      totalCost += itemCost;

      if (!productRevenue[item.productId]) {
        productRevenue[item.productId] = {
          revenue: 0, cost: 0, qty: 0, name: product?.name ?? 'Unknown',
        };
      }
      productRevenue[item.productId].revenue += itemRevenue;
      productRevenue[item.productId].cost += itemCost;
      productRevenue[item.productId].qty += item.qty;
    }
  }

  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;

  // Top 10 products by revenue
  const topProducts = Object.entries(productRevenue)
    .map(([id, data]) => ({ id: +id, ...data, profit: data.revenue - data.cost }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Dead stock: products with no sales in last 60 days
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const recentSaleProductIds = new Set(
    sales.filter((s) => s.createdAt >= sixtyDaysAgo)
      .flatMap((s) => saleItems.filter((i) => i.saleId === s.id).map((i) => i.productId))
  );
  const deadStock = products.filter((p) => !recentSaleProductIds.has(p.id!) && p.quantity > 0);
  const deadStockValue = deadStock.reduce((sum, p) => sum + (p.cost ?? 0) * p.quantity, 0);

  // Best-selling hours
  const hourCounts: Record<number, number> = {};
  for (const sale of sales) {
    const hour = new Date(sale.createdAt).getHours();
    hourCounts[hour] = (hourCounts[hour] ?? 0) + sale.total;
  }
  const topHours = Object.entries(hourCounts)
    .map(([hour, rev]) => ({ hour: +hour, revenue: rev }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Best-selling days
  const dayCounts: Record<string, number> = {};
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const sale of sales) {
    const day = dayNames[new Date(sale.createdAt).getDay()];
    dayCounts[day] = (dayCounts[day] ?? 0) + sale.total;
  }
  const topDays = Object.entries(dayCounts)
    .map(([day, rev]) => ({ day, revenue: rev }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profit Analytics</h1>
        <p className="text-sm text-muted-foreground">Real-time profit calculations from your sales data</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Total Revenue" value={formatCurrency(totalRevenue)} color="success" />
        <Stat icon={TrendingUp} label="Total Profit" value={formatCurrency(totalProfit)} color="primary" />
        <Stat icon={Percent} label="Avg Margin" value={`${margin.toFixed(1)}%`} color="info" />
        <Stat icon={DollarSign} label="Avg Sale" value={formatCurrency(avgSale)} color="primary" />
      </div>

      {/* Top 10 products by revenue */}
      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Top 10 products by revenue</h2>
        </div>
        <div className="divide-y divide-border">
          {topProducts.map((p, i) => {
            const profitMargin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
            return (
              <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-muted/30">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-warning/20 text-warning' :
                  i === 1 ? 'bg-muted text-muted-foreground' :
                  i === 2 ? 'bg-warning/10 text-warning' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.qty} units sold</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{formatCurrency(p.revenue)}</div>
                  <div className={`text-xs ${profitMargin >= 0 ? 'text-success' : 'text-danger'}`}>
                    {profitMargin >= 0 ? '+' : ''}{profitMargin.toFixed(0)}% margin
                  </div>
                </div>
              </div>
            );
          })}
          {topProducts.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No sales recorded yet. Make some sales to see analytics.
            </div>
          )}
        </div>
      </div>

      {/* Dead stock */}
      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h2 className="font-semibold text-sm">Dead stock report (60+ days no sales)</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            Tied-up value: <span className="font-bold text-warning">{formatCurrency(deadStockValue)}</span>
          </span>
        </div>
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {deadStock.map((p) => (
            <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-muted/30">
              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.quantity} units in stock</div>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold">{formatCurrency((p.cost ?? 0) * p.quantity)}</div>
                <div className="text-xs text-muted-foreground">tied up</div>
              </div>
            </div>
          ))}
          {deadStock.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No dead stock — all products have recent sales. 🎉
            </div>
          )}
        </div>
      </div>

      {/* Best-selling hours */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card-premium overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-info" />
            <h2 className="font-semibold text-sm">Best-selling hours</h2>
          </div>
          <div className="divide-y divide-border">
            {topHours.map((h, i) => (
              <div key={h.hour} className="p-3 flex items-center justify-between">
                <span className="text-sm">{h.hour}:00 - {h.hour + 1}:00</span>
                <span className="font-bold text-sm">{formatCurrency(h.revenue)}</span>
              </div>
            ))}
            {topHours.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">No sales data yet</div>
            )}
          </div>
        </div>

        <div className="card-premium overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Best-selling days</h2>
          </div>
          <div className="divide-y divide-border">
            {topDays.map((d) => (
              <div key={d.day} className="p-3 flex items-center justify-between">
                <span className="text-sm">{d.day}</span>
                <span className="font-bold text-sm">{formatCurrency(d.revenue)}</span>
              </div>
            ))}
            {topDays.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">No sales data yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: {
  icon: typeof DollarSign; label: string; value: string;
  color: 'primary' | 'success' | 'info';
}) {
  const colorMap = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    info:    'text-info bg-info/10',
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
