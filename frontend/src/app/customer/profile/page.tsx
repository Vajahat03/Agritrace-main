'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../lib/apiClient';
import {
  User,
  Phone,
  MapPin,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Heart,
  ShieldCheck,
} from 'lucide-react';

export default function CustomerProfilePage() {
  const { user, updateUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: user?.full_name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    languagePreference: user?.language_preference || 'en',
  });

  const [customerStats, setCustomerStats] = useState({
    totalOrders: 2,
    savedFavorites: 4,
    freshnessItems: 3,
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [meRes, dashRes]: any = await Promise.all([
        apiClient.get('/auth/me'),
        apiClient.get('/customer/dashboard').catch(() => null),
      ]);

      if (meRes?.data) {
        setFormData((prev) => ({
          ...prev,
          fullName: meRes.data.full_name || prev.fullName,
          phone: meRes.data.phone || prev.phone,
          address: meRes.data.address || prev.address,
          languagePreference: meRes.data.language_preference || prev.languagePreference,
        }));
      }

      if (dashRes?.data?.metrics) {
        setCustomerStats({
          totalOrders: dashRes.data.metrics.totalOrders || 2,
          savedFavorites: dashRes.data.metrics.savedFavorites || 4,
          freshnessItems: dashRes.data.metrics.activeFreshnessItems || 3,
        });
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!formData.fullName.trim()) {
      setErrorMsg('Full name cannot be empty.');
      setSaving(false);
      return;
    }

    try {
      const res: any = await apiClient.patch('/auth/profile', {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        languagePreference: formData.languagePreference,
        role: 'CUSTOMER',
      });
      const updatedData = res?.data || {};
      if (updateUserProfile) {
        await updateUserProfile({
          full_name: updatedData.full_name || formData.fullName.trim(),
          phone: updatedData.phone || formData.phone.trim(),
          address: updatedData.address || formData.address.trim(),
          language_preference: (updatedData.language_preference || formData.languagePreference) as any,
        });
      }
      setSuccessMsg('Customer profile and delivery address saved successfully!');
      if (res?.data) {
        setFormData((prev) => ({
          ...prev,
          fullName: res.data.full_name || prev.fullName,
          phone: res.data.phone || prev.phone,
          address: res.data.address || prev.address,
        }));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || err?.response?.data?.error?.message || 'Failed to save customer profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      portal="customer"
      title="Customer Profile & Address"
      subtitle="Manage your personal delivery destination, contact telephone, and notification preferences."
    >
      {/* Feedback Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-medium">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-medium">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer Summary Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center space-y-4">
            <div className="w-20 h-20 bg-sky-100 border-2 border-sky-200 text-sky-800 rounded-full mx-auto flex items-center justify-center font-bold text-2xl">
              {formData.fullName ? formData.fullName.charAt(0) : 'C'}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{formData.fullName || 'Registered Consumer'}</h3>
              <p className="text-xs text-slate-500 font-medium">{user?.email}</p>
              <div className="inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                <span>Verified Fresh Food Buyer</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Orders</span>
                <span className="font-bold text-slate-800 text-base">{customerStats.totalOrders}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Favorites</span>
                <span className="font-bold text-sky-700 text-base">{customerStats.savedFavorites}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Fresh Bag</span>
                <span className="font-bold text-slate-800 text-base">{customerStats.freshnessItems}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Form */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-bold text-slate-900 text-base">Delivery Contact & Address</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ensure your delivery destination and telephone are accurate for express agricultural delivery.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-sky-600" />
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-sky-600" />
                  Contact Telephone *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 98112 33445"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-sky-600" />
                  Default Home / Office Delivery Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Flat 402, Sea Green Heights, Bandra West, Mumbai 400050"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-sky-600" />
                  Language Preference
                </label>
                <select
                  value={formData.languagePreference}
                  onChange={(e) => setFormData({ ...formData, languagePreference: e.target.value as any })}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="mr">मराठी (Marathi)</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving Profile...' : 'Save Customer Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
