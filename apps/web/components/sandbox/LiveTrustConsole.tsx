import React from "react";
import { Activity, Loader2, Info } from "lucide-react";

interface Analysis {
  verifiedCredentials: string;
  identifiedGaps: string;
  estimatedTimeToStart: string;
}

interface LiveTrustConsoleProps {
  analyzing: boolean;
  analysis: Analysis | null;
}

export default function LiveTrustConsole({ analyzing, analysis }: LiveTrustConsoleProps) {
  return (
    <div className="border border-line p-8 bg-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-ink/20" />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 opacity-40">
          <Activity className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">AI Readiness Analysis</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] font-mono opacity-30 uppercase tracking-tighter">
          <Info className="w-3 h-3" />
          MSP Auditor Synthesis v2.1
        </div>
      </div>

      {analyzing ? (
        <div className="flex items-center gap-4 py-4">
          <Loader2 className="w-4 h-4 animate-spin opacity-40" />
          <p className="text-sm font-mono animate-pulse uppercase tracking-widest opacity-40">Synthesizing source data...</p>
        </div>
      ) : analysis ? (
        <div className="space-y-8 font-mono text-xs leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 border-b border-line/10 pb-2">1. Verified Credentials</h4>
              <p className="opacity-80">{analysis.verifiedCredentials}</p>
            </div>
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 border-b border-line/10 pb-2">2. Identified Gaps/Risks</h4>
              <p className="opacity-80">{analysis.identifiedGaps}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-line/10">
            <h4 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">3. Estimated Time to Start</h4>
            <p className="text-lg font-bold tracking-tighter text-ink/90">{analysis.estimatedTimeToStart}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 opacity-20 text-center">
          <Activity className="w-8 h-8 mb-4" />
          <p className="text-[10px] font-mono uppercase tracking-widest">Awaiting source data for synthesis...</p>
        </div>
      )}
    </div>
  );
}
