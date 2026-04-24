'use client';

import React, { type ReactNode } from 'react';
import { readinessLevelLabel } from '@/lib/trust/status-language';

interface EmployerSummaryCardProps {
  clinicianName: string;
  readinessLevel: string;
  readinessScore: number | null;
  readinessStatus: string;
  verifiedItems: string[];
  missingItems: string[];
  blockers: string[];
  dataFreshnessNote: string;
  acceptanceProbability?: number | null;
  acceptanceBand?: string | null;
  estimatedDaysToStart?: number | null;
  bestActionLabel?: string | null;
  bestActionReason?: string | null;
}

function summarizeItems(items: string[], maxVisible = 3): { visible: string[]; remaining: number } {
  return {
    visible: items.slice(0, maxVisible),
    remaining: Math.max(0, items.length - maxVisible),
  };
}

function SummaryGroup({
  icon,
  title,
  items,
  emptyLabel,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  const { visible, remaining } = summarizeItems(items);

  return (
    <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--vt-text-2)]">
        <span className="text-[var(--vt-text-2)]" aria-hidden="true">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      <div className="mt-3 space-y-2 text-sm text-[var(--vt-text-2)]">
        {visible.length > 0 ? (
          visible.map((item) => (
            <p key={item} className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2">
              {item}
            </p>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--vt-border)] px-3 py-2 text-[var(--vt-text-3)]">
            {emptyLabel}
          </p>
        )}
        {remaining > 0 && (
          <p className="text-xs text-[var(--vt-text-3)]">+ {remaining} more</p>
        )}
      </div>
    </div>
  );
}

function bandColor(band: string | null | undefined): string {
  switch (band) {
    case 'DECISION_GRADE': return 'text-emerald-400';
    case 'HIGH': return 'text-emerald-500';
    case 'MEDIUM': return 'text-amber-400';
    case 'LOW': return 'text-orange-400';
    case 'BLOCKED': return 'text-red-400';
    default: return 'text-[var(--vt-text-3)]';
  }
}

function bandLabel(band: string | null | undefined): string {
  switch (band) {
    case 'DECISION_GRADE': return 'Decision-grade';
    case 'HIGH': return 'High';
    case 'MEDIUM': return 'Medium';
    case 'LOW': return 'Low';
    case 'BLOCKED': return 'Blocked';
    default: return '—';
  }
}

function resolveCanStartAnswer(input: {
  blockers: string[];
  missingItems: string[];
  verifiedItems: string[];
}): {
  answer: string;
  detail: string;
} {
  if (input.blockers.length > 0) {
    return {
      answer: 'No',
      detail: 'A confirmed blocker in this snapshot must be resolved before start.',
    };
  }

  if (input.verifiedItems.length === 0) {
    return {
      answer: 'Not yet',
      detail: 'No verified evidence is attached yet, so this snapshot cannot support a start decision.',
    };
  }

  if (input.missingItems.length > 0) {
    return {
      answer: 'Not yet',
      detail: 'Some evidence is verified, but this snapshot still has open limitations.',
    };
  }

  return {
    answer: 'Yes',
    detail: 'Nothing in this snapshot prevents moving forward now.',
  };
}

function resolveBlockingAnswer(input: {
  blockers: string[];
  missingItems: string[];
}): string {
  if (input.blockers.length > 0) {
    return input.blockers[0];
  }

  if (input.missingItems.length > 0) {
    return input.missingItems[0];
  }

  return 'Nothing is currently blocking start in this snapshot.';
}

function resolveTimelineAnswer(input: {
  estimatedDaysToStart?: number | null;
  blockers: string[];
}): string {
  if (typeof input.estimatedDaysToStart === 'number') {
    return `${input.estimatedDaysToStart} days from this snapshot.`;
  }

  if (input.blockers.length > 0) {
    return 'Not yet estimable while a blocker is still active.';
  }

  return 'Not yet estimable from this snapshot.';
}

export function EmployerSummaryCard({
  clinicianName,
  readinessLevel,
  readinessScore,
  readinessStatus,
  verifiedItems,
  missingItems,
  blockers,
  dataFreshnessNote,
  acceptanceProbability,
  acceptanceBand,
  estimatedDaysToStart,
  bestActionLabel,
  bestActionReason,
}: EmployerSummaryCardProps) {
  const label = readinessLevelLabel(readinessLevel);
  const gridClass = blockers.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  const normalizedScore = typeof readinessScore === 'number' ? Math.max(0, Math.min(100, readinessScore)) : null;
  const isBlocked = acceptanceBand === 'BLOCKED' || blockers.length > 0;
  const probabilityPct = typeof acceptanceProbability === 'number'
    ? Math.round(acceptanceProbability * 100)
    : null;
  const canStart = resolveCanStartAnswer({
    blockers,
    missingItems,
    verifiedItems,
  });
  const blockingAnswer = resolveBlockingAnswer({
    blockers,
    missingItems,
  });
  const nextStepAnswer = bestActionReason ?? bestActionLabel ?? 'Open the full review and record the next action from the evidence on screen.';
  const timelineAnswer = resolveTimelineAnswer({
    estimatedDaysToStart,
    blockers,
  });

  return (
    <section className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5">
      <div className="flex flex-col gap-4">

        {isBlocked && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-red-400">Cannot proceed — active blocker</p>
            <p className="mt-1 text-xs text-red-300/70">
              {blockers[0] ?? 'A blocker was detected on this credential snapshot. Start is not possible until resolved.'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)]">
              Employer decision snapshot
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-[var(--vt-text-1)]">{clinicianName}</h1>
              <span className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)]">
                {readinessLevel} · {label}
              </span>
            </div>
            <p className="max-w-2xl text-sm text-[var(--vt-text-2)]">
              This share answers one question: can this clinician move forward from the evidence shown here. Sign in to record the next action.
            </p>
          </div>
          <div className="flex flex-col gap-3 min-w-[176px]">
            <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Readiness score</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--vt-text-1)]">
                    {normalizedScore === null ? '—' : normalizedScore}
                  </p>
                </div>
                <p className="text-right text-xs text-[var(--vt-text-3)]">
                  {normalizedScore === null ? 'Not yet scored' : 'out of 100'}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--vt-surface)]">
                <div
                  className="h-full rounded-full bg-[var(--vt-text-2)] transition-all duration-700"
                  style={{ width: `${normalizedScore ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--vt-text-3)]">{readinessStatus}</p>
            </div>

            {probabilityPct !== null && (
              <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Decision confidence</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className={`text-2xl font-semibold ${bandColor(acceptanceBand)}`}>{probabilityPct}%</p>
                  <p className={`text-xs font-medium ${bandColor(acceptanceBand)}`}>{bandLabel(acceptanceBand)}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--vt-surface)]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      acceptanceBand === 'BLOCKED' ? 'bg-red-500/60'
                      : acceptanceBand === 'LOW' ? 'bg-orange-400/60'
                      : acceptanceBand === 'MEDIUM' ? 'bg-amber-400/60'
                      : 'bg-emerald-500/60'
                    }`}
                    style={{ width: `${probabilityPct}%` }}
                  />
                </div>
                {estimatedDaysToStart !== null && estimatedDaysToStart !== undefined ? (
                  <p className="mt-2 text-xs text-[var(--vt-text-3)]">Estimated time to start: {estimatedDaysToStart} days</p>
                ) : (
                  <p className="mt-2 text-xs text-[var(--vt-text-3)]">Estimated time to start: not yet estimable</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AnswerCard title="Can I start?" answer={canStart.answer} detail={canStart.detail} />
          <AnswerCard title="What’s blocking?" answer={blockingAnswer} detail={blockers.length > 0 ? 'Resolve this first before proceeding.' : 'No confirmed blocker is attached in this snapshot.'} />
          <AnswerCard title="What do I do next?" answer={bestActionLabel ?? 'Review and act'} detail={nextStepAnswer} />
          <AnswerCard title="How long?" answer={timelineAnswer} detail={typeof estimatedDaysToStart === 'number' ? 'Estimated from the current evidence and blocker state.' : 'VitalCV only shows a time estimate when this snapshot supports one.'} />
        </div>

        <div className={`grid gap-4 ${gridClass}`}>
          <SummaryGroup
            icon={<CheckIcon />}
            title="Verified now"
            items={verifiedItems}
            emptyLabel="No verified items included yet."
          />
          <SummaryGroup
            icon={<CircleIcon />}
            title="Still missing"
            items={missingItems}
            emptyLabel="No remaining limitations are listed in this snapshot."
          />
          {blockers.length > 0 && (
            <SummaryGroup
              icon={<BlockIcon />}
              title="Blocks start"
              items={blockers}
              emptyLabel="No current blockers."
            />
          )}
        </div>

        {bestActionLabel && (
          <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)]">Recommended next step</p>
            <p className="mt-1 text-sm font-medium text-[var(--vt-text-1)]">{bestActionLabel}</p>
            {bestActionReason && (
              <p className="mt-1 text-xs text-[var(--vt-text-2)]">{bestActionReason}</p>
            )}
          </div>
        )}

        <p className="text-xs text-[var(--vt-text-3)]">{dataFreshnessNote}</p>
      </div>
    </section>
  );
}

function AnswerCard({
  title,
  answer,
  detail,
}: {
  title: string;
  answer: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)]">{title}</p>
      <p className="mt-2 text-base font-semibold text-[var(--vt-text-1)]">{answer}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--vt-text-2)]">{detail}</p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default EmployerSummaryCard;
