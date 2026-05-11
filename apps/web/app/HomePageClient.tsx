'use client';

/**
 * HomePageClient — public homepage wedge (Bundle B26).
 *
 * Ports the prototype `view-home.jsx` into Next.js App Router. The NPI
 * submit flow routes to `/passport?npi={npi}`, where the existing
 * `useIngestStream` SSE pipeline takes over and hydrates progressively.
 *
 * Visual aesthetic: editorial / minimal — Geist sans, generous white,
 * mono accents, brutalist near-sharp corners (`--radius: 0.125rem`).
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignedIn } from '@clerk/nextjs';
import {
  Activity,
  ArrowRight,
  Fingerprint,
  Layers,
  ShieldCheck,
  Stamp,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  LaneStateBadge,
  TrustTierBadge,
  type LaneState,
  type TrustTier,
} from '@/design-system/components';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { cn } from '@/lib/utils';

const DEMO_NPI = '1346053246'; // Macie Miller, PA-C — the prototype's walking scenario.

interface SourceRow {
  code: string;
  name: string;
  authority: string;
  state: LaneState;
  chip: string;
  freshness: string;
}

const SOURCES: SourceRow[] = [
  { code: 'NPPES',    name: 'Identity registry',         authority: 'CMS · Federal',         state: 'verified', chip: 'Live',  freshness: 'Updated hourly' },
  { code: 'OIG/LEIE', name: 'Exclusion list',            authority: 'HHS OIG · Federal',     state: 'verified', chip: 'Live',  freshness: 'Refreshed monthly' },
  { code: 'PECOS',    name: 'Medicare enrollment',       authority: 'CMS · Federal',         state: 'verified', chip: 'Live',  freshness: 'Updated daily' },
  { code: 'CA-PA',    name: 'Physician Assistant Board', authority: 'State of California',   state: 'access',   chip: 'Gated', freshness: 'Employer-gated PSV' },
];

interface Step {
  Icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { Icon: Fingerprint, title: 'Enter your NPI',           body: 'We resolve your identity against public federal enumeration. No PII required, no account.' },
  { Icon: Layers,      title: 'Fan out to sources',       body: 'We query authoritative registries in parallel and stamp each result with a verifiable receipt.' },
  { Icon: Stamp,       title: 'Carry your packet forward', body: 'Share a cryptographically-signed snapshot with any employer, CVO, or locum tenens partner.' },
];

interface TierRow {
  tier: TrustTier;
  blurb: string;
  example: string;
}

const TIER_LADDER: TierRow[] = [
  { tier: 'T1', blurb: 'Self-asserted by the clinician.', example: 'Manually entered employment history.' },
  { tier: 'T2', blurb: 'Inferred by AI from clinician artifacts.', example: 'Residency dates parsed from a CV.' },
  { tier: 'T3', blurb: 'Source-checked against a federal/state registry.', example: 'NPPES · OIG/LEIE · PECOS.' },
  { tier: 'T4', blurb: 'Cryptographically signed by the issuing authority.', example: 'Board-issued VC 2.0 receipt.' },
];

function formatNpi(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export default function HomePageClient() {
  const router = useRouter();
  const [raw, setRaw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(false);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const isFull = digits.length === 10;

  const handleSubmit = React.useCallback(() => {
    if (!isFull) {
      setError('NPI must be 10 digits.');
      return;
    }
    setError(null);
    router.push(`/passport?npi=${digits}`);
  }, [digits, isFull, router]);

  const handleDemo = React.useCallback(() => {
    setRaw(DEMO_NPI);
    setError(null);
  }, []);

  return (
    <div className="bg-[var(--vt-bg)] text-[var(--vt-text-primary)]">
      {CLERK_PROVIDER_ENABLED && (
        <SignedIn>
          <div className="border-b border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-state-verified)_10%,transparent)] py-2.5 px-4 text-center">
            <p className="text-[12px] font-medium text-[var(--vt-state-verified)] flex items-center justify-center gap-2">
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              You are signed in securely.
              <Link
                href="/holder"
                className="underline font-semibold ml-2 hover:opacity-80 transition-opacity"
              >
                Go to Workspace →
              </Link>
            </p>
          </div>
        </SignedIn>
      )}

      <div className="max-w-[1400px] mx-auto px-6">
        {/* ── Hero ─────────────────────────────────────── */}
        <section className="pt-24 pb-20 grid grid-cols-12 gap-6 items-start">
          <div className="col-span-12 lg:col-span-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)] mb-6 flex items-center gap-2">
              <span className="h-px w-6 bg-[var(--vt-border)] inline-block" aria-hidden="true" />
              <span>Replay-anchored credential infrastructure</span>
            </div>

            <h1 className="text-[clamp(44px,7vw,68px)] leading-[0.98] font-semibold tracking-[-0.025em] text-[var(--vt-text-primary)]">
              Stop starting<br />
              over. Start ready.
            </h1>

            <p className="mt-7 text-[17px] leading-[1.55] text-[var(--vt-text-secondary)] max-w-[640px]">
              Institutional credential evidence, source-checked against federal registries&nbsp;
              <span className="font-mono text-[14.5px] text-[var(--vt-text-primary)]">
                (NPPES, OIG/LEIE, PECOS)
              </span>
              {' '}and replayed on every share. What&apos;s checked is checked; what&apos;s gated stays ambiguous until evidence lands.
            </p>

            {/* NPI input */}
            <div className="mt-10 max-w-[640px]">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="npi"
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-muted)]"
                >
                  Your NPI · 10-digit National Provider Identifier
                </label>
                <button
                  type="button"
                  onClick={handleDemo}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] underline-offset-2 hover:underline transition-colors"
                  title="Use the demo NPI for Macie Miller, PA-C"
                >
                  Use demo NPI ↑
                </button>
              </div>

              <div
                className={cn(
                  'flex items-stretch border rounded-[var(--vt-radius-sm)] bg-[var(--vt-surface)] transition-colors',
                  focused
                    ? 'border-[var(--vt-text-primary)] ring-2 ring-[var(--vt-focus-ring)]/15'
                    : 'border-[var(--vt-border)]',
                )}
              >
                <div className="flex items-center px-4 border-r border-[var(--vt-border-subtle)] text-[var(--vt-text-muted)]">
                  <Fingerprint size={18} aria-hidden="true" />
                </div>
                <input
                  id="npi"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="— — —  — — —  — — — —"
                  value={formatNpi(raw)}
                  onChange={(e) => {
                    setRaw(e.target.value);
                    setError(null);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="font-mono flex-1 bg-transparent h-16 px-4 text-[22px] tracking-[0.14em] text-[var(--vt-text-primary)] placeholder:text-[var(--vt-text-muted)]/40 outline-none"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!isFull}
                  type="button"
                  className={cn(
                    'flex items-center gap-2 px-6 text-[13px] font-medium tracking-tightish transition-colors',
                    isFull
                      ? 'bg-[var(--vt-text-primary)] text-[var(--vt-bg)] hover:opacity-90'
                      : 'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)] cursor-not-allowed',
                  )}
                >
                  <span>Check Credential Readiness</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2 h-5 flex items-center justify-between text-[11.5px]">
                <span
                  className={cn(
                    'font-mono uppercase tracking-[0.12em]',
                    error ? 'text-[var(--vt-state-blocked)]' : 'text-[var(--vt-text-muted)]',
                  )}
                  role={error ? 'alert' : undefined}
                >
                  {error ?? (isFull ? '10 / 10 digits' : `${digits.length} / 10 digits`)}
                </span>
                <span className="text-[var(--vt-text-muted)]">
                  No account required · Nothing stored without your consent
                </span>
              </div>
            </div>

            {/* Trust strip */}
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-[var(--vt-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[var(--vt-state-verified)]" aria-hidden="true" />
                <span>VC 2.0 compatible</span>
              </span>
              <span className="h-3 w-px bg-[var(--vt-border-subtle)]" aria-hidden="true" />
              <span className="inline-flex items-center gap-1.5">
                <Layers size={14} className="text-[var(--vt-text-muted)]" aria-hidden="true" />
                <span>OpenID4VCI aligned</span>
              </span>
              <span className="h-3 w-px bg-[var(--vt-border-subtle)]" aria-hidden="true" />
              <span className="inline-flex items-center gap-1.5">
                <Stamp size={14} className="text-[var(--vt-text-muted)]" aria-hidden="true" />
                <span>Audit-ready receipts</span>
              </span>
            </div>
          </div>

          {/* ── Right: data provenance panel ──────────────── */}
          <div className="col-span-12 lg:col-span-5 lg:pl-10 mt-4 lg:mt-0">
            <section className="border border-[var(--vt-border)] rounded-[var(--vt-radius-sm)] bg-[var(--vt-surface)] overflow-hidden">
              <header className="px-5 py-3 border-b border-[var(--vt-border-subtle)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[var(--vt-text-muted)]" aria-hidden="true" />
                  <span className="text-[12.5px] font-medium text-[var(--vt-text-primary)]">
                    Authoritative sources, never scraped
                  </span>
                </div>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                  Live
                </span>
              </header>
              <ul className="divide-y divide-[var(--vt-border-subtle)]">
                {SOURCES.map((source) => (
                  <li
                    key={source.code}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-[var(--vt-surface-subtle)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-[var(--vt-text-muted)] uppercase tracking-[0.1em]">
                          {source.code}
                        </span>
                        <span className="text-[13px] font-medium text-[var(--vt-text-primary)] truncate">
                          {source.name}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-[var(--vt-text-muted)] mt-0.5">
                        {source.authority}
                      </div>
                    </div>
                    <div className="text-right">
                      <LaneStateBadge state={source.state} size="sm" label={source.chip} />
                      <div className="font-mono text-[10.5px] text-[var(--vt-text-muted)] mt-1">
                        {source.freshness}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <footer className="px-5 py-3 border-t border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] flex items-center justify-between text-[11.5px] text-[var(--vt-text-muted)]">
                <span>4 federal + state sources wired in</span>
                <Link
                  href="/passport"
                  className="inline-flex items-center gap-1 text-[var(--vt-text-secondary)] hover:text-[var(--vt-text-primary)] transition-colors"
                >
                  <span>Full source registry</span>
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </footer>
            </section>

            <blockquote className="mt-5 text-[12.5px] text-[var(--vt-text-secondary)] leading-[1.5] border-l-2 border-[var(--vt-border)] pl-4">
              &ldquo;Credentialing eats{' '}
              <span className="text-[var(--vt-text-primary)] font-medium">90–180 days</span> per hire.
              Most of that is re-collecting evidence that&apos;s already public.&rdquo;
              <footer className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)] mt-2">
                Why VitalCV exists
              </footer>
            </blockquote>
          </div>
        </section>

        {/* ── How it works strip ────────────────────────── */}
        <section className="border-t border-[var(--vt-border-subtle)] pt-10 pb-16">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-3">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--vt-text-muted)] mb-2">
                Protocol
              </div>
              <h3 className="text-[22px] font-semibold tracking-tightish text-[var(--vt-text-primary)] leading-[1.15]">
                One NPI in.
                <br />
                A defensible packet out.
              </h3>
            </div>
            <ol className="col-span-12 lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--vt-border-subtle)] border border-[var(--vt-border-subtle)] rounded-[var(--vt-radius-sm)] overflow-hidden">
              {STEPS.map((step, index) => {
                const StepIcon = step.Icon;
                return (
                  <li key={step.title} className="bg-[var(--vt-surface)] p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[11px] text-[var(--vt-text-muted)] uppercase tracking-[0.14em]">
                        Step {String(index + 1).padStart(2, '0')}
                      </span>
                      <StepIcon size={16} className="text-[var(--vt-text-muted)]" aria-hidden="true" />
                    </div>
                    <div className="text-[14px] font-semibold text-[var(--vt-text-primary)] mb-1.5">
                      {step.title}
                    </div>
                    <div className="text-[12.5px] text-[var(--vt-text-secondary)] leading-[1.5]">
                      {step.body}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ── Trust Tier Ladder ─────────────────────────── */}
        <section className="border-t border-[var(--vt-border-subtle)] pt-12 pb-16">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--vt-text-muted)] mb-3">
                §2 · Authority framework
              </div>
              <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--vt-text-primary)] leading-[1.2]">
                A published ladder of trust.
                <br />
                <span className="text-[var(--vt-text-secondary)]">Every observation is tiered.</span>
              </h3>
              <p className="mt-4 text-[13px] leading-[1.6] text-[var(--vt-text-secondary)] max-w-[420px]">
                Not all sources are equal, and we refuse to pretend otherwise. Every fact on the
                passport is tagged with a tier from T1 to T4 so downstream auditors know exactly how
                much confidence to extend. T4 records are signed by the issuing authority itself —
                no further verification required.
              </p>
              <div className="mt-5 flex items-center gap-2 text-[11.5px] text-[var(--vt-text-muted)]">
                <ShieldCheck size={13} className="text-[var(--vt-text-muted)]" aria-hidden="true" />
                <span>
                  Conforms to{' '}
                  <span className="font-mono text-[var(--vt-text-secondary)]">NCQA CR §3</span>,{' '}
                  <span className="font-mono text-[var(--vt-text-secondary)]">W3C VC 2.0</span>,{' '}
                  <span className="font-mono text-[var(--vt-text-secondary)]">OpenID4VCI</span>
                </span>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-8">
              <ul className="border border-[var(--vt-border-subtle)] rounded-[var(--vt-radius-sm)] divide-y divide-[var(--vt-border-subtle)] overflow-hidden bg-[var(--vt-surface)]">
                {TIER_LADDER.map((row) => (
                  <li key={row.tier} className="px-5 py-4 flex items-start gap-4">
                    <TrustTierBadge tier={row.tier} variant="long" size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[var(--vt-text-primary)]">{row.blurb}</div>
                      <div className="font-mono text-[11px] text-[var(--vt-text-muted)] mt-1">
                        {row.example}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Pilot anchor + footer ─────────────────────── */}
        <section className="border-t border-[var(--vt-border-subtle)] py-6 px-4">
          <div className="max-w-lg mx-auto text-center">
            <Link
              href="/p/norcal-pa-pilot-1"
              className="inline-flex items-center gap-2 text-sm text-[var(--vt-text-muted)] hover:text-[var(--vt-text-primary)] transition-colors group"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--vt-state-verified)] animate-pulse" aria-hidden="true" />
              View a pilot session — readiness to employer action in 1.8 min
              <span className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <footer className="border-t border-[var(--vt-border-subtle)] py-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-[11.5px] text-[var(--vt-text-muted)]">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-tightish text-[var(--vt-text-primary)]">
              VitalCV
              <span className="text-[var(--vt-text-muted)] font-normal">/</span>
              <span className="text-[var(--vt-text-secondary)] font-normal">trust</span>
            </span>
            <span className="text-[var(--vt-border)]">|</span>
            <span>Delegated credential verification infrastructure · NCQA CR §3 · §4.2</span>
          </div>
          <div className="font-mono">© 2026 VitalCV, Inc. · Trust Registry Node 202 · ed25519</div>
        </footer>
      </div>
    </div>
  );
}
