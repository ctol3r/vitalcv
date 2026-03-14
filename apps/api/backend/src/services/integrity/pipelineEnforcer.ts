/**
 * pipelineEnforcer.ts — Wave 249: Trust Spine Hardening
 *
 * Middleware/guards that enforce the canonical pipeline order:
 *   Sources → PSV Adapters → VerificationArtifacts
 *     → Trust State Engine → Decision Capsules
 *       → Graph Edges → Monitoring Events
 *
 * Exported guards:
 *   ensureTrustStateBeforeCapsule(npi)    — ensures fresh trust state before capsule creation
 *   ensureArtifactHashOnCapsule(capsule)  — validates artifactHash format
 *   ensureGraphEdgesForCapsule(...)       — self-healing ACCEPTED_BY edge creation
 */

import prisma from '../../graphql/prisma_client';
import {
  getCachedTrustState,
  refreshTrustState,
  type ClinicianTrustState,
} from '../trust/trustStateEngine';
import { ensureDecisionCapsuleAuthorityGraph } from '../revocation/authorityGraph';
import { appendAuditEvent } from '../audit/auditLedger';
import { log } from '../../obs/logger';
import type { DecisionCapsuleRecord } from '../decision/capsuleEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

/** A trust state must have been computed within this window to be considered fresh. */
const FRESHNESS_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Expected format for artifactHash: 64-character lowercase hex (SHA-256). */
const ARTIFACT_HASH_REGEX = /^[0-9a-f]{64}$/i;

// ── Guard 1: Ensure trust state exists before capsule creation ────────────────

/**
 * Returns a fresh ClinicianTrustState for `npi`, computing one if the
 * cached state is older than 1 hour. This is the pipeline gate that must
 * be called before creating any DecisionCapsule.
 *
 * Callers should await this and include the result in capsule metadata as
 * `trust_state_snapshot`.
 */
export async function ensureTrustStateBeforeCapsule(
  npi: string,
): Promise<ClinicianTrustState> {
  // 1. Check for a recent cached state
  const cached = await getCachedTrustState(npi);

  if (cached) {
    const age = Date.now() - new Date(cached.computedAt).getTime();
    if (age <= FRESHNESS_WINDOW_MS) {
      log('debug', 'pipeline_enforcer: using_cached_trust_state', {
        npi: npi.slice(0, 4) + '****',
        ageMs: age,
      });
      return cached;
    }
  }

  // 2. Stale or missing — recompute via refreshTrustState (persists to DB)
  log('info', 'pipeline_enforcer: refreshing_trust_state', {
    npi: npi.slice(0, 4) + '****',
    reason: cached ? 'stale' : 'missing',
  });

  const fresh = await refreshTrustState(npi);

  appendAuditEvent({
    category: 'TRUST_STATE_CHANGE',
    severity: 'INFO',
    actor: 'pipeline_enforcer',
    resource: `trust-state:${npi}`,
    requestFields: { npi: npi.slice(0, 4) + '****', trigger: 'ensureTrustStateBeforeCapsule' },
    resultFields: {
      trustBand: fresh.readiness_level,
      trustScore: fresh.readiness_score,
      computedAt: fresh.computedAt,
    },
  });

  return fresh;
}

// ── Guard 2: Validate artifactHash format ─────────────────────────────────────

/**
 * Validates that a DecisionCapsule carries a non-empty, properly-formed
 * SHA-256 artifactHash (64 lowercase hex characters).
 *
 * Returns `true` if valid, `false` otherwise.
 */
export function ensureArtifactHashOnCapsule(capsule: DecisionCapsuleRecord): boolean {
  if (!capsule.artifactHash || capsule.artifactHash.trim() === '') {
    log('warn', 'pipeline_enforcer: missing_artifact_hash', { capsuleId: capsule.id });
    return false;
  }

  if (!ARTIFACT_HASH_REGEX.test(capsule.artifactHash)) {
    log('warn', 'pipeline_enforcer: invalid_artifact_hash_format', {
      capsuleId: capsule.id,
      hash: capsule.artifactHash.slice(0, 16) + '…',
    });
    return false;
  }

  return true;
}

// ── Guard 3: Ensure ACCEPTED_BY graph edge exists after capsule creation ──────

/**
 * After a DecisionCapsule is created, ensures that a corresponding
 * ACCEPTED_BY edge exists in the KnowledgeNode/AuthorityEdge graph.
 *
 * This is self-healing: if the edge is missing it will be created.
 * The function is non-fatal — errors are logged but not re-thrown.
 *
 * @param capsuleId  The DecisionCapsule.id
 * @param npi        The clinician NPI (used to find the CLINICIAN KnowledgeNode)
 */
export async function ensureGraphEdgesForCapsule(
  capsuleId: string,
  npi: string,
): Promise<void> {
  try {
    // Look up the capsule to find its organization context
    const capsule = await prisma.decisionCapsule.findUnique({
      where: { id: capsuleId },
      select: { metadata: true, subjectNpi: true, decisionType: true },
    });

    if (!capsule) {
      log('warn', 'pipeline_enforcer: capsule_not_found_for_graph_edge', { capsuleId });
      return;
    }

    await ensureDecisionCapsuleAuthorityGraph(capsuleId);

    const meta = capsule.metadata as Record<string, unknown> | null;
    const opportunityId = meta?.opportunityId as string | undefined;

    // If there's no opportunity, we can't determine the target org — skip silently
    if (!opportunityId) {
      return;
    }

    // Look up the opportunity to find the employer/organization
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { organizationId: true, title: true },
    }).catch(() => null);

    if (!opportunity?.organizationId) {
      return;
    }

    const orgId = opportunity.organizationId;

    // ── Ensure source KnowledgeNode for clinician ─────────────────────────────

    const clinicianNode = await prisma.knowledgeNode.upsert({
      where: { entityType_entityId: { entityType: 'CLINICIAN', entityId: npi } },
      create: {
        entityType: 'CLINICIAN',
        entityId: npi,
        label: `Clinician NPI:${npi}`,
        attributes: {},
      },
      update: {},
    });

    // ── Ensure target KnowledgeNode for facility/org ──────────────────────────

    const facilityNode = await prisma.knowledgeNode.upsert({
      where: { entityType_entityId: { entityType: 'FACILITY', entityId: orgId } },
      create: {
        entityType: 'FACILITY',
        entityId: orgId,
        label: opportunity.title ?? `Org:${orgId}`,
        attributes: { opportunityId },
      },
      update: {},
    });

    // ── Ensure ACCEPTED_BY edge between them ──────────────────────────────────

    const existingEdge = await prisma.authorityEdge.findFirst({
      where: {
        sourceNodeId: clinicianNode.id,
        targetNodeId: facilityNode.id,
        relationType: 'ACCEPTED_BY',
      },
    });

    if (!existingEdge) {
      await prisma.authorityEdge.create({
        data: {
          sourceNodeId: clinicianNode.id,
          targetNodeId: facilityNode.id,
          relationType: 'ACCEPTED_BY',
          weight: 1.0,
          metadata: {
            capsuleId,
            decisionType: capsule.decisionType,
            createdBy: 'pipeline_enforcer',
          },
        },
      });

      log('info', 'pipeline_enforcer: created_accepted_by_edge', {
        capsuleId,
        npi: npi.slice(0, 4) + '****',
        orgId,
        clinicianNodeId: clinicianNode.id,
        facilityNodeId: facilityNode.id,
      });
    }
  } catch (err) {
    // Non-fatal: graph edge creation is best-effort
    log('warn', 'pipeline_enforcer: graph_edge_error', {
      capsuleId,
      npi: npi.slice(0, 4) + '****',
      error: String(err),
    });
  }
}
