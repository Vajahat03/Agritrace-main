'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { apiClient, extractApiArray } from '../../../lib/apiClient';
import { Farm, Plot } from '../../../types';
import { Tractor, Layers, PlusCircle, MapPin, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function FarmerFarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isAddFarmOpen, setIsAddFarmOpen] = useState(false);
  const [farmForm, setFarmForm] = useState({
    name: '',
    locationName: '',
    address: '',
    totalArea: 5,
    areaUnit: 'acres',
    soilInfo: 'Black Clay Loam',
    notes: '',
  });

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/farmer/farms');
      const farmList = extractApiArray<Farm>(res);
      setFarms(farmList);
    } catch (err: any) {
      console.warn('Could not fetch farms:', err);
      setFarms([]);
      setFeedback({
        type: 'error',
        message: err?.message || 'Could not fetch farms from server.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmForm.name.trim()) {
      setFeedback({ type: 'error', message: 'Farm name is required.' });
      return;
    }
    if (!farmForm.locationName.trim()) {
      setFeedback({ type: 'error', message: 'Location / District is required.' });
      return;
    }
    const areaNum = Number(farmForm.totalArea);
    if (isNaN(areaNum) || areaNum <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid farm area greater than 0.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const payload = {
        name: farmForm.name.trim(),
        location_name: farmForm.locationName.trim(),
        locationName: farmForm.locationName.trim(),
        total_area: areaNum,
        totalArea: areaNum,
        area_unit: farmForm.areaUnit || 'acres',
        areaUnit: farmForm.areaUnit || 'acres',
        address: farmForm.address.trim() || undefined,
        soil_info: farmForm.soilInfo.trim() || undefined,
      };
      const res: any = await apiClient.post('/farmer/farms', payload);
      const createdFarm = res?.data?.data || res?.data;
      if (!createdFarm || !createdFarm.id) {
        throw new Error('Farm registration response did not return a valid saved record.');
      }

      setIsAddFarmOpen(false);
      setFarmForm({
        name: '',
        locationName: '',
        address: '',
        totalArea: 5,
        areaUnit: 'acres',
        soilInfo: 'Black Clay Loam',
        notes: '',
      });
      setFeedback({
        type: 'success',
        message: `Farm "${createdFarm.name}" registered and persisted successfully!`,
      });
      await loadFarms();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Error saving farm: ' + (err.message || 'Please check your connection and retry.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      portal="farmer"
      title="Farm & Plot Management"
      subtitle="Organize land holdings, field plot subdivisions, soil profiles, and geographic coordinates."
      actionButton={
        <button
          onClick={() => setIsAddFarmOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-[#081C15] font-bold text-xs shadow-glow hover:bg-emerald-400 transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Register New Farm</span>
        </button>
      }
    >
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`mb-6 p-4 rounded-2xl flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 transition-opacity text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-emerald-400">Loading farms from database...</div>
      ) : farms.length === 0 ? (
        <div className="rounded-3xl glass-card p-12 text-center border border-emerald-800/40 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <Tractor className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Farms Registered Yet</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            You haven&apos;t added any farms to your profile. Click &quot;Register New Farm&quot; to add your land holding and begin planting crops.
          </p>
          <button
            onClick={() => setIsAddFarmOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-[#081C15] font-bold text-xs shadow-glow hover:bg-emerald-400 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Register Your First Farm</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {farms.map((farm) => (
            <div key={farm.id} className="rounded-3xl glass-card p-6 border border-emerald-800/40 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Tractor className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{farm.name}</h3>
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {farm.location_name}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-semibold text-xs">
                  {farm.total_area} {farm.area_unit}
                </span>
              </div>

              <div className="rounded-xl bg-emerald-950/40 p-3.5 border border-emerald-900/50 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-emerald-400/70">Address:</span>
                  <span className="text-white text-right">{farm.address || farm.location_name || 'Registered Farm'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-400/70">Soil Profile:</span>
                  <span className="text-emerald-300 text-right">{farm.soil_info || 'Standard Loam'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddFarmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl glass-card border border-emerald-500/30 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-emerald-800/50 pb-3">
              <h3 className="text-base font-bold text-white">Register New Farm</h3>
              <button onClick={() => setIsAddFarmOpen(false)} className="text-emerald-400/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFarm} className="space-y-4 text-xs">
              <div>
                <label className="block text-emerald-300 font-medium mb-1">Farm Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Green Meadows Agro Farm"
                  value={farmForm.name}
                  onChange={(e) => setFarmForm({ ...farmForm, name: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Location / District *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nashik, Maharashtra"
                    value={farmForm.locationName}
                    onChange={(e) => setFarmForm({ ...farmForm, locationName: e.target.value })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Total Area & Unit *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={farmForm.totalArea}
                      onChange={(e) => setFarmForm({ ...farmForm, totalArea: Number(e.target.value) })}
                      className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                    />
                    <select
                      value={farmForm.areaUnit}
                      onChange={(e) => setFarmForm({ ...farmForm, areaUnit: e.target.value })}
                      className="rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-2 py-2 text-white text-xs"
                    >
                      <option value="acres">Acres</option>
                      <option value="hectares">Hectares</option>
                      <option value="bigha">Bigha</option>
                      <option value="guntha">Guntha</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-emerald-300 font-medium mb-1">Soil Information</label>
                <input
                  type="text"
                  placeholder="e.g. Black Clay Loam with Drip Layout"
                  value={farmForm.soilInfo}
                  onChange={(e) => setFarmForm({ ...farmForm, soilInfo: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-emerald-900/50">
                <button
                  type="button"
                  onClick={() => setIsAddFarmOpen(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-[#081C15] font-bold shadow-glow hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{submitting ? 'Saving...' : 'Save Farm'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
