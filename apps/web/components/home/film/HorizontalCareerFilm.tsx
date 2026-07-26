'use client';

import * as React from 'react';
import Link from 'next/link';

import { checkNpi } from '@/lib/vital/npi';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { detectCapabilities, resolveTier, type SceneTier } from '@/components/home/scene/capabilities';
import { LiveNpiResult } from '@/components/home/LiveNpiResult';
import { TruthBoundary } from '@/components/home/TruthBoundary';
import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';
import { EvidenceAtmosphere } from './EvidenceAtmosphere';
import { FilmRecord } from './FilmRecord';
import { FilmFit } from './FilmFit';
import { FilmSignature } from './FilmSignature';
import { FILM_SCENES, sceneAt } from './scenes';
import { useFilmProgress } from './useFilmProgress';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * HorizontalCareerFilm (COMPETE-1).
 *
 * The homepage acquisition experience as ONE continuous left-to-right
 * composition driven by ordinary vertical scroll. Six scenes; no card deck, no
 * carousel, no graph, no section taxonomy.
 *
 * This RECOMPOSES existing capability rather than layering over it — the NPI
 * lookup, `LiveNpiResult`, `HomeProofMoment`, `TruthBoundary`, and
 * `DualAudienceCta` are the same real surfaces the current homepage ships. What
 * changes is that they are scene events instead of stacked sections. Retired
 * here: `RailJourney`/`HorizontalStoryRail` (R2) and `MetricStrip` (R4, see the
 * C5 ruling in docs/design/homepage-composition-ownership.md).
 *
 * Fallback contract (composition-ownership §3): the DOM below is a linear,
 * SSR-complete vertical document. The film is a TRANSFORM applied to it after
 * hydration on eligible desktop — never a different document. With no JS, a
 * coarse pointer, reduced motion, or a narrow viewport, what remains is an
 * ordinary readable page in the same order.
 */

const TRUST_FOOTER_LINKS = [
  { label: 'Status', href: '/status' },
  { label: 'Source attribution', href: '/trust/attribution' },
  { label: 'Evidence network', href: '/evidence-network' },
  { label: 'Trust', href: '/trust' },
] as const;

/**
 * The four facts that survive `MetricStrip`'s retirement (C5). They are live
 * system facts, so they render as quiet ink — never as animated counters, and
 * never with the banned two-digit step grammar.
 */
const CHOICE_FACTS = [
  'Three federal source lanes',
  'Four readiness dimensions',
  'One record you own',
  'No account required to look',
] as const;

/**
 * The homepage's source-freshness statement, in one sentence of ink.
 *
 * Retiring `MetricStrip` and `SourceCoverageRibbon` from the composition also
 * removed every cadence claim from `/` — the corrected labels from the
 * freshness work (#822/#817/#824) stopped appearing at all. Nothing false was
 * left behind, but "three federal source lanes" without cadence invites exactly
 * the reading that work existed to prevent: that all three are read live.
 *
 * R4 retires counter THEATRE, not source honesty, so the fact returns as a
 * sentence rather than a marquee or a numbered strip. It is DERIVED from
 * `lib/trust/sourceLanes.ts` — the same registry behind /status and
 * /api/status — so a lane's cadence cannot drift from what the homepage says.
 */
function sourceCadenceSentence(): string {
  const label = (id: string) =>
    SOURCE_LANE_OPS.find((lane) => lane.laneId === id)?.cadenceLabel ?? 'not read';
  return (
    `NPPES is ${label('nppes_identity')} per request; ` +
    `OIG/LEIE returns a ${label('oig_exclusions')} and CMS PECOS a ${label('pecos_enrollment')}; ` +
    `state licensure is ${label('state_license')}.`
  );
}

function useSceneTier(): SceneTier {
  // 'static' until capabilities are proven — SSR and the first client render
  // must agree, and nothing animates before it is known to be safe.
  const [tier, setTier] = React.useState<SceneTier>('static');

  React.useEffect(() => {
    const apply = () => setTier(resolveTier(detectCapabilities(window)));
    apply();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', apply);
    return () => motion.removeEventListener('change', apply);
  }, []);

  return tier;
}

/**
 * Kinetic editorial type. Each word carries its own delay off the scene's local
 * progress, so the phrase assembles rather than fading in as a block.
 *
 * The full phrase is always in the DOM as one text node for assistive tech (the
 * animated spans are aria-hidden), so the treatment can never cost a screen
 * reader the sentence.
 */
function KineticPhrase({ text, local, live }: { text: string; local: number; live: boolean }) {
  const words = React.useMemo(() => text.split(' '), [text]);

  return (
    <span className="film-kinetic">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="film-kinetic-words">
        {words.map((word, i) => {
          const start = (i / Math.max(1, words.length)) * 0.45;
          const t = live ? Math.min(1, Math.max(0, (local - start) / 0.55)) : 1;
          return (
            <span
              key={`${word}-${i}`}
              className="film-kinetic-word"
              style={{ opacity: t, transform: `translate3d(0, ${(1 - t) * 0.42}em, 0)` }}
            >
              {word}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function HorizontalCareerFilm() {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const runwayRef = React.useRef<HTMLDivElement | null>(null);
  const arrivalRef = React.useRef<HTMLElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const tier = useSceneTier();

  /**
   * Publish the height of the pinned site chrome as `--film-chrome`.
   *
   * The stage is sticky, and the nav above it is `sticky top-0` too. Without
   * this the stage pinned at 0 and stood a full 100vh, so the nav sat on top of
   * every scene's first 78px and the opening frame overhung the fold by the
   * height of the announcement bar. Measuring the real element is what makes it
   * correct at every breakpoint, and correct again after the bar is dismissed.
   */
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const header = document.querySelector('header');
      // Only chrome that STAYS counts — a banner that scrolls away must not
      // permanently shorten the stage.
      const pinned =
        header && getComputedStyle(header).position === 'sticky'
          ? Math.round(header.getBoundingClientRect().height)
          : 0;
      root.style.setProperty('--film-chrome', `${pinned}px`);
    };

    measure();
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    const header = document.querySelector('header');
    if (header) observer.observe(header);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  // Reduced motion resolves to the 'static' tier, which is also the signal to
  // stop driving the film — one condition, not two that can disagree.
  const { progress, eligible, ready } = useFilmProgress(runwayRef, tier !== 'static');

  const [pointer, setPointer] = React.useState<{ x: number; y: number } | null>(null);
  const [raw, setRaw] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submittedNpi, setSubmittedNpi] = React.useState<string | null>(null);

  // The funnel's denominator.
  React.useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
  }, []);

  // Layout mode follows ELIGIBILITY, never `pinned` — see useFilmProgress.
  const isFilm = ready && eligible && tier !== 'static';
  const { index, local } = sceneAt(progress);

  const onPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPointer({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }, []);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const npiCheck = checkNpi(raw);
  const isValid = npiCheck.validity === 'valid';

  /**
   * Carry the reader between the question and their answer.
   *
   * The lookup renders in the RECOGNITION scene, which in film mode sits one
   * full viewport to the right of the arrival scene. Without this, submitting
   * an NPI rendered the result off-screen with the page unmoved — the primary
   * action of the page appeared to do nothing. (Measured: result in the DOM,
   * `left = 1440`, `scrollY = 0`.) Reset has the same problem mirrored: it
   * clears the field the reader can no longer see.
   *
   * The film is driven by ordinary scroll position, so both directions move the
   * SCROLL — never the track transform directly, which would desynchronise the
   * driver from the window and break rule 4 in useFilmProgress.
   */
  const scrollToScene = React.useCallback(
    (sceneIndex: number, fallback: React.RefObject<HTMLElement | null>) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';

      if (isFilm && runwayRef.current) {
        const rect = runwayRef.current.getBoundingClientRect();
        const travel = rect.height - window.innerHeight;
        if (travel > 0) {
          const target = sceneIndex / Math.max(1, FILM_SCENES.length - 1);
          window.scrollTo({ top: rect.top + window.scrollY + target * travel, behavior });
          return;
        }
      }
      // Vertical composition: scenes are ordinary blocks in document flow.
      fallback.current?.scrollIntoView({ behavior, block: 'start' });
    },
    [isFilm],
  );

  // Only a TRANSITION should move the reader — not the initial mount, and not
  // an unrelated re-render.
  //
  // Submitting no longer travels anywhere: the result renders in the arrival
  // scene, in place of the empty record, so the reader stays exactly where they
  // typed. Carrying someone to a second frame to be told their own answer was
  // the reason that frame existed, and the reason it was blank for everyone who
  // had not typed yet. Reset still returns to arrival, because a reset from
  // deeper in the film should bring the field back into view.
  const previousNpi = React.useRef<string | null>(null);
  React.useEffect(() => {
    const had = previousNpi.current;
    previousNpi.current = submittedNpi;
    if (had && !submittedNpi) scrollToScene(0, arrivalRef);
  }, [submittedNpi, scrollToScene]);

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
    <div
      ref={rootRef}
      className="film"
      data-film-mode={isFilm ? 'film' : 'vertical'}
      data-film-tier={tier}
    >
      {/* Route-scoped paper. Cloud Dancer is the unifying field; it unmounts
          with the route so no other surface inherits it. */}
      <style>{'body{background:var(--vt-cloud-dancer,#F0EEE9)}'}</style>

      {/* Runway height scales with the scene count so travel stays one
          viewport per transition. Inline rather than in CSS precisely so it
          cannot drift out of sync when a scene is added or removed. */}
      <div
        ref={runwayRef}
        className="film-runway"
        style={isFilm ? { height: `${FILM_SCENES.length * 100}vh` } : undefined}
      >
        <div
          ref={stageRef}
          className="film-stage"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setPointer(null)}
        >
          <EvidenceAtmosphere progress={progress} tier={tier} pointer={pointer} />

          {/* The cursor as a reading light. Decorative, pointer-events-none,
              and absent entirely unless a mouse is present. */}
          {pointer && tier !== 'static' ? (
            <div
              aria-hidden="true"
              className="film-readinglight"
              style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}
            />
          ) : null}

          <div
            className="film-track"
            style={
              isFilm
                ? { transform: `translate3d(-${progress * (FILM_SCENES.length - 1) * 100}%, 0, 0)` }
                : undefined
            }
          >
            {FILM_SCENES.map((scene, i) => {
              // In vertical mode every scene is fully seated; in film mode only
              // the active pair is animating.
              const sceneLocal = !isFilm
                ? 1
                : i === index
                  ? 1 - local
                  : i === index + 1
                    ? local
                    : 0;
              const isActive = isFilm && (i === index || (i === index + 1 && local > 0));

              return (
                <section
                  key={scene.id}
                  // Scroll targets for the vertical composition, where scenes are
                  // ordinary blocks rather than positions along the runway.
                  ref={scene.id === 'arrival' ? arrivalRef : undefined}
                  className="film-scene"
                  /* `data-home-hero` on the arrival scene is the release marker
                     `scripts/deploy-smoke.mjs:115` greps out of the raw
                     production response to prove `/` actually rendered. It is
                     deliberately composition-agnostic — it rode the old vertical
                     hero and it rides the arrival scene now — because a deploy
                     check that must be rewritten for every redesign is one that
                     silently stops working. It did: between #859 and this commit
                     the film carried no such marker and the homepage smoke
                     assertion was failing against production. Do not remove
                     without re-pointing deploy-smoke.mjs in the same change. */
                  data-film-scene={scene.id}
                  data-film-active={isActive ? '' : undefined}
                  {...(scene.id === 'arrival' ? { 'data-home-hero': '' } : null)}
                  aria-label={scene.label}
                >
                  <div className="film-copy">
                    {/* The opening phrase is the page's H1. Every scene rendering
                        an <h2> left the homepage with NO top-level heading at
                        all — a document-outline and SEO regression against the
                        composition this replaces, which had one. The heading
                        LEVEL is structural; `.film-phrase` sets margin and
                        font-size explicitly, so the visual is unchanged. */}
                    {React.createElement(
                      i === 0 ? 'h1' : 'h2',
                      { className: 'film-phrase' },
                      <KineticPhrase text={scene.phrase} local={sceneLocal} live={isFilm} />,
                    )}
                    {scene.support ? <p className="film-support">{scene.support}</p> : null}

                    {/* ---- Arrival: the ONE primary action ----
                         Hidden once a lookup returns. Leaving the field sitting
                         above the answer invites re-entry of a number that has
                         already been answered; `LiveNpiResult` owns the reset
                         that brings it back. */}
                    {scene.id === 'arrival' && !submittedNpi ? (
                      <form
                        className="film-npi"
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleSubmit();
                        }}
                      >
                        <label htmlFor="film-npi-input" className="film-npi-label">
                          Start with your NPI
                        </label>
                        {/* A designed object inside the scene — a ruled line on
                            paper, not a boxed form card beside a visual. */}
                        <div className="film-npi-row">
                          <input
                            id="film-npi-input"
                            className="film-npi-input"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="10-digit NPI"
                            value={raw}
                            onChange={(event) => {
                              setRaw(event.target.value);
                              setError(null);
                            }}
                            aria-invalid={Boolean(error)}
                            aria-describedby="film-npi-hint"
                          />
                          <button
                            type="submit"
                            className="film-npi-submit"
                            data-home-primary-cta=""
                            disabled={!isValid}
                          >
                            Check what&rsquo;s ready
                          </button>
                        </div>
                        <p
                          id="film-npi-hint"
                          className="film-npi-hint"
                          role={error ? 'alert' : undefined}
                        >
                          {error ??
                            (digits.length === 10
                              ? isValid
                                ? 'Press Enter to continue'
                                : (npiCheck.reason ?? 'Check the number for a typo.')
                              : `${digits.length}/10 digits`)}
                          <span aria-hidden="true"> · </span>
                          Free for clinicians · No account required
                        </p>
                      </form>
                    ) : null}

                    {/* ---- Arrival: the REAL returned state, in place ----
                         The answer to the question the reader just asked, in the
                         frame they asked it in. Still the same hard rule as
                         before — this renders only when a real lookup has
                         returned, and nothing personal is invented to fill the
                         frame beforehand. What fills it beforehand is the empty
                         six-source record, which is true for that visitor. */}
                    {scene.id === 'arrival' && submittedNpi ? (
                      <div className="film-artifact">
                        <LiveNpiResult
                          npi={submittedNpi}
                          onReset={() => {
                            setSubmittedNpi(null);
                            setRaw('');
                          }}
                        />
                      </div>
                    ) : null}

                    {/* ---- Verification: the industry cost of NOT being
                         checkable. An industry benchmark, never a VitalCV
                         result, and worded so it cannot be read as one. ---- */}
                    {scene.id === 'verification' ? (
                      <p className="film-note">
                        VitalCV has not yet published a measured time-to-start
                        of its own. The first pilot will, and it will say so.
                      </p>
                    ) : null}

                    {/* ---- Choice: the four surviving facts, as quiet ink ---- */}
                    {scene.id === 'choice' ? (
                      <>
                        <ul className="film-facts">
                          {CHOICE_FACTS.map((fact) => (
                            <li key={fact}>{fact}</li>
                          ))}
                        </ul>
                        <p className="film-note" data-home-source-cadence="">
                          {sourceCadenceSentence()}
                        </p>
                      </>
                    ) : null}
                  </div>

                  {/* ---- Arrival: the empty record, gathering source light ----

                       COMPETE-2 asks each scene for "a large visual event, not
                       a component", and the mandate's brief for Arrival is
                       exactly this: an empty career core. Without it the
                       opening frame was a phrase in a narrow column beside
                       ~800px of blank paper, which reads as unfinished and
                       leaves the visitor with no idea what they are being
                       offered. The record answers that in one look, and it
                       fabricates nothing: it shows which sources exist and
                       stamps every one of them "Not checked", because for this
                       visitor none of them have been. */}
                  {scene.id === 'arrival' ? <FilmRecord live={isFilm} /> : null}

                  {/* ---- Better opportunities: the mechanism, not a match ----
                       The mandate forbids a fake role or employer before a
                       lookup, so this shows the SHAPE of the answer: every
                       requirement resolves to your record, to a gap, or to the
                       employer. The third row is the boundary that makes the
                       first two believable. */}
                  {scene.id === 'opportunities' ? <FilmFit /> : null}

                  {/* ---- Check it without asking us ----
                       The one thing neither Medallion nor Carefam can answer.
                       Real, live, and checkable in a click: ES256 signatures
                       and a published key. Plain words only — no chain, wallet,
                       or DID vocabulary in the acquisition path. */}
                  {scene.id === 'verification' ? <FilmSignature /> : null}

                  {/* ---- Wide artifacts sit beside the copy, not inside it ----

                       Deliberately `ProofPacketInspector`, NOT its
                       `HomeProofMoment` wrapper: that wrapper is a vertical
                       PAGE SECTION and brings its own numbered eyebrow ("04
                       Why this is credible" — R4 + R6) and a second display
                       H2 that competes with the scene's phrase. The film wants
                       the artifact, not the section around it. Same reason
                       `DualAudienceCta` is not used below — it is a two-card
                       grid (R3) whose clinician CTA points at `/#npi`, an
                       anchor this composition does not have. */}
                  {scene.id === 'hiring' ? (
                    <div className="film-wide">
                      <ProofPacketInspector />
                      <TruthBoundary className="film-boundary" />
                    </div>
                  ) : null}

                  {scene.id === 'choice' ? (
                    <div className="film-wide">
                      {/* "CTAs only" — clinician primary, employer secondary. */}
                      <div className="film-routes">
                        <Link href="/onboarding" className="film-route film-route-primary">
                          Check my readiness
                        </Link>
                        <Link
                          href="/employers"
                          className="film-route"
                          data-home-employer-cta=""
                          onClick={() => trackFunnelEvent(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED)}
                        >
                          For employers
                        </Link>
                      </div>
                      <nav aria-label="Trust footer" className="film-trust">
                        {TRUST_FOOTER_LINKS.map((link) => (
                          <Link key={link.href} href={link.href}>
                            {link.label}
                          </Link>
                        ))}
                      </nav>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HorizontalCareerFilm;
