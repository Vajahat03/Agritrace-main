import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import VendorInventoryPage from '../app/vendor/inventory/page';
import FarmerBatchesPage from '../app/farmer/batches/page';
import { apiClient } from '../lib/apiClient';

vi.mock('../lib/apiClient', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', role: 'VENDOR', full_name: 'Test User' },
    loading: false,
    authState: 'AUTHENTICATED',
    getIdToken: vi.fn().mockResolvedValue('valid-token'),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/vendor/inventory',
}));

vi.mock('../components/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    language: 'en',
    setLanguage: vi.fn(),
    translateCommodity: (c: string) => c,
  }),
}));

describe('Farmers and Vendors Inventory Loading and State Transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Vendor Inventory Page', () => {
    it('displays loading state, then honest empty state when backend returns empty inventory', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });

      render(<VendorInventoryPage />);

      // Initially displays loading
      expect(screen.getByText(/loading inventory ledger/i)).toBeDefined();

      // Transitions to honest empty state (not infinite loading)
      await waitFor(() => {
        expect(screen.getByText(/no inventory items in stock/i)).toBeDefined();
      });
      expect(screen.queryByText(/loading inventory ledger/i)).toBeNull();
    });

    it('displays error banner and offers working Retry when backend fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Backend connection refused'));

      render(<VendorInventoryPage />);

      await waitFor(() => {
        expect(screen.getByText(/backend connection refused/i)).toBeDefined();
      });

      // Does not hang in loading state
      expect(screen.queryByText(/loading inventory ledger/i)).toBeNull();

      // Click retry
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [
          {
            id: 'inv-101',
            vendor_id: 'vendor-1',
            product_name: 'Organic Wheat',
            crop_type: 'Wheat',
            quantity: 50,
            unit: 'quintal',
            status: 'IN_STOCK',
            location: 'Silo 4',
          },
        ],
      });

      const retryBtn = screen.getByText('Retry');
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('Organic Wheat')).toBeDefined();
      });
    });
  });

  describe('Farmer Produce Batches Page', () => {
    it('displays loading state, then honest empty state when farmer has no batches', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });

      render(<FarmerBatchesPage />);

      expect(screen.getByText(/loading produce batches ledger/i)).toBeDefined();

      await waitFor(() => {
        expect(screen.getByText(/no produce batches minted yet/i)).toBeDefined();
      });
      expect(screen.queryByText(/loading produce batches ledger/i)).toBeNull();
    });

    it('displays error banner and offers working Retry when farmer batches API fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('503 Service Unavailable'));

      render(<FarmerBatchesPage />);

      await waitFor(() => {
        expect(screen.getByText(/503 service unavailable/i)).toBeDefined();
      });

      // Does not hang in infinite loading
      expect(screen.queryByText(/loading produce batches ledger/i)).toBeNull();

      // Click retry
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: [
          {
            id: 'batch-1',
            farmer_id: 'farmer-1',
            batch_code: 'BAT-2026-TOM-01',
            crop_type: 'Tomato',
            variety: 'Roma',
            initial_quantity: 100,
            current_quantity: 100,
            unit: 'kg',
            harvest_date: '2026-10-10',
            current_status: 'MINTED',
          },
        ],
      });

      const retryBtn = screen.getByText('Retry');
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('BAT-2026-TOM-01')).toBeDefined();
      });
    });
  });
});
