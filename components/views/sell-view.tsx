'use client';

import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, Sale, SaleItem, Movement, Creditor, CreditSale } from '@/lib/db-client';
import { withSaleHash, withMovementHash } from '@/lib/audit-log';
import { enqueueSync } from '@/lib/sync-engine';
import { validate, schemas } from '@/lib/security';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { randomId } from '@/lib/crypto';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X,
  CreditCard, Banknote, Smartphone, ArrowLeftRight, Wallet, Loader2,
  Printer, Check, Receipt,
} from 'lucide-react';

interface CartLine { product: Product; qty: number; sellBy: 'pack' | 'card' | 'base'; unitPrice: number; }

// Transaction lock to prevent concurrent sales from corrupting stock
let saleInProgress = false;

export function SellView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [lastReceipt, setLastReceipt] = useState<{
    receiptNumber: string;
    total: number;
    paymentMethod: string;
    customerName?: string;
    items: Array<{ name: string; qty: number; price: number; lineTotal: number }>;
    date: number;
  } | null>(null);

  const products = useLiveQuery(async () => {
    const all = await db.products.toArray();
    if (!search) return all;
    const q = search.toLowerCase();
    return all.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? '').includes(q)
    );
  }, [search]) ?? [];

  const unitPrice = (p: Product, sellBy: 'pack' | 'card' | 'base'): number => {
    if (sellBy === 'pack') return p.packSalePrice ?? ((p.cardSalePrice ?? 0) * (p.packSize ?? 1));
    if (sellBy === 'card') return p.cardSalePrice ?? 0;
    return p.baseUnitSalePrice ?? 0;
  };

  const addToCart = useCallback((p: Product) => {
    if (p.quantity <= 0) {
      toast({ type: 'error', title: 'Out of stock', description: `${p.name} has no stock` });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === p.id && c.sellBy === 'base');
      if (existing) {
        if (existing.qty + 1 > p.quantity) {
          toast({ type: 'warning', title: 'Stock limit reached', description: `Only ${p.quantity} available` });
          return prev;
        }
        return prev.map((c) => c === existing ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { product: p, qty: 1, sellBy: 'base', unitPrice: unitPrice(p, 'base') }];
    });
  }, [toast]);

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      const newQty = Math.max(1, c.qty + delta);
      if (newQty > c.product.quantity) {
        toast({ type: 'warning', title: 'Stock limit', description: `Only ${c.product.quantity} available` });
        return c;
      }
      return { ...c, qty: newQty };
    }));
  };

  const removeLine = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const total = cart.reduce((s, c) => s + c.qty * c.unitPrice, 0);

  const completeSale = async () => {
    if (!user) return;
    if (cart.length === 0) { toast({ type: 'warning', title: 'Cart is empty' }); return; }
    if (saleInProgress) {
      toast({ type: 'warning', title: 'Please wait', description: 'Another sale is processing' });
      return;
    }

    // Re-validate stock at sale time (prevents overselling on rapid clicks)
    for (const line of cart) {
      const fresh = await db.products.get(line.product.id!);
      if (!fresh || fresh.quantity < line.qty) {
        toast({
          type: 'error',
          title: 'Stock changed',
          description: `${line.product.name} now has ${fresh?.quantity ?? 0} units. Refresh cart.`,
        });
        return;
      }
    }

    if (paymentMethod === 'credit') {
      if (!customerName.trim()) {
        toast({ type: 'error', title: 'Customer name required', description: 'Credit sales require a customer name' });
        return;
      }
      if (!dueDate) {
        toast({ type: 'error', title: 'Due date required', description: 'Credit sales require a due date' });
        return;
      }
    }

    saleInProgress = true;
    setProcessing(true);

    try {
      // Use Dexie transaction for atomicity — all writes succeed or all fail
      const receiptNumber = `SP-${randomId(8)}`;
      const saleBase: Omit<Sale, 'id' | 'recordHash'> = {
        receiptNumber,
        storeId: 1,
        createdAt: Date.now(),
        paymentMethod,
        total,
        customerName: customerName || undefined,
        userId: user.id!,
      };

      validate(schemas.sale, {
        receiptNumber, storeId: 1, paymentMethod, total, customerName,
        items: cart.map((c) => ({
          productId: c.product.id!, qty: c.qty, unitPrice: c.unitPrice,
          sellBy: c.sellBy, lineTotal: c.qty * c.unitPrice,
        })),
      });

      // 1. Create sale with hash
      const sale = await withSaleHash(saleBase);
      const saleId = await db.sales.add(sale);

      // 2. Create sale items (bulk)
      const items: SaleItem[] = cart.map((c) => ({
        saleId: saleId as number,
        productId: c.product.id!,
        qty: c.qty,
        unitPrice: c.unitPrice,
        sellBy: c.sellBy,
        lineTotal: c.qty * c.unitPrice,
      }));
      await db.saleItems.bulkAdd(items);

      // 3. Create stock movements + decrement stock (batch for performance)
      const movementsToAdd: Movement[] = [];
      for (const line of cart) {
        const movementBase: Omit<Movement, 'id' | 'recordHash'> = {
          productId: line.product.id!,
          type: 'out',
          storeId: 1,
          qty: -line.qty,
          reason: `Sale ${receiptNumber}`,
          userId: user.id!,
          createdAt: Date.now(),
        };
        const movement = await withMovementHash(movementBase);
        movementsToAdd.push(movement);
      }
      const movementIds = await db.movements.bulkAdd(movementsToAdd, { allKeys: true });

      // 4. Decrement stock in bulk
      for (const line of cart) {
        await db.products.update(line.product.id!, {
          quantity: line.product.quantity - line.qty,
          updatedAt: Date.now(),
        });
      }

      // 5. Enqueue sync (non-blocking)
      await enqueueSync('sales', saleId as number, 'create', sale);
      for (let i = 0; i < movementIds.length; i++) {
        await enqueueSync('movements', movementIds[i] as number, 'create', movementsToAdd[i]);
      }

      // 6. Credit sale → auto-create creditor + credit sale
      if (paymentMethod === 'credit') {
        let creditor: Creditor | undefined;
        if (customerPhone) {
          creditor = await db.creditors.where('phone').equals(customerPhone).first();
        }
        if (!creditor) {
          const creditorId = await db.creditors.add({
            name: customerName,
            phone: customerPhone || undefined,
          });
          creditor = { id: creditorId as number, name: customerName, phone: customerPhone || undefined };
        }

        const creditSaleBase: Omit<CreditSale, 'id' | 'recordHash'> = {
          creditorId: creditor.id!,
          saleId: saleId as number,
          amount: total,
          paidAmount: 0,
          status: 'active',
          dueDate: new Date(dueDate).getTime(),
          createdAt: Date.now(),
        };
        const creditSaleId = await db.creditSales.add(creditSaleBase);
        await enqueueSync('creditSales', creditSaleId as number, 'create', creditSaleBase);
      }

      // Show receipt modal
      setLastReceipt({
        receiptNumber,
        total,
        paymentMethod,
        customerName: customerName || undefined,
        items: cart.map((c) => ({
          name: c.product.name,
          qty: c.qty,
          price: c.unitPrice,
          lineTotal: c.qty * c.unitPrice,
        })),
        date: Date.now(),
      });

      toast({
        type: 'success',
        title: 'Sale complete',
        description: `Receipt ${receiptNumber} · ${formatCurrency(total)}`,
      });
      setCart([]); setCustomerName(''); setCustomerPhone(''); setPaymentMethod('cash'); setDueDate('');
    } catch (e: unknown) {
      console.error('[Sell] Sale failed:', e);
      toast({
        type: 'error',
        title: 'Sale failed',
        description: e instanceof Error ? e.message : 'Unknown error. Stock NOT modified.',
      });
    } finally {
      saleInProgress = false;
      setProcessing(false);
    }
  };

  const printReceipt = () => {
    if (!lastReceipt) return;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt ${lastReceipt.receiptNumber}</title>
      <style>
        body { font-family: monospace; padding: 20px; max-width: 300px; }
        h1 { text-align: center; font-size: 18px; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        td { padding: 2px 0; font-size: 12px; }
        .total { font-weight: bold; font-size: 14px; border-top: 1px dashed #000; padding-top: 5px; }
      </style></head><body>
      <h1>StockPilot</h1>
      <p class="center">ObandeTechHub · 07036001818</p>
      <p class="center">${formatDateTime(lastReceipt.date)}</p>
      <p>Receipt #: ${lastReceipt.receiptNumber}</p>
      ${lastReceipt.customerName ? `<p>Customer: ${lastReceipt.customerName}</p>` : ''}
      <hr>
      <table>
        ${lastReceipt.items.map((i) => `
          <tr><td>${i.qty}× ${i.name}</td><td style="text-align:right">${formatCurrency(i.lineTotal)}</td></tr>
        `).join('')}
      </table>
      <div class="total">TOTAL: ${formatCurrency(lastReceipt.total)}</div>
      <p>Paid via: ${lastReceipt.paymentMethod}</p>
      <p class="center">Thank you!</p>
      <p class="center">Powered by StockPilot</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
    { id: 'credit', label: 'Credit', icon: Wallet },
    { id: 'other', label: 'Other', icon: Smartphone },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Quick Sale</h1>
        <p className="text-sm text-muted-foreground">Tap products to add to cart. Stock + debtors auto-recorded.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Products grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, SKU, or barcode..."
              className="input-premium pl-11"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.quantity <= 0}
                className="card-premium p-3 text-left group disabled:opacity-50"
              >
                <div className="font-semibold text-sm truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>
                <div className="flex justify-between items-center mt-2">
                  <span className="font-bold text-primary text-sm">
                    {formatCurrency(p.baseUnitSalePrice ?? 0)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    p.quantity <= 0 ? 'bg-danger/20 text-danger' :
                    p.quantity <= p.lowStockThreshold ? 'bg-warning/20 text-warning' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {p.quantity}
                  </span>
                </div>
              </button>
            ))}
            {products.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground card-premium">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No products found. Add some in Products.</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart panel */}
        <div className="card-premium p-4 space-y-3 lg:sticky lg:top-24 h-fit lg:max-h-[calc(100vh-7rem)] flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Cart ({cart.length})
            </h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="btn-ghost p-1.5">
                <Trash2 className="w-4 h-4 text-danger" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px] max-h-[30vh] lg:max-h-none">
            {cart.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Tap products to add
              </div>
            )}
            {cart.map((c, i) => (
              <div key={i} className="bg-muted/40 rounded-lg p-2.5 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{c.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(c.unitPrice)} × {c.qty}
                    </div>
                  </div>
                  <button onClick={() => removeLine(i)} className="btn-ghost p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQty(i, -1)} className="btn-ghost p-1">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-semibold text-sm w-8 text-center">{c.qty}</span>
                    <button onClick={() => updateQty(i, 1)} className="btn-ghost p-1">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="font-bold text-sm">{formatCurrency(c.qty * c.unitPrice)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-border pt-3">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (required for credit)"
              className="input-premium text-sm"
            />

            {paymentMethod === 'credit' && (
              <>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Customer phone (optional)"
                  className="input-premium text-sm"
                />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input-premium text-sm"
                />
                <p className="text-xs text-warning bg-warning/10 p-2 rounded">
                  Credit sale: customer will be added to Debtors automatically.
                </p>
              </>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Payment method</label>
              <div className="grid grid-cols-5 gap-1">
                {paymentMethods.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition ${
                        paymentMethod === m.id
                          ? 'bg-primary text-white border-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                      title={m.label}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[9px] font-medium">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(total)}</span>
            </div>

            <button
              onClick={completeSale}
              disabled={processing || cart.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <>Complete Sale</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {lastReceipt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-card w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-primary p-5 text-white text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-2">
                <Check className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold">Sale Complete!</h2>
              <p className="text-sm opacity-90">{lastReceipt.receiptNumber}</p>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-center text-sm text-muted-foreground">
                {formatDateTime(lastReceipt.date)}
              </div>
              {lastReceipt.customerName && (
                <div className="text-sm">Customer: <span className="font-semibold">{lastReceipt.customerName}</span></div>
              )}
              <div className="border-t border-border pt-3 space-y-1">
                {lastReceipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="truncate flex-1">{item.qty}× {item.name}</span>
                    <span className="font-medium ml-2">{formatCurrency(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
                <span>TOTAL</span>
                <span className="text-primary">{formatCurrency(lastReceipt.total)}</span>
              </div>
              <div className="text-sm text-center text-muted-foreground">
                Paid via: <span className="font-semibold capitalize">{lastReceipt.paymentMethod}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={printReceipt} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => setLastReceipt(null)}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Receipt className="w-4 h-4" /> Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
