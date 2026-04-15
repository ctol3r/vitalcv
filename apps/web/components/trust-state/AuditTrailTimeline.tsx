'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    FileSignature,
    Fingerprint,
    History,
    PlayCircle,
    ShieldCheck,
    Network
} from 'lucide-react';
import { useState } from 'react';

export interface AuditEvent {
  id: string;
  type:
    | 'SOURCE_RETRIEVED'
    | 'VERIFICATION_REQUESTED'
    | 'VERIFICATION_COMPLETED'
    | 'VERIFICATION_FAILED'
    | 'ACCEPTED'
    | 'MONITORING_STARTED'
    | 'DECAYED'
    | 'PORTABLE_ARTIFACT_ISSUED';
  label: string;
  timestamp: string;
  employer?: string;
  facility?: string;
  metadata: Record<string, any>;
  signer?: string;
  hash?: string;
}

interface AuditTrailTimelineProps {
  events: AuditEvent[];
}

export function AuditTrailTimeline({ events }: AuditTrailTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  const getIcon = (type: string) => {
    switch (type) {
      case 'SOURCE_RETRIEVED': return <Network className="w-4 h-4 text-emerald-600" />;
      case 'PORTABLE_ARTIFACT_ISSUED': return <Clock className="w-4 h-4 text-indigo-600" />;
      case 'VERIFICATION_REQUESTED': return <Clock className="w-4 h-4 text-amber-700" />;
      case 'VERIFICATION_COMPLETED': return <ShieldCheck className="w-4 h-4 text-emerald-700" />;
      case 'VERIFICATION_FAILED': return <AlertTriangle className="w-4 h-4 text-red-700" />;
      case 'ACCEPTED': return <CheckCircle2 className="w-4 h-4 text-emerald-700" />;
      case 'MONITORING_STARTED': return <PlayCircle className="w-4 h-4 text-blue-600" />;
      case 'DECAYED': return <AlertTriangle className="w-4 h-4 text-slate-500" />;
      default: return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  if (!events || events.length === 0) {
      return null;
  }

  return (
    <TooltipProvider>
    <Card className="w-full bg-white shadow-sm border-slate-200">
      <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between space-y-0 border-b border-slate-100">
        <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Audit-Ready Evidence Trail
            </CardTitle>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Source-confirmed in this run
            </span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-5 pb-4 bg-slate-50/50">
        <div className="space-y-4 relative">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-slate-200 z-0" />

            {events.map((event) => {
                return (
                <div key={event.id} className="relative z-10 flex gap-4 items-start group">
                    <div className="mt-0.5 bg-white p-1 rounded-full border border-slate-200 shadow-sm transition-colors">
                        {getIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-md p-3 shadow-sm">
                        <div className="flex justify-between items-start">
                            <h4 className="text-xs font-bold text-slate-800 tracking-tight pr-2">
                                {event.label}
                            </h4>
                            <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap bg-slate-100 px-1.5 py-0.5 rounded">
                                {formatTime(event.timestamp)}
                            </span>
                        </div>

                        {(event.employer || event.facility) && (
                            <div className="text-xs font-medium text-slate-600 flex gap-2 mt-1">
                                {event.employer && <span>{event.employer}</span>}
                                {event.facility && <span className="text-slate-400">• {event.facility}</span>}
                            </div>
                        )}

                        {/* Signer & Hash Line */}
                        {(event.signer || event.hash) && (
                          <div className="flex items-center gap-3 mt-2.5">
                              {event.signer && (
                                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    <FileSignature className="w-3 h-3 text-slate-400" />
                                    <span className="font-semibold">{event.signer}</span>
                                </div>
                              )}
                              {event.hash && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 cursor-help hover:text-slate-800 transition-colors">
                                            <Fingerprint className="w-3 h-3" />
                                            <span>{event.hash.substring(0, 12)}...</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p>Canonical Fact Hash</p>
                                        <p className="font-mono text-[10px] opacity-75 mt-1">{event.hash}</p>
                                    </TooltipContent>
                                </Tooltip>
                              )}
                          </div>
                        )}

                        {expanded && Object.keys(event.metadata).length > 0 && (
                            <div className="mt-3 text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto">
                                {Object.entries(event.metadata).map(([k, v]) => (
                                    <div key={k} className="flex gap-4 py-0.5">
                                        <span className="text-slate-400 font-semibold w-24 shrink-0 uppercase tracking-wider">{k}</span>
                                        <span className="text-slate-800 truncate">{String(v)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )})}
        </div>

        <div className="mt-4 flex justify-center">
            <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 uppercase tracking-widest w-full bg-white border-slate-200"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? (
                    <span className="flex items-center gap-1.5">Collapse Artifact Metadata <ChevronUp className="w-3 h-3" /></span>
                ) : (
                    <span className="flex items-center gap-1.5">View Artifact Metadata <ChevronDown className="w-3 h-3" /></span>
                )}
            </Button>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
