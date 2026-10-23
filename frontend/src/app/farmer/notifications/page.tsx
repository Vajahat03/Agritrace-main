'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLanguage } from '@/context/LanguageContext';
import { apiClient } from '@/lib/apiClient';
import { 
  Bell, 
  CloudRain, 
  Sprout, 
  ShoppingBag, 
  CheckCheck, 
  ShieldAlert, 
  Clock, 
  Trash2, 
  Sparkles,
  ArrowRight,
  Filter
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'WEATHER' | 'FERTILIZER' | 'BATCH' | 'MARKET' | 'SYSTEM';
  is_read: boolean;
  created_at: string;
  link?: string;
}

export default function FarmerNotificationsPage() {
  const { t, language } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/notifications');
      if (res && res.data && res.data.length > 0) {
        setNotifications(res.data);
      } else {
        // High fidelity demo notifications
        setNotifications([
          {
            id: 'notif-1',
            title: 'Fungal Risk Advisory (High Humidity)',
            message: 'Relative humidity will exceed 85% tomorrow in Nashik Plot B. Bio-fungicide spray recommended before 11 AM.',
            type: 'WEATHER',
            is_read: false,
            created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            link: '/farmer/weather'
          },
          {
            id: 'notif-2',
            title: 'Procurement Bid: Sahyadri Agri Hub',
            message: 'Sahyadri Agri Hub has procured 1,800 kg from your Batch BAT-2026-NSK-089 at ₹34.50/kg.',
            type: 'BATCH',
            is_read: false,
            created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
            link: '/farmer/batches'
          },
          {
            id: 'notif-3',
            title: 'Fertilizer Application Scheduled',
            message: 'Optimal date for 2nd application of Jeevamrut Bio-Nutrient on Tomato Crop Plot A is in 2 days.',
            type: 'FERTILIZER',
            is_read: true,
            created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
            link: '/farmer/crops'
          },
          {
            id: 'notif-4',
            title: 'Market Arrival & APMC Price Surge',
            message: 'Nashik APMC modal price for Grade A Red Onions increased by +8.4% today to ₹3,450/quintal.',
            type: 'MARKET',
            is_read: true,
            created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
            link: '/farmer/dashboard'
          }
        ]);
      }
    } catch (err) {
      console.warn('API error, using fallback notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (e) {
      // Local fallback
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    showToast('Notification marked as read');
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.post('/notifications/read-all');
    } catch (e) {
      // Local fallback
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    showToast('All notifications marked as read');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'WEATHER':
        return <CloudRain className="w-5 h-5 text-sky-400" />;
      case 'FERTILIZER':
        return <Sprout className="w-5 h-5 text-emerald-400" />;
      case 'BATCH':
        return <ShoppingBag className="w-5 h-5 text-amber-400" />;
      case 'MARKET':
        return <Sparkles className="w-5 h-5 text-teal-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const filtered = notifications.filter(n => filterType === 'all' || n.type === filterType);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <DashboardLayout role="farmer">
      <div className="max-w-5xl mx-auto space-y-8">
        
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
              <Bell className="w-8 h-8 text-emerald-400" />
              {language === 'hi' ? 'सूचनाएं एवं अलर्ट' : 'Farm Notifications & Alerts'}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              You have <strong className="text-emerald-400">{unreadCount} unread</strong> alerts regarding weather, fertilization, and batch sales.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-slate-700"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" /> Mark All as Read
            </button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'all', label: 'All Alerts' },
            { id: 'WEATHER', label: 'Weather & Climate' },
            { id: 'BATCH', label: 'Batches & Procurement' },
            { id: 'FERTILIZER', label: 'Fertilization' },
            { id: 'MARKET', label: 'Market Prices' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                filterType === cat.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(n => (
              <div key={n} className="h-24 bg-slate-900 rounded-2xl border border-slate-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-4">
            <Bell className="w-16 h-16 text-slate-600 mx-auto" />
            <h2 className="text-xl font-bold text-slate-200">No Notifications in this Category</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              All farm sensors and batch transactions are currently up to date.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all duration-300 backdrop-blur-md flex items-start justify-between gap-4 ${
                  item.is_read
                    ? 'bg-slate-900/50 border-slate-800/80 opacity-80'
                    : 'bg-slate-900/90 border-emerald-500/40 shadow-xl shadow-emerald-950/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl shrink-0 ${item.is_read ? 'bg-slate-800 text-slate-400' : 'bg-emerald-950/80 border border-emerald-500/30'}`}>
                    {getTypeIcon(item.type)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-200">{item.title}</h4>
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(item.created_at).toLocaleDateString()}
                      </span>

                      {item.link && (
                        <Link
                          href={item.link}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                        >
                          View details <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {!item.is_read && (
                  <button
                    onClick={() => markAsRead(item.id)}
                    className="p-2 text-slate-400 hover:text-emerald-400 transition-colors shrink-0 text-xs font-semibold"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
