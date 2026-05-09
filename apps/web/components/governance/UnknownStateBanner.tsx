/**
 * UnknownStateBanner — explicit unknown-state UI for telemetry absence.
 *
 * Doctrine: docs/ops/runtime-integrity-dashboard.md §2 (CI-UNKNOWN)
 *           docs/ops/integrity-containment-dashboard.md (CT-UNKNOWN)
 *           W2-PR18A target 4 + 5
 *
 * Per W2-PR18A non-negotiable rules:
 *   - Missing telemetry NEVER renders healthy.
 *   - Operator-visible degraded continuity indicators.
 *   - No optimism-by-absence.
 *
 * Use this component on every dashboard surface that depends on telemetry
 * which may be absent / stale / unavailable.
 */

export interface UnknownStateBannerProps {
  /** Why telemetry is absent (operator-readable). */
  readonly reason: string;
  /** Optional: which axis is affected (integrity / containment / replay / forensic). */
  readonly axis?: "integrity" | "containment" | "replay" | "forensic" | "trust-class";
  /** Optional: timestamp of last-known-good telemetry, for context. */
  readonly lastKnownGoodAt?: string;
}

const AXIS_LABEL: Readonly<Record<NonNullable<UnknownStateBannerProps["axis"]>, string>> = Object.freeze({
  integrity: "Integrity telemetry",
  containment: "Containment telemetry",
  replay: "Replay telemetry",
  forensic: "Forensic telemetry",
  "trust-class": "Trust-class assignment",
});

export function UnknownStateBanner(props: UnknownStateBannerProps): JSX.Element {
  const axisLabel = props.axis != null ? AXIS_LABEL[props.axis] : "Telemetry";

  return (
    <aside
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        backgroundColor: "#f3f4f6",
        border: "2px dashed #6b7280",
        color: "#1f2937",
        fontSize: "0.875rem",
        lineHeight: 1.4,
      }}
    >
      <h3
        style={{
          margin: 0,
          marginBottom: "0.25rem",
          fontSize: "0.875rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span aria-hidden>❓</span>
        {axisLabel}: UNKNOWN
      </h3>
      <p style={{ margin: 0, marginBottom: props.lastKnownGoodAt ? "0.25rem" : 0 }}>
        <strong>Reason:</strong> {props.reason}
      </p>
      {props.lastKnownGoodAt != null && (
        <p style={{ margin: 0, marginBottom: "0.25rem", fontSize: "0.75rem", fontStyle: "italic" }}>
          Last known good telemetry: {props.lastKnownGoodAt}
        </p>
      )}
      <p style={{ margin: 0, fontSize: "0.75rem", color: "#4b5563" }}>
        Per W2-PR18A non-negotiable rule #2 (missing telemetry ≠ healthy telemetry), this surface
        is treated as DEGRADED until telemetry resumes.
      </p>
    </aside>
  );
}
