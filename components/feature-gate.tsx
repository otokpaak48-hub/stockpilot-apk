'use client';

/**
 * StockPilot — Feature Gate (FULL ACCESS)
 * Always renders children. Tier gating removed — all features unlocked.
 */
import { ReactNode } from 'react';

interface Props {
  feature: never; // kept for backwards compat — no longer used
  children: ReactNode;
}

export function FeatureGate({ children }: Props) {
  return <>{children}</>;
}

export function FeatureTeaser() {
  return null; // no teasers — everything unlocked
}
