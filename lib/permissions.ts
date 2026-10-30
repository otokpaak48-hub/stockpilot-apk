/**
 * StockPilot — Role / Permission map
 * ------------------------------------------------------------------
 * 4 roles: admin, manager, stockkeeper, salesperson.
 * The Sidebar component filters navigation tabs by the active user's role.
 */

export type Role = 'admin' | 'manager' | 'stockkeeper' | 'salesperson';

export type Permission =
  | 'view_home'
  | 'view_sell'
  | 'view_products'
  | 'view_movements'
  | 'view_purchase_orders'
  | 'view_suppliers'
  | 'view_creditors'
  | 'view_dashboard'
  | 'view_reports'
  | 'view_profit_analytics'
  | 'view_activity_log'
  | 'view_users'
  | 'view_backups'
  | 'view_settings'
  | 'record_sale'
  | 'manage_inventory'
  | 'manage_users'
  | 'manage_settings'
  | 'export_data'
  | 'reset_data';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'view_home', 'view_sell', 'view_products', 'view_movements',
    'view_purchase_orders', 'view_suppliers', 'view_creditors',
    'view_dashboard', 'view_reports', 'view_profit_analytics',
    'view_activity_log', 'view_users', 'view_backups', 'view_settings',
    'record_sale', 'manage_inventory', 'manage_users', 'manage_settings',
    'export_data', 'reset_data',
  ],
  manager: [
    'view_home', 'view_sell', 'view_products', 'view_movements',
    'view_purchase_orders', 'view_suppliers', 'view_creditors',
    'view_dashboard', 'view_reports', 'view_profit_analytics',
    'view_activity_log', 'view_backups',
    'record_sale', 'manage_inventory', 'export_data',
  ],
  stockkeeper: [
    'view_home', 'view_products', 'view_movements',
    'view_purchase_orders', 'view_suppliers',
    'view_dashboard',
    'manage_inventory',
  ],
  salesperson: [
    'view_home', 'view_sell', 'view_products', 'view_creditors',
    'record_sale',
  ],
};

export function hasPermission(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}

export function filterTabsByRole<T extends { perm: Permission }>(
  role: Role,
  tabs: T[],
): T[] {
  return tabs.filter((t) => hasPermission(role, t.perm));
}
