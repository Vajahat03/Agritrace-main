import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FarmerDirectory } from '../components/FarmerDirectory';
import { VendorDirectory } from '../components/VendorDirectory';
import { apiClient } from '../lib/apiClient';
import * as authContext from '../context/AuthContext';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => '/vendor/farmers',
}));

vi.mock('../components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock('../components/Sidebar', () => ({
  Sidebar: ({ portal }: { portal: string }) => <div data-testid="sidebar">{portal} sidebar</div>,
}));

describe('Directory Authentication, Cards, and Search Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FarmerDirectory in Vendor Portal', () => {
    beforeEach(() => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-vendor-1',
          email: 'vendor@agritrace.dev',
          full_name: 'Test Vendor',
          role: 'VENDOR',
          language_preference: 'en',
        },
        firebaseUser: null,
        loading: false,
        login: vi.fn(),
        signup: vi.fn(),
        loginWithGoogle: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn().mockResolvedValue('test-id-token'),
        switchDemoRole: vi.fn(),
        updateUserProfile: vi.fn(),
        isConfigured: true,
      });
    });

    it('requests /vendor/farmers in vendor portal and renders real records', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [
          {
            id: 'real-farmer-1',
            full_name: 'Baburao Deshmukh',
            address: 'Nashik Shivar',
            farm_count: 1,
            farms: [],
            crops: [{ id: 'c1', crop_type: 'Onion', variety: 'Nashik Red', status: 'GROWING' }],
          },
        ],
      } as any);

      render(<FarmerDirectory portal="vendor" />);

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith('/vendor/farmers');
        expect(screen.getByText('Baburao Deshmukh')).toBeInTheDocument();
      });
      // Should NOT render fabricated records like "Ramesh Patil"
      expect(screen.queryByText('Ramesh Patil (Kisan)')).not.toBeInTheDocument();
    });

    it('renders honest empty state when directory response is empty (no fake fallbacks)', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [],
      } as any);

      render(<FarmerDirectory portal="vendor" />);

      await waitFor(() => {
        expect(screen.getByText('No registered farmers found')).toBeInTheDocument();
      });
      expect(screen.queryByText('Ramesh Patil (Kisan)')).not.toBeInTheDocument();
      expect(screen.queryByText('Suresh Gaikwad')).not.toBeInTheDocument();
    });

    it('displays truthful JWT signature verification failure without fallback', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        message: 'invalid JWT: unable to parse or verify signature, token signature is invalid: signing method RS256 is invalid',
        statusCode: 401,
      });

      render(<FarmerDirectory portal="vendor" />);

      await waitFor(() => {
        expect(screen.getByText(/signing method RS256 is invalid/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Ramesh Patil (Kisan)')).not.toBeInTheDocument();
    });

    it('displays backend disconnected error when backend server is unavailable', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        message: 'Backend disconnected: Unable to connect to API server at http://localhost:5000/api/v1. Ensure the backend service is running.',
        isBackendDisconnected: true,
        code: 'BACKEND_DISCONNECTED',
      });

      render(<FarmerDirectory portal="vendor" />);

      await waitFor(() => {
        expect(screen.getByText(/Backend disconnected/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Ramesh Patil (Kisan)')).not.toBeInTheDocument();
    });

    it('renders cards with farm name, area, crops, and safe contact action', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [
          {
            id: 'farmer-101',
            full_name: 'Anand Patil',
            farm_name: 'Green Oasis Farm',
            total_area: 8.5,
            area_unit: 'acres',
            location_name: 'Dindori, Nashik',
            phone: '+91 98220 12345',
            crops_grown: ['Tomatoes', 'Capsicum'],
            farms: [
              { id: 'f-1', name: 'Green Oasis Farm', location_name: 'Dindori, Nashik', total_area: 8.5, area_unit: 'acres' },
            ],
            crops: [
              { id: 'c-1', crop_type: 'Tomatoes', variety: 'Roma', status: 'GROWING', area: 5, area_unit: 'acres', planting_date: '2026-08-01' },
            ],
          },
        ],
      } as any);

      render(<FarmerDirectory portal="vendor" />);

      await waitFor(() => {
        expect(screen.getByText('Anand Patil')).toBeInTheDocument();
        expect(screen.getByText('Green Oasis Farm')).toBeInTheDocument();
        expect(screen.getByText('8.5 acres')).toBeInTheDocument();
        expect(screen.getByText('+91 98220 12345')).toBeInTheDocument();
      });

      // Verify contact link has tel:
      const contactLink = screen.getByRole('link', { name: /contact/i });
      expect(contactLink).toHaveAttribute('href', 'tel:+91 98220 12345');

      // Click "View Profile" to open modal
      const viewProfileBtn = screen.getByRole('button', { name: /view profile/i });
      fireEvent.click(viewProfileBtn);

      expect(screen.getByText('Registered Farm Holdings & Plots:')).toBeInTheDocument();
      expect(screen.getByText('Standing Produce & Crops Currently Growing:')).toBeInTheDocument();
    });

    it('displays "No registered farmers match your search." on search mismatch and clears filters', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [
          {
            id: 'farmer-101',
            full_name: 'Anand Patil',
            farm_name: 'Green Oasis Farm',
            location_name: 'Dindori, Nashik',
            crops_grown: ['Tomatoes'],
          },
        ],
      } as any);

      render(<FarmerDirectory portal="vendor" />);

      await waitFor(() => {
        expect(screen.getByText('Anand Patil')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by farmer name/i);
      fireEvent.change(searchInput, { target: { value: 'NonExistentXYZ' } });

      expect(screen.getByText('No registered farmers match your search.')).toBeInTheDocument();

      // Click Clear Filters
      const clearBtn = screen.getAllByRole('button', { name: /clear filters/i })[0];
      fireEvent.click(clearBtn);

      expect(screen.getByText('Anand Patil')).toBeInTheDocument();
    });
  });

  describe('VendorDirectory in Farmer Portal', () => {
    beforeEach(() => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        user: {
          id: 'user-farmer-1',
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
        getIdToken: vi.fn().mockResolvedValue('test-id-token'),
        switchDemoRole: vi.fn(),
        updateUserProfile: vi.fn(),
        isConfigured: true,
      });
    });

    it('requests /farmer/vendors in farmer portal and renders real records', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [
          {
            id: 'real-v-1',
            full_name: 'MahaAgro Mandi Depot',
            address: 'Pune Yard',
            inventory_count: 5,
          },
        ],
      } as any);

      render(<VendorDirectory portal="farmer" />);

      await waitFor(() => {
        expect(getSpy).toHaveBeenCalledWith('/farmer/vendors');
        expect(screen.getByText('MahaAgro Mandi Depot')).toBeInTheDocument();
      });
      expect(screen.queryByText('ABC Agro Store & Mandi Traders')).not.toBeInTheDocument();
    });

    it('renders honest empty state when vendor directory is empty (no fake fallbacks)', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [],
      } as any);

      render(<VendorDirectory portal="farmer" />);

      await waitFor(() => {
        expect(screen.getByText('No registered vendors found')).toBeInTheDocument();
      });
      expect(screen.queryByText('ABC Agro Store & Mandi Traders')).not.toBeInTheDocument();
      expect(screen.queryByText('FreshDirect Organics Pvt Ltd')).not.toBeInTheDocument();
    });

    it('displays truthful JWT signature verification failure in vendor directory', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        message: 'invalid JWT: unable to parse or verify signature, token signature is invalid: signing method RS256 is invalid',
        statusCode: 401,
      });

      render(<VendorDirectory portal="farmer" />);

      await waitFor(() => {
        expect(screen.getByText(/signing method RS256 is invalid/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('ABC Agro Store & Mandi Traders')).not.toBeInTheDocument();
    });

    it('renders vendor cards with business name, godown, category, and safe contact action', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        data: [
          {
            id: 'vendor-201',
            full_name: 'Rajesh Shah',
            business_name: 'Sahyadri Agro Cold-Storage',
            godown_name: 'APMC Godown #14',
            business_type: 'Cold Chain Wholesaler',
            address: 'Vashi, Navi Mumbai',
            phone: '+91 99200 54321',
            product_interests: ['Grapes', 'Pomegranate'],
            inventory_count: 4,
          },
        ],
      } as any);

      render(<VendorDirectory portal="farmer" />);

      await waitFor(() => {
        expect(screen.getByText('Sahyadri Agro Cold-Storage')).toBeInTheDocument();
      });
      expect(screen.getAllByText('APMC Godown #14').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Cold Chain Wholesaler').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('+91 99200 54321')).toBeInTheDocument();
      expect(screen.getByText('Grapes')).toBeInTheDocument();

      // Verify contact link has tel:
      const contactLink = screen.getByRole('link', { name: /contact/i });
      expect(contactLink).toHaveAttribute('href', 'tel:+91 99200 54321');
    });

    it('displays "No registered vendors match your search." on search mismatch and clears filters', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        data: [
          {
            id: 'vendor-201',
            full_name: 'Rajesh Shah',
            business_name: 'Sahyadri Agro Cold-Storage',
            godown_name: 'APMC Godown #14',
            address: 'Vashi, Navi Mumbai',
          },
        ],
      } as any);

      render(<VendorDirectory portal="farmer" />);

      await waitFor(() => {
        expect(screen.getByText('Sahyadri Agro Cold-Storage')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by vendor name/i);
      fireEvent.change(searchInput, { target: { value: 'NonExistentVendorQuery' } });

      expect(screen.getByText('No registered vendors match your search.')).toBeInTheDocument();

      // Click Clear Filters
      const clearBtn = screen.getAllByRole('button', { name: /clear filters/i })[0];
      fireEvent.click(clearBtn);

      expect(screen.getByText('Sahyadri Agro Cold-Storage')).toBeInTheDocument();
    });
  });
});
