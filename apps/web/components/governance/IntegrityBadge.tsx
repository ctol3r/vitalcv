/**
 * IntegrityBadge — runtime-grounded integrity indicator badge.
 *
 * Doctrine: docs/ops/runtime-integrity-dashboard.md §2
 *           docs/ops/dashboard-governance-enforcement.md §1
 *
 * Per W2-PR18A non-negotiable rules:
 *   1. Unknown ≠ healthy.
 *   3. Dashboard semantics must remain runtime-grounded.
 *   5. Dashboard silence may not imply integrity.
 *
 * This component:
 *   - Accepts ANY runtime value via the `state` prop.
 *   - Uses failClosedIntegrity to coerce unknown → CI-UNKNOWN (NEVER CI-GREEN).
 *   - Renders all 6 IntegrityState values explicitly (compile-time exhaustive).
 *   - Surfaces the lexicon-aligned description as a tooltip / aria-label.
 *
 * Per W2-PR19A non-negotiable rule #2: derives state semantics ONLY from
 * @vitalcv/governance-runtime registry; no local literals.
 */

import * as React from "react";
import {
  type IntegrityState,
  failClosedIntegrity,
  integrityStateDescription,
  assertNever,
} from "@vitalcv/governance-runtime";

export interface IntegrityBadgeProps {
  /** Raw runtime value. May be IntegrityState OR unknown — fail-closed coerces. */
  readonly state: unknown;
  /** Optional className for layout styling. Visual semantics owned by this component. */
  readonly className?: string;
  /** Optional context note shown in the tooltip (e.g., "Source: EX-3 Postgres direct"). */
  readonly contextNote?: string;
}

/**
 * Style mapping per state. Exhaustive over IntegrityState union.
 */
function styleForState(state: IntegrityState): {
  readonly emoji: string;
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
} {
  switch (state) {
    case "CI-GREEN":
      return { emoji: "🟢", label: "CI-GREEN", bg: "#d1fae5", fg: "#065f46" };
    case "CI-DEGRADED":
      return { emoji: "🟡", label: "CI-DEGRADED", bg: "#fef3c7", fg: "#92400e" };
    case "CI-DRIFT":
      return { emoji: "🟠", label: "CI-DRIFT", bg: "#fed7aa", fg: "#7c2d12" };
    case "CI-FRAGMENTED":
      return { emoji: "🔴", label: "CI-FRAGMENTED", bg: "#fecaca", fg: "#991b1b" };
    case "CI-VIOLATION":
      return { emoji: "⚫", label: "CI-VIOLATION", bg: "#1f2937", fg: "#fef2f2" };
    case "CI-UNKNOWN":
      // CI-UNKNOWN is rendered as visibly degraded — NOT silently green.
      return { emoji: "❓", label: "CI-UNKNOWN", bg: "#e5e7eb", fg: "#374151" };
    default:
      // Compile-time exhaustiveness check (W2-PR18A target 6).
      return assertNever(state, "IntegrityBadge: unhandled IntegrityState");
  }
}

export function IntegrityBadge(props: IntegrityBadgeProps): React.ReactElement {
  const state = failClosedIntegrity(props.state);
  const style = styleForState(state);
  const description = integrityStateDescription(state);
  const tooltip = props.contextNote ? `${description}\n\n${props.contextNote}` : description;

  return (
    <span
      className={props.className}
      title={tooltip}
      aria-label={`Integrity state: ${style.label}. ${description}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        backgroundColor: style.bg,
        color: style.fg,
      }}
    >
      <span aria-hidden>{style.emoji}</span>
      <span>{style.label}</span>
    </span>
  );
}
