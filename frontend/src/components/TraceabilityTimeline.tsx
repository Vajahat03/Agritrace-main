'use client';

import React from 'react';
import { TraceabilityEvent } from '../types';
import {
  Sprout,
  Tractor,
  Package,
  Store,
  Truck,
  CheckCircle2,
  MapPin,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface TraceabilityTimelineProps {
  events: TraceabilityEvent[];
}

export function TraceabilityTimeline({ events }: TraceabilityTimelineProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'HARVESTED':
        return Tractor;
      case 'STORED':
        return Package;
      case 'RECEIVED':
        return Store;
      case 'IN_TRANSIT':
        return Truck;
      case 'SOLD':
        return CheckCircle2;
      case 'DELIVERED':
        return CheckCircle2;
      default:
        return Sprout;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'HARVESTED':
        return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40';
      case 'RECEIVED':
        return 'text-amber-400 bg-amber-500/20 border-amber-500/40';
      case 'IN_TRANSIT':
        return 'text-blue-400 bg-blue-500/20 border-blue-500/40';
      case 'SOLD':
      case 'DELIVERED':
        return 'text-purple-400 bg-purple-500/20 border-purple-500/40';
      default:
        return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40';
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-amber-500 before:to-purple-500">
        {events.map((event, index) => {
          const Icon = getEventIcon(event.event_type);
          const colorClasses = getEventColor(event.event_type);

          return (
            <div key={event.id || index} className="relative group">
              {/* Timeline Pin Icon */}
              <div
                className={`absolute -left-6 top-0 flex h-6 w-6 items-center justify-center rounded-full border shadow-md ${colorClasses} -translate-x-1/2`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              {/* Event Content Card */}
              <div className="rounded-xl glass-card p-4 border border-emerald-800/40 space-y-2 group-hover:border-emerald-500/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <span>{event.event_type.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-normal border border-emerald-500/20">
                      by {event.actor_role}
                    </span>
                  </span>
                  <span className="text-xs text-emerald-400/80 flex items-center gap-1 font-mono">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(event.created_at || event.timestamp || Date.now()).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-medium">
                  <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>{event.location}</span>
                </div>

                {event.notes && (
                  <p className="text-xs text-emerald-100/80 leading-relaxed bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-900/40">
                    {event.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
