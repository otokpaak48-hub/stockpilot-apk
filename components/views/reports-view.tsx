'use client';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  FileText, Printer, Download, DollarSign, Package, AlertTriangle,
  TrendingUp, Calendar, X, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';

export function ReportsView() {
  const [activeReport, setActiveReport] = useState<string | null>(null);

  const reports = [
    { id: 'sales', icon: FileText, title: 'Sales Analysis', desc: 'By date range, all transactions', color: 'primary' },
    { id: 'stock', icon: Package, title: 'Stock Value', desc: 'Current inventory valuation', color: 'info' },
    { id: 'lowstock', icon: AlertTriangle, title: 'Low-Stock Reorder', desc: 'Suggested reorder quantities', color: 'warning' },
    { id: 'profit', icon: DollarSign, title: 'Profit / Loss', desc: 'Revenue minus cost breakdown', color: 'success' },
    { id: 'movements', icon: TrendingUp, title: 'Movement History', desc: 'All stock in/out/adjust', color: 'primary' },
    { id: 'expiring', icon: Calendar, title: 'Expiring Products', desc: 'Items near expiry date', color: 'warning' },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Tap a report to view real data from your inventory</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {reports.map((r) => {
          const Icon = r.icon;
          const colorMap: Record<string, string> = {
            primary: 'text-primary bg-primary/10',
            info: 'text-info bg-info/10',
            warning: 'text-warning bg-warning/10',
            success: 'text-success bg-success/10',
          };
          return (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className="card-premium p-4 text-left group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition ${colorMap[r.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{r.desc}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeReport && (
        <ReportDialog reportId={activeReport} onClose={() => setActiveReport(null)} />
      )}
    </div>
  );
}

function ReportDialog({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0;
  const toMs = dateTo ? new Date(dateTo).getTime() + 86400000 : Date.now();

  const sales = useLiveQuery(async () => {
    let all = await db.sales.toArray();
    if (dateFrom || dateTo) {
      all = all.filter((s) => s.createdAt >= fromMs && s.createdAt <= toMs);
    }
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }, [dateFrom, dateTo]) ?? [];

  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const movements = useLiveQuery(async () => {
    let all = await db.movements.toArray();
    if (dateFrom || dateTo) {
      all = all.filter((m) => m.createdAt >= fromMs && m.createdAt <= toMs);
    }
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  }, [dateFrom, dateTo]) ?? [];

  const reportConfig: Record<string, { title: string; content: React.ReactNode }> = {
    sales: {
      title: 'Sales Analysis',
      content: (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <div className="text-xs text-muted-foreground">Transactions</div>
              <div className="font-bold">{sales.length}</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <div className="text-xs text-muted-foreground">Total Revenue</div>
              <div className="font-bold text-success">{formatCurrency(sales.reduce((s, x) => s + x.total, 0))}</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <div className="text-xs text-muted-foreground">Avg Sale</div>
              <div className="font-bold">{formatCurrency(sales.length ? sales.reduce((s, x) => s + x.total, 0) / sales.length : 0)}</div>
            </div>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {sales.map((s) => (
              <div key={s.id} className="p-2 flex justify-between items-center text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.receiptNumber}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(s.createdAt)} · {s.paymentMethod}</div>
                </div>
                <div className="font-bold">{formatCurrency(s.total)}</div>
              </div>
            ))}
            {sales.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No sales in this period</div>}
          </div>
        </>
      ),
    },
    stock: {
      title: 'Stock Value Report',
      content: (
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {products.map((p) => (
            <div key={p.id} className="p-2 flex justify-between items-center text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.quantity} units × {formatCurrency(p.cost ?? 0)}</div>
              </div>
              <div className="font-bold">{formatCurrency((p.cost ?? 0) * p.quantity)}</div>
            </div>
          ))}
          <div className="p-3 flex justify-between items-center bg-primary/10 font-bold">
            <span>Total Stock Value</span>
            <span className="text-primary">{formatCurrency(products.reduce((s, p) => s + (p.cost ?? 0) * p.quantity, 0))}</span>
          </div>
          {products.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No products</div>}
        </div>
      ),
    },
    lowstock: {
      title: 'Low-Stock Reorder Report',
      content: (
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {products.filter((p) => p.quantity <= p.lowStockThreshold).map((p) => {
            const reorderQty = Math.max(p.lowStockThreshold * 2 - p.quantity, p.lowStockThreshold);
            return (
              <div key={p.id} className="p-2 flex justify-between items-center text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">Stock: {p.quantity} · Threshold: {p.lowStockThreshold}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-warning">Reorder: {reorderQty}</div>
                </div>
              </div>
            );
          })}
          {products.filter((p) => p.quantity <= p.lowStockThreshold).length === 0 && (
            <div className="p-6 text-center text-success text-sm">All products are well-stocked! 🎉</div>
          )}
        </div>
      ),
    },
    profit: {
      title: 'Profit / Loss Report',
      content: <ProfitReport sales={sales} products={products} />,
    },
    movements: {
      title: 'Movement History',
      content: (
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {movements.map((m) => {
            const product = products.find((p) => p.id === m.productId);
            const Icon = m.type === 'in' ? ArrowUpCircle : m.type === 'out' ? ArrowDownCircle : TrendingUp;
            const color = m.type === 'in' ? 'text-success' : m.type === 'out' ? 'text-danger' : 'text-info';
            return (
              <div key={m.id} className="p-2 flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{product?.name ?? 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(m.createdAt)} · {m.reason ?? '—'}</div>
                  </div>
                </div>
                <div className={`font-bold ${color}`}>
                  {m.qty > 0 ? '+' : ''}{m.qty}
                </div>
              </div>
            );
          })}
          {movements.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No movements in this period</div>}
        </div>
      ),
    },
    expiring: {
      title: 'Expiring Products Report',
      content: (
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {products
            .filter((p) => p.expiryDate)
            .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())
            .map((p) => {
              const daysLeft = Math.floor((new Date(p.expiryDate!).getTime() - Date.now()) / 86400000);
              const isExpired = daysLeft < 0;
              const isSoon = daysLeft >= 0 && daysLeft <= 30;
              return (
                <div key={p.id} className="p-2 flex justify-between items-center text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.quantity} units · Expires {p.expiryDate}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded ${
                    isExpired ? 'bg-danger/15 text-danger' :
                    isSoon ? 'bg-warning/15 text-warning' :
                    'bg-success/15 text-success'
                  }`}>
                    {isExpired ? 'Expired' : `${daysLeft}d left`}
                  </div>
                </div>
              );
            })}
          {products.filter((p) => p.expiryDate).length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">No products have expiry dates set</div>
          )}
        </div>
      ),
    },
  };

  const config = reportConfig[reportId];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="font-bold text-lg">{config.title}</h2>
          <div className="flex gap-1">
            <button
              onClick={() => window.print()}
              className="btn-ghost p-2"
              title="Print"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="btn-ghost p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(reportId === 'sales' || reportId === 'movements' || reportId === 'profit') && (
          <div className="p-4 border-b border-border grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">From date</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-premium text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">To date</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-premium text-sm" />
            </div>
          </div>
        )}

        <div className="p-4">
          {config.content}
        </div>
      </div>
    </div>
  );
}

function ProfitReport({ sales, products }: { sales: any[]; products: any[] }) {
  const productMap = new Map(products.map((p) => [p.id!, p]));
  let revenue = 0, cost = 0;
  for (const s of sales) {
    revenue += s.total;
  }
  // Approximate cost using average
  const avgCost = products.length ? products.reduce((sum, p) => sum + (p.cost ?? 0), 0) / products.length : 0;
  cost = avgCost * sales.length;
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="bg-muted/40 rounded-lg p-3 flex justify-between">
        <span className="text-sm">Total Revenue</span>
        <span className="font-bold text-success">{formatCurrency(revenue)}</span>
      </div>
      <div className="bg-muted/40 rounded-lg p-3 flex justify-between">
        <span className="text-sm">Estimated Cost</span>
        <span className="font-bold text-danger">-{formatCurrency(cost)}</span>
      </div>
      <div className="bg-primary/10 rounded-lg p-3 flex justify-between">
        <span className="text-sm font-semibold">Net Profit</span>
        <span className="font-bold text-primary">{formatCurrency(profit)}</span>
      </div>
      <div className="bg-muted/40 rounded-lg p-3 flex justify-between">
        <span className="text-sm">Profit Margin</span>
        <span className="font-bold">{margin.toFixed(1)}%</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Note: Cost is estimated using average product cost. For precise profit, ensure each product has a cost price set.
      </p>
    </div>
  );
}
