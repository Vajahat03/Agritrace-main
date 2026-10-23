import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../app/(auth)/login/page';
import SignupPage from '../app/(auth)/signup/page';
import ForgotPasswordPage from '../app/(auth)/forgot-password/page';
import * as authContext from '../context/AuthContext';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe('Authentication Screens', () => {
  const mockLogin = vi.fn();
  const mockSignup = vi.fn();
  const mockResetPassword = vi.fn();
  const mockLoginWithGoogle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: null,
      firebaseUser: null,
      loading: false,
      login: mockLogin,
      signup: mockSignup,
      loginWithGoogle: mockLoginWithGoogle,
      resetPassword: mockResetPassword,
      logout: vi.fn(),
      getIdToken: vi.fn(),
      switchDemoRole: vi.fn(),
      isConfigured: true,
    });
  });

  describe('LoginPage', () => {
    it('renders login inputs and controls', () => {
      render(<LoginPage />);

      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password$/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Target Workspace Portal/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sign In$/ })).toBeInTheDocument();
    });

    it('toggles password visibility with accessible button', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByLabelText(/^Password$/);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button', { name: /Show password/i });
      fireEvent.click(toggleBtn);

      expect(passwordInput).toHaveAttribute('type', 'text');
    });

    it('submits login form and navigates on success', async () => {
      mockLogin.mockResolvedValueOnce(undefined);
      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'farmer@agritrace.dev' } });
      fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /^Sign In$/ }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('farmer@agritrace.dev', 'password123', 'FARMER');
        expect(mockPush).toHaveBeenCalledWith('/farmer/dashboard');
      });
    });

    it('displays error message when login fails', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Invalid email or password.'));
      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'wrong@agritrace.dev' } });
      fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByRole('button', { name: /^Sign In$/ }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
      });
    });
  });

  describe('SignupPage', () => {
    it('validates password match on registration', async () => {
      render(<SignupPage />);

      fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: 'Test Farmer' } });
      fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: 'new@agritrace.dev' } });
      fireEvent.change(screen.getByLabelText(/Password \(min 6 chars\) \*/i), { target: { value: 'secret123' } });
      fireEvent.change(screen.getByLabelText(/Confirm Password \*/i), { target: { value: 'different123' } });
      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Passwords do not match/i);
        expect(mockSignup).not.toHaveBeenCalled();
      });
    });

    it('submits signup when valid', async () => {
      mockSignup.mockResolvedValueOnce(undefined);
      render(<SignupPage />);

      fireEvent.change(screen.getByLabelText(/Full Name \*/i), { target: { value: 'Test Farmer' } });
      fireEvent.change(screen.getByLabelText(/Email Address \*/i), { target: { value: 'new@agritrace.dev' } });
      fireEvent.change(screen.getByLabelText(/Password \(min 6 chars\) \*/i), { target: { value: 'secret123' } });
      fireEvent.change(screen.getByLabelText(/Confirm Password \*/i), { target: { value: 'secret123' } });
      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));

      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/farmer/dashboard');
      });
    });
  });

  describe('ForgotPasswordPage', () => {
    it('submits email and displays success confirmation', async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      render(<ForgotPasswordPage />);

      fireEvent.change(screen.getByLabelText(/Registered Email Address/i), { target: { value: 'farmer@agritrace.dev' } });
      fireEvent.click(screen.getByRole('button', { name: /Send Password Reset Link/i }));

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('farmer@agritrace.dev');
        expect(screen.getByText(/Reset Link Sent/i)).toBeInTheDocument();
      });
    });
  });
});
