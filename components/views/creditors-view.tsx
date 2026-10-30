'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Creditor, CreditSale, CreditPayment } from '@/lib/db-client';
import { withCreditPaymentHash } from '@/lib/audit-log';
import { enqueueSync } from '@/lib/sync-engine';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard, Plus, X, Phone, MapPin, Wallet, AlertTriangle,
  Check, Clock, DollarSign, ChevronRight, Loader2,
} from 'lucide-react';

export function CreditorsView() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [viewCreditor, setViewCreditor] = useState<Creditor | null>(null);

  const creditors = useLiveQuery(() => db.creditors.toArray(), []) ?? [];
  const creditSales = useLiveQuery(() => db.creditSales.toArray(), []) ?? [];

  // Compute per-creditor stats
  const creditorStats = new Map<number, { outstanding: number; overdue: number; activeCount: number }>();
  for (const cs of creditSales) {
    const stat = creditorStats.get(cs.creditorId) ?? { outstanding: 0, overdue: 0, activeCount: 0 };
    if (cs.status === 'active' || cs.status === 'overdue') {
      stat.outstanding += cs.amount - cs.paidAmount;
      stat.activeCount++;
      if (cs.status === 'overdue' || cs.dueDate < Date.now()) {
        stat.overdue += cs.amount - cs.paidAmount;
      }
    }
    creditorStats.set(cs.creditorId, stat);
  }

  const totalOutstanding = Array.from(creditorStats.values()).reduce((s, x) => s + x.outstanding, 0);
  const totalOverdue = Array.from(creditorStats.values()).reduce((s, x) => s + x.overdue, 0);
  const activeSales = creditSales.filter((s) => s.status === 'active' || s.status === 'overdue').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Credit & Debtors</h1>
          <p className="text-sm text-muted-foreground">Track customers who owe you money</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Creditor
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="kpi-card">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-danger/10 text-danger">
            <Wallet className="w-4 h-4" />
          </div>
          <div className="text-lg font-bold mt-2">{formatCurrency(totalOutstanding)}</div>
          <div className="text-xs text-muted-foreground">Outstanding</div>
        </div>
        <div className="kpi-card">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 text-warning">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-lg font-bold mt-2">{formatCurrency(totalOverdue)}</div>
          <div className="text-xs text-muted-foreground">Overdue</div>
        </div>
        <div className="kpi-card">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-info/10 text-info">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-lg font-bold mt-2">{activeSales}</div>
          <div className="text-xs text-muted-foreground">Active Debts</div>
        </div>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-border">
          {creditors.map((c) => {
            const stats = creditorStats.get(c.id!) ?? { outstanding: 0, overdue: 0, activeCount: 0 };
            const hasOverdue = stats.overdue > 0;
            return (
              <button
                key={c.id}
                onClick={() => setViewCreditor(c)}
                className="w-full p-4 hover:bg-muted/30 flex items-center gap-3 text-left"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  hasOverdue ? 'bg-warning/15 text-warning' : 'bg-info/10 text-info'
                }`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                    {c.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.address}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-bold ${hasOverdue ? 'text-warning' : 'text-danger'}`}>
                    {formatCurrency(stats.outstanding)}
                  </div>
                  <div className="text-xs text-muted-foreground">{stats.activeCount} debt(s)</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
          {creditors.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No creditors yet</p>
              <p className="text-xs mt-1">Credit sales auto-create creditors, or add one manually.</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddCreditorDialog onClose={() => setShowAdd(false)} toast={toast} />}
      {viewCreditor && (
        <CreditorDetailDialog
          creditor={viewCreditor}
          onClose={() => setViewCreditor(null)}
          toast={toast}
        />
      )}
    </div>
  );
}

function AddCreditorDialog({ onClose, toast }: { onClose: () => void; toast: any }) {
  const [c, setC] = useState({ name: '', phone: '', address: '' });
  const save = async () => {
    if (!c.name) return;
    await db.creditors.add({
      name: c.name,
      phone: c.phone || undefined,
      address: c.address || undefined,
    });
    toast({ type: 'success', title: 'Creditor added' });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-lg">Add creditor</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Name *</label>
            <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className="input-premium" placeholder="Customer name" />
          </div>
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Phone</label>
            <input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} className="input-premium" placeholder="08012345678" />
          </div>
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Address</label>
            <input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} className="input-premium" placeholder="Optional" />
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={!c.name} className="btn-primary flex-1">Add</button>
        </div>
      </div>
    </div>
  );
}

function CreditorDetailDialog({
  creditor,
  onClose,
  toast,
}: {
  creditor: Creditor;
  onClose: () => void;
  toast: any;
}) {
  const { user } = useAuth();
  const [showPayment, setShowPayment] = useState<CreditSale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const creditSales = useLiveQuery(
    () => db.creditSales.where('creditorId').equals(creditor.id!).toArray(),
    [creditor.id]
  ) ?? [];

  const payments = useLiveQuery(
    async () => {
      const result: Array<CreditPayment & { creditSaleId: number }> = [];
      for (const cs of creditSales) {
        const csPayments = await db.creditPayments.where('creditSaleId').equals(cs.id!).toArray();
        for (const p of csPayments) {
          result.push({ ...p, creditSaleId: cs.id! });
        }
      }
      return result.sort((a, b) => b.createdAt - a.createdAt);
    },
    [creditSales]
  ) ?? [];

  const recordPayment = async () => {
    if (!showPayment || !user) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast({ type: 'error', title: 'Invalid amount' });
      return;
    }
    const outstanding = showPayment.amount - showPayment.paidAmount;
    if (amount > outstanding) {
      toast({ type: 'error', title: 'Amount exceeds outstanding', description: `Outstanding: ${formatCurrency(outstanding)}` });
      return;
    }
    setSaving(true);
    try {
      const paymentBase: Omit<CreditPayment, 'id' | 'recordHash'> = {
        creditSaleId: showPayment.id!,
        amount,
        createdAt: Date.now(),
        userId: user.id!,
      };
      const payment = await withCreditPaymentHash(paymentBase);
      const paymentId = await db.creditPayments.add(payment);

      // Update credit sale
      const newPaidAmount = showPayment.paidAmount + amount;
      const newStatus = newPaidAmount >= showPayment.amount ? 'paid' : 'active';
      await db.creditSales.update(showPayment.id!, {
        paidAmount: newPaidAmount,
        status: newStatus,
      });

      await enqueueSync('creditPayments', paymentId as number, 'create', payment);
      toast({
        type: 'success',
        title: 'Payment recorded',
        description: `${formatCurrency(amount)} · ${newStatus === 'paid' ? 'Debt cleared!' : `${formatCurrency(showPayment.amount - newPaidAmount)} remaining`}`,
      });
      setShowPayment(null);
      setPaymentAmount('');
    } catch (e: unknown) {
      toast({ type: 'error', title: 'Payment failed', description: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const totalOutstanding = creditSales
    .filter((s) => s.status === 'active' || s.status === 'overdue')
    .reduce((sum, s) => sum + (s.amount - s.paidAmount), 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-info/10 text-info flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{creditor.name}</h2>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {creditor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{creditor.phone}</span>}
                  {creditor.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{creditor.address}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <div className="font-bold text-danger">{formatCurrency(totalOutstanding)}</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <div className="text-xs text-muted-foreground">Active debts</div>
              <div className="font-bold">{creditSales.filter((s) => s.status === 'active' || s.status === 'overdue').length}</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <div className="text-xs text-muted-foreground">Total paid</div>
              <div className="font-bold text-success">{formatCurrency(creditSales.reduce((s, x) => s + x.paidAmount, 0))}</div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <h3 className="font-semibold text-sm">Credit sales ({creditSales.length})</h3>
          {creditSales.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm bg-muted/30 rounded-lg">
              No credit sales for this customer yet.
            </div>
          ) : (
            <div className="space-y-2">
              {creditSales.map((cs) => {
                const outstanding = cs.amount - cs.paidAmount;
                const isPaid = cs.status === 'paid';
                const isOverdue = cs.dueDate < Date.now() && !isPaid;
                return (
                  <div key={cs.id} className={`rounded-lg p-3 border ${isPaid ? 'border-success/30 bg-success/5' : isOverdue ? 'border-warning/30 bg-warning/5' : 'border-border bg-muted/30'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-sm">{formatCurrency(cs.amount)}</div>
                        <div className="text-xs text-muted-foreground">
                          Due: {formatDate(cs.dueDate)} · {formatDate(cs.createdAt)}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold capitalize ${
                        isPaid ? 'bg-success/15 text-success' :
                        isOverdue ? 'bg-warning/15 text-warning' :
                        'bg-info/15 text-info'
                      }`}>
                        {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Active'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mb-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${(cs.paidAmount / cs.amount) * 100}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground">
                        {formatCurrency(cs.paidAmount)} / {formatCurrency(cs.amount)}
                      </span>
                    </div>
                    {!isPaid && (
                      <button
                        onClick={() => { setShowPayment(cs); setPaymentAmount(outstanding.toString()); }}
                        className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                      >
                        <DollarSign className="w-4 h-4" /> Record Payment
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {payments.length > 0 && (
            <>
              <h3 className="font-semibold text-sm pt-3 border-t border-border">Payment history ({payments.length})</h3>
              <div className="space-y-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                    <span className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-success" />
                      {formatDateTime(p.createdAt)}
                    </span>
                    <span className="font-bold text-success">{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Payment modal */}
        {showPayment && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-card w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h3 className="font-bold">Record Payment</h3>
                <button onClick={() => setShowPayment(null)} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div className="bg-muted/40 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total debt:</span>
                    <span className="font-bold">{formatCurrency(showPayment.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already paid:</span>
                    <span className="text-success">{formatCurrency(showPayment.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Outstanding:</span>
                    <span className="text-danger">{formatCurrency(showPayment.amount - showPayment.paidAmount)}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Payment amount</label>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="input-premium"
                    placeholder="0.00"
                  />
                </div>
                <button
                  onClick={recordPayment}
                  disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Confirm Payment</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
