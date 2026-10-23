import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FarmerFertilizersPage from '../app/farmer/fertilizers/page';
import { apiClient } from '../lib/apiClient';
import * as authContext from '../context/AuthContext';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => '/farmer/fertilizers',
}));

vi.mock('../components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock('../components/Sidebar', () => ({
  Sidebar: ({ portal }: { portal: string }) => <div data-testid="sidebar">{portal} sidebar</div>,
}));

describe('Farmer Fertilizers Page & Application Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'farmer-test-1',
        email: 'farmer@agritrace.dev',
        full_name: 'Test Farmer',
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
      getIdToken: vi.fn().mockResolvedValue('test-farmer-token'),
      switchDemoRole: vi.fn(),
      updateUserProfile: vi.fn(),
      isConfigured: true,
    });
  });

  it('renders honest empty state when no fertilizer records exist without fabricating demo records', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/farmer/crops') {
        return {
          data: [
            {
              id: 'crop-101',
              crop_type: 'Tomato',
              variety: 'Roma',
              area: 2.5,
              area_unit: 'acres',
              planting_date: '2026-08-01',
              status: 'GROWING',
            },
          ],
        } as any;
      }
      if (url.includes('/fertilizers')) {
        return { data: [] } as any;
      }
      return { data: [] } as any;
    });

    render(<FarmerFertilizersPage />);

    await waitFor(() => {
      expect(screen.getByText('No fertilizer records logged yet')).toBeInTheDocument();
      expect(screen.getByText('0 records found')).toBeInTheDocument();
    });

    // Should NOT contain fabricated fallback records
    expect(screen.queryByText('NPK 19:19:19 Complex')).not.toBeInTheDocument();
    expect(screen.queryByText('Urea (Prilled 46% N)')).not.toBeInTheDocument();
  });

  it('submits fertilizer application to POST /farmer/crops/{cropId}/fertilizers', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/farmer/crops') {
        return {
          data: [
            {
              id: 'crop-101',
              crop_type: 'Tomato',
              variety: 'Roma',
              status: 'GROWING',
            },
          ],
        } as any;
      }
      if (url.includes('/fertilizers')) {
        return { data: [] } as any;
      }
      return { data: [] } as any;
    });

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        id: 'fert-new-1',
        crop_id: 'crop-101',
        fertilizer_name: 'Organic Compost',
        quantity: 50,
      },
    } as any);

    render(<FarmerFertilizersPage />);

    await waitFor(() => {
      expect(screen.getByText('Log First Application')).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText('Log First Application'));

    // Fill form
    const nameInput = screen.getByPlaceholderText(/e\.g\. Urea, NPK 19:19:19/i);
    fireEvent.change(nameInput, { target: { value: 'Organic Compost' } });

    // Submit form
    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/farmer/crops/crop-101/fertilizers',
        expect.objectContaining({
          fertilizerName: 'Organic Compost',
          quantity: 25,
          method: 'SOIL',
        })
      );
    });
  });
});
