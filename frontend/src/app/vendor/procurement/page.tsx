'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { DataTable, Column } from '../../../components/DataTable';
import { apiClient } from '../../../lib/apiClient';
import { VendorProcurement } from '../../../types';
import { Tractor, PlusCircle, X, ShieldCheck } from 'lucide-react';

export default function VendorProcurementPage() {
  const [procurements, setProcurements] = useState<VendorProcurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcureModalOpen, setIsProcureModalOpen] = useState(false);
  const [procureForm, setProcureForm] = useState({
    batchId: '00000000-0000-0000-0000-000000000001',
    quantity: 150,
    purchasePrice: 4200,
    purchaseDate: new Date().toISOString().split('T')[0],
    transportDetails: 'Temperature Controlled Agro Van (MH-15-AB-4321)',
    location: 'Vashi Central APMC Cold Hub',
    notes: 'Grade A Roma tomatoes procured direct from farm',
  });

  useEffect(() => {
    loadProcurements();
  }, []);

  const loadProcurements = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/vendor/procurement');
      if (res?.data) {
        setProcurements(res.data);
      }
    } catch {
      setProcurements([
        {
          id: 'proc-1',
          vendor_id: 'vendor-1',
          batch_id: 'batch-1',
          farmer_id: 'farmer-1',
          quantity: 150,
          unit: 'kg',
          purchase_price: 4200,
          purchase_date: '2026-09-02',
          transport_details: 'Temperature Controlled Agro Van',
          created_at: '2026-09-02T10:00:00Z',
          batch: { batch_code: 'TOM-2026-0001', crop_type: 'Tomato', variety: 'Roma Supreme' },
          farmer: { full_name: 'Ramesh Patil (Kisan)', phone: '+91 98230 11223' },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/vendor/procurement', procureForm);
      setIsProcureModalOpen(false);
      loadProcurements();
    } catch {
      const newProc: VendorProcurement = {
        id: `proc-${Date.now()}`,
        vendor_id: 'vendor-1',
        batch_id: procureForm.batchId,
        farmer_id: 'farmer-1',
        quantity: Number(procureForm.quantity),
        unit: 'kg',
        purchase_price: Number(procureForm.purchasePrice),
        purchase_date: procureForm.purchaseDate,
        transport_details: procureForm.transportDetails,
        notes: procureForm.notes,
        created_at: new Date().toISOString(),
        batch: { batch_code: 'TOM-2026-0001', crop_type: 'Tomato', variety: 'Roma' },
        farmer: { full_name: 'Ramesh Patil (Kisan)', phone: '+91 98230 11223' },
      };
      setProcurements([newProc, ...procurements]);
      setIsProcureModalOpen(false);
    }
  };

  const columns: Column<VendorProcurement>[] = [
    {
      header: 'Procurement Date',
      accessorKey: 'purchase_date',
      cell: (r) => <span className="font-mono text-white">{r.purchase_date}</span>,
    },
    {
      header: 'Batch & Produce',
      cell: (r) => (
        <div>
          <span className="font-mono font-bold text-emerald-300">{r.batch?.batch_code || 'Batch'}</span>
          <p className="text-xs text-white">{r.batch?.crop_type} ({r.batch?.variety})</p>
        </div>
      ),
    },
    {
      header: 'Farmer Origin',
      cell: (r) => (
        <div>
          <p className="font-semibold text-white">{r.farmer?.full_name || 'Partner Farmer'}</p>
          <span className="text-[10px] text-emerald-400/80">{r.farmer?.phone}</span>
        </div>
      ),
    },
    {
      header: 'Procured Qty',
      cell: (r) => <span className="font-bold text-white">{r.quantity} {r.unit}</span>,
    },
    {
      header: 'Purchase Price (₹)',
      cell: (r) => <span className="font-mono font-bold text-emerald-300">₹{r.purchase_price.toLocaleString()}</span>,
    },
    {
      header: 'Logistics',
      accessorKey: 'transport_details',
      cell: (r) => <span className="text-emerald-300/70 text-[11px] truncate max-w-xs">{r.transport_details || 'Standard'}</span>,
    },
  ];

  return (
    <DashboardLayout
      portal="vendor"
      title="Direct Farmer Batch Procurement"
      subtitle="Purchase directly from harvest produce batches with automatic traceability transfer to your inventory."
      actionButton={
        <button
          onClick={() => setIsProcureModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-[#081C15] font-bold text-xs shadow-glowAmber hover:bg-amber-400"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Procurement Order</span>
        </button>
      }
    >
      <DataTable
        columns={columns}
        data={procurements}
        searchPlaceholder="Filter procurements by batch or farmer..."
      />

      {isProcureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl glass-card border border-amber-500/40 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-emerald-800/50 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tractor className="h-4 w-4 text-amber-400" />
                <span>Procure From Farmer Batch</span>
              </h3>
              <button onClick={() => setIsProcureModalOpen(false)} className="text-emerald-400/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProcureSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Batch Code / ID *</label>
                  <input
                    type="text"
                    required
                    value={procureForm.batchId}
                    onChange={(e) => setProcureForm({ ...procureForm, batchId: e.target.value })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Quantity (kg) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={procureForm.quantity}
                    onChange={(e) => setProcureForm({ ...procureForm, quantity: Number(e.target.value) })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={procureForm.purchasePrice}
                    onChange={(e) => setProcureForm({ ...procureForm, purchasePrice: Number(e.target.value) })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Procurement Date *</label>
                  <input
                    type="date"
                    required
                    value={procureForm.purchaseDate}
                    onChange={(e) => setProcureForm({ ...procureForm, purchaseDate: e.target.value })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-300 font-medium mb-1">Transport / Logistics Details</label>
                <input
                  type="text"
                  placeholder="e.g. Temperature Controlled Van (MH-15-AB-4321)"
                  value={procureForm.transportDetails}
                  onChange={(e) => setProcureForm({ ...procureForm, transportDetails: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-medium mb-1">Receiving Location / Hub</label>
                <input
                  type="text"
                  value={procureForm.location}
                  onChange={(e) => setProcureForm({ ...procureForm, location: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-emerald-900/50">
                <button
                  type="button"
                  onClick={() => setIsProcureModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 text-[#081C15] font-bold shadow-glowAmber hover:bg-amber-400"
                >
                  Complete Procurement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
