'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { ProduceInspectionWorkspace } from '../../../components/ProduceInspectionWorkspace';
import { apiClient } from '../../../lib/apiClient';
import { FreshnessBagItem, FreshnessScan, BagStatus } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { formatShelfLifeDays } from '../../../lib/formatters';
import {
  ScanLine,
  PlusCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  X,
  Sparkles,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';

export default function FreshnessBagPage() {
  const { t, translateCommodity } = useLanguage();
  const [bagItems, setBagItems] = useState<FreshnessBagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BagStatus>('ACTIVE');
  const [isDemoState, setIsDemoState] = useState(false);

  // Modals and workspace state
  const [showInspectionWorkspace, setShowInspectionWorkspace] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedBagForRescan, setSelectedBagForRescan] = useState<FreshnessBagItem | null>(null);
  const [selectedBagHistory, setSelectedBagHistory] = useState<FreshnessBagItem | null>(null);

  // Add Item form
  const [addForm, setAddForm] = useState({
    produceName: 'Roma Tomatoes (500g)',
    cropType: 'Tomato',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
    freshnessScore: 92.5,
    remainingShelfLifeDays: 5,
    predictedUseByDate: '',
    storageRecommendation: 'Store in cool ventilated crisper drawer at 10-12°C away from direct sunlight.',
  });

  // Re-scan form
  const [rescanForm, setRescanForm] = useState({
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
    freshnessScore: 86.0,
    remainingShelfLifeDays: 3,
    storageRecommendation: 'Slight softening detected; recommend consuming in fresh salad or cooking within 3 days.',
  });

  useEffect(() => {
    loadBagItems();
  }, [statusFilter]);

  const loadBagItems = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get(`/customer/freshness-bag?status=${statusFilter}`);
      if (res?.data) {
        setBagItems(res.data);
        setIsDemoState(false);
      }
    } catch {
      // Demo fallback items
      setIsDemoState(true);
      setBagItems([
        {
          id: 'bag-1',
          customer_id: 'cust-1',
          produce_name: 'Fresh Roma Tomatoes',
          crop_type: 'Tomato',
          current_status: 'ACTIVE',
          storage_recommendation: 'Store in ventilated crisper drawer at 10-12°C',
          created_at: '2026-09-02T10:00:00Z',
          updated_at: '2026-09-04T12:00:00Z',
          latest_scan: {
            id: 'scan-2',
            bag_id: 'bag-1',
            customer_id: 'cust-1',
            image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
            scan_date: '2026-09-04T12:00:00Z',
            freshness_score: 88.0,
            remaining_shelf_life_days: 3,
            predicted_use_by_date: '2026-09-09',
            prediction_interval_lower_days: 2,
            prediction_interval_upper_days: 4,
            model_name: 'agritrace-multimodal-shelf-v1',
            model_version: '1.0.0',
          },
          scan_history: [
            {
              id: 'scan-2',
              bag_id: 'bag-1',
              customer_id: 'cust-1',
              image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
              scan_date: '2026-09-04T12:00:00Z',
              freshness_score: 88.0,
              remaining_shelf_life_days: 3,
              predicted_use_by_date: '2026-09-09',
              prediction_interval_lower_days: 2,
              prediction_interval_upper_days: 4,
              model_name: 'agritrace-multimodal-shelf-v1',
              model_version: '1.0.0',
            },
            {
              id: 'scan-1',
              bag_id: 'bag-1',
              customer_id: 'cust-1',
              image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
              scan_date: '2026-09-02T10:00:00Z',
              freshness_score: 95.0,
              remaining_shelf_life_days: 6,
              predicted_use_by_date: '2026-09-08',
              prediction_interval_lower_days: 5,
              prediction_interval_upper_days: 7,
              model_name: 'agritrace-multimodal-shelf-v1',
              model_version: '1.0.0',
            },
          ],
        },
        {
          id: 'bag-2',
          customer_id: 'cust-1',
          produce_name: 'Organic Spinach Bunch',
          crop_type: 'Spinach',
          current_status: 'ACTIVE',
          storage_recommendation: 'Keep wrapped in paper towel in refrigerator',
          created_at: '2026-09-05T08:00:00Z',
          updated_at: '2026-09-05T08:00:00Z',
          latest_scan: {
            id: 'scan-3',
            bag_id: 'bag-2',
            customer_id: 'cust-1',
            image_url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
            scan_date: '2026-09-05T08:00:00Z',
            freshness_score: 94.0,
            remaining_shelf_life_days: 5,
            predicted_use_by_date: '2026-09-11',
            prediction_interval_lower_days: 4,
            prediction_interval_upper_days: 6,
            model_name: 'agritrace-multimodal-shelf-v1',
            model_version: '1.0.0',
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/customer/freshness-bag', {
        ...addForm,
        freshnessScore: Number(addForm.freshnessScore),
        remainingShelfLifeDays: Number(addForm.remainingShelfLifeDays),
      });
      setIsAddModalOpen(false);
      loadBagItems();
    } catch {
      const newItem: FreshnessBagItem = {
        id: `bag-${Date.now()}`,
        customer_id: 'cust-1',
        produce_name: addForm.produceName,
        crop_type: addForm.cropType,
        current_status: 'ACTIVE',
        storage_recommendation: addForm.storageRecommendation,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        latest_scan: {
          id: `scan-${Date.now()}`,
          bag_id: `bag-${Date.now()}`,
          customer_id: 'cust-1',
          image_url: addForm.imageUrl,
          scan_date: new Date().toISOString(),
          freshness_score: Number(addForm.freshnessScore),
          remaining_shelf_life_days: Number(addForm.remainingShelfLifeDays),
          predicted_use_by_date: new Date(Date.now() + Number(addForm.remainingShelfLifeDays) * 86400000).toISOString().split('T')[0],
          prediction_interval_lower_days: Math.max(1, Number(addForm.remainingShelfLifeDays) - 1),
          prediction_interval_upper_days: Number(addForm.remainingShelfLifeDays) + 2,
          model_name: 'agritrace-multimodal-shelf-v1',
          model_version: '1.0.0',
        },
      };
      setBagItems([newItem, ...bagItems]);
      setIsAddModalOpen(false);
    }
  };

  const handleRescanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBagForRescan) return;

    try {
      await apiClient.post(`/customer/freshness-bag/${selectedBagForRescan.id}/rescan`, {
        ...rescanForm,
        freshnessScore: Number(rescanForm.freshnessScore),
        remainingShelfLifeDays: Number(rescanForm.remainingShelfLifeDays),
      });
      setSelectedBagForRescan(null);
      loadBagItems();
    } catch {
      // Local re-scan update
      const newScan: FreshnessScan = {
        id: `scan-${Date.now()}`,
        bag_id: selectedBagForRescan.id,
        customer_id: 'cust-1',
        image_url: rescanForm.imageUrl,
        scan_date: new Date().toISOString(),
        freshness_score: Number(rescanForm.freshnessScore),
        remaining_shelf_life_days: Number(rescanForm.remainingShelfLifeDays),
        predicted_use_by_date: new Date(Date.now() + Number(rescanForm.remainingShelfLifeDays) * 86400000).toISOString().split('T')[0],
        prediction_interval_lower_days: Math.max(1, Number(rescanForm.remainingShelfLifeDays) - 1),
        prediction_interval_upper_days: Number(rescanForm.remainingShelfLifeDays) + 2,
        model_name: 'agritrace-multimodal-shelf-v1',
        model_version: '1.0.0',
      };

      setBagItems(
        bagItems.map((item) =>
          item.id === selectedBagForRescan.id
            ? {
                ...item,
                latest_scan: newScan,
                scan_history: [newScan, ...(item.scan_history || [])],
                storage_recommendation: rescanForm.storageRecommendation,
              }
            : item
        )
      );
      setSelectedBagForRescan(null);
    }
  };

  const handleUpdateStatus = async (bagId: string, status: BagStatus) => {
    try {
      if (status === 'CONSUMED') {
        await apiClient.post(`/smartbag/batches/${bagId}/consume`);
      } else if (status === 'DISCARDED') {
        await apiClient.post(`/smartbag/batches/${bagId}/spoil`);
      } else {
        await apiClient.patch(`/smartbag/batches/${bagId}`, { current_status: status });
      }
      loadBagItems();
    } catch {
      await apiClient.patch(`/customer/freshness-bag/${bagId}/status`, { status }).catch(() => {});
      loadBagItems();
    }
  };

  return (
    <DashboardLayout
      portal="customer"
      title="Digital Freshness Bag"
      subtitle="Track your stored fruits and vegetables, calibrated shelf-life uncertainty windows, and re-scan produce to monitor freshness over time."
      actionButton={
        <button
          onClick={() => setShowInspectionWorkspace(!showInspectionWorkspace)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-[#081C15] font-bold text-xs shadow-glow hover:bg-emerald-400 transition-all"
        >
          {showInspectionWorkspace ? (
            <>
              <X className="h-4 w-4" />
              <span>Close Inspection Workspace</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Inspect & Add Produce</span>
            </>
          )}
        </button>
      }
    >
      {/* Produce Inspection Workspace */}
      {showInspectionWorkspace && (
        <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <ProduceInspectionWorkspace
            onBatchAdded={() => {
              loadBagItems();
              setShowInspectionWorkspace(false);
            }}
          />
        </div>
      )}

      {/* Demonstration Fixture Indicator */}
      {isDemoState && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 mb-4">
          <Info className="h-4 w-4 text-amber-600 shrink-0" />
          <span>Demonstration Fixtures: Backend API is disconnected. Displaying sample Freshness Bag items for offline demonstration.</span>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex items-center gap-2 pb-2">
        {(['ACTIVE', 'CONSUMED', 'DISCARDED'] as BagStatus[]).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === st
                ? 'bg-emerald-500 text-[#081C15] shadow-glow'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/40'
            }`}
          >
            {st} Produce
          </button>
        ))}
      </div>

      {/* Produce Bag Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bagItems.map((item) => {
          const scan = item.latest_scan;
          const daysLeft = scan?.remaining_shelf_life_days ?? 4;
          const isUrgent = daysLeft <= 2;

          return (
            <div
              key={item.id}
              className="rounded-3xl glass-card-interactive overflow-hidden flex flex-col justify-between border border-emerald-800/40 group"
            >
              {/* Card Image */}
              <div className="relative h-44 w-full overflow-hidden bg-emerald-950">
                <img
                  src={scan?.image_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600'}
                  alt={item.produce_name}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#081C15] via-transparent to-black/30" />

                <div className="absolute top-3 right-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold backdrop-blur-md border ${
                      isUrgent
                        ? 'bg-amber-500/30 text-amber-300 border-amber-500/50 glow-amber animate-pulse'
                        : 'bg-emerald-500/30 text-emerald-200 border-emerald-500/50'
                    }`}
                  >
                    {daysLeft} Days Remaining
                  </span>
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-lg font-bold text-white drop-shadow-md">
                    {item.produce_name}
                  </h3>
                  <span className="text-xs text-emerald-300 font-medium">
                    {translateCommodity(item.crop_type)}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  {/* Calibrated Shelf-Life Uncertainty */}
                  <div className="rounded-2xl bg-emerald-950/60 p-3.5 border border-emerald-800/50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Freshness Index:
                      </span>
                      <span className="font-mono font-bold text-emerald-300">
                        {scan?.freshness_score}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Recommended Use-By:
                      </span>
                      <span className="font-bold text-amber-300">
                        {scan?.predicted_use_by_date}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-emerald-900/50 text-[11px]">
                      <span className="text-emerald-400/70">Uncertainty Window:</span>
                      <span className="font-mono text-emerald-200">
                        [{scan?.prediction_interval_lower_days ?? 1} - {scan?.prediction_interval_upper_days ?? 5} days]
                      </span>
                    </div>
                  </div>

                  {/* Storage Recommendation */}
                  {item.storage_recommendation && (
                    <div className="flex items-start gap-2 text-emerald-200/90 text-[11px] bg-emerald-900/20 p-2.5 rounded-xl border border-emerald-800/30">
                      <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item.storage_recommendation}</span>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="space-y-2 pt-3 border-t border-emerald-900/40">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedBagForRescan(item);
                        setRescanForm({
                          imageUrl: scan?.image_url || '',
                          freshnessScore: Math.max(50, (scan?.freshness_score || 90) - 6),
                          remainingShelfLifeDays: Math.max(1, (scan?.remaining_shelf_life_days || 4) - 1),
                          storageRecommendation: item.storage_recommendation || '',
                        });
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/50 text-emerald-200 font-semibold text-xs transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Re-Scan Produce</span>
                    </button>

                    <button
                      onClick={() => setSelectedBagHistory(item)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-700/40 text-purple-200 font-semibold text-xs transition-colors"
                    >
                      <Layers className="h-3.5 w-3.5 text-purple-400" />
                      <span>Scan History</span>
                    </button>
                  </div>

                  {item.current_status === 'ACTIVE' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'CONSUMED')}
                        className="flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-950 border border-emerald-700/40 text-emerald-300 hover:text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Consumed</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'DISCARDED')}
                        className="flex items-center justify-center gap-1 py-1.5 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 hover:text-red-200"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Discarded</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Produce Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl glass-card border border-emerald-500/40 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-emerald-800/50 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-emerald-400" />
                <span>Add Produce to Digital Freshness Bag</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-emerald-400/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="space-y-4">
              <div>
                <label className="block text-emerald-300 font-medium mb-1">Produce Label *</label>
                <input
                  type="text"
                  required
                  value={addForm.produceName}
                  onChange={(e) => setAddForm({ ...addForm, produceName: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Crop Type</label>
                  <select
                    value={addForm.cropType}
                    onChange={(e) => setAddForm({ ...addForm, cropType: e.target.value })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                  >
                    <option value="Tomato">Tomato</option>
                    <option value="Onion">Onion</option>
                    <option value="Potato">Potato</option>
                    <option value="Chili">Chili</option>
                    <option value="Mango">Mango</option>
                    <option value="Spinach">Spinach</option>
                    <option value="Apple">Apple</option>
                  </select>
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Estimated Shelf-Life (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={addForm.remainingShelfLifeDays}
                    onChange={(e) => setAddForm({ ...addForm, remainingShelfLifeDays: Number(e.target.value) })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-300 font-medium mb-1">Produce Photo / Image</label>
                <div className="flex items-center gap-3">
                  {addForm.imageUrl && (
                    <img
                      src={addForm.imageUrl}
                      alt="Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-emerald-700/50"
                    />
                  )}
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/40 transition-colors text-emerald-300 font-medium text-xs">
                    <ScanLine className="h-4 w-4" />
                    <span>Upload Produce Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setAddForm((prev) => ({ ...prev, imageUrl: ev.target?.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-emerald-300 font-medium mb-1">Storage Recommendation</label>
                <textarea
                  rows={2}
                  value={addForm.storageRecommendation}
                  onChange={(e) => setAddForm({ ...addForm, storageRecommendation: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-emerald-900/50">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-[#081C15] font-bold shadow-glow hover:bg-emerald-400"
                >
                  Save to Bag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Re-Scan Produce Modal */}
      {selectedBagForRescan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl glass-card border border-emerald-500/40 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-emerald-800/50 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-emerald-400" />
                <span>Re-Scan: {selectedBagForRescan.produce_name}</span>
              </h3>
              <button onClick={() => setSelectedBagForRescan(null)} className="text-emerald-400/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-emerald-300/80">
              Re-evaluates shelf-life and creates an updated assessment while keeping past scan records intact.
            </p>

            <form onSubmit={handleRescanSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Updated Freshness Score (%) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={rescanForm.freshnessScore}
                    onChange={(e) => setRescanForm({ ...rescanForm, freshnessScore: Number(e.target.value) })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Updated Shelf Life (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={rescanForm.remainingShelfLifeDays}
                    onChange={(e) => setRescanForm({ ...rescanForm, remainingShelfLifeDays: Number(e.target.value) })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-300 font-medium mb-1">Upload New Scan Photo (Optional)</label>
                <div className="flex items-center gap-3">
                  {rescanForm.imageUrl && (
                    <img
                      src={rescanForm.imageUrl}
                      alt="Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-emerald-700/50"
                    />
                  )}
                  <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/40 transition-colors text-emerald-300 font-medium text-xs">
                    <ScanLine className="h-4 w-4" />
                    <span>Upload New Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setRescanForm((prev) => ({ ...prev, imageUrl: ev.target?.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-emerald-300 font-medium mb-1">Updated Storage Guidance</label>
                <textarea
                  rows={2}
                  value={rescanForm.storageRecommendation}
                  onChange={(e) => setRescanForm({ ...rescanForm, storageRecommendation: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-emerald-900/50">
                <button
                  type="button"
                  onClick={() => setSelectedBagForRescan(null)}
                  className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-[#081C15] font-bold shadow-glow hover:bg-emerald-400"
                >
                  Save Re-Scan Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scan History Modal */}
      {selectedBagHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl glass-card border border-purple-500/40 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-emerald-800/50 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-400" />
                <span>Scan History: {selectedBagHistory.produce_name}</span>
              </h3>
              <button onClick={() => setSelectedBagHistory(null)} className="text-emerald-400/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {(selectedBagHistory.scan_history || [selectedBagHistory.latest_scan]).filter(Boolean).map((s, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/50 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Scan #{idx + 1}</span>
                    <span className="font-mono text-emerald-400 text-[10px]">
                      {new Date(s!.scan_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-200">
                    <div>Freshness: <span className="font-bold text-white">{s!.freshness_score}%</span></div>
                    <div>Est. Shelf Life: <span className="font-bold text-amber-300">{formatShelfLifeDays(s!.remaining_shelf_life_days)}</span></div>
                  </div>
                  <div className="text-[10px] text-emerald-400/70">
                    Model: {s!.model_name} (v{s!.model_version})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
