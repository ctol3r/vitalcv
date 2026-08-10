'use client';

import type { PassportData } from '@/lib/trust/passport-contract';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OpsCard, OpsBadge } from '../intelligence-ops/primitives';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import {
  classifyFreshness,
  classifySourceQuality,
  deriveEvidenceQuality,
  summarizeTrustSignals,
  type FreshnessMarker,
  type SourceQualityMarker,
} from '@/lib/intelligence/trust-signals';
import {
  normalizePassportSourceCoverageChecks,
  sourceCoverageBadgeLabel,
} from '@/lib/trust/source-coverage';
import { TrustSignalChips } from '../intelligence-ops/trust-signal-chips';

export interface EvidenceItem {
  source: string;
  claim: string;
  confidence: number;
  observedAt?: string | null;
  field?: string;
  provenanceChain?: string[];
  qualityRating?: EvidenceQuality;
  corroborationCount?: number;
}

export type EvidenceQuality = 'STRONG' | 'ADEQUATE' | 'WEAK' | 'MISSING';
type SortMode = 'confidence' | 'newest';
type GroupMode = 'none' | 'source';

interface EvidenceViewerPanelProps {
  evidence: EvidenceItem[];
  findingId: string | null;
  onQualitySubmit?: (findingId: string, quality: EvidenceQuality) => void;
  selectedEvidenceIndex?: number | null;
}

const QUALITY_OPTIONS: { value: EvidenceQuality; label: string; desc: string }[] = [
  { value: 'STRONG', label: 'Strong', desc: 'Multiple corroborating primary sources' },
  { value: 'ADEQUATE', label: 'Adequate', desc: 'Single primary source with context' },
  { value: 'WEAK', label: 'Weak', desc: 'Secondary or inferred only' },
  { value: 'MISSING', label: 'Missing', desc: 'No supporting evidence' },
];

function confidenceBar(confidence: number) {
  const pct = Math.round(confidence * 100);
  const bg = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-slate-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--vt-surface-2)]">
        <div className={`h-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-[var(--vt-text-3)]">{pct}%</span>
    </div>
  );
}

function summarizeEvidence(evidence: EvidenceItem[]): string {
  const sources = new Set(evidence.map((item) => item.source));
  const avgConf = evidence.length > 0
    ? Math.round((evidence.reduce((sum, item) => sum + item.confidence, 0) / evidence.length) * 100)
    : 0;
  const corroborationCount = evidence.some((item) => typeof item.corroborationCount === 'number')
    ? Math.max(...evidence.map((item) => item.corroborationCount ?? 0))
    : Math.max(0, sources.size - 1);

  return `${sources.size} source${sources.size === 1 ? '' : 's'} · ${evidence.length} record${evidence.length === 1 ? '' : 's'} · ${corroborationCount} corroborations · ${avgConf}% avg confidence`;
}

function sortEvidence(items: EvidenceRow[], mode: SortMode): EvidenceRow[] {
  return [...items].sort((left, right) => {
    if (mode === 'confidence') {
      return right.confidence - left.confidence;
    }

    const leftTs = left.observedAt ? new Date(left.observedAt).getTime() : 0;
    const rightTs = right.observedAt ? new Date(right.observedAt).getTime() : 0;
    return rightTs - leftTs;
  });
}

function groupBySource(items: EvidenceRow[]): Map<string, EvidenceRow[]> {
  const groups = new Map<string, EvidenceRow[]>();
  for (const item of items) {
    const group = groups.get(item.source) ?? [];
    group.push(item);
    groups.set(item.source, group);
  }
  return groups;
}

type EvidenceRow = EvidenceItem & {
  field: string;
  qualityRating: EvidenceQuality;
  corroborationCount: number;
  provenanceChain: string[];
  freshness: FreshnessMarker;
  sourceQuality: SourceQualityMarker;
};

function normalizeEvidenceItem(item: EvidenceItem, sourceCount: number): EvidenceRow {
  const field = item.field?.trim() ? item.field.trim() : 'Claim';
  const corroborationCount = item.corroborationCount ?? Math.max(0, sourceCount - 1);
  const sourceQuality = classifySourceQuality(item.source);

  return {
    ...item,
    field,
    qualityRating: item.qualityRating ?? deriveEvidenceQuality({
      confidence: item.confidence,
      corroborationCount,
      sourceQuality,
    }),
    corroborationCount,
    provenanceChain: item.provenanceChain?.length
      ? item.provenanceChain
      : [item.source, field, 'finding context'],
    freshness: classifyFreshness(item.observedAt),
    sourceQuality,
  };
}

function badgeToneForQuality(value: EvidenceQuality): 'success' | 'warning' | 'critical' | 'neutral' | 'info' {
  switch (value) {
    case 'STRONG':
      return 'success';
    case 'ADEQUATE':
      return 'info';
    case 'WEAK':
      return 'warning';
    case 'MISSING':
    default:
      return 'neutral';
  }
}

function badgeToneForFreshness(value: FreshnessMarker): 'success' | 'warning' | 'critical' | 'neutral' {
  switch (value) {
    case 'FRESH':
      return 'success';
    case 'AGING':
      return 'warning';
    case 'STALE':
      return 'critical';
    case 'UNKNOWN':
    default:
      return 'neutral';
  }
}

function badgeToneForSourceQuality(value: SourceQualityMarker): 'success' | 'warning' | 'critical' | 'neutral' | 'info' {
  switch (value) {
    case 'AUTHORITATIVE':
      return 'success';
    case 'DERIVED':
      return 'warning';
    case 'MIXED':
      return 'info';
    case 'UNKNOWN':
    default:
      return 'neutral';
  }
}

export function EvidenceViewer({
  evidence,
  findingId,
  onQualitySubmit,
  selectedEvidenceIndex = null,
}: EvidenceViewerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<EvidenceQuality | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  /** The server refused, or never answered. Nothing was recorded. */
  const [submitFailed, setSubmitFailed] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('confidence');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');

  const normalizedEvidence = useMemo(() => {
    const sourceCount = new Set(evidence.map((item) => item.source)).size;
    return evidence.map((item) => normalizeEvidenceItem(item, sourceCount));
  }, [evidence]);
  const sorted = useMemo(() => sortEvidence(normalizedEvidence, sortMode), [normalizedEvidence, sortMode]);
  const grouped = useMemo(() => groupMode === 'source' ? groupBySource(sorted) : null, [sorted, groupMode]);
  const summary = useMemo(() => summarizeEvidence(normalizedEvidence), [normalizedEvidence]);
  const trustSummary = useMemo(
    () => summarizeTrustSignals(normalizedEvidence.map((item) => ({
      source: item.source,
      observedAt: item.observedAt,
      confidence: item.confidence,
      qualityRating: item.qualityRating,
      corroborationCount: item.corroborationCount,
      sourceQuality: item.sourceQuality,
    }))),
    [normalizedEvidence],
  );

  useEffect(() => {
    if (typeof selectedEvidenceIndex !== 'number') {
      return;
    }

    if (selectedEvidenceIndex < 0 || selectedEvidenceIndex >= evidence.length) {
      return;
    }

    setExpandedIdx(selectedEvidenceIndex);
    setCollapsed(false);
  }, [evidence.length, selectedEvidenceIndex]);

  const handleSubmitQuality = useCallback(async () => {
    if (!findingId || !selectedQuality) {
      return;
    }

    setSubmitting(true);
    setSubmitFailed(false);
    try {
      if (onQualitySubmit) {
        onQualitySubmit(findingId, selectedQuality);
      } else {
        const response = await fetch(`/api/findings/${findingId}/outcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcome: 'MONITORING',
            evidenceQuality: selectedQuality,
            analystNote: `Evidence quality rated ${selectedQuality} from workbench`,
          }),
        });
        // A non-2xx means the rating was NOT recorded. Falling through to
        // `setSubmitted(true)` would tell an analyst their assessment was
        // captured when the server refused it — the no-fabricated-outcome
        // contract, same defect this codebase just removed from the employer
        // review path (#1277).
        if (!response.ok) {
          setSubmitFailed(true);
          return;
        }
      }
      setSubmitted(true);
    } catch {
      // A thrown fetch means nothing reached the server, so nothing was
      // recorded. Say so rather than staying silent — silence here reads as
      // success, because the button simply stops responding.
      setSubmitFailed(true);
    } finally {
      setSubmitting(false);
    }
  }, [findingId, onQualitySubmit, selectedQuality]);

  if (evidence.length === 0) {
    return (
      <OpsCard className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--vt-text-1)]">Evidence unavailable</p>
            <p className="mt-1 text-sm leading-6 text-[var(--vt-text-2)]">
              No evidence items are attached to this finding yet, so there is nothing to inspect in this panel.
            </p>
          </div>
          <OpsBadge label="support state" tone="warning" />
        </div>
        <p className="text-sm leading-6 text-[var(--vt-text-3)]">
          Next step: return to the active finding or provider context and retry after evidence ingestion completes.
          {findingId ? ` Finding ${findingId} is still live, but its evidence payload is empty.` : ''}
        </p>
      </OpsCard>
    );
  }

  function renderEvidenceRow(item: EvidenceRow, idx: number) {
    const isExpanded = expandedIdx === idx;

    return (
      <div
        key={idx}
        className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-2.5 transition-all duration-120 hover:border-[var(--vt-text-3)]/30"
      >
        <button
          className="flex w-full items-center gap-2.5 text-left"
          onClick={() => setExpandedIdx(isExpanded ? null : idx)}
        >
          <span className="shrink-0 rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--vt-text-2)]">
            {item.source}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-3)]">{item.field}</p>
            <span className={`block text-xs text-[var(--vt-text-2)] ${isExpanded ? '' : 'truncate'}`}>{item.claim}</span>
          </div>
          <span className="shrink-0">
            <OpsBadge label={item.qualityRating.toLowerCase()} tone={badgeToneForQuality(item.qualityRating)} />
          </span>
          <span className="shrink-0">{confidenceBar(item.confidence)}</span>
          <span
            className="shrink-0 text-[10px] text-[var(--vt-text-3)] transition-transform duration-120"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
          >
            ▸
          </span>
        </button>
        {isExpanded ? (
          <div className="mt-2.5 space-y-2 border-t border-[var(--vt-border)] pt-2.5 transition-opacity duration-120">
            <div className="flex flex-wrap gap-1.5">
              <OpsBadge label={item.freshness.toLowerCase()} tone={badgeToneForFreshness(item.freshness)} />
              <OpsBadge label={item.sourceQuality.toLowerCase()} tone={badgeToneForSourceQuality(item.sourceQuality)} />
              <OpsBadge label={`${item.corroborationCount} corroborations`} tone={item.corroborationCount > 0 ? 'success' : 'neutral'} />
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <span className="text-[var(--vt-text-3)]">Source</span>
              <span className="font-medium text-[var(--vt-text-1)]">{item.source}</span>
              <span className="text-[var(--vt-text-3)]">Field</span>
              <span className="text-[var(--vt-text-2)]">{item.field}</span>
              <span className="text-[var(--vt-text-3)]">Value</span>
              <span className="text-[var(--vt-text-2)]">{item.claim}</span>
              <span className="text-[var(--vt-text-3)]">Confidence</span>
              <span className="tabular-nums text-[var(--vt-text-1)]">{Math.round(item.confidence * 100)}%</span>
              <span className="text-[var(--vt-text-3)]">Retrieved</span>
              <span className="text-[var(--vt-text-2)]">
                {item.observedAt ? (
                  <>
                    <span title={formatAbsoluteTime(item.observedAt)}>{formatRelativeTime(item.observedAt)}</span>
                    <span className="block text-[10px] text-[var(--vt-text-3)]">{formatAbsoluteTime(item.observedAt)}</span>
                  </>
                ) : '—'}
              </span>
              <span className="text-[var(--vt-text-3)]">Provenance</span>
              <span className="text-[var(--vt-text-2)]">{item.provenanceChain.join(' → ')}</span>
              <span className="text-[var(--vt-text-3)]">Quality rating</span>
              <span className="text-[var(--vt-text-2)]">{item.qualityRating}</span>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <OpsCard className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Evidence ({evidence.length})</p>
          <p className="mt-0.5 text-[10px] text-[var(--vt-text-3)]">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--vt-border)] text-[10px]">
            <button
              onClick={() => setSortMode('confidence')}
              className={`px-2 py-1 transition ${sortMode === 'confidence' ? 'bg-cyan-400/10 text-[var(--vt-text-1)]' : 'text-[var(--vt-text-3)]'}`}
            >
              Confidence
            </button>
            <button
              onClick={() => setSortMode('newest')}
              className={`px-2 py-1 transition ${sortMode === 'newest' ? 'bg-cyan-400/10 text-[var(--vt-text-1)]' : 'text-[var(--vt-text-3)]'}`}
            >
              Newest
            </button>
          </div>
          <button
            onClick={() => setGroupMode((current) => current === 'none' ? 'source' : 'none')}
            className={`rounded-lg border border-[var(--vt-border)] px-2 py-1 text-[10px] transition ${groupMode === 'source' ? 'bg-cyan-400/10 text-[var(--vt-text-1)]' : 'text-[var(--vt-text-3)]'}`}
          >
            Group
          </button>
          <button
            onClick={() => setCollapsed((current) => !current)}
            className="text-xs text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>

      <TrustSignalChips summary={trustSummary} />

      {!collapsed ? (
        <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
          {grouped ? (
            [...grouped.entries()].map(([source, items]) => (
              <div key={source} className="space-y-1">
                <p className="px-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--vt-text-3)]">
                  {source} ({items.length})
                </p>
                {items.map((item, idx) => renderEvidenceRow(item, sorted.indexOf(item)))}
              </div>
            ))
          ) : (
            sorted.map((item, idx) => renderEvidenceRow(item, idx))
          )}

          {findingId ? (
            <div className="border-t border-[var(--vt-border)] pt-2.5">
              <p className="mb-1.5 text-xs text-[var(--vt-text-3)]">Rate evidence quality:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUALITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedQuality(option.value)}
                    title={option.desc}
                    className={`rounded-full border px-2.5 py-1 text-[10px] transition ${
                      selectedQuality === option.value
                        ? 'border-cyan-400/60 bg-cyan-400/10 text-[var(--vt-text-1)]'
                        : 'border-[var(--vt-border)] text-[var(--vt-text-3)] hover:border-[var(--vt-text-3)]/40'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {selectedQuality && !submitted ? (
                <button
                  onClick={() => void handleSubmitQuality()}
                  disabled={submitting}
                  className="mt-1.5 rounded-full bg-cyan-400 px-3 py-1 text-[10px] font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : `Submit ${selectedQuality}`}
                </button>
              ) : null}
              {submitted ? <p className="mt-1 text-[10px] text-emerald-400">✓ Evidence quality recorded</p> : null}
              {submitFailed ? (
                <p className="mt-1 text-[10px] text-amber-400" role="status">
                  Not recorded — the rating did not reach the server. Try again.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </OpsCard>
  );
}

function passportCoverageClaim(
  state: ReturnType<typeof normalizePassportSourceCoverageChecks>[number]['state'],
): string {
  if (state === 'checked') {
    return `${sourceCoverageBadgeLabel({ state, decisionGrade: true })}.`;
  }

  return `${sourceCoverageBadgeLabel({ state, decisionGrade: false })}.`;
}

export function passportEvidenceItems(passport: PassportData): EvidenceItem[] {
  return normalizePassportSourceCoverageChecks(passport.sourceCoverage).map((entry) => ({
      source: entry.sourceId,
      field: 'Source coverage',
      claim: passportCoverageClaim(entry.state),
      confidence: entry.state === 'checked' ? 0.92 : 0.56,
      observedAt: entry.checkedAt ?? null,
      provenanceChain: [entry.sourceId, 'sourceCoverage'],
      qualityRating: entry.state === 'checked' ? 'ADEQUATE' : 'WEAK',
      corroborationCount: 0,
  }));
}
