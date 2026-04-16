'use client';

import { useMemo } from 'react';
import type { PassportData } from '@/lib/trust/passport-contract';
import { isMirofishEnabled, simulateDecision, type MirofishContext } from '@/lib/mirofish/mirofishEngine';
import { Compass } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

export type AdvisoryState = 'AVAILABLE' | 'UNAVAILABLE' | 'HIGH_UNCERTAINTY';

export interface AdvisoryPanelProps {
  state: AdvisoryState;
  variant?: 'default' | 'light';
  title?: 'Recommended next steps' | 'Advisory guidance' | 'Decision support';
  
  // 1. Recommendation summary (largest emphasis)
  summary?: React.ReactNode;
  
  // 2. Risk / friction notes (supporting notes smaller)
  details?: React.ReactNode;
  
  // 3. Time guidance
  estimatedPath?: React.ReactNode;
  
  // 4. Suggested next action
  suggestedAction?: React.ReactNode;
}

// ── UI Primitive (Spec Exact) ─────────────────────────────────────────────

export function AdvisoryPanelUI({
  title = 'Recommended next steps',
  state,
  summary,
  details,
  estimatedPath,
  suggestedAction,
  variant = 'default',
}: AdvisoryPanelProps) {
  if (variant === 'light') {
    if (state === 'UNAVAILABLE') return null;
    return (
      <div className="flex items-center gap-2 text-xs border-t border-white/5 pt-2 mt-2">
        <Compass className="w-3 h-3 text-muted-foreground/50" aria-hidden />
        <span className="text-muted-foreground">
          {state === 'HIGH_UNCERTAINTY' ? 'Recommendation is limited because source coverage is still incomplete.' : summary}
        </span>
      </div>
    );
  }

  if (state === 'UNAVAILABLE') {
    return (
      <section 
        aria-label="Advisory panel"
        className="rounded-2xl border border-white/6 bg-white/2 px-5 py-4"
      >
        <p className="text-muted-foreground/60 text-[11px] uppercase tracking-widest flex items-center gap-2 font-medium">
          <Compass className="w-3.5 h-3.5" aria-hidden />
          {title}
        </p>
        <p className="text-muted-foreground text-xs mt-3">No guidance available yet.</p>
      </section>
    );
  }

  if (state === 'HIGH_UNCERTAINTY') {
    return (
      <section 
        aria-label="Advisory panel"
        className="rounded-2xl border border-amber-500/10 bg-amber-500/5 px-5 py-4"
      >
        <p className="text-amber-500/40 text-[11px] uppercase tracking-widest flex items-center gap-2 font-medium">
          <Compass className="w-3.5 h-3.5" aria-hidden />
          {title}
        </p>
        <p className="text-amber-500/60 text-sm font-medium mt-3 leading-relaxed">
          Recommendation is limited because source coverage is still incomplete.
        </p>
        <p className="text-amber-500/30 text-[10px] mt-4 border-t border-amber-500/10 pt-3 leading-relaxed">
          Advisory guidance only. Confirm against the checked sources attached to this profile.
        </p>
      </section>
    );
  }

  return (
    <section 
      aria-label="Advisory panel"
      className="rounded-2xl border border-white/6 bg-white/2 px-5 py-5 flex flex-col gap-5"
    >
      <header className="flex items-center gap-2 text-muted-foreground/60">
        <Compass className="w-3.5 h-3.5" aria-hidden />
        <h2 className="text-[11px] uppercase tracking-widest font-medium">
          {title}
        </h2>
      </header>

      <div className="space-y-4">
        {/* 1. Recommendation summary (largest emphasis) */}
        {summary && (
          <div className="text-foreground/80 text-sm font-medium leading-relaxed">
            {summary}
          </div>
        )}
        
        {/* 2. Risk / friction notes (smaller) */}
        {details && (
          <div className="text-foreground text-xs leading-relaxed">
            {details}
          </div>
        )}

        {/* 3. Time guidance / 4. Suggested next action */}
        {((estimatedPath) || (suggestedAction)) && (
          <div className="space-y-3 pt-4 border-t border-white/5">
            {estimatedPath && (
              <div>
                <span className="text-muted-foreground/50 text-[10px] uppercase tracking-widest block mb-1 font-medium">Estimated path</span>
                <div className="text-foreground text-xs leading-relaxed">{estimatedPath}</div>
              </div>
            )}
            {suggestedAction && (
              <div className="pt-1">
                <span className="text-muted-foreground/50 text-[10px] uppercase tracking-widest block mb-1 font-medium">Suggested action</span>
                <div className="text-foreground/60 text-xs font-medium leading-relaxed">{suggestedAction}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="pt-4 border-t border-white/5 mt-1">
        <p className="text-muted-foreground/40 text-[10px] leading-relaxed">
          Advisory guidance only. Confirm against the checked sources attached to this profile.
        </p>
      </footer>
    </section>
  );
}

// ── Smart Implementations ─────────────────────────────────────────────────

export function EmployerAdvisoryPanel({ passport, context }: { passport: PassportData, context?: MirofishContext }) {
  if (!isMirofishEnabled()) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useMemo(() => simulateDecision(passport, context ?? {}), [passport, context]);
  
  const state: AdvisoryState = result.confidence === 'LOW' ? 'HIGH_UNCERTAINTY' : 'AVAILABLE';

  // Extract primary instruction (e.g. "Proceed with conditional review.", "Delay proceeding.")
  const recString = result.recommendation === 'PROCEED' ? 'Proceed with conditional review.' :
                    result.recommendation === 'DELAY' ? 'Delay proceeding pending review.' : 
                    'Request missing items.';

  const summary = (
    <div className="space-y-1">
      <p>{recString}</p>
      {result.reasoning.length > 0 && (
        <p className="text-foreground font-normal">
          {result.reasoning.join(' ')}
        </p>
      )}
    </div>
  );

  const details = result.risks.length > 0 ? (
    <div className="space-y-1">
      {result.risks.map((r, i) => (
        <p key={i}>· {r.area}: {r.description}</p>
      ))}
    </div>
  ) : undefined;

  let estimatedPath: React.ReactNode = undefined;
  if (result.totalEstimatedDays > 0) {
    const blockingSteps = result.fastestPath.filter(s => s.blocksStart);
    estimatedPath = (
      <span>
        ~{result.totalEstimatedDays} days 
        {blockingSteps.length > 0 ? ` if ${blockingSteps[0].action} is required` : ''}
      </span>
    );
  } else if (result.recommendation === 'PROCEED') {
    estimatedPath = "~0 days (Clear to start)";
  }

  const suggestedAction = result.fastestPath && result.fastestPath.length > 0
    ? result.fastestPath[0].action
    : (result.recommendation === 'PROCEED' ? 'Proceed to finalize start-date commitment' : undefined);

  return (
    <AdvisoryPanelUI
      title="Recommended next steps"
      state={state}
      summary={summary}
      details={details}
      estimatedPath={estimatedPath}
      suggestedAction={suggestedAction}
    />
  );
}

export function PassportAdvisoryPanel({ passport, context }: { passport: PassportData, context?: MirofishContext }) {
  if (!isMirofishEnabled()) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result = useMemo(() => simulateDecision(passport, context ?? {}), [passport, context]);
  
  const mySteps = result.fastestPath.filter(s => s.owner === 'CLINICIAN' || s.owner === 'BOTH');
  if (mySteps.length === 0 && result.recommendation === 'PROCEED') {
    return (
      <AdvisoryPanelUI
        title="Recommended next steps"
        state="AVAILABLE"
        summary="You are closest to ready for your target roles."
        details="No blocking items detected in this passport."
        estimatedPath="Ready now"
        suggestedAction="Proceed to share passport"
      />
    );
  }

  if (mySteps.length === 0) return null;

  const state: AdvisoryState = result.confidence === 'LOW' ? 'HIGH_UNCERTAINTY' : 'AVAILABLE';
  const blockingDays = mySteps
    .filter(s => s.blocksStart)
    .reduce((acc, s) => Math.max(acc, s.estimatedDays), 0);

  const isClosest = result.recommendation === 'PROCEED' || passport.readiness.score >= 70;
  
  const summary = (
    <div className="space-y-1">
      <p>{isClosest ? 'You are closest to ready for roles.' : 'Multiple items are needed before you are ready for roles.'}</p>
      {mySteps.length > 0 && (
        <p className="text-foreground font-normal">
          Your biggest blocker is {mySteps[0].action.toLowerCase()}.
        </p>
      )}
    </div>
  );

  const details = mySteps.slice(1).map((s, i) => (
    <p key={i}>· {s.action}</p>
  ));
  
  const estimatedPath = `~${blockingDays || result.totalEstimatedDays} days if you ${mySteps[0].action.toLowerCase()} next`;

  const suggestedAction = mySteps[0].action;

  return (
    <AdvisoryPanelUI
      title="Recommended next steps"
      state={state}
      summary={summary}
      details={details.length > 0 ? <div className="space-y-1">{details}</div> : undefined}
      estimatedPath={estimatedPath}
      suggestedAction={suggestedAction}
    />
  );
}
