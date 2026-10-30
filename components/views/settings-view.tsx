'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db-client';
import { getTrialRemainingMs } from '@/lib/license';
import { setCurrency, getCurrency, CURRENCIES } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { usePwa } from '@/hooks/use-pwa';
import {
  Store, Palette, Shield, Database, Info, Check, Crown,
  Wifi, WifiOff, Cloud, CreditCard, Banknote, Smartphone, X, Plus,
} from 'lucide-react';

export function SettingsView() {
  const { toast } = useToast();
  const { online } = usePwa();
  const [currency, setCurrencyState] = useState(getCurrency());
  const [showGateway, setShowGateway] = useState(false);
  const trialDays = Math.floor(getTrialRemainingMs() / (24 * 60 * 60 * 1000));

  // Payment gateways from settings
  const gatewaysSetting = useLiveQuery(() => db.settings.get('payment_gateways'), []);
  const gateways = gatewaysSetting ? JSON.parse(gatewaysSetting.value) : [];

  const handleCurrency = (c: string) => {
    setCurrency(c);
    setCurrencyState(c);
    toast({ type: 'success', title: 'Currency updated', description: c });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your StockPilot app</p>
      </div>

      {/* Full Access banner */}
      <div className="card-premium p-5 bg-gradient-to-br from-primary/10 via-card to-premium/5 border-primary/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-lg">Full Access</div>
            <div className="text-xs text-muted-foreground">All features unlocked — no tier restrictions</div>
          </div>
        </div>
      </div>

      {/* Online status */}
      <Section icon={online ? Wifi : WifiOff} title="Online Status">
        <Row label="Connection">
          <span className={`flex items-center gap-2 font-semibold ${online ? 'text-success' : 'text-muted-foreground'}`}>
            {online ? <><Wifi className="w-4 h-4" /> Online</> : <><WifiOff className="w-4 h-4" /> Offline</>}
          </span>
        </Row>
        <Row label="Cloud sync">
          <span className="flex items-center gap-2 font-semibold text-primary">
            <Cloud className="w-4 h-4" /> {online ? 'Active' : 'Will sync when online'}
          </span>
        </Row>
        <Row label="Auto-sync interval">Every 5 minutes</Row>
        <Row label="Conflict strategy">Last-write-wins + alert</Row>
      </Section>

      {/* Payment gateways */}
      <Section icon={CreditCard} title="Payment Gateways">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-sm">Configured gateways</div>
              <div className="text-xs text-muted-foreground">Accept online and offline payments</div>
            </div>
            <button onClick={() => setShowGateway(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {gateways.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm bg-muted/30 rounded-lg">
                No gateways configured. Tap "Add" to set up Paystack, Flutterwave, etc.
              </div>
            ) : (
              gateways.map((g: any) => (
                <div key={g.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    {g.id === 'paystack' && <CreditCard className="w-5 h-5" />}
                    {g.id === 'flutterwave' && <CreditCard className="w-5 h-5" />}
                    {g.id === 'opay' && <Smartphone className="w-5 h-5" />}
                    {g.id === 'moniepoint' && <Smartphone className="w-5 h-5" />}
                    {g.id === 'bank' && <Banknote className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{g.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.active ? 'Active' : 'Inactive'}
                      {g.accountDetails?.accountNumber && ` · ${g.accountDetails.accountNumber}`}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    g.active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    {g.active ? 'On' : 'Off'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </Section>

      {/* Store profile */}
      <Section icon={Store} title="Store Profile">
        <Row label="Currency">
          <select value={currency} onChange={(e) => handleCurrency(e.target.value)} className="input-premium max-w-32">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Row>
        <Row label="Trial days remaining">
          <span className="font-semibold">{trialDays} days</span>
        </Row>
      </Section>

      {/* Appearance */}
      <Section icon={Palette} title="Appearance">
        <Row label="Theme">
          <span className="text-sm text-muted-foreground">Use the ☀️/🌙 button in the header</span>
        </Row>
        <Row label="Text size">
          <span className="font-semibold">Large (optimized for mobile)</span>
        </Row>
      </Section>

      {/* Security */}
      <Section icon={Shield} title="Security">
        <Row label="Data encryption"><Check className="w-5 h-5 text-success" /></Row>
        <Row label="Hash chains (tamper detection)"><Check className="w-5 h-5 text-success" /></Row>
        <Row label="Audit trail"><Check className="w-5 h-5 text-success" /></Row>
        <Row label="Brute-force protection"><Check className="w-5 h-5 text-success" /></Row>
        <Row label="Encrypted backups"><Check className="w-5 h-5 text-success" /></Row>
      </Section>

      {/* Data */}
      <Section icon={Database} title="Data Management">
        <Row label="Backup frequency">Hourly (auto)</Row>
        <Row label="Manual export">Available in Backups</Row>
        <Row label="Manual import">Available in Backups</Row>
        <Row label="Cloud sync">
          <span className="flex items-center gap-2 text-success font-semibold">
            <Cloud className="w-4 h-4" /> Enabled
          </span>
        </Row>
      </Section>

      {/* About */}
      <Section icon={Info} title="About">
        <Row label="Version"><span className="font-mono text-sm">v1.0.7</span></Row>
        <Row label="Developer">ObandeTechHub</Row>
        <Row label="Phone">07036001818</Row>
        <Row label="License">Proprietary · © 2026</Row>
      </Section>

      {showGateway && <AddGatewayDialog onClose={() => setShowGateway(false)} toast={toast} existing={gateways} />}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Store; title: string; children: React.ReactNode }) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="font-semibold text-base">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

function AddGatewayDialog({ onClose, toast, existing }: { onClose: () => void; toast: any; existing: any[] }) {
  const [gateway, setGateway] = useState({
    id: 'paystack' as 'paystack' | 'flutterwave' | 'opay' | 'moniepoint' | 'bank',
    label: 'Paystack',
    active: true,
    publicKey: '',
    secretKey: '',
    accountDetails: { bankName: '', accountName: '', accountNumber: '' },
  });

  const gatewayOptions = [
    { id: 'paystack', label: 'Paystack', needsKeys: true },
    { id: 'flutterwave', label: 'Flutterwave', needsKeys: true },
    { id: 'opay', label: 'Opay', needsKeys: false },
    { id: 'moniepoint', label: 'Moniepoint', needsKeys: false },
    { id: 'bank', label: 'Bank Transfer', needsKeys: false },
  ] as const;

  const selected = gatewayOptions.find((g) => g.id === gateway.id)!;

  const save = async () => {
    const updated = [...existing.filter((g) => g.id !== gateway.id), gateway];
    await db.settings.put({ key: 'payment_gateways', value: JSON.stringify(updated) });
    toast({ type: 'success', title: 'Gateway saved', description: gateway.label });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-card">
          <h2 className="font-bold text-lg">Add payment gateway</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Gateway</label>
            <select
              value={gateway.id}
              onChange={(e) => {
                const opt = gatewayOptions.find((g) => g.id === e.target.value)!;
                setGateway({ ...gateway, id: opt.id, label: opt.label });
              }}
              className="input-premium"
            >
              {gatewayOptions.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </div>

          {selected.needsKeys && (
            <>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Public Key</label>
                <input
                  value={gateway.publicKey}
                  onChange={(e) => setGateway({ ...gateway, publicKey: e.target.value })}
                  placeholder="pk_test_..."
                  className="input-premium font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Secret Key (encrypted)</label>
                <input
                  type="password"
                  value={gateway.secretKey}
                  onChange={(e) => setGateway({ ...gateway, secretKey: e.target.value })}
                  placeholder="sk_test_..."
                  className="input-premium font-mono text-sm"
                />
              </div>
            </>
          )}

          {!selected.needsKeys && (
            <>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Bank Name</label>
                <input
                  value={gateway.accountDetails.bankName}
                  onChange={(e) => setGateway({ ...gateway, accountDetails: { ...gateway.accountDetails, bankName: e.target.value } })}
                  placeholder="e.g. Access Bank"
                  className="input-premium"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Account Name</label>
                <input
                  value={gateway.accountDetails.accountName}
                  onChange={(e) => setGateway({ ...gateway, accountDetails: { ...gateway.accountDetails, accountName: e.target.value } })}
                  placeholder="e.g. He Cares Shop"
                  className="input-premium"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground mb-1.5 block">Account Number</label>
                <input
                  value={gateway.accountDetails.accountNumber}
                  onChange={(e) => setGateway({ ...gateway, accountDetails: { ...gateway.accountDetails, accountNumber: e.target.value } })}
                  placeholder="0123456789"
                  className="input-premium font-mono"
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={gateway.active}
              onChange={(e) => setGateway({ ...gateway, active: e.target.checked })}
              className="w-5 h-5"
            />
            <span className="text-sm">Active</span>
          </label>
        </div>
        <div className="p-5 border-t border-border flex gap-2 sticky bottom-0 bg-card">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={save} className="btn-primary flex-1">Save Gateway</button>
        </div>
      </div>
    </div>
  );
}
