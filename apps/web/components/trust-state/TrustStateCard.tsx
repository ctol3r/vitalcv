'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Key, Server, ShieldCheck } from 'lucide-react';
import { PANEL_TRANSITION } from './motion';
import type { TrustBand, TrustStateCardData, WindowStatus } from './types';

// ── Visual Config ──────────────────────────────────────────

const BAND_CONFIG: Record<
  TrustBand,
  { dot: string; label: string; badgeBg: string; badgeText: string; badgeBorder: string }
> = {
  GREEN: {
    dot: 'bg-green-600',
    label: 'Compliant',
    badgeBg: 'bg-green-50',
    badgeText: 'text-green-800',
    badgeBorder: 'border-green-200',
  },
  YELLOW: {
    dot: 'bg-amber-500',
    label: 'Expiring Soon',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
  },
  RED: {
    dot: 'bg-red-600',
    label: 'Non-Compliant',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
    badgeBorder: 'border-red-200',
  },
};

const WINDOW_LABEL: Record<WindowStatus, string> = {
  WITHIN_WINDOW: 'Within NCQA 120-Day Window',
  EXPIRING_SOON: 'NCQA Window Expiring Soon',
  EXPIRED: 'NCQA 120-Day Window Expired',
  NOT_YET_VALID: 'Verification Not Yet Valid',
};

// ── Helpers ────────────────────────────────────────────────

function daysAgo(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '\u2014';
  }
}

// ── Component ──────────────────────────────────────────────

export function TrustStateCard({
  data,
  artifactId,
  integrityHash,
  issuers = []
}: {
  data: TrustStateCardData;
  artifactId?: string;
  integrityHash?: string;
  issuers?: string[];
}) {
  const config = BAND_CONFIG[data.band];
  const verifiedDaysAgo = daysAgo(data.verifiedAt);
  const windowLabel = WINDOW_LABEL[data.windowStatus];

  return (
    <section aria-labelledby="trust-state-heading" className={PANEL_TRANSITION}>
      <Card interactive className="border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-white/40 dark:bg-white/5 backdrop-blur-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/5 dark:from-white/10 dark:to-transparent pointer-events-none" />

        <CardHeader className="pb-3 relative z-10 border-b border-slate-200/50 dark:border-white/10">
          <div className="flex justify-between items-center">
            <CardTitle id="trust-state-heading" className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              Decision Capsule
            </CardTitle>
            {artifactId && (
              <Badge variant="outline" className="text-[10px] font-mono font-normal text-slate-500 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-slate-800 backdrop-blur-sm gap-1 h-6">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                {artifactId.substring(0, 8)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5 relative z-10">
          {/* Compliance status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${config.dot} shrink-0`}
                      role="img"
                      aria-label={`Compliance status: ${config.label}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{config.label}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge
                className={`text-xs border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} hover:bg-transparent`}
              >
                {config.label}
              </Badge>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Band: {data.band}
            </span>
          </div>

          {/* Identity & Hash Preview */}
          {(integrityHash || issuers.length > 0) && (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 backdrop-blur-sm transition-all duration-300 group-hover:border-slate-300 dark:group-hover:border-slate-700">
               <div className="flex items-center gap-2">
                 <Server className="w-4 h-4 text-slate-400" />
                 <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Sources:</span>
                 <div className="flex -space-x-1.5 ml-1">
                   {issuers.slice(0, 4).map((issuer, i) => (
                     <TooltipProvider key={i}>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-950 flex items-center justify-center text-[8px] font-bold text-slate-500 overflow-hidden" style={{ zIndex: 4 - i }}>
                             {issuer.charAt(0)}
                           </div>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p className="text-xs">{issuer}</p>
                         </TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                   ))}
                   {issuers.length > 4 && (
                     <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-950 flex items-center justify-center text-[8px] font-medium text-slate-500" style={{ zIndex: 0 }}>
                       +{issuers.length - 4}
                     </div>
                   )}
                 </div>
               </div>

               {integrityHash && (
                 <TooltipProvider>
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <div className="flex items-center gap-1.5 cursor-help opacity-70 hover:opacity-100 transition-opacity bg-white/50 dark:bg-black/20 px-2 py-1 rounded border border-slate-200/50 dark:border-slate-800">
                         <Key className="w-3 h-3 text-slate-400" />
                         <span className="text-[10px] font-mono text-slate-500">{integrityHash.substring(0, 16)}...</span>
                       </div>
                     </TooltipTrigger>
                     <TooltipContent side="top">
                       <p className="font-semibold text-xs mb-1">Cryptographic Proof</p>
                       <p className="font-mono text-[10px] text-slate-400 break-all w-48">{integrityHash}</p>
                     </TooltipContent>
                   </Tooltip>
                 </TooltipProvider>
               )}
            </div>
          )}

          {/* Verification age */}
          <div className="rounded-md border border-slate-200 p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-slate-700">
                Primary License Verified {verifiedDaysAgo} Day{verifiedDaysAgo !== 1 ? 's' : ''} Ago
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {formatDate(data.verifiedAt)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">{windowLabel}</span>
              <span className="text-xs text-slate-400 font-mono">
                {data.daysRemaining} day{data.daysRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
          </div>

          {/* Valid until */}
          <dl className="flex items-baseline justify-between text-xs text-slate-500">
            <dt>Valid Until</dt>
            <dd className="font-mono text-slate-700">{formatDate(data.validUntil)}</dd>
          </dl>

          {/* Blocking reasons */}
          {data.blockingReasons.length > 0 && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1.5">
                Blocking Reasons
              </p>
              <ul className="space-y-1" role="list">
                {data.blockingReasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-xs text-red-700">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 shrink-0 mt-1.5" />
                    {reason.replace(/_/g, ' ').toLowerCase()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
