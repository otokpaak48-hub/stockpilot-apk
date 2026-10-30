'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, Category } from '@/lib/db-client';
import { validate, schemas } from '@/lib/security';
import { useToast } from '@/hooks/use-toast';
import { enqueueSync } from '@/lib/sync-engine';
import { formatCurrency } from '@/lib/format';
import {
  Search, Plus, X, Package, Edit2, Trash2, AlertTriangle, Folder,
} from 'lucide-react';

export function ProductsView() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  const products = useLiveQuery(async () => {
    const all = await db.products.toArray();
    let filtered = all;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').includes(q)
      );
    }
    if (filterCategory !== 'all') {
      filtered = filtered.filter((p) => p.categoryId === filterCategory);
    }
    return filtered;
  }, [search, filterCategory]) ?? [];

  const handleSave = async (data: Omit<Product, 'id'> & { id?: number }) => {
    try {
      validate(schemas.product, {
        name: data.name, sku: data.sku, barcode: data.barcode,
        quantity: data.quantity, lowStockThreshold: data.lowStockThreshold,
      });
    } catch (e: unknown) {
      toast({
        type: 'error',
        title: 'Validation failed',
        description: e instanceof Error ? e.message : '',
      });
      return;
    }

    if (data.id) {
      await db.products.update(data.id, { ...data, updatedAt: Date.now() });
      await enqueueSync('products', data.id, 'update', data);
      toast({ type: 'success', title: 'Product updated' });
    } else {
      const { id, ...newData } = data;
      const newId = await db.products.add({ ...newData, updatedAt: Date.now() });
      await enqueueSync('products', newId as number, 'create', newData);
      toast({ type: 'success', title: 'Product added' });
    }
    setShowAdd(false);
    setEditProduct(null);
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await db.products.delete(p.id!);
    await enqueueSync('products', p.id!, 'delete', null);
    toast({ type: 'success', title: 'Product deleted' });
  };

  const getCategoryName = (id?: number) => categories.find((c) => c.id === id)?.name;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} item(s) in inventory</p>
        </div>
        <button onClick={() => { setEditProduct(null); setShowAdd(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            className="input-premium pl-10"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value === 'all' ? 'all' : +e.target.value)}
          className="input-premium max-w-[180px]"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-border">
          {products.map((p) => {
            const isLow = p.quantity <= p.lowStockThreshold;
            const catName = getCategoryName(p.categoryId);
            return (
              <div key={p.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isLow ? 'bg-warning/15 text-warning' : 'bg-primary/10 text-primary'
                  }`}>
                    {isLow ? <AlertTriangle className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>SKU: {p.sku}</span>
                      {catName && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted">
                          <Folder className="w-2.5 h-2.5" /> {catName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{formatCurrency(p.baseUnitSalePrice ?? 0)}</div>
                  <div className={`text-xs ${isLow ? 'text-warning font-semibold' : 'text-muted-foreground'}`}>
                    {p.quantity} in stock
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => { setEditProduct(p); setShowAdd(true); }}
                    className="btn-ghost p-2"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="btn-ghost p-2 hover:text-danger"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {products.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No products yet</p>
              <p className="text-xs mt-1">Tap "Add Product" to create your first item.</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <ProductDialog
          product={editProduct}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditProduct(null); }}
        />
      )}
    </div>
  );
}

function ProductDialog({
  product,
  categories,
  onSave,
  onClose,
}: {
  product: Product | null;
  categories: Category[];
  onSave: (p: Omit<Product, 'id'> & { id?: number }) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState<Omit<Product, 'id'> & { id?: number }>(
    product ?? {
      name: '', sku: '', storeId: 1, quantity: 0, lowStockThreshold: 5,
      baseUnitSalePrice: 0, cost: 0, updatedAt: Date.now(),
    }
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="font-bold text-lg">{product ? 'Edit product' : 'Add product'}</h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Name *">
            <input
              value={p.name}
              onChange={(e) => setP({ ...p, name: e.target.value })}
              placeholder="e.g. Paracetamol 500mg"
              className="input-premium"
            />
          </Field>

          <Field label="Category">
            <select
              value={p.categoryId ?? ''}
              onChange={(e) => setP({ ...p, categoryId: e.target.value ? +e.target.value : undefined })}
              className="input-premium"
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU *">
              <input
                value={p.sku}
                onChange={(e) => setP({ ...p, sku: e.target.value.toUpperCase() })}
                placeholder="PARA500"
                className="input-premium font-mono text-sm"
              />
            </Field>
            <Field label="Barcode">
              <input
                value={p.barcode ?? ''}
                onChange={(e) => setP({ ...p, barcode: e.target.value })}
                placeholder="Auto-scan"
                className="input-premium font-mono text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity *">
              <input
                type="number"
                value={p.quantity}
                onChange={(e) => setP({ ...p, quantity: +e.target.value })}
                className="input-premium"
              />
            </Field>
            <Field label="Low-stock threshold">
              <input
                type="number"
                value={p.lowStockThreshold}
                onChange={(e) => setP({ ...p, lowStockThreshold: +e.target.value })}
                className="input-premium"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost price">
              <input
                type="number"
                value={p.cost ?? 0}
                onChange={(e) => setP({ ...p, cost: +e.target.value })}
                className="input-premium"
              />
            </Field>
            <Field label="Sale price">
              <input
                type="number"
                value={p.baseUnitSalePrice ?? 0}
                onChange={(e) => setP({ ...p, baseUnitSalePrice: +e.target.value })}
                className="input-premium"
              />
            </Field>
          </div>

          <Field label="Expiry date (optional)">
            <input
              type="date"
              value={p.expiryDate ?? ''}
              onChange={(e) => setP({ ...p, expiryDate: e.target.value })}
              className="input-premium"
            />
          </Field>
        </div>

        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => onSave(p)}
            disabled={!p.name || !p.sku}
            className="btn-primary flex-1"
          >
            {product ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
