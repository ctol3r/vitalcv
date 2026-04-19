'use client';

/**
 * AcceptancePredictor.tsx — Acceptance Graph & Decision Learning (UI reveal)
 *
 * A compact indicator that shows the clinician how a specific employer
 * (and the broader network of similar employers) has historically
 * responded to the clinician's current readiness state.
 *
 * Deliberately non-deceptive:
 *   - Never displays a percentage when the backend returns
 *     `acceptanceRate: null` (i.e. insufficient history).
 *   - BLOCKER state is visually distinct — it's a policy floor, not a
 *     prediction, and the UI makes that clear.
 *   - The top gap boost is only shown when the backend passes a
 *     sample-size gate (see GAP_MIN_SAMPLE in acceptanceGraph.ts).
 */

import { AlertTriangle, Info, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getApiBase } from '@/lib/api';

type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'BLOCKER';

interface GapBoost {
  credential: string;
  boostPct: number;
  sampleSize: number;
}

interface Prediction {
  confidence: Confidence;
  acceptanceRate: number | null;
  reasons: string[];
  gapBoosts: GapBoost[];
  basedOn: {
    employerHistoryCount: number;
    networkNeighborsCount: number;
  };
}

export interface AcceptancePredictorProps {
  employerId: string;
  /** Role or specialty string — used for network-neighbor matching */
  specialty?: string;
  state?: string;
  readinessBand?: 'L0' | 'L1' | 'L2' | 'L3';
  credentialTypes?: string[];
  /** Optional compact layout for dense card grids */
  compact?: boolean;
}

const CONFIDENCE_CONFIG: Record<Confidence, {
  label: string;
  ringClass: string;
  textClass: string;
  bgClass: string;
  icon: typeof Sparkles;
}> = {
  HIGH: {
    label: 'Strong match',
    ringClass: 'border-emerald-500/30',
    textClass: 'text-emerald-300',
    bgClass: 'bg-emerald-500/10',
    icon: Sparkles,
  },
  MEDIUM: {
    label: 'Network signal',
    ringClass: 'border-sky-500/30',
    textClass: 'text-sky-300',
    bgClass: 'bg-sky-500/10',
    icon: TrendingUp,
  },
  LOW: {
    label: 'Limited history',
    ringClass: 'border-amber-500/30',
    textClass: 'text-amber-300',
    bgClass: 'bg-amber-500/10',
    icon: Info,
  },
  BLOCKER: {
    label: 'Missing requirement',
    ringClass: 'border-rose-500/30',
    textClass: 'text-rose-300',
    bgClass: 'bg-rose-500/10',
    icon: AlertTriangle,
  },
};

function formatCredentialLabel(code: string): string {
  return code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AcceptancePredictor({
  employerId,
  specialty,
  state,
  readinessBand,
  credentialTypes,
  compact = false,
}: AcceptancePredictorProps) {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Credential types are an array prop; serialize for stable dep identity.
  const credentialKey = (credentialTypes ?? []).join(',');
  // Ignore the stale-closure warning for credentialKey — it's the stable form of credentialTypes.
  const lastKey = useRef('');

  useEffect(() => {
    const key = `${employerId}|${specialty ?? ''}|${state ?? ''}|${readinessBand ?? ''}|${credentialKey}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ employerId });
    if (specialty) params.set('specialty', specialty);
    if (state) params.set('state', state);
    if (readinessBand) params.set('readinessBand', readinessBand);
    if (credentialKey) params.set('credentialTypes', credentialKey);

    fetch(`${getApiBase()}/api/acceptance/predict?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ prediction: Prediction }>;
      })
      .then((data) => {
        if (cancelled) return;
        setPrediction(data.prediction);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load prediction');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employerId, specialty, state, readinessBand, credentialKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground animate-pulse">
        <Sparkles className="h-3 w-3" />
        <span>Reading the acceptance graph…</span>
      </div>
    );
  }

  if (error || !prediction) {
    // Soft failure — the card is still usable without the predictor.
    return null;
  }

  const cfg = CONFIDENCE_CONFIG[prediction.confidence];
  const Icon = cfg.icon;
  const topBoost = prediction.gapBoosts[0];

  const primary = (() => {
    if (prediction.confidence === 'BLOCKER') {
      return prediction.reasons[0] ?? 'Blocked — a mandatory credential is missing';
    }
    if (prediction.acceptanceRate === null) {
      return 'Building acceptance history for this state';
    }
    const pct = Math.round(prediction.acceptanceRate * 100);
    const sample = prediction.basedOn.employerHistoryCount > 0
      ? prediction.basedOn.employerHistoryCount
      : prediction.basedOn.networkNeighborsCount;
    return `${pct}% historical acceptance · ${sample} similar ${sample === 1 ? 'decision' : 'decisions'}`;
  })();

  return (
    <div
      className={`rounded-xl border ${cfg.ringClass} ${cfg.bgClass} ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'} space-y-1.5`}
      data-testid="acceptance-predictor"
      data-confidence={prediction.confidence}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${cfg.textClass}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.textClass}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs text-foreground/80 leading-snug">{primary}</p>
      {topBoost && prediction.confidence !== 'BLOCKER' && (
        <p className="text-[11px] text-muted-foreground">
          Adding <span className="font-semibold text-foreground">{formatCredentialLabel(topBoost.credential)}</span>{' '}
          lifts network acceptance by <span className="font-semibold text-emerald-400">+{topBoost.boostPct}%</span>
          {topBoost.sampleSize ? ` (n=${topBoost.sampleSize})` : ''}
        </p>
      )}
    </div>
  );
}
