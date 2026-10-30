'use client';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Category } from '@/lib/db-client';
import { useToast } from '@/hooks/use-toast';
import { Folder, Plus, X, Trash2, Edit2, Package } from 'lucide-react';

const COLOR_OPTIONS = ['#059669', '#0EA5E9', '#8B5CF6', '#F59E0B', '#E11D48', '#0284C7', '#10B981', '#F97316'];

export function CategoriesView() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];

  const productCounts = useLiveQuery(async () => {
    const all = await db.products.toArray();
    const counts: Record<number, number> = {};
    for (const p of all) {
      if (p.categoryId) counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1;
    }
    return counts;
  }, []) ?? {};

  const handleDelete = async (c: Category) => {
    const count = productCounts[c.id!] ?? 0;
    if (count > 0) {
      toast({
        type: 'error',
        title: 'Cannot delete',
        description: `${count} product(s) use this category. Reassign them first.`,
      });
      return;
    }
    if (!confirm(`Delete category "${c.name}"?`)) return;
    await db.categories.delete(c.id!);
    toast({ type: 'success', title: 'Category deleted' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">{categories.length} categor(y/ies) · organize your products</p>
        </div>
        <button
          onClick={() => { setEditCat(null); setShowAdd(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((c) => {
          const count = productCounts[c.id!] ?? 0;
          return (
            <div key={c.id} className="card-premium p-4 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${c.color ?? '#059669'}20`, color: c.color ?? '#059669' }}
                  >
                    <Folder className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{count} product(s)</div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => { setEditCat(c); setShowAdd(true); }}
                    className="btn-ghost p-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="btn-ghost p-1.5 hover:text-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {c.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{c.description}</p>
              )}
            </div>
          );
        })}
        {categories.length === 0 && (
          <div className="col-span-full card-premium p-12 text-center text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No categories yet</p>
            <p className="text-xs mt-1">Create categories to organize your products.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <CategoryDialog
          category={editCat}
          onClose={() => { setShowAdd(false); setEditCat(null); }}
          onSave={async (data) => {
            if (editCat) {
              await db.categories.update(editCat.id!, data);
              toast({ type: 'success', title: 'Category updated' });
            } else {
              await db.categories.add(data);
              toast({ type: 'success', title: 'Category added' });
            }
            setShowAdd(false);
            setEditCat(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryDialog({
  category,
  onSave,
  onClose,
}: {
  category: Category | null;
  onSave: (c: Omit<Category, 'id'>) => void;
  onClose: () => void;
}) {
  const [c, setC] = useState<Omit<Category, 'id'>>({
    name: category?.name ?? '',
    color: category?.color ?? '#059669',
    description: category?.description ?? '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-lg">{category ? 'Edit category' : 'Add category'}</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name *</label>
            <input
              value={c.name}
              onChange={(e) => setC({ ...c, name: e.target.value })}
              placeholder="e.g. Pharmaceuticals"
              className="input-premium"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => setC({ ...c, color })}
                  className={`w-8 h-8 rounded-lg border-2 transition ${
                    c.color === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</label>
            <textarea
              value={c.description ?? ''}
              onChange={(e) => setC({ ...c, description: e.target.value })}
              placeholder="Optional"
              className="input-premium"
              rows={2}
            />
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => c.name && onSave(c)}
            disabled={!c.name}
            className="btn-primary flex-1"
          >
            {category ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
