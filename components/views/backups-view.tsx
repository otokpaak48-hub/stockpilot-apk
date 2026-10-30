'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { formatDateTime } from '@/lib/format';
import { Database, Download, Lock, FileJson, HardDrive } from 'lucide-react';
import { writeBackupFile } from '@/native/filesystem';
import { encryptBackup } from '@/lib/crypto';
import { useToast } from '@/hooks/use-toast';

export function BackupsView() {
  const { toast } = useToast();
  const backups = useLiveQuery(() =>
    db.backups.orderBy('createdAt').reverse().limit(20).toArray(), []
  ) ?? [];

  const createBackup = async (password?: string) => {
    const data = {
      products: await db.products.toArray(),
      sales: await db.sales.toArray(),
      saleItems: await db.saleItems.toArray(),
      movements: await db.movements.toArray(),
      creditors: await db.creditors.toArray(),
      creditSales: await db.creditSales.toArray(),
      settings: await db.settings.toArray(),
      exportedAt: Date.now(),
    };
    const json = JSON.stringify(data);
    const blob = password ? await encryptBackup(json, password) : json;
    const filename = `stockpilot-backup-${new Date().toISOString().slice(0, 10)}.${password ? 'spbk' : 'json'}`;
    const uri = await writeBackupFile(filename, blob);
    await db.backups.add({
      createdAt: Date.now(),
      trigger: 'manual',
      fileHash: filename,
      encrypted: !!password,
    });
    toast({ type: 'success', title: 'Backup created', description: uri });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Backups</h1>
        <p className="text-sm text-muted-foreground">AES-256 encrypted backups · auto-backup hourly</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => createBackup()}
          className="card-premium p-4 text-left flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm">Export (plain JSON)</div>
            <div className="text-xs text-muted-foreground">Readable backup file</div>
          </div>
        </button>

        <button
          onClick={() => {
            const pw = prompt('Backup password:');
            if (pw) createBackup(pw);
          }}
          className="card-premium p-4 text-left flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm">Export (encrypted)</div>
            <div className="text-xs text-muted-foreground">AES-256 password-protected</div>
          </div>
        </button>
      </div>

      <div className="card-premium overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Backup history</h2>
        </div>
        <div className="divide-y divide-border">
          {backups.map((b) => (
            <div key={b.id} className="p-3 flex items-center gap-3 hover:bg-muted/30">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                b.encrypted ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'
              }`}>
                {b.encrypted ? <Lock className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{b.fileHash}</div>
                <div className="text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</div>
              </div>
              {b.encrypted && <span className="text-xs px-2 py-0.5 rounded bg-warning/15 text-warning font-semibold">Encrypted</span>}
            </div>
          ))}
          {backups.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No backups yet</p>
              <p className="text-xs mt-1">Tap "Export" above to create your first backup.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
