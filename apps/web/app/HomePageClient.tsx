'use client';

import * as React from 'react';
import Link from 'next/link';
import { SignedIn } from '@clerk/nextjs';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Fingerprint,
  Zap,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { DualAudienceCta } from '@/components/home/DualAudienceCta';
import { LiveNpiResult } from '@/components/home/LiveNpiResult';
import { MetricStrip } from '@/components/home/MetricStrip';
import { SourceCoverageRibbon } from '@/components/home/SourceCoverageRibbon';
import { TruthBoundary } from '@/components/home/TruthBoundary';
import { RailJourney } from '@/components/home/rail/RailJourney';
import { HomeProofMoment } from '@/components/home/HomeProofMoment';
import { TimeToStartComparison } from '@/components/home/TimeToStartComparison';
import { Reveal } from '@/components/motion/Reveal';
import { ChapterProgressProvider } from '@/components/home/scene/ChapterProgress';
import { GrainOverlay } from '@/components/home/scene/GrainOverlay';
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

  // NUM-1.6: the funnel's denominator. HOMEPAGE_VIEWED has been declared in
  // FUNNEL_EVENTS since the funnel was built but never fired from anywhere, so
  // every downstream rate (focus rate, submit rate, completion rate) had no
  // base to divide by. Fires once per mount, before any interaction.
  React.useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
  }, []);

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
    <div className="mz mz-paper mz-cloud-paper relative overflow-x-clip text-[var(--vt-text-primary)]">
      {/* Route-scoped paper: the PUBLIC homepage sits on Cloud Dancer
          (PANTONE 11-4201 web approximation, --vt-cloud-dancer). A page-level
          style tag keeps the document body behind overscroll on the same
          paper; it unmounts with the route, so signed-in, dark, and
          verification surfaces never inherit it. */}
      <style>{'body{background:var(--vt-cloud-dancer,#F0EEE9)}'}</style>
      <div aria-hidden="true" className="mz-dotgrid pointer-events-none absolute inset-x-0 top-0 h-[26rem] opacity-20" />

      {/* Scene layer — grain ONLY (homepage rebuild).
          The ambient colour field is retired here. It painted emerald at 12%
          and indigo at 10% as radial gradients on a `position: fixed` layer,
          so the tint stayed welded to the viewport while content scrolled past
          it: the top-left corner was permanently green-grey and the wash never
          travelled with a section. On a page whose paper is a single deliberate
          Cloud Dancer (--vt-cloud-dancer, #F0EEE9, uniform at every scroll
          offset), a fixed coloured veil is the one thing that can make that
          paper look inconsistent — so it goes.

          Atmosphere is now earned by CONTENT motion (the evidence graph, the
          horizontal journey) rather than by tinting the page. The grain stays:
          it is a baked SVG texture, not a colour, and it is what keeps a flat
          Cloud Dancer reading as paper instead of as a blank div. */}
      <div aria-hidden="true" data-home-scene="" className="pointer-events-none fixed inset-0">
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
          (AUD-1.2 → W2.3). The former left-floating "Page outline" and the
          right-edge dot rail are both retired: the horizontal journey rail's
          own chapter navigator is now the ONE page-level in-page navigator
          (composition manifest + gate test). The header covers site
          destinations; vertical fallbacks navigate by document order. */}

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
            /* Sized to its content, not to the viewport. A full-height stage
               centred a ~300px text column in 780px and left 239px of dead air
               above the headline — the first screen read as having sunk. This
               lands the headline in the upper third and lets the next section
               crest the fold, which is the invitation to scroll. */
            className="hero-stage relative isolate min-h-[min(38rem,calc(100svh-9rem))] py-2"
          >
          <div className="max-w-2xl">
            <div className="space-y-5">
              {/* HERO-RESET-1: outcome first. The category eyebrow and the
                  scroll-scrubbed system sentence are gone — a clinician must
                  answer "what do I get?" and "what do I do?" at a glance,
                  before any category language. Category framing now lives in
                  the product story below the fold. */}
              <h1 className="mz-display mz-display-hero">
                Get hired <em className="mz-accent">faster.</em>
              </h1>
              <p
                data-home-hero-subhead=""
                className="max-w-xl text-[21px] leading-[1.5] text-[var(--vt-text-secondary)]"
              >
                Start with your NPI. See what employers can confirm, fix what is
                missing, and reuse your career profile for every job.
              </p>
            </div>

            {/* One screen, one action. The NPI control is the ONLY interactive
                element in the first viewport — the wallet pill and the employer
                link moved down to DualAudienceCta, which already carries both
                entrances, and "For Employers" is in the site nav besides. The
                glass card around the field is gone for the same reason the
                evidence panel lost its fill: a box on paper competing with the
                thing inside it. */}
            <div id="npi" className="mt-8 max-w-xl scroll-mt-36">
              <div className="space-y-4">
                  <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
                    <label htmlFor="npi-input" className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--vt-text-muted)]">
                      Start with your NPI
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
                        Check what&rsquo;s ready <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </form>

                  {/* One quiet line, not three. The Sign in link left with it —
                      the site header already carries it, and the first screen
                      earns its calm by having exactly one thing to do. */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--vt-text-secondary)]">
                    <span className={error ? 'text-[var(--vt-state-blocked)]' : undefined} role={error ? 'alert' : undefined} id={error ? 'home-npi-error' : undefined}>
                      {error ??
                        (isValid
                          ? 'Press Enter to continue'
                          : isFull
                            ? (npiCheck.reason ?? 'Check the number for a typo.')
                            : `${digits.length}/10 digits`)}
                    </span>
                    <span aria-hidden="true" className="text-[var(--vt-border)]">·</span>
                    <span>Free for clinicians · No account required</span>
                  </div>
              </div>
            </div>

          </div>

          {/* The homepage makes no public graph claim. Before a lookup, the
              source strip below the hero names available lanes. After one, the
              real result is shown here in place — source state and the next
              action, not a speculative map of a clinician's career. */}
          {submittedNpi ? (
            <div className="mx-auto mt-8 max-w-sm lg:mx-0">
              <LiveNpiResult npi={submittedNpi} onReset={() => { setSubmittedNpi(null); setRaw(''); }} />
            </div>
          ) : null}
          </div>

          {/* The one thing the first screen asks for after the NPI field: a
              reason to keep going. Decorative and aria-hidden — the page is
              navigable by document order without it. */}
          <div
            data-home-scroll-cue=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center"
          >
            <span className="mz-scroll-cue text-[var(--vt-text-muted)]">
              <ChevronDown size={18} />
            </span>
          </div>
        </section>

        <SourceCoverageRibbon />

        {/* Visible uplift: static sections rise+fade as they enter view (the
            template's reveal grammar via the platform Reveal primitive —
            reduced-motion-safe, shows content if JS/IO is unavailable). The
            scroll-COUPLED sections (journey rail, ribbon) keep their own
            motion and are deliberately not wrapped. */}

        {/* THE PROBLEM — stated once.
            ProblemStatBand ("Healthcare hiring has a trust-liquidity problem")
            ran ~610px immediately above this section, which then argued the
            same point again with a sharper line and an actual comparison
            visual. Two H2s and ~1,000px to make one argument is the redundancy
            that made this page feel long without feeling full. The band is
            retired from the composition; the component stays on disk. */}
        <Reveal><TimeToStartComparison /></Reveal>

        {/* W2: THE career journey — four chapters through the horizontal rail
            on eligible desktop (native scroll → horizontal translate, rolodex
            leaves, one chapter navigator); the exact same chapters render
            vertically everywhere else. Replaces the vertical StickyProductStory
            runway, the loop-pill strip, the scroll-focus manifesto, and the
            word cycler (composition manifest dispositions, W2.1–W2.3). */}
        <RailJourney />

        {/* W4.2: the one tangible proof moment — the interactive proof-packet
            inspector (claim → source → retrieval/receipt → state → limitation),
            explicitly illustrative, linking the real clinician flow. Placed as
            the "why this is credible" beat right after the journey. */}
        {/* fade, NOT rise — this section now carries the scrub-coupled heading.
            mz-rise's scale(0.985) changes the heading's measured box while the
            reveal settles, which breaks the scrub contract "the text is laid
            out from the start, only its ink changes" (the scrub-headings CLS
            guard). Opacity-only keeps the uplift with stable geometry. This
            constraint travelled here with the heading from EvidenceTruthPanel,
            which carried the same comment for the same reason. */}
        <Reveal variant="fade"><HomeProofMoment /></Reveal>

        {/* The limitation that came off EvidenceTruthPanel when that section was
            retired. Redundant ARGUMENT is worth cutting; a redundant-looking
            DISCLAIMER is not — this names what VitalCV does and does not know,
            and it is the page's only enumerated statement that a packet is not
            a credentialing, privileging, or clearance decision. */}
        <Reveal delay={90} className="pt-6">
          <TruthBoundary />
        </Reveal>

        {/* THE PROOF — also stated once.
            EvidenceTruthPanel ("Every claim shows its source", ~811px) sat
            directly below HomeProofMoment ("Inspect the proof, claim by
            claim"), making the same argument twice in a row — the second and
            larger instance of the page's redundancy problem. HomeProofMoment
            wins the slot because it is the INTERACTIVE one: a real proof-packet
            inspector (claim → source → retrieval → state → limitation) instead
            of a static restatement. EvidenceTruthPanel stays on disk.

            ProductCarousel ("One career record. Six reusable surfaces.")
            is retired here too — a six-panel feature carousel is a product-tour
            device, and it was the third pass at "look what the record can do"
            after the journey rail had already walked through it in four
            chapters. Its evidence-state glyph grammar is a real contract, so
            that guard moves rather than disappears (see homepage-truth-pass).

            ResumeToProof was retired earlier for the same reason: 25 words and
            200px restating the old-way / new-way contrast the rail carries. */}

        <section id="employers" data-home-experience="metrics-and-cta" className="pt-14">
          <Reveal><MetricStrip /></Reveal>
          <Reveal delay={90}>
            <DualAudienceCta
              onEmployerClick={() => trackFunnelEvent(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED)}
            />
          </Reveal>
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
