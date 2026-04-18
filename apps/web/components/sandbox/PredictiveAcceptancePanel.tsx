"use client";

import React from "react";
import { motion } from "framer-motion";
import { Target, Zap } from "lucide-react";
import { cn } from "@/components/sandbox/lib/utils";
import {
  DEMO_ACCEPTANCE_PREDICTIONS,
  DEMO_FACILITIES,
  type AcceptancePrediction,
  type TargetFacility,
  facilityById,
} from "@/components/sandbox/lib/acceptance-graph";

export interface PredictiveAcceptancePanelProps {
  predictions?: AcceptancePrediction[];
  facilities?: TargetFacility[];
  onOptimizeVelocity?: () => void;
}

/**
 * Acceptance Predictor — a terminal-style, monochrome readout of the
 * probability that the clinician's current evidence clears each facility's
 * bylaws. Deliberately not a gauge / meter / consumer element — all signal
 * is carried by raw key:value pairs in JetBrains Mono.
 *
 * Semantic verification colors (green/amber/red) are reserved for
 * federal/state verification status elsewhere in the passport. This panel
 * stays monochrome so "Acceptance Probability" never gets confused with
 * "Source Verification".
 */
export default function PredictiveAcceptancePanel({
  predictions = DEMO_ACCEPTANCE_PREDICTIONS,
  facilities = DEMO_FACILITIES,
  onOptimizeVelocity,
}: PredictiveAcceptancePanelProps) {
  const rows = predictions
    .map((p) => ({ prediction: p, facility: facilityById(p.facilityId) ?? facilities[0] }))
    .filter((r) => Boolean(r.facility))
    .sort((a, b) => b.prediction.acceptanceProbability - a.prediction.acceptanceProbability);

  return (
    <section aria-labelledby="acceptance-predictor-heading">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 opacity-40">
            <Target className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
              Network Predictor · Live
            </span>
          </div>
          <h3 id="acceptance-predictor-heading" className="text-2xl font-bold tracking-tighter uppercase">
            Acceptance Predictor
          </h3>
          <p className="text-xs opacity-60 font-mono max-w-xl">
            Probability the current evidence packet clears each facility&apos;s live medical-staff bylaws.
            No gauges, no theater — raw terminal output.
          </p>
        </div>
        <button
          type="button"
          onClick={onOptimizeVelocity}
          className="shrink-0 bg-ink text-bg px-5 py-3 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 hover:opacity-90 transition-all"
          aria-label="Open Optimize for Velocity leaderboard"
        >
          <Zap className="w-3 h-3" />
          Optimize for Velocity
        </button>
      </div>

      <div className="border border-line divide-y divide-line/60">
        {rows.map(({ prediction, facility }, index) => (
          <PredictionRow key={prediction.facilityId} prediction={prediction} facility={facility} index={index} />
        ))}
      </div>

      <p className="text-[10px] font-mono opacity-30 mt-4 uppercase tracking-widest">
        Source: facility bylaws / policies · packet hash referenced against live registry
      </p>
    </section>
  );
}

function PredictionRow({
  prediction,
  facility,
  index,
}: {
  prediction: AcceptancePrediction;
  facility: TargetFacility;
  index: number;
}) {
  const probability = Math.max(0, Math.min(100, Math.round(prediction.acceptanceProbability)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
      className="grid grid-cols-12 gap-6 p-5 bg-white/5 dark:bg-white/5 hover:bg-ink/5 transition-colors"
    >
      <div className="col-span-12 md:col-span-4 space-y-1">
        <div className="flex items-baseline gap-3">
          <span className="text-[9px] font-mono opacity-30 tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-bold tracking-tight">{facility.facilityName}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono opacity-40 pl-7">
          <span>{facility.region}</span>
          <span>·</span>
          <span className="uppercase tracking-widest">{facility.accreditation.join(" / ")}</span>
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 flex flex-col justify-center">
        <TerminalLine label="Acceptance_Probability" value={`${probability}%`} />
        <TerminalLine label="Est_Time_to_Clear" value={prediction.estTimeToClear} />
        <div
          className="mt-2 h-[2px] w-full bg-ink/10"
          role="progressbar"
          aria-valuenow={probability}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Acceptance probability for ${facility.facilityName}`}
        >
          <div className="h-full bg-ink" style={{ width: `${probability}%` }} />
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 min-w-0">
        <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Policy Gap</span>
        <p className={cn("mt-1 font-mono text-xs leading-relaxed break-words", prediction.policyGap ? "opacity-80" : "opacity-30")}>
          {prediction.policyGap ?? "// No gaps identified"}
        </p>
      </div>
    </motion.div>
  );
}

function TerminalLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="font-mono text-sm flex items-baseline gap-1.5">
      <span className="opacity-40">{label}:</span>
      <span className="font-bold tracking-tight">{value}</span>
    </div>
  );
}
