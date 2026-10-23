'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '../context/LanguageContext';
import {
  LayoutDashboard,
  Tractor,
  Sprout,
  Package,
  ShoppingCart,
  ShoppingBag,
  Heart,
  QrCode,
  ScanLine,
  Truck,
  Bot,
  Eye,
  Store,
  User,
  FlaskConical,
  CloudSun,
  Bell,
  Users,
  PackageCheck,
} from 'lucide-react';

interface SidebarProps {
  portal: 'farmer' | 'vendor' | 'customer' | 'admin';
  onNavigate?: () => void;
}

export function Sidebar({ portal, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

  const farmerNav = [
    { label: 'Dashboard', href: '/farmer/dashboard', icon: LayoutDashboard },
    { label: 'My Profile', href: '/farmer/profile', icon: User },
    { label: 'My Crops', href: '/farmer/crops', icon: Sprout },
    { label: 'Fertilizer Records', href: '/farmer/fertilizers', icon: FlaskConical },
    { label: 'Vendors Directory', href: '/farmer/vendors', icon: Store },
    { label: 'AI Agents', href: '/farmer/ai-agents', icon: Bot, isHighlight: true },
    { label: 'Customer View (Preview)', href: '/farmer/customer-view', icon: Eye },
    { label: 'Weather & Forecasts', href: '/farmer/weather', icon: CloudSun },
    { label: 'Produce Batches', href: '/farmer/batches', icon: Package },
    { label: 'Notifications', href: '/farmer/notifications', icon: Bell },
  ];

  const vendorNav = [
    { label: 'Dashboard', href: '/vendor/dashboard', icon: LayoutDashboard },
    { label: 'My Profile', href: '/vendor/profile', icon: User },
    { label: 'Inventory / Stock', href: '/vendor/inventory', icon: Package },
    { label: 'Market Catalog', href: '/vendor/products', icon: ShoppingBag },
    { label: 'Procurements', href: '/vendor/procurement', icon: Tractor },
    { label: 'Farmers Directory', href: '/vendor/farmers', icon: Users },
    { label: 'AI Agents', href: '/vendor/ai-agents', icon: Bot, isHighlight: true },
    { label: 'Customer View (Preview)', href: '/vendor/customer-view', icon: Eye },
    { label: 'Customer Orders', href: '/vendor/orders', icon: Truck },
  ];

  const customerNav = [
    { label: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboard },
    { label: 'Store Farm Produce', href: '/customer', icon: PackageCheck, isHighlight: true },
    { label: 'My Profile', href: '/customer/profile', icon: User },
    { label: 'Products & Produce', href: '/customer/marketplace', icon: ShoppingBag },
    { label: 'Freshness Bag', href: '/customer/freshness-bag', icon: ScanLine },
    { label: 'Farmers Directory', href: '/customer/farmers', icon: Users },
    { label: 'Vendors Directory', href: '/customer/vendors', icon: Store },
    { label: 'Cart', href: '/customer/cart', icon: ShoppingCart },
    { label: 'My Orders', href: '/customer/orders', icon: Package },
    { label: 'Favorites', href: '/customer/favorites', icon: Heart },
    { label: 'AI Agents', href: '/customer/ai-agents', icon: Bot, isHighlight: true },
  ];

  const adminNav = [
    { label: 'Admin Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Farmer Operations', href: '/farmer/dashboard', icon: Tractor },
    { label: 'Vendor Operations', href: '/vendor/dashboard', icon: Store },
    { label: 'Customer Marketplace', href: '/customer/dashboard', icon: ShoppingBag },
    { label: 'AI Agents', href: '/farmer/ai-agents', icon: Bot, isHighlight: true },
  ];

  const navItems =
    portal === 'farmer'
      ? farmerNav
      : portal === 'vendor'
      ? vendorNav
      : portal === 'admin'
      ? adminNav
      : customerNav;

  const portalTitles = {
    farmer: 'Farmer Portal',
    vendor: 'Vendor Portal',
    customer: 'Customer Portal',
    admin: 'Admin Portal',
  };

  return (
    <aside className="w-64 shrink-0">
      <div className="sticky top-20 rounded-2xl bg-white border border-slate-200 p-4 space-y-6 shadow-xs">
        <div>
          <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            {portalTitles[portal]}
          </h3>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold'
                      : item.isHighlight
                      ? 'text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-900 border border-emerald-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive
                        ? 'text-emerald-700'
                        : item.isHighlight
                        ? 'text-emerald-600'
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Traceability Banner */}
        <div className="rounded-xl bg-emerald-50/80 p-3.5 border border-emerald-200/80 text-xs text-emerald-900">
          <div className="flex items-center gap-2 mb-1 text-emerald-800 font-semibold">
            <QrCode className="h-4 w-4 text-emerald-700" />
            <span>Public Traceability</span>
          </div>
          <p className="text-[11px] text-emerald-800/80 mb-2.5 leading-relaxed">
            Verify provenance, fertilizer records & cold chain transitions.
          </p>
          <Link
            href="/trace/batch/TOM-2026-0001"
            onClick={onNavigate}
            className="inline-block w-full text-center py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs shadow-2xs transition-colors"
          >
            Scan Demo Batch →
          </Link>
        </div>
      </div>
    </aside>
  );
}
