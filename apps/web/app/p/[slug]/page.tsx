/**
 * Wave 26 — "The Golden Link" Public Viral Profile Page
 *
 * Agents covered:
 *  2. Golden Link Route       — Liquid Glass card, CRS Ring, L0–L3 badges
 *  3. Dynamic OpenGraph       — generateMetadata for iMessage / Slack / LinkedIn unfurls
 *  4. Viral Hook              — Sticky employer CTA → /verifier/signup?intent=<slug>
 *
 * Data source: GET /api/public/profile/:slug (Wave 26 backend — no PII)
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────

type CrsBand = 'GREEN' | 'YELLOW' | 'RED';
type L3Status = 'L0' | 'L1' | 'L2' | 'L3';
type TrustStateLabel =
  | 'verified'
  | 'verified_monitoring'
  | 'expiring_soon'
  | 'needs_review'
  | 'expired';

interface PublicProfile {
  slug: string;
  name: string;
  specialty: string;
  l3Status: L3Status;
  trustState: TrustStateLabel;
  crsScore: number;
  crsBand: CrsBand;
  publicAuditHashes: string[];
  verifiedAt: string | null;
  generatedAt: string;
}

interface Props {
  params: Promise<{ slug: string }>;
}

// ── Data fetching ─────────────────────────────────────────────────────────

const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'http://localhost:3001';

async function fetchProfile(slug: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${BACKEND}/api/public/profile/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 }, // ISR — revalidate every 60 s
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as PublicProfile;
  } catch {
    return null;
  }
}

function formatVerifiedAt(iso: string | null): string {
  if (!iso) return 'Pending';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );
  } catch {
    return 'Pending';
  }
}

// ── generateMetadata — Agents 3 ───────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await fetchProfile(slug);

  if (!profile) {
    return {
      title: 'Clinician Profile | VitalCV',
      description: 'Verified clinician credentials powered by VitalCV Trust Network.',
    };
  }

  const title = `${profile.name} is 100% Ready to Hire | VitalCV`;
  const description = `Verified Clinician | ${profile.crsScore}% CRS Score | VitalCV Trust Network`;
  const ogImage = `https://vitalcv.ai/og/p/${slug}.png`;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: 'VitalCV',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `VitalCV profile for ${profile.name}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12"
      aria-hidden="true"
    >
      <path
        d="M24 4L6 12v14c0 10.5 7.7 20.3 18 23 10.3-2.7 18-12.5 18-23V12L24 4z"
        fill="url(#shield-grad)"
        stroke="#10b981"
        strokeWidth="1.5"
      />
      <path
        d="M17 24l5 5 9-10"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="shield-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#064e3b" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── CRS Animated Ring — Agent 2 ───────────────────────────────────────────

function CrsRing({ score, band }: { score: number; band: CrsBand }) {
  const radius = 70;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const fillRatio = Math.max(0, Math.min(100, score)) / 100;
  const strokeDashoffset = circumference * (1 - fillRatio);

  const bandColor: Record<CrsBand, string> = {
    GREEN: '#10b981',
    YELLOW: '#f59e0b',
    RED: '#ef4444',
  };

  const ringColor = bandColor[band];
  const animationId = `crs-ring-${score}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        {/* Glow layer */}
        <svg
          width={radius * 2}
          height={radius * 2}
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          className="absolute opacity-20 blur-md"
          aria-hidden="true"
        >
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth + 4}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${radius} ${radius})`}
          />
        </svg>

        {/* Main ring */}
        <svg
          width={radius * 2}
          height={radius * 2}
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
          role="img"
          aria-label={`CRS Score: ${score} out of 100`}
        >
          {/* Track */}
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
          />
          {/* Score arc */}
          <circle
            id={animationId}
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference} /* starts empty */
            transform={`rotate(-90 ${radius} ${radius})`}
            style={{
              animation: `crs-fill 1.4s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards`,
            }}
          />
          <style>{`
            @keyframes crs-fill {
              to { stroke-dashoffset: ${strokeDashoffset}; }
            }
          `}</style>
        </svg>

        {/* Score label */}
        <div className="absolute flex flex-col items-center leading-none">
          <span className="text-4xl font-bold tabular-nums text-white">{score}</span>
          <span className="mt-0.5 text-xs font-medium text-gray-400">/100</span>
        </div>
      </div>
      <p className="text-sm font-medium tracking-wide text-gray-400 uppercase">
        Credential Readiness Score
      </p>
    </div>
  );
}

// ── L0–L3 Badges — Agent 2 ────────────────────────────────────────────────

const LEVELS = ['L0', 'L1', 'L2', 'L3'] as const;

const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  L0: 'Incomplete',
  L1: 'In Progress',
  L2: 'Verified',
  L3: 'Monitored',
};

function TrustBadges({ l3Status }: { l3Status: L3Status }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        {LEVELS.map((level) => {
          const active = level === l3Status;
          return (
            <div
              key={level}
              title={LEVEL_LABELS[level]}
              className={[
                'flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all',
                active
                  ? 'bg-emerald-500/20 ring-1 ring-emerald-500/60 shadow-lg shadow-emerald-500/20'
                  : 'bg-white/5 ring-1 ring-white/10',
              ].join(' ')}
            >
              <span
                className={[
                  'text-sm font-bold',
                  active ? 'text-emerald-400' : 'text-gray-600',
                ].join(' ')}
              >
                {level}
              </span>
              <span
                className={[
                  'text-[10px] font-medium',
                  active ? 'text-emerald-500' : 'text-gray-600',
                ].join(' ')}
              >
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

// ── Audit Hashes ──────────────────────────────────────────────────────────

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
        <svg
          className="h-4 w-4 transition-transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </summary>
      <div className="border-t border-white/10 px-5 py-4">
        {hashes.length === 0 ? (
          <p className="text-xs text-gray-600">Cryptographic audit trail not yet available.</p>
        ) : (
          <ul className="space-y-1.5">
            {hashes.slice(0, 5).map((hash) => (
              <li key={hash} className="font-mono text-xs text-gray-500">
                {hash.slice(0, 16)}&hellip;
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

// ── Viral Employer Hook — Agent 4 ─────────────────────────────────────────

function EmployerHook({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-emerald-500/30 bg-emerald-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            Hiring {name.split(' ')[0]}?
          </p>
          <p className="text-xs text-emerald-400/80">
            Request the full cryptographic credential bundle
          </p>
        </div>
        <a
          href={`/verifier/signup?intent=${encodeURIComponent(slug)}&ref=golden-link`}
          className="shrink-0 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-emerald-950"
        >
          Request Full Bundle →
        </a>
      </div>
    </div>
  );
}

// ── Headline helper ───────────────────────────────────────────────────────

function readyHeadline(trustState: TrustStateLabel): string {
  return trustState === 'verified' || trustState === 'verified_monitoring'
    ? '100% Ready to Hire.'
    : 'Building Trust State.';
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function GoldenLinkPage({ params }: Props) {
  const { slug } = await params;
  const profile = await fetchProfile(slug);

  if (!profile) notFound();

  const verifiedLabel = formatVerifiedAt(profile.verifiedAt);

  return (
    <>
      {/* ── Main content ────────────────────────────────── */}
      <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 pb-28">
        {/* Ambient background glows */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-slate-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
          {/* ── Liquid Glass Card ────────────────────────── */}
          <article className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-12">

            {/* Header */}
            <header className="mb-8 flex flex-col items-center gap-3 text-center">
              <ShieldIcon />
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                VitalCV Trust Network
              </p>
            </header>

            {/* Divider */}
            <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Headline */}
            <section className="mb-10 text-center">
              <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
                {profile.name}{' '}
                <span className="text-emerald-400">is {readyHeadline(profile.trustState)}</span>
              </h1>
              <p className="mt-2 text-lg text-gray-400">{profile.specialty}</p>
            </section>

            {/* CRS Ring */}
            <section className="mb-10 flex justify-center">
              <CrsRing score={profile.crsScore} band={profile.crsBand} />
            </section>

            {/* L0–L3 Badges */}
            <section className="mb-10 flex justify-center">
              <TrustBadges l3Status={profile.l3Status} />
            </section>

            {/* Divider */}
            <div className="mb-8 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Audit Hashes */}
            <section className="mb-8">
              <AuditHashes hashes={profile.publicAuditHashes} />
            </section>

            {/* Footer timestamp */}
            <footer className="text-center">
              <p className="text-xs text-gray-600">
                Last verified:{' '}
                <span className="text-gray-500">{verifiedLabel}</span>
                {' · '}
                <span className="text-gray-600">Powered by VitalCV</span>
              </p>
            </footer>
          </article>
        </div>
      </main>

      {/* ── Sticky employer CTA — Agent 4 ───────────────── */}
      <EmployerHook slug={profile.slug} name={profile.name} />
    </>
  );
}
