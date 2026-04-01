'use client';

/**
 * GeminiReadinessSummary — Assimilated from AI Studio sandbox (was "LiveTrustConsole")
 *
 * Renamed to avoid collision with the existing apps/web/components/hero/LiveTrustConsole.tsx.
 *
 * Changes from source:
 * - Renamed component: LiveTrustConsole → GeminiReadinessSummary
 * - Removed "MSP Auditor Synthesis v2.1" label — implies AI certainty (doctrine violation)
 * - Header label changed from "AI Readiness Analysis" to "Readiness Summary"
 * - No other Truth Doctrine violations; component only renders what it receives
 * - No decorative framer-motion; no fake data; safe to assimilate
 */

import React from 'react';
import { Activity, Loader2 } from 'lucide-react';

interface ReadinessSummary {
  verifiedCredentials: string;
  identifiedGaps: string;
  estimatedTimeToStart: string;
}

interface GeminiReadinessSummaryProps {
  analyzing: boolean;
  summary: ReadinessSummary | null;
}

export default function GeminiReadinessSummary({ analyzing, summary }: GeminiReadinessSummaryProps) {
  return (
    <div className="border border-border rounded-xl p-6 bg-muted/10 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-5 text-muted-foreground">
        <Activity className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Readiness summary</span>
      </div>

      {analyzing ? (
        <div className="flex items-center gap-3 py-4 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="text-sm font-mono uppercase tracking-widest">Synthesizing source data…</p>
        </div>
      ) : summary ? (
        <div className="space-y-6 font-mono text-xs leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5">1. Checked credentials</h4>
              <p className="text-foreground/80">{summary.verifiedCredentials}</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5">2. Identified gaps</h4>
              <p className="text-foreground/80">{summary.identifiedGaps}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-border">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">3. Estimated time to start</h4>
            <p className="text-base font-bold tracking-tight text-foreground">{summary.estimatedTimeToStart}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-center">
          <Activity className="w-6 h-6 mb-3 opacity-30" />
          <p className="text-[10px] font-mono uppercase tracking-widest">Awaiting source data…</p>
        </div>
      )}
    </div>
  );
}
