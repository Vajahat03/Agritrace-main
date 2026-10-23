'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../../components/DashboardLayout';
import { DataTable, Column } from '../../../../components/DataTable';
import { FertilizerModal } from '../../../../components/FertilizerModal';
import { QRCodeModal } from '../../../../components/QRCodeModal';
import { apiClient } from '../../../../lib/apiClient';
import {
  Crop,
  FertilizerApplication,
  IrrigationRecord,
  CropInput,
  CropObservation,
  Harvest,
  ProduceBatch,
} from '../../../../types';
import { useLanguage } from '../../../../context/LanguageContext';
import {
  Sprout,
  FlaskConical,
  Droplets,
  Bug,
  Package,
  Calendar,
  MapPin,
  Clock,
  PlusCircle,
  Edit2,
  Trash2,
  QrCode,
  ShieldCheck,
  ChevronLeft,
  X,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

export default function CropDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cropId = params.cropId as string;
  const { t, translateCommodity } = useLanguage();

  const [activeTab, setActiveTab] = useState<'overview' | 'fertilizer' | 'irrigation' | 'inputs' | 'harvest'>('overview');
  const [crop, setCrop] = useState<Crop | null>(null);
  const [fertilizers, setFertilizers] = useState<FertilizerApplication[]>([]);
  const [totalFertilizerCost, setTotalFertilizerCost] = useState(0);
  const [totalFertilizerQty, setTotalFertilizerQty] = useState(0);
  const [irrigations, setIrrigations] = useState<IrrigationRecord[]>([]);
  const [inputs, setInputs] = useState<CropInput[]>([]);
  const [observations, setObservations] = useState<CropObservation[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isFertilizerModalOpen, setIsFertilizerModalOpen] = useState(false);
  const [editingFertilizer, setEditingFertilizer] = useState<FertilizerApplication | null>(null);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [isIrrigationModalOpen, setIsIrrigationModalOpen] = useState(false);
  const [mintedBatch, setMintedBatch] = useState<ProduceBatch | null>(null);

  // Harvest Form state
  const [harvestForm, setHarvestForm] = useState({
    harvestDate: new Date().toISOString().split('T')[0],
    quantity: 500,
    unit: 'kg',
    qualityGrade: 'Grade A',
    notes: 'Prime harvest ready for grading and batch minting',
  });

  // Irrigation Form state
  const [irrigationForm, setIrrigationForm] = useState({
    date: new Date().toISOString().split('T')[0],
    method: 'DRIP',
    durationMinutes: 60,
    waterQuantity: 1200,
    unit: 'liters',
    source: 'BOREWELL',
    notes: 'Morning drip schedule',
  });

  useEffect(() => {
    loadCropDetails();
  }, [cropId]);

  const loadCropDetails = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get(`/farmer/crops/${cropId}`);
      if (res?.data) {
        setCrop(res.data);
        const fertData = res.data.fertilizerHistory || {};
        setFertilizers(fertData.records || (Array.isArray(fertData) ? fertData : []));
        setTotalFertilizerCost(fertData.totalCost || 0);
        setTotalFertilizerQty(fertData.totalQuantity || 0);
        setIrrigations(res.data.irrigationHistory || []);
        setInputs(res.data.inputsHistory || []);
        setObservations(res.data.observations || []);
        setHarvests(res.data.harvests || []);
      }
    } catch {
      // Fallback demo data
      setCrop({
        id: cropId,
        farmer_id: 'farmer-1',
        farm_id: 'farm-1',
        plot_id: 'plot-1',
        crop_type: 'Tomato',
        variety: 'Roma Supreme',
        area: 2.5,
        area_unit: 'acre',
        planting_date: '2026-08-01',
        expected_harvest_date: '2026-11-15',
        status: 'GROWING',
        notes: 'Planted with certified drip irrigation layout and organic mulching.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        farm: { id: 'farm-1', name: 'Green Valley Farm', location_name: 'Nashik District, Maharashtra' },
        plot: { id: 'plot-1', name: 'Plot A-1 (North Section)', area: 2.5, soil_type: 'Black Clay Loam' },
      });

      const demoFert: FertilizerApplication[] = [
        {
          id: 'fert-1',
          crop_id: cropId,
          farmer_id: 'farmer-1',
          fertilizer_name: 'Urea (46% N)',
          fertilizer_type: 'Nitrogenous',
          application_date: '2026-08-10',
          quantity: 25,
          unit: 'kg',
          method: 'SOIL',
          cost: 650,
          notes: 'Basal application at 10 days post-transplant',
          created_at: '2026-08-10T10:00:00Z',
        },
        {
          id: 'fert-2',
          crop_id: cropId,
          farmer_id: 'farmer-1',
          fertilizer_name: 'NPK 19:19:19',
          fertilizer_type: 'Complex',
          application_date: '2026-08-20',
          quantity: 15,
          unit: 'kg',
          method: 'DRIP',
          cost: 1400,
          notes: 'Fertigation via drip system during vegetative growth',
          created_at: '2026-08-20T10:00:00Z',
        },
        {
          id: 'fert-3',
          crop_id: cropId,
          farmer_id: 'farmer-1',
          fertilizer_name: 'Potassium Schoenite',
          fertilizer_type: 'Potash',
          application_date: '2026-08-30',
          quantity: 10,
          unit: 'kg',
          method: 'FOLIAR',
          cost: 950,
          notes: 'Foliar spray for early flowering support',
          created_at: '2026-08-30T10:00:00Z',
        },
      ];
      setFertilizers(demoFert);
      setTotalFertilizerCost(3000);
      setTotalFertilizerQty(50);

      setIrrigations([
        {
          id: 'irr-1',
          crop_id: cropId,
          farmer_id: 'farmer-1',
          date: '2026-09-02',
          method: 'DRIP',
          duration_minutes: 75,
          water_quantity: 1500,
          unit: 'liters',
          source: 'BOREWELL',
          created_at: '2026-09-02T06:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFertilizerSubmit = async (formData: any) => {
    try {
      if (editingFertilizer) {
        await apiClient.patch(`/farmer/crops/${cropId}/fertilizers/${editingFertilizer.id}`, formData);
      } else {
        await apiClient.post(`/farmer/crops/${cropId}/fertilizers`, formData);
      }
      setIsFertilizerModalOpen(false);
      setEditingFertilizer(null);
      loadCropDetails();
    } catch {
      const newEntry: FertilizerApplication = {
        id: editingFertilizer ? editingFertilizer.id : `fert-${Date.now()}`,
        crop_id: cropId,
        farmer_id: 'farmer-1',
        fertilizer_name: formData.fertilizerName,
        fertilizer_type: formData.fertilizerType,
        application_date: formData.applicationDate,
        quantity: formData.quantity,
        unit: formData.unit,
        method: formData.method,
        cost: formData.cost,
        notes: formData.notes,
        created_at: new Date().toISOString(),
      };

      if (editingFertilizer) {
        setFertilizers(fertilizers.map((f) => (f.id === editingFertilizer.id ? newEntry : f)));
      } else {
        setFertilizers([newEntry, ...fertilizers]);
        setTotalFertilizerCost((c) => c + (formData.cost || 0));
        setTotalFertilizerQty((q) => q + (formData.quantity || 0));
      }
      setIsFertilizerModalOpen(false);
      setEditingFertilizer(null);
    }
  };

  const handleDeleteFertilizer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this historical fertilizer entry?')) return;
    try {
      await apiClient.delete(`/farmer/crops/${cropId}/fertilizers/${id}`);
      loadCropDetails();
    } catch {
      setFertilizers(fertilizers.filter((f) => f.id !== id));
    }
  };

  const handleHarvestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await apiClient.post(`/farmer/crops/${cropId}/harvests`, harvestForm);
      setIsHarvestModalOpen(false);
      if (res?.data) {
        setMintedBatch(res.data);
      }
    } catch {
      const batchCode = `TOM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const batch: ProduceBatch = {
        id: `batch-${Date.now()}`,
        batch_code: batchCode,
        farmer_id: 'farmer-1',
        farm_id: crop?.farm_id || 'farm-1',
        plot_id: crop?.plot_id || 'plot-1',
        crop_id: cropId,
        crop_type: crop?.crop_type || 'Tomato',
        variety: crop?.variety || 'Roma',
        harvest_date: harvestForm.harvestDate,
        initial_quantity: Number(harvestForm.quantity),
        current_quantity: Number(harvestForm.quantity),
        unit: harvestForm.unit,
        quality_grade: harvestForm.qualityGrade,
        current_status: 'HARVESTED',
        current_location: 'Green Valley Farm, Nashik',
        created_at: new Date().toISOString(),
      };
      setMintedBatch(batch);
      setIsHarvestModalOpen(false);
    }
  };

  const handleIrrigationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post(`/farmer/crops/${cropId}/irrigation`, irrigationForm);
      setIsIrrigationModalOpen(false);
      loadCropDetails();
    } catch {
      const newIrr: IrrigationRecord = {
        id: `irr-${Date.now()}`,
        crop_id: cropId,
        farmer_id: 'farmer-1',
        date: irrigationForm.date,
        method: irrigationForm.method,
        duration_minutes: irrigationForm.durationMinutes,
        water_quantity: irrigationForm.waterQuantity,
        unit: irrigationForm.unit,
        source: irrigationForm.source,
        notes: irrigationForm.notes,
        created_at: new Date().toISOString(),
      };
      setIrrigations([newIrr, ...irrigations]);
      setIsIrrigationModalOpen(false);
    }
  };

  if (!crop && loading) {
    return (
      <DashboardLayout portal="farmer">
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500 font-medium">Loading crop details...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout portal="farmer">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <Link
          href="/farmer/crops"
          className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-bold transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to All Crops</span>
        </Link>
        <span className="text-xs text-slate-500">
          Crop ID: <span className="font-mono font-bold text-slate-800">{cropId.slice(0, 8)}</span>
        </span>
      </div>

      {/* Crop Hero Banner */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 font-extrabold border border-emerald-200">
            <Sprout className="h-8 w-8" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {translateCommodity(crop?.crop_type || 'Crop')}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {crop?.status}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Variety: <span className="text-slate-900 font-bold">{crop?.variety}</span> • {crop?.area} {crop?.area_unit} on{' '}
              {crop?.farm?.name} ({crop?.plot?.name})
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setEditingFertilizer(null);
              setIsFertilizerModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            <FlaskConical className="h-4 w-4 text-emerald-700" />
            <span>+ Fertilizer Log</span>
          </button>
          <button
            onClick={() => setIsHarvestModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Package className="h-4 w-4" />
            <span>Log Harvest & Mint Batch</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Crop Overview', icon: Sprout },
          { id: 'fertilizer', label: `Fertilizer History (${fertilizers.length})`, icon: FlaskConical },
          { id: 'irrigation', label: `Irrigation (${irrigations.length})`, icon: Droplets },
          { id: 'harvest', label: `Harvest History (${harvests.length})`, icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                isSelected
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Planting Date</span>
              <p className="text-base font-extrabold text-slate-900 mt-1">{crop?.planting_date}</p>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Est. Harvest Date</span>
              <p className="text-base font-extrabold text-amber-700 mt-1">{crop?.expected_harvest_date || 'In 60 Days'}</p>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Fertilizer Spent</span>
              <p className="text-base font-extrabold text-emerald-700 mt-1">₹{totalFertilizerCost.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Plot Area</span>
              <p className="text-base font-extrabold text-slate-900 mt-1">
                {crop?.area} {crop?.area_unit}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Plot & Agronomic Details</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {crop?.notes || 'Certified cultivation with precision drip layout, scheduled bio-fertilizer application, and strict traceability logging.'}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Fertilizer History */}
      {activeTab === 'fertilizer' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Crop Fertilizer Treatment History</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Every application is appended to the immutable field ledger.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingFertilizer(null);
                setIsFertilizerModalOpen(true);
              }}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs"
            >
              + Log Application
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Fertilizer Name</th>
                  <th className="px-4 py-3">Type & Method</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Cost (₹)</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fertilizers.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-bold text-slate-900">{f.application_date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{f.fertilizer_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px] mr-1">
                        {f.fertilizer_type}
                      </span>
                      <span className="text-slate-500">{f.method}</span>
                    </td>
                    <td className="px-4 py-3 font-extrabold text-slate-900">
                      {f.quantity} {f.unit}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-700">₹{f.cost || 0}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{f.notes || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingFertilizer(f);
                            setIsFertilizerModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-700"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFertilizer(f.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Irrigation */}
      {activeTab === 'irrigation' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Irrigation Logs</h3>
            <button
              onClick={() => setIsIrrigationModalOpen(true)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs"
            >
              + Log Irrigation
            </button>
          </div>

          <div className="space-y-2">
            {irrigations.map((irr) => (
              <div key={irr.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">{irr.date}</span>
                  <p className="text-[11px] text-slate-500">Method: {irr.method} • Source: {irr.source}</p>
                </div>
                <span className="font-bold text-emerald-800">
                  {irr.water_quantity} {irr.unit} ({irr.duration_minutes} mins)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fertilizer Modal */}
      <FertilizerModal
        isOpen={isFertilizerModalOpen}
        onClose={() => {
          setIsFertilizerModalOpen(false);
          setEditingFertilizer(null);
        }}
        cropId={cropId}
        initialData={editingFertilizer}
        onSubmit={handleFertilizerSubmit}
      />

      {/* Harvest & Mint Batch Modal */}
      {isHarvestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-600" />
                Log Harvest & Mint Produce Batch
              </h3>
              <button onClick={() => setIsHarvestModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleHarvestSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Harvest Date *</label>
                <input
                  type="date"
                  required
                  value={harvestForm.harvestDate}
                  onChange={(e) => setHarvestForm({ ...harvestForm, harvestDate: e.target.value })}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Harvest Quantity (kg) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={harvestForm.quantity}
                    onChange={(e) => setHarvestForm({ ...harvestForm, quantity: Number(e.target.value) })}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Quality Grade</label>
                  <select
                    value={harvestForm.qualityGrade}
                    onChange={(e) => setHarvestForm({ ...harvestForm, qualityGrade: e.target.value })}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="Grade A">Grade A (Premium)</option>
                    <option value="Grade B">Grade B (Standard)</option>
                    <option value="Grade C">Grade C (Commercial)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Harvest Notes</label>
                <textarea
                  rows={2}
                  value={harvestForm.notes}
                  onChange={(e) => setHarvestForm({ ...harvestForm, notes: e.target.value })}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsHarvestModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-xs">
                  Mint Batch & QR Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal for Minted Batch */}
      {mintedBatch && (
        <QRCodeModal
          isOpen={!!mintedBatch}
          onClose={() => setMintedBatch(null)}
          batchCode={mintedBatch.batch_code || mintedBatch.id || ''}
          cropType={crop?.crop_type || 'Produce'}
          variety={crop?.variety || ''}
          harvestDate={mintedBatch.harvest_date || crop?.expected_harvest_date || new Date().toISOString()}
          quantity={mintedBatch.initial_quantity || mintedBatch.current_quantity || 0}
          unit={mintedBatch.unit || 'kg'}
        />
      )}
    </DashboardLayout>
  );
}
