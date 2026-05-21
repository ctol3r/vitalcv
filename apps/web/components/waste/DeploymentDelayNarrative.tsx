import * as React from 'react';
import { cn } from '@/lib/utils';
import type { DeploymentReadinessExample } from '@/lib/demo/demoFixtures';

/**
 * Narrative 6 · Deployment delay as waste.
 *
 * The deployment date is the date the clinician sees patients. Today
 * deployment delay shows up across federal-source wait, committee
 * cadence, and privileging cadence. The narrative names each axis
 * with its before/after framing taken from the deployment-readiness
 * fixture. The page does NOT claim the committee/privileging axes
 * compress; only the federal-source axis is named as compressing.
 */
export interface DeploymentDelayNarrativeProps {
  rows: readonly DeploymentReadinessExample[];
  className?: string;
}

interface DelayAxis {
  axis: string;
  whatDelays: string;
  whatStays: string;
}

const DELAY_AXES: readonly DelayAxis[] = [
  {
    axis: 'Federal-source resolution axis',
    whatDelays:
      'Receiving CVO waits for NPPES, OIG/LEIE, and PECOS to come back through normal channels. This is the only axis the page claims compresses.',
    whatStays:
      'Receiving CVO still confirms each lane on its own credential.',
  },
  {
    axis: 'Committee-review axis',
    whatDelays:
      'The credentialing committee meets on a fixed schedule. Clinician readiness does not change committee scheduling.',
    whatStays:
      'Committee cadence is institution-owned; the page does not claim acceleration here.',
  },
  {
    axis: 'Privileging-decision axis',
    whatDelays:
      'Privileging signoff happens on the institution\'s own cadence.',
    whatStays:
      'Privileging is institution-owned; the page does not claim acceleration here.',
  },
];

export function DeploymentDelayNarrative({
  rows,
  className,
}: DeploymentDelayNarrativeProps) {
  return (
    <section
      data-slot="deployment-delay-narrative"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Narrative 06 · deployment delay
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          Deployment is held up by three axes. Only one compresses.
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          Federal-source resolution, committee review, and privileging
          all contribute to the gap between hire and first patient. The
          page is honest about which axis compresses (federal-source)
          and which axes stay on the institution's existing cadence.
        </p>
      </header>

      <section
        data-slot="deployment-delay-axes"
        className="border-b border-slate-200 px-4 py-3"
      >
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Where deployment delay accumulates
        </div>
        <ul className="mt-2 divide-y divide-slate-200">
          {DELAY_AXES.map((axis) => (
            <li
              key={axis.axis}
              data-slot="deployment-delay-axis"
              className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-12"
            >
              <div className="sm:col-span-4">
                <div className="text-xs font-semibold text-slate-900">
                  {axis.axis}
                </div>
              </div>
              <div className="sm:col-span-4">
                <div className="text-xs text-slate-700">{axis.whatDelays}</div>
              </div>
              <div className="sm:col-span-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Institution-owned
                </div>
                <div className="mt-1 text-xs text-slate-700">{axis.whatStays}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section data-slot="deployment-delay-metrics" className="px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
          Federal-source axis · before / after (pilot target framing)
        </div>
        <ul className="mt-2 divide-y divide-slate-200">
          {rows.map((row) => (
            <li
              key={row.metric}
              data-slot="deployment-delay-metric-row"
              className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-12"
            >
              <div className="sm:col-span-4">
                <div className="text-xs font-semibold text-slate-900">
                  {row.metric}
                </div>
              </div>
              <div className="sm:col-span-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Before
                </div>
                <div className="mt-1 text-xs text-slate-700">{row.before}</div>
              </div>
              <div className="sm:col-span-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  After (pilot target)
                </div>
                <div className="mt-1 text-xs text-slate-700">{row.after}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  Framing
                </div>
                <div className="mt-1 text-xs text-slate-700">
                  {row.institutionalFraming}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        Pilot target · not a measured cohort result · committee + privileging stay institution-owned
      </footer>
    </section>
  );
}
