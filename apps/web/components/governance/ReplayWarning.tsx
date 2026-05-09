/**
 * ReplayWarning — shared replay-visibility disclaimer component.
 *
 * Doctrine: docs/ops/replay-taxonomy-map.md
 *           docs/ops/dashboard-governance-enforcement.md §2.3
 *           docs/ops/TRUST_GUARANTEE_LEXICON.md §1.3
 *
 * Per W2-PR17A target 5: every dashboard surface that displays replay
 * telemetry must include this disclaimer.
 *
 * Per W2-PR19A non-negotiable rule #4: replay ambiguity may not disappear
 * across layers. This component surfaces ambiguity explicitly.
 *
 * Per the lexicon §1.3: phrases like "replay protected" / "replay-resistant"
 * are FORBIDDEN. This component uses ONLY allowed wording.
 */

import {
  type ReplayState,
  failClosedReplayState,
  replayStateDescription,
  assertNever,
} from "@vitalcv/governance-runtime";

export interface ReplayWarningProps {
  /** Current replay state (any runtime value; coerced to R-AMBIGUOUS on unknown). */
  readonly currentState?: unknown;
  /** Optional explicit context note (e.g., "Window: last 24h"). */
  readonly contextNote?: string;
  /** Render mode: "compact" for inline warning chip; "full" for full disclosure block. */
  readonly mode?: "compact" | "full";
}

function statePill(state: ReplayState): { readonly emoji: string; readonly label: string } {
  switch (state) {
    case "R-OBSERVED":
      return { emoji: "🔵", label: "R-OBSERVED" };
    case "R-DENIED":
      return { emoji: "🔴", label: "R-DENIED" };
    case "R-ACCEPTED":
      return { emoji: "❓", label: "R-ACCEPTED (forensic detection only)" };
    case "R-COLLAPSED":
      return { emoji: "🟢", label: "R-COLLAPSED" };
    case "R-AMBIGUOUS":
      return { emoji: "⚠", label: "R-AMBIGUOUS" };
    default:
      return assertNever(state, "ReplayWarning: unhandled ReplayState");
  }
}

const VISIBILITY_DISCLAIMER =
  "Replay observability + best-effort idempotency check via correlationId (24h window). " +
  "DB-enforced replay prevention deferred to W2-PR2B-MIG-A.";

const PREVENTION_DISCLAIMER =
  "Replay observability is NOT replay prevention. " +
  "Capture-replay attacks require payloadHash forensic detection (post ML-Rec-1).";

const FORENSIC_CAUTION =
  "Cross-actor replay (stolen JWT) and long-window replay (>24h) are NOT defended.";

export function ReplayWarning(props: ReplayWarningProps): JSX.Element {
  const mode = props.mode ?? "full";
  const state = failClosedReplayState(props.currentState ?? null);
  const pill = statePill(state);
  const description = replayStateDescription(state);

  if (mode === "compact") {
    return (
      <span
        title={`${description}\n\n${VISIBILITY_DISCLAIMER}\n\n${PREVENTION_DISCLAIMER}`}
        aria-label={`Replay state: ${pill.label}. ${description}. Replay observability is NOT replay prevention.`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.125rem 0.5rem",
          borderRadius: "0.25rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          backgroundColor: "#fef3c7",
          color: "#92400e",
          border: "1px solid #fde68a",
        }}
      >
        <span aria-hidden>{pill.emoji}</span>
        <span>{pill.label}</span>
      </span>
    );
  }

  return (
    <aside
      role="note"
      aria-labelledby="replay-warning-heading"
      style={{
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        backgroundColor: "#fffbeb",
        border: "1px solid #fde68a",
        color: "#78350f",
        fontSize: "0.875rem",
        lineHeight: 1.4,
      }}
    >
      <h3
        id="replay-warning-heading"
        style={{ margin: 0, marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <span aria-hidden>{pill.emoji}</span>
        Replay Governance Notice — {pill.label}
      </h3>
      <p style={{ margin: 0, marginBottom: "0.5rem" }}>
        <strong>State:</strong> {description}
      </p>
      <p style={{ margin: 0, marginBottom: "0.5rem" }}>
        <strong>Visibility:</strong> {VISIBILITY_DISCLAIMER}
      </p>
      <p style={{ margin: 0, marginBottom: "0.5rem" }}>
        <strong>Prevention:</strong> {PREVENTION_DISCLAIMER}
      </p>
      <p style={{ margin: 0, marginBottom: props.contextNote ? "0.5rem" : 0 }}>
        <strong>Forensic caution:</strong> {FORENSIC_CAUTION}
      </p>
      {props.contextNote != null && (
        <p style={{ margin: 0, fontStyle: "italic" }}>{props.contextNote}</p>
      )}
    </aside>
  );
}
