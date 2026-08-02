'use client';

/**
 * EvidenceInput — the homepage's NPI entry, as a product object.
 *
 * OWNERSHIP. This component owns PRESENTATION and focus only. It does not
 * validate (that is `lib/vital/npi.ts`), does not derive its own state (that is
 * `evidenceInputState.ts`), does not fetch, does not know NPPES exists, and
 * does not touch storage or analytics — `AskHome` keeps all of that, unchanged.
 * A field that knows about a registry is a field that will eventually fetch
 * from one.
 *
 * NOT A FORK OF NpiInput. `components/vital/NpiInput.tsx` renders ten
 * decorative cells behind a transparent, caret-hidden input and is used by
 * onboarding, employer setup, public lookup, reviewer request and search.
 * Changing it to serve the hero would be a breaking change to five surfaces for
 * a presentation that only the homepage wants. The two controls share the thing
 * that must not diverge — the validator — and nothing else.
 * See docs/design/home-evidence-experience-v2.md §11 R0-1.
 *
 * PINNED CONTRACTS. `tests/e2e/ask-home.spec.ts` and `ask-npi-response.spec.ts`
 * depend on: the `#npi-input` id, `#ask-hint` rendering "N/10 digits", a CSS
 * rule carrying both `:focus-within` and `ask-field`, and the input's computed
 * font-size staying LARGER than the `#ask-title` above it. All preserved.
 *
 * NO NEW ICON IMPORT. `check-design-lint` LINT-02 ratchets raw `lucide-react`
 * imports and there is no `components/Icon.tsx` in this repo. `TrustGlyph` is
 * the state-iconography abstraction, but it maps an `EvidenceState` — a claim
 * about a source — and a field's validity is not one; rendering "Source-backed"
 * next to a well-formed number would be a straightforward lie. So the two marks
 * here are local inline SVG, always `aria-hidden`, and always accompanied by
 * text. Meaning never rides on the glyph or on colour.
 */

import * as React from 'react';

import {
  deriveEvidenceInputState,
  isLabelFloating,
  type EvidenceInputStatus,
} from './evidenceInputState';

const INPUT_ID = 'npi-input';
const HINT_ID = 'ask-hint';
const ERROR_ID = 'ask-npi-error';

/**
 * The field's accessible name — ONE string for every state.
 *
 * An earlier revision of this component reworded the label as it floated
 * ("Enter your 10-digit NPI" → "NPI number"). Because this is a real
 * `<label for>`, that text IS the accessible name, so the control renamed
 * itself the instant it took focus: a screen reader announced one field while
 * describing another, and a voice-control user lost the words they could see.
 * The float is typographic only — see `[data-label-floating]` in
 * evidence-input.css, which compresses these same words to a tracked mono caps
 * line. `__tests__/evidence-input.test.tsx` guards the drift from returning.
 *
 * PINNED: the three homepage e2e specs locate this field by role + name, so
 * this must keep containing "NPI".
 */
const NPI_LABEL = 'Your 10-digit NPI';

/** A resolved value. Bounded, never a claim about a source. */
function MarkValid() {
  return (
    <svg viewBox="0 0 16 16" className="evidence-field__mark" aria-hidden="true" focusable="false">
      <path d="M3.5 8.4 L6.4 11.3 L12.5 5.2" />
    </svg>
  );
}

/** Something to correct. Paired with text — never the only signal. */
function MarkInvalid() {
  return (
    <svg viewBox="0 0 16 16" className="evidence-field__mark" aria-hidden="true" focusable="false">
      <path d="M8 3.6 L8 9.1" />
      <circle cx="8" cy="12" r="0.9" />
    </svg>
  );
}

export interface EvidenceInputProps {
  /** Raw value, owned by the caller. */
  value: string;
  onValueChange: (next: string) => void;
  onSubmit: () => void;
  /** An error the owner raised (e.g. submit rejected the value). */
  externalError?: string | null;
  submitting?: boolean;
  disabled?: boolean;
  /** Primary action label. */
  ctaLabel?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Called whenever the derived status changes, so the owner can mirror phase. */
  onStatusChange?: (status: EvidenceInputStatus) => void;
}

export function EvidenceInput({
  value,
  onValueChange,
  onSubmit,
  externalError = null,
  submitting = false,
  disabled = false,
  // Typographic apostrophe (U+2019), not ASCII — this is editorial copy set in
  // the serif, and it is what main shipped. A guard asserts the exact string.
  ctaLabel = 'Check what’s ready',
  inputRef,
  onStatusChange,
}: EvidenceInputProps) {
  const [focused, setFocused] = React.useState(false);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const status = deriveEvidenceInputState({
    raw: value,
    focused,
    submitting,
    disabled,
    submitAttempted,
    externalError,
  });

  const { state, validity, digits, canSubmit, errorMessage } = status;
  const floating = isLabelFloating(status, focused);

  const lastReported = React.useRef<string>('');
  React.useEffect(() => {
    const key = `${state}|${validity}|${errorMessage ?? ''}`;
    if (lastReported.current === key) return;
    lastReported.current = key;
    onStatusChange?.(status);
  }, [state, validity, errorMessage, status, onStatusChange]);

  const submit = () => {
    setSubmitAttempted(true);
    onSubmit();
  };

  return (
    <form
      className="ask-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
    >
      <div
        className="ask-field evidence-field"
        data-evidence-input-state={state}
        data-evidence-input-validity={validity}
        data-label-floating={floating ? '' : undefined}
      >
        {/*
          One real <label>, present and associated in EVERY state — never a
          placeholder standing in for one, and never REWORDED between states
          (see NPI_LABEL). It compresses typographically rather than changing
          what it says. The band it occupies is a fixed height in CSS, so
          nothing below it moves when the type shrinks.
        */}
        <label className="evidence-field__label" htmlFor={INPUT_ID}>
          {NPI_LABEL}
        </label>

        <div className="evidence-field__row">
          <input
            id={INPUT_ID}
            ref={inputRef}
            className="ask-input evidence-field__input"
            value={digits}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            // An NPI is a public identifier with no autofill category that
            // fits; a wrong one (`off` is honoured inconsistently) is worse
            // than none. `username` and `one-time-code` both mis-describe it.
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled || submitting}
            aria-invalid={Boolean(errorMessage)}
            // Always the one message band. Referencing the error span as well
            // would read the correction twice — once as the description and
            // again as the alert.
            aria-describedby={HINT_ID}
            onChange={(event) => {
              // Resuming typing retracts the correction. Being told you are
              // wrong while actively fixing it is the nag this avoids — and it
              // matches the behavior AskHome had before the extraction.
              if (submitAttempted) setSubmitAttempted(false);
              onValueChange(event.target.value);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />

          {/*
            A decorative guide showing how many digits the field expects. It is
            NOT a placeholder-label: the real <label> above says what the field
            is, and this is aria-hidden, inert, and absolutely positioned so it
            occupies no layout of its own. Without it the empty capsule reads as
            a textarea — a 60px line with nothing on it.
          */}
          {digits.length === 0 ? (
            <span className="evidence-field__guide" aria-hidden="true">
              ··········
            </span>
          ) : null}

          {/*
            Fixed-width slot. It is present in every state — an empty box when
            there is nothing to say — so a mark appearing cannot reflow the
            digits beside it.
          */}
          <span className="evidence-field__status" data-mark={validity}>
            {validity === 'valid' ? <MarkValid /> : null}
            {errorMessage ? <MarkInvalid /> : null}
          </span>
        </div>
      </div>

      {/*
        The correction and the counter share one band, so neither can push the
        CTA down when it appears. `role="alert"` announces the correction
        without moving focus away from the field being corrected.
      */}
      {errorMessage ? (
        /* `#ask-hint` is the message band in BOTH states, so the id the input
           describes itself by never disappears (ask-home.spec.ts reads it). */
        <p className="ask-hint evidence-field__message" id={HINT_ID}>
          <span className="ask-error evidence-field__error" id={ERROR_ID} role="alert">
            <MarkInvalid />
            {errorMessage}
          </span>
        </p>
      ) : (
        /* Deliberately NOT a live region. It used to be one, which meant a
           screen reader announced the whole "N/10 digits · Free for clinicians
           · No account required" line on every single keystroke. The one thing
           that must be announced — a correction — now carries role="alert"
           above, which is both stronger and quieter. */
        <p className="ask-hint evidence-field__message" id={HINT_ID}>
          <span className="ask-hint-part">{digits.length}/10 digits</span>
          <span className="ask-hint-sep"> · </span>
          <span className="ask-hint-part">Free for clinicians</span>
          <span className="ask-hint-sep"> · </span>
          <span className="ask-hint-part">No account required</span>
        </p>
      )}

      <button
        type="submit"
        className="ask-go evidence-cta"
        data-home-primary-cta=""
        disabled={!canSubmit}
        data-evidence-cta-state={submitting ? 'submitting' : canSubmit ? 'ready' : 'waiting'}
      >
        <span className="evidence-cta__label">{submitting ? 'Checking…' : ctaLabel}</span>
        {/* Directional cue only. Finite, and it never moves the button. */}
        <svg viewBox="0 0 16 16" className="evidence-cta__arrow" aria-hidden="true" focusable="false">
          <path d="M2.5 8 H12" />
          <path d="M8.4 4.4 L12 8 L8.4 11.6" />
        </svg>
      </button>
    </form>
  );
}
