'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, ExternalLink, QrCode, ShieldCheck, Printer } from 'lucide-react';
import Link from 'next/link';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchCode: string;
  cropType: string;
  variety: string;
  harvestDate: string;
  quantity: number;
  unit: string;
}

export function QRCodeModal({
  isOpen,
  onClose,
  batchCode,
  cropType,
  variety,
  harvestDate,
  quantity,
  unit,
}: QRCodeModalProps) {
  if (!isOpen) return null;

  const traceUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/trace/batch/${batchCode}`
      : `http://localhost:3000/trace/batch/${batchCode}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-5 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <QrCode className="h-5 w-5" />
            </div>
            <span>Batch Traceability QR Label</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="bg-white p-5 rounded-2xl inline-block shadow-sm mx-auto border-2 border-emerald-500/30">
          <QRCodeSVG value={traceUrl} size={190} level="H" includeMargin={true} fgColor="#0f172a" />
        </div>

        {/* Batch Metadata summary */}
        <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Batch Code:</span>
            <span className="font-mono font-bold text-slate-900">{batchCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Produce / Variety:</span>
            <span className="font-semibold text-slate-800">
              {cropType} ({variety})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Harvest Date:</span>
            <span className="font-semibold text-slate-800">{harvestDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Quantity:</span>
            <span className="font-bold text-emerald-700">
              {quantity} {unit}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-500 font-medium">Ledger Status:</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified Immutable
            </span>
          </div>
        </div>

        {/* Action Links */}
        <div className="flex items-center justify-center gap-2.5 pt-1">
          <Link
            href={`/trace/batch/${batchCode}`}
            target="_blank"
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            <span>Open Public Trace</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Label</span>
          </button>
        </div>
      </div>
    </div>
  );
}
