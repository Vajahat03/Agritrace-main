import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from '../app/(auth)/onboarding/page';
import LoginPage from '../app/(auth)/login/page';
import SignupPage from '../app/(auth)/signup/page';
import * as AuthContextModule from '../context/AuthContext';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => '/onboarding',
}));

describe('Google Sign-In and Role-Selection Onboarding Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login & Signup Google Sign-In Redirection', () => {
    it('redirects new Google user with onboarding_completed=false to /onboarding', async () => {
      const mockLoginWithGoogle = vi.fn().mockResolvedValue({
        id: 'new-google-user',
        email: 'newuser@google.com',
        full_name: 'New Google User',
        role: 'CUSTOMER',
        onboarding_completed: false,
      });

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        loginWithGoogle: mockLoginWithGoogle,
        login: vi.fn(),
        signup: vi.fn(),
        completeOnboarding: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<LoginPage />);

      const googleBtn = screen.getByLabelText(/sign in with google/i);
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(mockLoginWithGoogle).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/onboarding');
      });
    });

    it('preserves returning Google user role and navigates directly to their dashboard', async () => {
      const mockLoginWithGoogle = vi.fn().mockResolvedValue({
        id: 'returning-farmer',
        email: 'farmer@google.com',
        full_name: 'Ramesh Patil (Kisan)',
        role: 'FARMER',
        onboarding_completed: true,
      });

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        loginWithGoogle: mockLoginWithGoogle,
        login: vi.fn(),
        signup: vi.fn(),
        completeOnboarding: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<LoginPage />);

      const googleBtn = screen.getByLabelText(/sign in with google/i);
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(mockLoginWithGoogle).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/farmer/dashboard');
      });
    });

    it('navigates returning Vendor user directly to vendor dashboard', async () => {
      const mockLoginWithGoogle = vi.fn().mockResolvedValue({
        id: 'returning-vendor',
        email: 'vendor@google.com',
        full_name: 'FreshDirect Organics',
        role: 'VENDOR',
        onboarding_completed: true,
      });

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: null,
        firebaseUser: null,
        loading: false,
        loginWithGoogle: mockLoginWithGoogle,
        login: vi.fn(),
        signup: vi.fn(),
        completeOnboarding: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<SignupPage />);

      const googleBtn = screen.getByLabelText(/register with google/i);
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(mockLoginWithGoogle).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/vendor/dashboard');
      });
    });
  });

  describe('Onboarding Page Component', () => {
    it('renders Farmer, Vendor, and Customer role choices and submits Farmer role', async () => {
      const mockCompleteOnboarding = vi.fn().mockResolvedValue({
        id: 'user-123',
        role: 'FARMER',
        full_name: 'Ramesh New Farmer',
        onboarding_completed: true,
      });

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: {
          id: 'user-123',
          email: 'test@google.com',
          full_name: 'Ramesh New Farmer',
          role: 'CUSTOMER',
          language_preference: 'en',
          onboarding_completed: false,
        },
        firebaseUser: null,
        loading: false,
        completeOnboarding: mockCompleteOnboarding,
        loginWithGoogle: vi.fn(),
        login: vi.fn(),
        signup: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<OnboardingPage />);

      expect(screen.getByText(/complete your agritrace setup/i)).toBeDefined();
      expect(screen.getByText(/farmer \(kisan\)/i)).toBeDefined();
      expect(screen.getByText(/vendor \(vyapari\)/i)).toBeDefined();
      expect(screen.getByText(/customer \(grahak\)/i)).toBeDefined();

      // Click confirm button
      const submitBtn = screen.getByText(/confirm role & open workspace/i);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCompleteOnboarding).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'FARMER',
            fullName: 'Ramesh New Farmer',
          })
        );
        expect(mockPush).toHaveBeenCalledWith('/farmer/dashboard');
      });
    });

    it('allows selecting Vendor role and navigates to vendor dashboard', async () => {
      const mockCompleteOnboarding = vi.fn().mockResolvedValue({
        id: 'user-456',
        role: 'VENDOR',
        full_name: 'Suresh Vendor',
        onboarding_completed: true,
      });

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: {
          id: 'user-456',
          email: 'suresh@google.com',
          full_name: 'Suresh Vendor',
          role: 'CUSTOMER',
          language_preference: 'en',
          onboarding_completed: false,
        },
        firebaseUser: null,
        loading: false,
        completeOnboarding: mockCompleteOnboarding,
        loginWithGoogle: vi.fn(),
        login: vi.fn(),
        signup: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<OnboardingPage />);

      // Select Vendor card
      const vendorCard = screen.getByText(/vendor \(vyapari\)/i);
      fireEvent.click(vendorCard);

      const submitBtn = screen.getByText(/confirm role & open workspace/i);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockCompleteOnboarding).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'VENDOR',
          })
        );
        expect(mockPush).toHaveBeenCalledWith('/vendor/dashboard');
      });
    });

    it('redirects already onboarded users away from /onboarding to their dashboard', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: {
          id: 'user-already-done',
          email: 'done@test.com',
          full_name: 'Already Onboarded',
          role: 'FARMER',
          language_preference: 'en',
          onboarding_completed: true,
        },
        firebaseUser: null,
        loading: false,
        completeOnboarding: vi.fn(),
        loginWithGoogle: vi.fn(),
        login: vi.fn(),
        signup: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<OnboardingPage />);

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/farmer/dashboard');
      });
    });

    it('displays error banner when completeOnboarding fails', async () => {
      const mockCompleteOnboarding = vi.fn().mockRejectedValue(new Error('Network error during onboarding'));

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: {
          id: 'user-error',
          email: 'err@test.com',
          full_name: 'Error Tester',
          role: 'CUSTOMER',
          language_preference: 'en',
          onboarding_completed: false,
        },
        firebaseUser: null,
        loading: false,
        completeOnboarding: mockCompleteOnboarding,
        loginWithGoogle: vi.fn(),
        login: vi.fn(),
        signup: vi.fn(),
        resetPassword: vi.fn(),
        logout: vi.fn(),
        getIdToken: vi.fn(),
        switchDemoRole: vi.fn(),
        isConfigured: true,
      });

      render(<OnboardingPage />);

      const submitBtn = screen.getByText(/confirm role & open workspace/i);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/network error during onboarding/i)).toBeDefined();
      });
    });
  });
});
