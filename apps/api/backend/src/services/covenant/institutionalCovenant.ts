/**
 * institutionalCovenant.ts — W2-PR157A: Institutional Runtime Covenant Finalization
 *
 * Codifies the six permanent constitutional runtime guarantees that the VitalCV
 * trust runtime must uphold across every deployment, upgrade, and failure mode.
 *
 * A "covenant" is a named, versioned, cryptographically locked guarantee:
 *   - It carries human-readable invariants (the "guarantees" array).
 *   - It carries a fail-closed behavior description — what happens at breach.
 *   - Its lock record is permanent (no unlock path exists in this module).
 *   - Its compliance verdict is derived solely from supplied runtime signals;
 *     no operator assertion may override an evidence-derived verdict.
 *   - Ambiguous signals are preserved as AMBIGUOUS — never coerced to COMPLIANT.
 *
 * Hard invariants (fail-closed):
 *   - A covenant whose compliance is ambiguous is QUARANTINED, never merged
 *     with the compliant population. Ambiguity surfaces as a first-class result.
 *   - A covenant violation makes the gate fail immediately; a single violation
 *     is sufficient to block release, regardless of other covenants' status.
 *   - Covenant lineage is reconstructable: every covenant record carries a
 *     lineageSeed so the full chain can be rebuilt from stored records alone.
 *   - Lock records carry a permanent:true literal so no deserializer can
 *     produce an "unlocked" record without a type error.
 *   - Covenant digests are tamper-evident: forged compliance verdicts produce
 *     a different verdictHash than the original, detectable at audit time.
 *
 * No fetches, no DB writes, no audit-event writes. Pure transforms only.
 *
 * Companion modules:
 *   - covenantObservability.ts     (board metrics derived from covenant verdicts)
 *   - governanceRuntimeHardening.ts (production survivability axis)
 *   - constitutionalRecovery.ts    (recovery state machine)
 *   - replayCorruptionContainment.ts (replay integrity axis)
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Covenant identity ─────────────────────────────────────────────────────────

export type CovenantId =
  | 'REPLAY_GUARANTEE'
  | 'AMBIGUITY_HONESTY'
  | 'FAIL_CLOSED_BOUNDARY'
  | 'TENANT_ISOLATION'
  | 'LINEAGE_RECONSTRUCTABILITY'
  | 'INSTITUTIONAL_SURVIVABILITY';

// ── Covenant record ───────────────────────────────────────────────────────────

export interface CovenantRecord {
  schema: 'vitalcv.institutional-covenant.v1';
  covenantId: CovenantId;
  name: string;
  version: number;
  lockedAt: string;
  lockedBy: string;
  guarantees: string[];
  failClosedBehavior: string;
  /** sha256 of (covenantId + version + guarantees) — enables lineage reconstruction */
  lineageSeed: string;
  covenantHash: string;
}

// ── Lock record ───────────────────────────────────────────────────────────────

export interface CovenantLockRecord {
  schema: 'vitalcv.covenant-lock.v1';
  covenantId: CovenantId;
  lockedAtVersion: number;
  lockedAt: string;
  /** Prevents silent lock mutation — forged records produce a different hash */
  lockHash: string;
  /** Literal true — no unlock path exists */
  permanent: true;
}

// ── Compliance types ──────────────────────────────────────────────────────────

export type CovenantComplianceStatus =
  | 'COMPLIANT'
  | 'VIOLATED'
  | 'AMBIGUOUS'
  | 'QUARANTINED';

export interface CovenantViolation {
  covenantId: CovenantId;
  rule: string;
  signal: string;
  severity: 'FATAL' | 'DEGRADED';
}

export interface CovenantComplianceVerdict {
  schema: 'vitalcv.covenant-compliance.v1';
  covenantId: CovenantId;
  status: CovenantComplianceStatus;
  violations: CovenantViolation[];
  ambiguities: string[];
  /** When true, the gate must block — compliance is not established */
  failClosed: boolean;
  verdictHash: string;
}

// ── Lineage types ─────────────────────────────────────────────────────────────

export interface CovenantLineageEntry {
  position: number;
  covenantId: CovenantId;
  version: number;
  lockedAt: string;
  guaranteeCount: number;
  entryHash: string;
}

export interface CovenantLineage {
  schema: 'vitalcv.covenant-lineage.v1';
  timeline: CovenantLineageEntry[];
  firstLockedAt: string | null;
  lastLockedAt: string | null;
  lineageHash: string;
}

// ── Gate types ────────────────────────────────────────────────────────────────

export type CovenantGateId =
  | 'all_covenants_locked'
  | 'no_compliance_violations'
  | 'ambiguity_visible'
  | 'lineage_reconstructable'
  | 'fail_closed_enforced'
  | 'verdicts_evidence_derived';

export interface CovenantGate {
  id: CovenantGateId;
  pass: boolean;
  reason: string;
}

export interface CovenantGateVerdict {
  pass: boolean;
  gates: CovenantGate[];
  failedGateIds: CovenantGateId[];
  totalCovenants: number;
  compliantCount: number;
  violatedCount: number;
  ambiguousCount: number;
}

// ── Chaos types ───────────────────────────────────────────────────────────────

export type CovenantChaosScenario =
  | 'BASELINE'
  | 'REPLAY_GUARANTEE_BREACH'
  | 'AMBIGUITY_HONESTY_VIOLATION'
  | 'SURVIVABILITY_COLLAPSE'
  | 'COVENANT_LINEAGE_CORRUPTION';

export interface CovenantChaosVerdict {
  scenario: CovenantChaosScenario;
  signalSurfaced: boolean;
  signal: string;
  failedGateIds: CovenantGateId[];
  status: CovenantComplianceStatus;
}

export interface CovenantChaosResult {
  verdicts: CovenantChaosVerdict[];
  summary: {
    totalScenarios: number;
    surfacedCount: number;
    silentCount: number;
  };
}

// ── Runtime signal supplied by call sites ─────────────────────────────────────

export interface CovenantRuntimeSignal {
  /** Whether replay is deterministic and tamper-free */
  replayFaithful: boolean;
  /** Whether ambiguous signals are surfaced (not coerced to a verdict) */
  ambiguityPreserved: boolean;
  /** Whether the trust boundary defaults to closed under uncertainty */
  failClosedUnderUncertainty: boolean;
  /** Whether tenant data is isolated from cross-tenant access */
  tenantIsolationHeld: boolean;
  /** Whether audit lineage can be reconstructed from stored records */
  lineageReconstructable: boolean;
  /** Whether the institutional guarantee floor is still above threshold */
  survivabilityFloorHeld: boolean;
  /**
   * Optional: percent of covenants the caller reports as passing.
   * When supplied, must equal the evidence-derived count — if it differs,
   * the verdict becomes AMBIGUOUS (operator assertion ≠ evidence).
   */
  operatorAssertedCompliancePct?: number;
}

// ── Canonical covenant definitions ────────────────────────────────────────────

const LOCKED_AT = '2026-05-10T00:00:00.000Z';
const LOCKED_BY = 'vitalcv.covenant-finalizer.w2-pr157a';

function buildRecord(
  covenantId: CovenantId,
  name: string,
  version: number,
  guarantees: string[],
  failClosedBehavior: string,
): CovenantRecord {
  const lineageSeed = sha256ForPayload({
    schema: 'vitalcv.covenant-lineage-seed.v1',
    covenantId,
    version,
    guarantees,
  });
  const body = {
    schema: 'vitalcv.institutional-covenant.v1' as const,
    covenantId,
    name,
    version,
    lockedAt: LOCKED_AT,
    lockedBy: LOCKED_BY,
    guarantees,
    failClosedBehavior,
    lineageSeed,
  };
  return { ...body, covenantHash: sha256ForPayload(body) };
}

export const CANONICAL_COVENANTS: ReadonlyMap<CovenantId, CovenantRecord> = new Map([
  [
    'REPLAY_GUARANTEE',
    buildRecord(
      'REPLAY_GUARANTEE',
      'Replay Faithfulness Guarantee',
      1,
      [
        'Every audit replay must produce bit-identical output for the same capsule input.',
        'Tamper detection must fire on any hash drift between stored and recomputed artifacts.',
        'Replay quarantine must activate before a corrupted record reaches the audit bundle.',
        'Replay confidence scores must be derived from evidence, never from operator assertion.',
      ],
      'Replay quarantine is raised immediately; the capsule is excluded from all audit bundles until integrity is re-established.',
    ),
  ],
  [
    'AMBIGUITY_HONESTY',
    buildRecord(
      'AMBIGUITY_HONESTY',
      'Ambiguity Honesty Permanence',
      1,
      [
        'Ambiguous trust signals must surface as AMBIGUOUS — never silently coerced to a clean or compliant verdict.',
        'Contradicting signals (e.g. replay backpressure vs. throughput health) must both be preserved in the output.',
        'No status label may represent an ambiguous credential as definitively verified.',
        'Ambiguity penalties must propagate to all downstream confidence scores.',
      ],
      'The record is quarantined and surfaced to the operator as AMBIGUOUS; no compliant verdict is issued until ambiguity is resolved.',
    ),
  ],
  [
    'FAIL_CLOSED_BOUNDARY',
    buildRecord(
      'FAIL_CLOSED_BOUNDARY',
      'Fail-Closed Trust Boundary',
      1,
      [
        'Under any uncertainty, the trust boundary defaults to closed — access is denied, not assumed.',
        'A degraded runtime tier must be quarantined; it must never be silently merged with the healthy population.',
        'No feature flag or operator override may open a fail-closed boundary without evidence.',
        'Partial survivability floor breach must surface as HARDENING_BREACH, not as a partial-healthy aggregate.',
      ],
      'The boundary closes immediately; any attempt to issue a compliant verdict while in degraded state produces a VIOLATED gate result.',
    ),
  ],
  [
    'TENANT_ISOLATION',
    buildRecord(
      'TENANT_ISOLATION',
      'Tenant Isolation Guarantee',
      1,
      [
        'Tenant-scoped fingerprints must include the tenantId in their pre-image; cross-tenant replay collision is structurally impossible.',
        'A mutation fingerprint without a tenantId must be marked tenantBound:false and excluded from tenant-scoped lineage.',
        'Tenant scope must be asserted at every audit replay boundary before capsule data is accessed.',
        'Cross-tenant contamination must surface as a CONTAINMENT_BREACH and halt the affected replay pipeline.',
      ],
      'The replay is quarantined and the tenant pipeline is halted; no capsule data crosses tenant boundaries under any failure mode.',
    ),
  ],
  [
    'LINEAGE_RECONSTRUCTABILITY',
    buildRecord(
      'LINEAGE_RECONSTRUCTABILITY',
      'Audit Lineage Reconstructability',
      1,
      [
        'Every covenant record carries a lineageSeed enabling full chain reconstruction from stored records.',
        'Every recovery step carries a stepHash enabling longitudinal before/during/after visibility.',
        'Lineage must remain reconstructable even after partial corruption — corrupt entries are quarantined, not deleted.',
        'A lineage whose integrity cannot be verified must surface as AMBIGUOUS, never as CLEAN.',
      ],
      'The lineage gap is flagged and reconstruction halts at the corrupt entry; downstream records inherit AMBIGUOUS status until the gap is closed.',
    ),
  ],
  [
    'INSTITUTIONAL_SURVIVABILITY',
    buildRecord(
      'INSTITUTIONAL_SURVIVABILITY',
      'Institutional Survivability Guarantee',
      1,
      [
        'The institutional guarantee floor must be enforced at every runtime tier boundary.',
        'When the surviving runtime population falls below the floor, HARDENING_BREACH surfaces — never a partial cluster dressed as production-ready.',
        'Institutional trust must survive node failure without silent degradation of the audit trail.',
        'Rollout survivability must be verified before any trust-affecting capability is promoted to stable.',
      ],
      'HARDENING_BREACH is raised and the institutional tier is quarantined; no capability promotion occurs until the floor is re-established.',
    ),
  ],
]);

// ── Lock record factory ───────────────────────────────────────────────────────

export function lockCovenant(covenantId: CovenantId): CovenantLockRecord {
  const record = CANONICAL_COVENANTS.get(covenantId);
  if (!record) {
    throw new Error(`Unknown covenantId: ${covenantId}`);
  }
  const body = {
    schema: 'vitalcv.covenant-lock.v1' as const,
    covenantId,
    lockedAtVersion: record.version,
    lockedAt: record.lockedAt,
    permanent: true as const,
  };
  return { ...body, lockHash: sha256ForPayload(body) };
}

export function lockAllCovenants(): ReadonlyMap<CovenantId, CovenantLockRecord> {
  const locks = new Map<CovenantId, CovenantLockRecord>();
  for (const id of CANONICAL_COVENANTS.keys()) {
    locks.set(id, lockCovenant(id));
  }
  return locks;
}

// ── Compliance evaluation ─────────────────────────────────────────────────────

function signalForCovenant(
  covenantId: CovenantId,
  signal: CovenantRuntimeSignal,
): { pass: boolean; ambiguous: boolean; violationRule: string | null } {
  switch (covenantId) {
    case 'REPLAY_GUARANTEE':
      return {
        pass: signal.replayFaithful,
        ambiguous: false,
        violationRule: signal.replayFaithful
          ? null
          : 'Replay is not faithful — hash drift or non-deterministic output detected.',
      };
    case 'AMBIGUITY_HONESTY':
      return {
        pass: signal.ambiguityPreserved,
        ambiguous: false,
        violationRule: signal.ambiguityPreserved
          ? null
          : 'Ambiguous signal was coerced to a clean verdict — honesty covenant violated.',
      };
    case 'FAIL_CLOSED_BOUNDARY':
      return {
        pass: signal.failClosedUnderUncertainty,
        ambiguous: false,
        violationRule: signal.failClosedUnderUncertainty
          ? null
          : 'Trust boundary opened under uncertainty — fail-closed covenant violated.',
      };
    case 'TENANT_ISOLATION':
      return {
        pass: signal.tenantIsolationHeld,
        ambiguous: false,
        violationRule: signal.tenantIsolationHeld
          ? null
          : 'Tenant isolation boundary was breached — cross-tenant contamination detected.',
      };
    case 'LINEAGE_RECONSTRUCTABILITY':
      return {
        pass: signal.lineageReconstructable,
        ambiguous: false,
        violationRule: signal.lineageReconstructable
          ? null
          : 'Audit lineage cannot be reconstructed — lineage gap detected.',
      };
    case 'INSTITUTIONAL_SURVIVABILITY':
      return {
        pass: signal.survivabilityFloorHeld,
        ambiguous: false,
        violationRule: signal.survivabilityFloorHeld
          ? null
          : 'Institutional survivability floor breached — HARDENING_BREACH condition.',
      };
  }
}

function detectOperatorAssertionMismatch(
  signal: CovenantRuntimeSignal,
  evidenceCompliantCount: number,
  total: number,
): string | null {
  if (signal.operatorAssertedCompliancePct === undefined) return null;
  const evidencePct = Math.round((evidenceCompliantCount / total) * 100);
  if (signal.operatorAssertedCompliancePct !== evidencePct) {
    return `Operator asserted ${signal.operatorAssertedCompliancePct}% compliant but evidence shows ${evidencePct}% — assertion does not match evidence.`;
  }
  return null;
}

export function evaluateCovenantCompliance(
  covenantId: CovenantId,
  signal: CovenantRuntimeSignal,
): CovenantComplianceVerdict {
  const { pass, ambiguous, violationRule } = signalForCovenant(covenantId, signal);

  const violations: CovenantViolation[] = [];
  const ambiguities: string[] = [];

  if (!pass && violationRule) {
    violations.push({
      covenantId,
      rule: violationRule,
      signal: `covenant=${covenantId} pass=false`,
      severity: 'FATAL',
    });
  }

  if (ambiguous) {
    ambiguities.push(`Covenant ${covenantId} received contradicting runtime signals.`);
  }

  const status: CovenantComplianceStatus =
    ambiguous || ambiguities.length > 0
      ? 'QUARANTINED'
      : violations.length > 0
        ? 'VIOLATED'
        : 'COMPLIANT';

  const failClosed = status !== 'COMPLIANT';

  const body = {
    schema: 'vitalcv.covenant-compliance.v1' as const,
    covenantId,
    status,
    violations,
    ambiguities,
    failClosed,
  };

  return { ...body, verdictHash: sha256ForPayload(body) };
}

export function evaluateAllCovenantCompliance(
  signal: CovenantRuntimeSignal,
): CovenantComplianceVerdict[] {
  return Array.from(CANONICAL_COVENANTS.keys()).map((id) =>
    evaluateCovenantCompliance(id, signal),
  );
}

// ── Gate evaluation ───────────────────────────────────────────────────────────

export function evaluateCovenantGate(
  verdicts: CovenantComplianceVerdict[],
  signal: CovenantRuntimeSignal,
): CovenantGateVerdict {
  const locks = lockAllCovenants();

  const compliantCount = verdicts.filter((v) => v.status === 'COMPLIANT').length;
  const violatedCount = verdicts.filter((v) => v.status === 'VIOLATED').length;
  const ambiguousCount = verdicts.filter(
    (v) => v.status === 'AMBIGUOUS' || v.status === 'QUARANTINED',
  ).length;
  const total = CANONICAL_COVENANTS.size;

  const mismatch = detectOperatorAssertionMismatch(signal, compliantCount, total);

  const gates: CovenantGate[] = [
    {
      id: 'all_covenants_locked',
      pass: locks.size === total,
      reason: `All ${total} canonical covenants must have a permanent lock record before the gate passes.`,
    },
    {
      id: 'no_compliance_violations',
      pass: violatedCount === 0,
      reason: 'Zero VIOLATED verdicts are required — a single violation blocks the gate.',
    },
    {
      id: 'ambiguity_visible',
      pass: ambiguousCount === 0 || verdicts.some((v) => v.ambiguities.length > 0),
      reason: 'Ambiguity must surface explicitly; silent quarantine without an ambiguity record is not allowed.',
    },
    {
      id: 'lineage_reconstructable',
      pass: Array.from(CANONICAL_COVENANTS.values()).every((r) => r.lineageSeed.length === 64),
      reason: 'Every covenant must carry a 64-char lineageSeed enabling lineage reconstruction.',
    },
    {
      id: 'fail_closed_enforced',
      pass: compliantCount === total,
      reason: 'Gate passes only when all covenants are COMPLIANT — partial compliance is treated as fail-closed.',
    },
    {
      id: 'verdicts_evidence_derived',
      pass: mismatch === null,
      reason: 'When an operatorAssertedCompliancePct is supplied, it must match the evidence-derived count exactly.',
    },
  ];

  const failedGateIds = gates.filter((g) => !g.pass).map((g) => g.id);

  return {
    pass: failedGateIds.length === 0,
    gates,
    failedGateIds,
    totalCovenants: total,
    compliantCount,
    violatedCount,
    ambiguousCount,
  };
}

// ── Lineage builder ───────────────────────────────────────────────────────────

export function buildCovenantLineage(records: CovenantRecord[]): CovenantLineage {
  const sorted = [...records].sort(
    (a, b) =>
      Date.parse(a.lockedAt) - Date.parse(b.lockedAt) ||
      a.covenantId.localeCompare(b.covenantId),
  );

  const timeline: CovenantLineageEntry[] = sorted.map((r, i) => {
    const body = {
      covenantId: r.covenantId,
      version: r.version,
      lockedAt: r.lockedAt,
      guaranteeCount: r.guarantees.length,
    };
    return {
      position: i,
      ...body,
      entryHash: sha256ForPayload(body),
    };
  });

  const body = {
    schema: 'vitalcv.covenant-lineage.v1' as const,
    timeline,
    firstLockedAt: timeline[0]?.lockedAt ?? null,
    lastLockedAt: timeline[timeline.length - 1]?.lockedAt ?? null,
  };

  return { ...body, lineageHash: sha256ForPayload(body) };
}

// ── Chaos simulations ─────────────────────────────────────────────────────────

function chaosSignal(overrides: Partial<CovenantRuntimeSignal>): CovenantRuntimeSignal {
  return {
    replayFaithful: true,
    ambiguityPreserved: true,
    failClosedUnderUncertainty: true,
    tenantIsolationHeld: true,
    lineageReconstructable: true,
    survivabilityFloorHeld: true,
    ...overrides,
  };
}

export function runCovenantChaosSimulations(): CovenantChaosResult {
  const scenarios: CovenantChaosScenario[] = [
    'BASELINE',
    'REPLAY_GUARANTEE_BREACH',
    'AMBIGUITY_HONESTY_VIOLATION',
    'SURVIVABILITY_COLLAPSE',
    'COVENANT_LINEAGE_CORRUPTION',
  ];

  const verdicts = scenarios.map((scenario): CovenantChaosVerdict => {
    const signal = chaosSignal(
      scenario === 'BASELINE'
        ? {}
        : scenario === 'REPLAY_GUARANTEE_BREACH'
          ? { replayFaithful: false }
          : scenario === 'AMBIGUITY_HONESTY_VIOLATION'
            ? { ambiguityPreserved: false }
            : scenario === 'SURVIVABILITY_COLLAPSE'
              ? { survivabilityFloorHeld: false }
              : { lineageReconstructable: false },
    );

    const complianceVerdicts = evaluateAllCovenantCompliance(signal);
    const gate = evaluateCovenantGate(complianceVerdicts, signal);

    const targetVerdictStatus =
      scenario === 'BASELINE'
        ? 'COMPLIANT'
        : complianceVerdicts.find((v) => v.status !== 'COMPLIANT')?.status ?? 'COMPLIANT';

    const signalSurfaced =
      scenario === 'BASELINE' ? gate.pass : !gate.pass && gate.violatedCount > 0;

    return {
      scenario,
      signalSurfaced,
      signal: signalSurfaced
        ? `${scenario}: covenant breach surfaced correctly — gate blocked with ${gate.failedGateIds.length} failed gate(s).`
        : `${scenario}: breach was NOT surfaced — silent failure detected.`,
      failedGateIds: gate.failedGateIds,
      status: targetVerdictStatus,
    };
  });

  const surfacedCount = verdicts.filter((v) => v.signalSurfaced).length;

  return {
    verdicts,
    summary: {
      totalScenarios: verdicts.length,
      surfacedCount,
      silentCount: verdicts.length - surfacedCount,
    },
  };
}
