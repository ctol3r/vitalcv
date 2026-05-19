import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  describeFailureMode,
  type FailureMode,
} from '@/lib/trust/degradation';
import { FailureTaxonomyBadge } from './FailureTaxonomyBadge';

/**
 * Surfaces a single failure mode at surface or claim level.
 *
 * Source: Trust Primitives.html §05 · Failure Taxonomy.html ·
 * Degraded State Semantics.html. Mode D is success — solid border.
 * Modes C and E reserve the dark fill for VitalCV-side and signing-plane
 * respectively.
 */
export interface DegradedStatePanelProps {
  mode: FailureMode;
  /** Optional incident or evidence id rendered into the panel rail. */
  incidentId?: string;
  /** Optional CTA element rendered in the action slot. */
  action?: React.ReactNode;
  className?: string;
}

const PANEL_FRAME: Record<FailureMode, string> = {
  A: 'border border-dashed border-slate-400 bg-amber-50/30 text-slate-900',
  B: 'border border-solid border-slate-400 bg-slate-50 text-slate-800',
  C: 'border border-solid border-slate-900 bg-slate-900 text-slate-50',
  D: 'border-2 border-solid border-slate-900 bg-white text-slate-900',
  E: 'border border-solid border-slate-950 bg-slate-950 text-slate-50',
};

export function DegradedStatePanel({
  mode,
  incidentId,
  action,
  className,
}: DegradedStatePanelProps) {
  const descriptor = describeFailureMode(mode);
  return (
    <section
      data-slot="degraded-state-panel"
      data-mode={mode}
      data-success={descriptor.isSuccess ? 'true' : undefined}
      className={cn('rounded-2xl p-4 text-sm', PANEL_FRAME[mode], className)}
    >
      <header className="flex items-center justify-between gap-3">
        <FailureTaxonomyBadge mode={mode} />
        <div className="font-mono text-[10px] uppercase tracking-wider opacity-70">
          {descriptor.severity} · {descriptor.sigmaState}
        </div>
      </header>
      <h3 className="mt-3 text-base font-semibold">{descriptor.title}</h3>
      <p className="mt-1 text-sm opacity-90">{descriptor.cause}</p>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-mono uppercase tracking-wider opacity-70">
            Owner
          </dt>
          <dd>{descriptor.owner}</dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-wider opacity-70">
            User sees
          </dt>
          <dd>{descriptor.userSees}</dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-wider opacity-70">
            Action
          </dt>
          <dd>{descriptor.action}</dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-wider opacity-70">
            Recovers
          </dt>
          <dd>{descriptor.recovers}</dd>
        </div>
      </dl>
      {(incidentId || action) && (
        <footer className="mt-3 flex items-center justify-between gap-3 border-t border-current/20 pt-3 font-mono text-xs">
          <span className="opacity-70">
            {incidentId ? `incident · ${incidentId}` : ''}
          </span>
          {action}
        </footer>
      )}
    </section>
  );
}
