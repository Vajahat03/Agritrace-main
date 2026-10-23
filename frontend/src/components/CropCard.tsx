'use client';

import React from 'react';
import Link from 'next/link';
import { Crop } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  Calendar,
  MapPin,
  Maximize2,
  Sprout,
  PlusCircle,
  FlaskConical,
  Package,
  ChevronRight,
} from 'lucide-react';

interface CropCardProps {
  crop: Crop;
  onAddFertilizer?: (crop: Crop) => void;
  onLogHarvest?: (crop: Crop) => void;
}

export function CropCard({ crop, onAddFertilizer, onLogHarvest }: CropCardProps) {
  const { translateCommodity, t } = useLanguage();

  const statusColors: Record<string, string> = {
    PLANNING: 'bg-blue-50 text-blue-700 border-blue-200',
    GROWING: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    READY_FOR_HARVEST: 'bg-amber-50 text-amber-800 border-amber-200',
    HARVESTED: 'bg-purple-50 text-purple-700 border-purple-200',
    ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const defaultCropImages: Record<string, string> = {
    tomato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
    onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
    potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80',
    chili: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=600&auto=format&fit=crop&q=80',
    mango: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&auto=format&fit=crop&q=80',
  };

  const cropImage =
    crop.image_url ||
    defaultCropImages[crop.crop_type.toLowerCase()] ||
    'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&auto=format&fit=crop&q=80';

  return (
    <div className="rounded-2xl bg-white overflow-hidden flex flex-col group border border-slate-200 shadow-xs hover:shadow-md transition-all">
      {/* Image Header */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-100">
        <img
          src={cropImage}
          alt={crop.crop_type}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold border backdrop-blur-md shadow-xs ${
              statusColors[crop.status] || statusColors.GROWING
            }`}
          >
            {crop.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Crop Area */}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2.5 py-0.5 rounded-full text-xs font-bold text-slate-800 border border-white/60 shadow-xs">
          {crop.area} {crop.area_unit || 'acre'}
        </div>

        {/* Crop Title */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-xl font-extrabold text-white leading-tight drop-shadow-sm">
            {translateCommodity(crop.crop_type)}
          </h3>
          <p className="text-xs text-emerald-200 font-medium">
            Variety: <span className="text-white font-bold">{crop.variety}</span>
          </p>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <MapPin className="h-3.5 w-3.5" />
              {crop.farm?.name || 'Main Farm'}
            </span>
            <span className="text-slate-500 font-mono">
              Plot: {crop.plot?.name || 'Plot 1'}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Calendar className="h-3.5 w-3.5" />
              Planted Date:
            </span>
            <span className="font-semibold text-slate-800">{crop.planting_date}</span>
          </div>

          {crop.expected_harvest_date && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-700">
                <Package className="h-3.5 w-3.5" />
                Est. Harvest:
              </span>
              <span className="font-bold text-amber-800">{crop.expected_harvest_date}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-2">
            {onAddFertilizer && (
              <button
                onClick={() => onAddFertilizer(crop)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors"
              >
                <FlaskConical className="h-3.5 w-3.5 text-emerald-700" />
                + Fertilizer
              </button>
            )}
            {onLogHarvest && (
              <button
                onClick={() => onLogHarvest(crop)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-colors"
              >
                <Package className="h-3.5 w-3.5 text-amber-700" />
                + Harvest
              </button>
            )}
          </div>

          <Link
            href={`/farmer/crops/${crop.id}`}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs"
          >
            <span>{t?.common?.viewDetails || 'View Details'}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
