/**
 * W2-PR153A — Meta-Verification Coverage Audit.
 *
 * Verifies the meta-verification layer itself before institutional activation:
 *   - DOMAIN_COVERAGE covers all 11 GOVERNANCE_DOMAINS
 *   - All domains have at least one knownBlindSpot (so aggregate cannot be VERIFIED)
 *   - buildMetaVerificationReport aggregate is worst-wins (completeness inflation forbidden)
 *   - verifyInvariantInteractions returns [] (stub is documented and intentional)
 *   - No domain appears twice
 *   - Per-domain confidence derivation respects invariant/blindspot/assumption counts
 *
 * Doctrine: W2-PR27A rules 1–7, docs/ops/constitutional-enforcement-matrix.md
 */

import { describe, expect, it } from "vitest";

import {
  GOVERNANCE_DOMAINS,
  DOMAIN_COVERAGE,
  VERIFICATION_CONFIDENCE,
  buildMetaVerificationReport,
  verifyInvariantInteractions,
  type GovernanceDomain,
} from "../meta-verification.js";

// ─── 1. GOVERNANCE_DOMAINS completeness ──────────────────────────────────────

describe("W2-PR153A — GOVERNANCE_DOMAINS completeness", () => {
  it("contains exactly 11 domains", () => {
    expect(GOVERNANCE_DOMAINS).toHaveLength(11);
  });

  it("contains trust-class domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("trust-class");
  });

  it("contains integrity-state domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("integrity-state");
  });

  it("contains containment-state domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("containment-state");
  });

  it("contains replay-state domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("replay-state");
  });

  it("contains transition-graph domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("transition-graph");
  });

  it("contains cross-axis-coherence domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("cross-axis-coherence");
  });

  it("contains override-audit domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("override-audit");
  });

  it("contains lexicon-enforcement domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("lexicon-enforcement");
  });

  it("contains semantic-evolution domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("semantic-evolution");
  });

  it("contains fail-closed domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("fail-closed");
  });

  it("contains telemetry-absence domain", () => {
    expect(GOVERNANCE_DOMAINS).toContain("telemetry-absence");
  });
});

// ─── 2. DOMAIN_COVERAGE structural integrity ──────────────────────────────────

describe("W2-PR153A — DOMAIN_COVERAGE structural integrity", () => {
  it("DOMAIN_COVERAGE covers exactly 11 domains (one per GOVERNANCE_DOMAIN)", () => {
    expect(DOMAIN_COVERAGE).toHaveLength(11);
  });

  it("every GOVERNANCE_DOMAIN appears in DOMAIN_COVERAGE exactly once", () => {
    const covered = new Set(DOMAIN_COVERAGE.map((d) => d.domain));
    for (const domain of GOVERNANCE_DOMAINS) {
      expect(covered.has(domain), `${domain} missing from DOMAIN_COVERAGE`).toBe(true);
    }
    // No duplicates
    expect(covered.size).toBe(GOVERNANCE_DOMAINS.length);
  });

  it("no domain appears more than once in DOMAIN_COVERAGE", () => {
    const domains = DOMAIN_COVERAGE.map((d) => d.domain);
    const unique = new Set(domains);
    expect(unique.size).toBe(domains.length);
  });

  it("every domain has at least one invariant verified", () => {
    for (const c of DOMAIN_COVERAGE) {
      expect(
        c.invariantsVerified.length,
        `${c.domain} has no verified invariants — would be UNVERIFIED confidence`
      ).toBeGreaterThan(0);
    }
  });

  it("every domain has at least one knownBlindSpot (aggregate cannot be inflated to VERIFIED)", () => {
    for (const c of DOMAIN_COVERAGE) {
      expect(
        c.knownBlindSpots.length,
        `${c.domain} has no knownBlindSpots — completeness inflation risk`
      ).toBeGreaterThan(0);
    }
  });

  it("DOMAIN_COVERAGE is frozen (cannot be mutated at runtime)", () => {
    expect(Object.isFrozen(DOMAIN_COVERAGE)).toBe(true);
  });
});

// ─── 3. VERIFICATION_CONFIDENCE vocabulary ────────────────────────────────────

describe("W2-PR153A — VERIFICATION_CONFIDENCE vocabulary", () => {
  it("contains VERIFIED", () => {
    expect(VERIFICATION_CONFIDENCE).toContain("VERIFIED");
  });

  it("contains PARTIALLY-VERIFIED", () => {
    expect(VERIFICATION_CONFIDENCE).toContain("PARTIALLY-VERIFIED");
  });

  it("contains ASSUMED", () => {
    expect(VERIFICATION_CONFIDENCE).toContain("ASSUMED");
  });

  it("contains UNVERIFIED", () => {
    expect(VERIFICATION_CONFIDENCE).toContain("UNVERIFIED");
  });

  it("contains UNKNOWN", () => {
    expect(VERIFICATION_CONFIDENCE).toContain("UNKNOWN");
  });
});

// ─── 4. buildMetaVerificationReport — structure and aggregate logic ───────────

describe("W2-PR153A — buildMetaVerificationReport structure", () => {
  it("returns version 1", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.version).toBe(1);
  });

  it("executedAt is a non-empty ISO string", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("domainSummaries has 11 entries", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.domainSummaries).toHaveLength(11);
  });

  it("every GOVERNANCE_DOMAIN appears in domainSummaries", () => {
    const r = buildMetaVerificationReport(null);
    const summaryDomains = new Set(r.domainSummaries.map((s) => s.domain));
    for (const d of GOVERNANCE_DOMAINS) {
      expect(summaryDomains.has(d), `${d} missing from domainSummaries`).toBe(true);
    }
  });

  it("totalInvariants is the sum of all per-domain invariantCounts and > 0", () => {
    const r = buildMetaVerificationReport(null);
    const expected = r.domainSummaries.reduce((a, s) => a + s.invariantCount, 0);
    expect(r.totalInvariants).toBe(expected);
    expect(r.totalInvariants).toBeGreaterThan(0);
  });

  it("totalBlindSpots is the sum of all per-domain blindSpotCounts and > 0", () => {
    const r = buildMetaVerificationReport(null);
    const expected = r.domainSummaries.reduce((a, s) => a + s.blindSpotCount, 0);
    expect(r.totalBlindSpots).toBe(expected);
    expect(r.totalBlindSpots).toBeGreaterThan(0);
  });

  it("totalAssumptions is the sum of all per-domain assumptionCounts and > 0", () => {
    const r = buildMetaVerificationReport(null);
    const expected = r.domainSummaries.reduce((a, s) => a + s.assumptionCount, 0);
    expect(r.totalAssumptions).toBe(expected);
    expect(r.totalAssumptions).toBeGreaterThan(0);
  });

  it("verifiedDomains + partiallyVerifiedDomains + assumedDomains + unverifiedDomains = 11", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.verifiedDomains + r.partiallyVerifiedDomains + r.assumedDomains + r.unverifiedDomains).toBe(11);
  });

  it("passes null invariantsReport through as invariantsExecutedReport null", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.invariantsExecutedReport).toBeNull();
  });
});

// ─── 5. Aggregate confidence: worst-wins (completeness inflation forbidden) ───

describe("W2-PR153A — aggregate confidence worst-wins (W2-PR27A rule #6)", () => {
  it("aggregate is PARTIALLY-VERIFIED (all domains have blindSpots; cannot inflate to VERIFIED)", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.aggregateConfidence).toBe("PARTIALLY-VERIFIED");
  });

  it("aggregate is NOT VERIFIED", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.aggregateConfidence).not.toBe("VERIFIED");
  });

  it("aggregate is NOT UNVERIFIED (all domains have at least one invariant)", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.aggregateConfidence).not.toBe("UNVERIFIED");
  });

  it("partiallyVerifiedDomains > 0 (blindSpots make all domains PARTIALLY-VERIFIED)", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.partiallyVerifiedDomains).toBeGreaterThan(0);
  });

  it("unverifiedDomains is 0 (no domain has zero invariants)", () => {
    const r = buildMetaVerificationReport(null);
    expect(r.unverifiedDomains).toBe(0);
  });
});

// ─── 6. Per-domain confidence derivation ──────────────────────────────────────

describe("W2-PR153A — per-domain confidence derivation", () => {
  it("all per-domain summaries have confidence = PARTIALLY-VERIFIED (each domain has blind spots)", () => {
    const r = buildMetaVerificationReport(null);
    for (const s of r.domainSummaries) {
      expect(
        s.confidence,
        `${s.domain} should be PARTIALLY-VERIFIED (has blind spots)`
      ).toBe("PARTIALLY-VERIFIED");
    }
  });

  it("cross-axis-coherence summary has the correct domain label", () => {
    const r = buildMetaVerificationReport(null);
    const s = r.domainSummaries.find((x) => x.domain === "cross-axis-coherence");
    expect(s).toBeDefined();
    expect(s!.invariantCount).toBeGreaterThan(0);
    expect(s!.blindSpotCount).toBeGreaterThan(0);
  });

  it("fail-closed summary has at least one blind spot (JS loose-equality coercion is documented)", () => {
    const r = buildMetaVerificationReport(null);
    const s = r.domainSummaries.find((x) => x.domain === "fail-closed");
    expect(s).toBeDefined();
    expect(s!.blindSpotCount).toBeGreaterThan(0);
  });

  it("telemetry-absence summary has at least one assumption", () => {
    const r = buildMetaVerificationReport(null);
    const s = r.domainSummaries.find((x) => x.domain === "telemetry-absence");
    expect(s).toBeDefined();
    expect(s!.assumptionCount).toBeGreaterThan(0);
  });
});

// ─── 7. verifyInvariantInteractions — stub is intentional and documented ───────

describe("W2-PR153A — verifyInvariantInteractions stub semantics", () => {
  it("returns an empty array (no collisions in current compact registry)", () => {
    expect(verifyInvariantInteractions()).toEqual([]);
  });

  it("returns the same result on repeated calls (deterministic)", () => {
    expect(verifyInvariantInteractions()).toEqual(verifyInvariantInteractions());
  });

  it("result is readonly array-compatible (no push)", () => {
    const result = verifyInvariantInteractions();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ─── 8. Cross-domain blind-spot observability ─────────────────────────────────

describe("W2-PR153A — blind spots are operationally visible (W2-PR27A rule #3)", () => {
  it("replay-state domain explicitly documents R-ACCEPTED forensic limitation", () => {
    const cov = DOMAIN_COVERAGE.find((d) => d.domain === "replay-state");
    expect(cov).toBeDefined();
    const hasAccepted = cov!.knownBlindSpots.some((s) => s.toLowerCase().includes("r-accepted") || s.toLowerCase().includes("accepted"));
    expect(hasAccepted).toBe(true);
  });

  it("cross-axis-coherence domain explicitly documents only 4 rules encoded", () => {
    const cov = DOMAIN_COVERAGE.find((d) => d.domain === "cross-axis-coherence");
    expect(cov).toBeDefined();
    const hasRuleCount = cov!.knownBlindSpots.some((s) => s.toLowerCase().includes("4") || s.toLowerCase().includes("four") || s.toLowerCase().includes("only"));
    expect(hasRuleCount).toBe(true);
  });

  it("every domain assumption is a non-empty string", () => {
    for (const cov of DOMAIN_COVERAGE) {
      for (const assumption of cov.assumptionsRequired) {
        expect(assumption.length).toBeGreaterThan(0);
      }
    }
  });

  it("every blind spot is a non-empty string", () => {
    for (const cov of DOMAIN_COVERAGE) {
      for (const blind of cov.knownBlindSpots) {
        expect(blind.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── 9. Report reproducibility ────────────────────────────────────────────────

describe("W2-PR153A — buildMetaVerificationReport reproducibility", () => {
  it("two successive calls produce the same totalInvariants", () => {
    const r1 = buildMetaVerificationReport(null);
    const r2 = buildMetaVerificationReport(null);
    expect(r1.totalInvariants).toBe(r2.totalInvariants);
  });

  it("two successive calls produce the same aggregateConfidence", () => {
    const r1 = buildMetaVerificationReport(null);
    const r2 = buildMetaVerificationReport(null);
    expect(r1.aggregateConfidence).toBe(r2.aggregateConfidence);
  });

  it("two successive calls produce the same number of domainSummaries", () => {
    const r1 = buildMetaVerificationReport(null);
    const r2 = buildMetaVerificationReport(null);
    expect(r1.domainSummaries.length).toBe(r2.domainSummaries.length);
  });
});
