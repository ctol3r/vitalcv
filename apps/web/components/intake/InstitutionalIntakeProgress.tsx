import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Five-step intake progress narrative. Renders the operational
 * stages a clinician moves through:
 *
 *   1. Intake started
 *   2. Evidence received (federal-source resolution)
 *   3. Source-confirmed continuity
 *   4. Institution review (institution-owned)
 *   5. Deployment-ready (institution-owned final acceptance)
 *
 * Each step has an explicit owner. The two terminal-state
 * institutional steps (4 and 5) are clearly marked as
 * institution-owned -- the pilot does not advance these.
 */
export interface InstitutionalIntakeProgressProps {
  className?: string;
}

interface IntakeStep {
  index: number;
  label: string;
  description: string;
  owner: 'vitalcv' | 'shared' | 'institution';
}

const STEPS: readonly IntakeStep[] = [
  {
    index: 1,
    label: 'Intake started',
    description:
      'Cohort handed to the pilot operator. Clinicians enumerated, federal-source resolution queued.',
    owner: 'shared',
  },
  {
    index: 2,
    label: 'Evidence received',
    description:
      'NPPES, OIG/LEIE, PECOS resolved within the freshness budget. Per-lane state, source reference, and operator note captured.',
    owner: 'vitalcv',
  },
  {
    index: 3,
    label: 'Source-confirmed continuity',
    description:
      'Replay envelope produced per clinician. Stale-but-signed lanes surfaced explicitly; no continuity loss is silent.',
    owner: 'vitalcv',
  },
  {
    index: 4,
    label: 'Institution review',
    description:
      'Receiving institution reviews each lane on its own credential. State medical board and credentialing committee remain on existing cadence.',
    owner: 'institution',
  },
  {
    index: 5,
    label: 'Deployment-ready (institution-owned)',
    description:
      'Final acceptance and privileging decisions are institution-owned. The pilot surfaces evidence; it does not declare a clinician deployment-ready on its own.',
    owner: 'institution',
  },
];

const OWNER_LABEL: Record<IntakeStep['owner'], string> = {
  vitalcv: 'VitalCV',
  shared: 'Shared',
  institution: 'Your institution',
};

const OWNER_BORDER: Record<IntakeStep['owner'], string> = {
  vitalcv: 'border-slate-900',
  shared: 'border-slate-700',
  institution: 'border-2 border-slate-900',
};

export function InstitutionalIntakeProgress({
  className,
}: InstitutionalIntakeProgressProps) {
  return (
    <section
      data-slot="institutional-intake-progress"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Intake progress · five operational stages
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Each stage names its owner. Stages 4 and 5 are
          institution-owned -- the pilot does not advance them.
        </p>
      </header>
      <ol className="divide-y divide-slate-200">
        {STEPS.map((s) => (
          <li
            key={s.index}
            data-slot="intake-step"
            data-step-index={s.index}
            data-owner={s.owner}
            className={cn(
              'grid grid-cols-1 gap-2 border-l-4 px-4 py-3 sm:grid-cols-12',
              OWNER_BORDER[s.owner],
            )}
          >
            <div className="sm:col-span-1">
              <div className="font-mono text-sm text-slate-900">
                {String(s.index).padStart(2, '0')}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Stage
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {s.label}
              </div>
            </div>
            <div className="sm:col-span-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Description
              </div>
              <p className="mt-1 text-xs text-slate-700">{s.description}</p>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Owner
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {OWNER_LABEL[s.owner]}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
