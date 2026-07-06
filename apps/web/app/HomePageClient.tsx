'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignedIn } from '@clerk/nextjs';
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
import { MatchaConstellation } from '@/components/matcha/MatchaConstellation';

function formatNpi(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/**
 * Scroll-choreography: adds `vh-in` when the element enters the viewport.
 * SSR/no-JS renders are unaffected — the hidden initial state only applies
 * under the `.vh-js` root class, which is set client-side.
 */
function useReveal<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('vh-in');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
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

/** One heartbeat cycle of the monitor trace, repeated twice for a seamless loop. */
const EKG_BEAT =
  'M0 22 H26 L34 22 L40 12 L46 30 L52 6 L58 34 L64 22 L72 22 H104 L112 22 L118 14 L124 28 L130 22 H160';

/** Hero hairline heartbeat — one wide pass under the H1. */
const EKG_HAIRLINE =
  'M0 20 H150 L166 20 L176 8 L186 30 L194 2 L202 34 L210 20 L224 20 H400 L416 20 L426 12 L436 26 L444 20 H620';

/**
 * Capability rail — the breadth of the product, stated once, above the fold.
 * A first-time visitor should see VitalCV is a wallet + readiness + recognition
 * + opportunity platform before scrolling, not just an NPI form. Each pill maps
 * to a real value card lower on the page.
 */
const CAPABILITY_PILLS = [
  { label: 'Career wallet', icon: Wallet },
  { label: 'Readiness', icon: ShieldCheck },
  { label: 'Recognition', icon: Award },
  { label: 'Shareable proof', icon: Share2 },
  { label: 'Opportunities', icon: Compass },
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
const ROLE_DOORS = [
  {
    role: 'Clinician',
    action: 'Claim my NPI record',
    href: '/onboarding',
    blurb: 'Open the wallet tied to your NPI and see your readiness.',
  },
  {
    role: 'Verifier',
    action: 'Look up an NPI',
    href: '/',
    blurb: 'See what is source-backed about a clinician.',
  },
  {
    role: 'Employer',
    action: 'Review a passport',
    href: '/pilot',
    blurb: 'Reviewer-ready head start, not a final credentialing decision.',
  },
  {
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
      className="vh-wallet vt-animate-rise relative w-full max-w-sm rounded-[1.75rem] border border-[var(--vt-border)] bg-[color-mix(in_oklab,var(--vt-surface)_97%,white)] p-5 shadow-[0_1px_0_rgba(255,255,255,0.75),0_30px_70px_rgba(15,23,42,0.10)]"
    >
      {/* Wallet header */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--vt-text-primary)]">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--vt-text-primary)] text-[var(--vt-bg)]">
            <Wallet size={16} />
          </span>
          VitalCV Wallet
        </span>
        <span className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
          You own this
        </span>
      </div>

      {/* Vitals monitor — the clinical heartbeat of the card */}
      <div className="vh-monitor mt-4">
        <svg viewBox="0 0 320 44" preserveAspectRatio="none">
          <path d={EKG_BEAT} />
          <path d={EKG_BEAT} transform="translate(160 0)" />
        </svg>
        <span className="vh-monitor-label">EVIDENCE · LIVE READ</span>
      </div>

      {/* Readiness meter */}
      <div className="mt-3 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[var(--vt-bg)] px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
            Readiness snapshot
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--vt-accent-emerald)]">
            <CheckCircle2 size={12} /> Source-backed
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="vh-bar flex-1">
            <div className="vh-bar-fill" />
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
      <div className="vh-scan mt-3 space-y-1.5">
        {WALLET_PREVIEW_ROWS.map((row) => (
          <div
            key={row.source}
            className="flex items-center justify-between rounded-xl border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] px-3 py-2"
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
      <div className="mt-3 flex items-center justify-between rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-accent-emerald)_8%,var(--vt-surface))] px-4 py-3">
        <span className="flex items-center gap-2">
          <span className="vh-ring flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--vt-accent-emerald)_18%,transparent)] text-[var(--vt-accent-emerald)]">
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
  const router = useRouter();
  const [raw, setRaw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(false);

  // Flag JS availability on the root so entrance choreography only ever
  // hides content when the runtime is actually there to reveal it again.
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    rootRef.current?.classList.add('vh-js');
  }, []);

  const loopRef = useReveal<HTMLDivElement>();
  const aiRef = useReveal<HTMLUListElement>();
  const valueRef = useReveal<HTMLDivElement>();
  const audienceRef = useReveal<HTMLDivElement>();
  const doorsRef = useReveal<HTMLDivElement>();
  const proofRef = useReveal<HTMLDivElement>();

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
    router.push(`/passport?npi=${digits}`);
  }, [digits, isFull, router]);

  return (
    <div
      ref={rootRef}
      className="mz vh-root relative overflow-hidden bg-[var(--paper)] text-[var(--vt-text-primary)]"
    >
      <div aria-hidden="true" className="vh-aurora" />
      <div
        aria-hidden="true"
        className="mz-dotgrid pointer-events-none absolute inset-x-0 top-0 h-[26rem] opacity-60"
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

      <main className="relative mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
        <div className="w-full">

          {/* Hero — clinician wallet product, NPI-first entry */}
          <section
            aria-label="NPI lookup"
            data-home-hero=""
            className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"
          >
            {/* Left: messaging + NPI entry */}
            <div className="max-w-2xl">
              <div className="space-y-5">
                <p
                  data-home-eyebrow=""
                  className="vh-eyebrow text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--vt-text-muted)]"
                >
                  <span aria-hidden="true" className="vh-eyebrow-dot" />
                  The Provider Career Evidence Network
                </p>
                <h1 className="text-[clamp(2.4rem,5.6vw,3.75rem)] leading-[0.98] font-semibold tracking-[-0.04em] text-[var(--vt-text-primary)]">
                  Your clinical career evidence, in one wallet you own.
                </h1>
                <svg
                  aria-hidden="true"
                  className="vh-ekg-line"
                  viewBox="0 0 620 40"
                  preserveAspectRatio="none"
                >
                  <path d={EKG_HAIRLINE} />
                </svg>
                <p
                  data-home-hero-subhead=""
                  className="max-w-2xl text-[18px] leading-[1.6] text-[var(--vt-text-secondary)]"
                >
                  Start with your NPI. VitalCV reads primary sources, builds your
                  readiness snapshot, and gives you an employer-ready proof packet —
                  free for clinicians, and reusable for every move.
                </p>

                {/* Capability rail — the product's breadth, above the fold */}
                <ul
                  data-home-capabilities=""
                  className="flex flex-wrap gap-2"
                >
                  {CAPABILITY_PILLS.map((pill) => {
                    const Icon = pill.icon;
                    return (
                      <li
                        key={pill.label}
                        className="vh-lift inline-flex items-center gap-1.5 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--vt-text-secondary)]"
                      >
                        <Icon size={13} className="text-[var(--vt-accent-emerald)]" aria-hidden="true" />
                        {pill.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <Card
                id="npi"
                className="mt-8 max-w-xl scroll-mt-24 border-[var(--vt-border)] bg-[color-mix(in_oklab,var(--vt-surface)_96%,white)] shadow-[0_1px_0_rgba(255,255,255,0.72),0_18px_48px_rgba(15,23,42,0.05)]"
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
                        'flex flex-col overflow-hidden rounded-[1.5rem] border bg-[var(--vt-bg)] transition-colors sm:flex-row',
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
                      <button
                        type="submit"
                        data-home-primary-cta=""
                        disabled={!isFull}
                        className={cn(
                          'inline-flex h-14 items-center justify-center gap-2 border-t border-[var(--vt-border)] px-5 text-[13px] font-semibold transition-colors sm:border-l sm:border-t-0 sm:px-6',
                          isFull
                            ? 'vh-cta-ready bg-[var(--vt-text-primary)] text-[var(--vt-bg)] hover:bg-[color-mix(in_oklab,var(--vt-text-primary)_90%,black)]'
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

            {/* Right: wallet product visual */}
            <div className="hidden justify-center lg:flex">
              <WalletPreview />
            </div>
          </section>

          {/* Primary-source registry strip — breadth, in motion. Names only;
              state vocabulary stays in the caption so nothing overclaims. */}
          <section
            aria-label="Primary sources VitalCV reads"
            data-home-source-strip=""
            className="mt-14 border-y border-[var(--vt-border-subtle)] py-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
                Reads primary sources
              </p>
              <div className="vh-marquee min-w-0 flex-1">
                <div className="vh-marquee-track">
                  {[false, true].map((clone) => (
                    <ul
                      key={clone ? 'clone' : 'main'}
                      aria-hidden={clone || undefined}
                      className="flex shrink-0 items-center gap-3 pr-3"
                    >
                      {SOURCE_REGISTRY_STRIP.map((name) => (
                        <li
                          key={name}
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--vt-text-secondary)]"
                        >
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full bg-[var(--vt-accent-emerald)]"
                          />
                          {name}
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </div>
              <p className="shrink-0 text-[11px] text-[var(--vt-text-muted)]">
                Every field shows its state — checked, gated, or stale.
              </p>
            </div>
          </section>

          {/* The loop — what VitalCV does, end to end */}
          <section aria-label="How VitalCV works" data-home-loop="" className="mt-16">
            <p className="vh-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              <span aria-hidden="true" className="vh-eyebrow-dot" />
              How it works
            </p>
            <div ref={loopRef} className="vh-loop-wrap relative">
              <span aria-hidden="true" className="vh-loop-connector hidden lg:block" />
              <ol className="vh-stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {LOOP_STEPS.map((step) => (
                <li
                  key={step.n}
                  data-home-loop-step={step.n}
                  className="vh-lift relative flex flex-col gap-2 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-4 py-4"
                >
                  <span className="vh-step-n flex h-7 w-7 items-center justify-center rounded-full bg-[var(--vt-text-primary)] text-[12px] font-semibold text-[var(--vt-bg)]">
                    {step.n}
                  </span>
                  <p className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
                    {step.title}
                  </p>
                  <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                    {step.text}
                  </p>
                </li>
              ))}
              </ol>
            </div>
          </section>

          {/* AI layer — MATCHA as the honest intelligence layer */}
          <section aria-label="How AI helps" data-home-ai="" className="mt-16">
            <div className="overflow-hidden rounded-[1.75rem] border border-[var(--vt-border)] bg-[var(--vt-surface)]">
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
                <div className="flex flex-col justify-center gap-4">
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
                    <Sparkles size={13} className="text-[var(--vt-accent-emerald)]" aria-hidden="true" />
                    The intelligence layer
                  </span>
                  <h2 className="text-[clamp(1.5rem,3vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em] text-[var(--vt-text-primary)]">
                    MATCHA reads your evidence and tells you what to do next.
                  </h2>
                  <p className="text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">
                    VitalCV&apos;s matching engine works from your source-backed signals — not a
                    marketing promise. It shows its reasoning, points to the source behind every
                    call, and never invents a credential.
                  </p>
                </div>

                <ul ref={aiRef} className="vh-stagger grid gap-3 sm:grid-cols-2">
                  {AI_CAPABILITIES.map((cap) => {
                    const Icon = cap.icon;
                    return (
                      <li
                        key={cap.key}
                        data-home-ai-card={cap.key}
                        className="vh-lift flex flex-col gap-2 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] px-4 py-4"
                      >
                        <span
                          aria-hidden="true"
                          className="vh-icon-chip flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--vt-accent-emerald)_14%,transparent)] text-[var(--vt-accent-emerald)]"
                        >
                          <Icon size={16} />
                        </span>
                        <p className="text-[14px] font-semibold leading-snug text-[var(--vt-text-primary)]">
                          {cap.title}
                        </p>
                        <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
                          {cap.text}
                        </p>
                      </li>
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
            <p className="vh-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              <span aria-hidden="true" className="vh-eyebrow-dot" />
              What you get
            </p>
            <div ref={valueRef} className="vh-stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {VALUE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.key}
                    data-home-value-card={card.key}
                    className="vh-lift flex flex-col gap-3 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-5 py-5"
                  >
                    <span
                      aria-hidden="true"
                      className="vh-icon-chip flex h-9 w-9 items-center justify-center rounded-full border border-[var(--vt-border)] text-[var(--vt-text-primary)]"
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
                  </div>
                );
              })}
            </div>
          </section>

          {/* Buyer audiences — the whole hire buys into one network */}
          <section aria-label="Who VitalCV is for" data-home-audiences="" className="mt-16">
            <p className="vh-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              <span aria-hidden="true" className="vh-eyebrow-dot" />
              Who buys in
            </p>
            <div ref={audienceRef} className="vh-stagger mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {BUYER_AUDIENCES.map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.key}
                    data-home-audience={row.key}
                    className="vh-lift flex items-start gap-3 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-4 py-4"
                  >
                    <span
                      aria-hidden="true"
                      className="vh-icon-chip mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--vt-border)] text-[var(--vt-text-primary)]"
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
                  </div>
                );
              })}
            </div>
          </section>

          {/* Meet MATCHA — interactive intelligence layer (no signup) · Calm Wave D56 */}
          <section aria-label="Meet MATCHA" data-home-matcha="" className="mz mt-16">
            <p className="mz-eyebrow">Meet MATCHA</p>
            <h2 className="mz-display" style={{ marginTop: 14, maxWidth: 640 }}>
              Not a job board. <span className="mz-accent">A career operating system.</span>
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

          {/* Career Evidence Network — static, calm diagram · Calm Wave D56 */}
          <section aria-label="Your career, in motion" data-home-network="" className="mz mt-16">
            <div className="mz-card mz-dotgrid" style={{ padding: '32px 28px' }}>
              <p className="mz-eyebrow">Your career, in motion</p>
              <h2 className="mz-h1" style={{ marginTop: 14, maxWidth: 640 }}>
                Your career isn&rsquo;t a timeline. It&rsquo;s a <span className="mz-accent">constellation you can travel</span>.
              </h2>
              <p className="mz-body" style={{ marginTop: 14, maxWidth: 640 }}>
                Where you began, where you are, and where you&rsquo;re headed — one living sky. Drag to
                rotate it; pull the slider to move through your career and watch the opportunities on your
                horizon light up. Past and future are illustrative; your real evidence lives in your wallet.
              </p>
              <div style={{ marginTop: 20 }}>
                <MatchaConstellation height={480} />
              </div>
            </div>
          </section>

          {/* Role doors — four calm entry points, clinician first */}
          <section
            aria-label="Role-specific entry points"
            data-home-role-doors=""
            className="mt-16"
          >
            <p className="vh-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              <span aria-hidden="true" className="vh-eyebrow-dot" />
              By role
            </p>
            <div ref={doorsRef} className="vh-stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ROLE_DOORS.map((door) => (
                <Link
                  key={door.role}
                  href={door.href}
                  data-home-role-door={door.role.toLowerCase()}
                  className="vh-lift group flex flex-col gap-2 rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-4 py-4 shadow-[0_1px_0_rgba(255,255,255,0.6)] transition-colors hover:border-[var(--vt-text-primary)]"
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
              ))}
            </div>
          </section>

          {/* Proof strip — what every passport row carries */}
          <section
            aria-label="What every passport row carries"
            data-home-proof-strip=""
            className="mt-16"
          >
            <p className="vh-eyebrow text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
              <span aria-hidden="true" className="vh-eyebrow-dot" />
              Every row carries
            </p>
            <div ref={proofRef} className="vh-stagger mt-4 grid gap-3 sm:grid-cols-3">
              {PROOF_STRIP.map((col) => (
                <div
                  key={col.label}
                  data-home-proof-col={col.label.toLowerCase().replace(/\s+/g, '-')}
                  className="vh-lift rounded-[1.25rem] border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)] px-4 py-4"
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
