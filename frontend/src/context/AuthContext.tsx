'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  sendPasswordReset,
  logoutUser,
  subscribeToAuthState,
  getCurrentUserIdToken,
  formatFirebaseAuthError,
  isFirebaseConfigured,
} from '../lib/firebaseClient';
import { apiClient } from '../lib/apiClient';
import { UserProfile, UserRole, Language } from '../types';
import { useRouter } from 'next/navigation';
import { User as FirebaseUser } from 'firebase/auth';
import { normalizeRole, getDashboardRouteForRole } from '../lib/roleRouting';

/**
 * SECURITY ARCHITECTURE:
 * -----------------------
 * Roles: FARMER, VENDOR, CUSTOMER, BUYER, TRANSPORTER, ADMIN.
 * Role selection during onboarding is submitted to POST /api/v1/auth/onboarding.
 * The backend cryptographically validates the Firebase ID token and locks the role
 * on the server.
 */

export type AuthState = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'ERROR';

export interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  authState?: AuthState;
  authError?: string | null;
  login: (email: string, password: string, role?: UserRole) => Promise<UserProfile>;
  signup: (data: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    phone?: string;
    address?: string;
  }) => Promise<UserProfile>;
  loginWithGoogle: (preferredRole?: UserRole) => Promise<UserProfile>;
  completeOnboarding?: (data: {
    role: UserRole;
    fullName?: string;
    phone?: string;
    address?: string;
    languagePreference?: Language;
  }) => Promise<UserProfile>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  switchDemoRole: (role: UserRole) => void;
  updateUserProfile?: (updates: Partial<UserProfile>) => Promise<void>;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_PREFIX = 'agritrace_user_profile_';
const DEMO_USER_STORAGE = 'agritrace_demo_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authState, setAuthState] = useState<AuthState>('INITIALIZING');
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  // Load persisted client profile or sync with backend
  const resolveProfile = useCallback(async (fbUser: FirebaseUser, candidateRole?: UserRole): Promise<UserProfile> => {
    let localStored: UserProfile | null = null;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${USER_STORAGE_PREFIX}${fbUser.uid}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id === fbUser.uid) {
            localStored = parsed;
          }
        }
      } catch (err) {
        console.warn('[AgriTrace Auth] Could not parse stored user profile:', err);
      }
    }

    // 1. Fetch authoritative profile from backend /auth/me with 4000ms timeout
    try {
      const res: any = await apiClient.get('/auth/me', { timeout: 4000 });
      const profileData = res?.data?.data || res?.data;
      if (profileData && profileData.id) {
        const canonicalRole =
          (candidateRole ? normalizeRole(candidateRole) : null) ||
          normalizeRole(profileData.role) ||
          'CUSTOMER';

        // If the backend indicates onboarding is NOT completed and no explicit role was selected:
        if (profileData.onboarding_completed === false && !candidateRole) {
          const uncompletedProfile: UserProfile = {
            id: fbUser.uid,
            email: fbUser.email || '',
            full_name: profileData.full_name || fbUser.displayName || 'AgriTrace User',
            role: canonicalRole,
            language_preference: 'en',
            avatar_url: fbUser.photoURL || undefined,
            onboarding_completed: false,
          };
          return uncompletedProfile;
        }

        // Return verified profile with active role
        const completedProfile: UserProfile = {
          id: profileData.id,
          email: profileData.email || fbUser.email || '',
          full_name: profileData.full_name || fbUser.displayName || 'AgriTrace User',
          role: canonicalRole,
          phone: profileData.phone,
          address: profileData.address,
          language_preference: profileData.language_preference || 'en',
          avatar_url: fbUser.photoURL || undefined,
          onboarding_completed: true,
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(`${USER_STORAGE_PREFIX}${fbUser.uid}`, JSON.stringify(completedProfile));
        }
        return completedProfile;
      }
    } catch {
      // Backend not running or timed out; proceed with local metadata safely
    }

    // 2. Return local stored profile if valid
    if (localStored) {
      return localStored;
    }

    // 3. Fallback for new Google/Firebase user before onboarding
    const normalizedCandidate = candidateRole ? normalizeRole(candidateRole) : null;
    const fallbackProfile: UserProfile = {
      id: fbUser.uid,
      email: fbUser.email || '',
      full_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'AgriTrace User',
      role: normalizedCandidate || 'CUSTOMER',
      language_preference: 'en',
      avatar_url: fbUser.photoURL || undefined,
      onboarding_completed: normalizedCandidate ? true : false,
    };

    if (typeof window !== 'undefined' && normalizedCandidate) {
      try {
        localStorage.setItem(`${USER_STORAGE_PREFIX}${fbUser.uid}`, JSON.stringify(fallbackProfile));
      } catch {}
    }

    return fallbackProfile;
  }, []);

  // Initialize Firebase Auth-State Observer
  useEffect(() => {
    let isMounted = true;

    // Safety timeout ensures the UI never hangs indefinitely if network stalls
    const safetyTimer = window.setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        setAuthState((prev) => (prev === 'INITIALIZING' ? (user ? 'AUTHENTICATED' : 'UNAUTHENTICATED') : prev));
      }
    }, 3500);

    const unsubscribe = subscribeToAuthState(async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        setFirebaseUser(fbUser);
        // Instant optimistic hydration from localStorage so dashboard renders immediately
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem(`${USER_STORAGE_PREFIX}${fbUser.uid}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && parsed.id === fbUser.uid) {
                setUser(parsed);
                setAuthState('AUTHENTICATED');
                setLoading(false);
              }
            }
          } catch {}
        }

        try {
          const profile = await resolveProfile(fbUser);
          if (isMounted) {
            setUser(profile);
            setAuthState('AUTHENTICATED');
            setAuthError(null);
          }
        } catch (err: any) {
          console.warn('[AgriTrace Auth] Profile resolution failed:', err);
          if (isMounted) {
            setAuthError(err?.message || 'Profile resolution error');
          }
        }
      } else {
        setFirebaseUser(null);
        // Only load demo user if DEMO_MODE is explicitly enabled and no Firebase session exists
        if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && typeof window !== 'undefined') {
          const savedDemo = localStorage.getItem(DEMO_USER_STORAGE);
          if (savedDemo) {
            try {
              if (isMounted) {
                setUser(JSON.parse(savedDemo));
                setAuthState('AUTHENTICATED');
              }
            } catch {}
          } else {
            if (isMounted) {
              setUser(null);
              setAuthState('UNAUTHENTICATED');
            }
          }
        } else {
          if (isMounted) {
            setUser(null);
            setAuthState('UNAUTHENTICATED');
          }
        }
      }

      if (isMounted) setLoading(false);
      window.clearTimeout(safetyTimer);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [resolveProfile]);

  const login = async (email: string, password: string, role?: UserRole): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      const fbUser = await loginWithEmail(email, password);
      setFirebaseUser(fbUser);
      // Sync selected role to backend MongoDB
      if (role) {
        try {
          await apiClient.post('/auth/sync-profile', { role }, { timeout: 3500 });
        } catch (syncErr) {
          console.warn('[AgriTrace Auth] Sync profile role on login warning:', syncErr);
        }
      }
      const profile = await resolveProfile(fbUser, role);
      setUser(profile);
      setAuthState('AUTHENTICATED');
      return profile;
    } catch (err: any) {
      const message = formatFirebaseAuthError(err);
      setAuthError(message);
      setAuthState('ERROR');
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (data: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    phone?: string;
    address?: string;
  }): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      const fbUser = await registerWithEmail(data.email, data.password, data.fullName);
      setFirebaseUser(fbUser);

      const newProfile: UserProfile = {
        id: fbUser.uid,
        email: data.email,
        full_name: data.fullName,
        role: data.role,
        language_preference: 'en',
        phone: data.phone,
        address: data.address,
        onboarding_completed: true,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(`${USER_STORAGE_PREFIX}${fbUser.uid}`, JSON.stringify(newProfile));
      }

      // Sync to backend if service is available
      try {
        await apiClient.post(
          '/auth/sync-profile',
          {
            fullName: data.fullName,
            role: data.role,
            phone: data.phone,
            address: data.address,
          },
          { timeout: 3000 }
        );
      } catch {
        // Backend sync is optional during standalone frontend tests
      }

      setUser(newProfile);
      setAuthState('AUTHENTICATED');
      return newProfile;
    } catch (err: any) {
      const message = formatFirebaseAuthError(err);
      setAuthError(message);
      setAuthState('ERROR');
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (preferredRole?: UserRole): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      const fbUser = await loginWithGoogle();
      setFirebaseUser(fbUser);
      if (preferredRole) {
        try {
          await apiClient.post('/auth/sync-profile', { role: preferredRole }, { timeout: 3500 });
        } catch (syncErr) {
          console.warn('[AgriTrace Auth] Sync profile role on Google login warning:', syncErr);
        }
      }
      const profile = await resolveProfile(fbUser, preferredRole);
      setUser(profile);
      setAuthState('AUTHENTICATED');
      return profile;
    } catch (err: any) {
      const message = formatFirebaseAuthError(err);
      setAuthError(message);
      setAuthState('ERROR');
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async (data: {
    role: UserRole;
    fullName?: string;
    phone?: string;
    address?: string;
    languagePreference?: Language;
  }): Promise<UserProfile> => {
    setLoading(true);
    setAuthError(null);
    try {
      const res: any = await apiClient.post('/auth/onboarding', {
        role: data.role,
        fullName: data.fullName,
        phone: data.phone,
        address: data.address,
        languagePreference: data.languagePreference || 'en',
      });

      const profileData = res?.data?.data || res?.data || {};
      const completedProfile: UserProfile = {
        id: profileData.id || firebaseUser?.uid || '',
        email: profileData.email || firebaseUser?.email || '',
        full_name: profileData.full_name || data.fullName || 'AgriTrace User',
        role: profileData.role || data.role,
        phone: profileData.phone || data.phone,
        address: profileData.address || data.address,
        language_preference: profileData.language_preference || data.languagePreference || 'en',
        avatar_url: firebaseUser?.photoURL || undefined,
        onboarding_completed: true,
      };

      setUser(completedProfile);
      setAuthState('AUTHENTICATED');
      if (typeof window !== 'undefined' && completedProfile.id) {
        localStorage.setItem(`${USER_STORAGE_PREFIX}${completedProfile.id}`, JSON.stringify(completedProfile));
      }
      return completedProfile;
    } catch (err: any) {
      const message = err?.message || 'Role onboarding could not be completed.';
      setAuthError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordReset(email);
    } catch (err: any) {
      const message = formatFirebaseAuthError(err);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.warn('[AgriTrace Auth] Sign-out warning:', err);
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DEMO_USER_STORAGE);
    }
    setUser(null);
    setFirebaseUser(null);
    setAuthState('UNAUTHENTICATED');
    router.push('/login');
  };

  const getIdToken = async (): Promise<string | null> => {
    return getCurrentUserIdToken();
  };

  const switchDemoRole = (role: UserRole) => {
    const demoProfiles: Record<UserRole, UserProfile> = {
      FARMER: {
        id: 'demo-farmer-001',
        email: 'farmer@agritrace.dev',
        full_name: 'Ramesh Patil (Kisan)',
        role: 'FARMER',
        language_preference: 'en',
        phone: '+91 98230 11223',
        address: 'Green Meadows Farm, Nashik, Maharashtra',
        onboarding_completed: true,
      },
      VENDOR: {
        id: 'demo-vendor-002',
        email: 'vendor@agritrace.dev',
        full_name: 'FreshDirect Organics (Vendor)',
        role: 'VENDOR',
        language_preference: 'en',
        phone: '+91 99341 55667',
        address: 'Vashi APMC Market, Navi Mumbai',
        onboarding_completed: true,
      },
      CUSTOMER: {
        id: 'demo-customer-003',
        email: 'customer@agritrace.dev',
        full_name: 'Priya Sharma (Consumer)',
        role: 'CUSTOMER',
        language_preference: 'en',
        phone: '+91 98112 33445',
        address: 'Bandra West, Mumbai, Maharashtra 400050',
        onboarding_completed: true,
      },
      BUYER: {
        id: 'demo-buyer-004',
        email: 'buyer@agritrace.dev',
        full_name: 'Wholesale Agri Buyer',
        role: 'BUYER',
        language_preference: 'en',
        onboarding_completed: true,
      },
      TRANSPORTER: {
        id: 'demo-transporter-005',
        email: 'logistics@agritrace.dev',
        full_name: 'ColdChain Agro Logistics',
        role: 'TRANSPORTER',
        language_preference: 'en',
        onboarding_completed: true,
      },
      ADMIN: {
        id: 'demo-admin-006',
        email: 'admin@agritrace.dev',
        full_name: 'AgriTrace Platform Administrator',
        role: 'ADMIN',
        language_preference: 'en',
        onboarding_completed: true,
      },
    };

    const newProfile = demoProfiles[role] || demoProfiles.CUSTOMER;
    setUser(newProfile);
    setAuthState('AUTHENTICATED');
    setLoading(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_USER_STORAGE, JSON.stringify(newProfile));
    }

    router.push(getDashboardRouteForRole(role));
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    if (firebaseUser && typeof window !== 'undefined') {
      localStorage.setItem(`${USER_STORAGE_PREFIX}${firebaseUser.uid}`, JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        authState,
        authError,
        login,
        signup,
        loginWithGoogle: handleGoogleSignIn,
        completeOnboarding,
        resetPassword,
        logout,
        getIdToken,
        switchDemoRole,
        updateUserProfile,
        isConfigured: isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
