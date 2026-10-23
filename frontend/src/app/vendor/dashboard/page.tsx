'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { StatCard } from '../../../components/WeatherWidget';
import { DataTable, Column } from '../../../components/DataTable';
import { apiClient } from '../../../lib/apiClient';
import { VendorInventory, VendorProcurement, Order } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import {
  Package,
  Tractor,
  ShoppingCart,
  Truck,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Store,
  Users,
} from 'lucide-react';

export default function VendorDashboard() {
  const { t } = useLanguage();
  const [metrics, setMetrics] = useState({
    inventoryCount: 4,
    lowStockCount: 1,
    pendingOrdersCount: 2,
    totalProcurements: 3,
    totalRevenue: 24500,
  });
  const [inventory, setInventory] = useState<VendorInventory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVendorDashboard();
  }, []);

  const loadVendorDashboard = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/vendor/dashboard');
      if (res?.data) {
        setMetrics(res.data.metrics || metrics);
        setInventory(res.data.inventory || []);
        setOrders(res.data.recentOrders || []);
      }
    } catch {
      // Fallback demo data
      setInventory([
        {
          id: 'inv-1',
          vendor_id: 'vendor-1',
          batch_id: 'batch-1',
          product_name: 'Fresh Roma Tomatoes',
          crop_type: 'Tomato',
          quantity: 150,
          unit: 'kg',
          status: 'IN_STOCK',
          location: 'Cold Storage Room A',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          batch: { batch_code: 'TOM-2026-0001', quality_grade: 'Grade A', harvest_date: '2026-09-01' },
        },
        {
          id: 'inv-2',
          vendor_id: 'vendor-1',
          batch_id: 'batch-2',
          product_name: 'Nashik Red Onions',
          crop_type: 'Onion',
          quantity: 8, // Low stock
          unit: 'quintal',
          status: 'LOW_STOCK',
          location: 'Warehouse Floor 2',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          batch: { batch_code: 'ONI-2026-0002', quality_grade: 'Grade A', harvest_date: '2026-09-03' },
        },
      ]);
      setOrders([
        {
          id: 'ord-1',
          order_code: 'ORD-2026-1042',
          customer_id: 'cust-1',
          vendor_id: 'vendor-1',
          status: 'PROCESSING',
          subtotal: 1850,
          delivery_fee: 50,
          total_amount: 1900,
          delivery_address: 'Bandra West, Mumbai',
          created_at: '2026-09-06T09:30:00Z',
          updated_at: '2026-09-06T09:30:00Z',
          customer: { full_name: 'Priya Sharma' },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const inventoryColumns: Column<VendorInventory>[] = [
    {
      header: 'Product',
      accessorKey: 'product_name',
      cell: (r) => <span className="font-bold text-slate-900">{r.product_name}</span>,
    },
    {
      header: 'Batch Reference',
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-700">
          {r.batch?.batch_code || 'Direct Batch'}
        </span>
      ),
    },
    {
      header: 'Available Stock',
      cell: (r) => (
        <span className={`font-extrabold ${r.quantity < 10 ? 'text-amber-700' : 'text-slate-900'}`}>
          {r.quantity} {r.unit}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (r) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            r.status === 'LOW_STOCK'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <DashboardLayout
      portal="vendor"
      title="Vendor Operations Hub"
      subtitle="Direct farmer batch procurement, stock inventory control, and customer order fulfillment."
      actionButton={
        <div className="flex items-center gap-2">
          <Link
            href="/vendor/farmers"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            <Users className="h-4 w-4 text-emerald-600" />
            <span>Discover Farmers</span>
          </Link>
          <Link
            href="/vendor/procurement"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <Tractor className="h-4 w-4" />
            <span>Procure Farmer Batch</span>
          </Link>
        </div>
      }
    >
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Stock Items"
          value={metrics.inventoryCount}
          subtitle="Stock items tracked"
          icon={Package}
          color="emerald"
        />
        <StatCard
          title="Low Stock Alerts"
          value={metrics.lowStockCount}
          subtitle="Below safety threshold"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Pending Orders"
          value={metrics.pendingOrdersCount}
          subtitle="Awaiting fulfillment"
          icon={Truck}
          color="sky"
        />
        <StatCard
          title="Gross Revenue"
          value={`₹${metrics.totalRevenue.toLocaleString()}`}
          subtitle="Completed customer sales"
          icon={DollarSign}
          color="emerald"
        />
      </div>

      {/* Inventory & Recent Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Stock Overview */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              <span>Current Inventory Stock</span>
            </h3>
            <Link
              href="/vendor/inventory"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              Manage Stock <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <DataTable
            columns={inventoryColumns}
            data={inventory}
            pageSize={4}
            searchPlaceholder="Search inventory by crop or name..."
          />
        </div>

        {/* Fulfillment Pipeline */}
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="h-4 w-4 text-sky-600" />
              <span>Orders Needing Action</span>
            </h3>
            <Link
              href="/vendor/orders"
              className="text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1"
            >
              All Orders <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-slate-900">{ord.order_code}</span>
                  <p className="text-slate-500 mt-0.5">
                    Customer: <strong>{ord.customer?.full_name || 'Consumer'}</strong> • {ord.delivery_address}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 text-sm">₹{ord.total_amount}</span>
                  <div className="mt-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                      {ord.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
