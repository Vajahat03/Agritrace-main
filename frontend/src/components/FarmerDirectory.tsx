'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { DashboardLayout } from './DashboardLayout';
import {
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Sprout,
  Tractor,
  X,
  Users,
  Filter,
  RotateCcw,
  BadgeCheck,
  Building,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export interface FarmerSummary {
  id: string;
  uid?: string;
  full_name: string;
  phone?: string;
  address?: string;
  farm_count?: number;
  farm_name?: string;
  location_name?: string;
  total_area?: number;
  area_unit?: string;
  crops_grown?: string[];
  farms?: Array<{
    id: string;
    name: string;
    location_name: string;
    total_area: number;
    area_unit: string;
    address?: string;
  }>;
  crops?: Array<{
    id: string;
    crop_type: string;
    variety: string;
    status: string;
    area: number;
    area_unit: string;
    planting_date: string;
    farm_id?: string;
  }>;
}

export function FarmerDirectory({ portal = 'vendor' }: { portal?: 'vendor' | 'customer' }) {
  const [farmers, setFarmers] = useState<FarmerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCropFilter, setSelectedCropFilter] = useState<string>('ALL');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerSummary | null>(null);

  const loadFarmers = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = portal === 'vendor' ? '/vendor/farmers' : '/customer/farmers';
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (selectedLocationFilter !== 'ALL') params.district = selectedLocationFilter;
      if (selectedCropFilter !== 'ALL') params.crop = selectedCropFilter;

      const response: any =
        Object.keys(params).length > 0
          ? await apiClient.get(endpoint, { params })
          : await apiClient.get(endpoint);

      const raw = response?.data;
      let farmerList: FarmerSummary[] = [];

      if (Array.isArray(raw)) {
        farmerList = raw;
      } else if (raw && Array.isArray(raw.items)) {
        farmerList = raw.items;
      } else if (raw && Array.isArray(raw.data)) {
        farmerList = raw.data;
      }

      setFarmers(farmerList);
    } catch (err: any) {
      setError(err?.message || err?.response?.data?.error?.message || 'Could not load registered farmers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFarmers();
  }, [portal]);

  const uniqueCropTypes = useMemo(() => {
    const set = new Set<string>();
    farmers.forEach((f) => {
      f.crops?.forEach((c) => {
        if (c.crop_type) set.add(c.crop_type);
      });
      f.crops_grown?.forEach((cg) => {
        if (cg) set.add(cg);
      });
    });
    return Array.from(set).sort();
  }, [farmers]);

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    farmers.forEach((f) => {
      if (f.location_name) {
        const parts = f.location_name.split(',').map((s) => s.trim());
        parts.forEach((p) => {
          if (p.length > 2) set.add(p);
        });
      }
      if (f.address) {
        const parts = f.address.split(',').map((s) => s.trim());
        parts.forEach((p) => {
          if (p.length > 2) set.add(p);
        });
      }
    });
    return Array.from(set).slice(0, 10);
  }, [farmers]);

  const isFilterActive = search.trim() !== '' || selectedCropFilter !== 'ALL' || selectedLocationFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setSelectedCropFilter('ALL');
    setSelectedLocationFilter('ALL');
  };

  const filteredFarmers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const cleanPhoneQuery = query.replace(/[\s-]/g, '');

    return farmers.filter((farmer) => {
      // 1. Text Search across name, farm, location, mobile, crops
      if (query) {
        const nameMatch = farmer.full_name?.toLowerCase().includes(query);
        const farmNameMatch =
          farmer.farm_name?.toLowerCase().includes(query) ||
          farmer.farms?.some((f) => f.name.toLowerCase().includes(query));
        const locationMatch =
          farmer.location_name?.toLowerCase().includes(query) ||
          farmer.address?.toLowerCase().includes(query) ||
          farmer.farms?.some((f) => f.location_name.toLowerCase().includes(query));
        const phoneMatch =
          cleanPhoneQuery &&
          farmer.phone?.replace(/[\s-]/g, '').toLowerCase().includes(cleanPhoneQuery);
        const cropMatch =
          farmer.crops_grown?.some((c) => c.toLowerCase().includes(query)) ||
          farmer.crops?.some(
            (c) => c.crop_type.toLowerCase().includes(query) || c.variety.toLowerCase().includes(query)
          );

        if (!nameMatch && !farmNameMatch && !locationMatch && !phoneMatch && !cropMatch) {
          return false;
        }
      }

      // 2. Crop Filter
      if (selectedCropFilter !== 'ALL') {
        const hasCrop =
          farmer.crops_grown?.some((cg) => cg.toLowerCase() === selectedCropFilter.toLowerCase()) ||
          farmer.crops?.some((c) => c.crop_type.toLowerCase() === selectedCropFilter.toLowerCase());
        if (!hasCrop) return false;
      }

      // 3. Location Filter
      if (selectedLocationFilter !== 'ALL') {
        const locLower = selectedLocationFilter.toLowerCase();
        const locMatch =
          farmer.location_name?.toLowerCase().includes(locLower) ||
          farmer.address?.toLowerCase().includes(locLower) ||
          farmer.farms?.some((f) => f.location_name.toLowerCase().includes(locLower));
        if (!locMatch) return false;
      }

      return true;
    });
  }, [search, selectedCropFilter, selectedLocationFilter, farmers]);

  return (
    <DashboardLayout
      portal={portal}
      title="Registered Farmers Directory"
      subtitle="Discover registered agricultural producers, standing crops, and farm origins for direct procurement."
    >
      {/* Header Banner */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-sm">Verified Producer Marketplace</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  <BadgeCheck className="h-3 w-3" />
                  Live Directory
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-2xl">
                Browse verified farmer profiles, land holdings, and current harvest availability. Connect directly for
                contract farming, mandi logistics, or farm-gate procurement.
              </p>
            </div>
          </div>
          <button
            onClick={() => void loadFarmers()}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shrink-0 shadow-2xs"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by farmer name, farm name, mobile, crop, or district..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-xs text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Location Filter */}
          {uniqueLocations.length > 0 && (
            <div className="sm:w-52">
              <select
                value={selectedLocationFilter}
                onChange={(e) => setSelectedLocationFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-700 outline-none focus:border-emerald-600 shadow-2xs"
              >
                <option value="ALL">All Locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters Button */}
          {isFilterActive && (
            <button
              onClick={clearFilters}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors shrink-0 shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Crop Filter Badges */}
        {uniqueCropTypes.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide shrink-0 flex items-center gap-1">
              <Filter className="h-3 w-3 text-emerald-600" />
              Crops:
            </span>
            <button
              onClick={() => setSelectedCropFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors shrink-0 ${
                selectedCropFilter === 'ALL'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Crops
            </button>
            {uniqueCropTypes.map((crop) => (
              <button
                key={crop}
                onClick={() => setSelectedCropFilter(crop)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors shrink-0 ${
                  selectedCropFilter === crop
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {crop}
              </button>
            ))}
          </div>
        )}

        {/* Results Count Bar */}
        {!loading && !error && farmers.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{filteredFarmers.length}</strong> of{' '}
              <strong className="text-slate-800">{farmers.length}</strong> registered farmer
              {farmers.length === 1 ? '' : 's'}
            </span>
            {isFilterActive && (
              <span className="text-emerald-700 font-medium">Filtered search results</span>
            )}
          </div>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
              <div className="h-12 rounded-xl bg-slate-50" />
              <div className="h-8 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
          <h3 className="font-bold text-red-900 text-sm">Could not load farmers directory</h3>
          <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => void loadFarmers()}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Empty State: Directory Empty (no profiles registered) */}
      {!loading && !error && farmers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <Users className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="font-bold text-slate-900 text-sm">No registered farmers found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Registered farmers with completed profiles will automatically appear in this marketplace directory.
          </p>
        </div>
      )}

      {/* Empty State: No search match */}
      {!loading && !error && farmers.length > 0 && filteredFarmers.length === 0 && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-12 text-center space-y-3">
          <Search className="mx-auto h-10 w-10 text-amber-500" />
          <h3 className="font-bold text-slate-900 text-sm">No registered farmers match your search.</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            We couldn&apos;t find any farmer matching &ldquo;{search || selectedCropFilter || selectedLocationFilter}&rdquo;. Try
            adjusting your keywords or clear your filters.
          </p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Farmer Cards Grid */}
      {!loading && !error && filteredFarmers.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFarmers.map((farmer) => {
            const farmName =
              farmer.farm_name ||
              (farmer.farms && farmer.farms.length > 0 ? farmer.farms[0].name : 'Farm not specified');
            const totalAreaDisplay =
              farmer.total_area && farmer.total_area > 0
                ? `${farmer.total_area} ${farmer.area_unit || 'acres'}`
                : farmer.farms && farmer.farms.length > 0 && farmer.farms[0].total_area
                ? `${farmer.farms[0].total_area} ${farmer.farms[0].area_unit || 'acres'}`
                : null;
            const locationDisplay =
              farmer.location_name ||
              farmer.address ||
              (farmer.farms && farmer.farms.length > 0 ? farmer.farms[0].location_name : 'Location not specified');

            const allCrops = farmer.crops_grown && farmer.crops_grown.length > 0
              ? farmer.crops_grown
              : farmer.crops
              ? Array.from(new Set(farmer.crops.map((c) => c.crop_type)))
              : [];

            return (
              <article
                key={farmer.id || farmer.uid}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Avatar & Identity */}
                  <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                        {farmer.full_name ? farmer.full_name.charAt(0).toUpperCase() : 'F'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-emerald-800 transition-colors">
                          {farmer.full_name}
                        </h3>
                        <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                          <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Agricultural Producer</span>
                        </p>
                      </div>
                    </div>
                    {totalAreaDisplay && (
                      <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold shrink-0">
                        {totalAreaDisplay}
                      </span>
                    )}
                  </div>

                  {/* Farm Details */}
                  <div className="mt-3.5 space-y-2 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <Tractor className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-800">{farmName}</span>
                        {farmer.farm_count && farmer.farm_count > 1 ? (
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({farmer.farm_count} plots)
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                      <span className="leading-relaxed line-clamp-2">{locationDisplay}</span>
                    </div>

                    {/* Contact Number */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <Phone className="h-4 w-4 shrink-0 text-emerald-600" />
                      {farmer.phone ? (
                        <a
                          href={`tel:${farmer.phone}`}
                          className="font-bold text-slate-800 hover:text-emerald-700 transition-colors"
                        >
                          {farmer.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Contact information unavailable</span>
                      )}
                    </div>

                    {/* Crops Grown */}
                    {allCrops.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                          Crops & Available Produce:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {allCrops.slice(0, 4).map((cropName, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-medium"
                            >
                              <Sprout className="h-3 w-3 text-emerald-600" />
                              <span>{cropName}</span>
                            </span>
                          ))}
                          {allCrops.length > 4 && (
                            <span className="text-[10px] text-slate-400 self-center font-medium">
                              +{allCrops.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedFarmer(farmer)}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors text-center"
                  >
                    View Profile
                  </button>
                  {farmer.phone ? (
                    <a
                      href={`tel:${farmer.phone}`}
                      className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors text-center flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Contact</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="py-2 px-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed"
                    >
                      No Phone
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Detailed Farmer Profile Modal */}
      {selectedFarmer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                  {selectedFarmer.full_name ? selectedFarmer.full_name.charAt(0).toUpperCase() : 'F'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{selectedFarmer.full_name}</h3>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedFarmer.location_name || selectedFarmer.address || (selectedFarmer.farms && selectedFarmer.farms.length > 0 ? selectedFarmer.farms[0].location_name : 'Location not specified')}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFarmer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Direct Call Banner */}
              {selectedFarmer.phone ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-emerald-700" />
                    <div>
                      <span className="font-bold text-emerald-950 text-xs">{selectedFarmer.phone}</span>
                      <p className="text-[10px] text-emerald-700">Official registered mobile for farm procurement</p>
                    </div>
                  </div>
                  <a
                    href={`tel:${selectedFarmer.phone}`}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1.5"
                  >
                    <Phone className="h-3 w-3" />
                    <span>Call Farmer</span>
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
                  Contact phone is not publicly provided for this farmer.
                </div>
              )}

              {/* Registered Farms */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Tractor className="h-4 w-4 text-emerald-700" />
                  Registered Farm Holdings & Plots:
                </h4>
                {selectedFarmer.farms && selectedFarmer.farms.length > 0 ? (
                  <div className="space-y-2">
                    {selectedFarmer.farms.map((farm) => (
                      <div
                        key={farm.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{farm.name}</span>
                          <p className="text-[11px] text-slate-500">{farm.location_name || farm.address}</p>
                        </div>
                        <span className="font-bold text-emerald-800 text-xs bg-emerald-100/60 px-2 py-0.5 rounded-lg border border-emerald-200">
                          {farm.total_area} {farm.area_unit || 'acres'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 py-3 text-center bg-slate-50 rounded-xl">
                    No specific farm plot details registered.
                  </p>
                )}
              </div>

              {/* Standing Crops */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Sprout className="h-4 w-4 text-emerald-700" />
                  Standing Produce & Crops Currently Growing:
                </h4>
                {selectedFarmer.crops && selectedFarmer.crops.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto p-1">
                    {selectedFarmer.crops.map((crop) => (
                      <div
                        key={crop.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">
                            {crop.crop_type} ({crop.variety})
                          </span>
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {crop.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Field Area: <strong>{crop.area} {crop.area_unit}</strong>
                        </p>
                        {crop.planting_date && (
                          <p className="text-[10px] text-slate-400">
                            Planted: {crop.planting_date}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : selectedFarmer.crops_grown && selectedFarmer.crops_grown.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    {selectedFarmer.crops_grown.map((cg, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs"
                      >
                        {cg}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 py-3 text-center bg-slate-50 rounded-xl">
                    No active crops recorded at this moment.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedFarmer(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
