'use client';

import React, { type ReactNode } from 'react';
import type {
  ApplicationSnapshotSummary,
  ApplicationLaneSummary,
} from '@/lib/apply/application-snapshot';
import { getProgressSpineLabels } from '@/lib/apply/application-snapshot';
import type { ApplicationProgressStage } from '@/lib/apply/application-progress';

interface Props {
  summary: ApplicationSnapshotSummary;
  /** Optional eyebrow rendered above the tier label. */
  eyebrow?: string;
  /** Extra action rendered next to the tier badge. */
  headerRight?: ReactNode;
}

const TIER_TONE: Record<
  ApplicationSnapshotSummary['proofTier']['tier'],
  { badge: string; border: string }
> = {
  draft_snapshot: {
    badge: 'bg-red-500/15 text-red-300 ring-red-500/30',
    border: 'border-red-500/20',
  },
  partial_proof_pack: {
    badge: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    border: 'border-amber-500/20',
  },
  decision_grade_proof_pack: {
    badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    border: 'border-emerald-500/20',
  },
};

export function ApplicationSnapshotCard({ summary, eyebrow, headerRight }: Props) {
  const tone = TIER_TONE[summary.proofTier.tier];

  return (
    <section
      data-testid="application-snapshot-card"
      className={`rounded-2xl border ${tone.border} bg-[var(--vt-surface)] p-5 space-y-4`}
    >
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
              {eyebrow}
            </p>
          ) : null}
          <div className="flex items-center flex-wrap gap-2">
            <span
              data-testid="proof-tier-badge"
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase tracking-widest ring-1 ring-inset ${tone.badge}`}
            >
              {summary.proofTier.label}
            </span>
            <ProgressBadge stage={summary.progress.stage} label={summary.progress.label} isWaiting={summary.progress.isWaiting} />
          </div>
          <p className="mt-2 text-sm text-zinc-300 leading-snug">
            {summary.proofTier.description}
          </p>
          {summary.proofTier.acceptBlockedReason ? (
            <p
              data-testid="accept-blocked-reason"
              className="mt-1 text-xs text-amber-300"
            >
              {summary.proofTier.acceptBlockedReason}
            </p>
          ) : null}
        </div>
        {headerRight}
      </header>

      <ProgressSpine stage={summary.progress.stage} isWaiting={summary.progress.isWaiting} />

      <div className="grid gap-3 md:grid-cols-2">
        <LaneGroup
          testId="included-lanes"
          title="What's in this packet"
          lanes={summary.includedLanes}
          emptyLabel="No lanes are checked yet."
          tone="included"
        />
        <LaneGroup
          testId="omitted-lanes"
          title="Not in this packet"
          lanes={summary.omittedLanes}
          emptyLabel="Every covered lane was included."
          tone="omitted"
        />
      </div>

      {summary.limitationNote ? (
        <p
          data-testid="limitation-note"
          className="text-xs leading-snug text-amber-200/80 border-l-2 border-amber-500/40 pl-3"
        >
          {summary.limitationNote}
        </p>
      ) : null}

      {summary.blockers.length > 0 ? (
        <ul data-testid="blocker-list" className="space-y-2">
          {summary.blockers.map((b, i) => (
            <li
              key={`${b.title}-${i}`}
              className="rounded-xl border border-border bg-muted/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold uppercase tracking-widest bg-zinc-800 text-zinc-300 ring-1 ring-inset ring-zinc-700">
                  {b.ownerLabel}
                </span>
                <span className="text-xs font-medium text-zinc-200">{b.title}</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 leading-snug">{b.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function LaneGroup({
  title,
  lanes,
  emptyLabel,
  tone,
  testId,
}: {
  title: string;
  lanes: ApplicationLaneSummary[];
  emptyLabel: string;
  tone: 'included' | 'omitted';
  testId: string;
}) {
  return (
    <div data-testid={testId} className="rounded-xl border border-border bg-[var(--vt-surface-2,rgba(255,255,255,0.02))] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
        {title} ({lanes.length})
      </p>
      {lanes.length === 0 ? (
        <p className="text-[11px] text-zinc-500 italic">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {lanes.map((lane, i) => (
            <li
              key={`${lane.label}-${i}`}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span
                className={
                  tone === 'included'
                    ? 'text-emerald-200/90'
                    : 'text-zinc-300'
                }
              >
                {lane.label}
              </span>
              {lane.qualifier ? (
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {lane.qualifier}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProgressBadge({
  stage,
  label,
  isWaiting,
}: {
  stage: ApplicationProgressStage;
  label: string;
  isWaiting: boolean;
}) {
  const cls = isWaiting
    ? 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
    : 'bg-zinc-800 text-zinc-300 ring-zinc-700';
  return (
    <span
      data-testid="progress-badge"
      data-stage={stage}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium uppercase tracking-widest ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

function ProgressSpine({
  stage,
  isWaiting,
}: {
  stage: ApplicationProgressStage;
  isWaiting: boolean;
}) {
  const spine = getProgressSpineLabels();
  // Side-states do not occupy a spine cell; find the nearest upstream
  // main-spine stage to highlight, and let ProgressBadge carry the
  // waiting qualifier.
  const spineStages = spine.map((s) => s.stage);
  const nearestSpine = spineStages.includes(stage)
    ? stage
    : ('in_review' as ApplicationProgressStage);
  const activeIndex = spineStages.indexOf(nearestSpine);

  return (
    <div
      data-testid="progress-spine"
      className="flex items-center gap-1 overflow-x-auto"
      aria-label="Application progress"
    >
      {spine.map(({ stage: cellStage, label }, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div
            key={cellStage}
            data-stage={cellStage}
            data-state={done ? 'done' : active ? 'active' : 'pending'}
            className={`flex items-center gap-1.5 whitespace-nowrap px-2 py-1 rounded-md text-[10px] uppercase tracking-widest ${
              done
                ? 'text-emerald-300/80'
                : active
                  ? isWaiting
                    ? 'text-amber-300'
                    : 'text-zinc-100'
                  : 'text-zinc-500'
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                done
                  ? 'bg-emerald-400'
                  : active
                    ? isWaiting
                      ? 'bg-amber-400'
                      : 'bg-zinc-100'
                    : 'bg-zinc-700'
              }`}
            />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
