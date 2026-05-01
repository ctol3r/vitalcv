'use client';

import React, { useMemo, useState, type ReactElement } from 'react';

import {
  explainWorklistStatus,
  filterWorklist,
  type WorklistItem,
  type WorklistItemStatus,
  type WorklistProofTier,
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

const STATUS_CLASSES: Record<WorklistItemStatus, string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  in_review: 'border-sky-300 bg-sky-50 text-sky-900',
  info_requested: 'border-violet-300 bg-violet-50 text-violet-900',
  acceptable_for_start: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  unable_to_verify: 'border-slate-300 bg-slate-100 text-slate-800',
};

const PROOF_TIER_CLASSES: Record<WorklistProofTier, string> = {
  receipt_candidate: 'border-blue-200 bg-blue-50 text-blue-800',
  psv_sourced: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  self_attested: 'border-orange-200 bg-orange-50 text-orange-800',
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
      className="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Verifier worklist
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Submitted applications
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_12rem]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            NPI
            <input
              value={npiQuery}
              onChange={(event) => setNpiQuery(event.target.value)}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-slate-700"
              placeholder="Filter by NPI"
              type="search"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as WorklistItemStatus | 'all')}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-slate-700"
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

      <div className="divide-y divide-slate-200">
        {filteredItems.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
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

      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
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
          <p className="font-mono text-sm font-semibold text-slate-950">
            NPI {item.clinicianNpi}
          </p>
          <StatusPill status={item.status} />
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${PROOF_TIER_CLASSES[item.proofTier]}`}
          >
            {item.proofTier}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {explainWorklistStatus(item.status)}
        </p>
      </div>
      <time className="font-mono text-xs text-slate-500" dateTime={item.submittedAt}>
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
      className="block w-full p-5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-700"
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
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
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
