import { describe, expect, it } from "vitest";
import type { GovernanceEpoch } from "../longitudinal-memory.js";
import {
  ARCHIVAL_SCHEMA_VERSION,
  buildArchivalEnvelope,
  type ArchivedEpochEnvelope,
} from "../evidence-durability.js";
import {
  buildEvidenceCompressionReport,
  buildEvidenceSummary,
  COMPRESSION_CONFIDENCE,
  verifyEvidenceSummary,
  type EvidenceSummary,
} from "../evidence-compression.js";

function epoch(o: Partial<GovernanceEpoch> = {}): GovernanceEpoch {
  return {
    observedAt: "2026-05-09T00:00:00Z",
    activeOverrideCount: 0,
    expiredOverrideCount: 0,
    overRenewedOverrideCount: 0,
    replayAmbiguousCount: 0,
    replayCollapsedCount: 0,
    integrityDegradedCount: 0,
    containmentDegradedCount: 0,
    recoveryAttemptCount: 0,
    recoveryFailureCount: 0,
    contradictionCount: 0,
    aggregateVerificationConfidence: "VERIFIED",
    degradedDomainTallies: {},
    ...o,
  };
}

function envelopeFor(e: GovernanceEpoch): ArchivedEpochEnvelope {
  return buildArchivalEnvelope({
    archivedAt: e.observedAt,
    originalPayload: e as unknown as Readonly<Record<string, unknown>>,
    originalSchemaVersion: ARCHIVAL_SCHEMA_VERSION,
    currentPayload: e,
    migrationLineage: [],
  });
}

describe("W2-PR69A — taxonomy", () => {
  it("COMPRESSION_CONFIDENCE has 5 tiers", () => {
    expect(COMPRESSION_CONFIDENCE.length).toBe(5);
    expect(COMPRESSION_CONFIDENCE).toContain("UNRECONSTRUCTABLE");
  });
});

describe("W2-PR69A — summary build is deterministic + ambiguity-preserving", () => {
  it("identical input ⇒ identical summary hash", () => {
    const envs = [envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", replayAmbiguousCount: 3 }))];
    const a = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T01:00:00Z", windowEpochs: 1, envelopes: envs });
    const b = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T01:00:00Z", windowEpochs: 1, envelopes: envs });
    expect(a.summaryCanonicalHash).toBe(b.summaryCanonicalHash);
  });

  it("ambiguity counters are summed (never zeroed)", () => {
    const envs = [
      envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", replayAmbiguousCount: 3 })),
      envelopeFor(epoch({ observedAt: "2026-05-09T01:00:00Z", replayAmbiguousCount: 5 })),
      envelopeFor(epoch({ observedAt: "2026-05-09T02:00:00Z", replayCollapsedCount: 2, contradictionCount: 1 })),
    ];
    const s = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T03:00:00Z", windowEpochs: 3, envelopes: envs });
    expect(s.totalReplayAmbiguous).toBe(8);
    expect(s.totalReplayCollapsed).toBe(2);
    expect(s.totalContradictions).toBe(1);
  });

  it("worst-of confidence collapse: UNKNOWN dominates", () => {
    const envs = [
      envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", aggregateVerificationConfidence: "VERIFIED" })),
      envelopeFor(epoch({ observedAt: "2026-05-09T01:00:00Z", aggregateVerificationConfidence: "UNKNOWN" })),
      envelopeFor(epoch({ observedAt: "2026-05-09T02:00:00Z", aggregateVerificationConfidence: "PARTIALLY-VERIFIED" })),
    ];
    const s = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T03:00:00Z", windowEpochs: 3, envelopes: envs });
    expect(s.worstAggregateConfidence).toBe("UNKNOWN");
  });

  it("compression confidence FULL when all window epochs present", () => {
    const envs = Array.from({ length: 5 }).map((_, i) => envelopeFor(epoch({ observedAt: `2026-05-09T0${i}:00:00Z` })));
    const s = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T05:00:00Z", windowEpochs: 5, envelopes: envs });
    expect(s.compressionConfidence).toBe("FULL");
  });

  it("compression confidence UNRECONSTRUCTABLE when 0 envelopes for non-zero window", () => {
    const s = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T05:00:00Z", windowEpochs: 5, envelopes: [] });
    expect(s.compressionConfidence).toBe("UNRECONSTRUCTABLE");
  });

  it("input envelope order does not affect summary hash (canonical)", () => {
    const a = envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", replayAmbiguousCount: 1 }));
    const b = envelopeFor(epoch({ observedAt: "2026-05-09T01:00:00Z", replayAmbiguousCount: 2 }));
    const s1 = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T02:00:00Z", windowEpochs: 2, envelopes: [a, b] });
    const s2 = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T02:00:00Z", windowEpochs: 2, envelopes: [b, a] });
    expect(s1.summaryCanonicalHash).toBe(s2.summaryCanonicalHash);
  });
});

describe("W2-PR69A — verifier", () => {
  it("clean summary verifies with zero findings", () => {
    const envs = [envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", replayAmbiguousCount: 1 }))];
    const s = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T01:00:00Z", windowEpochs: 1, envelopes: envs });
    expect(verifyEvidenceSummary(s, envs)).toEqual([]);
  });

  it("missing source envelope is detected", () => {
    const envs = [envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", replayAmbiguousCount: 1 }))];
    const s = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T01:00:00Z", windowEpochs: 1, envelopes: envs });
    const findings = verifyEvidenceSummary(s, []);
    expect(findings.some((f) => f.tag === "missing-source-envelope")).toBe(true);
  });

  it("forged ambiguity-zero summary is detected (ambiguity-collapsed)", () => {
    const envs = [envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", replayAmbiguousCount: 7 }))];
    const real = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T01:00:00Z", windowEpochs: 1, envelopes: envs });
    // Adversary forges a summary with totalReplayAmbiguous=0
    const forged: EvidenceSummary = { ...real, totalReplayAmbiguous: 0 };
    const findings = verifyEvidenceSummary(forged, envs);
    expect(findings.some((f) => f.tag === "ambiguity-collapsed")).toBe(true);
  });

  it("summary-hash mismatch detected when totals tampered", () => {
    const envs = [envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", replayAmbiguousCount: 4 }))];
    const real = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T01:00:00Z", windowEpochs: 1, envelopes: envs });
    const tampered: EvidenceSummary = { ...real, totalActiveOverrides: real.totalActiveOverrides + 99 };
    const findings = verifyEvidenceSummary(tampered, envs);
    expect(findings.some((f) => f.tag === "summary-hash-mismatch")).toBe(true);
  });
});

describe("W2-PR69A — TARGET 6: compression chaos", () => {
  it("CHAOS: dropping evidence below 20% threshold collapses to UNRECONSTRUCTABLE", () => {
    const envs = [envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z" }))];
    const s = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T10:00:00Z", windowEpochs: 10, envelopes: envs });
    expect(s.compressionConfidence).toBe("UNRECONSTRUCTABLE");
  });

  it("CHAOS: forged summary fails CI gate", () => {
    const envs = [envelopeFor(epoch({ observedAt: "2026-05-09T00:00:00Z", replayAmbiguousCount: 2 }))];
    const real = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T01:00:00Z", windowEpochs: 1, envelopes: envs });
    const forged: EvidenceSummary = { ...real, totalReplayAmbiguous: 0 };
    const r = buildEvidenceCompressionReport(forged, envs, "2026-05-09T01:30:00Z");
    expect(r.hasCiGatingCondition).toBe(true);
  });

  it("CHAOS: empty source archive ⇒ UNRECONSTRUCTABLE summary, no false-clean gate", () => {
    const s = buildEvidenceSummary({ windowFromIso: "2026-05-09T00:00:00Z", windowToIso: "2026-05-09T05:00:00Z", windowEpochs: 5, envelopes: [] });
    expect(s.compressionConfidence).toBe("UNRECONSTRUCTABLE");
    const r = buildEvidenceCompressionReport(s, [], "2026-05-09T06:00:00Z");
    // Round-trip with empty source matches itself; no findings
    expect(r.hasCiGatingCondition).toBe(false);
  });
});
