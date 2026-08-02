'use client';

/**
 * The homepage is an act followed by one operable explanation.
 *
 * A clinician can enter an NPI immediately. Readers who do not type get the
 * same product argument in one four-step pane instead of a ledger, two audience
 * chapters, and three repeated beats scattered down the page.
 */

import Link from 'next/link';
import * as React from 'react';

import { ExpandingEyebrow } from '@/components/home/ExpandingEyebrow';
import { EvidenceInput } from '@/components/home/ask/EvidenceInput';
import type { EvidenceInputState } from '@/components/home/ask/evidenceInputState';
import { LiveNpiResult } from '@/components/home/LiveNpiResult';
import type { SequencePhase } from '@/components/readiness/sourceCheckNarration';
import { SpineTabs, type SpineStep } from '@/components/home/spine/SpineTabs';
import { TruthBoundary } from '@/components/home/TruthBoundary';
import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';
import { checkNpi } from '@/lib/vital/npi';

function sourceCadenceSentence(): string {
  const label = (id: string) =>
    SOURCE_LANE_OPS.find((lane) => lane.laneId === id)?.cadenceLabel ?? 'not read';
  return (
    `NPPES is ${label('nppes_identity')} per request; ` +
    `OIG/LEIE returns a ${label('oig_exclusions')} and CMS PECOS a ${label('pecos_enrollment')}; ` +
    `state licensure is ${label('state_license')}.`
  );
}

const LANE_EXPLANATIONS: Record<string, { name: string; what: string }> = {
  nppes_identity: {
    name: 'NPPES identity',
    what: 'The federal provider registry — identity, taxonomy, and practice context.',
  },
  oig_exclusions: {
    name: 'OIG/LEIE exclusions',
    what: 'The federal exclusion list hospitals and medical groups screen before billing.',
  },
  pecos_enrollment: {
    name: 'CMS PECOS enrollment',
    what: 'Medicare enrollment evidence from the CMS snapshot.',
  },
  state_license: {
    name: 'State licensure',
    what: 'License standing from state medical and nursing boards when access exists.',
  },
  employment_history: {
    name: 'Employment history',
    what: 'Practice history confirmed by the organizations that hold the record.',
  },
  board_cert: {
    name: 'Board certification',
    what: 'Specialty certification from the relevant authority when connected.',
  },
};

function laneAvailability(
  lifecycle: string,
  cadenceLabel: string,
): { label: string; tone: 'ok' | 'gated' | 'off' } {
  if (lifecycle === 'active' || lifecycle === 'partial') {
    return { label: `Available · ${cadenceLabel}`, tone: 'ok' };
  }
  if (lifecycle === 'planned') return { label: 'Access required', tone: 'gated' };
  return { label: 'Not yet connected', tone: 'off' };
}

function HomeLaneLedger() {
  return (
    <div className="ask-ledger-rows" data-home-lane-ledger="">
      {SOURCE_LANE_OPS.map((lane) => {
        const copy = LANE_EXPLANATIONS[lane.laneId];
        if (!copy) return null;
        const state = laneAvailability(lane.lifecycle, lane.cadenceLabel);
        return (
          <div
            key={lane.laneId}
            className="ask-ledger-row"
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
  );
}

function ArtifactPanel({
  children,
  kind,
  glass = false,
}: {
  children: React.ReactNode;
  kind: string;
  glass?: boolean;
}) {
  return (
    <figure
      className={glass ? 'vt-artifact vt-artifact--glass' : 'vt-artifact'}
      data-ask-artifact={kind}
    >
      {children}
    </figure>
  );
}

/**
 * Step 3. The step's own line promises "the exact claim, source, receipt,
 * limitation, and permission boundary" — but `ProofPacketInspector` renders a
 * CLAIM: claim → source → retrieval/receipt → state → limitation, and nothing
 * about permission. Walking all five of its tabs on the live page, the words
 * permission, consent, share and revoke appeared in none of them. The step was
 * named "the packet you choose" and then never said what choosing meant.
 *
 * So the boundary is stated here, beside the packet it governs, rather than as
 * a sixth row inside the inspector: permission is a property of the SHARE, not
 * of any one claim, and that component is also mounted by HomeProofMoment,
 * HorizontalCareerFilm and /design/proof-packet, none of which are about
 * sharing.
 *
 * The wording is taken verbatim from /trust ("Sharing is explicit"), which is
 * the settled public claim — this repeats it, it does not author a second one.
 * Deliberately NOT said: anything about revoking, and anything about a consent
 * receipt. `POST /api/apply/share` is real and packet consent receipts exist in
 * the backend, but neither is what this illustration shows, and "every share
 * leaves a consent receipt" is a stronger promise than this page needs.
 */
function PacketChoicePanel() {
  return (
    <div data-ask-artifact="once">
      <ProofPacketInspector className="ask-beat-inspector" />
      <p className="ask-permission" data-home-permission-boundary="">
        Nothing is shared until you share it. A shared proof packet names exactly
        what the recipient can see.
      </p>
      <p className="ask-door-cta">
        <Link href="/onboarding">Build your CV Wallet →</Link>
      </p>
    </div>
  );
}

function ReviewPanel() {
  return (
    <div>
      <ArtifactPanel kind="packet" glass>
        <PacketArtifact />
      </ArtifactPanel>
      <p className="ask-door-cta">
        <Link href="/employers" data-home-employer-door="">
          See the employer workflow →
        </Link>
      </p>
    </div>
  );
}

function HomeSpine() {
  const steps: readonly SpineStep[] = [
    {
      id: 'npi',
      step: 'Step 1',
      name: 'Start with your NPI',
      line: 'One number opens a recognizable public identity record — no blank intake wall.',
      panel: (
        <ArtifactPanel kind="checkrun">
          <CheckRunArtifact />
        </ArtifactPanel>
      ),
      illustrative: true,
    },
    {
      id: 'evidence',
      step: 'Step 2',
      name: 'Source evidence',
      line: 'Each lane names what can be read, its cadence, and where access is still required.',
      panel: <HomeLaneLedger />,
    },
    {
      id: 'packet',
      step: 'Step 3',
      name: 'The packet you choose',
      line: 'Inspect the exact claim, source, receipt, limitation, and permission boundary.',
      panel: <PacketChoicePanel />,
    },
    {
      id: 'review',
      step: 'Step 4',
      name: 'Hospital review',
      line: 'Reviewers inspect each claim and remaining gap. Their committee keeps the decision.',
      panel: <ReviewPanel />,
      illustrative: true,
    },
  ];

  return (
    // mist — the second movement of the tone sequence (contract §4). The
    // journey is where the page stops being a hero and starts being an
    // explanation, so it earns its own surface rather than a heading change.
    <div data-home-spine="" data-home-tone="mist">
      <SpineTabs
        eyebrow="The path"
        title="One record. Four moments."
        lede="Start with your NPI, see what the sources can answer, choose what travels, and leave the final decision where it belongs."
        steps={steps}
      />
    </div>
  );
}

/**
 * The hero's phase — the one marker the whole first screen choreographs around
 * (contract §7). Derived here because AskHome is the only place that can see
 * both halves: the field's own state before submit, and the result's phase
 * after it.
 *
 * It is a STYLING coordinate and nothing else. It carries no NPI, no identity,
 * and no source outcome, so the decorative atmosphere that reads it cannot
 * describe a real person or imply a source answered before one did (RISK 1).
 */
export type HomePhase = 'idle' | 'active' | 'resolving' | 'resolved' | 'system-error';

export function deriveHomePhase(args: {
  submitted: boolean;
  resultPhase: SequencePhase | null;
  inputState: EvidenceInputState;
}): HomePhase {
  if (args.submitted) {
    // `error` is renamed at this boundary: the hero calls it `system-error` to
    // keep saying, in the markup itself, that a failed lookup is a state of the
    // system and not a finding about the clinician.
    if (args.resultPhase === 'error') return 'system-error';
    if (args.resultPhase === 'resolved') return 'resolved';
    return 'resolving';
  }
  // Anything other than an untouched field means the visitor is engaging. A
  // disabled field has not been engaged with, so it stays idle.
  return args.inputState === 'idle' || args.inputState === 'disabled' ? 'idle' : 'active';
}

export function AskHome() {
  const [raw, setRaw] = React.useState('');
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [resultPhase, setResultPhase] = React.useState<SequencePhase | null>(null);
  const [inputState, setInputState] = React.useState<EvidenceInputState>('idle');
  const [pendingFieldFocus, setPendingFieldFocus] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
  }, []);

  /**
   * Return focus to the field after a reset — once it exists.
   *
   * `onReset` cannot do this itself. At the moment it fires, `LiveNpiResult` is
   * still the mounted branch and the input is not, so `inputRef.current` is
   * null and `.focus()` is a silent no-op. Measured before this: focus sat on
   * `<body>` at 0, 100, 500 and 1500ms after reset, which drops a keyboard or
   * screen-reader user back to the top of the document and makes them tab
   * through the whole header to try again.
   *
   * The existing reset guard checks the field is visible and cleared, which it
   * always was — visible is not the same as focused, and that gap is why this
   * survived.
   */
  React.useEffect(() => {
    if (!pendingFieldFocus || submitted !== null) return;
    inputRef.current?.focus();
    setPendingFieldFocus(false);
  }, [pendingFieldFocus, submitted]);

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const figures = rootRef.current?.querySelectorAll('[data-home-spine] .vt-artifact') ?? [];
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
      { threshold: 0.35 },
    );
    figures.forEach((figure) => observer.observe(figure));
    return () => observer.disconnect();
  }, []);

  // `checkNpi` normalises its own input, so the digit-stripping that used to
  // happen here first is redundant — and having two normalisers was how the
  // field and the submit could disagree about what had been typed.
  const check = checkNpi(raw);
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
      // Lookup remains usable when storage is unavailable.
    }
    setSubmitted(check.npi);
  }, [valid, check.npi, check.reason]);

  return (
    // `data-home-tone` only DECLARES the semantic surface variables for this
    // subtree (styles/home-surfaces.css) — spending them is opt-in per element,
    // so carrying the tone here changes no paint. Contract:
    // docs/design/home-evidence-experience-v2.md §4.
    <div
      className="ask"
      ref={rootRef}
      data-home-tone="paper"
      data-home-phase={deriveHomePhase({ submitted: submitted !== null, resultPhase, inputState })}
    >
      <section className="ask-stage" data-home-hero="" aria-labelledby="ask-title">
        <div className="ask-inner">
          <ExpandingEyebrow label="For clinicians" detail="Start with one NPI." />
          <h1 id="ask-title" className="ask-title">
            Your career evidence, ready before your next job.
          </h1>

          {submitted ? (
            <div className="ask-answer">
              <LiveNpiResult
                npi={submitted}
                onPhaseChange={setResultPhase}
                onReset={() => {
                  setSubmitted(null);
                  setRaw('');
                  // Without this the hero would stay in `resolved`/`system-error`
                  // while showing an empty field — the phase has to be released
                  // with the result that produced it.
                  setResultPhase(null);
                  setInputState('idle');
                  // Claimed here, applied in the effect above once the field
                  // has actually mounted.
                  setPendingFieldFocus(true);
                }}
              />
            </div>
          ) : (
            <>
              {/*
                The field's presentation and focus moved to EvidenceInput; every
                other behavior stayed here. AskHome still owns the value, the
                submit, the storage writes, the analytics and the reset —
                deliberately, so there is exactly one place that knows what
                submitting an NPI means.
              */}
              <EvidenceInput
                value={raw}
                onValueChange={(next) => {
                  setRaw(next);
                  setError(null);
                }}
                onSubmit={submit}
                onStatusChange={(status) => setInputState(status.state)}
                externalError={error}
                inputRef={inputRef}
              />

              <p className="ask-promise">
                See what hospitals and credentialing teams can already confirm about
                you — identity, exclusions, Medicare enrollment — and what still
                needs attention.
              </p>

              <p className="ask-secondary">
                <Link href="/employers" data-home-employer-cta="">
                  Hiring clinicians? Start from evidence
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="ask-cadence" data-home-source-cadence="">
          {sourceCadenceSentence()}
        </p>
      </section>

      <HomeSpine />

      {/*
        trust — the third movement. This is the page's most load-bearing
        paragraph (what VitalCV will not claim), so it is deliberately the
        quietest surface rather than the loudest: depth, not drama.
        D6: it stays a plain always-mounted section — never a tab panel,
        never behind a disclosure.
      */}
      <section className="ask-boundary" data-home-tone="trust">
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
 * One NPI enters; three check rows resolve; a receipt lands. Labels name parts
 * of the illustration, never an asserted source result.
 */
export function CheckRunArtifact() {
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
      <text x="72" y="62" className="ask-art-label ask-art-step-1">
        your npi
      </text>
      {Array.from({ length: 10 }, (_, index) => (
        <rect
          key={index}
          x={150 + index * 30}
          y={48}
          width={18}
          height={18}
          rx={2}
          className="ask-art-slot ask-art-step-1"
        />
      ))}
      <line x1="72" y1="80" x2="648" y2="80" className="ask-art-rule ask-art-step-1" />
      {rows.map((row) => (
        <g key={row.label}>
          <text x="72" y={row.y + 22} className={`ask-art-label ask-art-step-${row.step}`}>
            {row.label}
          </text>
          <line
            x1="210"
            y1={row.y + 18}
            x2="470"
            y2={row.y + 18}
            className={`ask-art-line ask-art-step-${row.step}`}
          />
          <rect
            x="520"
            y={row.y + 2}
            width="128"
            height="26"
            rx="3"
            className={`ask-art-chip ask-art-step-${row.step}`}
          />
        </g>
      ))}
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

/** A consented packet crosses to a reviewer; the unresolved gap stays visible. */
export function PacketArtifact() {
  return (
    <svg
      viewBox="0 0 720 400"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="A consented packet arriving on a reviewer's desk: rows of claims each carrying source and time, one gap stated plainly, and the decision left to the committee"
    >
      <rect x="40" y="60" width="200" height="260" rx="4" className="ask-art-paper ask-art-step-1" />
      <line x1="64" y1="100" x2="216" y2="100" className="ask-art-rule ask-art-step-1" />
      {[128, 152, 176].map((y) => (
        <line key={y} x1="64" y1={y} x2={y === 176 ? 160 : 216} y2={y} className="ask-art-line ask-art-step-1" />
      ))}
      <circle cx="196" cy="284" r="16" className="ask-art-seal ask-art-step-1" />
      <text x="64" y="52" className="ask-art-label ask-art-step-1">
        the packet
      </text>
      <path d="M240 190 H300" className="ask-art-rule ask-art-flow ask-art-step-2" />
      <rect x="300" y="36" width="380" height="308" rx="4" className="ask-art-paper-2 ask-art-step-2" />
      <text x="324" y="28" className="ask-art-label ask-art-step-2">
        your review
      </text>
      {[
        { y: 76, step: 3 },
        { y: 140, step: 3 },
        { y: 204, step: 4 },
      ].map((row, index) => (
        <g key={index}>
          <line x1="324" y1={row.y} x2="580" y2={row.y} className={`ask-art-line ask-art-step-${row.step}`} />
          <line x1="324" y1={row.y + 20} x2="480" y2={row.y + 20} className={`ask-art-meta ask-art-step-${row.step}`} />
          <circle cx="636" cy={row.y + 8} r="12" className={`ask-art-seal ask-art-step-${row.step}`} />
        </g>
      ))}
      <rect x="318" y="252" width="280" height="34" rx="3" className="ask-art-gap ask-art-step-5" />
      <text x="330" y="273" className="ask-art-label ask-art-step-5">
        what is missing
      </text>
      <text x="324" y="122" className="ask-art-note ask-art-step-6">
        source + time on every claim
      </text>
      <text x="324" y="330" className="ask-art-note ask-art-step-6">
        your decision, your committee
      </text>
    </svg>
  );
}
