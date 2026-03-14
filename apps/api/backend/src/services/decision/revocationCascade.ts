/**
 * revocationCascade.ts — Wave A (Phase 1 Hardening)
 * Salvaged from feature/interoperability-wave65 (Wave 54), upgraded for main.
 *
 * When a credential is revoked, finds all DecisionCapsules that depended
 * on it and transitions them fail-closed:
 *   VALID/AT_RISK → INVALID
 *
 * Emits audit events for every status transition, enabling blast radius
 * analysis and institutional audit replay.
 *
 * Integration point: called by continuousMonitor.ts on every revocation sweep.
 */

import prisma from '../../graphql/prisma_client';
import {
  propagateCredentialLifecycleChange,
  type PropagationResult as CascadeResult,
} from '../revocation/propagationEngine';

export type { CascadeResult };

// ── Types ─────────────────────────────────────────────────────────────────

export interface AffectedCapsule {
  capsuleId: string;
  previousStatus: string;
  newStatus: string;
  subjectNpi: string;
  decisionType: string;
}

export interface BlastRadiusResult {
  credentialId: string;
  impactedCapsules: Array<{
    id: string;
    subjectNpi: string;
    subjectDid: string;
    decisionType: string;
    status: string;
    decisionTimestamp: string;
  }>;
  impactedNpis: string[];
  impactedDecisionTypes: string[];
  totalImpacted: number;
}

// ── Cascade Logic ─────────────────────────────────────────────────────────

/**
 * Propagate a credential revocation through all dependent DecisionCapsules.
 *   VALID/AT_RISK → INVALID  (revoked dependencies fail closed)
 */
async function propagateRevocation(credentialId: string): Promise<CascadeResult> {
  return propagateCredentialLifecycleChange({
    credentialId,
    trigger: 'credential.revoked',
  });
}

/**
 * Compute blast radius WITHOUT performing cascade.
 * Read-only — safe to call for impact analysis before committing to revocation.
 */
async function computeBlastRadius(credentialId: string): Promise<BlastRadiusResult> {
  const capsules = await prisma.decisionCapsule.findMany({
    where: { credentialIds: { has: credentialId } },
    orderBy: { decisionTimestamp: 'desc' },
  });

  const impactedNpis = [...new Set(capsules.map((c) => c.subjectNpi))];
  const impactedDecisionTypes = [...new Set(capsules.map((c) => c.decisionType))];

  return {
    credentialId,
    impactedCapsules: capsules.map((c) => ({
      id: c.id,
      subjectNpi: c.subjectNpi,
      subjectDid: c.subjectDid,
      decisionType: c.decisionType,
      status: c.status,
      decisionTimestamp: c.decisionTimestamp.toISOString(),
    })),
    impactedNpis,
    impactedDecisionTypes,
    totalImpacted: capsules.length,
  };
}

export const revocationCascade = { propagateRevocation, computeBlastRadius };
