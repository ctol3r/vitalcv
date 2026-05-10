/**
 * Evidence durability + long-term replay survivability (W2-PR66A).
 *
 * Schema-versioned archival envelope around tamper-evident epochs. Each
 * archived epoch declares its schema version + the migration lineage
 * applied to reach the current schema. Replay-verifiers walk the
 * migration chain deterministically; missing or skipped migrations
 * fail-closed.
 *
 * Lexicon-aligned: durability claims are bounded — "tamper-evident given
 * DB integrity" + "audit-traceable lineage". This is not a substrate
 * guarantee; if the archive is destroyed, evidence is gone. The value is
 * that any *partial* survival can be replayed deterministically.
 *
 * Non-negotiable rules (W2-PR66A):
 *   - replay continuity survives migrations
 *   - historical evidence reconstructable
 *   - ambiguity preserved longitudinally
 *   - fail-closed durability semantics
 *   - archival replay deterministic
 *   - evidence lineage immutable
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";
import type { GovernanceEpoch } from "./longitudinal-memory.js";

// ---------------------------------------------------------------------------
// Schema version + migration lineage
// ---------------------------------------------------------------------------

/**
 * Current archival schema version. Bumped when GovernanceEpoch shape
 * changes incompatibly. The epoch shape that ships in this commit IS
 * version 1 — older archives must declare their own version + carry a
 * migration step that reaches v1.
 */
export const ARCHIVAL_SCHEMA_VERSION = 1 as const;
export type ArchivalSchemaVersion = number;

/**
 * One migration step applied to an archived epoch. Migrations are
 * declarative: they describe WHAT was changed and the from/to versions;
 * actual transformation is the registered MigrationRecipe (below).
 */
export interface MigrationStep {
  readonly fromVersion: ArchivalSchemaVersion;
  readonly toVersion: ArchivalSchemaVersion;
  readonly recipeId: string;
  readonly appliedAt: string;
}

/**
 * The archival envelope. The original payload is preserved verbatim
 * (`originalPayload`) AND a migrated current-shape payload is computed
 * (`currentPayload`). Both hashes are recorded so a verifier can detect:
 *   - migration drift (recompute migrated → compare currentPayloadHash)
 *   - original tampering (recompute hash → compare originalPayloadHash)
 *   - lineage tampering (recompute lineage hash)
 */
export interface ArchivedEpochEnvelope {
  readonly archivedAt: string;
  readonly originalSchemaVersion: ArchivalSchemaVersion;
  readonly currentSchemaVersion: ArchivalSchemaVersion;
  /** Frozen original payload (whatever shape the epoch had at archive time). */
  readonly originalPayload: Readonly<Record<string, unknown>>;
  readonly originalPayloadHash: string;
  /** Migrated payload at current schema (== originalPayload if same version). */
  readonly currentPayload: GovernanceEpoch;
  readonly currentPayloadHash: string;
  /** Ordered migration steps from originalSchemaVersion → currentSchemaVersion. */
  readonly migrationLineage: readonly MigrationStep[];
  readonly lineageHash: string;
  /** Final envelope hash binds all of the above. */
  readonly envelopeHash: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Migration recipe registry
// ---------------------------------------------------------------------------

/**
 * A pure migration recipe. Takes a payload at `fromVersion` and returns a
 * payload at `toVersion`. MUST be deterministic.
 */
export interface MigrationRecipe {
  readonly recipeId: string;
  readonly fromVersion: ArchivalSchemaVersion;
  readonly toVersion: ArchivalSchemaVersion;
  readonly description: string;
  readonly transform: (payload: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>;
}

/**
 * Currently-registered recipes. Empty by default — at v1 the current
 * schema IS the only schema, so there's nothing to migrate. The
 * registry exists so that v2/v3 additions can ship a recipe for v1→v2,
 * v2→v3, etc., and verifyArchivalLineage can walk the chain.
 */
export const MIGRATION_RECIPES: readonly MigrationRecipe[] = Object.freeze([]);

export function lookupRecipe(
  recipeId: string,
  registry: readonly MigrationRecipe[] = MIGRATION_RECIPES,
): MigrationRecipe | null {
  for (const r of registry) {
    if (r.recipeId === recipeId) return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Build + verify envelope
// ---------------------------------------------------------------------------

/**
 * Build an archival envelope from a current-shape (v1) epoch.
 *
 * For epochs already at the current version, originalPayload ===
 * currentPayload (deep-equal); migrationLineage is empty.
 */
export function buildArchivalEnvelope(input: {
  readonly archivedAt: string;
  readonly originalPayload: Readonly<Record<string, unknown>>;
  readonly originalSchemaVersion: ArchivalSchemaVersion;
  readonly currentPayload: GovernanceEpoch;
  readonly migrationLineage: readonly MigrationStep[];
}): ArchivedEpochEnvelope {
  const originalPayloadHash = sha256Hex(canonicalize(input.originalPayload));
  const currentPayloadHash = sha256Hex(canonicalize(input.currentPayload));
  const lineageHash = sha256Hex(canonicalize(input.migrationLineage));

  const preEnvelope = {
    archivedAt: input.archivedAt,
    originalSchemaVersion: input.originalSchemaVersion,
    currentSchemaVersion: ARCHIVAL_SCHEMA_VERSION,
    originalPayload: input.originalPayload,
    originalPayloadHash,
    currentPayload: input.currentPayload,
    currentPayloadHash,
    migrationLineage: input.migrationLineage,
    lineageHash,
  };
  const envelopeHash = sha256Hex(canonicalize(preEnvelope));

  return Object.freeze({
    ...preEnvelope,
    envelopeHash,
  });
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export type DurabilityFinding =
  | { readonly tag: "envelope-hash-mismatch"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "original-payload-tampered"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "current-payload-tampered"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "lineage-tampered"; readonly recorded: string; readonly recomputed: string }
  | { readonly tag: "schema-version-skip"; readonly fromVersion: number; readonly toVersion: number; readonly stepIndex: number }
  | { readonly tag: "missing-migration-step"; readonly fromVersion: number; readonly expectedTarget: number }
  | { readonly tag: "unknown-recipe"; readonly recipeId: string }
  | { readonly tag: "migration-non-deterministic"; readonly recipeId: string }
  | { readonly tag: "current-schema-version-mismatch"; readonly envelope: number; readonly system: number };

export function verifyArchivalEnvelope(
  envelope: ArchivedEpochEnvelope,
  recipes: readonly MigrationRecipe[] = MIGRATION_RECIPES,
): readonly DurabilityFinding[] {
  const findings: DurabilityFinding[] = [];

  // System schema alignment
  if (envelope.currentSchemaVersion !== ARCHIVAL_SCHEMA_VERSION) {
    findings.push({
      tag: "current-schema-version-mismatch",
      envelope: envelope.currentSchemaVersion,
      system: ARCHIVAL_SCHEMA_VERSION,
    });
  }

  // Hash recomputations
  const recomputedOriginal = sha256Hex(canonicalize(envelope.originalPayload));
  if (recomputedOriginal !== envelope.originalPayloadHash) {
    findings.push({
      tag: "original-payload-tampered",
      recorded: envelope.originalPayloadHash,
      recomputed: recomputedOriginal,
    });
  }
  const recomputedCurrent = sha256Hex(canonicalize(envelope.currentPayload));
  if (recomputedCurrent !== envelope.currentPayloadHash) {
    findings.push({
      tag: "current-payload-tampered",
      recorded: envelope.currentPayloadHash,
      recomputed: recomputedCurrent,
    });
  }
  const recomputedLineage = sha256Hex(canonicalize(envelope.migrationLineage));
  if (recomputedLineage !== envelope.lineageHash) {
    findings.push({
      tag: "lineage-tampered",
      recorded: envelope.lineageHash,
      recomputed: recomputedLineage,
    });
  }
  const recomputedEnvelope = sha256Hex(canonicalize({
    archivedAt: envelope.archivedAt,
    originalSchemaVersion: envelope.originalSchemaVersion,
    currentSchemaVersion: envelope.currentSchemaVersion,
    originalPayload: envelope.originalPayload,
    originalPayloadHash: envelope.originalPayloadHash,
    currentPayload: envelope.currentPayload,
    currentPayloadHash: envelope.currentPayloadHash,
    migrationLineage: envelope.migrationLineage,
    lineageHash: envelope.lineageHash,
  }));
  if (recomputedEnvelope !== envelope.envelopeHash) {
    findings.push({
      tag: "envelope-hash-mismatch",
      recorded: envelope.envelopeHash,
      recomputed: recomputedEnvelope,
    });
  }

  // Migration chain continuity
  let cursor = envelope.originalSchemaVersion;
  for (let i = 0; i < envelope.migrationLineage.length; i++) {
    const step = envelope.migrationLineage[i]!;
    if (step.fromVersion !== cursor) {
      findings.push({
        tag: "schema-version-skip",
        fromVersion: cursor,
        toVersion: step.fromVersion,
        stepIndex: i,
      });
    }
    if (!lookupRecipe(step.recipeId, recipes)) {
      findings.push({ tag: "unknown-recipe", recipeId: step.recipeId });
    }
    cursor = step.toVersion;
  }
  if (cursor !== envelope.currentSchemaVersion) {
    findings.push({
      tag: "missing-migration-step",
      fromVersion: cursor,
      expectedTarget: envelope.currentSchemaVersion,
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Replay reconstruction (long-term durability — TARGET 1/3/5)
// ---------------------------------------------------------------------------

/**
 * Given an archived envelope + recipe registry, replay the migration
 * chain from originalPayload and verify the result canonical-hashes
 * to the recorded currentPayloadHash. Detects migration drift (i.e., a
 * recipe was changed after the fact and the recorded migrated payload
 * no longer matches what the current recipes produce).
 */
export function replayMigrationLineage(
  envelope: ArchivedEpochEnvelope,
  recipes: readonly MigrationRecipe[] = MIGRATION_RECIPES,
): { readonly reconstructedHash: string; readonly matches: boolean; readonly findings: readonly DurabilityFinding[] } {
  const findings: DurabilityFinding[] = [];
  let payload: Readonly<Record<string, unknown>> = envelope.originalPayload;
  for (const step of envelope.migrationLineage) {
    const recipe = lookupRecipe(step.recipeId, recipes);
    if (!recipe) {
      findings.push({ tag: "unknown-recipe", recipeId: step.recipeId });
      // Cannot continue migration without recipe; bail with current payload
      break;
    }
    const before = sha256Hex(canonicalize(payload));
    const after = recipe.transform(payload);
    const after2 = recipe.transform(payload);
    if (sha256Hex(canonicalize(after)) !== sha256Hex(canonicalize(after2))) {
      findings.push({ tag: "migration-non-deterministic", recipeId: recipe.recipeId });
    }
    payload = after;
    // sanity: track that something happened (no-op recipes are fine)
    void before;
  }
  const reconstructedHash = sha256Hex(canonicalize(payload));
  const matches = reconstructedHash === envelope.currentPayloadHash;
  return { reconstructedHash, matches, findings: Object.freeze(findings) };
}

// ---------------------------------------------------------------------------
// Archive-level CI gate
// ---------------------------------------------------------------------------

export interface EvidenceDurabilityReport {
  readonly executedAt: string;
  readonly envelopesEvaluated: number;
  readonly findings: readonly { readonly envelopeIndex: number; readonly finding: DurabilityFinding }[];
  readonly replayMatchCount: number;
  readonly replayMismatchCount: number;
  /**
   * CI gating triggers:
   *   - any envelope finding (hash, lineage, schema)
   *   - any replay reconstruction mismatch
   */
  readonly hasCiGatingCondition: boolean;
}

export function buildEvidenceDurabilityReport(
  envelopes: readonly ArchivedEpochEnvelope[],
  nowIso: string,
  recipes: readonly MigrationRecipe[] = MIGRATION_RECIPES,
): EvidenceDurabilityReport {
  const findings: EvidenceDurabilityReport["findings"][number][] = [];
  let matches = 0;
  let mismatches = 0;
  let gating = false;

  envelopes.forEach((env, i) => {
    for (const f of verifyArchivalEnvelope(env, recipes)) {
      findings.push({ envelopeIndex: i, finding: f });
      gating = true;
    }
    const replay = replayMigrationLineage(env, recipes);
    for (const f of replay.findings) {
      findings.push({ envelopeIndex: i, finding: f });
      gating = true;
    }
    if (replay.matches) matches++;
    else {
      mismatches++;
      gating = true;
    }
  });

  return Object.freeze({
    executedAt: nowIso,
    envelopesEvaluated: envelopes.length,
    findings: Object.freeze(findings),
    replayMatchCount: matches,
    replayMismatchCount: mismatches,
    hasCiGatingCondition: gating,
  });
}
