/**
 * StockPilot — Tier system (FULL ACCESS for all users)
 * ------------------------------------------------------------------
 * All tiers unlocked. Feature gates always return true.
 * This file kept for backwards compatibility with components that
 * still call hasFeature().
 */

import { Tier } from './license';

export type Feature =
  | 'cloud_sync'
  | 'realtime_websocket'
  | 'low_stock_email_sms'
  | 'auto_cloud_backup'
  | 'payment_webhook'
  | 'device_fingerprint'
  | 'two_factor_auth'
  | 'profit_analytics'
  | 'dead_stock_report'
  | 'custom_receipt_branding'
  | 'best_selling_time_analysis'
  | 'priority_support'
  | 'advanced_sync_analytics';

/** FULL ACCESS: all features always unlocked. */
export function hasFeature(_feature: Feature, _tier?: Tier): boolean {
  return true;
}

export const TIER_INFO: Record<Tier, { label: string; price: string; color: string }> = {
  starter:  { label: 'Full Access', price: 'Unlocked',   color: '#059669' },
  business: { label: 'Full Access', price: 'Unlocked',   color: '#059669' },
  premium:  { label: 'Full Access', price: 'Unlocked',   color: '#059669' },
};

export const FEATURE_LABELS: Record<Feature, string> = {
  cloud_sync:               'Cloud sync',
  realtime_websocket:       'Real-time updates',
  low_stock_email_sms:      'Low-stock alerts',
  auto_cloud_backup:        'Auto-backup',
  payment_webhook:          'Payment webhooks',
  device_fingerprint:       'Device fingerprinting',
  two_factor_auth:          'Two-factor auth',
  profit_analytics:         'Profit analytics',
  dead_stock_report:        'Dead stock reports',
  custom_receipt_branding:  'Custom receipt branding',
  best_selling_time_analysis: 'Best-selling time analysis',
  priority_support:         'Priority support',
  advanced_sync_analytics:  'Advanced sync analytics',
};
