/**
 * ReplaySurvivabilityPanel — replay reconstruction UX (W2-PR33A target 5).
 *
 * Renders survivability score, confidence tier, observation graph
 * fragments, and reconstruction lineage. Wording: replay observability +
 * best-effort idempotency check via correlationId — no replay-protection
 * claim.
 */

import * as React from "react";
import type {
  ReplaySurvivabilityReport,
} from "@vitalcv/governance-runtime";

export interface ReplaySurvivabilityPanelProps {
  readonly report: ReplaySurvivabilityReport;
  readonly compact?: boolean;
}

const CONF_CLASS: Readonly<Record<string, string>> = {
  FULL: "rs-conf rs-conf--full",
  HIGH: "rs-conf rs-conf--high",
  PARTIAL: "rs-conf rs-conf--partial",
  LOW: "rs-conf rs-conf--low",
  UNRECONSTRUCTABLE: "rs-conf rs-conf--unreconstructable",
};

export function ReplaySurvivabilityPanel({
  report,
  compact = false,
}: ReplaySurvivabilityPanelProps): React.ReactElement {
  const cls = CONF_CLASS[report.score.confidence] ?? "rs-conf rs-conf--low";
  const isAlert =
    report.hasCiGatingCondition || report.score.confidence === "UNRECONSTRUCTABLE";

  if (compact) {
    return (
      <span
        role={isAlert ? "alert" : undefined}
        aria-live={isAlert ? "polite" : undefined}
        className={`rs-panel-compact ${cls}`}
        data-confidence={report.score.confidence}
      >
        🔁 REPLAY {report.score.confidence} · score {report.score.survivabilityScore} ·
        {report.score.evidenceBearingEpochs}/{report.score.windowEpochs} observed
        {report.score.impossibleJumps > 0 ? ` · ${report.score.impossibleJumps} impossible jump(s)` : ""}
      </span>
    );
  }

  return (
    <section
      role={isAlert ? "alert" : "region"}
      aria-live={isAlert ? "polite" : undefined}
      aria-label="Replay continuity reconstruction"
      className={`rs-panel ${cls}`}
      data-confidence={report.score.confidence}
    >
      <header className="rs-panel__header">
        <strong>REPLAY CONTINUITY — {report.score.confidence}</strong>
        <span className="rs-panel__score">score {report.score.survivabilityScore}/100</span>
      </header>
      <dl className="rs-panel__body">
        <dt>Window epochs</dt>
        <dd>{report.score.windowEpochs}</dd>
        <dt>Evidence-bearing</dt>
        <dd>{report.score.evidenceBearingEpochs}</dd>
        <dt>Contiguous edges</dt>
        <dd>{report.score.contiguousEdges}</dd>
        <dt>Bridged edges (gaps spanned)</dt>
        <dd>{report.score.bridgedEdges}</dd>
        <dt>Gapped edges (evidence missing)</dt>
        <dd>{report.score.gappedEdges}</dd>
        <dt>Impossible jumps</dt>
        <dd>
          {report.score.impossibleJumps === 0
            ? "0"
            : `⚠ ${report.score.impossibleJumps} (forbidden state transition without evidence)`}
        </dd>
        <dt>Ambiguity preserved</dt>
        <dd>{report.score.ambiguityPreserved ? "yes" : "⚠ NO — silent up-resolution suspected"}</dd>
        <dt>Contributing epoch indices</dt>
        <dd>
          {report.lineage.contributingEpochIndices.length === 0
            ? "(none)"
            : report.lineage.contributingEpochIndices.join(", ")}
        </dd>
        <dt>Gap epoch indices</dt>
        <dd>
          {report.lineage.gapEpochIndices.length === 0
            ? "(none)"
            : report.lineage.gapEpochIndices.join(", ")}
        </dd>
      </dl>
      {report.findings.length > 0 && (
        <section className="rs-panel__findings">
          <h3>Findings</h3>
          <ul>
            {report.findings.map((f, i) => (
              <li key={i}>{JSON.stringify(f)}</li>
            ))}
          </ul>
        </section>
      )}
      <footer className="rs-panel__footer">
        <small>
          REPLAY CONTINUITY NOTICE — replay observability + best-effort
          idempotency check via correlationId. Reconstruction confidence
          is evidence-derived; ambiguity is preserved at every step.
        </small>
      </footer>
    </section>
  );
}
