'use client';

import React, { useMemo, useState, type ReactElement } from 'react';

import {
  explainWorklistStatus,
  filterWorklist,
  type WorklistItem,
  type WorklistItemStatus,
} from '@/lib/verifier/worklist';

interface WorklistPanelProps {
  items: WorklistItem[];
  onSelect?: (item: WorklistItem) => void;
}

const STATUS_OPTIONS: Array<WorklistItemStatus | 'all'> = [
  'all',
  'pending',
  'in_review',
  'info_requested',
  'acceptable_for_start',
  'unable_to_verify',
];

const STATUS_LABELS: Record<WorklistItemStatus, string> = {
  pending: 'Pending review',
  in_review: 'In review',
  info_requested: 'Info requested',
  acceptable_for_start: 'Acceptable for start',
  unable_to_verify: 'Unable to assess',
};

// Map lifecycle status → calm truth-chip variant. In-flight states (pending /
// in review / info requested) read as "watch"; a positive terminal state reads
// "ok"; an indeterminate terminal state reads "unknown" — never a red finding,
// because "unable to assess" is not a finding about the clinician.
const STATUS_CLASSES: Record<WorklistItemStatus, string> = {
  pending: 'mz-chip-watch',
  in_review: 'mz-chip-watch',
  info_requested: 'mz-chip-watch',
  acceptable_for_start: 'mz-chip-ok',
  unable_to_verify: 'mz-chip-unknown',
};

export function WorklistPanel({
  items,
  onSelect,
}: WorklistPanelProps): ReactElement {
  const [status, setStatus] = useState<WorklistItemStatus | 'all'>('all');
  const [npiQuery, setNpiQuery] = useState('');

  const filteredItems = useMemo(
    () => filterWorklist(items, { status, clinicianNpi: npiQuery }),
    [items, npiQuery, status],
  );

  return (
    <section
      aria-label="Verifier worklist foundation"
      className="mz mz-card overflow-hidden"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--rule)] p-5 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="mz-eyebrow">
            Verifier worklist
          </p>
          <h2 className="mz-h2">
            Submitted applications
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_12rem]">
          <label className="grid gap-1 text-sm font-medium text-[var(--ink-700)]">
            NPI
            <input
              value={npiQuery}
              onChange={(event) => setNpiQuery(event.target.value)}
              className="mz-input"
              placeholder="Filter by NPI"
              type="search"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-[var(--ink-700)]">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as WorklistItemStatus | 'all')}
              className="mz-input"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All statuses' : STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="divide-y divide-[var(--rule-soft)]">
        {filteredItems.length === 0 ? (
          <div className="p-5 text-sm text-[var(--ink-600)]">
            No submitted applications match the current filters.
          </div>
        ) : (
          filteredItems.map((item) => (
            <WorklistRow
              key={`${item.clinicianNpi}-${item.submittedAt}`}
              item={item}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <p className="border-t border-[var(--rule)] bg-[var(--paper-2)] px-5 py-3 text-xs text-[var(--ink-600)]">
        This worklist reflects submitted applications. Review outcomes do not
        constitute legal verification.
      </p>
    </section>
  );
}

function WorklistRow({
  item,
  onSelect,
}: {
  item: WorklistItem;
  onSelect?: (item: WorklistItem) => void;
}): ReactElement {
  const row = (
    <div className="grid gap-3 text-left sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="mz-mono text-sm font-semibold text-[var(--ink-900)]">
            NPI {item.clinicianNpi}
          </p>
          <StatusPill status={item.status} />
          <span className="rounded-[2px] border border-[var(--rule)] bg-[var(--ink-50)] px-2 py-0.5 mz-mono text-[10px] uppercase tracking-[0.04em] text-[var(--ink-500)]">
            {item.proofTier}
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--ink-600)]">
          {explainWorklistStatus(item.status)}
        </p>
      </div>
      <time className="mz-mono text-xs text-[var(--ink-500)]" dateTime={item.submittedAt}>
        {formatSubmittedAt(item.submittedAt)}
      </time>
    </div>
  );

  if (!onSelect) {
    return <div className="p-5">{row}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="block w-full p-5 text-left transition hover:bg-[var(--paper-2)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--ink-900)]"
    >
      {row}
    </button>
  );
}

function StatusPill({
  status,
}: {
  status: WorklistItemStatus;
}): ReactElement {
  const label = STATUS_LABELS[status];

  return (
    <span
      aria-label={`Status: ${label}`}
      className={`mz-chip ${STATUS_CLASSES[status]}`}
    >
      <span className="mz-gl" aria-hidden="true" />
      {label}
    </span>
  );
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
