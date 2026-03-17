'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  EMPTY_FINDING_FILTERS,
  FINDING_SEVERITY_OPTIONS,
  FINDING_STATUS_OPTIONS,
  hasFindingFilters,
  normalizeFindingFilters,
  parseFindingFilterList,
  type FindingFiltersState,
} from '@/lib/intelligence/finding-filters';
import { cn } from '@/lib/utils';
import { OpsCard } from './primitives';

interface FindingFiltersProps {
  filters: FindingFiltersState;
  onApply: (filters: FindingFiltersState) => void;
}

interface FindingFiltersDraft {
  severity: string[];
  typeInput: string;
  status: string[];
  dateFrom: string;
  dateTo: string;
  minConfidence: string;
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function createDraft(filters: FindingFiltersState): FindingFiltersDraft {
  return {
    severity: [...filters.severity],
    typeInput: filters.type.join(', '),
    status: [...filters.status],
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    minConfidence: filters.minConfidence,
  };
}

function humanizeValue(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDateValue(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? value : DATE_FORMATTER.format(parsed);
}

function toggleValue(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function compileDraft(draft: FindingFiltersDraft): FindingFiltersState {
  return normalizeFindingFilters({
    severity: draft.severity,
    type: parseFindingFilterList(draft.typeInput),
    status: draft.status,
    dateFrom: draft.dateFrom,
    dateTo: draft.dateTo,
    minConfidence: draft.minConfidence,
  });
}

function FilterToggleGroup({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = values.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition',
                active
                  ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-100'
                  : 'border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-2)] hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]',
              )}
            >
              {humanizeValue(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FindingFilters({ filters, onApply }: FindingFiltersProps) {
  const [draft, setDraft] = useState<FindingFiltersDraft>(() => createDraft(filters));

  useEffect(() => {
    setDraft(createDraft(filters));
  }, [filters.dateFrom, filters.dateTo, filters.minConfidence, filters.severity, filters.status, filters.type]);

  const activeFilters = hasFindingFilters(filters);
  const chips = [
    ...filters.severity.map((value) => ({
      key: `severity:${value}`,
      label: `Severity: ${humanizeValue(value)}`,
      nextFilters: normalizeFindingFilters({
        ...filters,
        severity: filters.severity.filter((entry) => entry !== value),
      }),
    })),
    ...filters.type.map((value) => ({
      key: `type:${value}`,
      label: `Type: ${humanizeValue(value)}`,
      nextFilters: normalizeFindingFilters({
        ...filters,
        type: filters.type.filter((entry) => entry !== value),
      }),
    })),
    ...filters.status.map((value) => ({
      key: `status:${value}`,
      label: `Status: ${humanizeValue(value)}`,
      nextFilters: normalizeFindingFilters({
        ...filters,
        status: filters.status.filter((entry) => entry !== value),
      }),
    })),
    ...(filters.dateFrom ? [{
      key: 'dateFrom',
      label: `From: ${formatDateValue(filters.dateFrom)}`,
      nextFilters: normalizeFindingFilters({
        ...filters,
        dateFrom: '',
      }),
    }] : []),
    ...(filters.dateTo ? [{
      key: 'dateTo',
      label: `To: ${formatDateValue(filters.dateTo)}`,
      nextFilters: normalizeFindingFilters({
        ...filters,
        dateTo: '',
      }),
    }] : []),
    ...(filters.minConfidence ? [{
      key: 'minConfidence',
      label: `Confidence >= ${Math.round(Number.parseFloat(filters.minConfidence) * 100)}%`,
      nextFilters: normalizeFindingFilters({
        ...filters,
        minConfidence: '',
      }),
    }] : []),
  ];

  return (
    <OpsCard className="space-y-4">
      <form
        className="grid gap-4 xl:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(compileDraft(draft));
        }}
      >
        <FilterToggleGroup
          label="Severity"
          options={FINDING_SEVERITY_OPTIONS}
          values={draft.severity}
          onToggle={(value) => setDraft((current) => ({
            ...current,
            severity: toggleValue(current.severity, value),
          }))}
        />

        <FilterToggleGroup
          label="Status"
          options={FINDING_STATUS_OPTIONS}
          values={draft.status}
          onToggle={(value) => setDraft((current) => ({
            ...current,
            status: toggleValue(current.status, value),
          }))}
        />

        <label className="space-y-1 text-sm">
          <span className="text-slate-400">Type</span>
          <input
            value={draft.typeInput}
            onChange={(event) => setDraft((current) => ({ ...current, typeInput: event.target.value }))}
            placeholder="Enter finding types"
            className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)]"
          />
          <span className="block text-xs text-[var(--vt-text-3)]">Comma-separated finding types</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">Date from</span>
            <input
              type="date"
              value={draft.dateFrom}
              onChange={(event) => setDraft((current) => ({ ...current, dateFrom: event.target.value }))}
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)]"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-400">Date to</span>
            <input
              type="date"
              value={draft.dateTo}
              onChange={(event) => setDraft((current) => ({ ...current, dateTo: event.target.value }))}
              className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)]"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="text-slate-400">Minimum confidence</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={draft.minConfidence}
            onChange={(event) => setDraft((current) => ({ ...current, minConfidence: event.target.value }))}
            placeholder="0.00 - 1.00"
            className="w-full rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-[var(--vt-text-1)] placeholder:text-[var(--vt-text-3)]"
          />
        </label>

        <div className="flex flex-wrap items-end gap-2 xl:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(createDraft(EMPTY_FINDING_FILTERS));
              onApply(EMPTY_FINDING_FILTERS);
            }}
            className="rounded-full border border-[var(--vt-border)] px-4 py-2 text-sm font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]"
          >
            Clear all
          </button>
        </div>
      </form>

      {activeFilters ? (
        <div className="space-y-3 border-t border-[var(--vt-border)] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-400">Active filters</p>
            <button
              type="button"
              onClick={() => {
                setDraft(createDraft(EMPTY_FINDING_FILTERS));
                onApply(EMPTY_FINDING_FILTERS);
              }}
              className="text-sm text-cyan-200 transition hover:text-cyan-100"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => onApply(chip.nextFilters)}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
              >
                <span>{chip.label}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </OpsCard>
  );
}
