/**
 * OverrideBanner — emergency-governance UX primitive (W2-PR29A target 5).
 *
 * Renders a single human override with:
 *   - kind + risk badge
 *   - blast-radius severity tier + score
 *   - decay state + remaining-time countdown
 *   - replay implications (always visible — never hidden)
 *   - cross-domain reach
 *
 * Normalization-resistant: a CRITICAL or EXPIRED override is rendered with
 * persistent role="alert" framing; reach > 1 forces multi-domain rendering
 * rather than collapsing to a single chip.
 *
 * Pure render. No data fetches.
 */

import * as React from "react";
import {
  computeOverrideBlastRadius,
  computeOverrideDecay,
  type HumanOverrideRecord,
  type OverrideDecayResult,
  type OverrideBlastRadius,
} from "@vitalcv/governance-runtime";

export interface OverrideBannerProps {
  readonly record: HumanOverrideRecord;
  /** ISO-8601 UTC; pass server-rendered `now` for stable SSR. */
  readonly nowIso: string;
  readonly compact?: boolean;
}

const TIER_CLASSNAMES: Readonly<Record<string, string>> = {
  LOW: "ov-tier ov-tier--low",
  MEDIUM: "ov-tier ov-tier--medium",
  HIGH: "ov-tier ov-tier--high",
  CRITICAL: "ov-tier ov-tier--critical",
};

const DECAY_LABEL: Readonly<Record<string, string>> = {
  FRESH: "FRESH",
  DECAYING: "DECAYING",
  STALE: "STALE — reassess",
  EXPIRED: "EXPIRED — close out",
  "OVER-RENEWED": "OVER-RENEWED — forbidden",
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h left`;
}

export function OverrideBanner({
  record,
  nowIso,
  compact = false,
}: OverrideBannerProps): React.ReactElement {
  const blast: OverrideBlastRadius = computeOverrideBlastRadius(record);
  const decay: OverrideDecayResult = computeOverrideDecay(record, nowIso);

  const isAlert = blast.severityTier === "CRITICAL" || decay.requiresReassessment;
  const tierClass = TIER_CLASSNAMES[blast.severityTier] ?? "ov-tier ov-tier--low";

  if (compact) {
    return (
      <span
        role={isAlert ? "alert" : undefined}
        aria-live={isAlert ? "polite" : undefined}
        className={`ov-banner-compact ${tierClass}`}
        data-override-id={record.id}
        data-decay-state={decay.state}
        data-blast-tier={blast.severityTier}
      >
        ⚠ {record.kind} · {blast.severityTier} · {DECAY_LABEL[decay.state] ?? decay.state} · {formatRemaining(decay.remainingMs)}
        {record.touchesReplay ? " · REPLAY" : ""}
      </span>
    );
  }

  return (
    <section
      role={isAlert ? "alert" : "region"}
      aria-live={isAlert ? "polite" : undefined}
      aria-label={`Active human override ${record.id}`}
      className={`ov-banner ${tierClass}`}
      data-override-id={record.id}
      data-decay-state={decay.state}
      data-blast-tier={blast.severityTier}
    >
      <header className="ov-banner__header">
        <strong>HUMAN OVERRIDE — {record.kind}</strong>
        <span className="ov-banner__risk">risk: {record.risk}</span>
        <span className="ov-banner__tier">blast: {blast.severityTier} ({blast.downstreamRiskScore})</span>
      </header>
      <dl className="ov-banner__body">
        <dt>Initiator</dt>
        <dd>{record.initiatingActor}</dd>
        <dt>Decay</dt>
        <dd>
          {DECAY_LABEL[decay.state] ?? decay.state} ·{" "}
          strength {(decay.strength * 100).toFixed(0)}% ·{" "}
          {formatRemaining(decay.remainingMs)}
        </dd>
        <dt>Cross-domain reach</dt>
        <dd>{blast.crossDomainReach} domain(s): {blast.affectedDomains.join(", ")}</dd>
        <dt>Impacted invariants</dt>
        <dd>{record.impactedInvariants.length === 0 ? "(none declared)" : record.impactedInvariants.join(", ")}</dd>
        <dt>Replay implications</dt>
        <dd>{record.touchesReplay ? "⚠ REPLAY AXIS TOUCHED — forbidden" : "none"}</dd>
        <dt>Ambiguity implications</dt>
        <dd>{blast.hasAmbiguityImplications ? "⚠ scope mentions ambiguity surfaces" : "none"}</dd>
        <dt>Renewals</dt>
        <dd>{record.renewalCount}</dd>
        <dt>Scope</dt>
        <dd>{record.scope}</dd>
      </dl>
      <footer className="ov-banner__footer">
        <small>
          OVERRIDE GOVERNANCE NOTICE — overrides decay automatically; renewals
          reduce trust; replay markers may not be erased; manual trust
          elevation is forbidden. Approval ts: {record.approvalTimestamp} · Expires:{" "}
          {record.expirationTimestamp}.
        </small>
      </footer>
    </section>
  );
}
