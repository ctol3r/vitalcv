/**
 * replayEvidencePacket.ts — W2-PR40A
 *
 * Composes a regulator-readable evidence packet from a replay-engine
 * AuditBundle plus an optional NCQA export manifest. The packet is what we
 * hand a regulator: it asserts that every replay in the bundle was checked
 * for hash integrity, what tenant scope was enforced, and which audit-event
 * lineage backs each decision.
 *
 * This module is a pure transform — no prisma, no fetches, no audit writes.
 * It does NOT re-run any replay; it consumes already-built replay output.
 *
 * Why a separate "evidence packet" wrapper around the AuditBundle?
 *   - Regulators want a single document with a regulator-readable verdict
 *     (`PACKET_INTEGRITY_VERDICT`) at the top — not a raw bundle.
 *   - The packet binds NCQA-section traceability onto each replay.
 *   - The packet preserves chain-of-custody from bundle → packet so that
 *     a partial bundle (some replays failed) is loud, not silent.
 */
import { sha256ForPayload } from '../../../utils/deterministic';
import type { AuditBundle, DecisionReplay } from '../replayEngine';
import {
  mapAuditEventToStandards,
  type RegulatoryStandardReference,
} from './regulatoryTraceability';
import type { NcqaExportManifest } from './ncqaExportManifest';

const SCHEMA = 'vitalcv.replay-evidence-packet.v1' as const;

export type ReplayPacketIntegrityVerdict =
  | 'CLEAN'
  | 'PARTIAL_WITH_FAILURES'
  | 'TAMPER_DETECTED'
  | 'AMBIGUOUS_NO_REPLAYS';

export interface ReplayLineageEntry {
  capsuleId: string;
  decisionTimestamp: string;
  decisionOutcome: string;
  hashMatch: boolean;
  tamperEvidence: string | null;
  /** R-CAT classification from runtime trust cohesion. */
  replayCategory: string;
  /** NCQA section this replay supports. */
  ncqaSection: RegulatoryStandardReference;
  /** SHA-256 of the canonical replay payload — included in the packet body
   *  so regulators can re-hash any single replay independently. */
  replayPayloadHash: string;
  tenantIsolationVerdict: string;
}

export interface ReplayCustodyEntry {
  event: string;
  timestamp: string;
  actor: string;
  /** True when the event indicates a replay failure (REPLAY_FAILED:*). */
  isFailure: boolean;
}

export interface ReplayEvidencePacket {
  schema: typeof SCHEMA;
  packetId: string;
  generatedAt: string;
  subject: { npi: string; did: string };
  bundleReference: {
    bundleId: string;
    bundleHash: string;
    bundleSchema: AuditBundle['schema'];
  };
  integrity: {
    verdict: ReplayPacketIntegrityVerdict;
    replaysIncluded: number;
    replaysWithTamper: number;
    failuresInCustody: number;
    /** Verbatim copy of the bundle's verification instructions so the packet
     *  is self-contained for a regulator. */
    verificationInstructions: AuditBundle['verificationInstructions'];
  };
  lineage: ReplayLineageEntry[];
  custody: ReplayCustodyEntry[];
  /** When an NCQA manifest was supplied, its hash + manifestId are bound in
   *  so a regulator can verify the packet → manifest cross-reference. */
  ncqaManifestReference: { manifestId: string; manifestHash: string } | null;
  packetHash: string;
}

function classifyVerdict(input: {
  replays: DecisionReplay[];
  failureCount: number;
}): ReplayPacketIntegrityVerdict {
  if (input.replays.length === 0 && input.failureCount === 0) {
    return 'AMBIGUOUS_NO_REPLAYS';
  }
  const tampered = input.replays.filter((r) => r.integrity.hashMatch === false);
  if (tampered.length > 0) {
    return 'TAMPER_DETECTED';
  }
  if (input.failureCount > 0) {
    return 'PARTIAL_WITH_FAILURES';
  }
  return 'CLEAN';
}

function ncqaSectionForReplay(replay: DecisionReplay): RegulatoryStandardReference {
  // A decision capsule maps to NCQA CR 5 by default; specific decision types
  // (HIRING, RECREDENTIALING, etc.) all roll up under CR 5 unless we have a
  // more specific element in the future.
  const trace = mapAuditEventToStandards({ auditEventType: 'BUNDLE_GENERATED' });
  // Decision-level lineage anchors at CR 5; map there explicitly.
  return (
    mapAuditEventToStandards({ auditEventType: 'EMPLOYER_REVIEW_ACCEPTED' }).standards.find(
      (s) => s.standardId === 'NCQA_CR_5_CREDENTIALING_COMMITTEE',
    ) ?? trace.standards[0]
  );
}

function hashReplayPayload(replay: DecisionReplay): string {
  // Hash the replay body excluding the volatile `replayedAt`/`replayMetadata`
  // so the same evidence at two different export times produces the same hash.
  const stable = {
    capsuleId: replay.capsuleId,
    subjectNpi: replay.subjectNpi,
    subjectDid: replay.subjectDid,
    decisionType: replay.decisionType,
    decisionTimestamp: replay.decisionTimestamp,
    status: replay.status,
    decision: replay.decision,
    verifierIdentity: replay.verifierIdentity,
    evidenceSnapshot: replay.evidenceSnapshot,
    integrity: {
      storedHash: replay.integrity.storedHash,
      recomputedHash: replay.integrity.recomputedHash,
      hashMatch: replay.integrity.hashMatch,
      methodology: replay.integrity.methodology,
      methodologyVersion: replay.integrity.methodologyVersion,
      tamperEvidence: replay.integrity.tamperEvidence,
    },
    authorityChain: replay.authorityChain,
    relatedDecisions: replay.relatedDecisions,
    tenantScope: replay.tenantScope,
  };
  return sha256ForPayload(stable);
}

export interface BuildReplayEvidencePacketInput {
  packetId: string;
  generatedAt: string;
  bundle: AuditBundle;
  ncqaManifest?: NcqaExportManifest | null;
}

export function buildReplayEvidencePacket(
  input: BuildReplayEvidencePacketInput,
): ReplayEvidencePacket {
  const { bundle } = input;

  const lineage: ReplayLineageEntry[] = bundle.replays.map((replay) => ({
    capsuleId: replay.capsuleId,
    decisionTimestamp: replay.decisionTimestamp,
    decisionOutcome: replay.status,
    hashMatch: replay.integrity.hashMatch,
    tamperEvidence: replay.integrity.tamperEvidence,
    replayCategory: replay.replayMetadata.replayCategory,
    ncqaSection: ncqaSectionForReplay(replay),
    replayPayloadHash: hashReplayPayload(replay),
    tenantIsolationVerdict: replay.tenantScope.isolationVerdict,
  }));

  const custody: ReplayCustodyEntry[] = bundle.custodyLog.map((entry) => ({
    event: entry.event,
    timestamp: entry.timestamp,
    actor: entry.actor,
    isFailure: entry.event.startsWith('REPLAY_FAILED:'),
  }));

  const failureCount = custody.filter((c) => c.isFailure).length;
  const verdict = classifyVerdict({ replays: bundle.replays, failureCount });
  const replaysWithTamper = lineage.filter((l) => l.hashMatch === false).length;

  // Deterministic ordering on lineage by capsuleId, custody as-emitted (the
  // bundle already records them in temporal order).
  lineage.sort((a, b) => a.capsuleId.localeCompare(b.capsuleId));

  const ncqaManifestReference = input.ncqaManifest
    ? {
        manifestId: input.ncqaManifest.manifestId,
        manifestHash: input.ncqaManifest.manifestHash,
      }
    : null;

  const body = {
    schema: SCHEMA,
    packetId: input.packetId,
    generatedAt: input.generatedAt,
    subject: bundle.subject,
    bundleReference: {
      bundleId: bundle.bundleId,
      bundleHash: bundle.bundleHash,
      bundleSchema: bundle.schema,
    },
    integrity: {
      verdict,
      replaysIncluded: bundle.replays.length,
      replaysWithTamper,
      failuresInCustody: failureCount,
      verificationInstructions: bundle.verificationInstructions,
    },
    lineage,
    custody,
    ncqaManifestReference,
  };

  return {
    ...body,
    packetHash: sha256ForPayload(body),
  };
}

export const REPLAY_EVIDENCE_PACKET_SCHEMA = SCHEMA;
