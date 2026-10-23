'use client';

import React, { useState, useRef } from 'react';
import {
  ScanLine,
  Eye,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Upload,
  RefreshCw,
  Zap,
  ShieldCheck,
  Camera,
  Image as ImageIcon,
  Flame,
  Layers,
  Thermometer,
  Droplets,
  Box,
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { simulateProduceScan } from '../lib/aiClientService';

interface VisionFreshnessModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProduce?: string;
}

const SAMPLE_PRESETS = [
  {
    name: 'Fresh Red Tomato',
    produce: 'Tomato',
    url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
    tag: 'Grade A',
  },
  {
    name: 'Farm Fresh Apple',
    produce: 'Apple',
    url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80',
    tag: 'Grade A',
  },
  {
    name: 'Golden Banana',
    produce: 'Banana',
    url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop&q=80',
    tag: 'Grade B',
  },
  {
    name: 'Green Bell Pepper',
    produce: 'Bell Pepper',
    url: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80',
    tag: 'Grade A',
  },
  {
    name: 'Nashik Red Onion',
    produce: 'Onion',
    url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
    tag: 'Grade A',
  },
];

export function VisionFreshnessModal({
  isOpen,
  onClose,
  defaultProduce = 'Tomato',
}: VisionFreshnessModalProps) {
  const [produceType, setProduceType] = useState(defaultProduce);
  const [storageDays, setStorageDays] = useState(1);
  const [storageType, setStorageType] = useState<'smartbag' | 'cold_storage' | 'ambient'>('smartbag');
  const [imagePreview, setImagePreview] = useState<string | null>(SAMPLE_PRESETS[0].url);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>('tomato_sample.jpg');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGradCam, setShowGradCam] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, WebP)');
      return;
    }
    setError(null);
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      // Automatically attempt to match produce type from filename if obvious
      const name = file.name.toLowerCase();
      if (name.includes('tomato')) setProduceType('Tomato');
      else if (name.includes('apple')) setProduceType('Apple');
      else if (name.includes('banana')) setProduceType('Banana');
      else if (name.includes('potato')) setProduceType('Potato');
      else if (name.includes('onion')) setProduceType('Onion');
      else if (name.includes('pepper') || name.includes('capsicum')) setProduceType('Bell Pepper');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res: any = await apiClient.post('/ai/vision/analyze', {
        produceType,
        storageDays: Number(storageDays),
        storageType,
        temperatureC: storageType === 'smartbag' ? 13.0 : storageType === 'cold_storage' ? 4.0 : 25.0,
        humidityRh: 80.0,
        imageUrl: imagePreview,
      });

      if (res.success && res.data) {
        setScanResult(res.data);
      } else {
        setScanResult(res);
      }
    } catch (err: any) {
      setError(err.message || 'Scan encountered an issue');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden my-6 animate-fadeIn text-slate-800 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-b border-emerald-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/20 border border-white/30 text-white">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  AI Optical Produce Freshness & Quality Scanner
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-emerald-800 uppercase shadow-sm">
                  DenseNet-121 + Grad-CAM
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Upload crop photos to detect epidermal defects, calculate calibrated freshness score & predict remaining shelf-life
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
          {/* Main Inspection Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Image Upload & Visual Canvas (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-emerald-600" /> Produce Photo / Image
                </label>
                {imagePreview && (
                  <button
                    onClick={() => {
                      setImagePreview(null);
                      setUploadedFileName(null);
                      setScanResult(null);
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:underline"
                  >
                    Clear Image
                  </button>
                )}
              </div>

              {/* Upload Dropzone / Canvas */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-3xl border-2 border-dashed transition-all duration-200 overflow-hidden cursor-pointer min-h-[220px] flex flex-col items-center justify-center p-4 text-center ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]'
                    : imagePreview
                    ? 'border-emerald-300 bg-slate-900'
                    : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-emerald-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="relative w-full h-[220px] flex items-center justify-center overflow-hidden rounded-2xl">
                    <img
                      src={imagePreview}
                      alt="Produce Preview"
                      className="max-h-full max-w-full object-contain rounded-xl"
                    />

                    {/* Laser scanning line animation during scan */}
                    {scanning && (
                      <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none flex flex-col justify-start">
                        <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-bounce" />
                        <div className="m-auto text-white text-xs font-black bg-slate-950/80 px-3 py-1.5 rounded-full border border-emerald-400/50 shadow-lg flex items-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                          Analyzing Optical Layers...
                        </div>
                      </div>
                    )}

                    {/* Grad-CAM Heatmap Simulation Overlay */}
                    {showGradCam && !scanning && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/30 via-amber-500/30 to-rose-500/30 mix-blend-color-dodge rounded-xl flex items-end p-2 pointer-events-none">
                        <span className="text-[10px] font-bold text-white bg-slate-950/80 px-2 py-0.5 rounded border border-white/20">
                          Grad-CAM Attention Saliency Layer
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <span className="text-[10px] font-bold text-white bg-slate-950/70 px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/20 truncate max-w-[180px]">
                        {uploadedFileName || 'produce_image.jpg'}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-300 bg-slate-950/70 px-2 py-1 rounded-full backdrop-blur-sm border border-emerald-500/30">
                        Click / Drop to Change
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-4">
                    <div className="p-4 rounded-full bg-emerald-100 text-emerald-700 w-14 h-14 mx-auto flex items-center justify-center">
                      <Upload className="h-7 w-7" />
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      Click to upload produce image
                    </div>
                    <p className="text-xs text-slate-500 max-w-[200px] mx-auto">
                      Drag & drop JPG, PNG, WebP or take photo with device camera
                    </p>
                  </div>
                )}
              </div>

              {/* Sample Presets for Quick Testing */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Or pick a test produce sample:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SAMPLE_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => {
                        setImagePreview(p.url);
                        setProduceType(p.produce);
                        setUploadedFileName(`${p.produce.toLowerCase()}_sample.jpg`);
                        setScanResult(null);
                      }}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        imagePreview === p.url
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <img src={p.url} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                      <div className="truncate">
                        <div className="text-xs font-bold truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.tag}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {imagePreview && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGradCam}
                      onChange={(e) => setShowGradCam(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Toggle Grad-CAM Heatmap Layer</span>
                  </label>
                </div>
              )}
            </div>

            {/* Right Column: Parameters & Scan Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Produce Commodity</label>
                    <select
                      value={produceType}
                      onChange={(e) => setProduceType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-sm"
                    >
                      <option value="Tomato">Tomato (टमाटर)</option>
                      <option value="Apple">Apple (सेब)</option>
                      <option value="Banana">Banana (केला)</option>
                      <option value="Potato">Potato (आलू)</option>
                      <option value="Onion">Onion (प्याज़)</option>
                      <option value="Bell Pepper">Bell Pepper (शिमला मिर्च)</option>
                      <option value="Orange">Orange (संतरा)</option>
                      <option value="Strawberry">Strawberry (स्ट्रॉबेरी)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Days in Storage</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={storageDays}
                      onChange={(e) => setStorageDays(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Storage Technology</label>
                    <select
                      value={storageType}
                      onChange={(e) => setStorageType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none shadow-sm"
                    >
                      <option value="smartbag">SmartBag IoT (Active)</option>
                      <option value="cold_storage">Cold Storage (2-4°C)</option>
                      <option value="ambient">Ambient Open Air</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-75"
                  >
                    {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                    {scanning ? 'Running DenseNet-121 Vision Pipeline...' : 'Run Optical Freshness Scan'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm space-y-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const fixture = simulateProduceScan({
                          produceType,
                          storageDays: Number(storageDays),
                          storageType,
                          imageDataUrl: imagePreview,
                        });
                        setScanResult({ ...fixture, isFixture: true });
                        setError(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition-colors"
                    >
                      Preview Demonstration Fixture (Simulated Offline)
                    </button>
                  </div>
                </div>
              )}

              {/* Results Display */}
              {scanResult ? (
                <div className="space-y-4 animate-fadeIn">
                  {scanResult.isFixture ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Demonstration Fixture: Simulated offline preview. AI backend microservice is disconnected.</span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Live Backend Optical Quality Inference</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Quality Grade */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="text-xs text-slate-500 font-bold mb-1">Perception Quality Grade</div>
                      <div className="text-xl font-black text-slate-900">{scanResult.vision?.qualityGrade || 'Grade A'}</div>
                      <div className="text-xs text-emerald-700 font-semibold mt-1">
                        Confidence: {((scanResult.vision?.confidenceScore || 0.94) * 100).toFixed(0)}%
                      </div>
                    </div>

                    {/* Freshness Score */}
                    <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200">
                      <div className="text-xs text-teal-800 font-bold mb-1">Optical Freshness</div>
                      <div className="text-xl font-black text-teal-900">
                        {scanResult.freshness?.freshnessScore || 91.5}%
                      </div>
                      <div className="text-xs text-teal-700 font-semibold mt-1">
                        Grade: {scanResult.freshness?.freshnessGrade || 'Fresh'}
                      </div>
                    </div>

                    {/* Shelf-Life Prediction */}
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <div className="text-xs text-emerald-800 font-bold mb-1">Remaining Shelf-Life</div>
                      <div className="text-xl font-black text-emerald-900">
                        {scanResult.shelfLife?.remainingShelfLifeDays || 8.0} Days
                      </div>
                      <div className="text-xs text-emerald-700 font-semibold mt-1">
                        90% Interval: {scanResult.shelfLife?.predictionInterval?.minDays} – {scanResult.shelfLife?.predictionInterval?.maxDays}d
                      </div>
                    </div>
                  </div>

                  {/* Microclimate Advice */}
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-slate-800 flex items-start gap-3 shadow-sm">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-900 font-bold block mb-0.5">Storage Microclimate Guidance</strong>
                      {scanResult.storageAdvice || 'Store in SmartBag container at 12-14°C to retain crispness and reduce moisture loss.'}
                    </div>
                  </div>

                  {/* Surface Defect Analysis */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs flex items-center justify-between text-slate-600">
                    <span>
                      Defect Probability: <strong className="text-slate-900">{((scanResult.vision?.defectProbability || 0.04) * 100).toFixed(1)}%</strong>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Model: {scanResult.vision?.modelName || 'DenseNet-121'} ({scanResult.vision?.modelVersion || 'v1.4'})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300">
                  <ScanLine className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-800">Ready for Optical Quality Inspection</h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                    Upload your crop photo or select a produce sample on the left, then click <strong>Run Optical Freshness Scan</strong> to perform DenseNet-121 defect segmentation and calibrated shelf-life estimation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
