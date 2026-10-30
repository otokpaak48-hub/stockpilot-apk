'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Product, PurchaseOrder, PoLineItem, Movement } from '@/lib/db-client';
import { withMovementHash } from '@/lib/audit-log';
import { formatDate, formatCurrency } from '@/lib/format';
import { ClipboardList, Plus, X, AlertTriangle, Package, Check, Truck, PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { randomId } from '@/lib/crypto';

export function PurchaseOrdersView() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);

  const pos = useLiveQuery(() => db.purchaseOrders.orderBy('createdAt').reverse().toArray(), []) ?? [];

  const statusColor = (s: string) => ({
    draft:     'bg-muted text-muted-foreground',
    sent:      'bg-info/15 text-info',
    partial:   'bg-warning/15 text-warning',
    received:  'bg-success/15 text-success',
    cancelled: 'bg-danger/15 text-danger',
  }[s] || 'bg-muted');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">{pos.length} order(s) · auto-suggests low-stock products</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New PO
        </button>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-border">
          {pos.map((po) => (
            <button
              key={po.id}
              onClick={() => setViewPO(po)}
              className="w-full p-4 hover:bg-muted/30 flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-info/10 text-info flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{po.poNumber}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Truck className="w-3 h-3" />{po.supplierName} · {formatDate(po.createdAt)}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold capitalize ${statusColor(po.status)}`}>
                {po.status}
              </span>
            </button>
          ))}
          {pos.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No purchase orders yet</p>
              <p className="text-xs mt-1">Create a PO — low-stock products are auto-suggested.</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddPODialog onClose={() => setShowAdd(false)} toast={toast} user={user} />}
      {viewPO && <ViewPODialog po={viewPO} onClose={() => setViewPO(null)} toast={toast} user={user} />}
    </div>
  );
}

function AddPODialog({ onClose, toast, user }: { onClose: () => void; toast: any; user: any }) {
  const [po, setPo] = useState({ supplierName: '', notes: '' });
  const [lineItems, setLineItems] = useState<{ product: Product; qty: number; isNew?: boolean }[]>([]);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '', sku: '', baseUnitSalePrice: 0, cost: 0, qty: 1,
  });

  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];
  const lowStockProducts = products.filter((p) => p.quantity <= p.lowStockThreshold);
  const suggestedQty = (p: Product) => Math.max(p.lowStockThreshold * 2 - p.quantity, p.lowStockThreshold);

  const addAllSuggested = () => {
    const items = lowStockProducts.map((p) => ({ product: p, qty: suggestedQty(p) }));
    setLineItems(items);
    toast({ type: 'info', title: `${items.length} low-stock items added` });
  };

  const addProduct = (p: Product) => {
    if (lineItems.find((l) => l.product.id === p.id)) return;
    setLineItems([...lineItems, { product: p, qty: suggestedQty(p) }]);
  };

  const addNewProduct = () => {
    if (!newProduct.name || !newProduct.sku) {
      toast({ type: 'error', title: 'Name and SKU required' });
      return;
    }
    if (products.find((p) => p.sku === newProduct.sku.toUpperCase())) {
      toast({ type: 'error', title: 'SKU already exists', description: 'Use a different SKU' });
      return;
    }
    const tempProduct: Product = {
      name: newProduct.name,
      sku: newProduct.sku.toUpperCase(),
      storeId: 1,
      quantity: 0,
      lowStockThreshold: 5,
      baseUnitSalePrice: newProduct.baseUnitSalePrice,
      cost: newProduct.cost,
      updatedAt: Date.now(),
    };
    setLineItems([...lineItems, { product: tempProduct, qty: newProduct.qty, isNew: true }]);
    setNewProduct({ name: '', sku: '', baseUnitSalePrice: 0, cost: 0, qty: 1 });
    setShowNewProduct(false);
    toast({ type: 'success', title: 'New product added to PO', description: 'Will be created in inventory when PO is saved' });
  };

  const updateQty = (idx: number, qty: number) => {
    setLineItems(lineItems.map((l, i) => i === idx ? { ...l, qty: Math.max(1, qty) } : l));
  };

  const removeLine = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!po.supplierName) return;
    const poNumber = `PO-${randomId(6)}`;
    const poId = await db.purchaseOrders.add({
      poNumber,
      supplierName: po.supplierName,
      storeId: 1,
      status: 'draft',
      notes: po.notes || undefined,
      createdAt: Date.now(),
    });

    for (const item of lineItems) {
      let productId = item.product.id;

      // If new product, create it now (with 0 stock — will be added on receive)
      if (item.isNew || !productId) {
        const newId = await db.products.add({
          name: item.product.name,
          sku: item.product.sku,
          storeId: 1,
          quantity: 0,
          lowStockThreshold: 5,
          baseUnitSalePrice: item.product.baseUnitSalePrice ?? 0,
          cost: item.product.cost ?? 0,
          updatedAt: Date.now(),
        });
        productId = newId as number;
      }

      await db.poLineItems.add({
        poId: poId as number,
        productId: productId!,
        qty: item.qty,
        receivedQty: 0,
      });
    }
    toast({ type: 'success', title: 'Purchase order created', description: `${poNumber} · ${lineItems.length} items` });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="font-bold text-lg">New purchase order</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Supplier name *</label>
              <input
                value={po.supplierName}
                onChange={(e) => setPo({ ...po, supplierName: e.target.value })}
                placeholder="e.g. Jide Pharmaceuticals"
                className="input-premium"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Notes</label>
              <input
                value={po.notes}
                onChange={(e) => setPo({ ...po, notes: e.target.value })}
                placeholder="Optional"
                className="input-premium"
              />
            </div>
          </div>

          {/* Low-stock suggestions */}
          {lowStockProducts.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {lowStockProducts.length} low-stock product(s) detected
                </div>
                <button onClick={addAllSuggested} className="btn-primary text-xs px-3 py-1.5">
                  Add all suggested
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {lowStockProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    disabled={!!lineItems.find((l) => l.product.id === p.id)}
                    className="w-full flex items-center justify-between p-2 bg-card rounded text-left text-xs hover:bg-muted disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <Package className="w-3 h-3" />
                      {p.name}
                    </span>
                    <span className="text-warning">
                      Stock: {p.quantity} → Suggest: {suggestedQty(p)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Line items ({lineItems.length})
              </label>
              <button
                onClick={() => setShowNewProduct(!showNewProduct)}
                className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
              >
                <PackagePlus className="w-3.5 h-3.5" /> Add New Product
              </button>
            </div>

            {/* New product form */}
            {showNewProduct && (
              <div className="border border-primary/30 rounded-lg p-3 bg-primary/5 mb-2 space-y-2">
                <div className="text-xs font-semibold text-primary">Add a new product (will be created in inventory)</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Product name *"
                    className="input-premium text-sm"
                  />
                  <input
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value.toUpperCase() })}
                    placeholder="SKU *"
                    className="input-premium text-sm font-mono"
                  />
                  <input
                    type="number"
                    value={newProduct.cost}
                    onChange={(e) => setNewProduct({ ...newProduct, cost: +e.target.value })}
                    placeholder="Cost price"
                    className="input-premium text-sm"
                  />
                  <input
                    type="number"
                    value={newProduct.baseUnitSalePrice}
                    onChange={(e) => setNewProduct({ ...newProduct, baseUnitSalePrice: +e.target.value })}
                    placeholder="Sale price"
                    className="input-premium text-sm"
                  />
                  <input
                    type="number"
                    value={newProduct.qty}
                    onChange={(e) => setNewProduct({ ...newProduct, qty: +e.target.value })}
                    placeholder="Order qty"
                    className="input-premium text-sm"
                  />
                  <button onClick={addNewProduct} className="btn-primary text-sm">
                    Add to PO
                  </button>
                </div>
              </div>
            )}

            {lineItems.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm bg-muted/30 rounded-lg">
                Add existing products (below) or new products (above) to this PO
              </div>
            ) : (
              <div className="space-y-1">
                {lineItems.map((l, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                    {l.isNew && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">NEW</span>}
                    <span className="flex-1 text-sm truncate">{l.product.name}</span>
                    <span className="text-xs text-muted-foreground">{l.product.sku}</span>
                    <input
                      type="number"
                      value={l.qty}
                      onChange={(e) => updateQty(idx, +e.target.value)}
                      className="input-premium w-20 text-sm"
                      min={1}
                    />
                    <button onClick={() => removeLine(idx)} className="btn-ghost p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual add existing */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Add existing product</label>
            <select
              value=""
              onChange={(e) => {
                const p = products.find((x) => x.id === +e.target.value);
                if (p) addProduct(p);
              }}
              className="input-premium"
            >
              <option value="">Select a product to add...</option>
              {products
                .filter((p) => !lineItems.find((l) => l.product.id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {p.quantity})
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={!po.supplierName} className="btn-primary flex-1">Create PO</button>
        </div>
      </div>
    </div>
  );
}

function ViewPODialog({ po, onClose, toast, user }: { po: PurchaseOrder; onClose: () => void; toast: any; user: any }) {
  const lineItems = useLiveQuery(async () => {
    const items = await db.poLineItems.where('poId').equals(po.id!).toArray();
    const enriched = await Promise.all(
      items.map(async (item) => ({
        ...item,
        product: await db.products.get(item.productId),
      }))
    );
    return enriched;
  }, [po.id]) ?? [];

  const markReceived = async () => {
    if (!confirm('Mark all items as received? Stock will be updated and movements recorded.')) return;
    for (const item of lineItems) {
      const product = item.product;
      const receiveQty = item.qty - (item.receivedQty ?? 0);
      if (receiveQty <= 0) continue;

      // Update product stock (or create if missing)
      if (product) {
        await db.products.update(product.id!, {
          quantity: product.quantity + receiveQty,
          updatedAt: Date.now(),
        });
      }
      // Note: if product is null, it was a "new product" line that should have been created on save

      // Create Stock In movement (linked to PO)
      if (user) {
        const movementBase: Omit<Movement, 'id' | 'recordHash'> = {
          productId: item.productId,
          type: 'in',
          storeId: 1,
          qty: receiveQty,
          reason: `PO received: ${po.poNumber}`,
          userId: user.id!,
          createdAt: Date.now(),
        };
        const movement = await withMovementHash(movementBase);
        await db.movements.add(movement);
      }

      await db.poLineItems.update(item.id!, { receivedQty: item.qty });
    }
    await db.purchaseOrders.update(po.id!, { status: 'received' });
    toast({ type: 'success', title: 'PO received', description: 'Stock updated + movements recorded' });
    onClose();
  };

  const markSent = async () => {
    await db.purchaseOrders.update(po.id!, { status: 'sent' });
    toast({ type: 'success', title: 'PO marked as sent' });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <div>
            <h2 className="font-bold text-lg">{po.poNumber}</h2>
            <p className="text-xs text-muted-foreground">{po.supplierName} · {formatDate(po.createdAt)}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Status</span>
            <span className="text-xs px-2 py-1 rounded-full font-semibold capitalize bg-muted">
              {po.status}
            </span>
          </div>

          {po.notes && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Notes</div>
              <div className="text-sm bg-muted/30 p-2 rounded">{po.notes}</div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">Line items ({lineItems.length})</div>
            <div className="space-y-1">
              {lineItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm truncate">{item.product?.name ?? 'Unknown'}</span>
                  <span className="text-sm">Qty: {item.qty}</span>
                  {item.receivedQty && item.receivedQty > 0 && (
                    <span className="text-xs text-success flex items-center gap-1">
                      <Check className="w-3 h-3" /> {item.receivedQty}
                    </span>
                  )}
                </div>
              ))}
              {lineItems.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm">No line items</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          {po.status === 'draft' && (
            <button onClick={markSent} className="btn-secondary flex-1">Mark as Sent</button>
          )}
          {(po.status === 'sent' || po.status === 'partial') && (
            <button onClick={markReceived} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Check className="w-4 h-4" /> Mark Received
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">Close</button>
        </div>
      </div>
    </div>
  );
}
