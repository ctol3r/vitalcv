import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ClinicianExample } from '@/lib/demo/demoFixtures';

/**
 * Cohort-level operational summary: how many clinicians, how many
 * states, how many specialties, how many cohort tags. Renders a
 * dense at-a-glance row of counts and a per-clinician table.
 *
 * Never claims "ready for deployment" or "fully verified" -- the
 * heading is "ready for institution review", a deliberately bounded
 * claim.
 */
export interface OperationalReadinessSummaryProps {
  clinicians: readonly ClinicianExample[];
  className?: string;
}

export function OperationalReadinessSummary({
  clinicians,
  className,
}: OperationalReadinessSummaryProps) {
  const stateSet = new Set(clinicians.map((c) => c.state));
  const specialtySet = new Set(clinicians.map((c) => c.specialty));
  const cohortTags = new Set(clinicians.map((c) => c.cohortTag));
  return (
    <section
      data-slot="operational-readiness-summary"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Cohort summary · ready for institution review
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Federal-source resolution is complete for each row. State
          board and committee review remain on your existing cadence.
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-4">
        <Stat label="Clinicians" value={clinicians.length} />
        <Stat label="Operating states" value={stateSet.size} />
        <Stat label="Specialties" value={specialtySet.size} />
        <Stat label="Cohort tags" value={cohortTags.size} />
      </dl>
      <ul className="divide-y divide-slate-200">
        {clinicians.map((c) => (
          <li
            key={c.npi}
            data-slot="operational-readiness-row"
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Clinician
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {c.displayName}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                NPI {c.npi}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Credential
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {c.credential}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Specialty
              </div>
              <div className="mt-1 text-xs text-slate-900">{c.specialty}</div>
            </div>
            <div className="sm:col-span-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                State
              </div>
              <div className="mt-1 font-mono text-xs text-slate-900">
                {c.state}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Cohort tag
              </div>
              <div className="mt-1 font-mono text-[11px] text-slate-700">
                {c.cohortTag}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg text-slate-900">{value}</dd>
    </div>
  );
}
