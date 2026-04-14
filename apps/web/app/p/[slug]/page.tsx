/**
 * Public Trust Profile — /p/[slug]
 *
 * Dual-mode page:
 *
 *  NPI MODE — slug matches /^\d{10}$/
 *    → GET /api/passport/npi/:npi
 *    → Shows CLEARED / PENDING status badge, events timeline,
 *       "Open Review" CTA.
 *
 *  SLUG MODE — slug is a ShareLink UUID
 *    → GET /api/passport/:slug
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
        `${BACKEND}/api/passport/npi/${encodeURIComponent(slug)}`,
        { next: { revalidate: 60 } },
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json() as Omit<NpiProfile, 'mode'>;
      return { mode: 'npi', ...data };
    }

    const res = await fetch(
      `${BACKEND}/api/passport/${encodeURIComponent(slug)}`,
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




function ReuseSignalBadge({ npi }: { npi: string }) {
  const [signal, setSignal] = React.useState<any>(null);
  React.useEffect(() => {
    fetch(`/api/pilot/reuse-signal/${npi}`)
      .then(r => r.json())
      .then(setSignal)
      .catch(() => {});
  }, [npi]);

  if (!signal || signal.total_actions === 0) return null;

  const recentLabel = signal.recent_accepts_7d > 0
    ? ` (${signal.recent_accepts_7d} this week)`
    : '';

  return (
    <div className="rounded-lg border border-border bg-card p-4 mt-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Employer Activity</p>
      <div className="flex flex-wrap gap-4 text-sm text-foreground">
        {signal.accepted_count > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-green-600">✓</span> {signal.accepted_count} accepted{recentLabel}
          </span>
        )}
        {signal.request_data_count > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-amber-500">⏳</span> {signal.request_data_count} requested data
            {signal.recent_data_requests_7d > 0 && <span className="text-xs text-muted-foreground"> ({signal.recent_data_requests_7d} this week)</span>}
          </span>
        )}
        {signal.flagged_count > 0 && (
          <span className="flex items-center gap-1">
            <span className="text-red-500">⚠</span> {signal.flagged_count} flagged
            {signal.recent_flags_7d > 0 && <span className="text-xs text-muted-foreground"> ({signal.recent_flags_7d} this week)</span>}
          </span>
        )}
      </div>
    </div>
  );
}

function LimitationsCard({ missing }: { missing?: any[] }) {
  if (!missing || missing.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden mt-8">
      <div className="px-5 py-4 border-b font-semibold bg-gray-50 text-gray-700">
        What We Did NOT Verify
      </div>
      <div className="p-5">
        <p className="text-sm text-muted-foreground mb-3">
          The following sources are excluded from this trust snapshot:
        </p>
        <ul className="space-y-2">
          {missing.map((m: any, i: number) => (
            <li key={i} className="text-sm text-foreground flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <span>
                <strong>{m.sourceId || m.dimension || 'Source'}</strong>: {m.reason || 'Not checked'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DecisionPostureCard({ decision }: { decision?: any }) {
  if (!decision) return null;

  const headerColor = 
    decision.status === 'DECISION_GRADE' ? 'bg-green-100 text-green-800 border-green-200' :
    decision.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
    decision.status === 'BLOCKED' ? 'bg-red-100 text-red-800 border-red-200' :
    'bg-gray-100 text-gray-800 border-gray-200';

  const label = 
    decision.status === 'DECISION_GRADE' ? 'PROCEED' :
    decision.status === 'PARTIAL' ? 'PROCEED WITH CAUTION' :
    decision.status === 'BLOCKED' ? 'DO NOT PROCEED' : 'INSUFFICIENT DATA';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className={`px-5 py-4 border-b font-bold tracking-wider ${headerColor}`}>
        {label}
      </div>
      <div className="p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold uppercase text-muted-foreground mb-1">Rationale</p>
          <p className="text-foreground">{decision.headline || 'No decision rationale available.'}</p>
        </div>
        
        {decision.blockers && decision.blockers.length > 0 && (
          <div>
            <p className="text-sm font-semibold uppercase text-red-600 mb-1">Blockers</p>
            <ul className="list-disc pl-5 text-sm text-foreground">
              {decision.blockers.map((b: string) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        )}

        {decision.nextAction && (
          <div>
            <p className="text-sm font-semibold uppercase text-blue-600 mb-1">Next Actions</p>
            <p className="text-sm text-foreground">{decision.nextAction}</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
              <dt>Redacted claims</dt>
              <dd className="text-foreground">{artifact.claimCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Artifact hash</dt>
              <dd className="font-mono text-foreground">{artifact.checksum.slice(0, 12)}…</dd>
            </div>
          </dl>
          {artifact.selectiveDisclosure ? (
            <div className="mt-4 rounded-lg border border-border bg-muted px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-foreground">
                Selective disclosure available
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {artifact.selectiveDisclosure.algorithm} compatible · {artifact.selectiveDisclosure.claimCount} hashed claim descriptors
              </p>
            </div>
          ) : null}
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
          ? "Download a verified PDF summary of this clinician's credentialing checks and source data."
          : "Verified PDF downloads will be available once the primary source checks are complete."}
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



// ── Slug-mode sub-components ─────────────────────────────────────────────



const LEVELS = ['L0', 'L1', 'L2', 'L3'] as const;
const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  L0: 'Incomplete', L1: 'In Progress', L2: 'Checked', L3: 'Monitored',
};



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


function postTelemetry(npi: string, action: string) {
  fetch('/api/pilot/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npi, actionTaken: action }),
  }).catch(() => {});
}

function EmployerActionHooks({ npi }: { npi: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl px-6 py-3">
        <div className="flex items-center justify-center gap-4 pb-2">
          <p className="text-xs text-muted-foreground">Did this decision make sense?</p>
          <button
            onClick={() => postTelemetry(npi, 'feedback_clear')}
            className="text-xs text-green-600 hover:underline"
          >Yes</button>
          <button
            onClick={() => {
              const c = prompt('What was confusing?');
              if (c) {
                fetch('/api/pilot/friction', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ npi, contextPhase: 'decision_view', userComment: c }),
                }).catch(() => {});
              }
            }}
            className="text-xs text-red-500 hover:underline"
          >No</button>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => postTelemetry(npi, 'flag')}
            className="rounded-md border border-red-200 bg-red-50 text-red-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-red-100"
          >Flag Issue</button>
          <button
            onClick={() => postTelemetry(npi, 'request_data')}
            className="rounded-md border border-amber-200 bg-amber-50 text-amber-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-amber-100"
          >Request More Data</button>
          <button
            onClick={() => postTelemetry(npi, 'accept')}
            className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >Accept Candidate</button>
        </div>
      </div>
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────

export default async function PublicTrustProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await fetchProfile(slug);

  if (!profile) notFound();

  // Server-side: log page view (fire-and-forget)
  if (profile.mode === 'npi') {
    fetch(`http://${process.env.NEXT_PUBLIC_BACKEND_URL || ''}/api/pilot/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: profile.npi, actionTaken: 'view' }),
    }).catch(() => {});
  }


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
              <section className="mb-10 text-center">
                <h1 className="text-2xl font-bold text-foreground md:text-3xl">
                  NPI <span className="font-mono text-green-600">{profile.npi}</span>
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {profile.activeCredentials.length > 0
                    ? `${profile.activeCredentials.length} source-backed credential record${profile.activeCredentials.length !== 1 ? 's' : ''}`
                    : 'Source checks still in progress'}
                </p>
              </section>

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
                <DecisionPostureCard decision={(profile as any).decision} />
                <LimitationsCard missing={(profile as any).decision?.missing || []} />
                <ReuseSignalBadge npi={profile.npi} />
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
                <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url);
                    const btn = document.getElementById('copy-link-btn');
                    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000); }
                  }}
                  id="copy-link-btn"
                  className="rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border"
                >Copy Link</button>
                <ApplyWithVitalCV npi={profile.npi} label="Apply with VitalCV" />
              </div>
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

              
              <section className="mb-10">
                <DecisionPostureCard decision={(profile as any).decision} />
                <LimitationsCard missing={(profile as any).decision?.missing || []} />
              </section>


              <section className="mb-10 flex justify-center">
                
              </section>

              <div className="mb-8 h-px bg-border" />

              <section className="mb-8">
                
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
        <EmployerActionHooks npi={profile.npi} />
      )}
      {profile.mode === 'slug' && (
        <EmployerActionHooks npi={profile.slug} />
      )}
      
      <EmployerTracker 
        npi={profile.mode === 'npi' ? profile.npi : undefined} 
        slug={profile.mode === 'slug' ? profile.slug : undefined} 
      />
    </main>
  );
}
