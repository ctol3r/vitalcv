/**
 * IncidentBanner — governance incident UX (W2-PR35A target).
 *
 * Renders SEV, lifecycle state, blast tier, replay/ambiguity touch
 * indicators, and remediation/postmortem refs. role="alert" for SEV-1
 * not yet RESOLVED.
 */

import * as React from "react";
import {
  computeIncidentBlastRadius,
  type GovernanceIncident,
} from "@vitalcv/governance-runtime";

export interface IncidentBannerProps {
  readonly incident: GovernanceIncident;
  readonly compact?: boolean;
}

const SEV_CLASS: Readonly<Record<string, string>> = {
  "SEV-1": "ig-sev ig-sev--1",
  "SEV-2": "ig-sev ig-sev--2",
  "SEV-3": "ig-sev ig-sev--3",
  "SEV-4": "ig-sev ig-sev--4",
  "SEV-5": "ig-sev ig-sev--5",
};

export function IncidentBanner({
  incident,
  compact = false,
}: IncidentBannerProps): React.ReactElement {
  const blast = computeIncidentBlastRadius(incident);
  const isAlert =
    (incident.sev === "SEV-1" && incident.state !== "POSTMORTEM-CLOSED" && incident.state !== "POSTMORTEM-OPEN") ||
    blast.tier === "CRITICAL";
  const cls = SEV_CLASS[incident.sev] ?? "ig-sev ig-sev--3";

  if (compact) {
    return (
      <span
        role={isAlert ? "alert" : undefined}
        aria-live={isAlert ? "polite" : undefined}
        className={`ig-banner-compact ${cls}`}
        data-incident-id={incident.id}
        data-state={incident.state}
        data-blast-tier={blast.tier}
      >
        🚨 {incident.sev} · {incident.kind} · {incident.state} · blast {blast.tier}
        {incident.touchesReplay ? " · REPLAY" : ""}
        {incident.touchesAmbiguity ? " · AMBIG" : ""}
      </span>
    );
  }

  return (
    <section
      role={isAlert ? "alert" : "region"}
      aria-live={isAlert ? "polite" : undefined}
      aria-label={`Incident ${incident.id}`}
      className={`ig-banner ${cls}`}
    >
      <header>
        <strong>INCIDENT {incident.id} — {incident.sev} · {incident.kind}</strong>
        <span>state: {incident.state}</span>
        <span>blast: {blast.tier} ({blast.score})</span>
      </header>
      <dl>
        <dt>Detected</dt><dd>{incident.detectedAt}</dd>
        <dt>Resolved</dt><dd>{incident.resolvedAt ?? "(open)"}</dd>
        <dt>Affected domains</dt><dd>{incident.affectedDomains.join(", ")}</dd>
        <dt>Replay touch</dt><dd>{incident.touchesReplay ? "yes" : "no"}</dd>
        <dt>Ambiguity touch</dt><dd>{incident.touchesAmbiguity ? "yes" : "no"}</dd>
        <dt>Related override</dt><dd>{incident.relatedOverrideId ?? "(none)"}</dd>
        <dt>Symptom</dt><dd>{incident.symptom}</dd>
        <dt>Remediation</dt><dd>{incident.remediationRef ?? "(none yet)"}</dd>
        <dt>Postmortem</dt><dd>{incident.postmortemRef ?? "(none yet)"}</dd>
      </dl>
      <footer>
        <small>
          INCIDENT GOVERNANCE NOTICE — incidents are audit-traceable
          governance events. SEV-1 must reach POSTMORTEM-CLOSED;
          REPLAY incidents require postmortem trail; ambiguity
          escalation remains visible.
        </small>
      </footer>
    </section>
  );
}
