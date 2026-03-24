'use client';

import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';

export interface SourceCoverageTagProps {
  source: string;
  status: 'live' | 'gated' | 'access-required' | 'unavailable';
  decisionGrade: boolean;
  lastChecked?: string;
}

type CoverageTone = {
  container: string;
  dot: string;
  badge: string;
  label: string;
};

function resolveTone(status: SourceCoverageTagProps['status'], decisionGrade: boolean): CoverageTone {
  if (status === 'live' && decisionGrade) {
    return {
      container: 'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-text-1)]',
      dot: 'bg-[var(--vt-success)]',
      badge: 'border-[var(--vt-badge-success-border)] bg-[var(--vt-surface)] text-[var(--vt-badge-success-text)]',
      label: 'Decision grade',
    };
  }

  if (status === 'live') {
    return {
      container: 'border-[var(--vt-badge-warning-border)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-text-1)]',
      dot: 'bg-[var(--vt-warning)]',
      badge: 'border-[var(--vt-badge-warning-border)] bg-[var(--vt-surface)] text-[var(--vt-badge-warning-text)]',
      label: 'Not decision-grade',
    };
  }

  if (status === 'gated') {
    return {
      container: 'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)]',
      dot: 'bg-[var(--vt-text-3)]',
      badge: 'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-surface)] text-[var(--vt-badge-neutral-text)]',
      label: 'Gated — env flag off',
    };
  }

  if (status === 'access-required') {
    return {
      container: 'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)]',
      dot: 'bg-[var(--vt-text-3)]',
      badge: 'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-surface)] text-[var(--vt-badge-neutral-text)]',
      label: 'Access required',
    };
  }

  return {
    container: 'border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] text-[var(--vt-text-1)]',
    dot: 'bg-[var(--vt-critical)]',
    badge: 'border-[var(--vt-badge-critical-border)] bg-[var(--vt-surface)] text-[var(--vt-badge-critical-text)]',
    label: 'Unavailable',
  };
}

function hasRenderableTimestamp(value?: string): value is string {
  return Boolean(value) && formatAbsoluteTime(value) !== 'Unknown';
}

export function SourceCoverageTag({
  source,
  status,
  decisionGrade,
  lastChecked,
}: SourceCoverageTagProps) {
  const tone = resolveTone(status, decisionGrade);
  const showTimestamp = hasRenderableTimestamp(lastChecked);

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${tone.container}`}>
      <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden="true" />
      <span className="font-medium text-[var(--vt-text-1)]">{source}</span>
      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${tone.badge}`}>
        {tone.label}
      </span>
      {showTimestamp ? (
        <span
          className="text-[10px] text-[var(--vt-text-3)]"
          title={formatAbsoluteTime(lastChecked)}
        >
          {formatRelativeTime(lastChecked)}
        </span>
      ) : null}
    </div>
  );
}

export default SourceCoverageTag;
