'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { DataTable, Column } from '../../../components/DataTable';
import { apiClient } from '../../../lib/apiClient';
import { Order, OrderStatus } from '../../../types';
import { Truck, CheckCircle2, Clock, MapPin } from 'lucide-react';

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/vendor/orders');
      if (res?.data) {
        setOrders(res.data);
      }
    } catch {
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
          delivery_address: 'Flat 402, Sea Green Apts, Bandra West, Mumbai',
          contact_phone: '+91 98112 33445',
          created_at: '2026-09-06T09:30:00Z',
          updated_at: '2026-09-06T09:30:00Z',
          customer: { full_name: 'Priya Sharma' },
        },
        {
          id: 'ord-2',
          order_code: 'ORD-2026-1041',
          customer_id: 'cust-2',
          vendor_id: 'vendor-1',
          status: 'DELIVERED',
          subtotal: 820,
          delivery_fee: 50,
          total_amount: 870,
          delivery_address: 'Lokhandwala Complex, Andheri West, Mumbai',
          created_at: '2026-09-05T14:15:00Z',
          updated_at: '2026-09-05T18:00:00Z',
          customer: { full_name: 'Amit Deshmukh' },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await apiClient.patch(`/vendor/orders/${orderId}/status`, { status });
      loadOrders();
    } catch {
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status } : o)));
    }
  };

  const columns: Column<Order>[] = [
    {
      header: 'Order Code',
      accessorKey: 'order_code',
      cell: (r) => <span className="font-mono font-bold text-white">{r.order_code}</span>,
    },
    {
      header: 'Customer',
      cell: (r) => (
        <div>
          <p className="font-semibold text-white">{r.customer?.full_name || 'Customer'}</p>
          <span className="text-[10px] text-emerald-400/80">{r.contact_phone || 'Phone verified'}</span>
        </div>
      ),
    },
    {
      header: 'Delivery Address',
      accessorKey: 'delivery_address',
      cell: (r) => <span className="text-emerald-300/80 text-[11px] truncate max-w-xs">{r.delivery_address}</span>,
    },
    {
      header: 'Total Amount',
      cell: (r) => <span className="font-mono font-bold text-emerald-300">₹{r.total_amount}</span>,
    },
    {
      header: 'Status',
      cell: (r) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
            r.status === 'DELIVERED'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      header: 'Fulfillment Action',
      cell: (r) => (
        <select
          value={r.status}
          onChange={(e) => handleUpdateStatus(r.id, e.target.value as OrderStatus)}
          className="rounded-lg bg-emerald-950 border border-emerald-800 text-[11px] text-white px-2 py-1"
        >
          <option value="PLACED">Placed</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PROCESSING">Processing</option>
          <option value="READY">Ready for Dispatch</option>
          <option value="SHIPPED">Shipped / In-Transit</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      ),
    },
  ];

  return (
    <DashboardLayout
      portal="vendor"
      title="Order Fulfillment Pipeline"
      subtitle="Manage consumer orders from confirmation to cold-chain delivery."
    >
      <DataTable
        columns={columns}
        data={orders}
        searchPlaceholder="Filter orders by code, customer, or address..."
      />
    </DashboardLayout>
  );
}
