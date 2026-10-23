'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { DataTable, Column } from '../../../components/DataTable';
import { apiClient, extractApiArray } from '../../../lib/apiClient';
import { VendorInventory } from '../../../types';
import { Package, AlertCircle, Edit3, X, CheckCircle2, PlusCircle, RefreshCw, Loader2 } from 'lucide-react';

export default function VendorInventoryPage() {
  const [inventory, setInventory] = useState<VendorInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<VendorInventory | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    adjustmentType: 'DAMAGE',
    quantityChange: -5,
    reason: '',
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await apiClient.get('/vendor/inventory');
      const items = extractApiArray<VendorInventory>(res);
      setInventory(items);
    } catch (err: any) {
      console.warn('Could not load inventory:', err);
      setError(err?.message || 'Unable to connect to inventory service.');
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await apiClient.post(`/vendor/inventory/${selectedItem.id}/adjust`, {
        adjustmentType: adjustForm.adjustmentType,
        quantityChange: Number(adjustForm.quantityChange),
        reason: adjustForm.reason,
      });
      setFeedback({ type: 'success', message: 'Stock adjustment applied and ledger updated!' });
      setSelectedItem(null);
      await loadInventory();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Stock adjustment failed on server.',
      });
    }
  };

  const columns: Column<VendorInventory>[] = [
    {
      header: 'Product Name',
      accessorKey: 'product_name',
      cell: (r) => <span className="font-bold text-slate-900">{r.product_name}</span>,
    },
    {
      header: 'Batch Reference',
      cell: (r) => (
        <span className="font-mono text-xs font-semibold text-emerald-700">
          {r.batch?.batch_code || 'Direct Batch'}
        </span>
      ),
    },
    {
      header: 'Current Stock',
      cell: (r) => (
        <span className={`font-extrabold ${r.quantity < 10 ? 'text-amber-700' : 'text-slate-900'}`}>
          {r.quantity} {r.unit}
        </span>
      ),
    },
    {
      header: 'Storage Location',
      accessorKey: 'location',
      cell: (r) => <span className="text-slate-600 text-xs">{r.location || 'Central Warehouse'}</span>,
    },
    {
      header: 'Status',
      cell: (r) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            r.status === 'LOW_STOCK'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      header: 'Action',
      cell: (r) => (
        <button
          onClick={() => setSelectedItem(r)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>Adjust Stock</span>
        </button>
      ),
    },
  ];

  return (
    <DashboardLayout
      portal="vendor"
      title="Vendor Inventory & Stock Ledger"
      subtitle="Track procured batch stock, godown storage rooms, damage write-offs, and marketplace-ready items."
    >
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl text-xs font-semibold border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void loadInventory()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-bold transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500 font-medium">Loading inventory ledger...</span>
        </div>
      ) : !error && inventory.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-3">
          <Package className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="font-bold text-slate-900 text-sm">No inventory items in stock</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Your inventory will update automatically when batches are procured from farmers or restocked.
          </p>
          <button
            onClick={() => void loadInventory()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
          <DataTable
            columns={columns}
            data={inventory}
            searchPlaceholder="Search inventory by product name or batch..."
          />
        </div>
      )}

      {/* Adjust Stock Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4 text-xs shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Adjust Stock: {selectedItem.product_name}
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Adjustment Reason Type</label>
                <select
                  value={adjustForm.adjustmentType}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentType: e.target.value })}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="DAMAGE">Transit / Handling Damage</option>
                  <option value="DISCARD">Shelf-Life Expiry Discard</option>
                  <option value="CORRECTION">Audit Count Correction</option>
                  <option value="RESTOCK">Direct Manual Restock</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Quantity Change ({selectedItem.unit}) — use negative to decrease
                </label>
                <input
                  type="number"
                  required
                  value={adjustForm.quantityChange}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantityChange: Number(e.target.value) })}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 font-mono focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason / Ledger Notes *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Notes for the audit ledger..."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
