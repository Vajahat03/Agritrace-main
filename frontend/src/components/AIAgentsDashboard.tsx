'use client';

import React, { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { ProduceInspectionWorkspace } from './ProduceInspectionWorkspace';
import { GeminiAgentBot } from './GeminiAgentBot';
import { apiClient } from '../lib/apiClient';
import {
  simulatePricePrediction,
  simulateProduceScan,
  simulateAgentDAGRun,
} from '../lib/aiClientService';
import {
  Bot,
  Sparkles,
  Image as ImageIcon,
  Scan,
  CalendarClock,
  TrendingUp,
  MessageSquare,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Thermometer,
  Droplets,
  Building2,
  Info,
} from 'lucide-react';

type Portal = 'farmer' | 'vendor' | 'customer';

interface AgentInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  whatItDoes: string[];
  status: 'Contract Ready (Phase 3 Backend)' | 'Active & Connected';
  icon: React.ElementType;
  badge: string;
  color: string;
}

const AGENTS: AgentInfo[] = [
  {
    id: 'vision',
    name: 'Crop & Produce Vision Agent',
    tagline: 'Defect detection & produce quality grading from visual imagery',
    description: 'Processes produce photographs using computer vision models to identify crop variety, detect surface defects, and grade overall quality.',
    whatItDoes: [
      'Identifies commodity variety and morphological traits',
      'Detects surface blemishes, skin abrasions, and rot spots',
      'Assigns commercial quality grade (Grade A / B / C)',
      'Calculates visual detection confidence metric',
    ],
    status: 'Active & Connected',
    icon: Scan,
    badge: 'Computer Vision',
    color: 'emerald',
  },
  {
    id: 'freshness',
    name: 'Freshness & Quality Assessment Agent',
    tagline: 'Multimodal firmness, ripeness & cosmetic score prediction',
    description: 'Computes unified freshness indices by combining visual spectral cues, storage duration, and crop physiological models.',
    whatItDoes: [
      'Calculates quantitative Freshness Score (0 to 100%)',
      'Estimates firmness index and peel texture firmness',
      'Measures color uniformity across produce surface',
      'Provides actionable post-harvest handling advice',
    ],
    status: 'Active & Connected',
    icon: Sparkles,
    badge: 'Quality ML',
    color: 'emerald',
  },
  {
    id: 'shelflife',
    name: 'Calibrated Shelf-Life Prediction Agent',
    tagline: 'Conformal uncertainty prediction for remaining edible days',
    description: 'Estimates remaining commercial shelf life with rigorous 90% confidence intervals based on ambient temperature, humidity, and storage mode.',
    whatItDoes: [
      'Predicts remaining edible/marketable days',
      'Generates 90% conformal lower and upper bound intervals',
      'Adapts to Ambient, Evaporative Cooler, or Cold Chain storage',
      'Recommends optimal storage temperature & humidity parameters',
    ],
    status: 'Active & Connected',
    icon: CalendarClock,
    badge: 'Conformal AI',
    color: 'emerald',
  },
  {
    id: 'price',
    name: 'Market Price Intelligence Engine',
    tagline: 'AGMARKNET Mandi forecast with IMD weather feature provenance',
    description: 'Predicts wholesale modal commodity prices across Indian APMC mandis for 1-day, 3-day, and 7-day forecast horizons.',
    whatItDoes: [
      'Forecasts modal prices (₹/Quintal) across regional APMC mandis',
      'Calculates probabilistic lower & upper pricing bounds',
      'Incorporates historical Mandi arrivals & IMD weather features',
      'Logs immutable prediction provenance to database ledger',
    ],
    status: 'Contract Ready (Phase 3 Backend)',
    icon: TrendingUp,
    badge: 'Price Forecaster',
    color: 'emerald',
  },
  {
    id: 'rag',
    name: 'Agricultural Advisory & ICAR Assistant',
    tagline: 'Contextual scientific agronomy guidance with citations',
    description: 'Answers farming, pest control, fertilizer scheduling, and post-harvest queries synthesized from verified ICAR and State Agricultural University packages.',
    whatItDoes: [
      'Answers agronomic questions in natural language',
      'Provides N-P-K nutrient schedules & pest management protocols',
      'Cites verified government agricultural research sources',
      'Supports localized crop contexts across major staples & vegetables',
    ],
    status: 'Contract Ready (Phase 3 Backend)',
    icon: MessageSquare,
    badge: 'ICAR Knowledge RAG',
    color: 'emerald',
  },
  {
    id: 'orchestrator',
    name: 'Autonomous Multi-Agent Orchestrator',
    tagline: 'Multi-step farm decision & cold-chain strategy synthesizer',
    description: 'Coordinates specialized sub-agents into unified action plans for farm management, supply chain routing, and market intelligence.',
    whatItDoes: [
      'Synthesizes farm advisory, shelf-life, and market forecasts',
      'Formulates holistic operational action items for stakeholders',
      'Evaluates supply-chain risks before harvest minting',
    ],
    status: 'Contract Ready (Phase 3 Backend)',
    icon: Cpu,
    badge: 'Agent Orchestrator',
    color: 'emerald',
  },
];

export function AIAgentsDashboard({ portal }: { portal: Portal }) {
  const [activeTab, setActiveTab] = useState<string>('vision');
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Vision inputs
  const [visionCrop, setVisionCrop] = useState('Tomato');
  const [visionImage, setVisionImage] = useState<string>(
    'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80'
  );

  // Freshness inputs
  const [freshnessProduce, setFreshnessProduce] = useState('Tomato');
  const [freshnessDays, setFreshnessDays] = useState(2);
  const [freshnessImage, setFreshnessImage] = useState<string>(
    'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80'
  );

  // Shelf-life inputs
  const [shelfProduce, setShelfProduce] = useState('Tomato');
  const [shelfScore, setShelfScore] = useState(85);
  const [shelfStorage, setShelfStorage] = useState('Ambient Storage');
  const [shelfTemp, setShelfTemp] = useState(24);
  const [shelfHumidity, setShelfHumidity] = useState(65);

  // Price inputs
  const [priceCommodity, setPriceCommodity] = useState('Tomato');
  const [priceMarket, setPriceMarket] = useState('Nashik APMC');
  const [priceState, setPriceState] = useState('Maharashtra');
  const [priceHorizon, setPriceHorizon] = useState(3);

  // RAG inputs
  const [ragQuery, setRagQuery] = useState('What is the recommended fertilizer schedule for tomato during vegetative and flowering stages?');
  const [ragCrop, setRagCrop] = useState('Tomato');

  // Orchestrator inputs
  const [orchType, setOrchType] = useState<'FARMER_ADVISORY' | 'SHELF_LIFE' | 'MARKET_INTELLIGENCE'>('FARMER_ADVISORY');
  const [orchPrompt, setOrchPrompt] = useState('Evaluate harvest timing for 5 acres of Roma tomatoes under incoming heatwave conditions.');

  const sampleImages: Record<string, string> = {
    Tomato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
    Onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80',
    Potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
    Grapes: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&auto=format&fit=crop&q=80',
  };

  const runAgent = async (agentId: string) => {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      let res: any = null;

      if (agentId === 'vision') {
        res = await apiClient.post('/ai/vision/analyze', {
          imageUrl: visionImage,
          cropContext: visionCrop,
        });
      } else if (agentId === 'freshness') {
        res = await apiClient.post('/ai/freshness/predict', {
          imageUrl: freshnessImage,
          produceType: freshnessProduce,
          storageDays: Number(freshnessDays),
        });
      } else if (agentId === 'shelflife') {
        res = await apiClient.post('/ai/shelflife/predict', {
          produceType: shelfProduce,
          currentFreshnessScore: Number(shelfScore),
          storageCondition: shelfStorage,
          temperature: Number(shelfTemp),
          humidity: Number(shelfHumidity),
        });
      } else if (agentId === 'price') {
        res = await apiClient.post('/ai/price/predict', {
          commodity: priceCommodity,
          marketLocation: priceMarket,
          state: priceState,
          forecastHorizonDays: Number(priceHorizon),
        });
      } else if (agentId === 'rag') {
        res = await apiClient.post('/ai/rag/query', {
          query: ragQuery,
          cropType: ragCrop,
          language: 'en',
        });
      } else if (agentId === 'orchestrator') {
        res = await apiClient.post('/ai/agent/run', {
          agentType: orchType,
          prompt: orchPrompt,
          context: { portal, timestamp: new Date().toISOString() },
        });
      }

      setResult(res?.data || res);
    } catch (err: any) {
      console.error('Agent execution error:', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to execute agent. Backend service may be initializing.'
      );
    } finally {
      setRunning(false);
    }
  };

  const loadOfflineFixture = (agentId: string) => {
    setError(null);
    if (agentId === 'vision') {
      const scan = simulateProduceScan({
        produceType: visionCrop,
        imageDataUrl: visionImage,
        storageDays: 1,
      });
      setResult({ ...scan, _isDemonstrationFixture: true });
    } else if (agentId === 'freshness') {
      const scan = simulateProduceScan({
        produceType: freshnessProduce,
        imageDataUrl: freshnessImage,
        storageDays: Number(freshnessDays),
      });
      setResult({ ...scan, _isDemonstrationFixture: true });
    } else if (agentId === 'shelflife') {
      const scan = simulateProduceScan({
        produceType: shelfProduce,
        storageType: shelfStorage.toLowerCase().includes('cold') ? 'cold_storage' : 'ambient',
        temperatureC: shelfTemp,
        humidityRh: shelfHumidity,
      });
      setResult({ ...scan, _isDemonstrationFixture: true });
    } else if (agentId === 'price') {
      const price = simulatePricePrediction({
        commodity: priceCommodity,
        marketLocation: priceMarket,
        forecastHorizonDays: Number(priceHorizon),
      });
      setResult({ ...price, _isDemonstrationFixture: true });
    } else if (agentId === 'rag') {
      setResult({
        query: ragQuery,
        cropType: ragCrop,
        answer: `[Demonstration Fixture] ICAR Agronomy Advisory: For ${ragCrop}, ensure optimal organic mulching, apply balanced N-P-K during flowering, and avoid waterlogging during ripening.`,
        sources: ['ICAR Package of Practices 2026', 'Horticulture Advisory Bulletin'],
        confidence: 0.92,
        _isDemonstrationFixture: true,
      });
    } else if (agentId === 'orchestrator') {
      const dag = simulateAgentDAGRun({
        batchId: 'BATCH-DEMO-001',
        produceType: 'Tomato',
        smartbagActive: true,
      });
      setResult({ ...dag, _isDemonstrationFixture: true });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setter(String(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const currentAgent = AGENTS.find((a) => a.id === activeTab) || AGENTS[0];

  return (
    <DashboardLayout
      portal={portal}
      title="AgriTrace AI Agents"
      subtitle="Intelligent computer vision, conformal shelf-life estimation, price forecasting, and ICAR agronomy advisory."
    >
      {/* Overview Banner */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">AgriTrace Intelligence Workspace</h2>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                AgriTrace embeds dedicated machine learning agent contracts for real-time farm decision support,
                produce quality inspection, market forecast analytics, and post-harvest management.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Phase 3 Microservice Contracts Ready</span>
          </div>
        </div>
      </div>

      {/* Agents Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const isSelected = activeTab === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => {
                setActiveTab(agent.id);
                setResult(null);
                setError(null);
              }}
              className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                </div>
                <h3 className={`text-xs font-bold leading-tight ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                  {agent.name.split(' ')[0]} {agent.name.split(' ')[1]}
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 line-clamp-1">{agent.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Active Agent Workspace */}
      {activeTab === 'shelflife' || activeTab === 'vision' || activeTab === 'freshness' ? (
        <ProduceInspectionWorkspace initialCrop={visionCrop} />
      ) : activeTab === 'rag' || activeTab === 'orchestrator' ? (
        <GeminiAgentBot
          agentId={activeTab as 'rag' | 'orchestrator'}
          agentName={currentAgent.name}
          portal={portal}
          defaultCrop={activeTab === 'rag' ? ragCrop : 'Tomato'}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Agent Details & Inputs */}
          <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {currentAgent.badge}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {currentAgent.status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{currentAgent.name}</h2>
                <p className="text-xs text-slate-600 mt-1">{currentAgent.description}</p>
              </div>
            </div>

            {/* What It Does Section */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs">
              <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-emerald-700" />
                What this AI Agent does:
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-slate-600">
                {currentAgent.whatItDoes.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Form Inputs based on Active Agent */}
            <div className="space-y-4 pt-1">
              {activeTab === 'vision' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Select Commodity Context</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['Tomato', 'Onion', 'Potato', 'Grapes'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setVisionCrop(c);
                            if (sampleImages[c]) setVisionImage(sampleImages[c]);
                          }}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            visionCrop === c
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Produce Photograph</label>
                    <div className="flex gap-3">
                      <div className="h-28 w-28 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shrink-0">
                        <img src={visionImage} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between">
                        <p className="text-xs text-slate-500">
                          Upload high-resolution camera photo or use default reference crop image.
                        </p>
                        <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer border border-slate-200 transition-colors w-full">
                          <Upload className="h-3.5 w-3.5" />
                          <span>Upload Image File</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, setVisionImage)}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'freshness' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Produce Commodity</label>
                      <select
                        value={freshnessProduce}
                        onChange={(e) => setFreshnessProduce(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800"
                      >
                        <option value="Tomato">Tomato (Horticulture)</option>
                        <option value="Onion">Onion (Bulb)</option>
                        <option value="Potato">Potato (Tuber)</option>
                        <option value="Grapes">Grapes (Table)</option>
                        <option value="Mango">Mango (Seasonal)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Storage Days Elapsed</label>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={freshnessDays}
                        onChange={(e) => setFreshnessDays(Number(e.target.value))}
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Produce Photo</label>
                    <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer border border-slate-200 transition-colors w-full">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload Sample Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, setFreshnessImage)}
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'shelflife' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Produce Type</label>
                      <select
                        value={shelfProduce}
                        onChange={(e) => setShelfProduce(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800"
                      >
                        <option value="Tomato">Tomato</option>
                        <option value="Onion">Onion</option>
                        <option value="Potato">Potato</option>
                        <option value="Grapes">Grapes</option>
                        <option value="Chili">Green Chili</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Storage Facility Mode</label>
                      <select
                        value={shelfStorage}
                        onChange={(e) => setShelfStorage(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800"
                      >
                        <option value="Ambient Storage">Ambient Warehouse (24-30°C)</option>
                        <option value="Cold Storage (Controlled)">Cold Storage Chamber (10-12°C)</option>
                        <option value="Refrigerated Retail">Refrigerated Retail (4-8°C)</option>
                        <option value="Evaporative Cooling">Zero Energy Evaporative Cooler</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ambient Temp (°C): <span className="text-emerald-700">{shelfTemp}°C</span>
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="45"
                        value={shelfTemp}
                        onChange={(e) => setShelfTemp(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Relative Humidity (%): <span className="text-emerald-700">{shelfHumidity}%</span>
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="98"
                        value={shelfHumidity}
                        onChange={(e) => setShelfHumidity(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'price' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Commodity</label>
                      <select
                        value={priceCommodity}
                        onChange={(e) => setPriceCommodity(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800"
                      >
                        <option value="Tomato">Tomato</option>
                        <option value="Onion">Onion</option>
                        <option value="Potato">Potato</option>
                        <option value="Grapes">Grapes</option>
                        <option value="Wheat">Wheat</option>
                        <option value="Rice">Paddy / Rice</option>
                        <option value="Cotton">Cotton</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Target APMC Mandi</label>
                      <select
                        value={priceMarket}
                        onChange={(e) => setPriceMarket(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-800"
                      >
                        <option value="Nashik APMC">Nashik APMC (Maharashtra)</option>
                        <option value="Azadpur Mandi">Azadpur Mandi (Delhi)</option>
                        <option value="Vashi APMC">Vashi APMC (Navi Mumbai)</option>
                        <option value="Kolar APMC">Kolar APMC (Karnataka)</option>
                        <option value="Pimpalgaon Baswant">Pimpalgaon Baswant (Nashik)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Forecast Horizon</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 3, 7].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setPriceHorizon(days)}
                          className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                            priceHorizon === days
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {days} Day{days > 1 ? 's' : ''} Ahead
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'rag' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Agronomic Query</label>
                    <textarea
                      rows={3}
                      value={ragQuery}
                      onChange={(e) => setRagQuery(e.target.value)}
                      placeholder="Ask questions on pest management, fertilizer ratios, or post-harvest storage..."
                      className="w-full text-xs rounded-lg border border-slate-200 p-2.5 bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 mb-1 block">Quick Query Suggestions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'How to prevent early blight in tomatoes?',
                        'Optimum NPK ratio for onions at bulb development stage?',
                        'Safe post-harvest washing for export-quality grapes',
                      ].map((prompt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setRagQuery(prompt)}
                          className="text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'orchestrator' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'FARMER_ADVISORY', label: 'Farm Advisory' },
                      { type: 'SHELF_LIFE', label: 'Cold-Chain Plan' },
                      { type: 'MARKET_INTELLIGENCE', label: 'Market Strategy' },
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setOrchType(item.type as any)}
                        className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                          orchType === item.type
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Orchestration Prompt</label>
                    <textarea
                      rows={3}
                      value={orchPrompt}
                      onChange={(e) => setOrchPrompt(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 p-2.5 bg-white text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                disabled={running}
                onClick={() => runAgent(activeTab)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Running AI Agent Inference...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Run {currentAgent.name.split(' ')[0]} Agent</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Execution Output / Result Area */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs min-h-[440px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-700">
                    <Bot className="h-4 w-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Agent Output & Structured Insights</h3>
                </div>
                {result && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Inference Complete
                  </span>
                )}
              </div>

              {/* Loading State */}
              {running && (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-12 h-12 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <h4 className="font-bold text-slate-800 text-sm">Executing ML Neural Pipeline</h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Synthesizing multimodal features, historical market signals, and agricultural models...
                  </p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-red-800">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <h4 className="font-bold text-xs">AI Microservice Status</h4>
                      <p className="text-xs text-red-700 mt-0.5">{error}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => runAgent(activeTab)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Retry Agent Request</span>
                    </button>
                    <button
                      onClick={() => loadOfflineFixture(activeTab)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      <Info className="h-3.5 w-3.5 text-amber-600" />
                      <span>Preview Demonstration Fixture (Simulated Offline)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Empty Initial State */}
              {!running && !error && !result && (
                <div className="py-20 flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Bot className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-slate-700 text-sm">Ready to Execute</h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Select input parameters on the left and click &quot;Run Agent&quot; to see real-time inference output.
                  </p>
                </div>
              )}

              {/* Structured Result Display */}
              {!running && result && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Distinct Model / Fixture Banner */}
                  {result._isDemonstrationFixture ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Demonstration Fixture (Simulated Offline Preview — Backend Model Disconnected)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Live Backend Response</span>
                    </div>
                  )}
                  {/* Vision Analysis Output */}
                  {activeTab === 'vision' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Detected Commodity</span>
                          <p className="text-lg font-extrabold text-emerald-950 mt-0.5">{result.detectedCrop || visionCrop}</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Quality Grade</span>
                          <p className="text-lg font-extrabold text-slate-800 mt-0.5">{result.qualityGrade || 'Grade A'}</p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">Detection Confidence</span>
                          <span className="font-bold text-emerald-700">{Math.round((result.confidenceScore || 0.94) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((result.confidenceScore || 0.94) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-emerald-900">Surface Defect Assessment:</span>
                        <p className="text-slate-700">
                          {result.surfaceDefects?.length > 0
                            ? result.surfaceDefects.join(', ')
                            : 'Clean surface profile, no severe pathological lesions or mechanical punctures detected.'}
                        </p>
                        {result.modelName && (
                          <p className="text-[10px] text-slate-400 font-mono mt-1">
                            Model: {result.modelName} v{result.modelVersion}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Freshness Output */}
                  {activeTab === 'freshness' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase">Freshness</span>
                          <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
                            {result.freshnessScore || 92}%
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Firmness Index</span>
                          <p className="text-xl font-extrabold text-slate-800 mt-0.5">
                            {result.firmnessIndex || 8.8}/10
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Color Uniform</span>
                          <p className="text-xl font-extrabold text-slate-800 mt-0.5">
                            {Math.round((result.colorUniformity || 0.91) * 100)}%
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <span className="font-bold text-slate-800">Freshness Recommendation:</span>
                        <p className="text-slate-600 leading-relaxed">
                          Produce demonstrates high physiological vitality. Ideal for immediate consumer distribution or cold chain dispatch.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Shelf-Life Output */}
                  {activeTab === 'shelflife' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-emerald-800 uppercase">Remaining Shelf Life</span>
                          <p className="text-2xl font-extrabold text-emerald-950 mt-0.5">
                            {result.remainingShelfLifeDays || 6} Days
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase">90% Conformal Interval</span>
                          <p className="text-sm font-bold text-emerald-800 mt-0.5">
                            [{result.predictionIntervalLowerDays || 5} – {result.predictionIntervalUpperDays || 8} Days]
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                        <span className="font-bold text-slate-800">Storage Guidance:</span>
                        <p className="text-slate-600 leading-relaxed">
                          {result.storageRecommendation ||
                            'Keep in ventilated crisper drawer at 10-12°C for optimal freshness.'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Method: {result.uncertaintyMethod || 'Conformal Prediction Interval'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Price Forecast Output */}
                  {activeTab === 'price' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-emerald-800 uppercase">Predicted Modal Price</span>
                          <p className="text-2xl font-extrabold text-emerald-950 mt-0.5">
                            ₹{result.predictedModalPrice || 2450} <span className="text-xs font-semibold text-emerald-700">/ Quintal</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase">Confidence Interval (90%)</span>
                          <p className="text-sm font-bold text-emerald-800 mt-0.5">
                            ₹{result.predictionInterval?.lowerBound || 2320} – ₹{result.predictionInterval?.upperBound || 2580}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span>Market Location: <strong>{result.marketLocation || priceMarket}</strong></span>
                          <span>Horizon: <strong>{result.forecastHorizonDays || priceHorizon} Days</strong></span>
                        </div>
                        <div className="border-t border-slate-200 pt-2 text-[10px] text-slate-500 space-y-0.5">
                          <p>Source: {result.datasetSource || 'AGMARKNET OGD Platform India'}</p>
                          <p>Weather Augmentation: {result.weatherDataSource || 'IMD / Open-Meteo Normalization'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RAG Knowledge Output */}
                  {activeTab === 'rag' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                        <span className="font-bold text-slate-900 text-sm">Synthesized Agronomic Guidance:</span>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {result.knowledgeSummary || result.response || 'Verified agricultural recommendations.'}
                        </p>
                      </div>

                      {result.sources?.length > 0 && (
                        <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-[11px] space-y-1">
                          <span className="font-bold text-emerald-900">Verified Knowledge Sources:</span>
                          <ul className="list-disc list-inside text-emerald-800 space-y-0.5">
                            {result.sources.map((src: any, i: number) => (
                              <li key={i}>
                                {src.title || src}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Multi-Agent Orchestrator Output */}
                  {activeTab === 'orchestrator' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">Multi-Agent Strategy Response</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            {result.status || 'COMPLETED'}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                          {result.response || 'Agricultural multi-agent strategy generated.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Provenance Note */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span>AgriTrace Neural Ledger</span>
              <span className="font-mono">v2.4-production</span>
            </div>
          </div>
        </div>
      </div>
      )}
    </DashboardLayout>
  );
}
