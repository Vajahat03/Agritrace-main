'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { apiClient } from '@/lib/apiClient';
import { 
  Heart, 
  ShoppingBag, 
  ArrowRight, 
  Trash2, 
  QrCode, 
  Sparkles,
  Store,
  CheckCircle2
} from 'lucide-react';

interface FavoriteProduct {
  id: string;
  product_id: string;
  name: string;
  category: string;
  price_per_unit: number;
  unit: string;
  quality_grade?: string;
  image_url?: string;
  batch_id?: string;
  vendor_name?: string;
}

export default function CustomerFavoritesPage() {
  const { t, language } = useLanguage();
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/customer/favorites');
      if (res && res.data && res.data.length > 0) {
        setFavorites(res.data);
      } else {
        // High quality demo fallback
        setFavorites([
          {
            id: 'fav-1',
            product_id: 'prod-001',
            name: 'Fresh Nashik Red Onions (कांदा)',
            category: 'Vegetable',
            price_per_unit: 34.50,
            unit: 'kg',
            quality_grade: 'Grade A+',
            image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
            batch_id: 'BAT-2026-NSK-089',
            vendor_name: 'Sahyadri Agri Hub'
          },
          {
            id: 'fav-2',
            product_id: 'prod-003',
            name: 'Nagpur Organic Sweet Oranges (संत्रा)',
            category: 'Fruit',
            price_per_unit: 85.00,
            unit: 'kg',
            quality_grade: 'Grade A+',
            image_url: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=600&auto=format&fit=crop&q=80',
            batch_id: 'BAT-2026-NAG-504',
            vendor_name: 'Vidarbha Organic FPO'
          }
        ]);
      }
    } catch (err) {
      console.warn('API error, using demo favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const removeFavorite = async (id: string, productId: string) => {
    try {
      await apiClient.delete(`/customer/favorites/${productId}`);
    } catch (e) {
      // Local demo fallback
    }
    setFavorites(prev => prev.filter(f => f.id !== id));
    showToast('Removed from favorites');
  };

  const handleAddToCart = (product: FavoriteProduct) => {
    const cartStr = localStorage.getItem('agritrace_demo_cart') || '[]';
    const cart = JSON.parse(cartStr);
    const existing = cart.find((i: any) => i.product_id === product.product_id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: 'item-' + Date.now(),
        product_id: product.product_id,
        product_name: product.name,
        price_per_unit: product.price_per_unit,
        quantity: 1,
        unit: product.unit,
        image_url: product.image_url,
        batch_id: product.batch_id
      });
    }
    localStorage.setItem('agritrace_demo_cart', JSON.stringify(cart));
    showToast(`🛒 Added ${product.name} to cart!`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
              <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
              {language === 'hi' ? 'पसंदीदा फसलें व उत्पाद' : 'Favorite Farm Produce'}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Quickly reorder and keep track of high quality produce from your trusted farmers.
            </p>
          </div>

          <Link
            href="/customer/marketplace"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            + Discover More Produce
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-80 bg-slate-900 rounded-2xl border border-slate-800" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-4">
            <Heart className="w-16 h-16 text-slate-600 mx-auto" />
            <h2 className="text-xl font-bold text-slate-200">No Favorites Saved Yet</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click the heart icon on any product in the marketplace to bookmark it for quick access.
            </p>
            <Link
              href="/customer/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg transition-all"
            >
              Explore Marketplace <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between backdrop-blur-md transition-all duration-300"
              >
                <div className="relative aspect-[16/10] bg-slate-950">
                  <img
                    src={fav.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80'}
                    alt={fav.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

                  {fav.quality_grade && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-slate-950 shadow-md">
                      {fav.quality_grade}
                    </span>
                  )}

                  <button
                    onClick={() => removeFavorite(fav.id, fav.product_id)}
                    className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 text-rose-400 border border-slate-700/60 transition-colors"
                    title="Remove from favorites"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <Store className="w-3.5 h-3.5" /> {fav.vendor_name || 'Agri Hub'}
                    </span>
                    <h3 className="text-base font-bold text-slate-100">{fav.name}</h3>
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black text-slate-100">
                        ₹{fav.price_per_unit.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ {fav.unit}</span>
                      </span>

                      {fav.batch_id && (
                        <Link
                          href={`/trace/batch/${fav.batch_id}`}
                          className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <QrCode className="w-3.5 h-3.5" /> Trace
                        </Link>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/customer/marketplace/${fav.product_id}`}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold text-center transition-colors"
                      >
                        Details
                      </Link>
                      <button
                        onClick={() => handleAddToCart(fav)}
                        className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-md"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
