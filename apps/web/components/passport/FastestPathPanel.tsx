'use client';

/**
 * FastestPathPanel — Clinician-facing "fastest path to ready" panel.
 *
 * Wave MF3 — Clinician Path Optimization
 *
 * Shows:
 *   - Steps to reach start-ready state (clinician-owned actions only)
 *   - Estimated time per step
 *   - Total estimated time to ready
 *
 * Isolation rules:
 *   - Labeled "Simulation-based estimate" at all times
 *   - Never shows verified/confirmed status
 *   - Hidden unless NEXT_PUBLIC_MIROFISH_ENABLED=true
 *   - Does not mutate or re-label any trust claim
 */

import type { PassportData } from '@/app/passport/[id]/page';
import {
  isMirofishEnabled,
  simulateDecision,
  type MirofishContext,
} from '@/lib/mirofish/mirofishEngine';
import { FlaskConical } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
  passport: PassportData;
  context?: MirofishContext;
}

export default function FastestPathPanel({ passport, context }: Props) {
  if (!isMirofishEnabled()) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useMemo(
    () => simulateDecision(passport, context ?? {}),
    [passport, context],
  );

  // Only show if there are clinician-owned steps
  const mySteps = result.fastestPath.filter(s => s.owner === 'CLINICIAN' || s.owner === 'BOTH');
  if (mySteps.length === 0 && result.recommendation === 'PROCEED') {
    return (
      <div className="rounded-xl border border-white/6 bg-white/2 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="w-3 h-3 text-white/20" aria-hidden />
          <span className="text-[10px] uppercase tracking-widest text-white/20">MiroFish estimate</span>
        </div>
        <p className="text-white/45 text-sm">No blocking items detected in this passport.</p>
        <p className="text-white/20 text-xs mt-1">{result.disclaimer}</p>
      </div>
    );
  }

  if (mySteps.length === 0) return null;

  const blockingDays = mySteps
    .filter(s => s.blocksStart)
    .reduce((acc, s) => Math.max(acc, s.estimatedDays), 0);

  return (
    <section
      aria-label="MiroFish fastest path estimate"
      className="rounded-xl border border-white/6 bg-white/2 px-4 py-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3 h-3 text-white/20" aria-hidden />
          <span className="text-[10px] uppercase tracking-widest text-white/20">
            MiroFish · Fastest path
          </span>
        </div>
        {blockingDays > 0 && (
          <span className="text-white/25 text-xs">
            ~{blockingDays}d estimated
          </span>
        )}
      </div>

      {/* Steps */}
      <ol className="space-y-2.5">
        {mySteps.map((step) => (
          <li key={step.step} className="flex items-start gap-3">
            <span className="text-white/15 text-xs w-4 shrink-0 pt-0.5 text-right select-none">
              {step.step}.
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-white/55 text-sm">{step.action}</span>
                {step.blocksStart && (
                  <span className="text-white/25 text-[10px] border border-white/8 px-1.5 rounded-full">
                    required to start
                  </span>
                )}
              </div>
              <p className="text-white/25 text-xs mt-0.5">
                ~{step.estimatedDays} days{step.notes ? ` · ${step.notes}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Disclaimer */}
      <p className="text-white/15 text-[10px] border-t border-white/5 pt-2 leading-relaxed">
        {result.disclaimer} Estimates are typical timelines and may vary.
      </p>
    </section>
  );
}
