import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FarmerProfilePage from '../app/farmer/profile/page';
import CustomerProfilePage from '../app/customer/profile/page';
import { apiClient } from '../lib/apiClient';
import * as authContext from '../context/AuthContext';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => mockUsePathname(),
}));

vi.mock('../components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock('../components/Sidebar', () => ({
  Sidebar: ({ portal }: { portal: string }) => <div data-testid="sidebar">{portal} sidebar</div>,
}));

describe('Profile Save & Truthful Error Handling', () => {
  const mockUpdateUserProfile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue('/farmer/profile');
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'user-001',
        email: 'farmer@agritrace.dev',
        full_name: 'Original Farmer Name',
        role: 'FARMER',
        phone: '+91 99999 88888',
        address: 'Old Farm Road',
        language_preference: 'en',
      },
      firebaseUser: null,
      loading: false,
      login: vi.fn(),
      signup: vi.fn(),
      loginWithGoogle: vi.fn(),
      resetPassword: vi.fn(),
      logout: vi.fn(),
      getIdToken: vi.fn().mockResolvedValue('valid-firebase-id-token'),
      switchDemoRole: vi.fn(),
      updateUserProfile: mockUpdateUserProfile,
      isConfigured: true,
    });

    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: {} } as any);
    vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: {} } as any);
  });

  describe('Farmer Profile Save', () => {
    it('validates required full name before attempting save', async () => {
      render(<FarmerProfilePage />);

      const nameInput = screen.getByPlaceholderText(/Ramesh Patil/i);
      fireEvent.change(nameInput, { target: { value: '   ' } });

      const submitBtn = screen.getByRole('button', { name: /Save Farmer Profile/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Full name cannot be empty.')).toBeInTheDocument();
      });
      expect(apiClient.patch).not.toHaveBeenCalled();
    });

    it('successfully calls PATCH /auth/profile, updates user context, and shows success', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: {
          full_name: 'Updated Ramesh Patil',
          phone: '+91 98230 11223',
          address: 'New Farm Location, Dindori',
          role: 'FARMER',
        },
      } as any);

      render(<FarmerProfilePage />);

      const nameInput = screen.getByPlaceholderText(/Ramesh Patil/i);
      fireEvent.change(nameInput, { target: { value: 'Updated Ramesh Patil' } });

      const submitBtn = screen.getByRole('button', { name: /Save Farmer Profile/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(patchSpy).toHaveBeenCalledWith('/auth/profile', expect.objectContaining({
          fullName: 'Updated Ramesh Patil',
          role: 'FARMER',
        }));
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(expect.objectContaining({
          full_name: 'Updated Ramesh Patil',
        }));
        expect(screen.getByText(/Farmer profile updated successfully!/i)).toBeInTheDocument();
      });
    });

    it('reports truthful backend disconnection error instead of simulated success', async () => {
      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce({
        message: 'Backend disconnected: Unable to connect to API server at http://localhost:5000/api/v1. Ensure the backend service is running.',
        isBackendDisconnected: true,
        code: 'BACKEND_DISCONNECTED',
      });

      render(<FarmerProfilePage />);

      const submitBtn = screen.getByRole('button', { name: /Save Farmer Profile/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Backend disconnected: Unable to connect/i)).toBeInTheDocument();
      });
      expect(mockUpdateUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('Customer Profile Save Error Reporting', () => {
    it('displays truthful server error rather than blanket fallback error message', async () => {
      mockUsePathname.mockReturnValue('/customer/profile');
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-cust-001',
          email: 'customer@agritrace.dev',
          full_name: 'Priya Sharma',
          role: 'CUSTOMER',
          phone: '+91 98112 33445',
          address: 'Bandra West, Mumbai',
          language_preference: 'en',
        },
        firebaseUser: null,
        loading: false,
        login: vi.fn(),
        signup: vi.fn(),
        loginWithGoogle: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn().mockResolvedValue('valid-firebase-id-token'),
        switchDemoRole: vi.fn(),
        updateUserProfile: mockUpdateUserProfile,
        isConfigured: true,
      });

      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce({
        message: 'Database persistence service is unavailable (scheduled for Phase 4)',
        statusCode: 503,
      });

      render(<CustomerProfilePage />);

      const submitBtn = screen.getByRole('button', { name: /Save Customer Profile/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Database persistence service is unavailable (scheduled for Phase 4)')).toBeInTheDocument();
      });
      expect(screen.queryByText('Failed to save customer profile.')).not.toBeInTheDocument();
    });
  });
});
