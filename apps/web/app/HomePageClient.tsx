'use client';

import * as React from 'react';
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
import { CareerEvidenceField } from '@/components/home/CareerEvidenceField';
import { EvidenceTruthPanel } from '@/components/home/EvidenceTruthPanel';
import { HeroLoopPills } from '@/components/home/HeroLoopPills';
import { HomepageSectionRail } from '@/components/home/HomepageSectionRail';
import { LiveNpiResult } from '@/components/home/LiveNpiResult';
import { MetricStrip } from '@/components/home/MetricStrip';
import { ProblemStatBand } from '@/components/home/ProblemStatBand';
import { ProductCarousel } from '@/components/home/ProductCarousel';
import { ResumeToProof } from '@/components/home/ResumeToProof';
import { RotatingProofLine } from '@/components/home/RotatingProofLine';
import { ScrollFocusManifesto } from '@/components/home/ScrollFocusManifesto';
import { SourceCoverageRibbon } from '@/components/home/SourceCoverageRibbon';
import { ScrollTypeNarrative } from '@/components/home/ScrollTypeNarrative';
import { StickyProductStory } from '@/components/home/StickyProductStory';
import { TimeToStartComparison } from '@/components/home/TimeToStartComparison';
import { Reveal } from '@/components/motion/Reveal';
import { AmbientField } from '@/components/home/scene/AmbientField';
import { ChapterProgressProvider } from '@/components/home/scene/ChapterProgress';
import { GrainOverlay } from '@/components/home/scene/GrainOverlay';
import { MagneticButton } from '@/components/home/scene/MagneticButton';
import { SceneBoundary } from '@/components/home/scene/SceneBoundary';
import { SceneCursor } from '@/components/home/scene/SceneCursor';
import { SceneProvider } from '@/components/home/scene/SceneProvider';
import { getChapterScene } from '@/components/home/scene/registry';
import { CLERK_PROVIDER_ENABLED } from '@/lib/auth/clerkConfig';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { checkNpi } from '@/lib/vital/npi';
import { cn } from '@/lib/utils';


const TRUST_FOOTER_LINKS = [
  { label: 'Status', href: '/status' },
  { label: 'Source attribution', href: '/trust/attribution' },
  { label: 'Evidence network', href: '/evidence-network' },
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
    <SceneProvider>
    {/* SHD-1.3: ONE scroll model. The dot rail and the ambient field both
        consume this driver; neither owns a private scroll listener. */}
    <ChapterProgressProvider>
    <div className="mz mz-paper relative overflow-x-clip text-[var(--vt-text-primary)]">
      <div aria-hidden="true" className="mz-dotgrid pointer-events-none absolute inset-x-0 top-0 h-[26rem] opacity-20" />

      {/* SHD-1.2 scene layer: the page-level career-evidence atmosphere
          (manifest rows 1–3, 23). Fixed to the viewport like the source's
          full-page shader, painted UNDER all positioned content. Decorative
          only — the poster gradient stands alone on the static tier, and the
          grain is a baked SVG texture, not a render loop. */}
      <div aria-hidden="true" data-home-scene="" className="pointer-events-none fixed inset-0">
        <SceneBoundary poster={<div className="scene-ambient-poster" />} className="absolute inset-0">
          {() => <AmbientField />}
        </SceneBoundary>
        <GrainOverlay opacity={getChapterScene('wallet').grain} />
      </div>
      <SceneCursor />

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

      {/* The right-edge dot rail is the sole page-level in-page navigator
          (AUD-1.2). The former left-floating "Page outline" was removed: at
          desktop width it overlaid the first lines of major headings. The
          header covers site destinations; StickyProductStory's 01–05 controls
          are local story-step controls only. */}
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
              {/* Typing effect reverted (Chris, 2026-07-17 pm): the H1 is
                  static ink again and the sentence below scrubs with scroll. */}
              <h1 className="mz-display">
                Find the opportunity. Prove your career <em className="mz-accent">once.</em> Start faster.
              </h1>
              <ScrollTypeNarrative
                data-home-hero-subhead=""
                className="max-w-2xl text-[21px] leading-[1.5] text-[var(--vt-text-secondary)]"
                prefix="VitalCV "
                phrases={HERO_PHRASES}
                staticSentence="VitalCV recognizes your identity, checks the primary sources, shows what still needs review, matches the right opportunity, and carries your evidence forward."
                scrollContainerId="wallet"
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
              {/* Magnetic affordance (SHD-1.2, manifest row 7): pure translate
                  on a wrapper; the Link keeps its own semantics and focus. */}
              <MagneticButton>
                <Link href="/onboarding" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--vt-text-primary)] px-4 py-2 font-semibold text-[var(--vt-bg)]">
                  <Wallet size={14} aria-hidden="true" /> Get your free CV Wallet
                </Link>
              </MagneticButton>
              <span className="text-[var(--vt-text-muted)]">Free for clinicians · No card required</span>
            </div>

            {/* SHD-2.2: a quiet employer entry beside the clinician action.
                Subdued so the NPI lookup stays visually and semantically
                primary; routed to the real /employers destination (no
                speculative onboarding). Distinct data hook + funnel event so
                the two sides of the hero conversion stay distinguishable. */}
            <p className="mt-3 text-[13px] text-[var(--vt-text-secondary)]">
              <Link
                href="/employers"
                data-home-employer-cta=""
                onClick={() => trackFunnelEvent(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED)}
                className="inline-flex items-center gap-1 font-medium underline decoration-[var(--vt-border)] underline-offset-4 transition-colors hover:decoration-[var(--vt-text-secondary)]"
              >
                For employers — start review from evidence
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </p>
          </div>

          {/* The hero's living panel. Before a lookup it is the Career Evidence
              Network itself — the graph that was accidentally dropped from the
              homepage in the motion-convergence rewrite (#679), restored here as
              the first thing a visitor sees moving. After an NPI is entered it
              becomes that provider's live result. */}
          {/* VHS-1 Career Evidence Field (Chris, 2026-07-18): the hero's
              force-directed graph is replaced by an abstract generative field —
              source signals converging into a wallet capsule, arcs out to
              opportunity + one bounded acceptance ring. The explorable graph
              moves to /evidence-network (linked from the trust footer). On
              mobile the field follows the form; on desktop it fills the panel. */}
          <div className={submittedNpi ? 'flex justify-center' : 'block'}>
            {submittedNpi ? (
              <LiveNpiResult npi={submittedNpi} onReset={() => { setSubmittedNpi(null); setRaw(''); }} />
            ) : (
              // SHD-2.2: the field responds to SAFE, non-sensitive input state
              // only — the caret being present ('listening') and a valid
              // checksum ('ready'). No clinician-specific claim is ever
              // rendered before a real lookup returns.
              <CareerEvidenceField signal={focused ? (isValid ? 'ready' : 'listening') : 'idle'} />
            )}
          </div>
          </div>
        </section>

        {/* The deck's four-stage career loop as a connected pill strip. Placed
            just below the hero (not inside it) so it never pushes the NPI action
            below the opening laptop viewport — the compact-hero contract. */}
        <div className="pt-5">
          <HeroLoopPills />
        </div>

        <SourceCoverageRibbon />

        {/* Visible uplift: static sections rise+fade as they enter view (the
            template's reveal grammar via the platform Reveal primitive —
            reduced-motion-safe, shows content if JS/IO is unavailable). The
            scroll-COUPLED sections (manifesto, product story, ribbon) keep
            their own motion and are deliberately not wrapped. */}
        <Reveal><ProblemStatBand /></Reveal>

        {/* The reframe: résumé = form, VitalCV = system. Scroll-focus prose +
            the hand-drawn form/systems diagram (Chris, 2026-07-18). */}
        <ScrollFocusManifesto />

        <Reveal><TimeToStartComparison /></Reveal>

        <StickyProductStory />

        <Reveal className="pt-8" data-home-experience="evidence-trace">
          <EvidenceTruthPanel />
        </Reveal>

        {/* Kinetic reusable-evidence beat (UIverse word-cycler, MIT). */}
        <RotatingProofLine />

        <Reveal><ProductCarousel /></Reveal>

        <Reveal><ResumeToProof /></Reveal>

        <section id="employers" data-home-experience="metrics-and-cta" className="pt-14">
          <Reveal><MetricStrip /></Reveal>
          <Reveal delay={90}><DualAudienceCta /></Reveal>
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
    </ChapterProgressProvider>
    </SceneProvider>
  );
}
