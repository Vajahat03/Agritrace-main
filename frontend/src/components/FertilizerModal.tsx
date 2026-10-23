'use client';

import React, { useState, useEffect } from 'react';
import { FertilizerApplication } from '../types';
import { X, FlaskConical, Calendar, DollarSign, Sprout } from 'lucide-react';

interface FertilizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cropId: string;
  initialData?: FertilizerApplication | null;
  onSubmit: (formData: any) => Promise<void>;
}

export function FertilizerModal({
  isOpen,
  onClose,
  cropId,
  initialData,
  onSubmit,
}: FertilizerModalProps) {
  const [formData, setFormData] = useState({
    fertilizerName: '',
    fertilizerType: 'NPK',
    applicationDate: new Date().toISOString().split('T')[0],
    quantity: 25,
    unit: 'kg',
    method: 'SOIL',
    nValue: '',
    pValue: '',
    kValue: '',
    cost: 1200,
    supplier: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        fertilizerName: initialData.fertilizer_name,
        fertilizerType: initialData.fertilizer_type,
        applicationDate: initialData.application_date,
        quantity: initialData.quantity,
        unit: initialData.unit,
        method: initialData.method,
        nValue: initialData.n_value ? String(initialData.n_value) : '',
        pValue: initialData.p_value ? String(initialData.p_value) : '',
        kValue: initialData.k_value ? String(initialData.k_value) : '',
        cost: initialData.cost || 0,
        supplier: initialData.supplier || '',
        notes: initialData.notes || '',
      });
    } else {
      setFormData({
        fertilizerName: '',
        fertilizerType: 'NPK',
        applicationDate: new Date().toISOString().split('T')[0],
        quantity: 25,
        unit: 'kg',
        method: 'SOIL',
        nValue: '',
        pValue: '',
        kValue: '',
        cost: 1200,
        supplier: '',
        notes: '',
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        quantity: Number(formData.quantity),
        cost: Number(formData.cost),
        nValue: formData.nValue ? Number(formData.nValue) : undefined,
        pValue: formData.pValue ? Number(formData.pValue) : undefined,
        kValue: formData.kValue ? Number(formData.kValue) : undefined,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 space-y-5 my-8 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-lg">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <FlaskConical className="h-5 w-5" />
            </div>
            <h3>{initialData ? 'Edit Historical Fertilizer Log' : 'Record Fertilizer Application'}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Fertilizer Name & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Fertilizer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Urea, NPK 19:19:19"
                value={formData.fertilizerName}
                onChange={(e) => setFormData({ ...formData, fertilizerName: e.target.value })}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Type *</label>
              <select
                value={formData.fertilizerType}
                onChange={(e) => setFormData({ ...formData, fertilizerType: e.target.value })}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              >
                <option value="NPK">NPK Complex</option>
                <option value="Urea">Urea (Nitrogen)</option>
                <option value="DAP">DAP (Phosphorus)</option>
                <option value="Organic">Organic Manure / Bio</option>
                <option value="Compost">Vermicompost</option>
                <option value="Micronutrient">Micronutrient Mix</option>
              </select>
            </div>
          </div>

          {/* Date & Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Application Date *</label>
              <input
                type="date"
                required
                value={formData.applicationDate}
                onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Application Method</label>
              <select
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              >
                <option value="SOIL">Soil Top Dressing</option>
                <option value="DRIP">Drip Fertigation</option>
                <option value="FOLIAR">Foliar Spray</option>
                <option value="BROADCAST">Broadcasting</option>
              </select>
            </div>
          </div>

          {/* Quantity, Unit & Cost */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Quantity *</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              >
                <option value="kg">kg</option>
                <option value="grams">grams</option>
                <option value="liters">liters</option>
                <option value="bags">bags</option>
                <option value="tons">tons</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Total Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* NPK Values (Optional) */}
          <div className="rounded-xl bg-emerald-50/60 p-3 border border-emerald-200 space-y-2">
            <span className="text-[11px] font-bold text-emerald-900">Nutrient Composition (Optional % N-P-K)</span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                placeholder="N %"
                value={formData.nValue}
                onChange={(e) => setFormData({ ...formData, nValue: e.target.value })}
                className="rounded-lg bg-white border border-emerald-300 px-2 py-1.5 text-slate-900 focus:outline-none"
              />
              <input
                type="number"
                placeholder="P %"
                value={formData.pValue}
                onChange={(e) => setFormData({ ...formData, pValue: e.target.value })}
                className="rounded-lg bg-white border border-emerald-300 px-2 py-1.5 text-slate-900 focus:outline-none"
              />
              <input
                type="number"
                placeholder="K %"
                value={formData.kValue}
                onChange={(e) => setFormData({ ...formData, kValue: e.target.value })}
                className="rounded-lg bg-white border border-emerald-300 px-2 py-1.5 text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Supplier Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">Supplier / Field Application Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Procured from APMC agro store, applied before morning drip cycle"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-60"
            >
              {submitting ? 'Saving...' : initialData ? 'Update Record' : 'Save Fertilizer Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
