'use client';

/**
 * EasyHome — the `/` production experience (UX-V1 cutover).
 *
 * Direction B, as amended: show VitalCV doing work rather than explaining
 * machinery. One headline ("Enter your NPI. VitalCV does the rest."), the
 * REAL NPI entry beside an illustrated work surface that plays the whole
 * story in ~10 seconds without blocking anything, the agent's ownership
 * model, the outcome, a subordinate employer doorway on a light band, and a
 * final action + footer composition.
 *
 * The NPI entry is the same real flow the previous homepage ran: checkNpi
 * gates format locally, /api/identity/bootstrap and /api/trust-state resolve
 * the person, the anonymous MATCHA feed suggests roles, and "Keep this
 * record" hands the NPI to /onboarding. No API, auth, consent, or data
 * behavior changes here — this file is presentation over the existing hook.
 *
 * Truth contract carried forward, not relaxed: the illustration labels
 * itself illustrative, the boundary line states that nothing has been sent
 * and institution review decides outcomes, and the footer carries the
 * derived source-freshness sentence so cadence can never drift from
 * /status.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import Attribution from '@/components/home/easy/Attribution';
import { NpiReveal, ResolvingNarration } from '@/components/home/easy/NpiReveal';
import ProcessStory from '@/components/home/easy/ProcessStory';
import Questions from '@/components/home/easy/Questions';
import WorkSurface from '@/components/home/easy/WorkSurface';
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
 * state. So when the registry actually named someone — Michael Abdel-malek,
 * Hospitalist, CA, from a live NPPES read — the real record appeared as a
 * modest card under the form while the dominant two-thirds of the hero kept
 * playing the masked, skeleton-bar illustration of that same story, captioned
 * "ILLUSTRATIVE — NOT A LIVE RESULT". The product's best moment was the
 * smallest thing on the screen, and the largest thing on the screen was a
 * mock of it.
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
      <form
        className="ezh-npi-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <label className="ezh-k" htmlFor="ezh-npi">
          Your NPI
        </label>
        <div className="ezh-npi-row">
          <input
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
          <button className="ezh-npi-submit" type="submit" data-home-primary-cta="" disabled={resolving}>
            {resolving ? 'Checking the registry…' : 'Start with your NPI'}
          </button>
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
        The narration and the reveal now render in the STAGE column — see
        `HeroStage`. They are the result, and the result belongs where the
        illustration of it used to be, not underneath the form.
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
 *   idle       the illustrated work surface, captioned illustrative
 *   resolving  the process narration (what we are DOING, never a result)
 *   resolved   the REAL record the registry returned
 *
 * The truth caption is bound to the state rather than hardcoded under the
 * column. It previously read "Illustrative — no real people" unconditionally,
 * which was correct only while the illustration was showing; once a live NPPES
 * read has named a person on this same screen, that sentence is false. So the
 * caption ships WITH the illustration and is replaced, not kept, when the real
 * record takes the slot. WorkSurface's own internal "illustrative" chrome goes
 * with it, because WorkSurface itself unmounts.
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

  return (
    <>
      <WorkSurface />
      <p className="ezh-truth" data-home-truth-boundary="">
        Illustrative &mdash; no real people, and nothing has been sent. In the product,
        sending is yours to approve, and institution review decides the outcome.
      </p>
    </>
  );
}

export default function EasyHome() {
  const loop = useHeroLoop();

  useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
  }, []);

  return (
    <main className="ezh" data-home-variant="easy">
      {/* ── hero: the Easy Button beside the working product ─────────────── */}
      <section
        id="npi"
        className="ezh-hero"
        data-home-hero=""
        data-header-theme="dark"
        aria-label="VitalCV — enter your NPI"
      >
        <div className="ezh-wrap">
          <div className="ezh-hero-copy">
            <span className="ezh-k">For US clinicians</span>
            <h1>
              Enter your NPI.
              <br />
              VitalCV does the rest.
            </h1>
            <p className="ezh-hero-sub">
              We find what we can, show you exactly what remains, and handle the administrative
              work that can safely be handled.
            </p>

            <NpiEntry {...loop} />

            <p className="ezh-hero-emp">
              Hiring clinicians?{' '}
              <a
                href="/employers"
                data-home-employer-cta=""
                onClick={() => trackFunnelEvent(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED)}
              >
                VitalCV for employers <span aria-hidden="true">&#8627;</span>
              </a>
            </p>
          </div>

          <div className="ezh-hero-stagecol" data-home-stage="">
            <HeroStage {...loop} />
          </div>
        </div>
      </section>

      {/* ── what VitalCV is — the deep five-chapter explainer (UX-04) ────── */}
      <ProcessStory />

      {/* ── the agent's ownership model ──────────────────────────────────── */}
      <section className="ezh-own" data-header-theme="dark" aria-labelledby="ezh-own-h">
        <div className="ezh-wrap">
          <div className="ezh-sec-head">
            <span className="ezh-k">Ownership</span>
            <h2 id="ezh-own-h">What VitalCV handles &mdash; and what it never touches without you</h2>
          </div>
          <p className="ezh-sec-sub">
            Every item in your hiring process has exactly one owner. That&rsquo;s the whole system.
          </p>

          <div className="ezh-own-grid">
            <div className="ezh-own-cell">
              <span className="ezh-own-mark m-work" aria-hidden="true" />
              <h3>VitalCV handles</h3>
              <ul>
                <li>Pulling public records &mdash; NPPES, state license boards</li>
                <li>Assembling your work history draft</li>
                <li>Tracking license renewal dates</li>
              </ul>
              <p className="ezh-own-note">
                Work VitalCV can do safely on its own. Every action is logged for you to see.
              </p>
            </div>
            <div className="ezh-own-cell">
              <span className="ezh-own-mark m-hold" aria-hidden="true" />
              <h3>Needs your approval</h3>
              <ul>
                <li>Sending your profile to an employer</li>
                <li>Requesting a reference on your behalf</li>
              </ul>
              <p className="ezh-own-note">Prepared and waiting. Nothing is sent until you say so.</p>
            </div>
            <div className="ezh-own-cell">
              <span className="ezh-own-mark m-hold" aria-hidden="true" />
              <h3>Needs you</h3>
              <ul>
                <li>Signing applications</li>
                <li>Occupational health forms</li>
              </ul>
              <p className="ezh-own-note">Only you can do these. We keep the list short and obvious.</p>
            </div>
            <div className="ezh-own-cell">
              <span className="ezh-own-mark m-wait" aria-hidden="true" />
              <h3>The employer decides</h3>
              <ul>
                <li>Interviews and offers</li>
                <li>Sign-off at their facility</li>
              </ul>
              <p className="ezh-own-note">
                Their call, not ours &mdash; so we show you what we know, when we know it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── how VitalCV knows what it knows ──────────────────────────────
          Sits directly after ownership on purpose: ownership answers whose
          move it is, attribution answers how a line was established. Two
          halves of the same trust story, and the page previously had only
          the first. */}
      <Attribution />

      {/* ── the matching layer: why the roles here are different ─────────── */}
      <section
        className="ezh-match"
        data-header-theme="dark"
        data-home-matching=""
        aria-labelledby="ezh-match-h"
      >
        <div className="ezh-wrap">
          <div className="ezh-sec-head">
            <span className="ezh-k">Roles</span>
            <h2 id="ezh-match-h">A job board that reads your credentials, not your keywords</h2>
          </div>
          <p className="ezh-sec-sub">
            Most boards match the words on your r&eacute;sum&eacute;. VitalCV scores a role against
            what your record already shows &mdash; and names what stands between you and it.
          </p>

          <div className="ezh-match-grid">
            <ul className="ezh-match-points">
              <li>
                <span className="ezh-tt">Scored on your record</span>
                <p>
                  Your NPPES profile, licenses, and specialty &mdash; not the keywords you
                  remembered to put in a document.
                </p>
              </li>
              <li>
                <span className="ezh-tt">Every match explains itself</span>
                <p>
                  What lines up and what doesn&rsquo;t, in plain terms. Not a percentage you
                  can&rsquo;t argue with.
                </p>
              </li>
              <li>
                <span className="ezh-tt">Blockers before you apply</span>
                <p>
                  A role that needs a license you don&rsquo;t hold says so up front &mdash; not
                  after the interview.
                </p>
              </li>
            </ul>

            <div className="ezh-match-panel">
              <span className="ezh-k">How a match reads</span>
              <p className="ezh-match-role">Internal Medicine &middot; California &middot; Permanent</p>
              <ul className="ezh-match-rows">
                <li className="ezh-match-row is-fit">
                  <span className="ezh-match-mark" aria-hidden="true" />
                  <span>Your state license covers where the role is</span>
                </li>
                <li className="ezh-match-row is-fit">
                  <span className="ezh-match-mark" aria-hidden="true" />
                  <span>Your specialty matches what the role asks for</span>
                </li>
                <li className="ezh-match-row is-block">
                  <span className="ezh-match-mark" aria-hidden="true" />
                  <span>Board certification isn&rsquo;t on your record yet</span>
                </li>
              </ul>
              <p className="ezh-match-cap">
                Illustrative &mdash; the shape of a match, not a real posting or a real employer.
              </p>
            </div>
          </div>

          <p className="ezh-match-scope">
            VitalCV scores the roles that are on VitalCV &mdash; it doesn&rsquo;t crawl the rest of
            the internet. When nothing fits, it says nothing fits instead of padding the list.
          </p>
        </div>
      </section>

      {/* ── the outcome ──────────────────────────────────────────────────── */}
      <section className="ezh-out" data-header-theme="dark" aria-labelledby="ezh-out-h">
        <div className="ezh-wrap">
          <div className="ezh-sec-head">
            <span className="ezh-k">Outcome</span>
            <h2 id="ezh-out-h">All of this exists so you start sooner</h2>
          </div>
          <div className="ezh-out-grid">
            <div className="ezh-out-copy">
              <p>
                The profile is not the destination &mdash; the job is. VitalCV keeps the remaining
                steps visible and keeps them moving, from application to your first day.
              </p>
              <p>
                And when it&rsquo;s time for the next move, the work you did here is still yours
                &mdash; ready to go again.
              </p>
            </div>
            <div className="ezh-bigtrack">
              <span className="ezh-k">From role to first day</span>
              <div className="ezh-trackbar" aria-hidden="true">
                <i className="ezh-fillbar" />
                <span className="ezh-node n1"><b /><span>Apply</span></span>
                <span className="ezh-node n2"><b /><span>Interview</span></span>
                <span className="ezh-node n3"><b /><span>Offer</span></span>
                <span className="ezh-node n4"><b /><span>First day</span></span>
              </div>
              <p className="ezh-bigtrack-cap">
                Each step has one owner &mdash; you always know whose move it is.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── objections, answered at the end of the clinician run ──────────
          Placed BEFORE the light employer band, and that placement is
          load-bearing, not taste. `useHeaderScene` hands the eyebrow to
          whichever declared section is latest in document order within the
          top 35% of the viewport — so a DARK section following the light
          `.ezh-emp` claims the eyebrow while the bar is still painted over
          light paper, rendering it near-white on near-white (measured 1.03:1,
          i.e. invisible). On origin/main that state is unreachable only
          because nothing scrollable follows `.ezh-emp`, so the page bottoms
          out first. Anything added below the light band removes that
          accidental protection.

          Keeping the light band last preserves it. It also reads better: the
          questions are clinician-facing, so they belong at the end of the
          clinician narrative rather than after the employer aside. */}
      <Questions />

      {/* ── the employer doorway: light band, eyebrow inverts ────────────── */}
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
              <Link className="ezh-emp-cta" href="/employers">
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

      {/* ── final action + footer composition ────────────────────────────── */}
      <section className="ezh-start" data-header-theme="dark" aria-labelledby="ezh-start-h">
        <div className="ezh-wrap">
          <div className="ezh-sec-head">
            <span className="ezh-k">Start</span>
            <h2 id="ezh-start-h">Start with your NPI</h2>
          </div>
          <div className="ezh-start-grid">
            <div className="ezh-start-copy">
              <p>
                You watched it work. Now let it work for you &mdash; we find what we can, show you
                what remains, and get to it.
              </p>
            </div>
            <div>
              <a className="ezh-start-cta" href="#npi">
                Start with your NPI
              </a>
              <p className="ezh-start-fine">Free to start. You decide what gets shared, every time.</p>
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
