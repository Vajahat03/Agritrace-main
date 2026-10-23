'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Language } from '../types';
import { apiClient } from '../lib/apiClient';
import {
  Sprout,
  Globe,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Menu,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Newspaper,
} from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export function Navbar({ onToggleMobileMenu }: NavbarProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const pathname = usePathname();
  const [langDropdown, setLangDropdown] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);

  // Notification center state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifDropdown, setNotifDropdown] = useState<boolean>(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 45000); // 45s interval
    return () => clearInterval(interval);
  }, [user]);

  const loadNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications?limit=15');
      if (res.data) {
        setNotifications(res.data.items || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch {
      // Silently ignore if offline or unauthenticated
    }
  };

  const handleMarkAsRead = async (id: string, link?: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const requestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermissionGranted(perm === 'granted');
      if (perm === 'granted') {
        new Notification('AgriTrace Freshness Alerts Enabled', {
          body: 'You will receive daily shelf-life reminders and spoilage hazard alerts.',
          icon: '/favicon.ico',
        });
      }
    }
  };

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी (Hindi)' },
    { code: 'mr', label: 'मराठी (Marathi)' },
    { code: 'ta', label: 'தமிழ் (Tamil)' },
    { code: 'hinglish', label: 'Hinglish' },
  ];

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'FARMER':
        return { label: 'Farmer Portal', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'VENDOR':
        return { label: 'Vendor Portal', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'CUSTOMER':
        return { label: 'Customer Marketplace', color: 'bg-sky-50 text-sky-800 border-sky-200' };
      case 'ADMIN':
        return { label: 'Admin Portal', color: 'bg-purple-50 text-purple-800 border-purple-200' };
      default:
        return { label: 'AgriTrace', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Side: Hamburger (mobile) + Brand Logo */}
        <div className="flex items-center gap-3">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden transition-colors"
              aria-label="Open portal navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 shadow-xs group-hover:bg-emerald-700 transition-colors">
              <Sprout className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
                Agri<span className="text-emerald-700">Trace</span>
              </span>
            </div>
          </Link>

          {/* Active Portal Badge */}
          {user && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${roleInfo.color} ml-2`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleInfo.label}
            </span>
          )}
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2.5">
          {/* Farm Topics Link */}
          <Link
            href="/farm-topics"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
          >
            <Newspaper className="h-3.5 w-3.5 text-emerald-600" />
            <span>Farm Topics</span>
          </Link>

          {/* Freshness Notification Bell */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifDropdown(!notifDropdown)}
                className="relative p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                title="Freshness Notifications & Reminders"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-xs animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 px-1">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-900">Freshness Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded-full">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {!permissionGranted && (
                    <div className="mb-2 p-2 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between text-[11px] text-emerald-950">
                      <span>Enable browser alerts for daily expiry reminders?</span>
                      <button
                        type="button"
                        onClick={requestPushPermission}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700"
                      >
                        Enable
                      </button>
                    </div>
                  )}

                  <div className="max-h-72 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs">
                        <Clock className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-medium">No freshness alerts right now</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Active SmartBag items are monitored daily.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`pt-2 pb-1.5 px-2 rounded-xl text-left transition-colors flex flex-col gap-1 ${
                            notif.is_read ? 'bg-white' : 'bg-emerald-50/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 leading-tight">
                              {notif.title}
                            </span>
                            {!notif.is_read && (
                              <button
                                onClick={() => handleMarkAsRead(notif.id)}
                                title="Mark read"
                                className="text-[10px] text-slate-400 hover:text-emerald-600 shrink-0 font-semibold"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 leading-snug">{notif.message}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                            <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                            {notif.link && (
                              <Link
                                href={notif.link}
                                onClick={() => {
                                  handleMarkAsRead(notif.id);
                                  setNotifDropdown(false);
                                }}
                                className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                              >
                                <span>Inspect Batch</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 text-center">
                    <Link
                      href="/customer/freshness-bag"
                      onClick={() => setNotifDropdown(false)}
                      className="text-xs font-bold text-slate-700 hover:text-emerald-700 transition-colors"
                    >
                      View SmartBag Produce Inventory →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setLangDropdown(!langDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-all"
            >
              <Globe className="h-3.5 w-3.5 text-emerald-600" />
              <span>{languages.find((l) => l.code === language)?.label.split(' ')[0]}</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {langDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-lg p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      setLangDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      language === l.code
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Profile / Logout */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <Link
                href={
                  user.role === 'FARMER'
                    ? '/farmer/profile'
                    : user.role === 'VENDOR'
                    ? '/vendor/profile'
                    : '/customer/profile'
                }
                className="hidden lg:flex flex-col text-right hover:opacity-80 transition-opacity"
              >
                <p className="text-xs font-semibold text-slate-900 leading-tight">{user.full_name}</p>
                <p className="text-[10px] text-emerald-700 font-medium capitalize">{user.role.toLowerCase()}</p>
              </Link>
              <button
                onClick={logout}
                title="Log Out"
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
