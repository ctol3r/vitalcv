/**
 * InstitutionalMemoryPanel — memory-aware governance UX (W2-PR30A target 5).
 *
 * Renders the longitudinal-memory drift report:
 *   - fatigue severity + score + contributors
 *   - drift trajectory findings (sorted by severity desc)
 *   - chronically unstable domains
 *   - historical trust modifiers (recovery / override / verification)
 *   - forward instability score
 *
 * Normalization-resistant: chronic instability is rendered as a persistent
 * historical record. Findings cannot be collapsed to a single chip — each
 * trajectory tag surfaces with its severity, window, and explanation.
 *
 * Pure render. No data fetches.
 */

import * as React from "react";
import type { InstitutionalDriftReport } from "@vitalcv/governance-runtime";

export interface InstitutionalMemoryPanelProps {
  readonly report: InstitutionalDriftReport;
  readonly compact?: boolean;
}

const FATIGUE_TONE: Readonly<Record<string, string>> = {
  CALM: "im-fatigue im-fatigue--calm",
  ELEVATED: "im-fatigue im-fatigue--elevated",
  CHRONIC: "im-fatigue im-fatigue--chronic",
  CRITICAL: "im-fatigue im-fatigue--critical",
};

export function InstitutionalMemoryPanel({
  report,
  compact = false,
}: InstitutionalMemoryPanelProps): React.ReactElement {
  const tone = FATIGUE_TONE[report.fatigue.severity] ?? "im-fatigue im-fatigue--calm";
  const isAlert = report.hasCiFailure || report.fatigue.severity === "CRITICAL";

  if (compact) {
    return (
      <span
        role={isAlert ? "alert" : undefined}
        aria-live={isAlert ? "polite" : undefined}
        className={`im-panel-compact ${tone}`}
        data-fatigue={report.fatigue.severity}
        data-finding-count={report.driftFindings.length}
      >
        ⏳ FATIGUE {report.fatigue.severity} · {report.driftFindings.length} drift finding(s) ·
        forward instability {report.historicalTrustModifier.forwardInstabilityScore.toFixed(0)}
      </span>
    );
  }

  const sortedFindings = [...report.driftFindings].sort((a, b) => b.severity - a.severity);

  return (
    <section
      role={isAlert ? "alert" : "region"}
      aria-live={isAlert ? "polite" : undefined}
      aria-label="Institutional governance memory"
      className={`im-panel ${tone}`}
      data-fatigue={report.fatigue.severity}
      data-epochs={report.epochsObserved}
    >
      <header className="im-panel__header">
        <strong>INSTITUTIONAL GOVERNANCE MEMORY</strong>
        <span className="im-panel__epochs">
          {report.epochsObserved} epoch(s) · window {report.windowEpochs}
        </span>
      </header>

      <section className="im-panel__fatigue">
        <h3>Fatigue: {report.fatigue.severity} ({report.fatigue.score.toFixed(0)}/100)</h3>
        <ul className="im-panel__contributors">
          <li>override repetition: {report.fatigue.contributors.overrideRepetition.toFixed(1)}</li>
          <li>exception growth: {report.fatigue.contributors.exceptionGrowth.toFixed(1)}</li>
          <li>recurring suppression: {report.fatigue.contributors.recurringSuppression.toFixed(1)}</li>
          <li>degraded-state recurrence: {report.fatigue.contributors.degradedStateRecurrence.toFixed(1)}</li>
          <li>unresolved ambiguity age: {report.fatigue.contributors.unresolvedAmbiguityAge.toFixed(1)}</li>
        </ul>
        {report.fatigue.chronicallyUnstableDomains.length > 0 && (
          <p className="im-panel__chronic">
            Chronically unstable domain(s):{" "}
            {report.fatigue.chronicallyUnstableDomains.join(", ")}
          </p>
        )}
      </section>

      <section className="im-panel__drift">
        <h3>Drift trajectory findings ({report.driftFindings.length})</h3>
        {sortedFindings.length === 0 ? (
          <p>No drift detected in current window.</p>
        ) : (
          <ul>
            {sortedFindings.map((f) => (
              <li key={f.tag} data-severity={f.severity.toFixed(0)}>
                <strong>[{f.severity.toFixed(0)}] {f.tag}</strong> — {f.description}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="im-panel__trust-modifier">
        <h3>Historical trust modifier</h3>
        <dl>
          <dt>Recovery confidence multiplier</dt>
          <dd>{report.historicalTrustModifier.recoveryConfidenceMultiplier.toFixed(2)}×</dd>
          <dt>Override trust multiplier</dt>
          <dd>{report.historicalTrustModifier.overrideTrustMultiplier.toFixed(2)}×</dd>
          <dt>Verification confidence penalty</dt>
          <dd>−{report.historicalTrustModifier.verificationConfidencePenalty.toFixed(0)}</dd>
          <dt>Forward instability score</dt>
          <dd>{report.historicalTrustModifier.forwardInstabilityScore.toFixed(0)}/100</dd>
        </dl>
        <ul className="im-panel__reasons">
          {report.historicalTrustModifier.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      <footer className="im-panel__footer">
        <small>
          INSTITUTIONAL MEMORY NOTICE — governance memory is append-only;
          chronic instability propagates forward; replay fragility history
          may not be erased; isolated-event-only reasoning is forbidden.
        </small>
      </footer>
    </section>
  );
}
