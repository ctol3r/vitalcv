import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ExchangeTimelineEntry } from '@/lib/interoperability/demoExchanges';

/**
 * Trust Exchange Timeline.
 *
 * Vertical institutional timeline of an evidence handoff between two
 * institutions. Dense, quiet, operational chrome -- not a consumer
 * activity feed. Each row renders the canonical event kind, the
 * actor, and a one-line summary. No emoji, no animations.
 *
 * The timeline does not editorialize. It does not say "trust
 * transferred"; it lists the operational events that actually
 * occurred.
 */

export interface TrustExchangeTimelineProps {
  entries: readonly ExchangeTimelineEntry[];
  className?: string;
}

const KIND_LABEL: Record<ExchangeTimelineEntry['kind'], string> = {
  evidence_generated: 'Evidence generated',
  replay_exported: 'Replay exported',
  review_started: 'Review started',
  cross_check_initiated: 'Cross-check initiated',
  continuity_interruption: 'Continuity interruption',
  continuity_restored: 'Continuity restored',
  institution_confirmed: 'Institution-confirmed',
  deployment_ready: 'Deployment-ready',
  operator_note: 'Operator note',
};

const KIND_VISUAL: Record<ExchangeTimelineEntry['kind'], string> = {
  evidence_generated: 'border-slate-900 bg-white text-slate-900',
  replay_exported: 'border-slate-900 bg-white text-slate-900',
  review_started: 'border-slate-700 bg-slate-50 text-slate-800',
  cross_check_initiated: 'border-slate-700 bg-slate-50 text-slate-800',
  continuity_interruption:
    'border-dashed border-amber-500 bg-amber-50/50 text-slate-900',
  continuity_restored: 'border-slate-900 bg-white text-slate-900',
  institution_confirmed: 'border-2 border-slate-900 bg-white text-slate-900',
  deployment_ready: 'border-2 border-slate-900 bg-white text-slate-900',
  operator_note: 'border-slate-700 bg-slate-50 text-slate-700',
};

export function TrustExchangeTimeline({
  entries,
  className,
}: TrustExchangeTimelineProps) {
  return (
    <section
      data-slot="trust-exchange-timeline"
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-900 bg-white',
        className,
      )}
    >
      <header className="border-b border-slate-900 bg-slate-50 px-4 py-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-slate-700">
          Trust exchange timeline · operational chronology
        </h3>
      </header>
      <ol className="divide-y divide-slate-200">
        {entries.map((entry, i) => (
          <li
            key={`${entry.occurredAt}-${i}`}
            data-slot="trust-exchange-timeline-entry"
            data-kind={entry.kind}
            className={cn(
              'grid grid-cols-1 gap-3 border-l-4 px-4 py-3 sm:grid-cols-12',
              KIND_VISUAL[entry.kind],
            )}
          >
            <div className="sm:col-span-3">
              <div className="font-mono text-xs text-slate-700">
                {entry.occurredAt}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                {KIND_LABEL[entry.kind]}
              </div>
            </div>
            <div className="sm:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Actor
              </div>
              <div className="mt-0.5 font-mono text-xs text-slate-900">
                {entry.actor}
              </div>
            </div>
            <div className="sm:col-span-6">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Summary
              </div>
              <div className="mt-0.5 text-sm text-slate-900">
                {entry.summary}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
