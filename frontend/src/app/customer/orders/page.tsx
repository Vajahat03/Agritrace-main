'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { apiClient } from '@/lib/apiClient';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  QrCode, 
  ShoppingBag, 
  ChevronRight, 
  Calendar, 
  MapPin,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price?: number;
  price_per_unit?: number;
  unit?: string;
  batch_id?: string;
  image_url?: string;
}

interface Order {
  id: string;
  created_at: string;
  status: 'PENDING' | 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  total_amount: number;
  delivery_address: string;
  items: OrderItem[];
}

export default function CustomerOrdersPage() {
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/customer/orders');
      if (res && res.data && res.data.length > 0) {
        setOrders(res.data);
      } else {
        // Fallback to localStorage demo orders
        const local = localStorage.getItem('agritrace_demo_orders');
        if (local) {
          setOrders(JSON.parse(local));
        } else {
          // Starter demo orders
          const demoOrders: Order[] = [
            {
              id: 'ORD-894120',
              created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
              status: 'CONFIRMED',
              total_amount: 303.50,
              delivery_address: 'Flat 402, Green Acre Residences, Pune, Maharashtra - 411045',
              items: [
                {
                  product_id: 'prod-001',
                  product_name: 'Fresh Nashik Red Onions (कांदा)',
                  quantity: 5,
                  price_per_unit: 34.50,
                  unit: 'kg',
                  batch_id: 'BAT-2026-NSK-089',
                  image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&auto=format&fit=crop&q=80'
                },
                {
                  product_id: 'prod-002',
                  product_name: 'Hydroponic Vine Tomatoes (टोमॅटो)',
                  quantity: 3,
                  price_per_unit: 42.00,
                  unit: 'kg',
                  batch_id: 'BAT-2026-PUN-012',
                  image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&auto=format&fit=crop&q=80'
                }
              ]
            },
            {
              id: 'ORD-762914',
              created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
              status: 'DELIVERED',
              total_amount: 510.00,
              delivery_address: 'Flat 402, Green Acre Residences, Pune, Maharashtra - 411045',
              items: [
                {
                  product_id: 'prod-003',
                  product_name: 'Nagpur Organic Sweet Oranges (संत्रा)',
                  quantity: 6,
                  price_per_unit: 85.00,
                  unit: 'kg',
                  batch_id: 'BAT-2026-NAG-504',
                  image_url: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=400&auto=format&fit=crop&q=80'
                }
              ]
            }
          ];
          setOrders(demoOrders);
          localStorage.setItem('agritrace_demo_orders', JSON.stringify(demoOrders));
        }
      }
    } catch (err) {
      const local = localStorage.getItem('agritrace_demo_orders');
      if (local) {
        setOrders(JSON.parse(local));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 border border-sky-500/40 text-sky-400">
            <Truck className="w-3.5 h-3.5" /> Out for Delivery
          </span>
        );
      case 'CONFIRMED':
      case 'PLACED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/40 text-amber-400">
            <Clock className="w-3.5 h-3.5" /> Order Confirmed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <DashboardLayout role="customer">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
              <Package className="w-8 h-8 text-emerald-400" />
              {language === 'hi' ? 'आपके ऑर्डर्स' : 'My Orders & Deliveries'}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Track farm-to-doorstep orders and verify immutable harvest passports.
            </p>
          </div>

          <Link
            href="/customer/marketplace"
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md"
          >
            + Order More Produce
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map(n => (
              <div key={n} className="h-44 rounded-2xl bg-slate-900 border border-slate-800" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-4">
            <ShoppingBag className="w-16 h-16 text-slate-600 mx-auto" />
            <h2 className="text-xl font-bold text-slate-200">No Orders Placed Yet</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Discover fresh produce directly from verified farmers and support fair trade agriculture.
            </p>
            <Link
              href="/customer/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg transition-all"
            >
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-6 backdrop-blur-md space-y-6 shadow-xl"
              >
                {/* Order Top Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-extrabold text-slate-100 font-mono">
                        {order.id}
                      </h3>
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(order.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Paid</span>
                    <p className="text-xl font-black text-emerald-400">₹{order.total_amount.toFixed(2)}</p>
                  </div>
                </div>

                {/* Items in Order */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordered Items</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&auto=format&fit=crop&q=80'}
                            alt={item.product_name}
                            className="w-12 h-12 rounded-lg object-cover bg-slate-900 border border-slate-800"
                          />
                          <div>
                            <h5 className="text-xs font-bold text-slate-200 line-clamp-1">{item.product_name}</h5>
                            <p className="text-[11px] text-slate-400">
                              Qty: <strong className="text-slate-300">{item.quantity} {item.unit || 'kg'}</strong> &bull; ₹{((item.price_per_unit || item.unit_price || 0) * item.quantity).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        {item.batch_id && (
                          <Link
                            href={`/trace/batch/${item.batch_id}`}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/60 text-[11px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <QrCode className="w-3 h-3" /> Trace
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Destination */}
                <div className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-slate-400 border-t border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Destination: <strong className="text-slate-300">{order.delivery_address}</strong></span>
                  </div>

                  <Link
                    href="/customer/freshness-bag"
                    className="text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 text-xs"
                  >
                    View in Digital Freshness Bag <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
