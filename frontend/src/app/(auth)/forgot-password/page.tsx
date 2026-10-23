'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { Sprout, Mail, ArrowLeft, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your account email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resetPassword(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Could not send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-8 space-y-6 shadow-xs">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reset Password</h1>
          <p className="text-xs text-slate-600">
            Enter your email to receive a password reset link
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5 text-center">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Reset Link Sent</span>
              </div>
              <p className="leading-relaxed">
                We have dispatched a password reset instruction link to{' '}
                <span className="font-semibold text-emerald-950">{email}</span>.
              </p>
              <p className="text-[11px] text-emerald-800/80">
                Please check your inbox (and spam folder) to set a new password.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
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

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label htmlFor="reset-email" className="block text-slate-700 font-medium mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@agritrace.dev"
                    disabled={loading}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Sending Instructions...' : 'Send Password Reset Link'}</span>
              </button>
            </form>

            <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-100">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
