/**
 * StockPilot — Payment Gateways
 * ------------------------------------------------------------------
 * 5 Nigerian gateways:
 *   1. Paystack       — inline checkout + webhook (Business+)
 *   2. Flutterwave    — inline checkout + webhook (Business+)
 *   3. Opay           — manual confirmation
 *   4. Moniepoint     — manual confirmation
 *   5. Bank Transfer  — manual confirmation
 *
 * Gateway secret keys are stored AES-256 encrypted at rest (Layer 1) in
 * the settings table — never in plaintext, never in localStorage.
 *
 * Online operations require HTTPS (Layer 9) + HMAC-SHA256 request signing.
 */

export type GatewayId = 'paystack' | 'flutterwave' | 'opay' | 'moniepoint' | 'bank';

export interface GatewayConfig {
  id: GatewayId;
  label: string;
  active: boolean;
  publicKey?: string;
  secretKey?: string;     // encrypted at rest (Layer 1)
  accountDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}

export const DEFAULT_GATEWAYS: GatewayConfig[] = [
  { id: 'paystack',     label: 'Paystack',       active: false },
  { id: 'flutterwave',  label: 'Flutterwave',    active: false },
  { id: 'opay',         label: 'Opay',           active: false, accountDetails: { bankName: 'Opay', accountName: '', accountNumber: '' } },
  { id: 'moniepoint',   label: 'Moniepoint',     active: false, accountDetails: { bankName: 'Moniepoint', accountName: '', accountNumber: '' } },
  { id: 'bank',         label: 'Bank Transfer',  active: false, accountDetails: { bankName: '', accountName: '', accountNumber: '' } },
];

// ---------------------------------------------------------------------------
// Inline checkout URL generation (online gateways)
// ---------------------------------------------------------------------------

/**
 * Generate a payment URL / inline-checkout reference for online gateways.
 * Offline fallback: returns null — caller should fall back to cash/credit.
 */
export function generateCheckout(
  gateway: GatewayId,
  amount: number,
  reference: string,
  customerEmail: string,
): { url?: string; reference: string; manualConfirm: boolean } {
  switch (gateway) {
    case 'paystack':
      return {
        url: `https://js.paystack.co/v1/inline.js?ref=${reference}`,
        reference,
        manualConfirm: false,
      };
    case 'flutterwave':
      return {
        url: `https://checkout.flutterwave.com/v3.js?ref=${reference}`,
        reference,
        manualConfirm: false,
      };
    default:
      // Opay / Moniepoint / Bank → manual confirm, no URL
      return { reference, manualConfirm: true };
  }
}

// ---------------------------------------------------------------------------
// Webhook signature verification (Layer 9 — secure communication)
// ---------------------------------------------------------------------------

import { hmacSha256, safeEqual } from './crypto';

export async function verifyPaystackWebhook(
  signature: string,
  body: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacSha256(secret, body);
  return safeEqual(expected, signature);
}

export async function verifyFlutterwaveWebhook(
  signature: string,
  body: string,
  secret: string,
): Promise<boolean> {
  const expected = await hmacSha256(secret, body);
  return safeEqual(expected, signature);
}

// ---------------------------------------------------------------------------
// Manual payment confirmation (Opay / Moniepoint / Bank)
// ---------------------------------------------------------------------------

export interface ManualPaymentRecord {
  gateway: GatewayId;
  reference: string;
  amount: number;
  transactionId: string;  // entered by user
  confirmedBy: number;    // userId
  confirmedAt: number;
}

export function confirmManualPayment(
  gateway: GatewayId,
  reference: string,
  amount: number,
  transactionId: string,
  userId: number,
): ManualPaymentRecord {
  return {
    gateway,
    reference,
    amount,
    transactionId,
    confirmedBy: userId,
    confirmedAt: Date.now(),
  };
}
