"use client";

import React from "react";
import { Network } from "lucide-react";
import { cn } from "@/components/sandbox/lib/utils";
import type { NetworkConsensus } from "@/components/sandbox/lib/acceptance-graph";

export interface NetworkConsensusIndicatorProps {
  consensus?: NetworkConsensus;
  /** Compact = inline chip for row headers. Expanded = the slate/indigo callout. */
  variant?: "chip" | "callout";
  className?: string;
}

/**
 * Network Consensus (Feature 3) — "This identical packet was accepted by N
 * other JC-accredited facilities in the last 90d". Intentionally muted: the
 * job is to lend psychological safety, not to celebrate. Slate background,
 * subtle indigo border. Not green — green is reserved for federal/state
 * verification throughout the rest of the dashboard.
 */
export default function NetworkConsensusIndicator({
  consensus,
  variant = "chip",
  className,
}: NetworkConsensusIndicatorProps) {
  if (!consensus || consensus.acceptedCount <= 0) return null;

  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full",
          "text-[9px] font-bold uppercase tracking-widest font-mono",
          "bg-slate-500/10 dark:bg-slate-400/10",
          "border border-indigo-500/40 dark:border-indigo-400/30",
          "text-slate-700 dark:text-slate-300",
          className,
        )}
        title={`Accepted by ${consensus.acceptedCount} ${consensus.accreditationType} facilities in the ${consensus.timeframe}`}
      >
        <Network className="w-3 h-3 text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
        <span>Network · {consensus.acceptedCount}</span>
      </span>
    );
  }

  return (
    <div
      role="note"
      aria-label="Network intelligence summary"
      className={cn(
        "relative border px-4 py-3 flex items-start gap-3",
        "bg-slate-500/10 dark:bg-slate-400/5",
        "border-indigo-500/40 dark:border-indigo-400/30",
        className,
      )}
    >
      <div className="shrink-0 p-1.5 border border-indigo-500/30 dark:border-indigo-400/30 bg-bg">
        <Network className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest font-mono text-indigo-600 dark:text-indigo-400">
            Network Intelligence
          </span>
          <span className="text-[9px] font-mono opacity-40">
            packet: {consensus.packetFingerprint}
          </span>
        </div>
        <p className="mt-1 text-xs font-mono leading-relaxed text-slate-700 dark:text-slate-300">
          This identical cryptographic packet was accepted by{" "}
          <strong className="tabular-nums">{consensus.acceptedCount}</strong> other{" "}
          {consensus.accreditationType} facilit{consensus.acceptedCount === 1 ? "y" : "ies"} in the {consensus.timeframe}.
        </p>
      </div>
    </div>
  );
}
