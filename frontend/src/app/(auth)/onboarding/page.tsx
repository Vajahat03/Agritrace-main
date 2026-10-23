'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { UserRole } from '../../../types';
import {
  Sprout,
  Store,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User,
  Phone,
  MapPin,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

import { getDashboardRouteForRole } from '../../../lib/roleRouting';

export default function OnboardingPage() {
  const { user, loading, completeOnboarding } = useAuth();
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<UserRole>('FARMER');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial full name if user is already loaded
  useEffect(() => {
    if (user?.full_name && !fullName) {
      setFullName(user.full_name);
    }
  }, [user, fullName]);

  // If user is already onboarded, redirect immediately to their dashboard
  useEffect(() => {
    if (!loading && user) {
      if (user.onboarding_completed === true) {
        router.replace(getDashboardRouteForRole(user.role));
      }
    } else if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please provide your full name.');
      return;
    }

    setSubmitting(true);
    try {
      if (!completeOnboarding) {
        throw new Error('Onboarding service is not initialized.');
      }
      const updatedProfile = await completeOnboarding({
        role: selectedRole,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });

      // Route directly to chosen role workspace
      router.push(getDashboardRouteForRole(updatedProfile.role));
    } catch (err: any) {
      setError(err?.message || 'Could not complete onboarding. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500 font-medium">Verifying account credentials...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4 py-12">
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-8 sm:p-10 space-y-8 shadow-xs">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 mb-1">
            <Sprout className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Complete Your AgriTrace Setup
          </h1>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Choose your primary role to configure your dedicated workspace, permission ledger, and traceability tools.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-3"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Cards Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              Select Your Workspace Role *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Farmer Card */}
              <button
                type="button"
                onClick={() => setSelectedRole('FARMER')}
                className={`flex flex-col text-left p-4 rounded-2xl border-2 transition-all relative cursor-pointer ${
                  selectedRole === 'FARMER'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      selectedRole === 'FARMER'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <Sprout className="h-5 w-5" />
                  </div>
                  {selectedRole === 'FARMER' && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Farmer (Kisan)</h3>
                <span className="text-[11px] font-semibold text-emerald-700 mb-1">
                  Cultivator & Producer
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Mint produce batches, manage farm plots, generate QR labels, and log cultivation inputs.
                </p>
              </button>

              {/* Vendor Card */}
              <button
                type="button"
                onClick={() => setSelectedRole('VENDOR')}
                className={`flex flex-col text-left p-4 rounded-2xl border-2 transition-all relative cursor-pointer ${
                  selectedRole === 'VENDOR'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      selectedRole === 'VENDOR'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <Store className="h-5 w-5" />
                  </div>
                  {selectedRole === 'VENDOR' && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Vendor (Vyapari)</h3>
                <span className="text-[11px] font-semibold text-amber-700 mb-1">
                  Wholesale & Storage
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Procure harvests directly from farmers, maintain warehouse inventory, and distribute stock.
                </p>
              </button>

              {/* Customer Card */}
              <button
                type="button"
                onClick={() => setSelectedRole('CUSTOMER')}
                className={`flex flex-col text-left p-4 rounded-2xl border-2 transition-all relative cursor-pointer ${
                  selectedRole === 'CUSTOMER'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      selectedRole === 'CUSTOMER'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  {selectedRole === 'CUSTOMER' && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Customer (Grahak)</h3>
                <span className="text-[11px] font-semibold text-blue-700 mb-1">
                  Consumer & Buyer
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                  Shop verified farm-to-table produce, inspect harvest QR codes, and monitor fresh items.
                </p>
              </button>
            </div>
          </div>

          {/* Profile Details */}
          <div className="space-y-4 pt-2 border-t border-slate-100 text-xs">
            <div>
              <label htmlFor="onboarding-name" className="block text-slate-700 font-medium mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="onboarding-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  disabled={submitting}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="onboarding-phone" className="block text-slate-700 font-medium mb-1">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="onboarding-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98230 11223"
                    disabled={submitting}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="onboarding-address" className="block text-slate-700 font-medium mb-1">
                  Farm Plot or Business Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    id="onboarding-address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Village/City, District, State"
                    disabled={submitting}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Configuring Your Workspace...</span>
                </>
              ) : (
                <>
                  <span>Confirm Role & Open Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2.5 flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Role assignment is cryptographically locked with your verified account</span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
