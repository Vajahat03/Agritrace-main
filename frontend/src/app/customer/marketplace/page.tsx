'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { apiClient } from '@/lib/apiClient';
import { 
  Search, 
  Filter, 
  ShoppingBag, 
  Heart, 
  Sparkles, 
  ShieldCheck, 
  QrCode, 
  ArrowRight,
  TrendingUp,
  Tag,
  Store,
  Layers
} from 'lucide-react';

interface Product {
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
  is_favorite?: boolean;
}

export default function CustomerMarketplacePage() {
  const { t, language } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<number>(200);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: language === 'hi' ? 'सभी किस्में' : 'All Produce' },
    { id: 'Vegetable', label: language === 'hi' ? 'सब्जियां' : 'Vegetables' },
    { id: 'Fruit', label: language === 'hi' ? 'फल' : 'Fruits' },
    { id: 'Grain', label: language === 'hi' ? 'अनाज व दालें' : 'Grains & Pulses' },
    { id: 'Organic', label: language === 'hi' ? 'जैविक' : 'Certified Organic' },
  ];

  const fetchMarketplace = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/customer/products');
      if (res && res.data && res.data.length > 0) {
        setProducts(res.data);
      } else {
        // High fidelity demo items with verified traceability batches
        setProducts([
          {
            id: 'prod-001',
            vendor_id: 'v-01',
            name: 'Fresh Nashik Red Onions (कांदा)',
            category: 'Vegetable',
            variety: 'Gavran Supreme',
            description: 'Naturally cured, pungent Nashik red onions with high dry matter and zero chemical storage inhibitors.',
            price_per_unit: 34.50,
            unit: 'kg',
            available_stock: 450,
            quality_grade: 'Grade A+',
            shelf_life_days_est: 28,
            image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
            batch_id: 'BAT-2026-NSK-089',
            vendor_name: 'Sahyadri Agri Hub'
          },
          {
            id: 'prod-002',
            vendor_id: 'v-01',
            name: 'Hydroponic Vine Tomatoes (टोमॅटो)',
            category: 'Vegetable',
            variety: 'Roma Hybrid',
            description: 'Firm, pesticide-residue-free vine tomatoes with high lycopene content. Harvested at peak breaker stage.',
            price_per_unit: 42.00,
            unit: 'kg',
            available_stock: 180,
            quality_grade: 'Grade A',
            shelf_life_days_est: 14,
            image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
            batch_id: 'BAT-2026-PUN-012',
            vendor_name: 'Western Ghats Fresh'
          },
          {
            id: 'prod-003',
            vendor_id: 'v-02',
            name: 'Nagpur Organic Sweet Oranges (संत्रा)',
            category: 'Fruit',
            variety: 'Nagpur Mandarin',
            description: 'GI-Tagged juicy mandarins grown under integrated biodynamic micro-drip fertigation.',
            price_per_unit: 85.00,
            unit: 'kg',
            available_stock: 320,
            quality_grade: 'Grade A+',
            shelf_life_days_est: 18,
            image_url: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=600&auto=format&fit=crop&q=80',
            batch_id: 'BAT-2026-NAG-504',
            vendor_name: 'Vidarbha Organic FPO'
          },
          {
            id: 'prod-004',
            vendor_id: 'v-03',
            name: 'Pusa Basmati 1121 Extra Long Grain',
            category: 'Grain',
            variety: '1121 Aged',
            description: 'Single-estate matured basmati rice with exceptional elongation ratio (2.5x) and delicate aroma.',
            price_per_unit: 145.00,
            unit: 'kg',
            available_stock: 850,
            quality_grade: 'Premium Export',
            shelf_life_days_est: 365,
            image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
            batch_id: 'BAT-2026-BAS-301',
            vendor_name: 'Karnal Grains Collective'
          },
          {
            id: 'prod-005',
            vendor_id: 'v-02',
            name: 'Sharbati Gold Wheat (शरबती गहू)',
            category: 'Grain',
            variety: 'Sehore Sharbati',
            description: 'Heavy golden rain-fed grains from black cotton soils of Sehore. High protein and natural sweetness.',
            price_per_unit: 58.00,
            unit: 'kg',
            available_stock: 1200,
            quality_grade: 'Grade A',
            shelf_life_days_est: 240,
            image_url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&auto=format&fit=crop&q=80',
            batch_id: 'BAT-2026-SEH-119',
            vendor_name: 'Central India Mills'
          },
          {
            id: 'prod-006',
            vendor_id: 'v-01',
            name: 'Green Crisp Capsicum / Bell Pepper',
            category: 'Vegetable',
            variety: 'Indra F1',
            description: 'Thick-walled crunchy bell peppers from climate-controlled polyhouse setups.',
            price_per_unit: 65.00,
            unit: 'kg',
            available_stock: 95,
            quality_grade: 'Grade A',
            shelf_life_days_est: 12,
            image_url: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80',
            batch_id: 'BAT-2026-CAP-044',
            vendor_name: 'Sahyadri Agri Hub'
          }
        ]);
      }
    } catch (err) {
      console.warn('API fetch fallback to demo products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketplace();
  }, []);

  const handleAddToCart = async (product: Product) => {
    try {
      setAddingToCart(product.id);
      await apiClient.post('/customer/cart', {
        product_id: product.id,
        quantity: 1,
      });
      showToast(`🛒 Added 1 ${product.unit} of ${product.name} to cart!`);
    } catch (err) {
      // In demo fallback, store in localstorage cart
      const cartStr = localStorage.getItem('agritrace_demo_cart') || '[]';
      const cart = JSON.parse(cartStr);
      const existing = cart.find((i: any) => i.product_id === product.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({
          id: 'item-' + Date.now(),
          product_id: product.id,
          product_name: product.name,
          price_per_unit: product.price_per_unit,
          quantity: 1,
          unit: product.unit,
          image_url: product.image_url,
          batch_id: product.batch_id
        });
      }
      localStorage.setItem('agritrace_demo_cart', JSON.stringify(cart));
      showToast(`🛒 Added 1 ${product.unit} of ${product.name} to cart!`);
    } finally {
      setAddingToCart(null);
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        showToast('Removed from favorites');
      } else {
        next.add(id);
        showToast('❤️ Saved to favorites!');
      }
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.variety && p.variety.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesGrade = selectedGrade === 'all' || (p.quality_grade && p.quality_grade.includes(selectedGrade));
    const matchesPrice = p.price_per_unit <= maxPrice;
    return matchesSearch && matchesCategory && matchesGrade && matchesPrice;
  });

  return (
    <DashboardLayout role="customer">
      <div className="space-y-8 max-w-7xl mx-auto">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/90 backdrop-blur-md text-white px-5 py-3 rounded-xl shadow-2xl border border-emerald-400/30 flex items-center gap-3 animate-bounce">
            <Sparkles className="w-5 h-5 text-emerald-100" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        )}

        {/* Hero Header Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900/60 via-slate-900/80 to-emerald-950/70 border border-emerald-500/20 p-8 md:p-10 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" /> 100% Cryptographically Traceable Produce
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight leading-tight">
              Farm-To-Fork Freshness, <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
                Direct From Soil
              </span>
            </h1>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              Every item has an immutable cryptographic harvest certificate, AI-inspected quality grade, and real-time shelf life prediction.
            </p>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
            <div>
              <p className="text-xs text-slate-400 font-medium">Active Farmers & FPOs</p>
              <p className="text-xl font-bold text-slate-100">1,420+</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Harvest Traceability</p>
              <p className="text-xl font-bold text-emerald-400">100% On-Chain</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Avg Freshness Lead</p>
              <p className="text-xl font-bold text-teal-300">&lt; 18 Hours</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Residue Free Tested</p>
              <p className="text-xl font-bold text-slate-100">Certified</p>
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md space-y-5">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search crops (e.g., Nashik Onion, Tomato, Basmati)..."
                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold'
                      : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Controls (Grade, Max Price) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800/50 text-xs text-slate-400">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Grade:</span>
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="all">All Grades</option>
                  <option value="A+">Grade A+ (Export)</option>
                  <option value="A">Grade A (Premium)</option>
                  <option value="B">Grade B (Standard)</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span>Max Price: <strong className="text-slate-200">₹{maxPrice}/unit</strong></span>
                <input
                  type="range"
                  min="20"
                  max="300"
                  step="5"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-28 accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div>
              Showing <strong className="text-emerald-400">{filteredProducts.length}</strong> items in stock
            </div>
          </div>
        </div>

        {/* Product Catalog Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-96 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800/60 p-8">
            <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-200">No Produce Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your search query, price slider, or category filter to discover fresh produce.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const isFav = favorites.has(product.id);
              return (
                <div
                  key={product.id}
                  className="group relative bg-slate-900/70 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-950/30 flex flex-col justify-between backdrop-blur-md"
                >
                  {/* Top Image & Badges */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-950">
                    <img
                      src={product.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80'}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                    {/* Quality Badge */}
                    {product.quality_grade && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/90 text-slate-950 shadow-md backdrop-blur-sm">
                        {product.quality_grade}
                      </span>
                    )}

                    {/* Favorite Button */}
                    <button
                      onClick={() => toggleFavorite(product.id)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 hover:bg-slate-900 border border-slate-700/60 text-slate-200 hover:text-rose-400 transition-colors"
                      aria-label="Save to favorites"
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>

                    {/* Shelf Life Chip */}
                    {product.shelf_life_days_est && (
                      <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-900/80 border border-slate-700/60 text-emerald-300">
                        ⏱️ Est. Shelf Life: ~{product.shelf_life_days_est} days
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-medium text-emerald-400">
                          <Store className="w-3.5 h-3.5" />
                          {product.vendor_name || 'AgriTrace Direct'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {product.category}
                        </span>
                      </div>

                      <Link href={`/customer/marketplace/${product.id}`} className="block group-hover:text-emerald-400 transition-colors">
                        <h3 className="text-base font-bold text-slate-100 line-clamp-1">
                          {product.name}
                        </h3>
                      </Link>

                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    {/* Traceability Link & Price */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Direct Price</p>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-slate-100">₹{product.price_per_unit.toFixed(2)}</span>
                            <span className="text-xs text-slate-400">/ {product.unit}</span>
                          </div>
                        </div>

                        {product.batch_id && (
                          <Link
                            href={`/trace/batch/${product.batch_id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/60 text-[11px] font-semibold transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5" /> Trace
                          </Link>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Link
                          href={`/customer/marketplace/${product.id}`}
                          className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1"
                        >
                          View Details <ArrowRight className="w-3 h-3" />
                        </Link>

                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={addingToCart === product.id || product.available_stock <= 0}
                          className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md hover:shadow-emerald-500/20 flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {addingToCart === product.id ? 'Adding...' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
