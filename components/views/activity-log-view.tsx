'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { formatDateTime } from '@/lib/format';
import { ScrollText, Shield, ShoppingCart, ArrowUpDown, User as UserIcon, Database, Lock } from 'lucide-react';

const ICONS: Record<string, typeof ScrollText> = {
  sale: ShoppingCart,
  movement: ArrowUpDown,
  login: UserIcon,
  user: UserIcon,
  license: Lock,
  tier: Shield,
  backup: Database,
  tamper: Shield,
  sync: Database,
};

const COLORS: Record<string, string> = {
  sale: 'text-success bg-success/10',
  movement: 'text-info bg-info/10',
  login: 'text-primary bg-primary/10',
  tamper: 'text-danger bg-danger/10',
};

export function ActivityLogView() {
  const logs = useLiveQuery(() =>
    db.activityLogs.orderBy('createdAt').reverse().limit(100).toArray(), []
  ) ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Immutable audit trail · hash-chained (Layer 5 + 10)</p>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="divide-y divide-border">
          {logs.map((l) => {
            const Icon = ICONS[l.type] ?? ScrollText;
            const color = COLORS[l.type] ?? 'text-muted-foreground bg-muted';
            return (
              <div key={l.id} className="p-4 flex items-start gap-3 hover:bg-muted/30">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm capitalize">{l.type}</div>
                  <div className="text-xs text-muted-foreground">{l.message}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0 text-right">
                  {formatDateTime(l.createdAt)}
                </div>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">Sales, logins, and other events will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
