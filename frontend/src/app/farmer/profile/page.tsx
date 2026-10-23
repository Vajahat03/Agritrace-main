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
  Tractor,
  Sprout,
  ShieldCheck,
  Building,
} from 'lucide-react';

export default function FarmerProfilePage() {
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
    farmName: 'Green Meadows Farm',
    totalArea: '5.5',
    areaUnit: 'acre',
    soilType: 'Clay Loam (Black Soil)',
  });

  const [farmerStats, setFarmerStats] = useState({
    totalFarms: 1,
    totalCrops: 3,
    activeBatches: 2,
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const [meRes, dashRes]: any = await Promise.all([
        apiClient.get('/auth/me'),
        apiClient.get('/farmer/dashboard').catch(() => null),
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
        setFarmerStats({
          totalFarms: dashRes.data.metrics.totalFarms || 1,
          totalCrops: dashRes.data.metrics.totalActiveCrops || 3,
          activeBatches: dashRes.data.metrics.activeBatches || 2,
        });
      }
    } catch {
      // Keep local defaults
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
        role: 'FARMER',
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
      setSuccessMsg('Farmer profile updated successfully! Changes are visible across the marketplace.');
      if (res?.data) {
        setFormData((prev) => ({
          ...prev,
          fullName: res.data.full_name || prev.fullName,
          phone: res.data.phone || prev.phone,
          address: res.data.address || prev.address,
        }));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || err?.response?.data?.error?.message || 'Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      portal="farmer"
      title="My Farmer Profile"
      subtitle="Manage your registered farm credentials, contact telephone, and marketplace discoverability."
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
        {/* Profile Card & Stats Summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 border-2 border-emerald-200 text-emerald-700 rounded-full mx-auto flex items-center justify-center font-bold text-2xl">
              {formData.fullName ? formData.fullName.charAt(0) : 'F'}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{formData.fullName || 'Registered Farmer'}</h3>
              <p className="text-xs text-slate-500 font-medium">{user?.email}</p>
              <div className="inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Verified Farmer Producer</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Farms</span>
                <span className="font-bold text-slate-800 text-base">{farmerStats.totalFarms}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Active Crops</span>
                <span className="font-bold text-emerald-700 text-base">{farmerStats.totalCrops}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 font-medium block">Batches</span>
                <span className="font-bold text-slate-800 text-base">{farmerStats.activeBatches}</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 text-xs text-emerald-900 space-y-2">
            <h4 className="font-bold flex items-center gap-1.5 text-emerald-950">
              <Sprout className="h-4 w-4 text-emerald-700" />
              Public Marketplace Discoverability
            </h4>
            <p className="text-emerald-800/80 leading-relaxed">
              When your profile is complete with your Name, Contact Telephone, and Address, registered Vendors and
              Customers can discover your farm and contact you for crop procurement.
            </p>
          </div>
        </div>

        {/* Profile Edit Form */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-bold text-slate-900 text-base">Farmer Contact & Farm Information</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your identity details and farm location to keep buyers informed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-emerald-600" />
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Ramesh Patil"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 98230 11223"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  Farm Location & Village Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Green Meadows Farm, Post Dindori, Nashik, Maharashtra 422003"
                  className="w-full rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  Preferred Language
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
                <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                  <Tractor className="h-3.5 w-3.5 text-emerald-600" />
                  Primary Farm Name
                </label>
                <input
                  type="text"
                  value={formData.farmName}
                  onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
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
                <span>{saving ? 'Saving Profile...' : 'Save Farmer Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
