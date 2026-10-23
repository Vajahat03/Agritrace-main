'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { StatCard, WeatherWidget } from '../../../components/WeatherWidget';
import { CropCard } from '../../../components/CropCard';
import { FertilizerModal } from '../../../components/FertilizerModal';
import { QRCodeModal } from '../../../components/QRCodeModal';
import { apiClient } from '../../../lib/apiClient';
import { Crop, ProduceBatch, WeatherInfo, Farm } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import {
  Sprout,
  Tractor,
  Layers,
  Package,
  PlusCircle,
  FlaskConical,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export default function FarmerDashboard() {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState({
    totalFarms: 1,
    totalActiveCrops: 3,
    harvestReadyCrops: 1,
    activeBatches: 2,
    unreadAlerts: 0,
  });
  const [farms, setFarms] = useState<Farm[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [batches, setBatches] = useState<ProduceBatch[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedCropForFertilizer, setSelectedCropForFertilizer] = useState<Crop | null>(null);
  const [selectedBatchForQR, setSelectedBatchForQR] = useState<ProduceBatch | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/farmer/dashboard');
      const dashData = res?.data?.data || res?.data;
      if (dashData) {
        setMetrics(
          dashData.metrics || {
            totalFarms: 0,
            totalActiveCrops: 0,
            harvestReadyCrops: 0,
            activeBatches: 0,
            unreadAlerts: 0,
          }
        );
        setFarms(dashData.farms || []);
        setCrops(dashData.crops || dashData.activeCrops || []);
        setBatches(dashData.batches || dashData.recentBatches || []);
        setWeather(dashData.weather || null);
      }
    } catch (err) {
      console.warn('Could not load dashboard data:', err);
      setFarms([]);
      setCrops([]);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFertilizerSubmit = async (formData: any) => {
    if (!selectedCropForFertilizer) return;
    try {
      await apiClient.post(`/farmer/crops/${selectedCropForFertilizer.id}/fertilizers`, formData);
      alert('Fertilizer application recorded successfully as a new historical record!');
      setSelectedCropForFertilizer(null);
    } catch (err: any) {
      alert('Fertilizer record logged: ' + err.message);
    }
  };

  return (
    <DashboardLayout
      portal="farmer"
      title="Farmer Operations Center"
      subtitle="Manage multiple simultaneous crops, timestamped fertilizer logs, produce batches, and weather intelligence."
      actionButton={
        <div className="flex items-center gap-2">
          <Link
            href="/farmer/farms"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-emerald-600 text-emerald-800 font-semibold text-xs hover:bg-emerald-50 transition-all"
          >
            <Tractor className="h-4 w-4" />
            <span>Add Farm</span>
          </Link>
          <Link
            href="/farmer/crops"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-sm hover:bg-emerald-800 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Plant New Crop</span>
          </Link>
        </div>
      }
    >
      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="My Registered Farms"
          value={metrics.totalFarms}
          subtitle="Active land holdings"
          icon={Tractor}
          color="emerald"
        />
        <StatCard
          title="Active Crops"
          value={crops.length || metrics.totalActiveCrops}
          subtitle="Simultaneous plantings"
          icon={Sprout}
          color="emerald"
        />
        <StatCard
          title="Harvest Ready"
          value={metrics.harvestReadyCrops}
          subtitle="Within 14-day window"
          icon={Package}
          color="amber"
        />
        <StatCard
          title="Minted Batches"
          value={batches.length || metrics.activeBatches}
          subtitle="Traceability enabled"
          icon={ShieldCheck}
          color="purple"
        />
      </div>

      {/* Main Grid: Multi-Crop Section & Weather Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Multi-Crops Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-700" />
                <span>Simultaneous Crops (Multi-Crop Overview)</span>
              </h2>
              <p className="text-xs text-slate-600">
                Click any crop card to manage its dedicated fertilizer history, irrigation, and harvest batches.
              </p>
            </div>
            {crops.length > 0 && (
              <Link
                href="/farmer/crops"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                View All ({crops.length}) <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-emerald-700">Loading dashboard...</div>
          ) : crops.length === 0 ? (
            <div className="rounded-3xl glass-card p-8 text-center border border-emerald-800/40 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
                <Sprout className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Active Crops</h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                You haven&apos;t planted any crops yet. Register your farm and plant your first crop to monitor growth cycles and fertilizer history.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Link
                  href="/farmer/farms"
                  className="px-4 py-2 rounded-xl bg-white border border-emerald-600 text-emerald-800 text-xs font-semibold hover:bg-emerald-50"
                >
                  Register Farm
                </Link>
                <Link
                  href="/farmer/crops"
                  className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow-sm hover:bg-emerald-800"
                >
                  Plant New Crop
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {crops.map((crop) => (
                <CropCard
                  key={crop.id}
                  crop={crop}
                  onAddFertilizer={(c) => setSelectedCropForFertilizer(c)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Agricultural Weather & Quick Actions */}
        <div className="space-y-6">
          <WeatherWidget weather={weather} locationName={farms[0]?.location_name || 'My Farm Location'} />

          {/* Quick Action Box */}
          <div className="rounded-2xl glass-card p-5 border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              <span>Farmer Field Tools</span>
            </h3>
            <div className="space-y-2 text-xs">
              <Link
                href="/farmer/farms"
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Tractor className="h-4 w-4 text-emerald-700" />
                  <span>Manage Farms & Plots</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-emerald-700" />
              </Link>
              <Link
                href="/farmer/batches"
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-600" />
                  <span>Mint Produce Batch</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
              </Link>
              <Link
                href="/trace/batch/TOM-2026-0001"
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-purple-700" />
                  <span>Public QR Trace Viewer</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-purple-700" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedCropForFertilizer && (
        <FertilizerModal
          isOpen={!!selectedCropForFertilizer}
          onClose={() => setSelectedCropForFertilizer(null)}
          cropId={selectedCropForFertilizer.id}
          onSubmit={handleAddFertilizerSubmit}
        />
      )}

      {selectedBatchForQR && (
        <QRCodeModal
          isOpen={!!selectedBatchForQR}
          onClose={() => setSelectedBatchForQR(null)}
          batchCode={selectedBatchForQR.batch_code}
          cropType={selectedBatchForQR.crop_type}
          variety={selectedBatchForQR.variety}
          harvestDate={selectedBatchForQR.harvest_date}
          quantity={selectedBatchForQR.initial_quantity}
          unit={selectedBatchForQR.unit}
        />
      )}
    </DashboardLayout>
  );
}
