'use client';

/**
 * TrustPostureCard — Phase 1
 *
 * Compact, explainable trust posture surface for PassportWallet and ReviewClient.
 * Fetches /api/trust/posture/[npi] and renders:
 *   • Score + band (L0–L3)
 *   • Top 3 contributing dimensions
 *   • Active gaps (top 3)
 *   • Freshness posture
 *   • Contradictions warning if any
 *
 * LABEL CONTRACT:
 *   - Never says "AI score", "credentialing approval", "privileges approved"
 *   - Always shows methodology version + computed timestamp
 *   - Gap and limit items are plain language
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info, Shield } from 'lucide-react';

// ── Types (mirrors TrustScoreV1 from backend) ─────────────────────────────────

type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';
type DimensionStatus =
  | 'VERIFIED' | 'ACTIVE' | 'CLEAR' | 'ENROLLED' | 'CERTIFIED'
  | 'PARTIAL' | 'STALE' | 'AGING' | 'FRESH' | 'UNKNOWN'
  | 'UNVERIFIED' | 'EXPIRED' | 'EXCLUDED' | 'NOT_CHECKED' | 'LAPSED';

interface DimensionScore {
  dimension:  string;
  status:     DimensionStatus;
  score:      number;
  maxScore:   number;
  weight:     number;
  label:      string;
  detail:     string;
  sources:    string[];
  staleness?: string | null;
  freshness?: string | null;
}

interface TrustPostureData {
  npi:          string;
  methodology:  string;
  computedAt:   string;
  score:        number;
  band:         TrustBand;
  bandLabel:    string;
  confidence:   number;
  dimensions:   Record<string, DimensionScore>;
  gaps:         string[];
  trustLimits:  string[];
  recommendations: string[];
  contradictions: Array<{ dimension: string; severity: string; message: string }>;
  totalPenalty: number;
}

// ── Band display config ────────────────────────────────────────────────────────

const BAND_CONFIG: Record<TrustBand, { label: string; color: string; bg: string; border: string }> = {
  L3: { label: 'Verified',    color: 'text-emerald-400', bg: 'bg-emerald-400/8',  border: 'border-emerald-400/20' },
  L2: { label: 'Credentialed',color: 'text-sky-400',     bg: 'bg-sky-400/8',     border: 'border-sky-400/20' },
  L1: { label: 'Partial',     color: 'text-amber-400',   bg: 'bg-amber-400/8',   border: 'border-amber-400/20' },
  L0: { label: 'Unverified',  color: 'text-white/40',    bg: 'bg-white/4',       border: 'border-white/10' },
};

const DIM_STATUS_ICON: Record<string, string> = {
  VERIFIED: '✓', ACTIVE: '✓', CLEAR: '✓', ENROLLED: '✓', CERTIFIED: '✓', FRESH: '✓',
  PARTIAL: '◐', STALE: '◔', AGING: '◔',
  UNKNOWN: '–', UNVERIFIED: '–', NOT_CHECKED: '–',
  EXPIRED: '✕', EXCLUDED: '✕', LAPSED: '✕',
};

const DIM_STATUS_COLOR: Record<string, string> = {
  VERIFIED: 'text-emerald-400', ACTIVE: 'text-emerald-400', CLEAR: 'text-emerald-400',
  ENROLLED: 'text-emerald-400', CERTIFIED: 'text-emerald-400', FRESH: 'text-emerald-400',
  PARTIAL: 'text-amber-400', STALE: 'text-amber-400', AGING: 'text-amber-400',
  UNKNOWN: 'text-white/30', UNVERIFIED: 'text-white/30', NOT_CHECKED: 'text-white/30',
  EXPIRED: 'text-red-400', EXCLUDED: 'text-red-400', LAPSED: 'text-red-400',
};

// Friendly names for dimension keys
const DIM_LABELS: Record<string, string> = {
  identity:  'Identity',
  licensure: 'Licensure',
  exclusion: 'Sanctions',
  enrollment:'Medicare enrollment',
  boardCert: 'Board certification',
  coverage:  'Source coverage',
  freshness: 'Data freshness',
  academic:  'Academic context',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

function useTrustPosture(npi: string | null) {
  const [data, setData] = useState<TrustPostureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!npi) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/trust/posture/${npi}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((d: TrustPostureData) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false); } });

    return () => { cancelled = true; };
  }, [npi]);

  return { data, loading, error };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TrustPostureCardProps {
  npi: string | null;
  /** Compact mode for ReviewClient — fewer dimensions, no recommendations */
  compact?: boolean;
}

export function TrustPostureCard({ npi, compact = false }: TrustPostureCardProps) {
  const { data, loading, error } = useTrustPosture(npi);

  if (!npi) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-4 space-y-2 animate-pulse">
        <div className="h-3 w-24 rounded bg-white/8" />
        <div className="h-6 w-16 rounded bg-white/6" />
        <div className="h-3 w-40 rounded bg-white/5" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/3 px-5 py-3 flex items-center gap-2 text-white/30 text-xs">
        <Shield className="h-3.5 w-3.5 shrink-0" />
        Trust posture unavailable
      </div>
    );
  }

  const band = (data.band ?? 'L0') as TrustBand;
  const bandCfg = BAND_CONFIG[band];

  // Top 3 dimensions by score contribution (excluding zero-weight)
  const dimEntries = Object.entries(data.dimensions ?? {})
    .filter(([, d]) => d.weight > 0)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, compact ? 3 : 5);

  const hasContradictions = data.contradictions?.length > 0;
  const topGaps = (data.gaps ?? []).slice(0, compact ? 2 : 3);
  const topRecs = compact ? [] : (data.recommendations ?? []).slice(0, 2);

  return (
    <div className={`rounded-2xl border ${bandCfg.border} ${bandCfg.bg} px-5 py-4 space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35 mb-1">
            Trust Posture
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tabular-nums ${bandCfg.color}`}>
              {data.score}
            </span>
            <span className="text-white/30 text-sm">/100</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${bandCfg.border} ${bandCfg.color}`}>
              {band} · {data.bandLabel}
            </span>
          </div>
          <p className="text-white/30 text-[10px] mt-1">
            Computed from verified primary sources — not an AI score or hiring decision
          </p>
        </div>
        <Shield className={`h-5 w-5 shrink-0 mt-0.5 ${bandCfg.color}`} />
      </div>

      {/* Contradiction warning */}
      {hasContradictions && (
        <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-amber-300 text-xs font-semibold">Source contradictions detected</p>
            <p className="text-amber-400/70 text-[10px] mt-0.5">
              {data.contradictions[0]?.message ?? 'Multiple sources disagree on one or more claims. Review required.'}
            </p>
          </div>
        </div>
      )}

      {/* Dimensions */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25 mb-2">
          Source dimensions
        </p>
        {dimEntries.map(([key, dim]) => {
          const icon = DIM_STATUS_ICON[dim.status] ?? '–';
          const iconColor = DIM_STATUS_COLOR[dim.status] ?? 'text-white/30';
          const pct = dim.maxScore > 0 ? Math.round((dim.score / dim.maxScore) * 100) : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className={`text-xs w-3 text-center shrink-0 ${iconColor}`}>{icon}</span>
              <span className="text-white/60 text-xs flex-1 truncate">
                {DIM_LABELS[key] ?? dim.dimension ?? key}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171' }}
                  />
                </div>
                <span className="text-white/25 text-[10px] tabular-nums w-8 text-right">{dim.score}/{dim.maxScore}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gaps */}
      {topGaps.length > 0 && (
        <div className="pt-2 border-t border-white/6 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25 mb-2">
            Gaps limiting score
          </p>
          {topGaps.map((gap, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/40">
              <span className="text-white/20 mt-0.5 shrink-0">—</span>
              <span>{gap}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations (non-compact only) */}
      {topRecs.length > 0 && (
        <div className="pt-2 border-t border-white/6 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25 mb-2">
            Actions that would improve posture
          </p>
          {topRecs.map((rec, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-white/50">
              <span className="text-sky-500/50 mt-0.5 shrink-0">→</span>
              <span>{rec}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer — explainability */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        <Clock className="h-3 w-3 text-white/20 shrink-0" />
        <p className="text-white/20 text-[10px]">
          {data.methodology} · computed {new Date(data.computedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ── EnrichmentBadge (Phase 3 companion) ──────────────────────────────────────

export type EnrichmentType = 'verified' | 'enrichment' | 'inferred' | 'review-required';

interface EnrichmentBadgeProps {
  type: EnrichmentType;
  label?: string;
}

const ENRICHMENT_CONFIG: Record<EnrichmentType, { color: string; bg: string; border: string; defaultLabel: string }> = {
  'verified':        { color: 'text-emerald-400', bg: 'bg-emerald-400/8',  border: 'border-emerald-400/20', defaultLabel: 'Verified' },
  'enrichment':      { color: 'text-sky-400',     bg: 'bg-sky-400/8',     border: 'border-sky-400/20',     defaultLabel: 'Contextual' },
  'inferred':        { color: 'text-amber-400',   bg: 'bg-amber-400/8',   border: 'border-amber-400/20',   defaultLabel: 'Inferred link' },
  'review-required': { color: 'text-white/50',    bg: 'bg-white/5',       border: 'border-white/10',       defaultLabel: 'Review required' },
};

export function EnrichmentBadge({ type, label }: EnrichmentBadgeProps) {
  const cfg = ENRICHMENT_CONFIG[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {label ?? cfg.defaultLabel}
    </span>
  );
}
