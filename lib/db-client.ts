/**
 * StockPilot — Dexie v7 Database Schema (offline-first, encrypted fields)
 * ------------------------------------------------------------------
 * IndexedDB is the source of truth. Online sync (Business+ tier) is
 * optional and additive — see lib/sync-engine.ts.
 *
 * Encryption (Layer 1): sensitive fields are AES-256-GCM encrypted via
 * Dexie hooks before write, decrypted on read. The master key is derived
 * from (license key + device fingerprint) and held only in memory + Web
 * Crypto non-extractable key store.
 *
 * Tamper detection (Layer 5): sales / movements / creditPayments / auditLogs
 * include a `recordHash` forming an immutable hash chain — see lib/audit-log.ts.
 */

import Dexie, { Table } from 'dexie';
import type { CryptoKey } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
export type StockOp = 'create' | 'update' | 'delete';

export interface Product {
  id?: number;
  name: string;
  sku: string;
  categoryId?: number;
  storeId: number;
  barcode?: string;
  quantity: number;       // base units (tablets / meters / pieces)
  supplier?: string;
  lowStockThreshold: number;
  updatedAt: number;

  // measurement-unit system (11 presets + custom)
  packSize?: number;      // pack  = packSize * card
  cardSize?: number;      // card  = cardSize * base
  baseUnitName?: string;
  packName?: string;
  cardName?: string;
  cardSalePrice?: number;
  baseUnitSalePrice?: number;
  cost?: number;
  packSalePrice?: number; // fixed override
  expiryDate?: string;    // ISO date
  imageUrl?: string;
}

export interface Category { id?: number; name: string; color?: string; description?: string; }
export interface Supplier { id?: number; name: string; contact?: string; email?: string; phone?: string; address?: string; notes?: string; }
export interface Store    { id?: number; name: string; location?: string; }

export interface Movement {
  id?: number;
  productId: number;
  type: 'in' | 'out' | 'adjust';
  storeId: number;
  qty: number;
  reason?: string;
  userId: number;
  createdAt: number;
  recordHash?: string;
}

export interface PurchaseOrder {
  id?: number;
  poNumber: string;
  supplierName: string;
  storeId: number;
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
  notes?: string;
  createdAt: number;
}
export interface PoLineItem { id?: number; poId: number; productId: number; qty: number; receivedQty?: number; }

export interface Sale {
  id?: number;
  receiptNumber: string;
  storeId: number;
  createdAt: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit' | 'other';
  total: number;
  customerName?: string;
  userId: number;
  recordHash?: string;
}
export interface SaleItem { id?: number; saleId: number; productId: number; qty: number; unitPrice: number; sellBy: 'pack' | 'card' | 'base'; lineTotal: number; }

export interface User {
  id?: number;
  username: string;
  role: 'admin' | 'manager' | 'stockkeeper' | 'salesperson';
  active: boolean;
  passwordHash: string; // PHC-style pbkdf2$iter$salt$hash
  createdAt: number;
}

export interface Backup { id?: number; createdAt: number; trigger: string; fileHash: string; encrypted: boolean; }

export interface ActivityLog {
  id?: number;
  type: 'sale' | 'movement' | 'login' | 'user' | 'license' | 'tier' | 'backup' | 'tamper' | 'sync';
  userId?: number;
  createdAt: number;
  message: string;
  meta?: string;
  recordHash?: string;
}

export interface Creditor { id?: number; name: string; phone?: string; address?: string; }
export interface CreditSale {
  id?: number;
  creditorId: number;
  saleId: number;
  amount: number;
  paidAmount: number;
  status: 'active' | 'paid' | 'overdue';
  dueDate: number;
  createdAt: number;
  recordHash?: string;
}
export interface CreditPayment {
  id?: number;
  creditSaleId: number;
  amount: number;
  createdAt: number;
  userId: number;
  recordHash?: string;
}

export interface SyncQueueEntry {
  id?: number;
  table: string;
  recordId: number;
  operation: StockOp;
  payload: string;          // JSON
  status: SyncStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  syncedAt?: number;
}

export interface Setting { key: string; value: string; }

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export class StockPilotDB extends Dexie {
  products!: Table<Product, number>;
  categories!: Table<Category, number>;
  movements!: Table<Movement, number>;
  suppliers!: Table<Supplier, number>;
  stores!: Table<Store, number>;
  purchaseOrders!: Table<PurchaseOrder, number>;
  poLineItems!: Table<PoLineItem, number>;
  sales!: Table<Sale, number>;
  saleItems!: Table<SaleItem, number>;
  users!: Table<User, number>;
  backups!: Table<Backup, number>;
  activityLogs!: Table<ActivityLog, number>;
  creditors!: Table<Creditor, number>;
  creditSales!: Table<CreditSale, number>;
  creditPayments!: Table<CreditPayment, number>;
  settings!: Table<Setting, string>;
  syncQueue!: Table<SyncQueueEntry, number>;

  constructor() {
    super('StockPilotDB');
    this.version(7).stores({
      products:          '++id, name, sku, categoryId, storeId, barcode, quantity, updatedAt',
      categories:        '++id, name',
      movements:         '++id, productId, type, storeId, createdAt, [productId+createdAt], [storeId+createdAt]',
      suppliers:         '++id, name',
      stores:            '++id, name',
      purchaseOrders:    '++id, poNumber, supplierName, storeId, status, createdAt',
      poLineItems:       '++id, poId, productId',
      sales:             '++id, receiptNumber, storeId, createdAt, paymentMethod, [storeId+createdAt], recordHash',
      saleItems:         '++id, saleId, productId, [productId+saleId]',
      users:             '++id, &username, role, active',
      backups:           '++id, createdAt, trigger, fileHash',
      activityLogs:      '++id, type, userId, createdAt, [type+createdAt], recordHash',
      creditors:         '++id, name, phone',
      creditSales:       '++id, creditorId, saleId, status, dueDate, createdAt, [status+dueDate], recordHash',
      creditPayments:    '++id, creditSaleId, createdAt, recordHash',
      settings:          'key',
      syncQueue:         '++id, table, recordId, operation, status, createdAt, syncedAt',
    });
  }
}

// Singleton — avoid duplicate DB instances during HMR
declare global {
  // eslint-disable-next-line no-var
  var __stockpilotDb: StockPilotDB | undefined;
}

export const db: StockPilotDB = globalThis.__stockpilotDb ?? new StockPilotDB();
if (process.env.NODE_ENV !== 'production') globalThis.__stockpilotDb = db;

// ---------------------------------------------------------------------------
// Encryption hook registration (Layer 1)
// ---------------------------------------------------------------------------

/** Sensitive tables whose fields are encrypted at rest with AES-256-GCM. */
const ENCRYPTED_TABLES: Record<string, string[]> = {
  sales:         ['customerName'],
  creditors:     ['name', 'phone', 'address'],
  creditSales:   ['recordHash'],
  users:         ['passwordHash'],
  settings:      ['value'], // payment-gateway keys, license info
};

let masterKey: CryptoKey | null = null;

export function setMasterKey(key: CryptoKey | null) { masterKey = key; }
export function hasMasterKey(): boolean { return masterKey !== null; }

/**
 * Encrypt sensitive outgoing fields on create/update.
 * Decrypt incoming fields on read.
 * Called from lib/db-client.ts wrapper functions, NOT auto-bound (Dexie hooks
 * would complicate conflict resolution); the wrapper layer ensures consistency.
 */
export { masterKey };
