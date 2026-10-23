'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { StatCard } from '../../../components/WeatherWidget';
import { apiClient } from '../../../lib/apiClient';
import { FreshnessBagItem, Order } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { formatShelfLifeDays } from '../../../lib/formatters';
import {
  ScanLine,
  ShoppingBag,
  Package,
  Heart,
  Clock,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';

export default function CustomerDashboard() {
  const { t } = useLanguage();
  const [bagItems, setBagItems] = useState<FreshnessBagItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState({
    activeFreshnessItems: 3,
    itemsExpiringSoon: 1,
    totalOrders: 4,
    savedFavorites: 6,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerDashboard();
  }, []);

  const loadCustomerDashboard = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/customer/dashboard');
      if (res?.data) {
        setMetrics(res.data.metrics || metrics);
        setBagItems(res.data.freshnessBag || []);
        setOrders(res.data.recentOrders || []);
      }
    } catch {
      setBagItems([
        {
          id: 'bag-1',
          customer_id: 'cust-1',
          produce_name: 'Roma Tomatoes (500g)',
          crop_type: 'Tomato',
          current_status: 'ACTIVE',
          storage_recommendation: 'Store at 10-12°C in ventilated container',
          created_at: '2026-09-04T12:00:00Z',
          updated_at: '2026-09-04T12:00:00Z',
          latest_scan: {
            id: 'scan-1',
            bag_id: 'bag-1',
            customer_id: 'cust-1',
            image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
            scan_date: '2026-09-04T12:00:00Z',
            freshness_score: 91.5,
            remaining_shelf_life_days: 2, // Expiring soon
            predicted_use_by_date: '2026-09-08',
            prediction_interval_lower_days: 1,
            prediction_interval_upper_days: 3,
            model_name: 'agritrace-multimodal-shelf-v1',
            model_version: '1.0.0',
          },
        },
        {
          id: 'bag-2',
          customer_id: 'cust-1',
          produce_name: 'Fresh Spinach Bunch',
          crop_type: 'Spinach',
          current_status: 'ACTIVE',
          storage_recommendation: 'Keep dry in paper wrap inside crisper drawer',
          created_at: '2026-09-05T08:00:00Z',
          updated_at: '2026-09-05T08:00:00Z',
          latest_scan: {
            id: 'scan-2',
            bag_id: 'bag-2',
            customer_id: 'cust-1',
            image_url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
            scan_date: '2026-09-05T08:00:00Z',
            freshness_score: 95.0,
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

  return (
    <DashboardLayout
      portal="customer"
      title="Consumer Freshness & Market Hub"
      subtitle="Track your Digital Freshness Bag, estimated use-by windows, and order farm-verified fresh produce."
      actionButton={
        <div className="flex items-center gap-2">
          <Link
            href="/customer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <PlusCircle className="h-4 w-4 text-emerald-600" />
            <span>Store Farm Produce</span>
          </Link>
          <Link
            href="/customer/freshness-bag"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <ScanLine className="h-4 w-4" />
            <span>Open Freshness Bag</span>
          </Link>
        </div>
      }
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Digital Freshness Bag"
          value={metrics.activeFreshnessItems}
          subtitle="Items currently tracked"
          icon={ScanLine}
          color="emerald"
        />
        <StatCard
          title="Expiring Soon"
          value={metrics.itemsExpiringSoon}
          subtitle="Use within 48 hours"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Total Orders"
          value={metrics.totalOrders}
          subtitle="Farm-to-table deliveries"
          icon={Package}
          color="sky"
        />
        <StatCard
          title="Saved Favorites"
          value={metrics.savedFavorites}
          subtitle="Preferred organic produce"
          icon={Heart}
          color="purple"
        />
      </div>

      {/* Main Grid: Freshness Bag Summary & Marketplace Shortcut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Freshness Bag Section */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ScanLine className="h-4 w-4 text-emerald-600" />
              <span>Digital Freshness Bag (At Home)</span>
            </h3>
            <Link
              href="/customer/freshness-bag"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Scan / Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {bagItems.length === 0 ? (
              <div className="py-8 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-200">
                <ScanLine className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 max-w-xs mx-auto">
                  No produce stored in your farm locker yet. Store your fresh vegetables and fruits to track shelf-life and freshness.
                </p>
                <Link
                  href="/customer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Store Vegetables & Fruits</span>
                </Link>
              </div>
            ) : (
              bagItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-200 shrink-0 border border-slate-200">
                      <img
                        src={item.latest_scan?.image_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200'}
                        alt={item.produce_name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{item.produce_name}</h4>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Est. Use-By: <span className="font-bold text-amber-800">{item.latest_scan?.predicted_use_by_date}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        (item.latest_scan?.remaining_shelf_life_days ?? 5) <= 2
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {item.latest_scan?.remaining_shelf_life_days !== undefined
                        ? `${formatShelfLifeDays(item.latest_scan.remaining_shelf_life_days)} left`
                        : 'N/A'}
                    </span>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      Freshness: {item.latest_scan?.freshness_score}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Marketplace Shortcut */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 inline-block">
              Direct Farmer Produce
            </span>
            <h3 className="text-xl font-bold text-slate-900 leading-tight">
              Order Verified Produce Direct From Harvest
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Explore local farm harvest batches, inspect fertilizer & water history before ordering, and track freshness upon delivery.
            </p>
          </div>

          <Link
            href="/customer/marketplace"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Browse Produce Marketplace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
