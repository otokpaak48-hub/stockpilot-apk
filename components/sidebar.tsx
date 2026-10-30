'use client';

/**
 * StockPilot — Premium Sidebar
 * ------------------------------------------------------------------
 * - Desktop (lg+): collapsible fixed sidebar with expandable sections
 * - Mobile (<lg): slide-out drawer triggered by hamburger
 * - Lucide icons (not emoji)
 * - Active state with gradient highlight
 * - Collapsible INVENTORY / INSIGHTS / ADMIN sections
 */

import { useState } from 'react';
import {
  Home, ShoppingCart, Package, ArrowUpDown, ClipboardList, Truck,
  CreditCard, BarChart3, FileText, TrendingUp, Users, ScrollText,
  Database, Settings, ChevronDown, ChevronRight, X, Store, Folder,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { hasPermission, Permission } from '@/lib/permissions';

export type ViewKey =
  | 'home' | 'sell' | 'products' | 'categories' | 'movements' | 'purchase_orders' | 'suppliers'
  | 'dashboard' | 'reports' | 'profit_analytics'
  | 'creditors' | 'users' | 'backups' | 'activity_log' | 'settings';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: typeof Home;
  perm: Permission;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    title: 'Main',
    items: [
      { key: 'home', label: 'Home', icon: Home, perm: 'view_home' },
      { key: 'sell', label: 'Quick Sale', icon: ShoppingCart, perm: 'view_sell' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    items: [
      { key: 'products',        label: 'Products',        icon: Package,        perm: 'view_products' },
      { key: 'categories',      label: 'Categories',      icon: Folder,         perm: 'view_products' },
      { key: 'movements',       label: 'Stock Movements', icon: ArrowUpDown,    perm: 'view_movements' },
      { key: 'purchase_orders', label: 'Purchase Orders', icon: ClipboardList,  perm: 'view_purchase_orders' },
      { key: 'suppliers',       label: 'Suppliers',       icon: Truck,          perm: 'view_suppliers' },
      { key: 'creditors',       label: 'Credit & Debtors',icon: CreditCard,     perm: 'view_creditors' },
    ],
  },
  {
    id: 'insights',
    title: 'Insights',
    items: [
      { key: 'dashboard',        label: 'Dashboard',        icon: BarChart3, perm: 'view_dashboard' },
      { key: 'reports',          label: 'Reports',          icon: FileText,  perm: 'view_reports' },
      { key: 'profit_analytics', label: 'Profit Analytics', icon: TrendingUp, perm: 'view_profit_analytics' },
    ],
  },
  {
    id: 'admin',
    title: 'Administration',
    items: [
      { key: 'users',        label: 'Users',        icon: Users,       perm: 'view_users' },
      { key: 'activity_log', label: 'Activity Log', icon: ScrollText,  perm: 'view_activity_log' },
      { key: 'backups',      label: 'Backups',      icon: Database,    perm: 'view_backups' },
      { key: 'settings',     label: 'Settings',     icon: Settings,    perm: 'view_settings' },
    ],
  },
];

interface SidebarProps {
  active: ViewKey;
  onSelect: (v: ViewKey) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ active, onSelect, isMobileOpen, onMobileClose }: SidebarProps) {
  const { user } = useAuth();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (key: ViewKey) => {
    onSelect(key);
    onMobileClose(); // close mobile drawer on selection
  };

  const filterItems = (items: NavItem[]) =>
    items.filter((i) => user && hasPermission(user.role, i.perm));

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand header — bigger */}
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">StockPilot</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Full Access</div>
          </div>
        </div>
        {/* Close button (mobile only) */}
        <button onClick={onMobileClose} className="lg:hidden btn-ghost p-2.5">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_SECTIONS.map((section) => {
          const items = filterItems(section.items);
          if (items.length === 0) return null;

          const isCollapsed = collapsedSections.has(section.id);

          return (
            <div key={section.id} className="mb-2">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition"
              >
                <span>{section.title}</span>
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {!isCollapsed && (
                <div className="space-y-1 mt-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleSelect(item.key)}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                      >
                        <Icon className="shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer — bigger */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-semibold text-foreground">Full Version</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">All features unlocked</div>
        </div>
        <div className="text-[11px] text-center text-muted-foreground/70">
          ObandeTechHub · 07036001818
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden lg:flex w-72 shrink-0 bg-card border-r border-border h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-80 bg-card border-r border-border z-50 transform transition-transform duration-250 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
