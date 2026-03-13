'use client';

/**
 * TrustStatePanel.tsx — Wave 243: Trust State Engine
 *
 * Comprehensive trust state display for a clinician (by NPI).
 * - Trust band badge (L0–L3) with color coding
 * - Trust score 0–100 horizontal bar
 * - Evidence checklist
 * - Gaps section
 * - Refresh button (optional — hidden for read-only views)
 *
 * Dark theme (#080e1a), glass card style. Compact for sidebar placement.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';
type LicensureStatus = 'verified' | 'pending' | 'expired' | 'unknown';

interface CanonicalFactSummary {
  factType: string;
  source: string;
  status: string;
  verifiedAt?: string;
  expiresAt?: string;
  details?: string;
}

interface ClinicianTrustState {
  npi: string;
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  credentialCount: number;
  trustBand: TrustBand;
  trustScore: number;
  facts: CanonicalFactSummary[];
  gaps: string[];
  computedAt: string;
  cached?: boolean;
}

// ── Band config ───────────────────────────────────────────────────────────────

const BAND_CONFIG: Record<
  TrustBand,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    barColor: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  L3: {
    label: 'Authoritative',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/40',
    borderColor: 'border-emerald-800/50',
    barColor: 'bg-emerald-400',
    icon: ShieldCheck,
  },
  L2: {
    label: 'Trusted',
    color: 'text-sky-400',
    bgColor: 'bg-sky-950/40',
    borderColor: 'border-sky-800/50',
    barColor: 'bg-sky-400',
    icon: Shield,
  },
  L1: {
    label: 'Provisional',
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/40',
    borderColor: 'border-amber-800/50',
    barColor: 'bg-amber-400',
    icon: ShieldAlert,
  },
  L0: {
    label: 'Untrusted',
    color: 'text-red-400',
    bgColor: 'bg-red-950/40',
    borderColor: 'border-red-800/50',
    barColor: 'bg-red-500',
    icon: ShieldX,
  },
};

// ── Licensure status helpers ──────────────────────────────────────────────────

function LicensureIcon({ status }: { status: LicensureStatus }) {
  if (status === 'verified') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />;
  if (status === 'pending') return <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />;
  if (status === 'expired') return <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />;
}

function licensureLabel(status: LicensureStatus): string {
  if (status === 'verified') return 'Licensure verified';
  if (status === 'pending') return 'Licensure pending';
  if (status === 'expired') return 'Licensure expired';
  return 'Licensure unknown';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TrustStatePanelProps {
  /** Clinician NPI (10 digits) */
  npi: string;
  /** If true, hides the Refresh button */
  readOnly?: boolean;
  /** Optional className override for the outer wrapper */
  className?: string;
}

export function TrustStatePanel({ npi, readOnly = false, className = '' }: TrustStatePanelProps) {
  const [state, setState] = useState<ClinicianTrustState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFacts, setShowFacts] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      if (force) {
        setRefreshing(true);
        const res = await fetch(`/api/trust-state/${npi}/refresh`, { method: 'POST' });
        if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
        const data = await res.json() as ClinicianTrustState;
        setState(data);
      } else {
        setLoading(true);
        const res = await fetch(`/api/trust-state/${npi}`);
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const data = await res.json() as ClinicianTrustState;
        setState(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trust state');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [npi]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Loading ──
  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-zinc-800/60 bg-[#080e1a]/80 backdrop-blur-sm p-4 animate-pulse ${className}`}
      >
        <div className="h-5 w-32 bg-zinc-800 rounded mb-3" />
        <div className="h-3 w-full bg-zinc-800/60 rounded mb-2" />
        <div className="h-3 w-3/4 bg-zinc-800/60 rounded" />
      </div>
    );
  }

  // ── Error ──
  if (error || !state) {
    return (
      <div
        className={`rounded-2xl border border-red-900/40 bg-red-950/20 p-4 ${className}`}
      >
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error ?? 'Trust state unavailable'}</span>
        </div>
        {!readOnly && (
          <button
            onClick={() => void load()}
            className="mt-3 text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const band = BAND_CONFIG[state.trustBand];
  const BandIcon = band.icon;

  return (
    <div
      className={`rounded-2xl border ${band.borderColor} ${band.bgColor} backdrop-blur-sm overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <BandIcon className={`h-5 w-5 ${band.color}`} />
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${band.color} ${band.borderColor} bg-black/20`}
              >
                {state.trustBand}
              </span>
              <span className={`text-sm font-semibold ${band.color}`}>{band.label}</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              NPI {state.npi} · Updated {new Date(state.computedAt).toLocaleDateString()}
              {state.cached ? ' (cached)' : ''}
            </p>
          </div>
        </div>

        {!readOnly && (
          <button
            onClick={() => void load(true)}
            disabled={refreshing}
            title="Refresh trust state"
            className="p-1.5 rounded-lg border border-zinc-700/60 hover:border-zinc-500 text-zinc-500 hover:text-zinc-300 transition disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Trust score bar */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Trust Score</span>
          <span className={`text-sm font-bold tabular-nums ${band.color}`}>{state.trustScore}</span>
        </div>
        <div className="h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${band.barColor}`}
            style={{ width: `${state.trustScore}%` }}
          />
        </div>
      </div>

      {/* Evidence checklist */}
      <div className="px-4 py-2 space-y-1.5 border-t border-zinc-800/40">
        {/* Identity */}
        <div className="flex items-center gap-2">
          {state.identityVerified ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
          )}
          <span className="text-xs text-zinc-300">
            NPI Identity {state.identityVerified ? 'verified' : 'unverified'}
          </span>
        </div>

        {/* Licensure */}
        <div className="flex items-center gap-2">
          <LicensureIcon status={state.licensureStatus} />
          <span className="text-xs text-zinc-300">{licensureLabel(state.licensureStatus)}</span>
        </div>

        {/* Exclusion */}
        <div className="flex items-center gap-2">
          {state.exclusionClear ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
          )}
          <span className="text-xs text-zinc-300">
            OIG/LEIE {state.exclusionClear ? 'clear' : 'flagged'}
          </span>
        </div>

        {/* Credentials */}
        <div className="flex items-center gap-2">
          {state.credentialCount > 0 ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
          )}
          <span className="text-xs text-zinc-300">
            {state.credentialCount} credential{state.credentialCount !== 1 ? 's' : ''} on file
          </span>
        </div>
      </div>

      {/* Gaps */}
      {state.gaps.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800/40">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Missing</p>
          <div className="flex flex-wrap gap-1">
            {state.gaps.slice(0, 4).map((gap) => (
              <span
                key={gap}
                className="inline-flex items-center gap-1 text-[10px] text-amber-400/80 bg-amber-950/30 border border-amber-900/30 rounded px-1.5 py-0.5"
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                {gap}
              </span>
            ))}
            {state.gaps.length > 4 && (
              <span className="text-[10px] text-zinc-600">+{state.gaps.length - 4} more</span>
            )}
          </div>
        </div>
      )}

      {/* Facts toggle */}
      {state.facts.length > 0 && (
        <div className="border-t border-zinc-800/40">
          <button
            onClick={() => setShowFacts((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-zinc-600 hover:text-zinc-400 transition"
          >
            <span>{state.facts.length} evidence item{state.facts.length !== 1 ? 's' : ''}</span>
            {showFacts ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {showFacts && (
            <div className="px-4 pb-3 space-y-1 max-h-40 overflow-y-auto">
              {state.facts.map((fact, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-[10px]">
                  <span className="text-zinc-400 font-medium">{fact.factType}</span>
                  <div className="text-right">
                    <span className="text-zinc-600">{fact.source}</span>
                    <span
                      className={`ml-1.5 ${
                        fact.status === 'ACTIVE' || fact.status === 'VERIFIED' || fact.status === 'CLEAR'
                          ? 'text-emerald-500'
                          : fact.status === 'EXCLUDED' || fact.status === 'EXPIRED'
                          ? 'text-red-500'
                          : 'text-zinc-500'
                      }`}
                    >
                      {fact.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrustStatePanel;
