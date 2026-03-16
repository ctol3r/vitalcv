'use client';

import { useCallback, useMemo, useState } from 'react';
import { OpsCard, OpsBadge } from './primitives';
import { formatRelativeTime } from '@/lib/intelligence/time';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  source: string;
  claim: string;
  confidence: number;
  observedAt?: string | null;
}

export type EvidenceQuality = 'STRONG' | 'ADEQUATE' | 'WEAK' | 'MISSING';
type SortMode = 'confidence' | 'newest';
type GroupMode = 'none' | 'source';

interface EvidenceViewerPanelProps {
  evidence: EvidenceItem[];
  findingId: string | null;
  onQualitySubmit?: (findingId: string, quality: EvidenceQuality) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const QUALITY_OPTIONS: { value: EvidenceQuality; label: string; desc: string }[] = [
  { value: 'STRONG',   label: 'Strong',   desc: 'Multiple corroborating primary sources' },
  { value: 'ADEQUATE', label: 'Adequate', desc: 'Single primary source with context' },
  { value: 'WEAK',     label: 'Weak',     desc: 'Secondary or inferred only' },
  { value: 'MISSING',  label: 'Missing',  desc: 'No supporting evidence' },
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
  const sources = new Set(evidence.map(e => e.source));
  const avgConf = evidence.length > 0
    ? Math.round(evidence.reduce((s, e) => s + e.confidence, 0) / evidence.length * 100)
    : 0;
  const highConf = evidence.filter(e => e.confidence >= 0.8).length;
  return `${sources.size} source${sources.size === 1 ? '' : 's'} · ${evidence.length} record${evidence.length === 1 ? '' : 's'} · ${avgConf}% avg confidence${highConf > 0 ? ` · ${highConf} high-confidence` : ''}`;
}

function sortEvidence(items: EvidenceItem[], mode: SortMode): EvidenceItem[] {
  return [...items].sort((a, b) => {
    if (mode === 'confidence') return b.confidence - a.confidence;
    // newest: by observedAt descending
    const ta = a.observedAt ? new Date(a.observedAt).getTime() : 0;
    const tb = b.observedAt ? new Date(b.observedAt).getTime() : 0;
    return tb - ta;
  });
}

function groupBySource(items: EvidenceItem[]): Map<string, EvidenceItem[]> {
  const groups = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const group = groups.get(item.source) ?? [];
    group.push(item);
    groups.set(item.source, group);
  }
  return groups;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EvidenceViewerPanel({
  evidence,
  findingId,
  onQualitySubmit,
}: EvidenceViewerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<EvidenceQuality | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('confidence');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');

  const sorted = useMemo(() => sortEvidence(evidence, sortMode), [evidence, sortMode]);
  const grouped = useMemo(() => groupMode === 'source' ? groupBySource(sorted) : null, [sorted, groupMode]);
  const summary = useMemo(() => summarizeEvidence(evidence), [evidence]);

  const handleSubmitQuality = useCallback(async () => {
    if (!findingId || !selectedQuality) return;
    setSubmitting(true);
    try {
      if (onQualitySubmit) {
        onQualitySubmit(findingId, selectedQuality);
      } else {
        await fetch(`/api/findings/${findingId}/outcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcome: 'MONITORING',
            evidenceQuality: selectedQuality,
            analystNote: `Evidence quality rated ${selectedQuality} from workbench`,
          }),
        });
      }
      setSubmitted(true);
    } catch { /* silent */ } finally {
      setSubmitting(false);
    }
  }, [findingId, selectedQuality, onQualitySubmit]);

  if (evidence.length === 0) return null;

  function renderEvidenceRow(ev: EvidenceItem, idx: number) {
    const isExpanded = expandedIdx === idx;
    return (
      <div
        key={idx}
        className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-2.5 transition-all duration-120 hover:border-[var(--vt-text-3)]/30"
      >
        <button className="flex w-full items-center gap-2.5 text-left" onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
          <span className="shrink-0 rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--vt-text-2)]">
            {ev.source}
          </span>
          <span className={`flex-1 text-xs text-[var(--vt-text-2)] ${isExpanded ? '' : 'truncate'}`}>{ev.claim}</span>
          <span className="shrink-0">{confidenceBar(ev.confidence)}</span>
          <span className="shrink-0 text-[10px] text-[var(--vt-text-3)] transition-transform duration-120" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▸</span>
        </button>
        {isExpanded ? (
          <div className="mt-2.5 space-y-2 border-t border-[var(--vt-border)] pt-2.5 transition-opacity duration-120">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <span className="text-[var(--vt-text-3)]">Source</span>
              <span className="font-medium text-[var(--vt-text-1)]">{ev.source}</span>
              <span className="text-[var(--vt-text-3)]">Value</span>
              <span className="text-[var(--vt-text-2)]">{ev.claim}</span>
              <span className="text-[var(--vt-text-3)]">Confidence</span>
              <span className="tabular-nums text-[var(--vt-text-1)]">{Math.round(ev.confidence * 100)}%</span>
              <span className="text-[var(--vt-text-3)]">Observed</span>
              <span className="text-[var(--vt-text-2)]">{ev.observedAt ? formatRelativeTime(ev.observedAt) : '—'}</span>
            </div>
            <div className="flex gap-2">
              <button className="rounded-full border border-[var(--vt-border)] px-2.5 py-1 text-[10px] text-[var(--vt-text-3)] transition hover:border-cyan-400/40 hover:text-cyan-400">
                Pin to storyline
              </button>
              <button className="rounded-full border border-[var(--vt-border)] px-2.5 py-1 text-[10px] text-[var(--vt-text-3)] transition hover:border-amber-400/40 hover:text-amber-400">
                Flag for re-check
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <OpsCard className="space-y-2.5">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">Evidence ({evidence.length})</p>
          <p className="mt-0.5 text-[10px] text-[var(--vt-text-3)]">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sort toggle */}
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
          {/* Group toggle */}
          <button
            onClick={() => setGroupMode(g => g === 'none' ? 'source' : 'none')}
            className={`rounded-lg border border-[var(--vt-border)] px-2 py-1 text-[10px] transition ${groupMode === 'source' ? 'bg-cyan-400/10 text-[var(--vt-text-1)]' : 'text-[var(--vt-text-3)]'}`}
          >
            Group
          </button>
          {/* Collapse */}
          <button onClick={() => setCollapsed(c => !c)} className="text-xs text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]">
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
          {grouped ? (
            // Grouped by source
            [...grouped.entries()].map(([source, items]) => (
              <div key={source} className="space-y-1">
                <p className="px-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--vt-text-3)]">{source} ({items.length})</p>
                {items.map((ev, idx) => renderEvidenceRow(ev, sorted.indexOf(ev)))}
              </div>
            ))
          ) : (
            // Flat list
            sorted.map((ev, idx) => renderEvidenceRow(ev, idx))
          )}

          {/* Quality selector */}
          {findingId ? (
            <div className="border-t border-[var(--vt-border)] pt-2.5">
              <p className="mb-1.5 text-xs text-[var(--vt-text-3)]">Rate evidence quality:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedQuality(opt.value)}
                    title={opt.desc}
                    className={`rounded-full border px-2.5 py-1 text-[10px] transition ${
                      selectedQuality === opt.value
                        ? 'border-cyan-400/60 bg-cyan-400/10 text-[var(--vt-text-1)]'
                        : 'border-[var(--vt-border)] text-[var(--vt-text-3)] hover:border-[var(--vt-text-3)]/40'
                    }`}
                  >
                    {opt.label}
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
            </div>
          ) : null}
        </div>
      ) : null}
    </OpsCard>
  );
}
