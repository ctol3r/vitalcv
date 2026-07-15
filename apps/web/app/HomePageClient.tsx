'use client';

import * as React from 'react';
import Link from 'next/link';
import { SignedIn } from '@clerk/nextjs';
import { LiveNpiResult } from '@/components/home/LiveNpiResult';
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Fingerprint,
  LineChart,
  Route,
  Share2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Wallet,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { cn } from '@/lib/utils';
import { PublicMatchaExperience } from '@/components/matcha/PublicMatchaExperience';
// Interactive Provider Career Evidence Network graph (Obsidian-style force graph).
// Direct import (not next/dynamic ssr:false): window/canvas access is confined to
// effects so it server-renders cleanly, and dynamic() would use React.lazy/Suspense
// which the renderToStaticMarkup homepage guard tests do not support.
import CareerGraph from '@/components/career-graph/CareerGraph';
import { Reveal } from '@/components/motion/Reveal';
import { KineticPhrase } from '@/components/home/KineticPhrase';

function formatNpi(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/**
 * Pointer tilt for the wallet card — a few degrees of parallax that make the
 * hero visual feel physical. Skipped entirely under prefers-reduced-motion.
 */
function useWalletTilt<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.setProperty('--vh-ry', `${(px * 7).toFixed(2)}deg`);
        node.style.setProperty('--vh-rx', `${(-py * 7).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      node.style.setProperty('--vh-rx', '0deg');
      node.style.setProperty('--vh-ry', '0deg');
    };
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    };
  }, []);
  return ref;
}

/**
 * Count-up for the wallet readiness figure. Runs once when the wallet card
 * mounts client-side; SSR shows the final value so nothing flashes wrong.
 */
function useCountUp(target: number, durationMs = 1400, startDelayMs = 500): number {
  const [value, setValue] = React.useState(target);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let start: number | null = null;
    setValue(0);
    const timer = window.setTimeout(() => {
      const tick = (ts: number) => {
        if (start === null) start = ts;
        const t = Math.min(1, (ts - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(target * eased));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, startDelayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, durationMs, startDelayMs]);
  return value;
}

/**
 * The primary-source registries VitalCV reads today. Names only — the state
 * vocabulary (checked / gated / stale) stays in the caption and product
 * surfaces, so the marquee cannot overclaim an unintegrated source.
 */
const SOURCE_REGISTRY_STRIP = [
  'NPPES NPI Registry',
  'OIG LEIE Exclusions',
  'CMS PECOS Enrollment',
  'CMS Open Payments',
  'State license boards',
  'Academic & training records',
] as const;

/**
 * Wallet preview — the schematic of a clinician's VitalCV wallet, rendered as
 * the hero's product visual. It teaches the source-state model (source-backed /
 * checked / gated) honestly and shows Recognition + share, without fabricating
 * a specific clinician, score, or NPI. This is the "this is a product, not a
 * form" signal the hero was missing.
 */
const WALLET_PREVIEW_ROWS = [
  { source: 'NPPES', field: 'Identity', state: 'Source-backed', tone: 'ok' as const },
  { source: 'OIG / LEIE', field: 'Exclusions', state: 'Checked', tone: 'ok' as const },
  { source: 'CMS PECOS', field: 'Enrollment', state: 'Gated', tone: 'pending' as const },
] as const;

/**
 * The loop — the canonical clinician path, stated plainly so a first-time
 * visitor can see what VitalCV does end to end. Mirrors the doctrine path
 * NPI → Source checks → Readiness → Proof packet → Employer review →
 * Accepted as a head start → Start → Reuse. Kept honest: employer review is
 * a head start, never a final credentialing decision.
 */
const LOOP_STEPS = [
  {
    n: '1',
    title: 'Start with your NPI',
    text: 'No account required to look. Your NPI is the key to everything below.',
  },
  {
    n: '2',
    title: 'We check primary sources',
    text: 'Each field names its source and shows state — source-backed, gated, or stale.',
  },
  {
    n: '3',
    title: 'Get your readiness snapshot',
    text: 'A source-backed picture of where you stand, in your own wallet.',
  },
  {
    n: '4',
    title: 'Share an employer-ready packet',
    text: 'Send proof that shows what is source-backed and what still needs review.',
  },
  {
    n: '5',
    title: 'Get accepted as a head start',
    text: 'When an employer accepts it, that becomes your VitalCV Recognition — then reuse the same wallet for your next move.',
  },
] as const;

/**
 * Value cards — the eight things VitalCV gives a clinician, grouped so each
 * card carries a single clear idea and (where a real public route exists) a
 * single action. No card links to a route that does not exist.
 */
const VALUE_CARDS = [
  {
    key: 'wallet',
    icon: Wallet,
    title: 'A free career wallet you own',
    text: 'A clinician-owned home for your identity, credentials, and evidence. Free to start, and yours to keep across every job.',
    href: '/get-ready',
    cta: 'Start your wallet',
  },
  {
    key: 'readiness',
    icon: ShieldCheck,
    title: 'NPI-first readiness',
    text: 'Enter your NPI and VitalCV reads primary sources to build a source-backed readiness snapshot — honest about what is checked, gated, or stale.',
    href: '#npi',
    cta: 'Check your readiness',
  },
  {
    key: 'recognition',
    icon: Award,
    title: 'VitalCV Recognition',
    text: 'When an employer accepts your evidence as a head start, the acceptance is recorded as Recognition on your career record — a head start, not a final credentialing decision.',
    href: '/trust',
    cta: 'How Recognition works',
  },
  {
    key: 'proof',
    icon: Share2,
    title: 'Shareable proof',
    text: 'Share a proof packet an employer can read in minutes. Every row names its source and shows its state, so review starts from evidence.',
    href: '/trust/attribution',
    cta: 'See what a packet shows',
  },
  {
    key: 'opportunities',
    icon: Compass,
    title: 'Opportunity matching',
    text: 'MATCHA matches your source-backed evidence to open roles, and you apply with your VitalCV — no re-uploading the same documents for every application.',
    href: '/get-ready',
    cta: 'Find your path',
  },
  {
    key: 'time-to-start',
    icon: Zap,
    title: 'Start working faster',
    text: 'Evidence that is ready before day one shortens Time-to-Start. Reuse the same wallet for the next opportunity instead of starting over.',
    href: null,
    cta: null,
  },
] as const;

/**
 * Role doors — four entry points keyed off operator role. Clinician leads.
 * Each door is a calm card with a single action.
 */
// Three user groups per doctrine: holder (clinician), verifier (= employer),
// and issuer. Verifier and employer are ONE group — the party that looks up
// NPIs and accepts a shared passport as a head start — so they share one door.
const ROLE_DOORS = [
  {
    slug: 'clinician',
    role: 'Clinician',
    action: 'Claim my NPI record',
    href: '/onboarding',
    blurb: 'Open the wallet tied to your NPI and see your readiness.',
  },
  {
    slug: 'verifier',
    role: 'Employer / Verifier',
    action: 'Review a passport',
    href: '/pilot',
    blurb: 'Look up an NPI, or review a shared passport — a reviewer-ready head start, not a final credentialing decision.',
  },
  {
    slug: 'issuer',
    role: 'Issuer',
    action: 'Connect a source',
    // /issuer has no landing page (only per-request demo renders under
    // /issuer/*/[requestId]) — route issuers to the intake form until one exists.
    href: '/contact',
    blurb: 'Add a primary-source lane to the trust register.',
  },
] as const;

/**
 * Proof strip — three terse columns that name what every Passport row
 * carries. Avoids dashboard chrome; reads like a document caption.
 */
const PROOF_STRIP = [
  {
    label: 'Source',
    text: 'Every field names the primary source we read.',
  },
  {
    label: 'State',
    text: 'Source-backed, gated, or temporarily unavailable.',
  },
  {
    label: 'Review boundary',
    text: 'Institution review remains the final step.',
  },
] as const;

/**
 * Footer trust row — small links the operator can use to inspect the
 * truth contract directly. Local; no marketing chrome.
 */
const TRUST_FOOTER_LINKS = [
  { label: 'Status', href: '/status' },
  { label: 'Source attribution', href: '/trust/attribution' },
  { label: 'Trust', href: '/trust' },
] as const;

/**
 * AI layer — MATCHA presented as an intelligence layer, not "AI-powered" fluff.
 * Every claim is grounded: it reasons over source-backed signals and shows its
 * work; it never invents a credential. Names the four honest jobs it does.
 */
const AI_CAPABILITIES = [
  {
    key: 'explain',
    icon: Sparkles,
    title: 'Explains your gaps',
    text: 'Turns a wall of credential fields into plain language — what is source-backed, what is stale, and what to fix first.',
  },
  {
    key: 'recommend',
    icon: Route,
    title: 'Recommends your next step',
    text: 'Ranks your single next best move from your readiness signals — so you always know what to do now, not someday.',
  },
  {
    key: 'match',
    icon: Target,
    title: 'Matches readiness to opportunity',
    text: 'Connects what you can already prove to open roles, so you apply where you are ready instead of guessing.',
  },
  {
    key: 'trust',
    icon: ShieldCheck,
    title: 'Helps employers trust faster',
    text: 'Gives a reviewer a source-backed starting point with its reasoning attached — so a yes takes minutes, not weeks.',
  },
] as const;

/**
 * Buyer audiences — the whole hire buys into one network. Clinician leads; each
 * row is a single honest value line, no overclaim. Investors/partners name the
 * moat (a reusable career-evidence network) without inventing metrics.
 */
const BUYER_AUDIENCES = [
  {
    key: 'clinicians',
    icon: Stethoscope,
    audience: 'Clinicians',
    value: 'A free career wallet you own — readiness, Recognition, and proof that move with you to the next role.',
  },
  {
    key: 'employers',
    icon: Building2,
    audience: 'Employers & recruiters',
    value: 'Start from a source-backed head start, not a stack of documents — and trust candidates faster.',
  },
  {
    key: 'credentialing',
    icon: ClipboardCheck,
    audience: 'Credentialing & medical staff teams',
    value: 'See source, state, and freshness up front, so review begins from evidence instead of intake.',
  },
  {
    key: 'verifiers',
    icon: Fingerprint,
    audience: 'Verifiers & issuers',
    value: 'Look up source-backed facts, and bring a primary source online into the trust register.',
  },
  {
    key: 'investors',
    icon: LineChart,
    audience: 'Investors & partners',
    value: 'A reusable clinician career-evidence network — the provider identity layer under every hire.',
  },
] as const;

/**
 * WalletPreview — the hero product visual. Schematic, not a fabricated
 * clinician: it shows the wallet chrome, the source-state vocabulary, a
 * Recognition badge, and a share affordance so the page reads as a product.
 */
function WalletPreview() {
  const tiltRef = useWalletTilt<HTMLDivElement>();
  const readiness = useCountUp(72);

  return (
    <div
      ref={tiltRef}
      aria-hidden="true"
      data-home-wallet-preview=""
      className="relative w-full max-w-sm rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5"
    >
      {/* Wallet header */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--vt-text-primary)]">
          <span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-[var(--vt-text-primary)] text-[var(--vt-bg)]">
            <Wallet size={16} />
          </span>
          VitalCV Wallet
        </span>
        <span className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
          You own this
        </span>
      </div>

      {/* Readiness meter */}
      <div className="mt-4 rounded-[3px] border border-[var(--vt-border-subtle)] bg-[var(--vt-bg)] px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
            Readiness snapshot
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--vt-accent-emerald)]">
            <CheckCircle2 size={12} /> Source-backed
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="mz-meter flex-1">
            <span style={{ width: `${readiness}%` }} />
          </div>
          <span className="w-9 text-right font-mono text-[13px] font-semibold tabular-nums text-[var(--vt-text-primary)]">
            {readiness}%
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--vt-text-muted)]">
          Honest about what is checked, gated, or stale.
        </p>
      </div>

      {/* Source rows */}
      <div className="mt-3 space-y-1.5">
        {WALLET_PREVIEW_ROWS.map((row) => (
          <div
            key={row.source}
            className="flex items-center justify-between rounded-[3px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] px-3 py-2"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[12px] font-semibold text-[var(--vt-text-primary)]">
                {row.field}
              </span>
              <span className="truncate text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                {row.source}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]',
                row.tone === 'ok'
                  ? 'bg-[color-mix(in_oklab,var(--vt-accent-emerald)_16%,transparent)] text-[var(--vt-accent-emerald)]'
                  : 'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
              )}
            >
              {row.state}
            </span>
          </div>
        ))}
      </div>

      {/* Recognition + share footer */}
      <div className="mt-3 flex items-center justify-between rounded-[3px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] px-4 py-3">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[var(--vt-border)] text-[var(--vt-text-primary)]">
            <Award size={16} />
          </span>
          <span className="flex flex-col">
            <span className="text-[12px] font-semibold text-[var(--vt-text-primary)]">
              VitalCV Recognition
            </span>
            <span className="text-[10px] text-[var(--vt-text-muted)]">
              Employer-accepted head start
            </span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--vt-text-secondary)]">
          <Share2 size={11} /> Share
        </span>
      </div>
    </div>
  );
}

export default function HomePageClient() {
  const [raw, setRaw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(false);
  // Sprint 2 — the hero resolves the NPI IN PLACE (the "I watched it work"
  // moment) instead of routing to /passport. This holds the submitted NPI.
  const [submittedNpi, setSubmittedNpi] = React.useState<string | null>(null);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const isFull = digits.length === 10;

  const handleSubmit = React.useCallback(() => {
    if (!isFull) {
      setError('Enter a full 10-digit NPI.');
      return;
    }
    setError(null);
    try {
      window.sessionStorage.setItem('onboarding_npi', digits);
      window.localStorage.setItem('onboarding_npi', digits);
    } catch {
      // Keep the handoff continuous when storage is available.
    }
    setSubmittedNpi(digits);
  }, [digits, isFull]);

  return (
    <div className="mz mz-paper relative overflow-hidden text-[var(--vt-text-primary)]">
      <div
        aria-hidden="true"
        className="mz-dotgrid pointer-events-none absolute inset-x-0 top-0 h-[26rem] opacity-30"
      />

      {CLERK_PROVIDER_ENABLED && (
        <SignedIn>
          <div className="relative border-b border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-accent-emerald)_10%,transparent)] px-4 py-2.5 text-center">
            <p className="flex items-center justify-center gap-2 text-[12px] font-medium text-[var(--vt-accent-emerald)]">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              You are signed in securely.
              <Link
                href="/holder/home"
                className="ml-1 font-semibold underline underline-offset-4 transition-opacity hover:opacity-80"
              >
                Go to your wallet
              </Link>
            </p>
          </div>
        </SignedIn>
      )}

      <main className="relative mx-auto w-full max-w-[1200px] px-6 py-16 sm:py-20">
        <div className="w-full">

          {/* Hero — full Calm Wave D56: the Fraunces headline sits open on paper,
              the NPI + wallet visual framed to the right. No dark panel, no glow,
              no heavy shadow — the calm institutional substrate the design is
              drawn in. */}
          <section
            aria-label="NPI lookup"
            data-home-hero=""
            className="mz mz-paper mz-persona-holder mz-ambient relative isolate py-10 sm:py-14 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"
          >
            {/* Left: messaging + NPI entry */}
            <div className="max-w-2xl">
              <div className="space-y-5">
                {/* Clinician-led hero (Sprint 1, Chris): one job — get a clinician
                    to enter an NPI and understand the result. Strategic category
                    ("Provider Career Evidence Network") moves lower on the page. */}
                <p data-home-eyebrow="" className="mz-eyebrow">
                  The clinician career evidence network
                </p>
                <h1 className="mz-display">
                  Find the opportunity. Prove your career{' '}
                  <em className="mz-accent">once.</em> Start faster.
                </h1>
                <KineticPhrase
                  data-home-hero-subhead=""
                  className="max-w-xl text-[19px] leading-[1.55] text-[var(--vt-text-secondary)]"
                  prefix="Enter your NPI and VitalCV "
                  phrases={[
                    'recognizes your identity',
                    'checks your primary sources',
                    'flags what still needs review',
                    'shows what employers can confirm today',
                  ]}
                  staticSentence="Enter your NPI and VitalCV recognizes your identity, checks your primary sources, flags what still needs review, and shows what employers can confirm today."
                />
                {/* Static, no-JS/SR copy is carried inside KineticPhrase (sr-only);
                    the rotating phrases above are all real steps the lookup runs. */}
              </div>

              <div className="mz-glass mz-glass-interactive mt-8 max-w-xl rounded-[12px]">
              <Card
                id="npi"
                className="scroll-mt-24 rounded-[12px] border-0 bg-transparent shadow-none"
              >
                <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSubmit();
                    }}
                  >
                    <label
                      htmlFor="npi-input"
                      className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--vt-text-muted)]"
                    >
                      Start free — enter your NPI
                    </label>

                    <div
                      className={cn(
                        'flex flex-col overflow-hidden rounded-[3px] border bg-[var(--vt-bg)] transition-colors sm:flex-row',
                        focused
                          ? 'border-[var(--vt-text-primary)] ring-2 ring-[var(--vt-focus-ring)]/15'
                          : 'border-[var(--vt-border)]',
                      )}
                    >
                      <div className="flex items-center gap-3 px-4 pt-4 text-[var(--vt-text-muted)] sm:pt-0">
                        <Fingerprint size={18} aria-hidden="true" />
                      </div>
                      <Input
                        id="npi-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Enter 10-digit NPI"
                        value={formatNpi(raw)}
                        onChange={(event) => {
                          setRaw(event.target.value);
                          setError(null);
                        }}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? 'home-npi-error' : undefined}
                        className="h-14 flex-1 border-0 bg-transparent px-4 text-[18px] font-medium tracking-[0.14em] text-[var(--vt-text-primary)] shadow-none placeholder:text-[var(--vt-text-muted)]/40 focus-visible:ring-0"
                      />
                      {/* Validation micro-interaction: the check fades in on a full NPI. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex items-center justify-center pb-4 pl-4 pr-4 sm:pb-0 sm:pl-0 sm:pr-2 transition-opacity duration-200',
                          isFull ? 'opacity-100' : 'opacity-0',
                        )}
                      >
                        <CheckCircle2 size={22} className="text-[var(--vt-accent-emerald)]" />
                      </span>
                      <button
                        type="submit"
                        data-home-primary-cta=""
                        disabled={!isFull}
                        className={cn(
                          'inline-flex h-14 items-center justify-center gap-2 border-t border-[var(--vt-border)] px-5 text-[13px] font-semibold transition-colors sm:border-l sm:border-t-0 sm:px-6',
                          isFull
                            ? 'bg-[var(--vt-text-primary)] text-[var(--vt-bg)] hover:bg-[color-mix(in_oklab,var(--vt-text-primary)_90%,black)]'
                            : 'cursor-not-allowed bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
                        )}
                      >
                        Check readiness
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--vt-text-secondary)]">
                    <span
                      className={error ? 'text-[var(--vt-state-blocked)]' : undefined}
                      role={error ? 'alert' : undefined}
                      id={error ? 'home-npi-error' : undefined}
                    >
                      {error ?? (isFull ? 'Press Enter to continue' : `${digits.length}/10 digits`)}
                    </span>
                    <span className="text-[var(--vt-border)]" aria-hidden="true">
                      ·
                    </span>
                    <span>No account required</span>
                    <span className="text-[var(--vt-border)]" aria-hidden="true">
                      ·
                    </span>
                    <Link
                      href="/sign-in"
                      data-home-secondary-cta=""
                      className="font-medium text-[var(--vt-text-secondary)] underline underline-offset-4 transition-opacity hover:opacity-80"
                    >
                      Sign in
                    </Link>
                  </div>
                </CardContent>
              </Card>
              </div>

              {/* Secondary path — the wallet is free; the lookup is just the door */}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                <Link
                  href="/get-ready"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--vt-text-primary)] px-4 py-2 font-semibold text-[var(--vt-bg)] transition-colors hover:bg-[color-mix(in_oklab,var(--vt-text-primary)_90%,black)]"
                >
                  <Wallet size={14} aria-hidden="true" />
                  Get your free CV Wallet
                </Link>
                <span className="text-[var(--vt-text-muted)]">Free for clinicians · No card required</span>
              </div>
            </div>

            {/* Right: wallet visual (idle) → the live NPI result in place (Sprint 2).
                On submit it becomes visible on every width (the "watched it work"
                moment appears next to / below the form, no navigation). */}
            <div className={submittedNpi ? 'flex justify-center' : 'hidden justify-center lg:flex'}>
              {submittedNpi ? (
                <LiveNpiResult
                  npi={submittedNpi}
                  onReset={() => {
                    setSubmittedNpi(null);
                    setRaw('');
                  }}
                />
              ) : (
                <WalletPreview />
              )}
            </div>
          </section>

          {/* Primary-source registry strip — breadth, stated calm. Names only;
              state vocabulary stays in the caption so nothing overclaims. */}
          <section
            aria-label="Primary sources VitalCV reads"
            data-home-source-strip=""
            className="mt-14 border-y border-[var(--vt-border-subtle)] py-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <p className="mz-eyebrow shrink-0">Reads primary sources</p>
              <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {SOURCE_REGISTRY_STRIP.map((name) => (
                  <li
                    key={name}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--vt-text-secondary)]"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-[var(--vt-accent-emerald)]"
                    />
                    {name}
                  </li>
                ))}
              </ul>
              <p className="shrink-0 text-[11px] text-[var(--vt-text-muted)]">
                Every field shows its state — checked, gated, or stale.
              </p>
            </div>
          </section>

          {/* The loop — what VitalCV does, end to end */}
          <section aria-label="How VitalCV works" data-home-loop="" className="mt-16">
            <p className="mz-eyebrow">How it works</p>
            <div className="relative">
              <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {LOOP_STEPS.map((step, i) => (
                <Reveal
                  as="li"
                  key={step.n}
                  delay={i * 90}
                  data-home-loop-step={step.n}
                  className="mz-interactive relative flex flex-col gap-2 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-4"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--vt-text-primary)] text-[12px] font-semibold text-[var(--vt-bg)]">
                    {step.n}
                  </span>
                  <p className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
                    {step.title}
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                    {step.text}
                  </p>
                </Reveal>
              ))}
              </ol>
            </div>
          </section>

          {/* The compounding network — the platform's moat, made legible.
              Today every job change re-proves the same career from zero; VitalCV
              replaces the restart with portable, owned evidence whose acceptance
              compounds. This is the shared core all personas buy into. */}
          <section
            aria-label="Why the career evidence network compounds"
            data-home-moat=""
            className="mz mz-ambient mt-16"
          >
            <p className="mz-eyebrow">Why this compounds</p>
            <h2 className="mz-h1" style={{ marginTop: 14, maxWidth: 700 }}>
              Career evidence that <em className="mz-accent">follows you</em> makes
              every move faster than the last.
            </h2>
            <p className="mz-body" style={{ marginTop: 14, maxWidth: 660 }}>
              Today, every job change re-proves the same career from zero — and the
              start date waits on it. VitalCV replaces that restart with a network
              where your proof is portable, and each acceptance makes the next one
              easier.
            </p>
            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              <Reveal delay={0}>
                <div
                  data-home-moat-card="own"
                  className="mz-glass mz-glass-interactive flex h-full flex-col gap-2 rounded-[12px] px-5 py-5"
                >
                  <p className="mz-eyebrow">Yours to keep</p>
                  <h3 className="mz-h2">Nothing resets when you move</h3>
                  <p className="mz-small">
                    Every source check, receipt, and Recognition lands in a wallet
                    you own — not in an employer&apos;s filing cabinet. Your career
                    record leaves with you, intact.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={80}>
                <div
                  data-home-moat-card="compound"
                  className="mz-glass mz-glass-interactive flex h-full flex-col gap-2 rounded-[12px] px-5 py-5"
                >
                  <p className="mz-eyebrow">Acceptance compounds</p>
                  <h3 className="mz-h2">Every yes makes the next yes easier</h3>
                  <p className="mz-small">
                    Each employer that accepts your packet as a head start becomes
                    part of your record. Recognition turns past acceptance into
                    momentum for the next opportunity.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={160}>
                <div
                  data-home-moat-card="network"
                  className="mz-glass mz-glass-interactive flex h-full flex-col gap-2 rounded-[12px] px-5 py-5"
                >
                  <p className="mz-eyebrow">The network speeds up</p>
                  <h3 className="mz-h2">Everyone shares the same win</h3>
                  <p className="mz-small">
                    Clinicians find and start roles sooner. Employers cut
                    Time-to-Start. Credentialing teams stop re-answering what a
                    primary source already answered.
                  </p>
                </div>
              </Reveal>
            </div>
            <p className="mz-small" style={{ marginTop: 18 }}>
              <span className="mz-mono" style={{ letterSpacing: '0.08em' }}>
                RECOGNITION → ACCEPTANCE → START
              </span>{' '}
              — the loop every VitalCV user shares. The goal we build against:
              starting your next role 10× faster than the credentialing status quo.
            </p>
          </section>

          {/* AI layer — MATCHA as the honest intelligence layer */}
          <section aria-label="How AI helps" data-home-ai="" className="mt-16">
            <div className="mz-card overflow-hidden">
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
                <div className="flex flex-col justify-center gap-4">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
                    <Sparkles size={13} className="text-[var(--vt-accent-emerald)]" aria-hidden="true" />
                    The intelligence layer
                  </span>
                  <h2 className="mz-h1">
                    MATCHA reads your evidence and{' '}
                    <em className="mz-accent">tells you what to do next</em>.
                  </h2>
                  <p className="text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">
                    VitalCV&apos;s matching engine works from your source-backed signals — not a
                    marketing promise. It shows its reasoning, points to the source behind every
                    call, and never invents a credential.
                  </p>
                </div>

                <ul className="grid gap-3 sm:grid-cols-2">
                  {AI_CAPABILITIES.map((cap, i) => {
                    const Icon = cap.icon;
                    return (
                      <Reveal
                        as="li"
                        key={cap.key}
                        delay={i * 80}
                        data-home-ai-card={cap.key}
                        className="mz-interactive flex flex-col gap-2 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-4"
                      >
                        <span
                          aria-hidden="true"
                          className="mz-pop flex h-8 w-8 items-center justify-center rounded-[3px] bg-[color-mix(in_oklab,var(--vt-accent-emerald)_14%,transparent)] text-[var(--vt-accent-emerald)]"
                        >
                          <Icon size={16} />
                        </span>
                        <p className="text-[14px] font-semibold leading-snug text-[var(--vt-text-primary)]">
                          {cap.title}
                        </p>
                        <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                          {cap.text}
                        </p>
                      </Reveal>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>

          {/* Value cards — the clinician's answer to "what do I get?" */}
          <section
            aria-label="What VitalCV gives clinicians"
            data-home-value=""
            className="mt-16"
          >
            <p className="mz-eyebrow">What you get</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {VALUE_CARDS.map((card, i) => {
                const Icon = card.icon;
                return (
                  <Reveal
                    key={card.key}
                    delay={i * 70}
                    data-home-value-card={card.key}
                    className="mz-interactive flex flex-col gap-3 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-5 py-5"
                  >
                    <span
                      aria-hidden="true"
                      className="mz-pop flex h-9 w-9 items-center justify-center rounded-full border border-[var(--vt-border)] text-[var(--vt-text-primary)]"
                    >
                      <Icon size={17} />
                    </span>
                    <p className="text-[15px] font-semibold leading-snug text-[var(--vt-text-primary)]">
                      {card.title}
                    </p>
                    <p className="text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                      {card.text}
                    </p>
                    {card.href && card.cta ? (
                      <Link
                        href={card.href}
                        className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-semibold text-[var(--vt-text-primary)] underline-offset-4 transition-opacity hover:opacity-80"
                      >
                        {card.cta}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    ) : null}
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* Buyer audiences — the whole hire buys into one network */}
          <section aria-label="Who VitalCV is for" data-home-audiences="" className="mt-16">
            <p className="mz-eyebrow">Who buys in</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {BUYER_AUDIENCES.map((row, i) => {
                const Icon = row.icon;
                return (
                  <Reveal
                    key={row.key}
                    delay={i * 60}
                    data-home-audience={row.key}
                    className="mz-interactive flex items-start gap-3 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-4"
                  >
                    <span
                      aria-hidden="true"
                      className="mz-pop mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--vt-border)] text-[var(--vt-text-primary)]"
                    >
                      <Icon size={16} />
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="text-[13px] font-semibold leading-snug text-[var(--vt-text-primary)]">
                        {row.audience}
                      </span>
                      <span className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                        {row.value}
                      </span>
                    </span>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* Meet MATCHA — interactive intelligence layer (no signup) · Calm Wave D56 */}
          <section aria-label="Meet MATCHA" data-home-matcha="" className="mz mt-16">
            <p className="mz-eyebrow">Meet MATCHA</p>
            <h2 className="mz-display" style={{ marginTop: 14, maxWidth: 640 }}>
              The operating system for <span className="mz-accent">your clinical career</span>.
            </h2>
            <p className="mz-lede" style={{ marginTop: 16, maxWidth: 620 }}>
              MATCHA is the intelligence layer that learns what you want, then works in the background
              to surface roles worth your time — and it explains every recommendation instead of hiding
              it behind a score. Try it below. No signup, and everything it says traces to what you tell it.
            </p>
            <div style={{ marginTop: 22 }}>
              <PublicMatchaExperience />
            </div>
          </section>

          {/* Career constellation — bleeds into the page (no box): the eyebrow +
              heading sit on paper, the star map opens below and edge-fades into
              the surrounding paper via its own radial mask. Part of the page,
              not a framed panel. */}
          <section aria-label="Your career, in motion" data-home-network="" className="mz mz-persona-holder relative isolate mt-20">
              <div className="relative isolate">
                <p className="mz-eyebrow">Your career, in motion</p>
                <h2 className="mz-h1" style={{ marginTop: 14, maxWidth: 640 }}>
                  Your career isn&rsquo;t a timeline. It&rsquo;s a <span className="mz-accent">network you can explore</span>.
                </h2>
                <p className="mz-body" style={{ marginTop: 14, maxWidth: 640 }}>
                  Every source-backed credential links your record to the issuers that signed it and the
                  employers who accept it — bidirectionally. Drag any node, filter by role, and follow the
                  backlinks. Structure here is illustrative; your real evidence lives in your wallet.
                </p>
                <div style={{ marginTop: 20, width: '100%', height: 680 }}>
                  <CareerGraph initialTheme="light" initialPanelOpen={false} transparentBg />
                </div>
                <p style={{ marginTop: 14 }}>
                  <Link href="/evidence-network" className="mz-accent" style={{ fontSize: 13, fontWeight: 600 }}>
                    Open the full network explorer &rarr;
                  </Link>
                </p>
              </div>
          </section>

          {/* Role doors — three calm entry points, clinician first */}
          <section
            aria-label="Role-specific entry points"
            data-home-role-doors=""
            className="mt-16"
          >
            <p className="mz-eyebrow">By role</p>
            <p className="mz-body" style={{ marginTop: 12, maxWidth: 620 }}>
              Three doors, one shared outcome — a clinician hired and started,
              faster.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ROLE_DOORS.map((door, i) => (
                <Reveal key={door.slug} delay={i * 80}>
                  <Link
                    href={door.href}
                    data-home-role-door={door.slug}
                    className="mz-interactive group flex h-full flex-col gap-2 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-4 hover:border-[var(--vt-text-primary)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
                      {door.role}
                    </p>
                    <p className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
                      {door.action}
                    </p>
                    <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                      {door.blurb}
                    </p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>

          {/* Proof strip — what every passport row carries */}
          <section
            aria-label="What every passport row carries"
            data-home-proof-strip=""
            className="mt-16"
          >
            <p className="mz-eyebrow">Every row carries</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {PROOF_STRIP.map((col) => (
                <div
                  key={col.label}
                  data-home-proof-col={col.label.toLowerCase().replace(/\s+/g, '-')}
                  className="rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
                    {col.label}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                    {col.text}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Trust footer row — calm pointer links, no marketing chrome */}
          <nav
            aria-label="Trust footer"
            data-home-trust-footer=""
            className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--vt-border-subtle)] pt-6 text-[12px] text-[var(--vt-text-muted)]"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
              Trust
            </span>
            {TRUST_FOOTER_LINKS.map((link, idx) => (
              <React.Fragment key={link.href}>
                {idx > 0 && (
                  <span aria-hidden="true" className="text-[var(--vt-border)]">
                    ·
                  </span>
                )}
                <Link
                  href={link.href}
                  className="font-medium text-[var(--vt-text-secondary)] underline-offset-4 transition-opacity hover:underline hover:opacity-90"
                >
                  {link.label}
                </Link>
              </React.Fragment>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}
