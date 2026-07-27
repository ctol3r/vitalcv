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
 * THE LEDGER — the record itself, rendered at full scale.
 *
 * This is the page's product artifact, in the Medallion sense of "show the
 * product immediately" — but where a competitor ships a screenshot, this IS
 * the live schema: rows derive from SOURCE_LANE_OPS, the same registry that
 * powers /status and /api/status, which the deploy parity gate already keeps
 * honest. No screenshot can drift; this cannot.
 *
 * What is hand-written here is only the plain-language explanation of each
 * source — the sentence that makes the row legible to a clinician who has
 * never heard "PECOS". Explanations are keyed by laneId and rows derive FROM
 * the registry, so a lane the registry drops disappears rather than surviving
 * as stale copy, and a lane it adds shows up unexplained (caught by the e2e
 * count) rather than silently missing.
 *
 * NOT a fabricated sample record on purpose. The truth guard in
 * ask-home.spec.ts bans any fabricated clinician on this surface (`Dr.`,
 * `MD`, `RN`) — the schema with real availability states is what we can show
 * without inventing a person.
 */
const LANE_EXPLANATIONS: Record<string, { name: string; what: string }> = {
  nppes_identity: {
    name: 'NPPES identity',
    what: 'The federal registry of every licensed provider — who you are, your taxonomy, where you practice.',
  },
  oig_exclusions: {
    name: 'OIG/LEIE exclusions',
    what: 'The exclusion list every hospital and medical group must screen before a hire can bill.',
  },
  pecos_enrollment: {
    name: 'CMS PECOS enrollment',
    what: 'Medicare enrollment standing — whether you can see and bill Medicare patients.',
  },
  state_license: {
    name: 'State licensure',
    what: 'Your license standing with state medical and nursing boards.',
  },
  employment_history: {
    name: 'Employment history',
    what: 'Where you have practiced, confirmed by the organizations themselves.',
  },
  board_cert: {
    name: 'Board certification',
    what: 'Specialty certification from the relevant board.',
  },
};

/** The /status page's lifecycle → public label mapping, kept to the same
 * vocabulary so the two surfaces can never disagree about a word. */
function laneAvailability(lifecycle: string, cadenceLabel: string): { label: string; tone: 'ok' | 'gated' | 'off' } {
  if (lifecycle === 'active' || lifecycle === 'partial') {
    return { label: `Available · ${cadenceLabel}`, tone: 'ok' };
  }
  if (lifecycle === 'planned') {
    return { label: 'Access required', tone: 'gated' };
  }
  return { label: 'Not yet connected', tone: 'off' };
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
    line: 'Roles measured against the license, enrollment, and history you already hold — and the gaps you do not.',
    artifact: 'fit',
  },
  {
    id: 'consent',
    phrase: 'Your evidence. Your permission.',
    line: 'You choose which hospital sees it. Their credentialing committee still makes the decision.',
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

  /**
   * Plays each diagram's state sequence once when it scrolls into view
   * (adds `.ask-art-play`, never removes it — CD-11: explain on entry, then
   * rest). The observer is progressive enhancement three times over: without
   * JS the class is never added and the base CSS already IS the final
   * composition; under `prefers-reduced-motion` the keyframes are disabled in
   * CSS; and if IntersectionObserver is missing the diagrams simply stand.
   */
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const figures = rootRef.current?.querySelectorAll('.ask-beat-art, [data-ask-stagger]') ?? [];
    if (figures.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('ask-art-play');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.45 },
    );
    figures.forEach((f) => observer.observe(f));
    return () => observer.disconnect();
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
    <div className="ask" ref={rootRef}>
      {/* Route-scoped paper. Unmounts with the page, so no other surface
          inherits Cloud Dancer. */}
      <style>{'body{background:var(--vt-cloud-dancer)}'}</style>

      {/* THE ASK — one screen, one action.
          `data-home-hero` is the release marker deploy-smoke.mjs greps out of
          the production response; do not remove without re-pointing it. */}
      <section className="ask-stage" data-home-hero="" aria-labelledby="ask-title">
        <div className="ask-inner">
          {/* Evidence-led, per the settled 2026-07-26 brand decision: no speed
              promise ships before a pilot has measured one. This is also the
              phrase the page's own <title> and OG cards already carry — the tab
              said "your career evidence" while the H1 promised speed. */}
          {/* Small, and only that. The first version listed every licensed
              role — accurate, but category labeling rather than a promise, and
              it made the eyebrow compete with the line that actually carries
              the offer. Two words place the reader; the headline does the
              work. */}
          <p className="ask-eyebrow">For clinicians</p>
          <h1 id="ask-title" className="ask-title">
            Your career evidence, ready before your next job.
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
                {/* Step 1 lives ON the field's label. A separate spine line
                    under the promise repeated this phrase word for word, two
                    lines apart — the step marker and the instruction are the
                    same sentence, so they are one element. */}
                <label className="ask-label ask-spine-step" htmlFor="npi-input">
                  Step 1 · Start with your NPI
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

              {/* Healthcare-specific on purpose: "employers" said nothing about
                  the domain. Naming the actors (hospitals, credentialing teams)
                  and the checks (identity, exclusions, Medicare enrollment) is
                  what makes the page unmistakably clinical without a single
                  stock photo — CD-13 retires those; vocabulary does the work. */}
              <p className="ask-promise">
                See what hospitals and credentialing teams can already confirm about
                you — identity, exclusions, Medicare enrollment — and what still
                needs attention.
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

      {/* THE LEDGER — the record schema at full scale, before the beats explain
          what to do with it. Rows derive from the registry (see LANE_EXPLANATIONS
          note); `data-ask-stagger` opts it into the same play-once entry the
          diagrams use. Threshold note: the section is tall, so the observer
          fires on partial visibility rather than 45%. */}
      <section className="ask-ledger" aria-labelledby="ledger-title">
        {/* SPINE 2 of 4 — source evidence. The product reads as one sequence:
            NPI → source evidence → the packet you choose → hospital review.
            Each moment names its place so a scroller sees a path, not a pile
            of sections. */}
        <p className="ask-chapter-eyebrow ask-spine">Step 2 · Source evidence</p>
        <div className="ask-ledger-copy">
          <h2 id="ledger-title" className="ask-beat-title">
            Six checks stand between a clinician and a start date.
          </h2>
          <p className="ask-beat-line">
            Every hospital, medical group, and staffing agency runs the same screens.
            VitalCV runs the federal ones today — and tells you exactly how fresh each
            answer is.
          </p>
        </div>
        <div className="ask-ledger-rows" data-ask-stagger="" data-home-lane-ledger="">
          {SOURCE_LANE_OPS.map((lane, i) => {
            const copy = LANE_EXPLANATIONS[lane.laneId];
            if (!copy) return null;
            const state = laneAvailability(lane.lifecycle, lane.cadenceLabel);
            return (
              <div
                key={lane.laneId}
                className="ask-ledger-row"
                style={{ ['--i' as string]: i }}
                data-lane-key={lane.statusApiKey}
                data-lane-lifecycle={lane.lifecycle}
              >
                <div className="ask-ledger-main">
                  <span className="ask-ledger-name">{copy.name}</span>
                  <span className="ask-ledger-what">{copy.what}</span>
                </div>
                <span className={`ask-ledger-state ask-ledger-state--${state.tone}`}>
                  {state.label}
                </span>
              </div>
            );
          })}
        </div>
        {/* No freshness adjective here on purpose — "live" outrunning a lane is
            on the kill list, and each row already states its own cadence. */}
        <p className="ask-ledger-foot">
          Lane states are drawn from the same registry behind{' '}
          <Link href="/status">status</Link> and{' '}
          <Link href="/trust/attribution">source attribution</Link> — inspect them
          any time.
        </p>
      </section>

      {/* THE CLINICIAN CHAPTER — why you, personally, would care.
          The founder's review of the previous composition: "I don't know why
          I would be interested if I was a clinician." The answer has to be
          concrete, so the copy names the three real stakes (day-one screens,
          gaps that delay start dates, re-typing the same file) and the
          artifact is BIG — a full check-run playing out once at close-up
          scale. Research note: across eleven competitor sites, only one
          (NurseDash) addresses the worker first; the lane is open. */}
      <section className="ask-chapter" aria-labelledby="chapter-clin-title">
        <p className="ask-chapter-eyebrow ask-spine">Step 3 · The packet you choose</p>
        <div className="ask-beat-copy ask-chapter-copy">
          <h2 id="chapter-clin-title" className="ask-chapter-title">
            Check yourself before they do.
          </h2>
          <ul className="ask-chapter-points">
            <li>
              The screens a hospital runs on day one — run them on yourself first.
              Free, in seconds.
            </li>
            <li>See the gap while it is fixable — not after it delays a start date.</li>
            <li>
              Keep the record. Carry it into the next application instead of starting
              over.
            </li>
          </ul>
        </div>
        <figure className="ask-beat-art ask-beat-art--big" data-ask-artifact="checkrun">
          <CheckRunArtifact />
          <figcaption className="ask-beat-cap">Illustrative — not a live result</figcaption>
        </figure>
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

      {/* THE EMPLOYER CHAPTER — what, concretely, you are buying.
          Upgraded from a copy-only door after the founder's review ("I still
          don't understand what I am buying if I am an employer"). The device
          is the strongest one in the reference set — an annotated artifact of
          the thing you receive (Abridge's move, done with a live-schema
          drawing instead of a screenshot) — plus an itemized list in the
          OpenLoop grammar. Keeps #door-title and data-home-employer-door:
          the e2e guards pin both. */}
      <section className="ask-chapter" aria-labelledby="door-title">
        <p className="ask-chapter-eyebrow ask-spine">Step 4 · Hospital review</p>
        <div className="ask-beat-copy ask-chapter-copy">
          <h2 id="door-title" className="ask-chapter-title">
            What your team receives.
          </h2>
          <ul className="ask-chapter-points">
            <li>
              The federal screens already run — a named source and a timestamp on
              every claim.
            </li>
            <li>Gaps and stale answers stated plainly. Nothing reads as done until it is.</li>
            <li>
              A packet your reviewers inspect claim by claim — and your credentialing
              committee still decides.
            </li>
          </ul>
          <p className="ask-door-cta">
            <Link href="/employers" data-home-employer-door="">
              See the employer workflow →
            </Link>
          </p>
        </div>
        <figure className="ask-beat-art ask-beat-art--big vt-artifact--glass" data-ask-artifact="packet">
          <PacketArtifact />
          <figcaption className="ask-beat-cap">Illustrative — not a live result</figcaption>
        </figure>
      </section>

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
 * THE CHECK RUN — the clinician chapter's artifact, at full width.
 *
 * One NPI goes in; three check rows resolve in reading order; a receipt
 * stamps. Same honesty grammar as the small diagrams: every word is a part
 * name ("identity", "exclusions", "enrollment", "receipt", "your record") —
 * never a source name, a state, or a freshness word, all of which the
 * diagram truth test bans inside <text>. Redacted bars stand in for values:
 * the SHAPE of an answer without fabricating one.
 */
function CheckRunArtifact() {
  const rows = [
    { y: 96, label: 'identity', step: 2 },
    { y: 156, label: 'exclusions', step: 3 },
    { y: 216, label: 'enrollment', step: 4 },
  ];
  return (
    <svg
      viewBox="0 0 720 400"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="One NPI entered; identity, exclusion, and enrollment checks resolving one after another into a record that ends with a receipt"
    >
      <rect x="40" y="24" width="640" height="344" rx="4" className="ask-art-paper" />
      {/* the NPI slot row */}
      <text x="72" y="62" className="ask-art-label ask-art-step-1">
        your npi
      </text>
      {Array.from({ length: 10 }, (_, i) => (
        <rect
          key={i}
          x={150 + i * 30}
          y={48}
          width={18}
          height={18}
          rx={2}
          className="ask-art-slot ask-art-step-1"
        />
      ))}
      <line x1="72" y1="80" x2="648" y2="80" className="ask-art-rule ask-art-step-1" />
      {/* three check rows, resolving in sequence */}
      {rows.map((r) => (
        <g key={r.label}>
          <text x="72" y={r.y + 22} className={`ask-art-label ask-art-step-${r.step}`}>
            {r.label}
          </text>
          <line
            x1="210"
            y1={r.y + 18}
            x2="470"
            y2={r.y + 18}
            className={`ask-art-line ask-art-step-${r.step}`}
          />
          <rect
            x="520"
            y={r.y + 2}
            width="128"
            height="26"
            rx="13"
            className={`ask-art-chip ask-art-step-${r.step}`}
          />
        </g>
      ))}
      {/* the receipt stamps last */}
      <circle cx="600" cy="312" r="24" className="ask-art-seal ask-art-step-5" />
      <path d="M588 312 l9 9 l16 -19" className="ask-art-tick ask-art-step-5" />
      <text x="72" y="320" className="ask-art-label ask-art-step-5">
        your record
      </text>
      <line x1="210" y1="314" x2="470" y2="314" className="ask-art-line ask-art-step-5" />
      <text x="565" y="356" className="ask-art-label ask-art-step-5">
        receipt
      </text>
    </svg>
  );
}

/**
 * THE PACKET — the employer chapter's artifact, annotated like a product
 * screenshot would be (the Abridge device), but drawn from the same live
 * schema grammar as everything else. Annotations name product properties
 * ("source + time", "what is missing", "your decision") — captions for
 * regions of the surface, not states of data.
 */
function PacketArtifact() {
  return (
    <svg
      viewBox="0 0 720 400"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="A consented packet arriving on a reviewer's desk: rows of claims each carrying source and time, one gap stated plainly, and the decision left to the committee"
    >
      {/* the packet arrives */}
      <rect x="40" y="60" width="200" height="260" rx="4" className="ask-art-paper ask-art-step-1" />
      <line x1="64" y1="100" x2="216" y2="100" className="ask-art-rule ask-art-step-1" />
      {[128, 152, 176].map((y) => (
        <line key={y} x1="64" y1={y} x2={y === 176 ? 160 : 216} y2={y} className="ask-art-line ask-art-step-1" />
      ))}
      <circle cx="196" cy="284" r="16" className="ask-art-seal ask-art-step-1" />
      <text x="64" y="52" className="ask-art-label ask-art-step-1">
        the packet
      </text>
      {/* crosses to the review surface */}
      <path d="M240 190 H300" className="ask-art-rule ask-art-flow ask-art-step-2" />
      {/* the review surface */}
      <rect x="300" y="36" width="380" height="308" rx="4" className="ask-art-paper-2 ask-art-step-2" />
      <text x="324" y="28" className="ask-art-label ask-art-step-2">
        your review
      </text>
      {/* claim rows with meta lines (source + time live here) */}
      {[
        { y: 76, step: 3 },
        { y: 140, step: 3 },
        { y: 204, step: 4 },
      ].map((r, i) => (
        <g key={i}>
          <line x1="324" y1={r.y} x2="580" y2={r.y} className={`ask-art-line ask-art-step-${r.step}`} />
          <line x1="324" y1={r.y + 20} x2="480" y2={r.y + 20} className={`ask-art-meta ask-art-step-${r.step}`} />
          <circle cx="636" cy={r.y + 8} r="12" className={`ask-art-seal ask-art-step-${r.step}`} />
        </g>
      ))}
      {/* the gap — dashed, stated, unresolved on purpose */}
      <rect x="318" y="252" width="280" height="34" rx="3" className="ask-art-gap ask-art-step-5" />
      <text x="330" y="273" className="ask-art-label ask-art-step-5">
        what is missing
      </text>
      {/* annotations, last */}
      <text x="324" y="122" className="ask-art-note ask-art-step-6">
        source + time on every claim
      </text>
      <text x="324" y="330" className="ask-art-note ask-art-step-6">
        your decision, your committee
      </text>
    </svg>
  );
}

/**
 * One object per beat, drawn at close-up scale.
 *
 * These are illustrations of a real product surface, not live state — which is
 * why they carry no source names, no freshness stamps and no state chips. A
 * STATE label here would be a claim; the words that do appear ("ER role",
 * "your record", "you", "the hospital", "your permission") name the parts of
 * the diagram, not the state of any data — the difference between a caption
 * and a claim. The parts are named in clinical vocabulary on purpose: a
 * generic "role"/"employer" diagram could belong to any industry, and the
 * founder's review said exactly that ("I can't tell this is for clinicians").
 *
 * Motion: each diagram plays its state sequence ONCE when scrolled into view,
 * then rests (CD-11: nothing idles). The RESTING composition is the base CSS —
 * the keyframes only replay how it came to be — so no-JS and reduced-motion
 * readers get the complete final picture, not a blank stage. The class that
 * starts the play is added by the IntersectionObserver in AskHome.
 */
function BeatArtifact({ kind }: { kind: string }) {
  if (kind === 'once') {
    // One packet, sealed — the "do it once" object.
    return (
      <svg
        viewBox="0 0 240 180"
        className="ask-art"
        role="img"
        aria-label="A single career evidence packet with a seal of completed checks"
      >
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
    // A role's requirements laid over your record; the overlap is what the
    // record already answers.
    return (
      <svg
        viewBox="0 0 240 180"
        className="ask-art"
        role="img"
        aria-label="An ER role's requirements laid over your career record — the overlapping band is what your record already answers"
      >
        <rect x="34" y="46" width="104" height="94" rx="3" className="ask-art-paper ask-art-step-1" />
        <rect x="102" y="40" width="104" height="94" rx="3" className="ask-art-paper-2 ask-art-step-2" />
        <line x1="112" y1="70" x2="196" y2="70" className="ask-art-line ask-art-step-2" />
        <line x1="112" y1="88" x2="176" y2="88" className="ask-art-line ask-art-step-2" />
        <line x1="112" y1="106" x2="188" y2="106" className="ask-art-line ask-art-step-2" />
        <rect x="102" y="40" width="36" height="94" className="ask-art-overlap ask-art-step-3" />
        <text x="42" y="36" className="ask-art-label ask-art-step-1">
          ER role
        </text>
        <text x="146" y="152" className="ask-art-label ask-art-step-2">
          your record
        </text>
      </svg>
    );
  }
  // consent — your record crosses to an employer only through your permission.
  return (
    <svg
      viewBox="0 0 240 180"
      className="ask-art"
      role="img"
      aria-label="Your record on one side of a boundary, the hospital on the other — evidence crosses only through your permission"
    >
      {/* The boundary yields where the seal and its label sit — dashes running
          through the words made the one sentence the diagram speaks harder to
          read than the shapes around it. */}
      <line x1="120" y1="18" x2="120" y2="74" className="ask-art-boundary ask-art-step-1" />
      <line x1="120" y1="124" x2="120" y2="162" className="ask-art-boundary ask-art-step-1" />
      <rect x="34" y="62" width="70" height="56" rx="3" className="ask-art-paper ask-art-step-1" />
      <rect x="136" y="62" width="70" height="56" rx="3" className="ask-art-paper-2 ask-art-step-3" />
      <path d="M104 90 H136" className="ask-art-rule ask-art-flow ask-art-step-2" />
      <circle cx="120" cy="90" r="9" className="ask-art-seal ask-art-step-2" />
      <text x="69" y="54" className="ask-art-label ask-art-step-1" textAnchor="middle">
        you
      </text>
      <text x="171" y="54" className="ask-art-label ask-art-step-3" textAnchor="middle">
        the hospital
      </text>
      <text x="120" y="115" className="ask-art-label ask-art-step-2" textAnchor="middle">
        your permission
      </text>
    </svg>
  );
}
