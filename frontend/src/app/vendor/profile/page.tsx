'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../lib/apiClient';
import {
  Store,
  Phone,
  MapPin,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  Package,
  Truck,
  ShieldCheck,
} from 'lucide-react';

export default function VendorProfilePage() {
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
    businessType: 'Wholesale Mandi Trader & Stockist',
    gstin: '27AABCU9603R1ZM',
  });

  const [vendorStats, setVendorStats] = useState({
    inventoryCount: 4,
    pendingOrdersCount: 2,
    totalProcurements: 3,
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [meRes, dashRes]: any = await Promise.all([
        apiClient.get('/auth/me'),
        apiClient.get('/vendor/dashboard').catch(() => null),
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
        setVendorStats({
          inventoryCount: dashRes.data.metrics.inventoryCount || 4,
          pendingOrdersCount: dashRes.data.metrics.pendingOrdersCount || 2,
          totalProcurements: dashRes.data.metrics.totalProcurements || 3,
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
      setErrorMsg('Business or full name cannot be empty.');
      setSaving(false);
      return;
    }

    try {
      const res: any = await apiClient.patch('/auth/profile', {
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        languagePreference: formData.languagePreference,
        role: 'VENDOR',
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
      setSuccessMsg('Vendor business profile updated successfully! Changes are live on marketplace.');
      if (res?.data) {
        setFormData((prev) => ({
          ...prev,
          fullName: res.data.full_name || prev.fullName,
          phone: res.data.phone || prev.phone,
          address: res.data.address || prev.address,
        }));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || err?.response?.data?.error?.message || 'Failed to save vendor profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      portal="vendor"
      title="Vendor Store Profile"
      subtitle="Manage your APMC mandi store details, public contact numbers, and procurement channels."
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
        {/* Vendor Summary Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center space-y-4">
            <div className="w-20 h-20 bg-amber-100 border-2 border-amber-200 text-amber-800 rounded-full mx-auto flex items-center justify-center font-bold text-2xl">
              {formData.fullName ? formData.fullName.charAt(0) : 'V'}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{formData.fullName || 'Registered Vendor Store'}</h3>
              <p className="text-xs text-slate-500 font-medium">{user?.email}</p>
              <div className="inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                <span>Verified APMC Vendor</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Inventory</span>
                <span className="font-bold text-slate-800 text-base">{vendorStats.inventoryCount}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Orders</span>
                <span className="font-bold text-amber-700 text-base">{vendorStats.pendingOrdersCount}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Procured</span>
                <span className="font-bold text-slate-800 text-base">{vendorStats.totalProcurements}</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 text-xs text-amber-950 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-amber-900">
              <Store className="h-4 w-4 text-amber-700" />
              Public Marketplace Listing
            </h4>
            <p className="text-amber-900/80 leading-relaxed">
              Your registered store profile is discoverable by Farmers searching for input/procurement partners and
              Customers browsing verified produce suppliers.
            </p>
          </div>
        </div>

        {/* Form Controls */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-bold text-slate-900 text-base">Store Identity & Trading Information</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Maintain accurate business contact information for farmers and logistics transporters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5 text-amber-600" />
                  Business / Store Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. FreshDirect Organics Pvt Ltd"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-amber-600" />
                  Business Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 99341 55667"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-600" />
                  Store / Godown Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Shop 14, APMC Market Yard, Dindori Road, Nashik, Maharashtra 422004"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-amber-600" />
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

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Business Category</label>
                <input
                  type="text"
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving Profile...' : 'Save Vendor Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
