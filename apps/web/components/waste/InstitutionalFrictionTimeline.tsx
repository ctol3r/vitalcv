import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A read-only chronology of where institutional friction shows up
 * across a typical credentialing cycle. The timeline names six
 * checkpoints from "candidate identified" through "deployment", and
 * for each names (a) what slows down today and (b) what remains on
 * the institution's existing cadence. The component is presentational
 * and stateless.
 */
export interface InstitutionalFrictionTimelineProps {
  className?: string;
}

interface TimelineCheckpoint {
  marker: string;
  label: string;
  friction: string;
  institutionOwned: string;
}

const CHECKPOINTS: readonly TimelineCheckpoint[] = [
  {
    marker: 'T-0',
    label: 'Candidate identified',
    friction:
      'Receiving institution opens a file; sending operator collects the federal-source artifacts the receiving CVO will ask for.',
    institutionOwned:
      'Receiving institution defines its own intake checklist.',
  },
  {
    marker: 'T-1',
    label: 'Federal-source resolution',
    friction:
      'Receiving CVO queries NPPES, OIG/LEIE, PECOS. Sending operator already queried them. The receive-side query is duplicative.',
    institutionOwned:
      'Receiving CVO still owns the read on its own credential, even when a replay envelope carries the lane.',
  },
  {
    marker: 'T-2',
    label: 'State medical board PSV',
    friction:
      'Receiving CVO PSVs the state board; this is the receiving institution\'s job and continues to be.',
    institutionOwned:
      'State medical board PSV remains institution-owned in full.',
  },
  {
    marker: 'T-3',
    label: 'Committee scheduling',
    friction:
      'Committee meets on its fixed cadence. Clinician readiness does not move the meeting.',
    institutionOwned:
      'Committee cadence is institution-owned; the page does not claim acceleration here.',
  },
  {
    marker: 'T-4',
    label: 'Committee disposition',
    friction:
      'Committee reads the packet; sometimes pauses on stale-but-signed lanes; sometimes asks the operator to re-confirm.',
    institutionOwned:
      'Committee judgement remains institution-owned. The page surfaces the operator note in place to avoid re-summarization, but does not propose to remove the judgement.',
  },
  {
    marker: 'T-5',
    label: 'Privileging + deployment',
    friction:
      'Privileging signoff awaits chief-of-staff schedule; deployment happens after privileging clears.',
    institutionOwned:
      'Privileging and deployment cadence are institution-owned in full.',
  },
];

export function InstitutionalFrictionTimeline({
  className,
}: InstitutionalFrictionTimelineProps) {
  return (
    <section
      data-slot="institutional-friction-timeline"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Friction timeline · six checkpoints
        </h3>
        <p className="mt-1 max-w-[62ch] text-xs text-slate-600">
          A receiver-side chronology of where credentialing slows down,
          checkpoint by checkpoint. Five of six checkpoints carry
          institution-owned work that does not move; the page names
          each one explicitly so no acceleration claim drifts.
        </p>
      </header>
      <ol className="divide-y divide-slate-200">
        {CHECKPOINTS.map((cp) => (
          <li
            key={cp.marker}
            data-slot="institutional-friction-checkpoint"
            data-marker={cp.marker}
            className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12"
          >
            <div className="sm:col-span-2">
              <div className="font-mono text-sm text-slate-900">{cp.marker}</div>
              <div className="mt-1 text-xs font-semibold text-slate-700">
                {cp.label}
              </div>
            </div>
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Where friction shows up
              </div>
              <div className="mt-1 text-xs text-slate-700">{cp.friction}</div>
            </div>
            <div className="sm:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Institution-owned
              </div>
              <div className="mt-1 text-xs text-slate-700">
                {cp.institutionOwned}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
