'use client';

import { useCallback, useState } from 'react';
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

interface EvidenceViewerPanelProps {
  evidence: EvidenceItem[];
  findingId: string | null;
  /** Called when quality is submitted (fires POST /api/findings/:id/outcome) */
  onQualitySubmit?: (findingId: string, quality: EvidenceQuality) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const QUALITY_OPTIONS: { value: EvidenceQuality; label: string; desc: string }[] = [
  { value: 'STRONG',   label: 'Strong',   desc: 'Multiple corroborating primary sources' },
  { value: 'ADEQUATE', label: 'Adequate', desc: 'Single primary source with context' },
  { value: 'WEAK',     label: 'Weak',     desc: 'Secondary or inferred only' },
  { value: 'MISSING',  label: 'Missing',  desc: 'No supporting evidence' },
];

function qualityTone(q: EvidenceQuality): 'success' | 'info' | 'warning' | 'critical' {
  switch (q) {
    case 'STRONG':   return 'success';
    case 'ADEQUATE': return 'info';
    case 'WEAK':     return 'warning';
    case 'MISSING':  return 'critical';
  }
}

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

  const handleSubmitQuality = useCallback(async () => {
    if (!findingId || !selectedQuality) return;
    setSubmitting(true);
    try {
      if (onQualitySubmit) {
        onQualitySubmit(findingId, selectedQuality);
      } else {
        // Direct API call
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
    } catch {
      // Silent fail — non-critical
    } finally {
      setSubmitting(false);
    }
  }, [findingId, selectedQuality, onQualitySubmit]);

  if (evidence.length === 0) return null;

  return (
    <OpsCard className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--vt-text-3)]">
          Evidence ({evidence.length})
        </p>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-xs text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed ? (
        <div className="max-h-[320px] space-y-2 overflow-y-auto">
          {/* Evidence list */}
          {evidence.map((ev, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 transition hover:border-[var(--vt-text-3)]/30"
              >
                <button
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                >
                  {/* Source badge */}
                  <span className="shrink-0 rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--vt-text-2)]">
                    {ev.source}
                  </span>
                  {/* Claim text */}
                  <span className={`flex-1 text-xs text-[var(--vt-text-2)] ${isExpanded ? '' : 'truncate'}`}>
                    {ev.claim}
                  </span>
                  {/* Confidence */}
                  <span className="shrink-0">{confidenceBar(ev.confidence)}</span>
                  {/* Expand indicator */}
                  <span className="shrink-0 text-[10px] text-[var(--vt-text-3)]">
                    {isExpanded ? '▾' : '▸'}
                  </span>
                </button>

                {/* Expanded detail */}
                {isExpanded ? (
                  <div className="mt-3 space-y-2 border-t border-[var(--vt-border)] pt-3">
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                      <span className="text-[var(--vt-text-3)]">Source</span>
                      <span className="font-medium text-[var(--vt-text-1)]">{ev.source}</span>

                      <span className="text-[var(--vt-text-3)]">Value</span>
                      <span className="text-[var(--vt-text-2)]">{ev.claim}</span>

                      <span className="text-[var(--vt-text-3)]">Confidence</span>
                      <span className="tabular-nums text-[var(--vt-text-1)]">{Math.round(ev.confidence * 100)}%</span>

                      <span className="text-[var(--vt-text-3)]">Observed</span>
                      <span className="text-[var(--vt-text-2)]">
                        {ev.observedAt ? formatRelativeTime(ev.observedAt) : '—'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Evidence quality selector */}
          {findingId ? (
            <div className="border-t border-[var(--vt-border)] pt-3">
              <p className="mb-2 text-xs text-[var(--vt-text-3)]">Rate evidence quality:</p>
              <div className="flex flex-wrap gap-2">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedQuality(opt.value)}
                    title={opt.desc}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      selectedQuality === opt.value
                        ? 'border-cyan-400/60 bg-cyan-400/10 text-[var(--vt-text-1)]'
                        : 'border-[var(--vt-border)] text-[var(--vt-text-3)] hover:border-[var(--vt-text-3)]/40 hover:text-[var(--vt-text-2)]'
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
                  className="mt-2 rounded-full bg-cyan-400 px-4 py-1.5 text-xs font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : `Submit ${selectedQuality}`}
                </button>
              ) : null}
              {submitted ? (
                <p className="mt-2 text-xs text-emerald-400">
                  ✓ Evidence quality recorded
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </OpsCard>
  );
}
