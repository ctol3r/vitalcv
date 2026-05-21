import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Names the next operational step after a flow surface. Carries:
 *   - what to do next (label)
 *   - who owns it (operator / receiving institution / VitalCV)
 *   - a single Next link to the route that materializes the next step
 *   - an explicit "what this step does NOT do" line so the user does
 *     not assume backend automation
 *
 * Renders nothing if href is empty -- a flow surface that has no
 * next operational step explicitly declares it via this rule rather
 * than rendering a dangling primitive.
 */
export type NextStepOwner =
  | 'operator'
  | 'receiving_institution'
  | 'sending_institution'
  | 'vitalcv';

export interface InstitutionalNextStepProps {
  label: string;
  href: string;
  owner: NextStepOwner;
  whatHappens: string;
  whatItDoesNotDo: string;
  className?: string;
}

const OWNER_LABEL: Record<NextStepOwner, string> = {
  operator: 'Operator',
  receiving_institution: 'Receiving institution',
  sending_institution: 'Sending institution',
  vitalcv: 'VitalCV',
};

export function InstitutionalNextStep({
  label,
  href,
  owner,
  whatHappens,
  whatItDoesNotDo,
  className,
}: InstitutionalNextStepProps) {
  if (!href) {
    return null;
  }
  return (
    <section
      data-slot="institutional-next-step"
      data-owner={owner}
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-600">
          Next step · owner {OWNER_LABEL[owner]}
        </div>
      </header>
      <div className="space-y-3 px-4 py-3">
        <Link
          href={href}
          data-slot="institutional-next-step-link"
          className="flex items-center justify-between gap-3 rounded-lg border border-slate-900 bg-slate-900 px-4 py-3 text-slate-100 hover:bg-slate-800"
        >
          <div className="text-sm font-semibold">{label}</div>
          <div aria-hidden className="font-mono text-sm text-slate-300">
            →
          </div>
        </Link>
        <section
          data-slot="institutional-next-step-what-happens"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            What this step does
          </div>
          <p className="mt-1 text-xs text-slate-700">{whatHappens}</p>
        </section>
        <section
          data-slot="institutional-next-step-what-it-does-not-do"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            What this step does NOT do
          </div>
          <p className="mt-1 text-xs text-slate-700">{whatItDoesNotDo}</p>
        </section>
      </div>
    </section>
  );
}
