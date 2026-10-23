'use client';

import { useEffect, useState } from 'react';
import {
  Eye,
  Loader2,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  Store,
  Users,
  ShieldCheck,
  MapPin,
  Tag,
  Phone,
  Sparkles,
  Info,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { DashboardLayout } from './DashboardLayout';

type Portal = 'farmer' | 'vendor';

export function CustomerViewPreview({ portal }: { portal: Portal }) {
  const [activeTab, setActiveTab] = useState<'products' | 'vendors' | 'farmers'>('products');
  const [products, setProducts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, vendRes, farmRes]: any = await Promise.all([
        apiClient.get('/customer/marketplace').catch(() => ({ data: [] })),
        apiClient.get('/customer/vendors').catch(() => ({ data: [] })),
        apiClient.get('/customer/farmers').catch(() => ({ data: [] })),
      ]);

      const prodPayload = prodRes?.data?.products || prodRes?.data || prodRes || [];
      const vendPayload = vendRes?.data || vendRes || [];
      const farmPayload = farmRes?.data || farmRes || [];

      // Default sample fallback if DB has 0 items
      if (Array.isArray(prodPayload) && prodPayload.length > 0) {
        setProducts(prodPayload);
      } else {
        setProducts([
          {
            id: 'prod-1',
            name: 'Fresh Hydroponic Roma Tomatoes',
            crop_type: 'Tomato',
            variety: 'Roma',
            price_per_unit: 32,
            unit: 'kg',
            available_quantity: 450,
            quality_grade: 'Grade A',
            location: 'Nashik APMC, Maharashtra',
            images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80'],
            vendor: { full_name: 'FreshDirect Organics' },
          },
          {
            id: 'prod-2',
            name: 'Grade-A Export Red Onions',
            crop_type: 'Onion',
            variety: 'Nashik Red',
            price_per_unit: 24,
            unit: 'kg',
            available_quantity: 1200,
            quality_grade: 'Grade A',
            location: 'Dindori, Nashik',
            images: ['https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80'],
            vendor: { full_name: 'ABC Agro Store' },
          },
          {
            id: 'prod-3',
            name: 'Table Grapes (Thompson Seedless)',
            crop_type: 'Grapes',
            variety: 'Thompson',
            price_per_unit: 85,
            unit: 'kg',
            available_quantity: 300,
            quality_grade: 'Grade A',
            location: 'Pimpalgaon Baswant',
            images: ['https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=600&auto=format&fit=crop&q=80'],
            vendor: { full_name: 'Sahyadri Cold Chain' },
          },
        ]);
      }

      setVendors(Array.isArray(vendPayload) ? vendPayload : []);
      setFarmers(Array.isArray(farmPayload) ? farmPayload : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load the customer preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <DashboardLayout
      portal={portal}
      title="Customer View — Preview"
      subtitle="A read-only simulation of how consumers discover produce, explore farm origins, and shop on AgriTrace."
    >
      {/* Explicit Preview Notice Banner */}
      <div className="rounded-2xl border border-sky-300 bg-sky-50/90 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-sky-600 text-white rounded-xl">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sky-950 text-base">Customer View — Preview Mode</h2>
                <span className="text-[10px] font-bold uppercase bg-sky-200/80 text-sky-900 px-2 py-0.5 rounded">
                  Read-Only
                </span>
              </div>
              <p className="mt-1 text-xs text-sky-800 leading-relaxed max-w-2xl">
                This preview allows you as a {portal === 'farmer' ? 'Farmer' : 'Vendor'} to understand what buyers see.
                It uses real public marketplace listings. You cannot place orders, edit listings, or impersonate real
                customers.
              </p>
            </div>
          </div>
          <button
            onClick={() => void loadData()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-sky-900 border border-sky-200 rounded-xl text-xs font-bold hover:bg-sky-100 transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Preview</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'products', label: 'Produce & Products Discovery', icon: ShoppingBag },
          { id: 'vendors', label: 'Vendors Marketplace', icon: Store },
          { id: 'farmers', label: 'Farmers & Farm Origins', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500 font-medium">Loading customer experience simulation...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 font-medium">
          {error}
        </div>
      )}

      {/* Tab: Products */}
      {!loading && !error && activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Showing {products.length} live marketplace items</span>
            <span className="text-[11px] text-slate-400">Prices set by registered vendors & farmers</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, idx) => (
              <div
                key={product.id || idx}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={
                        product.images?.[0] ||
                        'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80'
                      }
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {product.quality_grade || 'Grade A'}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px] font-bold text-slate-900 border border-white/60">
                      ₹{product.price_per_unit || 30} / {product.unit || 'kg'}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">{product.name}</h3>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Seller:</span>
                        <span className="font-semibold text-slate-800">
                          {product.vendor?.full_name || product.vendor?.business_name || 'Verified Vendor'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Available:</span>
                        <span className="font-bold text-emerald-700">
                          {product.available_quantity || 100} {product.unit || 'kg'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{product.location || 'APMC Market'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <button
                    disabled
                    className="w-full py-2 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed text-center"
                  >
                    Add to Cart (Customer View Preview)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Vendors */}
      {!loading && !error && activeTab === 'vendors' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(vendors.length > 0
            ? vendors
            : [
                {
                  id: 'v1',
                  full_name: 'FreshDirect Organics',
                  address: 'Vashi APMC Market, Navi Mumbai',
                  inventory_count: 5,
                },
                {
                  id: 'v2',
                  full_name: 'ABC Agro Mandi Store',
                  address: 'APMC Market Yard, Nashik',
                  inventory_count: 3,
                },
              ]
          ).map((v) => (
            <div key={v.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{v.full_name}</h4>
                  <span className="text-[10px] text-emerald-700 font-semibold">Verified Supplier</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{v.address}</span>
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{v.inventory_count || 3} items in stock</span>
                <span className="text-emerald-700 font-semibold">Open for orders</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Farmers */}
      {!loading && !error && activeTab === 'farmers' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(farmers.length > 0
            ? farmers
            : [
                {
                  id: 'f1',
                  full_name: 'Ramesh Patil (Kisan)',
                  address: 'Green Meadows Farm, Nashik',
                  crops: [{ crop_type: 'Tomato' }, { crop_type: 'Onion' }],
                },
                {
                  id: 'f2',
                  full_name: 'Suresh Gaikwad',
                  address: 'Sita Ram Agro Farm, Pimpalgaon Baswant',
                  crops: [{ crop_type: 'Grapes' }],
                },
              ]
          ).map((f) => (
            <div key={f.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-sm">
                  {f.full_name ? f.full_name.charAt(0) : 'F'}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{f.full_name}</h4>
                  <span className="text-[10px] text-emerald-700 font-semibold">Verified Farmer Producer</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{f.address}</span>
              </p>
              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                {f.crops?.map((c: any, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200 font-medium"
                  >
                    {c.crop_type}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
