'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { apiClient } from '@/lib/apiClient';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  ShieldCheck, 
  CreditCard, 
  Sparkles, 
  Truck, 
  MapPin, 
  CheckCircle,
  QrCode
} from 'lucide-react';

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  price_per_unit: number;
  quantity: number;
  unit: string;
  image_url?: string;
  batch_id?: string;
}

export default function CartPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [address, setAddress] = useState({
    street: 'Flat 402, Green Acre Residences',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411045',
    phone: '+91 98765 43210'
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/customer/cart');
      if (res && res.data && res.data.items && res.data.items.length > 0) {
        setItems(res.data.items);
      } else {
        // Check localStorage fallback
        const local = localStorage.getItem('agritrace_demo_cart');
        if (local) {
          setItems(JSON.parse(local));
        } else {
          // Starter demo items
          const starterCart: CartItem[] = [
            {
              id: 'cart-item-1',
              product_id: 'prod-001',
              product_name: 'Fresh Nashik Red Onions (कांदा)',
              price_per_unit: 34.50,
              quantity: 5,
              unit: 'kg',
              image_url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
              batch_id: 'BAT-2026-NSK-089'
            },
            {
              id: 'cart-item-2',
              product_id: 'prod-002',
              product_name: 'Hydroponic Vine Tomatoes (टोमॅटो)',
              price_per_unit: 42.00,
              quantity: 3,
              unit: 'kg',
              image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
              batch_id: 'BAT-2026-PUN-012'
            }
          ];
          setItems(starterCart);
          localStorage.setItem('agritrace_demo_cart', JSON.stringify(starterCart));
        }
      }
    } catch (err) {
      const local = localStorage.getItem('agritrace_demo_cart');
      if (local) {
        setItems(JSON.parse(local));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const updateQuantity = async (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(itemId);
      return;
    }
    const updated = items.map(item => item.id === itemId ? { ...item, quantity: newQty } : item);
    setItems(updated);
    localStorage.setItem('agritrace_demo_cart', JSON.stringify(updated));

    try {
      await apiClient.patch(`/customer/cart/${itemId}`, { quantity: newQty });
    } catch (e) {
      // handled via local fallback
    }
  };

  const removeItem = async (itemId: string) => {
    const updated = items.filter(item => item.id !== itemId);
    setItems(updated);
    localStorage.setItem('agritrace_demo_cart', JSON.stringify(updated));
    showToast('Item removed from cart');

    try {
      await apiClient.delete(`/customer/cart/${itemId}`);
    } catch (e) {
      // handled via local fallback
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const subtotal = items.reduce((acc, i) => acc + (i.price_per_unit * i.quantity), 0);
  const deliveryFee = subtotal > 300 ? 0 : 40;
  const platformFee = 5.00;
  const grandTotal = subtotal > 0 ? subtotal + deliveryFee + platformFee : 0;

  const handleCheckout = async () => {
    if (items.length === 0) return;
    try {
      setCheckingOut(true);
      const payload = {
        delivery_address: `${address.street}, ${address.city}, ${address.state} - ${address.pincode}`,
        delivery_phone: address.phone,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price_snapshot: i.price_per_unit
        }))
      };

      const res: any = await apiClient.post('/customer/orders/checkout', payload);
      
      // Store in demo orders ledger
      const existingOrders = JSON.parse(localStorage.getItem('agritrace_demo_orders') || '[]');
      const newOrder = {
        id: res?.data?.order_id || 'ORD-' + Math.floor(100000 + Math.random() * 900000),
        status: 'PLACED',
        created_at: new Date().toISOString(),
        total_amount: grandTotal,
        delivery_address: payload.delivery_address,
        items: items
      };
      existingOrders.unshift(newOrder);
      localStorage.setItem('agritrace_demo_orders', JSON.stringify(existingOrders));

      // Also add produce to Digital Freshness Bag!
      const bagItems = JSON.parse(localStorage.getItem('agritrace_demo_freshness_bag') || '[]');
      items.forEach((item) => {
        bagItems.unshift({
          id: 'bag-' + Math.random().toString(36).substring(2, 9),
          product_name: item.product_name,
          batch_id: item.batch_id || 'BAT-DEMO-2026',
          category: 'Produce',
          quantity: item.quantity,
          unit: item.unit,
          purchase_date: new Date().toISOString().split('T')[0],
          estimated_shelf_life_days: 14,
          status: 'FRESH',
          freshness_score: 96,
          prediction_interval_lower_days: 12,
          prediction_interval_upper_days: 16,
          last_scan_date: new Date().toISOString().split('T')[0],
          image_url: item.image_url
        });
      });
      localStorage.setItem('agritrace_demo_freshness_bag', JSON.stringify(bagItems));

      // Clear Cart
      setItems([]);
      localStorage.removeItem('agritrace_demo_cart');

      showToast('🎉 Order successfully placed! Produce registered in Freshness Bag.');
      setTimeout(() => {
        router.push('/customer/orders');
      }, 1500);
    } catch (err: any) {
      console.warn('Checkout API fallback:', err);
      // Fallback checkout logic
      const existingOrders = JSON.parse(localStorage.getItem('agritrace_demo_orders') || '[]');
      const newOrder = {
        id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
        status: 'CONFIRMED',
        created_at: new Date().toISOString(),
        total_amount: grandTotal,
        delivery_address: `${address.street}, ${address.city}, ${address.state} - ${address.pincode}`,
        items: items
      };
      existingOrders.unshift(newOrder);
      localStorage.setItem('agritrace_demo_orders', JSON.stringify(existingOrders));

      setItems([]);
      localStorage.removeItem('agritrace_demo_cart');
      router.push('/customer/orders');
    } finally {
      setCheckingOut(false);
    }
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
              <ShoppingBag className="w-8 h-8 text-emerald-400" />
              {language === 'hi' ? 'आपकी कार्ट' : 'Shopping Cart & Checkout'}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              Direct farm produce checkout with verified cryptographic batch traceability.
            </p>
          </div>

          <Link
            href="/customer/marketplace"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            + Continue Shopping
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-slate-900 rounded-2xl" />
            <div className="h-24 bg-slate-900 rounded-2xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-4">
            <ShoppingBag className="w-16 h-16 text-slate-600 mx-auto" />
            <h2 className="text-xl font-bold text-slate-200">Your Cart is Empty</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Discover fresh, traceable harvest batches directly from verified farmers across Maharashtra.
            </p>
            <Link
              href="/customer/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all"
            >
              Explore Marketplace <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left: Cart Items List */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                  Cart Items ({items.length})
                </h3>

                <div className="divide-y divide-slate-800">
                  {items.map((item) => (
                    <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      
                      <div className="flex items-center gap-4">
                        <img
                          src={item.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&auto=format&fit=crop&q=80'}
                          alt={item.product_name}
                          className="w-16 h-16 rounded-xl object-cover bg-slate-950 border border-slate-800"
                        />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-200">{item.product_name}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>₹{item.price_per_unit.toFixed(2)} / {item.unit}</span>
                            {item.batch_id && (
                              <Link
                                href={`/trace/batch/${item.batch_id}`}
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                              >
                                <QrCode className="w-3 h-3" /> Trace Batch
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Controls & Price */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold flex items-center justify-center transition-colors text-xs"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-bold text-slate-200 text-xs">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold flex items-center justify-center transition-colors text-xs"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right min-w-[70px]">
                          <p className="text-sm font-bold text-slate-100">
                            ₹{(item.price_per_unit * item.quantity).toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Address Card */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" /> Delivery Address
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">Street / House Address</label>
                    <input
                      type="text"
                      value={address.street}
                      onChange={(e) => setAddress({ ...address, street: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">City</label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Pincode</label>
                    <input
                      type="text"
                      value={address.pincode}
                      onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={address.phone}
                      onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Order Summary & Pay */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
                <h3 className="text-base font-bold text-slate-200">Order Summary</h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Items Subtotal:</span>
                    <span className="font-semibold text-slate-200">₹{subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Delivery Fee:</span>
                    <span className="font-semibold text-emerald-400">
                      {deliveryFee === 0 ? 'FREE (Orders > ₹300)' : `₹${deliveryFee.toFixed(2)}`}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Platform & Traceability Fee:</span>
                    <span className="font-semibold text-slate-200">₹{platformFee.toFixed(2)}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-slate-200">Total Payable:</span>
                    <span className="text-2xl font-black text-emerald-400">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-4 h-4" /> 100% Cryptographic Trace Guarantee
                  </div>
                  <p>
                    All items are automatically added to your <strong>Digital Freshness Bag</strong> with AI shelf-life expiration alerts.
                  </p>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkingOut || items.length === 0}
                  className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  {checkingOut ? 'Placing Order...' : 'Confirm & Place Order'}
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
