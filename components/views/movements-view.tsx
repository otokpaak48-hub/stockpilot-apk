'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Movement, Product } from '@/lib/db-client';
import { withMovementHash } from '@/lib/audit-log';
import { enqueueSync } from '@/lib/sync-engine';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowUpCircle, ArrowDownCircle, RefreshCw, ArrowUpDown,
  Plus, X, Search, Package, Loader2,
} from 'lucide-react';

type MovementType = 'in' | 'out' | 'adjust';

interface BulkLine {
  product: Product;
  qty: number;
  reason: string;
}

export function MovementsView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState<'all' | MovementType>('all');
  const [search, setSearch] = useState('');

  const movements = useLiveQuery(async () => {
    let all = await db.movements.orderBy('createdAt').reverse().limit(200).toArray();
    if (filterType !== 'all') all = all.filter((m) => m.type === filterType);
    if (search) {
      const q = search.toLowerCase();
      const products = await db.products.toArray();
      const productMap = new Map(products.map((p) => [p.id!, p]));
      all = all.filter((m) => {
        const p = productMap.get(m.productId);
        return (p?.name.toLowerCase().includes(q) ?? false) ||
               (m.reason ?? '').toLowerCase().includes(q);
      });
    }
    return all;
  }, [filterType, search]) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stock Movements</h1>
          <p className="text-sm text-muted-foreground">{movements.length} movement(s) · hash-chained audit trail</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Movement
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or reason..."
            className="input-premium pl-10"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="input-premium max-w-[150px]"
        >
          <option value="all">All types</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
          <option value="adjust">Adjustment</option>
        </select>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-border">
          {movements.map((m) => {
            const Icon = m.type === 'in' ? ArrowUpCircle : m.type === 'out' ? ArrowDownCircle : RefreshCw;
            const color = m.type === 'in' ? 'text-success bg-success/10' : m.type === 'out' ? 'text-danger bg-danger/10' : 'text-info bg-info/10';
            return (
              <div key={m.id} className="p-4 flex items-center gap-3 hover:bg-muted/30">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold capitalize text-sm">{m.type}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.reason ?? '—'}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${m.qty > 0 ? 'text-success' : 'text-danger'}`}>
                    {m.qty > 0 ? '+' : ''}{m.qty}
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</div>
                </div>
              </div>
            );
          })}
          {movements.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <ArrowUpDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No movements recorded yet</p>
              <p className="text-xs mt-1">Tap "New Movement" to record stock in/out/adjust.</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddMovementDialog
          onClose={() => setShowAdd(false)}
          onSave={async (lines, type, reason) => {
            if (!user) return;
            try {
              for (const line of lines) {
                const movementBase: Omit<Movement, 'id' | 'recordHash'> = {
                  productId: line.product.id!,
                  type,
                  storeId: 1,
                  qty: type === 'out' ? -Math.abs(line.qty) : Math.abs(line.qty),
                  reason: reason || line.reason || `${type} operation`,
                  userId: user.id!,
                  createdAt: Date.now(),
                };
                const movement = await withMovementHash(movementBase);
                const id = await db.movements.add(movement);

                // Update product stock
                const newQty = type === 'out'
                  ? line.product.quantity - line.qty
                  : type === 'in'
                  ? line.product.quantity + line.qty
                  : line.qty; // adjust = set to absolute value
                await db.products.update(line.product.id!, {
                  quantity: Math.max(0, newQty),
                  updatedAt: Date.now(),
                });

                await enqueueSync('movements', id as number, 'create', movement);
              }
              toast({
                type: 'success',
                title: 'Movement recorded',
                description: `${lines.length} product(s) updated`,
              });
              setShowAdd(false);
            } catch (e: unknown) {
              toast({
                type: 'error',
                title: 'Movement failed',
                description: e instanceof Error ? e.message : 'Unknown error',
              });
            }
          }}
        />
      )}
    </div>
  );
}

function AddMovementDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (lines: BulkLine[], type: MovementType, reason: string) => Promise<void>;
}) {
  const [type, setType] = useState<MovementType>('in');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<BulkLine[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const products = useLiveQuery(async () => {
    const all = await db.products.toArray();
    if (!search) return all.slice(0, 50);
    const q = search.toLowerCase();
    return all.filter((p) =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [search]) ?? [];

  const addProduct = (p: Product) => {
    if (lines.find((l) => l.product.id === p.id)) return;
    setLines([...lines, { product: p, qty: 1, reason: '' }]);
  };

  const updateQty = (id: number, qty: number) => {
    setLines(lines.map((l) => l.product.id === id ? { ...l, qty: Math.max(1, qty) } : l));
  };

  const removeLine = (id: number) => {
    setLines(lines.filter((l) => l.product.id !== id));
  };

  const save = async () => {
    if (lines.length === 0) return;
    setSaving(true);
    await onSave(lines, type, reason);
    setSaving(false);
  };

  const typeOptions = [
    { id: 'in' as const, label: 'Stock In', icon: ArrowUpCircle, color: 'text-success' },
    { id: 'out' as const, label: 'Stock Out', icon: ArrowDownCircle, color: 'text-danger' },
    { id: 'adjust' as const, label: 'Adjust', icon: RefreshCw, color: 'text-info' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="font-bold text-lg">New stock movement</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Movement type</label>
            <div className="grid grid-cols-3 gap-2">
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setType(opt.id)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition ${
                      type === opt.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${opt.color}`} />
                    <span className="text-xs font-semibold">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Reason (applies to all)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === 'in' ? 'e.g. New stock delivery' : type === 'out' ? 'e.g. Damaged/expired' : 'e.g. Stock count correction'}
              className="input-premium"
            />
          </div>

          {/* Selected products */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">
              Selected products ({lines.length})
            </label>
            {lines.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm bg-muted/30 rounded-lg">
                Search and add products below
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {lines.map((l) => (
                  <div key={l.product.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm truncate">{l.product.name}</span>
                    <span className="text-xs text-muted-foreground">Stock: {l.product.quantity}</span>
                    <input
                      type="number"
                      value={l.qty}
                      onChange={(e) => updateQty(l.product.id!, +e.target.value)}
                      className="input-premium w-20 text-sm"
                      min={1}
                    />
                    <button onClick={() => removeLine(l.product.id!)} className="btn-ghost p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product search */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Add products</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products to add..."
                className="input-premium pl-10"
              />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {products
                .filter((p) => !lines.find((l) => l.product.id === p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-muted rounded text-left text-sm"
                  >
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">Stock: {p.quantity}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={save}
            disabled={lines.length === 0 || saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : `Record ${type === 'in' ? 'Stock In' : type === 'out' ? 'Stock Out' : 'Adjustment'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
