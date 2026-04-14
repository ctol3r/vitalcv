/**
 * Public Trust Profile — /p/[slug]
 *
 * Dual-mode page:
 *
 *  NPI MODE — slug matches /^\d{10}$/
 *    → GET /api/public/profile/npi/:npi
 *    → Shows CLEARED / PENDING status badge, events timeline,
 *       "Open Review" CTA.
 *
 *  SLUG MODE — slug is a ShareLink UUID
 *    → GET /api/public/profile/:slug
 *    → Shows CRS ring, L0–L3 badges, audit hashes, Golden Link CTA.
 */

import React from 'react';
import { AnimatedTimeline, type TimelineEvent } from '@/components/ui/AnimatedTimeline';
import type { BadgeLevel } from '@/components/ui/BadgeStatus';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PassportShareActions from '@/components/passport/PassportShareActions';
import { ApplyWithVitalCV } from '@/components/apply/ApplyWithVitalCV';
import { EmployerTracker } from '@/components/telemetry/EmployerTracker';
import {
  DECISION_LIMITATION_HEADING,
  DECISION_NEXT_STEP_HEADING,
  DECISION_RATIONALE_HEADING,
  formatRecentActionLabel,
  getLimitationEmptyMessage,
  getPublicDecisionHeadline,
  getPublicDecisionNextStep,
  getRecentActionEmptyMessage,
} from '@/lib/trust/decision-copy';
import { DecisionActions } from './DecisionActions';

// ── Shared types ──────────────────────────────────────────────────────────

type CrsBand      = 'GREEN' | 'YELLOW' | 'RED';
type L3Status     = 'L0' | 'L1' | 'L2' | 'L3';
type ClearedStatus = 'CLEARED' | 'PENDING';

type TrustStateLabel =
  | 'verified'
  | 'verified_monitoring'
  | 'expiring_soon'
  | 'needs_review'
  | 'expired';

interface SlugProfile {
  mode:              'slug';
  slug:              string;
  name:              string;
  specialty:         string;
  l3Status:          L3Status;
  trustState:        TrustStateLabel;
  crsScore:          number;
  crsBand:           CrsBand;
  publicAuditHashes: string[];
  verifiedAt:        string | null;
  generatedAt:       string;
}

interface AuditEvent {
  type:      string;
  hash:      string;
  createdAt: string;
}

interface NpiProfile {
  mode:               'npi';
  npi:                string;
  status:             ClearedStatus;
  trustBand:          L3Status;
  readinessScore:     number;
  lastAnchored:       string | null;
  activeCredentials:  string[];
  readiness: {
    evaluated:           boolean;
    isEligible:          boolean | null;
    missingRequirements: string[];
    traceCount:          number;
  };
  artifactSummaries: Array<{
    artifactId: string;
    issuer: string;
    status: string;
    lifecycleState: string;
    verifiedAt: string;
    expiresAt: string | null;
    monitoring: boolean;
    checksum: string;
    claimCount: number;
    claimHashes: string[];
    selectiveDisclosure: {
      algorithm: 'SD-JWT';
      hashAlgorithm: 'sha-256';
      claimCount: number;
    } | null;
  }>;
  issuerProvenance: Array<{
    issuer: string;
    artifactCount: number;
    latestVerifiedAt: string;
    monitored: boolean;
    statuses: string[];
  }>;
  monitoringSummary: {
    monitoredArtifactCount: number;
    totalArtifactCount: number;
    coverageRate: number;
    activeAlertCount: number;
    latestAlertAt: string | null;
  };
  proof: {
    jsonUrl: string;
    pdfUrl: string;
    auditBundleJson: string;
    auditBundleDownload: string;
  };
  events:      AuditEvent[];
  generatedAt: string;
  // ── Canonical additive fields (optional for back-compat) ──────────────
  decision?: {
    decision: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'DO_NOT_PROCEED' | 'INSUFFICIENT_DATA';
    confidence: number;
    rationale: string[];
    blockers: string[];
    next_actions: string[];
  };
  limitations?: {
    blockers: string[];
    gaps: string[];
  };
  actions?: {
    recent: Array<{
      id: string;
      npi: string;
      action: string;
      rationale: string | null;
      createdAt: string;
    }>;
  };
  reuse_signal?: {
    accepted_count: number;
    flagged_count: number;
    request_data_count: number;
    last_action: 'accept' | 'request_data' | 'flag' | null;
    last_action_at: string | null;
  };
}

type DisplayProfile = SlugProfile | NpiProfile;

interface Props {
  params: Promise<{ slug: string }>;
}

// ── Backend base URL ──────────────────────────────────────────────────────

const BACKEND = (
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'http://localhost:3001'
).replace(/\/$/, '');

// ── Data fetching ─────────────────────────────────────────────────────────

const NPI_RE = /^\d{10}$/;

async function fetchProfile(slug: string): Promise<DisplayProfile | null> {
  try {
    if (NPI_RE.test(slug)) {
      const res = await fetch(
        `${BACKEND}/api/public/profile/npi/${encodeURIComponent(slug)}`,
        { next: { revalidate: 60 } },
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json() as Omit<NpiProfile, 'mode'>;
      return { mode: 'npi', ...data };
    }

    const res = await fetch(
      `${BACKEND}/api/public/profile/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json() as Omit<SlugProfile, 'mode'>;
    return { mode: 'slug', ...data };
  } catch {
    return null;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Pending';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return 'Pending';
  }
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── generateMetadata ──────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await fetchProfile(slug);

  if (!profile) {
    return {
      title: 'Clinician Profile',
      description: 'Clinician profile powered by the VitalCV trust network.',
    };
  }

  if (profile.mode === 'npi') {
    const cleared = profile.status === 'CLEARED';
    const title = cleared
      ? `NPI ${profile.npi} — Checked Profile`
      : `NPI ${profile.npi} — Partial Profile`;
    const description = `${profile.activeCredentials.length} source-backed record${profile.activeCredentials.length !== 1 ? 's' : ''} on file. Coverage varies by source and freshness.`;
    return {
      title,
      description,
      openGraph: {
        type: 'website', title, description, siteName: 'VitalCV',
        images: [{ url: `https://vitalcv.ai/og/p/${slug}.png`, width: 1200, height: 630 }],
      },
      twitter: { card: 'summary_large_image', title, description },
    };
  }

  const title = `${profile.name} — Shared Trust Profile`;
  const description = 'Shared trust snapshot from VitalCV. Review source coverage and freshness before relying on it.';
  return {
    title,
    description,
    openGraph: {
      type: 'website', title, description, siteName: 'VitalCV',
      images: [{ url: `https://vitalcv.ai/og/p/${slug}.png`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// ── Shared sub-components ─────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12" aria-hidden="true">
      <path d="M24 4L6 12v14c0 10.5 7.7 20.3 18 23 10.3-2.7 18-12.5 18-23V12L24 4z"
        fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.5" />
      <path d="M17 24l5 5 9-10" stroke="#16a34a" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── CLEARED / PENDING badge with CSS pulse ───────────────────────────────

function ClearedBadge({ status }: { status: ClearedStatus }) {
  const cleared = status === 'CLEARED';
  const toneClasses = cleared
    ? 'bg-green-50 ring-2 ring-green-200 text-green-700'
    : 'bg-amber-50 ring-2 ring-amber-200 text-amber-700';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={['relative flex h-28 w-28 items-center justify-center rounded-full', toneClasses].join(' ')}>
        <span className={[
          'absolute inset-0 rounded-full animate-ping opacity-20',
          cleared ? 'bg-green-400' : 'bg-amber-400',
        ].join(' ')} style={{ animationDuration: '2.5s' }} aria-hidden="true" />
        <div className="relative flex flex-col items-center">
          <span className={['text-xl font-black tracking-widest', cleared ? 'text-green-700' : 'text-amber-700'].join(' ')}>
            {cleared ? 'ON' : '···'}
          </span>
          <span className={['mt-0.5 text-[9px] font-bold uppercase tracking-widest', cleared ? 'text-green-600' : 'text-amber-600'].join(' ')}>
            {cleared ? 'Checked' : 'Pending'}
          </span>
        </div>
      </div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Profile status
      </p>
    </div>
  );
}

// ── Active credentials pills ────────────────────────────────────────────

function CredentialPills({ creds }: { creds: string[] }) {
  if (creds.length === 0) return (
    <p className="text-xs text-muted-foreground text-center">No source-backed records on file.</p>
  );
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {creds.map((c) => (
        <span key={c}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Merkle-anchored events timeline ──────────────────────────────────────

function EventTimeline({ events, lastAnchored }: { events: AuditEvent[]; lastAnchored: string | null }) {
  const EVENT_LABELS: Record<string, { label: string; status: BadgeLevel; statusLabel: string }> = {
    VERIFICATION_COMPLETED:  { label: 'Primary source checked', status: 'L2', statusLabel: 'Checked' },
    VERIFICATION_REQUESTED:  { label: 'Verification initiated', status: 'L1', statusLabel: 'In Progress' },
    START_ATTESTED:          { label: 'Start date attested', status: 'L3', statusLabel: 'Monitored' },
    MONITORING_STATUS_CHANGE:{ label: 'Monitoring update', status: 'L3', statusLabel: 'Monitored' },
    ARTIFACT_VIEWED:         { label: 'Profile accessed', status: 'L0', statusLabel: 'Accessed' },
    BUNDLE_GENERATED:        { label: 'Credential bundle exported', status: 'L2', statusLabel: 'Checked' },
  };

  const timelineEvents: TimelineEvent[] = events.map((e, i) => {
    const meta = EVENT_LABELS[e.type] ?? { label: e.type, status: 'L0', statusLabel: 'System' };
    return {
      id: e.hash + i,
      date: formatTime(e.createdAt),
      title: meta.label,
      description: `Hash reference: ${e.hash.slice(0, 20)}…`,
      status: meta.status,
      statusLabel: meta.statusLabel,
    };
  });

  return (
    <div className="w-full rounded-lg border border-border bg-card p-5">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm1-7H9V7h2v2zm0 4H9v-2h2v2z" />
          </svg>
          <span className="text-sm uppercase tracking-wider text-foreground font-medium">
            Audit Trail
          </span>
        </div>
        {lastAnchored && (
          <span className="text-xs text-muted-foreground">
            Last: {formatDate(lastAnchored)}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          Audit events will appear here after the first verification cycle.
        </p>
      ) : (
        <AnimatedTimeline events={timelineEvents} className="w-full max-w-none" />
      )}
    </div>
  );
}

function TrustBandCard({ trustBand, readinessScore }: { trustBand: L3Status; readinessScore: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Clinician Trust Band</p>
          <p className="mt-1 text-sm text-muted-foreground">Current trust-state snapshot from the VitalCV trust engine</p>
        </div>
        <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">{trustBand}</span>
      </div>
      <div className="rounded-lg border border-border bg-muted p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Credential Readiness Score</span>
          <span className="font-semibold text-foreground">{readinessScore}/100</span>
        </div>
        <div className="h-2 rounded-full bg-border">
          <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.max(0, Math.min(100, readinessScore))}%` }} />
        </div>
      </div>
    </div>
  );
}

function ArtifactGrid({ artifacts }: { artifacts: NpiProfile['artifactSummaries'] }) {
  if (artifacts.length === 0) {
    return <p className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">No credential artifacts are available yet.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {artifacts.map((artifact) => (
        <article key={artifact.artifactId} className="rounded-lg border border-border bg-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{artifact.issuer}</p>
              <p className="mt-1 text-xs text-muted-foreground">Checked {formatDate(artifact.verifiedAt)}</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {artifact.status}
            </span>
          </div>
          <dl className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-4">
              <dt>Monitoring</dt>
              <dd className={artifact.monitoring ? 'text-green-600' : 'text-muted-foreground'}>
                {artifact.monitoring ? 'Active' : 'Off'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Lifecycle</dt>
              <dd className="text-foreground">{artifact.lifecycleState}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Records on file</dt>
              <dd className="text-foreground">{artifact.claimCount}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function IssuerProvenanceList({ provenance }: { provenance: NpiProfile['issuerProvenance'] }) {
  return (
    <div className="space-y-3">
      {provenance.map((issuer) => (
        <div key={issuer.issuer} className="rounded-lg border border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{issuer.issuer}</p>
              <p className="mt-1 text-xs text-muted-foreground">Last checked {formatDate(issuer.latestVerifiedAt)}</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {issuer.artifactCount} artifact{issuer.artifactCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Statuses: {issuer.statuses.join(', ')} {issuer.monitored ? '· monitoring active' : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Canonical decision surface ────────────────────────────────────────────

const DECISION_LABELS: Record<NonNullable<NpiProfile['decision']>['decision'], { label: string; tone: string }> = {
  PROCEED: {
    label: 'Proceed',
    tone: 'border-green-500/40 bg-green-500/10 text-green-700',
  },
  PROCEED_WITH_CAUTION: {
    label: 'Proceed with caution',
    tone: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  },
  DO_NOT_PROCEED: {
    label: 'Do not proceed',
    tone: 'border-red-500/40 bg-red-500/10 text-red-700',
  },
  INSUFFICIENT_DATA: {
    label: 'Not enough verified information',
    tone: 'border-slate-500/40 bg-slate-500/10 text-slate-700',
  },
};

function DecisionCard({ decision }: { decision: NonNullable<NpiProfile['decision']> }) {
  const meta = DECISION_LABELS[decision.decision];
  const rationale = decision.rationale.length > 0
    ? decision.rationale
    : ['VitalCV could not load a detailed explanation for this result yet.'];
  const nextActions = decision.next_actions.length > 0
    ? decision.next_actions
    : [getPublicDecisionNextStep(decision.decision)];

  return (
    <div className={`rounded-xl border-2 ${meta.tone} p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Decision</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">{meta.label}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Confidence</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{decision.confidence}</p>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium opacity-90">{getPublicDecisionHeadline(decision.decision)}</p>
      <p className="mt-1 text-xs opacity-75">
        This result uses the verified information currently attached to this profile.
      </p>

      {decision.blockers.length > 0 && (
        <p className="mt-3 text-sm font-semibold">
          Main blocker: {decision.blockers[0]}
        </p>
      )}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{DECISION_RATIONALE_HEADING}</p>
        <ul className="mt-2 space-y-1 text-sm">
          {rationale.map((reason, idx) => (
            <li key={`${idx}-${reason}`}>· {reason}</li>
          ))}
        </ul>
      </div>

      {decision.blockers.length > 1 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Additional blockers</p>
          <ul className="mt-2 space-y-1 text-sm font-medium">
            {decision.blockers.slice(1).map((blocker, idx) => (
              <li key={`${idx}-${blocker}`}>· {blocker}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{DECISION_NEXT_STEP_HEADING}</p>
        <ol className="mt-2 space-y-1 text-sm">
          {nextActions.map((action, idx) => (
            <li key={`${idx}-${action}`}>{idx + 1}. {action}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function LimitationsPanel({ limitations }: { limitations: NonNullable<NpiProfile['limitations']> }) {
  const items = [
    ...limitations.blockers.map((b) => ({ kind: 'blocker' as const, text: b })),
    ...limitations.gaps.map((g) => ({ kind: 'gap' as const, text: g })),
  ];
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        {getLimitationEmptyMessage()}
      </div>
    );
  }
  return (
    <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
        {DECISION_LIMITATION_HEADING}
      </p>
      <ul className="mt-3 space-y-2 text-sm text-foreground">
        {items.map((item, idx) => (
          <li key={`${item.kind}-${idx}`} className="flex items-baseline gap-2">
            <span className={item.kind === 'blocker' ? 'text-red-600' : 'text-amber-600'} aria-hidden>
              {item.kind === 'blocker' ? '!' : '·'}
            </span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReuseSignalRow({ signal }: { signal: NonNullable<NpiProfile['reuse_signal']> }) {
  const hasAny = signal.accepted_count + signal.flagged_count + signal.request_data_count > 0;
  if (!hasAny) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        No prior employer actions recorded for this NPI.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
        <p className="text-2xl font-semibold text-foreground tabular-nums">{signal.accepted_count}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Accepted</p>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
        <p className="text-2xl font-semibold text-foreground tabular-nums">{signal.request_data_count}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Update requests</p>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
        <p className="text-2xl font-semibold text-foreground tabular-nums">{signal.flagged_count}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Review flags</p>
      </div>
    </div>
  );
}

function RecentActionsList({ recent }: { recent: NonNullable<NpiProfile['actions']>['recent'] }) {
  if (recent.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">{getRecentActionEmptyMessage()}</p>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {recent.map((entry) => (
        <li key={entry.id} className="flex items-baseline justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {formatRecentActionLabel(entry.action)}
            </p>
            {entry.rationale && (
              <p className="mt-1 text-xs text-muted-foreground">{entry.rationale}</p>
            )}
          </div>
          <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatTime(entry.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function MonitoringSummaryCard({ summary }: { summary: NpiProfile['monitoringSummary'] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Monitoring Status</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="text-xl font-semibold text-foreground">{summary.monitoredArtifactCount}/{summary.totalArtifactCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Artifacts under monitoring</p>
        </div>
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="text-xl font-semibold text-foreground">{(summary.coverageRate * 100).toFixed(1)}%</p>
          <p className="mt-1 text-xs text-muted-foreground">Coverage</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {summary.activeAlertCount} alerts on record
        {summary.latestAlertAt ? ` · latest ${formatDate(summary.latestAlertAt)}` : ''}
      </p>
    </div>
  );
}

function hasDownloadableSourceBackedProof(
  artifacts: NpiProfile['artifactSummaries'],
): boolean {
  return artifacts.some((artifact) => (
    artifact.claimCount > 0 && artifact.claimHashes.length > 0
  ));
}

function ProofCard({
  proof,
  hasDownloadableProof,
}: {
  proof: NpiProfile['proof'];
  hasDownloadableProof: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Shareable Proof Bundle</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {hasDownloadableProof
          ? 'Export the deterministic trust-proof bundle or download a human-readable PDF generated from the same canonical payload.'
          : 'No source-backed claims are attached yet, so proof downloads stay disabled until the first checked claim lands.'}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {hasDownloadableProof ? (
          <>
            <a
              href={proof.jsonUrl}
              className="rounded-lg bg-green-600 px-4 py-3 text-center text-sm font-medium text-foreground transition-colors hover:bg-green-700"
            >
              Download JSON Proof
            </a>
            <a
              href={proof.pdfUrl}
              className="rounded-lg border border-border px-4 py-3 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Download PDF Proof
            </a>
          </>
        ) : (
          <>
            <span className="rounded-lg border border-border bg-muted px-4 py-3 text-center text-sm font-medium text-muted-foreground">
              JSON proof unavailable
            </span>
            <span className="rounded-lg border border-border bg-muted px-4 py-3 text-center text-sm font-medium text-muted-foreground">
              PDF proof unavailable
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Accept & Start CTA ───────────────────────────────────────────────────

function AcceptStartCta({ npi, cleared }: { npi: string; cleared: boolean }) {
  const href = `/verifier/signup?intent=${encodeURIComponent(npi)}&action=accept_start&ref=trust-profile`;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {cleared ? 'Open the employer review flow?' : 'Request more source coverage for this NPI?'}
          </p>
          <p className="text-xs text-muted-foreground">
            {cleared
              ? 'Move this profile into a real review workspace before making a decision.'
              : 'Start a deeper verification request and gather the missing bundle.'}
          </p>
        </div>
        <a
          href={href}
          className="shrink-0 rounded-md px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-foreground text-background hover:bg-foreground/90"
        >
          {cleared ? 'Open Review →' : 'Request Coverage →'}
        </a>
      </div>
    </div>
  );
}

// ── Slug-mode sub-components ─────────────────────────────────────────────

function CrsRing({ score, band }: { score: number; band: CrsBand }) {
  const radius = 70, strokeWidth = 8;
  const r = radius - strokeWidth / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const colors: Record<CrsBand, string> = { GREEN: '#16a34a', YELLOW: '#d97706', RED: '#dc2626' };
  const c = colors[band];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          className="absolute opacity-20 blur-md" aria-hidden="true">
          <circle cx={radius} cy={radius} r={r} fill="none" stroke={c}
            strokeWidth={strokeWidth + 4} strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset} strokeLinecap="round"
            transform={`rotate(-90 ${radius} ${radius})`} />
        </svg>
        <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          role="img" aria-label={`CRS Score: ${score} out of 100`}>
          <circle cx={radius} cy={radius} r={r} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
          <circle cx={radius} cy={radius} r={r} fill="none" stroke={c} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ}
            transform={`rotate(-90 ${radius} ${radius})`}
            style={{ animation: `crs-fill 1.4s cubic-bezier(0.4,0,0.2,1) 0.3s forwards` }} />
          <style>{`@keyframes crs-fill { to { stroke-dashoffset: ${offset}; } }`}</style>
        </svg>
        <div className="absolute flex flex-col items-center leading-none">
          <span className="text-4xl font-bold tabular-nums text-foreground">{score}</span>
          <span className="mt-0.5 text-xs font-medium text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Credential Readiness Score</p>
    </div>
  );
}

const LEVELS = ['L0', 'L1', 'L2', 'L3'] as const;
const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  L0: 'Incomplete', L1: 'In Progress', L2: 'Checked', L3: 'Monitored',
};

function TrustBadges({ l3Status }: { l3Status: L3Status }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {LEVELS.map((level) => {
          const active = level === l3Status;
          return (
            <div key={level} title={LEVEL_LABELS[level]}
              className={[
                'flex flex-col items-center gap-1 rounded-lg px-3 py-2 border transition-all',
                active
                  ? 'border-green-300 bg-green-50'
                  : 'border-border bg-muted',
              ].join(' ')}>
              <span className={['text-sm font-semibold', active ? 'text-green-700' : 'text-muted-foreground'].join(' ')}>
                {level}
              </span>
              <span className={['text-[10px] font-medium', active ? 'text-green-600' : 'text-muted-foreground'].join(' ')}>
                {LEVEL_LABELS[level]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Trust Level</p>
    </div>
  );
}

function AuditHashes({ hashes }: { hashes: string[] }) {
  return (
    <details className="group w-full rounded-lg border border-border bg-card transition-all">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-foreground">
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          Public Audit Trail
        </span>
        <svg className="h-4 w-4 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </summary>
      <div className="border-t border-border px-5 py-4">
        {hashes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Cryptographic audit trail not yet available.</p>
        ) : (
          <ul className="space-y-1.5">
            {hashes.slice(0, 5).map((hash) => (
              <li key={hash} className="font-mono text-xs text-muted-foreground">{hash.slice(0, 16)}&hellip;</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function SlugEmployerHook({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">Hiring {name.split(' ')[0]}?</p>
          <p className="text-xs text-muted-foreground">Request the full credential bundle</p>
        </div>
        <a href={`/verifier/signup?intent=${encodeURIComponent(slug)}&ref=golden-link`}
          className="shrink-0 rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2">
          Request Full Bundle →
        </a>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function PublicTrustProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await fetchProfile(slug);

  if (!profile) notFound();

  return (
    <main className="min-h-screen bg-background pb-28">
      <div className="relative mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
        <article className="rounded-lg border border-border bg-card p-8 shadow-sm md:p-12">

          {/* Header */}
          <header className="mb-8 flex flex-col items-center gap-3 text-center">
            <ShieldIcon />
            <p className="text-sm uppercase tracking-widest text-green-600 font-medium">
              VitalCV Trust Network
            </p>
          </header>

          <div className="mb-8 h-px bg-border" />

          {/* ── NPI MODE ──────────────────────────── */}
          {profile.mode === 'npi' && (
            <>
              {/* Zero-context onboarding header */}
              <section className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Credential readiness snapshot
                </p>
                <p className="mt-1 text-sm text-foreground">
                  This is a credential readiness snapshot for a clinician, built from verified public sources.
                </p>
              </section>

              {/* Hierarchy per Wave: decision → actions → limitations → everything else */}
              {profile.decision && (
                <section className="mb-6">
                  <DecisionCard decision={profile.decision} />
                </section>
              )}

              <section className="mb-8">
                <p className="mb-3 text-center text-sm font-semibold text-foreground">
                  What would you like to do next?
                </p>
                <DecisionActions npi={profile.npi} />
              </section>

              {profile.limitations && (
                <section className="mb-8">
                  <LimitationsPanel limitations={profile.limitations} />
                </section>
              )}

              <section className="mb-8 text-center">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  NPI <span className="font-mono">{profile.npi}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {profile.activeCredentials.length > 0
                    ? `${profile.activeCredentials.length} source-backed record${profile.activeCredentials.length !== 1 ? 's' : ''} on file`
                    : 'Source checks still in progress'}
                </p>
              </section>

              {profile.reuse_signal && (
                <section className="mb-8">
                  <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    How other employers have handled this clinician
                  </p>
                  <ReuseSignalRow signal={profile.reuse_signal} />
                </section>
              )}

              {profile.actions && profile.actions.recent.length > 0 && (
                <section className="mb-8">
                  <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Recent employer actions
                  </p>
                  <RecentActionsList recent={profile.actions.recent} />
                </section>
              )}

              <section className="mb-10 flex justify-center">
                <ClearedBadge status={profile.status} />
              </section>

              <section className="mb-8">
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Connected Sources
                </p>
                <CredentialPills creds={profile.activeCredentials} />
              </section>

              <div className="mb-8 h-px bg-border" />

              <section className="mb-8">
                <TrustBandCard trustBand={profile.trustBand} readinessScore={profile.readinessScore} />
              </section>

              <section className="mb-8">
                <EventTimeline events={profile.events} lastAnchored={profile.lastAnchored} />
              </section>

              {profile.readiness.evaluated && (
                <section className="mb-8 rounded-lg border border-border bg-card px-5 py-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Readiness Snapshot
                  </p>
                  {profile.readiness.isEligible ? (
                    <p className="text-sm text-foreground font-medium">
                      Checked — {profile.readiness.traceCount} ontology steps traversed
                    </p>
                  ) : (
                    <div>
                      <p className="text-sm text-amber-600 font-medium">
                        Gaps detected
                      </p>
                      {profile.readiness.missingRequirements.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {profile.readiness.missingRequirements.map((r) => (
                            <li key={r} className="text-xs text-muted-foreground">· {r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              )}

              <section className="mb-8">
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Credential Artifacts On File
                </p>
                <ArtifactGrid artifacts={profile.artifactSummaries} />
              </section>

              <section className="mb-8">
                <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Issuer Provenance
                </p>
                <IssuerProvenanceList provenance={profile.issuerProvenance} />
              </section>

              <section className="mb-8">
                <MonitoringSummaryCard summary={profile.monitoringSummary} />
              </section>

              <section className="mb-8">
                <PassportShareActions
                  npi={profile.npi}
                  credentialCount={profile.activeCredentials.length}
                  downloadUrl={profile.proof.jsonUrl}
                />
              </section>

              <section className="mb-8">
                <ProofCard
                  proof={profile.proof}
                  hasDownloadableProof={hasDownloadableSourceBackedProof(profile.artifactSummaries)}
                />
              </section>

              <section className="mb-8 flex justify-center">
                <ApplyWithVitalCV npi={profile.npi} label="Apply with VitalCV" />
              </section>

              <footer className="text-center">
                <p className="text-xs text-muted-foreground">
                  Generated{' '}
                  <span>{formatDate(profile.generatedAt)}</span>
                  {' · '}Powered by VitalCV
                </p>
              </footer>
            </>
          )}

          {/* ── SLUG MODE ────────────────────────── */}
          {profile.mode === 'slug' && (
            <>
              <section className="mb-10 text-center">
                <h1 className="text-2xl font-bold text-foreground">
                  {profile.name}{' '}
                  <span className="text-green-600">
                    {profile.trustState === 'verified' || profile.trustState === 'verified_monitoring'
                      ? 'shared a trust snapshot.'
                      : 'shared a partial trust snapshot.'}
                  </span>
                </h1>
                <p className="mt-2 text-muted-foreground">{profile.specialty}</p>
              </section>

              <section className="mb-10 flex justify-center">
                <CrsRing score={profile.crsScore} band={profile.crsBand} />
              </section>

              <section className="mb-10 flex justify-center">
                <TrustBadges l3Status={profile.l3Status} />
              </section>

              <div className="mb-8 h-px bg-border" />

              <section className="mb-8">
                <AuditHashes hashes={profile.publicAuditHashes} />
              </section>

              <footer className="text-center">
                <p className="text-xs text-muted-foreground">
                  Last checked:{' '}
                  <span>{formatDate(profile.verifiedAt)}</span>
                  {' · '}Powered by VitalCV
                </p>
              </footer>
            </>
          )}

        </article>
      </div>

      {/* Sticky CTA — mode-aware */}
      {profile.mode === 'npi' && (
        <AcceptStartCta npi={profile.npi} cleared={profile.status === 'CLEARED'} />
      )}
      {profile.mode === 'slug' && (
        <SlugEmployerHook slug={profile.slug} name={profile.name} />
      )}
      
      <EmployerTracker 
        npi={profile.mode === 'npi' ? profile.npi : undefined} 
        slug={profile.mode === 'slug' ? profile.slug : undefined} 
      />
    </main>
  );
}
