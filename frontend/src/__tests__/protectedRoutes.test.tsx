import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DashboardLayout } from '../components/DashboardLayout';
import * as authContext from '../context/AuthContext';

const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
  usePathname: () => '/farmer/dashboard',
}));

vi.mock('../components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock('../components/Sidebar', () => ({
  Sidebar: ({ portal }: { portal: string }) => <div data-testid="sidebar">{portal} sidebar</div>,
}));

describe('DashboardLayout Protected Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when auth is loading', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      firebaseUser: null,
      loading: true,
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
        <div>Protected Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Loading AgriTrace workspace...')).toBeInTheDocument();
  });

  it('redirects to /login and displays expired session message when user is unauthenticated', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
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
        <div>Protected Content</div>
      </DashboardLayout>
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(screen.getByText('Your session has expired')).toBeInTheDocument();
    expect(screen.getByText('Please sign in again to access the Vendor workspace.')).toBeInTheDocument();
  });

  it('redirects mismatched user role to their authorized dashboard', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'user-1',
        email: 'customer@agritrace.dev',
        full_name: 'Priya',
        role: 'CUSTOMER',
        language_preference: 'en',
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
        <div>Farmer Content</div>
      </DashboardLayout>
    );

    expect(mockReplace).toHaveBeenCalledWith('/customer/dashboard');
  });

  it('renders protected children when user role matches portal', () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'user-farmer-1',
        email: 'farmer@agritrace.dev',
        full_name: 'Ramesh Patil',
        role: 'FARMER',
        language_preference: 'en',
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
        <div data-testid="protected-content">Authorized Farmer Portal</div>
      </DashboardLayout>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('Authorized Farmer Portal')).toBeInTheDocument();
  });
});
