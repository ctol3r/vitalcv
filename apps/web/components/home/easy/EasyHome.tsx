'use client';

/**
 * EasyHome — the `/` production experience (Homepage v4, amendment F).
 *
 * The founder's v4 composition on warm paper #EDEAE3: hairline-ruled document
 * surfaces, Fraunces display, Geist text, and Geist Mono for machine facts —
 * if you are looking at mono type, a source returned it. Sections, in order:
 * hero (the NPI underline field is where the whole visual budget goes, beside
 * the hero folio figure) → the interactive resolution scene (eight real
 * registry rows, read log, lane tally, next actions) → the trust-flow diagram
 * (four hops, one barred lane) → the five-beat arc (record → readiness →
 * roles → apply with proof → start) with the LIVE opportunity feed as the
 * Roles beat's expansion → the exact-packet shape and its state legend →
 * employers → honest limits → close → footer.
 *
 * The NPI entry is the same real flow the previous homepage ran: checkNpi
 * gates format locally, /api/identity/bootstrap and /api/trust-state resolve
 * the person, the anonymous feed suggests roles, and "Keep this record" hands
 * the NPI to /onboarding. No API, auth, consent, or data behavior changes
 * here — this file is presentation over the existing hook. Real data replaces
 * the illustrative ledger on resolve (the recognition-moment contract).
 *
 * Truth contract carried forward, not relaxed: every figure is labelled
 * illustrative with a hidden transcript, every value is a blank bar, the NPI
 * in every illustration is masked, opportunities come only from the live
 * provenance-bearing public API, durations carry the pilot-target note, and
 * institution review remains an unresolved employer decision.
 */

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import ArcBeats from '@/components/home/easy/ArcBeats';
import EmployerLedger from '@/components/home/easy/EmployerLedger';
import HeroFolio from '@/components/home/easy/HeroFolio';
import { useHeroLoop, type HeroLoop } from '@/components/home/easy/heroLoop';
import OpportunityHorizon from '@/components/home/easy/OpportunityHorizon';
import PacketArtifact from '@/components/home/easy/PacketArtifact';
import ResolutionScene from '@/components/home/easy/ResolutionScene';
import { StateStamp } from '@/components/home/easy/stateVocabulary';
import TrustFlow from '@/components/home/easy/TrustFlowFigure';
import { useSectionReveals } from '@/components/home/easy/useSectionReveals';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { sourceCadenceSentence } from '@/lib/trust/sourceCadence';

function NpiEntry(loop: HeroLoop) {
  const { state, raw, digits, resolving, narrating, handleChange, handleSubmit, handleReset } = loop;

  return (
    <div className="ezh-claim">
      <form
        className="ezh-npi-form"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <label className="ezh-k ezh-npi-k" htmlFor="ezh-npi">
          Your NPI &middot; 10 digits
        </label>
        <div className="ezh-field">
          <input
            id="ezh-npi"
            className="ezh-npi-in"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            /* The founder file's placeholder was ten zeros; the homepage's
               masked-NPI rule bans any ten-digit sequence in the render, so
               the placeholder wears the same 3-3-4 mask the figures use. */
            placeholder="··· ··· ····"
            aria-describedby="ezh-npi-hint"
            value={raw}
            onChange={(event) => handleChange(event.target.value)}
          />
          <button className="ezh-action ezh-npi-submit" type="submit" data-home-primary-cta="" disabled={resolving}>
            {resolving ? 'Checking the registry…' : 'Start with your NPI'}
          </button>
        </div>
        <p className="ezh-npi-count ezh-data">{digits.length}/10 digits &middot; free, no account needed</p>
        {state.phase === 'invalid' && state.invalidReason ? (
          <p className="ezh-npi-note" role="status">{state.invalidReason}</p>
        ) : null}
        <p className="ezh-npi-fine" id="ezh-npi-hint">
          Free for clinicians, always. We read public and permissioned sources only, and nothing
          leaves your record until you approve a specific recipient.
        </p>
      </form>

      {!narrating && state.outcome === 'organization' ? (
        <div className="ezh-result" role="status">
          <p className="ezh-result-name">This NPI names an organization.</p>
          <p className="ezh-result-note">
            VitalCV records start from an individual (Type&nbsp;1) NPI. Hiring for this
            organization? <Link href="/employers">VitalCV for employers</Link>.
          </p>
          <div className="ezh-result-actions">
            <button type="button" className="ezh-result-again" onClick={handleReset}>
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
            <button type="button" className="ezh-result-again" onClick={handleReset}>
              Try again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function EasyHome() {
  const loop = useHeroLoop();
  const rootRef = useRef<HTMLElement | null>(null);

  // E.2's one-shot section-entrance system, adopted by F: the server frame
  // is complete; hydration outside reduced motion arms a single reveal per
  // section, a safety timer force-completes, late mounts are caught.
  useSectionReveals(rootRef);

  useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
  }, []);

  return (
    <main className="ezh" data-home-variant="easy" ref={rootRef}>
      {/* ── 1 · hero: the thesis beside the folio ────────────────────────── */}
      <section
        id="npi"
        className="ezh-hero"
        data-home-hero=""
        data-header-theme="light"
        aria-label="VitalCV — enter your NPI"
      >
        <div className="ezh-wrap ezh-hero-grid">
          <div className="ezh-hero-copy">
            <span className="ezh-k ezh-hero-eyebrow">
              <i aria-hidden="true" />For clinicians &middot; no account required
            </span>
            <h1>
              Get hired. <em className="ezh-accent-word">Start working</em> sooner.
            </h1>
            <p className="ezh-lede">
              Parts of your record already live in public sources employers trust. Enter your
              NPI and see what they return, what still needs you, and what nobody can read yet
              &mdash; before anyone asks you for a folder.
            </p>

            <NpiEntry {...loop} />

            <Link className="ezh-hero-opportunity" href="/explore" data-home-opportunity-cta="">
              Explore clinician opportunities <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="ezh-hero-figcol" data-home-stage="">
            <HeroFolio />
          </div>
        </div>
      </section>

      {/* ── 2 · the resolution scene: real rows replace the idle ledger ──── */}
      <ResolutionScene loop={loop} />

      {/* ── 3 · trust flow: sources read, you hold, you release ──────────── */}
      <section id="flow" className="ezh-flow-sec" data-header-theme="light" data-ezh-reveal="" aria-labelledby="ezh-flow-h">
        <div className="ezh-wrap">
          <div className="ezh-sec-head">
            <div>
              <span className="ezh-k">How evidence moves</span>
              <h2 id="ezh-flow-h">
                Sources read. You hold. <em className="ezh-accent-word">You release</em>.
              </h2>
            </div>
            <p className="ezh-sec-lede">
              Four hops, drawn honestly: what a source returned, where it rests, the gate only
              you open, and the desk where a human still decides. One source stops at a barred
              rule &mdash; we are not allowed to read it, and it is drawn that way on purpose.
            </p>
          </div>
          <TrustFlow />
        </div>
      </section>

      {/* ── 4 · the arc, with the live feed as the Roles beat's expansion ── */}
      <ArcBeats />
      <OpportunityHorizon />

      {/* ── 5 · the truth boundary, in its own words ─────────────────────── */}
      <section className="ezh-truthline" data-header-theme="light" data-ezh-reveal="" aria-label="What this page does not claim">
        <div className="ezh-wrap">
          <p className="ezh-truth" data-home-truth-boundary="">
            Drawn illustrations; no real clinician, employer, or result; nothing has been sent,
            and institution review decides the outcome.
          </p>
        </div>
      </section>

      {/* ── 6 · the exact packet, and what it refuses to decide ──────────── */}
      <PacketArtifact />

      {/* ── 7 · employers ────────────────────────────────────────────────── */}
      <EmployerLedger />

      {/* ── 8 · honest limits ────────────────────────────────────────────── */}
      <section id="limits" className="ezh-limits-sec" data-header-theme="light" data-ezh-reveal="" aria-labelledby="ezh-limits-h">
        <div className="ezh-wrap">
          <div className="ezh-sec-head">
            <div>
              <span className="ezh-k">Honest limits</span>
              <h2 id="ezh-limits-h">
                What we <em className="ezh-accent-word">cannot</em> see.
              </h2>
            </div>
            <p className="ezh-sec-lede">
              Published here rather than discovered later. A product that reads sources for a
              living owes you the boundary of what it reads.
            </p>
          </div>
          <div className="ezh-limits">
            <div>
              <StateStamp state="access">Access required</StateStamp>
              <h3>Sources we are not allowed to read</h3>
              <p>
                State licensure is not open to us yet, and some federal sources answer only the
                clinician. Where that is true, the row says so instead of guessing.
              </p>
            </div>
            <div>
              <StateStamp state="snapshot">Snapshot &middot; monthly or quarterly</StateStamp>
              <h3>Sources that publish in batches</h3>
              <p>
                The OIG exclusion file is monthly; Medicare enrollment is quarterly. Those rows
                carry the file&rsquo;s date, never the word &ldquo;current&rdquo;.
              </p>
            </div>
            <div>
              <StateStamp state="unchecked">Not checked</StateStamp>
              <h3>Things nobody has asked for yet</h3>
              <p>
                Privileges, employment and references need an issuer to attest. Until one does,
                the row stays empty and says so.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9 · close ────────────────────────────────────────────────────── */}
      <section className="ezh-start" data-header-theme="light" data-ezh-reveal="" aria-labelledby="ezh-start-h">
        <div className="ezh-wrap ezh-close">
          <div>
            <h2 id="ezh-start-h">
              Ten digits. Then <em className="ezh-accent-word">read it yourself</em>.
            </h2>
            <p className="ezh-start-line">
              No demo call, no gated download, no account. You see your record first &mdash; and
              nothing is shared unless you say so.
            </p>
          </div>
          <a className="ezh-action ezh-start-cta" href="#npi">
            Start with your NPI
          </a>
        </div>
      </section>

      <footer className="ezh-foot">
        <div className="ezh-wrap ezh-foot-in">
          <span className="ezh-foot-mark ezh-data">
            © 2026 VitalCV &middot; a record the clinician owns
          </span>
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
            hasn&rsquo;t answered, the record says so instead of guessing.
          </p>
        </div>
      </footer>
    </main>
  );
}
