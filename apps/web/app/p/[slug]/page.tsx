/**
 * Wave 26 / Wave 43 — Public Trust Profile
 *
 * Dual-mode page:
 *
 *  NPI MODE (Wave 43) — slug matches /^\d{10}$/
 *    → GET /api/public/profile/npi/:npi
 *    → Shows CLEARED / PENDING status badge, events timeline,
 *       "Accept & Start this Clinician" Wave 41 CTA.
 *
 *  SLUG MODE (Wave 26) — slug is a ShareLink UUID
 *    → GET /api/public/profile/:slug
 *    → Shows CRS ring, L0–L3 badges, audit hashes, Golden Link CTA.
 *
 * ROUTING NOTE
 * ────────────
 * Next.js App Router does not allow two dynamic segments at the same
 * directory level ([npi] alongside [slug]).  Wave 43 NPI handling is
 * therefore embedded here via runtime detection rather than a separate
 * file — this is correct; both URL forms are /p/<identifier>.
 */

import React from 'react';
import { AnimatedTimeline, type TimelineEvent } from '@/components/ui/AnimatedTimeline';
import type { BadgeLevel } from '@/components/ui/BadgeStatus';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PassportShareActions from '@/components/passport/PassportShareActions'; // Wave 139
import { ApplyWithVitalCV } from '@/components/apply/ApplyWithVitalCV'; // Wave 246

// ── Shared types ──────────────────────────────────────────────────────────

type CrsBand      = 'GREEN' | 'YELLOW' | 'RED';
type L3Status     = 'L0' | 'L1' | 'L2' | 'L3';
type ProfileMode  = 'npi' | 'slug';
type ClearedStatus = 'CLEARED' | 'PENDING';

type TrustStateLabel =
  | 'verified'
  | 'verified_monitoring'
  | 'expiring_soon'
  | 'needs_review'
  | 'expired';

// ── Wave 26 slug profile ──────────────────────────────────────────────────

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

// ── Wave 43 NPI profile ───────────────────────────────────────────────────

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
      // Wave 43: direct NPI lookup
      const res = await fetch(
        `${BACKEND}/api/public/profile/npi/${encodeURIComponent(slug)}`,
        { next: { revalidate: 60 } },
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json() as Omit<NpiProfile, 'mode'>;
      return { mode: 'npi', ...data };
    }

    // Wave 26: ShareLink slug lookup
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
      title: 'Clinician Profile | VitalCV',
      description: 'Clinician profile powered by the VitalCV trust network.',
    };
  }

  if (profile.mode === 'npi') {
    const cleared = profile.status === 'CLEARED';
    const title = cleared
      ? `NPI ${profile.npi} — Checked Profile | VitalCV`
      : `NPI ${profile.npi} — Partial Profile | VitalCV`;
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

  const title = `${profile.name} — Shared Trust Profile | VitalCV`;
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
        fill="url(#shield-grad)" stroke="#10b981" strokeWidth="1.5" />
      <path d="M17 24l5 5 9-10" stroke="#ffffff" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="shield-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#064e3b" /><stop offset="1" stopColor="#065f46" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Wave 43: CLEARED / PENDING badge with CSS pulse ───────────────────────

function ClearedBadge({ status }: { status: ClearedStatus }) {
  const cleared = status === 'CLEARED';
  const toneClasses = cleared
    ? 'bg-white/8 ring-2 ring-white/15 text-white/80'
    : 'bg-vt-warning/10 ring-2 ring-vt-warning/40 text-vt-warning';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={['relative flex h-28 w-28 items-center justify-center rounded-full', toneClasses].join(' ')}>
        {/* Pulse ring — pure CSS, no framer-motion needed in RSC */}
        <span className={[
          'absolute inset-0 rounded-full animate-ping opacity-20',
          cleared ? 'bg-white' : 'bg-vt-warning',
        ].join(' ')} style={{ animationDuration: '2.5s' }} aria-hidden="true" />
        <div className="relative flex flex-col items-center">
          <span className={['text-xl font-black tracking-widest', cleared ? 'text-white/80' : 'text-vt-warning'].join(' ')}>
            {cleared ? 'ON' : '···'}
          </span>
          <span className={['mt-0.5 text-[9px] font-bold uppercase tracking-widest', cleared ? 'text-white/65' : 'text-vt-warning'].join(' ')}>
            {cleared ? 'Checked' : 'Pending'}
          </span>
        </div>
      </div>
      <p className="label uppercase text-vt-neutral-200">
        Profile status
      </p>
    </div>
  );
}

// ── Wave 43: Active credentials pills ────────────────────────────────────

function CredentialPills({ creds }: { creds: string[] }) {
  if (creds.length === 0) return (
    <p className="text-xs text-vt-neutral-800 text-center">No source-backed records on file.</p>
  );
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {creds.map((c) => (
        <span key={c}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 heading-sm text-white/70 ring-1 ring-white/10">
          <span className="h-1.5 w-1.5 rounded-full bg-white/55" aria-hidden="true" />
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Wave 43: Merkle-anchored events timeline ──────────────────────────────

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
    <div className="w-full rounded-2xl vt-glass-subtle p-5">
      <div className="mb-6 flex items-center justify-between border-b border-vt-glass-ring pb-4">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-vt-success" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm1-7H9V7h2v2zm0 4H9v-2h2v2z" />
          </svg>
          <span className="heading-sm uppercase tracking-wider text-vt-neutral-200">
            Merkle Audit Trail
          </span>
        </div>
        {lastAnchored && (
          <span className="text-[10px] text-vt-neutral-800">
            Last: {formatDate(lastAnchored)}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <p className="px-2 py-2 text-xs text-vt-neutral-800">
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
    <div className="rounded-2xl vt-glass-subtle p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-vt-neutral-800">Clinician Trust Band</p>
          <p className="mt-1 text-sm text-vt-neutral-200">Current trust-state snapshot from the VitalCV trust engine</p>
        </div>
        <span className="rounded-full bg-vt-success/15 px-3 py-1 heading-sm text-vt-success">{trustBand}</span>
      </div>
      <div className="rounded-xl bg-black/20 p-4 ring-1 ring-vt-glass-ring">
        <div className="mb-2 flex items-center justify-between text-xs text-vt-neutral-800">
          <span>Credential Readiness Score</span>
          <span className="font-semibold text-vt-neutral-200">{readinessScore}/100</span>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <div className="h-2 rounded-full bg-vt-success" style={{ width: `${Math.max(0, Math.min(100, readinessScore))}%` }} />
        </div>
      </div>
    </div>
  );
}

function ArtifactGrid({
  artifacts,
}: {
  artifacts: NpiProfile['artifactSummaries'];
}) {
  if (artifacts.length === 0) {
    return <p className="rounded-2xl vt-glass-subtle px-5 py-4 text-sm text-vt-neutral-800">No credential artifacts are available yet.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {artifacts.map((artifact) => (
        <article key={artifact.artifactId} className="rounded-2xl vt-glass-subtle p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="heading-sm text-white">{artifact.issuer}</p>
              <p className="mt-1 text-xs text-vt-neutral-800">Checked {formatDate(artifact.verifiedAt)}</p>
            </div>
            <span className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/70">
              {artifact.status}
            </span>
          </div>
          <dl className="space-y-2 text-xs text-vt-neutral-800">
            <div className="flex items-center justify-between gap-4">
              <dt>Monitoring</dt>
              <dd className={artifact.monitoring ? 'text-vt-success' : 'text-vt-neutral-800'}>
                {artifact.monitoring ? 'Active' : 'Off'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Lifecycle</dt>
              <dd className="text-vt-neutral-200">{artifact.lifecycleState}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Redacted claims</dt>
              <dd className="text-vt-neutral-200">{artifact.claimCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt>Artifact hash</dt>
              <dd className="font-mono text-vt-neutral-200">{artifact.checksum.slice(0, 12)}…</dd>
            </div>
          </dl>
          {artifact.selectiveDisclosure ? (
            <div className="mt-4 rounded-xl bg-vt-brand-primary/5 px-3 py-2 ring-1 ring-vt-brand-primary/20">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-vt-brand-secondary">
                Selective disclosure available
              </p>
              <p className="mt-1 text-[11px] text-vt-brand-primary/70">
                {artifact.selectiveDisclosure.algorithm} compatible · {artifact.selectiveDisclosure.claimCount} hashed claim descriptors
              </p>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function IssuerProvenanceList({
  provenance,
}: {
  provenance: NpiProfile['issuerProvenance'];
}) {
  return (
    <div className="space-y-3">
      {provenance.map((issuer) => (
        <div key={issuer.issuer} className="rounded-2xl vt-glass-subtle px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="heading-sm text-white">{issuer.issuer}</p>
              <p className="mt-1 text-xs text-vt-neutral-800">Last checked {formatDate(issuer.latestVerifiedAt)}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/65">
              {issuer.artifactCount} artifact{issuer.artifactCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-3 text-xs text-vt-neutral-200">
            Statuses: {issuer.statuses.join(', ')} {issuer.monitored ? '· monitoring active' : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

function MonitoringSummaryCard({
  summary,
}: {
  summary: NpiProfile['monitoringSummary'];
}) {
  return (
    <div className="rounded-2xl vt-glass-subtle p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-vt-neutral-800">Monitoring Status</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-black/20 p-4 ring-1 ring-vt-glass-ring">
          <p className="text-xl font-semibold text-white">{summary.monitoredArtifactCount}/{summary.totalArtifactCount}</p>
          <p className="mt-1 text-xs text-vt-neutral-800">Artifacts under monitoring</p>
        </div>
        <div className="rounded-xl bg-black/20 p-4 ring-1 ring-vt-glass-ring">
          <p className="text-xl font-semibold text-white">{(summary.coverageRate * 100).toFixed(1)}%</p>
          <p className="mt-1 text-xs text-vt-neutral-800">Coverage</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-vt-neutral-200">
        {summary.activeAlertCount} alerts on record
        {summary.latestAlertAt ? ` · latest ${formatDate(summary.latestAlertAt)}` : ''}
      </p>
    </div>
  );
}

function ProofCard({
  proof,
}: {
  proof: NpiProfile['proof'];
}) {
  return (
    <div className="rounded-2xl vt-glass-subtle p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-vt-neutral-800">Shareable Proof Bundle</p>
      <p className="mt-2 text-sm text-vt-neutral-200">
        Export the deterministic trust-proof bundle or download a human-readable PDF generated from the same canonical payload.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a
          href={proof.jsonUrl}
          className="rounded-xl bg-vt-success px-4 py-3 text-center heading-sm text-black transition-colors hover:bg-vt-success/90"
        >
          Download JSON Proof
        </a>
        <a
          href={proof.pdfUrl}
          className="rounded-xl border border-vt-glass-ring px-4 py-3 text-center heading-sm text-white transition-colors hover:border-vt-success/40"
        >
          Download PDF Proof
        </a>
      </div>
    </div>
  );
}

// ── Wave 43: Accept & Start CTA ───────────────────────────────────────────

function AcceptStartCta({ npi, cleared }: { npi: string; cleared: boolean }) {
  const href = `/verifier/signup?intent=${encodeURIComponent(npi)}&action=accept_start&ref=trust-profile`;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-vt-success/30 bg-emerald-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="heading-sm text-white">
            {cleared ? 'Open the employer review flow?' : 'Request more source coverage for this NPI?'}
          </p>
          <p className="text-xs text-vt-success/80">
            {cleared
              ? 'Move this profile into a real review workspace before making a decision.'
              : 'Start a deeper verification request and gather the missing bundle.'}
          </p>
        </div>
        <a
          href={href}
          className={[
            'shrink-0 rounded-full px-6 py-2.5 heading-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-emerald-950',
            cleared
              ? 'bg-vt-success text-black hover:bg-vt-success focus:ring-vt-success'
              : 'bg-vt-warning text-black hover:bg-vt-warning focus:ring-vt-warning',
          ].join(' ')}
        >
          {cleared ? 'Open Review →' : 'Request Coverage →'}
        </a>
      </div>
    </div>
  );
}

// ── Wave 26 sub-components (unchanged) ───────────────────────────────────

function CrsRing({ score, band }: { score: number; band: CrsBand }) {
  const radius = 70, strokeWidth = 8;
  const r = radius - strokeWidth / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);
  const colors: Record<CrsBand, string> = { GREEN: 'var(--vt-color-success)', YELLOW: 'var(--vt-color-warning)', RED: '#ef4444' };
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
          <circle cx={radius} cy={radius} r={r} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
          <circle cx={radius} cy={radius} r={r} fill="none" stroke={c} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ}
            transform={`rotate(-90 ${radius} ${radius})`}
            style={{ animation: `crs-fill 1.4s cubic-bezier(0.4,0,0.2,1) 0.3s forwards` }} />
          <style>{`@keyframes crs-fill { to { stroke-dashoffset: ${offset}; } }`}</style>
        </svg>
        <div className="absolute flex flex-col items-center leading-none">
          <span className="text-4xl font-bold tabular-nums text-white">{score}</span>
          <span className="mt-0.5 text-xs font-medium text-vt-neutral-200">/100</span>
        </div>
      </div>
      <p className="label text-vt-neutral-200">Credential Readiness Score</p>
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
                'flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all',
                active ? 'bg-vt-success/20 ring-1 ring-vt-success/60 shadow-lg shadow-vt-success/20'
                       : 'vt-glass',
              ].join(' ')}>
              <span className={['heading-md', active ? 'text-vt-success' : 'text-vt-neutral-800'].join(' ')}>
                {level}
              </span>
              <span className={['text-[10px] font-medium', active ? 'text-vt-success' : 'text-vt-neutral-800'].join(' ')}>
                {LEVEL_LABELS[level]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-vt-neutral-800">Trust Level</p>
    </div>
  );
}

function AuditHashes({ hashes }: { hashes: string[] }) {
  return (
    <details className="group w-full rounded-2xl vt-glass-subtle transition-all">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-vt-neutral-200 hover:text-white">
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-vt-success" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          Public Audit Trail
        </span>
        <svg className="h-4 w-4 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </summary>
      <div className="border-t border-vt-glass-ring px-5 py-4">
        {hashes.length === 0 ? (
          <p className="text-xs text-vt-neutral-800">Cryptographic audit trail not yet available.</p>
        ) : (
          <ul className="space-y-1.5">
            {hashes.slice(0, 5).map((hash) => (
              <li key={hash} className="code text-xs text-vt-neutral-800">{hash.slice(0, 16)}&hellip;</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function SlugEmployerHook({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-vt-success/30 bg-emerald-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="truncate heading-sm text-white">Hiring {name.split(' ')[0]}?</p>
          <p className="text-xs text-vt-success/80">Request the full cryptographic credential bundle</p>
        </div>
        <a href={`/verifier/signup?intent=${encodeURIComponent(slug)}&ref=golden-link`}
          className="shrink-0 rounded-full bg-vt-success px-6 py-2.5 heading-sm text-black transition-colors hover:bg-vt-success focus:outline-none focus:ring-2 focus:ring-vt-success focus:ring-offset-2 focus:ring-offset-emerald-950">
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
    <main className="min-h-screen bg-passport-gradient pb-28">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-vt-success/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-vt-glow-passport blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
        <article className="rounded-3xl vt-glass-card p-8 shadow-2xl shadow-black/40 md:p-12">

          {/* Header */}
          <header className="mb-8 flex flex-col items-center gap-3 text-center">
            <ShieldIcon />
            <p className="heading-sm uppercase tracking-widest text-vt-success">
              VitalCV Trust Network
            </p>
          </header>

          <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* ── WAVE 43: NPI MODE ──────────────────────────── */}
          {profile.mode === 'npi' && (
            <>
              <section className="mb-10 text-center">
                <h1 className="heading-lg text-white md:text-3xl">
                  NPI <span className="code text-vt-success">{profile.npi}</span>
                </h1>
                <p className="body-sm mt-2 text-vt-neutral-200">
                  {profile.activeCredentials.length > 0
                    ? `${profile.activeCredentials.length} source-backed credential record${profile.activeCredentials.length !== 1 ? 's' : ''}`
                    : 'Source checks still in progress'}
                </p>
              </section>

              {/* CLEARED / PENDING badge */}
              <section className="mb-10 flex justify-center">
                <ClearedBadge status={profile.status} />
              </section>

              {/* Active credential pills */}
              <section className="mb-8">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-vt-neutral-800">
                  Connected Sources
                </p>
                <CredentialPills creds={profile.activeCredentials} />
              </section>

              <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <section className="mb-8">
                <TrustBandCard trustBand={profile.trustBand} readinessScore={profile.readinessScore} />
              </section>

              {/* Merkle events timeline */}
              <section className="mb-8">
                <EventTimeline events={profile.events} lastAnchored={profile.lastAnchored} />
              </section>

              {/* Readiness evaluator summary */}
              {profile.readiness.evaluated && (
                <section className="mb-8 rounded-xl vt-glass-subtle px-5 py-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-vt-neutral-800">
                    Readiness Snapshot
                  </p>
                  {profile.readiness.isEligible ? (
                    <p className="text-sm text-white/75 font-medium">
                      Checked — {profile.readiness.traceCount} ontology steps traversed
                    </p>
                  ) : (
                    <div>
                      <p className="text-sm text-vt-warning font-medium">
                        Gaps detected
                      </p>
                      {profile.readiness.missingRequirements.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {profile.readiness.missingRequirements.map((r) => (
                            <li key={r} className="text-xs text-vt-neutral-800">· {r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              )}

              <section className="mb-8">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-vt-neutral-800">
                  Credential Artifacts On File
                </p>
                <ArtifactGrid artifacts={profile.artifactSummaries} />
              </section>

              <section className="mb-8">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-vt-neutral-800">
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
                <ProofCard proof={profile.proof} />
              </section>

              {/* Wave 246: Apply with VitalCV — Share credentials action */}
              <section className="mb-8 flex justify-center">
                <ApplyWithVitalCV npi={profile.npi} label="Apply with VitalCV" />
              </section>

              <footer className="text-center">
                <p className="text-xs text-vt-neutral-800">
                  Generated{' '}
                  <span className="text-vt-neutral-800">{formatDate(profile.generatedAt)}</span>
                  {' · '}Powered by VitalCV
                </p>
              </footer>
            </>
          )}

          {/* ── WAVE 26: SLUG MODE ────────────────────────── */}
          {profile.mode === 'slug' && (
            <>
              <section className="mb-10 text-center">
                <h1 className="heading-lg text-white">
                  {profile.name}{' '}
                  <span className="text-vt-success">
                    {profile.trustState === 'verified' || profile.trustState === 'verified_monitoring'
                      ? 'shared a trust snapshot.'
                      : 'shared a partial trust snapshot.'}
                  </span>
                </h1>
                <p className="body-lg mt-2 text-vt-neutral-200">{profile.specialty}</p>
              </section>

              <section className="mb-10 flex justify-center">
                <CrsRing score={profile.crsScore} band={profile.crsBand} />
              </section>

              <section className="mb-10 flex justify-center">
                <TrustBadges l3Status={profile.l3Status} />
              </section>

              <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <section className="mb-8">
                <AuditHashes hashes={profile.publicAuditHashes} />
              </section>

              <footer className="text-center">
                <p className="text-xs text-vt-neutral-800">
                  Last checked:{' '}
                  <span className="text-vt-neutral-800">{formatDate(profile.verifiedAt)}</span>
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
    </main>
  );
}
