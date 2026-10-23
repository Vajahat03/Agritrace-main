'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { DataTable, Column } from '../../../components/DataTable';
import { QRCodeModal } from '../../../components/QRCodeModal';
import { apiClient, extractApiArray } from '../../../lib/apiClient';
import { ProduceBatch } from '../../../types';
import { Package, QrCode, ShieldCheck, MapPin, Calendar, ExternalLink, AlertCircle, RefreshCw, Loader2, PlusCircle } from 'lucide-react';

export default function FarmerBatchesPage() {
  const [batches, setBatches] = useState<ProduceBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchForQR, setSelectedBatchForQR] = useState<ProduceBatch | null>(null);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const res: any = await apiClient.get('/farmer/batches');
      const batchList = extractApiArray<ProduceBatch>(res);
      setBatches(batchList);
    } catch (err: any) {
      console.warn('Could not load batches:', err);
      setError(err?.message || 'Unable to connect to produce batch service.');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<ProduceBatch>[] = [
    {
      header: 'Batch Code',
      cell: (r) => (
        <span className="font-mono font-bold text-white flex items-center gap-1.5">
          <Package className="h-4 w-4 text-emerald-400" />
          {r.batch_code}
        </span>
      ),
    },
    {
      header: 'Produce & Variety',
      cell: (r) => (
        <div>
          <p className="font-semibold text-white">{r.crop_type}</p>
          <span className="text-[10px] text-emerald-400">{r.variety}</span>
        </div>
      ),
    },
    {
      header: 'Available Qty',
      cell: (r) => (
        <span className="font-semibold text-emerald-300">
          {r.current_quantity} / {r.initial_quantity} {r.unit}
        </span>
      ),
    },
    {
      header: 'Harvest Date',
      accessorKey: 'harvest_date',
      cell: (r) => <span className="font-mono text-emerald-100">{r.harvest_date}</span>,
    },
    {
      header: 'Status',
      cell: (r) => (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          {r.current_status}
        </span>
      ),
    },
    {
      header: 'Traceability',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedBatchForQR(r)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-600/50 text-purple-300 hover:bg-purple-900/60 text-xs font-medium"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>QR Label</span>
          </button>
          <Link
            href={`/trace/batch/${r.batch_code}`}
            className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 hover:text-white"
            title="Public Traceability View"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout
      portal="farmer"
      title="Minted Produce Batches"
      subtitle="Produce batches created upon harvest. Each batch possesses a unique public traceability QR code verifying farm lineage."
    >
      {error && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void loadBatches()}
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
          <span className="text-xs text-slate-500 font-medium">Loading produce batches ledger...</span>
        </div>
      ) : !error && batches.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-3">
          <Package className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="font-bold text-slate-900 text-sm">No produce batches minted yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Batches are minted upon harvest from your standing crops. Each batch receives an immutable QR verification label.
          </p>
          <button
            onClick={() => void loadBatches()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={batches}
          searchPlaceholder="Search batches by code, produce, or grade..."
        />
      )}

      {selectedBatchForQR && (
        <QRCodeModal
          isOpen={!!selectedBatchForQR}
          onClose={() => setSelectedBatchForQR(null)}
          batchCode={selectedBatchForQR.batch_code}
          cropType={selectedBatchForQR.crop_type}
          variety={selectedBatchForQR.variety}
          harvestDate={selectedBatchForQR.harvest_date}
          quantity={selectedBatchForQR.initial_quantity}
          unit={selectedBatchForQR.unit}
        />
      )}
    </DashboardLayout>
  );
}
