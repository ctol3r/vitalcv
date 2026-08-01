/**
 * evidenceInputState — the homepage evidence field's UI state, derived.
 *
 * WHY A MODULE. Before this, the field's state was implicit: `AskHome` held
 * `raw` and `error`, and the rendered result was decided by three separate
 * expressions (`digits.length === 10 && !valid`, `!valid`, `error || ...`).
 * Nothing named the states, so nothing could test them and CSS had to infer
 * them from `:placeholder-shown` — which is why the field could look "empty"
 * while holding a rejected value.
 *
 * This derives one named state from inputs that are already the source of
 * truth. It owns NO validation: `checkNpi` (lib/vital/npi.ts) remains the only
 * validator, shared with `components/vital/NpiInput.tsx` and onboarding.
 *
 * Deliberately excluded: `resolving`, `resolved` and `system-error`. Those
 * describe a LOOKUP, not a field, and belong to `LiveNpiResult`. A field that
 * knows about NPPES is a field that will eventually fetch.
 */

import { checkNpi, type NpiCheck } from '@/lib/vital/npi';

export type EvidenceInputState =
  | 'idle'
  | 'focused-empty'
  | 'editing'
  | 'valid'
  | 'invalid'
  | 'submitting'
  | 'disabled';

/** Color-independent validity, exposed separately so CSS never infers it. */
export type EvidenceInputValidity = 'empty' | 'partial' | 'valid' | 'invalid';

export interface EvidenceInputStatus {
  state: EvidenceInputState;
  validity: EvidenceInputValidity;
  check: NpiCheck;
  /** Digits only, capped at 10 — what the input should display. */
  digits: string;
  /** True when the CTA may fire. */
  canSubmit: boolean;
  /**
   * The correction to show, or null. Non-null ONLY when there is something
   * actionable to say: a half-typed number is not an error, it is progress.
   */
  errorMessage: string | null;
}

export interface DeriveArgs {
  /** Raw field value, exactly as typed. */
  raw: string;
  focused: boolean;
  /** A submit has been attempted and is in flight. */
  submitting?: boolean;
  disabled?: boolean;
  /**
   * A submit was attempted against an invalid value. Until then a bad value is
   * shown as progress, not as a failure — nobody should be told they are wrong
   * while still typing.
   */
  submitAttempted?: boolean;
  /** An error raised by the owner (e.g. submit rejected the value). */
  externalError?: string | null;
}

export function deriveEvidenceInputState({
  raw,
  focused,
  submitting = false,
  disabled = false,
  submitAttempted = false,
  externalError = null,
}: DeriveArgs): EvidenceInputStatus {
  const check = checkNpi(raw);
  const digits = check.digits;

  const validity: EvidenceInputValidity =
    check.validity === 'valid'
      ? 'valid'
      : digits.length === 0
        ? 'empty'
        : // A complete-but-wrong number, or characters an NPI cannot contain,
          // is genuinely invalid. Anything shorter is simply unfinished.
          check.validity === 'bad_checksum' || check.validity === 'not_numeric'
          ? 'invalid'
          : 'partial';

  // Surfaced only once it is useful: a live "not a valid NPI" on digit three
  // is noise, and it trains people to ignore the line that will later matter.
  const showsError = validity === 'invalid' || (submitAttempted && validity !== 'valid');
  const errorMessage = showsError
    ? (externalError ?? check.reason ?? 'Enter a full 10-digit NPI.')
    : externalError;

  const state: EvidenceInputState = disabled
    ? 'disabled'
    : submitting
      ? 'submitting'
      : errorMessage
        ? 'invalid'
        : validity === 'valid'
          ? 'valid'
          : digits.length > 0
            ? 'editing'
            : focused
              ? 'focused-empty'
              : 'idle';

  return {
    state,
    validity,
    check,
    digits,
    canSubmit: validity === 'valid' && !disabled && !submitting,
    errorMessage,
  };
}

/**
 * True when the label should compress out of the digits' way — focused, or
 * holding a value. Kept here rather than in CSS because `:placeholder-shown`
 * cannot see a value the component is normalising, and a label that lies about
 * whether the field is filled is worse than no label at all.
 */
export function isLabelFloating(status: EvidenceInputStatus, focused: boolean): boolean {
  return focused || status.digits.length > 0;
}
