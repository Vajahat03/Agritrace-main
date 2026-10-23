import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FarmerFarmsPage from '../app/farmer/farms/page';
import FarmerCropsPage from '../app/farmer/crops/page';
import { apiClient } from '../lib/apiClient';
import * as authContext from '../context/AuthContext';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
  }),
  usePathname: () => '/farmer/farms',
}));

vi.mock('../components/Navbar', () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock('../components/Sidebar', () => ({
  Sidebar: ({ portal }: { portal: string }) => <div data-testid="sidebar">{portal} sidebar</div>,
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: { commodities: {}, common: { viewDetails: 'View Details' } },
    translateCommodity: (id: string) => id,
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Farm Registration & Crop Creation Frontend Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'farmer-101',
        email: 'farmer@agritrace.dev',
        full_name: 'Farmer John',
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
      getIdToken: vi.fn().mockResolvedValue('token-123'),
      switchDemoRole: vi.fn(),
      updateUserProfile: vi.fn(),
      isConfigured: true,
    });
  });

  it('submits location_name and numeric total_area when creating a farm', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [] } as any);
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        id: 'farm-new-1',
        name: 'Krishna Valley Agro',
        location_name: 'Satara, Maharashtra',
        total_area: 12.5,
        area_unit: 'acres',
      },
    } as any);

    render(<FarmerFarmsPage />);

    // Open Add Farm Modal
    await waitFor(() => {
      const addBtns = screen.getAllByText(/Register.*Farm/i);
      expect(addBtns.length).toBeGreaterThan(0);
      fireEvent.click(addBtns[0]);
    });

    // Fill form
    const nameInput = screen.getByPlaceholderText(/e\.g\. Green Meadows/i);
    const locInput = screen.getByPlaceholderText(/e\.g\. Nashik, Maharashtra/i);
    const areaInput = screen.getByDisplayValue('5');

    fireEvent.change(nameInput, { target: { value: 'Krishna Valley Agro' } });
    fireEvent.change(locInput, { target: { value: 'Satara, Maharashtra' } });
    fireEvent.change(areaInput, { target: { value: '12.5' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Farm/i });
    fireEvent.click(saveBtn);
    fireEvent.submit(saveBtn.closest('form')!);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/farmer/farms', expect.objectContaining({
        name: 'Krishna Valley Agro',
        location_name: 'Satara, Maharashtra',
        total_area: 12.5,
        area_unit: 'acres',
      }));
    });
  });

  it('submits crop_type, planting_date, and numeric area when creating a crop', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/farmer/farms')) {
        return {
          data: [{ id: 'farm-001', name: 'Krishna Valley Agro', location_name: 'Satara' }],
        } as any;
      }
      return { data: [] } as any;
    });

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        id: 'crop-new-1',
        crop_type: 'Tomato',
        planting_date: '2026-04-15',
        variety: 'Roma Supreme',
        area: 3.5,
      },
    } as any);

    render(<FarmerCropsPage />);

    // Open Plant Crop Modal
    await waitFor(() => {
      const plantBtns = screen.getAllByText(/Plant.*Crop/i);
      expect(plantBtns.length).toBeGreaterThan(0);
      fireEvent.click(plantBtns[0]);
    });

    // Fill form
    const varietyInput = screen.getByPlaceholderText(/e\.g\. Roma/i);
    const areaInput = screen.getByDisplayValue('2');
    const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0]);

    fireEvent.change(varietyInput, { target: { value: 'Roma Supreme' } });
    fireEvent.change(areaInput, { target: { value: '3.5' } });
    fireEvent.change(dateInput, { target: { value: '2026-04-15' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Save Crop Record/i });
    fireEvent.click(submitBtn);
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith('/farmer/crops', expect.objectContaining({
        crop_type: 'Tomato',
        planting_date: '2026-04-15',
        variety: 'Roma Supreme',
        area: 3.5,
        area_unit: 'acres',
      }));
    });
  });

  it('renders farms properly when GET /farmer/farms returns a FastAPI envelope { success: true, data: [...] }', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'farm-123',
            name: 'Sahyadri Agro Estate',
            location_name: 'Nashik, Maharashtra',
            total_area: 15.5,
            area_unit: 'acres',
            address: 'Dindori Road',
            soil_info: 'Black Cotton',
          },
        ],
      },
    } as any);

    render(<FarmerFarmsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sahyadri Agro Estate')).toBeDefined();
      expect(screen.getByText(/Nashik, Maharashtra/)).toBeDefined();
    });
  });

  it('renders crops properly when GET /farmer/crops returns a FastAPI envelope { success: true, data: [...] }', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/farmer/farms')) {
        return { data: { success: true, data: [] } } as any;
      }
      return {
        data: {
          success: true,
          data: [
            {
              id: 'crop-456',
              farmer_id: 'farmer-101',
              crop_type: 'Onion',
              variety: 'Nashik Red',
              area: 2.5,
              area_unit: 'acres',
              planting_date: '2026-04-01',
              status: 'GROWING',
            },
          ],
        },
      } as any;
    });

    render(<FarmerCropsPage />);

    await waitFor(() => {
      expect(screen.getByText('Onion')).toBeDefined();
      expect(screen.getByText('Nashik Red')).toBeDefined();
    });
  });

  it('shows error banner and does NOT show false success when crop creation fails', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: { success: true, data: [] },
    } as any);

    vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Farm ownership validation failed'));

    render(<FarmerCropsPage />);

    // Open Modal
    await waitFor(() => {
      const plantBtns = screen.getAllByText(/Plant.*Crop/i);
      fireEvent.click(plantBtns[0]);
    });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Save Crop Record/i });
    fireEvent.click(submitBtn);
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      // Must show the real error
      expect(screen.getByText(/Farm ownership validation failed/i)).toBeDefined();
      // Must NOT show false success
      expect(screen.queryByText(/New crop added to your farm holdings/i)).toBeNull();
    });
  });
});
