/**
 * LedgerIntegrityBanner — tamper-aware governance UX (W2-PR32A target 5).
 *
 * Renders the persistence-integrity report:
 *   - chain integrity (clean / N findings)
 *   - replay verification state
 *   - ledger length + head-hash prefix
 *   - snapshot status (present / missing / divergent)
 *
 * Wording follows TRUST_GUARANTEE_LEXICON.md: tamper-evident given DB
 * integrity; hash-checked. This is an audit-traceable surface, not a
 * cryptographic substrate guarantee.
 *
 * Pure render. No data fetches.
 */

import * as React from "react";
import type {
  PersistenceIntegrityReport,
  TamperFinding,
} from "@vitalcv/governance-runtime";

export interface LedgerIntegrityBannerProps {
  readonly report: PersistenceIntegrityReport;
  readonly compact?: boolean;
}

function summarizeFinding(f: TamperFinding): string {
  switch (f.tag) {
    case "broken-genesis":
      return `genesis link broken at idx ${f.sequenceIndex}: expected ${f.expectedPrevious}, got ${f.actualPrevious.slice(0, 12)}…`;
    case "broken-chain":
      return `chain break at idx ${f.sequenceIndex}: previous-hash mismatch`;
    case "epoch-hash-mismatch":
      return `payload mutation at idx ${f.sequenceIndex}: stored ${f.recordedHash.slice(0, 12)}… ≠ recomputed ${f.recomputedHash.slice(0, 12)}…`;
    case "out-of-order-timestamps":
      return `out-of-order timestamps at idx ${f.sequenceIndex}: ${f.observedAt} < ${f.previousObservedAt}`;
    case "duplicate-sequence-index":
      return `duplicate sequenceIndex ${f.sequenceIndex}`;
    case "missing-sequence-index":
      return `sequenceIndex gap: expected ${f.expected}, got ${f.actual}`;
    case "snapshot-divergence":
      return `snapshot divergence on '${f.field}': expected ${f.expected.slice(0, 12)}… got ${f.actual.slice(0, 12)}…`;
  }
}

export function LedgerIntegrityBanner({
  report,
  compact = false,
}: LedgerIntegrityBannerProps): React.ReactElement {
  const chainClean = report.chainFindings.length === 0;
  const replayClean =
    report.replayResult === null ? null : !report.replayResult.hasTamperEvidence;
  const isAlert = report.hasCiGatingCondition;

  const stateLabel = (() => {
    if (chainClean && (replayClean === null || replayClean)) {
      return report.hasSnapshot ? "TAMPER-EVIDENT — clean" : "TAMPER-EVIDENT — no snapshot";
    }
    return "TAMPER DETECTED";
  })();

  const tone = chainClean && replayClean !== false ? "li-clean" : "li-tampered";

  if (compact) {
    return (
      <span
        role={isAlert ? "alert" : undefined}
        aria-live={isAlert ? "polite" : undefined}
        className={`li-banner-compact ${tone}`}
        data-state={stateLabel}
        data-ledger-length={report.ledgerLength}
      >
        🔗 {stateLabel} · {report.ledgerLength} epoch(s)
        {!chainClean ? ` · ${report.chainFindings.length} chain finding(s)` : ""}
        {replayClean === false ? " · replay non-deterministic" : ""}
      </span>
    );
  }

  const headHash =
    report.replayResult && report.ledgerLength > 0
      ? "(see ledger head)"
      : "—";

  return (
    <section
      role={isAlert ? "alert" : "region"}
      aria-live={isAlert ? "polite" : undefined}
      aria-label="Governance ledger integrity"
      className={`li-banner ${tone}`}
      data-state={stateLabel}
    >
      <header className="li-banner__header">
        <strong>LEDGER INTEGRITY — {stateLabel}</strong>
      </header>
      <dl className="li-banner__body">
        <dt>Ledger length</dt>
        <dd>{report.ledgerLength} epoch(s)</dd>
        <dt>Snapshot present</dt>
        <dd>{report.hasSnapshot ? "yes" : "no — non-empty ledgers REQUIRE a snapshot"}</dd>
        <dt>Chain integrity</dt>
        <dd>{chainClean ? "clean" : `${report.chainFindings.length} finding(s)`}</dd>
        <dt>Replay verification</dt>
        <dd>
          {replayClean === null
            ? "not run (no snapshot)"
            : replayClean
              ? "deterministic — drift report reconstructs identically"
              : "NON-DETERMINISTIC — drift report does not reconstruct"}
        </dd>
        <dt>Head hash</dt>
        <dd>{headHash}</dd>
      </dl>
      {(report.chainFindings.length > 0 ||
        (report.replayResult && report.replayResult.snapshotFindings.length > 0)) && (
        <section className="li-banner__findings">
          <h3>Tamper findings</h3>
          <ul>
            {report.chainFindings.map((f, i) => (
              <li key={`c-${i}`}>{summarizeFinding(f)}</li>
            ))}
            {report.replayResult?.snapshotFindings.map((f, i) => (
              <li key={`s-${i}`}>{summarizeFinding(f)}</li>
            ))}
          </ul>
        </section>
      )}
      <footer className="li-banner__footer">
        <small>
          LEDGER INTEGRITY NOTICE — governance history is hash-linked and
          tamper-evident given DB integrity. Mutation, deletion, or
          reordering of epochs surfaces here as a finding. This surface is
          audit-traceable; it does not claim a cryptographic substrate
          guarantee — anyone with substrate write access can rewrite
          history; the value is that downstream verification surfaces the
          rewrite.
        </small>
      </footer>
    </section>
  );
}
