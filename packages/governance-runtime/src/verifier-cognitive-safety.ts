/**
 * Verifier cognitive safety layer (W2-PR83A).
 *
 * Distinguishes replay observability warnings from policy denials so
 * the verifier can never confuse "we don't know yet" with "we deny."
 * Pure validator — caller passes the rendered surface description.
 */

export const SURFACE_MESSAGE_KINDS = [
  "REPLAY_OBSERVATION",
  "POLICY_DENIAL",
  "AMBIGUITY_NOTICE",
  "EVIDENCE_GAP",
  "CONFIDENCE_LABEL",
] as const;
export type SurfaceMessageKind = (typeof SURFACE_MESSAGE_KINDS)[number];

export interface SurfaceMessage {
  readonly id: string;
  readonly kind: SurfaceMessageKind;
  readonly text: string;
  /** Whether this message visually conveys denial-grade authority. */
  readonly rendersAsDenial: boolean;
  /** Whether this message visually conveys ambiguity. */
  readonly rendersAsAmbiguous: boolean;
}

export type CognitiveSafetyViolation =
  | { readonly tag: "replay-observation-rendered-as-denial"; readonly id: string }
  | { readonly tag: "ambiguity-notice-rendered-non-ambiguous"; readonly id: string }
  | { readonly tag: "policy-denial-rendered-ambiguous"; readonly id: string }
  | { readonly tag: "evidence-gap-without-ambiguity-marker"; readonly id: string }
  | { readonly tag: "confidence-label-overconfident"; readonly id: string; readonly text: string };

const FORBIDDEN_OVERCONFIDENT = [
  /\bguaranteed\b/i,
  /\bcertain\b/i,
  /\babsolute\b/i,
  /\bproven\b/i,
];

export interface VerifierCognitiveSafetyReport {
  readonly executedAt: string;
  readonly messagesEvaluated: number;
  readonly violations: readonly CognitiveSafetyViolation[];
  readonly hasCiGatingCondition: boolean;
}

export function validateVerifierCognitiveSafety(
  messages: readonly SurfaceMessage[],
  nowIso: string,
): VerifierCognitiveSafetyReport {
  const violations: CognitiveSafetyViolation[] = [];
  for (const m of messages) {
    if (m.kind === "REPLAY_OBSERVATION" && m.rendersAsDenial) {
      violations.push({ tag: "replay-observation-rendered-as-denial", id: m.id });
    }
    if (m.kind === "AMBIGUITY_NOTICE" && !m.rendersAsAmbiguous) {
      violations.push({ tag: "ambiguity-notice-rendered-non-ambiguous", id: m.id });
    }
    if (m.kind === "POLICY_DENIAL" && m.rendersAsAmbiguous) {
      violations.push({ tag: "policy-denial-rendered-ambiguous", id: m.id });
    }
    if (m.kind === "EVIDENCE_GAP" && !m.rendersAsAmbiguous) {
      violations.push({ tag: "evidence-gap-without-ambiguity-marker", id: m.id });
    }
    if (m.kind === "CONFIDENCE_LABEL") {
      for (const re of FORBIDDEN_OVERCONFIDENT) {
        if (re.test(m.text)) {
          violations.push({ tag: "confidence-label-overconfident", id: m.id, text: m.text });
          break;
        }
      }
    }
  }
  return Object.freeze({
    executedAt: nowIso,
    messagesEvaluated: messages.length,
    violations: Object.freeze(violations),
    hasCiGatingCondition: violations.length > 0,
  });
}
