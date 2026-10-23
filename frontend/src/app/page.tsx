'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '../components/Navbar';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import {
  Sprout,
  Store,
  ShoppingBag,
  QrCode,
  ShieldCheck,
  Zap,
  ArrowRight,
  ScanLine,
  CloudSun,
  Bot,
  CheckCircle2,
  Users,
  Newspaper,
  Calendar,
  ExternalLink,
} from 'lucide-react';

export default function LandingPage() {
  const { t } = useLanguage();
  const { user, switchDemoRole } = useAuth();
  const router = useRouter();
  const [farmTopics, setFarmTopics] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch('/api/news?pageSize=3')
      .then((res) => res.json())
      .then((data) => {
        if (data?.articles) setFarmTopics(data.articles.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  const portals: {
    title: string;
    desc: string;
    icon: any;
    href: string;
    role: UserRole;
    badge: string;
    badgeColor: string;
    actionColor: string;
  }[] = [
    {
      title: 'Farmer Operations',
      desc: 'Multi-crop simultaneous management, independent fertilizer logs, weather intelligence, and registered vendor discovery.',
      icon: Sprout,
      href: '/farmer/dashboard',
      role: 'FARMER',
      badge: '🌾 Farmer Portal',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      actionColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    {
      title: 'Vendor Distribution & Stock',
      desc: 'Batch procurement from farmers, inventory godown controls, low-stock alerts, and registered farmer discovery.',
      icon: Store,
      href: '/vendor/dashboard',
      role: 'VENDOR',
      badge: '🏬 Vendor Portal',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      actionColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    {
      title: 'Customer Marketplace & Freshness',
      desc: 'Digital Freshness Bag with calibrated shelf-life predictions, verified farm-origin produce shopping, and order tracking.',
      icon: ShoppingBag,
      href: '/customer/dashboard',
      role: 'CUSTOMER',
      badge: '🛒 Customer Market',
      badgeColor: 'bg-sky-50 text-sky-800 border-sky-200',
      actionColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
  ];

  const aiHighlights = [
    { title: 'Produce Vision Quality Grading', desc: 'Real-time defect detection and commercial grading via computer vision.' },
    { title: 'Conformal Shelf-Life Estimator', desc: 'Rigorous 90% confidence interval prediction for remaining edible days.' },
    { title: 'Mandi Price Intelligence', desc: 'Wholesale APMC price forecasts integrated with IMD historical weather features.' },
    { title: 'ICAR Agronomic Advisory RAG', desc: 'Scientific crop care and N-P-K nutrient schedules with research citations.' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf9] text-slate-900">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Zap className="h-3.5 w-3.5 text-emerald-600" />
          <span>Next-Generation Agricultural Freshness & Traceability Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
          Smart Agriculture, <br className="hidden sm:inline" />
          <span className="text-emerald-700">
            Freshness AI & Transparent Traceability
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          AgriTrace bridges farmers, wholesale vendors, and consumers through real-time shelf-life intelligence,
          multi-crop field treatment logging, and public farm-to-table QR provenance.
        </p>

        {/* Primary CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          <Link
            href="/farmer/dashboard"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-colors"
          >
            <Sprout className="h-4 w-4" />
            <span>Open Farmer Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/farmer/ai-agents"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-sm hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Bot className="h-4 w-4 text-emerald-600" />
            <span>Explore AI Agents</span>
          </Link>

          <Link
            href="/trace/batch/TOM-2026-0001"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-sm hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <QrCode className="h-4 w-4 text-emerald-600" />
            <span>Scan Demo Batch</span>
          </Link>
        </div>
      </section>

      {/* Role-Based Portals Overview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dedicated Role-Isolated Portals</h2>
          <p className="text-xs text-slate-500 mt-1">
            Tailored workspaces designed specifically for agricultural producers, mandi stockists, and fresh food consumers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-emerald-700">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">{p.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{p.desc}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!user || user.id.startsWith('demo-')) {
                      switchDemoRole(p.role);
                    } else {
                      router.push(p.href);
                    }
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${p.actionColor}`}
                >
                  <span>Enter {p.title.split(' ')[0]} Hub</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Intelligence Section */}
      <section className="bg-emerald-50/60 border-y border-emerald-100 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold mb-2">
                <Bot className="h-3.5 w-3.5" />
                <span>Active Backend Machine Learning Services</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Built-In AgriTrace AI Agents</h2>
            </div>
            <Link
              href="/farmer/ai-agents"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors self-start md:self-auto"
            >
              <span>Launch AI Agents Hub</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {aiHighlights.map((item, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Real-Time Farm & Mandi Topics Section for Farmers and Vendors */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold mb-2">
              <Newspaper className="h-3.5 w-3.5 text-emerald-600" />
              <span>Live Agricultural Wire & Intelligence</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Farm Topics & Mandi Insights</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Real-time agricultural updates, pest warnings, wholesale mandi trends, and ICAR agronomic guidance for farmers and vendors.
            </p>
          </div>
          <Link
            href="/farm-topics"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors self-start md:self-auto"
          >
            <span>View All Farm Topics</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(farmTopics.length > 0 ? farmTopics : [
            {
              title: 'Smart Farming & Micro-Irrigation Adoption Across Mandis',
              description: 'Farmers integrating automated drip fertigation report a 35% reduction in water usage and a 20% gain in harvest yield.',
              url: '/farm-topics',
              urlToImage: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800&auto=format&fit=crop&q=80',
              publishedAt: new Date().toISOString(),
              source: { name: 'National Agriculture Intelligence' },
            },
            {
              title: 'APMC Modal Price Trends & Storage Safeguards for Perishables',
              description: 'Agricultural analysts highlight the importance of pre-cooling for perishable vegetables to mitigate price volatility.',
              url: '/farm-topics',
              urlToImage: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80',
              publishedAt: new Date().toISOString(),
              source: { name: 'APMC Mandi Watch' },
            },
            {
              title: 'Biological Pest Management Protocols: Mitigating Blight & Borers',
              description: 'ICAR agronomy guidelines recommend bio-fungicides and pheromone lures as sustainable alternatives to synthetic sprays.',
              url: '/farm-topics',
              urlToImage: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
              publishedAt: new Date().toISOString(),
              source: { name: 'ICAR Agronomy Bulletin' },
            },
          ]).map((art: any, i: number) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
                  <img
                    src={art.urlToImage || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80'}
                    alt={art.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    {art.source?.name || 'Agri News'}
                  </div>
                </div>
                <div className="p-5 space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
                    {art.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {art.description}
                  </p>
                </div>
              </div>
              <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between text-xs mt-3">
                <Link
                  href="/farm-topics"
                  className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 text-xs"
                >
                  <span>Explore Topic</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href="/farmer/ai-agents"
                  className="text-slate-500 hover:text-emerald-700 font-medium text-[11px] flex items-center gap-1"
                >
                  <Bot className="h-3 w-3 text-emerald-600" />
                  <span>Ask AI Advisor</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Sprout className="h-4 w-4 text-emerald-600" />
            <span>AgriTrace Decentralized Agriculture Platform</span>
          </div>
          <p>© 2026 AgriTrace. Production Ready. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
