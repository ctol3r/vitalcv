'use client';

/**
 * DecisionTimeline.tsx — Wave 244: Decision Capsules Integration
 *
 * Renders a timeline of Decision Capsules for a clinician.
 * Each entry shows: date, decision type, trust band at decision time, current status.
 * Color coding: VALID=green, AT_RISK=yellow, INVALID=red
 * Expandable detail: credential snapshot, trust state at decision time.
 * Dark theme (#080e1a), glass card style.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, ShieldAlert, ShieldX, Clock, Hash } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrustStateSnapshot {
  readiness_level: 'L0' | 'L1' | 'L2' | 'L3';
  readiness_score: number;
  readiness_status?: string;
  gap_summary?: string[];
  methodology_version?: string;
  computed_at?: string;
}

export interface DecisionCapsuleEntry {
  id: string;
  decisionType: string;
  decisionTimestamp: string;
  status: 'VALID' | 'AT_RISK' | 'INVALID';
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodology: string;
  trust_state_snapshot: TrustStateSnapshot | null;
  metadata?: Record<string, unknown>;
}

interface DecisionTimelineProps {
  capsules: DecisionCapsuleEntry[];
  /** Maximum entries to show (default: all) */
  limit?: number;
  /** Optional heading override */
  heading?: string;
  /** If true, shows a compact single-line style */
  compact?: boolean;
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  VALID: {
    label: 'Valid',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-400',
    Icon: Shield,
  },
  AT_RISK: {
    label: 'At Risk',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/30',
    dot: 'bg-amber-400',
    Icon: ShieldAlert,
  },
  INVALID: {
    label: 'Invalid',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    ring: 'ring-red-500/30',
    dot: 'bg-red-400',
    Icon: ShieldX,
  },
} as const;

const BAND_COLOR: Record<string, string> = {
  L0: 'text-red-400',
  L1: 'text-amber-400',
  L2: 'text-sky-400',
  L3: 'text-emerald-400',
};

const DECISION_TYPE_LABEL: Record<string, string> = {
  HIRING: 'Hiring',
  PRIVILEGING: 'Privileging',
  DEPLOYMENT: 'Deployment',
  RENEWAL: 'Renewal',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrustBadge({ level, score }: { level: string; score?: number }) {
  const color = BAND_COLOR[level] ?? 'text-gray-400';
  return (
    <span className={`font-mono text-xs font-semibold ${color}`}>
      {level}{score !== undefined ? ` · ${score}` : ''}
    </span>
  );
}

function CapsuleDetail({ capsule }: { capsule: DecisionCapsuleEntry }) {
  const snap = capsule.trust_state_snapshot;
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {/* Trust State at Decision */}
      {snap && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Trust State at Decision
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-muted-foreground">Band</p>
              <p className={`font-mono font-bold ${BAND_COLOR[snap.readiness_level] ?? 'text-gray-300'}`}>
                {snap.readiness_level}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2">
              <p className="text-muted-foreground">Score</p>
              <p className="font-mono font-bold text-foreground">{snap.readiness_score}/100</p>
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 col-span-2">
              <p className="text-muted-foreground">Status</p>
              <p className="text-foreground/80 truncate">{snap.readiness_status ?? '—'}</p>
            </div>
          </div>
          {snap.gap_summary && snap.gap_summary.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Gaps at Decision Time
              </p>
              <ul className="space-y-0.5">
                {snap.gap_summary.map((gap, i) => (
                  <li key={i} className="text-xs text-amber-300/80">• {gap}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Credential Snapshot */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Credentials Snapshotted
        </p>
        <p className="text-xs text-foreground">
          {capsule.credentialIds.length} credential{capsule.credentialIds.length !== 1 ? 's' : ''} from{' '}
          {capsule.issuerIds.length} issuer{capsule.issuerIds.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Artifact Hash */}
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
        <Hash className="h-3 w-3 shrink-0 text-muted-foreground/60" />
        <span className="font-mono text-[11px] text-muted-foreground truncate">
          {capsule.artifactHash.slice(0, 32)}…
        </span>
      </div>

      {/* Methodology */}
      <p className="text-[11px] text-muted-foreground/60">
        Methodology: {capsule.methodology}
        {snap?.methodology_version ? ` · Trust Engine ${snap.methodology_version}` : ''}
      </p>
    </div>
  );
}

function CapsuleRow({ capsule, compact }: { capsule: DecisionCapsuleEntry; compact: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[capsule.status] ?? STATUS_CONFIG.VALID;
  const { Icon } = cfg;
  const snap = capsule.trust_state_snapshot;

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2 text-sm">
        <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
        <span className="font-medium text-foreground">
          {DECISION_TYPE_LABEL[capsule.decisionType] ?? capsule.decisionType}
        </span>
        <span className="text-muted-foreground">{formatDate(capsule.decisionTimestamp)}</span>
        {snap && <TrustBadge level={snap.readiness_level} score={snap.readiness_score} />}
        <span className={`ml-auto text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-white/[0.03] backdrop-blur-sm transition-colors ${cfg.ring} ring-1`}
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <button
        className="flex w-full items-start gap-4 px-4 py-3 text-left"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {/* Status icon */}
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
          <Icon className={`h-4 w-4 ${cfg.color}`} />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">
              {DECISION_TYPE_LABEL[capsule.decisionType] ?? capsule.decisionType}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}>
              {cfg.label}
            </span>
            {snap && (
              <span className={`rounded-full bg-muted px-2 py-0.5 text-[11px] ring-1 ring-white/10 ${BAND_COLOR[snap.readiness_level] ?? 'text-gray-300'}`}>
                {snap.readiness_level} · {snap.readiness_score}/100
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDate(capsule.decisionTimestamp)}</span>
            <span>·</span>
            <span>{capsule.credentialIds.length} credential{capsule.credentialIds.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Expand chevron */}
        <div className="mt-1 shrink-0 text-muted-foreground/60">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4">
          <CapsuleDetail capsule={capsule} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DecisionTimeline({
  capsules,
  limit,
  heading = 'Decision History',
  compact = false,
}: DecisionTimelineProps) {
  const visible = limit ? capsules.slice(0, limit) : capsules;

  if (visible.length === 0) {
    return (
      <div
        className="rounded-2xl border border-border p-6 text-center"
        style={{ background: 'rgba(8, 14, 26, 0.6)', backdropFilter: 'blur(12px)' }}
      >
        <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No decision capsules recorded yet.</p>
        <p className="mt-1 text-xs text-muted-foreground/50">Capsules are created automatically when applications are accepted.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-border p-5"
      style={{ background: 'rgba(8, 14, 26, 0.6)', backdropFilter: 'blur(12px)' }}
    >
      {heading && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-white/10">
            {capsules.length} capsule{capsules.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {compact ? (
        <div className="divide-y divide-white/5">
          {visible.map((capsule) => (
            <CapsuleRow key={capsule.id} capsule={capsule} compact={compact} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((capsule) => (
            <CapsuleRow key={capsule.id} capsule={capsule} compact={compact} />
          ))}
        </div>
      )}

      {limit && capsules.length > limit && (
        <p className="mt-3 text-center text-xs text-muted-foreground/60">
          +{capsules.length - limit} more capsule{capsules.length - limit !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export default DecisionTimeline;
