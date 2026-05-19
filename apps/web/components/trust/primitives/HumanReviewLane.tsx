import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Manual-operator lane wrapper.
 *
 * Source: Human Trust Surface.html. A human review lane is institutional
 * chrome wrapped around content that an operator co-signed. The lane
 * visibly names the operator and the time they signed; the chrome makes
 * it impossible to confuse with an automatic source-check.
 */
export interface HumanReviewLaneProps {
  /** Operator name or DID (e.g. "VitalCV CVO desk · M. Patel"). */
  operator: string;
  /** ISO 8601 timestamp the operator co-signed. */
  reviewedAtIso: string;
  /** Optional case / ticket reference. */
  caseRef?: string;
  children: React.ReactNode;
  className?: string;
}

export function HumanReviewLane({
  operator,
  reviewedAtIso,
  caseRef,
  children,
  className,
}: HumanReviewLaneProps) {
  return (
    <section
      data-slot="human-review-lane"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-800 bg-white',
        className,
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-700">
        <span>Human-reviewed · operator lane</span>
        <span>
          {operator} · {reviewedAtIso}
          {caseRef ? ` · ${caseRef}` : ''}
        </span>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
