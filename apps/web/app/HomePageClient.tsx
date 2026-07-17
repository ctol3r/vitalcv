'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { SignedIn } from '@clerk/nextjs';
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
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
import { ScrollScrubHeading } from '@/components/motion/ScrollScrubHeading';
import { ScrollTypeNarrative } from '@/components/home/ScrollTypeNarrative';
import { StickyProductStory } from '@/components/home/StickyProductStory';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { checkNpi } from '@/lib/vital/npi';
import { cn } from '@/lib/utils';

/**
 * The Career Evidence Network graph, in the hero.
 *
 * It reads window/matchMedia/canvas at mount, so ssr:false keeps it off the
 * server render path (same contract as /evidence-network). It renders its own
 * "N nodes · M links · illustrative structure" footer, so the honesty label
 * travels with the canvas even though the control panel is closed here — the
 * hero is a first impression, not an exploration surface. /evidence-network
 * remains the full explorable version.
 */
const CareerGraph = dynamic(() => import('@/components/career-graph/CareerGraph'), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" className="h-full w-full rounded-[14px] border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)]" />
  ),
});

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

export default function HomePageClient() {
  const [raw, setRaw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(false);
  const [submittedNpi, setSubmittedNpi] = React.useState<string | null>(null);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  // Canonical validation (lib/vital/npi): the hero previously enabled submit on
  // ANY 10 digits while Passport checksum-validated — one shared rule now. A
  // full-length value that fails the CMS check digit is a typo; catching it
  // here saves a doomed lookup and says so in plain words.
  const npiCheck = checkNpi(raw);
  const isFull = digits.length === 10;
  const isValid = npiCheck.validity === 'valid';

  const handleSubmit = React.useCallback(() => {
    if (!isValid || !npiCheck.npi) {
      setError(npiCheck.reason ?? 'Enter a full 10-digit NPI.');
      return;
    }
    setError(null);
    try {
      window.sessionStorage.setItem('onboarding_npi', npiCheck.npi);
      window.localStorage.setItem('onboarding_npi', npiCheck.npi);
    } catch {
      // The lookup still works when storage is unavailable.
    }
    setSubmittedNpi(npiCheck.npi);
  }, [isValid, npiCheck.npi, npiCheck.reason]);

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

      <main className="mz-scale-lg relative mx-auto w-full max-w-[1320px] px-4 pb-14 pt-4 sm:px-6 sm:pt-6">
        {/* The NPI action belongs in the first viewport. Hero motion is a
            progressive enhancement, never a reason to reserve blank runway. */}
        <section
          id="wallet"
          aria-label="NPI lookup"
          data-home-hero=""
          className="hero-compact mz mz-paper mz-persona-holder relative"
        >
          <div
            data-home-hero-stage=""
            className="hero-stage relative isolate grid min-h-[min(46rem,calc(100svh-11rem))] items-center gap-8 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:py-6"
          >
          <div className="max-w-3xl">
            <div className="space-y-4">
              <p data-home-eyebrow="" className="mz-eyebrow">The clinician career evidence network</p>
              {/* Palantir register: the H1 types out character by character,
                  then the narrative sentence below picks up the caret.
                  startDelayMs ≈ the H1's typing time (51 chars × 26ms) + a beat. */}
              <ScrollScrubHeading
                as="h1"
                variant="type"
                className="mz-display"
                data-home-hero-h1=""
                text="Find the opportunity. Prove your career once. Start faster."
                accentWords={['once.']}
                accentColor="var(--accent)"
              />
              <ScrollTypeNarrative
                data-home-hero-subhead=""
                className="max-w-2xl text-[21px] leading-[1.5] text-[var(--vt-text-secondary)]"
                prefix="VitalCV "
                phrases={HERO_PHRASES}
                staticSentence="VitalCV recognizes your identity, checks the primary sources, shows what still needs review, matches the right opportunity, and carries your evidence forward."
                startDelayMs={1650}
              />
            </div>

            <div className="mz-glass mz-glass-interactive mt-5 max-w-2xl rounded-[12px]">
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
                      <span aria-hidden="true" className={cn('flex items-center justify-center pb-4 px-4 transition-opacity sm:pb-0 sm:pl-0 sm:pr-2', isValid ? 'opacity-100' : 'opacity-0')}>
                        <CheckCircle2 size={22} className="text-[var(--vt-accent-emerald)]" />
                      </span>
                      <button
                        type="submit"
                        data-home-primary-cta=""
                        disabled={!isValid}
                        className={cn(
                          'inline-flex h-14 items-center justify-center gap-2 border-t border-[var(--vt-border)] px-5 text-[13px] font-semibold sm:border-l sm:border-t-0 sm:px-6',
                          isValid ? 'bg-[var(--vt-text-primary)] text-[var(--vt-bg)]' : 'cursor-not-allowed bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
                        )}
                      >
                        Check readiness <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </form>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--vt-text-secondary)]">
                    <span className={error ? 'text-[var(--vt-state-blocked)]' : undefined} role={error ? 'alert' : undefined} id={error ? 'home-npi-error' : undefined}>
                      {error ??
                        (isValid
                          ? 'Press Enter to continue'
                          : isFull
                            ? (npiCheck.reason ?? 'Check the number for a typo.')
                            : `${digits.length}/10 digits`)}
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
              <Link href="/onboarding" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--vt-text-primary)] px-4 py-2 font-semibold text-[var(--vt-bg)]">
                <Wallet size={14} aria-hidden="true" /> Get your free CV Wallet
              </Link>
              <span className="text-[var(--vt-text-muted)]">Free for clinicians · No card required</span>
            </div>
          </div>

          {/* The hero's living panel. Before a lookup it is the Career Evidence
              Network itself — the graph that was accidentally dropped from the
              homepage in the motion-convergence rewrite (#679), restored here as
              the first thing a visitor sees moving. After an NPI is entered it
              becomes that provider's live result. The static wallet mockup it
              replaced said nothing the copy didn't already say. */}
          {/* Light graph (Chris, 2026-07-17: "light like the background").
              transparentBg lets the paper surface show through the canvas and
              dissolves the edges into the card; the light theme's violet
              (issuer) + green (verifier) nodes carry the primary palette
              against paper. */}
          <div className={submittedNpi ? 'flex justify-center' : 'hidden lg:block'}>
            {submittedNpi ? (
              <LiveNpiResult npi={submittedNpi} onReset={() => { setSubmittedNpi(null); setRaw(''); }} />
            ) : (
              <div
                data-home-hero-graph=""
                className="relative h-[clamp(30rem,58vh,40rem)] w-full overflow-hidden rounded-[16px] border border-[var(--vt-border)] bg-[var(--vt-surface)] shadow-[0_30px_70px_-55px_rgba(20,20,20,0.4)]"
              >
                <CareerGraph initialTheme="light" initialPanelOpen={false} transparentBg narratedIntro />
                <Link
                  href="/evidence-network"
                  className="absolute bottom-3 left-3 z-[6] inline-flex items-center gap-1.5 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)]/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--vt-text-secondary)] backdrop-blur-sm hover:bg-[var(--vt-surface)]"
                >
                  Explore the network <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
          </div>
        </section>

        <section aria-label="Primary sources VitalCV reads" data-home-source-strip="" className="border-y border-[var(--vt-border-subtle)] py-3.5">
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

        <div className="pt-8" data-home-experience="evidence-trace">
          <EvidenceTruthPanel />
        </div>

        <ProductCarousel />

        <section id="employers" data-home-experience="metrics-and-cta" className="pt-8">
          <MetricStrip />
          <DualAudienceCta />
        </section>

        <nav aria-label="Trust footer" data-home-trust-footer="" className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--vt-border-subtle)] pt-6 text-[12px] text-[var(--vt-text-muted)]">
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
