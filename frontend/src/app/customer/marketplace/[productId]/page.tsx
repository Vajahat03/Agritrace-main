'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { apiClient } from '@/lib/apiClient';
import { 
  ArrowLeft, 
  ShoppingBag, 
  Heart, 
  ShieldCheck, 
  QrCode, 
  Calendar, 
  MapPin, 
  Sparkles, 
  Award, 
  Clock, 
  Truck, 
  CheckCircle2, 
  UserCheck, 
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';

interface ProductDetail {
  id: string;
  vendor_id: string;
  name: string;
  category: string;
  variety?: string;
  description: string;
  price_per_unit: number;
  unit: string;
  available_stock: number;
  quality_grade?: string;
  shelf_life_days_est?: number;
  image_url?: string;
  batch_id?: string;
  vendor_name?: string;
  farmer_name?: string;
  farm_location?: string;
  harvest_date?: string;
  soil_type?: string;
  fertilizer_summary?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, language } = useLanguage();
  const productId = params?.productId as string;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get(`/customer/products/${productId}`);
      if (res && res.data) {
        setProduct(res.data);
      } else {
        // High-fidelity fallback based on ID
        setProduct({
          id: productId || 'prod-001',
          vendor_id: 'v-01',
          name: 'Fresh Nashik Red Onions (कांदा)',
          category: 'Vegetable',
          variety: 'Gavran Supreme',
          description: 'Naturally cured, pungent Nashik red onions cultivated with micro-drip fertigation. High dry matter content ensures exceptional storage life without chemical sprout inhibitors. Every bulb has an immutable trace ledger verified on Supabase.',
          price_per_unit: 34.50,
          unit: 'kg',
          available_stock: 450,
          quality_grade: 'Grade A+ (Export Ready)',
          shelf_life_days_est: 28,
          image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=1000&auto=format&fit=crop&q=80',
          batch_id: 'BAT-2026-NSK-089',
          vendor_name: 'Sahyadri Agri Hub FPO',
          farmer_name: 'Dnyaneshwar Patil',
          farm_location: 'Niphad Taluka, Nashik, Maharashtra',
          harvest_date: '2026-08-30',
          soil_type: 'Medium Black Clayey Loam (pH 7.2)',
          fertilizer_summary: '100% Organic Vermicompost + Jeevamrut Bio-Nutrient'
        });
      }
    } catch (err) {
      console.warn('API error, using demo fallback:', err);
      setProduct({
        id: productId || 'prod-001',
        vendor_id: 'v-01',
        name: 'Fresh Nashik Red Onions (कांदा)',
        category: 'Vegetable',
        variety: 'Gavran Supreme',
        description: 'Naturally cured, pungent Nashik red onions cultivated with micro-drip fertigation. High dry matter content ensures exceptional storage life without chemical sprout inhibitors. Every bulb has an immutable trace ledger verified on AgriTrace.',
        price_per_unit: 34.50,
        unit: 'kg',
        available_stock: 450,
        quality_grade: 'Grade A+ (Export Ready)',
        shelf_life_days_est: 28,
        image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=1000&auto=format&fit=crop&q=80',
        batch_id: 'BAT-2026-NSK-089',
        vendor_name: 'Sahyadri Agri Hub FPO',
        farmer_name: 'Dnyaneshwar Patil',
        farm_location: 'Niphad Taluka, Nashik, Maharashtra',
        harvest_date: '2026-08-30',
        soil_type: 'Medium Black Clayey Loam (pH 7.2)',
        fertilizer_summary: '100% Organic Vermicompost + Jeevamrut Bio-Nutrient'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      setAddingToCart(true);
      await apiClient.post('/customer/cart', {
        product_id: product.id,
        quantity: quantity,
      });
      showToast(`🛒 Added ${quantity} ${product.unit} of ${product.name} to cart!`);
    } catch (err) {
      const cartStr = localStorage.getItem('agritrace_demo_cart') || '[]';
      const cart = JSON.parse(cartStr);
      const existing = cart.find((i: any) => i.product_id === product.id);
      if (existing) {
        existing.quantity += quantity;
      } else {
        cart.push({
          id: 'item-' + Date.now(),
          product_id: product.id,
          product_name: product.name,
          price_per_unit: product.price_per_unit,
          quantity: quantity,
          unit: product.unit,
          image_url: product.image_url,
          batch_id: product.batch_id
        });
      }
      localStorage.setItem('agritrace_demo_cart', JSON.stringify(cart));
      showToast(`🛒 Added ${quantity} ${product.unit} to cart!`);
    } finally {
      setAddingToCart(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (loading) {
    return (
      <DashboardLayout role="customer">
        <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
          <div className="h-6 w-32 bg-slate-800 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-96 bg-slate-900 rounded-3xl" />
            <div className="space-y-4">
              <div className="h-8 bg-slate-900 rounded w-3/4" />
              <div className="h-4 bg-slate-900 rounded w-1/2" />
              <div className="h-24 bg-slate-900 rounded" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!product) {
    return (
      <DashboardLayout role="customer">
        <div className="text-center py-20">
          <h2 className="text-xl font-bold text-slate-200">Product Not Found</h2>
          <Link href="/customer/marketplace" className="mt-4 inline-block text-emerald-400 font-semibold hover:underline">
            &larr; Back to Marketplace
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="customer">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 px-5 py-3 rounded-xl font-semibold shadow-2xl border border-emerald-300 flex items-center gap-2 animate-bounce">
            <Sparkles className="w-5 h-5" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Back Link & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/customer/marketplace"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Marketplace
          </Link>
          <div className="text-xs text-slate-500">
            Marketplace <ChevronRight className="inline w-3 h-3" /> {product.category} <ChevronRight className="inline w-3 h-3" /> {product.name}
          </div>
        </div>

        {/* Main Product Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left: Media & Trace QR Badge */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl aspect-square">
              <img
                src={product.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1000&auto=format&fit=crop&q=80'}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              
              {product.quality_grade && (
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> {product.quality_grade}
                </div>
              )}

              <button
                onClick={() => {
                  setIsFavorite(!isFavorite);
                  showToast(!isFavorite ? '❤️ Saved to favorites!' : 'Removed from favorites');
                }}
                className="absolute top-4 right-4 p-3 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-rose-400 transition-colors"
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>

              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <span>Predicted Shelf Life:</span>
                  <strong className="text-emerald-400">~{product.shelf_life_days_est || 14} days remaining</strong>
                </div>
                <span className="text-[10px] text-slate-500">AI Verified</span>
              </div>
            </div>

            {/* Traceability Callout Card */}
            {product.batch_id && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">Immutable Batch Passport</h4>
                    <p className="text-[11px] text-slate-400 font-mono">ID: {product.batch_id}</p>
                  </div>
                </div>

                <Link
                  href={`/trace/batch/${product.batch_id}`}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-1"
                >
                  Verify Soil-to-Table <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Right: Details & Purchase Actions */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            
            <div className="space-y-4">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-emerald-400 border border-slate-700">
                  {product.category} &bull; {product.variety || 'Standard'}
                </span>
                <h1 className="text-2xl md:text-3xl font-black text-slate-100 mt-2 tracking-tight">
                  {product.name}
                </h1>
              </div>

              {/* Price Banner */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-semibold">Direct Farm Gate Price</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black text-emerald-400">₹{product.price_per_unit.toFixed(2)}</span>
                    <span className="text-sm text-slate-400">/ {product.unit}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-medium">Availability</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {product.available_stock} {product.unit} in stock
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Product Story & Agronomics</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Farm Origin Proof Card */}
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Origin Verification
                </h4>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Farmer / Producer:</span>
                    <strong className="text-slate-200">{product.farmer_name || 'Verified FPO Member'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Location:</span>
                    <strong className="text-slate-200">{product.farm_location || 'Maharashtra, India'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Harvest Date:</span>
                    <strong className="text-slate-200">{product.harvest_date || 'Aug 2026'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nutrient Protocol:</span>
                    <strong className="text-emerald-400">{product.fertilizer_summary || 'Zero-Residue Bio'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Quantity Selector and Purchase CTA */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300">Select Quantity ({product.unit}):</span>
                
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold flex items-center justify-center transition-colors"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-bold text-slate-100 text-sm">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.available_stock, quantity + 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="text-slate-400">Total Calculation:</span>
                <span className="text-xl font-black text-slate-100">
                  ₹{(product.price_per_unit * quantity).toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || product.available_stock <= 0}
                  className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  {addingToCart ? 'Adding...' : 'Add to Cart'}
                </button>

                <button
                  onClick={async () => {
                    await handleAddToCart();
                    router.push('/customer/cart');
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Truck className="w-4 h-4" /> Buy Now
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
