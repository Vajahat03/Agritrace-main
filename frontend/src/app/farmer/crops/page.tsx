'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { CropCard } from '../../../components/CropCard';
import { FertilizerModal } from '../../../components/FertilizerModal';
import { apiClient, extractApiArray } from '../../../lib/apiClient';
import { Crop, CropStatus } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { Sprout, PlusCircle, Filter, X, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function FarmerCropsPage() {
  const { t, translateCommodity } = useLanguage();
  const [crops, setCrops] = useState<Crop[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCropForFertilizer, setSelectedCropForFertilizer] = useState<Crop | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Crop Form state
  const [newCrop, setNewCrop] = useState({
    cropType: 'Tomato',
    variety: '',
    area: 2.0,
    areaUnit: 'acres',
    plantingDate: new Date().toISOString().split('T')[0],
    expectedHarvestDate: '',
    status: 'GROWING' as CropStatus,
    notes: '',
    imageUrl: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [farms, setFarms] = useState<{ id: string; name: string }[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('');

  useEffect(() => {
    loadCrops();
    loadFarms();
  }, [statusFilter]);

  const loadFarms = async () => {
    try {
      const res: any = await apiClient.get('/farmer/farms');
      const farmList = extractApiArray<{ id: string; name: string }>(res);
      setFarms(farmList);
      if (farmList.length > 0) {
        setSelectedFarmId((prev) => (prev && farmList.some((f) => f.id === prev) ? prev : farmList[0].id));
      }
    } catch {
      // Ignored
    }
  };

  const loadCrops = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'ALL' ? '/farmer/crops' : `/farmer/crops?status=${statusFilter}`;
      const res: any = await apiClient.get(url);
      const cropList = extractApiArray<Crop>(res);
      setCrops(cropList);
    } catch (err: any) {
      console.warn('Could not load crops:', err);
      setCrops([]);
      setFeedback({
        type: 'error',
        message: err?.message || 'Unable to load standing crops from server.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    const areaNum = Number(newCrop.area);
    if (!newCrop.cropType.trim()) {
      setFeedback({ type: 'error', message: 'Crop type is required.' });
      return;
    }
    if (!newCrop.plantingDate.trim()) {
      setFeedback({ type: 'error', message: 'Planting date is required.' });
      return;
    }
    if (isNaN(areaNum) || areaNum <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid planted area greater than 0.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);
      const payload = {
        crop_type: newCrop.cropType.trim(),
        cropType: newCrop.cropType.trim(),
        variety: newCrop.variety.trim() || 'Standard',
        area: areaNum,
        area_unit: newCrop.areaUnit || 'acres',
        areaUnit: newCrop.areaUnit || 'acres',
        planting_date: newCrop.plantingDate,
        plantingDate: newCrop.plantingDate,
        expected_harvest_date: newCrop.expectedHarvestDate || undefined,
        expectedHarvestDate: newCrop.expectedHarvestDate || undefined,
        farm_id: selectedFarmId || undefined,
        farmId: selectedFarmId || undefined,
        status: newCrop.status || 'GROWING',
        notes: newCrop.notes.trim() || undefined,
        image_url: newCrop.imageUrl || undefined,
      };

      const res: any = await apiClient.post('/farmer/crops', payload);
      const createdCrop = res?.data?.data || res?.data;
      if (!createdCrop || !createdCrop.id) {
        throw new Error('Server did not return a valid saved crop record.');
      }

      setIsAddModalOpen(false);
      setFeedback({ type: 'success', message: 'New crop added to your farm holdings!' });
      setNewCrop({
        cropType: 'Tomato',
        variety: '',
        area: 2.0,
        areaUnit: 'acres',
        plantingDate: new Date().toISOString().split('T')[0],
        expectedHarvestDate: '',
        status: 'GROWING' as CropStatus,
        notes: '',
        imageUrl: '',
      });
      await loadCrops();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error saving crop.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFertilizer = async (formData: any) => {
    if (!selectedCropForFertilizer) return;
    try {
      await apiClient.post(`/farmer/crops/${selectedCropForFertilizer.id}/fertilizers`, formData);
      setFeedback({ type: 'success', message: 'Fertilizer application recorded successfully in history!' });
      setSelectedCropForFertilizer(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record fertilizer.' });
    }
  };

  return (
    <DashboardLayout
      portal="farmer"
      title="My Crops (Multi-Crop Management)"
      subtitle="Manage 2, 3, 4 or more simultaneous crops. Each crop maintains independent fertilizer history and harvest records."
      actionButton={
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Plant New Crop</span>
        </button>
      }
    >
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs font-semibold border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" />
          Status:
        </span>
        {['ALL', 'GROWING', 'READY_FOR_HARVEST', 'HARVESTED', 'PLANNING'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${
              statusFilter === status
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Multi-Crop Cards Grid */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500 font-medium">Loading your standing crops...</span>
        </div>
      ) : crops.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center border border-slate-200 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
            <Sprout className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Crops Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You don&apos;t have any crops in this filter. Click &quot;Plant New Crop&quot; to add a new crop to your farm.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Plant Your First Crop</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {crops.map((crop) => (
            <CropCard
              key={crop.id}
              crop={crop}
              onAddFertilizer={(c) => setSelectedCropForFertilizer(c)}
            />
          ))}
        </div>
      )}

      {/* Plant New Crop Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 space-y-5 my-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5 text-slate-900 font-bold text-lg">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Sprout className="h-5 w-5" />
                </div>
                <h3>Plant New Crop</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCrop} className="space-y-4 text-xs">
              {farms.length > 0 && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Farm *</label>
                  <select
                    value={selectedFarmId}
                    onChange={(e) => setSelectedFarmId(e.target.value)}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    {farms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Crop Type *</label>
                  <select
                    value={newCrop.cropType}
                    onChange={(e) => setNewCrop({ ...newCrop, cropType: e.target.value })}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="Tomato">Tomato (टमाटर)</option>
                    <option value="Onion">Onion (प्याज)</option>
                    <option value="Potato">Potato (आलू)</option>
                    <option value="Chili">Chili (मिर्च)</option>
                    <option value="Mango">Mango (आम)</option>
                    <option value="Banana">Banana (केला)</option>
                    <option value="Grapes">Grapes (अंगूर)</option>
                    <option value="Spinach">Spinach (पालक)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Variety *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Roma / Nashik Red / Hybrid"
                    value={newCrop.variety}
                    onChange={(e) => setNewCrop({ ...newCrop, variety: e.target.value })}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Planted Area *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={newCrop.area}
                    onChange={(e) => setNewCrop({ ...newCrop, area: Number(e.target.value) })}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Area Unit</label>
                  <select
                    value={newCrop.areaUnit}
                    onChange={(e) => setNewCrop({ ...newCrop, areaUnit: e.target.value })}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="acre">Acre</option>
                    <option value="hectare">Hectare</option>
                    <option value="bigha">Bigha</option>
                    <option value="guntha">Guntha</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Planting Date *</label>
                  <input
                    type="date"
                    required
                    value={newCrop.plantingDate}
                    onChange={(e) => setNewCrop({ ...newCrop, plantingDate: e.target.value })}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Expected Harvest Date</label>
                  <input
                    type="date"
                    value={newCrop.expectedHarvestDate}
                    onChange={(e) => setNewCrop({ ...newCrop, expectedHarvestDate: e.target.value })}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Crop / Field Photo</label>
                <div className="flex items-center gap-3">
                  {newCrop.imageUrl && (
                    <img
                      src={newCrop.imageUrl}
                      alt="Crop Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                    />
                  )}
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 transition-colors text-slate-700 font-medium text-xs">
                    <Upload className="h-4 w-4 text-emerald-600" />
                    <span>Upload Crop Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setNewCrop((prev) => ({ ...prev, imageUrl: ev.target?.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Field Notes</label>
                <textarea
                  rows={2}
                  placeholder="Soil prep notes, seed supplier, drip setup..."
                  value={newCrop.notes}
                  onChange={(e) => setNewCrop({ ...newCrop, notes: e.target.value })}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{submitting ? 'Saving...' : 'Save Crop Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fertilizer Modal */}
      {selectedCropForFertilizer && (
        <FertilizerModal
          isOpen={!!selectedCropForFertilizer}
          onClose={() => setSelectedCropForFertilizer(null)}
          cropId={selectedCropForFertilizer.id}
          onSubmit={handleAddFertilizer}
        />
      )}
    </DashboardLayout>
  );
}
