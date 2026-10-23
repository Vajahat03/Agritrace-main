import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as firebaseClient from '../lib/firebaseClient';

vi.mock('../lib/firebaseClient', () => {
  return {
    isFirebaseConfigured: true,
    subscribeToAuthState: vi.fn((callback) => {
      callback(null);
      return vi.fn();
    }),
    loginWithEmail: vi.fn(),
    registerWithEmail: vi.fn(),
    loginWithGoogle: vi.fn(),
    sendPasswordReset: vi.fn(),
    logoutUser: vi.fn(),
    getCurrentUserIdToken: vi.fn(),
    formatFirebaseAuthError: vi.fn((err: any) => err?.message || 'Auth error'),
  };
});

vi.mock('../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockRejectedValue(new Error('Backend offline')),
    post: vi.fn().mockRejectedValue(new Error('Backend offline')),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

function TestConsumer() {
  const { user, loading, authState, logout, switchDemoRole } = useAuth();
  return (
    <div>
      <div data-testid="loading-state">{loading ? 'LOADING' : 'READY'}</div>
      <div data-testid="auth-state">{authState}</div>
      <div data-testid="user-email">{user?.email || 'ANONYMOUS'}</div>
      <div data-testid="user-role">{user?.role || 'NONE'}</div>
      <button onClick={() => switchDemoRole('FARMER')}>Set Farmer</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe('AuthContext and Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with loading false and anonymous user when no session exists', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading-state').textContent).toBe('READY');
    expect(screen.getByTestId('auth-state').textContent).toBe('UNAUTHENTICATED');
    expect(screen.getByTestId('user-email').textContent).toBe('ANONYMOUS');
    expect(screen.getByTestId('user-role').textContent).toBe('NONE');
  });

  it('switches demo role and updates profile state', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('Set Farmer').click();
    });

    expect(screen.getByTestId('user-role').textContent).toBe('FARMER');
    expect(screen.getByTestId('user-email').textContent).toBe('farmer@agritrace.dev');
    expect(screen.getByTestId('auth-state').textContent).toBe('AUTHENTICATED');
  });

  it('logs out user and clears state', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('Set Farmer').click();
    });
    expect(screen.getByTestId('user-role').textContent).toBe('FARMER');

    await act(async () => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('user-email').textContent).toBe('ANONYMOUS');
    expect(screen.getByTestId('user-role').textContent).toBe('NONE');
    expect(screen.getByTestId('auth-state').textContent).toBe('UNAUTHENTICATED');
  });

  it('hydrates stored profile instantly without hanging on backend failure', async () => {
    const cachedProfile = {
      id: 'uid-farmer-777',
      email: 'farmer777@agritrace.dev',
      full_name: 'Kisan Patil',
      role: 'FARMER',
    };
    localStorage.setItem('agritrace_user_profile_uid-farmer-777', JSON.stringify(cachedProfile));

    vi.mocked(firebaseClient.subscribeToAuthState).mockImplementationOnce((callback: any) => {
      callback({ uid: 'uid-farmer-777', email: 'farmer777@agritrace.dev' });
      return vi.fn();
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Immediately hydrated from cache
    expect(screen.getByTestId('loading-state').textContent).toBe('READY');
    expect(screen.getByTestId('auth-state').textContent).toBe('AUTHENTICATED');
    expect(screen.getByTestId('user-email').textContent).toBe('farmer777@agritrace.dev');
    expect(screen.getByTestId('user-role').textContent).toBe('FARMER');
  });
});
