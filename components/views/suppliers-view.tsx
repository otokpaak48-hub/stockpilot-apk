'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { formatDate } from '@/lib/format';
import { Truck, Plus, X, Phone, Mail, MapPin } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function SuppliersView() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const suppliers = useLiveQuery(() => db.suppliers.toArray(), []) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{suppliers.length} supplier(s)</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-border">
          {suppliers.map((s) => (
            <div key={s.id} className="p-4 hover:bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 text-info flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                    {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                    {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                    {s.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.address}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No suppliers yet</p>
              <p className="text-xs mt-1">Add suppliers to track your sources.</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddSupplierDialog onClose={() => setShowAdd(false)} toast={toast} />}
    </div>
  );
}

function AddSupplierDialog({ onClose, toast }: { onClose: () => void; toast: any }) {
  const [s, setS] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
  const save = async () => {
    if (!s.name) return;
    await db.suppliers.add({
      name: s.name,
      phone: s.phone || undefined,
      email: s.email || undefined,
      address: s.address || undefined,
      notes: s.notes || undefined,
    });
    toast({ type: 'success', title: 'Supplier added' });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="font-bold text-lg">Add supplier</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name *</label>
            <input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} className="input-premium" placeholder="Supplier name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Phone</label>
            <input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} className="input-premium" placeholder="08012345678" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email</label>
            <input value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} className="input-premium" placeholder="email@example.com" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Address</label>
            <input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} className="input-premium" placeholder="Optional" />
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={!s.name} className="btn-primary flex-1">Add</button>
        </div>
      </div>
    </div>
  );
}
