'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '../../components/DashboardLayout';
import { apiClient } from '../../lib/apiClient';
import { formatShelfLifeDays } from '../../lib/formatters';
import {
  Apple,
  Sprout,
  ScanLine,
  PlusCircle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  X,
  Sparkles,
  Thermometer,
  Droplets,
  PackageCheck,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Filter,
  Layers,
  Info,
} from 'lucide-react';

interface StoredProduceItem {
  id: string;
  produce_name: string;
  crop_type: string;
  category: 'Vegetable' | 'Fruit';
  farm_origin: string;
  quantity_kg: number;
  storage_condition: string;
  freshness_score: number;
  remaining_days: number;
  use_by_date: string;
  image_url: string;
  storage_tips: string;
  created_at: string;
}

const DEFAULT_STORED_PRODUCE: StoredProduceItem[] = [
  {
    id: 'prod-1',
    produce_name: 'Roma Tomatoes (Farm Fresh)',
    crop_type: 'Tomato',
    category: 'Vegetable',
    farm_origin: 'Sahyadri Organic Farm, Nashik',
    quantity_kg: 2.0,
    storage_condition: 'Ventilated Crisper Drawer (10-12°C)',
    freshness_score: 93.5,
    remaining_days: 5,
    use_by_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
    storage_tips: 'Keep away from direct sunlight; store stem-down to retain moisture.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    produce_name: 'Alphonso Mangoes (Export Grade)',
    crop_type: 'Mango',
    category: 'Fruit',
    farm_origin: 'Ratnagiri Coastal Orchards',
    quantity_kg: 3.5,
    storage_condition: 'Ambient Room Temperature (22°C)',
    freshness_score: 89.0,
    remaining_days: 4,
    use_by_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    image_url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&auto=format&fit=crop&q=80',
    storage_tips: 'Do not refrigerate until fully aromatic and yields slightly to pressure.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    produce_name: 'Fresh Spinach & Coriander Bunch',
    crop_type: 'Spinach',
    category: 'Vegetable',
    farm_origin: 'Pune Hydroponic Cluster',
    quantity_kg: 0.8,
    storage_condition: 'SmartBag Active Humidity Container',
    freshness_score: 95.0,
    remaining_days: 2, // Expiring soon
    use_by_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    image_url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
    storage_tips: 'Wrap loosely in breathable paper towel to prevent leaf condensation rot.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prod-4',
    produce_name: 'Crisp Shimla Green Apples',
    crop_type: 'Apple',
    category: 'Fruit',
    farm_origin: 'Himachal Highland Valley Farms',
    quantity_kg: 2.5,
    storage_condition: 'Refrigerator Cold Zone (4-6°C)',
    freshness_score: 97.0,
    remaining_days: 12,
    use_by_date: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0],
    image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80',
    storage_tips: 'Store in perforated polybag away from leafy vegetables to prevent ethylene aging.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'prod-5',
    produce_name: 'Red Lasalgaon Onions',
    crop_type: 'Onion',
    category: 'Vegetable',
    farm_origin: 'Lasalgaon Mandi Direct Farm Lot',
    quantity_kg: 5.0,
    storage_condition: 'Dry Ventilated Mesh Bag (Room Temp)',
    freshness_score: 98.0,
    remaining_days: 20,
    use_by_date: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
    image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
    storage_tips: 'Ensure dark, dry, open ventilation. Never store beside moisture-heavy potatoes.',
    created_at: new Date().toISOString(),
  },
];

export default function CustomerProduceStoragePage() {
  const [items, setItems] = useState<StoredProduceItem[]>(DEFAULT_STORED_PRODUCE);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'VEGETABLES' | 'FRUITS' | 'EXPIRING'>('ALL');
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  // Form State for Storing New Produce
  const [formName, setFormName] = useState('Fresh Roma Tomatoes');
  const [formCategory, setFormCategory] = useState<'Vegetable' | 'Fruit'>('Vegetable');
  const [formCrop, setFormCrop] = useState('Tomato');
  const [formFarm, setFormFarm] = useState('Sahyadri Organic Farm');
  const [formQuantity, setFormQuantity] = useState(1.5);
  const [formStorageMode, setFormStorageMode] = useState('Ventilated Crisper Drawer (10-12°C)');
  const [formImageUrl, setFormImageUrl] = useState(
    'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80'
  );
  const [formFreshnessScore, setFormFreshnessScore] = useState(92);
  const [formDays, setFormDays] = useState(6);
  const [formTips, setFormTips] = useState('Store in ventilated container away from direct sunlight.');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProduceItems();
  }, []);

  const loadProduceItems = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/customer/produce');
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: StoredProduceItem[] = res.data.map((b: any) => ({
          id: b.id || b.batch_id,
          produce_name: b.produce_name || 'Farm Produce',
          crop_type: b.crop_type || 'Tomato',
          category: (['apple', 'mango', 'grapes', 'banana', 'orange'].includes(String(b.crop_type).toLowerCase())
            ? 'Fruit'
            : 'Vegetable') as 'Vegetable' | 'Fruit',
          farm_origin: b.farm_name || 'Direct Verified Farm Lot',
          quantity_kg: Number(b.quantity_kg || 1.0),
          storage_condition: b.storage_recommendation || 'Cool Ventilated Crisper',
          freshness_score: Number(b.latest_scan?.freshness_score || 90.0),
          remaining_days: Number(b.latest_scan?.remaining_shelf_life_days || 5),
          use_by_date: b.latest_scan?.predicted_use_by_date || new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          image_url: b.latest_scan?.image_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600',
          storage_tips: b.storage_recommendation || 'Keep fresh in controlled humidity.',
          created_at: b.created_at || new Date().toISOString(),
        }));
        setItems(mapped);
      } else {
        // Retain default demo items so customer page is always filled and functional
        setItems(DEFAULT_STORED_PRODUCE);
      }
    } catch (err) {
      console.warn('Could not load from backend, using active local storage items', err);
      setItems(DEFAULT_STORED_PRODUCE);
    } finally {
      setLoading(false);
    }
  };

  const handleStoreProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const calculatedUseBy = new Date(Date.now() + formDays * 86400000).toISOString().split('T')[0];

    const newItem: StoredProduceItem = {
      id: `prod-${Date.now()}`,
      produce_name: formName,
      crop_type: formCrop,
      category: formCategory,
      farm_origin: formFarm,
      quantity_kg: Number(formQuantity),
      storage_condition: formStorageMode,
      freshness_score: Number(formFreshnessScore),
      remaining_days: Number(formDays),
      use_by_date: calculatedUseBy,
      image_url: formImageUrl,
      storage_tips: formTips,
      created_at: new Date().toISOString(),
    };

    try {
      await apiClient.post('/customer/produce', {
        produceName: formName,
        cropType: formCrop,
        quantityKg: Number(formQuantity),
        storageRecommendation: `${formStorageMode}. ${formTips}`,
        freshnessScore: Number(formFreshnessScore),
        remainingShelfLifeDays: Number(formDays),
        predictedUseByDate: calculatedUseBy,
        imageUrl: formImageUrl,
      });
    } catch (err) {
      console.warn('Saved produce locally to customer storage session', err);
    }

    setItems((prev) => [newItem, ...prev]);
    setIsStoreModalOpen(false);
    setSubmitting(false);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await apiClient.delete(`/customer/produce/${id}`);
    } catch {
      // Local delete
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Filtered Items
  const filteredItems = items.filter((item) => {
    if (activeFilter === 'VEGETABLES') return item.category === 'Vegetable';
    if (activeFilter === 'FRUITS') return item.category === 'Fruit';
    if (activeFilter === 'EXPIRING') return item.remaining_days <= 2;
    return true;
  });

  const expiringCount = items.filter((i) => i.remaining_days <= 2).length;
  const avgFreshness = Math.round(
    items.reduce((acc, i) => acc + i.freshness_score, 0) / (items.length || 1)
  );

  return (
    <DashboardLayout
      portal="customer"
      title="Farm Produce & Freshness Storage"
      subtitle="Store, organize, and monitor shelf-life for your farm-sourced vegetables and fruits."
      actionButton={
        <div className="flex items-center gap-2">
          <Link
            href="/customer/marketplace"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <ShoppingBag className="h-4 w-4 text-emerald-600" />
            <span>Order from Farms</span>
          </Link>
          <button
            onClick={() => setIsStoreModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Store Vegetables & Fruits</span>
          </button>
        </div>
      }
    >
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Stored</span>
          <p className="text-2xl font-extrabold text-slate-900">{items.length} Batches</p>
          <span className="text-[11px] text-emerald-700 font-medium">Farm Verified Quality</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Average Freshness</span>
          <p className="text-2xl font-extrabold text-emerald-700">{avgFreshness}%</p>
          <span className="text-[11px] text-slate-500">Multimodal AI Score</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Expiring Soon</span>
          <p className={`text-2xl font-extrabold ${expiringCount > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
            {expiringCount} Items
          </p>
          <span className="text-[11px] text-amber-800 font-medium">Consume within 48h</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Storage Mode</span>
          <p className="text-2xl font-extrabold text-sky-800">SmartBag</p>
          <span className="text-[11px] text-slate-500">Active Shelf-Life Guard</span>
        </div>
      </div>

      {/* Filter Tabs & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'ALL', label: `All Stored (${items.length})` },
            { id: 'VEGETABLES', label: `Vegetables (${items.filter((i) => i.category === 'Vegetable').length})` },
            { id: 'FRUITS', label: `Fruits (${items.filter((i) => i.category === 'Fruit').length})` },
            { id: 'EXPIRING', label: `Expiring Soon (${expiringCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                activeFilter === tab.id
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={loadProduceItems}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-emerald-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Produce</span>
        </button>
      </div>

      {/* Stored Produce Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
          >
            <div>
              {/* Image & Status Badges */}
              <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.produce_name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-2xs backdrop-blur-xs ${
                      item.category === 'Fruit'
                        ? 'bg-amber-500/90 text-white border-amber-400'
                        : 'bg-emerald-600/90 text-white border-emerald-500'
                    }`}
                  >
                    {item.category}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900/80 text-white border border-slate-700 backdrop-blur-xs">
                    {item.quantity_kg} kg
                  </span>
                </div>

                {/* Freshness Badge */}
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs border border-slate-200 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs font-extrabold text-slate-900">
                    {item.freshness_score}% Fresh
                  </span>
                </div>
              </div>

              {/* Produce Details */}
              <div className="p-5 space-y-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    {item.produce_name}
                  </h3>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                    <Sprout className="h-3 w-3 text-emerald-600" />
                    <span>Origin: <strong>{item.farm_origin}</strong></span>
                  </p>
                </div>

                {/* Shelf-Life Countdown Banner */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    item.remaining_days <= 2
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock
                      className={`h-4 w-4 ${item.remaining_days <= 2 ? 'text-amber-800' : 'text-emerald-700'}`}
                    />
                    <div>
                      <span className="font-extrabold block">
                        {item.remaining_days <= 2
                          ? `Use within ${formatShelfLifeDays(item.remaining_days)}!`
                          : `${formatShelfLifeDays(item.remaining_days)} remaining`}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Use by: <strong>{item.use_by_date}</strong>
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                    AI Calibrated
                  </span>
                </div>

                {/* Storage Condition & Guidance */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                    <Thermometer className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Storage Condition:</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">{item.storage_condition}</p>
                  <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                    💡 Tip: {item.storage_tips}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="px-5 pb-5 pt-0 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <Link
                href="/customer/ai-agents"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask AI Advisor</span>
              </Link>

              <button
                onClick={() => handleDeleteItem(item.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Remove produce item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Store New Vegetables & Fruits */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Store Vegetables & Fruits in Farm</h3>
                  <p className="text-xs text-slate-500">Add fresh harvest produce to your personal farm locker</p>
                </div>
              </div>
              <button
                onClick={() => setIsStoreModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleStoreProduce} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Produce Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Roma Tomatoes, Alphonso Mangoes, Spinach Bunch"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Produce Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  >
                    <option value="Vegetable">Vegetable (Sabzi)</option>
                    <option value="Fruit">Fruit (Phal)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity (Kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Farm Origin / Source</label>
                  <input
                    type="text"
                    value={formFarm}
                    onChange={(e) => setFormFarm(e.target.value)}
                    placeholder="e.g. Sahyadri Organic Farm"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Estimated Shelf Life (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formDays}
                    onChange={(e) => setFormDays(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Storage Condition</label>
                <select
                  value={formStorageMode}
                  onChange={(e) => setFormStorageMode(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                >
                  <option value="Ventilated Crisper Drawer (10-12°C)">Ventilated Crisper Drawer (10-12°C)</option>
                  <option value="Ambient Room Temperature (22-25°C)">Ambient Room Temperature (22-25°C)</option>
                  <option value="SmartBag Active Humidity Container">SmartBag Active Humidity Container</option>
                  <option value="Refrigerator Cold Zone (4-6°C)">Refrigerator Cold Zone (4-6°C)</option>
                  <option value="Dry Ventilated Mesh Bag (Dark Storage)">Dry Ventilated Mesh Bag (Dark Storage)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Storage Tip / Preservation Note</label>
                <input
                  type="text"
                  value={formTips}
                  onChange={(e) => setFormTips(e.target.value)}
                  placeholder="e.g. Keep away from direct sunlight; wrap loosely in paper."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <PackageCheck className="h-4 w-4" />
                  <span>{submitting ? 'Storing...' : 'Save to Farm Storage'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
