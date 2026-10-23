'use client';

import React, { useState, useRef } from 'react';
import {
  Cpu,
  Eye,
  Clock,
  Box,
  AlertTriangle,
  TrendingUp,
  Users,
  Truck,
  CheckCircle,
  X,
  Play,
  RefreshCw,
  Zap,
  Sliders,
  Sparkles,
  Thermometer,
  Droplets,
  Wind,
  Camera,
  Upload,
  ImageIcon,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { simulateAgentDAGRun } from '../lib/aiClientService';

interface AIAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId?: string;
  produceType?: string;
  quantityKg?: number;
}

export function AIAgentsModal({
  isOpen,
  onClose,
  batchId = 'BATCH-TOM-001',
  produceType = 'tomato',
  quantityKg = 500,
}: AIAgentsModalProps) {
  const [activeBatchId, setActiveBatchId] = useState(batchId);
  const [selectedProduce, setSelectedProduce] = useState(produceType);
  const [quantity, setQuantity] = useState(quantityKg);
  const [temperatureC, setTemperatureC] = useState(22.0);
  const [humidityRh, setHumidityRh] = useState(80.0);
  const [gasVocPpm, setGasVocPpm] = useState(15.0);
  const [marketTrend, setMarketTrend] = useState('rising');
  const [smartbagActive, setSmartbagActive] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(
    'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80'
  );
  const [imageFileName, setImageFileName] = useState<string | null>('tomato_batch.jpg');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [agentResult, setAgentResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setSelectedFile(file);
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRunDAG = async () => {
    setRunning(true);
    setError(null);
    try {
      let res: any;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('produceType', selectedProduce);
        formData.append('quantityKg', String(quantity));
        formData.append('temperatureC', String(temperatureC));
        formData.append('humidityRh', String(humidityRh));
        if (activeBatchId) formData.append('batchId', activeBatchId);
        formData.append('marketTrend', marketTrend);
        res = await apiClient.post('/ai/workflows/scan', formData);
      } else {
        res = await apiClient.post('/ai/agent/run', {
          batchId: activeBatchId,
          produceType: selectedProduce,
          quantityKg: Number(quantity),
          temperatureC: Number(temperatureC),
          humidityRh: Number(humidityRh),
          gasVocPpm: Number(gasVocPpm),
          marketTrend,
          smartbagActive,
          imageUrl: imagePreview,
        });
      }

      if (res.success && res.data) {
        setAgentResult(res.data);
      } else {
        setAgentResult(res);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Error executing agent DAG workflow');
    } finally {
      setRunning(false);
    }
  };

  const handleRetry = async () => {
    const wfId = agentResult?.workflow_id || agentResult?.id;
    if (!wfId) return;
    setRetrying(true);
    setError(null);
    try {
      const res: any = await apiClient.post(`/ai/workflows/${wfId}/retry`);
      if (res.success && res.data) {
        setAgentResult(res.data);
      } else {
        setAgentResult(res);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Error retrying failed workflow agents');
    } finally {
      setRetrying(false);
    }
  };

  const g = agentResult?.executionGraph;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6 animate-fadeIn text-slate-800 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-b border-emerald-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 border border-white/30 text-white">
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Autonomous 9-Agent DAG Orchestration Engine
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-emerald-800 uppercase shadow-sm">
                  DAG v2.0
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Multi-agent graph coordinating Optical Perception, Shelf-Life, Storage IoT, Risk, Mandi Market, Buyer Matching & Consensus
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Top Configuration & Produce Image Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            {/* Image upload thumbnail */}
            <div className="lg:col-span-3 flex flex-col items-center justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-28 rounded-2xl border-2 border-dashed border-emerald-400 bg-slate-900 relative overflow-hidden cursor-pointer group flex items-center justify-center"
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Batch produce" className="w-full h-full object-cover group-hover:opacity-75 transition-opacity" />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                      <Camera className="h-4 w-4 mr-1" /> Change Photo
                    </div>
                  </>
                ) : (
                  <div className="text-center p-2">
                    <Upload className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                    <span className="text-[11px] font-bold text-slate-300">Upload Produce Photo</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] font-medium text-slate-500 mt-1 truncate max-w-full">
                {imageFileName || 'produce_image.jpg'}
              </span>
            </div>

            {/* Inputs */}
            <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Batch Code</label>
                <input
                  type="text"
                  value={activeBatchId}
                  onChange={(e) => setActiveBatchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Produce Commodity</label>
                <select
                  value={selectedProduce}
                  onChange={(e) => setSelectedProduce(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-sm"
                >
                  <option value="tomato">Tomato (टमाटर)</option>
                  <option value="potato">Potato (आलू)</option>
                  <option value="onion">Onion (प्याज़)</option>
                  <option value="bell_pepper">Bell Pepper (शिमला मिर्च)</option>
                  <option value="apple">Apple (सेब)</option>
                  <option value="banana">Banana (केला)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (kg)</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-sm"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end pt-1">
                <button
                  onClick={handleRunDAG}
                  disabled={running}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-75"
                >
                  {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                  {running ? 'Executing 9-Agent DAG Pipeline...' : 'Execute Full 9-Agent DAG'}
                </button>
              </div>
            </div>
          </div>

          {/* Environmental Telemetry Sliders */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-slate-700">Temp: </span>
              <input
                type="number"
                step="0.5"
                value={temperatureC}
                onChange={(e) => setTemperatureC(Number(e.target.value))}
                className="w-16 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-900 text-xs font-bold"
              />
              <span className="text-slate-600">°C</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-teal-600 shrink-0" />
              <span className="font-semibold text-slate-700">RH: </span>
              <input
                type="number"
                step="1"
                value={humidityRh}
                onChange={(e) => setHumidityRh(Number(e.target.value))}
                className="w-16 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-900 text-xs font-bold"
              />
              <span className="text-slate-600">%</span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-slate-700">Gas VOC: </span>
              <input
                type="number"
                step="1"
                value={gasVocPpm}
                onChange={(e) => setGasVocPpm(Number(e.target.value))}
                className="w-16 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-900 text-xs font-bold"
              />
              <span className="text-slate-600">ppm</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smartbagActive}
                  onChange={(e) => setSmartbagActive(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-emerald-800 font-bold">SmartBag IoT Active</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm space-y-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    const fixture = simulateAgentDAGRun({
                      batchId: activeBatchId,
                      produceType: selectedProduce,
                      quantityKg: Number(quantity),
                      temperatureC: Number(temperatureC),
                      humidityRh: Number(humidityRh),
                      gasVocPpm: Number(gasVocPpm),
                      marketTrend,
                      smartbagActive,
                      imageDataUrl: imagePreview,
                    });
                    setAgentResult({ ...fixture, isFixture: true });
                    setError(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition-colors"
                >
                  Preview Demonstration Fixture (Simulated Offline)
                </button>
              </div>
            </div>
          )}

          {/* Execution DAG Matrix */}
          {agentResult ? (
            <div className="space-y-6 animate-fadeIn">
              {agentResult.isFixture ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Demonstration Fixture: Simulated offline preview. Backend 9-Agent DAG microservice is disconnected.</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Live Backend 8-Agent DAG Execution — Status: {agentResult?.status || 'COMPLETED'}</span>
                  </div>
                  {(agentResult?.status === 'PARTIAL_SUCCESS' || agentResult?.status === 'FAILED') && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={retrying}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                      {retrying ? 'Retrying Nodes...' : 'Retry Failed Nodes'}
                    </button>
                  )}
                </div>
              )}
              {/* Agent Nodes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* 1. Vision Agent */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-emerald-600" /> 1. Perception
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-700">
                    Grade: <strong className="text-slate-900">{g?.perception?.quality_grade || 'Grade A'}</strong>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold">
                    Freshness: {g?.perception?.freshness_score || 89.0}%
                  </div>
                </div>

                {/* 2. Shelf-Life Agent */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-teal-600" /> 2. Shelf-Life
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-700">
                    Longevity: <strong className="text-slate-900">{g?.shelfLife?.estimated_remaining_days || 7.5} days</strong>
                  </div>
                  <div className="text-[11px] text-teal-700 font-semibold">
                    48h Risk: {((g?.shelfLife?.spoilage_risk_48h || 0.12) * 100).toFixed(0)}%
                  </div>
                </div>

                {/* 3. Storage Agent */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-800 flex items-center gap-1.5">
                      <Box className="h-3.5 w-3.5 text-cyan-600" /> 3. Storage IoT
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-700">
                    Target: <strong className="text-slate-900">{g?.storage?.recommended_temp_c || 13}°C</strong>
                  </div>
                  <div className="text-[11px] text-cyan-700 font-semibold truncate">
                    Mode: {g?.storage?.mode || 'SmartBag Active'}
                  </div>
                </div>

                {/* 4. Risk Agent */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> 4. Risk Analysis
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-700">
                    Thermal Risk: <strong className="text-amber-700">{g?.risk?.thermal_risk || 'LOW'}</strong>
                  </div>
                  <div className="text-[11px] text-amber-700 font-semibold">
                    Microclimate: {g?.risk?.microclimate_stability || 'OPTIMAL'}
                  </div>
                </div>

                {/* 5. Market Agent */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> 5. Market Trend
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-700">
                    Trend: <strong className="text-emerald-700">{g?.market?.trend || 'RISING'}</strong>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold truncate">
                    Sentiment: {g?.market?.mandi_sentiment || 'Positive'}
                  </div>
                </div>

                {/* 6. Buyer Matching Agent */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-indigo-600" /> 6. Buyer Match
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-700 truncate">
                    Top: <strong className="text-slate-900">{g?.buyerMatching?.topMatch?.buyer_name || 'Metro Wholesale'}</strong>
                  </div>
                  <div className="text-[11px] text-indigo-700 font-semibold">
                    Offer: ₹{g?.buyerMatching?.topMatch?.offered_price_rs_kg || 26.5}/kg
                  </div>
                </div>

                {/* 7. Logistics Agent */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-teal-600" /> 7. Logistics
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-700">
                    Window: <strong className="text-slate-900">{g?.logistics?.dispatch_window_hours || 36}h</strong>
                  </div>
                  <div className="text-[11px] text-teal-700 truncate font-semibold">
                    {g?.logistics?.optimized_route || 'Direct Corridor'}
                  </div>
                </div>

                {/* 8. Decision Agent */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-emerald-600" /> 8. Decision
                    </span>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xs text-slate-700">
                    Consensus: <strong className="text-emerald-700">{g?.decision?.action || 'HOLD'}</strong>
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold">
                    Confidence: {((g?.decision?.confidence || 0.94) * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Master Decision Summary Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-300 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Master Orchestrator DAG Action Plan
                    </h4>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
                    {g?.decision?.action || 'SMARTBAG_DISPATCH'}
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-semibold">
                  {g?.decision?.rationale ||
                    'Autonomous multi-agent consensus achieved. Freshness quality and market trend support holding under SmartBag active microclimate before premium dispatch.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300">
              <Cpu className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800">Run 9-Agent DAG Orchestrator</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                Trigger the autonomous multi-agent pipeline to process batch telemetry, evaluate post-harvest quality, calculate shelf-life, match buyers, and generate optimal action plans.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
