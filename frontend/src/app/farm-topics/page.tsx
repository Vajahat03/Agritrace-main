'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import {
  Newspaper,
  Search,
  Sparkles,
  ExternalLink,
  Bot,
  Calendar,
  Tag,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Clock,
  Filter,
  CheckCircle2,
} from 'lucide-react';

interface Article {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: { name: string };
  category?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All Farm Topics', query: 'agriculture OR farming' },
  { id: 'pest', label: 'Crop Health & Pest Alerts', query: 'crop disease OR pest control OR pesticide farming' },
  { id: 'market', label: 'Mandi Prices & Markets', query: 'APMC mandi OR commodity price farming OR wholesale produce' },
  { id: 'tech', label: 'Irrigation & Smart Tech', query: 'drip irrigation OR smart farming OR precision agriculture' },
  { id: 'storage', label: 'Storage & Cold Chain', query: 'cold storage farming OR shelf life produce OR post harvest' },
  { id: 'policy', label: 'Government Schemes', query: 'agriculture subsidy OR kisan scheme OR horticulture policy' },
];

export default function FarmTopicsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  useEffect(() => {
    loadNews();
  }, [selectedCategory, submittedQuery]);

  const loadNews = async () => {
    try {
      setLoading(true);
      const catObj = CATEGORIES.find((c) => c.id === selectedCategory);
      const queryParam = submittedQuery || catObj?.query || 'agriculture';
      const catParam = selectedCategory !== 'all' ? selectedCategory : '';

      // Try Next.js internal news proxy route first
      let res = await fetch(`/api/news?query=${encodeURIComponent(queryParam)}&category=${encodeURIComponent(catParam)}`);
      if (!res.ok) {
        // Fallback to backend route
        res = await fetch(`http://localhost:5000/api/v1/news/farm-topics?query=${encodeURIComponent(queryParam)}`);
      }

      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch (err) {
      console.warn('Failed to fetch news from server, using fallback', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(searchQuery);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Recent Update';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Recent Update';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf9] text-slate-900">
      <Navbar />

      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-emerald-900 via-slate-900 to-[#0f172a] text-white pt-16 pb-20 px-4 sm:px-6 lg:px-8 border-b border-emerald-800/40">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
            <Newspaper className="h-4 w-4 text-emerald-400" />
            <span>Real-Time Agricultural News & Market Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Farm Topics & Mandi Intelligence Hub
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Stay ahead with live agricultural updates, verified ICAR scientific advisories, regional mandi price trends, and government farming schemes curated for farmers and wholesale vendors.
          </p>

          {/* Search Input Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="max-w-xl mx-auto pt-4 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics (e.g. tomato blight, onion prices, cold storage)..."
                className="w-full text-xs sm:text-sm pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-hidden focus:bg-white/15 focus:border-emerald-400"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition-colors shrink-0"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 space-y-8">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id && !submittedQuery;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSubmittedQuery('');
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* AI Advisor Quick Access Alert Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-950">
                Have specific farm issues about any of these topics?
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Talk directly with our <strong>AgriTrace AI Advisor</strong> in the AI Agents workspace to diagnose crop diseases, calculate NPK fertilizer schedules, or plan market logistics.
              </p>
            </div>
          </div>
          <Link
            href="/farmer/ai-agents"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Open AI Advisor</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
            <h4 className="font-bold text-slate-800 text-sm">Fetching Latest Agricultural News & Topics...</h4>
            <p className="text-xs text-slate-500">Connecting to News API agricultural wire...</p>
          </div>
        )}

        {/* Articles Grid */}
        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((art, idx) => (
              <article
                key={idx}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  {/* Thumbnail Image */}
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={art.urlToImage || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80'}
                      alt={art.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-md">
                      {art.source?.name || 'Agricultural Wire'}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatDate(art.publishedAt)}</span>
                    </div>

                    <h2 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
                      {art.title}
                    </h2>

                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {art.description}
                    </p>
                  </div>
                </div>

                {/* Footer Action Links */}
                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <a
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-700 font-bold hover:text-emerald-800 transition-colors"
                  >
                    <span>Read Full Article</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <Link
                    href={`/farmer/ai-agents`}
                    title="Discuss this topic with AI Advisor"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-700 font-medium text-[11px] transition-colors"
                  >
                    <Bot className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Discuss in AI</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && articles.length === 0 && (
          <div className="py-20 text-center space-y-3">
            <Newspaper className="h-10 w-10 text-slate-400 mx-auto" />
            <h3 className="font-bold text-slate-800 text-base">No Articles Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn&apos;t find any news articles matching &quot;{submittedQuery}&quot;. Try searching for another crop, mandi, or topic.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSubmittedQuery('');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
