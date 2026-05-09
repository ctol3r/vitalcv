/**
 * TrustOverviewPanel — institutional trust UX convergence (W2-PR39A).
 *
 * Single operator-readable surface that collapses replay survivability,
 * longitudinal drift/fatigue, persistence integrity, active overrides,
 * and open incidents into one panel. Headline ≤ 7 indicators (cognitive
 * budget). Always renders ambiguity preservation explicitly.
 *
 * Pure render. No data fetches.
 */

import * as React from "react";
import {
  validateUxIntegrity,
  type UxSummary,
} from "@vitalcv/governance-runtime";

export interface TrustOverviewPanelProps {
  readonly summary: UxSummary;
}

const TIER_CLASS: Readonly<Record<string, string>> = {
  STABLE: "tov-tier tov-tier--stable",
  WATCH: "tov-tier tov-tier--watch",
  DEGRADED: "tov-tier tov-tier--degraded",
  "AT-RISK": "tov-tier tov-tier--at-risk",
  FAILING: "tov-tier tov-tier--failing",
};

export function TrustOverviewPanel({ summary }: TrustOverviewPanelProps): React.ReactElement {
  const cls = TIER_CLASS[summary.trustTrajectory] ?? "tov-tier tov-tier--watch";
  const isAlert =
    summary.trustTrajectory === "AT-RISK" || summary.trustTrajectory === "FAILING";
  const violations = validateUxIntegrity(summary);
  const hasUxBug = violations.length > 0;

  return (
    <section
      role={isAlert ? "alert" : "region"}
      aria-live={isAlert ? "polite" : undefined}
      aria-label="Institutional governance trust overview"
      className={`tov-panel ${cls}`}
      data-trajectory={summary.trustTrajectory}
    >
      <header className="tov-panel__header">
        <strong>TRUST TRAJECTORY — {summary.trustTrajectory}</strong>
        <span className="tov-panel__captured">captured at {summary.capturedAt}</span>
      </header>
      <ul className="tov-panel__headline">
        {summary.headlineIndicators.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
      <dl className="tov-panel__detail">
        <dt>Replay continuity</dt>
        <dd>
          {summary.replayConfidence}
          {summary.replayImpossibleJumps > 0
            ? ` · ⚠ ${summary.replayImpossibleJumps} impossible jump(s)`
            : ""}{" "}
          · ambiguity {summary.replayAmbiguityPreserved ? "preserved" : "⚠ ELIDED"}
        </dd>
        <dt>Governance fatigue</dt>
        <dd>{summary.fatigueSeverity} · {summary.driftFindingCount} drift finding(s)</dd>
        <dt>Persistence</dt>
        <dd>
          chain {summary.chainClean ? "clean" : "⚠ tamper finding(s)"} · snapshot{" "}
          {summary.snapshotPresent ? "present" : "⚠ MISSING"}
        </dd>
        <dt>Overrides</dt>
        <dd>
          {summary.activeOverrideCount} active
          {summary.criticalOverrideIds.length > 0
            ? ` · ⚠ critical: ${summary.criticalOverrideIds.join(", ")}`
            : ""}
        </dd>
        <dt>Incidents</dt>
        <dd>
          {summary.openIncidentTotal} open · {summary.openSev1Count} SEV-1 open
        </dd>
      </dl>
      {hasUxBug && (
        <section role="alert" aria-live="polite" className="tov-panel__ux-bug">
          <strong>⚠ UX integrity violations detected</strong>
          <ul>
            {violations.map((v, i) => (
              <li key={i}>{JSON.stringify(v)}</li>
            ))}
          </ul>
        </section>
      )}
      <footer className="tov-panel__footer">
        <small>
          INSTITUTIONAL TRUST OVERVIEW — top-line indicators are capped at
          7 to bound cognitive load. Ambiguity is rendered explicitly;
          replay continuity, drift, persistence, override, and incident
          state cannot be elided. Trajectory tier is derived from the
          worst signal observed (no averaging).
        </small>
      </footer>
    </section>
  );
}
