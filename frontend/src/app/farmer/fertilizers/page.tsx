'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { FertilizerModal } from '../../../components/FertilizerModal';
import { apiClient, extractApiArray } from '../../../lib/apiClient';
import { FertilizerApplication, Crop } from '../../../types';
import {
  FlaskConical,
  PlusCircle,
  Calendar,
  DollarSign,
  Trash2,
  Edit2,
  Filter,
  Sprout,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function FarmerFertilizersPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string>('ALL');
  const [fertilizerRecords, setFertilizerRecords] = useState<FertilizerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecordForEdit, setSelectedRecordForEdit] = useState<FertilizerApplication | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadCropsAndFertilizers();
  }, [selectedCropId]);

  const loadCropsAndFertilizers = async () => {
    try {
      setLoading(true);
      const cropsRes: any = await apiClient.get('/farmer/crops');
      const cropsList = extractApiArray<Crop>(cropsRes);
      setCrops(cropsList);

      let records: FertilizerApplication[] = [];

      if (selectedCropId === 'ALL') {
        // Fetch fertilizers for all crops
        const fetchPromises = cropsList.map((c: Crop) =>
          apiClient.get(`/farmer/crops/${c.id}/fertilizers`).catch(() => ({ data: [] }))
        );
        const results: any[] = await Promise.all(fetchPromises);
        results.forEach((res, i) => {
          const list = extractApiArray(res);
          if (list.length > 0) {
            const cropName = cropsList[i]?.crop_type || 'Crop';
            const cropVariety = cropsList[i]?.variety || '';
            const mapped = list.map((item: any) => ({
              ...item,
              crop_name: `${cropName} (${cropVariety})`,
            }));
            records.push(...mapped);
          }
        });
      } else {
        const res: any = await apiClient.get(`/farmer/crops/${selectedCropId}/fertilizers`);
        const list = extractApiArray(res);
        if (list.length > 0) {
          const matchedCrop = cropsList.find((c: Crop) => c.id === selectedCropId);
          records = list.map((item: any) => ({
            ...item,
            crop_name: `${matchedCrop?.crop_type || 'Crop'} (${matchedCrop?.variety || ''})`,
          }));
        }
      }

      setFertilizerRecords(records.sort((a, b) => new Date(b.application_date).getTime() - new Date(a.application_date).getTime()));
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (formData: any) => {
    try {
      const targetCropId = selectedCropId !== 'ALL' ? selectedCropId : crops[0]?.id;
      if (!targetCropId) {
        setFeedback({ type: 'error', message: 'Please create a crop first to attach fertilizer records.' });
        return;
      }

      if (selectedRecordForEdit) {
        await apiClient.patch(
          `/farmer/crops/${selectedRecordForEdit.crop_id || targetCropId}/fertilizers/${selectedRecordForEdit.id}`,
          formData
        );
        setFeedback({ type: 'success', message: 'Fertilizer application record updated successfully!' });
      } else {
        await apiClient.post(`/farmer/crops/${targetCropId}/fertilizers`, formData);
        setFeedback({ type: 'success', message: 'New fertilizer application logged successfully!' });
      }

      loadCropsAndFertilizers();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || err?.response?.data?.error?.message || 'Failed to save fertilizer record.',
      });
    }
  };

  const handleDelete = async (record: FertilizerApplication) => {
    if (!confirm('Are you sure you want to delete this historical fertilizer record?')) return;
    try {
      await apiClient.delete(`/farmer/crops/${record.crop_id}/fertilizers/${record.id}`);
      setFeedback({ type: 'success', message: 'Fertilizer record removed.' });
      loadCropsAndFertilizers();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to delete record.' });
    }
  };

  const totalCost = fertilizerRecords.reduce((acc, r) => acc + (r.cost || 0), 0);
  const totalQty = fertilizerRecords.reduce((acc, r) => acc + (r.quantity || 0), 0);

  return (
    <DashboardLayout
      portal="farmer"
      title="Fertilizer Application History"
      subtitle="Maintain comprehensive, immutable field treatment records across all your simultaneous crops."
      actionButton={
        <button
          onClick={() => {
            setSelectedRecordForEdit(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add Fertilizer Record</span>
        </button>
      }
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

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Applications</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
              <FlaskConical className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{fertilizerRecords.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Logged across all active plots</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Applied Qty</span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
              <Sprout className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{totalQty.toFixed(1)} <span className="text-xs text-slate-500 font-medium">kg</span></p>
          <span className="text-[11px] text-slate-500 mt-1 block">Nutrients & soil conditioners</span>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Expenditure</span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-950 mt-2">₹{totalCost.toLocaleString()}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Recorded input investment</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="h-4 w-4 text-emerald-600" />
          <span>Filter By Crop:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCropId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              selectedCropId === 'ALL'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Crops ({crops.length})
          </button>
          {crops.map((crop) => (
            <button
              key={crop.id}
              onClick={() => setSelectedCropId(crop.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                selectedCropId === crop.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {crop.crop_type} ({crop.variety})
            </button>
          ))}
        </div>
      </div>

      {/* Historical Records Table / Cards */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Chronological Fertilizer Application Log</h3>
          <span className="text-xs text-slate-500">{fertilizerRecords.length} records found</span>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="text-xs text-slate-500 font-medium">Loading fertilizer records...</span>
          </div>
        ) : fertilizerRecords.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <FlaskConical className="h-6 w-6" />
            </div>
            <h4 className="font-bold text-slate-800 text-sm">No fertilizer records logged yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Continuously maintain treatment history to guarantee export traceability and food safety standards.
            </p>
            <button
              onClick={() => {
                setSelectedRecordForEdit(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Log First Application</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date Applied</th>
                  <th className="px-4 py-3">Crop / Variety</th>
                  <th className="px-4 py-3">Fertilizer Name</th>
                  <th className="px-4 py-3">Type & Method</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">N-P-K %</th>
                  <th className="px-4 py-3">Cost (₹)</th>
                  <th className="px-4 py-3">Supplier / Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {fertilizerRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {record.application_date}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-emerald-800 whitespace-nowrap">
                      {record.crop_name || 'Crop'}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">
                      {record.fertilizer_name}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-semibold text-[10px] text-slate-700 mr-1.5 border border-slate-200">
                        {record.fertilizer_type}
                      </span>
                      <span className="text-[11px] text-slate-500">{record.method}</span>
                    </td>
                    <td className="px-4 py-3.5 font-extrabold text-slate-900 whitespace-nowrap">
                      {record.quantity} {record.unit}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {record.n_value || record.p_value || record.k_value
                        ? `${record.n_value || 0}-${record.p_value || 0}-${record.k_value || 0}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-emerald-700 whitespace-nowrap">
                      ₹{record.cost || 0}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">
                      {record.notes || record.supplier || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedRecordForEdit(record);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-700 transition-colors"
                          title="Edit Record"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(record)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Fertilizer Modal */}
      <FertilizerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRecordForEdit(null);
        }}
        cropId={selectedCropId !== 'ALL' ? selectedCropId : crops[0]?.id || ''}
        initialData={selectedRecordForEdit}
        onSubmit={handleCreateOrUpdate}
      />
    </DashboardLayout>
  );
}
