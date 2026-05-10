/**
 * W2-PR66A — Evidence durability tests + long-term replay chaos.
 */

import { describe, expect, it } from "vitest";

import type { GovernanceEpoch } from "../longitudinal-memory.js";
import {
  ARCHIVAL_SCHEMA_VERSION,
  buildArchivalEnvelope,
  buildEvidenceDurabilityReport,
  replayMigrationLineage,
  verifyArchivalEnvelope,
  type ArchivedEpochEnvelope,
  type MigrationRecipe,
  type MigrationStep,
} from "../evidence-durability.js";

function v1Epoch(): GovernanceEpoch {
  return {
    observedAt: "2026-05-09T00:00:00Z",
    activeOverrideCount: 1,
    expiredOverrideCount: 0,
    overRenewedOverrideCount: 0,
    replayAmbiguousCount: 2,
    replayCollapsedCount: 0,
    integrityDegradedCount: 0,
    containmentDegradedCount: 0,
    recoveryAttemptCount: 0,
    recoveryFailureCount: 0,
    contradictionCount: 0,
    aggregateVerificationConfidence: "VERIFIED",
    degradedDomainTallies: {},
  };
}

function freshV1Envelope(): ArchivedEpochEnvelope {
  const e = v1Epoch();
  return buildArchivalEnvelope({
    archivedAt: "2026-05-09T01:00:00Z",
    originalPayload: e as unknown as Readonly<Record<string, unknown>>,
    originalSchemaVersion: ARCHIVAL_SCHEMA_VERSION,
    currentPayload: e,
    migrationLineage: [],
  });
}

describe("W2-PR66A — envelope build", () => {
  it("v1 epoch with no migrations builds clean envelope", () => {
    const env = freshV1Envelope();
    expect(env.envelopeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(env.originalSchemaVersion).toBe(ARCHIVAL_SCHEMA_VERSION);
    expect(env.currentSchemaVersion).toBe(ARCHIVAL_SCHEMA_VERSION);
    expect(env.migrationLineage).toEqual([]);
  });

  it("identical inputs ⇒ identical envelope hash (deterministic)", () => {
    const a = freshV1Envelope();
    const b = freshV1Envelope();
    expect(a.envelopeHash).toBe(b.envelopeHash);
  });
});

describe("W2-PR66A — envelope verifier", () => {
  it("clean envelope produces zero findings", () => {
    expect(verifyArchivalEnvelope(freshV1Envelope())).toEqual([]);
  });

  it("tampered originalPayload is detected", () => {
    const env = freshV1Envelope();
    const tampered: ArchivedEpochEnvelope = {
      ...env,
      originalPayload: { ...env.originalPayload, replayAmbiguousCount: 999 },
    };
    const findings = verifyArchivalEnvelope(tampered);
    expect(findings.some((f) => f.tag === "original-payload-tampered")).toBe(true);
  });

  it("tampered currentPayload is detected", () => {
    const env = freshV1Envelope();
    const tampered: ArchivedEpochEnvelope = {
      ...env,
      currentPayload: { ...env.currentPayload, replayAmbiguousCount: 999 },
    };
    const findings = verifyArchivalEnvelope(tampered);
    expect(findings.some((f) => f.tag === "current-payload-tampered")).toBe(true);
  });

  it("tampered envelopeHash is detected", () => {
    const env = freshV1Envelope();
    const tampered: ArchivedEpochEnvelope = { ...env, envelopeHash: "0".repeat(64) };
    const findings = verifyArchivalEnvelope(tampered);
    expect(findings.some((f) => f.tag === "envelope-hash-mismatch")).toBe(true);
  });
});

describe("W2-PR66A — schema migration semantics", () => {
  // Synthetic v0 → v1 migration recipe for chaos tests.
  const noopV0toV1: MigrationRecipe = {
    recipeId: "noop-v0-to-v1",
    fromVersion: 0,
    toVersion: 1,
    description: "test recipe; identity transform",
    transform: (p) => p,
  };

  function v0EnvelopeMigratedToV1(): ArchivedEpochEnvelope {
    const e = v1Epoch();
    const step: MigrationStep = {
      fromVersion: 0,
      toVersion: 1,
      recipeId: "noop-v0-to-v1",
      appliedAt: "2026-05-09T01:00:00Z",
    };
    return buildArchivalEnvelope({
      archivedAt: "2026-05-09T01:00:00Z",
      originalPayload: e as unknown as Readonly<Record<string, unknown>>,
      originalSchemaVersion: 0,
      currentPayload: e,
      migrationLineage: [step],
    });
  }

  it("v0→v1 envelope round-trips through declared recipe", () => {
    const env = v0EnvelopeMigratedToV1();
    const findings = verifyArchivalEnvelope(env, [noopV0toV1]);
    expect(findings).toEqual([]);
    const replay = replayMigrationLineage(env, [noopV0toV1]);
    expect(replay.matches).toBe(true);
  });

  it("missing migration step is detected (originalSchemaVersion=0, no lineage)", () => {
    const e = v1Epoch();
    const env = buildArchivalEnvelope({
      archivedAt: "2026-05-09T01:00:00Z",
      originalPayload: e as unknown as Readonly<Record<string, unknown>>,
      originalSchemaVersion: 0,
      currentPayload: e,
      migrationLineage: [],
    });
    const findings = verifyArchivalEnvelope(env, [noopV0toV1]);
    expect(findings.some((f) => f.tag === "missing-migration-step")).toBe(true);
  });

  it("unknown recipe in declared lineage is detected", () => {
    const env = v0EnvelopeMigratedToV1();
    // verify with EMPTY recipe registry
    const findings = verifyArchivalEnvelope(env, []);
    expect(findings.some((f) => f.tag === "unknown-recipe")).toBe(true);
  });

  it("schema-version-skip: lineage step starts from wrong fromVersion", () => {
    const e = v1Epoch();
    const badStep: MigrationStep = {
      fromVersion: 5, // doesn't match originalSchemaVersion (1)
      toVersion: 1,
      recipeId: "noop-v0-to-v1",
      appliedAt: "2026-05-09T01:00:00Z",
    };
    const env = buildArchivalEnvelope({
      archivedAt: "2026-05-09T01:00:00Z",
      originalPayload: e as unknown as Readonly<Record<string, unknown>>,
      originalSchemaVersion: 1,
      currentPayload: e,
      migrationLineage: [badStep],
    });
    const findings = verifyArchivalEnvelope(env, [noopV0toV1]);
    expect(findings.some((f) => f.tag === "schema-version-skip")).toBe(true);
  });
});

describe("W2-PR66A — TARGET 6: durability chaos simulations", () => {
  it("CHAOS: bulk archive with one tampered envelope → CI gate fires", () => {
    const clean = freshV1Envelope();
    const tampered: ArchivedEpochEnvelope = {
      ...clean,
      currentPayload: { ...clean.currentPayload, replayAmbiguousCount: 999 },
    };
    const r = buildEvidenceDurabilityReport(
      [clean, tampered],
      "2026-05-09T02:00:00Z",
    );
    expect(r.envelopesEvaluated).toBe(2);
    expect(r.hasCiGatingCondition).toBe(true);
    // Tampering on currentPayload is caught by verifyArchivalEnvelope
    // (current-payload-tampered + envelope-hash-mismatch), not necessarily
    // by replay (which only walks originalPayload through the lineage).
    expect(r.findings.some((f) => f.finding.tag === "current-payload-tampered")).toBe(true);
  });

  it("CHAOS: ambiguity preservation across long timeline (replayAmbiguousCount survives)", () => {
    const e = v1Epoch();
    e.replayAmbiguousCount = 7;
    const env = buildArchivalEnvelope({
      archivedAt: "2026-05-09T01:00:00Z",
      originalPayload: e as unknown as Readonly<Record<string, unknown>>,
      originalSchemaVersion: ARCHIVAL_SCHEMA_VERSION,
      currentPayload: e,
      migrationLineage: [],
    });
    const replay = replayMigrationLineage(env);
    expect(replay.matches).toBe(true);
    expect(env.currentPayload.replayAmbiguousCount).toBe(7);
  });

  it("CHAOS: empty archive → no gating", () => {
    const r = buildEvidenceDurabilityReport([], "2026-05-09T00:00:00Z");
    expect(r.hasCiGatingCondition).toBe(false);
    expect(r.envelopesEvaluated).toBe(0);
  });

  it("CHAOS: lineage-tampered envelope is detected", () => {
    const env = freshV1Envelope();
    const tampered: ArchivedEpochEnvelope = {
      ...env,
      migrationLineage: [{ fromVersion: 0, toVersion: 1, recipeId: "fake", appliedAt: "2026-05-09T00:00:00Z" }],
    };
    const findings = verifyArchivalEnvelope(tampered);
    expect(findings.some((f) => f.tag === "lineage-tampered")).toBe(true);
  });

  it("non-deterministic recipe is detected by replayMigrationLineage", () => {
    let counter = 0;
    const flakyRecipe: MigrationRecipe = {
      recipeId: "flaky",
      fromVersion: 0,
      toVersion: 1,
      description: "non-deterministic test recipe",
      transform: (p) => ({ ...p, _flake: counter++ }),
    };
    const e = v1Epoch();
    const env = buildArchivalEnvelope({
      archivedAt: "2026-05-09T01:00:00Z",
      originalPayload: e as unknown as Readonly<Record<string, unknown>>,
      originalSchemaVersion: 0,
      currentPayload: e,
      migrationLineage: [{ fromVersion: 0, toVersion: 1, recipeId: "flaky", appliedAt: "2026-05-09T01:00:00Z" }],
    });
    const replay = replayMigrationLineage(env, [flakyRecipe]);
    expect(replay.findings.some((f) => f.tag === "migration-non-deterministic")).toBe(true);
  });
});
