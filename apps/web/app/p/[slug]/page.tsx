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

import { AnimatedTimeline, type TimelineEvent } from '@/components/ui/AnimatedTimeline';
import type { BadgeLevel } from '@/components/ui/BadgeStatus';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

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
  lastAnchored:       string | null;
  activeCredentials:  string[];
  readiness: {
    evaluated:           boolean;
    isEligible:          boolean | null;
    missingRequirements: string[];
    traceCount:          number;
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
      description: 'Verified clinician credentials powered by VitalCV Trust Network.',
    };
  }

  if (profile.mode === 'npi') {
    const cleared = profile.status === 'CLEARED';
    const title = cleared
      ? `NPI ${profile.npi} — CLEARED & Ready to Hire | VitalCV`
      : `NPI ${profile.npi} — Verification Pending | VitalCV`;
    const description = `${profile.activeCredentials.length} active verified credentials. Backed by VitalCV Trust Network.`;
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

  const title = `${profile.name} is 100% Ready to Hire | VitalCV`;
  const description = `Verified Clinician | ${profile.crsScore}% CRS Score | VitalCV Trust Network`;
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
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={[
        'relative flex h-28 w-28 items-center justify-center rounded-full',
        cleared
          ? 'bg-emerald-500/10 ring-2 ring-emerald-500/40'
          : 'bg-amber-500/10 ring-2 ring-amber-500/40',
      ].join(' ')}>
        {/* Pulse ring — pure CSS, no framer-motion needed in RSC */}
        <span className={[
          'absolute inset-0 rounded-full animate-ping opacity-20',
          cleared ? 'bg-emerald-500' : 'bg-amber-500',
        ].join(' ')} style={{ animationDuration: '2.5s' }} aria-hidden="true" />
        <div className="relative flex flex-col items-center">
          <span className={[
            'text-xl font-black tracking-widest',
            cleared ? 'text-emerald-400' : 'text-amber-400',
          ].join(' ')}>
            {cleared ? 'ON' : '···'}
          </span>
          <span className={[
            'mt-0.5 text-[9px] font-bold uppercase tracking-widest',
            cleared ? 'text-emerald-500' : 'text-amber-500',
          ].join(' ')}>
            {status}
          </span>
        </div>
      </div>
      <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
        Trust Status
      </p>
    </div>
  );
}

// ── Wave 43: Active credentials pills ────────────────────────────────────

function CredentialPills({ creds }: { creds: string[] }) {
  if (creds.length === 0) return (
    <p className="text-xs text-gray-600 text-center">No verified credentials on record.</p>
  );
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {creds.map((c) => (
        <span key={c}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Wave 43: Merkle-anchored events timeline ──────────────────────────────

function EventTimeline({ events, lastAnchored }: { events: AuditEvent[]; lastAnchored: string | null }) {
  const EVENT_LABELS: Record<string, { label: string; status: BadgeLevel; statusLabel: string }> = {
    VERIFICATION_COMPLETED:  { label: 'Primary source verified', status: 'L2', statusLabel: 'Verified' },
    VERIFICATION_REQUESTED:  { label: 'Verification initiated', status: 'L1', statusLabel: 'In Progress' },
    START_ATTESTED:          { label: 'Start date attested', status: 'L3', statusLabel: 'Monitored' },
    MONITORING_STATUS_CHANGE:{ label: 'Monitoring update', status: 'L3', statusLabel: 'Monitored' },
    ARTIFACT_VIEWED:         { label: 'Profile accessed', status: 'L0', statusLabel: 'Accessed' },
    BUNDLE_GENERATED:        { label: 'Credential bundle exported', status: 'L2', statusLabel: 'Verified' },
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
    <div className="w-full rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-5">
      <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12zm1-7H9V7h2v2zm0 4H9v-2h2v2z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Merkle Audit Trail
          </span>
        </div>
        {lastAnchored && (
          <span className="text-[10px] text-gray-600">
            Last: {formatDate(lastAnchored)}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <p className="px-2 py-2 text-xs text-gray-600">
          Audit events will appear here after the first verification cycle.
        </p>
      ) : (
        <AnimatedTimeline events={timelineEvents} className="w-full max-w-none" />
      )}
    </div>
  );
}

// ── Wave 43: Accept & Start CTA ───────────────────────────────────────────

function AcceptStartCta({ npi, cleared }: { npi: string; cleared: boolean }) {
  const href = `/verifier/signup?intent=${encodeURIComponent(npi)}&action=accept_start&ref=trust-profile`;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-500/30 bg-emerald-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {cleared ? 'Ready to onboard this clinician?' : 'Start verification for this NPI?'}
          </p>
          <p className="text-xs text-emerald-400/80">
            {cleared
              ? 'Accept credentials & attest start date — closes the ON Loop'
              : 'Run a full PSV sweep and request the credential bundle'}
          </p>
        </div>
        <a
          href={href}
          className={[
            'shrink-0 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-emerald-950',
            cleared
              ? 'bg-emerald-500 text-black hover:bg-emerald-400 focus:ring-emerald-500'
              : 'bg-amber-500 text-black hover:bg-amber-400 focus:ring-amber-500',
          ].join(' ')}
        >
          {cleared ? 'Accept & Start →' : 'Request Bundle →'}
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
  const colors: Record<CrsBand, string> = { GREEN: '#10b981', YELLOW: '#f59e0b', RED: '#ef4444' };
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
          <span className="mt-0.5 text-xs font-medium text-gray-400">/100</span>
        </div>
      </div>
      <p className="text-sm font-medium tracking-wide text-gray-400 uppercase">Credential Readiness Score</p>
    </div>
  );
}

const LEVELS = ['L0', 'L1', 'L2', 'L3'] as const;
const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  L0: 'Incomplete', L1: 'In Progress', L2: 'Verified', L3: 'Monitored',
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
                active ? 'bg-emerald-500/20 ring-1 ring-emerald-500/60 shadow-lg shadow-emerald-500/20'
                       : 'bg-white/5 ring-1 ring-white/10',
              ].join(' ')}>
              <span className={['text-sm font-bold', active ? 'text-emerald-400' : 'text-gray-600'].join(' ')}>
                {level}
              </span>
              <span className={['text-[10px] font-medium', active ? 'text-emerald-500' : 'text-gray-600'].join(' ')}>
                {LEVEL_LABELS[level]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">Trust Level</p>
    </div>
  );
}

function AuditHashes({ hashes }: { hashes: string[] }) {
  return (
    <details className="group w-full rounded-2xl bg-white/[0.03] ring-1 ring-white/10 transition-all">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium text-gray-400 hover:text-gray-300">
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          Public Audit Trail
        </span>
        <svg className="h-4 w-4 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </summary>
      <div className="border-t border-white/10 px-5 py-4">
        {hashes.length === 0 ? (
          <p className="text-xs text-gray-600">Cryptographic audit trail not yet available.</p>
        ) : (
          <ul className="space-y-1.5">
            {hashes.slice(0, 5).map((hash) => (
              <li key={hash} className="font-mono text-xs text-gray-500">{hash.slice(0, 16)}&hellip;</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function SlugEmployerHook({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-500/30 bg-emerald-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">Hiring {name.split(' ')[0]}?</p>
          <p className="text-xs text-emerald-400/80">Request the full cryptographic credential bundle</p>
        </div>
        <a href={`/verifier/signup?intent=${encodeURIComponent(slug)}&ref=golden-link`}
          className="shrink-0 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-emerald-950">
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
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 pb-28">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-slate-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-12">

          {/* Header */}
          <header className="mb-8 flex flex-col items-center gap-3 text-center">
            <ShieldIcon />
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              VitalCV Trust Network
            </p>
          </header>

          <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* ── WAVE 43: NPI MODE ──────────────────────────── */}
          {profile.mode === 'npi' && (
            <>
              <section className="mb-10 text-center">
                <h1 className="text-2xl font-bold text-white md:text-3xl">
                  NPI <span className="font-mono text-emerald-400">{profile.npi}</span>
                </h1>
                <p className="mt-2 text-sm text-gray-400">
                  {profile.activeCredentials.length > 0
                    ? `${profile.activeCredentials.length} active verified credential${profile.activeCredentials.length !== 1 ? 's' : ''}`
                    : 'Verification in progress'}
                </p>
              </section>

              {/* CLEARED / PENDING badge */}
              <section className="mb-10 flex justify-center">
                <ClearedBadge status={profile.status} />
              </section>

              {/* Active credential pills */}
              <section className="mb-8">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                  Verified Sources
                </p>
                <CredentialPills creds={profile.activeCredentials} />
              </section>

              <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Merkle events timeline */}
              <section className="mb-8">
                <EventTimeline events={profile.events} lastAnchored={profile.lastAnchored} />
              </section>

              {/* Readiness evaluator summary */}
              {profile.readiness.evaluated && (
                <section className="mb-8 rounded-xl bg-white/[0.03] ring-1 ring-white/10 px-5 py-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Superbrain Readiness (Wave 37)
                  </p>
                  {profile.readiness.isEligible ? (
                    <p className="text-sm text-emerald-400 font-medium">
                      ✓ Eligible — {profile.readiness.traceCount} ontology steps traversed
                    </p>
                  ) : (
                    <div>
                      <p className="text-sm text-amber-400 font-medium">
                        Gaps detected
                      </p>
                      {profile.readiness.missingRequirements.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {profile.readiness.missingRequirements.map((r) => (
                            <li key={r} className="text-xs text-gray-500">· {r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </section>
              )}

              <footer className="text-center">
                <p className="text-xs text-gray-600">
                  Generated{' '}
                  <span className="text-gray-500">{formatDate(profile.generatedAt)}</span>
                  {' · '}Powered by VitalCV
                </p>
              </footer>
            </>
          )}

          {/* ── WAVE 26: SLUG MODE ────────────────────────── */}
          {profile.mode === 'slug' && (
            <>
              <section className="mb-10 text-center">
                <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
                  {profile.name}{' '}
                  <span className="text-emerald-400">
                    {profile.trustState === 'verified' || profile.trustState === 'verified_monitoring'
                      ? 'is 100% Ready to Hire.'
                      : 'is Building Trust State.'}
                  </span>
                </h1>
                <p className="mt-2 text-lg text-gray-400">{profile.specialty}</p>
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
                <p className="text-xs text-gray-600">
                  Last verified:{' '}
                  <span className="text-gray-500">{formatDate(profile.verifiedAt)}</span>
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
