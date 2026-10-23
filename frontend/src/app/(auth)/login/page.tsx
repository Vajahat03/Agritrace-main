'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { UserRole } from '../../../types';
import { Sprout, LogIn, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';

import { getDashboardRouteForRole } from '../../../lib/roleRouting';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('FARMER');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const navigateByRole = (selectedRole: UserRole | string | null | undefined) => {
    router.push(getDashboardRouteForRole(selectedRole));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const userProfile = await login(email, password, role);
      if (userProfile && userProfile.onboarding_completed === false) {
        router.push('/onboarding');
      } else if (userProfile?.role) {
        navigateByRole(userProfile.role);
      } else {
        navigateByRole(role);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const userProfile = await loginWithGoogle(role);
      if (userProfile && userProfile.onboarding_completed === false) {
        router.push('/onboarding');
      } else if (userProfile?.role) {
        navigateByRole(userProfile.role);
      } else {
        navigateByRole(role);
      }
    } catch (err: any) {
      setError(err.message || 'Google sign-in could not be completed.');
    } finally {
      setGoogleLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-8 space-y-6 shadow-xs">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1">
            <Sprout className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sign In to AgriTrace</h1>
          <p className="text-xs text-slate-600">
            Access your agricultural workspace and traceability ledger
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* Google OAuth Button */}
        <div>
          <button
            type="button"
            disabled={loading || googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all disabled:opacity-60"
            aria-label="Sign in with Google"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full"></div>
          <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            or email
          </span>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label htmlFor="login-email" className="block text-slate-700 font-medium mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@agritrace.dev"
                disabled={loading || googleLoading}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="block text-slate-700 font-medium">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading || googleLoading}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-10 py-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="login-role" className="block text-slate-700 font-medium mb-1">
              Target Workspace Portal
            </label>
            <select
              id="login-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={loading || googleLoading}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none font-medium transition-colors"
            >
              <option value="FARMER">Farmer Portal (Kisan Dashboard & Crops)</option>
              <option value="VENDOR">Vendor Portal (Wholesale Inventory & Orders)</option>
              <option value="CUSTOMER">Customer Portal (Marketplace & Freshness Bag)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-emerald-700 font-semibold hover:underline">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
