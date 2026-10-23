'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { DashboardLayout } from './DashboardLayout';
import {
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Store,
  Warehouse,
  Package,
  X,
  Loader2,
  Filter,
  RotateCcw,
  BadgeCheck,
  Building2,
  AlertCircle,
  Tag,
} from 'lucide-react';

export interface VendorSummary {
  id: string;
  uid?: string;
  full_name: string;
  business_name?: string;
  godown_name?: string;
  business_type?: string;
  phone?: string;
  address?: string;
  product_interests?: string[];
  inventory_count?: number;
  inventory?: Array<{
    id: string;
    product_name: string;
    crop_type: string;
    quantity: number;
    unit: string;
    location?: string;
    status: string;
    updated_at?: string;
  }>;
  products?: Array<{
    id: string;
    name: string;
    crop_type: string;
    variety?: string;
    price_per_unit: number;
    unit: string;
    available_quantity: number;
    quality_grade: string;
    location: string;
  }>;
}

export function VendorDirectory({ portal = 'farmer' }: { portal?: 'farmer' | 'customer' }) {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorSummary | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadVendors = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = portal === 'farmer' ? '/farmer/vendors' : '/customer/vendors';
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (selectedTypeFilter !== 'ALL') params.business_type = selectedTypeFilter;
      if (selectedLocationFilter !== 'ALL') params.district = selectedLocationFilter;

      const response: any =
        Object.keys(params).length > 0
          ? await apiClient.get(endpoint, { params })
          : await apiClient.get(endpoint);

      const raw = response?.data;
      let vendorList: VendorSummary[] = [];

      if (Array.isArray(raw)) {
        vendorList = raw;
      } else if (raw && Array.isArray(raw.items)) {
        vendorList = raw.items;
      } else if (raw && Array.isArray(raw.data)) {
        vendorList = raw.data;
      }

      setVendors(vendorList);
    } catch (err: any) {
      setError(err?.message || err?.response?.data?.error?.message || 'Could not load registered vendors.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVendors();
  }, [portal]);

  const loadVendorDetails = async (vendor: VendorSummary) => {
    setSelectedVendor({
      ...vendor,
      inventory: vendor.inventory || [],
      products: vendor.products || [],
    });
    setLoadingDetails(true);

    try {
      const vendorId = vendor.id || vendor.uid;
      const endpoint =
        portal === 'farmer'
          ? `/farmer/vendors/${vendorId}`
          : `/customer/vendors/${vendorId}`;
      const res: any = await apiClient.get(endpoint);
      if (res?.data) {
        setSelectedVendor({
          ...res.data,
          inventory: res.data.inventory || [],
          products: res.data.products || [],
        });
      }
    } catch (err: any) {
      console.warn('[AgriTrace VendorDirectory] Could not load vendor details:', err?.message || err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const uniqueBusinessTypes = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.business_type) set.add(v.business_type);
    });
    return Array.from(set).sort();
  }, [vendors]);

  const uniqueLocations = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.address) {
        const parts = v.address.split(',').map((s) => s.trim());
        parts.forEach((p) => {
          if (p.length > 2) set.add(p);
        });
      }
      if (v.godown_name) {
        const parts = v.godown_name.split(',').map((s) => s.trim());
        parts.forEach((p) => {
          if (p.length > 2) set.add(p);
        });
      }
    });
    return Array.from(set).slice(0, 10);
  }, [vendors]);

  const isFilterActive = search.trim() !== '' || selectedTypeFilter !== 'ALL' || selectedLocationFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setSelectedTypeFilter('ALL');
    setSelectedLocationFilter('ALL');
  };

  const filteredVendors = useMemo(() => {
    const query = search.trim().toLowerCase();
    const cleanPhoneQuery = query.replace(/[\s-]/g, '');

    return vendors.filter((vendor) => {
      // 1. Text Search across name, business, godown, address, phone, interests
      if (query) {
        const nameMatch = vendor.full_name?.toLowerCase().includes(query);
        const businessMatch = vendor.business_name?.toLowerCase().includes(query);
        const godownMatch = vendor.godown_name?.toLowerCase().includes(query);
        const addressMatch = vendor.address?.toLowerCase().includes(query);
        const phoneMatch =
          cleanPhoneQuery &&
          vendor.phone?.replace(/[\s-]/g, '').toLowerCase().includes(cleanPhoneQuery);
        const interestsMatch = vendor.product_interests?.some((i) => i.toLowerCase().includes(query));
        const invMatch = vendor.inventory?.some(
          (inv) =>
            inv.product_name?.toLowerCase().includes(query) ||
            inv.crop_type?.toLowerCase().includes(query)
        );

        if (!nameMatch && !businessMatch && !godownMatch && !addressMatch && !phoneMatch && !interestsMatch && !invMatch) {
          return false;
        }
      }

      // 2. Business Type Filter
      if (selectedTypeFilter !== 'ALL') {
        const typeMatch = vendor.business_type?.toLowerCase() === selectedTypeFilter.toLowerCase();
        if (!typeMatch) return false;
      }

      // 3. Location Filter
      if (selectedLocationFilter !== 'ALL') {
        const locLower = selectedLocationFilter.toLowerCase();
        const locMatch =
          vendor.address?.toLowerCase().includes(locLower) ||
          vendor.godown_name?.toLowerCase().includes(locLower);
        if (!locMatch) return false;
      }

      return true;
    });
  }, [search, selectedTypeFilter, selectedLocationFilter, vendors]);

  return (
    <DashboardLayout
      portal={portal}
      title="Registered Vendors Directory"
      subtitle="Discover registered agro-stockists, APMC buyers, and cold-chain warehouses with verified profiles."
    >
      {/* Informative Header Banner */}
      <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-amber-600 text-white rounded-xl shadow-xs shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-sm">Verified Vendor & Buyer Marketplace</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                  <BadgeCheck className="h-3 w-3" />
                  Live Directory
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-2xl">
                Browse verified agro-dealers, wholesale godowns, and institutional buyers. Check warehouse storage
                capacity, target crops of interest, and contact buyers directly.
              </p>
            </div>
          </div>
          <button
            onClick={() => void loadVendors()}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shrink-0 shadow-2xs"
          >
            <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
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
              placeholder="Search by vendor name, business, godown, mobile, or crop interest..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-xs text-slate-900 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 shadow-2xs"
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
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-700 outline-none focus:border-amber-600 shadow-2xs"
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

        {/* Business Type Filter Badges */}
        {uniqueBusinessTypes.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide shrink-0 flex items-center gap-1">
              <Filter className="h-3 w-3 text-amber-600" />
              Category:
            </span>
            <button
              onClick={() => setSelectedTypeFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors shrink-0 ${
                selectedTypeFilter === 'ALL'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Types
            </button>
            {uniqueBusinessTypes.map((bType) => (
              <button
                key={bType}
                onClick={() => setSelectedTypeFilter(bType)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors shrink-0 ${
                  selectedTypeFilter === bType
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {bType}
              </button>
            ))}
          </div>
        )}

        {/* Results Count Bar */}
        {!loading && !error && vendors.length > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800">{filteredVendors.length}</strong> of{' '}
              <strong className="text-slate-800">{vendors.length}</strong> registered vendor
              {vendors.length === 1 ? '' : 's'}
            </span>
            {isFilterActive && (
              <span className="text-amber-700 font-medium">Filtered search results</span>
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
          <h3 className="font-bold text-red-900 text-sm">Could not load vendors directory</h3>
          <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => void loadVendors()}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Empty State: Directory Empty (no profiles registered) */}
      {!loading && !error && vendors.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <Store className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="font-bold text-slate-900 text-sm">No registered vendors found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Registered vendors will appear automatically once they complete their public marketplace profile.
          </p>
        </div>
      )}

      {/* Empty State: No search match */}
      {!loading && !error && vendors.length > 0 && filteredVendors.length === 0 && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-12 text-center space-y-3">
          <Search className="mx-auto h-10 w-10 text-amber-500" />
          <h3 className="font-bold text-slate-900 text-sm">No registered vendors match your search.</h3>
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            We couldn&apos;t find any vendor matching &ldquo;{search || selectedTypeFilter || selectedLocationFilter}&rdquo;. Try
            adjusting your keywords or clear your filters.
          </p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Vendors Cards Grid */}
      {!loading && !error && filteredVendors.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVendors.map((vendor) => {
            const displayName = vendor.business_name || vendor.full_name;
            const businessType = vendor.business_type || 'Registered Vendor';
            const godownName = vendor.godown_name || 'Storage facility not specified';
            const inventoryCount =
              vendor.inventory_count !== undefined
                ? vendor.inventory_count
                : vendor.inventory?.length || 0;

            return (
              <article
                key={vendor.id || vendor.uid}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                        {displayName ? displayName.charAt(0).toUpperCase() : 'V'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm leading-tight group-hover:text-amber-800 transition-colors line-clamp-1">
                          {displayName}
                        </h3>
                        <p className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 text-amber-600" />
                          <span>{businessType}</span>
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-bold shrink-0">
                      Active
                    </span>
                  </div>

                  {/* Business Details */}
                  <div className="mt-3.5 space-y-2 text-xs text-slate-600">
                    <div className="flex items-start gap-2">
                      <Warehouse className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <span className="font-medium text-slate-800 leading-tight">{godownName}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <span className="leading-relaxed line-clamp-2">{vendor.address || 'Location not specified'}</span>
                    </div>

                    {/* Contact Number */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <Phone className="h-4 w-4 shrink-0 text-amber-600" />
                      {vendor.phone ? (
                        <a
                          href={`tel:${vendor.phone}`}
                          className="font-bold text-slate-800 hover:text-amber-700 transition-colors"
                        >
                          {vendor.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Contact information unavailable</span>
                      )}
                    </div>

                    {/* Stock items count */}
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span>{inventoryCount} warehouse inventory records</span>
                    </div>

                    {/* Crop / Product Interests */}
                    {vendor.product_interests && vendor.product_interests.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                          Purchasing Interests:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {vendor.product_interests.slice(0, 4).map((interest, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-medium"
                            >
                              <Tag className="h-2.5 w-2.5 text-amber-600" />
                              <span>{interest}</span>
                            </span>
                          ))}
                          {vendor.product_interests.length > 4 && (
                            <span className="text-[10px] text-slate-400 self-center font-medium">
                              +{vendor.product_interests.length - 4} more
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
                    onClick={() => loadVendorDetails(vendor)}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors text-center"
                  >
                    View Stock
                  </button>
                  {vendor.phone ? (
                    <a
                      href={`tel:${vendor.phone}`}
                      className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors text-center flex items-center justify-center gap-1.5 shadow-2xs"
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

      {/* Vendor Stock Details Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-5 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                  {selectedVendor.business_name
                    ? selectedVendor.business_name.charAt(0).toUpperCase()
                    : selectedVendor.full_name
                    ? selectedVendor.full_name.charAt(0).toUpperCase()
                    : 'V'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">
                      {selectedVendor.business_name || selectedVendor.full_name}
                    </h3>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedVendor.address || 'Location not specified'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVendor(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                <span className="text-xs text-slate-500 font-medium">Loading vendor warehouse stock...</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Contact Banner */}
                {selectedVendor.phone ? (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-amber-700" />
                      <div>
                        <span className="font-bold text-amber-950 text-xs">{selectedVendor.phone}</span>
                        <p className="text-[10px] text-amber-700">Official registered vendor contact number</p>
                      </div>
                    </div>
                    <a
                      href={`tel:${selectedVendor.phone}`}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1.5"
                    >
                      <Phone className="h-3 w-3" />
                      <span>Call Vendor</span>
                    </a>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
                    Contact phone is not publicly provided for this vendor.
                  </div>
                )}

                {/* Warehouse & Business Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                      Godown / Warehouse
                    </span>
                    <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                      {selectedVendor.godown_name || 'Storage facility not specified'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                      Business Classification
                    </span>
                    <span className="font-bold text-slate-900 text-xs mt-0.5 block">
                      {selectedVendor.business_type || 'Registered Vendor'}
                    </span>
                  </div>
                </div>

                {/* Crop & Product Interests */}
                {selectedVendor.product_interests && selectedVendor.product_interests.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                      <Tag className="h-4 w-4 text-amber-700" />
                      Target Crops of Procurement Interest:
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedVendor.product_interests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Inventory & Stock */}
                <div>
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Warehouse className="h-4 w-4 text-amber-700" />
                    Current Warehouse Stock & Available Products:
                  </h4>
                  {(!selectedVendor.inventory || selectedVendor.inventory.length === 0) &&
                  (!selectedVendor.products || selectedVendor.products.length === 0) ? (
                    <p className="text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                      No public inventory items recorded in this warehouse ledger at this time.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                      {selectedVendor.inventory?.map((item) => (
                        <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-xs">{item.product_name}</span>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {item.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            Available Stock: <strong>{item.quantity} {item.unit}</strong>
                          </p>
                          {item.location && (
                            <p className="text-[10px] text-slate-400">Godown: {item.location}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedVendor(null)}
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
