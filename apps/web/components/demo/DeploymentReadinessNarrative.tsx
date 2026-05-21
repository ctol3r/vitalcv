import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ClinicianExample } from '@/lib/demo/demoFixtures';

/**
 * Renders the deployment-ready clinician cohort. Each card names the
 * subject, NPI, credential, specialty, and operating state -- no
 * trust badges, no certification claims, no "deployment-ready"
 * stamps. Deployment readiness is institution-owned; this view
 * surfaces the operational data the receiving institution will
 * consult.
 */
export interface DeploymentReadinessNarrativeProps {
  clinicians: readonly ClinicianExample[];
  className?: string;
}

export function DeploymentReadinessNarrative({
  clinicians,
  className,
}: DeploymentReadinessNarrativeProps) {
  return (
    <section
      data-slot="deployment-readiness-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Cohort overview · ready for institution review
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          The cohort below has a complete federal-source resolution and
          a portable replay envelope per clinician. State-board and
          committee review remain institution-owned.
        </p>
      </header>
      <ul className="divide-y divide-slate-200">
        {clinicians.map((c) => (
          <li
            key={c.npi}
            data-slot="deployment-readiness-row"
            data-cohort-tag={c.cohortTag}
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
