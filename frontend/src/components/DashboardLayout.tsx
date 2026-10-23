'use client';

import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Menu, X } from 'lucide-react';

import { isRoleAuthorizedForPortal, getDashboardRouteForRole } from '../lib/roleRouting';

interface DashboardLayoutProps {
  children: React.ReactNode;
  portal?: 'farmer' | 'vendor' | 'customer' | 'admin';
  role?: 'farmer' | 'vendor' | 'customer' | 'admin';
  title?: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export function DashboardLayout({
  children,
  portal,
  role,
  title,
  subtitle,
  actionButton,
}: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activePortal: 'farmer' | 'vendor' | 'customer' | 'admin' =
    portal ||
    (pathname?.startsWith('/farmer')
      ? 'farmer'
      : pathname?.startsWith('/vendor')
      ? 'vendor'
      : pathname?.startsWith('/admin')
      ? 'admin'
      : pathname?.startsWith('/customer')
      ? 'customer'
      : (role as any) || 'customer');

  const isAuthorized = isRoleAuthorizedForPortal(user?.role, activePortal);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.onboarding_completed === false) {
      router.replace('/onboarding');
      return;
    }

    if (!isAuthorized) {
      const destination = getDashboardRouteForRole(user.role);
      if (pathname !== destination) {
        router.replace(destination);
      }
    }
  }, [isAuthorized, loading, pathname, router, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-600">Loading AgriTrace workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    const portalName =
      activePortal === 'farmer'
        ? 'Farmer'
        : activePortal === 'vendor'
        ? 'Vendor'
        : activePortal === 'admin'
        ? 'Admin'
        : 'Customer';

    return (
      <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <span className="text-xl font-bold">!</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Your session has expired</h1>
          <p className="mt-2 text-sm text-slate-600">
            Please sign in again to access the {portalName} workspace.
          </p>
          <button
            onClick={() => router.replace('/login')}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Block unauthorized role from rendering child forms or triggering API requests
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
            <span className="text-xl font-bold">!</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Access Denied</h1>
          <p className="mt-2 text-sm text-slate-600">
            Role &apos;{user.role}&apos; is not authorized to access this workspace.
          </p>
          <button
            onClick={() => router.replace(getDashboardRouteForRole(user.role))}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
          >
            Go to My Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf9] text-slate-900">
      <Navbar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-y-0 left-0 w-72 bg-white z-50 p-4 shadow-2xl flex flex-col justify-between md:hidden border-r border-slate-200 animate-in slide-in-from-left duration-200">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <span className="font-bold text-slate-800 text-sm tracking-tight">Portal Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar portal={activePortal} onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* Desktop Sidebar only - Hidden on mobile viewports (<768px) to fix duplicate sidebar bug */}
        <div className="hidden md:block shrink-0">
          <Sidebar portal={activePortal} />
        </div>

        <main className="flex-1 min-w-0 space-y-6">
          {(title || actionButton) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                {title && <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>}
                {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
              </div>
              {actionButton && <div>{actionButton}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
