'use client';

/**
 * EasyHome — the `/` production experience (Direction A, amendment E).
 *
 * The Direction A recomposition: warm paper, ink, one hot action colour,
 * Geist display type, and six drawn self-labelling figures in place of the
 * D.7 frosted folio. The hero states the thesis — Enter your NPI. VitalCV
 * does the rest. — beside Figure 1 (where the record comes from); the live
 * opportunity feed renders as Roles framed by the match-explanation figure;
 * the dark band keeps its seven pinned steps with the approval-boundary and
 * reuse figures as its drawn material; and the standing watch states the
 * clinician-does-nothing thesis to the limit of what the product truthfully
 * does.
 *
 * The NPI entry is the same real flow the previous homepage ran: checkNpi
 * gates format locally, /api/identity/bootstrap and /api/trust-state resolve
 * the person, the anonymous feed suggests roles, and "Keep this record" hands
 * the NPI to /onboarding. No API, auth, consent, or data behavior changes
 * here — this file is presentation over the existing hook.
 *
 * Truth contract carried forward, not relaxed: every figure is labelled
 * illustrative with a hidden transcript, every value in every figure is a
 * blank bar, opportunities are loaded from the live provenance-bearing public
 * API, and institution review remains an unresolved employer decision.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import Attribution from '@/components/home/easy/Attribution';
import CareerMobilitySequence from '@/components/home/easy/CareerMobilitySequence';
import CyclingWord from '@/components/home/easy/CyclingWord';
import FigureMarkers from '@/components/home/easy/figures/FigureMarkers';
import { NpiReveal, ResolvingNarration } from '@/components/home/easy/NpiReveal';
import OpportunityHorizon from '@/components/home/easy/OpportunityHorizon';
import Questions from '@/components/home/easy/Questions';
import StandingWatch from '@/components/home/easy/StandingWatch';
import WorkSurface from '@/components/home/easy/WorkSurface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { useCareerLoop } from '@/lib/career-loop/useCareerLoop';
import { writeNpiHandoff } from '@/lib/onboarding/npiHandoff';
import { sourceCadenceSentence } from '@/lib/trust/sourceCadence';

/**
 * The hero's one source of truth, lifted out of `NpiEntry` so BOTH hero
 * columns can read it.
 *
 * Why it moved (measured on production 2026-08-10): the entry column and the
 * stage column were siblings, and only the entry column could see the loop
 * state. So when the registry actually named someone — from a live NPPES
 * read — the real record appeared as a modest card under the form while the
 * dominant two-thirds of the hero kept playing an illustration of that same
 * story. The product's best moment was the smallest thing on the screen.
 *
 * Nothing about the pipeline changes here: same `useCareerLoop`, same real
 * `/api/identity/bootstrap` + `/api/trust-state` pairing, same capsule. This
 * is composition — who gets to render the result.
 */
function useHeroLoop() {
  const { state, onInput, submit, reset } = useCareerLoop();
  const [raw, setRaw] = useState('');
  // The recognition pacing (UX-05): `settled` goes false the moment a submit
  // starts and true only when the narration's floor elapses — so the reveal
  // never beats the narration, and fast networks still get the beat. Under
  // prefers-reduced-motion the floor is zero (the pacing hook settles
  // instantly), which preserves today's immediate result exactly.
  const [settled, setSettled] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const resolving = state.phase === 'resolving';
  const narrating = resolving || !settled;

  const handleChange = (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 10);
    setRaw(next);
    onInput(next);
  };

  const handleSubmit = () => {
    if (resolving) return;
    setSettled(false);
    setAttempt((a) => a + 1);
    void submit(raw);
  };

  const handleSettled = useCallback(() => setSettled(true), []);
  const handleReset = useCallback(() => {
    setRaw('');
    reset();
  }, [reset]);

  const profile = state.outcome === 'individual' ? state.profile : null;

  return {
    state, raw, digits, resolving, narrating, attempt, profile,
    handleChange, handleSubmit, handleSettled, handleReset,
  };
}

type HeroLoop = ReturnType<typeof useHeroLoop>;

function NpiEntry({
  state, raw, digits, resolving, narrating, profile,
  handleChange, handleSubmit, handleReset,
}: HeroLoop) {

  return (
    <div className="ezh-entry">
      {/* The one dark object on the paper page: the NPI entry card. Direction
          A's locked composition makes the real action the darkest thing in
          the viewport. */}
      <form
        className="ezh-npi-form ezh-npi-card"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <label className="ezh-k ezh-npi-k" htmlFor="ezh-npi">
          Your NPI
        </label>
        <div className="ezh-npi-row">
          <Input
            id="ezh-npi"
            className="ezh-npi-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="10 digits"
            value={raw}
            onChange={(event) => handleChange(event.target.value)}
          />
          <Button className="ezh-npi-submit" type="submit" data-home-primary-cta="" disabled={resolving}>
            {resolving ? 'Checking the registry…' : 'Start with your NPI'}
          </Button>
        </div>
        <p className="ezh-npi-count">{digits.length}/10 digits &middot; free, no account needed</p>
        {state.phase === 'invalid' && state.invalidReason ? (
          <p className="ezh-npi-note" role="status">{state.invalidReason}</p>
        ) : null}
        <p className="ezh-npi-fine">
          Free for clinicians. Your NPI is a public identifier &mdash; entering it starts nothing
          you don&rsquo;t approve.
        </p>
      </form>

      {/*
        The narration and the reveal render in the STAGE column — see
        `HeroStage`. They are the result, and the result belongs where the
        illustration of it sits, not underneath the form.
      */}

      {!narrating && state.outcome === 'organization' ? (
        <div className="ezh-result" role="status">
          <p className="ezh-result-name">This NPI names an organization.</p>
          <p className="ezh-result-note">
            VitalCV profiles start from an individual (Type&nbsp;1) NPI. Hiring for this
            organization? <Link href="/employers">VitalCV for employers</Link>.
          </p>
          <div className="ezh-result-actions">
            <button
              type="button"
              className="ezh-result-again"
              onClick={handleReset}
            >
              Check another NPI
            </button>
          </div>
        </div>
      ) : null}

      {!narrating && (state.outcome === 'unavailable' || state.phase === 'error') ? (
        <div className="ezh-result" role="status">
          <p className="ezh-result-name">The registry could not answer.</p>
          <p className="ezh-result-note">
            No result, an outage, and rate-limiting all look the same from here, so we won&rsquo;t
            guess. Try again in a moment.
          </p>
          <div className="ezh-result-actions">
            <button
              type="button"
              className="ezh-result-again"
              onClick={handleReset}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The hero's right-hand column — one slot, three states, never two at once.
 *
 *   idle       Figure 1: where the record comes from, captioned illustrative
 *   resolving  the process narration (what we are DOING, never a result)
 *   resolved   the REAL record the registry returned
 *
 * Figure 1 carries its own self-labelling caption, so the caption unmounts
 * with the figure the moment a live NPPES read names a person — the sentence
 * "no real people" never stands beside a real one.
 *
 * The organization / unavailable outcomes deliberately stay in the entry
 * column: they are answers about the NUMBER, not a record to display, and the
 * illustration should keep explaining the product while the visitor retries.
 */
function HeroStage({
  state, resolving, narrating, attempt, profile, handleSettled, handleReset,
}: HeroLoop) {
  if (narrating && attempt > 0 && state.phase !== 'invalid') {
    return <ResolvingNarration key={attempt} done={!resolving} onSettled={handleSettled} />;
  }

  if (!narrating && profile) {
    return (
      <NpiReveal
        profile={profile}
        capsule={state.capsule}
        isDemo={state.isDemo}
        onKeep={() => writeNpiHandoff(profile.npi)}
        onReset={handleReset}
      >
        {state.matchPhase === 'loading' ? (
          <p className="ezh-result-note">Finding roles that fit&hellip;</p>
        ) : null}
        {state.matchPhase === 'loaded' && state.matches.length > 0 ? (
          <ul className="ezh-result-matches">
            {state.matches.slice(0, 3).map((match) => (
              <li key={match.opportunityId || match.title} className="ezh-result-match">
                <p className="ezh-result-match-title">{match.title}</p>
                <p className="ezh-result-match-meta">
                  {[match.organizationName, match.location, match.hiringType]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {state.matchPhase === 'empty' ? (
          <p className="ezh-result-note">
            No open roles matched just now. The profile still moves you forward &mdash; keep it
            and VitalCV keeps watching.
          </p>
        ) : null}
        {state.matchPhase === 'error' ? (
          <p className="ezh-result-note">Role matching is unavailable right now.</p>
        ) : null}
      </NpiReveal>
    );
  }

  return <WorkSurface />;
}

export default function EasyHome() {
  const loop = useHeroLoop();

  useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
  }, []);

  return (
    <main className="ezh" data-home-variant="easy">
      <FigureMarkers />

      {/* ── 1 · hero: the thesis beside Figure 1 ─────────────────────────── */}
      <section
        id="npi"
        className="ezh-hero"
        data-home-hero=""
        data-header-theme="light"
        aria-label="VitalCV — enter your NPI"
      >
        <div className="ezh-wrap">
          <div className="ezh-hero-copy">
            <span className="ezh-hero-eyebrow">For US clinicians</span>
            <h1>Enter your NPI. VitalCV does the rest.</h1>
            <p className="ezh-payoff">
              <span aria-hidden="true">One profile. Every <CyclingWord />.</span>
              <span className="ezh-sr">
                One profile. Every role, shift, hospital, state, and application.
              </span>
            </p>
            <p className="ezh-hero-sub">
              We find what we can, show you exactly what remains, and handle the administrative
              work that can safely be handled. Then we keep it that way &mdash; and show you
              where your record could go next.
            </p>

            <NpiEntry {...loop} />

            <Link className="ezh-hero-opportunity" href="/explore" data-home-opportunity-cta="">
              Explore clinician opportunities <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="ezh-hero-stagecol" data-home-stage="">
            <HeroStage {...loop} />
          </div>
        </div>
      </section>

      {/* ── 2 · Roles: the live feed framed by the match figure ──────────── */}
      <OpportunityHorizon />

      {/* ── 3 · the truth boundary, in its own words ─────────────────────── */}
      <section
        className="ezh-truthline"
        data-header-theme="light"
        aria-label="What this page does not claim"
      >
        <div className="ezh-wrap">
          <p className="ezh-truth" data-home-truth-boundary="">
            Drawn illustrations; no real clinician, employer, or result; nothing has been sent,
            and institution review decides the outcome.
          </p>
        </div>
      </section>

      {/* ── 4 · the dark band: seven pinned steps, two drawn figures ─────── */}
      <CareerMobilitySequence />

      {/* ── 5 · the standing watch ───────────────────────────────────────── */}
      <StandingWatch />

      {/* ── 6 · ownership + attribution: whose move, and how a line got
          there. Two halves of the same trust story. ──────────────────────── */}
      <Attribution />

      {/* ── 7 · objections, answered at the end of the clinician run ─────── */}
      <Questions />

      {/* ── 8 · the employer doorway ─────────────────────────────────────── */}
      <section className="ezh-emp" data-header-theme="light" aria-labelledby="ezh-emp-h">
        <div className="ezh-wrap">
          <div className="ezh-sec-head">
            <span className="ezh-k">For employers</span>
            <h2 id="ezh-emp-h">Hiring clinicians?</h2>
          </div>
          <div className="ezh-emp-grid">
            <div className="ezh-emp-copy">
              <p>
                Find people who fit. Know what remains. Keep the hire moving. VitalCV shows your
                team exactly where each candidate stands &mdash; and who owns the next step.
              </p>
              <Link
                className="ezh-emp-cta"
                href="/employers"
                data-home-employer-cta
                onClick={() => trackFunnelEvent(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED)}
              >
                VitalCV for employers <span aria-hidden="true">&#8627;</span>
              </Link>
            </div>
            <ul className="ezh-emp-points">
              <li>
                <span className="ezh-tt">Find people who fit</span>
                <p>Search by what&rsquo;s on record, not what&rsquo;s on a r&eacute;sum&eacute;.</p>
              </li>
              <li>
                <span className="ezh-tt">Know what remains</span>
                <p>See the open items on any hire &mdash; and who owns each one.</p>
              </li>
              <li>
                <span className="ezh-tt">Keep the hire moving</span>
                <p>When it&rsquo;s your move, VitalCV makes that obvious too.</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── 9 · final action + footer composition ────────────────────────── */}
      <section className="ezh-start" data-header-theme="light" aria-labelledby="ezh-start-h">
        <div className="ezh-wrap">
          <div className="ezh-sec-head">
            <span className="ezh-k">Start</span>
            <h2 id="ezh-start-h">Start with your NPI</h2>
          </div>
          <div className="ezh-start-grid">
            {/* Fraunces survives on this route only as the serif editorial
                aside (amendment E, Display row). */}
            <p className="ezh-serif-aside">
              Your work travels with you. You do not start over.
            </p>
            <div>
              <a className="ezh-start-cta" href="#npi">
                Start with your NPI
              </a>
              <p className="ezh-start-fine">Free to start.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="ezh-foot">
        <div className="ezh-wrap ezh-foot-in">
          <span className="ezh-foot-mark">VitalCV</span>
          <nav className="ezh-foot-links" aria-label="Footer">
            <Link href="/employers">For employers</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/trust">Trust</Link>
            <Link href="/status">Status</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/sign-in">Sign in</Link>
          </nav>
          <p className="ezh-foot-truth" data-home-source-cadence="">
            Source freshness, stated plainly: {sourceCadenceSentence()} Where a source
            hasn&rsquo;t answered, the profile says so instead of guessing.
          </p>
        </div>
      </footer>
    </main>
  );
}
