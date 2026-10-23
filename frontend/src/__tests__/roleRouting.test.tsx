import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import {
  normalizeRole,
  getDashboardRouteForRole,
  isRoleAuthorizedForPath,
  getRequiredRoleForPath,
} from '../lib/roleRouting';
import { DashboardLayout } from '../components/DashboardLayout';
import LoginPage from '../app/(auth)/login/page';
import * as authContext from '../context/AuthContext';

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockCurrentPath = '/login';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => mockCurrentPath,
}));

vi.mock('../components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock('../components/Sidebar', () => ({
  Sidebar: ({ portal }: { portal: string }) => <div data-testid="sidebar">{portal} sidebar</div>,
}));

describe('Canonical Role Resolution & Routing Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeRole', () => {
    it('normalizes lowercase and uppercase roles to canonical UserRole', () => {
      expect(normalizeRole('farmer')).toBe('FARMER');
      expect(normalizeRole('FARMER')).toBe('FARMER');
      expect(normalizeRole('vendor')).toBe('VENDOR');
      expect(normalizeRole('VENDOR')).toBe('VENDOR');
      expect(normalizeRole('customer')).toBe('CUSTOMER');
      expect(normalizeRole('CUSTOMER')).toBe('CUSTOMER');
      expect(normalizeRole('admin')).toBe('ADMIN');
      expect(normalizeRole('ADMIN')).toBe('ADMIN');
    });

    it('returns null for missing, null, undefined, or unknown roles WITHOUT defaulting to FARMER', () => {
      expect(normalizeRole(null)).toBeNull();
      expect(normalizeRole(undefined)).toBeNull();
      expect(normalizeRole('')).toBeNull();
      expect(normalizeRole('unknown_role')).toBeNull();
      expect(normalizeRole('guest')).toBeNull();
      // Crucial requirement: must NEVER convert unknown into FARMER
      expect(normalizeRole('hacker')).not.toBe('FARMER');
    });
  });

  describe('getDashboardRouteForRole', () => {
    it('maps every canonical role to its dedicated dashboard route', () => {
      expect(getDashboardRouteForRole('FARMER')).toBe('/farmer/dashboard');
      expect(getDashboardRouteForRole('farmer')).toBe('/farmer/dashboard');

      expect(getDashboardRouteForRole('VENDOR')).toBe('/vendor/dashboard');
      expect(getDashboardRouteForRole('vendor')).toBe('/vendor/dashboard');

      expect(getDashboardRouteForRole('CUSTOMER')).toBe('/customer/dashboard');
      expect(getDashboardRouteForRole('customer')).toBe('/customer/dashboard');

      expect(getDashboardRouteForRole('ADMIN')).toBe('/admin/dashboard');
      expect(getDashboardRouteForRole('admin')).toBe('/admin/dashboard');
    });

    it('returns /login for null, missing, or unknown roles', () => {
      expect(getDashboardRouteForRole(null)).toBe('/login');
      expect(getDashboardRouteForRole(undefined)).toBe('/login');
      expect(getDashboardRouteForRole('unknown')).toBe('/login');
    });
  });

  describe('isRoleAuthorizedForPath', () => {
    it('allows public paths for all users', () => {
      expect(isRoleAuthorizedForPath(null, '/')).toBe(true);
      expect(isRoleAuthorizedForPath('CUSTOMER', '/login')).toBe(true);
      expect(isRoleAuthorizedForPath('VENDOR', '/signup')).toBe(true);
      expect(isRoleAuthorizedForPath(null, '/onboarding')).toBe(true);
      expect(isRoleAuthorizedForPath(null, '/trace/ABC-123')).toBe(true);
    });

    it('permits FARMER only on /farmer routes, blocking other roles', () => {
      expect(isRoleAuthorizedForPath('FARMER', '/farmer/dashboard')).toBe(true);
      expect(isRoleAuthorizedForPath('FARMER', '/farmer/farms')).toBe(true);
      expect(isRoleAuthorizedForPath('FARMER', '/farmer/crops')).toBe(true);

      // CUSTOMER must NOT be permitted on /farmer routes
      expect(isRoleAuthorizedForPath('CUSTOMER', '/farmer/farms')).toBe(false);
      expect(isRoleAuthorizedForPath('CUSTOMER', '/farmer/dashboard')).toBe(false);

      // VENDOR must NOT be permitted on /farmer routes
      expect(isRoleAuthorizedForPath('VENDOR', '/farmer/farms')).toBe(false);
      expect(isRoleAuthorizedForPath('VENDOR', '/farmer/crops')).toBe(false);
    });

    it('permits VENDOR only on /vendor routes, blocking CUSTOMER and FARMER', () => {
      expect(isRoleAuthorizedForPath('VENDOR', '/vendor/dashboard')).toBe(true);
      expect(isRoleAuthorizedForPath('VENDOR', '/vendor/inventory')).toBe(true);

      expect(isRoleAuthorizedForPath('CUSTOMER', '/vendor/inventory')).toBe(false);
      expect(isRoleAuthorizedForPath('FARMER', '/vendor/dashboard')).toBe(false);
    });

    it('permits ADMIN on all operational portal routes', () => {
      expect(isRoleAuthorizedForPath('ADMIN', '/farmer/dashboard')).toBe(true);
      expect(isRoleAuthorizedForPath('ADMIN', '/farmer/farms')).toBe(true);
      expect(isRoleAuthorizedForPath('ADMIN', '/vendor/dashboard')).toBe(true);
      expect(isRoleAuthorizedForPath('ADMIN', '/customer/dashboard')).toBe(true);
      expect(isRoleAuthorizedForPath('ADMIN', '/admin/dashboard')).toBe(true);
    });

    it('strictly forbids non-ADMIN users from /admin routes', () => {
      expect(isRoleAuthorizedForPath('FARMER', '/admin/dashboard')).toBe(false);
      expect(isRoleAuthorizedForPath('VENDOR', '/admin/dashboard')).toBe(false);
      expect(isRoleAuthorizedForPath('CUSTOMER', '/admin/dashboard')).toBe(false);
      expect(isRoleAuthorizedForPath(null, '/admin/dashboard')).toBe(false);
    });
  });

  describe('Login Navigation by Authoritative Role', () => {
    it('redirects VENDOR to /vendor/dashboard on login regardless of form role state', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        id: 'user-vendor-1',
        email: 'vendor@agritrace.dev',
        role: 'VENDOR',
        full_name: 'Wholesale Vendor',
        onboarding_completed: true,
      });

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        login: mockLogin,
        signup: vi.fn(),
        loginWithGoogle: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'vendor@agritrace.dev' } });
      fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /^Sign In$/ }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/vendor/dashboard');
      });
    });

    it('redirects CUSTOMER to /customer/dashboard on login', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        id: 'user-cust-1',
        email: 'customer@agritrace.dev',
        role: 'CUSTOMER',
        full_name: 'Priya Sharma',
        onboarding_completed: true,
      });

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        login: mockLogin,
        signup: vi.fn(),
        loginWithGoogle: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'customer@agritrace.dev' } });
      fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /^Sign In$/ }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/customer/dashboard');
      });
    });

    it('redirects ADMIN to /admin/dashboard on login', async () => {
      const mockLogin = vi.fn().mockResolvedValue({
        id: 'user-admin-1',
        email: 'admin@agritrace.dev',
        role: 'ADMIN',
        full_name: 'System Admin',
        onboarding_completed: true,
      });

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        login: mockLogin,
        signup: vi.fn(),
        loginWithGoogle: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'admin@agritrace.dev' } });
      fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /^Sign In$/ }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/dashboard');
      });
    });

    it('redirects Google Sign-In for VENDOR to /vendor/dashboard', async () => {
      const mockLoginWithGoogle = vi.fn().mockResolvedValue({
        id: 'google-vendor-1',
        email: 'vendor@gmail.com',
        role: 'VENDOR',
        full_name: 'Google Vendor',
        onboarding_completed: true,
      });

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        login: vi.fn(),
        signup: vi.fn(),
        loginWithGoogle: mockLoginWithGoogle,
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<LoginPage />);

      fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/vendor/dashboard');
      });
    });
  });

  describe('Route Guards: Blocking CUSTOMER from Farmer Workflows', () => {
    it('blocks a CUSTOMER navigating to /farmer/farms and redirects them to /customer/dashboard', () => {
      mockCurrentPath = '/farmer/farms';

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'cust-123',
          email: 'customer@agritrace.dev',
          role: 'CUSTOMER',
          full_name: 'Customer Test',
          language_preference: 'en',
          onboarding_completed: true,
        },
        firebaseUser: null,
        loading: false,
        login: vi.fn(),
        signup: vi.fn(),
        loginWithGoogle: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(
        <DashboardLayout portal="farmer">
          <div data-testid="farm-form">Secret Farm Registration Form</div>
        </DashboardLayout>
      );

      // Child form must NEVER be rendered for CUSTOMER
      expect(screen.queryByTestId('farm-form')).not.toBeInTheDocument();
      // Must display Access Denied
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      // Must redirect to /customer/dashboard
      expect(mockReplace).toHaveBeenCalledWith('/customer/dashboard');
    });

    it('blocks a VENDOR navigating to /farmer/crops and redirects them to /vendor/dashboard', () => {
      mockCurrentPath = '/farmer/crops';

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'vendor-456',
          email: 'vendor@agritrace.dev',
          role: 'VENDOR',
          full_name: 'Vendor Test',
          language_preference: 'en',
          onboarding_completed: true,
        },
        firebaseUser: null,
        loading: false,
        login: vi.fn(),
        signup: vi.fn(),
        loginWithGoogle: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(
        <DashboardLayout portal="farmer">
          <div data-testid="crop-form">Crop Planting Form</div>
        </DashboardLayout>
      );

      expect(screen.queryByTestId('crop-form')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(mockReplace).toHaveBeenCalledWith('/vendor/dashboard');
    });

    it('permits a verified VENDOR on /vendor/dashboard without redirecting to farmer portal', () => {
      mockCurrentPath = '/vendor/dashboard';

      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'vendor-789',
          email: 'vendor@agritrace.dev',
          role: 'VENDOR',
          full_name: 'Verified Vendor',
          language_preference: 'en',
          onboarding_completed: true,
        },
        firebaseUser: null,
        loading: false,
        login: vi.fn(),
        signup: vi.fn(),
        loginWithGoogle: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(
        <DashboardLayout portal="vendor">
          <div data-testid="vendor-content">Vendor Inventory godown controls</div>
        </DashboardLayout>
      );

      expect(screen.getByTestId('vendor-content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
