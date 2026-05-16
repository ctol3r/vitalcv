/**
 * canonicalChainIntegrity.ts — Canonical Audit-Chain Integrity Validator
 *
 * Composes the six integrity axes that govern whether the audit chain holds:
 *
 *   1. Replay lineage continuity     — corruption lineage digests are
 *      deterministic and reconstructable from quarantine records.
 *   2. Chronology determinism        — per-traceId audit-event time is
 *      monotonically non-decreasing; per (subjectNpi, decisionType) capsule
 *      timestamps do not collide.
 *   3. Issuer continuity             — credentialId → issuerId mapping is
 *      stable across every capsule that references the credential.
 *   4. Attribution continuity        — a capsule's verifierIdentity and any
 *      audit-event actor recorded against that capsule agree, and a traceId
 *      retains its initiating actor across the event stream.
 *   5. Degraded restoration continuity — a replay restored from a prior
 *      degraded state preserves its containment digest unless a structural
 *      restoration is recorded.
 *   6. Replay chain inspectability    — every replay carries the surfaces a
 *      third party needs to verify: containment record, authority chain,
 *      integrity check, verifier identity.
 *
 * Pure transform — no fetches, no DB writes, no audit-event writes. Same
 * inputs → same outputs. Companion to replayCorruptionContainment.ts and
 * mergeVerification.ts: replayCorruptionContainment owns per-replay quarantine
 * verdicts, mergeVerification owns activation-merge gating, and this module
 * owns the cross-population integrity surface.
 */

import { sha256ForPayload } from '../../utils/deterministic';
import {
  traceCorruptionLineage,
  type ReplayQuarantineRecord,
  type LineageHints,
} from './replayCorruptionContainment';

// ── Sentinels ─────────────────────────────────────────────────────────────────

const SCHEMA = 'vitalcv.canonical-audit-chain-integrity.v1' as const;

export type ChainIntegrityVerdict =
  | 'INTACT'           // every axis passes
  | 'DEGRADED'         // at least one axis is DEGRADED but none FAIL
  | 'BROKEN'           // at least one axis FAIL
  | 'INCONCLUSIVE';    // every axis is INSUFFICIENT_EVIDENCE

export type AxisStatus = 'PASS' | 'DEGRADED' | 'FAIL' | 'INSUFFICIENT_EVIDENCE';

export type ChainIntegrityAxis =
  | 'REPLAY_LINEAGE'
  | 'CHRONOLOGY'
  | 'ISSUER_CONTINUITY'
  | 'ATTRIBUTION_CONTINUITY'
  | 'DEGRADED_RESTORATION'
  | 'INSPECTABILITY';

export type ChainIntegrityViolationKind =
  | 'LINEAGE_DIGEST_NON_DETERMINISTIC'
  | 'TRACE_TIMESTAMP_REGRESSION'
  | 'CAPSULE_TIMESTAMP_COLLISION'
  | 'ISSUER_BINDING_CONFLICT'
  | 'ATTRIBUTION_ACTOR_DRIFT'
  | 'ATTRIBUTION_VERIFIER_MISMATCH'
  | 'RESTORATION_DIGEST_DIVERGENCE'
  | 'RESTORATION_FORCED_CLEAN'
  | 'INSPECTABILITY_FIELD_MISSING';

export const KNOWN_CHAIN_INTEGRITY_AXES = Object.freeze([
  'REPLAY_LINEAGE',
  'CHRONOLOGY',
  'ISSUER_CONTINUITY',
  'ATTRIBUTION_CONTINUITY',
  'DEGRADED_RESTORATION',
  'INSPECTABILITY',
] as const satisfies ChainIntegrityAxis[]);

export const KNOWN_CHAIN_INTEGRITY_VIOLATIONS = Object.freeze([
  'LINEAGE_DIGEST_NON_DETERMINISTIC',
  'TRACE_TIMESTAMP_REGRESSION',
  'CAPSULE_TIMESTAMP_COLLISION',
  'ISSUER_BINDING_CONFLICT',
  'ATTRIBUTION_ACTOR_DRIFT',
  'ATTRIBUTION_VERIFIER_MISMATCH',
  'RESTORATION_DIGEST_DIVERGENCE',
  'RESTORATION_FORCED_CLEAN',
  'INSPECTABILITY_FIELD_MISSING',
] as const satisfies ChainIntegrityViolationKind[]);

// ── Input types ────────────────────────────────────────────────────────────────

/**
 * The narrow replay shape this validator consumes. Mirrors the load-bearing
 * fields of replayEngine.ts:DecisionReplay so call sites can pass a replay
 * directly, but keeps the dependency one-way: this module never imports from
 * replayEngine.ts.
 */
export interface ChainIntegrityReplayInput {
  capsuleId: string;
  subjectNpi: string;
  decisionType: string;
  decisionTimestamp: string;          // ISO-8601
  issuerIds: ReadonlyArray<string>;
  credentialIds: ReadonlyArray<string>;
  verifierIdentity: {
    type: 'SYSTEM' | 'ORGANIZATION' | 'HUMAN' | 'AI_AGENT';
    systemId: string;
    orgId: string | null;
    userId: string | null;
  };
  integrity: {
    storedHash: string;
    recomputedHash: string;
    hashMatch: boolean;
  };
  /** Quarantine record from replayCorruptionContainment. */
  containment: ReplayQuarantineRecord;
  /** Minimal shape — only need node-type coverage for inspectability. */
  authorityChain: ReadonlyArray<{
    position: number;
    nodeType: 'CLINICIAN' | 'CREDENTIAL' | 'ISSUER' | 'VERIFIER' | 'DECISION';
    id: string;
  }>;
}

/**
 * Narrow audit-event shape — load-bearing fields of auditLedger.ts:AuditEntry.
 */
export interface ChainIntegrityAuditEvent {
  eventId: string;
  time: string;                       // ISO-8601
  traceId: string;
  actor: string;
  resource: string;
  receiptHash: string;
}

/**
 * Pre-degradation snapshot for the degraded-restoration axis. Each entry pins
 * a capsule's quarantine state at a prior moment so the validator can detect
 * digest divergence or silent clean-coercion after restoration.
 */
export interface PreDegradationSnapshot {
  capsuleId: string;
  containmentDigest: string;
  verdict: ReplayQuarantineRecord['verdict'];
  /** Set when the operator recorded an intentional structural restoration. */
  restorationRecorded: boolean;
}

export interface ValidateCanonicalChainInput {
  replays: ReadonlyArray<ChainIntegrityReplayInput>;
  /** Optional — chronology axis becomes INSUFFICIENT_EVIDENCE without events. */
  auditEvents?: ReadonlyArray<ChainIntegrityAuditEvent>;
  /** Optional — degraded-restoration axis becomes INSUFFICIENT_EVIDENCE without snapshots. */
  preDegradationSnapshots?: ReadonlyArray<PreDegradationSnapshot>;
}

// ── Output types ───────────────────────────────────────────────────────────────

export interface ChainIntegrityViolation {
  axis: ChainIntegrityAxis;
  kind: ChainIntegrityViolationKind;
  capsuleId: string | null;
  message: string;
}

export interface AxisVerdict {
  axis: ChainIntegrityAxis;
  status: AxisStatus;
  evidenceCount: number;
  violationCount: number;
  reason: string;
}

export interface CanonicalChainIntegrityReport {
  schema: typeof SCHEMA;
  verdict: ChainIntegrityVerdict;
  axes: Record<ChainIntegrityAxis, AxisVerdict>;
  violations: ChainIntegrityViolation[];
  /** SHA-256 over (verdict, sorted axes, sorted violations). */
  integrityDigest: string;
  validatedAt: string;
  methodologyVersion: 'canonical-chain-integrity.v1';
}

// ── Axis 1: replay lineage continuity ─────────────────────────────────────────

function validateReplayLineage(
  replays: ReadonlyArray<ChainIntegrityReplayInput>,
): { verdict: AxisVerdict; violations: ChainIntegrityViolation[] } {
  const violations: ChainIntegrityViolation[] = [];

  const corruptRoots = replays
    .map(r => r.containment)
    .filter(c =>
      c.verdict === 'QUARANTINED'
      || c.verdict === 'AMBIGUOUS'
      || c.verdict === 'CONTAINMENT_BREACH',
    );

  const candidates = replays.map(r => ({
    capsuleId: r.capsuleId,
    hints: r.containment.lineageHints,
  }));

  if (replays.length === 0) {
    return {
      verdict: {
        axis: 'REPLAY_LINEAGE',
        status: 'INSUFFICIENT_EVIDENCE',
        evidenceCount: 0,
        violationCount: 0,
        reason: 'No replays supplied; lineage continuity cannot be evaluated.',
      },
      violations,
    };
  }

  if (corruptRoots.length === 0) {
    return {
      verdict: {
        axis: 'REPLAY_LINEAGE',
        status: 'PASS',
        evidenceCount: replays.length,
        violationCount: 0,
        reason: `No corrupt roots in ${replays.length} replay(s); lineage is vacuously intact.`,
      },
      violations,
    };
  }

  for (const root of corruptRoots) {
    const first = traceCorruptionLineage({
      rootCapsuleId: root.capsuleId,
      rootHints: root.lineageHints,
      candidates,
    });
    const second = traceCorruptionLineage({
      rootCapsuleId: root.capsuleId,
      rootHints: root.lineageHints,
      candidates,
    });
    if (first.reconstructionDigest !== second.reconstructionDigest) {
      violations.push({
        axis: 'REPLAY_LINEAGE',
        kind: 'LINEAGE_DIGEST_NON_DETERMINISTIC',
        capsuleId: root.capsuleId,
        message:
          `Lineage reconstruction non-deterministic for ${root.capsuleId}: ` +
          `${first.reconstructionDigest.slice(0, 12)}… vs ${second.reconstructionDigest.slice(0, 12)}…`,
      });
    }
  }

  const status: AxisStatus = violations.length === 0 ? 'PASS' : 'FAIL';
  return {
    verdict: {
      axis: 'REPLAY_LINEAGE',
      status,
      evidenceCount: corruptRoots.length,
      violationCount: violations.length,
      reason: status === 'PASS'
        ? `Lineage reconstructable for ${corruptRoots.length} corrupt root(s); digests stable.`
        : `Lineage digest non-deterministic on ${violations.length} root(s); chain cannot be reproduced for regulator replay.`,
    },
    violations,
  };
}

// ── Axis 2: chronology determinism ────────────────────────────────────────────

function validateChronology(
  replays: ReadonlyArray<ChainIntegrityReplayInput>,
  auditEvents: ReadonlyArray<ChainIntegrityAuditEvent> | undefined,
): { verdict: AxisVerdict; violations: ChainIntegrityViolation[] } {
  const violations: ChainIntegrityViolation[] = [];

  // Per-traceId monotonic time check.
  let traceEvidence = 0;
  if (auditEvents && auditEvents.length > 0) {
    const byTrace = new Map<string, ChainIntegrityAuditEvent[]>();
    for (const e of auditEvents) {
      const bucket = byTrace.get(e.traceId);
      if (bucket) bucket.push(e);
      else byTrace.set(e.traceId, [e]);
    }
    for (const [traceId, events] of byTrace) {
      // Sort by insertion order; the ledger is append-only, so insertion order
      // is the canonical sequence. We verify that `time` is non-decreasing in
      // that order — any regression is a chronology violation.
      traceEvidence += events.length;
      for (let i = 1; i < events.length; i += 1) {
        const prev = Date.parse(events[i - 1].time);
        const curr = Date.parse(events[i].time);
        if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
        if (curr < prev) {
          violations.push({
            axis: 'CHRONOLOGY',
            kind: 'TRACE_TIMESTAMP_REGRESSION',
            capsuleId: null,
            message:
              `traceId ${traceId}: event ${events[i].eventId} at ${events[i].time} ` +
              `predates prior event ${events[i - 1].eventId} at ${events[i - 1].time}.`,
          });
        }
      }
    }
  }

  // Per (subjectNpi, decisionType) timestamp collision check. Two capsules of
  // the same kind for the same subject at the same instant cannot be ordered
  // — a regulator cannot tell which decision came first.
  const tsKey = new Map<string, string>();
  for (const r of replays) {
    const key = `${r.subjectNpi}|${r.decisionType}|${r.decisionTimestamp}`;
    const prior = tsKey.get(key);
    if (prior && prior !== r.capsuleId) {
      violations.push({
        axis: 'CHRONOLOGY',
        kind: 'CAPSULE_TIMESTAMP_COLLISION',
        capsuleId: r.capsuleId,
        message:
          `Capsule ${r.capsuleId} and ${prior} share (npi=${r.subjectNpi}, type=${r.decisionType}, ` +
          `t=${r.decisionTimestamp}); cannot order deterministically.`,
      });
    } else {
      tsKey.set(key, r.capsuleId);
    }
  }

  const evidenceCount = traceEvidence + replays.length;
  let status: AxisStatus;
  if (evidenceCount === 0) {
    status = 'INSUFFICIENT_EVIDENCE';
  } else if (violations.length === 0) {
    status = 'PASS';
  } else if (auditEvents === undefined || auditEvents.length === 0) {
    // Capsule collisions but no event stream — chronology is partially blind.
    status = 'DEGRADED';
  } else {
    status = 'FAIL';
  }

  return {
    verdict: {
      axis: 'CHRONOLOGY',
      status,
      evidenceCount,
      violationCount: violations.length,
      reason: status === 'INSUFFICIENT_EVIDENCE'
        ? 'No replays or audit events supplied; chronology cannot be evaluated.'
        : status === 'PASS'
          ? `Chronology monotonic across ${evidenceCount} signal(s).`
          : status === 'DEGRADED'
            ? `Chronology partially observed: ${violations.length} capsule-timestamp collision(s) without an event stream to corroborate.`
            : `Chronology violated: ${violations.length} timestamp anomaly/anomalies detected.`,
    },
    violations,
  };
}

// ── Axis 3: issuer continuity ─────────────────────────────────────────────────

function canonicalIssuerSet(issuerIds: ReadonlyArray<string>): string {
  return Array.from(new Set(issuerIds)).sort().join('|');
}

function validateIssuerContinuity(
  replays: ReadonlyArray<ChainIntegrityReplayInput>,
): { verdict: AxisVerdict; violations: ChainIntegrityViolation[] } {
  const violations: ChainIntegrityViolation[] = [];

  // Map credentialId → first capsule that bound an issuer set to it, plus the
  // canonical set. A second capsule referencing the same credentialId with a
  // different canonical issuer set is a binding conflict.
  const credentialIssuer = new Map<string, { capsuleId: string; issuers: string }>();
  let evidence = 0;

  for (const r of replays) {
    if (r.credentialIds.length === 0) continue;
    const canonical = canonicalIssuerSet(r.issuerIds);
    if (canonical === '') {
      // Capsule has credentials but no issuerIds bound — that is legal at the
      // capsule layer (replayEngine infers issuers from sources). Skip rather
      // than flag, otherwise this axis would fail on every legacy capsule.
      continue;
    }
    for (const credId of r.credentialIds) {
      evidence += 1;
      const prior = credentialIssuer.get(credId);
      if (!prior) {
        credentialIssuer.set(credId, { capsuleId: r.capsuleId, issuers: canonical });
        continue;
      }
      if (prior.issuers !== canonical) {
        violations.push({
          axis: 'ISSUER_CONTINUITY',
          kind: 'ISSUER_BINDING_CONFLICT',
          capsuleId: r.capsuleId,
          message:
            `Credential ${credId}: capsule ${r.capsuleId} binds issuers [${canonical}] ` +
            `but capsule ${prior.capsuleId} previously bound [${prior.issuers}].`,
        });
      }
    }
  }

  let status: AxisStatus;
  if (evidence === 0) {
    status = 'INSUFFICIENT_EVIDENCE';
  } else if (violations.length === 0) {
    status = 'PASS';
  } else {
    status = 'FAIL';
  }

  return {
    verdict: {
      axis: 'ISSUER_CONTINUITY',
      status,
      evidenceCount: evidence,
      violationCount: violations.length,
      reason: status === 'INSUFFICIENT_EVIDENCE'
        ? 'No capsule supplied a (credentialId, issuerIds) binding; issuer continuity cannot be evaluated.'
        : status === 'PASS'
          ? `Credential→issuer bindings stable across ${credentialIssuer.size} credential(s).`
          : `Issuer continuity broken on ${violations.length} credential binding(s).`,
    },
    violations,
  };
}

// ── Axis 4: attribution continuity ────────────────────────────────────────────

function actorFromVerifier(v: ChainIntegrityReplayInput['verifierIdentity']): string {
  // Mirrors the actor a downstream auditEvent would record for the same
  // capsule: orgId wins when present (ORGANIZATION verifiers), userId next
  // (HUMAN verifiers), systemId last (SYSTEM verifiers).
  return v.orgId ?? v.userId ?? v.systemId;
}

function validateAttributionContinuity(
  replays: ReadonlyArray<ChainIntegrityReplayInput>,
  auditEvents: ReadonlyArray<ChainIntegrityAuditEvent> | undefined,
): { verdict: AxisVerdict; violations: ChainIntegrityViolation[] } {
  const violations: ChainIntegrityViolation[] = [];

  // (a) Verifier identity in the capsule must agree with any audit-event actor
  // that names the capsule as its resource. If they disagree, the chain has
  // two different stories about who decided.
  let verifierEvidence = 0;
  if (auditEvents && auditEvents.length > 0) {
    const replayById = new Map(replays.map(r => [r.capsuleId, r]));
    for (const e of auditEvents) {
      const r = replayById.get(e.resource);
      if (!r) continue;
      verifierEvidence += 1;
      const expected = actorFromVerifier(r.verifierIdentity);
      if (expected !== e.actor) {
        violations.push({
          axis: 'ATTRIBUTION_CONTINUITY',
          kind: 'ATTRIBUTION_VERIFIER_MISMATCH',
          capsuleId: r.capsuleId,
          message:
            `Capsule ${r.capsuleId}: verifierIdentity resolves to "${expected}" ` +
            `but audit event ${e.eventId} attributes actor "${e.actor}".`,
        });
      }
    }
  }

  // (b) A traceId's initiating actor must hold throughout the trace. The first
  // event in insertion order pins the actor; any later event under the same
  // traceId with a different actor is a drift violation. (Append-only ledger
  // means insertion order is canonical; same-trace handoffs are not modeled
  // explicitly in the substrate today.)
  let traceEvidence = 0;
  if (auditEvents && auditEvents.length > 0) {
    const traceActor = new Map<string, { actor: string; eventId: string }>();
    for (const e of auditEvents) {
      traceEvidence += 1;
      const pinned = traceActor.get(e.traceId);
      if (!pinned) {
        traceActor.set(e.traceId, { actor: e.actor, eventId: e.eventId });
        continue;
      }
      if (pinned.actor !== e.actor) {
        violations.push({
          axis: 'ATTRIBUTION_CONTINUITY',
          kind: 'ATTRIBUTION_ACTOR_DRIFT',
          capsuleId: null,
          message:
            `traceId ${e.traceId}: event ${e.eventId} attributes actor "${e.actor}" but ` +
            `prior event ${pinned.eventId} pinned actor "${pinned.actor}".`,
        });
      }
    }
  }

  const evidenceCount = verifierEvidence + traceEvidence;
  let status: AxisStatus;
  if (evidenceCount === 0) {
    status = 'INSUFFICIENT_EVIDENCE';
  } else if (violations.length === 0) {
    status = 'PASS';
  } else {
    status = 'FAIL';
  }

  return {
    verdict: {
      axis: 'ATTRIBUTION_CONTINUITY',
      status,
      evidenceCount,
      violationCount: violations.length,
      reason: status === 'INSUFFICIENT_EVIDENCE'
        ? 'No audit events supplied; attribution continuity cannot be evaluated.'
        : status === 'PASS'
          ? `Attribution stable across ${verifierEvidence} capsule-event binding(s) and ${traceEvidence} traced event(s).`
          : `Attribution drift on ${violations.length} signal(s); chain has multiple stories about who acted.`,
    },
    violations,
  };
}

// ── Axis 5: degraded restoration continuity ───────────────────────────────────

function validateDegradedRestoration(
  replays: ReadonlyArray<ChainIntegrityReplayInput>,
  snapshots: ReadonlyArray<PreDegradationSnapshot> | undefined,
): { verdict: AxisVerdict; violations: ChainIntegrityViolation[] } {
  const violations: ChainIntegrityViolation[] = [];

  if (!snapshots || snapshots.length === 0) {
    return {
      verdict: {
        axis: 'DEGRADED_RESTORATION',
        status: 'INSUFFICIENT_EVIDENCE',
        evidenceCount: 0,
        violationCount: 0,
        reason: 'No pre-degradation snapshots supplied; restoration continuity cannot be evaluated.',
      },
      violations,
    };
  }

  const replayById = new Map(replays.map(r => [r.capsuleId, r]));
  let evidence = 0;

  for (const snap of snapshots) {
    const current = replayById.get(snap.capsuleId);
    if (!current) continue;
    evidence += 1;

    // A CLEAN verdict that replaces a prior corrupt verdict without an
    // operator-recorded restoration is a silent collapse: the chain forgot
    // it was degraded. Mirrors the AMBIGUOUS_QUARANTINE_FORCED_CLEAN guard
    // in replayCorruptionContainment, scaled to the population layer.
    if (
      snap.verdict !== 'CLEAN'
      && current.containment.verdict === 'CLEAN'
      && !snap.restorationRecorded
    ) {
      violations.push({
        axis: 'DEGRADED_RESTORATION',
        kind: 'RESTORATION_FORCED_CLEAN',
        capsuleId: snap.capsuleId,
        message:
          `Capsule ${snap.capsuleId}: verdict moved from ${snap.verdict} → CLEAN ` +
          `without restorationRecorded; chain silently discarded a quarantine.`,
      });
      continue;
    }

    // Same verdict on both sides — digest must be stable. A digest divergence
    // means the integrity signal mutated underneath the chain.
    if (
      snap.verdict === current.containment.verdict
      && !snap.restorationRecorded
      && snap.containmentDigest !== current.containment.containmentDigest
    ) {
      violations.push({
        axis: 'DEGRADED_RESTORATION',
        kind: 'RESTORATION_DIGEST_DIVERGENCE',
        capsuleId: snap.capsuleId,
        message:
          `Capsule ${snap.capsuleId}: verdict unchanged (${snap.verdict}) but ` +
          `containment digest drifted ${snap.containmentDigest.slice(0, 12)}… → ` +
          `${current.containment.containmentDigest.slice(0, 12)}….`,
      });
    }
  }

  let status: AxisStatus;
  if (evidence === 0) {
    status = 'INSUFFICIENT_EVIDENCE';
  } else if (violations.length === 0) {
    status = 'PASS';
  } else {
    status = 'FAIL';
  }

  return {
    verdict: {
      axis: 'DEGRADED_RESTORATION',
      status,
      evidenceCount: evidence,
      violationCount: violations.length,
      reason: status === 'INSUFFICIENT_EVIDENCE'
        ? 'No snapshot capsules matched the current replay set; restoration continuity unverified.'
        : status === 'PASS'
          ? `Restoration continuity preserved across ${evidence} snapshot(s).`
          : `Restoration broken on ${violations.length} capsule(s); chain dropped or mutated containment state.`,
    },
    violations,
  };
}

// ── Axis 6: replay chain inspectability ───────────────────────────────────────

interface InspectabilityRule {
  field: string;
  ok: (r: ChainIntegrityReplayInput) => boolean;
}

const INSPECTABILITY_RULES: ReadonlyArray<InspectabilityRule> = Object.freeze([
  { field: 'containment',
    ok: r => Boolean(r.containment) && typeof r.containment.containmentDigest === 'string'
      && r.containment.containmentDigest.length === 64 },
  { field: 'integrity.storedHash',
    ok: r => typeof r.integrity.storedHash === 'string' && r.integrity.storedHash.length > 0 },
  { field: 'verifierIdentity.systemId',
    ok: r => typeof r.verifierIdentity.systemId === 'string' && r.verifierIdentity.systemId.length > 0 },
  { field: 'authorityChain.CLINICIAN',
    ok: r => r.authorityChain.some(l => l.nodeType === 'CLINICIAN') },
  { field: 'authorityChain.DECISION',
    ok: r => r.authorityChain.some(l => l.nodeType === 'DECISION') },
]);

function validateInspectability(
  replays: ReadonlyArray<ChainIntegrityReplayInput>,
): { verdict: AxisVerdict; violations: ChainIntegrityViolation[] } {
  const violations: ChainIntegrityViolation[] = [];

  for (const r of replays) {
    for (const rule of INSPECTABILITY_RULES) {
      if (!rule.ok(r)) {
        violations.push({
          axis: 'INSPECTABILITY',
          kind: 'INSPECTABILITY_FIELD_MISSING',
          capsuleId: r.capsuleId,
          message: `Capsule ${r.capsuleId}: missing or invalid field "${rule.field}".`,
        });
      }
    }
  }

  let status: AxisStatus;
  if (replays.length === 0) {
    status = 'INSUFFICIENT_EVIDENCE';
  } else if (violations.length === 0) {
    status = 'PASS';
  } else {
    // Partial missing fields degrade the surface but do not break the chain
    // structurally — distinguish from BROKEN so the population verdict
    // surfaces this as DEGRADED.
    status = violations.length < replays.length * INSPECTABILITY_RULES.length / 2
      ? 'DEGRADED'
      : 'FAIL';
  }

  return {
    verdict: {
      axis: 'INSPECTABILITY',
      status,
      evidenceCount: replays.length,
      violationCount: violations.length,
      reason: status === 'INSUFFICIENT_EVIDENCE'
        ? 'No replays supplied; inspectability cannot be evaluated.'
        : status === 'PASS'
          ? `All ${replays.length} replay(s) carry the required inspectability surface.`
          : status === 'DEGRADED'
            ? `Inspectability degraded: ${violations.length} missing field(s) across ${replays.length} replay(s).`
            : `Inspectability broken: ${violations.length} missing field(s) — third party cannot reconstruct the chain.`,
    },
    violations,
  };
}

// ── Top-level validator ───────────────────────────────────────────────────────

function rollUpVerdict(axes: ReadonlyArray<AxisVerdict>): ChainIntegrityVerdict {
  if (axes.every(a => a.status === 'INSUFFICIENT_EVIDENCE')) return 'INCONCLUSIVE';
  if (axes.some(a => a.status === 'FAIL')) return 'BROKEN';
  if (axes.some(a => a.status === 'DEGRADED')) return 'DEGRADED';
  return 'INTACT';
}

/**
 * Validate the full canonical audit chain across six integrity axes.
 *
 * Pure transform — never throws, always produces a report. Use the report's
 * `verdict` field to gate downstream behavior; use `violations` to surface
 * actionable rows to the operator.
 */
export function validateCanonicalAuditChain(
  input: ValidateCanonicalChainInput,
): CanonicalChainIntegrityReport {
  const validatedAt = new Date().toISOString();

  const lineage      = validateReplayLineage(input.replays);
  const chronology   = validateChronology(input.replays, input.auditEvents);
  const issuer       = validateIssuerContinuity(input.replays);
  const attribution  = validateAttributionContinuity(input.replays, input.auditEvents);
  const restoration  = validateDegradedRestoration(input.replays, input.preDegradationSnapshots);
  const inspect      = validateInspectability(input.replays);

  const violations: ChainIntegrityViolation[] = [
    ...lineage.violations,
    ...chronology.violations,
    ...issuer.violations,
    ...attribution.violations,
    ...restoration.violations,
    ...inspect.violations,
  ];

  const axes: Record<ChainIntegrityAxis, AxisVerdict> = {
    REPLAY_LINEAGE:         lineage.verdict,
    CHRONOLOGY:             chronology.verdict,
    ISSUER_CONTINUITY:      issuer.verdict,
    ATTRIBUTION_CONTINUITY: attribution.verdict,
    DEGRADED_RESTORATION:   restoration.verdict,
    INSPECTABILITY:         inspect.verdict,
  };

  const verdict = rollUpVerdict(Object.values(axes));

  const integrityDigest = sha256ForPayload({
    schema: SCHEMA,
    verdict,
    axes: KNOWN_CHAIN_INTEGRITY_AXES.map(name => ({
      axis: name,
      status: axes[name].status,
      evidenceCount: axes[name].evidenceCount,
      violationCount: axes[name].violationCount,
    })),
    violations: [...violations]
      .map(v => ({ axis: v.axis, kind: v.kind, capsuleId: v.capsuleId ?? '' }))
      .sort((a, b) =>
        a.axis.localeCompare(b.axis)
        || a.kind.localeCompare(b.kind)
        || a.capsuleId.localeCompare(b.capsuleId),
      ),
  });

  return {
    schema: SCHEMA,
    verdict,
    axes,
    violations,
    integrityDigest,
    validatedAt,
    methodologyVersion: 'canonical-chain-integrity.v1',
  };
}

// ── Sentinels (re-exported for tests + CI gates) ──────────────────────────────

export const CANONICAL_CHAIN_INTEGRITY_SENTINELS = Object.freeze({
  SCHEMA,
  METHODOLOGY_VERSION: 'canonical-chain-integrity.v1' as const,
});
