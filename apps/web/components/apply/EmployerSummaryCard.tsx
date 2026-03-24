'use client';

import type { ReactNode } from 'react';
import { readinessLevelLabel } from '@/lib/trust/status-language';

interface EmployerSummaryCardProps {
  clinicianName: string;
  readinessLevel: string;
  readinessScore: number;
  readinessStatus: string;
  verifiedItems: string[];
  missingItems: string[];
  blockers: string[];
  dataFreshnessNote: string;
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

export function EmployerSummaryCard({
  clinicianName,
  readinessLevel,
  readinessScore,
  readinessStatus,
  verifiedItems,
  missingItems,
  blockers,
  dataFreshnessNote,
}: EmployerSummaryCardProps) {
  const label = readinessLevelLabel(readinessLevel);
  const gridClass = blockers.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <section className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-3)]">
              Employer acceptance capsule
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-[var(--vt-text-1)]">{clinicianName}</h1>
              <span className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1 text-xs font-medium text-[var(--vt-text-2)]">
                {readinessLevel} · {label}
              </span>
            </div>
            <p className="max-w-2xl text-sm text-[var(--vt-text-2)]">
              This share is a public readiness snapshot for employer review. Sign in to continue to the full decision report and employer actions.
            </p>
          </div>
          <div className="min-w-[176px] rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-2)] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">Readiness score</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--vt-text-1)]">{readinessScore}</p>
              </div>
              <p className="text-right text-xs text-[var(--vt-text-3)]">out of 100</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--vt-surface)]">
              <div
                className="h-full rounded-full bg-[var(--vt-text-2)] transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, readinessScore))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--vt-text-3)]">{readinessStatus}</p>
          </div>
        </div>

        <div className={`grid gap-4 ${gridClass}`}>
          <SummaryGroup
            icon={<CheckIcon />}
            title="Verified"
            items={verifiedItems}
            emptyLabel="No verified items included yet."
          />
          <SummaryGroup
            icon={<CircleIcon />}
            title="Missing"
            items={missingItems}
            emptyLabel="No missing items noted in this share."
          />
          {blockers.length > 0 && (
            <SummaryGroup
              icon={<BlockIcon />}
              title="Blocked"
              items={blockers}
              emptyLabel="No current blockers."
            />
          )}
        </div>

        <p className="text-xs text-[var(--vt-text-3)]">{dataFreshnessNote}</p>
      </div>
    </section>
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
