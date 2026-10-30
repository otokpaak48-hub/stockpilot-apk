'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { formatDate } from '@/lib/format';
import { Users, Plus, X, Shield, User as UserIcon, Package, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { hashPassword } from '@/lib/crypto';

const ROLE_ICONS = {
  admin: Shield,
  manager: Users,
  stockkeeper: Package,
  salesperson: ShoppingCart,
};

const ROLE_COLORS = {
  admin: 'bg-danger/15 text-danger',
  manager: 'bg-info/15 text-info',
  stockkeeper: 'bg-warning/15 text-warning',
  salesperson: 'bg-primary/15 text-primary',
};

export function UsersView() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const users = useLiveQuery(() => db.users.toArray(), []) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{users.length} user(s) · 4 roles · brute-force protected</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-border">
          {users.map((u) => {
            const Icon = ROLE_ICONS[u.role] ?? UserIcon;
            const color = ROLE_COLORS[u.role] ?? 'bg-muted text-muted-foreground';
            return (
              <div key={u.id} className="p-4 flex items-center gap-3 hover:bg-muted/30">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{u.username}</div>
                  <div className="text-xs text-muted-foreground capitalize">{u.role} · {formatDate(u.createdAt)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${u.active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {u.active ? 'Active' : 'Disabled'}
                </span>
              </div>
            );
          })}
          {users.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No users yet</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddUserDialog onClose={() => setShowAdd(false)} toast={toast} />}
    </div>
  );
}

function AddUserDialog({ onClose, toast }: { onClose: () => void; toast: any }) {
  const [u, setU] = useState({ username: '', password: '', role: 'salesperson' as 'admin' | 'manager' | 'stockkeeper' | 'salesperson' });
  const save = async () => {
    if (!u.username || !u.password || u.password.length < 8) {
      toast({ type: 'error', title: 'Invalid', description: 'Password must be 8+ chars' });
      return;
    }
    const hash = await hashPassword(u.password);
    await db.users.add({
      username: u.username,
      role: u.role,
      active: true,
      passwordHash: hash,
      createdAt: Date.now(),
    });
    toast({ type: 'success', title: 'User added' });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-lg">Add user</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Username *</label>
            <input value={u.username} onChange={(e) => setU({ ...u, username: e.target.value })} className="input-premium" placeholder="e.g. john" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Password * (min 8 chars)</label>
            <input type="password" value={u.password} onChange={(e) => setU({ ...u, password: e.target.value })} className="input-premium" placeholder="••••••••" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Role</label>
            <select value={u.role} onChange={(e) => setU({ ...u, role: e.target.value as any })} className="input-premium">
              <option value="admin">Admin (full access)</option>
              <option value="manager">Manager (no settings)</option>
              <option value="stockkeeper">Stockkeeper (inventory only)</option>
              <option value="salesperson">Salesperson (sell only)</option>
            </select>
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} disabled={!u.username || !u.password} className="btn-primary flex-1">Add</button>
        </div>
      </div>
    </div>
  );
}
