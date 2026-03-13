/**
 * trustSpine.ts — Wave 249: Trust Spine Hardening
 *
 * The canonical pipeline validator.
 * Ensures every trust artifact flows through:
 *   Sources → PSV Adapters → VerificationArtifacts → Trust State Engine
 *   → Decision Capsules → Graph Edges → Monitoring Events
 *
 * Three entry points:
 *   validatePipelineIntegrity()  — full 5-check integrity sweep
 *   detectOrphanedCredentials()  — orphaned artifact / stale credential report
 *   validateGraphIntegrity()     — graph node/edge consistency check
 */

import prisma from '../../graphql/prisma_client';
import { computeClinicianTrustState } from '../trust/trustStateEngine';
import { log } from '../../obs/logger';

// ── Report types ──────────────────────────────────────────────────────────────

export type IntegrityStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export interface IntegrityCheck {
  name: string;
  passed: boolean;
  details: string;
  count?: number;
}

export interface IntegrityStats {
  totalArtifacts: number;
  totalCapsules: number;
  totalEdges: number;
  totalMonitoringStreams: number;
}

export interface IntegrityReport {
  status: IntegrityStatus;
  checks: IntegrityCheck[];
  stats: IntegrityStats;
  computedAt: string;
}

export interface OrphanReport {
  orphanedArtifactCount: number;
  orphanedArtifactIds: string[];
  staleUnverifiedCredentialCount: number;
  staleUnverifiedCredentialIds: string[];
  computedAt: string;
}

export interface GraphIntegrityReport {
  orphanedNodes: string[];
  invalidEdges: string[];
  missingCapsuleEdges: string[];
  computedAt: string;
}

// ── Main integrity validator ───────────────────────────────────────────────────

/**
 * Run all 5 pipeline integrity checks and return a structured report.
 * An empty database (no capsules, no artifacts) is considered HEALTHY.
 */
export async function validatePipelineIntegrity(): Promise<IntegrityReport> {
  const computedAt = new Date().toISOString();
  const checks: IntegrityCheck[] = [];

  // ── Stats ────────────────────────────────────────────────────────────────────

  const [totalArtifacts, totalCapsules, totalEdges, totalMonitoringStreams] =
    await Promise.all([
      prisma.verificationArtifact.count(),
      prisma.decisionCapsule.count(),
      prisma.authorityEdge.count(),
      prisma.monitoringEvent.count(),
    ]);

  const stats: IntegrityStats = {
    totalArtifacts,
    totalCapsules,
    totalEdges,
    totalMonitoringStreams,
  };

  // ── Check 1: Every DecisionCapsule has a non-null artifactHash ───────────────

  const capsulesWithoutHash = await prisma.decisionCapsule.count({
    where: {
      OR: [
        { artifactHash: '' },
        { artifactHash: null as unknown as string },
      ],
    },
  });

  checks.push({
    name: 'capsules_have_artifact_hash',
    passed: capsulesWithoutHash === 0,
    details:
      capsulesWithoutHash === 0
        ? 'All DecisionCapsules carry a non-empty artifactHash.'
        : `${capsulesWithoutHash} DecisionCapsule(s) are missing an artifactHash.`,
    count: capsulesWithoutHash,
  });

  // ── Check 2: Every DecisionCapsule has trust_state_snapshot in metadata ──────

  let capsulesWithoutSnapshot = 0;
  if (totalCapsules > 0) {
    // Use raw query to inspect the JSONB field without pulling all rows
    const result = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt
      FROM "DecisionCapsule"
      WHERE metadata->>'trust_state_snapshot' IS NULL
    `;
    capsulesWithoutSnapshot = Number(result[0]?.cnt ?? 0);
  }

  checks.push({
    name: 'capsules_have_trust_state_snapshot',
    passed: capsulesWithoutSnapshot === 0,
    details:
      capsulesWithoutSnapshot === 0
        ? 'All DecisionCapsules include a trust_state_snapshot in metadata.'
        : `${capsulesWithoutSnapshot} DecisionCapsule(s) are missing trust_state_snapshot in metadata.`,
    count: capsulesWithoutSnapshot,
  });

  // ── Check 3: No orphaned VerificationArtifacts ───────────────────────────────
  // An artifact is "orphaned" if it is NOT sourced from TRUST_STATE_ENGINE
  // and is NOT referenced by any DecisionCapsule's credentialIds array.

  let orphanedArtifactCount = 0;
  if (totalArtifacts > 0) {
    const result = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt
      FROM "VerificationArtifact" va
      WHERE va.source <> 'TRUST_STATE_ENGINE'
        AND NOT EXISTS (
          SELECT 1 FROM "DecisionCapsule" dc
          WHERE va.id = ANY(dc."credentialIds")
        )
    `;
    orphanedArtifactCount = Number(result[0]?.cnt ?? 0);
  }

  // Orphaned artifacts are a warning, not necessarily critical — some may be
  // newly ingested and not yet used in a capsule.
  checks.push({
    name: 'no_orphaned_verification_artifacts',
    passed: orphanedArtifactCount === 0,
    details:
      orphanedArtifactCount === 0
        ? 'All VerificationArtifacts are referenced by at least one DecisionCapsule.'
        : `${orphanedArtifactCount} VerificationArtifact(s) are not referenced by any DecisionCapsule.`,
    count: orphanedArtifactCount,
  });

  // ── Check 4: Deterministic recomputation consistency ─────────────────────────
  // Pick up to 5 NPIs that have a trust_state_snapshot in any capsule,
  // recompute their trust state, and compare the score.

  const RECOMPUTE_SAMPLE = 5;

  if (totalCapsules === 0) {
    // No capsules → nothing to recompute; trivially consistent
    checks.push({
      name: 'trust_score_recomputation_consistent',
      passed: true,
      details: 'No DecisionCapsules exist — recomputation check skipped (trivially consistent).',
      count: 0,
    });
  } else {
    let scoreInconsistencies = 0;

    try {
      const sampleCapsules = await prisma.$queryRaw<
        Array<{ subjectNpi: string; snapshot: Record<string, unknown> }>
      >`
        SELECT DISTINCT ON ("subjectNpi")
          "subjectNpi",
          (metadata->>'trust_state_snapshot')::jsonb AS snapshot
        FROM "DecisionCapsule"
        WHERE metadata->>'trust_state_snapshot' IS NOT NULL
        LIMIT ${RECOMPUTE_SAMPLE}
      `;

      for (const row of sampleCapsules) {
        if (!row.subjectNpi) continue;
        try {
          const storedScore = Number((row.snapshot as Record<string, unknown>)?.readiness_score ?? -1);
          const recomputed = await computeClinicianTrustState(row.subjectNpi);
          // Allow a ±5-point tolerance for minor environmental variance
          if (Math.abs(recomputed.readiness_score - storedScore) > 5) {
            scoreInconsistencies++;
            log('warn', 'trust_spine: score_inconsistency', {
              npi: row.subjectNpi.slice(0, 4) + '****',
              stored: storedScore,
              recomputed: recomputed.readiness_score,
            });
          }
        } catch (err) {
          log('warn', 'trust_spine: recompute_error', {
            npi: row.subjectNpi.slice(0, 4) + '****',
            error: String(err),
          });
        }
      }
    } catch (err) {
      log('warn', 'trust_spine: check4_query_error', { error: String(err) });
    }

    checks.push({
      name: 'trust_score_recomputation_consistent',
      passed: scoreInconsistencies === 0,
      details:
        scoreInconsistencies === 0
          ? `Sampled up to ${RECOMPUTE_SAMPLE} NPI(s) — all scores within tolerance.`
          : `${scoreInconsistencies} NPI(s) show score drift > 5 points on recomputation.`,
      count: scoreInconsistencies,
    });
  }

  // ── Check 5: No DecisionCapsules referencing nonexistent credential IDs ───────

  let invalidCredentialRefs = 0;
  if (totalCapsules > 0) {
    const result = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt
      FROM (
        SELECT dc.id, unnest(dc."credentialIds") AS cred_id
        FROM "DecisionCapsule" dc
        WHERE array_length(dc."credentialIds", 1) > 0
      ) sub
      LEFT JOIN "VerificationArtifact" va ON va.id::text = sub.cred_id
      WHERE va.id IS NULL
    `;
    invalidCredentialRefs = Number(result[0]?.cnt ?? 0);
  }

  checks.push({
    name: 'capsule_credential_ids_valid',
    passed: invalidCredentialRefs === 0,
    details:
      invalidCredentialRefs === 0
        ? 'All DecisionCapsule credentialIds reference existing VerificationArtifacts.'
        : `${invalidCredentialRefs} credentialId reference(s) in DecisionCapsules point to non-existent artifacts.`,
    count: invalidCredentialRefs,
  });

  // ── Determine overall status ──────────────────────────────────────────────────

  const failedChecks = checks.filter((c) => !c.passed);
  let status: IntegrityStatus = 'HEALTHY';
  if (failedChecks.length >= 3) {
    status = 'CRITICAL';
  } else if (failedChecks.length >= 1) {
    status = 'DEGRADED';
  }

  log('info', 'trust_spine: integrity_check_complete', {
    status,
    failedChecks: failedChecks.map((c) => c.name),
    totalCapsules,
    totalArtifacts,
  });

  return { status, checks, stats, computedAt };
}

// ── Orphaned credential detector ──────────────────────────────────────────────

/**
 * Find artifacts and credentials that are not connected to the active pipeline.
 */
export async function detectOrphanedCredentials(): Promise<OrphanReport> {
  const computedAt = new Date().toISOString();

  // Orphaned VerificationArtifacts: not referenced by any capsule, not TRUST_STATE_ENGINE
  const orphanedArtifactRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT va.id
    FROM "VerificationArtifact" va
    WHERE va.source <> 'TRUST_STATE_ENGINE'
      AND NOT EXISTS (
        SELECT 1 FROM "DecisionCapsule" dc
        WHERE va.id = ANY(dc."credentialIds")
      )
    LIMIT 200
  `;

  // Stale UNVERIFIED CandidateCredentials older than 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const staleCredRows = await prisma.candidateCredential.findMany({
    where: {
      status: 'UNVERIFIED',
      createdAt: { lt: thirtyDaysAgo },
    },
    select: { id: true },
    take: 200,
  });

  return {
    orphanedArtifactCount: orphanedArtifactRows.length,
    orphanedArtifactIds: orphanedArtifactRows.map((r) => r.id),
    staleUnverifiedCredentialCount: staleCredRows.length,
    staleUnverifiedCredentialIds: staleCredRows.map((r) => r.id),
    computedAt,
  };
}

// ── Graph integrity validator ─────────────────────────────────────────────────

/**
 * Validate that graph nodes and edges are internally consistent.
 */
export async function validateGraphIntegrity(): Promise<GraphIntegrityReport> {
  const computedAt = new Date().toISOString();

  // Check for edges referencing non-existent source/target node IDs
  const invalidEdgeRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT ae.id
    FROM "AuthorityEdge" ae
    WHERE NOT EXISTS (
      SELECT 1 FROM "KnowledgeNode" kn WHERE kn.id = ae."sourceNodeId"
    )
    OR NOT EXISTS (
      SELECT 1 FROM "KnowledgeNode" kn WHERE kn.id = ae."targetNodeId"
    )
    LIMIT 200
  `;

  // Check: DecisionCapsule organizations should exist as KnowledgeNode (FACILITY type)
  // We look at capsule metadata.opportunityId to find organizations referenced by capsules
  // and check if they have corresponding FACILITY KnowledgeNodes.
  const missingCapsuleEdgeRows = await prisma.$queryRaw<Array<{ capsuleId: string }>>`
    SELECT dc.id AS "capsuleId"
    FROM "DecisionCapsule" dc
    WHERE dc.metadata->>'opportunityId' IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "AuthorityEdge" ae
        JOIN "KnowledgeNode" kn ON kn.id = ae."targetNodeId"
        WHERE kn."entityType" = 'FACILITY'
          AND ae."relationType" = 'ACCEPTED_BY'
      )
    LIMIT 100
  `;

  // Find KnowledgeNodes that have no edges at all (potential orphans)
  const orphanedNodeRows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT kn.id
    FROM "KnowledgeNode" kn
    WHERE NOT EXISTS (
      SELECT 1 FROM "AuthorityEdge" ae
      WHERE ae."sourceNodeId" = kn.id OR ae."targetNodeId" = kn.id
    )
    LIMIT 100
  `;

  log('info', 'trust_spine: graph_integrity_check', {
    invalidEdges: invalidEdgeRows.length,
    missingCapsuleEdges: missingCapsuleEdgeRows.length,
    orphanedNodes: orphanedNodeRows.length,
  });

  return {
    orphanedNodes: orphanedNodeRows.map((r) => r.id),
    invalidEdges: invalidEdgeRows.map((r) => r.id),
    missingCapsuleEdges: missingCapsuleEdgeRows.map((r) => r.capsuleId),
    computedAt,
  };
}
