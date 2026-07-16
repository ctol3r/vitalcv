'use client';

import * as React from 'react';
import Link from 'next/link';
import { SignedIn } from '@clerk/nextjs';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Fingerprint,
  Share2,
  Wallet,
  Zap,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DualAudienceCta } from '@/components/home/DualAudienceCta';
import { EvidenceTruthPanel } from '@/components/home/EvidenceTruthPanel';
import { HomepageSectionRail } from '@/components/home/HomepageSectionRail';
import { LiveNpiResult } from '@/components/home/LiveNpiResult';
import { MetricStrip } from '@/components/home/MetricStrip';
import { ProductCarousel } from '@/components/home/ProductCarousel';
import { ScrollTypeNarrative } from '@/components/home/ScrollTypeNarrative';
import { StickyProductStory } from '@/components/home/StickyProductStory';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { cn } from '@/lib/utils';

const SOURCE_REGISTRY_STRIP = [
  'NPPES NPI Registry',
  'OIG LEIE Exclusions',
  'CMS PECOS Enrollment',
  'State license boards',
] as const;

const WALLET_PREVIEW_ROWS = [
  { source: 'NPPES', field: 'Identity', state: 'Source-backed', tone: 'ok' as const },
  { source: 'OIG / LEIE', field: 'Exclusions', state: 'Checked', tone: 'ok' as const },
  { source: 'State board', field: 'Licensure', state: 'Access required', tone: 'pending' as const },
] as const;

const TRUST_FOOTER_LINKS = [
  { label: 'Status', href: '/status' },
  { label: 'Source attribution', href: '/trust/attribution' },
  { label: 'Trust', href: '/trust' },
] as const;

const HERO_PHRASES = [
  'recognizes your identity',
  'checks the primary sources',
  'shows what still needs review',
  'matches the right opportunity',
  'carries your evidence forward',
] as const;

function formatNpi(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

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

function WalletPreview() {
  const tiltRef = useWalletTilt<HTMLDivElement>();

  return (
    <div
      ref={tiltRef}
      aria-hidden="true"
      data-home-wallet-preview=""
      className="relative w-full max-w-sm rounded-[12px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--vt-text-primary)]">
          <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[var(--vt-text-primary)] text-[var(--vt-bg)]">
            <Wallet size={16} />
          </span>
          VitalCV Wallet
        </span>
        <span className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">
          You own this
        </span>
      </div>

      <div className="mt-4 rounded-[9px] border border-[var(--vt-border-subtle)] bg-[var(--vt-bg)] px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">Readiness snapshot</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--vt-accent-emerald)]">
            <CheckCircle2 size={12} /> Source-backed
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="mz-meter flex-1"><span style={{ width: '72%' }} /></div>
          <span className="w-9 text-right font-mono text-[13px] font-semibold tabular-nums text-[var(--vt-text-primary)]">72%</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--vt-text-muted)]">Honest about what is checked, gated, or stale.</p>
      </div>

      <div className="mt-3 space-y-1.5">
        {WALLET_PREVIEW_ROWS.map((row) => (
          <div key={row.source} className="flex items-center justify-between rounded-[7px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] px-3 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[12px] font-semibold text-[var(--vt-text-primary)]">{row.field}</span>
              <span className="truncate text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">{row.source}</span>
            </span>
            <span className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]',
              row.tone === 'ok'
                ? 'bg-[color-mix(in_oklab,var(--vt-accent-emerald)_14%,transparent)] text-[var(--vt-accent-emerald)]'
                : 'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
            )}>
              {row.state}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-[8px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] px-4 py-3">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-[var(--vt-border)] text-[var(--vt-text-primary)]"><Award size={16} /></span>
          <span className="flex flex-col">
            <span className="text-[12px] font-semibold text-[var(--vt-text-primary)]">VitalCV Recognition</span>
            <span className="text-[10px] text-[var(--vt-text-muted)]">Employer-accepted head start</span>
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
      // The lookup still works when storage is unavailable.
    }
    setSubmittedNpi(digits);
  }, [digits, isFull]);

  return (
    <div className="mz mz-paper relative overflow-x-clip text-[var(--vt-text-primary)]">
      <div aria-hidden="true" className="mz-dotgrid pointer-events-none absolute inset-x-0 top-0 h-[26rem] opacity-20" />

      {CLERK_PROVIDER_ENABLED && (
        <SignedIn>
          <div className="relative border-b border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-accent-emerald)_10%,transparent)] px-4 py-2.5 text-center">
            <p className="flex items-center justify-center gap-2 text-[12px] font-medium text-[var(--vt-accent-emerald)]">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              You are signed in securely.
              <Link href="/holder/home" className="ml-1 font-semibold underline underline-offset-4">Go to your wallet</Link>
            </p>
          </div>
        </SignedIn>
      )}

      <HomepageSectionRail />

      <main className="relative mx-auto w-full max-w-[1200px] px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <section
          id="wallet"
          aria-label="NPI lookup"
          data-home-hero=""
          className="mz mz-paper mz-persona-holder relative isolate grid min-h-[calc(100svh-9rem)] items-center gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:py-14"
        >
          <div className="max-w-2xl">
            <div className="space-y-5">
              <p data-home-eyebrow="" className="mz-eyebrow">The clinician career evidence network</p>
              <h1 className="mz-display">
                Find the opportunity. Prove your career <em className="mz-accent">once.</em> Start faster.
              </h1>
              <ScrollTypeNarrative
                data-home-hero-subhead=""
                className="max-w-xl text-[19px] leading-[1.5] text-[var(--vt-text-secondary)]"
                prefix="VitalCV "
                phrases={HERO_PHRASES}
                staticSentence="VitalCV recognizes your identity, checks the primary sources, shows what still needs review, matches the right opportunity, and carries your evidence forward."
                scrollContainerId="wallet"
              />
            </div>

            <div className="mz-glass mz-glass-interactive mt-8 max-w-xl rounded-[12px]">
              <Card id="npi" className="scroll-mt-36 rounded-[12px] border-0 bg-transparent shadow-none">
                <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                  <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
                    <label htmlFor="npi-input" className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
                      Start free — enter your NPI
                    </label>
                    <div className={cn(
                      'flex flex-col overflow-hidden rounded-[8px] border bg-[var(--vt-bg)] transition-colors sm:flex-row',
                      focused ? 'border-[var(--vt-text-primary)] ring-2 ring-[var(--vt-focus-ring)]/15' : 'border-[var(--vt-border)]',
                    )}>
                      <div className="flex items-center px-4 pt-4 text-[var(--vt-text-muted)] sm:pt-0"><Fingerprint size={18} aria-hidden="true" /></div>
                      <Input
                        id="npi-input"
                        aria-label="NPI number"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Enter 10-digit NPI"
                        value={formatNpi(raw)}
                        onChange={(event) => { setRaw(event.target.value); setError(null); }}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? 'home-npi-error' : undefined}
                        className="h-14 flex-1 border-0 bg-transparent px-4 text-[18px] font-medium tracking-[0.14em] text-[var(--vt-text-primary)] shadow-none placeholder:text-[var(--vt-text-muted)]/40 focus-visible:ring-0"
                      />
                      <span aria-hidden="true" className={cn('flex items-center justify-center pb-4 px-4 transition-opacity sm:pb-0 sm:pl-0 sm:pr-2', isFull ? 'opacity-100' : 'opacity-0')}>
                        <CheckCircle2 size={22} className="text-[var(--vt-accent-emerald)]" />
                      </span>
                      <button
                        type="submit"
                        data-home-primary-cta=""
                        disabled={!isFull}
                        className={cn(
                          'inline-flex h-14 items-center justify-center gap-2 border-t border-[var(--vt-border)] px-5 text-[13px] font-semibold sm:border-l sm:border-t-0 sm:px-6',
                          isFull ? 'bg-[var(--vt-text-primary)] text-[var(--vt-bg)]' : 'cursor-not-allowed bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
                        )}
                      >
                        Check readiness <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--vt-text-secondary)]">
                    <span className={error ? 'text-[var(--vt-state-blocked)]' : undefined} role={error ? 'alert' : undefined} id={error ? 'home-npi-error' : undefined}>
                      {error ?? (isFull ? 'Press Enter to continue' : `${digits.length}/10 digits`)}
                    </span>
                    <span aria-hidden="true" className="text-[var(--vt-border)]">·</span>
                    <span>No account required</span>
                    <span aria-hidden="true" className="text-[var(--vt-border)]">·</span>
                    <Link href="/sign-in" data-home-secondary-cta="" className="font-medium underline underline-offset-4">Sign in</Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
              <Link href="/get-ready" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--vt-text-primary)] px-4 py-2 font-semibold text-[var(--vt-bg)]">
                <Wallet size={14} aria-hidden="true" /> Get your free CV Wallet
              </Link>
              <span className="text-[var(--vt-text-muted)]">Free for clinicians · No card required</span>
            </div>
          </div>

          <div className={submittedNpi ? 'flex justify-center' : 'hidden justify-center lg:flex'}>
            {submittedNpi ? (
              <LiveNpiResult npi={submittedNpi} onReset={() => { setSubmittedNpi(null); setRaw(''); }} />
            ) : (
              <WalletPreview />
            )}
          </div>
        </section>

        <section aria-label="Primary sources VitalCV reads" data-home-source-strip="" className="border-y border-[var(--vt-border-subtle)] py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
            <p className="mz-eyebrow shrink-0">Reads primary sources</p>
            <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {SOURCE_REGISTRY_STRIP.map((name) => (
                <li key={name} className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--vt-text-secondary)]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--vt-accent-emerald)]" />{name}
                </li>
              ))}
            </ul>
            <p className="shrink-0 text-[11px] text-[var(--vt-text-muted)]">Every field shows its state.</p>
          </div>
        </section>

        <StickyProductStory />

        <div className="pt-20" data-home-experience="evidence-trace">
          <EvidenceTruthPanel />
        </div>

        <ProductCarousel />

        <section id="employers" data-home-experience="metrics-and-cta" className="pt-20">
          <MetricStrip />
          <DualAudienceCta />
        </section>

        <nav aria-label="Trust footer" data-home-trust-footer="" className="mt-16 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--vt-border-subtle)] pt-6 text-[12px] text-[var(--vt-text-muted)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Trust</span>
          {TRUST_FOOTER_LINKS.map((link, index) => (
            <React.Fragment key={link.href}>
              {index > 0 ? <span aria-hidden="true" className="text-[var(--vt-border)]">·</span> : null}
              <Link href={link.href} className="font-medium text-[var(--vt-text-secondary)] underline-offset-4 hover:underline">{link.label}</Link>
            </React.Fragment>
          ))}
        </nav>
      </main>
    </div>
  );
}
