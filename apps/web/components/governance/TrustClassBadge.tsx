/**
 * TrustClassBadge — runtime-grounded trust-class indicator.
 *
 * Doctrine: docs/ops/trust-class-taxonomy.md
 *           docs/ops/dashboard-governance-enforcement.md §1.1
 *
 * Per W2-PR19A non-negotiable rule #2: derives semantics ONLY from
 * @vitalcv/governance-runtime registry.
 *
 * Per W2-PR18A: unknown trust class renders as explicit "UNCLASSIFIED" badge,
 * NEVER silently maps to C-1 or any other class.
 */

import * as React from "react";
import {
  type TrustClass,
  failClosedTrustClass,
  trustClassDescription,
  assertNever,
} from "@vitalcv/governance-runtime";

export interface TrustClassBadgeProps {
  readonly trustClass: unknown;
  readonly className?: string;
}

function styleForClass(cls: TrustClass): { readonly emoji: string; readonly label: string; readonly bg: string; readonly fg: string } {
  switch (cls) {
    case "C-1":
      return { emoji: "🟢", label: "C-1", bg: "#d1fae5", fg: "#065f46" };
    case "C-2":
      return { emoji: "🟢", label: "C-2", bg: "#ecfccb", fg: "#3f6212" };
    case "T0":
      return { emoji: "🟠", label: "T0", bg: "#fed7aa", fg: "#7c2d12" };
    case "R0":
      return { emoji: "🔵", label: "R0", bg: "#dbeafe", fg: "#1e3a8a" };
    case "D0":
      return { emoji: "🔴", label: "D0", bg: "#fecaca", fg: "#991b1b" };
    default:
      return assertNever(cls, "TrustClassBadge: unhandled TrustClass");
  }
}

export function TrustClassBadge(props: TrustClassBadgeProps): React.ReactElement {
  const cls = failClosedTrustClass(props.trustClass);

  if (cls === null) {
    // Per W2-PR18A target 1: unknown class renders as explicit UNCLASSIFIED.
    return (
      <span
        className={props.className}
        title="Trust class UNCLASSIFIED. Per docs/ops/runtime-trust-class-map.md, every audit-emitting code path requires explicit class assignment. Treating as DEGRADED per fail-closed posture."
        aria-label="Trust class UNCLASSIFIED — fail-closed; investigation required"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.125rem 0.5rem",
          borderRadius: "0.25rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          backgroundColor: "#1f2937",
          color: "#fef2f2",
        }}
      >
        <span aria-hidden>⚠</span>
        <span>UNCLASSIFIED</span>
      </span>
    );
  }

  const style = styleForClass(cls);
  return (
    <span
      className={props.className}
      title={trustClassDescription(cls)}
      aria-label={`Trust class: ${style.label}. ${trustClassDescription(cls)}`}
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
