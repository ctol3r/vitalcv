/**
 * trustDecisionService.ts — Persistence layer for DecisionArtifact
 *
 * Bridges trustRulesEngine (pure function) → ProviderDecisionState (database).
 *
 * Responsibilities:
 *   - Load current ClaimRecords for an NPI
 *   - Call trustRulesEngine.evaluateTrust()
 *   - Upsert ProviderDecisionState (latest decision, always current)
 *   - Append to ProviderDecisionHistory (immutable audit log)
 *   - Return the DecisionArtifact
 *
 * This is the layer that satisfies "append-only, evidence-backed" — the
 * history table is never modified after write.
 */

import { randomUUID } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  evaluateTrust,
  METHODOLOGY_VERSION,
  type DecisionArtifact,
  type TrustEvaluationOptions,
  type DecisionClass,
} from './trustRulesEngine';
import type { NormalizedClaim } from '../identity/evidenceModel';
import type { ClaimType, EvidenceTier } from '../identity/sourceCatalog';

const NPI_RE = /^\d{10}$/;

// ── Load claims from DB ───────────────────────────────────────────────────────

/**
 * Load the most-recent active ClaimRecords for an NPI, mapped to NormalizedClaim.
 *
 * For each (claimType, sourceId) pair we keep only the most recent record,
 * matching the "prefer newer retrieval" conflict resolution rule.
 */
async function loadClaimsForNpi(npi: string): Promise<NormalizedClaim[]> {
  const records = await prisma.claimRecord.findMany({
    where: {
      subjectNpi: npi,
      status: { not: 'SUPERSEDED' },
    },
    orderBy: { derivedAt: 'desc' },
  });

  // Deduplicate: (claimType, sourceId) → most recent
  const seen = new Set<string>();
  const deduped = records.filter(r => {
    const key = `${r.claimType}:${r.sourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.map(r => ({
    claimId:          r.claimId,
    claimType:        r.claimType as ClaimType,
    subjectNpi:       r.subjectNpi,
    value:            r.value as NormalizedClaim['value'],
    tier:             r.trustTier as EvidenceTier,
    confidence:       r.confidenceLabel as NormalizedClaim['confidence'],
    confidenceScore:  r.confidenceScore,
    sourceId:         r.sourceId,
    artifactId:       r.verificationArtifactId ?? '',
    artifactChecksum: '',
    parserVersion:    r.parserVersion,
    derivedAt:        r.derivedAt.toISOString(),
    observedAt:       r.observedAt.toISOString(),
    validFrom:        r.validFrom?.toISOString() ?? null,
    validUntil:       r.validUntil?.toISOString() ?? null,
    expiresAt:        r.expiresAt?.toISOString() ?? null,
    status:           r.status as NormalizedClaim['status'],
    supersededBy:     r.supersededByClaimId ?? null,
    supersedes:       r.supersedesClaimId ?? null,
    reviewRequired:   r.reviewRequired,
    reviewReason:     r.reviewReason ?? null,
    humanReviewAt:    null,
  }));
}

// ── Persist decision ──────────────────────────────────────────────────────────

async function persistDecision(artifact: DecisionArtifact): Promise<void> {
  const stateData = {
    npi:                 artifact.npi,
    decisionClass:       artifact.decisionClass,
    aggregateConfidence: artifact.aggregateConfidence,
    context:             artifact.context,
    methodologyVersion:  artifact.methodologyVersion,
    evaluatedAt:         new Date(artifact.evaluatedAt),
    expiresAt:           new Date(artifact.expiresAt),
    claimCount:          artifact.claimCount,
    goldClaimCount:      artifact.goldClaimCount,
    silverClaimCount:    artifact.silverClaimCount,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    freshnessEvals:      artifact.freshnessEvals as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    negativeFindings:    artifact.negativeFindings as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conflicts:           artifact.conflicts as any,
    explanation:         artifact.explanation,
    claimIds:            artifact.claimIds,
  };

  // Upsert latest state
  const state = await prisma.providerDecisionState.upsert({
    where:  { npi: artifact.npi },
    create: { id: randomUUID(), ...stateData },
    update: stateData,
  });

  // Append to history (immutable)
  await prisma.providerDecisionHistory.create({
    data: {
      id:                  randomUUID(),
      npi:                 artifact.npi,
      stateId:             state.id,
      decisionClass:       artifact.decisionClass,
      aggregateConfidence: artifact.aggregateConfidence,
      context:             artifact.context,
      methodologyVersion:  artifact.methodologyVersion,
      evaluatedAt:         new Date(artifact.evaluatedAt),
      expiresAt:           new Date(artifact.expiresAt),
      explanation:         artifact.explanation,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      negativeFindings:    artifact.negativeFindings as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conflicts:           artifact.conflicts as any,
      claimIds:            artifact.claimIds,
    },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Run a full trust evaluation for an NPI and persist the result. */
export async function runTrustDecision(
  npi: string,
  opts: TrustEvaluationOptions = {},
): Promise<DecisionArtifact> {
  if (!NPI_RE.test(npi)) throw new Error(`Invalid NPI: ${npi}`);

  const claims = await loadClaimsForNpi(npi);
  const artifact = evaluateTrust(npi, claims, opts);

  await persistDecision(artifact);

  const conflictTypes = Array.from(new Set(artifact.conflicts.map((conflict) => conflict.claimType)));
  log('info', 'trust_arbitration_evaluated', {
    npi,
    decisionClass: artifact.decisionClass,
    conflictCount: artifact.conflicts.length,
    conflictTypes,
    negativeFindingCount: artifact.negativeFindings.length,
    methodologyVersion: artifact.methodologyVersion,
  });

  log('info', 'trust_decision_evaluated', {
    npi,
    decisionClass: artifact.decisionClass,
    confidence: artifact.aggregateConfidence,
    claimCount: artifact.claimCount,
    goldCount: artifact.goldClaimCount,
    context: artifact.context,
    methodologyVersion: artifact.methodologyVersion,
  });

  return artifact;
}

/** Get the latest persisted decision for an NPI. Re-evaluates if expired. */
export async function getOrEvaluateTrustDecision(
  npi: string,
  opts: TrustEvaluationOptions = {},
): Promise<DecisionArtifact> {
  if (!NPI_RE.test(npi)) throw new Error(`Invalid NPI: ${npi}`);

  const existing = await prisma.providerDecisionState.findUnique({
    where: { npi },
  });

  const now = new Date();
  const isExpired = !existing || existing.expiresAt < now;
  const isWrongContext = existing && existing.context !== (opts.context ?? 'credentialing');
  const isWrongVersion = existing && existing.methodologyVersion !== METHODOLOGY_VERSION;

  if (isExpired || isWrongContext || isWrongVersion) {
    return runTrustDecision(npi, opts);
  }

  // Return the cached decision as a DecisionArtifact
  return {
    decisionId:          existing.id,
    npi:                 existing.npi,
    decisionClass:       existing.decisionClass as DecisionClass,
    aggregateConfidence: existing.aggregateConfidence,
    context:             existing.context as TrustEvaluationOptions['context'] ?? 'credentialing',
    methodologyVersion:  existing.methodologyVersion,
    evaluatedAt:         existing.evaluatedAt.toISOString(),
    expiresAt:           existing.expiresAt.toISOString(),
    claimCount:          existing.claimCount,
    goldClaimCount:      existing.goldClaimCount,
    silverClaimCount:    existing.silverClaimCount,
    freshnessEvals:      existing.freshnessEvals as unknown as DecisionArtifact['freshnessEvals'],
    negativeFindings:    existing.negativeFindings as unknown as DecisionArtifact['negativeFindings'],
    conflicts:           existing.conflicts as unknown as DecisionArtifact['conflicts'],
    explanation:         existing.explanation,
    claimIds:            existing.claimIds as string[],
  };
}

/** Get decision history for an NPI (audit trail). */
export interface DecisionHistoryEntry {
  id: string;
  decisionClass: DecisionClass;
  aggregateConfidence: number;
  context: string;
  methodologyVersion: string;
  evaluatedAt: string;
  explanation: string;
  negativeFindings: DecisionArtifact['negativeFindings'];
  conflicts: DecisionArtifact['conflicts'];
}

export async function getDecisionHistory(
  npi: string,
  limit = 20,
): Promise<DecisionHistoryEntry[]> {
  const rows = await prisma.providerDecisionHistory.findMany({
    where:   { npi },
    orderBy: { recordedAt: 'desc' },
    take:    limit,
  });

  return rows.map(r => ({
    id:                  r.id,
    decisionClass:       r.decisionClass as DecisionClass,
    aggregateConfidence: r.aggregateConfidence,
    context:             r.context,
    methodologyVersion:  r.methodologyVersion,
    evaluatedAt:         r.evaluatedAt.toISOString(),
    explanation:         r.explanation,
    negativeFindings:    r.negativeFindings as unknown as DecisionArtifact['negativeFindings'],
    conflicts:           r.conflicts as unknown as DecisionArtifact['conflicts'],
  }));
}

/** Bulk: get current decision class for multiple NPIs. For dashboard/list views. */
export async function getDecisionClassBatch(
  npis: string[],
): Promise<Record<string, DecisionClass | null>> {
  const rows = await prisma.providerDecisionState.findMany({
    where:  { npi: { in: npis } },
    select: { npi: true, decisionClass: true },
  });

  const out: Record<string, DecisionClass | null> = {};
  for (const npi of npis) out[npi] = null;
  for (const row of rows) out[row.npi] = row.decisionClass as DecisionClass;
  return out;
}
