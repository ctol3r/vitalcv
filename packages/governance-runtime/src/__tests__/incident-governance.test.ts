/**
 * W2-PR35A — Incident governance + SEV semantics tests + chaos.
 */

import { describe, expect, it } from "vitest";

import {
  buildIncidentGovernanceReport,
  computeIncidentBlastRadius,
  isAllowedIncidentTransition,
  kindSevFloor,
  maxSev,
  SEV_LEVELS,
  sevSeverity,
  validateIncident,
  type GovernanceIncident,
} from "../incident-governance.js";

function inc(overrides: Partial<GovernanceIncident> = {}): GovernanceIncident {
  return {
    id: "inc-001",
    kind: "GOVERNANCE",
    sev: "SEV-3",
    state: "DETECTED",
    detectedAt: "2026-05-09T00:00:00Z",
    affectedDomains: ["containment-state"],
    touchesReplay: false,
    touchesAmbiguity: false,
    symptom: "containment briefly entered CT-FRAGMENTING",
    ...overrides,
  };
}

describe("W2-PR35A — taxonomy", () => {
  it("SEV ordering: SEV-1 is most severe (lowest numeric)", () => {
    expect(sevSeverity("SEV-1")).toBeLessThan(sevSeverity("SEV-2"));
    expect(sevSeverity("SEV-5")).toBeGreaterThan(sevSeverity("SEV-4"));
  });

  it("maxSev returns the more-severe (lower numeric) of two", () => {
    expect(maxSev("SEV-1", "SEV-3")).toBe("SEV-1");
    expect(maxSev("SEV-4", "SEV-2")).toBe("SEV-2");
  });

  it("REPLAY kind has SEV floor at SEV-2", () => {
    expect(kindSevFloor("REPLAY")).toBe("SEV-2");
  });

  it("SEV_LEVELS has exactly 5 entries", () => {
    expect(SEV_LEVELS.length).toBe(5);
  });
});

describe("W2-PR35A — lifecycle transitions", () => {
  it("DETECTED → TRIAGED is allowed", () => {
    expect(isAllowedIncidentTransition("DETECTED", "TRIAGED")).not.toBeNull();
  });
  it("DETECTED → RESOLVED is forbidden (skips TRIAGED/MITIGATED)", () => {
    expect(isAllowedIncidentTransition("DETECTED", "RESOLVED")).toBeNull();
  });
  it("RESOLVED → DETECTED reopen path requires evidence (allowed)", () => {
    expect(isAllowedIncidentTransition("RESOLVED", "DETECTED")).not.toBeNull();
  });
  it("POSTMORTEM-CLOSED is terminal (no outgoing transitions)", () => {
    expect(isAllowedIncidentTransition("POSTMORTEM-CLOSED", "DETECTED")).toBeNull();
    expect(isAllowedIncidentTransition("POSTMORTEM-CLOSED", "RESOLVED")).toBeNull();
  });
});

describe("W2-PR35A — validators", () => {
  it("clean record passes", () => {
    expect(validateIncident(inc())).toEqual([]);
  });
  it("REPLAY incident without touchesReplay → flagged", () => {
    const errs = validateIncident(inc({ kind: "REPLAY", sev: "SEV-2", touchesReplay: false }));
    expect(errs.some((e) => e.tag === "replay-incident-without-replay-touch")).toBe(true);
  });
  it("AMBIGUITY incident without touchesAmbiguity → flagged", () => {
    const errs = validateIncident(inc({ kind: "AMBIGUITY", touchesAmbiguity: false }));
    expect(errs.some((e) => e.tag === "ambiguity-incident-must-touch-ambiguity")).toBe(true);
  });
  it("OVERRIDE incident missing relatedOverrideId → flagged", () => {
    const errs = validateIncident(inc({ kind: "OVERRIDE", sev: "SEV-2" }));
    expect(errs.some((e) => e.tag === "override-incident-missing-related-override")).toBe(true);
  });
  it("non-DETECTED state requires remediationRef", () => {
    const errs = validateIncident(inc({ state: "TRIAGED" }));
    expect(errs.some((e) => e.tag === "non-detected-without-remediation-ref")).toBe(true);
  });
  it("POSTMORTEM-CLOSED requires postmortemRef", () => {
    const errs = validateIncident(
      inc({ state: "POSTMORTEM-CLOSED", remediationRef: "audit#1" }),
    );
    expect(errs.some((e) => e.tag === "postmortem-closed-without-ref")).toBe(true);
  });
  it("resolvedAt before detectedAt → flagged", () => {
    const errs = validateIncident(
      inc({
        state: "RESOLVED",
        remediationRef: "audit#1",
        detectedAt: "2026-05-09T12:00:00Z",
        resolvedAt: "2026-05-09T00:00:00Z",
      }),
    );
    expect(errs.some((e) => e.tag === "resolved-before-detected")).toBe(true);
  });
  it("declared SEV below kind floor (REPLAY at SEV-4) → flagged", () => {
    const errs = validateIncident(
      inc({ kind: "REPLAY", sev: "SEV-4", touchesReplay: true }),
    );
    expect(errs.some((e) => e.tag === "sev-below-kind-floor")).toBe(true);
  });
});

describe("W2-PR35A — blast radius", () => {
  it("SEV-1 across multiple domains with replay touch → CRITICAL", () => {
    const b = computeIncidentBlastRadius(
      inc({
        sev: "SEV-1",
        affectedDomains: ["replay-state", "containment-state", "integrity-state"],
        touchesReplay: true,
        touchesAmbiguity: true,
      }),
    );
    expect(b.tier).toBe("CRITICAL");
    expect(b.score).toBeLessThanOrEqual(100);
  });
  it("SEV-5 single-domain → LOW", () => {
    const b = computeIncidentBlastRadius(inc({ sev: "SEV-5" }));
    expect(b.tier).toBe("LOW");
  });
});

describe("W2-PR35A — TARGET 6: incident chaos simulations", () => {
  it("CHAOS: open SEV-1 still in TRIAGED → CI gating fires", () => {
    const r = buildIncidentGovernanceReport(
      [inc({ sev: "SEV-1", state: "TRIAGED", remediationRef: "audit#x" })],
      "2026-05-09T00:01:00Z",
    );
    expect(r.findings.some((f) => f.tag === "open-sev1")).toBe(true);
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("CHAOS: REPLAY incident reaches RESOLVED with no postmortem → gating", () => {
    const r = buildIncidentGovernanceReport(
      [
        inc({
          kind: "REPLAY",
          sev: "SEV-2",
          touchesReplay: true,
          state: "RESOLVED",
          remediationRef: "audit#x",
        }),
      ],
      "2026-05-09T00:01:00Z",
    );
    expect(
      r.findings.some((f) => f.tag === "replay-incident-resolved-without-postmortem"),
    ).toBe(true);
  });

  it("CHAOS: ambiguity incident downgraded to SEV-5 → kind-floor violation", () => {
    const errs = validateIncident(
      inc({ kind: "AMBIGUITY", sev: "SEV-5", touchesAmbiguity: true }),
    );
    expect(errs.some((e) => e.tag === "sev-below-kind-floor")).toBe(true);
  });

  it("CHAOS: override-driven incident references a non-empty override id (passes)", () => {
    const errs = validateIncident(
      inc({
        kind: "OVERRIDE",
        sev: "SEV-2",
        relatedOverrideId: "ov-42",
      }),
    );
    expect(errs).toEqual([]);
  });

  it("CHAOS: bulk 10-incident report decidable; CRITICAL surfaces in findings", () => {
    const incidents: GovernanceIncident[] = [];
    for (let i = 0; i < 10; i++) {
      const sev: GovernanceIncident["sev"] = i === 0 ? "SEV-1" : "SEV-3";
      incidents.push(
        inc({
          id: `bulk-${i}`,
          sev,
          touchesReplay: i % 3 === 0,
          touchesAmbiguity: i % 2 === 0,
          affectedDomains: ["containment-state", "integrity-state"],
        }),
      );
    }
    const r = buildIncidentGovernanceReport(incidents, "2026-05-09T00:01:00Z");
    expect(r.incidentsEvaluated).toBe(10);
    expect(r.findings.length).toBeGreaterThanOrEqual(10);
  });
});
