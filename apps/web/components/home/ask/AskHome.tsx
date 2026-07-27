'use client';

/**
 * The homepage is the question, not a page about the question.
 *
 * WHY THIS REPLACES THE FILM. The film was correct and joyless. Its first
 * screen showed a clinician six rows of state — four of them `NOT CHECKED` or
 * `ACCESS REQUIRED` — before anything good happened, and every scene repeated
 * one layout: serif phrase left, dense grey panel right. Two of the founder
 * mandate's own guardrails were being broken by it: 7 ("proof is a close-up,
 * not a wall of labels") and 5 ("almost no copy"). The honesty discipline had
 * stopped being a constraint and become the personality.
 *
 * The fix is structural rather than cosmetic. A clinician arrives with one
 * question — *what can employers see about me right now?* — so the page is that
 * question and nothing else. Consequences, all of which the old composition had
 * to fight for:
 *
 *   - Nothing is listed until an NPI is entered, so there is no wall of labels
 *     and no screen of negations. State appears only once it is REAL.
 *   - One element is unambiguously the hero: the field.
 *   - "Almost no copy" is achievable, because there is only one thing to say.
 *   - The answer replaces the question IN PLACE. The reward for acting is the
 *     page becoming yours, not a scroll to a different frame.
 *
 * The scroll below the fold exists for readers who will not type. It is three
 * short beats, each carrying ONE artifact at close-up scale — never a table.
 */

import * as React from 'react';
import Link from 'next/link';

import { checkNpi } from '@/lib/vital/npi';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { LiveNpiResult } from '@/components/home/LiveNpiResult';
import { TruthBoundary } from '@/components/home/TruthBoundary';
import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * Source freshness, derived from the canonical registry rather than written by
 * hand, so `/` can never drift from `/status` and `/api/status`.
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

/**
 * The three beats below the fold. One artifact each, at close-up scale.
 *
 * Deliberately NOT a feature grid and NOT a state table — the mandate bans
 * both, and a table is what made the previous page read as a form. Each beat
 * shows a single concrete object a clinician would recognise.
 */
const BEATS = [
  {
    id: 'once',
    phrase: 'Prove it once.',
    line: 'The same six checks, every application. Do them once and carry the answer.',
    artifact: 'once',
  },
  {
    id: 'fit',
    phrase: 'See what actually fits.',
    line: 'Roles measured against the record you already have — and the gaps you do not.',
    artifact: 'fit',
  },
  {
    id: 'consent',
    phrase: 'Your evidence. Your permission.',
    line: 'You choose who sees it. The institution still makes the decision.',
    artifact: 'consent',
  },
] as const;

export function AskHome() {
  const [raw, setRaw] = React.useState('');
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
  }, []);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const check = checkNpi(digits);
  const valid = check.validity === 'valid';

  const submit = React.useCallback(() => {
    if (!valid || !check.npi) {
      setError(check.reason ?? 'Enter a full 10-digit NPI.');
      return;
    }
    setError(null);
    try {
      window.sessionStorage.setItem('onboarding_npi', check.npi);
      window.localStorage.setItem('onboarding_npi', check.npi);
    } catch {
      // The lookup still works without storage.
    }
    setSubmitted(check.npi);
  }, [valid, check.npi, check.reason]);

  return (
    <div className="ask">
      {/* Route-scoped paper. Unmounts with the page, so no other surface
          inherits Cloud Dancer. */}
      <style>{'body{background:var(--vt-cloud-dancer)}'}</style>

      {/* THE ASK — one screen, one action.
          `data-home-hero` is the release marker deploy-smoke.mjs greps out of
          the production response; do not remove without re-pointing it. */}
      <section className="ask-stage" data-home-hero="" aria-labelledby="ask-title">
        <div className="ask-inner">
          <h1 id="ask-title" className="ask-title">
            Get hired faster.
          </h1>

          {submitted ? (
            <div className="ask-answer">
              <LiveNpiResult
                npi={submitted}
                onReset={() => {
                  setSubmitted(null);
                  setRaw('');
                  inputRef.current?.focus();
                }}
              />
            </div>
          ) : (
            <>
              {/* The field IS the hero. A ruled line on paper, at display
                  scale — not a boxed form control sitting beside a visual. */}
              <form
                className="ask-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <label className="ask-label" htmlFor="npi-input">
                  Start with your NPI
                </label>
                <div className="ask-field">
                  <input
                    id="npi-input"
                    ref={inputRef}
                    className="ask-input"
                    value={digits}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    placeholder="··········"
                    /* Slot dots, not digits. `0000000000` at display scale read
                       as a filled-in value rather than a prompt — the loudest
                       thing on the screen was fake data. The ruled line and the
                       digit counter carry the affordance instead. */
                    /* No `aria-label` here on purpose. One overriding the
                       visible <label> made the accessible name "NPI number"
                       while the screen read "Start with your NPI" — a WCAG
                       2.5.3 Label-in-Name failure, and it means a voice-control
                       user saying what they can SEE cannot address the field.
                       The <label for="npi-input"> above is the only name. */
                    aria-invalid={Boolean(error)}
                    aria-describedby="ask-hint"
                    onChange={(e) => {
                      setRaw(e.target.value);
                      setError(null);
                    }}
                  />
                </div>
                <p id="ask-hint" className="ask-hint" aria-live="polite">
                  {/* A full-length number that fails the checksum explains
                      ITSELF, without waiting for a submit that the disabled
                      button will never allow. Silently greying the action out
                      leaves someone who mistyped one digit staring at a dead
                      button with nothing to correct. Shorter, fixable failures
                      keep the plain counter — a nag on every keystroke would be
                      worse than none. */}
                  {error || (digits.length === 10 && !valid) ? (
                    <span className="ask-error">{error ?? check.reason}</span>
                  ) : (
                    <>
                      {digits.length}/10 digits · Free for clinicians · No account required
                    </>
                  )}
                </p>
                {/* Outside the ruled line on purpose. Inline, the button wrapped
                    beneath the digits once they filled the row and floated
                    inside the field. Below the rule it survives any width, and
                    the reading order matches the act: label, digits, then go. */}
                <button
                  type="submit"
                  className="ask-go"
                  data-home-primary-cta=""
                  disabled={!valid}
                >
                  Check what&rsquo;s ready
                </button>
              </form>

              <p className="ask-promise">
                See what employers can already confirm about you — and what still needs
                attention.
              </p>

              {/* The employer door. One artifact serves both audiences — the
                  clinician acts first and the buyer gets a way in without a
                  competing hero. Deliberately AFTER the NPI action in DOM order:
                  the guard asserts that sequence, because a buyer CTA that
                  outranks the clinician's turns the page into a sales sheet. */}
              <p className="ask-secondary">
                <Link href="/employers" data-home-employer-cta="">
                  Hiring clinicians? Start from evidence
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Freshness, stated once, quietly, at the foot of the first screen.
            Derived from the registry — never hand-written. */}
        <p className="ask-cadence" data-home-source-cadence="">
          {sourceCadenceSentence()}
        </p>
      </section>

      {/* THE BEATS — for readers who scroll instead of typing. */}
      {BEATS.map((beat) => (
        <section
          key={beat.id}
          className={beat.artifact === 'once' ? 'ask-beat ask-beat--wide' : 'ask-beat'}
          aria-labelledby={`beat-${beat.id}`}
        >
          <div className="ask-beat-copy">
            <h2 id={`beat-${beat.id}`} className="ask-beat-title">
              {beat.phrase}
            </h2>
            <p className="ask-beat-line">{beat.line}</p>
          </div>
          {/* Labelled illustrative even though these carry no source names, no
              freshness stamps and no state chips. The shapes depict a product
              surface, and the contract is that anything depicting the product
              says so — a viewer should never have to infer which pixels are a
              claim. */}
          <figure className="ask-beat-art" data-ask-artifact={beat.artifact}>
            {beat.artifact === 'once' ? (
              /* The real close-up, not a drawing of one. Guardrail 7 asks for
                 proof as a CLOSE-UP rather than a wall of labels — and my first
                 cut at this page threw out both, replacing the inspector with an
                 abstract shape. A shape cannot show that a claim traces to a
                 named source, so this beat carries the actual inspector: one
                 claim at a time, its source chain beside it, keyboard-operable
                 and complete without JavaScript. */
              <ProofPacketInspector className="ask-beat-inspector" />
            ) : (
              <BeatArtifact kind={beat.artifact} />
            )}
            {beat.artifact !== 'once' && (
              <figcaption className="ask-beat-cap">Illustrative — not a live result</figcaption>
            )}
          </figure>
        </section>
      ))}

      {/* The boundary lands LAST and small — after the positive, once, specific.
          Placement is evidence-led: communicating uncertainty costs little when
          it is concrete and follows the benefit, and costs a great deal when it
          is vague or leads. */}
      <section className="ask-boundary">
        <TruthBoundary />
      </section>

      <nav className="ask-foot" aria-label="Trust footer" data-home-trust-footer="">
        <Link href="/status">Status</Link>
        <Link href="/trust/attribution">Source attribution</Link>
        <Link href="/evidence-network">Evidence network</Link>
        <Link href="/trust">Trust</Link>
      </nav>
    </div>
  );
}

/**
 * One object per beat, drawn at close-up scale.
 *
 * These are illustrations of a real product surface, not live state — which is
 * why they carry no source names, no freshness stamps and no state chips. A
 * label here would be a claim; a shape is not.
 */
function BeatArtifact({ kind }: { kind: string }) {
  if (kind === 'once') {
    // One packet, sealed — the "do it once" object.
    return (
      <svg viewBox="0 0 240 180" className="ask-art" role="presentation">
        <rect x="28" y="24" width="184" height="132" rx="3" className="ask-art-paper" />
        <line x1="28" y1="58" x2="212" y2="58" className="ask-art-rule" />
        {[78, 96, 114].map((y) => (
          <line key={y} x1="48" y1={y} x2={y === 114 ? 150 : 192} y2={y} className="ask-art-line" />
        ))}
        <circle cx="180" cy="126" r="17" className="ask-art-seal" />
        <path d="M172 126 l6 6 l11 -13" className="ask-art-tick" />
      </svg>
    );
  }
  if (kind === 'fit') {
    // A role outline and a record outline, overlapping.
    return (
      <svg viewBox="0 0 240 180" className="ask-art" role="presentation">
        <rect x="34" y="46" width="104" height="94" rx="3" className="ask-art-paper" />
        <rect x="102" y="40" width="104" height="94" rx="3" className="ask-art-paper-2" />
        <line x1="112" y1="70" x2="196" y2="70" className="ask-art-line" />
        <line x1="112" y1="88" x2="176" y2="88" className="ask-art-line" />
        <line x1="112" y1="106" x2="188" y2="106" className="ask-art-line" />
        <rect x="102" y="40" width="36" height="94" className="ask-art-overlap" />
      </svg>
    );
  }
  // consent — a key line crossing a boundary.
  return (
    <svg viewBox="0 0 240 180" className="ask-art" role="presentation">
      <line x1="120" y1="18" x2="120" y2="162" className="ask-art-boundary" />
      <rect x="34" y="62" width="70" height="56" rx="3" className="ask-art-paper" />
      <rect x="136" y="62" width="70" height="56" rx="3" className="ask-art-paper-2" />
      <path d="M104 90 H136" className="ask-art-rule" />
      <circle cx="120" cy="90" r="9" className="ask-art-seal" />
    </svg>
  );
}
