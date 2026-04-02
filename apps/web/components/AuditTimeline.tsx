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
    ShieldCheck
} from 'lucide-react';
import { useState } from 'react';

export interface TimelineEvent {
  id: string;
  type:
    | 'INGESTED'
    | 'VERIFICATION_REQUESTED'
    | 'VERIFICATION_COMPLETED'
    | 'VERIFICATION_FAILED'
    | 'ACCEPTED'
    | 'STARTED'
    | 'DECAYED';
  label: string;
  timestamp: string;
  employer?: string;
  facility?: string;
  metadata: Record<string, any>;
  signer?: string;
  hash?: string;
}

interface AuditTimelineProps {
  events: TimelineEvent[];
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  // Helper to generate consistent mock hash/signer if missing (for demo without backend changes)
  const enhanceEvent = (event: TimelineEvent) => {
    if (event.hash && event.signer) return event;

    // Deterministic mock hash based on ID
    const mockHash = '0x' + Array.from(event.id).reduce((hash, char) => {
      return ((hash << 5) - hash) + char.charCodeAt(0) | 0;
    }, 0).toString(16).replace('-', 'f').padStart(64, '0').substring(0, 16);

    let mockSigner = event.employer || 'Network Authority';
    if (event.type === 'VERIFICATION_COMPLETED') mockSigner = 'VitalCV Network';
    if (event.type === 'DECAYED') mockSigner = 'System Observer';

    return {
      ...event,
      hash: event.hash || mockHash,
      signer: event.signer || mockSigner
    };
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'INGESTED': return <Clock className="w-4 h-4 text-slate-500" />;
      case 'VERIFICATION_REQUESTED': return <Clock className="w-4 h-4 text-amber-700" />;
      case 'VERIFICATION_COMPLETED': return <ShieldCheck className="w-4 h-4 text-blue-700" />;
      case 'VERIFICATION_FAILED': return <AlertTriangle className="w-4 h-4 text-red-700" />;
      case 'ACCEPTED': return <CheckCircle2 className="w-4 h-4 text-green-700" />;
      case 'STARTED': return <PlayCircle className="w-4 h-4 text-green-700" />;
      case 'DECAYED': return <AlertTriangle className="w-4 h-4 text-red-700" />;
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

  const getDisplayLabel = (label: string) => {
    if (label.toLowerCase() === 'verification completed') return 'Recognition recorded';
    return label;
  };

  if (!events || events.length === 0) {
      return null;
  }

  return (
    <TooltipProvider>
    <Card className="w-full border-border shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-muted dark:bg-muted backdrop-blur-xl">
      <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">
                Audit Timeline
            </CardTitle>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono font-normal text-slate-500 border-slate-300 bg-white gap-1 px-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                REPLAYABLE
            </Badge>
            <span className="text-xs text-slate-400 hidden sm:inline-block">Deterministic order</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-3 relative">
            {/* Vertical Line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 z-0" />

            {events.map((rawEvent, i) => {
                const event = enhanceEvent(rawEvent);
                return (
                <div key={event.id} className="relative z-10 flex gap-3 items-start group">
                    <div className="mt-0.5 bg-white p-0.5 rounded-full border border-slate-100 shadow-sm group-hover:border-slate-300 transition-colors">
                        {getIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                            <h4 className="text-xs font-semibold text-slate-800 truncate pr-2">
                                {getDisplayLabel(event.label)}
                            </h4>
                            <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                                {formatTime(event.timestamp)}
                            </span>
                        </div>

                        {(event.employer || event.facility) && (
                            <div className="text-xs text-slate-500 flex gap-2 mt-0.5">
                                {event.employer && <span>{event.employer}</span>}
                                {event.facility && <span className="text-slate-400">• {event.facility}</span>}
                            </div>
                        )}

                        {/* Signer & Hash Line */}
                        <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100/50 px-1.5 py-0.5 rounded border border-slate-100">
                                <FileSignature className="w-3 h-3 text-slate-400" />
                                <span className="font-medium">{event.signer}</span>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs font-mono text-slate-400 cursor-help hover:text-slate-600 transition-colors">
                                        <Fingerprint className="w-3 h-3" />
                                        <span>{event.hash?.substring(0, 8)}...</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Demo reference hash</p>
                                    <p className="font-mono text-xs opacity-75 mt-1">{event.hash}</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>

                        {expanded && (
                            <div className="mt-1.5 text-xs font-mono text-slate-500 bg-white border border-slate-100 rounded px-2 py-1 overflow-x-auto">
                                {Object.entries(event.metadata).map(([k, v]) => (
                                    <div key={k} className="flex gap-2">
                                        <span className="text-slate-400">{k}:</span>
                                        <span className="text-slate-700 truncate">{String(v)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )})}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-100 flex justify-center">
            <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-slate-400 hover:text-slate-600 uppercase tracking-widest w-full"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? (
                    <span className="flex items-center gap-1">Collapse Metadata <ChevronUp className="w-3 h-3" /></span>
                ) : (
                    <span className="flex items-center gap-1">View Metadata <ChevronDown className="w-3 h-3" /></span>
                )}
            </Button>
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
