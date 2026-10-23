'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '../../../../lib/apiClient';
import { DashboardLayout } from '../../../../components/DashboardLayout';
import { ArrowLeft, Loader2, MapPin, Package, Phone, Store, Warehouse } from 'lucide-react';

interface VendorDetails {
  id: string;
  full_name: string;
  phone?: string;
  address?: string;
  inventory: Array<{ id: string; product_name: string; crop_type: string; quantity: number; unit: string; location?: string; status: string; updated_at: string }>;
  products: Array<{ id: string; name: string; crop_type: string; variety?: string; price_per_unit: number; unit: string; available_quantity: number; quality_grade: string; location: string }>;
}

export default function FarmerVendorDetailsPage() {
  const params = useParams<{ vendorId: string }>();
  const [vendor, setVendor] = useState<VendorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadVendor = async () => {
      try {
        const response: any = await apiClient.get(`/farmer/vendors/${params.vendorId}`);
        setVendor(response?.data || response);
      } catch (err: any) {
        setError(err?.message || err?.response?.data?.error?.message || 'Could not load this vendor.');
      } finally {
        setLoading(false);
      }
    };
    if (params.vendorId) void loadVendor();
  }, [params.vendorId]);

  return (
    <DashboardLayout portal="farmer" title="Vendor Details" subtitle="Public vendor information and current stock.">
      <Link href="/farmer/vendors" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950"><ArrowLeft className="h-4 w-4" />Back to vendors</Link>
      {loading && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading vendor details...</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!loading && !error && vendor && <><section className="glass-card rounded-2xl p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row"><div className="flex items-start gap-4"><div className="rounded-2xl bg-emerald-100 p-4 text-emerald-700"><Store className="h-7 w-7" /></div><div><h2 className="text-xl font-bold text-slate-900">{vendor.full_name}</h2><p className="mt-1 text-sm text-emerald-700">Registered public vendor profile</p><div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-emerald-700" />{vendor.address}</p>{vendor.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-emerald-700" /><a href={`tel:${vendor.phone}`} className="text-emerald-800 hover:underline">{vendor.phone}</a></p>}</div></div></div><div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><p className="flex items-center gap-2 font-semibold text-slate-900"><Warehouse className="h-4 w-4 text-emerald-700" />Godown information</p><p className="mt-2">Stock locations are shown on each current inventory item below.</p></div></div></section><section><div className="mb-3 flex items-center gap-2"><Package className="h-5 w-5 text-emerald-700" /><h2 className="text-lg font-bold text-slate-900">Current stock and godown locations</h2></div>{vendor.inventory.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">This vendor has no stock recorded yet.</div> : <div className="grid gap-4 md:grid-cols-2">{vendor.inventory.map((item) => <article key={item.id} className="glass-card rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{item.product_name}</h3><p className="mt-1 text-xs text-slate-500">{item.crop_type}</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">{item.status}</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Available quantity</p><p className="font-semibold text-slate-900">{item.quantity} {item.unit}</p></div><div><p className="text-xs text-slate-500">Godown / location</p><p className="font-semibold text-slate-900">{item.location || 'Not provided'}</p></div></div></article>)}</div>}</section>{vendor.products.length > 0 && <section><h2 className="mb-3 text-lg font-bold text-slate-900">Available marketplace products</h2><div className="grid gap-4 md:grid-cols-2">{vendor.products.map((product) => <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">{product.name}</h3><p className="mt-1 text-sm text-slate-600">{product.crop_type}{product.variety ? ` · ${product.variety}` : ''}</p><div className="mt-3 flex justify-between text-sm"><span className="text-slate-600">{product.available_quantity} {product.unit} available</span><span className="font-semibold text-emerald-800">₹{product.price_per_unit}/{product.unit}</span></div><p className="mt-2 text-xs text-slate-500">Pickup/location: {product.location}</p></article>)}</div></section>}</>}
    </DashboardLayout>
  );
}
